// ---------------------------------------------------------------------------
// Hemera Client Factory
// Creates configured HemeraClient instances with token management
// with automatic fallback support for hybrid container/network setups
// ---------------------------------------------------------------------------

import { loadConfig } from "../config";
import { reportError } from "../monitoring/rollbar-official";
import { HemeraClient } from "./client";
import { getTokenManager } from "./token-manager";

export class HemeraConfigurationError extends Error {
	constructor(message: string, readonly details?: Record<string, unknown>) {
		super(message);
		this.name = "HemeraConfigurationError";
	}
}

/**
 * Thrown when both primary and fallback Hemera URLs are unreachable.
 */
export class HemeraUnreachableError extends Error {
	readonly primaryUrl: string;
	readonly fallbackUrl: string;

	constructor(primaryUrl: string, fallbackUrl: string) {
		super(
			`Hemera API unreachable: both primary (${sanitizeUrlForLog(primaryUrl)}) and fallback (${sanitizeUrlForLog(fallbackUrl)}) are down.`,
		);
		this.name = "HemeraUnreachableError";
		this.primaryUrl = primaryUrl;
		this.fallbackUrl = fallbackUrl;
	}
}

export interface CreateHemeraClientOptions {
	requestId?: string;
	route?: string;
	method?: string;
}

// Cache for the working URL (permanent once a healthy connection is established)
let cachedBaseUrl: string | null = null;
// Track whether we've logged the "both unavailable" warning to avoid log spam
let bothUnavailableLogged = false;
const HEALTH_CHECK_PATH = "/api/service/courses";

type ProbeMethod = "HEAD" | "GET";

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
 * 1. If a cached working URL exists, use it (permanent once established)
 * 2. Try the primary URL first (health check via HEAD on a lightweight API endpoint)
 * 3. If primary fails and fallback URL is configured, try fallback
 * 4. Cache the working URL permanently for subsequent requests
 * 5. If BOTH are unreachable, do NOT cache — next request retries both
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
	if (await isReachable(primaryUrl)) {
		console.log(`[Hemera] Primary URL reachable: ${sanitizeUrlForLog(primaryUrl)}`);
		cachedBaseUrl = primaryUrl;
		bothUnavailableLogged = false;
		return primaryUrl;
	}

	// Primary failed — try fallback
	console.log(`[Hemera] Primary unavailable, testing fallback: ${sanitizeUrlForLog(fallbackUrl)}`);
	if (await isReachable(fallbackUrl)) {
		console.log(`[Hemera] Fallback URL reachable: ${sanitizeUrlForLog(fallbackUrl)}`);
		cachedBaseUrl = fallbackUrl;
		bothUnavailableLogged = false;
		return fallbackUrl;
	}

	// Both unreachable — do NOT cache so next request retries
	bothUnavailableLogged = true;
	console.warn(
		`[Hemera] Both primary (${sanitizeUrlForLog(primaryUrl)}) and fallback (${sanitizeUrlForLog(fallbackUrl)}) are unreachable.`,
	);
	throw new HemeraUnreachableError(primaryUrl, fallbackUrl);
}

function buildHealthCheckUrl(baseUrl: string): string {
	return `${baseUrl.replace(/\/+$/, "")}${HEALTH_CHECK_PATH}`;
}

function isMethodNotSupported(status: number): boolean {
	return status === 405 || status === 501;
}

function isRedirectStatus(status: number): boolean {
	return status >= 300 && status < 400;
}

function isHealthyProbeStatus(status: number): boolean {
	if (isRedirectStatus(status)) return false;
	return (status >= 200 && status < 300) || status === 401 || status === 403;
}

async function probeHealthEndpoint(
	healthUrl: string,
	method: ProbeMethod,
	signal: AbortSignal,
): Promise<Response> {
	return fetch(healthUrl, {
		method,
		signal,
		cache: "no-store",
		redirect: "manual",
		headers: { Accept: "application/json" },
	});
}

/**
 * Health-check a Hemera base URL with a 3s timeout.
 * Uses a lightweight authenticated endpoint; 401 means the service is reachable.
 */
