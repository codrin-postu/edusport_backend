import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { EDU_CSS } from './edusportUi';
import { DASHBOARD_TO } from './menu';
import { ConfirmDialog } from '../ConfirmDialog';
import { MediaModal } from './MediaPicker';

/**
 * EduSport admin — custom "Pagina principală" page (replaces the default
 * content-manager single-type view for api::homepage.homepage).
 *
 * Single column on purpose: the admin already has a fixed 236px sidebar, and
 * the narrow rail on the sportsperson editor exists for record properties
 * (photo, slug, visibility) which a single type does not have.
 *
 * The four content fields are plain json columns, so they are read and written
 * whole. Anything the editor does not know about is preserved by spreading the
 * loaded object, so an unexpected key is never silently dropped.
 *
 * homepage has draftAndPublish disabled, so there is no publish call after save.
 *
 * Three things this editor does beyond plain fields:
 *
 * 1. Înscrieri deschise / închise are tabs, not two stacked blocks. The site
 *    shows exactly one of them, chosen by site-settings registration.open, so
 *    the tab of the published variant is marked and opened first.
 * 2. Locația and the WhatsApp channel already live in Setări site. When the
 *    homepage field is empty it inherits that value read-only, with an explicit
 *    opt-in override. An existing local value is never overwritten; it is only
 *    flagged when it drifted away from the setting.
 * 3. Statisticile are no longer typed here. They come from "Cifre club"
 *    (api::club-figures.club-figures), one shared ordered list, and the page
 *    picks which of them it shows.
 */

const CT = '/content-manager/single-types/api::homepage.homepage';
const SITE_SETTINGS_CT = '/content-manager/single-types/api::site-settings.site-settings';
const SITE_SETTINGS_TO = '/content-manager/single-types/api::site-settings.site-settings';
const ARTICLES_TO = '/content-manager/collection-types/api::article.article';
const SPORTSPEOPLE_CT = '/content-manager/collection-types/api::sportsperson.sportsperson';
// Cifre club is hidden from the content-manager; this guarded admin route is
// the only way in. See src/api/club-figures/routes/02-admin.ts.
const FIGURES_API = '/api/cifre-club';

// ---------------------------------------------------------------------------
// Shapes. These mirror exactly what the frontend reads; see
// edusport_frontend/src/app/landing-v2/_types.ts.
// ---------------------------------------------------------------------------

type Hero = { ctaLabel?: string; ctaUrl?: string };

type Registration = {
  heading?: string;
  body?: string;
  bodySecondary?: string;
  scheduleDays?: string;
  scheduleTimes?: string;
  locationName?: string;
  ctaPrimaryLabel?: string;
  ctaPrimaryUrl?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?: string;
  pricesLinkLabel?: string;
  pricesLinkUrl?: string;
};

type RegistrationClosed = {
  heading?: string;
  body?: string;
  whatsappLabel?: string;
  whatsappUrl?: string;
  contactLabel?: string;
  contactUrl?: string;
};

