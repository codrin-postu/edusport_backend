import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Core } from '@strapi/strapi';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moveRegistrationsToSeason, seasonMoveDeps } from '../season-move';
import { buildRegistrationDocuments, listRegistrationDocuments, rebuildAfterEdit } from '../service';
import { pdfText } from './pdf-text';

vi.setConfig({ testTimeout: 30_000 });

const ID = 'reg0000000000000000000001';
const SEASONS = [
  { documentId: 'season2026', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270 },
  { documentId: 'season2027', label: '2027-2028', startMonth: '2027-10-01', endMonth: '2028-05-31', membershipFee: 300 },
];

let app: string;
let row: Record<string, unknown>;
let logs: string[];

/** A Strapi stand-in: one registration, the two Sezoane, the app folder and a log. */
function fakeStrapi(): Core.Strapi {
  const registration = {
    findOne: async () => row,
    update: async ({ data }: { data: { season: string; seasonRef: string | null } }) => {
      row = { ...row, season: data.season, seasonRef: SEASONS.find((s) => s.documentId === data.seasonRef) ?? null };
      return row;
    },
  };
  const seasons = { findFirst: async ({ filters }: { filters: { label: string } }) => SEASONS.find((s) => s.label === filters.label) ?? null };
  const log = (m: string) => logs.push(m);
  return {
    dirs: { app: { root: app } },
    documents: (uid: string) => (uid === 'api::season.season' ? seasons : registration),
    log: { error: log, warn: log },
  } as unknown as Core.Strapi;
}

beforeEach(async () => {
  app = await fs.mkdtemp(path.join(os.tmpdir(), 'edusport-move-'));
  vi.stubEnv('PRIVATE_FILES_DIR', '');
  logs = [];
  row = {
    documentId: ID,
    registrationNumber: '2026-0142',
    parentName: 'Ana Pop',
    phone: '0712345678',
    email: 'ana.pop@example.com',
    relationship: 'parinte',
    childName: 'Maria Pop',
    childBirthDate: '2016-03-14',
    membershipAnswer: 'nu',
    submittedAt: '2026-10-03T08:00:00.000Z',
    season: '2026-2027',
    seasonRef: SEASONS[0],
  };
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(app, { recursive: true, force: true });
});

const fileNames = async (strapi: Core.Strapi) => (await listRegistrationDocuments(strapi, ID)).map((d) => d.fileName);

describe('moving a registration to another season', () => {
  it('rebuilds the PDF with the new season, period and file name; the number stays', async () => {
    const strapi = fakeStrapi();
    await buildRegistrationDocuments(strapi, ID);
    expect(await fileNames(strapi)).toEqual(['Maria_Pop_Acord_2026-2027.pdf']);
    await expect(moveRegistrationsToSeason([ID], '2027-2028', seasonMoveDeps(strapi))).resolves.toBe(1);
    const [doc] = await listRegistrationDocuments(strapi, ID);
    expect(doc.fileName).toBe('Maria_Pop_Acord_2027-2028.pdf');
    const { text } = await pdfText(await fs.readFile(doc.path));
    expect(text).toContain('Sezonul 2027-2028');
    expect(text).toContain('Nr. înscriere 2026-0142');
    expect(text).toContain('(octombrie 2027 – mai 2028)');
    expect(row.registrationNumber).toBe('2026-0142');
  });

  it('an unknown season label clears seasonRef and keeps the old PDF, with a logged reason', async () => {
    const strapi = fakeStrapi();
    await buildRegistrationDocuments(strapi, ID);
    await moveRegistrationsToSeason([ID], '2030-2031', seasonMoveDeps(strapi));
    expect(row).toMatchObject({ season: '2030-2031', seasonRef: null });
    expect(await fileNames(strapi)).toEqual(['Maria_Pop_Acord_2026-2027.pdf']);
    expect(logs).toEqual(['[inscrieri] no Sezon is labelled "2030-2031": documents of 1 moved registration(s) not rebuilt']);
  });
});

describe('rebuildAfterEdit (admin PUT)', () => {
  it('does nothing when no printed field changed', async () => {
    await expect(rebuildAfterEdit(fakeStrapi(), ID, { status: 'Contactat' })).resolves.toBeNull();
  });

  it('skips the rebuild with a logged reason when the new season has no Sezon', async () => {
    const strapi = fakeStrapi();
    await expect(rebuildAfterEdit(strapi, ID, { season: '2030-2031', seasonRef: null })).resolves.toEqual({
      ok: false,
      documents: [],
      reason: 'unknown-season',
    });
    expect(logs).toEqual([`[inscrieri] ${ID}: no Sezon is labelled "2030-2031"; documents not rebuilt`]);
    expect(await fileNames(strapi)).toEqual([]);
  });

  it('rebuilds after a season change to a known Sezon', async () => {
    const strapi = fakeStrapi();
    row = { ...row, season: '2027-2028', seasonRef: SEASONS[1] };
    await expect(rebuildAfterEdit(strapi, ID, { season: '2027-2028', seasonRef: 'season2027' })).resolves.toEqual({ ok: true, documents: ['acord'] });
    expect(await fileNames(strapi)).toEqual(['Maria_Pop_Acord_2027-2028.pdf']);
  });
});

describe('two builds of one registration at the same time', () => {
  it('run one after the other, so the folder keeps the newest set (never empty)', async () => {
    const strapi = fakeStrapi();
    const first = buildRegistrationDocuments(strapi, ID);
    row = { ...row, childName: 'Ioana Pop' };
    const second = buildRegistrationDocuments(strapi, ID);
    await Promise.all([first, second]);
    expect(await fileNames(strapi)).toEqual(['Ioana_Pop_Acord_2026-2027.pdf']);
  });

  it('a failed build does not block the next one', async () => {
    const strapi = fakeStrapi();
    const missing = { ...strapi, documents: () => ({ findOne: async () => null }) } as unknown as Core.Strapi;
    await expect(buildRegistrationDocuments(missing, ID)).rejects.toThrow(`Registration ${ID} not found`);
    await buildRegistrationDocuments(strapi, ID);
    expect(await fileNames(strapi)).toEqual(['Maria_Pop_Acord_2026-2027.pdf']);
  });
});
