import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import ConfirmDialog from '../ConfirmDialog';
import {
  AdminPage,
  Window,
  PageHeader,
  InboxLayout,
  StatusBadge,
  Checkbox,
  Button,
  Field,
  Input,
  Select,
  Textarea,
  adminToast,
  toastAutosaved,
  type BadgeTone,
  type CustomBadgeColors,
  type TabItem,
} from '../ui';
import { INBOX_CSS, InboxRow, ReaderHead, RO_MON_SHORT, pad2, relTime, groupByDay, snippet } from './inboxShared';

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
 * lifecycle whitelist allows. Built on the shared InboxLayout (tabs, list,
 * pager, reader) and src/admin/ui controls; status and note changes autosave
 * with the "Salvat" toast.
 */

const UID = 'api::contact-submission.contact-submission';
const API = `/content-manager/collection-types/${UID}`;
const PAGE_SIZE = 25;

type TriageStatus = 'new' | 'read' | 'replied' | 'archived';

interface TabDef {
  key: TriageStatus | '';
  label: string;
}
// "Toate" leads: an inbox is for reading everything that arrived, and opening
// on the unread-only view hid older messages until you noticed the tabs.
//
// No "Arhivate" tab: archiving was removed in favour of deleting. The
// `archived` value is still understood, so messages archived before that change
// keep rendering their badge under Toate rather than looking broken, but
// nothing can set it any more.
const TABS: TabDef[] = [
  { key: '', label: 'Toate' },
  { key: 'new', label: 'Noi' },
  { key: 'read', label: 'Citite' },
  { key: 'replied', label: 'Răspunse' },
];

interface ReasonDef {
  value: string;
  label: string;
  /** Colour group; several reasons share one. */
  group: ReasonGroup;
}
type ReasonGroup = 'inscriere' | 'info' | 'program' | 'tarife' | 'parteneriat' | 'feedback' | 'voluntariat' | 'altele';
const REASONS: ReasonDef[] = [
  { value: 'inscriere', label: 'Înscriere', group: 'inscriere' },
  { value: 'informatii-cursuri', label: 'Info cursuri', group: 'info' },
  { value: 'program', label: 'Program', group: 'program' },
  { value: 'tarife', label: 'Tarife', group: 'tarife' },
  { value: 'partenariat', label: 'Parteneriat', group: 'parteneriat' },
  { value: 'feedback', label: 'Feedback', group: 'feedback' },
  { value: 'voluntariat', label: 'Voluntariat', group: 'voluntariat' },
  { value: 'sponsorizare', label: 'Sponsorizare', group: 'parteneriat' },
  { value: 'eveniment-special', label: 'Eveniment special', group: 'parteneriat' },
  { value: 'altele', label: 'Altele', group: 'altele' },
];
const REASON_BY_VALUE: Record<string, ReasonDef> = Object.fromEntries(REASONS.map((r) => [r.value, r]));

/**
 * Reason colour per group, on StatusBadge. Six groups map onto the shared
 * tones; the two the tones do not cover get palette-backed colours:
 * parteneriat uses the burgundy calendar token pair (theme-aware, contrast
 * checked), feedback the blue palette scale through the page variables in
 * MESAJE_CSS (light and dark steps).
 */
const REASON_COLOR: Record<ReasonGroup, { tone?: BadgeTone; custom?: CustomBadgeColors }> = {
  inscriere: { tone: 'success' },
  voluntariat: { tone: 'success' },
  tarife: { tone: 'warning' },
  info: { tone: 'primary' },
  program: { tone: 'info' },
  feedback: { custom: { fg: 'var(--mesg-blue-fg)', bg: 'var(--mesg-blue-bg)', line: 'var(--mesg-blue-line)' } },
  parteneriat: {
    custom: { fg: 'var(--theme-cat-antrenament-fg)', bg: 'var(--theme-cat-antrenament)', line: 'var(--theme-cat-antrenament)' },
  },
  altele: { tone: 'neutral' },
};

// Page-local styles, palette / theme tokens only.
const MESAJE_CSS = `
.ui-root .mesg-root{--mesg-blue-fg:var(--palette-blue-600);--mesg-blue-bg:var(--palette-blue-50);--mesg-blue-line:var(--palette-blue-100)}
:root[data-theme="dark"] .ui-root .mesg-root,.ui-root[data-theme="dark"] .mesg-root,.ui-root [data-theme="dark"] .mesg-root{--mesg-blue-fg:var(--palette-blue-200);--mesg-blue-bg:var(--palette-blue-900);--mesg-blue-line:var(--palette-blue-800)}
`;

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

