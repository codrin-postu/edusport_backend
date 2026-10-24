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
 *
 * COLUMNS PER TAB
 * ---------------
 * A partitioned form's tabs need not share columns: `ctx.plans.forTab(tab)`
 * gives each tab its own plan (Înscrieri: a season tab filled by the new
 * registration form has the script-form columns, older tabs keep theirs; see
 * `matrix.ts` `inscrieriTabPlans`). Every row is rendered with the plan of the
 * tab it is written to, and every header check compares a tab with its own
 * plan. A tab's ID column is looked for at the end of its own plan first (one
 * read in the steady state), then found from its header row, so a tab still
 * laid out for other columns is recognised as ours: rewritten, and its rows
 * moved or removed, never mistaken for a stranger's.
 *
 * LINK CELLS
 * ----------
 * A `link` column (Înscrieri "Document") is written as its text through the
 * values API, then turned into a rich-text link by an `updateCells` request.
 * Every write of such rows queues those requests (`queueLinks`); one
 * `spreadsheets.batchUpdate` per operation sends them all (`sendLinks`), after
 * the inserts and before any delete, while the row numbers still hold. A
 * reconcile compares the shown text only, so a changed address (a new
 * `CMS_PUBLIC_URL`) is applied by a full rewrite ("Sincronizează acum").
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
import type { Cell, TabInfo } from './client';
import { formatIsCurrent, formatRequests, linkRequests, toCells, toDisplay } from './format';
import type { LinkRequest, TabState } from './format';
import { ID_LABEL } from './matrix';
import type { ColumnPlan, ColumnType, RowLike, TabPlans } from './matrix';
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
  /** Link requests for rows written by this operation, not sent yet. */
  links: LinkRequest[];
}

/** Single-tab form: one fixed target tab and one column plan, resolved up front. */
interface SingleCtx extends BaseCtx {
  kind: 'single';
  tab: string;
  sheetId: number;
  plan: ColumnPlan;
}

/** Partitioned form: the tab is decided per row, lazily, and so are its columns. */
interface MultiCtx extends BaseCtx {
  kind: 'multi';
  partition: Partition;
  plans: TabPlans;
}

type Ctx = SingleCtx | MultiCtx;

// An explicit discriminant, not a `partition !== null` test: this project
// compiles with `strict: false`, where `null` is assignable to everything and
// a nullability-based type guard therefore narrows to `never`.
const isMulti = (ctx: Ctx): ctx is MultiCtx => ctx.kind === 'multi';

/** The columns of `tab`: the form's one plan, or the tab's own on a partitioned form. */
const planOf = (ctx: Ctx, tab: string): ColumnPlan => (isMulti(ctx) ? ctx.plans.forTab(tab) : ctx.plan);

/** A1 letter of a plan's last (ID) column. */
const lastColOf = (plan: ColumnPlan): string => colLetter(plan.header.length - 1);

/**
 * Resolve everything an operation needs: the link, the spreadsheet's tab list,
 * and the current column plan(s). For a single-tab form the target tab is
 * created here if missing; a partitioned form creates tabs lazily, per row.
 * Returns a result instead of a context when the form is not syncable now.
 */
async function context(form: FormKey): Promise<Ctx | SyncResult> {
  if (!isConfigured()) return skip('not_configured');
  const link = await getLink(form);
  if (!link.spreadsheetId) return skip('not_connected');
  if (!link.enabled) return skip('disabled');

  const info = await getSpreadsheet(link.spreadsheetId);
  if (!info.ok) return failed(info.reason ?? 'read_failed', info.message);

  const base = baseContext(form, link, info.data!.tabs);
  const desc = getForm(form);
  const partition = desc.partition;
  if (partition) return { ...base, kind: 'multi', partition, plans: await desc.resolveTabPlans() };
  return singleContext(base, await desc.resolvePlan());
}

