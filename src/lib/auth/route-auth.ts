// ---------------------------------------------------------------------------
// Route Auth Wrapper — Clerk v6 auth() for App Router route handlers
// Provides a single mockable entry point for all API routes.
// ---------------------------------------------------------------------------

const hasClerkKey = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_");

/**
 * Retrieve session auth context in a route handler.
 *
 * Delegates to Clerk's `auth()` which reads session state
 * set by `clerkMiddleware` (src/proxy.ts).
 *
 * Returns `null` when no user is signed in, otherwise the
 * full Clerk session object including `sessionClaims`.
 *
 * In development without a valid Clerk key, returns a mock admin session
 * so local dashboard routes work without authentication.
 */
export async function getRouteAuth(): Promise<unknown> {
	if (
		!hasClerkKey &&
		process.env.NODE_ENV === "development" &&
		process.env.ENABLE_DEV_AUTH_BYPASS === "true"
	) {
		console.warn("[route-auth] Dev auth bypass is active — returning mock admin session");
		return {
			userId: "dev-user",
			sessionClaims: { metadata: { role: "admin" } },
		};
	}

	const { auth } = await import("@clerk/nextjs/server");
	const session = await auth();
	return session?.userId ? session : null;
}
