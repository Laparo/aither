# Quickstart: 008 — Controller Bridge Endpoints

## Prerequisites

- Aither running locally (`npm run dev`)
- Valid auth context for protected API routes
- At least one generated course presentation with slide files

## 1. Verify Manifest Endpoint

```bash
curl -s "http://localhost:3500/api/slides/controller?courseId=<course-id>" \
  -H "Authorization: Bearer <token>" | jq .
```

Expected:
- `success: true`
- `data.slides` sorted by `index`
- `data.activeSlideIndex` points to an existing entry

## 2. Verify Navigation Endpoint (next)

```bash
curl -s -X POST "http://localhost:3500/api/slides/controller/navigation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "presentationId": "<presentation-id>",
    "command": "next",
    "fromIndex": 0,
    "requestId": "qs-next-001"
  }' | jq .
```

Expected:
- `success: true`
- `activeSlideIndex` increments within bounds

## 3. Verify Navigation Conflict

Reuse an outdated `fromIndex`:

```bash
curl -s -X POST "http://localhost:3500/api/slides/controller/navigation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "presentationId": "<presentation-id>",
    "command": "next",
    "fromIndex": 0,
    "requestId": "qs-conflict-001"
  }' | jq .
```

Expected:
- `success: false`
- `error.code: INDEX_CONFLICT`
- no state mutation

## 4. Run Focused Tests

```bash
npx vitest run tests/contracts/controller-endpoints.spec.ts
npx vitest run tests/unit/controller-manifest.spec.ts
npx vitest run tests/unit/controller-navigation.spec.ts
```

## 5. Security Sanity Check

Call both endpoints without auth and verify `401 UNAUTHORIZED` responses that do not expose secret values.
