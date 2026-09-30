import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  AdminPage,
  Window,
  PageHeader,
  Button,
  Field,
  Input,
  Textarea,
  Select,
  Chip,
  ChipList,
  Modal,
  ImagePicker,
  type PickedImage,
  EmptyState,
  Loading,
  useSaveState,
  adminToast,
} from '../ui';

/**
 * EduSport admin — "Membri echipă" page (custom, replaces the default
 * content-manager collection view for api::team-member.team-member).
 *
 * The content type is small (name, role, bio, photo, groups, order), so the
 * page is a card grid with create / edit running in a modal, the same shape
 * SponsoriPage uses. Everything talks to the admin content-manager collection
 * API, the same base path SportiviPage and CompetitiiPage use.
 *
 * NOT a DataTable: cards are dragged into place (order is the data, persisted
 * per-row) and the grid carries a photo + wrapping tag list per card, which
 * has no home in a row/column table. This keeps the card grid and only moves
 * page chrome, the editor modal and messaging onto the shared components.
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
            <Button key={g} type="button" variant="secondary" size="sm" onClick={() => add(g)}>
              + {g}
            </Button>
          ))}
        </div>
      </>
    );

  return (
    <div className="mem-groups">
      <div className="mem-sublabel">Selectate</div>
      {value.length === 0 ? (
        <div className="ui-hint">Nicio categorie aleasă. Membrul apare pe site fără lista „Predă la".</div>
      ) : (
        <ChipList className="mem-chiprow">
          {value.map((g) => (
            <Chip key={g} onRemove={() => remove(g)}>
              {g}
            </Chip>
          ))}
        </ChipList>
      )}

      {suggestionRow('Din Program', programSuggestions)}
      {suggestionRow('Folosite de alți membri', memberSuggestions)}

      <div className="mem-sublabel">Altceva</div>
      <div className="mem-addrow">
        <Input
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
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!text.trim()}
          onClick={() => {
            add(text);
            setText('');
          }}
        >
          Adaugă
        </Button>
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
    <Modal
      open
      onClose={onCancel}
      dismissable={!saving}
      title={isNew ? 'Membru nou' : 'Editează membrul'}
      size="md"
      footer={
        <>
          {!isNew && (
            <Button variant="danger" size="sm" disabled={saving} onClick={onDelete}>
              Șterge
            </Button>
          )}
          <div style={{ flex: 1 }} />
          <Button variant="secondary" disabled={saving} onClick={onCancel}>
            Anulează
          </Button>
          <Button disabled={saving} loading={saving} onClick={onSave}>
            {saving ? 'Se salvează...' : 'Salvează'}
          </Button>
        </>
      }
    >
      <div className="mem-editor-grid">
        <div className="mem-photo">
          <div className="mem-photo-pv" style={draft.photo ? { backgroundImage: `url(${draft.photo.thumb ?? draft.photo.url})` } : undefined}>
            {!draft.photo && 'fără poză'}
          </div>
          <div className="mem-photo-acts">
            <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
              {draft.photo ? 'Schimbă' : 'Alege'}
            </Button>
            {draft.photo && (
              <Button variant="danger" size="sm" onClick={() => onChange({ photo: null })}>
                Elimină
              </Button>
            )}
          </div>
        </div>

        <div>
          <Field label="Nume">
            <Input
              value={draft.name}
              placeholder="ex: Ana Maria Popescu"
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </Field>
          <Field label="Rol">
            <Input
              value={draft.role}
              placeholder="ex: Antrenor principal"
              onChange={(e) => onChange({ role: e.target.value })}
            />
          </Field>
          <Field label="Descriere" hint="Apare sub nume, pe cardul din pagina Echipa.">
            <Textarea
              rows={4}
              value={draft.bio}
              placeholder="Câteva rânduri despre experiența antrenorului"
              onChange={(e) => onChange({ bio: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <Field label="Predă la">
        <GroupPicker
          value={draft.groups}
          fromProgram={fromProgram}
          fromMembers={fromMembers}
          onChange={(next) => onChange({ groups: next })}
        />
      </Field>

      {error && (
        <div className="ui-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}

      <ImagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(f: PickedImage) => {
          onChange({ photo: { id: f.id, url: f.url, thumb: f.thumbnailUrl ?? f.url } });
          setPickerOpen(false);
        }}
      />
    </Modal>
  );
}

// ---- page-local styles -------------------------------------------------------
/**
 * Card grid, drag states and the category chips. Kept here rather than in the
 * shared component set because they are specific to this card layout; tokens
 * only (var(--theme-*), var(--ui-*)), classes prefixed `mem-`.
 */
