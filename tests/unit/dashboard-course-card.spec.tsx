import { CourseCard } from "@/app/components/dashboard/section-a-course-card";
import type { ServiceCourseDetail } from "@/lib/hemera/schemas";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

describe("CourseCard", () => {
	it("renders title, level, dates, participant count and test id", () => {
		const course: ServiceCourseDetail = {
			id: "course-1",
			title: "Führungskompetenz",
			slug: "fuehrungskompetenz",
			level: "INTERMEDIATE",
			startDate: "2026-04-10T00:00:00.000Z",
			endDate: "2026-04-12T00:00:00.000Z",
			participants: [
				{
					bookingId: "b1",
					participationId: "p1",
					userId: "u1",
					name: "Max Mustermann",
					status: "INVITED",
					preparationIntent: null,
					desiredResults: null,
					lineManagerProfile: null,
					preparationCompletedAt: null,
				},
			],
		};

		const html = renderToStaticMarkup(<CourseCard course={course} />);

		expect(html).toContain('data-testid="course-card"');
		expect(html).toContain("Führungskompetenz");
		expect(html).toContain("Fortgeschritten");
		expect(html).toContain("10.04.2026");
		expect(html).toContain("12.04.2026");
		expect(html).toContain("Teilnehmerzahl: 1");
	});
});
