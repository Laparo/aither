// ---------------------------------------------------------------------------
// Unit Tests: Auth Middleware
// Task: T045 [US4] — 401/403/200 für verschiedene Rollen
// ---------------------------------------------------------------------------

import { requireAdmin } from "@/lib/auth/role-check";
import { describe, expect, it } from "vitest";

function mockAuth(role: string | null, authenticated = true) {
	return authenticated ? { sessionClaims: { metadata: { role } } } : null;
}

describe("requireAdmin", () => {
	it("returns 401 for unauthenticated requests", () => {
		const res = requireAdmin(null);
		expect(res.status).toBe(401);
		const body1 = res.body as unknown as { error?: string };
		expect(body1.error).toBe("UNAUTHENTICATED");
	});

	it("returns 403 for non-admin users", () => {
		const res = requireAdmin(mockAuth("participant"));
		expect(res.status).toBe(403);
		const body2 = res.body as unknown as { error?: string };
		expect(body2.error).toBe("FORBIDDEN");
	});

	it("returns 200 for admin users", () => {
		const res = requireAdmin(mockAuth("admin"));
		expect(res.status).toBe(200);
		// Should include claims for downstream use
		const body3 = res.body as unknown as { sessionClaims?: { metadata?: { role?: string } } };
		expect(body3.sessionClaims?.metadata.role).toBe("admin");
	});
});
