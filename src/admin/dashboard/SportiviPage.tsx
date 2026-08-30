import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { EDU_CSS, yearOf } from './edusportUi';
import { SPORTIV_EDIT_TO } from './menu';

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

export default function SportiviPage() {
  const { get } = useFetchClient();
  const navigate = useNavigate();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const [search, setSearch] = React.useState('');
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
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (disciplineFilter && !r.disciplines.includes(disciplineFilter)) return false;
      if (publicFilter === 'public' && !r.showPublicPage) return false;
      if (publicFilter === 'hidden' && r.showPublicPage) return false;
      return true;
    });
  }, [rows, search, disciplineFilter, publicFilter]);

  const openEdit = (documentId: string) => navigate(`${SPORTIV_EDIT_TO}?id=${documentId}`);

  return (
    <div className="eduf">
      <style>{EDU_CSS}</style>
      <div className="win">
        <div className="hd">
          <div>
            <h1>Sportivi</h1>
            <p>Profilurile sportivilor clubului. Apasă un rând pentru a edita.</p>
          </div>
          <div className="hd-right">
            <button className="btn pri" type="button" onClick={() => navigate(SPORTIV_EDIT_TO)}>
              + Adaugă sportiv
            </button>
          </div>
        </div>

        <div className="tb">
          <div className="search">
            <span aria-hidden="true">⌕</span>
            <input placeholder="Caută după nume..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={disciplineFilter} onChange={(e) => setDisciplineFilter(e.target.value)}>
            <option value="">Toate disciplinele</option>
            {disciplineOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select value={publicFilter} onChange={(e) => setPublicFilter(e.target.value as any)}>
            <option value="all">Public și ascuns</option>
            <option value="public">Doar public</option>
            <option value="hidden">Doar ascuns</option>
          </select>
        </div>

        {loading ? (
          <div className="empty">Se încarcă...</div>
        ) : error ? (
          <div className="empty">Nu am putut încărca sportivii.</div>
        ) : filtered.length === 0 ? (
          <div className="empty">Niciun sportiv pentru filtrul curent.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 1 }} />
                <th>Nume</th>
                <th>Discipline</th>
                <th>Antrenori</th>
                <th>Activ din</th>
                <th>Public</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.documentId} onClick={() => openEdit(r.documentId)}>
                  <td>
                    {r.photoUrl ? (
                      <div className="thumb" style={{ backgroundImage: `url(${r.photoUrl})` }} />
                    ) : (
                      <div className="thumb ph">{(r.name[0] ?? '?').toUpperCase()}</div>
                    )}
                  </td>
                  <td className="nm">{r.name}</td>
                  <td>
                    <span className={`relnames${r.disciplines.length ? '' : ' empty'}`}>
                      {r.disciplines.length ? r.disciplines.join(', ') : '—'}
                    </span>
                  </td>
                  <td>
                    <span className={`relnames${r.coaches.length ? '' : ' empty'}`}>
                      {r.coaches.length ? r.coaches.join(', ') : '—'}
                    </span>
                  </td>
                  <td className="num">{yearOf(r.activeSince) || '—'}</td>
                  <td>{r.showPublicPage ? <span className="yes">Da</span> : <span className="no">Nu</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && !error && (
          <div className="foot">
            {filtered.length} {filtered.length === 1 ? 'sportiv' : 'sportivi'}
            {filtered.length !== rows.length ? ` din ${rows.length}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
