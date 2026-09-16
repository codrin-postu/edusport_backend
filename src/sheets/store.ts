/**
 * Persistence for the Sheets integration: the per-form link record and the
 * sync history. Secrets never live here — only the spreadsheet id, tab name,
 * enabled flag and the last-sync summary. The private key stays in env.
 */
import type { FormKey } from './registry';
import { FORM_KEYS } from './registry';

const LINK_UID = 'api::sheet-link.sheet-link' as const;
const LOG_UID = 'api::sheet-sync-log.sheet-sync-log' as const;

/** History rows kept per form; older ones are pruned after every write. */
const HISTORY_LIMIT = 100;

export const DEFAULT_TAB = 'Date';

/**
 * Reconcile intervals the admin may pick, in hours. 0 turns the periodic check
 * off entirely; instant write-on-submit is unaffected by this setting.
 */
export const INTERVAL_HOURS_ALLOWED = [0, 1, 4, 8, 24] as const;

export type IntervalHours = (typeof INTERVAL_HOURS_ALLOWED)[number];

export const DEFAULT_INTERVAL_HOURS: IntervalHours = 4;

/**
 * Slack allowed in the due comparison. The cron ticks on the hour but never at
 * exactly :00.000, so a tick at 08:00:02 measured against a stamp of 04:00:03
 * is a few hundred milliseconds short of four hours. Without this tolerance the
 * run would slip to 09:00 and keep slipping an hour every day.
 */
export const RECONCILE_TOLERANCE_MS = 5 * 60 * 1000;

export interface SheetLink {
  documentId?: string;
  form: FormKey;
  spreadsheetId: string | null;
  spreadsheetName: string | null;
  tab: string;
  enabled: boolean;
  intervalHours: IntervalHours;
  lastSyncAt: string | null;
  lastSyncOk: boolean | null;
  lastSyncMessage: string | null;
  /**
   * When the periodic reconcile last ran for this form.
   *
   * Deliberately separate from `lastSyncAt`: that one is stamped by EVERY sync,
   * including the instant queue flush after a single submission, so a due-check
   * built on it would be reset by ordinary traffic and the periodic pass would
   * never come due. Only a reconcile run writes `lastReconcileAt`.
   */
  lastReconcileAt: string | null;
}

export type SyncTrigger = 'submission' | 'manual' | 'scheduled';

export interface SyncCounts {
  added: number;
  updated: number;
  removed: number;
}

/** Datetime columns come back as a Date or a string depending on the driver. */
function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return typeof value === 'string' ? value : null;
}

/** True only for one of the allowed interval values. */
export function isIntervalHours(value: unknown): value is IntervalHours {
  return typeof value === 'number' && (INTERVAL_HOURS_ALLOWED as readonly number[]).includes(value);
}

/**
 * Coerce a request value (number or numeric string) to an allowed interval.
 * Returns null for anything else, so callers answer 400 rather than guessing.
 */
export function parseIntervalHours(value: unknown): IntervalHours | null {
  let n: unknown = value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Number('') is 0, which would silently read as "turn the schedule off".
    if (trimmed === '') return null;
    n = Number(trimmed);
  }
  return isIntervalHours(n) ? n : null;
}

function normalise(row: any, form: FormKey): SheetLink {
  return {
    documentId: row?.documentId,
    form,
    spreadsheetId: row?.spreadsheetId || null,
    spreadsheetName: row?.spreadsheetName || null,
    tab: row?.tab || DEFAULT_TAB,
    enabled: row?.enabled !== false,
    intervalHours: isIntervalHours(row?.intervalHours) ? row.intervalHours : DEFAULT_INTERVAL_HOURS,
    lastSyncAt: row?.lastSyncAt ?? null,
    lastSyncOk: row?.lastSyncOk ?? null,
    lastSyncMessage: row?.lastSyncMessage ?? null,
    lastReconcileAt: isoOrNull(row?.lastReconcileAt),
  };
}

