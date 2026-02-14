# Hemera Academy API — Expected Contract (Consumer-Side)

**Feature**: 001-hemera-api-integration  
**Date**: 2026-02-11  
**Source**: Inferred from spec requirements and clarifications. Actual endpoints to be verified against the Postman Collection.

> This document describes the **expected** hemera.academy API endpoints that Aither consumes. It serves as a consumer contract for testing. The actual API may differ — verify against the Postman Collection during implementation.

---

## Authentication

All requests include:
```
Authorization: Bearer {HEMERA_API_KEY}
Content-Type: application/json
```



### Authentication Error Responses

**Error Responses:**

- `401 Unauthorized` — The token is invalid or expired. Example:
  ```json
  { "error": "Unauthorized", "message": "Missing or invalid API key." }
  ```
- `403 Forbidden` — The token is valid, but permissions are insufficient. Example:
  ```json
  { "error": "Forbidden", "message": "Insufficient permissions." }
  ```

**Retry Strategy:**
- For `401 Unauthorized`, a single retry with token refresh is allowed **only if** a runtime refresh mechanism exists (e.g., OAuth or session-based tokens). If authentication uses a static Bearer API key (such as `HEMERA_API_KEY` from environment), a 401 must be reported immediately with **no retry**.
- For `403 Forbidden`, no retry is allowed — the error must be reported directly to the client.

**Note:**
Authentication is performed via the header `Authorization: Bearer {HEMERA_API_KEY}`. The API key is read from `process.env.HEMERA_API_KEY`.

---

## Expected Endpoints


### GET /seminars

Retrieve all seminars.

**Expected Response** (200):
```json
{
  "data": [
    {
      "id": "sem-001",
      "title": "Seminar Title",
      "description": "Description text",
      "dates": [
        { "start": "2026-03-01T09:00:00Z", "end": "2026-03-01T17:00:00Z" }
      ],
      "instructorIds": ["usr-010"],
      "lessonIds": ["les-001", "les-002"],
      "recordingUrl": null
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalPages": 1,
    "totalRecords": 12
  }
}
```
**Error Responses:**
- `401 Unauthorized` — Invalid or missing API key
  ```json
  { "error": "Unauthorized", "message": "Missing or invalid API key." }
  ```
- `404 Not Found` — Resource not found
  ```json
  { "error": "Not Found", "message": "Resource not found." }
  ```
- `429 Too Many Requests` — Rate limit exceeded
  ```json
  { "error": "Too Many Requests", "message": "Rate limit exceeded. Retry later." }
  ```
- `500 Internal Server Error` — Unexpected server error
  ```json
  { "error": "Internal Server Error", "message": "An unexpected error occurred." }
  ```


### GET /lessons

Retrieve all lessons.

**Expected Response** (200):
```json
{
  "data": [
    {
      "id": "les-001",
      "seminarId": "sem-001",
      "title": "Lesson Title",
      "sequence": 1,
      "textContentIds": ["txt-001"],
      "mediaAssetIds": ["med-001"]
    }
  ]
}
```
**Error Responses:**
- `401 Unauthorized` — Invalid or missing API key
  ```json
  { "error": "Unauthorized", "message": "Missing or invalid API key." }
  ```
- `404 Not Found` — Resource not found
  ```json
  { "error": "Not Found", "message": "Resource not found." }
  ```
- `429 Too Many Requests` — Rate limit exceeded
  ```json
  { "error": "Too Many Requests", "message": "Rate limit exceeded. Retry later." }
  ```
- `500 Internal Server Error` — Unexpected server error
  ```json
  { "error": "Internal Server Error", "message": "An unexpected error occurred." }
  ```


### GET /users

Retrieve user profiles (participants and instructors).

**Expected Response** (200):
```json
{
  "data": [
    {
      "id": "usr-010",
      "name": "Instructor Name",
      "email": "instructor@example.com",
      "role": "instructor",
      "seminarIds": ["sem-001"]
    }
  ]
}
```
**Error Responses:**
- `401 Unauthorized` — Invalid or missing API key
  ```json
  { "error": "Unauthorized", "message": "Missing or invalid API key." }
  ```
- `404 Not Found` — Resource not found
  ```json
  { "error": "Not Found", "message": "Resource not found." }
  ```
- `429 Too Many Requests` — Rate limit exceeded
  ```json
  { "error": "Too Many Requests", "message": "Rate limit exceeded. Retry later." }
  ```
- `500 Internal Server Error` — Unexpected server error
  ```json
  { "error": "Internal Server Error", "message": "An unexpected error occurred." }
  ```


### GET /texts

Retrieve text content blocks.

**Expected Response** (200):
```json
{
  "data": [
    {
      "id": "txt-001",
      "entityRef": { "type": "lesson", "id": "les-001" },
      "body": "<p>Lesson content...</p>",
      "contentType": "html"
    }
  ]
}
```
**Error Responses:**
- `401 Unauthorized` — Invalid or missing API key
  ```json
  { "error": "Unauthorized", "message": "Missing or invalid API key." }
  ```
