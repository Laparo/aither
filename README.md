# spec-kit

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

