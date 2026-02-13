// ---------------------------------------------------------------------------
// Environment Configuration Loader
// Task: T017 — Validate all env vars at startup using Zod
// ---------------------------------------------------------------------------
//
// Recommended flag values per environment:
//
// ┌──────────────────────────────┬──────────┬──────────┬──────────┐
// │ Flag                         │ Local    │ CI/Test  │ Prod     │
// ├──────────────────────────────┼──────────┼──────────┼──────────┤
// │ ROLLBAR_ENABLED              │ 1        │ 0        │ 1        │
// │ NEXT_PUBLIC_ROLLBAR_ENABLED  │ 1        │ 0        │ 1        │
// │ NEXT_PUBLIC_DISABLE_ROLLBAR  │ 0        │ 1        │ 0        │
// │ E2E_TEST                     │ 0        │ 1        │ 0        │
// │ NEXT_PUBLIC_TELEMETRY_CONSENT│ 0        │ 0        │ 0 *      │
// │ ROLLBAR_ALLOW_PII            │ 0        │ 0        │ 0 *      │
// │ ROLLBAR_SAMPLE_RATE_INFO     │ 1        │ —        │ 0.05     │
// │ ROLLBAR_SAMPLE_RATE_WARN     │ 1        │ —        │ 0.05     │
// │ ROLLBAR_SAMPLE_RATE_ERROR    │ 1        │ —        │ 1        │
// │ ROLLBAR_SAMPLE_RATE_CRITICAL │ 1        │ —        │ 1        │
// └──────────────────────────────┴──────────┴──────────┴──────────┘
// * Set to 1 only with explicit user consent (GDPR/DSG).
// — Not applicable (Rollbar is disabled in CI).
//
// See .env.example for full documentation of each variable.
// ---------------------------------------------------------------------------

import { z } from "zod";

/**
 * Coerce environment variable strings to booleans for use in Zod schemas.
 *
 * Truthy values: `"1"`, `1`, `true`, `"true"`
 * Falsy values:  everything else (`"0"`, `0`, `""`, `undefined`, `"false"`, etc.)
 *
 * @param defaultValue - The default when the env var is not set.
 *
 * @example
 * ```ts
 * const Schema = z.object({
 *   FEATURE_ENABLED: envBool(true),   // default: true  → "1" or "true" to enable
 *   DEBUG_MODE:      envBool(false),  // default: false → set "1" to enable
 * });
 * ```
 *
 * @remarks
 * - Use for all boolean-like env flags (e.g. ROLLBAR_ENABLED, E2E_TEST).
 * - Do NOT use for numeric values (use `z.coerce.number()` instead).
 * - The resulting `AppConfig` type will be `boolean`, not `string`.
 */
const envBool = (defaultValue: boolean) =>
	z.preprocess(
		(v) => v === "1" || v === 1 || v === true || v === "true",
		z.boolean(),
	).default(defaultValue);

const EnvSchema = z.object({
	// Hemera Academy API
	HEMERA_API_BASE_URL: z.string().url(),
	HEMERA_API_KEY: z.string().min(1),

	// Clerk Authentication
	NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
	CLERK_SECRET_KEY: z.string().min(1),

	// SMTP Notifications
	SMTP_HOST: z.string().min(1),
	SMTP_PORT: z.coerce.number().int().positive().default(587),
	SMTP_USER: z.string().min(1),
	SMTP_PASS: z.string().min(1),
	SMTP_FROM: z.string().email(),
	NOTIFY_EMAIL_TO: z.string().email(),
	NOTIFY_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(3),

	// Rollbar — server & client tokens
	ROLLBAR_SERVER_TOKEN: z.string().default(""),
	NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN: z.string().default(""),

	// Rollbar control flags
	NEXT_PUBLIC_ROLLBAR_ENABLED: envBool(true),
	NEXT_PUBLIC_DISABLE_ROLLBAR: envBool(false),
	ROLLBAR_ENABLED: envBool(true),

	// Rollbar sampling rates (0.0–1.0)
	ROLLBAR_SAMPLE_RATE_ALL: z.coerce.number().min(0).max(1).default(1),
	ROLLBAR_SAMPLE_RATE_INFO: z.coerce.number().min(0).max(1).default(0.05),
	ROLLBAR_SAMPLE_RATE_WARN: z.coerce.number().min(0).max(1).default(0.05),
	ROLLBAR_SAMPLE_RATE_ERROR: z.coerce.number().min(0).max(1).default(1),
	ROLLBAR_SAMPLE_RATE_CRITICAL: z.coerce.number().min(0).max(1).default(1),

	// Privacy
	NEXT_PUBLIC_TELEMETRY_CONSENT: envBool(false),
	TELEMETRY_CONSENT: envBool(false),
	ROLLBAR_ALLOW_PII: envBool(false),

	// E2E Testing
	E2E_TEST: envBool(false),

	// Output
	HTML_OUTPUT_DIR: z.string().min(1).default("output"),
});

export type AppConfig = z.infer<typeof EnvSchema>;

let _config: AppConfig | null = null;

/**
 * Load and validate environment configuration.
 * Throws a descriptive error if any required env var is missing or invalid.
 * Result is cached after first successful load.
 */
export function loadConfig(): AppConfig {
	if (_config) return _config;

	const result = EnvSchema.safeParse(process.env);
	if (!result.success) {
		const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
		throw new Error(`Environment configuration invalid:\n${issues}`);
	}

	_config = result.data;
	return _config;
}

/** Reset cached config (for testing). */
export function resetConfig(): void {
	_config = null;
}
