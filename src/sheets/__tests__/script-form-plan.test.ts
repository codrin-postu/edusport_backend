import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { inscrieriPlan, inscrieriTabPlans } from '../matrix';
import type { RowLike } from '../matrix';
import { SCRIPT_FORM_COLS, isScriptFormRow } from '../script-form';
import { REGISTRY } from '../../api/form-config/registry';
import { installStrapi } from './fakes.test.helper';

const tabFor = (r: RowLike) => (typeof r.season === 'string' && r.season ? r.season : 'fara-sezon');

const OLD_ROW: RowLike = {
  documentId: 'doc-old',
  season: '2025-2026',
  submittedAt: '2025-09-14T15:02:00.000Z',
  status: 'Confirmat',
  childName: 'Ana Bălan',
  level: 'Incepatori',
  clubInterest: true,
  extra: { retired: 'x' },
};

const NEW_ROW: RowLike = {
  documentId: 'doc-new',
  season: '2026-2027',
  registrationNumber: '2026-0142',
  submittedAt: '2026-10-03T11:22:00.000Z',
  status: 'Nou',
  section: { name: 'AFI Cotroceni' },
  email: 'parinte@exemplu.ro',
  parentName: 'Mihaela Dumitrescu',
  relationship: 'parinte',
  relationshipOther: null,
  phone: '0722111222',
  childName: 'Maria Dumitrescu',
  childBirthDate: '14.03.2014',
  childHeight: 142,
  shirtSize: 'S',
  lastSeason: 'Începători',
  priorExperience: 'Patinaj înainte, frânare',
  expectations: 'Să învețe piruete',
  membershipAnswer: 'da',
  subscriptionChoice: { priceItemName: 'Abonament 8', price: 300, member: true },
  source: 'Recomandare',
  sourceOther: null,
  gdprConsent: true,
  regulationsConsent: true,
  extra: {},
};

/** The approved screen decisions-1-5.html (option A), with the columns it does not show in its style. */
const SCRIPT_HEADER = [
  'Nr. înscriere', 'Trimis la', 'Stare', 'Școală', 'Adresă de e-mail', 'Persoana care completează',
  'Calitatea față de sportiv', 'Altă calitate', 'Telefon de contact', 'Numele copilului', 'Data nașterii',
  'Înălțimea (cm)', 'Măsura bluză', 'Sezonul trecut', 'Nivel de experiență', 'Așteptări', 'Membru A.C.S.',
  'La primul modul', 'De unde ați aflat', 'Altă sursă', 'Acord GDPR', 'Acord Regulament', 'Notă internă',
  'Document', 'E-mail', 'ID',
];

/** The 2026-2027 columns of the approved screen, in its order (its E-mail column is plan 2F's). */
const SCREEN_ORDER = [
  'Nr. înscriere', 'Trimis la', 'Stare', 'Adresă de e-mail', 'Persoana care completează', 'Calitatea față de sportiv',
  'Telefon de contact', 'Numele copilului', 'Data nașterii', 'Înălțimea (cm)', 'Măsura bluză', 'Sezonul trecut',
  'Nivel de experiență', 'Așteptări', 'Membru A.C.S.', 'La primul modul', 'De unde ați aflat', 'Acord GDPR',
  'Acord Regulament', 'Document', 'E-mail',
];

describe('which columns a season tab gets', () => {
  beforeEach(() => installStrapi([]));

  it('recognises a row from the new form by its stored membership answer', () => {
    expect(isScriptFormRow({ membershipAnswer: 'da' })).toBe(true);
    expect(isScriptFormRow({ membershipAnswer: 'nu' })).toBe(true);
    expect(isScriptFormRow({ membershipAnswer: null })).toBe(false);
    expect(isScriptFormRow({})).toBe(false);
    expect(isScriptFormRow({ membershipAnswer: 'Da' })).toBe(false);
  });

  it('gives a tab with new-form rows the script form columns and keeps the old tabs as they are', async () => {
    const noSeason: RowLike = { ...OLD_ROW, documentId: 'doc-x', season: null, extra: {} };
    const plans = await inscrieriTabPlans([OLD_ROW, noSeason, NEW_ROW], tabFor);
    const today = await inscrieriPlan([OLD_ROW, noSeason]);
    expect(plans.forTab('2026-2027').header).toEqual(SCRIPT_HEADER);
    expect(plans.forTab('2025-2026').header).toEqual(today.header);
    expect(plans.forTab('fara-sezon').header).toEqual(today.header);
    expect(plans.forTab('2024-2025').header).toEqual(today.header);
  });

  it('switches a tab as soon as one of its rows comes from the new form, with no season list', async () => {
    const later = { ...NEW_ROW, documentId: 'doc-later', season: '2031-2032' };
    const plans = await inscrieriTabPlans([OLD_ROW, later], tabFor);
    expect(plans.forTab('2031-2032').header).toEqual(SCRIPT_HEADER);
    expect(plans.forTab('2025-2026').header[0]).toBe('Trimis la');
  });

  it('never adds a new-form custom answer to the old tabs', async () => {
    const answered = { ...NEW_ROW, extra: { tricouMarime: 'M' } };
    const plans = await inscrieriTabPlans([OLD_ROW, answered], tabFor);
    expect(plans.forTab('2025-2026').header).not.toContain('tricouMarime (eliminata)');
    expect(plans.forTab('2026-2027').header).toContain('tricouMarime (eliminata)');
    expect(plans.forTab('2026-2027').header.slice(-4)).toEqual(['Notă internă', 'Document', 'E-mail', 'ID']);
  });
});

