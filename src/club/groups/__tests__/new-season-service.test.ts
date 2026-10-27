import { describe, expect, it } from 'vitest';
import { applyStart, previewStart, readStart } from '../new-season/service';
import { undoAction } from '../undo-service';
import { joinGroup } from '../members';
import { fakeContext } from './fake-group-store';
import { facts } from './new-season-facts';

const seed = (today = '2027-09-15') => {
  const f = facts();
  return fakeContext({ athletes: f.athletes, memberships: f.memberships, events: f.events }, today);
};
const BODY = { groups: [{ groupId: 'g-ib', copyMembers: false, copyProgram: true }, { groupId: 'g-pro', copyMembers: true, copyProgram: true }] };
const actionOf = (r: { ok: boolean; data?: { actionId: string | null } }) => (r.ok && r.data?.actionId) || '';

describe('reading and previewing (10.9)', () => {
  it('serves step 2 and the preview of the same plan', async () => {
    const { store } = seed();
    expect((await readStart(store, 's27', '2027-09-15')).ok).toBe(true);
    const preview = await previewStart(store, 's27', BODY, '2027-09-15');
    expect(preview.ok && preview.data.tiles[1]).toEqual({ label: 'Sportivi copiați', value: '2', hint: 'în 1 grupă Club' });
  });

  it('refuses a target that is not the next season (W28)', async () => {
    const { store } = seed();
    expect(await readStart(store, 's25', '2027-09-15')).toEqual({ ok: false, status: 409, error: 'Sezonul curent s-a schimbat. Reîncarcă pagina.' });
  });
});

describe('applying (10.4, 10.5, W24)', () => {
  it('makes the season current, writes the copies and the lines, in one action', async () => {
    const { ctx, state, revalidated } = seed();
    const res = await applyStart(ctx, 's27', BODY);
    expect(res).toMatchObject({ ok: true, data: { value: { season: '2027-2028', copied: { athletes: 2, groups: 1, series: 2 }, toast: '2027-2028 este sezonul curent. 2 sportivi și 2 programe copiate.' } } });
    expect(state.seasons.filter((s) => s.isCurrent).map((s) => s.id)).toEqual(['s27']);
    expect(state.memberships.filter((m) => m.seasonId === 's27').map((m) => [m.athleteId, m.groupId, m.isMain])).toEqual([['a1', 'g-pro', true], ['a2', 'g-pro', true]]);
    expect(state.events.filter((e) => e.recurrence.seasonStart === '2027-10-01')).toHaveLength(2);
    expect(state.history.map((h) => [h.subjectType, h.subjectId, h.action])).toEqual([
      ['season', 's27', 'current-changed'], ['season', 's27', 'season-copied'], ['season', 's26', 'current-changed'],
      ['group', 'g-pro', 'members-copied'], ['group', 'g-ib', 'program-copied'], ['group', 'g-pro', 'program-copied'],
      ['athlete', 'a1', 'athlete-copied'], ['athlete', 'a2', 'athlete-copied'],
    ]);
    expect(state.history[1].changes).toMatchObject({ from: '2026-2027', athletes: 2, groups: 1, series: 2 });
    expect(state.locks.slice(0, 2)).toEqual(['season:s26', 'season:s27']);
    expect(state.locks.slice(2, 6)).toEqual(['athlete:a1', 'athlete:a2', 'group:g-ib', 'group:g-pro']);
    expect(revalidated()).toBe(1);
  });

  it('reports what was applied when the data changed after the preview', async () => {
    const { ctx, state } = seed();
    await previewStart(ctx.store, 's27', BODY, '2027-09-15');
    state.athletes.find((a) => a.id === 'a2')!.status = 'inactiv';
    const res = await applyStart(ctx, 's27', BODY);
    expect(res).toMatchObject({ ok: true, data: { value: { copied: { athletes: 1 } } } });
    expect(state.memberships.filter((m) => m.seasonId === 's27').map((m) => m.athleteId)).toEqual(['a1']);
  });

  it('undo right away restores the old season and removes every row (W15)', async () => {
    const { ctx, state } = seed();
    const before = structuredClone({ seasons: state.seasons, memberships: state.memberships, events: state.events });
    const res = await applyStart(ctx, 's27', BODY);
    expect(await undoAction(ctx, { actionId: actionOf(res) })).toEqual({ ok: true, data: { undone: true } });
    expect({ seasons: state.seasons, memberships: state.memberships, events: state.events }).toEqual(before);
  });

  it('undo is refused after any later group or athlete change, even in a group it did not touch, or a filed registration (W28)', async () => {
    const one = seed();
    const res = await applyStart(one.ctx, 's27', BODY);
    await joinGroup(one.ctx, 'g-pp', { season: '2027-2028', athleteIds: ['a4'], mode: 'add' });
    expect(await undoAction(one.ctx, { actionId: actionOf(res) })).toEqual({ ok: false, status: 409, error: 'Nu se mai poate anula. Sezonul s-a schimbat între timp.' });
    const two = seed();
    const res2 = await applyStart(two.ctx, 's27', BODY);
    two.state.filedAfter = 1;
    expect((await undoAction(two.ctx, { actionId: actionOf(res2) })).ok).toBe(false);
  });

  it('a second apply is refused and writes nothing (Review Focus)', async () => {
    const { ctx, state } = seed();
    await applyStart(ctx, 's27', BODY);
    const count = state.memberships.length;
    expect(await applyStart(ctx, 's27', BODY)).toEqual({ ok: false, status: 409, error: 'Sezonul curent s-a schimbat. Reîncarcă pagina.' });
    expect(state.memberships).toHaveLength(count);
  });

  it('writes nothing when a write fails half way', async () => {
    const { ctx, state, failOn } = seed();
    failOn('createEvent');
    expect((await applyStart(ctx, 's27', BODY)).ok).toBe(false);
    expect(state.seasons.find((s) => s.isCurrent)?.id).toBe('s26');
    expect(state.memberships.some((m) => m.seasonId === 's27')).toBe(false);
  });
});
