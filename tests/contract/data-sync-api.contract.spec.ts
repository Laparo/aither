// ---------------------------------------------------------------------------
// Contract Tests: Aither Data Sync API (005-data-sync)
// Task: T008 [US1] — POST → 202, GET → 200, concurrent POST → 409, GET 404
// Validates response shapes match contracts/sync-api.yaml
// ---------------------------------------------------------------------------

import {
	DataSyncJobSchema,
	SyncErrorResponseSchema,
	SyncStartedResponseSchema,
	SyncStatusResponseSchema,
} from "@/lib/sync/schemas";
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
vi.mock("@/lib/auth/route-auth", () => ({
	getRouteAuth: vi.fn().mockResolvedValue({ sessionClaims: { metadata: { role: "admin" } } }),
}));
vi.mock("@/lib/auth/role-check", () => ({
	requireAdmin: vi.fn().mockReturnValue({
		status: 200,
		body: { sessionClaims: { metadata: { role: "admin" } } },
	}),
}));

// Mock HemeraClient
vi.mock("@/lib/hemera/client", () => ({
	HemeraClient: vi.fn().mockImplementation(() => ({
		get: vi.fn().mockResolvedValue({ success: true, data: [], meta: {} }),
		put: vi.fn(),
	})),
}));

// Mock factory
vi.mock("@/lib/hemera/factory", () => ({
	createHemeraClient: vi.fn(() => ({
		get: vi.fn().mockResolvedValue({ success: true, data: [], meta: {} }),
		put: vi.fn().mockResolvedValue({}),
	})),
}));

import { GET, POST, _resetState } from "@/app/api/sync/route";
import { NextRequest } from "next/server";

function createRequest(method: string): NextRequest {
	return new NextRequest(new URL("http://localhost:3500/api/sync"), { method });
}

describe("Data Sync API Contract (005-data-sync)", () => {
	beforeEach(() => {
		_resetState();
	});

	describe("POST /api/sync", () => {
		it("returns 202 with SyncStartedResponse envelope", async () => {
			const res = await POST(createRequest("POST"));

			expect(res.status).toBe(202);
			const body = await res.json();

			// Validate against contract schema
			const parsed = SyncStartedResponseSchema.safeParse(body);
			expect(parsed.success).toBe(true);
			expect(body.success).toBe(true);
			expect(body.data.status).toBe("running");
			expect(body.data.jobId).toBeTruthy();
			expect(body.data.startTime).toBeTruthy();
			expect(body.meta.requestId).toBeTruthy();
			expect(body.meta.timestamp).toBeTruthy();
		});

		it("returns 409 with SyncErrorResponse when sync already running", async () => {
			// First call starts sync
			await POST(createRequest("POST"));

			// Second call should be rejected
			const res = await POST(createRequest("POST"));

			expect(res.status).toBe(409);
			const body = await res.json();

			const parsed = SyncErrorResponseSchema.safeParse(body);
			expect(parsed.success).toBe(true);
			expect(body.success).toBe(false);
			expect(body.error.code).toBe("SYNC_IN_PROGRESS");
			expect(body.error.message).toBeTruthy();
		});
	});

	describe("GET /api/sync", () => {
		it("returns 404 with SyncErrorResponse when no sync has been executed", async () => {
			const res = await GET(createRequest("GET"));

			expect(res.status).toBe(404);
			const body = await res.json();

			const parsed = SyncErrorResponseSchema.safeParse(body);
			expect(parsed.success).toBe(true);
			expect(body.success).toBe(false);
			expect(body.error.code).toBe("NO_SYNC_JOB");
		});

		it("returns 200 with SyncStatusResponse after sync triggered", async () => {
			// Trigger a sync first
			await POST(createRequest("POST"));

			const res = await GET(createRequest("GET"));

			expect(res.status).toBe(200);
			const body = await res.json();

			const parsed = SyncStatusResponseSchema.safeParse(body);
			expect(parsed.success).toBe(true);
			expect(body.success).toBe(true);
			expect(body.data.jobId).toBeTruthy();
			expect(["running", "success", "failed"]).toContain(body.data.status);

			// DataSyncJob-specific fields must exist
			const dataParsed = DataSyncJobSchema.safeParse(body.data);
			expect(dataParsed.success).toBe(true);
		});
	});
});
