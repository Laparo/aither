# Tasks: Hemera Academy API Integration

**Input**: Design documents from `/specs/001-hemera-api-integration/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Included — Constitution I (Test-First) is NON-NEGOTIABLE. TDD cycle: write test → confirm fail → implement → confirm pass → refactor.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US1b, US1c, US2, US3, US4)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependency installation, configuration scaffolding

- [X] T001 Create project directory structure per plan.md: `src/app/api/sync/`, `src/app/api/recordings/`, `src/app/(dashboard)/sync/`, `src/lib/hemera/`, `src/lib/sync/`, `src/lib/html/`, `src/lib/notifications/`, `output/`, `tests/contract/`, `tests/unit/`, `tests/e2e/`
- [X] T002 Install runtime dependencies: `handlebars`, `zod`, `p-retry`, `p-throttle`, `nodemailer`, `@clerk/nextjs`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `rollbar`, `uuid`
- [X] T003 [P] Install dev dependencies: `vitest`, `@types/nodemailer`, `@types/uuid`, `playwright`
- [X] T004 [P] Create `.env.example` with all environment variables per quickstart.md in project root
- [X] T005 [P] Add `output/` to `.gitignore` in project root
- [X] T006 [P] Configure Biome for formatting/linting in `biome.json` (if not already configured)
- [X] T007 Configure Vitest in `vitest.config.ts` with path aliases matching `tsconfig.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Define TypeScript types for all Hemera entities in `src/lib/hemera/types.ts` (HtmlTemplate, Seminar, UserProfile, Lesson, TextContent, MediaAsset, SeminarRecording per data-model.md)
- [X] T009 Implement Zod validation schemas for all Hemera entities in `src/lib/hemera/schemas.ts` (one schema per entity, matching data-model.md validation rules)
- [X] T010 [P] Write unit test for Zod schemas: valid and invalid entity payloads in `tests/unit/hemera-schemas.spec.ts`
- [X] T011 Define TypeScript types for SyncJob and SyncManifest in `src/lib/sync/types.ts` (per data-model.md)
- [X] T012 Define Zod schemas for Aither Sync API request/response bodies in `src/lib/sync/schemas.ts` (SyncJobResponse, RecordingTransmitRequest, ErrorResponse per contracts/aither-sync-api.yaml)
- [X] T013 Implement Hemera API HTTP client with auth, throttling (p-throttle 2 req/s), and retry (p-retry, 5 retries, jitter) in `src/lib/hemera/client.ts` — generic `get<T>(path, schema)` and `put<T>(path, body, schema)` methods with Zod validation on response
- [X] T014 Write unit test for Hemera API client (mock fetch): auth header, throttling, retry on 5xx, 429 Retry-After handling, Zod rejection on invalid response in `tests/unit/hemera-client.spec.ts`
- [X] T015 [P] Configure Rollbar server-side integration in `src/lib/monitoring/rollbar.ts` (singleton instance, PII filtering for UserProfile.email)
- [X] T016 [P] Configure Clerk middleware for route protection in `src/middleware.ts` — protect `/api/sync`, `/api/recordings`, `/(dashboard)/**` routes
- [X] T017 Implement environment configuration loader with Zod validation in `src/lib/config.ts` — validate all env vars from `.env.example` at startup

**Checkpoint**: Foundation ready — Hemera client tested, schemas validated, auth configured. User story implementation can now begin.

---

## Phase 3: User Story 1 — Retrieve and Populate Academy Data (Priority: P1) 🎯 MVP

**Goal**: Fetch HTML templates and participant data from hemera.academy API, populate templates with data, output one HTML file per entity.

**Independent Test**: Trigger a data retrieval cycle and verify that HTML files are generated correctly by populating hemera.academy templates with participant data.

### Tests for User Story 1

> **Write these tests FIRST, ensure they FAIL before implementation (Constitution I)**

