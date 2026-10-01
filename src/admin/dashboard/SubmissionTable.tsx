import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { ConfirmDialog } from '../ConfirmDialog';
import { SheetsDialog, type SheetsForm } from './SheetsDialog';
import {
  AdminPage,
  Window,
  PageHeader,
  Button,
  StatusBadge,
  Chip,
  ChipList,
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
  DateInput,
  SegmentedControl,
  Pager,
  Popover,
  Modal,
  Loading,
  EmptyState,
  useDragReorder,
  moveItem,
  adminToast,
  toastAutosaved,
  cx,
} from '../ui';
import { IconChevronDown, IconGrip } from '../ui/icons';

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
 * Built on src/admin/ui: AdminPage / Window / PageHeader chrome, .ui-table for
 * both the compact list and the spreadsheet, Popover menus, Chip filter chips,
 * Checkbox selection, useDragReorder for the column order, Pager, Modal for
 * the move-whole-season dialog, ConfirmDialog for deletes. Inline edits
 * (status, season, note) autosave with the "Salvat" toast; other results are
 * toasts too. Status colours come from the config (CSS colours, normally
 * --theme-* tokens) and reach StatusBadge through its `custom` prop.
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

/** A status and its colours: any CSS colour, normally a --theme-* token. */
export interface StatusDef {
  value: string;
  /** Text colour. */
  color: string;
  /** Fill. */
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
  /** Colours of a status (or extra tag) value; falls back to the first status. */
  statusOf: (label: string) => StatusDef;
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
  /** Extra CSS appended after the shared stylesheet (screen-specific bits, tokens only). */
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
  'aria-label': ariaLabel,
}: {
  'aria-label'?: string;
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
    <Select
      value={value}
      disabled={disabled}
      style={style}
      aria-label={ariaLabel}
      onChange={(v) => onChange(v)}
      placeholder={emptyLabel ?? '— fără sezon —'}
      options={options.map((s) => ({ value: s, label: `${s}${s === activeSeason ? ' (activ)' : ''}` }))}
    />
  );
}

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