function whenOf(s: Submission): string | null {
  return s.submittedAt ?? s.createdAt ?? null;
}

// Full submitted date for the reader header.
function fmtFull(iso: string | null): string {
  if (!iso) return 'Dată necunoscută';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Dată necunoscută';
  return `${d.getDate()} ${RO_MON_SHORT[d.getMonth()]} ${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function MesajePage() {
  const { get, put, del } = useFetchClient();

  const [activeTab, setActiveTab] = React.useState<TriageStatus | ''>('');
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
        adminToast.error('Nu am putut salva modificarea.');
        return false;
      }
    },
    [put],
  );


  // --- delete, with confirmation. Replaces archiving: an archived message was
  // still an unread-looking row nobody ever went back to, so the useful action
  // is removing it for good. The content-manager API is the same one this page
  // already reads and writes through.
  const [pendingDelete, setPendingDelete] = React.useState<string[] | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const confirmDelete = React.useCallback(async () => {
    const ids = pendingDelete ?? [];
    if (!ids.length) return;
    setDeleting(true);
    setDeleteError(null);
    let okCount = 0;
    for (const id of ids) {
      try {
        await del(`${API}/${id}`);
        okCount += 1;
      } catch {
        /* keep going, report the shortfall below */
      }
    }
    setDeleting(false);
    if (okCount === 0) {
      setDeleteError('Stergerea nu a reusit. Incearca din nou.');
      return;
    }
    setPendingDelete(null);
    setChecked(new Set());
    setSelectedId((cur) => (cur && ids.includes(cur) ? null : cur));
    if (okCount === ids.length) adminToast.success(`${okCount} ${okCount === 1 ? 'mesaj sters' : 'mesaje sterse'}.`);
    else adminToast.warning(`Am sters ${okCount} din ${ids.length} mesaje.`);
    reload();
    reloadCounts();
  }, [pendingDelete, del, reload, reloadCounts]);

  const setStatus = React.useCallback(
    async (documentId: string, status: TriageStatus) => {
      const ok = await updateFields(documentId, { triageStatus: status });
      if (ok) {
        toastAutosaved();
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
      if (ok) toastAutosaved();
    },
    [updateFields],
  );

  // --- bulk actions
  const bulkSet = React.useCallback(
    async (status: TriageStatus) => {
      const ids = Array.from(checked);
      if (!ids.length) return;
      setBusy(true);
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
      if (okCount === ids.length) adminToast.success(`${okCount} ${okCount === 1 ? 'mesaj actualizat' : 'mesaje actualizate'}.`);
      else if (okCount === 0) adminToast.error('Nu am putut actualiza mesajele selectate.');
      else adminToast.warning(`Am actualizat ${okCount} din ${ids.length} mesaje.`);
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

  const reasonBadge = (value: string) => {
    const rd = REASON_BY_VALUE[value] ?? { label: value, group: 'altele' as ReasonGroup };
    const c = REASON_COLOR[rd.group];
    return (
      <StatusBadge tone={c.tone} custom={c.custom}>
        {rd.label}
      </StatusBadge>
    );
  };

  const cNum = (v: number | null) => (v == null ? '—' : String(v));
  const summary = `${cNum(counts.new)} noi · ${cNum(counts.read)} citite · ${cNum(counts.all)} în total`;

  // The count marks unread only: a number on every tab turned it into
  // decoration; here a number means "these need reading".
  const tabs: TabItem[] = TABS.map((t) => ({
    id: t.key || 'all',
    label: t.label,
    count: t.key === 'new' && counts.new != null && counts.new > 0 ? counts.new : undefined,
  }));

  const toolbar = (
    <>
      <div className="inbx-search">
        <Input
          aria-label="Caută"
          placeholder="Caută după nume sau email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Select
        aria-label="Motiv"
        value={reason}
        onChange={(v) => setReason(v)}
        placeholder="Toate motivele"
        options={REASONS.map((r) => ({ value: r.value, label: r.label }))}
      />
      <Select
        aria-label="Ordine"
        value={sort}
        onChange={(v) => setSort(v as 'desc' | 'asc')}
        options={[
          { value: 'desc', label: 'Cele mai noi' },
          { value: 'asc', label: 'Cele mai vechi' },
        ]}
      />
    </>
  );

  const bulkBar =
    checked.size > 0 ? (
      <div className="inbx-bulk">
        <b>{checked.size}</b>
        <span>{checked.size === 1 ? 'mesaj selectat' : 'mesaje selectate'}</span>
        <span className="inbx-bulk-acts">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => bulkSet('read')}>
            Marchează citit
          </Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={() => setPendingDelete(Array.from(checked))}>
            Șterge
          </Button>
        </span>
      </div>
    ) : undefined;

  const reader = selected ? (
    <>
      <ReaderHead
        title={selected.name}
        meta={[
          <>
            <a href={`mailto:${selected.email}`}>{selected.email}</a>
            {selected.phone ? ` · ${selected.phone}` : ''}
          </>,
          `Trimis ${fmtFull(whenOf(selected))}`,
        ]}
        badge={reasonBadge(selected.reason)}
      />

      <div className="inbx-msg">{selected.message}</div>

      <div className="inbx-form">
        <Field label="Notă internă (privată)">
          <Textarea
            rows={2}
            key={`${selected.documentId}-note`}
            defaultValue={selected.internalNote ?? ''}
            placeholder="Ex. Sunat, revin luni cu programul grupelor."
            onBlur={(e) => {
              if (e.target.value !== (selected.internalNote ?? '')) saveNote(selected.documentId, e.target.value);
            }}
          />
        </Field>
      </div>

      <div className="inbx-acts">
        <Button disabled={selected.triageStatus === 'read'} onClick={() => setStatus(selected.documentId, 'read')}>
          Marchează citit
        </Button>
        <Button
          variant="secondary"
          disabled={selected.triageStatus === 'replied'}
          onClick={() => setStatus(selected.documentId, 'replied')}
        >
          Răspuns trimis
        </Button>
        <Button variant="danger" onClick={() => setPendingDelete([selected.documentId])}>
          Șterge
        </Button>
        <a
          className="ui-btn ui-btn--secondary"
          href={`mailto:${selected.email}?subject=${encodeURIComponent('Răspuns EduSport')}`}
        >
          Răspunde prin email
        </a>
      </div>
    </>
  ) : null;

  return (
    <AdminPage>
      <style>{INBOX_CSS + MESAJE_CSS}</style>
      <Window className="mesg-root">
        <PageHeader
          title="Mesaje contact"
          subtitle="Mesajele trimise din formularul public de contact."
          actions={<span className="inbx-sum">{summary}</span>}
        />
        <InboxLayout<Submission>
          tabs={tabs}
          activeTab={activeTab || 'all'}
          onTabChange={(id) => setActiveTab(id === 'all' ? '' : (id as TriageStatus))}
          toolbar={toolbar}
          bulkBar={bulkBar}
          items={rows}
          getKey={(r) => r.documentId}
          groupBy={(items) => groupByDay(items, whenOf)}
          renderItem={(r) => (
            <InboxRow
              unread={r.triageStatus === 'new'}
              title={r.name}
              time={relTime(whenOf(r))}
              snippet={snippet(r.message)}
              badge={reasonBadge(r.reason)}
              lead={
                <Checkbox
                  aria-label={`Selectează mesajul de la ${r.name}`}
                  checked={checked.has(r.documentId)}
                  onChange={() => toggleCheck(r.documentId)}
                />
              }
            />
          )}
          selectedKey={selected ? selected.documentId : null}
          onSelect={setSelectedId}
          loading={loading}
          error={error ? 'Nu am putut încărca mesajele.' : undefined}
          empty="Niciun mesaj pentru filtrul curent."
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          reader={reader}
          readerEmpty="Selectează un mesaj din listă pentru a-l citi."
          listLabel="Mesaje"
        />
      </Window>

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title={
          (pendingDelete?.length ?? 0) > 1 ? 'Stergi mesajele selectate?' : 'Stergi mesajul?'
        }
        message={
          (pendingDelete?.length ?? 0) > 1
            ? `Se sterg ${pendingDelete?.length} mesaje.`
            : 'Mesajul se sterge definitiv.'
        }
        detail="Stergerea este definitiva. Datele expeditorului nu mai pot fi recuperate."
        confirmLabel="Sterge"
        busyLabel="Se sterge"
        busy={deleting}
        error={deleteError}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={confirmDelete}
      />
    </AdminPage>
  );
}
