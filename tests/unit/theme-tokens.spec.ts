import { colors, spacing, typography } from "@/app/components/theme/design-tokens";
import { describe, expect, it } from "vitest";

describe("theme design tokens", () => {
	it("matches canonical Hemera values", () => {
		expect(colors.marsala).toBe("#884143");
		expect(colors.beige).toBe("#EBE2D3");
		expect(colors.bronze).toBe("#926A49");
		expect(spacing.containerMaxWidth).toBe("lg");
		expect(typography.heading).toContain("Playfair Display");
		expect(typography.body).toContain("Inter");
	});
});
