import type { AthleteCard, ConfirmContext, HistoryLine, RegistrationMatchView } from '../athletes/api-types';
import type { ComparisonRow } from '../confirm/compare';
import type { FlowId } from './flows';
import { addDays, weekdayIndex } from '../groups/dates';
import { todayIso } from '../groups/http';
import { remainingText } from '../presence/copy/core';
import type { GroupOptions } from '../groups/api-types';
import type { PanelRow, PeriodPage, PeriodRow, SessionPanel } from '../presence/attendance/api-types';

/** Example data served to the page while a flow runs; filled per flow by later tasks. */
export type Fixture = { method: 'GET'; match: RegExp; body: unknown };

/** The example registration of the "Confirmă o înscriere" flow; the Înscrieri list marks its row with this id. */
export const EXAMPLE_REGISTRATION_ID = 'ex-maria';
const SEASON = '2026-2027';
const SCHOOL = { documentId: 'ex-school', name: 'Școala de Patinaj' };

const EXAMPLE_ROW = {
  documentId: EXAMPLE_REGISTRATION_ID,
  registrationNumber: '2026-0142',
  status: 'Nou',
  archived: false,
  season: SEASON,
  submittedAt: '2026-11-24T15:20:00.000Z',
  updatedAt: '2026-11-24T15:20:00.000Z',
  internalNote: null,
  extra: null,
  email: 'ioana.popescu@example.com',
  phone: '0722 123 456',
  childName: 'Maria Popescu',
  childBirthDate: '14 martie 2017',
  parentName: 'Ioana Popescu',
  relationship: 'parinte',
  childHeight: 132,
  shirtSize: '8 ani',
  lastSeason: 'Începători',
  priorExperience: 'A patinat sezonul trecut, în grupa de începători.',
  expectations: 'Să învețe elementele de bază și să se bucure de antrenamente.',
  membershipAnswer: 'da',
  subscriptionChoice: { priceItemName: 'Abonament lunar' },
  source: 'Recomandare',
  gdprConsent: true,
  regulationsConsent: true,
  age: 9,
  existingAthlete: true,
  athleteId: null,
  athleteName: null,
  athleteAnonymized: false,
  canUndo: false,
  schoolId: SCHOOL.documentId,
  schoolName: SCHOOL.name,
};

const LIST_BODY = {
  data: [EXAMPLE_ROW],
  pagination: { page: 1, pageSize: 25, total: 1, pageCount: 1 },
  seasons: [SEASON],
  activeSeason: SEASON,
  formMeta: { removedBuiltins: [], customs: [], selectOptions: {}, extraKeys: [] },
  schools: [{ ...SCHOOL, count: 1 }],
  multipleSchools: false,
  allSchoolsTotal: 1,
};

const mariaCard = (): AthleteCard => ({
  documentId: 'ex-athlete-maria',
  name: 'Maria Popescu',
  birthDate: '14.03.2017',
  lastGroup: { name: 'Începători', season: '2025-2026' },
  lastRegistrationSeason: '2025-2026',
  contactName: 'Ioana Popescu',
  status: 'activ',
});

const comparison = (): ComparisonRow[] => [
  { field: 'name', label: 'Nume', athlete: 'Maria Popescu', registration: 'Maria Popescu', differs: false, defaultUpdate: false },
  { field: 'birthDate', label: 'Data nașterii', athlete: '14/03/2017', registration: '14/03/2017', differs: false, defaultUpdate: false },
  { field: 'contactName', label: 'Părinte', athlete: 'Ioana Popescu', registration: 'Ioana Popescu', differs: false, defaultUpdate: false },
  { field: 'phone', label: 'Telefon', athlete: '0722 000 111', registration: '0722 123 456', differs: true, defaultUpdate: true },
  { field: 'email', label: 'E-mail', athlete: 'ioana.popescu@example.com', registration: 'ioana.popescu@example.com', differs: false, defaultUpdate: false },
];

const MATCH_BODY: { data: RegistrationMatchView } = {
  data: {
    confirmed: false,
    athleteId: null,
    canConfirm: true,
    canUndo: false,
    birthDateReadable: true,
    notAttendedLastSeason: false,
    existing: mariaCard(),
    preselect: null,
    comparison: comparison(),
    candidates: [mariaCard()],
  },
};

const CONTEXT_BODY: { data: ConfirmContext } = {
  data: {
    registrationNumber: EXAMPLE_ROW.registrationNumber,
    newAthlete: { name: 'Maria Popescu', birthDate: '14.03.2017' },
    season: { label: SEASON, running: true, endedText: null },
    groups: [
      {
        sectionId: SCHOOL.documentId,
        sectionName: SCHOOL.name,
        groups: [
          { documentId: 'ex-group-incepatori', name: 'Începători' },
          { documentId: 'ex-group-intermediari', name: 'Intermediari' },
        ],
      },
    ],
    mainGroupNow: null,
    acs: { seasonLabel: SEASON, current: 'in_asteptare', next: 'da', wish: 'da' },
    subscriptionIntent: 'Abonament lunar',
    comparison: comparison(),
    defaultUpdateFields: ['phone'],
    blocked: null,
  },
};

