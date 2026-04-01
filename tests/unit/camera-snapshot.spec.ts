import {
	buildSnapshotUrl,
	getReconnectState,
	runSnapshotLoadCycle,
} from "@/app/components/camera-snapshot";
import { describe, expect, it, vi } from "vitest";

function mockResponse(status: number, statusText = "", body?: unknown): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		statusText,
		json: vi.fn().mockResolvedValue(body),
		blob: vi.fn().mockResolvedValue(new Blob(["video"])),
	} as unknown as Response;
}

describe("camera snapshot helpers", () => {
	it("builds snapshot URL with timestamp", () => {
		const url = buildSnapshotUrl(() => 12345);
		expect(url).toBe("/api/recording/snapshot?t=12345");
	});

	it("computes reconnect state by clearing state and incrementing attempt", () => {
		const next = getReconnectState(2);
		expect(next).toEqual({ src: null, error: null, loading: true, attempt: 3 });
	});

	it("clears loading on success path", async () => {
		const onSuccess = vi.fn();
		const onError = vi.fn();
		const onFinally = vi.fn();

		await runSnapshotLoadCycle(
			"/api/recording/snapshot?t=1",
			vi.fn().mockResolvedValue(mockResponse(200)),
			vi.fn().mockReturnValue("blob:ok"),
			vi.fn(),
			{
				onSuccess,
				onError,
				onFinally,
				isCancelled: () => false,
			},
		);

		expect(onSuccess).toHaveBeenCalledWith("blob:ok");
		expect(onError).not.toHaveBeenCalled();
		expect(onFinally).toHaveBeenCalledTimes(1);
	});

	it("clears loading on HTTP error path and uses API error message", async () => {
		const onSuccess = vi.fn();
		const onError = vi.fn();
		const onFinally = vi.fn();

		await runSnapshotLoadCycle(
			"/api/recording/snapshot?t=1",
			vi.fn().mockResolvedValue(mockResponse(503, "Service Unavailable", { error: "WEBCAM down" })),
			vi.fn(),
			vi.fn(),
			{
				onSuccess,
				onError,
				onFinally,
				isCancelled: () => false,
			},
		);

		expect(onSuccess).not.toHaveBeenCalled();
		expect(onError).toHaveBeenCalledWith("WEBCAM down");
		expect(onFinally).toHaveBeenCalledTimes(1);
	});

	it("clears loading on unexpected exception path", async () => {
		const onSuccess = vi.fn();
		const onError = vi.fn();
		const onFinally = vi.fn();

		await runSnapshotLoadCycle(
			"/api/recording/snapshot?t=1",
			vi.fn().mockResolvedValue(mockResponse(200)),
			vi.fn(() => {
				throw new Error("createObjectURL failed");
			}),
			vi.fn(),
			{
				onSuccess,
				onError,
				onFinally,
				isCancelled: () => false,
			},
		);

		expect(onSuccess).not.toHaveBeenCalled();
		expect(onError).toHaveBeenCalledWith("createObjectURL failed");
		expect(onFinally).toHaveBeenCalledTimes(1);
	});

	it("does not update state callbacks after cancellation and revokes created object URL", async () => {
		const onSuccess = vi.fn();
		const onError = vi.fn();
		const onFinally = vi.fn();
		const revokeObjectUrl = vi.fn();

		await runSnapshotLoadCycle(
			"/api/recording/snapshot?t=1",
			vi.fn().mockResolvedValue(mockResponse(200)),
			vi.fn().mockReturnValue("blob:cancelled"),
			revokeObjectUrl,
			{
				onSuccess,
				onError,
				onFinally,
				isCancelled: () => true,
			},
		);

		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:cancelled");
		expect(onSuccess).not.toHaveBeenCalled();
		expect(onError).not.toHaveBeenCalled();
		expect(onFinally).not.toHaveBeenCalled();
	});
});
