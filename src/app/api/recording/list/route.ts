// ---------------------------------------------------------------------------
// GET /api/recording/list — List all recordings with metadata
// Task: T020 [P] [US2] — Auth requireAdmin, scan dir via file-manager,
//                         return sorted array
// ---------------------------------------------------------------------------

import { reportError } from "@/lib/monitoring/rollbar-official";
import { listRecordings } from "@/lib/recording/file-manager";
import { ErrorCodes, createErrorResponse, createSuccessResponse } from "@/lib/utils/api-response";
import type { NextRequest } from "next/server";

export async function GET(_req: NextRequest) {

	try {
		const recordings = await listRecordings();
		return createSuccessResponse({ recordings });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		reportError(err instanceof Error ? err : new Error(message), undefined, "error");
		return createErrorResponse(message, ErrorCodes.INTERNAL_ERROR, undefined, 500);
	}
}
