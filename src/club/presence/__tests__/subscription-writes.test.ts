import { describe, expect, it } from 'vitest';
import type { AdminResult } from '../../admin-result';
import { historyTexts } from '../../history-text';
import { cancelPayment } from '../payments/cancel';
import { addSubscription, newSubscriptionForm } from '../subscriptions/add';
import { cancelSubscription } from '../subscriptions/cancel';
import { undoPresenceAction } from '../undo-service';
import { athleteRow, attendanceRow, fakePresenceContext, member, sessionRow, type FakePresenceContext, type FakePresenceSeed } from './fake-store';

const DATES = { t1: '2026-10-06', t2: '2026-10-13', t3: '2026-10-20' } as const;

function seed(): FakePresenceSeed {
  const ids = Object.keys(DATES) as (keyof typeof DATES)[];
  return {
    group: {
      athletes: [athleteRow({ id: 'a1', name: 'Ana Ionescu', email: 'ana@example.com' })],
      memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' })],
      admins: { 'admin@example.com': 'Admin Test' },
    },
    sessions: ids.map((id) => sessionRow({ id: `s-${id}`, groupId: 'g-ib', date: DATES[id] })),
    attendances: ids.map((id) => attendanceRow({ id, sessionId: `s-${id}`, uniqueKey: `s-${id}|a1`, billing: 'fara_abonament' })),
  };
}

const add = (over: object = {}) => ({ itemKey: 'Abonament 8 ședințe', priceListId: 'pl-std', startsOn: '2026-10-27', cover: ['t1', 't2'], ...over });
const pay = { amount: 360, method: 'numerar', collectedAtRink: true, sendEmail: true };

function actionIdOf(r: AdminResult<{ value: unknown; actionId: string | null }>): string {
  if (!r.ok || r.data.actionId === null) throw new Error(`expected an action id, got ${JSON.stringify(r)}`);
  return r.data.actionId;
}
const historyOf = (f: FakePresenceContext, type: string, id: string): string[] =>
  f.group.history.filter((h) => h.subjectType === type && h.subjectId === id).flatMap((h) => historyTexts(h.action, h.changes, h.subjectType));

describe('add an abonament', () => {
  it('the form: items of the main school list at the audience price, coverage oldest first, expiry (5.8)', async () => {
    const f = fakePresenceContext(seed());
    const form = await newSubscriptionForm(f.store, 'a1', '2026-10-27', '2026-11-20');
    expect(form).toMatchObject({ ok: true, data: { audience: 'nonMember', validUntil: '2026-11-23', hasEmail: true,
      lists: [{ priceListId: 'pl-std', listName: 'Standard', items: [{ itemKey: 'Abonament 8 ședințe', price: 360 }, { itemKey: 'Abonament 6 ședințe', price: 290 }] }] } });
    expect(form.ok && form.data.cover.map((c) => c.attendanceId)).toEqual(['t1', 't2', 't3']);
  });

  it('adds, freezes, covers and writes the lines (4.9, 8)', async () => {
    const f = fakePresenceContext(seed());
    const res = await addSubscription(f.ctx, 'a1', add());
    expect(res).toMatchObject({ ok: true, data: { value: { athleteName: 'Ana Ionescu', withPayment: false } } });
    expect(f.state.subscriptions[0]).toMatchObject({ itemName: 'Abonament 8 ședințe', price: 360, audience: 'nonMember', slots: 8, validUntil: '2026-11-23', recordedBy: 'Admin Test' });
    expect(f.state.attendances.filter((a) => a.billing === 'slot').map((a) => a.id)).toEqual(['t1', 't2']);
    expect(historyOf(f, 'athlete', 'a1')).toEqual(['Abonament adăugat: Abonament 8 ședințe, din 27 oct 2026, expiră pe 23 noi 2026.', 'Acoperă 2 prezențe fără abonament.']);
  });

  it('with the payment: one action, the toast undo removes both and restores the rows (5.8, 7.3)', async () => {
    const f = fakePresenceContext(seed());
    const res = await addSubscription(f.ctx, 'a1', add({ payment: pay }));
    expect(f.state.payments[0]).toMatchObject({ purpose: 'abonament', subscriptionId: f.state.subscriptions[0].id, paidOn: '2026-11-20', collectedAtRink: true });
    expect(f.state.jobs).toHaveLength(1);
    expect(f.emailsAfter).toEqual([f.state.payments[0].id]);
    expect(f.group.locks.slice(0, 2)).toEqual(['athlete:a1', `subscription:${f.state.subscriptions[0].id}`]);
    await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) });
    expect([f.state.subscriptions, f.state.payments]).toEqual([[], []]);
    expect(f.state.attendances.every((a) => a.billing === 'fara_abonament' && a.subscriptionId === null)).toBe(true);
    expect(f.state.jobs[0].status).toBe('cancelled');
  });

  it('an e-mail asked for an athlete without one writes nothing', async () => {
    const f = fakePresenceContext({ ...seed(), group: { ...seed().group, athletes: [athleteRow({ id: 'a1', name: 'Ana Ionescu', email: null })] } });
    expect((await addSubscription(f.ctx, 'a1', add({ payment: pay }))).ok).toBe(false);
    expect([f.state.subscriptions, f.state.payments]).toEqual([[], []]);
  });

  it('the undo is refused once a slot of it was used (7.3)', async () => {
    const f = fakePresenceContext(seed());
    const res = await addSubscription(f.ctx, 'a1', add({ cover: [] }));
    await f.store.updateAttendance('t3', { subscriptionId: f.state.subscriptions[0].id, billing: 'slot' });
    expect((await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) })).ok).toBe(false);
  });

  it('a covered row that got a slot meanwhile refuses everything; more rows than slots refused (Review Focus)', async () => {
    const f = fakePresenceContext(seed());
    await f.store.updateAttendance('t2', { subscriptionId: 'other', billing: 'slot' });
    expect(await addSubscription(f.ctx, 'a1', add())).toEqual({ ok: false, status: 409, error: 'Prezența s-a schimbat între timp. Reîncarcă.' });
    expect(f.state.subscriptions).toEqual([]);
    expect((await addSubscription(f.ctx, 'a1', add({ itemKey: 'Abonament 6 ședințe', cover: ['t1', 't2', 't3', 'x4', 'x5', 'x6', 'x7'] }))).ok).toBe(false);
  });

  it('a second identical abonament within 10 s is not written (decided 1)', async () => {
    const f = fakePresenceContext(seed());
    await addSubscription(f.ctx, 'a1', add({ cover: [] }));
    expect(await addSubscription(f.ctx, 'a1', add({ cover: [] }))).toMatchObject({ ok: true, data: { actionId: null } });
    expect(f.state.subscriptions).toHaveLength(1);
  });

  it('refuses an item not offered, a list not the athlete\'s, a Gold item for a Standard athlete (4.9)', async () => {
    const f = fakePresenceContext(seed());
    expect((await addSubscription(f.ctx, 'a1', add({ itemKey: 'Nu există' }))).ok).toBe(false);
    expect((await addSubscription(f.ctx, 'a1', add({ priceListId: 'pl-gold', itemKey: 'Abonament 8 ședințe Gold' }))).ok).toBe(false);
    expect((await addSubscription(f.ctx, 'a1', add({ startsOn: '2020-01-01' }))).ok).toBe(false);
    expect(f.state.subscriptions).toEqual([]);
  });
});

