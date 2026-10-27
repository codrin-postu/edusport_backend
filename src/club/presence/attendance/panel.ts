import type { AdminResult } from '../../admin-result';
import { SUBJECT } from '../../subjects';
import { hhmm, isIsoDate, isTime } from '../../groups/dates';
import type { GroupRecord } from '../../groups/types';
import { PRESENCE_ERRORS } from '../copy/core';
import { seasonOfDate } from '../dates';
import { sessionHistoryTexts } from '../history-lines';
import { abonamentStatusText, pickSubscription, remainingOf, usedSlots } from '../subscriptions';
import { heldOccurrences, readOccurrenceKey } from '../sessions';
import type { PresenceStore } from '../store';
import type { AttendanceRow, HeldOccurrence, SessionRow, SessionSource, SubscriptionRow } from '../types';
import { loadRowContext, type RowContext } from './day';
import { mainGroupOn, rosterOn } from './roster';
import { isDuration, outsideFor, savedLine } from './view';
import type { AddedSession, PanelRow, SectionKind, SessionPanel } from './api-types';

export type PanelQuery = { id: string } | { occurrence: string } | { added: AddedSession };
type Target = {
  session: SessionRow | null; groupId: string; date: string; startTime: string; durationMin: number; occurrenceKey: string | null; source: SessionSource;
  added: AddedSession | null;
};
type PanelAthlete = { name: string; status: string };

/** The panel query: a session id, an occurrence key, or a new session's group, date, time and duration. */
export function readPanelQuery(q: Record<string, unknown>): PanelQuery | null {
  if (typeof q.id === 'string') return { id: q.id };
  if (typeof q.occurrence === 'string') return { occurrence: q.occurrence };
  return readAdded(q);
}

function readAdded(q: Record<string, unknown>): PanelQuery | null {
  const durationMin = Number(q.duration);
  if (typeof q.group !== 'string' || !isIsoDate(q.date) || !isTime(q.time) || !isDuration(durationMin)) return null;
  return { added: { groupId: q.group, date: q.date, startTime: q.time, durationMin } };
}

const fromSession = (s: SessionRow): Target => ({
  session: s, groupId: s.groupId, date: s.date, startTime: hhmm(s.startTime) ?? s.startTime, durationMin: s.durationMin,
  occurrenceKey: s.occurrenceKey, source: s.source, added: null,
});

const fromHeld = (h: HeldOccurrence): Target => ({
  session: null, groupId: h.groupId, date: h.date, startTime: hhmm(h.startTime) ?? h.startTime, durationMin: h.durationMin,
  occurrenceKey: h.key, source: 'schedule', added: null,
});

async function occurrenceTarget(store: PresenceStore, ctx: RowContext, key: string): Promise<Target | null> {
  const parts = readOccurrenceKey(key);
  if (!parts) return null;
  const saved = await store.sessionByKey(key);
  if (saved) return fromSession(saved);
  const held = heldOccurrences(await store.calendarWindow(), ctx.groups, parts.date, parts.date).find((h) => h.key === key);
  return held ? fromHeld(held) : null;
}

function addedTarget(ctx: RowContext, a: AddedSession): Target | null {
  if (!ctx.groups.some((g) => g.id === a.groupId && g.active)) return null;
  return { session: null, groupId: a.groupId, date: a.date, startTime: a.startTime, durationMin: a.durationMin, occurrenceKey: null, source: 'added', added: a };
}

async function resolveTarget(store: PresenceStore, ctx: RowContext, q: PanelQuery): Promise<Target | null> {
  if ('id' in q) {
    const s = await store.session(q.id);
    return s ? fromSession(s) : null;
  }
  if ('added' in q) return addedTarget(ctx, q.added);
  return occurrenceTarget(store, ctx, q.occurrence);
}

/** The session panel (spec 5.3): the group's list on the date, its visitors, ticks, abonamente, Istoric. */
export async function readSessionPanel(store: PresenceStore, q: PanelQuery, today: string): Promise<AdminResult<SessionPanel>> {
  const ctx = await loadRowContext(store, today);
  const target = await resolveTarget(store, ctx, q);
  const group = target ? ctx.groups.find((g) => g.id === target.groupId) : undefined;
  if (!target || !group) return { ok: false, status: 404, error: PRESENCE_ERRORS.notFound };
  return { ok: true, data: await buildPanel(store, ctx, target, group) };
}

