import { monthName } from '../dates';
import { ron } from '../money';
import { countWords } from '../../ro-count';

export const PREZENTA_COPY = {
  title: 'Prezență', tabSessions: 'Ședințe', tabLessons: 'Lecții individuale', tabCoaches: 'Pe antrenori',
  today: 'Azi', prevDay: 'Ziua anterioară', nextDay: 'Ziua următoare', monthLabel: 'Luna', prevMonth: 'Luna anterioară', nextMonth: 'Luna următoare',
  newSession: '+ Ședință nouă', newLesson: '+ Lecție individuală', exportCsv: 'Export CSV',
  startNotice: 'Setează data de început în Setări site.',
  colDate: 'Data', colTime: 'Ora', colGroup: 'Grupă', colCoach: 'Antrenor', colPresent: 'Prezenți', colState: 'Stare',
  colAthlete: 'Sportiv', colDuration: 'Durată', colGroupSessions: 'Ședințe grup', colLessons: 'Lecții individuale', colHours: 'Ore',
  emptyDay: 'Nicio ședință.', emptyLessons: 'Nicio lecție.', emptyCoaches: 'Nicio ședință.',
  emptyGroupMonth: 'Nicio ședință.', tabGroup: 'Prezență',
  coach: 'Antrenor', addCoaches: '+ Adaugă alți antrenori', grup: 'Grup', uscat: 'Uscat', addVisitor: '+ Adaugă doar la ședința asta',
  close: 'Închide', save: 'Salvează', cancel: 'Anulează', continue: 'Continuă', giveUp: 'Renunță', history: 'Istoric',
  closeConfirm: 'Închizi fără să salvezi?', stay: 'Rămâi',
  newSessionTitle: 'Ședință nouă', newLessonTitle: 'Lecție nouă',
} as const;
export const MATRIX_COPY = {
  group: 'Grupă', athlete: 'Sportiv', total: 'Total', today: 'azi', undone: 'necompletat', visitors: 'Vizitatori', download: 'Descarcă Excel',
  empty: 'Nicio ședință.', grup: 'în grup', uscat: 'uscat', open: 'Deschide ședința',
} as const;
export const SETARI_COPY = { attendanceStart: 'Prezență și plăți din' } as const;

export const PERIOD_COPY = {
  views: { zi: 'Zi', saptamana: 'Săptămână', luna: 'Lună' },
  today: 'Azi',
  show: { grupe: 'Grupe', lectii: 'Lecții individuale', antrenori: 'Antrenori' },
  layout: { lista: 'Listă', grila: 'Grilă' },
  newSession: '+ Ședință nouă', newLesson: '+ Lecție individuală', exportCsv: 'Export CSV',
  tabs: { deCompletat: 'De completat', toate: 'Toate ședințele', tabel: 'Tabel pe grupă' },
  noUndone: 'Nicio ședință de completat.',
  filters: { section: 'Secțiune', group: 'Grupă', show: (n: number): string => `Arată ${countWords(n, 'grupă', 'grupe')}` },
  outside: 'În afara programului',
  todaySuffix: ' (azi)',
  emptyGroups: 'Nicio ședință.',
  emptyLessons: 'Nicio lecție.',
  emptyCoaches: 'Nicio ședință.',
  /** Hidden labels of the arrows. */
  prev: { zi: 'Ziua anterioară', saptamana: 'Săptămâna anterioară', luna: 'Luna anterioară' },
  next: { zi: 'Ziua următoare', saptamana: 'Săptămâna următoare', luna: 'Luna următoare' },
} as const;

export const STATE_COPY = { completat: 'Completat', necompletat: 'Necompletat', urmeaza: 'Urmează' } as const;
/** The state word of a cancelled individual lesson. */
export const LESSON_CANCELLED_COPY = 'Anulată';

export const GRID_COPY = {
  legendWeek: 'Prezenți din listați', legendMonth: 'Prezenți din listați, % în celule',
  steps: ['0%', '1-59%', '60-79%', '80-94%', '95-100%'], planned: 'planificat', none: 'fără ședință',
} as const;

export const COACH_COPY = {
  subtitle: 'Antrenor', back: 'Înapoi',
  tiles: { sessions: 'Ședințe grup', lessons: 'Lecții individuale', hours: 'Ore' },
  picker: { ore: 'Ore', sedinte: 'Ședințe', lectii: 'Lecții individuale' },
  total: 'Total',
  emptySessions: 'Nicio ședință.', emptyLessons: 'Nicio lecție.', emptyHours: 'Nicio oră.',
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
