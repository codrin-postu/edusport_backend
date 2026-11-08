import { payLabel, payOf, lessonPaidMap, type PayInput } from '../presence/history/pay';
import { monthOf, monthTitle } from '../presence/dates';
import { clubMonths } from '../presence/due/settlement';
import { usesOf } from '../presence/subscriptions/usage';
import type { AttendanceRow, LessonRow, SessionRow } from '../presence/types';
import { TYPE_VALUES } from './catalog';
import { groupBy, nameOf } from './context';
import type { TableSources } from './sources';
import type { CellValue, GroupKey, TableDefinition, TableRow } from './types';

type Range = { from: string; to: string };
type Keys = Partial<Record<GroupKey, { key: string; label: string }[]>>;
type Shared = Pick<PayInput, 'slots' | 'lessonPaid'> & { units: Map<string, Map<string, number>>; months: (athleteId: string) => PayInput['clubMonths'] };

/** Place of each session in its abonament's use order, per athlete (an athlete has one row per session). */
function unitsByAthlete(src: TableSources, sessions: Map<string, SessionRow>): Map<string, Map<string, number>> {
  const attsBySub = groupBy(src.attendances.filter((a) => a.subscriptionId !== null), (a) => a.subscriptionId as string);
  const units = new Map<string, Map<string, number>>();
  for (const sub of src.subscriptions) {
    const own = units.get(sub.athleteId) ?? new Map<string, number>();
    for (const u of usesOf(sub, attsBySub.get(sub.id) ?? [], sessions, new Map())) own.set(u.sessionId, u.unit);
    units.set(sub.athleteId, own);
  }
  return units;
}

function sharedOf(src: TableSources, sessions: Map<string, SessionRow>): Shared {
  const names = new Map(src.groups.map((g) => [g.id, g.name] as const));
  const byAthlete = { atts: groupBy(src.attendances, (a) => a.athleteId), lessons: groupBy(src.lessons, (l) => l.athleteId), payments: groupBy(src.payments, (p) => p.athleteId) };
  const cache = new Map<string, PayInput['clubMonths']>();
  const months = (athleteId: string): PayInput['clubMonths'] => {
    const hit = cache.get(athleteId);
    if (hit) return hit;
    const made = clubMonths({
      attendances: byAthlete.atts.get(athleteId) ?? [], lessons: byAthlete.lessons.get(athleteId) ?? [], payments: byAthlete.payments.get(athleteId) ?? [], groupNames: names, startDate: src.startDate,
    });
    cache.set(athleteId, made);
    return made;
  };
  return {
    units: unitsByAthlete(src, sessions), slots: new Map(src.subscriptions.map((s) => [s.id, { slots: s.slots, code: s.code }] as const)), lessonPaid: lessonPaidMap(src.payments), months,
  };
}

const coachesOf = (ids: readonly string[], teamNames: Map<string, string>): { key: string; label: string }[] =>
  ids.flatMap((id) => (teamNames.has(id) ? [{ key: id, label: teamNames.get(id) as string }] : []));

type Ctx = { src: TableSources; shared: Shared; names: Map<string, string>; groups: Map<string, { id: string; name: string; sectionId: string | null }>; sections: Map<string, string> };

function keysOf(c: Ctx, groupId: string | null, date: string, coachIds: readonly string[]): Keys {
  const group = groupId === null ? undefined : c.groups.get(groupId);
  const keys: Keys = { luna: [{ key: monthOf(date), label: monthTitle(monthOf(date)) }], antrenor: coachesOf(coachIds, c.src.teamNames) };
  if (group) keys.grupa = [{ key: group.id, label: group.name }];
  const sectionName = group?.sectionId ? c.sections.get(group.sectionId) : undefined;
  if (group?.sectionId && sectionName) keys.sectiune = [{ key: group.sectionId, label: sectionName }];
  return keys;
}

function attendanceRow(a: AttendanceRow, session: SessionRow | undefined, c: Ctx): TableRow {
  const input: PayInput = { row: { kind: 'grup', attendance: a }, subscriptionUnits: c.shared.units.get(a.athleteId) ?? new Map(), slots: c.shared.slots, clubMonths: c.shared.months(a.athleteId), lessonPaid: c.shared.lessonPaid };
  const keys = keysOf(c, a.groupId, a.sessionDate, session?.coachIds ?? []);
  const cells: Record<string, CellValue> = {
    data: a.sessionDate, ora: session?.startTime ?? null, sportiv: c.names.get(a.athleteId) ?? '', grupa: keys.grupa?.[0].label ?? null, tip: TYPE_VALUES[0],
    antrenor: (keys.antrenor ?? []).map((k) => k.label).join(', ') || null, plata: payLabel(payOf(input)), suma: a.amount,
  };
  return { athleteId: a.athleteId, groupKeys: keys, cells };
}

function lessonRow(l: LessonRow, c: Ctx): TableRow {
  const input: PayInput = { row: { kind: 'individual', lesson: l }, subscriptionUnits: new Map(), slots: c.shared.slots, clubMonths: [], lessonPaid: c.shared.lessonPaid };
  const keys = keysOf(c, null, l.date, l.coachIds);
  const cells: Record<string, CellValue> = {
    data: l.date, ora: l.startTime, sportiv: c.names.get(l.athleteId) ?? '', grupa: null, tip: TYPE_VALUES[1],
    antrenor: (keys.antrenor ?? []).map((k) => k.label).join(', ') || null, plata: payLabel(payOf(input)), suma: l.amount,
  };
  return { athleteId: l.athleteId, groupKeys: keys, cells };
}

const byDateTime = (a: TableRow, b: TableRow): number =>
  String(a.cells.data).localeCompare(String(b.cells.data)) || String(a.cells.ora).localeCompare(String(b.cells.ora)) || String(a.cells.sportiv).localeCompare(String(b.cells.sportiv), 'ro');

/** One row per attendance and per held individual lesson in the period; a session's coaches all appear in `groupKeys.antrenor` and the row counts once. */
export function prezentaRows(src: TableSources, _d: TableDefinition, period: Range): TableRow[] {
  if (src.season === null) return [];
  const sessions = new Map(src.sessions.map((s) => [s.id, s] as const));
  const c: Ctx = {
    src, shared: sharedOf(src, sessions), names: nameOf(src), groups: new Map(src.groups.map((g) => [g.id, g] as const)),
    sections: new Map(src.sections.map((s) => [s.id, s.name] as const)),
  };
  const inPeriod = (date: string): boolean => period.from <= date && date <= period.to;
  const attendances = src.attendances.filter((a) => inPeriod(a.sessionDate) && (!src.restricted || src.scopeGroupIds.has(a.groupId)));
  const held = src.lessons.filter((l) => l.state === 'saved' && l.present === true && inPeriod(l.date) && (!src.restricted || src.scopeAthleteIds.has(l.athleteId)));
  return [...attendances.map((a) => attendanceRow(a, sessions.get(a.sessionId), c)), ...held.map((l) => lessonRow(l, c))].sort(byDateTime);
}
