// ---------------------------------------------------------------------------
// Hemera Academy API — HTTP Client
// Task: T013 — Auth, throttling (p-throttle 2 req/s), retry (p-retry)
// ---------------------------------------------------------------------------

import pRetry from "p-retry";
import pThrottle from "p-throttle";
import type { z } from "zod";

export interface HemeraClientOptions {
	baseUrl: string;
	apiKey: string;
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
 * HTTP-Client für die hemera.academy REST API.
 *
 * Features:
 * - API-Key-Authentifizierung via Authorization-Header
 * - Rate-Limiting via p-throttle (Standard: 2 req/s)
 * - Automatisches Retry bei 5xx/Netzwerkfehlern via p-retry (Standard: 5 Versuche, Jitter)
 * - Retry-After-Header-Unterstützung für 429-Responses
 * - Zod-Validierung jeder Response
 */
export class HemeraClient {
	private readonly baseUrl: string;
	private readonly apiKey: string;
	private readonly maxRetries: number;
	private readonly fetchFn: typeof fetch;
	private readonly throttledFetch: typeof fetch;

	constructor(options: HemeraClientOptions) {
		this.baseUrl = options.baseUrl.replace(/\/+$/, "");
		this.apiKey = options.apiKey;
		this.maxRetries = options.maxRetries ?? 5;
		this.fetchFn = options.fetchFn ?? globalThis.fetch;

		const throttle = pThrottle({
			limit: options.rateLimit ?? 2,
			interval: 1000,
		});

		this.throttledFetch = throttle((input: string | URL | Request, init?: RequestInit) =>
			this.fetchFn(input, init),
		) as typeof fetch;
	}

	/**
	* Ruft eine Ressource von der Hemera API ab und validiert sie mit Zod.
	 * Wiederholt bei 5xx- und Netzwerkfehlern. Beachtet 429 Retry-After.
	 *
	 * @param path   API-Endpoint (z.B. "/seminars")
	 * @param schema Zod-Schema zur Validierung
	 * @returns      Validiertes Ergebnis
	 */
	async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
		const url = `${this.baseUrl}${path}`;

		const response = await pRetry(
			async () => {
				const res = await this.throttledFetch(url, {
					method: "GET",
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						Accept: "application/json",
					},
				});

				if (res.status === 429) {
					const retryAfter = res.headers.get("Retry-After");
					const delayMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 5000;
					await this.delay(delayMs);
					throw new pRetry.AbortError(
						`Rate limited (429) for ${url}. Retrying after ${delayMs}ms.`,
					);
				}

				if (res.status >= 500) {
					const body = await res.text();
					throw new HemeraApiError(res.status, res.statusText, body, url);
				}

				if (!res.ok) {
					const body = await res.text();
					throw new pRetry.AbortError(new HemeraApiError(res.status, res.statusText, body, url));
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
	 */
	async put<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
		const url = `${this.baseUrl}${path}`;

		const response = await pRetry(
			async () => {
				const res = await this.throttledFetch(url, {
					method: "PUT",
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
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
					throw new pRetry.AbortError(new HemeraApiError(res.status, res.statusText, body, url));
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

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
