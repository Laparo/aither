// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectionStatus } from "@/app/components/dashboard/connection-status";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("ConnectionStatus", () => {
	beforeEach(() => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("shows connecting message and spinner on initial render", () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(
			() => new Promise(() => {}), // never resolves
		);
		render(<ConnectionStatus probeUrl="/api/hemera-health" />);

		expect(screen.getByTestId("connection-status")).toBeInTheDocument();
		expect(screen.getByText("Verbindung zu Hemera wird hergestellt…")).toBeInTheDocument();
	});

	it("shows failed attempt after probe fails", async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Connection refused"));
		render(<ConnectionStatus probeUrl="/api/hemera-health" maxRetries={3} retryInterval={1000} />);

		await waitFor(() => {
			expect(screen.getByText(/Fehlgeschlagen/)).toBeInTheDocument();
		});
	});

	it("shows connection established when probe succeeds", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
		render(<ConnectionStatus probeUrl="/api/hemera-health" />);

		await waitFor(() => {
			expect(screen.getByTestId("connection-established")).toBeInTheDocument();
			expect(screen.getByText(/Verbindung hergestellt/)).toBeInTheDocument();
		});
	});

	it("treats HTTP 401 as reachable", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
		render(<ConnectionStatus probeUrl="/api/hemera-health" />);

		await waitFor(() => {
			expect(screen.getByTestId("connection-established")).toBeInTheDocument();
		});
	});

	it("gives up after maxRetries attempts", async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
		render(<ConnectionStatus probeUrl="/api/hemera-health" maxRetries={2} retryInterval={100} />);

		// First attempt fails immediately
		await waitFor(() => {
			expect(screen.getByText(/Fehlgeschlagen/)).toBeInTheDocument();
		});

		// Advance timer for second attempt
		await act(async () => {
			await vi.advanceTimersByTimeAsync(150);
		});

		await waitFor(() => {
			expect(screen.getByText("Kursdaten konnten nicht geladen werden.")).toBeInTheDocument();
		});
	});

	it("shows attempt counter", async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
		render(<ConnectionStatus probeUrl="/api/hemera-health" maxRetries={5} retryInterval={1000} />);

		await waitFor(() => {
			expect(screen.getByText(/Versuch 2 von 5/)).toBeInTheDocument();
		});
	});
});
