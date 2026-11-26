import type { AthleteCard, ConfirmContext, HistoryLine, RegistrationMatchView } from '../athletes/api-types';
import type { ComparisonRow } from '../confirm/compare';
import type { FlowId } from './flows';

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

const MARIA_CARD: AthleteCard = {
  documentId: 'ex-athlete-maria',
  name: 'Maria Popescu',
  birthDate: '14.03.2017',
  lastGroup: { name: 'Începători', season: '2025-2026' },
  lastRegistrationSeason: '2025-2026',
  contactName: 'Ioana Popescu',
  status: 'activ',
};

const COMPARISON: ComparisonRow[] = [
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
    existing: MARIA_CARD,
    preselect: null,
    comparison: COMPARISON,
    candidates: [MARIA_CARD],
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
    comparison: COMPARISON,
    defaultUpdateFields: ['phone'],
    blocked: null,
  },
};

const HISTORY_BODY: { data: HistoryLine[] } = {
  data: [{ at: '2026-11-24T15:20:00.000Z', actor: 'Formular', text: 'Înscriere primită' }],
};

const base = `^/api/club/registrations/${EXAMPLE_REGISTRATION_ID}`;

const INSCRIERE_FIXTURES: Fixture[] = [
  { method: 'GET', match: /^\/api\/forms\/inscrieri(\?|$)/, body: LIST_BODY },
  { method: 'GET', match: new RegExp(`${base}/match$`), body: MATCH_BODY },
  { method: 'GET', match: new RegExp(`${base}/history$`), body: HISTORY_BODY },
  { method: 'GET', match: new RegExp(`${base}/confirm-context(\\?|$)`), body: CONTEXT_BODY },
  { method: 'GET', match: /^\/api\/club\/athletes\/search(\?|$)/, body: { data: [MARIA_CARD] } },
];

export const FIXTURES: Partial<Record<FlowId, Fixture[]>> = { inscriere: INSCRIERE_FIXTURES };
