// ---------------------------------------------------------------------------
// Unit Tests: HTML Writer (Atomic File Writes)
// Task: T021 [US1] — TDD: Write FIRST, must FAIL before implementation
// ---------------------------------------------------------------------------

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { cleanOrphans, writeHtmlFile } from "@/lib/html/writer";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("writeHtmlFile", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "aither-html-"));
	});

	afterEach(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	it("creates the output file in the correct directory", async () => {
		await writeHtmlFile(tmpDir, "seminars", "sem-001", "<h1>Test</h1>");

		const filePath = path.join(tmpDir, "seminars", "sem-001.html");
		const content = await fs.readFile(filePath, "utf-8");
		expect(content).toBe("<h1>Test</h1>");
	});

	it("creates subdirectories if they don't exist", async () => {
		await writeHtmlFile(tmpDir, "lessons", "les-001", "<p>Lesson</p>");

		const dirExists = await fs
			.stat(path.join(tmpDir, "lessons"))
			.then((s) => s.isDirectory())
			.catch(() => false);
		expect(dirExists).toBe(true);
	});

	it("overwrites existing files", async () => {
		await writeHtmlFile(tmpDir, "seminars", "sem-001", "<h1>V1</h1>");
		await writeHtmlFile(tmpDir, "seminars", "sem-001", "<h1>V2</h1>");

		const content = await fs.readFile(path.join(tmpDir, "seminars", "sem-001.html"), "utf-8");
		expect(content).toBe("<h1>V2</h1>");
	});

	it("does not leave .tmp files after successful write", async () => {
		await writeHtmlFile(tmpDir, "seminars", "sem-001", "<h1>Test</h1>");

		const files = await fs.readdir(path.join(tmpDir, "seminars"));
		const tmpFiles = files.filter((f) => f.endsWith(".tmp"));
		expect(tmpFiles).toHaveLength(0);
	});
});

describe("cleanOrphans", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "aither-orphan-"));
	});

	afterEach(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	it("removes files not in the active IDs set", async () => {
		const dir = path.join(tmpDir, "seminars");
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(path.join(dir, "sem-001.html"), "keep");
		await fs.writeFile(path.join(dir, "sem-002.html"), "remove");

		const deleted = await cleanOrphans(tmpDir, "seminars", new Set(["sem-001"]));
		expect(deleted).toContain("sem-002");

		const files = await fs.readdir(dir);
		expect(files).toEqual(["sem-001.html"]);
	});

	it("returns empty array if no orphans exist", async () => {
		const dir = path.join(tmpDir, "seminars");
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(path.join(dir, "sem-001.html"), "keep");

		const deleted = await cleanOrphans(tmpDir, "seminars", new Set(["sem-001"]));
		expect(deleted).toHaveLength(0);
	});

	it("handles missing directory gracefully", async () => {
		const deleted = await cleanOrphans(tmpDir, "nonexistent", new Set());
		expect(deleted).toHaveLength(0);
	});
});
