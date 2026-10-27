import type { AcsRow } from '../../athletes/store';
import { G_GROUPS, type FakeGroupState, fakeGroupStore } from '../../groups/__tests__/fake-group-store';
import type { CalendarWindow } from '../../groups/occurrences';
import type {
  AttendanceRow, AttendanceWrite, LessonRow, PaymentEmailJob, PaymentRow, PriceItemRow, PriceListRecord, SessionRow, SubscriptionRow,
} from '../types';
import type { PresenceStore } from '../store';
import { UniqueKeyError } from '../store';

export { athleteRow, member } from '../../groups/__tests__/fake-group-store';
export type FakePaymentJob = PaymentEmailJob & { id: string; status: 'queued' | 'sending' | 'cancelled' | 'sent' };
export type FakePresenceState = {
  sessions: SessionRow[]; attendances: (AttendanceWrite & { id: string })[]; lessons: LessonRow[]; subscriptions: SubscriptionRow[]; payments: PaymentRow[];
  priceLists: PriceListRecord[]; acs: AcsRow[]; calendar: CalendarWindow; startDate: string | null; jobs: FakePaymentJob[];
};
export type FakePresenceSeed = { group?: Partial<FakeGroupState> } & Partial<FakePresenceState>;
export type FakePresence = { store: PresenceStore; state: FakePresenceState; group: FakeGroupState; failOn(method: keyof PresenceStore): void };
/** Shape of Task 6's PresenceContext; swap for the type import when that file lands. */
export type PresenceContext = { store: PresenceStore; actor: string; today: string; now: () => Date; log: (m: string) => void };

const item = (name: string, kind: PriceItemRow['kind'], sessions: number | null, memberPrice: number, nonMemberPrice: number, included = false): PriceItemRow =>
  ({ name, kind, sessions, memberPrice, nonMemberPrice, included });
export const P_LISTS: PriceListRecord[] = [
  { id: 'pl-std', name: 'Standard', sectionId: 'afi', items: [item('Abonament 8 ședințe', 'subscription', 8, 320, 360), item('Abonament 6 ședințe', 'subscription', 6, 260, 290)] },
  { id: 'pl-gold', name: 'Avansați Gold', sectionId: 'afi', items: [item('Abonament 8 ședințe Gold', 'subscription', 8, 400, 440)] },
  { id: 'pl-club', name: 'Club', sectionId: 'club', items: [item('Ședință grup', 'session', null, 40, 50), item('Uscat', 'uscat', null, 20, 25), item('Lecție individuală', 'individual', null, 80, 100)] },
  { id: 'pl-club-inclus', name: 'Club inclus', sectionId: 'club', items: [item('Ședință grup', 'session', null, 40, 50), item('Uscat', 'uscat', null, 20, 25, true)] },
];
export const P_GROUPS = [
  ...G_GROUPS.map((g) => (g.id === 'g-av' ? { ...g, priceListId: 'pl-club' } : g)),
  { id: 'g-gold', name: 'Avansați Gold', sectionId: 'afi', order: 4, active: true, priceListId: 'pl-gold', coachIds: ['tm-virgil'], programPublic: true },
];

