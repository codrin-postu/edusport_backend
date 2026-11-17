import { describe, expect, it } from 'vitest';
import { fakeParcursStore } from './fake-store';

const award = (athleteId: string) => ({ athleteId, kind: 'jump' as const, jump: 'lz' as const, level: 2 as const, givenBy: { teamMemberId: 'tm1' }, givenOn: '2026-11-01' });
const grant = (athleteId: string) => ({ athleteId, source: 'm:2026-11', size: 2, createdOn: '2026-11-01', expiresOn: '2027-01-31' });
const pin = (grantId: string, giverId: string, recipientId: string) => ({ grantId, giverId, recipientId, design: 3, givenOn: '2026-11-02' });

describe('fake ParcursStore', () => {
  it('adds, filters and deletes awards', async () => {
    const { store } = fakeParcursStore();
    const a = await store.addAward(award('a1'));
    await store.addAward({ ...award('a2'), givenBy: { adminId: '7' } });
    expect(await store.awards({})).toHaveLength(2);
    expect(await store.awards({ athleteId: 'a1' })).toEqual([{ ...award('a1'), id: a }]);
    await store.deleteAward(a);
    expect((await store.awards({})).map((r) => r.athleteId)).toEqual(['a2']);
  });

  it('adds and filters grants by athlete', async () => {
    const { store } = fakeParcursStore();
    await store.addGrant(grant('a1'));
    await store.addGrant(grant('a2'));
    expect((await store.grants({ athleteId: 'a1' })).map((g) => g.athleteId)).toEqual(['a1']);
  });

  it('filters pins by giver, recipient and grant, and deletes one', async () => {
    const { store } = fakeParcursStore();
    const g1 = await store.addGrant(grant('a1'));
    const g2 = await store.addGrant(grant('a2'));
    const p1 = await store.addPin(pin(g1, 'a1', 'a2'));
    await store.addPin(pin(g2, 'a2', 'a3'));
    expect((await store.pins({ giverId: 'a1' })).map((p) => p.id)).toEqual([p1]);
    expect(await store.pins({ recipientId: 'a3' })).toHaveLength(1);
    expect(await store.pins({ grantId: g2 })).toHaveLength(1);
    await store.deletePin(p1);
    expect(await store.pins({})).toHaveLength(1);
  });

  it('dropForAthlete removes awards, grants and pins given or received', async () => {
    const { store } = fakeParcursStore();
    const g1 = await store.addGrant(grant('a1'));
    const g2 = await store.addGrant(grant('a2'));
    await store.addAward(award('a1'));
    await store.addAward(award('a2'));
    await store.addPin(pin(g1, 'a1', 'a2'));
    await store.addPin(pin(g2, 'a2', 'a1'));
    await store.addPin(pin(g2, 'a2', 'a3'));
    await store.dropForAthlete('a1');
    expect((await store.awards({})).map((r) => r.athleteId)).toEqual(['a2']);
    expect((await store.grants({ athleteId: 'a1' }))).toEqual([]);
    expect((await store.pins({})).map((p) => p.recipientId)).toEqual(['a3']);
  });

  it('moveForMerge repoints everything from the removed athlete', async () => {
    const { store } = fakeParcursStore();
    const g = await store.addGrant(grant('b'));
    await store.addAward(award('b'));
    await store.addPin(pin(g, 'b', 'c'));
    await store.addPin(pin(await store.addGrant(grant('c')), 'c', 'b'));
    await store.moveForMerge('a', 'b');
    expect((await store.awards({ athleteId: 'a' }))).toHaveLength(1);
    expect((await store.grants({ athleteId: 'a' }))).toHaveLength(1);
    expect((await store.pins({ giverId: 'a' }))).toHaveLength(1);
    expect((await store.pins({ recipientId: 'a' }))).toHaveLength(1);
    expect(await store.pins({ giverId: 'b' })).toEqual([]);
  });
});
