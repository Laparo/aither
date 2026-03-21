// ---------------------------------------------------------------------------
// Hemera Client Factory
// Creates configured HemeraClient instances with token management
// with automatic fallback support for hybrid container/network setups
// ---------------------------------------------------------------------------

import { loadConfig } from "../config";
import { HemeraClient } from "./client";
import { getTokenManager } from "./token-manager";

// Cache for the working URL (to avoid retrying failed URLs)
let cachedBaseUrl: string | null = null;

/** Return origin + pathname only — strip query string, hash, and credentials */
function sanitizeUrlForLog(url: string): string {
	try {
		const parsed = new URL(url);
		return `${parsed.origin}${parsed.pathname}`;
	} catch {
		return "(invalid URL)";
	}
}

/**
 * Get the base URL for Hemera API, with automatic fallback support.
 *
 * Strategy:
 * 1. If a cached working URL exists, use it
 * 2. Try the primary URL first (health check via HEAD with timeout)
 * 3. If primary fails and fallback URL is configured, try fallback
 * 4. Cache the working URL for subsequent requests
 */
async function getBaseUrlWithFallback(): Promise<string> {
	if (cachedBaseUrl) {
		return cachedBaseUrl;
	}

	const config = loadConfig();
	const primaryUrl = config.HEMERA_API_BASE_URL;
	const fallbackUrl = config.HEMERA_API_FALLBACK_URL;

	// If no fallback is configured, return primary URL
	if (!fallbackUrl) {
		cachedBaseUrl = primaryUrl;
		return primaryUrl;
	}

	// Health check: try a HEAD request against the primary URL with a short timeout
	console.log(`[Hemera] Testing primary URL: ${sanitizeUrlForLog(primaryUrl)}`);
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 3000);
		try {
			const res = await fetch(primaryUrl, {
				method: "HEAD",
				signal: controller.signal,
			});
			clearTimeout(timer);
			if (res.ok || res.status < 500) {
				cachedBaseUrl = primaryUrl;
				return primaryUrl;
			}
		} finally {
			clearTimeout(timer);
		}
	} catch (err) {
		console.warn(
			`[Hemera] Primary URL health check failed: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	// Primary failed — try fallback
	console.log(`[Hemera] Falling back to: ${sanitizeUrlForLog(fallbackUrl)}`);
	cachedBaseUrl = fallbackUrl;
	return fallbackUrl;
}

/**
 * Reset the cached base URL (useful for testing or when network changes)
 */
export function resetHemeraBaseUrl(): void {
	cachedBaseUrl = null;
	console.log("[Hemera] Base URL cache cleared");
}

/**
 * Create a configured HemeraClient instance.
 * Uses environment configuration and token manager for authentication.
 * Supports automatic fallback to HEMERA_API_FALLBACK_URL when primary fails.
 *
 * @returns Configured HemeraClient ready for API calls
 */
export async function createHemeraClient(): Promise<HemeraClient> {
	const config = loadConfig();
	const tokenManager = getTokenManager();
	const fallbackUrl = config.HEMERA_API_FALLBACK_URL;

	// Defensive validation: ensure tokenManager exposes a getToken() function
	if (
		!tokenManager ||
		typeof (tokenManager as unknown as Record<string, unknown>).getToken !== "function"
	) {
		throw new Error(
			"createHemeraClient error: token manager does not provide `getToken()`.\n" +
				"Ensure getTokenManager() returns an object with `getToken(): Promise<string>` and that HEMERA_API_KEY is configured.",
		);
	}

	const baseUrl = await getBaseUrlWithFallback();

	// If fallback is configured, create a client that can fall back
	if (fallbackUrl) {
		// Create a wrapping fetch function that tries fallback on network errors
		const originalFetch = globalThis.fetch;

		let primaryOrigin: string;
		let fallbackOrigin: string;
		try {
			primaryOrigin = new URL(baseUrl).origin;
		} catch {
			throw new Error(
				`[Hemera] Invalid baseUrl — cannot parse origin from "${sanitizeUrlForLog(baseUrl)}". Check HEMERA_API_BASE_URL / HEMERA_API_FALLBACK_URL configuration.`,
			);
		}
		try {
			fallbackOrigin = new URL(fallbackUrl).origin;
		} catch {
			throw new Error(
				`[Hemera] Invalid fallbackUrl — cannot parse origin from "${sanitizeUrlForLog(fallbackUrl)}". Check HEMERA_API_FALLBACK_URL configuration.`,
			);
		}

		const fallbackFetch = async (
			input: string | URL | Request,
			init?: RequestInit,
		): Promise<Response> => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

			// Only intercept requests targeting the primary Hemera origin
			let parsed: URL;
			try {
				parsed = new URL(url);
			} catch {
				// Unparseable URL — pass through without fallback
				return originalFetch(input, init);
			}

			if (parsed.origin !== primaryOrigin) {
				// Not a Hemera request — pass through without fallback
				return originalFetch(input, init);
			}

			try {
				return await originalFetch(input, init);
			} catch {
				console.warn(`[Hemera] Primary URL failed, trying fallback: ${sanitizeUrlForLog(url)}`);

				const fallbackRequestUrl = `${fallbackOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
				const fallbackResponse = await originalFetch(fallbackRequestUrl, init);
				if (fallbackResponse.ok) {
					cachedBaseUrl = fallbackUrl; // Cache only on successful fallback
				}
				return fallbackResponse;
			}
		};

		return new HemeraClient({
			baseUrl,
			getToken: () => tokenManager.getToken(),
			allowedPathPrefix: "/",
			rateLimit: 2,
			maxRetries: 5,
			fetchFn: fallbackFetch,
		});
	}

	// No fallback configured - return standard client
	return new HemeraClient({
		baseUrl,
		getToken: () => tokenManager.getToken(),
		allowedPathPrefix: "/",
		rateLimit: 2,
		maxRetries: 5,
	});
}
