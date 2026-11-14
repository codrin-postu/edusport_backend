import { describe, expect, it } from 'vitest';
import { autoKey, autoPlan, autoTitle } from '../auto';

const autoRows = (...a: Parameters<typeof autoPlan>) => autoPlan(...a).rows;
import type { CalendarItem } from '../../sportiv/api-types';

const TODAY = '2026-11-14';
const item = (over: Partial<CalendarItem>): CalendarItem => ({
  date: '2026-11-18', startTime: '18:00', endTime: '18:50', kind: 'grupa', title: 'Intermediari Bronze', location: null, coaches: [], cancelled: true, reason: 'Vacanța de iarnă', movedFrom: null, ...over,
});

describe('autoRows', () => {
  it('names the child only when two athletes are held', () => {
    const rows = autoRows([{ athleteFirstName: 'Ana', item: item({}) }], true, TODAY);
    expect(rows[0]).toEqual({ date: '2026-11-18', text: '18:00 Intermediari Bronze, Ana', reason: 'Vacanța de iarnă' });
    expect(autoRows([{ athleteFirstName: 'Ana', item: item({}) }], false, TODAY)[0].text).toBe('18:00 Intermediari Bronze');
  });

  it('a moved row carries the planned date and time and where it went', () => {
    const moved = item({ date: '2026-11-20', startTime: '17:00', cancelled: false, reason: null, movedFrom: { date: '2026-11-18', startTime: '18:00' } });
    expect(autoRows([{ athleteFirstName: 'Ana', item: moved }], false, TODAY)).toEqual([
      { date: '2026-11-18', text: '18:00 Intermediari Bronze', reason: 'Mutată: Vin 20 noi, 17:00' },
    ]);
  });

  it('keeps a move whose new date is outside the window but whose planned date is inside, and the reverse', () => {
    const away = item({ date: '2026-12-20', cancelled: false, reason: null, movedFrom: { date: '2026-11-18', startTime: '18:00' } });
    const toward = item({ date: '2026-11-18', cancelled: false, reason: null, movedFrom: { date: '2026-12-30', startTime: '18:00' } });
    const far = item({ date: '2026-12-20', cancelled: false, reason: null, movedFrom: { date: '2026-12-30', startTime: '18:00' } });
    expect(autoRows([away, toward, far].map((i) => ({ athleteFirstName: 'Ana', item: i })), false, TODAY)).toHaveLength(2);
  });

  it('leaves out a cancelled date 15 days ahead and yesterday, keeps today and day 14', () => {
    const rows = autoRows([
      { athleteFirstName: 'Ana', item: item({ date: '2026-11-29' }) }, { athleteFirstName: 'Ana', item: item({ date: '2026-11-13' }) },
      { athleteFirstName: 'Ana', item: item({ date: '2026-11-28' }) }, { athleteFirstName: 'Ana', item: item({ date: '2026-11-14' }) },
    ], false, TODAY);
    expect(rows.map((r) => r.date)).toEqual(['2026-11-14', '2026-11-28']);
  });

  it('sorts by date then time and leaves out items that are neither cancelled nor moved', () => {
    const rows = autoRows([
      { athleteFirstName: 'Ana', item: item({ date: '2026-11-19', startTime: '09:00' }) },
      { athleteFirstName: 'Ana', item: item({ date: '2026-11-18', startTime: '19:00' }) },
      { athleteFirstName: 'Ana', item: item({ date: '2026-11-18', startTime: '10:00' }) },
      { athleteFirstName: 'Ana', item: item({ cancelled: false, reason: null }) },
    ], false, TODAY);
    expect(rows.map((r) => `${r.date} ${r.text.slice(0, 5)}`)).toEqual(['2026-11-18 10:00', '2026-11-18 19:00', '2026-11-19 09:00']);
  });
});

describe('autoTitle and autoKey', () => {
  const one = [{ date: '2026-11-18', text: 'a', reason: null }];
  const two = [...one, { date: '2026-11-19', text: 'b', reason: null }];
  it('titles', () => {
    expect(autoTitle(two, false)).toBe('2 ședințe anulate');
    expect(autoTitle(two, true)).toBe('2 ședințe anulate sau mutate');
    expect(autoTitle(one, false)).toBe('1 ședință anulată');
    expect(autoTitle(one, true)).toBe('1 ședință anulată sau mutată');
  });
  it('the key is 16 hex characters and follows the rows', () => {
    expect(autoKey(one)).toMatch(/^[0-9a-f]{16}$/);
    expect(autoKey(one)).toBe(autoKey(structuredClone(one)));
    expect(autoKey(one)).not.toBe(autoKey(two));
  });
});
