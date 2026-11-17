import { describe, expect, it } from 'vitest';
import { awardPins, giveAward, removeAward } from '../awards';
import type { JumpCode, JumpLevel } from '../api-types';
import type { ParcursStore } from '../store';
import { fakeParcursStore } from './fake-store';

const BY = { teamMemberId: 'tm1' };
const give = (s: ParcursStore, kind: 'steaua' | 'test' | 'jump', today: string, jump?: JumpCode, level?: JumpLevel) =>
  giveAward(s, { athleteId: 'a1', kind, jump, level, by: BY, today });
const pins = async (s: ParcursStore) => awardPins(await s.awards({ athleteId: 'a1' }));
const jumpPin = (p: ReturnType<typeof awardPins>, id: string) => p.sarituri.flat().find((v) => v.pin === id);

describe('giveAward', () => {
  it('rejects a jump without code or level, or with a level outside 1..3', async () => {
    const { store } = fakeParcursStore();
    expect(await give(store, 'jump', '2027-01-01')).toEqual({ ok: false, code: 'BAD_JUMP' });
    expect(await give(store, 'jump', '2027-01-01', 's')).toEqual({ ok: false, code: 'BAD_JUMP' });
    expect(await give(store, 'jump', '2027-01-01', undefined, 1)).toEqual({ ok: false, code: 'BAD_JUMP' });
    expect(await give(store, 'jump', '2027-01-01', 's', 4 as JumpLevel)).toEqual({ ok: false, code: 'BAD_JUMP' });
    expect(await store.awards({})).toEqual([]);
  });

  it('stores the award and returns its id', async () => {
    const { store } = fakeParcursStore();
    const r = await give(store, 'steaua', '2027-01-01');
    expect(r.ok).toBe(true);
    expect(await store.awards({ athleteId: 'a1' })).toMatchObject([{ kind: 'steaua', jump: null, level: null, givenOn: '2027-01-01', givenBy: BY }]);
  });
});

describe('awardPins', () => {
  it('counts steaua awards and shows the latest date; unearned test is 0', async () => {
    const { store } = fakeParcursStore();
    await give(store, 'steaua', '2027-01-01');
    await give(store, 'steaua', '2027-03-01');
    await give(store, 'steaua', '2027-02-01');
    const p = await pins(store);
    expect(p.insigne.map((v) => v.pin)).toEqual(['steaua', 'test']);
    expect(p.insigne[0]).toMatchObject({ earnedOn: '2027-03-01', count: 3 });
    expect(p.insigne[1]).toMatchObject({ earnedOn: null, count: 0 });
  });

  it('lays out 3 levels of 6 jumps in order', async () => {
    const p = await pins(fakeParcursStore().store);
    expect(p.sarituri.map((row) => row.map((v) => v.pin))).toEqual([1, 2, 3].map((l) => ['s', 't', 'lo', 'f', 'lz', 'a'].map((c) => `saritura-${l}${c}`)));
    expect(p.sarituri.flat().every((v) => v.earnedOn === null && v.count === 0)).toBe(true);
  });

  it('explicit 2S earns 1S and 2S on the same date, count 1', async () => {
    const { store } = fakeParcursStore();
    await give(store, 'jump', '2027-02-01', 's', 2);
    const p = await pins(store);
    expect(jumpPin(p, 'saritura-1s')).toMatchObject({ earnedOn: '2027-02-01', count: 1 });
    expect(jumpPin(p, 'saritura-2s')).toMatchObject({ earnedOn: '2027-02-01', count: 1 });
    expect(jumpPin(p, 'saritura-3s')).toMatchObject({ earnedOn: null, count: 0 });
    expect(jumpPin(p, 'saritura-2t')?.earnedOn).toBeNull();
  });

  it('3A implies 2A and 1A', async () => {
    const { store } = fakeParcursStore();
    await give(store, 'jump', '2027-02-01', 'a', 3);
    const p = await pins(store);
    for (const id of ['saritura-1a', 'saritura-2a', 'saritura-3a']) expect(jumpPin(p, id)?.earnedOn).toBe('2027-02-01');
  });

  it('removing explicit 2S keeps an explicit 1S', async () => {
    const { store } = fakeParcursStore();
    const e = await give(store, 'jump', '2027-01-05', 's', 1);
    const d = await give(store, 'jump', '2027-02-01', 's', 2);
    expect(e.ok && d.ok).toBe(true);
    if (!d.ok) return;
    expect(await removeAward(store, d.id)).toEqual({ ok: true });
    const p = await pins(store);
    expect(jumpPin(p, 'saritura-1s')?.earnedOn).toBe('2027-01-05');
    expect(jumpPin(p, 'saritura-2s')?.earnedOn).toBeNull();
  });

  it('removing explicit 2S drops an only-implied 1S', async () => {
    const { store } = fakeParcursStore();
    const d = await give(store, 'jump', '2027-02-01', 's', 2);
    if (!d.ok) throw new Error('give failed');
    await removeAward(store, d.id);
    const p = await pins(store);
    expect(jumpPin(p, 'saritura-1s')).toMatchObject({ earnedOn: null, count: 0 });
  });

  it('own record date wins over a later implied date', async () => {
    const { store } = fakeParcursStore();
    await give(store, 'jump', '2027-01-05', 's', 1);
    await give(store, 'jump', '2027-02-01', 's', 2);
    expect(jumpPin(await pins(store), 'saritura-1s')?.earnedOn).toBe('2027-01-05');
  });
});

describe('removeAward', () => {
  it('reports NOT_FOUND for an unknown id', async () => {
    const { store } = fakeParcursStore();
    expect(await removeAward(store, 'nope')).toEqual({ ok: false, code: 'NOT_FOUND' });
  });
});
