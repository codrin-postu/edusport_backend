/** Hiding rule for the "N sportivi au date incomplete." banner: hidden for 24 hours after it was closed. */
export const INCOMPLETE_HIDDEN_KEY = 'edusport.sportivi.incompleteHidden';
export const INCOMPLETE_HIDDEN_MS = 24 * 60 * 60 * 1000;

/** `stored` is the raw sessionStorage value (a ms timestamp). Missing, garbage or future values read as "not hidden". */
export function incompleteHidden(stored: string | null | undefined, now: number): boolean {
  if (!stored) return false;
  const at = Number(stored);
  if (!Number.isFinite(at)) return false;
  const age = now - at;
  return age >= 0 && age < INCOMPLETE_HIDDEN_MS;
}
