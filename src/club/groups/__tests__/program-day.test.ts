import { describe, expect, it } from 'vitest';
import { classDates } from '../program-plan';
import { changeProgram, endProgram } from '../program';
import { undoAction } from '../undo-service';
import type { EventRecord, ExceptionRow, Recurrence } from '../types';
import { event, fakeContext } from './fake-group-store';

const RULE: Recurrence = { freq: 'weekly', days: ['tue', 'thu'], weekOfMonth: null, startTime: '17:30', endTime: '18:30', singleDate: null, seasonStart: '2026-09-01', seasonEnd: '2027-06-30' };
const cancel = (date: string): ExceptionRow => ({ date, kind: 'anulat', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: null });
const seed = (rule: Partial<Recurrence> = {}, exceptions: ExceptionRow[] = []) =>
  fakeContext({ events: [event({ id: 'e1', type: 'curs', groupId: 'g-av', title: 'Avansați', recurrence: { ...RULE, ...rule }, exceptions })] }, '2026-11-10');
const datesOf = (events: EventRecord[], from: string, to: string) => events.flatMap((e) => classDates(e, from, to)).sort();
const NEW = { freq: 'weekly', days: ['tue'], startTime: '18:00', durationMin: 60, from: '2026-11-17', day: 'tue' };

describe('"Șterge" on one weekday', () => {
  it('ends the old event the day before and keeps the other weekday as a rest event', async () => {
    const { ctx, state } = seed();
    const res = await endProgram(ctx, 'e1', { from: '2026-11-17', day: 'tue' });
    expect(res).toMatchObject({ ok: true, data: { value: { eventId: 'e1' } } });
    const [old, rest] = state.events;
    expect(old.recurrence.seasonEnd).toBe('2026-11-16');
    expect(rest.recurrence).toMatchObject({ days: ['thu'], startTime: '17:30', seasonStart: '2026-11-19', seasonEnd: '2027-06-30' });
    const thursdays = ['2026-11-19', '2026-11-26', '2026-12-03', '2026-12-10', '2026-12-17', '2026-12-24', '2026-12-31'];
    expect(datesOf(state.events, '2026-11-17', '2026-12-31')).toEqual(thursdays);
    expect(state.history[0]).toMatchObject({ action: 'program-ended', changes: { from: '2026-11-17', series: { days: ['tue'] } } });
  });

  it('writes the line "Program șters din 17 noi 2026: Ma, 17:30, 60 min."', async () => {
    const { ctx, state } = seed();
    await endProgram(ctx, 'e1', { from: '2026-11-17', day: 'tue' });
    const { groupHistoryTexts } = await import('../history-lines');
    expect(groupHistoryTexts(state.history[0].action, state.history[0].changes, {})).toEqual(['Program șters din 17 noi 2026: Ma, 17:30, 60 min.']);
  });

  it('a biweekly series keeps the Thursdays on the same dates (parity)', async () => {
    const { ctx, state } = seed({ freq: 'biweekly' });
    const before = datesOf(state.events, '2026-11-17', '2027-01-31').filter((d) => new Date(d).getUTCDay() === 4);
    await endProgram(ctx, 'e1', { from: '2026-11-17', day: 'tue' });
    const after = datesOf(state.events, '2026-11-17', '2027-01-31');
    expect(after).toEqual(before);
    expect(after.length).toBeGreaterThan(3);
  });

  it('moves the exceptions of the other weekday to the rest event and drops those of the removed one', async () => {
    const { ctx, state } = seed({}, [cancel('2026-11-26'), cancel('2026-11-24'), cancel('2026-11-12')]);
    await endProgram(ctx, 'e1', { from: '2026-11-17', day: 'tue' });
    expect(state.events[0].exceptions.map((x) => x.date)).toEqual(['2026-11-12']);
    expect(state.events[1].exceptions.map((x) => x.date)).toEqual(['2026-11-26']);
  });

  it('undo puts the single original event back', async () => {
    const { ctx, state } = seed();
    const res = await endProgram(ctx, 'e1', { from: '2026-11-17', day: 'tue' });
    await undoAction(ctx, { actionId: (res.ok && res.data.actionId) || '' });
    expect(state.events).toHaveLength(1);
    expect(state.events[0].recurrence).toMatchObject({ days: ['tue', 'thu'], seasonEnd: '2027-06-30' });
  });

  it('refuses a day the event does not run on (400) and writes nothing', async () => {
    const { ctx, state } = seed();
    expect(await endProgram(ctx, 'e1', { from: '2026-11-17', day: 'fri' })).toMatchObject({ ok: false, status: 400 });
    expect(await endProgram(ctx, 'e1', { from: '2026-11-17', day: 'xyz' })).toMatchObject({ ok: false, status: 400 });
    expect([state.events.length, state.events[0].recurrence.seasonEnd, state.history]).toEqual([1, '2027-06-30', []]);
  });

  it('without a day it ends the whole event as before', async () => {
    const { ctx, state } = seed();
    await endProgram(ctx, 'e1', { from: '2026-11-17' });
    expect(state.events).toHaveLength(1);
    expect(state.events[0].recurrence.seasonEnd).toBe('2026-11-16');
  });
});

describe('"Schimbă" on one weekday', () => {
  it('ends the old event, keeps the other weekday as rest and starts the new rule', async () => {
    const { ctx, state } = seed();
    const res = await changeProgram(ctx, 'e1', NEW);
    expect(res.ok).toBe(true);
    expect(state.events).toHaveLength(3);
    const [old, rest, created] = state.events;
    expect(old.recurrence.seasonEnd).toBe('2026-11-16');
    expect(rest.recurrence).toMatchObject({ days: ['thu'], startTime: '17:30', seasonStart: '2026-11-19' });
    expect(created.recurrence).toMatchObject({ days: ['tue'], startTime: '18:00', seasonStart: '2026-11-17' });
    expect(res).toMatchObject({ ok: true, data: { value: { eventId: created.id } } });
    expect(state.history[0]).toMatchObject({ action: 'program-changed', changes: { before: { days: ['tue'] }, after: { days: ['tue'], startTime: '18:00' } } });
  });

  it('sends each exception to the event whose dates it belongs to', async () => {
    const { ctx, state } = seed({}, [cancel('2026-11-26'), cancel('2026-11-24')]);
    await changeProgram(ctx, 'e1', NEW);
    const [, rest, created] = state.events;
    expect(rest.exceptions.map((x) => x.date)).toEqual(['2026-11-26']);
    expect(created.exceptions.map((x) => x.date)).toEqual(['2026-11-24']);
  });

  it('undo puts back the single original event and deletes both new ones', async () => {
    const { ctx, state } = seed();
    const res = await changeProgram(ctx, 'e1', NEW);
    await undoAction(ctx, { actionId: (res.ok && res.data.actionId) || '' });
    expect(state.events).toHaveLength(1);
    expect(state.events[0].recurrence).toMatchObject({ days: ['tue', 'thu'], seasonEnd: '2027-06-30' });
  });

  it('refuses a day the event does not run on', async () => {
    const { ctx, state } = seed();
    expect(await changeProgram(ctx, 'e1', { ...NEW, day: 'fri' })).toMatchObject({ ok: false, status: 400 });
    expect(state.events).toHaveLength(1);
  });

  it('without a day it changes the whole event as before', async () => {
    const { ctx, state } = seed();
    await changeProgram(ctx, 'e1', { ...NEW, days: ['tue', 'thu'], day: undefined });
    expect(state.events).toHaveLength(2);
  });
});
