import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';

/**
 * EduSport admin — "Înscrieri" results page.
 *
 * Registered as an admin route (see ./menu.tsx) so it renders inside Strapi's
 * providers and can use useFetchClient. Reads/writes go through the dedicated
 * admin-guarded endpoints on the registration-submission API:
 *   GET    /api/forms/inscrieri                 list (status/level/q filters)
 *   PUT    /api/forms/inscrieri/:documentId     update any editable field
 *   DELETE /api/forms/inscrieri/:documentId     delete
 *   GET    /api/forms/inscrieri/export.csv       CSV download
 *   POST   /api/forms/inscrieri/export-sheets    Google Sheets append
 *
 * Two views: a Compact list (key columns + an editable detail panel) and a
 * "Toate coloanele" spreadsheet (every field as an inline-editable column with
 * a show/hide + reorder popover, first column frozen). Light-only, using the
 * shared admin tokens (system-ui, #fff, #dcdcdc borders, accent #2138b8,
 * danger #be3330, #d0d0d0 fields, squared buttons).
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

const STATUS_COLOR: Record<string, { fg: string; bg: string }> = {
  Nou: { fg: '#2138b8', bg: '#eef1fb' },
  Contactat: { fg: '#8a5a00', bg: '#fbf1df' },
  Confirmat: { fg: '#1f7a4d', bg: '#e7f3ec' },
  Respins: { fg: '#be3330', bg: '#faeceb' },
};

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
  [k: string]: unknown;
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

function loadColConfig(userKey: string): ColConfig {
  try {
    const raw = localStorage.getItem(`edusport-inscrieri-cols-${userKey}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ColConfig>;
      const known = new Set(DEFAULT_ORDER);
      // Keep only known keys and append any new columns added since last save.
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
.insp { font-family: system-ui, -apple-system, sans-serif; color: #1b1d26; background: #f6f7f9; min-height: 100%; padding: 16px 20px 40px; box-sizing: border-box; }
.insp * { box-sizing: border-box; }
.insp .num { font-variant-numeric: tabular-nums; }

.insp-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.insp-head h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -.01em; }
.insp-head p { margin: 3px 0 0; font-size: 12.5px; color: #6a6e7a; }
.insp-count { font-size: 12px; font-weight: 700; color: #2138b8; background: #eef1fb; border: 1px solid #d7ddf5; border-radius: 4px; padding: 5px 10px; white-space: nowrap; }

.insp-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; background: #fff; border: 1px solid #dcdcdc; border-radius: 5px; padding: 10px 12px; margin-bottom: 12px; }
.insp-toolbar .grow { flex: 1 1 180px; min-width: 160px; }
.insp input, .insp select { font-family: inherit; font-size: 13px; color: #1b1d26; background: #fff; border: 1px solid #d0d0d0; border-radius: 4px; padding: 7px 9px; }
.insp input:focus, .insp select:focus { outline: none; border-color: #2138b8; }
.insp .search { width: 100%; }
.insp .fl { font-size: 11px; color: #8a8d99; margin-right: 2px; }

.seg { display: inline-flex; border: 1px solid #d0d0d0; border-radius: 5px; overflow: hidden; }
.seg button { font-family: inherit; font-size: 12.5px; padding: 7px 12px; border: none; background: #fff; color: #4a4d59; cursor: pointer; }
.seg button.on { background: #2138b8; color: #fff; font-weight: 600; }
.seg button + button { border-left: 1px solid #d0d0d0; }

.btn { font-family: inherit; font-size: 12.5px; font-weight: 600; padding: 7px 12px; border-radius: 4px; border: 1px solid #d0d0d0; background: #fff; color: #1b1d26; cursor: pointer; white-space: nowrap; }
.btn:hover { border-color: #b6bac4; background: #fafbff; }
.btn.pri { background: #2138b8; border-color: #2138b8; color: #fff; }
.btn.pri:hover { background: #1b2fa0; }
.btn:disabled { opacity: .55; cursor: default; }
.btn.danger { color: #be3330; border-color: #e2c4c4; background: #fff; }
.btn.danger:hover { background: #fdf4f3; }

.insp-msg { font-size: 12px; padding: 8px 11px; border-radius: 4px; margin-bottom: 12px; }
.insp-msg.ok { color: #1f7a4d; background: #e7f3ec; border: 1px solid #bfe0cc; }
.insp-msg.warn { color: #8a5a00; background: #fbf1df; border: 1px solid #ecd9ac; }
.insp-msg.err { color: #be3330; background: #faeceb; border: 1px solid #e6c3c1; }

.card { background: #fff; border: 1px solid #dcdcdc; border-radius: 5px; }
.insp-empty { padding: 40px 16px; text-align: center; color: #8a8d99; font-size: 13.5px; }

/* status pill */
.stpill { font-size: 11px; font-weight: 700; border-radius: 4px; padding: 3px 9px; display: inline-block; }

