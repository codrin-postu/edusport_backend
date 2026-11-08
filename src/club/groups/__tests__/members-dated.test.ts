import { describe, expect, it } from 'vitest';
import { rosterOn } from '../../presence/attendance/roster';
import { moveMembershipFrom, removeMembershipFrom } from '../members';
import { athleteRow, fakeContext, member } from './fake-group-store';

const STALE = { ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' };
/** Ana: main in Bronze (g-ib) since 2026-09-01, also in "Uscat" (g-pp). Today 2026-11-09. */
const seed = (bronze = member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib', from: '2026-09-01' })) =>
  fakeContext({
    athletes: [athleteRow({ id: 'a1', name: 'Ana Ionescu' })],
    memberships: [bronze, member({ id: 'm2', athleteId: 'a1', groupId: 'g-pp', isMain: false, from: '2026-09-15' })],
  }, '2026-11-09');

describe('a move from a later date (W2)', () => {
  it('ends the old row the day before, starts the new one on the date, main travels', async () => {
    const { ctx, state } = seed();
    const res = await moveMembershipFrom(ctx, 'm1', 'g-is', '2026-11-12');
    expect(res.ok).toBe(true);
    expect(state.memberships.find((m) => m.id === 'm1')).toMatchObject({ to: '2026-11-11' });
    expect(state.memberships.find((m) => m.groupId === 'g-is')).toMatchObject({ from: '2026-11-12', isMain: true });
    expect(state.memberships.find((m) => m.id === 'm2')).toMatchObject({ to: null, isMain: false });
    const lines = state.history.filter((h) => ['member-moved-out', 'member-moved-in', 'athlete-group-moved'].includes(h.action));
    expect(lines.map((h) => [h.subjectId, h.action])).toEqual([['g-ib', 'member-moved-out'], ['g-is', 'member-moved-in'], ['a1', 'athlete-group-moved']]);
    for (const h of state.history) expect(h.changes.from === '2026-11-12' || h.changes.effectiveFrom === '2026-11-12').toBe(true);
    expect(state.history.find((h) => h.action === 'athlete-group-moved')?.changes).toMatchObject({ from: 'Intermediari Bronze', effectiveFrom: '2026-11-12' });
    expect(rosterOn(state.memberships, 'g-ib', 's26', '2026-11-11')).toContain('a1');
    expect(rosterOn(state.memberships, 'g-ib', 's26', '2026-11-12')).not.toContain('a1');
    expect(rosterOn(state.memberships, 'g-is', 's26', '2026-11-11')).not.toContain('a1');
    expect(rosterOn(state.memberships, 'g-is', 's26', '2026-11-12')).toContain('a1');
  });

  it('deletes a row that starts on or after the date', async () => {
    const { ctx, state } = seed(member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib', from: '2026-11-09' }));
    expect((await moveMembershipFrom(ctx, 'm1', 'g-is', '2026-11-09')).ok).toBe(true);
    expect(state.memberships.find((m) => m.id === 'm1')).toBeUndefined();
    expect(state.history.every((h) => h.changes.effectiveFrom === undefined)).toBe(true);
  });

  it('refuses a second dated move on a row that already has an end', async () => {
    const { ctx, state } = seed();
    await moveMembershipFrom(ctx, 'm1', 'g-is', '2026-11-12');
    const before = structuredClone(state.memberships);
    expect(await moveMembershipFrom(ctx, 'm1', 'g-av', '2026-11-14')).toEqual(STALE);
    expect(state.memberships).toEqual(before);
  });
});

describe('a removal from a later date (W4)', () => {
  it('ends the row the day before and the earliest remaining row becomes main', async () => {
    const { ctx, state } = seed();
    expect((await removeMembershipFrom(ctx, 'm1', '2026-11-20')).ok).toBe(true);
    expect(state.memberships.find((m) => m.id === 'm1')).toMatchObject({ to: '2026-11-19' });
    expect(state.memberships.find((m) => m.id === 'm2')).toMatchObject({ isMain: true });
    expect(state.history.map((h) => h.action)).toContain('main-group-changed');
    for (const h of state.history) expect(h.changes.from === '2026-11-20' || h.changes.effectiveFrom === '2026-11-20').toBe(true);
  });
});
