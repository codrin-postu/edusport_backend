import { describe, expect, it, vi } from 'vitest';
import { pdfText } from '../../documents/__tests__/pdf-text';
import { buildSummaryModel, type SummaryInput } from '../summary-model';
import { renderSummaryPdf } from '../summary-pdf';

vi.setConfig({ testTimeout: 30_000 });

const RECORD = {
  documentId: 'r1', registrationNumber: '2026-0142', status: 'Confirmat', childName: 'Ilinca Zamfirescu', childBirthDate: '27.04.2013',
  parentName: 'Dana Zamfirescu', relationship: 'parinte', phone: '0799 123 456', email: 'dana@example.com', childHeight: 142, shirtSize: 'S',
  lastSeason: 'Începători', priorExperience: 'Pași înainte', expectations: 'Să sară', membershipAnswer: 'da', source: 'Facebook',
  gdprConsent: true, regulationsConsent: true, submittedAt: '2026-10-03T11:22:00.000Z',
};

const INPUT: SummaryInput = {
  athlete: { name: 'Ilinca Zamfirescu', birthDate: '2013-04-27', contactName: 'Dana Zamfirescu', phone: '0799 123 456', email: 'dana@example.com', status: 'activ', notes: 'Alergie la polen' },
  groups: [{ season: '2026-2027', group: 'Începători', main: true }, { season: '2026-2027', group: 'Club', main: false }],
  acs: [{ season: '2026-2027', state: 'da' }],
  registrations: [{ number: '2026-0142', record: RECORD, seasonLabel: '2026-2027', sectionName: 'Școala de patinaj', missingDocuments: ['adeziune'] }],
  history: [{ at: '2026-10-20T10:00:00.000Z', actor: 'Ana Admin', text: 'Telefon: "0799 000 111" → "0799 123 456"', subject: '', action: 'updated', changes: {} },
    { at: '2026-10-03T11:22:00.000Z', actor: '', text: 'Înscriere înregistrată', subject: '2026-0142', action: 'submitted', changes: {} }],
  presence: { attendance: ['7 noi 2026, Începători, 11:00, Grup'], lessons: ['28 oct 2026, 18:00, 50 min, antrenor Virgil Pascu, prezent, 80 RON'], subscriptions: [], payments: ['27 oct 2026, 320 RON, Numerar, Altceva'] },
  childNames: new Set(['ilinca zamfirescu']),
  generatedAt: new Date('2026-10-27T10:00:00.000Z'),
  generatedBy: 'Ana Admin',
};

const rows = (model: ReturnType<typeof buildSummaryModel>, title: string) => model.sections.find((s) => s.title === title)!.blocks.flatMap((b) => b.rows);

