import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';

/**
 * EduSport admin — "Înscrieri" results page.
 *
 * Registered as an admin route (see ./menu.tsx) so it renders inside Strapi's
 * providers and can use useFetchClient. All filtering / sorting / pagination is
 * done server-side by the admin-guarded endpoints on the
 * registration-submission API:
 *   GET    /api/forms/inscrieri
 *            ?season&archived&q&filters&sort&page&pageSize
 *            -> { data, pagination, seasons, activeSeason }
 *   PUT    /api/forms/inscrieri/:documentId     update editable field / archive
 *   DELETE /api/forms/inscrieri/:documentId     permanent delete
 *   GET    /api/forms/inscrieri/export.csv        CSV (respects season+filters)
 *   POST   /api/forms/inscrieri/export-sheets     Sheets (respects season+filters)
 *
 * The page owns season / archived / q / filters / sort / page / pageSize state
 * and refetches on any change (search is debounced). Two views: a Compact list
 * (key columns + a read-only detail panel; only Stare + Notă editable) and a
 * read-only "Toate coloanele" spreadsheet (only Stare editable). Light-only,
 * using the shared admin tokens (system-ui, #fff, #dcdcdc borders, accent
 * #2138b8, danger #be3330, #d0d0d0 fields, squared buttons; horizontal row
 * separators only).
 */

const API = '/api/forms/inscrieri';

const LEVELS = [
  'Nu a mai patinat',
  'A mai patinat in alta parte',
  'Incepatori',
  'Intermediari',
  'Avansati',
  'Performanta',
] as const;

const STATUSES = ['Nou', 'Contactat', 'Confirmat', 'Respins'] as const;
type Status = (typeof STATUSES)[number];

// Uniform-width status tags (min-width, centered) so every state aligns.
const TAG_CLASS: Record<string, string> = {
  Nou: 't-nou',
  Contactat: 't-contactat',
  Confirmat: 't-confirmat',
  Respins: 't-respins',
  Arhivat: 't-arhivat',
};

// Filter-builder column options (map to whitelisted server fields).
const FILTER_COLUMNS = [
  { key: 'childName', label: 'Nume copil' },
  { key: 'parentName', label: 'Nume părinte' },
  { key: 'level', label: 'Nivel' },
  { key: 'status', label: 'Status' },
  { key: 'phone', label: 'Telefon' },
  { key: 'email', label: 'Email' },
  { key: 'submittedAt', label: 'Data înscrierii' },
] as const;
const COL_LABEL: Record<string, string> = Object.fromEntries(FILTER_COLUMNS.map((c) => [c.key, c.label]));

const OPERATORS = [
  { key: 'contains', label: 'conține' },
  { key: 'equals', label: 'este' },
  { key: 'startsWith', label: 'începe cu' },
  { key: 'between', label: 'între (date)' },
] as const;
const OP_LABEL: Record<string, string> = Object.fromEntries(OPERATORS.map((o) => [o.key, o.label]));

const STATUS_VALUES = [...STATUSES, 'Arhivat'] as const;

type ColType = 'date' | 'status' | 'level' | 'text' | 'bool' | 'longtext';

interface ColumnDef {
  key: string;
  label: string;
  type: ColType;
  readOnly?: boolean;
  width: number;
}

const COLUMNS: ColumnDef[] = [
  { key: 'submittedAt', label: 'Trimis la', type: 'date', readOnly: true, width: 150 },
  { key: 'status', label: 'Stare', type: 'status', width: 130 },
  { key: 'childName', label: 'Nume copil', type: 'text', width: 170 },
  { key: 'childBirthDate', label: 'Data nașterii', type: 'text', width: 150 },
  { key: 'parentName', label: 'Nume părinte', type: 'text', width: 170 },
  { key: 'email', label: 'Email', type: 'text', width: 210 },
  { key: 'phone', label: 'Telefon', type: 'text', width: 140 },
  { key: 'level', label: 'Nivel', type: 'level', width: 190 },
  { key: 'shirtSize', label: 'Mărime tricou', type: 'text', width: 120 },
  { key: 'howHeard', label: 'Cum a aflat', type: 'text', width: 170 },
  { key: 'clubInterest', label: 'Interes club', type: 'bool', width: 110 },
  { key: 'regulationsAgreement', label: 'Acord regulament', type: 'bool', width: 150 },
  { key: 'privacyConsent', label: 'Confidențialitate', type: 'bool', width: 140 },
  { key: 'priorExperience', label: 'Experiență anterioară', type: 'longtext', width: 240 },
  { key: 'expectations', label: 'Așteptări', type: 'longtext', width: 240 },
  { key: 'internalNote', label: 'Notă internă', type: 'longtext', width: 240 },
];
const COL_BY_KEY: Record<string, ColumnDef> = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));
const DEFAULT_ORDER = COLUMNS.map((c) => c.key);

