import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import { setAthleteStatus } from '../../athletes/add-status';
import { searchAthletes } from '../../athletes/confirm-read';
import { confirmRegistration } from '../../athletes/confirm-service';
import { deleteAthlete } from '../../athletes/delete';
import { ADMIN_ERRORS, CONFIRM_ERRORS } from '../../athletes/errors';
import { planMatchUpdates } from '../../athletes/matches';
import { mergeAthletes, mergePreview } from '../../athletes/merge';
import { createAthleteProfile, setAthleteProfileVisibility } from '../../athletes/profile';
import { readAthleteRecord, updateAthlete } from '../../athletes/record';
import type { ServiceContext } from '../../athletes/store';
import { undoConfirmation } from '../../athletes/undo-service';
import { athleteRow, fakeClubStore, registrationRow } from '../../athletes/__tests__/fake-store';
import { RegistrationNotFoundError, buildRegistrationDocuments } from '../../documents/service';

const ANON = athleteRow({ id: 'a9', name: 'Maria Pop', birthDate: '2016-03-14', status: 'anonimizat', profileId: 'sp9' });
const LIVE = athleteRow({ id: 'a1', name: 'Ana Ionescu', birthDate: '2015-01-01' });
const STALE = { ok: false, status: 409, error: ADMIN_ERRORS.stale };

function setup() {
  const fake = fakeClubStore({
    athletes: [ANON, LIVE],
    profiles: [{ id: 'sp9', name: 'x', slug: 'x', previousSlugs: [], showPublicPage: false, published: true }],
    registrations: [
      registrationRow({ id: 'r1' }),
      registrationRow({ id: 'r5', number: '2026-0155', status: 'Confirmat', athleteId: 'a9', membershipAnswer: 'da', confirmation: {
        athleteId: 'a9', createdAthlete: false, previousStatus: 'Nou', athleteStatusBefore: 'activ', fieldsBefore: {}, fieldsAfter: {},
        membershipId: null, demotedMainId: null, promotedMainId: null, acs: null, seasonId: null, at: '2026-10-03T11:22:00.000Z',
      } }),
    ],
  });
  const ctx: ServiceContext = { store: fake.store, actor: 'ana@example.com', today: { year: 2026, month: 10, day: 27 }, log: () => undefined };
  return { fake, ctx };
}

describe('matching and search skip an anonymized athlete (spec 4)', () => {
  it('never matches a new registration, even with the same name and birth date', () => {
    const reg = registrationRow({ id: 'r1' });
    expect(planMatchUpdates([reg], [ANON])).toEqual([{ registrationId: 'r1', patch: { matchAthleteId: null, matchLevel: null, childBirthDateParsed: '2016-03-14' } }]);
    expect(planMatchUpdates([reg], [{ ...ANON, status: 'activ' }])[0].patch.matchAthleteId).toBe('a9');
  });

  it('never patches a registration linked to an anonymized athlete, even a stale one (deploy match-backfill)', () => {
    const stale = registrationRow({ id: 'r5', athleteId: 'a9', matchAthleteId: 'a1', matchLevel: 'probabil', childBirthDateParsed: null });
    expect(planMatchUpdates([stale], [ANON, LIVE])).toEqual([]);
    expect(planMatchUpdates([{ ...stale, athleteId: 'a1' }], [ANON, LIVE])).toHaveLength(1);
  });

  it('never shows in the confirm window search or in "Adaugă sportiv"', async () => {
    const { fake } = setup();
    expect((await searchAthletes(fake.store, 'Maria', null)).map((c) => c.documentId)).toEqual([]);
    expect((await searchAthletes(fake.store, 'Ana', null)).map((c) => c.documentId)).toEqual(['a1']);
  });
});

describe('an anonymized record is read-only (spec 4)', () => {
  it('every write answers 409 and changes nothing', async () => {
    const { fake, ctx } = setup();
    const before = structuredClone(fake.state);
    expect(await updateAthlete(ctx, 'a9', { name: 'X', birthDate: '', contactName: '', phone: '', email: '' })).toEqual(STALE);
    expect(await setAthleteStatus(ctx, 'a9', { status: 'activ' })).toEqual(STALE);
    expect(await createAthleteProfile(ctx, 'a9')).toEqual(STALE);
    expect(await setAthleteProfileVisibility(ctx, 'a9', { on: true })).toEqual(STALE);
    expect(await mergePreview(fake.store, 'a1', 'a9')).toEqual(STALE);
    expect(await mergeAthletes(ctx, { keptId: 'a1', removedId: 'a9', take: [] })).toEqual(STALE);
    expect(await deleteAthlete(ctx, 'a9')).toEqual(STALE);
    expect(fake.state.athletes).toEqual(before.athletes);
    expect(fake.state.history).toEqual([]);
  });

  it('a registration cannot be confirmed onto it, and its confirmation cannot be undone', async () => {
    const { fake, ctx } = setup();
    const request = { choice: 'existing' as const, athleteId: 'a9', groupId: null, makeMain: false, updateFields: null };
    expect(await confirmRegistration(ctx, 'r1', request)).toEqual({ ok: false, status: 400, error: CONFIRM_ERRORS.failed });
    expect(await undoConfirmation(ctx, 'r5')).toEqual(STALE);
    expect(fake.state.registrations.find((r) => r.id === 'r5')?.athleteId).toBe('a9');
  });

  it('its record shows no missing fields, no "Date incomplete" and no documents', async () => {
    const { fake } = setup();
    const record = await readAthleteRecord(fake.store, 'a9', null);
    expect(record).toMatchObject({ status: 'anonimizat', missing: [], dataIncomplete: false, documents: [] });
    expect(record?.registrations.map((r) => r.number)).toEqual(['2026-0155']);
  });
});

describe('no document is rebuilt for an anonymized athlete (spec 4)', () => {
  it('buildRegistrationDocuments refuses and writes no folder', async () => {
    const root = mkdtempSync(join(tmpdir(), 'es3c-docs-'));
    const id = 'reg3canon00000000000001';
    const strapi = {
      dirs: { app: { root } },
      documents: () => ({ findOne: async () => ({ documentId: id, childName: 'Anonimizat', athlete: { status: 'anonimizat' } }) }),
    } as unknown as Core.Strapi;
    const saved = process.env.PRIVATE_FILES_DIR;
    delete process.env.PRIVATE_FILES_DIR;
    try {
      await expect(buildRegistrationDocuments(strapi, id)).rejects.toBeInstanceOf(RegistrationNotFoundError);
    } finally {
      if (saved !== undefined) process.env.PRIVATE_FILES_DIR = saved;
    }
    expect(existsSync(join(root, 'private', 'documents', 'registrations', id))).toBe(false);
  });
});
