import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { EDU_CSS } from './edusportUi';
import { ConfirmDialog } from '../ConfirmDialog';

/**
 * EduSport admin — "Membri echipă" page (custom, replaces the default
 * content-manager collection view for api::team-member.team-member).
 *
 * The content type is small (name, role, bio, photo, groups, order), so the
 * page is a card grid with create / edit running in a modal, the same shape
 * SponsoriPage uses. Everything talks to the admin content-manager collection
 * API, the same base path SportiviPage and CompetitiiPage use.
 *
 * Order matters on the public site: the frontend fetches members with
 * `sort=order:asc` (edusport_frontend/src/app/despre-noi/echipa/page.tsx), so
 * cards are dragged into place and the affected rows are renumbered 1..n.
 *
 * `groups` is a free-form json array of strings rendered on the site under
 * "Predă la". Rather than hardcoding a list, the editor suggests the series
 * defined in Program (scheduleGroups[].courses) plus every value already used
 * by another member, and still accepts a typed-in category.
 */

const CT = '/content-manager/collection-types/api::team-member.team-member';
const PROGRAM_CT = '/content-manager/single-types/api::program.program';

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
  role: string;
  bio: string;
  groups: string[];
  order: number | null;
  photo: FileRef | null;
}

interface Draft {
  documentId: string | null;
  name: string;
  role: string;
  bio: string;
  groups: string[];
  order: number | null;
  photo: FileRef | null;
}

const fileOf = (f: any): FileRef | null =>
  f && typeof f.id === 'number'
    ? { id: f.id, url: f.url ?? '', thumb: f.formats?.thumbnail?.url ?? f.url ?? null }
    : null;

/** Body shape the content-manager API expects for a team member. */
const bodyOf = (d: {
  name: string;
  role: string;
  bio: string;
  groups: string[];
  order: number | null;
  photo: FileRef | null;
}) => ({
  name: d.name.trim(),
  role: d.role.trim() || null,
  bio: d.bio.trim() || null,
  groups: d.groups,
  order: d.order,
  photo: d.photo ? d.photo.id : null,
});

/** `order` first (empty values last), then name, so the grid mirrors the site. */
function byOrder(a: Row, b: Row): number {
  const ao = a.order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.name.localeCompare(b.name, 'ro');
}

/** Trim, drop empties, and de-duplicate case-insensitively, keeping first spelling. */
function cleanGroups(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  list.forEach((g) => {
    const v = typeof g === 'string' ? g.trim() : '';
    if (!v) return;
    const key = v.toLocaleLowerCase('ro');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(v);
  });
  return out;
}

/**
 * Course names defined on the Program single type. Shape is
 * `scheduleGroups: [{ timeSlot, courses: string[] }]`, see
 * src/plugins/component-preview/admin/src/ScheduleGroupsEditor.tsx.
 */
function coursesOf(entry: any): string[] {
  const groups = Array.isArray(entry?.scheduleGroups) ? entry.scheduleGroups : [];
  return cleanGroups(groups.flatMap((g: any) => (Array.isArray(g?.courses) ? g.courses : [])));
}

// ---- media picker modal -----------------------------------------------------
/**
 * Image picker over the media library, with an inline upload so a new portrait
 * can be added without leaving the page. Mirrors the picker in SponsoriPage.
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
          <b style={{ fontSize: 14 }}>Alege o fotografie</b>
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
            {uploading ? 'Se încarcă...' : 'Încarcă'}
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
                    onClick={() =>
                      onPick({ id: f.id, url: f.url, thumb: f.formats?.thumbnail?.url ?? f.url })
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
                        background: '#f6f6f9 center/cover no-repeat',
                        backgroundImage: `url(${thumb})`,
                        borderRadius: 3,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 11,
                        color: '#32324d',
                        marginTop: 4,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
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

// ---- teaching categories picker --------------------------------------------
/**
 * "Predă la" editor. Selected values are removable chips; below them sit two
 * suggestion rows (series defined in Program, then values other members
 * already use) plus a free-text input for anything new. Suggestions are only
 * a shortcut: the stored value stays a plain string array.
 */
