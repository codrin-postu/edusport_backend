export interface BulkDeleteDeps {
  /** Ids of the registrations about to be deleted, read before the delete. */
  findIds(): Promise<string[]>;
  /** Deletes the rows; returns how many were deleted. */
  deleteRows(): Promise<number>;
  deleteDocuments(registrationDocumentId: string): Promise<void>;
  logError(message: string): void;
}

/**
 * Deletes registrations and then their PDFs (user, 2026-10-21: deleting a registration also deletes its PDFs).
 * Ids are read first, rows deleted next, folders last; a folder that fails is logged and the rest continue.
 */
export async function deleteRegistrationsWithDocuments(deps: BulkDeleteDeps): Promise<number> {
  const ids = await deps.findIds();
  const count = await deps.deleteRows();
  for (const id of ids) {
    try {
      await deps.deleteDocuments(id);
    } catch (err) {
      deps.logError(`[inscrieri] deleting documents of ${id} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return count;
}
