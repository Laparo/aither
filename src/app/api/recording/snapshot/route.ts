// ---------------------------------------------------------------------------
// GET /api/recording/snapshot — Grab a single JPEG frame from the webcam
// ---------------------------------------------------------------------------

import { spawn } from "node:child_process";
import { reportError } from "@/lib/monitoring/rollbar-official";
import { NextResponse } from "next/server";

const isProduction = process.env.NODE_ENV === "production";

export async function GET() {
	const streamUrl = process.env.WEBCAM_STREAM_URL;

	if (!streamUrl) {
		const msg = "WEBCAM_STREAM_URL is not configured";
		console.warn(`⚠ ${msg}`);
		if (isProduction) reportError(new Error(msg), undefined, "warning");
		return NextResponse.json({ error: msg }, { status: 503 });
	}

	try {
		const jpeg = await captureFrame(streamUrl);
		return new NextResponse(new Uint8Array(jpeg), {
			status: 200,
			headers: {
				"Content-Type": "image/jpeg",
				"Cache-Control": "no-store",
			},
		});
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		const msg = `Camera snapshot failed: ${reason}`;
		console.error(`✗ ${msg}`);
		if (isProduction) reportError(new Error(msg), undefined, "warning");
		return NextResponse.json({ error: msg }, { status: 503 });
	}
}

function captureFrame(streamUrl: string): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const args = [
			"-rtsp_transport",
			"tcp",
			"-i",
			streamUrl,
			"-frames:v",
			"1",
			"-f",
			"image2",
			"-vcodec",
			"mjpeg",
			"-q:v",
			"2",
			"pipe:1",
		];

		const child = spawn("ffmpeg", args, {
			stdio: ["pipe", "pipe", "pipe"],
		});

		const chunks: Buffer[] = [];
		let stderr = "";

		child.stdout.on("data", (data: Buffer) => chunks.push(data));
		child.stderr.on("data", (data: Buffer) => {
			stderr += data.toString();
		});

		const timeout = setTimeout(() => {
			child.kill("SIGKILL");
			reject(new Error("Snapshot timed out after 10s"));
		}, 10_000);

		child.on("close", (code) => {
			clearTimeout(timeout);
			if (code === 0 && chunks.length > 0) {
				resolve(Buffer.concat(chunks));
			} else {
				reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-200)}`));
			}
		});

		child.on("error", (err) => {
			clearTimeout(timeout);
			reject(new Error(`ffmpeg spawn error: ${err.message}`));
		});
	});
}
