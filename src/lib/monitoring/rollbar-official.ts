// ---------------------------------------------------------------------------
// Rollbar Configuration — following hemera's official pattern
// Singleton instance with environment detection, test/E2E no-op, PII filtering,
// sampling rates, and structured error reporting.
// ---------------------------------------------------------------------------

import Rollbar from "rollbar";
import { isTelemetryConsentGranted } from "./privacy";

interface RollbarTestInstance {
	critical: () => void;
	error: () => void;
	warning: () => void;
	warn: () => void;
	info: () => void;
	debug: () => void;
	log: () => void;
	wait: (cb?: () => void) => void;
}

// ── Enablement rules ──────────────────────────────────────────────────────

const isE2EMode = process.env.E2E_TEST === "1";
const isTestMode =
	process.env.NODE_ENV === "test" ||
	// Vitest uses VITEST, VITEST_POOL_ID; Jest uses JEST_WORKER_ID
	typeof process.env.VITEST !== "undefined" ||
	typeof process.env.JEST_WORKER_ID !== "undefined";
const isDevelopment = process.env.NODE_ENV === "development";
const isExplicitlyDisabled =
	process.env.NEXT_PUBLIC_ROLLBAR_ENABLED === "0" ||
	process.env.ROLLBAR_ENABLED === "0";

function readNumberEnv(name: string, fallback: number): number {
	const v = process.env[name];
	if (!v) return fallback;
	const n = Number(v);
	return Number.isFinite(n) ? n : fallback;
}

/**
 * Determine Rollbar environment from NODE_ENV.
 */
function getRollbarEnvironment(): string {
	return process.env.NODE_ENV || "development";
}

// ── Base configuration ────────────────────────────────────────────────────

const baseConfig = {
	// In development, disable automatic capture to reduce noise; errors are still
	// reported explicitly via reportError() / logSyncError() etc.
	captureUncaught: !isDevelopment,
	captureUnhandledRejections: !isDevelopment,
	environment: getRollbarEnvironment(),
	// Disabled in E2E mode, test mode (via no-op instance), or when explicitly turned off
	enabled: !isE2EMode && !isExplicitlyDisabled,
};

// Client-side configuration (for future React components)
export const clientConfig = {
	accessToken: process.env.NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN,
	...baseConfig,
};

// Server-side singleton instance
// In test mode, export a no-op instance to avoid network calls.
export const serverInstance: Rollbar | RollbarTestInstance = isTestMode
	? {
			critical: () => {},
			error: () => {},
			warning: () => {},
			warn: () => {},
			info: () => {},
			debug: () => {},
			log: () => {},
			wait: (cb?: () => void) => {
				if (typeof cb === "function") cb();
			},
		}
	: new Rollbar({
			accessToken: isE2EMode ? "dummy-token-for-e2e" : process.env.ROLLBAR_SERVER_TOKEN,
			...baseConfig,
			payload: {
				server: { root: process.cwd() },
			},
			// PII filtering: always scrub secrets; scrub user-identifying fields when consent is not granted
			scrubFields: [
				// Always scrub secrets
				"password",
				"apiKey",
				"api_key",
				"secret",
				"token",
				"authorization",
				// Scrub PII fields unless consent is explicitly granted
				...(isTelemetryConsentGranted()
					? []
					: ["email", "user_email", "userEmail", "user_ip", "ip_address", "person"]),
			],
		});

// Legacy-compatible exports
export const rollbarConfig = {
	accessToken: process.env.ROLLBAR_SERVER_TOKEN,
	...baseConfig,
};

export const rollbar = serverInstance;

export const clientRollbarConfig = {
	accessToken: process.env.NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN,
	...baseConfig,
};

// ── Severity & Error Context ──────────────────────────────────────────────

export const ErrorSeverity = {
	CRITICAL: "critical",
	ERROR: "error",
	WARNING: "warning",
	INFO: "info",
	DEBUG: "debug",
} as const;

