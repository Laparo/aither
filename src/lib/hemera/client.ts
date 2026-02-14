// ---------------------------------------------------------------------------
// Hemera Academy API — HTTP Client
// Task: T013 — Auth, throttling (p-throttle 2 req/s), retry (p-retry)
// Updated: Clerk JWT-based authentication for service-to-service communication
// ---------------------------------------------------------------------------

import pRetry, { AbortError } from "p-retry";
import pThrottle from "p-throttle";
import type { z } from "zod";

export interface HemeraClientOptions {
	baseUrl: string;
	/** Function to retrieve a valid JWT token (Clerk service token) */
	getToken: () => Promise<string>;
	/** Allowed API path prefix (defaults to '/api/service/') */
	allowedPathPrefix?: string;
	/** Allowed JWT audiences (optional) */
	allowedAudiences?: string[];
	/** Required role claim for the token (optional, defaults to 'api-client') */
	requiredRole?: string;
	/** Requests per second (default: 2) */
	rateLimit?: number;
	/** Max retries on failure (default: 5) */
	maxRetries?: number;
	/** Custom fetch implementation (for testing) */
	fetchFn?: typeof fetch;
}

export class HemeraApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly statusText: string,
		public readonly body: string,
		public readonly url: string,
	) {
		super(`Hemera API error ${status} (${statusText}) for ${url}`);
		this.name = "HemeraApiError";
	}
}

export class HemeraTokenError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "HemeraTokenError";
	}
}

/**
 * HTTP client for the hemera.academy REST API.
 *
 * Features:
 * - API key authentication via Authorization header
 * - Rate limiting via p-throttle (default: 2 req/s)
 * - Automatic retry on 5xx/network errors via p-retry (default: 5 attempts, jitter)
 * - Retry-After header support for 429 responses
 * - Zod validation of every response
 */
export class HemeraClient {
	private readonly baseUrl: string;
	private readonly getToken: () => Promise<string>;
	private readonly allowedPathPrefix: string;
	private readonly allowedAudiences?: string[];
	private readonly requiredRole?: string;
	private readonly maxRetries: number;
	private readonly fetchFn: typeof fetch;
	private readonly throttledFetch: typeof fetch;

	/** Cached decoded JWT payload to avoid repeated base64 parsing */
	private cachedPayload: { token: string; payload: Record<string, unknown>; expiresAt: number } | null = null;
	/** TTL for the cached payload in milliseconds (default: 30s) */
	private static readonly PAYLOAD_CACHE_TTL_MS = 30_000;

	constructor(options: HemeraClientOptions) {
		this.baseUrl = options.baseUrl.replace(/\/+$/, "");
		if (!options.getToken || typeof options.getToken !== "function") {
			throw new Error(
				"HemeraClient construction error: a valid `getToken()` function is required in options.\n" +
				"Provide `getToken: () => Promise<string>` (e.g. from `getTokenManager().getToken`) or use `createHemeraClient()` which wires the token manager.\n" +
				"Ensure HEMERA_SERVICE_TOKEN is set for the token manager when using the default factory."
			);
		}
		this.getToken = options.getToken;
		this.maxRetries = options.maxRetries ?? 5;
		this.fetchFn = options.fetchFn ?? globalThis.fetch;
		this.allowedPathPrefix = options.allowedPathPrefix ?? "/api/service/";
		this.allowedAudiences = options.allowedAudiences;
		this.requiredRole = "requiredRole" in options ? options.requiredRole : "api-client";

		const throttle = pThrottle({
			limit: options.rateLimit ?? 2,
			interval: 1000,
		});

		this.throttledFetch = throttle((input: string | URL | Request, init?: RequestInit) =>
			this.fetchFn(input, init),
		) as typeof fetch;
	}

	/**
	 * Fetches a resource from the Hemera API and validates it with Zod.
	 * Retries on 5xx and network errors. Respects 429 Retry-After.
	 * Uses Clerk JWT token for authentication.
	 *
	 * @param path   API endpoint (e.g., "/api/service/courses")
	 * @param schema Zod schema for validation
	 * @returns      Validated result
	 */
	async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
		await this.ensurePathAllowed(path);
		const url = `${this.baseUrl}${path}`;