describe('a new-form row in its season tab', () => {
  const saved = process.env.CMS_PUBLIC_URL;
  beforeEach(() => {
    installStrapi([]);
    process.env.CMS_PUBLIC_URL = 'https://cms.example.ro/';
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.CMS_PUBLIC_URL;
    else process.env.CMS_PUBLIC_URL = saved;
  });

  it('prints codes as the form shows them, Da/Nu for yes/no answers, the note and the registration address', async () => {
    const plan = (await inscrieriTabPlans([NEW_ROW], tabFor)).forTab('2026-2027');
    expect(plan.row({ ...NEW_ROW, internalNote: 'Sună după 18' })).toEqual([
      '2026-0142', '2026-10-03T11:22:00.000Z', 'Nou', 'AFI Cotroceni', 'parinte@exemplu.ro', 'Mihaela Dumitrescu',
      'Părinte', '', '0722111222', 'Maria Dumitrescu', '14.03.2014', '142', 'S', 'Începători',
      'Patinaj înainte, frânare', 'Să învețe piruete', 'Da', 'Abonament 8', 'Recomandare', '', 'Da', 'Da',
      'Sună după 18', 'https://cms.example.ro/admin/plugins/edusport-inscrieri?q=2026-0142&season=all', 'Niciun e-mail trimis', 'doc-new',
    ]);
  });

  it('prints Tutore Legal, Alta with its text, Nu, and a refused consent', async () => {
    const other = {
      ...NEW_ROW,
      relationship: 'alta',
      relationshipOther: 'Bunic',
      membershipAnswer: 'nu',
      source: 'Altele',
      sourceOther: 'Afiș',
      gdprConsent: false,
    };
    const plan = (await inscrieriTabPlans([other], tabFor)).forTab('2026-2027');
    const cells = Object.fromEntries(plan.header.map((h, i) => [h, plan.row(other)[i]]));
    expect(cells['Calitatea față de sportiv']).toBe('Alta');
    expect(cells['Altă calitate']).toBe('Bunic');
    expect(cells['Membru A.C.S.']).toBe('Nu');
    expect(cells['Altă sursă']).toBe('Afiș');
    expect(cells['Acord GDPR']).toBe('Nu');
    expect(plan.row({ ...NEW_ROW, relationship: 'tutore' })[6]).toBe('Tutore Legal');
  });

  it('leaves the Document cell empty when the CMS address is not configured', async () => {
    delete process.env.CMS_PUBLIC_URL;
    const plan = (await inscrieriTabPlans([NEW_ROW], tabFor)).forTab('2026-2027');
    expect(plan.row(NEW_ROW).at(-3)).toBe('');
  });

  it('shows an old-form row moved into a new season with the answers both forms share', async () => {
    const moved = { ...OLD_ROW, documentId: 'doc-moved', season: '2026-2027', email: 'a@b.ro', phone: '0700' };
    const plan = (await inscrieriTabPlans([NEW_ROW, moved], tabFor)).forTab('2026-2027');
    const cells = Object.fromEntries(plan.header.map((h, i) => [h, plan.row(moved)[i]]));
    expect(cells['Numele copilului']).toBe('Ana Bălan');
    expect(cells['Adresă de e-mail']).toBe('a@b.ro');
    expect(cells['Membru A.C.S.']).toBe('');
    expect(cells['Școală']).toBe('');
    expect(cells.Document).toBe('');
  });

  it('types the columns for the sheet: dates, contacts, long texts, Da/Nu, the status', async () => {
    const plan = (await inscrieriTabPlans([NEW_ROW], tabFor)).forTab('2026-2027');
    const types = Object.fromEntries(plan.header.map((h, i) => [h, plan.types[i]]));
    expect(types['Trimis la']).toBe('datetime');
    expect(types.Stare).toBe('status');
    expect(types['Data nașterii']).toBe('date');
    expect(types['Adresă de e-mail']).toBe('email');
    expect(types['Telefon de contact']).toBe('tel');
    expect(types['Așteptări']).toBe('longtext');
    expect(types['Notă internă']).toBe('longtext');
    expect(types.Document).toBe('link');
    expect(types['Membru A.C.S.']).toBe('bool');
    expect(types['Acord Regulament']).toBe('bool');
    expect(types.ID).toBe('id');
  });
});

describe('titles and order', () => {
  it('follow the approved screen, with the extra columns in their places', async () => {
    installStrapi([]);
    const header = (await inscrieriTabPlans([NEW_ROW], tabFor)).forTab('2026-2027').header;
    expect(header.filter((h) => SCREEN_ORDER.includes(h))).toEqual(SCREEN_ORDER);
  });

  it('ask the questions in the script form order (2A registry)', () => {
    const registryOrder = REGISTRY.inscriere.steps.flatMap((s) => s.questions.map((x) => x.key));
    expect(SCRIPT_FORM_COLS.map((c) => c.key).filter((k) => k !== 'section')).toEqual(registryOrder);
  });

  it('never use an em dash, a middle dot or a cedilla', () => {
    const all = JSON.stringify(SCRIPT_FORM_COLS.map((c) => c.label));
    expect(all).not.toMatch(/[—·şţŞŢ]/);
  });
});
