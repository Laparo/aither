// ---------------------------------------------------------------------------
// POST /api/recording/stop — Stop the active recording session
// Task: T015 [P] [US1] — Auth requireAdmin, graceful SIGINT via
//                         session-manager, return file details 200/404
// ---------------------------------------------------------------------------

import { requireAdmin } from "@/lib/auth/role-check";
import { reportError } from "@/lib/monitoring/rollbar-official";
import { stopRecording } from "@/lib/recording/session-manager";
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
		const session = await stopRecording();
		return createSuccessResponse({
			sessionId: session.sessionId,
			status: session.status,
			filename: session.filename,
			startedAt: session.startedAt,
			endedAt: session.endedAt,
			duration: session.duration,
			fileSize: session.fileSize,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);

		if (message.startsWith("NOT_FOUND:")) {
			return createErrorResponse(message, ErrorCodes.NOT_FOUND, undefined, 404);
		}

		// Unexpected error
		reportError(err instanceof Error ? err : new Error(message), undefined, "error");
		return createErrorResponse("Internal server error", ErrorCodes.INTERNAL_ERROR, undefined, 500);
	}
}
