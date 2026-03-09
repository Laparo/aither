// ---------------------------------------------------------------------------
// Unit Tests: Slide Context Builder
// Task: T006 [US6] — buildSlideContext() tests
// ---------------------------------------------------------------------------

import type { ServiceCourseDetail } from "@/lib/hemera/schemas";
import { buildSlideContext } from "@/lib/slides/slide-context";
import { describe, expect, it } from "vitest";

/** Helper: create a minimal ServiceCourseDetail */
function makeCourseDetail(overrides?: Partial<ServiceCourseDetail>): ServiceCourseDetail {
	return {
		id: "course-1",
		title: "Gehaltsverhandlung meistern",
		slug: "gehaltsverhandlung-meistern",
		level: "ADVANCED",
		startDate: "2026-03-15T09:00:00.000Z",
		endDate: "2026-03-16T17:00:00.000Z",
		participants: [
			{
				participationId: "part-1",
				userId: "u1",
				name: "Anna Müller",
				status: "CONFIRMED",
				preparationIntent: "Selbstbewusster auftreten",
				desiredResults: "Gehaltserhöhung",
				lineManagerProfile: "Datengetrieben",
				preparationCompletedAt: "2026-01-15T10:00:00Z",
			},
			{
				participationId: "part-2",
				userId: "u2",
				name: "Ben Fischer",
				status: "CONFIRMED",
				preparationIntent: null,
				desiredResults: null,
				lineManagerProfile: null,
				preparationCompletedAt: null,
			},
		],
		...overrides,
	};
}

describe("buildSlideContext", () => {
	it("maps scalar values from ServiceCourseDetail", () => {
		const detail = makeCourseDetail();
		const ctx = buildSlideContext(detail);

		expect(ctx.scalars.courseTitle).toBe("Gehaltsverhandlung meistern");
		expect(ctx.scalars.courseSlug).toBe("gehaltsverhandlung-meistern");
		expect(ctx.scalars.courseLevel).toBe("ADVANCED");
		expect(ctx.scalars.courseStartDate).toBe("2026-03-15T09:00:00.000Z");
		expect(ctx.scalars.courseEndDate).toBe("2026-03-16T17:00:00.000Z");
		expect(ctx.scalars.participantCount).toBe("2");
	});

	it("replaces null startDate/endDate with em-dash", () => {
		const detail = makeCourseDetail({ startDate: null, endDate: null });
		const ctx = buildSlideContext(detail);

		expect(ctx.scalars.courseStartDate).toBe("—");
		expect(ctx.scalars.courseEndDate).toBe("—");
	});

	it("maps participant collection records", () => {
		const detail = makeCourseDetail();
		const ctx = buildSlideContext(detail);

		expect(ctx.collections.participant).toHaveLength(2);

		const anna = ctx.collections.participant[0];
		expect(anna.name).toBe("Anna Müller");
		expect(anna.status).toBe("CONFIRMED");
		expect(anna.preparationIntent).toBe("Selbstbewusster auftreten");
		expect(anna.desiredResults).toBe("Gehaltserhöhung");
		expect(anna.lineManagerProfile).toBe("Datengetrieben");
		expect(anna.preparationCompleted).toBe("Ja");
	});

	it("replaces null participant fields with em-dash", () => {
		const detail = makeCourseDetail();
		const ctx = buildSlideContext(detail);

		const ben = ctx.collections.participant[1];
		expect(ben.name).toBe("Ben Fischer");
		expect(ben.preparationIntent).toBe("—");
		expect(ben.desiredResults).toBe("—");
		expect(ben.lineManagerProfile).toBe("—");
		expect(ben.preparationCompleted).toBe("—");
	});

	it("derives preparationCompleted as 'Ja' when preparationCompletedAt is set", () => {
		const detail = makeCourseDetail();
		const ctx = buildSlideContext(detail);

		expect(ctx.collections.participant[0].preparationCompleted).toBe("Ja");
	});

	it("derives preparationCompleted as em-dash when preparationCompletedAt is null", () => {
		const detail = makeCourseDetail();
		const ctx = buildSlideContext(detail);

		expect(ctx.collections.participant[1].preparationCompleted).toBe("—");
	});

	it("handles empty participants array", () => {
		const detail = makeCourseDetail({ participants: [] });
		const ctx = buildSlideContext(detail);

		expect(ctx.scalars.participantCount).toBe("0");
		expect(ctx.collections.participant).toEqual([]);
	});

	it("replaces null name with em-dash", () => {
		const detail = makeCourseDetail({
			participants: [
				{
					participationId: "p1",
					userId: "u1",
					name: null,
					status: "CONFIRMED",
					preparationIntent: null,
					desiredResults: null,
					lineManagerProfile: null,
					preparationCompletedAt: null,
				},
			],
		});
		const ctx = buildSlideContext(detail);

		expect(ctx.collections.participant[0].name).toBe("—");
	});
});