// Compact list key columns.
const COMPACT_KEYS = ['submittedAt', 'childName', 'parentName', 'level', 'status'];

interface Submission {
  documentId: string;
  email: string;
  phone: string;
  childName: string;
  childBirthDate: string;
  parentName: string;
  shirtSize: string;
  howHeard: string;
  level: string;
  priorExperience: string | null;
  expectations: string | null;
  clubInterest: boolean;
  regulationsAgreement: boolean;
  privacyConsent: boolean;
  status: string;
  internalNote: string | null;
  submittedAt: string | null;
  season: string | null;
  archived: boolean;
  [k: string]: unknown;
}

interface Pagination {
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
}

const RO_MON_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
function fmtDateTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${RO_MON_SHORT[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDateShort(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getDate()} ${RO_MON_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function loadColConfig(userKey: string): ColConfig {
  try {
    const raw = localStorage.getItem(`edusport-inscrieri-cols-${userKey}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ColConfig>;
      const known = new Set(DEFAULT_ORDER);
      const order = (parsed.order ?? DEFAULT_ORDER).filter((k) => known.has(k));
      for (const k of DEFAULT_ORDER) if (!order.includes(k)) order.push(k);
      const hidden = (parsed.hidden ?? []).filter((k) => known.has(k));
      return { order, hidden };
    }
  } catch {
    /* ignore */
  }
  return { order: [...DEFAULT_ORDER], hidden: [] };
}
function saveColConfig(userKey: string, cfg: ColConfig) {
  try {
    localStorage.setItem(`edusport-inscrieri-cols-${userKey}`, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

const CSS = `
.insp{--bg:#eef0f4;--chrome:#fff;--ink:#1b1d22;--muted:#727888;--line:#e0e2e8;--border:#dcdcdc;
  --accent:#2138b8;--accent-soft:#eef1fb;--danger:#be3330;--field:#f7f8fa;
  --nou:#2138b8;--nou-s:#eef1fb;--contactat:#00757f;--contactat-s:#e2f4f5;
  --confirmat:#1f7a4d;--confirmat-s:#e5f3ec;--respins:#be3330;--respins-s:#fbeeed;
  --arhivat:#6a6e7a;--arhivat-s:#eceef2;--r:5px;--r2:4px;
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

/* toolbar B */
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
.t-nou{color:var(--nou);background:var(--nou-s)}
.t-contactat{color:var(--contactat);background:var(--contactat-s)}
.t-confirmat{color:var(--confirmat);background:var(--confirmat-s)}
.t-respins{color:var(--respins);background:var(--respins-s)}
.t-arhivat{color:var(--arhivat);background:var(--arhivat-s)}
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
.fld .v{font-size:13px;color:var(--ink);margin-top:2px;white-space:pre-wrap;word-break:break-word}
.fld select,.fld textarea{width:100%}
.fld textarea{font-family:inherit;font-size:13px;border:1px solid var(--line);border-radius:var(--r2);padding:7px 9px;resize:vertical;background:var(--field)}
.fld textarea:focus{outline:none;border-color:var(--accent)}
.pa{padding:12px 15px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:8px}

/* spreadsheet */
.sheetwrap{overflow-x:auto;background:#fff}
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
.menu{position:absolute;right:0;top:calc(100% + 6px);z-index:20;width:200px;background:#fff;border:1px solid var(--border);border-radius:var(--r);box-shadow:0 8px 28px rgba(0,0,0,.14);padding:5px}
.menu button{display:block;width:100%;text-align:left;font-family:inherit;font-size:12.5px;color:var(--ink);background:none;border:none;padding:8px 10px;border-radius:var(--r2);cursor:pointer}
.menu button:hover{background:#f6f7f9}
.menu button:disabled{opacity:.55;cursor:default}

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

export default function InscrieriPage() {
  const { get, put, del, post } = useFetchClient();

  const [userKey, setUserKey] = React.useState<string>('anon');
  const [rows, setRows] = React.useState<Submission[]>([]);
  const [pagination, setPagination] = React.useState<Pagination>({ page: 1, pageSize: 25, total: 0, pageCount: 1 });
  const [seasons, setSeasons] = React.useState<string[]>([]);
  const [activeSeason, setActiveSeason] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  // stat overview for the current season (non-archived)
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
  const [dCol, setDCol] = React.useState('childName');
  const [dOp, setDOp] = React.useState('contains');
  const [dVal, setDVal] = React.useState('');
  const [dFrom, setDFrom] = React.useState('');
  const [dTo, setDTo] = React.useState('');

  // full-view column config
  const [colCfg, setColCfg] = React.useState<ColConfig>(() => loadColConfig('anon'));
  const [popOpen, setPopOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [dragKey, setDragKey] = React.useState<string | null>(null);
  const [overKey, setOverKey] = React.useState<string | null>(null);

  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

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
        setColCfg(loadColConfig(key));
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [get]);

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
    const params: Record<string, unknown> = { page, pageSize, sort, archived: archivedParam };
    if (season) params.season = season;
    if (search) params.q = search;
    if (serverFilters.length) params.filters = serverFiltersKey;
    get(API, { params })
      .then((r: any) => {
        if (off) return;
        const body = r?.data ?? {};
        setRows(Array.isArray(body.data) ? (body.data as Submission[]) : []);
        if (body.pagination) setPagination(body.pagination as Pagination);
        if (Array.isArray(body.seasons)) setSeasons(body.seasons as string[]);
        if (typeof body.activeSeason === 'string' || body.activeSeason === null) setActiveSeason(body.activeSeason);
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
  }, [get, page, pageSize, sort, season, search, archivedParam, serverFiltersKey, serverFilters.length, reloadTick]);

  // --- season overview stat (season, non-archived): total + noi
  React.useEffect(() => {
    let off = false;
    const totalOf = (r: any) => (typeof r?.data?.pagination?.total === 'number' ? r.data.pagination.total : null);
    const base: Record<string, unknown> = { pageSize: 1, archived: 'false' };
    if (season) base.season = season;
    const nouFilter = JSON.stringify([{ col: 'status', op: 'equals', val: 'Nou' }]);
    const total = get(API, { params: base }).then(totalOf).catch(() => null);
    const noi = get(API, { params: { ...base, filters: nouFilter } }).then(totalOf).catch(() => null);
    Promise.all([total, noi]).then(([t, n]) => {
      if (!off) setSeasonStat({ total: t, noi: n });
    });
    return () => {
      off = true;
    };
  }, [get, season, reloadTick]);

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
        await put(`${API}/${documentId}`, { [key]: value });
        // status change can move the "noi" stat; a season change moves the row
        // out of the current season view — refetch in both cases.
        if (key === 'status' || key === 'season') refetch();
      } catch {
        setRows((cur) => cur.map((r) => (r.documentId === documentId ? { ...r, [key]: prev } : r)));
        setMsg({ kind: 'err', text: 'Nu am putut salva modificarea.' });
      }
    },
    [put, refetch],
  );

  // --- archive / restore: row leaves the current view, so refetch
  const setArchived = React.useCallback(
    async (documentId: string, next: boolean) => {
      try {
        await put(`${API}/${documentId}`, { archived: next });
        refetch();
        setMsg({ kind: 'ok', text: next ? 'Înscrierea a fost arhivată.' : 'Înscrierea a fost restaurată.' });
      } catch {
        setMsg({ kind: 'err', text: 'Nu am putut actualiza arhivarea.' });
      }
    },
    [put, refetch],
  );

  const removeRow = React.useCallback(
    async (documentId: string) => {
      if (!window.confirm('Ștergi definitiv această înscriere? Acțiunea nu poate fi anulată.')) return;
      try {
        await del(`${API}/${documentId}`);
        refetch();
      } catch {
        setMsg({ kind: 'err', text: 'Nu am putut șterge înscrierea.' });
      }
    },
    [del, refetch],
  );

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
      const r: any = await post(`${API}/move-season`, { documentIds: [...selectedIds], toSeason });
      setMsg({ kind: 'ok', text: `Am mutat ${r?.data?.moved ?? 0} înscrieri în sezonul ${toSeason}.` });
      setBulkSeason('');
      refetch();
    } catch {
      setMsg({ kind: 'err', text: 'Mutarea în sezon a eșuat.' });
    } finally {
      setBusy(false);
    }
  }, [post, bulkSeason, selectedIds, refetch]);

  const bulkArchive = React.useCallback(async () => {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    setBusy(true);
    setMsg(null);
    try {
      await Promise.all([...selectedIds].map((id) => put(`${API}/${id}`, { archived: true })));
      setMsg({ kind: 'ok', text: `Am arhivat ${n} înscrieri.` });
      refetch();
    } catch {
      setMsg({ kind: 'err', text: 'Arhivarea selecției a eșuat.' });
    } finally {
      setBusy(false);
    }
  }, [put, selectedIds, refetch]);

  const bulkDelete = React.useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Ștergi definitiv ${selectedIds.size} înscrieri? Acțiunea nu poate fi anulată.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await Promise.all([...selectedIds].map((id) => del(`${API}/${id}`)));
      refetch();
    } catch {
      setMsg({ kind: 'err', text: 'Ștergerea selecției a eșuat.' });
    } finally {
      setBusy(false);
    }
  }, [del, selectedIds, refetch]);

  const moveWholeSeason = React.useCallback(async () => {
    const from = season || activeSeason || '';
    const to = mwsTo.trim();
    if (!from || !to) return;
    setBusy(true);
    setMsg(null);
    try {
      const r: any = await post(`${API}/move-whole-season`, { fromSeason: from, toSeason: to, archivedOnly: mwsArchivedOnly });
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
  }, [post, season, activeSeason, mwsTo, mwsArchivedOnly, refetch]);

  // --- export query mirrors the current view (season/archived/q/filters/sort)
  const exportParams = React.useCallback(() => {
    const p: Record<string, unknown> = { sort, archived: archivedParam };
    if (season) p.season = season;
    if (search) p.q = search;
    if (serverFilters.length) p.filters = serverFiltersKey;
    return p;
  }, [sort, archivedParam, season, search, serverFilters.length, serverFiltersKey]);

  const exportCsv = React.useCallback(async () => {
    setExportOpen(false);
    setBusy(true);
    setMsg(null);
    try {
      const r: any = await get(`${API}/export.csv`, { params: exportParams() });
      const csv = typeof r?.data === 'string' ? r.data : '';
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inscrieri-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMsg({ kind: 'err', text: 'Exportul CSV a eșuat.' });
    } finally {
      setBusy(false);
    }
  }, [get, exportParams]);

  const exportSheets = React.useCallback(async () => {
    setExportOpen(false);
    setBusy(true);
    setMsg(null);
    try {
      const r: any = await post(`${API}/export-sheets`, exportParams());
      const res = r?.data ?? {};
      if (res.ok) {
        setMsg({ kind: 'ok', text: `Am exportat ${res.appended ?? 0} înscrieri în Google Sheets.` });
        if (res.spreadsheetUrl) window.open(res.spreadsheetUrl, '_blank', 'noopener');
      } else if (res.configured === false) {
        setMsg({ kind: 'warn', text: 'Google Sheets nu este configurat încă. Adaugă credențialele în variabilele de mediu.' });
      } else {
        setMsg({ kind: 'err', text: 'Exportul în Google Sheets a eșuat.' });
      }
    } catch {
      setMsg({ kind: 'err', text: 'Exportul în Google Sheets a eșuat.' });
    } finally {
      setBusy(false);
    }
  }, [post, exportParams]);

  // --- filter builder actions
  const addFilter = () => {
    const isDate = dOp === 'between';
    if (isDate) {
      if (!dFrom && !dTo) return;
    } else if (!dVal.trim()) {
      return;
    }
    const f: ActiveFilter = isDate
      ? { id: `${Date.now()}-${Math.random()}`, col: dCol, op: 'between', val: '', from: dFrom, to: dTo }
      : { id: `${Date.now()}-${Math.random()}`, col: dCol, op: dOp, val: dVal.trim() };
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

  const chipText = (f: ActiveFilter): string => {
    const label = COL_LABEL[f.col] ?? f.col;
    if (f.op === 'between') return `${label}: între ${f.from || '...'} și ${f.to || '...'}`;
    if (f.op === 'equals') return `${label}: ${f.val}`;
    return `${label} ${OP_LABEL[f.op] ?? f.op} „${f.val}"`;
  };

  // --- column popover (full view)
  const visibleOrder = colCfg.order.filter((k) => !colCfg.hidden.includes(k));
  const updateCfg = (next: ColConfig) => {
    setColCfg(next);
    saveColConfig(userKey, next);
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
  const resetCols = () => updateCfg({ order: [...DEFAULT_ORDER], hidden: [] });

  const statusTag = (r: Submission) => {
    const label = r.archived ? 'Arhivat' : r.status;
    return <span className={`tag ${TAG_CLASS[label] ?? 't-nou'}`}>{label}</span>;
  };

  const renderCellInput = (row: Submission, col: ColumnDef) => {
    const val = row[col.key];
    if (col.type === 'date' || col.readOnly) return <span className="cellv">{fmtDateTime(row.submittedAt)}</span>;
    if (col.type === 'status') {
      if (row.archived) return <span className="cellv">Arhivat</span>;
      return (
        <select value={String(val ?? 'Nou')} onChange={(e) => saveField(row.documentId, col.key, e.target.value as Status)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      );
    }
    if (col.type === 'bool') return <span className="cellv">{val ? 'Da' : 'Nu'}</span>;
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

  const dColIsStatus = dCol === 'status';
  const dColIsLevel = dCol === 'level';
  const dOpIsBetween = dOp === 'between';

  return (
    <div className="insp">
      <style>{CSS}</style>
      <datalist id="insp-seasons">
        {seasons.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="win">
        {/* header */}
        <div className="hd">
          <div>
            <h1>Înscrieri</h1>
            <p>Cererile trimise prin formularul public de înscriere.</p>
          </div>
          <div className="hd-right">
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
            <div className="stat">
              <b className="num">{seasonStat.total ?? '—'}</b> în total
              <br />
              <span className="noi num">{seasonStat.noi ?? 0} noi</span> · exclus arhivate
            </div>
          </div>
        </div>

        {/* toolbar A */}
        <div className="tbA">
          <div className="search">
            <span aria-hidden="true">⌕</span>
            <input
              placeholder="Caută rapid în toate câmpurile..."
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
              <button className="btn sm" type="button" onClick={() => setPopOpen((o) => !o)}>
                Coloane ▾
              </button>
              {popOpen && (
                <div className="pop">
                  <h4>Coloane: trage pentru a reordona, bifează ce se afișează</h4>
                  <div className="pop-body">
                    {colCfg.order.map((key) => {
                      const c = COL_BY_KEY[key];
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
                <button type="button" onClick={exportSheets} disabled={busy}>
                  Google Sheets
                </button>
              </div>
            )}
          </div>
        </div>

        {/* toolbar B: filter builder */}
        <div className="tbB">
          <span className="lbl">Filtru:</span>
          <select
            value={dCol}
            onChange={(e) => {
              setDCol(e.target.value);
              setDVal('');
            }}
          >
            {FILTER_COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <select value={dOp} onChange={(e) => setDOp(e.target.value)}>
            {OPERATORS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          {dOpIsBetween ? (
            <>
              <input type="date" value={dFrom} onChange={(e) => setDFrom(e.target.value)} />
              <input type="date" value={dTo} onChange={(e) => setDTo(e.target.value)} />
            </>
          ) : dColIsStatus ? (
            <select value={dVal} onChange={(e) => setDVal(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">valoare</option>
              {STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : dColIsLevel ? (
            <select value={dVal} onChange={(e) => setDVal(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">valoare</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          ) : (
            <input placeholder="valoare" value={dVal} onChange={(e) => setDVal(e.target.value)} style={{ minWidth: 160 }} />
          )}
          <button className="btn sm pri" type="button" onClick={addFilter}>
            + Adaugă filtru
          </button>
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
              · {filters.length} {filters.length === 1 ? 'filtru activ' : 'filtre active'}
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
          <div className="insp-empty">Nu am putut încărca înscrierile.</div>
        ) : rows.length === 0 ? (
          <div className="insp-empty">Nicio înscriere pentru filtrul curent.</div>
        ) : view === 'compact' ? (
          <>
            {selectedIds.size > 0 && (
              <div className="bulkbar">
                <span className="bcount">{selectedIds.size} selectate</span>
                <input
                  list="insp-seasons"
                  placeholder="Sezon destinație (ex. 2025-2026)"
                  value={bulkSeason}
                  onChange={(e) => setBulkSeason(e.target.value)}
                  style={{ minWidth: 220 }}
                />
                <button className="btn sm pri" type="button" onClick={bulkMove} disabled={busy || !bulkSeason.trim()}>
                  Mută în sezon
                </button>
                <button className="btn sm" type="button" onClick={bulkArchive} disabled={busy}>
                  Arhivează
                </button>
                <button className="btn sm danger" type="button" onClick={bulkDelete} disabled={busy}>
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
                      <th className="chkc">
                        <input
                          type="checkbox"
                          className="chk"
                          aria-label="Selectează toate"
                          checked={allPageSelected}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>Trimis la</th>
                      <th>Nume copil</th>
                      <th>Nume părinte</th>
                      <th>Nivel</th>
                      <th>Status</th>
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
                      <td className="chkc" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="chk"
                          aria-label="Selectează rândul"
                          checked={selectedIds.has(r.documentId)}
                          onChange={() => toggleSelect(r.documentId)}
                        />
                      </td>
                      <td className="sub num">{fmtDateShort(r.submittedAt)}</td>
                      <td className="nm">{r.childName}</td>
                      <td>{r.parentName}</td>
                      <td>
                        <span className="lvchip">{r.level}</span>
                      </td>
                      <td>{statusTag(r)}</td>
                      <td className="actcell">
                        <span className="rowacts">
                          {r.archived ? (
                            <button
                              type="button"
                              className="ra"
                              onClick={(e) => {
                                e.stopPropagation();
                                setArchived(r.documentId, false);
                              }}
                            >
                              Restaurează
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="ra"
                              onClick={(e) => {
                                e.stopPropagation();
                                setArchived(r.documentId, true);
                              }}
                            >
                              Arhivează
                            </button>
                          )}
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

            {selected && (
              <div className="panel">
                <div className="ph">
                  <b>{selected.childName}</b>
                  {statusTag(selected)}
                </div>
                <div className="pb">
                  <div className="fld">
                    <label>Trimis la</label>
                    <div className="v">{fmtDateTime(selected.submittedAt)}</div>
                  </div>
                  <div className="fld">
                    <label>Stare</label>
                    <select value={selected.status} onChange={(e) => saveField(selected.documentId, 'status', e.target.value)}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="fld">
                    <label>Arhivare</label>
                    <div className="v">{selected.archived ? 'Arhivat' : 'Activ'}</div>
                  </div>
                  <div className="fld">
                    <label>Sezon</label>
                    <input
                      list="insp-seasons"
                      key={`${selected.documentId}-season`}
                      defaultValue={String(selected.season ?? '')}
                      placeholder="ex. 2025-2026"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== String(selected.season ?? '')) saveField(selected.documentId, 'season', v);
                      }}
                    />
                  </div>
                  {(
                    [
                      ['childBirthDate', 'Data nașterii'],
                      ['parentName', 'Nume părinte'],
                      ['email', 'Email'],
                      ['phone', 'Telefon'],
                      ['shirtSize', 'Mărime tricou'],
                      ['howHeard', 'Cum a aflat'],
                      ['level', 'Nivel'],
                    ] as Array<[string, string]>
                  ).map(([key, label]) => (
                    <div className="fld" key={key}>
                      <label>{label}</label>
                      <div className="v">{String(selected[key] ?? '') || '—'}</div>
                    </div>
                  ))}
                  <div className="fld">
                    <label>Interes club</label>
                    <div className="v">{selected.clubInterest ? 'Da' : 'Nu'}</div>
                  </div>
                  <div className="fld">
                    <label>Acord regulament</label>
                    <div className="v">{selected.regulationsAgreement ? 'Da' : 'Nu'}</div>
                  </div>
                  <div className="fld">
                    <label>Acord confidențialitate</label>
                    <div className="v">{selected.privacyConsent ? 'Da' : 'Nu'}</div>
                  </div>
                  <div className="fld" style={{ marginTop: 11 }}>
                    <label>Experiență anterioară</label>
                    <div className="v">{String(selected.priorExperience ?? '') || '—'}</div>
                  </div>
                  <div className="fld">
                    <label>Așteptări</label>
                    <div className="v">{String(selected.expectations ?? '') || '—'}</div>
                  </div>
                  <div className="fld">
                    <label>Notă internă</label>
                    <textarea
                      rows={3}
                      key={`${selected.documentId}-internalNote`}
                      defaultValue={String(selected.internalNote ?? '')}
                      onBlur={(e) => {
                        if (e.target.value !== String(selected.internalNote ?? ''))
                          saveField(selected.documentId, 'internalNote', e.target.value);
                      }}
                    />
                  </div>
                </div>
                <div className="pa">
                  {selected.archived ? (
                    <button className="btn sm" type="button" onClick={() => setArchived(selected.documentId, false)}>
                      Restaurează
                    </button>
                  ) : (
                    <button className="btn sm" type="button" onClick={() => setArchived(selected.documentId, true)}>
                      Arhivează
                    </button>
                  )}
                  <button className="btn danger sm" type="button" onClick={() => removeRow(selected.documentId)}>
                    Șterge înscrierea
                  </button>
                </div>
              </div>
            )}
            </div>
          </>
        ) : (
          // ---- spreadsheet view ----
          <div className="sheetwrap">
            <table className="sheet">
              <thead>
                <tr>
                  {visibleOrder.map((key, i) => (
                    <th key={key} className={i === 0 ? 'frz' : ''} style={{ minWidth: COL_BY_KEY[key].width, left: i === 0 ? 0 : undefined }}>
                      {COL_BY_KEY[key].label}
                    </th>
                  ))}
                  <th style={{ minWidth: 150 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.documentId}>
                    {visibleOrder.map((key, i) => {
                      const c = COL_BY_KEY[key];
                      const isBool = c.type === 'bool';
                      return (
                        <td key={key} className={`${i === 0 ? 'frz' : ''} ${isBool ? 'boolc' : ''}`} style={{ minWidth: c.width }}>
                          {renderCellInput(r, c)}
                        </td>
                      );
                    })}
                    <td className="acts">
                      <span className="rowacts" style={{ opacity: 1 }}>
                        {r.archived ? (
                          <button type="button" className="ra" onClick={() => setArchived(r.documentId, false)}>
                            Restaurează
                          </button>
                        ) : (
                          <button type="button" className="ra" onClick={() => setArchived(r.documentId, true)}>
                            Arhivează
                          </button>
                        )}
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

      {mwsOpen && (
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
                <input
                  type="text"
                  list="insp-seasons"
                  placeholder="ex. 2027-2028"
                  value={mwsTo}
                  onChange={(e) => setMwsTo(e.target.value)}
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
    </div>
  );
}
