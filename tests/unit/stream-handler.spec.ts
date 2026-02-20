// ---------------------------------------------------------------------------
// Unit Tests: Stream Handler
// Task: T031a [P] [US5] — Full file response, 206 partial content, Content-
//                          Range format, invalid Range→416, missing file error
// ---------------------------------------------------------------------------

import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
	stat: vi.fn().mockResolvedValue({ size: 10000 }),
}));

// Mock fs — createReadStream returns a real Readable so Readable.toWeb() succeeds
vi.mock("node:fs", () => ({
	createReadStream: vi.fn().mockImplementation(() => {
		const stream = new Readable({
			read() {
				this.push(null);
			},
		});
		return stream;
	}),
}));

describe("Stream Handler", () => {
	it("returns 200 with full file for no Range header", async () => {
		const { createStreamResponse } = await import("@/lib/recording/stream-handler");
		const result = await createStreamResponse("/tmp/test.mp4");

		expect(result.status).toBe(200);
		expect(result.headers["Content-Type"]).toBe("video/mp4");
		expect(result.headers["Content-Length"]).toBe("10000");
		expect(result.headers["Accept-Ranges"]).toBe("bytes");
		expect(result.stream).toBeInstanceOf(ReadableStream);
	});

	it("returns 206 with partial content for valid Range header", async () => {
		const { createStreamResponse } = await import("@/lib/recording/stream-handler");
		const result = await createStreamResponse("/tmp/test.mp4", "bytes=0-999");

		expect(result.status).toBe(206);
		expect(result.headers["Content-Range"]).toBe("bytes 0-999/10000");
		expect(result.headers["Content-Length"]).toBe("1000");
	});

	it("returns 206 for open-ended Range header", async () => {
		const { createStreamResponse } = await import("@/lib/recording/stream-handler");
		const result = await createStreamResponse("/tmp/test.mp4", "bytes=5000-");

		expect(result.status).toBe(206);
		expect(result.headers["Content-Range"]).toBe("bytes 5000-9999/10000");
		expect(result.headers["Content-Length"]).toBe("5000");
	});

	it("returns 416 for invalid Range format", async () => {
		const { createStreamResponse } = await import("@/lib/recording/stream-handler");
		const result = await createStreamResponse("/tmp/test.mp4", "invalid-range");

		expect(result.status).toBe(416);
		expect(result.headers["Content-Range"]).toBe("bytes */10000");
	});

	it("returns 416 for out-of-bounds Range", async () => {
		const { createStreamResponse } = await import("@/lib/recording/stream-handler");
		const result = await createStreamResponse("/tmp/test.mp4", "bytes=20000-30000");

		expect(result.status).toBe(416);
	});

	it("throws when file does not exist", async () => {
		const { stat } = await import("node:fs/promises");
		vi.mocked(stat).mockRejectedValueOnce(new Error("ENOENT: no such file"));

		const { createStreamResponse } = await import("@/lib/recording/stream-handler");
		await expect(createStreamResponse("/tmp/nonexistent.mp4")).rejects.toThrow("ENOENT");
	});
});