function baseContext(form: FormKey, link: SheetLink, tabs: TabInfo[]): BaseCtx {
  return {
    form,
    link,
    spreadsheetId: link.spreadsheetId,
    tabs: new Map(tabs.map((t) => [t.title, t.sheetId])),
    tabState: new Map(
      tabs.map((t) => [
        t.title,
        { sheetId: t.sheetId, frozenRowCount: t.frozenRowCount, conditionalFormats: t.conditionalFormats },
      ]),
    ),
    fresh: new Set<string>(),
    formatted: new Set<string>(),
    links: [],
  };
}

/** A single-tab form's target tab is created here, before any row is written. */
async function singleContext(base: BaseCtx, plan: ColumnPlan): Promise<SingleCtx | SyncResult> {
  const single: SingleCtx = { ...base, kind: 'single', tab: base.link.tab, sheetId: -1, plan };
  const sheetId = await ensureTabIn(single, single.tab);
  if (typeof sheetId !== 'number') return sheetId;
  single.sheetId = sheetId;
  return single;
}

/**
 * A partitioned form picks each tab's columns from the rows in it, so a write
 * plans over the rows as they are now, not over a snapshot up to 15 s old that
 * may predate the very row being written (the first new-form row of a season).
 */
function freshPlans(form: FormKey): void {
  const desc = getForm(form);
  if (desc.partition) desc.invalidate();
}

/** Narrow a "value or early-exit result" union (the value may be a number). */
const isResult = (v: unknown): v is SyncResult =>
  typeof v === 'object' && v !== null && typeof (v as SyncResult).ok === 'boolean';

const rowRange = (ctx: Ctx, tab: string, row: number) =>
  `${quoteTab(tab)}!A${row}:${lastColOf(planOf(ctx, tab))}${row}`;

/** A row as read back, without the empty cells at its end. */
function withoutTrailingBlanks(row: string[]): string[] {
  const cells = [...row];
  while (cells.length && !(cells[cells.length - 1] ?? '').trim()) cells.pop();
  return cells;
}

/** Row 1 as read back equals `header`. */
function sameHeader(current: string[], header: string[]): boolean {
  const cells = withoutTrailingBlanks(current);
  return cells.length === header.length && header.every((h, i) => (cells[i] ?? '').trim() === h);
}

/** Index of the ID column in a header row as read back, or -1 when the tab is not ours. */
function idIndexIn(head: string[]): number {
  const cells = withoutTrailingBlanks(head);
  return cells.length > 0 && cells[cells.length - 1].trim() === ID_LABEL ? cells.length - 1 : -1;
}

/** Row 1 in full, whatever its width. */
async function readHeaderRow(ctx: BaseCtx, tab: string): Promise<string[] | SyncResult> {
  const res = await getValues(ctx.spreadsheetId, `${quoteTab(tab)}!1:1`);
  if (!res.ok) return failed(res.reason ?? 'read_failed', res.message);
  return res.data?.[0] ?? [];
}

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

/** Queue the links of rows just written to `tab` from 1-based sheet row `firstRow` (unknown: none). */
function queueLinks(ctx: BaseCtx, tab: string, firstRow: number | null, rows: Cell[][]): void {
  const sheetId = ctx.tabs.get(tab);
  if (sheetId === undefined || !firstRow) return;
  ctx.links.push(...linkRequests(sheetId, firstRow - 1, rows));
}

/**
 * Send every queued link in one `spreadsheets.batchUpdate`. Never fatal: the
 * rows are written; a failure is logged and the next full rewrite sets the
 * links again.
 */
