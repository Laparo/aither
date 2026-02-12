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
