// ---------------------------------------------------------------------------
// GET /api/recording/events — SSE endpoint for playback commands
// Task: T029 [US3] — Register SSE client in playback-controller registry,
//                     return ReadableStream with text/event-stream content
//                     type, handle disconnect cleanup
// ---------------------------------------------------------------------------

import { requireAdmin } from "@/lib/auth/role-check";
import { reportError } from "@/lib/monitoring/rollbar-official";
import { registerClient, unregisterClient } from "@/lib/recording/playback-controller";
import { ErrorCodes, createErrorResponse } from "@/lib/utils/api-response";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(req: NextRequest) {
	type AuthenticatedRequest = NextRequest & { auth?: unknown };
	const auth = (req as AuthenticatedRequest).auth ?? null;
	const authResult = requireAdmin(auth);
	if (authResult.status !== 200) {
		return NextResponse.json(authResult.body, { status: authResult.status });
	}

	const recordingId = req.nextUrl.searchParams.get("recordingId");
	if (!recordingId) {
		return createErrorResponse(
			"recordingId query parameter is required",
			ErrorCodes.VALIDATION_ERROR,
			undefined,
			400,
		);
	}

	try {
		let controllerRef: ReadableStreamDefaultController | null = null;
		let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

		const stream = new ReadableStream({
			start(controller) {
				controllerRef = controller;

				try {
					registerClient(recordingId, controller);
				} catch (err) {
					reportError(err instanceof Error ? err : new Error(String(err)), undefined, "error");
					const errMsg = `event: error\ndata: ${JSON.stringify({ error: "Failed to register client" })}\n\n`;
					controller.enqueue(new TextEncoder().encode(errMsg));
					controller.close();
					return;
				}

				// Send initial connected event
				const msg = `event: connected\ndata: ${JSON.stringify({ recordingId })}\n\n`;
				controller.enqueue(new TextEncoder().encode(msg));

				// Heartbeat to keep proxies alive
				heartbeatInterval = setInterval(() => {
					try {
						controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
					} catch {
						// Controller closed — clear interval
						if (heartbeatInterval) clearInterval(heartbeatInterval);
					}
				}, 30_000);
			},
			cancel() {
				if (heartbeatInterval) clearInterval(heartbeatInterval);
				if (controllerRef) {
					unregisterClient(recordingId, controllerRef);
				}
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
				"X-Accel-Buffering": "no",
			},
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		reportError(err instanceof Error ? err : new Error(message), undefined, "error");
		return createErrorResponse("Internal server error", ErrorCodes.INTERNAL_ERROR, undefined, 500);
	}
}
