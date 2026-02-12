// ---------------------------------------------------------------------------
// Unit Tests: Template Populator (Handlebars)
// Task: T019 [US1] — TDD: Write FIRST, must FAIL before implementation
// ---------------------------------------------------------------------------

import { populateTemplate } from "@/lib/html/populator";
import { describe, expect, it } from "vitest";

describe("populateTemplate", () => {
	it("replaces simple placeholders with data values", () => {
		const template = "<h1>{{title}}</h1><p>{{description}}</p>";
		const data = { title: "TypeScript Workshop", description: "Learn TS" };

		const result = populateTemplate(template, data);
		expect(result).toBe("<h1>TypeScript Workshop</h1><p>Learn TS</p>");
	});

	it("escapes HTML in data values by default (XSS prevention)", () => {
		const template = "<p>{{name}}</p>";
		const data = { name: '<script>alert("xss")</script>' };

		const result = populateTemplate(template, data);
		expect(result).not.toContain("<script>");
		expect(result).toContain("&lt;script&gt;");
	});

	it("allows triple-stache for unescaped HTML when needed", () => {
		const template = "<div>{{{htmlContent}}}</div>";
		const data = { htmlContent: "<strong>Bold</strong>" };

		const result = populateTemplate(template, data);
		expect(result).toContain("<strong>Bold</strong>");
	});

	it("handles missing placeholders gracefully (empty string)", () => {
		const template = "<h1>{{title}}</h1><p>{{missing}}</p>";
		const data = { title: "Present" };

		const result = populateTemplate(template, data);
		expect(result).toBe("<h1>Present</h1><p></p>");
	});

	it("handles nested data objects", () => {
		const template = "<p>{{instructor.name}} - {{instructor.role}}</p>";
		const data = { instructor: { name: "Dr. Smith", role: "Lead" } };

		const result = populateTemplate(template, data);
		expect(result).toBe("<p>Dr. Smith - Lead</p>");
	});

	it("handles array iteration with #each helper", () => {
		const template = "<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>";
		const data = { items: ["A", "B", "C"] };

		const result = populateTemplate(template, data);
		expect(result).toBe("<ul><li>A</li><li>B</li><li>C</li></ul>");
	});

	it("returns template unchanged when data is empty", () => {
		const template = "<h1>Static Content</h1>";
		const result = populateTemplate(template, {});
		expect(result).toBe("<h1>Static Content</h1>");
	});

	it("handles empty template string", () => {
		const result = populateTemplate("", { data: "value" });
		expect(result).toBe("");
	});
});
