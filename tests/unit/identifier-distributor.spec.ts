// ---------------------------------------------------------------------------
// Unit Tests: Identifier Distributor — distributeByIdentifier
// Contract: specs/006-participant-slides/contracts/identifier-distribution.contract.ts
// Constitution: §I Test-First, §III Contract-First
// ---------------------------------------------------------------------------

import { distributeByIdentifier } from "@/lib/slides/identifier-distributor";
import type { CollectionRecord } from "@/lib/slides/types";
import { describe, expect, it, vi } from "vitest";

// Mock Rollbar to capture warnings
vi.mock("@/lib/monitoring/rollbar-official", () => ({
	serverInstance: { warning: vi.fn() },
}));

describe("distributeByIdentifier", () => {
	it("produces one slide per participant with sequential naming", () => {
		const template = "<div>{participant:name}</div>";
		const records: CollectionRecord[] = [
			{
				name: "Anna Müller",
				status: "CONFIRMED",
				preparationIntent: "Selbstbewusster auftreten",
				desiredResults: "Gehaltserhöhung",
				lineManagerProfile: "Datengetrieben",
				preparationCompleted: "—",
			},
			{
				name: "Ben Fischer",
				status: "CONFIRMED",
				preparationIntent: "Klarere Argumente",
				desiredResults: "Beförderung",
				lineManagerProfile: "Kooperativ",
				preparationCompleted: "Ja",
			},
			{
				name: "Clara Hofmann",
				status: "CONFIRMED",
				preparationIntent: "—",
				desiredResults: "—",
				lineManagerProfile: "—",
				preparationCompleted: "—",
			},
		];
		const scalars = {
			courseTitle: "Gehaltsverhandlung meistern",
			courseLevel: "ADVANCED",
			participantCount: "3",
		};

		const result = distributeByIdentifier(
			template,
			"video-analysis",
			"participant",
			records,
			scalars,
		);

		expect(result).toHaveLength(3);
		expect(result[0]).toMatchObject({
			identifier: "video-analysis",
			participantIndex: 0,
			filename: "video-analysis-01.html",
			html: "<div>Anna Müller</div>",
		});
		expect(result[1]).toMatchObject({
			identifier: "video-analysis",
			participantIndex: 1,
			filename: "video-analysis-02.html",
			html: "<div>Ben Fischer</div>",
		});
		expect(result[2]).toMatchObject({
			identifier: "video-analysis",
			participantIndex: 2,
			filename: "video-analysis-03.html",
			html: "<div>Clara Hofmann</div>",
		});
	});

	it("replaces both scalar and collection placeholders in each instance", () => {
		const template =
			"<h1>{courseTitle}</h1><p>{participant:name}</p><p>{participant:preparationIntent}</p>";
		const records: CollectionRecord[] = [
			{ name: "Anna Müller", preparationIntent: "Selbstbewusster auftreten" },
		];
		const scalars = { courseTitle: "Gehaltsverhandlung meistern" };

		const result = distributeByIdentifier(template, "certificate", "participant", records, scalars);

		expect(result).toHaveLength(1);
		expect(result[0].html).toBe(
			"<h1>Gehaltsverhandlung meistern</h1><p>Anna Müller</p><p>Selbstbewusster auftreten</p>",
		);
	});

	it("still produces slides for available records on count mismatch", () => {
		const template = "<div>{participant:name}</div>";
		const records: CollectionRecord[] = [{ name: "Anna Müller" }, { name: "Ben Fischer" }];

		const result = distributeByIdentifier(template, "video-analysis", "participant", records, {});

		// Produces slides for available records regardless of link count
		expect(result).toHaveLength(2);
		expect(result[0].filename).toBe("video-analysis-01.html");
		expect(result[1].filename).toBe("video-analysis-02.html");
	});

	it("generates zero-padded file names based on record count digits", () => {
		const records: CollectionRecord[] = Array.from({ length: 12 }, (_, i) => ({
			name: `Teilnehmer ${i + 1}`,
		}));

		const result = distributeByIdentifier(
			"<div>{participant:name}</div>",
			"feedback",
			"participant",
			records,
			{},
		);

		expect(result[0].filename).toBe("feedback-01.html");
		expect(result[8].filename).toBe("feedback-09.html");
		expect(result[9].filename).toBe("feedback-10.html");
		expect(result[11].filename).toBe("feedback-12.html");
	});

	it("produces empty array when no records", () => {
		const result = distributeByIdentifier(
			"<div>{participant:name}</div>",
			"video-analysis",
			"participant",
			[],
			{},
		);

		expect(result).toEqual([]);
	});

	it("HTML-escapes all replaced values", () => {
		const records: CollectionRecord[] = [{ name: '<script>alert("xss")</script>' }];

		const result = distributeByIdentifier(
			"<p>{participant:name}</p>",
			"cert",
			"participant",
			records,
			{},
		);

		expect(result[0].html).toBe("<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>");
	});

	it("preserves non-placeholder content unchanged", () => {
		const template =
			'<div class="title"><img src="logo.png" /><h1>{courseTitle}</h1><p>Teilnehmer: {participant:name}</p></div>';
		const records: CollectionRecord[] = [{ name: "Anna Müller" }];
		const scalars = { courseTitle: "React Workshop" };

		const result = distributeByIdentifier(template, "cert", "participant", records, scalars);

		expect(result[0].html).toBe(
			'<div class="title"><img src="logo.png" /><h1>React Workshop</h1><p>Teilnehmer: Anna Müller</p></div>',
		);
	});
});
