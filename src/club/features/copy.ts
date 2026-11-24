import type { FeatureKey } from './features';

export const FEATURES_COPY = {
  page: 'Funcții',
  card: 'Funcțiile platformei',
  intro:
    'Alege ce părți ale platformei folosește clubul. O funcție dezactivată dispare din panou și din portaluri, dar datele ei se păstrează și revin când o activezi din nou.',
  footer: 'Mereu active: site-ul, înscrierile, sportivii, grupele și calendarul.',
  needsPrezenta: 'Se poate activa doar împreună cu Prezența.',
  notInstalled: 'Portalul nu este instalat pe acest server.',
  items: {
    prezenta: {
      name: 'Prezență',
      text: 'Antrenorii și administratorii completează prezența la fiecare ședință. Din prezență se calculează ședințele rămase din abonament.',
    },
    abonamente: {
      name: 'Abonamente și plăți',
      text: 'Evidența abonamentelor, a plăților și a restanțelor, în Contabilitate. Părinții primesc pe e-mail confirmarea fiecărei plăți.',
    },
    portalAntrenori: {
      name: 'Portalul antrenorilor',
      text: 'Antrenorii au acces la un portal propriu, unde își văd programul, grupele și sportivii și completează prezența de pe telefon.',
    },
    portalParinti: {
      name: 'Portalul părinților',
      text: 'Părinții și sportivii majori au acces la un portal unde urmăresc calendarul, prezența, plățile și rezultatele.',
    },
    parcurs: {
      name: 'Parcurs și insigne',
      text: 'Sportivii primesc insigne pentru antrenamente, concursuri și vechime, iar antrenorii le pot acorda și insigne proprii. Insignele apar în fișa sportivului și în portaluri.',
    },
  } satisfies Record<FeatureKey, { name: string; text: string }>,
  coachTextWithoutPrezenta:
    'Antrenorii au acces la un portal propriu, unde își văd programul, grupele și sportivii.',
  warning: {
    prezenta:
      'Prezența nu mai apare în panou și în portalul antrenorilor. Datele introduse până acum se păstrează și redevin vizibile când activezi din nou funcția.',
    abonamente:
      'Contabilitatea, abonamentele și plățile nu mai apar în panou și în portalul părinților, iar e-mailurile de confirmare a plății care așteaptă să fie trimise se anulează. Datele se păstrează și redevin vizibile când activezi din nou funcția.',
    portalAntrenori:
      'Antrenorii nu mai pot intra în portal, iar invitațiile netrimise se anulează. Conturile lor se păstrează și funcționează din nou când activezi portalul.',
    portalParinti:
      'Părinții nu mai pot intra în portal, iar invitațiile netrimise se anulează. Conturile se păstrează și funcționează din nou când activezi portalul. E-mailurile despre schimbările de program se trimit în continuare.',
    parcurs:
      'Parcursul și insignele nu mai apar în fișa sportivilor și în portaluri. Insignele acordate până acum se păstrează și redevin vizibile când activezi din nou funcția.',
  } satisfies Record<FeatureKey, string>,
  warningTitle: (name: string): string => `Dezactivezi ${name}?`,
  alsoOffLine: 'Odată cu Prezența se dezactivează și:',
  cancel: 'Anulează',
  confirm: 'Dezactivează',
  lastChange: (who: string, date: string): string =>
    `Ultima modificare: ${who}, ${date}.`,
};
