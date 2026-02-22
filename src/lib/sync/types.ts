// ---------------------------------------------------------------------------
// Sync Engine — Types
// Derived from: specs/001-hemera-api-integration/data-model.md
//               specs/005-data-sync/data-model.md
// ---------------------------------------------------------------------------

import type { ServiceCourseDetail } from "../hemera/schemas";

/** Represents one sync execution. Transient — lost on restart. */
export interface SyncJob {
	jobId: string;
	startTime: string;
	endTime: string | null;
	status: "running" | "success" | "failed";
	recordsFetched: number;
	htmlFilesGenerated: number;
	htmlFilesSkipped: number;
	recordsTransmitted: number;
	errors: SyncError[];
}

export interface SyncError {
	entity: string;
	message: string;
	timestamp: string;
}

/** Content hash manifest for incremental sync detection. Persisted at output/.sync-manifest.json */
export interface SyncManifest {
	lastSyncTime: string;
	hashes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// 005-data-sync types
// ---------------------------------------------------------------------------

/** In-memory context for the next-course sync pipeline. */
export interface NextCourseSyncData {
	course: ServiceCourseDetail;
	fetchedAt: string;
	contentHash: string;
}

/** Sync job status for the data-sync pipeline (flat structure per contracts/sync-api.yaml). */
export interface DataSyncJob {
	jobId: string;
	status: "running" | "success" | "failed";
	startTime: string;
	endTime: string | null;
	durationMs: number | null;
	courseId: string | null;
	noUpcomingCourse: boolean;
	participantsFetched: number;
	filesGenerated: number;
	filesSkipped: number;
	errors: SyncError[];
}
