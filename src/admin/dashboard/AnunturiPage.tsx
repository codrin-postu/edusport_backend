import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { ANUNT_EDIT_TO } from './menu';
import { AutoNoticeView } from './anunturi/AutoNoticeView';
import { AdminPage, Window, PageHeader, Button, DataTable, FilterPanel, StatusBadge, Notice, EmptyState, Loading, adminToast, useDragReorder, moveItem, type DataColumn, type FilterSection } from '../ui';
import { IconGlobe, IconGrip, IconUser } from '../ui/icons';
import { useAreas } from '../lib/useAreas';
import { ANUNT_LIST_COPY, filterRows, type ListRow, type PlaceState, type PortalSummary, type RowState, type Where } from '../../club/anunturi/portal-history';
import { countWords } from '../../club/ro-count';

/**
 * EduSport admin, "Anunțuri" list page.
 *
 * Data source is the custom admin API (`/api/anunturi`, auth:false +
 * `global::has-role`), NOT the content-manager: the announcement content type is
 * hidden from the content-manager on purpose. The answer carries `data` (the full
 * announcement rows, which the editor reads) and `list` (the rows of this table:
 * announcements and the automatic messages, already ordered).
 *
 * One table, no tabs (approved board "Anunțuri: tabel cu titluri, Stare și Rezultat"):
 * Anunț, Unde (globe = site, person = portal, in fixed slots), Pentru, Perioadă, Stare,
 * Rezultat. The rows that hold a place in the site order carry a grip; a row opens the
 * editor, an automatic one a read-only detail. The rules (states, order, filter, texts)
 * live in src/club/anunturi/portal-history.ts.
 *
 * CSS NOTE: every class this page introduces is prefixed `anun-`, tokens only
 * (var(--theme-*), var(--ui-*)).
 */

// ---------------------------------------------------------------------------
// Shared API contract (the edit page imports these)
// ---------------------------------------------------------------------------

// Content-api route, so it carries the /api prefix — same as every other custom
// admin page ('/api/forms/inscrieri', '/api/forms/voluntari'). Without it the
// request 404s and the page renders its error state.
export const ANUNT_API = '/api/anunturi';

export type AnuntGroup = 'active' | 'scheduled' | 'past';
export type UmamiState = 'ok' | 'not_configured' | 'error';

export interface AnuntStats {
  views: number;
  clicks: number;
  dismisses: number;
  /** Fraction 0..1, computed server-side as clicks / views. */
  ctr: number;
}

export interface Anunt {
  documentId: string;
  title: string | null;
  eyebrow: string | null;
  slug: string | null;
  message: string | null;
  format: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  startAt: string | null;
  endAt: string | null;
  priority: number | null;
  isActive: boolean | null;
  dismissDays: number | null;
  showOnSite: boolean | null;
  showOnPortal: boolean | null;
  portalGroupIds: string[] | null;
  portalAuthor: string | null;
  group: AnuntGroup;
  stats: AnuntStats | null;
  /** Counts of the notice made for the portal; null when it was never sent there. */
  portal: PortalSummary | null;
}

/**
 * Server-side validation answers with a 400 carrying a Romanian message
 * (`{ error: { message } }`). Surface it verbatim; fall back only when the
 * failure carries nothing readable (network error, 500, axios' own
 * "Request failed with status code ..." filler).
 */
export function anuntErrorMessage(err: any, fallback: string): string {
  const m =
    err?.response?.data?.error?.message ??
    err?.response?.data?.message ??
    err?.message;
  if (typeof m !== 'string') return fallback;
  const t = m.trim();
  if (!t || /^request failed/i.test(t) || /^network error/i.test(t)) return fallback;
  return t;
}

/** Romanian-aware slug for the `slug` uid field (the Umami tracking id). */
export function slugifyRo(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[îí]/gi, 'i')
    .replace(/[șş]/gi, 's')
    .replace(/[țţ]/gi, 't')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Page CSS, tokens only, every selector namespaced under `.ui-root .anun-*`
// ---------------------------------------------------------------------------

