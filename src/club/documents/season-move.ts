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

/** Moves each row's season and `seasonRef` only; no rebuild. Returns the ids actually moved. */
async function moveRowsOnly(ids: string[], label: string, seasonRef: string | null, deps: SeasonMoveDeps): Promise<string[]> {
  const moved: string[] = [];
  for (const id of ids) {
    try {
      if (await deps.setSeason(id, label, seasonRef)) moved.push(id);
    } catch (err) {
      deps.logError(`[inscrieri] moving ${id} to ${label} failed: ${message(err)}`);
    }
  }
  return moved;
}

/** Rebuilds the moved registrations' PDFs one by one; never throws. With no Sezon, logs once instead. */
async function rebuildMoved(moved: string[], label: string, seasonRef: string | null, deps: SeasonMoveDeps): Promise<void> {
  if (!seasonRef) {
    if (moved.length > 0) deps.logError(`[inscrieri] no Sezon is labelled "${label}": documents of ${moved.length} moved registration(s) not rebuilt`);
    return;
  }
  for (const id of moved) {
    try {
      await deps.rebuild(id);
    } catch (err) {
      deps.logError(`[inscrieri] rebuilding documents of ${id} after moving to ${label} failed: ${message(err)}`);
    }
  }
}

/**
 * Moves many registrations without waiting for their PDFs: the rows move and the function returns
 * immediately (so the admin request answers fast), then the PDFs rebuild one by one afterwards, off
 * the request (plan-mandated: a synchronous rebuild of a whole season can run for minutes and trip the
 * proxy timeout). `rebuilt` resolves once every rebuild attempt has finished; only tests need to await
 * it, the HTTP response never does. A rebuild failure is logged and the loop goes on.
 */
export async function moveRegistrationsToSeasonInBackground(ids: string[], label: string, deps: SeasonMoveDeps): Promise<{ moved: number; rebuilt: Promise<void> }> {
  const seasonRef = await deps.seasonIdFor(label);
  const moved = await moveRowsOnly(ids, label, seasonRef, deps);
  const rebuilt = new Promise<void>((resolve) => {
    setImmediate(() => {
      rebuildMoved(moved, label, seasonRef, deps).then(resolve);
    });
  });
  return { moved: moved.length, rebuilt };
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
