// ---------------------------------------------------------------------------
// Contract: Section Parser — <section class="slide"> Extraction
// Spec: 006-participant-slides / US1
// ---------------------------------------------------------------------------
//
// These contracts define the expected behavior of the section parser.
// Implementation file: src/lib/slides/section-parser.ts
// Test file: tests/unit/section-parser.spec.ts
//
// Constitution: I (Test-First), III (Contract-First)
// ---------------------------------------------------------------------------

import { describe, it } from 'vitest';
import type { TemplateSection } from '@/lib/slides/types';

// --- Contract: parseSections ---

describe('parseSections', () => {
  // Signature: parseSections(html: string): TemplateSection[]

  it('extracts a single section', () => {
    const html = '<section class="slide"><h1>Title</h1></section>';
    // Expected: 1 section with body '<h1>Title</h1>', index 0
  });

  it('extracts multiple sections in order', () => {
    const html = `
      <section class="slide"><h1>First</h1></section>
      <section class="slide"><h1>Second</h1></section>
    `;
    // Expected: 2 sections with indices 0 and 1
  });

  it('ignores HTML content outside sections', () => {
    const html = '<div>Ignored</div><section class="slide"><p>Kept</p></section><footer>Also ignored</footer>';
    // Expected: 1 section with body '<p>Kept</p>'
  });

  it('treats entire body as implicit section when no section tags present', () => {
    const html = '<div><h1>{participant:name}</h1><p>Some content</p></div>';
    // Expected: 1 section with the full HTML as body, index 0
  });

  it('handles sections with additional attributes', () => {
    const html = '<section class="slide" data-topic="video"><h1>Test</h1></section>';
    // Expected: 1 section extracted correctly
  });

  it('handles whitespace variations in class attribute', () => {
    const html = '<section  class="slide" ><p>Content</p></section>';
    // Expected: 1 section
  });

  it('returns empty body for empty sections', () => {
    const html = '<section class="slide"></section>';
    // Expected: 1 section with empty body
  });

  it('classifies placeholders within each section', () => {
    const html = `
      <section class="slide">
        <h1>{courseTitle}</h1>
        <p>{participant:name} - {participant:desiredResults}</p>
      </section>
    `;
    // Expected: 1 section with:
    //   scalars: ['courseTitle']
    //   collections: Map { 'participant' => ['name', 'desiredResults'] }
  });

  it('preserves inner HTML structure', () => {
    const html = '<section class="slide"><div><p>Nested <strong>bold</strong></p></div></section>';
    // Expected: body = '<div><p>Nested <strong>bold</strong></p></div>'
  });

  it('does not match section tags without slide class', () => {
    const html = '<section class="other"><p>Not a slide</p></section>';
    // Expected: treated as implicit section (no <section class="slide"> found)
  });
});

// --- Contract: hasSectionTags ---

describe('hasSectionTags', () => {
  // Signature: hasSectionTags(html: string): boolean

  it('returns true when section class="slide" tags exist', () => {
    const html = '<section class="slide"><p>Content</p></section>';
    // Expected: true
  });

  it('returns false for plain HTML without section tags', () => {
    const html = '<div><p>Content</p></div>';
    // Expected: false
  });

  it('returns false for section tags without slide class', () => {
    const html = '<section class="content"><p>Content</p></section>';
    // Expected: false
  });
});
