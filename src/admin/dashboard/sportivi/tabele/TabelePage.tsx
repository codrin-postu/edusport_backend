import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminPage, BottomSheet, Button, EmptyState, Loading, Notice, PageHeader, Select, Window, adminToast, useIsPhone, type SelectOption } from '../../../ui';
import { ConfirmDialog } from '../../../ConfirmDialog';
import { effectiveDefinition, NO_QUICK, quickFiltersOpen, type Quick } from '../../../../club/tables/builder-state';
import type { CatalogAnswer } from '../../../../club/tables/catalog-api';
import { TABLES_COPY, TABLES_COUNT_WORDS } from '../../../../club/tables/copy';
import { readTabeleQuery, tablesTo } from '../../../../club/tables/routes';
import type { SavedViewRow, TableDefinition, TableResult } from '../../../../club/tables/types';
import { isDirty, noPaymentsThisMonth } from '../../../../club/tables/view-state';
import { MONEY_UI_COPY } from '../../../../club/presence/copy/money-ui';
import { PRESENCE_ERRORS } from '../../../../club/presence/copy/core';
import { LIST_COPY } from '../../../../club/sportivi/list-view';
import { requestErrorText } from '../../../../club/registration-panel';
import { countWords } from '../../../../club/ro-count';
import { blobErrorText } from '../../inscrieri/downloadPdf';
import { useLatest } from '../../bani/latest';
import { SPORTIVI_CSS } from '../styles';
import { useTablesApi, type Format, type TablesApi } from './api';
import { Builder } from './Builder';
import { NewViewModal } from './NewViewModal';
import { ResultTable } from './ResultTable';
import { TABELE_CSS } from './styles';
import { ViewBar } from './ViewBar';

const UNDO_MS = 8000;
const QUERY_DELAY_MS = 300;

