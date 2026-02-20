// ---------------------------------------------------------------------------
// Contract Tests: Slides API
// Task: T014 [US4] — POST /api/slides: 200, 401, 403, 409
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock loadConfig
vi.mock("@/lib/config", () => ({
	loadConfig: vi.fn(() => ({
		HEMERA_API_BASE_URL: "https://api.hemera.test",
		HEMERA_API_KEY: "test-key-minimum-32-characters-long-for-validation",
		SLIDES_OUTPUT_DIR: "output/slides",
	})),
}));

// Mock auth — default: admin
const mockRequireAdmin = vi.fn().mockReturnValue({
	status: 200,
	body: { sessionClaims: { metadata: { role: "admin" } } },
});

vi.mock("@/lib/auth/role-check", () => ({
	requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

// Mock SlideGenerator
const mockGenerate = vi.fn().mockResolvedValue({
	slidesGenerated: 5,
	courseTitle: "Test Course",
	courseId: "sem-1",
	slides: [],
});

vi.mock("@/lib/slides/generator", () => ({
	SlideGenerator: vi.fn().mockImplementation(() => ({
		generate: mockGenerate,
	})),
}));

// Mock HemeraClient
vi.mock("@/lib/hemera/client", () => ({
	HemeraClient: vi.fn().mockImplementation(() => ({})),
}));

// Mock factory — prevent getTokenManager() from requiring HEMERA_API_KEY env var
vi.mock("@/lib/hemera/factory", () => ({
	createHemeraClient: vi.fn(() => ({
		get: vi.fn().mockResolvedValue([]),
		put: vi.fn().mockResolvedValue({}),
	})),
}));

// Mock Rollbar
vi.mock("@/lib/monitoring/rollbar-official", () => ({
	reportError: vi.fn(),
}));

import { POST, _resetState } from "@/app/api/slides/route";
import { NextRequest } from "next/server";

function createRequest(): NextRequest {
	return new NextRequest(new URL("http://localhost:3000/api/slides"), { method: "POST" });
}

describe("POST /api/slides", () => {
	beforeEach(() => {
		_resetState();
		mockRequireAdmin.mockReturnValue({
			status: 200,
			body: { sessionClaims: { metadata: { role: "admin" } } },
		});
		mockGenerate.mockResolvedValue({
			slidesGenerated: 5,
			courseTitle: "Test Course",
			courseId: "sem-1",
			slides: [],
		});
	});

	it("returns 200 with slide count on success", async () => {
		const res = await POST(createRequest());

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.status).toBe("success");
		expect(body.slidesGenerated).toBe(5);
		expect(body.courseTitle).toBe("Test Course");
	});

	it("returns 401 for unauthenticated requests", async () => {
		mockRequireAdmin.mockReturnValue({
			status: 401,
			body: { error: "UNAUTHENTICATED" },
		});

		const res = await POST(createRequest());

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toBe("UNAUTHENTICATED");
	});

	it("returns 403 for non-admin users", async () => {
		mockRequireAdmin.mockReturnValue({
			status: 403,
			body: { error: "FORBIDDEN" },
		});

		const res = await POST(createRequest());

		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body.error).toBe("FORBIDDEN");
	});

	it("returns 409 when slide generation is already running", async () => {
		let resolveGenerate!: () => void;
		mockGenerate.mockImplementation(
			() =>
				new Promise<unknown>((resolve) => {
					resolveGenerate = () =>
						resolve({
							slidesGenerated: 5,
							courseTitle: "Test",
							courseId: "sem-1",
							slides: [],
						});
				}),
		);

		// Start first request (won't resolve until we call resolveGenerate)
		const promise1 = POST(createRequest());

		// Yield to allow the route handler to reach the generate() call and set the mutex
		await new Promise((r) => setTimeout(r, 50));

		// Second request should get 409
		const res2 = await POST(createRequest());
		expect(res2.status).toBe(409);
		const body = await res2.json();
		expect(body.error).toBe("SLIDES_ALREADY_RUNNING");

		// Clean up: resolve the first request
		resolveGenerate();
		await promise1;
	});
});
