# Hemera Academy API Integration – Dokumentation

## Übersicht

Dieses Projekt integriert die Hemera Academy API in die Aither-Plattform. Es werden HTML-Templates und Teilnehmerdaten synchronisiert, Medien eingebettet, Aufzeichnungen übertragen, ein täglicher automatischer Sync durchgeführt, Fehler und Status überwacht sowie ein Admin-Dashboard bereitgestellt. Die Implementierung folgt strikt TDD (Test-First) und ist vollständig mit Unit-, Contract- und E2E-Tests abgedeckt.

---

## Architektur

- **Framework:** Next.js 16, React 19, TypeScript 5
- **Kernmodule:**
   - `src/lib/hemera/`: API-Client, Typen, Schemas
  - `src/lib/sync/`: Orchestrator, Hash-Manifest, Mutex, Recording-Transmitter
  - `src/lib/html/`: Template-Populator, Writer
  - `src/lib/notifications/`: E-Mail-Benachrichtigungen
  - `src/lib/monitoring/`: Rollbar-Integration, Logging
  - `src/lib/auth/`: Rollenbasierte Authentifizierung
  - `src/app/api/`: API-Routen für Sync und Recordings
  - `src/app/(dashboard)/sync/`: Admin-Dashboard (Status, Trigger)
  - `output/`: Generierte HTML-Dateien und Manifest
  - `tests/`: Unit-, Contract- und E2E-Tests

---

## Hauptfunktionen

1. **Daten-Sync:**
   - Ruft Templates, Seminare, Lektionen, Nutzer, Texte, Medien von hemera.academy ab
   - Populiert HTML-Templates mit Teilnehmerdaten
   - Schreibt HTML-Dateien atomar in `output/`
   - Hash-Manifest für inkrementellen Sync (nur geänderte Dateien)

2. **Medien-Einbettung:**
   - Handlebars-Helper für Bilder und Videos mit Fallback

3. **Recording-Übertragung:**
   - API `/api/recordings` nimmt MUX-URLs entgegen und leitet sie an Hemera weiter

4. **Automatischer Sync:**
   - Cron-Trigger (z.B. täglich 2 Uhr)
   - Mutex verhindert parallele Syncs

5. **Fehlerbehandlung & Monitoring:**
   - Rollbar-Logging mit PII-Filter
   - E-Mail-Benachrichtigung nach mehreren Fehlern
   - Sync-Status und Fehlerhistorie via API und Dashboard

6. **Access Control:**
   - Clerk-Authentifizierung
   - Nur Admins dürfen Sync/Recordings/Dashboard nutzen

7. **Polish & Qualität:**
   - JSDoc für alle öffentlichen Funktionen
   - Biome-Formatierung und Linting
   - E2E-Test (Playwright): Sync-Ende-zu-Ende
   - Performance-Test: 500 Records < 5 Minuten

---

## Setup & Betrieb

1. **Installation:**
   - `npm install`
   - `.env` nach `.env.example` anlegen und konfigurieren
2. **Entwicklung:**
   - `npx vitest` (Unit/Contract-Tests)
   - `npx playwright test` (E2E)
   - `npx biome check .` (Format/Lint)
3. **Sync auslösen:**
   - POST `/api/sync` (nur für Admins)
   - GET `/api/sync` (Status)
4. **Recording übertragen:**
   - POST `/api/recordings` (nur für Admins)
5. **Dashboard:**
   - `/sync` (nur für Admins, Status & Trigger)
6. **Automatischer Sync:**
   - Cronjob-Beispiel: `0 2 * * * curl -s -X POST http://localhost:3000/api/sync -H "Authorization: Bearer $AITHER_SYNC_TOKEN"`

---

## Tests & Qualitätssicherung

- **TDD:** Alle Features sind testgetrieben entwickelt
- **Testarten:**
  - Unit-Tests: Kernlogik, Validierung, Fehlerfälle
  - Contract-Tests: API-Konformität
  - E2E-Tests: Gesamtablauf (Playwright)
  - Performance-Test: Sync mit 500 Records < 5 Minuten
- **Linting/Formatierung:** Biome enforced
- **Security:** PII-Filter, keine API-Keys im Client, Auth-Zwang für alle kritischen Endpunkte

---

## Erweiterung & Wartung

- Neue Templates/Entitäten: Typen und Schemas in `src/lib/hemera/` ergänzen
- Zusätzliche Sync-Logik: Orchestrator erweitern
- Weitere Dashboards/Views: Unter `src/app/(dashboard)/` anlegen
- Fehler/Monitoring: Rollbar- und E-Mail-Integration nutzen

---

## Autoren & Support

- Hauptentwicklung: Andreas (Aither)
- Bei Fragen/Fehlern: Siehe README.md oder Kontakt im Projekt

---

## Changelog (Kurzfassung)

- v1.0: Initiale Integration, alle User Stories, vollständige Testabdeckung, Performance validiert

---

**Stand:** 12.02.2026
