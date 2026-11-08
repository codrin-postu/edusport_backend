import { verifiedAdminId } from '../../../club/admin-auth';
import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { downloadLogLine } from '../../../club/download-log';
import { accountingCsv, accountingName, accountingXlsx } from '../../../club/money/accounting-export';
import { readAccounting, readAccountingData, readMoneyMonth, readOverview } from '../../../club/money/service';
import type { MoneyOverview } from '../../../club/money/types';
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
import { exportLimit } from '../../../club/tables/limit';

type FileCtx = AdminCtx & { set: (field: string, value: string) => void };
const id = (ctx: AdminCtx): string => ctx.params.documentId ?? '';
/** One store per request. */
const store = () => strapiPresenceStore(strapi);

/** The `month` query, or null after the 400 has been sent. */
function moneyMonth(ctx: AdminCtx, today: string): string | null {
  const month = readMoneyMonth(ctx.query.month, today);
  if (month === null) refuseWith(ctx, 400, PRESENCE_ERRORS.invalid);
  return month;
}

/** The accounting file: month checked, the read through the export limiter, one log line (no names, S62). */
async function accountingFile(ctx: FileCtx, format: 'xlsx' | 'csv'): Promise<void> {
  const today = todayIso();
  const month = moneyMonth(ctx, today);
  if (month === null) return;
  const data = await exportLimit(() => readAccountingData(store(), month, today, format));
  const adminId = await verifiedAdminId(ctx.request.header.authorization, strapi);
  strapi.log.info(downloadLogLine({ adminId, kind: format === 'xlsx' ? 'accounting-xlsx' : 'accounting-csv', rows: data.accounting.payments.length }));
  ctx.set('Content-Disposition', `attachment; filename="${accountingName(month, format)}"`);
  if (format === 'csv') {
    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.body = accountingCsv(data.accounting, data.extra);
    return;
  }
  ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  ctx.body = await accountingXlsx(data.accounting, data.overview as MoneyOverview, data.extra);
}

/** Admin API of Plăți and De încasat (routes/11-payments.ts, all `global::is-admin`). */
export default {
  async list(ctx: AdminCtx) {
    const today = todayIso();
    ctx.body = { data: await listPayments(strapiPresenceStore(strapi), readPaymentQuery(ctx.query, today), today) };
  },

  async moneyOverview(ctx: AdminCtx) {
    const today = todayIso();
    const month = moneyMonth(ctx, today);
    if (month !== null) respond(ctx, { ok: true, data: await readOverview(store(), month, today) });
  },

  async accounting(ctx: AdminCtx) {
    const today = todayIso();
    const month = moneyMonth(ctx, today);
    if (month !== null) respond(ctx, { ok: true, data: await readAccounting(store(), month) });
  },

  async accountingXlsx(ctx: FileCtx) {
    await accountingFile(ctx, 'xlsx');
  },

  async accountingCsv(ctx: FileCtx) {
    await accountingFile(ctx, 'csv');
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
