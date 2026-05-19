// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock endpoint-config so tests control the endpoint list
vi.mock("@/app/components/endpoint-config", () => ({
	MONITORED_ENDPOINTS: [
		{ label: "Folien generieren", path: "/api/slides", method: "POST", group: "Präsentation" },
		{ label: "Aufnahme-Status", path: "/api/recording/status", method: "GET", group: "Aufnahme" },
	],
}));

// Mock checkEndpoint so network calls aren't needed
vi.mock("@/app/components/endpoint-status", async (importOriginal) => {
	const orig = await importOriginal<typeof import("@/app/components/endpoint-status")>();
	return {
		...orig,
		checkEndpoint: vi.fn(),
	};
});

import { SteuerungCards } from "@/app/components/dashboard/section-c-steuerung-cards";
import { checkEndpoint } from "@/app/components/endpoint-status";

const mockCheck = vi.mocked(checkEndpoint);

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("SteuerungCards", () => {
	beforeEach(() => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function keepInitialProbePending() {
		mockCheck.mockImplementation(() => new Promise(() => {}));
	}

	it("renders Systemstatus card with heading and Aktualisieren button", () => {
		keepInitialProbePending();
		render(<SteuerungCards />);

		expect(screen.getByTestId("steuerung-cards")).toBeInTheDocument();
		expect(screen.getByText("Systemstatus")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Aktualisieren" })).toBeInTheDocument();
	});

	it("shows Gesamtstatus and Dienste labels", () => {
		keepInitialProbePending();
		render(<SteuerungCards />);

		expect(screen.getByText("Gesamtstatus:")).toBeInTheDocument();
		expect(screen.getByText("Dienste:")).toBeInTheDocument();
	});

	it("shows grouped service chips with Prüfe… status initially", () => {
		keepInitialProbePending();
		render(<SteuerungCards />);

		expect(screen.getByText("Präsentation: Prüfe…")).toBeInTheDocument();
		expect(screen.getByText("Aufnahme: Prüfe…")).toBeInTheDocument();
	});

	it("shows Erreichbar chips after successful probe", async () => {
		mockCheck.mockResolvedValue({ status: "erreichbar", code: 200, probeMethod: "HEAD" });
		render(<SteuerungCards />);

		expect(await screen.findByText("Präsentation: Erreichbar")).toBeInTheDocument();
		expect(await screen.findByText("Aufnahme: Erreichbar")).toBeInTheDocument();
		expect(await screen.findByText("Alle Dienste erreichbar")).toBeInTheDocument();
	});

	it("shows Fehler chips after failed probe", async () => {
		mockCheck.mockResolvedValue({ status: "fehler", code: 503 });
		render(<SteuerungCards />);

		expect(await screen.findByText("Präsentation: Fehler")).toBeInTheDocument();
		expect(await screen.findByText("Aufnahme: Fehler")).toBeInTheDocument();
		expect(await screen.findByText("Beeinträchtigt")).toBeInTheDocument();
	});

	it("shows build info (Version, Commit, Umgebung)", () => {
		keepInitialProbePending();
		render(<SteuerungCards />);

		expect(screen.getByText("Version:")).toBeInTheDocument();
		expect(screen.getByText("Commit:")).toBeInTheDocument();
		expect(screen.getByText("Umgebung:")).toBeInTheDocument();
	});

	it("shows Zuletzt aktualisiert after first check", async () => {
		mockCheck.mockResolvedValue({ status: "erreichbar", code: 200 });
		render(<SteuerungCards />);

		expect(await screen.findByText("Zuletzt aktualisiert:")).toBeInTheDocument();
	});

	it("triggers manual refresh via Aktualisieren button", async () => {
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		mockCheck.mockResolvedValue({ status: "erreichbar", code: 200 });
		render(<SteuerungCards />);

		await screen.findByText("Alle Dienste erreichbar");
		mockCheck.mockClear();
		mockCheck.mockResolvedValue({ status: "fehler", code: 503 });

		await user.click(screen.getByRole("button", { name: "Aktualisieren" }));

		expect(await screen.findByText("Beeinträchtigt")).toBeInTheDocument();
		// 2 endpoints checked on manual refresh
		expect(mockCheck).toHaveBeenCalledTimes(2);
	});

	it("has data-testid steuerung-cards", () => {
		keepInitialProbePending();
		render(<SteuerungCards />);
		expect(screen.getByTestId("steuerung-cards")).toBeInTheDocument();
	});
});
