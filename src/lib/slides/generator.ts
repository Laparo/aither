// ---------------------------------------------------------------------------
// Slide Generation — Generator Orchestrator
// Task: T007 (file writer), T009 (lesson fetching), T012 (material fetching),
//       T016 (full pipeline orchestrator)
// ---------------------------------------------------------------------------

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { HemeraClient } from "@/lib/hemera/client";
import {
	LessonsResponseSchema,
	MediaAssetsResponseSchema,
	TextContentsResponseSchema,
} from "@/lib/hemera/schemas";
import { getNextCourse } from "./course-resolver";
import {
	buildCurriculumSlide,
	buildImageSlide,
	buildIntroSlide,
	buildTextSlide,
	buildVideoSlide,
} from "./slide-builder";
import type { GeneratedSlide, SlideGenerationResult } from "./types";

export interface SlideGeneratorOptions {
	client: HemeraClient;
	outputDir: string;
}

/**
 * Orchestrates the full slide generation pipeline:
 * 1. Clear output directory
 * 2. Resolve next upcoming course
 * 3. Generate intro slide
 * 4. Fetch and generate curriculum slides
 * 5. Fetch and generate material slides
 * 6. Return result with slide count
 */
export class SlideGenerator {
	private readonly client: HemeraClient;
	private readonly outputDir: string;

	constructor(options: SlideGeneratorOptions) {
		this.client = options.client;
		this.outputDir = options.outputDir;
	}

	/**
	 * Runs the full slide generation pipeline.
	 *
	 * @returns Result with slide count, course info, and slide metadata
	 */
	async generate(): Promise<SlideGenerationResult> {
		const slides: GeneratedSlide[] = [];

		// Step 1: Resolve next course (needed before preparing directory)
		const seminar = await getNextCourse(this.client);

		// Step 2: Clear and prepare course-specific output directory
		const courseOutputDir = path.join(this.outputDir, seminar.sourceId);
		await this.clearDir(courseOutputDir);

		// Step 3: Generate intro slide
		const introHtml = buildIntroSlide(seminar);
		const introFilename = "01_intro.html";
		await this.writeSlide(courseOutputDir, introFilename, introHtml);
		slides.push({ filename: introFilename, type: "intro", title: seminar.title });

		// Step 4: Fetch lessons, filter by seminarId, sort by sequence
		const allLessons = await this.client.get("/lessons", LessonsResponseSchema);
		const courseLessons = allLessons
			.filter((l) => l.seminarId === seminar.sourceId)
			.sort((a, b) => a.sequence - b.sequence);

		// Step 5: Generate curriculum slides
		for (const lesson of courseLessons) {
			const html = buildCurriculumSlide(lesson);
			const filename = `02_curriculum_${lesson.sequence}.html`;
			await this.writeSlide(courseOutputDir, filename, html);
			slides.push({ filename, type: "curriculum", title: lesson.title });
		}

		// Step 6: Fetch texts and media, generate material slides
		const allTexts = await this.client.get("/texts", TextContentsResponseSchema);
		const allMedia = await this.client.get("/media", MediaAssetsResponseSchema);

		for (const lesson of courseLessons) {
			const lessonTexts = allTexts.filter(
				(t) => t.entityRef.type === "lesson" && t.entityRef.id === lesson.sourceId,
			);
			const lessonMedia = allMedia.filter(
				(m) => m.entityRef.type === "lesson" && m.entityRef.id === lesson.sourceId,
			);

			let materialIdx = 1;

			for (const text of lessonTexts) {
				const html = buildTextSlide(text);
				const filename = `03_material_${lesson.sequence}_${materialIdx}.html`;
				await this.writeSlide(courseOutputDir, filename, html);
				slides.push({ filename, type: "material", title: "Text Content" });
				materialIdx++;
			}

			for (const media of lessonMedia) {
				const html = media.mediaType === "image" ? buildImageSlide(media) : buildVideoSlide(media);
				const filename = `03_material_${lesson.sequence}_${materialIdx}.html`;
				await this.writeSlide(courseOutputDir, filename, html);
				slides.push({ filename, type: "material", title: media.altText ?? media.mediaType });
				materialIdx++;
			}
		}

		return {
			slidesGenerated: slides.length,
			courseTitle: seminar.title,
			courseId: seminar.sourceId,
			slides,
		};
	}

	/**
	 * Clears the given directory. Creates it if it does not exist.
	 */
	private async clearDir(dir: string): Promise<void> {
		await fs.rm(dir, { recursive: true, force: true });
		await fs.mkdir(dir, { recursive: true });
	}

	/**
	 * Writes a single slide HTML file to the given directory.
	 */
	private async writeSlide(dir: string, filename: string, html: string): Promise<void> {
		await fs.writeFile(path.join(dir, filename), html, "utf-8");
	}
}
