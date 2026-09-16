/**
 * Low-level Google Sheets / Drive client, shared by every form.
 *
 * Fully inert until configured: with no service-account env vars set, every
 * function returns `{ ok: false, reason: 'not_configured' }` and never touches
 * the network or the `googleapis` module. Nothing here ever throws — callers
 * branch on `reason`, and every distinct failure mode gets its own reason so
 * "the library could not authenticate" is never confused with "the append call
 * was rejected".
 *
 * Env:
 *   GOOGLE_SA_EMAIL         service-account client email      (required)
 *   GOOGLE_SA_PRIVATE_KEY   service-account private key       (required, literal \n ok)
 *   SHEETS_DRY_RUN=1        simulate every call in memory, log what would happen
 *   SHEETS_SHARE_WITH       default address newly created spreadsheets are shared with
 *
 * Legacy (back-compat seed only, see store.ts):
 *   SHEETS_SPREADSHEET_ID, SHEETS_TAB_NAME
 *
 * The `googleapis` package is required lazily so the app boots even if the
 * dependency is missing; that degrades to `client_unavailable`, not a crash.
 */

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

export type Reason =
  | 'not_configured'
  | 'client_unavailable'
  | 'not_found'
  | 'no_access'
  | 'invalid_link'
  | 'read_failed'
  | 'append_failed'
  | 'update_failed'
  | 'delete_failed'
  | 'clear_failed'
  | 'create_failed'
  | 'share_failed'
  | 'tab_failed';

export interface OpResult<T = unknown> {
  ok: boolean;
  reason?: Reason;
  message?: string;
  data?: T;
}

/* -------------------------------------------------------------- cell model */

/**
 * A date written as a real Sheets value: `serial` is what the API is given (a
 * serial number, so the cell is a genuine date that sorts and filters), `text`
 * is what the sheet then DISPLAYS once its column carries the matching
 * numberFormat. Both are produced together in `format.ts`.
 *
 * The two are needed because writes and reads speak different languages: we
 * write the number, but `values.get` hands back the formatted text, and that
 * text is what a reconcile diff has to compare against.
 */
export interface DateCell {
  readonly kind: 'date';
  readonly serial: number;
  readonly text: string;
}

/** One cell heading for the API: plain text, or a real date. */
export type Cell = string | DateCell;

/** What the sheet will show for a cell — the diffable form. */
export const cellText = (c: Cell): string => (typeof c === 'string' ? c : c.text);

/** What the API is given for a cell. */
export const cellApi = (c: Cell): string | number => (typeof c === 'string' ? c : c.serial);

/** Values as the API wants them: serial numbers for dates, strings otherwise. */
const apiValues = (values: Cell[][]): (string | number)[][] =>
  values.map((row) => row.map(cellApi));

/**
 * Values as the dry-run grid stores them. It keeps the DISPLAYED text, so a
 * dry-run read looks like a real formatted read and dry-run reconcile diffs
 * behave exactly as they would against Google.
 */
const dryValues = (values: Cell[][]): string[][] => values.map((row) => row.map(cellText));

const fail = (reason: Reason, message?: string): OpResult<never> => ({ ok: false, reason, message });
const done = <T>(data: T): OpResult<T> => ({ ok: true, data });

/* ------------------------------------------------------------------ config */

interface Creds {
  email: string;
  privateKey: string;
}

function readCreds(): Creds | null {
  const email = process.env.GOOGLE_SA_EMAIL;
  const rawKey = process.env.GOOGLE_SA_PRIVATE_KEY;
  if (!email || !rawKey) return null;
  // Private keys pasted into .env usually carry literal "\n" sequences.
  return { email, privateKey: rawKey.replace(/\\n/g, '\n') };
}

export function isConfigured(): boolean {
  return readCreds() !== null;
}

export function serviceAccountEmail(): string | null {
  return process.env.GOOGLE_SA_EMAIL || null;
}

