import { groupSeries } from '../series';
import type { EventRecord, ExceptionRow, GroupRecord, Recurrence, SeasonRecord, SectionRecord } from '../types';
import { oldScoalaSeries } from './school-series';

/** Step 6 (spec 4, W14): the unlinked Școala series step 4 copied, listed with their dates and exceptions before they go. Pure. */
export type Retire = {
  eventId: string; title: string; from: string; to: string; exceptions: { date: string; kind: string; note: string | null }[];
  recurrence: Recurrence; exceptionRows: ExceptionRow[];
};

export const planRetire = (events: EventRecord[], season: SeasonRecord): Retire[] =>
  oldScoalaSeries(events, season).map((e) => ({
    eventId: e.id, title: e.title, from: e.recurrence.seasonStart ?? '', to: e.recurrence.seasonEnd ?? '',
    exceptions: e.exceptions.map((x) => ({ date: x.date, kind: x.kind, note: x.reason ?? x.newTitle })),
    recurrence: e.recurrence, exceptionRows: e.exceptions,
  }));

/** Guard: the Școala groups (section kind school) with no linked series in the season. Step 6 runs only when this is empty. */
export function scoalaGroupsWithoutSeries(groups: GroupRecord[], sections: SectionRecord[], events: EventRecord[], season: SeasonRecord): GroupRecord[] {
  const schools = new Set(sections.filter((s) => s.kind === 'school').map((s) => s.id));
  return groups.filter((g) => schools.has(g.sectionId ?? '') && !groupSeries(events, g.id, season).length);
}

/** The Istoric changes of a deleted series: enough to rebuild it by hand. */
export const retiredChanges = (r: Retire): Record<string, unknown> => ({ title: r.title, recurrence: r.recurrence, exceptions: r.exceptionRows });
