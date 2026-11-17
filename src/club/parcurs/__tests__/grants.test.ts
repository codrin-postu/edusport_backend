import { describe, expect, it } from 'vitest';
import { athleteRow, fakeClubStore } from '../../athletes/__tests__/fake-store';
import type { SeasonRow } from '../../athletes/store';
import { deletePin, ensureGrants, givePin, pinsLeft, recipients } from '../grants';
import { fakeParcursStore } from './fake-store';

const SEASON: SeasonRow = { id: 's1', label: '2026/2027', startMonth: '2026-09-01', endMonth: '2027-06-30', isCurrent: true };
const active = { id: 'a1', status: 'activ', anonymizedAt: null };
const ids = new Set(['a1', 'b2', 'c3']);
const give = (s: ReturnType<typeof fakeParcursStore>['store'], to: string, today = '2026-11-10', design = 3) =>
  givePin(s, { giverId: 'a1', recipientId: to, design, today, activeIds: ids });

describe('ensureGrants', () => {
  it('creates one grant per month, idempotently', async () => {
    const { store, state } = fakeParcursStore();
    await ensureGrants(store, { athlete: active, seasons: [SEASON], today: '2026-11-10' });
    await ensureGrants(store, { athlete: active, seasons: [SEASON], today: '2026-11-25' });
    expect(state.grants).toHaveLength(1);
    expect(state.grants[0]).toMatchObject({ source: 'm:2026-11', size: 2, createdOn: '2026-11-01', expiresOn: '2026-11-30' });
  });
  it('adds a new grant in the next season month', async () => {
    const { store, state } = fakeParcursStore();
    await ensureGrants(store, { athlete: active, seasons: [SEASON], today: '2026-11-10' });
    await ensureGrants(store, { athlete: active, seasons: [SEASON], today: '2026-12-02' });
    expect(state.grants.map((g) => g.source)).toEqual(['m:2026-11', 'm:2026-12']);
  });
  it('makes no grant in the summer gap', async () => {
    const { store, state } = fakeParcursStore();
    await ensureGrants(store, { athlete: active, seasons: [SEASON], today: '2026-08-15' });
    expect(state.grants).toHaveLength(0);
  });
  it('makes no grant for inactive or anonymised athletes', async () => {
    const { store, state } = fakeParcursStore();
    await ensureGrants(store, { athlete: { ...active, status: 'inactiv' }, seasons: [SEASON], today: '2026-11-10' });
    await ensureGrants(store, { athlete: { ...active, anonymizedAt: '2026-11-01' }, seasons: [SEASON], today: '2026-11-10' });
    expect(state.grants).toHaveLength(0);
  });
});

describe('pinsLeft', () => {
  it('does not count a grant of a past month', async () => {
    const { store, state } = fakeParcursStore();
    await ensureGrants(store, { athlete: active, seasons: [SEASON], today: '2026-11-10' });
    expect(pinsLeft(state.grants, state.pins, '2026-11-30')).toBe(2);
    expect(pinsLeft(state.grants, state.pins, '2026-12-01')).toBe(0);
  });
});

describe('givePin', () => {
  const setup = async () => {
    const f = fakeParcursStore();
    await ensureGrants(f.store, { athlete: active, seasons: [SEASON], today: '2026-11-10' });
    return f;
  };
  it('rejects self, unknown recipient and bad designs', async () => {
    const { store } = await setup();
    expect(await give(store, 'a1')).toEqual({ ok: false, code: 'SELF' });
    expect(await give(store, 'zz')).toEqual({ ok: false, code: 'BAD_RECIPIENT' });
    expect(await give(store, 'b2', '2026-11-10', 0)).toEqual({ ok: false, code: 'BAD_DESIGN' });
    expect(await give(store, 'b2', '2026-11-10', 16)).toEqual({ ok: false, code: 'BAD_DESIGN' });
    expect(await give(store, 'b2', '2026-11-10', 1.5)).toEqual({ ok: false, code: 'BAD_DESIGN' });
  });
  it('gives the same recipient only one pin per grant', async () => {
    const { store } = await setup();
    expect((await give(store, 'b2')).ok).toBe(true);
    expect(await give(store, 'b2')).toEqual({ ok: false, code: 'NO_PINS_LEFT' });
  });
  it('sends a second pin to the same recipient to the next grant', async () => {
    const { store, state } = fakeParcursStore();
    state.grants.push(
      { id: 'g1', athleteId: 'a1', source: 'm:2026-11', size: 2, createdOn: '2026-11-01', expiresOn: '2026-12-31' },
      { id: 'g2', athleteId: 'a1', source: 'm:2026-12', size: 2, createdOn: '2026-12-01', expiresOn: '2026-12-31' },
    );
    await give(store, 'b2', '2026-12-05');
    await give(store, 'b2', '2026-12-05');
    expect(state.pins.map((p) => p.grantId)).toEqual(['g1', 'g2']);
    expect(await give(store, 'b2', '2026-12-05')).toEqual({ ok: false, code: 'NO_PINS_LEFT' });
  });
  it('uses the oldest grant first', async () => {
    const { store, state } = fakeParcursStore();
    state.grants.push(
      { id: 'g-new', athleteId: 'a1', source: 'm:2026-12', size: 2, createdOn: '2026-12-01', expiresOn: '2026-12-31' },
      { id: 'g-old', athleteId: 'a1', source: 'm:2026-11', size: 2, createdOn: '2026-11-01', expiresOn: '2026-12-31' },
    );
    await give(store, 'b2', '2026-12-05');
    expect(state.pins[0].grantId).toBe('g-old');
  });
  it('allows the last pin only once', async () => {
    const { store, state } = await setup();
    state.grants[0].size = 1;
    expect((await give(store, 'b2')).ok).toBe(true);
    expect(await give(store, 'c3')).toEqual({ ok: false, code: 'NO_PINS_LEFT' });
  });
  it('lets the same recipient receive again after deletePin', async () => {
    const { store } = await setup();
    const first = await give(store, 'b2');
    if (!first.ok) throw new Error('give failed');
    expect(await deletePin(store, first.id)).toEqual({ ok: true });
    expect((await give(store, 'b2')).ok).toBe(true);
    expect(await deletePin(store, 'missing')).toEqual({ ok: false, code: 'NOT_FOUND' });
  });
});

describe('recipients', () => {
  it('lists other active athletes by short name', async () => {
    const club = fakeClubStore({
      athletes: [
        athleteRow({ id: 'a1', name: 'Ana Popescu' }),
        athleteRow({ id: 'b2', name: 'Maria Ionescu Zamfir' }),
        athleteRow({ id: 'c3', name: 'Bogdan Radu' }),
        athleteRow({ id: 'd4', name: 'Dan Pop', status: 'inactiv' }),
        athleteRow({ id: 'e5', name: 'Eva Pop', anonymizedAt: '2026-01-01' }),
      ],
    });
    expect(await recipients(club.store, 'a1')).toEqual([{ id: 'c3', name: 'Bogdan R.' }, { id: 'b2', name: 'Maria Z.' }]);
  });
});
