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
  hint: 'Nicio ședință a grupelor în aceste zile.',
  cancel: 'Anulează',
  save: 'Salvează',
  calendar: 'Calendar',
  autosave: 'se salvează automat',
} as const;