async function sendLinks(ctx: BaseCtx): Promise<void> {
  if (!ctx.links.length) return;
  const requests = ctx.links.splice(0);
  const res = await batchUpdateSheet(ctx.spreadsheetId, '(links)', requests);
  if (!res.ok) strapi?.log?.warn?.(`[sheets] ${ctx.form}: links not set (${res.reason}): ${res.message ?? ''}`);
}

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
async function ensureTabIn(ctx: Ctx, tab: string): Promise<number | SyncResult> {
  const hit = ctx.tabs.get(tab);
  if (hit !== undefined) return hit;

  const created = await createTab(ctx.spreadsheetId, tab);
  if (!created.ok) return failed(created.reason ?? 'tab_failed', created.message);
  const sheetId = created.data!;
  ctx.tabs.set(tab, sheetId);

  const plan = planOf(ctx, tab);
  const written = await updateValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1`, [plan.header]);
  if (!written.ok) return failed(written.reason ?? 'update_failed', written.message);
  ctx.fresh.add(tab);
  // A brand-new tab is styled immediately, so a season tab created next August
  // looks exactly like the one created today.
  await applyFormat(ctx, tab, plan.types, true);
  strapi?.log?.info?.(`[sheets] created tab "${tab}"`);
  return sheetId;
}

/* ------------------------------------------------------------- id lookups */

/**
 * Map documentId -> 1-based sheet row for ONE tab, read from the id column
 * only. Reading a single column keeps the payload tiny even at 5000 rows.
 */
async function readIdMap(ctx: SingleCtx, tab: string): Promise<{ map: Map<string, number> } | SyncResult> {
  const col = lastColOf(ctx.plan);
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
 * wherever it currently sits. A tab counts as ours only when the last cell of
 * row 1 is the `ID` label (`readTabIds`); anything else (a stray `Sheet1`, a
 * chart tab, a user's own notes) is never written to or cleared.
 */
async function scanIds(ctx: MultiCtx): Promise<IdScan | SyncResult> {
  const located = new Map<string, Located[]>();
  const dataTabs: string[] = [];
  for (const tab of [...ctx.tabs.keys()]) {
    const cells = await readTabIds(ctx, tab);
    if (isResult(cells)) return cells;
    if (!cells) continue;
    dataTabs.push(tab);
    cells.forEach((line, i) => {
      const id = (line?.[0] ?? '').trim();
      if (i > 0 && id) addPlace(located, id, { tab, row: i + 1 });
    });
  }
  return { located, dataTabs };
}

async function readColumn(ctx: BaseCtx, tab: string, index: number): Promise<string[][] | SyncResult> {
  const col = colLetter(index);
  const res = await getValues(ctx.spreadsheetId, `${quoteTab(tab)}!${col}1:${col}`);
  if (!res.ok) return failed(res.reason ?? 'read_failed', res.message);
  return res.data ?? [];
}

/**
 * The ID column of `tab`, header cell included; null when the tab is not ours.
 * The tab's own plan says where it should be (one read in the steady state); a
 * tab still laid out for other columns is found from its header row.
 */
async function readTabIds(ctx: MultiCtx, tab: string): Promise<string[][] | null | SyncResult> {
  const expected = await readColumn(ctx, tab, planOf(ctx, tab).header.length - 1);
  if (isResult(expected) || (expected[0]?.[0] ?? '').trim() === ID_LABEL) return expected;
  const head = await readHeaderRow(ctx, tab);
  if (isResult(head)) return head;
  const index = idIndexIn(head);
  return index < 0 ? null : readColumn(ctx, tab, index);
}

function addPlace(located: Map<string, Located[]>, id: string, place: Located): void {
  const list = located.get(id);
  if (list) list.push(place);
  else located.set(id, [place]);
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
    if (res.ok) await applyFormat(ctx, ctx.tab, ctx.plan.types, false);
    return res;
  }

  const scan = await scanIds(ctx);
  if (isResult(scan)) return scan;
  for (const tab of scan.dataTabs) {
    const res = await ensureHeaderIn(form, ctx, tab);
    if (!res.ok) return res;
    // A rewrite already fixed every tab.
    if (res.added || res.updated || res.removed) return res;
    await applyFormat(ctx, tab, planOf(ctx, tab).types, false);
  }
  return { ...EMPTY, ok: true };
}

/** Verify (or write) row 1 of one specific tab against that tab's own plan. */
async function ensureHeaderIn(form: FormKey, ctx: Ctx, tab: string): Promise<SyncResult> {
  // A tab this operation just created was given the current header already.
  if (ctx.fresh.has(tab)) return { ...EMPTY, ok: true };

  const header = planOf(ctx, tab).header;
  const res = await getValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1:${colLetter(header.length - 1)}1`);
  if (!res.ok) return failed(res.reason ?? 'read_failed', res.message);
  const current = res.data?.[0] ?? [];

  if (current.length === 0) {
    const w = await updateValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1`, [header]);
    if (!w.ok) return failed(w.reason ?? 'update_failed', w.message);
    return { ...EMPTY, ok: true };
  }
  if (sameHeader(current, header)) return { ...EMPTY, ok: true };

  // Column set changed: rewrite everything so no row can misalign.
  strapi.log.info(`[sheets] ${form}: header changed in "${tab}", rewriting`);
  return resyncForm(form, 'manual', { log: false });
}

/* -------------------------------------------------------------- upsertRow */

/** Write one document: update its existing row, or append it if it is new. */
export async function upsertRow(form: FormKey, doc: RowLike): Promise<SyncResult> {
  freshPlans(form);
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

  const row = cellsOf(ctx.plan.types, ctx.plan.row(doc));
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

  const plan = planOf(ctx, target);
  const row = cellsOf(plan.types, plan.row(doc));
  const places = scan.located.get(documentId) ?? [];
  const here = places.find((p) => p.tab === target);
  const elsewhere = places.filter((p) => p.tab !== target);

  let added = 0;
  let updated = 0;

  if (here) {
    const res = await updateValues(ctx.spreadsheetId, rowRange(ctx, target, here.row), [row]);
    if (!res.ok) return failed(res.reason ?? 'update_failed', res.message);
    queueLinks(ctx, target, here.row, [row]);
    updated = 1;
  } else {
    // INSERT FIRST. If the process dies now, the row exists twice and the next
    // reconcile drops the stale copy; the row itself is never lost.
    const res = await appendValues(ctx.spreadsheetId, `${quoteTab(target)}!A1`, [row]);
    if (!res.ok) return failed(res.reason ?? 'append_failed', res.message);
    queueLinks(ctx, target, res.data?.startRow ?? null, [row]);
    added = 1;
  }
  await sendLinks(ctx);

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
  // Rebuild the plan(s) over exactly the rows we are about to write, so a
  // custom answer that only exists on old rows still gets a column.
  const result = isMulti(ctx)
    ? await resyncMulti({ ...ctx, plans: await desc.resolveTabPlans(rows) }, rows)
    : await resyncSingle(ctx, await desc.resolvePlan(rows), rows);

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

async function resyncMulti(ctx: MultiCtx, rows: RowLike[]): Promise<SyncResult> {
  // Which tabs do we currently own? Read before anything is cleared, so a tab
  // that ends up empty can still be reported rather than silently forgotten.
  const scan = await scanIds(ctx);
  if (isResult(scan)) return scan;

  const groups = groupByTab(ctx, rows);
  for (const [tab, docs] of groups) {
    const res = await rewriteTab(ctx, tab, docs);
    if (res) return res;
  }

  await sendLinks(ctx);

  const staleTabs = scan.dataTabs.filter((t) => !groups.has(t)).sort();
  // A stale tab is kept, but not the copies it still holds of rows just
  // written to their own tab (the source half of a move).
  const removed = await dropRows(ctx, movedAway(scan, staleTabs, rows));
  if (isResult(removed)) return removed;
  if (staleTabs.length) {
    strapi?.log?.info?.(`[sheets] tabs with no rows left in the database (kept): ${staleTabs.join(', ')}`);
  }
  return { ok: true, added: rows.length, updated: 0, removed, staleTabs };
}

/** Where tabs with no rows in the database hold rows that the database places in another tab. */
function movedAway(scan: IdScan, staleTabs: string[], rows: RowLike[]): Located[] {
  const ids = new Set(rows.map((r) => String(r?.documentId ?? '').trim()));
  const stale = new Set(staleTabs);
  return [...scan.located]
    .filter(([id]) => ids.has(id))
    .flatMap(([, places]) => places.filter((p) => stale.has(p.tab)));
}

/** Rows grouped by the tab they belong in, oldest first within each tab. */
function groupByTab(ctx: MultiCtx, rows: RowLike[]): Map<string, RowLike[]> {
  const groups = new Map<string, RowLike[]>();
  for (const doc of rows) appendTo(groups, ctx.partition.tabFor(doc), doc);
  return groups;
}

function appendTo<T>(map: Map<string, T[]>, key: string, item: T): void {
  const list = map.get(key);
  if (list) list.push(item);
  else map.set(key, [item]);
}

/** Clear one tab and write its header and rows with the tab's own columns. Null when it worked. */
async function rewriteTab(ctx: MultiCtx, tab: string, docs: RowLike[]): Promise<SyncResult | null> {
  const sheetId = await ensureTabIn(ctx, tab);
  if (typeof sheetId !== 'number') return sheetId;
  const plan = planOf(ctx, tab);
  const cleared = await clearValues(ctx.spreadsheetId, tab);
  if (!cleared.ok) return failed(cleared.reason ?? 'clear_failed', cleared.message);
  const rows = docs.map((doc) => cellsOf(plan.types, plan.row(doc)));
  const written = await updateValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1`, [plan.header, ...rows]);
  if (!written.ok) return failed(written.reason ?? 'update_failed', written.message);
  queueLinks(ctx, tab, 2, rows);
  // `values.clear` wipes contents, never formatting; the column set may have
  // just changed, so the widths, date formats and status colours are redone.
  await applyFormat(ctx, tab, plan.types, true);
  return null;
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
  return isMulti(ctx)
    ? reconcileMulti(form, { ...ctx, plans: await desc.resolveTabPlans(rows) }, rows, trigger)
    : reconcileSingle(form, ctx, await desc.resolvePlan(rows), rows, trigger);
}

