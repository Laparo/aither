// ---------------------------------------------------------------------------
// Hemera Academy API — Entity Types
// Derived from: specs/001-hemera-api-integration/data-model.md
// ---------------------------------------------------------------------------

/** HTML template authored on hemera.academy. Fetched via API. Never modified by Aither. */
export interface HtmlTemplate {
	sourceId: string;
	seminarId: string | null;
	lessonId: string | null;
	markup: string;
	version: string | null;
}

/** A course offering from the academy. API response shape. */
export interface Seminar {
	sourceId: string;
	title: string;
	description: string | null;
	dates: { start: string; end: string }[];
	instructorIds: string[];
	lessonIds: string[];
	recordingUrl: string | null;
}

/** A participant or instructor profile. API response shape. */
export interface UserProfile {
	sourceId: string;
	name: string;
	email: string | null;
	role: "participant" | "instructor";
	seminarIds: string[];
}

/** An individual lesson within a seminar. API response shape. */
export interface Lesson {
	sourceId: string;
	seminarId: string;
	title: string;
	sequence: number;
	textContentIds: string[];
	mediaAssetIds: string[];
}

/** Textual content associated with lessons or seminars. API response shape. */
export interface TextContent {
	sourceId: string;
	entityRef: { type: "seminar" | "lesson"; id: string };
	body: string;
	contentType: "text" | "html" | "markdown";
}

/** Image or video asset metadata. Actual files remain hosted at hemera.academy. */
export interface MediaAsset {
	sourceId: string;
	entityRef: { type: "seminar" | "lesson"; id: string };
	mediaType: "image" | "video";
	sourceUrl: string;
	altText: string | null;
	fileSize: number | null;
}

/** MUX video recording reference. Transient — passed directly to hemera.academy API. */
export interface SeminarRecording {
	seminarSourceId: string;
	muxAssetId: string;
	muxPlaybackUrl: string;
	recordingDate: string;
}
