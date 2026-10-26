import { describe, expect, it, vi } from 'vitest';
import { ADMIN_ERRORS } from '../errors';
import { athleteIdForProfile, createAthleteProfile, setAthleteProfileVisibility } from '../profile';
import { athleteRow, fakeClubStore, type Fake } from './fake-store';

const ctx = (fake: Fake) => ({ store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn() });

describe('Profil public (spec 6.3)', () => {
  it('"Creează profil public": page off, an unused address, history', async () => {
    const fake = fakeClubStore({
      athletes: [athleteRow({ id: 'a1', name: 'Maria Pop' })],
      profiles: [{ id: 'sp9', name: 'Ion', slug: 'ion', previousSlugs: ['maria-pop'], showPublicPage: true, published: true }],
    });
    const result = await createAthleteProfile(ctx(fake), 'a1');
    expect(result.ok && result.data.profile).toEqual({ documentId: expect.any(String), slug: 'maria-pop-2', showPublicPage: false });
    expect(fake.state.history.map((h) => h.action)).toEqual(['profile-created']);
    expect(await createAthleteProfile(ctx(fake), 'a1')).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
  });

  it('page on / off: only showPublicPage, logged once per change', async () => {
    const fake = fakeClubStore({
      athletes: [athleteRow({ id: 'a1', name: 'Maria', profileId: 'sp1' })],
      profiles: [{ id: 'sp1', name: 'Maria', slug: 'maria', previousSlugs: [], showPublicPage: false, published: true }],
    });
    await setAthleteProfileVisibility(ctx(fake), 'a1', { on: true });
    await setAthleteProfileVisibility(ctx(fake), 'a1', { on: true });
    expect(fake.state.profiles[0].showPublicPage).toBe(true);
    expect(fake.state.history.map((h) => [h.action, h.changes])).toEqual([['profile-page', { on: true }]]);
    expect(await setAthleteProfileVisibility(ctx(fake), 'a1', { on: 'yes' })).toEqual({ ok: false, status: 400, error: ADMIN_ERRORS.invalid });
  });

  it('finds the athlete of a profile (old editor route redirect)', async () => {
    const fake = fakeClubStore({ athletes: [athleteRow({ id: 'a1', profileId: 'sp1' })] });
    expect([await athleteIdForProfile(fake.store, 'sp1'), await athleteIdForProfile(fake.store, 'x')]).toEqual(['a1', null]);
  });
});
