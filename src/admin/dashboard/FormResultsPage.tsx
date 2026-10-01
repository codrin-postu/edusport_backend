import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import {
  AdminPage,
  Window,
  PageHeader,
  InboxLayout,
  StatusBadge,
  Chip,
  ChipList,
  Field,
  Input,
  Select,
  Textarea,
  adminToast,
  toastAutosaved,
  type TabItem,
} from '../ui';
import { INBOX_CSS, InboxRow, ReaderHead, RO_MON_SHORT, pad2, relTime, groupByDay, snippet } from './inboxShared';

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
 * { status } or { internalNote }. Built on the shared InboxLayout and
 * src/admin/ui controls; status and note changes autosave with the "Salvat"
 * toast. Status colours come from the config, on StatusBadge's custom prop.
 */

const PAGE_SIZE = 25;

export interface StatusDef {
  value: string;
  label: string;
  color: string; // badge colour (any CSS colour); the badge fill is mixed from it
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

function whenOf(r: Row): string | null {
  return r.submittedAt ?? r.createdAt ?? null;
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
  return `${d.getDate()} ${RO_MON_SHORT[d.getMonth()]} ${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function extraValueText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'Da' : 'Nu';
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default function FormResultsPage({ config }: { config: FormResultsConfig }) {
  const { get, put } = useFetchClient();
  const { apiBase, statuses, fields } = config;

  // Inboxes open on "Toate": an inbox is for reading everything that came in,
  // and defaulting to the unread-only view hid older messages until you noticed
  // the tabs. Filtering to new stays one click away.
  const [activeTab, setActiveTab] = React.useState<string>('');
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
        adminToast.error('Nu am putut salva modificarea.');
        return false;
      }
    },
    [put, apiBase],
  );

  const setStatus = React.useCallback(
    async (documentId: string, status: string) => {
      const ok = await updateFields(documentId, { status });
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

  const statusOf = React.useCallback(
    (value: string): StatusDef => statuses.find((s) => s.value === value) ?? { value, label: value, color: 'var(--theme-neutral)' },
    [statuses],
  );

  const statusBadge = (value: string) => {
    const s = statusOf(value);
    // Config colour as text and border, a 10% mix of it over the surface as
    // the fill (the old 1a alpha), so it follows the theme.
    return (
      <StatusBadge
        custom={{
          fg: s.color,
          bg: `color-mix(in srgb, ${s.color} 10%, var(--theme-surface))`,
          line: `color-mix(in srgb, ${s.color} 30%, var(--theme-surface))`,
        }}
      >
        {s.label}
      </StatusBadge>
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
        <div className="inbx-fld" key={f.key}>
          <span className="inbx-fk">{f.label}</span>
          <span className="inbx-fv">
            <ChipList>
              {items.map((label, i) => (
                <Chip key={`${label}-${i}`}>{label}</Chip>
              ))}
            </ChipList>
          </span>
        </div>
      );
    }
    const v = row[f.key];
    if (f.kind === 'bool') {
      // Booleans are shown only when set (e.g. parental consent).
      if (v !== true) return null;
      return (
        <div className="inbx-fld" key={f.key}>
          <span className="inbx-fk">{f.label}</span>
          <span className="inbx-fv">Da</span>
        </div>
      );
    }
    if (v == null || v === '') return null;
    const text = f.kind === 'date' ? fmtDate(v) : String(v);
    if (!text) return null;
    return (
      <div className="inbx-fld" key={f.key}>
        <span className="inbx-fk">{f.label}</span>
        <span className={`inbx-fv${f.kind === 'longtext' ? ' inbx-fv--long' : ''}`}>{text}</span>
      </div>
    );
  };

  const extraEntries = React.useMemo(() => {
    const ex = selected?.extra;
    if (!ex || typeof ex !== 'object' || Array.isArray(ex)) return [];
    return Object.entries(ex).filter(([, v]) => v != null && v !== '');
  }, [selected]);

  const cNum = (v: number | null | undefined) => (v == null ? '—' : String(v));
  const firstStatus = statuses[0]?.value;

  const summary = `${cNum(counts[firstStatus])} noi · ${cNum(counts.all)} în total`;

  // statuses[0] is the form's "new" status by contract, see StatusDef; only
  // that tab carries a count.
  const tabs: TabItem[] = [{ key: '', label: 'Toate' }, ...statuses.map((s) => ({ key: s.value, label: s.label }))].map(
    (t) => {
      const count = counts[t.key];
      return {
        id: t.key || '__all',
        label: t.label,
        count: t.key === firstStatus && count != null && count > 0 ? count : undefined,
      };
    },
  );

  const toolbar = (
    <>
      <div className="inbx-search">
        <Input
          aria-label="Caută"
          placeholder={config.searchPlaceholder ?? 'Caută după nume sau email'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Select
        aria-label="Ordine"
        value={sort}
        onChange={(v) => setSort(v as 'newest' | 'oldest')}
        options={[
          { value: 'newest', label: 'Cele mai noi' },
          { value: 'oldest', label: 'Cele mai vechi' },
        ]}
      />
    </>
  );

  const reader = selected ? (
    <>
      <ReaderHead
        title={String(selected[config.listTitleKey] ?? '')}
        meta={[
          config.emailKey || config.phoneKey ? (
            <>
              {config.emailKey && selected[config.emailKey] ? (
                <a href={`mailto:${String(selected[config.emailKey])}`}>{String(selected[config.emailKey])}</a>
              ) : null}
              {config.phoneKey && selected[config.phoneKey] ? ` · ${String(selected[config.phoneKey])}` : ''}
            </>
          ) : null,
          `Trimis ${fmtDate(whenOf(selected)) || 'la dată necunoscută'}`,
        ]}
        badge={statusBadge(selected.status)}
      />

      <div className="inbx-flds">{fields.map((f) => renderField(f, selected))}</div>

      {extraEntries.length > 0 && (
        <>
          <div className="inbx-cap">Răspunsuri suplimentare</div>
          <div className="inbx-flds" style={{ paddingTop: 0 }}>
            {extraEntries.map(([k, v]) => (
              <div className="inbx-fld" key={k}>
                <span className="inbx-fk">{customLabel(k)}</span>
                <span className="inbx-fv inbx-fv--long">{extraValueText(v)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="inbx-form">
        <Field label="Stare">
          <Select
            value={selected.status}
            onChange={(v) => setStatus(selected.documentId, v)}
            options={statuses.map((s) => ({ value: s.value, label: s.label }))}
          />
        </Field>
        <Field label="Notă internă (privată)">
          <Textarea
            rows={2}
            key={`${selected.documentId}-note`}
            defaultValue={selected.internalNote ?? ''}
            placeholder="Ex. Sunat, revin cu detalii săptămâna viitoare."
            onBlur={(e) => {
              if (e.target.value !== (selected.internalNote ?? '')) saveNote(selected.documentId, e.target.value);
            }}
          />
        </Field>
      </div>
    </>
  ) : null;

  return (
    <AdminPage>
      <style>{INBOX_CSS}</style>
      <Window>
        <PageHeader title={config.title} subtitle={config.subtitle} actions={<span className="inbx-sum">{summary}</span>} />
        <InboxLayout<Row>
          tabs={tabs}
          activeTab={activeTab || '__all'}
          onTabChange={(id) => setActiveTab(id === '__all' ? '' : id)}
          toolbar={toolbar}
          items={rows}
          getKey={(r) => r.documentId}
          groupBy={(items) => groupByDay(items, whenOf)}
          renderItem={(r) => (
            <InboxRow
              unread={r.status === firstStatus}
              title={String(r[config.listTitleKey] ?? '')}
              time={relTime(whenOf(r))}
              snippet={config.listSnippetKey ? snippet(r[config.listSnippetKey]) : undefined}
              badge={statusBadge(r.status)}
            />
          )}
          selectedKey={selected ? selected.documentId : null}
          onSelect={setSelectedId}
          loading={loading}
          error={error ? 'Nu am putut încărca datele.' : undefined}
          empty="Nicio înregistrare pentru filtrul curent."
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          reader={reader}
          readerEmpty="Selectează o înregistrare din listă pentru a o citi."
          listLabel={config.title}
        />
      </Window>
    </AdminPage>
  );
}
