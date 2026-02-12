// ---------------------------------------------------------------------------
// Unit Tests: Hemera Entity Zod Schemas
// Task: T010 — Validate schemas with valid and invalid payloads
// ---------------------------------------------------------------------------

import {
	HtmlTemplateSchema,
	LessonSchema,
	MediaAssetSchema,
	SeminarRecordingSchema,
	SeminarSchema,
	TextContentSchema,
	UserProfileSchema,
} from "@/lib/hemera/schemas";
import { describe, expect, it } from "vitest";

// ── HtmlTemplate ──────────────────────────────────────────────────────────

describe("HtmlTemplateSchema", () => {
	const valid = {
		sourceId: "tpl-001",
		seminarId: "sem-001",
		lessonId: null,
		markup: "<h1>{{participantName}}</h1>",
		version: "1.0",
	};

	it("accepts a valid HtmlTemplate", () => {
		expect(HtmlTemplateSchema.parse(valid)).toEqual(valid);
	});

	it("rejects empty sourceId", () => {
		expect(() => HtmlTemplateSchema.parse({ ...valid, sourceId: "" })).toThrow();
	});

	it("rejects empty markup", () => {
		expect(() => HtmlTemplateSchema.parse({ ...valid, markup: "" })).toThrow();
	});

	it("rejects missing sourceId", () => {
		const { sourceId, ...rest } = valid;
		expect(() => HtmlTemplateSchema.parse(rest)).toThrow();
	});
});

// ── Seminar ───────────────────────────────────────────────────────────────

describe("SeminarSchema", () => {
	const valid = {
		sourceId: "sem-001",
		title: "TypeScript Workshop",
		description: null,
		dates: [{ start: "2026-03-01T09:00:00Z", end: "2026-03-01T17:00:00Z" }],
		instructorIds: ["usr-001"],
		lessonIds: ["les-001", "les-002"],
		recordingUrl: null,
	};

	it("accepts a valid Seminar", () => {
		expect(SeminarSchema.parse(valid)).toEqual(valid);
	});

	it("accepts with a valid recording URL", () => {
		const withUrl = { ...valid, recordingUrl: "https://stream.mux.com/abc.m3u8" };
		expect(SeminarSchema.parse(withUrl)).toEqual(withUrl);
	});

	it("rejects empty title", () => {
		expect(() => SeminarSchema.parse({ ...valid, title: "" })).toThrow();
	});

	it("rejects invalid date format", () => {
		expect(() =>
			SeminarSchema.parse({ ...valid, dates: [{ start: "not-a-date", end: "also-not" }] }),
		).toThrow();
	});

	it("rejects invalid recording URL", () => {
		expect(() => SeminarSchema.parse({ ...valid, recordingUrl: "not-a-url" })).toThrow();
	});
});

// ── UserProfile ───────────────────────────────────────────────────────────

describe("UserProfileSchema", () => {
	const valid = {
		sourceId: "usr-001",
		name: "Max Mustermann",
		email: "max@example.com",
		role: "participant" as const,
		seminarIds: ["sem-001"],
	};

	it("accepts a valid UserProfile", () => {
		expect(UserProfileSchema.parse(valid)).toEqual(valid);
	});

	it("accepts null email", () => {
		expect(UserProfileSchema.parse({ ...valid, email: null })).toBeTruthy();
	});

	it("rejects invalid email format", () => {
		expect(() => UserProfileSchema.parse({ ...valid, email: "not-email" })).toThrow();
	});

	it("rejects invalid role", () => {
		expect(() => UserProfileSchema.parse({ ...valid, role: "admin" })).toThrow();
	});
});

// ── Lesson ────────────────────────────────────────────────────────────────

describe("LessonSchema", () => {
	const valid = {
		sourceId: "les-001",
		seminarId: "sem-001",
		title: "Lesson 1: Intro",
		sequence: 0,
		textContentIds: ["txt-001"],
		mediaAssetIds: ["med-001"],
	};

	it("accepts a valid Lesson", () => {
		expect(LessonSchema.parse(valid)).toEqual(valid);
	});

	it("rejects negative sequence", () => {
		expect(() => LessonSchema.parse({ ...valid, sequence: -1 })).toThrow();
	});

	it("rejects missing seminarId", () => {
		const { seminarId, ...rest } = valid;
		expect(() => LessonSchema.parse(rest)).toThrow();
	});
});

// ── TextContent ───────────────────────────────────────────────────────────

describe("TextContentSchema", () => {
	const valid = {
		sourceId: "txt-001",
		entityRef: { type: "lesson" as const, id: "les-001" },
		body: "Some content text",
		contentType: "text" as const,
	};

	it("accepts a valid TextContent", () => {
		expect(TextContentSchema.parse(valid)).toEqual(valid);
	});

	it("rejects invalid entityRef type", () => {
		expect(() =>
			TextContentSchema.parse({ ...valid, entityRef: { type: "unknown", id: "x" } }),
		).toThrow();
	});

	it("rejects invalid contentType", () => {
		expect(() => TextContentSchema.parse({ ...valid, contentType: "pdf" })).toThrow();
	});
});

// ── MediaAsset ────────────────────────────────────────────────────────────

describe("MediaAssetSchema", () => {
	const valid = {
		sourceId: "med-001",
		entityRef: { type: "lesson" as const, id: "les-001" },
		mediaType: "image" as const,
		sourceUrl: "https://hemera.academy/media/img001.jpg",
		altText: "Workshop photo",
		fileSize: 204800,
	};

	it("accepts a valid MediaAsset", () => {
		expect(MediaAssetSchema.parse(valid)).toEqual(valid);
	});

	it("accepts null altText and fileSize", () => {
		expect(MediaAssetSchema.parse({ ...valid, altText: null, fileSize: null })).toBeTruthy();
	});

	it("rejects invalid sourceUrl", () => {
		expect(() => MediaAssetSchema.parse({ ...valid, sourceUrl: "not-a-url" })).toThrow();
	});

	it("rejects invalid mediaType", () => {
		expect(() => MediaAssetSchema.parse({ ...valid, mediaType: "audio" })).toThrow();
	});

	it("rejects negative fileSize", () => {
		expect(() => MediaAssetSchema.parse({ ...valid, fileSize: -100 })).toThrow();
	});
});

// ── SeminarRecording ──────────────────────────────────────────────────────

describe("SeminarRecordingSchema", () => {
	const valid = {
		seminarSourceId: "sem-001",
		muxAssetId: "asset-abc123",
		muxPlaybackUrl: "https://stream.mux.com/abc123.m3u8",
		recordingDate: "2026-02-11T10:00:00Z",
	};

	it("accepts a valid SeminarRecording", () => {
		expect(SeminarRecordingSchema.parse(valid)).toEqual(valid);
	});

	it("rejects invalid muxPlaybackUrl", () => {
		expect(() => SeminarRecordingSchema.parse({ ...valid, muxPlaybackUrl: "not-a-url" })).toThrow();
	});

	it("rejects invalid recordingDate", () => {
		expect(() => SeminarRecordingSchema.parse({ ...valid, recordingDate: "not-a-date" })).toThrow();
	});

	it("rejects missing required fields", () => {
		expect(() => SeminarRecordingSchema.parse({})).toThrow();
	});
});