// Table-local styles, tokens only (var(--theme-*), var(--ui-*)), scoped under
// .ui-root. The compact list and the spreadsheet both sit on .ui-table; these
// rules only add what the shared table has no notion of (selection, frozen
// first column, tinted status selects, the detail panel). Kept free of
// backticks on purpose: one stray backtick in a template literal takes the
// whole admin panel down to a blank page.
const TABLE_CSS = `
.ui-root .sbt-stat{text-align:right;font-size:12px;color:var(--theme-text-muted);white-space:nowrap;line-height:1.45}
.ui-root .sbt-stat b{color:var(--theme-text);font-size:15px}
.ui-root .sbt-stat .sbt-noi{color:var(--theme-danger);font-weight:700}
.ui-root .sbt-season{display:flex;align-items:center;gap:7px}
.ui-root .sbt-season .ui-input{width:auto}
.ui-root .sbt-lbl{font-size:11px;color:var(--theme-text-muted);font-weight:600}
.ui-root .sbt-tbB{display:flex;align-items:center;gap:9px;padding:11px 18px;border-bottom:1px solid var(--theme-border);flex-wrap:wrap;background:var(--theme-surface-subtle)}
.ui-root .sbt-tbB .ui-input{width:auto}
.ui-root .sbt-grow{flex:1}
.ui-root .ui-btn.sbt-qf-on{border-color:var(--theme-primary);color:var(--theme-primary);background:var(--theme-primary-soft)}
.ui-root .sbt-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:10px 18px 12px;border-bottom:1px solid var(--theme-border)}
.ui-root .sbt-listbody{transition:opacity .12s ease}
.ui-root .sbt-listbody[data-busy="true"]{opacity:.5;pointer-events:none;transition-delay:.3s}
.ui-root .sbt-tag{min-width:96px;justify-content:center}
.ui-root .ui-input.sbt-status-sel,.ui-root .ui-input.sbt-cell-sel{font-weight:700}
.ui-root .sbt-statusbox{margin:0 0 14px;padding:11px 12px;border:1px solid var(--theme-primary-soft-line);background:var(--theme-primary-soft);border-radius:var(--ui-radius-sm);border-left:4px solid var(--theme-primary)}
.ui-root .sbt-statusbox .ui-label{color:var(--theme-primary);font-weight:800}
.ui-root .sbt-statusbox .ui-input{font-size:14px;padding:8px 10px}
.ui-root .sbt-lv{font-size:11px;color:var(--theme-text-muted);border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);padding:2px 7px;display:inline-block}
.ui-root .sbt-nm{font-weight:600}
.ui-root .sbt-bulk{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid var(--theme-border);background:var(--theme-primary-soft)}
.ui-root .sbt-bulk .ui-input{width:auto;min-width:220px}
.ui-root .sbt-bcount{font-size:12.5px;font-weight:700;color:var(--theme-primary)}
.ui-root .sbt-split{display:grid;grid-template-columns:minmax(0,1fr) 360px}
@media (max-width:1040px){.ui-root .sbt-split{grid-template-columns:1fr}}
.ui-root .sbt-clist td{white-space:nowrap}
.ui-root .sbt-clist tbody tr[aria-selected="true"] td{background:var(--theme-primary-soft)}
.ui-root .sbt-chk{width:1%;padding-right:0}
.ui-root .sbt-chk .ui-check input{margin:0}
.ui-root .sbt-actcell{text-align:right;width:1%}
.ui-root .sbt-rowacts{display:inline-flex;gap:6px;opacity:0}
.ui-root .sbt-clist tr:hover .sbt-rowacts,.ui-root .sbt-clist tr[aria-selected="true"] .sbt-rowacts,.ui-root .sbt-rowacts:focus-within{opacity:1}
.ui-root .sbt-panel{border-left:1px solid var(--theme-border);background:var(--theme-surface-subtle);min-width:0}
@media (max-width:1040px){.ui-root .sbt-panel{border-left:none;border-top:1px solid var(--theme-border)}}
.ui-root .sbt-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 15px;border-bottom:1px solid var(--theme-border)}
.ui-root .sbt-ph b{font-size:14.5px;color:var(--theme-text)}
.ui-root .sbt-pb{padding:14px 15px;max-height:calc(100vh - 340px);min-height:200px;overflow-y:auto}
.ui-root .sbt-pa{padding:12px 15px;border-top:1px solid var(--theme-border);display:flex;justify-content:space-between;gap:8px}
.ui-root .sbt-fld{margin-bottom:11px}
.ui-root .sbt-v{font-size:13px;color:var(--theme-text);margin-top:2px;white-space:pre-wrap;word-break:break-word}
.ui-root .sbt-sheetwrap{overflow-x:auto;background:var(--theme-surface)}
.ui-root .sbt-sheetwrap[data-xscroll="true"]{padding-bottom:14px}
.ui-root .ui-table.sbt-sheet{border-collapse:separate;border-spacing:0;font-size:12.5px}
.ui-root .sbt-sheet th{background:var(--theme-surface-subtle);padding:8px 10px;position:sticky;top:0;z-index:2}
.ui-root .sbt-sheet td{padding:0;border-bottom:1px solid var(--theme-border-subtle)}
.ui-root .sbt-sheet tbody tr:hover td{background:var(--theme-surface-subtle)}
.ui-root .sbt-sheet .sbt-cellv{display:block;padding:8px 10px;color:var(--theme-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ui-root .sbt-sheet .ui-input.sbt-cell-sel{border-color:transparent;font-size:12.5px;padding:7px 10px}
.ui-root .sbt-sheet .ui-input.sbt-cell-sel:focus{box-shadow:inset 0 0 0 2px var(--theme-focus)}
.ui-root .sbt-sheet td.sbt-boolc{text-align:center}
.ui-root .sbt-sheet td.sbt-acts{text-align:right;white-space:nowrap;padding:0 8px}
.ui-root .sbt-sheet .sbt-frz{position:sticky;left:0;z-index:3;background:var(--theme-surface);border-right:1px solid var(--theme-border)}
.ui-root .sbt-sheet th.sbt-frz{z-index:4;background:var(--theme-surface-subtle)}
.ui-root .sbt-ft{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.ui-root .sbt-ft-l{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--theme-text-muted)}
.ui-root .sbt-ft-l .ui-input{width:auto;padding:5px 8px}
.ui-root.ui-pop.sbt-pop{width:288px;padding:8px}
.ui-root.ui-pop.sbt-qfpop{width:210px;padding:6px}
.ui-root.ui-pop.sbt-advpop{min-width:430px;max-width:calc(100vw - 16px);padding:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ui-root.sbt-advpop .ui-input{width:auto}
.ui-root.sbt-advpop .sbt-lbl{width:100%}
.ui-root.sbt-pop h4{margin:4px 6px 8px;font-size:11px;line-height:1.35;color:var(--theme-text-muted);font-weight:700}
.ui-root .sbt-pop-body{max-height:320px;overflow-y:auto}
.ui-root .sbt-prow{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:var(--ui-radius-sm)}
.ui-root .sbt-prow:hover{background:var(--theme-surface-subtle)}
.ui-root .sbt-prow[data-dragging="true"]{opacity:.5}
.ui-root .sbt-prow .ui-check{flex:1;align-items:center}
.ui-root .sbt-prow .ui-check input{margin:0}
.ui-root .sbt-pop-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 4px 2px;margin-top:6px;border-top:1px solid var(--theme-border)}
.ui-root .sbt-qffoot{display:flex;justify-content:flex-end;border-top:1px solid var(--theme-border);margin-top:5px;padding-top:5px}
.ui-root.ui-pop.sbt-menu{width:260px;padding:5px}
.ui-root.sbt-menu button{display:block;width:100%;text-align:left;font-family:inherit;font-size:12.5px;color:var(--theme-text);background:none;border:none;padding:8px 10px;border-radius:var(--ui-radius-sm);cursor:pointer}
.ui-root.sbt-menu button:hover:not(:disabled),.ui-root.sbt-menu button:focus-visible{background:var(--theme-surface-subtle);outline:none}
.ui-root.sbt-menu button:disabled{opacity:.55;cursor:default}
.ui-root.sbt-menu .sbt-sub{display:block;font-size:11px;color:var(--theme-text-muted);margin-top:2px}
.ui-root.sbt-menu button.sbt-warn{color:var(--theme-warning)}
.ui-root.sbt-menu .sbt-sep{height:1px;background:var(--theme-border);margin:4px 0}
.ui-root.sbt-menu .sbt-grp{padding:8px 10px 3px;font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--theme-text-muted)}
.ui-root .sbt-mws{display:flex;flex-direction:column;gap:12px}
`;