export const sessionRow = (over: Partial<SessionRow> = {}): SessionRow => ({
  id: 's1', groupId: 'g-ib', seasonId: 's26', date: '2026-11-07', startTime: '11:00', durationMin: 50, source: 'schedule', eventId: 'ev1', occurrenceKey: null,
  outsideSchedule: false, coachIds: ['tm-virgil'], savedBy: 'admin@example.com', savedAt: '2026-11-07T12:00:00.000Z', firstSavedAt: '2026-11-07T12:00:00.000Z', ...over,
});
export const attendanceRow = (over: Partial<AttendanceWrite & { id: string }> = {}): AttendanceWrite & { id: string } => ({
  id: 't1', sessionId: 's1', athleteId: 'a1', uniqueKey: 's1|a1', grup: true, uscat: false, visitor: false, subscriptionId: null, billing: 'fara_pret',
  charges: [], amount: 0, audience: null, ...over,
});
export const lessonRow = (over: Partial<LessonRow> = {}): LessonRow => ({
  id: 'l1', athleteId: 'a1', date: '2026-11-10', startTime: '17:00', durationMin: 50, coachIds: ['tm-andreea'], state: 'planned', present: null, priceListId: null,
  itemName: null, price: null, audience: null, amount: 0, createdBy: 'admin@example.com', savedBy: null, savedAt: null, ...over,
});
export const subscriptionRow = (over: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  id: 'sub1', athleteId: 'a1', seasonId: 's26', priceListId: 'pl-std', validIn: ['g-ib'], itemName: 'Abonament 8 ședințe', price: 320, audience: 'member', slots: 8,
  startsOn: '2026-10-27', validUntil: '2026-11-23', extendedWeeks: 0, cancelled: false, cancelledAt: null, cancelledBy: null,
  purchasedAt: '2026-10-27T10:00:00.000Z', recordedBy: 'admin@example.com', ...over,
});
export const paymentRow = (over: Partial<PaymentRow> = {}): PaymentRow => ({
  id: 'p1', athleteId: 'a1', amount: 320, method: 'numerar', paidOn: '2026-10-27', purpose: 'altceva', subscriptionId: null, lessonId: null, clubMonth: null,
  seasonId: 's26', collectedAtRink: false, note: null, sendEmail: false, emailJobId: null, acsBefore: null, recordedBy: 'admin@example.com',
  recordedAt: '2026-10-27T10:00:00.000Z', cancelled: false, cancelledAt: null, cancelledBy: null, ...over,
});

const copy = <T>(v: T): T => structuredClone(v);
const byId = <T extends { id: string }>(rows: T[]): T[] => copy([...rows].sort((a, b) => a.id.localeCompare(b.id)));
const defined = (d: object) => Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined));
const inList = (ids: string[] | undefined, id: string) => ids === undefined || ids.includes(id);
const inRange = (w: { from?: string; to?: string }, date: string) => (w.from === undefined || date >= w.from) && (w.to === undefined || date <= w.to);
const same = (want: string | undefined, actual: string | null) => want === undefined || want === actual;
function must<T extends { id: string }>(rows: T[], id: string, what: string): T {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`fake: no ${what} ${id}`);
  return row;
}
type Next = (prefix: string) => string;
type K<Keys extends keyof PresenceStore> = Pick<PresenceStore, Keys>;

function fakeReads(s: FakePresenceState): K<'priceListRecords' | 'acsRows' | 'calendarWindow' | 'attendanceStartDate' | 'sessions' | 'session' | 'sessionByKey' | 'attendances' | 'lessons' | 'lesson' | 'subscriptions' | 'subscription' | 'payments' | 'payment'> {
  return {
    priceListRecords: async () => copy(s.priceLists),
    acsRows: async (w) => copy(s.acs.filter((r) => same(w.athleteId, r.athleteId) && same(w.seasonId, r.seasonId))),
    calendarWindow: async () => copy(s.calendar),
    attendanceStartDate: async () => s.startDate,
    sessions: async (w = {}) => byId(s.sessions.filter((r) => inList(w.ids, r.id) && same(w.groupId, r.groupId) && inRange(w, r.date))),
    session: async (id) => copy(s.sessions.find((r) => r.id === id) ?? null),
    sessionByKey: async (key) => copy(s.sessions.find((r) => r.occurrenceKey === key) ?? null),
    attendances: async (w = {}) => byId(joined(s).filter((r) => inList(w.ids, r.id) && inList(w.sessionIds, r.sessionId) && same(w.athleteId, r.athleteId)
      && (w.subscriptionIds === undefined || (r.subscriptionId !== null && w.subscriptionIds.includes(r.subscriptionId)))
      && (w.billing === undefined || w.billing.includes(r.billing)) && inRange(w, r.sessionDate))),
    lessons: async (w = {}) => byId(s.lessons.filter((r) => inList(w.ids, r.id) && same(w.athleteId, r.athleteId) && inRange(w, r.date))),
    lesson: async (id) => copy(s.lessons.find((r) => r.id === id) ?? null),
    subscriptions: async (w = {}) => byId(s.subscriptions.filter((r) => inList(w.ids, r.id) && same(w.athleteId, r.athleteId))),
    subscription: async (id) => copy(s.subscriptions.find((r) => r.id === id) ?? null),
    payments: async (w = {}) => byId(s.payments.filter((r) => inList(w.ids, r.id) && same(w.athleteId, r.athleteId) && same(w.subscriptionId, r.subscriptionId)
      && same(w.lessonId, r.lessonId) && inRange(w, r.paidOn))),
    payment: async (id) => copy(s.payments.find((r) => r.id === id) ?? null),
  };
}

