// ---------------------------------------------------------------------------
// Hemera API Health Check — verifies connectivity on app startup
// ---------------------------------------------------------------------------

import { loadConfig } from "../config";
import { reportError } from "../monitoring/rollbar-official";

const isProduction = process.env.NODE_ENV === "production";
const HEMERA_HEALTH_PATH = "/api/service/courses";

type ProbeMethod = "HEAD" | "GET";

function isMethodNotSupported(status: number): boolean {
	return status === 405 || status === 501;
}

function isRedirectStatus(status: number): boolean {
	return status >= 300 && status < 400;
}

function isReachableStatus(status: number): boolean {
	if (isRedirectStatus(status)) return false;
	return (status >= 200 && status < 300) || status === 401 || status === 403;
}

function isLoopbackHostname(hostname: string): boolean {
	const normalized = hostname.toLowerCase();
	return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function candidatePriority(url: string): number {
	try {
		const hostname = new URL(url).hostname;
		if (isLoopbackHostname(hostname)) return 0;
		if (hostname.toLowerCase() === "host.docker.internal") return 1;
		return 2;
	} catch {
		return 3;
	}
}

function orderedCandidates(primaryUrl: string, fallbackUrl?: string): string[] {
	const allCandidates = fallbackUrl ? [primaryUrl, fallbackUrl] : [primaryUrl];
	const uniqueCandidates = Array.from(new Set(allCandidates));
	return uniqueCandidates.sort((a, b) => candidatePriority(a) - candidatePriority(b));
}

async function probe(url: string, method: ProbeMethod, signal: AbortSignal): Promise<Response> {
	return fetch(url, {
		method,
		signal,
		cache: "no-store",
		redirect: "manual",
		headers: { Accept: "application/json" },
	});
}

/**
 * Check if the Hemera API is reachable by sending a lightweight HEAD request.
 * Logs a warning in dev mode; reports to Rollbar in production.
 */
export async function checkHemeraHealth(): Promise<boolean> {
	let candidates: string[];
	try {
		const config = loadConfig();
		candidates = orderedCandidates(config.HEMERA_API_BASE_URL, config.HEMERA_API_FALLBACK_URL);
	} catch {
		const msg = "Hemera health check skipped: configuration not available";
		console.warn(`⚠ ${msg}`);
		return false;
	}

	for (const baseUrl of candidates) {
		const url = `${baseUrl.replace(/\/+$/, "")}${HEMERA_HEALTH_PATH}`;

		try {
			const signal = AbortSignal.timeout(5000);
			const headRes = await probe(url, "HEAD", signal);

			if (isReachableStatus(headRes.status)) {
				console.log(`✓ Hemera API reachable at ${baseUrl}`);
				return true;
			}

			if (isMethodNotSupported(headRes.status)) {
				const getRes = await probe(url, "GET", signal);
				if (isReachableStatus(getRes.status)) {
					console.log(`✓ Hemera API reachable at ${baseUrl} (GET fallback)`);
					return true;
				}
			}
		} catch {
			// Try next candidate URL
		}
	}

	handleFailure("Hemera API is unreachable for all configured URLs");
	return false;
}

function handleFailure(message: string): void {
	console.error(`✗ ${message}`);

	if (isProduction) {
		reportError(new Error(message), undefined, "warning");
	}
}
