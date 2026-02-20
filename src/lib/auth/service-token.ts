// ---------------------------------------------------------------------------
// Service Token Management for Hemera API
// Manages API key caching for service-to-service communication
// ---------------------------------------------------------------------------
//
// Usage:
//   import { getServiceToken, setTokenStore } from '@/lib/auth/service-token';
//
//   // Optional: swap in a persistent store (default: InMemoryTokenStore)
//   setTokenStore(new MyRedisTokenStore());
//
//   // Get the API key (cached)
//   const token = await getServiceToken();
// ---------------------------------------------------------------------------

import { loadConfig } from "../config";
import { InMemoryTokenStore, type TokenStore } from "./token-store";

const CACHE_KEY = "hemera-service-token";

/** API keys don't expire — use a long TTL (24h) for the cache entry. */
const API_KEY_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Token store (pluggable)
// ---------------------------------------------------------------------------

let _store: TokenStore = new InMemoryTokenStore();

/** In-flight fetch promise to deduplicate concurrent cache misses. */
let _pendingFetch: Promise<string> | null = null;

/**
 * Replace the token store implementation.
 * Call this early in your app bootstrap (e.g., instrumentation.ts) to use
 * a persistent store like Upstash Redis or Vercel KV in production.
 *
 * @see docs/token-store.md for adapter examples
 */
export function setTokenStore(store: TokenStore): void {
	_store = store;
}

/** Visible for testing — returns the active store. */
export function getTokenStore(): TokenStore {
	return _store;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the service API key for Hemera API access.
 *
 * Strategy:
 * 1. Return a cached key if available.
 * 2. Otherwise load HEMERA_API_KEY from config, cache it, and return it.
 *
 * The API key is validated server-side by hemera and maps to the
 * aither service user with `api-client` role.
 */
export async function getServiceToken(): Promise<string> {
	// 1. Check cache
	const cached = await _store.get(CACHE_KEY);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.token;
	}

	// 2. Deduplicate concurrent cache misses — only the first caller fetches
	if (_pendingFetch) {
		return _pendingFetch;
	}

	_pendingFetch = (async () => {
		try {
			const apiKey = obtainToken();
			const expiresAt = Date.now() + API_KEY_TTL_MS;
			await _store.set(CACHE_KEY, { token: apiKey, expiresAt });
			return apiKey;
		} finally {
			_pendingFetch = null;
		}
	})();

	return _pendingFetch;
}

/**
 * Force-clear the cached service token.
 * Useful after credential rotation or in test teardown.
 */
export async function clearServiceToken(): Promise<void> {
	await _store.delete(CACHE_KEY);
}

/**
 * @deprecated Use `clearServiceToken()` instead. Kept for backward compatibility.
 */
export async function clearTokenCache(): Promise<void> {
	await clearServiceToken();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Load the API key from environment config.
 */
function obtainToken(): string {
	const config = loadConfig();
	const apiKey = config.HEMERA_API_KEY;

	if (!apiKey) {
		throw new Error(
			"HEMERA_API_KEY is not configured. " +
				"Set it in .env.local with the shared API key for hemera service authentication.",
		);
	}

	return apiKey;
}
