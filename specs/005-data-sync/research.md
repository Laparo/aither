# Research: Data Synchronization

**Feature**: 005-data-sync
**Status**: Complete
**Date**: 2026-02-21

## Research Tasks

Seven unknowns were identified from the Technical Context during plan creation. All are now resolved.

---

### 1. Next-Course Selection Strategy

**Question**: How does Aither determine the "next upcoming course" from Hemera's course list?

**Decision**: Client-side filtering via a pure function `selectNextCourse(courses)`.

**Rationale**:
- Hemera's `GET /api/service/courses` already returns all courses sorted by `startDate ASC`.
- A pure function is easily testable without HTTP mocking.
- No Hemera API changes required.
- Filter: `startDate > now()`, then take the first result (earliest future date).

**Alternatives considered**:
- Server-side filter (Hemera `?upcoming=true`): Would require Hemera endpoint modification. Rejected to avoid cross-repo coupling for a simple filter.
- `limit=1` with date filter: Hemera doesn't support explicit date-range query params yet.

---

### 2. Participant Data Retrieval

**Question**: How does Aither get participant preparations for the selected course?

**Decision**: Extend Hemera's `GET /api/service/courses/[id]` endpoint to include preparation fields and participant names in its Prisma select.

**Rationale**:
- The current endpoint returns participations with only `id, status, createdAt` — missing `preparationIntent`, `desiredResults`, `lineManagerProfile`, `preparationCompletedAt`.
- Fetching each participant individually via `GET /api/service/participations/[id]` would be N+1 queries — inefficient.
- A single enriched endpoint keeps the Aither pipeline simple (1 list call + 1 detail call = 2 HTTP requests total per sync).

**Required Hemera change** (tracked separately):

```typescript
// In app/api/service/courses/[id]/route.ts, extend Prisma select:
bookings: {
  select: {
    id: true,
    userId: true,
    user: { select: { name: true } },          // NEW: participant name
    participation: {
      select: {
        id: true,
        status: true,
        preparationIntent: true,                // NEW
        desiredResults: true,                   // NEW
        lineManagerProfile: true,               // NEW
        preparationCompletedAt: true,           // NEW
        createdAt: true,
      },
    },
  },
},
```

**Alternatives considered**:
- New batch endpoint `GET /api/service/courses/[id]/participations`: More RESTful but unnecessary complexity when the detail endpoint can embed this data.
- Individual `GET /api/service/participations/[id]` per participant: N+1 problem; rejected for performance.

---

### 3. Participant Name Resolution

**Question**: How does Aither show participant names when Hemera's participation model only stores `userId`?

**Decision**: The Hemera course detail endpoint joins `booking.user.name` and exposes it in the response.

**Rationale**:
- `CourseParticipation` -> `Booking` -> `User.name` is a 2-hop join, simple in Prisma.
- Aither should not need to make separate user lookups.
- The name is included directly in the course detail response per participant.

**Alternatives considered**:
- Separate `GET /api/service/users/[id]` calls: N+1 problem; rejected.
- Aither stores user mapping locally: Violates Constitution VII (stateless).

---

### 4. Two Rendering Paths

**Question**: Does the homepage render from `output/` files or live from the API?

**Decision**: **Live SSR via HemeraClient** (confirmed in speckit.clarify Session 2026-02-21).

**Rationale**:
- The homepage (`page.tsx`) is a React Server Component that fetches live data on every request.
- `output/` files are solely for the fullscreen HTML player (different use case).
- This means the homepage is always up-to-date without waiting for a sync run.

**Implication**: The sync pipeline and homepage share the `HemeraClient` and `selectNextCourse()` logic but diverge at the output stage:
- Sync: Handlebars template -> static HTML -> `output/`
- Homepage: React JSX -> server-rendered HTML -> HTTP response

---

### 5. Hash Scope for Content Detection

**Question**: What data is included in the content hash for change detection?

**Decision**: Hash the entire course detail response including all participant preparations.

