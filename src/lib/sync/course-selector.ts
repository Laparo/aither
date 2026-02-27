// ---------------------------------------------------------------------------
// Course Selector — Pure function to select the next upcoming course
// Task: T006 [005-data-sync]
// ---------------------------------------------------------------------------

import type { ServiceCourse } from "../hemera/schemas";

/**
 * Select the next upcoming course from a list of courses.
 *
 * Filters to courses with a future `startDate` (> now), then returns the
 * one with the earliest startDate. Returns `null` if no future courses exist
 * or the input array is empty.
 *
 * Courses with `startDate: null` are excluded.
 */
export function selectNextCourse(courses: ServiceCourse[]): ServiceCourse | null {
	const now = new Date();

	const futureCourses = courses.filter((c) => {
		if (c.startDate === null) return false;
		return new Date(c.startDate) > now;
	});

	if (futureCourses.length === 0) return null;

	futureCourses.sort((a, b) => {
		// Both startDates are guaranteed non-null after filter
		const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
		const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
		return dateA - dateB;
	});

	return futureCourses[0];
}
