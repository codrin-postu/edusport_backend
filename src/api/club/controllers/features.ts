import type { Core } from '@strapi/strapi';
import { adminActor } from '../../../club/admin-actor';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { refuseWith, type AdminCtx } from '../../../club/admin-http';
import { changeFeatures, type FeaturePort } from '../../../club/features/change';
import { FEATURES_COPY } from '../../../club/features/copy';
import { FEATURE_KEYS, installedPortals, type FeatureKey } from '../../../club/features/features';
import { loadFeatures, loadSaved, saveFeatures } from '../../../club/features/strapi-store';
import { recordHistory } from '../../../club/history';
import { PORTAL_HOSTS } from '../../../club/portal/auth/bff';
import { jobStore } from '../../../email/strapi-email';

const HISTORY_UID = 'api::history-entry.history-entry';

async function lastChange(strapi: Core.Strapi): Promise<{ by: string; at: string } | null> {
  const row = (await strapi.documents(HISTORY_UID).findFirst({ filters: { subjectType: 'features', action: 'featuresChanged' }, sort: ['at:desc'] })) as { actor?: string; at?: unknown } | null;
  if (!row?.actor) return null;
  const at = row.at instanceof Date ? row.at.toISOString() : typeof row.at === 'string' ? row.at : '';
  return at ? { by: row.actor, at } : null;
}

async function snapshot(strapi: Core.Strapi) {
  return {
    saved: await loadSaved(strapi),
    features: await loadFeatures(strapi),
    installed: installedPortals(PORTAL_HOSTS()),
    lastChange: await lastChange(strapi),
  };
}

function readBody(body: unknown): { key: FeatureKey; on: boolean } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { key, on } = body as { key?: unknown; on?: unknown };
  if (typeof key !== 'string' || !(FEATURE_KEYS as readonly string[]).includes(key) || typeof on !== 'boolean') return null;
  return { key: key as FeatureKey, on };
}

const CONFLICT = { needsPrezenta: FEATURES_COPY.needsPrezenta, notInstalled: FEATURES_COPY.notInstalled } as const;

/** Admin API of the Funcții page (routes/15-features.ts). */
export default {
  async read(ctx: AdminCtx) {
    ctx.body = { data: await snapshot(strapi) };
  },
  async save(ctx: AdminCtx) {
    const input = readBody(ctx.request.body);
    if (!input) return refuseWith(ctx, 400, ADMIN_ERRORS.invalid);
    const port: FeaturePort = {
      saved: () => loadSaved(strapi),
      save: (f) => saveFeatures(strapi, f),
      cancelJobs: (features) => jobStore(strapi).cancelQueuedForFeatures(features, 'featureOff'),
      history: (entry) => recordHistory(strapi, entry),
      log: (message) => strapi.log.error(message),
      installed: installedPortals(PORTAL_HOSTS()),
    };
    const result = await changeFeatures(port, { ...input, actor: await adminActor(ctx.request.header.authorization, strapi) });
    if (result.ok === false) {
      refuseWith(ctx, 409, CONFLICT[result.code]);
      (ctx.body as { error: Record<string, unknown> }).error.details = { code: result.code };
      return;
    }
    ctx.body = { data: { ...(await snapshot(strapi)), alsoOff: result.alsoOff } };
  },
};
