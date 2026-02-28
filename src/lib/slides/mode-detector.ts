// ---------------------------------------------------------------------------
// Mode Detector — Automatic Mode A / Mode B / Scalar-Only Detection
// Task: T017
// Spec: 006-participant-slides / US4, US7
// ---------------------------------------------------------------------------

import { hasSectionTags } from "@/lib/slides/section-parser";
import type { MaterialWithLinks, ReplacementMode } from "@/lib/slides/types";

/**
 * Input type for a single material within a topic (used by groupMaterialsByIdentifier).
 */
interface TopicMaterial {
	materialId: string;
	identifier: string;
	title: string;
	sortOrder: number;
	htmlContent: string | null;
}

/**
 * Input type for a single curriculum topic with its materials.
 */
interface TopicWithMaterials {
	topicId: string;
	materials: TopicMaterial[];
}

/**
 * Determine the replacement mode for a material template.
 *
 * Decision tree (three-step):
 * 1. If `<section class="slide">` tags are present → Mode A (section-iteration)
 * 2. If linkCount > 1 AND hasCollectionPlaceholders → Mode B (identifier-distribution)
 * 3. If hasCollectionPlaceholders → Mode A (implicit section)
 * 4. Otherwise → scalar-only
 *
 * @param htmlContent                The material's HTML content
 * @param curriculumLinkCount        How many times this materialId appears across topics
 * @param hasCollectionPlaceholders  Whether the HTML contains collection `{obj:field}` placeholders
 * @returns                          The detected replacement mode
 */
export function detectMode(
	htmlContent: string,
	curriculumLinkCount: number,
	hasCollectionPlaceholders: boolean,
): ReplacementMode {
	// Rule #1: Section tags present → always Mode A
	if (hasSectionTags(htmlContent)) {
		return "section-iteration";
	}

	// Rule #2: Multi-linked + collection placeholders → Mode B
	if (curriculumLinkCount > 1 && hasCollectionPlaceholders) {
		return "identifier-distribution";
	}

	// Rule #3: Single-linked + collection placeholders → Mode A (implicit section)
	if (hasCollectionPlaceholders) {
		return "section-iteration";
	}

	// Rule #4: No collection placeholders → scalar-only
	return "scalar-only";
}

/**
 * Group materials by materialId across all curriculum topics.
 *
 * Each unique materialId produces one `MaterialWithLinks` entry with
 * `curriculumLinkCount` reflecting how many topics reference it.
 *
 * @param topics  Array of curriculum topics with their materials
 * @returns       Map from materialId to MaterialWithLinks
 */
export function groupMaterialsByMaterialId(
	topics: TopicWithMaterials[],
): Map<string, MaterialWithLinks> {
	const result = new Map<string, MaterialWithLinks>();

	for (const topic of topics) {
		for (const mat of topic.materials) {
			const existing = result.get(mat.materialId);
			if (existing) {
				existing.curriculumLinkCount++;
			} else {
				result.set(mat.materialId, {
					materialId: mat.materialId,
					identifier: mat.identifier,
					title: mat.title,
					htmlContent: mat.htmlContent,
					curriculumLinkCount: 1,
				});
			}
		}
	}

	return result;
}
