# Implementation Plan: Hemera Academy API Integration

**Branch**: `001-hemera-api-integration` | **Date**: 2026-02-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-hemera-api-integration/spec.md`

## Summary

Integrate Aither with the hemera.academy REST API to: (1) fetch HTML templates and participant/content data, (2) populate templates with participant data to generate one HTML file per entity, (3) expose an endpoint for transmitting MUX seminar recording URLs back to the hemera.academy API. Sync runs daily via system cron with full-fetch + content-hash-based incremental regeneration. Operators access sync status via an authenticated dashboard (Clerk RBAC) and receive email alerts on repeated failures. No local database — Aither is a stateless transformation layer.

## Technical Context

**Language/Version**: TypeScript 5+, Node.js (Next.js 16+ with App Router, React 18+)
**Primary Dependencies**: Zod (validation), Clerk (auth/RBAC), MUI (dashboard UI), Rollbar (error monitoring), Nodemailer (SMTP email notifications)
**Storage**: None (stateless — HTML files generated to filesystem; JSON manifest for content hashes; no database)
**Testing**: Vitest for unit/contract tests, Playwright for E2E
**Target Platform**: Linux server (systemd service), self-hosted
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: Sync completes within minutes for ~hundreds of records; dashboard loads <2s
**Constraints**: No local database (Constitution VII — NON-NEGOTIABLE); no cloud deployment; HTML templates authored externally on hemera.academy
**Scale/Scope**: Low hundreds of records across all entity types; single operator; single Linux host

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First (NON-NEGOTIABLE) | ✅ PASS | Contract tests for Hemera API client, Zod schemas, template population. TDD cycle enforced. |
| II. Code Quality & Formatting | ✅ PASS | Biome formatting/linting, Husky pre-commit, strict TypeScript. |
| III. Feature Development Workflow | ✅ PASS | Spec-first (this plan), contract-first (Phase 1 contracts/), Rollbar integrated. |
| IV. Authentication & Security | ✅ PASS | Clerk for dashboard RBAC, API key as env secret, PII filtering in logs. |
| V. Component Architecture | ✅ PASS | MUI dashboard components, accessible, lazy-loaded. |
| VI. Error Handling & Observability | ✅ PASS | Rollbar integration, retry with backoff, circuit breaker for API, email alerts, Zod validation. |
| VII. Stateless Architecture (NON-NEGOTIABLE) | ✅ PASS | No database. Fetch → populate templates → HTML files. MUX URLs passed directly to API. Hash manifest on filesystem only. |
| VIII. HTML Playback & Video Recording | ✅ N/A | Out of scope for Feature 001. Separate feature. |
| IX. Aither Control API | ✅ N/A | Out of scope for Feature 001. Separate feature. |

**Gate Result: PASS — no violations.**

## Project Structure

### Documentation (this feature)

```text
specs/001-hemera-api-integration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   ├── sync/
│   │   │   └── route.ts              # POST: trigger sync, GET: sync status
│   │   └── recordings/
│   │       └── route.ts              # POST: receive MUX URL, forward to Hemera API
│   └── (dashboard)/
│       └── sync/
│           └── page.tsx              # Sync status dashboard (Clerk-protected)
├── lib/
│   ├── hemera/
│   │   ├── client.ts                 # Hemera API HTTP client (auth, throttling, retry)
│   │   ├── schemas.ts                # Zod schemas for API response validation
│   │   └── types.ts                  # TypeScript types for Hemera entities
│   ├── sync/
│   │   ├── orchestrator.ts           # Sync job orchestration (fetch → populate → write)
│   │   ├── hash-manifest.ts          # Content hash computation & comparison (JSON manifest)
│   │   └── recording-transmitter.ts  # MUX URL → Hemera API transmission logic
│   ├── html/
│   │   ├── populator.ts              # Template population engine (template + data → HTML)
│   │   └── writer.ts                 # HTML file writer (filesystem output)
│   └── notifications/
│       └── email.ts                  # SMTP email notifications (Nodemailer)
└── output/                           # Generated HTML files (gitignored)

tests/
├── contract/
│   ├── hemera-api.contract.spec.ts  # Contract tests against Hemera API (from Postman Collection)
│   └── sync-api.contract.spec.ts     # Contract tests for Aither sync endpoints
├── unit/
│   ├── hemera-client.spec.ts
│   ├── sync-orchestrator.spec.ts
│   ├── hash-manifest.spec.ts
│   ├── template-populator.spec.ts
│   ├── recording-transmitter.spec.ts
│   └── email-notifications.spec.ts
└── e2e/
    └── sync-flow.spec.ts             # Full sync E2E (Playwright)
```

**Structure Decision**: Next.js App Router web application. API routes handle sync triggers and MUX URL reception. Shared libraries in `lib/` for hemera client, sync orchestration, template population, and notifications. Dashboard UI in route group `(dashboard)/`. Generated HTML output in `output/` (gitignored).
