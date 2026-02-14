// ---------------------------------------------------------------------------
// Contract Tests: Auth Protection
// Task: T046 [US4] — Endpunkte geschützt: 401/403/200
// ---------------------------------------------------------------------------

import { POST as recPOST } from "@/app/api/recordings/route";
import { POST as syncPOST } from "@/app/api/sync/route";
import { describe, expect, it, vi } from "vitest";

// Mock loadConfig
vi.mock("@/lib/config", () => ({
	loadConfig: vi.fn(() => ({
		HEMERA_API_BASE_URL: "https://api.hemera.test",
		HEMERA_SERVICE_TOKEN: "test-key",
		HTML_OUTPUT_DIR: "output",
	})),
}));

// Mock requireAdmin
vi.mock("@/lib/auth/role-check", () => ({
	requireAdmin: vi.fn((auth) => {
		if (!auth) return { status: 401, body: { error: "UNAUTHENTICATED" } };
		if (auth.sessionClaims?.metadata?.role !== "admin")
			return { status: 403, body: { error: "FORBIDDEN" } };
		return { status: 200, body: auth };
	}),
}));

// biome-ignore lint: test helper intentionally creates minimal mock
function createRequest(auth: unknown): any {
	return { auth };
}

describe("/api/sync and /api/recordings auth", () => {
	it("POST /api/sync returns 401 for unauthenticated", async () => {
		const res = await syncPOST(createRequest(null));
		expect(res.status).toBe(401);
	});

	it("POST /api/recordings returns 403 for non-admin", async () => {
		const res = await recPOST(
			createRequest({ sessionClaims: { metadata: { role: "participant" } } }),
		);
		expect(res.status).toBe(403);
	});

	it("POST /api/sync returns 202 for admin", async () => {
		const res = await syncPOST(createRequest({ sessionClaims: { metadata: { role: "admin" } } }));
		expect(res.status).toBe(202);
	});
});
