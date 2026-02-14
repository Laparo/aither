# Tasks: Course Slides

**Input**: Design documents from `/specs/002-course-slides/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: Included — Constitution I (Test-First) is NON-NEGOTIABLE. TDD cycle: write test → confirm fail → implement → confirm pass → refactor.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create project structure and shared types for slide generation

- [x] T001 [P] Create slide types in `src/lib/slides/types.ts` — SlideJob, SlideType enum, SlideGenerationResult
- [x] T002 [P] Create HTML layout module in `src/lib/slides/html-layout.ts` — base 1920×1080 layout with CSS custom properties, `wrapInLayout(title: string, content: string): string`
- [x] T002b [P] Unit test for HTML layout in `tests/unit/html-layout.spec.ts` — test `wrapInLayout()` produces valid HTML with 1920×1080 dimensions, CSS custom properties present, content injected correctly
- [x] T002c Verify `output/slides/` is covered by `.gitignore` (existing `output/` rule should suffice)

**Checkpoint**: Shared types and layout available for all user stories

---

## Phase 2: User Story 1 — Generate Intro Slide (Priority: P1) 🎯 MVP

**Goal**: Determine the next upcoming course and generate an intro slide with course name and dates

**Independent Test**: Trigger slide generation → verify `01_intro.html` exists with correct course name and formatted dates

### Tests for User Story 1 ⚠️

> **Write these tests FIRST, ensure they FAIL before implementation (Constitution I)**

- [x] T003 [P] [US1] Unit test for course resolver in `tests/unit/course-resolver.spec.ts` — test next-course selection logic: picks nearest future seminar, handles no future seminars, handles empty API response
- [x] T004 [P] [US1] Unit test for intro slide builder in `tests/unit/slide-builder.spec.ts` — test intro HTML generation: course name centered, start date formatted in de-CH locale, end date shown only when different from start date, end date hidden when same day

### Implementation for User Story 1

- [x] T005 [US1] Implement course resolver in `src/lib/slides/course-resolver.ts` — `getNextCourse(client: HemeraClient): Promise<Seminar>`, fetches all seminars, filters for future start dates, returns the nearest one, throws descriptive error if none found
- [x] T006 [US1] Implement intro slide builder in `src/lib/slides/slide-builder.ts` — `buildIntroSlide(seminar: Seminar): string`, formats dates with `Intl.DateTimeFormat('de-CH')`, compares start/end on YYYY-MM-DD level, wraps in HTML layout
- [x] T007 [US1] Implement slide file writer utility — `clearOutputDir(dir: string): Promise<void>` and `writeSlide(dir: string, filename: string, html: string): Promise<void>` in `src/lib/slides/generator.ts` (or separate `file-writer.ts`)

**Checkpoint**: Can determine next course and generate intro slide. Minimal viable output.

---

## Phase 3: User Story 2 — Generate Curriculum Slides (Priority: P1) 🎯 MVP

**Goal**: Generate one HTML slide per lesson of the next course, sorted by sequence

**Independent Test**: Trigger slide generation → verify `02_curriculum_{n}.html` files exist for each lesson

### Tests for User Story 2 ⚠️

> **Write these tests FIRST, ensure they FAIL before implementation (Constitution I)**

- [x] T008 [P] [US2] Unit test for curriculum slide builder in `tests/unit/slide-builder.spec.ts` — test curriculum HTML generation: lesson title centered, correct filename per sequence, lessons filtered by seminarId, sorted by sequence field (not API order)

### Implementation for User Story 2

- [x] T009 [US2] Implement lesson fetching and filtering in `src/lib/slides/generator.ts` — fetch all lessons via HemeraClient, filter by `seminarId`, sort by `sequence`
- [x] T010 [US2] Implement curriculum slide builder in `src/lib/slides/slide-builder.ts` — `buildCurriculumSlide(lesson: Lesson): string`, lesson title centered, wraps in HTML layout

**Checkpoint**: Intro + curriculum slides generated. Course structure visible as presentation.

---

## Phase 4: User Story 3 — Generate Course Material Slides (Priority: P2)

**Goal**: Generate HTML slides for text content, images, and videos linked to each lesson

**Independent Test**: Trigger slide generation → verify `03_material_{lessonSeq}_{idx}.html` files exist with correct content

### Tests for User Story 3 ⚠️

> **Write these tests FIRST, ensure they FAIL before implementation (Constitution I)**

- [x] T011 [P] [US3] Unit test for material slide builder in `tests/unit/slide-builder.spec.ts` — test text content slide (HTML body centered), image slide (`<img>` with src and alt), video slide (`<video>` with controls), correct filename pattern, materials ordered by lesson sequence then index

### Implementation for User Story 3

- [x] T012 [US3] Implement text/media fetching and filtering in `src/lib/slides/generator.ts` — fetch texts and media via HemeraClient, filter by `entityRef.type === "lesson"` and `entityRef.id`, group by lesson
- [x] T013 [US3] Implement material slide builders in `src/lib/slides/slide-builder.ts` — `buildTextSlide(text: TextContent): string`, `buildImageSlide(media: MediaAsset): string`, `buildVideoSlide(media: MediaAsset): string`

**Checkpoint**: Full slide set generated — intro, curriculum, and all course materials.

---

## Phase 5: User Story 4 — API Endpoint for Slide Generation (Priority: P2)

**Goal**: Expose `POST /api/slides` endpoint to trigger slide generation with auth and mutex

**Independent Test**: Send POST to `/api/slides` → verify slides generated, auth enforced, concurrent requests rejected

### Tests for User Story 4 ⚠️

> **Write these tests FIRST, ensure they FAIL before implementation (Constitution I)**

- [x] T014 [P] [US4] Contract test for slides API in `tests/contract/slides-api.contract.spec.ts` — test POST /api/slides: returns 200 with slide count on success, returns 401 for unauthenticated, returns 403 for non-admin, returns 409 when already running
- [x] T015 [P] [US4] Unit test for slide generator orchestrator in `tests/unit/slide-generator.spec.ts` — test full pipeline: calls course resolver, generates intro, curriculum, and material slides, clears output dir, returns correct slide count. Edge case: course with no lessons → only intro slide generated, warning logged

### Implementation for User Story 4

- [x] T016 [US4] Implement slide generator orchestrator in `src/lib/slides/generator.ts` — `SlideGenerator.generate(): Promise<SlideGenerationResult>`, orchestrates full pipeline: clear dir → resolve course → generate intro → generate curriculum → generate materials → return result
- [x] T017 [US4] Implement API route in `src/app/api/slides/route.ts` — POST handler with Clerk auth (admin role), mutex to prevent concurrent generation, calls SlideGenerator, returns JSON with slide count and status

**Checkpoint**: Slide generation fully operational via API endpoint.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality improvements across all user stories

- [x] T018 [P] Add JSDoc documentation to all public functions in `src/lib/slides/`
- [x] T019 [P] Add Rollbar error logging for slide generation failures
- [x] T020 Run Biome formatting and linting check across all new files
- [x] T021 Update `specs/002-course-slides/spec.md` status from Draft to Complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **User Story 1 (Phase 2)**: Depends on Setup (Phase 1)
- **User Story 2 (Phase 3)**: Depends on Setup (Phase 1); can run in parallel with US1 but shares `slide-builder.ts`
- **User Story 3 (Phase 4)**: Depends on Setup (Phase 1); can run after US2 (extends generator and builder)
- **User Story 4 (Phase 5)**: Depends on US1+US2+US3 (orchestrates full pipeline)
- **Polish (Phase 6)**: Depends on all user stories being complete

### Within Each User Story

1. Tests MUST be written and FAIL before implementation (Constitution I)
2. Types/models before services
3. Services before endpoints
4. Core implementation before integration
5. Commit after each task or logical group

### Parallel Opportunities

```
Phase 1: T001 ─┬─ T002    (parallel — different files)
               │
