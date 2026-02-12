// ---------------------------------------------------------------------------
// E2E Test: Vollständiger Sync-Flow
// Task: T052 [Polish] — Playwright: API-Trigger bis HTML-Generierung
// ---------------------------------------------------------------------------

import path from "path";
import { expect, test } from "@playwright/test";
import fs from "fs/promises";

const API_URL = process.env.E2E_API_URL || "http://localhost:3000";
const OUTPUT_DIR = process.env.E2E_OUTPUT_DIR || "output";
const ADMIN_TOKEN = process.env.E2E_ADMIN_TOKEN || "test-admin-token";

// Hilfsfunktion: Warte auf Datei
async function waitForFile(filePath: string, timeout = 5000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		try {
			await fs.access(filePath);
			return true;
		} catch {
			await new Promise((r) => setTimeout(r, 200));
		}
	}
	return false;
}

test("Sync-API erzeugt HTML-Dateien für Seminar und Lesson", async ({ request }) => {
	// 1. Sync triggern
	const res = await request.post(`${API_URL}/api/sync`, {
		headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
	});
	expect(res.status()).toBe(202);
	const job = await res.json();
	expect(job).toHaveProperty("jobId");

	// 2. Warte auf HTML-Dateien (z.B. output/seminars/ und output/lessons/)
	const seminarHtml = path.join(OUTPUT_DIR, "seminars", "sem-001.html");
	const lessonHtml = path.join(OUTPUT_DIR, "lessons", "les-001.html");
	const foundSeminar = await waitForFile(seminarHtml, 10000);
	const foundLesson = await waitForFile(lessonHtml, 10000);

	expect(foundSeminar).toBe(true);
	expect(foundLesson).toBe(true);

	// 3. Inhalt prüfen
	const seminarContent = await fs.readFile(seminarHtml, "utf8");
	const lessonContent = await fs.readFile(lessonHtml, "utf8");
	expect(seminarContent).toContain("<html");
	expect(lessonContent).toContain("<html");
});
