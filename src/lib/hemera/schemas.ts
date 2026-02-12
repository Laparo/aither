// ---------------------------------------------------------------------------
// Hemera Academy API — Zod Validation Schemas
// Derived from: specs/001-hemera-api-integration/data-model.md
// ---------------------------------------------------------------------------

import { z } from "zod";

// --- HtmlTemplate ---

export const HtmlTemplateSchema = z.object({
	sourceId: z.string().min(1),
	seminarId: z.string().nullable(),
	lessonId: z.string().nullable(),
	markup: z.string().min(1),
	version: z.string().nullable(),
});

// --- Seminar ---

export const SeminarDateSchema = z.object({
	start: z.string().datetime({ offset: true }),
	end: z.string().datetime({ offset: true }),
});

export const SeminarSchema = z.object({
	sourceId: z.string().min(1),
	title: z.string().min(1),
	description: z.string().nullable(),
	dates: z.array(SeminarDateSchema),
	instructorIds: z.array(z.string()),
	lessonIds: z.array(z.string()),
	recordingUrl: z.string().url().nullable(),
});

// --- UserProfile ---

export const UserProfileSchema = z.object({
	sourceId: z.string().min(1),
	name: z.string().min(1),
	email: z.string().email().nullable(),
	role: z.enum(["participant", "instructor"]),
	seminarIds: z.array(z.string()),
});

// --- Lesson ---

export const LessonSchema = z.object({
	sourceId: z.string().min(1),
	seminarId: z.string().min(1),
	title: z.string().min(1),
	sequence: z.number().int().nonnegative(),
	textContentIds: z.array(z.string()),
	mediaAssetIds: z.array(z.string()),
});

// --- TextContent ---

export const EntityRefSchema = z.object({
	type: z.enum(["seminar", "lesson"]),
	id: z.string().min(1),
});

export const TextContentSchema = z.object({
	sourceId: z.string().min(1),
	entityRef: EntityRefSchema,
	body: z.string().min(1),
	contentType: z.enum(["text", "html", "markdown"]),
});

// --- MediaAsset ---

export const MediaAssetSchema = z.object({
	sourceId: z.string().min(1),
	entityRef: EntityRefSchema,
	mediaType: z.enum(["image", "video"]),
	sourceUrl: z.string().url(),
	altText: z.string().nullable(),
	fileSize: z.number().nonnegative().nullable(),
});

// --- SeminarRecording ---

export const SeminarRecordingSchema = z.object({
	seminarSourceId: z.string().min(1),
	muxAssetId: z.string().min(1),
	muxPlaybackUrl: z.string().url(),
	recordingDate: z.string().datetime({ offset: true }),
});

// --- Array wrappers for API list responses ---

export const SeminarsResponseSchema = z.array(SeminarSchema);
export const LessonsResponseSchema = z.array(LessonSchema);
export const UserProfilesResponseSchema = z.array(UserProfileSchema);
export const TextContentsResponseSchema = z.array(TextContentSchema);
export const MediaAssetsResponseSchema = z.array(MediaAssetSchema);
export const HtmlTemplatesResponseSchema = z.array(HtmlTemplateSchema);