- [X] T018 [P] [US1] Contract test: Hemera API returns valid seminars, lessons, users, texts, media, templates — validate against Zod schemas in `tests/contract/hemera-api.contract.spec.ts`
- [X] T019 [P] [US1] Unit test for template populator: given a Handlebars template + data object, returns correctly populated HTML; tests for missing placeholders, XSS escaping in `tests/unit/template-populator.spec.ts`
- [X] T020 [P] [US1] Unit test for hash manifest: compute hash, compare with existing manifest, detect changed/new/deleted entities in `tests/unit/hash-manifest.spec.ts`
- [X] T021 [P] [US1] Unit test for HTML writer: atomic write (tmp + rename), directory creation, orphan cleanup in `tests/unit/html-writer.spec.ts`
- [X] T022 [P] [US1] Unit test for sync orchestrator: full sync flow (fetch → hash compare → populate → write → update manifest), handles empty responses, handles malformed records in `tests/unit/sync-orchestrator.spec.ts`

### Implementation for User Story 1

- [X] T023 [US1] Implement template population engine using Handlebars.js in `src/lib/html/populator.ts` — `populateTemplate(templateHtml, data): string` with placeholder validation and XSS escaping
- [X] T024 [US1] Implement content hash computation and manifest management in `src/lib/sync/hash-manifest.ts` — SHA-256 of `JSON.stringify({ template, data }, sortedKeys)`, read/write `output/.sync-manifest.json` atomically
- [X] T025 [US1] Implement atomic HTML file writer in `src/lib/html/writer.ts` — write to `output/{entityType}/{sourceId}.html` via tmp+rename, `mkdir -p`, orphan cleanup
- [X] T026 [US1] Implement sync orchestrator in `src/lib/sync/orchestrator.ts` — fetch all entities via HemeraClient (templates, seminars, lessons, users, texts, media), match templates to entities, populate templates, compute hashes, write only changed files, update manifest, track SyncJob state
- [X] T027 [US1] Implement sync API route handler in `src/app/api/sync/route.ts` — POST: validate auth (admin role), create SyncJob, start orchestrator async, return 202 with jobId; GET: return current/last SyncJob status; 409 if sync already running (in-memory mutex)
- [X] T028 [US1] Contract test for Aither Sync API endpoints (POST /api/sync → 202, GET /api/sync → 200, concurrent POST → 409) in `tests/contract/sync-api.contract.spec.ts`

**Checkpoint**: User Story 1 complete. Triggering `POST /api/sync` fetches data from hemera.academy, populates templates, generates HTML files in `output/`. Incremental sync skips unchanged entities.

---

## Phase 4: User Story 1c — Serve Media Content (Priority: P1)

**Goal**: Display images and stream videos from hemera.academy-hosted URLs within generated HTML files, with graceful fallback for unavailable media.

**Independent Test**: Open a generated HTML file for a lesson containing image and video references; verify images display and videos play. Simulate an unavailable URL and verify fallback message.

### Tests for User Story 1c

- [X] T029 [P] [US1c] Unit test for media URL embedding in populated HTML: verify `<img>` tags use hemera.academy URLs, `<video>` tags use correct source URLs, fallback markup for broken URLs in `tests/unit/media-embedding.spec.ts`

### Implementation for User Story 1c

- [X] T030 [US1c] Extend template populator in `src/lib/html/populator.ts` — register Handlebars helpers for media embedding: `{{image sourceUrl altText}}` renders `<img>` with fallback `onerror` handler, `{{video sourceUrl}}` renders `<video>` with fallback message
- [X] T031 [US1c] Extend sync orchestrator in `src/lib/sync/orchestrator.ts` — resolve MediaAsset references per entity and include media data in template population context

**Checkpoint**: User Story 1c complete. Generated HTML files display images and stream videos from hemera.academy with graceful fallback on broken links.

---

## Phase 5: User Story 1b — Transmit Recording URLs (Priority: P1)

