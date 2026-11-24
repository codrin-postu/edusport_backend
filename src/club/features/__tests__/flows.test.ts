import { describe, expect, it } from 'vitest';
import { ALL_ON } from '../features';
import type { CarryOutcome } from '../../groups/members';
import { G_GROUPS, member } from '../../groups/__tests__/fake-group-store';
import { movePreview, presenceCarry } from '../../presence/subscriptions/move';
import { fakePresenceContext, P_GROUPS, sessionRow, subscriptionRow } from '../../presence/__tests__/fake-store';

const seed = () => ({
  group: {
    groups: [...P_GROUPS, { ...G_GROUPS[1], id: 'g-ib2', name: 'Intermediari Bronze 2', order: 5 }],
    memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' })],
  },
  subscriptions: [subscriptionRow({ id: 'std', priceListId: 'pl-std', price: 320, audience: 'member', slots: 8, validUntil: '2026-11-23' })],
  sessions: [sessionRow({ id: 'sg', groupId: 'g-gold' })],
});
const move = { athleteId: 'a1', fromGroupId: 'g-ib', toGroupId: 'g-gold', today: '2026-11-20' };

async function run(abonamente: boolean) {
  const f = fakePresenceContext(seed());
  let out!: CarryOutcome;
  await f.store.transaction(async () => {
    await f.store.lockAthlete('a1');
    out = await presenceCarry(f.store, { abonamente }).carry(move);
  });
  return { f, out };
}

describe('group move with the abonamente switch', () => {
  it('off: no abonament is carried or locked, the move outcome is empty', async () => {
    const { f, out } = await run(false);
    expect(out).toEqual({ lines: [], steps: [], carried: 0 });
    expect(f.state.subscriptions[0].validIn).toEqual([]);
    expect(f.group.locks).toEqual(['athlete:a1']);
  });

  it('on: the same move still carries', async () => {
    const { f, out } = await run(true);
    expect(out.carried).toBe(1);
    expect(f.state.subscriptions[0].validIn).toEqual(['pl-gold']);
  });

  it('off: the move preview shows no bar and no carry; on it does', async () => {
    const f = fakePresenceContext(seed());
    const to = { athleteId: 'a1', fromGroupId: 'g-ib', toGroupId: 'g-gold' };
    expect(await movePreview(f.store, to, '2026-11-20', { ...ALL_ON, abonamente: false })).toEqual({ bar: null, carries: false });
    expect((await movePreview(f.store, to, '2026-11-20', ALL_ON)).carries).toBe(true);
  });
});
