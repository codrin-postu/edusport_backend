/**
 * Meniu site: one public read (the core router) + a narrow admin read/write.
 *
 * The menu STRUCTURE (labels, addresses, order, which sublinks exist) lives in
 * the frontend code and is deliberately not stored here. This single type only
 * holds, per section key, the promo card's description and image.
 *
 * Public read is the standard core route:
 *   GET /api/navigation?populate[overrides][populate]=image
 * The site authenticates with its read API token, like every other content type
 * it fetches, so nothing extra is registered for it.
 *
 * Admin (`/api/meniu-site`, `global::is-admin`) is the custom "Meniu site" page's
 * data source, following the announcement and sheet-link pattern: content api
 * routes with auth disabled, guarded by the policy, so the admin fetch client's
 * Bearer token is the only way in. The single type is hidden from the
 * content-manager, so this is the only write path.
 *
 * `update` can only touch `description` and `image` of a key that already
 * exists. It cannot add, remove or rename a key, so the structure stays safe
 * even if the admin page is bypassed.
 */
import { factories } from '@strapi/strapi';

const UID = 'api::navigation.navigation';

interface StoredOverride {
  key?: string | null;
  description?: string | null;
  image?: { id?: number } | null;
}

interface AdminOverride {
  key: string;
  description: string | null;
  image: { id: number; url: string; name: string | null } | null;
}

const POPULATE = { overrides: { populate: { image: true } } } as const;

const toAdmin = (row: StoredOverride): AdminOverride => {
  const img = row?.image as { id?: number; url?: string; name?: string } | null | undefined;
  return {
    key: String(row?.key ?? ''),
    description: row?.description ?? null,
    image:
      img && typeof img.id === 'number' && typeof img.url === 'string'
        ? { id: img.id, url: img.url, name: img.name ?? null }
        : null,
  };
};

/** The shape the update handler writes back: media as a bare id, or null. */
const toWritable = (row: StoredOverride) => ({
  key: String(row?.key ?? ''),
  description: row?.description ?? null,
  image: typeof row?.image?.id === 'number' ? row.image.id : null,
});

async function loadOverrides(): Promise<StoredOverride[]> {
  const entry: any = await strapi.documents(UID).findFirst({ populate: POPULATE as any });
  const rows = entry?.overrides;
  return Array.isArray(rows) ? (rows as StoredOverride[]) : [];
}

export default factories.createCoreController(UID, () => ({
  /** GET /api/meniu-site  ->  { data: { overrides: AdminOverride[] } } */
  async adminList(ctx: any) {
    const rows = await loadOverrides();
    ctx.body = { data: { overrides: rows.map(toAdmin) } };
  },

  /**
   * PUT /api/meniu-site
   * body: { key: string, description?: string | null, image?: number | null }
   * Only the row matching `key` changes, and only its two editable fields.
   */
  async adminUpdate(ctx: any) {
    const body = ctx.request?.body?.data ?? ctx.request?.body ?? {};
    const key = typeof body.key === 'string' ? body.key.trim() : '';
    if (!key) {
      ctx.badRequest('Lipsește cheia secțiunii.');
      return;
    }

    const hasDescription = Object.prototype.hasOwnProperty.call(body, 'description');
    const hasImage = Object.prototype.hasOwnProperty.call(body, 'image');

    let description: string | null = null;
    if (hasDescription) {
      if (body.description !== null && typeof body.description !== 'string') {
        ctx.badRequest('Descrierea trebuie să fie text.');
        return;
      }
      const raw = body.description === null ? '' : String(body.description);
      description = raw.trim() === '' ? null : raw;
    }

    let image: number | null = null;
    if (hasImage) {
      if (body.image !== null && !Number.isInteger(body.image)) {
        ctx.badRequest('Imaginea trebuie trimisă ca id de fișier.');
        return;
      }
      image = body.image === null ? null : Number(body.image);
    }

    const entry: any = await strapi.documents(UID).findFirst({ populate: POPULATE as any });
    const rows: StoredOverride[] = Array.isArray(entry?.overrides) ? entry.overrides : [];
    if (!rows.some((r) => r?.key === key)) {
      ctx.notFound('Nu există niciun card de meniu cu această cheie.');
      return;
    }

    const next = rows.map((row) => {
      const base = toWritable(row);
      if (row?.key !== key) return base;
      return {
        ...base,
        description: hasDescription ? description : base.description,
        image: hasImage ? image : base.image,
      };
    });

    await strapi.documents(UID).update({
      documentId: entry.documentId,
      data: { overrides: next } as any,
    });

    ctx.body = { data: { overrides: (await loadOverrides()).map(toAdmin) } };
  },
}));
