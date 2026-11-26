/** Welcome window and tour chrome strings, verbatim from the admin tour spec. */
export const WELCOME_COPY = {
  title: (firstName: string): string => `Bun venit, ${firstName}!`,
  line: {
    superAdmin: 'Ai acces la tot panoul: activitatea clubului, site-ul și setările.',
    club: 'Te ocupi de înscrieri, sportivi, grupe, prezență și plăți.',
    editor: 'Te ocupi de conținutul site-ului: pagini, anunțuri și prețuri.',
  } as Record<'superAdmin' | 'club' | 'editor', string>,
  duration: 'Un tur scurt, de aproximativ 5 minute, îți arată de unde să începi.',
  later: 'Mai târziu',
  start: 'Începe',
  laterToast: 'Poți porni turul oricând din Primii pași.',
};

export const TOUR_COPY = {
  exit: 'Ieși din exemplu',
  close: 'Închide',
  next: 'Următorul',
  more: 'Mai multe în ghid',
  strip: 'Exemplu: modificările nu se salvează',
  doneToast: 'Exercițiu încheiat. A fost un exemplu, deci nu s-a salvat nimic.',
  introDone: 'Turul s-a încheiat. Continuă oricând cu Primii pași.',
  header: 'Primii pași',
  subtitle: 'Exersează sarcinile de bază pe date de exemplu. Nimic din ce faci aici nu se salvează.',
  replay: 'Reia turul',
  start: 'Începe',
  doneLabel: 'Parcurs',
  again: 'Reia',
  count: (n: number, total: number): string => `${n} din ${total} parcurse`,
};
