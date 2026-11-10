import type { AthleteRow, MembershipRow, RegistrationRow } from '../../athletes/store';
import { athleteRow, registrationRow } from '../../athletes/__tests__/fake-store';
import type { HistoryInput } from '../../history';
import type { GroupContext } from '../context';
import type {
  BreakRecord, EventRecord, GroupRecord, GroupStore, HistoryEntryRow, NamedRow, PriceListRow, Recurrence, ScheduleEmailJob, SeasonRecord, SectionRecord,
} from '../types';

export { athleteRow, registrationRow };
export type FakeJob = ScheduleEmailJob & { id: string; status: 'queued' | 'sending' | 'cancelled' | 'sent' };
export type FakeGroupState = {
  seasons: SeasonRecord[]; sections: SectionRecord[]; groups: GroupRecord[]; teamMembers: NamedRow[]; priceLists: PriceListRow[]; athletes: AthleteRow[];
  memberships: MembershipRow[]; registrations: RegistrationRow[]; events: EventRecord[]; breaks: BreakRecord[]; history: HistoryEntryRow[]; jobs: FakeJob[];
  locks: string[]; admins: Record<string, string>; filedAfter: number;
};
export type FakeGroup = { store: GroupStore; state: FakeGroupState; failOn(method: keyof GroupStore): void };

export const G_SEASONS: SeasonRecord[] = [
  { id: 's25', label: '2025-2026', startMonth: '2025-10-01', endMonth: '2026-05-31', isCurrent: false, membershipFee: 250 },
  { id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', isCurrent: true, membershipFee: 270 },
  { id: 's27', label: '2027-2028', startMonth: '2027-10-01', endMonth: '2028-05-31', isCurrent: false, membershipFee: 200 },
];
export const G_SECTIONS: SectionRecord[] = [
  { id: 'afi', name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', publicPage: true, order: 1, slug: 'scoala-afi' },
  { id: 'club', name: 'Club', kind: 'club', publicPage: false, order: 2, slug: 'club' },
];
const grp = (id: string, name: string, sectionId: string, order: number, over: Partial<GroupRecord> = {}): GroupRecord =>
  ({ id, name, sectionId, order, active: true, priceListId: null, coachIds: [], programPublic: true, ...over });
export const G_GROUPS: GroupRecord[] = [
  grp('g-pp', 'Primii Pași', 'afi', 1, { priceListId: 'pl-std' }),
  grp('g-ib', 'Intermediari Bronze', 'afi', 2, { priceListId: 'pl-std', coachIds: ['tm-virgil'] }),
  grp('g-is', 'Intermediari Silver', 'afi', 3, { priceListId: 'pl-std', coachIds: ['tm-virgil'] }),
  grp('g-pro', 'Profesioniști', 'club', 1, { coachIds: ['tm-andreea'] }),
  grp('g-av', 'Avansați', 'club', 2, { coachIds: ['tm-andreea'] }),
];
export const G_TEAM: NamedRow[] = [{ id: 'tm-andreea', name: 'Andreea Pascu' }, { id: 'tm-virgil', name: 'Virgil Pascu' }];
export const G_PRICE_LISTS: PriceListRow[] = [{ id: 'pl-std', name: 'Standard', sectionId: 'afi' }, { id: 'pl-club', name: 'Club', sectionId: 'club' }];

export const member = (over: Partial<MembershipRow> & { id: string; athleteId: string; groupId: string }): MembershipRow =>
  ({ seasonId: 's26', isMain: true, from: '2026-10-01', to: null, ...over });
const WEEKEND: Recurrence = { freq: 'weekly', days: ['sat', 'sun'], weekOfMonth: null, startTime: '11:00', endTime: '11:50', singleDate: null, seasonStart: '2026-10-04', seasonEnd: '2027-05-31' };
export const event = (over: Partial<EventRecord> & { id: string }): EventRecord =>
  ({ title: 'Intermediari Bronze', type: 'scoala', description: null, groupId: 'g-ib', recurrence: WEEKEND, exceptions: [], ...over });

function must<T extends { id: string }>(rows: T[], id: string): T {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`fake: no row ${id}`);
  return row;
}
const copy = <T>(v: T): T => structuredClone(v);
type Next = (prefix: string) => string;
type K<Keys extends keyof GroupStore> = Pick<GroupStore, Keys>;

function fakeLookups(s: FakeGroupState): K<'seasons' | 'sections' | 'groups' | 'group' | 'teamMembers' | 'priceLists' | 'athletes' | 'athlete' | 'registrations' | 'registrationsFiledAfter' | 'adminNames'> {
  return {
    seasons: async () => copy(s.seasons),
    sections: async () => copy(s.sections),
    groups: async () => copy(s.groups),
    group: async (id) => copy(s.groups.find((g) => g.id === id) ?? null),
    teamMembers: async () => copy(s.teamMembers),
    priceLists: async () => copy(s.priceLists),
    athletes: async () => copy(s.athletes),
    athlete: async (id) => copy(s.athletes.find((a) => a.id === id) ?? null),
    registrations: async () => copy(s.registrations),
    registrationsFiledAfter: async () => s.filedAfter,
    adminNames: async (emails) => Object.fromEntries(emails.filter((e) => s.admins[e]).map((e) => [e, s.admins[e]])),
  };
}

function fakeRows(s: FakeGroupState): K<'memberships' | 'membership' | 'events' | 'event' | 'breaks' | 'history' | 'historyEntry' | 'historyAfter'> {
  const hit = (v: string | undefined, actual: string) => v === undefined || v === actual;
  return {
    memberships: async (w = {}) => copy(s.memberships.filter((m) => hit(w.seasonId, m.seasonId) && hit(w.groupId, m.groupId) && hit(w.athleteId, m.athleteId))),
    membership: async (id) => copy(s.memberships.find((m) => m.id === id) ?? null),
    events: async (w = {}) => copy(s.events.filter((e) => w.groupId === undefined || e.groupId === w.groupId)),
    event: async (id) => copy(s.events.find((e) => e.id === id) ?? null),
    breaks: async () => copy([...s.breaks].sort((a, b) => a.startDate.localeCompare(b.startDate))),
    history: async (type, id) => copy(s.history.filter((h) => h.subjectType === type && h.subjectId === id)),
    historyEntry: async (id) => copy(s.history.find((h) => h.id === id) ?? null),
    historyAfter: async (seq, subjects) =>
      copy(s.history.filter((h) => h.seq > seq && (subjects === null || subjects.some((x) => x.type === h.subjectType && x.id === h.subjectId)))),
  };
}

function fakeGroupWrites(s: FakeGroupState, next: Next): K<'createGroup' | 'updateGroup' | 'deleteGroup' | 'setAthleteStatus' | 'setSeasonCurrent'> {
  return {
    createGroup: async (d) => {
      const id = next('g');
      s.groups.push({ id, name: d.name, sectionId: d.sectionId, order: d.order, active: true, priceListId: d.priceListId, coachIds: [...d.coachIds], programPublic: d.programPublic });
      return id;
    },
    updateGroup: async (id, d) => {
      Object.assign(must(s.groups, id), Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)));
    },
    deleteGroup: async (id) => {
      must(s.groups, id);
      s.groups = s.groups.filter((g) => g.id !== id);
    },
    setAthleteStatus: async (id, status) => {
      must(s.athletes, id).status = status;
    },
    setSeasonCurrent: async (id, isCurrent) => {
      must(s.seasons, id).isCurrent = isCurrent;
    },
  };
}

