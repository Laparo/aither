// ---------------------------------------------------------------------------
// Identifier Distributor — Mode B Slide Generation
// Task: T019
// Spec: 006-participant-slides / US7
// ---------------------------------------------------------------------------

import { replaceCollection } from "@/lib/slides/template-engine";
import type { CollectionRecord, DistributedSlide } from "@/lib/slides/types";

/**
 * Distribute a template across collection records, producing one slide per record.
 *
 * Each slide gets:
 * - A zero-padded sequential filename: `{identifier}-{nn}.html`
 * - HTML with both scalar and collection placeholders replaced
 *
 * @param template        Raw HTML template content
 * @param identifier      Material identifier for filename generation
 * @param collectionName  Collection type (e.g., "participant")
 * @param records         Array of flat key-value records to distribute
 * @param scalars         Scalar context for mixed placeholder replacement
 * @returns               Array of DistributedSlide objects
 */
export function distributeByIdentifier(
	template: string,
	identifier: string,
	collectionName: string,
	records: CollectionRecord[],
	scalars: Record<string, string>,
): DistributedSlide[] {
	if (records.length === 0) return [];

	const padWidth = Math.max(2, String(records.length).length);

	return records.map((record, index) => {
		// Use replaceCollection for a single record to get the HTML
		const [html] = replaceCollection(template, collectionName, [record], scalars);

		const paddedIndex = String(index + 1).padStart(padWidth, "0");

		return {
			filename: `${identifier}-${paddedIndex}.html`,
			html,
			participantIndex: index,
			identifier,
		};
	});
}
