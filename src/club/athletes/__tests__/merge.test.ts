import { describe, expect, it, vi } from 'vitest';
import { ADMIN_ERRORS } from '../errors';
import { dismissDuplicate, mergeAthletes, mergePreview, readMergeRequest } from '../merge';
import { athleteRow, fakeClubStore, registrationRow, type Fake } from './fake-store';
import { canUndo, type ConfirmationRecord } from '../../confirm/plan';

const ctx = (fake: Fake) => ({ store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn() });
const profile = (id: string, slug: string, previousSlugs: string[] = []) => ({ id, name: 'x', slug, previousSlugs, showPublicPage: true, published: true });
const dup = (id: string, firstId: string, secondId: string, dismissed = false) => ({ id, firstId, secondId, dismissed });
const seed = () => ({
  athletes: [
    athleteRow({ id: 'k', name: 'Maria Pop', birthDate: '2016-03-14', phone: '0722', profileId: 'sp-k' }),
    athleteRow({ id: 'r', name: 'Pop Maria', birthDate: null, phone: '0733', email: 'ana@example.com', profileId: 'sp-r' }),
    athleteRow({ id: 't', name: 'Maria P.' }),
  ],
  registrations: [registrationRow({ id: 'reg', athleteId: 'r', status: 'Confirmat', confirmation: { athleteId: 'r' } as ConfirmationRecord })],
  memberships: [
    { id: 'mk', athleteId: 'k', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null },
    { id: 'mr', athleteId: 'r', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null },
    { id: 'mr2', athleteId: 'r', groupId: 'g-ib', seasonId: 's25', isMain: true, from: null },
  ],
  acs: [{ id: 'ck', athleteId: 'k', seasonId: 's26', state: 'in_asteptare' as const }, { id: 'cr', athleteId: 'r', seasonId: 's26', state: 'da' as const }],
  duplicates: [dup('d1', 'k', 'r'), dup('d2', 'r', 't')],
  profiles: [profile('sp-k', 'maria-pop'), profile('sp-r', 'maria-pop-2', ['m-pop'])],
});

