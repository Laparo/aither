// ---------------------------------------------------------------------------
// Hemera API Health Check — verifies connectivity on app startup
// ---------------------------------------------------------------------------

import { loadConfig } from "../config";
import { reportError } from "../monitoring/rollbar-official";

const isProduction = process.env.NODE_ENV === "production";

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

	const url = `${baseUrl.replace(/\/+$/, "")}/api/service/courses`;

	try {
		const res = await fetch(url, {
			method: "HEAD",
			signal: AbortSignal.timeout(5000),
			headers: { Accept: "application/json" },
		});

		// 401 means the API is reachable (auth just isn't provided here)
		if (res.ok || res.status === 401) {
			console.log(`✓ Hemera API reachable at ${baseUrl}`);
			return true;
		}

		const msg = `Hemera API responded with ${res.status} (${res.statusText}) at ${url}`;
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
