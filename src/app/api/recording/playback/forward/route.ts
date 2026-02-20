// ---------------------------------------------------------------------------
// POST /api/recording/playback/forward — Fast-forward (seek forwards)
// Task: T027 [P] [US3] — Auth admin/api-client, dispatch `seek` with
//                         positive offset, return state
// ---------------------------------------------------------------------------

import { requireAdmin } from "@/lib/auth/role-check";
import { reportError } from "@/lib/monitoring/rollbar-official";
import {
	calculateSeekPosition,
	dispatchCommand,
	getPlaybackState,
} from "@/lib/recording/playback-controller";
import { ErrorCodes, createErrorResponse, createSuccessResponse } from "@/lib/utils/api-response";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(req: NextRequest) {
	type AuthenticatedRequest = NextRequest & { auth?: unknown };
	const auth = (req as AuthenticatedRequest).auth ?? null;
	const authResult = requireAdmin(auth);
	if (authResult.status !== 200) {
		return NextResponse.json(authResult.body, { status: authResult.status });
	}

	try {
		const body = await req.json();
		const { recordingId, seconds = 10 } = body;

		if (!recordingId) {
			return createErrorResponse(
				"recordingId is required",
				ErrorCodes.VALIDATION_ERROR,
				undefined,
				400,
			);
		}

		const secs = Number(seconds);
		if (!Number.isFinite(secs) || !Number.isInteger(secs) || secs < 1 || secs > 3600) {
			return createErrorResponse(
				"seconds must be a finite integer between 1 and 3600",
				ErrorCodes.VALIDATION_ERROR,
				undefined,
				400,
			);
		}

		const state = getPlaybackState(recordingId);
		if (!state) {
			return createErrorResponse(
				"No player connected for this recording",
				ErrorCodes.NOT_FOUND,
				undefined,
				404,
			);
		}

		const newPosition = calculateSeekPosition(state.position, Math.abs(secs));
		const result = dispatchCommand(recordingId, { action: "seek", position: newPosition });
		if (!result) {
			return createErrorResponse(
				"No player connected for this recording",
				ErrorCodes.NOT_FOUND,
				undefined,
				404,
			);
		}

		return createSuccessResponse(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		reportError(err instanceof Error ? err : new Error(message), undefined, "error");
		return createErrorResponse("Internal server error", ErrorCodes.INTERNAL_ERROR, undefined, 500);
	}
}
