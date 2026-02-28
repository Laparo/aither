# Tasks: 006 — Participant Slides

**Input**: Design documents from `/specs/006-participant-slides/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — Constitution Principle I (Test-First) is NON-NEGOTIABLE. Contract files provide test case specifications.

**Organization**: Tasks grouped by user story. US5/US6 (data access) are foundational; US1–US3 (template engine core) form the MVP; US7 (Mode B) and US4 (pipeline integration) build on top.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extract shared utilities, add new types and Zod schemas needed by all stories

- [x] T001 Extract shared `escapeHtml()` to `src/lib/slides/utils.ts` — consolidate private copies from `html-layout.ts` and `slide-builder.ts` (see research R9)
- [x] T002 [P] Add `ServiceMaterialSchema`, `ServiceMaterialTopicSchema`, `ServiceMaterialsResponseSchema` Zod schemas to `src/lib/hemera/schemas.ts` (see research R4, data-model.md)
- [x] T003 [P] Extend `src/lib/slides/types.ts` with new types: `SlideContext`, `CollectionRecord`, `TemplateSection`, `ParsedPlaceholder`, `MaterialWithLinks`, `DistributedSlide`, `ReplacementMode`, `SlideGenerationEvent` (see data-model.md)

---

## Phase 2: Foundational — US5 + US6 (Data Access)

**Purpose**: Course resolver and slide context builder — MUST be complete before template engine stories can integrate with real data

**⚠️ CRITICAL**: Pipeline integration (US4) cannot work without these

### US5: Course-Resolver for Service-API

- [x] T004 [P] [US5] Write unit test for `getNextCourseWithParticipants()` in `tests/unit/course-resolver.spec.ts` — mock HemeraClient, verify it calls `/api/service/courses` then `/api/service/courses/{id}`, returns `ServiceCourseDetail` with `participants[]`
- [x] T005 [US5] Implement `getNextCourseWithParticipants()` in `src/lib/slides/course-resolver.ts` — reuse existing `getNextCourse()` pattern, add detail fetch with `ServiceCourseDetailResponseSchema` validation

### US6: Build Slide Context

- [x] T006 [P] [US6] Write unit test for `buildSlideContext()` in `tests/unit/slide-context.spec.ts` — verify scalar mapping (`courseTitle`, `courseLevel`, `participantCount`, etc.), collection mapping (`participant` to array of `CollectionRecord`), null to em-dash handling, `preparationCompleted` derivation
- [x] T007 [US6] Implement `buildSlideContext()` in `src/lib/slides/slide-context.ts` — transform `ServiceCourseDetail` into `SlideContext` with `scalars` dict and `collections` map

**Checkpoint**: Course data and slide context available — template engine stories can now integrate

---

## Phase 3: US1 — Section Extraction + Placeholder Recognition (Priority: P1) 🎯 MVP

**Goal**: Parse HTML materials to extract `<section class="slide">` blocks and recognize `{}`-style placeholders, classifying them as scalar or collection

**Independent Test**: Given a known HTML string with mixed sections and placeholders, verify correct extraction count, placeholder classification, and deduplication

### Tests for US1

- [x] T008 [P] [US1] Write unit test for `parsePlaceholders()` in `tests/unit/template-engine.spec.ts` — 8 cases from `contracts/template-engine.contract.ts`: scalar detection, collection detection, dedup, CSS `{}` ignore, nested braces
- [x] T010 [P] [US1] Write unit test for `parseSections()` and `hasSectionTags()` in `tests/unit/section-parser.spec.ts` — 13 cases from `contracts/section-parser.contract.ts`: single/multiple sections, implicit section, extra attrs, whitespace, empty, placeholder classification, nested HTML

### Implementation for US1

- [x] T009 [US1] Implement `parsePlaceholders()` in `src/lib/slides/template-engine.ts` — regex `/{([a-zA-Z][a-zA-Z0-9]*(?::[a-zA-Z][a-zA-Z0-9]*)?)}/g`, return `ParsedPlaceholder[]` with type discrimination
- [x] T011 [US1] Implement `parseSections()` and `hasSectionTags()` in `src/lib/slides/section-parser.ts` — regex extraction of `<section class="slide">` blocks, implicit section fallback for sectionless HTML, return `TemplateSection[]`

**Checkpoint**: Parsing works — can extract sections and classify placeholders from any HTML material

---

## Phase 4: US2 — Scalar Placeholder Replacement (Priority: P1) 🎯 MVP

**Goal**: Replace `{key}` placeholders with values from the scalar context, with HTML escaping and null handling

**Independent Test**: Given HTML with `{courseTitle}` and a context `{ courseTitle: "React Workshop" }`, verify correct replacement, escaping, and null to em-dash

### Tests for US2

- [x] T012 [US2] Write unit test for `replaceScalars()` in `tests/unit/template-engine.spec.ts` — 5 cases from `contracts/template-engine.contract.ts`: basic replacement, multi-occurrence, null to em-dash, unknown unchanged, HTML escape

### Implementation for US2

- [x] T013 [US2] Implement `replaceScalars()` in `src/lib/slides/template-engine.ts` — iterate scalar placeholders, replace with `escapeHtml(value)` from `utils.ts`, null/undefined to em-dash, unknown keys untouched

**Checkpoint**: Scalar replacement works — materials with only `{courseTitle}`/`{courseLevel}` produce correct output

---

## Phase 5: US3 — Section-Based Collection Iteration (Priority: P1) 🎯 MVP

**Goal**: For sections containing collection placeholders (e.g., `{participant:name}`), iterate over all records and produce one slide per record

**Independent Test**: Given a section with `{participant:name}` and 3 participants, verify 3 HTML strings with correct per-participant data and scalar values

### Tests for US3

- [x] T014 [US3] Write unit test for `replaceCollection()` in `tests/unit/template-engine.spec.ts` — 6 cases from `contracts/template-engine.contract.ts`: one-per-record, scalar+collection mix, empty array, null to em-dash, HTML escape, type mismatch

### Implementation for US3

- [x] T015 [US3] Implement `replaceCollection()` in `src/lib/slides/template-engine.ts` — read first collection type from section, iterate records, call `replaceScalars()` for scalar placeholders in each iteration, return `string[]`

**Checkpoint**: Mode A complete — section-based iteration produces N slides from 1 section x N participants

---

## Phase 6: US7 — Identifier-Based Distribution / Mode B (Priority: P2)

**Goal**: Detect when a template is linked multiple times in the curriculum and distribute participants sequentially across instances

**Independent Test**: Given a template `video-analysis` with 3 curriculum links and 3 participants, verify 3 output files `video-analysis-01.html` through `video-analysis-03.html`, each with one participant's data

### Tests for US7

- [x] T016 [P] [US7] Write unit test for `detectMode()` and `groupMaterialsByIdentifier()` in `tests/unit/mode-detector.spec.ts` — 11 cases from `contracts/mode-detection.contract.ts`: Mode A (sections present), Mode B (multi-linked + collection + no sections), scalar-only, implicit section, grouping with single/multi links, null htmlContent, empty topics
- [x] T018 [P] [US7] Write unit test for `distributeByIdentifier()` in `tests/unit/identifier-distributor.spec.ts` — 7 cases from `contracts/identifier-distribution.contract.ts`: sequential naming, scalar+collection mix, 1:1 invariant mismatch warning, zero-padded filenames, empty participants, HTML escape, preserved non-placeholder content

### Implementation for US7

- [x] T017 [US7] Implement `detectMode()` and `groupMaterialsByIdentifier()` in `src/lib/slides/mode-detector.ts` — three-step detection (sections then link count then collection placeholders), material grouping by `materialId` across topics (see research R3, R5)
- [x] T019 [US7] Implement `distributeByIdentifier()` in `src/lib/slides/identifier-distributor.ts` — sequential participant assignment, `{identifier}-{nn}.html` naming with zero-padding, scalar + collection replacement per instance, Rollbar warning on 1:1 mismatch

**Checkpoint**: Mode B complete — identifier-distributed templates produce correctly named per-participant files

---

## Phase 7: US4 — Pipeline Integration (Priority: P1)

**Goal**: Wire all modules into `SlideGenerator.generate()` — auto-detect mode per material, process templates, emit structured event

**Independent Test**: Run `generate()` against a mock course with mixed materials (Mode A sections, Mode B identifier-linked, scalar-only) and verify correct total slide count, file naming, and `slides.generated` event payload

### Tests for US4

- [x] T020 [US4] Write unit test for extended `generate()` with materials processing in `tests/unit/slide-generator.spec.ts` — mock HemeraClient for materials endpoint, verify Mode A/B routing, error handling (skip + Rollbar), clean + regenerate, structured event

### Implementation for US4

- [x] T021 [US4] Add materials fetch step to `SlideGenerator.generate()` in `src/lib/slides/generator.ts` — call `GET /api/service/courses/{id}/materials` via HemeraClient with `ServiceMaterialsResponseSchema` validation, wrap in try/catch for skip+log on failure (research R10 step 5)
- [x] T022 [US4] Integrate mode detection and template processing into `generate()` in `src/lib/slides/generator.ts` — for each material: `groupMaterialsByIdentifier()` then `detectMode()` then branch to `parseSections()`+`replaceCollection()`/`replaceScalars()` (Mode A) or `distributeByIdentifier()` (Mode B)
- [x] T023 [US4] Add file writing with correct naming in `src/lib/slides/generator.ts` — Mode A: `03_material_{topicIdx}_{sectionIdx}_{iterationIdx}.html` via `wrapInLayout()`, Mode B: `{identifier}-{nn}.html` via `wrapInLayout()` (research R8)
- [x] T024 [US4] Emit `slides.generated` structured event via `serverInstance.info()` in `src/lib/slides/generator.ts` — populate `SlideGenerationEvent` fields: `totalSlides`, `materialSlides`, `modeACount`, `modeBCount`, `skippedSections`, `durationMs`, `errors` (research R6)

**Checkpoint**: Full pipeline works end-to-end — `generate()` fetches materials, detects modes, processes templates, writes files, logs structured event

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates, import cleanup, and validation

- [x] T025 [P] Update imports in `src/lib/slides/html-layout.ts` and `src/lib/slides/slide-builder.ts` to use shared `escapeHtml()` from `src/lib/slides/utils.ts` — remove private copies
- [x] T026 [P] Run `npx biome check --write src/lib/slides/ tests/unit/` to format all new files
- [x] T027 Run `npx tsc --noEmit` to verify zero type errors across all new and modified files
- [x] T028 Run full test suite `npx vitest run tests/unit/` to verify all tests pass
- [x] T029 Run performance benchmark: generate slides for a course with 20 participants + 10 materials, verify completion in <5s (plan §Technical Context target)
- [x] T030 Run quickstart.md validation scenarios against running dev servers (hemera:3000 + aither:3500)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (types.ts needed for US5/US6) — BLOCKS pipeline integration (US4)
- **US1 (Phase 3)**: Depends on Phase 1 (types.ts, utils.ts) — BLOCKS US2, US3, US7
- **US2 (Phase 4)**: Depends on US1 (needs `parsePlaceholders()`)
- **US3 (Phase 5)**: Depends on US1, US2 (needs parsing + scalar replacement)
- **US7 (Phase 6)**: Depends on US1, US2 (needs parsing + replacement for Mode B)
- **US4 (Phase 7)**: Depends on ALL previous stories (integrates everything)
- **Polish (Phase 8)**: Depends on all implementation complete

### User Story Dependencies

```
Phase 1 (Setup)
    |-- Phase 2 (US5 + US6) ----------------------+
    +-- Phase 3 (US1) ---+-- Phase 4 (US2) ---+-- Phase 7 (US4)
                          |                     |       |
                          +-- Phase 6 (US7) ----+       |
                          |                              |
                          +-- Phase 5 (US3) -------------+
                                                         |
                                                  Phase 8 (Polish)
