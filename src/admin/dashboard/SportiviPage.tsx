import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { yearOf } from './edusportUi';
import { SPORTIV_EDIT_TO } from './menu';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  AdminPage,
  Window,
  PageHeader,
  Button,
  StatusBadge,
  Select,
  DataTable,
  type DataColumn,
} from '../ui';

/**
 * EduSport admin — "Sportivi" list page (custom, replaces the default
 * content-manager collection view for api::sportsperson.sportsperson).
 *
 * Reads via the admin content-manager collection API. That list endpoint returns
 * relations as { count } only, so discipline / coach names are resolved per row
 * through the content-manager relations endpoint. Row click opens the custom
 * edit page (?id=<documentId>); "+ Adaugă sportiv" opens it in new mode.
 */

const CT = '/content-manager/collection-types/api::sportsperson.sportsperson';
const REL = (docId: string, field: string) =>
  `/content-manager/relations/api::sportsperson.sportsperson/${docId}/${field}`;

interface RelItem {
  id: number;
  documentId: string;
  name: string;
}
interface Row {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  activeSince: string | null;
  showPublicPage: boolean;
  photoUrl: string | null;
  disciplines: string[];
  coaches: string[];
}

function relNames(res: any): RelItem[] {
  const r = res?.data?.results ?? res?.data?.data ?? [];
  return Array.isArray(r) ? r : [];
}

/**
 * Copy for the athlete type-to-confirm delete dialog. Shared by this list page
 * and the custom edit page (SportivEditPage imports it from here) so both entry
 * points ask for exactly the same confirmation. The dialog itself is the
 * generic `ConfirmDialog` in `src/admin/ConfirmDialog.tsx`.
 */
export const SPORTIV_DELETE_COPY = {
  title: 'Ștergi sportivul?',
  message: (name: string) =>
    `„${name}" se șterge definitiv, împreună cu profilul, rezultatele și sezoanele. Acțiunea nu poate fi anulată.`,
} as const;

const SPORTIVI_CSS = `
.adm-root .sp-thumb{width:32px;height:32px;border-radius:var(--adm-radius-sm);background:var(--adm-surface-sunken) center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:var(--adm-text-muted);font-weight:700;font-size:13px}
.adm-root .sp-rel{color:var(--adm-text-secondary)}
.adm-root .sp-rel.empty{color:var(--adm-text-muted)}
`;

