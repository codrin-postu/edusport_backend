/**
 * Înscrieri copy (spec 3 and 4), word for word. INSCRIERI_PENDING_COPY holds the texts the spec does not
 * give (plan 3-4 Needs decision 7, option A until the user answers). Pure; the admin bundle imports it.
 */
export const LIST_COPY = {
  searchPlaceholder: 'Caută după nr. înscriere, nume, părinte, email sau telefon...',
  headers: ['Nr.', 'Trimis la', 'Nume sportiv', 'Vârstă', 'Status', 'Completat de', 'Dorește să fie membru'],
  school: 'Școala',
  all: 'Toate',
  existing: 'Sportiv existent',
  yes: 'Da',
  no: 'Nu',
  moveSchool: 'Mută la altă școală',
  move: 'Mută',
} as const;

export const PANEL_COPY = {
  number: 'Nr.',
  submitted: 'Trimis',
  tabs: { date: 'Date', abonament: 'Abonament', documente: 'Documente', istoric: 'Istoric' },
  abonament: { firstModule: 'La primul modul', source: 'De unde ați aflat', gdpr: 'Acord GDPR', regulations: 'Acord Regulament' },
  edit: 'Editează',
  save: 'Salvează',
  cancel: 'Anulează',
  abonamentHeading: 'Abonament',
  contactat: 'Contactat',
  confirm: 'Confirmă înscrierea',
  openAthlete: 'Deschide fișa sportivului',
  more: '...',
  moreLabel: 'Mai multe acțiuni',
  undo: 'Anulează confirmarea',
  moveSchool: 'Mută la altă școală',
  delete: 'Șterge înscrierea',
  undoDialog: {
    title: 'Anulezi confirmarea?',
    message: 'Se anulează legătura cu fișa, grupa adăugată și statusul A.C.S. scris la confirmare.',
    confirm: 'Anulează confirmarea',
  },
  schoolField: 'Școala',
  archiveField: 'Arhivare',
  archived: 'Arhivat',
  active: 'Activ',
  saveFailed: 'Nu am putut salva modificarea.',
} as const;

export const MATCH_COPY = {
  existing: 'Sportiv existent',
  compare: 'Compară',
  hide: 'Ascunde',
  openFull: 'Deschide fișa completă',
  inRecord: 'În fișă',
  inRegistration: 'În înscriere',
  notAttended: 'În formular: nu a participat sezonul trecut.',
  lastRegistration: (season: string) => `Ultima înscriere: ${season}`,
} as const;

export const EDIT_TOASTS = {
  rebuilt: 'Salvat. Documentul a fost refăcut.',
  unchanged: 'Nicio modificare.',
  rebuildFailed: 'Salvat. Documentul PDF nu a putut fi refăcut.',
  saved: 'Salvat',
} as const;

export const CONFIRM_COPY = {
  title: (nr: string) => `Confirmă înscrierea ${nr}`.trim(),
  athleteSection: 'Sportiv',
  cancel: 'Anulează',
  confirm: 'Confirmă înscrierea',
  existingLabel: 'Sportiv existent',
  existingHint: 'Înscrierea se adaugă la această fișă',
  newLabel: 'Sportiv nou',
  newHint: (name: string) => `Se creează o fișă nouă: ${name}`,
  pickHint: 'Alege "Sportiv existent" sau "Sportiv nou"',
  viewRecord: 'Vezi fișa',
  compare: 'Compară și actualizează',
  hide: 'Ascunde',
  update: 'Actualizează',
  searchOther: 'Caută alt sportiv',
  searchExisting: 'Caută un sportiv existent',
  searchPlaceholder: 'Nume, data nașterii, părinte sau telefon',
  noResults: (text: string) => `Niciun sportiv găsit pentru "${text}".`,
  seasonHeading: (school: string, season: string) => `${school}, sezonul ${season}`,
  group: 'Grupa',
  noGroup: 'Fără grupă deocamdată',
  mainNow: (group: string, section: string) => `Grupă principală acum: ${group} (${section})`,
  mainTick: 'Grupă principală',
  acs: (season: string) => `Membru A.C.S. ${season}`,
  wish: 'Dorește să fie membru (formular)',
  intentHeading: 'Abonament dorit (din formular)',
  intent: (name: string) => `${name}, doar intenția părintelui; abonamentul se adaugă când e cumpărat`,
  confirmed: (name: string) => `Înscriere confirmată: ${name}`,
  undo: 'Anulează',
} as const;

/** Copy the spec does not give: plan 3-4 Needs decision 7, option A. */
export const INSCRIERI_PENDING_COPY = {
  undone: 'Confirmare anulată.',
  moved: (school: string) => `Mutată la ${school}.`,
  movedMany: (school: string, n: number | string) => `Mutate la ${school}: ${n}.`,
  notMoved: (n: number | string) => `Nemutate (deja confirmate): ${n}.`,
  loadFailed: 'Nu am putut încărca datele.',
  noSeason: 'Sezonul nu a fost găsit. Se leagă doar fișa sportivului.',
  seasonOnly: (season: string) => `Sezonul ${season}`,
  noDocuments: 'Niciun document încă.',
  backToList: 'Înapoi la listă',
} as const;
