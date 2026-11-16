import type { Subject } from './types';

const VIEWS = {
  duplicate: 'Numele e deja folosit.',
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
  sedinte: ['sportiv', 'sportivi'],
} as const;

export const TABLES_COPY = {
  save: 'Salvează',
  pageTitle: 'Tabele',
  saveTable: 'Salvează tabelul',
  rail: { title: 'Tabele salvate', gata: 'Gata făcute', mele: 'Ale mele', colegi: 'Ale colegilor', menu: 'Acțiuni', hide: 'Ascunde tabelele salvate' },
  rename: 'Redenumește',
  duplicate: 'Duplică',
  remove: 'Șterge',
  /** Split download of the header: the button gives Excel, the arrow lists the formats. */
  export: { button: 'Descarcă Excel', more: 'Alte formate' },
  /** Control row. */
  subjects: { sportivi: 'Sportivi', plati: 'Plăți', abonamente: 'Abonamente', prezenta: 'Prezență', sedinte: 'Prezență pe ședințe' },
  filter: 'Filtru',
  onlyOwing: 'Doar cu rest de plată',
  seasonOption: (label: string): string => `Sezonul ${label}`,
  groupLabel: 'Grupează',
  columnsLabel: (n: number): string => `Coloane (${n})`,
  columnSearch: 'Caută',
  season: 'Sezon',
  wholeSeason: 'Tot sezonul',
  present: 'Prezent',
  search: 'Caută',
  nr: 'Nr.',
  section: 'Secțiune',
  group: 'Grupă',
  all: 'Toate',
  select: 'Selectează',
  period: 'Perioada',
  filters: 'Filtre',
  none: 'Fără',
  ungrouped: 'Negrupat',
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
  /** One short line per type when a table has no row. */
  empty: { sportivi: 'Niciun sportiv.', plati: 'Nicio plată.', abonamente: 'Niciun abonament.', prezenta: 'Nicio prezență.', sedinte: 'Niciun sportiv.' } as Record<Subject, string>,
  /** The ready-made "Plăți pe grupă luna aceasta" when nothing was paid: one line instead of rows of zeros. */
  noPaymentsMonth: 'Nicio plată.',
  /** Shown for a saved view whose stored definition cannot be repaired. It can only be deleted. */
  brokenView: 'Vizualizarea nu mai poate fi deschisă.',
  /** Accessible names of the column reorder buttons. */
  moveUp: 'Sus',
  moveDown: 'Jos',
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
    tooMany: 'Peste 5.000 de rânduri. Adaugă filtre.',
    tooSlow: 'Prea lent. Restrânge sfera.',
    nameTaken: VIEWS.duplicate,
    notAuthor: VIEWS.notAuthor,
    tooManyViews: VIEWS.tooMany,
    download: 'Descărcarea nu a reușit.',
    /** COPY NEEDED: invented wording. */
    sedinteScope: 'Alege o grupă și o lună, cel mult luna aceasta.',
  },
  /** Notices of a view opened after the catalog or the data changed (repairDefinition). One per kind of change. */
  notices: {
    columnDropped: 'Coloană scoasă.',
    filterDropped: 'Filtru scos.',
    groupByDropped: 'Grupare scoasă.',
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
