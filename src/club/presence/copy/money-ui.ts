import { listDate, longDate } from '../dates';

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
    earlier: 'Abonamente anterioare',
    earlierRow: (itemName: string, startsOn: string, validUntil: string, used: number, slots: number, state: string): string =>
      `${itemName}, ${longDate(startsOn)} - ${longDate(validUntil)}, ${used}/${slots}, ${state}`,
    attendance: 'Prezențe',
    attendanceRow: (date: string, group: string, types: string, noSubscription: boolean): string =>
      [listDate(date), group, types, noSubscription ? 'Fără abonament' : null].filter((c) => c !== null).join(', '),
    monthColumns: ['Luna', 'Ședințe', 'De plătit', 'Plătit', 'Rămas'],
  },
  sportivi: { column: 'Abonament', filter: 'Abonament', filterOptions: ['Toate', 'Activ', 'Fără abonament'] },
  menu: { addSubscription: 'Adaugă abonament', addPayment: '+ Plată' },
};
