import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import { registrationScrub } from '../../personal-data/anonymize-plan';
import { strapiClubStore, textColumns, toAthleteRow } from '../strapi-store';
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

const PROFILE = 'api::sportsperson.sportsperson';
const FILE = 'plugin::upload.file';

type Attributes = Record<string, { type: string }>;
const CONTENT_TYPES: Record<string, { attributes: Attributes }> = {
  [PROFILE]: { attributes: { name: { type: 'string' }, photo: { type: 'media' }, gallery: { type: 'media' }, story: { type: 'blocks' }, activeSince: { type: 'date' } } },
  'api::calendar-event.calendar-event': { attributes: { imageUrl: { type: 'string' }, order: { type: 'integer' } } },
  'api::program.program': { attributes: { calendarEvents: { type: 'json' } } },
  [FILE]: { attributes: { hash: { type: 'string' }, url: { type: 'string' }, formats: { type: 'json' } } },
  'plugin::upload.folder': { attributes: { name: { type: 'string' } } },
  'admin::user': { attributes: { email: { type: 'email' }, firstname: { type: 'string' } } },
  'plugin::users-permissions.user': { attributes: { username: { type: 'string' } } },
};
const COMPONENTS: Record<string, { attributes: Attributes }> = {
  'shared.rich-text': { attributes: { body: { type: 'richtext' } } },
  'shared.seo': { attributes: { metaDescription: { type: 'text' }, shareImage: { type: 'media' } } },
};
const TABLES: Record<string, string> = {
  [PROFILE]: 'sportspeople', 'api::calendar-event.calendar-event': 'calendar_events', 'api::program.program': 'programs',
  'shared.rich-text': 'components_shared_rich_texts', 'shared.seo': 'components_shared_seos',
};
const snake = (name: string) => name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
/** Like Strapi's metadata: every scalar attribute carries its column name; `shared.seo` is not registered, so it is skipped. */
const REGISTRY_METADATA = {
  get: (uid: string) => {
    const schema = CONTENT_TYPES[uid] ?? (uid === 'shared.seo' ? undefined : COMPONENTS[uid]);
    if (!schema) return undefined;
    return { tableName: TABLES[uid], attributes: Object.fromEntries(Object.keys(schema.attributes).map((n) => [n, { columnName: snake(n) }])) };
  },
};

type MediaSeed = { profileRows?: unknown[]; files?: Record<number, unknown>; textHits?: Record<string, string> };

/** Profile rows, files with their `related` entries, the registry above, and `textHits`: the needle a `table.column` holds. */
function mediaStrapi(calls: Call[], seed: MediaSeed = {}): Core.Strapi {
  const query = (uid: string) => ({
    findMany: async (args: unknown) => { calls.push([uid, 'findMany', args]); return seed.profileRows ?? []; },
    findOne: async (args: { where: { id: number } }) => { calls.push([uid, 'findOne', args]); return seed.files?.[args.where.id] ?? null; },
  });
  const getConnection = (table: string) => ({
    whereRaw: (sql: string, bindings: string[]) => ({
      first: async () => {
        calls.push([table, sql, bindings]);
        const needle = seed.textHits?.[`${table}.${bindings[0]}`];
        return needle && bindings.includes(needle) ? { id: 1 } : undefined;
      },
    }),
  });
  const upload = { remove: async (file: unknown) => { calls.push([FILE, 'remove', file]); } };
  return {
    db: { query, getConnection, metadata: REGISTRY_METADATA }, contentType: () => CONTENT_TYPES[PROFILE], contentTypes: CONTENT_TYPES, components: COMPONENTS,
    plugin: () => ({ service: () => upload }),
  } as unknown as Core.Strapi;
}

