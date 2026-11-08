
/** Screen texts of the money admin UI (plan 5-6, spec 5.7 to 5.13). */
export const MONEY_UI_COPY = {
  abonamente: {
    title: 'Abonamente',
    subtitle: 'Școala de patinaj',
    extend: 'Prelungește abonamentele',
    add: '+ Abonament',
    state: 'Stare',
    stateOptions: ['Toate', 'Active', 'Epuizate', 'Expirate', 'Anulate'],
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
    columns: ['Data', 'Sportiv', 'Pentru', 'Metodă', 'Sumă', 'Înregistrat de'],
    total: (sum: string): string => `Total: ${sum}`,
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
