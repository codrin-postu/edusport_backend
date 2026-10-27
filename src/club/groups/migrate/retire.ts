import type { EventRecord, SeasonRecord } from '../types';
import { oldScoalaSeries } from './school-series';

/** Step 6 (spec 4, W14): the unlinked Școala series step 4 copied, listed with their dates and exceptions before they go. Pure. */
export type Retire = { eventId: string; title: string; from: string; to: string; exceptions: { date: string; kind: string; note: string | null }[] };

export const planRetire = (events: EventRecord[], season: SeasonRecord): Retire[] =>
  oldScoalaSeries(events, season).map((e) => ({
    eventId: e.id, title: e.title, from: e.recurrence.seasonStart ?? '', to: e.recurrence.seasonEnd ?? '',
    exceptions: e.exceptions.map((x) => ({ date: x.date, kind: x.kind, note: x.reason ?? x.newTitle })),
  }));
