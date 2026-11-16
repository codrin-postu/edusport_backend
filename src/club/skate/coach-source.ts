import type { CoachCompetitionEvent, CoachCompetitionMember, CoachProtocol } from '../portal/coach/api-types';
import type { CoachCompetitionSource } from '../portal/coach/competitions';
import type { SkateClient, SkateResult } from './client';
import { currentCategory, records, seasonKey, seasonOfToday } from './derive';
import type { CompetitionResults } from './pick';

const rowsOf = (all: SkateResult[]): SkateResult[] => all.filter((r) => r.result_id !== null);
const inSeason = (r: SkateResult, season: string): boolean => seasonKey(r.event_date, r.event_name) === season;
const better = (a: SkateResult, b: SkateResult): boolean => (a.placement ?? Infinity) < (b.placement ?? Infinity);

/** The result id a sheet can be opened with: only skate-results rows have one. */
const sheetId = (r: SkateResult, hand: boolean): string | null => (hand || r.result_id === null ? null : String(r.result_id));

/** Coach competitions over the one-source-per-athlete reads; a null answer is the existing unavailable state. */
export function skateCoachSource(results: CompetitionResults, client: SkateClient, now: () => Date): CoachCompetitionSource {
  return {
    async club(skaters, asked) {
      const season = asked ?? seasonOfToday(now());
      const reads = await results.many(skaters);
      let stale = false;
      let slugReads = 0;
      let slugUnavailable = 0;
      const rowsBy = new Map<string, { name: string; hand: boolean; rows: SkateResult[] }>();
      for (const skater of skaters) {
        const read = reads.get(skater.athleteId);
        if (skater.slug) slugReads += 1;
        // An unavailable read skips that athlete only; the answer is marked stale so it is not shown as complete.
        if (!read || !read.available) { stale = true; if (skater.slug) slugUnavailable += 1; continue; }
        if ('missing' in read) continue;
        stale ||= read.stale;
        rowsBy.set(skater.athleteId, { name: skater.name, hand: !skater.slug, rows: rowsOf(read.value) });
      }
      if (slugReads > 0 && slugUnavailable === slugReads) return null;
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
          members: [...best].map(([athleteId, r]): CoachCompetitionMember => ({ athleteId, name: rowsBy.get(athleteId)?.name ?? '', category: r.category, placement: r.placement, total: r.total_score, resultId: sheetId(r, rowsBy.get(athleteId)?.hand ?? true) })),
        })),
      };
    },

    async athlete(skater, season) {
      const read = await results.one(skater);
      if (!read.available) return null;
      if ('missing' in read) return { category: null, season, count: 0, podiums: 0, recent: [] };
      const rows = rowsOf(read.value).filter((r) => inSeason(r, season));
      const recent = [...rows].sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? '')).slice(0, 3)
        .map((r) => ({ eventName: r.event_name, date: r.event_date, location: r.event_location, placement: r.placement, total: r.total_score, resultId: sheetId(r, !skater.slug) }));
      const category = currentCategory(rows, season)?.current || null;
      return { category, season, count: new Set(rows.map((r) => r.event_id)).size, podiums: records(rows).podiums, recent };
    },

    async protocol(skater, resultId) {
      // Only a result of this athlete's own skate-results rows is ever fetched; a hand-entered athlete has no sheet.
      if (!skater.slug) return 'none';
      const read = await results.one(skater);
      if (!read.available) return null;
      if ('missing' in read) return 'none';
      const own = read.value.find((r) => r.result_id !== null && String(r.result_id) === resultId);
      if (!own || own.result_id === null) return 'none';
      const got = await client.protocol(own.result_id);
      if (got.ok === false) return got.reason === 'not_found' ? 'none' : null;
      return {
        segments: got.value.segments.map((s) => ({
          name: s.segment, placement: s.placement, tss: s.tss, tes: s.tes, pcs: s.pcs, deductions: s.deductions,
          elements: s.elements.map((e) => ({ order: e.order, name: e.name, baseValue: e.base_value, goe: e.goe, judges: e.judges, score: e.score, info: e.info, bonus: e.bonus })),
          components: s.components,
        })),
      } satisfies CoachProtocol;
    },
  };
}