/** Row 1 of `tab` compared against the plan header. */
async function headerState(
  ctx: BaseCtx,
  tab: string,
  plan: ColumnPlan,
): Promise<{ matches: boolean } | SyncResult> {
  const res = await getValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1:${lastColOf(plan)}1`);
  if (!res.ok) return failed(res.reason ?? 'read_failed', res.message);
  return { matches: sameHeader(res.data?.[0] ?? [], plan.header) };
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

/** What the tabs we own hold, read once per reconcile. */
interface SheetState {
  dataTabs: string[];
  /** Every place each id occurs. */
  located: Map<string, Located[]>;
  /** `${tab}#${row}` -> the row's cells as the sheet shows them. */
  cellsAt: Map<string, string[]>;
}

/** One database row: the tab it belongs in, the cells to write, and the text they will show. */
interface Wanted {
  tab: string;
  cells: Cell[];
  shown: string[];
}

/** A row rewritten in place: where, and its cells. */
interface RowUpdate {
  range: string;
  values: Cell[][];
  tab: string;
  row: number;
}

/** The writes that bring a partitioned form's tabs in line with the database. */
interface Changes {
  toUpdate: RowUpdate[];
  appendsByTab: Map<string, Cell[][]>;
  toDelete: Located[];
}

/** What a set of changes did. */
interface Applied extends SyncCounts {
  ok: boolean;
  problems: string[];
}

