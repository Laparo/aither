// ---------------------------------------------------------------------------
// Atomic HTML File Writer
// Task: T025 [US1] — tmp+rename, mkdir -p, orphan cleanup
// ---------------------------------------------------------------------------

import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Write an HTML file atomically: write to .tmp, then rename.
 * Creates the target directory if it doesn't exist.
 *
 * @param outputDir - Root output directory (e.g., "output")
 * @param entityType - Subdirectory name (e.g., "seminars", "lessons")
 * @param entityId - Entity source ID (used as filename, without extension)
 * @param content - HTML content to write
 */
export async function writeHtmlFile(
	outputDir: string,
	entityType: string,
	entityId: string,
	content: string,
): Promise<void> {
	const dir = path.join(outputDir, entityType);
	await fs.mkdir(dir, { recursive: true });

	const filePath = path.join(dir, `${entityId}.html`);
	const tmpPath = `${filePath}.tmp`;

	await fs.writeFile(tmpPath, content, "utf-8");
	await fs.rename(tmpPath, filePath);
}

/**
 * Remove HTML files for entities no longer present in the active IDs set.
 *
 * @param outputDir - Root output directory
 * @param entityType - Subdirectory name
 * @param activeIds - Set of entity IDs that should be kept
 * @returns Array of deleted entity IDs
 */
export async function cleanOrphans(
	outputDir: string,
	entityType: string,
	activeIds: Set<string>,
): Promise<string[]> {
	const dir = path.join(outputDir, entityType);
	const deleted: string[] = [];

	let files: string[];
	try {
		files = await fs.readdir(dir);
	} catch {
		// Directory doesn't exist — nothing to clean
		return deleted;
	}

	for (const file of files) {
		if (!file.endsWith(".html")) continue;
		const entityId = file.replace(/\.html$/, "");
		if (!activeIds.has(entityId)) {
			await fs.unlink(path.join(dir, file));
			deleted.push(entityId);
		}
	}

	return deleted;
}
