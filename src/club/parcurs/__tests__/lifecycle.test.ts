import { describe, expect, it } from 'vitest';
import { dropParcurs, mergeParcurs } from '../lifecycle';
import { fakeParcursStore } from './fake-store';

const grant = (athleteId: string, source: string) => ({ athleteId, source, size: 3, createdOn: `${source.slice(2)}-01`, expiresOn: `${source.slice(2)}-28` });
const pin = (grantId: string, giverId: string, recipientId: string, givenOn = '2026-10-05', design = 1) => ({ grantId, giverId, recipientId, design, givenOn });
const award = (athleteId: string) => ({ athleteId, kind: 'steaua' as const, jump: null, level: null, givenBy: { adminId: '1' }, givenOn: '2026-10-01' });

describe('delete: dropParcurs', () => {
  it('removes awards, grants and pins given or received, leaving other athletes\' rows', async () => {
    const { store, state } = fakeParcursStore();
    const g1 = await store.addGrant(grant('a1', 'm:2026-10'));
    const g2 = await store.addGrant(grant('a2', 'm:2026-10'));
    await store.addAward(award('a1'));
    await store.addAward(award('a2'));
    await store.addPin(pin(g1, 'a1', 'a2'));
    await store.addPin(pin(g2, 'a2', 'a1'));
    await store.addPin(pin(g2, 'a2', 'a3'));
    await dropParcurs(store, 'a1');
    expect(state.awards.map((a) => a.athleteId)).toEqual(['a2']);
    expect(state.grants.map((g) => g.athleteId)).toEqual(['a2']);
    expect(state.pins.map((p) => p.recipientId)).toEqual(['a3']);
  });
});

describe('merge: mergeParcurs', () => {
  it('moves awards, grants of other months and pins to the kept athlete', async () => {
    const { store, state } = fakeParcursStore();
    const gr = await store.addGrant(grant('r', 'm:2026-09'));
    await store.addGrant(grant('k', 'm:2026-10'));
    await store.addAward(award('r'));
    await store.addPin(pin(gr, 'r', 'x'));
    await store.addPin(pin(await store.addGrant(grant('x', 'm:2026-10')), 'x', 'r'));
    await mergeParcurs(store, 'k', 'r');
    expect(state.awards.map((a) => a.athleteId)).toEqual(['k']);
    expect(state.grants.filter((g) => g.athleteId === 'k').map((g) => g.source).sort()).toEqual(['m:2026-09', 'm:2026-10']);
    expect(state.pins.map((p) => [p.giverId, p.recipientId]).sort()).toEqual([['k', 'x'], ['x', 'k']]);
  });

  it('grants of one month collapse into the kept grant: pins repointed, duplicate grant deleted', async () => {
    const { store, state } = fakeParcursStore();
    const gk = await store.addGrant(grant('k', 'm:2026-10'));
    const gr = await store.addGrant(grant('r', 'm:2026-10'));
    await store.addPin(pin(gr, 'r', 'x'));
    await mergeParcurs(store, 'k', 'r');
    expect(state.grants.map((g) => g.id)).toEqual([gk]);
    expect(state.pins.map((p) => [p.grantId, p.giverId, p.recipientId])).toEqual([[gk, 'k', 'x']]);
  });

  it('Review Focus 1: a pin between the two athletes is deleted, not kept as a pin to oneself', async () => {
    const { store, state } = fakeParcursStore();
    const gk = await store.addGrant(grant('k', 'm:2026-10'));
    const gr = await store.addGrant(grant('r', 'm:2026-09'));
    await store.addPin(pin(gk, 'k', 'r'));
    await store.addPin(pin(gr, 'r', 'k'));
    await store.addPin(pin(gk, 'k', 'x'));
    await mergeParcurs(store, 'k', 'r');
    expect(state.pins.map((p) => [p.giverId, p.recipientId])).toEqual([['k', 'x']]);
  });

  it('duplicate pins (same giver, recipient, grant) drop to the oldest', async () => {
    const { store, state } = fakeParcursStore();
    const gx = await store.addGrant(grant('x', 'm:2026-10'));
    await store.addPin(pin(gx, 'x', 'r', '2026-10-09', 2));
    await store.addPin(pin(gx, 'x', 'k', '2026-10-03', 1));
    await store.addPin(pin(gx, 'x', 'z', '2026-10-04', 1));
    await mergeParcurs(store, 'k', 'r');
    expect(state.pins.map((p) => [p.recipientId, p.givenOn, p.design]).sort()).toEqual([['k', '2026-10-03', 1], ['z', '2026-10-04', 1]]);
  });

  it('collapsed grants whose pins now collide keep one per giver, recipient and grant', async () => {
    const { store, state } = fakeParcursStore();
    const gk = await store.addGrant(grant('k', 'm:2026-10'));
    const gr = await store.addGrant(grant('r', 'm:2026-10'));
    await store.addPin(pin(gk, 'k', 'x', '2026-10-08'));
    await store.addPin(pin(gr, 'r', 'x', '2026-10-02'));
    await mergeParcurs(store, 'k', 'r');
    expect(state.pins.map((p) => [p.grantId, p.givenOn])).toEqual([[gk, '2026-10-02']]);
  });
});
