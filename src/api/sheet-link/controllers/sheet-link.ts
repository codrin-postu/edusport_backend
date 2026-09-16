/**
 * Admin API for the Google Sheets integration, mounted under /api/sheets.
 *
 * Every route is admin-guarded (`global::is-admin`) — usable from the custom
 * admin settings page, never from the public API.
 *
 * Every failure carries a specific `reason`. `not_configured` (no credentials),
 * `client_unavailable` (credentials present but authentication failed),
 * `no_access` (the file exists but the service account cannot open it),
 * `not_found`, `invalid_link` and the per-operation `*_failed` reasons are all
 * distinct, because an operator cannot fix what they cannot tell apart.
 */
import { factories } from '@strapi/strapi';
import {
  createSpreadsheet,
  defaultShareWith,
  ensureTab,
  extractSpreadsheetId,
  getSpreadsheet,
  isConfigured,
  isDryRun,
  serviceAccountEmail,
  shareSpreadsheet,
  spreadsheetUrl,
} from '../../../sheets/client';
import { allForms, getForm, isFormKey } from '../../../sheets/registry';
import type { FormKey } from '../../../sheets/registry';
import {
  DEFAULT_TAB,
  INTERVAL_HOURS_ALLOWED,
  getAllLinks,
  getHistory,
  getLink,
  parseIntervalHours,
  saveLink,
  setIntervalHours,
} from '../../../sheets/store';
import { reconcile, resyncForm } from '../../../sheets/sync';

const trimOrEmpty = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Resolve and validate the :form param, or answer 400. */
function formParam(ctx: any): FormKey | null {
  const raw = trimOrEmpty(ctx.params?.form);
  if (!isFormKey(raw)) {
    ctx.status = 400;
    ctx.body = { ok: false, reason: 'unknown_form', message: `Formular necunoscut: „${raw}".` };
    return null;
  }
  return raw;
}

/** Human-readable explanation for a no-access failure, naming the robot account. */
function noAccessMessage(): string {
  const sa = serviceAccountEmail();
  return sa
    ? `Foaia există, dar contul de serviciu nu are acces. Dă-i drepturi de editor lui ${sa} din butonul „Distribuie" al foii.`
    : 'Contul de serviciu nu are acces la această foaie.';
}

/** The email of the admin making the request, read from the admin JWT. */
async function actingAdminEmail(ctx: any): Promise<string | null> {
  try {
    const auth = String(ctx.request?.header?.authorization ?? '');
    if (!auth.startsWith('Bearer ')) return null;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jwt = require('jsonwebtoken');
    const secret = strapi.config.get('admin.auth.secret');
    if (!secret) return null;
    const payload = jwt.verify(auth.slice(7), secret) as any;
    const id = payload?.userId ?? payload?.id ?? payload?.sub;
    if (!id) return null;
    const user = await strapi.db.query('admin::user').findOne({ where: { id }, select: ['email'] });
    return user?.email ?? null;
  } catch {
    return null;
  }
}