describe('Strapi store, media of a profile (3C spec 4)', () => {
  it('reads the file ids of every media field on the draft and published rows, once each', async () => {
    const calls: Call[] = [];
    const profileRows = [{ id: 10, photo: { id: 1 }, gallery: [{ id: 2 }, { id: 3 }] }, { id: 11, photo: null, gallery: [{ id: 2 }, { id: 1 }] }];
    expect(await strapiClubStore(mediaStrapi(calls, { profileRows })).profileMediaIds('sp1')).toEqual([1, 2, 3]);
    expect(calls).toEqual([[PROFILE, 'findMany', {
      where: { documentId: 'sp1' }, select: ['id'], populate: { photo: { select: ['id'] }, gallery: { select: ['id'] } },
    }]]);
  });

  it('lists every text-bearing column of the content types and components; upload, admin and users-permissions rows are not scanned', () => {
    expect(textColumns(mediaStrapi([]))).toEqual([
      { table: 'sportspeople', column: 'name' }, { table: 'sportspeople', column: 'story' },
      { table: 'calendar_events', column: 'image_url' }, { table: 'programs', column: 'calendar_events' },
      { table: 'components_shared_rich_texts', column: 'body' },
    ]);
  });

  it('removes an unused file through the upload service; kept: related, in rich text, in program.calendarEvents json, in calendar-event.imageUrl, missing', async () => {
    const calls: Call[] = [];
    const own = { id: 1, hash: 'own_1', url: '/uploads/own_1.jpg', related: [] };
    const files = {
      1: own,
      2: { id: 2, hash: 'cover_2', url: '/uploads/cover_2.jpg', related: [{ id: 5, __type: 'api::article.article' }] },
      3: { id: 3, hash: 'body_3', url: '/uploads/body_3.jpg', related: [] },
      4: { id: 4, hash: 'md_4', url: '/uploads/md_4.jpg', related: [] },
      5: { id: 5, hash: 'event_5', url: '/uploads/event_5.jpg', related: [] },
    };
    const textHits = {
      'components_shared_rich_texts.body': 'body_3', 'programs.calendar_events': '/uploads/md_4.jpg', 'calendar_events.image_url': '/uploads/event_5.jpg',
    };
    const store = strapiClubStore(mediaStrapi(calls, { files, textHits }));
    const results = [];
    for (const id of [1, 2, 3, 4, 5, 9]) results.push(await store.deleteMediaIfUnused(id));
    expect(results).toEqual([true, false, false, false, false, false]);
    expect(calls[0]).toEqual([FILE, 'findOne', { where: { id: 1 }, populate: { related: { select: ['id'] } } }]);
    const match = "CAST(?? AS TEXT) LIKE '%' || ? || '%' OR CAST(?? AS TEXT) LIKE '%' || ? || '%'";
    expect(calls.slice(1, 6)).toEqual(textColumns(mediaStrapi([])).map((c) => [c.table, match, [c.column, 'own_1', c.column, '/uploads/own_1.jpg']]));
    expect(calls.filter((c) => c[1] === 'remove')).toEqual([[FILE, 'remove', own]]);
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

  const file = (id: number, usedBy: string[]) => ({ id, hash: `f_${id}`, url: `/uploads/f_${id}.jpg`, usedBy });

  it('media: a deleted profile no longer uses its files; a related or embedded file stays, only an unused one is removed', async () => {
    const fake = fakeClubStore({
      profiles: [{ id: 'sp1', name: 'X', slug: 'x', previousSlugs: [], showPublicPage: false, published: true }],
      files: [file(1, ['sp1']), file(2, ['sp1', 'article:a9']), file(3, ['article:a9']), file(4, ['sp1']), file(5, ['sp1'])],
      texts: ['[{"type":"image","image":{"hash":"f_4"}}]', '![](/uploads/f_5.jpg)'],
    });
    expect(await fake.store.profileMediaIds('sp1')).toEqual([1, 2, 4, 5]);
    await fake.store.deleteProfile('sp1');
    const results = [];
    for (const id of [1, 2, 4, 5, 9]) results.push(await fake.store.deleteMediaIfUnused(id));
    expect(results).toEqual([true, false, false, false, false]);
    expect(fake.state.files.map((f) => f.id)).toEqual([2, 3, 4, 5]);
  });

  it('a created athlete carries its creation time', async () => {
    const fake = fakeClubStore();
    const id = await fake.store.createAthlete({ name: 'Nou' });
    const created = fake.state.athletes.find((a) => a.id === id);
    expect(created?.createdAt).toBe(created?.updatedAt);
    expect(created?.anonymizedAt).toBeNull();
  });
});
