import { describe, expect, it } from 'vitest';
import { copyMembers, copyProgram } from '../new-season/copy-group';
import { changeProgram } from '../program';
import { joinGroup, moveMembership, removeMembership } from '../members';
import { undoAction } from '../undo-service';
import { athleteRow, event, fakeContext, member } from './fake-group-store';

const seed = () => fakeContext({
  athletes: [athleteRow({ id: 'a1', name: 'Ana Ionescu' }), athleteRow({ id: 'a2', name: 'Daria Stan' }), athleteRow({ id: 'a3', name: 'Tudor Matei', status: 'inactiv' })],
  memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a2', groupId: 'g-ib' })],
});
const actionOf = (res: { ok: boolean; data?: { actionId: string | null } }): string => (res.ok && res.data?.actionId) || '';
const STALE = { ok: false, status: 409, error: 'Nu se mai poate anula. Grupa s-a schimbat între timp.' };

describe('"Anulează" from the toast (8.1, W15)', () => {
  it('takes back a move exactly and writes "Anulat" on every subject', async () => {
    const { ctx, state } = seed();
    const before = structuredClone(state.memberships);
    const actionId = actionOf(await moveMembership(ctx, 'm1', { toGroupId: 'g-is' }));
    expect(await undoAction(ctx, { actionId })).toEqual({ ok: true, data: { undone: true } });
    expect(state.memberships).toEqual(before);
    const undone = state.history.filter((h) => h.action === 'undone');
    expect(undone.map((h) => h.subjectId)).toEqual(['g-ib', 'g-is', 'a1', 'a1']);
    expect(undone[0].changes).toEqual({ undoneAction: 'member-moved-out', undoneChanges: { athleteId: 'a1', toGroup: 'Intermediari Silver', main: { from: 'Intermediari Bronze', to: 'Intermediari Silver' } }, undoneOf: actionId });
  });

  it('deletes the row an add created and turns a reactivated athlete inactive again', async () => {
    const { ctx, state } = seed();
    const added = actionOf(await joinGroup(ctx, 'g-pro', { season: '2026-2027', athleteIds: ['a3'], mode: 'add' }));
    expect(state.athletes.find((a) => a.id === 'a3')?.status).toBe('activ');
    expect(await undoAction(ctx, { actionId: added })).toEqual({ ok: true, data: { undone: true } });
    expect(state.athletes.find((a) => a.id === 'a3')?.status).toBe('inactiv');
    expect(state.memberships.filter((m) => m.athleteId === 'a3')).toEqual([]);
  });

  it('re-creates an identical row after a remove that deleted it (it started today)', async () => {
    const { ctx, state } = fakeContext({
      athletes: [athleteRow({ id: 'a1', name: 'Ana Ionescu' })],
      memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib', from: '2026-11-20' })],
    });
    const gone = actionOf(await removeMembership(ctx, 'm1'));
    expect(state.memberships).toEqual([]);
    expect(await undoAction(ctx, { actionId: gone })).toEqual({ ok: true, data: { undone: true } });
    expect(state.memberships).toHaveLength(1);
    const { id, ...row } = state.memberships[0];
    expect(id).not.toBe('');
    expect(row).toEqual({ athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-11-20', to: null });
  });

  it('reopens an ended row: a remove that ended it is taken back to an open row', async () => {
    const { ctx, state } = seed();
    const ended = actionOf(await removeMembership(ctx, 'm1'));
    expect(state.memberships.find((m) => m.id === 'm1')?.to).not.toBeNull();
    expect((await undoAction(ctx, { actionId: ended })).ok).toBe(true);
    expect(state.memberships.find((m) => m.id === 'm1')?.to).toBeNull();
  });

  it('refuses an undo after another change on the group, and writes nothing', async () => {
    const { ctx, state } = seed();
    const first = actionOf(await removeMembership(ctx, 'm1'));
    await removeMembership(ctx, 'm2');
    const rows = structuredClone(state.memberships);
    const lines = state.history.length;
    expect(await undoAction(ctx, { actionId: first })).toEqual(STALE);
    expect(state.memberships).toEqual(rows);
    expect(state.history).toHaveLength(lines);
  });

  it('refuses a second undo of the same action', async () => {
    const { ctx, state } = seed();
    const again = actionOf(await removeMembership(ctx, 'm1'));
    expect((await undoAction(ctx, { actionId: again })).ok).toBe(true);
    expect(state.history.find((h) => h.id === again)?.changes.undone).toBe(true);
    const rows = structuredClone(state.memberships);
    expect(await undoAction(ctx, { actionId: again })).toEqual(STALE);
    expect(state.memberships).toEqual(rows);
  });

  it('answers 404 for an unknown action, 400 without one; the season text for a season action', async () => {
    const { ctx, state } = seed();
    expect(await undoAction(ctx, { actionId: 'nope' })).toEqual({ ok: false, status: 404, error: 'Nu a fost găsit.' });
    expect((await undoAction(ctx, {})).ok).toBe(false);
    await ctx.store.recordAction({ subjectType: 'season', subjectId: 's27', action: 'current-changed', changes: { from: false, to: true, undo: { kind: 'season', steps: [], subjects: [{ type: 'season', id: 's27' }], revalidate: true, registrationsAfter: { seasonId: 's27', at: '2026-11-20T10:00:00.000Z' } } }, actor: 'x' });
    state.filedAfter = 1;
    expect(await undoAction(ctx, { actionId: 'h1' })).toEqual({ ok: false, status: 409, error: 'Nu se mai poate anula. Sezonul s-a schimbat între timp.' });
  });

  it('pings revalidate once after a record that asks for it, not otherwise', async () => {
    const { ctx, revalidated } = seed();
    await ctx.store.recordAction({ subjectType: 'season', subjectId: 's27', action: 'current-changed', changes: { undo: { kind: 'season', steps: [], subjects: [{ type: 'season', id: 's27' }], revalidate: true } }, actor: 'x' });
    expect((await undoAction(ctx, { actionId: 'h1' })).ok).toBe(true);
    expect(revalidated()).toBe(1);
    const plain = actionOf(await removeMembership(ctx, 'm1'));
    await undoAction(ctx, { actionId: plain });
    expect(revalidated()).toBe(1);
  });

  it('locks the rows before checking, in the binding order', async () => {
    const { ctx, state } = seed();
    const actionId = actionOf(await moveMembership(ctx, 'm1', { toGroupId: 'g-is' }));
    state.locks = [];
    await undoAction(ctx, { actionId });
    expect(state.locks).toEqual(['season:s26', 'athlete:a1', `history:${actionId}`]);
  });

  it('refuses after a merge removed an athlete of the record, and leaves one main on the kept athlete', async () => {
    const { ctx, state } = fakeContext({
      athletes: [athleteRow({ id: 'a1', name: 'Ana Ionescu' }), athleteRow({ id: 'a2', name: 'Ana I.' })],
      memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a2', groupId: 'g-ib' })],
    });
    const moved = actionOf(await moveMembership(ctx, 'm2', { toGroupId: 'g-is' }));
    state.athletes = state.athletes.filter((a) => a.id !== 'a2');
    state.memberships = state.memberships.map((m) => (m.athleteId === 'a2' ? { ...m, athleteId: 'a1', isMain: false } : m));
    const rows = structuredClone(state.memberships);
    const lines = state.history.length;
    expect(await undoAction(ctx, { actionId: moved })).toEqual(STALE);
    expect(state.memberships).toEqual(rows);
    expect(state.history).toHaveLength(lines);
    expect(state.memberships.filter((m) => m.athleteId === 'a1' && m.isMain)).toHaveLength(1);
  });

  it('rolls the undo back when it would leave an athlete without exactly one main', async () => {
    const { ctx, state, logs } = seed();
    const moved = actionOf(await moveMembership(ctx, 'm1', { toGroupId: 'g-is' }));
    state.memberships = state.memberships.map((m) => (m.athleteId === 'a1' ? { ...m, isMain: true } : m)).concat(member({ id: 'm9', athleteId: 'a1', groupId: 'g-pro' }));
    const rows = structuredClone(state.memberships);
    const res = await undoAction(ctx, { actionId: moved });
    expect(res.ok).toBe(false);
    expect(state.memberships).toEqual(rows);
    expect(logs).toHaveLength(1);
  });

  it('locks the record itself last and refuses a second undo of a record without steps', async () => {
    const { ctx, state } = seed();
    await ctx.store.recordAction({ subjectType: 'season', subjectId: 's27', action: 'current-changed', changes: { undo: { kind: 'season', steps: [], subjects: [{ type: 'season', id: 's27' }], revalidate: false } }, actor: 'x' });
    state.locks = [];
    expect((await undoAction(ctx, { actionId: 'h1' })).ok).toBe(true);
    expect(state.locks).toEqual(['history:h1']);
    expect(await undoAction(ctx, { actionId: 'h1' })).toEqual({ ok: false, status: 409, error: 'Nu se mai poate anula. Sezonul s-a schimbat între timp.' });
  });
});

describe('an undone action no longer blocks an earlier undo (4-3)', () => {
  const copySeed = () => fakeContext({
    seasons: [
      { id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', isCurrent: false, membershipFee: 270 },
      { id: 's27', label: '2027-2028', startMonth: '2027-10-01', endMonth: '2028-05-31', isCurrent: true, membershipFee: 200 },
    ],
    athletes: [athleteRow({ id: 'a1', name: 'Ana' }), athleteRow({ id: 'a2', name: 'Bia' })],
    memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a2', groupId: 'g-ib' })],
    events: [event({ id: 'e1' })],
  }, '2027-10-10');
  const idOf = (res: { ok: boolean; data?: { actionId?: string | null } }): string => (res.ok && res.data?.actionId) || '';

  it('undoes A after B (a later action) was undone', async () => {
    const { ctx, state } = copySeed();
    const a = idOf(await copyMembers(ctx, 'g-ib', { season: '2027-2028' }));
    const b = idOf(await copyProgram(ctx, 'g-ib', { season: '2027-2028' }));
    expect(a && b).toBeTruthy();
    expect(await undoAction(ctx, { actionId: b })).toEqual({ ok: true, data: { undone: true } });
    expect(await undoAction(ctx, { actionId: a })).toEqual({ ok: true, data: { undone: true } });
    expect(state.memberships.filter((m) => m.seasonId === 's27')).toEqual([]);
  });

  it('still refuses A while B is not undone', async () => {
    const { ctx } = copySeed();
    const a = idOf(await copyMembers(ctx, 'g-ib', { season: '2027-2028' }));
    await copyProgram(ctx, 'g-ib', { season: '2027-2028' });
    expect(await undoAction(ctx, { actionId: a })).toEqual(STALE);
  });

  it('refuses A when a live action C came after the undone B', async () => {
    const { ctx, state } = copySeed();
    const a = idOf(await copyMembers(ctx, 'g-ib', { season: '2027-2028' }));
    const b = idOf(await copyProgram(ctx, 'g-ib', { season: '2027-2028' }));
    await undoAction(ctx, { actionId: b });
    await removeMembership(ctx, state.memberships.find((m) => m.seasonId === 's27')?.id ?? '');
    expect(await undoAction(ctx, { actionId: a })).toEqual(STALE);
  });

  it('refuses A with 409 and writes nothing when an undone remove re-created a copied row under a new id', async () => {
    const { ctx, state } = copySeed();
    const a = idOf(await copyMembers(ctx, 'g-ib', { season: '2027-2028' }));
    const copied = state.memberships.find((m) => m.seasonId === 's27' && m.athleteId === 'a1');
    const removed = idOf(await removeMembership(ctx, copied?.id ?? ''));
    expect(state.memberships.some((m) => m.id === copied?.id)).toBe(false);
    expect(await undoAction(ctx, { actionId: removed })).toEqual({ ok: true, data: { undone: true } });
    const rows = structuredClone(state.memberships);
    const lines = state.history.length;
    expect(await undoAction(ctx, { actionId: a })).toEqual(STALE);
    expect(state.memberships).toEqual(rows);
    expect(state.history).toHaveLength(lines);
  });

  it('refuses the copy-program undo when an undone "Schimbă" re-created the series under a new id', async () => {
    const { ctx, state } = copySeed();
    const a = idOf(await copyProgram(ctx, 'g-ib', { season: '2027-2028' }));
    const series = state.events.find((e) => e.recurrence.seasonStart === '2027-10-10');
    const changed = idOf(await changeProgram(ctx, series?.id ?? '', { repeat: true, freq: 'weekly', days: ['sat'], startTime: '12:00', durationMin: 50, weekOfMonth: null, from: '2027-10-10' }));
    expect(changed).toBeTruthy();
    expect(state.events.some((e) => e.id === series?.id)).toBe(false);
    expect(await undoAction(ctx, { actionId: changed })).toEqual({ ok: true, data: { undone: true } });
    const events = structuredClone(state.events);
    const lines = state.history.length;
    expect(await undoAction(ctx, { actionId: a })).toEqual(STALE);
    expect(state.events).toEqual(events);
    expect(state.history).toHaveLength(lines);
  });
});

describe('a group action undo takes the season lock first (4-3 final)', () => {
  it('locks the season before the athlete', async () => {
    const { ctx, state } = fakeContext({ athletes: [athleteRow({ id: 'a1', name: 'Ana' })], memberships: [] });
    const joined = actionOf(await joinGroup(ctx, 'g-ib', { season: '2026-2027', athleteIds: ['a1'], mode: 'add' }));
    state.locks = [];
    expect((await undoAction(ctx, { actionId: joined })).ok).toBe(true);
    expect(state.locks).toEqual(['season:s26', 'athlete:a1', `history:${joined}`]);
  });

  it('refuses a season that became past after the action, and writes nothing', async () => {
    const { ctx, state } = fakeContext({ athletes: [athleteRow({ id: 'a1', name: 'Ana' })], memberships: [] });
    const joined = actionOf(await joinGroup(ctx, 'g-ib', { season: '2026-2027', athleteIds: ['a1'], mode: 'add' }));
    for (const s of state.seasons) s.isCurrent = s.id === 's27';
    const rows = structuredClone(state.memberships);
    expect(await undoAction(ctx, { actionId: joined })).toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
    expect(state.memberships).toEqual(rows);
  });
});
