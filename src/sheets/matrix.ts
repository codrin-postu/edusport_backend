/**
 * The single source of truth for every form's export columns.
 *
 * Both the CSV export (`exportCsv` in each submission controller) and the
 * Google Sheets sync (`src/sheets/registry.ts`) build their columns here, so
 * the two can never drift apart again — the bug that motivated this module was
 * exactly that drift: the CSV had a dynamic header while the Sheets writer used
 * a stale 17-column static one.
 *
 * Every form's column set is: `Trimis la`, `Stare`, the built-in columns
 * (removed-from-form ones suffixed " (eliminata)"), the custom questions from
 * the form config (removed-but-with-data ones likewise suffixed), and finally
 * `ID` — the documentId, which is the sync key. The ID column is ALWAYS last.
 *
 * Înscrieri has two column sets, picked per season tab (`inscrieriTabPlans`):
 * today's, and the new registration form's (`script-form.ts`), which adds
 * `Nr. înscriere` before `Trimis la` and `Document` before `ID`.
 */

import type { FormType } from '../api/form-config/registry';
import { cellStr, extraCell, listStr, yesNo } from './cells';
import { isScriptFormRow, SCRIPT_FORM_COLS, SCRIPT_FORM_LEAD, SCRIPT_FORM_TAIL } from './script-form';

const FORM_CONFIG_UID = 'api::form-config.form-config' as const;

export interface RowLike {
  documentId?: string | null;
  status?: string | null;
  submittedAt?: string | null;
  extra?: Record<string, unknown> | null;
  [k: string]: unknown;
}

/**
 * What a column HOLDS, as opposed to what it is called.
 *
 * This is the second half of the "one source of truth" this module exists for:
 * the CSV export needs the labels, the Sheets sync needs the labels AND the
 * types — which columns are real dates (so they can be written as date values
 * rather than text), which one is the status (so it can be colour-coded), and
 * how wide each should be. Deriving both from the same plan is what keeps a
 * newly added custom question correctly typed in the sheet without touching
 * `sync.ts`.
 *
 *   datetime  an instant (submittedAt) — shown dd.mm.yyyy hh:mm, Europe/Bucharest
 *   date      a calendar date (a birth date) — shown dd.mm.yyyy, never shifted
 *   status    the workflow state; the colour-coded column
 *   email/tel contact details, only ever used to size the column
 *   text      a short free-text answer
 *   longtext  a paragraph (motivation, message, internal note)
 *   bool      rendered Da/Nu
 *   list      a json string array, rendered comma-joined
 *   link      an address, shown as "Deschide documentul" linking to it
 *   id        the documentId — always the last column, the sync key
 */
export type ColumnType =
  | 'datetime'
  | 'date'
  | 'status'
  | 'email'
  | 'tel'
  | 'text'
  | 'longtext'
  | 'bool'
  | 'list'
  | 'link'
  | 'id';

/** A resolved column set: the header, its types, plus how to render one document. */
export interface ColumnPlan {
  header: string[];
  /** One entry per header column, same order. */
  types: ColumnType[];
  row(doc: RowLike): string[];
}

export interface Matrix {
  header: string[];
  matrix: string[][];
}

/**
 * Column plans of a partitioned form, one per tab (Înscrieri: one tab per season).
 * `forTab` answers for any tab name; a tab with no rows in the database gets the default plan.
 */
export interface TabPlans {
  forTab(tab: string): ColumnPlan;
}

/** One plan for every tab (forms whose columns do not depend on the tab). */
export function singlePlan(plan: ColumnPlan): TabPlans {
  return { forTab: () => plan };
}

export { cellStr, listStr, yesNo } from './cells';

/** A fixed column: a row field, its header label, and how it is printed. */
export interface BuiltinCol {
  key: string;
  label: string;
  /** Drives BOTH how the cell renders and how the sheet formats it. */
  type?: ColumnType;
  /** A renderer for values that are not printed as stored (codes, relations, json). */
  cell?: (r: RowLike) => string;
}

