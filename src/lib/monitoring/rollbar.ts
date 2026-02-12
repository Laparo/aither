// ---------------------------------------------------------------------------
// Rollbar Server-Side Integration
// Task: T015 — Singleton instance with PII filtering
// ---------------------------------------------------------------------------

import Rollbar from "rollbar";

let _rollbar: Rollbar | null = null;

/**
 * Get the singleton Rollbar instance.
 * If ROLLBAR_SERVER_TOKEN is not set, returns a no-op instance that logs to console.
 */
export function getRollbar(): Rollbar {
	if (_rollbar) return _rollbar;

	const token = process.env.ROLLBAR_SERVER_TOKEN;

	if (!token) {
		// No-op: log warnings to console when Rollbar is not configured
		_rollbar = new Rollbar({
			enabled: false,
			accessToken: "disabled",
		});
		return _rollbar;
	}

	_rollbar = new Rollbar({
		accessToken: token,
		environment: process.env.NODE_ENV ?? "development",
		captureUncaught: true,
		captureUnhandledRejections: true,
		payload: {
			server: {
				root: process.cwd(),
			},
		},
		// PII filtering: scrub email fields from payloads
		scrubFields: ["email", "user_email", "userEmail", "password", "apiKey", "api_key"],
	});

	return _rollbar;
}

/** Reset singleton (for testing). */
export function resetRollbar(): void {
	_rollbar = null;
}
