// ---------------------------------------------------------------------------
// Slide Generation — Shared Utilities
// Task: T001 — Extract shared escapeHtml() utility
// ---------------------------------------------------------------------------

/**
 * Escapes HTML special characters in a string to prevent injection.
 * Characters escaped: & < > " '
 *
 * @param text  The raw text to escape
 * @returns     HTML-safe string
 */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}