const HISTORY_BODY: { data: HistoryLine[] } = {
  data: [{ at: '2026-11-24T15:20:00.000Z', actor: 'Formular', text: 'Înscriere primită' }],
};

/** Each served body is its own deep-frozen copy, so no consumer can change the example or another body. */
function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object') Object.values(v).forEach(deepFreeze);
  return Object.freeze(v);
}

const base = `^/api/club/registrations/${EXAMPLE_REGISTRATION_ID}`;

const INSCRIERE_FIXTURES: Fixture[] = [
  { method: 'GET', match: /^\/api\/forms\/inscrieri(\?|$)/, body: LIST_BODY },
  { method: 'GET', match: new RegExp(`${base}/match$`), body: MATCH_BODY },
  { method: 'GET', match: new RegExp(`${base}/history$`), body: HISTORY_BODY },
  { method: 'GET', match: new RegExp(`${base}/confirm-context(\\?|$)`), body: CONTEXT_BODY },
  { method: 'GET', match: /^\/api\/club\/athletes\/search(\?|$)/, body: { data: [mariaCard()] } },
];

/** The example session of the "Completează prezența" flow; the De completat row and the panel mark themselves by its key. */
const SESSION_TIME = '18:00';
const GROUP = { documentId: 'ex-group-incepatori-1', name: 'Începători 1' };
const COACHES = [{ documentId: 'ex-coach-elena', name: 'Elena Ionescu' }, { documentId: 'ex-coach-mihai', name: 'Mihai Barbu' }];

/** The latest Monday before today: the session was held and nothing is saved for it. */
function lastMonday(today: string): string {
  const monday = addDays(today, -((weekdayIndex(today) + 6) % 7));
  return monday < today ? monday : addDays(monday, -7);
}

const sessionDate = (): string => lastMonday(todayIso());
const sessionKey = (): string => `ex-event|${sessionDate()}|${SESSION_TIME}`;

const periodRow = (): PeriodRow => ({
  sessionId: null, occurrenceKey: sessionKey(), groupId: GROUP.documentId, groupName: GROUP.name, date: sessionDate(), startTime: SESSION_TIME,
  coachNames: [COACHES[0].name], coachIds: [COACHES[0].documentId], present: 0, listed: 5, visitors: 0, state: 'nefacuta', outsideSchedule: false,
  adminState: 'necompletat',
});

const periodBody = (): { data: PeriodPage } => {
  const today = todayIso();
  return { data: { from: today, to: today, today, startDate: '2026-09-14', groupsWithoutList: 0, undone: [periodRow()], days: [] } };
};

const EXAMPLE_ATHLETES: [string, number][] = [['Ana Marin', 8], ['Luca Dobre', 5], ['Sara Ene', 3], ['Tudor Vlad', 10], ['Ilinca Rus', 1]];

const panelRow = ([name, left]: [string, number], i: number): PanelRow => ({
  athleteId: `ex-athlete-${i + 1}`, name, visitor: false, inactive: false, mainGroup: null, abonament: remainingText(left), grup: false, uscat: false, noSubscription: false,
});

const panelBody = (): { data: SessionPanel } => ({
  data: {
    sessionId: null, occurrenceKey: sessionKey(), added: null, groupId: GROUP.documentId, groupName: GROUP.name, kind: 'school',
    date: sessionDate(), startTime: SESSION_TIME, durationMin: 50, outsideSchedule: false, coachIds: [COACHES[0].documentId],
    rows: EXAMPLE_ATHLETES.map(panelRow), highlightAthleteId: null, savedLine: null, history: [],
  },
});

const optionsBody = (): { data: GroupOptions } => ({
  data: { groups: [{ ...GROUP, sectionName: SCHOOL.name }], coaches: COACHES, priceLists: [] },
});

const PREZENTA_FIXTURES = (): Fixture[] => [
  { method: 'GET', match: /^\/api\/club\/attendance\/period(\?|$)/, body: periodBody() },
  { method: 'GET', match: /^\/api\/club\/attendance\/session\?occurrence=ex-event(%7C|\|)/, body: panelBody() },
  { method: 'GET', match: /^\/api\/club\/groups\/options(\?|$)/, body: optionsBody() },
];

/** The marker of the example session: the key up to its date, since the date moves with the week. */
export const isExampleSession = (key: string | null | undefined): boolean => typeof key === 'string' && key.startsWith('ex-event|');

export const FIXTURES: Partial<Record<FlowId, Fixture[]>> = {
  inscriere: deepFreeze(INSCRIERE_FIXTURES.map((f) => ({ ...f }))),
  prezenta: deepFreeze(PREZENTA_FIXTURES()),
};