function joined(s: FakePresenceState): AttendanceRow[] {
  return s.attendances.map((a) => {
    const session = must(s.sessions, a.sessionId, 'session');
    return { ...a, sessionDate: session.date, groupId: session.groupId };
  });
}

function fakeSessionAndAttendanceWrites(s: FakePresenceState, next: Next): K<'createSession' | 'updateSession' | 'createAttendance' | 'updateAttendance' | 'deleteAttendance' | 'setAcs'> {
  return {
    createSession: async (d) => {
      if (d.occurrenceKey !== null && s.sessions.some((r) => r.occurrenceKey === d.occurrenceKey)) throw new UniqueKeyError(`occurrenceKey ${d.occurrenceKey}`);
      const id = next('s');
      s.sessions.push({ ...copy(d), id });
      return id;
    },
    updateSession: async (id, d) => {
      Object.assign(must(s.sessions, id, 'session'), copy(defined(d)));
    },
    createAttendance: async (d) => {
      if (s.attendances.some((r) => r.uniqueKey === d.uniqueKey)) throw new UniqueKeyError(`uniqueKey ${d.uniqueKey}`);
      const id = next('t');
      s.attendances.push({ ...copy(d), id });
      return id;
    },
    updateAttendance: async (id, d) => {
      Object.assign(must(s.attendances, id, 'attendance'), copy(defined(d)));
    },
    deleteAttendance: async (id) => {
      must(s.attendances, id, 'attendance');
      s.attendances = s.attendances.filter((r) => r.id !== id);
    },
    setAcs: async (athleteId, seasonId, state) => {
      const row = s.acs.find((r) => r.athleteId === athleteId && r.seasonId === seasonId);
      if (state === null) s.acs = s.acs.filter((r) => r !== row);
      else if (row) row.state = state;
      else s.acs.push({ id: `acs-${s.acs.length + 1}`, athleteId, seasonId, state });
    },
  };
}

function fakeMoneyWrites(s: FakePresenceState, next: Next): K<'createLesson' | 'updateLesson' | 'deleteLesson' | 'createSubscription' | 'updateSubscription' | 'deleteSubscription' | 'createPayment' | 'updatePayment' | 'deletePayment'> {
  return {
    createLesson: async (d) => { const id = next('l'); s.lessons.push({ ...copy(d), id }); return id; },
    updateLesson: async (id, d) => { Object.assign(must(s.lessons, id, 'lesson'), copy(defined(d))); },
    deleteLesson: async (id) => { must(s.lessons, id, 'lesson'); s.lessons = s.lessons.filter((r) => r.id !== id); },
    createSubscription: async (d) => { const id = next('sub'); s.subscriptions.push({ ...copy(d), id }); return id; },
    updateSubscription: async (id, d) => { Object.assign(must(s.subscriptions, id, 'subscription'), copy(defined(d))); },
    deleteSubscription: async (id) => { must(s.subscriptions, id, 'subscription'); s.subscriptions = s.subscriptions.filter((r) => r.id !== id); },
    createPayment: async (d) => { const id = next('p'); s.payments.push({ ...copy(d), id }); return id; },
    updatePayment: async (id, d) => { Object.assign(must(s.payments, id, 'payment'), copy(defined(d))); },
    deletePayment: async (id) => { must(s.payments, id, 'payment'); s.payments = s.payments.filter((r) => r.id !== id); },
  };
}

