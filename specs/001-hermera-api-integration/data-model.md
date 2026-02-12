# Data Model: Hemera Academy API Integration

**Feature**: 001-hemera-api-integration  
**Date**: 2026-02-11  
**Phase**: 1 — Design & Contracts

> All entities are **transient** (API response shapes or in-memory state). Aither has **no local database** (Constitution VII). The only persisted artifacts are generated HTML files and the sync hash manifest on the filesystem.

---

## Entity Relationship Diagram

```
hemera.academy API (source of truth)
        │
        ├── HtmlTemplate ──────┐
        │                      │  populated with
        ├── Seminar ───────────┤──────────────────► HTML File (filesystem)
        │     ├── Lesson       │
        │     │    ├── TextContent
        │     │    └── MediaAsset
        │     └── SeminarRecording ◄── MUX (write-back to API)
        │
        ├── UserProfile (participant/instructor)
        │
        └── SyncConfiguration (env vars / config)

Internal (in-memory):
  SyncJob ── tracks one sync execution
  SyncManifest ── content hashes (persisted as JSON on filesystem)
```

---

## Entities

### HtmlTemplate

> Authored on hemera.academy. Fetched via API. Never modified by Aither.

| Field | Type | Description |
|-------|------|-------------|
| `sourceId` | `string` | Unique ID from hemera.academy |
| `seminarId` | `string \| null` | Associated seminar (null for global templates) |
| `lessonId` | `string \| null` | Associated lesson (null for seminar-level templates) |
| `markup` | `string` | HTML template content with placeholder tokens (e.g., `{{participantName}}`) |
| `version` | `string \| null` | Version or last-modified indicator from API |

**Validation rules**: `sourceId` required, non-empty. `markup` required, must be valid HTML string. At least one of `seminarId` or `lessonId` should be present (warn if neither).

---

### Seminar

> A course offering from the academy. API response shape.

| Field | Type | Description |
|-------|------|-------------|
| `sourceId` | `string` | Unique ID from hemera.academy |
| `title` | `string` | Seminar title |
| `description` | `string \| null` | Seminar description |
| `dates` | `{ start: string; end: string }[]` | Schedule dates (ISO 8601) |
| `instructorIds` | `string[]` | References to UserProfile sourceIds |
| `lessonIds` | `string[]` | References to Lesson sourceIds |
| `recordingUrl` | `string \| null` | MUX playback URL (if recording exists) |

**Validation rules**: `sourceId` and `title` required, non-empty. `dates` must be valid ISO 8601 strings if present.

---

### UserProfile

> A participant or instructor profile. API response shape.

| Field | Type | Description |
|-------|------|-------------|
| `sourceId` | `string` | Unique ID from hemera.academy |
| `name` | `string` | Display name |
| `email` | `string \| null` | Contact email (PII — exclude from logs) |
| `role` | `"participant" \| "instructor"` | Role in the academy |
| `seminarIds` | `string[]` | Associated seminar sourceIds |

**Validation rules**: `sourceId` and `name` required. `role` must be one of the enum values. `email` must match email format if present.

---

### Lesson

> An individual lesson within a seminar. API response shape.

| Field | Type | Description |
|-------|------|-------------|
| `sourceId` | `string` | Unique ID from hemera.academy |
| `seminarId` | `string` | Parent seminar sourceId |
| `title` | `string` | Lesson title |
| `sequence` | `number` | Ordering within the seminar |
| `textContentIds` | `string[]` | References to TextContent sourceIds |
| `mediaAssetIds` | `string[]` | References to MediaAsset sourceIds |

**Validation rules**: `sourceId`, `seminarId`, `title` required. `sequence` must be a non-negative integer.

---

### TextContent

> Textual content associated with lessons or seminars. API response shape.

| Field | Type | Description |
|-------|------|-------------|
| `sourceId` | `string` | Unique ID from hemera.academy |
| `entityRef` | `{ type: "seminar" \| "lesson"; id: string }` | Associated entity |
| `body` | `string` | Text/HTML content body |
| `contentType` | `"text" \| "html" \| "markdown"` | Content format |

