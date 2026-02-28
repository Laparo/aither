// ---------------------------------------------------------------------------
// Slide Generation — Slide Context Builder
// Task: T007 [US6] — Transform ServiceCourseDetail into SlideContext
// ---------------------------------------------------------------------------

import type { ServiceCourseDetail } from "@/lib/hemera/schemas";
import type { CollectionRecord, SlideContext } from "./types";

/** Em-dash character used for null/undefined values. */
const EM_DASH = "—";

/**
 * Transforms a ServiceCourseDetail into a SlideContext for the template engine.
 *
 * Scalars: courseTitle, courseSlug, courseLevel, courseStartDate, courseEndDate,
 *          participantCount
 * Collections: participant (name, status, preparationIntent, desiredResults,
 *              lineManagerProfile, preparationCompleted)
 *
 * Null values are replaced with em-dash "—". preparationCompleted is derived
 * from preparationCompletedAt (non-null → "Ja", null → "—").
 *
 * @param detail Course detail with participants from Hemera Service API
 * @returns SlideContext ready for template engine
 */
export function buildSlideContext(detail: ServiceCourseDetail): SlideContext {
	const scalars: Record<string, string> = {
		courseTitle: detail.title,
		courseSlug: detail.slug,
		courseLevel: detail.level,
		courseStartDate: detail.startDate ?? EM_DASH,
		courseEndDate: detail.endDate ?? EM_DASH,
		participantCount: String(detail.participants.length),
	};

	const participants: CollectionRecord[] = detail.participants.map((p) => ({
		name: p.name ?? EM_DASH,
		status: p.status,
		preparationIntent: p.preparationIntent ?? EM_DASH,
		desiredResults: p.desiredResults ?? EM_DASH,
		lineManagerProfile: p.lineManagerProfile ?? EM_DASH,
		preparationCompleted: p.preparationCompletedAt != null ? "Ja" : EM_DASH,
	}));

	return {
		scalars,
		collections: {
			participant: participants,
		},
	};
}
