# Tasks: 008 — Controller Bridge Endpoints

**Input**: Design documents from `/specs/008-controller-bridge-endpoints/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — contract and unit tests are required before implementation tasks.

**Organization**: Tasks are grouped by user story to support independent delivery and validation.

## Phase 1: Contract Test-First Gate (Required)

- [ ] T001 Write failing contract tests for both endpoints (success + core error paths) in `tests/contracts/controller-endpoints.spec.ts`

---

## Phase 2: Setup (Shared Infrastructure)

- [ ] T002 Create controller route directory structure in `src/app/api/slides/controller/` and `src/app/api/slides/controller/navigation/`
- [ ] T003 [P] Create OpenAPI contract file for both endpoints in `specs/008-controller-bridge-endpoints/contracts/controller-endpoints.openapi.yaml`
- [ ] T004 [P] Add shared controller DTO/types and input/output schema validators in `src/lib/slides/controller-types.ts`

---

## Phase 3: Foundational Test-First (Blocking Prerequisites)

- [ ] T005 [P] Add unit tests for manifest helper behavior in `tests/unit/controller-manifest.spec.ts`
- [ ] T006 [P] Add unit tests for navigation helper behavior in `tests/unit/controller-navigation.spec.ts`
- [ ] T007 [P] Extend contract tests with boundary/state-conflict permutations in `tests/contracts/controller-endpoints.spec.ts`

---

## Phase 4: Foundational Implementation (Blocking Prerequisites)

- [ ] T008 Implement manifest loading helper in `src/lib/slides/controller-manifest.ts`
- [ ] T009 [P] Implement navigation mutation helper in `src/lib/slides/controller-navigation.ts`
- [ ] T010 [P] Add shared controller error mapping utility in `src/lib/slides/controller-navigation.ts`

**Checkpoint**: Controller domain helpers exist and are testable in isolation.

---

## Phase 5: User Story 1 - Fetch Controller Manifest (Priority: P1)

**Goal**: Expose deterministic manifest endpoint for Gaia controller bootstrap.

**Independent Test**: `GET /api/slides/controller?courseId=...` returns stable ordered payload.

### Tests for User Story 1

- [ ] T011 [P] [US1] Extend contract tests for manifest endpoint in `tests/contracts/controller-endpoints.spec.ts`
- [ ] T012 [P] [US1] Extend unit tests for manifest ordering and required fields in `tests/unit/controller-manifest.spec.ts`
- [ ] T013 [P] [US1] Add explicit FR-007 tests for notes present and notes absent in manifest responses in `tests/contracts/controller-endpoints.spec.ts`

### Implementation for User Story 1

- [ ] T014 [US1] Implement `GET /api/slides/controller` route in `src/app/api/slides/controller/route.ts`
- [ ] T015 [US1] Wire route to manifest helper and auth checks in `src/app/api/slides/controller/route.ts`
- [ ] T016 [US1] Add explicit `400/404/503` error responses for manifest path in `src/app/api/slides/controller/route.ts`

**Checkpoint**: Manifest endpoint works independently and passes contract tests.

---

## Phase 6: User Story 2 - Advance or Reverse Active Slide (Priority: P1)

**Goal**: Expose navigation mutation endpoint with optimistic conflict checks.

**Independent Test**: `POST /api/slides/controller/navigation` updates index only for valid state and returns conflict for stale state.

### Tests for User Story 2

- [ ] T017 [P] [US2] Extend contract tests for navigation success and conflict in `tests/contracts/controller-endpoints.spec.ts`
- [ ] T018 [P] [US2] Extend unit tests for previous/next boundary behavior and fromIndex conflicts in `tests/unit/controller-navigation.spec.ts`
- [ ] T019 [P] [US2] Add explicit FR-007 tests for optional notes handling in navigation success responses in `tests/contracts/controller-endpoints.spec.ts`
- [ ] T032 [P] [US2] Add concurrency/stale-sequence test for parallel navigation requests in `tests/contracts/controller-endpoints.spec.ts`

### Implementation for User Story 2

- [ ] T020 [US2] Implement `POST /api/slides/controller/navigation` route in `src/app/api/slides/controller/navigation/route.ts`
- [ ] T021 [US2] Enforce `fromIndex` conflict behavior and command bounds in `src/lib/slides/controller-navigation.ts`
- [ ] T022 [US2] Add explicit `400/404/409/503` error mappings in `src/app/api/slides/controller/navigation/route.ts`

**Checkpoint**: Navigation endpoint works independently and enforces deterministic state updates.

---

## Phase 7: User Story 3 - Secure and Observable Integration (Priority: P2)

**Goal**: Ensure both endpoints are secured and emit safe operational signals.

**Independent Test**: Unauthorized calls fail consistently and logs/response payloads expose no secrets.

### Tests for User Story 3

- [ ] T023 [P] [US3] Add unauthorized access contract checks for both endpoints in `tests/contracts/controller-endpoints.spec.ts`
- [ ] T024 [P] [US3] Add tests validating sanitized error payloads in `tests/contracts/controller-endpoints.spec.ts`
- [ ] T033 [P] [US3] Add Rollbar monitoring validation tests (error capture, severity, requestId context, sensitive-field filtering) in `tests/contracts/controller-endpoints.spec.ts`

### Implementation for User Story 3

- [ ] T025 [US3] Reuse/attach existing auth middleware or guard in both controller routes
- [ ] T026 [US3] Add Rollbar-based structured logging with requestId/errorCategory/severity in controller routes
- [ ] T027 [US3] Ensure no token/path leakage in all controller error responses

**Checkpoint**: Security and observability requirements are fully met.

---

## Phase 8: Polish

- [ ] T028 [P] Update feature docs/examples in `specs/008-controller-bridge-endpoints/quickstart.md` if implementation differs
- [ ] T029 Run focused validation: `npx vitest run tests/contracts/controller-endpoints.spec.ts`
- [ ] T030 Run focused validation: `npx vitest run tests/unit/controller-manifest.spec.ts tests/unit/controller-navigation.spec.ts`
- [ ] T031 Run lint/typecheck for touched files
- [ ] T034 Run performance validation for p95 goals using representative fixture load and document results against plan targets

---

## Dependencies & Execution Order

- Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5/6 -> Phase 7 -> Phase 8
- US1 and US2 can proceed in parallel after Phase 4 if file ownership is split.
- US3 depends on route completion in US1/US2.
- Contract tests must exist first (Phase 1), then foundational tests (Phase 3), then corresponding implementation tasks.

## Parallel Opportunities

- T003, T004 can run in parallel.
- T005, T006, T007 can run in parallel.
- T009, T010 can run in parallel.
- T011, T012 and T017, T018, T032 and T023, T024, T033 can run in parallel.

## MVP Scope

- Complete through Phase 6 (US1 + US2) to unblock Gaia.
- Phase 7 and Phase 8 harden security/operations for production readiness.
