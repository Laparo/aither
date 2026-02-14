// ---------------------------------------------------------------------------
// Hemera Academy API — HTTP Client
// Task: T013 — Auth, throttling (p-throttle 2 req/s), retry (p-retry)
// ---------------------------------------------------------------------------

import pRetry, { AbortError } from "p-retry";
import pThrottle from "p-throttle";
import type { z } from "zod";
import {
	CoursesResponseSchema,
	CourseWithParticipantsSchema,
	ParticipationResponseSchema,
	type CoursesResponse,
	type CourseWithParticipants,
	type Participation,
	type ResultOutcome,
} from "./schemas";

export interface HemeraClientOptions {
	baseUrl: string;
	getToken: () => Promise<string>;
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
 * - API key authentication via Authorization header
 * - Rate limiting via p-throttle (default: 2 req/s)
 * - Automatic retry on 5xx/network errors via p-retry (default: 5 attempts, jitter)
 * - Retry-After header support for 429 responses
 * - Zod validation of every response
 */
export class HemeraClient {
	private readonly baseUrl: string;
	private readonly getToken: () => Promise<string>;
	private readonly maxRetries: number;
	private readonly fetchFn: typeof fetch;
	private readonly throttledFetch: typeof fetch;

	constructor(options: HemeraClientOptions) {
		this.baseUrl = options.baseUrl.replace(/\/+$/, "");
		this.getToken = options.getToken;
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
	 * Fetches a resource from the Hemera API and validates it with Zod.
	 * Retries on 5xx and network errors. Respects 429 Retry-After.
	 *
	 * @param path   API endpoint (e.g., "/seminars")
	 * @param schema Zod schema for validation
	 * @returns      Validated result
	 */
	/**
	 * Resolve and validate the auth token. Throws HemeraApiError if invalid.
	 */
	private async resolveToken(url: string): Promise<string> {
		const token = await this.getToken();
		if (!token || typeof token !== "string" || token.trim().length === 0) {
			throw new AbortError(
				new HemeraApiError(
					401,
					"Unauthorized",
					"Service token is empty or invalid — check getToken() implementation and credentials",
					url,
				),
			);
		}
		return token;
	}

	async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
		const url = `${this.baseUrl}${path}`;

		const response = await pRetry(
			async () => {
				const token = await this.resolveToken(url);
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
	 */
	async put<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T>;
	async put(path: string, body: unknown): Promise<unknown>;
	async put<T = unknown>(path: string, body: unknown, schema?: z.ZodType<T>): Promise<T | unknown> {
		const url = `${this.baseUrl}${path}`;

		const response = await pRetry(
			async () => {
				const token = await this.resolveToken(url);
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

	// Service API methods
	async getServiceCourses(): Promise<CoursesResponse> {
		return this.get('/service/courses', CoursesResponseSchema);
	}

	async getServiceCourse(id: string): Promise<CourseWithParticipants> {
		return this.get(`/service/courses/${encodeURIComponent(id)}`, CourseWithParticipantsSchema);
	}

	async getServiceParticipation(id: string): Promise<Participation> {
		return this.get(`/service/participations/${encodeURIComponent(id)}`, ParticipationResponseSchema);
	}

	async updateServiceParticipationResult(id: string, data: { resultOutcome?: ResultOutcome | null; resultNotes?: string | null }): Promise<Participation> {
		return this.put(`/service/participations/${encodeURIComponent(id)}/result`, data, ParticipationResponseSchema);
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