function fakeMembershipWrites(s: FakeGroupState, next: Next): K<'createMembership' | 'updateMembership' | 'deleteMembership'> {
  return {
    createMembership: async (d) => {
      const id = next('gm');
      s.memberships.push({ ...d, id, to: d.to ?? null });
      return id;
    },
    updateMembership: async (id, d) => {
      Object.assign(must(s.memberships, id), Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)));
    },
    deleteMembership: async (id) => {
      must(s.memberships, id);
      s.memberships = s.memberships.filter((m) => m.id !== id);
    },
  };
}

function fakeCalendarWrites(s: FakeGroupState, next: Next): K<'createEvent' | 'updateEvent' | 'deleteEvent' | 'createBreak' | 'updateBreak' | 'deleteBreak'> {
  return {
    createEvent: async (d) => {
      const id = next('ev');
      s.events.push({ ...copy(d), id });
      return id;
    },
    updateEvent: async (id, d) => {
      Object.assign(must(s.events, id), copy(Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined))));
    },
    deleteEvent: async (id) => {
      must(s.events, id);
      s.events = s.events.filter((e) => e.id !== id);
    },
    createBreak: async (d) => {
      const id = next('br');
      s.breaks.push({ ...d, id });
      return id;
    },
    updateBreak: async (id, d) => {
      Object.assign(must(s.breaks, id), d);
    },
    deleteBreak: async (id) => {
      must(s.breaks, id);
      s.breaks = s.breaks.filter((b) => b.id !== id);
    },
  };
}

