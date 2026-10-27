import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import { registrationScrub } from '../../personal-data/anonymize-plan';
import { strapiClubStore, toAthleteRow } from '../strapi-store';
import { athleteRow, fakeClubStore, registrationRow } from './fake-store';

type Call = [string, string, unknown];

/** Records db.query and documents calls; `rows` answers findMany / findFirst per uid. */
function recordingStrapi(calls: Call[], rows: Record<string, unknown[]> = {}): Core.Strapi {
  const query = (uid: string) => ({
    findMany: async (args: unknown) => { calls.push([uid, 'findMany', args]); return rows[uid] ?? []; },
    update: async (args: unknown) => { calls.push([uid, 'update', args]); return {}; },
  });
  const documents = (uid: string) => ({
    findFirst: async (args: unknown) => { calls.push([uid, 'findFirst', args]); return (rows[uid] ?? [])[0] ?? null; },
    update: async (args: unknown) => { calls.push([uid, 'update', args]); return {}; },
    create: async (args: unknown) => { calls.push([uid, 'create', args]); return {}; },
  });
  return { db: { query }, documents } as unknown as Core.Strapi;
}

const REG = 'api::registration-submission.registration-submission';
const JOB = 'api::email-job.email-job';
const HISTORY = 'api::history-entry.history-entry';
const SETTINGS = 'api::site-settings.site-settings';

describe('store parity (3C spec 8)', () => {
  it('the fake and the Strapi store expose the same methods', () => {
    const strapiKeys = Object.keys(strapiClubStore({} as Core.Strapi)).sort();
    expect(Object.keys(fakeClubStore().store).sort()).toEqual(strapiKeys);
  });
});

describe('Strapi store, 3C writes', () => {
  it('reads createdAt and anonymizedAt of an athlete', () => {
    const row = toAthleteRow({ documentId: 'a1', status: 'anonimizat', createdAt: new Date('2020-01-02T03:04:05.000Z'), anonymizedAt: '2026-10-27T09:00:00.000Z' });
    expect(row).toMatchObject({ status: 'anonimizat', createdAt: '2020-01-02T03:04:05.000Z', anonymizedAt: '2026-10-27T09:00:00.000Z' });
  });

  it('scrubs a registration with one db update (required fields too, lifecycles still run)', async () => {
    const calls: Call[] = [];
    const data = registrationScrub(null);
    await strapiClubStore(recordingStrapi(calls)).scrubRegistration('r1', data);
    expect(calls).toEqual([[REG, 'update', { where: { documentId: 'r1' }, data }]]);
    expect(data).toMatchObject({ howHeard: null, childName: 'Anonimizat' });
    expect(data).not.toHaveProperty('source');
  });

  it('replaces one history row by its id', async () => {
    const calls: Call[] = [];
    await strapiClubStore(recordingStrapi(calls)).setHistoryChanges(42, { name: null });
    expect(calls).toEqual([[HISTORY, 'update', { where: { id: 42 }, data: { changes: { name: null } } }]]);
  });

  it('clears the e-mail jobs of the registrations (lastError too); a queued job is cancelled', async () => {
    const calls: Call[] = [];
    const strapi = recordingStrapi(calls, { [JOB]: [{ id: 7, status: 'queued' }, { id: 8, status: 'sent' }] });
    await strapiClubStore(strapi).scrubEmailJobs(['r1', 'r2']);
    expect(calls).toEqual([
      [JOB, 'findMany', { where: { registration: { documentId: { $in: ['r1', 'r2'] } } }, select: ['id', 'status'], limit: 100000 }],
      [JOB, 'update', { where: { id: 7 }, data: { recipient: null, subject: null, lastError: null, status: 'cancelled' } }],
      [JOB, 'update', { where: { id: 8 }, data: { recipient: null, subject: null, lastError: null, status: 'sent' } }],
    ]);
    const none: Call[] = [];
    await strapiClubStore(recordingStrapi(none)).scrubEmailJobs([]);
    expect(none).toEqual([]);
  });

  it('lists the registrations of anonymized athletes and the raw rows of one athlete', async () => {
    const calls: Call[] = [];
    const strapi = recordingStrapi(calls, { [REG]: [{ documentId: 'r1', childName: 'Anonimizat' }] });
    expect(await strapiClubStore(strapi).anonymizedRegistrationIds()).toEqual(['r1']);
    expect(await strapiClubStore(strapi).registrationRecords('a1')).toEqual([{ documentId: 'r1', childName: 'Anonimizat' }]);
    expect(calls.map((c) => c[2])).toEqual([
      { where: { athlete: { status: 'anonimizat' } }, select: ['documentId'], limit: 100000 },
      { where: { athlete: { documentId: 'a1' } }, orderBy: { id: 'asc' }, limit: 100000 },
    ]);
  });

  it('reads and saves site-settings.personalData', async () => {
    const calls: Call[] = [];
    const strapi = recordingStrapi(calls, { [SETTINGS]: [{ documentId: 'set1', personalData: { retentionYears: 6 } }] });
    expect(await strapiClubStore(strapi).personalDataSettings()).toEqual({ retentionYears: 6 });
    await strapiClubStore(strapi).savePersonalDataSettings({ retentionYears: 6, reviewHiddenUntilSeason: '2026-2027' });
    expect(calls.at(-1)).toEqual([SETTINGS, 'update', { documentId: 'set1', data: { personalData: { retentionYears: 6, reviewHiddenUntilSeason: '2026-2027' } } }]);
    const empty: Call[] = [];
    await strapiClubStore(recordingStrapi(empty)).savePersonalDataSettings({ retentionYears: 5, reviewHiddenUntilSeason: null });
    expect(empty.at(-1)).toEqual([SETTINGS, 'create', { data: { personalData: { retentionYears: 5, reviewHiddenUntilSeason: null } } }]);
  });
});

