# Hemera Academy API Integration — Documentation

## Overview

This project integrates the Hemera Academy API into the Aither platform. It synchronizes HTML templates and participant data, embeds media, transmits recordings, performs daily automatic syncs, monitors errors and status, and provides an admin dashboard. The implementation strictly follows TDD (Test-First) and is fully covered with unit, contract, and E2E tests.

---

## Architecture

- **Framework:** Next.js 15.5.6, React 18, TypeScript 5
- **Core Modules:**
  - `src/lib/hemera/`: API client, types, schemas
  - `src/lib/sync/`: Orchestrator, hash manifest, mutex, recording transmitter
  - `src/lib/html/`: Template populator, writer
  - `src/lib/notifications/`: Email notifications
  - `src/lib/monitoring/`: Rollbar integration, logging
  - `src/lib/auth/`: Role-based authentication
  - `src/app/api/`: API routes for sync and recordings
  - `src/app/(dashboard)/sync/`: Admin dashboard (status, trigger)
  - `output/`: Generated HTML files and manifest
  - `tests/`: Unit, contract, and E2E tests

---

## Key Features

1. **Data Sync:**
   - Fetches templates, seminars, lessons, users, texts, media from hemera.academy
   - Populates HTML templates with participant data
   - Writes HTML files atomically to `output/`
   - Hash manifest for incremental sync (only changed files)

2. **Media Embedding:**
   - Handlebars helpers for images and videos with fallback

3. **Recording Transmission:**
   - API `/api/recordings` accepts MUX URLs and forwards them to Hemera

4. **Automatic Sync:**
   - Cron trigger (e.g., daily at 2 AM)
   - Mutex prevents parallel syncs

5. **Error Handling & Monitoring:**
   - Rollbar logging with PII filter
   - Email notification after multiple consecutive failures
   - Sync status and error history via API and dashboard

6. **Access Control:**
   - Clerk authentication
   - Only admins may use sync/recordings/dashboard

7. **Polish & Quality:**
   - JSDoc for all public functions
   - Biome formatting and linting
   - E2E test (Playwright): end-to-end sync
   - Performance test: 500 records < 5 minutes

---

## Setup & Operation

1. **Installation:**
   - `npm install`
   - Create `.env` from `.env.example` and configure
2. **Development:**
   - `npx vitest` (unit/contract tests)
   - `npx playwright test` (E2E)
   - `npx biome check .` (format/lint)
3. **Trigger Sync:**
   - POST `/api/sync` (admin only)
   - GET `/api/sync` (status)
4. **Transmit Recording:**
   - POST `/api/recordings` (admin only)
5. **Dashboard:**
   - `/sync` (admin only, status & trigger)
6. **Automatic Sync:**
   - Cron job example: `0 2 * * * curl -s -X POST http://localhost:3000/api/sync -H "Authorization: Bearer $AITHER_SYNC_TOKEN"`

---

## Tests & Quality Assurance

- **TDD:** All features are developed test-first
- **Test Types:**
  - Unit tests: Core logic, validation, error cases
  - Contract tests: API conformance
  - E2E tests: Full flow (Playwright)
  - Performance test: Sync with 500 records < 5 minutes
- **Linting/Formatting:** Biome enforced
- **Security:** PII filter, no API keys in client, auth required for all critical endpoints

---

## Extension & Maintenance

- New templates/entities: Add types and schemas in `src/lib/hemera/`
- Additional sync logic: Extend orchestrator
- Additional dashboards/views: Create under `src/app/(dashboard)/`
- Errors/monitoring: Use Rollbar and email integration

---

## Authors & Support

- Lead development: Andreas (Aither)
- For questions/issues: See README.md or project contact

---

## Changelog (Summary)

- v1.0: Initial integration, all user stories, full test coverage, performance validated

---

**Last Updated:** 2026-02-12
