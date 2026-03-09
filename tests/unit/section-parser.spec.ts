// ---------------------------------------------------------------------------
// Unit Tests: Section Parser — parseSections, hasSectionTags
// Contract: specs/006-participant-slides/contracts/section-parser.contract.ts
// Constitution: §I Test-First, §III Contract-First
// ---------------------------------------------------------------------------

import { hasSectionTags, parseSections } from "@/lib/slides/section-parser";
import { describe, expect, it } from "vitest";

// --- parseSections (US1 — T010) ---

describe("parseSections", () => {
	it("extracts a single section", () => {
		const html = '<section class="slide"><h1>Title</h1></section>';
		const result = parseSections(html);

		expect(result).toHaveLength(1);
		expect(result[0].body).toBe("<h1>Title</h1>");
		expect(result[0].index).toBe(0);
	});

	it("extracts multiple sections in order", () => {
		const html = `
      <section class="slide"><h1>First</h1></section>
      <section class="slide"><h1>Second</h1></section>
    `;
		const result = parseSections(html);

		expect(result).toHaveLength(2);
		expect(result[0].body).toBe("<h1>First</h1>");
		expect(result[0].index).toBe(0);
		expect(result[1].body).toBe("<h1>Second</h1>");
		expect(result[1].index).toBe(1);
	});

	it("ignores HTML content outside sections", () => {
		const html =
			'<div>Ignored</div><section class="slide"><p>Kept</p></section><footer>Also ignored</footer>';
		const result = parseSections(html);

		expect(result).toHaveLength(1);
		expect(result[0].body).toBe("<p>Kept</p>");
	});

	it("treats entire body as implicit section when no section tags present", () => {
		const html = "<div><h1>{participant:name}</h1><p>Some content</p></div>";
		const result = parseSections(html);

		expect(result).toHaveLength(1);
		expect(result[0].body).toBe(html);
		expect(result[0].index).toBe(0);
	});

	it("handles sections with additional attributes", () => {
		const html = '<section class="slide" data-topic="video"><h1>Test</h1></section>';
		const result = parseSections(html);

		expect(result).toHaveLength(1);
		expect(result[0].body).toBe("<h1>Test</h1>");
	});

	it("handles whitespace variations in class attribute", () => {
		const html = '<section  class="slide" ><p>Content</p></section>';
		const result = parseSections(html);

		expect(result).toHaveLength(1);
		expect(result[0].body).toBe("<p>Content</p>");
	});

	it("returns empty body for empty sections", () => {
		const html = '<section class="slide"></section>';
		const result = parseSections(html);

		expect(result).toHaveLength(1);
		expect(result[0].body).toBe("");
	});

	it("classifies placeholders within each section", () => {
		const html = `
      <section class="slide">
        <h1>{courseTitle}</h1>
        <p>{participant:name} - {participant:desiredResults}</p>
      </section>
    `;
		const result = parseSections(html);

		expect(result).toHaveLength(1);
		expect(result[0].scalars).toEqual(["courseTitle"]);
		expect(result[0].collections).toEqual(new Map([["participant", ["name", "desiredResults"]]]));
	});

	it("preserves inner HTML structure", () => {
		const html = '<section class="slide"><div><p>Nested <strong>bold</strong></p></div></section>';
		const result = parseSections(html);

		expect(result[0].body).toBe("<div><p>Nested <strong>bold</strong></p></div>");
	});

	it("does not match section tags without slide class", () => {
		const html = '<section class="other"><p>Not a slide</p></section>';
		const result = parseSections(html);

		// Treated as implicit section — the whole HTML becomes the body
		expect(result).toHaveLength(1);
		expect(result[0].body).toBe(html);
	});
});

// --- hasSectionTags (US1 — T010) ---

describe("hasSectionTags", () => {
	it('returns true when section class="slide" tags exist', () => {
		const html = '<section class="slide"><p>Content</p></section>';
		expect(hasSectionTags(html)).toBe(true);
	});

	it("returns false for plain HTML without section tags", () => {
		const html = "<div><p>Content</p></div>";
		expect(hasSectionTags(html)).toBe(false);
	});

	it("returns false for section tags without slide class", () => {
		const html = '<section class="content"><p>Content</p></section>';
		expect(hasSectionTags(html)).toBe(false);
	});
});
