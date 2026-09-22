import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { ConfirmDialog } from '../ConfirmDialog';
import { SheetsDialog, type SheetsForm } from './SheetsDialog';

/**
 * EduSport admin — shared submission-results table.
 *
 * The full table machinery extracted from the original InscrieriPage so every
 * form-results screen (Înscrieri, Voluntari, ...) shares one implementation:
 * server-side list/filter/sort/pagination, quick search, the generic filter
 * builder ({col, op, val} JSON dialect), the Compact list + detail panel, the
 * "Toate coloanele" spreadsheet with per-user column show/hide + drag reorder
 * (localStorage), inline status editing, per-row delete, CSV export — plus the
 * optional (config-gated) seasons bar, archived view, Google Sheets export and
 * bulk actions used only by Înscrieri.
 *
 * There is no per-row archive button: the list is scoped to the active season
 * server-side, so moving a row to a past season is how a row is retired. See
 * `SubmissionTableCfg.archive` for what the flag still gates.
 *
 * Each screen supplies a `SubmissionTableCfg` describing its API base, status
 * palette, built-in columns, filterable columns, texts and the two
 * compact-view renderers. The dynamic union-column building (built-ins +
 * custom questions + orphan `extra` keys) is shared via `buildColumns`.
 *
 * Endpoints (relative to cfg.api):
 *   GET    cfg.api                    ?q&filters&sort&page&pageSize (&season&archived)
 *   PUT    cfg.api/:documentId        update editable field (status/season/note)
 *   DELETE cfg.api/:documentId        permanent delete
 *   GET    cfg.api/export.csv         CSV (respects current filters)
 *
 * Google Sheets is NOT an export any more: when `cfg.sheetsForm` is set the
 * Export menu drives the live connection through /api/sheets/* and the shared
 * SheetsDialog. The old one-shot `export-sheets` append was removed with it.
 *
 * Light-only, using the shared admin tokens (system-ui, #fff, #dcdcdc borders,
 * accent #2138b8, danger #be3330, #d0d0d0 fields, squared buttons; horizontal
 * row separators only).
 */

export const OPERATORS = [
  { key: 'contains', label: 'conține' },
  { key: 'equals', label: 'este' },
  { key: 'startsWith', label: 'începe cu' },
  { key: 'anyOf', label: 'este una din' },
  { key: 'on', label: 'în data de' },
  { key: 'before', label: 'înainte de' },
  { key: 'after', label: 'după' },
  { key: 'between', label: 'între' },
] as const;
// Which operators a date column offers. Previously a date was forced to
// `between`, so "everything sent on the 15th" could not be asked for at all.
const DATE_OPS = ['on', 'before', 'after', 'between'];
const OP_LABEL: Record<string, string> = Object.fromEntries(OPERATORS.map((o) => [o.key, o.label]));

export type ColType = 'date' | 'status' | 'level' | 'text' | 'bool' | 'longtext' | 'list';

export interface Row {
  documentId: string;
  status: string;
  archived?: boolean;
  season?: string | null;
  internalNote?: string | null;
  submittedAt: string | null;
  extra?: Record<string, unknown> | null;
  [k: string]: unknown;
}

export interface ColumnDef {
  key: string;
  label: string;
  type: ColType;
  readOnly?: boolean;
  width: number;
  custom?: boolean; // sourced from row.extra[extraKey]
  extraKey?: string;
  removed?: boolean; // removed from the form but still has data
  /** Optional custom cell renderer for a built-in column (spreadsheet view). */
  render?: (row: Row) => React.ReactNode;
}

export interface FormMeta {
  removedBuiltins: string[];
  customs: { key: string; label: string; type: string; step: string }[];
  selectOptions: Record<string, { value: string; label: string }[]>;
  extraKeys: string[];
}

export interface StatusDef {
  value: string;
  color: string;
  soft: string;
  border: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

// An active filter in the builder. `Arhivat` on the status column is the special
// "view archived" toggle and is not sent as a server column filter.
interface ActiveFilter {
  id: string;
  col: string;
  op: string;
  val: string;
  from?: string;
  to?: string;
}

interface ColConfig {
  order: string[];
  hidden: string[];
  /** `cfg.colConfigVersion` the stored order was written with. */
  v?: number;
}

/** Everything a compact-view renderer needs from the shared machinery. */
export interface TableApi {
  columns: ColumnDef[];
  formMeta: FormMeta;
  seasons: string[];
  activeSeason: string | null;
  statuses: StatusDef[];
  tagClassOf: (label: string) => string;
  statusTag: (r: Row) => React.ReactElement;
  saveField: (documentId: string, key: string, value: unknown) => void;
  removeRow: (documentId: string) => void;
  /** Shared detail-panel blocks — identical on every screen, so they live here. */
  statusBox: (r: Row) => React.ReactNode;
  /** Season <select> for the detail panel; null when the screen has no seasons. */
  seasonField: (r: Row) => React.ReactNode;
  /** Custom-question answers read out of `row.extra`; null when there are none. */
  customFields: (r: Row) => React.ReactNode;
  internalNoteField: (r: Row) => React.ReactNode;
}

export interface SubmissionTableCfg {
  /** Admin endpoint base, e.g. '/api/forms/inscrieri'. */
  api: string;
  /** localStorage key prefix for the per-user column config: `${prefix}-${userKey}`. */
  storagePrefix: string;
  /**
   * Bump this whenever `builtinColumns` changes its default ORDER. A stored
   * config carrying a different version keeps the user's show/hide choices but
   * drops the stored order, so everyone picks up the new default positions
   * instead of being frozen on the order saved by an older build.
   */
  colConfigVersion?: number;
  /** CSV download file prefix: `${csvPrefix}-YYYY-MM-DD.csv`. */
  csvPrefix: string;
  /** Editable status values + palette (select options everywhere). */
  statuses: StatusDef[];
  /** Display-only status tags (e.g. Arhivat) — styled but never selectable. */
  extraTags?: StatusDef[];
  /** Built-in columns of the spreadsheet view, in default order. */
  builtinColumns: ColumnDef[];
  /** Column keys that map to removable registry questions ("(eliminată)" handling). */
  registryColKeys: string[];
  /** Column keys hidden by default (before the user saves a preference). */
  defaultHidden?: string[];
  /** Columns the filter builder may target (whitelisted server-side too). */
  filterColumns: readonly { key: string; label: string }[];
  /**
   * Columns that get their own dropdown button in the toolbar, in display order.
   * Everything else stays in the "Alte filtre" panel. Kept short on purpose:
   * Voluntari has six select columns, and one button each turned the toolbar
   * into a wall. Defaults to the status column alone.
   */
  quickFilterCols?: readonly string[];
  /** Fallback value lists for select-driven filter columns (when formMeta has none). */
  filterSelectFallback?: Record<string, string[]>;
  /** Feature gates. */
  /** Season bar, per-row season select, bulk "move to season", move-whole-season. */
  seasons?: boolean;
  /**
   * The ARCHIVED VIEW, not a per-row control. There is no per-row archive button
   * any more: the list is scoped to the active season server-side, so moving a
   * row to a past season is how a row is retired. This flag still gates the
   * `archived` query param (the list/stat/export default to non-archived), the
   * "Arhivat" pseudo-status in the filter builder that switches to the archived
   * view, the "Arhivat" tag, and the bulk archive action. `archived` itself and
   * the season-level archive/delete endpoints are untouched by it.
   */
  archive?: boolean;
  /**
   * Google Sheets form key. When set, the Export menu shows the live-connection
   * entries and opens the shared SheetsDialog. Unset means no Sheets UI at all.
   */
  sheetsForm?: SheetsForm;
  bulk?: boolean;
  texts: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    empty: string;
    loadError: string;
    /** Appended after the "X noi" stat, e.g. ' · exclus arhivate'. */
    statSuffix: string;
    deleteConfirm: string;
    /**
     * Plural noun for the bulk-delete confirmation, e.g. 'înscrieri'. This table
     * is shared by Înscrieri and Voluntari, so the noun must come from config.
     */
    bulkDeleteNoun: string;
    deleteError: string;
    saveError: string;
  };
  compact: {
    /** Column headers of the compact list (between the checkbox and actions). */
    headers: string[];
    /** The compact list row cells (the <td>s matching `headers`). */
    renderCells: (row: Row, api: TableApi) => React.ReactNode;
    /** The detail panel content (header + body + footer) for the selected row. */
    renderDetail: (row: Row, api: TableApi) => React.ReactNode;
  };
  /** Extra CSS appended after the shared stylesheet (screen-specific bits). */
  extraCss?: string;
}

// Map a custom question type to a display column type.
const customColType = (t: string): ColType => (t === 'checkbox' ? 'bool' : t === 'longtext' ? 'longtext' : 'text');
const customColWidth = (t: string): number => (t === 'longtext' ? 240 : t === 'checkbox' ? 110 : 170);

/**
 * Build the full union column set: built-in columns (removed-from-form ones get
 * a "(eliminată)" suffix + read-only) followed by custom columns (active first,
 * then removed-from-config keys that still have data anywhere).
 */
