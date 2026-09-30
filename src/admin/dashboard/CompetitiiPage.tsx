import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { SPORTIV_EDIT_TO } from './menu';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  AdminPage,
  Window,
  PageHeader,
  Section,
  Field,
  Input,
  Select,
  Button,
  Notice,
  DataTable,
  type DataColumn,
} from '../ui';

/**
 * EduSport admin, "Competiții" page (skate-results driven).
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
  return typeof v === 'number' ? v.toFixed(2) : '-';
}

const COMPETITII_CSS = `
.adm-root .cmp-cand{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
.adm-root .cmp-cand-btn{text-align:left;border:1px solid var(--adm-line-strong);border-radius:var(--adm-radius-sm);padding:8px 12px;background:var(--adm-surface-raised);cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;font:inherit;color:var(--adm-text-primary)}
.adm-root .cmp-cand-btn:disabled{cursor:default;opacity:.6}
.adm-root .cmp-cand-url{font-size:11.5px;color:var(--adm-text-muted);word-break:break-all}
.adm-root .cmp-cand-go{flex:none;color:var(--adm-accent);font-weight:700;font-size:12px}
.adm-root .cmp-detail{background:var(--adm-surface-subtle);border:1px solid var(--adm-line);border-radius:var(--adm-radius-sm);padding:8px 14px 14px;margin-top:-1px}
.adm-root .cmp-detail-count{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--adm-text-muted);margin:6px 0}
.adm-root .cmp-detail-msg{padding:10px 4px;font-size:12.5px;color:var(--adm-text-secondary)}
.adm-root .cmp-mini-row{cursor:pointer}
.adm-root .cmp-msg{margin-top:var(--adm-space-3)}
`;

export default function CompetitiiPage() {
  const { get, post, del } = useFetchClient();
  const navigate = useNavigate();

  const [rows, setRows] = React.useState<EventRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [seasonFilter, setSeasonFilter] = React.useState('');
  const [memberFilter, setMemberFilter] = React.useState(''); // skate slug
  const [memberEventIds, setMemberEventIds] = React.useState<Set<number> | null>(null);

  const [impInput, setImpInput] = React.useState('');
  const [importing, setImporting] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);

  // Linked club athletes: skate-results slug -> sportsperson, used to filter a
  // competition's full field down to just the club's own skaters.
  const [clubBySlug, setClubBySlug] = React.useState<Map<string, { name: string; documentId: string }>>(new Map());
  const [clubLoadFailed, setClubLoadFailed] = React.useState(false);
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
        setClubLoadFailed(false);
      })
      .catch(() => {
        // A failed lookup and a genuine "no athletes matched" used to render
        // identically, which made a real data problem look like an empty club.
        setClubLoadFailed(true);
      });
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
          text: `Importat: ${d.event.name}, ${c.skaters ?? 0} sportivi, ${c.results ?? 0} rezultate.`,
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

  // Re-read one competition from our own database. Deliberately NOT a scrape:
  // the results are already stored, and re-fetching them from the source would
  // spend minutes retrieving every category to arrive at the same rows. Use the
  // import box above to bring in a competition we do not hold yet.
  const refresh = async (ev: EventRow) => {
    setReimportingId(ev.id);
    setMsg(null);
    try {
      const res: any = await get(`/api/skate/events/${ev.id}/results`);
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
      setExpanded(ev.id);
      setMsg({
        kind: 'ok',
        text: `Actualizat „${ev.name}": ${all.length} rezultate, ${mine.length} de la sportivii clubului.`,
      });
      loadEvents();
    } catch {
      setMsg({ kind: 'err', text: `Nu am putut citi rezultatele pentru „${ev.name}".` });
    } finally {
      setReimportingId(null);
    }
  };

  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  // Competition pending confirmation. `deleteEvent` only runs once the shared
  // ConfirmDialog is confirmed; the delete call + side effects are unchanged.
  const [delTarget, setDelTarget] = React.useState<EventRow | null>(null);
  const deleteEvent = async (ev: EventRow) => {
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
      setDelTarget(null);
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
    return rows.filter((r) => {
      if (seasonFilter && r.season !== seasonFilter) return false;
      if (memberEventIds && !memberEventIds.has(r.id)) return false;
      return true;
    });
  }, [rows, seasonFilter, memberEventIds]);

  const expandedRow = expanded !== null ? filtered.find((r) => r.id === expanded) : undefined;
  const expandedData = expanded !== null ? rowData[expanded] : undefined;

  const columns: DataColumn<EventRow>[] = [
    { key: 'name', header: 'Nume', value: (r) => r.name, sortable: true },
    { key: 'season', header: 'Sezon', value: (r) => r.season ?? '', sortable: true, align: 'right' },
    { key: 'skaters_count', header: 'Sportivi', value: (r) => r.skaters_count ?? 0, sortable: true, align: 'right' },
    { key: 'results_count', header: 'Rezultate', value: (r) => r.results_count ?? 0, sortable: true, align: 'right' },
    {
      key: 'actions',
      header: '',
      searchable: false,
      align: 'right',
      render: (r) => (
        <>
          <Button
            variant="ghost"
            size="sm"
            title="Recitește rezultatele din baza noastră de date"
            onClick={(e) => {
              e.stopPropagation();
              refresh(r);
            }}
            disabled={reimportingId === r.id}
          >
            {reimportingId === r.id ? '…' : 'Actualizează'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title="Șterge competiția"
            onClick={(e) => {
              e.stopPropagation();
              setDelTarget(r);
            }}
            disabled={deletingId === r.id}
          >
            {deletingId === r.id ? '…' : 'Șterge'}
          </Button>
        </>
      ),
    },
  ];

  return (
    <AdminPage>
      <style>{COMPETITII_CSS}</style>
      <Window>
        <PageHeader
          title="Competiții"
          subtitle="Importă o competiție după nume pentru a-i prelua rezultatele. Sportivii apar automat și pot fi conectați în editorul de sportiv."
        />

        <Section title="Importă o competiție">
          <div className="adm-grid2">
            <Field label="Nume competiție sau URL rezultate" hideLabel>
              <Input
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
            </Field>
            <Button onClick={onSearch} disabled={importing} loading={importing}>
              {importing ? 'Se caută…' : 'Caută competiție'}
            </Button>
          </div>

          {msg && (
            <Notice tone={msg.kind === 'ok' ? 'ok' : 'danger'} className="cmp-msg">
              {msg.text}
            </Notice>
          )}

          {candidates.length > 0 && (
            <div className="cmp-cand">
              {candidates.map((c) => (
                <button
                  key={c.url}
                  type="button"
                  className="cmp-cand-btn"
                  onClick={() => runImport({ url: c.url })}
                  disabled={importing}
                >
                  <span style={{ minWidth: 0 }}>
                    <b>{c.title || c.url}</b>
                    <div className="cmp-cand-url">{c.url}</div>
                  </span>
                  <span className="cmp-cand-go">{importing ? '…' : 'Importă →'}</span>
                </button>
              ))}
            </div>
          )}
        </Section>

        <Section title="Competiții importate">
          <div className="adm-grid2" style={{ marginBottom: 12 }}>
            <Select
              aria-label="Filtrează după sezon"
              value={seasonFilter}
              onChange={(v) => setSeasonFilter(v)}
              placeholder="Toate sezoanele"
              options={seasonOptions.map((s) => ({ value: s, label: s }))}
            />
            <Select
              aria-label="Filtrează după sportiv"
              value={memberFilter}
              onChange={(v) => setMemberFilter(v)}
              placeholder="Toți sportivii clubului"
              options={memberOptions.map((m) => ({ value: m.slug, label: m.name }))}
            />
          </div>

          <DataTable
            columns={columns}
            rows={filtered}
            getRowKey={(r) => r.id}
            onRowClick={toggleRow}
            rowLabel={(r) => `Detalii ${r.name}`}
            loading={loading}
            empty={error ? 'Nu am putut încărca competițiile din skate-results.' : 'Nicio competiție importată încă. Importă una mai sus.'}
            search
            searchPlaceholder="Filtrează competițiile importate..."
            initialSort={{ key: 'name', dir: 'asc' }}
          />

          {expandedRow && (
            <div className="cmp-detail">
              {expandedData === 'loading' ? (
                <div className="cmp-detail-msg">Se încarcă…</div>
              ) : expandedData === 'error' || !expandedData ? (
                <div className="cmp-detail-msg">Nu am putut încărca rezultatele.</div>
              ) : expandedData.length === 0 ? (
                <div className="cmp-detail-msg">
                  {clubLoadFailed
                    ? 'Nu am putut încărca lista sportivilor clubului, așa că nu putem spune cine a participat. Reîncarcă pagina.'
                    : 'Niciun sportiv conectat al clubului în această competiție. Conectează sportivii în editorul de sportiv.'}
                </div>
              ) : (
                <>
                  <div className="cmp-detail-count">
                    {expandedData.length} sportiv{expandedData.length === 1 ? '' : 'i'} din club, {expandedRow.name}
                  </div>
                  <DataTable
                    columns={[
                      { key: 'skater_name', header: 'Sportiv', value: (m: ClubResult) => m.sportiv.name },
                      { key: 'category', header: 'Categorie', value: (m: ClubResult) => m.category },
                      { key: 'placement', header: 'Loc', value: (m: ClubResult) => m.placement ?? 0, align: 'right' },
                      { key: 'short_score', header: 'PS', value: (m: ClubResult) => score(m.short_score), align: 'right' },
                      { key: 'free_score', header: 'PL', value: (m: ClubResult) => score(m.free_score), align: 'right' },
                      { key: 'total_score', header: 'Total', value: (m: ClubResult) => score(m.total_score), align: 'right' },
                    ]}
                    rows={expandedData}
                    getRowKey={(m) => `${m.skater_slug}-${m.category}`}
                    onRowClick={(m) => navigate(`${SPORTIV_EDIT_TO}?id=${m.sportiv.documentId}`)}
                    rowLabel={(m) => `Editează ${m.sportiv.name}`}
                    pageSize={0}
                  />
                </>
              )}
            </div>
          )}
        </Section>
      </Window>

      <ConfirmDialog
        open={delTarget !== null}
        title="Ștergi competiția?"
        message={`Ștergi competiția „${delTarget?.name ?? ''}"? Rezultatele ei din skate-results vor fi eliminate.`}
        busy={delTarget !== null && deletingId === delTarget.id}
        onCancel={() => setDelTarget(null)}
        onConfirm={() => {
          if (delTarget) deleteEvent(delTarget);
        }}
      />
    </AdminPage>
  );
}
