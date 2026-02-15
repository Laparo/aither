// ---------------------------------------------------------------------------
// Service Token Management for Hemera API
// Handles service authentication token for service-to-service communication
// ---------------------------------------------------------------------------

import { clerkClient } from "@clerk/nextjs/server";
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
 * Uses Clerk's sign-in token approach to mint short-lived JWTs for service-to-service
 * authentication. This avoids creating persistent sessions and follows least-privilege
 * principles. The token is generated using a JWT template configured in Clerk.
 *
 * The JWT template should be named 'hemera-api' and configured in the Clerk Dashboard.
 */
async function generateServiceToken(): Promise<string> {
	try {
		// Get the service user ID from environment
		const serviceUserId = process.env.CLERK_SERVICE_USER_ID;
		if (!serviceUserId) {
			throw new Error('CLERK_SERVICE_USER_ID is not set in environment variables');
		}

		// Mint a short-lived JWT using Clerk's sign-in token mechanism
		// This creates a token that can be used to authenticate as the service user
		const client = await clerkClient();
		const signInToken = await client.signInTokens.createSignInToken({
			userId: serviceUserId,
			expiresInSeconds: 15 * 60, // 15 minutes
		});

		if (!signInToken?.token) {
			throw new Error('Failed to mint JWT: no token returned from Clerk');
		}

		return signInToken.token;
	} catch (error) {
		// Redact sensitive details from error logs
		const safeMessage =
			error instanceof Error ? error.message : "Unknown error";
		console.error(
			`[service-token] Failed to mint service JWT from Clerk: ${safeMessage}`,
		);
		throw new Error(
			"Service token generation failed. Check Clerk configuration and CLERK_SERVICE_USER_ID.",
		);
	}
}

/**
 * Clear the token cache (useful for testing or forced refresh).
 */
export function clearTokenCache(): void {
	tokenCache.clear();
}