**Goal**: Expose an API endpoint that accepts MUX recording URLs and forwards them directly to the hemera.academy API.

**Independent Test**: POST a MUX recording URL to `/api/recordings` and verify it is transmitted to the correct seminar on hemera.academy via its API.

### Tests for User Story 1b

- [X] T032 [P] [US1b] Unit test for recording transmitter: given seminar ID + MUX URL, calls HemeraClient PUT, handles 200/404/422/429/5xx responses in `tests/unit/recording-transmitter.spec.ts`
- [X] T033 [P] [US1b] Contract test for recordings API endpoint: POST /api/recordings validates body, returns 200 on success, 400 on invalid body, 502 on Hemera API failure in `tests/contract/recordings-api.contract.spec.ts`

### Implementation for User Story 1b

- [X] T034 [US1b] Implement recording transmitter in `src/lib/sync/recording-transmitter.ts` — validate SeminarRecording with Zod, call `HemeraClient.put('/seminars/{id}/recording', body)`, handle error responses, return structured result
- [X] T035 [US1b] Implement recordings API route handler in `src/app/api/recordings/route.ts` — POST: validate auth, validate request body with Zod, call recording transmitter, return 200/400/502

**Checkpoint**: User Story 1b complete. Camera/recording feature can POST MUX URLs to `/api/recordings` which are immediately forwarded to hemera.academy.

---

## Phase 6: User Story 2 — Scheduled Automatic Sync (Priority: P2)

**Goal**: System cron job triggers daily sync. Incremental sync only regenerates changed files. Concurrent sync requests handled gracefully.

**Independent Test**: Configure a cron schedule, wait for trigger, verify new data is fetched and only changed HTML files are regenerated.

### Tests for User Story 2

- [X] T036 [P] [US2] Unit test for sync mutex: concurrent trigger returns 409, sequential triggers succeed; verify in-memory lock release on completion and failure in `tests/unit/sync-mutex.spec.ts`

### Implementation for User Story 2

- [X] T037 [US2] Create cron job configuration documentation and example crontab entry in `src/lib/sync/cron-setup.md` — `0 2 * * * curl -s -X POST http://localhost:3000/api/sync -H "Authorization: Bearer $AITHER_SYNC_TOKEN"`
- [X] T038 [US2] Verify and harden the sync mutex in `src/app/api/sync/route.ts` — ensure lock is released on orchestrator success AND failure (finally block), add timeout safety (auto-release after configurable max duration)

**Checkpoint**: User Story 2 complete. Cron triggers daily sync, incremental hash-based detection skips unchanged entities, concurrent syncs are rejected with 409.

---

## Phase 7: User Story 3 — Error Handling & Sync Status (Priority: P3)

**Goal**: Operator visibility into sync status. Email notifications on repeated failures. Comprehensive error logging via Rollbar.

**Independent Test**: Simulate a failed API call, verify error is logged, status reflects failure, and after N consecutive failures an email notification is sent.

### Tests for User Story 3

- [ ] T039 [P] [US3] Unit test for email notifications: send email after threshold consecutive failures, reset counter on success, validate email content in `tests/unit/email-notifications.spec.ts`
- [ ] T040 [P] [US3] Unit test for sync error logging: verify Rollbar is called with structured context (jobId, entity, timestamp) on sync failures in `tests/unit/sync-error-logging.spec.ts`

### Implementation for User Story 3

- [ ] T041 [US3] Implement SMTP email notification service in `src/lib/notifications/email.ts` — Nodemailer pool transport, threshold-based sending (NOTIFY_FAILURE_THRESHOLD env var, default 3), consecutive failure counter (in-memory, reset on success), plain-text email body with timestamp + error summary
- [ ] T042 [US3] Integrate Rollbar error logging into sync orchestrator in `src/lib/sync/orchestrator.ts` — log errors with structured context (jobId, entityType, sourceId, errorMessage), use Rollbar severity levels (error for sync failures, warning for retries, critical for threshold breach)
- [ ] T043 [US3] Integrate email notifications into sync orchestrator in `src/lib/sync/orchestrator.ts` — call notification service on sync failure, pass error details, track consecutive failure count
- [ ] T044 [US3] Enrich GET /api/sync response in `src/app/api/sync/route.ts` — include detailed error list, records-per-type breakdown, last N job history (in-memory ring buffer, e.g., last 10 jobs)

