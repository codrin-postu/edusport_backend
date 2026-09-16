import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';

/**
 * EduSport admin — generic form-results inbox.
 *
 * Shared two-pane inbox for form submissions served by the dedicated admin
 * endpoints (/api/forms/voluntari, /api/forms/parteneri-rezultate, ...), which
 * return { data, pagination, formMeta }. Thin pages (VoluntariPage,
 * ParteneriRezultatePage) configure title, endpoint, statuses and the ordered
 * field descriptors rendered in the reader pane.
 *
 * Follows the MesajePage inbox pattern: status tabs with counts, search,
 * paginated list (25/page) grouped by day, reader pane with editable status +
 * internal note. Writes go through PUT <apiBase>/<documentId> with only
 * { status } or { internalNote }. Light-only, shared admin tokens (system-ui,
 * #fff, #dcdcdc borders, accent #2138b8, danger #be3330, squared buttons).
 */

const PAGE_SIZE = 25;

export interface StatusDef {
  value: string;
  label: string;
  color: string; // badge/accent color, 6-digit hex
}

export interface FieldDef {
  key: string;
  label: string;
  // text (default) | date | bool (shown only when true) | longtext |
  // list (a json string-array field rendered as chips)
  kind?: 'text' | 'date' | 'bool' | 'longtext' | 'list';
}

export interface FormResultsConfig {
  title: string;
  subtitle: string;
  apiBase: string; // e.g. '/api/forms/voluntari'
  statuses: StatusDef[]; // first entry is the "new" status
  fields: FieldDef[]; // reader pane, in order
  listTitleKey: string; // row field used as the list title
  listSnippetKey?: string; // row field used as the list snippet
  emailKey?: string; // row field with the submitter email (mailto link)
  phoneKey?: string;
  searchPlaceholder?: string;
}

interface Row {
  documentId: string;
  status: string;
  internalNote: string | null;
  submittedAt: string | null;
  createdAt?: string | null;
  extra?: Record<string, unknown> | null;
  [k: string]: unknown;
}

interface CustomMeta {
  key: string;
  label: string;
  type?: string;
  step?: string;
}

const RO_MON_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');

function whenOf(r: Row): string | null {
  return r.submittedAt ?? r.createdAt ?? null;
}

// Compact, human relative time for list rows.
function relTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffS = Math.max(0, (now.getTime() - d.getTime()) / 1000);
  if (diffS < 60) return 'acum câteva secunde';
  if (diffS < 3600) {
    const m = Math.floor(diffS / 60);
    return `acum ${m} min`;
  }
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    if (diffS < 6 * 3600) {
      const h = Math.floor(diffS / 3600);
      return `acum ${h} ${h === 1 ? 'oră' : 'ore'}`;
    }
    return `azi ${hm}`;
  }
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return `ieri ${hm}`;
  return `${d.getDate()} ${RO_MON_SHORT[d.getMonth()]}`;
}

