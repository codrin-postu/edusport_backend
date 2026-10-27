import { describe, expect, it } from 'vitest';
import type { ActionResult } from '../action-log';
import { moveMembership, type MoveCarry } from '../members';
import { GROUP_ERRORS } from '../copy';
import type { CarryPorts } from '../undo';
import { undoAction } from '../undo-service';
import { athleteRow, fakeContext, member, G_GROUPS } from './fake-group-store';

const moveGroupSeed = () => fakeContext({
  athletes: [athleteRow({ id: 'a1', name: 'Ana Ionescu' })],
  memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' })],
  groups: [...G_GROUPS, { ...G_GROUPS[1], id: 'g-gold', name: 'Avansați Gold', order: 4 }],
});
const stubCarry: MoveCarry = async () => ({
  lines: [{ subjectType: 'subscription', subjectId: 'std', action: 'subscription-carried', changes: { listName: 'Avansați Gold' } }],
  steps: [{ op: 'uncarry', subscriptionId: 'std', priceListId: 'pl-gold', athleteId: 'a1' }],
  carried: 1,
});
const stubPorts = (o: { used: boolean; gone?: boolean; locks?: string[] }): CarryPorts & { calls: string[][] } => {
  const calls: string[][] = [];
  return {
    calls, lockSubscription: async (id) => { o.locks?.push(`subscription:${id}`); }, subscriptionExists: async () => !o.gone, uncarry: async (s, l) => { calls.push(['uncarry', s, l]); }, carryUsed: async () => o.used };
};
const actionIdOf = (res: ActionResult<unknown>): string => (res.ok ? String(res.data.actionId) : '');

describe('Mută with a carry (5.12)', () => {
  it('the move writes the carry lines in its action and answers carried (5.12)', async () => {
    const f = moveGroupSeed();
    const res = await moveMembership(f.ctx, 'm1', { toGroupId: 'g-gold' }, stubCarry);
    expect(res).toMatchObject({ ok: true, data: { value: { carried: 1 } } });
    expect(f.state.history.find((h) => h.action === 'subscription-carried')?.changes.actionId).toBe(actionIdOf(res));
  });

  it('without a carry port the move is unchanged (phase 4 tests)', async () => {
    const f = moveGroupSeed();
    expect(await moveMembership(f.ctx, 'm1', { toGroupId: 'g-gold' })).toMatchObject({ ok: true, data: { value: { carried: 0 } } });
  });

  it('the move undo runs uncarry; refused when the carry was used (7.3)', async () => {
    const f = moveGroupSeed();
    const res = await moveMembership(f.ctx, 'm1', { toGroupId: 'g-gold' }, stubCarry);
    expect(await undoAction(f.ctx, { actionId: actionIdOf(res) }, stubPorts({ used: true }))).toEqual({ ok: false, status: 409, error: GROUP_ERRORS.undoGroup });
    const ports = stubPorts({ used: false });
    expect((await undoAction(f.ctx, { actionId: actionIdOf(res) }, ports)).ok).toBe(true);
    expect(ports.calls).toEqual([['uncarry', 'std', 'pl-gold']]);
  });
});

describe('the move undo locks and refuses in order (7.1)', () => {
  it('locks the abonament after the athlete, before the history entry', async () => {
    const f = moveGroupSeed();
    const res = await moveMembership(f.ctx, 'm1', { toGroupId: 'g-gold' }, stubCarry);
    f.state.locks.length = 0;
    expect((await undoAction(f.ctx, { actionId: actionIdOf(res) }, stubPorts({ used: false, locks: f.state.locks }))).ok).toBe(true);
    const at = (k: string) => f.state.locks.indexOf(k);
    expect(at('athlete:a1')).toBeLessThan(at('subscription:std'));
    expect(at('subscription:std')).toBeLessThan(f.state.locks.findIndex((k) => k.startsWith('history:')));
  });

  it('a missing abonament refuses with 409 and writes nothing', async () => {
    const f = moveGroupSeed();
    const res = await moveMembership(f.ctx, 'm1', { toGroupId: 'g-gold' }, stubCarry);
    const ports = stubPorts({ used: false, gone: true });
    expect(await undoAction(f.ctx, { actionId: actionIdOf(res) }, ports)).toEqual({ ok: false, status: 409, error: GROUP_ERRORS.undoGroup });
    expect(ports.calls).toEqual([]);
  });
});