const HEADER_CHANGED = 'header_changed' as const;

/** How a tab relates to its plan: ours and current, ours with other columns (ID at `idIndex`), or not ours. */
type Layout = { kind: 'current' | 'changed'; idIndex: number } | { kind: 'foreign' };

async function reconcileMulti(
  form: FormKey,
  ctx: MultiCtx,
  rows: RowLike[],
  trigger: SyncTrigger,
): Promise<SyncResult> {
  const want = wantedRows(ctx, rows);
  const wantedTabs = new Set([...want.values()].map((w) => w.tab));
  const sheet = await readOwnTabs(ctx, wantedTabs);
  if (sheet === HEADER_CHANGED) {
    // A changed column set makes a cell-by-cell diff meaningless: rewrite all.
    const res = await resyncForm(form, trigger, { log: false });
    await logSync(form, trigger, res, res.ok, res.ok ? 'Antet diferit: rescriere completă' : res.reason);
    return res;
  }
  if (isResult(sheet)) return sheet;

  const { changes, misplaced } = reconcileChanges(ctx, sheet, want);
  const applied = await applyChanges(ctx, changes);
  const staleTabs = sheet.dataTabs.filter((t) => !wantedTabs.has(t)).sort();
  const message = applied.ok ? reconcileMessage(applied, misplaced, staleTabs) : applied.problems.join('; ');
  const counts: SyncCounts = { added: applied.added, updated: applied.updated, removed: applied.removed };
  await logSync(form, trigger, counts, applied.ok, message);
  return { ...counts, ok: applied.ok, reason: applied.ok ? undefined : 'reconcile_failed', message, staleTabs };
}

