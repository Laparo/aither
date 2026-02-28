// ---------------------------------------------------------------------------
// Template Engine — Placeholder Parsing & Replacement
// Tasks: T009 (parsePlaceholders), T013 (replaceScalars), T015 (replaceCollection)
// Spec: 006-participant-slides / US1, US2, US3
// ---------------------------------------------------------------------------

import type { ParsedPlaceholder } from "@/lib/slides/types";
import { escapeHtml } from "@/lib/slides/utils";

/**
 * Regex for `{key}` or `{collection:field}` placeholders.
 *
 * Matches: `{courseTitle}`, `{participant:name}`
 * Rejects: CSS `{ color: red; }`, nested `{a:{b}}`
 *
 * The pattern requires the first character after `{` to be a letter,
 * followed by alphanumeric characters, with an optional `:field` suffix.
 */
const PLACEHOLDER_RE = /{([a-zA-Z][a-zA-Z0-9]*(?::[a-zA-Z][a-zA-Z0-9]*)?)}/g;

/**
 * Extract all `{key}` and `{collection:field}` placeholders from HTML.
 *
 * - Deduplicates by raw string
 * - Classifies as scalar (no colon) or collection (has colon)
 * - Ignores CSS declarations and nested braces
 *
 * @param html  Raw HTML string to scan
 * @returns     Deduplicated array of parsed placeholders
 */
export function parsePlaceholders(html: string): ParsedPlaceholder[] {
	const seen = new Set<string>();
	const results: ParsedPlaceholder[] = [];

	for (const match of html.matchAll(PLACEHOLDER_RE)) {
		const raw = match[0];
		const inner = match[1];

		if (seen.has(raw)) continue;
		seen.add(raw);

		const colonIndex = inner.indexOf(":");
		if (colonIndex === -1) {
			results.push({ raw, type: "scalar", key: inner });
		} else {
			results.push({
				raw,
				type: "collection",
				key: inner.slice(0, colonIndex),
				field: inner.slice(colonIndex + 1),
			});
		}
	}

	return results;
}

/**
 * Replace scalar `{key}` placeholders with values from the given map.
 *
 * - HTML-escapes all replaced values
 * - Unknown keys are left unchanged
 * - Values are pre-mapped (null → em-dash by buildSlideContext)
 *
 * @param html     HTML string containing scalar placeholders
 * @param scalars  Key-value map from SlideContext.scalars
 * @returns        HTML with scalar placeholders replaced
 */
export function replaceScalars(html: string, scalars: Record<string, string>): string {
	return html.replace(PLACEHOLDER_RE, (fullMatch, inner: string) => {
		// Skip collection placeholders (contain colon)
		if (inner.includes(":")) return fullMatch;

		const value = scalars[inner];
		if (value === undefined) return fullMatch;

		return escapeHtml(value);
	});
}

/**
 * Iterate a collection over a section, producing one HTML string per record.
 *
 * For each record in the collection:
 *   1. Replace `{collectionName:field}` with the record's field value
 *   2. Replace scalar placeholders via `replaceScalars()`
 *
 * Non-matching collection types (e.g., `{instructor:name}` when processing
 * `participant`) are left unchanged.
 *
 * @param sectionHtml     Section body HTML
 * @param collectionName  The collection type to iterate (e.g., "participant")
 * @param records         Array of flat key-value records
 * @param scalars         Scalar context for mixed placeholder replacement
 * @returns               One HTML string per record
 */
export function replaceCollection(
	sectionHtml: string,
	collectionName: string,
	records: Record<string, string>[],
	scalars: Record<string, string> = {},
): string[] {
	return records.map((record) => {
		// First replace collection-specific placeholders
		const withCollection = sectionHtml.replace(PLACEHOLDER_RE, (fullMatch, inner: string) => {
			const colonIndex = inner.indexOf(":");
			if (colonIndex === -1) return fullMatch; // scalar — handled next

			const key = inner.slice(0, colonIndex);
			const field = inner.slice(colonIndex + 1);

			if (key !== collectionName) return fullMatch; // different collection

			const value = record[field];
			if (value === undefined) return fullMatch;

			return escapeHtml(value);
		});

		// Then replace any remaining scalar placeholders
		return replaceScalars(withCollection, scalars);
	});
}
