import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import {
  AdminPage,
  Window,
  PageHeader,
  TwoColumn,
  Section,
  Field,
  FieldRow,
  Input,
  Textarea,
  Select,
  DateInput,
  TagsInput,
  SearchableSelect,
  SegmentedControl,
  GalleryGrid,
  RepeatableList,
  Button,
  Chip,
  ChipList,
  StatusBadge,
  Notice,
  Loading,
  SaveBar,
  UnsavedGuard,
  releaseUnsavedGuards,
  useSaveState,
  adminToast,
  type GalleryImage,
} from '../ui';
import { usePageForm } from '../lib';
import { PROGRAM_TYPES } from './edusportUi';
import { SPORTIVI_TO, SPORTIV_EDIT_TO } from './menu';
import { SPORTIV_DELETE_COPY } from './SportiviPage';
import { ConfirmDialog } from '../ConfirmDialog';

/**
 * EduSport admin, custom "Sportiv" edit page (replaces the default
 * content-manager edit view for api::sportsperson.sportsperson).
 *
 * Two columns. Left rail: photo (single media), slug, activeSince, showPublicPage.
 * Right: name/description, story (blocks, edited as plain text), team & disciplines
 * (relation multi-selects), favoriteMoves/hobbies (json string arrays), careerGoal,
 * skate-results link + import, gallery (multiple media), seasons (repeatable
 * component with per-season programs).
 *
 * Reads scalars + media via content-manager GET; relations via the dedicated
 * content-manager relations endpoint (list GET returns counts only). Writes via
 * content-manager PUT/POST: media as numeric file ids, relations as { set:[{id}] },
 * story converted between the blocks structure and plain text, then publishes
 * through /api/sportspeople/:id/publish.
 *
 * Built on the shared admin UI (src/admin/ui): usePageForm keeps the working
 * copy and the dirty flag against the loaded profile, the floating SaveBar
 * saves (Cmd/Ctrl+S), UnsavedGuard asks before leaving with edits.
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
// Mirrors skate-results/app/schemas.py JobOut, so a renamed field fails the
// build here instead of silently blanking a row in the panel.
interface SkateJob {
  id: number;
  state: string;
  skater_slug?: string | null;
  discovered: number;
  existing: number;
  to_download: number;
  downloaded: number;
  current_name?: string | null;
  failures: { name?: string | null; competition_id?: string | null; reason?: string | null }[];
  error?: string | null;
  queue_position?: number | null;
  estimate_seconds?: number | null;
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
  photo: GalleryImage | null;
  gallery: GalleryImage[];
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

const ACTIVE_JOB_STATES = ['queued', 'discovering', 'comparing', 'downloading'];
const PROGRAM_OPTIONS = PROGRAM_TYPES.map((t) => ({ value: t, label: t }));
const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'hidden', label: 'Ascuns' },
] as const;

// Page-local styles, tokens only (var(--theme-*), var(--ui-*)). No backticks
// inside: one stray backtick in a template literal blanks the admin panel.
const SPORTIV_CSS = `
.ui-root .sp-rel{display:flex;flex-direction:column;gap:var(--ui-space-2)}
.ui-root .sp-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.ui-root .sp-name{font-weight:700;color:var(--theme-text)}
.ui-root .sp-hist{margin-top:12px;border-top:1px solid var(--theme-border);padding-top:12px}
.ui-root .sp-hist-title{font-size:12px;font-weight:600;margin-bottom:6px;color:var(--theme-text)}
.ui-root .sp-state{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.ui-root .sp-state b{font-size:13px;color:var(--theme-text)}
.ui-root .sp-bar{height:4px;background:var(--theme-surface-sunken);overflow:hidden;margin-top:8px}
.ui-root .sp-bar > span{display:block;height:100%;background:var(--theme-primary)}
.ui-root .sp-bar[data-tone="success"] > span{background:var(--theme-success)}
.ui-root .sp-bar[data-tone="danger"] > span{background:var(--theme-danger)}
.ui-root .sp-fail{margin-top:10px;border-left:2px solid var(--theme-danger);background:var(--theme-danger-bg);padding:7px 10px}
.ui-root .sp-fail-h{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--theme-danger);font-weight:700;margin-bottom:3px}
.ui-root .sp-fail-row{display:flex;justify-content:space-between;gap:10px;padding:1px 0;color:var(--theme-text)}
.ui-root .sp-fail-row span:last-child{color:var(--theme-danger);font-size:12px}
.ui-root .sp-acts{margin-top:12px}
.ui-root .sp-search{display:flex;gap:8px}
.ui-root .sp-search .ui-input{flex:1;min-width:0}
.ui-root .sp-cands{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.ui-root .sp-cand{text-align:left;font:inherit;color:var(--theme-text);border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);padding:8px 12px;background:var(--theme-surface);cursor:pointer;display:flex;flex-direction:column;gap:2px}
.ui-root .sp-cand:hover{border-color:var(--theme-primary);background:var(--theme-primary-soft)}
.ui-root .sp-cand:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
.ui-root .sp-season{display:flex;flex-direction:column;gap:var(--ui-space-3)}
.ui-root .sp-season-h{max-width:240px}
`;

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
function fileOf(m: any): GalleryImage | null {
  if (!m || typeof m !== 'object' || typeof m.id !== 'number') return null;
  return { id: m.id, url: m.url, name: m.name ?? null, thumbnailUrl: m.formats?.thumbnail?.url ?? undefined, mime: m.mime };
}

function toForm(e: any, dRes: any, cRes: any, chRes: any): FormState {
  const seasons: SeasonRow[] = Array.isArray(e?.seasons)
    ? e.seasons.map((s: any) => ({
        season: s?.season ?? '',
        programs: Array.isArray(s?.programs)
          ? s.programs.map((p: any) => ({ type: p?.type ?? PROGRAM_TYPES[0], title: p?.title ?? '', artist: p?.artist ?? null }))
          : [],
      }))
    : [];
  return {
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
    gallery: Array.isArray(e?.gallery) ? (e.gallery.map(fileOf).filter(Boolean) as GalleryImage[]) : [],
    disciplines: dRes ? relResults(dRes) : [],
    coaches: cRes ? relResults(cRes) : [],
    choreographers: chRes ? relResults(chRes) : [],
    seasons,
    skateResultsSlug: e?.skateResultsSlug ?? '',
  };
}

function buildBody(form: FormState) {
  return {
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
  };
}

// ---- skate-results import status --------------------------------------------
interface SkateStatus {
  active: boolean;
  held: number;
  label: string;
  value: string | null;
  detail: string | null;
  pct: number;
  tone: 'primary' | 'success' | 'danger';
}

const minuteWord = (n: number) => (n === 1 ? 'minut' : 'minute');

function skateStatus(job: SkateJob | null, linked: any): SkateStatus {
  const s = job?.state ?? '';
  const active = ACTIVE_JOB_STATES.includes(s);
  const minutes = job?.estimate_seconds ? Math.max(1, Math.round(job.estimate_seconds / 60)) : null;

  // With no job row the panel used to claim "Neimportat", which is wrong for
  // every skater imported before jobs existed: the state reflects the job, not
  // the data. Fall back to what we actually hold for this skater.
  const held = typeof linked?.events_count === 'number' ? linked.events_count : 0;
  let label = held > 0 ? 'Importat' : 'Neimportat';
  let value: string | null =
    held > 0 ? `${held} ${held === 1 ? 'competiție' : 'competiții'}` : linked?.rinkresults_id ? `id sursă ${linked.rinkresults_id}` : null;
  let detail: string | null = null;
  let pct = 0;

  if (job) {
    if (s === 'queued') {
      label = 'În așteptare';
      value = `${job.queue_position} în listă`;
      detail = minutes ? `Start în aproximativ ${minutes} ${minuteWord(minutes)}` : null;
    } else if (s === 'discovering' || s === 'comparing') {
      label = 'Verificare date existente';
      value = job.discovered ? `${job.discovered} competiții` : null;
      pct = 8;
    } else if (s === 'downloading') {
      label = 'Descărcare';
      value = minutes ? `${minutes} ${minuteWord(minutes)} rămase` : null;
      detail = `${job.downloaded ?? 0}/${job.to_download ?? 0} competiții descărcate`;
      pct = job.to_download ? Math.min(100, ((job.downloaded ?? 0) / job.to_download) * 100) : 0;
    } else if (s === 'done' || s === 'cancelled') {
      label = s === 'cancelled' ? 'Anulat' : 'Finalizat';
      value = `${job.downloaded ?? 0} competiții noi`;
      detail = `${(job.existing ?? 0) + (job.downloaded ?? 0)} competiții în total`;
      pct = 100;
    } else if (s === 'interrupted') {
      // Partial like a failure, not a green success: the worker stopped mid
      // run, the counts are not final.
      label = 'Întrerupt';
      value = `${job.downloaded ?? 0} competiții noi`;
      detail = `${(job.existing ?? 0) + (job.downloaded ?? 0)} competiții în total`;
      pct = 100;
    } else if (s === 'failed') {
      label = 'Eșuat';
      detail = job.error ?? null;
      pct = 100;
    }
  }

  const tone = s === 'failed' || s === 'interrupted' || job?.failures?.length ? 'danger' : pct === 100 ? 'success' : 'primary';
  return { active, held, label, value, detail, pct, tone };
}

// ---- relation multi-select (chips + searchable add) ---------------------------
function RelationField({ label, value, options, onChange }: { label: string; value: Opt[]; options: Opt[]; onChange: (next: Opt[]) => void }) {
  const chosen = new Set(value.map((v) => v.id));
  const pool = options.filter((o) => !chosen.has(o.id)).map((o) => ({ value: String(o.id), label: o.name }));
  return (
    <Field label={label}>
      <div className="sp-rel">
        {value.length > 0 && (
          <ChipList>
            {value.map((v) => (
              <Chip key={v.id} onRemove={() => onChange(value.filter((x) => x.id !== v.id))}>
                {v.name}
              </Chip>
            ))}
          </ChipList>
        )}
        <SearchableSelect
          value={null}
          clearable={false}
          options={pool}
          placeholder="Caută și adaugă..."
          onChange={(val) => {
            const o = options.find((x) => String(x.id) === val);
            if (o) onChange([...value, o]);
          }}
        />
      </div>
    </Field>
  );
}

export default function SportivEditPage() {
  const { get, put, post, del } = useFetchClient();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search || window.location.search);
  const id = params.get('id') || '';
  const isNew = !id;

  const save = useSaveState();
  const [loaded, setLoaded] = React.useState<FormState>(EMPTY);
  const form = usePageForm<FormState>(loaded, save);
  const v = form.value;
  const upd = form.patch;

  const [loading, setLoading] = React.useState(!isNew);
  const [error, setError] = React.useState(false);
  const [showErrors, setShowErrors] = React.useState(false);
  // documentId whose data `loaded` holds, so the URL change after a create
  // does not reload what the save already fetched.
  const loadedFor = React.useRef<string>('');

  const [disciplineOpts, setDisciplineOpts] = React.useState<Opt[]>([]);
  const [teamOpts, setTeamOpts] = React.useState<Opt[]>([]);

  // skate-results linker
  const [skateQuery, setSkateQuery] = React.useState('');
  const [skateCands, setSkateCands] = React.useState<any[]>([]);
  const [skateSearching, setSkateSearching] = React.useState(false);
  const [skateSearched, setSkateSearched] = React.useState(false);
  const [skateLinked, setSkateLinked] = React.useState<any | null>(null);

  // Preview of the currently linked skate-results skater (name/club/counts).
  React.useEffect(() => {
    const slug = v.skateResultsSlug;
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
  }, [v.skateResultsSlug, get]);

  // Seed the search box with the athlete's name once it loads.
  React.useEffect(() => {
    if (v.name && !skateQuery) setSkateQuery(v.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.name]);

  const runSkateSearch = async () => {
    const q = (skateQuery || v.name).trim();
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

  // The import runs on the server. This only creates the job and then asks how
  // it is going, so closing the page does not abandon the work.
  const [job, setJob] = React.useState<SkateJob | null>(null);

  const pollJob = React.useCallback(
    async (jobId: number) => {
      try {
        const res: any = await get(`/api/skate/jobs/${jobId}`);
        // A response that is not a job (an error body from a degraded proxy
        // call, for instance) must not overwrite the last known good state;
        // otherwise a single failed poll looks like the import vanished.
        if (typeof res?.data?.state === 'string') setJob(res.data);
      } catch {
        // A failed poll is not a failed import; keep the last known state.
      }
    },
    [get],
  );

  // Reattach on mount: an import started earlier may still be running.
  React.useEffect(() => {
    if (!v.skateResultsSlug) return;
    get(`/api/skate/jobs?skater=${encodeURIComponent(v.skateResultsSlug)}&active=1`)
      .then((res: any) => setJob(res?.data?.[0] ?? null))
      .catch(() => {});
  }, [get, v.skateResultsSlug]);

  // Poll only while something is happening.
  React.useEffect(() => {
    if (!job || !ACTIVE_JOB_STATES.includes(job.state)) return;
    const t = setInterval(() => pollJob(job.id), 2000);
    return () => clearInterval(t);
  }, [job, pollJob]);

  const [starting, setStarting] = React.useState(false);

  const startImport = async () => {
    setStarting(true);
    try {
      const res: any = await post('/api/skate/jobs', {
        slug: v.skateResultsSlug,
        rinkresults_id: skateLinked?.rinkresults_id,
      });
      setJob(res?.data ?? null);
    } catch {
      adminToast.error('Nu am putut porni importul.');
    } finally {
      setStarting(false);
    }
  };

  const cancelImport = async () => {
    if (!job) return;
    try {
      const res: any = await post(`/api/skate/jobs/${job.id}/cancel`, {});
      setJob(res?.data ?? null);
    } catch {
      /* the next poll will show the truth */
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

  const fetchEntry = React.useCallback(
    async (docId: string): Promise<FormState> => {
      const [main, dRes, cRes, chRes]: any[] = await Promise.all([
        get(`${CT}/${docId}`),
        get(REL(docId, 'disciplines')).catch(() => null),
        get(REL(docId, 'coaches')).catch(() => null),
        get(REL(docId, 'choreographers')).catch(() => null),
      ]);
      return toForm(main?.data?.data ?? main?.data, dRes, cRes, chRes);
    },
    [get],
  );

  React.useEffect(() => {
    if (isNew) {
      loadedFor.current = '';
      setLoaded(EMPTY);
      setLoading(false);
      setError(false);
      return;
    }
    if (loadedFor.current === id) return;
    let off = false;
    setLoading(true);
    setError(false);
    fetchEntry(id)
      .then((f) => {
        if (off) return;
        loadedFor.current = id;
        setLoaded(f);
      })
      .catch(() => !off && setError(true))
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
  }, [id, isNew, fetchEntry]);

  const nameMissing = !v.name.trim();

  const onSave = () => {
    if (nameMissing) {
      setShowErrors(true);
      adminToast.error('Numele este obligatoriu.');
      return;
    }
    setShowErrors(false);
    const body = buildBody(v);
    // Save updates the draft; publishing makes it live (visibility is still
    // gated by the Public/Ascuns toggle). Publish failure never blocks the save.
    // The draft is already persisted by the POST/PUT; the publish action just
    // promotes it. It rejects the update-shaped body (relations as {set:...}),
    // so send an empty payload.
    const publish = async (docId: string) => {
      try {
        await post(`/api/sportspeople/${docId}/publish`, {});
      } catch {
        /* leave as draft if publish endpoint is unavailable */
      }
    };
    let createdId: string | null = null;
    void save
      .run(async () => {
        if (isNew) {
          const res: any = await post(CT, body);
          const newId = (res?.data?.data ?? res?.data)?.documentId;
          if (newId) {
            await publish(newId);
            const fresh = await fetchEntry(newId).catch(() => null);
            if (fresh) {
              loadedFor.current = newId;
              setLoaded(fresh);
            }
            createdId = newId;
          }
        } else {
          await put(`${CT}/${id}`, body);
          await publish(id);
          const fresh = await fetchEntry(id);
          loadedFor.current = id;
          setLoaded(fresh);
        }
      }, 'Salvarea a eșuat. Verifică datele și încearcă din nou.')
      .then((ok) => {
        if (ok && createdId) {
          releaseUnsavedGuards();
          navigate(`${SPORTIV_EDIT_TO}?id=${createdId}`, { replace: true });
        }
      });
  };

  const discard = () => {
    setShowErrors(false);
    form.reset();
  };

  // Permanent delete (edit mode only), same content-manager collection path
  // the save above PUTs to, keyed by documentId.
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [delError, setDelError] = React.useState<string | null>(null);

  const closeConfirm = React.useCallback(() => {
    if (deleting) return; // never dismiss mid-request
    setConfirmOpen(false);
    setDelError(null);
  }, [deleting]);

  const confirmDelete = async () => {
    if (!id) return;
    setDeleting(true);
    setDelError(null);
    try {
      await del(`${CT}/${id}`);
      setConfirmOpen(false);
      releaseUnsavedGuards();
      navigate(SPORTIVI_TO, { replace: true });
    } catch {
      setDelError('Ștergerea a eșuat.');
    } finally {
      setDeleting(false);
    }
  };

  const ready = !loading && !error;
  const status = skateStatus(job, skateLinked);

  const rail = (
    <div className="ui-stack">
      <Field label="Fotografie">
        <GalleryGrid
          slots={1}
          columns={1}
          images={[v.photo]}
          slotLabels={['Fotografie']}
          onChange={(tiles) => upd({ photo: tiles[0] ?? null })}
        />
      </Field>
      <Field label="Slug" hint="Se generează din nume dacă e gol.">
        <Input value={v.slug} onChange={(e) => upd({ slug: e.target.value })} placeholder="ex. nume-sportiv" />
      </Field>
      <Field label="Activ din">
        <DateInput value={v.activeSince || null} onChange={(d) => upd({ activeSince: d ?? '' })} />
      </Field>
      <div className="ui-field">
        <span className="ui-label" id="sp-vis-label">
          Vizibilitate pe site
        </span>
        <SegmentedControl
          aria-labelledby="sp-vis-label"
          options={[...VISIBILITY_OPTIONS]}
          value={v.showPublicPage ? 'public' : 'hidden'}
          onChange={(next) => upd({ showPublicPage: next === 'public' })}
        />
      </div>
    </div>
  );

  return (
    <AdminPage>
      <style>{SPORTIV_CSS}</style>
      <Window>
        <PageHeader
          back={{ to: SPORTIVI_TO, label: 'Sportivi' }}
          title={isNew ? 'Adaugă sportiv' : 'Editează sportiv'}
          subtitle={isNew ? 'Completează profilul noului sportiv.' : loaded.name}
          actions={
            ready && !isNew ? (
              <Button
                variant="danger"
                title="Șterge sportivul definitiv"
                onClick={() => {
                  setDelError(null);
                  setConfirmOpen(true);
                }}
                disabled={save.saving || deleting}
              >
                Șterge sportiv
              </Button>
            ) : undefined
          }
        />

        {loading ? (
          <Loading />
        ) : error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca sportivul.</Notice>
          </div>
        ) : (
          <TwoColumn rail={rail} railLabel="Profil">
            <Section title="Identitate">
              <div className="ui-stack">
                <Field label="Nume" required error={showErrors && nameMissing ? 'Numele este obligatoriu.' : undefined}>
                  <Input value={v.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Nume și prenume" />
                </Field>
                <Field label="Descriere scurtă">
                  <Textarea rows={2} value={v.description} onChange={(e) => upd({ description: e.target.value })} />
                </Field>
              </div>
            </Section>

            <Section title="Poveste">
              <Field label="Text poveste" hint="Fiecare rând nou devine un paragraf pe site.">
                <Textarea
                  rows={6}
                  value={v.storyText}
                  onChange={(e) => upd({ storyText: e.target.value })}
                  placeholder="Fiecare rând devine un paragraf."
                />
              </Field>
            </Section>

            <Section title="Echipă și discipline">
              <div className="ui-stack">
                <RelationField label="Discipline" value={v.disciplines} options={disciplineOpts} onChange={(next) => upd({ disciplines: next })} />
                <RelationField label="Antrenori" value={v.coaches} options={teamOpts} onChange={(next) => upd({ coaches: next })} />
                <RelationField label="Coregrafi" value={v.choreographers} options={teamOpts} onChange={(next) => upd({ choreographers: next })} />
              </div>
            </Section>

            <Section title="Mișcări și hobby-uri">
              <div className="ui-stack">
                <Field label="Mișcări preferate">
                  <TagsInput value={v.favoriteMoves} onChange={(next) => upd({ favoriteMoves: next })} placeholder="Mișcare, apasă Enter" />
                </Field>
                <Field label="Hobby-uri">
                  <TagsInput value={v.hobbies} onChange={(next) => upd({ hobbies: next })} placeholder="Hobby, apasă Enter" />
                </Field>
              </div>
            </Section>

            <Section title="Obiectiv de carieră">
              <Field label="Obiectiv de carieră" hideLabel hint={`${v.careerGoal.length}/300`}>
                <Textarea rows={2} value={v.careerGoal} onChange={(e) => upd({ careerGoal: e.target.value })} maxLength={300} />
              </Field>
            </Section>

            <Section
              title="Rezultate competiții"
              aside={v.skateResultsSlug ? <StatusBadge tone="success">conectat</StatusBadge> : undefined}
            >
              {v.skateResultsSlug ? (
                <div>
                  <div className="sp-row">
                    <div>
                      <div className="sp-name">{skateLinked?.display_name ?? v.skateResultsSlug}</div>
                      <div className="ui-hint">
                        {[skateLinked?.nation, skateLinked?.club].filter(Boolean).join(' · ')}
                        {typeof skateLinked?.events_count === 'number' ? ` · ${skateLinked.events_count} competiții` : ''}
                        {skateLinked?.coach ? ` · antrenor ${skateLinked.coach}` : ''}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        upd({ skateResultsSlug: '' });
                        setSkateCands([]);
                        setSkateSearched(false);
                      }}
                    >
                      Deconectează
                    </Button>
                  </div>
                  <div className="ui-hint" style={{ marginTop: 6 }}>
                    slug: {v.skateResultsSlug}
                  </div>
                  <div className="sp-hist">
                    <div className="sp-hist-title">Istoric competițional</div>
                    <div className="sp-state">
                      <b>{status.label}</b>
                      {status.value && <span className="ui-hint">{status.value}</span>}
                    </div>
                    {status.detail && (
                      <div className="ui-hint" style={{ marginTop: 4 }}>
                        {status.detail}
                      </div>
                    )}
                    {(status.active || status.pct === 100) && (
                      <div className="sp-bar" data-tone={status.tone} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(status.pct)}>
                        <span style={{ width: `${status.pct}%` }} />
                      </div>
                    )}
                    {!!job?.failures?.length && (
                      <div className="sp-fail">
                        <div className="sp-fail-h">Nedescărcate</div>
                        {job.failures.map((f, i) => (
                          <div key={i} className="sp-fail-row">
                            <span>{f.name}</span>
                            <span>{f.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="sp-acts">
                      <Button
                        variant={status.active ? 'secondary' : 'primary'}
                        onClick={status.active ? cancelImport : startImport}
                        disabled={!status.active && starting}
                      >
                        {status.active
                          ? job?.state === 'queued'
                            ? 'Anulează'
                            : 'Oprește'
                          : job || status.held > 0
                            ? 'Importă din nou'
                            : 'Importă'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="sp-search">
                    <Input
                      aria-label="Caută sportiv după nume"
                      placeholder="Caută sportiv după nume"
                      value={skateQuery}
                      onChange={(e) => setSkateQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void runSkateSearch();
                        }
                      }}
                    />
                    <Button variant="secondary" onClick={runSkateSearch} disabled={skateSearching} loading={skateSearching}>
                      {skateSearching ? 'Se caută…' : 'Caută'}
                    </Button>
                  </div>
                  {skateSearched && !skateSearching && skateCands.length === 0 && (
                    <div className="ui-hint" style={{ marginTop: 8 }}>
                      Niciun rezultat. Sportivul apare doar dacă o competiție de-a lui a fost preluată în skate-results.
                    </div>
                  )}
                  {skateCands.length > 0 && (
                    <div className="sp-cands">
                      {skateCands.map((c: any) => (
                        <button type="button" className="sp-cand" key={c.slug ?? c.id} onClick={() => upd({ skateResultsSlug: c.slug ?? String(c.id) })}>
                          <span className="sp-name">{c.display_name}</span>
                          <span className="ui-hint">
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
            </Section>

            <Section title="Galerie" aside={<StatusBadge tone="neutral">{`${v.gallery.length} imagini`}</StatusBadge>}>
              <GalleryGrid images={v.gallery} onChange={(next) => upd({ gallery: next })} addLabel="Adaugă imagine" aria-label="Galerie" confirmRemove="Imaginea nu va mai apărea în galeria sportivului." />
            </Section>

            <Section title="Programe pe sezon">
              <RepeatableList<SeasonRow>
                items={v.seasons}
                onChange={(next) => upd({ seasons: next })}
                getKey={(_, i) => i}
                itemLabel={(s, i) => (s.season ? `sezonul ${s.season}` : `sezonul ${i + 1}`)}
                newItem={() => ({ season: '', programs: [] })}
                addLabel="Adaugă sezon"
                emptyLabel="Niciun sezon adăugat."
                confirmDelete="Sezonul și programele lui dispar din profil după ce salvezi."
                aria-label="Sezoane"
                renderRow={(s, _i, row) => (
                  <div className="sp-season">
                    <Field label="Sezon" className="sp-season-h">
                      <Input placeholder="ex. 2024-2025" value={s.season} onChange={(e) => row.update({ season: e.target.value })} />
                    </Field>
                    <RepeatableList<ProgramRow>
                      items={s.programs}
                      onChange={(programs) => row.update({ programs })}
                      getKey={(_, i) => i}
                      itemLabel={(p, i) => (p.title ? `programul ${p.title}` : `programul ${i + 1}`)}
                      newItem={() => ({ type: PROGRAM_TYPES[0], title: '', artist: null })}
                      addLabel="Adaugă program"
                      aria-label="Programe"
                      renderRow={(p, _j, prow) => (
                        <FieldRow>
                          <Field label="Tip program">
                            <Select value={p.type} options={PROGRAM_OPTIONS} onChange={(t) => prow.update({ type: t })} />
                          </Field>
                          <Field label="Titlu piesă">
                            <Input value={p.title} placeholder="Titlu piesă" onChange={(e) => prow.update({ title: e.target.value })} />
                          </Field>
                        </FieldRow>
                      )}
                    />
                  </div>
                )}
              />
            </Section>
          </TwoColumn>
        )}

        {ready && <SaveBar {...save.bar} onSave={onSave} onDiscard={discard} />}
      </Window>

      <ConfirmDialog
        open={confirmOpen}
        title={SPORTIV_DELETE_COPY.title}
        message={SPORTIV_DELETE_COPY.message(loaded.name)}
        busy={deleting}
        error={delError}
        onCancel={closeConfirm}
        onConfirm={confirmDelete}
      />
      <UnsavedGuard when={form.dirty} />
    </AdminPage>
  );
}
