# Aither Service User Setup Guide

## Übersicht

Aither kommuniziert mit der Hemera Academy API über einen dedizierten Service-User mit der Rolle `api-client`. Dieser Guide beschreibt die Einrichtung.

## Architektur

```
Aither App (Server-Side)
    ↓
Token Manager (getToken())
  ↓
Service Credential (long-lived token)
    ↓
Hemera API (/api/service/*)
    ↓
Auth Middleware (getUserRole())
    ↓
Service Endpoints (api-client oder admin)
```

## Schritt 1: Service-User in Clerk anlegen

1. **Clerk Dashboard öffnen**: https://dashboard.clerk.com
2. **Zum Hemera-Projekt navigieren**
3. **Users → Create User**
4. **User-Daten eingeben**:
   - Email: `aither-service@hemera-academy.com`
   - Password: Sicheres, generiertes Passwort (wird nicht für Login verwendet)
   - First Name: `Aither`
   - Last Name: `Service`

5. **Public Metadata setzen**:
   ```json
   {
     "role": "api-client",
     "service": "aither",
     "description": "Service user for Aither-Hemera API integration"
   }
   ```

6. **User ID notieren**: z.B. `user_2abc...`

## Schritt 2: Dienst-Zugangstoken / Service Credential

Für Production empfehlen wir die Verwendung eines langlebigen Service-Credentials
statt kurzlebiger Dashboard-Sessions. Dashboard-generierte Session-Tokens sind
typischerweise kurzlebig (z. B. ~60m) und eignen sich nicht für unbeaufsichtigte
Service-to-Service-Kommunikation.

Empfohlene Optionen:

- Clerk Backend API: Erzeuge ein dauerhaftes Service-Credential oder nutze
  organisation/permission Tokens über die Clerk Backend API und implementiere
  eine Rotation. Siehe: https://clerk.com/docs/server/backend-api
- Organisation/Service-Tokens: Falls eure Organisation einen eigenen Service-
  token-Mechanismus unterstützt, verwendet diesen (z. B. organisationMembership
  tokens).

Beispiel (nur Illustration) — generiere ein langlebiges Token mit dem Backend
API und setze es in `.env` als `HEMERA_SERVICE_TOKEN`.

**Wichtig**: Rotieren und verwalten Sie diese Schlüssel über einen Secret
Manager (Vercel/AWS/GCP) und vermeiden Sie das Committen in die Versionskontrolle.

## Schritt 3: Environment Variables konfigurieren

### In Aither (.env)

