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
  history: [{ at: '2026-10-20T10:00:00.000Z', actor: 'Ana Admin', text: 'Telefon: "0799 000 111" → "0799 123 456"', subject: '' },
    { at: '2026-10-03T11:22:00.000Z', actor: '', text: 'Înscriere înregistrată', subject: '2026-0142' }],
  generatedAt: new Date('2026-10-27T10:00:00.000Z'),
  generatedBy: 'Ana Admin',
};

const rows = (model: ReturnType<typeof buildSummaryModel>, title: string) => model.sections.find((s) => s.title === title)!.blocks.flatMap((b) => b.rows);

describe('summary model (spec 3)', () => {
  const model = buildSummaryModel(INPUT);

  it('sections in the spec order, title with the name, the generated line', () => {
    expect(model.sections.map((s) => s.title)).toEqual(['Sportiv', 'Grupe pe sezoane', 'Membru A.C.S. pe sezoane', 'Înscrieri', 'Istoric']);
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

  it('an empty section says so', () => {
    const empty = buildSummaryModel({ ...INPUT, groups: [], acs: [], registrations: [], history: [] });
    for (const title of ['Grupe pe sezoane', 'Membru A.C.S. pe sezoane', 'Înscrieri', 'Istoric']) expect(rows(empty, title)).toEqual([{ label: '', value: 'Nimic înregistrat.' }]);
  });
});

describe('summary PDF (spec 3)', () => {
  it('reads back every section with the Romanian letters', async () => {
    const { text } = await pdfText(await renderSummaryPdf(buildSummaryModel(INPUT)));
    for (const part of ['Date personale: Ilinca Zamfirescu', 'Grupe pe sezoane', 'Membru A.C.S. pe sezoane', 'Înscrierea 2026-0142', 'Istoric',
      '0799 123 456', 'Document indisponibil', 'Generat la 27.10.2026, 12:00, de Ana Admin.', 'C.I.F.: 30321550']) {
      expect(text).toContain(part);
    }
    for (const letter of ['ș', 'ț', 'ă', 'î', 'Î']) expect(text).toContain(letter);
  });

  it('a long Istoric flows onto more pages, every line kept', async () => {
    const history = Array.from({ length: 120 }, (_, i) => ({ at: '2026-10-20T10:00:00.000Z', actor: 'Ana Admin', text: `Linia ${i + 1}`, subject: '' }));
    const { pages, text } = await pdfText(await renderSummaryPdf(buildSummaryModel({ ...INPUT, history })));
    expect(pages).toBeGreaterThan(1);
    expect(text).toContain('Linia 1 ');
    expect(text).toContain('Linia 120');
  });
});
