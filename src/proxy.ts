// ---------------------------------------------------------------------------
// Clerk Proxy — Route Protection (Next.js 14+)
// Task: T016 — Protect /api/sync, /api/recordings, /(dashboard)/** routes
// ---------------------------------------------------------------------------

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const hasClerkKey = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_");

// Cache clerk handler to avoid re-importing and re-creating on every request
let _clerkHandler: ((req: NextRequest) => Promise<Response>) | null = null;

async function getClerkHandler(): Promise<(req: NextRequest) => Promise<Response>> {
	if (_clerkHandler) return _clerkHandler;

	const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server");

	const isProtectedRoute = createRouteMatcher([
		"/api/sync(.*)",
		"/api/recordings(.*)",
		"/api/recording(.*)",
		"/sync(.*)",
		"/recording(.*)",
		"/api/service/(.*)",
		"/(dashboard)(.*)",
	]);

	const handler = clerkMiddleware(async (auth, r) => {
		if (isProtectedRoute(r)) {
			await auth.protect();
		}
	});

	_clerkHandler = (r) => handler(r, {} as never);
	return _clerkHandler;
}

export default async function middleware(req: NextRequest) {
	if (!hasClerkKey) {
		return NextResponse.next();
	}
	const handler = await getClerkHandler();
	return handler(req);
}

export const config = {
	matcher: [
		// Skip Next.js internals and static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
