# Data Model: 006 — Participant Slides

**Date**: 2026-02-27 | **Spec**: `specs/006-participant-slides/spec.md`

> Aither is stateless (Constitution Principle VII). There is no local database.
> All entities below are **in-memory TypeScript types** used during slide generation.

## Entities

### SlideContext

The central data context passed to the template engine. Built from `ServiceCourseDetail` + `ServiceMaterialsResponse`.

```typescript
interface SlideContext {
  /** Flat scalar values available as {key} placeholders */
  scalars: Record<string, string>;
  /** Named collections available as {collection:field} placeholders */
  collections: Record<string, CollectionRecord[]>;
}

type CollectionRecord = Record<string, string>;
```

**Fields**:
| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `scalars.courseTitle` | `string` | `ServiceCourseDetail.title` | Course title |
| `scalars.courseSlug` | `string` | `ServiceCourseDetail.slug` | Course URL slug |
| `scalars.courseLevel` | `string` | `ServiceCourseDetail.level` | BEGINNER / INTERMEDIATE / ADVANCED |
| `scalars.courseStartDate` | `string` | `ServiceCourseDetail.startDate` | ISO date or "—" |
| `scalars.courseEndDate` | `string` | `ServiceCourseDetail.endDate` | ISO date or "—" |
| `scalars.participantCount` | `string` | `ServiceCourseDetail.participants.length` | Number as string |
| `collections.participant` | `CollectionRecord[]` | `ServiceCourseDetail.participants` | Participant records |

**Participant CollectionRecord fields**:
| Key | Source | Null handling |
|-----|--------|---------------|
| `name` | `ServiceParticipant.name` | `"—"` |
| `status` | `ServiceParticipant.status` | Always present |
| `preparationIntent` | `ServiceParticipant.preparationIntent` | `"—"` |
| `desiredResults` | `ServiceParticipant.desiredResults` | `"—"` |
| `lineManagerProfile` | `ServiceParticipant.lineManagerProfile` | `"—"` |
| `preparationCompleted` | `preparationCompletedAt !== null ? "Ja" : "—"` | Derived |

---

### TemplateSection

Represents a parsed `<section class="slide">` block from a material HTML page.

```typescript
interface TemplateSection {
  /** Raw HTML content inside the <section> tags */
  body: string;
  /** Scalar placeholder names found (e.g., ["courseTitle", "courseLevel"]) */
  scalars: string[];
  /** Collection placeholders grouped by object type */
  collections: Map<string, string[]>;
  /** Index of this section within the page (0-based) */
  index: number;
}
```

**Validation Rules**:
- `body` must be non-empty string
- `scalars` and `collections` are extracted via regex `/{([a-zA-Z][a-zA-Z0-9]*(?::[a-zA-Z][a-zA-Z0-9]*)?)}/g`
- At most **one** collection type per section (e.g., only `participant`, not mixed with `instructor`)
- If multiple collection types found, the **first** encountered type is used (others ignored)

---

### ParsedPlaceholder

Intermediate representation of a single `{...}` token.

```typescript
interface ParsedPlaceholder {
  /** Full match string including braces, e.g., "{participant:name}" */
  raw: string;
  /** Type: 'scalar' or 'collection' */
  type: 'scalar' | 'collection';
  /** For scalar: the key name. For collection: the object type. */
  key: string;
  /** For collection: the field name. Undefined for scalar. */
  field?: string;
}
```

---

### MaterialWithLinks

Represents a material template with its curriculum link metadata, used for mode detection.

```typescript
interface MaterialWithLinks {
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
```

**Derivation**: Built by grouping the flat `topics[].materials[]` response from the materials API by `materialId`.

---

### DistributedSlide

Represents a single output slide produced by Mode B distribution.

```typescript
interface DistributedSlide {
  /** Output filename, e.g., "video-analysis-01.html" */
  filename: string;
  /** Processed HTML with all placeholders replaced */
  html: string;
  /** Which participant record was assigned (0-based index) */
  participantIndex: number;
  /** The identifier used for grouping */
  identifier: string;
}
```

---

### ReplacementMode

Discriminated union for mode detection result.

```typescript
type ReplacementMode = 'section-iteration' | 'identifier-distribution' | 'scalar-only';
```

| Value | Trigger | Behavior |
|-------|---------|----------|
| `section-iteration` | `<section class="slide">` tags present, OR implicit single section | Mode A: iterate sections, expand collections |
| `identifier-distribution` | Same materialId linked N>1 times in curriculum + collection placeholders + no sections | Mode B: one instance per participant |
| `scalar-only` | No collection placeholders | Simple replacement, 1 output per section/page |

---

### SlideGenerationEvent

Structured log event emitted after generation completes.

```typescript
interface SlideGenerationEvent {
  /** Event name for structured logging */
  event: 'slides.generated';
  /** Course ID being processed */
  courseId: string;
  /** Total number of slides generated (all types) */
  totalSlides: number;
  /** Number of material slides (template-processed) */
  materialSlides: number;
  /** Number of sections skipped (e.g., hash unchanged, empty) */
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
```

---

## External API Schemas (Zod — new)

### ServiceMaterialsResponseSchema

New Zod schema for validating the hemera materials endpoint response.

```typescript
const ServiceMaterialSchema = z.object({
  materialId: z.string(),
  identifier: z.string(),
  title: z.string(),
  sortOrder: z.number(),
  htmlContent: z.string().nullable(),
});

const ServiceMaterialTopicSchema = z.object({
  topicId: z.string(),
  topicTitle: z.string(),
  materials: z.array(ServiceMaterialSchema),
});

const ServiceMaterialsDataSchema = z.object({
  courseId: z.string(),
  topics: z.array(ServiceMaterialTopicSchema),
});

const ServiceMaterialsResponseSchema = z.object({
  success: z.boolean(),
  data: ServiceMaterialsDataSchema,
  meta: z.object({
    requestId: z.string().optional(),
    timestamp: z.string().optional(),
    version: z.string().optional(),
  }).optional(),
});
```

---

## Entity Relationships

```
ServiceCourseDetail (hemera API)
├── scalars → SlideContext.scalars
├── participants[] → SlideContext.collections["participant"]
│
ServiceMaterialsResponse (hemera API)
├── topics[].materials[] → MaterialWithLinks (grouped by materialId)
│   ├── Mode Detection → ReplacementMode
│   ├── section-iteration → TemplateSection[] → output slides
│   └── identifier-distribution → DistributedSlide[] → output slides
│
SlideGenerationEvent (observability)
└── emitted at end of generate()
```

## State Transitions

No persistent state. All data flows are:
```
API Fetch → In-Memory Transform → HTML File Output
```

The only "state" is the filesystem output directory (`output/slides/{courseId}/`), which is **deleted and recreated** on every generation run (Clean + Regenerate).
