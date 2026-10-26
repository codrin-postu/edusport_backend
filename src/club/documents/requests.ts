import { isSafeDocumentId } from './storage';
import { verifyDownloadToken } from './token';
import { isDocumentKind, type DocumentKind, type StoredDocument } from './types';

export type DocumentRequest = { ok: true; registrationDocumentId: string; kind: DocumentKind } | { ok: false; status: 400 | 410 };

/** GET /api/forms/inscriere/documents?token=&kind=: a known kind (400 otherwise) and a valid, unexpired token (410 otherwise). */
export function readPublicRequest(query: Record<string, unknown>, now: Date = new Date()): DocumentRequest {
  if (!isDocumentKind(query.kind)) return { ok: false, status: 400 };
  const token = verifyDownloadToken(query.token, now);
  return token ? { ok: true, registrationDocumentId: token.registrationDocumentId, kind: query.kind } : { ok: false, status: 410 };
}

/** GET /api/club/registrations/:documentId/documents/:kind (admin). */
export function readAdminRequest(params: Record<string, unknown>): DocumentRequest {
  if (!isDocumentKind(params.kind) || !isSafeDocumentId(params.documentId)) return { ok: false, status: 400 };
  return { ok: true, registrationDocumentId: params.documentId, kind: params.kind };
}

/**
 * Where an expired or invalid public link sends the browser: the site's page `/inscrieri/link-expirat`
 * (plan 2C). The site is the first origin of FRONTEND_ORIGIN (the CORS list, also used by
 * src/utils/revalidate.ts); locally http://localhost:3000. Null in production without FRONTEND_ORIGIN.
 */
export function expiredLinkUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const site = (env.FRONTEND_ORIGIN ?? '').split(',').map((s) => s.trim()).find(Boolean);
  const base = site ?? (env.NODE_ENV === 'production' ? null : 'http://localhost:3000');
  return base ? new URL('/inscrieri/link-expirat', base).toString() : null;
}

export const findKind = (docs: StoredDocument[], kind: DocumentKind) => docs.find((d) => d.kind === kind) ?? null;

/** Response headers for a PDF download: never cached, never indexed, saved under its own name. */
export function pdfHeaders(fileName: string): Record<string, string> {
  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
  };
}

/** Registration fields printed on the documents: saving any of them rebuilds the PDFs. */
export const DOCUMENT_FIELDS = [
  'email',
  'phone',
  'parentName',
  'relationship',
  'relationshipOther',
  'childName',
  'childBirthDate',
  'membershipAnswer',
  'season',
] as const;

export function touchesDocuments(data: Record<string, unknown>): boolean {
  return DOCUMENT_FIELDS.some((key) => key in data);
}