/** Where the fixed columns go around the system columns and the custom questions. */
interface Layout {
  /** Before `Trimis la`. */
  lead: BuiltinCol[];
  /** After `Stare`; a built-in removed from the form config gets " (eliminata)". */
  builtins: BuiltinCol[];
  /** After the custom questions, before `ID`. */
  tail: BuiltinCol[];
}

interface FormMeta {
  removedBuiltins: string[];
  customs: { key: string; label: string; type?: string }[];
}

/** The header of the last column, which holds the documentId (the sync key). */
export const ID_LABEL = 'ID';

/**
 * A custom question's editor type -> the column type. The editor's list lives
 * in `src/api/form-config/registry.ts` (CUSTOM_QUESTION_TYPES); anything it
 * grows that is not mapped here falls back to a plain short text column.
 */
const CUSTOM_TYPES: Record<string, ColumnType> = {
  text: 'text',
  longtext: 'longtext',
  email: 'email',
  tel: 'tel',
  date: 'date',
  select: 'text',
  checkbox: 'bool',
};

async function loadMeta(type: string): Promise<FormMeta> {
  try {
    const meta = await strapi.service(FORM_CONFIG_UID).adminFormMeta(type as FormType);
    return {
      removedBuiltins: meta?.removedBuiltins ?? [],
      customs: meta?.customs ?? [],
    };
  } catch {
    // No config context: fall back to "nothing removed, no custom questions".
    return { removedBuiltins: [], customs: [] };
  }
}

const extraOf = (r: RowLike): Record<string, unknown> =>
  r?.extra && typeof r.extra === 'object' ? (r.extra as Record<string, unknown>) : {};

/** Render one fixed column for one row. */
function builtinCell(c: BuiltinCol, r: RowLike): string {
  if (c.cell) return c.cell(r);
  if (c.type === 'bool') return yesNo(r?.[c.key]);
  if (c.type === 'list') return listStr(r?.[c.key]);
  return cellStr(r?.[c.key]);
}

/**
 * The custom-question columns: every question in the form config, then the
 * answer keys found in `rows` that no longer have a question, as "(eliminata)".
 * A question whose type the config no longer reports is treated as text: a
 * wrong WIDTH is harmless, a wrong date parse would not be.
 */
function customColumns(meta: FormMeta, rows: RowLike[]): BuiltinCol[] {
  const byKey = new Map(meta.customs.map((c) => [c.key, c]));
  const answered = new Set(rows.flatMap((r) => Object.keys(extraOf(r))));
  const retired = [...answered].filter((k) => !byKey.has(k)).sort();
  const answer = (key: string) => (r: RowLike) => extraCell(extraOf(r)[key]);
  return [
    ...meta.customs.map((c) => {
      const q = byKey.get(c.key)!;
      return { key: q.key, label: q.label, type: CUSTOM_TYPES[String(q.type ?? '')] ?? 'text', cell: answer(q.key) };
    }),
    ...retired.map((k) => ({ key: k, label: `${k} (eliminata)`, type: 'text' as ColumnType, cell: answer(k) })),
  ];
}

/** `Trimis la` and `Stare`, the same on every form. */
function systemColumns(type: string): BuiltinCol[] {
  return [
    { key: 'submittedAt', label: 'Trimis la', type: 'datetime' },
    { key: 'status', label: 'Stare', type: 'status', cell: (r) => cellStr(statusOf(type, r)) },
  ];
}

/**
 * Build a column plan from an already loaded form config.
 *
 * `rows` is used only to discover custom answer keys that no longer exist in
 * the form config but still carry data; those become trailing "(eliminata)"
 * columns. Pass every row you are about to write so no answer is silently lost.
 */