/** The stored link for a form, or a blank (unconnected) one. Never throws. */
export async function getLink(form: FormKey): Promise<SheetLink> {
  try {
    const row = await strapi.documents(LINK_UID).findFirst({ filters: { form } as any });
    return normalise(row, form);
  } catch {
    return normalise(null, form);
  }
}

export async function getAllLinks(): Promise<SheetLink[]> {
  return Promise.all(FORM_KEYS.map((f) => getLink(f)));
}

/** Create or update the link row for a form. Returns the stored state. */
export async function saveLink(form: FormKey, patch: Partial<Omit<SheetLink, 'form'>>): Promise<SheetLink> {
  const existing = await strapi.documents(LINK_UID).findFirst({ filters: { form } as any });
  const data: Record<string, unknown> = { form, ...patch };
  if (existing) {
    await strapi.documents(LINK_UID).update({ documentId: (existing as any).documentId, data: data as any });
  } else {
    await strapi.documents(LINK_UID).create({
      data: { tab: DEFAULT_TAB, enabled: true, ...data } as any,
    });
  }
  return getLink(form);
}

/** A form is syncable when it is enabled and has a spreadsheet connected. */
export function isConnected(link: SheetLink): boolean {
  return Boolean(link.spreadsheetId) && link.enabled;
}

/** The form's reconcile interval in hours. Falls back to the default. */
export async function getIntervalHours(form: FormKey): Promise<IntervalHours> {
  return (await getLink(form)).intervalHours;
}

/** Store a new reconcile interval. Throws on a value outside the allowed set. */
export async function setIntervalHours(form: FormKey, hours: unknown): Promise<SheetLink> {
  const value = parseIntervalHours(hours);
  if (value === null) {
    throw new Error(
      `intervalHours invalid: ${String(hours)} (permise: ${INTERVAL_HOURS_ALLOWED.join(', ')})`,
    );
  }
  return saveLink(form, { intervalHours: value });
}

/** When the periodic reconcile last ran, or null if it never has. */
export async function getLastReconcileAt(form: FormKey): Promise<string | null> {
  return (await getLink(form)).lastReconcileAt;
}

/**
 * Stamp a reconcile attempt. Called for failures too, so a form whose sheet
 * access was revoked does not retry on every single tick and flood the log.
 * Never throws: the stamp must not be able to break the cron loop.
 */
export async function stampReconcile(form: FormKey, at: string = new Date().toISOString()): Promise<void> {
  try {
    await saveLink(form, { lastReconcileAt: at });
  } catch (err) {
    strapi?.log?.warn?.(`[sheets] could not stamp lastReconcileAt: ${(err as Error)?.message ?? err}`);
  }
}

/**
 * Is a periodic reconcile due for this form right now?
 *
 * Pure on purpose: no clock, no database, so it can be exercised directly.
 *
 * `lastReconcileAt` is NOT `lastSyncAt`. Every sync stamps `lastSyncAt`,
 * including the instant flush after a single submission, so a due-check built
 * on it would be pushed forward by ordinary traffic and the periodic pass would
 * never fire. Only a reconcile run stamps `lastReconcileAt`.
 *
 * Rules: interval 0 means off; a form that never reconciled is due at once; an
 * unreadable stamp counts as never. RECONCILE_TOLERANCE_MS keeps an hourly tick
 * from slipping an hour a day (see the constant).
 */
export function isReconcileDue(
  intervalHours: number,
  lastReconcileAt: string | Date | null | undefined,
  now: Date,
): boolean {
  if (!Number.isFinite(intervalHours) || intervalHours <= 0) return false;
  if (!lastReconcileAt) return true;
  const last = lastReconcileAt instanceof Date ? lastReconcileAt.getTime() : Date.parse(lastReconcileAt);
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= intervalHours * 60 * 60 * 1000 - RECONCILE_TOLERANCE_MS;
}

