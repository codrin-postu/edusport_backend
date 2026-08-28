import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';

/**
 * EduSport admin — "Mesaje" contact inbox page.
 *
 * Registered as an admin route (see ./menu.tsx) so it renders inside Strapi's
 * providers and can use useFetchClient. Replaces the default content-manager
 * table for contact submissions with a two-pane inbox tuned for volume:
 * state tabs with counts, search, reason filter, paginated list (25/page)
 * grouped by day, bulk actions, and a reader pane on the right.
 *
 * Reads/writes go through the content-manager collection API for
 * api::contact-submission.contact-submission:
 *   GET /content-manager/collection-types/<uid>            list (filters + page)
 *   PUT /content-manager/collection-types/<uid>/<docId>    change triageStatus / note
 *
 * Every write touches only triageStatus or internalNote, the two fields the
 * lifecycle whitelist allows. Light-only, using the shared admin tokens
 * (system-ui, #fff, #dcdcdc borders, accent #2138b8, danger #be3330,
 * #d0d0d0 fields, squared buttons, horizontal row separators only).
 */

const UID = 'api::contact-submission.contact-submission';
const API = `/content-manager/collection-types/${UID}`;
const PAGE_SIZE = 25;

type TriageStatus = 'new' | 'read' | 'replied' | 'archived';

interface TabDef {
  key: TriageStatus | '';
  label: string;
}
const TABS: TabDef[] = [
  { key: 'new', label: 'Noi' },
  { key: 'read', label: 'Citite' },
  { key: 'replied', label: 'Răspunse' },
  { key: 'archived', label: 'Arhivate' },
  { key: '', label: 'Toate' },
];

interface ReasonDef {
  value: string;
  label: string;
  cls: string;
}
const REASONS: ReasonDef[] = [
  { value: 'inscriere', label: 'Înscriere', cls: 'inscriere' },
  { value: 'informatii-cursuri', label: 'Info cursuri', cls: 'info' },
  { value: 'program', label: 'Program', cls: 'program' },
  { value: 'tarife', label: 'Tarife', cls: 'tarife' },
  { value: 'partenariat', label: 'Parteneriat', cls: 'parteneriat' },
  { value: 'feedback', label: 'Feedback', cls: 'feedback' },
  { value: 'altele', label: 'Altele', cls: 'altele' },
];
const REASON_BY_VALUE: Record<string, ReasonDef> = Object.fromEntries(REASONS.map((r) => [r.value, r]));

interface Submission {
  documentId: string;
  name: string;
  email: string;
  phone: string | null;
  reason: string;
  message: string;
  triageStatus: TriageStatus;
  internalNote: string | null;
  submittedAt: string | null;
  createdAt: string | null;
  [k: string]: unknown;
}

const RO_MON_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');

