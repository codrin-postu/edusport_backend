import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { EDU_CSS } from './edusportUi';
import { DASHBOARD_TO } from './menu';

/**
 * EduSport admin, "Meniu site" page.
 *
 * The menu STRUCTURE stays in the frontend code
 * (edusport_frontend/src/components/blocks/header/navItems.ts). Nothing here
 * renames a section, changes an address, reorders anything, or adds or removes
 * a link. The left column is a read-only picture of the live menu, so the
 * editor can see where a card actually appears; only two fields on the right
 * are editable, and only for the sections that have a promo card.
 *
 * MENU below is a mirror of navItems.ts, kept for display only. If a label or
 * an address changes there, update it here too. The `key` values are the
 * contract between the two files: they match the rows stored on the
 * `navigation` single type. A key that exists here but not in the CMS simply
 * has no card.
 *
 * Data:
 *   GET /api/meniu-site  -> { data: { overrides: [{ key, description, image }] } }
 *   PUT /api/meniu-site     body { key, description, image: <fileId|null> }
 * Both are admin-guarded (global::is-admin). The single type is hidden from the
 * content-manager, so this page is the only way in.
 *
 * Images go through the standard upload plugin: POST /upload for a new file,
 * GET /upload/files to pick one already in the media library.
 */

interface SubLink {
  label: string;
  href: string;
}

interface MenuSection {
  key: string;
  label: string;
  href?: string;
  /** true when the site renders a promo card for this section */
  promo?: boolean;
  dropdown?: SubLink[];
}

const MENU: MenuSection[] = [
  { key: 'acasa', label: 'Acasa', href: '/' },
  {
    key: 'despre-noi',
    label: 'Despre Noi',
    promo: true,
    dropdown: [
      { label: 'Istoric', href: '/despre-noi' },
      { label: 'Echipa', href: '/despre-noi/echipa' },
      { label: 'Sportivi', href: '/despre-noi/sportivi' },
      { label: 'Realizari', href: '/despre-noi/realizari' },
      { label: 'Voluntariat', href: '/voluntariat' },
    ],
  },
  {
    key: 'cursuri',
    label: 'Cursuri',
    promo: true,
    dropdown: [
      { label: 'Scoala de Patinaj - AFI Cotroceni', href: '/cursuri' },
      { label: 'Program Cursuri', href: '/cursuri/program' },
      { label: 'Evenimente si Competitii', href: '/cursuri/evenimente' },
      { label: 'Regulament Cursuri', href: '/cursuri/regulament' },
    ],
  },
  { key: 'noutati', label: 'Noutati', href: '/noutati' },
  { key: 'parteneri', label: 'Parteneri', href: '/parteneri' },
  { key: 'contact', label: 'Contact', href: '/contact' },
];

interface MediaRef {
  id: number;
  url: string;
  name: string | null;
}

interface Override {
  key: string;
  description: string | null;
  image: MediaRef | null;
}

// Page-local styles. Kept free of backticks on purpose: one stray backtick in a
// template literal takes the whole admin panel down to a blank page.
const NAV_CSS = `
.eduf .navtree{padding:12px 10px}
.eduf .navtree .th{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a3a6b2;padding:4px 8px 10px}
.eduf .navrow{display:flex;align-items:center;gap:9px;width:100%;text-align:left;font-family:inherit;font-size:13px;color:var(--ink);background:none;border:none;border-radius:var(--r);padding:8px 10px;cursor:pointer}
.eduf .navrow:hover{background:#f6f7ff}
.eduf .navrow.on{background:var(--accent-soft);color:var(--accent);font-weight:700}
.eduf .navrow .addr{margin-left:auto;font-size:11px;color:var(--muted);font-weight:400;font-variant-numeric:tabular-nums}
.eduf .navrow.on .addr{color:var(--accent)}
.eduf .navrow .card{margin-left:auto;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--accent);background:var(--accent-soft);border:1px solid #cdd6f6;border-radius:var(--r);padding:1px 5px}
.eduf .navsubs{margin:2px 0 8px 22px;border-left:1px solid var(--line);padding-left:10px}
.eduf .navsub{display:flex;align-items:baseline;gap:10px;padding:5px 8px;font-size:12.5px;color:var(--muted)}
.eduf .navsub .addr{margin-left:auto;font-size:11px;color:#a4a9b4}
.eduf .imgrow{display:flex;gap:13px;align-items:flex-start}
.eduf .imgrow .pv{width:148px;height:92px;flex:none;border:1px solid var(--fieldborder);border-radius:var(--r);background:#eef1f8 center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:#9aa0ad;font-size:11.5px;text-align:center;padding:6px}
.eduf .imgrow .acts{display:flex;gap:8px;flex-wrap:wrap}
`;

