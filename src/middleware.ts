// ---------------------------------------------------------------------------
// Clerk Middleware — Route Protection
// Task: T016 — Protect /api/sync, /api/recordings, /(dashboard)/** routes
// ---------------------------------------------------------------------------

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
	"/api/sync(.*)",
	"/api/recordings(.*)",
	"/sync(.*)",
	"/api/service/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
	if (isProtectedRoute(req)) {
		await auth.protect();
	}
});

export const config = {
	matcher: [
		// Skip Next.js internals and static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
