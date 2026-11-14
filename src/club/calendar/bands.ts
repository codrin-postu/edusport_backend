import { expandOccurrences, exceptOf, type BlackoutRow, type Occurrence } from '../../api/calendar-event/services/expand';
import { addDays } from '../groups/dates';
import type { CalendarWindow } from '../groups/occurrences';

/** Multi-day things the month grid draws as one band across their days (breaks, holidays, multi-day competitions). Pure. */
export type Span = { key: string; title: string; from: string; to: string; kind: 'pauza' | 'eveniment' };
export type CalendarBand = Span;
/** One row's share of a span: `col` 0..6 Monday first, `lane` counts down from the day numbers. */
export type BandPiece = { key: string; title: string; col: number; span: number; lane: number };

type SpanSource = Pick<Occurrence, 'eventId' | 'title' | 'date' | 'status'> & { oneOff?: boolean };

/** Runs of two or more consecutive dates of the same one-off event; a cancelled date breaks a run. */
export function multiDaySpans(occ: SpanSource[]): Span[] {
  const byEvent = new Map<number, { title: string; dates: Set<string> }>();
  for (const o of occ) {
    if (!o.oneOff || o.status === 'cancelled') continue;
    const e = byEvent.get(o.eventId) ?? { title: o.title, dates: new Set<string>() };
    e.dates.add(o.date);
    byEvent.set(o.eventId, e);
  }
  const out: Span[] = [];
  for (const [eventId, { title, dates }] of byEvent) {
    const sorted = [...dates].sort();
    let start = 0;
    for (let i = 1; i <= sorted.length; i++) {
      if (i < sorted.length && sorted[i] === addDays(sorted[i - 1], 1)) continue;
      if (i - start >= 2) out.push({ key: `ev:${eventId}:${sorted[start]}`, title, from: sorted[start], to: sorted[i - 1], kind: 'eveniment' });
      start = i;
    }
  }
  return out.sort((a, b) => a.from.localeCompare(b.from) || a.key.localeCompare(b.key));
}

export const breakSpans = (b: BlackoutRow[]): Span[] =>
  b.map((x): Span => ({ key: `pauza:${x.startDate}:${x.endDate}:${x.label}`, title: x.label, from: x.startDate, to: x.endDate, kind: 'pauza' }));

/** True for the date of an occurrence that a multi-day event span already draws, so it gets no chip of its own. */
export const inEventSpan = (o: Pick<Occurrence, 'eventId' | 'date'>, spans: Span[]): boolean =>
  spans.some((s) => s.kind === 'eveniment' && s.key.startsWith(`ev:${o.eventId}:`) && o.date >= s.from && o.date <= s.to);

const days = (s: Span): number => {
  let n = 1;
  for (let d = s.from; d < s.to; d = addDays(d, 1)) n++;
  return n;
};

/** The pieces of `spans` in one week row (7 ISO dates, Monday first), clipped to the row; lanes first-fit by `from`, longer first. */
export function weekBands(week: string[], spans: Span[]): BandPiece[] {
  const first = week[0];
  const last = week[6];
  const lanes: boolean[][] = [];
  const pieces: BandPiece[] = [];
  const touching = spans.filter((s) => s.from <= last && s.to >= first).sort((a, b) => a.from.localeCompare(b.from) || days(b) - days(a) || a.key.localeCompare(b.key));
  for (const s of touching) {
    const col = s.from > first ? week.indexOf(s.from) : 0;
    const end = s.to < last ? week.indexOf(s.to) : 6;
    const span = end - col + 1;
    let lane = lanes.findIndex((used) => used.slice(col, col + span).every((u) => !u));
    if (lane === -1) lane = lanes.push(new Array<boolean>(7).fill(false)) - 1;
    for (let c = col; c < col + span; c++) lanes[lane][c] = true;
    pieces.push({ key: s.key, title: s.title, col, span, lane });
  }
  return pieces.sort((a, b) => a.lane - b.lane || a.col - b.col);
}

/** Bands for the given groups in from..to: the breaks that apply to at least one of them, and their multi-day events. */
export function bandsFor(w: CalendarWindow, groupIds: Set<string>, from: string, to: string): CalendarBand[] {
  const ids = [...groupIds];
  const applying = w.blackouts.filter((b) => b.startDate <= to && b.endDate >= from && ids.some((id) => !exceptOf(b).includes(id)));
  const events = w.events.filter((e) => e.group && groupIds.has(e.group.documentId));
  return [...breakSpans(applying), ...multiDaySpans(expandOccurrences(events, w.blackouts, from, to))];
}
