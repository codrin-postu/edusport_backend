import { describe, expect, it } from 'vitest';
import type { CurrentSeason } from '../current-season';
import type { PublicSchool } from '../public-info';
import { LAST_SEASON_OPTIONS, SOURCE_OPTIONS } from '../registration-form-options';
import {
  CHOICE_ERROR,
  MISSING_FIELDS_ERROR,
  REPEAT_WINDOW_MS,
  SUBMIT_ERRORS,
  isRegistrationOpen,
  submitRegistration,
  type RegistrationCreateData,
  type SubmitDeps,
} from '../registration-submit';

const SEASON: CurrentSeason = { documentId: 'season-doc', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 250 };
const SCHOOL: PublicSchool = {
  name: 'Școala de Patinaj - AFI Cotroceni',
  slug: 'afi-cotroceni',
  priceNotes: [],
  priceLists: [
    {
      name: 'Standard',
      items: [
        { name: 'Abonament 8 ședințe grup', kind: 'subscription', sessions: 8, memberPrice: 590, nonMemberPrice: 790, tooltip: null },
        { name: '1 ședință grup', kind: 'session', sessions: null, memberPrice: null, nonMemberPrice: 150, tooltip: null },
      ],
    },
  ],
};
const BODY = {
  email: 'ana.pop@example.com',
  parentName: 'Ana Pop',
  relationship: 'parinte',
  phone: '0712345678',
  childName: 'Maria Pop',
  childBirthDate: '14.03.2016',
  childHeight: '132',
  shirtSize: 'S',
  lastSeason: LAST_SEASON_OPTIONS[0],
  priorExperience: 'Nu este cazul',
  expectations: 'Să învețe să patineze',
  membershipAnswer: 'da',
  subscriptionChoice: { priceItemName: 'Abonament 8 ședințe grup', price: 1, member: false },
  source: SOURCE_OPTIONS[0],
  gdprConsent: true,
  regulationsConsent: true,
};

function fake(over: Partial<SubmitDeps> = {}) {
  const created: { data: RegistrationCreateData; startYear: number }[] = [];
  const errors: string[] = [];
  const deps: SubmitDeps = {
    effectiveRequired: async () => ({}),
    validateBuiltinSelects: async () => null,
    validateFieldFormats: async () => null,
    registrationsEnabled: async () => true,
    findCurrentSeason: async () => SEASON,
    findSections: async () => [
      { documentId: 'sec-school', slug: 'afi-cotroceni', kind: 'school', publicPage: true },
      { documentId: 'sec-club', slug: 'club', kind: 'club', publicPage: false },
    ],
    findSchoolPrices: async () => SCHOOL,
    findRecentRepeat: async () => null,
    createNumbered: async (data, startYear) => {
      created.push({ data, startYear });
      return { documentId: 'reg0000000000000000000001', registrationNumber: '2026-0008' };
    },
    logError: (message) => {
      errors.push(message);
    },
    now: () => new Date('2026-10-19T08:00:00.000Z'),
    ...over,
  };
  return { deps, created, errors };
}

