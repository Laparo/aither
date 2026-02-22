// ---------------------------------------------------------------------------
// Unit Tests: Sync Orchestrator
// Task: T022 [US1] — TDD: Write FIRST, must FAIL before implementation
// Task: T010 [US1] — runDataSync() tests for 005-data-sync
// ---------------------------------------------------------------------------

import type { HemeraClient } from "@/lib/hemera/client";
import type { ServiceCourse, ServiceCourseDetailResponse } from "@/lib/hemera/schemas";
import { populateTemplate } from "@/lib/html/populator";
import { writeHtmlFile } from "@/lib/html/writer";
import { computeContentHash, readManifest, writeManifest } from "@/lib/sync/hash-manifest";
import { SyncOrchestrator } from "@/lib/sync/orchestrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// ---------------------------------------------------------------------------
// runDataSync() — 005-data-sync tests (T010)
// ---------------------------------------------------------------------------

// Mock Rollbar
const mockRollbar = vi.hoisted(() => ({
	info: vi.fn(),
	warning: vi.fn(),
	error: vi.fn(),
}));
vi.mock("@/lib/monitoring/rollbar-official", () => ({
	rollbar: mockRollbar,
}));

// Mock hash-manifest for incremental sync
vi.mock("@/lib/sync/hash-manifest", () => ({
	readManifest: vi.fn().mockResolvedValue({ lastSyncTime: "", hashes: {} }),
	writeManifest: vi.fn().mockResolvedValue(undefined),
	computeContentHash: vi.fn().mockReturnValue("sha256:mock-hash"),
	diffManifest: vi.fn((_old: unknown, newH: Record<string, string>) => ({
		changed: Object.keys(newH),
		deleted: [],
		unchanged: [],
	})),
}));

// Mock HTML writer & populator
vi.mock("@/lib/html/writer", () => ({
	writeHtmlFile: vi.fn().mockResolvedValue(undefined),
	cleanOrphans: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/html/populator", () => ({
	populateTemplate: vi.fn().mockReturnValue("<html>mocked</html>"),
}));

// Test fixtures for data-sync
const futureCourse: ServiceCourse = {
	id: "cm5abc123",
	title: "Gehaltsgespräch meistern",
	slug: "gehaltsgespraech-meistern",
	level: "INTERMEDIATE",
	startDate: "2026-06-15T09:00:00.000Z",
	endDate: "2026-06-15T17:00:00.000Z",
	participantCount: 3,
};

const pastCourse: ServiceCourse = {
	id: "cm5past",
	title: "Vergangener Kurs",
	slug: "vergangener-kurs",
	level: "BEGINNER",
	startDate: "2025-01-01T09:00:00.000Z",
	endDate: "2025-01-01T17:00:00.000Z",
	participantCount: 0,
};

const courseDetailResponse: ServiceCourseDetailResponse = {
	success: true,
	data: {
		id: "cm5abc123",
		title: "Gehaltsgespräch meistern",
		slug: "gehaltsgespraech-meistern",
		level: "INTERMEDIATE",
		startDate: "2026-06-15T09:00:00.000Z",
		endDate: "2026-06-15T17:00:00.000Z",
		participants: [
			{
				participationId: "cp_001",
				userId: "user_001",
				name: "Maria Schmidt",
				status: "CONFIRMED",
				preparationIntent: "Gehaltsverhandlung lernen",
				desiredResults: "Mehr Selbstbewusstsein",
				lineManagerProfile: "Direkte Vorgesetzte",
				preparationCompletedAt: "2026-06-10T10:00:00.000Z",
			},
			{
				participationId: "cp_002",
				userId: "user_002",
				name: "Thomas Müller",
				status: "CONFIRMED",
				preparationIntent: null,
				desiredResults: null,
				lineManagerProfile: null,
				preparationCompletedAt: null,
			},
		],
	},
};

function createDataSyncMockClient(overrides?: Partial<Record<string, unknown>>): HemeraClient {
	return {
		get: vi.fn(),
		put: vi.fn(),
		...overrides,
	} as unknown as HemeraClient;
}

