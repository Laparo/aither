// ---------------------------------------------------------------------------
// Contract: Identifier Distribution — Mode B slide generation
// Spec: 006-participant-slides / US7 (Mode B)
// ---------------------------------------------------------------------------
//
// These contracts define the expected behavior of identifier-based distribution.
// Implementation file: src/lib/slides/identifier-distributor.ts
// Test file: tests/unit/identifier-distributor.spec.ts
//
// Constitution: I (Test-First), III (Contract-First), VII (Stateless)
// ---------------------------------------------------------------------------

import { describe, it } from 'vitest';
import type { CollectionRecord, DistributedSlide } from '@/lib/slides/types';

// --- Contract: distributeByIdentifier ---

describe('distributeByIdentifier', () => {
  // Signature: distributeByIdentifier(
  //   template: string,
  //   identifier: string,
  //   collectionName: string,
  //   records: CollectionRecord[],
  //   scalars: Record<string, string>
  // ): DistributedSlide[]

  it('produces one slide per participant with sequential naming', () => {
    const template = '<div>{participant:name}</div>';
    const identifier = 'video-analysis';
    const collectionName = 'participant';
    const records: CollectionRecord[] = [
      { name: 'Anna Müller', status: 'CONFIRMED', preparationIntent: 'Selbstbewusster auftreten', desiredResults: 'Gehaltserhöhung', lineManagerProfile: 'Datengetrieben', preparationCompleted: '—' },
      { name: 'Ben Fischer', status: 'CONFIRMED', preparationIntent: 'Klarere Argumente', desiredResults: 'Beförderung', lineManagerProfile: 'Kooperativ', preparationCompleted: 'Ja' },
      { name: 'Clara Hofmann', status: 'CONFIRMED', preparationIntent: '—', desiredResults: '—', lineManagerProfile: '—', preparationCompleted: '—' },
    ];
    const scalars = { courseTitle: 'Gehaltsverhandlung meistern', courseLevel: 'ADVANCED', participantCount: '3' };
    // Expected: 3 slides
    // [0]: { identifier: 'video-analysis', participantIndex: 0, filename: 'video-analysis-01.html', html: '<div>Anna Müller</div>' }
    // [1]: { identifier: 'video-analysis', participantIndex: 1, filename: 'video-analysis-02.html', html: '<div>Ben Fischer</div>' }
    // [2]: { identifier: 'video-analysis', participantIndex: 2, filename: 'video-analysis-03.html', html: '<div>Clara Hofmann</div>' }
  });

  it('replaces both scalar and collection placeholders in each instance', () => {
    const template = '<h1>{courseTitle}</h1><p>{participant:name}</p><p>{participant:preparationIntent}</p>';
    const identifier = 'certificate';
    const collectionName = 'participant';
    const records: CollectionRecord[] = [
      { name: 'Anna Müller', preparationIntent: 'Selbstbewusster auftreten' },
    ];
    const scalars = { courseTitle: 'Gehaltsverhandlung meistern' };
    // Expected: 1 slide
    // [0]: { ..., html: '<h1>Gehaltsverhandlung meistern</h1><p>Anna Müller</p><p>Selbstbewusster auftreten</p>' }
  });

  it('enforces 1:1 invariant — record count must match, logs Rollbar warning on mismatch', () => {
    const template = '<div>{participant:name}</div>';
    const identifier = 'video-analysis';
    const collectionName = 'participant';
    const records: CollectionRecord[] = [
      { name: 'Anna Müller' },
      { name: 'Ben Fischer' },
    ];
    const scalars = {};
    // Note: curriculumLinkCount would be 3 but only 2 records available
    // Expected: Log warning via Rollbar, still produce slides for available records
    // Result: 2 slides (one per record), third link gets no slide
  });

  it('generates zero-padded file names based on record count digits', () => {
    const template = '<div>{participant:name}</div>';
    const identifier = 'feedback';
    const collectionName = 'participant';
    const records: CollectionRecord[] = Array.from({ length: 12 }, (_, i) => ({
      name: `Teilnehmer ${i + 1}`,
    }));
    const scalars = {};
    // Expected file names: 'feedback-01.html' through 'feedback-12.html'
    // (2-digit padding because 12 records)
  });

  it('produces empty array when no records', () => {
    const template = '<div>{participant:name}</div>';
    const identifier = 'video-analysis';
    const collectionName = 'participant';
    const records: CollectionRecord[] = [];
    const scalars = {};
    // Expected: []
  });

  it('HTML-escapes all replaced values', () => {
    const template = '<p>{participant:name}</p>';
    const identifier = 'cert';
    const collectionName = 'participant';
    const records: CollectionRecord[] = [{ name: '<script>alert("xss")</script>' }];
    const scalars = {};
    // Expected: html contains '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
  });

  it('preserves non-placeholder content unchanged', () => {
    const template = '<div class="title"><img src="logo.png" /><h1>{courseTitle}</h1><p>Teilnehmer: {participant:name}</p></div>';
    const identifier = 'cert';
    const collectionName = 'participant';
    const records: CollectionRecord[] = [{ name: 'Anna Müller' }];
    const scalars = { courseTitle: 'React Workshop' };
    // Expected: '<div class="title"><img src="logo.png" /><h1>React Workshop</h1><p>Teilnehmer: Anna Müller</p></div>'
  });
});
