// ---------------------------------------------------------------------------
// Hemera Service Token Manager
// Manages API key for service-to-service communication
// ---------------------------------------------------------------------------

/**
 * Simple token provider that returns a static API key.
 * The API key authenticates aither as a service client against hemera's
 * service API endpoints via the X-API-Key header.
 *
 * The API key is validated server-side by hemera and maps to a
 * specific service user with the `api-client` role.
 */
export class HemeraTokenManager {
	private readonly apiKey: string;

	/**
	 * @param apiKey - API key for hemera service authentication
	 */
	constructor(apiKey: string) {
		if (!apiKey) {
			throw new Error("API key is required");
		}
		this.apiKey = apiKey;
	}

	/**
	 * Get the API key for service authentication.
	 */
	async getToken(): Promise<string> {
		return this.apiKey;
	}
}

/**
 * Singleton instance of the token manager.
 * Initialized with API key from environment.
 */
let tokenManagerInstance: HemeraTokenManager | null = null;

/**
 * Get the singleton token manager instance.
 * Requires HEMERA_API_KEY environment variable.
 *
 * The API key authenticates the aither service user
 * (aither-service@hemera-academy.com) with `api-client` role
 * against hemera's service API.
 *
 * Key management:
 * 1. API key is generated and shared between hemera and aither
 * 2. hemera validates via HEMERA_SERVICE_API_KEY env var
 * 3. Set HEMERA_API_KEY in aither's deployment environment
 * 4. Rotate by generating a new key and updating both sides
 */
export function getTokenManager(): HemeraTokenManager {
	if (!tokenManagerInstance) {
		const apiKey = process.env.HEMERA_API_KEY;
		if (!apiKey) {
			throw new Error(
				"HEMERA_API_KEY environment variable is required for Hemera API authentication",
			);
		}
		tokenManagerInstance = new HemeraTokenManager(apiKey);
	}
	return tokenManagerInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetTokenManager(): void {
	tokenManagerInstance = null;
}