const PAGE_CSS = `
.ui-root .mem-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;padding:16px 18px}
.ui-root .mem-card{position:relative;border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);background:var(--theme-surface);padding:10px;text-align:left;font-family:inherit;cursor:pointer}
.ui-root .mem-card:hover{border-color:var(--theme-primary);background:var(--theme-surface-subtle)}
.ui-root .mem-card.can-drag{cursor:grab}
.ui-root .mem-card.is-dragging{opacity:.45}
.ui-root .mem-card.is-over{border-color:var(--theme-primary);box-shadow:0 0 0 2px var(--theme-primary-soft)}
.ui-root .mem-card .pv{width:100%;aspect-ratio:4/3;border-radius:var(--ui-radius-sm);background:var(--theme-surface-sunken) center/cover no-repeat;border:1px solid var(--theme-border);display:flex;align-items:center;justify-content:center;color:var(--theme-text-muted);font-size:20px;font-weight:700}
.ui-root .mem-card .nm{display:block;font-size:13.5px;font-weight:700;margin-top:8px}
.ui-root .mem-card .rl{display:block;font-size:12px;color:var(--theme-text-muted);margin-top:1px}
.ui-root .mem-card .grab{position:absolute;top:16px;left:16px;width:22px;height:22px;border-radius:var(--ui-radius-sm);border:1px solid var(--theme-border);background:var(--theme-surface);color:var(--theme-text-muted);font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center}
.ui-root .mem-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}
.ui-root .mem-tags .t{font-size:11px;color:var(--theme-primary);background:var(--theme-primary-soft);border:1px solid var(--theme-primary-soft-line);border-radius:var(--ui-radius-sm);padding:2px 6px}
.ui-root .mem-tags .t.none{color:var(--theme-text-muted);background:var(--theme-surface-subtle);border-color:var(--theme-border)}

.ui-root .mem-editor-grid{display:grid;grid-template-columns:120px 1fr;gap:14px;margin-bottom:14px}
.ui-root .mem-photo-pv{width:100%;aspect-ratio:1/1;border-radius:var(--ui-radius-sm);background:var(--theme-surface-sunken) center/cover no-repeat;border:1px solid var(--theme-border-strong);display:flex;align-items:center;justify-content:center;color:var(--theme-text-muted);font-size:11.5px;text-align:center;padding:6px}
.ui-root .mem-photo-acts{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.ui-root .mem-groups{border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);background:var(--theme-surface);padding:10px}
.ui-root .mem-sublabel{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--theme-text-muted);margin-top:10px}
.ui-root .mem-sublabel:first-child{margin-top:0}
.ui-root .mem-chiprow{display:flex;flex-wrap:wrap;gap:6px;margin-top:5px}
.ui-root .mem-addrow{display:flex;gap:8px;margin-top:5px}
.ui-root .mem-addrow .ui-input{flex:1}
`;

// ---- page -------------------------------------------------------------------
export default function MembriEchipaPage() {
  const { get, post, put, del } = useFetchClient();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [groupFilter, setGroupFilter] = React.useState('');
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
  const save = useSaveState();

  const openNew = () => {
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.order ?? 0), 0);
    save.reset();
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
    save.reset();
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
      save.setError('Numele este obligatoriu.');
      return;
    }
    const ok = await save.run(async () => {
      if (draft.documentId) {
        await put(`${CT}/${draft.documentId}`, bodyOf(draft));
      } else {
        await post(CT, bodyOf(draft));
      }
      await load();
    }, 'Salvarea a eșuat. Verifică datele și încearcă din nou.');
    if (ok) setDraft(null);
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
    setRows(renumbered);
    try {
      await Promise.all(changed.map((r) => put(`${CT}/${r.documentId}`, bodyOf(r))));
    } catch {
      adminToast.error('Nu am putut salva ordinea. Lista a fost reîncărcată.');
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
      adminToast.success('Membrul a fost șters.');
    } catch {
      setDelError('Ștergerea a eșuat.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminPage>
      <style>{PAGE_CSS}</style>
      <Window>
        <PageHeader
          title="Membri echipă"
          subtitle="Antrenorii afișați pe pagina Echipa. Apasă un card pentru a edita, trage-l pentru a schimba ordinea."
          actions={<Button onClick={openNew}>+ Adaugă membru</Button>}
        />

        <div className="ui-table-bar">
          <Input
            className="ui-table-search"
            placeholder="Caută după nume sau rol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Caută după nume sau rol"
          />
          <Select
            aria-label="Filtrează după categorie"
            value={groupFilter}
            onChange={(v) => setGroupFilter(v)}
            placeholder="Toate categoriile"
            options={filterOptions.map((g) => ({ value: g, label: g }))}
          />
        </div>

        {loading ? (
          <Loading />
        ) : error ? (
          <EmptyState>Nu am putut încărca membrii echipei.</EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState>{rows.length === 0 ? 'Niciun membru adăugat.' : 'Niciun membru pentru filtrul curent.'}</EmptyState>
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
          <p className="ui-muted" style={{ margin: '0 18px 16px', fontSize: 12 }}>
            {filtered.length} {filtered.length === 1 ? 'membru' : 'membri'}
            {filtered.length !== rows.length ? ` din ${rows.length}` : ''}
            {reordering ? '. Se salvează ordinea...' : ''}
            {sortLocked ? '. Golește căutarea și filtrul pentru a putea reordona.' : ''}
          </p>
        )}
      </Window>

      {draft && (
        <MemberEditor
          draft={draft}
          saving={save.saving}
          error={save.error}
          fromProgram={programGroups}
          fromMembers={memberGroups}
          onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
          onCancel={() => {
            if (!save.saving) {
              setDraft(null);
              save.reset();
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
    </AdminPage>
  );
}
