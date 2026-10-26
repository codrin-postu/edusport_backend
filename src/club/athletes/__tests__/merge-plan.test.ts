import { describe, expect, it } from 'vitest';
import type { AthleteValues } from '../../athlete-data';
import { mergeDiffering, planMerge, type MergeSide } from '../merge-plan';

const values = (over: Partial<AthleteValues> = {}): AthleteValues => ({
  name: 'Maria Pop', birthDate: '2016-03-14', contactName: 'Ana Pop', phone: '0722111222', email: null, ...over,
});
const side = (over: Partial<MergeSide> = {}): MergeSide => ({
  id: 'k', name: 'Maria Pop', values: values(), status: 'activ', profile: null, memberships: [], acs: [], ...over,
});

describe('fields (d39)', () => {
  it('keeps the kept values and takes the picked ones from the other record', () => {
    const plan = planMerge(side(), side({ id: 'r', values: values({ phone: '0733', email: 'ana@example.com' }) }), ['email']);
    expect(plan.values).toEqual(values({ email: 'ana@example.com' }));
    expect(plan.fieldChanges).toEqual({ email: { from: null, to: 'ana@example.com' } });
    expect(plan.dataIncomplete).toBe(false);
  });

  it('lists the differing fields for the merge screen', () => {
    expect(mergeDiffering(values(), values({ phone: '0733', email: 'x' }))).toEqual(['phone', 'email']);
  });
});

describe('groups (d39)', () => {
  it('keeps a group once, keeps the kept main group, keeps the other main group where the kept record has none', () => {
    const kept = side({ memberships: [{ id: 'k1', groupId: 'g1', seasonId: 's26', isMain: true }] });
    const removed = side({
      id: 'r',
      memberships: [
        { id: 'r1', groupId: 'g1', seasonId: 's26', isMain: true },
        { id: 'r2', groupId: 'g2', seasonId: 's26', isMain: false },
        { id: 'r3', groupId: 'g3', seasonId: 's25', isMain: true },
      ],
    });
    expect(planMerge(kept, removed, []).memberships).toEqual({
      move: [{ id: 'r2', isMain: false }, { id: 'r3', isMain: true }],
      remove: ['r1'],
    });
  });
});

describe('A.C.S. (d39)', () => {
  it('same season: the higher state stays (Da > În așteptare > Nu); other seasons move', () => {
    const kept = side({ acs: [{ id: 'k1', seasonId: 's26', state: 'in_asteptare' }, { id: 'k2', seasonId: 's24', state: 'da' }] });
    const removed = side({ id: 'r', acs: [{ id: 'r1', seasonId: 's26', state: 'da' }, { id: 'r2', seasonId: 's24', state: 'nu' }, { id: 'r3', seasonId: 's25', state: 'nu' }] });
    expect(planMerge(kept, removed, []).acs).toEqual({ move: ['r3'], raise: [{ id: 'k1', state: 'da' }], remove: ['r1', 'r2'] });
  });
});

describe('public profiles (d39, 3b s8)', () => {
  const kp = { id: 'sp-k', slug: 'maria-pop', previousSlugs: ['maria-p'] };
  const rp = { id: 'sp-r', slug: 'maria-pop-2', previousSlugs: ['m-pop', 'maria-p'] };

  it('two profiles: the kept one stays and remembers the other addresses', () => {
    expect(planMerge(side({ profile: kp }), side({ id: 'r', profile: rp }), []).profile).toEqual({
      moveId: null, deleteId: 'sp-r', previousSlugs: ['maria-p', 'maria-pop-2', 'm-pop'], finalId: 'sp-k',
    });
  });

  it('one profile: that one is kept', () => {
    expect(planMerge(side(), side({ id: 'r', profile: rp }), []).profile).toEqual({ moveId: 'sp-r', deleteId: null, previousSlugs: null, finalId: 'sp-r' });
    expect(planMerge(side({ profile: kp }), side({ id: 'r' }), []).profile).toEqual({ moveId: null, deleteId: null, previousSlugs: null, finalId: 'sp-k' });
    expect(planMerge(side(), side({ id: 'r' }), []).profile.finalId).toBeNull();
  });
});