describe('submitRegistration', () => {
  it('saves a numbered registration with server-set season, school and price', async () => {
    const { deps, created } = fake();
    await expect(submitRegistration(BODY, null, deps)).resolves.toEqual({
      ok: true,
      registrationNumber: '2026-0008',
      documentId: 'reg0000000000000000000001',
    });
    expect(created).toEqual([
      {
        startYear: 2026,
        data: {
          email: 'ana.pop@example.com',
          phone: '0712345678',
          parentName: 'Ana Pop',
          relationship: 'parinte',
          childName: 'Maria Pop',
          childBirthDate: '14.03.2016',
          childHeight: 132,
          shirtSize: 'S',
          lastSeason: LAST_SEASON_OPTIONS[0],
          priorExperience: 'Nu este cazul',
          expectations: 'Să învețe să patineze',
          membershipAnswer: 'da',
          subscriptionChoice: { priceItemName: 'Abonament 8 ședințe grup', price: 590, member: true },
          source: SOURCE_OPTIONS[0],
          gdprConsent: true,
          regulationsConsent: true,
          status: 'Nou',
          submittedAt: '2026-10-19T08:00:00.000Z',
          season: '2026-2027',
          seasonRef: 'season-doc',
          section: 'sec-school',
          archived: false,
        },
      },
    ]);
  });

  it('rejects a filled honeypot without saving', async () => {
    const { deps, created } = fake();
    await expect(submitRegistration({ ...BODY, website: 'spam' }, null, deps)).resolves.toEqual({ ok: false, code: 'invalid', error: SUBMIT_ERRORS.invalid });
    expect(created).toEqual([]);
  });

  it('refuses while "Înscrieri deschise" is off, before reading anything else', async () => {
    let seasonRead = false;
    const { deps, created } = fake({
      registrationsEnabled: async () => false,
      findCurrentSeason: async () => {
        seasonRead = true;
        return SEASON;
      },
    });
    await expect(submitRegistration(BODY, null, deps)).resolves.toEqual({ ok: false, code: 'closed', error: SUBMIT_ERRORS.closed });
    expect(seasonRead).toBe(false);
    expect(created).toEqual([]);
  });

  it('refuses when no Sezon is current', async () => {
    let sectionsRead = false;
    const { deps, created } = fake({
      findCurrentSeason: async () => null,
      findSections: async () => {
        sectionsRead = true;
        return [];
      },
    });
    await expect(submitRegistration(BODY, null, deps)).resolves.toEqual({ ok: false, code: 'closed', error: SUBMIT_ERRORS.closed });
    expect(sectionsRead).toBe(false);
    expect(created).toEqual([]);
  });

  it('refuses an unknown ?scoala and the Club', async () => {
    const { deps, created } = fake();
    await expect(submitRegistration(BODY, 'nu-exista', deps)).resolves.toMatchObject({ ok: false, code: 'unknown-school' });
    await expect(submitRegistration(BODY, 'club', deps)).resolves.toMatchObject({ ok: false, code: 'unknown-school' });
    expect(created).toEqual([]);
  });

  it('asks to choose when two schools have a public page and none is named', async () => {
    const { deps } = fake({
      findSections: async () => [
        { documentId: 'a', slug: 'afi-cotroceni', kind: 'school', publicPage: true },
        { documentId: 'b', slug: 'baneasa', kind: 'school', publicPage: true },
      ],
    });
    await expect(submitRegistration(BODY, null, deps)).resolves.toMatchObject({ ok: false, code: 'choose-school' });
  });

  it('refuses missing required answers', async () => {
    const { deps } = fake();
    await expect(submitRegistration({ ...BODY, childHeight: '' }, null, deps)).resolves.toEqual({ ok: false, code: 'invalid', error: MISSING_FIELDS_ERROR });
  });

  it('passes form-config errors through', async () => {
    const { deps } = fake({ validateBuiltinSelects: async () => 'Valoare invalidă pentru câmpul "Sezonul trecut".' });
    await expect(submitRegistration(BODY, null, deps)).resolves.toMatchObject({ ok: false, error: 'Valoare invalidă pentru câmpul "Sezonul trecut".' });
  });

  it('never blocks on a broken form-config service', async () => {
    const broken = async (): Promise<never> => {
      throw new Error('config down');
    };
    const { deps, created } = fake({ effectiveRequired: broken, validateBuiltinSelects: broken });
    await expect(submitRegistration(BODY, null, deps)).resolves.toMatchObject({ ok: true });
    expect(created).toHaveLength(1);
  });

  it('refuses an item not offered to members, and prices it for a non-member', async () => {
    const single = { ...BODY, subscriptionChoice: { priceItemName: '1 ședință grup' } };
    const { deps, created } = fake();
    await expect(submitRegistration(single, null, deps)).resolves.toEqual({ ok: false, code: 'invalid', error: CHOICE_ERROR });
    await expect(submitRegistration({ ...single, membershipAnswer: 'nu' }, null, deps)).resolves.toMatchObject({ ok: true });
    expect(created[0].data.subscriptionChoice).toEqual({ priceItemName: '1 ședință grup', price: 150, member: false });
  });

  it('never validates or stores custom answers (the form has no custom questions)', async () => {
    const { deps, created } = fake();
    await expect(submitRegistration({ ...BODY, extra: { c_old1: 'Răspuns' } }, null, deps)).resolves.toMatchObject({ ok: true });
    expect('extra' in created[0].data).toBe(false);
  });

  it('keeps the follow-up texts only with Alta / Altele', async () => {
    const { deps, created } = fake();
    await submitRegistration({ ...BODY, relationshipOther: 'Bunic', sourceOther: 'Ziar' }, null, deps);
    expect(created[0].data.relationshipOther).toBeUndefined();
    expect(created[0].data.sourceOther).toBeUndefined();

    const other = { ...BODY, relationship: 'alta', relationshipOther: 'Bunic', source: 'Altele', sourceOther: 'Ziar' };
    await submitRegistration(other, null, deps);
    expect(created[1].data.relationshipOther).toBe('Bunic');
    expect(created[1].data.sourceOther).toBe('Ziar');
  });

  it('reports a failed save without details and logs it', async () => {
    const { deps, errors } = fake({
      createNumbered: async () => {
        throw new Error('No free registration number after 6 attempts');
      },
    });
    await expect(submitRegistration(BODY, null, deps)).resolves.toEqual({ ok: false, code: 'save-failed', error: SUBMIT_ERRORS['save-failed'] });
    expect(errors[0]).toContain('No free registration number');
  });

  it('reports save-failed when the "Înscrieri deschise" lookup throws', async () => {
    const { deps, created, errors } = fake({
      registrationsEnabled: async () => {
        throw new Error('db unreachable');
      },
    });
    await expect(submitRegistration(BODY, null, deps)).resolves.toEqual({ ok: false, code: 'save-failed', error: SUBMIT_ERRORS['save-failed'] });
    expect(created).toEqual([]);
    expect(errors[0]).toContain('db unreachable');
  });

  it('reports save-failed when the current-Sezon lookup throws', async () => {
    const { deps, created, errors } = fake({
      findCurrentSeason: async () => {
        throw new Error('db unreachable');
      },
    });
    await expect(submitRegistration(BODY, null, deps)).resolves.toEqual({ ok: false, code: 'save-failed', error: SUBMIT_ERRORS['save-failed'] });
    expect(created).toEqual([]);
    expect(errors[0]).toContain('db unreachable');
  });

  it('reports save-failed when the sections lookup throws', async () => {
    const { deps, created, errors } = fake({
      findSections: async () => {
        throw new Error('db unreachable');
      },
    });
    await expect(submitRegistration(BODY, null, deps)).resolves.toEqual({ ok: false, code: 'save-failed', error: SUBMIT_ERRORS['save-failed'] });
    expect(created).toEqual([]);
    expect(errors[0]).toContain('db unreachable');
  });

  it('reports save-failed when the school-prices lookup throws', async () => {
    const { deps, created, errors } = fake({
      findSchoolPrices: async () => {
        throw new Error('db unreachable');
      },
    });
    await expect(submitRegistration(BODY, null, deps)).resolves.toEqual({ ok: false, code: 'save-failed', error: SUBMIT_ERRORS['save-failed'] });
    expect(created).toEqual([]);
    expect(errors[0]).toContain('db unreachable');
  });
});

