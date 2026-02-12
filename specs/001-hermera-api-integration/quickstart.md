# Quickstart: Hemera Academy API Integration

**Feature**: 001-hemera-api-integration  
**Date**: 2026-02-11

---

## Prerequisites

- Node.js 18+ (LTS)
- npm
- Access to the hemera.academy API (API key)
- Clerk account with admin role configured
- SMTP credentials for email notifications
- Git (repo cloned on `001-hemera-api-integration` branch)

## Environment Setup

1. **Clone and checkout**:
   ```bash
   git clone <repo-url>
   cd aither
   git checkout 001-hemera-api-integration
   npm install
   ```

2. **Configure environment variables** — copy `.env.example` to `.env` and fill in:
   ```env
  # Hemera Academy API
  HEMERA_API_BASE_URL=https://api.hemera.academy
  HEMERA_API_KEY=your-api-key-here

   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   CLERK_SECRET_KEY=sk_...

   # SMTP Notifications
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=user@example.com
   SMTP_PASS=password
   SMTP_FROM=aither@example.com
   NOTIFY_EMAIL_TO=operator@example.com
   NOTIFY_FAILURE_THRESHOLD=3

   # Rollbar Error Monitoring
   ROLLBAR_SERVER_TOKEN=your-rollbar-token
   NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN=your-client-token

   # Output Directory (default: output/)
   HTML_OUTPUT_DIR=output
   ```

3. **Verify setup**:
   ```bash
   npm run build
   npm run test
   ```

## Development Workflow

### TDD Cycle (Constitution I — NON-NEGOTIABLE)

1. **Write contract test** (e.g., `tests/contract/hemera-api.contract.spec.ts`)
2. **Run test — confirm it fails** (`npm run test`)
3. **Implement minimal code** to pass the test
4. **Run test — confirm it passes**
5. **Refactor** — ensure Biome passes (`npm run lint`)
6. **Commit** (Husky pre-commit runs Biome + tests)

### Running Locally

```bash
# Development mode (hot reload)
npm run dev

# Production mode
npm run build && npm start
```

### Triggering a Manual Sync

```bash
# Via curl (requires valid Clerk token or API key)
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"

# Check status
curl http://localhost:3000/api/sync \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

### Transmitting a Recording URL

```bash
curl -X POST http://localhost:3000/api/recordings \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "seminarSourceId": "sem-001",
    "muxAssetId": "asset-abc123",
    "muxPlaybackUrl": "https://stream.mux.com/abc123.m3u8",
    "recordingDate": "2026-02-11T10:00:00Z"
  }'
```

## Production Setup (Linux)

### systemd Service

```bash
# /etc/systemd/system/aither.service
[Unit]
Description=Aither Academy Integration
After=network.target

[Service]
Type=simple
User=aither
WorkingDirectory=/opt/aither
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
EnvironmentFile=/opt/aither/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable aither
sudo systemctl start aither
```

### Cron Job for Daily Sync

```bash
# crontab -e (as aither user)
# Run sync daily at 02:00
0 2 * * * curl -s -X POST http://localhost:3000/api/sync -H "Authorization: Bearer $AITHER_SYNC_TOKEN" >> /var/log/aither-sync.log 2>&1
```

## Key Files

| Path | Purpose |
|------|---------|
| `src/lib/hemera/client.ts` | Hemera API HTTP client (auth, throttling, retry) |
| `src/lib/hemera/schemas.ts` | Zod schemas for API response validation |
| `src/lib/sync/orchestrator.ts` | Sync job orchestration (fetch → populate → write) |
| `src/lib/sync/hash-manifest.ts` | Content hash computation & manifest management |
| `src/lib/html/populator.ts` | Template population engine (Handlebars) |
| `src/lib/html/writer.ts` | Atomic HTML file writer |
| `src/lib/notifications/email.ts` | SMTP email notifications (Nodemailer) |
| `src/app/api/sync/route.ts` | Sync trigger & status API |
| `src/app/api/recordings/route.ts` | MUX recording URL transmission API |
| `output/` | Generated HTML files (gitignored) |

## Testing

```bash
# All tests
npm run test

# Unit tests only
npm run test:unit

# Contract tests only
npm run test:contract

# E2E tests (requires running dev server)
npm run test:e2e

# Biome lint/format check
npm run lint
```

## Architecture Overview

```
System Cron ──────► POST /api/sync ──────► SyncOrchestrator
                                               │
                    ┌──────────────────────────┤
                    ▼                          ▼
              HemeraClient              HemeraClient
              (fetch templates)          (fetch data)
                    │                          │
                    └──────────┬───────────────┘
                               ▼
                        TemplatePopulator
                    (template + data → HTML)
                               │
                               ▼
                      HashManifest.compare()
                    (skip unchanged entities)
                               │
                               ▼
                         HtmlWriter
                    (atomic file writes)
                               │
                               ▼
                     output/{type}/{id}.html

Camera Feature ──► POST /api/recordings ──► RecordingTransmitter
                                               │
                                               ▼
                                      HemeraClient
                                  (PUT /seminars/{id}/recording)
```
