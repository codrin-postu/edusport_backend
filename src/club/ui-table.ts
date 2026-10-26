/** Rules of the shared submission table (src/admin/dashboard/SubmissionTable.tsx) that Vitest can reach. Pure. */
export type CompactHeader = string | { label: string; sort: readonly [string, string] };
export type HeaderSortDir = 'ascending' | 'descending' | 'none';

const TABLE_KEYS = new Set(['data', 'pagination', 'seasons', 'activeSeason', 'formMeta']);

/** The list answer's other keys, handed to the page (Înscrieri: schools, multipleSchools, allSchoolsTotal). */
export const listMeta = (body: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(body).filter(([key]) => !TABLE_KEYS.has(key)));

export const headerLabel = (h: CompactHeader): string => (typeof h === 'string' ? h : h.label);

/** A sortable header: the first click sorts by its first value, later clicks toggle the pair. */
export const nextHeaderSort = (sort: string, pair: readonly [string, string]): string => (sort === pair[0] ? pair[1] : pair[0]);

export function headerSortDir(sort: string, pair: readonly [string, string]): HeaderSortDir {
  if (sort === pair[0]) return 'ascending';
  return sort === pair[1] ? 'descending' : 'none';
}

/** The empty row of a season Select, without the em dash (plan 3-4 Needs decision 7f, option A). */
export const SEASON_EMPTY_LABEL = 'Fără sezon';

/** The saved `updatedAt` of a field PUT's answer (`{ data }`): copied into the row, the Înscrieri panel (`panelVersion`) reloads its Istoric after the write. */
export function savedStamp(body: unknown): { updatedAt: string } | null {
  const updatedAt = (body as { data?: { updatedAt?: unknown } | null } | null)?.data?.updatedAt;
  return typeof updatedAt === 'string' && updatedAt ? { updatedAt } : null;
}
