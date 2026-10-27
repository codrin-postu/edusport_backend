import { describe, expect, it } from 'vitest';
import { breakDaysIn, withoutBlackoutSessions } from '../calendar/break-days';
import { NEW_SEASON_COPY, summaryParts, summaryText } from '../groups/copy';
import { latestGate } from '../groups/new-season/latest';
import { childPhoneLine, phoneLine } from '../groups/new-season/window-view';
import type { StartGroup } from '../groups/new-season/start-data';
import { calendarOpenDate, inSeasonWindow, isPastSeasonDate, seasonLabelOf, seasonWindow } from '../grupe/season-window';

describe('season window (I3, I6)', () => {
  it('covers July to June of the label and never overlaps the next season', () => {
    expect(seasonWindow('2027-2028')).toEqual({ start: '2027-07-01', end: '2028-06-30' });
    expect(seasonWindow('x')).toBeNull();
    expect(inSeasonWindow('2026-10-05', seasonWindow('2027-2028'))).toBe(false);
    expect(inSeasonWindow('2027-10-05', seasonWindow('2027-2028'))).toBe(true);
  });

  it('opens the calendar on today inside the season, else on the nearest end', () => {
    const win = seasonWindow('2027-2028');
    expect(calendarOpenDate('2026-10-27', win)).toBe('2027-07-01');
    expect(calendarOpenDate('2027-11-03', win)).toBe('2027-11-03');
    expect(calendarOpenDate('2029-01-01', win)).toBe('2028-06-30');
    expect(calendarOpenDate('2026-10-27', null)).toBe('2026-10-27');
  });

  it('names the season of a date and rules a date of an older season read-only', () => {
    expect(seasonLabelOf('2026-10-05')).toBe('2026-2027');
    expect(seasonLabelOf('2027-03-02')).toBe('2026-2027');
    expect(seasonLabelOf('2027-07-01')).toBe('2027-2028');
    expect(isPastSeasonDate('2026-03-02', '2026-2027')).toBe(true);
    expect(isPastSeasonDate('2026-10-05', '2026-2027')).toBe(false);
    expect(isPastSeasonDate('2027-10-05', '2026-2027')).toBe(false);
    expect(isPastSeasonDate('2026-03-02', null)).toBe(false);
  });
});

describe('break days of the general calendar (I4)', () => {
  const winter = { label: 'Vacanța de iarnă', startDate: '2026-12-22', endDate: '2027-01-03' };
  it('gives one entry per day of the month, with the break name', () => {
    const days = breakDaysIn([winter], '2026-12-01', '2026-12-31');
    expect(days).toHaveLength(10);
    expect(days[0]).toEqual({ date: '2026-12-22', label: 'Vacanța de iarnă' });
    expect(days[9].date).toBe('2026-12-31');
    expect(breakDaysIn([winter], '2027-01-01', '2027-01-31').map((d) => d.date)).toEqual(['2027-01-01', '2027-01-02', '2027-01-03']);
    expect(breakDaysIn([winter], '2026-11-01', '2026-11-30')).toEqual([]);
  });
  it('one chip per day when breaks overlap: the first wins', () => {
    const days = breakDaysIn([winter, { label: 'Alta', startDate: '2026-12-30', endDate: '2027-01-05' }], '2026-12-29', '2026-12-31');
    expect(days.map((d) => d.label)).toEqual(['Vacanța de iarnă', 'Vacanța de iarnă', 'Vacanța de iarnă']);
  });
  it('leaves out the group sessions a break cancels', () => {
    const list = [{ id: 1, cancelReason: 'blackout' as const }, { id: 2, cancelReason: 'exception' as const }, { id: 3, cancelReason: null }];
    expect(withoutBlackoutSessions(list).map((o) => o.id)).toEqual([2, 3]);
  });
});

describe('latest request gate (I8)', () => {
  it('only the newest request is the latest', () => {
    const g = latestGate();
    const a = g.next();
    const b = g.next();
    expect(g.isLatest(a)).toBe(false);
    expect(g.isLatest(b)).toBe(true);
  });
});

describe('step 2 summary and phone lines (I1, minors)', () => {
  const counts = { athletes: 14, groups: 2, programGroups: 9, unassigned: 73, inactive: 2 };
  it('bold parts are the counts and join back to the same text', () => {
    const parts = summaryParts(counts);
    expect(parts.filter((p) => p.bold).map((p) => p.text)).toEqual(['14 sportivi', 'programul a 9 grupe']);
    expect(summaryText(counts)).toBe('Se copiază 14 sportivi în 2 grupe și programul a 9 grupe. 73 de sportivi rămân fără grupă, 2 inactivi nu se copiază.');
    expect(summaryParts({ athletes: 0, groups: 0, programGroups: 0, unassigned: 0, inactive: 0 })).toEqual([{ text: 'Nu se copiază nimic.' }]);
  });

  const g: StartGroup = { groupId: 'g', name: 'Avansați', members: 10, inactive: 1, program: 'Lu, Mi 17:00', programState: 'ok', defaultMembers: true, defaultProgram: true, athletes: [] };
  it('phone card line: sportivi, inactive, program', () => {
    expect(phoneLine(g, '2026-2027', '2027-2028')).toBe('10 sportivi în 2026-2027, 1 inactiv, Lu, Mi 17:00');
    expect(phoneLine({ ...g, inactive: 0, programState: 'none' }, '2026-2027', '2027-2028')).toBe(`10 sportivi în 2026-2027, ${NEW_SEASON_COPY.noProgram}`);
  });
  it('child line under a child on phones', () => {
    expect(childPhoneLine({ main: 'Avansați', note: null })).toBe('Principală: Avansați');
    expect(childPhoneLine({ main: '', note: NEW_SEASON_COPY.childInactive })).toBe(NEW_SEASON_COPY.childInactive);
  });
});
