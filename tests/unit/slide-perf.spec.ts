// ---------------------------------------------------------------------------
// Performance Benchmark: Slide Generation with 20 participants + 10 materials
// Task: T029 — Plan target: < 5s
// ---------------------------------------------------------------------------

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { HemeraClient } from "@/lib/hemera/client";
import type { ServiceMaterialsResponse } from "@/lib/hemera/schemas";
import type { Lesson, Seminar } from "@/lib/hemera/types";
import { SlideGenerator } from "@/lib/slides/generator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tomorrow = new Date(Date.now() + 86400000).toISOString();
const dayAfter = new Date(Date.now() + 172800000).toISOString();

// 20 participants
const participants = Array.from({ length: 20 }, (_, i) => ({
	participationId: `p-${i + 1}`,
	userId: `u-${i + 1}`,
	name: `Teilnehmer ${i + 1}`,
	status: "CONFIRMED" as const,
	preparationIntent: `Ziel ${i + 1}`,
	desiredResults: `Ergebnis ${i + 1}`,
	lineManagerProfile: `Profil ${i + 1}`,
	preparationCompletedAt: i % 2 === 0 ? "2025-01-10T10:00:00Z" : null,
}));

const mockSeminar: Seminar = {
	sourceId: "perf-sem",
	title: "Perf Test Kurs",
	description: null,
	dates: [{ start: tomorrow, end: dayAfter }],
	instructorIds: [],
	lessonIds: ["les-1"],
	recordingUrl: null,
};

const mockLessons: Lesson[] = [
	{
		sourceId: "les-1",
		seminarId: "perf-sem",
		title: "Lektion 1",
		sequence: 1,
		textContentIds: [],
		mediaAssetIds: [],
	},
];

// 10 materials: 5 Mode A (section-based), 3 Mode B (multi-linked), 2 scalar-only
function buildMaterials(): ServiceMaterialsResponse {
	const materials: ServiceMaterialsResponse["data"]["topics"] = [];

	// 5 Mode A materials (section-based)
	for (let i = 0; i < 5; i++) {
		materials.push({
			topicId: `topic-a-${i}`,
			topicTitle: `Mode A Topic ${i}`,
			materials: [
				{
					materialId: `mat-a-${i}`,
					identifier: `section-sheet-${i}`,
					title: `Vorbereitungsbogen ${i}`,
					sortOrder: i,
					htmlContent: `<section class="slide"><h1>{courseTitle} - Abschnitt ${i}</h1><p>Name: {participant:name}</p><p>Ziel: {participant:preparationIntent}</p></section>`,
				},
			],
		});
	}

	// 3 Mode B materials (multi-linked across 2 topics)
	for (let i = 0; i < 3; i++) {
		materials.push({
			topicId: `topic-b1-${i}`,
			topicTitle: `Mode B Topic ${i} Day 1`,
			materials: [
				{
					materialId: `mat-b-${i}`,
					identifier: `video-analysis-${i}`,
					title: `Videoanalyse ${i}`,
					sortOrder: i,
					htmlContent: `<div><h1>{courseTitle}</h1><p>{participant:name} - Analyse ${i}</p></div>`,
				},
			],
		});
		materials.push({
			topicId: `topic-b2-${i}`,
			topicTitle: `Mode B Topic ${i} Day 2`,
			materials: [
				{
					materialId: `mat-b-${i}`,
					identifier: `video-analysis-${i}`,
					title: `Videoanalyse ${i}`,
					sortOrder: i,
					htmlContent: `<div><h1>{courseTitle}</h1><p>{participant:name} - Analyse ${i}</p></div>`,
				},
			],
		});
	}

	// 2 scalar-only materials
	for (let i = 0; i < 2; i++) {
		materials.push({
			topicId: `topic-s-${i}`,
			topicTitle: `Scalar Topic ${i}`,
			materials: [
				{
					materialId: `mat-s-${i}`,
					identifier: `agenda-${i}`,
					title: `Agenda ${i}`,
					sortOrder: i,
					htmlContent: "<h1>{courseTitle}</h1><p>Level: {courseLevel}</p>",
				},
			],
		});
	}

	return {
		success: true,
		data: {
			courseId: "perf-course",
			topics: materials,
		},
	};
}

function createPerfClient() {
	const materialsResp = buildMaterials();
	return {
		get: vi.fn().mockImplementation((p: string) => {
			if (p === "/seminars") return Promise.resolve([mockSeminar]);
			if (p === "/lessons") return Promise.resolve(mockLessons);
			if (p === "/texts") return Promise.resolve([]);
			if (p === "/media") return Promise.resolve([]);
			if (p === "/api/service/courses") {
				return Promise.resolve({
					success: true,
					data: [
						{
							id: "perf-course",
							title: "Perf Test Kurs",
							slug: "perf-test-kurs",
							level: "ADVANCED",
							startDate: tomorrow,
							endDate: dayAfter,
							participantCount: 20,
						},
					],
					meta: { requestId: "r-perf", timestamp: new Date().toISOString(), version: "1.0" },
				});
			}
			if (p === "/api/service/courses/perf-course") {
				return Promise.resolve({
					success: true,
					data: {
						id: "perf-course",
						title: "Perf Test Kurs",
						slug: "perf-test-kurs",
						level: "ADVANCED",
						startDate: tomorrow,
						endDate: dayAfter,
						participants,
					},
				});
			}
			if (p === "/api/service/courses/perf-course/materials") {
				return Promise.resolve(materialsResp);
			}
			return Promise.resolve([]);
		}),
		put: vi.fn(),
	} as unknown as HemeraClient;
}

describe("Performance: Slide Generation", () => {
	let outputDir: string;

	beforeEach(async () => {
		outputDir = path.join(os.tmpdir(), `slide-perf-${Date.now()}`);
		await fs.mkdir(outputDir, { recursive: true });
	});

	afterEach(async () => {
		await fs.rm(outputDir, { recursive: true, force: true });
	});

	it("generates slides for 20 participants + 10 materials in < 5s", async () => {
		const client = createPerfClient();
		const generator = new SlideGenerator({ client, outputDir });

		const start = performance.now();
		const result = await generator.generate();
		const elapsed = performance.now() - start;

		// Verify slides were generated
		// 1 intro + 1 curriculum + 0 legacy material + template materials
		// Mode A: 5 materials × 1 section × 20 participants = 100
		// Mode B: 3 materials × 20 distributed = 60
		// Scalar: 2 materials × 1 = 2
		// Total template: 162 + 1 intro + 1 curriculum = 164
		expect(result.slidesGenerated).toBe(164);

		// Performance budget: < 5 seconds
		expect(elapsed).toBeLessThan(5000);
	});
});
