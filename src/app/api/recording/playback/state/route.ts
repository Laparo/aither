// ---------------------------------------------------------------------------
// POST /api/recording/playback/state — Accept player state reports
// Task: T028 [US3] — Accept player state updates, update playback-controller
// ---------------------------------------------------------------------------

import { requireAdmin } from "@/lib/auth/role-check";
import { reportError } from "@/lib/monitoring/rollbar-official";
import { updatePlayerState } from "@/lib/recording/playback-controller";
import { PlayerStateReportSchema } from "@/lib/recording/schemas";
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
		const parsed = PlayerStateReportSchema.safeParse(body);

		if (!parsed.success) {
			return createErrorResponse(
				"Invalid player state report",
				ErrorCodes.VALIDATION_ERROR,
				undefined,
				400,
				{ issues: parsed.error.issues },
			);
		}

		const { recordingId, state, position, message } = parsed.data;
		const updated = updatePlayerState(recordingId, state, position, message);

		if (!updated) {
			return createErrorResponse(
				"No active playback session for this recording",
				ErrorCodes.NOT_FOUND,
				undefined,
				404,
			);
		}

		return createSuccessResponse({ accepted: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		reportError(err instanceof Error ? err : new Error(message), undefined, "error");
		return createErrorResponse("Internal server error", ErrorCodes.INTERNAL_ERROR, undefined, 500);
	}
}
