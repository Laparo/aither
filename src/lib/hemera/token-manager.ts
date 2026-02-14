// ---------------------------------------------------------------------------
// Hemera Service Token Manager
// Manages authentication tokens for service-to-service communication
// ---------------------------------------------------------------------------

/**
 * Simple token provider that returns a static service token.
 * For Clerk-based authentication, provide a durable service credential
 * (generated via Clerk Backend API or an organisation/service-token mechanism).
 *
 * In production, this could be enhanced to:
 * - Fetch tokens from Clerk backend API
 * - Cache tokens with expiry
 * - Auto-refresh before expiry
 *
 * For now, we use a simple approach where the service token
 * is provided via environment variable and represents a long-lived
 * service credential suitable for unattended service-to-service auth.
 */
export class HemeraTokenManager {
	private readonly serviceToken: string;

	/**
	 * @param serviceToken - Long-lived service credential for the service user
	 */
	constructor(serviceToken: string) {
		if (!serviceToken) {
			throw new Error("Service token is required");
		}
		this.serviceToken = serviceToken;
	}

	/**
	 * Get the service token for API authentication.
	 * Returns the configured service token.
	 */
	async getToken(): Promise<string> {
		return this.serviceToken;
	}
}

/**
 * Singleton instance of the token manager.
 * Initialized with service token from environment.
 */
let tokenManagerInstance: HemeraTokenManager | null = null;

/**
 * Get the singleton token manager instance.
 * Requires HEMERA_SERVICE_TOKEN environment variable.
 *
 * The service token should be a durable service credential for
 * the aither-service@hemera-academy.com user with `api-client` role.
 *
 * Recommended generation/rotation flow:
 * 1. Create a service user or service credential via Clerk Backend API
 *    (or use an organisation-level service token mechanism)
 * 2. Store the credential in a secret manager (Vercel/AWS/GCP)
 * 3. Rotate periodically and update deployment secrets
 * 4. Set `HEMERA_SERVICE_TOKEN` in your deployment environment
 */
export function getTokenManager(): HemeraTokenManager {
	if (!tokenManagerInstance) {
		const serviceToken = process.env.HEMERA_SERVICE_TOKEN;
		if (!serviceToken) {
			throw new Error(
				"HEMERA_SERVICE_TOKEN environment variable is required for Hemera API authentication",
			);
		}
		tokenManagerInstance = new HemeraTokenManager(serviceToken);
	}
	return tokenManagerInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetTokenManager(): void {
	tokenManagerInstance = null;
}
