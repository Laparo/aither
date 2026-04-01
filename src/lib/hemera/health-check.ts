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
	let baseUrl: string;
	try {
		const config = loadConfig();
		baseUrl = config.HEMERA_API_BASE_URL;
	} catch {
		const msg = "Hemera health check skipped: configuration not available";
		console.warn(`⚠ ${msg}`);
		return false;
	}

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

			const msg = `Hemera API responded with ${getRes.status} (${getRes.statusText}) at ${url} (GET fallback)`;
			handleFailure(msg);
			return false;
		}

		const msg = `Hemera API responded with ${headRes.status} (${headRes.statusText}) at ${url}`;
		handleFailure(msg);
		return false;
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		const msg = `Hemera API unreachable at ${baseUrl}: ${reason}`;
		handleFailure(msg);
		return false;
	}
}

function handleFailure(message: string): void {
	console.error(`✗ ${message}`);

	if (isProduction) {
		reportError(new Error(message), undefined, "warning");
	}
}
