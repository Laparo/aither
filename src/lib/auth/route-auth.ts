// ---------------------------------------------------------------------------
// Route Auth Wrapper — Clerk v6 auth() for App Router route handlers
// Provides a single mockable entry point for all API routes.
// ---------------------------------------------------------------------------

import { auth } from "@clerk/nextjs/server";

/**
 * Retrieve session auth context in a route handler.
 *
 * Delegates to Clerk's `auth()` which reads session state
 * set by `clerkMiddleware` (src/middleware.ts).
 *
 * Returns `null` when no user is signed in, otherwise the
 * full Clerk session object including `sessionClaims`.
 */
export async function getRouteAuth(): Promise<unknown> {
	const session = await auth();
	return session?.userId ? session : null;
}
