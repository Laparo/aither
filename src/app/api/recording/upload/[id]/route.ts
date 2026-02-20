// ---------------------------------------------------------------------------
// POST /api/recording/upload/[id] — Upload recording to MUX
// Task: T037 [US6] — Auth requireAdmin, validate recording exists, check MUX
//                     credentials, upload via mux-uploader, forward URL via
//                     transmitRecording, return 200/207/404/409/502/503
// ---------------------------------------------------------------------------

import { requireAdmin } from "@/lib/auth/role-check";
import { createHemeraClient } from "@/lib/hemera/factory";
import { reportError } from "@/lib/monitoring/rollbar-official";
import { getRecordingById } from "@/lib/recording/file-manager";
import { uploadToMux } from "@/lib/recording/mux-uploader";
import { MuxUploadRequestSchema } from "@/lib/recording/schemas";
import { isRecording } from "@/lib/recording/session-manager";
import { transmitRecording } from "@/lib/sync/recording-transmitter";
import { ErrorCodes, createErrorResponse, createSuccessResponse } from "@/lib/utils/api-response";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	type AuthenticatedRequest = NextRequest & { auth?: unknown };
	const auth = (req as AuthenticatedRequest).auth ?? null;
	const authResult = requireAdmin(auth);
	if (authResult.status !== 200) {
		return NextResponse.json(authResult.body, { status: authResult.status });
	}

	const { id } = await params;

	try {
		// Parse request body for seminarSourceId
		let body: unknown;
		try {
			body = await req.json();
		} catch {
			return createErrorResponse("Invalid JSON body", ErrorCodes.VALIDATION_ERROR, undefined, 400);
		}
		const parsed = MuxUploadRequestSchema.safeParse(body);
		if (!parsed.success) {
			return createErrorResponse(
				"Invalid request body",
				ErrorCodes.VALIDATION_ERROR,
				undefined,
				400,
				{ issues: parsed.error.issues },
			);
		}

		const { seminarSourceId } = parsed.data;

		// Check recording is not currently active
		if (isRecording()) {
			return createErrorResponse(
				"Cannot upload while a recording is in progress",
				ErrorCodes.CONFLICT,
				undefined,
				409,
			);
		}

		// Check recording exists
		const recording = await getRecordingById(id);
		if (!recording) {
			return createErrorResponse(`Recording ${id} not found`, ErrorCodes.NOT_FOUND, undefined, 404);
		}

		// Upload to MUX
		let muxResult: Awaited<ReturnType<typeof uploadToMux>>;
		try {
			muxResult = await uploadToMux(recording.filePath);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);

			if (message.startsWith("MUX_NOT_CONFIGURED:")) {
				return createErrorResponse(message, ErrorCodes.MUX_NOT_CONFIGURED, undefined, 503);
			}
			return createErrorResponse(message, ErrorCodes.MUX_UPLOAD_FAILED, undefined, 502);
		}

		// Forward to hemera.academy via transmitRecording
		let transmitted = false;
		let transmissionError: string | null = null;

		try {
			const client = createHemeraClient();
			const transmitResult = await transmitRecording(client, {
				seminarSourceId,
				muxAssetId: muxResult.muxAssetId,
				muxPlaybackUrl: muxResult.muxPlaybackUrl,
				recordingDate: recording.createdAt,
			});

			transmitted = transmitResult.success;
			if (!transmitResult.success) {
				transmissionError = transmitResult.error ?? "Unknown transmission error";
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			transmissionError = message;
			reportError(err instanceof Error ? err : new Error(message), undefined, "error");
		}

		// If MUX succeeded but hemera transmission failed → 207 Multi-Status
		const httpStatus = transmitted ? 200 : 207;

		return createSuccessResponse(
			{
				muxAssetId: muxResult.muxAssetId,
				muxPlaybackUrl: muxResult.muxPlaybackUrl,
				seminarSourceId,
				transmitted,
				transmissionError,
			},
			undefined,
			httpStatus,
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		reportError(err instanceof Error ? err : new Error(message), undefined, "error");
		return createErrorResponse(message, ErrorCodes.INTERNAL_ERROR, undefined, 500);
	}
}