export function isDryRun(): boolean {
  const v = String(process.env.SHEETS_DRY_RUN ?? '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function defaultShareWith(): string | null {
  return process.env.SHEETS_SHARE_WITH || null;
}

export const spreadsheetUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}`;

/** Extract a spreadsheet id from a full URL, or accept a bare id. */
export function extractSpreadsheetId(input: unknown): string | null {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) return null;
  const m = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  // A bare id: Google ids are 20+ chars of [A-Za-z0-9-_] with no spaces/slashes.
  if (/^[a-zA-Z0-9-_]{20,}$/.test(raw)) return raw;
  return null;
}

/* ------------------------------------------------------------------- utils */

/** 0-based column index -> A1 column letters (0 -> A, 26 -> AA). */
export function colLetter(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** Quote a tab name for an A1 range (tab names may contain spaces). */
export const quoteTab = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

/* ---------------------------------------------------------------- dry run */

/**
 * In-memory spreadsheet used by SHEETS_DRY_RUN. Keyed `${spreadsheetId}::${tab}`.
 * Mutations are applied here so a dry-run session behaves like a real sheet:
 * an appended row is found by a later lookup, so an update really targets the
 * matching row rather than degenerating into a second append.
 */
const dryStore = new Map<string, string[][]>();

/**
 * Dry-run formatting state, so a simulated run can also answer "is this tab
 * already styled?" and a second dry-run sync can be shown NOT to stack another
 * copy of the conditional rules.
 */
const dryRules = new Map<string, any[]>();
const dryFrozen = new Set<string>();

const dryKey = (id: string, tab: string) => `${id}::${tab}`;

function dryGrid(id: string, tab: string): string[][] {
  const key = dryKey(id, tab);
  let grid = dryStore.get(key);
  if (!grid) {
    grid = [];
    dryStore.set(key, grid);
  }
  return grid;
}

export function _dryResetAll(): void {
  dryStore.clear();
  dryRules.clear();
  dryFrozen.clear();
}

interface ParsedRange {
  tab: string;
  startCol: number; // 0-based
  startRow: number; // 0-based
}

/** Parse the A1 ranges this module produces (`'Tab'!A1`, `Tab!C2:C`, …). */
function parseRange(range: string): ParsedRange {
  const bang = range.lastIndexOf('!');
  let tab = bang >= 0 ? range.slice(0, bang) : '';
  const cells = bang >= 0 ? range.slice(bang + 1) : range;
  if (tab.startsWith("'") && tab.endsWith("'")) tab = tab.slice(1, -1).replace(/''/g, "'");
  const first = cells.split(':')[0] ?? '';
  const m = first.match(/^([A-Z]+)?(\d+)?$/i);
  let startCol = 0;
  let startRow = 0;
  if (m) {
    if (m[1]) {
      let n = 0;
      for (const ch of m[1].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
      startCol = n - 1;
    }
    if (m[2]) startRow = Number(m[2]) - 1;
  }
  return { tab, startCol, startRow };
}

function dryLog(op: string, details: Record<string, unknown>): void {
  const parts = Object.entries(details)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`);
  strapi?.log?.info?.(`[sheets][dry-run] ${op} ${parts.join(' ')}`);
}

/** Summarise a values payload for the dry-run log: count + the first row. */
function rowsDetail(values: string[][]): Record<string, unknown> {
  return { rows: values.length, firstRow: values[0] ?? [] };
}

function dryWrite(spreadsheetId: string, range: string, values: string[][]): void {
  const { tab, startCol, startRow } = parseRange(range);
  const grid = dryGrid(spreadsheetId, tab);
  values.forEach((row, r) => {
    const target = startRow + r;
    while (grid.length <= target) grid.push([]);
    const line = grid[target];
    row.forEach((cell, c) => {
      line[startCol + c] = cell;
    });
  });
}

function dryAppend(spreadsheetId: string, range: string, values: string[][]): number {
  const { tab } = parseRange(range);
  const grid = dryGrid(spreadsheetId, tab);
  for (const row of values) grid.push([...row]);
  return grid.length;
}

