import { describe, expect, it } from 'vitest';
import { classDates } from '../program-plan';
import { changeProgram, deleteClass, endProgram } from '../program';
import { setDate } from '../program-dates';
import { undoAction } from '../undo-service';
import type { EventRecord, Recurrence } from '../types';
import { event, fakeContext } from './fake-group-store';

const SESSION_MSG = 'Data are prezența salvată. Poți doar să o anulezi.';
const FRIDAY: Recurrence = { freq: 'weekly', days: ['fri'], weekOfMonth: null, startTime: '17:30', endTime: '18:30', singleDate: null, seasonStart: '2026-10-02', seasonEnd: '2027-05-31' };
const TUE_THU: Recurrence = { freq: 'weekly', days: ['tue', 'thu'], weekOfMonth: null, startTime: '17:30', endTime: '18:30', singleDate: null, seasonStart: '2026-09-01', seasonEnd: '2027-06-30' };
const seedFriday = () => fakeContext({ events: [event({ id: 'ev', type: 'curs', groupId: 'g-av', title: 'Avansați', recurrence: FRIDAY })] }, '2026-11-10');
const seedTueThu = (rule: Partial<Recurrence> = {}) => fakeContext({ events: [event({ id: 'e1', type: 'curs', groupId: 'g-av', title: 'Avansați', recurrence: { ...TUE_THU, ...rule } })] }, '2026-11-10');
const session = (id: string, eventId: string, date: string, startTime = '17:30') => ({ id, eventId, date, startTime, key: `${eventId}|${date}|${startTime}` });
const datesOf = (events: EventRecord[], from: string, to: string) => events.flatMap((e) => classDates(e, from, to)).sort();
const move = { mode: 'move', newDate: '2026-11-15', newStartTime: '17:30' };

describe('remove looks at the class that happens (H1, L1)', () => {
  it('a moved date with presence saved on its new date cannot be removed', async () => {
    const { ctx, sessions, state } = seedFriday();
    expect((await setDate(ctx, 'ev', '2026-11-13', move)).ok).toBe(true);
    sessions.push(session('s1', 'ev', '2026-11-15'));
    const before = structuredClone(state.events[0].exceptions);
    expect(await setDate(ctx, 'ev', '2026-11-13', { mode: 'remove' })).toEqual({ ok: false, status: 409, error: SESSION_MSG });
    expect(state.events[0].exceptions).toEqual(before);
  });

  it('a session of another class of the group that day does not block the removal', async () => {
    const { ctx, sessions, state } = seedFriday();
    sessions.push(session('s9', 'other-event', '2026-11-13'));
    expect((await setDate(ctx, 'ev', '2026-11-13', { mode: 'remove' })).ok).toBe(true);
    expect(state.events[0].exceptions.map((x) => x.kind)).toEqual(['sters']);
  });
});

