import { MaterialCard } from "@/app/components/dashboard/section-a-material-card";
import type { SlideStatus } from "@/app/components/dashboard/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: vi.fn(),
	}),
}));

vi.mock("@/app/components/slide-generate-button", () => ({
	SlideGenerateButton: () => <div data-testid="mock-slide-generate-button" />,
}));

vi.mock("@/app/components/slide-thumbnails", () => ({
	SlideThumbnails: () => <div data-testid="mock-slide-thumbnails" />,
}));

describe("MaterialCard", () => {
	it("renders status, slide count, date, and test id", () => {
		const slideStatus: SlideStatus = {
			status: "generated",
			slideCount: 4,
			lastUpdated: "2026-04-01T00:00:00.000Z",
			files: ["slide-01.html"],
			courseId: "course-1",
		};

		const html = renderToStaticMarkup(<MaterialCard slideStatus={slideStatus} />);

		expect(html).toContain('data-testid="material-card"');
		expect(html).toContain("Generiert");
		expect(html).toContain("Anzahl Seiten: 4");
		expect(html).toContain("01.04.2026");
		expect(html).toContain("mock-slide-thumbnails");
		expect(html).toContain("mock-slide-generate-button");
	});

	it("renders empty state when files are empty and status is not-generated", () => {
		const slideStatus: SlideStatus = {
			status: "not-generated",
			slideCount: 0,
			lastUpdated: null,
			files: [],
			courseId: null,
		};

		const html = renderToStaticMarkup(<MaterialCard slideStatus={slideStatus} />);

		expect(html).toContain("Keine Folien vorhanden");
		expect(html).toContain("Nicht generiert");
		expect(html).toContain("mock-slide-generate-button");
		expect(html).not.toContain("mock-slide-thumbnails");
	});
});