/* ---- compact list ---- */
.clist { border-collapse: collapse; width: 100%; }
.clist th { text-align: left; font-size: 10px; letter-spacing: .05em; text-transform: uppercase; color: #8a8d99; font-weight: 700; padding: 10px 12px; border-bottom: 1px solid #ececf0; }
.clist td { padding: 10px 12px; border-bottom: 1px solid #f0f1f4; font-size: 13px; vertical-align: middle; }
.clist tr { cursor: pointer; }
.clist tr:hover td { background: #fafbff; }
.clist tr.sel td { background: #eef1fb; }
.clist .nm { font-weight: 600; }

.insp-split { display: grid; grid-template-columns: 1fr 380px; gap: 14px; align-items: start; }
@media (max-width: 1040px) { .insp-split { grid-template-columns: 1fr; } }

/* detail panel */
.panel { position: sticky; top: 12px; }
.panel .ph { display: flex; align-items: center; justify-content: space-between; padding: 13px 15px; border-bottom: 1px solid #ececf0; }
.panel .ph b { font-size: 14.5px; }
.panel .x { color: #8a8d99; cursor: pointer; font-size: 20px; line-height: 1; border: none; background: none; }
.panel .pb { padding: 14px 15px; max-height: calc(100vh - 220px); overflow-y: auto; }
.fld { margin-bottom: 11px; }
.fld label { display: block; font-size: 10px; color: #8a8d99; margin-bottom: 3px; text-transform: uppercase; letter-spacing: .05em; }
.fld .v { font-size: 13px; color: #1b1d26; margin-top: 2px; white-space: pre-wrap; word-break: break-word; }
.fld input, .fld select, .fld textarea { width: 100%; }
.fld textarea { font-family: inherit; font-size: 13px; border: 1px solid #d0d0d0; border-radius: 4px; padding: 7px 9px; resize: vertical; }
.fld textarea:focus { outline: none; border-color: #2138b8; }
.chkrow { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 5px 0; }
.chkrow input { width: auto; }
.pa { padding: 12px 15px; border-top: 1px solid #ececf0; display: flex; justify-content: flex-end; }

/* ---- spreadsheet ---- */
.sheetwrap { overflow-x: auto; border: 1px solid #dcdcdc; border-radius: 5px; background: #fff; }
.sheet { border-collapse: separate; border-spacing: 0; font-size: 12.5px; }
.sheet th, .sheet td { border-bottom: 1px solid #f0f1f4; padding: 0; }
.sheet th { background: #f6f7f9; text-align: left; font-size: 10px; letter-spacing: .04em; text-transform: uppercase; color: #6a6e7a; font-weight: 700; padding: 8px 10px; white-space: nowrap; position: sticky; top: 0; z-index: 2; }
.sheet td .cell { padding: 0; }
.sheet td input, .sheet td select { width: 100%; border: none; background: transparent; font-family: inherit; font-size: 12.5px; padding: 8px 10px; color: #1b1d26; }
.sheet td .cellv { display: block; padding: 8px 10px; color: #1b1d26; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sheet td input:focus, .sheet td select:focus { outline: 2px solid #2138b8; outline-offset: -2px; background: #fff; }
.sheet td.boolc { text-align: center; }
.sheet td.boolc input { width: auto; }
.sheet td.del { text-align: center; }
.sheet td.del button { border: none; background: none; color: #be3330; cursor: pointer; font-size: 15px; padding: 6px 8px; }
.sheet tr:hover td { background: #fafbff; }
/* frozen first data column + row-actions */
.sheet .frz { position: sticky; left: 0; z-index: 3; background: #fff; border-right: 1px solid #dcdcdc; box-shadow: 1px 0 0 #ececf0; }
.sheet th.frz { z-index: 4; background: #f6f7f9; }

/* columns popover */
.popwrap { position: relative; }
.pop { position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; width: 288px; background: #fff; border: 1px solid #dcdcdc; border-radius: 5px; box-shadow: 0 8px 28px rgba(0,0,0,.14); padding: 8px; }
.pop h4 { margin: 4px 6px 8px; font-size: 11px; line-height: 1.35; letter-spacing: .01em; color: #8a8d99; font-weight: 700; }
.pop-body { max-height: 320px; overflow-y: auto; }
.pop .prow { display: flex; align-items: center; gap: 8px; padding: 6px 6px; border-radius: 4px; border: 1px solid transparent; }
.pop .prow:hover { background: #f6f7f9; }
.pop .prow.drag { opacity: .5; }
.pop .prow.over { border-color: #2138b8; background: #eef1fb; }
.pop .prow .grip { cursor: grab; color: #b6bac4; font-size: 13px; line-height: 1; user-select: none; padding: 0 2px; flex-shrink: 0; }
.pop .prow .grip:active { cursor: grabbing; }
.pop .prow input { width: auto; margin: 0; flex-shrink: 0; }
.pop .prow span.lbl { flex: 1; font-size: 12.5px; }
.pop-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 4px 2px; margin-top: 6px; border-top: 1px solid #ececf0; }
.pop-foot .reset { border: none; background: none; color: #4a4d59; font-family: inherit; font-size: 11.5px; cursor: pointer; padding: 4px 4px; }
.pop-foot .reset:hover { color: #2138b8; text-decoration: underline; }
`;

export default function InscrieriPage() {
  const { get, put, del, post } = useFetchClient();

  const [userKey, setUserKey] = React.useState<string>('anon');
  const [rows, setRows] = React.useState<Submission[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const [view, setView] = React.useState<'compact' | 'full'>('compact');
  const [search, setSearch] = React.useState('');
  const [fStatus, setFStatus] = React.useState('');
  const [fLevel, setFLevel] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const [colCfg, setColCfg] = React.useState<ColConfig>(() => loadColConfig('anon'));
  const [popOpen, setPopOpen] = React.useState(false);
  const [dragKey, setDragKey] = React.useState<string | null>(null);
  const [overKey, setOverKey] = React.useState<string | null>(null);

  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

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

  // --- load rows
  const reload = React.useCallback(() => {
    setLoading(true);
    setError(false);
    get(API)
      .then((r: any) => {
        const data = r?.data?.data;
        setRows(Array.isArray(data) ? (data as Submission[]) : []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [get]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  // --- close popover on outside click
  React.useEffect(() => {
    if (!popOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.popwrap')) setPopOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [popOpen]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (fStatus && r.status !== fStatus) return false;
      if (fLevel && r.level !== fLevel) return false;
      if (q) {
        const hay = [r.childName, r.parentName, r.email, r.phone, r.howHeard]
          .map((v) => (v ?? '').toString().toLowerCase())
          .join(' ');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, fStatus, fLevel]);

  const selected = React.useMemo(
    () => filtered.find((r) => r.documentId === selectedId) ?? rows.find((r) => r.documentId === selectedId) ?? null,
    [filtered, rows, selectedId],
  );

  // Keep a row open at all times in the compact view so the detail column is
  // never an empty reserved gap: auto-select the first row when nothing valid
  // is selected.
  React.useEffect(() => {
    if (view !== 'compact') return;
    if (filtered.length && !filtered.some((r) => r.documentId === selectedId)) {
      setSelectedId(filtered[0].documentId);
    }
  }, [view, filtered, selectedId]);

  // --- persist a single field
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
      } catch {
        // revert on failure
        setRows((cur) => cur.map((r) => (r.documentId === documentId ? { ...r, [key]: prev } : r)));
        setMsg({ kind: 'err', text: 'Nu am putut salva modificarea.' });
      }
    },
    [put],
  );

  const removeRow = React.useCallback(
    async (documentId: string) => {
      if (!window.confirm('Ștergi definitiv această înscriere?')) return;
      const snapshot = rows;
      setRows((cur) => cur.filter((r) => r.documentId !== documentId));
      if (selectedId === documentId) setSelectedId(null);
      try {
        await del(`${API}/${documentId}`);
      } catch {
        setRows(snapshot);
        setMsg({ kind: 'err', text: 'Nu am putut șterge înscrierea.' });
      }
    },
    [del, rows, selectedId],
  );

  const filterQuery = React.useCallback(() => {
    const p = new URLSearchParams();
    if (fStatus) p.set('status', fStatus);
    if (fLevel) p.set('level', fLevel);
    if (search.trim()) p.set('q', search.trim());
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [fStatus, fLevel, search]);

  const exportCsv = React.useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r: any = await get(`${API}/export.csv${filterQuery()}`);
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
  }, [get, filterQuery]);

  const exportSheets = React.useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r: any = await post(`${API}/export-sheets`, { status: fStatus, level: fLevel, q: search.trim() });
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
  }, [post, fStatus, fLevel, search]);

  // --- columns popover actions
  const visibleOrder = colCfg.order.filter((k) => !colCfg.hidden.includes(k));
  const updateCfg = (next: ColConfig) => {
    setColCfg(next);
    saveColConfig(userKey, next);
  };
  const toggleHidden = (key: string) => {
    const hidden = colCfg.hidden.includes(key)
      ? colCfg.hidden.filter((k) => k !== key)
      : [...colCfg.hidden, key];
    updateCfg({ ...colCfg, hidden });
  };
  // Drag-to-reorder: drop `from` immediately before `to` in the column order.
  const reorderCol = (from: string, to: string) => {
    if (from === to) return;
    const order = colCfg.order.filter((k) => k !== from);
    const at = order.indexOf(to);
    if (at < 0) return;
    order.splice(at, 0, from);
    updateCfg({ ...colCfg, order });
  };
  const resetCols = () => updateCfg({ order: [...DEFAULT_ORDER], hidden: [] });

  const statusPill = (status: string) => {
    const c = STATUS_COLOR[status] ?? STATUS_COLOR.Nou;
    return (
      <span className="stpill" style={{ color: c.fg, background: c.bg }}>
        {status}
      </span>
    );
  };

  // Submission data is a read-only record; only the Stare (status) column is
  // editable inline (the workflow field). Everything else just displays.
  const renderCellInput = (row: Submission, col: ColumnDef) => {
    const val = row[col.key];
    const dId = row.documentId;
    if (col.type === 'date' || col.readOnly) {
      return <span className="cellv">{fmtDateTime(row.submittedAt)}</span>;
    }
    if (col.type === 'status') {
      return (
        <select value={String(val ?? 'Nou')} onChange={(e) => saveField(dId, col.key, e.target.value as Status)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      );
    }
    if (col.type === 'bool') {
      return <span className="cellv">{val ? 'Da' : 'Nu'}</span>;
    }
    return <span className="cellv">{val == null || val === '' ? '' : String(val)}</span>;
  };

  return (
    <div className="insp">
      <style>{CSS}</style>

      <div className="insp-head">
        <div>
          <h1>Înscrieri</h1>
          <p>Cererile trimise prin formularul public de înscriere.</p>
        </div>
        <span className="insp-count num">{filtered.length} înscrieri</span>
      </div>

      {/* toolbar */}
      <div className="insp-toolbar">
        <div className="grow">
          <input
            className="search"
            placeholder="Caută nume, email, telefon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Toate stările</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={fLevel} onChange={(e) => setFLevel(e.target.value)}>
          <option value="">Toate nivelurile</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

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
            <button className="btn" type="button" onClick={() => setPopOpen((o) => !o)}>
              Coloane
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
                        <span className="lbl">{c.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="pop-foot">
                  <button type="button" className="reset" onClick={resetCols}>
                    Resetează la implicit
                  </button>
                  <button type="button" className="btn pri" onClick={() => setPopOpen(false)}>
                    Aplică
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <button className="btn" type="button" onClick={exportCsv} disabled={busy}>
          CSV
        </button>
        <button className="btn pri" type="button" onClick={exportSheets} disabled={busy}>
          Google Sheets ↗
        </button>
      </div>

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

      {loading ? (
        <div className="card insp-empty">Se încarcă...</div>
      ) : error ? (
        <div className="card insp-empty">Nu am putut încărca înscrierile.</div>
      ) : filtered.length === 0 ? (
        <div className="card insp-empty">Nicio înscriere pentru filtrul curent.</div>
      ) : view === 'compact' ? (
        <div className="insp-split">
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="clist">
              <thead>
                <tr>
                  {COMPACT_KEYS.map((k) => (
                    <th key={k}>{COL_BY_KEY[k].label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.documentId}
                    className={selectedId === r.documentId ? 'sel' : ''}
                    onClick={() => setSelectedId(r.documentId)}
                  >
                    <td className="num">{fmtDateTime(r.submittedAt)}</td>
                    <td className="nm">{r.childName}</td>
                    <td>{r.parentName}</td>
                    <td>{r.level}</td>
                    <td>{statusPill(r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="card panel">
              <div className="ph">
                <b>{selected.childName}</b>
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
                {(
                  [
                    ['childName', 'Nume copil'],
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
                <div className="fld"><label>Interes club</label><div className="v">{selected.clubInterest ? 'Da' : 'Nu'}</div></div>
                <div className="fld"><label>Acord regulament</label><div className="v">{selected.regulationsAgreement ? 'Da' : 'Nu'}</div></div>
                <div className="fld"><label>Acord confidențialitate</label><div className="v">{selected.privacyConsent ? 'Da' : 'Nu'}</div></div>
                <div className="fld" style={{ marginTop: 11 }}><label>Experiență anterioară</label><div className="v">{String(selected.priorExperience ?? '') || '—'}</div></div>
                <div className="fld"><label>Așteptări</label><div className="v">{String(selected.expectations ?? '') || '—'}</div></div>
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
                <button className="btn danger" type="button" onClick={() => removeRow(selected.documentId)}>
                  Șterge înscrierea
                </button>
              </div>
            </div>
          )}
        </div>
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
                <th style={{ minWidth: 48 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.documentId}>
                  {visibleOrder.map((key, i) => {
                    const c = COL_BY_KEY[key];
                    const isBool = c.type === 'bool';
                    return (
                      <td
                        key={key}
                        className={`${i === 0 ? 'frz' : ''} ${isBool ? 'boolc' : ''}`}
                        style={{ minWidth: c.width }}
                      >
                        {renderCellInput(r, c)}
                      </td>
                    );
                  })}
                  <td className="del">
                    <button type="button" aria-label="Șterge" onClick={() => removeRow(r.documentId)}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
