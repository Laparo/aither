// ---------------------------------------------------------------------------
// Unit Tests: HTML Layout (1920×1080 Slide Layout)
// Task: T002b — wrapInLayout() produces valid HTML
// ---------------------------------------------------------------------------

import { wrapInLayout } from "@/lib/slides/html-layout";
import { describe, expect, it } from "vitest";

describe("wrapInLayout", () => {
	it("produces a complete HTML document", () => {
		const html = wrapInLayout("Test Title", "<h1>Hello</h1>");

		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain('<html lang="de">');
		expect(html).toContain("</html>");
	});

	it("sets 1920×1080 dimensions in CSS", () => {
		const html = wrapInLayout("Test", "<p>Content</p>");

		expect(html).toContain("width: 1920px");
		expect(html).toContain("height: 1080px");
	});

	it("includes CSS custom properties for branding", () => {
		const html = wrapInLayout("Test", "<p>Content</p>");

		expect(html).toContain("--primary-color:");
		expect(html).toContain("--text-color:");
		expect(html).toContain("--font-family:");
		expect(html).toContain("--bg-color:");
	});

	it("injects the title into the <title> tag", () => {
		const html = wrapInLayout("My Course Slide", "<p>Content</p>");

		expect(html).toContain("<title>My Course Slide</title>");
	});

	it("injects content into the slide-content container", () => {
		const html = wrapInLayout("Test", "<h1>Course Name</h1>");

		expect(html).toContain('<div class="slide-content">');
		expect(html).toContain("<h1>Course Name</h1>");
	});

	it("escapes HTML special characters in the title", () => {
		const html = wrapInLayout('Title with <script> & "quotes"', "<p>Safe</p>");

		expect(html).toContain("<title>Title with &lt;script&gt; &amp; &quot;quotes&quot;</title>");
		expect(html).not.toContain("<title>Title with <script>");
	});

	it("sets viewport width to 1920", () => {
		const html = wrapInLayout("Test", "<p>Content</p>");

		expect(html).toContain('content="width=1920"');
	});

	it("uses UTF-8 charset", () => {
		const html = wrapInLayout("Test", "<p>Content</p>");

		expect(html).toContain('charset="UTF-8"');
	});
});
