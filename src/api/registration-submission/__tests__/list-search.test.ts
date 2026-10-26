import { describe, expect, it } from 'vitest';
import { ageSortedPage, agePageSlices, existingClause, listSort, phase3Clauses, quickSearchClause, schoolClause, type PageQuery } from '../list-search';

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

type Row = { id: string; childBirthDateParsed: string | null; submittedAt: string };

const ROWS: Row[] = [
  { id: 'u-old', childBirthDateParsed: null, submittedAt: '2026-09-01' },
  { id: 'd-2014', childBirthDateParsed: '2014-05-01', submittedAt: '2026-09-02' },
  { id: 'u-new', childBirthDateParsed: null, submittedAt: '2026-09-05' },
  { id: 'd-2018', childBirthDateParsed: '2018-01-10', submittedAt: '2026-09-03' },
  { id: 'd-2016', childBirthDateParsed: '2016-03-14', submittedAt: '2026-09-04' },
];

/** In-memory list: reads the dated / undated clause ageSortedPage adds and sorts on one key. */
function fakeDeps(rows: Row[]) {
  const pick = (filters: Record<string, unknown>) => {
    const clause = (filters.$and as Record<string, { $null?: boolean }>[])[1].childBirthDateParsed;
    return rows.filter((r) => (r.childBirthDateParsed === null) === (clause.$null === true));
  };
  return {
    count: async (filters: Record<string, unknown>) => pick(filters).length,
    find: async (q: PageQuery) => {
      const [key, dir] = Object.entries(q.sort)[0] as [keyof Row, 'asc' | 'desc'];
      const sorted = [...pick(q.filters)].sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (dir === 'asc' ? 1 : -1));
      return sorted.slice(q.start, q.start + q.limit).map((r) => r.id);
    },
  };
}

const page = (rows: Row[], sort: string, start: number) => ageSortedPage(fakeDeps(rows), { filters: {}, sort: listSort(sort), start, limit: 2 });

describe('"Vârstă" sort: no age comes last', () => {
  it('splits a page between the dated and the undated rows', () => {
    expect(agePageSlices(3, 0, 2)).toEqual({ dated: { start: 0, limit: 2 }, undated: null });
    expect(agePageSlices(3, 2, 2)).toEqual({ dated: { start: 2, limit: 1 }, undated: { start: 0, limit: 1 } });
    expect(agePageSlices(3, 4, 2)).toEqual({ dated: null, undated: { start: 1, limit: 2 } });
    expect(agePageSlices(0, 0, 2)).toEqual({ dated: null, undated: { start: 0, limit: 2 } });
  });

  it('youngest first, the undated rows after the oldest, across pages', async () => {
    expect(await page(ROWS, 'age-asc', 0)).toEqual(['d-2018', 'd-2016']);
    expect(await page(ROWS, 'age-asc', 2)).toEqual(['d-2014', 'u-new']);
    expect(await page(ROWS, 'age-asc', 4)).toEqual(['u-old']);
  });

  it('oldest first, the undated rows after the youngest, across pages', async () => {
    expect(await page(ROWS, 'age-desc', 0)).toEqual(['d-2014', 'd-2016']);
    expect(await page(ROWS, 'age-desc', 2)).toEqual(['d-2018', 'u-new']);
    expect(await page(ROWS, 'age-desc', 4)).toEqual(['u-old']);
  });

  it('undated rows on the first page when few rows have an age', async () => {
    const rows = ROWS.filter((r) => r.id !== 'd-2014' && r.id !== 'd-2016');
    expect(await page(rows, 'age-asc', 0)).toEqual(['d-2018', 'u-new']);
    expect(await page(rows, 'age-desc', 0)).toEqual(['d-2018', 'u-new']);
    expect(await page(rows, 'age-desc', 2)).toEqual(['u-old']);
  });
});
