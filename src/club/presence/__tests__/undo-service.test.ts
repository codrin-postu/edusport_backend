import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { acsGuardId } from '../undo';
import { athleteRow, attendanceRow, fakePresenceContext, lessonRow, paymentRow, subscriptionRow } from './fake-store';
import { guardOf, recordPresenceAction } from '../action-log';
import { undoKindOf, undoPresenceAction } from '../undo-service';

const SRC = join(__dirname, '..', '..', '..');

/** A "record payment" action: payment p1 created, A.C.S. set from no row to Da, e-mail job queued. */
async function recordedPayment() {
  const f = fakePresenceContext({ group: { athletes: [athleteRow({ id: 'a1' })] }, payments: [paymentRow({ id: 'p1' })], acs: [{ id: 'acs-1', athleteId: 'a1', seasonId: 's26', state: 'da' }] });
  f.state.jobs.push({ id: 'job-1', recipient: 'x@example.com', subject: 's', paymentId: 'p1', notBefore: '2026-11-20T10:00:00.000Z', payload: { athleteName: 'A', amount: 320, method: 'numerar', paidOn: '2026-10-27', purposeText: 'Altceva' }, status: 'queued' });
  const actionId = await f.store.transaction(async () => recordPresenceAction(f.store, 'admin@example.com',
    [{ subjectType: 'payment', subjectId: 'p1', action: 'payment-recorded' }, { subjectType: 'athlete', subjectId: 'a1', action: 'payment-recorded' }],
    { athletes: ['a1'], guards: [await guardOf(f.store, 'payment', 'p1'), await guardOf(f.store, 'acs', acsGuardId('a1', 's26'))], steps: [{ op: 'deletePayment', id: 'p1' }, { op: 'setAcs', athleteId: 'a1', seasonId: 's26', state: null }, { op: 'cancelPaymentEmail', paymentId: 'p1' }] }));
  return { ...f, actionId };
}

describe('undoPresenceAction', () => {
  it('takes the action back and writes "Anulat" lines (7.3)', async () => {
    const f = await recordedPayment();
    expect(await undoPresenceAction(f.ctx, { actionId: f.actionId })).toEqual({ ok: true, data: { undone: true } });
    expect(f.state.payments).toEqual([]);
    expect(await f.store.acsRows({ athleteId: 'a1' })).toEqual([]);
    expect(f.state.jobs.map((j) => j.status)).toEqual(['cancelled']);
    expect(f.group.history.filter((h) => h.action === 'undone').map((h) => h.subjectType).sort()).toEqual(['athlete', 'payment']);
  });
  it('is refused after the payment was edited, and when sent twice (7.3)', async () => {
    const f = await recordedPayment();
    await f.store.updatePayment('p1', { amount: 300 });
    expect(await undoPresenceAction(f.ctx, { actionId: f.actionId })).toEqual({ ok: false, status: 409, error: 'Nu se mai poate anula. Datele s-au schimbat între timp.' });
    expect(f.state.payments).toHaveLength(1);
    const g = await recordedPayment();
    await undoPresenceAction(g.ctx, { actionId: g.actionId });
    expect((await undoPresenceAction(g.ctx, { actionId: g.actionId })).ok).toBe(false);
  });
  it('is refused after a concurrent A.C.S. change, and the athlete-season guard holds when untouched (7.3)', async () => {
    const f = await recordedPayment();
    await f.store.setAcs('a1', 's26', 'nu');
    expect(await undoPresenceAction(f.ctx, { actionId: f.actionId })).toEqual({ ok: false, status: 409, error: 'Nu se mai poate anula. Datele s-au schimbat între timp.' });
    expect(f.state.payments).toHaveLength(1);
    const g = await recordedPayment();
    await g.store.setAcs('a1', 's26', null);
    expect((await undoPresenceAction(g.ctx, { actionId: g.actionId })).ok).toBe(false);
  });
  it('is refused when the row is gone or the e-mail already went out', async () => {
    const f = await recordedPayment();
    await f.store.deletePayment('p1');
    expect((await undoPresenceAction(f.ctx, { actionId: f.actionId })).ok).toBe(false);
    const g = await recordedPayment();
    g.state.jobs[0].status = 'sent';
    expect((await undoPresenceAction(g.ctx, { actionId: g.actionId })).ok).toBe(false);
    expect(g.state.payments).toHaveLength(1);
  });
  it('is refused when an athlete of the record no longer exists (merge)', async () => {
    const f = await recordedPayment();
    f.group.athletes = [];
    expect(await undoPresenceAction(f.ctx, { actionId: f.actionId })).toEqual({ ok: false, status: 409, error: 'Nu se mai poate anula. Datele s-au schimbat între timp.' });
    expect(f.state.payments).toHaveLength(1);
  });
  it('answers 400 without an action id and 404 for an unknown one', async () => {
    const f = await recordedPayment();
    expect((await undoPresenceAction(f.ctx, {}))).toMatchObject({ ok: false, status: 400 });
    expect((await undoPresenceAction(f.ctx, { actionId: 'missing' }))).toMatchObject({ ok: false, status: 404 });
  });
  it('rolls everything back when a step fails', async () => {
    const f = await recordedPayment();
    f.failOn('setAcs');
    expect(await undoPresenceAction(f.ctx, { actionId: f.actionId })).toEqual({ ok: false, status: 500, error: 'Acțiunea nu a reușit. Nimic nu a fost salvat.' });
    expect(f.state.payments).toHaveLength(1);
    expect(f.logs[0]).toContain('[undo-presence]');
  });
  it('takes the locks in order (7.1)', async () => {
    const f = await recordedPayment();
    await undoPresenceAction(f.ctx, { actionId: f.actionId });
    expect(f.group.locks.slice(-3)).toEqual(['athlete:a1', 'payment:p1', `history:${f.actionId}`]);
  });
  it('locks attendance rows after lessons and before subscriptions (7.1)', async () => {
    const f = fakePresenceContext({ group: { athletes: [athleteRow({ id: 'a1' })] }, subscriptions: [subscriptionRow({ id: 'sub1' })], lessons: [lessonRow({ id: 'l1' })], attendances: [attendanceRow({ id: 't1' }), attendanceRow({ id: 't2' })] });
    const actionId = await f.store.transaction(async () => recordPresenceAction(f.store, 'admin@example.com', [{ subjectType: 'athlete', subjectId: 'a1', action: 'payment-recorded' }],
      { athletes: ['a1'], guards: [], steps: [{ op: 'setAttendanceSlot', id: 't2', subscriptionId: null, billing: 'fara_abonament' }, { op: 'deleteSubscription', id: 'sub1' }, { op: 'setAttendanceSlot', id: 't1', subscriptionId: null, billing: 'fara_abonament' }, { op: 'deleteLesson', id: 'l1' }] }));
    f.group.locks.length = 0;
    await undoPresenceAction(f.ctx, { actionId });
    expect(f.group.locks).toEqual(['athlete:a1', 'lesson:l1', 'attendance:t1', 'attendance:t2', 'subscription:sub1', `history:${actionId}`]);
  });
  it('dispatch: presence records go to the presence undo, others to phase 4', async () => {
    const f = await recordedPayment();
    expect(await undoKindOf(f.store, { actionId: f.actionId })).toBe('presence');
    expect(await undoKindOf(f.store, { actionId: 'missing' })).toBe('other');
    expect(readFileSync(join(SRC, 'api/club/controllers/groups.ts'), 'utf8')).toMatch(/kind === 'presence'/);
  });
});
