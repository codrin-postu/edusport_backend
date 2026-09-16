/**
 * The sync engine: how a form's database rows become (and stay) a spreadsheet.
 *
 * The app owns the tabs. Row 1 of every tab is the header; every data row's
 * LAST cell is the documentId, which is how a row is located for an update or a
 * delete. Nothing here ever throws — every entry point returns a result
 * carrying a specific `reason` so the admin can tell "no credentials" from "the
 * append was rejected" from "the service account has no access to that file".
 *
 * TWO LAYOUTS
 * -----------
 * A form is either SINGLE-TAB or PARTITIONED, decided by `partition` on its
 * registry descriptor (`registry.ts`):
 *
 *   single-tab  (voluntari, parteneri, contact)
 *       Every row lives in `link.tab`. Unchanged behaviour.
 *
 *   partitioned (inscrieri)
 *       The tab name is derived from the row itself — the season, e.g.
 *       "2025-2026" — with `fara-sezon` for rows carrying no season. Tabs are
 *       created on demand; `link.tab` is ignored for such a form.
 *
 * Both layouts share one per-operation tab cache (`ctx.tabs`), filled by the
 * single `spreadsheets.get` that `context()` already had to make, so writing a
 * hundred rows across five seasons still costs zero extra metadata reads.
 *
 * MOVING A ROW BETWEEN TABS
 * -------------------------
 * When a submission's season changes, its row must move. The insert into the
 * new tab always happens BEFORE the delete from the old one. A crash between
 * the two therefore leaves a duplicate, which the next `reconcile` removes —
 * strictly better than the opposite order, where the same crash loses the row.
 */
import {
  appendValues,
  batchUpdateSheet,
  batchUpdateValues,
  clearValues,
  colLetter,
  createTab,
  deleteRows,
  getSpreadsheet,
  getValues,
  isConfigured,
  quoteTab,
  updateValues,
} from './client';
import type { Cell } from './client';
import { formatIsCurrent, formatRequests, toCells, toDisplay } from './format';
import type { TabState } from './format';
import type { ColumnType, RowLike } from './matrix';
import type { ColumnPlan } from './matrix';
import type { FormKey, Partition } from './registry';
import { getForm } from './registry';
import type { SheetLink, SyncCounts, SyncTrigger } from './store';
import { getLink, logSync } from './store';

export interface SyncResult extends SyncCounts {
  ok: boolean;
  /** Present when nothing happened or something failed. */
  reason?: string;
  message?: string;
  skipped?: boolean;
  /**
   * Partitioned forms only: tabs that still exist but no longer match any row
   * in the database. They are left in place (an archived season is worth
   * keeping) and only reported.
   */
  staleTabs?: string[];
}

const EMPTY: SyncCounts = { added: 0, updated: 0, removed: 0 };

const skip = (reason: string): SyncResult => ({ ...EMPTY, ok: true, skipped: true, reason });
const failed = (reason: string, message?: string): SyncResult => ({ ...EMPTY, ok: false, reason, message });

/* ------------------------------------------------------------------ context */

interface BaseCtx {
  form: FormKey;
  link: SheetLink;
  spreadsheetId: string;
  header: string[];
  /** What each column HOLDS: drives date typing, widths and the status colours. */
  types: ColumnType[];
  idIndex: number;
  lastCol: string;
  toRow(doc: RowLike): string[];
  /** tab title -> numeric sheetId, for every tab in the spreadsheet. */
  tabs: Map<string, number>;
  /**
   * Formatting state of each tab as it was when this operation started, read
   * from the one `spreadsheets.get` above. Absent for a tab we just created.
   */
  tabState: Map<string, TabState>;
  /** Tabs this operation created; their header is known to be current. */
  fresh: Set<string>;
  /** Tabs this operation has already formatted; never format one twice. */
  formatted: Set<string>;
}

/** Single-tab form: one fixed target tab, resolved and created up front. */
interface SingleCtx extends BaseCtx {
  kind: 'single';
  tab: string;
  sheetId: number;
}

/** Partitioned form: the tab is decided per row, lazily. */
interface MultiCtx extends BaseCtx {
  kind: 'multi';
  partition: Partition;
}

type Ctx = SingleCtx | MultiCtx;

// An explicit discriminant, not a `partition !== null` test: this project
// compiles with `strict: false`, where `null` is assignable to everything and
// a nullability-based type guard therefore narrows to `never`.
const isMulti = (ctx: Ctx): ctx is MultiCtx => ctx.kind === 'multi';

/**
 * Resolve everything an operation needs: the link, the spreadsheet's tab list,
 * and the current column plan. For a single-tab form the target tab is created
 * here if missing; a partitioned form creates tabs lazily, per row. Returns a
 * string reason instead of a context when the form is not syncable right now.
 */
