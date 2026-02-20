// ---------------------------------------------------------------------------
// Recording File Manager
// Task: T008 [P] — List recordings from disk, delete, get metadata via
//                  fs.stat, get duration via ffprobe, filename parsing
// ---------------------------------------------------------------------------

import { execFile } from "node:child_process";
import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { loadConfig } from "@/lib/config";
import type { RecordingFile } from "./types";

const execFileAsync = promisify(execFile);

/** Pattern for valid recording filenames: rec_YYYY-MM-DDTHH-MM-SSZ.mp4 */
const FILENAME_PATTERN = /^rec_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})Z\.mp4$/;

function getOutputDir(): string {
	try {
		const config = loadConfig();
		return config.RECORDINGS_OUTPUT_DIR;
	} catch {
		return "output/recordings";
	}
}

/**
 * Parse a recording filename into its ID and ISO timestamp.
 * Returns null if the filename doesn't match the expected pattern.
 */
export function parseFilename(filename: string): { id: string; createdAt: string } | null {
	const match = FILENAME_PATTERN.exec(filename);
	if (!match) return null;

	const rawTimestamp = match[1];
	// Convert rec_ timestamp format back to ISO 8601
	// rec_2026-02-19T10-30-00Z → 2026-02-19T10:30:00Z
	const isoTimestamp = `${rawTimestamp.replace(/-(\d{2})-(\d{2})$/, ":$1:$2")}Z`;

	return {
		id: `rec_${rawTimestamp}Z`,
		createdAt: isoTimestamp,
	};
}

/**
 * Get the duration of an MP4 file in seconds using FFprobe.
 */
export async function getDuration(filePath: string): Promise<number> {
	try {
		const { stdout } = await execFileAsync(
			"ffprobe",
			[
				"-v",
				"quiet",
				"-show_entries",
				"format=duration",
				"-of",
				"default=noprint_wrappers=1:nokey=1",
				filePath,
			],
			{ timeout: 5000 },
		);
		const duration = Number.parseFloat(stdout.trim());
		return Number.isNaN(duration) ? 0 : duration;
	} catch {
		return 0;
	}
}

/**
 * List all valid recordings from the output directory.
 * Returns recordings sorted by creation date descending (newest first).
 */
export async function listRecordings(): Promise<RecordingFile[]> {
	const outputDir = getOutputDir();

	let entries: string[];
	try {
		entries = await readdir(outputDir);
	} catch {
		// Directory doesn't exist or can't be read
		return [];
	}

	const recordings: RecordingFile[] = [];

	for (const entry of entries) {
		const parsed = parseFilename(entry);
		if (!parsed) continue;

		const filePath = join(outputDir, entry);
		try {
			const stats = await stat(filePath);
			if (!stats.isFile()) continue;

			const duration = await getDuration(filePath);

			recordings.push({
				id: parsed.id,
				filename: entry,
				duration,
				fileSize: stats.size,
				createdAt: parsed.createdAt,
				filePath,
			});
		} catch {}
	}

	// Sort by creation date descending (newest first)
	recordings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

	return recordings;
}

/**
 * Get a single recording by its ID.
 * Returns null if not found.
 */
export async function getRecordingById(id: string): Promise<RecordingFile | null> {
	const recordings = await listRecordings();
	return recordings.find((r) => r.id === id) ?? null;
}

/**
 * Delete a recording file by its ID.
 * Returns true if deleted, false if not found.
 */
export async function deleteRecording(id: string): Promise<boolean> {
	const recording = await getRecordingById(id);
	if (!recording) return false;

	try {
		await unlink(recording.filePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Resolve the absolute file path for a recording ID.
 * Returns null if the recording doesn't exist.
 */
export async function resolveFilePath(id: string): Promise<string | null> {
	const recording = await getRecordingById(id);
	return recording?.filePath ?? null;
}