function dryRead(spreadsheetId: string, range: string): string[][] {
  const { tab, startCol, startRow } = parseRange(range);
  const grid = dryStore.get(dryKey(spreadsheetId, tab));
  if (!grid) return [];
  const cells = range.slice(range.lastIndexOf('!') + 1);
  const endPart = cells.includes(':') ? cells.split(':')[1] : '';
  const endM = endPart.match(/^([A-Z]+)?(\d+)?$/i);
  let endCol = Number.POSITIVE_INFINITY;
  let endRow = Number.POSITIVE_INFINITY;
  if (endM) {
    if (endM[1]) {
      let n = 0;
      for (const ch of endM[1].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
      endCol = n - 1;
    }
    if (endM[2]) endRow = Number(endM[2]) - 1;
  }
  if (!cells.includes(':')) {
    endCol = startCol;
    endRow = startRow;
  }
  const out: string[][] = [];
  for (let r = startRow; r < grid.length && r <= endRow; r += 1) {
    const line = grid[r] ?? [];
    const last = Number.isFinite(endCol) ? (endCol as number) : line.length - 1;
    const slice: string[] = [];
    for (let c = startCol; c <= last; c += 1) slice.push(line[c] ?? '');
    out.push(slice);
  }
  // Trim trailing fully-empty rows, matching the real API's behaviour.
  while (out.length && out[out.length - 1].every((c) => c === '')) out.pop();
  return out;
}

function dryDelete(spreadsheetId: string, tab: string, rows: number[]): void {
  const grid = dryGrid(spreadsheetId, tab);
  for (const r of [...rows].sort((a, b) => b - a)) grid.splice(r, 1);
}

function dryClear(spreadsheetId: string, tab: string): void {
  dryStore.set(dryKey(spreadsheetId, tab), []);
}

/* ------------------------------------------------------------------ client */

let cached: { sheets: any; drive: any; email: string } | null = null;

/** Build (or reuse) authenticated Sheets + Drive clients. Null on any failure. */
async function clients(): Promise<{ sheets: any; drive: any } | null> {
  const creds = readCreds();
  if (!creds) return null;
  if (cached && cached.email === creds.email) return cached;
  try {
    // Lazy require so a missing dependency never breaks app boot.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { google } = require('googleapis');
    const auth = new google.auth.JWT({ email: creds.email, key: creds.privateKey, scopes: SCOPES });
    await auth.authorize();
    cached = {
      sheets: google.sheets({ version: 'v4', auth }),
      drive: google.drive({ version: 'v3', auth }),
      email: creds.email,
    };
    return cached;
  } catch (err) {
    strapi?.log?.warn?.(`[sheets] client init failed: ${(err as Error)?.message ?? err}`);
    return null;
  }
}

/** Map a googleapis error to one of our reasons. */
function classify(err: any, fallback: Reason): { reason: Reason; message: string } {
  const status = err?.code ?? err?.response?.status;
  const message = err?.errors?.[0]?.message ?? err?.message ?? String(err);
  if (status === 404) return { reason: 'not_found', message };
  if (status === 403 || status === 401) return { reason: 'no_access', message };
  return { reason: fallback, message };
}

/* --------------------------------------------------------------- read ops */

/** Read a range. Returns a (possibly empty) matrix of string cells. */
export async function getValues(spreadsheetId: string, range: string): Promise<OpResult<string[][]>> {
  if (!isConfigured()) return fail('not_configured');
  if (isDryRun()) return done(dryRead(spreadsheetId, range));
  const c = await clients();
  if (!c) return fail('client_unavailable', 'Nu am putut autentifica contul de serviciu.');
  try {
    const res = await c.sheets.spreadsheets.values.get({ spreadsheetId, range });
    const values = (res?.data?.values ?? []) as unknown[][];
    return done(values.map((row) => row.map((cell) => (cell == null ? '' : String(cell)))));
  } catch (err) {
    const { reason, message } = classify(err, 'read_failed');
    strapi?.log?.warn?.(`[sheets] read failed (${reason}): ${message}`);
    return fail(reason, message);
  }
}

/**
 * One tab, as the sync engine needs to see it.
 *
 * `frozenRowCount` and `conditionalFormats` ride along on the SAME
 * `spreadsheets.get` every operation already makes, so `format.ts` can decide
 * whether a tab is already styled — and which conditional rules to remove
 * before re-adding its own — without a single extra request.
 */
export interface TabInfo {
  title: string;
  sheetId: number;
  frozenRowCount: number;
  /** The tab's conditional-format rules, in rule-index order. */
  conditionalFormats: any[];
}

export interface SpreadsheetInfo {
  spreadsheetId: string;
  title: string;
  tabs: TabInfo[];
}

/** Fetch spreadsheet metadata: title, tab list, and each tab's format state. */
export async function getSpreadsheet(spreadsheetId: string): Promise<OpResult<SpreadsheetInfo>> {
  if (!isConfigured()) return fail('not_configured');
  if (isDryRun()) {
    const tabs: TabInfo[] = [...dryStore.keys()]
      .filter((k) => k.startsWith(`${spreadsheetId}::`))
      .map((k, i) => ({
        title: k.split('::')[1],
        sheetId: i,
        frozenRowCount: dryFrozen.has(dryKey(spreadsheetId, k.split('::')[1])) ? 1 : 0,
        conditionalFormats: dryRules.get(dryKey(spreadsheetId, k.split('::')[1])) ?? [],
      }));
    if (!tabs.length) tabs.push({ title: 'Date', sheetId: 0, frozenRowCount: 0, conditionalFormats: [] });
    dryLog('spreadsheets.get', { spreadsheetId, tabs: tabs.map((t) => t.title) });
    return done({ spreadsheetId, title: `[dry-run] ${spreadsheetId}`, tabs });
  }
  const c = await clients();
  if (!c) return fail('client_unavailable', 'Nu am putut autentifica contul de serviciu.');
  try {
    const res = await c.sheets.spreadsheets.get({
      spreadsheetId,
      fields:
        'properties.title,sheets(properties(sheetId,title,gridProperties(frozenRowCount)),conditionalFormats)',
    });
    const tabs: TabInfo[] = ((res?.data?.sheets ?? []) as any[]).map((s) => ({
      title: String(s?.properties?.title ?? ''),
      sheetId: Number(s?.properties?.sheetId ?? 0),
      frozenRowCount: Number(s?.properties?.gridProperties?.frozenRowCount ?? 0),
      conditionalFormats: (s?.conditionalFormats ?? []) as any[],
    }));
    return done({ spreadsheetId, title: String(res?.data?.properties?.title ?? ''), tabs });
  } catch (err) {
    const { reason, message } = classify(err, 'read_failed');
    return fail(reason, message);
  }
}

/* -------------------------------------------------------------- write ops */

/**
 * Overwrite a range with `values`.
 *
 * RAW, deliberately: every string lands exactly as sent, so a phone number
 * keeps its leading zero and "1-2" stays text rather than becoming a date.
 * Dates are still real date values — they arrive here as serial NUMBERS
 * (see `DateCell`), which RAW stores as numbers, with the display left to the
 * column's numberFormat instead of to the spreadsheet's locale.
 */
export async function updateValues(
  spreadsheetId: string,
  range: string,
  values: Cell[][],
): Promise<OpResult<{ updated: number }>> {
  if (!isConfigured()) return fail('not_configured');
  if (isDryRun()) {
    const shown = dryValues(values);
    dryLog('values.update', { spreadsheetId, range, ...rowsDetail(shown) });
    dryWrite(spreadsheetId, range, shown);
    return done({ updated: values.length });
  }
  const c = await clients();
  if (!c) return fail('client_unavailable', 'Nu am putut autentifica contul de serviciu.');
  try {
    await c.sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: apiValues(values) },
    });
    return done({ updated: values.length });
  } catch (err) {
    const { reason, message } = classify(err, 'update_failed');
    strapi?.log?.warn?.(`[sheets] update failed (${reason}): ${message}`);
    return fail(reason, message);
  }
}

