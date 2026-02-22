// ---------------------------------------------------------------------------
// Unit Tests: selectNextCourse()
// Task: T005 [005-data-sync] — Pure function selecting the earliest future course
// ---------------------------------------------------------------------------

import type { ServiceCourse } from "@/lib/hemera/schemas";
import { selectNextCourse } from "@/lib/sync/course-selector";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Helper to create a ServiceCourse with sensible defaults
function makeCourse(overrides: Partial<ServiceCourse> = {}): ServiceCourse {
	return {
		id: "cm5default",
		title: "Testkurs",
		slug: "testkurs",
		level: "BEGINNER",
		startDate: null,
		endDate: null,
		participantCount: 0,
		...overrides,
	};
}

describe("selectNextCourse", () => {
	// Fix "now" so tests are deterministic
	const NOW = new Date("2026-03-01T12:00:00.000Z");

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns the next future course sorted by startDate", () => {
		const courses: ServiceCourse[] = [
			makeCourse({
				id: "c3",
				title: "Kurs C",
				slug: "kurs-c",
				startDate: "2026-06-01T09:00:00.000Z",
			}),
			makeCourse({
				id: "c1",
				title: "Kurs A",
				slug: "kurs-a",
				startDate: "2026-04-01T09:00:00.000Z",
			}),
			makeCourse({
				id: "c2",
				title: "Kurs B",
				slug: "kurs-b",
				startDate: "2026-05-15T09:00:00.000Z",
			}),
		];

		const result = selectNextCourse(courses);

		expect(result).not.toBeNull();
		// biome-ignore lint/style/noNonNullAssertion: we just asserted result is not null
		expect(result!.id).toBe("c1");
		// biome-ignore lint/style/noNonNullAssertion: we just asserted result is not null
		expect(result!.title).toBe("Kurs A");
	});

	it("returns null when no future courses exist", () => {
		const courses: ServiceCourse[] = [
			makeCourse({
				id: "past1",
				slug: "past-1",
				startDate: "2025-12-01T09:00:00.000Z",
			}),
			makeCourse({
				id: "past2",
				slug: "past-2",
				startDate: "2026-01-15T09:00:00.000Z",
			}),
		];

		const result = selectNextCourse(courses);

		expect(result).toBeNull();
	});

	it("filters out past courses and returns earliest future one from mixed set", () => {
		const courses: ServiceCourse[] = [
			makeCourse({
				id: "past",
				slug: "past-course",
				startDate: "2025-10-01T09:00:00.000Z",
			}),
			makeCourse({
				id: "future2",
				slug: "future-2",
				startDate: "2026-07-01T09:00:00.000Z",
			}),
			makeCourse({
				id: "future1",
				slug: "future-1",
				startDate: "2026-04-15T09:00:00.000Z",
			}),
		];

		const result = selectNextCourse(courses);

		expect(result).not.toBeNull();
		// biome-ignore lint/style/noNonNullAssertion: we just asserted result is not null
		expect(result!.id).toBe("future1");
	});

	it("returns null for an empty array", () => {
		const result = selectNextCourse([]);

		expect(result).toBeNull();
	});

	it("excludes courses with null startDate", () => {
		const courses: ServiceCourse[] = [
			makeCourse({ id: "no-date", slug: "no-date", startDate: null }),
			makeCourse({
				id: "future",
				slug: "future-course",
				startDate: "2026-05-01T09:00:00.000Z",
			}),
		];

		const result = selectNextCourse(courses);

		expect(result).not.toBeNull();
		// biome-ignore lint/style/noNonNullAssertion: we just asserted result is not null
		expect(result!.id).toBe("future");
	});

	it("returns null when all courses have null startDate", () => {
		const courses: ServiceCourse[] = [
			makeCourse({ id: "nd1", slug: "nd-1", startDate: null }),
			makeCourse({ id: "nd2", slug: "nd-2", startDate: null }),
		];

		const result = selectNextCourse(courses);

		expect(result).toBeNull();
	});
});