const ANUN_CSS = `
.ui-root .anun-title{color:var(--theme-text);font-weight:650}
.ui-root .anun-title .ui-badge{margin-left:8px;vertical-align:1px}
.ui-root .anun-sub{display:block;margin-top:2px;font-size:11.5px;color:var(--theme-text-muted)}
.ui-root .anun-pl{display:flex;align-items:center;gap:10px}
.ui-root .anun-slot{width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;color:var(--theme-text-muted)}
.ui-root .anun-slot.is-active{color:var(--theme-primary)}
.ui-root .anun-res{display:block;white-space:nowrap;font-variant-numeric:tabular-nums}
.ui-root .anun-grab{border:none;background:none;padding:2px;color:var(--theme-text-muted);cursor:grab;line-height:0;display:inline-flex}
.ui-root .anun-grab:hover{color:var(--theme-text)}
.ui-root .anun-grab:focus-visible{outline:2px solid var(--theme-focus);outline-offset:2px;color:var(--theme-primary)}
.ui-root .anun-grab:active{cursor:grabbing}
.ui-root .anun-portal{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.ui-root .anun-auto-rows{margin:0;padding:0;list-style:none;display:grid;gap:4px}
`;

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

const copy = ANUNT_LIST_COPY;
const NUM_DASH = copy.none;

const STATE_TONE: Record<RowState, 'success' | 'info' | 'neutral'> = { active: 'success', waiting: 'info', ended: 'neutral', stopped: 'neutral' };

/** Globe left, person right: each has its own slot, so an empty one keeps the space and the icons line up down the column. */
function PlaceIcon({ place, state }: { place: 'site' | 'portal'; state: PlaceState }) {
  const label = copy.placeLabel(place, state);
  return (
    <span className={`anun-slot${state === 'active' ? ' is-active' : ''}`} title={state === null ? undefined : label} role={state === null ? undefined : 'img'} aria-label={state === null ? undefined : label}>
      {state === null ? null : place === 'site' ? <IconGlobe /> : <IconUser />}
    </span>
  );
}

const Places = ({ row }: { row: ListRow }) => (
  <span className="anun-pl">
    <PlaceIcon place="site" state={row.site} />
    <PlaceIcon place="portal" state={row.portal} />
  </span>
);

const Title = ({ row }: { row: ListRow }) => (
  <>
    <span className="anun-title">
      {row.title || '(fără titlu)'}
      {row.source === 'auto' && <StatusBadge>{copy.auto}</StatusBadge>}
    </span>
    {row.subline && <span className="anun-sub">{row.subline}</span>}
  </>
);

const Results = ({ row }: { row: ListRow }) =>
  row.results.length === 0 ? <span className="ui-muted">{NUM_DASH}</span> : <>{row.results.map((r) => <span key={r} className="anun-res">{r}</span>)}</>;

