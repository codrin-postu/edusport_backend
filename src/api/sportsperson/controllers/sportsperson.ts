import { factories } from '@strapi/strapi';

const UID = 'api::sportsperson.sportsperson';

export default factories.createCoreController(UID, ({ strapi }) => ({
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
