import { FORM_ACTOR, HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { refreshRegistrationMatch, safely } from './matches';
import type { ClubStore } from './store';

/** After a new public registration (not a repeat of the same draft): "Înscriere înregistrată" and its match (spec 1.6, 2.2). */
export async function afterRegistrationSubmitted(store: ClubStore, registrationId: string, log: (message: string) => void): Promise<void> {
  await safely(
    () => store.record({ subjectType: SUBJECT.registration, subjectId: registrationId, action: HISTORY_ACTIONS.submitted, actor: FORM_ACTOR }),
    log,
    `history after submit of ${registrationId}`,
  );
  await safely(() => refreshRegistrationMatch(store, registrationId), log, `match after submit of ${registrationId}`);
}

/** A confirmed registration deleted: the athlete keeps its data, groups and A.C.S.; Istoric notes it (r4 e3). */
export async function beforeRegistrationDeleted(store: ClubStore, registrationId: string, actor: string, log: (message: string) => void): Promise<void> {
  await safely(
    async () => {
      const registration = await store.registration(registrationId);
      if (!registration?.athleteId) return;
      const changes = { registrationNumber: registration.number };
      await store.record({ subjectType: SUBJECT.athlete, subjectId: registration.athleteId, action: HISTORY_ACTIONS.registrationDeleted, changes, actor });
    },
    log,
    `history of deleting ${registrationId}`,
  );
}
