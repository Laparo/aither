# Research: Hemera Academy API Integration

**Feature**: 001-hemera-api-integration  
**Date**: 2026-02-11  
**Phase**: 0 — Outline & Research

---

## Topic 1: HTML Template Population Engine

**Decision**: Handlebars.js with a fallback to simple `{{placeholder}}` string replacement.

**Rationale**: Since hemera.academy authors the templates and we don't control the placeholder format, we need a well-documented, widely-adopted syntax that the hemera.academy team can learn easily. Handlebars' `{{variable}}` syntax is the most recognizable template syntax and auto-escapes HTML by default (XSS prevention). If templates arrive with non-Handlebars placeholders, a lightweight regex-based fallback handles custom token patterns. Handlebars compiles templates to functions, giving excellent performance on repeated renders.

**Alternatives considered**:
- **Mustache**: Logic-less and simpler, but no built-in helpers. Handlebars is a superset and equally simple for basic use. Rejected: no advantage over Handlebars.
- **LiquidJS**: Powerful (Shopify-origin), but heavier dependency and overkill for simple token replacement. Rejected: unnecessary complexity.
- **Cheerio (DOM manipulation)**: Would require templates to use data attributes instead of text placeholders. Rejected: forces a specific template authoring approach on hemera.academy.
- **Regex string replace**: Fragile, no escaping, no nested data support. Rejected as primary engine: kept as fallback only.

**Implementation notes**:
- Install `handlebars` (has `@types/handlebars` built in since v4.x, full TypeScript support)
- Define a `populateTemplate(templateHtml: string, data: Record<string, unknown>): string` function
- Register custom helpers if needed (e.g., date formatting, conditional display)
- Validate that all expected placeholders are populated; log warnings for unresolved tokens
- Coordinate with hemera.academy team on the placeholder convention (document in quickstart.md)

---

## Topic 2: Content Hash Strategy for Incremental Sync

**Decision**: SHA-256 hash of normalized JSON (sorted keys) from API responses. Manifest stored as `output/.sync-manifest.json`.

**Rationale**: SHA-256 is available natively in Node.js (`crypto.createHash`), collision-resistant, and the performance difference vs. faster hashes is negligible at ~hundreds of records. Hashing the normalized API response (not the generated HTML) ensures that template changes AND data changes both trigger regeneration — if either changes, the hash changes. Sorting keys before JSON.stringify ensures deterministic hashes.

**Alternatives considered**:
- **xxHash**: Faster, but requires a native addon or WASM module. Rejected: unnecessary for low volume; adds dependency.
- **MD5**: Fast but cryptographically broken. SHA-256 is equally fast for small payloads via Node.js native crypto. Rejected: no advantage.
- **Hash generated HTML**: Would miss cases where the template changed but data didn't, or vice versa. Rejected: hashing inputs (template + data) is more reliable.

**Implementation notes**:
- Hash input: `JSON.stringify({ template: templateContent, data: entityData }, Object.keys(obj).sort())`
- Manifest schema: `{ "seminar:{id}": "sha256hex", "lesson:{id}": "sha256hex", ... }`
- On sync: compute new hashes → compare with manifest → regenerate only mismatched → write updated manifest
- Manifest lives at `output/.sync-manifest.json` (gitignored with `output/`)
- First sync (no manifest): regenerate everything

---

## Topic 3: API Client Architecture — Throttling & Retry

**Decision**: Native `fetch` (Node.js 18+ built-in) with `p-retry` for retries and `p-throttle` for rate limiting. Adaptive starting rate of 2 req/s.

**Rationale**: Native fetch eliminates external HTTP client dependencies. `p-retry` and `p-throttle` are lightweight, well-maintained, and composable. Starting at 2 req/s with the ability to back off on 429 responses provides defensive throttling without prior knowledge of rate limits. Both libraries have full TypeScript support.

**Alternatives considered**:
- **axios**: Feature-rich but adds a large dependency for features we don't need (interceptors, browser compat). Rejected: native fetch sufficient.
- **got**: Excellent retry built-in, but ESM-only since v12 may cause issues with Next.js config. Rejected: compatibility risk.
- **bottleneck**: Powerful job scheduler with Redis support. Rejected: overkill for single-instance use.
- **Fixed-rate throttling**: Simpler but wasteful when API can handle more. Rejected: adaptive approach is more efficient.

**Implementation notes**:
- `p-throttle`: configure `limit: 2, interval: 1000` (2 req/s initial)
- `p-retry`: configure `retries: 5, minTimeout: 1000, factor: 2, randomize: true` (jitter)
- On HTTP 429: read `Retry-After` header, pause throttle for that duration, log warning
- On HTTP 5xx: retry via p-retry; on 4xx (except 429): fail immediately, log error
- Wrap in `HemeraClient` class: `get<T>(path, schema): Promise<T>` with Zod validation on response
- Service API key in `X-API-Key` header from `process.env.HEMERA_API_KEY` (static API key for M2M auth)

---

## Topic 4: Next.js Route Handler for Sync Trigger

**Decision**: Route handler triggers sync asynchronously (fire-and-forget with in-memory status tracking). Immediate 202 Accepted response with job ID. Status polled via GET endpoint.

