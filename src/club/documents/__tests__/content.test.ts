import { describe, expect, it } from 'vitest';
import { ACORD_TITLE, REGULAMENT_LINK, acordContent } from '../acord-content';
import { ADEZIUNE_TITLE, OFFICE, adeziuneContent } from '../adeziune-content';
import { ASSOCIATION_FOOTER } from '../association';
import { runsText } from '../runs';
import type { DocumentValues } from '../types';

const VALUES: DocumentValues = {
  registrationNumber: '2026-0142',
  parentName: 'Mihaela Dumitrescu',
  phone: '07xx xxx xxx',
  email: 'parinte@exemplu.ro',
  relationship: 'Părinte',
  childName: 'Maria Dumitrescu',
  birthDate: '14.03.2014',
  date: '03.10.2026',
  season: '2026-2027',
  periodStart: 'octombrie 2026',
  periodEnd: 'mai 2027',
  fee: '270 ron',
};
const acordText = () => {
  const c = acordContent(VALUES);
  return [c.intro, c.consent, ...c.clauses.map((cl) => cl.runs), c.marketing, c.closing].map(runsText).join(' ');
};

describe('Acord text (document-v4, DECISIONS 2026-10-03 and 2026-10-05)', () => {
  it('has the approved title and the 2026-10-05 typo fixes', () => {
    expect(ACORD_TITLE).toBe('Formular de înscriere – Școala de Patinaj EduSport');
    const text = acordText();
    expect(text).toContain('Maria Dumitrescu, născut/ă la data de 14.03.2014, doresc ca Maria Dumitrescu să participe la cursurile');
    expect(text).toContain('Regulamentele se completează, după caz, cu prevederile');
    for (const typo of ['nascut', 'sa particip/e', 'dupa caz']) expect(text).not.toContain(typo);
  });

  it('has clauses a to i, only f in bold, the regulament link in c and the Sezon period in g', () => {
    const { clauses } = acordContent(VALUES);
    expect(clauses.map((c) => c.letter)).toEqual(['a.', 'b.', 'c.', 'd.', 'e.', 'f.', 'g.', 'h.', 'i.']);
    expect(clauses.filter((c) => c.bold).map((c) => c.letter)).toEqual(['f.']);
    expect(clauses[2].runs).toContainEqual({ text: REGULAMENT_LINK, style: 'link' });
    expect(REGULAMENT_LINK).toBe('www.scoaladepatinaj.com/cursuri/regulament');
    expect(runsText(clauses[6].runs)).toContain('(octombrie 2026 – mai 2027)');
  });

  it('prints blank lines, not values, for missing answers', () => {
    const { intro } = acordContent({ ...VALUES, parentName: null, relationship: null });
    expect(intro[1]).toEqual({ blank: 108 });
    expect(intro[7]).toEqual({ blank: 60 });
  });
});

describe('Cerere de adeziune text (gen_adeziune.py)', () => {
  it('prefills only form answers; address and CNP are blank lines', () => {
    const { intro } = adeziuneContent(VALUES);
    expect(ADEZIUNE_TITLE).toBe('Cerere de adeziune');
    expect(runsText(intro)).toBe(
      'Subsemnatul/a Mihaela Dumitrescu cu domiciliul in localitatea , Strada , nr  Bl  Sc , Ap , Judet/Sector , CNP  e-mail parinte@exemplu.ro telefon 07xx xxx xxx in calitate de tutore al copilului Maria Dumitrescu, nascut la data de 14.03.2014, va solicit aderarea fiului/fiicei mele ca Membru sustinator al Asociatiei Clubul Sportiv EduSport.',
    );
    expect(intro.filter((r) => 'blank' in r)).toHaveLength(8);
  });

  it('reads the period and the annual fee from the Sezon', () => {
    const { declarations } = adeziuneContent(VALUES);
    expect(declarations).toHaveLength(6);
    expect(runsText(declarations[3])).toBe('Am luat la cunoștință faptul că în prezent cotizatia anuala aferenta perioadei octombrie 2026-mai 2027 este de 270 ron.');
  });
});

it('uses s and t with the comma below only (user, 2026-10-21)', () => {
  const cedilla = new RegExp(`[${String.fromCharCode(0x15e, 0x15f, 0x162, 0x163)}]`);
  const { intro, declarations, data } = adeziuneContent(VALUES);
  for (const runs of [intro, ...declarations, data]) expect(runsText(runs)).not.toMatch(cedilla);
  expect(ASSOCIATION_FOOTER.legal).not.toMatch(cedilla);
  expect(OFFICE.president).toBe('Președinte Asociatia Clubul Sportiv EduSport');
  expect(runsText(declarations[0])).toContain('am luat la cunoștință de prevederile Statutului și ale Actului Constitutiv ale Asociației');
});

it('the footer carries the association details of the approved mockups', () => {
  expect(ASSOCIATION_FOOTER.registration).toEqual(['C.I.F.: 30321550', 'C.I.S.: B/A2/00159/2012', 'nr. inreg. in Reg. Asoc. si Fundatiilor: 65/18.05.2012']);
  expect(ASSOCIATION_FOOTER.account[0]).toBe('RO89 INGB 0000 9999 0318 6729');
  expect(ASSOCIATION_FOOTER.legal).toContain('O.G. nr.26/2000');
});
