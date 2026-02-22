// ---------------------------------------------------------------------------
// Contract Tests: Hemera ServiceCourseDetail Response
// Task: T009 [US1] — Validates ServiceCourseDetailResponseSchema shape
// including participants with preparation fields
// ---------------------------------------------------------------------------

import {
	ServiceCourseDetailResponseSchema,
	ServiceCourseDetailSchema,
	ServiceParticipantSchema,
} from "@/lib/hemera/schemas";
import { describe, expect, it } from "vitest";

describe("Hemera ServiceCourseDetail Contract", () => {
	const validParticipant = {
		participationId: "cp_abc123",
		userId: "user_clerk_001",
		name: "Maria Schmidt",
		status: "CONFIRMED",
		preparationIntent: "Ich möchte lernen, wie ich Gehaltsgespräche besser führen kann.",
		desiredResults: "Mehr Selbstbewusstsein in Verhandlungssituationen",
		lineManagerProfile: "Direkte Vorgesetzte, 3 Jahre Erfahrung",
		preparationCompletedAt: "2026-02-15T10:30:00.000Z",
	};

	const validCourseDetail = {
		id: "cm5abc123def456ghi",
		title: "Gehaltsgespräch meistern",
		slug: "gehaltsgespraech-meistern",
		level: "INTERMEDIATE" as const,
		startDate: "2026-03-15T09:00:00.000Z",
		endDate: "2026-03-15T17:00:00.000Z",
		participants: [validParticipant],
	};

	const validResponse = {
		success: true,
		data: validCourseDetail,
		meta: {
			requestId: "req-test-001",
			timestamp: "2026-02-21T14:30:00.000Z",
		},
	};

	describe("ServiceParticipantSchema", () => {
		it("validates a complete participant with all preparation fields", () => {
			const result = ServiceParticipantSchema.safeParse(validParticipant);
			expect(result.success).toBe(true);
		});

		it("accepts nullable fields as null", () => {
			const nullableParticipant = {
				...validParticipant,
				name: null,
				preparationIntent: null,
				desiredResults: null,
				lineManagerProfile: null,
				preparationCompletedAt: null,
			};

			const result = ServiceParticipantSchema.safeParse(nullableParticipant);
			expect(result.success).toBe(true);
		});

		it("rejects missing required fields", () => {
			const { participationId, ...incomplete } = validParticipant;
			const result = ServiceParticipantSchema.safeParse(incomplete);
			expect(result.success).toBe(false);
		});

		it("rejects missing userId field", () => {
			const { userId, ...incomplete } = validParticipant;
			const result = ServiceParticipantSchema.safeParse(incomplete);
			expect(result.success).toBe(false);
		});
	});

	describe("ServiceCourseDetailSchema", () => {
		it("validates a course with participants", () => {
			const result = ServiceCourseDetailSchema.safeParse(validCourseDetail);
			expect(result.success).toBe(true);
		});

		it("validates a course with empty participants array", () => {
			const result = ServiceCourseDetailSchema.safeParse({
				...validCourseDetail,
				participants: [],
			});
			expect(result.success).toBe(true);
		});

		it("validates a course with multiple participants", () => {
			const result = ServiceCourseDetailSchema.safeParse({
				...validCourseDetail,
				participants: [
					validParticipant,
					{
						...validParticipant,
						participationId: "cp_def456",
						userId: "user_clerk_002",
						name: null,
						preparationCompletedAt: null,
					},
				],
			});
			expect(result.success).toBe(true);
		});

		it("rejects invalid level enum value", () => {
			const result = ServiceCourseDetailSchema.safeParse({
				...validCourseDetail,
				level: "EXPERT",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("ServiceCourseDetailResponseSchema", () => {
		it("validates the full Hemera response envelope", () => {
			const result = ServiceCourseDetailResponseSchema.safeParse(validResponse);
			expect(result.success).toBe(true);
		});

		it("validates response with optional meta fields", () => {
			const result = ServiceCourseDetailResponseSchema.safeParse({
				success: true,
				data: validCourseDetail,
			});
			expect(result.success).toBe(true);
		});

		it("validates that participants include preparation fields", () => {
			const result = ServiceCourseDetailResponseSchema.safeParse(validResponse);
			expect(result.success).toBe(true);

			if (result.success) {
				const participant = result.data.data.participants[0];
				expect(participant.preparationIntent).toBe(validParticipant.preparationIntent);
				expect(participant.desiredResults).toBe(validParticipant.desiredResults);
				expect(participant.lineManagerProfile).toBe(validParticipant.lineManagerProfile);
				expect(participant.preparationCompletedAt).toBe(validParticipant.preparationCompletedAt);
			}
		});
	});
});
