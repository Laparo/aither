// ---------------------------------------------------------------------------
// Sync API Route Handler
// Task: T027 [US1] — POST: trigger sync (202), GET: status, 409 if running
// ---------------------------------------------------------------------------

import { requireAdmin } from "@/lib/auth/role-check";
import { HemeraClient } from "@/lib/hemera/client";
import { SyncOrchestrator } from "@/lib/sync/orchestrator";
import type { SyncJob } from "@/lib/sync/types";
import { type NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

// ── In-memory state (transient, Constitution VII) ─────────────────────────

let currentJob: SyncJob | null = null;
let isSyncRunning = false;
let syncStartedAt: number | null = null;

/** Default timeout: 30 minutes */
const SYNC_TIMEOUT_MS = Number(process.env.SYNC_TIMEOUT_MS) || 30 * 60 * 1000;

/** Check if the mutex should be auto-released due to timeout */
function isSyncTimedOut(): boolean {
	if (!isSyncRunning || syncStartedAt === null) return false;
	return Date.now() - syncStartedAt > SYNC_TIMEOUT_MS;
}

/** Force-release a timed-out lock */
function releaseTimedOutLock(): void {
	if (currentJob && currentJob.status === "running") {
		currentJob.status = "failed";
		currentJob.endTime = new Date().toISOString();
		currentJob.errors.push({
			entity: "sync",
			message: `Sync timed out after ${SYNC_TIMEOUT_MS}ms — mutex auto-released`,
			timestamp: new Date().toISOString(),
		});
	}
	isSyncRunning = false;
	syncStartedAt = null;
}

/** Exported for testing */
export function _getState() {
	return { currentJob, isSyncRunning };
}
export function _resetState() {
	currentJob = null;
	isSyncRunning = false;
	syncStartedAt = null;
}

// ── POST /api/sync — Trigger a sync ──────────────────────────────────────

export async function POST(req: NextRequest) {
	const auth = (req as any).auth ?? null;
	const authResult = requireAdmin(auth);
	if (authResult.status !== 200) {
		return NextResponse.json(authResult.body, { status: authResult.status });
	}

	// Check for timed-out lock and auto-release
	if (isSyncRunning && isSyncTimedOut()) {
		releaseTimedOutLock();
	}

	// Mutex: reject concurrent sync
	if (isSyncRunning && currentJob) {
		return NextResponse.json(
			{
				error: "SYNC_ALREADY_RUNNING",
				message: "A sync job is already in progress",
				jobId: currentJob.jobId,
			},
			{ status: 409 },
		);
	}

	// Create sync job placeholder
	const jobId = uuidv4();
	const startTime = new Date().toISOString();
	currentJob = {
		jobId,
		startTime,
		endTime: null,
		status: "running",
		recordsFetched: 0,
		htmlFilesGenerated: 0,
		htmlFilesSkipped: 0,
		recordsTransmitted: 0,
		errors: [],
	};
	isSyncRunning = true;
	syncStartedAt = Date.now();

	// Fire-and-forget: start orchestrator async
	const baseUrl = process.env.HEMERA_API_BASE_URL ?? "";
	const apiKey = process.env.HEMERA_API_KEY ?? "";
	const outputDir = process.env.HTML_OUTPUT_DIR ?? "output";

	const client = new HemeraClient({ baseUrl, apiKey });
	const orchestrator = new SyncOrchestrator({
		client,
		outputDir,
		manifestPath: `${outputDir}/.sync-manifest.json`,
	});

	// Run in background — do NOT await
	orchestrator
		.run()
		.then((completedJob) => {
			currentJob = completedJob;
		})
		.catch((err) => {
			if (currentJob) {
				currentJob.status = "failed";
				currentJob.endTime = new Date().toISOString();
				currentJob.errors.push({
					entity: "sync",
					message: err instanceof Error ? err.message : String(err),
					timestamp: new Date().toISOString(),
				});
			}
		})
		.finally(() => {
			isSyncRunning = false;
			syncStartedAt = null;
		});

	// Respond immediately with 202
	return NextResponse.json(currentJob, { status: 202 });
}

// ── GET /api/sync — Get sync status ──────────────────────────────────────

export async function GET(req: NextRequest) {
	const auth = (req as any).auth ?? null;
	const authResult = requireAdmin(auth);
	if (authResult.status !== 200) {
		return NextResponse.json(authResult.body, { status: authResult.status });
	}

	if (!currentJob) {
		return NextResponse.json(
			{
				error: "NO_SYNC_HISTORY",
				message: "No synchronization has been executed yet",
			},
			{ status: 404 },
		);
	}

	return NextResponse.json(currentJob, { status: 200 });
}
