import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminPage, EmptyState, Loading, Notice, PageHeader, Window, adminToast, useMediaQuery } from '../../../ui';
import { ConfirmDialog } from '../../../ConfirmDialog';
import type { CatalogAnswer } from '../../../../club/tables/catalog-api';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { nextSort } from '../../../../club/tables/header-sort';
import { railGroups, type RailMenuKey } from '../../../../club/tables/rail';
import { readTabeleQuery, tablesTo } from '../../../../club/tables/routes';
import { RAIL_KEY, RAIL_OVERLAY_MAX, pageTitle, railInitial, railStored } from '../../../../club/tables/shell-state';
import type { SavedViewRow, TableDefinition, TableResult } from '../../../../club/tables/types';
import { isDirty, noPaymentsThisMonth } from '../../../../club/tables/view-state';
import { MONEY_UI_COPY } from '../../../../club/presence/copy/money-ui';
import { PRESENCE_ERRORS } from '../../../../club/presence/copy/core';
import { requestErrorText } from '../../../../club/registration-panel';
import { blobErrorText } from '../../inscrieri/downloadPdf';
import { useLatest } from '../../bani/latest';
import { SPORTIVI_CSS } from '../styles';
import { useTablesApi, type Format, type TablesApi } from './api';
import { FilterChips } from './FilterChips';
import { MetaRow } from './MetaRow';
import { NewViewModal } from './NewViewModal';
import { ResultTable } from './ResultTable';
import { SavedRail } from './SavedRail';
import { TableHeader } from './TableHeader';
import { TypeBar } from './TypeBar';
import { TABELE_CSS } from './styles';

const UNDO_MS = 8000;
const QUERY_DELAY_MS = 300;
const RAIL_ID = 'tbl-rail';
const OVERLAY_QUERY = `(max-width: ${RAIL_OVERLAY_MAX}px)`;

/** Whether the rail starts open: the remembered choice, else by width. A slide-over always starts closed. */
function railStart(overlay: boolean): boolean {
  if (overlay) return false;
  let stored: string | null = null;
  try { stored = globalThis.localStorage.getItem(RAIL_KEY); } catch { /* storage blocked: not remembered */ }
  return railInitial(stored, window.innerWidth);
}

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

type Dialog = { kind: 'new' } | { kind: 'duplicate' | 'rename' | 'remove'; view: SavedViewRow } | null;

type LoadedProps = { api: TablesApi; catalog: CatalogAnswer; views: SavedViewRow[]; reloadViews: () => Promise<void> };

