import type { AcsRow, AthleteRow, MembershipRow } from '../athletes/store';
import { isCurrentMembership } from '../group-membership';
import type { GroupRecord, SeasonRecord, SectionRecord } from '../groups/types';
import type { PresenceStore } from '../presence/store';
import type { AttendanceRow, LessonRow, PaymentRow, SessionRow, SubscriptionRow } from '../presence/types';
import type { TableDefinition } from './types';

type Range = { from: string; to: string };

/** Every table a row builder reads, loaded once per query and restricted by the scope; tables a subject does not need are empty. */
export type TableSources = {
  /** The scope's season; null when the id is unknown (every table is then empty). */
  season: SeasonRecord | null;
  seasons: SeasonRecord[];
  /** Every athlete read (names), not only the scope's. */
  athletes: AthleteRow[];
  /** The scope season's memberships, ended ones included. */
  memberships: MembershipRow[];
  groups: GroupRecord[];
  sections: SectionRecord[];
  teamNames: Map<string, string>;
  acs: AcsRow[];
  attendances: AttendanceRow[];
  sessions: SessionRow[];
  lessons: LessonRow[];
  subscriptions: SubscriptionRow[];
  payments: PaymentRow[];
  /** Admin e-mail to name, for "Înregistrat de". */
  adminNames: Record<string, string>;
  startDate: string | null;
  /** Groups the scope names (its section and group); every group of the season when it names none. */
  scopeGroupIds: Set<string>;
  /** True when the scope names a section or a group. */
  restricted: boolean;
  /** Athletes with a current membership in a scope group. */
  scopeAthleteIds: Set<string>;
};

const emptySources = (seasons: SeasonRecord[]): TableSources => ({
  season: null, seasons, athletes: [], memberships: [], groups: [], sections: [], teamNames: new Map(), acs: [], attendances: [], sessions: [], lessons: [],
  subscriptions: [], payments: [], adminNames: {}, startDate: null, scopeGroupIds: new Set(), restricted: false, scopeAthleteIds: new Set(),
});

export const inRange = (date: string, r: Range): boolean => r.from <= date && date <= r.to;
const min = (values: string[]): string | null => values.reduce<string | null>((m, v) => (m === null || v < m ? v : m), null);
const max = (values: string[]): string | null => values.reduce<string | null>((m, v) => (m === null || v > m ? v : m), null);

/** Whether the athlete is inside the scope: a member of a scope group, or anybody when the scope names no section or group. */
export const inScope = (src: Pick<TableSources, 'restricted' | 'scopeAthleteIds'>, athleteId: string): boolean => !src.restricted || src.scopeAthleteIds.has(athleteId);

function scopeOf(d: TableDefinition, groups: GroupRecord[], memberships: MembershipRow[]): Pick<TableSources, 'scopeGroupIds' | 'restricted' | 'scopeAthleteIds'> {
  const { sectionId, groupId } = d.scope;
  const scopeGroupIds = new Set(groups.filter((g) => (sectionId === null || g.sectionId === sectionId) && (groupId === null || g.id === groupId)).map((g) => g.id));
  const scopeAthleteIds = new Set(memberships.filter((m) => isCurrentMembership(m) && scopeGroupIds.has(m.groupId)).map((m) => m.athleteId));
  return { scopeGroupIds, restricted: sectionId !== null || groupId !== null, scopeAthleteIds };
}

const keepScope = <T extends { athleteId: string }>(src: Pick<TableSources, 'restricted' | 'scopeAthleteIds'>, rows: T[]): T[] => rows.filter((r) => inScope(src, r.athleteId));

type Base = Pick<TableSources, 'athletes' | 'memberships' | 'groups' | 'sections' | 'teamNames'>;

async function readBase(store: PresenceStore, seasonId: string): Promise<Base> {
  const [athletes, memberships, groups, sections, team] = await Promise.all([
    store.athletes(), store.memberships({ seasonId }), store.groups(), store.sections(), store.teamMembers(),
  ]);
  return { athletes, memberships, groups, sections, teamNames: new Map(team.map((t) => [t.id, t.name] as const)) };
}

type Extra = Partial<Omit<TableSources, keyof Base | 'season' | 'seasons' | 'scopeGroupIds' | 'restricted' | 'scopeAthleteIds'>>;

