// ---------------------------------------------------------------------------
// Unit Tests: Sync Error Logging (Rollbar)
// Task: T040 [US3] — Rollbar called with structured context on failures
// ---------------------------------------------------------------------------

// Fix: Move mock declarations to top-level scope, before any imports
const mockError = vi.fn();
const mockWarning = vi.fn();
const mockCritical = vi.fn();

vi.mock("@/lib/monitoring/rollbar-official", () => ({
	serverInstance: {
		error: mockError,
		warning: mockWarning,
		critical: mockCritical,
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		log: vi.fn(),
		wait: vi.fn((cb?: () => void) => {
			if (typeof cb === "function") cb();
		}),
	},
}));

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

describe("Sync Error Logging", () => {
	let logSyncError: (jobId: string, entityType: string, sourceId: string, message: string) => void;
	let logSyncWarning: (
		jobId: string,
		entityType: string,
		sourceId: string,
		message: string,
	) => void;
	let logSyncCritical: (jobId: string, message: string) => void;

	beforeAll(async () => {
		({ logSyncError, logSyncWarning, logSyncCritical } = await import(
			"@/lib/monitoring/sync-logger"
		));
	});

	beforeEach(() => {
		mockError.mockClear();
		mockWarning.mockClear();
		mockCritical.mockClear();
	});

	it("logs sync errors with structured context via Rollbar error()", () => {
		logSyncError("job-123", "seminars", "sem-001", "API returned 500");

		expect(mockError).toHaveBeenCalledTimes(1);
		const [message, context] = mockError.mock.calls[0];
		expect(message).toContain("Sync error");
		expect(context).toMatchObject({
			jobId: "job-123",
			entityType: "seminars",
			// sourceId is redacted when PII consent is not granted (default in tests)
			sourceId: "[redacted]",
		});
	});

	it("logs retry warnings via Rollbar warning()", () => {
		logSyncWarning("job-456", "lessons", "les-001", "Retry attempt 2/5");

		expect(mockWarning).toHaveBeenCalledTimes(1);
		const [message, context] = mockWarning.mock.calls[0];
		expect(message).toContain("Sync warning");
		expect(context).toMatchObject({
			jobId: "job-456",
			entityType: "lessons",
		});
	});

	it("logs critical failures via Rollbar critical()", () => {
		logSyncCritical("job-789", "Failure threshold exceeded — 3 consecutive failures");

		expect(mockCritical).toHaveBeenCalledTimes(1);
		const [message, context] = mockCritical.mock.calls[0];
		expect(message).toContain("Sync critical");
		expect(context).toMatchObject({
			jobId: "job-789",
		});
	});

	it("includes timestamp in log context", () => {
		logSyncError("job-001", "media", "media-001", "Not found");

		const [, context] = mockError.mock.calls[0];
		expect(context).toHaveProperty("timestamp");
		expect(typeof context.timestamp).toBe("string");
	});
});