describe('fake store, same behaviour', () => {
  it('scrubs a registration: the row reads like the Strapi row would, the raw record holds nulls', async () => {
    const fake = fakeClubStore({
      athletes: [athleteRow({ id: 'a1', status: 'anonimizat' })],
      registrations: [registrationRow({ id: 'r1', athleteId: 'a1', lastSeason: 'Începători' })],
      registrationRecords: { r1: { shirtSize: 'S', gdprConsent: true, howHeard: 'De la Ion Popescu', source: 'prieteni' } },
    });
    await fake.store.scrubRegistration('r1', registrationScrub(null));
    expect(await fake.store.registration('r1')).toMatchObject({ childName: 'Anonimizat', parentName: '', phone: '', email: '', childBirthDate: '', lastSeason: null, number: '2026-0142' });
    expect((await fake.store.registrationRecords('a1'))[0]).toMatchObject({
      documentId: 'r1', shirtSize: null, parentName: null, howHeard: null, source: 'prieteni', gdprConsent: true, registrationNumber: '2026-0142',
    });
    expect(await fake.store.anonymizedRegistrationIds()).toEqual(['r1']);
  });

  it('e-mail jobs, history rows and settings', async () => {
    const fake = fakeClubStore({
      emailJobs: [
        { id: 'j1', registrationId: 'r1', recipient: 'a@x.ro', subject: 'S', status: 'queued', lastError: 'Brevo 400: invalid a@x.ro' },
        { id: 'j2', registrationId: 'r9', recipient: 'b@x.ro', subject: 'T', status: 'queued', lastError: 'Brevo 400: invalid b@x.ro' },
        { id: 'j3', registrationId: 'r1', recipient: 'a@x.ro', subject: 'S', status: 'failed', lastError: 'Brevo 400: invalid a@x.ro' },
      ],
      history: [{ seq: 1, subjectType: 'athlete', subjectId: 'a1', action: 'updated', changes: { name: 'X' }, actor: 'ana@example.com', at: '2026-10-01T10:00:00.000Z' }],
    });
    await fake.store.scrubEmailJobs(['r1']);
    expect(fake.state.emailJobs).toEqual([
      { id: 'j1', registrationId: 'r1', recipient: null, subject: null, status: 'cancelled', lastError: null },
      { id: 'j2', registrationId: 'r9', recipient: 'b@x.ro', subject: 'T', status: 'queued', lastError: 'Brevo 400: invalid b@x.ro' },
      { id: 'j3', registrationId: 'r1', recipient: null, subject: null, status: 'failed', lastError: null },
    ]);
    await fake.store.setHistoryChanges(1, { name: null });
    expect(fake.state.history[0].changes).toEqual({ name: null });
    expect(await fake.store.personalDataSettings()).toBeNull();
    await fake.store.savePersonalDataSettings({ retentionYears: 7, reviewHiddenUntilSeason: null });
    expect(await fake.store.personalDataSettings()).toEqual({ retentionYears: 7, reviewHiddenUntilSeason: null });
  });

  it('a created athlete carries its creation time', async () => {
    const fake = fakeClubStore();
    const id = await fake.store.createAthlete({ name: 'Nou' });
    const created = fake.state.athletes.find((a) => a.id === id);
    expect(created?.createdAt).toBe(created?.updatedAt);
    expect(created?.anonymizedAt).toBeNull();
  });
});
