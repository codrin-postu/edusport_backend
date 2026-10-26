import { factories } from '@strapi/strapi';
import { previousSlugOwner, previousSlugQuery } from '../../../club/profile-slug';

const UID = 'api::sportsperson.sportsperson';

export default factories.createCoreController(UID, ({ strapi }) => ({
  /**
   * GET /api/sportspeople. `filters[previousSlugs][$contains]=<slug>` (the website, for an address removed by a merge,
   * d39) answers the published profile that remembers the slug. `previousSlugs` is private: matched here, never output.
   */
  async find(ctx) {
    const wanted = previousSlugQuery((ctx.query ?? {}) as Record<string, unknown>);
    if (!wanted) return super.find(ctx);
    const rows = await strapi.db.query(UID).findMany({ select: ['documentId', 'previousSlugs'], where: { publishedAt: { $notNull: true } }, limit: 5000 });
    const documentId = previousSlugOwner(rows, wanted.slug);
    if (!documentId) return { data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } } };
    ctx.query = { ...wanted.rest, filters: { documentId } };
    return super.find(ctx);
  },

  /**
   * Publish a sportsperson via the document service. The content-manager
   * `actions/publish` endpoint re-validates the submitted body and 400s on the
   * update-shaped payload the custom editor sends, so the editor calls this
   * instead: it just promotes the already-saved draft, no body needed.
   */
  async publishOne(ctx) {
    const { documentId } = ctx.params;
    try {
      await strapi.documents(UID).publish({ documentId });
      ctx.body = { published: true, documentId };
    } catch (err) {
      strapi.log.error(`sportsperson publish ${documentId} failed: ${(err as Error).message}`);
      ctx.status = 400;
      ctx.body = { published: false, error: (err as Error).message };
    }
  },
}));
