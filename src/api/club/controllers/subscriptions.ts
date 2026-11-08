import { respond, type AdminCtx } from '../../../club/admin-http';
import { presenceContext } from '../../../club/presence/context';
import { extendPreview, extendSubscriptions } from '../../../club/presence/subscriptions/extend';
import { addSubscription, newSubscriptionForm } from '../../../club/presence/subscriptions/add';
import { cancelSubscription } from '../../../club/presence/subscriptions/cancel';
import { listSubscriptions, readSubscriptionQuery } from '../../../club/presence/subscriptions/reads';
import { readAthleteSubscriptionCards } from '../../../club/presence/subscriptions/usage';
import { strapiPresenceStore } from '../../../club/presence/strapi-store';
import { queryText, respondAction, todayIso } from '../../../club/groups/http';

const id = (ctx: AdminCtx): string => ctx.params.documentId ?? '';

/** Admin API of Abonamente (routes/10-subscriptions.ts, all `global::is-admin`). */
export default {
  async list(ctx: AdminCtx) {
    ctx.body = { data: await listSubscriptions(strapiPresenceStore(strapi), ctx.query, todayIso()) };
  },

  async extendPreview(ctx: AdminCtx) {
    ctx.body = { data: await extendPreview(strapiPresenceStore(strapi), todayIso()) };
  },

  async extend(ctx: AdminCtx) {
    respondAction(ctx, await extendSubscriptions(await presenceContext(strapi, ctx), ctx.request.body));
  },

  async cancel(ctx: AdminCtx) {
    respondAction(ctx, await cancelSubscription(await presenceContext(strapi, ctx), id(ctx)));
  },

  async form(ctx: AdminCtx) {
    respond(ctx, await newSubscriptionForm(strapiPresenceStore(strapi), id(ctx), queryText(ctx.query.startsOn), todayIso()));
  },

  async athlete(ctx: AdminCtx) {
    respond(ctx, await readAthleteSubscriptionCards(strapiPresenceStore(strapi), id(ctx), queryText(ctx.query.season), todayIso()));
  },

  async add(ctx: AdminCtx) {
    respondAction(ctx, await addSubscription(await presenceContext(strapi, ctx), id(ctx), ctx.request.body));
  },
};