describe('summary model (spec 3)', () => {
  const model = buildSummaryModel(INPUT);

  it('leaves out lines only about another child: a dismissed pair, a link to a record by a name the child never carried', () => {
    const line = (action: string, text: string, changes: Record<string, unknown>) => ({ at: '2026-10-20T10:00:00.000Z', actor: 'Ana Admin', text, subject: '', action, changes });
    const history = [
      line('duplicate-dismissed', 'Nu e același copil cu Maria Ionescu', { name: 'Maria Ionescu', otherAthleteId: 'a2' }),
      line('athlete-unlinked', 'Legătură ștearsă: sportivul Ana Popescu a fost șters', { name: 'Ana Popescu' }),
      line('confirmed', 'Confirmat. Fișa existentă folosită (Ana Popescu); fără grupă.', { athleteName: 'Ana Popescu', createdAthlete: false }),
      line('confirmed', 'Confirmat. Fișa existentă folosită (Zamfirescu Ilinca); fără grupă.', { athleteName: 'Zamfirescu Ilinca', createdAthlete: false }),
      line('merged', 'Unit cu Ilinca Zamfirescu', { name: 'Ilinca Zamfirescu' }),
    ];
    const kept = rows(buildSummaryModel({ ...INPUT, history }), 'Istoric').map((r) => r.value);
    expect(kept).toEqual(['Confirmat. Fișa existentă folosită (Zamfirescu Ilinca); fără grupă.', 'Unit cu Ilinca Zamfirescu']);
  });

  it('sections in the spec order, title with the name, the generated line', () => {
    expect(model.sections.map((s) => s.title)).toEqual(['Sportiv', 'Grupe pe sezoane', 'Membru A.C.S. pe sezoane', 'Înscrieri', 'Istoric', 'Prezență', 'Lecții individuale', 'Abonamente', 'Plăți']);
    expect(model.title).toBe('Date personale');
    expect(model.name).toBe('Ilinca Zamfirescu');
    expect(model.footer).toBe('Generat la 27.10.2026, 12:00, de Ana Admin.');
  });

  it('Sportiv: name, birth date, contact, phone, e-mail, status, notes', () => {
    expect(rows(model, 'Sportiv')).toEqual([
      { label: 'Nume și prenume', value: 'Ilinca Zamfirescu' }, { label: 'Data nașterii', value: '27.04.2013' },
      { label: 'Persoana de contact', value: 'Dana Zamfirescu' }, { label: 'Telefon', value: '0799 123 456' },
      { label: 'E-mail', value: 'dana@example.com' }, { label: 'Status', value: 'Activ' }, { label: 'Note', value: 'Alergie la polen' },
    ]);
  });

  it('groups with the main one marked; A.C.S. in words', () => {
    expect(rows(model, 'Grupe pe sezoane')).toEqual([{ label: '2026-2027', value: 'Începători, principală' }, { label: '2026-2027', value: 'Club' }]);
    expect(rows(model, 'Membru A.C.S. pe sezoane')).toEqual([{ label: '2026-2027', value: 'Da' }]);
  });

  it('each registration: number, season, school, status, every Date tab answer, consents, submitted at, missing documents', () => {
    const block = model.sections.find((s) => s.title === 'Înscrieri')!.blocks[0];
    expect(block.heading).toBe('Înscrierea 2026-0142');
    const byLabel = Object.fromEntries(block.rows.map((r) => [r.label, r.value]));
    expect(byLabel).toMatchObject({
      Sezon: '2026-2027', Școala: 'Școala de patinaj', Status: 'Confirmat', 'Numele copilului': 'Ilinca Zamfirescu', 'Telefon de contact': '0799 123 456',
      'Înălțimea copilului (cm)': '142', 'Trimisă la': '03.10.2026, 14:22', 'Cerere de adeziune': 'Document indisponibil',
    });
    expect(block.rows.filter((r) => r.value === 'Da').length).toBeGreaterThanOrEqual(2);
  });

  it('Istoric: date and actor, then the line; registration lines name the registration', () => {
    expect(rows(model, 'Istoric')).toEqual([
      { label: '20 oct 2026, 13:00, Ana Admin', value: 'Telefon: "0799 000 111" → "0799 123 456"' },
      { label: '3 oct 2026, 14:22', value: 'Înscrierea 2026-0142: Înscriere înregistrată' },
    ]);
  });

  it('presence lines are rows with an empty label', () => {
    expect(rows(model, 'Prezență')).toEqual([{ label: '', value: '7 noi 2026, Începători, 11:00, Grup' }]);
    expect(rows(model, 'Plăți')).toEqual([{ label: '', value: '27 oct 2026, 320 RON, Numerar, Altceva' }]);
    expect(rows(model, 'Abonamente')).toEqual([{ label: '', value: 'Nimic înregistrat.' }]);
  });

  it('an empty section says so', () => {
    const empty = buildSummaryModel({ ...INPUT, groups: [], acs: [], registrations: [], history: [], presence: { attendance: [], lessons: [], subscriptions: [], payments: [] } });
    for (const title of ['Grupe pe sezoane', 'Membru A.C.S. pe sezoane', 'Înscrieri', 'Istoric', 'Prezență', 'Lecții individuale', 'Abonamente', 'Plăți']) expect(rows(empty, title)).toEqual([{ label: '', value: 'Nimic înregistrat.' }]);
  });
});

describe('summary PDF (spec 3)', () => {
  it('reads back every section with the Romanian letters', async () => {
    const { text } = await pdfText(await renderSummaryPdf(buildSummaryModel(INPUT)));
    for (const part of ['Date personale: Ilinca Zamfirescu', 'Grupe pe sezoane', 'Membru A.C.S. pe sezoane', 'Înscrierea 2026-0142', 'Istoric',
      '0799 123 456', 'Document indisponibil', 'Lecții individuale', 'antrenor Virgil Pascu', 'Generat la 27.10.2026, 12:00, de Ana Admin.', 'C.I.F.: 30321550']) {
      expect(text).toContain(part);
    }
    for (const letter of ['ș', 'ț', 'ă', 'î', 'Î']) expect(text).toContain(letter);
  });

  it('a long Istoric flows onto more pages, every line kept', async () => {
    const history = Array.from({ length: 120 }, (_, i) => ({ at: '2026-10-20T10:00:00.000Z', actor: 'Ana Admin', text: `Linia ${i + 1}`, subject: '', action: 'updated', changes: {} }));
    const { pages, text } = await pdfText(await renderSummaryPdf(buildSummaryModel({ ...INPUT, history })));
    expect(pages).toBeGreaterThan(1);
    expect(text).toContain('Linia 1 ');
    expect(text).toContain('Linia 120');
  });
});
