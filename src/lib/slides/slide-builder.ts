// ---------------------------------------------------------------------------
// Slide Generation — Slide Builders
// Task: T006 [US1] — intro, T010 [US2] — curriculum, T013 [US3] — materials
// ---------------------------------------------------------------------------

import type { Lesson, MediaAsset, Seminar, TextContent } from "@/lib/hemera/types";
import { wrapInLayout } from "./html-layout";
import { escapeHtml } from "./utils";

/** Date formatter for de-CH locale (e.g., "15. März 2026"). */
const dateFormatter = new Intl.DateTimeFormat("de-CH", {
	day: "numeric",
	month: "long",
	year: "numeric",
});

/**
 * Extracts the YYYY-MM-DD portion of an ISO date string for same-day comparison.
 */
function toDateOnly(isoDate: string): string {
	return new Date(isoDate).toISOString().slice(0, 10);
}

/**
 * Builds the intro slide HTML for a seminar.
 * Shows course name centered, start date always, end date only if different day.
 *
 * @param seminar The seminar to generate the intro slide for
 * @returns Complete HTML document string
 */
export function buildIntroSlide(seminar: Seminar): string {
	const startDate = new Date(seminar.dates[0].start);
	const endDate = new Date(seminar.dates[0].end);

	const startFormatted = dateFormatter.format(startDate);
	const isSameDay = toDateOnly(seminar.dates[0].start) === toDateOnly(seminar.dates[0].end);

	let dateHtml: string;
	if (isSameDay) {
		dateHtml = `<p style="font-size: 2rem; margin-top: 1rem;">${startFormatted}</p>`;
	} else {
		const endFormatted = dateFormatter.format(endDate);
		dateHtml = `<p style="font-size: 2rem; margin-top: 1rem;">${startFormatted} – ${endFormatted}</p>`;
	}

	const content = `<h1 style="font-size: 4rem;">${escapeHtml(seminar.title)}</h1>\n    ${dateHtml}`;
	return wrapInLayout(seminar.title, content);
}

/**
 * Builds a curriculum slide HTML for a lesson.
 * Shows lesson title centered.
 *
 * @param lesson The lesson to generate the curriculum slide for
 * @returns Complete HTML document string
 */
export function buildCurriculumSlide(lesson: Lesson): string {
	const content = `<h1 style="font-size: 3.5rem;">${escapeHtml(lesson.title)}</h1>`;
	return wrapInLayout(lesson.title, content);
}

/**
 * Builds a material slide for text content.
 * Renders the text body as HTML centered on the page.
 *
 * @param text The text content to render
 * @returns Complete HTML document string
 */
export function buildTextSlide(text: TextContent): string {
	const content = `<div style="font-size: 1.5rem; line-height: 1.6;">${text.body}</div>`;
	return wrapInLayout("Text Content", content);
}

/**
 * Builds a material slide for an image.
 * Renders an <img> tag with src and alt text centered.
 *
 * @param media The media asset (image) to render
 * @returns Complete HTML document string
 */
export function buildImageSlide(media: MediaAsset): string {
	const alt = escapeHtml(media.altText ?? "");
	const content = `<img src="${escapeHtml(media.sourceUrl)}" alt="${alt}" style="max-width: 100%; max-height: 900px; object-fit: contain;" />`;
	return wrapInLayout(media.altText ?? "Image", content);
}

/**
 * Builds a material slide for a video.
 * Renders a <video> tag with playback controls centered.
 *
 * @param media The media asset (video) to render
 * @returns Complete HTML document string
 */
export function buildVideoSlide(media: MediaAsset): string {
	const content = `<video src="${escapeHtml(media.sourceUrl)}" controls style="max-width: 100%; max-height: 900px;"></video>`;
	return wrapInLayout(media.altText ?? "Video", content);
}
