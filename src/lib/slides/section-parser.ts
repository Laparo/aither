// ---------------------------------------------------------------------------
// Section Parser — <section class="slide"> Extraction
// Task: T011
// Spec: 006-participant-slides / US1
// ---------------------------------------------------------------------------

import { parsePlaceholders } from "@/lib/slides/template-engine";
import type { TemplateSection } from "@/lib/slides/types";

/**
 * Regex to match `<section class="slide" ...>` opening tags.
 * Allows additional attributes and whitespace variations.
 */
const SECTION_OPEN_RE = /<section\s[^>]*class="slide"[^>]*>/gi;

/**
 * Regex to extract `<section class="slide" ...>...</section>` blocks
 * with their inner content. Uses a non-greedy match so that consecutive
 * sections are extracted individually.
 */
const SECTION_RE = /<section\s[^>]*class="slide"[^>]*>([\s\S]*?)<\/section>/gi;

/**
 * Check whether the HTML contains any `<section class="slide">` tags.
 *
 * @param html  Raw HTML string
 * @returns     `true` if at least one slide section tag is found
 */
export function hasSectionTags(html: string): boolean {
	SECTION_OPEN_RE.lastIndex = 0;
	return SECTION_OPEN_RE.test(html);
}

/**
 * Parse HTML into TemplateSection objects.
 *
 * - If `<section class="slide">` tags are present, extracts each block
 * - If no section tags found, wraps the entire HTML as one implicit section
 * - Each section is annotated with classified placeholder info
 *
 * @param html  Raw HTML string (full material page)
 * @returns     Array of TemplateSection objects in document order
 */
export function parseSections(html: string): TemplateSection[] {
	// Reset regex lastIndex since we use the `g` flag
	SECTION_RE.lastIndex = 0;
	SECTION_OPEN_RE.lastIndex = 0;

	if (!hasSectionTags(html)) {
		// Implicit section: the entire HTML is a single section
		return [buildSection(html, 0)];
	}

	// Reset after hasSectionTags consumed the regex
	SECTION_RE.lastIndex = 0;

	const sections: TemplateSection[] = [];
	let match: RegExpExecArray | null;
	let index = 0;

	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop pattern
	while ((match = SECTION_RE.exec(html)) !== null) {
		const body = match[1];
		sections.push(buildSection(body, index));
		index++;
	}

	return sections;
}

/**
 * Build a TemplateSection from extracted body HTML.
 * Classifies placeholders into scalars and collections.
 */
function buildSection(body: string, index: number): TemplateSection {
	const placeholders = parsePlaceholders(body);

	const scalars: string[] = [];
	const collections = new Map<string, string[]>();

	for (const p of placeholders) {
		if (p.type === "scalar") {
			scalars.push(p.key);
		} else if (p.field) {
			const existing = collections.get(p.key) ?? [];
			existing.push(p.field);
			collections.set(p.key, existing);
		}
	}

	return { body, scalars, collections, index };
}
