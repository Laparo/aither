// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { ParticipantsList } from "@/app/components/dashboard/section-b-participants-list";
import type { ServiceParticipant } from "@/lib/hemera/schemas";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

function makeParticipant(
	overrides: Partial<ServiceParticipant> & { participationId: string; name: string | null },
): ServiceParticipant {
	return {
		bookingId: `b-${overrides.participationId}`,
		userId: `u-${overrides.participationId}`,
		status: "INVITED",
		preparationIntent: null,
		desiredResults: null,
		lineManagerProfile: null,
		preparationCompletedAt: null,
		...overrides,
	};
}

describe("ParticipantsList", () => {
	it("renders one item per participant with avatar initials and test id", () => {
		render(
			<ParticipantsList
				participants={[
					makeParticipant({
						participationId: "p1",
						name: "Max Mustermann",
						preparationIntent: "Neues Führungssystem",
					}),
				]}
			/>,
		);

		expect(screen.getByTestId("participants-list")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Teilnehmerdetails für Max Mustermann umschalten" }),
		).toBeInTheDocument();
		expect(screen.getByText("MM")).toBeInTheDocument();
	});

	it("renders empty state", () => {
		render(<ParticipantsList participants={[]} />);
		expect(screen.getByText("Keine Teilnehmer.")).toBeInTheDocument();
	});

	it("sorts participants alphabetically with null-name last", () => {
		render(
			<ParticipantsList
				participants={[
					makeParticipant({ participationId: "p1", name: "Claudia Berger" }),
					makeParticipant({ participationId: "p2", name: null }),
					makeParticipant({ participationId: "p3", name: "anna Schmidt" }),
					makeParticipant({ participationId: "p4", name: "Bernd Meier" }),
				]}
			/>,
		);

		const buttons = screen.getAllByRole("button").map((button) => button.textContent ?? "");
		expect(buttons[0]).toContain("anna Schmidt");
		expect(buttons[1]).toContain("Bernd Meier");
		expect(buttons[2]).toContain("Claudia Berger");
		expect(buttons[3]).toContain("Unbekannt");
	});

	it("expands participant details with region semantics and actual values", () => {
		render(
			<ParticipantsList
				hemeraBaseUrl="https://hemera.example"
				participants={[
					makeParticipant({
						participationId: "p1",
						name: "Test User",
						bookingId: "booking/1",
						preparationIntent: "Neues Führungssystem",
						desiredResults: "Mehr Klarheit",
						lineManagerProfile: "Direkt",
					}),
				]}
			/>,
		);

		const toggle = screen.getByRole("button", {
			name: "Teilnehmerdetails für Test User umschalten",
		});
		fireEvent.click(toggle);

		expect(toggle).toHaveAttribute("aria-expanded", "true");
		const region = screen.getByRole("region");
		expect(region).toHaveAttribute("aria-labelledby", toggle.id);
		expect(screen.getByText("Neues Führungssystem")).toBeInTheDocument();
		expect(screen.getByText("Mehr Klarheit")).toBeInTheDocument();
		expect(screen.getByText("Direkt")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Neues Führungssystem" })).toHaveAttribute(
			"href",
			"https://hemera.example/my-courses/booking%2F1",
		);
	});
});