describe("SyncOrchestrator.runDataSync", () => {
	const NOW = new Date("2026-03-01T12:00:00.000Z");

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		mockRollbar.info.mockClear();
		mockRollbar.warning.mockClear();
		mockRollbar.error.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("successfully syncs course with participants", async () => {
		const coursesResponse = {
			success: true,
			data: [futureCourse],
			meta: { requestId: "req-1", timestamp: NOW.toISOString(), version: "1.0" },
		};

		const mockGet = vi
			.fn()
			.mockResolvedValueOnce(coursesResponse) // fetchCourses
			.mockResolvedValueOnce(courseDetailResponse); // fetchCourseDetail

		const client = createDataSyncMockClient({
			get: mockGet,
		} as unknown as Partial<Record<string, unknown>>);
		const orchestrator = new SyncOrchestrator({
			client,
			outputDir: "output",
			manifestPath: "output/.sync-manifest.json",
		});

		const result = await orchestrator.runDataSync();

		expect(result.status).toBe("success");
		expect(result.courseId).toBe("cm5abc123");
		expect(result.noUpcomingCourse).toBe(false);
		expect(result.participantsFetched).toBe(2);
		expect(result.filesGenerated).toBe(1);
		expect(result.errors).toHaveLength(0);
		expect(result.endTime).toBeTruthy();
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});

	it("handles noUpcomingCourse when no future courses exist", async () => {
		const coursesResponse = {
			success: true,
			data: [pastCourse],
			meta: { requestId: "req-2", timestamp: NOW.toISOString(), version: "1.0" },
		};

		const mockGet = vi.fn().mockResolvedValueOnce(coursesResponse);

		const client = createDataSyncMockClient({
			get: mockGet,
		} as unknown as Partial<Record<string, unknown>>);
		const orchestrator = new SyncOrchestrator({
			client,
			outputDir: "output",
			manifestPath: "output/.sync-manifest.json",
		});

		const result = await orchestrator.runDataSync();

		expect(result.status).toBe("success");
		expect(result.courseId).toBeNull();
		expect(result.noUpcomingCourse).toBe(true);
		expect(result.participantsFetched).toBe(0);
		expect(result.filesGenerated).toBe(0);
		expect(result.filesSkipped).toBe(0);
	});

	it("handles Hemera API errors gracefully", async () => {
		const mockGet = vi.fn().mockRejectedValueOnce(new Error("Hemera API unavailable"));

		const client = createDataSyncMockClient({
			get: mockGet,
		} as unknown as Partial<Record<string, unknown>>);
		const orchestrator = new SyncOrchestrator({
			client,
			outputDir: "output",
			manifestPath: "output/.sync-manifest.json",
		});

		const result = await orchestrator.runDataSync();

		expect(result.status).toBe("failed");
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0].message).toContain("Hemera API unavailable");
	});

	it("emits structured Rollbar info log after successful sync", async () => {
		const coursesResponse = {
			success: true,
			data: [futureCourse],
			meta: { requestId: "req-3", timestamp: NOW.toISOString(), version: "1.0" },
		};

		const mockGet = vi
			.fn()
			.mockResolvedValueOnce(coursesResponse)
			.mockResolvedValueOnce(courseDetailResponse);

		const client = createDataSyncMockClient({
			get: mockGet,
		} as unknown as Partial<Record<string, unknown>>);
		const orchestrator = new SyncOrchestrator({
			client,
			outputDir: "output",
			manifestPath: "output/.sync-manifest.json",
		});

		await orchestrator.runDataSync();

		expect(mockRollbar.info).toHaveBeenCalledWith(
			"sync.completed",
			expect.objectContaining({
				courseId: "cm5abc123",
				participantsFetched: 2,
				filesGenerated: 1,
				noUpcomingCourse: false,
			}),
		);
	});
});

// ---------------------------------------------------------------------------
// Incremental Sync (T015, US2) — content hash comparison
// ---------------------------------------------------------------------------

