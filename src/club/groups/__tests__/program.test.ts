import { describe, expect, it } from 'vitest';
import { addProgram, changeProgram, deleteClass, endProgram } from '../program';
import { undoAction } from '../undo-service';
import { event, fakeContext } from './fake-group-store';

const SERIES = { freq: 'weekly', days: ['sat', 'sun'], startTime: '11:00', durationMin: 50, from: '2026-11-07' };
const actionOf = (r: { ok: boolean; data?: { actionId: string | null } }) => (r.ok && r.data?.actionId) || '';

describe('"Adaugă program" (6.3)', () => {
  it('writes a school series from Se aplică din to the season end, with a line, an undo and a website ping', async () => {
    const { ctx, state, revalidated } = fakeContext();
    const res = await addProgram(ctx, 'g-ib', SERIES);
    expect(res.ok).toBe(true);
    expect(state.events[0]).toMatchObject({ type: 'scoala', title: 'Intermediari Bronze', groupId: 'g-ib', recurrence: { seasonStart: '2026-11-07', seasonEnd: '2027-05-31', endTime: '11:50' } });
    expect(state.history[0]).toMatchObject({ subjectType: 'group', subjectId: 'g-ib', action: 'program-added', changes: { series: { days: ['sat', 'sun'], startTime: '11:00', durationMin: 50, from: '2026-11-07' } } });
    expect(revalidated()).toBe(1);
    await undoAction(ctx, { actionId: actionOf(res) });
    expect(state.events).toEqual([]);
  });

  it('a Club group writes `curs`; one class answers its date for the toast', async () => {
    const { ctx, state } = fakeContext();
    const res = await addProgram(ctx, 'g-av', { repeat: false, date: '2026-11-20', startTime: '18:00', durationMin: 60, note: null });
    expect(res).toMatchObject({ ok: true, data: { value: { date: '2026-11-20' } } });
    expect(state.events[0]).toMatchObject({ type: 'curs', recurrence: { freq: 'none', singleDate: '2026-11-20' } });
    expect(state.history[0].action).toBe('class-added');
  });

  it('refuses a past season, a date in no season, an inactive group', async () => {
    const { ctx, state } = fakeContext();
    expect((await addProgram(ctx, 'g-ib', { ...SERIES, from: '2026-03-07' })).ok).toBe(false);
    expect((await addProgram(ctx, 'g-ib', { ...SERIES, from: '2026-07-04' })).ok).toBe(false);
    state.groups[1].active = false;
    expect((await addProgram(ctx, 'g-ib', SERIES)).ok).toBe(false);
  });
});

describe('"Schimbă" and "Șterge programul" (W10)', () => {
  const seed = () => fakeContext({ events: [event({ id: 'e1', exceptions: [{ date: '2026-12-05', kind: 'anulat', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: null }] })] });

  it('ends the old series the day before and starts a new one, carried dates included; the undo restores both', async () => {
    const { ctx, state } = seed();
    const before = structuredClone(state.events);
    const res = await changeProgram(ctx, 'e1', { ...SERIES, days: ['sat'], startTime: '12:00', from: '2026-11-28' });
    expect(state.events.map((e) => [e.id, e.recurrence.seasonStart, e.recurrence.seasonEnd, e.exceptions.length])).toEqual([['e1', '2026-10-04', '2026-11-27', 0], [expect.any(String), '2026-11-28', '2027-05-31', 1]]);
    expect(state.history[0]).toMatchObject({ action: 'program-changed', changes: { from: '2026-11-28', before: { startTime: '11:00' }, after: { startTime: '12:00' } } });
    expect(state.locks).toEqual(['season:s26', 'group:g-ib', 'event:e1']);
    await undoAction(ctx, { actionId: actionOf(res) });
    expect(state.events).toEqual(before);
  });

  it('"Șterge programul" ends the series the day before, or deletes one that never held a class', async () => {
    const { ctx, state } = seed();
    await endProgram(ctx, 'e1', { from: '2027-03-01' });
    expect(state.events[0].recurrence.seasonEnd).toBe('2027-02-28');
    expect(state.history[0]).toMatchObject({ action: 'program-ended', changes: { from: '2027-03-01' } });
    const early = seed();
    await endProgram(early.ctx, 'e1', { from: '2026-10-04' });
    expect(early.state.events).toEqual([]);
  });

  it('refuses a "Se aplică din" outside the series', async () => {
    const { ctx } = seed();
    expect((await changeProgram(ctx, 'e1', { ...SERIES, from: '2027-06-05' })).ok).toBe(false);
  });
});

