// ---------------------------------------------------------------------------
// Contract Tests: Recordings API
// Task: T033 [US1b] — TDD: POST /api/recordings shape & validation
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/recordings/route";
import { describe, expect, it, vi } from "vitest";

// Mock auth — bypass requireAdmin check
vi.mock("@/lib/auth/role-check", () => ({
	requireAdmin: vi.fn().mockReturnValue({
		status: 200,
		body: { sessionClaims: { metadata: { role: "admin" } } },
	}),
}));

// Mock HemeraClient
vi.mock("@/lib/hemera/client", () => ({
	HemeraClient: vi.fn().mockImplementation(() => ({
		get: vi.fn(),
		put: vi.fn().mockResolvedValue({ status: 200, message: "OK" }),
	})),
}));

// Mock factory — prevent getTokenManager() from requiring HEMERA_API_KEY env var
vi.mock("@/lib/hemera/factory", () => ({
	createHemeraClient: vi.fn(() => ({
		get: vi.fn(),
		put: vi.fn().mockResolvedValue({ status: 200, message: "OK" }),
	})),
}));

// Mock config
vi.mock("@/lib/config", () => ({
	loadConfig: vi.fn().mockReturnValue({
		HEMERA_API_BASE_URL: "https://hemera.academy/api",
		HEMERA_API_KEY: "test-key-minimum-32-characters-long-for-validation",
		HTML_OUTPUT_DIR: "/tmp/output",
	}),
}));

function createRequest(body: unknown, method = "POST"): Request {
	return new Request("http://localhost:3000/api/recordings", {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/recordings", () => {
	it("returns 200 with transmit result for valid recording", async () => {
		const req = createRequest({
			seminarSourceId: "sem-001",
			muxAssetId: "asset-abc",
			muxPlaybackUrl: "https://stream.mux.com/abc.m3u8",
			recordingDate: "2026-02-11T10:00:00Z",
		});

		const res = await POST(req);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toHaveProperty("success");
	});

	it("returns 400 for invalid request body", async () => {
		const req = createRequest({
			seminarSourceId: "sem-001",
			// missing required fields
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json).toHaveProperty("error");
	});

	it("returns 400 with validation details when muxPlaybackUrl is invalid", async () => {
		const req = createRequest({
			seminarSourceId: "sem-001",
			muxAssetId: "asset-abc",
			muxPlaybackUrl: "not-a-url",
			recordingDate: "2026-02-11T10:00:00Z",
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
	});
});
