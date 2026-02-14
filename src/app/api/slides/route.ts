// ---------------------------------------------------------------------------
// Slides API Route Handler
// Task: T017 [US4] — POST: trigger slide generation, auth, mutex
// ---------------------------------------------------------------------------

import { requireAdmin } from "@/lib/auth/role-check";
import { getServiceToken } from "@/lib/auth/service-token";
import { loadConfig } from "@/lib/config";
import { HemeraClient } from "@/lib/hemera/client";
import { reportError } from "@/lib/monitoring/rollbar-official";
import { SlideGenerator } from "@/lib/slides/generator";
import { type NextRequest, NextResponse } from "next/server";

// ── In-memory state (transient, Constitution VII) ─────────────────────────

let isGenerating = false;

/** Exported for testing */
export function _resetState() {
	isGenerating = false;
}

// ── POST /api/slides — Trigger slide generation ──────────────────────────

export async function POST(req: NextRequest) {
	type AuthenticatedRequest = NextRequest & { auth?: unknown };
	const auth = (req as AuthenticatedRequest).auth ?? null;
	const authResult = requireAdmin(auth);
	if (authResult.status !== 200) {
		return NextResponse.json(authResult.body, { status: authResult.status });
	}

	// Mutex: reject concurrent generation
	if (isGenerating) {
		return NextResponse.json(
			{
				error: "SLIDES_ALREADY_RUNNING",
				message: "Slide generation is already in progress",
			},
			{ status: 409 },
		);
	}

	isGenerating = true;

	try {
		const cfg = loadConfig();
		const baseUrl = cfg.HEMERA_API_BASE_URL;
		const outputDir = cfg.SLIDES_OUTPUT_DIR;

		const client = new HemeraClient({ baseUrl, getToken: getServiceToken });
		const generator = new SlideGenerator({ client, outputDir });

		const result = await generator.generate();

		return NextResponse.json(
			{
				status: "success",
				slidesGenerated: result.slidesGenerated,
				courseTitle: result.courseTitle,
				courseId: result.courseId,
			},
			{ status: 200 },
		);
	} catch (err) {
		reportError(err instanceof Error ? err : new Error(String(err)), {
			route: "/api/slides",
			method: "POST",
			additionalData: { feature: "slide-generation" },
		});
		return NextResponse.json(
			{
				status: "failed",
				error: err instanceof Error ? err.message : String(err),
			},
			{ status: 500 },
		);
	} finally {
		isGenerating = false;
	}
}