const WHERE_OPTIONS = [
  { value: 'site', label: copy.site },
  { value: 'portal', label: copy.portal },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnunturiPage() {
  const { get, put } = useFetchClient();
  const navigate = useNavigate();
  const areas = useAreas();

  const [rows, setRows] = React.useState<ListRow[]>([]);
  const [umami, setUmami] = React.useState<UmamiState>('ok');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [where, setWhere] = React.useState<Where>('toate');
  const [auto, setAuto] = React.useState<ListRow | null>(null);
  const [reordering, setReordering] = React.useState(false);

  const applyList = React.useCallback((payload: any) => {
    const list = payload?.data?.list ?? payload?.list ?? [];
    setRows(Array.isArray(list) ? list : []);
    const u = payload?.data?.umami ?? payload?.umami;
    setUmami(u === 'ok' || u === 'not_configured' || u === 'error' ? u : 'error');
  }, []);

  React.useEffect(() => {
    let off = false;
    setLoading(true);
    setError(false);
    get(ANUNT_API)
      .then((res: any) => {
        if (!off) applyList(res);
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
  }, [get, applyList]);

  const shown = React.useMemo(() => filterRows(rows, where), [rows, where]);
  const ordered = React.useMemo(() => rows.filter((r) => r.reorderable), [rows]);

  const openRow = (r: ListRow) => (r.source === 'auto' ? setAuto(r) : navigate(`${ANUNT_EDIT_TO}?id=${r.id}`));

  /**
   * Optimistic reorder inside the rows that hold a place in the site order (they come first in the list). The server answers with the whole
   * refreshed list; on failure the previous rows come back so the page never claims an order the database does not hold.
   */
  const move = React.useCallback(
    async (from: number, to: number) => {
      const previous = rows;
      const next = moveItem(ordered, from, to);
      setRows([...next, ...rows.filter((r) => !r.reorderable)]);
      setReordering(true);
      try {
        applyList(await put(`${ANUNT_API}/reorder`, { order: next.map((r) => r.id) }));
      } catch (err) {
        setRows(previous);
        adminToast.error(anuntErrorMessage(err, 'Reordonarea a eșuat. Ordinea a fost restaurată.'));
      } finally {
        setReordering(false);
      }
    },
    [rows, ordered, put, applyList],
  );
  const drag = useDragReorder({ count: ordered.length, onMove: move, disabled: where !== 'toate' || reordering });

  const columns: DataColumn<ListRow>[] = [
    {
      key: 'grip', header: <span className="ui-sr">Ordine</span>, width: '1%',
      render: (r) => {
        const i = ordered.indexOf(r);
        if (i < 0) return null;
        return (
          <button type="button" className="anun-grab" aria-label={`Reordonează "${r.title}"`} {...drag.handleProps(i)} onClick={(e) => e.stopPropagation()}>
            <IconGrip />
          </button>
        );
      },
    },
    { key: 'title', header: 'Anunț', width: '30%', render: (r) => <Title row={r} /> },
    { key: 'where', header: copy.filterWhere, width: '1%', render: (r) => <Places row={r} /> },
    { key: 'audience', header: 'Pentru', render: (r) => r.audience },
    { key: 'period', header: 'Perioadă', render: (r) => <span className="ui-muted">{r.period}</span> },
    { key: 'state', header: 'Stare', render: (r) => <StatusBadge tone={STATE_TONE[r.state]}>{copy.states[r.state]}</StatusBadge> },
    { key: 'results', header: 'Rezultat', width: '24%', render: (r) => <Results row={r} /> },
  ];

  const sections: FilterSection[] = [
    { key: 'where', label: copy.filterWhere, options: WHERE_OPTIONS, selected: where === 'toate' ? [] : [where], single: true, allLabel: copy.filterAll },
  ];
  const count = countWords(shown.length, 'anunț', 'anunțuri');

  const umamiNote =
    umami === 'not_configured'
      ? 'Umami nu este configurat, așa că vizualizările site-ului nu apar.'
      : umami === 'error'
        ? 'Nu am putut citi vizualizările din Umami. Restul paginii funcționează normal.'
        : null;

  return (
    <AdminPage>
      <style>{ANUN_CSS}</style>

      <Window>
        <PageHeader
          title="Anunțuri"
          subtitle="Anunțuri pe site și pe portalul sportivilor."
          actions={
            <>
              <FilterPanel
                sections={sections}
                onChange={(_key, selected) => setWhere((selected[0] as Where | undefined) ?? 'toate')}
                onClearAll={() => setWhere('toate')}
                totalLabel={count}
                showLabel={`Arată ${count}`}
              />
              <Button onClick={() => navigate(ANUNT_EDIT_TO)}>+ Anunț nou</Button>
            </>
          }
        />

        {loading ? (
          <Loading />
        ) : error ? (
          <EmptyState>Nu am putut încărca anunțurile.</EmptyState>
        ) : (
          <>
            {umamiNote && <Notice tone="info">{umamiNote}</Notice>}
            <DataTable
              columns={columns}
              rows={shown}
              getRowKey={(r) => `${r.source}:${r.id}`}
              onRowClick={openRow}
              rowLabel={(r) => r.title}
              rowProps={(r) => {
                const i = ordered.indexOf(r);
                return i < 0 ? {} : (drag.itemProps(i) as React.HTMLAttributes<HTMLTableRowElement>);
              }}
              pageSize={0}
              empty={rows.length === 0 ? 'Niciun anunț încă. Apasă "+ Anunț nou" ca să creezi primul.' : 'Niciun anunț aici.'}
            />
          </>
        )}
      </Window>

      {drag.live}
      {auto && <AutoNoticeView row={auto} canSeeAccounts={areas.has('club')} onClose={() => setAuto(null)} />}
    </AdminPage>
  );
}
