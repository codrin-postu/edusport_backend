import { safely } from '../athletes/matches';
import type { ClubStore } from '../athletes/store';
import type { RemoveFiles } from './anonymize-service';

/** Startup: the PDF folders of anonymized athletes' registrations that an anonymization could not delete (spec 4). */
export async function sweepAnonymizedFolders(store: ClubStore, removeFiles: RemoveFiles, log: (message: string) => void): Promise<number> {
  const ids = await store.anonymizedRegistrationIds();
  for (const id of ids) await safely(() => removeFiles(id), log, `sweeping the PDF folder of ${id}`);
  return ids.length;
}
