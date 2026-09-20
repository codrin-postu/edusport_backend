import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { EDU_CSS } from './edusportUi';
import { ConfirmDialog } from '../ConfirmDialog';

/**
 * EduSport admin — "Sponsori" list page (custom, replaces the default
 * content-manager collection view for api::sponsor.sponsor).
 *
 * The content type is tiny (name, logo, href, order), so create and edit run in
 * a modal on this page rather than in a separate edit route. Everything talks to
 * the admin content-manager collection API, the same base path SportiviPage and
 * CompetitiiPage use.
 *
 * Order matters on the public site: the frontend fetches sponsors with
 * `sort=order:asc` (edusport_frontend/src/lib/strapi-partners.ts, fetchSponsors),
 * so the list is sorted by `order` and offers "Sus" / "Jos" reordering that
 * renumbers the affected rows 1..n.
 */

const CT = '/content-manager/collection-types/api::sponsor.sponsor';

interface UploadFile {
  id: number;
  name: string;
  url: string;
  mime: string;
  formats?: { thumbnail?: { url?: string } };
}

interface FileRef {
  id: number;
  url: string;
  thumb: string | null;
}

interface Row {
  id: number;
  documentId: string;
  name: string;
  href: string;
  order: number | null;
  logo: FileRef | null;
}

interface Draft {
  documentId: string | null;
  name: string;
  href: string;
  order: number | null;
  logo: FileRef | null;
}

const fileOf = (f: any): FileRef | null =>
  f && typeof f.id === 'number'
    ? { id: f.id, url: f.url ?? '', thumb: f.formats?.thumbnail?.url ?? f.url ?? null }
    : null;

/** Body shape the content-manager API expects for a sponsor. */
const bodyOf = (d: { name: string; href: string; order: number | null; logo: FileRef | null }) => ({
  name: d.name.trim(),
  href: d.href.trim() || null,
  order: d.order,
  logo: d.logo ? d.logo.id : null,
});

/** `order` first (empty values last), then name, so the list mirrors the site. */
function byOrder(a: Row, b: Row): number {
  const ao = a.order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.name.localeCompare(b.name, 'ro');
}

// ---- media picker modal -----------------------------------------------------
/**
 * Image picker over the media library, with an inline upload so a new logo can
 * be added without leaving the page. Mirrors the picker in NavigationPage.
 */
function MediaModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (f: FileRef) => void;
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
        onPick({
          id: uploaded.id,
          url: uploaded.url ?? '',
          thumb: uploaded.formats?.thumbnail?.url ?? uploaded.url ?? null,
        });
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
          <b style={{ fontSize: 14 }}>Alege un logo</b>
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
                const thumb = f.formats?.thumbnail?.url ?? f.url;
                return (
                  <button
                    key={f.id}
                    type="button"
                    title={f.name}
                    onClick={() =>
                      onPick({ id: f.id, url: f.url, thumb: thumb ?? null })
                    }
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
                        background: '#eef1f8 center/contain no-repeat',
                        backgroundImage: `url(${thumb})`,
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

// ---- create / edit modal ----------------------------------------------------
function SponsorEditor({
  draft,
  saving,
  error,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Draft;
  saving: boolean;
  error: string | null;
  onChange: (patch: Partial<Draft>) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const isNew = draft.documentId === null;

  return (
    <div
      onMouseDown={() => {
        if (!saving) onCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,26,54,.28)',
        zIndex: 250,
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
          width: 520,
          maxWidth: '100%',
          maxHeight: '88vh',
          overflowY: 'auto',
          background: '#fff',
          border: '1px solid #dcdcdc',
          borderRadius: 6,
        }}
      >
        <div style={{ padding: '13px 15px', borderBottom: '1px solid #e0e2e8' }}>
          <b style={{ fontSize: 14 }}>{isNew ? 'Sponsor nou' : 'Editează sponsorul'}</b>
        </div>

        <div style={{ padding: '14px 15px' }}>
          <div className="fld">
            <label>Nume</label>
            <input
              value={draft.name}
              placeholder="ex: Federația Română de Patinaj"
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </div>

          <div className="fld">
            <label>Logo</label>
            <div className="photo">
              {/* Logos are wide and must never be cropped, so the square
                  `.photo .pv` box is overridden to a contained 16/9 preview. */}
              <div
                className="pv"
                style={{
                  width: 180,
                  aspectRatio: '16/9',
                  backgroundSize: 'contain',
                  backgroundImage: draft.logo
                    ? `url(${draft.logo.thumb ?? draft.logo.url})`
                    : undefined,
                }}
              >
                {!draft.logo && 'fără logo'}
              </div>
              <div className="acts">
                <button className="btn sm" type="button" onClick={() => setPickerOpen(true)}>
                  {draft.logo ? 'Schimbă' : 'Alege'}
                </button>
                {draft.logo && (
                  <button
                    className="btn sm danger"
                    type="button"
                    onClick={() => onChange({ logo: null })}
                  >
                    Elimină
                  </button>
                )}
              </div>
            </div>
            <div className="hint">Se afișează în banda de sponsori de pe pagina Parteneri.</div>
          </div>

          <div className="row">
            <div className="fld">
              <label>Link</label>
              <input
                value={draft.href}
                placeholder="ex: https://www.exemplu.ro"
                onChange={(e) => onChange({ href: e.target.value })}
              />
              <div className="hint">Opțional. Lasă gol dacă logo-ul nu trebuie să ducă nicăieri.</div>
            </div>
            <div className="fld">
              <label>Ordine</label>
              <input
                type="number"
                min={1}
                value={draft.order ?? ''}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  onChange({ order: v === '' ? null : Number(v) });
                }}
              />
              <div className="hint">Numărul mai mic apare primul.</div>
            </div>
          </div>

          {error && <div className="msg err">{error}</div>}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            padding: '12px 15px',
            borderTop: '1px solid #e0e2e8',
            background: '#fcfcfd',
          }}
        >
          <button className="btn" type="button" disabled={saving} onClick={onCancel}>
            Anulează
          </button>
          <button className="btn pri" type="button" disabled={saving} onClick={onSave}>
            {saving ? 'Se salvează...' : 'Salvează'}
          </button>
        </div>
      </div>

      <MediaModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(f) => {
          onChange({ logo: f });
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

// ---- page -------------------------------------------------------------------
export default function SponsoriPage() {
  const { get, post, put, del } = useFetchClient();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(false);
    return get(`${CT}?page=1&pageSize=200&sort=order:ASC`)
      .then((res: any) => {
        const results: any[] = res?.data?.results ?? [];
        setRows(
          results
            .map(
              (s): Row => ({
                id: s.id,
                documentId: s.documentId,
                name: s.name ?? '',
                href: s.href ?? '',
                order: typeof s.order === 'number' ? s.order : null,
                logo: fileOf(s.logo),
              }),
            )
            .sort(byOrder),
        );
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [get]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  // ---- create / edit --------------------------------------------------------
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const openNew = () => {
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.order ?? 0), 0);
    setSaveError(null);
    setDraft({ documentId: null, name: '', href: '', order: maxOrder + 1, logo: null });
  };

  const openEdit = (r: Row) => {
    setSaveError(null);
    setDraft({
      documentId: r.documentId,
      name: r.name,
      href: r.href,
      order: r.order,
      logo: r.logo,
    });
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setSaveError('Numele este obligatoriu.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (draft.documentId) {
        await put(`${CT}/${draft.documentId}`, bodyOf(draft));
      } else {
        await post(CT, bodyOf(draft));
      }
      setDraft(null);
      setMsg({ kind: 'ok', text: draft.documentId ? 'Sponsor actualizat.' : 'Sponsor creat.' });
      await load();
    } catch {
      setSaveError('Salvarea a eșuat. Verifică datele și încearcă din nou.');
    } finally {
      setSaving(false);
    }
  };

  // ---- reordering -----------------------------------------------------------
  const [reordering, setReordering] = React.useState(false);

  /**
   * Moves a row one position up or down in the current (order-sorted) list and
   * renumbers every row whose position changed to 1..n, so the public sort key
   * stays dense and predictable.
   */
  const move = async (documentId: string, dir: -1 | 1) => {
    if (reordering || search.trim()) return;
    const from = rows.findIndex((r) => r.documentId === documentId);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= rows.length) return;

    const next = rows.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const renumbered = next.map((r, i) => ({ ...r, order: i + 1 }));
    const before = new Map(rows.map((r) => [r.documentId, r.order]));
    const changed = renumbered.filter((r) => before.get(r.documentId) !== r.order);

    setReordering(true);
    setMsg(null);
    setRows(renumbered);
    try {
      await Promise.all(changed.map((r) => put(`${CT}/${r.documentId}`, bodyOf(r))));
    } catch {
      setMsg({ kind: 'err', text: 'Nu am putut salva ordinea. Lista a fost reîncărcată.' });
      await load();
    } finally {
      setReordering(false);
    }
  };

  // ---- delete ---------------------------------------------------------------
  const [target, setTarget] = React.useState<Row | null>(null);
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
      await del(`${CT}/${target.documentId}`);
      setRows((rs) => rs.filter((r) => r.documentId !== target.documentId));
      setTarget(null);
      setMsg({ kind: 'ok', text: 'Sponsorul a fost șters.' });
    } catch {
      setDelError('Ștergerea a eșuat.');
    } finally {
      setDeleting(false);
    }
  };

  const sortLocked = search.trim() !== '';

  return (
    // `pce` opts the modal's "Salvează" button out of the global admin SaveBar tagger.
    <div className="eduf pce">
      <style>{EDU_CSS}</style>
      <div className="win">
        <div className="hd">
          <div>
            <h1>Sponsori</h1>
            <p>Logo-urile afișate pe pagina Parteneri. Apasă un rând pentru a edita.</p>
          </div>
          <div className="hd-right">
            <button className="btn pri" type="button" onClick={openNew}>
              + Adaugă sponsor
            </button>
          </div>
        </div>

        <div className="tb">
          <div className="search">
            <span aria-hidden="true">⌕</span>
            <input
              placeholder="Caută după nume..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

        {loading ? (
          <div className="empty">Se încarcă...</div>
        ) : error ? (
          <div className="empty">Nu am putut încărca sponsorii.</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            {rows.length === 0 ? 'Niciun sponsor adăugat.' : 'Niciun sponsor pentru căutarea curentă.'}
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 1 }} />
                <th>Nume</th>
                <th>Link</th>
                <th className="num">Ordine</th>
                <th style={{ width: 1 }} />
                <th style={{ width: 1 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const index = rows.findIndex((x) => x.documentId === r.documentId);
                return (
                  <tr key={r.documentId} onClick={() => openEdit(r)}>
                    <td>
                      {r.logo ? (
                        <div
                          className="thumb"
                          style={{
                            backgroundImage: `url(${r.logo.thumb ?? r.logo.url})`,
                            backgroundSize: 'contain',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                          }}
                        />
                      ) : (
                        <div className="thumb ph">{(r.name[0] ?? '?').toUpperCase()}</div>
                      )}
                    </td>
                    <td className="nm">{r.name || 'Fără nume'}</td>
                    <td>
                      <span className={`relnames${r.href ? '' : ' empty'}`}>{r.href || 'fără link'}</span>
                    </td>
                    <td className="num">{r.order ?? 'fără'}</td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      <button
                        className="btn sm"
                        type="button"
                        title="Mută mai sus"
                        disabled={sortLocked || reordering || index <= 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          void move(r.documentId, -1);
                        }}
                      >
                        Sus
                      </button>{' '}
                      <button
                        className="btn sm"
                        type="button"
                        title="Mută mai jos"
                        disabled={sortLocked || reordering || index < 0 || index >= rows.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          void move(r.documentId, 1);
                        }}
                      >
                        Jos
                      </button>
                    </td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        title="Șterge sponsorul"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDelError(null);
                          setTarget(r);
                        }}
                        disabled={deleting && target?.documentId === r.documentId}
                        style={{
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          color: '#be3330',
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        Șterge
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!loading && !error && (
          <div className="foot">
            {filtered.length} {filtered.length === 1 ? 'sponsor' : 'sponsori'}
            {filtered.length !== rows.length ? ` din ${rows.length}` : ''}
            {sortLocked ? '. Golește căutarea pentru a putea reordona.' : ''}
          </div>
        )}
      </div>

      {draft && (
        <SponsorEditor
          draft={draft}
          saving={saving}
          error={saveError}
          onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
          onCancel={() => {
            if (!saving) {
              setDraft(null);
              setSaveError(null);
            }
          }}
          onSave={saveDraft}
        />
      )}

      <ConfirmDialog
        open={target !== null}
        title="Ștergi sponsorul?"
        message={`„${target?.name ?? ''}" se șterge definitiv și dispare din banda de sponsori de pe pagina Parteneri. Acțiunea nu poate fi anulată.`}
        detail="Logo-ul rămâne în biblioteca media."
        busy={deleting}
        error={delError}
        onCancel={closeConfirm}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
