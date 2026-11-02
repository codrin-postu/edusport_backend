import { isIsoDate } from '../../groups/dates';
import { isRecord } from '../../narrow';
import type { Audience } from '../../price-item';
import { clubCharges } from '../billing';
import { attendanceKey } from '../sessions';
import { pickSubscription } from '../subscriptions';
import type { AttendanceWrite, PriceListRecord, SubscriptionRow } from '../types';
import type { AddedSession, SectionKind, SessionSaveBody, Tick } from './api-types';
import { isDuration, isTime } from './view';

export type RowPlan = {
  creates: AttendanceWrite[]; updates: { id: string; data: Partial<AttendanceWrite> }[]; deletes: string[]; added: string[]; removed: string[];
  uscatTicked: string[]; newVisitors: string[];
};
export type PlanInput = {
  sessionId: string; kind: SectionKind; listed: string[]; existing: (AttendanceWrite & { id: string })[]; ticks: Tick[]; list: PriceListRecord | null;
  subs: SubscriptionRow[]; used: Map<string, number>; date: string; audience: (athleteId: string) => Audience;
};
type Existing = PlanInput['existing'][number];

/** School counts the group tick only (Uscat is a Club item, decided 4); Club counts either. */
export const isTicked = (kind: SectionKind, t: Pick<Tick, 'grup' | 'uscat'> | undefined): boolean =>
  t !== undefined && (kind === 'school' ? t.grup : t.grup || t.uscat);

function schoolRow(i: PlanInput, athleteId: string, used: Map<string, number>): Pick<AttendanceWrite, 'billing' | 'subscriptionId' | 'charges' | 'amount' | 'audience' | 'grup' | 'uscat'> {
  const sub = i.list ? pickSubscription(i.subs.filter((s) => s.athleteId === athleteId), used, i.list.id, i.date) : null;
  if (sub) used.set(sub.id, (used.get(sub.id) ?? 0) + 1);
  return { grup: true, uscat: false, billing: sub ? 'slot' : 'fara_abonament', subscriptionId: sub?.id ?? null, charges: [], amount: 0, audience: null };
}

function clubRow(i: PlanInput, t: Tick): Pick<AttendanceWrite, 'billing' | 'subscriptionId' | 'charges' | 'amount' | 'audience' | 'grup' | 'uscat'> {
  const audience = i.audience(t.athleteId);
  return { grup: t.grup, uscat: t.uscat, subscriptionId: null, audience, ...clubCharges(i.list, t, audience) };
}

function newRow(i: PlanInput, t: Tick, used: Map<string, number>): AttendanceWrite {
  const priced = i.kind === 'school' ? schoolRow(i, t.athleteId, used) : clubRow(i, t);
  return { sessionId: i.sessionId, athleteId: t.athleteId, uniqueKey: attendanceKey(i.sessionId, t.athleteId), visitor: !i.listed.includes(t.athleteId), ...priced };
}

function repriced(i: PlanInput, row: Existing, t: Tick, plan: RowPlan): void {
  if (i.kind !== 'club' || (row.grup === t.grup && row.uscat === t.uscat)) return;
  const { grup, uscat, billing, charges, amount, audience } = clubRow(i, t);
  plan.updates.push({ id: row.id, data: { grup, uscat, billing, charges, amount, audience } });
  if (!row.uscat && t.uscat) plan.uscatTicked.push(t.athleteId);
}

/** "x" of "x din y" after a save: rows of athletes on the list that stay or are added; visitors are in neither x nor y (C42). Pure. */
export function presentAfter(existing: PlanInput['existing'], plan: RowPlan, listed: string[]): number {
  const kept = existing.filter((r) => !plan.deletes.includes(r.id)).map((r) => r.athleteId);
  const added = plan.creates.map((r) => r.athleteId);
  return [...kept, ...added].filter((id) => listed.includes(id)).length;
}

/** What a save does to the session's rows (spec 4.8 to 4.13). Pure; the slot map is copied, so two rows never take one last slot. */
export function planRows(i: PlanInput): RowPlan {
  const plan: RowPlan = { creates: [], updates: [], deletes: [], added: [], removed: [], uscatTicked: [], newVisitors: [] };
  const used = new Map(i.used);
  const ticks = new Map(i.ticks.map((t) => [t.athleteId, t]));
  for (const row of i.existing) {
    if (isTicked(i.kind, ticks.get(row.athleteId))) continue;
    plan.deletes.push(row.id);
    plan.removed.push(row.athleteId);
  }
  for (const t of i.ticks.filter((x) => isTicked(i.kind, x))) {
    const row = i.existing.find((r) => r.athleteId === t.athleteId);
    if (row) repriced(i, row, t, plan);
    else addRow(i, t, used, plan);
  }
  return plan;
}

function addRow(i: PlanInput, t: Tick, used: Map<string, number>, plan: RowPlan): void {
  const row = newRow(i, t, used);
  plan.creates.push(row);
  plan.added.push(t.athleteId);
  if (row.visitor) plan.newVisitors.push(t.athleteId);
}

const idList = (v: unknown): string[] | null => (Array.isArray(v) && v.every((x) => typeof x === 'string' && x !== '') ? [...new Set(v as string[])] : null);

function readTicks(v: unknown): Tick[] | null {
  if (!Array.isArray(v)) return null;
  const ticks: Tick[] = [];
  for (const t of v) {
    if (!isRecord(t) || typeof t.athleteId !== 'string' || t.athleteId === '' || typeof t.grup !== 'boolean' || typeof t.uscat !== 'boolean') return null;
    ticks.push({ athleteId: t.athleteId, grup: t.grup, uscat: t.uscat });
  }
  return ticks;
}

function readAdded(v: unknown): AddedSession | null {
  if (!isRecord(v) || typeof v.groupId !== 'string' || v.groupId === '' || !isIsoDate(v.date) || !isTime(v.startTime) || !isDuration(v.durationMin)) return null;
  return { groupId: v.groupId, date: v.date, startTime: v.startTime, durationMin: v.durationMin };
}

function readTarget(b: Record<string, unknown>): Pick<SessionSaveBody, 'id' | 'occurrence' | 'added'> | null {
  const present = ['id', 'occurrence', 'added'].filter((k) => b[k] !== undefined);
  if (present.length !== 1) return null;
  if (typeof b.id === 'string' && b.id !== '') return { id: b.id };
  if (typeof b.occurrence === 'string' && b.occurrence !== '') return { occurrence: b.occurrence };
  const added = readAdded(b.added);
  return added ? { added } : null;
}

/** The save body, or null when it is malformed. An empty coach list is read; the writer refuses it. */
export function readSaveBody(body: unknown): SessionSaveBody | null {
  if (!isRecord(body)) return null;
  const target = readTarget(body);
  const coachIds = idList(body.coachIds);
  const ticks = readTicks(body.ticks);
  const reactivate = body.reactivate === undefined ? [] : idList(body.reactivate);
  const keepInactive = body.keepInactive === undefined ? [] : idList(body.keepInactive);
  if (!target || !coachIds || !ticks || !reactivate || !keepInactive) return null;
  return { ...target, coachIds, ticks, reactivate, keepInactive };
}