function planFromMeta(type: string, layout: Layout, rows: RowLike[], meta: FormMeta): ColumnPlan {
  const removed = new Set(meta.removedBuiltins);
  const columns: BuiltinCol[] = [
    ...layout.lead,
    ...systemColumns(type),
    ...layout.builtins.map((c) => (removed.has(c.key) ? { ...c, label: `${c.label} (eliminata)` } : c)),
    ...customColumns(meta, rows),
    ...layout.tail,
    { key: 'documentId', label: ID_LABEL, type: 'id' },
  ];
  return {
    header: columns.map((c) => c.label),
    types: columns.map((c) => c.type ?? 'text'),
    row: (r) => columns.map((c) => builtinCell(c, r)),
  };
}

/** Build the column plan for one single-tab form (see `planFromMeta`). */
async function buildPlan(type: string, builtins: BuiltinCol[], rows: RowLike[]): Promise<ColumnPlan> {
  return planFromMeta(type, { lead: [], builtins, tail: [] }, rows, await loadMeta(type));
}

/** Contact submissions keep their state in `triageStatus`, not `status`. */
function statusOf(type: string, r: RowLike): unknown {
  return type === 'contact' ? (r?.triageStatus ?? r?.status) : r?.status;
}

const toMatrix = (plan: ColumnPlan, rows: RowLike[]): Matrix => ({
  header: plan.header,
  matrix: rows.map(plan.row),
});

/** Rows grouped by the tab they belong in, in their original order. */
function groupByTab(rows: RowLike[], tabFor: (doc: RowLike) => string): Map<string, RowLike[]> {
  const groups = new Map<string, RowLike[]>();
  for (const r of rows) {
    const tab = tabFor(r);
    const list = groups.get(tab);
    if (list) list.push(r);
    else groups.set(tab, [r]);
  }
  return groups;
}

/* ------------------------------------------------------------- Înscrieri */

// Built-in export columns, in the historic HEADER order (between the two meta
// columns and the trailing ID). `bool` fields render Da/Nu.
//
// NOTE `childBirthDate` is a plain string column in the schema (it predates the
// date type) but it always holds a calendar date, so it is typed `date` here —
// which is exactly what makes it sortable in the sheet instead of alphabetical.
export const INSCRIERI_COLS: BuiltinCol[] = [
  { key: 'childName', label: 'Nume copil' },
  { key: 'childBirthDate', label: 'Data nasterii', type: 'date' },
  { key: 'parentName', label: 'Nume parinte' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Telefon', type: 'tel' },
  { key: 'level', label: 'Nivel' },
  { key: 'shirtSize', label: 'Marime tricou' },
  { key: 'howHeard', label: 'Cum a aflat' },
  { key: 'clubInterest', label: 'Interes club', type: 'bool' },
  { key: 'regulationsAgreement', label: 'Acord regulament', type: 'bool' },
  { key: 'privacyConsent', label: 'Acord confidentialitate', type: 'bool' },
  { key: 'priorExperience', label: 'Experienta anterioara', type: 'longtext' },
  { key: 'expectations', label: 'Asteptari', type: 'longtext' },
  { key: 'internalNote', label: 'Nota interna', type: 'longtext' },
];

export const inscrieriPlan = (rows: RowLike[]) => buildPlan('inscriere', INSCRIERI_COLS, rows);

const INSCRIERI_LAYOUT: Layout = { lead: [], builtins: INSCRIERI_COLS, tail: [] };
const SCRIPT_FORM_LAYOUT: Layout = { lead: SCRIPT_FORM_LEAD, builtins: SCRIPT_FORM_COLS, tail: SCRIPT_FORM_TAIL };

/**
 * Înscrieri columns per season tab. A tab holding at least one row from the new
 * form (`isScriptFormRow`) gets the script-form columns, planned over its own
 * rows. Every other tab keeps today's columns, planned over the rows of those
 * tabs only, so a new season never changes an old tab. No season list.
 */
export async function inscrieriTabPlans(rows: RowLike[], tabFor: (doc: RowLike) => string): Promise<TabPlans> {
  const meta = await loadMeta('inscriere');
  const groups = [...groupByTab(rows, tabFor)];
  const scriptTabs = groups.filter(([, list]) => list.some(isScriptFormRow));
  const legacyRows = groups.filter(([, list]) => !list.some(isScriptFormRow)).flatMap(([, list]) => list);
  const legacy = planFromMeta('inscriere', INSCRIERI_LAYOUT, legacyRows, meta);
  const byTab = new Map(scriptTabs.map(([tab, list]) => [tab, planFromMeta('inscriere', SCRIPT_FORM_LAYOUT, list, meta)]));
  return { forTab: (tab) => byTab.get(tab) ?? legacy };
}

/* -------------------------------------------------------------- Voluntari */

// Romanian headers matching the admin column labels. `bool` renders Da/Nu,
// `list` joins the json string-array (helpAreas).
export const VOLUNTARI_COLS: BuiltinCol[] = [
  { key: 'fullName', label: 'Nume' },
  { key: 'birthDate', label: 'Data nasterii', type: 'date' },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'phone', label: 'Telefon', type: 'tel' },
  { key: 'city', label: 'Oras' },
  { key: 'occupation', label: 'Ocupatie' },
  { key: 'helpAreas', label: 'Cum ajuta', type: 'list' },
  { key: 'availability', label: 'Disponibilitate' },
  { key: 'frequency', label: 'Frecventa' },
  { key: 'skatingExperience', label: 'Experienta patinaj' },
  { key: 'childrenExperience', label: 'Experienta cu copiii', type: 'longtext' },
  { key: 'motivation', label: 'Motivatie', type: 'longtext' },
  { key: 'howHeard', label: 'Cum a aflat' },
  { key: 'parentName', label: 'Nume parinte' },
  { key: 'parentPhone', label: 'Telefon parinte', type: 'tel' },
  { key: 'parentalConsent', label: 'Acord parinti', type: 'bool' },
  { key: 'privacyConsent', label: 'Acord confidentialitate', type: 'bool' },
  { key: 'internalNote', label: 'Nota interna', type: 'longtext' },
];

