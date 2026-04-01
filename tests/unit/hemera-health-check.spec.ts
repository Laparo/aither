import { checkHemeraHealth } from "@/lib/hemera/health-check";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({
	loadConfig: vi.fn(),
}));

vi.mock("@/lib/monitoring/rollbar-official", () => ({
	reportError: vi.fn(),
}));

function mockResponse(status: number): Response {
	return new Response(null, { status });
}

describe("checkHemeraHealth probe behavior", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		const { loadConfig } = await import("@/lib/config");
		vi.mocked(loadConfig).mockReturnValue({
			HEMERA_API_BASE_URL: "https://primary.hemera.test",
		} as ReturnType<typeof loadConfig>);
	});

	it("falls back to GET when HEAD is unsupported and treats 401 as reachable", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(mockResponse(405))
			.mockResolvedValueOnce(mockResponse(401));
		vi.stubGlobal("fetch", fetchMock);

		await expect(checkHemeraHealth()).resolves.toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "HEAD" });
		expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "GET" });
	});

	it("treats redirect responses as unreachable", async () => {
		const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(mockResponse(307));
		vi.stubGlobal("fetch", fetchMock);

		await expect(checkHemeraHealth()).resolves.toBe(false);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("accepts 403 as reachable without GET fallback", async () => {
		const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(mockResponse(403));
		vi.stubGlobal("fetch", fetchMock);

		await expect(checkHemeraHealth()).resolves.toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "HEAD" });
	});
});
