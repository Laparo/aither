# Tasks: 007 — Dashboard Design

**Input**: Design documents from `/specs/007-dashboard-design/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/components.md, quickstart.md

**Tests**: Unit tests included (Constitution I mandates test-first development). E2E test for layout validation per acceptance criteria.

**Organization**: Tasks grouped by user story. Each story corresponds to a dashboard section and can be implemented and tested independently after the foundational theme infrastructure is in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths included in all descriptions

## Phase 1: Setup

**Purpose**: Create directories and globals.css for the new component structure

- [ ] T001 Create dashboard component directory at `src/app/components/dashboard/`
- [ ] T002 [P] Create theme component directory at `src/app/components/theme/`
- [ ] T003 [P] Create `src/app/globals.css` with Hemera CSS custom properties (`--hemera-beige`, `--hemera-marsala`, `--hemera-bronze`, `--hemera-rosy-brown`, `--hemera-light-black`) and Google Fonts imports (Inter 400–700, Playfair Display 400–700)

---

## Phase 2: Foundational — Theme Infrastructure (Blocking)

**Purpose**: Hemera design system integration. MUST complete before any dashboard section work.

**⚠️ CRITICAL**: No section component work (US2–US5) can begin until this phase is complete.

- [ ] T004 [P] [US1] Create Hemera design tokens in `src/app/components/theme/design-tokens.ts` — export `colors` (marsala, marsalaLight, marsalaDark, bronze, rosyBrown, beige, lightBlack, white, infoMain, lightGray), `spacing` (sectionPy, sectionPyCompact, containerMaxWidth), and `typography` (heading: Playfair Display, body: Inter) objects
- [ ] T005 [P] [US1] Write unit test for design tokens in `tests/unit/theme-tokens.spec.ts` — assert color hex values match Hemera canonical values, spacing.containerMaxWidth === 'lg', typography families correct
- [ ] T006 [US1] Create MUI theme configuration in `src/app/components/theme/theme.ts` — `createTheme()` with palette (primary=marsala, secondary=bronze, background.default=beige), typography (Playfair Display headings, Inter body), component overrides (MuiContainer maxWidthLg=1200px, MuiAppBar rosyBrown), shape.borderRadius=8
- [ ] T007 [US1] Create ThemeRegistry client component in `src/app/components/theme/ThemeRegistry.tsx` — wrap children with `AppRouterCacheProvider` → `ThemeProvider` → `CssBaseline`
- [ ] T008 [US1] Update root layout in `src/app/layout.tsx` — replace bare `AppRouterCacheProvider` with `ThemeRegistry`, import `globals.css`

**Checkpoint**: Theme infrastructure ready. Dashboard renders with Hemera colors, fonts, and spacing. All subsequent sections inherit the theme.

---

## Phase 3: User Story 2 — Section A: Course & Material Overview (Priority: P1) 🎯 MVP

**Goal**: Two side-by-side cards at the top of the dashboard showing course details and material status.

**Independent Test**: Course card renders with mock `ServiceCourseDetail`; material card renders with mock `SlideStatus`. Both cards visible side-by-side on desktop viewport.

### Unit Tests for US2

- [ ] T009 [P] [US2] Write unit test for CourseCard in `tests/unit/dashboard-course-card.spec.ts` — assert rendering of title, level chip (German label), formatted dates, participant count, `data-testid="course-card"`
- [ ] T010 [P] [US2] Write unit test for MaterialCard in `tests/unit/dashboard-material-card.spec.ts` — assert rendering of status chip (Generiert/Nicht generiert), slide count, formatted date, `data-testid="material-card"`

### Implementation for US2

- [ ] T011 [P] [US2] Create CourseCard component in `src/app/components/dashboard/section-a-course-card.tsx` — `Paper` wrapper, Typography h6 for title, `Chip` for level (Grundkurs/Fortgeschritten/Masterclass), formatted dates (dd.MM.yyyy), participant count
- [ ] T012 [P] [US2] Create MaterialCard client component in `src/app/components/dashboard/section-a-material-card.tsx` — `Paper` wrapper, status `Chip` (success/default color), last updated date, slide count, embed existing `SlideThumbnails` and `SlideGenerateButton` components

**Checkpoint**: Section A renders two cards side-by-side with real data from Hemera API and local filesystem.

---

## Phase 4: User Story 3 — Section B: Participants & Slides (Priority: P2)

**Goal**: Two side-by-side lists showing participant preparation cards (with avatars, expandable details) and slide file list.

**Independent Test**: Participants list renders compact cards with avatars and expand/collapse. Slides list renders filenames with links. Both handle empty states.

### Unit Tests for US3

- [ ] T013 [P] [US3] Write unit test for ParticipantsList in `tests/unit/dashboard-participants-list.spec.ts` — assert one item per participant, Avatar with initials, expand/collapse for detail fields, empty state "Keine Teilnehmer.", `data-testid="participants-list"`
- [ ] T014 [P] [US3] Write unit test for SlidesList in `tests/unit/dashboard-slides-list.spec.ts` — assert one item per file, filename displayed, clickable link, empty state "Keine Folien generiert.", `data-testid="slides-list"`

### Implementation for US3

- [ ] T015 [P] [US3] Create ParticipantsList client component in `src/app/components/dashboard/section-b-participants-list.tsx` — `Paper` wrapper, heading "Teilnehmer & Vorbereitungen", MUI `List` with compact cards (Avatar with initials + deterministic color, name, completion status), expandable detail panel (preparation intent, desired results, line manager profile), empty state
- [ ] T016 [P] [US3] Create SlidesList component in `src/app/components/dashboard/section-b-slides-list.tsx` — `Paper` wrapper, heading "Kursfolien", MUI `List` with one row per file (filename, clickable link), empty state

**Checkpoint**: Section B renders two lists side-by-side. Participant cards expand/collapse. Slides list links to preview files.

---

## Phase 5: User Story 4 — Section C & D: Steuerung & Kamera (Priority: P3)

**Goal**: Steuerung endpoint cards and a dedicated camera section below.

**Independent Test**: Steuerung cards render for all endpoints with status chips. Camera card renders with existing CameraSnapshot component.

### Unit Tests for US4

- [ ] T017 [P] [US4] Write unit test for SteuerungCards in `tests/unit/dashboard-steuerung-cards.spec.ts` — assert cards rendered for all endpoints, each showing path/method/status chip, responsive grid layout, `data-testid="steuerung-cards"`
- [ ] T017b [P] [US4] Write unit test for CameraSection in `tests/unit/dashboard-camera-card.spec.ts` — assert heading “Kamera” rendered, CameraSnapshot component embedded, `data-testid="camera-card"`

### Implementation for US4

- [ ] T018 [US4] Create SteuerungCards client component in `src/app/components/dashboard/section-c-steuerung-cards.tsx` — heading "Steuerung", responsive grid of `Paper` cards (`{ xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }`), each card showing endpoint path, HTTP method, status `Chip` (OK/Error/Loading), reuse health check logic from existing `EndpointStatus` component
- [ ] T019 [P] [US4] Create CameraSection component in `src/app/components/dashboard/section-d-camera-card.tsx` — `Paper` wrapper, heading "Kamera", embed existing `CameraSnapshot` component, `data-testid="camera-card"`

**Checkpoint**: Section C shows endpoint cards in responsive grid. Section D shows camera snapshot.

---

## Phase 6: User Story 5 — Page Composition & Layout (Priority: P1)

**Goal**: Refactor `page.tsx` to compose all four sections (A–D) using CSS Grid layout with Hemera spacing.

**Independent Test**: All four sections render on desktop and mobile viewports. CSS Grid layout applies two-column on md+, single-column on xs.

### E2E Test for US5

- [ ] T020 [US5] Write E2E test for dashboard layout in `tests/e2e/dashboard-layout.spec.ts` — verify all four sections visible on desktop (1200px) and mobile (375px) viewports, all `data-testid` attributes present, cards side-by-side on desktop, single-column on mobile

### Implementation for US5

- [ ] T021 [US5] Refactor `src/app/page.tsx` — replace flat table layout with four sections: Section A (CSS Grid `{ xs: '1fr', md: '1fr 1fr' }` with CourseCard + MaterialCard), Section B (CSS Grid `{ xs: '1fr', md: '1fr 1fr' }` with ParticipantsList + SlidesList), Section C (SteuerungCards), Section D (CameraSection). Use MUI `Container maxWidth="lg"`, inter-section spacing `mb: { xs: 4, md: 6 }`, `align-items: stretch` for equal-height cards. Keep existing SSR data fetching (fetchNextCourseDetail, fetchSlideStatus) and error/empty state alerts.

**Checkpoint**: Dashboard fully composed with all sections, responsive layout, Hemera theme applied.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, error handling, and cleanup

### Validation

- [ ] T022 Run all unit tests via `npx vitest run tests/unit/dashboard-*.spec.ts tests/unit/theme-tokens.spec.ts` and fix any failures
- [ ] T023 Run E2E test via `npx playwright test tests/e2e/dashboard-layout.spec.ts` and fix any failures
- [ ] T024 [P] Run Biome formatting and linting via `npm run lint` — fix any violations in new files
- [ ] T025 [P] Run TypeScript type check via `npx tsc --noEmit` — fix any type errors
- [ ] T026 Verify production build via `npm run build` — ensure no build errors
- [ ] T027 Run quickstart.md validation — verify all steps in `specs/007-dashboard-design/quickstart.md` work end-to-end

### Error Handling (Constitution VI)

- [ ] T028 [US5] Create App Router error boundary in `src/app/error.tsx` — client component with Rollbar error reporting via `serverInstance.error()`, user-facing fallback UI with retry button, German error message
- [ ] T029 [P] [US5] Create global error boundary in `src/app/global-error.tsx` — catches root layout errors, minimal HTML fallback with Rollbar reporting

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all section work
- **US2 Section A (Phase 3)**: Depends on Foundational (Phase 2)
- **US3 Section B (Phase 4)**: Depends on Foundational (Phase 2) — can run in parallel with Phase 3
- **US4 Section C+D (Phase 5)**: Depends on Foundational (Phase 2) — can run in parallel with Phases 3–4
- **US5 Page Composition (Phase 6)**: Depends on ALL section components (Phases 3–5) being complete
- **Polish (Phase 7)**: Depends on Page Composition (Phase 6)

### User Story Dependencies

- **US1 (Theme)**: Foundational — blocks all others
- **US2 (Section A)**: Independent after US1 — no dependency on US3/US4
- **US3 (Section B)**: Independent after US1 — no dependency on US2/US4
- **US4 (Section C+D)**: Independent after US1 — no dependency on US2/US3
- **US5 (Composition)**: Depends on US2 + US3 + US4 all being complete

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Constitution I)
- Implementation follows contracts defined in `contracts/components.md`
- Each story independently testable before composition

### Parallel Opportunities

**After Phase 2 (Foundational) completes, all three section phases can run in parallel:**

```
Phase 2 complete (Theme) →
  ├── Phase 3: US2 Section A (T009–T012)
  ├── Phase 4: US3 Section B (T013–T016)
  └── Phase 5: US4 Section C+D (T017–T019)
       ↓ all complete ↓
  Phase 6: US5 Page Composition (T020–T021)
```

**Within each phase, [P]-marked tasks can run in parallel:**
- T009 + T010 (Section A tests)
- T011 + T012 (Section A components)
- T013 + T014 (Section B tests)
- T015 + T016 (Section B components)
- T017 + T017b (Section C+D tests)
- T018 + T019 (Section C+D components, different files)

---

## Implementation Strategy

### MVP First (Theme + Section A + Page Composition)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Theme Infrastructure (T004–T008)
3. Complete Phase 3: Section A (T009–T012)
4. Skip to Phase 6: Compose page with Section A only
5. **VALIDATE**: Dashboard shows course + material cards with Hemera theme

### Incremental Delivery

1. Setup + Theme → Foundation ready
2. Add Section A → Course + Material visible (MVP)
3. Add Section B → Participants + Slides visible
4. Add Section C+D → Steuerung + Kamera visible
5. Compose full page → All sections integrated
6. Polish → Tests pass, build succeeds, quality gates green