describe('"Anulează abonamentul"', () => {
  it('row kept anulat, its rows back to "Fără abonament"; undo restores the links (4.8a, p5 Q40)', async () => {
    const f = fakePresenceContext(seed());
    await addSubscription(f.ctx, 'a1', add());
    const id = f.state.subscriptions[0].id;
    const res = await cancelSubscription(f.ctx, id);
    expect(f.state.subscriptions[0]).toMatchObject({ cancelled: true, cancelledBy: 'Admin Test' });
    expect(f.state.attendances.map((a) => a.billing)).toEqual(['fara_abonament', 'fara_abonament', 'fara_abonament']);
    expect(historyOf(f, 'subscription', id)).toContain('Abonament anulat.');
    await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) });
    expect(f.state.attendances.filter((a) => a.subscriptionId === id).map((a) => a.id)).toEqual(['t1', 't2']);
    expect(f.state.subscriptions[0].cancelled).toBe(false);
  });

  it('refused while a payment points to it, allowed after that payment is cancelled (C75)', async () => {
    const f = fakePresenceContext(seed());
    await addSubscription(f.ctx, 'a1', add({ payment: { amount: 360, method: 'numerar', collectedAtRink: false, sendEmail: false } }));
    const id = f.state.subscriptions[0].id;
    expect(await cancelSubscription(f.ctx, id)).toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
    await cancelPayment(f.ctx, f.state.payments[0].id);
    expect((await cancelSubscription(f.ctx, id)).ok).toBe(true);
  });

  it('a second cancel is refused as stale', async () => {
    const f = fakePresenceContext(seed());
    await addSubscription(f.ctx, 'a1', add());
    const id = f.state.subscriptions[0].id;
    await cancelSubscription(f.ctx, id);
    expect(await cancelSubscription(f.ctx, id)).toMatchObject({ ok: false, status: 409 });
  });

  it('the undo is refused once a freed row was covered again (7.3)', async () => {
    const f = fakePresenceContext(seed());
    await addSubscription(f.ctx, 'a1', add());
    const res = await cancelSubscription(f.ctx, f.state.subscriptions[0].id);
    f.advance(11_000);
    await addSubscription(f.ctx, 'a1', add({ cover: ['t1'] }));
    expect((await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) })).ok).toBe(false);
  });
});
