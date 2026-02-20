// ---------------------------------------------------------------------------
// GET /api/recording/list — List all recordings with metadata
// Task: T020 [P] [US2] — Auth requireAdmin, scan dir via file-manager,
//                         return sorted array
// ---------------------------------------------------------------------------

import { requireAdmin } from "@/lib/auth/role-check";
import { reportError } from "@/lib/monitoring/rollbar-official";
import { listRecordings } from "@/lib/recording/file-manager";
import { ErrorCodes, createErrorResponse, createSuccessResponse } from "@/lib/utils/api-response";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(req: NextRequest) {
	type AuthenticatedRequest = NextRequest & { auth?: unknown };
	const auth = (req as AuthenticatedRequest).auth ?? null;
	const authResult = requireAdmin(auth);
	if (authResult.status !== 200) {
		return NextResponse.json(authResult.body, { status: authResult.status });
	}

	try {
		const recordings = await listRecordings();
		return createSuccessResponse({ recordings });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		reportError(err instanceof Error ? err : new Error(message), undefined, "error");
		return createErrorResponse(message, ErrorCodes.INTERNAL_ERROR, undefined, 500);
	}
}
