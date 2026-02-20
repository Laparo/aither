// ---------------------------------------------------------------------------
// Unit Tests: Sync Mutex
// Task: T036 [US2] — Concurrent trigger → 409, sequential → success, lock release
// ---------------------------------------------------------------------------

import { GET, POST, _getState, _resetState } from "@/app/api/sync/route";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock loadConfig — provide validated env vars for route handlers
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

// Mock dependencies
vi.mock("@/lib/hemera/client", () => ({
	HemeraClient: vi.fn().mockImplementation(() => ({
		get: vi.fn().mockResolvedValue([]),
		put: vi.fn().mockResolvedValue({}),
	})),
}));

// Mock factory — prevent getTokenManager() from requiring HEMERA_API_KEY env var
vi.mock("@/lib/hemera/factory", () => ({
	createHemeraClient: vi.fn(() => ({
		get: vi.fn().mockResolvedValue([]),
		put: vi.fn().mockResolvedValue({}),
	})),
}));

vi.mock("@/lib/sync/orchestrator", () => ({
	SyncOrchestrator: vi.fn().mockImplementation(() => ({
		run: vi.fn().mockImplementation(
			() =>
				new Promise((resolve) =>
					setTimeout(
						() =>
							resolve({
								jobId: "test-job",
								startTime: new Date().toISOString(),
								endTime: new Date().toISOString(),
								status: "success",
								recordsFetched: 0,
								htmlFilesGenerated: 0,
								htmlFilesSkipped: 0,
								recordsTransmitted: 0,
								errors: [],
							}),
						50,
					),
				),
		),
	})),
}));

function createRequest(method: string) {
	return new NextRequest("http://localhost:3000/api/sync", { method });
}

describe("Sync Mutex", () => {
	beforeEach(() => {
		_resetState();
	});

	it("returns 409 when a sync is already running", async () => {
		// Trigger first sync
		const res1 = await POST(createRequest("POST"));
		expect(res1.status).toBe(202);

		// Trigger second sync while first is running
		const res2 = await POST(createRequest("POST"));
		expect(res2.status).toBe(409);
		const body = await res2.json();
		expect(body.error).toBe("SYNC_ALREADY_RUNNING");
	});

	it("allows sequential syncs after completion", async () => {
		// First sync
		const res1 = await POST(createRequest("POST"));
		expect(res1.status).toBe(202);

		// Wait for completion
		await new Promise((resolve) => setTimeout(resolve, 150));

		// Second sync should succeed
		const res2 = await POST(createRequest("POST"));
		expect(res2.status).toBe(202);
	});

	it("releases lock on orchestrator failure", async () => {
		// Override orchestrator to fail
		const { SyncOrchestrator } = await import("@/lib/sync/orchestrator");
		vi.mocked(SyncOrchestrator).mockImplementationOnce(
			() =>
				({
					run: vi.fn().mockRejectedValue(new Error("fetch failed")),
				}) as unknown as InstanceType<typeof SyncOrchestrator>,
		);

		const res1 = await POST(createRequest("POST"));
		expect(res1.status).toBe(202);

		// Wait for failure to propagate
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Lock should be released — new sync allowed
		const state = _getState();
		expect(state.isSyncRunning).toBe(false);
	});

	it("GET returns 404 when no sync has been run", async () => {
		const res = await GET(createRequest("GET"));
		expect(res.status).toBe(404);
	});

	it("GET returns current job status after POST", async () => {
		await POST(createRequest("POST"));
		const res = await GET(createRequest("GET"));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toHaveProperty("jobId");
		expect(body).toHaveProperty("status");
	});
});
