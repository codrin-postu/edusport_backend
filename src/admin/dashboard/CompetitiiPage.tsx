import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { EDU_CSS } from './edusportUi';
import { SPORTIV_EDIT_TO } from './menu';

/**
 * EduSport admin — "Competiții" page (skate-results driven).
 *
 * Competition data comes from the self-hosted skate-results service, not manual
 * entry. Importing a competition by name resolves its official results page and
 * scrapes it, which ingests every skater in it; those skaters then become
 * linkable to sportspeople in the Sportiv editor. The list below shows the
 * competitions already ingested. All calls go through admin-guarded Strapi
 * proxy routes (/api/skate/*), so skate-results is never called from the browser.
 */

interface EventRow {
  id: number;
  slug?: string | null;
  source_url?: string | null;
  name: string;
  season?: string | null;
  event_date?: string | null;
  skaters_count?: number;
  results_count?: number;
}

interface Candidate {
  url: string;
  title?: string | null;
}

interface ClubResult {
  skater_slug: string;
  skater_name: string;
  category: string;
  placement: number | null;
  total_score: number | null;
  short_score: number | null;
  free_score: number | null;
  sportiv: { name: string; documentId: string };
}

function score(v: number | null | undefined): string {
  return typeof v === 'number' ? v.toFixed(2) : '—';
}

