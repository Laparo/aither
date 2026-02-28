# Quickstart: Participant Slides

**Feature**: 006-participant-slides

## Prerequisites

| Requirement | How to verify |
|-------------|---------------|
| Hemera running on localhost:3000 | `curl http://localhost:3000/api/health` |
| Aither running on localhost:3500 | `curl http://localhost:3500/api/health` |
| API key configured in both `.env.local` | Both files contain matching `HEMERA_SERVICE_API_KEY` |
| Hemera DB has at least one future course | Check via Hemera admin or `GET /api/service/courses` |
| Course has participants with preparations | At least one booking with `preparationIntent` set |
| Course has materials with HTML content | At least one `CourseMaterial` uploaded to Vercel Blob |
| `jq` installed (used in steps below) | `jq --version` — should print e.g. `jq-1.7` |

## 1. Verify Materials API Connectivity

```bash
# Fetch materials for a course (replace <course-id> with a real ID)
curl -s http://localhost:3000/api/service/courses/<course-id>/materials \
  -H "X-API-Key: <your-key>" | jq '.data.topics[0]'
```

Expected: JSON object with `topicId`, `topicTitle`, and `materials[]` array containing `materialId`, `identifier`, `title`, `sortOrder`, `htmlContent`.

## 2. Verify Course Detail (Participants)

```bash
# Fetch course detail including participants
curl -s http://localhost:3000/api/service/courses/<course-id> \
  -H "X-API-Key: <your-key>" | jq '.data.participants[0]'
```

Expected: JSON object with `name`, `status`, `preparationIntent`, `desiredResults`, `lineManagerProfile`, `preparationCompletedAt`.

## 3. Run a Data Sync (Pre-Requisite)

```bash
# Trigger sync to populate output/courses/
curl -s -X POST http://localhost:3500/api/sync \
  -H "Authorization: Bearer <admin-token>" | jq .
```

Wait for sync to complete. This ensures the slide generator has access to the latest course data.

## 4. Generate Slides

```bash
# Trigger slide generation for the next upcoming course
curl -s -X POST http://localhost:3500/api/slides/generate \
  -H "Authorization: Bearer <admin-token>" | jq .
```

Expected response:

```json
{
  "success": true,
  "data": {
    "courseId": "cm5abc123def456ghi",
    "totalSlides": 42,
    "materialSlides": 36,
    "modeACount": 2,
    "modeBCount": 3,
    "skippedSections": 0,
    "durationMs": 1230,
    "errors": []
  }
}
```

## 5. Verify Output Files

```bash
# Check that slide HTML files were generated
ls -la output/slides/<course-id>/

# Inspect a Mode A slide (section iteration)
head -30 output/slides/<course-id>/03_material_<topicIdx>_<section>_01.html

# Inspect a Mode B slide (identifier distribution)
head -30 output/slides/<course-id>/video-analysis-01.html
```

### Mode A Output Structure

Mode A produces files named by topic/section/iteration index:

```
output/slides/<course-id>/
├── 01_intro.html
├── 02_curriculum.html
├── 03_material_01_01_01.html   # Topic 1, Section 1, Participant 1
├── 03_material_01_01_02.html   # Topic 1, Section 1, Participant 2
├── 03_material_01_02_01.html   # Topic 1, Section 2 (static)
└── ...
```

### Mode B Output Structure

Mode B produces files named by identifier + sequential number:

```
output/slides/<course-id>/
├── video-analysis-01.html      # Participant 1 (Alice)
├── video-analysis-02.html      # Participant 2 (Bob)
├── video-analysis-03.html      # Participant 3 (Charlie)
└── ...
```

## 6. Verify Clean + Regenerate

```bash
# Count existing slides
ls output/slides/<course-id>/ | wc -l

# Regenerate (should delete old slides first, then recreate)
curl -s -X POST http://localhost:3500/api/slides/generate \
  -H "Authorization: Bearer <admin-token>" | jq .

# Count again — should match (no orphaned files)
ls output/slides/<course-id>/ | wc -l
```

## 7. Verify Scalar-Only Mode

```bash
# Check a material that contains only scalar placeholders (no {participant:*})
# e.g., a title slide with just {courseTitle} and {courseDate}
cat output/slides/<course-id>/03_material_02_01_01.html | grep -i "kurs\|datum\|course"
```

Expected: Scalar placeholders replaced with actual values, no iteration.

## 8. Verify Error Handling (Materials API Down)

```bash
# Stop Hemera, then run slide generation
# Slides from Intro + Curriculum should still generate
# Material slides will be skipped with Rollbar warning
curl -s -X POST http://localhost:3500/api/slides/generate \
  -H "Authorization: Bearer <admin-token>" | jq '.data.errors'
```

Expected: `errors` array contains material fetch failure, `materialSlides: 0`, but `totalSlides > 0` (intro + curriculum still generated).

## Run Tests

```bash
# Unit tests for the template engine and related modules
npx vitest run tests/unit/template-engine.spec.ts
npx vitest run tests/unit/section-parser.spec.ts
npx vitest run tests/unit/mode-detector.spec.ts
npx vitest run tests/unit/identifier-distributor.spec.ts
npx vitest run tests/unit/slide-context.spec.ts

# All unit tests
npx vitest run tests/unit/

# Contract tests
npx vitest run tests/contract/
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Unauthorized` from Materials API | API key mismatch | Compare `HEMERA_SERVICE_API_KEY` in both `.env.local` files |
| `404` on `/api/service/courses/{id}/materials` | Course has no materials or wrong ID | Verify course exists with materials in Hemera admin |
| `materialSlides: 0` | Materials API unreachable or no HTML content | Check Hemera is running; verify Blob storage has HTML uploads |
| Mode B 1:1 mismatch warning | Participant count ≠ curriculum link count | Ensure each Mode B template is linked once per participant in curriculum |
| Empty `{participant:name}` in output | Participants missing from course detail | Add bookings with participant data in Hemera admin |
| `ECONNREFUSED` on materials fetch | Hemera server not reachable | Check Hemera is running on correct port |
| Orphaned slides after re-generation | Clean step failed | Check write permissions on `output/slides/` directory |
| `htmlContent: null` for a material | Blob storage upload missing | Upload HTML content for the material in Hemera admin |
