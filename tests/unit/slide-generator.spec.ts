// ---------------------------------------------------------------------------
// Unit Tests: Slide Generator Orchestrator
// Task: T015 [US4] — Full pipeline test
// ---------------------------------------------------------------------------

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
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
	} as any;
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
		} as any;

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
		expect(intro!.filename).toBe("01_intro.html");

		const materials = result.slides.filter((s) => s.type === "material");
		expect(materials.length).toBe(2);
	});
});