describe('a weekday split keeps the saved sessions with their class (H2, L4)', () => {
  it('"Șterge" on Tuesday moves the saved Thursday session to the rest event with a new key', async () => {
    const { ctx, sessions, state } = seedTueThu();
    sessions.push(session('s1', 'e1', '2026-11-19'), session('s0', 'e1', '2026-11-12'));
    expect((await endProgram(ctx, 'e1', { from: '2026-11-17', day: 'tue' })).ok).toBe(true);
    const rest = state.events.find((e) => e.id !== 'e1')!;
    expect(sessions.find((s) => s.id === 's1')).toMatchObject({ eventId: rest.id, key: `${rest.id}|2026-11-19|17:30` });
    expect(sessions.find((s) => s.id === 's0')?.eventId).toBe('e1');
  });

  it('"Schimbă" on Tuesday moves the Thursday session to the rest, and a Tuesday session that still matches to the new event', async () => {
    const { ctx, sessions, state } = seedTueThu();
    sessions.push(session('s1', 'e1', '2026-11-19'), session('s2', 'e1', '2026-11-17'), session('s3', 'e1', '2026-11-24'));
    const res = await changeProgram(ctx, 'e1', { freq: 'weekly', days: ['tue'], startTime: '17:30', durationMin: 60, from: '2026-11-17', day: 'tue' });
    expect(res.ok).toBe(true);
    const ids = state.events.map((e) => e.id).filter((id) => id !== 'e1');
    const [rest, created] = ids;
    expect(sessions.find((s) => s.id === 's1')?.eventId).toBe(rest);
    expect([sessions.find((s) => s.id === 's2')?.eventId, sessions.find((s) => s.id === 's3')?.eventId]).toEqual([created, created]);
  });

  it('a session of a weekday kept before the split date is untouched', async () => {
    const { ctx, sessions } = seedTueThu();
    sessions.push(session('s1', 'e1', '2026-11-12'));
    await endProgram(ctx, 'e1', { from: '2026-11-17', day: 'tue' });
    expect(sessions[0]).toMatchObject({ eventId: 'e1', key: 'e1|2026-11-12|17:30' });
  });

  it('the undo is refused once a session is saved on an event it would remove, and works before', async () => {
    const a = seedTueThu();
    const ended = await endProgram(a.ctx, 'e1', { from: '2026-11-17', day: 'tue' });
    const rest = a.state.events.find((e) => e.id !== 'e1')!;
    a.sessions.push(session('s1', rest.id, '2026-11-19'));
    const actionId = ended.ok ? ended.data.actionId : null;
    expect(await undoAction(a.ctx, { actionId })).toMatchObject({ ok: false, status: 409 });
    expect(a.state.events).toHaveLength(2);
    const b = seedTueThu();
    const endedB = await endProgram(b.ctx, 'e1', { from: '2026-11-17', day: 'tue' });
    expect((await undoAction(b.ctx, { actionId: endedB.ok ? endedB.data.actionId : null })).ok).toBe(true);
    expect(b.state.events).toHaveLength(1);
  });
});

describe('a biweekly weekday keeps its week (M2)', () => {
  it('changing Tuesday from an off-week Tuesday leaves Tuesdays and Thursdays on their old dates', async () => {
    const { ctx, state } = seedTueThu({ freq: 'biweekly' });
    const days = (d: number) => datesOf(state.events, '2026-11-17', '2027-01-31').filter((x) => new Date(x).getUTCDay() === d);
    const [tue, thu] = [days(2), days(4)];
    expect(tue[0]).toBe('2026-11-24');
    const res = await changeProgram(ctx, 'e1', { freq: 'biweekly', days: ['tue'], startTime: '18:00', durationMin: 60, from: '2026-11-17', day: 'tue' });
    expect(res.ok).toBe(true);
    expect([days(2), days(4)]).toEqual([tue, thu]);
  });

  it('from an on-week Tuesday nothing moves either', async () => {
    const { ctx, state } = seedTueThu({ freq: 'biweekly' });
    const all = datesOf(state.events, '2026-11-10', '2027-01-31');
    await changeProgram(ctx, 'e1', { freq: 'biweekly', days: ['tue'], startTime: '18:00', durationMin: 60, from: '2026-11-10', day: 'tue' });
    expect(datesOf(state.events, '2026-11-10', '2027-01-31')).toEqual(all);
  });
});

describe('a change must not duplicate the kept weekday (L2)', () => {
  it('days that include the other weekday are refused, nothing is written', async () => {
    const { ctx, state, } = seedTueThu();
    const res = await changeProgram(ctx, 'e1', { freq: 'weekly', days: ['tue', 'thu'], startTime: '18:00', durationMin: 60, from: '2026-11-17', day: 'tue' });
    expect(res).toMatchObject({ ok: false, status: 400 });
    expect(state.events).toHaveLength(1);
    expect(state.events[0].recurrence.seasonEnd).toBe('2027-06-30');
  });
});

describe('deleting a one-off class with presence (L3)', () => {
  const oneOff = () => fakeContext({ events: [event({ id: 'o', type: 'curs', groupId: 'g-av', title: 'Avansați', recurrence: { ...FRIDAY, freq: 'none', days: [], singleDate: '2026-11-08', seasonStart: null, seasonEnd: null } })] }, '2026-11-10');
  it('is refused with the saved-session text and works without one', async () => {
    const a = oneOff();
    a.sessions.push(session('s1', 'o', '2026-11-08'));
    expect(await deleteClass(a.ctx, 'o')).toEqual({ ok: false, status: 409, error: SESSION_MSG });
    expect(a.state.events).toHaveLength(1);
    const b = oneOff();
    expect((await deleteClass(b.ctx, 'o')).ok).toBe(true);
  });
});
