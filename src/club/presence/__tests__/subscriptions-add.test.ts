import { describe, expect, it } from 'vitest';
import { HISTORY_ACTIONS } from '../../history-text';
import { addSubscription } from '../subscriptions/add';
import { undoPresenceAction } from '../undo-service';
import { athleteRow, fakePresenceContext, member, type FakePresenceSeed } from './fake-store';

function seed(over: Partial<FakePresenceSeed> = {}): FakePresenceSeed {
  return {
    group: { athletes: [athleteRow({ id: 'a1', name: 'Ana Ionescu', email: 'ana@example.com' })], memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' })], admins: { 'admin@example.com': 'Admin Test' } },
    ...over,
  };
}
const add = (over: object = {}) => ({ itemKey: 'Abonament 8 ședințe', priceListId: 'pl-std', startsOn: '2026-10-27', cover: [], ...over });
const pay = { amount: 320, method: 'numerar', collectedAtRink: false, sendEmail: false };
const acsOf = (f: ReturnType<typeof fakePresenceContext>) => f.state.acs.find((r) => r.athleteId === 'a1' && r.seasonId === 's26')?.state ?? null;

describe('Adaugă abonament with the A.C.S. box', () => {
  it('member true for a non-member: member price, A.C.S. Da for the season, the undo puts it back', async () => {
    const f = fakePresenceContext(seed());
    const res = await addSubscription(f.ctx, 'a1', add({ member: true }));
    expect(res.ok).toBe(true);
    expect(f.state.subscriptions[0]).toMatchObject({ price: 320, audience: 'member' });
    expect(acsOf(f)).toBe('da');
    expect(f.group.history.some((h) => h.subjectType === 'athlete' && h.action === HISTORY_ACTIONS.acsChanged)).toBe(true);
    if (!res.ok || res.data.actionId === null) throw new Error('no action');
    expect((await undoPresenceAction(f.ctx, { actionId: res.data.actionId })).ok).toBe(true);
    expect([f.state.subscriptions, acsOf(f)]).toEqual([[], null]);
  });

  it('member false for a member: neafiliat price, membership stays', async () => {
    const f = fakePresenceContext(seed({ acs: [{ id: 'x1', athleteId: 'a1', seasonId: 's26', state: 'da' }] }));
    expect((await addSubscription(f.ctx, 'a1', add({ member: false }))).ok).toBe(true);
    expect(f.state.subscriptions[0]).toMatchObject({ price: 360, audience: 'nonMember' });
    expect(acsOf(f)).toBe('da');
  });

  it('no member field keeps the season state as before', async () => {
    const f = fakePresenceContext(seed());
    expect((await addSubscription(f.ctx, 'a1', add())).ok).toBe(true);
    expect(f.state.subscriptions[0]).toMatchObject({ price: 360 });
    expect(acsOf(f)).toBeNull();
  });

  it('a body with a non-boolean member or addFee is refused', async () => {
    const f = fakePresenceContext(seed());
    expect((await addSubscription(f.ctx, 'a1', add({ member: 'yes' }))).ok).toBe(false);
    expect((await addSubscription(f.ctx, 'a1', add({ addFee: 1 }))).ok).toBe(false);
  });

  it('addFee with membership turning on and a payment records the season fee as a payment', async () => {
    const f = fakePresenceContext(seed());
    expect((await addSubscription(f.ctx, 'a1', add({ member: true, addFee: true, payment: pay }))).ok).toBe(true);
    expect(f.state.payments.map((p) => [p.purpose, p.amount])).toEqual([['abonament', 320], ['cotizatie', 270]]);
    expect(acsOf(f)).toBe('da');
  });

  it('addFee is ignored for a member, without the member box, or without a payment', async () => {
    const already = fakePresenceContext(seed({ acs: [{ id: 'x1', athleteId: 'a1', seasonId: 's26', state: 'da' }] }));
    await addSubscription(already.ctx, 'a1', add({ member: true, addFee: true, payment: pay }));
    expect(already.state.payments.map((p) => p.purpose)).toEqual(['abonament']);
    const off = fakePresenceContext(seed());
    await addSubscription(off.ctx, 'a1', add({ member: false, addFee: true, payment: { ...pay, amount: 360 } }));
    expect(off.state.payments.map((p) => p.purpose)).toEqual(['abonament']);
    const none = fakePresenceContext(seed());
    await addSubscription(none.ctx, 'a1', add({ member: true, addFee: true }));
    expect(none.state.payments).toEqual([]);
  });

  it('a season without a fee ignores addFee', async () => {
    const base = seed();
    const f = fakePresenceContext({ ...base, group: { ...base.group, seasons: [{ id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', isCurrent: true, membershipFee: null }] } });
    expect((await addSubscription(f.ctx, 'a1', add({ member: true, addFee: true, payment: pay }))).ok).toBe(true);
    expect(f.state.payments.map((p) => p.purpose)).toEqual(['abonament']);
  });

  it('a failed add writes neither membership nor fee', async () => {
    const f = fakePresenceContext(seed());
    let created = 0;
    const store = f.store.createPayment.bind(f.store);
    f.store.createPayment = async (...args) => { if (++created === 2) throw new Error('fee write failed'); return store(...args); };
    expect((await addSubscription(f.ctx, 'a1', add({ member: true, addFee: true, payment: pay }))).ok).toBe(false);
    expect(created).toBe(2);
    expect([f.state.subscriptions, f.state.payments, acsOf(f)]).toEqual([[], [], null]);
  });
});