function whenOf(s: Submission): string | null {
  return s.submittedAt ?? s.createdAt ?? null;
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

// Full submitted date for the reader header.
function fmtFull(iso: string | null): string {
  if (!iso) return 'Dată necunoscută';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Dată necunoscută';
  return `${d.getDate()} ${RO_MON_SHORT[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function snippet(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > 90 ? `${t.slice(0, 90)}...` : t;
}

const CSS = `
.mesg { font-family: system-ui, -apple-system, sans-serif; color: #1b1d26; background: #f6f7f9; min-height: 100%; padding: 16px 20px 40px; box-sizing: border-box; }
.mesg * { box-sizing: border-box; }
.mesg .num { font-variant-numeric: tabular-nums; }

.mesg-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.mesg-head h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -.01em; }
.mesg-head p { margin: 3px 0 0; font-size: 12.5px; color: #6a6e7a; }
.mesg-sum { font-size: 12px; color: #8a8d99; white-space: nowrap; }

.mesg input, .mesg select { font-family: inherit; font-size: 13px; color: #1b1d26; background: #fff; border: 1px solid #d0d0d0; border-radius: 4px; padding: 7px 9px; }
.mesg input:focus, .mesg select:focus { outline: none; border-color: #2138b8; }

.btn { font-family: inherit; font-size: 12.5px; font-weight: 600; padding: 7px 12px; border-radius: 4px; border: 1px solid #d0d0d0; background: #fff; color: #1b1d26; cursor: pointer; white-space: nowrap; }
.btn:hover { border-color: #b6bac4; background: #fafbff; }
.btn.pri { background: #2138b8; border-color: #2138b8; color: #fff; }
.btn.pri:hover { background: #1b2fa0; }
.btn.ok { color: #1f7a4d; border-color: #bfe0cc; background: #fff; }
.btn.ok:hover { background: #f1f8f3; }
.btn:disabled { opacity: .55; cursor: default; }

/* tabs */
.mesg-tabs { display: flex; gap: 4px; border-bottom: 1px solid #dcdcdc; margin-bottom: 12px; flex-wrap: wrap; }
.mesg-tab { display: flex; align-items: center; gap: 6px; padding: 8px 12px; font-size: 12.5px; color: #5a5e6b; border: none; background: none; border-bottom: 2px solid transparent; cursor: pointer; font-family: inherit; }
.mesg-tab:hover { color: #1b1d26; }
.mesg-tab .b { font-size: 10px; font-weight: 800; border-radius: 20px; padding: 1px 7px; background: #eef0f3; color: #5a5e6b; }
.mesg-tab.on { color: #2138b8; border-bottom-color: #2138b8; font-weight: 700; }
.mesg-tab.on .b { background: #be3330; color: #fff; }

/* toolbar */
.mesg-toolbar { display: flex; gap: 8px; margin-bottom: 10px; align-items: center; flex-wrap: wrap; }
.mesg-search { flex: 1; min-width: 170px; }
.mesg-search input { width: 100%; }

/* bulk bar */
.mesg-bulk { display: flex; align-items: center; gap: 10px; background: #eef1fb; border: 1px solid #d7ddf5; border-radius: 4px; padding: 7px 12px; margin-bottom: 10px; font-size: 12px; }
.mesg-bulk b { color: #2138b8; }
.mesg-bulk .act { margin-left: auto; display: flex; gap: 8px; }

.mesg-msg { font-size: 12px; padding: 8px 11px; border-radius: 4px; margin-bottom: 10px; }
.mesg-msg.ok { color: #1f7a4d; background: #e7f3ec; border: 1px solid #bfe0cc; }
.mesg-msg.err { color: #be3330; background: #faeceb; border: 1px solid #e6c3c1; }

/* reason chips */
.rc { display: inline-block; font-size: 10px; font-weight: 700; border-radius: 20px; padding: 2px 8px; white-space: nowrap; }
.rc.inscriere { color: #1f7a4d; background: #e7f3ec; }
.rc.tarife { color: #a05e00; background: #fbf1e0; }
.rc.program { color: #00707a; background: #e0f3f4; }
.rc.info { color: #2138b8; background: #eef1fb; }
.rc.parteneriat { color: #7a1fa2; background: #f5e9f9; }
.rc.feedback { color: #0e7490; background: #e3f4f8; }
.rc.altele { color: #5a5e6b; background: #eef0f3; }

/* two-pane */
.mesg-pane { display: grid; grid-template-columns: 360px 1fr; gap: 14px; align-items: start; }
@media (max-width: 920px) { .mesg-pane { grid-template-columns: 1fr; } }

.card { background: #fff; border: 1px solid #dcdcdc; border-radius: 5px; }
.mesg-empty { padding: 40px 16px; text-align: center; color: #8a8d99; font-size: 13.5px; }

/* list */
.mesg-list { overflow: hidden; }
.grp { padding: 8px 13px 5px; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: #8a8d99; font-weight: 700; background: #fafbfc; border-bottom: 1px solid #ececf0; }
.li { display: flex; gap: 10px; padding: 10px 13px; border-bottom: 1px solid #f0f1f4; cursor: pointer; align-items: flex-start; }
.li:hover { background: #fafbff; }
.li.sel { background: #eef1fb; box-shadow: inset 3px 0 0 #2138b8; }
.li .chk { width: 15px; height: 15px; flex-shrink: 0; margin-top: 2px; }
.li .bd { flex: 1; min-width: 0; }
.li .l1 { display: flex; align-items: center; gap: 7px; }
.li .l1 b { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.li.unread .l1 b { font-weight: 800; }
.li .l1 .nd { width: 6px; height: 6px; border-radius: 50%; background: #be3330; flex-shrink: 0; }
.li .l1 .tm { margin-left: auto; font-size: 10px; color: #9a9da8; flex-shrink: 0; }
.li .snip { font-size: 11.5px; color: #8a8d99; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.li .chips { margin-top: 5px; }

.pager { display: flex; align-items: center; justify-content: space-between; padding: 9px 13px; background: #fafbfc; border-top: 1px solid #ececf0; font-size: 11.5px; color: #8a8d99; }
.pager .pgs { display: flex; gap: 4px; }
.pager .pg { min-width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 1px solid #d0d0d0; border-radius: 4px; font-size: 11px; color: #5a5e6b; background: #fff; cursor: pointer; font-family: inherit; }
.pager .pg:hover { border-color: #b6bac4; }
.pager .pg.on { background: #2138b8; color: #fff; border-color: #2138b8; font-weight: 700; }
.pager .pg:disabled { opacity: .45; cursor: default; }

/* reader */
.reader { padding: 16px 18px; min-width: 0; position: sticky; top: 12px; }
.reader .rh { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid #ececf0; }
.reader .rh h3 { margin: 0; font-size: 16px; font-weight: 800; }
.reader .rh .meta { font-size: 12px; color: #8a8d99; margin-top: 3px; }
.reader .rh .meta a { color: #2138b8; text-decoration: none; }
.reader .rh .meta a:hover { text-decoration: underline; }
.reader .msg { font-size: 13.5px; color: #2b2e38; line-height: 1.6; padding: 13px 0; border-bottom: 1px solid #ececf0; white-space: pre-wrap; word-break: break-word; }
.reader .lbl { font-size: 10px; letter-spacing: .05em; text-transform: uppercase; color: #8a8d99; font-weight: 700; margin: 13px 0 6px; }
.reader .note { width: 100%; border: 1px solid #d0d0d0; border-radius: 4px; padding: 8px 10px; font-size: 12.5px; color: #1b1d26; background: #fff; font-family: inherit; resize: vertical; }
.reader .note:focus { outline: none; border-color: #2138b8; }
.reader .acts { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
.reader-empty { padding: 48px 20px; text-align: center; color: #8a8d99; font-size: 13px; }
`;

export default function MesajePage() {
  const { get, put } = useFetchClient();

  const [activeTab, setActiveTab] = React.useState<TriageStatus | ''>('new');
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [sort, setSort] = React.useState<'desc' | 'asc'>('desc');
  const [page, setPage] = React.useState(1);

  const [rows, setRows] = React.useState<Submission[]>([]);
  const [total, setTotal] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const [counts, setCounts] = React.useState<Record<string, number | null>>({
    new: null,
    read: null,
    replied: null,
    archived: null,
    all: null,
  });

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  // debounce search input
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // reset to first page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [activeTab, debouncedSearch, reason, sort]);

  const buildParams = React.useCallback(
    (p: number) => {
      const params: Record<string, string | number> = {
        page: p,
        pageSize: PAGE_SIZE,
        sort: `submittedAt:${sort}`,
      };
      if (activeTab) params['filters[triageStatus][$eq]'] = activeTab;
      if (reason) params['filters[reason][$eq]'] = reason;
      if (debouncedSearch) params._q = debouncedSearch;
      return params;
    },
    [activeTab, reason, debouncedSearch, sort],
  );

  const reload = React.useCallback(() => {
    setLoading(true);
    setError(false);
    get(API, { params: buildParams(page) })
      .then((r: any) => {
        const data = r?.data;
        const list = Array.isArray(data?.results) ? data.results : Array.isArray(data?.data) ? data.data : [];
        setRows(list as Submission[]);
        const pg = data?.pagination ?? {};
        setTotal(typeof pg.total === 'number' ? pg.total : list.length);
        setPageCount(typeof pg.pageCount === 'number' && pg.pageCount > 0 ? pg.pageCount : 1);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [get, buildParams, page]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const reloadCounts = React.useCallback(() => {
    const one = (extra?: Record<string, string>) =>
      get(API, { params: { page: 1, pageSize: 1, ...(extra ?? {}) } })
        .then((r: any) => (typeof r?.data?.pagination?.total === 'number' ? r.data.pagination.total : null))
        .catch(() => null);
    Promise.all([
      one({ 'filters[triageStatus][$eq]': 'new' }),
      one({ 'filters[triageStatus][$eq]': 'read' }),
      one({ 'filters[triageStatus][$eq]': 'replied' }),
      one({ 'filters[triageStatus][$eq]': 'archived' }),
      one(),
    ]).then(([n, r, rep, a, all]) => {
      setCounts({ new: n, read: r, replied: rep, archived: a, all });
    });
  }, [get]);

  React.useEffect(() => {
    reloadCounts();
  }, [reloadCounts]);

  // clear selection set when the visible page changes
  React.useEffect(() => {
    setChecked(new Set());
  }, [page, activeTab, reason, debouncedSearch, sort]);

  const selected = React.useMemo(
    () => rows.find((r) => r.documentId === selectedId) ?? null,
    [rows, selectedId],
  );

  // --- write a status/note change; optimistic on row, then refetch counts
  const updateFields = React.useCallback(
    async (documentId: string, patch: Partial<Submission>) => {
      let prev: Submission | undefined;
      setRows((cur) =>
        cur.map((r) => {
          if (r.documentId !== documentId) return r;
          prev = r;
          return { ...r, ...patch };
        }),
      );
      try {
        await put(`${API}/${documentId}`, patch);
        return true;
      } catch {
        if (prev) setRows((cur) => cur.map((r) => (r.documentId === documentId ? (prev as Submission) : r)));
        setMsg({ kind: 'err', text: 'Nu am putut salva modificarea.' });
        return false;
      }
    },
    [put],
  );

  const setStatus = React.useCallback(
    async (documentId: string, status: TriageStatus) => {
      const ok = await updateFields(documentId, { triageStatus: status });
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

  // --- bulk actions
  const bulkSet = React.useCallback(
    async (status: TriageStatus) => {
      const ids = Array.from(checked);
      if (!ids.length) return;
      setBusy(true);
      setMsg(null);
      let okCount = 0;
      for (const id of ids) {
        try {
          await put(`${API}/${id}`, { triageStatus: status });
          okCount += 1;
        } catch {
          /* keep going */
        }
      }
      setBusy(false);
      setChecked(new Set());
      setMsg({
        kind: okCount === ids.length ? 'ok' : 'err',
        text:
          okCount === ids.length
            ? `${okCount} ${okCount === 1 ? 'mesaj actualizat' : 'mesaje actualizate'}.`
            : `Am actualizat ${okCount} din ${ids.length} mesaje.`,
      });
      reload();
      reloadCounts();
    },
    [checked, put, reload, reloadCounts],
  );

  const toggleCheck = (id: string) => {
    setChecked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- group visible rows by day, preserving server sort order
  const groups = React.useMemo(() => {
    const out: Array<{ label: string; items: Submission[] }> = [];
    for (const r of rows) {
      const label = dayGroup(whenOf(r));
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(r);
      else out.push({ label, items: [r] });
    }
    return out;
  }, [rows]);

  const reasonChip = (value: string) => {
    const rd = REASON_BY_VALUE[value] ?? { label: value, cls: 'altele' };
    return <span className={`rc ${rd.cls}`}>{rd.label}</span>;
  };

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, page * PAGE_SIZE);
  const cNum = (v: number | null) => (v == null ? '—' : String(v));

  const summary = `${cNum(counts.new)} noi · ${cNum(counts.read)} citite · ${cNum(counts.all)} în total`;

  return (
    <div className="mesg">
      <style>{CSS}</style>

      <div className="mesg-head">
        <div>
          <h1>Mesaje contact</h1>
          <p>Mesajele trimise din formularul public de contact.</p>
        </div>
        <span className="mesg-sum num">{summary}</span>
      </div>

      <div className="mesg-tabs">
        {TABS.map((t) => {
          const count = t.key === '' ? counts.all : counts[t.key];
          return (
            <button
              key={t.key || 'all'}
              type="button"
              className={`mesg-tab ${activeTab === t.key ? 'on' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
              {count != null && <span className="b num">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="mesg-toolbar">
        <div className="mesg-search">
          <input
            placeholder="Caută după nume sau email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Toate motivele</option>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as 'desc' | 'asc')}>
          <option value="desc">Cele mai noi</option>
          <option value="asc">Cele mai vechi</option>
        </select>
      </div>

      {checked.size > 0 && (
        <div className="mesg-bulk">
          <b className="num">{checked.size}</b>
          <span>{checked.size === 1 ? 'mesaj selectat' : 'mesaje selectate'}</span>
          <span className="act">
            <button className="btn" type="button" disabled={busy} onClick={() => bulkSet('read')}>
              Marchează citit
            </button>
            <button className="btn" type="button" disabled={busy} onClick={() => bulkSet('archived')}>
              Arhivează
            </button>
          </span>
        </div>
      )}

      {msg && (
        <div className={`mesg-msg ${msg.kind}`}>
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

      <div className="mesg-pane">
        {/* LEFT: list */}
        <div className="card mesg-list">
          {loading ? (
            <div className="mesg-empty">Se încarcă...</div>
          ) : error ? (
            <div className="mesg-empty">Nu am putut încărca mesajele.</div>
          ) : rows.length === 0 ? (
            <div className="mesg-empty">Niciun mesaj pentru filtrul curent.</div>
          ) : (
            <>
              {groups.map((g) => (
                <React.Fragment key={g.label}>
                  <div className="grp">{g.label}</div>
                  {g.items.map((r) => {
                    const unread = r.triageStatus === 'new';
                    return (
                      <div
                        key={r.documentId}
                        className={`li ${unread ? 'unread' : ''} ${selectedId === r.documentId ? 'sel' : ''}`}
                        onClick={() => setSelectedId(r.documentId)}
                      >
                        <input
                          className="chk"
                          type="checkbox"
                          checked={checked.has(r.documentId)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleCheck(r.documentId)}
                        />
                        <div className="bd">
                          <div className="l1">
                            {unread && <span className="nd" />}
                            <b>{r.name}</b>
                            <span className="tm">{relTime(whenOf(r))}</span>
                          </div>
                          <div className="snip">{snippet(r.message)}</div>
                          <div className="chips">{reasonChip(r.reason)}</div>
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
                  <button
                    type="button"
                    className="pg"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
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
                        <button
                          key={p}
                          type="button"
                          className={`pg ${p === page ? 'on' : ''}`}
                          onClick={() => setPage(p)}
                        >
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
            <div className="reader-empty">Selectează un mesaj din listă pentru a-l citi.</div>
          ) : (
            <>
              <div className="rh">
                <div>
                  <h3>{selected.name}</h3>
                  <div className="meta">
                    <a href={`mailto:${selected.email}`}>{selected.email}</a>
                    {selected.phone ? ` · ${selected.phone}` : ''}
                  </div>
                  <div className="meta">Trimis {fmtFull(whenOf(selected))}</div>
                </div>
                {reasonChip(selected.reason)}
              </div>

              <div className="msg">{selected.message}</div>

              <div className="lbl">Notă internă (privată)</div>
              <textarea
                className="note"
                rows={2}
                key={`${selected.documentId}-note`}
                defaultValue={selected.internalNote ?? ''}
                placeholder="Ex. Sunat, revin luni cu programul grupelor."
                onBlur={(e) => {
                  if (e.target.value !== (selected.internalNote ?? '')) saveNote(selected.documentId, e.target.value);
                }}
              />

              <div className="acts">
                <button
                  className="btn pri"
                  type="button"
                  disabled={selected.triageStatus === 'read'}
                  onClick={() => setStatus(selected.documentId, 'read')}
                >
                  Marchează citit
                </button>
                <button
                  className="btn ok"
                  type="button"
                  disabled={selected.triageStatus === 'replied'}
                  onClick={() => setStatus(selected.documentId, 'replied')}
                >
                  Răspuns trimis
                </button>
                <button
                  className="btn"
                  type="button"
                  disabled={selected.triageStatus === 'archived'}
                  onClick={() => setStatus(selected.documentId, 'archived')}
                >
                  Arhivează
                </button>
                <a
                  className="btn"
                  href={`mailto:${selected.email}?subject=${encodeURIComponent('Răspuns EduSport')}`}
                  style={{ textDecoration: 'none', display: 'inline-block' }}
                >
                  Răspunde prin email
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