```

### Parallel Opportunities

- **Phase 1**: T002 + T003 can run in parallel (different files)
- **Phase 2**: T004 + T006 can run in parallel (different test files)
- **Phase 2 // Phase 3**: US5/US6 and US1 can run in parallel after setup (no shared files)
- **Phase 3**: T008 + T010 can run in parallel (different test files)
- **Phase 5 // Phase 6**: US3 and US7 can run in parallel after US2 (different files)
- **Phase 6**: T016 + T018 can run in parallel (different test files)
- **Phase 8**: T025 + T026 can run in parallel

---

## Parallel Example: Phase 2 + Phase 3 (after Setup)

```bash
# These can run simultaneously after Phase 1 setup:

# Track A: Data Access (US5 + US6)
Task T004: "Write test for getNextCourseWithParticipants() in tests/unit/course-resolver.spec.ts"
Task T005: "Implement getNextCourseWithParticipants() in src/lib/slides/course-resolver.ts"
Task T006: "Write test for buildSlideContext() in tests/unit/slide-context.spec.ts"
Task T007: "Implement buildSlideContext() in src/lib/slides/slide-context.ts"

# Track B: Parsing (US1) — runs in parallel with Track A
Task T008: "Write test for parsePlaceholders() in tests/unit/template-engine.spec.ts"
Task T010: "Write test for parseSections() in tests/unit/section-parser.spec.ts"
Task T009: "Implement parsePlaceholders() in src/lib/slides/template-engine.ts"
Task T011: "Implement parseSections() in src/lib/slides/section-parser.ts"
```

## Parallel Example: Phase 5 + Phase 6 (after US2)

```bash
# These can run simultaneously after US2 scalar replacement is done:

# Track A: Mode A Collection Iteration (US3)
Task T014: "Write test for replaceCollection() in tests/unit/template-engine.spec.ts"
Task T015: "Implement replaceCollection() in src/lib/slides/template-engine.ts"

# Track B: Mode B Distribution (US7) — runs in parallel with Track A
Task T016: "Write test for detectMode() in tests/unit/mode-detector.spec.ts"
Task T018: "Write test for distributeByIdentifier() in tests/unit/identifier-distributor.spec.ts"
Task T017: "Implement detectMode() in src/lib/slides/mode-detector.ts"
Task T019: "Implement distributeByIdentifier() in src/lib/slides/identifier-distributor.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 = Mode A Complete)

1. Complete Phase 1: Setup (types, schemas, utils)
2. Complete Phase 2: Foundational (US5 + US6 — data access)
3. Complete Phase 3: US1 (section extraction + placeholder parsing)
4. Complete Phase 4: US2 (scalar replacement)
5. Complete Phase 5: US3 (collection iteration)
6. **STOP and VALIDATE**: Mode A works end-to-end — section-based slides with participant data
7. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational -> Data pipeline ready
2. US1 -> Parsing verified -> Can inspect extracted sections/placeholders
3. US2 -> Scalar slides work -> Materials with `{courseTitle}` produce output
4. US3 -> Mode A complete -> **MVP: Participant slides via section iteration**
5. US7 -> Mode B complete -> Identifier-distributed slides work
6. US4 -> Full integration -> `generate()` handles all modes automatically
7. Polish -> Quality gates pass -> Ready for production

### Suggested MVP Scope

**US1 + US2 + US3** (Phases 1-5, Tasks T001-T015): Template engine parses and replaces both scalar and collection placeholders in section-based HTML. This covers the primary use case of generating per-participant slides from section templates.

---

## Notes

- All test tasks reference specific contract files in `specs/006-participant-slides/contracts/` — use these as test case specifications
- `escapeHtml()` extraction (T001) should be done first since multiple modules depend on it
- The `ServiceMaterialsResponseSchema` (T002) must match the hemera endpoint response exactly — see `hemera/app/api/service/courses/[id]/materials/route.ts`
- Mode B 1:1 invariant (participant count = curriculum link count) is enforced by hemera, but aither logs a Rollbar warning on mismatch
- Constitution Principle I: All test tasks (T004, T006, T008, T010, T012, T014, T016, T018, T020) must be written FIRST and FAIL before their corresponding implementation task
