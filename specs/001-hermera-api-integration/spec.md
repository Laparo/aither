# Feature Specification: Hemera Academy API Integration

**Feature Branch**: `001-hemera-api-integration`  
**Created**: 2026-02-10  
**Status**: Draft  
**Input**: User description: "Create an integration that retrieves HTML templates and participant data from the API provided by hemera.academy, populates the templates with the data to produce HTML files, and transmits generated data (MUX recording URLs) back to the hemera.academy API"

## Out of Scope

- Synchronisation von Clerk-Nutzern (Aither) mit Nutzerprofilen auf hemera.academy. Die beiden Nutzerverwaltungen bleiben getrennt.
- Full-Screen HTML Player (Prinzip VIII) — wird als eigenständiges Feature spezifiziert.
- Kameraaufnahme und MUX-Upload (Prinzip VIII) — wird als eigenständiges Feature spezifiziert.
- Aither Control API (Prinzip IX) — wird als eigenständiges Feature spezifiziert.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retrieve and Transform Academy Data (Priority: P1)

As a system operator, I want Aither to automatically retrieve HTML templates and participant data from the hemera.academy API, populate the templates with the data, and output completed HTML files, so that personalized academy content is available as static HTML without manual data entry.

**Why this priority**: This is the core value proposition — without template retrieval, data fetching, and template population, there is no integration. Every other feature depends on completed HTML files being successfully generated.

**Independent Test**: Can be fully tested by triggering a data retrieval cycle and verifying that HTML files are generated correctly by populating hemera.academy templates with participant data.

**Acceptance Scenarios**:

1. **Given** Aither is running and the hemera.academy API is reachable, **When** a data retrieval is triggered, **Then** the system fetches HTML templates and participant data from the hemera.academy API and generates completed HTML files by populating the templates.
2. **Given** the hemera.academy API returns valid templates and participant data, **When** the templates are populated, **Then** each generated HTML file is complete, correctly structured, and contains the participant-specific content.
3. **Given** HTML files have previously been generated, **When** a new retrieval is triggered, **Then** existing HTML files are regenerated with the latest templates and data.

---

### User Story 1c - Serve Media Content (Priority: P1)

As a user of Aither, I want to view images and stream videos that originate from hemera.academy, so that I can consume the full academy content (seminars, lessons) directly within Aither.

**Why this priority**: Media content is integral to seminars and lessons. Without the ability to serve images and stream videos, the synced data is incomplete from a user perspective.

**Independent Test**: Can be fully tested by navigating to a synced seminar/lesson in Aither and verifying that images display and videos stream correctly.

**Acceptance Scenarios**:

1. **Given** a synced lesson contains image references, **When** a user views the lesson in Aither, **Then** the images are displayed correctly using the hemera.academy-hosted URLs.
2. **Given** a synced lesson contains video references, **When** a user views the lesson in Aither, **Then** the video streams from the hemera.academy-hosted URL with standard playback controls.
3. **Given** a media URL from hemera.academy becomes unavailable, **When** a user attempts to view the content, **Then** a graceful fallback message is displayed instead of a broken link.

---

### User Story 1b - Transmit Seminar Recording URLs to hemera.academy (Priority: P1)

As a system operator, I want Aither to transmit MUX video recording URLs of seminars back to the hemera.academy API, so that seminar recordings captured and hosted via MUX are linked to their corresponding seminars in the academy platform.

**Why this priority**: Seminar recordings are a key deliverable for participants. Without transmitting the recording URLs back, the academy platform cannot offer recorded content to its users.

**Independent Test**: Can be fully tested by recording a seminar in Aither (stored on MUX), triggering the URL transmission, and verifying that the recording URL appears on the corresponding seminar in hemera.academy via its API.

**Acceptance Scenarios**:

1. **Given** a seminar recording has been stored on MUX and has a playback URL, **When** a data transmission is triggered, **Then** the system sends the MUX video URL to the hemera.academy API, associating it with the correct seminar.
2. **Given** the hemera.academy API rejects the transmitted URL (e.g., seminar not found, validation error), **When** the rejection occurs, **Then** the system logs the error, retains the MUX URL in Aither, and reports the failure to the operator.
3. **Given** the hemera.academy API is unreachable during transmission, **When** the failure occurs, **Then** the system retries with exponential backoff and queues the URL for the next attempt.
4. **Given** a seminar already has a recording URL in hemera.academy, **When** a new recording URL is transmitted for the same seminar, **Then** the system updates the existing URL (does not create a duplicate entry).

---

### User Story 2 - Scheduled Automatic Data Synchronization (Priority: P2)

As a system operator, I want data retrieval from hemera.academy to run on an automatic schedule, so that Aither always contains up-to-date academy data without manual intervention.

**Why this priority**: Automation ensures data freshness and eliminates the need for operators to manually trigger syncs. However, the system must first be able to retrieve and store data (P1) before automation adds value.

**Independent Test**: Can be fully tested by configuring a sync schedule, waiting for the scheduled time to pass, and verifying that new data has been retrieved and stored without manual action.

**Acceptance Scenarios**:

1. **Given** a synchronization schedule is configured, **When** the scheduled time arrives, **Then** the system automatically retrieves HTML templates and participant data from the hemera.academy API and generates updated HTML files by populating the templates.
2. **Given** the previous sync completed successfully, **When** the next scheduled sync runs, **Then** only changes since the last sync are processed (incremental sync) and affected HTML files are regenerated.
3. **Given** a scheduled sync is running, **When** a manual retrieval is also triggered, **Then** the system handles concurrent operations gracefully without data corruption.

---

### User Story 3 - Error Handling and Sync Status Visibility (Priority: P3)

As a system operator, I want to see the status of data synchronizations and be informed of any failures, so that I can intervene quickly when data retrieval fails.

**Why this priority**: Observability is critical for a production integration but relies on the core sync functionality (P1) and scheduling (P2) being in place first.

**Independent Test**: Can be fully tested by simulating a failed API call and verifying that the failure is logged and the status reflects the error.

**Acceptance Scenarios**:

1. **Given** a data retrieval fails (e.g., API unreachable, invalid response), **When** the failure occurs, **Then** the system logs the error with details (timestamp, error type, affected data) and retries according to a configured retry strategy.
2. **Given** synchronization operations have been executed, **When** an operator checks the sync status, **Then** they see the last sync time, status (success/failure), number of records processed, and any error details.
3. **Given** repeated sync failures exceed a threshold, **When** the threshold is reached, **Then** the system notifies the operator through a configured notification channel.

---

### User Story 4 - Access Control for Sync Management (Priority: P4)

As an administrator, I want only authenticated and authorized users (managed via Clerk) to access sync management functions (status dashboard, manual sync trigger, configuration), so that unauthorized users cannot view sensitive sync data or interfere with the data integration.

**Why this priority**: Access control protects the integrity of the integration but depends on the sync functionality (P1–P3) being in place first. Aither already uses Clerk for user management, making this a natural extension.

**Independent Test**: Can be fully tested by attempting to access sync management functions as an unauthenticated user (access denied) and as an authenticated administrator (access granted).

**Acceptance Scenarios**:

1. **Given** a user is not authenticated via Clerk, **When** they attempt to access the sync status dashboard or trigger a manual sync, **Then** access is denied and they are redirected to the login flow.
2. **Given** a user is authenticated via Clerk but does not have an administrator role, **When** they attempt to access sync management functions, **Then** access is denied with an appropriate message.
3. **Given** a user is authenticated via Clerk and has an administrator role, **When** they access sync management functions, **Then** they can view sync status, trigger manual syncs, and modify sync configuration.

---

### Edge Cases