async function context(form: FormKey): Promise<Ctx | SyncResult> {
  if (!isConfigured()) return skip('not_configured');
  const link = await getLink(form);
  if (!link.spreadsheetId) return skip('not_connected');
  if (!link.enabled) return skip('disabled');

  const info = await getSpreadsheet(link.spreadsheetId);
  if (!info.ok) return failed(info.reason ?? 'read_failed', info.message);

  const desc = getForm(form);
  const plan = await desc.resolvePlan();
  const header = plan.header;
  const base: BaseCtx = {
    form,
    link,
    spreadsheetId: link.spreadsheetId,
    header,
    types: plan.types,
    idIndex: header.length - 1,
    lastCol: colLetter(header.length - 1),
    toRow: (doc) => desc.toRow(doc),
    tabs: new Map(info.data!.tabs.map((t) => [t.title, t.sheetId])),
    tabState: new Map(
      info.data!.tabs.map((t) => [
        t.title,
        { sheetId: t.sheetId, frozenRowCount: t.frozenRowCount, conditionalFormats: t.conditionalFormats },
      ]),
    ),
    fresh: new Set<string>(),
    formatted: new Set<string>(),
  };

  const partition = desc.partition;
  if (partition) return { ...base, kind: 'multi', partition };

  const single: SingleCtx = { ...base, kind: 'single', tab: link.tab, sheetId: -1 };
  const sheetId = await ensureTabIn(single, link.tab);
  if (typeof sheetId !== 'number') return sheetId;
  single.sheetId = sheetId;
  return single;
}

/** Narrow a "value or early-exit result" union (the value may be a number). */
const isResult = (v: unknown): v is SyncResult =>
  typeof v === 'object' && v !== null && typeof (v as SyncResult).ok === 'boolean';

const rowRange = (ctx: BaseCtx, tab: string, row: number) =>
  `${quoteTab(tab)}!A${row}:${ctx.lastCol}${row}`;

/* --------------------------------------------------- values vs shown values */

/**
 * A rendered row on its way INTO the sheet. Date columns become real date
 * values (a serial number plus the text they will display); everything else is
 * the untouched string, because the write is RAW.
 */
const cellsOf = (types: ColumnType[], row: string[]): Cell[] => toCells(types, row);

/**
 * The same row as the sheet WILL SHOW IT. `values.get` returns formatted
 * values, so this — not the raw ISO timestamp — is what a diff compares
 * against. Get this wrong and every reconcile would "find" a difference in
 * every date cell and rewrite the whole sheet, forever.
 */
const shownOf = (types: ColumnType[], row: string[]): string[] => toDisplay(types, row);

/* ------------------------------------------------------------- tab styling */

/**
 * Bring one tab's FORMATTING up to date: frozen navy header, per-type column
 * widths, date number formats, status colours.
 *
 * `force` separates the two callers. A tab that was just created, or a tab a
 * full resync just rewrote, is formatted unconditionally — that is the only
 * moment the column set can have changed, and a new column needs its width and
 * possibly a date format. The scheduled reconcile passes `force: false` and
 * formats only when the cheap probe (frozen header + the exact status rules,
 * both already in hand from `context()`) says something is missing, so a
 * healthy sheet costs zero extra API calls.
 *
 * Never fatal: formatting is cosmetic, and losing it must not cost the run its
 * data. A failure is logged and the sync continues.
 */
async function applyFormat(
  ctx: BaseCtx,
  tab: string,
  types: ColumnType[],
  force: boolean,
): Promise<void> {
  if (ctx.formatted.has(tab)) return;
  const sheetId = ctx.tabs.get(tab);
  if (sheetId === undefined) return;

  const state = ctx.tabState.get(tab);
  const statusIndex = types.indexOf('status');
  if (!force && formatIsCurrent(state, ctx.form, statusIndex)) {
    ctx.formatted.add(tab);
    return;
  }

  const requests = formatRequests({ form: ctx.form, sheetId, types, state });
  const res = await batchUpdateSheet(ctx.spreadsheetId, tab, requests);
  ctx.formatted.add(tab);
  if (!res.ok) {
    strapi?.log?.warn?.(`[sheets] ${ctx.form}: formatting "${tab}" failed (${res.reason}): ${res.message ?? ''}`);
    return;
  }
  // Replay the batch onto the cached state, so nothing later in this operation
  // can look at the PRE-batch rule list and delete the wrong indices.
  const dropped = new Set<number>(
    requests.filter((r) => r.deleteConditionalFormatRule).map((r) => r.deleteConditionalFormatRule.index),
  );
  ctx.tabState.set(tab, {
    sheetId,
    frozenRowCount: 1,
    conditionalFormats: [
      ...(state?.conditionalFormats ?? []).filter((_, i) => !dropped.has(i)),
      ...requests.filter((r) => r.addConditionalFormatRule).map((r) => r.addConditionalFormatRule.rule),
    ],
  });
}

/* ---------------------------------------------------------------- tab cache */

/**
 * Return the sheetId of `tab`, creating the tab (and writing its header) if it
 * does not exist. Answers from the per-operation cache, so a burst of rows
 * spread over several seasons never triggers a `spreadsheets.get` per row.
 */
