// ---------------------------------------------------------------------------
// Sync Error Logging — Rollbar Integration
// Task: T042 [US3] — Structured error logging for sync jobs
// ---------------------------------------------------------------------------

import { getRollbar } from "@/lib/monitoring/rollbar";

export function logSyncError(
	jobId: string,
	entityType: string,
	sourceId: string,
	message: string,
): void {
	const rollbar = getRollbar();
	rollbar.error(`Sync error: ${message}`, {
		jobId,
		entityType,
		sourceId,
		timestamp: new Date().toISOString(),
	});
}

export function logSyncWarning(
	jobId: string,
	entityType: string,
	sourceId: string,
	message: string,
): void {
	const rollbar = getRollbar();
	rollbar.warning(`Sync warning: ${message}`, {
		jobId,
		entityType,
		sourceId,
		timestamp: new Date().toISOString(),
	});
}

export function logSyncCritical(jobId: string, message: string): void {
	const rollbar = getRollbar();
	rollbar.critical(`Sync critical: ${message}`, {
		jobId,
		timestamp: new Date().toISOString(),
	});
}