**Validation rules**: `sourceId` and `body` required. `contentType` must be a valid enum value.

---

### MediaAsset

> Image or video asset metadata. Actual files remain hosted at hemera.academy.

| Field | Type | Description |
|-------|------|-------------|
| `sourceId` | `string` | Unique ID from hemera.academy |
| `entityRef` | `{ type: "seminar" \| "lesson"; id: string }` | Associated entity |
| `mediaType` | `"image" \| "video"` | Asset type |
| `sourceUrl` | `string` | URL hosted at hemera.academy |
| `altText` | `string \| null` | Alt text / caption |
| `fileSize` | `number \| null` | File size in bytes (metadata only) |

**Validation rules**: `sourceId` and `sourceUrl` required. `sourceUrl` must be a valid URL. `mediaType` must be `"image"` or `"video"`.

---

### SeminarRecording

> MUX video recording reference. Transient — passed directly to hemera.academy API.

| Field | Type | Description |
|-------|------|-------------|
| `seminarSourceId` | `string` | Associated seminar ID on hemera.academy |
| `muxAssetId` | `string` | MUX asset identifier |
| `muxPlaybackUrl` | `string` | MUX playback URL |
| `recordingDate` | `string` | ISO 8601 date of recording |

**Validation rules**: All fields required. `muxPlaybackUrl` must be a valid URL. `recordingDate` must be valid ISO 8601.

**State transitions**: Not applicable — this entity is a one-shot DTO received via the recordings endpoint and immediately transmitted to the hemera.academy API.

---

### SyncJob (in-memory only)

> Represents one sync execution. Transient — lost on restart.

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | `string` | UUID generated at start |
| `startTime` | `string` | ISO 8601 timestamp |
| `endTime` | `string \| null` | ISO 8601 timestamp (null while running) |
| `status` | `"running" \| "success" \| "failed"` | Current status |
| `recordsFetched` | `number` | Total entities fetched from API |
| `htmlFilesGenerated` | `number` | HTML files written/updated |
| `htmlFilesSkipped` | `number` | Unchanged (hash match) — skipped |
| `recordsTransmitted` | `number` | Recording URLs sent to API |
| `errors` | `{ entity: string; message: string; timestamp: string }[]` | Error log |

**State transitions**: `running` → `success` | `failed`. No other transitions allowed.

---

### SyncManifest (filesystem — `output/.sync-manifest.json`)

> Content hash manifest for incremental sync detection.

| Field | Type | Description |
|-------|------|-------------|
| `lastSyncTime` | `string` | ISO 8601 timestamp of last successful sync |
| `hashes` | `Record<string, string>` | Map of `"{entityType}:{sourceId}"` → SHA-256 hex hash |

**Persistence**: Written atomically to `output/.sync-manifest.json` after each successful sync. Gitignored.

---

## Relationships

| From | To | Cardinality | Description |
|------|----|-------------|-------------|
| Seminar | Lesson | 1:N | A seminar contains multiple lessons |
| Seminar | UserProfile | N:M | Instructors and participants linked to seminars |
| Seminar | HtmlTemplate | 1:N | One or more templates per seminar |
| Lesson | HtmlTemplate | 1:N | One or more templates per lesson |
| Lesson | TextContent | 1:N | A lesson has multiple text blocks |
| Lesson | MediaAsset | 1:N | A lesson references multiple media assets |
| Seminar | SeminarRecording | 1:1 | One recording per seminar (latest overwrites) |

---

## Notes

- **No database schema**: All entities are TypeScript interfaces + Zod schemas. No ORM, no migrations.
- **PII handling**: `UserProfile.email` is PII — MUST be excluded from Rollbar logs and error reports (Constitution IV).
- **Template placeholder format**: To be coordinated with hemera.academy. Default assumption: Handlebars `{{variable}}` syntax.
- **Hash input**: `SHA-256(JSON.stringify({ template, data }, sortedKeys))` — hashing the combination of template + entity data ensures changes to either trigger regeneration.
