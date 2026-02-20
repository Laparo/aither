// ---------------------------------------------------------------------------
// DELETE /api/recording/[id] — Delete a recording file
// Task: T021 [US2] — Auth requireAdmin, stop playback if active, delete
//                     file via file-manager, return 200/404
// ---------------------------------------------------------------------------

import { requireAdmin } from "@/lib/auth/role-check";
import { reportError } from "@/lib/monitoring/rollbar-official";
import { deleteRecording } from "@/lib/recording/file-manager";
import { closeClientsForRecording } from "@/lib/recording/playback-controller";
import { ErrorCodes, createErrorResponse, createSuccessResponse } from "@/lib/utils/api-response";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	type AuthenticatedRequest = NextRequest & { auth?: unknown };
	const auth = (req as AuthenticatedRequest).auth ?? null;
	const authResult = requireAdmin(auth);
	if (authResult.status !== 200) {
		return NextResponse.json(authResult.body, { status: authResult.status });
	}

	const { id } = await params;

	// Validate id format (must match rec_YYYY-MM-DDTHH-MM-SSZ)
	const ID_PATTERN = /^rec_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/;
	if (!id || !ID_PATTERN.test(id)) {
		return createErrorResponse(
			"Invalid recording ID format",
			ErrorCodes.VALIDATION_ERROR,
			undefined,
			400,
		);
	}

	try {
		// Close any SSE clients watching this recording's playback
		closeClientsForRecording(id);

		const deleted = await deleteRecording(id);
		if (!deleted) {
			return createErrorResponse(`Recording ${id} not found`, ErrorCodes.NOT_FOUND, undefined, 404);
		}

		return createSuccessResponse({ deleted: true, id });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		reportError(err instanceof Error ? err : new Error(message), undefined, "error");
		return createErrorResponse("Internal server error", ErrorCodes.INTERNAL_ERROR, undefined, 500);
	}
}
