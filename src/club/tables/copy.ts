import { countWords } from '../ro-count';

const VIEWS = {
  duplicate: 'Există deja o vizualizare cu numele ăsta.',
  tooMany: 'Prea multe vizualizări salvate. Șterge una.',
  notAuthor: 'Doar autorul poate modifica vizualizarea.',
  saved: 'Vizualizare salvată.',
  updated: 'Salvat.',
  deleted: 'Vizualizare ștearsă.',
};

/** Singular and plural of what a table of each subject counts (group headers: "12 sportivi", "1 plată", "40 de prezențe"). */
export const TABLES_COUNT_WORDS = {
  sportivi: ['sportiv', 'sportivi'],
  plati: ['plată', 'plăți'],
  abonamente: ['abonament', 'abonamente'],
  prezenta: ['prezență', 'prezențe'],
} as const;

export const TABLES_COPY = {
  save: 'Salvează',
  pageTitle: 'Tabele',
  rail: { title: 'Tabele salvate', gata: 'Gata făcute', mele: 'Ale mele', colegi: 'Ale colegilor', menu: 'Acțiuni', pick: 'Tabel salvat' },
  rename: 'Redenumește',
  duplicate: 'Duplică',
  remove: 'Șterge',
  /** "Exportă" menu of the header. */
  export: {
    button: 'Exportă', xlsx: 'Excel (.xlsx)', csv: 'CSV',
    exact: (rows: number, columns: number): string => `Exact ce vezi: ${countWords(rows, 'rând', 'rânduri')}, ${countWords(columns, 'coloană', 'coloane')}, cu filtrele aplicate`,
  },
  /** Control row. */
  table: 'Tabel',
  subjects: { sportivi: 'Sportivi', plati: 'Plăți', abonamente: 'Abonamente', prezenta: 'Prezențe' },
  filter: '+ Filtru',
  filterRemove: 'Scoate filtrul',
  groupLabel: 'Grupează',
  columnsLabel: (n: number): string => `Coloane (${n})`,
  columnSearch: 'Caută coloană',
  shown: 'Afișate, în ordine',
  hidden: 'Ascunse',
  aspect: { label: 'Aspect', lista: 'Listă', foaie: 'Foaie de calcul' },
  season: 'Sezon',
  section: 'Secțiune',
  group: 'Grupă',
  all: 'Toate',
  period: 'Perioada',
  wholeSeason: 'Tot sezonul',
  filters: 'Filtre',
  none: 'Fără',
  subtotal: (g: string): string => `Subtotal ${g}`,
  total: 'Total',
  newTitle: 'Vizualizare nouă',
  name: 'Nume',
  copyOf: (n: string): string => `${n} (copie)`,
  giveUp: 'Renunță',
  saved: VIEWS.saved,
  savedShort: VIEWS.updated,
  confirmDelete: (n: string): string => `Ștergi vizualizarea "${n}"?`,
  deleted: VIEWS.deleted,
  undo: 'Anulează',
  empty: 'Niciun rând pentru alegerile astea.',
  /** The ready-made "Plăți pe grupă luna aceasta" when nothing was paid: one line instead of rows of zeros. */
  noPaymentsMonth: 'Nicio plată luna aceasta.',
  /** Shown for a saved view whose stored definition cannot be repaired. It can only be deleted. */
  brokenView: 'Vizualizarea nu mai poate fi deschisă.',
  /** Accessible names of the column reorder controls (same wording as the other reorderable lists). */
  move: (n: string): string => `Mută ${n}`,
  moveUp: (n: string): string => `Mută ${n} mai sus`,
  moveDown: (n: string): string => `Mută ${n} mai jos`,
  /** Names of the filter operators in the builder. */
  ops: {
    eq: '=',
    gt: '>',
    lt: '<',
    in: 'este unul din',
    empty: 'este gol',
    notEmpty: 'nu este gol',
  },
  errors: {
    tooMany: 'Tabelul are peste 5.000 de rânduri. Restrânge sfera sau filtrele.',
    tooSlow: 'Tabelul durează prea mult. Restrânge sfera.',
    nameTaken: VIEWS.duplicate,
    notAuthor: VIEWS.notAuthor,
    tooManyViews: VIEWS.tooMany,
    download: 'Descărcarea nu a reușit.',
  },
  /** Notices of a view opened after the catalog or the data changed (repairDefinition). One per kind of change. */
  notices: {
    columnDropped: 'O coloană nu mai există și a fost scoasă.',
    filterDropped: 'Un filtru nu mai există și a fost scos.',
    groupByDropped: 'Gruparea nu mai există și a fost scoasă.',
    sectionMissing: 'Secțiunea nu mai există.',
    groupMissing: 'Grupa nu mai există.',
    seasonMissing: 'Sezonul nu mai există.',
    periodReset: 'Perioada a fost resetată.',
  },
  views: VIEWS,
  readyMade: {
    platiGrupa: 'Plăți pe grupă luna aceasta',
    prezentaGrupa: 'Prezență pe grupă',
    sportiviActivi: 'Sportivi activi',
    ramas: 'Restanțe',
    contacte: 'Date de contact',
    expira: 'Abonamente care expiră',
    sportiviPlati: 'Sportivi pe grupă, cu plăți',
    author: 'Sistem',
  },
};
