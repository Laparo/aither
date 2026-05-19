// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { ParticipantsList } from "@/app/components/dashboard/section-b-participants-list";
import type { ServiceParticipant } from "@/lib/hemera/schemas";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

function makeParticipant(
	overrides: Partial<ServiceParticipant> & { participationId: string; name: string | null },
): ServiceParticipant {
	return {
		bookingId: `b-${overrides.participationId}`,
		userId: `u-${overrides.participationId}`,
		status: "INVITED",
		preparationIntent: "Vorbereitungsabsicht",
		desiredResults: "Gewünschte Ergebnisse",
		lineManagerProfile: "Profil des Vorgesetzten",
		preparationCompletedAt: null,
		...overrides,
	};
}

describe("ParticipantsList keyboard navigation", () => {
	it("Enter and Space toggle aria-expanded", async () => {
		const user = userEvent.setup();
		render(
			<ParticipantsList
				participants={[makeParticipant({ participationId: "p1", name: "Anna Schmidt" })]}
			/>,
		);

		const toggle = screen.getByRole("button", {
			name: "Teilnehmerdetails für Anna Schmidt umschalten",
		});
		toggle.focus();

		await user.keyboard("{Enter}");
		expect(toggle).toHaveAttribute("aria-expanded", "true");

		await user.keyboard("{Space}");
		expect(toggle).toHaveAttribute("aria-expanded", "false");
	});

	it("Escape closes expanded panel and returns focus to toggle", async () => {
		const user = userEvent.setup();
		render(
			<ParticipantsList
				hemeraBaseUrl="https://hemera.example"
				participants={[
					makeParticipant({
						participationId: "p1",
						name: "Anna Schmidt",
						bookingId: "booking-1",
						preparationIntent: "Mehr Fokus",
						desiredResults: "Besseres Feedback",
						lineManagerProfile: "Coaching",
					}),
				]}
			/>,
		);

		const toggle = screen.getByRole("button", {
			name: "Teilnehmerdetails für Anna Schmidt umschalten",
		});
		await user.click(toggle);
		await user.tab();
		expect(screen.getByRole("link", { name: "Mehr Fokus" })).toHaveFocus();

		await user.keyboard("{Escape}");
		expect(screen.queryByRole("region")).not.toBeInTheDocument();
		expect(toggle).toHaveFocus();
	});

	it("ArrowUp, ArrowDown, Home, and End move focus between participant rows", async () => {
		const user = userEvent.setup();
		render(
			<ParticipantsList
				participants={[
					makeParticipant({ participationId: "p1", name: "Anna Schmidt" }),
					makeParticipant({ participationId: "p2", name: "Bernd Meier" }),
					makeParticipant({ participationId: "p3", name: "Claudia Berger" }),
				]}
			/>,
		);

		const anna = screen.getByRole("button", {
			name: "Teilnehmerdetails für Anna Schmidt umschalten",
		});
		const bernd = screen.getByRole("button", {
			name: "Teilnehmerdetails für Bernd Meier umschalten",
		});
		const claudia = screen.getByRole("button", {
			name: "Teilnehmerdetails für Claudia Berger umschalten",
		});

		anna.focus();
		await user.keyboard("{ArrowDown}");
		expect(bernd).toHaveFocus();

		await user.keyboard("{ArrowDown}");
		expect(claudia).toHaveFocus();

		await user.keyboard("{ArrowUp}");
		expect(bernd).toHaveFocus();

		await user.keyboard("{End}");
		expect(claudia).toHaveFocus();

		await user.keyboard("{Home}");
		expect(anna).toHaveFocus();
	});

	it("Tab traverses focusable elements inside the expanded panel", async () => {
		const user = userEvent.setup();
		render(
			<ParticipantsList
				hemeraBaseUrl="https://hemera.example"
				participants={[
					makeParticipant({
						participationId: "p1",
						name: "Anna Schmidt",
						bookingId: "booking-1",
						preparationIntent: "Mehr Fokus",
						desiredResults: "Besseres Feedback",
						lineManagerProfile: "Coaching",
					}),
					makeParticipant({ participationId: "p2", name: "Bernd Meier" }),
				]}
			/>,
		);

		const toggle = screen.getByRole("button", {
			name: "Teilnehmerdetails für Anna Schmidt umschalten",
		});
		await user.click(toggle);
		toggle.focus();

		await user.tab();
		expect(screen.getByRole("link", { name: "Mehr Fokus" })).toHaveFocus();

		await user.tab();
		expect(screen.getByRole("link", { name: "Besseres Feedback" })).toHaveFocus();

		await user.tab();
		expect(screen.getByRole("link", { name: "Coaching" })).toHaveFocus();
	});
});
