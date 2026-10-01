/**
 * Shared constants and a small helper for the Sportivi / Competiții pages.
 * Kept from the former edusportUi.ts once its EDU_CSS stylesheet had no users.
 */

/** Program types of a sportsperson's season (component sportsperson.season > programs[].type). */
export const PROGRAM_TYPES = ['Program Scurt', 'Program Liber', 'Program Exhibiție'] as const;

/** Competition levels (competition.level). */
export const LEVEL_OPTIONS = [
  { value: 'national', label: 'Național' },
  { value: 'international', label: 'Internațional' },
] as const;

/** "2023-01-01" -> "2023". */
export function yearOf(iso?: string | null): string {
  if (!iso) return '';
  return String(iso).slice(0, 4);
}
