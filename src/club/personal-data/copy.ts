import { countWords } from '../ro-count';

const athletes = (n: number): string => countWords(n, 'sportiv', 'sportivi');
const years = (n: number): string => countWords(n, 'an', 'ani');

/** Every string of phase 3C (spec 7): Romanian, terse, straight quotes, no em dash, no middle dot. Pure: the admin bundle imports it. */
export const PERSONAL_DATA_COPY = {
  anonymizedName: 'Sportiv anonimizat',
  anonymizedChild: 'Anonimizat',
  menu: { export: 'Exportă datele', anonymize: 'Anonimizează' },
  exported: 'Datele au fost exportate.',
  exportFailed: 'Datele nu au putut fi exportate.',
  dialog: {
    title: 'Anonimizezi datele sportivului?',
    removed:
      'Se șterg: numele, data nașterii, contactul, telefonul, e-mailul, notele, datele din înscrieri, documentele PDF, adresele din coada de e-mail, valorile vechi din Istoric și profilul public.',
    kept: 'Rămân: grupele pe sezoane, statusul A.C.S. și numărul de înscrieri.',
    final: 'Acțiunea nu poate fi anulată.',
    confirm: 'Anonimizează',
    busy: 'Se anonimizează...',
  },
  bulkTitle: (k: number) => `Anonimizezi datele pentru ${athletes(k)}?`,
  bulkButton: (k: number) => `Anonimizează (${k})`,
  done: (k: number) => (k === 1 ? '1 sportiv anonimizat.' : `${athletes(k)} anonimizați.`),
  skipped: (n: number) => `Sărite: ${n}.`,
  failed: (n: number) => `Nereușite: ${n}.`,
  stopped: (k: number) => `Oprit după ${k === 1 ? '1 sportiv anonimizat' : `${athletes(k)} anonimizați`}.`,
  selectAll: 'Selectează tot',
  filterSection: 'Date personale',
  inactiveOption: (n: number) => `Inactivi de peste ${years(n)}`,
  notice: (count: number, n: number) => `${count === 1 ? '1 sportiv inactiv' : `${athletes(count)} inactivi`} de peste ${years(n)}.`,
  noticeLink: 'Vezi lista',
  noticeHide: 'Ascunde până la sezonul următor',
  settingsCard: 'Date personale',
  settingsField: 'Ani până la anonimizare',
  missingDocument: 'Document indisponibil',
  pdf: {
    title: 'Date personale',
    athlete: 'Sportiv',
    groups: 'Grupe pe sezoane',
    acs: 'Membru A.C.S. pe sezoane',
    registrations: 'Înscrieri',
    registration: 'Înscrierea',
    history: 'Istoric',
    season: 'Sezon',
    school: 'Școala',
    status: 'Status',
    notes: 'Note',
    submittedAt: 'Trimisă la',
    mainGroup: 'principală',
    none: 'Nimic înregistrat.',
    generated: (when: string, who: string) => `Generat la ${when}, de ${who}.`,
  },
} as const;