describe('isRegistrationOpen', () => {
  it('is closed only when the switch is explicitly off', () => {
    expect(isRegistrationOpen({ open: false, currentSeason: '2026-2027' })).toBe(false);
    expect(isRegistrationOpen({ open: true })).toBe(true);
    expect(isRegistrationOpen({})).toBe(true);
    expect(isRegistrationOpen(null)).toBe(true);
  });
});

type StoredRow = { documentId: string; registrationNumber: string; submissionKey?: string; createdAt: number };

const KEY = '3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d';
const OTHER_KEY = 'a1b2c3d4-e5f6-4a7b-9c8d-0e1f2a3b4c5d';

/** createNumbered and findRecentRepeat over one in-memory table, with a clock the test moves. */
function repeatStore() {
  const rows: StoredRow[] = [];
  const lookups: { key: string; since: Date }[] = [];
  let t = new Date('2026-10-19T08:00:00.000Z').getTime();
  const { deps } = fake({
    now: () => new Date(t),
    createNumbered: async (data) => {
      const row = { documentId: `reg-${rows.length + 1}`, registrationNumber: `2026-000${rows.length + 1}`, submissionKey: data.submissionKey, createdAt: t };
      rows.push(row);
      return row;
    },
    findRecentRepeat: async (key, since) => {
      lookups.push({ key, since });
      const hit = rows.find((r) => r.submissionKey === key && r.createdAt >= since.getTime());
      return hit ? { documentId: hit.documentId, registrationNumber: hit.registrationNumber } : null;
    },
  });
  return { deps, rows, lookups, advance: (ms: number) => (t += ms) };
}

