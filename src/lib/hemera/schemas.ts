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

// --- Service API schemas ---

/** Allowed values for participation result outcomes */
export const ResultOutcomeEnum = z.enum(["passed", "failed", "incomplete", "pending"]);

export type ResultOutcome = z.infer<typeof ResultOutcomeEnum>;

export const ParticipationSchema = z.object({
	id: z.string().min(1),
	courseId: z.string().min(1),
	userId: z.string().min(1),
	resultOutcome: ResultOutcomeEnum.nullable(),
	resultNotes: z.string().max(2000).nullable(),
});

export const CourseWithParticipantsSchema = SeminarSchema.extend({
	participations: z.array(ParticipationSchema),
});

export const CoursesResponseSchema = z.array(CourseWithParticipantsSchema);
export const ParticipationResponseSchema = ParticipationSchema;

// --- Inferred types for service API ---

export type Participation = z.infer<typeof ParticipationSchema>;
export type CourseWithParticipants = z.infer<typeof CourseWithParticipantsSchema>;
export type CoursesResponse = z.infer<typeof CoursesResponseSchema>;

// --- Service API envelope schemas (actual response format) ---

/** Course summary as returned by GET /api/service/courses */
export const ServiceCourseSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	slug: z.string().min(1),
	level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
	startDate: z.string().datetime({ offset: true }).nullable(),
	endDate: z.string().datetime({ offset: true }).nullable(),
	participantCount: z.number().int().nonnegative(),
});

export type ServiceCourse = z.infer<typeof ServiceCourseSchema>;

/** Standard envelope returned by Hemera service API */
export const ServiceCoursesResponseSchema = z.object({
	success: z.boolean(),
	data: z.array(ServiceCourseSchema),
	meta: z.object({
		requestId: z.string(),
		timestamp: z.string(),
		version: z.string(),
	}),
});

export type ServiceCoursesResponse = z.infer<typeof ServiceCoursesResponseSchema>;

// --- Service API: Course Detail with Participants ---

/** Participant within a course detail response (from Hemera GET /api/service/courses/[id]) */
export const ServiceParticipantSchema = z.object({
	participationId: z.string(),
	userId: z.string(),
	name: z.string().nullable(),
	status: z.string(),
	preparationIntent: z.string().nullable(),
	desiredResults: z.string().nullable(),
	lineManagerProfile: z.string().nullable(),
	preparationCompletedAt: z.string().nullable(),
});

export type ServiceParticipant = z.infer<typeof ServiceParticipantSchema>;

/** Course detail with nested participants (from Hemera GET /api/service/courses/[id]) */
export const ServiceCourseDetailSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	slug: z.string().min(1),
	level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
	startDate: z.string().datetime({ offset: true }).nullable(),
	endDate: z.string().datetime({ offset: true }).nullable(),
	participants: z.array(ServiceParticipantSchema),
});

export type ServiceCourseDetail = z.infer<typeof ServiceCourseDetailSchema>;

/** Envelope for Hemera course detail response */
export const ServiceCourseDetailResponseSchema = z.object({
	success: z.boolean(),
	data: ServiceCourseDetailSchema,
	meta: z
		.object({
			requestId: z.string().optional(),
			timestamp: z.string().optional(),
			version: z.string().optional(),
		})
		.optional(),
});

export type ServiceCourseDetailResponse = z.infer<typeof ServiceCourseDetailResponseSchema>;
