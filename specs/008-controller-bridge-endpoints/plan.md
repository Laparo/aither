# Implementation Plan: 008 — Controller Bridge Endpoints

**Branch**: `008-controller-bridge-endpoints` | **Date**: 2026-05-31 | **Spec**: `specs/008-controller-bridge-endpoints/spec.md`
**Input**: Feature specification from `/specs/008-controller-bridge-endpoints/spec.md`

## Summary

Implement two server endpoints in Aither to unblock Gaia controller integration:
`GET /api/slides/controller` for manifest retrieval and `POST /api/slides/controller/navigation` for deterministic `previous`/`next` transitions. The implementation reuses existing slide generation/output conventions, keeps authentication server-side, and introduces contract-focused tests for positive and negative paths.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js App Router (server routes)  
**Primary Dependencies**: Next.js route handlers, existing Aither slide modules, Zod, Vitest  
**Storage**: Filesystem-backed slide artifacts and metadata, no new database tables  
**Testing**: Vitest (unit/contract), optional integration route tests  
**Target Platform**: Node.js service runtime on Linux/macOS  
**Project Type**: Single web application (Next.js app + lib + tests)  
**Performance Goals**: Manifest read p95 < 300 ms, navigation mutation p95 < 250 ms in local integration tests  
**Constraints**: Deterministic slide ordering, optimistic conflict handling via `fromIndex`, no secret leakage in responses/logs  
**Scale/Scope**: 1 new route group with 2 endpoints, shared controller DTOs, tests, docs

Performance targets are treated as acceptance gates and must be validated with a dedicated measurement task in `tasks.md` before implementation sign-off.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Test-first implementation | PASS | Contract and route tests defined before endpoint code tasks. |
| Stateless architecture | PASS | Uses existing generated slide/material state only. |
| Error handling and observability | PASS | Structured error bodies and correlation-friendly logging are part of core requirements. |
| Security | PASS | Existing auth guard reused; no tokens/secrets in payloads/logs. |

**Gate Result**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/008-controller-bridge-endpoints/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── controller-endpoints.openapi.yaml
│   └── controller-endpoints.contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/api/slides/controller/
│   ├── route.ts
│   └── navigation/route.ts
└── lib/slides/
    ├── controller-manifest.ts
    ├── controller-navigation.ts
    └── controller-types.ts

tests/
├── contracts/
│   └── controller-endpoints.spec.ts
└── unit/
    ├── controller-manifest.spec.ts
    └── controller-navigation.spec.ts
```

**Structure Decision**: Keep implementation in existing Next.js route surface under `src/app/api/slides/` with dedicated controller helpers in `src/lib/slides/` to avoid route-level business logic duplication.

## Complexity Tracking

No constitution violations detected.
