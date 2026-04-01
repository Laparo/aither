import {
	createHemeraClient,
	HemeraUnreachableError,
	resetHemeraBaseUrl,
} from "@/lib/hemera/factory";
import { HemeraTokenManager } from "@/lib/hemera/token-manager";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({
	loadConfig: vi.fn(),
}));

vi.mock("@/lib/hemera/token-manager", () => ({
	getTokenManager: vi.fn(),
}));

vi.mock("@/lib/monitoring/rollbar-official", () => ({
	reportError: vi.fn(),
}));

function mockResponse(status: number): Response {
	return new Response(null, { status });
}

describe("createHemeraClient reachability probes", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		resetHemeraBaseUrl();

		const { loadConfig } = await import("@/lib/config");
		vi.mocked(loadConfig).mockReturnValue({
			HEMERA_API_BASE_URL: "https://primary.hemera.test",
			HEMERA_API_FALLBACK_URL: "https://fallback.hemera.test",
			HEMERA_API_KEY: "test-key-minimum-32-characters-long-for-validation",
		} as ReturnType<typeof loadConfig>);

		const { getTokenManager } = await import("@/lib/hemera/token-manager");
		vi.mocked(getTokenManager).mockReturnValue(
			new HemeraTokenManager("test-key-minimum-32-characters-long-for-validation"),
		);
	});

	it("uses primary when HEAD is unsupported but GET fallback returns 401", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(mockResponse(405))
			.mockResolvedValueOnce(mockResponse(401));
		vi.stubGlobal("fetch", fetchMock);

		const client = await createHemeraClient();
		expect((client as unknown as { baseUrl: string }).baseUrl).toBe("https://primary.hemera.test");
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "HEAD" });
		expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "GET" });
	});

	it("falls back to fallback URL when primary probe fails", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(mockResponse(405))
			.mockResolvedValueOnce(mockResponse(500))
			.mockResolvedValueOnce(mockResponse(405))
			.mockResolvedValueOnce(mockResponse(401));
		vi.stubGlobal("fetch", fetchMock);

		const client = await createHemeraClient();
		expect((client as unknown as { baseUrl: string }).baseUrl).toBe("https://fallback.hemera.test");
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});

	it("treats redirect responses as unreachable and throws when both are redirects", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(mockResponse(307))
			.mockResolvedValueOnce(mockResponse(307));
		vi.stubGlobal("fetch", fetchMock);

		await expect(createHemeraClient()).rejects.toBeInstanceOf(HemeraUnreachableError);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
