import type { AdminArea } from './admin-area';

/**
 * Which dashboard parts a caller's areas allow. A part the caller may not read is not requested and not drawn:
 * a 403 from its route must never leave a spinner or an empty "Nimic nou" behind.
 */
export function dashboardParts(has: (a: AdminArea) => boolean): { athletes: boolean; feed: boolean; season: boolean; program: boolean } {
  return { athletes: has('club'), feed: has('club'), season: has('settings'), program: has('club') };
}