function fakePaymentJobs(s: FakePresenceState, next: Next): K<'createPaymentEmailJob' | 'cancelPaymentEmailJob' | 'sentPaymentEmailJobs'> {
  return {
    createPaymentEmailJob: async (job) => {
      const id = next('job');
      s.jobs.push({ ...copy(job), id, status: 'queued' });
      return id;
    },
    cancelPaymentEmailJob: async (paymentId) => {
      const queued = s.jobs.filter((j) => j.paymentId === paymentId && j.status === 'queued');
      for (const j of queued) j.status = 'cancelled';
      return queued.length;
    },
    sentPaymentEmailJobs: async (paymentId) => s.jobs.filter((j) => j.paymentId === paymentId && (j.status === 'sent' || j.status === 'sending')).length,
  };
}

function withFailures(store: PresenceStore, failing: Set<string>): PresenceStore {
  const wrapped: Record<string, unknown> = {};
  for (const [key, fn] of Object.entries(store) as [string, (...args: unknown[]) => Promise<unknown>][]) {
    wrapped[key] = (...args: unknown[]) => (failing.delete(key) ? Promise.reject(new Error(`fake failure in ${key}`)) : fn(...args));
  }
  return wrapped as unknown as PresenceStore;
}

const emptyState = (): FakePresenceState => ({
  sessions: [], attendances: [], lessons: [], subscriptions: [], payments: [], priceLists: copy(P_LISTS), acs: [], calendar: { events: [], blackouts: [] }, startDate: null, jobs: [],
});

/** In-memory PresenceStore over the group fake; a transaction restores presence and group state together when its work throws. */
export function fakePresenceStore(seed: FakePresenceSeed = {}): FakePresence {
  const { group: groupSeed = {}, ...own } = seed;
  const group = fakeGroupStore({ groups: copy(P_GROUPS), ...groupSeed });
  const state: FakePresenceState = { ...emptyState(), ...copy(own) };
  let n = 0;
  const next: Next = (prefix) => `${prefix}-${(n += 1)}`;
  let depth = 0;
  const lock = (kind: string) => async (id: string) => {
    if (depth === 0) throw new Error(`fake: lock on ${kind}:${id} outside a transaction`);
    group.state.locks.push(`${kind}:${id}`);
  };
  const base: PresenceStore = {
    ...group.store,
    async transaction<T>(work: () => Promise<T>): Promise<T> {
      const snapshot = structuredClone(state);
      depth += 1;
      try {
        return await group.store.transaction(work);
      } catch (err) {
        Object.assign(state, snapshot);
        throw err;
      } finally {
        depth -= 1;
      }
    },
    lockSession: lock('session'), lockLesson: lock('lesson'), lockSubscription: lock('subscription'), lockPayment: lock('payment'),
    ...fakeReads(state), ...fakeSessionAndAttendanceWrites(state, next), ...fakeMoneyWrites(state, next), ...fakePaymentJobs(state, next),
  };
  const failing = new Set<string>();
  const groupKeys = new Set(Object.keys(group.store));
  return {
    store: withFailures(base, failing), state, group: group.state,
    failOn: (method) => (method !== 'transaction' && groupKeys.has(method) ? group.failOn(method as never) : failing.add(method)),
  };
}

export type FakePresenceContext = FakePresence & { ctx: PresenceContext; logs: string[] };

/** A PresenceContext over the fake store; today 20 November 2026, now 10:00 UTC, unless given. */
export function fakePresenceContext(seed: FakePresenceSeed = {}, today = '2026-11-20'): FakePresenceContext {
  const fake = fakePresenceStore(seed);
  const logs: string[] = [];
  const ctx: PresenceContext = { store: fake.store, actor: 'admin@example.com', today, now: () => new Date(`${today}T10:00:00.000Z`), log: (m) => logs.push(m) };
  return { ...fake, ctx, logs };
}
