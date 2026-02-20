// ---------------------------------------------------------------------------
// Unit Tests: FFmpeg Capture
// Task: T011 [P] [US1] — Spawn args, SIGINT stop, stderr parsing, timeout
//                         auto-kill, webcam disconnect handling
// ---------------------------------------------------------------------------

import { type ChildProcess, spawn } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock child_process
vi.mock("node:child_process", () => {
	const mockSpawn = vi.fn();
	return { spawn: mockSpawn, execFile: vi.fn() };
});

const mockSpawn = vi.mocked(spawn);

function createMockProcess(overrides?: Partial<ChildProcess>) {
	const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
	const stderrListeners = new Map<string, ((...args: unknown[]) => void)[]>();

	const mockProcess = {
		pid: 12345,
		killed: false,
		kill: vi.fn(function (this: { killed: boolean }) {
			this.killed = true;
			// Emit close event
			const closeHandlers = listeners.get("close") ?? [];
			for (const handler of closeHandlers) {
				handler(0, "SIGINT");
			}
			return true;
		}),
		on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
			if (!listeners.has(event)) listeners.set(event, []);
			listeners.get(event)?.push(handler);
			return mockProcess;
		}),
		stderr: {
			on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
				if (!stderrListeners.has(event)) stderrListeners.set(event, []);
				stderrListeners.get(event)?.push(handler);
				return mockProcess.stderr;
			}),
		},
		stdout: { on: vi.fn() },
		stdin: { on: vi.fn() },
		_listeners: listeners,
		_stderrListeners: stderrListeners,
		...overrides,
	} as unknown as ChildProcess & {
		_listeners: Map<string, ((...args: unknown[]) => void)[]>;
		_stderrListeners: Map<string, ((...args: unknown[]) => void)[]>;
	};

	return mockProcess;
}

