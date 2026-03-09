// ---------------------------------------------------------------------------
// Unit Tests: Template Engine — parsePlaceholders, replaceScalars, replaceCollection
// Contract: specs/006-participant-slides/contracts/template-engine.contract.ts
// Constitution: §I Test-First, §III Contract-First
// ---------------------------------------------------------------------------

import { parsePlaceholders, replaceCollection, replaceScalars } from "@/lib/slides/template-engine";
import type { ParsedPlaceholder } from "@/lib/slides/types";
import { describe, expect, it } from "vitest";

// --- parsePlaceholders (US1 — T008) ---

describe("parsePlaceholders", () => {
	it("extracts scalar placeholders", () => {
		const html = "<h1>{courseTitle}</h1>";
		const result = parsePlaceholders(html);

		expect(result).toEqual<ParsedPlaceholder[]>([
			{ raw: "{courseTitle}", type: "scalar", key: "courseTitle" },
		]);
	});

	it("extracts collection placeholders with colon separator", () => {
		const html = "<p>{participant:name}</p>";
		const result = parsePlaceholders(html);

		expect(result).toEqual<ParsedPlaceholder[]>([
			{
				raw: "{participant:name}",
				type: "collection",
				key: "participant",
				field: "name",
			},
		]);
	});

	it("extracts multiple distinct placeholders", () => {
		const html = "<h1>{courseTitle}</h1><p>{participant:name} - {participant:desiredResults}</p>";
		const result = parsePlaceholders(html);

		expect(result).toHaveLength(3);
		expect(result[0]).toMatchObject({ type: "scalar", key: "courseTitle" });
		expect(result[1]).toMatchObject({
			type: "collection",
			key: "participant",
			field: "name",
		});
		expect(result[2]).toMatchObject({
			type: "collection",
			key: "participant",
			field: "desiredResults",
		});
	});

	it("deduplicates identical placeholders", () => {
		const html = "{courseTitle} and {courseTitle}";
		const result = parsePlaceholders(html);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ raw: "{courseTitle}", type: "scalar" });
	});

	it("ignores content without braces", () => {
		const html = "<p>No placeholders here</p>";
		const result = parsePlaceholders(html);

		expect(result).toEqual([]);
	});

	it("extracts placeholders inside HTML attributes", () => {
		const html = '<img alt="{participant:name}" />';
		const result = parsePlaceholders(html);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			type: "collection",
			key: "participant",
			field: "name",
		});
	});

	it("ignores CSS properties that look like placeholders", () => {
		const html = "<style>body { color: red; }</style><p>{courseTitle}</p>";
		const result = parsePlaceholders(html);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ raw: "{courseTitle}", type: "scalar" });
	});

	it("ignores minified CSS that resembles collection placeholders", () => {
		const html = "<style>body{color:red}</style><p>{participant:name}</p>";
		const result = parsePlaceholders(html);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			raw: "{participant:name}",
			type: "collection",
			key: "participant",
			field: "name",
		});
	});

	it("handles nested braces gracefully (no match)", () => {
		const html = "{participant:{name}}";
		const result = parsePlaceholders(html);

		// Nested braces should not produce a valid ParsedPlaceholder
		// The inner {name} might match but the outer pattern won't
		for (const p of result) {
			expect(p.raw).not.toBe("{participant:{name}}");
		}
	});
});

// --- replaceScalars (US2 — T012) ---

describe("replaceScalars", () => {
	it("replaces a single scalar placeholder", () => {
		const html = "<h1>{courseTitle}</h1>";
		const scalars = { courseTitle: "Gehaltsverhandlung meistern" };

		expect(replaceScalars(html, scalars)).toBe("<h1>Gehaltsverhandlung meistern</h1>");
	});

	it("replaces multiple occurrences of the same placeholder", () => {
		const html = "{courseTitle} - {courseTitle}";
		const scalars = { courseTitle: "Test" };

		expect(replaceScalars(html, scalars)).toBe("Test - Test");
	});

	it("replaces null/undefined values with em-dash (pre-mapped)", () => {
		const html = "{courseStartDate}";
		const scalars = { courseStartDate: "—" };

		expect(replaceScalars(html, scalars)).toBe("—");
	});

	it("leaves unknown placeholders unchanged", () => {
		const html = "{unknownField}";
		const scalars = { courseTitle: "Test" };

		expect(replaceScalars(html, scalars)).toBe("{unknownField}");
	});

	it("HTML-escapes replaced values", () => {
		const html = "{courseTitle}";
		const scalars = { courseTitle: '<script>alert("xss")</script>' };

		expect(replaceScalars(html, scalars)).toBe(
			"&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
		);
	});
});

// --- replaceCollection (US3 — T014) ---

describe("replaceCollection", () => {
	it("produces one HTML string per record", () => {
		const html = "<h1>{participant:name}</h1>";
		const records = [{ name: "Anna Müller" }, { name: "Ben Fischer" }];
		const result = replaceCollection(html, "participant", records);

		expect(result).toHaveLength(2);
		expect(result[0]).toBe("<h1>Anna Müller</h1>");
		expect(result[1]).toBe("<h1>Ben Fischer</h1>");
	});

	it("replaces scalar placeholders identically in each iteration", () => {
		const html = "<h1>{courseTitle} — {participant:name}</h1>";
		const records = [{ name: "Anna" }];
		const scalars = { courseTitle: "Test" };
		const result = replaceCollection(html, "participant", records, scalars);

		expect(result).toEqual(["<h1>Test — Anna</h1>"]);
	});

	it("returns empty array for empty collection", () => {
		const html = "<h1>{participant:name}</h1>";
		const records: Record<string, string>[] = [];
		const result = replaceCollection(html, "participant", records);

		expect(result).toEqual([]);
	});

	it("replaces null field values with em-dash (pre-mapped)", () => {
		const html = "{participant:preparationIntent}";
		const records = [{ preparationIntent: "—" }];
		const result = replaceCollection(html, "participant", records);

		expect(result).toEqual(["—"]);
	});

	it("HTML-escapes all replaced values", () => {
		const html = "{participant:name}";
		const records = [{ name: "<b>Bold</b>" }];
		const result = replaceCollection(html, "participant", records);

		expect(result).toEqual(["&lt;b&gt;Bold&lt;/b&gt;"]);
	});

	it("leaves non-matching collection placeholders unchanged", () => {
		const html = "{instructor:name}";
		const records = [{ name: "Anna" }];
		const result = replaceCollection(html, "participant", records);

		expect(result).toEqual(["{instructor:name}"]);
	});
});