Phase 2: T003 ─┼─ T004    (parallel tests)
               │
         T005 → T006 → T007  (sequential — dependencies)
               │
Phase 3: T008             (test first)
         T009 → T010      (sequential)
               │
Phase 4: T011             (test first)
         T012 → T013      (sequential)
               │
Phase 5: T014 ─┼─ T015   (parallel tests)
         T016 → T017      (sequential)
               │
Phase 6: T018 ─┼─ T019   (parallel)
         T020 → T021      (sequential)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (types + layout)
2. Complete Phase 2: US1 — Intro slide (course resolver + date formatting)
3. Complete Phase 3: US2 — Curriculum slides (lesson fetching + filtering)
4. **STOP and VALIDATE**: Generate intro + curriculum slides manually
5. Continue with US3 (materials) and US4 (API endpoint)

### Incremental Delivery

1. Setup → Types and layout ready
2. US1 → Intro slide works → Can demo course identification
3. US2 → Curriculum slides work → Can demo course structure
4. US3 → Material slides work → Full slide set available
5. US4 → API endpoint works → Operational trigger mechanism
6. Polish → Production-ready

---

## Notes

- Reuses `HemeraClient`, Zod schemas, and entity types from Spec 001 — no duplication
- No new npm dependencies required (uses built-in `Intl.DateTimeFormat` and `fs`)
- All code, comments, and documentation in English (Constitution X)
- Frontend text (dates in slides) in German de-CH locale (Constitution X exception)
- Total: 23 tasks across 6 phases
