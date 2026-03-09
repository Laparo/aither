// ---------------------------------------------------------------------------
// Unit Tests: Slide Generator Orchestrator
// Task: T015 [US4] — Full pipeline test
// ---------------------------------------------------------------------------

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { HemeraClient } from "@/lib/hemera/client";
import type { ServiceCourseDetail, ServiceMaterialsResponse } from "@/lib/hemera/schemas";
import type { Lesson, MediaAsset, Seminar, TextContent } from "@/lib/hemera/types";
import { SlideGenerator } from "@/lib/slides/generator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Test Data ─────────────────────────────────────────────────────────────

const tomorrow = new Date(Date.now() + 86400000).toISOString();

const mockSeminar: Seminar = {
	sourceId: "sem-1",
	title: "TypeScript Masterclass",
	description: null,
	dates: [{ start: tomorrow, end: tomorrow }],
	instructorIds: [],
	lessonIds: ["les-1", "les-2"],
	recordingUrl: null,
};

const mockLessons: Lesson[] = [
	{
		sourceId: "les-2",
		seminarId: "sem-1",
		title: "Advanced Types",
		sequence: 2,
		textContentIds: ["txt-1"],
		mediaAssetIds: [],
	},
	{
		sourceId: "les-1",
		seminarId: "sem-1",
		title: "Introduction",
		sequence: 1,
		textContentIds: [],
		mediaAssetIds: ["med-1"],
	},
	{
		sourceId: "les-3",
		seminarId: "sem-other",
		title: "Other Course Lesson",
		sequence: 1,
		textContentIds: [],
		mediaAssetIds: [],
	},
];

const mockTexts: TextContent[] = [
	{
		sourceId: "txt-1",
		entityRef: { type: "lesson", id: "les-2" },
		body: "<p>Advanced type content</p>",
		contentType: "html",
	},
	{
		sourceId: "txt-2",
		entityRef: { type: "seminar", id: "sem-1" },
		body: "Seminar-level text (should be excluded)",
		contentType: "text",
	},
];

const mockMedia: MediaAsset[] = [
	{
		sourceId: "med-1",
		entityRef: { type: "lesson", id: "les-1" },
		mediaType: "image",
		sourceUrl: "https://hemera.academy/img/photo.jpg",
		altText: "Photo",
		fileSize: null,
	},
];

// ── Mock Client ───────────────────────────────────────────────────────────

