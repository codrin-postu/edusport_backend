import { verifiedAdminId } from '../../../club/admin-auth';
import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { downloadLogLine } from '../../../club/download-log';
import { respondAction, todayIso } from '../../../club/groups/http';
import { strapiPresenceStore } from '../../../club/presence/strapi-store';
import { TABLES_COPY } from '../../../club/tables/copy';
import { tableCsv, tableXlsx } from '../../../club/tables/export';
import { csvName, xlsxName } from '../../../club/tables/file-names';
import { BudgetError, exportLimit, startBudget } from '../../../club/tables/limit';
import { readCatalog, readExportRequest, runTable, TABLES_NO_XLSX, XLSX_READY } from '../../../club/tables/service';
import { CATALOG } from '../../../club/tables/catalog';
import { callerOf } from '../../../club/tables/views-caller';
import { createView, deleteView, listViews, updateView } from '../../../club/tables/views-service';
import { strapiTableViewStore } from '../../../club/tables/views-store';
import type { AdminResult } from '../../../club/admin-result';
import type { TableResult } from '../../../club/tables/types';

type FileCtx = AdminCtx & { set: (field: string, value: string) => void };
const param = (ctx: AdminCtx, key: string): string => ctx.params[key] ?? '';
const store = () => strapiPresenceStore(strapi);
/** One views store per request: its transaction scope is its own state. */
const views = () => strapiTableViewStore(strapi);
const caller = (ctx: AdminCtx) => callerOf(ctx.request.header.authorization, strapi);

/** At most two queries or exports at a time per process; the 10 s budget starts when the work starts, not when it queued. A spent budget is a 503. */
async function limited(ctx: AdminCtx, body: unknown, today: string): Promise<AdminResult<TableResult> | null> {
  try {
    return await exportLimit(() => runTable(store(), body, { today, budget: startBudget(10_000, Date.now) }));
  } catch (error) {
    if (!(error instanceof BudgetError)) throw error;
    refuseWith(ctx, 503, TABLES_COPY.errors.tooSlow);
    return null;
  }
}

/** The Sportivi "Tabele" tab: catalog, queries, downloads and saved views (routes/13-tables.ts). */
export default {
  async catalog(ctx: AdminCtx) {
    respond(ctx, { ok: true, data: await readCatalog(store(), todayIso()) });
  },

  async query(ctx: AdminCtx) {
    const result = await limited(ctx, ctx.request.body, todayIso());
    if (result) respond(ctx, result);
  },

  async export(ctx: FileCtx) {
    const request = readExportRequest(ctx.request.body);
    if (request.ok === false) return refuseWith(ctx, request.status, request.error);
    const { format } = request.data;
    if (format === 'xlsx' && !XLSX_READY) return refuseWith(ctx, 501, TABLES_NO_XLSX);
    const today = todayIso();
    const result = await limited(ctx, { definition: request.data.definition }, today);
    if (!result) return;
    if (result.ok === false) return refuseWith(ctx, result.status, result.error);
    const table = result.data;
    const adminId = await verifiedAdminId(ctx.request.header.authorization, strapi);
    strapi.log.info(downloadLogLine({ adminId, kind: format === 'xlsx' ? 'tables-xlsx' : 'tables-csv', rows: table.count }));
    if (format === 'csv') {
      ctx.set('Content-Type', 'text/csv; charset=utf-8');
      ctx.set('Content-Disposition', `attachment; filename="${csvName(table.subject, today)}"`);
      ctx.body = tableCsv(table);
      return;
    }
    ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    ctx.set('Content-Disposition', `attachment; filename="${xlsxName(table.subject, today)}"`);
    ctx.body = await tableXlsx(table, CATALOG[table.subject].label);
  },

  async views(ctx: AdminCtx) {
    respond(ctx, { ok: true, data: await listViews(views(), await caller(ctx)) });
  },

  async createView(ctx: AdminCtx) {
    respondAction(ctx, await createView(views(), await caller(ctx), ctx.request.body));
  },

  async updateView(ctx: AdminCtx) {
    respondAction(ctx, await updateView(views(), await caller(ctx), param(ctx, 'documentId'), ctx.request.body));
  },

  async deleteView(ctx: AdminCtx) {
    respondAction(ctx, await deleteView(views(), await caller(ctx), param(ctx, 'documentId')));
  },
};
