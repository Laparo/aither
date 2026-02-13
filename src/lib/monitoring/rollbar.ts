// ---------------------------------------------------------------------------
// DEPRECATED: This file is kept for backward compatibility only.
// Please import directly from './rollbar-official' instead.
//
// All Rollbar exports have been consolidated into rollbar-official.ts
// to maintain a single source of truth and prevent import drift.
// ---------------------------------------------------------------------------

// Re-export everything from the official module
export {
	clientConfig,
	clientRollbarConfig,
	createErrorContext,
	type ErrorContext,
	ErrorSeverity,
	type ErrorSeverityType,
	flushRollbar,
	recordUserAction,
	reportError,
	rollbar,
	rollbarConfig,
	serverInstance,
} from "./rollbar-official";

// Legacy-compatible re-export: getRollbar() returns the serverInstance
import { serverInstance } from "./rollbar-official";
import type Rollbar from "rollbar";

/** @deprecated Use `serverInstance` from `./rollbar-official` instead. */
export function getRollbar(): Rollbar {
	return serverInstance as Rollbar;
}

/** @deprecated No-op — singleton is now module-scoped. */
export function resetRollbar(): void {
	// no-op: singleton lifecycle is managed by rollbar-official.ts
}
