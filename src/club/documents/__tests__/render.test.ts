import { describe, expect, it, vi } from 'vitest';
import { renderDocument } from '../pdf/render';
import type { DocumentSeason } from '../types';
import { blankValues, registrationValues } from '../values';
import { pdfText } from './pdf-text';

// Each Acord render tries a few body sizes (about 0.4 s alone, several seconds when the whole suite runs in parallel).
vi.setConfig({ testTimeout: 30_000 });

const SEASON: DocumentSeason = { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270 };
const ROW = {
  documentId: 'reg0000000000000000000001',
  registrationNumber: '2026-0142',
  parentName: 'Mihaela Dumitrescu',
  phone: '0723 456 789',
  email: 'parinte@exemplu.ro',
  relationship: 'parinte',
  childName: 'Ștefania Țăranu-Bâlă',
  childBirthDate: '2014-03-14',
  membershipAnswer: 'da',
  submittedAt: '2026-10-03T08:00:00.000Z',
};
const FILLED = registrationValues(ROW, SEASON);
const LONG = registrationValues(
  {
    ...ROW,
    parentName: 'Alexandra-Maria Constantinescu-Dumitrescu Popescu',
    email: 'alexandra.maria.constantinescu.dumitrescu@exemplu-foarte-lung.ro',
    relationship: 'alta',
    relationshipOther: 'Bunică din partea mamei, cu acordul ambilor părinți',
    childName: 'Ștefan-Alexandru Constantinescu-Dumitrescu Popescu',
  },
  SEASON,
);

describe('Acord PDF', () => {
  it('is one A4 page with the approved text, the typo fixes and the Romanian letters', async () => {
    const { pages, text } = await pdfText(await renderDocument('acord', FILLED));
    expect(pages).toBe(1);
    expect(text).toContain('Formular de înscriere – Școala de Patinaj EduSport');
    expect(text).toContain('Sezonul 2026-2027');
    expect(text).toContain('Nr. înscriere 2026-0142');
    expect(text).toContain('Subsemnatul/a Mihaela Dumitrescu, telefon 0723 456 789, e-mail parinte@exemplu.ro, in calitate de Părinte al copilului Ștefania Țăranu-Bâlă, născut/ă la data de 14.03.2014, doresc ca Ștefania Țăranu-Bâlă să participe la cursurile');
    expect(text).toContain('disponibil la www.scoaladepatinaj.com/cursuri/regulament Regulamentele se completează, după caz, cu prevederile legale în vigoare.');
    expect(text).toContain('Tarifele pot suferi modificări pe durata acordului (octombrie 2026 – mai 2027), cu informarea prealabilă');
    expect(text).toContain('Înțeleg că abonamentele sunt valabile timp de 4 săptămâni de la data primei ședințe');
    expect(text).toContain('Prin prezenta, confirm că am citit și accept conținutul acestui document și îmi asum toate declarațiile incluse.');
    expect(text).toContain('DATA SEMNĂTURA 03.10.2026');
    expect(text).toMatch(/ș.*ț.*ă.*î.*â/s);
    for (const typo of ['nascut', 'sa particip/e', 'dupa caz', 'Semnatura', 'SEMNATURA']) expect(text).not.toContain(typo);
  });

  it('carries the 4-column legal footer and the O.G. 26/2000 sentence', async () => {
    const { text } = await pdfText(await renderDocument('acord', FILLED));
    // the column titles are letter-spaced, so pdf.js splits their letters
    expect(text.replace(/ /g, '')).toContain('SEDIULSOCIALDATEDEÎNREGISTRARECONTCONTACT');
    for (const part of ['C.I.F.: 30321550', 'C.I.S.: B/A2/00159/2012', 'RO89 INGB 0000 9999 0318 6729', 'Facebook: facebook.com/EduSportClub', 'O.G. nr.26/2000']) {
      expect(text).toContain(part);
    }
  });

  it('stays one page with very long answers', async () => {
    const { pages, text } = await pdfText(await renderDocument('acord', LONG));
    expect(pages).toBe(1);
    expect(text).toContain('Bunică din partea mamei');
  });

  it('an old registration (no Sezon link, no relationship, no number) still gets a one-page Acord with blank lines', async () => {
    const old = registrationValues({ documentId: 'reg0000000000000000000003', parentName: 'Părinte Vechi', childName: 'Copil Vechi', season: '2025-2026' }, null);
    const { pages, text } = await pdfText(await renderDocument('acord', old));
    expect(pages).toBe(1);
    expect(text).toContain('Sezonul 2025-2026');
    expect(text).toContain('Subsemnatul/a Părinte Vechi, telefon, e-mail, in calitate de al copilului Copil Vechi');
  });

  it('blank form: season and period printed, no personal data, no number, no date', async () => {
    const { pages, text } = await pdfText(await renderDocument('acord', blankValues(SEASON)));
    expect(pages).toBe(1);
    expect(text).toContain('Sezonul 2026-2027');
    expect(text).toContain('(octombrie 2026 – mai 2027)');
    expect(text).not.toMatch(/2026-0\d{3}|03\.10\.2026|Dumitrescu/);
  });
});

/** s and t with a cedilla (U+015E, U+015F, U+0162, U+0163): the documents use the comma below only. */
const CEDILLA = new RegExp(`[${String.fromCharCode(0x15e, 0x15f, 0x162, 0x163)}]`);

describe('Romanian letters', () => {
  it('prints s and t with the comma below only, in both documents and the blank forms (user, 2026-10-21)', async () => {
    for (const kind of ['acord', 'adeziune'] as const) {
      for (const values of [FILLED, blankValues(SEASON)]) {
        const { text } = await pdfText(await renderDocument(kind, values));
        expect(text).not.toMatch(CEDILLA);
        expect(text).toContain('Asociația Clubul Sportiv EduSport este persoană juridică');
      }
    }
  });
});

describe('Cerere de adeziune PDF', () => {
  it('is one page, prefilled only from the form; address and CNP stay blank', async () => {
    const { pages, text } = await pdfText(await renderDocument('adeziune', FILLED));
    expect(pages).toBe(1);
    expect(text).toContain('Cerere de adeziune pentru a deveni Membru sustinator al Asociatiei Clubul Sportiv EduSport');
    expect(text).toContain('Subsemnatul/a Mihaela Dumitrescu cu domiciliul in localitatea, Strada, nr Bl Sc, Ap, Judet/Sector, CNP e-mail parinte@exemplu.ro telefon 0723 456 789 in calitate de tutore al copilului Ștefania Țăranu-Bâlă, nascut la data de 14.03.2014');
    expect(text).toContain('cotizatia anuala aferenta perioadei octombrie 2026-mai 2027 este de 270 ron.');
    expect(text).toContain('Cererea a fost înregistrată cu nr / Membru: admis respins Președinte Asociatia Clubul Sportiv EduSport');
    expect(text).toContain('O.G. nr.26/2000');
  });

  it('blank form: period and fee printed, nothing personal', async () => {
    const { pages, text } = await pdfText(await renderDocument('adeziune', blankValues(SEASON)));
    expect(pages).toBe(1);
    expect(text).toContain('perioadei octombrie 2026-mai 2027 este de 270 ron.');
    expect(text).not.toMatch(/Mihaela|parinte@|2026-0142/);
  });

  it('stays one page with very long answers', async () => {
    expect((await pdfText(await renderDocument('adeziune', LONG))).pages).toBe(1);
  });
});
