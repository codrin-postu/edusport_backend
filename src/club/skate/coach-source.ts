import type { CoachCompetitionEvent, CoachCompetitionMember } from '../portal/coach/api-types';
import type { CoachCompetitionSource } from '../portal/coach/competitions';
import type { SkateResult } from './client';
import { currentCategory, records, seasonKey, seasonOfToday } from './derive';
import type { CompetitionResults } from './pick';

const rowsOf = (all: SkateResult[]): SkateResult[] => all.filter((r) => r.result_id !== null);
const inSeason = (r: SkateResult, season: string): boolean => seasonKey(r.event_date, r.event_name) === season;
const better = (a: SkateResult, b: SkateResult): boolean => (a.placement ?? Infinity) < (b.placement ?? Infinity);

/** Coach competitions over the one-source-per-athlete reads; a null answer is the existing unavailable state. */
export function skateCoachSource(results: CompetitionResults, now: () => Date): CoachCompetitionSource {
  return {
    async club(skaters, asked) {
      const season = asked ?? seasonOfToday(now());
      const reads = await results.many(skaters);
      let stale = false;
      const rowsBy = new Map<string, { name: string; hand: boolean; rows: SkateResult[] }>();
      for (const skater of skaters) {
        const read = reads.get(skater.athleteId);
        if (!read || !read.available) { if (skater.slug) return null; continue; }
        if ('missing' in read) continue;
        stale ||= read.stale;
        rowsBy.set(skater.athleteId, { name: skater.name, hand: !skater.slug, rows: rowsOf(read.value) });
      }
      const seasons = new Set<string>();
      const events = new Map<string, CoachCompetitionEvent & { best: Map<string, SkateResult> }>();
      for (const [athleteId, { hand, rows }] of rowsBy) {
        for (const r of rows) {
          const rowSeason = seasonKey(r.event_date, r.event_name);
          if (rowSeason !== null) seasons.add(rowSeason);
          if (rowSeason !== season) continue;
          const id = `${hand ? 'h' : 's'}-${r.event_id}`;
          let event = events.get(id);
          if (!event) {
            event = { eventId: id, name: r.event_name, date: r.event_date, location: r.event_location, members: [], best: new Map() };
            events.set(id, event);
          }
          const held = event.best.get(athleteId);
          if (!held || better(r, held)) event.best.set(athleteId, r);
        }
      }
      return {
        stale, season, seasons: [...seasons].sort().reverse(),
        events: [...events.values()].map(({ best, ...event }): CoachCompetitionEvent => ({
          ...event,
          members: [...best].map(([athleteId, r]): CoachCompetitionMember => ({ athleteId, name: rowsBy.get(athleteId)?.name ?? '', category: r.category, placement: r.placement, total: r.total_score })),
        })),
      };
    },

    async athlete(skater, season) {
      const read = await results.one(skater);
      if (!read.available) return null;
      if ('missing' in read) return { category: null, season, count: 0, podiums: 0, recent: [] };
      const rows = rowsOf(read.value).filter((r) => inSeason(r, season));
      const recent = [...rows].sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? '')).slice(0, 3)
        .map((r) => ({ eventName: r.event_name, date: r.event_date, location: r.event_location, placement: r.placement, total: r.total_score }));
      const category = currentCategory(rows, season)?.current || null;
      return { category, season, count: new Set(rows.map((r) => r.event_id)).size, podiums: records(rows).podiums, recent };
    },
  };
}
