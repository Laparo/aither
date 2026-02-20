# Tasks: Video & Audio Recording Module

**Input**: Design documents from `/specs/004-recording-module/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Included — the spec mandates test-first per Constitution Principle I.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, shared types and schemas, environment configuration

- [x] T001 Add `WEBCAM_STREAM_URL` (optional), `RECORDINGS_OUTPUT_DIR` (optional, default `output/recordings`), `MUX_TOKEN_ID` (optional), and `MUX_TOKEN_SECRET` (optional) to Zod `EnvSchema` in `src/lib/config.ts`
- [x] T002 Add `/api/recording(.*)` and `/recording(.*)` to the protected routes array in `src/proxy.ts`
- [x] T003 Add `manage:recordings` and `control:playback` permissions to `Permission` union and `rolePermissions` map in `src/lib/auth/permissions.ts`
- [x] T004 Create Zod schemas (RecordingStatus, PlayerState, RecordingSessionSchema, RecordingFileSchema, PlaybackStateSchema, StartRecordingResponseSchema, StopRecordingResponseSchema, RecordingListResponseSchema, PlaybackCommandSchema, SeekCommandSchema, PlaybackResponseSchema, PlayerStateReportSchema, MuxUploadRequestSchema, MuxUploadResponseSchema) in `src/lib/recording/schemas.ts`
- [x] T005 Create TypeScript types inferred from Zod schemas in `src/lib/recording/types.ts`

**Checkpoint**: Shared infrastructure ready — all schemas, types, env config, auth permissions, and proxy routes in place.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core library modules that all user story routes depend on

**⚠️ CRITICAL**: No API route work can begin until these core modules are complete.

- [x] T006 Implement FFmpeg child process manager (spawn, SIGINT graceful stop, SIGKILL fallback, stderr parsing, `close` event handling, process cleanup on server exit) in `src/lib/recording/ffmpeg-capture.ts`
- [x] T007 Implement recording session manager (start/stop lifecycle, single-session mutex, auto-stop timer at 15 min, warning at 14 min, `_getState()`/`_resetState()` for tests) in `src/lib/recording/session-manager.ts`
- [x] T008 [P] Implement file manager (list recordings from disk, delete file, get metadata via fs.stat, get duration via ffprobe, filename parsing) in `src/lib/recording/file-manager.ts`
- [x] T009 [P] Implement playback controller (playback state machine, SSE client registry Map, command dispatch to connected controllers, seek calculation, `_resetState()` for tests) in `src/lib/recording/playback-controller.ts`
- [x] T010 [P] Implement HTTP Range request stream handler (full file response, 206 partial content, Content-Range header, video/mp4 Content-Type) in `src/lib/recording/stream-handler.ts`

**Checkpoint**: Foundation ready — all library modules implemented. User story API route implementation can begin.

---

## Phase 3: User Story 1 — Start and Stop a Recording Session (Priority: P1) 🎯 MVP

**Goal**: Enable starting and stopping webcam capture via API calls. A POST starts FFmpeg, a POST stops it, and a valid MP4 file is produced.

**Independent Test**: POST start → wait → POST stop → verify MP4 file exists in `output/recordings/` with valid tracks.

### Tests for User Story 1

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T011 [P] [US1] Unit test for FFmpeg capture (spawn args, SIGINT stop, stderr parsing, timeout auto-kill, webcam disconnect handling) in `tests/unit/ffmpeg-capture.spec.ts`
- [x] T012 [P] [US1] Unit test for session manager (start/stop lifecycle, mutex guard, auto-stop at 15 min, state transitions, `_resetState`) in `tests/unit/session-manager.spec.ts`
- [x] T013 [P] [US1] Contract test for start/stop recording (POST /api/recording/start returns 200 with session, POST /api/recording/stop returns 200 with file details, 409 on double-start, 404 on stop-without-start, 503 on unreachable webcam) in `tests/contract/recording-api.contract.spec.ts`

### Implementation for User Story 1

- [x] T014 [P] [US1] Implement POST start recording route (auth requireAdmin, check mutex, spawn FFmpeg via session-manager, return 200/409/503) in `src/app/api/recording/start/route.ts`
- [x] T015 [P] [US1] Implement POST stop recording route (auth requireAdmin, graceful SIGINT via session-manager, return file details 200/404) in `src/app/api/recording/stop/route.ts`
- [x] T016 [US1] Ensure `output/recordings/` directory is created on start if it does not exist (in session-manager or start route)

**Checkpoint**: User Story 1 complete. Can start a recording, stop it, and get a valid MP4 file via API.

---

## Phase 4: User Story 2 — Query Recording Status and List Recordings (Priority: P1)

**Goal**: Enable querying current recording status, listing all recordings with metadata, and deleting recordings.

**Independent Test**: Create a recording → GET status (recording: true) → stop → GET status (recording: false) → GET list → verify metadata → DELETE → verify removed.

### Tests for User Story 2

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T017 [P] [US2] Unit test for file manager (list files matching `rec_*.mp4`, parse filename to ID/timestamp, get file size, get duration via ffprobe mock, delete file, empty dir, invalid files ignored) in `tests/unit/file-manager.spec.ts`
- [x] T018 [P] [US2] Contract test for status/list/delete (GET /api/recording/status returns recording state, GET /api/recording/list returns sorted array, DELETE /api/recording/[id] returns 200/404, list returns empty array) — extend `tests/contract/recording-api.contract.spec.ts`

### Implementation for User Story 2

- [x] T019 [P] [US2] Implement GET recording status route (auth requireAdmin, return current session state or `{ recording: false }`) in `src/app/api/recording/status/route.ts`
- [x] T020 [P] [US2] Implement GET list recordings route (auth requireAdmin, scan dir via file-manager, return sorted array) in `src/app/api/recording/list/route.ts`
- [x] T021 [US2] Implement DELETE recording route (auth requireAdmin, stop playback if active, delete file via file-manager, return 200/404) in `src/app/api/recording/[id]/route.ts`

**Checkpoint**: User Story 2 complete. Can query status, list all recordings with metadata, and delete recordings.

---

## Phase 5: User Story 3 — Playback Control via API (Priority: P1)

**Goal**: Enable play/stop/rewind/fast-forward of recordings via API, dispatching commands to the player page over SSE.

**Independent Test**: Open player page → POST play → verify SSE `command` event received → POST rewind → verify seek event → POST stop → verify pause event.

### Tests for User Story 3

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T022 [P] [US3] Unit test for playback controller (state machine transitions, SSE command dispatch, seek clamping, client registry add/remove, `_resetState`) in `tests/unit/playback-controller.spec.ts`
- [x] T023 [P] [US3] Contract test for playback endpoints (POST play/stop/rewind/forward return 200 with state, 404 when no player connected, 404 when recording not found, POST state accepts player reports) in `tests/contract/playback-api.contract.spec.ts`

### Implementation for User Story 3

- [x] T024 [P] [US3] Implement POST playback play route (auth admin/api-client, dispatch `play` via playback-controller, return state) in `src/app/api/recording/playback/play/route.ts`
- [x] T025 [P] [US3] Implement POST playback stop route (auth admin/api-client, dispatch `stop` via playback-controller, return state) in `src/app/api/recording/playback/stop/route.ts`
- [x] T026 [P] [US3] Implement POST playback rewind route (auth admin/api-client, dispatch `seek` with negative offset, return state) in `src/app/api/recording/playback/rewind/route.ts`
- [x] T027 [P] [US3] Implement POST playback forward route (auth admin/api-client, dispatch `seek` with positive offset, return state) in `src/app/api/recording/playback/forward/route.ts`
- [x] T028 [US3] Implement POST player state report route (accept player state updates, update playback-controller state) in `src/app/api/recording/playback/state/route.ts`
- [x] T029 [US3] Implement GET SSE events route (register SSE client in playback-controller registry, return `ReadableStream` with `text/event-stream` content type, handle disconnect cleanup) in `src/app/api/recording/events/route.ts`

**Checkpoint**: User Story 3 complete. API commands dispatch SSE events to connected players; player state reports are accepted.

---

## Phase 6: User Story 4 — Full-Screen HD Web Player (Priority: P1)

**Goal**: Provide a minimal Next.js page that renders a `<video>` element full-screen, no UI controls, driven entirely by SSE commands from the server.

**Independent Test**: Open `/recording/player/[id]` → verify video fills viewport at 1920×1080 with no controls → send play command → verify video plays.

### Implementation for User Story 4

- [x] T030 [US4] Implement full-screen HD player page (client component, `<video>` element fills viewport, no controls attribute, black background, no margins/padding/scrollbars, SSE `EventSource` connecting to `/api/recording/events?recordingId={id}`, handle play/stop/seek commands, POST state reports back on state changes, centered error message for invalid ID) in `src/app/recording/player/[id]/page.tsx`

**Checkpoint**: User Story 4 complete. Player page renders full-screen video driven by SSE commands.

---

## Phase 7: User Story 5 — Serve Recording Files for Streaming (Priority: P2)

**Goal**: Serve MP4 files over HTTP with Range request support so the player can load and seek recordings.

**Independent Test**: GET `/api/recording/stream/[id]` → verify Content-Type `video/mp4` and Content-Length → GET with Range header → verify 206 Partial Content.

### Tests for User Story 5

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T031a [P] [US5] Unit test for stream handler (full file response with Content-Type/Content-Length, 206 partial content for valid Range header, Content-Range header format, invalid Range returns 416, missing file returns null/error) in `tests/unit/stream-handler.spec.ts`
- [x] T031 [P] [US5] Contract test for streaming endpoint (GET /api/recording/stream/[id] returns 200 with video/mp4, supports Range → 206, returns 404 for missing ID, includes Accept-Ranges: bytes header) — extend `tests/contract/recording-api.contract.spec.ts`

### Implementation for User Story 5

- [x] T032 [US5] Implement GET recording stream route (auth admin/api-client, resolve file via file-manager, delegate to stream-handler for full/partial response, set Content-Type/Content-Length/Accept-Ranges/Content-Range headers) in `src/app/api/recording/stream/[id]/route.ts`

**Checkpoint**: User Story 5 complete. Player page can load video files via HTTP with seeking support.

---

## Phase 8: User Story 6 — Upload Recording to MUX (Priority: P2)

**Goal**: Upload a local recording to MUX via API command, then forward the MUX playback URL to hemera.academy via the existing transmitRecording flow (Spec 001).

**Independent Test**: Create a recording → POST `/api/recording/upload/[id]` with `{ seminarSourceId }` → verify (with MUX mocked) MUX asset created, playback URL obtained, URL forwarded to hemera.academy.

### Tests for User Story 6

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T033 [P] [US6] Unit test for MUX uploader (create direct upload, stream file, wait for asset ready, retrieve playback URL, handle MUX API errors, handle missing credentials) in `tests/unit/mux-uploader.spec.ts`
- [x] T034 [P] [US6] Contract test for upload endpoint (POST /api/recording/upload/[id] returns 200 on full success, 207 on partial success, 404 for missing recording, 409 for active recording, 503 for unconfigured MUX, 502 for MUX API failure) in `tests/contract/recording-api.contract.spec.ts`

### Implementation for User Story 6

- [x] T035 [US6] Install `@mux/mux-node` SDK as project dependency via `npm install @mux/mux-node`
- [x] T036 [US6] Implement MUX uploader module (create MUX client with token ID/secret from config, create direct upload URL, stream MP4 file to MUX, poll for asset ready status, retrieve playback URL) in `src/lib/recording/mux-uploader.ts`
- [x] T037 [US6] Implement POST upload route (auth requireAdmin, validate recording exists and is not active, check MUX credentials configured, upload via mux-uploader, forward URL via existing `transmitRecording` from Spec 001, return 200/207/404/409/502/503) in `src/app/api/recording/upload/[id]/route.ts`

**Checkpoint**: User Story 6 complete. Recordings can be uploaded to MUX and linked to seminars on hemera.academy.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, error reporting, and documentation

- [x] T038 [P] Add `reportError()` calls for FFmpeg failures, webcam errors, MUX upload failures, and unexpected exceptions across all route handlers
- [x] T039 [P] Add `RECORDING_ALREADY_RUNNING`, `NO_ACTIVE_RECORDING`, `FFMPEG_NOT_FOUND`, `WEBCAM_UNREACHABLE`, `MUX_NOT_CONFIGURED`, and `MUX_UPLOAD_FAILED` to `ErrorCodes` in `src/lib/utils/api-response.ts`
- [x] T040 Run quickstart.md validation — execute all curl commands from `specs/004-recording-module/quickstart.md` against a running dev server and verify expected responses
- [x] T041 Run full test suite (`npm run test`) and fix any regressions
- [x] T042 Run full CI checks (`npm run typecheck && npm run lint`) and fix any errors

**Checkpoint**: All 6 user stories complete, tests passing, CI green.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (needs ffmpeg-capture + session-manager)
- **US2 (Phase 4)**: Depends on Phase 2 (needs file-manager). Independent of US1.
- **US3 (Phase 5)**: Depends on Phase 2 (needs playback-controller). Independent of US1/US2.
- **US4 (Phase 6)**: Depends on US3 (needs SSE events route) and US5 (needs stream route)
- **US5 (Phase 7)**: Depends on Phase 2 (needs stream-handler + file-manager). Independent of US1/US2/US3.
- **US6 (Phase 8)**: Depends on Phase 2 (needs file-manager) and US1 (needs completed recordings to upload). Requires `@mux/mux-node` install.
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US2 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US3 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US4 (P1)**: Depends on US3 (SSE route) + US5 (stream route)
- **US5 (P2)**: Can start after Phase 2 — no dependencies on other stories
- **US6 (P2)**: Can start after Phase 2 and US1 (needs completed recordings to upload) — integrates with existing Spec 001 transmitRecording

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Library modules before route handlers
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- Phase 1: T001, T002, T003 are independent files → **all parallel**
- Phase 1: T004, T005 are sequential (types depends on schemas)
- Phase 2: T008, T009, T010 can run in parallel (different files); T006→T007 sequential (session-manager depends on ffmpeg-capture)
- Phase 3 (US1): T011, T012, T013 tests all parallel
- Phase 3 (US1): T014, T015 routes parallel
- Phase 4 (US2): T017, T018 tests parallel; T019, T020 routes parallel
- Phase 5 (US3): T022, T023 tests parallel; T024, T025, T026, T027 routes all parallel
- Phase 7 (US5): T031a unit test, T031 contract test, then T032 implementation
- Phase 8 (US6): T033, T034 tests parallel; T035→T036→T037 sequential

---

## Parallel Example: User Stories 1, 2, 3, 5

```bash
# After Phase 2 Foundation is complete, these can all start in parallel:

