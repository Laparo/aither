// ---------------------------------------------------------------------------
// Recordings API Route — POST /api/recordings
// Task: T035 [US1b] — Accept MUX recording URLs, forward to hemera.academy
// ---------------------------------------------------------------------------

import { requireAdmin } from "@/lib/auth/role-check";
import { getRouteAuth } from "@/lib/auth/route-auth";
import {
	createHemeraClient,
	HemeraConfigurationError,
	HemeraUnreachableError,
} from "@/lib/hemera/factory";
import { transmitRecording } from "@/lib/sync/recording-transmitter";
import type { TransmitResult } from "@/lib/sync/recording-transmitter";
import { RecordingTransmitRequestSchema } from "@/lib/sync/schemas";
import { getOrCreateRequestIdFromHeaders } from "@/lib/utils/request-id";
import { NextResponse } from "next/server";

/**
 * POST /api/recordings
 * Accepts a MUX recording URL and forwards it to the hemera.academy API.
 *
 * Request body: { seminarSourceId, muxAssetId, muxPlaybackUrl, recordingDate }
 * Response: 200 on success, 400 on validation error, 502 on Hemera API failure
 */
export async function POST(request: Request): Promise<NextResponse> {
	const requestId = getOrCreateRequestIdFromHeaders(request.headers);

	const authData = await getRouteAuth();
	const authResult = requireAdmin(authData);
	if (authResult.status !== 200) {
		return NextResponse.json(authResult.body, { status: authResult.status });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: "Bad Request", message: "Invalid JSON body" },
			{ status: 400 },
		);
	}

	// Validate request body
	const parsed = RecordingTransmitRequestSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{
				error: "Validation Error",
				message: "Invalid request body",
				details: parsed.error.issues.map((i) => ({
					field: i.path.join("."),
					message: i.message,
				})),
			},
			{ status: 400 },
		);
	}

	// Create Hemera client
	let client: Awaited<ReturnType<typeof createHemeraClient>>;
	try {
		client = await createHemeraClient({
			requestId,
			route: "/api/recordings",
			method: "POST",
		});
	} catch (err) {
		const isTransient = err instanceof HemeraUnreachableError;
		const isConfiguration = err instanceof HemeraConfigurationError;
		return NextResponse.json(
			{
				error: isTransient ? "Service Unavailable" : "Internal Server Error",
				code: isTransient
					? "HEMERA_UNREACHABLE"
					: isConfiguration
						? "HEMERA_CONFIGURATION_ERROR"
						: "HEMERA_CLIENT_INIT_FAILED",
				message: err instanceof Error ? err.message : "Failed to initialize Hemera API client",
				requestId,
			},
			{ status: isTransient ? 503 : 500 },
		);
	}

	// Transmit to hemera.academy — catch and handle unexpected errors
	let result: TransmitResult;
	try {
		result = await transmitRecording(client, parsed.data);
	} catch (err) {
		// Mask sensitive fields before logging to avoid leaking PII/URLs
		const masked = {
			...parsed.data,
			seminarSourceId: parsed.data?.seminarSourceId ? "***" : undefined,
			muxAssetId: parsed.data?.muxAssetId ? "***" : undefined,
			muxPlaybackUrl: parsed.data?.muxPlaybackUrl ? "***" : undefined,
		};
		console.error("transmitRecording failed", { err, parsedData: masked });
		// Return a controlled error response rather than letting the exception bubble
		return NextResponse.json(
			{
				error: "Internal Server Error",
				message: "Failed to transmit recording to Hemera API",
			},
			{ status: 500 },
		);
	}

	if (result.success) {
		return NextResponse.json(result, { status: 200 });
	}

	// Distinguish between validation error (our side) and Hemera API failure
	if (result.error?.startsWith("validation:")) {
		return NextResponse.json({ error: "Validation Error", message: result.error }, { status: 400 });
	}

	return NextResponse.json(
		{
			error: "Bad Gateway",
			message: `Hemera API error: ${result.error}`,
			seminarSourceId: result.seminarSourceId,
		},
		{ status: 502 },
	);
}