function fakeJobsAndHistory(s: FakeGroupState, next: Next, tick: () => string): K<'createEmailJobs' | 'cancelEmailJobs' | 'sentEmailJobs' | 'recordAction' | 'record' | 'setHistoryChanges'> {
  const push = (entry: HistoryInput) => {
    const seq = s.history.reduce((max, h) => Math.max(max, h.seq), 0) + 1;
    const row: HistoryEntryRow = { id: `h${seq}`, seq, subjectType: entry.subjectType, subjectId: entry.subjectId, action: entry.action, changes: copy(entry.changes ?? {}), actor: entry.actor, at: tick() };
    s.history.push(row);
    return { id: row.id, seq };
  };
  return {
    createEmailJobs: async (jobs) => {
      for (const j of jobs) s.jobs.push({ ...copy(j), id: next('job'), status: 'queued' });
      return jobs.length;
    },
    cancelEmailJobs: async (changeKey) => {
      const queued = s.jobs.filter((j) => j.changeKey === changeKey && j.status === 'queued');
      for (const j of queued) j.status = 'cancelled';
      return queued.length;
    },
    sentEmailJobs: async (changeKey) => s.jobs.filter((j) => j.changeKey === changeKey && (j.status === 'sent' || j.status === 'sending')).length,
    recordAction: async (entry) => push(entry),
    record: async (entry) => {
      push(entry);
    },
    setHistoryChanges: async (id, changes) => {
      must(s.history, id).changes = copy(changes);
    },
  };
}

function withFailures(store: GroupStore, failing: Set<string>): GroupStore {
  const wrapped: Record<string, unknown> = {};
  for (const [key, fn] of Object.entries(store) as [string, (...args: unknown[]) => Promise<unknown>][]) {
    wrapped[key] = (...args: unknown[]) => (failing.delete(key) ? Promise.reject(new Error(`fake failure in ${key}`)) : fn(...args));
  }
  return wrapped as unknown as GroupStore;
}

const EMPTY: FakeGroupState = {
  seasons: G_SEASONS, sections: G_SECTIONS, groups: G_GROUPS, teamMembers: G_TEAM, priceLists: G_PRICE_LISTS, athletes: [], memberships: [], registrations: [],
  events: [], breaks: [], history: [], jobs: [], locks: [], admins: {}, filedAfter: 0,
};

/** In-memory GroupStore; a transaction restores a snapshot when its work throws, so all-or-nothing is unit tested. */
export function fakeGroupStore(seed: Partial<FakeGroupState> = {}): FakeGroup {
  const state: FakeGroupState = structuredClone({ ...EMPTY, ...seed });
  const failing = new Set<string>();
  let n = 0;
  const next: Next = (prefix) => `${prefix}-${(n += 1)}`;
  const tick = () => new Date(Date.UTC(2026, 10, 20, 10, 0, 0) + (n += 1) * 1000).toISOString();
  let depth = 0;
  const lock = (kind: string) => async (id: string) => {
    if (depth === 0) throw new Error(`fake: lock on ${kind}:${id} outside a transaction`);
    state.locks.push(`${kind}:${id}`);
  };
  const base: GroupStore = {
    async transaction<T>(work: () => Promise<T>): Promise<T> {
      const snapshot = structuredClone(state);
      depth += 1;
      try {
        return await work();
      } catch (err) {
        Object.assign(state, snapshot);
        throw err;
      } finally {
        depth -= 1;
      }
    },
    lockSeason: lock('season'), lockAthlete: lock('athlete'), lockGroup: lock('group'), lockEvent: lock('event'), lockHistoryEntry: lock('history'),
    ...fakeLookups(state), ...fakeRows(state), ...fakeGroupWrites(state, next), ...fakeMembershipWrites(state, next),
    ...fakeCalendarWrites(state, next), ...fakeJobsAndHistory(state, next, tick),
  };
  return { store: withFailures(base, failing), state, failOn: (method) => failing.add(method) };
}

export type FakeContext = FakeGroup & { saved: Set<string>; ctx: GroupContext; revalidated: () => number; logs: string[]; emailed: string[] };

/** A GroupContext over the fake store; today 20 November 2026, now 10:00 UTC, unless given. */
export function fakeContext(seed: Partial<FakeGroupState> = {}, today = '2026-11-20'): FakeContext {
  const fake = fakeGroupStore(seed);
  let pings = 0;
  const logs: string[] = [];
  const emailed: string[] = [];
  const saved = new Set<string>();
  const ctx: GroupContext = {
    store: fake.store, actor: 'admin@example.com', today, log: (m) => logs.push(m), revalidate: () => { pings += 1; },
    emails: (key) => emailed.push(key), now: () => new Date(`${today}T10:00:00.000Z`),
    hasSavedSession: async (groupId, date) => saved.has(`${groupId}|${date}`),
  };
  return { ...fake, saved, ctx, logs, emailed, revalidated: () => pings };
}
