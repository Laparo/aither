# Research: Video & Audio Recording Module

**Spec**: `specs/004-recording-module/spec.md`  
**Date**: 2026-02-19

## 1. FFmpeg Child Process for RTSP/HTTP/MJPEG Capture

**Decision**: Spawn FFmpeg as a Node.js `child_process` to capture the webcam's network stream.

**Rationale**: FFmpeg is the de facto standard for stream capture and remuxing. It handles RTSP, HTTP, and MJPEG natively with a single command. Spawning it as a child process keeps the Node.js event loop unblocked. The existing codebase has no native binary dependencies — FFmpeg is a host system requirement (documented in spec).

**Alternatives considered**:
- **`fluent-ffmpeg` npm package**: Wrapper around FFmpeg CLI. Adds a dependency for thin convenience; raw `child_process.spawn` is sufficient and avoids version-lock issues. Rejected.
- **`node-rtsp-stream`**: RTSP-specific, doesn't handle HTTP/MJPEG. Rejected.
- **GStreamer**: Equivalent capability but less ubiquitous on developer machines. FFmpeg is more likely pre-installed. Rejected.

**Implementation pattern**: Use `child_process.spawn('ffmpeg', [...args])` with structured argument arrays. Listen on `stderr` for progress/errors (FFmpeg writes progress to stderr). Kill with `SIGINT` for graceful MP4 finalization (writes moov atom).

## 2. SSE for Playback Commands (Server → Player)

**Decision**: Use Server-Sent Events via Next.js App Router's native `ReadableStream` response.

**Rationale**: Playback commands flow unidirectionally (server → player). SSE is the simplest protocol for this pattern and works natively in Next.js App Router without additional dependencies. The existing codebase has no WebSocket infrastructure. Next.js App Router doesn't support WebSocket upgrade natively — it would require a custom server.

**Alternatives considered**:
- **WebSocket**: Bidirectional, but playback commands are unidirectional. Requires custom server setup in Next.js. Rejected per clarification Q5.
- **Polling**: Player polls for commands — adds latency (500ms+ per poll interval). Rejected.
- **Server-Side Rendering push**: Not applicable for real-time command dispatch. Rejected.

**Implementation pattern**: `GET /api/recording/events?recordingId={id}` returns a `Response` with `ReadableStream` and `Content-Type: text/event-stream`. Commands are pushed to connected clients via a shared in-memory registry (Map of recordingId → Set of controllers). Player state reports use `POST /api/recording/playback/state`.

## 3. MP4 Output Format (H.264 + AAC)

**Decision**: FFmpeg outputs MP4 container with H.264 video and AAC audio.

**Rationale**: MP4/H.264/AAC is the most broadly compatible format across browsers for `<video>` playback. When the webcam provides H.264 natively, FFmpeg can use `-c copy` (no transcoding). When the webcam provides MJPEG, FFmpeg transcodes to H.264.

**Alternatives considered**:
- **WebM/VP9**: Good browser support but RTSP webcams rarely output VP9. Would always require transcoding. Rejected.
- **HLS (m3u8)**: Adds segmenting complexity; useful for adaptive bitrate but overkill for single-client LAN playback. Rejected.
- **Raw container pass-through**: Depends on webcam output format. Browser compatibility not guaranteed. Rejected.

## 4. In-Memory Session State (Constitution VII)

**Decision**: Recording session state and playback state are held in module-level variables, consistent with the sync route pattern.

**Rationale**: Constitution VII mandates stateless architecture with no database. The existing `sync/route.ts` uses the exact same pattern — module-level `let` variables with `_resetState()` for testing. Recording state (current session, FFmpeg process reference) and playback state (connected SSE clients, current player state) follow this pattern.

**Alternatives considered**:
- **Redis/Upstash**: Already in dependencies but Constitution VII forbids persistent state stores for transient session data. Rejected.
- **File-based state**: Adds filesystem I/O for metadata that's only needed during active sessions. Rejected.

## 5. Local Filesystem Storage (Constitution VIII Exception)

**Decision**: Recordings are stored in `output/recordings/` on the local filesystem, gitignored. Phase 1 is local-only; MUX integration is deferred.

**Rationale**: Constitution VIII states "Video files MUST NOT be stored permanently on local filesystem" and mandates MUX as video store. However, the user explicitly requested local storage for easy playback. The `output/` directory is already gitignored and used for HTML output and slides output. Recordings are treated as output artifacts comparable to generated HTML files.

**Justification for local storage**: 
- Recordings are output artifacts, not application state
- `output/` is gitignored and ephemeral by convention
- Manual `DELETE` endpoint provides explicit lifecycle control
- US6 provides explicit per-recording MUX upload via API command
- After MUX upload, operator deletes local file manually when no longer needed for LAN playback