/**
 * Read every tab in full, once. Tabs that are not ours are skipped outright. A
 * tab of ours whose header is not its plan's means the column set changed,
 * unless the database has no rows for it any more: such a tab keeps whatever
 * columns it has, and only its ids are read, to remove what it still holds.
 */
async function readOwnTabs(
  ctx: MultiCtx,
  wantedTabs: Set<string>,
): Promise<SheetState | SyncResult | typeof HEADER_CHANGED> {
  const sheet: SheetState = { dataTabs: [], located: new Map(), cellsAt: new Map() };
  for (const tab of [...ctx.tabs.keys()]) {
    const res = await readOwnTab(ctx, tab, wantedTabs.has(tab), sheet);
    if (res) return res;
  }
  return sheet;
}

/** Read one tab into `sheet`. Null when done (or when the tab is not ours). */
async function readOwnTab(
  ctx: MultiCtx,
  tab: string,
  wanted: boolean,
  sheet: SheetState,
): Promise<SyncResult | typeof HEADER_CHANGED | null> {
  const plan = planOf(ctx, tab);
  const res = await getValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1:${lastColOf(plan)}`);
  if (!res.ok) return failed(res.reason ?? 'read_failed', res.message);
  const grid = res.data ?? [];
  const layout = await layoutOf(ctx, tab, plan, grid[0] ?? []);
  if (isResult(layout)) return layout;
  if (layout.kind === 'foreign') return null;
  if (layout.kind === 'changed') return wanted ? HEADER_CHANGED : collectIds(ctx, sheet, tab, layout.idIndex);
  await applyFormat(ctx, tab, plan.types, false);
  collectRows(sheet, tab, grid, layout.idIndex);
  return null;
}

/** A tab with no rows left in the database, laid out for other columns: only find what it holds. */
async function collectIds(ctx: MultiCtx, sheet: SheetState, tab: string, idIndex: number): Promise<SyncResult | null> {
  const ids = await readColumn(ctx, tab, idIndex);
  if (isResult(ids)) return ids;
  collectRows(sheet, tab, ids, 0);
  return null;
}

/** `head` is row 1 read up to the plan's last column; the full row is read only when that is not ours. */
async function layoutOf(ctx: MultiCtx, tab: string, plan: ColumnPlan, head: string[]): Promise<Layout | SyncResult> {
  const idIndex = plan.header.length - 1;
  if ((head[idIndex] ?? '').trim() === ID_LABEL) {
    return { kind: sameHeader(head, plan.header) ? 'current' : 'changed', idIndex };
  }
  const full = await readHeaderRow(ctx, tab);
  if (isResult(full)) return full;
  const found = idIndexIn(full);
  return found < 0 ? { kind: 'foreign' } : { kind: 'changed', idIndex: found };
}

function collectRows(sheet: SheetState, tab: string, grid: string[][], idIndex: number): void {
  sheet.dataTabs.push(tab);
  grid.forEach((cells, i) => {
    const id = (cells?.[idIndex] ?? '').trim();
    if (i === 0 || !id) return;
    addPlace(sheet.located, id, { tab, row: i + 1 });
    sheet.cellsAt.set(`${tab}#${i + 1}`, cells);
  });
}

