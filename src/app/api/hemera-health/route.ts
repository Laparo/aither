import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Lightweight probe to check if the Hemera API is reachable.
 * Returns 200 if Hemera responds, 502 otherwise.
 */
export async function HEAD() {
	const baseUrl = process.env.HEMERA_API_BASE_URL;
	if (!baseUrl) {
		return new NextResponse(null, { status: 502 });
	}

	try {
		const res = await fetch(`${baseUrl}/api/service/courses`, {
			method: "HEAD",
			signal: AbortSignal.timeout(4_000),
			cache: "no-store",
		});
		// 401 is fine — it means Hemera is reachable
		if (res.ok || res.status === 401) {
			return new NextResponse(null, { status: 200 });
		}
		return new NextResponse(null, { status: 502 });
	} catch {
		return new NextResponse(null, { status: 502 });
	}
}