describe("SyncOrchestrator.runDataSync — Incremental (US2)", () => {
	const NOW = new Date("2026-03-01T12:00:00.000Z");

	beforeEach(() => {
		vi.clearAllMocks(); // prevent mock leakage from run() describe
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		vi.mocked(readManifest).mockResolvedValue({ lastSyncTime: "", hashes: {} });
		vi.mocked(writeManifest).mockResolvedValue(undefined);
		vi.mocked(computeContentHash).mockReturnValue("sha256:newHash123");
		vi.mocked(writeHtmlFile).mockResolvedValue(undefined);
		vi.mocked(populateTemplate).mockReturnValue("<html>mocked</html>");
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function buildSyncClient(coursesResponse: unknown, detailResponse: unknown): HemeraClient {
		const mockGet = vi
			.fn()
			.mockResolvedValueOnce(coursesResponse)
			.mockResolvedValueOnce(detailResponse);
		return createDataSyncMockClient({
			get: mockGet,
		} as unknown as Partial<Record<string, unknown>>);
	}

	const coursesResponse = {
		success: true,
		data: [futureCourse],
		meta: { requestId: "req-inc", timestamp: NOW.toISOString(), version: "1.0" },
	};

	it("skips regeneration when content hash matches manifest", async () => {
		// Manifest already has the same hash
		vi.mocked(readManifest).mockResolvedValue({
			lastSyncTime: "2026-02-28T12:00:00.000Z",
			hashes: { "courses:cm5abc123": "sha256:newHash123" },
		});

		const client = buildSyncClient(coursesResponse, courseDetailResponse);
		const orchestrator = new SyncOrchestrator({
			client,
			outputDir: "output",
			manifestPath: "output/.sync-manifest.json",
		});

		const result = await orchestrator.runDataSync();

		expect(result.status).toBe("success");
		expect(result.filesGenerated).toBe(0);
		expect(result.filesSkipped).toBe(1);
		expect(writeHtmlFile).not.toHaveBeenCalled();
	});

	it("triggers regeneration when content hash differs from manifest", async () => {
		// Manifest has a different hash
		vi.mocked(readManifest).mockResolvedValue({
			lastSyncTime: "2026-02-28T12:00:00.000Z",
			hashes: { "courses:cm5abc123": "sha256:oldHash999" },
		});

		const client = buildSyncClient(coursesResponse, courseDetailResponse);
		const orchestrator = new SyncOrchestrator({
			client,
			outputDir: "output",
			manifestPath: "output/.sync-manifest.json",
		});

		const result = await orchestrator.runDataSync();

		expect(result.status).toBe("success");
		expect(result.filesGenerated).toBe(1);
		expect(result.filesSkipped).toBe(0);
		expect(writeHtmlFile).toHaveBeenCalled();
	});

	it("triggers full regeneration on missing manifest", async () => {
		// readManifest returns empty (file doesn't exist)
		vi.mocked(readManifest).mockResolvedValue({ lastSyncTime: "", hashes: {} });

		const client = buildSyncClient(coursesResponse, courseDetailResponse);
		const orchestrator = new SyncOrchestrator({
			client,
			outputDir: "output",
			manifestPath: "output/.sync-manifest.json",
		});

		const result = await orchestrator.runDataSync();

		expect(result.status).toBe("success");
		expect(result.filesGenerated).toBe(1);
		expect(result.filesSkipped).toBe(0);
	});

	it("updates manifest after successful generation", async () => {
		const client = buildSyncClient(coursesResponse, courseDetailResponse);
		const orchestrator = new SyncOrchestrator({
			client,
			outputDir: "output",
			manifestPath: "output/.sync-manifest.json",
		});

		await orchestrator.runDataSync();

		expect(writeManifest).toHaveBeenCalledWith(
			"output/.sync-manifest.json",
			expect.objectContaining({
				hashes: expect.objectContaining({
					"courses:cm5abc123": "sha256:newHash123",
				}),
			}),
		);
	});

	it("handles corrupted manifest with Rollbar warning and full regeneration", async () => {
		// readManifest throws on corrupted JSON
		vi.mocked(readManifest).mockRejectedValue(new SyntaxError("Unexpected token"));

		const client = buildSyncClient(coursesResponse, courseDetailResponse);
		const orchestrator = new SyncOrchestrator({
			client,
			outputDir: "output",
			manifestPath: "output/.sync-manifest.json",
		});

		const result = await orchestrator.runDataSync();

		expect(result.status).toBe("success");
		expect(result.filesGenerated).toBe(1);
		expect(mockRollbar.warning).toHaveBeenCalled();
	});

	it("triggers regeneration when participant preparation data changes", async () => {
		// Same course, but preparation data changed (different hash)
		vi.mocked(readManifest).mockResolvedValue({
			lastSyncTime: "2026-02-28T12:00:00.000Z",
			hashes: { "courses:cm5abc123": "sha256:oldPreparationHash" },
		});

		const client = buildSyncClient(coursesResponse, courseDetailResponse);
		const orchestrator = new SyncOrchestrator({
			client,
			outputDir: "output",
			manifestPath: "output/.sync-manifest.json",
		});

		const result = await orchestrator.runDataSync();

		expect(result.filesGenerated).toBe(1);
		expect(result.filesSkipped).toBe(0);
	});
});