export default function CompetitiiPage() {
  const { get, post, del } = useFetchClient();
  const navigate = useNavigate();

  const [rows, setRows] = React.useState<EventRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [seasonFilter, setSeasonFilter] = React.useState('');
  const [memberFilter, setMemberFilter] = React.useState(''); // skate slug
  const [memberEventIds, setMemberEventIds] = React.useState<Set<number> | null>(null);
  const [page, setPage] = React.useState(0);
  const PER_PAGE = 20;

  const [impInput, setImpInput] = React.useState('');
  const [importing, setImporting] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);

  // Linked club athletes: skate-results slug -> sportsperson, used to filter a
  // competition's full field down to just the club's own skaters.
  const [clubBySlug, setClubBySlug] = React.useState<Map<string, { name: string; documentId: string }>>(new Map());
  const [expanded, setExpanded] = React.useState<number | null>(null);
  const [rowData, setRowData] = React.useState<Record<number, ClubResult[] | 'loading' | 'error'>>({});

  React.useEffect(() => {
    get('/content-manager/collection-types/api::sportsperson.sportsperson?page=1&pageSize=300')
      .then((res: any) => {
        const results: any[] = res?.data?.results ?? [];
        const m = new Map<string, { name: string; documentId: string }>();
        for (const s of results) {
          if (s.skateResultsSlug) m.set(s.skateResultsSlug, { name: s.name, documentId: s.documentId });
        }
        setClubBySlug(m);
      })
      .catch(() => {});
  }, [get]);

  const toggleRow = (ev: EventRow) => {
    if (expanded === ev.id) {
      setExpanded(null);
      return;
    }
    setExpanded(ev.id);
    if (rowData[ev.id]) return; // cached
    setRowData((d) => ({ ...d, [ev.id]: 'loading' }));
    get(`/api/skate/events/${ev.id}/results`)
      .then((res: any) => {
        const all: any[] = Array.isArray(res?.data) ? res.data : [];
        const mine: ClubResult[] = all
          .filter((r) => r.skater_slug && clubBySlug.has(r.skater_slug))
          .map((r) => ({
            skater_slug: r.skater_slug,
            skater_name: r.skater_name,
            category: r.category,
            placement: r.placement,
            total_score: r.total_score,
            short_score: r.short_score,
            free_score: r.free_score,
            sportiv: clubBySlug.get(r.skater_slug)!,
          }));
        setRowData((d) => ({ ...d, [ev.id]: mine }));
      })
      .catch(() => setRowData((d) => ({ ...d, [ev.id]: 'error' })));
  };

  const loadEvents = React.useCallback(() => {
    setLoading(true);
    setError(false);
    get('/api/skate/events')
      .then((res: any) => setRows(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [get]);

  React.useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const runImport = async (payload: { query?: string; url?: string; preview?: boolean }) => {
    setImporting(true);
    setMsg(null);
    if (!payload.preview) setCandidates([]);
    try {
      const res: any = await post('/api/skate/import', payload);
      const d = res?.data ?? {};
      if (d.scraped && d.event) {
        const c = d.counts ?? {};
        setCandidates([]);
        setMsg({
          kind: 'ok',
          text: `Importat: ${d.event.name} — ${c.skaters ?? 0} sportivi, ${c.results ?? 0} rezultate.`,
        });
        setImpInput('');
        loadEvents();
      } else if (Array.isArray(d.candidates) && d.candidates.length) {
        setCandidates(d.candidates);
        setMsg({
          kind: 'ok',
          text: 'Alege competiția de importat dintre rezultatele de mai jos:',
        });
      } else {
        setCandidates([]);
        setMsg({ kind: 'err', text: 'Nicio potrivire găsită. Încearcă alt nume sau lipește direct URL-ul rezultatelor.' });
      }
    } catch {
      setMsg({ kind: 'err', text: 'Căutarea a eșuat. Verifică numele/URL-ul și încearcă din nou.' });
    } finally {
      setImporting(false);
    }
  };

  const onSearch = () => {
    const v = impInput.trim();
    if (!v) return;
    // A pasted results URL imports directly; a name searches for candidates.
    if (/^https?:\/\//i.test(v)) runImport({ url: v });
    else runImport({ query: v, preview: true });
  };

  const [reimportingId, setReimportingId] = React.useState<number | null>(null);
  const reimport = async (ev: EventRow) => {
    const payload = ev.source_url ? { url: ev.source_url } : { query: ev.name };
    setReimportingId(ev.id);
    setMsg(null);
    try {
      const res: any = await post('/api/skate/import', payload);
      const d = res?.data ?? {};
      if (d.scraped) {
        const c = d.counts ?? {};
        setMsg({ kind: 'ok', text: `Reimportat: ${ev.name} — ${c.skaters ?? 0} sportivi, ${c.results ?? 0} rezultate.` });
        setRowData((rd) => {
          const n = { ...rd };
          delete n[ev.id];
          return n;
        });
        loadEvents();
      } else {
        setMsg({ kind: 'err', text: `Nu am putut reimporta „${ev.name}".` });
      }
    } catch {
      setMsg({ kind: 'err', text: 'Reimportul a eșuat.' });
    } finally {
      setReimportingId(null);
    }
  };

  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const deleteEvent = async (ev: EventRow) => {
    if (!window.confirm(`Ștergi competiția „${ev.name}"? Rezultatele ei din skate-results vor fi eliminate.`)) return;
    setDeletingId(ev.id);
    try {
      await del(`/api/skate/events/${ev.id}`);
      setExpanded((e) => (e === ev.id ? null : e));
      setRowData((d) => {
        const n = { ...d };
        delete n[ev.id];
        return n;
      });
      setMsg({ kind: 'ok', text: `Competiție ștearsă: ${ev.name}.` });
      loadEvents();
    } catch {
      setMsg({ kind: 'err', text: 'Ștergerea a eșuat.' });
    } finally {
      setDeletingId(null);
    }
  };

  // When filtering by member, fetch the events that member competed in.
  React.useEffect(() => {
    if (!memberFilter) {
      setMemberEventIds(null);
      return;
    }
    let alive = true;
    get(`/api/skate/skaters/${encodeURIComponent(memberFilter)}/results`)
      .then((res: any) => {
        if (!alive) return;
        const ids = new Set<number>(
          (Array.isArray(res?.data) ? res.data : [])
            .map((r: any) => r.event_id)
            .filter((n: any) => typeof n === 'number'),
        );
        setMemberEventIds(ids);
      })
      .catch(() => alive && setMemberEventIds(new Set()));
    return () => {
      alive = false;
    };
  }, [memberFilter, get]);

  const seasonOptions = React.useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.season && set.add(r.season));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const memberOptions = React.useMemo(
    () =>
      [...clubBySlug.entries()]
        .map(([slug, s]) => ({ slug, name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [clubBySlug],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !(r.name ?? '').toLowerCase().includes(q)) return false;
      if (seasonFilter && r.season !== seasonFilter) return false;
      if (memberEventIds && !memberEventIds.has(r.id)) return false;
      return true;
    });
  }, [rows, search, seasonFilter, memberEventIds]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);

  React.useEffect(() => setPage(0), [search, seasonFilter, memberFilter]);

  return (
    <div className="eduf">
      <style>{EDU_CSS}</style>
      <div className="win">
        <div className="hd">
          <div>
            <h1>Competiții</h1>
            <p>Importă o competiție după nume pentru a-i prelua rezultatele. Sportivii apar automat și pot fi conectați în editorul de sportiv.</p>
          </div>
        </div>

        <div className="tb" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="search" style={{ flex: '1 1 320px' }}>
            <span aria-hidden="true">⌕</span>
            <input
              placeholder="Nume competiție (ex. Crystal Skate of Romania 2024) sau URL rezultate"
              value={impInput}
              onChange={(e) => setImpInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSearch();
                }
              }}
            />
          </div>
          <button className="btn pri" type="button" onClick={onSearch} disabled={importing}>
            {importing ? 'Se caută…' : 'Caută competiție'}
          </button>
        </div>

        {msg && (
          <div className={`msg ${msg.kind}`} style={{ margin: '0 0 10px' }}>
            {msg.text}
          </div>
        )}

        {candidates.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {candidates.map((c) => (
              <button
                key={c.url}
                type="button"
                onClick={() => runImport({ url: c.url })}
                disabled={importing}
                style={{
                  textAlign: 'left',
                  border: '1px solid #dcdcdc',
                  borderRadius: 5,
                  padding: '8px 12px',
                  background: '#fff',
                  cursor: importing ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <b>{c.title || c.url}</b>
                  <div style={{ fontSize: 12, color: '#6a6f7a', wordBreak: 'break-all' }}>{c.url}</div>
                </span>
                <span style={{ flex: 'none', color: '#2138b8', fontWeight: 700, fontSize: 12 }}>
                  {importing ? '…' : 'Importă →'}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="tb" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="search" style={{ flex: '1 1 260px' }}>
            <span aria-hidden="true">⌕</span>
            <input placeholder="Filtrează competițiile importate..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)}>
            <option value="">Toate sezoanele</option>
            {seasonOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}>
            <option value="">Toți sportivii clubului</option>
            {memberOptions.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty">Se încarcă...</div>
        ) : error ? (
          <div className="empty">Nu am putut încărca competițiile din skate-results.</div>
        ) : filtered.length === 0 ? (
          <div className="empty">Nicio competiție importată încă. Importă una mai sus.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Nume</th>
                <th>Sezon</th>
                <th>Sportivi</th>
                <th>Rezultate</th>
                <th style={{ width: 24 }}></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => {
                const isOpen = expanded === r.id;
                const data = rowData[r.id];
                return (
                  <React.Fragment key={r.id}>
                    <tr onClick={() => toggleRow(r)} style={{ cursor: 'pointer' }}>
                      <td className="nm">{r.name}</td>
                      <td className="num">{r.season || '—'}</td>
                      <td className="num">{r.skaters_count ?? 0}</td>
                      <td className="num">{r.results_count ?? 0}</td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          title="Reimportă (re-scrapează) competiția"
                          onClick={(e) => {
                            e.stopPropagation();
                            reimport(r);
                          }}
                          disabled={reimportingId === r.id}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2138b8', fontWeight: 600, fontSize: 12, marginRight: 10 }}
                        >
                          {reimportingId === r.id ? '…' : 'Reimportă'}
                        </button>
                        <button
                          type="button"
                          title="Șterge competiția"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEvent(r);
                          }}
                          disabled={deletingId === r.id}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#be3330', fontWeight: 600, fontSize: 12, marginRight: 10 }}
                        >
                          {deletingId === r.id ? '…' : 'Șterge'}
                        </button>
                        <span style={{ color: '#8a8f98' }}>{isOpen ? '▾' : '▸'}</span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={5} style={{ background: '#f7f8fa', padding: 0 }}>
                          {data === 'loading' ? (
                            <div style={{ padding: '12px 18px', color: '#6a6f7a', fontSize: 12 }}>Se încarcă…</div>
                          ) : data === 'error' || !data ? (
                            <div style={{ padding: '12px 18px', color: '#be3330', fontSize: 12 }}>Nu am putut încărca rezultatele.</div>
                          ) : data.length === 0 ? (
                            <div style={{ padding: '12px 18px', color: '#6a6f7a', fontSize: 12 }}>
                              Niciun sportiv conectat al clubului în această competiție. Conectează sportivii în editorul de sportiv.
                            </div>
                          ) : (
                            <div style={{ padding: '8px 18px 14px' }}>
                              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: '#6a6f7a', margin: '6px 0' }}>
                                {data.length} sportiv{data.length === 1 ? '' : 'i'} din club
                              </div>
                              <table className="tbl" style={{ margin: 0 }}>
                                <thead>
                                  <tr>
                                    <th>Sportiv</th>
                                    <th>Categorie</th>
                                    <th>Loc</th>
                                    <th>PS</th>
                                    <th>PL</th>
                                    <th>Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {data.map((m, i) => (
                                    <tr
                                      key={`${m.skater_slug}-${i}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`${SPORTIV_EDIT_TO}?id=${m.sportiv.documentId}`);
                                      }}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <td className="nm">{m.sportiv.name}</td>
                                      <td>{m.category}</td>
                                      <td className="num">{m.placement ?? '—'}</td>
                                      <td className="num">{score(m.short_score)}</td>
                                      <td className="num">{score(m.free_score)}</td>
                                      <td className="num">{score(m.total_score)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}

        {!loading && !error && (
          <div className="foot" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span>
              {filtered.length} {filtered.length === 1 ? 'competiție' : 'competiții'}
              {filtered.length !== rows.length ? ` din ${rows.length}` : ''}
            </span>
            {totalPages > 1 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn" type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
                  Înapoi
                </button>
                <span>
                  {safePage + 1} / {totalPages}
                </span>
                <button className="btn" type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>
                  Înainte
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