describe('Unește cu alt sportiv (spec 6.6, d39)', () => {
  it('preview: both records and the differing fields', async () => {
    const result = await mergePreview(fakeClubStore(seed()).store, 'k', 'r');
    expect(result.ok && result.data.differing).toEqual(['name', 'birthDate', 'phone', 'email']);
    expect(result.ok && [result.data.kept.profileSlug, result.data.removed.registrations]).toEqual(['maria-pop', 1]);
  });

  it('preview: refuses the same record twice and unknown records', async () => {
    const store = fakeClubStore(seed()).store;
    expect(await mergePreview(store, 'k', 'k')).toEqual({ ok: false, status: 400, error: ADMIN_ERRORS.invalid });
    expect(await mergePreview(store, 'k', 'zz')).toEqual({ ok: false, status: 404, error: ADMIN_ERRORS.notFound });
  });

  it('moves everything to the kept record with the picked fields', async () => {
    const fake = fakeClubStore(seed());
    expect(await mergeAthletes(ctx(fake), { keptId: 'k', removedId: 'r', take: ['email'] })).toEqual({ ok: true, data: { documentId: 'k' } });
    expect(fake.state.athletes.map((a) => a.id)).toEqual(['k', 't']);
    expect(fake.state.athletes[0]).toMatchObject({ name: 'Maria Pop', phone: '0722', email: 'ana@example.com' });
    expect(fake.state.registrations[0]).toMatchObject({ athleteId: 'k', confirmation: null });
    expect(fake.state.memberships.map((m) => [m.id, m.athleteId, m.isMain])).toEqual([['mk', 'k', true], ['mr2', 'k', true]]);
    expect(fake.state.acs.map((a) => [a.id, a.athleteId, a.state])).toEqual([['ck', 'k', 'da']]);
  });

  it('a relinked registration keeps Confirmat but can no longer be undone', async () => {
    const fake = fakeClubStore(seed());
    await mergeAthletes(ctx(fake), { keptId: 'k', removedId: 'r', take: [] });
    expect(fake.state.registrations[0].status).toBe('Confirmat');
    expect(canUndo(fake.state.registrations[0])).toBe(false);
  });

  it('one main group per season: the kept one stays main, the other is demoted', async () => {
    const memberships = [
      { id: 'mk', athleteId: 'k', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null },
      { id: 'mr', athleteId: 'r', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-10-05' },
    ];
    const fake = fakeClubStore({ ...seed(), memberships });
    await mergeAthletes(ctx(fake), { keptId: 'k', removedId: 'r', take: [] });
    expect(fake.state.memberships).toEqual([memberships[0], { ...memberships[1], athleteId: 'k', isMain: false }]);
  });

  it('A.C.S.: the higher state stays, never lowered; a season only the other record has moves', async () => {
    const acs = [
      { id: 'ck', athleteId: 'k', seasonId: 's26', state: 'da' as const },
      { id: 'cr', athleteId: 'r', seasonId: 's26', state: 'nu' as const },
      { id: 'cr2', athleteId: 'r', seasonId: 's25', state: 'in_asteptare' as const },
    ];
    const fake = fakeClubStore({ ...seed(), acs });
    await mergeAthletes(ctx(fake), { keptId: 'k', removedId: 'r', take: [] });
    expect(fake.state.acs.map((a) => [a.id, a.athleteId, a.seasonId, a.state])).toEqual([['ck', 'k', 's26', 'da'], ['cr2', 'k', 's25', 'in_asteptare']]);
  });

  it('keeps the kept profile, deletes the other and remembers its addresses (d39)', async () => {
    const fake = fakeClubStore(seed());
    await mergeAthletes(ctx(fake), { keptId: 'k', removedId: 'r', take: [] });
    expect(fake.state.profiles).toEqual([{ ...profile('sp-k', 'maria-pop', ['maria-pop-2', 'm-pop']), name: 'Maria Pop' }]);
    expect(fake.state.removedParticipations).toEqual(['sp-r']);
  });

  it('the other record\'s name picked: the kept profile is renamed, its address stays', async () => {
    const fake = fakeClubStore(seed());
    await mergeAthletes(ctx(fake), { keptId: 'k', removedId: 'r', take: ['name'] });
    expect(fake.state.athletes[0].name).toBe('Pop Maria');
    expect(fake.state.profiles).toEqual([{ ...profile('sp-k', 'maria-pop', ['maria-pop-2', 'm-pop']), name: 'Pop Maria' }]);
  });

  it('only the other record has a profile: it moves to the kept record and follows its name', async () => {
    const fake = fakeClubStore({ ...seed(), athletes: [athleteRow({ id: 'k', name: 'Maria Pop' }), athleteRow({ id: 'r', name: 'Pop Maria', profileId: 'sp-r' })] });
    await mergeAthletes(ctx(fake), { keptId: 'k', removedId: 'r', take: [] });
    expect(fake.state.athletes[0].profileId).toBe('sp-r');
    expect(fake.state.profiles.find((p) => p.id === 'sp-r')).toMatchObject({ name: 'Maria Pop', slug: 'maria-pop-2', previousSlugs: ['m-pop'] });
    expect(fake.state.removedParticipations).toEqual([]);
  });

  it('flags: the pair goes, a flag with a third athlete moves to the kept record (N5)', async () => {
    const fake = fakeClubStore(seed());
    await mergeAthletes(ctx(fake), { keptId: 'k', removedId: 'r', take: [] });
    expect(fake.state.duplicates.map((d) => [d.firstId, d.secondId, d.dismissed])).toEqual([['k', 't', false]]);
  });

  it('flags: a dismissed one stays dismissed; two rows of one pair become one, dismissed if either was', async () => {
    const duplicates = [
      dup('d1', 'r', 'k', true), dup('d2', 't', 'r', true),
      dup('d3', 'k', 'u'), dup('d4', 'u', 'r', true),
      dup('d5', 'k', 'v', true), dup('d6', 'r', 'v'),
      dup('d7', 'r', 'w'), dup('d8', 'w', 'r', true),
    ];
    const fake = fakeClubStore({ ...seed(), duplicates });
    await mergeAthletes(ctx(fake), { keptId: 'k', removedId: 'r', take: [] });
    const pairs = fake.state.duplicates.map((d) => [d.firstId, d.secondId, d.dismissed]);
    expect(pairs).toEqual([['k', 'u', true], ['k', 'v', true], ['t', 'k', true], ['k', 'w', true]]);
  });

  it('history moves to the kept record, then "Unit cu <nume>"', async () => {
    const fake = fakeClubStore(seed());
    await fake.store.record({ subjectType: 'athlete', subjectId: 'r', action: 'created-from-registrations', actor: 'migrare' });
    await mergeAthletes(ctx(fake), { keptId: 'k', removedId: 'r', take: ['email'] });
    expect(fake.state.history.map((h) => [h.subjectId, h.action])).toEqual([['k', 'created-from-registrations'], ['k', 'merged'], ['k', 'updated']]);
    expect(fake.state.history[1].changes).toEqual({ name: 'Pop Maria' });
  });

  it('reads the body; refuses the same record twice and unknown records', async () => {
    expect(readMergeRequest({ keptId: 'k', removedId: 'r', take: ['email', 'x'] })).toEqual({ keptId: 'k', removedId: 'r', take: ['email'] });
    expect(readMergeRequest({ keptId: 'k', removedId: 'k' })).toBeNull();
    expect(readMergeRequest(null)).toBeNull();
    expect(await mergeAthletes(ctx(fakeClubStore(seed())), { keptId: 'k', removedId: 'zz', take: [] })).toEqual({ ok: false, status: 404, error: ADMIN_ERRORS.notFound });
  });

  it('all or nothing: a failure saves nothing', async () => {
    const fake = fakeClubStore(seed());
    const before = structuredClone(fake.state);
    fake.failOn('deleteAthlete');
    const c = ctx(fake);
    expect(await mergeAthletes(c, { keptId: 'k', removedId: 'r', take: ['email'] })).toEqual({ ok: false, status: 500, error: ADMIN_ERRORS.failed });
    expect(fake.state).toEqual(before);
    expect(c.log).toHaveBeenCalledOnce();
  });

  it('matches are refreshed after the commit; a refresh failure is only logged', async () => {
    const unlinked = registrationRow({ id: 'new', childName: 'Pop Maria', phone: '0733', email: 'ana@example.com', matchAthleteId: 'r', matchLevel: 'sigur' });
    const fake = fakeClubStore({ ...seed(), registrations: [unlinked] });
    await mergeAthletes(ctx(fake), { keptId: 'k', removedId: 'r', take: [] });
    expect(fake.state.registrations[0].matchAthleteId).toBe('k');

    const failing = fakeClubStore({ ...seed(), registrations: [unlinked] });
    failing.failOn('updateRegistration');
    const c = ctx(failing);
    expect(await mergeAthletes(c, { keptId: 'k', removedId: 'r', take: [] })).toEqual({ ok: true, data: { documentId: 'k' } });
    expect(c.log).toHaveBeenCalledOnce();
  });
});

describe('Nu e același copil (d12)', () => {
  it('dismisses the flag for good, keeps the row, and notes it on both records', async () => {
    const fake = fakeClubStore(seed());
    expect(await dismissDuplicate(ctx(fake), 'd1')).toEqual({ ok: true, data: { pairId: 'd1' } });
    expect(fake.state.duplicates.map((d) => [d.id, d.dismissed])).toEqual([['d1', true], ['d2', false]]);
    expect(fake.state.history.map((h) => [h.subjectId, h.action, h.changes])).toEqual([
      ['k', 'duplicate-dismissed', { name: 'Pop Maria' }],
      ['r', 'duplicate-dismissed', { name: 'Maria Pop' }],
    ]);
  });

  it('refuses an already dismissed or unknown flag', async () => {
    const fake = fakeClubStore(seed());
    await dismissDuplicate(ctx(fake), 'd1');
    expect(await dismissDuplicate(ctx(fake), 'd1')).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
    expect(await dismissDuplicate(ctx(fake), 'zz')).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
    expect(fake.state.history).toHaveLength(2);
  });
});