async function buildPanel(store: PresenceStore, ctx: RowContext, t: Target, group: GroupRecord): Promise<SessionPanel> {
  const held = heldOccurrences(await store.calendarWindow(), ctx.groups, t.date, t.date);
  const seasonId = t.session?.seasonId ?? seasonOfDate(ctx.seasons, t.date)?.id ?? null;
  const atts = t.session ? await store.attendances({ sessionIds: [t.session.id] }) : [];
  const athletes = new Map((await store.athletes()).map((a) => [a.id, { name: a.name, status: a.status }]));
  const names = Object.fromEntries([...ctx.teamNames, ...[...athletes].map(([id, a]) => [id, a.name] as const)]);
  const kind = await kindOf(store, group.sectionId);
  return {
    sessionId: t.session?.id ?? null, occurrenceKey: t.occurrenceKey, added: t.added, groupId: group.id, groupName: group.name, kind,
    date: t.date, startTime: t.startTime, durationMin: t.durationMin,
    outsideSchedule: outsideFor({ source: t.source, groupId: t.groupId, date: t.date, startTime: t.startTime }, held),
    coachIds: t.session ? t.session.coachIds : group.coachIds,
    rows: await panelRows(store, ctx, t, group, kind, seasonId, atts, athletes),
    savedLine: await savedLineOf(store, t.session), history: await historyOf(store, t.session, names),
  };
}

export async function kindOf(store: PresenceStore, sectionId: string | null): Promise<SectionKind> {
  const section = (await store.sections()).find((s) => s.id === sectionId);
  return section?.kind ?? 'school';
}

async function panelRows(
  store: PresenceStore, ctx: RowContext, t: Target, group: GroupRecord, kind: SectionKind, seasonId: string | null,
  atts: AttendanceRow[], athletes: Map<string, PanelAthlete>,
): Promise<PanelRow[]> {
  const listed = seasonId ? rosterOn(ctx.memberships, group.id, seasonId, t.date) : [];
  const statuses = await abonamentStatuses(store, listed, kind === 'school' ? group.priceListId : null, t.date);
  const onList = listed.map((id) => rowOf(id, athletes, atts, { visitor: false, mainGroup: null, abonament: statuses.get(id) ?? null }));
  const visitors = atts.filter((a) => a.visitor && !listed.includes(a.athleteId))
    .map((a) => rowOf(a.athleteId, athletes, atts, { visitor: true, mainGroup: mainGroupName(ctx, a.athleteId, seasonId, t.date), abonament: null }));
  return [...byName(onList, athletes), ...byName(visitors, athletes)];
}

function rowOf(
  id: string, athletes: Map<string, PanelAthlete>, atts: AttendanceRow[], extra: Pick<PanelRow, 'visitor' | 'mainGroup' | 'abonament'>,
): PanelRow {
  const a = atts.find((x) => x.athleteId === id);
  return {
    athleteId: id, name: athletes.get(id)?.name ?? '', inactive: athletes.get(id)?.status === 'inactiv', ...extra,
    grup: a?.grup ?? false, uscat: a?.uscat ?? false, noSubscription: a?.billing === 'fara_abonament',
  };
}

const byName = (rows: PanelRow[], athletes: Map<string, PanelAthlete>): PanelRow[] =>
  [...rows].sort((x, y) => (athletes.get(x.athleteId)?.name ?? '').localeCompare(athletes.get(y.athleteId)?.name ?? '', 'ro'));

function mainGroupName(ctx: RowContext, athleteId: string, seasonId: string | null, date: string): string | null {
  if (!seasonId) return null;
  const groupId = mainGroupOn(ctx.memberships, athleteId, seasonId, date);
  return ctx.groups.find((g) => g.id === groupId)?.name ?? null;
}

/** Abonament status per listed athlete: the subscription the session would use on the date (4.10). Empty at Club. */
async function abonamentStatuses(store: PresenceStore, listed: string[], priceListId: string | null, date: string): Promise<Map<string, string>> {
  if (!priceListId || listed.length === 0) return new Map();
  const subs: SubscriptionRow[] = await store.subscriptions();
  const used = usedSlots(subs.length > 0 ? await store.attendances({ subscriptionIds: subs.map((s) => s.id) }) : []);
  return new Map(listed.map((id) => {
    const sub = pickSubscription(subs.filter((s) => s.athleteId === id), used, priceListId, date);
    return [id, abonamentStatusText(sub ? remainingOf(sub, used) : null)];
  }));
}

async function savedLineOf(store: PresenceStore, s: SessionRow | null): Promise<string | null> {
  if (!s) return null;
  const names = await store.adminNames([s.savedBy]);
  return savedLine(names[s.savedBy] ?? s.savedBy, s.savedAt);
}

async function historyOf(store: PresenceStore, s: SessionRow | null, names: Record<string, string>): Promise<string[]> {
  if (!s) return [];
  return (await store.history(SUBJECT.session, s.id)).flatMap((h) => sessionHistoryTexts(h.action, h.changes, names));
}
