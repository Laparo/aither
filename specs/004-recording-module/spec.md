# Feature Specification: Video & Audio Recording Module

**Feature Branch**: `004-recording-module`  
**Created**: 2026-02-19  
**Status**: Draft  
**Input**: User description: "Create a video and audio recording module that reads the video and audio signal from a webcam connected over WLAN. The module is launched and stopped by an API call. Recorded video is stored locally for easy playback over a web player. Play, stop, rewind, and fast-forward can be controlled over the API. The web player itself requires no control elements. The web player is a standard Next.js compatible player. Playback is in HD resolution and full screen over the standard display adapter."

## Out of Scope

- Bulk or automatic cloud upload (S3, etc.) — only explicit per-recording MUX upload via API command is supported.
- Audio-only recording without video.
- Multiple simultaneous camera streams (single webcam input per recording session).
- Video transcoding or format conversion (recordings are stored in the webcam's native stream format or as remuxed by the capture tool).
- User-facing UI controls on the web player (all playback control is via API; the player renders video only).
- Authentication of the webcam device itself (the WLAN webcam is assumed to be a trusted, pre-configured device on the local network).
- Video editing, trimming, or post-processing.

## Architecture Overview

### Recording Pipeline

```
WLAN Webcam (RTSP/HTTP stream) → Aither Server (stream capture) → Local Filesystem (output/recordings/)
```

The recording module captures video and audio directly on the server from the WLAN webcam's network stream (typically RTSP or HTTP). No browser is involved in recording — a browser is only required for the playback web player.

1. **Server-Side Capture** — The Aither server connects to the WLAN webcam's stream URL (configured via environment variable) and records it to a local file by spawning an FFmpeg child process. FFmpeg captures the RTSP/HTTP/MJPEG stream and writes directly to `output/recordings/` as MP4 (H.264+AAC).
2. **Recording API** — REST endpoints under `/api/recording/` to start, stop, and query recording sessions.
3. **Playback API** — REST endpoints under `/api/recording/playback/` to control playback state (play, stop, rewind, fast-forward).
4. **Web Player** — A minimal Next.js page (`/recording/player/[id]`) that renders the recorded video full-screen in HD with no UI controls. Playback state is driven entirely by API commands.

### Storage

Recordings are stored locally in `output/recordings/` as individual files:

```
output/recordings/
├── rec_2026-02-19T10-30-00Z.mp4
├── rec_2026-02-19T14-15-00Z.mp4
└── ...
```

File naming convention: `rec_{ISO-timestamp}.mp4` — FFmpeg outputs MP4 (H.264+AAC) for browser compatibility.

### Playback

The web player uses a standard HTML5 `<video>` element compatible with Next.js. It renders full-screen at HD resolution (1920×1080) through the standard display adapter. The player page has no visible controls — all playback is driven via the Playback API.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Start and Stop a Recording Session (Priority: P1)

As a system operator, I want to start and stop video/audio recording from a WLAN-connected webcam via API calls, so that seminar recordings can be captured programmatically without manual intervention.

**Why this priority**: Recording is the core function of this module. Without the ability to start and stop capture, no other feature (playback, control) has value.

**Independent Test**: Can be fully tested by sending a POST to start recording, waiting a few seconds, sending a POST to stop, and verifying a video file exists in `output/recordings/` with valid video/audio tracks.

**Acceptance Scenarios**:

1. **Given** a WLAN webcam is accessible and no recording is in progress, **When** a `POST /api/recording/start` request is sent, **Then** the system begins capturing video and audio from the webcam and returns a 200 response with the recording session ID and filename.
2. **Given** a recording session is in progress, **When** a `POST /api/recording/stop` request is sent, **Then** the system stops capturing, finalizes the video file in `output/recordings/`, and returns a 200 response with the file path and duration.
3. **Given** a recording session is already in progress, **When** another `POST /api/recording/start` request is sent, **Then** the system returns 409 Conflict indicating a session is already active.
4. **Given** no recording session is in progress, **When** a `POST /api/recording/stop` request is sent, **Then** the system returns 404 indicating no active session.
5. **Given** the WLAN webcam is unreachable or not providing a media stream, **When** a `POST /api/recording/start` request is sent, **Then** the system returns 503 Service Unavailable with a descriptive error message.
6. **Given** a recording is in progress, **When** the webcam connection is interrupted, **Then** the system saves the partial recording, marks the session as interrupted, and logs the error.
7. **Given** a recording has been running for 15 minutes, **When** the maximum duration is reached, **Then** the system auto-stops the recording, finalizes the file, and returns a completed status with a `maxDurationReached: true` flag.

---

### User Story 2 — Query Recording Status and List Recordings (Priority: P1)

As a system operator, I want to query the current recording status and list all available recordings, so that I can determine what is currently being recorded and what recordings are available for playback.

**Why this priority**: Status visibility is essential for orchestrating recording alongside other Aither operations (slide generation, sync). Operators need to know what recordings exist before controlling playback.

**Independent Test**: Can be fully tested by creating a recording, then querying the status endpoint and list endpoint, verifying correct metadata is returned.

**Acceptance Scenarios**:

1. **Given** a recording session is in progress, **When** a `GET /api/recording/status` request is sent, **Then** the system returns 200 with `{ recording: true, sessionId, startedAt, filename }`.
2. **Given** no recording session is in progress, **When** a `GET /api/recording/status` request is sent, **Then** the system returns 200 with `{ recording: false }`.
3. **Given** multiple recordings exist in `output/recordings/`, **When** a `GET /api/recording/list` request is sent, **Then** the system returns 200 with an array of `{ id, filename, duration, fileSize, createdAt }` sorted by creation date descending.
4. **Given** no recordings exist, **When** a `GET /api/recording/list` request is sent, **Then** the system returns 200 with an empty array.
5. **Given** a recording exists, **When** a `DELETE /api/recording/[id]` request is sent with its ID, **Then** the system deletes the file from `output/recordings/` and returns 200 with a confirmation. If the recording is currently being played, playback is stopped first.
6. **Given** a recording ID that does not exist, **When** a `DELETE /api/recording/[id]` request is sent, **Then** the system returns 404.

---

### User Story 3 — Playback Control via API (Priority: P1)

As a system operator, I want to control video playback (play, stop, rewind, fast-forward) via API calls, so that recorded seminars can be presented on a display without requiring a person to interact with the player UI.

**Why this priority**: API-driven playback is a core differentiator of this module — the player is a headless display surface controlled remotely. Without playback control, recordings cannot be presented.

**Independent Test**: Can be fully tested by opening the player page for a recording, then sending play/stop/rewind/fast-forward API calls and verifying the player state changes accordingly (via a status endpoint or WebSocket state).

**Acceptance Scenarios**:

1. **Given** a recording exists and the player page is open at `/recording/player/[id]`, **When** a `POST /api/recording/playback/play` request is sent with the recording ID, **Then** the player begins playback from the current position.
2. **Given** the player is currently playing, **When** a `POST /api/recording/playback/stop` request is sent, **Then** the player pauses playback at the current position.
3. **Given** the player is playing or paused, **When** a `POST /api/recording/playback/rewind` request is sent with a `seconds` parameter, **Then** the player seeks backward by the specified number of seconds (minimum 0).
4. **Given** the player is playing or paused, **When** a `POST /api/recording/playback/forward` request is sent with a `seconds` parameter, **Then** the player seeks forward by the specified number of seconds (capped at duration).
5. **Given** no player instance is connected for the specified recording, **When** any playback control request is sent, **Then** the system returns 404 indicating no active player session.
6. **Given** the recording ID does not match any file in `output/recordings/`, **When** a playback command is sent, **Then** the system returns 404 indicating the recording was not found.
7. **Given** the player page is open and playing or paused, **When** the player sends a `POST /api/recording/playback/state` request with `{ recordingId, state, position }` (where `state` is `"playing"`, `"paused"`, or `"ended"`), **Then** the system returns 200 with `{ accepted: true }` and persists the reported playback state so it is available in subsequent status queries.
8. **Given** the player encounters a media error, **When** the player sends a `POST /api/recording/playback/state` request with `{ recordingId, state: "error", position, message: "<error details>" }`, **Then** the system logs the error via `reportError`, persists the error state and message on the playback session, and returns 200 with `{ accepted: true }`.

---

### User Story 4 — Full-Screen HD Web Player (Priority: P1)

As a system operator, I want a web player page that renders recorded video in full-screen HD resolution with no visible UI controls, so that recordings can be displayed on a projector or monitor as a clean, distraction-free video surface.

**Why this priority**: The player is the output surface for all recording playback. Without it, API playback commands have no target to drive.

**Independent Test**: Can be fully tested by navigating to `/recording/player/[id]` in a browser, verifying the video element fills the viewport at 1920×1080 resolution with no visible controls, borders, or chrome.

**Acceptance Scenarios**:

1. **Given** a valid recording ID, **When** the player page `/recording/player/[id]` is opened in a browser, **Then** a `<video>` element is rendered that fills the entire viewport with no margins, padding, scrollbars, or browser chrome visible.
2. **Given** the player page is loaded, **When** the video is displayed, **Then** the video renders at HD resolution (1920×1080 or the native resolution of the recording, whichever is lower) using the standard display adapter.
3. **Given** the player page is loaded, **Then** no playback controls (play button, seek bar, volume slider, etc.) are visible on the page — the `<video>` element has `controls` attribute omitted.
4. **Given** the player page is loaded, **When** a playback command is sent via the API, **Then** the player receives the command in real time via Server-Sent Events (SSE) at `/api/recording/events` and executes it immediately (latency < 500ms).
5. **Given** the player page is loaded with an invalid recording ID, **Then** the page displays a centered error message indicating the recording was not found.

---

### User Story 5 — Serve Recording Files for Streaming (Priority: P2)

As a system operator, I want recorded video files to be served via HTTP for streaming playback, so that the web player can load and play recordings without requiring direct filesystem access.

**Why this priority**: The player needs an HTTP source for the `<video>` element. This is a supporting capability for the player (P1) but is a straightforward file-serving concern.

**Independent Test**: Can be fully tested by requesting `GET /api/recording/stream/[id]` and verifying the response contains the correct video content with appropriate MIME type and supports range requests for seeking.

**Acceptance Scenarios**:

1. **Given** a recording file exists, **When** a `GET /api/recording/stream/[id]` request is sent, **Then** the server responds with the video file, correct `Content-Type` header (`video/mp4`), and `Content-Length`.
2. **Given** a recording file exists, **When** a `GET /api/recording/stream/[id]` request includes a `Range` header, **Then** the server responds with 206 Partial Content and the requested byte range (enabling seek without full download).
3. **Given** the recording ID does not exist, **When** a `GET /api/recording/stream/[id]` request is sent, **Then** the server returns 404.

---

### User Story 6 — Upload Recording to MUX (Priority: P2)

As a system operator, I want to upload a specific local recording to MUX via an API command, so that seminar recordings can be published to the cloud video platform and linked to their corresponding seminars on hemera.academy.

**Why this priority**: MUX upload is a distribution concern that depends on a completed local recording. It bridges this module with Spec 001's MUX URL transmission to hemera.academy.

**Independent Test**: Can be fully tested by creating a recording, calling `POST /api/recording/upload/[id]` with a seminar source ID, and verifying (with MUX API mocked) that a MUX asset is created, the playback URL is obtained, and the URL is forwarded to hemera.academy via the existing `transmitRecording` flow.

**Acceptance Scenarios**:

1. **Given** a recording file exists in `output/recordings/`, **When** a `POST /api/recording/upload/[id]` request is sent with `{ seminarSourceId }`, **Then** the system uploads the MP4 file to MUX, obtains the MUX asset ID and playback URL, forwards the URL to hemera.academy via the existing recording transmitter (Spec 001), and returns 200 with `{ muxAssetId, muxPlaybackUrl, seminarSourceId, transmitted: true }`.
2. **Given** the recording ID does not exist, **When** a `POST /api/recording/upload/[id]` request is sent, **Then** the system returns 404.
3. **Given** a recording is currently being recorded (active session), **When** a `POST /api/recording/upload/[id]` request is sent for that recording, **Then** the system returns 409 Conflict indicating the recording is still in progress.
4. **Given** the MUX API credentials are not configured, **When** a `POST /api/recording/upload/[id]` request is sent, **Then** the system returns 503 with an error indicating MUX is not configured.
5. **Given** the MUX API upload fails, **When** a `POST /api/recording/upload/[id]` request is sent, **Then** the system returns 502 with the MUX error details and does not transmit to hemera.academy.
6. **Given** the MUX upload succeeds but the hemera.academy transmission fails, **When** a `POST /api/recording/upload/[id]` request is sent, **Then** the system returns 207 Multi-Status with the MUX asset details and an error for the hemera.academy transmission, so the operator can retry the transmission separately via `POST /api/recordings` (Spec 001).

---

## API Reference

### Recording Control

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/recording/start` | POST | Start a new recording session |
| `/api/recording/stop` | POST | Stop the active recording session |
| `/api/recording/status` | GET | Get current recording status |
| `/api/recording/list` | GET | List all available recordings |
| `/api/recording/[id]` | DELETE | Delete a specific recording |
| `/api/recording/upload/[id]` | POST | Upload recording to MUX and transmit URL to hemera.academy |

### Playback Control

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/recording/playback/play` | POST | Start/resume playback `{ recordingId }` |
| `/api/recording/playback/stop` | POST | Stop (pause) playback `{ recordingId }` |
| `/api/recording/playback/rewind` | POST | Seek backward `{ recordingId, seconds }` |
| `/api/recording/playback/forward` | POST | Seek forward `{ recordingId, seconds }` |
| `/api/recording/playback/state` | POST | Report current player state `{ recordingId, state, position }` |

### Streaming

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/recording/stream/[id]` | GET | Stream recording file (supports Range requests) |

### MUX Upload

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/recording/upload/[id]` | POST | Upload MP4 to MUX, transmit playback URL to hemera.academy |

### Pages

| Route | Description |
|-------|-------------|
| `/recording/player/[id]` | Full-screen HD player (no UI controls) |

## Request/Response Schemas

### POST /api/recording/upload/[id]

**Request**:
```json
{ "seminarSourceId": "SEM-2026-042" }
```

**Response 200** (full success — MUX upload + hemera.academy transmission):
```json
{
  "muxAssetId": "a1b2c3d4e5",
  "muxPlaybackUrl": "https://stream.mux.com/a1b2c3d4e5.m3u8",
  "seminarSourceId": "SEM-2026-042",
  "transmitted": true
}
```

**Response 207** (MUX upload succeeded, hemera.academy transmission failed):
```json
{
  "muxAssetId": "a1b2c3d4e5",
  "muxPlaybackUrl": "https://stream.mux.com/a1b2c3d4e5.m3u8",
  "seminarSourceId": "SEM-2026-042",
  "transmitted": false,
  "transmissionError": "hemera.academy API returned 502"
}
```

### POST /api/recording/start

**Response 200**:
```json
{
  "sessionId": "rec_2026-02-19T10-30-00Z",
  "filename": "rec_2026-02-19T10-30-00Z.mp4",
  "startedAt": "2026-02-19T10:30:00.000Z"
}
```

### POST /api/recording/stop

**Response 200** (success):
```json
{
  "sessionId": "rec_2026-02-19T10-30-00Z",
  "filename": "rec_2026-02-19T10-30-00Z.mp4",
  "duration": 900,
  "fileSize": 281000000,
  "filePath": "output/recordings/rec_2026-02-19T10-30-00Z.mp4",
  "status": "completed",
  "maxDurationReached": false,
  "repair_error": null,
  "partialPath": null,
  "renameAttempts": 0,
  "lastRenameError": null,
  "attemptedFallbackSteps": [],
  "finalFallbackError": null,
  "manifestPath": null
}
```

**Response 200** (repair failed):
```json
{
  "sessionId": "rec_2026-02-19T10-30-00Z",
  "filename": null,
  "duration": 842,
  "fileSize": 0,
  "filePath": null,
  "status": "repair_failed",
  "maxDurationReached": false,
  "repair_error": {
    "class": "ENOSPC",
    "exitCode": 1,
    "stderr": "No space left on device",
    "attempts": 2
  },
  "partialPath": "output/recordings/rec_2026-02-19T10-30-00Z.mp4.partial",
  "renameAttempts": 0,
  "lastRenameError": null,
  "attemptedFallbackSteps": [],
  "finalFallbackError": null,
  "manifestPath": null
}
```

**Response 500** (finalization failed — returned when rename/copy finalization cannot complete):
```json
{
  "error": "FINALIZATION_FAILED",
  "message": "Failed to finalize recording after 3 rename attempts",
  "sessionId": "rec_2026-02-19T10-30-00Z",
  "partialPath": "output/recordings/rec_2026-02-19T10-30-00Z.mp4.partial",
  "renameAttempts": 3,
  "lastRenameError": "EACCES: permission denied, rename '...partial' -> '...mp4'",
  "attemptedFallbackSteps": ["hardlink", "copy"],
  "finalFallbackError": "ENOSPC: no space left on device during copy",
  "manifestPath": "output/recordings/rec_2026-02-19T10-30-00Z.mp4.manifest.json"
}
```

- `status` *(string, required)*: Terminal state of the recording — one of `"completed"`, `"interrupted"`, `"finalization_failed"`, or `"repair_failed"`. This endpoint always returns a terminal state; `"recording"` is never present in stop responses. Allows callers to distinguish cleanly stopped recordings from sessions interrupted by stream failures (`"interrupted"`), rename/finalization failures (`"finalization_failed"`), or failed post-processing repairs (`"repair_failed"`).
- `maxDurationReached` *(boolean, required)*: `true` when the recording was auto-stopped after reaching the 15-minute maximum duration, `false` for manual stops. Always present — consumers can rely on this field without null-checking.
- `repair_error` *(object | null, required)*: When `status` is `"repair_failed"`, contains an object with fields: `class` (one of `"OOM"`, `"ENOSPC"`, `"timeout"`, `"ffmpeg_error"`), `exitCode` (integer | null), `stderr` (string, truncated to 4 KB), `attempts` (integer — total repair invocations including retries). `null` for all other statuses.
- `partialPath` *(string | null, required)*: Filesystem path to the `.partial` file when finalization or repair failed. `null` when the recording completed successfully.
- `renameAttempts` *(integer, required)*: Number of rename attempts made during finalization (0 when not applicable, e.g., repair-failed sessions where finalization was never reached).
- `lastRenameError` *(string | null, required)*: Error message from the final rename/fallback attempt, or `null` if rename was not attempted or succeeded.
- `attemptedFallbackSteps` *(string[], required)*: Ordered list of fallback strategies attempted during finalization (e.g., `["hardlink", "copy"]`). Empty array when rename succeeded on first try or finalization was not reached.
- `finalFallbackError` *(string | null, required)*: Error message from the last fallback step, or `null` if no fallback was needed or all fallbacks succeeded.
- `manifestPath` *(string | null, required)*: Path to the crash-recovery manifest file written during the copy fallback, or `null` if no manifest was created. The manifest contains `{ partialPath, finalPath, checksum, timestamp }` for startup reconciliation.

### GET /api/recording/list

**Response 200**:
```json
{
  "recordings": [
    {
      "id": "rec_2026-02-19T10-30-00Z",
      "filename": "rec_2026-02-19T10-30-00Z.mp4",
      "duration": 900,
      "fileSize": 281000000,
      "createdAt": "2026-02-19T10:30:00.000Z",
      "status": "completed",
      "repair_error": null,
      "partialPath": null,
      "renameAttempts": 0,
      "lastRenameError": null,
      "attemptedFallbackSteps": [],
      "finalFallbackError": null,
      "manifestPath": null
    },
    {
      "id": "rec_2026-02-19T11-00-00Z",
      "filename": null,
      "duration": 340,
      "fileSize": 0,
      "createdAt": "2026-02-19T11:00:00.000Z",
      "status": "repair_failed",
      "repair_error": {
        "class": "timeout",
        "exitCode": null,
        "stderr": "Process killed by repair timeout handler after 30000 ms",
        "attempts": 2
      },
      "partialPath": "output/recordings/rec_2026-02-19T11-00-00Z.mp4.partial",
      "renameAttempts": 0,
      "lastRenameError": null,
      "attemptedFallbackSteps": [],
      "finalFallbackError": null,
      "manifestPath": null
    },
    {
      "id": "rec_2026-02-19T12-00-00Z",
      "filename": null,
      "duration": 600,
      "fileSize": 150000000,
      "createdAt": "2026-02-19T12:00:00.000Z",
      "status": "finalization_failed",
      "repair_error": null,
      "partialPath": "output/recordings/rec_2026-02-19T12-00-00Z.mp4.partial",
      "renameAttempts": 3,
      "lastRenameError": "EXDEV: cross-device link not permitted",
      "attemptedFallbackSteps": ["hardlink", "copy"],
      "finalFallbackError": "ENOSPC: no space left on device during copy",
      "manifestPath": "output/recordings/rec_2026-02-19T12-00-00Z.mp4.manifest.json"
    }
  ]
}
```

- `status` *(string, required)*: Completion state of the recording — one of `"completed"`, `"interrupted"`, `"finalization_failed"`, `"repair_failed"`, or `"recording"`. Present on every item so callers can identify completed, active, partial, interrupted, finalization-failed, or repair-failed recordings.
- `repair_error` *(object | null, required)*: See POST /api/recording/stop for field details and error class definitions.
- `partialPath` *(string | null, required)*: Filesystem path to the `.partial` file when finalization or repair failed. `null` when the recording completed successfully.
- `renameAttempts` *(integer, required)*: Number of rename attempts made during finalization.
- `lastRenameError` *(string | null, required)*: Error message from the final rename/fallback attempt, or `null`.
- `attemptedFallbackSteps` *(string[], required)*: Ordered list of fallback strategies attempted.
- `finalFallbackError` *(string | null, required)*: Error from the last fallback step, or `null`.
- `manifestPath` *(string | null, required)*: Path to the crash-recovery manifest, or `null`.

### POST /api/recording/playback/play

**Request**:
```json
{ "recordingId": "rec_2026-02-19T10-30-00Z" }
```

**Response 200**:
```json
{ "status": "playing", "position": 0.0 }
```

### POST /api/recording/playback/rewind | /forward

**Request**:
```json
{ "recordingId": "rec_2026-02-19T10-30-00Z", "seconds": 30 }
```

**Response 200**:
```json
{ "status": "playing", "position": 120.5 }
```

## Real-Time Communication

The player page connects to the server via **Server-Sent Events (SSE)** at `GET /api/recording/events?recordingId={id}` to receive playback commands in real time. SSE is unidirectional (server → player), which matches the command flow. Player state reports (player → server) are sent as POST requests.

### SSE Events (Server → Player)

```
event: command
data: {"action": "play"}

event: command
data: {"action": "stop"}

event: command
data: {"action": "seek", "position": 120.5}
```

### Player State Reports (Player → Server via POST)

`POST /api/recording/playback/state`

```json
{ "recordingId": "rec_2026-02-19T10-30-00Z", "state": "playing", "position": 45.2 }
{ "recordingId": "rec_2026-02-19T10-30-00Z", "state": "paused", "position": 45.2 }
{ "recordingId": "rec_2026-02-19T10-30-00Z", "state": "ended", "position": 900.0 }
{ "recordingId": "rec_2026-02-19T10-30-00Z", "state": "error", "message": "Media decode error" }
```

## Clarifications

### Session 2026-02-19

- Q: What is the maximum expected recording duration per session? → A: 15 minutes
- Q: What should happen to old recordings over time? → A: Manual delete only via `DELETE /api/recording/[id]` endpoint
- Q: Where does the capture run — browser or server? → A: Server-side. A browser is only required for playback. The webcam is a separate WLAN device; the server captures its stream directly (e.g., via RTSP/HTTP).
- Q: Should the server use FFmpeg for stream capture? → A: Yes. FFmpeg is spawned as a child process to capture the webcam's RTSP/HTTP/MJPEG stream.
- Q: Should the player receive commands via SSE or WebSocket? → A: SSE (Server-Sent Events). Playback commands are unidirectional (server → player). Player state reports use POST requests back to the server.

## Technical Constraints

- **MUX Integration**: The `@mux/mux-node` SDK is used for direct uploads. MUX API credentials (`MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`) are optional environment variables — the upload endpoint returns 503 if they are not configured. The upload flow creates a MUX direct upload URL, streams the local MP4 file to MUX, waits for the asset to become ready, then retrieves the playback URL. The asset-readiness timeout is configurable via the `MUX_ASSET_TIMEOUT_SECONDS` environment variable (default: 300 seconds) with a 2-second polling interval. If the asset does not reach ready status within the timeout, the endpoint returns 502 with a timeout error. After a successful MUX upload, the system calls the existing `transmitRecording` function (Spec 001) to forward the playback URL to hemera.academy.
- **Maximum Recording Duration**: 15 minutes per session. The system auto-stops recording at 15 minutes to prevent disk exhaustion. A warning is emitted at 14 minutes (1 minute before cap). At the native webcam resolution (typically 1080p at ~2.5 Mbps), a 15-minute recording produces approximately 280 MB.
- **Constitution VII (Stateless Architecture)**: No database. Recording metadata is derived from the filesystem (file name, size, modification time). Session state is held in-memory only for the duration of the active recording/playback session.
- **Constitution VIII (HTML Playback & Video Recording)**: This spec directly implements the video recording and playback aspects of Principle VIII.
- **Constitution IX (Aither Control API)**: Recording and playback endpoints are designed to be orchestrated by the Control API.
- **Codec**: FFmpeg captures the webcam stream and outputs MP4 (H.264 video + AAC audio) for maximum browser playback compatibility. The `-c copy` flag is used when the webcam already provides H.264, avoiding transcoding. If the webcam provides a different codec (e.g., MJPEG), FFmpeg transcodes to H.264.
- **FFmpeg System Dependency**: FFmpeg (including FFprobe, which is bundled with FFmpeg) must be installed on the host machine. FFprobe is used to extract recording metadata (duration). The system verifies FFmpeg availability at startup and on recording start. If FFmpeg is not found, the recording start endpoint returns 503 with a descriptive error.
- **Resolution**: Recording captures at the webcam's native resolution. Playback is scaled to fill the 1920×1080 viewport.
- **WLAN Webcam**: The webcam is a separate device on the same WLAN network, exposing a stream URL (RTSP, HTTP, or MJPEG). The stream URL is configured via the `WEBCAM_STREAM_URL` environment variable. The Aither server connects to this URL directly — no browser or `getUserMedia()` is involved in recording.
- **FFmpeg Stream-Interruption Handling**: The system monitors FFmpeg via its process exit code and stderr for I/O/network errors. FFmpeg is always invoked with `-movflags +faststart` so the moov atom is placed at the beginning of the file for completed recordings; however, if FFmpeg crashes before finalization, the moov atom may not have been written, rendering the partial file unplayable without the post-processing repair flow described below. On any detected interruption or FFmpeg crash, the system sends `SIGTERM` to the FFmpeg process (allowing it to finalize the moov atom) with a configurable grace period (default: 5 seconds) before issuing `SIGKILL` as a fallback. The recording start endpoint returns 503 if FFmpeg is unavailable.
  - **Post-Processing Repair**: If a clean shutdown via `SIGTERM` fails and the moov atom was not written, a post-processing repair step (`ffmpeg -i partial.mp4 -c copy -movflags +faststart repaired.mp4`) is attempted to produce a playable file. The repair command runs with a configurable timeout (env `FFMPEG_REPAIR_TIMEOUT_SECONDS`, default: 30 seconds) and one automatic retry before giving up. If the repair command fails, the **atomic rename to the final filename must not occur**; the original partial file is preserved unmodified at its `.partial` path and the session is marked with `status: "repair_failed"`. Error classification rules for the repair runner:
    - **OOM**: The process is classified as OOM if it was terminated with exit code 137 (128 + SIGKILL), or if its stderr output contains the string `"Killed"` or `"Out of memory"` (case-insensitive match).
    - **ENOSPC**: Classified as ENOSPC if stderr contains `"No space left on device"` or the token `"ENOSPC"` (case-insensitive match).
    - **timeout**: Classified as timeout when the process was explicitly killed by the repair timeout handler (i.e., the `FFMPEG_REPAIR_TIMEOUT_SECONDS` timer expired and the handler sent SIGKILL). The kill reason is recorded as `"Process killed by repair timeout handler after <ms> ms"`.
    - **ffmpeg_error**: All other non-zero exit codes are classified as `"ffmpeg_error"` with the raw exit code and full stderr (truncated to 4 KB) preserved.
    These detection rules populate the `repair_error` object with fields `class` (`"OOM"` | `"ENOSPC"` | `"timeout"` | `"ffmpeg_error"`), `exitCode` (integer | null), `stderr` (string, ≤ 4 KB), and `attempts` (integer — total repair invocations including retries). The `repair_error` object is persisted in the session metadata, written to the application log via `reportError`, and exposed through `GET /api/recording/list` and `POST /api/recording/stop` so operators can trigger alerting, retry the upload, or delete the partial file manually.
  - **File Finalization & Rename**: During recording, the output file is always written with a `.partial` suffix (e.g., `rec_2026-02-19T10-30-00Z.mp4.partial`). Once FFmpeg exits cleanly or post-processing repair succeeds, the system finalizes the file through a multi-step strategy with deterministic error handling:
    1. **Atomic rename** (`fs.rename`): Attempted first with up to 3 retries and exponential backoff (delays: 100 ms, 400 ms, 1600 ms). If the error is `EXDEV` (cross-device link), rename retries are skipped immediately and the system proceeds to the fallback chain. Other retryable errors (e.g., `EACCES`, `EPERM`, `EBUSY`) are retried up to the limit.
    2. **Hardlink + atomic rename** (same-device fallback): If `fs.rename` exhausts retries with an error other than `EXDEV`, the system verifies both paths reside on the same device (via `fs.stat` device ID comparison) and attempts `fs.link(partial, final)` followed by `fs.unlink(partial)`. This preserves atomicity on the same filesystem. On `EXDEV` or device mismatch, the system skips to step 3.
    3. **Copy + fsync + unlink** (cross-device / last-resort fallback): Used when hardlink is not possible (different devices, `EXDEV`) or hardlink fails:
       - **Manifest**: Before copying, a crash-recovery manifest is written to `<finalPath>.manifest.json` containing `{ partialPath, finalPath, checksum (SHA-256 of partial file), timestamp }`. On application startup, the system scans for `.manifest.json` files and reconciles: if both partial and final exist, validates the final file's checksum against the manifest — if valid, removes partial and manifest; if invalid or only partial exists, surfaces both paths to the operator via the session record.
       - **Copy**: `fs.copyFile(partial, final)`. On `ENOSPC`, the system **fails fast**: removes the incomplete copy (if any), sets `status: "finalization_failed"` with `finalFallbackError` containing the `ENOSPC` details, and returns the error immediately without further retries.
       - **fsync**: `fs.open(final)` → `fs.fsync(fd)` → `fs.close(fd)` to ensure the copied data is durable on disk. On failure, the incomplete final file is removed (best-effort) and the error is recorded in `finalFallbackError`.
       - **Unlink**: `fs.unlink(partial)` to remove the temp file. If unlink fails (e.g., `EACCES`), the error is logged via `reportError` but finalization is still considered **successful** since the final file is intact and durable. The manifest is cleaned up after successful unlink.
    4. **Failure**: If all strategies are exhausted, the session is persisted with `status: "finalization_failed"` and the following fields: `partialPath` (location of the `.partial` file), `renameAttempts` (total attempts across all strategies), `lastRenameError` (error message from the final attempt), `attemptedFallbackSteps` (ordered list of strategies tried, e.g., `["hardlink", "copy"]`), `finalFallbackError` (error from the last fallback step), and `manifestPath` (path to the crash-recovery manifest if one was written). On `ENOSPC` at any step, the system fails fast without further retries. The API returns a 500 response with `{ error: "FINALIZATION_FAILED", message: "Failed to finalize recording after <n> rename attempts", partialPath, renameAttempts, lastRenameError, attemptedFallbackSteps, finalFallbackError, manifestPath }` so callers receive an actionable error. Operators can use the `partialPath` and `manifestPath` to locate the file, verify its integrity via the manifest checksum, and retry or clean up manually.
  - **Session Status Values**: The persisted session `status` field has five possible values: `"recording"` (active capture in progress), `"completed"` (clean stop + successful finalization), `"interrupted"` (stream/network failure during capture — partial file preserved, distinct from finalization errors), `"finalization_failed"` (capture succeeded but file rename/copy could not complete — partial file preserved at `partialPath` with recovery details in `renameAttempts`, `lastRenameError`, `attemptedFallbackSteps`, `finalFallbackError`, `manifestPath`), and `"repair_failed"` (post-processing repair exhausted retries — original partial file preserved unmodified, details in `repair_error`). All statuses are visible in `GET /api/recording/list` and `POST /api/recording/stop` responses.

## Security

- All `/api/recording/*` endpoints require Clerk authentication.
- Start/stop recording and MUX upload requires `admin` role (same as slide generation).
- Playback control requires `admin` or `api-client` role.
- The streaming endpoint (`/api/recording/stream/[id]`) requires authentication to prevent unauthorized access to recordings.
- MUX API credentials are stored as environment variables, never exposed in API responses.
- Recording filenames are sanitized (timestamp-based, no user input in filenames).