export const voluntariPlan = (rows: RowLike[]) => buildPlan('voluntariat', VOLUNTARI_COLS, rows);

/* -------------------------------------------------------------- Parteneri */

export const PARTENERI_COLS: BuiltinCol[] = [
  { key: 'companyName', label: 'Companie' },
  { key: 'contactName', label: 'Persoana de contact' },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'phone', label: 'Telefon', type: 'tel' },
  { key: 'collaborationType', label: 'Tip colaborare' },
  { key: 'message', label: 'Mesaj', type: 'longtext' },
  { key: 'privacyConsent', label: 'Acord confidentialitate', type: 'bool' },
  { key: 'internalNote', label: 'Nota interna', type: 'longtext' },
];

export const parteneriPlan = (rows: RowLike[]) => buildPlan('parteneri', PARTENERI_COLS, rows);

/* ---------------------------------------------------------------- Contact */

export const CONTACT_COLS: BuiltinCol[] = [
  { key: 'name', label: 'Nume' },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'phone', label: 'Telefon', type: 'tel' },
  { key: 'reason', label: 'Motiv' },
  { key: 'message', label: 'Mesaj', type: 'longtext' },
  { key: 'internalNote', label: 'Nota interna', type: 'longtext' },
];

export const contactPlan = (rows: RowLike[]) => buildPlan('contact', CONTACT_COLS, rows);

/* --------------------------------------------- matrix helpers (CSV export) */

/** Înscrieri: dynamic header + matrix, as used by the CSV export. */
export async function buildInscrieriMatrix(rows: RowLike[]): Promise<Matrix> {
  return toMatrix(await inscrieriPlan(rows), rows);
}

/** Voluntari: dynamic header + matrix, as used by the CSV export. */
export async function buildVoluntariMatrix(rows: RowLike[]): Promise<Matrix> {
  return toMatrix(await voluntariPlan(rows), rows);
}
