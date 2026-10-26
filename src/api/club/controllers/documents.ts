import { createReadStream } from 'node:fs';
import {
  buildRegistrationDocuments,
  listRegistrationDocuments,
  renderBlankDocument,
  RegistrationNotFoundError,
  isDocumentKind,
  type DocumentKind,
  type StoredDocument,
} from '../../../club/documents';
import { expiredLinkUrl, findKind, pdfHeaders, readAdminRequest, readPublicRequest } from '../../../club/documents/requests';

type Ctx = {
  query: Record<string, unknown>;
  params: Record<string, unknown>;
  status: number;
  body: unknown;
  set(headers: Record<string, string>): void;
  redirect(url: string): void;
};

function sendFile(ctx: Ctx, doc: StoredDocument): void {
  ctx.set(pdfHeaders(doc.fileName));
  ctx.body = createReadStream(doc.path);
}

/** An expired or invalid link goes to the site's "link expirat" page (user, 2026-10-21); an unknown kind is a 400. */
function refusePublic(ctx: Ctx, status: 400 | 410): void {
  const target = status === 410 ? expiredLinkUrl() : null;
  if (target) {
    ctx.redirect(target);
    return;
  }
  ctx.status = status;
  ctx.body = { error: status === 410 ? 'expired' : 'invalid' };
}

function notFound(ctx: Ctx): void {
  ctx.status = 404;
  ctx.body = { error: 'not-found' };
}

/** The stored PDF of `kind`; for the admin, a missing set is built first (old registrations, a failed build at submit). */
async function storedOrBuilt(registrationDocumentId: string, kind: DocumentKind): Promise<StoredDocument | null> {
  const stored = findKind(await listRegistrationDocuments(strapi, registrationDocumentId), kind);
  if (stored) return stored;
  try {
    return findKind(await buildRegistrationDocuments(strapi, registrationDocumentId), kind);
  } catch (err) {
    if (err instanceof RegistrationNotFoundError) return null;
    throw err;
  }
}

export default {
  /** GET /api/forms/inscriere/documents?token=&kind= (public): the success screen's 24-hour download. */
  async publicDownload(ctx: Ctx) {
    const request = readPublicRequest(ctx.query);
    if (request.ok === false) {
      refusePublic(ctx, request.status);
      return;
    }
    const doc = findKind(await listRegistrationDocuments(strapi, request.registrationDocumentId), request.kind);
    if (doc) sendFile(ctx, doc);
    else notFound(ctx);
  },

  /** GET /api/club/registrations/:documentId/documents/:kind (admin). */
  async registrationDocument(ctx: Ctx) {
    const request = readAdminRequest(ctx.params);
    if (request.ok === false) {
      ctx.status = 400;
      ctx.body = { error: 'invalid' };
      return;
    }
    const doc = await storedOrBuilt(request.registrationDocumentId, request.kind);
    if (doc) sendFile(ctx, doc);
    else notFound(ctx);
  },

  /** GET /api/club/documents/blank/:kind (admin): "Formulare goale", printed with the current Sezon. */
  async blankForm(ctx: Ctx) {
    if (!isDocumentKind(ctx.params.kind)) {
      ctx.status = 400;
      ctx.body = { error: 'invalid' };
      return;
    }
    const { fileName, data } = await renderBlankDocument(strapi, ctx.params.kind);
    ctx.set(pdfHeaders(fileName));
    ctx.body = data;
  },
};
