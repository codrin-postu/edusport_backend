import { describe, expect, it } from 'vitest';
import { existingClause, listSort, phase3Clauses, quickSearchClause, schoolClause } from '../list-search';

describe('Înscrieri quick search', () => {
  it('matches the registration number as well as names, e-mail and phone', () => {
    expect(quickSearchClause(' 2026-0142 ')).toEqual({
      $or: [
        { childName: { $containsi: '2026-0142' } },
        { parentName: { $containsi: '2026-0142' } },
        { email: { $containsi: '2026-0142' } },
        { phone: { $containsi: '2026-0142' } },
        { registrationNumber: { $containsi: '2026-0142' } },
      ],
    });
  });

  it('adds no clause for an empty search', () => {
    expect(quickSearchClause('   ')).toBeNull();
  });
});

describe('Înscrieri list, phase 3', () => {
  it('sorts by age through the parsed birth date (younger = later date)', () => {
    expect(listSort('age-asc')).toEqual({ childBirthDateParsed: 'desc' });
    expect(listSort('age-desc')).toEqual({ childBirthDateParsed: 'asc' });
    expect(listSort('name')).toEqual({ childName: 'asc' });
    expect(listSort('x')).toEqual({ submittedAt: 'desc' });
  });

  it('"Sportiv existent: Da / Nu" counts only registrations with no athlete linked (gaps #16)', () => {
    expect(existingClause('da')).toEqual({ athlete: { id: { $null: true } }, matchLevel: { $notNull: true } });
    expect(existingClause('nu')).toEqual({ $or: [{ athlete: { id: { $notNull: true } } }, { matchLevel: { $null: true } }] });
    expect(existingClause('')).toBeNull();
  });

  it('filters one school', () => {
    expect(schoolClause(' afi ')).toEqual({ section: { documentId: 'afi' } });
    expect(schoolClause(undefined)).toBeNull();
  });

  it('collects the phase 3 filters present in the query', () => {
    expect(phase3Clauses({ existing: 'da', school: 'afi' })).toEqual([existingClause('da'), schoolClause('afi')]);
    expect(phase3Clauses({})).toEqual([]);
  });
});
