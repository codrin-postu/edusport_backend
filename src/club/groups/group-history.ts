import type { HistoryLine } from '../athletes/api-types';
import { actorLabel } from '../history-text';
import { GROUP_SUBJECT, athleteIdsOf, groupHistoryTexts } from './history-lines';
import type { GroupStore } from './types';

type Line = HistoryLine & { seq: number };

/** Group Istoric (6.4): newest first, the actor by name ("Migrare" for migration rows), athletes by their current name (decided 2). */
export async function readGroupHistory(store: GroupStore, groupId: string): Promise<HistoryLine[]> {
  const rows = await store.history(GROUP_SUBJECT, groupId);
  const ids = new Set(rows.flatMap((r) => athleteIdsOf(r.changes)));
  const names = ids.size ? Object.fromEntries((await store.athletes()).filter((a) => ids.has(a.id)).map((a) => [a.id, a.name ?? ''])) : {};
  const emails = [...new Set(rows.map((r) => r.actor).filter((a) => a.includes('@')))];
  const admins = emails.length ? await store.adminNames(emails) : {};
  const lines: Line[] = rows.flatMap((r) => groupHistoryTexts(r.action, r.changes, names).map((text) => ({ at: r.at, actor: actorLabel(r.actor, admins), text, seq: r.seq })));
  return lines.sort((a, b) => b.at.localeCompare(a.at) || b.seq - a.seq).map(({ at, actor, text }) => ({ at, actor, text }));
}
