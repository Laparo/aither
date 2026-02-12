// ---------------------------------------------------------------------------
// Environment Configuration Loader
// Task: T017 — Validate all env vars at startup using Zod
// ---------------------------------------------------------------------------

import { z } from "zod";

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

	// Rollbar
	ROLLBAR_SERVER_TOKEN: z.string().min(1).default(""),
	NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN: z.string().min(1).default(""),

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
