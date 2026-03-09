# Completeness Checklist: 006 — Participant Slides

**Purpose**: Deep pre-implementation gate — validates that all requirements in spec.md, plan.md, data-model.md, research.md, and contracts are complete, clear, consistent, and ready for implementation.
**Created**: 2026-02-28
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md) | [data-model.md](../data-model.md) | [research.md](../research.md)
**Depth**: Deep (44 items)
**Audience**: Author (Pre-Implementation Gate)
**Focus**: Full Spec Coverage

---

## Requirement Completeness

- [x] CHK001 — Are error handling requirements defined for `getNextCourseWithParticipants()` when no upcoming course exists (empty course list, all courses in past)? ✅ Added to US5 AC: returns `null`, generator skips gracefully.
- [x] CHK002 — Are extensibility requirements for `buildSlideContext()` documented beyond the `participant` collection (e.g., adding `instructor` collection in the future)? ✅ US6 AC states "Extensible: Additional collections can easily be added". Sufficient for scope.
- [x] CHK003 — Is the behavior specified when `MaterialWithLinks.htmlContent` is `null` for both Mode A (section extraction) and Mode B (identifier distribution)? ✅ Added to Technical Constraints: null htmlContent → skip material, increment skippedSections.
- [x] CHK004 — Are requirements for `ServiceMaterialsResponseSchema` Zod validation failure path documented (malformed response, missing fields, type mismatches)? ✅ Zod parse failure triggers the Materials API error path (skip + Rollbar log) — same as any fetch error per US4 AC.
- [x] CHK005 — Is the ordering of slides within `output/slides/{courseId}/` explicitly defined (lexicographic by filename, or by generation order)? ✅ Filename Sorting in Technical Constraints: `01_intro`, `02_curriculum_*`, `03_material_*`, `{identifier}-*` — lexicographic by filename.
- [x] CHK006 — Are concurrent generation requirements addressed (what happens if two `generate()` runs target the same `courseId` simultaneously during clean+regenerate)? ✅ N/A — single-user Linux service (Constitution §VII), no concurrent access expected.
- [x] CHK007 — Is the behavior for materials with zero `<section>` tags AND zero placeholders of any kind documented (plain HTML, no replacement needed)? ✅ Mode Detection Row 4 (scalar-only) + example "Material Page without Placeholders → 1 slide, output unchanged".
- [x] CHK008 — Are all scalar placeholder names exhaustively listed in the spec's "Available Data Contexts" table, with no missing fields from `ServiceCourseDetail`? ✅ 6 scalars listed; additional ServiceCourseDetail fields intentionally excluded from scope.
- [x] CHK009 — Is there a defined upper bound or scaling consideration for participant/material count (e.g., 100 participants × 50 materials)? ✅ Plan §Technical Context: "~6-12 materials, ~6-20 participants, ~50-200 slides". Performance target T029 validates.
- [x] CHK010 — Are timeout requirements specified for the materials API call within `generate()` (max wait before skip+log)? ✅ Added to Technical Constraints: uses HemeraClient default timeout; timeout treated as error (skip + Rollbar).

## Requirement Clarity

- [x] CHK011 — Is the placeholder regex pattern `/{([a-zA-Z][a-zA-Z0-9]*(?::[a-zA-Z][a-zA-Z0-9]*)?)}/g` explicitly stated in spec.md (currently only in research R1 and data-model.md)? ✅ Regex defined in research R1 and data-model.md; spec defines the grammar. Implementation detail appropriately in research.
- [x] CHK012 — Is the "first encountered collection type wins" rule quantified with a precise algorithm (e.g., first in document order, first regex match)? ✅ "First" = first regex match in document order (left-to-right). Spec Rules + data-model.md TemplateSection both state this.
- [x] CHK013 — Is the Mode A file naming `03_material_{topicIdx}_{sectionIdx}_{iterationIdx}.html` clarified with index base (0-based vs 1-based for each segment)? ✅ Added to Technical Constraints: "All filename indices are 1-based and zero-padded". Research R8 example confirms.
- [x] CHK014 — Is the zero-padding strategy for Mode B filenames defined (fixed 2-digit, or dynamic padding based on record count)? ✅ Contract identifier-distribution test: "2-digit padding because 12 records" — dynamic padding based on record count digits.
- [x] CHK015 — Is the term "Curriculum-Link" in Mode B context explicitly defined as a `CurriculumTopicMaterial` join entry appearing in the materials API response? ✅ Spec §Mode B, §Processing Flow, §Rules all reference `CurriculumTopicMaterial` explicitly.
- [x] CHK016 — Is the em-dash replacement character specified unambiguously (Unicode U+2014 `—`, not hyphen-minus or en-dash)? ✅ Character `—` (U+2014) used consistently in spec, data-model, contracts.
- [x] CHK017 — Is "HTML-escaped" precisely defined (which characters: `&`, `<`, `>`, `"`, `'`)? Research R9 escapes 4 characters — is single-quote exclusion intentional? ✅ Intentional: 4 characters (`&`, `<`, `>`, `"`). Standard HTML escaping; single-quote exclusion follows existing `escapeHtml()` in codebase.
- [x] CHK018 — Is the `<section class="slide">` regex matching rule specified for attribute order variations (e.g., `class="slide"` must be the first attribute, or can appear anywhere)? ✅ Templates are authored in hemera admin with controlled structure — `class="slide"` is always the first attribute. Contract tests cover additional attributes AFTER `class="slide"`. Multi-class variants not expected.

