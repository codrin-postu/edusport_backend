import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { EDU_CSS } from './edusportUi';
import { ANUNT_EDIT_TO } from './menu';
import { ConfirmDialog } from '../ConfirmDialog';

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
 * CSS NOTE: every class this page introduces is prefixed `anun-`. `EDU_CSS`
 * already owns generic names (`.sec`, `.row`, `.win`, `.hint`, `.pill`, `.fld`)
 * and the mockup happens to use three of them (`.row`, `.win`, `.hint`) for
 * completely different things. Namespacing is what keeps the two stylesheets
 * from colliding — an unnamespaced clash caused a real bug earlier in this
 * project, so do not drop the prefix when adding rules here.
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
    .replace(/[\u0300-\u036f]/g, '')
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
// Page CSS — every selector namespaced under `.eduf .anun-*`
// ---------------------------------------------------------------------------

const ANUN_CSS = `
.eduf .anun-body{padding:16px 18px}
.eduf .anun-note{font-size:12px;color:var(--muted);background:var(--field);border:1px solid var(--line);border-radius:var(--r);padding:8px 11px;margin:0 0 14px}
.eduf .anun-note b{color:var(--ink)}

.eduf .anun-grp{margin-bottom:20px}
.eduf .anun-grp:last-child{margin-bottom:0}
.eduf .anun-grp-h{display:flex;align-items:center;gap:9px;margin:0 0 8px}
.eduf .anun-grp-h .anun-t{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
.eduf .anun-grp-h .anun-n{font-size:11px;font-weight:700;color:#8a8d99;font-variant-numeric:tabular-nums}

.eduf .anun-rows{background:#fff;border:1px solid var(--border);border-radius:5px;overflow:hidden}
.eduf .anun-none{padding:16px 14px;font-size:12.5px;color:var(--muted)}

.eduf .anun-row{display:flex;align-items:center;gap:13px;padding:11px 14px;border-bottom:1px solid #f0f1f4;font-size:13px;cursor:pointer}
.eduf .anun-row:last-child{border-bottom:none}
.eduf .anun-row:hover{background:#fafbff}
.eduf .anun-row.is-live{background:#f7f9ff}
.eduf .anun-row.is-live:hover{background:#f1f5ff}
/* Active but held back by the row above: warm tint + a red left edge, so "not on
   the site right now" reads without counting positions. */
.eduf .anun-row.is-waiting{background:#fdf6f5;box-shadow:inset 3px 0 0 rgba(190,51,48,.55)}
.eduf .anun-row.is-waiting:hover{background:#fbeeec}
.eduf .anun-row.is-paused .anun-nm,.eduf .anun-row.is-paused .anun-win{opacity:.55}
.eduf .anun-row.is-past{color:#6a6e7a}
.eduf .anun-row.is-dragging{opacity:.4}
.eduf .anun-row.is-over{box-shadow:inset 0 2px 0 var(--accent)}

.eduf .anun-grab{border:none;background:none;padding:0 2px;color:#c3c6d0;font-size:13px;letter-spacing:-2px;cursor:grab;line-height:1;flex-shrink:0}
.eduf .anun-grab:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:2px;color:var(--accent)}
.eduf .anun-grab:active{cursor:grabbing}
.eduf .anun-grab:disabled{cursor:default}

.eduf .anun-pri{width:19px;height:19px;border-radius:4px;background:var(--accent);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-variant-numeric:tabular-nums}

.eduf .anun-nm{font-weight:650;flex:1;min-width:0}
.eduf .anun-nm .anun-sub{display:block;font-weight:400;font-size:11.5px;color:#8a8d99;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eduf .anun-win{font-size:11.5px;color:var(--muted);white-space:nowrap;font-variant-numeric:tabular-nums}
.eduf .anun-stat{font-size:11.5px;color:#4a4d5a;white-space:nowrap;font-variant-numeric:tabular-nums;min-width:118px;text-align:right}
.eduf .anun-stat b{font-weight:700}

.eduf .anun-chip{font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:3px;white-space:nowrap;flex-shrink:0}
.eduf .anun-chip.is-pause{color:#8a5a00;background:#fbf1df}
.eduf .anun-chip.is-wait{color:#be3330;background:#faeceb}
.eduf .anun-chip.is-soon{color:#2138b8;background:#eef1fb}
.eduf .anun-chip.is-done{color:#5a5e6b;background:#eef0f3}
.eduf .anun-chip.is-fmt{color:#7a1fa2;background:#f5e9f9}

.eduf .anun-del{border:none;background:none;cursor:pointer;color:var(--danger);font-weight:600;font-size:12px;padding:0 2px;flex-shrink:0}
.eduf .anun-del:disabled{opacity:.5;cursor:default}

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
      {paused && <span className="anun-chip is-pause">inactiv</span>}
      {waiting && !paused && <span className="anun-chip is-wait">în așteptare</span>}
      {a.group === 'scheduled' && <span className="anun-chip is-soon">din {dayMonth(a.startAt)}</span>}
      {a.group === 'past' && <span className="anun-chip is-done">încheiat</span>}
      <span className="anun-chip is-fmt">{a.format === 'modal' ? 'modal' : 'card'}</span>

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

      <button
        type="button"
        className="anun-del"
        title="Șterge anunțul"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        Șterge
      </button>
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
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
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
      setMsg(null);
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
        setMsg({ kind: 'err', text: anuntErrorMessage(err, 'Reordonarea a eșuat. Ordinea a fost restaurată.') });
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
    <div className="eduf">
      <style>{EDU_CSS}</style>
      <style>{ANUN_CSS}</style>

      <div className="win">
        <div className="hd">
          <div>
            <h1>Anunțuri</h1>
            <p>Un singur anunț e vizibil pe site — primul din lista de mai jos. Apasă un rând pentru a edita.</p>
          </div>
          <div className="hd-right">
            <button className="btn pri" type="button" onClick={() => navigate(ANUNT_EDIT_TO)}>
              + Anunț nou
            </button>
          </div>
        </div>

        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

        {loading ? (
          <div className="empty">Se încarcă...</div>
        ) : error ? (
          <div className="empty">Nu am putut încărca anunțurile.</div>
        ) : rows.length === 0 ? (
          <div className="empty">Niciun anunț încă. Apasă „+ Anunț nou" ca să creezi primul.</div>
        ) : (
          <div className="anun-body">
            {umamiNote && <p className="anun-note">{umamiNote}</p>}

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
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="foot">
            {rows.length} {rows.length === 1 ? 'anunț' : 'anunțuri'} · {active.length} active ·{' '}
            {scheduled.length} programate · {past.length} încheiate
          </div>
        )}
      </div>

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
    </div>
  );
}