```bash
# Hemera API Base URL
HEMERA_API_BASE_URL=https://hemera-academy.vercel.app

# Service Token — use a long-lived service credential (see step above)
HEMERA_SERVICE_TOKEN=your-long-lived-service-token-here

# Clerk Credentials
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

### In Hemera (keine Änderungen nötig)

Die Hemera-Seite ist bereits konfiguriert:
- `api-client` Rolle ist in `lib/auth/permissions.ts` definiert
- Service-Endpunkte unter `/api/service/*` sind implementiert
- Auth-Guards prüfen auf `api-client` oder `admin` Rolle

## Schritt 4: Berechtigungen verifizieren

Der Service-User hat folgende Berechtigungen (definiert in `lib/auth/permissions.ts`):

```typescript
'api-client': [
  'read:courses',
  'read:participations',
  'write:participation-results',
]
```

### Erlaubte Endpunkte:

- ✅ `GET /api/service/courses` - Kursliste abrufen
- ✅ `GET /api/service/courses/[id]` - Kursdetails mit Participations
- ✅ `GET /api/service/participations/[id]` - Participation-Details
- ✅ `PUT /api/service/participations/[id]/result` - Ergebnisse schreiben

### Verbotene Endpunkte:

- ❌ `/api/admin/*` - Admin-Funktionen
- ❌ `/api/courses` (ohne `/service/`) - Öffentliche API
- ❌ Alle anderen nicht-service Endpunkte

## Schritt 5: Integration testen

### Test 1: Kursliste abrufen

```bash
curl -X GET https://hemera-academy.vercel.app/api/service/courses \
  -H "Authorization: Bearer YOUR_SERVICE_TOKEN" \
  -H "Content-Type: application/json"
```

**Erwartete Antwort** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "title": "Laparoskopie Basiskurs",
      "slug": "laparoskopie-basiskurs",
      "level": "BASIC",
      "startDate": "2026-03-15T00:00:00.000Z",
      "endDate": "2026-03-16T00:00:00.000Z",
      "participantCount": 12
    }
  ],
  "requestId": "...",
  "userId": "user_2abc...",
  "userRole": "api-client"
}
```

### Test 2: Participation-Ergebnis schreiben

```bash
curl -X PUT https://hemera-academy.vercel.app/api/service/participations/PARTICIPATION_ID/result \
  -H "Authorization: Bearer YOUR_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resultOutcome": "Erfolgreich abgeschlossen",
    "resultNotes": "Sehr gute Leistung",
    "complete": true
  }'
```

**Erwartete Antwort** (200 OK):
```json
{
  "success": true,
  "message": "Participation result updated successfully",
  "requestId": "...",
  "userId": "user_2abc...",
  "userRole": "api-client"
}
```

### Test 3: Fehlerfall - Ungültiges Token

```bash
curl -X GET https://hemera-academy.vercel.app/api/service/courses \
  -H "Authorization: Bearer invalid_token"
```

**Erwartete Antwort** (401 Unauthorized):
```json
{
  "success": false,
  "error": "Not authenticated",
  "code": "UNAUTHORIZED",
  "requestId": "..."
}
```

## Sicherheitshinweise

### Token-Sicherheit

1. **Niemals Token in Git committen**: `.env` ist in `.gitignore`
2. **Token-Rotation**: Implementiere regelmäßige Token-Erneuerung
3. **Sichere Speicherung**: Verwende Secret Manager (Vercel, AWS, GCP)
4. **Monitoring**: Überwache API-Aufrufe via Rollbar

### Rate Limiting

Der Aither-Client ist auf **2 Requests/Sekunde** limitiert (p-throttle).
Hemera-seitig gibt es zusätzliche Rate Limits pro User/Role.

### Audit Trail

Alle Service-API-Aufrufe werden geloggt:
- User ID des Service-Users
- Endpoint und Methode
- Timestamp und Response Time
- Status Code

Logs sind in Rollbar und Hemera-Datenbank verfügbar.

## Troubleshooting

### Problem: 401 Unauthorized

**Ursache**: Token ungültig oder abgelaufen

**Lösung**:
1. Token-Gültigkeit prüfen (JWT dekodieren)
2. Neues Token generieren (siehe Schritt 2)
3. `HEMERA_SERVICE_TOKEN` in `.env` aktualisieren

### Problem: 403 Forbidden

**Ursache**: Service-User hat nicht die richtige Rolle

**Lösung**:
1. Clerk Dashboard öffnen
2. Service-User suchen
3. Public Metadata prüfen: `{ "role": "api-client" }`
4. Falls falsch: Metadata korrigieren und speichern

### Problem: 429 Too Many Requests

**Ursache**: Rate Limit überschritten

**Lösung**:
1. Aither-Client respektiert automatisch `Retry-After` Header
2. Warte auf automatischen Retry
3. Falls persistent: Rate Limit in Hemera erhöhen

### Problem: 500 Internal Server Error

**Ursache**: Server-seitiger Fehler in Hemera

**Lösung**:
1. Rollbar Dashboard prüfen (Hemera-Projekt)
2. Error-Details analysieren
3. Bei Bedarf Hemera-Team kontaktieren

## Token-Refresh-Strategie (Production)

Für Production sollte ein automatischer Token-Refresh implementiert werden:

```typescript
// In Aither: src/lib/hemera/token-manager.ts erweitern

import { clerkClient } from '@clerk/nextjs/server';
import type { Session } from '@clerk/nextjs/server';

class HemeraTokenManager {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  async getToken(): Promise<string> {
    // Return cached token if still valid (> 2 minutes remaining)
    if (this.tokenCache && this.isTokenValid(this.tokenCache)) {
      return this.tokenCache.token;
    }

    // Fetch new token via Clerk Backend API
    const newToken = await this.fetchNewToken();
    return newToken;
  }

  private async fetchNewToken(): Promise<string> {
    // Use the Clerk server client instance provided by the SDK
    // The Clerk backend API exposes session creation via `clerkClient.sessions.create`.
    const session: Session = await clerkClient.sessions.create({
      userId: process.env.CLERK_SERVICE_USER_ID!,
      expiresInSeconds: 900, // 15 minutes
    } as any);

    // Access typed token fields on the returned session.
    // Clerk session types typically expose `lastActiveToken` which itself
    // contains a typed `raw` or `jwt` property. Use these typed fields
    // instead of unsafe `any` casts.
    const lastActiveToken = (session as unknown as { lastActiveToken?: { raw?: string; jwt?: string } }).lastActiveToken;
    const token = lastActiveToken?.raw ?? lastActiveToken?.jwt ?? (session as unknown as { token?: string }).token ?? (session as unknown as { jwt?: string }).jwt;

    if (!token) throw new Error('Failed to obtain service token from Clerk session response');

    this.tokenCache = {
      token,
      expiresAt: Date.now() + 900 * 1000 - 30000, // -30s safety margin
    };

    return this.tokenCache.token;
  }

  // Validate cached token structure and expiry
  private isTokenValid(cache: { token: string; expiresAt: number } | null): cache is { token: string; expiresAt: number } {
    if (!cache) return false;
    if (!cache.token || typeof cache.token !== 'string') return false;
    if (!cache.expiresAt || typeof cache.expiresAt !== 'number') return false;
    return cache.expiresAt > Date.now();
  }
}
```

## Weiterführende Dokumentation

- [Hemera API Documentation](../hemera/docs/api/README.md)
- [Clerk Backend API](https://clerk.com/docs/reference/backend-api)
- [Aither Integration Spec](../specs/001-hemera-api-integration/spec.md)
- [Service API Contract](../specs/001-hemera-api-integration/contracts/hemera-api-consumer-contract.md)
