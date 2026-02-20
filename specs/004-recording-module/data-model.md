# Data Model: Video & Audio Recording Module

**Spec**: `specs/004-recording-module/spec.md`  
**Date**: 2026-02-19

## Entities

### RecordingSession (transient, in-memory)

Represents an active or completed recording session. Held in a module-level variable; no persistence beyond process lifetime.

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | Unique ID: `rec_{ISO-timestamp}` |
| `filename` | `string` | Output filename: `rec_{ISO-timestamp}.mp4` |
| `status` | `"starting" \| "recording" \| "stopping" \| "completed" \| "failed" \| "interrupted"` | Current session lifecycle state |
| `startedAt` | `string` (ISO 8601) | Timestamp when recording was initiated |
| `endedAt` | `string \| null` | Timestamp when recording ended (null if active) |
| `duration` | `number \| null` | Duration in seconds (null if active, populated on stop) |
| `fileSize` | `number \| null` | File size in bytes (null if active, populated on stop) |
| `filePath` | `string` | Full relative path: `output/recordings/{filename}` |
| `maxDurationReached` | `boolean` | Whether the 15-minute cap triggered auto-stop |
| `error` | `string \| null` | Error message if status is `failed` or `interrupted` |

**Validation rules**:
- `sessionId` must match pattern `rec_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z`
- `duration` must be `>= 0` and `<= 900` (15 minutes)
- `fileSize` must be `>= 0`
- Only one session can have status `recording` or `starting` at a time (mutex)

**State transitions**:

```
[none] → starting → recording → stopping → completed
                  ↘ failed (FFmpeg error, webcam unreachable)
                  ↘ interrupted (webcam disconnect mid-recording)
         recording → stopping → completed (maxDurationReached: true)
```

### RecordingFile (derived from filesystem)

Represents a recording file on disk. Not stored as a data model — derived by scanning `output/recordings/` directory.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Derived from filename: `rec_{ISO-timestamp}` |
| `filename` | `string` | File on disk: `rec_{ISO-timestamp}.mp4` |
| `duration` | `number` | Duration in seconds (read via FFprobe) |
| `fileSize` | `number` | File size in bytes (from `fs.stat`) |
| `createdAt` | `string` (ISO 8601) | Extracted from filename timestamp |
| `filePath` | `string` | Relative path: `output/recordings/{filename}` |

**Validation rules**:
- File must exist on disk and be a `.mp4` file
- Filename must match the naming convention `rec_{ISO-timestamp}.mp4`
- `duration > 0` (zero-length files are invalid/corrupt)

### PlaybackState (transient, in-memory)

Represents the current playback state for a recording being played. Held in a module-level Map keyed by `recordingId`.

| Field | Type | Description |
|-------|------|-------------|
| `recordingId` | `string` | ID of the recording being played |
| `state` | `"idle" \| "playing" \| "paused" \| "ended" \| "error"` | Current player state |
| `position` | `number` | Current playback position in seconds |
| `connectedAt` | `string` (ISO 8601) | When the SSE client connected |
| `lastUpdated` | `string` (ISO 8601) | Last state update from player |
| `errorMessage` | `string \| null` | Error details if state is `error` |

**Validation rules**:
- `position >= 0`
- `position <= duration` of the referenced recording
- Only one active playback session per `recordingId` at a time

**State transitions**:

```
[none] → idle (SSE client connected)
idle → playing (play command)
playing → paused (stop command)
paused → playing (play command)
playing/paused → playing/paused (seek via rewind/forward)
playing → ended (reached end of video)
any → error (decode error, file removed)
any → [none] (SSE client disconnected)
```

### SSEClientRegistry (transient, in-memory)

Internal bookkeeping for connected SSE player clients. Not exposed via API.

| Field | Type | Description |
|-------|------|-------------|
| `clients` | `Map<string, Set<ReadableStreamDefaultController>>` | Map of recordingId → connected SSE controllers |

**Behavior**:
- On SSE connect: add controller to the set for the recordingId
- On SSE disconnect: remove controller from the set
- On playback command: push SSE event to all controllers for the recordingId
- On recording delete: close all SSE connections for that recordingId

### MuxUploadResult (transient, API response only)

Represents the result of uploading a recording to MUX. Not persisted — returned directly in the API response and discarded.

| Field | Type | Description |
|-------|------|-------------|
| `muxAssetId` | `string` | MUX asset identifier |
| `muxPlaybackUrl` | `string` | MUX HLS playback URL |
| `seminarSourceId` | `string` | Seminar source ID from the upload request |
| `transmitted` | `boolean` | Whether the URL was successfully forwarded to hemera.academy |
| `transmissionError` | `string \| null` | Error message if hemera.academy transmission failed (207 case) |

**Validation rules**:
- `muxAssetId` must be a non-empty string
- `muxPlaybackUrl` must be a valid URL
- `seminarSourceId` must be a non-empty string
- `transmissionError` is null when `transmitted` is true

## Relationships

```
RecordingSession 1 ──produces──> 1 RecordingFile
RecordingFile    1 ──referenced by──> 0..1 PlaybackState
PlaybackState    1 ──registered in──> 1 SSEClientRegistry
```

## Zod Schemas (source of truth)

All schemas will be defined in `src/lib/recording/schemas.ts`. The data model above is implemented via these Zod schemas — the schemas are the authoritative definition.

```typescript
// Recording session status enum
const RecordingStatus = z.enum(["starting", "recording", "stopping", "completed", "failed", "interrupted"]);

// Playback state enum  
const PlayerState = z.enum(["idle", "playing", "paused", "ended", "error"]);

// Recording session (in-memory)
const RecordingSessionSchema = z.object({ ... });

// Recording file (derived from filesystem)
const RecordingFileSchema = z.object({ ... });

// Playback state (in-memory)
const PlaybackStateSchema = z.object({ ... });

// API request/response schemas
const StartRecordingResponseSchema = z.object({ ... });
const StopRecordingResponseSchema = z.object({ ... });
const RecordingListResponseSchema = z.object({ ... });
const PlaybackCommandSchema = z.object({ ... });
const PlaybackResponseSchema = z.object({ ... });
const PlayerStateReportSchema = z.object({ ... });
```
