import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { EDU_CSS } from './edusportUi';
import { DASHBOARD_TO } from './menu';
import { ConfirmDialog } from '../ConfirmDialog';

/**
 * EduSport admin - custom "Pagina Voluntariat" editor, replacing the stock
 * single-type view for api::volunteer-page.volunteer-page.
 *
 * The page holds very little: five text fields, a handful of "moduri de a
 * ajuta" and a gallery. The generic content-manager view spreads that over
 * several screens because every custom field renders as its own titled block.
 * Here the same data sits on one screen, two columns, no scrolling.
 *
 * Persistence matches the other custom single-type pages (ProgramEditPage):
 * the whole entry is loaded once, kept in `raw`, and spread back on save so
 * any attribute this page does not manage is carried through rather than
 * wiped.
 */

const CT = '/content-manager/single-types/api::volunteer-page.volunteer-page';

interface Content {
  heroTitle: string;
  heroSubtitle: string;
  introEyebrow: string;
  introHeading: string;
  introBody: string;
}

interface HelpWay {
  title: string;
  desc: string;
}

interface GalleryItem {
  id: number;
  url: string;
  thumb: string;
  name: string;
}

interface UploadFile {
  id: number;
  name: string;
  url: string;
  mime: string;
  formats?: { thumbnail?: { url?: string } };
}

const EMPTY_CONTENT: Content = {
  heroTitle: '',
  heroSubtitle: '',
  introEyebrow: '',
  introHeading: '',
  introBody: '',
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const contentOf = (v: unknown): Content => {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    heroTitle: str(o.heroTitle),
    heroSubtitle: str(o.heroSubtitle),
    introEyebrow: str(o.introEyebrow),
    introHeading: str(o.introHeading),
    introBody: str(o.introBody),
  };
};

const helpWaysOf = (v: unknown): HelpWay[] =>
  Array.isArray(v)
    ? v.map((w) => {
        const o = (w ?? {}) as Record<string, unknown>;
        return { title: str(o.title), desc: str(o.desc) };
      })
    : [];

const fileOf = (f: any): GalleryItem | null =>
  f && typeof f.id === 'number'
    ? {
        id: f.id,
        url: str(f.url),
        thumb: str(f.formats?.thumbnail?.url) || str(f.url),
        name: str(f.name),
      }
    : null;

