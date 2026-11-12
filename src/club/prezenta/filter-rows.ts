export type RowFilter = { sectionId: string | null; groupIds: string[] };

/** The rows of the chosen section and groups; a group the list does not know is dropped while a filter is on. Empty filter: every row. */
export function filterPeriodRows<T extends { groupId: string }>(rows: T[], f: RowFilter, groups: { id: string; sectionId: string }[]): T[] {
  if (f.sectionId === null && f.groupIds.length === 0) return rows;
  const sectionOf = new Map(groups.map((g) => [g.id, g.sectionId]));
  return rows.filter((r) => (f.sectionId === null || sectionOf.get(r.groupId) === f.sectionId) && (f.groupIds.length === 0 || f.groupIds.includes(r.groupId)));
}
