// ---------------------------------------------------------------------------
// Unit Tests: Slide Builder
// Task: T004 [US1] — intro slide, T008 [US2] — curriculum slide,
//       T011 [US3] — material slides (text, image, video)
// ---------------------------------------------------------------------------

import type { Lesson, MediaAsset, Seminar, TextContent } from "@/lib/hemera/types";
import {
	buildCurriculumSlide,
	buildImageSlide,
	buildIntroSlide,
	buildTextSlide,
	buildVideoSlide,
} from "@/lib/slides/slide-builder";
import { describe, expect, it } from "vitest";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeSeminar(overrides: Partial<Seminar> = {}): Seminar {
	return {
		sourceId: "sem-1",
		title: "TypeScript Masterclass",
		description: null,
		dates: [{ start: "2026-03-15T09:00:00+01:00", end: "2026-03-17T17:00:00+01:00" }],
		instructorIds: [],
		lessonIds: [],
		recordingUrl: null,
		...overrides,
	};
}

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
	return {
		sourceId: "les-1",
		seminarId: "sem-1",
		title: "Introduction to Types",
		sequence: 1,
		textContentIds: [],
		mediaAssetIds: [],
		...overrides,
	};
}

function makeText(overrides: Partial<TextContent> = {}): TextContent {
	return {
		sourceId: "txt-1",
		entityRef: { type: "lesson", id: "les-1" },
		body: "<p>Hello World</p>",
		contentType: "html",
		...overrides,
	};
}

function makeMedia(overrides: Partial<MediaAsset> = {}): MediaAsset {
	return {
		sourceId: "med-1",
		entityRef: { type: "lesson", id: "les-1" },
		mediaType: "image",
		sourceUrl: "https://hemera.academy/images/photo.jpg",
		altText: "A photo",
		fileSize: null,
		...overrides,
	};
}

// ── T004: Intro Slide ─────────────────────────────────────────────────────

describe("buildIntroSlide", () => {
	it("contains the course name centered", () => {
		const html = buildIntroSlide(makeSeminar());

		expect(html).toContain("TypeScript Masterclass");
		expect(html).toContain("slide-content");
	});

	it("formats start date in de-CH locale", () => {
		const html = buildIntroSlide(makeSeminar());

		// de-CH format: "15. März 2026" or similar
		expect(html).toMatch(/15\.\s*März\s*2026/);
	});

	it("shows end date when different from start date", () => {
		const html = buildIntroSlide(makeSeminar());

		// Should contain both dates
		expect(html).toMatch(/15\.\s*März\s*2026/);
		expect(html).toMatch(/17\.\s*März\s*2026/);
	});

	it("hides end date when same day as start date", () => {
		const seminar = makeSeminar({
			dates: [{ start: "2026-03-15T09:00:00+01:00", end: "2026-03-15T17:00:00+01:00" }],
		});
		const html = buildIntroSlide(seminar);

		// Should contain the date only once (no duplicate)
		const dateMatches = html.match(/15\.\s*März\s*2026/g);
		expect(dateMatches).toHaveLength(1);
	});

	it("wraps content in the 1920×1080 HTML layout", () => {
		const html = buildIntroSlide(makeSeminar());

		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("width: 1920px");
		expect(html).toContain("height: 1080px");
	});
});

// ── T008: Curriculum Slide ────────────────────────────────────────────────

describe("buildCurriculumSlide", () => {
	it("contains the lesson title centered", () => {
		const html = buildCurriculumSlide(makeLesson());

		expect(html).toContain("Introduction to Types");
		expect(html).toContain("slide-content");
	});

	it("wraps content in the 1920×1080 HTML layout", () => {
		const html = buildCurriculumSlide(makeLesson());

		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("width: 1920px");
		expect(html).toContain("height: 1080px");
	});
});

// ── T011: Material Slides ─────────────────────────────────────────────────

describe("buildTextSlide", () => {
	it("renders the text body as HTML centered", () => {
		const html = buildTextSlide(makeText());

		expect(html).toContain("<p>Hello World</p>");
		expect(html).toContain("slide-content");
	});

	it("wraps content in the 1920×1080 HTML layout", () => {
		const html = buildTextSlide(makeText());

		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("width: 1920px");
	});
});

describe("buildImageSlide", () => {
	it("renders an <img> tag with src and alt", () => {
		const html = buildImageSlide(makeMedia());

		expect(html).toContain("<img");
		expect(html).toContain('src="https://hemera.academy/images/photo.jpg"');
		expect(html).toContain('alt="A photo"');
	});

	it("handles null altText gracefully", () => {
		const media = makeMedia({ altText: null });
		const html = buildImageSlide(media);

		expect(html).toContain("<img");
		expect(html).toContain('alt=""');
	});

	it("wraps content in the 1920×1080 HTML layout", () => {
		const html = buildImageSlide(makeMedia());

		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("width: 1920px");
	});
});

describe("buildVideoSlide", () => {
	it("renders a <video> tag with controls", () => {
		const media = makeMedia({
			mediaType: "video",
			sourceUrl: "https://hemera.academy/videos/intro.mp4",
		});
		const html = buildVideoSlide(media);

		expect(html).toContain("<video");
		expect(html).toContain("controls");
		expect(html).toContain('src="https://hemera.academy/videos/intro.mp4"');
	});

	it("wraps content in the 1920×1080 HTML layout", () => {
		const media = makeMedia({
			mediaType: "video",
			sourceUrl: "https://hemera.academy/videos/intro.mp4",
		});
		const html = buildVideoSlide(media);

		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("width: 1920px");
	});
});
