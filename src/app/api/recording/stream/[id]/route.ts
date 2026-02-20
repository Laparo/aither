// ---------------------------------------------------------------------------
// GET /api/recording/stream/[id] — Serve recording file for streaming
// Task: T032 [US5] — Auth admin/api-client, resolve file via file-manager,
//                     delegate to stream-handler for full/partial response
// ---------------------------------------------------------------------------

import { requireAdmin } from "@/lib/auth/role-check";
import { reportError } from "@/lib/monitoring/rollbar-official";
import { resolveFilePath } from "@/lib/recording/file-manager";
import { createStreamResponse } from "@/lib/recording/stream-handler";
import { ErrorCodes, createErrorResponse } from "@/lib/utils/api-response";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
		const filePath = await resolveFilePath(id);
		if (!filePath) {
			return createErrorResponse(`Recording ${id} not found`, ErrorCodes.NOT_FOUND, undefined, 404);
		}

		const rangeHeader = req.headers.get("range");
		const { stream, headers, status } = await createStreamResponse(filePath, rangeHeader);

		return new Response(stream, { status, headers });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		reportError(err instanceof Error ? err : new Error(message), undefined, "error");
		return createErrorResponse("Internal server error", ErrorCodes.INTERNAL_ERROR, undefined, 500);
	}
}