async function ensureTabIn(ctx: BaseCtx, tab: string): Promise<number | SyncResult> {
  const hit = ctx.tabs.get(tab);
  if (hit !== undefined) return hit;

  const created = await createTab(ctx.spreadsheetId, tab);
  if (!created.ok) return failed(created.reason ?? 'tab_failed', created.message);
  const sheetId = created.data!;
  ctx.tabs.set(tab, sheetId);

  const written = await updateValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1`, [ctx.header]);
  if (!written.ok) return failed(written.reason ?? 'update_failed', written.message);
  ctx.fresh.add(tab);
  // A brand-new tab is styled immediately, so a season tab created next August
  // looks exactly like the one created today.
  await applyFormat(ctx, tab, ctx.types, true);
  strapi?.log?.info?.(`[sheets] created tab "${tab}"`);
  return sheetId;
}

/* ------------------------------------------------------------- id lookups */

/**
 * Map documentId -> 1-based sheet row for ONE tab, read from the id column
 * only. Reading a single column keeps the payload tiny even at 5000 rows.
 */
async function readIdMap(ctx: BaseCtx, tab: string): Promise<{ map: Map<string, number> } | SyncResult> {
  const col = colLetter(ctx.idIndex);
  const res = await getValues(ctx.spreadsheetId, `${quoteTab(tab)}!${col}1:${col}`);
  if (!res.ok) return failed(res.reason ?? 'read_failed', res.message);
  const map = new Map<string, number>();
  (res.data ?? []).forEach((cells, i) => {
    const id = (cells?.[0] ?? '').trim();
    // Row 1 holds the header label ("ID"), never a documentId.
    if (id && i > 0) map.set(id, i + 1);
  });
  return { map };
}

/** One place a documentId was found. */
interface Located {
  tab: string;
  row: number;
}

interface IdScan {
  /** Every place each id occurs. More than one means a half-finished move. */
  located: Map<string, Located[]>;
  /** Tabs that carry our header in the id column — the ones we may write to. */
  dataTabs: string[];
}

/**
 * Scan the id column of EVERY tab in the spreadsheet, so a row can be found
 * wherever it currently sits. A tab counts as ours only when row 1 of the id
 * column holds the plan's last header label; anything else (a stray `Sheet1`,
 * a chart tab, a user's own notes) is read but never written to or cleared.
 */
async function scanIds(ctx: MultiCtx): Promise<IdScan | SyncResult> {
  const col = colLetter(ctx.idIndex);
  const idLabel = ctx.header[ctx.idIndex];
  const located = new Map<string, Located[]>();
  const dataTabs: string[] = [];

  for (const tab of [...ctx.tabs.keys()]) {
    const res = await getValues(ctx.spreadsheetId, `${quoteTab(tab)}!${col}1:${col}`);
    if (!res.ok) return failed(res.reason ?? 'read_failed', res.message);
    const cells = res.data ?? [];
    if ((cells[0]?.[0] ?? '').trim() !== idLabel) continue;
    dataTabs.push(tab);
    cells.forEach((line, i) => {
      if (i === 0) return;
      const id = (line?.[0] ?? '').trim();
      if (!id) return;
      const at = located.get(id);
      if (at) at.push({ tab, row: i + 1 });
      else located.set(id, [{ tab, row: i + 1 }]);
    });
  }
  return { located, dataTabs };
}

/* ----------------------------------------------------------- ensureHeader */

/**
 * Make sure row 1 matches the current column plan. A missing header is written
 * in place; a STALE header (a custom question was added or removed) triggers a
 * full rewrite, because otherwise every existing row would silently misalign.
 *
 * For a partitioned form this checks every tab we own — a mismatch anywhere is
 * repaired by rewriting all of them.
 */
export async function ensureHeader(form: FormKey): Promise<SyncResult> {
  const ctx = await context(form);
  if (isResult(ctx)) return ctx;
  if (!isMulti(ctx)) {
    const res = await ensureHeaderIn(form, ctx, ctx.tab);
    if (res.ok) await applyFormat(ctx, ctx.tab, ctx.types, false);
    return res;
  }

  const scan = await scanIds(ctx);
  if (isResult(scan)) return scan;
  for (const tab of scan.dataTabs) {
    const res = await ensureHeaderIn(form, ctx, tab);
    if (!res.ok) return res;
    // A rewrite already fixed every tab.
    if (res.added || res.updated || res.removed) return res;
    await applyFormat(ctx, tab, ctx.types, false);
  }
  return { ...EMPTY, ok: true };
}

/** Verify (or write) row 1 of one specific tab. */
async function ensureHeaderIn(form: FormKey, ctx: BaseCtx, tab: string): Promise<SyncResult> {
  // A tab this operation just created was given the current header already.
  if (ctx.fresh.has(tab)) return { ...EMPTY, ok: true };

  const res = await getValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1:${ctx.lastCol}1`);
  if (!res.ok) return failed(res.reason ?? 'read_failed', res.message);
  const current = res.data?.[0] ?? [];

  if (current.length === 0) {
    const w = await updateValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1`, [ctx.header]);
    if (!w.ok) return failed(w.reason ?? 'update_failed', w.message);
    return { ...EMPTY, ok: true };
  }

  const same =
    current.length === ctx.header.length && ctx.header.every((h, i) => (current[i] ?? '').trim() === h);
  if (same) return { ...EMPTY, ok: true };

  // Column set changed: rewrite everything so no row can misalign.
  strapi.log.info(`[sheets] ${form}: header changed in "${tab}", rewriting`);
  return resyncForm(form, 'manual', { log: false });
}

/* -------------------------------------------------------------- upsertRow */

/** Write one document: update its existing row, or append it if it is new. */
export async function upsertRow(form: FormKey, doc: RowLike): Promise<SyncResult> {
  const ctx = await context(form);
  if (isResult(ctx)) return ctx;
  const documentId = String(doc?.documentId ?? '').trim();
  if (!documentId) return failed('missing_document_id');
  return isMulti(ctx)
    ? upsertMulti(form, ctx, doc, documentId)
    : upsertSingle(form, ctx, doc, documentId);
}

async function upsertSingle(
  form: FormKey,
  ctx: SingleCtx,
  doc: RowLike,
  documentId: string,
): Promise<SyncResult> {
  const headerRes = await ensureHeaderIn(form, ctx, ctx.tab);
  if (!headerRes.ok) return headerRes;
  // A header rewrite already wrote every row, this one included.
  if (headerRes.added || headerRes.updated || headerRes.removed) return headerRes;

  const ids = await readIdMap(ctx, ctx.tab);
  if (isResult(ids)) return ids;

  const row = cellsOf(ctx.types, ctx.toRow(doc));
  const existing = ids.map.get(documentId);
  if (existing) {
    const res = await updateValues(ctx.spreadsheetId, rowRange(ctx, ctx.tab, existing), [row]);
    if (!res.ok) return failed(res.reason ?? 'update_failed', res.message);
    return { ...EMPTY, ok: true, updated: 1 };
  }
  const res = await appendValues(ctx.spreadsheetId, `${quoteTab(ctx.tab)}!A1`, [row]);
  if (!res.ok) return failed(res.reason ?? 'append_failed', res.message);
  return { ...EMPTY, ok: true, added: 1 };
}

/**
 * Partitioned upsert. The row's target tab comes from the row itself, so this
 * has one case the single-tab path does not: the document may already sit in a
 * DIFFERENT tab because its season changed. That is handled as insert-then-
 * delete, never the reverse.
 */
async function upsertMulti(
  form: FormKey,
  ctx: MultiCtx,
  doc: RowLike,
  documentId: string,
): Promise<SyncResult> {
  const target = ctx.partition.tabFor(doc);
  const sheetId = await ensureTabIn(ctx, target);
  if (typeof sheetId !== 'number') return sheetId;

  const headerRes = await ensureHeaderIn(form, ctx, target);
  if (!headerRes.ok) return headerRes;
  if (headerRes.added || headerRes.updated || headerRes.removed) return headerRes;

  const scan = await scanIds(ctx);
  if (isResult(scan)) return scan;

  const row = cellsOf(ctx.types, ctx.toRow(doc));
  const places = scan.located.get(documentId) ?? [];
  const here = places.find((p) => p.tab === target);
  const elsewhere = places.filter((p) => p.tab !== target);

  let added = 0;
  let updated = 0;

  if (here) {
    const res = await updateValues(ctx.spreadsheetId, rowRange(ctx, target, here.row), [row]);
    if (!res.ok) return failed(res.reason ?? 'update_failed', res.message);
    updated = 1;
  } else {
    // INSERT FIRST. If the process dies now, the row exists twice and the next
    // reconcile drops the stale copy; the row itself is never lost.
    const res = await appendValues(ctx.spreadsheetId, `${quoteTab(target)}!A1`, [row]);
    if (!res.ok) return failed(res.reason ?? 'append_failed', res.message);
    added = 1;
  }

  const removed = await dropRows(ctx, elsewhere);
  if (isResult(removed)) return removed;
  if (removed) {
    strapi?.log?.info?.(
      `[sheets] ${form}: moved ${documentId} to "${target}" (removed ${removed} stale row(s))`,
    );
  }
  return { ...EMPTY, ok: true, added, updated, removed };
}

/** Delete a set of located rows, grouped per tab (one API call per tab). */
async function dropRows(ctx: BaseCtx, places: Located[]): Promise<number | SyncResult> {
  if (!places.length) return 0;
  const byTab = new Map<string, number[]>();
  for (const p of places) {
    const list = byTab.get(p.tab);
    if (list) list.push(p.row - 1);
    else byTab.set(p.tab, [p.row - 1]);
  }
  let removed = 0;
  for (const [tab, indices] of byTab) {
    const sheetId = ctx.tabs.get(tab);
    if (sheetId === undefined) continue;
    const res = await deleteRows(ctx.spreadsheetId, tab, sheetId, indices);
    if (!res.ok) return failed(res.reason ?? 'delete_failed', res.message);
    removed += res.data?.removed ?? indices.length;
  }
  return removed;
}

/* -------------------------------------------------------------- deleteRow */

/** Remove the row carrying `documentId`, wherever the spreadsheet holds it. */
export async function deleteRow(form: FormKey, documentId: string): Promise<SyncResult> {
  const ctx = await context(form);
  if (isResult(ctx)) return ctx;
  const id = String(documentId ?? '').trim();
  if (!id) return failed('missing_document_id');

  if (!isMulti(ctx)) {
    const ids = await readIdMap(ctx, ctx.tab);
    if (isResult(ids)) return ids;
    const row = ids.map.get(id);
    if (!row) return { ...EMPTY, ok: true };
    const res = await deleteRows(ctx.spreadsheetId, ctx.tab, ctx.sheetId, [row - 1]);
    if (!res.ok) return failed(res.reason ?? 'delete_failed', res.message);
    return { ...EMPTY, ok: true, removed: 1 };
  }

  const scan = await scanIds(ctx);
  if (isResult(scan)) return scan;
  const removed = await dropRows(ctx, scan.located.get(id) ?? []);
  if (isResult(removed)) return removed;
  return { ...EMPTY, ok: true, removed };
}

/* ------------------------------------------------------------- resyncForm */

/**
 * Full rewrite: clear, write the header, write every row.
 *
 * Single-tab: one tab cleared and rewritten.
 * Partitioned: the rows are grouped by their tab, a tab is ensured per group,
 * and each group's tab is cleared and rewritten. Tabs we own that no longer
 * match any row are LEFT ALONE — an archived season is data the user may still
 * want — and merely reported as `staleTabs`.
 */
export async function resyncForm(
  form: FormKey,
  trigger: SyncTrigger = 'manual',
  opts: { log?: boolean } = {},
): Promise<SyncResult> {
  const shouldLog = opts.log !== false;
  const ctx = await context(form);
  if (isResult(ctx)) {
    if (shouldLog && !ctx.ok) await logSync(form, trigger, EMPTY, false, ctx.reason);
    return ctx;
  }

  const desc = getForm(form);
  const rows = await desc.fetchAll();
  // Rebuild the plan over exactly the rows we are about to write, so a custom
  // answer that only exists on old rows still gets a column.
  const plan = await desc.resolvePlan(rows);

  const result = isMulti(ctx)
    ? await resyncMulti(ctx, plan, rows)
    : await resyncSingle(ctx, plan, rows);

  if (shouldLog) {
    const message = result.ok
      ? describeResync(result, rows.length)
      : `${result.reason}: ${result.message ?? ''}`.trim();
    await logSync(form, trigger, result.ok ? result : EMPTY, result.ok, message);
  }
  return result;
}

function describeResync(result: SyncResult, rowCount: number): string {
  const stale = result.staleTabs?.length
    ? `; file păstrate fără rânduri: ${result.staleTabs.join(', ')}`
    : '';
  return `Rescriere completă: ${rowCount} rânduri${stale}`;
}

async function resyncSingle(ctx: SingleCtx, plan: ColumnPlan, rows: RowLike[]): Promise<SyncResult> {
  const values: Cell[][] = [plan.header, ...rows.map((doc) => cellsOf(plan.types, plan.row(doc)))];
  const cleared = await clearValues(ctx.spreadsheetId, ctx.tab);
  if (!cleared.ok) return failed(cleared.reason ?? 'clear_failed', cleared.message);
  const written = await updateValues(ctx.spreadsheetId, `${quoteTab(ctx.tab)}!A1`, values);
  if (!written.ok) return failed(written.reason ?? 'update_failed', written.message);
  // `values.clear` wipes contents, never formatting — but the column set may
  // just have changed, so the widths and date formats are re-derived here.
  await applyFormat(ctx, ctx.tab, plan.types, true);
  return { ok: true, added: rows.length, updated: 0, removed: 0 };
}

async function resyncMulti(ctx: MultiCtx, plan: ColumnPlan, rows: RowLike[]): Promise<SyncResult> {
  // Which tabs do we currently own? Read before anything is cleared, so a tab
  // that ends up empty can still be reported rather than silently forgotten.
  const scan = await scanIds(ctx);
  if (isResult(scan)) return scan;

  const groups = new Map<string, RowLike[]>();
  for (const doc of rows) {
    const tab = ctx.partition.tabFor(doc);
    const list = groups.get(tab);
    if (list) list.push(doc);
    else groups.set(tab, [doc]);
  }

  for (const [tab, docs] of groups) {
    const sheetId = await ensureTabIn(ctx, tab);
    if (typeof sheetId !== 'number') return sheetId;
    const cleared = await clearValues(ctx.spreadsheetId, tab);
    if (!cleared.ok) return failed(cleared.reason ?? 'clear_failed', cleared.message);
    const written = await updateValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1`, [
      plan.header,
      ...docs.map((doc) => cellsOf(plan.types, plan.row(doc))),
    ]);
    if (!written.ok) return failed(written.reason ?? 'update_failed', written.message);
    await applyFormat(ctx, tab, plan.types, true);
  }

  const staleTabs = scan.dataTabs.filter((t) => !groups.has(t)).sort();
  if (staleTabs.length) {
    strapi?.log?.info?.(`[sheets] tabs with no rows left in the database (kept): ${staleTabs.join(', ')}`);
  }
  return { ok: true, added: rows.length, updated: 0, removed: 0, staleTabs };
}

