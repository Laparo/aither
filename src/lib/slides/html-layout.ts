// ---------------------------------------------------------------------------
// Slide Generation — Base HTML Layout (1920×1080)
// Task: T002 — wrapInLayout(title, content)
// ---------------------------------------------------------------------------

import { escapeHtml } from "./utils";

/**
 * Wraps slide content in a consistent HTML layout optimized for 1920×1080.
 * Uses CSS custom properties for future branding customization.
 *
 * @param title   Page title for the HTML document
 * @param content Inner HTML to place inside the slide-content container
 * @returns       Complete HTML document string
 */
export function wrapInLayout(title: string, content: string): string {
	return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --primary-color: #1a1a2e;
      --text-color: #ffffff;
      --font-family: system-ui, -apple-system, sans-serif;
      --bg-color: #16213e;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 1920px;
      height: 1080px;
      font-family: var(--font-family);
      background: var(--bg-color);
      color: var(--text-color);
    }
    .slide-content {
      text-align: center;
      max-width: 80%;
    }
  </style>
</head>
<body>
  <div class="slide-content">
    ${content}
  </div>
</body>
</html>`;
}
