import { describe, expect, it } from 'vitest';
import { setDate } from '../program-dates';
import { undoAction } from '../undo-service';
import { athleteRow, event, fakeContext, member } from './fake-group-store';

const seed = () => fakeContext({
  athletes: [athleteRow({ id: 'a1', name: 'Ana', email: 'ana@example.com' }), athleteRow({ id: 'a2', name: 'Bia', email: 'Ana@example.com ' }), athleteRow({ id: 'a3', name: 'Cai', email: 'cai@example.com' })],
  memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a2', groupId: 'g-ib' }), member({ id: 'm3', athleteId: 'a3', groupId: 'g-ib' })],
  events: [event({ id: 'e1' })],
  breaks: [{ id: 'b1', label: 'Vacanța de iarnă', startDate: '2026-12-26', endDate: '2027-01-03' }],
});
const actionOf = (r: { ok: boolean; data?: { actionId: string | null } }) => (r.ok && r.data?.actionId) || '';

describe('"Anulează" (6.3, 6.5)', () => {
  it('writes anulat with the reason, a line, no e-mail when the box is not ticked', async () => {
    const { ctx, state, emailed } = seed();
    const res = await setDate(ctx, 'e1', '2026-11-14', { mode: 'cancel', reason: 'Competiție la Brașov' });
    expect(res).toMatchObject({ ok: true, data: { value: { mode: 'cancel', date: '2026-11-14', emails: 0 } } });
    expect(state.events[0].exceptions).toEqual([{ date: '2026-11-14', kind: 'anulat', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: 'Competiție la Brașov' }]);
    expect(state.history[0]).toMatchObject({ action: 'date-cancelled', changes: { date: '2026-11-14', reason: 'Competiție la Brașov', emails: 0 } });
    expect([state.jobs, emailed]).toEqual([[], []]);
  });

  it('with the box ticked: one job per address, held, keyed by the change, the next class in the payload', async () => {
    const { ctx, state, emailed } = seed();
    const res = await setDate(ctx, 'e1', '2026-11-14', { mode: 'cancel', reason: null, notifyParents: true });
    const actionId = actionOf(res);
    expect(state.jobs.map((j) => [j.recipient, j.changeKey, j.notBefore, j.status])).toEqual([
      ['ana@example.com', actionId, '2026-11-20T10:00:15.000Z', 'queued'], ['cai@example.com', actionId, '2026-11-20T10:00:15.000Z', 'queued'],
    ]);
    expect(state.jobs[0].payload).toMatchObject({ mode: 'cancel', date: '2026-11-14', startTime: '11:00', nextDate: '2026-11-15', nextStartTime: '11:00' });
    expect(state.history[0].changes.emails).toBe(2);
    expect(emailed).toEqual([actionId]);
  });

  it('the toast\'s undo restores the date and cancels every queued job of the change (W7)', async () => {
    const { ctx, state } = seed();
    const res = await setDate(ctx, 'e1', '2026-11-14', { mode: 'cancel', reason: null, notifyParents: true });
    await undoAction(ctx, { actionId: actionOf(res) });
    expect(state.events[0].exceptions).toEqual([]);
    expect(state.jobs.map((j) => j.status)).toEqual(['cancelled', 'cancelled']);
  });
});

describe('"Mută" and "Ține"', () => {
  it('moves with the series duration and a move e-mail', async () => {
    const { ctx, state } = seed();
    await setDate(ctx, 'e1', '2026-11-21', { mode: 'move', newDate: '2026-11-22', newStartTime: '12:00', reason: 'Patinoar', notifyParents: true });
    expect(state.events[0].exceptions[0]).toMatchObject({ kind: 'override', newDate: '2026-11-22', newStartTime: '12:00', newEndTime: '12:50' });
    expect(state.jobs[0].payload).toMatchObject({ mode: 'move', newDate: '2026-11-22', newStartTime: '12:00', nextDate: null });
    expect(state.history[0].action).toBe('date-moved');
  });

  it('"Ține" removes the change; on a date without one it writes nothing (decided 7)', async () => {
    const { ctx, state } = seed();
    await setDate(ctx, 'e1', '2026-11-14', { mode: 'cancel', reason: null });
    const kept = await setDate(ctx, 'e1', '2026-11-14', { mode: 'keep', notifyParents: true });
    expect(kept).toMatchObject({ ok: true, data: { value: { mode: 'keep', emails: 0 } } });
    expect(state.events[0].exceptions).toEqual([]);
    expect((await setDate(ctx, 'e1', '2026-11-15', { mode: 'keep' }))).toMatchObject({ ok: true, data: { actionId: null } });
    expect(state.jobs).toEqual([]);
  });
});

describe('refusals', () => {
  it('a date that is no class date, a break date (decided 6), an unknown mode', async () => {
    const { ctx } = seed();
    expect((await setDate(ctx, 'e1', '2026-11-16', { mode: 'cancel' })).ok).toBe(false);
    expect((await setDate(ctx, 'e1', '2026-12-26', { mode: 'cancel' })).ok).toBe(false);
    expect((await setDate(ctx, 'e1', '2026-11-14', { mode: 'later' })).ok).toBe(false);
  });

  it('locks the group, then the event (lock order)', async () => {
    const { ctx, state } = seed();
    await setDate(ctx, 'e1', '2026-11-14', { mode: 'cancel' });
    expect(state.locks).toEqual(['group:g-ib', 'event:e1']);
  });
});
describe('e-mail rules (F2, undo after send, commit order)', () => {
  it('the move e-mail carries the old time of the date, not the one just written (F2)', async () => {
    const { ctx, state } = seed();
    await setDate(ctx, 'e1', '2026-11-21', { mode: 'move', newDate: '2026-11-21', newStartTime: '12:00' });
    await setDate(ctx, 'e1', '2026-11-21', { mode: 'move', newDate: '2026-11-22', newStartTime: '13:00', notifyParents: true });
    expect(state.jobs[0].payload).toMatchObject({ mode: 'move', date: '2026-11-21', startTime: '12:00', newDate: '2026-11-22', newStartTime: '13:00' });
  });

  it('no e-mail is announced when the transaction fails', async () => {
    const { ctx, state, emailed } = seed();
    state.events[0].groupId = null;
    const res = await setDate(ctx, 'e1', '2026-11-14', { mode: 'cancel', notifyParents: true });
    expect([res.ok, emailed, state.jobs]).toEqual([false, [], []]);
  });

  it('the undo is refused once any e-mail of the change was sent, and nothing is touched', async () => {
    const { ctx, state } = seed();
    const res = await setDate(ctx, 'e1', '2026-11-14', { mode: 'cancel', notifyParents: true });
    state.jobs[0].status = 'sent';
    const undone = await undoAction(ctx, { actionId: actionOf(res) });
    expect(undone).toMatchObject({ ok: false, status: 409 });
    expect(state.events[0].exceptions).toHaveLength(1);
    expect(state.jobs.map((j) => j.status)).toEqual(['sent', 'queued']);
  });
});