/** Append rows to the end of the tab. */
export async function appendValues(
  spreadsheetId: string,
  range: string,
  values: Cell[][],
): Promise<OpResult<{ appended: number }>> {
  if (!isConfigured()) return fail('not_configured');
  if (values.length === 0) return done({ appended: 0 });
  if (isDryRun()) {
    const shown = dryValues(values);
    const total = dryAppend(spreadsheetId, range, shown);
    dryLog('values.append', { spreadsheetId, range, ...rowsDetail(shown), sheetRows: total });
    return done({ appended: values.length });
  }
  const c = await clients();
  if (!c) return fail('client_unavailable', 'Nu am putut autentifica contul de serviciu.');
  try {
    await c.sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: apiValues(values) },
    });
    return done({ appended: values.length });
  } catch (err) {
    const { reason, message } = classify(err, 'append_failed');
    strapi?.log?.warn?.(`[sheets] append failed (${reason}): ${message}`);
    return fail(reason, message);
  }
}

/**
 * Write many disjoint ranges in ONE API call. This is what the write queue
 * flushes into: a burst of N row updates costs one request, not N.
 */
export async function batchUpdateValues(
  spreadsheetId: string,
  data: { range: string; values: Cell[][] }[],
): Promise<OpResult<{ updated: number }>> {
  if (!isConfigured()) return fail('not_configured');
  if (data.length === 0) return done({ updated: 0 });
  if (isDryRun()) {
    const flat = data.flatMap((d) => dryValues(d.values));
    dryLog('values.batchUpdate', {
      spreadsheetId,
      ranges: data.length,
      firstRange: data[0].range,
      ...rowsDetail(flat),
    });
    for (const d of data) dryWrite(spreadsheetId, d.range, dryValues(d.values));
    return done({ updated: data.length });
  }
  const c = await clients();
  if (!c) return fail('client_unavailable', 'Nu am putut autentifica contul de serviciu.');
  try {
    await c.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: data.map((d) => ({ range: d.range, values: apiValues(d.values) })),
      },
    });
    return done({ updated: data.length });
  } catch (err) {
    const { reason, message } = classify(err, 'update_failed');
    strapi?.log?.warn?.(`[sheets] batch update failed (${reason}): ${message}`);
    return fail(reason, message);
  }
}