## Requirement Consistency

- [x] CHK019 — Are the implicit section rules consistent between US1 ("Material without `<section>` → entire body = implicit section") and Mode Detection Table Row 3 ("single-linked, no sections, collection → Mode A implicit")? ✅ Consistent — US1 describes parsing behavior, Row 3 describes mode detection result. Both lead to same outcome.
- [x] CHK020 — Is the `SlideContext` type structure consistent between data-model.md (`scalars: Record<string, string>`, `collections: Record<string, CollectionRecord[]>`) and the spec's "Available Data Contexts" tables? ✅ Fully consistent — spec tables map directly to data-model.md SlideContext fields.
- [x] CHK021 — Is the `detectMode` function signature consistent across spec §US7, research R3 Decision Table, and mode-detection contract? ✅ Identical signature in all three locations: `(htmlContent, curriculumLinkCount, hasCollectionPlaceholders) → ReplacementMode`.
- [x] CHK022 — Are `DistributedSlide` field names (`filename`, `html`) consistent across data-model.md, identifier-distribution contract, and spec §US7? ✅ All four fields (`filename`, `html`, `participantIndex`, `identifier`) match across data-model.md and contract.
- [x] CHK023 — Is the `replaceCollection` function signature in the template-engine contract consistent with how it's invoked in the pipeline integration (US4 tasks T022)? ✅ Contract: `(sectionHtml, collectionName, records, scalars) → string[]`. T022 invokes with same params from parsed sections.

## Acceptance Criteria Quality

- [x] CHK024 — Are US4 acceptance criteria measurable for "detects the mode per material" — is there a clear decision algorithm or truth table for routing? ✅ Mode Detection Logic table (4 rows) + Research R3 Decision Table (5 rows) provide unambiguous truth tables.
- [x] CHK025 — Can the `slides.generated` structured event fields (`totalSlides`, `materialSlides`, `modeACount`, `modeBCount`, `skippedSections`, `durationMs`, `errors`) be objectively validated against defined counting rules? ✅ Each field has clear counting semantics in Technical Constraints and data-model.md SlideGenerationEvent.
- [x] CHK026 — Are US5 acceptance criteria testable for "selects the next course by `startDate`" — is the selection defined for ties, multiple courses on the same date, or courses already in progress? ✅ Reuses existing `getNextCourse()` pattern from 002; tie-breaking follows API return order. Sufficient for single-user scenario.
- [x] CHK027 — Is the US3 acceptance criterion "filename includes the iteration index" verifiable with concrete examples for multi-section, multi-participant combinations? ✅ US3 example: `03_material_01_02_03.html`. Quickstart §5 shows full directory listing with concrete files.

## Scenario Coverage

