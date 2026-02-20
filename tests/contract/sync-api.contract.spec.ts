// ---------------------------------------------------------------------------
// Contract Tests: Aither Sync API
// Task: T028 [US1] — POST → 202, GET → 200, concurrent POST → 409
// ---------------------------------------------------------------------------

import { SyncJobResponseSchema } from "@/lib/sync/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock loadConfig
vi.mock("@/lib/config", () => ({
	loadConfig: vi.fn(() => ({
		HEMERA_API_BASE_URL: "https://api.hemera.test",
		HEMERA_API_KEY: "test-key-minimum-32-characters-long-for-validation",
		HTML_OUTPUT_DIR: "output",
	})),
}));

// Mock auth — bypass requireAdmin check
vi.mock("@/lib/auth/role-check", () => ({
	requireAdmin: vi.fn().mockReturnValue({
		status: 200,
		body: { sessionClaims: { metadata: { role: "admin" } } },
	}),
}));

// Mock modules before importing route
vi.mock("@/lib/hemera/client", () => ({
	HemeraClient: vi.fn().mockImplementation(() => ({
		get: vi.fn().mockResolvedValue([]),
		put: vi.fn(),
	})),
}));

// We test the route handlers directly by importing and calling them
import { GET, POST, _resetState } from "@/app/api/sync/route";
import { NextRequest } from "next/server";

function createRequest(method: string): NextRequest {
	return new NextRequest(new URL("http://localhost:3000/api/sync"), { method });
}

describe("POST /api/sync", () => {
	beforeEach(() => {
		_resetState();
	});

	it("returns 202 with a valid SyncJobResponse", async () => {
		const res = await POST(createRequest("POST"));

		expect(res.status).toBe(202);
		const body = await res.json();
		expect(body.status).toBe("running");
		expect(body.jobId).toBeTruthy();

		// Validate response shape matches contract
		const parsed = SyncJobResponseSchema.safeParse(body);
		expect(parsed.success).toBe(true);
	});

	it("returns 409 when a sync is already running", async () => {
		// First call starts sync
		await POST(createRequest("POST"));

		// Second call should get 409
		const res = await POST(createRequest("POST"));

		expect(res.status).toBe(409);
		const body = await res.json();
		expect(body.error).toBe("SYNC_ALREADY_RUNNING");
	});
});

describe("GET /api/sync", () => {
	beforeEach(() => {
		_resetState();
	});

	it("returns 404 when no sync has been executed", async () => {
		const res = await GET(createRequest("GET"));

		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBe("NO_SYNC_HISTORY");
	});

	it("returns 200 with sync status after a sync has been triggered", async () => {
		// Trigger a sync first
		await POST(createRequest("POST"));

		const res = await GET(createRequest("GET"));

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.jobId).toBeTruthy();
		expect(["running", "success", "failed"]).toContain(body.status);
	});
});
