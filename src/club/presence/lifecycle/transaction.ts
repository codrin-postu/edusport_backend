import type { ClubStore } from '../../athletes/store';
import type { PresenceStore } from '../store';

/** Club transaction outermost, presence inside it: Strapi reuses the one transaction, the fakes restore both on a throw. */
export function inBothTransactions<T>(club: Pick<ClubStore, 'transaction'>, presence: Pick<PresenceStore, 'transaction'>, work: () => Promise<T>): Promise<T> {
  return club.transaction(() => presence.transaction(work));
}