/** Read-only label + value block of the detail panel. */
export function DetailField({ label, children, style }: { label: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="ui-field sbt-fld" style={style}>
      <span className="ui-label">{label}</span>
      <div className="sbt-v">{children}</div>
    </div>
  );
}

/** Detail panel title row: name on the left, badge on the right. */
export function DetailHeader({ children }: { children: React.ReactNode }) {
  return <div className="sbt-ph">{children}</div>;
}

/** Scrolling detail panel body. */
export function DetailBody({ children }: { children: React.ReactNode }) {
  return <div className="sbt-pb">{children}</div>;
}

/** Detail panel action row. */
export function DetailFooter({ children }: { children: React.ReactNode }) {
  return <div className="sbt-pa">{children}</div>;
}

/** A toolbar dropdown button with its own anchored Popover. */
function MenuButton({
  label,
  active,
  open,
  onToggle,
  onClose,
  disabled,
  popClassName,
  role,
  children,
}: {
  label: React.ReactNode;
  active?: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  disabled?: boolean;
  popClassName: string;
  role?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button
        ref={ref}
        size="sm"
        variant="secondary"
        className={active ? 'sbt-qf-on' : undefined}
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onClick={onToggle}
      >
        {label}
        <IconChevronDown size={12} />
      </Button>
      <Popover open={open} anchorRef={ref} onClose={onClose} className={popClassName} role={role}>
        {children}
      </Popover>
    </>
  );
}

