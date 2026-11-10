import { describe, expect, it } from 'vitest';
import {
  classDates, classWrite, isClassDate, planChange, planDateMode, planEnd, readDateMode, readProgramInput, seasonOf, seriesWrite, type SeriesInput,
} from '../program-plan';
import { event, G_GROUPS, G_SEASONS } from './fake-group-store';

const IB = G_GROUPS[1];
const series: SeriesInput = { freq: 'weekly', weekOfMonth: null, days: ['sat', 'sun'], startTime: '11:00', durationMin: 50, from: '2026-11-07', until: null };
const cancel = (date: string, reason: string | null = null) => ({ date, kind: 'anulat' as const, newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason });

describe('reading the "Program nou" form (6.3, W10)', () => {
  it('reads a series: days Monday first, start + duration, Se aplică din', () => {
    expect(readProgramInput({ freq: 'weekly', days: ['sun', 'sat'], startTime: '11:00', durationMin: 50, from: '2026-11-07' }))
      .toEqual({ ok: true, value: { repeat: true, series: { ...series, days: ['sat', 'sun'] } } });
    expect(readProgramInput({ freq: 'monthly', days: ['sat'], startTime: '11:00', durationMin: 50, from: '2026-11-07' })).toMatchObject({ value: { series: { weekOfMonth: 'first' } } });
  });

  it('refuses no days ("Alege cel puțin o zi."), a duration off the 5-minute steps, a class past midnight', () => {
    expect(readProgramInput({ freq: 'weekly', days: [], startTime: '11:00', durationMin: 50, from: '2026-11-07' })).toEqual({ ok: false, error: 'Alege cel puțin o zi.' });
    expect(readProgramInput({ freq: 'weekly', days: ['sat'], startTime: '11:00', durationMin: 52, from: '2026-11-07' }).ok).toBe(false);
    expect(readProgramInput({ freq: 'weekly', days: ['sat'], startTime: '23:30', durationMin: 50, from: '2026-11-07' }).ok).toBe(false);
  });

  it('reads one class with an optional note', () => {
    expect(readProgramInput({ repeat: false, date: '2026-11-20', startTime: '18:00', durationMin: 60, note: '  Pregătire  ' }))
      .toEqual({ ok: true, value: { repeat: false, one: { date: '2026-11-20', startTime: '18:00', durationMin: 60, note: 'Pregătire' } } });
  });

  it('reads the date panel', () => {
    expect(readDateMode({ mode: 'cancel', reason: ' Competiție la Brașov ' })).toEqual({ mode: 'cancel', reason: 'Competiție la Brașov' });
    expect(readDateMode({ mode: 'move', newDate: '2026-11-22', newStartTime: '12:00' })).toEqual({ mode: 'move', newDate: '2026-11-22', newStartTime: '12:00', reason: null });
    expect(readDateMode({ mode: 'move', newDate: 'x', newStartTime: '12:00' })).toBeNull();
  });
});

describe('writing events (3.3, W9, W10)', () => {
  it('a series runs from "Se aplică din" to the end of its season, titled with the group name', () => {
    expect(seriesWrite(IB, 'scoala', series, '2027-05-31')).toEqual({
      title: 'Intermediari Bronze', type: 'scoala', description: null, groupId: 'g-ib', exceptions: [],
      recurrence: { freq: 'weekly', days: ['sat', 'sun'], weekOfMonth: null, startTime: '11:00', endTime: '11:50', singleDate: null, seasonStart: '2026-11-07', seasonEnd: '2027-05-31' },
    });
  });

  it('one class keeps its note as the description', () => {
    expect(classWrite(IB, 'scoala', { date: '2026-11-20', startTime: '18:00', durationMin: 60, note: 'Pregătire' }).recurrence)
      .toMatchObject({ freq: 'none', singleDate: '2026-11-20', startTime: '18:00', endTime: '19:00' });
  });

  it('finds the season of a date', () => {
    expect(seasonOf(G_SEASONS, '2026-11-07')?.label).toBe('2026-2027');
    expect(seasonOf(G_SEASONS, '2026-07-01')).toBeNull();
  });
});

describe('class dates', () => {
  it('lists the series dates, exceptions ignored', () => {
    const e = event({ id: 'e1', exceptions: [cancel('2026-11-14')] });
    expect(classDates(e, '2026-11-14', '2026-11-22')).toEqual(['2026-11-14', '2026-11-15', '2026-11-21', '2026-11-22']);
    expect(isClassDate(e, '2026-11-16')).toBe(false);
  });
});

describe('"Schimbă" and "Șterge programul" (W10)', () => {
  const base = event({ id: 'e1', exceptions: [cancel('2026-11-14'), cancel('2026-11-29'), cancel('2026-12-05')] });

  it('ends the old series the day before and carries later changed dates that are still class dates', () => {
    const { old, created } = planChange(base, { ...series, days: ['sat'], startTime: '12:00', from: '2026-11-28' }, 'Intermediari Bronze');
    expect(old).toEqual({ op: 'end', recurrence: { ...base.recurrence, seasonEnd: '2026-11-27' }, exceptions: [cancel('2026-11-14')] });
    expect(created.recurrence).toMatchObject({ days: ['sat'], startTime: '12:00', endTime: '12:50', seasonStart: '2026-11-28', seasonEnd: '2027-05-31' });
    expect(created.exceptions).toEqual([cancel('2026-12-05')]);
  });

  it('deletes a series that never held a class before the day', () => {
    expect(planEnd(base, '2026-10-04')).toEqual({ op: 'delete' });
    expect(planEnd(event({ id: 'e2', recurrence: { ...base.recurrence, seasonStart: '2026-11-02' } }), '2026-11-07')).toEqual({ op: 'delete' });
  });
});

describe('date modes (W12)', () => {
  const e = event({ id: 'e1', exceptions: [cancel('2026-11-14', 'x')] });

  it('"Ține" removes the date\'s exception', () => {
    expect(planDateMode(e, '2026-11-14', { mode: 'keep' })).toEqual([]);
  });

  it('"Anulează" writes anulat with the reason', () => {
    expect(planDateMode(e, '2026-11-15', { mode: 'cancel', reason: 'Gheață' })).toEqual([cancel('2026-11-14', 'x'), cancel('2026-11-15', 'Gheață')]);
  });

  it('"Mută" keeps the series duration; the same day leaves newDate empty; past midnight is refused', () => {
    expect(planDateMode(e, '2026-11-21', { mode: 'move', newDate: '2026-11-21', newStartTime: '12:00', reason: null })?.[1])
      .toEqual({ date: '2026-11-21', kind: 'override', newDate: null, newStartTime: '12:00', newEndTime: '12:50', newTitle: null, reason: null });
    expect(planDateMode(e, '2026-11-21', { mode: 'move', newDate: '2026-11-22', newStartTime: '23:30', reason: null })).toBeNull();
  });
});
