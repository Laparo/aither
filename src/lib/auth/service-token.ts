// ---------------------------------------------------------------------------
// Service Token Management for Hemera API
// Handles service authentication token for service-to-service communication
// ---------------------------------------------------------------------------

import { clerkClient } from "@clerk/nextjs/server";
import { loadConfig } from "../config";
import type { TokenValue } from "./token-store";
import { tokenStore } from "./token-store";

// In-flight promise deduplication map to prevent parallel token mint calls
const pendingTokenPromises = new Map<string, Promise<string>>();

/**
 * Validate that a token is non-empty and structurally valid.
 * Throws a descriptive error if the token is invalid.
 */
async function validateToken(token: string, source: "cache" | "generated"): Promise<void> {
	if (!token || typeof token !== "string" || token.trim().length === 0) {
		// Clear cache to prevent returning stale invalid tokens
		try {
			await tokenStore.delete("hemera-service-token");
		} catch (delErr) {
			console.error("validateToken: failed to delete cached token", delErr);
		}
		throw new Error(
			`Service token validation failed (source: ${source}): token is empty or invalid. Check CLERK_SECRET_KEY configuration.`,
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

	// Try token store first
	const cached = (await tokenStore.get(cacheKey)) as TokenValue | null;
	if (cached && cached.expiresAt > Date.now() + 120000) {
		await validateToken(cached.token, "cache");
		return cached.token;
	}

	// If another call is already in-flight, wait for it instead of issuing a new request
	const pending = pendingTokenPromises.get(cacheKey);
	if (pending) {
		return await pending;
	}

	const promise = (async () => {
		// Prefer a pre-provisioned service credential from env/secrets
		const envToken =
			process.env.CLERK_SERVICE_USER_API_KEY || process.env.CLERK_SERVICE_USER_SIGNIN_TOKEN;
		if (envToken && typeof envToken === "string" && envToken.trim().length > 0) {
			// Validate before caching to avoid storing invalid tokens
			await validateToken(envToken, "generated");
			const expiresAt = Date.now() + 15 * 60 * 1000;
			await tokenStore.set(cacheKey, { token: envToken, expiresAt });
			return envToken;
		}

		// Load config — fail fast with clear message if env vars are missing
		try {
			loadConfig();
		} catch (_error) {
			throw new Error(
				"Service token generation failed: environment configuration is invalid. Ensure CLERK_SECRET_KEY is set.",
			);
		}

		// Use backoff-retry when minting a token to handle transient failures
		const token = await refreshTokenWithBackoff(3, 200);

		// Validate before caching
		await validateToken(token, "generated");

		// Cache with 15-minute expiration (store uses numeric epoch ms)
		await tokenStore.set(cacheKey, { token, expiresAt: Date.now() + 15 * 60 * 1000 });

		return token;
	})();

	pendingTokenPromises.set(cacheKey, promise);
	try {
		return await promise;
	} finally {
		pendingTokenPromises.delete(cacheKey);
	}
}

/**
 * Generate a service token for Hemera API authentication.
 *
 * Uses Clerk's sign-in token mechanism (`signInTokens.createSignInToken()`) to mint
 * short-lived JWTs for service-to-service authentication. This avoids creating
 * persistent sessions and follows least-privilege principles. No JWT template is
 * required by this implementation. If you prefer a Clerk JWT template workflow,
 * replace the implementation here with the template-specific API call.
 */
async function generateServiceToken(): Promise<string> {
	try {
		// Get the service user ID from environment
		const serviceUserId = process.env.CLERK_SERVICE_USER_ID;
		if (!serviceUserId) {
			throw new Error("CLERK_SERVICE_USER_ID is not set in environment variables");
		}

		// Mint a short-lived JWT using Clerk's sign-in token mechanism
		// This creates a token that can be used to authenticate as the service user
		// clerkClient may be exported either as a function (factory) or as an object.
		const client =
			typeof clerkClient === "function"
				? await (clerkClient as unknown as () => Promise<typeof clerkClient>)()
				: clerkClient;
		const signInToken = await (
			client as unknown as {
				signInTokens: {
					createSignInToken: (opts: {
						userId: string;
						expiresInSeconds: number;
					}) => Promise<{
						token?: string;
					}>;
				};
			}
		).signInTokens.createSignInToken({
			userId: serviceUserId,
			expiresInSeconds: 15 * 60, // 15 minutes
		});

		if (!signInToken?.token) {
			throw new Error("Failed to mint JWT: no token returned from Clerk");
		}

		return signInToken.token;
	} catch (error) {
		// Redact sensitive details from error logs
		const safeMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`[service-token] Failed to mint service JWT from Clerk: ${safeMessage}`);
		throw new Error(
			"Service token generation failed. Check Clerk configuration and CLERK_SERVICE_USER_ID.",
		);
	}
}

/**
 * Retry wrapper with exponential backoff for token generation.
 * Retries `generateServiceToken()` up to `maxRetries` times with jittered exponential backoff.
 */
async function refreshTokenWithBackoff(maxRetries = 3, initialDelayMs = 200): Promise<string> {
	let attempt = 0;
	while (true) {
		try {
			return await generateServiceToken();
		} catch (err) {
			attempt++;
			if (attempt > maxRetries) {
				throw err;
			}
			const backoff = initialDelayMs * 2 ** (attempt - 1);
			const jitter = Math.floor(Math.random() * 100);
			const delay = backoff + jitter;
			await new Promise((res) => setTimeout(res, delay));
		}
	}
}

/**
 * Clear the token cache (useful for testing or forced refresh).
 */
export async function clearTokenCache(): Promise<void> {
	try {
		await tokenStore.clear();
	} catch (err) {
		console.error("clearTokenCache: failed to clear token store", err);
		throw err;
	}
}