- What happens when the hemera.academy API is temporarily unavailable? The system retries with exponential backoff and logs each attempt.
- What happens when the hemera.academy API returns an empty dataset? The system generates no new HTML files, retains previously generated files, and logs that zero records were returned.
- What happens when the API response format changes unexpectedly? The system rejects malformed data or templates, logs a schema validation error, and retains previously generated HTML files intact.
- What happens when a sync is interrupted mid-process (e.g., crash)? The system re-runs the sync from the beginning on the next trigger to ensure complete HTML generation.
- What happens when the filesystem is unavailable during HTML generation? The system retries the write operation and logs the failure.
- What happens when data transmitted to hemera.academy is rejected due to validation errors? The system logs the rejection details, retains the MUX recording URL in Aither, and marks the record for retry.
- What happens when a media URL from hemera.academy or MUX becomes unavailable? The system displays a graceful fallback message to the user and logs the broken reference for operator review.
- What happens when a MUX recording URL is generated for a seminar that does not exist in hemera.academy? The system logs an "unmatched seminar" error and queues the URL for operator review.
- What happens when the hemera.academy API returns HTTP 429 (rate limit exceeded)? The system respects the `Retry-After` header if present, otherwise applies exponential backoff, and resumes the sync from the last successful record.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST connect to the hemera.academy API and retrieve: (a) HTML templates stored as seminar material on hemera.academy, and (b) participant/content data (seminars, user profiles, texts, images, videos, lessons). Templates and data are fetched separately.
- **FR-002**: System MUST populate the retrieved HTML templates with participant and content data (also from the hemera.academy API) and generate one completed HTML file per entity (e.g., one file per seminar, one per lesson). Data MUST NOT be stored in a local database. Aither does NOT create or design the templates — they are authored on hemera.academy.
- **FR-002b**: System MUST expose an API endpoint that accepts MUX video recording URLs (seminar ID + MUX playback URL). Upon receiving a request, the system MUST transmit the MUX URL directly to the hemera.academy API, associating the recording with the correct seminar. This endpoint is designed to be called by the camera/recording feature after a successful MUX upload. Existing recording URLs for a seminar MUST be updated, not duplicated. Generated data MUST NOT be stored locally before transmission.
- **FR-002c**: System MUST serve media content (images, videos) to Aither users by embedding or proxying hemera.academy-hosted URLs and MUX-hosted video URLs, with graceful fallback for unavailable media.
- **FR-003**: System MUST support incremental synchronization. On each sync, the system performs a full fetch of all data from the hemera.academy API, computes content hashes, and compares them against hashes from the previous sync run. Only entities whose content has changed are re-transformed and their HTML files regenerated. Hash state is stored locally on the filesystem (e.g., JSON manifest). For the write direction (Aither → hemera.academy), this is limited to MUX seminar recording URLs transmitted directly to the API.
- **FR-004**: System MUST support a configurable automatic synchronization schedule. The default sync interval MUST be once daily (every 24 hours). Scheduling is implemented via a system cron job on the Linux host that invokes a sync endpoint or CLI script.
- **FR-005**: System MUST authenticate with the hemera.academy API using an API key, transmitted securely via request header. The API key MUST be stored as a configuration secret and MUST NOT be exposed in logs or client-side code.
- **FR-006**: System MUST validate incoming data (templates and participant data) against expected structure before template population, rejecting malformed records or templates.
- **FR-007**: System MUST implement retry logic with exponential backoff for failed API requests (minimum 3 retries).
- **FR-007b**: System MUST implement request throttling for hemera.academy API calls. Rate limits are currently undocumented; the system MUST defensively throttle requests and respect `Retry-After` headers if returned.
- **FR-008**: System MUST log all sync operations including timestamp, status, number of records fetched/transformed/transmitted, and any errors.
- **FR-009**: System MUST expose sync status information (last run time, status, record count, errors) to operators.
- **FR-010**: System MUST notify operators via e-mail when consecutive sync failures exceed a configurable threshold. E-mail delivery is implemented via SMTP (e.g., sendmail, msmtp, or an external SMTP service).
- **FR-011**: System MUST operate within the constraints of a local Node.js runtime environment.
- **FR-012**: System MUST restrict access to sync management functions (status view, manual sync trigger, configuration) to users authenticated via Clerk.
- **FR-013**: System MUST enforce role-based access — only users with an administrator role in Clerk may access sync management functions.
- **FR-014**: System MUST deny unauthenticated or unauthorized requests to sync management endpoints and return appropriate error responses.