**Checkpoint**: User Story 3 complete. Operators see detailed sync status. Email alerts fire after 3 consecutive failures. All errors tracked in Rollbar.

---

## Phase 8: User Story 4 — Access Control (Priority: P4)

**Goal**: Only Clerk-authenticated administrators can access sync management functions. Unauthenticated/unauthorized requests are denied.

**Independent Test**: Access sync endpoints and dashboard as unauthenticated user (→ denied), as non-admin user (→ denied), as admin user (→ granted).

### Tests for User Story 4

- [ ] T045 [P] [US4] Unit test for auth middleware: verify 401 for unauthenticated requests, 403 for non-admin users, pass-through for admin users in `tests/unit/auth-middleware.spec.ts`
- [ ] T046 [P] [US4] Contract test for protected endpoints: POST/GET /api/sync and POST /api/recordings return 401/403 without valid Clerk token/admin role in `tests/contract/auth-protection.contract.spec.ts`

### Implementation for User Story 4

- [ ] T047 [US4] Implement role-based auth helper in `src/lib/auth/role-check.ts` — `requireAdmin(auth)` function that checks `sessionClaims.metadata.role === "admin"`, returns 401/403 error responses
- [ ] T048 [US4] Apply auth checks to sync route handler in `src/app/api/sync/route.ts` — call `requireAdmin()` at the top of POST and GET handlers
- [ ] T049 [US4] Apply auth checks to recordings route handler in `src/app/api/recordings/route.ts` — call `requireAdmin()` at the top of POST handler
- [ ] T050 [US4] Implement sync status dashboard page in `src/app/(dashboard)/sync/page.tsx` — MUI components showing last sync time, status, record counts, error list; manual sync trigger button; auto-refresh via polling GET /api/sync; Clerk-protected via middleware

**Checkpoint**: User Story 4 complete. All sync management functions require Clerk admin login. Dashboard provides visual sync status with manual trigger.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T051 [P] Add comprehensive JSDoc documentation to all public functions in `src/lib/hemera/client.ts`, `src/lib/sync/orchestrator.ts`, `src/lib/html/populator.ts`
- [ ] T052 [P] Create E2E test: full sync flow from API trigger to HTML file generation in `tests/e2e/sync-flow.spec.ts` (Playwright)
- [ ] T053 [P] Add Biome formatting/linting validation test in CI configuration
- [ ] T054 Security hardening: audit PII filtering (UserProfile.email excluded from Rollbar/logs), verify API key not exposed in client-side code or error responses
- [ ] T055 Run quickstart.md validation: verify all setup steps work on a fresh clone
- [ ] T056 Performance validation: run sync with mock data (~500 records) and verify completion within target time (<5 minutes)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion — **BLOCKS all user stories**
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) — core sync, **BLOCKS US1c and US1b**
- **User Story 1c (Phase 4)**: Depends on US1 (Phase 3) — extends template populator
- **User Story 1b (Phase 5)**: Depends on Foundational (Phase 2) — can run in parallel with US1/US1c (different files)
- **User Story 2 (Phase 6)**: Depends on US1 (Phase 3) — hardens the sync mechanism
- **User Story 3 (Phase 7)**: Depends on US1 (Phase 3) — adds observability to existing sync
- **User Story 4 (Phase 8)**: Depends on Foundational (Phase 2) — can start early but needs US3 for full dashboard
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational → Core sync pipeline (MVP)
- **US1c (P1)**: After US1 → Extends populator with media helpers
- **US1b (P1)**: After Foundational → Independent (different API endpoint + files)
- **US2 (P2)**: After US1 → Adds cron + mutex hardening
- **US3 (P3)**: After US1 → Adds email notifications + Rollbar enrichment
- **US4 (P4)**: After Foundational + US3 → Adds auth + dashboard

