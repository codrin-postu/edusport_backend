import { PREZENTA_COPY } from '../presence/copy/prezenta-ui';
import type { AthleteCard } from '../athletes/api-types';
import type { InactiveAthlete, PanelRow, SectionKind, SessionPanel, SessionSaveBody, Tick } from '../presence/attendance/api-types';
import { isRecord } from '../narrow';

export type Ticks = Record<string, { grup: boolean; uscat: boolean }>;
export type CoachFields = (string | null)[];
export type InactiveAnswers = { reactivate: string[]; keepInactive: string[] };
type PanelState = { ticks: Ticks; coaches: CoachFields; visitors: string[] };

export function columnsFor(kind: SectionKind): string[] {
  const base = [PREZENTA_COPY.colAthlete, PREZENTA_COPY.grup];
  return kind === 'school' ? base : [...base, PREZENTA_COPY.uscat];
}

export function initialTicks(p: SessionPanel): Ticks {
  if (p.sessionId === null) return {};
  return Object.fromEntries(p.rows.map((r) => [r.athleteId, { grup: r.grup, uscat: r.uscat }]));
}

export function toggleTick(t: Ticks, athleteId: string, type: 'grup' | 'uscat'): Ticks {
  const cur = t[athleteId] ?? { grup: false, uscat: false };
  return { ...t, [athleteId]: { ...cur, [type]: !cur[type] } };
}

const isTicked = (t: Ticks, id: string): boolean => !!t[id] && (t[id].grup || t[id].uscat);

export function footerCounts(rows: PanelRow[], t: Ticks): { present: number; listed: number } {
  return {
    present: rows.filter((r) => isTicked(t, r.athleteId)).length,
    listed: rows.filter((r) => !r.visitor).length,
  };
}

const tickKey = (t: Ticks, id: string): string => `${t[id]?.grup ? 1 : 0}${t[id]?.uscat ? 1 : 0}`;
const sameList = <T>(a: T[], b: T[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

export function isDirty(a: PanelState, b: PanelState): boolean {
  const ids = new Set([...Object.keys(a.ticks), ...Object.keys(b.ticks)]);
  const ticksChanged = [...ids].some((id) => tickKey(a.ticks, id) !== tickKey(b.ticks, id));
  return ticksChanged || !sameList(a.coaches, b.coaches) || !sameList(a.visitors, b.visitors);
}

export const addCoachField = (f: CoachFields): CoachFields => [...f, null];

/** Clearing an extra field removes it; the first field stays, empty. */
export function setCoach(f: CoachFields, index: number, id: string | null): CoachFields {
  if (id === null && index > 0) return f.filter((_, i) => i !== index);
  return f.map((c, i) => (i === index ? id : c));
}

export function coachIdsOf(f: CoachFields): string[] {
  return [...new Set(f.filter((c): c is string => !!c))];
}

export function addVisitor(rows: PanelRow[], card: AthleteCard): PanelRow[] {
  if (rows.some((r) => r.athleteId === card.documentId)) return rows;
  const visitor: PanelRow = {
    athleteId: card.documentId, name: card.name, visitor: true, inactive: card.status === 'inactiv',
    mainGroup: card.lastGroup?.name ?? null, abonament: null, grup: false, uscat: false, noSubscription: false,
  };
  return [...rows, visitor];
}

function targetOf(p: SessionPanel): Pick<SessionSaveBody, 'id' | 'occurrence' | 'added'> {
  if (p.sessionId) return { id: p.sessionId };
  if (p.occurrenceKey) return { occurrence: p.occurrenceKey };
  return p.added ? { added: p.added } : {};
}

export function saveBody(p: SessionPanel, t: Ticks, coaches: CoachFields, answers: InactiveAnswers): SessionSaveBody {
  const ticks: Tick[] = p.rows.flatMap((r) => {
    const v = t[r.athleteId];
    if (!v || !(v.grup || v.uscat)) return [];
    return [{ athleteId: r.athleteId, grup: v.grup, uscat: p.kind === 'school' ? false : v.uscat }];
  });
  return { ...targetOf(p), coachIds: coachIdsOf(coaches), ticks, reactivate: answers.reactivate, keepInactive: answers.keepInactive };
}

/** The inactive 409 of a save: the athletes to ask about; null for any other error. */
export function readInactive(err: unknown): InactiveAthlete[] | null {
  if (!isRecord(err) || !isRecord(err.response)) return null;
  const body = isRecord(err.response.data) ? err.response.data : {};
  const error = isRecord(body.error) ? body.error : {};
  const details = isRecord(error.details) ? error.details : {};
  return err.response.status === 409 && Array.isArray(details.inactive) ? (details.inactive as InactiveAthlete[]) : null;
}

export function answerInactive(answers: InactiveAnswers, athleteId: string, reactivate: boolean): InactiveAnswers {
  const others = (list: string[]): string[] => list.filter((id) => id !== athleteId);
  return reactivate
    ? { reactivate: [...others(answers.reactivate), athleteId], keepInactive: others(answers.keepInactive) }
    : { reactivate: others(answers.reactivate), keepInactive: [...others(answers.keepInactive), athleteId] };
}
