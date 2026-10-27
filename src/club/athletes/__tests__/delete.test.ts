import { describe, expect, it, vi } from 'vitest';
import { deleteAthlete } from '../delete';
import { ADMIN_ERRORS } from '../errors';
import { athleteRow, fakeClubStore, registrationRow, type Fake } from './fake-store';
import type { ConfirmationRecord } from '../../confirm/plan';

const ctx = (fake: Fake) => ({ store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn() });
const record = { athleteId: 'a1' } as ConfirmationRecord;
const seed = () => ({
  athletes: [athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', profileId: 'sp1' }), athleteRow({ id: 'a2', name: 'Ion Ilie' })],
  registrations: [registrationRow({ id: 'r1', athleteId: 'a1', status: 'Confirmat', confirmation: record })],
  memberships: [{ id: 'm1', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null }],
  acs: [{ id: 'c1', athleteId: 'a1', seasonId: 's26', state: 'da' as const }],
  duplicates: [{ id: 'd1', firstId: 'a1', secondId: 'a2' }],
  profiles: [{ id: 'sp1', name: 'Maria Pop', slug: 'maria-pop', previousSlugs: [], showPublicPage: true, published: true }],
});

describe('Șterge sportivul (spec 6.6, 3b s9)', () => {
  it('unlinks registrations, removes groups, A.C.S., flags and the profile with its results; keeps history for audit', async () => {
    const fake = fakeClubStore(seed());
    expect(await deleteAthlete(ctx(fake), 'a1')).toEqual({ ok: true, data: { documentId: 'a1' } });
    expect(fake.state.registrations[0]).toMatchObject({ athleteId: null, confirmation: null, status: 'Confirmat' });
    expect([fake.state.memberships, fake.state.acs, fake.state.duplicates, fake.state.profiles]).toEqual([[], [], [], []]);
    expect(fake.state.removedParticipations).toEqual(['sp1']);
    expect(fake.state.athletes.map((a) => a.id)).toEqual(['a2']);
    expect(fake.state.history.map((h) => [h.subjectId, h.action, h.changes])).toEqual([
      ['r1', 'athlete-unlinked', { name: 'Maria Pop' }],
      ['a1', 'deleted', { name: 'Maria Pop' }],
    ]);
    expect(fake.state.locks).toEqual(['athlete:a1']);
  });

  it('every unlinked registration notes it in its own Istoric (polish 11)', async () => {
    const second = registrationRow({ id: 'r2', number: '2025-0007', athleteId: 'a1', status: 'Confirmat' });
    const fake = fakeClubStore({ ...seed(), registrations: [...seed().registrations, second] });
    await deleteAthlete(ctx(fake), 'a1');
    const lines = fake.state.history.filter((h) => h.subjectType === 'registration-submission');
    expect(lines.map((h) => [h.subjectId, h.action, h.changes, h.actor])).toEqual([
      ['r1', 'athlete-unlinked', { name: 'Maria Pop' }, 'ana@club.ro'],
      ['r2', 'athlete-unlinked', { name: 'Maria Pop' }, 'ana@club.ro'],
    ]);
  });

  it('the unlinked registration is matched again', async () => {
    const fake = fakeClubStore({ ...seed(), athletes: [...seed().athletes, athleteRow({ id: 'a3', name: 'Maria Pop', birthDate: '2016-03-14' })] });
    await deleteAthlete(ctx(fake), 'a1');
    expect(fake.state.registrations[0]).toMatchObject({ matchAthleteId: 'a3', matchLevel: 'sigur' });
  });

  it('is a 404 for an unknown athlete and rolls back on a failure', async () => {
    expect(await deleteAthlete(ctx(fakeClubStore()), 'x')).toEqual({ ok: false, status: 404, error: ADMIN_ERRORS.notFound });
    const fake = fakeClubStore(seed());
    fake.failOn('deleteProfile');
    expect(await deleteAthlete(ctx(fake), 'a1')).toEqual({ ok: false, status: 500, error: ADMIN_ERRORS.failed });
    expect([fake.state.athletes.length, fake.state.memberships.length, fake.state.registrations[0].athleteId]).toEqual([2, 1, 'a1']);
    expect(fake.state.history).toEqual([]);
  });
});