/** What the database says: id -> the tab it belongs in and the row as that tab's plan renders it. */
function wantedRows(ctx: MultiCtx, rows: RowLike[]): Map<string, Wanted> {
  const want = new Map<string, Wanted>();
  for (const doc of rows) {
    const id = String(doc?.documentId ?? '').trim();
    if (!id) continue;
    const tab = ctx.partition.tabFor(doc);
    const plan = planOf(ctx, tab);
    const rendered = plan.row(doc);
    want.set(id, { tab, cells: cellsOf(plan.types, rendered), shown: shownOf(plan.types, rendered) });
  }
  return want;
}

/**
 * Diff the sheet against the database. A row in the wrong tab (a moved season,
 * or the leftover half of a crashed move) is re-inserted in its own tab and
 * removed from the other; rows whose document is gone are removed; a duplicate
 * inside one tab keeps its first copy.
 */
function reconcileChanges(
  ctx: MultiCtx,
  sheet: SheetState,
  want: Map<string, Wanted>,
): { changes: Changes; misplaced: number } {
  const changes: Changes = { toUpdate: [], appendsByTab: new Map(), toDelete: [] };
  let misplaced = 0;
  for (const [id, target] of want) {
    const places = sheet.located.get(id) ?? [];
    placeRow(ctx, sheet, changes, target, places);
    const away = places.filter((p) => p.tab !== target.tab);
    changes.toDelete.push(...away);
    misplaced += away.length;
  }
  for (const [id, places] of sheet.located) {
    const target = want.get(id);
    if (!target) changes.toDelete.push(...places);
    else changes.toDelete.push(...places.filter((p) => p.tab === target.tab).slice(1));
  }
  return { changes, misplaced };
}

/** Update the row where it already sits in its tab (when it shows something else), or append it there. */
function placeRow(ctx: MultiCtx, sheet: SheetState, changes: Changes, target: Wanted, places: Located[]): void {
  const here = places.find((p) => p.tab === target.tab);
  if (!here) {
    appendTo(changes.appendsByTab, target.tab, target.cells);
    return;
  }
  // Compare against what the sheet SHOWS: a date cell reads back as
  // "13.09.2026 15:30", never as the ISO string the database holds.
  const current = sheet.cellsAt.get(`${here.tab}#${here.row}`) ?? [];
  if (!target.shown.every((cell, i) => (current[i] ?? '') === cell)) {
    changes.toUpdate.push({ range: rowRange(ctx, here.tab, here.row), values: [target.cells], tab: here.tab, row: here.row });
  }
}

function reconcileMessage(counts: SyncCounts, misplaced: number, staleTabs: string[]): string {
  return (
    `Verificare: +${counts.added} ~${counts.updated} -${counts.removed}` +
    (misplaced > 0 ? ` (${misplaced} mutate între file)` : '') +
    (staleTabs.length ? `; file păstrate fără rânduri: ${staleTabs.join(', ')}` : '')
  );
}

/** Record a failed step; true when the step worked. */
function note(out: Applied, res: { ok: boolean; reason?: string; message?: string }): boolean {
  if (res.ok) return true;
  out.ok = false;
  out.problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
  return false;
}

/**
 * Write a set of changes: the updates in one call, the appends one call per
 * tab, and only then, when every write worked, the deletes. INSERTS BEFORE
 * DELETES: a failure here must never leave a row nowhere.
 */
async function applyChanges(ctx: MultiCtx, changes: Changes): Promise<Applied> {
  const out: Applied = { ok: true, problems: [], added: 0, updated: changes.toUpdate.length, removed: 0 };
  if (changes.toUpdate.length && note(out, await batchUpdateValues(ctx.spreadsheetId, changes.toUpdate))) {
    for (const u of changes.toUpdate) queueLinks(ctx, u.tab, u.row, u.values);
  }
  for (const [tab, values] of changes.appendsByTab) await appendRows(ctx, tab, values, out);
  await sendLinks(ctx);
  await deleteAfterInserts(ctx, changes.toDelete, out);
  return out;
}

