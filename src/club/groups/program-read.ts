import type { SeasonRef } from './api-types';
import { shortDate } from './dates';
import { classDates } from './program-plan';
import { programLine } from './program-text';
import { pickSeason, seasonRef } from './season-pick';
import { currentSeries, seriesText, type RepeatFreq } from './series';
import type { DayKey, EventRecord, GroupStore, SeasonRecord, WeekOfMonth } from './types';

/** "Program obișnuit" (6.3): one row per series of the season still running; `nextDate` is the default "Se aplică din" of "Schimbă" (decided 11). */
export type ProgramRow = {
  eventId: string; freq: RepeatFreq; days: DayKey[]; weekOfMonth: WeekOfMonth | null; startTime: string; durationMin: number;
  from: string; to: string; text: string; fromText: string; nextDate: string | null;
};
export type GroupProgram = { season: SeasonRef | null; series: ProgramRow[] };

export function programRows(events: EventRecord[], groupId: string, season: SeasonRecord, today: string): ProgramRow[] {
  return currentSeries(events, groupId, season, today).map((s) => {
    const e = events.find((x) => x.id === s.eventId);
    const start = today > s.from ? today : s.from;
    return {
      eventId: s.eventId, freq: s.freq, days: s.days, weekOfMonth: s.weekOfMonth, startTime: s.startTime, durationMin: s.durationMin, from: s.from, to: s.to,
      text: programLine(seriesText(s)), fromText: shortDate(s.from), nextDate: e ? classDates(e, start, s.to)[0] ?? null : null,
    };
  });
}

export async function readGroupProgram(store: GroupStore, groupId: string, label: string | null, today: string): Promise<GroupProgram | null> {
  const [group, seasons, events] = await Promise.all([store.group(groupId), store.seasons(), store.events({ groupId })]);
  if (!group) return null;
  const season = pickSeason(seasons, label);
  return { season: season ? seasonRef(season, seasons) : null, series: season ? programRows(events, groupId, season, today) : [] };
}
