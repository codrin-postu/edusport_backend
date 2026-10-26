import { describe, expect, it, vi } from 'vitest';
import { guarded, guardedWrite } from '../../admin-result';
import { addAthlete, setAthleteStatus } from '../add-status';
import { ADMIN_ERRORS } from '../errors';
import { createAthleteProfile, setAthleteProfileVisibility } from '../profile';
import { updateAthlete } from '../record';
import type { AdminResult } from '../../admin-result';
import type { ClubStore } from '../store';
import { athleteRow, fakeClubStore } from './fake-store';

const FAILED = { ok: false, status: 500, error: ADMIN_ERRORS.failed };

function failing(method: keyof ClubStore) {
  const fake = fakeClubStore({
    athletes: [athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14' }), athleteRow({ id: 'a2', name: 'Ion Pop', profileId: 'sp1' })],
    profiles: [{ id: 'sp1', name: 'Ion Pop', slug: 'ion-pop', previousSlugs: [], showPublicPage: false, published: true }],
  });
  fake.failOn(method);
  const log = vi.fn();
  return { fake, log, ctx: { store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log } };
}

describe('a thrown write answers the shared "nothing saved" copy (final review I2)', () => {
  it('guarded: passes an answer through, turns a throw into 500 and logs it once', async () => {
    const log = vi.fn();
    const ok: AdminResult<number> = { ok: true, data: 1 };
    expect(await guarded(log, '[t] x', async () => ok)).toBe(ok);
    expect(await guardedWrite(log, '[t] x', async () => 2)).toEqual({ ok: true, data: 2 });
    expect(await guardedWrite(log, '[t] x', async () => Promise.reject(new Error('db down')))).toEqual(FAILED);
    expect(log.mock.calls).toEqual([['[t] x failed: db down']]);
  });

  it('Editează on the record', async () => {
    const t = failing('updateAthlete');
    const body = { name: 'Maria Ioana Pop', birthDate: '14.03.2016', contactName: null, phone: null, email: null };
    expect(await updateAthlete(t.ctx, 'a1', body)).toEqual(FAILED);
    expect(t.log).toHaveBeenCalledTimes(1);
    expect(t.fake.state.athletes[0].name).toBe('Maria Pop');
  });

  it('Creează profil public', async () => {
    const t = failing('createProfile');
    expect(await createAthleteProfile(t.ctx, 'a1')).toEqual(FAILED);
    expect(t.log).toHaveBeenCalledTimes(1);
  });

  it('Pagina publică on / off', async () => {
    const t = failing('setProfileVisibility');
    expect(await setAthleteProfileVisibility(t.ctx, 'a2', { on: true })).toEqual(FAILED);
    expect(t.log).toHaveBeenCalledTimes(1);
    expect(t.fake.state.history).toEqual([]);
  });

  it('Adaugă sportiv', async () => {
    const t = failing('createAthlete');
    expect(await addAthlete(t.ctx, { name: 'Ana Pop', birthDate: '14.03.2016' })).toEqual(FAILED);
    expect(t.log).toHaveBeenCalledTimes(1);
  });

  it('Marchează inactiv', async () => {
    const t = failing('updateAthlete');
    expect(await setAthleteStatus(t.ctx, 'a1', { status: 'inactiv' })).toEqual(FAILED);
    expect(t.log).toHaveBeenCalledTimes(1);
    expect(t.fake.state.athletes[0].status).toBe('activ');
  });
});
