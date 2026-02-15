// ---------------------------------------------------------------------------
// Unit Tests: Hemera API Client
// Task: T014 — Mock fetch, auth, throttling, retry, Zod rejection
// ---------------------------------------------------------------------------

import { HemeraApiError, HemeraClient, HemeraTokenError } from "@/lib/hemera/client";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const TestSchema = z.object({ id: z.string(), name: z.string() });
const TestArraySchema = z.array(TestSchema);

function createMockFetch(
	responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>,
) {
	let callIndex = 0;
	return vi.fn(async (_url: string, _init?: RequestInit) => {
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

// Valid JWT token structure for testing (doesn't need to be a real JWT)
const VALID_TEST_TOKEN =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";

function createClient(
	fetchFn: ReturnType<typeof createMockFetch>,
	overrides?: Partial<{ maxRetries: number; rateLimit: number; getToken?: () => Promise<string> }>,
) {
	return new HemeraClient({
		baseUrl: "https://api.hemera.academy",
		getToken: overrides?.getToken ?? (async () => VALID_TEST_TOKEN),
		allowedPathPrefix: "/",
		requiredRole: undefined,
		maxRetries: overrides?.maxRetries ?? 1,
		rateLimit: overrides?.rateLimit ?? 100, // high limit to avoid throttle delays in tests
		fetchFn: fetchFn as unknown as typeof fetch,
	});
}

describe("HemeraClient", () => {
	it("throws if constructed without getToken()", () => {
		const badOptions = {
			baseUrl: "https://api.hemera.academy",
			// intentionally missing getToken
			maxRetries: 0,
			rateLimit: 100,
			fetchFn: (async () => null) as unknown as typeof fetch,
		} as unknown as ConstructorParameters<typeof HemeraClient>[0];

		expect(() => new HemeraClient(badOptions)).toThrow(
			/a valid `getToken\(\)` function is required/,
		);
	});

	// ── Token Validation ─────────────────────────────────────────────────

	describe("token validation", () => {
		it("throws HemeraTokenError when getToken() returns empty string", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: [{ id: "1", name: "Test" }] }]);
			const client = new HemeraClient({
				baseUrl: "https://api.hemera.academy",
				getToken: async () => "",
				allowedPathPrefix: "/",
				requiredRole: undefined,
				maxRetries: 1,
				rateLimit: 100,
				fetchFn: mockFetch as unknown as typeof fetch,
			});

			await expect(client.get("/seminars", TestArraySchema)).rejects.toThrow(HemeraTokenError);
			await expect(client.get("/seminars", TestArraySchema)).rejects.toThrow(/empty token/);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("throws HemeraTokenError when getToken() returns whitespace-only string", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: [{ id: "1", name: "Test" }] }]);
			const client = new HemeraClient({
				baseUrl: "https://api.hemera.academy",
				getToken: async () => "   ",
				allowedPathPrefix: "/",
				requiredRole: undefined,
				maxRetries: 1,
				rateLimit: 100,
				fetchFn: mockFetch as unknown as typeof fetch,
			});

			await expect(client.get("/seminars", TestArraySchema)).rejects.toThrow(HemeraTokenError);
			await expect(client.get("/seminars", TestArraySchema)).rejects.toThrow(/empty token/);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("throws HemeraTokenError when token has invalid JWT structure (too few parts)", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: [{ id: "1", name: "Test" }] }]);
			const client = new HemeraClient({
				baseUrl: "https://api.hemera.academy",
				getToken: async () => "invalid.token",
				allowedPathPrefix: "/",
				requiredRole: undefined,
				maxRetries: 1,
				rateLimit: 100,
				fetchFn: mockFetch as unknown as typeof fetch,
			});

			await expect(client.get("/seminars", TestArraySchema)).rejects.toThrow(HemeraTokenError);
			await expect(client.get("/seminars", TestArraySchema)).rejects.toThrow(
				/malformed JWT structure/,
			);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("throws HemeraTokenError when token has invalid JWT structure (too many parts)", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: [{ id: "1", name: "Test" }] }]);
			const client = new HemeraClient({
				baseUrl: "https://api.hemera.academy",
				getToken: async () => "part1.part2.part3.part4",
				allowedPathPrefix: "/",
				requiredRole: undefined,
				maxRetries: 1,
				rateLimit: 100,
				fetchFn: mockFetch as unknown as typeof fetch,
			});

			await expect(client.get("/seminars", TestArraySchema)).rejects.toThrow(HemeraTokenError);
			await expect(client.get("/seminars", TestArraySchema)).rejects.toThrow(
				/malformed JWT structure/,
			);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("throws HemeraTokenError when token has empty segments", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: [{ id: "1", name: "Test" }] }]);
			const client = new HemeraClient({
				baseUrl: "https://api.hemera.academy",
				getToken: async () => "header..signature",
				allowedPathPrefix: "/",
				requiredRole: undefined,
				maxRetries: 1,
				rateLimit: 100,
				fetchFn: mockFetch as unknown as typeof fetch,
			});

			await expect(client.get("/seminars", TestArraySchema)).rejects.toThrow(HemeraTokenError);
			await expect(client.get("/seminars", TestArraySchema)).rejects.toThrow(/empty segments/);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("throws HemeraTokenError when token has invalid base64url encoding", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: [{ id: "1", name: "Test" }] }]);
			const client = new HemeraClient({
				baseUrl: "https://api.hemera.academy",
				getToken: async () => "invalid@chars.payload!.signature",
				allowedPathPrefix: "/",
				requiredRole: undefined,
				maxRetries: 1,
				rateLimit: 100,
				fetchFn: mockFetch as unknown as typeof fetch,
			});

			await expect(client.get("/seminars", TestArraySchema)).rejects.toThrow(HemeraTokenError);
			await expect(client.get("/seminars", TestArraySchema)).rejects.toThrow(
				/invalid base64url encoding/,
			);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("accepts valid JWT token structure", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: [{ id: "1", name: "Test" }] }]);
			const client = new HemeraClient({
				baseUrl: "https://api.hemera.academy",
				getToken: async () => VALID_TEST_TOKEN,
				allowedPathPrefix: "/",
				requiredRole: undefined,
				maxRetries: 1,
				rateLimit: 100,
				fetchFn: mockFetch as unknown as typeof fetch,
			});

			const result = await client.get("/seminars", TestArraySchema);
			expect(result).toEqual([{ id: "1", name: "Test" }]);
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		it("validates token on PUT requests", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: { id: "1", name: "Test" } }]);
			const client = new HemeraClient({
				baseUrl: "https://api.hemera.academy",
				getToken: async () => "",
				allowedPathPrefix: "/",
				requiredRole: undefined,
				maxRetries: 1,
				rateLimit: 100,
				fetchFn: mockFetch as unknown as typeof fetch,
			});

			await expect(client.put("/item/1", { name: "Test" }, TestSchema)).rejects.toThrow(
				HemeraTokenError,
			);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	// ── Auth Header ──────────────────────────────────────────────────────

	describe("authentication", () => {
		it("sends Authorization Bearer header with token from getToken", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: [{ id: "1", name: "Test" }] }]);
			const mockGetToken = vi.fn(async () => "mock-token-123");
			const client = createClient(mockFetch, { getToken: mockGetToken });
	
			await client.get("/seminars", TestArraySchema);
	
			expect(mockGetToken).toHaveBeenCalledTimes(1);
			expect(mockFetch).toHaveBeenCalledTimes(1);
			const callArgs = mockFetch.mock.calls[0];
			expect(callArgs[0]).toBe("https://api.hemera.academy/seminars");
			expect(callArgs[1]?.headers).toMatchObject({
				Authorization: "Bearer mock-token-123",
			});
		});

		it("strips trailing slashes from base URL", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: [{ id: "1", name: "Test" }] }]);
			const client = new HemeraClient({
				baseUrl: "https://api.hemera.academy///",
				getToken: async () => VALID_TEST_TOKEN,
				allowedPathPrefix: "/",
				requiredRole: undefined,
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
		it("retries after 429 and succeeds on next attempt", async () => {
			const mockFetch = createMockFetch([
				{ status: 429, headers: { "Retry-After": "1" } },
				{ status: 200, body: [{ id: "1", name: "Test" }] },
			]);
			const client = createClient(mockFetch);

			const result = await client.get("/seminars", TestArraySchema);
			expect(result).toEqual([{ id: "1", name: "Test" }]);
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it("throws HemeraApiError after exhausting retries on 429", async () => {
			const mockFetch = createMockFetch([{ status: 429, headers: { "Retry-After": "1" } }]);
			const client = createClient(mockFetch, { maxRetries: 0 });

			await expect(client.get("/seminars", TestArraySchema)).rejects.toThrow(HemeraApiError);
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

		it("does not retry on 401 (unauthorized)", async () => {
			const mockFetch = createMockFetch([
				{ status: 401, body: "Unauthorized" },
				{ status: 200, body: [{ id: "1", name: "Test" }] },
			]);
			const client = createClient(mockFetch);

			await expect(client.get("/protected", TestArraySchema)).rejects.toThrow(HemeraApiError);
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		it("does not retry on 403 (forbidden)", async () => {
			const mockFetch = createMockFetch([
				{ status: 403, body: "Forbidden" },
				{ status: 200, body: [{ id: "1", name: "Test" }] },
			]);
			const client = createClient(mockFetch);

			await expect(client.get("/admin", TestArraySchema)).rejects.toThrow(HemeraApiError);
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		it("does not retry PUT on 401", async () => {
			const mockFetch = createMockFetch([
				{ status: 401, body: "Unauthorized" },
				{ status: 200, body: { id: "1", name: "Ok" } },
			]);
			const client = createClient(mockFetch);

			await expect(client.put("/item/1", {}, TestSchema)).rejects.toThrow(HemeraApiError);
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});
	});

	// ── Path normalization ──────────────────────────────────────────────

	describe("path normalization", () => {
		it("rejects path traversal via double-dot segments", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: [{ id: "1", name: "Test" }] }]);
			const client = new HemeraClient({
				baseUrl: "https://api.hemera.academy",
				getToken: async () => VALID_TEST_TOKEN,
				allowedPathPrefix: "/api/service/",
				requiredRole: undefined,
				maxRetries: 0,
				rateLimit: 100,
				fetchFn: mockFetch as unknown as typeof fetch,
			});

			await expect(client.get("/api/service/../public/secret", TestArraySchema)).rejects.toThrow(
				/disallowed path/,
			);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("rejects path with double slashes that bypass prefix", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: [{ id: "1", name: "Test" }] }]);
			const client = new HemeraClient({
				baseUrl: "https://api.hemera.academy",
				getToken: async () => VALID_TEST_TOKEN,
				allowedPathPrefix: "/api/service/",
				requiredRole: undefined,
				maxRetries: 0,
				rateLimit: 100,
				fetchFn: mockFetch as unknown as typeof fetch,
			});

			await expect(client.get("//api/service/../public", TestArraySchema)).rejects.toThrow(
				/disallowed path/,
			);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("allows valid path within allowed prefix after normalization", async () => {
			const mockFetch = createMockFetch([{ status: 200, body: [{ id: "1", name: "Test" }] }]);
			const client = new HemeraClient({
				baseUrl: "https://api.hemera.academy",
				getToken: async () => VALID_TEST_TOKEN,
				allowedPathPrefix: "/api/service/",
				requiredRole: undefined,
				maxRetries: 0,
				rateLimit: 100,
				fetchFn: mockFetch as unknown as typeof fetch,
			});

			const result = await client.get("/api/service/courses", TestArraySchema);
			expect(result).toEqual([{ id: "1", name: "Test" }]);
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
				Authorization: `Bearer ${VALID_TEST_TOKEN}`,
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
