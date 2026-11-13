import type { HistoryInput } from '../../history';
import { scrubbedJobStatus, type RegistrationScrub } from '../../personal-data/anonymize-plan';
import type {
  AcsRow, AthleteRow, ClubEmailJob, ClubStore, DuplicateRow, GroupRow, HistoryRow, MembershipRow, ProfileRow, RegistrationRow, SeasonRow, SectionRow,
} from '../store';

/** In-memory ClubStore for the service tests. A transaction restores a snapshot when its work throws. */
export type FakeState = {
  athletes: AthleteRow[]; registrations: RegistrationRow[]; seasons: SeasonRow[]; sections: SectionRow[]; groups: GroupRow[];
  memberships: MembershipRow[]; acs: AcsRow[]; duplicates: DuplicateRow[]; profiles: ProfileRow[]; history: HistoryRow[];
  removedParticipations: string[]; locks: string[]; admins: Record<string, string>;
  /** Extra raw attributes per registration id (shirtSize, consents, ...), merged over the row by `registrationRecords`. */
  registrationRecords: Record<string, Record<string, unknown>>; emailJobs: ClubEmailJob[]; settings: unknown;
  /** Media Library files; `usedBy` holds the ids of the profiles using a file plus labels for any other content. */
  files: FakeFile[];
  /** Every text value of any content (blocks, markdown, json, url strings); a file whose hash or url appears in one is in use. */
  texts: string[];
};
export type FakeFile = { id: number; hash: string; url: string; usedBy: string[] };
export type Fake = { store: ClubStore; state: FakeState; failOn(method: keyof ClubStore, error?: Error): void };

