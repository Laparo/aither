// ---------------------------------------------------------------------------
// Unit Tests: Course Resolver
// Task: T003 [US1] — next-course selection logic
// ---------------------------------------------------------------------------

import type { HemeraClient } from "@/lib/hemera/client";
import type { Seminar } from "@/lib/hemera/types";
import { getNextCourse } from "@/lib/slides/course-resolver";
import { describe, expect, it, vi } from "vitest";

/** Helper to create a mock HemeraClient */
function mockClient(seminars: Seminar[]) {
	return {
		get: vi.fn().mockResolvedValue(seminars),
		put: vi.fn(),
	} as unknown as HemeraClient;
}

/** Helper to create a seminar with dates */
function makeSeminar(id: string, title: string, start: string, end: string): Seminar {
	return {
		sourceId: id,
		title,
		description: null,
		dates: [{ start, end }],
		instructorIds: [],
		lessonIds: [],
		recordingUrl: null,
	};
}

describe("getNextCourse", () => {
	it("picks the nearest future seminar", async () => {
		const now = new Date();
		const tomorrow = new Date(now.getTime() + 86400000).toISOString();
		const nextWeek = new Date(now.getTime() + 7 * 86400000).toISOString();
		const yesterday = new Date(now.getTime() - 86400000).toISOString();

		const seminars = [
			makeSeminar("s1", "Past Course", yesterday, yesterday),
			makeSeminar("s2", "Next Week Course", nextWeek, nextWeek),
			makeSeminar("s3", "Tomorrow Course", tomorrow, tomorrow),
		];

		const client = mockClient(seminars);
		const result = await getNextCourse(client);

		expect(result.sourceId).toBe("s3");
		expect(result.title).toBe("Tomorrow Course");
	});

	it("throws a descriptive error when no future seminars exist", async () => {
		const yesterday = new Date(Date.now() - 86400000).toISOString();
		const seminars = [makeSeminar("s1", "Past Course", yesterday, yesterday)];

		const client = mockClient(seminars);

		await expect(getNextCourse(client)).rejects.toThrow(/no upcoming/i);
	});

	it("throws a descriptive error when API returns empty array", async () => {
		const client = mockClient([]);

		await expect(getNextCourse(client)).rejects.toThrow(/no upcoming/i);
	});

	it("ignores seminars with no dates", async () => {
		const tomorrow = new Date(Date.now() + 86400000).toISOString();
		const seminars: Seminar[] = [
			{
				sourceId: "s1",
				title: "No Dates",
				description: null,
				dates: [],
				instructorIds: [],
				lessonIds: [],
				recordingUrl: null,
			},
			makeSeminar("s2", "Valid Course", tomorrow, tomorrow),
		];

		const client = mockClient(seminars);
		const result = await getNextCourse(client);

		expect(result.sourceId).toBe("s2");
	});

	it("calls HemeraClient.get with /seminars and the correct schema", async () => {
		const tomorrow = new Date(Date.now() + 86400000).toISOString();
		const client = mockClient([makeSeminar("s1", "Course", tomorrow, tomorrow)]);

		await getNextCourse(client);

		expect(client.get).toHaveBeenCalledWith("/seminars", expect.anything());
	});
});
