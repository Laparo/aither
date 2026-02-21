# Quickstart: Data Synchronization

**Feature**: 005-data-sync

## Prerequisites

| Requirement | How to verify |
|-------------|---------------|
| Hemera running on localhost:3000 | `curl http://localhost:3000/api/health` |
| Aither running on localhost:3500 | `curl http://localhost:3500/api/health` |
| API key configured in both `.env.local` | Both files contain matching `HEMERA_SERVICE_API_KEY` |
| Hemera DB has at least one future course | Check via Hemera admin or `GET /api/service/courses` |
| Course has participants with preparations | At least one booking with `preparationIntent` set |
| `jq` installed (used in steps 1–7 below) | `jq --version` — should print e.g. `jq-1.7` |

## 1. Verify API Connectivity

```bash
# Test that Aither can reach Hemera's course list
curl -s http://localhost:3000/api/service/courses \
  -H "X-API-Key: <your-key>" | jq '.data[0]'
```

Expected: JSON object with `id`, `title`, `slug`, `level`, `startDate`, `endDate`, `participantCount`.

## 2. Trigger a Sync

```bash
# Start the data sync pipeline
curl -s -X POST http://localhost:3500/api/sync \
  -H "Authorization: Bearer <admin-token>" | jq .
```

Expected response (202 Accepted):

```json
{
  "success": true,
  "data": {
    "jobId": "sync-1708523400000",
    "status": "running",
    "startTime": "2026-02-21T14:30:00.000Z"
  },
  "meta": {
    "requestId": "req-abc123",
    "timestamp": "2026-02-21T14:30:00.000Z"
  }
}
```

## 3. Check Sync Status

```bash
# Poll for completion
curl -s http://localhost:3500/api/sync \
  -H "Authorization: Bearer <admin-token>" | jq .
```

Expected response when complete:

```json
{
  "success": true,
  "data": {
    "jobId": "sync-1708523400000",
    "status": "success",
    "startTime": "2026-02-21T14:30:00.000Z",
    "endTime": "2026-02-21T14:30:02.340Z",
    "durationMs": 2340,
    "courseId": "cm5abc123def456ghi",
    "noUpcomingCourse": false,
    "participantsFetched": 5,
    "filesGenerated": 1,
    "filesSkipped": 0,
    "errors": []
  },
  "meta": {
    "requestId": "req-abc123",
    "timestamp": "2026-02-21T14:30:02.340Z"
  }
}
```

## 4. Verify Output Files

```bash
# Check that HTML was generated
ls -la output/courses/

# Inspect the generated HTML
head -20 output/courses/<course-slug>.html

# Verify the manifest was updated
cat output/.sync-manifest.json | jq .
```

## 5. Verify Incremental Sync (Hash Comparison)

```bash
# Run sync again without changing any data
curl -s -X POST http://localhost:3500/api/sync \
  -H "Authorization: Bearer <admin-token>" | jq .

# Wait for completion, then check status
sleep 3
curl -s http://localhost:3500/api/sync \
  -H "Authorization: Bearer <admin-token>" | jq '.data'
```

Expected: `filesGenerated: 0`, `filesSkipped: 1` — the hash matched, so no regeneration occurred.

## 6. Verify Homepage (Live SSR)

```bash
# The homepage fetches data live from Hemera (not from output/ files)
curl -s http://localhost:3500 | grep -i "seminar\|kurs\|course" | head -5
```

Expected: HTML containing the next upcoming course title and participant preparation table.

## 7. Verify Concurrent Guard

```bash
# Start a sync and immediately try a second one
curl -s -X POST http://localhost:3500/api/sync \
  -H "Authorization: Bearer <admin-token>" &
sleep 0.5
curl -s -X POST http://localhost:3500/api/sync \
  -H "Authorization: Bearer <admin-token>" | jq .
```

Expected: Second request returns `409 Conflict` with message about sync already in progress.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Unauthorized` from Hemera | API key mismatch | Compare `HEMERA_SERVICE_API_KEY` in both `.env.local` files |
| `404` on `/api/service/courses` | Hemera not running or wrong port | Start Hemera: `cd ../hemera && npm run dev` |
| `409 Conflict` on POST `/api/sync` | Previous sync still running | Wait for completion or restart Aither dev server |
| `noUpcomingCourse: true` | No courses with `startDate` in the future | Create a future course in Hemera admin |
| `participantCount: 0` | Course has no bookings | Add test bookings via Hemera admin or seed script |
| Empty `preparationIntent` in output | Participants haven't filled preparations | Update participation via Hemera admin |
| `ECONNREFUSED` on sync | Hemera server not reachable | Check Hemera is running on correct port |
| `filesGenerated: 0` unexpectedly | Content hash matches (no changes) | Modify a participant preparation, then re-sync |
