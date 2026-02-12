// ---------------------------------------------------------------------------
// Role-based Auth Helper
// Task: T047 [US4] — requireAdmin(auth)
// ---------------------------------------------------------------------------

/**
 * Checks if the user is authenticated and has admin role.
 * Returns { status, body } for use in API routes.
 */
export function requireAdmin(auth: any): { status: number; body: any } {
	if (!auth) {
		return { status: 401, body: { error: "UNAUTHENTICATED" } };
	}
	if (auth.sessionClaims?.metadata?.role !== "admin") {
		return { status: 403, body: { error: "FORBIDDEN" } };
	}
	return { status: 200, body: auth };
}
