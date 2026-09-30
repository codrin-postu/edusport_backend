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
  Modal,
  ImagePicker,
  type PickedImage,
  DataTable,
  type DataColumn,
  useSaveState,
  adminToast,
} from '../ui';

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
 * renumbers the affected rows 1..n. The move only makes sense against the full,
 * unfiltered order, so the search box here stays a plain local filter (not
 * DataTable's own search box) and reordering is locked while it is non-empty,
 * same as before.
 */

const CT = '/content-manager/collection-types/api::sponsor.sponsor';

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

const SPONSORI_CSS = `
.adm-root .sp-logo{width:32px;height:32px;border-radius:var(--adm-radius-sm);background:var(--adm-surface-sunken) center/contain no-repeat;display:flex;align-items:center;justify-content:center;color:var(--adm-text-muted);font-weight:700;font-size:13px}
.adm-root .sp-href{color:var(--adm-text-secondary)}
.adm-root .sp-href.empty{color:var(--adm-text-muted)}
.adm-root .sp-logo-pv{width:180px;aspect-ratio:16/9;border:1px solid var(--adm-line-strong);border-radius:var(--adm-radius-sm);background:var(--adm-surface-sunken) center/contain no-repeat;display:flex;align-items:center;justify-content:center;color:var(--adm-text-muted);font-size:11.5px}
.adm-root .sp-acts{display:flex;gap:8px;margin-top:8px}
`;

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
    <Modal
      open
      onClose={onCancel}
      dismissable={!saving}
      title={isNew ? 'Sponsor nou' : 'Editează sponsorul'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onCancel}>
            Anulează
          </Button>
          <Button disabled={saving} loading={saving} onClick={onSave}>
            {saving ? 'Se salvează...' : 'Salvează'}
          </Button>
        </>
      }
    >
      <Field label="Nume">
        <Input
          value={draft.name}
          placeholder="ex: Federația Română de Patinaj"
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>

      <Field label="Logo" hint="Se afișează în banda de sponsori de pe pagina Parteneri.">
        <div className="sp-logo-pv" style={draft.logo ? { backgroundImage: `url(${draft.logo.thumb ?? draft.logo.url})` } : undefined}>
          {!draft.logo && 'fără logo'}
        </div>
        <div className="sp-acts">
          <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
            {draft.logo ? 'Schimbă' : 'Alege'}
          </Button>
          {draft.logo && (
            <Button variant="danger" size="sm" onClick={() => onChange({ logo: null })}>
              Elimină
            </Button>
          )}
        </div>
      </Field>

      <div className="adm-grid2">
        <Field label="Link" hint="Opțional. Lasă gol dacă logo-ul nu trebuie să ducă nicăieri.">
          <Input
            value={draft.href}
            placeholder="ex: https://www.exemplu.ro"
            onChange={(e) => onChange({ href: e.target.value })}
          />
        </Field>
        <Field label="Ordine" hint="Numărul mai mic apare primul.">
          <Input
            type="number"
            min={1}
            value={draft.order ?? ''}
            onChange={(e) => {
              const v = e.target.value.trim();
              onChange({ order: v === '' ? null : Number(v) });
            }}
          />
        </Field>
      </div>

      {error && (
        <div className="adm-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}

      <ImagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(f: PickedImage) => {
          onChange({ logo: { id: f.id, url: f.url, thumb: f.thumbnailUrl ?? f.url } });
          setPickerOpen(false);
        }}
      />
    </Modal>
  );
}

// ---- page -------------------------------------------------------------------
export default function SponsoriPage() {
  const { get, post, put, del } = useFetchClient();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [search, setSearch] = React.useState('');

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
  const save = useSaveState();

  const openNew = () => {
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.order ?? 0), 0);
    save.reset();
    setDraft({ documentId: null, name: '', href: '', order: maxOrder + 1, logo: null });
  };

  const openEdit = (r: Row) => {
    save.reset();
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
      adminToast.success('Sponsorul a fost șters.');
    } catch {
      setDelError('Ștergerea a eșuat.');
    } finally {
      setDeleting(false);
    }
  };

  const sortLocked = search.trim() !== '';

  const columns: DataColumn<Row>[] = [
    {
      key: 'logo',
      header: '',
      searchable: false,
      width: '1%',
      render: (r) =>
        r.logo ? (
          <div className="sp-logo" style={{ backgroundImage: `url(${r.logo.thumb ?? r.logo.url})` }} />
        ) : (
          <div className="sp-logo">{(r.name[0] ?? '?').toUpperCase()}</div>
        ),
    },
    { key: 'name', header: 'Nume', value: (r) => r.name || 'Fără nume', sortable: true },
    {
      key: 'href',
      header: 'Link',
      value: (r) => r.href,
      render: (r) => <span className={r.href ? 'sp-href' : 'sp-href empty'}>{r.href || 'fără link'}</span>,
    },
    { key: 'order', header: 'Ordine', value: (r) => r.order ?? 0, align: 'right', render: (r) => <>{r.order ?? 'fără'}</> },
    {
      key: 'move',
      header: '',
      searchable: false,
      align: 'right',
      render: (r) => {
        const index = rows.findIndex((x) => x.documentId === r.documentId);
        return (
          <>
            <Button
              variant="ghost"
              size="sm"
              title="Mută mai sus"
              disabled={sortLocked || reordering || index <= 0}
              onClick={(e) => {
                e.stopPropagation();
                void move(r.documentId, -1);
              }}
            >
              Sus
            </Button>{' '}
            <Button
              variant="ghost"
              size="sm"
              title="Mută mai jos"
              disabled={sortLocked || reordering || index < 0 || index >= rows.length - 1}
              onClick={(e) => {
                e.stopPropagation();
                void move(r.documentId, 1);
              }}
            >
              Jos
            </Button>
          </>
        );
      },
    },
    {
      key: 'delete',
      header: '',
      searchable: false,
      align: 'right',
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          title="Șterge sponsorul"
          onClick={(e) => {
            e.stopPropagation();
            setDelError(null);
            setTarget(r);
          }}
          disabled={deleting && target?.documentId === r.documentId}
        >
          Șterge
        </Button>
      ),
    },
  ];

  return (
    // `pce` opts the modal's "Salvează" button out of the global admin SaveBar tagger.
    <AdminPage>
      <style>{SPONSORI_CSS}</style>
      <Window>
        <PageHeader
          title="Sponsori"
          subtitle="Logo-urile afișate pe pagina Parteneri. Apasă un rând pentru a edita."
          actions={<Button onClick={openNew}>+ Adaugă sponsor</Button>}
        />

        <DataTable
          columns={columns}
          rows={filtered}
          getRowKey={(r) => r.documentId}
          onRowClick={(r) => openEdit(r)}
          rowLabel={(r) => `Editează ${r.name}`}
          loading={loading}
          empty={error ? 'Nu am putut încărca sponsorii.' : rows.length === 0 ? 'Niciun sponsor adăugat.' : 'Niciun sponsor pentru căutarea curentă.'}
          search={false}
          toolbar={
            <>
              <Input
                placeholder="Caută după nume..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Caută după nume"
              />
              {sortLocked && <span className="adm-hint">Golește căutarea pentru a putea reordona.</span>}
            </>
          }
        />
      </Window>

      {draft && (
        <SponsorEditor
          draft={draft}
          saving={save.saving}
          error={save.error}
          onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
          onCancel={() => {
            if (!save.saving) {
              setDraft(null);
              save.reset();
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
    </AdminPage>
  );
}
