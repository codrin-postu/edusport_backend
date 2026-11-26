import type { AthleteCard, AthleteListPage, AthleteListRow, AthleteRecord, ConfirmContext, HistoryLine, RegistrationMatchView } from '../athletes/api-types';
import type { AccessBlock } from '../portal/access/api-types';
import type { ComparisonRow } from '../confirm/compare';
import { EXAMPLE_GROUP_ID, type FlowId } from './flows';
import { addDays, weekdayIndex } from '../groups/dates';
import { todayIso } from '../groups/http';
import { remainingText } from '../presence/copy/core';
import type { GroupListPage, GroupListRow, GroupOptions, GroupPage } from '../groups/api-types';
import type { GroupProgram } from '../groups/program-read';
import type { Occurrence } from '../../api/calendar-event/services/expand';
import type { AthletePayments, PaymentList, PaymentRowView } from '../presence/money-api';
import type { PaymentOption } from '../presence/payments/rules';
import { PAYMENT_COPY } from '../presence/copy/payments';
import type { MoneyOverview } from '../money/types';
import type { Anunt, ListRow } from '../anunturi/portal-history';
import type { TickTree } from '../calendar/group-ticks';
import type { AdminPrices } from '../price-admin';
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

/** The example announcements of the "Scrie un anunț" flow; the editor knows it is the example by these ids in the list it reads. */
const ANUNT_ID_PREFIX = 'ex-anunt-';
export const isExampleAnunt = (id: string | null | undefined): boolean => typeof id === 'string' && id.startsWith(ANUNT_ID_PREFIX);

