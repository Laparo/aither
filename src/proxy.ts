// ---------------------------------------------------------------------------
// Clerk Proxy — Route Protection (Next.js 14+)
// Task: T016 — Protect /api/sync, /api/recordings, /(dashboard)/** routes
// ---------------------------------------------------------------------------

import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

const hasClerkKey = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_");

const protectedPatterns = [
	"/api/sync(.*)",
	"/api/recordings(.*)",
	"/api/recording(.*)",
	"/sync(.*)",
	"/recording(.*)",
	"/api/service/(.*)",
	"/dashboard(.*)",
];

const protectedRegexes = protectedPatterns.map((p) => new RegExp(`^${p}$`));

function isProtectedPath(pathname: string): boolean {
	return protectedRegexes.some((re) => re.test(pathname));
}

// Cache clerk handler promise to deduplicate concurrent initialization
let _clerkHandlerPromise: Promise<
	(req: NextRequest, ev: NextFetchEvent) => Promise<Response>
> | null = null;

async function getClerkHandler(): Promise<
	(req: NextRequest, ev: NextFetchEvent) => Promise<Response>
> {
	if (!_clerkHandlerPromise) {
		_clerkHandlerPromise = (async () => {
			try {
				const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server");

				const isProtectedRoute = createRouteMatcher(protectedPatterns);

				const handler = clerkMiddleware(async (auth, r) => {
					if (isProtectedRoute(r)) {
						await auth.protect();
					}
				});

				return (r: NextRequest, ev: NextFetchEvent) => handler(r, ev) as Promise<Response>;
			} catch (err) {
				_clerkHandlerPromise = null;
				throw err;
			}
		})();
	}
	return _clerkHandlerPromise;
}

export default async function middleware(req: NextRequest, ev: NextFetchEvent) {
	if (!hasClerkKey) {
		if (isProtectedPath(req.nextUrl.pathname)) {
			console.error(
				"[proxy] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing — blocking protected route %s",
				req.nextUrl.pathname,
			);
			return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
		}
		return NextResponse.next();
	}
	const handler = await getClerkHandler();
	return handler(req, ev);
}

export const config = {
	matcher: [
		// Skip Next.js internals and static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
