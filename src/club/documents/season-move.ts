import type { Core } from '@strapi/strapi';
import { rebuildDocuments, seasonIdForLabel, type RebuildResult } from './service';

const UID = 'api::registration-submission.registration-submission' as const;

export interface SeasonMoveDeps {
  seasonIdFor(label: string): Promise<string | null>;
  /** Sets the season text and its Sezon link; false when the registration does not exist. Never the number. */
  setSeason(registrationDocumentId: string, label: string, seasonRef: string | null): Promise<boolean>;
  rebuild(registrationDocumentId: string): Promise<RebuildResult>;
  logError(message: string): void;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

async function moveOne(id: string, label: string, seasonRef: string | null, deps: SeasonMoveDeps): Promise<boolean> {
  try {
    if (!(await deps.setSeason(id, label, seasonRef))) return false;
  } catch (err) {
    deps.logError(`[inscrieri] moving ${id} to ${label} failed: ${message(err)}`);
    return false;
  }
  if (seasonRef) await deps.rebuild(id); // logs its own failure, never throws
  return true;
}

/**
 * Moves registrations to the season `label`: the season text and `seasonRef` change together, then each
 * registration's PDFs are rebuilt (new files first). One failure is logged and the loop goes on. With no
 * Sezon of that label, `seasonRef` becomes null and the rebuild is skipped with a logged reason.
 * The registration number never changes (D2). Returns how many registrations were moved.
 */
export async function moveRegistrationsToSeason(ids: string[], label: string, deps: SeasonMoveDeps): Promise<number> {
  const seasonRef = await deps.seasonIdFor(label);
  let moved = 0;
  for (const id of ids) if (await moveOne(id, label, seasonRef, deps)) moved += 1;
  if (!seasonRef && moved > 0) deps.logError(`[inscrieri] no Sezon is labelled "${label}": documents of ${moved} moved registration(s) not rebuilt`);
  return moved;
}

/** The Strapi side of moveRegistrationsToSeason. */
export function seasonMoveDeps(strapi: Core.Strapi): SeasonMoveDeps {
  return {
    seasonIdFor: (label) => seasonIdForLabel(strapi, label),
    setSeason: async (documentId, label, seasonRef) =>
      Boolean(await strapi.documents(UID).update({ documentId, data: { season: label, seasonRef } })),
    rebuild: (documentId) => rebuildDocuments(strapi, documentId),
    logError: (msg) => strapi.log.error(msg),
  };
}
