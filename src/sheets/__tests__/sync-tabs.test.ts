/**
 * The Înscrieri sync against the in-memory spreadsheet of SHEETS_DRY_RUN:
 * per-tab columns through resync, reconcile, queued batches, moves and deletes.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { _dryLinks, _dryResetAll, getSpreadsheet, getValues } from '../client';
import { inscrieriPlan } from '../matrix';
import { getForm } from '../registry';
import { applyBatch, deleteRow, reconcile, resyncForm } from '../sync';
import { flush, queueUpsert } from '../queue';
import { installStrapi } from './fakes.test.helper';
import type { Doc } from './fakes.test.helper';

const logSync = vi.hoisted(() => vi.fn());
vi.mock('../store', () => ({
  getLink: async (form: string) => ({
    form,
    spreadsheetId: 'sheet-1',
    spreadsheetName: 'Test',
    tab: 'Date',
    enabled: true,
    intervalHours: 4,
    lastSyncAt: null,
    lastSyncOk: null,
    lastSyncMessage: null,
    lastReconcileAt: null,
  }),
  logSync,
}));

const ENV = { GOOGLE_SA_EMAIL: 'robot@example.iam', GOOGLE_SA_PRIVATE_KEY: 'key', SHEETS_DRY_RUN: '1', CMS_PUBLIC_URL: 'https://cms.example.ro' };
const saved: Record<string, string | undefined> = {};

const oldRow = (id: string, season: string | null, childName: string): Doc => ({
  documentId: id,
  season,
  submittedAt: '2025-09-14T15:02:00.000Z',
  status: 'Confirmat',
  childName,
  childBirthDate: '2016-05-05',
  parentName: 'Elena Bălan',
  email: 'parinte3@exemplu.ro',
  phone: '0722000000',
  level: 'Incepatori',
  shirtSize: 'S',
  howHeard: 'Prieteni',
  clubInterest: true,
  regulationsAgreement: true,
  privacyConsent: true,
  extra: {},
});

const newRow = (id: string, nr: string, childName: string): Doc => ({
  documentId: id,
  season: '2026-2027',
  registrationNumber: nr,
  submittedAt: '2026-10-03T11:22:00.000Z',
  status: 'Nou',
  section: { name: 'AFI Cotroceni' },
  email: 'parinte@exemplu.ro',
  parentName: 'Mihaela Dumitrescu',
  relationship: 'parinte',
  phone: '0722111222',
  childName,
  childBirthDate: '14.03.2014',
  childHeight: 142,
  shirtSize: 'S',
  lastSeason: 'Începători',
  priorExperience: 'Nimic',
  expectations: 'Piruete',
  membershipAnswer: 'da',
  subscriptionChoice: { priceItemName: 'Abonament 8', price: 300, member: true },
  source: 'Recomandare',
  gdprConsent: true,
  regulationsConsent: true,
  extra: {},
});

/** A tab as the sheet shows it, each row without its empty trailing cells. */
const tab = async (name: string) => {
  const grid = (await getValues('sheet-1', `'${name}'!A1:AZ`)).data ?? [];
  return grid.map((row) => {
    const cells = [...row];
    while (cells.length && cells[cells.length - 1] === '') cells.pop();
    return cells;
  });
};
const column = (grid: string[][], label: string) => grid.slice(1).map((r) => r[grid[0].indexOf(label)]);
const link = (nr: string) => `https://cms.example.ro/admin/plugins/edusport-inscrieri?q=${nr}&season=all`;
/** The dry-run links of a tab, as row -> address, read from its Document column. */
const links = async (name: string) => {
  const grid = await tab(name);
  const col = String.fromCharCode(65 + grid[0].indexOf('Document'));
  const all = _dryLinks('sheet-1', name);
  return Object.fromEntries(Object.entries(all).filter(([at]) => at.startsWith(col)).map(([at, uri]) => [Number(at.slice(1)), uri]));
};

let docs: Doc[];
const store = () => installStrapi(docs);

