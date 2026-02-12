// ---------------------------------------------------------------------------
// Unit Tests: Hash Manifest
// Task: T020 [US1] — TDD: Write FIRST, must FAIL before implementation
// ---------------------------------------------------------------------------

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	computeContentHash,
	diffManifest,
	readManifest,
	writeManifest,
} from "@/lib/sync/hash-manifest";
import type { SyncManifest } from "@/lib/sync/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("computeContentHash", () => {
	it("returns a SHA-256 hex string", () => {
		const hash = computeContentHash("<h1>Test</h1>", { name: "value" });
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});

	it("returns consistent hashes for identical inputs", () => {
		const hash1 = computeContentHash("<h1>Test</h1>", { a: 1, b: 2 });
		const hash2 = computeContentHash("<h1>Test</h1>", { a: 1, b: 2 });
		expect(hash1).toBe(hash2);
	});

	it("produces different hashes for different data", () => {
		const hash1 = computeContentHash("<h1>Test</h1>", { a: 1 });
		const hash2 = computeContentHash("<h1>Test</h1>", { a: 2 });
		expect(hash1).not.toBe(hash2);
	});

	it("produces different hashes for different templates", () => {
		const hash1 = computeContentHash("<h1>V1</h1>", { a: 1 });
		const hash2 = computeContentHash("<h1>V2</h1>", { a: 1 });
		expect(hash1).not.toBe(hash2);
	});

	it("is deterministic regardless of key order", () => {
		const hash1 = computeContentHash("<h1>Test</h1>", { a: 1, b: 2, c: 3 });
		const hash2 = computeContentHash("<h1>Test</h1>", { c: 3, a: 1, b: 2 });
		expect(hash1).toBe(hash2);
	});
});

describe("diffManifest", () => {
	it("detects new entities (not in old manifest)", () => {
		const oldManifest: SyncManifest = {
			lastSyncTime: "2026-01-01T00:00:00Z",
			hashes: {},
		};
		const newHashes: Record<string, string> = { "seminar:sem-001": "abc123" };

		const diff = diffManifest(oldManifest, newHashes);
		expect(diff.changed).toContain("seminar:sem-001");
		expect(diff.deleted).toHaveLength(0);
	});

	it("detects changed entities (different hash)", () => {
		const oldManifest: SyncManifest = {
			lastSyncTime: "2026-01-01T00:00:00Z",
			hashes: { "seminar:sem-001": "old-hash" },
		};
		const newHashes: Record<string, string> = { "seminar:sem-001": "new-hash" };

		const diff = diffManifest(oldManifest, newHashes);
		expect(diff.changed).toContain("seminar:sem-001");
	});

	it("detects deleted entities (in old but not in new)", () => {
		const oldManifest: SyncManifest = {
			lastSyncTime: "2026-01-01T00:00:00Z",
			hashes: { "seminar:sem-001": "abc123" },
		};
		const newHashes: Record<string, string> = {};

		const diff = diffManifest(oldManifest, newHashes);
		expect(diff.deleted).toContain("seminar:sem-001");
		expect(diff.changed).toHaveLength(0);
	});

	it("skips unchanged entities (same hash)", () => {
		const oldManifest: SyncManifest = {
			lastSyncTime: "2026-01-01T00:00:00Z",
			hashes: { "seminar:sem-001": "same-hash" },
		};
		const newHashes: Record<string, string> = { "seminar:sem-001": "same-hash" };

		const diff = diffManifest(oldManifest, newHashes);
		expect(diff.changed).toHaveLength(0);
		expect(diff.deleted).toHaveLength(0);
		expect(diff.unchanged).toContain("seminar:sem-001");
	});
});

describe("readManifest / writeManifest", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "aither-test-"));
	});

	afterEach(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	it("returns empty manifest when file does not exist", async () => {
		const manifest = await readManifest(path.join(tmpDir, ".sync-manifest.json"));
		expect(manifest.hashes).toEqual({});
		expect(manifest.lastSyncTime).toBe("");
	});

	it("writes and reads back a manifest", async () => {
		const manifestPath = path.join(tmpDir, ".sync-manifest.json");
		const manifest: SyncManifest = {
			lastSyncTime: "2026-02-11T08:00:00Z",
			hashes: { "seminar:sem-001": "abc123", "lesson:les-001": "def456" },
		};

		await writeManifest(manifestPath, manifest);
		const read = await readManifest(manifestPath);

		expect(read).toEqual(manifest);
	});
});