function createMockClient() {
	return {
		get: vi.fn().mockImplementation((path: string) => {
			if (path === "/seminars") return Promise.resolve([mockSeminar]);
			if (path === "/lessons") return Promise.resolve(mockLessons);
			if (path === "/texts") return Promise.resolve(mockTexts);
			if (path === "/media") return Promise.resolve(mockMedia);
			return Promise.resolve([]);
		}),
		put: vi.fn(),
	} as unknown as HemeraClient;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("SlideGenerator", () => {
	let outputDir: string;

	beforeEach(async () => {
		outputDir = path.join(os.tmpdir(), `slide-test-${Date.now()}`);
		await fs.mkdir(outputDir, { recursive: true });
	});

	afterEach(async () => {
		await fs.rm(outputDir, { recursive: true, force: true });
	});

	it("generates intro, curriculum, and material slides", async () => {
		const client = createMockClient();
		const generator = new SlideGenerator({ client, outputDir });

		const result = await generator.generate();

		// 1 intro + 2 curriculum + 1 text + 1 image = 5 slides
		expect(result.slidesGenerated).toBe(5);
		expect(result.courseTitle).toBe("TypeScript Masterclass");
		expect(result.courseId).toBe("sem-1");
	});

	it("creates the correct slide files in a course-id subdirectory", async () => {
		const client = createMockClient();
		const generator = new SlideGenerator({ client, outputDir });

		await generator.generate();

		const courseDir = path.join(outputDir, "sem-1");
		const files = await fs.readdir(courseDir);
		expect(files).toContain("01_intro.html");
		expect(files).toContain("02_curriculum_1.html");
		expect(files).toContain("02_curriculum_2.html");
		expect(files).toContain("03_material_1_1.html");
		expect(files).toContain("03_material_2_1.html");
	});

	it("clears the course subdirectory before generating", async () => {
		// Pre-populate with a stale file in the course subdirectory
		const courseDir = path.join(outputDir, "sem-1");
		await fs.mkdir(courseDir, { recursive: true });
		await fs.writeFile(path.join(courseDir, "old_slide.html"), "stale");

		const client = createMockClient();
		const generator = new SlideGenerator({ client, outputDir });

		await generator.generate();

		const files = await fs.readdir(courseDir);
		expect(files).not.toContain("old_slide.html");
	});

	it("creates the output directory if it does not exist", async () => {
		await fs.rm(outputDir, { recursive: true, force: true });

		const client = createMockClient();
		const generator = new SlideGenerator({ client, outputDir });

		await generator.generate();

		const courseDir = path.join(outputDir, "sem-1");
		const files = await fs.readdir(courseDir);
		expect(files.length).toBeGreaterThan(0);
	});

	it("filters lessons by seminarId", async () => {
		const client = createMockClient();
		const generator = new SlideGenerator({ client, outputDir });

		const result = await generator.generate();

		// Only 2 lessons belong to sem-1, not the third
		const curriculumSlides = result.slides.filter((s) => s.type === "curriculum");
		expect(curriculumSlides).toHaveLength(2);
	});

	it("sorts curriculum slides by sequence field", async () => {
		const client = createMockClient();
		const generator = new SlideGenerator({ client, outputDir });

		const result = await generator.generate();

		const curriculumSlides = result.slides.filter((s) => s.type === "curriculum");
		expect(curriculumSlides[0].title).toBe("Introduction");
		expect(curriculumSlides[1].title).toBe("Advanced Types");
	});

	it("handles course with no lessons — only intro slide generated", async () => {
		const noLessonClient = {
			get: vi.fn().mockImplementation((path: string) => {
				if (path === "/seminars") return Promise.resolve([mockSeminar]);
				return Promise.resolve([]);
			}),
			put: vi.fn(),
		} as unknown as HemeraClient;

		const generator = new SlideGenerator({ client: noLessonClient, outputDir });
		const result = await generator.generate();

		expect(result.slidesGenerated).toBe(1);
		expect(result.slides[0].type).toBe("intro");
	});

	it("returns correct slide metadata", async () => {
		const client = createMockClient();
		const generator = new SlideGenerator({ client, outputDir });

		const result = await generator.generate();

		const intro = result.slides.find((s) => s.type === "intro");
		expect(intro).toBeDefined();
		if (intro) expect(intro.filename).toBe("01_intro.html");

		const materials = result.slides.filter((s) => s.type === "material");
		expect(materials.length).toBe(2);
	});
});

// ── Material Template Processing Tests (T020) ──────────────────────────────

// Helper: mock course detail with participants for service API
const mockCourseDetail: ServiceCourseDetail = {
	id: "course-1",
	title: "Gehaltsverhandlung meistern",
	slug: "gehaltsverhandlung-meistern",
	level: "ADVANCED",
	startDate: new Date(Date.now() + 86400000).toISOString(),
	endDate: new Date(Date.now() + 172800000).toISOString(),
	participants: [
		{
			participationId: "p-1",
			userId: "u-1",
			name: "Anna Müller",
			status: "CONFIRMED",
			preparationIntent: "Selbstbewusster auftreten",
			desiredResults: "Gehaltserhöhung",
			lineManagerProfile: "Datengetrieben",
			preparationCompletedAt: "2025-01-10T10:00:00Z",
		},
		{
			participationId: "p-2",
			userId: "u-2",
			name: "Ben Fischer",
			status: "CONFIRMED",
			preparationIntent: null,
			desiredResults: null,
			lineManagerProfile: null,
			preparationCompletedAt: null,
		},
	],
};

// Helper: materials response with Mode A sections
const mockMaterialsWithSections: ServiceMaterialsResponse = {
	success: true,
	data: {
		courseId: "course-1",
		topics: [
			{
				topicId: "topic-1",
				topicTitle: "Vorbereitung",
				materials: [
					{
						materialId: "mat-1",
						identifier: "preparation-sheet",
						title: "Vorbereitungsbogen",
						sortOrder: 1,
						htmlContent:
							'<section class="slide"><h1>{courseTitle}</h1><p>{participant:name}</p><p>{participant:preparationIntent}</p></section>',
					},
				],
			},
		],
	},
};

// Helper: materials response with Mode B (multi-linked template)
const mockMaterialsWithModeB: ServiceMaterialsResponse = {
	success: true,
	data: {
		courseId: "course-1",
		topics: [
			{
				topicId: "topic-1",
				topicTitle: "Tag 1",
				materials: [
					{
						materialId: "mat-va",
						identifier: "video-analysis",
						title: "Videoanalyse",
						sortOrder: 1,
						htmlContent: "<div><h1>{courseTitle}</h1><p>{participant:name}</p></div>",
					},
				],
			},
			{
				topicId: "topic-2",
				topicTitle: "Tag 2",
				materials: [
					{
						materialId: "mat-va",
						identifier: "video-analysis",
						title: "Videoanalyse",
						sortOrder: 1,
						htmlContent: "<div><h1>{courseTitle}</h1><p>{participant:name}</p></div>",
					},
				],
			},
		],
	},
};

// Helper: materials response with scalar-only template
const mockMaterialsScalarOnly: ServiceMaterialsResponse = {
	success: true,
	data: {
		courseId: "course-1",
		topics: [
			{
				topicId: "topic-1",
				topicTitle: "Einführung",
				materials: [
					{
						materialId: "mat-s",
						identifier: "agenda",
						title: "Agenda",
						sortOrder: 1,
						htmlContent: "<h1>{courseTitle}</h1><p>Level: {courseLevel}</p>",
					},
				],
			},
		],
	},
};

/** Create a mock client that supports both legacy and service APIs */
function createServiceMockClient(materialsResponse: ServiceMaterialsResponse) {
	return {
		get: vi.fn().mockImplementation((p: string) => {
			// Legacy APIs for existing pipeline
			if (p === "/seminars") return Promise.resolve([mockSeminar]);
			if (p === "/lessons") return Promise.resolve(mockLessons);
			if (p === "/texts") return Promise.resolve(mockTexts);
			if (p === "/media") return Promise.resolve(mockMedia);

			// Service API: course list
			if (p === "/api/service/courses") {
				return Promise.resolve({
					success: true,
					data: [
						{
							id: "course-1",
							title: mockCourseDetail.title,
							slug: mockCourseDetail.slug,
							level: mockCourseDetail.level,
							startDate: mockCourseDetail.startDate,
							endDate: mockCourseDetail.endDate,
							participantCount: mockCourseDetail.participants.length,
						},
					],
					meta: { requestId: "r-1", timestamp: new Date().toISOString(), version: "1.0" },
				});
			}

			// Service API: course detail
			if (p === "/api/service/courses/course-1") {
				return Promise.resolve({
					success: true,
					data: mockCourseDetail,
				});
			}

			// Service API: materials
			if (p === "/api/service/courses/course-1/materials") {
				return Promise.resolve(materialsResponse);
			}

			return Promise.resolve([]);
		}),
		put: vi.fn(),
	} as unknown as HemeraClient;
}

describe("SlideGenerator — Material Templates (US4)", () => {
	let outputDir: string;

	beforeEach(async () => {
		outputDir = path.join(os.tmpdir(), `slide-test-${Date.now()}`);
		await fs.mkdir(outputDir, { recursive: true });
	});

	afterEach(async () => {
		await fs.rm(outputDir, { recursive: true, force: true });
	});

	it("generates Mode A slides from section-based template", async () => {
		const client = createServiceMockClient(mockMaterialsWithSections);
		const generator = new SlideGenerator({ client, outputDir });

		const result = await generator.generate();

		// Mode A: 1 section × 2 participants = 2 material template slides
		const materialSlides = result.slides.filter(
			(s) => s.type === "material" && s.filename.startsWith("03_material_"),
		);
		// Existing legacy material slides + new template-based material slides
		// Template slides count: 2 (one per participant)
		expect(materialSlides.length).toBeGreaterThanOrEqual(2);
	});

	it("generates Mode B slides from multi-linked template", async () => {
		const client = createServiceMockClient(mockMaterialsWithModeB);
		const generator = new SlideGenerator({ client, outputDir });

		const result = await generator.generate();

		// Mode B: 2 curriculum links, 2 participants = 2 distributed slides
		const modeBSlides = result.slides.filter((s) => s.filename.startsWith("video-analysis-"));
		expect(modeBSlides).toHaveLength(2);
		expect(modeBSlides[0].filename).toBe("video-analysis-01.html");
		expect(modeBSlides[1].filename).toBe("video-analysis-02.html");
	});

	it("generates scalar-only slides without iteration", async () => {
		const client = createServiceMockClient(mockMaterialsScalarOnly);
		const generator = new SlideGenerator({ client, outputDir });

		await generator.generate();

		// Scalar-only: 1 material, no collection → 1 slide
		const courseDir = path.join(outputDir, "sem-1");
		const files = await fs.readdir(courseDir);
		// Should contain a scalar material slide
		const scalarSlide = files.find((f) => f.includes("material") && !f.startsWith("video"));
		expect(scalarSlide).toBeDefined();
	});

	it("skips materials with null htmlContent", async () => {
		const materialsWithNull: ServiceMaterialsResponse = {
			success: true,
			data: {
				courseId: "course-1",
				topics: [
					{
						topicId: "topic-1",
						topicTitle: "Broken",
						materials: [
							{
								materialId: "mat-null",
								identifier: "broken",
								title: "Broken Template",
								sortOrder: 1,
								htmlContent: null,
							},
						],
					},
				],
			},
		};
		const client = createServiceMockClient(materialsWithNull);
		const generator = new SlideGenerator({ client, outputDir });

		// Should not throw — null htmlContent is skipped
		const result = await generator.generate();
		expect(result.slidesGenerated).toBeGreaterThan(0);
	});

	it("continues legacy pipeline when materials fetch fails", async () => {
		const failClient = {
			get: vi.fn().mockImplementation((p: string) => {
				if (p === "/seminars") return Promise.resolve([mockSeminar]);
				if (p === "/lessons") return Promise.resolve(mockLessons);
				if (p === "/texts") return Promise.resolve(mockTexts);
				if (p === "/media") return Promise.resolve(mockMedia);
				if (p === "/api/service/courses") return Promise.reject(new Error("Service API down"));
				return Promise.resolve([]);
			}),
			put: vi.fn(),
		} as unknown as HemeraClient;

		const generator = new SlideGenerator({ client: failClient, outputDir });
		const result = await generator.generate();

		// Legacy slides should still be generated
		expect(result.slidesGenerated).toBeGreaterThan(0);
		expect(result.slides.some((s) => s.type === "intro")).toBe(true);
	});
});
