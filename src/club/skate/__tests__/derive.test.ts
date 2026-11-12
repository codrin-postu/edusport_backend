import { describe, expect, it } from 'vitest';
import type { SkateResult } from '../client';
import { currentCategory, fold, listRows, records, seasonKey, shortCategory, toRow } from '../derive';

function res(over: Partial<SkateResult> & { result_id?: number | null } = {}): SkateResult {
  return {
    result_id: 1,
    placement: null,
    event_id: 10,
    event_slug: null,
    event_name: 'Cupa Test',
    event_date: '2026-01-10',
    event_location: 'Reșița',
    category: 'Advanced Novice Girls',
    total_score: null,
    short_score: null,
    free_score: null,
    segments: [],
    ...over,
  };
}

describe('seasonKey', () => {
  it('starts the season in September', () => {
    expect(seasonKey('2026-10-26', 'x')).toBe('2026-2027');
  });
  it('belongs to the season before June', () => {
    expect(seasonKey('2026-06-15', 'x')).toBe('2025-2026');
  });
  it('takes the year from the name without a date', () => {
    expect(seasonKey(null, 'Winter Cup 2026')).toBe('2025-2026');
  });
  it('is null without a date or a year', () => {
    expect(seasonKey(null, 'Winter Cup')).toBeNull();
  });
});

describe('shortCategory', () => {
  it('shortens Advanced and drops a trailing gender word', () => {
    expect(shortCategory('Advanced Novice Girls')).toBe('Adv. Novice');
  });
  it('drops a trailing gender word', () => {
    expect(shortCategory('Junior Women')).toBe('Junior');
  });
  it('keeps other words', () => {
    expect(shortCategory('Senior Ice Dance')).toBe('Senior Ice Dance');
  });
});

describe('currentCategory', () => {
  it('uses the latest result of the current season and the earlier different category', () => {
    const rows = [
      res({ result_id: 1, event_date: '2026-03-01', category: 'Advanced Novice Girls' }),
      res({ result_id: 2, event_date: '2025-02-01', category: 'Basic Novice Girls' }),
    ];
    expect(currentCategory(rows, '2025-2026')).toEqual({
      current: 'Advanced Novice Girls',
      seasonLabel: '2025-2026',
      previous: { short: 'Basic Novice', sinceYear: 2025 },
    });
  });
  it('falls back to the latest result and its season when the current season has none', () => {
    const rows = [res({ event_date: '2025-03-01', category: 'Junior Women' })];
    expect(currentCategory(rows, '2026-2027')).toEqual({
      current: 'Junior Women',
      seasonLabel: '2024-2025',
      previous: null,
    });
  });
  it('is null without results', () => {
    expect(currentCategory([], '2026-2027')).toBeNull();
  });
});

describe('records', () => {
  it('counts the best total, podiums and wins, ignoring null placements', () => {
    const rows = [
      res({ placement: 1, total_score: 100.5 }),
      res({ placement: 3, total_score: 90 }),
      res({ placement: 4, total_score: 80 }),
      res({ placement: null, total_score: null }),
    ];
    expect(records(rows)).toEqual({ best: 100.5, podiums: 2, wins: 1 });
  });
  it('leaves out rows without a result id, like the list', () => {
    const rows = [res({ placement: 1, total_score: 100 }), res({ result_id: null, placement: 1, total_score: 120 })];
    expect(records(rows)).toEqual({ best: 100, podiums: 1, wins: 1 });
  });
  it('has no best without totals', () => {
    expect(records([])).toEqual({ best: null, podiums: 0, wins: 0 });
  });
});

describe('fold', () => {
  it('lower-cases and removes Romanian diacritics', () => {
    expect(fold('Brașov')).toBe('brasov');
    expect(fold('Ţară Ș ş ț ă â î')).toBe('tara s s t a a i');
  });
});

describe('listRows', () => {
  const rows = [
    res({ result_id: 1, event_name: 'Cupa României', event_location: 'Brașov', event_date: '2026-02-01', placement: 2, total_score: 95 }),
    res({ result_id: 2, event_name: 'Trofeul Nord', event_location: 'Reșița', event_date: '2025-11-05', placement: 1, total_score: 99 }),
    res({ result_id: 3, event_name: 'Open', event_location: null, event_date: null, placement: null, total_score: 80 }),
  ];
  const base = { q: '', season: null, sort: 'recent' as const, page: 1 };

  it('finds a location without diacritics', () => {
    expect(listRows(rows, { ...base, q: 'brasov' }).rows.map((r) => r.resultId)).toEqual(['1']);
  });
  it('finds an event name regardless of case', () => {
    expect(listRows(rows, { ...base, q: 'CUPA' }).rows.map((r) => r.eventName)).toEqual(['Cupa României']);
  });
  it('filters by season', () => {
    const out = listRows(rows, { ...base, season: '2025-2026' });
    expect(out.filtered).toBe(2);
    expect(out.rows.map((r) => r.resultId)).toEqual(['1', '2']);
    expect(listRows(rows, { ...base, season: '2026-2027' }).filtered).toBe(0);
  });
  it('sorts recent with null dates last', () => {
    expect(listRows(rows, base).rows.map((r) => r.resultId)).toEqual(['1', '2', '3']);
  });
  it('sorts by place, null last, then newest', () => {
    expect(listRows(rows, { ...base, sort: 'place' }).rows.map((r) => r.resultId)).toEqual(['2', '1', '3']);
  });
  it('sorts by points, highest first', () => {
    expect(listRows(rows, { ...base, sort: 'points' }).rows.map((r) => r.resultId)).toEqual(['2', '1', '3']);
  });
  it('pages 20 rows at a time', () => {
    const many = Array.from({ length: 41 }, (_, i) => res({ result_id: i + 1, event_date: '2026-01-10' }));
    const out = listRows(many, { ...base, page: 2 });
    expect(out.filtered).toBe(41);
    expect(out.rows).toHaveLength(20);
    expect(out.rows[0]?.resultId).toBe('21');
    expect(out.rows[19]?.resultId).toBe('40');
  });
  it('returns seasons distinct, newest first', () => {
    const out = listRows(
      [
        res({ result_id: 1, event_date: '2025-11-05' }),
        res({ result_id: 2, event_date: '2026-02-01' }),
        res({ result_id: 3, event_date: '2026-03-01' }),
      ],
      base,
    );
    expect(out.seasons).toEqual(['2025-2026']);
  });
  it('drops rows without a result id', () => {
    const out = listRows([res({ result_id: null }), res({ result_id: 7 })], base);
    expect(out.filtered).toBe(1);
    expect(out.rows.map((r) => r.resultId)).toEqual(['7']);
  });
});

describe('toRow', () => {
  it('maps a result to a row with the id as a string', () => {
    expect(toRow(res({ result_id: 42, placement: 2, total_score: 91.2 }))).toEqual({
      resultId: '42',
      eventName: 'Cupa Test',
      date: '2026-01-10',
      location: 'Reșița',
      category: 'Advanced Novice Girls',
      categoryShort: 'Adv. Novice',
      placement: 2,
      total: 91.2,
    });
  });
});
