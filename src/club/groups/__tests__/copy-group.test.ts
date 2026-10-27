import { describe, expect, it } from 'vitest';
import { readGroupPage } from '../group-page';
import { copyMembers, copyProgram } from '../new-season/copy-group';
import { undoAction } from '../undo-service';
import { athleteRow, event, fakeContext, member } from './fake-group-store';

const seedState = () => ({
  seasons: [
    { id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', isCurrent: false, membershipFee: 270 },
    { id: 's27', label: '2027-2028', startMonth: '2027-10-01', endMonth: '2028-05-31', isCurrent: true, membershipFee: 200 },
  ],
  athletes: [athleteRow({ id: 'a1', name: 'Ana' }), athleteRow({ id: 'a2', name: 'Bia' }), athleteRow({ id: 'a3', name: 'Cai', status: 'inactiv' })],
  memberships: [
    member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a2', groupId: 'g-ib' }), member({ id: 'm3', athleteId: 'a3', groupId: 'g-ib' }),
    member({ id: 'm4', athleteId: 'a2', groupId: 'g-pro', seasonId: 's27', from: '2027-10-01' }),
  ],
  events: [event({ id: 'e1' })],
});
const seed = () => fakeContext(seedState(), '2027-10-10');

describe('copyFrom on the group page (10.6, 10.9)', () => {
  it('offers members and program while both tabs are empty', async () => {
    const page = await readGroupPage(seed().store, 'g-ib', '2027-2028', '2027-10-10');
    expect(page?.copyFrom).toEqual({ season: '2026-2027', members: 2, inactive: 1, program: ['Sâ și Du, 11:00, 50 min'], programFrom: '10 oct 2027' });
  });

  it('is null on a past season and when the previous season has nothing', async () => {
    expect((await readGroupPage(seed().store, 'g-ib', '2026-2027', '2027-10-10'))?.copyFrom).toBeNull();
    expect((await readGroupPage(seed().store, 'g-pp', '2027-2028', '2027-10-10'))?.copyFrom).toBeNull();
  });
});

describe('"Copiază sportivii din <sezon>" (W31)', () => {
  it('copies every active member, main only for an athlete with no group in the season; undo takes it back', async () => {
    const { ctx, state } = seed();
    const res = await copyMembers(ctx, 'g-ib', { season: '2027-2028' });
    expect(res).toMatchObject({ ok: true, data: { value: { copied: 2, from: '2026-2027' } } });
    expect(state.memberships.filter((m) => m.seasonId === 's27' && m.groupId === 'g-ib').map((m) => [m.athleteId, m.isMain, m.from])).toEqual([['a1', true, '2027-10-10'], ['a2', false, '2027-10-10']]);
    expect(state.history.map((h) => h.action)).toEqual(['members-copied', 'athlete-copied', 'athlete-copied']);
    await undoAction(ctx, { actionId: res.ok ? res.data.actionId ?? '' : '' });
    expect(state.memberships.filter((m) => m.seasonId === 's27' && m.groupId === 'g-ib')).toEqual([]);
  });

  it('counts the rows actually written in the history line, as the toast does', async () => {
    const { ctx } = seed();
    const read = ctx.store.memberships;
    // Bia already sits in the group when her own rows are read under the locks: no row is written for her.
    ctx.store.memberships = async (where) => (where?.athleteId === 'a2'
      ? [...(await read(where)), member({ id: 'mx', athleteId: 'a2', groupId: 'g-ib', seasonId: 's27', from: '2027-10-01' })]
      : read(where));
    const res = await copyMembers(ctx, 'g-ib', { season: '2027-2028' });
    expect(res).toMatchObject({ ok: true, data: { value: { copied: 1 } } });
    const line = (await ctx.store.historyAfter(0, null)).find((h) => h.action === 'members-copied');
    expect(line?.changes.count).toBe(1);
  });

  it('refuses once the tab is not empty', async () => {
    const { ctx } = seed();
    await copyMembers(ctx, 'g-ib', { season: '2027-2028' });
    expect(await copyMembers(ctx, 'g-ib', { season: '2027-2028' })).toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
  });

  it('locks the season before the athletes (sorted) and the group, and refuses a past season', async () => {
    const { ctx, state } = seed();
    await copyMembers(ctx, 'g-ib', { season: '2027-2028' });
    expect(state.locks.slice(0, 4)).toEqual(['season:s27', 'athlete:a1', 'athlete:a2', 'group:g-ib']);
    expect(await copyMembers(seed().ctx, 'g-ib', { season: '2026-2027' })).toMatchObject({ ok: false, status: 409 });
  });
});

describe('"Copiază programul din <sezon>"', () => {
  it('copies the series running on the old season\'s last day from the later of the season start and today', async () => {
    const { ctx, state, revalidated } = seed();
    const res = await copyProgram(ctx, 'g-ib', { season: '2027-2028' });
    expect(res).toMatchObject({ ok: true, data: { value: { series: 1, from: '2026-2027' } } });
    expect(state.events[1].recurrence).toMatchObject({ seasonStart: '2027-10-10', seasonEnd: '2028-05-31', startTime: '11:00' });
    expect(state.history[0]).toMatchObject({ action: 'program-copied', changes: { from: '2026-2027' } });
    expect(revalidated()).toBe(1);
    expect((await copyProgram(ctx, 'g-ib', { season: '2027-2028' })).ok).toBe(false);
  });
});

describe('a season that has ended', () => {
  it('offers no program and writes nothing', async () => {
    const { ctx, state, store } = fakeContext({ ...seedState() }, '2028-06-15');
    const page = await readGroupPage(store, 'g-ib', '2027-2028', '2028-06-15');
    expect(page?.copyFrom?.program ?? []).toEqual([]);
    expect(await copyProgram(ctx, 'g-ib', { season: '2027-2028' })).toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
    expect(state.events).toHaveLength(1);
    expect(state.history).toEqual([]);
  });
});
