// ---------------------------------------------------------------------------
// Unit Tests: Mode Detector — detectMode, groupMaterialsByIdentifier
// Contract: specs/006-participant-slides/contracts/mode-detection.contract.ts
// Constitution: §I Test-First, §III Contract-First
// ---------------------------------------------------------------------------

import { detectMode, groupMaterialsByIdentifier } from "@/lib/slides/mode-detector";
import type { MaterialWithLinks } from "@/lib/slides/types";
import { describe, expect, it } from "vitest";

// --- detectMode (US7 — T016) ---

describe("detectMode", () => {
	it('returns section-iteration when <section class="slide"> tags are present', () => {
		const html = '<section class="slide"><p>{participant:name}</p></section>';
		expect(detectMode(html, 1, true)).toBe("section-iteration");
	});

	it("returns section-iteration even when link count > 1 if section tags exist", () => {
		const html = '<section class="slide"><p>{participant:name}</p></section>';
		expect(detectMode(html, 5, true)).toBe("section-iteration");
	});

	it("returns identifier-distribution for multi-linked template without sections", () => {
		const html = "<div>{participant:name}</div>";
		expect(detectMode(html, 3, true)).toBe("identifier-distribution");
	});

	it("returns scalar-only for multi-linked template without collection placeholders", () => {
		const html = "<div>{courseTitle}</div>";
		expect(detectMode(html, 3, false)).toBe("scalar-only");
	});

	it("returns section-iteration for single-linked template with collection placeholders", () => {
		const html = "<div>{participant:name}</div>";
		expect(detectMode(html, 1, true)).toBe("section-iteration");
	});

	it("returns scalar-only when no collection placeholders and no sections", () => {
		const html = "<div>{courseTitle}</div>";
		expect(detectMode(html, 1, false)).toBe("scalar-only");
	});

	it("returns section-iteration for section-based template even without collection placeholders", () => {
		const html = '<section class="slide"><h1>{courseTitle}</h1></section>';
		expect(detectMode(html, 1, false)).toBe("section-iteration");
	});
});

// --- groupMaterialsByIdentifier (US7 — T016) ---

describe("groupMaterialsByIdentifier", () => {
	it("groups materials that appear in multiple topics", () => {
		const topics = [
			{
				topicId: "topic-1",
				materials: [
					{
						materialId: "mat-1",
						identifier: "video-analysis",
						title: "VA",
						sortOrder: 1,
						htmlContent: "<div>Template</div>",
					},
				],
			},
			{
				topicId: "topic-2",
				materials: [
					{
						materialId: "mat-1",
						identifier: "video-analysis",
						title: "VA",
						sortOrder: 1,
						htmlContent: "<div>Template</div>",
					},
				],
			},
			{
				topicId: "topic-3",
				materials: [
					{
						materialId: "mat-1",
						identifier: "video-analysis",
						title: "VA",
						sortOrder: 1,
						htmlContent: "<div>Template</div>",
					},
				],
			},
		];

		const result = groupMaterialsByIdentifier(topics);

		expect(result.size).toBe(1);
		const entry = result.get("mat-1") as MaterialWithLinks;
		expect(entry.materialId).toBe("mat-1");
		expect(entry.identifier).toBe("video-analysis");
		expect(entry.curriculumLinkCount).toBe(3);
		expect(entry.htmlContent).toBe("<div>Template</div>");
	});

	it("keeps single-linked materials separate", () => {
		const topics = [
			{
				topicId: "topic-1",
				materials: [
					{
						materialId: "mat-1",
						identifier: "intro",
						title: "Intro",
						sortOrder: 1,
						htmlContent: "<p>Intro</p>",
					},
					{
						materialId: "mat-2",
						identifier: "video-analysis",
						title: "VA",
						sortOrder: 2,
						htmlContent: "<div>VA</div>",
					},
				],
			},
		];

		const result = groupMaterialsByIdentifier(topics);

		expect(result.size).toBe(2);
		expect(result.get("mat-1")?.curriculumLinkCount).toBe(1);
		expect(result.get("mat-2")?.curriculumLinkCount).toBe(1);
	});

	it("handles materials with null htmlContent", () => {
		const topics = [
			{
				topicId: "topic-1",
				materials: [
					{
						materialId: "mat-1",
						identifier: "broken",
						title: "Broken",
						sortOrder: 1,
						htmlContent: null,
					},
				],
			},
		];

		const result = groupMaterialsByIdentifier(topics);

		expect(result.size).toBe(1);
		expect(result.get("mat-1")?.htmlContent).toBeNull();
	});

	it("returns empty map for empty topics", () => {
		const topics: Array<{ topicId: string; materials: never[] }> = [];
		const result = groupMaterialsByIdentifier(topics);

		expect(result.size).toBe(0);
	});
});
