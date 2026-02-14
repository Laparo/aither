// ---------------------------------------------------------------------------
// Sync Error Logging — Rollbar Integration
// Task: T042 [US3] — Structured error logging for sync jobs
// ---------------------------------------------------------------------------

import { isTelemetryConsentGranted } from "@/lib/monitoring/privacy";
import { serverInstance } from "@/lib/monitoring/rollbar-official";

/**
 * Build a safe context payload for sync log entries.
 * When PII consent is not granted, `sourceId` is redacted because it may
 * reference a user-facing identifier (e.g. an external student/teacher ID).
 */
function safeSyncContext(
	jobId: string,
	entityType: string,
	sourceId: string,
): Record<string, string> {
	return {
		jobId,
		entityType,
		sourceId: isTelemetryConsentGranted() ? sourceId : "[redacted]",
		timestamp: new Date().toISOString(),
	};
}

export function logSyncError(
	jobId: string,
	entityType: string,
	sourceId: string,
	message: string,
): void {
	serverInstance.error(`Sync error: ${message}`, safeSyncContext(jobId, entityType, sourceId));
}

export function logSyncWarning(
	jobId: string,
	entityType: string,
	sourceId: string,
	message: string,
): void {
	serverInstance.warning(`Sync warning: ${message}`, safeSyncContext(jobId, entityType, sourceId));
}

export function logSyncCritical(jobId: string, message: string): void {
	serverInstance.critical(`Sync critical: ${message}`, {
		jobId,
		timestamp: new Date().toISOString(),
	});
}
