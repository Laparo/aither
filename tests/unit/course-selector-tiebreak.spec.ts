import type { ServiceCourse } from "@/lib/hemera/schemas";
import { selectNextCourse } from "@/lib/sync/course-selector";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("selectNextCourse tie-breaking", () => {
	const future = "2099-06-01T00:00:00.000Z";
	const futureB = "2099-07-01T00:00:00.000Z";

	function makeCourse(overrides: Partial<ServiceCourse>): ServiceCourse {
		return {
			id: "default-id",
			title: "Kurs",
			slug: "kurs",
			level: "BEGINNER",
			startDate: future,
			endDate: future,
			participantCount: 0,
			...overrides,
		};
	}

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns null for empty input", () => {
		expect(selectNextCourse([])).toBeNull();
	});

	it("selects the single future course", () => {
		const course = makeCourse({ id: "c1" });
		expect(selectNextCourse([course])).toEqual(course);
	});

	it("selects earliest startDate", () => {
		const early = makeCourse({ id: "c1", startDate: future });
		const late = makeCourse({ id: "c2", startDate: futureB });
		expect(selectNextCourse([late, early])?.id).toBe("c1");
	});

	it("breaks tie on same startDate by lexicographically smallest id", () => {
		const a = makeCourse({ id: "abc", startDate: future });
		const b = makeCourse({ id: "def", startDate: future });
		// Regardless of input order, "abc" should win
		expect(selectNextCourse([b, a])?.id).toBe("abc");
		expect(selectNextCourse([a, b])?.id).toBe("abc");
	});

	it("excludes courses with null startDate", () => {
		const valid = makeCourse({ id: "c1", startDate: future });
		const noDate = makeCourse({ id: "c2", startDate: null });
		expect(selectNextCourse([noDate, valid])?.id).toBe("c1");
	});

	it("returns null when all courses have null startDate", () => {
		const a = makeCourse({ id: "c1", startDate: null });
		const b = makeCourse({ id: "c2", startDate: null });
		expect(selectNextCourse([a, b])).toBeNull();
	});

	it("excludes past courses", () => {
		const past = makeCourse({ id: "c1", startDate: "2020-01-01T00:00:00.000Z" });
		const upcoming = makeCourse({ id: "c2", startDate: future });
		expect(selectNextCourse([past, upcoming])?.id).toBe("c2");
	});
});
