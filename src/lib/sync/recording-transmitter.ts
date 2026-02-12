// ---------------------------------------------------------------------------
// Recording Transmitter — Forward MUX URLs to hemera.academy
// Task: T034 [US1b] — Validate, PUT to Hemera, return result
// ---------------------------------------------------------------------------

import type { HemeraClient } from "@/lib/hemera/client";
import type { SeminarRecording } from "@/lib/hemera/types";
import { RecordingTransmitRequestSchema } from "@/lib/sync/schemas";

export interface TransmitResult {
	success: boolean;
	seminarSourceId: string;
	hemeraResponse?: { status: number; message: string };
	error?: string;
}

/**
 * Validate a SeminarRecording and PUT it to hemera.academy via the API client.
 *
 * @param client  Authenticated HemeraClient instance
 * @param recording  The recording data to transmit
 * @returns Structured result with success/failure details
 */
export async function transmitRecording(
	client: HemeraClient,
	recording: SeminarRecording,
): Promise<TransmitResult> {
	// 1. Validate input with Zod
	const parsed = RecordingTransmitRequestSchema.safeParse(recording);
	if (!parsed.success) {
		return {
			success: false,
			seminarSourceId: recording.seminarSourceId ?? "unknown",
			error: `validation: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
		};
	}

	// 2. PUT to hemera.academy
	try {
		const response = await client.put(`/seminars/${parsed.data.seminarSourceId}/recording`, {
			muxAssetId: parsed.data.muxAssetId,
			muxPlaybackUrl: parsed.data.muxPlaybackUrl,
			recordingDate: parsed.data.recordingDate,
		});

		return {
			success: true,
			seminarSourceId: parsed.data.seminarSourceId,
			hemeraResponse: response as { status: number; message: string },
		};
	} catch (err) {
		return {
			success: false,
			seminarSourceId: parsed.data.seminarSourceId,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}
