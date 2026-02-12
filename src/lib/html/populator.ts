// ---------------------------------------------------------------------------
// Template Population Engine (Handlebars.js)
// Task: T023 [US1] — populateTemplate(templateHtml, data): string
// ---------------------------------------------------------------------------

import Handlebars from "handlebars";

/**
 * Füllt ein HTML-Template mit Daten per Handlebars.
 * - XSS-Escaping ist standardmäßig aktiv ({{var}})
 * - Triple-Stache ({{{var}}}) für vertrauenswürdigen HTML-Inhalt
 * - Fehlende Platzhalter werden zu leeren Strings
 *
 * @param templateHtml HTML-Template-String
 * @param data         Datenobjekt für Platzhalter
 * @returns            Gerendertes HTML
 */
export function populateTemplate(templateHtml: string, data: Record<string, unknown>): string {
	const compiled = Handlebars.compile(templateHtml, { noEscape: false });
	return compiled(data);
}

/**
 * Registriert Handlebars-Helper für Medien-Einbettung.
 * Muss einmalig bei App-Start aufgerufen werden.
 *
 * Usage in Templates:
 *   {{image sourceUrl altText}}   → <img> mit onerror-Fallback
 *   {{video sourceUrl}}           → <video> mit Fallback-Text
 */
export function registerMediaHelpers(): void {
	Handlebars.registerHelper("image", (sourceUrl: string, altText: string) => {
		const safeUrl = Handlebars.Utils.escapeExpression(sourceUrl);
		const safeAlt = Handlebars.Utils.escapeExpression(altText ?? "");
		return new Handlebars.SafeString(
			`<img src="${safeUrl}" alt="${safeAlt}" loading="lazy" onerror="this.outerHTML='<p class=\\'media-fallback\\'>Bild nicht verfügbar</p>'" />`,
		);
	});

	Handlebars.registerHelper("video", (sourceUrl: string) => {
		const safeUrl = Handlebars.Utils.escapeExpression(sourceUrl);
		return new Handlebars.SafeString(
			`<video controls preload="metadata" src="${safeUrl}"><p class="media-fallback">Video nicht verfügbar: <a href="${safeUrl}">${safeUrl}</a></p></video>`,
		);
	});
}