### Approval

This Constitution VIII exception was explicitly approved by the project stakeholder during the 2026-02-19 design session. The decision is recorded here as the authoritative sign-off for the local storage deviation.

### Automatic Cleanup Policy

To mitigate accumulation risk and prevent disk exhaustion:
- **Configurable TTL**: A `RECORDING_TTL_HOURS` environment variable (default: 168 hours / 7 days) controls automatic deletion of recordings older than the configured threshold. The cleanup runs on a periodic schedule (e.g., hourly check).
- **Post-Upload Deletion**: After a confirmed successful MUX upload (US6), the local file is eligible for automatic deletion. Operators can opt in via a `DELETE_AFTER_MUX_UPLOAD` environment variable (default: `false`).
- **Manual Cleanup**: The `DELETE /api/recording/{id}` endpoint remains available for immediate manual removal.
- **Monitoring & Alerting**: Disk usage of `output/recordings/` should be monitored. An alert should fire when total recording storage exceeds a configurable threshold (e.g., 5 GB) to prompt operator intervention.

## 6. Environment Variables

**Decision**: Add `WEBCAM_STREAM_URL` (conditionally required — required when the recording feature is used, validated at recording start) and `RECORDINGS_OUTPUT_DIR` (optional, default `output/recordings`) to the Zod `EnvSchema` in `config.ts`.

**Rationale**: Follows the existing pattern — all configuration goes through `EnvSchema` with Zod validation and `loadConfig()` singleton. The two existing output dirs (`HTML_OUTPUT_DIR`, `SLIDES_OUTPUT_DIR`) set the precedent.

**Implementation**: Add to `EnvSchema` with `.optional()` for `RECORDINGS_OUTPUT_DIR` (has default via `loadConfig()`) and `.optional()` for `WEBCAM_STREAM_URL` (validated at recording start, not at app boot — the app runs without recording capability if URL is absent).

## 7. Auth Model for Recording vs Playback

**Decision**: Recording start/stop/delete requires `admin` role. Playback control and streaming require `admin` or `api-client` role.

**Rationale**: Recording mutation (start/stop/delete) is a destructive/resource-intensive operation — same tier as sync and slide generation. Playback is read-oriented command dispatch — the `api-client` role should be able to drive presentations. This matches the existing RBAC model in `permissions.ts`.

**Implementation**: 
- Add permissions `manage:recordings` and `control:playback` to the Permission union type
- Add `manage:recordings` to admin role
- Add `control:playback` to admin and api-client roles
- Recording endpoints check `manage:recordings`; playback endpoints check `control:playback`

## 8. Route Namespace and Proxy Configuration

**Decision**: All API routes under `/api/recording/...`, player page at `/recording/player/[id]`.

**Rationale**: The proxy already includes `/api/recordings(.*)` (plural, for Spec 001 MUX upload). The new recording module uses `/api/recording/` (singular) for local recording operations. This avoids collision with the existing recordings upload route.

**Implementation**: Add `/api/recording(.*)` and `/recording(.*)` to `proxy.ts` route matcher. The Clerk middleware `config.matcher` already covers `/api/*` and all non-static routes.

## 9. Minimal New Runtime Dependencies

**Decision**: One new npm package required: `@mux/mux-node` for User Story 6 (MUX upload).

**Rationale**: 
- FFmpeg capture: `child_process` (Node.js built-in)
- SSE streaming: `ReadableStream` (Web API, native in Next.js)
- UUID generation: `uuid` (already in dependencies)
- Validation: `zod` (already in dependencies)
- Error reporting: `rollbar` via existing `reportError()` helper
- File operations: `fs/promises` (Node.js built-in)
- MUX upload (US6): `@mux/mux-node` (new dependency — official MUX SDK for direct upload, asset polling, and playback URL retrieval)

## 10. FFmpeg Process Lifecycle and Graceful Shutdown

**Decision**: Use `SIGINT` for graceful stop, `SIGKILL` as fallback after timeout.

**Rationale**: FFmpeg responds to `SIGINT` by properly finalizing the MP4 container (writing the moov atom). Without the moov atom, the file is unplayable. A 5-second grace period after `SIGINT` before `SIGKILL` ensures the file is finalized even on slow I/O.

**Edge cases**:
- Server crash/restart: orphaned FFmpeg process → register cleanup in `process.on('exit')` and `process.on('SIGTERM')`
- Webcam disconnect mid-recording: FFmpeg exits with error → detect via `close` event, save partial file, mark session as interrupted
- 15-minute timeout: timer triggers graceful stop sequence (same as manual stop)