describe('"Șterge ședința"', () => {
  it('deletes one class with its line; the undo brings it back', async () => {
    const one = event({ id: 'c1', recurrence: { freq: 'none', days: [], weekOfMonth: null, startTime: '18:00', endTime: '19:00', singleDate: '2026-11-20', seasonStart: null, seasonEnd: null } });
    const { ctx, state } = fakeContext({ events: [one] });
    const res = await deleteClass(ctx, 'c1');
    expect(res).toMatchObject({ ok: true, data: { value: { date: '2026-11-20' } } });
    expect(state.history[0]).toMatchObject({ action: 'class-deleted', changes: { date: '2026-11-20', startTime: '18:00' } });
    await undoAction(ctx, { actionId: actionOf(res) });
    expect(state.events.map((e) => e.recurrence.singleDate)).toEqual(['2026-11-20']);
  });

  it('refuses a series', async () => {
    const { ctx } = fakeContext({ events: [event({ id: 'e1' })] });
    expect((await deleteClass(ctx, 'e1')).ok).toBe(false);
  });
});

describe('a season that turns past while the writer waits for its lock', () => {
  const one = event({ id: 'c1', recurrence: { freq: 'none', days: [], weekOfMonth: null, startTime: '18:00', endTime: '19:00', singleDate: '2026-11-20', seasonStart: null, seasonEnd: null } });
  const run: [string, (c: ReturnType<typeof fakeContext>) => Promise<{ ok: boolean }>][] = [
    ['addProgram', (c) => addProgram(c.ctx, 'g-ib', SERIES)],
    ['changeProgram', (c) => changeProgram(c.ctx, 'e1', { ...SERIES, from: '2026-11-28' })],
    ['endProgram', (c) => endProgram(c.ctx, 'e1', { from: '2027-03-01' })],
    ['deleteClass', (c) => deleteClass(c.ctx, 'c1')],
  ];
  it.each(run)('%s refuses and writes nothing', async (_name, go) => {
    const c = fakeContext({ events: [event({ id: 'e1' }), one] });
    const lock = c.ctx.store.lockSeason;
    c.ctx.store.lockSeason = async (id) => {
      await lock(id);
      c.state.seasons.forEach((x) => { x.isCurrent = x.id === 's27'; });
    };
    const before = structuredClone(c.state.events);
    expect(await go(c)).toMatchObject({ ok: false, status: 409 });
    expect(c.state.events).toEqual(before);
    expect(c.state.history).toEqual([]);
  });
});

describe('locks and undo order (F1)', () => {
  it('every write on an event locks its group before the event; an add locks the group', async () => {
    const one = event({ id: 'c1', recurrence: { freq: 'none', days: [], weekOfMonth: null, startTime: '18:00', endTime: '19:00', singleDate: '2026-11-20', seasonStart: null, seasonEnd: null } });
    const a = fakeContext({ events: [event({ id: 'e1' })] });
    await endProgram(a.ctx, 'e1', { from: '2027-03-01' });
    expect(a.state.locks).toEqual(['season:s26', 'group:g-ib', 'event:e1']);
    const b = fakeContext({ events: [one] });
    await deleteClass(b.ctx, 'c1');
    expect(b.state.locks).toEqual(['season:s26', 'group:g-ib', 'event:c1']);
    const c = fakeContext();
    await addProgram(c.ctx, 'g-ib', SERIES);
    expect(c.state.locks).toEqual(['season:s26', 'group:g-ib']);
  });

  it('an undo of a program write locks the group subject before the events', async () => {
    const { ctx, state } = fakeContext({ events: [event({ id: 'e1' })] });
    const res = await changeProgram(ctx, 'e1', { ...SERIES, from: '2026-11-28' });
    state.locks.length = 0;
    await undoAction(ctx, { actionId: actionOf(res) });
    expect(state.locks.filter((l) => l !== 'history:' + actionOf(res))[0]).toBe('group:g-ib');
    expect(state.locks.findIndex((l) => l.startsWith('group:'))).toBeLessThan(state.locks.findIndex((l) => l.startsWith('event:')));
  });

  it('a missing event is refused without writing', async () => {
    const { ctx, state } = fakeContext();
    expect((await endProgram(ctx, 'nope', { from: '2027-03-01' })).ok).toBe(false);
    expect((await deleteClass(ctx, 'nope')).ok).toBe(false);
    expect(state.history).toEqual([]);
  });
});
