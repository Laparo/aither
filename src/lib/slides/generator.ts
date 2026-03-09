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
	ServiceMaterialsResponseSchema,
	TextContentsResponseSchema,
} from "@/lib/hemera/schemas";
import { serverInstance } from "@/lib/monitoring/rollbar-official";
import { getNextCourse, getNextCourseWithParticipants } from "./course-resolver";
import { wrapInLayout } from "./html-layout";
import { distributeByIdentifier } from "./identifier-distributor";
import { detectMode, groupMaterialsByMaterialId } from "./mode-detector";
import { parseSections } from "./section-parser";
import {
	buildCurriculumSlide,
	buildImageSlide,
	buildIntroSlide,
	buildTextSlide,
	buildVideoSlide,
} from "./slide-builder";
import { buildSlideContext } from "./slide-context";
import { parsePlaceholders, replaceCollection, replaceScalars } from "./template-engine";
import type { GeneratedSlide, SlideGenerationEvent, SlideGenerationResult } from "./types";

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
		const startMs = Date.now();
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

		// Step 7: Materials pipeline — fetch via Service API, detect mode, process templates
		const event: SlideGenerationEvent = {
			event: "slides.generated",
			courseId: seminar.sourceId,
			totalSlides: 0,
			materialSlides: 0,
			skippedSections: 0,
			modeACount: 0,
			modeBCount: 0,
			durationMs: 0,
			errors: [],
		};

		let templateSlideCount = 0;

		try {
			const courseDetail = await getNextCourseWithParticipants(this.client);

			if (courseDetail) {
				event.courseId = courseDetail.id;
				const context = buildSlideContext(courseDetail);
				const materialsResp = await this.client.get(
					`/api/service/courses/${courseDetail.id}/materials`,
					ServiceMaterialsResponseSchema,
				);

				const grouped = groupMaterialsByMaterialId(materialsResp.data.topics);

				for (const [, material] of grouped) {
					if (material.htmlContent === null) {
						event.skippedSections++;
						serverInstance.warning(
							`Skipping material "${material.identifier}" — null htmlContent`,
							{ materialId: material.materialId },
						);
						continue;
					}

					const placeholders = parsePlaceholders(material.htmlContent);
					const hasCollection = placeholders.some((p) => p.type === "collection");
					const mode = detectMode(
						material.htmlContent,
						material.curriculumLinkCount,
						hasCollection,
					);

					if (mode === "identifier-distribution") {
						// Mode B: distribute template across participants
						const collectionName =
							placeholders.find((p) => p.type === "collection")?.key ?? "participant";
						const records = context.collections[collectionName] ?? [];
						const distributed = distributeByIdentifier(
							material.htmlContent,
							material.identifier,
							collectionName,
							records,
							context.scalars,
							material.curriculumLinkCount,
						);
						for (const dist of distributed) {
							const wrapped = wrapInLayout(material.title, dist.html);
							await this.writeSlide(courseOutputDir, dist.filename, wrapped);
							slides.push({
								filename: dist.filename,
								type: "material",
								title: material.title,
							});
							templateSlideCount++;
						}
						event.modeBCount++;
					} else if (mode === "section-iteration") {
						// Mode A: iterate sections × participants
						const sections = parseSections(material.htmlContent);
						for (const section of sections) {
							const collectionName = section.collections.keys().next().value ?? "participant";
							const records = context.collections[collectionName] ?? [];

							if (records.length === 0 && section.collections.size > 0) {
								// No records for this collection — skip to avoid unreplaced placeholders
								event.skippedSections++;
								serverInstance.warning(
									`Skipping section ${section.index} of "${material.identifier}" — 0 records for "${collectionName}"`,
									{ materialId: material.materialId, collectionName },
								);
								continue;
							}

							if (records.length > 0 && section.collections.size > 0) {
								const rendered = replaceCollection(
									section.body,
									collectionName,
									records,
									context.scalars,
								);
								const padWidth = Math.max(2, String(rendered.length).length);
								for (let ri = 0; ri < rendered.length; ri++) {
									const paddedIdx = String(ri + 1).padStart(padWidth, "0");
									const filename = `03_material_t${material.materialId}_s${section.index}_p${paddedIdx}.html`;
									const wrapped = wrapInLayout(material.title, rendered[ri]);
									await this.writeSlide(courseOutputDir, filename, wrapped);
									slides.push({
										filename,
										type: "material",
										title: material.title,
									});
									templateSlideCount++;
								}
							} else {
								// Scalar-only section: apply scalars only
								const rendered = replaceScalars(section.body, context.scalars);
								const filename = `03_material_t${material.materialId}_s${section.index}.html`;
								const wrapped = wrapInLayout(material.title, rendered);
								await this.writeSlide(courseOutputDir, filename, wrapped);
								slides.push({
									filename,
									type: "material",
									title: material.title,
								});
								templateSlideCount++;
							}
						}
						event.modeACount++;
					} else {
						// scalar-only: single output file
						const rendered = replaceScalars(material.htmlContent, context.scalars);
						const filename = `03_material_t${material.materialId}.html`;
						const wrapped = wrapInLayout(material.title, rendered);
						await this.writeSlide(courseOutputDir, filename, wrapped);
						slides.push({
							filename,
							type: "material",
							title: material.title,
						});
						templateSlideCount++;
					}
				}

				event.materialSlides = templateSlideCount;
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			event.errors.push(msg);
			serverInstance.warning("Materials pipeline failed — continuing with legacy slides", {
				error: msg,
			});
		}

		event.totalSlides = slides.length;
		event.durationMs = Date.now() - startMs;
		serverInstance.info("Slide generation complete", event);

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
	 * Validates that the resolved path stays inside the target directory.
	 */
	private async writeSlide(dir: string, filename: string, html: string): Promise<void> {
		const resolved = path.resolve(dir, filename);
		if (!resolved.startsWith(path.resolve(dir) + path.sep) && resolved !== path.resolve(dir)) {
			throw new Error(`Path traversal detected: "${filename}" escapes output directory`);
		}
		await fs.writeFile(resolved, html, "utf-8");
	}
}