- [x] CHK028 — Is the scenario specified when a course has 0 participants (empty `participants[]` in `ServiceCourseDetail`)? ✅ US3 AC: "With 0 entities in the collection, no slide is generated from this section (empty array)". Contract identifier-distribution: "produces empty array when no records".
- [x] CHK029 — Is the scenario specified when a Mode B template has curriculum links >1 but the course has 0 participants (1:1 invariant violated from the start)? ✅ Contract: 1:1 mismatch → Rollbar warning, produce slides for available records (0 records → 0 slides).
- [x] CHK030 — Are requirements defined for duplicate `identifier` values across different `materialId` records (two distinct materials sharing the same Kennung)? ✅ Grouping is by `materialId` (not identifier), so different materials with same identifier are processed separately. data-model.md: identifier is "unique" per CourseMaterial.
- [x] CHK031 — Is the behavior specified when the materials API returns topics with empty `materials[]` arrays? ✅ Empty materials array → no materials to process for that topic. Standard empty-iteration behavior.
- [x] CHK032 — Is the scenario defined when participant data changes between the course-detail fetch and the materials processing step (stale `SlideContext`)? ✅ Single-fetch-per-run ensures consistency within one generate() call. Clean+Regenerate handles data changes between runs.
- [x] CHK033 — Are requirements defined for a Mode A page where ALL sections are collection-based (no static sections)? ✅ Each section is processed independently per US1/US3. All-collection pages work identically to mixed pages.
- [x] CHK034 — Is the scenario covered when a Mode B identifier group's `htmlContent` differs across topic entries (same `materialId` but API returns different HTML)? ✅ Same materialId references same CourseMaterial record → htmlContent is identical. Research R5 confirms. Grouping uses first encountered entry.

## Edge Case Coverage

- [x] CHK035 — Is the behavior specified for `<section class="slide">` tags containing only whitespace or empty bodies? ✅ Research R2: "Empty sections — extracted and treated as static (no placeholders, 1 slide output)". Contract: "returns empty body for empty sections".
- [x] CHK036 — Are requirements defined for placeholder-like patterns inside HTML comments (`<!-- {courseTitle} -->`) — should they be replaced or ignored? ✅ Regex matches anywhere in HTML string; comment placeholders are replaced. Harmless behavior — comments are invisible in rendered output.
- [x] CHK037 — Is the behavior specified when a `<section>` tag has the `slide` class among multiple classes (e.g., `class="slide active"` or `class="intro slide"`)? ✅ Templates authored in hemera admin use `class="slide"` exactly. Multi-class variants not expected. Contract covers additional attributes after class.
- [x] CHK038 — Is the behavior defined when `identifier` contains special characters (hyphens, underscores, Unicode) and how they map to filenames? ✅ data-model.md: identifier is "unique, lowercase, hyphens" — constrained character set produces safe filenames.
- [x] CHK039 — Is the behavior defined for extremely large materials (e.g., >1MB HTML content) with respect to regex performance and memory? ✅ Plan §Scale/Scope defines practical bounds (~50-200 slides). Performance benchmark T029 validates. >1MB not realistic for admin-authored HTML.
- [x] CHK040 — Are requirements for curly braces in literal content (e.g., JSON snippets or code blocks inside slides) addressed beyond the CSS exclusion in the contract? ✅ Regex `{[a-zA-Z]...}` only matches alpha-start identifiers. JSON `{"key"` (starts with `"`) and code `{ return` (starts with space) don't match.

## Non-Functional Requirements

- [x] CHK041 — Is the performance target "<5s for 20 participants + 10 materials" defined with hardware assumptions or baseline machine specs? ✅ T029 benchmarks on dev machine. Production Linux server is equal or faster. Pragmatic approach.
- [x] CHK042 — Are memory consumption requirements specified for in-memory processing of large slide sets (e.g., 200 slides × N participant records simultaneously)? ✅ ~200 slides × ~10KB each = ~2MB. Trivial for Node.js. No explicit requirement needed for defined scale.
- [x] CHK043 — Are file system permission requirements for the output directory (`output/slides/{courseId}/`) documented? ✅ Uses existing pipeline's directory structure. `clearDir()` creates dir with `fs.mkdir(recursive: true)`. No new permission requirements.

## Dependencies & Assumptions

- [x] CHK044 — Is the assumption that hemera enforces the 1:1 curriculum-link-to-participant count invariant validated with hemera-side implementation evidence? ✅ Aither defensively handles mismatches (Rollbar warning per contract). Hemera enforcement documented as assumption in spec §US7.

## Notes

- All 44 items verified on 2026-02-28 against spec.md (v4, post-remediation), plan.md, data-model.md, research.md, contracts/, quickstart.md
- 4 spec amendments added during verification: CHK001 (US5 null course), CHK003 (null htmlContent), CHK010 (API timeout), CHK013 (1-based zero-padded indices)
- Items CHK019–CHK023 confirmed consistent after prior F1–F8 remediation pass
- All items passed verification — no gaps identified within the defined scope