/* --------------------------------------------------------------- reconcile */

/**
 * The scheduled catch-up pass: compare the database against the sheet and
 * repair the difference — append what is missing, update what changed, delete
 * rows whose document no longer exists. A write that failed earlier (a Google
 * outage, a container restart mid-submission) is healed here.
 *
 * For a partitioned form this also repairs LOCATION: a row sitting in the wrong
 * season tab is re-inserted into the right one and then removed from the wrong
 * one, in that order. A duplicate left by a crashed move is cleaned up the same
 * way, because the extra copy is simply a row in the wrong place.
 */
export async function reconcile(form: FormKey, trigger: SyncTrigger = 'scheduled'): Promise<SyncResult> {
  const ctx = await context(form);
  if (isResult(ctx)) return ctx;

  const desc = getForm(form);
  const rows = await desc.fetchAll();
  const plan = await desc.resolvePlan(rows);

  const res = isMulti(ctx)
    ? await reconcileMulti(form, ctx, plan, rows, trigger)
    : await reconcileSingle(form, ctx, plan, rows, trigger);
  return res;
}

/** Row 1 of `tab` compared against the plan header. */
async function headerState(
  ctx: BaseCtx,
  tab: string,
  plan: ColumnPlan,
): Promise<{ matches: boolean } | SyncResult> {
  const res = await getValues(
    ctx.spreadsheetId,
    `${quoteTab(tab)}!A1:${colLetter(plan.header.length - 1)}1`,
  );
  if (!res.ok) return failed(res.reason ?? 'read_failed', res.message);
  const current = res.data?.[0] ?? [];
  return {
    matches:
      current.length === plan.header.length &&
      plan.header.every((h, i) => (current[i] ?? '').trim() === h),
  };
}

