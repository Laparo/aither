# aither

## Development

- **Open in VS Code**: if you installed the `code` CLI, run:

```bash
npm run open:code
```

- **Python tools** (optional, for `specify` CLI): the repository uses a local virtualenv at `.venv`. Activate it with:

```bash
source .venv/bin/activate   # macOS / Linux
specify --help
```

## Data Sync (005-data-sync)

Aither synchronisiert Kursdaten von der Hemera API und generiert statische HTML-Seiten für Trainer.

### Architektur

```
Cron / curl POST /api/sync
        ↓
   Mutex (409 bei Overlap)
        ↓
   selectNextCourse() → nächster Kurs nach Startdatum
        ↓
   Hemera API: GET /api/service/courses/:id
        ↓
   Hash-basierter Vergleich (.sync-manifest.json)
        ↓  (nur bei Änderung)
   Handlebars-Template → HTML nach output/courses/
        ↓
   Manifest aktualisieren
```

### API-Endpunkte

| Methode | Pfad | Beschreibung | Status |
|---------|------|-------------|--------|
| POST | `/api/sync` | Sync starten (fire-and-forget) | 202 / 409 |
| GET | `/api/sync` | Letzten Job-Status abfragen | 200 / 404 |

### Inkrementeller Sync

- Dateihashes werden in `output/courses/.sync-manifest.json` gespeichert
- Bei unveränderter Datenlage wird die HTML-Generierung übersprungen (`filesSkipped`)
- Korrupte Manifeste werden per Rollbar-Warning geloggt und neu erstellt

### Homepage (SSR)

Die Startseite (`src/app/page.tsx`) zeigt den nächsten Kurs mit Teilnehmer-Tabelle via Server-Side Rendering.

### Quickstart

Siehe [`specs/005-data-sync/quickstart.md`](specs/005-data-sync/quickstart.md) für 7 Verifikationsschritte.

### Cron-Scheduling

Siehe [`docs/sync-scheduling.md`](docs/sync-scheduling.md) für Crontab-Beispiele und Monitoring.

## Rollbar API Tokens

**Wichtig:** Für AI-Tools, Automatisierung und Monitoring sollte ein Rollbar-Token mit minimalen Rechten verwendet werden.

**Hinweis (Client):** Wenn `NEXT_PUBLIC_ROLLBAR_ENABLED=1` gesetzt ist, muss auch `NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN` gesetzt werden. Andernfalls schlägt die Initialisierung im Browser fehl. Der Client-Token darf nur Lesezugriff besitzen und keine sensiblen Daten übertragen.

- `ROLLBAR_ACCESS_TOKEN` (read+write): Nur verwenden, wenn Schreibzugriff wirklich benötigt wird.
- `ROLLBAR_ACCESS_TOKEN_READONLY` (empfohlen): Für die meisten Integrationen reicht ein Read-Only-Token. Diesen im Rollbar-Dashboard unter "Project Access Tokens" erzeugen und in `.env` als `ROLLBAR_ACCESS_TOKEN_READONLY` setzen.

**Beispiel `.env`-Eintrag:**

```env
# Rollbar für AI-Tools (empfohlen: Read-Only)
ROLLBAR_ACCESS_TOKEN_READONLY=your-rollbar-readonly-token
# Nur falls Schreibzugriff benötigt wird:
# ROLLBAR_ACCESS_TOKEN=your-rollbar-read-write-token
```

**Hinweis:** Die Anwendung und alle Automatisierungen sollten nach Möglichkeit immer den Read-Only-Token verwenden. Schreibende Aktionen sind nur für spezielle Admin- oder Deployment-Workflows nötig.