export function buildColumns(meta: FormMeta, builtinColumns: ColumnDef[], registryColKeys: string[]): ColumnDef[] {
  const registry = new Set(registryColKeys);
  const removed = new Set(meta.removedBuiltins ?? []);
  const builtin = builtinColumns.map((c) =>
    registry.has(c.key) && removed.has(c.key)
      ? { ...c, label: `${c.label} (eliminată)`, readOnly: true, removed: true }
      : c,
  );
  const customByKey = new Map((meta.customs ?? []).map((c) => [c.key, c]));
  const activeCustom: ColumnDef[] = (meta.customs ?? []).map((c) => ({
    key: `x_${c.key}`,
    extraKey: c.key,
    label: c.label,
    type: customColType(c.type),
    width: customColWidth(c.type),
    custom: true,
    readOnly: true,
  }));
  const removedCustom: ColumnDef[] = (meta.extraKeys ?? [])
    .filter((k) => !customByKey.has(k))
    .sort()
    .map((k) => ({
      key: `x_${k}`,
      extraKey: k,
      label: `${k} (eliminată)`,
      type: 'text' as ColType,
      width: 170,
      custom: true,
      readOnly: true,
      removed: true,
    }));
  return [...builtin, ...activeCustom, ...removedCustom];
}

const RO_MON_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
export function fmtDateTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${RO_MON_SHORT[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** Short relative stamp for the Export menu: "azi 16:00", "ieri 23:14", "14 sep 08:00". */
function fmtSheetWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const today = new Date();
  if (sameDay(d, today)) return `azi ${time}`;
  if (sameDay(d, new Date(today.getTime() - 86400000))) return `ieri ${time}`;
  return `${d.getDate()} ${RO_MON_SHORT[d.getMonth()]} ${time}`;
}

export function fmtDateShort(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getDate()} ${RO_MON_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** Human text for an arbitrary custom-answer value (detail panel + cells). */
export function extraValueText(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Da' : 'Nu';
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * Season picker. A real <select> everywhere a season is chosen — a free-text
 * field silently created phantom seasons, and a season is now how a row is
 * retired (the list defaults to the active season server-side), so a typo would
 * quietly lose rows. Options are the seasons the API returned plus the active
 * season plus `value` itself (so a legacy/typo row keeps its own value and
 * simply opening it never rewrites the season), deduped and sorted descending.
 */
export function SeasonSelect({
  value,
  seasons,
  activeSeason,
  onChange,
  emptyLabel,
  style,
  disabled,
}: {
  value: string;
  seasons: string[];
  activeSeason?: string | null;
  onChange: (next: string) => void;
  emptyLabel?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  const options = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of seasons) if (s) set.add(s);
    if (activeSeason) set.add(activeSeason);
    if (value) set.add(value);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [seasons, activeSeason, value]);
  return (
    <select value={value} disabled={disabled} style={style} onChange={(e) => onChange(e.target.value)}>
      <option value="">{emptyLabel ?? '— fără sezon —'}</option>
      {options.map((s) => (
        <option key={s} value={s}>
          {s}
          {s === activeSeason ? ' (activ)' : ''}
        </option>
      ))}
    </select>
  );
}

/** CSS class suffix for a status value, e.g. 'Nou' -> 't-nou'. */
const tagClassOfValue = (v: string): string => `t-${v.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

// Raw load of the saved column config. It is reconciled against the dynamic
// column set (built-in + custom + removed) by an effect once the columns load.
function loadColConfig(cfg: SubmissionTableCfg, userKey: string): ColConfig {
  const v = cfg.colConfigVersion ?? 0;
  try {
    const raw = localStorage.getItem(`${cfg.storagePrefix}-${userKey}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ColConfig>;
      const storedV = typeof parsed.v === 'number' ? parsed.v : 0;
      // The default column order changed in code since this config was saved:
      // drop the stored order (the reconcile effect refills it from
      // `defaultOrder`) but keep the user's show/hide choices.
      if (storedV !== v) return { order: [], hidden: parsed.hidden ?? [...(cfg.defaultHidden ?? [])], v };
      return { order: parsed.order ?? [], hidden: parsed.hidden ?? [], v };
    }
  } catch {
    /* ignore */
  }
  return { order: [], hidden: [...(cfg.defaultHidden ?? [])], v };
}
function saveColConfig(cfg: SubmissionTableCfg, userKey: string, colCfg: ColConfig) {
  try {
    const payload: ColConfig = { order: colCfg.order, hidden: colCfg.hidden, v: cfg.colConfigVersion ?? 0 };
    localStorage.setItem(`${cfg.storagePrefix}-${userKey}`, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

const CSS = `
.insp{--bg:#eef0f4;--chrome:#fff;--ink:#1b1d22;--muted:#727888;--line:#e0e2e8;--border:#dcdcdc;
  --accent:#2138b8;--accent-soft:#eef1fb;--danger:#be3330;--field:#f7f8fa;--r:5px;--r2:4px;
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--bg);min-height:100%;padding:20px;box-sizing:border-box;line-height:1.5}
.insp *{box-sizing:border-box}
.insp .num{font-variant-numeric:tabular-nums}

.insp .win{background:var(--chrome);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 16px rgba(20,26,54,.06);overflow:hidden}
.insp input,.insp select{font-family:inherit;font-size:13px;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:var(--r);padding:7px 9px}
.insp input:focus,.insp select:focus{outline:none;border-color:var(--accent)}
.insp .lbl{font-size:11px;color:var(--muted);font-weight:600}

.btn{font-family:inherit;font-size:12.5px;font-weight:600;padding:7px 12px;border-radius:var(--r);border:1px solid var(--line);background:var(--chrome);color:var(--ink);cursor:pointer;white-space:nowrap}
.btn:hover{border-color:#b6bac4;background:#fafbff}
.btn.pri{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.pri:hover{background:#1b2fa0}
.btn.sm{padding:6px 10px;font-size:12px}
.btn:disabled{opacity:.55;cursor:default}
.btn.danger{color:var(--danger);border-color:#e2c4c4;background:#fff}
.btn.danger:hover{background:#fdf4f3}

/* header */
.hd{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid var(--line)}
.hd h1{margin:0;font-size:19px;font-weight:800;letter-spacing:-.01em}
.hd p{margin:3px 0 0;font-size:12.5px;color:var(--muted)}
.hd-right{display:flex;align-items:center;gap:14px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end}
.season{display:flex;align-items:center;gap:7px}
.stat{text-align:right;font-size:12px;color:var(--muted);white-space:nowrap}
.stat b{color:var(--ink);font-size:15px}
.stat .noi{color:var(--danger);font-weight:700}

/* toolbar A */
.tbA{display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.search{flex:1;min-width:200px;display:flex;align-items:center;gap:7px;background:var(--field);border:1px solid var(--line);border-radius:var(--r);padding:7px 10px;color:var(--muted);font-size:13px}
.search input{border:none;background:none;outline:none;width:100%;color:var(--ink);font-size:13px;padding:0}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
.seg button{font-family:inherit;font-size:12.5px;padding:7px 12px;cursor:pointer;color:var(--muted);border:none;border-right:1px solid var(--line);background:var(--chrome)}
.seg button:last-child{border-right:none}
.seg button.on{background:var(--accent);color:#fff;font-weight:600}

/* quick filter dropdowns */
.qfwrap{position:relative;display:inline-block}
.btn.qf.on{border-color:#2138b8;color:#2138b8;background:#f4f6fd}
.qfpop{position:absolute;left:0;top:calc(100% + 6px);width:210px}
.qfpop .prow{cursor:pointer}
.qfpop .prow span{font-size:12.5px;color:#32324d}
.advpop{position:absolute;left:0;top:calc(100% + 6px);width:auto;min-width:430px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px}
.advpop .lbl{width:100%}
.qffoot{display:flex;justify-content:flex-end;border-top:1px solid var(--line);margin-top:5px;padding-top:5px}

/* toolbar B */
.fvals{display:inline-flex;gap:4px;flex-wrap:wrap;align-items:center}
.fval{display:inline-flex;align-items:center;gap:5px;border:1px solid #d0d0d0;background:#fff;padding:3px 8px;font-size:11.5px;color:#32324d;cursor:pointer;user-select:none}
.fval.on{border-color:#2138b8;color:#2138b8;background:#f4f6fd}
.fval input{margin:0;width:auto}
.tbB{display:flex;align-items:center;gap:9px;padding:11px 18px;border-bottom:1px solid var(--line);flex-wrap:wrap;background:#fbfbfc}
.tbB .grow{flex:1}
.fchips{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:10px 18px 12px;border-bottom:1px solid var(--line)}
.fchip{display:inline-flex;align-items:center;gap:7px;background:var(--accent-soft);color:var(--accent);border:1px solid #cdd6f6;border-radius:var(--r2);padding:4px 9px;font-size:12px;font-weight:600}
.fchip .x{cursor:pointer;opacity:.7;border:none;background:none;color:inherit;font-size:12px;padding:0;line-height:1}
.fchip .x:hover{opacity:1}
.fclear{border:none;background:none;color:var(--muted);font-family:inherit;font-size:11.5px;cursor:pointer;padding:2px 4px}
.fclear:hover{color:var(--accent);text-decoration:underline}

/* message banner */
.insp-msg{font-size:12px;padding:8px 11px;border-radius:var(--r2);margin:12px 18px 0}
.insp-msg.ok{color:#1f7a4d;background:#e7f3ec;border:1px solid #bfe0cc}
.insp-msg.warn{color:#8a5a00;background:#fbf1df;border:1px solid #ecd9ac}
.insp-msg.err{color:#be3330;background:#faeceb;border:1px solid #e6c3c1}

.insp-empty{padding:44px 16px;text-align:center;color:var(--muted);font-size:13.5px}

/* status tag (uniform width) */
.tag{display:inline-block;min-width:96px;text-align:center;font-size:11px;font-weight:700;border-radius:var(--r2);padding:4px 0}
/* status selects tinted by value, same palette as the tags */
select.sel-status{font-weight:700}
.lvchip{font-size:11px;color:var(--muted);border:1px solid var(--line);border-radius:var(--r2);padding:2px 7px;display:inline-block}

/* compact split */
.insp-split{display:grid;grid-template-columns:1fr 360px;gap:0}
@media (max-width:1040px){.insp-split{grid-template-columns:1fr}}
.clist{border-collapse:collapse;width:100%;font-size:13px}
.clist th{text-align:left;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);font-weight:700;padding:10px 14px;border-bottom:1px solid var(--line);white-space:nowrap}
.clist td{padding:10px 14px;border-bottom:1px solid #f0f1f4;vertical-align:middle;white-space:nowrap}
.clist tr{cursor:pointer}
.clist tbody tr:hover td{background:#fafbff}
.clist tr.sel td{background:var(--accent-soft)}
.clist .nm{font-weight:600}
.clist .actcell{text-align:right;width:1%}
.rowacts{display:inline-flex;gap:6px;opacity:0}
.clist tr:hover .rowacts,.clist tr.sel .rowacts{opacity:1}
.ra{font-size:11.5px;color:var(--muted);cursor:pointer;border:1px solid var(--line);border-radius:var(--r2);padding:3px 8px;background:#fff}
.ra:hover{border-color:#b6bac4}
.ra.del{color:var(--danger);border-color:#e2c4c4}

/* detail panel */
.panel{border-left:1px solid var(--line);background:#fcfcfd}
@media (max-width:1040px){.panel{border-left:none;border-top:1px solid var(--line)}}
.panel .ph{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border-bottom:1px solid var(--line)}
.panel .ph b{font-size:14.5px}
.panel .pb{padding:14px 15px;max-height:calc(100vh - 340px);min-height:200px;overflow-y:auto}
.fld{margin-bottom:11px}
.fld label{display:block;font-size:10px;color:var(--muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em}
.statusbox{margin:0 0 14px;padding:11px 12px;border:1px solid #cdd6f6;background:var(--accent-soft);border-radius:var(--r);border-left:4px solid var(--accent)}
.statusbox label{display:block;font-size:10px;color:var(--accent);margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em;font-weight:800}
.statusbox select{width:100%;font-size:14px;font-weight:700;padding:8px 10px}
.fld .v{font-size:13px;color:var(--ink);margin-top:2px;white-space:pre-wrap;word-break:break-word}
.fld select,.fld textarea{width:100%}
.fld textarea{font-family:inherit;font-size:13px;border:1px solid var(--line);border-radius:var(--r2);padding:7px 9px;resize:vertical;background:var(--field)}
.fld textarea:focus{outline:none;border-color:var(--accent)}
.pa{padding:12px 15px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:8px}

/* spreadsheet */
.sheetwrap{overflow-x:auto;background:#fff}
/* macOS overlay scrollbars float ON TOP of the content, hiding the last row.
   The gutter is added only while the table actually overflows horizontally
   (class toggled from a ResizeObserver), so a table that fits keeps no gap. */
.sheetwrap.xscroll{padding-bottom:14px}
.sheet{border-collapse:separate;border-spacing:0;font-size:12.5px;width:100%}
.sheet th,.sheet td{border-bottom:1px solid #f0f1f4;padding:0}
.sheet th{background:#f6f7f9;text-align:left;font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:#6a6e7a;font-weight:700;padding:8px 10px;white-space:nowrap;position:sticky;top:0;z-index:2}
.sheet td select{width:100%;border:none;background:transparent;font-family:inherit;font-size:12.5px;padding:8px 10px;color:var(--ink)}
.sheet td .cellv{display:block;padding:8px 10px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sheet td select:focus{outline:2px solid var(--accent);outline-offset:-2px;background:#fff}
.sheet td.boolc{text-align:center}
.sheet td.acts{text-align:right;white-space:nowrap;padding:0 8px}
.sheet tr:hover td{background:#fafbff}
.sheet .frz{position:sticky;left:0;z-index:3;background:#fff;border-right:1px solid var(--border);box-shadow:1px 0 0 #ececf0}
.sheet th.frz{z-index:4;background:#f6f7f9}

/* footer */
.ft{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 18px;border-top:1px solid var(--line);flex-wrap:wrap}
.ft .l{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)}
.pager{display:flex;gap:4px;flex-wrap:wrap}
.pg{min-width:26px;height:26px;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:var(--r2);font-size:12px;color:var(--muted);cursor:pointer;background:#fff}
.pg:hover{border-color:#b6bac4}
.pg.on{background:var(--accent);color:#fff;border-color:var(--accent);font-weight:700}
.pg:disabled{opacity:.45;cursor:default}

/* popover / menu */
.popwrap{position:relative}
.pop{position:absolute;right:0;top:calc(100% + 6px);z-index:20;width:288px;background:#fff;border:1px solid var(--border);border-radius:var(--r);box-shadow:0 8px 28px rgba(0,0,0,.14);padding:8px}
.pop.pop-fixed{position:fixed;top:auto;right:auto;z-index:5000}
.pop h4{margin:4px 6px 8px;font-size:11px;line-height:1.35;color:var(--muted);font-weight:700}
.pop-body{max-height:320px;overflow-y:auto}
.pop .prow{display:flex;align-items:center;gap:8px;padding:6px;border-radius:var(--r2);border:1px solid transparent}
.pop .prow:hover{background:#f6f7f9}
.pop .prow.drag{opacity:.5}
.pop .prow.over{border-color:var(--accent);background:var(--accent-soft)}
.pop .prow .grip{cursor:grab;color:#b6bac4;font-size:13px;line-height:1;user-select:none;padding:0 2px;flex-shrink:0}
.pop .prow input{width:auto;margin:0;flex-shrink:0}
.pop .prow span.plbl{flex:1;font-size:12.5px}
.pop-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 4px 2px;margin-top:6px;border-top:1px solid var(--line)}
.pop-foot .reset{border:none;background:none;color:#4a4d59;font-family:inherit;font-size:11.5px;cursor:pointer;padding:4px}
.pop-foot .reset:hover{color:var(--accent);text-decoration:underline}
.menu{position:absolute;right:0;top:calc(100% + 6px);z-index:20;width:260px;background:#fff;border:1px solid var(--border);border-radius:var(--r);box-shadow:0 8px 28px rgba(0,0,0,.14);padding:5px}
.menu button{display:block;width:100%;text-align:left;font-family:inherit;font-size:12.5px;color:var(--ink);background:none;border:none;padding:8px 10px;border-radius:var(--r2);cursor:pointer}
.menu button:hover{background:#f6f7f9}
.menu button:disabled{opacity:.55;cursor:default}
.menu button .sub{display:block;font-size:11px;color:var(--muted);margin-top:2px}
.menu button.warn{color:#8a5a00}
.menu .sep{height:1px;background:var(--line);margin:4px 0}
.menu .grp{padding:8px 10px 3px;font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#a3a6b2}

/* bulk action bar + selection checkboxes */
.bulkbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid var(--line);background:var(--accent-soft)}
.bulkbar .bcount{font-size:12.5px;font-weight:700;color:var(--accent)}
.bulkbar .grow{flex:1}
.bulkbar input,.bulkbar select{background:#fff}
.chk{width:15px;height:15px;cursor:pointer;accent-color:var(--accent)}
.clist th.chkc,.clist td.chkc{width:1%;padding-right:0;text-align:center}

/* move-whole-season dialog */
.mws-back{position:fixed;inset:0;background:rgba(20,26,54,.28);z-index:60;display:flex;align-items:center;justify-content:center;padding:16px}
.mws{width:380px;max-width:100%;background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,.22);overflow:hidden}
.mws h3{margin:0;padding:14px 16px;font-size:15px;font-weight:800;border-bottom:1px solid var(--line)}
.mws .mbody{padding:14px 16px;display:flex;flex-direction:column;gap:12px}
.mws .mrow label{display:block;font-size:10px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em}
.mws .mrow input[type=text],.mws .mrow .ro{width:100%}
.mws .ro{font-size:13px;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:var(--r);padding:7px 9px}
.mws .chkrow{display:flex;align-items:center;gap:8px;font-size:13px}
.mws .chkrow input{width:auto}
.mws .foot{padding:12px 16px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:8px}
`;

/** Per-status tag + tinted-select rules generated from the config palette. */
function statusCss(defs: StatusDef[]): string {
  return defs
    .map((s) => {
      const k = tagClassOfValue(s.value);
      return `.${k}{color:${s.color};background:${s.soft}}
select.sel-status.${k}{color:${s.color};background:${s.soft};border-color:${s.border}}`;
    })
    .join('\n');
}

export default function SubmissionTablePage({ cfg }: { cfg: SubmissionTableCfg }) {
  const { get, put, del, post } = useFetchClient();

  const allTags = React.useMemo(() => [...cfg.statuses, ...(cfg.extraTags ?? [])], [cfg]);
  const tagClassByValue = React.useMemo(
    () => Object.fromEntries(allTags.map((s) => [s.value, tagClassOfValue(s.value)])) as Record<string, string>,
    [allTags],
  );
  const tagClassOf = React.useCallback(
    (label: string) => tagClassByValue[label] ?? tagClassOfValue(cfg.statuses[0].value),
    [tagClassByValue, cfg],
  );
  const colLabel = React.useMemo(
    () => Object.fromEntries(cfg.filterColumns.map((c) => [c.key, c.label])) as Record<string, string>,
    [cfg],
  );
  const statusFilterValues = React.useMemo(
    () => [...cfg.statuses.map((s) => s.value), ...(cfg.archive ? ['Arhivat'] : [])],
    [cfg],
  );
  const fullCss = React.useMemo(
    () => `${CSS}\n${statusCss(allTags)}\n${cfg.extraCss ?? ''}`,
    [allTags, cfg],
  );

  const [userKey, setUserKey] = React.useState<string>('anon');
  const [rows, setRows] = React.useState<Row[]>([]);
  const [pagination, setPagination] = React.useState<Pagination>({ page: 1, pageSize: 25, total: 0, pageCount: 1 });
  const [seasons, setSeasons] = React.useState<string[]>([]);
  const [activeSeason, setActiveSeason] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  // stat overview for the current view (current season, non-archived)
  const [seasonStat, setSeasonStat] = React.useState<{ total: number | null; noi: number | null }>({
    total: null,
    noi: null,
  });

  const [view, setView] = React.useState<'compact' | 'full'>('compact');

  // --- server query state
  const [season, setSeason] = React.useState<string>(''); // '' => server default (active)
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [filters, setFilters] = React.useState<ActiveFilter[]>([]);
  const [sort, setSort] = React.useState<'newest' | 'oldest' | 'name'>('newest');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [reloadTick, setReloadTick] = React.useState(0);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // filter-builder draft
  const [dCol, setDCol] = React.useState(cfg.filterColumns[0].key);
  // Values ticked for a column that has a fixed option list. Several of them
  // mean "any of these", which is what the table could not express before.
  const [dVals, setDVals] = React.useState<string[]>([]);
  const [dOp, setDOp] = React.useState('contains');
  const [dVal, setDVal] = React.useState('');
  const [dFrom, setDFrom] = React.useState('');
  const [dTo, setDTo] = React.useState('');

  // union-column metadata (removed built-ins, custom questions, select options)
  const [formMeta, setFormMeta] = React.useState<FormMeta>({
    removedBuiltins: [],
    customs: [],
    selectOptions: {},
    extraKeys: [],
  });
  const columns = React.useMemo(
    () => buildColumns(formMeta, cfg.builtinColumns, cfg.registryColKeys),
    [formMeta, cfg],
  );
  const colByKey = React.useMemo(
    () => Object.fromEntries(columns.map((c) => [c.key, c])) as Record<string, ColumnDef>,
    [columns],
  );
  const defaultOrder = React.useMemo(() => columns.map((c) => c.key), [columns]);

  // full-view column config
  const [colCfg, setColCfg] = React.useState<ColConfig>(() => loadColConfig(cfg, 'anon'));
  const [popOpen, setPopOpen] = React.useState(false);
  const colBtnRef = React.useRef<HTMLButtonElement>(null);
  const [popPos, setPopPos] = React.useState<{ top: number; right: number } | null>(null);
  // Which quick-filter dropdown is open, by column key.
  const [quickOpen, setQuickOpen] = React.useState<string | null>(null);
  const [advOpen, setAdvOpen] = React.useState(false);
  const openColPop = React.useCallback(() => {
    setPopOpen((o) => {
      const next = !o;
      if (next && colBtnRef.current) {
        const r = colBtnRef.current.getBoundingClientRect();
        setPopPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
      }
      return next;
    });
  }, []);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [dragKey, setDragKey] = React.useState<string | null>(null);
  const [overKey, setOverKey] = React.useState<string | null>(null);

  // Spreadsheet scroll container: `xscroll` adds a bottom gutter only while the
  // table really overflows, so the macOS overlay scrollbar stops sitting on top
  // of the last row and a table that fits keeps no empty gap.
  const sheetWrapRef = React.useRef<HTMLDivElement>(null);
  const [sheetXScroll, setSheetXScroll] = React.useState(false);

  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Destructive action awaiting confirmation in the shared ConfirmDialog.
  const [pendingConfirm, setPendingConfirm] = React.useState<
    { kind: 'row'; documentId: string } | { kind: 'bulk'; count: number } | null
  >(null);

  // bulk selection (compact view)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkSeason, setBulkSeason] = React.useState('');

  // move-whole-season dialog
  const [mwsOpen, setMwsOpen] = React.useState(false);
  const [mwsTo, setMwsTo] = React.useState('');
  const [mwsArchivedOnly, setMwsArchivedOnly] = React.useState(false);

  // --- derived: archived param + server column filters
  const archivedParam = React.useMemo(
    () => (filters.some((f) => f.col === 'status' && f.val === 'Arhivat') ? 'only' : 'false'),
    [filters],
  );
  const serverFilters = React.useMemo(
    () =>
      filters
        .filter((f) => !(f.col === 'status' && f.val === 'Arhivat'))
        .map((f) =>
          f.op === 'between'
            ? { col: f.col, op: 'between', val: { from: f.from ?? '', to: f.to ?? '' } }
            : { col: f.col, op: f.op, val: f.val },
        ),
    [filters],
  );
  const serverFiltersKey = React.useMemo(() => JSON.stringify(serverFilters), [serverFilters]);

  // --- resolve current user for per-user localStorage key
  React.useEffect(() => {
    let off = false;
    get('/admin/users/me')
      .then((r: any) => {
        if (off) return;
        const id = (r?.data?.data ?? r?.data)?.id;
        const key = id != null ? String(id) : 'anon';
        setUserKey(key);
        setColCfg(loadColConfig(cfg, key));
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [get, cfg]);

  // --- reconcile saved column config against the dynamic column set: append any
  // new columns (custom/removed), drop unknown ones, keep hidden valid.
  React.useEffect(() => {
    if (!defaultOrder.length) return;
    setColCfg((prev) => {
      const known = new Set(defaultOrder);
      const order = prev.order.filter((k) => known.has(k));
      for (const k of defaultOrder) if (!order.includes(k)) order.push(k);
      const hidden = prev.hidden.filter((k) => known.has(k));
      const same =
        order.length === prev.order.length &&
        order.every((k, i) => k === prev.order[i]) &&
        hidden.length === prev.hidden.length &&
        hidden.every((k, i) => k === prev.hidden[i]);
      if (same) return prev;
      const next = { order, hidden };
      saveColConfig(cfg, userKey, next);
      return next;
    });
  }, [defaultOrder, userKey, cfg]);

  // --- debounce search -> resets to page 1
  React.useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // --- main list fetch
  React.useEffect(() => {
    let off = false;
    setLoading(true);
    setError(false);
    setSelectedIds(new Set()); // selection is per fetched page
    const params: Record<string, unknown> = { page, pageSize, sort };
    if (cfg.archive) params.archived = archivedParam;
    if (cfg.seasons && season) params.season = season;
    if (search) params.q = search;
    if (serverFilters.length) params.filters = serverFiltersKey;
    get(cfg.api, { params })
      .then((r: any) => {
        if (off) return;
        const body = r?.data ?? {};
        setRows(Array.isArray(body.data) ? (body.data as Row[]) : []);
        if (body.pagination) setPagination(body.pagination as Pagination);
        if (Array.isArray(body.seasons)) setSeasons(body.seasons as string[]);
        if (typeof body.activeSeason === 'string' || body.activeSeason === null) setActiveSeason(body.activeSeason);
        if (body.formMeta && typeof body.formMeta === 'object') {
          const fm = body.formMeta as Partial<FormMeta>;
          setFormMeta({
            removedBuiltins: Array.isArray(fm.removedBuiltins) ? fm.removedBuiltins : [],
            customs: Array.isArray(fm.customs) ? fm.customs : [],
            selectOptions: fm.selectOptions && typeof fm.selectOptions === 'object' ? fm.selectOptions : {},
            extraKeys: Array.isArray(fm.extraKeys) ? fm.extraKeys : [],
          });
        }
      })
      .catch(() => {
        if (!off) setError(true);
      })
      .finally(() => {
        if (!off) setLoading(false);
      });
    return () => {
      off = true;
    };
  }, [get, cfg, page, pageSize, sort, season, search, archivedParam, serverFiltersKey, serverFilters.length, reloadTick]);

  // --- overview stat (current season, non-archived): total + noi
  React.useEffect(() => {
    let off = false;
    const totalOf = (r: any) => (typeof r?.data?.pagination?.total === 'number' ? r.data.pagination.total : null);
    const base: Record<string, unknown> = { pageSize: 1 };
    if (cfg.archive) base.archived = 'false';
    if (cfg.seasons && season) base.season = season;
    const nouFilter = JSON.stringify([{ col: 'status', op: 'equals', val: 'Nou' }]);
    const total = get(cfg.api, { params: base }).then(totalOf).catch(() => null);
    const noi = get(cfg.api, { params: { ...base, filters: nouFilter } }).then(totalOf).catch(() => null);
    Promise.all([total, noi]).then(([t, n]) => {
      if (!off) setSeasonStat({ total: t, noi: n });
    });
    return () => {
      off = true;
    };
  }, [get, cfg, season, reloadTick]);

  // --- close popovers on outside click
  React.useEffect(() => {
    if (!popOpen && !exportOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.popwrap')) {
        setPopOpen(false);
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [popOpen, exportOpen]);

  const selected = React.useMemo(() => rows.find((r) => r.documentId === selectedId) ?? null, [rows, selectedId]);

  // Keep the first row open in compact view so the detail column is never empty.
  React.useEffect(() => {
    if (view !== 'compact') return;
    if (rows.length && !rows.some((r) => r.documentId === selectedId)) {
      setSelectedId(rows[0].documentId);
    }
  }, [view, rows, selectedId]);

  const refetch = React.useCallback(() => setReloadTick((n) => n + 1), []);

  // --- persist a single field (optimistic)
  const saveField = React.useCallback(
    async (documentId: string, key: string, value: unknown) => {
      let prev: unknown;
      setRows((cur) =>
        cur.map((r) => {
          if (r.documentId !== documentId) return r;
          prev = r[key];
          return { ...r, [key]: value };
        }),
      );
      try {
        await put(`${cfg.api}/${documentId}`, { [key]: value });
        // status change can move the "noi" stat; a season change moves the row
        // out of the current season view — refetch in both cases.
        if (key === 'status' || key === 'season') refetch();
      } catch {
        setRows((cur) => cur.map((r) => (r.documentId === documentId ? { ...r, [key]: prev } : r)));
        setMsg({ kind: 'err', text: cfg.texts.saveError });
      }
    },
    [put, refetch, cfg],
  );

  // Destructive actions go through the shared ConfirmDialog. `removeRow` keeps
  // its TableApi signature (it just opens the dialog now); `doRemoveRow` runs
  // the unchanged delete once confirmed.
  const doRemoveRow = React.useCallback(
    async (documentId: string) => {
      try {
        await del(`${cfg.api}/${documentId}`);
        refetch();
      } catch {
        setMsg({ kind: 'err', text: cfg.texts.deleteError });
      } finally {
        setPendingConfirm(null);
      }
    },
    [del, refetch, cfg],
  );

  const removeRow = React.useCallback((documentId: string) => {
    setPendingConfirm({ kind: 'row', documentId });
  }, []);

  // --- bulk selection helpers
  const toggleSelect = (id: string) =>
    setSelectedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allPageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.documentId));
  const toggleSelectAll = () =>
    setSelectedIds((s) => {
      const n = new Set(s);
      if (rows.every((r) => n.has(r.documentId))) rows.forEach((r) => n.delete(r.documentId));
      else rows.forEach((r) => n.add(r.documentId));
      return n;
    });
  const clearSelection = () => setSelectedIds(new Set());

  const bulkMove = React.useCallback(async () => {
    const toSeason = bulkSeason.trim();
    if (!toSeason || selectedIds.size === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const r: any = await post(`${cfg.api}/move-season`, { documentIds: [...selectedIds], toSeason });
      setMsg({ kind: 'ok', text: `Am mutat ${r?.data?.moved ?? 0} înscrieri în sezonul ${toSeason}.` });
      setBulkSeason('');
      refetch();
    } catch {
      setMsg({ kind: 'err', text: 'Mutarea în sezon a eșuat.' });
    } finally {
      setBusy(false);
    }
  }, [post, bulkSeason, selectedIds, refetch, cfg]);

  const bulkArchive = React.useCallback(async () => {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    setBusy(true);
    setMsg(null);
    try {
      await Promise.all([...selectedIds].map((id) => put(`${cfg.api}/${id}`, { archived: true })));
      setMsg({ kind: 'ok', text: `Am arhivat ${n} înscrieri.` });
      refetch();
    } catch {
      setMsg({ kind: 'err', text: 'Arhivarea selecției a eșuat.' });
    } finally {
      setBusy(false);
    }
  }, [put, selectedIds, refetch, cfg]);

  const bulkDelete = React.useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      await Promise.all([...selectedIds].map((id) => del(`${cfg.api}/${id}`)));
      refetch();
    } catch {
      setMsg({ kind: 'err', text: 'Ștergerea selecției a eșuat.' });
    } finally {
      setBusy(false);
      setPendingConfirm(null);
    }
  }, [del, selectedIds, refetch, cfg]);

  const moveWholeSeason = React.useCallback(async () => {
    const from = season || activeSeason || '';
    const to = mwsTo.trim();
    if (!from || !to) return;
    setBusy(true);
    setMsg(null);
    try {
      const r: any = await post(`${cfg.api}/move-whole-season`, { fromSeason: from, toSeason: to, archivedOnly: mwsArchivedOnly });
      setMsg({ kind: 'ok', text: `Am mutat ${r?.data?.moved ?? 0} înscrieri din ${from} în ${to}.` });
      setMwsOpen(false);
      setMwsTo('');
      setMwsArchivedOnly(false);
      refetch();
    } catch {
      setMsg({ kind: 'err', text: 'Mutarea sezonului a eșuat.' });
    } finally {
      setBusy(false);
    }
  }, [post, season, activeSeason, mwsTo, mwsArchivedOnly, refetch, cfg]);

  // --- export query mirrors the current view (season/archived/q/filters/sort)
  const exportParams = React.useCallback(() => {
    const p: Record<string, unknown> = { sort };
    if (cfg.archive) p.archived = archivedParam;
    if (cfg.seasons && season) p.season = season;
    if (search) p.q = search;
    if (serverFilters.length) p.filters = serverFiltersKey;
    return p;
  }, [sort, archivedParam, season, search, serverFilters.length, serverFiltersKey, cfg]);

  const exportCsv = React.useCallback(async () => {
    setExportOpen(false);
    setBusy(true);
    setMsg(null);
    try {
      // `responseType: 'text'` is load-bearing. Without it Strapi's fetch client
      // defaults to 'json' and calls response.json() on the CSV body, which
      // throws a SyntaxError — and its interceptor swallows that error whenever
      // the response is ok, handing back `{ data: {} }`. The old code then read
      // a non-string and downloaded a silently EMPTY file.
      const r: any = await get(`${cfg.api}/export.csv`, {
        params: exportParams(),
        responseType: 'text',
      });
      const csv = typeof r?.data === 'string' ? r.data : '';
      if (!csv) throw new Error('empty CSV body');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cfg.csvPrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMsg({ kind: 'err', text: 'Exportul CSV a eșuat.' });
    } finally {
      setBusy(false);
    }
  }, [get, exportParams, cfg]);

  // --- Google Sheets live connection (Export menu + SheetsDialog)
  const sheetsForm = cfg.sheetsForm;
  const [sheetsOpen, setSheetsOpen] = React.useState(false);
  const [sheetLink, setSheetLink] = React.useState<{
    spreadsheetId: string | null;
    spreadsheetName: string | null;
    lastSyncAt: string | null;
  } | null>(null);

  const loadSheetLink = React.useCallback(async () => {
    if (!sheetsForm) return;
    try {
      const r: any = await get('/api/sheets/status');
      const mine = (r?.data?.forms ?? []).find((f: any) => f.key === sheetsForm);
      setSheetLink(
        mine
          ? {
              spreadsheetId: mine.spreadsheetId ?? null,
              spreadsheetName: mine.spreadsheetName ?? null,
              lastSyncAt: mine.lastSyncAt ?? null,
            }
          : null,
      );
    } catch {
      setSheetLink(null);
    }
  }, [get, sheetsForm]);

  React.useEffect(() => {
    loadSheetLink();
  }, [loadSheetLink]);

  const sheetsConnected = Boolean(sheetLink?.spreadsheetId);
  const sheetsUrl = sheetLink?.spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${sheetLink.spreadsheetId}/edit`
    : null;

  const syncSheetNow = React.useCallback(async () => {
    if (!sheetsForm) return;
    setExportOpen(false);
    setBusy(true);
    setMsg(null);
    try {
      const r: any = await post(`/api/sheets/${sheetsForm}/sync`, { mode: 'full' });
      const res = r?.data ?? {};
      if (res.ok) {
        setMsg({
          kind: 'ok',
          text: `Sincronizare completă: ${res.added ?? 0} adăugate, ${res.updated ?? 0} modificate, ${res.removed ?? 0} șterse.`,
        });
      } else {
        setMsg({ kind: 'err', text: res.message ?? 'Sincronizarea cu Google Sheets a eșuat.' });
      }
      loadSheetLink();
    } catch {
      setMsg({ kind: 'err', text: 'Sincronizarea cu Google Sheets a eșuat.' });
    } finally {
      setBusy(false);
    }
  }, [post, sheetsForm, loadSheetLink]);

  // --- filter builder actions
  const addFilter = () => {
    const isDate = colByKey[dCol]?.type === 'date';
    const id = `${Date.now()}-${Math.random()}`;
    let f: ActiveFilter;

    if (isDate && dOp === 'between') {
      if (!dFrom && !dTo) return;
      f = { id, col: dCol, op: 'between', val: '', from: dFrom, to: dTo };
    } else if (isDate) {
      // on / before / after take a single day in `from`, which is the field the
      // date input is already bound to.
      if (!dFrom) return;
      f = { id, col: dCol, op: dOp, val: dFrom };
    } else {
      if (!dVal.trim()) return;
      f = { id, col: dCol, op: dOp, val: dVal.trim() };
    }
    // Only one "view archived" toggle at a time.
    setFilters((cur) => {
      const next = f.col === 'status' && f.val === 'Arhivat' ? cur.filter((x) => !(x.col === 'status' && x.val === 'Arhivat')) : cur;
      return [...next, f];
    });
    setDVal('');
    setDFrom('');
    setDTo('');
    setPage(1);
  };
  const removeFilter = (id: string) => {
    setFilters((cur) => cur.filter((f) => f.id !== id));
    setPage(1);
  };
  const clearFilters = () => {
    setFilters([]);
    setPage(1);
  };

  /**
   * Columns that filter from a dropdown of their own values, rather than
   * through the generic builder. Status always; anything else whose options
   * the form describes (level, and any CMS select question).
   *
   * `Arhivat` is excluded: it is the archive view toggle, not a status, and
   * mixing it into a set would ask the server for a combination it does not
   * model.
   */
  const quickCols = React.useMemo(
    () =>
      (cfg.quickFilterCols ?? ['status'])
        .map((key) => cfg.filterColumns.find((c) => c.key === key))
        .filter(Boolean)
        .map((c) => {
          const opts =
            c.key === 'status'
              ? statusFilterValues.filter((v) => v !== 'Arhivat')
              : formMeta.selectOptions?.[c.key]?.map((o) => o.value) ??
                cfg.filterSelectFallback?.[c.key] ??
                null;
          return opts && opts.length ? { key: c.key, label: c.label, options: opts } : null;
        })
        .filter(Boolean) as { key: string; label: string; options: string[] }[],
    [cfg, statusFilterValues, formMeta],
  );

  /** Values currently selected for a quick column. */
  const quickSelected = React.useCallback(
    (col: string): string[] => {
      const f = filters.find((x) => x.col === col && (x.op === 'equals' || x.op === 'anyOf'));
      if (!f) return [];
      return f.op === 'anyOf' ? f.val.split(',').filter(Boolean) : [f.val];
    },
    [filters],
  );

  /**
   * Tick or untick one value. The dropdown edits that column's filter in place
   * rather than adding another, so two ticks read as "either" instead of
   * narrowing to nothing.
   */
  const toggleQuick = (col: string, val: string) => {
    const cur = quickSelected(col);
    const next = cur.includes(val) ? cur.filter((v) => v !== val) : cur.concat(val);
    setFilters((all) => {
      const rest = all.filter((x) => !(x.col === col && (x.op === 'equals' || x.op === 'anyOf')));
      if (!next.length) return rest;
      const id = `${Date.now()}-${Math.random()}`;
      return rest.concat(
        next.length === 1
          ? { id, col, op: 'equals', val: next[0]! }
          : { id, col, op: 'anyOf', val: next.join(',') },
      );
    });
    setPage(1);
  };

  React.useEffect(() => {
    if (!quickOpen && !advOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.('.qfwrap')) return;
      setQuickOpen(null);
      setAdvOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [quickOpen, advOpen]);

  const chipText = (f: ActiveFilter): string => {
    const label = colLabel[f.col] ?? f.col;
    if (f.op === 'between') return `${label}: între ${f.from || '...'} și ${f.to || '...'}`;
    if (f.op === 'anyOf') return `${label}: ${f.val.split(',').join(', ')}`;
    if (f.op === 'on') return `${label}: ${f.val}`;
    if (f.op === 'before' || f.op === 'after') return `${label} ${OP_LABEL[f.op]} ${f.val}`;
    if (f.op === 'equals') return `${label}: ${f.val}`;
    return `${label} ${OP_LABEL[f.op] ?? f.op} „${f.val}"`;
  };

  // --- column popover (full view)
  const visibleOrder = colCfg.order.filter((k) => !colCfg.hidden.includes(k));
  const visibleOrderKey = visibleOrder.join('|');

  React.useEffect(() => {
    const el = sheetWrapRef.current;
    if (view !== 'full' || !el) {
      setSheetXScroll(false);
      return;
    }
    // padding-bottom does not change either measure, so this cannot oscillate.
    const measure = () => setSheetXScroll(el.scrollWidth > el.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const table = el.firstElementChild;
    if (table) ro.observe(table);
    return () => ro.disconnect();
  }, [view, visibleOrderKey, rows, loading, error]);
  const updateCfg = (next: ColConfig) => {
    setColCfg(next);
    saveColConfig(cfg, userKey, next);
  };
  const toggleHidden = (key: string) => {
    const hidden = colCfg.hidden.includes(key) ? colCfg.hidden.filter((k) => k !== key) : [...colCfg.hidden, key];
    updateCfg({ ...colCfg, hidden });
  };
  const reorderCol = (from: string, to: string) => {
    if (from === to) return;
    const order = colCfg.order.filter((k) => k !== from);
    const at = order.indexOf(to);
    if (at < 0) return;
    order.splice(at, 0, from);
    updateCfg({ ...colCfg, order });
  };
  const resetCols = () => updateCfg({ order: [...defaultOrder], hidden: [...(cfg.defaultHidden ?? [])] });

  const statusTag = React.useCallback(
    (r: Row) => {
      const label = cfg.archive && r.archived ? 'Arhivat' : r.status;
      return <span className={`tag ${tagClassOf(label)}`}>{label}</span>;
    },
    [cfg, tagClassOf],
  );

  // --- shared detail-panel blocks (identical on every screen)
  const statusBox = React.useCallback(
    (r: Row) => (
      <div className="statusbox">
        <label>Status</label>
        <select
          className={`sel-status ${tagClassOf(String(r.status ?? ''))}`}
          value={String(r.status ?? cfg.statuses[0].value)}
          onChange={(e) => saveField(r.documentId, 'status', e.target.value)}
        >
          {cfg.statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.value}
            </option>
          ))}
        </select>
      </div>
    ),
    [cfg, tagClassOf, saveField],
  );

  const seasonField = React.useCallback(
    (r: Row) => {
      if (!cfg.seasons) return null;
      const current = String(r.season ?? '');
      return (
        <div className="fld">
          <label>Sezon</label>
          <SeasonSelect
            value={current}
            seasons={seasons}
            activeSeason={activeSeason}
            onChange={(next) => {
              if (next !== current) saveField(r.documentId, 'season', next);
            }}
          />
        </div>
      );
    },
    [cfg, seasons, activeSeason, saveField],
  );

  const customFields = React.useCallback(
    (r: Row) => {
      const ex = r.extra && typeof r.extra === 'object' ? (r.extra as Record<string, unknown>) : {};
      const customCols = columns.filter(
        (c) => c.custom && (c.extraKey! in ex || formMeta.customs.some((cc) => cc.key === c.extraKey)),
      );
      if (customCols.length === 0) return null;
      return (
        <div style={{ marginTop: 11 }}>
          {customCols.map((c) => (
            <div className="fld" key={c.key}>
              <label>{c.label}</label>
              <div className="v">{extraValueText(ex[c.extraKey!])}</div>
            </div>
          ))}
        </div>
      );
    },
    [columns, formMeta],
  );

  const internalNoteField = React.useCallback(
    (r: Row) => (
      <div className="fld">
        <label>Notă internă</label>
        <textarea
          rows={3}
          key={`${r.documentId}-internalNote`}
          defaultValue={String(r.internalNote ?? '')}
          onBlur={(e) => {
            if (e.target.value !== String(r.internalNote ?? ''))
              saveField(r.documentId, 'internalNote', e.target.value);
          }}
        />
      </div>
    ),
    [saveField],
  );

  const api: TableApi = {
    columns,
    formMeta,
    seasons,
    activeSeason,
    statuses: cfg.statuses,
    tagClassOf,
    statusTag,
    saveField,
    removeRow,
    statusBox,
    seasonField,
    customFields,
    internalNoteField,
  };

  const renderCellInput = (row: Row, col: ColumnDef) => {
    // Custom columns render read-only from row.extra.
    if (col.custom) {
      const ex = row.extra && typeof row.extra === 'object' ? (row.extra as Record<string, unknown>) : {};
      const v = ex[col.extraKey!];
      if (col.type === 'bool') return <span className="cellv">{v === true ? 'Da' : v === false ? 'Nu' : ''}</span>;
      return <span className="cellv">{v == null || v === '' ? '' : String(v)}</span>;
    }
    if (col.render) return <span className="cellv">{col.render(row)}</span>;
    if (col.type === 'date') {
      const raw = row[col.key];
      return <span className="cellv">{fmtDateTime(typeof raw === 'string' ? raw : null)}</span>;
    }
    // Status is the only editable data cell (unless the row is archived).
    if (col.type === 'status') {
      if (cfg.archive && row.archived) return <span className="cellv">Arhivat</span>;
      return (
        <select
          className={`sel-status ${tagClassOf(String(row[col.key] ?? cfg.statuses[0].value))}`}
          value={String(row[col.key] ?? cfg.statuses[0].value)}
          onChange={(e) => saveField(row.documentId, col.key, e.target.value)}
        >
          {cfg.statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.value}
            </option>
          ))}
        </select>
      );
    }
    const val = row[col.key];
    if (col.type === 'bool') return <span className="cellv">{val ? 'Da' : 'Nu'}</span>;
    if (col.type === 'list')
      return <span className="cellv">{Array.isArray(val) ? val.map((x) => String(x)).join(', ') : val == null || val === '' ? '' : String(val)}</span>;
    return <span className="cellv">{val == null || val === '' ? '' : String(val)}</span>;
  };

  // --- pager numbers (window around current page)
  const pageNumbers = React.useMemo(() => {
    const { page: p, pageCount } = pagination;
    const out: number[] = [];
    const from = Math.max(1, p - 2);
    const to = Math.min(pageCount, from + 4);
    for (let i = Math.max(1, to - 4); i <= to; i++) out.push(i);
    return out;
  }, [pagination]);

  const rangeText = () => {
    const { page: p, pageSize: ps, total } = pagination;
    if (total === 0) return '0 din 0';
    const start = (p - 1) * ps + 1;
    const end = Math.min(total, p * ps);
    return `${start}-${end} din ${total}`;
  };

  const seasonSelectValue = season || activeSeason || 'all';

  // A date column is always filtered as a range: the operator is forced to
  // `between` and the two values are <input type="date">, so a free-text date
  // (which the server could not parse) can never be entered. Switching back to
  // a non-date column restores `contains`.
  const dColIsDate = colByKey[dCol]?.type === 'date';
  React.useEffect(() => {
    // Keep the operator valid for the column type rather than pinning dates to
    // a range.
    setDOp((op) => {
      if (dColIsDate) return DATE_OPS.includes(op) ? op : 'on';
      return DATE_OPS.includes(op) ? 'contains' : op;
    });
  }, [dColIsDate, dCol]);
  const dOpIsBetween = dOp === 'between';
  const dOpOptions = React.useMemo(
    () =>
      OPERATORS.filter((o) =>
        dColIsDate ? DATE_OPS.includes(o.key) : !DATE_OPS.includes(o.key),
      ),
    [dColIsDate],
  );
  // Value options for select-driven filter columns: the status column always,
  // any other column whose enabled options come with formMeta (with an optional
  // static fallback, e.g. the historic level list).
  const dValOptions: string[] | null = React.useMemo(() => {
    if (dCol === 'status') return statusFilterValues;
    const opts = formMeta.selectOptions?.[dCol];
    if (opts) return opts.map((o) => o.value);
    return cfg.filterSelectFallback?.[dCol] ?? null;
  }, [dCol, statusFilterValues, formMeta, cfg]);

  return (
    <div className="insp">
      <style>{fullCss}</style>

      <div className="win">
        {/* header */}
        <div className="hd">
          <div>
            <h1>{cfg.texts.title}</h1>
            <p>{cfg.texts.subtitle}</p>
          </div>
          <div className="hd-right">
            {cfg.seasons && (
              <div className="season">
                <span className="lbl">Sezon</span>
                <select
                  value={seasonSelectValue}
                  onChange={(e) => {
                    setSeason(e.target.value === 'all' ? 'all' : e.target.value);
                    setPage(1);
                  }}
                >
                  {seasons.map((s) => (
                    <option key={s} value={s}>
                      {s}
                      {s === activeSeason ? ' (activ)' : ''}
                    </option>
                  ))}
                  <option value="all">Toate sezoanele</option>
                </select>
                <button className="btn sm" type="button" onClick={() => setMwsOpen(true)}>
                  Mută tot sezonul...
                </button>
              </div>
            )}
            <div className="stat">
              <b className="num">{seasonStat.total ?? '—'}</b> în total
              <br />
              <span className="noi num">{seasonStat.noi ?? 0} noi</span>{cfg.texts.statSuffix}
            </div>
          </div>
        </div>

        {/* toolbar A */}
        <div className="tbA">
          <div className="search">
            <span aria-hidden="true">⌕</span>
            <input
              placeholder={cfg.texts.searchPlaceholder}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="seg">
            <button className={view === 'compact' ? 'on' : ''} type="button" onClick={() => setView('compact')}>
              Compact
            </button>
            <button className={view === 'full' ? 'on' : ''} type="button" onClick={() => setView('full')}>
              Toate coloanele
            </button>
          </div>
          {view === 'full' && (
            <div className="popwrap">
              <button ref={colBtnRef} className="btn sm" type="button" onClick={openColPop}>
                Coloane ▾
              </button>
              {popOpen && (
                <div className="pop pop-fixed" style={popPos ? { top: popPos.top, right: popPos.right } : undefined}>
                  <h4>Coloane: trage pentru a reordona, bifează ce se afișează</h4>
                  <div className="pop-body">
                    {colCfg.order.map((key) => {
                      const c = colByKey[key];
                      if (!c) return null;
                      const shown = !colCfg.hidden.includes(key);
                      const cls = `prow${dragKey === key ? ' drag' : ''}${overKey === key && dragKey !== key ? ' over' : ''}`;
                      return (
                        <div
                          key={key}
                          className={cls}
                          draggable
                          onDragStart={(e) => {
                            setDragKey(key);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (overKey !== key) setOverKey(key);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragKey) reorderCol(dragKey, key);
                            setDragKey(null);
                            setOverKey(null);
                          }}
                          onDragEnd={() => {
                            setDragKey(null);
                            setOverKey(null);
                          }}
                        >
                          <span className="grip" aria-hidden="true">
                            ⠿
                          </span>
                          <input type="checkbox" checked={shown} onChange={() => toggleHidden(key)} />
                          <span className="plbl">{c.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pop-foot">
                    <button type="button" className="reset" onClick={resetCols}>
                      Resetează la implicit
                    </button>
                    <button type="button" className="btn pri sm" onClick={() => setPopOpen(false)}>
                      Aplică
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="popwrap">
            <button className="btn sm" type="button" onClick={() => setExportOpen((o) => !o)} disabled={busy}>
              Export ▾
            </button>
            {exportOpen && (
              <div className="menu">
                <button type="button" onClick={exportCsv} disabled={busy}>
                  Descarcă CSV
                </button>
                {sheetsForm && <div className="sep" />}
                {sheetsForm && !sheetsConnected && (
                  <button
                    type="button"
                    className="warn"
                    onClick={() => {
                      setExportOpen(false);
                      setSheetsOpen(true);
                    }}
                    disabled={busy}
                  >
                    Google Sheets
                    <span className="sub">Google Sheet nu este conectat</span>
                  </button>
                )}
                {sheetsForm && sheetsConnected && (
                  <>
                    <div className="grp">{sheetLink?.spreadsheetName || 'Foaie conectată'}</div>
                    <button type="button" onClick={syncSheetNow} disabled={busy}>
                      Sincronizează acum
                      {sheetLink?.lastSyncAt && (
                        <span className="sub">Ultima sincronizare {fmtSheetWhen(sheetLink.lastSyncAt)}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExportOpen(false);
                        if (sheetsUrl) window.open(sheetsUrl, '_blank', 'noopener');
                      }}
                      disabled={busy}
                    >
                      Deschide Google Sheet
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExportOpen(false);
                        setSheetsOpen(true);
                      }}
                      disabled={busy}
                    >
                      Setări și istoric
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* toolbar B: sort, plus the builder behind a dropdown */}
        <div className="tbB">
          {quickCols.map((qc) => {
            const picked = quickSelected(qc.key);
            return (
              <div className="qfwrap" key={qc.key}>
                <button
                  type="button"
                  className={picked.length ? 'btn sm qf on' : 'btn sm qf'}
                  onClick={() => {
                    setAdvOpen(false);
                    setQuickOpen((cur) => (cur === qc.key ? null : qc.key));
                  }}
                >
                  {qc.label}
                  {picked.length ? ` (${picked.length})` : ''} ▾
                </button>
                {quickOpen === qc.key && (
                  <div className="pop qfpop">
                    <div className="pop-body">
                      {qc.options.map((v) => {
                        const on = picked.includes(v);
                        return (
                          <label className="prow" key={v}>
                            <input type="checkbox" checked={on} onChange={() => toggleQuick(qc.key, v)} />
                            <span>{v}</span>
                          </label>
                        );
                      })}
                    </div>
                    {picked.length > 0 && (
                      <div className="qffoot">
                        <button
                          type="button"
                          className="fclear"
                          onClick={() => {
                            setFilters((all) =>
                              all.filter((x) => !(x.col === qc.key && (x.op === 'equals' || x.op === 'anyOf'))),
                            );
                            setPage(1);
                          }}
                        >
                          Șterge
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div className="qfwrap">
            <button
              type="button"
              className={advOpen ? 'btn sm qf on' : 'btn sm qf'}
              onClick={() => {
                setQuickOpen(null);
                setAdvOpen((v) => !v);
              }}
            >
              Alte filtre ▾
            </button>
            {advOpen && (
              <div className="pop advpop">
          <span className="lbl">Filtru:</span>
          <select
            value={dCol}
            onChange={(e) => {
              setDCol(e.target.value);
              setDVal('');
              setDVals([]);
            }}
          >
            {cfg.filterColumns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <select value={dOp} disabled={dColIsDate} onChange={(e) => setDOp(e.target.value)}>
            {dOpOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          {dColIsDate && dOpIsBetween ? (
            <>
              <input type="date" aria-label="De la" value={dFrom} onChange={(e) => setDFrom(e.target.value)} />
              <input type="date" aria-label="Până la" value={dTo} onChange={(e) => setDTo(e.target.value)} />
            </>
          ) : dColIsDate ? (
            <input type="date" aria-label="Data" value={dFrom} onChange={(e) => setDFrom(e.target.value)} />
          ) : dValOptions ? (
            <select value={dVal} onChange={(e) => setDVal(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">valoare</option>
              {dValOptions.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          ) : (
            <input placeholder="valoare" value={dVal} onChange={(e) => setDVal(e.target.value)} style={{ minWidth: 160 }} />
          )}
          <button className="btn sm pri" type="button" onClick={addFilter}>
            Adaugă filtru
          </button>
              </div>
            )}
          </div>
          <span className="grow" />
          <span className="lbl">Sortare:</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as 'newest' | 'oldest' | 'name');
              setPage(1);
            }}
          >
            <option value="newest">Cele mai noi</option>
            <option value="oldest">Cele mai vechi</option>
            <option value="name">Nume A-Z</option>
          </select>
        </div>

        {/* active filter chips */}
        {filters.length > 0 && (
          <div className="fchips">
            {filters.map((f) => (
              <span className="fchip" key={f.id}>
                {chipText(f)}
                <button type="button" className="x" aria-label="Elimină filtrul" onClick={() => removeFilter(f.id)}>
                  ✕
                </button>
              </span>
            ))}
            <span className="lbl">
              {filters.length} {filters.length === 1 ? 'filtru activ' : 'filtre active'}
            </span>
            <button type="button" className="fclear" onClick={clearFilters}>
              Șterge filtrele
            </button>
          </div>
        )}

        {msg && (
          <div className={`insp-msg ${msg.kind}`}>
            {msg.text}
            <button
              type="button"
              onClick={() => setMsg(null)}
              style={{ float: 'right', border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              ×
            </button>
          </div>
        )}

        {/* content */}
        {loading ? (
          <div className="insp-empty">Se încarcă...</div>
        ) : error ? (
          <div className="insp-empty">{cfg.texts.loadError}</div>
        ) : rows.length === 0 ? (
          <div className="insp-empty">{cfg.texts.empty}</div>
        ) : view === 'compact' ? (
          <>
            {cfg.bulk && selectedIds.size > 0 && (
              <div className="bulkbar">
                <span className="bcount">{selectedIds.size} selectate</span>
                {cfg.seasons && (
                  <>
                    <SeasonSelect
                      value={bulkSeason}
                      seasons={seasons}
                      activeSeason={activeSeason}
                      onChange={setBulkSeason}
                      emptyLabel="Sezon destinație..."
                      style={{ minWidth: 220 }}
                    />
                    <button className="btn sm pri" type="button" onClick={bulkMove} disabled={busy || !bulkSeason.trim()}>
                      Mută în sezon
                    </button>
                  </>
                )}
                {cfg.archive && (
                  <button className="btn sm" type="button" onClick={bulkArchive} disabled={busy}>
                    Arhivează
                  </button>
                )}
                <button
                  className="btn sm danger"
                  type="button"
                  onClick={() => {
                    if (selectedIds.size > 0) setPendingConfirm({ kind: 'bulk', count: selectedIds.size });
                  }}
                  disabled={busy}
                >
                  Șterge
                </button>
                <span className="grow" />
                <button className="btn sm" type="button" onClick={clearSelection}>
                  Deselectează
                </button>
              </div>
            )}
            <div className="insp-split">
              <div style={{ overflowX: 'auto' }}>
                <table className="clist">
                  <thead>
                    <tr>
                      {cfg.bulk && (
                        <th className="chkc">
                          <input
                            type="checkbox"
                            className="chk"
                            aria-label="Selectează toate"
                            checked={allPageSelected}
                            onChange={toggleSelectAll}
                          />
                        </th>
                      )}
                      {cfg.compact.headers.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.documentId}
                        className={selectedId === r.documentId ? 'sel' : ''}
                        onClick={() => setSelectedId(r.documentId)}
                      >
                        {cfg.bulk && (
                          <td className="chkc" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="chk"
                              aria-label="Selectează rândul"
                              checked={selectedIds.has(r.documentId)}
                              onChange={() => toggleSelect(r.documentId)}
                            />
                          </td>
                        )}
                        {cfg.compact.renderCells(r, api)}
                        <td className="actcell">
                          <span className="rowacts">
                            <button
                              type="button"
                              className="ra del"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRow(r.documentId);
                              }}
                            >
                              Șterge
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selected && <div className="panel">{cfg.compact.renderDetail(selected, api)}</div>}
            </div>
          </>
        ) : (
          // ---- spreadsheet view ----
          <div ref={sheetWrapRef} className={`sheetwrap${sheetXScroll ? ' xscroll' : ''}`}>
            <table className="sheet">
              <thead>
                <tr>
                  {visibleOrder.map((key, i) => {
                    const c = colByKey[key];
                    if (!c) return null;
                    return (
                      <th key={key} className={i === 0 ? 'frz' : ''} style={{ minWidth: c.width, left: i === 0 ? 0 : undefined }}>
                        {c.label}
                      </th>
                    );
                  })}
                  <th style={{ minWidth: 150 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.documentId}>
                    {visibleOrder.map((key, i) => {
                      const c = colByKey[key];
                      if (!c) return null;
                      const isBool = c.type === 'bool';
                      return (
                        <td key={key} className={`${i === 0 ? 'frz' : ''} ${isBool ? 'boolc' : ''}`} style={{ minWidth: c.width }}>
                          {renderCellInput(r, c)}
                        </td>
                      );
                    })}
                    <td className="acts">
                      <span className="rowacts" style={{ opacity: 1 }}>
                        <button type="button" className="ra del" onClick={() => removeRow(r.documentId)}>
                          Șterge
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* footer: page size + pager */}
        {!loading && !error && rows.length > 0 && (
          <div className="ft">
            <div className="l">
              Rânduri pe pagină:
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{ padding: '5px 8px' }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="num">· {rangeText()}</span>
            </div>
            <div className="pager">
              <button className="pg" type="button" disabled={pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                ‹
              </button>
              {pageNumbers.map((n) => (
                <button key={n} className={`pg ${n === pagination.page ? 'on' : ''}`} type="button" onClick={() => setPage(n)}>
                  {n}
                </button>
              ))}
              <button
                className="pg"
                type="button"
                disabled={pagination.page >= pagination.pageCount}
                onClick={() => setPage((p) => Math.min(pagination.pageCount, p + 1))}
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {cfg.seasons && mwsOpen && (
        <div className="mws-back" onMouseDown={() => setMwsOpen(false)}>
          <div className="mws" onMouseDown={(e) => e.stopPropagation()}>
            <h3>Mută tot sezonul</h3>
            <div className="mbody">
              <div className="mrow">
                <label>Din sezonul</label>
                <div className="ro">{season || activeSeason || '—'}</div>
              </div>
              <div className="mrow">
                <label>În sezonul</label>
                <SeasonSelect
                  value={mwsTo}
                  seasons={seasons}
                  activeSeason={activeSeason}
                  onChange={setMwsTo}
                  emptyLabel="Alege sezonul..."
                  style={{ width: '100%' }}
                />
              </div>
              <label className="chkrow">
                <input type="checkbox" checked={mwsArchivedOnly} onChange={(e) => setMwsArchivedOnly(e.target.checked)} />
                Doar înscrierile arhivate
              </label>
            </div>
            <div className="foot">
              <button className="btn sm" type="button" onClick={() => setMwsOpen(false)}>
                Anulează
              </button>
              <button
                className="btn sm pri"
                type="button"
                onClick={moveWholeSeason}
                disabled={busy || !mwsTo.trim() || !(season || activeSeason)}
              >
                Mută
              </button>
            </div>
          </div>
        </div>
      )}

      {sheetsForm && (
        <SheetsDialog
          open={sheetsOpen}
          form={sheetsForm}
          label={cfg.texts.title}
          onClose={() => setSheetsOpen(false)}
          onChanged={loadSheetLink}
        />
      )}

      <ConfirmDialog
        open={pendingConfirm !== null}
        title={pendingConfirm?.kind === 'bulk' ? 'Ștergi selecția?' : 'Ștergi definitiv?'}
        message={
          pendingConfirm?.kind === 'bulk'
            ? `Ștergi definitiv ${pendingConfirm.count} ${cfg.texts.bulkDeleteNoun}? Acțiunea nu poate fi anulată.`
            : cfg.texts.deleteConfirm
        }
        busy={pendingConfirm?.kind === 'bulk' ? busy : false}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          if (!pendingConfirm) return;
          if (pendingConfirm.kind === 'bulk') bulkDelete();
          else doRemoveRow(pendingConfirm.documentId);
        }}
      />
    </div>
  );
}