/** "2026-09-04T12:35:09.448Z" -> "4 sep 2026, 12:35" */
function fmtSaved(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

// Compact layout, on top of the shared EDU_CSS tokens. Everything is scoped
// under `.eduf .vp` so no other custom page is affected.
const VP_CSS = `
.eduf .vp{padding:14px 16px}
.eduf .vp .cols2{display:grid;grid-template-columns:1.25fr 1fr;gap:14px;align-items:start}
@media (max-width:980px){.eduf .vp .cols2{grid-template-columns:1fr}}
.eduf .vp .card{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:12px 13px;margin-bottom:12px}
.eduf .vp .card:last-child{margin-bottom:0}
.eduf .vp .card > h4{margin:0 0 9px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);display:flex;align-items:center;justify-content:space-between;gap:8px}
.eduf .vp .card > h4 .lbl{text-transform:none;letter-spacing:0;font-weight:600}
.eduf .vp .fld{margin-bottom:9px}
.eduf .vp .fld:last-child{margin-bottom:0}
.eduf .vp .fld > label{margin-bottom:3px}
.eduf .vp input,.eduf .vp textarea{padding:5px 8px;font-size:12.5px;background:#fff}
.eduf .vp textarea{min-height:58px;line-height:1.5}
.eduf .vp .two{display:grid;grid-template-columns:1fr 1.6fr;gap:9px}
.eduf .vp .two > .fld{margin-bottom:0}

/* one "mod de a ajuta" per row */
.eduf .vp .wrow{display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-top:1px solid #f0f1f4;background:#fff}
.eduf .vp .wrow:first-of-type{border-top:none}
.eduf .vp .wrow.over{border-top:2px solid var(--accent)}
.eduf .vp .wrow.dragging{opacity:.45}
.eduf .vp .wrow .grab{cursor:grab;color:#b8bcc6;font-size:13px;padding:6px 2px 0;line-height:1;border:none;background:none;font-family:inherit}
.eduf .vp .wrow .ff{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.eduf .vp .wrow .ff input{width:100%}
.eduf .vp .wrow .ff input.d{font-size:12px;color:#5a5e6b}
.eduf .vp .wrow .rm{cursor:pointer;border:none;background:none;color:var(--danger);font-size:12px;padding:6px 2px 0;line-height:1}
.eduf .vp .addrow{width:100%;margin-top:9px;padding:6px;font-size:12px;font-weight:600;color:var(--accent);border:1px dashed var(--fieldborder);border-radius:var(--r);background:#fff;cursor:pointer;font-family:inherit}
.eduf .vp .addrow:hover{background:var(--accent-soft)}

/* gallery thumbnails */
.eduf .vp .gal{grid-template-columns:repeat(4,1fr)}
@media (max-width:980px){.eduf .vp .gal{grid-template-columns:repeat(auto-fill,minmax(92px,1fr))}}
.eduf .vp .gal .add{border-style:dashed}
`;

// ---- media picker modal -----------------------------------------------------
/**
 * Image picker over the media library with an inline upload, mirroring the
 * picker in SponsoriPage so the gallery can grow without leaving the page.
 */
function MediaModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (f: GalleryItem) => void;
}) {
  const { get, post } = useFetchClient();
  const [files, setFiles] = React.useState<UploadFile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [q, setQ] = React.useState('');
  const [reload, setReload] = React.useState(0);
  const fileInput = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let off = false;
    setLoading(true);
    const params: Record<string, string | number> = {
      'filters[mime][$contains]': 'image',
      sort: 'updatedAt:desc',
      page: 1,
      pageSize: 60,
    };
    if (q.trim()) params._q = q.trim();
    get('/upload/files', { params })
      .then((res: any) => {
        if (off) return;
        const data = res?.data;
        const list: UploadFile[] = Array.isArray(data) ? data : (data?.results ?? []);
        setFiles(list.filter((f) => f.mime?.startsWith('image/')));
      })
      .catch(() => {})
      .finally(() => {
        if (!off) setLoading(false);
      });
    return () => {
      off = true;
    };
  }, [open, q, get, reload]);

  const upload = async (file: File) => {
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res: any = await post('/upload', fd);
      const uploaded = Array.isArray(res?.data) ? res.data[0] : res?.data;
      const picked = fileOf(uploaded);
      if (picked) onPick(picked);
      else setReload((n) => n + 1);
    } catch {
      setErr('Nu am putut încărca fișierul.');
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;
  return (
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,26,54,.28)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 720,
          maxWidth: '100%',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          border: '1px solid #dcdcdc',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '13px 15px',
            borderBottom: '1px solid #e0e2e8',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <b style={{ fontSize: 14 }}>Alege o imagine</b>
          <input
            placeholder="Caută imagini..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void upload(f);
            }}
          />
          <button
            className="btn sm"
            type="button"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? 'Se încarcă' : 'Încarcă fișier'}
          </button>
          <button className="btn sm" type="button" onClick={onClose}>
            Închide
          </button>
        </div>
        {err && <div className="msg err">{err}</div>}
        <div style={{ padding: 14, overflowY: 'auto' }}>
          {loading ? (
            <div className="empty">Se încarcă...</div>
          ) : files.length === 0 ? (
            <div className="empty">Nu există imagini în bibliotecă.</div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))',
                gap: 10,
              }}
            >
              {files.map((f) => {
                const item = fileOf(f);
                if (!item) return null;
                return (
                  <button
                    key={f.id}
                    type="button"
                    title={f.name}
                    onClick={() => onPick(item)}
                    style={{
                      padding: 5,
                      border: '1px solid #d0d0d0',
                      borderRadius: 4,
                      background: '#fff',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '1/1',
                        borderRadius: 3,
                        background: '#eef1f8 center/cover no-repeat',
                        backgroundImage: `url(${item.thumb})`,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 11,
                        color: '#727888',
                        marginTop: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f.name}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- page -------------------------------------------------------------------
const VoluntariatEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { get, put } = useFetchClient();

  const [raw, setRaw] = React.useState<Record<string, unknown>>({});
  const [content, setContent] = React.useState<Content>(EMPTY_CONTENT);
  const [helpWays, setHelpWays] = React.useState<HelpWay[]>([]);
  const [gallery, setGallery] = React.useState<GalleryItem[]>([]);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  React.useEffect(() => {
    let off = false;
    (async () => {
      try {
        const r: any = await get(CT);
        if (off) return;
        const entry = r?.data?.data ?? r?.data ?? {};
        setRaw(entry);
        setContent(contentOf(entry.content));
        setHelpWays(helpWaysOf(entry.helpWays));
        setGallery(
          (Array.isArray(entry.gallery) ? entry.gallery : [])
            .map(fileOf)
            .filter(Boolean) as GalleryItem[],
        );
        setSavedAt(typeof entry.updatedAt === 'string' ? entry.updatedAt : null);
      } catch {
        if (!off) setError(true);
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => {
      off = true;
    };
  }, [get]);

  const patchContent = (p: Partial<Content>) => {
    setContent((c) => ({ ...c, ...p }));
    setDirty(true);
  };

  const patchWay = (i: number, p: Partial<HelpWay>) => {
    setHelpWays((ws) => ws.map((w, j) => (j === i ? { ...w, ...p } : w)));
    setDirty(true);
  };

  const addWay = () => {
    setHelpWays((ws) => [...ws, { title: '', desc: '' }]);
    setDirty(true);
  };

  // ---- drag reordering ------------------------------------------------------
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  const dropWay = (to: number) => {
    const from = dragIndex;
    setDragIndex(null);
    setOverIndex(null);
    if (from === null || from === to) return;
    setHelpWays((ws) => {
      const next = ws.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDirty(true);
  };

  // ---- destructive actions --------------------------------------------------
  type Pending =
    | { kind: 'way'; index: number; label: string }
    | { kind: 'image'; index: number; label: string };

  const [pending, setPending] = React.useState<Pending | null>(null);

  const confirmRemove = () => {
    if (!pending) return;
    if (pending.kind === 'way') {
      setHelpWays((ws) => ws.filter((_, j) => j !== pending.index));
    } else {
      setGallery((gs) => gs.filter((_, j) => j !== pending.index));
    }
    setPending(null);
    setDirty(true);
  };

  // ---- gallery --------------------------------------------------------------
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const addImage = (f: GalleryItem) => {
    setGallery((gs) => (gs.some((g) => g.id === f.id) ? gs : [...gs, f]));
    setPickerOpen(false);
    setDirty(true);
  };

  // ---- save -----------------------------------------------------------------
  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      // Spread the loaded entry so any attribute this page does not manage is
      // carried through rather than wiped.
      const res: any = await put(CT, {
        ...raw,
        content,
        helpWays,
        gallery: gallery.map((g) => g.id),
      });
      const entry = res?.data?.data ?? res?.data ?? {};
      if (entry && typeof entry === 'object') setRaw(entry);
      if (typeof entry?.updatedAt === 'string') setSavedAt(entry.updatedAt);
      setDirty(false);
      setMsg({ kind: 'ok', text: 'Modificările au fost salvate.' });
    } catch {
      setMsg({ kind: 'err', text: 'Nu am putut salva. Încearcă din nou.' });
    } finally {
      setSaving(false);
    }
  };

  // `pce` keeps our "Salvează" out of the global admin SaveBar sweep in
  // app.tsx, which would otherwise clip it to 1x1.
  return (
    <div className="eduf pce">
      <style>{EDU_CSS}</style>
      <style>{VP_CSS}</style>
      <div className="win">
        <div className="hd">
          <div>
            <h1>Pagina Voluntariat</h1>
            <p>
              {savedAt ? `Ultima salvare ${fmtSaved(savedAt)}` : 'Textele și galeria paginii publice de voluntariat'}
            </p>
          </div>
          <div className="hd-right">
            <button className="btn" type="button" onClick={() => navigate(DASHBOARD_TO)}>
              Înapoi
            </button>
            <button className="btn pri" type="button" onClick={save} disabled={saving || loading}>
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        </div>

        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

        {loading ? (
          <div className="empty">Se încarcă...</div>
        ) : error ? (
          <div className="empty">Nu am putut încărca pagina de voluntariat.</div>
        ) : (
          <div className="vp">
            <div className="cols2">
              {/* ---- left: page text ---- */}
              <div>
                <div className="card">
                  <h4>Banner</h4>
                  <div className="fld">
                    <label>Titlu</label>
                    <input
                      value={content.heroTitle}
                      placeholder="ex: Voluntariat"
                      onChange={(e) => patchContent({ heroTitle: e.target.value })}
                    />
                  </div>
                  <div className="fld">
                    <label>Subtitlu</label>
                    <textarea
                      value={content.heroSubtitle}
                      placeholder="ex: Clubul crește cu oameni care dăruiesc timp."
                      onChange={(e) => patchContent({ heroSubtitle: e.target.value })}
                    />
                  </div>
                </div>

                <div className="card">
                  <h4>Introducere</h4>
                  <div className="two">
                    <div className="fld">
                      <label>Supratitlu</label>
                      <input
                        value={content.introEyebrow}
                        placeholder="ex: De ce voluntariat"
                        onChange={(e) => patchContent({ introEyebrow: e.target.value })}
                      />
                    </div>
                    <div className="fld">
                      <label>Titlu</label>
                      <input
                        value={content.introHeading}
                        placeholder="ex: Timpul tău face diferența"
                        onChange={(e) => patchContent({ introHeading: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="fld" style={{ marginTop: 9 }}>
                    <label>Text</label>
                    <textarea
                      value={content.introBody}
                      placeholder="Un paragraf despre ce înseamnă voluntariatul la club."
                      onChange={(e) => patchContent({ introBody: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* ---- right: help ways + gallery ---- */}
              <div>
                <div className="card">
                  <h4>
                    Moduri de a ajuta
                    <span className="lbl">
                      {helpWays.length} {helpWays.length === 1 ? 'mod' : 'moduri'}
                    </span>
                  </h4>

                  {helpWays.length === 0 && (
                    <div className="hint">Niciun mod de a ajuta. Secțiunea nu apare pe site.</div>
                  )}

                  {helpWays.map((w, i) => (
                    <div
                      key={i}
                      className={`wrow${dragIndex === i ? ' dragging' : ''}${overIndex === i && dragIndex !== i ? ' over' : ''}`}
                      onDragOver={(e) => {
                        if (dragIndex === null) return;
                        e.preventDefault();
                        setOverIndex(i);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        dropWay(i);
                      }}
                    >
                      <button
                        type="button"
                        className="grab"
                        title="Trage pentru a reordona"
                        aria-label="Reordonează"
                        draggable
                        onDragStart={() => setDragIndex(i)}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setOverIndex(null);
                        }}
                      >
                        ::
                      </button>
                      <span className="ff">
                        <input
                          value={w.title}
                          placeholder="Titlu, ex: La competiții"
                          onChange={(e) => patchWay(i, { title: e.target.value })}
                        />
                        <input
                          className="d"
                          value={w.desc}
                          placeholder="Descriere scurtă"
                          onChange={(e) => patchWay(i, { desc: e.target.value })}
                        />
                      </span>
                      <button
                        type="button"
                        className="rm"
                        title="Elimină rândul"
                        aria-label="Elimină rândul"
                        onClick={() =>
                          setPending({
                            kind: 'way',
                            index: i,
                            label: w.title.trim() || 'acest mod de a ajuta',
                          })
                        }
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button type="button" className="addrow" onClick={addWay}>
                    Adaugă un mod de a ajuta
                  </button>
                </div>

                <div className="card">
                  <h4>
                    Galerie
                    <span className="lbl">
                      {gallery.length} {gallery.length === 1 ? 'imagine' : 'imagini'}
                    </span>
                  </h4>
                  <div className="gal">
                    {gallery.map((g, i) => (
                      <div
                        className="gi"
                        key={`${g.id}-${i}`}
                        title={g.name}
                        style={{ backgroundImage: `url(${g.thumb || g.url})` }}
                      >
                        <button
                          type="button"
                          className="x"
                          aria-label="Elimină imaginea"
                          onClick={() =>
                            setPending({ kind: 'image', index: i, label: g.name || 'această imagine' })
                          }
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="add"
                      aria-label="Adaugă imagine"
                      onClick={() => setPickerOpen(true)}
                    >
                      +
                    </button>
                  </div>
                  <div className="hint" style={{ marginTop: 7 }}>
                    {gallery.length === 0
                      ? 'Momentan nu există imagini, iar galeria nu apare pe site.'
                      : 'Imaginile apar în galeria de pe pagina publică, în ordinea de aici.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="pa">
            <button className="btn" type="button" onClick={() => navigate(DASHBOARD_TO)}>
              Înapoi
            </button>
            <div className="grow" />
            {dirty && <span className="lbl">Ai modificări nesalvate</span>}
            <button className="btn pri" type="button" onClick={save} disabled={saving}>
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        )}
      </div>

      <MediaModal open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addImage} />

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === 'image' ? 'Scoți imaginea din galerie?' : 'Ștergi rândul?'}
        message={
          pending?.kind === 'image'
            ? `„${pending?.label}" nu va mai apărea în galeria paginii de voluntariat.`
            : `„${pending?.label}" dispare din lista de moduri de a ajuta.`
        }
        detail={
          pending?.kind === 'image'
            ? 'Fișierul rămâne în biblioteca media. Modificarea se aplică după ce apeși Salvează.'
            : 'Modificarea se aplică după ce apeși Salvează.'
        }
        confirmLabel={pending?.kind === 'image' ? 'Scoate imaginea' : 'Șterge rândul'}
        onCancel={() => setPending(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
};

export default VoluntariatEditPage;
