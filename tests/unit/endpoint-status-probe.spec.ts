import {
	checkEndpoint,
	type EndpointDef,
} from "@/app/components/endpoint-status";
import { describe, expect, it, vi } from "vitest";

function mockResponse(status: number): Response {
	return new Response(null, { status });
}

function buildEndpoint(overrides?: Partial<EndpointDef>): EndpointDef {
	return {
		label: "Probe",
		path: "/api/probe",
		method: "POST",
		group: "Test",
		...overrides,
	};
}

describe("EndpointStatus probe behavior", () => {
	it("falls back from HEAD to GET when HEAD is unsupported", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(mockResponse(405))
			.mockResolvedValueOnce(mockResponse(401));
		vi.stubGlobal("fetch", fetchMock);

		const result = await checkEndpoint(buildEndpoint());

		expect(result).toEqual({
			status: "erreichbar",
			code: 401,
			probeMethod: "GET",
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "HEAD" });
		expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "GET" });
	});

	it("treats redirects as not reachable", async () => {
		const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(mockResponse(307));
		vi.stubGlobal("fetch", fetchMock);

		const result = await checkEndpoint(buildEndpoint());

		expect(result).toEqual({
			status: "fehler",
			code: 307,
			probeMethod: "HEAD",
		});
	});

	it("allows disabling GET fallback for HEAD-unsupported endpoints", async () => {
		const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(mockResponse(405));
		vi.stubGlobal("fetch", fetchMock);

		const result = await checkEndpoint(
			buildEndpoint({ fallbackToGetOnHeadUnsupported: false }),
		);

		expect(result).toEqual({
			status: "erreichbar",
			code: 405,
			probeMethod: "HEAD",
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
