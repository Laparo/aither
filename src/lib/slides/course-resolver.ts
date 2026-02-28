// ---------------------------------------------------------------------------
// Slide Generation — Course Resolver
// Task: T005 [US1] — Determine the next upcoming course
// Task: T005 [US5] — Determine the next upcoming course with participants
// ---------------------------------------------------------------------------

import type { HemeraClient } from "@/lib/hemera/client";
import {
	SeminarsResponseSchema,
	type ServiceCourseDetail,
	ServiceCourseDetailResponseSchema,
	ServiceCoursesResponseSchema,
} from "@/lib/hemera/schemas";
import type { Seminar } from "@/lib/hemera/types";

/**
 * Fetches all seminars from the Hemera API and returns the one whose
 * start date is the nearest in the future.
 *
 * @param client HemeraClient instance for API access
 * @returns The next upcoming seminar
 * @throws Error if no upcoming seminars are found
 */
export async function getNextCourse(client: HemeraClient): Promise<Seminar> {
	const seminars = await client.get("/seminars", SeminarsResponseSchema);
	const now = new Date();

	const futureSeminars = seminars
		.filter((s) => s.dates.length > 0)
		.filter((s) => new Date(s.dates[0].start) > now)
		.sort((a, b) => new Date(a.dates[0].start).getTime() - new Date(b.dates[0].start).getTime());

	if (futureSeminars.length === 0) {
		throw new Error("No upcoming course found. All seminars are in the past or have no dates.");
	}

	return futureSeminars[0];
}

/**
 * Fetches courses from the Hemera Service API, selects the nearest upcoming
 * course, then fetches its detail (including participants).
 *
 * Returns `null` when no upcoming course exists (empty course list or all
 * courses in the past). The generator skips participant slide generation
 * gracefully.
 *
 * @param client HemeraClient instance for API access
 * @returns Course detail with participants, or null if none upcoming
 */
export async function getNextCourseWithParticipants(
	client: HemeraClient,
): Promise<ServiceCourseDetail | null> {
	const response = await client.get("/api/service/courses", ServiceCoursesResponseSchema);
	const now = new Date();

	const futureCourses = response.data
		.filter((c) => c.startDate !== null)
		.filter((c) => new Date(c.startDate as string) > now)
		.sort(
			(a, b) =>
				new Date(a.startDate as string).getTime() - new Date(b.startDate as string).getTime(),
		);

	if (futureCourses.length === 0) {
		return null;
	}

	const nextCourse = futureCourses[0];
	const detailResponse = await client.get(
		`/api/service/courses/${nextCourse.id}`,
		ServiceCourseDetailResponseSchema,
	);

	return detailResponse.data;
}
