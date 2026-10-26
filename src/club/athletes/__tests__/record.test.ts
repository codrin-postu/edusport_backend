import { describe, expect, it, vi } from 'vitest';
import { ADMIN_ERRORS } from '../errors';
import { readAthleteRecord, updateAthlete } from '../record';
import { athleteRow, fakeClubStore, registrationRow, type Fake } from './fake-store';

const ctx = (fake: Fake) => ({ store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn() });
const seed = () => ({
  athletes: [
    athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', profileId: 'sp1', contactName: 'Ana', phone: '07' }),
    athleteRow({ id: 'a2', name: 'Pop Maria' }),
  ],
  memberships: [{ id: 'm1', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null }],
  acs: [{ id: 'c1', athleteId: 'a1', seasonId: 's26', state: 'in_asteptare' as const }],
  registrations: [
    registrationRow({ id: 'r1', athleteId: 'a1', number: '2025-0010', seasonId: 's25', season: '2025-2026', membershipAnswer: 'nu', status: 'Confirmat', submittedAt: '2025-10-01T10:00:00.000Z' }),
    registrationRow({ id: 'r2', athleteId: 'a1', status: 'Confirmat' }),
  ],
  profiles: [{ id: 'sp1', name: 'Maria Pop', slug: 'maria-pop', previousSlugs: [], showPublicPage: false, published: true }],
  duplicates: [{ id: 'd1', firstId: 'a2', secondId: 'a1' }],
});

describe('athlete record (spec 6.1 to 6.6)', () => {
  it('a deploy-marked record stays "Date incomplete" with no field missing (task 27 F2)', async () => {
    const athlete = athleteRow({ id: 'a1', name: 'Luca Stoica', birthDate: '2015-01-01', contactName: 'Ana', phone: '07', email: 'e', dataIncomplete: true });
    const record = await readAthleteRecord(fakeClubStore({ athletes: [athlete] }).store, 'a1', null);
    expect([record?.dataIncomplete, record?.missing]).toEqual([true, []]);
  });

  it('Date, header, A.C.S. of the season, Înscrieri, Documente, Profil public, duplicate line, Istoric count', async () => {
    const fake = fakeClubStore(seed());
    await fake.store.record({ subjectType: 'athlete', subjectId: 'a1', action: 'profile-created', actor: 'ana@club.ro' });
    const record = await readAthleteRecord(fake.store, 'a1', null);
    expect(record).toEqual({
      documentId: 'a1',
      fields: { name: 'Maria Pop', birthDate: '14.03.2016', contactName: 'Ana', phone: '07', email: null },
      missing: ['email'],
      status: 'activ',
      dataIncomplete: true,
      header: { birthDate: '14.03.2016', mainGroup: 'Primii Pași' },
      season: { documentId: 's26', label: '2026-2027' },
      acs: { seasonLabel: '2026-2027', state: 'in_asteptare' },
      registrations: [
        { documentId: 'r2', number: '2026-0142', season: '2026-2027', status: 'Confirmat' },
        { documentId: 'r1', number: '2025-0010', season: '2025-2026', status: 'Confirmat' },
      ],
      documents: [
        { registrationDocumentId: 'r2', kind: 'acord', label: 'Acord 2026-2027 (înscrierea 2026-0142)' },
        { registrationDocumentId: 'r2', kind: 'adeziune', label: 'Cerere de adeziune 2026-2027 (înscrierea 2026-0142)' },
        { registrationDocumentId: 'r1', kind: 'acord', label: 'Acord 2025-2026 (înscrierea 2025-0010)' },
      ],
      profile: { documentId: 'sp1', slug: 'maria-pop', showPublicPage: false },
      duplicates: [{ pairId: 'd1', documentId: 'a2', name: 'Pop Maria' }],
      historyCount: 1,
    });
  });

  it('is null for an unknown athlete', async () => expect(await readAthleteRecord(fakeClubStore().store, 'x', null)).toBeNull());
});

describe('Editează on Date (spec 6.2, 3b s2)', () => {
  it('writes old -> new, recomputes "Date incomplete", renames the profile, keeps the slug', async () => {
    const fake = fakeClubStore(seed());
    const result = await updateAthlete(ctx(fake), 'a1', { name: 'Maria Ioana Pop', birthDate: '14.03.2016', contactName: 'Ana', phone: '07', email: 'ana@example.com' });
    expect(result.ok && [result.data.changed, result.data.record.dataIncomplete]).toEqual([['name', 'email'], false]);
    expect(fake.state.profiles[0]).toMatchObject({ name: 'Maria Ioana Pop', slug: 'maria-pop' });
    expect(fake.state.history.map((h) => [h.action, h.changes])).toEqual([
      ['updated', { fields: { name: { from: 'Maria Pop', to: 'Maria Ioana Pop' }, email: { from: null, to: 'ana@example.com' } } }],
    ]);
  });

  it('recomputes a stale "Date incomplete" even with no change, without a history line', async () => {
    const fake = fakeClubStore({ athletes: [athleteRow({ id: 'a1', name: 'Maria', birthDate: '2016-03-14', contactName: 'A', phone: '1', email: 'e', dataIncomplete: true })] });
    const result = await updateAthlete(ctx(fake), 'a1', { name: 'Maria', birthDate: '14.03.2016', contactName: 'A', phone: '1', email: 'e' });
    expect(result.ok && result.data.changed).toEqual([]);
    expect([fake.state.athletes[0].dataIncomplete, fake.state.history]).toEqual([false, []]);
  });

  it('refuses a missing name or a bad date', async () => {
    expect(await updateAthlete(ctx(fakeClubStore(seed())), 'a1', { name: '' })).toEqual({ ok: false, status: 400, error: ADMIN_ERRORS.nameRequired });
    expect(await updateAthlete(ctx(fakeClubStore(seed())), 'a1', { name: 'A', birthDate: '2016' })).toEqual({ ok: false, status: 400, error: ADMIN_ERRORS.birthDate });
  });

  it('refreshes the saved matches', async () => {
    const fake = fakeClubStore({ athletes: [athleteRow({ id: 'a1', name: 'Ion' })], registrations: [registrationRow({ id: 'r1' })] });
    await updateAthlete(ctx(fake), 'a1', { name: 'Maria Pop', birthDate: '14.03.2016' });
    expect(fake.state.registrations[0]).toMatchObject({ matchAthleteId: 'a1', matchLevel: 'sigur' });
  });
});
