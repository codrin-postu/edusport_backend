import { SUBMIT_ERRORS, type SubmitResult } from '../registration-submit';
import { documentTokenSecret } from './token';
import type { DocumentKind, StoredDocument } from './types';

/** POST /api/forms/inscriere success body (cross-plan contract): no internal id, a 24 h download token. */
export type PublicSubmitSuccess = { ok: true; registrationNumber: string; downloadToken: string; documents: DocumentKind[] };
export type PublicSubmitFailure = Extract<SubmitResult, { ok: false }>;
export type PublicSubmitResponse = PublicSubmitSuccess | PublicSubmitFailure;

export interface FinishDeps {
  buildDocuments(registrationDocumentId: string): Promise<StoredDocument[]>;
  createToken(registrationDocumentId: string): string;
  logError(message: string): void;
}

/**
 * Fails closed: in production, without DOCUMENT_TOKEN_SECRET no registration is taken (the success screen
 * could not offer its download). Returns the refusal, or null when submits may proceed.
 */
export function submitBlockedReason(env: NodeJS.ProcessEnv = process.env): PublicSubmitFailure | null {
  if (documentTokenSecret(env)) return null;
  return { ok: false, code: 'save-failed', error: SUBMIT_ERRORS['save-failed'] };
}

/** After a saved registration: build its PDFs (a failure is logged; the registration still succeeds) and sign the link. */
export async function finishSubmit(result: SubmitResult, deps: FinishDeps): Promise<PublicSubmitResponse> {
  if (result.ok === false) return result;
  let documents: DocumentKind[] = [];
  try {
    documents = (await deps.buildDocuments(result.documentId)).map((d) => d.kind);
  } catch (err) {
    deps.logError(`[inscriere] documents for ${result.registrationNumber} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { ok: true, registrationNumber: result.registrationNumber, downloadToken: deps.createToken(result.documentId), documents };
}
