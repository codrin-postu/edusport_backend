import { describe, expect, it } from 'vitest';
import { phase4Lines } from '../history-lines';
import { addDays } from '../dates';
import { onDate, rosterOn } from '../../presence/attendance/roster';
import type { MembershipRow } from '../../athletes/store';
import { moveMembershipFrom, removeMembershipFrom } from '../members';
import { athleteRow, fakeContext, member } from './fake-group-store';

/** On every day of the season the athlete has exactly one main row, never two (when she has any row that day). */
function oneMainEveryDay(rows: MembershipRow[], athleteId: string): void {
  for (let d = '2026-09-01'; d <= '2027-05-31'; d = addDays(d, 1)) {
    const mine = rows.filter((m) => m.athleteId === athleteId && onDate(m, d));
    if (mine.length > 0) expect(mine.filter((m) => m.isMain), d).toHaveLength(1);
  }
}

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
    oneMainEveryDay(state.memberships, 'a1');
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
  it('keeps the main row until the day before, then the earliest remaining row is main from the date', async () => {
    const { ctx, state } = seed();
    expect((await removeMembershipFrom(ctx, 'm1', '2026-11-20')).ok).toBe(true);
    expect(state.memberships.find((m) => m.id === 'm1')).toMatchObject({ to: '2026-11-19', isMain: true });
    expect(state.memberships.find((m) => m.id === 'm2')).toMatchObject({ to: '2026-11-19', isMain: false });
    expect(state.memberships.find((m) => m.id !== 'm1' && m.id !== 'm2')).toMatchObject({ groupId: 'g-pp', from: '2026-11-20', to: null, isMain: true });
    oneMainEveryDay(state.memberships, 'a1');
    expect(state.history.map((h) => h.action)).toContain('main-group-changed');
    for (const h of state.history) expect(h.changes.from === '2026-11-20' || h.changes.effectiveFrom === '2026-11-20').toBe(true);
  });
});

describe('a move into a group the child is already in', () => {
  it('the main flag reaches the target row only on the date, never two mains on a day', async () => {
    const { ctx, state } = seed();
    expect((await moveMembershipFrom(ctx, 'm1', 'g-pp', '2026-11-12')).ok).toBe(true);
    expect(state.memberships.find((m) => m.id === 'm1')).toMatchObject({ to: '2026-11-11', isMain: true });
    expect(state.memberships.find((m) => m.id === 'm2')).toMatchObject({ to: '2026-11-11', isMain: false });
    expect(state.memberships.find((m) => m.id !== 'm1' && m.id !== 'm2')).toMatchObject({ groupId: 'g-pp', from: '2026-11-12', isMain: true });
    oneMainEveryDay(state.memberships, 'a1');
  });
});

describe('a date before the row starts', () => {
  it('is refused for a move and a removal, nothing written', async () => {
    const { ctx, state } = seed();
    await moveMembershipFrom(ctx, 'm1', 'g-is', '2026-11-12');
    const silver = state.memberships.find((m) => m.groupId === 'g-is')!;
    const before = structuredClone(state.memberships);
    expect(await moveMembershipFrom(ctx, silver.id, 'g-av', '2026-11-10')).toEqual({ ok: false, status: 400, error: 'Cerere invalidă.' });
    expect(await removeMembershipFrom(ctx, silver.id, '2026-11-10')).toMatchObject({ ok: false, status: 400 });
    expect(state.memberships).toEqual(before);
    expect((await moveMembershipFrom(ctx, silver.id, 'g-av', '2026-11-15')).ok).toBe(true);
    oneMainEveryDay(state.memberships, 'a1');
  });
});

describe('the target is checked again under the lock', () => {
  it('a refused target writes nothing', async () => {
    const { ctx, state } = seed();
    const before = structuredClone(state.memberships);
    expect(await moveMembershipFrom(ctx, 'm1', 'g-is', '2026-11-12', undefined, () => 'Nu mai ai acces la această grupă.')).toEqual({ ok: false, status: 403, error: 'Nu mai ai acces la această grupă.' });
    expect(state.memberships).toEqual(before);
    expect(state.history).toEqual([]);
  });
});

describe('Istoric text of a dated change', () => {
  it('shows the date the change takes effect on', async () => {
    const { ctx, state } = seed();
    await moveMembershipFrom(ctx, 'm1', 'g-is', '2026-11-12');
    const names = { a1: 'Ana Ionescu' };
    const text = state.history.flatMap((h) => phase4Lines(h.action, h.changes, names) ?? []);
    expect(text.some((t) => t.startsWith('Mutat în Intermediari Silver: Ana Ionescu din 12 noiembrie.'))).toBe(true);
    expect(text).toContain('Mutat din Intermediari Bronze în Intermediari Silver din 12 noiembrie');
    expect(text).toContain('Mutat din Intermediari Bronze: Ana Ionescu din 12 noiembrie.');
  });
});
