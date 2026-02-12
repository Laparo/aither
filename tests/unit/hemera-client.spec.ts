// ---------------------------------------------------------------------------
// Unit Tests: Hemera API Client
// Task: T014 — Mock fetch, auth, throttling, retry, Zod rejection
// ---------------------------------------------------------------------------

import { HemeraApiError, HemeraClient } from "@/lib/hemera/client";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const TestSchema = z.object({ id: z.string(), name: z.string() });
const TestArraySchema = z.array(TestSchema);

function createMockFetch(
	responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>,
) {
	let callIndex = 0;
	return vi.fn(async () => {
		const resp = responses[callIndex] ?? responses[responses.length - 1];
		callIndex++;
		return {
			ok: resp.status >= 200 && resp.status < 300,
			status: resp.status,
			statusText: `Status ${resp.status}`,
			headers: new Headers(resp.headers ?? {}),
			json: async () => resp.body,
			text: async () => JSON.stringify(resp.body ?? ""),
		} as unknown as Response;
	});
}

function createClient(
	fetchFn: ReturnType<typeof createMockFetch>,
	overrides?: Partial<{ maxRetries: number; rateLimit: number }>,
) {
	return new HemeraClient({
		baseUrl: "https://api.hemera.academy",
		apiKey: "test-api-key",
		maxRetries: overrides?.maxRetries ?? 1,
		rateLimit: overrides?.rateLimit ?? 100, // high limit to avoid throttle delays in tests
		fetchFn: fetchFn as unknown as typeof fetch,
	});
}

describe("HemeraClient", () => {
	// ── Auth Header ──────────────────────────────────────────────────────

	describe("authentication", () => {
		it("sends Authorization Bearer header with API key", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: [{ id: "1", name: "Test" }] }]);
			const client = createClient(mockFetch);

			await client.get("/seminars", TestArraySchema);

			expect(mockFetch).toHaveBeenCalledTimes(1);
			const callArgs = mockFetch.mock.calls[0];
			expect(callArgs[0]).toBe("https://api.hemera.academy/seminars");
			expect(callArgs[1]?.headers).toMatchObject({
				Authorization: "Bearer test-api-key",
			});
		});

		it("strips trailing slashes from base URL", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: [{ id: "1", name: "Test" }] }]);
			const client = new HemeraClient({
				baseUrl: "https://api.hemera.academy///",
				apiKey: "key",
				maxRetries: 0,
				rateLimit: 100,
				fetchFn: mockFetch as unknown as typeof fetch,
			});

			await client.get("/seminars", TestArraySchema);
			expect(mockFetch.mock.calls[0][0]).toBe("https://api.hemera.academy/seminars");
		});
	});

	// ── Retry on 5xx ─────────────────────────────────────────────────────

	describe("retry on server errors", () => {
		it("retries on 500 and succeeds on subsequent attempt", async () => {
			const mockFetch = createMockFetch([
				{ status: 500, body: "Internal Server Error" },
				{ status: 200, body: [{ id: "1", name: "Test" }] },
			]);
			const client = createClient(mockFetch);

			const result = await client.get("/seminars", TestArraySchema);
			expect(result).toEqual([{ id: "1", name: "Test" }]);
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it("throws HemeraApiError after exhausting retries on 500", async () => {
			const mockFetch = createMockFetch([
				{ status: 500, body: "fail" },
				{ status: 500, body: "fail" },
				{ status: 500, body: "fail" },
			]);
			const client = createClient(mockFetch);

			await expect(client.get("/seminars", TestArraySchema)).rejects.toThrow(HemeraApiError);
		});
	});

	// ── 429 Retry-After ──────────────────────────────────────────────────

	describe("rate limit handling", () => {
		it("respects 429 response", async () => {
			const mockFetch = createMockFetch([{ status: 429, headers: { "Retry-After": "1" } }]);
			const client = createClient(mockFetch, { maxRetries: 0 });

			// With maxRetries=0 and AbortError on 429, it should throw
			await expect(client.get("/seminars", TestArraySchema)).rejects.toThrow();
		});
	});

	// ── 4xx abort (no retry) ─────────────────────────────────────────────

	describe("client errors (4xx)", () => {
		it("does not retry on 404", async () => {
			const mockFetch = createMockFetch([{ status: 404, body: "Not Found" }]);
			const client = createClient(mockFetch);

			await expect(client.get("/unknown", TestArraySchema)).rejects.toThrow();
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		it("does not retry on 400", async () => {
			const mockFetch = createMockFetch([{ status: 400, body: "Bad Request" }]);
			const client = createClient(mockFetch);

			await expect(client.get("/bad", TestArraySchema)).rejects.toThrow();
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});
	});

	// ── Zod validation ───────────────────────────────────────────────────

	describe("Zod response validation", () => {
		it("rejects response that doesn't match schema", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: [{ wrong: "shape" }] }]);
			const client = createClient(mockFetch);

			await expect(client.get("/seminars", TestArraySchema)).rejects.toThrow();
		});

		it("validates and returns typed data on valid response", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: { id: "1", name: "Single" } }]);
			const client = createClient(mockFetch);

			const result = await client.get("/item/1", TestSchema);
			expect(result).toEqual({ id: "1", name: "Single" });
		});
	});

	// ── PUT method ───────────────────────────────────────────────────────

	describe("put()", () => {
		it("sends PUT with JSON body and auth header", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: { id: "1", name: "Updated" } }]);
			const client = createClient(mockFetch);

			const result = await client.put("/item/1", { name: "Updated" }, TestSchema);
			expect(result).toEqual({ id: "1", name: "Updated" });

			const callArgs = mockFetch.mock.calls[0];
			expect(callArgs[1]?.method).toBe("PUT");
			expect(callArgs[1]?.headers).toMatchObject({
				Authorization: "Bearer test-api-key",
				"Content-Type": "application/json",
			});
		});

		it("retries PUT on 500", async () => {
			const mockFetch = createMockFetch([
				{ status: 500, body: "fail" },
				{ status: 200, body: { id: "1", name: "Ok" } },
			]);
			const client = createClient(mockFetch);

			const result = await client.put("/item/1", {}, TestSchema);
			expect(result).toEqual({ id: "1", name: "Ok" });
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});
	});
});
