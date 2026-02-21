# Research: Data Synchronization

**Feature**: 005-data-sync  
**Status**: Draft

## Existing Infrastructure

### HemeraClient (from 001-hemera-api-integration)

- Throttled (`p-throttle`, 2 req/s) and retried (`p-retry`, 5 attempts)
- API key auth via `X-API-Key` header
- Zod response validation
- Path restricted to `/api/service/` prefix

### Confirmed Hemera Endpoints

| Endpoint | Method | Response |
|----------|--------|----------|
| `/api/service/courses` | GET | `{ success, data: Course[], meta }` |
| `/api/health` | GET | `{ status: "ok", ... }` |

### Output Directory

- `output/` is gitignored and used for generated HTML files
- Subdirectories: `output/seminars/`, `output/perf-test/`

## Change Detection Approaches

### Option A: Content Hash (SHA-256) — Selected ✅

Compute hash of serialized entity data. Compare with stored manifest. Regenerate only changed entities.

**Pros**: Simple, no Hemera API changes needed, deterministic  
**Cons**: Must serialize consistently (sorted keys)

### Option B: Hemera `updatedAt` Timestamps

Use `updatedAt` from Hemera response to detect changes.

**Pros**: Efficient (no hash computation)  
**Cons**: Requires Hemera to expose `updatedAt` on all entities (not yet confirmed)

### Option C: ETag / If-None-Match

Use HTTP caching headers for conditional requests.

**Pros**: Standard HTTP pattern  
**Cons**: Hemera doesn't currently support ETags on service endpoints

## Decision

Content hashing (Option A) because it works with the current Hemera API without modifications.

## Open Questions

1. Will Hemera expose a `/api/service/participations` endpoint? (Needed for participant-level HTML)
2. Will Hemera expose a `/api/service/templates` endpoint for HTML templates?
3. Should the manifest track template versions separately from data?
