# Quickstart: Video & Audio Recording Module

**Spec**: `specs/004-recording-module/spec.md`

## Prerequisites

1. **FFmpeg** installed on the host machine:
   ```bash
   # macOS
   brew install ffmpeg

   # Ubuntu/Debian
   sudo apt install ffmpeg

   # Verify
   ffmpeg -version
   ```

2. **WLAN webcam** accessible from the server (RTSP, HTTP, or MJPEG stream).

   **Finding your stream URL**: Check the camera's admin web interface (usually at `http://<camera-ip>/`) for the stream path. You can also use ONVIF discovery tools or the manufacturer's app. Common URL formats:
   - RTSP: `rtsp://<ip>:554/stream1` or `rtsp://<ip>:554/h264`
   - HTTP: `http://<ip>/video.cgi` or `http://<ip>/videostream.cgi`
   - MJPEG: `http://<ip>/mjpeg/1` or `http://<ip>:8080/video`

   Consult the camera documentation or manufacturer support for the exact path. See also: [ONVIF Device Manager](https://sourceforge.net/projects/onvifdm/) for ONVIF-compatible cameras.

3. **Clerk authentication** — all API endpoints require a Bearer token:
   ```env
   # Add to .env.local
   CLERK_SECRET_KEY=your_clerk_secret_key
   ```
   Obtain a Bearer token from the [Clerk Dashboard](https://dashboard.clerk.com/) or via the Clerk SDK. Set it before calling any API:
   ```bash
   export CLERK_TOKEN="your_bearer_token_here"
   ```
   All `curl` examples below use `$CLERK_TOKEN` for authentication.

4. **Environment variables** added to `.env.local`:
   ```env
   WEBCAM_STREAM_URL=rtsp://192.168.1.100:554/stream
   # Optional — defaults to output/recordings
   RECORDINGS_OUTPUT_DIR=output/recordings
   ```

## Quick Test: Record and Play

### 1. Start a recording

```bash
curl -X POST http://localhost:3000/api/recording/start \
  -H "Authorization: Bearer $CLERK_TOKEN"
```

Response:
```json
{
  "sessionId": "rec_2026-02-19T10-30-00Z",
  "filename": "rec_2026-02-19T10-30-00Z.mp4",
  "startedAt": "2026-02-19T10:30:00.000Z"
}
```

### 2. Check status

```bash
curl http://localhost:3000/api/recording/status \
  -H "Authorization: Bearer $CLERK_TOKEN"
```

### 3. Stop the recording

```bash
curl -X POST http://localhost:3000/api/recording/stop \
  -H "Authorization: Bearer $CLERK_TOKEN"
```

Response:
```json
{
  "sessionId": "rec_2026-02-19T10-30-00Z",
  "filename": "rec_2026-02-19T10-30-00Z.mp4",
  "duration": 45,
  "fileSize": 8400000,
  "filePath": "output/recordings/rec_2026-02-19T10-30-00Z.mp4"
}
```

### 4. List recordings

```bash
curl http://localhost:3000/api/recording/list \
  -H "Authorization: Bearer $CLERK_TOKEN"
```

### 5. Open the player

Navigate to: `http://localhost:3000/recording/player/rec_2026-02-19T10-30-00Z`

The page opens a full-screen `<video>` element with no UI controls. It connects to the SSE endpoint and waits for playback commands.

### 6. Control playback

```bash
# Play
curl -X POST http://localhost:3000/api/recording/playback/play \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recordingId": "rec_2026-02-19T10-30-00Z"}'

# Rewind 30 seconds
curl -X POST http://localhost:3000/api/recording/playback/rewind \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recordingId": "rec_2026-02-19T10-30-00Z", "seconds": 30}'

# Fast-forward 60 seconds
curl -X POST http://localhost:3000/api/recording/playback/forward \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recordingId": "rec_2026-02-19T10-30-00Z", "seconds": 60}'

# Pause
curl -X POST http://localhost:3000/api/recording/playback/stop \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recordingId": "rec_2026-02-19T10-30-00Z"}'
```

### 7. Delete a recording

```bash
curl -X DELETE http://localhost:3000/api/recording/rec_2026-02-19T10-30-00Z \
  -H "Authorization: Bearer $CLERK_TOKEN"
```

## Running Tests

```bash
# Unit tests (FFmpeg mocked)
pnpm test:unit -- tests/unit/ffmpeg-capture.spec.ts
pnpm test:unit -- tests/unit/session-manager.spec.ts
pnpm test:unit -- tests/unit/playback-controller.spec.ts
pnpm test:unit -- tests/unit/file-manager.spec.ts

# Contract tests (API routes)
pnpm test:contract -- tests/contract/recording-api.contract.spec.ts
pnpm test:contract -- tests/contract/playback-api.contract.spec.ts

# All recording tests
pnpm vitest run --reporter=verbose tests/unit/ffmpeg-capture.spec.ts tests/unit/session-manager.spec.ts tests/unit/playback-controller.spec.ts tests/unit/file-manager.spec.ts tests/contract/recording-api.contract.spec.ts tests/contract/playback-api.contract.spec.ts
```

## Architecture at a Glance

```
┌──────────────┐   RTSP/HTTP    ┌──────────────────┐   file write   ┌─────────────────────┐
│ WLAN Webcam  │ ─────────────> │ FFmpeg (child     │ ─────────────> │ output/recordings/   │
│              │                │ process)          │                │ rec_*.mp4            │
└──────────────┘                └──────────────────┘                └─────────────────────┘
                                        │                                     │
                                        │ spawned by                          │ served by
                                        ▼                                     ▼
                                ┌──────────────────┐   HTTP Range    ┌─────────────────────┐
                                │ Recording API    │ <────────────── │ Streaming API        │
                                │ start/stop/      │                 │ /api/recording/      │
                                │ status/list      │                 │ stream/[id]          │
                                └──────────────────┘                 └─────────────────────┘
                                                                              │
                                                                              │ <video src=>
                                                                              ▼
                                ┌──────────────────┐   SSE commands  ┌─────────────────────┐
                                │ Playback API     │ ──────────────> │ Player Page          │
                                │ play/stop/       │                 │ /recording/player/   │
                                │ rewind/forward   │ <────────────── │ [id]                 │
                                └──────────────────┘  POST state     └─────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/recording/session-manager.ts` | Recording session lifecycle (start/stop/status) |
| `src/lib/recording/ffmpeg-capture.ts` | FFmpeg child process management |
| `src/lib/recording/file-manager.ts` | Filesystem operations (list, delete, metadata) |
| `src/lib/recording/playback-controller.ts` | Playback state and SSE command dispatch |
| `src/lib/recording/schemas.ts` | Zod schemas for all request/response types |
| `src/lib/recording/types.ts` | TypeScript type definitions |
| `src/app/api/recording/start/route.ts` | POST start recording endpoint |
| `src/app/api/recording/stop/route.ts` | POST stop recording endpoint |
| `src/app/api/recording/status/route.ts` | GET recording status endpoint |
| `src/app/api/recording/list/route.ts` | GET list recordings endpoint |
| `src/app/api/recording/[id]/route.ts` | DELETE recording endpoint |
| `src/app/api/recording/stream/[id]/route.ts` | GET stream file endpoint |
| `src/app/api/recording/playback/play/route.ts` | POST play command |
| `src/app/api/recording/playback/stop/route.ts` | POST pause command |
| `src/app/api/recording/playback/rewind/route.ts` | POST rewind command |
| `src/app/api/recording/playback/forward/route.ts` | POST forward command |
| `src/app/api/recording/playback/state/route.ts` | POST player state report |
| `src/app/api/recording/events/route.ts` | GET SSE endpoint |
| `src/app/recording/player/[id]/page.tsx` | Full-screen player page |
