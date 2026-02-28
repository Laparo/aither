// ---------------------------------------------------------------------------
// Unit Tests: Course Resolver
// Task: T003 [US1] — next-course selection logic
// Task: T004 [US5] — getNextCourseWithParticipants()
// ---------------------------------------------------------------------------

import type { HemeraClient } from "@/lib/hemera/client";
import type { Seminar } from "@/lib/hemera/types";
import { getNextCourse, getNextCourseWithParticipants } from "@/lib/slides/course-resolver";
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

// ---------------------------------------------------------------------------
// getNextCourseWithParticipants (US5)
// ---------------------------------------------------------------------------

/** Helper: mock HemeraClient for service API calls */
function mockServiceClient(coursesResponse: unknown, detailResponse?: unknown) {
	const getMock = vi.fn();
	// First call: /api/service/courses → courses list
	getMock.mockResolvedValueOnce(coursesResponse);
	// Second call: /api/service/courses/{id} → course detail
	if (detailResponse !== undefined) {
		getMock.mockResolvedValueOnce(detailResponse);
	}
	return {
		get: getMock,
		put: vi.fn(),
	} as unknown as HemeraClient;
}

/** Helper: create a service course summary */
function makeServiceCourse(id: string, title: string, startDate: string | null) {
	return {
		id,
		title,
		slug: `${title.toLowerCase().replace(/\s/g, "-")}`,
		level: "BEGINNER" as const,
		startDate,
		endDate: startDate,
		participantCount: 2,
	};
}

/** Helper: create a course detail response envelope */
function makeDetailResponse(courseId: string, title: string, startDate: string | null) {
	return {
		success: true,
		data: {
			id: courseId,
			title,
			slug: `${title.toLowerCase().replace(/\s/g, "-")}`,
			level: "BEGINNER" as const,
			startDate,
			endDate: startDate,
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
		},
		meta: { requestId: "req-1", timestamp: new Date().toISOString(), version: "1.0" },
	};
}

describe("getNextCourseWithParticipants", () => {
	it("fetches course list then detail for the next upcoming course", async () => {
		const tomorrow = new Date(Date.now() + 86400000).toISOString();
		const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString();

		const coursesResponse = {
			success: true,
			data: [
				makeServiceCourse("c1", "Next Week", nextWeek),
				makeServiceCourse("c2", "Tomorrow", tomorrow),
			],
			meta: { requestId: "r1", timestamp: new Date().toISOString(), version: "1.0" },
		};
		const detailResponse = makeDetailResponse("c2", "Tomorrow", tomorrow);

		const client = mockServiceClient(coursesResponse, detailResponse);
		const result = await getNextCourseWithParticipants(client);

		expect(result).not.toBeNull();
		expect(result?.id).toBe("c2");
		expect(result?.participants).toHaveLength(2);
		expect(client.get).toHaveBeenCalledTimes(2);
		expect(client.get).toHaveBeenNthCalledWith(1, "/api/service/courses", expect.anything());
		expect(client.get).toHaveBeenNthCalledWith(2, "/api/service/courses/c2", expect.anything());
	});

	it("returns null when no upcoming courses exist", async () => {
		const yesterday = new Date(Date.now() - 86400000).toISOString();
		const coursesResponse = {
			success: true,
			data: [makeServiceCourse("c1", "Past", yesterday)],
			meta: { requestId: "r1", timestamp: new Date().toISOString(), version: "1.0" },
		};

		const client = mockServiceClient(coursesResponse);
		const result = await getNextCourseWithParticipants(client);

		expect(result).toBeNull();
	});

	it("returns null when course list is empty", async () => {
		const coursesResponse = {
			success: true,
			data: [],
			meta: { requestId: "r1", timestamp: new Date().toISOString(), version: "1.0" },
		};

		const client = mockServiceClient(coursesResponse);
		const result = await getNextCourseWithParticipants(client);

		expect(result).toBeNull();
	});

	it("skips courses without startDate", async () => {
		const tomorrow = new Date(Date.now() + 86400000).toISOString();
		const coursesResponse = {
			success: true,
			data: [makeServiceCourse("c1", "No Date", null), makeServiceCourse("c2", "Valid", tomorrow)],
			meta: { requestId: "r1", timestamp: new Date().toISOString(), version: "1.0" },
		};
		const detailResponse = makeDetailResponse("c2", "Valid", tomorrow);

		const client = mockServiceClient(coursesResponse, detailResponse);
		const result = await getNextCourseWithParticipants(client);

		expect(result).not.toBeNull();
		expect(result?.id).toBe("c2");
	});

	it("returns course detail with participants including null fields", async () => {
		const tomorrow = new Date(Date.now() + 86400000).toISOString();
		const coursesResponse = {
			success: true,
			data: [makeServiceCourse("c1", "Course", tomorrow)],
			meta: { requestId: "r1", timestamp: new Date().toISOString(), version: "1.0" },
		};
		const detailResponse = makeDetailResponse("c1", "Course", tomorrow);

		const client = mockServiceClient(coursesResponse, detailResponse);
		const result = await getNextCourseWithParticipants(client);

		expect(result).not.toBeNull();
		const anna = result?.participants[0];
		expect(anna?.name).toBe("Anna Müller");
		expect(anna?.preparationCompletedAt).toBe("2026-01-15T10:00:00Z");

		const ben = result?.participants[1];
		expect(ben?.preparationIntent).toBeNull();
		expect(ben?.preparationCompletedAt).toBeNull();
	});
});
