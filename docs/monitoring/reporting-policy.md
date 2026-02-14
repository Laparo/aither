---
# Aither Telemetry Whitelist

Diese Datei enthält die Aither-spezifische Whitelist für `additionalData`-Schlüssel in `reportError(...)`-Aufrufen.
Aither nutzt dieselben Datenschutzgrundsätze wie Hemera; hier sind die erlaubten Keys, ergänzt um projekt-spezifische Felder.

Grundsätze
- Keine Klartext-Fehlertexte oder rohe HTTP-Antworten in `additionalData`.
- E-Mails nur maskiert (z. B. `j***e@example.com`).
- Tokens/API-Keys niemals in `additionalData`.
- Bei Unsicherheit: redigieren (`"[redacted]"`).

Aither Whitelist (top-level keys)
- `context` (string)
- `requestId` (string)
- `sessionId` (string)
- `bookingId` (string)
- `courseId` (string)
- `userId` (string) — nur falls nötig
- `paymentIntentId` (string)
- `disputeId` (string)
- `amount` (number)
- `reason` (string)
- `recipientCount` (number)
- `errorType` (string)
- `issueCount` (number)
- `issues` (array of sanitized issue objects, no raw payloads)
- `receivedDataSummary` (object with `type` and `keyCount`)
- `recipientEmail` (masked string)
- `operation` (string)
- `duration` (number)
- `performanceIssue` (boolean)
- `slowApiCall` (boolean)
- `timestamp` (string)

Aither-specific Ergänzungen
- `aitherRequestId` (string) — korreliert mit Aither-Requests
- `modelVersion` (string) — nur Versions-Metadaten, keine Modell-Ausgabe
- `integrationPoint` (string) — beschreibend, z. B. `aither.ingest` oder `aither.predict`

Redaction-Regeln
- Key-Namen wie `/originalError/i`, `/errorMessage/i`, `/message$/i` müssen redigiert werden.
- Falls ein Key nicht in dieser Whitelist auftaucht, muss entweder:
  - vor Reporting redigiert werden, oder
  - als Ausnahme dokumentiert und hier ergänzt werden.

Enforcement
- Verwende `scripts/check-reporterror-keys.mjs` (bereits im Repo), um Abweichungen zu finden.
- In PRs für Aither-Integration bitte diese Datei referenzieren und ggf. neue Keys hier beantragen.

Nächste Schritte
- Falls Du möchtest, erweitere ich das Prüfskript, damit es Aither-spezifische Ausnahmen automatisch erlaubt (z. B. `specs/aither/**`), oder ich unterstütze beim Durchgehen der gefundenen Keys und passe `reportError`-Aufrufe an.

---