- `404 Not Found` — Resource not found
  ```json
  { "error": "Not Found", "message": "Resource not found." }
  ```
- `429 Too Many Requests` — Rate limit exceeded
  ```json
  { "error": "Too Many Requests", "message": "Rate limit exceeded. Retry later." }
  ```
- `500 Internal Server Error` — Unexpected server error
  ```json
  { "error": "Internal Server Error", "message": "An unexpected error occurred." }
  ```


### GET /media

Retrieve media asset metadata.

**Expected Response** (200):
```json
{
  "data": [
    {
      "id": "med-001",
      "entityRef": { "type": "lesson", "id": "les-001" },
      "mediaType": "image",
      "sourceUrl": "https://hemera.academy/media/img001.jpg",
      "altText": "Diagram",
      "fileSize": 245000
    }
  ]
}
```
**Error Responses:**
- `401 Unauthorized` — Invalid or missing API key
  ```json
  { "error": "Unauthorized", "message": "Missing or invalid API key." }
  ```
- `404 Not Found` — Resource not found
  ```json
  { "error": "Not Found", "message": "Resource not found." }
  ```
- `429 Too Many Requests` — Rate limit exceeded
  ```json
  { "error": "Too Many Requests", "message": "Rate limit exceeded. Retry later." }
  ```
- `500 Internal Server Error` — Unexpected server error
  ```json
  { "error": "Internal Server Error", "message": "An unexpected error occurred." }
  ```


### GET /templates

Retrieve HTML templates (seminar material).

**Expected Response** (200):
```json
{
  "data": [
    {
      "id": "tpl-001",
      "seminarId": "sem-001",
      "lessonId": "les-001",
      "markup": "<html><body><h1>{{seminarTitle}}</h1><p>Teilnehmer: {{participantName}}</p></body></html>",
      "version": "2026-02-10T12:00:00Z"
    }
  ]
}
```
**Error Responses:**
- `401 Unauthorized` — Invalid or missing API key
  ```json
  { "error": "Unauthorized", "message": "Missing or invalid API key." }
  ```
- `404 Not Found` — Resource not found
  ```json
  { "error": "Not Found", "message": "Resource not found." }
  ```
- `429 Too Many Requests` — Rate limit exceeded
  ```json
  { "error": "Too Many Requests", "message": "Rate limit exceeded. Retry later." }
  ```
- `500 Internal Server Error` — Unexpected server error
  ```json
  { "error": "Internal Server Error", "message": "An unexpected error occurred." }
  ```

### PUT /seminars/{id}/recording

Transmit a MUX recording URL for a seminar.

**Request Body**:
```json
{
  "muxAssetId": "asset-abc123",
  "muxPlaybackUrl": "https://stream.mux.com/abc123.m3u8",
  "recordingDate": "2026-02-11T10:00:00Z"
}
```

**Expected Response** (200):
```json
{
  "status": 200,
  "message": "Recording URL updated"
}
```

**Error Responses**:
- `404`: Seminar not found
- `422`: Validation error (invalid URL format, missing fields)
- `429`: Rate limit exceeded (check `Retry-After` header)
- `500`: Server error

---



## Pagination

The following table shows which GET endpoints support pagination:

| Endpoint    | Pagination Supported | Details                                                        |
|-------------|---------------------|----------------------------------------------------------------|
| /seminars   | Yes                 | Standard page-based pagination, see example above              |
| /lessons    | No                  | Returns all lessons in a single response                       |
| /users      | No                  | Returns all users in a single response                         |
| /texts      | No                  | Returns all texts in a single response                         |
| /media      | No                  | Returns all media in a single response                         |
| /templates  | No                  | Returns all templates in a single response                     |

**Note:**
- Only `/seminars` supports pagination with a `pagination` object and query parameters `?page=1&pageSize=50`.
- All other endpoints return complete datasets without pagination.

---

## Rate Limits

Unknown. Aither implements:
- Defensive throttling at 2 req/s (adaptive)
- Respects `Retry-After` header on 429 responses
- Exponential backoff with jitter on failures

---


## Notes


- **PII protection for GET /users:** The /users response contains names and email addresses. These data must **never** be logged, must be redacted in error logs and monitoring, and implementations must avoid emitting raw PII (e.g., email, name) in logs or metrics. Handlers for GET /users must apply redaction and safe logging/metrics practices.

- **These are EXPECTED shapes** — verify each endpoint against the actual Postman Collection before implementation
- **Field names may differ** — create mapping layer in `lib/hemera/schemas.ts` to normalize API responses to internal types
- **The template placeholder format** (e.g., `{{variable}}`) must be confirmed with the hemera.academy team
