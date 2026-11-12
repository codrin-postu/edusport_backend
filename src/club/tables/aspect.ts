export type Aspect = 'lista' | 'foaie';

/** Browser storage key of the aspect of the table; per browser, never part of a saved view or an export. */
export const ASPECT_KEY = 'edusport.tabele.aspect';

/** The remembered aspect; "Listă" when nothing is stored, the value is unknown or the storage is unavailable. */
export function readAspect(): Aspect {
  try {
    return globalThis.localStorage.getItem(ASPECT_KEY) === 'foaie' ? 'foaie' : 'lista';
  } catch {
    return 'lista';
  }
}

export function writeAspect(a: Aspect): void {
  try {
    globalThis.localStorage.setItem(ASPECT_KEY, a);
  } catch {
    /* storage blocked: the aspect just is not remembered */
  }
}
