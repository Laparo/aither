// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { SlidesList } from "@/app/components/dashboard/section-b-slides-list";
import type { SlideStatus } from "@/app/components/dashboard/types";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

function makeSlideStatus(overrides: Partial<SlideStatus> = {}): SlideStatus {
	return {
		status: "generated",
		slideCount: 3,
		lastUpdated: "2026-01-15T10:00:00Z",
		files: ["slide-01.pdf", "slide-02.pdf", "slide-03.pdf"],
		courseId: "course-1",
		...overrides,
	};
}

describe("SlidesList", () => {
	it("renders one list item per file", () => {
		render(<SlidesList slideStatus={makeSlideStatus()} />);

		expect(screen.getByTestId("slides-list")).toBeInTheDocument();
		expect(screen.getByText("slide-01.pdf")).toBeInTheDocument();
		expect(screen.getByText("slide-02.pdf")).toBeInTheDocument();
		expect(screen.getByText("slide-03.pdf")).toBeInTheDocument();
	});

	it("renders empty state when files array is empty", () => {
		render(<SlidesList slideStatus={makeSlideStatus({ files: [] })} />);

		expect(screen.getByText("Keine Folien generiert.")).toBeInTheDocument();
	});

	it("clicking a filename opens the preview Modal with correct title", async () => {
		const user = userEvent.setup();
		render(<SlidesList slideStatus={makeSlideStatus()} />);

		await user.click(screen.getByText("slide-01.pdf"));

		const modal = screen.getByTestId("slide-preview-modal");
		expect(modal).toBeInTheDocument();
		expect(within(modal).getByText("slide-01.pdf")).toBeInTheDocument();
	});

	it("preview Modal has a close button that closes it", async () => {
		const user = userEvent.setup();
		render(<SlidesList slideStatus={makeSlideStatus()} />);

		await user.click(screen.getByText("slide-01.pdf"));
		expect(screen.getByTestId("slide-preview-modal")).toBeInTheDocument();

		const closeButton = screen.getByRole("button", { name: /schließen|close/i });
		await user.click(closeButton);

		expect(screen.queryByTestId("slide-preview-modal")).not.toBeInTheDocument();
	});

	it("renders filenames without links when courseId is null", () => {
		render(<SlidesList slideStatus={makeSlideStatus({ courseId: null })} />);

		expect(screen.getByText("slide-01.pdf")).toBeInTheDocument();
		expect(screen.queryByRole("link")).not.toBeInTheDocument();
	});

	it("has data-testid slides-list", () => {
		render(<SlidesList slideStatus={makeSlideStatus()} />);
		expect(screen.getByTestId("slides-list")).toBeInTheDocument();
	});
});
