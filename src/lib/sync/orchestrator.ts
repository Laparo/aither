// ---------------------------------------------------------------------------
// Sync Job Orchestrator
// Task: T026 [US1] — Fetch → hash compare → populate → write → update manifest
// ---------------------------------------------------------------------------

import type { HemeraClient } from "@/lib/hemera/client";
import {
	HtmlTemplatesResponseSchema,
	LessonsResponseSchema,
	MediaAssetsResponseSchema,
	SeminarsResponseSchema,
	TextContentsResponseSchema,
	UserProfilesResponseSchema,
} from "@/lib/hemera/schemas";
import type {
	HtmlTemplate,
	Lesson,
	MediaAsset,
	Seminar,
	TextContent,
	UserProfile,
} from "@/lib/hemera/types";
import { populateTemplate } from "@/lib/html/populator";
import { cleanOrphans, writeHtmlFile } from "@/lib/html/writer";
import { v4 as uuidv4 } from "uuid";
import { computeContentHash, diffManifest, readManifest, writeManifest } from "./hash-manifest";
import type { SyncJob } from "./types";

export interface SyncOrchestratorOptions {
	client: HemeraClient;
	outputDir: string;
	manifestPath: string;
}

interface FetchedData {
	templates: HtmlTemplate[];
	seminars: Seminar[];
	lessons: Lesson[];
	users: UserProfile[];
	texts: TextContent[];
	media: MediaAsset[];
}

/**
 * Orchestrates the entire sync pipeline:
 * 1. Fetch all entities from the hemera.academy API
 * 2. Match templates to entities
 * 3. Compute hashes & compare with manifest
 * 4. Populate only changed templates → write HTML
 * 5. Clean up orphans
 * 6. Update manifest
 */
export class SyncOrchestrator {
	private readonly client: HemeraClient;
	private readonly outputDir: string;
	private readonly manifestPath: string;

	constructor(options: SyncOrchestratorOptions) {
		this.client = options.client;
		this.outputDir = options.outputDir;
		this.manifestPath = options.manifestPath;
	}

	/**
	 * Starts the full sync process (fetch → hash → populate → write → manifest).
	 *
	 * @returns SyncJob object with status and errors
	 */
	async run(): Promise<SyncJob> {
		const job: SyncJob = {
			jobId: uuidv4(),
			startTime: new Date().toISOString(),
			endTime: null,
			status: "running",
			recordsFetched: 0,
			htmlFilesGenerated: 0,
			htmlFilesSkipped: 0,
			recordsTransmitted: 0,
			errors: [],
		};

		try {
			// 1. Fetch all data
			const data = await this.fetchAll(job);
			job.recordsFetched =
				data.templates.length +
				data.seminars.length +
				data.lessons.length +
				data.users.length +
				data.texts.length +
				data.media.length;

			// If templates fetch failed, abort
			if (data.templates.length === 0 && job.errors.some((e) => e.entity === "templates")) {
				job.status = "failed";
				job.endTime = new Date().toISOString();
				return job;
			}

			// 2. Read existing manifest
			const oldManifest = await readManifest(this.manifestPath);

			// 3. Build entity→data mapping and compute hashes
			const newHashes: Record<string, string> = {};
			const entityData: Map<
				string,
				{ template: HtmlTemplate; data: Record<string, unknown>; entityType: string }
			> = new Map();

			// Build lookup maps
			const textsMap = this.groupByEntityRef(data.texts);
			const mediaMap = this.groupByEntityRef(data.media);
			const lessonsMap = new Map(data.lessons.map((l) => [l.sourceId, l]));
			const usersMap = new Map(data.users.map((u) => [u.sourceId, u]));

			// Match templates to seminars
			for (const template of data.templates) {
				if (template.seminarId && !template.lessonId) {
					const seminar = data.seminars.find((s) => s.sourceId === template.seminarId);
					if (!seminar) continue;

					const key = `seminar:${seminar.sourceId}`;
					const populationData = this.buildSeminarData(
						seminar,
						data.lessons,
						usersMap,
						textsMap,
						mediaMap,
					);
					newHashes[key] = computeContentHash(template.markup, populationData);
					entityData.set(key, { template, data: populationData, entityType: "seminars" });
				}

				if (template.lessonId) {
					const lesson = lessonsMap.get(template.lessonId);
					if (!lesson) continue;

					const key = `lesson:${lesson.sourceId}`;
					const populationData = this.buildLessonData(lesson, textsMap, mediaMap);
					newHashes[key] = computeContentHash(template.markup, populationData);
					entityData.set(key, { template, data: populationData, entityType: "lessons" });
				}
			}

			// 4. Diff manifest
			const diff = diffManifest(oldManifest, newHashes);

			// 5. Generate HTML for changed entities only
			for (const key of diff.changed) {
				const entry = entityData.get(key);
				if (!entry) continue;

				try {
					const html = populateTemplate(entry.template.markup, entry.data);
					const entityId = key.split(":")[1];
					await writeHtmlFile(this.outputDir, entry.entityType, entityId, html);
					job.htmlFilesGenerated++;
				} catch (err) {
					job.errors.push({
						entity: key,
						message: err instanceof Error ? err.message : String(err),
						timestamp: new Date().toISOString(),
					});
				}
			}

			job.htmlFilesSkipped = diff.unchanged.length;

			// 6. Clean orphans
			const seminarIds = new Set(data.seminars.map((s) => s.sourceId));
			const lessonIds = new Set(data.lessons.map((l) => l.sourceId));
			await cleanOrphans(this.outputDir, "seminars", seminarIds);
			await cleanOrphans(this.outputDir, "lessons", lessonIds);

			// 7. Update manifest
			await writeManifest(this.manifestPath, {
				lastSyncTime: new Date().toISOString(),
				hashes: newHashes,
			});

			job.status = "success";
		} catch (err) {
			job.status = "failed";
			job.errors.push({
				entity: "sync",
				message: err instanceof Error ? err.message : String(err),
				timestamp: new Date().toISOString(),
			});
		}

		job.endTime = new Date().toISOString();
		return job;
	}