// Day-group label for the list separators.
function dayGroup(iso: string | null): string {
  if (!iso) return 'Fără dată';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Fără dată';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Azi';
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Ieri';
  return `${d.getDate()} ${RO_MON_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

// Date values: date-only strings (YYYY-MM-DD) show no time; ISO datetimes do.
function fmtDate(v: unknown): string {
  if (typeof v !== 'string' || !v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(`${v}T00:00:00`);
    if (Number.isNaN(d.getTime())) return v;
    return `${d.getDate()} ${RO_MON_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return `${d.getDate()} ${RO_MON_SHORT[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function snippet(text: unknown): string {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > 90 ? `${t.slice(0, 90)}...` : t;
}

function extraValueText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'Da' : 'Nu';
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const CSS = `
.fres { font-family: system-ui, -apple-system, sans-serif; color: #1b1d26; background: #f6f7f9; min-height: 100%; padding: 16px 20px 40px; box-sizing: border-box; }
.fres * { box-sizing: border-box; }
.fres .num { font-variant-numeric: tabular-nums; }

.fres-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.fres-head h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -.01em; }
.fres-head p { margin: 3px 0 0; font-size: 12.5px; color: #6a6e7a; }
.fres-sum { font-size: 12px; color: #8a8d99; white-space: nowrap; }

.fres input, .fres select { font-family: inherit; font-size: 13px; color: #1b1d26; background: #fff; border: 1px solid #d0d0d0; border-radius: 4px; padding: 7px 9px; }
.fres input:focus, .fres select:focus { outline: none; border-color: #2138b8; }

.fres .btn { font-family: inherit; font-size: 12.5px; font-weight: 600; padding: 7px 12px; border-radius: 4px; border: 1px solid #d0d0d0; background: #fff; color: #1b1d26; cursor: pointer; white-space: nowrap; }
.fres .btn:hover { border-color: #b6bac4; background: #fafbff; }
.fres .btn:disabled { opacity: .55; cursor: default; }

/* tabs */
.fres-tabs { display: flex; gap: 4px; border-bottom: 1px solid #dcdcdc; margin-bottom: 12px; flex-wrap: wrap; }
.fres-tab { display: flex; align-items: center; gap: 6px; padding: 8px 12px; font-size: 12.5px; color: #5a5e6b; border: none; background: none; border-bottom: 2px solid transparent; cursor: pointer; font-family: inherit; }
.fres-tab:hover { color: #1b1d26; }
.fres-tab .b { font-size: 10px; font-weight: 800; border-radius: 20px; padding: 1px 7px; background: #eef0f3; color: #5a5e6b; }
.fres-tab.on { color: #2138b8; border-bottom-color: #2138b8; font-weight: 700; }
.fres-tab.on .b { background: #be3330; color: #fff; }

/* toolbar */
.fres-toolbar { display: flex; gap: 8px; margin-bottom: 10px; align-items: center; flex-wrap: wrap; }
.fres-search { flex: 1; min-width: 170px; }
.fres-search input { width: 100%; }

.fres-msg { font-size: 12px; padding: 8px 11px; border-radius: 4px; margin-bottom: 10px; }
.fres-msg.ok { color: #1f7a4d; background: #e7f3ec; border: 1px solid #bfe0cc; }
.fres-msg.err { color: #be3330; background: #faeceb; border: 1px solid #e6c3c1; }

/* status badge (color set inline from config) */
.fres .sb { display: inline-block; font-size: 10px; font-weight: 700; border-radius: 20px; padding: 2px 8px; white-space: nowrap; }

/* help/answer chips */
.fres .hc { display: inline-block; font-size: 11px; font-weight: 600; border-radius: 20px; padding: 3px 10px; white-space: nowrap; color: #2138b8; background: #eef1fb; margin: 0 6px 6px 0; }

/* two-pane */
.fres-pane { display: grid; grid-template-columns: 360px 1fr; gap: 14px; align-items: start; }
@media (max-width: 920px) { .fres-pane { grid-template-columns: 1fr; } }

.fres .card { background: #fff; border: 1px solid #dcdcdc; border-radius: 5px; }
.fres-empty { padding: 40px 16px; text-align: center; color: #8a8d99; font-size: 13.5px; }

/* list */
.fres-list { overflow: hidden; }
.fres .grp { padding: 8px 13px 5px; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: #8a8d99; font-weight: 700; background: #fafbfc; border-bottom: 1px solid #ececf0; }
.fres .li { display: flex; gap: 10px; padding: 10px 13px; border-bottom: 1px solid #f0f1f4; cursor: pointer; align-items: flex-start; }
.fres .li:hover { background: #fafbff; }
.fres .li.sel { background: #eef1fb; box-shadow: inset 3px 0 0 #2138b8; }
.fres .li .bd { flex: 1; min-width: 0; }
.fres .li .l1 { display: flex; align-items: center; gap: 7px; }
.fres .li .l1 b { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.fres .li.unread .l1 b { font-weight: 800; }
.fres .li .l1 .nd { width: 6px; height: 6px; border-radius: 50%; background: #be3330; flex-shrink: 0; }
.fres .li .l1 .tm { margin-left: auto; font-size: 10px; color: #9a9da8; flex-shrink: 0; }
.fres .li .snip { font-size: 11.5px; color: #8a8d99; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fres .li .chips { margin-top: 5px; }

.fres .pager { display: flex; align-items: center; justify-content: space-between; padding: 9px 13px; background: #fafbfc; border-top: 1px solid #ececf0; font-size: 11.5px; color: #8a8d99; }
.fres .pager .pgs { display: flex; gap: 4px; }
.fres .pager .pg { min-width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 1px solid #d0d0d0; border-radius: 4px; font-size: 11px; color: #5a5e6b; background: #fff; cursor: pointer; font-family: inherit; }
.fres .pager .pg:hover { border-color: #b6bac4; }
.fres .pager .pg.on { background: #2138b8; color: #fff; border-color: #2138b8; font-weight: 700; }
.fres .pager .pg:disabled { opacity: .45; cursor: default; }

/* reader */
.fres .reader { padding: 16px 18px; min-width: 0; position: sticky; top: 12px; }
.fres .reader .rh { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid #ececf0; }
.fres .reader .rh h3 { margin: 0; font-size: 16px; font-weight: 800; }
.fres .reader .rh .meta { font-size: 12px; color: #8a8d99; margin-top: 3px; }
.fres .reader .rh .meta a { color: #2138b8; text-decoration: none; }
.fres .reader .rh .meta a:hover { text-decoration: underline; }
.fres .flds { padding: 12px 0; border-bottom: 1px solid #ececf0; }
.fres .fld { display: flex; gap: 12px; padding: 5px 0; font-size: 13px; }
.fres .fld .fk { width: 170px; flex-shrink: 0; color: #8a8d99; font-size: 12px; padding-top: 1px; }
.fres .fld .fv { flex: 1; min-width: 0; color: #2b2e38; word-break: break-word; }
.fres .fld .fv.long { white-space: pre-wrap; line-height: 1.55; }
.fres .lbl { font-size: 10px; letter-spacing: .05em; text-transform: uppercase; color: #8a8d99; font-weight: 700; margin: 13px 0 6px; }
.fres .note { width: 100%; border: 1px solid #d0d0d0; border-radius: 4px; padding: 8px 10px; font-size: 12.5px; color: #1b1d26; background: #fff; font-family: inherit; resize: vertical; }
.fres .note:focus { outline: none; border-color: #2138b8; }
.fres .reader-empty { padding: 48px 20px; text-align: center; color: #8a8d99; font-size: 13px; }
`;

export default function FormResultsPage({ config }: { config: FormResultsConfig }) {
  const { get, put } = useFetchClient();
  const { apiBase, statuses, fields } = config;

  const [activeTab, setActiveTab] = React.useState<string>(statuses[0]?.value ?? '');
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [sort, setSort] = React.useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = React.useState(1);

  const [rows, setRows] = React.useState<Row[]>([]);
  const [total, setTotal] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [customs, setCustoms] = React.useState<CustomMeta[]>([]);

  const [counts, setCounts] = React.useState<Record<string, number | null>>({});

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // debounce search input
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // reset to first page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [activeTab, debouncedSearch, sort]);

  const buildParams = React.useCallback(
    (p: number) => {
      const params: Record<string, string | number> = { page: p, pageSize: PAGE_SIZE, sort };
      if (activeTab) params.status = activeTab;
      if (debouncedSearch) params.q = debouncedSearch;
      return params;
    },
    [activeTab, debouncedSearch, sort],
  );

  const reload = React.useCallback(() => {
    setLoading(true);
    setError(false);
    get(apiBase, { params: buildParams(page) })
      .then((r: any) => {
        const data = r?.data;
        const list = Array.isArray(data?.data) ? data.data : [];
        setRows(list as Row[]);
        const pg = data?.pagination ?? {};
        setTotal(typeof pg.total === 'number' ? pg.total : list.length);
        setPageCount(typeof pg.pageCount === 'number' && pg.pageCount > 0 ? pg.pageCount : 1);
        const cm = data?.formMeta?.customs;
        if (Array.isArray(cm)) setCustoms(cm as CustomMeta[]);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [get, apiBase, buildParams, page]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  // Tab counts: one cheap query per status (pagination.total) + one for all.
  const reloadCounts = React.useCallback(() => {
    const one = (extra?: Record<string, string>) =>
      get(apiBase, { params: { page: 1, pageSize: 1, ...(extra ?? {}) } })
        .then((r: any) => (typeof r?.data?.pagination?.total === 'number' ? r.data.pagination.total : null))
        .catch(() => null);
    Promise.all([...statuses.map((s) => one({ status: s.value })), one()]).then((vals) => {
      const next: Record<string, number | null> = {};
      statuses.forEach((s, i) => {
        next[s.value] = vals[i];
      });
      next.all = vals[vals.length - 1];
      setCounts(next);
    });
  }, [get, apiBase, statuses]);

  React.useEffect(() => {
    reloadCounts();
  }, [reloadCounts]);

  const selected = React.useMemo(() => rows.find((r) => r.documentId === selectedId) ?? null, [rows, selectedId]);

  // --- write a status/note change; optimistic on row, then refetch counts
  const updateFields = React.useCallback(
    async (documentId: string, patch: Partial<Row>) => {
      let prev: Row | undefined;
      setRows((cur) =>
        cur.map((r) => {
          if (r.documentId !== documentId) return r;
          prev = r;
          return { ...r, ...patch };
        }),
      );
      try {
        await put(`${apiBase}/${documentId}`, patch);
        return true;
      } catch {
        if (prev) setRows((cur) => cur.map((r) => (r.documentId === documentId ? (prev as Row) : r)));
        setMsg({ kind: 'err', text: 'Nu am putut salva modificarea.' });
        return false;
      }
    },
    [put, apiBase],
  );

  const setStatus = React.useCallback(
    async (documentId: string, status: string) => {
      const ok = await updateFields(documentId, { status });
      if (ok) {
        reloadCounts();
        // If the row no longer matches the active tab, drop it from view.
        if (activeTab && status !== activeTab) {
          setRows((cur) => cur.filter((r) => r.documentId !== documentId));
          setTotal((t) => Math.max(0, t - 1));
          if (selectedId === documentId) setSelectedId(null);
        }
      }
    },
    [updateFields, reloadCounts, activeTab, selectedId],
  );

  const saveNote = React.useCallback(
    async (documentId: string, note: string) => {
      const ok = await updateFields(documentId, { internalNote: note });
      if (ok) setMsg({ kind: 'ok', text: 'Nota internă a fost salvată.' });
    },
    [updateFields],
  );

  // --- group visible rows by day, preserving server sort order
  const groups = React.useMemo(() => {
    const out: Array<{ label: string; items: Row[] }> = [];
    for (const r of rows) {
      const label = dayGroup(whenOf(r));
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(r);
      else out.push({ label, items: [r] });
    }
    return out;
  }, [rows]);

  const statusOf = React.useCallback(
    (value: string): StatusDef => statuses.find((s) => s.value === value) ?? { value, label: value, color: '#5a5e6b' },
    [statuses],
  );

  const statusBadge = (value: string) => {
    const s = statusOf(value);
    return (
      <span className="sb" style={{ color: s.color, background: `${s.color}1a` }}>
        {s.label}
      </span>
    );
  };

  const customLabel = React.useCallback(
    (key: string) => customs.find((c) => c.key === key)?.label ?? key,
    [customs],
  );

  const renderField = (f: FieldDef, row: Row) => {
    if (f.kind === 'list') {
      // A json string-array field (e.g. helpAreas) rendered as a chip list.
      const raw = row[f.key];
      const items = (Array.isArray(raw) ? raw : []).map((x) => String(x)).filter((x) => x.trim() !== '');
      if (!items.length) return null;
      return (
        <div className="fld" key={f.key}>
          <span className="fk">{f.label}</span>
          <span className="fv">
            {items.map((label, i) => (
              <span className="hc" key={`${label}-${i}`}>
                {label}
              </span>
            ))}
          </span>
        </div>
      );
    }
    const v = row[f.key];
    if (f.kind === 'bool') {
      // Booleans are shown only when set (e.g. parental consent).
      if (v !== true) return null;
      return (
        <div className="fld" key={f.key}>
          <span className="fk">{f.label}</span>
          <span className="fv">Da</span>
        </div>
      );
    }
    if (v == null || v === '') return null;
    const text = f.kind === 'date' ? fmtDate(v) : String(v);
    if (!text) return null;
    return (
      <div className="fld" key={f.key}>
        <span className="fk">{f.label}</span>
        <span className={`fv ${f.kind === 'longtext' ? 'long' : ''}`}>{text}</span>
      </div>
    );
  };

  const extraEntries = React.useMemo(() => {
    const ex = selected?.extra;
    if (!ex || typeof ex !== 'object' || Array.isArray(ex)) return [];
    return Object.entries(ex).filter(([, v]) => v != null && v !== '');
  }, [selected]);

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, page * PAGE_SIZE);
  const cNum = (v: number | null | undefined) => (v == null ? '—' : String(v));
  const firstStatus = statuses[0]?.value;

  const summary = `${cNum(counts[firstStatus])} noi · ${cNum(counts.all)} în total`;

  return (
    <div className="fres">
      <style>{CSS}</style>

      <div className="fres-head">
        <div>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <span className="fres-sum num">{summary}</span>
      </div>

      <div className="fres-tabs">
        {[...statuses.map((s) => ({ key: s.value, label: s.label })), { key: '', label: 'Toate' }].map((t) => {
          const count = t.key === '' ? counts.all : counts[t.key];
          return (
            <button
              key={t.key || 'all'}
              type="button"
              className={`fres-tab ${activeTab === t.key ? 'on' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
              {count != null && <span className="b num">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="fres-toolbar">
        <div className="fres-search">
          <input
            placeholder={config.searchPlaceholder ?? 'Caută după nume sau email'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'oldest')}>
          <option value="newest">Cele mai noi</option>
          <option value="oldest">Cele mai vechi</option>
        </select>
      </div>

      {msg && (
        <div className={`fres-msg ${msg.kind}`}>
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

      <div className="fres-pane">
        {/* LEFT: list */}
        <div className="card fres-list">
          {loading ? (
            <div className="fres-empty">Se încarcă...</div>
          ) : error ? (
            <div className="fres-empty">Nu am putut încărca datele.</div>
          ) : rows.length === 0 ? (
            <div className="fres-empty">Nicio înregistrare pentru filtrul curent.</div>
          ) : (
            <>
              {groups.map((g) => (
                <React.Fragment key={g.label}>
                  <div className="grp">{g.label}</div>
                  {g.items.map((r) => {
                    const unread = r.status === firstStatus;
                    return (
                      <div
                        key={r.documentId}
                        className={`li ${unread ? 'unread' : ''} ${selectedId === r.documentId ? 'sel' : ''}`}
                        onClick={() => setSelectedId(r.documentId)}
                      >
                        <div className="bd">
                          <div className="l1">
                            {unread && <span className="nd" />}
                            <b>{String(r[config.listTitleKey] ?? '')}</b>
                            <span className="tm">{relTime(whenOf(r))}</span>
                          </div>
                          {config.listSnippetKey ? <div className="snip">{snippet(r[config.listSnippetKey])}</div> : null}
                          <div className="chips">{statusBadge(r.status)}</div>
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
              <div className="pager">
                <span className="num">
                  {rangeStart} - {rangeEnd} din {total}
                </span>
                <span className="pgs">
                  <button type="button" className="pg" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    ‹
                  </button>
                  {Array.from({ length: pageCount }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1)
                    .reduce<number[]>((acc, p) => {
                      if (acc.length && p - acc[acc.length - 1] > 1) acc.push(-1);
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === -1 ? (
                        <span key={`gap-${i}`} className="pg" style={{ border: 'none', background: 'none', cursor: 'default' }}>
                          …
                        </span>
                      ) : (
                        <button key={p} type="button" className={`pg ${p === page ? 'on' : ''}`} onClick={() => setPage(p)}>
                          {p}
                        </button>
                      ),
                    )}
                  <button
                    type="button"
                    className="pg"
                    disabled={page >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    ›
                  </button>
                </span>
              </div>
            </>
          )}
        </div>

        {/* RIGHT: reader */}
        <div className="card reader">
          {!selected ? (
            <div className="reader-empty">Selectează o înregistrare din listă pentru a o citi.</div>
          ) : (
            <>
              <div className="rh">
                <div>
                  <h3>{String(selected[config.listTitleKey] ?? '')}</h3>
                  {(config.emailKey || config.phoneKey) && (
                    <div className="meta">
                      {config.emailKey && selected[config.emailKey] ? (
                        <a href={`mailto:${String(selected[config.emailKey])}`}>{String(selected[config.emailKey])}</a>
                      ) : null}
                      {config.phoneKey && selected[config.phoneKey] ? ` · ${String(selected[config.phoneKey])}` : ''}
                    </div>
                  )}
                  <div className="meta">Trimis {fmtDate(whenOf(selected)) || 'la dată necunoscută'}</div>
                </div>
                {statusBadge(selected.status)}
              </div>

              <div className="flds">{fields.map((f) => renderField(f, selected))}</div>

              {extraEntries.length > 0 && (
                <>
                  <div className="lbl">Răspunsuri suplimentare</div>
                  <div className="flds" style={{ paddingTop: 0 }}>
                    {extraEntries.map(([k, v]) => (
                      <div className="fld" key={k}>
                        <span className="fk">{customLabel(k)}</span>
                        <span className="fv long">{extraValueText(v)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="lbl">Stare</div>
              <select
                value={selected.status}
                onChange={(e) => setStatus(selected.documentId, e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              <div className="lbl">Notă internă (privată)</div>
              <textarea
                className="note"
                rows={2}
                key={`${selected.documentId}-note`}
                defaultValue={selected.internalNote ?? ''}
                placeholder="Ex. Sunat, revin cu detalii săptămâna viitoare."
                onBlur={(e) => {
                  if (e.target.value !== (selected.internalNote ?? '')) saveNote(selected.documentId, e.target.value);
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
