// ---------------------------------------------------------------------------
// Service Token Management for Hemera API
// Handles service authentication token for service-to-service communication
// ---------------------------------------------------------------------------

import { loadConfig } from "../config";

interface CachedToken {
	value: string;
	expiresAt: Date;
}

// In-memory token cache (use Redis/Vercel KV for horizontal scaling)
const tokenCache = new Map<string, CachedToken>();

/**
 * Redact sensitive values for safe logging.
 * Shows first 4 chars + "…" for strings longer than 8 chars, otherwise "***".
 */
function redact(value: unknown): string {
	if (typeof value !== "string" || value.length === 0) return "***";
	if (value.length <= 8) return "***";
	return `${value.slice(0, 4)}…[redacted]`;
}

/**
 * Validate that a token is non-empty and structurally valid.
 * Throws a descriptive error if the token is invalid.
 */
function validateToken(token: string, source: "cache" | "generated"): void {
	if (!token || typeof token !== "string" || token.trim().length === 0) {
		// Clear cache to prevent returning stale invalid tokens
		tokenCache.delete("hemera-service-token");
		throw new Error(
			`Service token validation failed (source: ${source}): token is empty or invalid. ` +
				"Check CLERK_SECRET_KEY configuration.",
		);
	}
}

/**
 * Get a valid service token for Hemera API access.
 * For service-to-service authentication, we use the Clerk secret key directly.
 * This is the recommended approach for backend M2M (machine-to-machine) communication.
 *
 * @throws {Error} If config is missing or token generation fails.
 */
export async function getServiceToken(): Promise<string> {
	const cacheKey = "hemera-service-token";
	const cached = tokenCache.get(cacheKey);

	// Return cached token if still valid (with 2-minute buffer)
	if (cached && cached.expiresAt > new Date(Date.now() + 120000)) {
		validateToken(cached.value, "cache");
		return cached.value;
	}

	// Load config — fail fast with clear message if env vars are missing
	let config: ReturnType<typeof loadConfig>;
	try {
		config = loadConfig();
	} catch (error) {
		throw new Error(
			"Service token generation failed: environment configuration is invalid. " +
				"Ensure CLERK_SECRET_KEY is set.",
		);
	}

	const token = await generateServiceToken();

	// Validate before caching
	validateToken(token, "generated");

	// Cache with 15-minute expiration
	tokenCache.set(cacheKey, {
		value: token,
		expiresAt: new Date(Date.now() + 15 * 60 * 1000),
	});

	return token;
}

/**
 * Generate a service token for Hemera API authentication.
 * 
 * For service-to-service (M2M) authentication, we use the Clerk secret key directly
 * as the bearer token. This is the recommended approach for backend services and avoids
 * creating unnecessary user sessions.
 * 
 * The Clerk secret key has the format: sk_test_... or sk_live_...
 * This key should be used as: Authorization: Bearer <secret_key>
 */
async function generateServiceToken(): Promise<string> {
	try {
		// Get the Clerk secret key from environment
		const secretKey = process.env.CLERK_SECRET_KEY;
		if (!secretKey) {
			throw new Error('CLERK_SECRET_KEY is not set in environment variables');
		}

		// Validate the secret key format
		if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
			throw new Error(
				`Invalid CLERK_SECRET_KEY format. Expected format: sk_test_... or sk_live_..., ` +
				`got: ${redact(secretKey)}`
			);
		}

		// For service-to-service authentication, the Clerk secret key IS the token
		// No need to create sessions or call additional APIs
		return secretKey;
	} catch (error) {
		// Redact sensitive details from error logs
		const safeMessage =
			error instanceof Error ? error.message : "Unknown error";
		console.error(
			`[service-token] Failed to generate service token: ${safeMessage}`,
		);
		throw new Error(
			"Service token generation failed. Check Clerk configuration and CLERK_SECRET_KEY.",
		);
	}
}

/**
 * Clear the token cache (useful for testing or forced refresh).
 */
export function clearTokenCache(): void {
	tokenCache.clear();
}
