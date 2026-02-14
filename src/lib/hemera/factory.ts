// ---------------------------------------------------------------------------
// Hemera Client Factory
// Creates configured HemeraClient instances with token management
// ---------------------------------------------------------------------------

import { loadConfig } from "../config";
import { HemeraClient } from "./client";
import { getTokenManager } from "./token-manager";

/**
 * Create a configured HemeraClient instance.
 * Uses environment configuration and token manager for authentication.
 *
 * @returns Configured HemeraClient ready for API calls
 */
export function createHemeraClient(): HemeraClient {
	const config = loadConfig();
	const tokenManager = getTokenManager();

	// Defensive validation: ensure tokenManager exposes a getToken() function
	if (!tokenManager || typeof (tokenManager as { getToken?: unknown }).getToken !== "function") {
		throw new Error(
			"createHemeraClient error: token manager does not provide `getToken()`.\n" +
				"Ensure getTokenManager() returns an object with `getToken(): Promise<string>` and that HEMERA_SERVICE_TOKEN is configured.",
		);
	}

	return new HemeraClient({
		baseUrl: config.HEMERA_API_BASE_URL,
		getToken: () => tokenManager.getToken(),
		rateLimit: 2, // 2 requests per second
		maxRetries: 5,
	});
}
