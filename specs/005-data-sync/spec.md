# Feature Specification: Data Synchronization

**Feature Branch**: `005-data-sync`  
**Created**: 2026-02-21  
**Status**: Draft  
**Input**: Aither fetches course data from the Hemera Academy Service API and displays it on its homepage. This spec defines the full data sync pipeline: scheduled fetching, incremental updates, content-hash-based change detection, and HTML generation from templates.

## Out of Scope

- Local database storage (Constitution VII — Aither is stateless; no Prisma, no SQLite).
- Video/audio recording or MUX upload (covered by 004-recording-module).
- Clerk user synchronization between Aither and Hemera.
- Admin dashboard UI for sync management (future spec).
- Real-time push notifications from Hemera (pull-only architecture).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — On-Demand Sync Trigger (Priority: P1)

As a system operator, I want to trigger a data sync via API, so that Aither fetches the latest courses, participants, and templates from Hemera and regenerates HTML output files.

**Why this priority**: The core sync pipeline must work before scheduling or change detection can be layered on top.

**Independent Test**: Call `POST /api/sync` and verify that `output/` contains freshly generated HTML files matching the current Hemera data.

**Acceptance Scenarios**:

1. **Given** the Hemera API is reachable, **When** `POST /api/sync` is called, **Then** Aither fetches courses, participations, and HTML templates from Hemera's Service API and writes populated HTML files to `output/`.
2. **Given** the Hemera API returns valid data, **When** sync completes, **Then** a JSON response includes sync status, duration, and count of generated files.
3. **Given** the Hemera API is unreachable, **When** sync is triggered, **Then** the error is logged and the API returns a structured error response (no crash).

---

### User Story 2 — Incremental Sync with Content Hashing (Priority: P1)

As a system operator, I want Aither to detect which data has changed since the last sync, so that only affected HTML files are regenerated (saving time and I/O).

**Why this priority**: Without change detection, every sync regenerates all files — wasteful for hundreds of entities.

**Independent Test**: Run sync twice with no data changes; verify zero files are rewritten on the second run.

**Acceptance Scenarios**:

1. **Given** a previous sync completed successfully, **When** a new sync runs and data is unchanged, **Then** no HTML files are overwritten and the sync reports 0 changes.
2. **Given** a course title changed in Hemera, **When** the next sync runs, **Then** only the affected course HTML is regenerated.
3. **Given** the content-hash manifest is missing or corrupted, **When** sync runs, **Then** a full regeneration is performed and a new manifest is written.

---

### User Story 3 — Scheduled Automatic Sync (Priority: P2)

As a system operator, I want sync to run on a configurable schedule (e.g., daily via system cron), so that Aither data stays current without manual intervention.

**Why this priority**: Automation is valuable but depends on the sync pipeline (P1) working correctly first.

**Independent Test**: Configure a cron job, wait for the scheduled time, and verify new data appears in `output/`.

**Acceptance Scenarios**:

1. **Given** a cron schedule is configured, **When** the scheduled time arrives, **Then** `POST /api/sync` is called automatically and HTML files are updated.
2. **Given** a scheduled sync fails, **When** the failure threshold is exceeded, **Then** an email notification is sent to the operator.
3. **Given** a sync is already running, **When** another sync is triggered, **Then** the second request is rejected with HTTP 409 Conflict.

---

### User Story 4 — Display Synced Data on Homepage (Priority: P1)

As a visitor, I want to see the current Hemera Academy courses on the Aither homepage, so that I can verify the integration is working.

**Why this priority**: Provides immediate visual feedback that the data pipeline works end-to-end.

**Independent Test**: Load `http://localhost:3500` and verify courses from Hemera are displayed with title, level, date, and participant count.

**Acceptance Scenarios**:

1. **Given** Hemera has 3 courses, **When** the Aither homepage loads, **Then** all 3 courses are displayed in a table with title, level, start date, and participant count.
2. **Given** the Hemera API is unreachable, **When** the homepage loads, **Then** a fallback message is shown instead of an error page.
3. **Given** course data changes in Hemera, **When** the page is reloaded after sync, **Then** the updated data is shown.

---

## Requirements *(mandatory)*

### Functional Requirements

1. **Sync API** — `POST /api/sync` triggers a full or incremental sync cycle.
2. **Data Fetching** — Fetch courses, participations, and HTML templates from Hemera's `/api/service/*` endpoints using the existing `HemeraClient`.
3. **Content Hashing** — Compute SHA-256 hashes of fetched data; store as JSON manifest in `output/.sync-manifest.json`.
4. **HTML Generation** — Populate HTML templates with entity data and write to `output/`.
5. **Sync Status** — `GET /api/sync/status` returns last sync time, result, and statistics.
6. **Concurrent Sync Guard** — Only one sync may run at a time; reject duplicates with 409.
7. **Homepage Display** — Server-render Hemera course data on the Aither homepage via `HemeraClient`.

### Non-Functional Requirements

1. Sync completes within 60 seconds for up to 500 entities.
2. No local database (stateless architecture per Constitution VII).
3. All API responses include structured error objects with request IDs.
4. Sync failures are logged via Rollbar (when enabled).

## Clarifications

- **No database**: Aither stores only generated HTML files and a sync manifest (JSON). All source data is fetched from Hemera on every sync.
- **Cron is external**: Scheduling is handled by system cron (`crontab`) calling the sync API, not by an in-process scheduler.
- **Templates**: HTML templates are fetched from Hemera's `/api/service/templates` endpoint (when available) or use a local fallback.

## Assumptions

- The Hemera Service API at `/api/service/courses` returns all courses with participant counts (confirmed working).
- The `HemeraClient` with API key authentication is functional (confirmed in 003-service-user).
- The `output/` directory is writable and gitignored.
- FFmpeg or media processing is NOT part of this spec (see 004-recording-module).

## Success Criteria *(mandatory)*

1. `POST /api/sync` fetches data from Hemera and generates HTML files in `output/`.
2. Incremental sync skips unchanged entities (verified by content hash comparison).
3. Homepage at `/` displays live course data from Hemera.
4. Concurrent sync requests are rejected with 409.
5. All sync operations are covered by unit and contract tests.