describe('repeat submit', () => {
  const KEYED = { ...BODY, submissionKey: KEY };

  it('answers the same draft key within 10 minutes with the first registration and saves nothing', async () => {
    const store = repeatStore();
    await submitRegistration(KEYED, null, store.deps);
    store.advance(REPEAT_WINDOW_MS - 1);
    await expect(submitRegistration({ ...KEYED, submissionKey: KEY.toUpperCase() }, null, store.deps)).resolves.toEqual({
      ok: true,
      registrationNumber: '2026-0001',
      documentId: 'reg-1',
      repeat: true,
    });
    expect(store.rows).toHaveLength(1);
    expect(REPEAT_WINDOW_MS).toBe(10 * 60_000);
  });

  it('stores the key and looks it up 10 minutes back', async () => {
    const store = repeatStore();
    await submitRegistration(KEYED, null, store.deps);
    expect(store.rows[0].submissionKey).toBe(KEY);
    expect(store.lookups).toEqual([{ key: KEY, since: new Date('2026-10-19T07:50:00.000Z') }]);
  });

  it('saves a new registration for another key, even with the same parent and child', async () => {
    const store = repeatStore();
    await submitRegistration(KEYED, null, store.deps);
    await expect(submitRegistration({ ...KEYED, submissionKey: OTHER_KEY }, null, store.deps)).resolves.toEqual({ ok: true, registrationNumber: '2026-0002', documentId: 'reg-2' });
    expect(store.rows).toHaveLength(2);
  });

  it('never dedupes without a valid key, and stores no invalid one', async () => {
    const store = repeatStore();
    await submitRegistration(BODY, null, store.deps);
    await submitRegistration(BODY, null, store.deps);
    await submitRegistration({ ...BODY, submissionKey: 'not-a-uuid' }, null, store.deps);
    await submitRegistration({ ...BODY, submissionKey: 'not-a-uuid' }, null, store.deps);
    expect(store.rows).toHaveLength(4);
    expect(store.rows.map((r) => r.submissionKey)).toEqual([undefined, undefined, undefined, undefined]);
    expect(store.lookups).toEqual([]);
  });

  it('saves a new registration after 10 minutes', async () => {
    const store = repeatStore();
    await submitRegistration(KEYED, null, store.deps);
    store.advance(REPEAT_WINDOW_MS + 1);
    await expect(submitRegistration(KEYED, null, store.deps)).resolves.toEqual({ ok: true, registrationNumber: '2026-0002', documentId: 'reg-2' });
    expect(store.rows).toHaveLength(2);
  });

  it('never blocks a submit when the lookup fails, and logs it', async () => {
    const { deps, created, errors } = fake({
      findRecentRepeat: async () => {
        throw new Error('db down');
      },
    });
    await expect(submitRegistration(KEYED, null, deps)).resolves.toMatchObject({ ok: true, registrationNumber: '2026-0008' });
    expect(created).toHaveLength(1);
    expect(errors).toEqual(['[inscriere] repeat lookup failed: db down']);
  });
});
