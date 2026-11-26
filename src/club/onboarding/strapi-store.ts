import type { Core } from '@strapi/strapi';
import { raws } from '../athletes/strapi-store';
import { strapiSecurityStore } from '../security/strapi-store';
import { parseProgress, type Progress } from './progress';

const ADMIN_ACCOUNT = 'api::admin-account.admin-account' as const;

async function stored(strapi: Core.Strapi, adminUserId: number): Promise<Progress> {
  const row = raws(await strapi.documents(ADMIN_ACCOUNT).findMany({ filters: { adminUserId }, fields: ['onboarding'], limit: 1 }))[0];
  return parseProgress(row?.onboarding);
}

/** The caller's own progress; no row yet reads as empty. */
export const readProgress = stored;

/** Read, change and write one admin's progress in one transaction; the `admin_accounts` row is created when missing. */
export async function changeProgress(strapi: Core.Strapi, adminUserId: number, change: (p: Progress) => Progress): Promise<Progress> {
  const store = strapiSecurityStore(strapi);
  return store.transaction(async () => {
    const account = await store.ensureAdminAccount(adminUserId);
    const next = change(await stored(strapi, adminUserId));
    await strapi.documents(ADMIN_ACCOUNT).update({ documentId: account.id, data: { onboarding: next } as never });
    return next;
  });
}
