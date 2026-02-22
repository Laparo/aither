# Sync Scheduling — Cron-Konfiguration

> **Feature:** 005-data-sync — Periodische Synchronisation der Kurs- und Teilnehmerdaten von Hemera nach Aither.

## Übersicht

Die Aither-Sync-Pipeline wird über `POST /api/sync` ausgelöst. Für automatische, regelmäßige Synchronisation kann ein Cron-Job (z.B. via `crontab`, Vercel Cron, oder externes Scheduling) konfiguriert werden.

## Crontab-Beispiel

```bash
# Alle 30 Minuten Sync triggern (z.B. auf dem Aither-Server oder einem Scheduler)
*/30 * * * * curl -s -X POST https://aither.example.com/api/sync \
  -H "Authorization: Bearer $AITHER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -o /dev/null -w "%{http_code}" \
  | xargs -I{} sh -c 'if [ "{}" != "202" ] && [ "{}" != "409" ]; then echo "Sync fehlgeschlagen: HTTP {}" >&2; fi'
```

### Erklärung

| Parameter | Beschreibung |
|-----------|-------------|
| `*/30 * * * *` | Alle 30 Minuten (anpassbar: `0 */2 * * *` für alle 2 Stunden) |
| `Authorization: Bearer $AITHER_ADMIN_TOKEN` | Admin-Token für authentifizierten Zugriff (Clerk-basiert) |
| `-o /dev/null -w "%{http_code}"` | Nur HTTP-Status-Code ausgeben |

### Erwartete HTTP-Responses

| Status | Bedeutung | Aktion |
|--------|-----------|--------|
| **202 Accepted** | Sync gestartet. Body: `{ "success": true, "data": { "jobId": "sync-...", "status": "running", "startTime": "2026-02-22T..." }, "meta": { "requestId": "req-...", "timestamp": "2026-02-22T..." } }` | Kein Handlungsbedarf |
| **409 Conflict** | Bereits ein Sync aktiv. Body: `{ "success": false, "error": { "code": "SYNC_IN_PROGRESS", "message": "A sync operation is already running" }, "meta": { "requestId": "req-...", "timestamp": "2026-02-22T..." } }` | Normal bei überlappenden Cron-Triggern — kein Fehler |
| **401/403** | Authentifizierung fehlgeschlagen | Token prüfen, Rollbar-Alert erwarten |
| **500** | Server-Fehler | Rollbar-Alert wird automatisch ausgelöst |

## Überlappende Cron-Trigger

Die Sync-API verwendet einen **In-Memory-Mutex**. Wenn ein Cron-Trigger eintrifft während ein vorheriger Sync noch läuft, wird `409 SYNC_IN_PROGRESS` zurückgegeben. Dies ist **erwartetes Verhalten** und kein Fehler.

- Der Mutex hat ein automatisches Timeout von 30 Minuten (konfigurierbar via `SYNC_TIMEOUT_MS` in Millisekunden, Standard: 1800000)
- Nach Timeout wird der Lock automatisch freigegeben

## Rollbar-Monitoring

Nach jedem Sync (Erfolg oder Fehler) wird ein strukturierter Log an Rollbar gesendet:

```json
{
  "level": "info",
  "message": "sync.completed",
  "data": {
    "jobId": "sync-1234567890",
    "status": "success",
    "durationMs": 1520,
    "courseId": "cm5abc123",
    "participantsFetched": 8,
    "filesGenerated": 1,
    "filesSkipped": 0,
    "errorCount": 0
  }
}
```

### Empfohlene Rollbar-Alerts

| Bedingung | Schweregrad | Beschreibung |
|-----------|-------------|-------------|
| `sync.completed` mit `status: "failed"` | Warning | Sync fehlgeschlagen — API-Verbindung oder Datenproblem |
| `sync.manifest.corrupted` | Warning | Manifest-Datei beschädigt — volle Regenerierung |
| HTTP 500 auf `/api/sync` | Error | Server-Fehler im Sync-Endpoint |

## Vercel Cron (Alternative)

Falls auf Vercel deployed, kann ein Cron-Job in `vercel.json` konfiguriert werden:

```json
{
  "crons": [
    {
      "path": "/api/sync",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

> **Hinweis:** Vercel Cron sendet GET-Requests. Der Sync-Endpoint erwartet jedoch POST. Für Vercel Cron muss entweder der Endpoint angepasst oder ein separater Cron-Handler erstellt werden.

## Sync-Status prüfen

```bash
# Aktuellen Sync-Status abfragen
curl -s https://aither.example.com/api/sync \
  -H "Authorization: Bearer $AITHER_ADMIN_TOKEN" \
  | jq .
```

Erwartete Responses:

| Status | Body |
|--------|------|
| **200** | `{ "success": true, "data": { "jobId": "sync-...", "status": "success", "courseId": "cm5abc123", "filesGenerated": 1, "filesSkipped": 0 }, "meta": { "requestId": "req-...", "timestamp": "2026-02-22T..." } }` |
| **404** | `{ "success": false, "error": { "code": "NO_SYNC_JOB", "message": "No sync operation has been run" }, "meta": { "requestId": "req-...", "timestamp": "2026-02-22T..." } }` — Noch kein Sync ausgeführt |
