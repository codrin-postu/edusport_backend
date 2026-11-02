import { refuseWith, type AdminCtx } from '../../../club/admin-http';
import { monthOf, isMonth } from '../../../club/presence/dates';
import { presenceContext } from '../../../club/presence/context';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { readDue } from '../../../club/presence/due/reads';
import { cancelPayment } from '../../../club/presence/payments/cancel';
import { editPayment } from '../../../club/presence/payments/edit';
import { athletePaymentOptions, athletePayments, listPayments, readPaymentQuery } from '../../../club/presence/payments/reads';
import { recordPayment } from '../../../club/presence/payments/record';
import { strapiPresenceStore } from '../../../club/presence/strapi-store';
import { queryText, respondAction, todayIso } from '../../../club/groups/http';

const id = (ctx: AdminCtx): string => ctx.params.documentId ?? '';

/** Admin API of Plăți and De încasat (routes/11-payments.ts, all `global::is-admin`). */
export default {
  async list(ctx: AdminCtx) {
    const today = todayIso();
    ctx.body = { data: await listPayments(strapiPresenceStore(strapi), readPaymentQuery(ctx.query, today), today) };
  },

  async create(ctx: AdminCtx) {
    respondAction(ctx, await recordPayment(await presenceContext(strapi, ctx), ctx.request.body));
  },

  async due(ctx: AdminCtx) {
    const today = todayIso();
    const month = queryText(ctx.query.month);
    if (month !== null && !isMonth(month)) return refuseWith(ctx, 400, PRESENCE_ERRORS.invalid);
    ctx.body = { data: await readDue(strapiPresenceStore(strapi), month ?? monthOf(today), today) };
  },

  async update(ctx: AdminCtx) {
    respondAction(ctx, await editPayment(await presenceContext(strapi, ctx), id(ctx), ctx.request.body));
  },

  async cancel(ctx: AdminCtx) {
    respondAction(ctx, await cancelPayment(await presenceContext(strapi, ctx), id(ctx)));
  },

  async options(ctx: AdminCtx) {
    const options = await athletePaymentOptions(strapiPresenceStore(strapi), id(ctx), todayIso(), queryText(ctx.query.month));
    if (!options) return refuseWith(ctx, 404, PRESENCE_ERRORS.notFound);
    ctx.body = { data: options };
  },

  async athlete(ctx: AdminCtx) {
    const page = await athletePayments(strapiPresenceStore(strapi), id(ctx), todayIso());
    if (!page) return refuseWith(ctx, 404, PRESENCE_ERRORS.notFound);
    ctx.body = { data: page };
  },
};
