import type { Core } from '@strapi/strapi';
import { asText } from '../narrow';
import { findCurrentSeason } from '../current-season';
import { blankFileName, documentFileName } from './format';
import { touchesDocuments } from './requests';
import { renderDocument } from './pdf/render';
import { documentsRoot, isSafeDocumentId, listStored, registrationDir, removeStored, replaceStored, type NewFile } from './storage';
import type { DocumentKind, DocumentSeason, StoredDocument } from './types';
import { blankValues, documentKindsFor, registrationValues, type RegistrationRow } from './values';

const UID = 'api::registration-submission.registration-submission' as const;

export class RegistrationNotFoundError extends Error {
  constructor(documentId: string) {
    super(`Registration ${documentId} not found`);
    this.name = 'RegistrationNotFoundError';
  }
}

const root = (strapi: Core.Strapi) => documentsRoot(strapi.dirs.app.root);

/** A Sezon row as the documents need it, or null when it is missing or malformed. */
export function toDocumentSeason(raw: unknown): DocumentSeason | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const fee = typeof s.membershipFee === 'number' && Number.isFinite(s.membershipFee) ? s.membershipFee : null;
  const label = asText(s.label);
  return label ? { label, startMonth: asText(s.startMonth), endMonth: asText(s.endMonth), membershipFee: fee } : null;
}

/** The registration's Sezon; registrations from before phase 2 have only the season label. */
async function seasonOf(strapi: Core.Strapi, seasonRef: unknown, label: unknown): Promise<DocumentSeason | null> {
  const linked = toDocumentSeason(seasonRef);
  if (linked || !asText(label)) return linked;
  return toDocumentSeason(await strapi.documents('api::season.season').findFirst({ filters: { label: asText(label) } }));
}

async function loadRegistration(strapi: Core.Strapi, documentId: string) {
  const doc = await strapi.documents(UID).findOne({ documentId, populate: { seasonRef: true } });
  if (!doc) throw new RegistrationNotFoundError(documentId);
  const row = doc as unknown as RegistrationRow & { seasonRef?: unknown };
  return { row, season: await seasonOf(strapi, row.seasonRef, row.season) };
}

/**
 * Builds (or rebuilds) a registration's PDFs and stores them: the Acord, plus the Cerere de adeziune when
 * the membership answer is Da. New files are written before old ones are deleted. Never sends an e-mail.
 */
export async function buildRegistrationDocuments(strapi: Core.Strapi, registrationDocumentId: string): Promise<StoredDocument[]> {
  const dir = registrationDir(root(strapi), registrationDocumentId);
  const { row, season } = await loadRegistration(strapi, registrationDocumentId);
  const values = registrationValues(row, season);
  const fallback = asText(row.registrationNumber);
  const files: NewFile[] = [];
  for (const kind of documentKindsFor(row)) {
    files.push({ kind, fileName: documentFileName(kind, values.childName, values.season, fallback), data: await renderDocument(kind, values) });
  }
  return replaceStored(dir, files);
}

/** Outcome of a rebuild, as the admin PUT returns it (`reason` only when nothing was rebuilt). */
export type RebuildResult = { ok: boolean; documents: DocumentKind[]; reason?: 'unknown-season' | 'failed' };

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Rebuilds a registration's PDFs; never throws: a failure is logged and reported. Never sends an e-mail. */
export async function rebuildDocuments(strapi: Core.Strapi, registrationDocumentId: string): Promise<RebuildResult> {
  try {
    return { ok: true, documents: (await buildRegistrationDocuments(strapi, registrationDocumentId)).map((d) => d.kind) };
  } catch (err) {
    strapi.log.error(`[inscrieri] rebuilding documents of ${registrationDocumentId} failed: ${message(err)}`);
    return { ok: false, documents: [], reason: 'failed' };
  }
}

/** The documentId of the Sezon labelled `label`, or null (no label, or no such Sezon). */
export async function seasonIdForLabel(strapi: Core.Strapi, label: unknown): Promise<string | null> {
  const text = asText(label);
  if (!text) return null;
  const season = await strapi.documents('api::season.season').findFirst({ filters: { label: text } });
  return season?.documentId ?? null;
}

/**
 * After an admin edit saved `data`: rebuild when a printed field changed. A season changed to a label with
 * no Sezon (`seasonRef` null) skips the rebuild, logged, and the old PDFs stay.
 */
export async function rebuildAfterEdit(strapi: Core.Strapi, registrationDocumentId: string, data: Record<string, unknown>): Promise<RebuildResult | null> {
  if (!touchesDocuments(data)) return null;
  if ('season' in data && !data.seasonRef) {
    strapi.log.warn(`[inscrieri] ${registrationDocumentId}: no Sezon is labelled "${asText(data.season)}"; documents not rebuilt`);
    return { ok: false, documents: [], reason: 'unknown-season' };
  }
  return rebuildDocuments(strapi, registrationDocumentId);
}

/** The PDFs stored for a registration (empty when none were built). */
export async function listRegistrationDocuments(strapi: Core.Strapi, registrationDocumentId: string): Promise<StoredDocument[]> {
  return listStored(registrationDir(root(strapi), registrationDocumentId));
}

/** Deletes a registration's stored PDFs (the registration was deleted). Missing files or folder: nothing happens. */
export async function deleteRegistrationDocuments(strapi: Core.Strapi, registrationDocumentId: string): Promise<void> {
  if (!isSafeDocumentId(registrationDocumentId)) return;
  await removeStored(registrationDir(root(strapi), registrationDocumentId));
}

/** A blank form for paper sign-ups: the current Sezon's season, period and fee, everything else blank. Not stored. */
export async function renderBlankDocument(strapi: Core.Strapi, kind: DocumentKind): Promise<{ fileName: string; data: Buffer }> {
  const season = toDocumentSeason(await findCurrentSeason(strapi));
  return { fileName: blankFileName(kind, season?.label ?? null), data: await renderDocument(kind, blankValues(season)) };
}
