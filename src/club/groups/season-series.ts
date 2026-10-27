import { classView, overlapsSeason, seasonBounds, seriesView } from './series';
import type { EventRecord, Recurrence } from './types';

/** A season period edit moves the group programs of that season (spec 3.3, phase 4 final review I3). Pure. */
type Bounds = { start: string; end: string };
type Dates = { startMonth: string; endMonth: string };

export type SeriesMove = { eventId: string; recurrence: Recurrence };
export type SeasonProgramMove = { moves: SeriesMove[]; outside: number };

/** Whether a group's series or class belongs to the season (by its old bounds). */
export function usesSeason(events: EventRecord[], season: Dates): boolean {
  const b = seasonBounds(season);
  return events.some((e) => {
    if (!e.groupId) return false;
    const s = seriesView(e);
    if (s) return overlapsSeason(s, season);
    const c = classView(e);
    return c !== null && c.date >= b.start && c.date <= b.end;
  });
}

const startFor = (from: string, old: Bounds, next: Bounds): string => (from === old.start ? next.start : from < next.start ? next.start : from);
const endFor = (to: string, old: Bounds, next: Bounds): string => (to === old.end ? next.end : to > next.end ? next.end : to);

/**
 * Series that followed the old bounds take the new ones; series ends past the new end and starts before the new start are
 * clamped. A series that would end up empty is left alone. Single classes outside the new period stay and are only counted.
 */
export function planSeasonMove(events: EventRecord[], oldSeason: Dates, newSeason: Dates): SeasonProgramMove {
  const old = seasonBounds(oldSeason);
  const next = seasonBounds(newSeason);
  const moves: SeriesMove[] = [];
  let outside = 0;
  for (const e of events) {
    if (!e.groupId) continue;
    const s = seriesView(e);
    if (s && overlapsSeason(s, oldSeason)) {
      const from = startFor(s.from, old, next);
      const to = endFor(s.to, old, next);
      if (from <= to && (from !== s.from || to !== s.to)) moves.push({ eventId: e.id, recurrence: { ...e.recurrence, seasonStart: from, seasonEnd: to } });
      continue;
    }
    const c = classView(e);
    if (c && c.date >= old.start && c.date <= old.end && (c.date < next.start || c.date > next.end)) outside += 1;
  }
  return { moves, outside };
}