export default function SportiviPage() {
  const { get, del } = useFetchClient();
  const navigate = useNavigate();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const [disciplineFilter, setDisciplineFilter] = React.useState('');
  const [publicFilter, setPublicFilter] = React.useState<'all' | 'public' | 'hidden'>('all');

  React.useEffect(() => {
    let off = false;
    setLoading(true);
    setError(false);
    get(`${CT}?page=1&pageSize=200&sort=name:ASC`)
      .then(async (res: any) => {
        const results: any[] = res?.data?.results ?? [];
        // Resolve relation names per row (list endpoint only returns counts).
        const resolved = await Promise.all(
          results.map(async (sp) => {
            const docId = sp.documentId as string;
            let disciplines: string[] = [];
            let coaches: string[] = [];
            try {
              const [dRes, cRes] = await Promise.all([
                (sp.disciplines?.count ?? 0) > 0 ? get(REL(docId, 'disciplines')) : Promise.resolve(null),
                (sp.coaches?.count ?? 0) > 0 ? get(REL(docId, 'coaches')) : Promise.resolve(null),
              ]);
              if (dRes) disciplines = relNames(dRes).map((x) => x.name).filter(Boolean);
              if (cRes) coaches = relNames(cRes).map((x) => x.name).filter(Boolean);
            } catch {
              /* leave empty on error */
            }
            const photo = sp.photo;
            const photoUrl = photo?.formats?.thumbnail?.url ?? photo?.url ?? null;
            return {
              id: sp.id,
              documentId: docId,
              name: sp.name ?? '',
              slug: sp.slug ?? '',
              activeSince: sp.activeSince ?? null,
              showPublicPage: !!sp.showPublicPage,
              photoUrl,
              disciplines,
              coaches,
            } as Row;
          }),
        );
        if (!off) setRows(resolved);
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
  }, [get]);

  const disciplineOptions = React.useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.disciplines.forEach((d) => set.add(d)));
    return [...set].sort((a, b) => a.localeCompare(b, 'ro'));
  }, [rows]);

  const filtered = React.useMemo(() => {
    return rows.filter((r) => {
      if (disciplineFilter && !r.disciplines.includes(disciplineFilter)) return false;
      if (publicFilter === 'public' && !r.showPublicPage) return false;
      if (publicFilter === 'hidden' && r.showPublicPage) return false;
      return true;
    });
  }, [rows, disciplineFilter, publicFilter]);

  const openEdit = (documentId: string) => navigate(`${SPORTIV_EDIT_TO}?id=${documentId}`);

  // Permanent delete via the content-manager collection API (same base path the
  // list/save calls use); on success the row is dropped from local state.
  const [target, setTarget] = React.useState<Row | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [delError, setDelError] = React.useState<string | null>(null);

  const closeConfirm = React.useCallback(() => {
    if (deleting) return; // never dismiss mid-request
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
    } catch {
      setDelError('Ștergerea a eșuat.');
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataColumn<Row>[] = [
    {
      key: 'photo',
      header: '',
      searchable: false,
      width: '1%',
      render: (r) =>
        r.photoUrl ? (
          <div className="sp-thumb" style={{ backgroundImage: `url(${r.photoUrl})` }} />
        ) : (
          <div className="sp-thumb">{(r.name[0] ?? '?').toUpperCase()}</div>
        ),
    },
    { key: 'name', header: 'Nume', value: (r) => r.name, sortable: true },
    {
      key: 'disciplines',
      header: 'Discipline',
      value: (r) => r.disciplines.join(', '),
      render: (r) => (
        <span className={r.disciplines.length ? 'sp-rel' : 'sp-rel empty'}>
          {r.disciplines.length ? r.disciplines.join(', ') : '—'}
        </span>
      ),
    },
    {
      key: 'coaches',
      header: 'Antrenori',
      value: (r) => r.coaches.join(', '),
      render: (r) => (
        <span className={r.coaches.length ? 'sp-rel' : 'sp-rel empty'}>
          {r.coaches.length ? r.coaches.join(', ') : '—'}
        </span>
      ),
    },
    {
      key: 'activeSince',
      header: 'Activ din',
      value: (r) => yearOf(r.activeSince) || '',
      sortable: true,
      align: 'right',
    },
    {
      key: 'showPublicPage',
      header: 'Public',
      value: (r) => (r.showPublicPage ? 'Da' : 'Nu'),
      sortable: true,
      render: (r) => <StatusBadge tone={r.showPublicPage ? 'ok' : 'neutral'}>{r.showPublicPage ? 'Da' : 'Nu'}</StatusBadge>,
    },
    {
      key: 'actions',
      header: '',
      searchable: false,
      align: 'right',
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setDelError(null);
            setTarget(r);
          }}
          disabled={deleting && target?.documentId === r.documentId}
        >
          {deleting && target?.documentId === r.documentId ? '…' : 'Șterge'}
        </Button>
      ),
    },
  ];

  return (
    <AdminPage>
      <style>{SPORTIVI_CSS}</style>
      <Window>
        <PageHeader
          title="Sportivi"
          subtitle="Profilurile sportivilor clubului. Apasă un rând pentru a edita."
          actions={
            <Button onClick={() => navigate(SPORTIV_EDIT_TO)}>+ Adaugă sportiv</Button>
          }
        />

        <DataTable
          columns={columns}
          rows={filtered}
          getRowKey={(r) => r.documentId}
          onRowClick={(r) => openEdit(r.documentId)}
          rowLabel={(r) => `Editează ${r.name}`}
          loading={loading}
          empty={error ? 'Nu am putut încărca sportivii.' : 'Niciun sportiv pentru filtrul curent.'}
          noMatches="Niciun sportiv pentru filtrul curent."
          search
          searchPlaceholder="Caută după nume..."
          initialSort={{ key: 'name', dir: 'asc' }}
          toolbar={
            <>
              <Select
                aria-label="Filtrează după disciplină"
                value={disciplineFilter}
                onChange={(v) => setDisciplineFilter(v)}
                placeholder="Toate disciplinele"
                options={disciplineOptions.map((d) => ({ value: d, label: d }))}
              />
              <Select
                aria-label="Filtrează după vizibilitate"
                value={publicFilter}
                onChange={(v) => setPublicFilter(v as 'all' | 'public' | 'hidden')}
                options={[
                  { value: 'all', label: 'Public și ascuns' },
                  { value: 'public', label: 'Doar public' },
                  { value: 'hidden', label: 'Doar ascuns' },
                ]}
              />
            </>
          }
        />
      </Window>

      <ConfirmDialog
        open={target !== null}
        title={SPORTIV_DELETE_COPY.title}
        message={SPORTIV_DELETE_COPY.message(target?.name ?? '')}
        busy={deleting}
        error={delError}
        onCancel={closeConfirm}
        onConfirm={confirmDelete}
      />
    </AdminPage>
  );
}
