// ---------------------------------------------------------------------------
// Slide Generation — Types
// Task: T001 — SlideJob, SlideType enum, SlideGenerationResult
// Task: T003 — SlideContext, TemplateSection, ParsedPlaceholder, etc.
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

// ---------------------------------------------------------------------------
// Template Engine Types (006-participant-slides)
// ---------------------------------------------------------------------------

/** Flat key-value record for a single collection item (e.g., one participant). */
export type CollectionRecord = Record<string, string>;

/**
 * The central data context passed to the template engine.
 * Built from ServiceCourseDetail + ServiceMaterialsResponse.
 */
export interface SlideContext {
	/** Flat scalar values available as {key} placeholders */
	scalars: Record<string, string>;
	/** Named collections available as {collection:field} placeholders */
	collections: Record<string, CollectionRecord[]>;
}

/**
 * Represents a parsed <section class="slide"> block from a material HTML page.
 */
export interface TemplateSection {
	/** Raw HTML content inside the <section> tags */
	body: string;
	/** Scalar placeholder names found (e.g., ["courseTitle", "courseLevel"]) */
	scalars: string[];
	/** Collection placeholders grouped by object type */
	collections: Map<string, string[]>;
	/** Index of this section within the page (0-based) */
	index: number;
}

/**
 * Intermediate representation of a single {...} token.
 */
export interface ParsedPlaceholder {
	/** Full match string including braces, e.g., "{participant:name}" */
	raw: string;
	/** Type: 'scalar' or 'collection' */
	type: "scalar" | "collection";
	/** For scalar: the key name. For collection: the object type. */
	key: string;
	/** For collection: the field name. Undefined for scalar. */
	field?: string;
}

/**
 * Represents a material template with its curriculum link metadata.
 * Used for mode detection (Mode A vs Mode B vs scalar-only).
 */
export interface MaterialWithLinks {
	/** CourseMaterial.id (cuid) */
	materialId: string;
	/** CourseMaterial.identifier (unique, lowercase, hyphens) */
	identifier: string;
	/** Material title */
	title: string;
	/** HTML content from Vercel Blob (null if fetch failed) */
	htmlContent: string | null;
	/** Number of times this materialId appears across curriculum topics */
	curriculumLinkCount: number;
}

/**
 * Represents a single output slide produced by Mode B distribution.
 */
export interface DistributedSlide {
	/** Output filename, e.g., "video-analysis-01.html" */
	filename: string;
	/** Processed HTML with all placeholders replaced */
	html: string;
	/** Which participant record was assigned (0-based index) */
	participantIndex: number;
	/** The identifier used for grouping */
	identifier: string;
}

/**
 * Discriminated union for mode detection result.
 */
export type ReplacementMode = "section-iteration" | "identifier-distribution" | "scalar-only";

/**
 * Structured log event emitted after generation completes.
 */
export interface SlideGenerationEvent {
	/** Event name for structured logging */
	event: "slides.generated";
	/** Course ID being processed */
	courseId: string;
	/** Total number of slides generated (all types) */
	totalSlides: number;
	/** Number of material slides (template-processed) */
	materialSlides: number;
	/** Number of sections skipped (e.g., null htmlContent, empty) */
	skippedSections: number;
	/** Number of Mode A iterations performed */
	modeACount: number;
	/** Number of Mode B distributions performed */
	modeBCount: number;
	/** Total generation time in milliseconds */
	durationMs: number;
	/** Array of error messages encountered during generation */
	errors: string[];
}
