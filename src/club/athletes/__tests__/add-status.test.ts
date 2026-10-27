import { describe, expect, it, vi } from 'vitest';
import { addAthlete, setAthleteStatus } from '../add-status';
import { ADMIN_ERRORS } from '../errors';
import { athleteRow, fakeClubStore, registrationRow, type Fake } from './fake-store';

const ctx = (fake: Fake) => ({ store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn() });

describe('Adaugă sportiv (spec 6.7)', () => {
  it('creates an active athlete, "Date incomplete" without the optional fields, matched by waiting registrations', async () => {
    const fake = fakeClubStore({ registrations: [registrationRow({ id: 'r1' })] });
    const result = await addAthlete(ctx(fake), { name: 'Maria Pop', birthDate: '14.03.2016' });
    const created = fake.state.athletes[0];
    expect(result).toEqual({ ok: true, data: { documentId: created.id } });
    expect(created).toMatchObject({ name: 'Maria Pop', birthDate: '2016-03-14', status: 'activ', dataIncomplete: true });
    expect(fake.state.history.map((h) => [h.action, h.changes])).toEqual([
      ['created', { fields: { name: { from: null, to: 'Maria Pop' }, birthDate: { from: null, to: '2016-03-14' } } }],
    ]);
    expect(fake.state.registrations[0]).toMatchObject({ matchAthleteId: created.id, matchLevel: 'sigur' });
  });

  it('needs the name and the birth date', async () => {
    expect(await addAthlete(ctx(fakeClubStore()), { name: 'Maria' })).toEqual({ ok: false, status: 400, error: ADMIN_ERRORS.birthDate });
  });
});

describe('Marchează inactiv / activ (spec 6.6)', () => {
  it('changes the status once and logs "Status: Activ → Inactiv"', async () => {
    const fake = fakeClubStore({ athletes: [athleteRow({ id: 'a1' })] });
    expect(await setAthleteStatus(ctx(fake), 'a1', { status: 'inactiv' })).toEqual({ ok: true, data: { status: 'inactiv' } });
    await setAthleteStatus(ctx(fake), 'a1', { status: 'inactiv' });
    expect(fake.state.history.map((h) => [h.action, h.changes])).toEqual([['status-changed', { from: 'activ', to: 'inactiv' }]]);
  });

  it('accepts only activ and inactiv', async () => {
    const fake = fakeClubStore({ athletes: [athleteRow({ id: 'a1' })] });
    expect(await setAthleteStatus(ctx(fake), 'a1', { status: 'nou' })).toEqual({ ok: false, status: 400, error: ADMIN_ERRORS.invalid });
    expect(await setAthleteStatus(ctx(fake), 'x', { status: 'activ' })).toEqual({ ok: false, status: 404, error: ADMIN_ERRORS.notFound });
  });

  it('locks before re-reading, refusing a status change anonymized in the gap (fix round 1, important #2)', async () => {
    const fake = fakeClubStore({ athletes: [athleteRow({ id: 'a1', status: 'activ' })] });
    const order: string[] = [];
    const baseLock = fake.store.lockAthlete;
    const baseAthlete = fake.store.athlete;
    fake.store.lockAthlete = async (id) => {
      order.push('lock');
      await baseLock(id);
      fake.state.athletes[0].status = 'anonimizat';
    };
    fake.store.athlete = async (id) => {
      order.push('read');
      return baseAthlete(id);
    };
    expect(await setAthleteStatus(ctx(fake), 'a1', { status: 'inactiv' })).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
    expect(order).toEqual(['lock', 'read']);
    expect(fake.state.history).toEqual([]);
  });
});
