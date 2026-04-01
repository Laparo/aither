// ---------------------------------------------------------------------------
// POST /api/recording/playback/play — Start playback
// Task: T024 [P] [US3] — Auth admin/api-client, dispatch `play` via
//                         playback-controller, return state
// ---------------------------------------------------------------------------

import { reportError } from "@/lib/monitoring/rollbar-official";
import { dispatchCommand } from "@/lib/recording/playback-controller";
import { ErrorCodes, createErrorResponse, createSuccessResponse } from "@/lib/utils/api-response";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {

	try {
		const body = await req.json();
		const { recordingId } = body;

		if (!recordingId) {
			return createErrorResponse(
				"recordingId is required",
				ErrorCodes.VALIDATION_ERROR,
				undefined,
				400,
			);
		}

		const result = dispatchCommand(recordingId, { action: "play" });
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