### Key Entities

- **SyncJob**: Represents a single data synchronization execution (transient, in-memory). Key attributes: job ID, start time, end time, status (running/success/failed), records fetched, HTML files generated, records transmitted, error details.
- **Seminar**: A seminar or course offering from the academy (API response shape, not persisted). Key attributes: unique source ID, title, description, schedule/dates, instructor references, associated lessons.
- **UserProfile**: A participant or instructor profile from the academy (API response shape, not persisted). Key attributes: unique source ID, name, role (participant/instructor), associated seminars.
- **Lesson**: An individual lesson within a seminar (API response shape, not persisted). Key attributes: unique source ID, title, ordering/sequence, associated content (texts, media).
- **TextContent**: Textual content associated with lessons or seminars (API response shape, not persisted). Key attributes: unique source ID, body/content, content type, associated entity reference.
- **MediaAsset**: An image or video asset from the academy (API response shape, not persisted). Key attributes: unique source ID, media type (image/video), source URL (hosted at hemera.academy), alt text/caption, file size (metadata only), associated entity reference. Note: only metadata and URLs are referenced in generated HTML; actual files remain hosted at hemera.academy.
- **SyncConfiguration**: Represents the settings for the integration (config file or environment variables). Key attributes: sync schedule/interval, retry policy, notification threshold, API connection details.
- **SeminarRecording**: A video recording of a seminar, hosted on MUX (transient, passed directly to API). Key attributes: associated seminar source ID, MUX asset ID, MUX playback URL, recording date, transmission status (pending/sent/failed).
- **HtmlTemplate**: An HTML template authored and stored on hemera.academy as seminar material (API response shape, not persisted). Key attributes: unique source ID, associated seminar/lesson reference, template markup (HTML with placeholder tokens), version/last-modified indicator. Note: Aither fetches these templates but never creates or modifies them — hemera.academy is the authoring environment.

## Clarifications

### Session 2026-02-10

- Q: Welche Datentypen liefert die hemera.academy API? → A: Seminare, Nutzerprofile, Texte, Bilder, Videos, Lektionen

### Session 2026-02-11

- Q: Ist eine API-Dokumentation für die hemera.academy API vorhanden? → A: Ja, als Postman Collection
- Q: Hat die hemera.academy API Rate Limits? → A: Unbekannt — defensiv implementieren mit eingebautem Throttling
- Q: Wie soll der automatische tägliche Sync auf Linux ausgelöst werden? → A: System-cron-Job
- Q: Welche Größenordnung an Datensätzen wird erwartet? → A: Wenige Hundert Datensätze insgesamt
- Q: Über welchen Kanal sollen Operatoren bei Sync-Fehlern benachrichtigt werden? → A: E-Mail
- Q: Wie sollen Medien-Assets (Bilder, Videos) gespeichert werden? → A: Nur Metadaten und URLs speichern; Dateien bleiben bei hemera.academy
- Q: Welches Sync-Intervall soll als Standard gelten? → A: Einmal täglich (alle 24 Stunden)
- Q: Was liegt explizit außerhalb des Scope? → A: Bidirektionale Datenübertragung und Medien-Streaming/Hosting sind IN Scope. Nur die Synchronisation von Clerk-Nutzern mit hemera.academy-Nutzerprofilen ist OUT of Scope.
- Q: Welche Daten werden von Hemera an die hemera.academy API übertragen? → A: URLs von Videoaufzeichnungen aus dem Seminar, die auf MUX gespeichert werden.

### Session 2026-02-11

