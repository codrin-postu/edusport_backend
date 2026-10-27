import { readFile } from 'node:fs/promises';
import type { Core } from '@strapi/strapi';
import type { AdminCtx } from '../admin-http';
import { clubStore, serviceContext } from '../athletes/http';
import { deleteRegistrationDocuments, listRegistrationDocuments } from '../documents';
import { strapiPresenceStore } from '../presence/strapi-store';
import type { AnonymizeContext } from './anonymize-service';
import type { ExportContext, ExportDocument } from './export-service';
import { sweepAnonymizedFolders } from './sweep';

async function storedDocuments(strapi: Core.Strapi, registrationId: string): Promise<ExportDocument[]> {
  const docs = await listRegistrationDocuments(strapi, registrationId);
  return Promise.all(docs.map(async (d) => ({ kind: d.kind, fileName: d.fileName, data: await readFile(d.path) })));
}

export async function anonymizeContext(strapi: Core.Strapi, ctx: AdminCtx): Promise<AnonymizeContext> {
  return { ...(await serviceContext(strapi, ctx)), removeFiles: (id) => deleteRegistrationDocuments(strapi, id), now: () => new Date() };
}

export async function exportContext(strapi: Core.Strapi, ctx: AdminCtx): Promise<ExportContext> {
  return { ...(await serviceContext(strapi, ctx)), storedDocuments: (id) => storedDocuments(strapi, id), now: () => new Date(), presence: strapiPresenceStore(strapi) };
}

/** Startup (3C spec 4): removes PDF folders an anonymization could not delete. Never blocks or fails the start. */
export function startPersonalDataSweep(strapi: Core.Strapi): void {
  const log = (message: string) => strapi.log.error(message);
  void sweepAnonymizedFolders(clubStore(strapi), (id) => deleteRegistrationDocuments(strapi, id), log)
    .then((n) => {
      if (n) strapi.log.debug(`[personal-data] startup sweep: ${n} registration folder(s) of anonymized athletes checked`);
    })
    .catch((err) => log(`[personal-data] startup sweep failed: ${err instanceof Error ? err.message : String(err)}`));
}