export default factories.createCoreController('api::sheet-link.sheet-link', () => ({
  /**
   * GET /api/sheets/status
   * The whole settings page in one call: credential state plus one entry per
   * form with its link, last-sync summary and how many rows the database holds.
   */
  async status(ctx) {
    const links = await getAllLinks();
    const byForm = new Map(links.map((l) => [l.form, l]));

    const forms = await Promise.all(
      allForms().map(async (desc) => {
        const link = byForm.get(desc.key)!;
        return {
          key: desc.key,
          label: desc.label,
          spreadsheetId: link.spreadsheetId,
          spreadsheetName: link.spreadsheetName,
          // `tab` is meaningless for a partitioned form — see the field's
          // comment in sheet-link/schema.json. When `partitioned` is true the
          // UI must not offer a tab name: the tabs are derived per row from
          // `partitionField`, with `fallbackTab` for rows that have no value.
          tab: link.tab,
          partitioned: Boolean(desc.partition),
          partitionField: desc.partition?.field ?? null,
          fallbackTab: desc.partition?.fallbackTab ?? null,
          enabled: link.enabled,
          // How often the periodic reconcile runs for this form, and when it
          // last ran. `lastReconcileAt` is not `lastSyncAt`: every sync stamps
          // the latter, including instant writes, so only the former tells the
          // operator when the catch-up pass actually happened.
          intervalHours: link.intervalHours,
          intervalHoursAllowed: INTERVAL_HOURS_ALLOWED,
          lastSyncAt: link.lastSyncAt,
          lastSyncOk: link.lastSyncOk,
          lastSyncMessage: link.lastSyncMessage,
          lastReconcileAt: link.lastReconcileAt,
          rowCountDb: await desc.count(),
        };
      }),
    );

    ctx.body = {
      credentials: isConfigured() ? 'ok' : 'missing',
      serviceAccountEmail: serviceAccountEmail(),
      dryRun: isDryRun(),
      forms,
    };
  },

  /**
   * POST /api/sheets/:form/verify   body { link }
   * Extract the id from a spreadsheet URL (or accept a bare id), then confirm
   * the service account can actually open it.
   */
  async verify(ctx) {
    const form = formParam(ctx);
    if (!form) return;

    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const spreadsheetId = extractSpreadsheetId(body.link);
    if (!spreadsheetId) {
      ctx.body = {
        ok: false,
        reason: 'invalid_link',
        message: 'Link invalid. Lipește adresa completă a foii sau doar ID-ul ei.',
      };
      return;
    }
    if (!isConfigured()) {
      ctx.body = {
        ok: false,
        reason: 'not_configured',
        message: 'Contul de serviciu Google nu este configurat (GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY).',
      };
      return;
    }

    const res = await getSpreadsheet(spreadsheetId);
    if (res.ok) {
      ctx.body = { ok: true, spreadsheetId, spreadsheetName: res.data!.title };
      return;
    }
    const reason = res.reason ?? 'read_failed';
    const message =
      reason === 'no_access'
        ? noAccessMessage()
        : reason === 'not_found'
          ? 'Nu există nicio foaie cu acest ID.'
          : reason === 'client_unavailable'
            ? 'Nu am putut autentifica contul de serviciu. Verifică GOOGLE_SA_EMAIL și GOOGLE_SA_PRIVATE_KEY.'
            : (res.message ?? 'Verificarea a eșuat.');
    ctx.body = { ok: false, reason, message, spreadsheetId };
  },

  /**
   * POST /api/sheets/:form/connect  body { spreadsheetId, spreadsheetName?, tab? }
   */
  async connect(ctx) {
    const form = formParam(ctx);
    if (!form) return;

    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const spreadsheetId = extractSpreadsheetId(body.spreadsheetId) ?? trimOrEmpty(body.spreadsheetId);
    if (!spreadsheetId) {
      ctx.body = { ok: false, reason: 'invalid_link', message: 'ID de foaie lipsă sau invalid.' };
      return;
    }
    const tab = trimOrEmpty(body.tab) || (await getLink(form)).tab || DEFAULT_TAB;
    const spreadsheetName = trimOrEmpty(body.spreadsheetName) || null;

    const link = await saveLink(form, {
      spreadsheetId,
      spreadsheetName,
      tab,
      enabled: body.enabled === undefined ? true : body.enabled !== false,
    });
    ctx.body = { ok: true, form, link, url: spreadsheetUrl(spreadsheetId) };
  },

  /**
   * POST /api/sheets/:form/create   body { title?, shareWith? }
   * Create a spreadsheet owned by the service account, share it as writer with
   * the requested address (or SHEETS_SHARE_WITH, or the acting admin), then
   * connect it. The file lives in the robot account's Drive, which is why the
   * share step is not optional.
   */
  async create(ctx) {
    const form = formParam(ctx);
    if (!form) return;
    if (!isConfigured()) {
      ctx.body = {
        ok: false,
        reason: 'not_configured',
        message: 'Contul de serviciu Google nu este configurat.',
      };
      return;
    }

    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const desc = getForm(form);
    const existing = await getLink(form);
    // A partitioned form has no fixed tab: name the new file's first worksheet
    // after its fallback tab so the resync below fills it instead of leaving a
    // stray empty "Date" sheet behind.
    const tab = desc.partition
      ? desc.partition.fallbackTab
      : trimOrEmpty(body.tab) || existing.tab || DEFAULT_TAB;
    const title = trimOrEmpty(body.title) || `EduSport — ${desc.label}`;

    const created = await createSpreadsheet(title, tab);
    if (!created.ok) {
      ctx.body = {
        ok: false,
        reason: created.reason ?? 'create_failed',
        message: created.message ?? 'Nu am putut crea foaia de calcul.',
      };
      return;
    }
    const { spreadsheetId, title: spreadsheetName } = created.data!;

    const shareWith = trimOrEmpty(body.shareWith) || defaultShareWith() || (await actingAdminEmail(ctx));
    let sharedWith: string | null = null;
    let shareWarning: string | null = null;
    if (shareWith) {
      const shared = await shareSpreadsheet(spreadsheetId, shareWith);
      if (shared.ok) sharedWith = shareWith;
      else shareWarning = `${shared.reason}: ${shared.message ?? ''}`.trim();
    }

    await saveLink(form, { spreadsheetId, spreadsheetName, tab, enabled: true });
    // Write the header immediately so the new file is not an empty grid.
    await resyncForm(form, 'manual');

    ctx.body = {
      ok: true,
      spreadsheetId,
      spreadsheetName,
      sharedWith,
      shareWarning,
      url: spreadsheetUrl(spreadsheetId),
    };
  },

  /**
   * POST /api/sheets/:form/disconnect
   * Clears the spreadsheet link. History is kept; the Sheet itself is untouched.
   */
  async disconnect(ctx) {
    const form = formParam(ctx);
    if (!form) return;
    const link = await saveLink(form, { spreadsheetId: null, spreadsheetName: null });
    ctx.body = { ok: true, form, link };
  },

  /**
   * POST /api/sheets/:form/sync   body { mode?: 'full' | 'reconcile' }
   * Default is a full rewrite (clear + header + every row) — this is also the
   * migration off the old append-only tab. `reconcile` runs the repair pass.
   */
  async sync(ctx) {
    const form = formParam(ctx);
    if (!form) return;
    const mode = trimOrEmpty((ctx.request.body as any)?.mode) || 'full';
    const result = mode === 'reconcile' ? await reconcile(form, 'manual') : await resyncForm(form, 'manual');
    ctx.body = {
      ok: result.ok,
      form,
      mode,
      added: result.added,
      updated: result.updated,
      removed: result.removed,
      skipped: result.skipped ?? false,
      reason: result.reason,
      message: result.message,
    };
  },

  /**
   * GET /api/sheets/:form/history?limit=100  — newest first.
   */
  async history(ctx) {
    const form = formParam(ctx);
    if (!form) return;
    const limit = Number((ctx.query as any)?.limit) || 100;
    ctx.body = { ok: true, form, history: await getHistory(form, limit) };
  },

  /**
   * POST /api/sheets/:form/tab   body { tab }
   * Rename the target worksheet. Kept separate from connect so the settings
   * page can change only the tab without re-verifying the link.
   */
  async setTab(ctx) {
    const form = formParam(ctx);
    if (!form) return;
    const desc = getForm(form);
    if (desc.partition) {
      // Tabs come from the rows themselves; accepting a name here would only
      // create a stray empty worksheet.
      ctx.body = {
        ok: false,
        reason: 'partitioned_form',
        message: `„${desc.label}" folosește câte o filă pe ${desc.partition.field} (implicit „${desc.partition.fallbackTab}" pentru rândurile fără valoare), deci nu are o filă fixă.`,
        link: await getLink(form),
      };
      return;
    }
    const tab = trimOrEmpty((ctx.request.body as any)?.tab) || DEFAULT_TAB;
    const link = await saveLink(form, { tab });
    if (link.spreadsheetId) await ensureTab(link.spreadsheetId, tab);
    ctx.body = { ok: true, form, link };
  },

  /**
   * POST /api/sheets/:form/enabled  body { enabled }
   */
  async setEnabled(ctx) {
    const form = formParam(ctx);
    if (!form) return;
    const enabled = (ctx.request.body as any)?.enabled !== false;
    const link = await saveLink(form, { enabled });
    ctx.body = { ok: true, form, link };
  },

  /**
   * POST /api/sheets/:form/schedule  body { intervalHours }
   * How often the periodic reconcile runs for this form. 0 turns it off; the
   * instant write on each submission keeps working either way.
   */
  async setSchedule(ctx) {
    const form = formParam(ctx);
    if (!form) return;
    const intervalHours = parseIntervalHours((ctx.request.body as any)?.intervalHours);
    if (intervalHours === null) {
      ctx.status = 400;
      ctx.body = {
        ok: false,
        reason: 'invalid_interval',
        message: `Interval invalid. Valori permise, în ore: ${INTERVAL_HOURS_ALLOWED.join(', ')}. 0 oprește verificarea periodică.`,
        link: await getLink(form),
      };
      return;
    }
    const link = await setIntervalHours(form, intervalHours);
    ctx.body = { ok: true, form, link };
  },
}));