- Q: Sollen HTML Player, Kameraaufnahme und Control API (Constitution VIII + IX) in Feature 001 oder als eigene Features geplant werden? → A: Eigene Features — 001 fokussiert auf API-Sync, HTML-Generierung und MUX-URL-Übertragung.
- Q: Wie werden die generierten HTML-Dateien strukturiert — eine pro Entität, eine pro Typ oder eine einzige Datei? → A: Eine HTML-Datei pro Entität (pro Seminar, pro Lektion etc.).
- Q: Wie wird die MUX-URL-Übertragung an hemera.academy ausgelöst? → A: Feature 001 stellt einen API-Endpunkt bereit, den das Kamera-Feature nach erfolgreichem MUX-Upload aufruft.
- Q: Wie wird inkrementeller Sync umgesetzt, wenn die API keinen Timestamp-Filter bietet? → A: Full-Fetch + lokale Hash-Vergleiche — nur geänderte HTML-Dateien werden regeneriert.
- Q: Wer erstellt die HTML-Templates und wie werden sie angepasst? → A: HTML-Vorlagen werden auf hemera.academy erzeugt und als Seminarmaterial gespeichert. Aither ruft diese Vorlagen über die API ab und befüllt sie mit Teilnehmerdaten (ebenfalls von der API).

## Assumptions

- The hemera.academy API provides a RESTful interface with JSON responses (industry standard for web APIs). API documentation is available as a Postman Collection, which serves as the contract reference for implementation and testing.
- Aither runs locally as a stateless application. It does NOT use a local database. HTML templates and participant data are fetched from the hemera.academy API. Aither populates the templates with participant data and outputs completed HTML files. Generated data (e.g., MUX recording URLs) is passed directly to the hemera.academy API without local persistence.
- HTML templates are authored and maintained exclusively on hemera.academy. Aither is a consumer of these templates and never modifies or creates them. The hemera.academy API provides an endpoint to retrieve templates as part of the seminar material.
- The hemera.academy API supports some form of pagination or cursoring for large datasets.
- Expected total data volume is in the low hundreds of records across all entity types (seminars, lessons, user profiles, media assets). Pagination support is still utilized if available but complex batching or streaming optimizations are not required at this scale.
- Incremental sync does NOT depend on API-provided change detection (timestamps, ETags). Instead, the system always performs a full fetch and uses local content hashing to determine which entities have changed. This approach is viable given the low data volume (few hundred records).
- The local runtime does not impose serverless execution time limits; long-running sync operations can execute without batching constraints.
- Scheduled sync is triggered by a system cron job on the Linux host. The cron job calls a sync API endpoint or a CLI script. Schedule configuration is managed through the crontab.
- Notification of failures will use e-mail via SMTP (e.g., sendmail, msmtp, or an external SMTP service). SMTP credentials are stored in the local `.env` file.
- Aither uses Clerk.com for user authentication and role management; an administrator role exists or can be configured in Clerk.
- Media assets (images, videos) are not downloaded or stored locally; only URLs are referenced in generated HTML files. The original files remain hosted at hemera.academy and are embedded by URL.
- Seminar video recordings are captured and stored on MUX (video hosting platform). Aither transmits MUX playback URLs directly to hemera.academy without storing them locally.
- The hemera.academy API provides a write endpoint to associate a recording URL with a seminar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of HTML templates and participant data available through the hemera.academy API is retrievable and usable for HTML generation by Aither.
- **SC-002**: Scheduled synchronization runs reliably with at least 99% uptime over any 30-day period.
- **SC-003**: Generated HTML files reflect the latest state of the hemera.academy API within 24 hours (default sync interval). Operators may configure a shorter interval if needed.
- **SC-004**: Failed synchronizations are automatically retried, with 95% of transient failures resolved without operator intervention.
- **SC-005**: Operators can determine the current sync status and history within 30 seconds of checking.
- **SC-006**: No data loss occurs during sync operations or after failure recovery. Generated HTML files are always consistent with the last successful fetch.
- **SC-007**: 100% of unauthenticated or unauthorized access attempts to sync management functions are blocked.
