// ---------------------------------------------------------------------------
// Contract: Mode Detection — Automatic Mode A / Mode B / Scalar-Only
// Spec: 006-participant-slides / US4, US7
// ---------------------------------------------------------------------------
//
// These contracts define the expected behavior of mode detection.
// Implementation file: src/lib/slides/mode-detector.ts
// Test file: tests/unit/mode-detector.spec.ts
//
// Constitution: I (Test-First), III (Contract-First)
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

// --- Types ---

type ReplacementMode = 'section-iteration' | 'identifier-distribution' | 'scalar-only';

// --- Contract: detectMode ---

describe('detectMode', () => {
  // Signature: detectMode(
  //   htmlContent: string,
  //   curriculumLinkCount: number,
  //   hasCollectionPlaceholders: boolean
  // ): ReplacementMode

  it('returns section-iteration when <section class="slide"> tags are present', () => {
    const html = '<section class="slide"><p>{participant:name}</p></section>';
    const linkCount = 1;
    const hasCollection = true;
    // Expected: 'section-iteration'
  });

  it('returns section-iteration even when link count > 1 if section tags exist', () => {
    // Section tags take precedence over identifier grouping
    const html = '<section class="slide"><p>{participant:name}</p></section>';
    const linkCount = 5;
    const hasCollection = true;
    // Expected: 'section-iteration' (Mode A takes precedence)
  });

  it('returns identifier-distribution for multi-linked template without sections', () => {
    const html = '<div>{participant:name}</div>';
    const linkCount = 3;
    const hasCollection = true;
    // Expected: 'identifier-distribution'
  });

  it('returns scalar-only for multi-linked template without collection placeholders', () => {
    const html = '<div>{courseTitle}</div>';
    const linkCount = 3;
    const hasCollection = false;
    // Expected: 'scalar-only'
  });

  it('returns section-iteration (implicit) for single-linked template with collection placeholders', () => {
    const html = '<div>{participant:name}</div>';
    const linkCount = 1;
    const hasCollection = true;
    // Expected: 'section-iteration' (entire body as implicit section)
  });

  it('returns scalar-only when no collection placeholders and no sections', () => {
    const html = '<div>{courseTitle}</div>';
    const linkCount = 1;
    const hasCollection = false;
    // Expected: 'scalar-only'
  });

  it('returns section-iteration for section-based template even without collection placeholders', () => {
    const html = '<section class="slide"><h1>{courseTitle}</h1></section>';
    const linkCount = 1;
    const hasCollection = false;
    // Expected: 'section-iteration' — sections present takes precedence (Mode Detection Rule #1)
    // Each section produces 1 slide with scalar replacement only.
  });
});

// --- Contract: groupMaterialsByIdentifier ---

describe('groupMaterialsByIdentifier', () => {
  // Signature: groupMaterialsByIdentifier(
  //   topics: Array<{ topicId: string; materials: Array<{ materialId: string; identifier: string; htmlContent: string | null }> }>
  // ): Map<string, MaterialWithLinks>

  it('groups materials that appear in multiple topics', () => {
    const topics = [
      {
        topicId: 'topic-1',
        materials: [{ materialId: 'mat-1', identifier: 'video-analysis', title: 'VA', sortOrder: 1, htmlContent: '<div>Template</div>' }],
      },
      {
        topicId: 'topic-2',
        materials: [{ materialId: 'mat-1', identifier: 'video-analysis', title: 'VA', sortOrder: 1, htmlContent: '<div>Template</div>' }],
      },
      {
        topicId: 'topic-3',
        materials: [{ materialId: 'mat-1', identifier: 'video-analysis', title: 'VA', sortOrder: 1, htmlContent: '<div>Template</div>' }],
      },
    ];
    // Expected: Map with 1 entry: 'mat-1' → { materialId: 'mat-1', identifier: 'video-analysis', curriculumLinkCount: 3, htmlContent: '<div>Template</div>' }
  });

  it('keeps single-linked materials separate', () => {
    const topics = [
      {
        topicId: 'topic-1',
        materials: [
          { materialId: 'mat-1', identifier: 'intro', title: 'Intro', sortOrder: 1, htmlContent: '<p>Intro</p>' },
          { materialId: 'mat-2', identifier: 'video-analysis', title: 'VA', sortOrder: 2, htmlContent: '<div>VA</div>' },
        ],
      },
    ];
    // Expected: Map with 2 entries, both with curriculumLinkCount: 1
  });

  it('handles materials with null htmlContent', () => {
    const topics = [
      { topicId: 'topic-1', materials: [{ materialId: 'mat-1', identifier: 'broken', title: 'Broken', sortOrder: 1, htmlContent: null }] },
    ];
    // Expected: Map with 1 entry, htmlContent: null
  });

  it('returns empty map for empty topics', () => {
    const topics: Array<{ topicId: string; materials: never[] }> = [];
    // Expected: empty Map
  });
});
