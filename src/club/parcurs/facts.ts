import type { MembershipRow, SeasonRow } from '../athletes/store';
import { seasonBounds } from '../groups/series';
import { mainGroupOn } from '../presence/attendance/roster';
import type { PresenceStore } from '../presence/store';
import { PARCURS_FROM } from './catalog';
import type { CountedInput } from './counted';

export type FactsDeps = {
  presence: PresenceStore;
  /** The athlete's results with a date; null when they are not available now. */
  results: (athleteId: string) => Promise<{ date: string; placement: number | null; eventId: string }[] | null>;
};

/** Sessions of the main group in a month that count for the perfect month: at least this many. */
const MIN_SESSIONS = 4;

const monthOf = (date: string): string => date.slice(0, 7);

function nextMonth(month: string): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Earliest start among the memberships; a row that ends before it starts is cancelled and ignored. */
function firstStart(memberships: MembershipRow[]): string | null {
  const starts = memberships.flatMap((m) => (m.from && !(m.to && m.to < m.from) ? [m.from] : [])).sort();
  return starts[0] ?? null;
}

type Result = { date: string; placement: number | null };

/** One entry per event (a skater can have several results in one): its earliest date and best placement. */
function perEvent(rows: { date: string; placement: number | null; eventId: string }[]): Result[] {
  const events = new Map<string, Result>();
  for (const r of rows) {
    const seen = events.get(r.eventId);
    if (!seen) { events.set(r.eventId, { date: r.date, placement: r.placement }); continue; }
    const better = r.placement !== null && (seen.placement === null || r.placement < seen.placement);
    events.set(r.eventId, { date: r.date < seen.date ? r.date : seen.date, placement: better ? r.placement : seen.placement });
  }
  return [...events.values()];
}

/** Months from `PARCURS_FROM` up to the one before today's where the main group had 4 or more saved sessions and the athlete a group presence at each. */
async function perfectMonths(
  d: FactsDeps, athleteId: string, memberships: MembershipRow[], seasons: SeasonRow[], groupPresent: Set<string>, today: string,
): Promise<string[]> {
  const out: string[] = [];
  for (let month = monthOf(PARCURS_FROM); month < monthOf(today); month = nextMonth(month)) {
    const first = `${month}-01`;
    const season = seasons.find((s) => { const b = seasonBounds(s); return b.start <= first && first <= b.end; });
    const groupId = season ? mainGroupOn(memberships, athleteId, season.id, first) : null;
    if (!groupId) continue;
    const sessions = await d.presence.sessions({ groupId, from: first, to: `${month}-31` });
    if (sessions.length >= MIN_SESSIONS && sessions.every((s) => groupPresent.has(s.id))) out.push(month);
  }
  return out;
}

/** The counted facts of one athlete, read from the stores. */
export async function countedFacts(d: FactsDeps, athleteId: string, today: string): Promise<Omit<CountedInput, 'firstPinGivenOn'>> {
  const [memberships, seasons, attendances, lessons, results] = await Promise.all([
    d.presence.memberships({ athleteId }), d.presence.seasons(), d.presence.attendances({ athleteId }), d.presence.lessons({ athleteId }),
    d.results(athleteId).catch(() => null),
  ]);
  const presenceDates = [
    ...attendances.filter((r) => r.grup || r.uscat).map((r) => r.sessionDate),
    ...lessons.filter((l) => l.state === 'saved' && l.present === true).map((l) => l.date),
  ];
  const groupPresent = new Set(attendances.filter((r) => r.grup).map((r) => r.sessionId));
  return {
    presenceDates, today, results: results && perEvent(results),
    firstMembershipStart: firstStart(memberships),
    perfectMonths: await perfectMonths(d, athleteId, memberships, seasons, groupPresent, today),
  };
}
