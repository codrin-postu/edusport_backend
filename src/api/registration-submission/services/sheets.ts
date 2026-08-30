/**
 * Google Sheets export for registration submissions.
 *
 * Fully inert until configured: with no service-account env vars set, every
 * function returns a "not configured" result and never touches the network or
 * the `googleapis` module. This means the whole feature is safe to ship before
 * the Sheet + credentials exist — nothing breaks, nothing logs errors.
 *
 * Configure by setting all three env vars:
 *   GOOGLE_SA_EMAIL         service-account client email
 *   GOOGLE_SA_PRIVATE_KEY   service-account private key (literal \n allowed)
 *   SHEETS_SPREADSHEET_ID   target spreadsheet id
 * Optional:
 *   SHEETS_TAB_NAME         worksheet/tab name (default "Inscrieri")
 *
 * The `googleapis` package is required lazily so the app boots even if the
 * dependency is not installed yet; a missing module degrades to "not
 * configured" rather than crashing.
 */

export interface SubmissionLike {
  documentId?: string | null;
  email?: string | null;
  phone?: string | null;
  childName?: string | null;
  childBirthDate?: string | null;
  parentName?: string | null;
  shirtSize?: string | null;
  howHeard?: string | null;
  level?: string | null;
  priorExperience?: string | null;
  expectations?: string | null;
  clubInterest?: boolean | null;
  regulationsAgreement?: boolean | null;
  privacyConsent?: boolean | null;
  status?: string | null;
  internalNote?: string | null;
  submittedAt?: string | null;
  season?: string | null;
  archived?: boolean | null;
  /** Custom (admin-added) answers, keyed by custom question key. */
  extra?: Record<string, unknown> | null;
}

export interface SheetsResult {
  ok: boolean;
  configured: boolean;
  appended?: number;
  reason?: string;
  spreadsheetUrl?: string;
}

// Fixed column order for the exported row / header. Keep in sync with HEADER.
export const HEADER: string[] = [
  'Trimis la',
  'Stare',
  'Nume copil',
  'Data nasterii',
  'Nume parinte',
  'Email',
  'Telefon',
  'Nivel',
  'Marime tricou',
  'Cum a aflat',
  'Interes club',
  'Acord regulament',
  'Acord confidentialitate',
  'Experienta anterioara',
  'Asteptari',
  'Nota interna',
  'ID',
];

const yesNo = (v: unknown): string => (v === true ? 'Da' : v === false ? 'Nu' : '');
const s = (v: unknown): string => (v == null ? '' : String(v));

/** Build a single spreadsheet row (array of cells) in HEADER order. */
export function toRow(sub: SubmissionLike): string[] {
  return [
    s(sub.submittedAt),
    s(sub.status),
    s(sub.childName),
    s(sub.childBirthDate),
    s(sub.parentName),
    s(sub.email),
    s(sub.phone),
    s(sub.level),
    s(sub.shirtSize),
    s(sub.howHeard),
    yesNo(sub.clubInterest),
    yesNo(sub.regulationsAgreement),
    yesNo(sub.privacyConsent),
    s(sub.priorExperience),
    s(sub.expectations),
    s(sub.internalNote),
    s(sub.documentId),
  ];
}

interface SheetsConfig {
  email: string;
  privateKey: string;
  spreadsheetId: string;
  tab: string;
}

/** Read + validate env. Returns null when any required var is missing. */
function readConfig(): SheetsConfig | null {
  const email = process.env.GOOGLE_SA_EMAIL;
  const rawKey = process.env.GOOGLE_SA_PRIVATE_KEY;
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;
  if (!email || !rawKey || !spreadsheetId) return null;
  // Private keys pasted into .env usually carry literal "\n" sequences.
  const privateKey = rawKey.replace(/\\n/g, '\n');
  const tab = process.env.SHEETS_TAB_NAME || 'Inscrieri';
  return { email, privateKey, spreadsheetId, tab };
}

export function isConfigured(): boolean {
  return readConfig() !== null;
}

/** Build an authenticated Sheets client, or null if lib missing / auth fails. */
async function getSheetsClient(cfg: SheetsConfig): Promise<any | null> {
  try {
    // Lazy require so a missing dependency never breaks app boot.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { google } = require('googleapis');
    const auth = new google.auth.JWT({
      email: cfg.email,
      key: cfg.privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    await auth.authorize();
    return google.sheets({ version: 'v4', auth });
  } catch (err) {
    strapi?.log?.warn?.(`[sheets] client init failed: ${(err as Error)?.message ?? err}`);
    return null;
  }
}

const urlFor = (id: string) => `https://docs.google.com/spreadsheets/d/${id}`;

/** Append one or more submissions to the configured Sheet. Never throws. */
export async function appendSubmissions(subs: SubmissionLike[]): Promise<SheetsResult> {
  const cfg = readConfig();
  if (!cfg) return { ok: false, configured: false, reason: 'not_configured' };
  if (subs.length === 0) return { ok: true, configured: true, appended: 0, spreadsheetUrl: urlFor(cfg.spreadsheetId) };

  const sheets = await getSheetsClient(cfg);
  if (!sheets) return { ok: false, configured: true, reason: 'client_unavailable' };

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: cfg.spreadsheetId,
      range: `${cfg.tab}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: subs.map(toRow) },
    });
    return {
      ok: true,
      configured: true,
      appended: subs.length,
      spreadsheetUrl: urlFor(cfg.spreadsheetId),
    };
  } catch (err) {
    strapi?.log?.warn?.(`[sheets] append failed: ${(err as Error)?.message ?? err}`);
    return { ok: false, configured: true, reason: 'append_failed' };
  }
}

/**
 * Append arbitrary pre-built rows (array of string cells) to the configured
 * Sheet. Used by the dynamic results export, whose column set (built-in +
 * custom + removed-with-data) is computed by the caller. Never throws.
 */
export async function appendValues(values: string[][]): Promise<SheetsResult> {
  const cfg = readConfig();
  if (!cfg) return { ok: false, configured: false, reason: 'not_configured' };
  if (values.length === 0) {
    return { ok: true, configured: true, appended: 0, spreadsheetUrl: urlFor(cfg.spreadsheetId) };
  }
  const sheets = await getSheetsClient(cfg);
  if (!sheets) return { ok: false, configured: true, reason: 'client_unavailable' };
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: cfg.spreadsheetId,
      range: `${cfg.tab}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
    return { ok: true, configured: true, appended: values.length, spreadsheetUrl: urlFor(cfg.spreadsheetId) };
  } catch (err) {
    strapi?.log?.warn?.(`[sheets] append failed: ${(err as Error)?.message ?? err}`);
    return { ok: false, configured: true, reason: 'append_failed' };
  }
}

/** Convenience for the afterCreate lifecycle. Swallows everything. */
export async function appendOne(sub: SubmissionLike): Promise<void> {
  try {
    if (!isConfigured()) return;
    await appendSubmissions([sub]);
  } catch {
    /* inert on any failure */
  }
}
