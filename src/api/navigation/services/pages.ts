/**
 * The switchable page list is fixed in code (see docs/admin-ui/PAGES-TOGGLE.md).
 * This keeps the `pages` component on the "Meniu site" single type in sync
 * with that list: missing keys are added as enabled, unknown keys are
 * dropped, and the order always matches PAGE_KEYS. An existing row's
 * `enabled` value is never touched — this only adds/removes/reorders rows,
 * it never flips a switch.
 */
import type { Core } from '@strapi/strapi';

const UID = 'api::navigation.navigation';

/** Fixed, ordered list of switchable page keys. */
export const PAGE_KEYS = [
  'istoric',
  'echipa',
  'sportivi',
  'realizari',
  'voluntariat',
  'scoala',
  'program',
  'regulament',
  'noutati',
  'parteneri',
  'inscrieri',
] as const;

interface StoredPage {
  key?: string | null;
  enabled?: boolean | null;
}

/**
 * Called once on bootstrap. No-op (besides logging) once the stored `pages`
 * already matches PAGE_KEYS exactly, so it's safe to run on every boot.
 */
export async function normalizeNavigationPages(strapi: Core.Strapi): Promise<void> {
  try {
    const entry: any = await strapi.documents(UID).findFirst({ populate: { pages: true } as any });

    const existing: StoredPage[] = Array.isArray(entry?.pages) ? entry.pages : [];
    const byKey = new Map(existing.filter((p) => p?.key).map((p) => [String(p.key), p]));

    const next = PAGE_KEYS.map((key) => {
      const row = byKey.get(key);
      return { key, enabled: typeof row?.enabled === 'boolean' ? row.enabled : true };
    });

    if (!entry) {
      // No "Meniu site" entry yet (single type never saved) — create one with
      // just the normalized pages list; overrides stay empty until edited.
      await strapi.documents(UID).create({ data: { pages: next } as any });
      strapi.log.info('[navigation] created Meniu site entry with default pages list');
      return;
    }

    const changed =
      existing.length !== next.length ||
      existing.some((row, i) => row?.key !== next[i].key || Boolean(row?.enabled) !== next[i].enabled) ||
      // dropped unknown keys
      existing.some((row) => row?.key && !(PAGE_KEYS as readonly string[]).includes(String(row.key)));

    if (!changed) return;

    await strapi.documents(UID).update({
      documentId: entry.documentId,
      data: { pages: next } as any,
    });
    strapi.log.info('[navigation] normalized pages list to match PAGE_KEYS');
  } catch (err) {
    strapi?.log?.warn?.(`[navigation] pages normalization failed: ${(err as Error)?.message ?? err}`);
  }
}
