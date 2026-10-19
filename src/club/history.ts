export interface HistoryInput {
  subjectType: string;
  subjectId: string;
  action: string;
  changes?: Record<string, unknown>;
  actor: string;
}

export function buildHistoryEntry(input: HistoryInput, now: Date = new Date()): HistoryInput & { at: string } {
  if (!input.actor) throw new Error('History entry needs an actor');
  return { ...input, at: now.toISOString() };
}

export async function recordHistory(
  strapi: { documents: (uid: string) => { create: (args: { data: unknown }) => Promise<unknown> } },
  input: HistoryInput,
): Promise<void> {
  await strapi.documents('api::history-entry.history-entry').create({ data: buildHistoryEntry(input) });
}