export const SEASONS: SeasonRow[] = [
  { id: 's25', label: '2025-2026', startMonth: '2025-10-01', endMonth: '2026-05-31', isCurrent: false },
  { id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', isCurrent: true },
];
export const SECTIONS: SectionRow[] = [
  { id: 'afi', name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', publicPage: true, order: 1 },
  { id: 'club', name: 'Club', kind: 'club', publicPage: false, order: 2 },
];
export const GROUPS: GroupRow[] = [
  { id: 'g-pp', name: 'Primii Pași', sectionId: 'afi', order: 1, active: true },
  { id: 'g-ib', name: 'Intermediari Bronze', sectionId: 'afi', order: 2, active: true },
  { id: 'g-pro', name: 'Profesioniști', sectionId: 'club', order: 1, active: true },
];

const defined = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

export function athleteRow(over: Partial<AthleteRow> & { id: string }): AthleteRow {
  const base: AthleteRow = {
    id: over.id, name: null, birthDate: null, contactName: null, phone: null, email: null, status: 'activ', dataIncomplete: false, profileId: null, notes: null,
    updatedAt: '2026-10-01T10:00:00.000Z', createdAt: '2026-10-01T10:00:00.000Z', anonymizedAt: null,
  };
  return { ...base, ...defined(over) };
}

export function registrationRow(over: Partial<RegistrationRow> & { id: string }): RegistrationRow {
  const base: RegistrationRow = {
    id: over.id, number: '2026-0142', childName: 'Maria Pop', childBirthDate: '14.03.2016', parentName: 'Ana Pop', phone: '0722111222', email: 'ana@example.com',
    status: 'Nou', archived: false, season: '2026-2027', seasonId: 's26', sectionId: 'afi', athleteId: null, matchAthleteId: null, matchLevel: null,
    childBirthDateParsed: null, membershipAnswer: 'da', lastSeason: null, subscriptionChoice: null, confirmation: null, submittedAt: '2026-10-03T11:22:00.000Z',
  };
  return { ...base, ...defined(over) };
}

function must<T extends { id: string }>(rows: T[], id: string): T {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`fake: no row ${id}`);
  return row;
}

type Reads = 'registration' | 'registrations' | 'athlete' | 'athletes' | 'seasons' | 'sections' | 'groups' | 'memberships' | 'acsRows' | 'duplicates' | 'profiles' | 'history' | 'historyByAction' | 'adminNames';

function fakeReads(s: FakeState): Pick<ClubStore, Reads> {
  const copy = <T>(v: T): T => structuredClone(v);
  return {
    registration: async (id) => copy(s.registrations.find((r) => r.id === id) ?? null),
    registrations: async (where = {}) =>
      copy(s.registrations.filter((r) => (!where.athleteId || r.athleteId === where.athleteId) && (!where.matchAthleteId || r.matchAthleteId === where.matchAthleteId))),
    athlete: async (id) => copy(s.athletes.find((a) => a.id === id) ?? null),
    athletes: async () => copy(s.athletes),
    seasons: async () => copy(s.seasons),
    sections: async () => copy(s.sections),
    groups: async () => copy(s.groups),
    memberships: async (athleteId) => copy(s.memberships.filter((m) => !athleteId || m.athleteId === athleteId)),
    acsRows: async (athleteId) => copy(s.acs.filter((r) => !athleteId || r.athleteId === athleteId)),
    duplicates: async () => copy(s.duplicates),
    profiles: async () => copy(s.profiles),
    history: async (type, id) => copy(s.history.filter((h) => h.subjectType === type && h.subjectId === id)),
    historyByAction: async (action) => copy(s.history.filter((h) => h.action === action)),
    adminNames: async (emails) => Object.fromEntries(emails.filter((e) => s.admins[e]).map((e) => [e, s.admins[e]])),
  };
}

type Next = (prefix: string) => string;

function fakeAthleteWrites(s: FakeState, next: Next, tick: () => string): Pick<ClubStore, 'updateRegistration' | 'createAthlete' | 'updateAthlete' | 'deleteAthlete'> {
  return {
    updateRegistration: async (id, patch) => {
      Object.assign(must(s.registrations, id), patch);
    },
    createAthlete: async (data) => {
      const id = next('ath');
      const at = tick();
      s.athletes.push(athleteRow({ ...data, id, updatedAt: at, createdAt: at }));
      return id;
    },
    updateAthlete: async (id, data) => {
      Object.assign(must(s.athletes, id), defined(data), { updatedAt: tick() });
    },
    deleteAthlete: async (id) => {
      must(s.athletes, id);
      s.athletes = s.athletes.filter((a) => a.id !== id);
      for (const r of s.registrations) Object.assign(r, r.athleteId === id ? { athleteId: null } : {}, r.matchAthleteId === id ? { matchAthleteId: null, matchLevel: null } : {});
    },
  };
}

function fakeRowWrites(s: FakeState, next: Next): Pick<ClubStore, 'createMembership' | 'updateMembership' | 'deleteMembership' | 'createAcs' | 'updateAcs' | 'deleteAcs' | 'createDuplicate' | 'dismissDuplicate' | 'deleteDuplicate'> {
  return {
    createMembership: async (data) => {
      const id = next('gm');
      s.memberships.push({ ...data, id, to: null });
      return id;
    },
    updateMembership: async (id, data) => {
      Object.assign(must(s.memberships, id), defined(data));
    },
    deleteMembership: async (id) => {
      s.memberships = s.memberships.filter((m) => m.id !== id);
    },
    createAcs: async (data) => {
      const id = next('acs');
      s.acs.push({ ...data, id });
      return id;
    },
    updateAcs: async (id, data) => {
      Object.assign(must(s.acs, id), defined(data));
    },
    deleteAcs: async (id) => {
      s.acs = s.acs.filter((r) => r.id !== id);
    },
    createDuplicate: async (firstId, secondId, dismissed = false) => {
      s.duplicates.push({ id: next('dup'), firstId, secondId, dismissed });
    },
    dismissDuplicate: async (id) => {
      must(s.duplicates, id).dismissed = true;
    },
    deleteDuplicate: async (id) => {
      s.duplicates = s.duplicates.filter((d) => d.id !== id);
    },
  };
}

function fakeProfileWrites(s: FakeState, next: Next): Pick<ClubStore, 'createProfile' | 'renameProfile' | 'setProfileVisibility' | 'setPreviousSlugs' | 'deleteProfile'> {
  return {
    createProfile: async (name, slug) => {
      const id = next('sp');
      s.profiles.push({ id, name, slug, previousSlugs: [], showPublicPage: false, published: true });
      return id;
    },
    renameProfile: async (id, name) => {
      must(s.profiles, id).name = name;
    },
    setProfileVisibility: async (id, on) => {
      must(s.profiles, id).showPublicPage = on;
    },
    setPreviousSlugs: async (id, slugs) => {
      must(s.profiles, id).previousSlugs = [...slugs];
    },
    deleteProfile: async (id) => {
      s.profiles = s.profiles.filter((p) => p.id !== id);
      for (const a of s.athletes) if (a.profileId === id) a.profileId = null;
      for (const f of s.files) f.usedBy = f.usedBy.filter((u) => u !== id);
      s.removedParticipations.push(id);
    },
  };
}

function fakeMedia(s: FakeState): Pick<ClubStore, 'profileMediaIds' | 'deleteMediaIfUnused'> {
  return {
    profileMediaIds: async (profileId) => s.files.filter((f) => f.usedBy.includes(profileId)).map((f) => f.id),
    deleteMediaIfUnused: async (fileId) => {
      const file = s.files.find((f) => f.id === fileId);
      if (!file || file.usedBy.length > 0 || s.texts.some((t) => t.includes(file.hash) || t.includes(file.url))) return false;
      s.files = s.files.filter((f) => f.id !== fileId);
      return true;
    },
  };
}

function fakeHistory(s: FakeState, tick: () => string): Pick<ClubStore, 'moveHistory' | 'record'> {
  return {
    moveHistory: async (from, to) => {
      for (const h of s.history) if (h.subjectType === 'athlete' && h.subjectId === from) h.subjectId = to;
    },
    record: async (entry: HistoryInput) => {
      const seq = s.history.reduce((max, h) => Math.max(max, h.seq), 0) + 1;
      s.history.push({ seq, subjectType: entry.subjectType, subjectId: entry.subjectId, action: entry.action, changes: entry.changes ?? {}, actor: entry.actor, at: tick() });
    },
  };
}

/** The raw attributes the Strapi store would read for a registration row. */
const rawOf = (r: RegistrationRow): Record<string, unknown> => ({
  documentId: r.id, registrationNumber: r.number, childName: r.childName, childBirthDate: r.childBirthDate, parentName: r.parentName, phone: r.phone,
  email: r.email, status: r.status, archived: r.archived, season: r.season, membershipAnswer: r.membershipAnswer, lastSeason: r.lastSeason,
  subscriptionChoice: r.subscriptionChoice, submittedAt: r.submittedAt,
});

/** After a scrub the Strapi store reads null text fields as '' (toRegistrationRow), so the fake row does the same. */
function scrubRow(row: RegistrationRow, data: RegistrationScrub): void {
  Object.assign(row, { childName: data.childName, childBirthDate: '', parentName: '', phone: '', email: '', childBirthDateParsed: null, lastSeason: null, confirmation: data.confirmation });
}

type PersonalData = 'registrationRecords' | 'anonymizedRegistrationIds' | 'setHistoryChanges' | 'scrubRegistration' | 'scrubEmailJobs' | 'scrubScheduleEmailJobs' | 'scrubPaymentEmailJobs' | 'personalDataSettings' | 'savePersonalDataSettings';

function fakePersonalData(s: FakeState): Pick<ClubStore, PersonalData> {
  return {
    registrationRecords: async (athleteId) =>
      structuredClone(s.registrations.filter((r) => r.athleteId === athleteId).map((r) => ({ ...rawOf(r), ...s.registrationRecords[r.id] }))),
    anonymizedRegistrationIds: async () => {
      const anonymized = new Set(s.athletes.filter((a) => a.status === 'anonimizat').map((a) => a.id));
      return s.registrations.filter((r) => r.athleteId !== null && anonymized.has(r.athleteId)).map((r) => r.id);
    },
    setHistoryChanges: async (seq, changes) => {
      const row = s.history.find((h) => h.seq === seq);
      if (!row) throw new Error(`fake: no history row ${seq}`);
      row.changes = structuredClone(changes);
    },
    scrubRegistration: async (id, data) => {
      scrubRow(must(s.registrations, id), data);
      s.registrationRecords[id] = { ...s.registrationRecords[id], ...structuredClone(data) };
    },
    scrubEmailJobs: async (ids) => {
      for (const j of s.emailJobs) {
        if (j.registrationId && ids.includes(j.registrationId)) Object.assign(j, { recipient: null, subject: null, lastError: null, status: scrubbedJobStatus(j.status) });
      }
    },
    scrubScheduleEmailJobs: async (addresses) => {
      const wanted = new Set(addresses.map((a) => a.toLowerCase()));
      for (const j of s.emailJobs) {
        if (j.kind === 'schedule-change' && j.recipient && wanted.has(j.recipient.toLowerCase())) Object.assign(j, { recipient: null, subject: null, lastError: null, status: scrubbedJobStatus(j.status) });
      }
    },
    scrubPaymentEmailJobs: async (paymentIds) => {
      for (const j of s.emailJobs) {
        if (j.kind === 'payment' && j.paymentId && paymentIds.includes(j.paymentId)) Object.assign(j, { recipient: null, subject: null, lastError: null, payload: null, status: scrubbedJobStatus(j.status) });
      }
    },
    personalDataSettings: async () => structuredClone(s.settings),
    savePersonalDataSettings: async (value) => {
      s.settings = structuredClone(value);
    },
  };
}

function takeFailure(failing: Map<string, Error | undefined>, key: string): Error {
  const error = failing.get(key) ?? new Error(`fake failure in ${key}`);
  failing.delete(key);
  return error;
}

function withFailures(store: ClubStore, failing: Map<string, Error | undefined>): ClubStore {
  const wrapped: Record<string, unknown> = {};
  for (const [key, fn] of Object.entries(store) as [string, (...args: unknown[]) => Promise<unknown>][]) {
    wrapped[key] = (...args: unknown[]) => (failing.has(key) ? Promise.reject(takeFailure(failing, key)) : fn(...args));
  }
  return wrapped as unknown as ClubStore;
}

const EMPTY: FakeState = {
  athletes: [], registrations: [], seasons: SEASONS, sections: SECTIONS, groups: GROUPS, memberships: [], acs: [], duplicates: [],
  profiles: [], history: [], removedParticipations: [], locks: [], admins: {}, registrationRecords: {}, emailJobs: [], settings: null, files: [], texts: [],
};

export function fakeClubStore(seed: Partial<FakeState> = {}): Fake {
  const state: FakeState = structuredClone({ ...EMPTY, ...seed });
  const failing = new Map<string, Error | undefined>();
  let n = 0;
  const next: Next = (prefix) => `${prefix}-${(n += 1)}`;
  const tick = () => new Date(Date.UTC(2026, 9, 26, 12, 0, 0) + (n += 1) * 1000).toISOString();
  const base: ClubStore = {
    async transaction<T>(work: () => Promise<T>): Promise<T> {
      const snapshot = structuredClone(state);
      try {
        return await work();
      } catch (err) {
        Object.assign(state, snapshot);
        throw err;
      }
    },
    lockRegistration: async (id) => {
      state.locks.push(id);
    },
    lockSeason: async (id) => {
      state.locks.push(`season:${id}`);
    },
    lockAthlete: async (id) => {
      state.locks.push(`athlete:${id}`);
    },
    ...fakeReads(state), ...fakeAthleteWrites(state, next, tick), ...fakeRowWrites(state, next), ...fakeProfileWrites(state, next), ...fakeHistory(state, tick),
    ...fakePersonalData(state), ...fakeMedia(state),
  };
  return { store: withFailures(base, failing), state, failOn: (method, error) => void failing.set(method, error) };
}