	private async fetchAll(job: SyncJob): Promise<FetchedData> {
		const data: FetchedData = {
			templates: [],
			seminars: [],
			lessons: [],
			users: [],
			texts: [],
			media: [],
		};

		const fetches: Array<{ key: keyof FetchedData; path: string; schema: unknown }> = [
			{ key: "templates", path: "/templates", schema: HtmlTemplatesResponseSchema },
			{ key: "seminars", path: "/seminars", schema: SeminarsResponseSchema },
			{ key: "lessons", path: "/lessons", schema: LessonsResponseSchema },
			{ key: "users", path: "/users", schema: UserProfilesResponseSchema },
			{ key: "texts", path: "/texts", schema: TextContentsResponseSchema },
			{ key: "media", path: "/media", schema: MediaAssetsResponseSchema },
		];

		for (const { key, path, schema } of fetches) {
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(data as any)[key] = await this.client.get(path, schema as any);
			} catch (err) {
				job.errors.push({
					entity: key,
					message: err instanceof Error ? err.message : String(err),
					timestamp: new Date().toISOString(),
				});
			}
		}

		return data;
	}

	private buildSeminarData(
		seminar: Seminar,
		lessons: Lesson[],
		usersMap: Map<string, UserProfile>,
		textsMap: Map<string, TextContent[]>,
		mediaMap: Map<string, MediaAsset[]>,
	): Record<string, unknown> {
		const seminarLessons = lessons.filter((l) => l.seminarId === seminar.sourceId);
		const instructors = seminar.instructorIds.map((id) => usersMap.get(id)).filter(Boolean);

		return {
			...seminar,
			lessons: seminarLessons,
			instructors,
			texts: textsMap.get(`seminar:${seminar.sourceId}`) ?? [],
			media: mediaMap.get(`seminar:${seminar.sourceId}`) ?? [],
		};
	}

	private buildLessonData(
		lesson: Lesson,
		textsMap: Map<string, TextContent[]>,
		mediaMap: Map<string, MediaAsset[]>,
	): Record<string, unknown> {
		return {
			...lesson,
			texts: textsMap.get(`lesson:${lesson.sourceId}`) ?? [],
			media: mediaMap.get(`lesson:${lesson.sourceId}`) ?? [],
		};
	}

	private groupByEntityRef<T extends { entityRef: { type: string; id: string } }>(
		items: T[],
	): Map<string, T[]> {
		const map = new Map<string, T[]>();
		for (const item of items) {
			const key = `${item.entityRef.type}:${item.entityRef.id}`;
			const existing = map.get(key) ?? [];
			existing.push(item);
			map.set(key, existing);
		}
		return map;
	}
}
