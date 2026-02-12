// ---------------------------------------------------------------------------
// Unit Tests: Sync Orchestrator
// Task: T022 [US1] — TDD: Write FIRST, must FAIL before implementation
// ---------------------------------------------------------------------------

import type { HemeraClient } from "@/lib/hemera/client";
import { SyncOrchestrator } from "@/lib/sync/orchestrator";
import type { SyncManifest } from "@/lib/sync/types";
import { describe, expect, it, vi } from "vitest";

// Mock implementations
function createMockClient(overrides?: Partial<Record<string, unknown>>): HemeraClient {
	return {
		get: vi.fn(async (path: string) => {
			if (path.includes("templates"))
				return [
					{
						sourceId: "tpl-001",
						seminarId: "sem-001",
						lessonId: null,
						markup: "<h1>{{title}}</h1>",
						version: "1",
					},
				];
			if (path.includes("seminars"))
				return [
					{
						sourceId: "sem-001",
						title: "Workshop",
						description: null,
						dates: [],
						instructorIds: [],
						lessonIds: ["les-001"],
						recordingUrl: null,
					},
				];
			if (path.includes("lessons"))
				return [
					{
						sourceId: "les-001",
						seminarId: "sem-001",
						title: "Lesson 1",
						sequence: 0,
						textContentIds: [],
						mediaAssetIds: [],
					},
				];
			if (path.includes("users"))
				return [
					{
						sourceId: "usr-001",
						name: "Max",
						email: null,
						role: "participant",
						seminarIds: ["sem-001"],
					},
				];
			if (path.includes("texts")) return [];
			if (path.includes("media")) return [];
			return [];
		}),
		put: vi.fn(),
		...overrides,
	} as unknown as HemeraClient;
}

function createMockManifest(): SyncManifest {
	return { lastSyncTime: "", hashes: {} };
}

describe("SyncOrchestrator", () => {
	it("fetches all entity types from the API", async () => {
		const client = createMockClient();
		const orchestrator = new SyncOrchestrator({
			client,
			outputDir: "/tmp/aither-test-output",
			manifestPath: "/tmp/aither-test-output/.sync-manifest.json",
		});

		const job = await orchestrator.run();

		expect(client.get).toHaveBeenCalled();
		expect(job.status).toBe("success");
		expect(job.recordsFetched).toBeGreaterThan(0);
	});

	it("tracks generated and skipped HTML files", async () => {
		const client = createMockClient();
		const orchestrator = new SyncOrchestrator({
			client,
			outputDir: "/tmp/aither-test-output",
			manifestPath: "/tmp/aither-test-output/.sync-manifest.json",
		});

		const job = await orchestrator.run();

		expect(job.htmlFilesGenerated).toBeGreaterThanOrEqual(0);
		expect(job.htmlFilesSkipped).toBeGreaterThanOrEqual(0);
		expect(typeof job.htmlFilesGenerated).toBe("number");
	});

	it("handles empty API responses gracefully", async () => {
		const client = createMockClient({
			get: vi.fn(async () => []),
		});
		const orchestrator = new SyncOrchestrator({
			client,
			outputDir: "/tmp/aither-test-output",
			manifestPath: "/tmp/aither-test-output/.sync-manifest.json",
		});

		const job = await orchestrator.run();

		expect(job.status).toBe("success");
		expect(job.recordsFetched).toBe(0);
	});

	it("records errors for malformed responses without crashing", async () => {
		const client = createMockClient({
			get: vi.fn(async (path: string) => {
				if (path.includes("templates")) throw new Error("API validation failed");
				return [];
			}),
		});
		const orchestrator = new SyncOrchestrator({
			client,
			outputDir: "/tmp/aither-test-output",
			manifestPath: "/tmp/aither-test-output/.sync-manifest.json",
		});

		const job = await orchestrator.run();

		expect(job.status).toBe("failed");
		expect(job.errors.length).toBeGreaterThan(0);
	});

	it("returns a SyncJob with all required fields", async () => {
		const client = createMockClient();
		const orchestrator = new SyncOrchestrator({
			client,
			outputDir: "/tmp/aither-test-output",
			manifestPath: "/tmp/aither-test-output/.sync-manifest.json",
		});

		const job = await orchestrator.run();

		expect(job.jobId).toBeTruthy();
		expect(job.startTime).toBeTruthy();
		expect(job.status).toMatch(/^(running|success|failed)$/);
		expect(typeof job.recordsFetched).toBe("number");
		expect(typeof job.htmlFilesGenerated).toBe("number");
		expect(typeof job.htmlFilesSkipped).toBe("number");
		expect(Array.isArray(job.errors)).toBe(true);
	});
});
