// ---------------------------------------------------------------------------
// Unit Tests: Recording Transmitter
// Task: T032 [US1b] — TDD: PUT to Hemera, handle responses
// ---------------------------------------------------------------------------

import type { HemeraClient } from "@/lib/hemera/client";
import type { SeminarRecording } from "@/lib/hemera/types";
import { transmitRecording } from "@/lib/sync/recording-transmitter";
import { describe, expect, it, vi } from "vitest";

function createMockClient(putResult: { status: number; message: string } | Error) {
	return {
		get: vi.fn(),
		put:
			putResult instanceof Error
				? vi.fn().mockRejectedValue(putResult)
				: vi.fn().mockResolvedValue(putResult),
	};
}

const validRecording: SeminarRecording = {
	seminarSourceId: "sem-001",
	muxAssetId: "asset-abc123",
	muxPlaybackUrl: "https://stream.mux.com/abc123.m3u8",
	recordingDate: "2026-02-11T10:00:00Z",
};

describe("transmitRecording", () => {
	it("calls PUT on the correct Hemera API path", async () => {
		const client = createMockClient({ status: 200, message: "Recording URL updated" });
		const result = await transmitRecording(client as unknown as HemeraClient, validRecording);

		expect(client.put).toHaveBeenCalledTimes(1);
		const callArgs = client.put.mock.calls[0];
		expect(callArgs[0]).toContain("sem-001");
		expect(result.success).toBe(true);
	});

	it("returns success with Hemera response details", async () => {
		const client = createMockClient({ status: 200, message: "OK" });
		const result = await transmitRecording(client as unknown as HemeraClient, validRecording);

		expect(result.success).toBe(true);
		expect(result.seminarSourceId).toBe("sem-001");
		expect(result.hemeraResponse).toBeDefined();
	});

	it("returns failure on Hemera API error", async () => {
		const client = createMockClient(
			new Error("Hemera API error 404 (Not Found) for /seminars/sem-001/recording"),
		);
		const result = await transmitRecording(client as unknown as HemeraClient, validRecording);

		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("validates the recording input with Zod", async () => {
		const client = createMockClient({ status: 200, message: "OK" });
		const invalid = { ...validRecording, muxPlaybackUrl: "not-a-url" };

		const result = await transmitRecording(client as unknown as HemeraClient, invalid);
		expect(result.success).toBe(false);
		expect(result.error).toContain("validation");
	});
});
