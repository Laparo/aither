// ---------------------------------------------------------------------------
// Identifier Distributor — Mode B Slide Generation
// Task: T019
// Spec: 006-participant-slides / US7
// ---------------------------------------------------------------------------

import { serverInstance } from "@/lib/monitoring/rollbar-official";
import { replaceCollection } from "@/lib/slides/template-engine";
import type { CollectionRecord, DistributedSlide } from "@/lib/slides/types";

/**
 * Sanitise an identifier for safe use in filenames.
 * Strips everything except lowercase letters, digits, and hyphens.
 *
 * @throws Error if the sanitised result is empty
 */
export function sanitizeIdentifier(raw: string): string {
	const safe = raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
	if (safe.length === 0) {
		throw new Error(`Identifier "${raw}" produces an empty filename after sanitisation`);
	}
	return safe;
}

/**
 * Distribute a template across collection records, producing one slide per record.
 *
 * Each slide gets:
 * - A zero-padded sequential filename: `{identifier}-{nn}.html`
 * - HTML with both scalar and collection placeholders replaced
 *
 * Logs a Rollbar warning when the number of records does not match the
 * expected instance count (1:1 invariant for Mode B).
 *
 * @param template              Raw HTML template content
 * @param identifier            Material identifier for filename generation
 * @param collectionName        Collection type (e.g., "participant")
 * @param records               Array of flat key-value records to distribute
 * @param scalars               Scalar context for mixed placeholder replacement
 * @param expectedInstanceCount Optional expected count (curriculumLinkCount) for invariant check
 * @returns                     Array of DistributedSlide objects
 */
export function distributeByIdentifier(
	template: string,
	identifier: string,
	collectionName: string,
	records: CollectionRecord[],
	scalars: Record<string, string>,
	expectedInstanceCount?: number,
): DistributedSlide[] {
	if (records.length === 0) return [];

	const safeId = sanitizeIdentifier(identifier);

	if (expectedInstanceCount !== undefined && expectedInstanceCount !== records.length) {
		serverInstance.warning(
			`1:1 invariant mismatch for "${identifier}": expected ${expectedInstanceCount} instances, got ${records.length} records`,
			{ identifier, expectedInstanceCount, actualCount: records.length },
		);
	}

	const padWidth = Math.max(2, String(records.length).length);

	return records.map((record, index) => {
		// Use replaceCollection for a single record to get the HTML
		const [html] = replaceCollection(template, collectionName, [record], scalars);

		const paddedIndex = String(index + 1).padStart(padWidth, "0");

		return {
			filename: `${safeId}-${paddedIndex}.html`,
			html,
			participantIndex: index,
			identifier,
		};
	});
}
