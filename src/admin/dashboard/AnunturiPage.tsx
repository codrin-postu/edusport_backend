import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { ANUNT_EDIT_TO } from './menu';
import { ConfirmDialog } from '../ConfirmDialog';
import { AdminPage, Window, PageHeader, Button, StatusBadge, Notice, EmptyState, Loading, adminToast } from '../ui';

/**
 * EduSport admin — "Anunțuri" list page.
 *
 * Data source is the custom admin API (`/api/anunturi`, auth:false +
 * `global::is-admin`), NOT the content-manager: the announcement content type is
 * hidden from the content-manager on purpose, and the list endpoint additionally
 * decorates every row with its Umami stats and its computed group.
 *
 * Three groups, exactly as approved in `.mockups/announcements.html` §02:
 *   - Active acum  — drag ⠿ to reorder; row 1 is the one actually on the site;
 *   - Programate   — ordered by start date, no drag (the dates decide);
 *   - Încheiate    — archive with final numbers.
 *
 * NOT a DataTable: the active group is hand-ordered by drag/keyboard (the order
 * itself is the data, persisted via /reorder), and rows are split into three
 * named groups rather than one sortable/searchable/paginated set. DataTable's
 * generic model (search box, column sort, page slicing) has no place to hang a
 * drag handle or a group header, so this page keeps its bespoke list and only
 * moves page chrome, chips and messaging onto the shared components.
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
  group: AnuntGroup;
  stats: AnuntStats | null;
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
// Formatting
// ---------------------------------------------------------------------------

const NUM = new Intl.NumberFormat('ro-RO');

/** "2026-09-20T10:00:00.000Z" -> "20.09" */
function dayMonth(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** The schedule window, phrased per group, as in the mockup. */
function windowLabel(a: Anunt): string {
  if (a.group === 'scheduled') return `${dayMonth(a.startAt)} – ${dayMonth(a.endAt)}`;
  if (a.group === 'past') return `încheiat ${dayMonth(a.endAt)}`;
  return `până ${dayMonth(a.endAt)}`;
}

/** First line of the message, trimmed to a row-sized snippet. */
function snippet(message?: string | null): string {
  const s = (message ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length > 92 ? `${s.slice(0, 91)}…` : s;
}

function ctrLabel(ctr: number): string {
  return `${(ctr * 100).toFixed(1).replace('.', ',')}%`;
}

// ---------------------------------------------------------------------------
// Page CSS — tokens only, every selector namespaced under `.ui-root .anun-*`
// ---------------------------------------------------------------------------

const ANUN_CSS = `
.ui-root .anun-grp{margin-bottom:20px}
.ui-root .anun-grp:last-child{margin-bottom:0}
.ui-root .anun-grp-h{display:flex;align-items:center;gap:9px;margin:0 0 8px}
.ui-root .anun-grp-h .anun-t{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--theme-text-muted)}
.ui-root .anun-grp-h .anun-n{font-size:11px;font-weight:700;color:var(--theme-text-muted);font-variant-numeric:tabular-nums}

.ui-root .anun-rows{background:var(--theme-surface);border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);overflow:hidden}
.ui-root .anun-none{padding:16px 14px;font-size:12.5px;color:var(--theme-text-muted)}

.ui-root .anun-row{display:flex;align-items:center;gap:13px;padding:11px 14px;border-bottom:1px solid var(--theme-border-subtle);font-size:13px;cursor:pointer}
.ui-root .anun-row:last-child{border-bottom:none}
.ui-root .anun-row:hover{background:var(--theme-surface-subtle)}
.ui-root .anun-row.is-live{background:var(--theme-primary-soft)}
.ui-root .anun-row.is-live:hover{background:var(--theme-primary-soft)}
/* Active but held back by the row above: warm tint + a red left edge, so "not on
   the site right now" reads without counting positions. */
.ui-root .anun-row.is-waiting{background:var(--theme-danger-bg);box-shadow:inset 3px 0 0 var(--theme-danger-border)}
.ui-root .anun-row.is-waiting:hover{background:var(--theme-danger-bg)}
.ui-root .anun-row.is-paused .anun-nm,.ui-root .anun-row.is-paused .anun-win{opacity:.55}
.ui-root .anun-row.is-past{color:var(--theme-text-muted)}
.ui-root .anun-row.is-dragging{opacity:.4}
.ui-root .anun-row.is-over{box-shadow:inset 0 2px 0 var(--theme-primary)}

.ui-root .anun-grab{border:none;background:none;padding:0 2px;color:var(--theme-text-muted);font-size:13px;letter-spacing:-2px;cursor:grab;line-height:1;flex-shrink:0}
.ui-root .anun-grab:focus-visible{outline:2px solid var(--theme-focus);outline-offset:2px;border-radius:var(--ui-radius-sm);color:var(--theme-primary)}
.ui-root .anun-grab:active{cursor:grabbing}
.ui-root .anun-grab:disabled{cursor:default}

.ui-root .anun-pri{width:19px;height:19px;border-radius:var(--ui-radius-sm);background:var(--theme-primary);color:var(--theme-on-primary);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-variant-numeric:tabular-nums}

.ui-root .anun-nm{font-weight:650;flex:1;min-width:0}
.ui-root .anun-nm .anun-sub{display:block;font-weight:400;font-size:11.5px;color:var(--theme-text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ui-root .anun-win{font-size:11.5px;color:var(--theme-text-muted);white-space:nowrap;font-variant-numeric:tabular-nums}
.ui-root .anun-stat{font-size:11.5px;color:var(--theme-text-secondary);white-space:nowrap;font-variant-numeric:tabular-nums;min-width:118px;text-align:right}
.ui-root .anun-stat b{font-weight:700}
`;

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface RowProps {
  a: Anunt;
  /** 1-based badge, or null for the groups that show a "—" badge. */
  rank: number | null;
  isLive: boolean;
  draggable: boolean;
  dragging: boolean;
  over: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onGrabDown: () => void;
  onGrabUp: () => void;
  onGrabKey: (e: React.KeyboardEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function AnuntRow({
  a,
  rank,
  isLive,
  draggable,
  dragging,
  over,
  onOpen,
  onDelete,
  onGrabDown,
  onGrabUp,
  onGrabKey,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: RowProps) {
  const paused = a.group === 'active' && a.isActive === false;
  // In the active group only the top non-paused row reaches the site. Everything
  // else here is scheduled to be visible right now but is being held back by the
  // one above it, which is not obvious from the order alone.
  const waiting = a.group === 'active' && !isLive;

  const cls = [
    'anun-row',
    isLive ? 'is-live' : '',
    waiting ? 'is-waiting' : '',
    paused ? 'is-paused' : '',
    a.group === 'past' ? 'is-past' : '',
    dragging ? 'is-dragging' : '',
    over ? 'is-over' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cls}
      onClick={onOpen}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {a.group === 'active' && (
        <button
          type="button"
          className="anun-grab"
          aria-label={`Reordonează „${a.title ?? ''}". Trage, sau folosește săgețile sus și jos.`}
          title="Trage ca să schimbi ordinea (sau săgeți sus/jos)"
          onMouseDown={onGrabDown}
          onMouseUp={onGrabUp}
          onKeyDown={onGrabKey}
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </button>
      )}

      {/* Only the active group is ordered, so only it gets a rank badge. The
          other two groups are ordered by date and used to show a placeholder
          dash, which read as a broken cell. */}
      {rank !== null && (
        <span className="anun-pri" aria-hidden="true">
          {rank}
        </span>
      )}

      <span className="anun-nm">
        {a.title || '(fără titlu)'}
        <span className="anun-sub">{snippet(a.message)}</span>
      </span>

      {/* No chip for the live row: active is the default, and the highlighted
          row already says which one is on the site. Only the exceptions are
          labelled. */}
      {paused && <StatusBadge tone="warning">inactiv</StatusBadge>}
      {waiting && !paused && <StatusBadge tone="danger">în așteptare</StatusBadge>}
      {a.group === 'scheduled' && <StatusBadge tone="info">din {dayMonth(a.startAt)}</StatusBadge>}
      {a.group === 'past' && <StatusBadge tone="neutral">încheiat</StatusBadge>}
      <StatusBadge tone="primary">{a.format === 'modal' ? 'modal' : 'card'}</StatusBadge>

      <span className="anun-win">{windowLabel(a)}</span>

      {/* No figures yet (or no Umami) renders nothing at all — a lone dash reads
          as a broken column rather than as "this has not run yet". */}
      <span className="anun-stat">
        {a.stats && (
          <>
            <b>{NUM.format(a.stats.views)}</b> văzut · <b>{NUM.format(a.stats.clicks)}</b> click ·{' '}
            {ctrLabel(a.stats.ctr)}
          </>
        )}
      </span>

      <Button
        variant="ghost"
        size="sm"
        title="Șterge anunțul"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        Șterge
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnunturiPage() {
  const { get, del, put } = useFetchClient();
  const navigate = useNavigate();

  const [rows, setRows] = React.useState<Anunt[]>([]);
  const [umami, setUmami] = React.useState<UmamiState>('ok');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [status, setStatus] = React.useState('');

  const applyList = React.useCallback((payload: any) => {
    const data = payload?.data?.data ?? payload?.data ?? [];
    setRows(Array.isArray(data) ? data : []);
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

  const active = React.useMemo(() => rows.filter((r) => r.group === 'active'), [rows]);
  const scheduled = React.useMemo(() => rows.filter((r) => r.group === 'scheduled'), [rows]);
  const past = React.useMemo(() => rows.filter((r) => r.group === 'past'), [rows]);

  // The row the site actually renders: first ACTIVE row that is not paused.
  const liveId = React.useMemo(() => active.find((r) => r.isActive !== false)?.documentId ?? null, [active]);

  const openEdit = (documentId: string) => navigate(`${ANUNT_EDIT_TO}?id=${documentId}`);

  // -- reorder ---------------------------------------------------------------

  const [handleIdx, setHandleIdx] = React.useState<number | null>(null);
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);
  const [overIdx, setOverIdx] = React.useState<number | null>(null);
  const [reordering, setReordering] = React.useState(false);

  const resetDrag = () => {
    setHandleIdx(null);
    setDragIdx(null);
    setOverIdx(null);
  };

  /**
   * Optimistic reorder: move `from` to `to` inside the active group, renumber
   * priority 1..n locally so the badges update immediately, then persist. The
   * server answers with the whole refreshed list; on failure we put the previous
   * rows back so the UI never claims an order the database does not hold.
   */
  const moveActive = React.useCallback(
    async (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= active.length || to >= active.length) return;

      const previous = rows;
      const next = active.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      const renumbered = next.map((r, i) => ({ ...r, priority: i + 1 }));

      setRows([...renumbered, ...scheduled, ...past]);
      setStatus(`„${moved.title ?? ''}" mutat pe poziția ${to + 1} din ${next.length}.`);
      setReordering(true);
      try {
        const res: any = await put(`${ANUNT_API}/reorder`, {
          order: renumbered.map((r) => r.documentId),
        });
        applyList(res);
      } catch (err) {
        setRows(previous);
        setStatus('');
        adminToast.error(anuntErrorMessage(err, 'Reordonarea a eșuat. Ordinea a fost restaurată.'));
      } finally {
        setReordering(false);
      }
    },
    [rows, active, scheduled, past, put, applyList],
  );

  const onGrabKey = (i: number) => (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    e.stopPropagation();
    if (reordering) return;
    const to = e.key === 'ArrowUp' ? i - 1 : i + 1;
    if (to < 0 || to >= active.length) return;
    void moveActive(i, to);
    // Keep the keyboard on the handle that just moved.
    const el = e.currentTarget as HTMLElement;
    window.setTimeout(() => {
      const handles = el.closest('.anun-rows')?.querySelectorAll<HTMLElement>('.anun-grab');
      handles?.[to]?.focus();
    }, 0);
  };

  // -- delete ----------------------------------------------------------------

  const [target, setTarget] = React.useState<Anunt | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [delError, setDelError] = React.useState<string | null>(null);

  const closeConfirm = React.useCallback(() => {
    if (deleting) return;
    setTarget(null);
    setDelError(null);
  }, [deleting]);

  const confirmDelete = async () => {
    if (!target) return;
    setDeleting(true);
    setDelError(null);
    try {
      await del(`${ANUNT_API}/${target.documentId}`);
      setRows((rs) => rs.filter((r) => r.documentId !== target.documentId));
      setTarget(null);
    } catch (err) {
      setDelError(anuntErrorMessage(err, 'Ștergerea a eșuat.'));
    } finally {
      setDeleting(false);
    }
  };

  // -- render ----------------------------------------------------------------

  const umamiNote =
    umami === 'not_configured'
      ? 'Umami nu este configurat, așa că nu avem de unde citi cifrele. Coloana de statistici arată „—", nu zero — anunțurile pot fi văzute și apăsate fără ca noi să știm.'
      : umami === 'error'
        ? 'Nu am putut citi statisticile din Umami. Coloana arată „—" până când conexiunea revine; restul paginii funcționează normal.'
        : null;

  return (
    <AdminPage>
      <style>{ANUN_CSS}</style>

      <Window>
        <PageHeader
          title="Anunțuri"
          subtitle="Un singur anunț e vizibil pe site — primul din lista de mai jos. Apasă un rând pentru a edita."
          actions={<Button onClick={() => navigate(ANUNT_EDIT_TO)}>+ Anunț nou</Button>}
        />

        {loading ? (
          <Loading />
        ) : error ? (
          <EmptyState>Nu am putut încărca anunțurile.</EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState>Niciun anunț încă. Apasă „+ Anunț nou" ca să creezi primul.</EmptyState>
        ) : (
          <>
            {umamiNote && <Notice tone="info">{umamiNote}</Notice>}

            <div className="anun-grp">
              <div className="anun-grp-h">
                <span className="anun-t">Active acum</span>
                <span className="anun-n">{active.length}</span>
              </div>
              {active.length === 0 ? (
                <div className="anun-rows">
                  <div className="anun-none">Niciun anunț activ în acest moment.</div>
                </div>
              ) : (
                <div className="anun-rows">
                  {active.map((a, i) => (
                    <AnuntRow
                      key={a.documentId}
                      a={a}
                      rank={i + 1}
                      isLive={a.documentId === liveId}
                      draggable={handleIdx === i && !reordering}
                      dragging={dragIdx === i}
                      over={overIdx === i && dragIdx !== null && dragIdx !== i}
                      onOpen={() => openEdit(a.documentId)}
                      onDelete={() => {
                        setDelError(null);
                        setTarget(a);
                      }}
                      onGrabDown={() => setHandleIdx(i)}
                      onGrabUp={() => setHandleIdx(null)}
                      onGrabKey={onGrabKey(i)}
                      onDragStart={(e) => {
                        setDragIdx(i);
                        e.dataTransfer.effectAllowed = 'move';
                        // Firefox refuses to start a drag without payload.
                        e.dataTransfer.setData('text/plain', String(i));
                      }}
                      onDragOver={(e) => {
                        if (dragIdx === null) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (overIdx !== i) setOverIdx(i);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const from = dragIdx;
                        resetDrag();
                        if (from !== null) void moveActive(from, i);
                      }}
                      onDragEnd={resetDrag}
                    />
                  ))}
                </div>
              )}
            </div>

            {scheduled.length > 0 && (
              <div className="anun-grp">
                <div className="anun-grp-h">
                  <span className="anun-t">Programate</span>
                  <span className="anun-n">{scheduled.length}</span>
                </div>
                <div className="anun-rows">
                  {scheduled.map((a) => (
                    <AnuntRow
                      key={a.documentId}
                      a={a}
                      rank={null}
                      isLive={false}
                      draggable={false}
                      dragging={false}
                      over={false}
                      onOpen={() => openEdit(a.documentId)}
                      onDelete={() => {
                        setDelError(null);
                        setTarget(a);
                      }}
                      onGrabDown={() => {}}
                      onGrabUp={() => {}}
                      onGrabKey={() => {}}
                      onDragStart={() => {}}
                      onDragOver={() => {}}
                      onDrop={() => {}}
                      onDragEnd={() => {}}
                    />
                  ))}
                </div>
              </div>
            )}

            {past.length > 0 && (
              <div className="anun-grp">
                <div className="anun-grp-h">
                  <span className="anun-t">Încheiate</span>
                  <span className="anun-n">{past.length}</span>
                </div>
                <div className="anun-rows">
                  {past.map((a) => (
                    <AnuntRow
                      key={a.documentId}
                      a={a}
                      rank={null}
                      isLive={false}
                      draggable={false}
                      dragging={false}
                      over={false}
                      onOpen={() => openEdit(a.documentId)}
                      onDelete={() => {
                        setDelError(null);
                        setTarget(a);
                      }}
                      onGrabDown={() => {}}
                      onGrabUp={() => {}}
                      onGrabKey={() => {}}
                      onDragStart={() => {}}
                      onDragOver={() => {}}
                      onDrop={() => {}}
                      onDragEnd={() => {}}
                    />
                  ))}
                </div>
              </div>
            )}

            <p className="ui-muted" style={{ marginTop: 14, fontSize: 12 }}>
              {rows.length} {rows.length === 1 ? 'anunț' : 'anunțuri'} · {active.length} active ·{' '}
              {scheduled.length} programate · {past.length} încheiate
            </p>
          </>
        )}
      </Window>

      {/* Screen-reader feedback for keyboard reordering. */}
      <div
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
      >
        {status}
      </div>

      <ConfirmDialog
        open={target !== null}
        title="Ștergi anunțul?"
        message={`„${target?.title ?? ''}" se șterge definitiv. Acțiunea nu poate fi anulată.`}
        detail="Dacă vrei doar să nu mai apară pe site, treci-l pe Inactiv din editor — rămâne în listă cu statisticile lui."
        busy={deleting}
        error={delError}
        onCancel={closeConfirm}
        onConfirm={confirmDelete}
      />
    </AdminPage>
  );
}
