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
 */

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

export const yesNo = (v: unknown): string => (v === true ? 'Da' : v === false ? 'Nu' : '');
export const cellStr = (v: unknown): string => (v == null ? '' : String(v));
export const listStr = (v: unknown): string =>
  Array.isArray(v) ? v.map((x) => cellStr(x)).join(', ') : cellStr(v);

interface BuiltinCol {
  key: string;
  label: string;
  /** Drives BOTH how the cell renders and how the sheet formats it. */
  type?: ColumnType;
}

interface FormMeta {
  removedBuiltins: string[];
  customs: { key: string; label: string; type?: string }[];
}

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
    const meta = await strapi.service(FORM_CONFIG_UID).adminFormMeta(type as any);
    return {
      removedBuiltins: meta?.removedBuiltins ?? [],
      customs: meta?.customs ?? [],
    };
  } catch {
    // No config context: fall back to "nothing removed, no custom questions".
    return { removedBuiltins: [], customs: [] };
  }
}

/** Render a custom answer cell (booleans as Da/Nu, arrays comma-joined). */
function extraCell(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Da' : 'Nu';
  if (Array.isArray(v)) return listStr(v);
  return cellStr(v);
}

/**
 * Build the column plan for one form.
 *
 * `rows` is used only to discover custom answer keys that no longer exist in
 * the form config but still carry data — those become trailing "(eliminata)"
 * columns. Pass every row you are about to write so no answer is silently lost.
 */
async function buildPlan(type: string, builtins: BuiltinCol[], rows: RowLike[]): Promise<ColumnPlan> {
  const meta = await loadMeta(type);
  const removed = new Set(meta.removedBuiltins);
  const customByKey = new Map(meta.customs.map((c) => [c.key, c]));

  const extraKeys = new Set<string>();
  for (const r of rows) {
    const ex = r?.extra;
    if (ex && typeof ex === 'object') for (const k of Object.keys(ex)) extraKeys.add(k);
  }
  const activeCustomKeys = meta.customs.map((c) => c.key);
  const removedCustomKeys = [...extraKeys].filter((k) => !customByKey.has(k)).sort();
  const customCols: { key: string; label: string; type: ColumnType }[] = [
    ...activeCustomKeys.map((k) => ({
      key: k,
      label: customByKey.get(k)!.label,
      // A question whose type the config no longer reports is treated as text:
      // a wrong WIDTH is harmless, a wrong date parse would not be.
      type: CUSTOM_TYPES[String(customByKey.get(k)!.type ?? '')] ?? ('text' as ColumnType),
    })),
    // A removed question keeps its answers but no longer has a declared type.
    ...removedCustomKeys.map((k) => ({ key: k, label: `${k} (eliminata)`, type: 'text' as ColumnType })),
  ];

  const header = [
    'Trimis la',
    'Stare',
    ...builtins.map((c) => (removed.has(c.key) ? `${c.label} (eliminata)` : c.label)),
    ...customCols.map((c) => c.label),
    'ID',
  ];

  const types: ColumnType[] = [
    'datetime',
    'status',
    ...builtins.map((c) => c.type ?? 'text'),
    ...customCols.map((c) => c.type),
    'id',
  ];

  const row = (r: RowLike): string[] => {
    const ex = r?.extra && typeof r.extra === 'object' ? (r.extra as Record<string, unknown>) : {};
    return [
      cellStr(r?.submittedAt),
      cellStr(statusOf(type, r)),
      ...builtins.map((c) =>
        c.type === 'bool' ? yesNo(r?.[c.key]) : c.type === 'list' ? listStr(r?.[c.key]) : cellStr(r?.[c.key]),
      ),
      ...customCols.map((c) => extraCell(ex[c.key])),
      cellStr(r?.documentId),
    ];
  };

  return { header, types, row };
}

/** Contact submissions keep their state in `triageStatus`, not `status`. */
function statusOf(type: string, r: RowLike): unknown {
  return type === 'contact' ? (r?.triageStatus ?? r?.status) : r?.status;
}

const toMatrix = (plan: ColumnPlan, rows: RowLike[]): Matrix => ({
  header: plan.header,
  matrix: rows.map(plan.row),
});

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
