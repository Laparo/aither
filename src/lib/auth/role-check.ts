// ---------------------------------------------------------------------------
// Role-based Auth Helper
// Task: T047 [US4] — requireAdmin(auth)
// ---------------------------------------------------------------------------

/**
 * Checks if the user is authenticated and has admin role.
 * Returns { status, body } for use in API routes.
 */
type AuthLike = { sessionClaims?: { metadata?: { role?: string } } };

export function requireAdmin(auth: unknown): { status: number; body: unknown } {
	if (!auth) {
		return { status: 401, body: { error: "UNAUTHENTICATED" } };
	}
	const a = auth as AuthLike;
	if (a.sessionClaims?.metadata?.role !== "admin") {
		return { status: 403, body: { error: "FORBIDDEN" } };
	}
	return { status: 200, body: auth };
}