/** Clear every cell in the tab (used by resyncForm). */
export async function clearValues(spreadsheetId: string, tab: string): Promise<OpResult<true>> {
  if (!isConfigured()) return fail('not_configured');
  if (isDryRun()) {
    dryLog('values.clear', { spreadsheetId, tab });
    dryClear(spreadsheetId, tab);
    return done(true as const);
  }
  const c = await clients();
  if (!c) return fail('client_unavailable', 'Nu am putut autentifica contul de serviciu.');
  try {
    await c.sheets.spreadsheets.values.clear({ spreadsheetId, range: quoteTab(tab) });
    return done(true as const);
  } catch (err) {
    const { reason, message } = classify(err, 'clear_failed');
    strapi?.log?.warn?.(`[sheets] clear failed (${reason}): ${message}`);
    return fail(reason, message);
  }
}

/**
 * Delete rows by 0-based sheet row index, in one batchUpdate. Indices are
 * applied descending so earlier deletions can't shift later ones.
 */
export async function deleteRows(
  spreadsheetId: string,
  tab: string,
  sheetId: number,
  rowIndices: number[],
): Promise<OpResult<{ removed: number }>> {
  if (!isConfigured()) return fail('not_configured');
  if (rowIndices.length === 0) return done({ removed: 0 });
  const ordered = [...new Set(rowIndices)].sort((a, b) => b - a);
  if (isDryRun()) {
    dryLog('batchUpdate.deleteDimension', { spreadsheetId, tab, sheetId, rows: ordered.length, indices: ordered });
    dryDelete(spreadsheetId, tab, ordered);
    return done({ removed: ordered.length });
  }
  const c = await clients();
  if (!c) return fail('client_unavailable', 'Nu am putut autentifica contul de serviciu.');
  try {
    await c.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: ordered.map((index) => ({
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: index, endIndex: index + 1 },
          },
        })),
      },
    });
    return done({ removed: ordered.length });
  } catch (err) {
    const { reason, message } = classify(err, 'delete_failed');
    strapi?.log?.warn?.(`[sheets] delete failed (${reason}): ${message}`);
    return fail(reason, message);
  }
}

/**
 * Send raw `spreadsheets.batchUpdate` requests. This is the STRUCTURE channel —
 * frozen rows, cell formats, column widths, conditional-format rules — as
 * opposed to the `values.*` calls above, which only carry contents.
 *
 * The dry run mirrors just enough of it to answer a later `spreadsheets.get`:
 * the frozen-row flag and the conditional rules, the only piece of formatting
 * that could accumulate duplicates if the idempotency logic were wrong.
 */
export async function batchUpdateSheet(
  spreadsheetId: string,
  tab: string,
  requests: any[],
): Promise<OpResult<true>> {
  if (!isConfigured()) return fail('not_configured');
  if (requests.length === 0) return done(true as const);
  if (isDryRun()) {
    const key = dryKey(spreadsheetId, tab);
    const rules = [...(dryRules.get(key) ?? [])];
    for (const r of requests) {
      if (r.updateSheetProperties?.properties?.gridProperties?.frozenRowCount) dryFrozen.add(key);
      if (typeof r.deleteConditionalFormatRule?.index === 'number') {
        rules.splice(r.deleteConditionalFormatRule.index, 1);
      }
      if (r.addConditionalFormatRule?.rule) {
        rules.splice(r.addConditionalFormatRule.index ?? rules.length, 0, r.addConditionalFormatRule.rule);
      }
    }
    dryRules.set(key, rules);
    dryLog('spreadsheets.batchUpdate', {
      spreadsheetId,
      tab,
      requests: requests.length,
      kinds: requests.map((r) => Object.keys(r)[0]),
      conditionalRules: rules.length,
    });
    return done(true as const);
  }
  const c = await clients();
  if (!c) return fail('client_unavailable', 'Nu am putut autentifica contul de serviciu.');
  try {
    await c.sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    return done(true as const);
  } catch (err) {
    const { reason, message } = classify(err, 'update_failed');
    strapi?.log?.warn?.(`[sheets] format batchUpdate failed (${reason}): ${message}`);
    return fail(reason, message);
  }
}