export type ErrorSeverityType = (typeof ErrorSeverity)[keyof typeof ErrorSeverity];

export interface ErrorContext {
	userId?: string;
	userEmail?: string;
	requestId?: string;
	route?: string;
	method?: string;
	userAgent?: string;
	ip?: string;
	timestamp?: Date;
	additionalData?: Record<string, unknown>;
}

export function createErrorContext(
	request?: Request,
	userId?: string,
	requestId?: string,
): ErrorContext {
	return {
		userId,
		requestId,
		route: request ? new URL(request.url).pathname : undefined,
		method: request?.method,
		userAgent: request?.headers.get("user-agent") || undefined,
		ip: request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || undefined,
		timestamp: new Date(),
	};
}

// ── Structured error reporting with sampling ──────────────────────────────

export function reportError(
	error: Error | string,
	context?: ErrorContext,
	severity: ErrorSeverityType = ErrorSeverity.ERROR,
): void {
	if (!baseConfig.enabled) return;

	try {
		const rateAll = readNumberEnv("ROLLBAR_SAMPLE_RATE_ALL", 1);
		const rateInfo = readNumberEnv("ROLLBAR_SAMPLE_RATE_INFO", 0.05);
		const rateWarn = readNumberEnv("ROLLBAR_SAMPLE_RATE_WARN", 0.05);
		const rateError = readNumberEnv("ROLLBAR_SAMPLE_RATE_ERROR", 1);
		const rateCritical = readNumberEnv("ROLLBAR_SAMPLE_RATE_CRITICAL", 1);

		const pick = (rate: number) =>
			Math.random() < Math.max(0, Math.min(1, rate)) && Math.random() < rateAll;

		const includePII = isTelemetryConsentGranted();
		const rollbarContext: Record<string, unknown> = {
			person:
				includePII && context?.userId
					? { id: context.userId, email: context.userEmail }
					: undefined,
			request: {
				id: context?.requestId,
				url: context?.route,
				method: context?.method,
				// Only include IP and User-Agent when PII consent is granted
				user_ip: includePII ? context?.ip : undefined,
				headers: includePII ? { "User-Agent": context?.userAgent } : undefined,
			},
			custom: {
				timestamp: context?.timestamp?.toISOString(),
				...context?.additionalData,
			},
		};

		switch (severity) {
			case ErrorSeverity.CRITICAL:
				if (pick(rateCritical)) serverInstance.critical(error, rollbarContext);
				break;
			case ErrorSeverity.ERROR:
				if (pick(rateError)) serverInstance.error(error, rollbarContext);
				break;
			case ErrorSeverity.WARNING:
				if (pick(rateWarn)) serverInstance.warning(error, rollbarContext);
				break;
			case ErrorSeverity.INFO:
				if (pick(rateInfo)) serverInstance.info(error, rollbarContext);
				break;
			case ErrorSeverity.DEBUG:
				if (pick(rateInfo)) serverInstance.debug?.(error, rollbarContext);
				break;
			default:
				if (pick(rateError)) serverInstance.error(error, rollbarContext);
		}
	} catch {
		// Suppress any reporting failures
	}
}

// ── User action tracking ──────────────────────────────────────────────────

export function recordUserAction(
	action: string,
	userId?: string,
	metadata?: Record<string, unknown>,
): void {
	if (!baseConfig.enabled) return;
	try {
		const includePII = isTelemetryConsentGranted();
		serverInstance.info(`User Action: ${action}`, {
			person: includePII && userId ? { id: userId } : undefined,
			custom: {
				action,
				userAction: true,
				timestamp: new Date().toISOString(),
				...metadata,
			},
		});
	} catch {
		// no-op
	}
}

// ── Flush helper ──────────────────────────────────────────────────────────

export function flushRollbar(): Promise<void> {
	return new Promise((resolve) => {
		if (!baseConfig.enabled) return resolve();
		try {
			serverInstance.wait(() => resolve());
		} catch {
			resolve();
		}
	});
}
