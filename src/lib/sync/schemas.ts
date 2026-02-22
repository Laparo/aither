// ---------------------------------------------------------------------------
// Aither Sync API — Zod Validation Schemas
// Derived from: specs/001-hemera-api-integration/contracts/aither-sync-api.yaml
// ---------------------------------------------------------------------------

import { z } from "zod";

// --- Sync Job Response ---

export const SyncErrorSchema = z.object({
	entity: z.string(),
	message: z.string(),
	timestamp: z.string().datetime({ offset: true }),
});

export const SyncJobResponseSchema = z.object({
	jobId: z.string().uuid(),
	status: z.enum(["running", "success", "failed"]),
	startTime: z.string().datetime({ offset: true }),
	endTime: z.string().datetime({ offset: true }).nullable(),
	recordsFetched: z.number().int().nonnegative(),
	htmlFilesGenerated: z.number().int().nonnegative(),
	htmlFilesSkipped: z.number().int().nonnegative(),
	recordsTransmitted: z.number().int().nonnegative(),
	errors: z.array(SyncErrorSchema),
});

// --- Recording Transmit Request ---

export const RecordingTransmitRequestSchema = z.object({
	seminarSourceId: z.string().min(1),
	muxAssetId: z.string().min(1),
	muxPlaybackUrl: z.string().url(),
	recordingDate: z.string().datetime({ offset: true }),
});

// --- Recording Transmit Response ---

export const RecordingTransmitResponseSchema = z.object({
	success: z.boolean(),
	seminarSourceId: z.string(),
	hemeraResponse: z
		.object({
			status: z.number().int(),
			message: z.string(),
		})
		.optional(),
});

// --- Error Responses ---

export const ErrorResponseSchema = z.object({
	error: z.string(),
	message: z.string(),
	jobId: z.string().uuid().optional(),
	seminarSourceId: z.string().optional(),
});

export const ValidationErrorDetailSchema = z.object({
	field: z.string(),
	message: z.string(),
});

export const ValidationErrorResponseSchema = z.object({
	error: z.string(),
	message: z.string(),
	details: z.array(ValidationErrorDetailSchema),
});

// --- Data Sync API schemas (005-data-sync, contracts/sync-api.yaml) ---

/** Shared response metadata envelope */
export const ResponseMetaSchema = z.object({
	requestId: z.string(),
	timestamp: z.string(),
	version: z.string().optional(),
});

/** Full DataSyncJob shape returned by GET /api/sync */
export const DataSyncJobSchema = z.object({
	jobId: z.string(),
	status: z.enum(["running", "success", "failed"]),
	startTime: z.string(),
	endTime: z.string().nullable(),
	durationMs: z.number().int().nonnegative().nullable(),
	courseId: z.string().nullable(),
	noUpcomingCourse: z.boolean(),
	participantsFetched: z.number().int().nonnegative(),
	filesGenerated: z.number().int().nonnegative(),
	filesSkipped: z.number().int().nonnegative(),
	errors: z.array(SyncErrorSchema),
});

/** POST /api/sync → 202 response envelope */
export const SyncStartedResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		jobId: z.string(),
		status: z.literal("running"),
		startTime: z.string(),
	}),
	meta: ResponseMetaSchema,
});

/** GET /api/sync → 200 response envelope */
export const SyncStatusResponseSchema = z.object({
	success: z.literal(true),
	data: DataSyncJobSchema,
	meta: ResponseMetaSchema,
});

/** Error response envelope (409, 404, 401, 500) */
export const SyncErrorResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
	}),
	meta: ResponseMetaSchema,
});
