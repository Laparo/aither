// ---------------------------------------------------------------------------
// Contract: Template Engine — Placeholder Parsing & Replacement
// Spec: 006-participant-slides / US1 (parsing), US2 (scalar), US3 (collection)
// ---------------------------------------------------------------------------
//
// These contracts define the expected behavior of the template engine.
// Implementation files: src/lib/slides/template-engine.ts
// Test file: tests/unit/template-engine.spec.ts
//
// Constitution: I (Test-First), III (Contract-First)
// ---------------------------------------------------------------------------

import { describe, it } from 'vitest';
import type { ParsedPlaceholder } from '@/lib/slides/types';

// --- Contract: parsePlaceholders ---

describe('parsePlaceholders', () => {
  // Signature: parsePlaceholders(html: string): ParsedPlaceholder[]

  it('extracts scalar placeholders', () => {
    const html = '<h1>{courseTitle}</h1>';
    // Expected: [{ raw: '{courseTitle}', type: 'scalar', key: 'courseTitle' }]
  });

  it('extracts collection placeholders with colon separator', () => {
    const html = '<p>{participant:name}</p>';
    // Expected: [{ raw: '{participant:name}', type: 'collection', key: 'participant', field: 'name' }]
  });

  it('extracts multiple distinct placeholders', () => {
    const html = '<h1>{courseTitle}</h1><p>{participant:name} - {participant:desiredResults}</p>';
    // Expected: 3 placeholders (1 scalar + 2 collection)
  });

  it('deduplicates identical placeholders', () => {
    const html = '{courseTitle} and {courseTitle}';
    // Expected: 1 unique placeholder
  });

  it('ignores content without braces', () => {
    const html = '<p>No placeholders here</p>';
    // Expected: []
  });

  it('extracts placeholders inside HTML attributes', () => {
    const html = '<img alt="{participant:name}" />';
    // Expected: 1 collection placeholder
  });

  it('ignores CSS properties that look like placeholders', () => {
    // Regex should only match alphanumeric identifiers, not CSS like {color: red}
    const html = '<style>body { color: red; }</style><p>{courseTitle}</p>';
    // Expected: only {courseTitle}, not CSS declarations
  });

  it('handles nested braces gracefully (no match)', () => {
    const html = '{participant:{name}}';
    // Expected: no valid placeholder extracted (nested braces are out of scope)
  });
});

// --- Contract: replaceScalars ---

describe('replaceScalars', () => {
  // Signature: replaceScalars(html: string, scalars: Record<string, string>): string

  it('replaces a single scalar placeholder', () => {
    const html = '<h1>{courseTitle}</h1>';
    const scalars = { courseTitle: 'Gehaltsverhandlung meistern' };
    // Expected: '<h1>Gehaltsverhandlung meistern</h1>'
  });

  it('replaces multiple occurrences of the same placeholder', () => {
    const html = '{courseTitle} - {courseTitle}';
    const scalars = { courseTitle: 'Test' };
    // Expected: 'Test - Test'
  });

  it('replaces null/undefined values with em-dash', () => {
    const html = '{courseStartDate}';
    const scalars = { courseStartDate: '—' }; // pre-mapped by buildSlideContext
    // Expected: '—'
  });

  it('leaves unknown placeholders unchanged', () => {
    const html = '{unknownField}';
    const scalars = { courseTitle: 'Test' };
    // Expected: '{unknownField}'
  });

  it('HTML-escapes replaced values', () => {
    const html = '{courseTitle}';
    const scalars = { courseTitle: '<script>alert("xss")</script>' };
    // Expected: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
  });
});

// --- Contract: replaceCollection ---

describe('replaceCollection', () => {
  // Signature: replaceCollection(
  //   sectionHtml: string,
  //   collectionName: string,
  //   records: Record<string, string>[],
  //   scalars: Record<string, string>
  // ): string[]

  it('produces one HTML string per record', () => {
    const html = '<h1>{participant:name}</h1>';
    const records = [
      { name: 'Anna Müller' },
      { name: 'Ben Fischer' },
    ];
    // Expected: 2 strings, each with the respective name
  });

  it('replaces scalar placeholders identically in each iteration', () => {
    const html = '<h1>{courseTitle} — {participant:name}</h1>';
    const records = [{ name: 'Anna' }];
    const scalars = { courseTitle: 'Test' };
    // Expected: ['<h1>Test — Anna</h1>']
  });

  it('returns empty array for empty collection', () => {
    const html = '<h1>{participant:name}</h1>';
    const _records: Record<string, string>[] = [];
    // Expected: []
  });

  it('replaces null field values with em-dash', () => {
    const html = '{participant:preparationIntent}';
    const records = [{ preparationIntent: '—' }]; // pre-mapped
    // Expected: ['—']
  });

  it('HTML-escapes all replaced values', () => {
    const html = '{participant:name}';
    const records = [{ name: '<b>Bold</b>' }];
    // Expected: ['&lt;b&gt;Bold&lt;/b&gt;']
  });

  it('leaves non-matching collection placeholders unchanged', () => {
    const html = '{instructor:name}';
    // When processing 'participant' collection, {instructor:name} stays unchanged
    const records = [{ name: 'Anna' }];
    // Expected: ['{instructor:name}'] — collection type mismatch
  });
});
