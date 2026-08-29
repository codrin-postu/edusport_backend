import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { EDU_CSS, PROGRAM_TYPES } from './edusportUi';
import { SPORTIVI_TO, SPORTIV_EDIT_TO } from './menu';

/**
 * EduSport admin — custom "Sportiv" edit page (replaces the default
 * content-manager edit view for api::sportsperson.sportsperson).
 *
 * Two columns. Left rail: photo (single media), slug, activeSince, showPublicPage.
 * Right: name/description, story (blocks, edited as plain text), team & disciplines
 * (relation multi-selects), favoriteMoves/hobbies (json string arrays), careerGoal,
 * gallery (multiple media), seasons (repeatable component with per-season programs).
 *
 * Reads scalars + media via content-manager GET; relations via the dedicated
 * content-manager relations endpoint (list GET returns counts only). Writes via
 * content-manager PUT/POST: media as numeric file ids, relations as { set:[{id}] },
 * story converted between the blocks structure and plain text.
 */

const CT = '/content-manager/collection-types/api::sportsperson.sportsperson';
const REL = (docId: string, field: string) =>
  `/content-manager/relations/api::sportsperson.sportsperson/${docId}/${field}`;
const DISCIPLINE_CT = '/content-manager/collection-types/api::discipline.discipline';
const TEAM_CT = '/content-manager/collection-types/api::team-member.team-member';

interface Opt {
  id: number;
  documentId: string;
  name: string;
}
interface ProgramRow {
  type: string;
  title: string;
  artist: string | null;
}
interface SeasonRow {
  season: string;
  programs: ProgramRow[];
}
interface FormState {
  name: string;
  slug: string;
  description: string;
  storyText: string;
  showPublicPage: boolean;
  activeSince: string;
  careerGoal: string;
  favoriteMoves: string[];
  hobbies: string[];
  photo: { id: number; url: string } | null;
  gallery: { id: number; url: string }[];
  disciplines: Opt[];
  coaches: Opt[];
  choreographers: Opt[];
  seasons: SeasonRow[];
  skateResultsSlug: string;
}

const EMPTY: FormState = {
  name: '',
  slug: '',
  description: '',
  storyText: '',
  showPublicPage: false,
  activeSince: '',
  careerGoal: '',
  favoriteMoves: [],
  hobbies: [],
  photo: null,
  gallery: [],
  disciplines: [],
  coaches: [],
  choreographers: [],
  seasons: [],
  skateResultsSlug: '',
};

// ---- blocks <-> plain text -------------------------------------------------
function blocksToText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return '';
  const lineOf = (node: any): string => {
    if (Array.isArray(node?.children)) return node.children.map((c: any) => (typeof c?.text === 'string' ? c.text : lineOf(c))).join('');
    return typeof node?.text === 'string' ? node.text : '';
  };
  return blocks.map(lineOf).join('\n');
}
function textToBlocks(text: string): unknown {
  const t = text.replace(/\r\n/g, '\n');
  if (!t.trim()) return null;
  return t.split('\n').map((line) => ({ type: 'paragraph', children: [{ type: 'text', text: line }] }));
}

/** URL-safe slug from a name; the `slug` uid field is required, so the editor
 *  never lets it be empty (Strapi's auto-uid is bypassed by our direct save). */
function slugify(s: string): string {
  return (s || '')
    .replace(/[șşȘŞ]/g, 's')
    .replace(/[țţȚŢ]/g, 't')
    .replace(/[ăâĂÂ]/g, 'a')
    .replace(/[îÎ]/g, 'i')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter((x) => x.trim() !== '');
  return [];
}
function relResults(res: any): Opt[] {
  const r = res?.data?.results ?? res?.data?.data ?? [];
  return (Array.isArray(r) ? r : []).map((x: any) => ({ id: x.id, documentId: x.documentId, name: x.name ?? '' }));
}
function fileOf(m: any): { id: number; url: string } | null {
  if (!m || typeof m !== 'object') return null;
  const url = m.formats?.thumbnail?.url ?? m.url;
  return typeof m.id === 'number' ? { id: m.id, url } : null;
}