/** Sportivi: subscriptions and payments of the scope's athletes, club-month inputs, and the attendances the current abonament's count needs. */
async function readSportivi(store: PresenceStore, seasonId: string, range: Range, season: SeasonRecord, src: TableSources): Promise<Extra> {
  const [acs, allSubs, payments, startDate, lessons] = await Promise.all([
    store.acsRows({ seasonId }), store.subscriptions(), store.payments(), store.attendanceStartDate(), store.lessons(range),
  ]);
  const subscriptions = keepScope(src, allSubs);
  const attendances = await store.attendances({
    from: min([season.startMonth, range.from, ...subscriptions.map((s) => s.startsOn)]) ?? range.from,
    to: max([season.endMonth, range.to, ...subscriptions.map((s) => s.validUntil)]) ?? range.to,
  });
  return { acs, subscriptions, payments: keepScope(src, payments), startDate, lessons: keepScope(src, lessons), attendances: keepScope(src, attendances) };
}

async function readAbonamente(store: PresenceStore, range: Range, src: TableSources): Promise<Extra> {
  const subscriptions = keepScope(src, await store.subscriptions()).filter((s) => inRange(s.startsOn, range));
  const ids = subscriptions.map((s) => s.id);
  const [attendances, payments] = await Promise.all([ids.length > 0 ? store.attendances({ subscriptionIds: ids }) : Promise.resolve([]), store.payments()]);
  const wanted = new Set(ids);
  return { subscriptions, attendances, payments: payments.filter((p) => p.subscriptionId !== null && wanted.has(p.subscriptionId)) };
}

async function readPlati(store: PresenceStore, range: Range, src: TableSources): Promise<Extra> {
  const payments = keepScope(src, await store.payments(range));
  const subIds = [...new Set(payments.flatMap((p) => (p.subscriptionId === null ? [] : [p.subscriptionId])))];
  const emails = [...new Set(payments.map((p) => p.recordedBy))];
  const [subscriptions, adminNames] = await Promise.all([
    subIds.length > 0 ? store.subscriptions({ ids: subIds }) : Promise.resolve([]), emails.length > 0 ? store.adminNames(emails) : Promise.resolve({}),
  ]);
  return { payments, subscriptions, adminNames };
}

/** Prezență: attendances, abonamente and payments are not narrowed to the scope's athletes (a visitor in a group still needs his own abonament and Club month); attendances and sessions run from the season start (or the earliest abonament start) to the period end, so "Ședința 3/8" counts earlier uses. */
async function readPrezenta(store: PresenceStore, range: Range, season: SeasonRecord): Promise<Extra> {
  const subscriptions = await store.subscriptions();
  const wide = { from: min([season.startMonth, range.from, ...subscriptions.map((s) => s.startsOn)]) ?? range.from, to: max([season.endMonth, range.to]) ?? range.to };
  const [sessions, attendances, lessons, payments, startDate] = await Promise.all([
    store.sessions(wide), store.attendances(wide), store.lessons(range), store.payments(), store.attendanceStartDate(),
  ]);
  return { sessions, attendances, lessons, subscriptions, payments, startDate };
}

/** One bulk read per source table the subject needs, restricted by the scope; nothing is read per row. */
export async function loadSources(store: PresenceStore, d: TableDefinition, period: Range): Promise<TableSources> {
  const seasons = await store.seasons();
  const season = seasons.find((s) => s.id === d.scope.seasonId) ?? null;
  if (season === null) return emptySources(seasons);
  const base = await readBase(store, season.id);
  const src: TableSources = { ...emptySources(seasons), ...base, season, ...scopeOf(d, base.groups, base.memberships) };
  const extra = await readExtra(store, d, period, season, src);
  return { ...src, ...extra };
}

function readExtra(store: PresenceStore, d: TableDefinition, period: Range, season: SeasonRecord, src: TableSources): Promise<Extra> {
  switch (d.subject) {
    case 'sportivi': return readSportivi(store, season.id, period, season, src);
    case 'abonamente': return readAbonamente(store, period, src);
    case 'plati': return readPlati(store, period, src);
    default: return readPrezenta(store, period, season);
  }
}
