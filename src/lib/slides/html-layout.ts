// ---------------------------------------------------------------------------
// Slide Generation — Base HTML Layout (1920×1080)
// Task: T002 — wrapInLayout(title, content)
// ---------------------------------------------------------------------------

import { tokensToCssVars } from "./design-tokens";
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
  <meta name="viewport" content="width=1920, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
${tokensToCssVars()}
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 1920px;
      height: 1080px;
      font-family: var(--font-body);
      background: var(--hemera-beige);
      color: var(--hemera-light-black);
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: var(--font-heading);
      font-weight: 700;
      color: var(--hemera-marsala);
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
