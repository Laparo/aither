// ---------------------------------------------------------------------------
// HTTP Range Request Stream Handler
// Task: T010 [P] — Full file response, 206 partial content, Content-Range
//                  header, video/mp4 Content-Type
// ---------------------------------------------------------------------------

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

export interface StreamResult {
	stream: ReadableStream;
	headers: Record<string, string>;
	status: number;
}

/**
 * Create a streaming response for a video file, supporting HTTP Range requests.
 *
 * @param filePath - Absolute or relative path to the MP4 file
 * @param rangeHeader - The value of the Range request header (or undefined)
 * @returns StreamResult with the stream, headers, and HTTP status code
 * @throws Error if the file doesn't exist or can't be read
 */
export async function createStreamResponse(
	filePath: string,
	rangeHeader?: string | null,
): Promise<StreamResult> {
	const stats = await stat(filePath);
	const fileSize = stats.size;

	// Common headers
	const baseHeaders: Record<string, string> = {
		"Content-Type": "video/mp4",
		"Accept-Ranges": "bytes",
		"Cache-Control": "public, max-age=3600",
	};

	if (!rangeHeader) {
		// Full file response
		const nodeStream = createReadStream(filePath);
		const stream = nodeStreamToWeb(nodeStream);

		return {
			stream,
			headers: {
				...baseHeaders,
				"Content-Length": String(fileSize),
			},
			status: 200,
		};
	}

	// Parse Range header: "bytes=start-end"
	const rangeMatch = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
	if (!rangeMatch) {
		// Invalid Range → 416 Range Not Satisfiable
		return {
			stream: new ReadableStream({
				start(controller) {
					controller.close();
				},
			}),
			headers: {
				...baseHeaders,
				"Content-Range": `bytes */${fileSize}`,
			},
			status: 416,
		};
	}

	const start = Number.parseInt(rangeMatch[1], 10);
	let end = rangeMatch[2] ? Number.parseInt(rangeMatch[2], 10) : fileSize - 1;

	// Clamp end to fileSize - 1 per RFC 7233
	end = Math.min(end, fileSize - 1);

	// Validate range
	if (start >= fileSize || start > end) {
		return {
			stream: new ReadableStream({
				start(controller) {
					controller.close();
				},
			}),
			headers: {
				...baseHeaders,
				"Content-Range": `bytes */${fileSize}`,
			},
			status: 416,
		};
	}

	const contentLength = end - start + 1;
	const nodeStream = createReadStream(filePath, { start, end });
	const stream = nodeStreamToWeb(nodeStream);

	return {
		stream,
		headers: {
			...baseHeaders,
			"Content-Range": `bytes ${start}-${end}/${fileSize}`,
			"Content-Length": String(contentLength),
		},
		status: 206,
	};
}

/**
 * Convert a Node.js Readable stream to a Web ReadableStream.
 * Uses Node’s built-in Readable.toWeb when available, with a manual
 * fallback that respects backpressure via desiredSize checks.
 */
function nodeStreamToWeb(nodeStream: ReturnType<typeof createReadStream>): ReadableStream {
	// Prefer native conversion (Node 17+)
	if (typeof Readable.toWeb === "function") {
		return Readable.toWeb(nodeStream as unknown as Readable) as ReadableStream;
	}

	// Manual fallback with backpressure support
	return new ReadableStream({
		start(controller) {
			nodeStream.on("data", (chunk: Buffer | string) => {
				const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
				controller.enqueue(new Uint8Array(buf));
				if ((controller.desiredSize ?? 0) <= 0) {
					nodeStream.pause();
				}
			});
			nodeStream.on("end", () => {
				controller.close();
			});
			nodeStream.on("error", (err) => {
				controller.error(err);
			});
		},
		pull() {
			nodeStream.resume();
		},
		cancel() {
			nodeStream.destroy();
		},
	});
}