function Loaded({ api, catalog, views, reloadViews }: LoadedProps) {
  const overlay = useMediaQuery(OVERLAY_QUERY);
  const [railOpen, setRailOpen] = React.useState(() => railStart(overlay));
  React.useEffect(() => setRailOpen(railStart(overlay)), [overlay]);
  /** The choice of the column rail is remembered; opening the slide-over on a narrow screen is not. */
  const setRail = (open: boolean) => {
    setRailOpen(open);
    if (overlay) return;
    try { globalThis.localStorage.setItem(RAIL_KEY, railStored(open)); } catch { /* storage blocked: not remembered */ }
  };
  const navigate = useNavigate();
  const { search } = useLocation();
  const all = [...catalog.readyMade, ...views];
  const groups = railGroups(all);
  const wanted = readTabeleQuery(search).viewId;
  const current = all.find((v) => v.id === wanted) ?? catalog.readyMade.find((v) => v.id === catalog.defaultViewId) ?? catalog.readyMade[0];
  const saved = current.definition;
  const savedKey = JSON.stringify(saved);

  const [draft, setDraft] = React.useState<TableDefinition | null>(saved);
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(new Set());
  React.useEffect(() => { setDraft(saved); setCollapsed(new Set()); }, [current.id, savedKey]);

  const { result, error, loading } = useResult(api, draft);
  const dirty = saved !== null && draft !== null && isDirty(saved, draft);

  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [downloading, setDownloading] = React.useState<Format | null>(null);
  const [removing, setRemoving] = React.useState(false);
  const [removeError, setRemoveError] = React.useState<string | null>(null);

  const go = (id: string | null) => navigate(tablesTo(id), { replace: true });

  const download = async (format: Format) => {
    if (!draft) return;
    setDownloading(format);
    try {
      await api.download(format, draft, current.name, `tabel-${draft.subject}.${format}`);
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

  /** "Salvează" of the header: over an own view when changed, otherwise (ready-made, a colleague's) the "Vizualizare nouă" modal. */
  const onSaveClick = () => (current.mine ? void save() : setDialog({ kind: 'new' }));
  const saveEnabled = !current.broken && (current.mine ? dirty : true);

  /** Saves a new view (from the draft, or a copy of the duplicated one); resolves with the server's text when it refuses (the modal shows it). */
  const create = async (name: string): Promise<string | null> => {
    const definition = dialog?.kind === 'duplicate' ? dialog.view.definition : draft;
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

  const rename = async (name: string): Promise<string | null> => {
    if (dialog?.kind !== 'rename') return PRESENCE_ERRORS.failed;
    try {
      const reply = await api.updateView(dialog.view.id, { name });
      adminToast.success(reply.toast);
      await reloadViews();
      setDialog(null);
      return null;
    } catch (err) {
      return requestErrorText(err, PRESENCE_ERRORS.failed);
    }
  };

  const onMenu = (key: RailMenuKey, view: SavedViewRow) => {
    setRemoveError(null);
    setDialog({ kind: key, view });
  };

  const remove = async () => {
    if (dialog?.kind !== 'remove') return;
    const target = dialog.view;
    setRemoving(true);
    try {
      const reply = await api.deleteView(target.id);
      setDialog(null);
      setRemoveError(null);
      if (target.id === current.id) go(null);
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

  const onSort = (key: string) => draft && setDraft({ ...draft, sort: nextSort(draft.sort, key) });

  const notices = [...new Set([...(current.notices ?? []), ...(result?.notices ?? [])])];
  const title = pageTitle(draft && saved && draft.subject !== saved.subject ? null : current, TABLES_COPY.subjects[draft?.subject ?? 'sportivi']);

  return (
    <AdminPage className="tbl-page">
      <style>{SPORTIVI_CSS}{TABELE_CSS}</style>
      <TableHeader
        title={title} railOpen={railOpen} railId={RAIL_ID} onRail={() => setRail(!railOpen)}
        canSave={saveEnabled} onSave={onSaveClick}
        canDownload={!!result && !error && !current.broken} downloading={downloading} onDownload={(f) => void download(f)}
      />
      <div className="tbl-layout">
        <SavedRail id={RAIL_ID} groups={groups} currentId={current.id} open={railOpen} overlay={overlay} onPick={go} onMenu={onMenu} onClose={() => setRail(false)} />
        <div className="tbl-main">
      <Window>
        {current.broken && <div className="tbl-notices"><Notice tone="warning">{TABLES_COPY.brokenView}</Notice></div>}
        {draft && (
          <div className="tbl-bar">
            <TypeBar definition={draft} catalog={catalog} onChange={setDraft} />
            <FilterChips definition={draft} catalog={catalog} onChange={setDraft} />
          </div>
        )}
        {notices.length > 0 && (
          <div className="tbl-notices">{notices.map((n) => <Notice key={n} tone="warning">{n}</Notice>)}</div>
        )}
        {error && <div className="tbl-notices"><Notice tone="danger">{error}</Notice></div>}
        {draft && <MetaRow definition={draft} columns={catalog.subjects[draft.subject]?.columns ?? []} count={result && !error ? result.count : null} onChange={setDraft} />}
        {loading && !result && !error && <div className="tbl-loading"><Loading /></div>}
        {result && !error && noPaymentsThisMonth(current.id, dirty, result) && <EmptyState>{TABLES_COPY.noPaymentsMonth}</EmptyState>}
        {result && !error && !noPaymentsThisMonth(current.id, dirty, result) && (
          <ResultTable
            result={result} sort={draft?.sort ?? null} onSort={onSort} collapsed={collapsed}
            onToggle={(k) => setCollapsed((c) => { const n = new Set(c); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
          />
        )}
        {!draft && !current.broken && <EmptyState>{TABLES_COPY.empty.sportivi}</EmptyState>}
      </Window>
        </div>
      </div>
      <NewViewModal
        open={dialog?.kind === 'new' || dialog?.kind === 'duplicate' || dialog?.kind === 'rename'}
        title={dialog?.kind === 'rename' ? TABLES_COPY.rename : undefined}
        initialName={dialog?.kind === 'duplicate' ? TABLES_COPY.copyOf(dialog.view.name) : dialog?.kind === 'rename' ? dialog.view.name : ''}
        onSave={dialog?.kind === 'rename' ? rename : create} onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog?.kind === 'remove'} title={TABLES_COPY.confirmDelete(dialog?.kind === 'remove' ? dialog.view.name : '')} message={null}
        confirmLabel={TABLES_COPY.remove} busyLabel={TABLES_COPY.remove} cancelLabel={TABLES_COPY.giveUp}
        busy={removing} error={removeError} onConfirm={() => void remove()} onCancel={() => setDialog(null)}
      />
    </AdminPage>
  );
}

/** The Tabele page (spec 6): header, the saved-tables rail, the control row, the table and the export. */
export function TabelePage() {
  const api = useTablesApi();
  const { catalog, views, failed, reloadViews } = useTablesData(api);
  if (catalog) return <Loaded api={api} catalog={catalog} views={views} reloadViews={reloadViews} />;
  return (
    <AdminPage className="tbl-page">
      <Window>
        <PageHeader title={TABLES_COPY.pageTitle} />
        {failed ? <div className="tbl-notices"><Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice></div> : <div className="tbl-loading"><Loading /></div>}
      </Window>
    </AdminPage>
  );
}
