import { b, bi, link, t, v, type Run } from './runs';
import type { DocumentValues } from './types';

/**
 * The Acord, word for word from mockups/screens/document-v4.html ("Propus"), with the
 * 2026-10-05 typo fixes ("născut/ă", "să participe", "după caz", "Semnătura") and the
 * regulament link of 2026-10-03. Blank widths are the mockup's blank() widths (gen_adeziune.py).
 */
export const ACORD_TITLE = 'Formular de înscriere – Școala de Patinaj EduSport';

export type Clause = { letter: string; runs: Run[]; bold: boolean };

export type AcordContent = {
  intro: Run[];
  consent: Run[];
  clauses: Clause[];
  marketing: Run[];
  closing: Run[];
};

/** "octombrie 2026 – mai 2027", as clause g prints it. */
export function acordPeriod(values: DocumentValues): string | null {
  return values.periodStart && values.periodEnd ? `${values.periodStart} – ${values.periodEnd}` : null;
}

function intro(x: DocumentValues): Run[] {
  return [
    t('Subsemnatul/a '), v(x.parentName, 108), t(', telefon '), v(x.phone, 72), t(', e-mail '), v(x.email, 108),
    t(', in calitate de '), v(x.relationship, 60), t(' al copilului '), v(x.childName, 96),
    t(', născut/ă la data de '), v(x.birthDate, 60), t(', doresc ca '), v(x.childName, 96),
    t(' să participe la cursurile organizate de Asociatia Clubul Sportiv EduSport.'),
  ];
}

function consent(x: DocumentValues): Run[] {
  return [
    t('Îmi exprim acordul liber, informat și necondiționat pentru participarea '), v(x.childName, 96),
    t(' la activitățile organizate de Asociația Clubul Sportiv EduSport. '),
    bi('De asemenea, declar că am acordul expres al celuilalt părinte pentru participarea la cursuri si accept următoarele responsabilități și condiții de participare:'),
  ];
}

const plain = (letter: string, text: string): Clause => ({ letter, runs: [t(text)], bold: false });

const CLAUSE_A = 'Declar pe propria răspundere, în calitate de cursant sau părinte/tutore legal, că participantul la curs este sănătos din punct de vedere medical și apt pentru efort fizic intens. Prin prezenta, exonerez Asociația Clubul Sportiv EduSport, antrenorii, instructorii, angajații, colaboratorii și partenerii patinoarului de orice responsabilitate legată de participarea mea sau a copilului meu la activitățile sportive desfășurate.';
const CLAUSE_B = 'Sunt conștient(ă) că participarea la cursurile și evenimentele de patinaj implică riscuri specifice acestui sport, inclusiv posibilitatea unor accidentări. Deși ACS EduSport și patinoarul partener iau măsuri pentru a asigura un mediu cât mai sigur, nu pot garanta eliminarea completă a pericolelor. Prin urmare, accept că ACS EduSport nu poate fi tras la răspundere pentru eventuale incidente sau răniri apărute în timpul activităților.';
const CLAUSE_C = 'În calitate de cursant, părinte sau tutore legal, înțeleg importanța respectării regulilor de conduită și a indicațiilor oferite de antrenori, atât pentru siguranța proprie, cât și pentru buna desfășurare a activităților. Mă angajez să urmez aceste reguli cu responsabilitate și să mă asigur că fiul/fiica mea cooperează cu personalul clubului, respectă instrucțiunile primite în timpul cursurilor, regulile patinoarului și regulamentul oficial al ACS EduSport, disponibil la ';
const CLAUSE_D = 'Înțeleg că nerespectarea regulilor sau orice comportament din partea cursantului ori a tutorelui care perturbă desfășurarea cursurilor poate conduce la excluderea cursantului din programul de patinaj și la retragerea calității de membru al clubului, fără obligația de a restitui sumele achitate.';
const CLAUSE_E = 'Înțeleg că, în cazul în care cursantul provoacă daune sau deteriorări în incinta patinoarului, responsabilitatea revine exclusiv acestuia. Asociația Clubul Sportiv EduSport nu poate fi considerată răspunzătoare pentru astfel de prejudicii.';
const CLAUSE_F = 'Înțeleg că abonamentele sunt valabile timp de 4 săptămâni de la data primei ședințe, iar ședințele achitate care nu sunt efectuate nu pot fi recuperate sau reportate.';
const CLAUSE_H = 'Intervalul orar al cursurilor poate suferi modificări în funcție de evenimentele organizate de patinoar sau de alte situații care impun reprogramarea activităților de către organizator.';
const CLAUSE_I = 'Asociația Clubul Sportiv EduSport își rezervă dreptul de a fotografia și înregistra audio-video antrenamentele, cursurile, spectacolele sau orice alt eveniment organizat de ACS EduSport ori de partenerii săi, în care apar cursanți sau sportivi ai clubului. Imaginile și înregistrările pot fi utilizate în scopul promovării activității ACS EduSport.';
export const REGULAMENT_LINK = 'www.scoaladepatinaj.com/cursuri/regulament';

function clauses(x: DocumentValues): Clause[] {
  return [
    plain('a.', CLAUSE_A),
    plain('b.', CLAUSE_B),
    { letter: 'c.', runs: [t(CLAUSE_C), link(REGULAMENT_LINK), t(' Regulamentele se completează, după caz, cu prevederile legale în vigoare.')], bold: false },
    plain('d.', CLAUSE_D),
    plain('e.', CLAUSE_E),
    { letter: 'f.', runs: [b(CLAUSE_F)], bold: true },
    {
      letter: 'g.',
      runs: [t('Tarifele pot suferi modificări pe durata acordului ('), v(acordPeriod(x), 150), t('), cu informarea prealabilă a participanților cu minimum 30 de zile înainte.')],
      bold: false,
    },
    plain('h.', CLAUSE_H),
    plain('i.', CLAUSE_I),
  ];
}

const MARKETING: Run[] = [
  t('Îmi exprim acordul ca datele mele personale și de contact să fie utilizate, timp de 1 an de la completarea prezentei cereri, pentru transmiterea de materiale informative și notificări legate de activitatea Asociației Clubul Sportiv EduSport. Confirm că am citit Politica de Confidențialitate privind prelucrarea datelor cu caracter personal ale persoanelor fizice, disponibilă la '),
  b('scoaladepatinaj.com/protectia-datelor'),
  t(', și îmi exprim consimțământul pentru furnizarea și prelucrarea acestor date conform celor menționate.'),
];

const CLOSING: Run[] = [bi('Prin prezenta, confirm că am citit și accept conținutul acestui document și îmi asum toate declarațiile incluse.')];

export function acordContent(values: DocumentValues): AcordContent {
  return { intro: intro(values), consent: consent(values), clauses: clauses(values), marketing: MARKETING, closing: CLOSING };
}