const DAY_MS = 86_400_000;
const atDay = (offset: number, hour: number): string => {
  const d = new Date(Date.now() + offset * DAY_MS);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const anuntRow = (n: number, o: Partial<Anunt>): Anunt => ({
  documentId: `${ANUNT_ID_PREFIX}${n}`, title: null, eyebrow: null, slug: `exemplu-${n}`, message: null, format: 'card', ctaLabel: null, ctaUrl: null,
  startAt: atDay(-2, 9), endAt: atDay(5, 23), priority: n, isActive: true, dismissDays: 7, showOnSite: true, showOnPortal: false, portalGroupIds: null,
  portalAuthor: 'Elena Ionescu', group: 'active', stats: null, portal: null, ...o,
});

const anunturiData = (): Anunt[] => [
  anuntRow(1, { title: 'Competiție la Reșița', message: 'Sâmbătă are loc competiția de patinaj. Ne întâlnim la ora 9 la patinoar.', showOnPortal: true }),
  anuntRow(2, { title: 'Ședința de marți se mută', message: 'Antrenamentul de marți se mută miercuri, la aceeași oră.', showOnSite: false, showOnPortal: true, portalGroupIds: ['ex-group-incepatori'], priority: 2 }),
];

const listRow = (a: Anunt, audience: string, site: ListRow['site']): ListRow => ({
  id: a.documentId, source: 'anunt', title: a.title ?? '', site, portal: 'active', kind: `Scris de ${a.portalAuthor}`, audience, state: 'active',
  period: '-', subline: null, results: [], reorderable: site === 'active',
});

const anunturiBody = () => {
  const data = anunturiData();
  return { data, list: [listRow(data[0], 'Toate grupele', 'active'), listRow(data[1], '1 grupă', null)], umami: 'ok' };
};

const anunturiGroups = (): { data: TickTree } => ({
  data: { sections: [{ id: 'ex-school', name: SCHOOL.name, groups: [{ id: 'ex-group-incepatori', name: 'Începători' }, { id: 'ex-group-intermediari', name: 'Intermediari' }] }] },
});

const ANUNT_FIXTURES = (): Fixture[] => [
  { method: 'GET', match: /^\/api\/anunturi(\?|$)/, body: anunturiBody() },
  { method: 'GET', match: /^\/api\/anunturi\/groups(\?|$)/, body: anunturiGroups() },
];

/** The "Adaugă un sportiv" flow: the Sportivi list and the dialog's search, which finds nobody, so "Sportiv nou" is the path. */
const athleteRow = (n: number, name: string, age: number, birthDate: string, group: string): AthleteListRow => ({
  documentId: `ex-sportiv-${n}`, name, age, birthDate, status: 'activ', dataIncomplete: false, missing: [], mainGroup: { documentId: `ex-group-${group}`, name: group },
  contactName: 'Ioana Popescu', phone: '0722 123 456', acs: 'da', publicProfile: 'ascuns', possibleDuplicate: false, abonament: null,
});

const sportiviBody = (): AthleteListPage => ({
  data: [athleteRow(1, 'Ana Marin', 9, '12.05.2017', 'Începători'), athleteRow(2, 'Luca Dobre', 11, '03.09.2015', 'Intermediari')],
  pagination: { page: 1, pageSize: 30, total: 2, pageCount: 1 },
  unfiltered: 2,
  incomplete: 0,
  season: { documentId: 'ex-season', label: SEASON },
  seasons: [{ documentId: 'ex-season', label: SEASON, isCurrent: true }],
  options: { sections: [{ value: SCHOOL.documentId, label: SCHOOL.name }], groups: [{ value: 'ex-group-Începători', label: 'Începători', sectionName: SCHOOL.name }] },
  retentionYears: 3,
});

const SPORTIV_FIXTURES = (): Fixture[] => [
  { method: 'GET', match: /^\/api\/club\/athletes(\?|$)/, body: sportiviBody() },
  { method: 'GET', match: /^\/api\/club\/athletes\/search(\?|$)/, body: { data: [] } },
];

/** The "Creează o grupă" flow: the Grupe list of the running season and the options the new-group form loads. */
const SECTIONS = [
  { documentId: SCHOOL.documentId, slug: 'scoala', label: SCHOOL.name, count: 2 },
  { documentId: 'ex-club', slug: 'club', label: 'Clubul', count: 0 },
];

const groupRow = (n: number, name: string, program: string, members: number): GroupListRow => ({
  documentId: `ex-grupa-${n}`, name, program: [program], coaches: [COACHES[0].name], members, priceList: { documentId: 'ex-prices-scoala', name: 'Preț școală' },
});

const grupeBody = (): { data: GroupListPage } => ({
  data: {
    season: { documentId: 'ex-season', label: SEASON, past: false },
    seasons: [{ documentId: 'ex-season', label: SEASON, isCurrent: true }],
    tabs: SECTIONS,
    section: 'scoala',
    athletes: 14,
    groups: 2,
    rows: [groupRow(1, 'Începători', 'Luni 18:00', 8), groupRow(2, 'Intermediari', 'Miercuri 18:00', 6)],
    unassigned: 0,
  },
});

const grupeOptionsBody = (): { data: GroupOptions } => ({
  data: {
    groups: [{ ...GROUP, sectionName: SCHOOL.name }],
    coaches: COACHES,
    priceLists: [{ documentId: 'ex-prices-scoala', name: 'Preț școală', sectionId: SCHOOL.documentId }],
  },
});

const GRUPA_FIXTURES = (): Fixture[] => [
  { method: 'GET', match: /^\/api\/club\/groups(\?|$)/, body: grupeBody() },
  { method: 'GET', match: /^\/api\/club\/groups\/options(\?|$)/, body: grupeOptionsBody() },
];

/** The "Înregistrează o plată" flow: Contabilitate (Plăți tab) and the payment form, with one example athlete who owes a subscription. */
const PAY_ATHLETE = { id: 'ex-sportiv-1', name: 'Ana Marin' };
const SUBSCRIPTION_PRICE = 200;

const monthNow = (): string => todayIso().slice(0, 7);

const moneyOverview = (): { data: MoneyOverview } => ({
  data: {
    month: monthNow(),
    cards: { collected: 1400, collectedPrev: 1200, left: 600, due: 2000, activeSubscriptions: 9, schoolAthletes: 14, expiring: 2, unpaidAthletes: 3 },
    bySection: [], byMethod: [], byPurpose: [],
  },
});

const examplePayment = (n: number, name: string, method: PaymentRowView['method'], daysAgo: number): PaymentRowView => ({
  paymentId: `ex-plata-${n}`, athleteId: `ex-sportiv-${n + 1}`, athleteName: name, paidOn: addDays(todayIso(), -daysAgo), receiptNo: `2026-00${n}`, purpose: 'abonament',
  purposeText: 'Abonament lunar', method, collectedAtRink: false, amount: SUBSCRIPTION_PRICE, recordedBy: COACHES[0].name, cancelled: false,
  for: { kind: 'abonament', subscriptionId: `ex-abonament-${n}` }, note: null,
});

const paymentsBody = (): { data: PaymentList } => {
  const rows = [examplePayment(2, 'Luca Dobre', 'card', 1), examplePayment(3, 'Sara Ene', 'numerar', 3)];
  return { data: { rows, total: rows.reduce((sum, r) => sum + r.amount, 0) } };
};

const payOptions = (): { data: PaymentOption[] } => ({
  data: [
    {
      for: { kind: 'abonament', subscriptionId: 'ex-abonament-1' }, label: PAYMENT_COPY.optAbonament('Abonament lunar', '1 noiembrie'),
      amount: SUBSCRIPTION_PRICE, isDefault: true, owed: SUBSCRIPTION_PRICE, paid: 0,
    },
    { for: { kind: 'altceva' }, label: 'Altceva', amount: null, isDefault: false, owed: null, paid: 0 },
  ],
});

const athletePayments = (): { data: AthletePayments } => ({ data: { months: [], payments: [], hasEmail: true, readOnly: false } });

const payAthleteCard = (): AthleteCard => ({
  documentId: PAY_ATHLETE.id, name: PAY_ATHLETE.name, birthDate: '12.05.2017', lastGroup: { name: 'Începători', season: SEASON }, lastRegistrationSeason: SEASON,
  contactName: 'Ioana Marin', status: 'activ',
});

const PLATA_FIXTURES = (): Fixture[] => [
  { method: 'GET', match: /^\/api\/club\/money\/overview(\?|$)/, body: moneyOverview() },
  { method: 'GET', match: /^\/api\/club\/payments(\?|$)/, body: paymentsBody() },
  { method: 'GET', match: /^\/api\/club\/athletes\/search(\?|$)/, body: { data: [payAthleteCard()] } },
  { method: 'GET', match: new RegExp(`^/api/club/athletes/${PAY_ATHLETE.id}/payments/options(\\?|$)`), body: payOptions() },
  { method: 'GET', match: new RegExp(`^/api/club/athletes/${PAY_ATHLETE.id}/payments(\\?|$)`), body: athletePayments() },
];

/** The "Anulează sau mută o ședință" flow: the example group's page, its Thursday program and the calendar dates; the date panel needs nothing more. */
const DATE_EVENT_PREFIX = 'ex-event-';
export const isExampleDate = (id: string | null | undefined): boolean => typeof id === 'string' && id.startsWith(DATE_EVENT_PREFIX);
const THURSDAY = 4;
const FIRST_THURSDAY = '2026-09-10';
const THURSDAYS = 42;

const groupPageBody = (): { data: GroupPage } => ({
  data: {
    documentId: EXAMPLE_GROUP_ID, name: 'Începători', section: { documentId: SCHOOL.documentId, name: SCHOOL.name, kind: 'school' },
    priceList: { documentId: 'ex-prices-scoala', name: 'Preț școală' }, coaches: [COACHES[0]], programPublic: true,
    season: { documentId: 'ex-season', label: SEASON, past: false }, members: [], historyCount: 0, deletable: false, copyFrom: null,
  },
});

const programBody = (): { data: GroupProgram } => ({
  data: {
    season: { documentId: 'ex-season', label: SEASON, past: false },
    series: [{
      eventId: `${DATE_EVENT_PREFIX}1`, freq: 'weekly', days: ['thu'], weekOfMonth: null, startTime: '18:00', durationMin: 50, from: '2026-09-10', to: '2027-06-30',
      text: 'Joi 18:00', fromText: '10 sept 2026', nextDate: null,
    }],
  },
});

const thursdayDate = (date: string): Occurrence => ({
  eventId: 1, documentId: `${DATE_EVENT_PREFIX}1`, title: 'Începători', type: 'scoala', label: null, color: null, order: 0, date, startTime: '18:00', endTime: '18:50',
  endsNextDay: false, endDate: date, status: 'scheduled', cancelReason: null, state: 'curs', note: null, reason: null, groupId: EXAMPLE_GROUP_ID, groupName: 'Începători',
  oneOff: false, originalDate: null, originalStartTime: null,
});

/** Every Thursday of the season, so any month the calendar shows has its dates. */
const calendarDates = (): Occurrence[] =>
  Array.from({ length: THURSDAYS }, (_, i) => addDays(FIRST_THURSDAY, i * 7)).filter((d) => weekdayIndex(d) === THURSDAY).map(thursdayDate);

const SEDINTA_FIXTURES = (): Fixture[] => [
  { method: 'GET', match: new RegExp(`^/api/club/groups/${EXAMPLE_GROUP_ID}(\\?|$)`), body: groupPageBody() },
  { method: 'GET', match: new RegExp(`^/api/club/groups/${EXAMPLE_GROUP_ID}/program(\\?|$)`), body: programBody() },
  { method: 'GET', match: /^\/api\/club\/calendar\/occurrences(\?|$)/, body: { data: calendarDates() } },
];

/** The "Invită un părinte în portal" flow: the Sportivi list with Andrei Stan, his record (Date tab) and his portal access block, without access. */
const INVITEE_ID = 'ex-sportiv-andrei';
export const isExampleInvitee = (id: string | null | undefined): boolean => id === INVITEE_ID;

const inviteeRow = (): AthleteListRow => ({
  ...athleteRow(3, 'Andrei Stan', 10, '08.02.2016', 'Începători'), documentId: INVITEE_ID, contactName: 'Mihaela Stan', phone: '0723 456 789',
});

const inviteeListBody = (): AthleteListPage => {
  const base = sportiviBody();
  const data = [inviteeRow(), ...base.data];
  return { ...base, data, pagination: { ...base.pagination, total: data.length }, unfiltered: data.length };
};

const inviteeRecord = (): { data: AthleteRecord } => ({
  data: {
    documentId: INVITEE_ID,
    fields: { name: 'Andrei Stan', birthDate: '08.02.2016', contactName: 'Mihaela Stan', phone: '0723 456 789', email: 'mihaela.stan@example.com' },
    missing: [], status: 'activ', dataIncomplete: false,
    header: { birthDate: '08.02.2016', mainGroup: 'Începători' },
    season: { documentId: 'ex-season', label: SEASON },
    acs: { seasonLabel: SEASON, state: 'da' },
    registrations: [], documents: [], profile: null, duplicates: [], historyCount: 0,
  },
});

const inviteeAccess = (): { data: AccessBlock } => ({
  data: { athleteId: INVITEE_ID, state: 'none', email: 'mihaela.stan@example.com', since: null, adult: false, canInvite: true, hint: null },
});

const PARINTE_FIXTURES = (): Fixture[] => [
  { method: 'GET', match: /^\/api\/club\/athletes(\?|$)/, body: inviteeListBody() },
  { method: 'GET', match: new RegExp(`^/api/club/athletes/${INVITEE_ID}(\\?|$)`), body: inviteeRecord() },
  { method: 'GET', match: new RegExp(`^/api/club/athletes/${INVITEE_ID}/access(\\?|$)`), body: inviteeAccess() },
];

// The Funcții flow has no fixtures: GET /api/club/features always passes the guard, so a reload during a flow never puts example data into the menu snapshot.

/** The "Modifică o pagină" flow: the Cursuri editor with example texts. */
const PAGINA_FIXTURES = (): Fixture[] => [
  {
    method: 'GET',
    match: /^\/content-manager\/single-types\/api::cursuri-page\.cursuri-page(\?|$)/,
    body: {
      data: {
        id: 1,
        documentId: 'ex-cursuri',
        banner: { title: 'Cursuri de Patinaj', scheduleDays: 'Sâmbătă și duminică', scheduleTimes: '10:00-10:50 și 11:00-11:50', locationName: 'Patinoar', locationUrl: 'https://example.com/locatie' },
        aboutSection: { eyebrow: 'Despre noi', heading: 'Școala de patinaj', content: 'Text de exemplu despre cursuri.', locationBullet: 'Patinoar', levelsBullet: 'Toate nivelurile', coachesBullet: 'Antrenori cu experiență', videoUrl: '', videoLabel: '' },
        infoSection: { sectionLabel: 'Ce trebuie să știi', tips: ['Sfat de exemplu'], closingLine: '' },
        promoCard: { eyebrow: 'Devino membru', title: 'Abonament', description: 'Descriere de exemplu.', subscriptionInfoTitle: 'Ce include abonamentul', subscriptionBullets: ['Punct de exemplu'] },
      },
    },
  },
];

/** The "Actualizează prețurile" flow: one school section with one list; the Prețuri page marks the list's first row. */
export const EXAMPLE_PRICE_LIST_ID = 'ex-lista-1';
export const isExamplePriceList = (id: string | null | undefined): boolean => id === EXAMPLE_PRICE_LIST_ID;

const pricesBody = (): { data: AdminPrices } => ({
  data: {
    sections: [{ documentId: 'ex-sectiune', name: 'Școala de Patinaj', kind: 'school', priceNotes: [] }],
    lists: [{
      documentId: EXAMPLE_PRICE_LIST_ID, name: 'Începători', sectionId: 'ex-sectiune', groups: [],
      items: [
        { name: 'Abonament lunar', kind: 'subscription', sessions: 8, memberPrice: 200, nonMemberPrice: 250, tooltip: null, incomplete: false },
        { name: 'Ședință unică', kind: 'subscription', sessions: 1, memberPrice: 40, nonMemberPrice: 50, tooltip: null, incomplete: false },
      ],
    }],
  },
});

const PRETURI_FIXTURES = (): Fixture[] => [{ method: 'GET', match: /^\/api\/club\/prices(\?|$)/, body: pricesBody() }];

/** The "Adaugă un membru în echipă" flow: the members list. */
const MEMBRU_FIXTURES = (): Fixture[] => [
  {
    method: 'GET',
    match: /^\/content-manager\/collection-types\/api::team-member\.team-member(\?|$)/,
    body: {
      results: [
        { id: 1, documentId: 'ex-membru-1', name: 'Ana Popescu', role: 'Antrenor principal', bio: 'Text de exemplu.', groups: [], order: 1, photo: null },
        { id: 2, documentId: 'ex-membru-2', name: 'Mihai Ionescu', role: 'Instructor', bio: 'Text de exemplu.', groups: [], order: 2, photo: null },
      ],
    },
  },
];

export const FIXTURES: Partial<Record<FlowId, Fixture[]>> = {
  parinte: deepFreeze(PARINTE_FIXTURES()),
  inscriere: deepFreeze(INSCRIERE_FIXTURES.map((f) => ({ ...f }))),
  sportiv: deepFreeze(SPORTIV_FIXTURES()),
  grupa: deepFreeze(GRUPA_FIXTURES()),
  prezenta: deepFreeze(PREZENTA_FIXTURES()),
  plata: deepFreeze(PLATA_FIXTURES()),
  sedinta: deepFreeze(SEDINTA_FIXTURES()),
  anunt: deepFreeze(ANUNT_FIXTURES()),
  pagina: deepFreeze(PAGINA_FIXTURES()),
  preturi: deepFreeze(PRETURI_FIXTURES()),
  membru: deepFreeze(MEMBRU_FIXTURES()),
};
