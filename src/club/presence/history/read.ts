import { refuse, type AdminResult } from '../../admin-result';
import { ADMIN_ERRORS } from '../../athletes/errors';
import { currentSeason } from '../../groups/season-pick';
import type { SeasonRecord } from '../../groups/types';
import type { HistoryRow, PresenceHistory } from '../attendance/api-types';
import { HISTORY_DETAIL } from '../copy/prezenta-ui';
import { groupNameMap } from '../due/reads';
import { clubMonths } from '../due/settlement';
import type { PresenceStore } from '../store';
import { usesOf } from '../subscriptions/usage';
import type { AttendanceRow, LessonRow, SessionRow } from '../types';
import { detailOf, lessonPaidMap, payOf, type PayInput } from './pay';

const PAGE_SIZE = 10;
type Timed = { date: string; startTime: string; id: string };
const newestFirst = (a: Timed, b: Timed): number => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime) || b.id.localeCompare(a.id);

/** 1 when absent; a whole number from 1 up, as a number or as query text. */
function readPage(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return 1;
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

const seasonOf = (seasons: SeasonRecord[], id: unknown): SeasonRecord | null =>
  typeof id === 'string' && id !== '' ? (seasons.find((s) => s.id === id) ?? null) : currentSeason(seasons);

/** The units of every abonament the page touches: one subscription read, one attendance read, one session read (4.3a). */
async function unitsOf(store: PresenceStore, atts: readonly AttendanceRow[]): Promise<Pick<PayInput, 'subscriptionUnits' | 'slots'>> {
  const ids = [...new Set(atts.flatMap((a) => (a.subscriptionId === null ? [] : [a.subscriptionId])))];
  if (ids.length === 0) return { subscriptionUnits: new Map(), slots: new Map() };
  const [subs, all] = await Promise.all([store.subscriptions({ ids }), store.attendances({ subscriptionIds: ids })]);
  const sessions = new Map<string, SessionRow>((await store.sessions({ ids: [...new Set(all.map((a) => a.sessionId))] })).map((s) => [s.id, s] as const));
  const subscriptionUnits = new Map<string, number>();
  for (const sub of subs) for (const u of usesOf(sub, all, sessions, new Map())) subscriptionUnits.set(u.sessionId, u.unit);
  return { subscriptionUnits, slots: new Map(subs.map((s) => [s.id, { slots: s.slots, code: s.code }] as const)) };
}

/** Club months and lesson payments of the athlete in the season: one read each, bounded by one athlete. */
async function ledgerOf(store: PresenceStore, athleteId: string, season: SeasonRecord): Promise<Pick<PayInput, 'clubMonths' | 'lessonPaid'>> {
  const range = { from: season.startMonth, to: season.endMonth };
  const [attendances, lessons, payments, groups, startDate] = await Promise.all([
    store.attendances({ athleteId, ...range }), store.lessons({ athleteId, ...range }), store.payments({ athleteId }), store.groups(), store.attendanceStartDate(),
  ]);
  return { clubMonths: clubMonths({ attendances, lessons, payments, groupNames: groupNameMap(groups), startDate }), lessonPaid: lessonPaidMap(payments) };
}

type Merged = { time: Timed; source: PayInput['row'] };

function merge(atts: readonly (AttendanceRow & { startTime: string })[], lessons: readonly LessonRow[]): Merged[] {
  const rows: Merged[] = [
    ...atts.map((a): Merged => ({ time: { date: a.sessionDate, startTime: a.startTime, id: a.id }, source: { kind: 'grup', attendance: a } })),
    ...lessons.map((l): Merged => ({ time: l, source: { kind: 'individual', lesson: l } })),
  ];
  return rows.sort((a, b) => newestFirst(a.time, b.time));
}

/** The group name, or "Cu <antrenor>" with the lesson's coaches. */
function placeResolver(groups: Map<string, string>, coaches: Map<string, string>): (s: PayInput['row']) => string {
  return (s) => {
    if (s.kind === 'grup') return groups.get(s.attendance.groupId) ?? '';
    const names = s.lesson.coachIds.flatMap((id) => coaches.get(id) ?? []);
    return names.length > 0 ? HISTORY_DETAIL.with(names.join(', ')) : '';
  };
}

const idsOf = (s: PayInput['row']): Pick<HistoryRow, 'kind' | 'sessionId' | 'lessonId'> =>
  s.kind === 'grup' ? { kind: 'grup', sessionId: s.attendance.sessionId, lessonId: null } : { kind: 'individual', sessionId: null, lessonId: s.lesson.id };

/** The athlete's presence history of a season, 10 rows a page, newest first, with what paid for each row (4.3). */
export async function readPresenceHistory(store: PresenceStore, athleteId: string, seasonId: unknown, page: unknown): Promise<AdminResult<PresenceHistory>> {
  const pageNo = readPage(page);
  if (pageNo === null) return refuse(400, ADMIN_ERRORS.invalid);
  const season = seasonOf(await store.seasons(), seasonId);
  if (!season || !(await store.athlete(athleteId))) return refuse(404, ADMIN_ERRORS.notFound);
  const take = PAGE_SIZE * pageNo;
  const [att, les, team, groups] = await Promise.all([
    store.athleteAttendancePage(athleteId, season.startMonth, season.endMonth, take), store.athleteLessonPage(athleteId, season.startMonth, season.endMonth, take),
    store.teamMembers(), store.groups(),
  ]);
  const picked = merge(att.rows, les.rows).slice(take - PAGE_SIZE, take);
  const units = await unitsOf(store, picked.flatMap((m) => (m.source.kind === 'grup' ? [m.source.attendance] : [])));
  const ledger = await ledgerOf(store, athleteId, season);
  const placeOf = placeResolver(groupNameMap(groups), new Map(team.map((t) => [t.id, t.name] as const)));
  const rows = picked.map((m): HistoryRow => {
    const input: PayInput = { row: m.source, ...units, ...ledger };
    return { ...idsOf(m.source), date: m.time.date, startTime: m.time.startTime, place: placeOf(m.source), pay: payOf(input), detail: detailOf(input) };
  });
  return { ok: true, data: { seasonLabel: season.label, total: att.total + les.total, page: pageNo, pageSize: PAGE_SIZE, rows } };
}