**Rationale**:
- `computeContentHash()` from `hash-manifest.ts` already uses `JSON.stringify` with sorted keys + SHA-256.
- Including participant data means a preparation change triggers regeneration (required by US2-AS3).
- The hash covers: `{ course: { id, title, slug, level, startDate, endDate }, participants: [{ name, preparationIntent, desiredResults, lineManagerProfile, preparationCompletedAt }] }`.

**Alternatives considered**:
- Separate hashes per participant: More granular but increases manifest complexity. The single-course scope makes one hash sufficient.
- Hash only course fields: Would miss preparation changes; rejected per US2-AS3.

---

### 6. No Upcoming Course Edge Case

**Question**: What happens when no future courses exist?

**Decision**: Sync succeeds with 0 files generated, existing output preserved, response includes `"noUpcomingCourse": true` (confirmed in speckit.clarify Session 2026-02-21).

**Rationale**:
- Destroying existing output when no future course is found would be destructive and unhelpful.
- An explicit flag in the response lets operators detect the condition programmatically.
- The manifest is not modified (existing hashes remain valid for whatever was last synced).

---

### 7. Sync Metrics and Observability

**Question**: Should the sync capture metrics beyond the API response?

**Decision**: Structured Rollbar `info`-level log event per sync (confirmed in speckit.clarify Session 2026-02-21).

**Rationale**:
- The API response already includes sync stats for the caller.
- A Rollbar log provides persistent, queryable history of sync operations.
- `info` level avoids alert noise while remaining filterable.

**Log structure**:

```typescript
rollbar.info('sync.completed', {
  durationMs: number,
  filesGenerated: number,
  filesSkipped: number,
  participantCount: number,
  courseId: string | null,
  noUpcomingCourse: boolean,
  errors: string[],
});
```

---

## Existing Infrastructure Analysis

| Component | File | Status | Action for 005 |
|-----------|------|--------|-----------------|
| `HemeraClient` | `src/lib/hemera/client.ts` | Complete | Reuse as-is. `get()` for courses, `put()` for results. |
| `ServiceCourseSchema` | `src/lib/hemera/schemas.ts` | Complete | Reuse. Matches `GET /api/service/courses` response. |
| `ServiceCourseDetailSchema` | -- | Missing | **Create** new Zod schema for enriched courses/[id] response. |
| `SyncOrchestrator` | `src/lib/sync/orchestrator.ts` | Refactor | Current pipeline is 001-specific (6 entity types). Add new `runDataSync()` method. |
| `hash-manifest.ts` | `src/lib/sync/hash-manifest.ts` | Complete | Reuse `computeContentHash()`, `diffManifest()`, `readManifest()`, `writeManifest()`. |
| `SyncJob` type | `src/lib/sync/types.ts` | Extend | Add `participantsFetched`, `courseId`, `noUpcomingCourse` fields. |
| `populateTemplate()` | `src/lib/html/populator.ts` | Complete | Reuse for Handlebars HTML generation. |
| `writeHtmlFile()` | `src/lib/html/writer.ts` | Complete | Reuse for atomic file writes. |
| Sync API route | `src/app/api/sync/route.ts` | Modify | Update POST handler to invoke new data-sync pipeline. |
| Homepage | `src/app/page.tsx` | Modify | Add next-course selection + participant table (SSR). |

### Hemera Endpoint Status

| Endpoint | Current Fields | Missing for 005 | Action |
|----------|---------------|-----------------|--------|
| `GET /api/service/courses` | id, title, slug, level, startDate, endDate, participantCount | -- | None (sufficient for course selection) |
| `GET /api/service/courses/[id]` | id, title, slug, level, startDate, endDate, participations: [id, status, createdAt] | preparationIntent, desiredResults, lineManagerProfile, preparationCompletedAt, user.name | **Extend Prisma select** |
| `GET /api/service/participations/[id]` | All detail fields | -- | None (fallback, not primary path) |
| `PUT /api/service/participations/[id]/result` | resultOutcome, resultNotes, complete | -- | None (write-back channel works) |

---

## Open Questions

All resolved. No remaining unknowns.
