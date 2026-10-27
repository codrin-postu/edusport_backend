import { describe, expect, it } from 'vitest';
import { allocateAll, joinGroup, moveMembership, removeMembership } from '../members';
import { athleteRow, fakeContext, member } from './fake-group-store';

const ATHLETES = [
  athleteRow({ id: 'a1', name: 'Ana Ionescu' }), athleteRow({ id: 'a2', name: 'Daria Stan' }), athleteRow({ id: 'a3', name: 'Elisa Georgescu', status: 'nou' }),
  athleteRow({ id: 'a4', name: 'Tudor Matei', status: 'inactiv' }), athleteRow({ id: 'a5', name: 'Sportiv anonimizat', status: 'anonimizat' }),
];
const seed = (memberships = [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' })]) => fakeContext({ athletes: ATHLETES, memberships });
const current = (state: { memberships: { athleteId: string; to?: string | null }[] }, athleteId: string) => state.memberships.filter((m) => m.athleteId === athleteId && !m.to);

describe('"Alocă" (5.3)', () => {
  it('places the athlete as main from today, writes group and athlete lines and answers an undo', async () => {
    const { ctx, state } = seed();
    const res = await joinGroup(ctx, 'g-ib', { season: '2026-2027', athleteIds: ['a3'], mode: 'allocate' });
    expect(res).toEqual({ ok: true, data: { value: { added: 1, athleteNames: ['Elisa Georgescu'], groupName: 'Intermediari Bronze' }, actionId: 'h1' } });
    expect(current(state, 'a3')).toMatchObject([{ groupId: 'g-ib', isMain: true, from: '2026-11-20' }]);
    expect(state.history.map((h) => [h.subjectType, h.action])).toEqual([['group', 'member-allocated'], ['athlete', 'group-added']]);
    expect(state.history[0].changes.undo).toMatchObject({ kind: 'group', steps: [{ op: 'deleteMembership', athleteId: 'a3' }] });
    expect(state.history[1].changes.actionId).toBe('h1');
    expect(state.athletes.find((a) => a.id === 'a3')?.status).toBe('nou');
  });

  it('starts on the season start when the season has not begun (gaps #29)', async () => {
    const { ctx, state } = seed();
    await joinGroup(ctx, 'g-ib', { season: '2027-2028', athleteIds: ['a3'], mode: 'allocate' });
    expect(state.memberships.find((m) => m.athleteId === 'a3')?.from).toBe('2027-10-01');
  });

  it('skips an athlete who got a group meanwhile: nothing written, no undo', async () => {
    const { ctx, state } = seed();
    const res = await joinGroup(ctx, 'g-pp', { season: '2026-2027', athleteIds: ['a1'], mode: 'allocate' });
    expect(res).toEqual({ ok: true, data: { value: { added: 0, athleteNames: [], groupName: 'Primii Pași' }, actionId: null } });
    expect(state.history).toEqual([]);
  });

  it('refuses a past season, an inactive group and an anonymized athlete', async () => {
    const { ctx, state } = seed();
    expect(await joinGroup(ctx, 'g-ib', { season: '2025-2026', athleteIds: ['a3'], mode: 'allocate' })).toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
    state.groups[0].active = false;
    expect((await joinGroup(ctx, 'g-pp', { season: '2026-2027', athleteIds: ['a3'], mode: 'allocate' })).ok).toBe(false);
    expect((await joinGroup(ctx, 'g-ib', { season: '2026-2027', athleteIds: ['a5'], mode: 'add' })).ok).toBe(false);
  });

  it('locks athletes sorted by id, then the group', async () => {
    const { ctx, state } = seed();
    await joinGroup(ctx, 'g-ib', { season: '2026-2027', athleteIds: ['a3', 'a2'], mode: 'add' });
    expect(state.locks).toEqual(['season:s26', 'athlete:a2', 'athlete:a3', 'group:g-ib']);
  });
});

/** The season is switched right after the writer locked it: the writer must read it again and refuse (season lock before athletes and groups). */
describe('a season that turns past while the writer waits for its lock', () => {
  const STALE = { ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' };
  const switchOnLock = (c: ReturnType<typeof seed>) => {
    const lock = c.ctx.store.lockSeason;
    c.ctx.store.lockSeason = async (id) => {
      await lock(id);
      c.state.seasons.forEach((x) => { x.isCurrent = x.id === 's27'; });
    };
    return c;
  };
  const writers: [string, (c: ReturnType<typeof seed>) => Promise<unknown>][] = [
    ['joinGroup', (c) => joinGroup(c.ctx, 'g-pp', { season: '2026-2027', athleteIds: ['a3'], mode: 'allocate' })],
    ['allocateAll', (c) => allocateAll(c.ctx, { season: '2026-2027', items: [{ athleteId: 'a3', groupId: 'g-pp' }] })],
    ['moveMembership', (c) => moveMembership(c.ctx, 'm1', { toGroupId: 'g-pp' })],
    ['removeMembership', (c) => removeMembership(c.ctx, 'm1')],
  ];
  it.each(writers)('%s refuses and writes nothing', async (_name, run) => {
    const c = switchOnLock(seed());
    const before = structuredClone(c.state.memberships);
    expect(await run(c)).toEqual(STALE);
    expect(c.state.memberships).toEqual(before);
    expect(c.state.locks.filter((l) => !l.startsWith('season:'))).toEqual([]);
  });
});

describe('"Adaugă sportivi" and "Adaugă și în grupă" (6.2, W3)', () => {
  it('a second group is not main; an inactive athlete is reactivated', async () => {
    const { ctx, state } = seed();
    await joinGroup(ctx, 'g-pro', { season: '2026-2027', athleteIds: ['a1', 'a4'], mode: 'add' });
    expect(current(state, 'a1').map((m) => [m.groupId, (m as { isMain: boolean }).isMain])).toEqual([['g-ib', true], ['g-pro', false]]);
    expect(state.athletes.find((a) => a.id === 'a4')?.status).toBe('activ');
    expect(state.history.filter((h) => h.subjectId === 'a4').map((h) => h.action)).toEqual(['group-added', 'reactivated']);
  });

  it('two joins of the same child one after the other never make two mains (Review Focus)', async () => {
    const { ctx, state } = seed();
    await joinGroup(ctx, 'g-pp', { season: '2026-2027', athleteIds: ['a3'], mode: 'add' });
    await joinGroup(ctx, 'g-pro', { season: '2026-2027', athleteIds: ['a3'], mode: 'add' });
    expect(current(state, 'a3').filter((m) => (m as { isMain: boolean }).isMain)).toHaveLength(1);
  });
});

describe('"Alocă toți în grupele propuse"', () => {
  it('allocates every item in one action', async () => {
    const { ctx, state } = seed();
    const res = await allocateAll(ctx, { season: '2026-2027', items: [{ athleteId: 'a3', groupId: 'g-pp' }, { athleteId: 'a2', groupId: 'g-av' }] });
    expect(res).toEqual({ ok: true, data: { value: { allocated: 2 }, actionId: 'h1' } });
    expect(state.history[0].changes.undo).toMatchObject({ steps: [{ op: 'deleteMembership', athleteId: 'a2' }, { op: 'deleteMembership', athleteId: 'a3' }] });
  });
});

describe('"Mută" (W2)', () => {
  it('ends the row yesterday, the new group becomes main, four lines', async () => {
    const { ctx, state } = seed();
    const res = await moveMembership(ctx, 'm1', { toGroupId: 'g-is' });
    expect(res).toEqual({ ok: true, data: { value: { athleteName: 'Ana Ionescu', groupName: 'Intermediari Silver' }, actionId: 'h1' } });
    expect(state.memberships.find((m) => m.id === 'm1')?.to).toBe('2026-11-19');
    expect(current(state, 'a1')).toMatchObject([{ groupId: 'g-is', isMain: true }]);
    expect(state.history.map((h) => [h.subjectId, h.action])).toEqual([
      ['g-ib', 'member-moved-out'], ['g-is', 'member-moved-in'], ['a1', 'athlete-group-moved'], ['a1', 'main-group-changed'],
    ]);
    expect(state.history[0].changes).toMatchObject({ athleteId: 'a1', toGroup: 'Intermediari Silver', main: { from: 'Intermediari Bronze', to: 'Intermediari Silver' } });
  });

  it('refuses without a target ("Alege grupa.") and for an ended row', async () => {
    const { ctx } = seed([member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib', to: '2026-10-31' })]);
    expect(await moveMembership(ctx, 'm1', {})).toEqual({ ok: false, status: 400, error: 'Alege grupa.' });
    expect((await moveMembership(ctx, 'm1', { toGroupId: 'g-is' })).ok).toBe(false);
  });
});

describe('"Mută" into the row\'s own group', () => {
  it('is refused with "Alege grupa." and writes nothing', async () => {
    const { ctx, state } = seed();
    expect(await moveMembership(ctx, 'm1', { toGroupId: 'g-ib' })).toEqual({ ok: false, status: 400, error: 'Alege grupa.' });
    expect(state.memberships.find((m) => m.id === 'm1')?.to).toBeNull();
    expect(state.history).toEqual([]);
  });
});

describe('"Scoate din grupă" (W4)', () => {
  it('promotes the remaining group and says so on the athlete', async () => {
    const { ctx, state } = seed([member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a1', groupId: 'g-pro', isMain: false, from: '2026-10-15' })]);
    await removeMembership(ctx, 'm1');
    expect(current(state, 'a1')).toMatchObject([{ id: 'm2', isMain: true }]);
    expect(state.history.map((h) => h.action)).toEqual(['member-removed', 'athlete-group-removed', 'main-group-changed']);
    expect(state.history[2].changes).toEqual({ from: 'Intermediari Bronze', to: 'Profesioniști', actionId: 'h1' });
  });

  it('deletes a row placed today, keeping the undo able to re-create it', async () => {
    const { ctx, state } = seed([member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib', from: '2026-11-20' })]);
    await removeMembership(ctx, 'm1');
    expect(state.memberships).toEqual([]);
    expect(state.history[0].changes.undo).toMatchObject({ steps: [{ op: 'createMembership', row: { groupId: 'g-ib', from: '2026-11-20', isMain: true } }] });
  });

  it('writes nothing when a write fails half way (all or nothing)', async () => {
    const { ctx, state, failOn } = seed([member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a1', groupId: 'g-pro', isMain: false })]);
    failOn('record');
    expect(await removeMembership(ctx, 'm1')).toEqual({ ok: false, status: 500, error: 'Acțiunea nu a reușit. Nimic nu a fost salvat.' });
    expect(current(state, 'a1').map((m) => m.athleteId)).toHaveLength(2);
  });
});