### Within Each User Story

1. Tests MUST be written and FAIL before implementation (Constitution I)
2. Models/schemas before services
3. Services before route handlers
4. Core implementation before integration
5. Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T003, T004, T005, T006 can all run in parallel
- **Phase 2**: T010, T015, T016 can run in parallel (after T008/T009)
- **Phase 3**: All tests T018–T022 can run in parallel; then implementation sequential
- **Phase 5 (US1b)** can run in parallel with **Phase 4 (US1c)** — different files entirely
- **Phase 7**: T039, T040 tests can run in parallel
- **Phase 8**: T045, T046 tests can run in parallel
- **Phase 9**: T051, T052, T053 can all run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for US1 together (TDD — all must FAIL first):
T018: Contract test for Hemera API in tests/contract/hemera-api.contract.spec.ts
T019: Unit test for template populator in tests/unit/template-populator.spec.ts
T020: Unit test for hash manifest in tests/unit/hash-manifest.spec.ts
T021: Unit test for HTML writer in tests/unit/html-writer.spec.ts
T022: Unit test for sync orchestrator in tests/unit/sync-orchestrator.spec.ts

# Then implement sequentially:
T023: Template populator (src/lib/html/populator.ts)       → T019 turns green
T024: Hash manifest (src/lib/sync/hash-manifest.ts)        → T020 turns green
T025: HTML writer (src/lib/html/writer.ts)                 → T021 turns green
T026: Sync orchestrator (src/lib/sync/orchestrator.ts)     → T022 turns green
T027: Sync API route (src/app/api/sync/route.ts)           → T018 turns green
T028: Sync API contract test                               → validates full chain
```

---

## Parallel Example: US1b alongside US1c

```bash
# These two stories touch different files — can be developed in parallel:

# Developer/Agent A: US1c (media embedding)
T029: Media embedding test (tests/unit/media-embedding.spec.ts)
T030: Extend populator (src/lib/html/populator.ts)
T031: Extend orchestrator (src/lib/sync/orchestrator.ts)

# Developer/Agent B: US1b (recording transmission)
T032: Recording transmitter test (tests/unit/recording-transmitter.spec.ts)
T033: Recordings API contract test (tests/contract/recordings-api.contract.spec.ts)
T034: Recording transmitter (src/lib/sync/recording-transmitter.ts)
T035: Recordings API route (src/app/api/recordings/route.ts)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 — core sync pipeline
4. **STOP and VALIDATE**: Trigger sync, verify HTML files generated correctly
5. Deploy to Linux service if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → **MVP deployed!**
3. Add US1c + US1b (parallel) → Media works, recording transmission works
4. Add US2 → Cron-based daily sync operational
5. Add US3 → Operator email alerts + Rollbar observability
6. Add US4 → Admin dashboard + access control
7. Polish → E2E tests, security hardening, documentation

### Single-Developer Sequential Strategy

1. Setup (T001–T007) → ~1 session
2. Foundational (T008–T017) → ~2 sessions
3. US1 (T018–T028) → ~3 sessions (TDD: tests first, then impl)
4. US1c (T029–T031) → ~1 session
5. US1b (T032–T035) → ~1 session
6. US2 (T036–T038) → ~1 session
7. US3 (T039–T044) → ~2 sessions
8. US4 (T045–T050) → ~2 sessions
9. Polish (T051–T056) → ~1 session

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable after Foundational phase
- Constitution I enforced: ALL tests written and failing BEFORE implementation
- Constitution VII enforced: NO database, NO local persistence (except HTML files + hash manifest)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
