// ---------------------------------------------------------------------------
// FFmpeg Child Process Manager
// Task: T006 — Spawn, graceful stop (SIGINT), SIGKILL fallback, stderr
//              parsing, close event handling, process cleanup on server exit
// ---------------------------------------------------------------------------

import { type ChildProcess, spawn } from "node:child_process";

/** Grace period (ms) between SIGINT and SIGKILL */
const KILL_GRACE_MS = 5_000;

export interface FFmpegOptions {
	/** Webcam stream URL (RTSP/HTTP/MJPEG) */
	streamUrl: string;
	/** Output file path for the MP4 */
	outputPath: string;
	/** Optional extra FFmpeg args before the output path */
	extraArgs?: string[];
}

export interface FFmpegProcess {
	/** The underlying child process */
	child: ChildProcess;
	/** Promise that resolves when FFmpeg exits (code, signal) */
	exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
	/** Captured stderr output (progress/errors) */
	stderrLines: string[];
}

/**
 * Check if FFmpeg is available on the host machine.
 * Returns true if `ffmpeg -version` exits with code 0.
 */
export async function isFFmpegAvailable(): Promise<boolean> {
	return new Promise((resolve) => {
		const proc = spawn("ffmpeg", ["-version"], { stdio: "pipe" });
		proc.on("error", () => resolve(false));
		proc.on("close", (code) => resolve(code === 0));
	});
}

/**
 * Spawn an FFmpeg child process to capture a webcam stream to MP4.
 *
 * Uses `-c copy` when possible (pass-through H.264), falls back to
 * transcoding for non-H.264 sources (e.g. MJPEG).
 */
export function spawnFFmpeg(options: FFmpegOptions): FFmpegProcess {
	const { streamUrl, outputPath, extraArgs = [] } = options;

	const args = [
		"-y", // overwrite output
		"-rtsp_transport",
		"tcp", // prefer TCP for RTSP
		"-i",
		streamUrl,
		"-c",
		"copy", // attempt stream copy (no transcode)
		"-movflags",
		"+faststart", // moov atom at front for streaming
		...extraArgs,
		outputPath,
	];

	const child = spawn("ffmpeg", args, {
		stdio: ["pipe", "pipe", "pipe"],
	});

	const stderrLines: string[] = [];

	child.stderr?.on("data", (data: Buffer) => {
		const line = data.toString().trim();
		if (line) {
			stderrLines.push(line);
		}
	});

	const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
		child.on("close", (code, signal) => {
			resolve({ code, signal });
		});
		child.on("error", () => {
			resolve({ code: 1, signal: null });
		});
	});

	// Register cleanup on server exit
	const cleanup = () => {
		if (!child.killed) {
			child.kill("SIGKILL");
		}
	};
	const onSigterm = () => {
		cleanup();
		process.removeListener("SIGTERM", onSigterm);
		process.kill(process.pid, "SIGTERM");
	};
	process.on("exit", cleanup);
	process.on("SIGTERM", onSigterm);

	// Remove cleanup listeners once FFmpeg exits
	exited.then(() => {
		process.removeListener("exit", cleanup);
		process.removeListener("SIGTERM", onSigterm);
	});

	return { child, exited, stderrLines };
}

/**
 * Gracefully stop an FFmpeg process.
 *
 * 1. Send SIGINT so FFmpeg writes the moov atom (valid MP4).
 * 2. Wait up to KILL_GRACE_MS for exit.
 * 3. If still alive, send SIGKILL.
 *
 * @returns The exit result from the process.
 */
export async function stopFFmpeg(
	proc: FFmpegProcess,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
	if (proc.child.killed) {
		return proc.exited;
	}

	// Send graceful stop
	proc.child.kill("SIGINT");

	// Race: normal exit vs. timeout
	let timer: ReturnType<typeof setTimeout>;
	const timeoutPromise = new Promise<null>((resolve) => {
		timer = setTimeout(() => resolve(null), KILL_GRACE_MS);
	});

	// Clear timer when process exits normally
	proc.exited.then(() => clearTimeout(timer));

	const result = await Promise.race([proc.exited, timeoutPromise]);

	clearTimeout(timer!);

	if (result === null) {
		// Timed out — force kill
		if (!proc.child.killed) {
			proc.child.kill("SIGKILL");
		}
	}

	return proc.exited;
}

/**
 * Parse FFmpeg stderr output for common error patterns.
 */
export function parseFFmpegError(stderrLines: string[]): string | null {
	const combined = stderrLines.join("\n");

	if (combined.includes("Connection refused") || combined.includes("Connection timed out")) {
		return "Webcam stream unreachable — connection refused or timed out";
	}
	if (combined.includes("Server returned 4") || combined.includes("Server returned 5")) {
		return "Webcam stream returned an HTTP error";
	}
	if (combined.includes("No route to host")) {
		return "Webcam stream unreachable — no route to host";
	}
	if (combined.includes("Input/output error")) {
		return "Webcam stream disconnected — I/O error";
	}
	if (combined.includes("Immediate exit requested")) {
		// Normal SIGINT response — not an error
		return null;
	}

	return null;
}
