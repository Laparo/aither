// ---------------------------------------------------------------------------
// Hemera Academy API — HTTP Client
// Task: T013 — Auth, throttling (p-throttle 2 req/s), retry (p-retry)
// Updated: API-Key-based authentication for service-to-service communication
// ---------------------------------------------------------------------------

import pRetry, { AbortError } from "p-retry";
import pThrottle from "p-throttle";
import type { z } from "zod";

export interface HemeraClientOptions {
	baseUrl: string;
	/** Function to retrieve the API key for service auth */
	getToken: () => Promise<string>;
	/** Allowed API path prefix (defaults to '/api/service/') */
	allowedPathPrefix?: string;
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

/**
 * HTTP client for the hemera.academy REST API.
 *
 * Features:
 * - API key authentication via X-API-Key header
 * - Rate limiting via p-throttle (default: 2 req/s)
 * - Automatic retry on 5xx/network errors via p-retry (default: 5 attempts, jitter)
 * - Retry-After header support for 429 responses
 * - Zod validation of every response
 */
export class HemeraClient {
	private readonly baseUrl: string;
	private readonly getToken: () => Promise<string>;
	private readonly allowedPathPrefix: string;
	private readonly maxRetries: number;
	private readonly fetchFn: typeof fetch;
	private readonly throttledFetch: typeof fetch;

	constructor(options: HemeraClientOptions) {
		this.baseUrl = options.baseUrl.replace(/\/+$/, "");
		if (!options.getToken || typeof options.getToken !== "function") {
			throw new Error(
				"HemeraClient construction error: a valid `getToken()` function is required in options.\n" +
				"Provide `getToken: () => Promise<string>` (e.g. from `getTokenManager().getToken`) or use `createHemeraClient()` which wires the token manager.\n" +
				"Ensure HEMERA_API_KEY is set for the token manager when using the default factory."
			);
		}
		this.getToken = options.getToken;
		this.maxRetries = options.maxRetries ?? 5;
		this.fetchFn = options.fetchFn ?? globalThis.fetch;
		this.allowedPathPrefix = options.allowedPathPrefix ?? "/api/service/";

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
	 * Uses API key for authentication via X-API-Key header.
	 *
	 * @param path   API endpoint (e.g., "/api/service/courses")
	 * @param schema Zod schema for validation
	 * @returns      Validated result
	 */
	async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
		this.ensurePathAllowed(path);
		const url = `${this.baseUrl}${path}`;

		const response = await pRetry(
			async () => {
				const token = await this.getToken();
				const res = await this.throttledFetch(url, {
					method: "GET",
					headers: {
						"X-API-Key": token,
						Accept: "application/json",
					},
				});

				if (res.status === 429) {
					const retryAfter = res.headers.get("Retry-After");
					const delayMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 5000;
					await this.delay(delayMs);
					throw new HemeraApiError(res.status, res.statusText, "", url);
				}

				if (res.status >= 500) {
					const body = await res.text();
					throw new HemeraApiError(res.status, res.statusText, body, url);
				}

				if (!res.ok) {
					const body = await res.text();
					throw new AbortError(new HemeraApiError(res.status, res.statusText, body, url));
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
	 * Uses API key for authentication via X-API-Key header.
	 */
	async put<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T>;
	async put(path: string, body: unknown): Promise<unknown>;
	async put<T = unknown>(path: string, body: unknown, schema?: z.ZodType<T>): Promise<T | unknown> {
		this.ensurePathAllowed(path);
		const url = `${this.baseUrl}${path}`;

		const response = await pRetry(
			async () => {
				const token = await this.getToken();
				const res = await this.throttledFetch(url, {
					method: "PUT",
					headers: {
						"X-API-Key": token,
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

				if (res.status >= 500) {
					const body = await res.text();
					throw new HemeraApiError(res.status, res.statusText, body, url);
				}

				if (!res.ok) {
					const body = await res.text();
					throw new AbortError(new HemeraApiError(res.status, res.statusText, body, url));
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

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Ensure the requested path is within the allowed prefix
	 */
	private ensurePathAllowed(path: string) {
		if (!path.startsWith(this.allowedPathPrefix)) {
			throw new Error(`HemeraClient: disallowed path "${path}" — only ${this.allowedPathPrefix} endpoints are permitted`);
		}
	}
}
