import type { Core } from '@strapi/strapi';
import { clubStore } from '../../club/athletes/http';
import { refreshRegistrationMatch } from '../../club/athletes/matches';
import { rebuildAfterEdit, seasonIdForLabel } from '../../club/documents';
import { recordHistory } from '../../club/history';
import type { RegistrationEditDeps } from '../../club/registration-update';

const UID = 'api::registration-submission.registration-submission' as const;

/** The Strapi side of updateRegistration. */
export function registrationEditDeps(strapi: Core.Strapi): RegistrationEditDeps {
  const docs = () => strapi.documents(UID);
  return {
    find: async (id) => (await docs().findOne({ documentId: id, populate: ['athlete', 'matchAthlete'] })) as unknown as Record<string, unknown> | null,
    exclusive: (id, work) => {
      const store = clubStore(strapi);
      return store.transaction(async () => {
        await store.lockRegistration(id);
        return work();
      });
    },
    save: async (id, data) => (await docs().update({ documentId: id, data })) as unknown as Record<string, unknown> | null,
    seasonIdForLabel: (label) => seasonIdForLabel(strapi, label),
    rebuild: (id, data) => rebuildAfterEdit(strapi, id, data),
    record: (entry) => recordHistory(strapi, entry),
    refreshMatch: (id) => refreshRegistrationMatch(clubStore(strapi), id),
    log: (message) => strapi.log.error(message),
  };
}
