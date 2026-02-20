// ---------------------------------------------------------------------------
// Unit Tests: Playback Controller
// Task: T022 [P] [US3] — State machine transitions, SSE command dispatch,
//                         seek clamping, client registry add/remove,
//                         _resetState
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Playback Controller", () => {
	let playback: typeof import("@/lib/recording/playback-controller");

	/** Create a mock ReadableStreamDefaultController */
	function createMockController(): ReadableStreamDefaultController {
		return {
			enqueue: vi.fn(),
			close: vi.fn(),
			error: vi.fn(),
			desiredSize: 1,
		} as unknown as ReadableStreamDefaultController;
	}

	beforeEach(async () => {
		vi.clearAllMocks();
		playback = await import("@/lib/recording/playback-controller");
		playback._resetState();
	});

	afterEach(() => {
		playback._resetState();
	});

	describe("registerClient / unregisterClient", () => {
		it("registers a client and creates playback state", () => {
			const ctrl = createMockController();
			playback.registerClient("rec_001", ctrl);

			expect(playback.hasConnectedClients("rec_001")).toBe(true);
			const state = playback.getPlaybackState("rec_001");
			expect(state).not.toBeNull();
			expect(state?.state).toBe("idle");
			expect(state?.position).toBe(0);
		});

		it("unregisters a client and removes state when last client leaves", () => {
			const ctrl = createMockController();
			playback.registerClient("rec_001", ctrl);
			playback.unregisterClient("rec_001", ctrl);

			expect(playback.hasConnectedClients("rec_001")).toBe(false);
			expect(playback.getPlaybackState("rec_001")).toBeNull();
		});

		it("keeps state when other clients remain", () => {
			const ctrl1 = createMockController();
			const ctrl2 = createMockController();
			playback.registerClient("rec_001", ctrl1);
			playback.registerClient("rec_001", ctrl2);

			playback.unregisterClient("rec_001", ctrl1);

			expect(playback.hasConnectedClients("rec_001")).toBe(true);
			expect(playback.getPlaybackState("rec_001")).not.toBeNull();
		});
	});

	describe("hasConnectedClients", () => {
		it("returns false when no clients are registered", () => {
			expect(playback.hasConnectedClients("rec_nonexistent")).toBe(false);
		});
	});

	describe("closeClientsForRecording", () => {
		it("closes all SSE controllers and removes state", () => {
			const ctrl1 = createMockController();
			const ctrl2 = createMockController();
			playback.registerClient("rec_001", ctrl1);
			playback.registerClient("rec_001", ctrl2);

			playback.closeClientsForRecording("rec_001");

			expect(ctrl1.close).toHaveBeenCalled();
			expect(ctrl2.close).toHaveBeenCalled();
			expect(playback.hasConnectedClients("rec_001")).toBe(false);
		});

		it("does nothing for unregistered recording", () => {
			// Should not throw
			playback.closeClientsForRecording("rec_nonexistent");
		});
	});

	describe("dispatchCommand", () => {
		it("dispatches play command and updates state", () => {
			const ctrl = createMockController();
			playback.registerClient("rec_001", ctrl);

			const result = playback.dispatchCommand("rec_001", { action: "play" });

			expect(result).not.toBeNull();
			expect(result?.status).toBe("playing");
			expect(ctrl.enqueue).toHaveBeenCalled();
		});

		it("dispatches stop command and updates state to paused", () => {
			const ctrl = createMockController();
			playback.registerClient("rec_001", ctrl);
			playback.dispatchCommand("rec_001", { action: "play" });

			const result = playback.dispatchCommand("rec_001", { action: "stop" });

			expect(result?.status).toBe("paused");
		});

		it("dispatches seek command and updates position", () => {
			const ctrl = createMockController();
			playback.registerClient("rec_001", ctrl);

			const result = playback.dispatchCommand("rec_001", { action: "seek", position: 30 });

			expect(result).not.toBeNull();
			expect(result?.position).toBe(30);
		});

		it("returns null when no clients are connected", () => {
			const result = playback.dispatchCommand("rec_nonexistent", { action: "play" });
			expect(result).toBeNull();
		});
	});

	describe("calculateSeekPosition", () => {
		it("adds positive offset", () => {
			expect(playback.calculateSeekPosition(10, 5)).toBe(15);
		});

		it("adds negative offset", () => {
			expect(playback.calculateSeekPosition(10, -5)).toBe(5);
		});

		it("clamps to zero for negative result", () => {
			expect(playback.calculateSeekPosition(3, -10)).toBe(0);
		});

		it("clamps to duration when exceeding", () => {
			expect(playback.calculateSeekPosition(100, 50, 120)).toBe(120);
		});

		it("does not clamp when no duration provided", () => {
			expect(playback.calculateSeekPosition(100, 50)).toBe(150);
		});
	});

	describe("updatePlayerState", () => {
		it("updates state from player report", () => {
			const ctrl = createMockController();
			playback.registerClient("rec_001", ctrl);

			const ok = playback.updatePlayerState("rec_001", "playing", 42);
			expect(ok).toBe(true);

			const state = playback.getPlaybackState("rec_001");
			expect(state?.state).toBe("playing");
			expect(state?.position).toBe(42);
		});

		it("stores error message", () => {
			const ctrl = createMockController();
			playback.registerClient("rec_001", ctrl);

			playback.updatePlayerState("rec_001", "error", 0, "decode failure");
			const state = playback.getPlaybackState("rec_001");
			expect(state?.errorMessage).toBe("decode failure");
		});

		it("returns false for unknown recording", () => {
			const ok = playback.updatePlayerState("rec_unknown", "playing", 0);
			expect(ok).toBe(false);
		});
	});

	describe("_resetState", () => {
		it("clears all state and closes all clients", () => {
			const ctrl = createMockController();
			playback.registerClient("rec_001", ctrl);

			playback._resetState();

			expect(playback.hasConnectedClients("rec_001")).toBe(false);
			expect(playback.getPlaybackState("rec_001")).toBeNull();
			expect(ctrl.close).toHaveBeenCalled();
		});
	});
});
