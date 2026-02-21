# Tasks: Data Synchronization

**Feature**: 005-data-sync  
**Status**: Draft

## Phase 1 — Sync API Endpoint

- [ ] 1.1 Create `POST /api/sync` route with auth guard and concurrency lock
- [ ] 1.2 Create `src/lib/sync/pipeline.ts` — orchestrates data fetching from Hemera
- [ ] 1.3 Create `src/lib/sync/manifest.ts` — SHA-256 content hash manifest (read/write/diff)
- [ ] 1.4 Add Zod schemas for sync request/response in `src/lib/sync/schemas.ts`
- [ ] 1.5 Unit tests for manifest (hash, diff, file I/O)
- [ ] 1.6 Contract test: `POST /api/sync` → 200 with stats

## Phase 2 — HTML Generation

- [ ] 2.1 Create `src/lib/html/generator.ts` — template population and file output
- [ ] 2.2 Implement incremental write (skip unchanged hashes)
- [ ] 2.3 Add local fallback templates in `src/lib/html/templates/`
- [ ] 2.4 Unit tests for HTML generator
- [ ] 2.5 Integration test: full sync → verify `output/` files

## Phase 3 — Status & Monitoring

- [ ] 3.1 Create `GET /api/sync/status` route
- [ ] 3.2 Rollbar error logging for sync failures
- [ ] 3.3 Contract test: `GET /api/sync/status` → 200 with last sync info

## Phase 4 — Scheduling & Docs

- [ ] 4.1 Document cron setup in `docs/ops/sync-schedule.md`
- [ ] 4.2 Add `409 Conflict` handling for concurrent sync attempts
- [ ] 4.3 Contract test: concurrent sync → 409

## Phase 5 — Homepage Display

- [ ] 5.1 Refine `src/app/page.tsx` to use sync'd data or live fetch fallback
- [ ] 5.2 Add error/fallback UI for unreachable Hemera API
- [ ] 5.3 E2E test: homepage displays courses