/**
 * Google rejects these characters in a worksheet title, and caps it at 100
 * chars. A season string is normally already safe (`2025-2026`), but the field
 * is free text in the database, so never hand it to the API unfiltered.
 */
export function sanitizeTabName(raw: unknown, fallback: string): string {
  const cleaned = String(raw ?? '')
    .replace(/[\[\]\*\?\/\\:]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
    // A leading/trailing apostrophe confuses A1 range quoting.
    .replace(/^'+|'+$/g, '')
    .trim();
  return cleaned || fallback;
}

/**
 * Create a tab unconditionally (`addSheet`) and return its numeric sheetId.
 * Callers that already hold a tab list use this instead of `ensureTab` so a
 * per-row tab check costs zero extra `spreadsheets.get` calls.
 */
export async function createTab(spreadsheetId: string, tab: string): Promise<OpResult<number>> {
  if (!isConfigured()) return fail('not_configured');
  if (isDryRun()) {
    const existing = [...dryStore.keys()].filter((k) => k.startsWith(`${spreadsheetId}::`)).length;
    dryLog('batchUpdate.addSheet', { spreadsheetId, tab });
    dryGrid(spreadsheetId, tab);
    return done(existing);
  }
  const c = await clients();
  if (!c) return fail('client_unavailable', 'Nu am putut autentifica contul de serviciu.');
  try {
    const res = await c.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
    const sheetId = res?.data?.replies?.[0]?.addSheet?.properties?.sheetId;
    return done(Number(sheetId ?? 0));
  } catch (err) {
    const { reason, message } = classify(err, 'tab_failed');
    strapi?.log?.warn?.(`[sheets] addSheet "${tab}" failed (${reason}): ${message}`);
    return fail(reason, message);
  }
}

/** Create a tab if it is missing; returns its numeric sheetId either way. */
export async function ensureTab(spreadsheetId: string, tab: string): Promise<OpResult<number>> {
  const info = await getSpreadsheet(spreadsheetId);
  if (!info.ok) return fail(info.reason ?? 'read_failed', info.message);
  const found = info.data!.tabs.find((t) => t.title === tab);
  if (found) return done(found.sheetId);
  return createTab(spreadsheetId, tab);
}

/* -------------------------------------------------------- create + share */

/** Create a new spreadsheet with its first tab already named `tab`. */
export async function createSpreadsheet(
  title: string,
  tab: string,
): Promise<OpResult<{ spreadsheetId: string; title: string }>> {
  if (!isConfigured()) return fail('not_configured');
  if (isDryRun()) {
    const id = `dryrun-${Date.now().toString(36)}`;
    dryLog('spreadsheets.create', { spreadsheetId: id, title, tab });
    dryGrid(id, tab);
    return done({ spreadsheetId: id, title });
  }
  const c = await clients();
  if (!c) return fail('client_unavailable', 'Nu am putut autentifica contul de serviciu.');
  try {
    const res = await c.sheets.spreadsheets.create({
      requestBody: { properties: { title }, sheets: [{ properties: { title: tab } }] },
      fields: 'spreadsheetId,properties.title',
    });
    return done({
      spreadsheetId: String(res?.data?.spreadsheetId ?? ''),
      title: String(res?.data?.properties?.title ?? title),
    });
  } catch (err) {
    const { reason, message } = classify(err, 'create_failed');
    strapi?.log?.warn?.(`[sheets] create failed (${reason}): ${message}`);
    return fail(reason, message);
  }
}

/** Grant an email address writer access to a spreadsheet (Drive API). */
export async function shareSpreadsheet(spreadsheetId: string, email: string): Promise<OpResult<true>> {
  if (!isConfigured()) return fail('not_configured');
  if (isDryRun()) {
    dryLog('drive.permissions.create', { spreadsheetId, role: 'writer', emailAddress: email });
    return done(true as const);
  }
  const c = await clients();
  if (!c) return fail('client_unavailable', 'Nu am putut autentifica contul de serviciu.');
  try {
    await c.drive.permissions.create({
      fileId: spreadsheetId,
      sendNotificationEmail: false,
      requestBody: { type: 'user', role: 'writer', emailAddress: email },
    });
    return done(true as const);
  } catch (err) {
    const { reason, message } = classify(err, 'share_failed');
    strapi?.log?.warn?.(`[sheets] share failed (${reason}): ${message}`);
    return fail(reason, message);
  }
}