function GroupPicker({
  value,
  fromProgram,
  fromMembers,
  onChange,
}: {
  value: string[];
  fromProgram: string[];
  fromMembers: string[];
  onChange: (next: string[]) => void;
}) {
  const [text, setText] = React.useState('');

  const has = React.useCallback(
    (g: string) => value.some((v) => v.toLocaleLowerCase('ro') === g.toLocaleLowerCase('ro')),
    [value],
  );

  const add = (g: string) => {
    const v = g.trim();
    if (!v || has(v)) return;
    onChange([...value, v]);
  };
  const remove = (g: string) => onChange(value.filter((v) => v !== g));

  const programSuggestions = fromProgram.filter((g) => !has(g));
  // Values other members use, minus anything already offered by Program.
  const memberSuggestions = fromMembers.filter(
    (g) => !has(g) && !fromProgram.some((p) => p.toLocaleLowerCase('ro') === g.toLocaleLowerCase('ro')),
  );

  const suggestionRow = (label: string, items: string[]) =>
    items.length === 0 ? null : (
      <>
        <div className="mem-sublabel">{label}</div>
        <div className="mem-chiprow">
          {items.map((g) => (
            <button key={g} type="button" className="mem-chip" onClick={() => add(g)}>
              + {g}
            </button>
          ))}
        </div>
      </>
    );

  return (
    <div className="mem-groups">
      <div className="mem-sublabel">Selectate</div>
      {value.length === 0 ? (
        <div className="hint">Nicio categorie aleasă. Membrul apare pe site fără lista „Predă la".</div>
      ) : (
        <div className="mem-chiprow">
          {value.map((g) => (
            <span key={g} className="mem-chip on">
              {g}
              <button type="button" className="x" aria-label={`Elimină ${g}`} onClick={() => remove(g)}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {suggestionRow('Din Program', programSuggestions)}
      {suggestionRow('Folosite de alți membri', memberSuggestions)}

      <div className="mem-sublabel">Altceva</div>
      <div className="mem-addrow">
        <input
          value={text}
          placeholder="Scrie o categorie nouă și apasă Enter"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            add(text);
            setText('');
          }}
        />
        <button
          type="button"
          className="btn sm"
          disabled={!text.trim()}
          onClick={() => {
            add(text);
            setText('');
          }}
        >
          Adaugă
        </button>
      </div>
    </div>
  );
}

// ---- member editor modal ----------------------------------------------------
function MemberEditor({
  draft,
  saving,
  error,
  fromProgram,
  fromMembers,
  onChange,
  onCancel,
  onSave,
  onDelete,
}: {
  draft: Draft;
  saving: boolean;
  error: string | null;
  fromProgram: string[];
  fromMembers: string[];
  onChange: (patch: Partial<Draft>) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
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
          width: 560,
          maxWidth: '100%',
          maxHeight: '88vh',
          overflowY: 'auto',
          background: '#fff',
          border: '1px solid #dcdcdc',
          borderRadius: 6,
        }}
      >
        <div style={{ padding: '13px 15px', borderBottom: '1px solid #e0e2e8' }}>
          <b style={{ fontSize: 14 }}>{isNew ? 'Membru nou' : 'Editează membrul'}</b>
        </div>

        <div style={{ padding: '14px 15px', display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14 }}>
          <div className="photo mem-photo">
            <div
              className="pv"
              style={{
                backgroundImage: draft.photo ? `url(${draft.photo.thumb ?? draft.photo.url})` : undefined,
              }}
            >
              {!draft.photo && 'fără poză'}
            </div>
            <div className="acts">
              <button className="btn sm" type="button" onClick={() => setPickerOpen(true)}>
                {draft.photo ? 'Schimbă' : 'Alege'}
              </button>
              {draft.photo && (
                <button className="btn sm danger" type="button" onClick={() => onChange({ photo: null })}>
                  Elimină
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="fld">
              <label>Nume</label>
              <input
                value={draft.name}
                placeholder="ex: Ana Maria Popescu"
                onChange={(e) => onChange({ name: e.target.value })}
              />
            </div>
            <div className="fld">
              <label>Rol</label>
              <input
                value={draft.role}
                placeholder="ex: Antrenor principal"
                onChange={(e) => onChange({ role: e.target.value })}
              />
            </div>
            <div className="fld">
              <label>Descriere</label>
              <textarea
                rows={4}
                value={draft.bio}
                placeholder="Câteva rânduri despre experiența antrenorului"
                onChange={(e) => onChange({ bio: e.target.value })}
              />
              <div className="hint">Apare sub nume, pe cardul din pagina Echipa.</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 15px 14px' }}>
          <div className="fld">
            <label>Predă la</label>
            <GroupPicker
              value={draft.groups}
              fromProgram={fromProgram}
              fromMembers={fromMembers}
              onChange={(next) => onChange({ groups: next })}
            />
          </div>
          {error && <div className="msg err" style={{ margin: '12px 0 0' }}>{error}</div>}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            padding: '12px 15px',
            borderTop: '1px solid #e0e2e8',
            background: '#fcfcfd',
          }}
        >
          {!isNew && (
            <button className="btn sm danger" type="button" disabled={saving} onClick={onDelete}>
              Șterge
            </button>
          )}
          <div style={{ flex: 1 }} />
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
          onChange({ photo: f });
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

// ---- page-local styles ------------------------------------------------------
/**
 * Card grid, drag states and the category chips. Kept here rather than in
 * edusportUi so the shared sheet stays generic; class names are prefixed
 * `mem-` to avoid colliding with it.
 */
const PAGE_CSS = `
.eduf .mem-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;padding:16px 18px}
.eduf .mem-card{position:relative;border:1px solid var(--border);border-radius:6px;background:#fff;padding:10px;text-align:left;font-family:inherit;cursor:pointer}
.eduf .mem-card:hover{border-color:#b6bac4;background:#fafbff}
.eduf .mem-card.can-drag{cursor:grab}
.eduf .mem-card.is-dragging{opacity:.45}
.eduf .mem-card.is-over{border-color:var(--accent);box-shadow:0 0 0 2px rgba(33,56,184,.15)}
.eduf .mem-card .pv{width:100%;aspect-ratio:4/3;border-radius:var(--r);background:#eef1f8 center/cover no-repeat;border:1px solid var(--fieldborder);display:flex;align-items:center;justify-content:center;color:#9aa0ad;font-size:20px;font-weight:700}
.eduf .mem-card .nm{display:block;font-size:13.5px;font-weight:700;margin-top:8px}
.eduf .mem-card .rl{display:block;font-size:12px;color:var(--muted);margin-top:1px}
.eduf .mem-card .grab{position:absolute;top:16px;left:16px;width:22px;height:22px;border-radius:var(--r);border:1px solid var(--fieldborder);background:rgba(255,255,255,.92);color:var(--muted);font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center}
.eduf .mem-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}
.eduf .mem-tags .t{font-size:11px;color:var(--accent);background:var(--accent-soft);border:1px solid #cdd6f6;border-radius:var(--r);padding:2px 6px}
.eduf .mem-tags .t.none{color:var(--muted);background:var(--field);border-color:var(--line)}
.eduf .mem-photo .acts{flex-direction:column;gap:6px}
.eduf .mem-photo .acts .btn{width:100%}
.eduf .mem-groups{border:1px solid var(--fieldborder);border-radius:var(--r);background:#fff;padding:10px}
.eduf .mem-sublabel{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:10px}
.eduf .mem-sublabel:first-child{margin-top:0}
.eduf .mem-chiprow{display:flex;flex-wrap:wrap;gap:6px;margin-top:5px}
.eduf .mem-chip{display:inline-flex;align-items:center;gap:6px;font-family:inherit;font-size:12px;font-weight:600;color:var(--ink);background:#fff;border:1px solid var(--fieldborder);border-radius:var(--r);padding:5px 9px;cursor:pointer}
.eduf .mem-chip:hover{border-color:#b6bac4;background:#fafbff}
.eduf .mem-chip.on{background:var(--accent);border-color:var(--accent);color:#fff;cursor:default}
.eduf .mem-chip .x{cursor:pointer;border:none;background:none;color:inherit;font-size:11px;padding:0;line-height:1;opacity:.75}
.eduf .mem-chip .x:hover{opacity:1}
.eduf .mem-addrow{display:flex;gap:8px;margin-top:5px}
.eduf .mem-addrow input{flex:1}
`;

// ---- page -------------------------------------------------------------------
export default function MembriEchipaPage() {
  const { get, post, put, del } = useFetchClient();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [groupFilter, setGroupFilter] = React.useState('');
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [programGroups, setProgramGroups] = React.useState<string[]>([]);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(false);
    return get(`${CT}?page=1&pageSize=200&sort=order:ASC`)
      .then((res: any) => {
        const results: any[] = res?.data?.results ?? [];
        setRows(
          results
            .map(
              (m): Row => ({
                id: m.id,
                documentId: m.documentId,
                name: m.name ?? '',
                role: m.role ?? '',
                bio: m.bio ?? '',
                groups: cleanGroups(m.groups),
                order: typeof m.order === 'number' ? m.order : null,
                photo: fileOf(m.photo),
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

  // Category suggestions from the Program single type. A failure here only
  // costs suggestions, so the page carries on with the member-derived list.
  React.useEffect(() => {
    let off = false;
    get(PROGRAM_CT)
      .then((res: any) => {
        if (off) return;
        setProgramGroups(coursesOf(res?.data?.data ?? res?.data ?? {}));
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [get]);

  /** Every category already stored on a member, sorted the Romanian way. */
  const memberGroups = React.useMemo(() => {
    const all = cleanGroups(rows.flatMap((r) => r.groups));
    return all.sort((a, b) => a.localeCompare(b, 'ro'));
  }, [rows]);

  const filterOptions = React.useMemo(() => {
    const merged = cleanGroups([...programGroups, ...memberGroups]);
    return merged.sort((a, b) => a.localeCompare(b, 'ro'));
  }, [programGroups, memberGroups]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.role.toLowerCase().includes(q)) return false;
      if (groupFilter && !r.groups.includes(groupFilter)) return false;
      return true;
    });
  }, [rows, search, groupFilter]);

  // ---- create / edit --------------------------------------------------------
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const openNew = () => {
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.order ?? 0), 0);
    setSaveError(null);
    setDraft({
      documentId: null,
      name: '',
      role: '',
      bio: '',
      groups: [],
      order: maxOrder + 1,
      photo: null,
    });
  };

  const openEdit = (r: Row) => {
    setSaveError(null);
    setDraft({
      documentId: r.documentId,
      name: r.name,
      role: r.role,
      bio: r.bio,
      groups: r.groups,
      order: r.order,
      photo: r.photo,
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
      setMsg({ kind: 'ok', text: draft.documentId ? 'Membru actualizat.' : 'Membru creat.' });
      await load();
    } catch {
      setSaveError('Salvarea a eșuat. Verifică datele și încearcă din nou.');
    } finally {
      setSaving(false);
    }
  };

  // ---- drag reordering ------------------------------------------------------
  const [reordering, setReordering] = React.useState(false);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);

  // Dragging reorders the full list, so it is only offered while the grid shows
  // every member in site order.
  const sortLocked = search.trim() !== '' || groupFilter !== '';
  const canDrag = !sortLocked && !reordering && rows.length > 1;

  /**
   * Drops `dragId` at the position of `dropId` and renumbers every row whose
   * position changed to 1..n, so the public sort key stays dense. Local state
   * moves first and only the changed rows are written back.
   */
  const dropOn = async (dropId: string) => {
    const sourceId = dragId;
    setDragId(null);
    setOverId(null);
    if (!sourceId || sourceId === dropId || !canDrag) return;

    const from = rows.findIndex((r) => r.documentId === sourceId);
    const to = rows.findIndex((r) => r.documentId === dropId);
    if (from < 0 || to < 0) return;

    const next = rows.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const renumbered = next.map((r, i) => ({ ...r, order: i + 1 }));
    const before = new Map(rows.map((r) => [r.documentId, r.order]));
    const changed = renumbered.filter((r) => before.get(r.documentId) !== r.order);
    if (changed.length === 0) return;

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
      setDraft(null);
      setMsg({ kind: 'ok', text: 'Membrul a fost șters.' });
    } catch {
      setDelError('Ștergerea a eșuat.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    // `pce` opts the modal's "Salvează" button out of the global admin SaveBar tagger.
    <div className="eduf pce">
      <style>{EDU_CSS}</style>
      <style>{PAGE_CSS}</style>
      <div className="win">
        <div className="hd">
          <div>
            <h1>Membri echipă</h1>
            <p>Antrenorii afișați pe pagina Echipa. Apasă un card pentru a edita, trage-l pentru a schimba ordinea.</p>
          </div>
          <div className="hd-right">
            <button className="btn pri" type="button" onClick={openNew}>
              + Adaugă membru
            </button>
          </div>
        </div>

        <div className="tb">
          <div className="search">
            <span aria-hidden="true">⌕</span>
            <input
              placeholder="Caută după nume sau rol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="">Toate categoriile</option>
            {filterOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

        {loading ? (
          <div className="empty">Se încarcă...</div>
        ) : error ? (
          <div className="empty">Nu am putut încărca membrii echipei.</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            {rows.length === 0 ? 'Niciun membru adăugat.' : 'Niciun membru pentru filtrul curent.'}
          </div>
        ) : (
          <div className="mem-grid">
            {filtered.map((r) => {
              const cls = [
                'mem-card',
                canDrag ? 'can-drag' : '',
                dragId === r.documentId ? 'is-dragging' : '',
                overId === r.documentId && dragId !== r.documentId ? 'is-over' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <div
                  key={r.documentId}
                  className={cls}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEdit(r)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openEdit(r);
                    }
                  }}
                  draggable={canDrag}
                  onDragStart={(e) => {
                    if (!canDrag) return;
                    e.dataTransfer.effectAllowed = 'move';
                    // Firefox only starts a drag when data is set.
                    e.dataTransfer.setData('text/plain', r.documentId);
                    setDragId(r.documentId);
                  }}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (overId !== r.documentId) setOverId(r.documentId);
                  }}
                  onDragLeave={() => {
                    if (overId === r.documentId) setOverId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    void dropOn(r.documentId);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                >
                  {canDrag && (
                    <span className="grab" aria-hidden="true" title="Trage ca să schimbi ordinea">
                      ⠿
                    </span>
                  )}
                  <div
                    className="pv"
                    style={{
                      backgroundImage: r.photo ? `url(${r.photo.thumb ?? r.photo.url})` : undefined,
                    }}
                  >
                    {!r.photo && (r.name[0] ?? '?').toUpperCase()}
                  </div>
                  <span className="nm">{r.name || 'Fără nume'}</span>
                  <span className="rl">{r.role || 'fără rol'}</span>
                  <div className="mem-tags">
                    {r.groups.length === 0 ? (
                      <span className="t none">fără categorii</span>
                    ) : (
                      r.groups.map((g) => (
                        <span key={g} className="t">
                          {g}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && (
          <div className="foot">
            {filtered.length} {filtered.length === 1 ? 'membru' : 'membri'}
            {filtered.length !== rows.length ? ` din ${rows.length}` : ''}
            {reordering ? '. Se salvează ordinea...' : ''}
            {sortLocked ? '. Golește căutarea și filtrul pentru a putea reordona.' : ''}
          </div>
        )}
      </div>

      {draft && (
        <MemberEditor
          draft={draft}
          saving={saving}
          error={saveError}
          fromProgram={programGroups}
          fromMembers={memberGroups}
          onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
          onCancel={() => {
            if (!saving) {
              setDraft(null);
              setSaveError(null);
            }
          }}
          onSave={saveDraft}
          onDelete={() => {
            const row = rows.find((r) => r.documentId === draft.documentId);
            if (!row) return;
            setDelError(null);
            setTarget(row);
          }}
        />
      )}

      <ConfirmDialog
        open={target !== null}
        title="Ștergi membrul?"
        message={`„${target?.name ?? ''}" se șterge definitiv și dispare de pe pagina Echipa. Acțiunea nu poate fi anulată.`}
        detail="Fotografia rămâne în biblioteca media."
        busy={deleting}
        error={delError}
        onCancel={closeConfirm}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
