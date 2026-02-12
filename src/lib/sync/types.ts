// ---------------------------------------------------------------------------
// Sync Engine — Types
// Derived from: specs/001-hemera-api-integration/data-model.md
// ---------------------------------------------------------------------------

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
