# Implementation Plan: Data Synchronization

**Feature**: 005-data-sync  
**Status**: Draft  
**Depends on**: 001-hemera-api-integration, 003-service-user

## Phase 1 — Sync API Endpoint (P1)

### Task 1.1: POST /api/sync Route

Create `src/app/api/sync/route.ts` implementing:
- Authentication via API key or internal token
- Concurrent sync guard (in-memory lock)
- Call sync pipeline service
- Return structured JSON response with sync statistics

### Task 1.2: Sync Pipeline Service

Create `src/lib/sync/pipeline.ts` implementing:
- Fetch courses from Hemera `/api/service/courses`
- Fetch participations from Hemera `/api/service/participations` (when available)
- Collect results into a typed `SyncResult` object

### Task 1.3: Content Hash Manifest

Create `src/lib/sync/manifest.ts` implementing:
- SHA-256 hash computation for each entity
- Read/write `.sync-manifest.json` from `output/`
- Diff current vs. previous hashes to detect changes

## Phase 2 — HTML Generation (P1)

### Task 2.1: Template Engine

Create `src/lib/html/generator.ts` implementing:
- Load HTML templates (from Hemera API or local fallback)
- Populate template placeholders with entity data
- Write generated HTML to `output/` subdirectories

### Task 2.2: Incremental Write

Only write files whose content hash has changed. Skip unchanged entities to reduce I/O.

## Phase 3 — Status & Monitoring (P2)

### Task 3.1: GET /api/sync/status

Return last sync time, duration, entity counts, and error summary.

### Task 3.2: Rollbar Integration

Log sync failures and unexpected errors to Rollbar when `ROLLBAR_ENABLED=1`.

## Phase 4 — Scheduling (P2)

### Task 4.1: Documentation

Document cron setup for automatic scheduled sync in `docs/ops/sync-schedule.md`.

## Architecture Decisions

- **No in-process scheduler**: External cron calls the API to keep Aither stateless.
- **File-based manifest**: JSON manifest in `output/` avoids database dependency.
- **Reuse HemeraClient**: All API calls go through the existing throttled/retried client.