export default function SubmissionTablePage({ cfg }: { cfg: SubmissionTableCfg }) {
  // useFetchClient returns fresh function identities on every render, and the
  // list effect depends on `get`. Without this, an optimistic row edit
  // re-rendered the component and refetched the whole list as a side effect.
  const client = useFetchClient();
  const clientRef = React.useRef(client);
  clientRef.current = client;
  const get = React.useCallback((...args: Parameters<typeof client.get>) => clientRef.current.get(...args), []);
  const put = React.useCallback((...args: Parameters<typeof client.put>) => clientRef.current.put(...args), []);
  const del = React.useCallback((...args: Parameters<typeof client.del>) => clientRef.current.del(...args), []);
  const post = React.useCallback((...args: Parameters<typeof client.post>) => clientRef.current.post(...args), []);

  const allTags = React.useMemo(() => [...cfg.statuses, ...(cfg.extraTags ?? [])], [cfg]);
  const statusByValue = React.useMemo(
    () => Object.fromEntries(allTags.map((s) => [s.value, s])) as Record<string, StatusDef>,
    [allTags],
  );
  const statusOf = React.useCallback(
    (label: string): StatusDef => statusByValue[label] ?? cfg.statuses[0],
    [statusByValue, cfg],
  );
  const colLabel = React.useMemo(
    () => Object.fromEntries(cfg.filterColumns.map((c) => [c.key, c.label])) as Record<string, string>,
    [cfg],
  );
  const statusFilterValues = React.useMemo(
    () => [...cfg.statuses.map((s) => s.value), ...(cfg.archive ? ['Arhivat'] : [])],
    [cfg],
  );
  const fullCss = React.useMemo(() => `${TABLE_CSS}\n${cfg.extraCss ?? ''}`, [cfg]);

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
  // The header counters refresh on their own tick. A status edit changes them
  // without changing the visible rows, and rerunning the list query for that
  // blanked the table on every click.
  const [statTick, setStatTick] = React.useState(0);

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
  // Which quick-filter dropdown is open, by column key.
  const [quickOpen, setQuickOpen] = React.useState<string | null>(null);
  const [advOpen, setAdvOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);

  // Spreadsheet scroll container: `xscroll` adds a bottom gutter only while the
  // table really overflows, so the macOS overlay scrollbar stops sitting on top
  // of the last row and a table that fits keeps no empty gap.
  const sheetWrapRef = React.useRef<HTMLDivElement>(null);
  const [sheetXScroll, setSheetXScroll] = React.useState(false);

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
  }, [get, cfg, season, reloadTick, statTick]);

  const selected = React.useMemo(() => rows.find((r) => r.documentId === selectedId) ?? null, [rows, selectedId]);

  // Keep the first row open in compact view so the detail column is never empty.
  React.useEffect(() => {
    if (view !== 'compact') return;
    if (rows.length && !rows.some((r) => r.documentId === selectedId)) {
      setSelectedId(rows[0].documentId);
    }
  }, [view, rows, selectedId]);

  const refetch = React.useCallback(() => setReloadTick((n) => n + 1), []);
  const refetchStat = React.useCallback(() => setStatTick((n) => n + 1), []);

  // Only the very first load replaces the table with a placeholder. Later
  // fetches keep the rows on screen and dim them, so changing a filter does not
  // collapse the page to a single line and expand it again.
  const firstLoad = loading && rows.length === 0;

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
        toastAutosaved();
        // A season change moves the row out of the current view, so the list
        // must be refetched. A status change only moves the counters, unless a
        // status filter is active, in which case the row may now be excluded.
        if (key === 'season') refetch();
        else if (key === 'status') {
          refetchStat();
          if (filters.some((f) => f.col === 'status')) refetch();
        }
      } catch {
        setRows((cur) => cur.map((r) => (r.documentId === documentId ? { ...r, [key]: prev } : r)));
        adminToast.error(cfg.texts.saveError);
      }
    },
    [put, refetch, refetchStat, filters, cfg],
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
        adminToast.error(cfg.texts.deleteError);
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
    try {
      const r: any = await post(`${cfg.api}/move-season`, { documentIds: [...selectedIds], toSeason });
      adminToast.success(`Am mutat ${r?.data?.moved ?? 0} înscrieri în sezonul ${toSeason}.`);
      setBulkSeason('');
      refetch();
    } catch {
      adminToast.error('Mutarea în sezon a eșuat.');
    } finally {
      setBusy(false);
    }
  }, [post, bulkSeason, selectedIds, refetch, cfg]);

  const bulkArchive = React.useCallback(async () => {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    setBusy(true);
    try {
      await Promise.all([...selectedIds].map((id) => put(`${cfg.api}/${id}`, { archived: true })));
      adminToast.success(`Am arhivat ${n} înscrieri.`);
      refetch();
    } catch {
      adminToast.error('Arhivarea selecției a eșuat.');
    } finally {
      setBusy(false);
    }
  }, [put, selectedIds, refetch, cfg]);

  const bulkDelete = React.useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBusy(true);
    try {
      await Promise.all([...selectedIds].map((id) => del(`${cfg.api}/${id}`)));
      refetch();
    } catch {
      adminToast.error('Ștergerea selecției a eșuat.');
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
    try {
      const r: any = await post(`${cfg.api}/move-whole-season`, { fromSeason: from, toSeason: to, archivedOnly: mwsArchivedOnly });
      adminToast.success(`Am mutat ${r?.data?.moved ?? 0} înscrieri din ${from} în ${to}.`);
      setMwsOpen(false);
      setMwsTo('');
      setMwsArchivedOnly(false);
      refetch();
    } catch {
      adminToast.error('Mutarea sezonului a eșuat.');
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
      adminToast.error('Exportul CSV a eșuat.');
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
    try {
      const r: any = await post(`/api/sheets/${sheetsForm}/sync`, { mode: 'full' });
      const res = r?.data ?? {};
      if (res.ok) {
        adminToast.success(
          `Sincronizare completă: ${res.added ?? 0} adăugate, ${res.updated ?? 0} modificate, ${res.removed ?? 0} șterse.`,
        );
      } else {
        adminToast.error(res.message ?? 'Sincronizarea cu Google Sheets a eșuat.');
      }
      loadSheetLink();
    } catch {
      adminToast.error('Sincronizarea cu Google Sheets a eșuat.');
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
        .filter((c): c is { key: string; label: string } => Boolean(c))
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
  const colDrag = useDragReorder({
    count: colCfg.order.length,
    onMove: (from, to) => updateCfg({ ...colCfg, order: moveItem(colCfg.order, from, to) }),
    announce: (to, count) => `Coloana mutată pe poziția ${to + 1} din ${count}.`,
  });
  const resetCols = () => updateCfg({ order: [...defaultOrder], hidden: [...(cfg.defaultHidden ?? [])] });

  const statusTag = React.useCallback(
    (r: Row) => {
      const label = cfg.archive && r.archived ? 'Arhivat' : r.status;
      const s = statusOf(label);
      return (
        <StatusBadge className="sbt-tag" size="md" custom={{ fg: s.color, bg: s.soft, line: s.border }}>
          {label}
        </StatusBadge>
      );
    },
    [cfg, statusOf],
  );

  /** Status <select> tinted with the status colours (panel and spreadsheet cell). */
  const statusSelect = (r: Row, key: string, className: string, label: string) => {
    const value = String(r[key] ?? cfg.statuses[0].value);
    const s = statusOf(value);
    return (
      <Select
        className={className}
        aria-label={label}
        style={{ color: s.color, background: s.soft, borderColor: s.border }}
        value={value}
        onChange={(v) => saveField(r.documentId, key, v)}
        options={cfg.statuses.map((o) => ({ value: o.value, label: o.value }))}
      />
    );
  };

  // --- shared detail-panel blocks (identical on every screen)
  const statusBox = React.useCallback(
    (r: Row) => (
      <div className="sbt-statusbox">
        <Field label="Status">{statusSelect(r, 'status', 'sbt-status-sel', 'Status')}</Field>
      </div>
    ),
    // statusSelect only reads cfg, statusOf and saveField.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg, statusOf, saveField],
  );

  const seasonField = React.useCallback(
    (r: Row) => {
      if (!cfg.seasons) return null;
      const current = String(r.season ?? '');
      return (
        <Field label="Sezon" className="sbt-fld">
          <SeasonSelect
            value={current}
            seasons={seasons}
            activeSeason={activeSeason}
            onChange={(next) => {
              if (next !== current) saveField(r.documentId, 'season', next);
            }}
          />
        </Field>
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
            <DetailField key={c.key} label={c.label}>
              {extraValueText(ex[c.extraKey!])}
            </DetailField>
          ))}
        </div>
      );
    },
    [columns, formMeta],
  );

  const internalNoteField = React.useCallback(
    (r: Row) => (
      <Field label="Notă internă" className="sbt-fld">
        <Textarea
          rows={3}
          key={`${r.documentId}-internalNote`}
          defaultValue={String(r.internalNote ?? '')}
          onBlur={(e) => {
            if (e.target.value !== String(r.internalNote ?? ''))
              saveField(r.documentId, 'internalNote', e.target.value);
          }}
        />
      </Field>
    ),
    [saveField],
  );

  const api: TableApi = {
    columns,
    formMeta,
    seasons,
    activeSeason,
    statuses: cfg.statuses,
    statusOf,
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
      if (col.type === 'bool') return <span className="sbt-cellv">{v === true ? 'Da' : v === false ? 'Nu' : ''}</span>;
      return <span className="sbt-cellv">{v == null || v === '' ? '' : String(v)}</span>;
    }
    if (col.render) return <span className="sbt-cellv">{col.render(row)}</span>;
    if (col.type === 'date') {
      const raw = row[col.key];
      return <span className="sbt-cellv">{fmtDateTime(typeof raw === 'string' ? raw : null)}</span>;
    }
    // Status is the only editable data cell (unless the row is archived).
    if (col.type === 'status') {
      if (cfg.archive && row.archived) return <span className="sbt-cellv">Arhivat</span>;
      return statusSelect(row, col.key, 'sbt-cell-sel', `${col.label}: ${String(row[col.key] ?? '')}`);
    }
    const val = row[col.key];
    if (col.type === 'bool') return <span className="sbt-cellv">{val ? 'Da' : 'Nu'}</span>;
    if (col.type === 'list')
      return <span className="sbt-cellv">{Array.isArray(val) ? val.map((x) => String(x)).join(', ') : val == null || val === '' ? '' : String(val)}</span>;
    return <span className="sbt-cellv">{val == null || val === '' ? '' : String(val)}</span>;
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

  const statActions = (
    <>
      {cfg.seasons && (
        <div className="sbt-season">
          <span className="sbt-lbl">Sezon</span>
          <Select
            aria-label="Sezon"
            value={seasonSelectValue}
            onChange={(v) => {
              setSeason(v === 'all' ? 'all' : v);
              setPage(1);
            }}
            options={[
              ...seasons.map((s) => ({ value: s, label: `${s}${s === activeSeason ? ' (activ)' : ''}` })),
              { value: 'all', label: 'Toate sezoanele' },
            ]}
          />
          <Button size="sm" variant="secondary" onClick={() => setMwsOpen(true)}>
            Mută tot sezonul...
          </Button>
        </div>
      )}
      <div className="sbt-stat">
        <b className="ui-num">{seasonStat.total ?? '—'}</b> în total
        <br />
        <span className="sbt-noi ui-num">{seasonStat.noi ?? 0} noi</span>
        {cfg.texts.statSuffix}
      </div>
    </>
  );

  const columnsMenu = (
    <MenuButton
      label="Coloane"
      open={popOpen}
      onToggle={() => setPopOpen((o) => !o)}
      onClose={() => setPopOpen(false)}
      popClassName="sbt-pop"
    >
      <h4>Coloane: trage pentru a reordona, bifează ce se afișează</h4>
      <div className="sbt-pop-body">
        {colCfg.order.map((key, i) => {
          const c = colByKey[key];
          if (!c) return null;
          const shown = !colCfg.hidden.includes(key);
          return (
            <div key={key} className="sbt-prow" {...colDrag.itemProps(i)}>
              <button type="button" className="ui-iconbtn ui-iconbtn--sm ui-grip" aria-label={`Mută coloana ${c.label}`} {...colDrag.handleProps(i)}>
                <IconGrip size={12} />
              </button>
              <Checkbox checked={shown} onChange={() => toggleHidden(key)} label={c.label} />
            </div>
          );
        })}
      </div>
      {colDrag.live}
      <div className="sbt-pop-foot">
        <Button size="sm" variant="ghost" onClick={resetCols}>
          Resetează la implicit
        </Button>
        <Button size="sm" onClick={() => setPopOpen(false)}>
          Aplică
        </Button>
      </div>
    </MenuButton>
  );

  const exportMenu = (
    <MenuButton
      label="Export"
      open={exportOpen}
      onToggle={() => setExportOpen((o) => !o)}
      onClose={() => setExportOpen(false)}
      disabled={busy}
      popClassName="sbt-menu"
      role="menu"
    >
      <button type="button" role="menuitem" onClick={exportCsv} disabled={busy}>
        Descarcă CSV
      </button>
      {sheetsForm && <div className="sbt-sep" />}
      {sheetsForm && !sheetsConnected && (
        <button
          type="button"
          role="menuitem"
          className="sbt-warn"
          onClick={() => {
            setExportOpen(false);
            setSheetsOpen(true);
          }}
          disabled={busy}
        >
          Google Sheets
          <span className="sbt-sub">Google Sheet nu este conectat</span>
        </button>
      )}
      {sheetsForm && sheetsConnected && (
        <>
          <div className="sbt-grp">{sheetLink?.spreadsheetName || 'Foaie conectată'}</div>
          <button type="button" role="menuitem" onClick={syncSheetNow} disabled={busy}>
            Sincronizează acum
            {sheetLink?.lastSyncAt && <span className="sbt-sub">Ultima sincronizare {fmtSheetWhen(sheetLink.lastSyncAt)}</span>}
          </button>
          <button
            type="button"
            role="menuitem"
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
            role="menuitem"
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
    </MenuButton>
  );

  const quickMenus = quickCols.map((qc) => {
    const picked = quickSelected(qc.key);
    return (
      <MenuButton
        key={qc.key}
        label={`${qc.label}${picked.length ? ` (${picked.length})` : ''}`}
        active={picked.length > 0}
        open={quickOpen === qc.key}
        onToggle={() => {
          setAdvOpen(false);
          setQuickOpen((cur) => (cur === qc.key ? null : qc.key));
        }}
        onClose={() => setQuickOpen((cur) => (cur === qc.key ? null : cur))}
        popClassName="sbt-qfpop"
      >
        <div className="sbt-pop-body">
          {qc.options.map((v) => (
            <div className="sbt-prow" key={v}>
              <Checkbox checked={picked.includes(v)} onChange={() => toggleQuick(qc.key, v)} label={v} />
            </div>
          ))}
        </div>
        {picked.length > 0 && (
          <div className="sbt-qffoot">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFilters((all) => all.filter((x) => !(x.col === qc.key && (x.op === 'equals' || x.op === 'anyOf'))));
                setPage(1);
              }}
            >
              Șterge
            </Button>
          </div>
        )}
      </MenuButton>
    );
  });

  const advMenu = (
    <MenuButton
      label="Alte filtre"
      active={advOpen}
      open={advOpen}
      onToggle={() => {
        setQuickOpen(null);
        setAdvOpen((v) => !v);
      }}
      onClose={() => setAdvOpen(false)}
      popClassName="sbt-advpop"
    >
      <span className="sbt-lbl">Filtru:</span>
      <Select
        aria-label="Coloana filtrului"
        value={dCol}
        onChange={(v) => {
          setDCol(v);
          setDVal('');
          setDVals([]);
        }}
        options={cfg.filterColumns.map((c) => ({ value: c.key, label: c.label }))}
      />
      <Select
        aria-label="Operator"
        value={dOp}
        disabled={dColIsDate}
        onChange={(v) => setDOp(v)}
        options={dOpOptions.map((o) => ({ value: o.key, label: o.label }))}
      />
      {dColIsDate && dOpIsBetween ? (
        <>
          <DateInput aria-label="De la" value={dFrom || null} onChange={(v) => setDFrom(v ?? '')} />
          <DateInput aria-label="Până la" value={dTo || null} onChange={(v) => setDTo(v ?? '')} />
        </>
      ) : dColIsDate ? (
        <DateInput aria-label="Data" value={dFrom || null} onChange={(v) => setDFrom(v ?? '')} />
      ) : dValOptions ? (
        <Select
          aria-label="Valoare"
          value={dVal}
          onChange={(v) => setDVal(v)}
          style={{ minWidth: 160 }}
          placeholder="valoare"
          options={dValOptions.map((l) => ({ value: l, label: l }))}
        />
      ) : (
        <Input
          aria-label="Valoare"
          placeholder="valoare"
          value={dVal}
          onChange={(e) => setDVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addFilter();
          }}
          style={{ minWidth: 160, width: 'auto' }}
        />
      )}
      <Button size="sm" onClick={addFilter}>
        Adaugă filtru
      </Button>
    </MenuButton>
  );

  const bulkBar = cfg.bulk && selectedIds.size > 0 && (
    <div className="sbt-bulk">
      <span className="sbt-bcount">{selectedIds.size} selectate</span>
      {cfg.seasons && (
        <>
          <SeasonSelect
            aria-label="Sezon destinație"
            value={bulkSeason}
            seasons={seasons}
            activeSeason={activeSeason}
            onChange={setBulkSeason}
            emptyLabel="Sezon destinație..."
          />
          <Button size="sm" onClick={bulkMove} disabled={busy || !bulkSeason.trim()}>
            Mută în sezon
          </Button>
        </>
      )}
      {cfg.archive && (
        <Button size="sm" variant="secondary" onClick={bulkArchive} disabled={busy}>
          Arhivează
        </Button>
      )}
      <Button
        size="sm"
        variant="danger"
        onClick={() => {
          if (selectedIds.size > 0) setPendingConfirm({ kind: 'bulk', count: selectedIds.size });
        }}
        disabled={busy}
      >
        Șterge
      </Button>
      <span className="sbt-grow" />
      <Button size="sm" variant="secondary" onClick={clearSelection}>
        Deselectează
      </Button>
    </div>
  );

  const compactView = (
    <>
      {bulkBar}
      <div className="sbt-split">
        <div className="ui-table-wrap">
          <table className="ui-table sbt-clist">
            <thead>
              <tr>
                {cfg.bulk && (
                  <th className="sbt-chk">
                    <Checkbox
                      aria-label="Selectează toate"
                      checked={allPageSelected}
                      indeterminate={!allPageSelected && rows.some((r) => selectedIds.has(r.documentId))}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                {cfg.compact.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
                <th>
                  <span className="ui-sr">Acțiuni</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.documentId}
                  className="ui-table-click"
                  aria-selected={selectedId === r.documentId}
                  onClick={() => setSelectedId(r.documentId)}
                >
                  {cfg.bulk && (
                    // The row opens the detail panel on click; the checkbox only selects.
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
                    <td className="sbt-chk" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        aria-label="Selectează rândul"
                        checked={selectedIds.has(r.documentId)}
                        onChange={() => toggleSelect(r.documentId)}
                      />
                    </td>
                  )}
                  {cfg.compact.renderCells(r, api)}
                  <td className="sbt-actcell">
                    <span className="sbt-rowacts">
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRow(r.documentId);
                        }}
                      >
                        Șterge
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && <div className="sbt-panel">{cfg.compact.renderDetail(selected, api)}</div>}
      </div>
    </>
  );

  const sheetView = (
    <div ref={sheetWrapRef} className="sbt-sheetwrap" data-xscroll={sheetXScroll ? 'true' : undefined}>
      <table className="ui-table sbt-sheet">
        <thead>
          <tr>
            {visibleOrder.map((key, i) => {
              const c = colByKey[key];
              if (!c) return null;
              return (
                <th key={key} className={i === 0 ? 'sbt-frz' : undefined} style={{ minWidth: c.width, left: i === 0 ? 0 : undefined }}>
                  {c.label}
                </th>
              );
            })}
            <th style={{ minWidth: 150 }}>
              <span className="ui-sr">Acțiuni</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.documentId}>
              {visibleOrder.map((key, i) => {
                const c = colByKey[key];
                if (!c) return null;
                return (
                  <td key={key} className={cx(i === 0 && 'sbt-frz', c.type === 'bool' && 'sbt-boolc')} style={{ minWidth: c.width }}>
                    {renderCellInput(r, c)}
                  </td>
                );
              })}
              <td className="sbt-acts">
                <Button size="sm" variant="danger" onClick={() => removeRow(r.documentId)}>
                  Șterge
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <AdminPage>
      <style>{fullCss}</style>

      <Window>
        <PageHeader title={cfg.texts.title} subtitle={cfg.texts.subtitle} actions={statActions} />

        {/* toolbar A: search, view, columns, export */}
        <div className="ui-table-bar">
          <div className="ui-table-search">
            <Input
              type="search"
              aria-label="Caută"
              placeholder={cfg.texts.searchPlaceholder}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <SegmentedControl<'compact' | 'full'>
            size="sm"
            aria-label="Vizualizare"
            value={view}
            onChange={setView}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'full', label: 'Toate coloanele' },
            ]}
          />
          {view === 'full' && columnsMenu}
          {exportMenu}
        </div>

        {/* toolbar B: quick filters, the builder behind a dropdown, sort */}
        <div className="sbt-tbB">
          {quickMenus}
          {advMenu}
          <span className="sbt-grow" />
          <span className="sbt-lbl">Sortare:</span>
          <Select
            aria-label="Sortare"
            value={sort}
            onChange={(v) => {
              setSort(v as 'newest' | 'oldest' | 'name');
              setPage(1);
            }}
            options={[
              { value: 'newest', label: 'Cele mai noi' },
              { value: 'oldest', label: 'Cele mai vechi' },
              { value: 'name', label: 'Nume A-Z' },
            ]}
          />
        </div>

        {/* active filter chips */}
        {filters.length > 0 && (
          <div className="sbt-chips">
            <ChipList>
              {filters.map((f) => (
                <Chip key={f.id} onRemove={() => removeFilter(f.id)} removeLabel="Elimină filtrul">
                  {chipText(f)}
                </Chip>
              ))}
            </ChipList>
            <span className="sbt-lbl">
              {filters.length} {filters.length === 1 ? 'filtru activ' : 'filtre active'}
            </span>
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Șterge filtrele
            </Button>
          </div>
        )}

        {/* content */}
        <div className="sbt-listbody" data-busy={loading && !firstLoad ? 'true' : undefined} aria-busy={loading}>
          {firstLoad ? (
            <Loading />
          ) : error ? (
            <EmptyState>{cfg.texts.loadError}</EmptyState>
          ) : rows.length === 0 ? (
            <EmptyState>{cfg.texts.empty}</EmptyState>
          ) : view === 'compact' ? (
            compactView
          ) : (
            sheetView
          )}
        </div>

        {/* footer: page size + pager */}
        {!firstLoad && !error && rows.length > 0 && (
          <div className="ui-table-pager sbt-ft">
            <div className="sbt-ft-l">
              Rânduri pe pagină:
              <Select
                aria-label="Rânduri pe pagină"
                value={String(pageSize)}
                onChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
                options={[
                  { value: '25', label: '25' },
                  { value: '50', label: '50' },
                  { value: '100', label: '100' },
                ]}
              />
            </div>
            <Pager
              page={pagination.page}
              pageCount={pagination.pageCount}
              total={pagination.total}
              pageSize={pagination.pageSize}
              onChange={(p) => setPage(Math.max(1, Math.min(pagination.pageCount, p)))}
            />
          </div>
        )}
      </Window>

      {cfg.seasons && (
        <Modal
          open={mwsOpen}
          onClose={() => setMwsOpen(false)}
          dismissable={!busy}
          title="Mută tot sezonul"
          footer={
            <>
              <Button variant="secondary" onClick={() => setMwsOpen(false)} disabled={busy}>
                Anulează
              </Button>
              <Button onClick={moveWholeSeason} loading={busy} disabled={!mwsTo.trim() || !(season || activeSeason)}>
                Mută
              </Button>
            </>
          }
        >
          <div className="sbt-mws">
            <Field label="Din sezonul">
              <Input readOnly value={season || activeSeason || '—'} />
            </Field>
            <Field label="În sezonul">
              <SeasonSelect
                value={mwsTo}
                seasons={seasons}
                activeSeason={activeSeason}
                onChange={setMwsTo}
                emptyLabel="Alege sezonul..."
                style={{ width: '100%' }}
              />
            </Field>
            <Checkbox checked={mwsArchivedOnly} onChange={setMwsArchivedOnly} label="Doar înscrierile arhivate" />
          </div>
        </Modal>
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
    </AdminPage>
  );
}
