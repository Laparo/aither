# Implementation Plan: 006 — Participant Slides

**Branch**: `006-participant-slides` | **Date**: 2026-02-27 | **Spec**: `specs/006-participant-slides/spec.md`
**Input**: Feature specification from `/specs/006-participant-slides/spec.md`

## Summary

Extend the existing slide generation pipeline (`src/lib/slides/`) with a **lightweight template engine** that replaces `{}`-style placeholders with course and participant data from the Hemera Service API. The engine supports two replacement modes:

- **Mode A (Section Iteration)**: `<section class="slide">` blocks serve as template units; collection placeholders trigger iteration (1 section × N participants → N slides).
- **Mode B (Identifier Distribution)**: A single `CourseMaterial` template linked N times in the curriculum via `CurriculumTopicMaterial` produces N instances, each assigned one participant sequentially.

Materials HTML and participant data are fetched from the Hemera Service API (`/api/service/courses/{id}/materials` and `/api/service/courses/{id}`). No local database (Constitution Principle VII). Output: HTML files in `output/slides/{courseId}/`.

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 16.1.6, React 19  
**Primary Dependencies**: Zod (validation), Rollbar (monitoring), HemeraClient (API access), Vitest (testing)  
**Storage**: N/A — stateless, output as HTML files to `output/slides/{courseId}/` (Principle VII)  
**Testing**: Vitest (unit + contract), Playwright (E2E)  
**Target Platform**: Linux service (self-hosted), development on macOS  
**Project Type**: Single project (Next.js App Router)  
**Performance Goals**: Slide generation for a course with 20 participants + 10 materials in <5s  
**Constraints**: No local database, no Handlebars dependency for slide engine, HTML-escaped output  
**Scale/Scope**: ~6-12 materials per course, ~6-20 participants, ~50-200 slides per generation run

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Test-First (NON-NEGOTIABLE)** | ✅ PASS | Contract tests for template engine, section parser, mode detection, and Mode B distribution will be written before implementation. Unit tests for every new function. |
| **II. Code Quality & Formatting** | ✅ PASS | Biome enforced, strict TypeScript, pre-commit hooks. |
| **III. Feature Development Workflow** | ✅ PASS | Spec exists (`spec.md`), contracts defined before implementation. |
| **IV. Authentication & Security** | ✅ PASS | HTML-escaped output (XSS protection), Rollbar for errors, no PII in logs. |
| **V. Component Architecture** | ✅ PASS (N/A) | No UI components — server-side generation pipeline only. |
| **VI. Error Handling & Observability** | ✅ PASS | Materials-API errors → skip + Rollbar log. `slides.generated` structured event. |
| **VII. Stateless Architecture (NON-NEGOTIABLE)** | ✅ PASS | No local database. Fetch → Transform → Output HTML files. |
| **VIII. HTML Playback & Video Recording** | ✅ PASS (N/A) | Slides are HTML output, consumed by separate playback system. |
| **IX. Aither Control API** | ✅ PASS (N/A) | No new API endpoints — extends existing generator. |
| **X. Language Policy** | ✅ PASS | Code, comments, docs in English. German only in user-facing slide content (template placeholders). |

**Gate Result**: ALL PASS — proceed to Phase 0.

### Post-Design Re-Check (after Phase 1)

All Phase 1 artifacts validated against Constitution:
- **I**: 4 contract files with ~40 test cases defined before implementation.
- **IV**: `escapeHtml()` explicitly tested in template-engine and identifier-distribution contracts.
- **VI**: `SlideGenerationEvent` entity defined in data-model.md; Rollbar error handling in contracts.
- **VII**: All entities are in-memory TypeScript types — no database tables.
- **X**: All contracts/docs in English; German strings only in test fixture data.

**Post-Design Gate**: ALL PASS — proceed to Phase 2 (`/speckit.tasks`).

## Project Structure

### Documentation (this feature)

```text
specs/006-participant-slides/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── template-engine.contract.ts
│   ├── section-parser.contract.ts
│   ├── mode-detection.contract.ts
│   └── identifier-distribution.contract.ts
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/lib/slides/
├── course-resolver.ts       # EXISTING — extend with getNextCourseWithParticipants()
├── generator.ts             # EXISTING — extend with template-based material processing
├── html-layout.ts           # EXISTING — reuse wrapInLayout()
├── slide-builder.ts         # EXISTING — reuse existing builders
├── types.ts                 # EXISTING — extend with SlideContext, TemplateSection, etc.
├── utils.ts                 # NEW — shared escapeHtml() utility (extracted from html-layout.ts)
├── template-engine.ts       # NEW — placeholder parsing + replacement
├── section-parser.ts        # NEW — <section class="slide"> extraction
├── mode-detector.ts         # NEW — Mode A / Mode B / scalar-only detection
├── identifier-distributor.ts # NEW — Mode B distribution logic
└── slide-context.ts         # NEW — buildSlideContext() from ServiceCourseDetail

src/lib/hemera/
├── schemas.ts               # EXISTING — add ServiceMaterialsResponseSchema
└── client.ts                # EXISTING — reuse HemeraClient

tests/unit/
├── template-engine.spec.ts       # NEW
├── section-parser.spec.ts        # NEW
├── mode-detector.spec.ts         # NEW
├── identifier-distributor.spec.ts # NEW
├── slide-context.spec.ts         # NEW
└── slide-generator.spec.ts       # EXISTING — extend

tests/contract/
└── (contract tests from contracts/ directory)
```

**Structure Decision**: Single project structure. All new modules added to existing `src/lib/slides/` namespace. Tests mirror the source structure in `tests/unit/`. No new directories needed outside the existing pattern.

## Complexity Tracking

> No Constitution violations — section not applicable.
