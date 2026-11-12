import { ageOnIso, currentSeason } from '../../groups/season-pick';
import { isAnonymized } from '../../personal-data/anonymize-plan';
import { groupNameMap } from '../../presence/due/reads';
import type { AttendanceRow, LessonRow, SessionRow } from '../../presence/types';
import type { HistoryRow, SportivHistory, SportivProfile } from './api-types';
import type { SportivContext } from './context';
import { toHistory, toProfile } from './views';

const PAGE_SIZE = 20;

/** 1 for anything but a whole number from 1 up, as a number or as query text. */
export function readHistoryPage(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n >= 1 ? n : 1;
}

/** One history line with the order keys it sorts by, newest first. */
type Entry = { date: string; startTime: string; id: string; row: HistoryRow };

const cmpText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const newestFirst = (a: Entry, b: Entry): number => cmpText(b.date, a.date) || cmpText(b.startTime, a.startTime) || cmpText(b.id, a.id);

/** Coach names of the given team member ids; ids never leave. */
function coachNames(ids: readonly string[], names: ReadonlyMap<string, string>): string[] {
  return ids.map((id) => names.get(id)).filter((n): n is string => n !== undefined);
}

function groupEntry(a: AttendanceRow, session: SessionRow | undefined, groups: ReadonlyMap<string, string>, names: ReadonlyMap<string, string>): Entry {
  const startTime = session?.startTime ?? '';
  return {
    date: a.sessionDate, startTime, id: a.id,
    row: { date: a.sessionDate, startTime: session?.startTime ?? null, kind: 'Grup', groupName: groups.get(a.groupId) ?? null, coaches: coachNames(session?.coachIds ?? [], names) },
  };
}

function lessonEntry(l: LessonRow, names: ReadonlyMap<string, string>): Entry {
  return {
    date: l.date, startTime: l.startTime, id: l.id,
    row: { date: l.date, startTime: l.startTime, kind: 'Individual', groupName: null, coaches: coachNames(l.coachIds, names) },
  };
}

/**
 * Istoric prezență (spec 6.4): the athlete's presences of the current season, newest first, 20 a page.
 * A group presence is a group or dry-land mark (uscat counts as grup), whatever its group; a lesson counts when held and present.
 * Callers check that the holder holds the athlete.
 */
export async function readHistory(c: SportivContext, athleteId: string, page: unknown): Promise<SportivHistory> {
  const store = c.presence.store;
  const pageNo = readHistoryPage(page);
  const season = currentSeason(await store.seasons());
  if (!season) return toHistory({ seasonLabel: null, total: 0, group: 0, individual: 0, page: pageNo, rows: [] });
  const range = { from: season.startMonth, to: season.endMonth };
  const [attendances, lessons, groups, team] = await Promise.all([
    store.attendances({ athleteId, ...range }), store.lessons({ athleteId, ...range }), store.groups(), store.teamMembers(),
  ]);
  const ticked = attendances.filter((a) => a.grup || a.uscat);
  const held = lessons.filter((l) => l.state === 'saved' && l.present === true);
  const sessionIds = [...new Set(ticked.map((a) => a.sessionId))];
  const sessions = new Map((sessionIds.length === 0 ? [] : await store.sessions({ ids: sessionIds })).map((s) => [s.id, s] as const));
  const groupNames = groupNameMap(groups);
  const names = new Map(team.map((t) => [t.id, t.name] as const));
  const entries = [
    ...ticked.map((a) => groupEntry(a, sessions.get(a.sessionId), groupNames, names)),
    ...held.map((l) => lessonEntry(l, names)),
  ].sort(newestFirst);
  const from = (pageNo - 1) * PAGE_SIZE;
  return toHistory({
    seasonLabel: season.label, total: entries.length, group: ticked.length, individual: held.length, page: pageNo,
    rows: entries.slice(from, from + PAGE_SIZE).map((e) => e.row),
  });
}

/** The athlete's own data (spec 5.4, 6.4): name, birth date and age, contact name, phone and e-mail. */
export async function readProfile(c: SportivContext, athleteId: string): Promise<SportivProfile> {
  const athlete = await c.presence.store.athlete(athleteId);
  if (!athlete || isAnonymized(athlete)) throw new Error('sportiv profile: athlete not found');
  return toProfile({
    name: athlete.name ?? '', birthDate: athlete.birthDate, age: ageOnIso(athlete.birthDate, c.today),
    contactName: athlete.contactName, phone: athlete.phone, email: athlete.email,
  });
}
