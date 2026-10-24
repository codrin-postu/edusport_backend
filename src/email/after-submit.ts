/** The submit result as far as the e-mail needs it; plan 2D's `SubmitResult` (with its internal `documentId`) fits. */
export type SavedRegistration = { ok: true; documentId: string; repeat?: true } | { ok: false };

/**
 * Called by `submitPublic` right after `finishSubmit` (the PDFs are built): queue the registration e-mail.
 * A repeat submit queues nothing: its first submit already did.
 * Never throws: a failure is logged and the parent's response is unchanged; the admin can resend.
 */
export async function queueEmailAfterSubmit(
  saved: SavedRegistration,
  enqueue: (registrationDocumentId: string) => Promise<void>,
  logError: (message: string) => void,
): Promise<void> {
  if (saved.ok === false || saved.repeat) return;
  try {
    await enqueue(saved.documentId);
  } catch (err) {
    logError(`[inscriere] e-mail not queued for ${saved.documentId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
