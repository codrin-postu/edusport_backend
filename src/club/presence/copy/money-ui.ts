
/** Screen texts of the money admin UI (plan 5-6, spec 5.7 to 5.13). */
export const MONEY_UI_COPY = {
  abonamente: {
    title: 'Abonamente',
    subtitle: 'Școala de patinaj',
    extend: 'Prelungește abonamentele',
    add: '+ Abonament',
    state: 'Stare',
    stateOptions: ['Toate', 'Active', 'Epuizate', 'Expirate', 'Anulate', 'Expiră în 14 zile'],
    group: 'Grupă',
    all: 'Toate',
    columns: ['Sportiv', 'Grupă', 'Abonament', 'Folosite', 'Expiră', 'Stare'],
  },
  plati: {
    title: 'Plăți',
    add: '+ Plată',
    period: 'Perioadă',
    method: 'Metodă',
    type: 'Tip',
    typeOptions: ['Toate', 'Abonament', 'Cotizație membru', 'Club', 'Lecție individuală', 'Altceva'],
    columns: ['Data', 'Nr. chitanță', 'Sportiv', 'Pentru', 'Metodă', 'Sumă', 'Înregistrat de'],
    total: (sum: string): string => `Total încasat: ${sum}`,
    sub: (month: string): string => `Încasate în ${month.toLowerCase()}`,
    edit: 'Editează',
  },
  due: {
    title: 'De încasat',
    month: 'Luna',
    school: 'Școala de patinaj',
    club: 'Club',
    empty: 'Nimic de încasat în luna asta.',
    schoolColumns: ['Sportiv', 'Grupă', 'Abonament', 'Preț', 'Plătit', 'Rămas'],
    clubColumns: ['Sportiv', 'Grupă', 'Ședințe', 'De plătit', 'Plătit', 'Rămas'],
  },
  tabs: { abonament: 'Grupe și abonament', plati: 'Plăți' },
  athlete: {
    groups: 'Grupe',
    mainGroup: (name: string): string => `${name}, principală`,
    none: 'Fără abonament.',
    addSubscription: '+ Adaugă abonament',
    attendance: 'Prezențe',
    monthColumns: ['Luna', 'Ședințe', 'De plătit', 'Plătit', 'Rămas'],
  },
  sportivi: { column: 'Abonament', filter: 'Abonament', filterOptions: ['Toate', 'Activ', 'Fără abonament'] },
  /** Empty states (rulings, decided by Claude): the Plăți text serves both the page and the athlete tab. */
  empty: { abonamente: 'Niciun abonament.', plati: 'Nicio plată.' },
  /** The phone filter sheet's button: "Arată 12 plăți". */
  show: (count: string): string => `Arată ${count}`,
  undo: { action: 'Anulează', done: 'Anulat.' },
  menu: { addSubscription: 'Adaugă abonament', addPayment: '+ Plată' },
};

/** Texts of the "Bani" page (plan 11-5, spec 5.6). */
export const BANI_COPY = {
  title: 'Bani',
  menu: 'Bani',
  views: { prezentare: 'Prezentare', contabilitate: 'Contabilitate' },
  cards: { collected: 'Încasat', left: 'De încasat', active: 'Abonamente active', expiring: 'Expiră în 14 zile', unpaid: 'Neachitați' },
  dueOf: (s: string): string => `din ${s} datorat`,
  athletesOf: (n: number): string => `din ${n} sportivi`,
  unpaidLine: 'sportivi cu rămas de plată',
  breakdown: 'Pe secțiune și grupă',
  switch: { sectiune: 'Secțiune și grupă', metoda: 'Metodă', scop: 'Scop' },
  cols: { group: 'Grupă', due: 'Datorat', paid: 'Încasat', left: 'Rămas', percent: 'Încasat %', method: 'Metodă', purpose: 'Scop', count: 'Plăți' },
  total: 'Total',
  noGroup: 'Fără grupă',
  note: 'Încasat aici: plătit din ce s-a datorat în luna asta.',
  exportBtn: 'Export contabil',
  xlsx: '.xlsx',
  csv: '.csv',
  figures: { numerar: 'Numerar', card: 'Card (POS)', transfer: 'Transfer bancar', cancelled: 'Anulate' },
  listTitle: 'Plăți din lună',
  listCols: ['Data', 'Nr. chitanță', 'Sportiv', 'Pentru', 'Metodă', 'Sumă'],
  cancelledMark: 'anulată',
  empty: 'Nicio plată în luna asta.',
  receipt: 'Nr. chitanță',
  expiringFilter: 'Expiră în 14 zile',
};

/** Texts of the "Contabilitate" page (admin redesign spec 5): one page for Restanțe, Abonamente, Plăți and Pe grupe. */
export const CONTABILITATE_COPY = {
  title: 'Contabilitate',
  menu: 'Contabilitate',
  glance: 'Pe scurt',
  tabs: { restante: 'Restanțe', abonamente: 'Abonamente', plati: 'Plăți', peGrupe: 'Pe grupe' },
  restante: {
    section: 'Secțiune',
    sectionOptions: { toate: 'Toate', scoala: 'Școala de patinaj', club: 'Club' },
    group: 'Grupă',
    schoolSub: 'Toate abonamentele neachitate integral',
    total: (sum: string): string => `Total rămas: ${sum}`,
    pay: '+ Plată',
  },
  peGrupe: { sub: 'Datorat și încasat pe secțiuni, grupe și metode de plată' },
};