// ---- media picker + uploader ----------------------------------------------
interface UploadFile {
  id: number;
  name: string;
  url: string;
  mime: string;
  formats?: { thumbnail?: { url?: string } };
}

function MediaModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (f: MediaRef) => void;
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
      if (uploaded && typeof uploaded.id === 'number') {
        onPick({ id: uploaded.id, url: uploaded.url, name: uploaded.name ?? null });
      } else {
        setReload((n) => n + 1);
      }
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
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
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
            <div className="empty">Nu există imagini.</div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))',
                gap: 10,
              }}
            >
              {files.map((f) => {
                const thumb = f.formats?.thumbnail?.url ?? f.url;
                return (
                  <button
                    key={f.id}
                    type="button"
                    title={f.name}
                    onClick={() => onPick({ id: f.id, url: f.url, name: f.name ?? null })}
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
                        background: `#eef1f8 url(${thumb}) center/cover no-repeat`,
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

// ---- page ------------------------------------------------------------------
const NavigationPage: React.FC = () => {
  const navigate = useNavigate();
  const { get, put } = useFetchClient();

  const [overrides, setOverrides] = React.useState<Record<string, Override>>({});
  const [selected, setSelected] = React.useState<string>('despre-noi');
  const [description, setDescription] = React.useState('');
  const [image, setImage] = React.useState<MediaRef | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const section = MENU.find((s) => s.key === selected) ?? MENU[0];
  const stored = overrides[selected] ?? null;
  const editable = Boolean(section?.promo) && stored !== null;

  // Load the saved cards once.
  React.useEffect(() => {
    let off = false;
    (async () => {
      try {
        const r: any = await get('/api/meniu-site');
        if (off) return;
        const rows: Override[] = r?.data?.data?.overrides ?? [];
        const map: Record<string, Override> = {};
        for (const row of rows) if (row?.key) map[row.key] = row;
        setOverrides(map);
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

  // Fill the editor whenever the selection or the loaded data changes.
  React.useEffect(() => {
    const row = overrides[selected] ?? null;
    setDescription(row?.description ?? '');
    setImage(row?.image ?? null);
    setDirty(false);
    setMsg(null);
  }, [selected, overrides]);

  const save = async () => {
    if (!editable) return;
    setSaving(true);
    setMsg(null);
    try {
      const r: any = await put('/api/meniu-site', {
        key: selected,
        description: description.trim() === '' ? null : description,
        image: image ? image.id : null,
      });
      const rows: Override[] = r?.data?.data?.overrides ?? [];
      const map: Record<string, Override> = {};
      for (const row of rows) if (row?.key) map[row.key] = row;
      setOverrides(map);
      setMsg({ kind: 'ok', text: 'Modificările au fost salvate.' });
    } catch {
      setMsg({ kind: 'err', text: 'Nu am putut salva. Încearcă din nou.' });
    } finally {
      setSaving(false);
    }
  };

  // `pce` opts our "Salvează" button out of the global admin SaveBar tagger,
  // which would otherwise clip it to 1x1. See app.tsx.
  return (
    <div className="eduf pce">
      <style>{EDU_CSS}</style>
      <style>{NAV_CSS}</style>
      <div className="win">
        <div className="hd">
          <div>
            <h1>Meniu site</h1>
            <p>Descrierea și imaginea cardurilor din meniul de sus</p>
          </div>
          <div className="hd-right">
            <button className="btn" type="button" onClick={() => navigate(DASHBOARD_TO)}>
              Înapoi
            </button>
          </div>
        </div>

        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

        {loading ? (
          <div className="empty">Se încarcă...</div>
        ) : error ? (
          <div className="empty">Nu am putut încărca meniul.</div>
        ) : (
          <div className="cols">
            {/* LEFT: the live menu, read only */}
            <div className="rail navtree">
              <div className="th">Secțiuni</div>
              {MENU.map((s) => (
                <React.Fragment key={s.key}>
                  <button
                    type="button"
                    className={`navrow${s.key === selected ? ' on' : ''}`}
                    onClick={() => setSelected(s.key)}
                  >
                    {s.label}
                    {s.promo ? (
                      <span className="card">card</span>
                    ) : s.href ? (
                      <span className="addr">{s.href}</span>
                    ) : null}
                  </button>
                  {s.dropdown && (
                    <div className="navsubs">
                      {s.dropdown.map((d) => (
                        <div className="navsub" key={d.href}>
                          <span>{d.label}</span>
                          <span className="addr">{d.href}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </React.Fragment>
              ))}
              <div className="hint" style={{ padding: '10px 8px 0' }}>
                Numele, adresele și ordinea sunt stabilite în codul site-ului și nu se pot schimba
                de aici.
              </div>
            </div>

            {/* RIGHT: the two editable fields, when the section has a card */}
            <div className="body">
              {!editable ? (
                <div className="sec">
                  <div className="sh">{section?.label}</div>
                  <div className="sb">
                    <p style={{ margin: 0, fontSize: 13, color: '#727888' }}>
                      {section?.promo
                        ? 'Secțiunea are un card promo, dar el nu este încă înregistrat în administrare. Cere unui dezvoltator să îl adauge.'
                        : 'Secțiunea nu are card promo, deci nu are nimic de editat. Cardul apare doar la Despre Noi și Cursuri.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="sec">
                  <div className="sh">
                    <span>Card promo: {section?.label}</span>
                  </div>
                  <div className="sb">
                    <div className="fld">
                      <label>Descriere</label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => {
                          setDescription(e.target.value);
                          setDirty(true);
                        }}
                        placeholder="Textul care apare sub titlul cardului."
                      />
                      <div className="hint">
                        Apare în lista care se deschide pe desktop, sub titlul cardului.
                      </div>
                    </div>

                    <div className="fld">
                      <label>Imagine</label>
                      <div className="imgrow">
                        <div
                          className="pv"
                          style={image ? { backgroundImage: `url(${image.url})` } : undefined}
                        >
                          {!image && 'fără imagine'}
                        </div>
                        <div>
                          <div className="acts">
                            <button
                              className="btn sm"
                              type="button"
                              onClick={() => setPickerOpen(true)}
                            >
                              {image ? 'Schimbă' : 'Alege'}
                            </button>
                            {image && (
                              <button
                                className="btn sm danger"
                                type="button"
                                onClick={() => {
                                  setImage(null);
                                  setDirty(true);
                                }}
                              >
                                Elimină
                              </button>
                            )}
                          </div>
                          <div className="hint">Recomandat 640 pe 400 px, sub 300 KB.</div>
                          {image?.name && <div className="hint">{image.name}</div>}
                          {!image && (
                            <div className="hint">
                              Fără imagine, cardul se afișează doar cu titlu și descriere.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="pa">
                    <span className="grow" />
                    <button
                      className="btn pri"
                      type="button"
                      onClick={save}
                      disabled={saving || !dirty}
                    >
                      {saving ? 'Se salvează' : 'Salvează'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <MediaModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(f) => {
          setImage(f);
          setDirty(true);
          setPickerOpen(false);
        }}
      />
    </div>
  );
};

export default NavigationPage;
