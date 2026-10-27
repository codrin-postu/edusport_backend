import { FORM_ACTOR, HISTORY_ACTIONS, SUBJECT, actorLabel, historyTexts } from '../history-text';
import type { HistoryLine } from './api-types';
import type { ClubStore, HistoryRow } from './store';

/** A rendered line with the row it came from; the export reads `action` and `changes` to leave lines out. */
export type HistoryEntry = HistoryLine & { action: string; changes: Record<string, unknown> };
type Line = HistoryEntry & { seq: number };

function linesOf(row: HistoryRow, names: Readonly<Record<string, string>>): Line[] {
  const actor = actorLabel(row.actor, names);
  return historyTexts(row.action, row.changes, row.subjectType).map((text) => ({ at: row.at, actor, text, action: row.action, changes: row.changes, seq: row.seq }));
}

/** Older registrations have no stored submit row: shown from `submittedAt` (r4 e10). */
function submittedLine(rows: HistoryRow[], submittedAt: string | null): Line[] {
  if (!submittedAt || rows.some((r) => r.action === HISTORY_ACTIONS.submitted)) return [];
  return [{ at: submittedAt, actor: actorLabel(FORM_ACTOR, {}), text: 'Înscriere înregistrată', action: HISTORY_ACTIONS.submitted, changes: {}, seq: 0 }];
}

const newestFirst = (a: Line, b: Line) => b.at.localeCompare(a.at) || a.seq - b.seq;

/** `readHistory` with each line's action and stored changes. */
export async function readHistoryEntries(store: ClubStore, subjectType: string, subjectId: string, submittedAt: string | null = null): Promise<HistoryEntry[]> {
  const rows = await store.history(subjectType, subjectId);
  const emails = [...new Set(rows.map((r) => r.actor).filter((a) => a.includes('@')))];
  const names = emails.length ? await store.adminNames(emails) : {};
  const synthetic = subjectType === SUBJECT.registration ? submittedLine(rows, submittedAt) : [];
  return [...rows.flatMap((r) => linesOf(r, names)), ...synthetic].sort(newestFirst).map(({ at, actor, text, action, changes }) => ({ at, actor, text, action, changes }));
}

/** Istoric of a registration or an athlete: newest first, one line per change, actor by name (3b Q23). */
export async function readHistory(store: ClubStore, subjectType: string, subjectId: string, submittedAt: string | null = null): Promise<HistoryLine[]> {
  return (await readHistoryEntries(store, subjectType, subjectId, submittedAt)).map(({ at, actor, text }) => ({ at, actor, text }));
}
