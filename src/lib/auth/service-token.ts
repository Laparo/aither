// ---------------------------------------------------------------------------
// Service Token Management for Hemera API
// Handles JWT token caching and refresh for service-to-service communication
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
function validateToken(token: string, source: "cache" | "clerk"): void {
	if (!token || typeof token !== "string" || token.trim().length === 0) {
		// Clear cache to prevent returning stale invalid tokens
		tokenCache.delete("hemera-service-token");
		throw new Error(
			`Service token validation failed (source: ${source}): token is empty or invalid. ` +
				"Check CLERK_SERVICE_USER_ID and CLERK_SECRET_KEY configuration.",
		);
	}
}

/**
 * Get a valid service token for Hemera API access.
 * Automatically handles caching and refresh.
 *
 * @throws {Error} If config is missing, token generation fails, or token is invalid.
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
				"Ensure CLERK_SERVICE_USER_ID and CLERK_SECRET_KEY are set.",
		);
	}

	if (!config.CLERK_SERVICE_USER_ID || config.CLERK_SERVICE_USER_ID.trim().length === 0) {
		throw new Error(
			"Service token generation failed: CLERK_SERVICE_USER_ID is missing or empty. " +
				"Set it in .env or environment variables.",
		);
	}

	const token = await obtainTokenFromClerk(config.CLERK_SERVICE_USER_ID);

	// Validate before caching
	validateToken(token, "clerk");

	// Cache with 15-minute expiration
	tokenCache.set(cacheKey, {
		value: token,
		expiresAt: new Date(Date.now() + 15 * 60 * 1000),
	});

	return token;
}

/**
 * Obtain a JWT token from Clerk for the service user.
 * Logs are redacted to prevent leaking credentials.
 */
async function obtainTokenFromClerk(userId: string): Promise<string> {
	try {
		// Get Clerk client instance
		const clerk = await clerkClient();

		// Verify the service user exists in Clerk
		const user = await clerk.users.getUser(userId);
		if (!user) {
			throw new Error(
				`Service user not found in Clerk (userId: ${redact(userId)}). ` +
					"Verify CLERK_SERVICE_USER_ID points to a valid Clerk user.",
			);
		}

		// For service-to-service authentication in Clerk v6+, we need to use the Backend API
		// to create a session token. The SessionAPI in v6+ doesn't have a create method,
		// so we use the Backend API directly via fetch.
		
		// Get the Clerk secret key from environment
		const secretKey = process.env.CLERK_SECRET_KEY;
		if (!secretKey) {
			throw new Error('CLERK_SECRET_KEY is not set in environment variables');
		}

		// Create a session using Clerk's Backend API
		const response = await fetch('https://api.clerk.com/v1/sessions', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${secretKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				user_id: user.id,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Failed to create session via Clerk API (status ${response.status}): ${errorText}`
			);
		}

		const sessionData = await response.json();
		if (!sessionData?.id) {
			throw new Error('Session creation succeeded but no session ID was returned');
		}

		// Get the session token using the session ID
		const tokenResponse = await fetch(
			`https://api.clerk.com/v1/sessions/${sessionData.id}/tokens/hemera-api`,
			{
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${secretKey}`,
					'Content-Type': 'application/json',
				},
			}
		);

		if (!tokenResponse.ok) {
			const errorText = await tokenResponse.text();
			throw new Error(
				`Failed to get session token via Clerk API (status ${tokenResponse.status}): ${errorText}`
			);
		}

		const tokenData = await tokenResponse.json();
		const jwt = tokenData?.jwt;
		
		if (!jwt || typeof jwt !== 'string') {
			throw new Error('Failed to extract JWT from Clerk API response');
		}

		return jwt;
	} catch (error) {
		// Redact sensitive details from error logs
		const safeMessage =
			error instanceof Error ? error.message : "Unknown error";
		console.error(
			`[service-token] Failed to obtain token for userId=${redact(userId)}: ${safeMessage}`,
		);
		throw new Error(
			`Service token generation failed for userId=${redact(userId)}. ` +
				"Check Clerk configuration and service user setup.",
		);
	}
}

/**
 * Clear the token cache (useful for testing or forced refresh).
 */
export function clearTokenCache(): void {
	tokenCache.clear();
}
