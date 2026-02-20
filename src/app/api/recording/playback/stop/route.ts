// ---------------------------------------------------------------------------
// POST /api/recording/playback/stop — Stop (pause) playback
// Task: T025 [P] [US3] — Auth admin/api-client, dispatch `stop` via
//                         playback-controller, return state
// ---------------------------------------------------------------------------

import { requireAdmin } from "@/lib/auth/role-check";
import { reportError } from "@/lib/monitoring/rollbar-official";
import { dispatchCommand } from "@/lib/recording/playback-controller";
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
		let body: Record<string, unknown>;
		try {
			body = await req.json();
		} catch {
			return createErrorResponse("Invalid JSON body", ErrorCodes.VALIDATION_ERROR, undefined, 400);
		}
		const { recordingId } = body;

		if (!recordingId || typeof recordingId !== "string") {
			return createErrorResponse(
				"recordingId is required",
				ErrorCodes.VALIDATION_ERROR,
				undefined,
				400,
			);
		}

		const result = dispatchCommand(recordingId, { action: "stop" });
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