beforeAll(() => {
  for (const [k, v] of Object.entries(ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
});
afterAll(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});
beforeEach(() => {
  _dryResetAll();
  logSync.mockClear();
  getForm('inscrieri').invalidate();
  docs = [oldRow('old-1', '2025-2026', 'Ana Bălan'), oldRow('old-2', null, 'Fără Sezon'), newRow('new-1', '2026-0142', 'Maria Dumitrescu')];
  store();
});

describe('Înscrieri tabs with their own columns', () => {
  it('writes the old seasons with today\'s columns and 2026-2027 with the new form\'s', async () => {
    const res = await resyncForm('inscrieri', 'manual');
    expect(res.ok).toBe(true);
    const today = await inscrieriPlan(docs.slice(0, 2));
    expect((await tab('2025-2026'))[0]).toEqual(today.header);
    expect((await tab('fara-sezon'))[0]).toEqual(today.header);
    const season = await tab('2026-2027');
    expect(season[0].slice(0, 4)).toEqual(['Nr. înscriere', 'Trimis la', 'Stare', 'Școală']);
    expect(season[0].slice(-4)).toEqual(['Notă internă', 'Document', 'E-mail', 'ID']);
    expect(season[1].slice(0, 4)).toEqual(['2026-0142', '03.10.2026 14:22', 'Nou', 'AFI Cotroceni']);
    expect(column(season, 'Membru A.C.S.')).toEqual(['Da']);
    expect(column(season, 'Document')).toEqual(['Deschide documentul']);
    expect(await links('2026-2027')).toEqual({ 2: link('2026-0142') });
    expect(_dryLinks('sheet-1', '2025-2026')).toEqual({});
  });

  it('finds nothing to change on the next reconcile (idempotent)', async () => {
    await resyncForm('inscrieri', 'manual');
    const res = await reconcile('inscrieri', 'manual');
    expect(res).toMatchObject({ ok: true, added: 0, updated: 0, removed: 0 });
    expect(logSync).toHaveBeenLastCalledWith('inscrieri', 'manual', { added: 0, updated: 0, removed: 0 }, true, 'Verificare: +0 ~0 -0');
  });

  it('a queued edit updates the row in place with its tab\'s columns', async () => {
    await resyncForm('inscrieri', 'manual');
    docs[2] = { ...docs[2], status: 'Contactat' };
    store();
    const res = await applyBatch('inscrieri', ['new-1'], []);
    expect(res).toMatchObject({ ok: true, added: 0, updated: 1, removed: 0 });
    expect((await tab('2026-2027'))[1][2]).toBe('Contactat');
    expect((await tab('2026-2027')).length).toBe(2);
    expect(await links('2026-2027')).toEqual({ 2: link('2026-0142') });
  });

  it('switches a season tab to the new columns when its first new-form row arrives', async () => {
    docs = [oldRow('old-1', '2025-2026', 'Ana Bălan'), oldRow('old-3', '2026-2027', 'Vechi Formular')];
    store();
    await resyncForm('inscrieri', 'manual');
    expect((await tab('2026-2027'))[0][0]).toBe('Trimis la');
    const before2025 = await tab('2025-2026');

    docs.push(newRow('new-1', '2026-0142', 'Maria Dumitrescu'));
    store();
    queueUpsert('inscrieri', 'new-1');
    await flush('inscrieri');

    const season = await tab('2026-2027');
    expect(season[0][0]).toBe('Nr. înscriere');
    expect(column(season, 'ID')).toEqual(['old-3', 'new-1']);
    expect(column(season, 'Numele copilului')).toEqual(['Vechi Formular', 'Maria Dumitrescu']);
    expect(await links('2026-2027')).toEqual({ 3: link('2026-0142') });
    expect(await tab('2025-2026')).toEqual(before2025);
    expect((await reconcile('inscrieri', 'manual')).updated).toBe(0);
  });

  it('moves the status colours with the Stare column, without stacking rules', async () => {
    docs = [oldRow('old-3', '2026-2027', 'Vechi Formular')];
    store();
    await resyncForm('inscrieri', 'manual');
    docs.push(newRow('new-1', '2026-0142', 'Maria Dumitrescu'));
    store();
    await applyBatch('inscrieri', ['new-1'], []);
    await reconcile('inscrieri', 'manual');
    const info = await getSpreadsheet('sheet-1');
    const rules = info.data!.tabs.find((t) => t.title === '2026-2027')!.conditionalFormats;
    expect(rules).toHaveLength(4);
    expect(rules.every((r) => r.ranges[0].startColumnIndex === 2)).toBe(true);
  });

  it('moves a row between seasons with no copy left behind; an old-form row takes the new columns of its new tab', async () => {
    await resyncForm('inscrieri', 'manual');
    docs[0] = { ...docs[0], season: '2026-2027' };
    store();
    const res = await applyBatch('inscrieri', ['old-1'], []);
    expect(res.ok).toBe(true);
    const season = await tab('2026-2027');
    expect(column(season, 'ID')).toEqual(['new-1', 'old-1']);
    expect(column(season, 'Numele copilului')).toEqual(['Maria Dumitrescu', 'Ana Bălan']);
    expect(column(season, 'Document')).toEqual(['Deschide documentul', '']);
    expect(await links('2026-2027')).toEqual({ 2: link('2026-0142') });
    expect(await tab('2025-2026')).toHaveLength(1);
  });

  it('switches an old season tab too when a new-form row is moved into it (the rule has no season list)', async () => {
    await resyncForm('inscrieri', 'manual');
    docs[2] = { ...docs[2], season: '2025-2026' };
    store();
    const res = await applyBatch('inscrieri', ['new-1'], []);
    expect(res.ok).toBe(true);
    const old = await tab('2025-2026');
    expect(old[0][0]).toBe('Nr. înscriere');
    expect(column(old, 'ID')).toEqual(['old-1', 'new-1']);
    expect(await tab('2026-2027')).toHaveLength(1);
  });

  it('settles after the last new-form row leaves a season: no rewrite on every reconcile', async () => {
    await resyncForm('inscrieri', 'manual');
    docs[2] = { ...docs[2], season: '2025-2026' };
    store();
    await applyBatch('inscrieri', ['new-1'], []);
    await reconcile('inscrieri', 'manual');
    logSync.mockClear();
    expect(await reconcile('inscrieri', 'manual')).toMatchObject({ ok: true, added: 0, updated: 0, removed: 0 });
    expect(logSync.mock.calls.map((c) => c[4])).not.toContain('Antet diferit: rescriere completă');
  });

  it('keeps each link on its row when a row above it is removed', async () => {
    docs.push(newRow('new-2', '2026-0143', 'Ioana Popescu'));
    store();
    await resyncForm('inscrieri', 'manual');
    expect(await links('2026-2027')).toEqual({ 2: link('2026-0142'), 3: link('2026-0143') });
    await deleteRow('inscrieri', 'new-1');
    expect(await links('2026-2027')).toEqual({ 2: link('2026-0143') });
  });

  it('shows no link and no text without CMS_PUBLIC_URL', async () => {
    delete process.env.CMS_PUBLIC_URL;
    try {
      await resyncForm('inscrieri', 'manual');
      expect(column(await tab('2026-2027'), 'Document')).toEqual(['']);
      expect(_dryLinks('sheet-1', '2026-2027')).toEqual({});
    } finally {
      process.env.CMS_PUBLIC_URL = ENV.CMS_PUBLIC_URL;
    }
  });

  it('removes a deleted registration from a tab with the new columns', async () => {
    await resyncForm('inscrieri', 'manual');
    const res = await deleteRow('inscrieri', 'new-1');
    expect(res).toMatchObject({ ok: true, removed: 1 });
    expect(await tab('2026-2027')).toHaveLength(1);
  });

  it('repairs a lost write and a row left in the wrong tab on reconcile', async () => {
    await resyncForm('inscrieri', 'manual');
    docs.push(newRow('new-2', '2026-0143', 'Ioana Popescu'));
    docs[0] = { ...docs[0], season: '2026-2027' };
    store();
    const res = await reconcile('inscrieri', 'manual');
    expect(res).toMatchObject({ ok: true });
    const season = await tab('2026-2027');
    expect(column(season, 'ID').sort()).toEqual(['new-1', 'new-2', 'old-1']);
    const linked = Object.values(await links('2026-2027')).sort();
    expect(linked).toEqual([link('2026-0142'), link('2026-0143')]);
    expect(column(await tab('2025-2026'), 'ID')).toEqual([]);
    expect((await reconcile('inscrieri', 'manual'))).toMatchObject({ added: 0, updated: 0, removed: 0 });
  });

  it('leaves a tab that is not ours alone', async () => {
    await resyncForm('inscrieri', 'manual');
    const { updateValues } = await import('../client');
    await updateValues('sheet-1', "'Note'!A1", [['Notițele mele', 'nu atinge']]);
    await reconcile('inscrieri', 'manual');
    expect(await tab('Note')).toEqual([['Notițele mele', 'nu atinge']]);
  });
});

describe('single-tab forms keep working as before', () => {
  it('writes Voluntari to its one tab, then finds nothing to change, then updates in place', async () => {
    getForm('voluntari').invalidate();
    docs = [{ documentId: 'v-1', fullName: 'Ion Pop', submittedAt: '2026-01-01T10:00:00.000Z', status: 'Nou' }];
    store();
    expect((await resyncForm('voluntari', 'manual')).ok).toBe(true);
    expect((await tab('Date'))[0].slice(0, 3)).toEqual(['Trimis la', 'Stare', 'Nume']);
    expect(await reconcile('voluntari', 'manual')).toMatchObject({ ok: true, added: 0, updated: 0, removed: 0 });
    docs[0] = { ...docs[0], status: 'Acceptat' };
    store();
    expect(await applyBatch('voluntari', ['v-1'], [])).toMatchObject({ ok: true, added: 0, updated: 1 });
    expect((await tab('Date'))[1][1]).toBe('Acceptat');
  });
});
