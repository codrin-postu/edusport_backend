import { FORM_ACTOR, HISTORY_ACTIONS, SUBJECT, actorLabel, historyTexts } from '../history-text';
import type { HistoryLine } from './api-types';
import type { ClubStore, HistoryRow } from './store';

type Line = HistoryLine & { seq: number };

function linesOf(row: HistoryRow, names: Readonly<Record<string, string>>): Line[] {
  return historyTexts(row.action, row.changes, row.subjectType).map((text) => ({ at: row.at, actor: actorLabel(row.actor, names), text, seq: row.seq }));
}

/** Older registrations have no stored submit row: shown from `submittedAt` (r4 e10). */
function submittedLine(rows: HistoryRow[], submittedAt: string | null): Line[] {
  if (!submittedAt || rows.some((r) => r.action === HISTORY_ACTIONS.submitted)) return [];
  return [{ at: submittedAt, actor: actorLabel(FORM_ACTOR, {}), text: 'Înscriere înregistrată', seq: 0 }];
}

const newestFirst = (a: Line, b: Line) => b.at.localeCompare(a.at) || a.seq - b.seq;

/** Istoric of a registration or an athlete: newest first, one line per change, actor by name (3b Q23). */
export async function readHistory(store: ClubStore, subjectType: string, subjectId: string, submittedAt: string | null = null): Promise<HistoryLine[]> {
  const rows = await store.history(subjectType, subjectId);
  const emails = [...new Set(rows.map((r) => r.actor).filter((a) => a.includes('@')))];
  const names = emails.length ? await store.adminNames(emails) : {};
  const synthetic = subjectType === SUBJECT.registration ? submittedLine(rows, submittedAt) : [];
  return [...rows.flatMap((r) => linesOf(r, names)), ...synthetic].sort(newestFirst).map(({ at, actor, text }) => ({ at, actor, text }));
}
