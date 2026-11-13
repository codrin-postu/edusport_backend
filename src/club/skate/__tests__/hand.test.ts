import { describe, expect, it } from 'vitest';
import { handResults, type HandEntry } from '../hand';

const entry: HandEntry = {
  id: 12, name: 'Cupa Reșiței', date: '2026-10-20', location: 'Reșița',
  participantData: [
    { documentId: 'p1', category: 'Juniori', placement: 2, score: 80.5 },
    { documentId: 'p2', category: 'Novice', placement: 1 },
    { documentId: 'p1', category: 'Duet' },
    'x',
  ],
};

describe('handResults', () => {
  it('one result per row of the profile, with stable numeric ids', () => {
    const rows = handResults([entry], 'p1');
    expect(rows.map((r) => [r.result_id, r.event_id, r.category, r.placement, r.total_score])).toEqual([
      [1200, 12, 'Juniori', 2, 80.5], [1201, 12, 'Duet', null, null],
    ]);
    expect(rows[0]).toMatchObject({ event_slug: null, event_name: 'Cupa Reșiței', event_date: '2026-10-20', event_location: 'Reșița', short_score: null, free_score: null, segments: [] });
  });

  it('nothing for a profile without rows or without participant data', () => {
    expect(handResults([entry], 'p3')).toEqual([]);
    expect(handResults([{ ...entry, participantData: null }], 'p1')).toEqual([]);
  });
});
