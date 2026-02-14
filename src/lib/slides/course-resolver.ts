// ---------------------------------------------------------------------------
// Slide Generation — Course Resolver
// Task: T005 [US1] — Determine the next upcoming course
// ---------------------------------------------------------------------------

import type { HemeraClient } from "@/lib/hemera/client";
import { SeminarsResponseSchema } from "@/lib/hemera/schemas";
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
