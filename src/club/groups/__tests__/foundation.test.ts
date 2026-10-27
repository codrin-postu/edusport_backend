import { describe, expect, it } from 'vitest';
import { addDays, addMinutes, clampDate, dayMonth, isIsoDate, isTime, minutesBetween, shortDate, weekdayName } from '../dates';
import { daysList, daysSpoken, listLine, programLine, programLineFrom } from '../program-text';
import { classView, currentSeries, groupSeries, runningOn, seriesView } from '../series';
import type { EventRecord, Recurrence, SeasonRecord } from '../types';

const SEASON: SeasonRecord = { id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', isCurrent: true, membershipFee: 270 };
const rec = (over: Partial<Recurrence>): Recurrence => ({
  freq: 'weekly', days: ['sat', 'sun'], weekOfMonth: null, startTime: '11:00', endTime: '11:50', singleDate: null, seasonStart: '2026-10-04', seasonEnd: '2027-05-31', ...over,
});
const ev = (id: string, over: Partial<Recurrence> = {}, groupId: string | null = 'g-ib'): EventRecord => ({
  id, title: 'Intermediari Bronze', type: 'scoala', description: null, groupId, recurrence: rec(over), exceptions: [],
});

describe('dates', () => {
  it('formats the Romanian dates of the spec', () => {
    expect(dayMonth('2026-11-14')).toBe('14 noiembrie');
    expect(shortDate('2026-10-04')).toBe('4 oct 2026');
    expect(weekdayName('2026-11-14')).toBe('sâmbătă');
  });

  it('adds days across months and years, and rejects impossible dates', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-02-28')).toBe(true);
  });

  it('works on HH:mm times', () => {
    expect(isTime('09:05')).toBe(true);
    expect(isTime('24:00')).toBe(false);
    expect(addMinutes('11:00', 50)).toBe('11:50');
    expect(minutesBetween('10:00', '11:30')).toBe(90);
    expect(clampDate('2026-09-01', '2026-10-01', '2027-05-31')).toBe('2026-10-01');
  });
});

describe('program texts (5.2, 6.3, 3.7)', () => {
  const s = { freq: 'weekly' as const, days: ['sun', 'sat'] as const, startTime: '11:00', durationMin: 50, from: '2026-10-04' };

  it('lists days Monday first', () => {
    expect(daysList(['sun', 'sat'])).toBe('Sâ, Du');
    expect(daysSpoken(['fri', 'mon', 'wed'])).toBe('Lu, Mi și Vi');
    expect(daysSpoken(['sat'])).toBe('Sâ');
  });

  it('writes the list, Program obișnuit and history forms', () => {
    expect(listLine(s)).toBe('Sâ, Du 11:00');
    expect(programLine(s)).toBe('Sâ și Du, 11:00, 50 min');
    expect(programLine({ ...s, freq: 'biweekly' })).toBe('Sâ și Du, 11:00, 50 min, la 2 săptămâni');
    expect(programLine({ ...s, freq: 'monthly' })).toBe('Sâ și Du, 11:00, 50 min, lunar');
    expect(programLineFrom(s)).toBe('Sâ și Du, 11:00, 50 min, din 4 oct 2026');
  });
});

describe('series of a group', () => {
  it('reads a series and a one-off class, start + duration', () => {
    expect(seriesView(ev('e1'))).toMatchObject({ eventId: 'e1', freq: 'weekly', startTime: '11:00', durationMin: 50, from: '2026-10-04', to: '2027-05-31' });
    expect(seriesView(ev('e2', { freq: 'none', singleDate: '2026-11-20' }))).toBeNull();
    expect(classView(ev('e2', { freq: 'none', singleDate: '2026-11-20', startTime: '18:00', endTime: '19:00' }))).toEqual({
      eventId: 'e2', date: '2026-11-20', startTime: '18:00', endTime: '19:00', durationMin: 60, note: null,
    });
  });

  it('keeps the series of the group that touch the season, oldest first', () => {
    const events = [ev('late', { seasonStart: '2026-11-07' }), ev('early'), ev('other', {}, 'g-pp'), ev('old', { seasonStart: '2025-10-04', seasonEnd: '2026-05-31' })];
    expect(groupSeries(events, 'g-ib', SEASON).map((s) => s.eventId)).toEqual(['early', 'late']);
  });

  it('Program obișnuit drops a series that ended before today; a past season shows what ran on its last day', () => {
    const events = [ev('ended', { seasonEnd: '2026-11-06' }), ev('now', { seasonStart: '2026-11-07' })];
    expect(currentSeries(events, 'g-ib', SEASON, '2026-11-20').map((s) => s.eventId)).toEqual(['now']);
    expect(currentSeries(events, 'g-ib', SEASON, '2027-09-01').map((s) => s.eventId)).toEqual(['now']);
    expect(currentSeries(events, 'g-ib', SEASON, '2026-09-01').map((s) => s.eventId)).toEqual(['ended', 'now']);
  });

  it('knows whether a series runs on a date', () => {
    const s = seriesView(ev('e1'));
    expect(s && runningOn(s, '2027-05-31')).toBe(true);
    expect(s && runningOn(s, '2026-10-03')).toBe(false);
  });
});
