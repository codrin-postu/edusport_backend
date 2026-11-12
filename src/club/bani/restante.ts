import type { ClubDueRow, DuePage, SchoolDueRow } from '../presence/money-api';

export type RestanteSection = 'toate' | 'scoala' | 'club';
export type RestanteBlock =
  | { key: 'scoala'; rows: SchoolDueRow[]; total: number }
  | { key: 'club'; rows: ClubDueRow[]; total: number };

const GROUP_SEPARATOR = ', ';

/** "Rămas" is shown never below 0 (an advance is not a debt), so the total adds the shown figures. */
const owed = (rows: { left: number }[]): number => rows.reduce((sum, r) => sum + Math.max(0, r.left), 0);
const byLeftDesc = <T extends { left: number }>(rows: T[]): T[] => [...rows].sort((a, b) => b.left - a.left);

/** The Restanțe blocks, Școala first: one section hides the other; `group` keeps the rows of that group name; a block with no rows is left out. The Școala rows do not depend on the page's month. */
export function restanteBlocks(page: DuePage, section: RestanteSection, group: string | null = null): RestanteBlock[] {
  const blocks: RestanteBlock[] = [];
  if (section !== 'club') {
    const rows = byLeftDesc(page.school.filter((r) => group === null || r.groupName === group));
    if (rows.length > 0) blocks.push({ key: 'scoala', rows, total: owed(rows) });
  }
  if (section !== 'scoala') {
    const rows = byLeftDesc(page.club.filter((r) => group === null || r.groupNames.split(GROUP_SEPARATOR).includes(group)));
    if (rows.length > 0) blocks.push({ key: 'club', rows, total: owed(rows) });
  }
  return blocks;
}

/** The group names of the page's rows, for the "Grupă" filter. */
export function restanteGroups(page: DuePage): string[] {
  const names = new Set<string>();
  for (const r of page.school) if (r.groupName) names.add(r.groupName);
  for (const r of page.club) for (const n of r.groupNames.split(GROUP_SEPARATOR)) if (n) names.add(n);
  return [...names].sort((a, b) => a.localeCompare(b, 'ro'));
}