/**
 * Record one sync attempt, refresh the link's last-sync summary, and prune the
 * form's history back to the most recent HISTORY_LIMIT rows. Never throws.
 */
export async function logSync(
  form: FormKey,
  trigger: SyncTrigger,
  counts: SyncCounts,
  ok: boolean,
  message?: string,
): Promise<void> {
  const at = new Date().toISOString();
  try {
    await strapi.documents(LOG_UID).create({
      data: {
        form,
        trigger,
        added: counts.added,
        updated: counts.updated,
        removed: counts.removed,
        ok,
        message: message ?? null,
        at,
      } as any,
    });
  } catch (err) {
    strapi?.log?.warn?.(`[sheets] could not write sync log: ${(err as Error)?.message ?? err}`);
  }

  try {
    await saveLink(form, { lastSyncAt: at, lastSyncOk: ok, lastSyncMessage: message ?? null });
  } catch {
    /* the summary is a convenience; never let it break a sync */
  }

  await pruneHistory(form);
}

/** Delete everything beyond the newest HISTORY_LIMIT rows for one form. */
async function pruneHistory(form: FormKey): Promise<void> {
  try {
    const rows = (await strapi.db.query(LOG_UID).findMany({
      where: { form },
      select: ['id'],
      orderBy: { at: 'desc', id: 'desc' },
      offset: HISTORY_LIMIT,
      limit: 1000,
    })) as Array<{ id: number }>;
    if (!rows.length) return;
    await strapi.db.query(LOG_UID).deleteMany({ where: { id: { $in: rows.map((r) => r.id) } } });
  } catch (err) {
    strapi?.log?.warn?.(`[sheets] history prune failed: ${(err as Error)?.message ?? err}`);
  }
}

export interface HistoryRow {
  form: FormKey;
  trigger: SyncTrigger;
  added: number;
  updated: number;
  removed: number;
  ok: boolean;
  message: string | null;
  at: string | null;
}

/** The newest history rows for a form, newest first. */
export async function getHistory(form: FormKey, limit = HISTORY_LIMIT): Promise<HistoryRow[]> {
  const capped = Math.max(1, Math.min(HISTORY_LIMIT, Math.floor(limit) || HISTORY_LIMIT));
  try {
    const rows = (await strapi.documents(LOG_UID).findMany({
      filters: { form } as any,
      sort: [{ at: 'desc' }, { id: 'desc' }] as any,
      limit: capped,
    })) as any[];
    return rows.map((r) => ({
      form: r.form,
      trigger: r.trigger,
      added: r.added ?? 0,
      updated: r.updated ?? 0,
      removed: r.removed ?? 0,
      ok: r.ok !== false,
      message: r.message ?? null,
      at: r.at ?? null,
    }));
  } catch {
    return [];
  }
}

/**
 * Back-compat: the pre-database setup kept the Înscrieri spreadsheet in
 * SHEETS_SPREADSHEET_ID / SHEETS_TAB_NAME. On boot, seed the Înscrieri link
 * from those vars if (and only if) no link row exists yet, so upgrading does
 * not silently drop the existing configuration.
 */
export async function seedLegacyLink(): Promise<void> {
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) return;
  try {
    const existing = await strapi.documents(LINK_UID).findFirst({ filters: { form: 'inscrieri' } as any });
    if (existing) return;
    const tab = process.env.SHEETS_TAB_NAME || DEFAULT_TAB;
    await saveLink('inscrieri', { spreadsheetId, tab, enabled: true });
    strapi.log.info(
      `[sheets] seeded Înscrieri link from legacy env SHEETS_SPREADSHEET_ID (${spreadsheetId}, tab "${tab}")`,
    );
  } catch (err) {
    strapi?.log?.warn?.(`[sheets] legacy link seed failed: ${(err as Error)?.message ?? err}`);
  }
}