async function appendRows(ctx: MultiCtx, tab: string, values: Cell[][], out: Applied): Promise<void> {
  const sheetId = await ensureTabIn(ctx, tab);
  if (typeof sheetId !== 'number') {
    note(out, sheetId);
    return;
  }
  const res = await appendValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1`, values);
  if (!note(out, res)) return;
  out.added += values.length;
  queueLinks(ctx, tab, res.data?.startRow ?? null, values);
}

async function deleteAfterInserts(ctx: MultiCtx, toDelete: Located[], out: Applied): Promise<void> {
  if (!toDelete.length) return;
  if (!out.ok) {
    out.problems.push('ștergerile au fost amânate: o inserare a eșuat');
    return;
  }
  const res = await dropRows(ctx, toDelete);
  if (isResult(res)) note(out, res);
  else out.removed = res;
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
  freshPlans(form);
  const ctx = await context(form);
  if (isResult(ctx)) return ctx;

  const docs = await getForm(form).fetchByIds(upsertIds);

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
    const row = cellsOf(ctx.plan.types, ctx.plan.row(doc));
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
 * it belongs in, with that tab's columns, and only then are its copies in
 * other tabs removed.
 */
async function batchMulti(
  form: FormKey,
  ctx: MultiCtx,
  docs: RowLike[],
  deleteIds: string[],
): Promise<SyncResult> {
  const targets = await prepareTargets(form, ctx, docs);
  if (isResult(targets)) return targets;

  const scan = await scanIds(ctx);
  if (isResult(scan)) return scan;

  const applied = await applyChanges(ctx, batchChanges(ctx, scan, docs, targets, deleteIds));
  return {
    ok: applied.ok,
    added: applied.added,
    updated: applied.updated,
    removed: applied.removed,
    reason: applied.ok ? undefined : 'batch_failed',
    message: applied.ok ? undefined : applied.problems.join('; '),
  };
}

/**
 * documentId -> target tab. Every target tab is created and its header checked
 * first, so the scan already sees it. A header that had to change rewrote the
 * whole form; that result is returned and the queued work is subsumed.
 */
async function prepareTargets(form: FormKey, ctx: MultiCtx, docs: RowLike[]): Promise<Map<string, string> | SyncResult> {
  const targets = new Map<string, string>();
  for (const doc of docs) {
    const id = String(doc?.documentId ?? '').trim();
    if (!id) continue;
    const tab = ctx.partition.tabFor(doc);
    const seen = [...targets.values()].includes(tab);
    targets.set(id, tab);
    if (seen) continue;
    const sheetId = await ensureTabIn(ctx, tab);
    if (typeof sheetId !== 'number') return sheetId;
    const headerRes = await ensureHeaderIn(form, ctx, tab);
    if (failedOrRewrote(headerRes)) return headerRes;
  }
  return targets;
}

/** A header check that failed, or that rewrote the whole form (which subsumes the queued work). */
const failedOrRewrote = (res: SyncResult): boolean => !res.ok || res.added + res.updated + res.removed > 0;

function batchChanges(
  ctx: MultiCtx,
  scan: IdScan,
  docs: RowLike[],
  targets: Map<string, string>,
  deleteIds: string[],
): Changes {
  const changes: Changes = { toUpdate: [], appendsByTab: new Map(), toDelete: [] };
  for (const doc of docs) {
    const id = String(doc?.documentId ?? '').trim();
    const tab = targets.get(id);
    if (!tab) continue;
    const plan = planOf(ctx, tab);
    const row = cellsOf(plan.types, plan.row(doc));
    const places = scan.located.get(id) ?? [];
    const here = places.find((p) => p.tab === tab);
    if (here) changes.toUpdate.push({ range: rowRange(ctx, tab, here.row), values: [row], tab, row: here.row });
    else appendTo(changes.appendsByTab, tab, row);
    changes.toDelete.push(...places.filter((p) => p.tab !== tab));
  }
  for (const raw of deleteIds) changes.toDelete.push(...(scan.located.get(String(raw ?? '').trim()) ?? []));
  return changes;
}
