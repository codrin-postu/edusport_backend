import type { Core } from '@strapi/strapi';
import { PORTAL_HOSTS } from '../portal/auth/bff';
import { installedPortals, readFeatures, savedFeatures, type Features } from './features';

const UID = 'api::feature-settings.feature-settings';

type Row = { documentId: string; features?: unknown };

const findRow = async (strapi: Core.Strapi): Promise<Row | null> => (await strapi.documents(UID).findFirst()) as Row | null;

/** The effective switches: saved choice, dependency rule, portals ANDed with the installed hosts. One `findFirst`; no process cache, so a change is live on the next request. */
export async function loadFeatures(strapi: Core.Strapi): Promise<Features> {
  return readFeatures(await findRow(strapi), installedPortals(PORTAL_HOSTS()));
}

/** The saved choice only (what the Funcții page edits), without the installed-portal rule. */
export async function loadSaved(strapi: Core.Strapi): Promise<Features> {
  return savedFeatures(await findRow(strapi));
}

/** Replaces the stored set (the single row is created on the first save). */
export async function saveFeatures(strapi: Core.Strapi, f: Features): Promise<void> {
  const row = await findRow(strapi);
  if (row) await strapi.documents(UID).update({ documentId: row.documentId, data: { features: f } });
  else await strapi.documents(UID).create({ data: { features: f } });
}
