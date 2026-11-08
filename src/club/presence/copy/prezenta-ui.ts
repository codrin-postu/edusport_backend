import { monthName } from '../dates';
import { ron } from '../money';

export const PREZENTA_COPY = {
  title: 'Prezență', tabSessions: 'Ședințe', tabLessons: 'Lecții individuale', tabCoaches: 'Pe antrenori',
  today: 'Azi', prevDay: 'Ziua anterioară', nextDay: 'Ziua următoare', monthLabel: 'Luna', prevMonth: 'Luna anterioară', nextMonth: 'Luna următoare',
  newSession: '+ Ședință nouă', newLesson: '+ Lecție individuală', exportCsv: 'Export CSV',
  startNotice: 'Setează data de început a prezenței în Setări site.',
  colDate: 'Data', colTime: 'Ora', colGroup: 'Grupă', colCoach: 'Antrenor', colPresent: 'Prezenți', colState: 'Stare',
  colAthlete: 'Sportiv', colDuration: 'Durată', colGroupSessions: 'Ședințe grup', colLessons: 'Lecții individuale', colHours: 'Ore',
  emptyDay: 'Nicio ședință în ziua asta.', emptyLessons: 'Nicio lecție individuală în luna asta.', emptyCoaches: 'Nicio ședință salvată în luna asta.',
  emptyGroupMonth: 'Nicio ședință în luna asta.', tabGroup: 'Prezență',
  coach: 'Antrenor', addCoaches: '+ Adaugă alți antrenori', grup: 'Grup', uscat: 'Uscat', addVisitor: '+ Adaugă doar la ședința asta',
  close: 'Închide', save: 'Salvează', cancel: 'Anulează', continue: 'Continuă', giveUp: 'Renunță', history: 'Istoric',
  closeConfirm: 'Închizi fără să salvezi?', stay: 'Rămâi',
  newSessionTitle: 'Ședință nouă', newLessonTitle: 'Lecție nouă',
} as const;
export const SETARI_COPY = { attendanceStart: 'Prezență și plăți din', attendanceStartHint: 'Ședințele dinainte nu apar ca nefăcute.' } as const;
export const SHELL_COPY = { abonamente: 'Abonamente', abonamenteSub: 'Școala de patinaj', plati: 'Plăți', deIncasat: 'De încasat' } as const;

export const PERIOD_COPY = {
  views: { zi: 'Zi', saptamana: 'Săptămână', luna: 'Lună' },
  today: 'Azi',
  show: { grupe: 'Grupe', lectii: 'Lecții individuale', antrenori: 'Antrenori' },
  layout: { lista: 'Listă', grila: 'Grilă' },
  newSession: '+ Ședință nouă', newLesson: '+ Lecție individuală', exportCsv: 'Export CSV',
  undoneTitle: (n: number): string => `Necompletate din zilele trecute (${n})`,
  outside: 'În afara programului',
  todaySuffix: ' (azi)',
  emptyGroups: 'Nicio ședință în perioada asta.',
  emptyLessons: 'Nicio lecție individuală în perioada asta.',
  emptyCoaches: 'Nicio ședință completată în perioada asta.',
  /** Hidden labels of the arrows. */
  prev: { zi: 'Ziua anterioară', saptamana: 'Săptămâna anterioară', luna: 'Luna anterioară' },
  next: { zi: 'Ziua următoare', saptamana: 'Săptămâna următoare', luna: 'Luna următoare' },
} as const;

export const STATE_COPY = { completat: 'Completat', necompletat: 'Necompletat', urmeaza: 'Urmează' } as const;

export const GRID_COPY = {
  legendWeek: 'Prezenți din listați', legendMonth: 'Prezenți din listați, % în celule',
  steps: ['0%', '1-59%', '60-79%', '80-94%', '95-100%'], planned: 'planificat', none: 'fără ședință',
} as const;

export const COACH_COPY = {
  subtitle: 'Antrenor', back: 'Înapoi',
  tiles: { sessions: 'Ședințe grup', lessons: 'Lecții individuale', hours: 'Ore' },
  picker: { ore: 'Ore', sedinte: 'Ședințe', lectii: 'Lecții individuale' },
  total: 'Total',
  emptySessions: 'Nicio ședință în perioada asta.', emptyLessons: 'Nicio lecție individuală în perioada asta.', emptyHours: 'Nicio oră în perioada asta.',
} as const;

export const PANEL_LINKS = { coaches: 'Antrenori: ', openGroup: 'Deschide grupa' } as const;

/** Texts of the athlete presence history: the "Plată" label and the one-line detail of a "Plătit" / "Neplătit" row (5.4.2). */
export const HISTORY_DETAIL = {
  unit: (unit: number, slots: number, code: string | null): string => `Ședința ${unit}/${slots}${code ? ` ${code}` : ''}`,
  paid: 'Plătit', unpaid: 'Neplătit',
  club: (month: string, due: number, paid: number, left: number): string =>
    `Club, ${monthName(month)}: de plătit ${ron(due)}, plătit ${ron(paid)}, rămas ${ron(left)}.`,
  lesson: (price: number | null, paid: number): string =>
    price === null ? 'Lecție individuală: fără preț.' : `Lecție individuală: ${ron(price)}, plătit ${ron(paid)}.`,
  noSubscription: 'Fără abonament.',
  with: (names: string): string => `Cu ${names}`,
} as const;

/** "Abonament curent" and "Alte abonamente" cards on the athlete record (5.4.1). */
export const CARD_COPY = {
  current: 'Abonament curent', others: 'Alte abonamente', none: 'Fără abonament.', showDays: 'Vezi zilele', hideDays: 'Ascunde zilele',
  unit: (n: number): string => `Ședința ${n}`,
  states: { activ: 'Activ', epuizat: 'Epuizat', expirat: 'Expirat', anulat: 'Anulat' },
} as const;

/** "Prezențe" on the athlete record (5.4.2). */
export const HISTORY_COPY = {
  title: 'Prezențe', cols: ['Data', 'Grupă', 'Tip', 'Plată'], grup: 'Grup', individual: 'Individual', paid: 'Plătit', unpaid: 'Neplătit',
  openSession: 'Deschide ședința', openLesson: 'Deschide lecția',
  with: HISTORY_DETAIL.with,
  empty: (season: string): string => `Nicio prezență în sezonul ${season}.`,
} as const;
