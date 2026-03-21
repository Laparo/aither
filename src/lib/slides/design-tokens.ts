// ---------------------------------------------------------------------------
// Hemera Design Tokens — Single source of truth for slide styling
// ---------------------------------------------------------------------------

export const designTokens: Record<string, string> = {
	"--hemera-beige": "#EBE2D3",
	"--hemera-marsala": "#884143",
	"--hemera-marsala-dark": "#6B3234",
	"--hemera-bronze": "#926A49",
	"--hemera-rosy-brown": "#bc8f8f",
	"--hemera-light-black": "#2D2D2D",
	"--hemera-white": "#FFFFFF",
	"--hemera-teal": "#16404D",
	"--font-heading": "Georgia, 'Times New Roman', serif",
	"--font-body":
		"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

/** Serialize tokens into CSS custom property declarations for a :root block. */
export function tokensToCssVars(): string {
	return Object.entries(designTokens)
		.map(([key, value]) => `      ${key}: ${value};`)
		.join("\n");
}
