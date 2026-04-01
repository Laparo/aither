# Implementation Plan: 007 — Dashboard Design

**Branch**: `007-dashboard-design` | **Date**: 2026-03-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-dashboard-design/spec.md`

## Summary

Redesign the Aither dashboard (`src/app/page.tsx`) from a flat table-based layout into a structured four-section card-based composition (A: Course + Material, B: Participants + Slides, C: Steuerung, D: Kamera). Adopt the Hemera design system (MUI theme, design tokens, ThemeRegistry pattern, CSS variables, Google Fonts) to ensure visual coherence between both applications. All data sources remain unchanged (Hemera API + local filesystem); this is a pure UI/layout restructuring with design system integration.

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 16, React 19  
**Primary Dependencies**: MUI 7 (`@mui/material`), Emotion 11, `@mui/material-nextjs` App Router integration  
**Storage**: N/A — stateless; data from Hemera API (course/participants) + local filesystem (slides)  
**Testing**: Vitest for unit tests, Playwright for E2E  
**Target Platform**: Self-hosted Linux service (development on macOS, port 3001)  
**Project Type**: Single Next.js web application  
**Performance Goals**: Dashboard SSR render < 500 ms; no CLS from card layout shifts  
**Constraints**: No local database (Constitution VII); all data fetched from Hemera API or local filesystem  
**Scale/Scope**: Single page redesign + 6 new dashboard components + 3 theme infrastructure files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ PASS | Unit tests for each new component (Card, List, Section). Contract tests for component rendering before implementation. |
| II. Code Quality & Formatting | ✅ PASS | Biome formatting enforced. TypeScript strict mode active. |
| III. Feature Development Workflow | ✅ PASS | Spec written first; contracts defined in this plan before implementation. |
| IV. Authentication & Security | ✅ PASS | No new auth surfaces. Existing Hemera API auth unchanged. PII filtering maintained. |
| V. Component Architecture | ✅ PASS | Hemera design system adopted: MUI theme, design tokens, ThemeRegistry, CSS variables, fonts. WCAG 2.1 AA for all interactive elements. |
| VI. Holistic Error Handling | ⚠️ PARTIAL | App Router error.tsx + global-error.tsx to be added (T028–T029). Rollbar server-side already active. Graceful degradation when Hemera API unavailable (existing error/empty alerts in page.tsx). |
| VII. Stateless Architecture | ✅ PASS | No local database. Dashboard fetches from Hemera API + reads local slide files. No new persistence. |
| VIII. HTML Playback | ⬜ N/A | No playback changes. |
| IX. Aither Control API | ⬜ N/A | No API changes. |
| X. Language Policy | ✅ PASS | All code and comments in English. UI labels remain German (user-facing). |

**Gate result: PASS** — No violations. Proceeding to Phase 0.

### Post-Design Re-Check (after Phase 1)

All principles re-evaluated after design artifacts produced:

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. Test-First | ✅ PASS | Component contracts defined with test assertions. 7 unit test files + 1 E2E test planned. |
| II. Code Quality | ✅ PASS | All new files will pass Biome. TypeScript strict mode. |
| III. Feature Workflow | ✅ PASS | research.md, data-model.md, contracts/components.md, quickstart.md all produced. |
| V. Component Architecture | ✅ PASS | Full Hemera design system replicated: tokens, theme, ThemeRegistry, CSS vars, fonts. |
| VII. Stateless Architecture | ✅ PASS | No new persistence introduced. Data model confirms read-only consumption. |
| X. Language Policy | ✅ PASS | All contract/component code in English. German only in UI labels. |

**Post-design gate result: PASS** — No new violations.

## Project Structure

### Documentation (this feature)

```text
specs/007-dashboard-design/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── components.md    # Component interface contracts
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── page.tsx                          # Refactored: orchestrates sections A/B/C/D
│   ├── layout.tsx                        # Updated: ThemeRegistry + global CSS
│   ├── globals.css                       # NEW: Hemera CSS variables + font imports
│   └── components/
│       ├── dashboard/
│       │   ├── section-a-course-card.tsx      # NEW: Course info card
│       │   ├── section-a-material-card.tsx    # NEW: Material status card
│       │   ├── section-b-participants-list.tsx # NEW: Participant list with avatars
│       │   ├── section-b-slides-list.tsx      # NEW: Slide file list
│       │   ├── section-c-steuerung-cards.tsx  # NEW: Endpoint status cards
│       │   └── section-d-camera-card.tsx      # NEW: Camera snapshot card
│       ├── theme/
│       │   ├── design-tokens.ts              # NEW: Hemera design tokens (UI)
│       │   ├── theme.ts                      # NEW: MUI theme configuration
│       │   └── ThemeRegistry.tsx             # NEW: Emotion + ThemeProvider wrapper
│       ├── camera-snapshot.tsx           # Existing (unchanged)
│       ├── endpoint-status.tsx           # Existing (data logic reused)
│       ├── slide-generate-button.tsx     # Existing (unchanged)
│       └── slide-thumbnails.tsx          # Existing (unchanged)
└── lib/
    └── (no changes — data fetching logic stays in page.tsx as SSR)

tests/
├── unit/
│   ├── dashboard-course-card.spec.ts         # NEW
│   ├── dashboard-material-card.spec.ts       # NEW
│   ├── dashboard-participants-list.spec.ts   # NEW
│   ├── dashboard-slides-list.spec.ts         # NEW
│   ├── dashboard-steuerung-cards.spec.ts     # NEW
│   ├── dashboard-camera-card.spec.ts         # NEW
│   └── theme-tokens.spec.ts                  # NEW
└── e2e/
    └── dashboard-layout.spec.ts              # NEW
```

**Structure Decision**: Single project layout. New components placed under `src/app/components/dashboard/` for feature grouping. Theme infrastructure under `src/app/components/theme/`. All existing components remain untouched; data fetching stays in the Server Component (`page.tsx`).

## Complexity Tracking

Partial constitution compliance — Principle VI (Holistic Error Handling) has ⚠️ PARTIAL status: App Router `error.tsx` + `global-error.tsx` are planned (T028–T029) but not yet implemented. This is accepted because error boundaries are explicitly scheduled in Phase 7 and do not block earlier phases.