async function reconcileSingle(
  form: FormKey,
  ctx: SingleCtx,
  plan: ColumnPlan,
  rows: RowLike[],
  trigger: SyncTrigger,
): Promise<SyncResult> {
  // A changed column set makes a cell-by-cell diff meaningless: rewrite.
  const head = await headerState(ctx, ctx.tab, plan);
  if (isResult(head)) return head;
  if (!head.matches) {
    const res = await resyncForm(form, trigger, { log: false });
    await logSync(form, trigger, res, res.ok, res.ok ? 'Antet diferit: rescriere completă' : res.reason);
    return res;
  }

  // Repair the tab's styling only if the cheap probe says it is missing — on a
  // healthy sheet this is free, since the state came from the `spreadsheets.get`
  // `context()` already made.
  await applyFormat(ctx, ctx.tab, plan.types, false);

  const idIndex = plan.header.length - 1;
  const lastCol = colLetter(idIndex);
  const all = await getValues(ctx.spreadsheetId, `${quoteTab(ctx.tab)}!A1:${lastCol}`);
  if (!all.ok) return failed(all.reason ?? 'read_failed', all.message);

  const byId = new Map<string, { row: number; cells: string[] }>();
  (all.data ?? []).forEach((cells, i) => {
    if (i === 0) return; // header
    const id = (cells?.[idIndex] ?? '').trim();
    if (id) byId.set(id, { row: i + 1, cells });
  });

  const dbIds = new Set<string>();
  const toAppend: Cell[][] = [];
  const toUpdate: { range: string; values: Cell[][] }[] = [];

  for (const doc of rows) {
    const id = String(doc?.documentId ?? '').trim();
    if (!id) continue;
    dbIds.add(id);
    const want = plan.row(doc);
    const found = byId.get(id);
    if (!found) {
      toAppend.push(cellsOf(plan.types, want));
      continue;
    }
    // Compare against what the sheet SHOWS: a date cell reads back as
    // "13.09.2026 15:30", never as the ISO string the database holds.
    const shown = shownOf(plan.types, want);
    if (!shown.every((cell, i) => (found.cells[i] ?? '') === cell)) {
      toUpdate.push({
        range: `${quoteTab(ctx.tab)}!A${found.row}:${lastCol}${found.row}`,
        values: [cellsOf(plan.types, want)],
      });
    }
  }

  const orphanRows: number[] = [];
  for (const [id, found] of byId) if (!dbIds.has(id)) orphanRows.push(found.row - 1);

  let ok = true;
  const problems: string[] = [];

  if (toUpdate.length) {
    const res = await batchUpdateValues(ctx.spreadsheetId, toUpdate);
    if (!res.ok) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
    }
  }
  if (toAppend.length) {
    const res = await appendValues(ctx.spreadsheetId, `${quoteTab(ctx.tab)}!A1`, toAppend);
    if (!res.ok) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
    }
  }
  if (orphanRows.length) {
    const res = await deleteRows(ctx.spreadsheetId, ctx.tab, ctx.sheetId, orphanRows);
    if (!res.ok) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
    }
  }

  const counts: SyncCounts = {
    added: toAppend.length,
    updated: toUpdate.length,
    removed: orphanRows.length,
  };
  const message = ok ? `Verificare: +${counts.added} ~${counts.updated} -${counts.removed}` : problems.join('; ');
  await logSync(form, trigger, counts, ok, message);
  return { ...counts, ok, reason: ok ? undefined : 'reconcile_failed', message };
}

