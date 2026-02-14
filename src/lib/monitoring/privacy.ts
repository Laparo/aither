// ---------------------------------------------------------------------------
// Privacy & Consent helpers for telemetry/monitoring.
// Ported from hemera — Default: No PII attached unless explicit consent.
// ---------------------------------------------------------------------------

/**
 * Returns whether telemetry consent is granted.
 * Currently environment-driven; future: derive from a persisted consent state.
 */
export function isTelemetryConsentGranted(): boolean {
	return (
		process.env.NEXT_PUBLIC_TELEMETRY_CONSENT === "1" ||
		process.env.TELEMETRY_CONSENT === "1" ||
		process.env.ROLLBAR_ALLOW_PII === "1"
	);
}