// ---- media picker modal ----------------------------------------------------
interface UploadFile {
  id: number;
  name: string;
  url: string;
  mime: string;
  formats?: { thumbnail?: { url?: string } };
}
function MediaModal({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (f: { id: number; url: string }) => void }) {
  const { get } = useFetchClient();
  const [files, setFiles] = React.useState<UploadFile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState('');

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
        const list: UploadFile[] = Array.isArray(data) ? data : data?.results ?? [];
        setFiles(list.filter((f) => f.mime?.startsWith('image/')));
      })
      .catch(() => {})
      .finally(() => {
        if (!off) setLoading(false);
      });
    return () => {
      off = true;
    };
  }, [open, q, get]);

  if (!open) return null;
  return (
    <div
      onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,54,.28)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: 720, maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #dcdcdc', borderRadius: 6, overflow: 'hidden' }}
      >
        <div style={{ padding: '13px 15px', borderBottom: '1px solid #e0e2e8', display: 'flex', alignItems: 'center', gap: 10 }}>
          <b style={{ fontSize: 14 }}>Alege o imagine</b>
          <input placeholder="Caută imagini..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
          <button className="btn sm" type="button" onClick={onClose}>
            Închide
          </button>
        </div>
        <div style={{ padding: 14, overflowY: 'auto' }}>
          {loading ? (
            <div className="empty">Se încarcă...</div>
          ) : files.length === 0 ? (
            <div className="empty">Nu există imagini.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10 }}>
              {files.map((f) => {
                const thumb = f.formats?.thumbnail?.url ?? f.url;
                return (
                  <button
                    key={f.id}
                    type="button"
                    title={f.name}
                    onClick={() => onPick({ id: f.id, url: f.url })}
                    style={{ padding: 5, border: '1px solid #d0d0d0', borderRadius: 4, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <div style={{ width: '100%', aspectRatio: '1/1', background: `#f6f6f9 center/cover no-repeat`, backgroundImage: `url(${thumb})`, borderRadius: 3 }} />
                    <div style={{ fontSize: 11, color: '#32324d', marginTop: 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{f.name}</div>
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

// ---- relation multi-select box --------------------------------------------
function RelPicker({ label, value, options, onChange }: { label: string; value: Opt[]; options: Opt[]; onChange: (next: Opt[]) => void }) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selectedIds = new Set(value.map((v) => v.id));
  const matches = options.filter((o) => !selectedIds.has(o.id) && o.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="fld">
      <label>{label}</label>
      <div className="relbox" ref={boxRef}>
        {value.length > 0 && (
          <div className="tags">
            {value.map((v) => (
              <span className="tag" key={v.id}>
                {v.name}
                <button type="button" className="x" aria-label="Elimină" onClick={() => onChange(value.filter((x) => x.id !== v.id))}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="addwrap">
          <input
            placeholder="Caută și adaugă..."
            value={q}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
          />
          {open && (
            <div className="relmenu">
              {matches.length === 0 ? (
                <div className="none">Niciun rezultat</div>
              ) : (
                matches.slice(0, 30).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      onChange([...value, o]);
                      setQ('');
                    }}
                  >
                    {o.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- json string-array editor (moves / hobbies) ---------------------------
function StringListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  return (
    <div className="chips">
      {items.map((it, i) => (
        <span className="chipin" key={i}>
          <input value={it} placeholder={placeholder} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="x" aria-label="Elimină" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            ✕
          </button>
        </span>
      ))}
      <button type="button" className="addbtn" onClick={() => onChange([...items, ''])}>
        + Adaugă
      </button>
    </div>
  );
}

export default function SportivEditPage() {
  const { get, put, post } = useFetchClient();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search || window.location.search);
  const id = params.get('id') || '';
  const isNew = !id;

  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [loading, setLoading] = React.useState(!isNew);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [mediaFor, setMediaFor] = React.useState<null | 'photo' | 'gallery'>(null);

  const [disciplineOpts, setDisciplineOpts] = React.useState<Opt[]>([]);
  const [teamOpts, setTeamOpts] = React.useState<Opt[]>([]);

  // skate-results linker
  const [skateQuery, setSkateQuery] = React.useState('');
  const [skateCands, setSkateCands] = React.useState<any[]>([]);
  const [skateSearching, setSkateSearching] = React.useState(false);
  const [skateSearched, setSkateSearched] = React.useState(false);
  const [skateLinked, setSkateLinked] = React.useState<any | null>(null);

  const upd = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  // Preview of the currently linked skate-results skater (name/club/counts).
  React.useEffect(() => {
    const slug = form.skateResultsSlug;
    if (!slug) {
      setSkateLinked(null);
      return;
    }
    let alive = true;
    get(`/api/skate/skaters/${encodeURIComponent(slug)}`)
      .then((r: any) => alive && setSkateLinked(r?.data ?? null))
      .catch(() => alive && setSkateLinked(null));
    return () => {
      alive = false;
    };
  }, [form.skateResultsSlug, get]);

  // Seed the search box with the athlete's name once it loads.
  React.useEffect(() => {
    if (form.name && !skateQuery) setSkateQuery(form.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name]);

  const runSkateSearch = async () => {
    const q = (skateQuery || form.name).trim();
    if (!q) return;
    setSkateSearching(true);
    setSkateSearched(true);
    try {
      const r: any = await get(`/api/skate/skaters?q=${encodeURIComponent(q)}&limit=20`);
      setSkateCands(Array.isArray(r?.data) ? r.data : []);
    } catch {
      setSkateCands([]);
    } finally {
      setSkateSearching(false);
    }
  };

  // Full-history import from the rinkresults person index, attached to the
  // linked skater by slug. Tries by name first; falls back to a pasted
  // rinkresults link/id when the name doesn't resolve.
  const [importingHist, setImportingHist] = React.useState(false);
  const [rrId, setRrId] = React.useState('');
  const [showRrFallback, setShowRrFallback] = React.useState(false);
  const [histProgress, setHistProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [histLog, setHistLog] = React.useState<{ name: string; ok: boolean }[]>([]);

  // Discover the athlete's competitions from rinkresults, then import each one
  // officially (resolve + scrape) so results carry TES/PCS + location, and
  // club-mates get populated too. The loop runs in the browser with progress.
  const importHistory = async (useId: boolean) => {
    if (!form.skateResultsSlug) return;
    setImportingHist(true);
    setMsg(null);
    try {
      const discPayload = useId
        ? { rinkresults_id: rrId.replace(/\D/g, '') }
        : { name: form.name };
      const disc: any = await post('/api/skate/skater-competitions', discPayload);
      const comps: Array<{ name: string; competition_id?: string; date?: string; city?: string }> =
        disc?.data?.competitions ?? [];
      if (!comps.length) {
        setShowRrFallback(true);
        setMsg({ kind: 'err', text: 'Nu am găsit competiții pe rinkresults. Lipește linkul rinkresults.' });
        return;
      }
      setShowRrFallback(false);
      setHistProgress({ done: 0, total: comps.length });
      setHistLog([]);
      const log: { name: string; ok: boolean }[] = [];
      let imported = 0;
      let failed = 0;
      // Each call scrapes a full competition from rinkresults by id; the server
      // serializes at 10s (their crawl-delay), so no client-side wait is needed.
      for (let i = 0; i < comps.length; i++) {
        let ok = false;
        if (comps[i].competition_id) {
          try {
            const ir: any = await post('/api/skate/import-competition', {
              competition_id: comps[i].competition_id,
              event_date: comps[i].date,
              city: comps[i].city,
            });
            ok = !!ir?.data?.event;
          } catch {
            ok = false;
          }
        }
        ok ? (imported += 1) : (failed += 1);
        log.push({ name: comps[i].name, ok });
        setHistLog([...log]);
        setHistProgress({ done: i + 1, total: comps.length });
      }
      setMsg({
        kind: 'ok',
        text: `Importat: ${imported} din ${comps.length} competiții${failed ? `, ${failed} eșuate` : ''}.`,
      });
      setSkateLinked((s: any) => (s ? { ...s } : s));
    } catch {
      setShowRrFallback(true);
      setMsg({ kind: 'err', text: 'Nu am găsit sportivul pe rinkresults după nume. Lipește linkul rinkresults.' });
    } finally {
      setHistProgress(null);
      setImportingHist(false);
    }
  };

  // lookups for relation pickers
  React.useEffect(() => {
    get(`${DISCIPLINE_CT}?page=1&pageSize=200&sort=name:ASC`)
      .then((res: any) => setDisciplineOpts(relResults(res)))
      .catch(() => {});
    get(`${TEAM_CT}?page=1&pageSize=200&sort=name:ASC`)
      .then((res: any) => setTeamOpts(relResults(res)))
      .catch(() => {});
  }, [get]);

  const load = React.useCallback(
    (docId: string) => {
      setLoading(true);
      setError(false);
      Promise.all([
        get(`${CT}/${docId}`),
        get(REL(docId, 'disciplines')).catch(() => null),
        get(REL(docId, 'coaches')).catch(() => null),
        get(REL(docId, 'choreographers')).catch(() => null),
      ])
        .then(([main, dRes, cRes, chRes]: any[]) => {
          const e = main?.data?.data ?? main?.data;
          const seasons: SeasonRow[] = Array.isArray(e?.seasons)
            ? e.seasons.map((s: any) => ({
                season: s?.season ?? '',
                programs: Array.isArray(s?.programs)
                  ? s.programs.map((p: any) => ({ type: p?.type ?? PROGRAM_TYPES[0], title: p?.title ?? '', artist: p?.artist ?? null }))
                  : [],
              }))
            : [];
          setForm({
            name: e?.name ?? '',
            slug: e?.slug ?? '',
            description: e?.description ?? '',
            storyText: blocksToText(e?.story),
            showPublicPage: !!e?.showPublicPage,
            activeSince: e?.activeSince ?? '',
            careerGoal: e?.careerGoal ?? '',
            favoriteMoves: toStringArray(e?.favoriteMoves),
            hobbies: toStringArray(e?.hobbies),
            photo: fileOf(e?.photo),
            gallery: Array.isArray(e?.gallery) ? e.gallery.map(fileOf).filter(Boolean) as { id: number; url: string }[] : [],
            disciplines: dRes ? relResults(dRes) : [],
            coaches: cRes ? relResults(cRes) : [],
            choreographers: chRes ? relResults(chRes) : [],
            seasons,
            skateResultsSlug: e?.skateResultsSlug ?? '',
          });
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    },
    [get],
  );

  React.useEffect(() => {
    if (isNew) {
      setForm(EMPTY);
      setLoading(false);
      return;
    }
    load(id);
  }, [id, isNew, load]);

  const buildBody = () => ({
    name: form.name,
    // The uid slug is required; never send it empty or publishing fails.
    slug: (form.slug && form.slug.trim()) || slugify(form.name),
    description: form.description || null,
    story: textToBlocks(form.storyText),
    showPublicPage: form.showPublicPage,
    activeSince: form.activeSince || null,
    careerGoal: form.careerGoal || null,
    favoriteMoves: form.favoriteMoves.map((s) => s.trim()).filter(Boolean),
    hobbies: form.hobbies.map((s) => s.trim()).filter(Boolean),
    photo: form.photo ? form.photo.id : null,
    gallery: form.gallery.map((g) => g.id),
    disciplines: { set: form.disciplines.map((d) => ({ id: d.id })) },
    coaches: { set: form.coaches.map((c) => ({ id: c.id })) },
    choreographers: { set: form.choreographers.map((c) => ({ id: c.id })) },
    seasons: form.seasons.map((s) => ({
      season: s.season,
      programs: s.programs.map((p) => ({ type: p.type, title: p.title, artist: p.artist ?? null })),
    })),
    skateResultsSlug: form.skateResultsSlug || null,
  });

  const save = async () => {
    if (!form.name.trim()) {
      setMsg({ kind: 'err', text: 'Numele este obligatoriu.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const body = buildBody();
      // Save updates the draft; publishing makes it live (visibility is still
      // gated by the Public/Ascuns toggle). Publish failure never blocks the save.
      // The draft is already persisted by the POST/PUT above; the publish
      // action just promotes it. It rejects the update-shaped body (relations
      // as {set:...}), so send an empty payload.
      const publish = async (docId: string) => {
        try {
          await post(`/api/sportspeople/${docId}/publish`, {});
        } catch {
          /* leave as draft if publish endpoint is unavailable */
        }
      };
      if (isNew) {
        const res: any = await post(CT, body);
        const newId = (res?.data?.data ?? res?.data)?.documentId;
        if (newId) await publish(newId);
        setMsg({ kind: 'ok', text: 'Sportiv creat și publicat.' });
        if (newId) {
          navigate(`${SPORTIV_EDIT_TO}?id=${newId}`, { replace: true });
        }
      } else {
        await put(`${CT}/${id}`, body);
        await publish(id);
        setMsg({ kind: 'ok', text: 'Modificările au fost salvate și publicate.' });
        load(id);
      }
    } catch (e: any) {
      setMsg({ kind: 'err', text: 'Salvarea a eșuat. Verifică datele și încearcă din nou.' });
    } finally {
      setSaving(false);
    }
  };

  const addSeason = () => upd({ seasons: [...form.seasons, { season: '', programs: [] }] });
  const updSeason = (i: number, patch: Partial<SeasonRow>) => upd({ seasons: form.seasons.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const removeSeason = (i: number) => upd({ seasons: form.seasons.filter((_, j) => j !== i) });
  const addProgram = (si: number) =>
    updSeason(si, { programs: [...form.seasons[si].programs, { type: PROGRAM_TYPES[0], title: '', artist: null }] });
  const updProgram = (si: number, pi: number, patch: Partial<ProgramRow>) =>
    updSeason(si, { programs: form.seasons[si].programs.map((p, j) => (j === pi ? { ...p, ...patch } : p)) });
  const removeProgram = (si: number, pi: number) =>
    updSeason(si, { programs: form.seasons[si].programs.filter((_, j) => j !== pi) });

  return (
    // `pce` opts our custom "Salvează" buttons out of the global admin SaveBar tagger.
    <div className="eduf pce">
      <style>{EDU_CSS}</style>
      <div className="win">
        <div className="hd">
          <div>
            <h1>{isNew ? 'Adaugă sportiv' : 'Editează sportiv'}</h1>
            <p>{isNew ? 'Completează profilul noului sportiv.' : form.name}</p>
          </div>
          <div className="hd-right">
            <button className="btn" type="button" onClick={() => navigate(SPORTIVI_TO)}>
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
          <div className="empty">Nu am putut încărca sportivul.</div>
        ) : (
          <div className="cols">
            {/* LEFT RAIL */}
            <div className="rail">
              <div className="fld">
                <label>Fotografie</label>
                <div className="photo">
                  <div className="pv" style={form.photo ? { backgroundImage: `url(${form.photo.url})` } : undefined}>
                    {!form.photo && 'fără fotografie'}
                  </div>
                  <div className="acts">
                    <button className="btn sm" type="button" onClick={() => setMediaFor('photo')}>
                      {form.photo ? 'Schimbă' : 'Alege'}
                    </button>
                    {form.photo && (
                      <button className="btn sm danger" type="button" onClick={() => upd({ photo: null })}>
                        Elimină
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="fld">
                <label>Slug</label>
                <input value={form.slug} onChange={(e) => upd({ slug: e.target.value })} placeholder="ex. nume-sportiv" />
                <div className="hint">Se generează din nume dacă e gol.</div>
              </div>
              <div className="fld">
                <label>Activ din</label>
                <input type="date" value={form.activeSince} onChange={(e) => upd({ activeSince: e.target.value })} />
              </div>
              <div className="fld">
                <label>Vizibilitate pe site</label>
                <div className="pubseg">
                  <button type="button" className={form.showPublicPage ? 'on' : ''} onClick={() => upd({ showPublicPage: true })}>Public</button>
                  <button type="button" className={!form.showPublicPage ? 'on' : ''} onClick={() => upd({ showPublicPage: false })}>Ascuns</button>
                </div>
              </div>
            </div>

            {/* RIGHT BODY */}
            <div className="body">
              <div className="sec">
                <div className="sh">Identitate</div>
                <div className="sb">
                  <div className="fld">
                    <label>Nume</label>
                    <input value={form.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Nume și prenume" />
                  </div>
                  <div className="fld">
                    <label>Descriere scurtă</label>
                    <textarea rows={2} value={form.description} onChange={(e) => upd({ description: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="sec">
                <div className="sh">Poveste</div>
                <div className="sb">
                  <div className="fld">
                    <label>Text poveste</label>
                    <textarea rows={6} value={form.storyText} onChange={(e) => upd({ storyText: e.target.value })} placeholder="Fiecare rând devine un paragraf." />
                    <div className="hint">Fiecare rând nou devine un paragraf pe site.</div>
                  </div>
                </div>
              </div>

              <div className="sec">
                <div className="sh">Echipă și discipline</div>
                <div className="sb">
                  <RelPicker label="Discipline" value={form.disciplines} options={disciplineOpts} onChange={(next) => upd({ disciplines: next })} />
                  <RelPicker label="Antrenori" value={form.coaches} options={teamOpts} onChange={(next) => upd({ coaches: next })} />
                  <RelPicker label="Coregrafi" value={form.choreographers} options={teamOpts} onChange={(next) => upd({ choreographers: next })} />
                </div>
              </div>

              <div className="sec">
                <div className="sh">Mișcări și hobby-uri</div>
                <div className="sb">
                  <div className="fld">
                    <label>Mișcări preferate</label>
                    <StringListEditor items={form.favoriteMoves} onChange={(next) => upd({ favoriteMoves: next })} placeholder="Mișcare" />
                  </div>
                  <div className="fld">
                    <label>Hobby-uri</label>
                    <StringListEditor items={form.hobbies} onChange={(next) => upd({ hobbies: next })} placeholder="Hobby" />
                  </div>
                </div>
              </div>

              <div className="sec">
                <div className="sh">Obiectiv de carieră</div>
                <div className="sb">
                  <div className="fld">
                    <textarea rows={2} value={form.careerGoal} onChange={(e) => upd({ careerGoal: e.target.value })} maxLength={300} />
                    <div className="hint">{form.careerGoal.length}/300</div>
                  </div>
                </div>
              </div>

              <div className="sec">
                <div className="sh">
                  Rezultate competiții
                  {form.skateResultsSlug && <span className="lbl">conectat</span>}
                </div>
                <div className="sb">
                  {form.skateResultsSlug ? (
                    <div className="fld">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                          <b>{skateLinked?.display_name ?? form.skateResultsSlug}</b>
                          <div className="hint">
                            {[skateLinked?.nation, skateLinked?.club].filter(Boolean).join(' · ')}
                            {typeof skateLinked?.events_count === 'number' ? ` · ${skateLinked.events_count} competiții` : ''}
                            {skateLinked?.coach ? ` · antrenor ${skateLinked.coach}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            upd({ skateResultsSlug: '' });
                            setSkateCands([]);
                            setSkateSearched(false);
                          }}
                        >
                          Deconectează
                        </button>
                      </div>
                      <div className="hint" style={{ marginTop: 6 }}>slug: {form.skateResultsSlug}</div>
                      <div style={{ marginTop: 12, borderTop: '1px solid #ececef', paddingTop: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Istoric competițional</div>
                        <div className="hint" style={{ marginBottom: 8 }}>
                          Lipește linkul rinkresults al sportivului; importăm fiecare competiție din rezultatele oficiale (~4s fiecare, poate dura câteva minute).
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            placeholder="https://www.rinkresults.com/skater?skater_id=15448"
                            value={rrId}
                            onChange={(e) => setRrId(e.target.value)}
                          />
                          <button type="button" className="btn pri" onClick={() => importHistory(true)} disabled={importingHist || !rrId.trim()}>
                            {histProgress
                              ? `Import ${histProgress.done}/${histProgress.total}…`
                              : importingHist
                                ? 'Se caută…'
                                : 'Importă din link'}
                          </button>
                        </div>
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button type="button" className="btn" onClick={() => importHistory(false)} disabled={importingHist}>
                            Încearcă după nume
                          </button>
                          <span className="hint">(mai puțin sigur — poate eșua de pe server)</span>
                        </div>
                        {histLog.length > 0 && (
                          <div style={{ marginTop: 10, maxHeight: 200, overflowY: 'auto', border: '1px solid #ececef', borderRadius: 5 }}>
                            {histLog.map((l, i) => (
                              <div
                                key={i}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  gap: 10,
                                  padding: '5px 10px',
                                  fontSize: 12,
                                  borderTop: i ? '1px solid #f1f1f3' : 'none',
                                }}
                              >
                                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                                <span style={{ flex: 'none', fontWeight: 600, color: l.ok ? '#1f7a4d' : '#be3330' }}>
                                  {l.ok ? 'importat' : 'nerezolvat'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {showRrFallback && (
                          <div className="hint" style={{ marginTop: 8, color: '#be3330' }}>
                            Nu l-am găsit după nume (de pe server). Folosește linkul rinkresults de mai sus.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="fld">
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          placeholder="Caută sportiv după nume"
                          value={skateQuery}
                          onChange={(e) => setSkateQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              runSkateSearch();
                            }
                          }}
                        />
                        <button type="button" className="btn" onClick={runSkateSearch} disabled={skateSearching}>
                          {skateSearching ? 'Se caută…' : 'Caută'}
                        </button>
                      </div>
                      {skateSearched && !skateSearching && skateCands.length === 0 && (
                        <div className="hint" style={{ marginTop: 8 }}>
                          Niciun rezultat. Sportivul apare doar dacă o competiție de-a lui a fost preluată în skate-results.
                        </div>
                      )}
                      {skateCands.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                          {skateCands.map((c: any) => (
                            <button
                              type="button"
                              key={c.slug ?? c.id}
                              onClick={() => upd({ skateResultsSlug: c.slug ?? String(c.id) })}
                              style={{
                                textAlign: 'left',
                                border: '1px solid #dcdcdc',
                                borderRadius: 5,
                                padding: '8px 12px',
                                background: '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                              }}
                            >
                              <b>{c.display_name}</b>
                              <span className="hint">
                                {[c.nation, c.club].filter(Boolean).join(' · ')}
                                {typeof c.events_count === 'number' ? ` · ${c.events_count} competiții` : ''}
                                {typeof c.best_total === 'number' ? ` · max ${c.best_total.toFixed(2)}` : ''}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="sec">
                <div className="sh">
                  Galerie
                  <span className="lbl">{form.gallery.length} imagini</span>
                </div>
                <div className="sb">
                  <div className="gal">
                    {form.gallery.map((g, i) => (
                      <div className="gi" key={`${g.id}-${i}`} style={{ backgroundImage: `url(${g.url})` }}>
                        <button type="button" className="x" aria-label="Elimină" onClick={() => upd({ gallery: form.gallery.filter((_, j) => j !== i) })}>
                          ✕
                        </button>
                      </div>
                    ))}
                    <button type="button" className="add" onClick={() => setMediaFor('gallery')} aria-label="Adaugă imagine">
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="sec">
                <div className="sh">
                  Programe pe sezon
                  <button type="button" className="addbtn" onClick={addSeason}>
                    + Adaugă sezon
                  </button>
                </div>
                <div className="sb">
                  {form.seasons.length === 0 && <div className="hint">Niciun sezon adăugat.</div>}
                  {form.seasons.map((s, si) => (
                    <div className="season" key={si}>
                      <div className="sthd">
                        <span className="lbl">Sezon</span>
                        <input placeholder="ex. 2024-2025" value={s.season} onChange={(e) => updSeason(si, { season: e.target.value })} />
                        <div style={{ flex: 1 }} />
                        <button type="button" className="btn sm danger" onClick={() => removeSeason(si)}>
                          Șterge sezon
                        </button>
                      </div>
                      <div className="sbody">
                        <table className="mini">
                          <thead>
                            <tr>
                              <th style={{ width: '38%' }}>Tip program</th>
                              <th>Titlu piesă</th>
                              <th className="act" />
                            </tr>
                          </thead>
                          <tbody>
                            {s.programs.map((p, pi) => (
                              <tr key={pi}>
                                <td>
                                  <select value={p.type} onChange={(e) => updProgram(si, pi, { type: e.target.value })}>
                                    {PROGRAM_TYPES.map((t) => (
                                      <option key={t} value={t}>
                                        {t}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <input value={p.title} placeholder="Titlu piesă" onChange={(e) => updProgram(si, pi, { title: e.target.value })} />
                                </td>
                                <td className="act">
                                  <button type="button" className="rm" aria-label="Șterge program" onClick={() => removeProgram(si, pi)}>
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="miniadd">
                          <button type="button" className="addbtn" onClick={() => addProgram(si)}>
                            + Adaugă program
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="pa">
            <button className="btn" type="button" onClick={() => navigate(SPORTIVI_TO)}>
              Înapoi
            </button>
            <div className="grow" />
            <button className="btn pri" type="button" onClick={save} disabled={saving}>
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        )}
      </div>

      {!loading && !error && (
        <button
          className="btn pri"
          type="button"
          onClick={save}
          disabled={saving}
          title="Salvează"
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 300,
            borderRadius: 999,
            padding: '12px 22px',
            boxShadow: '0 6px 20px rgba(20,26,54,.28)',
          }}
        >
          {saving ? 'Se salvează...' : 'Salvează'}
        </button>
      )}

      <MediaModal
        open={mediaFor !== null}
        onClose={() => setMediaFor(null)}
        onPick={(f) => {
          if (mediaFor === 'photo') upd({ photo: f });
          else if (mediaFor === 'gallery') upd({ gallery: [...form.gallery, f] });
          setMediaFor(null);
        }}
      />
    </div>
  );
}