async function reconcileMulti(
  form: FormKey,
  ctx: MultiCtx,
  plan: ColumnPlan,
  rows: RowLike[],
  trigger: SyncTrigger,
): Promise<SyncResult> {
  const idIndex = plan.header.length - 1;
  const lastCol = colLetter(idIndex);
  const idLabel = plan.header[idIndex];

  // Read every tab in full, once. Tabs that are not ours are skipped outright.
  const dataTabs: string[] = [];
  const located = new Map<string, Located[]>();
  const cellsAt = new Map<string, string[]>(); // `${tab}#${row}` -> cells

  for (const tab of [...ctx.tabs.keys()]) {
    const res = await getValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1:${lastCol}`);
    if (!res.ok) return failed(res.reason ?? 'read_failed', res.message);
    const grid = res.data ?? [];
    const head = grid[0] ?? [];
    // Not one of ours: leave it completely alone.
    if ((head[idIndex] ?? '').trim() !== idLabel) continue;

    // A changed column set makes a cell-by-cell diff meaningless: rewrite all.
    const headerMatches =
      head.length === plan.header.length && plan.header.every((h, i) => (head[i] ?? '').trim() === h);
    if (!headerMatches) {
      const res2 = await resyncForm(form, trigger, { log: false });
      await logSync(form, trigger, res2, res2.ok, res2.ok ? 'Antet diferit: rescriere completă' : res2.reason);
      return res2;
    }

    dataTabs.push(tab);
    await applyFormat(ctx, tab, plan.types, false);
    grid.forEach((cells, i) => {
      if (i === 0) return;
      const id = (cells?.[idIndex] ?? '').trim();
      if (!id) return;
      const place: Located = { tab, row: i + 1 };
      const list = located.get(id);
      if (list) list.push(place);
      else located.set(id, [place]);
      cellsAt.set(`${tab}#${i + 1}`, cells);
    });
  }

  // What the database says: id -> { tab it belongs in, the row to write, and
  // the text that row will SHOW once written — the diffable form }.
  const want = new Map<string, { tab: string; cells: Cell[]; shown: string[] }>();
  for (const doc of rows) {
    const id = String(doc?.documentId ?? '').trim();
    if (!id) continue;
    const rendered = plan.row(doc);
    want.set(id, {
      tab: ctx.partition.tabFor(doc),
      cells: cellsOf(plan.types, rendered),
      shown: shownOf(plan.types, rendered),
    });
  }

  const appendsByTab = new Map<string, Cell[][]>();
  const toUpdate: { range: string; values: Cell[][] }[] = [];
  const toDelete: Located[] = [];
  /** Rows found in a tab their season does not match. */
  let misplaced = 0;

  for (const [id, target] of want) {
    const places = located.get(id) ?? [];
    const here = places.find((p) => p.tab === target.tab);
    if (here) {
      const current = cellsAt.get(`${here.tab}#${here.row}`) ?? [];
      if (!target.shown.every((cell, i) => (current[i] ?? '') === cell)) {
        toUpdate.push({ range: rowRange(ctx, here.tab, here.row), values: [target.cells] });
      }
    } else {
      const list = appendsByTab.get(target.tab);
      if (list) list.push(target.cells);
      else appendsByTab.set(target.tab, [target.cells]);
    }
    // Every copy outside the target tab is wrong — a moved season, or the
    // leftover half of a move that crashed. Removed AFTER the insert below.
    for (const p of places) {
      if (p.tab !== target.tab) {
        toDelete.push(p);
        misplaced += 1;
      }
    }
  }

  // Rows in the sheet whose document no longer exists at all.
  for (const [id, places] of located) {
    if (want.has(id)) continue;
    toDelete.push(...places);
  }
  // A duplicate inside the SAME tab: keep the first, drop the rest.
  for (const [id, places] of located) {
    const target = want.get(id);
    if (!target) continue;
    const same = places.filter((p) => p.tab === target.tab);
    for (const dup of same.slice(1)) toDelete.push(dup);
  }

  let ok = true;
  const problems: string[] = [];
  let added = 0;

  if (toUpdate.length) {
    const res = await batchUpdateValues(ctx.spreadsheetId, toUpdate);
    if (!res.ok) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
    }
  }

  // INSERTS BEFORE DELETES: a failure here must never leave a row nowhere.
  for (const [tab, values] of appendsByTab) {
    const sheetId = await ensureTabIn(ctx, tab);
    if (typeof sheetId !== 'number') {
      ok = false;
      problems.push(`${sheetId.reason}: ${sheetId.message ?? ''}`.trim());
      continue;
    }
    const res = await appendValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1`, values);
    if (!res.ok) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
      continue;
    }
    added += values.length;
  }

  let removed = 0;
  // Only delete once every insert succeeded; otherwise a row could vanish.
  if (ok && toDelete.length) {
    const res = await dropRows(ctx, toDelete);
    if (isResult(res)) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
    } else {
      removed = res;
    }
  } else if (!ok && toDelete.length) {
    problems.push('ștergerile au fost amânate: o inserare a eșuat');
  }

  const wantedTabs = new Set([...want.values()].map((w) => w.tab));
  const staleTabs = dataTabs.filter((t) => !wantedTabs.has(t)).sort();
  const counts: SyncCounts = { added, updated: toUpdate.length, removed };
  const message = ok
    ? `Verificare: +${counts.added} ~${counts.updated} -${counts.removed}` +
      (misplaced > 0 ? ` (${misplaced} mutate între file)` : '') +
      (staleTabs.length ? `; file păstrate fără rânduri: ${staleTabs.join(', ')}` : '')
    : problems.join('; ');
  await logSync(form, trigger, counts, ok, message);
  return { ...counts, ok, reason: ok ? undefined : 'reconcile_failed', message, staleTabs };
}

/* ------------------------------------------------------------ batch writes */

/**
 * Apply a queued burst in as few API calls as possible: one id scan, one
 * `values.batchUpdate` for every changed row, one `values.append` per target
 * tab, one `batchUpdate`/deleteDimension per tab for the removals. A hundred
 * row updates from a bulk admin action therefore cost a handful of requests,
 * not a hundred — Google allows roughly 60 writes per minute per user.
 */
export async function applyBatch(
  form: FormKey,
  upsertIds: string[],
  deleteIds: string[],
): Promise<SyncResult> {
  const ctx = await context(form);
  if (isResult(ctx)) return ctx;

  const desc = getForm(form);
  const docs: RowLike[] = upsertIds.length
    ? ((await strapi.documents(desc.uid as any).findMany({
        filters: { documentId: { $in: upsertIds } } as any,
        limit: upsertIds.length,
      })) as unknown as RowLike[])
    : [];

  return isMulti(ctx)
    ? batchMulti(form, ctx, docs, deleteIds)
    : batchSingle(form, ctx, docs, deleteIds);
}

async function batchSingle(
  form: FormKey,
  ctx: SingleCtx,
  docs: RowLike[],
  deleteIds: string[],
): Promise<SyncResult> {
  const headerRes = await ensureHeaderIn(form, ctx, ctx.tab);
  if (!headerRes.ok) return headerRes;
  // A header rewrite already rewrote everything; the queued work is subsumed.
  if (headerRes.added || headerRes.updated || headerRes.removed) return headerRes;

  const ids = await readIdMap(ctx, ctx.tab);
  if (isResult(ids)) return ids;

  const toUpdate: { range: string; values: Cell[][] }[] = [];
  const toAppend: Cell[][] = [];
  for (const doc of docs) {
    const id = String(doc?.documentId ?? '').trim();
    if (!id) continue;
    const row = cellsOf(ctx.types, ctx.toRow(doc));
    const at = ids.map.get(id);
    if (at) toUpdate.push({ range: rowRange(ctx, ctx.tab, at), values: [row] });
    else toAppend.push(row);
  }

  const deleteRowIdx = deleteIds
    .map((id) => ids.map.get(String(id).trim()))
    .filter((r): r is number => typeof r === 'number')
    .map((r) => r - 1);

  let ok = true;
  const problems: string[] = [];

  if (toUpdate.length) {
    const res = await batchUpdateValues(ctx.spreadsheetId, toUpdate);
    if (!res.ok) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
    }
  }
  if (toAppend.length) {
    const res = await appendValues(ctx.spreadsheetId, `${quoteTab(ctx.tab)}!A1`, toAppend);
    if (!res.ok) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
    }
  }
  if (deleteRowIdx.length) {
    const res = await deleteRows(ctx.spreadsheetId, ctx.tab, ctx.sheetId, deleteRowIdx);
    if (!res.ok) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
    }
  }

  return {
    ok,
    added: toAppend.length,
    updated: toUpdate.length,
    removed: deleteRowIdx.length,
    reason: ok ? undefined : 'batch_failed',
    message: ok ? undefined : problems.join('; '),
  };
}

/**
 * Partitioned batch. Same shape as the single-tab one, plus the move case:
 * every queued document is appended to (or updated in) the tab its season says
 * it belongs in, and only then are its copies in other tabs removed.
 */
async function batchMulti(
  form: FormKey,
  ctx: MultiCtx,
  docs: RowLike[],
  deleteIds: string[],
): Promise<SyncResult> {
  // Create every target tab first, so the scan below already sees them.
  const targets = new Map<string, string>(); // documentId -> tab
  for (const doc of docs) {
    const id = String(doc?.documentId ?? '').trim();
    if (!id) continue;
    const tab = ctx.partition.tabFor(doc);
    targets.set(id, tab);
    const sheetId = await ensureTabIn(ctx, tab);
    if (typeof sheetId !== 'number') return sheetId;
    const headerRes = await ensureHeaderIn(form, ctx, tab);
    if (!headerRes.ok) return headerRes;
    if (headerRes.added || headerRes.updated || headerRes.removed) return headerRes;
  }

  const scan = await scanIds(ctx);
  if (isResult(scan)) return scan;

  const toUpdate: { range: string; values: Cell[][] }[] = [];
  const appendsByTab = new Map<string, Cell[][]>();
  const toDelete: Located[] = [];

  for (const doc of docs) {
    const id = String(doc?.documentId ?? '').trim();
    if (!id) continue;
    const tab = targets.get(id)!;
    const row = cellsOf(ctx.types, ctx.toRow(doc));
    const places = scan.located.get(id) ?? [];
    const here = places.find((p) => p.tab === tab);
    if (here) {
      toUpdate.push({ range: rowRange(ctx, tab, here.row), values: [row] });
    } else {
      const list = appendsByTab.get(tab);
      if (list) list.push(row);
      else appendsByTab.set(tab, [row]);
    }
    for (const p of places) if (p.tab !== tab) toDelete.push(p);
  }

  for (const raw of deleteIds) {
    const id = String(raw ?? '').trim();
    if (!id) continue;
    toDelete.push(...(scan.located.get(id) ?? []));
  }

  let ok = true;
  const problems: string[] = [];
  let added = 0;

  if (toUpdate.length) {
    const res = await batchUpdateValues(ctx.spreadsheetId, toUpdate);
    if (!res.ok) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
    }
  }
  // INSERTS BEFORE DELETES.
  for (const [tab, values] of appendsByTab) {
    const res = await appendValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1`, values);
    if (!res.ok) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
      continue;
    }
    added += values.length;
  }

  let removed = 0;
  if (ok && toDelete.length) {
    const res = await dropRows(ctx, toDelete);
    if (isResult(res)) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
    } else {
      removed = res;
    }
  } else if (!ok && toDelete.length) {
    problems.push('ștergerile au fost amânate: o inserare a eșuat');
  }

  return {
    ok,
    added,
    updated: toUpdate.length,
    removed,
    reason: ok ? undefined : 'batch_failed',
    message: ok ? undefined : problems.join('; '),
  };
}
