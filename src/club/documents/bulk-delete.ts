export interface BulkDeleteDeps {
  /** Ids of the registrations about to be deleted, read before the delete. */
  findIds(): Promise<string[]>;
  /** Deletes the e-mail jobs of these registrations; runs before the rows go, while the link still resolves. */
  deleteEmailJobs(ids: string[]): Promise<unknown>;
  /** Deletes exactly these rows (the ids read first); returns how many were deleted. */
  deleteRows(ids: string[]): Promise<number>;
  deleteDocuments(registrationDocumentId: string): Promise<void>;
  logError(message: string): void;
}

/**
 * Deletes registrations and then their PDFs (user, 2026-10-21: deleting a registration also deletes its PDFs).
 * Ids are read first, then their e-mail jobs and rows go, folders last; a folder that fails is logged and the rest continue.
 */
export async function deleteRegistrationsWithDocuments(deps: BulkDeleteDeps): Promise<number> {
  const ids = await deps.findIds();
  if (ids.length === 0) return 0;
  await deps.deleteEmailJobs(ids);
  const count = await deps.deleteRows(ids);
  for (const id of ids) {
    try {
      await deps.deleteDocuments(id);
    } catch (err) {
      deps.logError(`[inscrieri] deleting documents of ${id} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return count;
}
