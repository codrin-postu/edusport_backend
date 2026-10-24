/**
 * The association's details printed in the 4-column footer of both documents (DECISIONS 2026-10-05,
 * legal-footer-v2 option B: links shortened). Copied word for word from the approved mockups
 * (edusport_frontend/docs/portal/mockups/gen_legal3.py, columns c1, c2x, c3x and contactKV(True)),
 * which took them from the club's paper Cerere de adeziune. The O.G. sentence uses s and t comma below
 * (user, 2026-10-21). The club confirms these numbers before going live (deploy checklist).
 */
export const ASSOCIATION_FOOTER = {
  seat: 'str. Slt. Stanescu Gheorghe, nr. 1, bl. 213, sc. A, et. 10, ap. 42, sect. 2, Bucuresti',
  registration: ['C.I.F.: 30321550', 'C.I.S.: B/A2/00159/2012', 'nr. inreg. in Reg. Asoc. si Fundatiilor: 65/18.05.2012'],
  account: ['RO89 INGB 0000 9999 0318 6729', 'deschis la ING Bank, sucursala Gara de Nord'],
  contact: [
    ['Telefon:', '0723.623.712'],
    ['E-mail:', 'edusporttrophy@gmail.com'],
    ['Facebook:', 'facebook.com/EduSportClub'],
    ['Web:', 'scoaladepatinaj.com'],
  ] as const,
  legal:
    'Asociația Clubul Sportiv EduSport este persoană juridică română de drept privat, fără scop patrimonial, polisportivă, apolitică și non-profit. Clubul Sportiv este constituit și funcționează în conformitate cu prevederile O.G. nr.26/2000 cu privire la asociatii si fundatii si a Legii Educatiei Fizice si Sportului nr.69/2000.',
} as const;

export const FOOTER_TITLES = ['Sediul social', 'Date de înregistrare', 'Cont', 'Contact'] as const;