async function isReachable(url: string): Promise<boolean> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 3000);
		try {
			const healthUrl = buildHealthCheckUrl(url);
			const headRes = await probeHealthEndpoint(healthUrl, "HEAD", controller.signal);
			if (isHealthyProbeStatus(headRes.status)) {
				return true;
			}

			if (isMethodNotSupported(headRes.status)) {
				const getRes = await probeHealthEndpoint(healthUrl, "GET", controller.signal);
				return isHealthyProbeStatus(getRes.status);
			}

			clearTimeout(timer);
			return false;
		} finally {
			clearTimeout(timer);
		}
	} catch {
		return false;
	}
}

/**
 * Reset the cached base URL (useful for testing or when network changes)
 */
export function resetHemeraBaseUrl(): void {
	cachedBaseUrl = null;
	bothUnavailableLogged = false;
	console.log("[Hemera] Base URL cache cleared");
}

/**
 * Create a configured HemeraClient instance.
 * Uses environment configuration and token manager for authentication.
 * Supports automatic fallback to HEMERA_API_FALLBACK_URL when primary fails.
 *
 * @returns Configured HemeraClient ready for API calls
 */
export async function createHemeraClient(
	options: CreateHemeraClientOptions = {},
): Promise<HemeraClient> {
	const errorContext = {
		requestId: options.requestId,
		route: options.route,
		method: options.method,
	};

	let config: ReturnType<typeof loadConfig>;
	try {
		config = loadConfig();
	} catch (err) {
		const configError = new HemeraConfigurationError(
			"Hemera client configuration is invalid",
			{ cause: err instanceof Error ? err.message : String(err) },
		);
		reportError(configError, {
			...errorContext,
			additionalData: {
				component: "createHemeraClient",
				failureType: "configuration",
				...configError.details,
			},
		});
		throw configError;
	}

	const tokenManager = getTokenManager();
	const fallbackUrl = config.HEMERA_API_FALLBACK_URL;

	// Defensive validation: ensure tokenManager exposes a getToken() function
	if (
		!tokenManager ||
		typeof (tokenManager as unknown as Record<string, unknown>).getToken !== "function"
	) {
		const configError = new HemeraConfigurationError(
			"createHemeraClient error: token manager does not provide `getToken()`.",
			{
				hint: "Ensure getTokenManager() returns `getToken(): Promise<string>` and HEMERA_API_KEY is configured.",
			},
		);
		reportError(configError, {
			...errorContext,
			additionalData: {
				component: "createHemeraClient",
				failureType: "configuration",
				...configError.details,
			},
		});
		throw configError;
	}

	let baseUrl: string;
	try {
		baseUrl = await getBaseUrlWithFallback();
	} catch (err) {
		if (err instanceof HemeraUnreachableError) {
			reportError(
				err,
				{
					...errorContext,
					additionalData: {
						component: "createHemeraClient",
						failureType: "network",
						primaryUrl: sanitizeUrlForLog(err.primaryUrl),
						fallbackUrl: sanitizeUrlForLog(err.fallbackUrl),
					},
				},
				"warning",
			);
			throw err;
		}

		const errorObj = err instanceof Error ? err : new Error(String(err));
		reportError(errorObj, {
			...errorContext,
			additionalData: {
				component: "createHemeraClient",
				failureType: "unknown",
			},
		});
		throw errorObj;
	}

	// If fallback is configured, create a client that can fall back
	if (fallbackUrl) {
		// Create a wrapping fetch function that tries fallback on network errors
		const originalFetch = globalThis.fetch;

		let primaryOrigin: string;
		let fallbackOrigin: string;
		try {
			primaryOrigin = new URL(baseUrl).origin;
		} catch {
			const configError = new HemeraConfigurationError(
				`[Hemera] Invalid baseUrl — cannot parse origin from "${sanitizeUrlForLog(baseUrl)}".`,
				{ hint: "Check HEMERA_API_BASE_URL / HEMERA_API_FALLBACK_URL configuration." },
			);
			reportError(configError, {
				...errorContext,
				additionalData: {
					component: "createHemeraClient",
					failureType: "configuration",
					...configError.details,
				},
			});
			throw configError;
		}
		try {
			fallbackOrigin = new URL(fallbackUrl).origin;
		} catch {
			const configError = new HemeraConfigurationError(
				`[Hemera] Invalid fallbackUrl — cannot parse origin from "${sanitizeUrlForLog(fallbackUrl)}".`,
				{ hint: "Check HEMERA_API_FALLBACK_URL configuration." },
			);
			reportError(configError, {
				...errorContext,
				additionalData: {
					component: "createHemeraClient",
					failureType: "configuration",
					...configError.details,
				},
			});
			throw configError;
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