type AboutPanel = {
  eyebrow?: string;
  heading?: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

type About = { panels?: AboutPanel[] };

type StatItem = { value?: string; label?: string };

type Sections = {
  gallery?: {
    heading?: string;
  };
  athletes?: {
    heading?: string;
    intro?: string;
    countLabel?: string;
    ctaLabel?: string;
    ctaUrl?: string;
  };
  /** Legacy inline list. Kept untouched as the site's fallback. */
  stats?: StatItem[];
  /** Ids into Cifre club, in display order. */
  statIds?: string[];
};

/** One picked image, or an empty slot. */
type GalleryImage = { id: number; url: string } | null;

type Form = {
  competitionGallery: GalleryImage[];
  hero: Hero;
  registration: Registration;
  registrationClosed: RegistrationClosed;
  about: About;
  sections: Sections;
};

type Figure = { id: string; value: string; label: string };

type SiteContact = { addressDisplay?: string; whatsappChannelUrl?: string };

const EMPTY: Form = {
  competitionGallery: [null, null, null],
  hero: {},
  registration: {},
  registrationClosed: {},
  about: { panels: [] },
  sections: { gallery: {}, athletes: {}, stats: [], statIds: [] },
};

// The About layout is built for exactly three panels; a fourth would not render.
const ABOUT_PANELS = 3;

// The competition strip on the site shows exactly these three images.
const GALLERY_SLOTS = 3;

/** Media entry to the {id, url} pair the slots render and the save sends. */
function galleryFileOf(m: any): GalleryImage {
  if (!m || typeof m !== 'object' || typeof m.id !== 'number') return null;
  return { id: m.id, url: m.formats?.thumbnail?.url ?? m.url };
}

// Same rule as the server (src/api/club-figures/controllers/club-figures.ts), so
// an id generated here survives the round trip unchanged.
const slugify = (raw: string): string =>
  String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

const PAGE_CSS = `
.eduf .tabs{display:flex;gap:3px;border-bottom:1px solid var(--line);margin:0 0 14px;flex-wrap:wrap}
.eduf .tabs .tab{font-family:inherit;font-size:12.5px;font-weight:600;color:#5a5e6b;background:none;border:none;border-bottom:2px solid transparent;padding:8px 14px;cursor:pointer;display:inline-flex;align-items:center;gap:7px}
.eduf .tabs .tab:hover{color:var(--ink)}
.eduf .tabs .tab.on{color:var(--accent);border-bottom-color:var(--accent);font-weight:700}
.eduf .tabs .tpill{font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;border-radius:3px;padding:2px 6px;background:#eef0f3;color:#5a5e6b}
.eduf .tabs .tab.on .tpill{background:var(--accent);color:#fff}
.eduf .inh{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11.5px;color:var(--muted);margin-top:5px}
.eduf .inh b{color:var(--ink);font-weight:600}
.eduf .inh .chip{font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;border-radius:3px;padding:2px 7px;background:var(--accent-soft);color:var(--accent);border:1px solid #cfd8f6}
.eduf .inh .chip.warn{background:#fbf1df;color:#7a4f00;border-color:#ecd9ac}
.eduf .inhval{width:100%;background:#f1f2f5;border:1px solid var(--fieldborder);border-radius:var(--r);padding:7px 9px;font-size:13px;color:#5a5e6b;min-height:33px;word-break:break-all}
.eduf .inhval.none{color:#a4a9b4}
.eduf .brkline{margin-top:6px;font-size:12px;color:var(--ink);line-height:2}
.eduf .brk{display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;font-weight:700;color:var(--accent);background:var(--accent-soft);border:1px solid #cfd8f6;border-radius:3px;padding:0 5px;margin:0 4px}
.eduf .prev{border:1px solid var(--fieldborder);border-radius:var(--r);padding:11px 12px;background:#fafbfc;margin-top:8px}
.eduf .prev .t{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;margin-bottom:6px}
.eduf .prev .h{font-size:20px;font-weight:800;line-height:1.15;color:#0e1a3c;letter-spacing:-.3px;white-space:pre-wrap}
.eduf .fig td.pickcell{width:1%;text-align:center}
.eduf .fig td.movecell{width:1%;white-space:nowrap;text-align:right}
.eduf .fig input[type=checkbox]{width:auto;accent-color:var(--accent);margin:0;cursor:pointer}
.eduf .fig .mv{cursor:pointer;border:1px solid var(--fieldborder);background:#fff;color:var(--muted);border-radius:var(--r);font-size:11px;line-height:1;padding:4px 6px;margin-left:3px;font-family:inherit}
.eduf .fig .mv:disabled{opacity:.35;cursor:default}
.eduf .fig tr.off td input[type=text]{color:var(--muted)}
`;

/**
 * A field whose value lives in Setări site. Read-only while the homepage value
 * is empty; the override is opt-in and never applied on its own.
 */
const InheritedField: React.FC<{
  label: string;
  value: string;
  inherited: string;
  overridden: boolean;
  settingsName: string;
  emptyNote?: string;
  onChange: (next: string) => void;
  onOverride: () => void;
  onUseSetting: () => void;
}> = ({
  label,
  value,
  inherited,
  overridden,
  settingsName,
  emptyNote,
  onChange,
  onOverride,
  onUseSetting,
}) => {
  const local = value.trim() !== '';
  const editing = local || overridden;
  const drifted = local && inherited.trim() !== '' && value.trim() !== inherited.trim();

  return (
    <div className="fld">
      <label>{label}</label>
      {editing ? (
        <>
          <input value={value} onChange={(e) => onChange(e.target.value)} />
          <div className="inh">
            {drifted ? (
              <>
                <span className="chip warn">Diferă de setări</span>
                <span>
                  În {settingsName} scrie <b>{inherited}</b>.
                </span>
                <button className="btn sm" type="button" onClick={onUseSetting}>
                  Folosește valoarea din setări
                </button>
              </>
            ) : (
              <>
                <span>Valoare scrisă doar pentru pagina principală.</span>
                <button className="btn sm" type="button" onClick={onUseSetting}>
                  Revino la valoarea din setări
                </button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className={`inhval${inherited.trim() === '' ? ' none' : ''}`}>
            {inherited.trim() === '' ? 'Nimic completat în ' + settingsName : inherited}
          </div>
          <div className="inh">
            <span className="chip">Din setări</span>
            <span>
              Se schimbă în <b>{settingsName}</b>, ca să nu existe două valori diferite.
              {emptyNote ? ' ' + emptyNote : ''}
            </span>
            <button className="btn sm" type="button" onClick={onOverride}>
              Suprascrie aici
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/** Shows the stored text with an explicit marker wherever a line break sits. */
const BreakMarkup: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="brkline">
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < lines.length - 1 && <span className="brk">rând nou</span>}
        </React.Fragment>
      ))}
    </div>
  );
};

const HomepageEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { get, put } = useFetchClient();

  const [form, setForm] = React.useState<Form>(EMPTY);
  // Everything the server returned, so keys this editor does not manage survive.
  const [raw, setRaw] = React.useState<Record<string, unknown>>({});
  const [figures, setFigures] = React.useState<Figure[]>([]);
  const [contact, setContact] = React.useState<SiteContact>({});
  const [registrationOpen, setRegistrationOpen] = React.useState<boolean | null>(null);
  const [athleteCount, setAthleteCount] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [regTab, setRegTab] = React.useState<'open' | 'closed'>('open');
  const [aboutTab, setAboutTab] = React.useState(0);
  const [overrideLocation, setOverrideLocation] = React.useState(false);
  const [overrideWhatsapp, setOverrideWhatsapp] = React.useState(false);
  const [figureToRemove, setFigureToRemove] = React.useState<number | null>(null);
  // Which of the three slots the picker is filling, null when it is closed.
  const [gallerySlot, setGallerySlot] = React.useState<number | null>(null);

  React.useEffect(() => {
    let off = false;
    (async () => {
      try {
        const r: any = await get(CT);
        if (off) return;
        const entry = r?.data?.data ?? r?.data ?? {};
        setRaw(entry);
        setForm({
          hero: entry.hero ?? {},
          registration: entry.registration ?? {},
          registrationClosed: entry.registrationClosed ?? {},
          about: { panels: entry.about?.panels ?? [] },
          competitionGallery: Array.from({ length: GALLERY_SLOTS }, (_, i) =>
            galleryFileOf((entry.competitionGallery ?? [])[i])
          ),
          sections: {
            gallery: entry.sections?.gallery ?? {},
            athletes: entry.sections?.athletes ?? {},
            stats: entry.sections?.stats ?? [],
            statIds: Array.isArray(entry.sections?.statIds) ? entry.sections.statIds : [],
          },
        });
      } catch {
        if (!off) setError(true);
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => {
      off = true;
    };
  }, [get]);

  // Setări site decides which registration variant is live, and holds the two
  // values the homepage inherits.
  React.useEffect(() => {
    let off = false;
    (async () => {
      try {
        const r: any = await get(SITE_SETTINGS_CT);
        if (off) return;
        const entry = r?.data?.data ?? r?.data ?? {};
        setContact(entry.contact ?? {});
        const open = entry.registration?.open;
        if (typeof open === 'boolean') {
          setRegistrationOpen(open);
          setRegTab(open ? 'open' : 'closed');
        }
      } catch {
        /* the editor still works without it; nothing is marked as live */
      }
    })();
    return () => {
      off = true;
    };
  }, [get]);

  React.useEffect(() => {
    let off = false;
    (async () => {
      try {
        const r: any = await get(FIGURES_API);
        if (off) return;
        const rows = r?.data?.data?.figures ?? r?.data?.figures;
        if (Array.isArray(rows)) {
          setFigures(
            rows.map((f: any) => ({
              id: String(f?.id ?? ''),
              value: String(f?.value ?? ''),
              label: String(f?.label ?? ''),
            })),
          );
        }
      } catch {
        /* figures stay empty; the section explains it could not load */
      }
    })();
    return () => {
      off = true;
    };
  }, [get]);

  // The public athlete count is derived, never typed. Shown read-only so nobody
  // goes looking for a field that does not exist.
  React.useEffect(() => {
    let off = false;
    (async () => {
      try {
        const r: any = await get(
          `${SPORTSPEOPLE_CT}?filters[showPublicPage][$eq]=true&pagination[pageSize]=1`,
        );
        if (off) return;
        const total = r?.data?.pagination?.total ?? r?.data?.meta?.pagination?.total;
        if (typeof total === 'number') setAthleteCount(total);
      } catch {
        /* the count is informational; a failure just leaves it unknown */
      }
    })();
    return () => {
      off = true;
    };
  }, [get]);

  const upd = <K extends keyof Form>(key: K, patch: Partial<Form[K]>) =>
    setForm((f) => ({ ...f, [key]: { ...(f[key] as object), ...patch } }));

  const updPanel = (i: number, patch: Partial<AboutPanel>) =>
    setForm((f) => {
      const panels = [...(f.about.panels ?? [])];
      panels[i] = { ...(panels[i] ?? {}), ...patch };
      return { ...f, about: { ...f.about, panels } };
    });

  const selected = React.useMemo(
    () => new Set(form.sections.statIds ?? []),
    [form.sections.statIds],
  );

  const setSelected = (next: Set<string>) =>
    setForm((f) => ({
      ...f,
      sections: {
        ...f.sections,
        // Display order follows the shared list, so the page cannot end up with
        // an order nobody chose.
        statIds: figures.filter((fig) => next.has(fig.id)).map((fig) => fig.id),
      },
    }));

  const toggleFigure = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const updFigure = (i: number, patch: Partial<Figure>) =>
    setFigures((rows) => rows.map((f, k) => (k === i ? { ...f, ...patch } : f)));

  const addFigure = () =>
    setFigures((rows) => {
      let id = 'cifra-noua';
      let n = 2;
      while (rows.some((f) => f.id === id)) {
        id = `cifra-noua-${n}`;
        n += 1;
      }
      return [...rows, { id, value: '', label: '' }];
    });

  const moveFigure = (i: number, dir: -1 | 1) =>
    setFigures((rows) => {
      const j = i + dir;
      if (j < 0 || j >= rows.length) return rows;
      const next = [...rows];
      const tmp = next[i];
      next[i] = next[j];
      next[j] = tmp;
      return next;
    });

  const removeFigure = (i: number) => {
    const gone = figures[i];
    setFigures((rows) => rows.filter((_, k) => k !== i));
    if (gone) {
      setForm((f) => ({
        ...f,
        sections: { ...f.sections, statIds: (f.sections.statIds ?? []).filter((id) => id !== gone.id) },
      }));
    }
    setFigureToRemove(null);
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      // Cifre club first: the homepage stores ids, so the ids have to exist.
      const cleaned = figures
        .map((f) => ({
          id: f.id || slugify(f.label) || slugify(f.value),
          value: f.value.trim(),
          label: f.label.trim(),
        }))
        .filter((f) => f.value !== '' || f.label !== '');

      const fr: any = await put(FIGURES_API, { figures: cleaned });
      const stored = fr?.data?.data?.figures ?? fr?.data?.figures;
      const storedFigures: Figure[] = Array.isArray(stored)
        ? stored.map((f: any) => ({
            id: String(f?.id ?? ''),
            value: String(f?.value ?? ''),
            label: String(f?.label ?? ''),
          }))
        : cleaned;
      setFigures(storedFigures);

      const statIds = storedFigures.filter((f) => selected.has(f.id)).map((f) => f.id);

      await put(CT, {
        hero: { ...(raw.hero as object), ...form.hero },
        registration: { ...(raw.registration as object), ...form.registration },
        registrationClosed: { ...(raw.registrationClosed as object), ...form.registrationClosed },
        about: { ...(raw.about as object), panels: form.about.panels ?? [] },
        sections: { ...(raw.sections as object), ...form.sections, statIds },
        competitionGallery: form.competitionGallery
          .filter((g): g is { id: number; url: string } => g !== null)
          .map((g) => g.id),
      });
      setForm((f) => ({ ...f, sections: { ...f.sections, statIds } }));
      setMsg({ kind: 'ok', text: 'Modificările au fost salvate.' });
    } catch {
      setMsg({ kind: 'err', text: 'Nu am putut salva. Încearcă din nou.' });
    } finally {
      setSaving(false);
    }
  };

  const panels = form.about.panels ?? [];
  const athletes = form.sections.athletes ?? {};
  const panel = panels[aboutTab] ?? {};
  const panelHeading = panel.heading ?? '';
  const inheritedLocation = contact.addressDisplay ?? '';
  const inheritedWhatsapp = contact.whatsappChannelUrl ?? '';

  // `pce` opts our "Salvează" button out of the global admin SaveBar tagger,
  // which would otherwise clip it to 1x1. See app.tsx.
  return (
    <div className="eduf pce">
      <style>{EDU_CSS}</style>
      <style>{PAGE_CSS}</style>
      <div className="win">
        <div className="hd">
          <div>
            <h1>Pagina principală</h1>
            <p>Textele de pe prima pagină a site-ului</p>
          </div>
          <div className="hd-right">
            <button className="btn" type="button" onClick={() => navigate(DASHBOARD_TO)}>
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
          <div className="empty">Nu am putut încărca pagina principală.</div>
        ) : (
          <div className="body">
            {/* ── Hero ── */}
            <div className="sec">
              <div className="sh">Hero</div>
              <div className="sb">
                <div className="row">
                  <div className="fld">
                    <label>Text buton</label>
                    <input
                      value={form.hero.ctaLabel ?? ''}
                      onChange={(e) => upd('hero', { ctaLabel: e.target.value })}
                    />
                  </div>
                  <div className="fld">
                    <label>Link buton</label>
                    <input
                      value={form.hero.ctaUrl ?? ''}
                      onChange={(e) => upd('hero', { ctaUrl: e.target.value })}
                    />
                  </div>
                </div>
                <div className="hint">
                  Titlul EDUSPORT și fundalul video nu se editează, fac parte din design.
                </div>
                <div className="notice" style={{ marginTop: 13 }}>
                  <span className="ico">i</span>
                  <span className="ntx">
                    <b>Evenimentul următor</b>
                    <span>
                      Se ia automat din Noutăți, primul eveniment care nu a trecut. Când nu urmează
                      niciunul, eticheta nu se afișează.
                    </span>
                  </span>
                  <button className="btn sm" type="button" onClick={() => navigate(ARTICLES_TO)}>
                    Vezi evenimentele
                  </button>
                </div>
              </div>
            </div>

            {/* ── Registration: one variant at a time ── */}
            <div className="sec">
              <div className="sh">
                Înscrieri
                <span className="lbl">pe site apare o singură variantă</span>
              </div>
              <div className="sb">
                <div className="notice" style={{ marginBottom: 13 }}>
                  <span className="ico">i</span>
                  <span className="ntx">
                    <b>Sezonul și starea înscrierilor</b>
                    <span>
                      {registrationOpen === null
                        ? 'Se schimbă din Setări site, nu de aici.'
                        : registrationOpen
                          ? 'Acum înscrierile sunt deschise, deci site-ul afișează varianta „deschise". Se schimbă din Setări site.'
                          : 'Acum înscrierile sunt închise, deci site-ul afișează varianta „închise". Se schimbă din Setări site.'}
                    </span>
                  </span>
                  <button className="btn sm" type="button" onClick={() => navigate(SITE_SETTINGS_TO)}>
                    Deschide Setări site
                  </button>
                </div>

                <div className="tabs">
                  <button
                    className={`tab${regTab === 'open' ? ' on' : ''}`}
                    type="button"
                    onClick={() => setRegTab('open')}
                  >
                    Înscrieri deschise
                    {registrationOpen === true && <span className="tpill">pe site</span>}
                  </button>
                  <button
                    className={`tab${regTab === 'closed' ? ' on' : ''}`}
                    type="button"
                    onClick={() => setRegTab('closed')}
                  >
                    Înscrieri închise
                    {registrationOpen === false && <span className="tpill">pe site</span>}
                  </button>
                </div>

                {regTab === 'open' ? (
                  <>
                    <div className="fld">
                      <label>Titlu</label>
                      <input
                        value={form.registration.heading ?? ''}
                        onChange={(e) => upd('registration', { heading: e.target.value })}
                      />
                    </div>
                    <div className="fld">
                      <label>Text</label>
                      <textarea
                        rows={3}
                        value={form.registration.body ?? ''}
                        onChange={(e) => upd('registration', { body: e.target.value })}
                      />
                    </div>
                    <div className="fld">
                      <label>Text secundar</label>
                      <textarea
                        rows={2}
                        value={form.registration.bodySecondary ?? ''}
                        onChange={(e) => upd('registration', { bodySecondary: e.target.value })}
                      />
                    </div>
                    <div className="row">
                      <div className="fld">
                        <label>Zile</label>
                        <input
                          value={form.registration.scheduleDays ?? ''}
                          onChange={(e) => upd('registration', { scheduleDays: e.target.value })}
                        />
                      </div>
                      <div className="fld">
                        <label>Ore</label>
                        <input
                          value={form.registration.scheduleTimes ?? ''}
                          onChange={(e) => upd('registration', { scheduleTimes: e.target.value })}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <InheritedField
                        label="Locație"
                        value={form.registration.locationName ?? ''}
                        inherited={inheritedLocation}
                        overridden={overrideLocation}
                        settingsName="Setări site"
                        onChange={(v) => upd('registration', { locationName: v })}
                        onOverride={() => setOverrideLocation(true)}
                        onUseSetting={() => {
                          setOverrideLocation(false);
                          upd('registration', { locationName: '' });
                        }}
                      />
                    </div>
                    <div className="row" style={{ marginTop: 12 }}>
                      <div className="fld">
                        <label>Buton principal</label>
                        <input
                          value={form.registration.ctaPrimaryLabel ?? ''}
                          onChange={(e) => upd('registration', { ctaPrimaryLabel: e.target.value })}
                        />
                      </div>
                      <div className="fld">
                        <label>Link</label>
                        <input
                          value={form.registration.ctaPrimaryUrl ?? ''}
                          onChange={(e) => upd('registration', { ctaPrimaryUrl: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="row" style={{ marginTop: 12 }}>
                      <div className="fld">
                        <label>Buton secundar</label>
                        <input
                          value={form.registration.ctaSecondaryLabel ?? ''}
                          onChange={(e) => upd('registration', { ctaSecondaryLabel: e.target.value })}
                        />
                      </div>
                      <div className="fld">
                        <label>Link</label>
                        <input
                          value={form.registration.ctaSecondaryUrl ?? ''}
                          onChange={(e) => upd('registration', { ctaSecondaryUrl: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="row" style={{ marginTop: 12 }}>
                      <div className="fld">
                        <label>Link prețuri</label>
                        <input
                          value={form.registration.pricesLinkLabel ?? ''}
                          onChange={(e) => upd('registration', { pricesLinkLabel: e.target.value })}
                        />
                      </div>
                      <div className="fld">
                        <label>Adresă</label>
                        <input
                          value={form.registration.pricesLinkUrl ?? ''}
                          onChange={(e) => upd('registration', { pricesLinkUrl: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="fld">
                      <label>Titlu</label>
                      <input
                        value={form.registrationClosed.heading ?? ''}
                        onChange={(e) => upd('registrationClosed', { heading: e.target.value })}
                      />
                    </div>
                    <div className="fld">
                      <label>Text</label>
                      <textarea
                        rows={4}
                        value={form.registrationClosed.body ?? ''}
                        onChange={(e) => upd('registrationClosed', { body: e.target.value })}
                      />
                    </div>
                    <div className="fld">
                      <label>Buton WhatsApp</label>
                      <input
                        value={form.registrationClosed.whatsappLabel ?? ''}
                        onChange={(e) => upd('registrationClosed', { whatsappLabel: e.target.value })}
                      />
                    </div>
                    <InheritedField
                      label="Adresă canal WhatsApp"
                      value={form.registrationClosed.whatsappUrl ?? ''}
                      inherited={inheritedWhatsapp}
                      overridden={overrideWhatsapp}
                      settingsName="Setări site"
                      emptyNote="Înainte câmpul era gol aici, deci butonul nu ducea nicăieri."
                      onChange={(v) => upd('registrationClosed', { whatsappUrl: v })}
                      onOverride={() => setOverrideWhatsapp(true)}
                      onUseSetting={() => {
                        setOverrideWhatsapp(false);
                        upd('registrationClosed', { whatsappUrl: '' });
                      }}
                    />
                    <div className="row" style={{ marginTop: 12 }}>
                      <div className="fld">
                        <label>Buton contact</label>
                        <input
                          value={form.registrationClosed.contactLabel ?? ''}
                          onChange={(e) => upd('registrationClosed', { contactLabel: e.target.value })}
                        />
                      </div>
                      <div className="fld">
                        <label>Link</label>
                        <input
                          value={form.registrationClosed.contactUrl ?? ''}
                          onChange={(e) => upd('registrationClosed', { contactUrl: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── About: one panel at a time ── */}
            <div className="sec">
              <div className="sh">
                Despre noi
                <span className="lbl">{ABOUT_PANELS} panouri</span>
              </div>
              <div className="sb">
                <div className="tabs">
                  {Array.from({ length: ABOUT_PANELS }).map((_, i) => (
                    <button
                      key={i}
                      className={`tab${aboutTab === i ? ' on' : ''}`}
                      type="button"
                      onClick={() => setAboutTab(i)}
                    >
                      {(panels[i]?.eyebrow ?? '').trim() || `Panou ${i + 1}`}
                    </button>
                  ))}
                </div>

                <div className="fld">
                  <label>Supratitlu</label>
                  <input
                    value={panel.eyebrow ?? ''}
                    onChange={(e) => updPanel(aboutTab, { eyebrow: e.target.value })}
                  />
                </div>
                <div className="fld">
                  <label>Titlu, se rupe unde pui Enter</label>
                  <textarea
                    rows={2}
                    style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}
                    value={panelHeading}
                    onChange={(e) => updPanel(aboutTab, { heading: e.target.value })}
                  />
                  <BreakMarkup text={panelHeading} />
                  <div className="prev">
                    <div className="t">Așa apare pe site</div>
                    <div className="h">{panelHeading}</div>
                  </div>
                </div>
                <div className="fld">
                  <label>Text</label>
                  <textarea
                    rows={4}
                    value={panel.body ?? ''}
                    onChange={(e) => updPanel(aboutTab, { body: e.target.value })}
                  />
                </div>
                <div className="row">
                  <div className="fld">
                    <label>Text buton</label>
                    <input
                      value={panel.ctaLabel ?? ''}
                      onChange={(e) => updPanel(aboutTab, { ctaLabel: e.target.value })}
                    />
                  </div>
                  <div className="fld">
                    <label>Link</label>
                    <input
                      value={panel.ctaUrl ?? ''}
                      onChange={(e) => updPanel(aboutTab, { ctaUrl: e.target.value })}
                    />
                  </div>
                </div>
                <div className="hint">
                  Layout-ul e construit pentru exact {ABOUT_PANELS} panouri. Un al patrulea nu s-ar
                  afișa.
                </div>
              </div>
            </div>

            {/* ── Athletes ── */}
            <div className="sec">
              <div className="sh">Sportivi</div>
              <div className="sb">
                <div className="fld">
                  <label>Titlu secțiune</label>
                  <input
                    value={athletes.heading ?? ''}
                    onChange={(e) =>
                      upd('sections', { athletes: { ...athletes, heading: e.target.value } })
                    }
                  />
                </div>
                <div className="fld">
                  <label>Descriere</label>
                  <textarea
                    rows={3}
                    value={athletes.intro ?? ''}
                    onChange={(e) =>
                      upd('sections', { athletes: { ...athletes, intro: e.target.value } })
                    }
                  />
                </div>
                <div className="fld">
                  <label>Număr sportivi</label>
                  <div className="ro">
                    <span className="pill auto">automat</span>
                    <b>{athleteCount ?? '...'}</b> sportivi publici
                  </div>
                  <div className="hint">Se actualizează când adaugi sau ascunzi un sportiv.</div>
                </div>
                <div className="row">
                  <div className="fld">
                    <label>Etichetă sub număr</label>
                    <input
                      value={athletes.countLabel ?? ''}
                      onChange={(e) =>
                        upd('sections', { athletes: { ...athletes, countLabel: e.target.value } })
                      }
                    />
                  </div>
                  <div className="fld">
                    <label>Text buton</label>
                    <input
                      value={athletes.ctaLabel ?? ''}
                      onChange={(e) =>
                        upd('sections', { athletes: { ...athletes, ctaLabel: e.target.value } })
                      }
                    />
                  </div>
                </div>
                <div className="fld" style={{ marginTop: 12 }}>
                  <label>Link buton</label>
                  <input
                    value={athletes.ctaUrl ?? ''}
                    onChange={(e) =>
                      upd('sections', { athletes: { ...athletes, ctaUrl: e.target.value } })
                    }
                  />
                </div>
              </div>
            </div>

            {/* ── Club figures ── */}
            <div className="sec">
              <div className="sh">
                Cifrele clubului
                <button className="addbtn" type="button" onClick={addFigure}>
                  + Adaugă cifră
                </button>
              </div>
              <div className="sb">
                <div className="notice" style={{ marginBottom: 13 }}>
                  <span className="ico">i</span>
                  <span className="ntx">
                    <b>Cifrele se scriu o singură dată</b>
                    <span>
                      Lista de mai jos este comună. Bifează aici doar cifrele care apar pe pagina
                      principală. Ordinea de pe site este ordinea din listă.
                    </span>
                  </span>
                </div>

                {figures.length === 0 ? (
                  <div className="hint">Nicio cifră în listă. Adaugă prima cifră a clubului.</div>
                ) : (
                  <table className="mini fig">
                    <thead>
                      <tr>
                        <th style={{ width: 1 }}>Apare</th>
                        <th style={{ width: 110 }}>Valoare</th>
                        <th>Etichetă</th>
                        <th className="act" />
                      </tr>
                    </thead>
                    <tbody>
                      {figures.map((f, i) => (
                        <tr key={f.id || i} className={selected.has(f.id) ? '' : 'off'}>
                          <td className="pickcell">
                            <input
                              type="checkbox"
                              checked={selected.has(f.id)}
                              onChange={() => toggleFigure(f.id)}
                              aria-label={`Afișează ${f.label || f.value} pe pagina principală`}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={f.value}
                              onChange={(e) => updFigure(i, { value: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={f.label}
                              onChange={(e) => updFigure(i, { label: e.target.value })}
                            />
                          </td>
                          <td className="movecell">
                            <button
                              className="mv"
                              type="button"
                              disabled={i === 0}
                              onClick={() => moveFigure(i, -1)}
                              aria-label="Mută mai sus"
                            >
                              sus
                            </button>
                            <button
                              className="mv"
                              type="button"
                              disabled={i === figures.length - 1}
                              onClick={() => moveFigure(i, 1)}
                              aria-label="Mută mai jos"
                            >
                              jos
                            </button>
                            <button
                              className="rm"
                              type="button"
                              onClick={() => setFigureToRemove(i)}
                              aria-label="Șterge cifra"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="hint" style={{ marginTop: 10 }}>
                  Pagina Istoric are deocamdată lista ei separată de cifre, în Club / Pagina Istoric.
                </div>
              </div>
            </div>
            {/* Competition gallery */}
            <div className="sec">
              <div className="sh">Galeria competițiilor</div>
              <div className="sb">
                <div className="notice" style={{ marginBottom: 13 }}>
                  <span className="ico">i</span>
                  <span className="ntx">
                    <b>Trei imagini, în ordinea de aici</b>
                    <span>
                      Secțiunea apare pe pagina principală doar dacă este aleasă cel puțin o
                      imagine. Fără imagini, secțiunea nu se afișează deloc.
                    </span>
                  </span>
                </div>

                <div className="fld" style={{ marginBottom: 14 }}>
                  <label>Text secțiune</label>
                  <input
                    value={form.sections.gallery?.heading ?? ''}
                    placeholder="Pe gheață, în formă maximă. Momente din competițiile sportivilor noștri."
                    onChange={(e) =>
                      upd('sections', {
                        gallery: { ...(form.sections.gallery ?? {}), heading: e.target.value },
                      })
                    }
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                  {form.competitionGallery.map((img, i) => (
                    <div key={i} className="fld">
                      <label>{`Foto ${i + 1}`}</label>
                      <div
                        style={{
                          width: '100%',
                          aspectRatio: '4/3',
                          borderRadius: 4,
                          border: '1px solid #dcdce4',
                          background: img
                            ? `#f6f6f9 center/cover no-repeat url(${img.url})`
                            : '#f6f6f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {!img && <span style={{ fontSize: 12, color: '#8e8ea9' }}>Fără imagine</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button className="btn sm" type="button" onClick={() => setGallerySlot(i)}>
                          {img ? 'Schimbă' : 'Alege'}
                        </button>
                        {img && (
                          <button
                            className="btn sm"
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                competitionGallery: f.competitionGallery.map((g, k) =>
                                  k === i ? null : g
                                ),
                              }))
                            }
                          >
                            Șterge
                          </button>
                        )}
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
            <button className="btn" type="button" onClick={() => navigate(DASHBOARD_TO)}>
              Înapoi
            </button>
            <div className="grow" />
            <button className="btn pri" type="button" onClick={save} disabled={saving}>
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        )}
      </div>

      <MediaModal
        open={gallerySlot !== null}
        onClose={() => setGallerySlot(null)}
        onPick={(f) => {
          setForm((prev) => ({
            ...prev,
            competitionGallery: prev.competitionGallery.map((g, k) =>
              k === gallerySlot ? f : g
            ),
          }));
          setGallerySlot(null);
        }}
      />

      <ConfirmDialog
        open={figureToRemove !== null}
        title="Ștergi cifra?"
        message={
          figureToRemove !== null && figures[figureToRemove]
            ? `„${figures[figureToRemove].value} ${figures[figureToRemove].label}" dispare din lista comună.`
            : ''
        }
        detail="Se șterge la salvare, pentru toate paginile care o folosesc."
        confirmLabel="Șterge cifra"
        busyLabel="Se șterge..."
        onConfirm={() => figureToRemove !== null && removeFigure(figureToRemove)}
        onCancel={() => setFigureToRemove(null)}
      />
    </div>
  );
};

export default HomepageEditPage;
