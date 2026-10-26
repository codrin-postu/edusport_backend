import { blank, link, t, v, type Run } from './runs';
import type { DocumentValues } from './types';

/**
 * The Cerere de adeziune, word for word from mockups/gen_adeziune.py (adez()), the club's own text
 * (missing diacritics included), with s and t comma below everywhere (user, 2026-10-21: the paper's
 * cedilla letters are converted). Prefilled only from the form answers; address and CNP stay blank
 * lines for paper (DECISIONS 2026-10-05). Blank widths are the mockup's V(...) widths.
 */
export const ADEZIUNE_TITLE = 'Cerere de adeziune';
export const ADEZIUNE_SUBTITLE = 'pentru a deveni Membru sustinator al Asociatiei Clubul Sportiv EduSport';

export type AdeziuneContent = { intro: Run[]; declarations: Run[][]; data: Run[] };

/** "octombrie 2026-mai 2027", as clause 4 prints it. */
export function adeziunePeriod(values: DocumentValues): string | null {
  return values.periodStart && values.periodEnd ? `${values.periodStart}-${values.periodEnd}` : null;
}

function intro(x: DocumentValues): Run[] {
  return [
    t('Subsemnatul/a '), v(x.parentName, 130), t(' cu domiciliul in localitatea '), blank(90), t(', Strada '), blank(110),
    t(', nr '), blank(26), t(' Bl '), blank(26), t(' Sc '), blank(22), t(', Ap '), blank(22), t(', Judet/Sector '), blank(70),
    t(', CNP '), blank(110), t(' e-mail '), v(x.email, 120), t(' telefon '), v(x.phone, 80),
    t(' in calitate de tutore al copilului '), v(x.childName, 130), t(', nascut la data de '), v(x.birthDate, 60),
    t(', va solicit aderarea fiului/fiicei mele ca Membru sustinator al Asociatiei Clubul Sportiv EduSport.'),
  ];
}

const STATUTE = 'Declar pe propria răspundere că am luat la cunoștință de prevederile Statutului și ale Actului Constitutiv ale Asociației pe care le accept fără rezerve, îndeplinesc condițiile necesare pentru a obține statutul de Membru al său, mă angajez să acționez pentru realizarea scopului și obiectivelor Asociației și să respect hotărârile / deciziile conducerii acesteia. Mă voi abține de la orice acțiune care dăunează prestigiului și intereselor Asociației Clubul Sportiv EduSport. Ma angajez sa nu demarez actiuni si/sau luari de pozitie in numele Asocatiei fara a anunta in prealabil conducerea Asociatiei si fara a avea acordul scris al acesteia.';
const FEE_DUTY = 'Mă angajez să achit cotizația anuală stabilită de către Adunarea Generală a Asociației Clubul Sportiv EduSport. Înțeleg că neplata cotizației anuale conform Actului Constitutiv și a Statutului Asociației reprezintă dreptul acesteia de a exclude persoana fizică dintre membrii săi.';
const MEDIA = 'Am luat la cunoștință faptul că Asociația Clubul Sportiv EduSport își rezervă dreptul de a fotografia și înregistra audio-video antrenamentele, cursurile, serbările/spectacolele sau orice alt eveniment organizat de ACS EduSport ori de partenerii acestuia, în care apar membrii, cursanții sau sportivii ACS EduSport, precum și de a utiliza imaginile/filmările în scopul promovării activității ACS EduSport.';
const NEWS = 'Sunt de acord ca datele cu caracter personal și datele mele de contact să fie utilizate pentru a primi materiale informative și/sau înștiințări cu privire la activitatea Asociației Clubul Sportiv EduSport.';
const DATA_USE = 'imi exprim acordul cu privire la utilizarea și prelucrarea datelor mele cu caracter personal de către Asociatia Clubul Sportiv EduSport, cu sediul social: str. Slt. Stanescu Gheorghe, nr. 1, bl. 213, sc. A, et. 10, ap. 42, sect. 2, Bucurest, CIF: 30321550.';

function declarations(x: DocumentValues): Run[][] {
  const fee = [
    t('Am luat la cunoștință faptul că în prezent cotizatia anuala aferenta perioadei '), v(adeziunePeriod(x), 130),
    t(' este de '), v(x.fee, 40), t('.'),
  ];
  return [[t(STATUTE)], [t(FEE_DUTY)], [t(MEDIA)], fee, [t(NEWS)], [t(DATA_USE)]];
}

const DATA: Run[] = [
  t('Acestea vor fi folosite în scopul îndeplinirii obiectivelor ACS EduSport, cu respectarea prevederilor legale, conform regulamentului disponibil pe '),
  link('https://scoaladepatinaj.com/protectia-datelor/'),
];

export const OFFICE = {
  registered: 'Cererea a fost înregistrată cu nr',
  member: 'Membru:',
  admitted: 'admis',
  rejected: 'respins',
  president: 'Președinte Asociatia Clubul Sportiv EduSport',
} as const;

export function adeziuneContent(values: DocumentValues): AdeziuneContent {
  return { intro: intro(values), declarations: declarations(values), data: DATA };
}
