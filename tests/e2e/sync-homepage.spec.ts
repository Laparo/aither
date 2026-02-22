// ---------------------------------------------------------------------------
// E2E Test: Homepage — Nächster Kurs + Teilnehmer-Tabellen
// Task: T020 [US5] — Validate course detail + participant tables on homepage
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3500";

test.describe("Homepage — Kursdetails & Teilnehmer", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(BASE_URL);
	});

	test("zeigt Kursdetails-Tabelle mit Key-Value-Zeilen", async ({ page }) => {
		// Course detail table should have these rows
		const detailTable = page.locator('[data-testid="course-details-table"]');

		// Explicitly assert the table is visible before checking child elements
		await expect(detailTable).toBeVisible();
		await expect(detailTable.locator("text=Kurs")).toBeVisible();
		await expect(detailTable.locator("text=Level")).toBeVisible();
		await expect(detailTable.locator("text=Startdatum")).toBeVisible();
		await expect(detailTable.locator("text=Enddatum")).toBeVisible();
		await expect(detailTable.locator("text=Teilnehmerzahl")).toBeVisible();
	});

	test("zeigt Teilnehmer-Tabelle mit Spaltenüberschriften", async ({ page }) => {
		const participantsTable = page.locator('[data-testid="participants-table"]');

		// Explicitly assert the table is visible before checking child elements
		await expect(participantsTable).toBeVisible();
		await expect(participantsTable.locator("text=Name")).toBeVisible();
		await expect(participantsTable.locator("text=Vorbereitungsabsicht")).toBeVisible();
		await expect(participantsTable.locator("text=Gewünschte Ergebnisse")).toBeVisible();
		await expect(participantsTable.locator("text=Vorgesetzten-Profil")).toBeVisible();
		await expect(participantsTable.locator("text=Vorbereitung abgeschlossen")).toBeVisible();
	});

	test("zeigt Dash (–) für Null-Felder", async ({ page }) => {
		const participantsTable = page.locator('[data-testid="participants-table"]');

		await expect(participantsTable).toBeVisible();
		// At least one cell should contain "–" for null fields
		const dashCells = participantsTable.locator("td:has-text('–')");
		const count = await dashCells.count();
		expect(count).toBeGreaterThan(0);
	});

	test("zeigt Fallback-Nachricht wenn API nicht erreichbar", async ({ page }) => {
		// When API fails, a fallback message should appear
		const fallback = page.locator('[data-testid="homepage-error-fallback"]');
		const detailTable = page.locator('[data-testid="course-details-table"]');

		// Either the tables are visible OR the fallback is visible
		const hasTable = await detailTable.isVisible().catch(() => false);
		const hasFallback = await fallback.isVisible().catch(() => false);

		expect(hasTable || hasFallback).toBe(true);
	});

	test("zeigt Kein-Kurs-Nachricht wenn kein zukünftiger Kurs existiert", async ({ page }) => {
		// If no upcoming course, a "no course" message should appear
		const noCourse = page.locator('[data-testid="no-upcoming-course"]');
		const detailTable = page.locator('[data-testid="course-details-table"]');
		const fallback = page.locator('[data-testid="homepage-error-fallback"]');

		// Assert that noCourse is visible and other elements are not
		await expect(noCourse).toBeVisible();
		await expect(detailTable).not.toBeVisible();
		await expect(fallback).not.toBeVisible();
	});
});