/** Catalog and the saved views; the views reload after a write. */
function useTablesData(api: TablesApi) {
  const [catalog, setCatalog] = React.useState<CatalogAnswer | null>(null);
  const [views, setViews] = React.useState<SavedViewRow[]>([]);
  const [failed, setFailed] = React.useState(false);
  const reloadViews = React.useCallback(async () => {
    try { setViews(await api.views()); } catch { setFailed(true); }
  }, [api]);
  React.useEffect(() => {
    let off = false;
    Promise.all([api.catalog(), api.views()]).then(([c, v]) => { if (!off) { setCatalog(c); setViews(v); } }).catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, [api]);
  return { catalog, views, failed, reloadViews };
}

/** The result of the definition on screen, a moment after the last change; a slow older answer is dropped. */
function useResult(api: TablesApi, definition: TableDefinition | null) {
  const [state, setState] = React.useState<{ result: TableResult | null; error: string | null; loading: boolean }>({ result: null, error: null, loading: true });
  const latest = useLatest();
  const key = JSON.stringify(definition);
  React.useEffect(() => {
    if (definition === null) { setState({ result: null, error: null, loading: false }); return undefined; }
    setState((s) => ({ ...s, loading: true }));
    const current = latest.next();
    const timer = setTimeout(async () => {
      try {
        const result = await api.query(definition);
        if (current()) setState({ result, error: null, loading: false });
      } catch (err) {
        if (current()) setState({ result: null, error: requestErrorText(err, PRESENCE_ERRORS.loadFailed), loading: false });
      }
    }, QUERY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [api, key, latest]);
  return state;
}

function QuickFilters({ catalog, definition, quick, onChange }: { catalog: CatalogAnswer; definition: TableDefinition; quick: Quick; onChange: (q: Quick) => void }) {
  const columns = catalog.subjects[definition.subject].columns;
  const stare = columns.find((c) => c.key === 'stare');
  const hasGroup = columns.some((c) => c.key === 'grupa');
  if (!stare && !hasGroup) return null;
  const all: SelectOption = { value: '', label: TABLES_COPY.all };
  const open = quickFiltersOpen(definition);
  return (
    <div className="tbl-quick">
      {stare && (
        <div className="tbl-quick-item">
          <span className="tbl-label">{stare.label}</span>
          <Select value={quick.stare ?? ''} aria-label={stare.label} disabled={!open} options={[all, ...(stare.values ?? []).map((v) => ({ value: v, label: v }))]} onChange={(v) => onChange({ ...quick, stare: v || null })} />
        </div>
      )}
      {hasGroup && (
        <div className="tbl-quick-item">
          <span className="tbl-label">{TABLES_COPY.group}</span>
          <Select value={quick.grupa ?? ''} aria-label={TABLES_COPY.group} disabled={!open} options={[all, ...catalog.groups.filter((g) => g.active).map((g) => ({ value: g.name, label: g.name }))]} onChange={(v) => onChange({ ...quick, grupa: v || null })} />
        </div>
      )}
    </div>
  );
}

type Dialog = { kind: 'new' } | { kind: 'duplicate' } | { kind: 'remove' } | null;

type LoadedProps = { api: TablesApi; catalog: CatalogAnswer; views: SavedViewRow[]; reloadViews: () => Promise<void>; tabs: React.ReactNode };

function Loaded({ api, catalog, views, reloadViews, tabs }: LoadedProps) {
  const phone = useIsPhone();
  const navigate = useNavigate();
  const { search } = useLocation();
  const all = [...catalog.readyMade, ...views];
  const wanted = readTabeleQuery(search).viewId;
  const current = all.find((v) => v.id === wanted) ?? catalog.readyMade.find((v) => v.id === catalog.defaultViewId) ?? catalog.readyMade[0];
  const saved = current.definition;
  const savedKey = JSON.stringify(saved);

  const [draft, setDraft] = React.useState<TableDefinition | null>(saved);
  const [quick, setQuick] = React.useState<Quick>(NO_QUICK);
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(new Set());
  React.useEffect(() => { setDraft(saved); setQuick(NO_QUICK); setCollapsed(new Set()); }, [current.id, savedKey]);

  const columns = draft ? catalog.subjects[draft.subject].columns : [];
  // At 10 builder filters there is no room for a quick one: it is closed, and one already chosen is dropped.
  React.useEffect(() => { if (draft && !quickFiltersOpen(draft)) setQuick(NO_QUICK); }, [draft]);
  const effective = draft ? effectiveDefinition(draft, quick, columns) : null;
  const { result, error, loading } = useResult(api, effective);
  const dirty = saved !== null && draft !== null && isDirty(saved, draft);

  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [sheet, setSheet] = React.useState(false);
  const [downloading, setDownloading] = React.useState<Format | null>(null);
  const [removing, setRemoving] = React.useState(false);
  const [removeError, setRemoveError] = React.useState<string | null>(null);

  const go = (id: string | null) => navigate(tablesTo(id), { replace: true });

  const download = async (format: Format) => {
    if (!effective) return;
    setDownloading(format);
    try {
      await api.download(format, effective, current.name, `tabel-${effective.subject}.${format}`);
    } catch (err) {
      adminToast.error(await blobErrorText(err, TABLES_COPY.errors.download));
    } finally {
      setDownloading(null);
    }
  };

  const save = async () => {
    if (!draft) return;
    try {
      const reply = await api.updateView(current.id, { definition: draft });
      adminToast.success(reply.toast);
      await reloadViews();
    } catch (err) {
      adminToast.error(requestErrorText(err, PRESENCE_ERRORS.failed));
    }
  };

  /** Saves a new view; resolves with the server's text when it refuses (the modal shows it). */
  const create = async (name: string): Promise<string | null> => {
    const definition = dialog?.kind === 'duplicate' ? saved : draft;
    if (!definition) return PRESENCE_ERRORS.failed;
    try {
      const reply = await api.createView(name, definition);
      adminToast.success(reply.toast);
      await reloadViews();
      setDialog(null);
      go(reply.view.id);
      return null;
    } catch (err) {
      return requestErrorText(err, PRESENCE_ERRORS.failed);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      const reply = await api.deleteView(current.id);
      setDialog(null);
      setRemoveError(null);
      go(null);
      await reloadViews();
      const { actionId } = reply;
      adminToast.success(reply.toast, actionId ? {
        duration: UNDO_MS,
        action: {
          label: TABLES_COPY.undo,
          onClick: () => { void api.undo(actionId).then(() => adminToast.success(MONEY_UI_COPY.undo.done)).catch((err) => adminToast.error(requestErrorText(err, PRESENCE_ERRORS.failed))).finally(() => void reloadViews()); },
        },
      } : undefined);
    } catch (err) {
      setRemoveError(requestErrorText(err, PRESENCE_ERRORS.failed));
    } finally {
      setRemoving(false);
    }
  };

  const onSort = (key: string) => {
    if (!draft) return;
    const s = draft.sort;
    const next = s?.column !== key ? { column: key, dir: 'asc' as const } : s.dir === 'asc' ? { column: key, dir: 'desc' as const } : null;
    setDraft({ ...draft, sort: next });
  };

  const notices = [...new Set([...(current.notices ?? []), ...(result?.notices ?? [])])];
  const builder = draft ? <Builder definition={draft} catalog={catalog} onChange={setDraft} /> : null;
  const [one, many] = draft ? TABLES_COUNT_WORDS[draft.subject] : TABLES_COUNT_WORDS.sportivi;

  return (
    <AdminPage className="tbl-page">
      <style>{SPORTIVI_CSS}{TABELE_CSS}</style>
      {tabs}
      <Window>
        <PageHeader title={LIST_COPY.title} />
        <ViewBar
          ready={catalog.readyMade} saved={views} current={current} dirty={dirty}
          canDownload={!!result && !error && !current.broken} downloading={downloading}
          onPick={go} onSave={() => void save()} onSaveAsNew={() => setDialog({ kind: 'new' })} onDuplicate={() => setDialog({ kind: 'duplicate' })}
          onRemove={() => { setRemoveError(null); setDialog({ kind: 'remove' }); }} onDownload={(f) => void download(f)}
        />
        {current.broken && <div className="tbl-notices"><Notice tone="warning">{TABLES_COPY.brokenView}</Notice></div>}
        {draft && !phone && <div className="tbl-builder">{builder}</div>}
        {draft && phone && (
          <div className="tbl-bar"><Button variant="secondary" onClick={() => setSheet(true)}>{TABLES_COPY.editMobile}</Button></div>
        )}
        {draft && <QuickFilters catalog={catalog} definition={draft} quick={quick} onChange={setQuick} />}
        {notices.length > 0 && (
          <div className="tbl-notices">{notices.map((n) => <Notice key={n} tone="warning">{n}</Notice>)}</div>
        )}
        {error && <div className="tbl-notices"><Notice tone="danger">{error}</Notice></div>}
        {result && !error && <p className="tbl-count">{countWords(result.count, one, many)}</p>}
        {loading && !result && !error && <div className="tbl-loading"><Loading /></div>}
        {result && !error && noPaymentsThisMonth(current.id, result) && <EmptyState>{TABLES_COPY.noPaymentsMonth}</EmptyState>}
        {result && !error && !noPaymentsThisMonth(current.id, result) && (
          <ResultTable
            result={result} sort={draft?.sort ?? null} onSort={onSort} collapsed={collapsed}
            onToggle={(k) => setCollapsed((c) => { const n = new Set(c); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
          />
        )}
        {!draft && !current.broken && <EmptyState>{TABLES_COPY.empty}</EmptyState>}
      </Window>
      <BottomSheet open={phone && sheet} onClose={() => setSheet(false)} title={TABLES_COPY.editMobile} fullHeight>{builder}</BottomSheet>
      <NewViewModal
        open={dialog?.kind === 'new' || dialog?.kind === 'duplicate'}
        initialName={dialog?.kind === 'duplicate' ? TABLES_COPY.copyOf(current.name) : ''}
        onSave={create} onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog?.kind === 'remove'} title={TABLES_COPY.confirmDelete(current.name)} message={null}
        confirmLabel={TABLES_COPY.remove} busyLabel={TABLES_COPY.remove} cancelLabel={TABLES_COPY.giveUp}
        busy={removing} error={removeError} onConfirm={() => void remove()} onCancel={() => setDialog(null)}
      />
    </AdminPage>
  );
}

/** The Sportivi "Tabele" tab (spec 5.5): ready-made and saved views, the builder, the table and the downloads. `tabs` is the Listă | Tabele tab row. */
export function TabelePage({ tabs }: { tabs: React.ReactNode }) {
  const api = useTablesApi();
  const { catalog, views, failed, reloadViews } = useTablesData(api);
  if (catalog) return <Loaded api={api} catalog={catalog} views={views} reloadViews={reloadViews} tabs={tabs} />;
  return (
    <AdminPage className="tbl-page">
      {tabs}
      <Window>
        <PageHeader title={LIST_COPY.title} />
        {failed ? <div className="tbl-notices"><Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice></div> : <div className="tbl-loading"><Loading /></div>}
      </Window>
    </AdminPage>
  );
}
