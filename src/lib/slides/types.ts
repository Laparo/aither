// ---------------------------------------------------------------------------
// Slide Generation — Types
// Task: T001 — SlideJob, SlideType enum, SlideGenerationResult
// ---------------------------------------------------------------------------

/** Discriminator for the different slide categories. */
export type SlideType = "intro" | "curriculum" | "material";

/** Represents a single slide generation execution (transient, in-memory). */
export interface SlideJob {
	jobId: string;
	startTime: string;
	endTime: string | null;
	status: "running" | "success" | "failed";
	slidesGenerated: number;
	errors: SlideError[];
}

export interface SlideError {
	slide: string;
	message: string;
	timestamp: string;
}

/** Result returned after slide generation completes. */
export interface SlideGenerationResult {
	slidesGenerated: number;
	courseTitle: string;
	courseId: string;
	slides: GeneratedSlide[];
}

/** Metadata for a single generated slide file. */
export interface GeneratedSlide {
	filename: string;
	type: SlideType;
	title: string;
}
