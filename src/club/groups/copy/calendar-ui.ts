import { countWords } from '../../ro-count';

/** "Calendar și serii": the Pauze section and its window (spec 7.1). */
export const PAUZE_COPY = {
  section: 'Pauze',
  add: 'Adaugă pauză',
  colName: 'Nume',
  colFrom: 'De la',
  colTo: 'Până la',
  menu: 'Mai multe acțiuni',
  edit: 'Editează',
  remove: 'Șterge',
  removeConfirm: (label: string) => `Ștergi pauza "${label}"?`,
  windowNew: 'Pauză nouă',
  windowEdit: 'Editează pauza',
  impactTitle: (n: number, k: number, m: number) => `Se anulează ${countWords(n, 'ședință', 'ședințe')} la ${k} din ${m} grupe`,
  none: 'nicio ședință',
  stays: 'rămâne',
  rest: 'Lecțiile individuale și competițiile rămân.',
  colCancels: 'Se anulează',
  allGroups: 'toate grupele',
  someGroups: (k: number, m: number) => `${k} din ${m} grupe`,
  school: 'Școala de patinaj',
  club: 'Club',
  cancel: 'Anulează',
  save: 'Salvează',
  calendar: 'Calendar',
  autosave: 'se salvează automat',
} as const;