describe("FFmpeg Capture", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("isFFmpegAvailable", () => {
		it("returns true when ffmpeg -version exits with code 0", async () => {
			const mockProc = createMockProcess();
			mockSpawn.mockReturnValue(mockProc);

			const { isFFmpegAvailable } = await import("@/lib/recording/ffmpeg-capture");
			const promise = isFFmpegAvailable();

			// Simulate successful exit
			const closeHandlers = mockProc._listeners.get("close") ?? [];
			for (const handler of closeHandlers) handler(0);

			const result = await promise;
			expect(result).toBe(true);
			expect(mockSpawn).toHaveBeenCalledWith("ffmpeg", ["-version"], { stdio: "pipe" });
		});

		it("returns false when ffmpeg -version exits with non-zero code", async () => {
			const mockProc = createMockProcess();
			mockSpawn.mockReturnValue(mockProc);

			const { isFFmpegAvailable } = await import("@/lib/recording/ffmpeg-capture");
			const promise = isFFmpegAvailable();

			const closeHandlers = mockProc._listeners.get("close") ?? [];
			for (const handler of closeHandlers) handler(1);

			const result = await promise;
			expect(result).toBe(false);
		});

		it("returns false when ffmpeg spawn errors", async () => {
			const mockProc = createMockProcess();
			mockSpawn.mockReturnValue(mockProc);

			const { isFFmpegAvailable } = await import("@/lib/recording/ffmpeg-capture");
			const promise = isFFmpegAvailable();

			const errorHandlers = mockProc._listeners.get("error") ?? [];
			for (const handler of errorHandlers) handler(new Error("ENOENT"));

			const result = await promise;
			expect(result).toBe(false);
		});
	});

	describe("spawnFFmpeg", () => {
		it("spawns ffmpeg with correct arguments", async () => {
			const mockProc = createMockProcess();
			mockSpawn.mockReturnValue(mockProc);

			const { spawnFFmpeg } = await import("@/lib/recording/ffmpeg-capture");
			const result = spawnFFmpeg({
				streamUrl: "rtsp://192.168.1.100:554/stream",
				outputPath: "/tmp/output.mp4",
			});

			expect(mockSpawn).toHaveBeenCalledWith(
				"ffmpeg",
				expect.arrayContaining([
					"-y",
					"-rtsp_transport",
					"tcp",
					"-i",
					"rtsp://192.168.1.100:554/stream",
					"-c",
					"copy",
					"-movflags",
					"+faststart",
					"/tmp/output.mp4",
				]),
				expect.objectContaining({ stdio: ["pipe", "pipe", "pipe"] }),
			);

			expect(result.child).toBe(mockProc);
			expect(result.stderrLines).toEqual([]);
		});

		it("captures stderr output lines", async () => {
			const mockProc = createMockProcess();
			mockSpawn.mockReturnValue(mockProc);

			const { spawnFFmpeg } = await import("@/lib/recording/ffmpeg-capture");
			const result = spawnFFmpeg({
				streamUrl: "rtsp://192.168.1.100:554/stream",
				outputPath: "/tmp/output.mp4",
			});

			// Simulate stderr data
			const stderrHandlers = mockProc._stderrListeners.get("data") ?? [];
			for (const handler of stderrHandlers) {
				handler(Buffer.from("frame=  100 fps=30.0\n"));
			}

			expect(result.stderrLines).toContain("frame=  100 fps=30.0");
		});
	});

	describe("stopFFmpeg", () => {
		it("sends SIGINT to the process for graceful stop", async () => {
			const mockProc = createMockProcess();
			mockSpawn.mockReturnValue(mockProc);

			const { spawnFFmpeg, stopFFmpeg } = await import("@/lib/recording/ffmpeg-capture");
			const proc = spawnFFmpeg({
				streamUrl: "rtsp://localhost/stream",
				outputPath: "/tmp/test.mp4",
			});

			await stopFFmpeg(proc);

			expect(mockProc.kill).toHaveBeenCalledWith("SIGINT");
		});

		it("does nothing if process is already killed", async () => {
			const { stopFFmpeg } = await import("@/lib/recording/ffmpeg-capture");

			// Manually construct a proc that is already killed
			// with a pre-resolved exited promise
			const proc = {
				child: {
					pid: 12345,
					killed: true,
					kill: vi.fn(),
					on: vi.fn(),
				} as unknown as import("node:child_process").ChildProcess,
				exited: Promise.resolve({ code: 0, signal: "SIGINT" as NodeJS.Signals }),
				stderrLines: [],
			};

			const result = await stopFFmpeg(proc);
			expect(result).toEqual({ code: 0, signal: "SIGINT" });
			expect(proc.child.kill).not.toHaveBeenCalled();
		});
	});

	describe("parseFFmpegError", () => {
		it("detects connection refused", async () => {
			const { parseFFmpegError } = await import("@/lib/recording/ffmpeg-capture");
			const result = parseFFmpegError(["Connection refused"]);
			expect(result).toContain("unreachable");
		});

		it("detects connection timed out", async () => {
			const { parseFFmpegError } = await import("@/lib/recording/ffmpeg-capture");
			const result = parseFFmpegError(["Connection timed out"]);
			expect(result).toContain("unreachable");
		});

		it("detects I/O error (webcam disconnect)", async () => {
			const { parseFFmpegError } = await import("@/lib/recording/ffmpeg-capture");
			const result = parseFFmpegError(["Input/output error"]);
			expect(result).toContain("disconnected");
		});

		it("returns null for normal SIGINT exit", async () => {
			const { parseFFmpegError } = await import("@/lib/recording/ffmpeg-capture");
			const result = parseFFmpegError(["Immediate exit requested"]);
			expect(result).toBeNull();
		});

		it("returns null for unknown stderr", async () => {
			const { parseFFmpegError } = await import("@/lib/recording/ffmpeg-capture");
			const result = parseFFmpegError(["frame= 100 fps=30.0"]);
			expect(result).toBeNull();
		});
	});
});
