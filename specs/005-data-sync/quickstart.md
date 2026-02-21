# Quickstart: Data Synchronization

**Feature**: 005-data-sync

## Prerequisites

1. Hemera running on `http://localhost:3000` (with courses seeded)
2. Aither `.env.local` configured with `HEMERA_API_BASE_URL` and `HEMERA_API_KEY`
3. `output/` directory exists and is writable

## Manual Sync

```bash
# Trigger a sync
curl -X POST http://localhost:3500/api/sync \
  -H "Content-Type: application/json"

# Check sync status
curl http://localhost:3500/api/sync/status
```

## Verify Output

```bash
# List generated files
ls -la output/seminars/

# View a generated HTML file
open output/seminars/gehaltsgespraech.html
```

## View on Homepage

Open `http://localhost:3500` — the course table should display live data from Hemera.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `HEMERA_API_BASE_URL not set` | Add to `.env.local` |
| `401 Unauthorized` | Check `HEMERA_API_KEY` matches Hemera's `HEMERA_SERVICE_API_KEY` |
| `output/` not writable | `chmod 755 output/` |
| Stale data | Re-trigger sync or check cron schedule |