		const response = await pRetry(
			async () => {
				const token = await this.getToken();
				this.validateToken(token);
				const res = await this.throttledFetch(url, {
					method: "GET",
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: "application/json",
					},
				});

				if (res.status === 429) {
					const retryAfter = res.headers.get("Retry-After");
					const delayMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 5000;
					await this.delay(delayMs);
					throw new HemeraApiError(res.status, res.statusText, "", url);
				}

				// Auth failures: abort immediately — no retry, token is invalid or lacks permissions
				if (res.status === 401 || res.status === 403) {
					const responseBody = await res.text();
					throw new AbortError(
						new HemeraApiError(res.status, res.statusText, responseBody, url),
					);
				}

				if (res.status >= 500) {
					const responseBody = await res.text();
					throw new HemeraApiError(res.status, res.statusText, responseBody, url);
				}

				if (!res.ok) {
					const responseBody = await res.text();
					throw new AbortError(new HemeraApiError(res.status, res.statusText, responseBody, url));
				}

				return res;
			},
			{
				retries: this.maxRetries,
				minTimeout: 1000,
				factor: 2,
				randomize: true,
			},
		);

		const json = await response.json();
		return schema.parse(json);
	}

	/**
	 * PUT a resource to the Hemera API and validate the response against a Zod schema.
	 * Uses Clerk JWT token for authentication.
	 */
	async put<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T>;
	async put(path: string, body: unknown): Promise<unknown>;
	async put<T = unknown>(path: string, body: unknown, schema?: z.ZodType<T>): Promise<T | unknown> {
		await this.ensurePathAllowed(path);
		const url = `${this.baseUrl}${path}`;

		const response = await pRetry(
			async () => {
				const token = await this.getToken();
				this.validateToken(token);
				const res = await this.throttledFetch(url, {
					method: "PUT",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					body: JSON.stringify(body),
				});

				if (res.status === 429) {
					const retryAfter = res.headers.get("Retry-After");
					const delayMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 5000;
					await this.delay(delayMs);
					throw new HemeraApiError(res.status, res.statusText, "", url);
				}

				// Auth failures: abort immediately — no retry, token is invalid or lacks permissions
				if (res.status === 401 || res.status === 403) {
					const responseBody = await res.text();
					throw new AbortError(
						new HemeraApiError(res.status, res.statusText, responseBody, url),
					);
				}

				if (res.status >= 500) {
					const responseBody = await res.text();
					throw new HemeraApiError(res.status, res.statusText, responseBody, url);
				}

				if (!res.ok) {
					const responseBody = await res.text();
					throw new AbortError(new HemeraApiError(res.status, res.statusText, responseBody, url));
				}

				return res;
			},
			{
				retries: this.maxRetries,
				minTimeout: 1000,
				factor: 2,
				randomize: true,
			},
		);

		const json = await response.json();
		if (schema) {
			return schema.parse(json);
		}
		return json;
	}

	/**
	 * Validates that a token is present and has a valid JWT structure.
	 * Throws HemeraTokenError if validation fails.
	 *
	 * @param token The JWT token to validate
	 * @throws {HemeraTokenError} If token is empty or malformed
	 */
	private validateToken(token: string): void {
		// Check if token is empty or only whitespace
		if (!token || token.trim().length === 0) {
			throw new HemeraTokenError(
				"Token validation failed: getToken() returned an empty token. " +
				"Ensure HEMERA_SERVICE_TOKEN is properly configured and the token manager is initialized."
			);
		}

		// Check basic JWT structure (3 parts separated by dots)
		const parts = token.split('.');
		if (parts.length !== 3) {
			throw new HemeraTokenError(
				`Token validation failed: malformed JWT structure (expected 3 parts, got ${parts.length}). The token must be a valid JWT with header, payload, and signature.`
			);
		}

		// Check that each part is non-empty
		if (parts.some(part => part.length === 0)) {
			throw new HemeraTokenError(
				"Token validation failed: JWT contains empty segments. All three parts (header, payload, signature) must be non-empty."
			);
		}

		// Validate base64url encoding of header and payload
		try {
			for (let i = 0; i < 2; i++) {
				const part = parts[i];
				// Base64url uses - and _ instead of + and /
				if (!/^[A-Za-z0-9_-]+$/.test(part)) {
					throw new Error(`Invalid base64url encoding in part ${i + 1}`);
				}
			}
		} catch (_err) {
			throw new HemeraTokenError(
				`Token validation failed: invalid base64url encoding. ${_err instanceof Error ? _err.message : String(_err)}`
			);
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Normalize a URL path to prevent path traversal attacks.
	 * Collapses multiple slashes, resolves `.` and `..` segments,
	 * and ensures a single leading slash.
	 */
	private normalizePath(path: string): string {
		// Collapse multiple slashes into one (preserve leading/trailing behavior)
		const collapsed = path.replace(/\/+/g, '/');
		// Split on raw '/' first — do NOT decode encoded '/' (%2F) so splitting
		// remains stable. Decode each segment individually in a safe way.
		const rawSegments = collapsed.split('/');
		const decodedSegments: string[] = [];
		for (const seg of rawSegments) {
			if (seg === '' || seg === '.') continue;
			// Prevent decoded '%2F' from becoming a path separator: escape it first
			const safeSeg = seg.replace(/%2F/gi, '%252F');
			let decoded: string;
			try {
				decoded = decodeURIComponent(safeSeg);
			} catch (_err) {
				// Treat invalid percent-encodings as invalid input
				throw new Error("Invalid percent-encoding in path");
			}
			if (decoded === '..') {
				// Pop last valid segment if present
				if (decodedSegments.length > 0) decodedSegments.pop();
				continue;
			}
			decodedSegments.push(decoded);
		}
		return `/${decodedSegments.join('/')}`;
	}

	/**
	 * Ensure the requested path is within the allowed prefix and token has required claims
	 */
	private async ensurePathAllowed(path: string) {
		const normalized = this.normalizePath(path);
		if (!normalized.startsWith(this.allowedPathPrefix)) {
			throw new Error(`HemeraClient: disallowed path "${path}" (normalized: "${normalized}") — only ${this.allowedPathPrefix} endpoints are permitted`);
		}

		if (this.allowedAudiences || this.requiredRole) {
			const token = await this.getToken();
			const payload = this.getCachedPayload(token);

			if (this.allowedAudiences && this.allowedAudiences.length > 0) {
				const aud = payload.aud;
				const audList = Array.isArray(aud) ? aud : (aud ? [aud] : []);
				const matched = audList.some((a) => this.allowedAudiences?.includes(String(a)));
				if (!matched) {
					throw new Error('HemeraClient: token audience not allowed for service endpoints');
				}
			}

			if (this.requiredRole) {
				const role = this.extractRoleFromPayload(payload);
				if (!role || role !== this.requiredRole) {
					throw new Error(`HemeraClient: token does not contain required role '${this.requiredRole}'`);
				}
			}
		}
	}

	/**
	 * Returns a cached decoded JWT payload if the token matches and the cache
	 * has not expired. Otherwise decodes, caches, and returns the payload.
	 */
	private getCachedPayload(token: string): Record<string, unknown> {
		const now = Date.now();
		if (
			this.cachedPayload &&
			this.cachedPayload.token === token &&
			now < this.cachedPayload.expiresAt
		) {
			return this.cachedPayload.payload;
		}
		const payload = this.decodeJwtPayload(token);
		this.cachedPayload = {
			token,
			payload,
			expiresAt: now + HemeraClient.PAYLOAD_CACHE_TTL_MS,
		};
		return payload;
	}

	private decodeJwtPayload(token: string): Record<string, unknown> {
		try {
			const parts = token.split('.');
			if (parts.length < 2) return {};
			const raw = parts[1];
			const padded = raw.replace(/-/g, '+').replace(/_/g, '/');
			const buf = Buffer.from(padded.padEnd(padded.length + (4 - (padded.length % 4)) % 4, '='), 'base64');
			return JSON.parse(buf.toString('utf8'));
		} catch (_err) {
			return {};
		}
	}

	// biome-ignore lint/suspicious/noExplicitAny: JWT payloads have dynamic structure
	private extractRoleFromPayload(payload: any): string | undefined {
		// Common places for Clerk or custom metadata
		if (!payload) return undefined;
		if (payload.role) return payload.role;
		if (payload.public_metadata?.role) return payload.public_metadata.role;
		if (payload.publicMetadata?.role) return payload.publicMetadata.role;
		if (payload['https://hasura.io/jwt/claims']?.['x-hasura-role']) return payload['https://hasura.io/jwt/claims']['x-hasura-role'];
		if (payload.claims?.role) return payload.claims.role;
		return undefined;
	}
}
