import { FORM_ACTOR, HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { refreshRegistrationMatch, safely } from './matches';
import type { ClubStore } from './store';

/** After a new public registration (not a repeat of the same draft): "Înscriere înregistrată" and its match (spec 1.6, 2.2). */
export async function afterRegistrationSubmitted(store: ClubStore, registrationId: string, log: (message: string) => void): Promise<void> {
  await safely(
    async () => {
      await store.record({ subjectType: SUBJECT.registration, subjectId: registrationId, action: HISTORY_ACTIONS.submitted, actor: FORM_ACTOR });
      await refreshRegistrationMatch(store, registrationId);
    },
    log,
    `after submit of ${registrationId}`,
  );
}
