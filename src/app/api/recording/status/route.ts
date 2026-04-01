// ---------------------------------------------------------------------------
// GET /api/recording/status — Query recording status
// Task: T019 [P] [US2] — Auth requireAdmin, return current session state
//                         or { recording: false }
// ---------------------------------------------------------------------------

import { reportError } from "@/lib/monitoring/rollbar-official";
import { getSessionState, isRecording } from "@/lib/recording/session-manager";
import { ErrorCodes, createErrorResponse, createSuccessResponse } from "@/lib/utils/api-response";
import type { NextRequest } from "next/server";

export async function GET(_req: NextRequest) {

	try {
		const active = isRecording();
		const session = getSessionState();

		return createSuccessResponse({
			recording: active,
			session: active ? session : null,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		reportError(err instanceof Error ? err : new Error(message), undefined, "error");
		return createErrorResponse("Internal server error", ErrorCodes.INTERNAL_ERROR, undefined, 500);
	}
}