# Stream A: User Story 1 (Start/Stop Recording)
Task: T011 — Unit test ffmpeg-capture
Task: T012 — Unit test session-manager
Task: T013 — Contract test start/stop
Task: T014 — Start route
Task: T015 — Stop route

# Stream B: User Story 2 (Status/List/Delete)
Task: T017 — Unit test file-manager
Task: T018 — Contract test status/list/delete
Task: T019 — Status route
Task: T020 — List route
Task: T021 — Delete route

# Stream C: User Story 3 (Playback Control)
Task: T022 — Unit test playback-controller
Task: T023 — Contract test playback
Task: T024-T029 — Playback routes + SSE

# Stream D: User Story 5 (Streaming)
Task: T031 — Contract test streaming
Task: T032 — Stream route

# Once US3 + US5 done → User Story 4 (Player Page)
# Once US1 done → User Story 6 (MUX Upload)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational (T006–T010)
3. Complete Phase 3: User Story 1 — Start/Stop Recording (T011–T016)
4. **STOP and VALIDATE**: Start a recording, stop it, verify MP4 file exists
5. Deploy/demo if ready — basic recording works

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Start/Stop) → Test independently → **Recording MVP!**
3. Add US2 (Status/List/Delete) → Test independently → Recording management
4. Add US3 (Playback Control) + US5 (Streaming) → Test independently → API-driven playback
5. Add US4 (Player Page) → Test independently → Full playback experience
6. Add US6 (MUX Upload) → Test independently → Cloud distribution
7. Polish → CI green, error reporting, quickstart validated

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- FFmpeg is mocked in all tests — no real webcam needed for development
- `_resetState()` pattern used in session-manager and playback-controller for test isolation
