// ---------------------------------------------------------------------------
// GET /api/recording/snapshot — Record a 3-second MP4 clip from the webcam
// ---------------------------------------------------------------------------

import { spawn } from "node:child_process";
import { reportError } from "@/lib/monitoring/rollbar-official";
import { NextResponse } from "next/server";

const isProduction = process.env.NODE_ENV === "production";

export async function GET() {
	const streamUrl = process.env.WEBCAM_STREAM_URL;

	if (!streamUrl) {
		const msg = "WEBCAM_STREAM_URL ist nicht konfiguriert";
		console.warn(`⚠ ${msg}`);
		if (isProduction) reportError(new Error(msg), undefined, "warning");
		return NextResponse.json({ error: msg }, { status: 503 });
	}

	try {
		const mp4 = await recordClip(streamUrl);
		return new NextResponse(new Uint8Array(mp4), {
			status: 200,
			headers: {
				"Content-Type": "video/mp4",
				"Cache-Control": "no-store",
			},
		});
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		const msg = `Kameraaufnahme fehlgeschlagen: ${reason}`;
		console.error(`✗ ${msg}`);
		if (isProduction) reportError(new Error(msg), undefined, "warning");
		return NextResponse.json({ error: msg }, { status: 503 });
	}
}

let _ffmpegChecked: boolean | null = null;

async function ensureFfmpegAvailable(): Promise<void> {
	if (_ffmpegChecked !== null) {
		if (!_ffmpegChecked) throw new Error("ffmpeg nicht verfügbar");
		return;
	}

	return new Promise((resolve, reject) => {
		const proc = spawn("ffmpeg", ["-version"]);
		let settled = false;

		const to = setTimeout(() => {
			if (!settled) {
				settled = true;
				try {
					proc.kill("SIGKILL");
				} catch {}
				_ffmpegChecked = false;
				reject(new Error("ffmpeg-Prüfung abgelaufen"));
			}
		}, 2000);

		proc.on("error", (err) => {
			if (settled) return;
			settled = true;
			clearTimeout(to);
			_ffmpegChecked = false;
			// ENOENT indicates ffmpeg not found in PATH
			reject(new Error(`ffmpeg nicht verfügbar: ${err.message}`));
		});

		proc.on("close", (code: number | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(to);
			if (code === 0) {
				_ffmpegChecked = true;
				resolve();
			} else {
				_ffmpegChecked = false;
				reject(new Error(`ffmpeg -version exited with code ${code}`));
			}
		});
	});
}

function validateStreamUrl(streamUrl: string): URL {
	let url: URL;
	try {
		url = new URL(streamUrl);
	} catch {
		throw new Error("Ungültige Stream-URL");
	}

	const allowed = ["rtsp:", "http:", "https:"];
	if (!allowed.includes(url.protocol)) throw new Error("Nicht unterstütztes URL-Protokoll");
	if (!url.hostname) throw new Error("Stream-URL muss einen Hostnamen haben");
	if (url.username || url.password)
		throw new Error("Zugangsdaten in der Stream-URL sind nicht erlaubt");
	if (streamUrl.length > 2048) throw new Error("Stream-URL zu lang");

	return url;
}

export async function recordClip(streamUrl: string): Promise<Buffer> {
	// Validate inputs
	validateStreamUrl(streamUrl);

	// Ensure ffmpeg exists in PATH
	await ensureFfmpegAvailable();

	return new Promise((resolve, reject) => {
		const args = [
			"-rtsp_transport",
			"tcp",
			"-i",
			streamUrl,
			"-t",
			"3",
			"-an",
			"-c:v",
			"copy",
			"-movflags",
			"frag_keyframe+empty_moov+default_base_moof",
			"-f",
			"mp4",
			"pipe:1",
		];

		const child = spawn("ffmpeg", args, {
			stdio: ["pipe", "pipe", "pipe"],
		});

		const chunks: Buffer[] = [];
		let stderr = "";
		let settled = false;

		child.stdout.on("data", (data: Buffer) => chunks.push(data));
		child.stderr.on("data", (data: Buffer) => {
			stderr += data.toString();
		});

		let killForce: ReturnType<typeof setTimeout> | null = null;

		// Timeout: try graceful termination first, then force kill
		const timeout = setTimeout(() => {
			try {
				child.kill("SIGTERM");
			} catch {}

			killForce = setTimeout(() => {
				try {
					child.kill("SIGKILL");
				} catch {}
			}, 1000);

			if (!settled) {
				settled = true;
				reject(new Error("Aufnahme-Timeout nach 15s"));
			}
		}, 15_000);

		child.on("close", (code) => {
			clearTimeout(timeout);
			if (killForce) clearTimeout(killForce);

			if (settled) return;
			settled = true;

			const output = Buffer.concat(chunks);

			if (code === 0 && output.length > 0) {
				resolve(output);
				return;
			}

			// Log full stderr for diagnostics, but return sanitized message to caller
			const errMsg = `ffmpeg mit Code ${code} beendet: ${stderr.slice(-200)}`;
			console.debug("ffmpeg full stderr:", stderr);
			reject(new Error(errMsg));
		});

		child.on("error", (err) => {
			clearTimeout(timeout);
			if (killForce) clearTimeout(killForce);
			if (settled) return;
			settled = true;
			reject(new Error(`ffmpeg-Startfehler: ${err.message}`));
		});
	});
}
