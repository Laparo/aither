// ---------------------------------------------------------------------------
// Enhanced logging utilities for API routes with request context using Rollbar
// Ported from hemera — structured logging with severity levels
// ---------------------------------------------------------------------------

import { isTelemetryConsentGranted } from "../monitoring/privacy";
import { serverInstance } from "../monitoring/rollbar-official";
import type { RequestContext } from "./request-id";

/**
 * Log levels
 */
export enum LogLevel {
	ERROR = "error",
	WARN = "warn",
	INFO = "info",
	DEBUG = "debug",
}

/**
 * Structured log entry
 */
export interface LogEntry {
	level: LogLevel;
	message: string;
	context: RequestContext;
	data?: unknown;
	error?: Error;
	timestamp: string;
}

/**
 * Enhanced logger with request context that uses Rollbar
 */
export class ApiLogger {
	private startTime: number = Date.now();

	constructor(private requestContext: RequestContext) {}

	/**
	 * Return a scrubbed copy of the request context.
	 * When PII consent is not granted, `ip` and `userAgent` are stripped.
	 */
	private safeContext(): Omit<RequestContext, "ip" | "userAgent"> & {
		ip?: string;
		userAgent?: string;
	} {
		if (isTelemetryConsentGranted()) return this.requestContext;
		const { ip: _ip, userAgent: _ua, ...safe } = this.requestContext;
		return safe;
	}

	/**
	 * Log an error with structured context via Rollbar
	 */
	error(message: string, error?: Error, data?: unknown): void {
		serverInstance.error(message, {
			requestId: this.requestContext.id,
			error: error?.message,
			stack: error?.stack,
			data,
			context: this.safeContext(),
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Log a warning with structured context via Rollbar
	 */
	warn(message: string, data?: unknown): void {
		serverInstance.warn(message, {
			requestId: this.requestContext.id,
			data,
			context: this.safeContext(),
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Log info with structured context via Rollbar
	 */
	info(message: string, data?: unknown): void {
		serverInstance.info(message, {
			requestId: this.requestContext.id,
			data,
			context: this.safeContext(),
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Log debug information (only in development) via Rollbar
	 */
	debug(message: string, data?: unknown): void {
		if (process.env.NODE_ENV === "development") {
			serverInstance.debug?.(message, {
				requestId: this.requestContext.id,
				data,
				context: this.safeContext(),
				timestamp: new Date().toISOString(),
			});
		}
	}

	/**
	 * Track request completion with timing
	 */
	trackRequestCompletion(statusCode: number): void {
		const duration = Date.now() - this.startTime;
		serverInstance.info(
			`Request completed: ${this.requestContext.method} ${this.requestContext.url}`,
			{
				requestId: this.requestContext.id,
				statusCode,
				durationMs: duration,
				context: this.safeContext(),
				timestamp: new Date().toISOString(),
			},
		);
	}
}

/**
 * Create an API logger instance with request context
 */
export function createApiLogger(requestContext: RequestContext): ApiLogger {
	return new ApiLogger(requestContext);
}