**Rationale**: On a self-hosted Next.js deployment, there are no serverless timeout limits — the Node.js process runs indefinitely. However, blocking the HTTP response for minutes is poor practice (cron/client may timeout). Fire-and-forget with a 202 response is the standard REST pattern for long-running operations. In-memory job tracking is acceptable per Constitution VII (transient state).

**Alternatives considered**:
- **Synchronous response**: Blocks until sync completes. Rejected: HTTP client/cron may timeout; poor UX for manual triggers.
- **Background worker process**: Separate Node.js process for sync. Rejected: overengineered for single-host; adds deployment complexity.
- **Database-backed job queue**: e.g., BullMQ + Redis. Rejected: violates Constitution VII (no database/external state store).

**Implementation notes**:
- `POST /api/sync` → validates auth → creates SyncJob in memory → starts `orchestrator.runSync()` → returns `{ jobId, status: "running" }` with 202
- `GET /api/sync` → returns current/last job status from in-memory store
- Mutex via simple in-memory flag: `isSyncRunning`. Reject concurrent sync with 409 Conflict.
- On crash/restart: in-memory state lost (acceptable per Constitution VII). Next cron trigger will re-sync.
- Cron calls: `curl -X POST http://localhost:3000/api/sync -H "Authorization: Bearer $API_KEY"`

---

## Topic 5: Nodemailer SMTP Configuration

**Decision**: Nodemailer with connection pooling, plain-text email body, threshold-based sending (configurable consecutive failure count before notifying).

**Rationale**: Connection pooling avoids repeated SMTP handshakes for multiple notifications. Plain-text emails are more reliable across email clients and simpler to maintain than HTML templates. Threshold-based sending prevents alert fatigue — only notify after N consecutive failures (default: 3).

**Alternatives considered**:
- **Transient connections**: Simpler but slower for bursts. Rejected: pooling has negligible overhead.
- **HTML email templates**: Prettier but harder to maintain and test; delivery issues with some clients. Rejected: plain text is sufficient for operator alerts.
- **External email service (SendGrid, SES)**: More reliable delivery, but adds external dependency. Rejected: conflicts with self-hosted philosophy; SMTP is sufficient for operator alerts.

**Implementation notes**:
- Config via env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `NOTIFY_EMAIL_TO`
- Threshold: `NOTIFY_FAILURE_THRESHOLD=3` (env var, default 3)
- Track consecutive failures in memory (reset on success)
- Email content: subject = `[Aither] Sync failure (${count} consecutive)`, body = timestamp + error summary + last N error messages
- Use `nodemailer.createTransport({ pool: true, ... })` with singleton pattern

---

## Topic 6: Clerk Middleware for API Route Protection

**Decision**: Clerk middleware in `middleware.ts` for page protection; per-route `auth()` checks in API route handlers for role-based access.

**Rationale**: Next.js 16+ Clerk integration uses `clerkMiddleware()` in `middleware.ts` for session management and redirect-based protection of pages. For API routes, `auth()` from `@clerk/nextjs/server` provides the session and role data needed for RBAC checks. This two-layer approach separates concerns: middleware handles session/redirect, route handlers handle authorization.

**Alternatives considered**:
- **Middleware-only (all in middleware.ts)**: Would need to parse roles in middleware for API routes. Rejected: middleware runs on the Edge runtime with limited API; role checks are simpler in route handlers.
- **Per-route only (no middleware)**: Would require duplicating auth checks everywhere. Rejected: middleware provides consistent session handling.

**Implementation notes**:
- `middleware.ts`: `clerkMiddleware()` with `createRouteMatcher` for `/sync/**` and `/api/sync/**`
- Route handlers: `const { userId, sessionClaims } = await auth()` → check `sessionClaims.metadata.role === "admin"`
- Configure Clerk dashboard: add `role` to public metadata or use Clerk Organizations for role management
- Return 401 for unauthenticated, 403 for authenticated but not admin

---

## Topic 7: Filesystem Output Strategy

**Decision**: Atomic writes (temp file + rename) to `output/{entity-type}/{entity-id}.html`. Orphan cleanup after each sync.

**Rationale**: Atomic writes via `fs.writeFile` to a temp file followed by `fs.rename` prevent serving partially-written HTML during sync. Directory structure by entity type keeps output organized and predictable. Orphan cleanup removes HTML files for entities no longer present in the API response.

**Alternatives considered**:
- **Direct overwrite**: Simpler but risks serving partial content if read during write. Rejected: atomic writes are trivial to implement.
- **Flat directory (all files in output/)**: Simpler but poor organization with hundreds of files. Rejected: subdirectories improve manageability.
- **Versioned output (output-v1/, output-v2/)**: Blue-green deployment pattern. Rejected: overengineered for single-host; atomic writes are sufficient.

**Implementation notes**:
- Directory structure: `output/seminars/{id}.html`, `output/lessons/{id}.html`, `output/profiles/{id}.html`
- Atomic write: `fs.writeFile(path + '.tmp', content)` → `fs.rename(path + '.tmp', path)`
- Use `fs.mkdir(dir, { recursive: true })` before writing
- Orphan cleanup: after sync, list files in output dirs → compare with fetched entity IDs → delete unmatched files → log deletions
- Ensure `output/` is in `.gitignore`
- Manifest at `output/.sync-manifest.json` updated atomically after all HTML files are written
