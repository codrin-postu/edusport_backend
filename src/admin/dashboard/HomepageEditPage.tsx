import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import {
  AdminPage,
  Window,
  PageHeader,
  Notice,
  Loading,
  SaveBar,
  UnsavedGuard,
  useSaveState,
  ObjectFieldCard,
  EditorCard,
  RepeatableList,
  GalleryGrid,
  Tabs,
  Field,
  FieldRow,
  Input,
  Textarea,
  Button,
  Checkbox,
  StatusBadge,
  type GalleryImage,
} from '../ui';
import { IconTrash } from '../ui/icons';
import { deepEqual } from '../lib';
import { SETARI_SITE_TO } from '../pages/routes';
import { DASHBOARD_TO } from './menu';
import { ConfirmDialog } from '../ConfirmDialog';

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
 * Saving writes two documents (Cifre club, then the homepage), so the page
 * keeps its own load / save instead of useSingleType; the floating SaveBar,
 * the toasts and the leave guard come from useSaveState like every other edit
 * page. Dirty is structural: the form and the figures are compared with what
 * was last loaded or saved.
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

type Athletes = {
  heading?: string;
  intro?: string;
  countLabel?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

type Sections = {
  gallery?: {
    heading?: string;
  };
  athletes?: Athletes;
  /** Legacy inline list. Kept untouched as the site's fallback. */
  stats?: StatItem[];
  /** Ids into Cifre club, in display order. */
  statIds?: string[];
};

/** One picked image, or an empty slot. */
type GallerySlot = { id: number; url: string } | null;

type Form = {
  competitionGallery: GallerySlot[];
  hero: Hero;
  registration: Registration;
  registrationClosed: RegistrationClosed;
  about: About;
  sections: Sections;
};

type Figure = { id: string; value: string; label: string };

type SiteContact = { addressDisplay?: string; whatsappChannelUrl?: string };

type Baseline = { form: Form; figures: Figure[] };

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
function galleryFileOf(m: unknown): GallerySlot {
  const f = m as { id?: unknown; url?: string; formats?: { thumbnail?: { url?: string } } } | null;
  if (!f || typeof f !== 'object' || typeof f.id !== 'number') return null;
  return { id: f.id, url: f.formats?.thumbnail?.url ?? f.url ?? '' };
}

function figuresOf(rows: unknown): Figure[] | null {
  if (!Array.isArray(rows)) return null;
  return rows.map((f: { id?: unknown; value?: unknown; label?: unknown } | null) => ({
    id: String(f?.id ?? ''),
    value: String(f?.value ?? ''),
    label: String(f?.label ?? ''),
  }));
}

function formOf(entry: Record<string, any>): Form {
  return {
    hero: entry.hero ?? {},
    registration: entry.registration ?? {},
    registrationClosed: entry.registrationClosed ?? {},
    about: { panels: entry.about?.panels ?? [] },
    competitionGallery: Array.from({ length: GALLERY_SLOTS }, (_, i) => galleryFileOf((entry.competitionGallery ?? [])[i])),
    sections: {
      gallery: entry.sections?.gallery ?? {},
      athletes: entry.sections?.athletes ?? {},
      stats: entry.sections?.stats ?? [],
      statIds: Array.isArray(entry.sections?.statIds) ? entry.sections.statIds : [],
    },
  };
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

/** A fresh figure whose id does not clash with the list. */
function newFigure(rows: Figure[]): Figure {
  let id = 'cifra-noua';
  let n = 2;
  while (rows.some((f) => f.id === id)) {
    id = `cifra-noua-${n}`;
    n += 1;
  }
  return { id, value: '', label: '' };
}

// Layout only; colours, type and corners are tokens.
const PAGE_CSS = `
.hp-inh{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:var(--ui-fs-caption);color:var(--theme-text-muted);margin-top:5px}
.hp-inh b{color:var(--theme-text);font-weight:600}
.hp-brk{margin-top:6px;font-size:var(--ui-fs-body-sm);color:var(--theme-text);line-height:2}
.hp-brk .ui-badge{margin:0 4px}
.hp-prev{border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);padding:11px 12px;background:var(--theme-surface-subtle);margin-top:8px}
.hp-prev-t{font-size:var(--ui-fs-label);font-weight:var(--ui-fw-label);letter-spacing:var(--ui-ls-label);text-transform:uppercase;color:var(--theme-text-muted);margin-bottom:6px}
.hp-prev-h{font-size:20px;font-weight:800;line-height:1.15;color:var(--theme-text);letter-spacing:-.3px;white-space:pre-wrap}
.hp-heading{font-size:15px;font-weight:700;line-height:1.5}
.hp-count{display:flex;align-items:center;gap:8px;font-size:var(--ui-fs-body);color:var(--theme-text)}
.hp-fig{flex:1;min-width:0;display:grid;grid-template-columns:auto 110px minmax(0,1fr) auto;gap:8px;align-items:center}
@media (max-width:640px){.hp-fig{grid-template-columns:auto minmax(0,1fr) auto}.hp-fig .hp-fig-label{grid-column:2 / 3}}
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
}> = ({ label, value, inherited, overridden, settingsName, emptyNote, onChange, onOverride, onUseSetting }) => {
  const local = value.trim() !== '';
  const editing = local || overridden;
  const drifted = local && inherited.trim() !== '' && value.trim() !== inherited.trim();

  return (
    <Field label={label}>
      {editing ? (
        <>
          <Input value={value} onChange={(e) => onChange(e.target.value)} />
          <div className="hp-inh">
            {drifted ? (
              <>
                <StatusBadge tone="warning">Diferă de setări</StatusBadge>
                <span>
                  În {settingsName} scrie <b>{inherited}</b>.
                </span>
                <Button variant="secondary" size="sm" onClick={onUseSetting}>
                  Folosește valoarea din setări
                </Button>
              </>
            ) : (
              <>
                <span>Valoare scrisă doar pentru pagina principală.</span>
                <Button variant="secondary" size="sm" onClick={onUseSetting}>
                  Revino la valoarea din setări
                </Button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <Input value={inherited.trim() === '' ? '' : inherited} placeholder={'Nimic completat în ' + settingsName} readOnly disabled />
          <div className="hp-inh">
            <StatusBadge tone="primary">Din setări</StatusBadge>
            <span>
              Se schimbă în <b>{settingsName}</b>, ca să nu existe două valori diferite.
              {emptyNote ? ' ' + emptyNote : ''}
            </span>
            <Button variant="secondary" size="sm" onClick={onOverride}>
              Suprascrie aici
            </Button>
          </div>
        </>
      )}
    </Field>
  );
};

/** Shows the stored text with an explicit marker wherever a line break sits. */
const BreakMarkup: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="hp-brk">
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < lines.length - 1 && <StatusBadge tone="primary">rând nou</StatusBadge>}
        </React.Fragment>
      ))}
    </div>
  );
};

/** A plain text input bound to one key of an object. */
function TextField<T extends object>({
  label,
  obj,
  k,
  onChange,
  placeholder,
}: {
  label: string;
  obj: T;
  k: keyof T & string;
  onChange: (patch: Partial<T>) => void;
  placeholder?: string;
}) {
  const v = (obj as Record<string, unknown>)[k];
  return (
    <Field label={label}>
      <Input
        value={typeof v === 'string' ? v : ''}
        placeholder={placeholder}
        onChange={(e) => onChange({ [k]: e.target.value } as Partial<T>)}
      />
    </Field>
  );
}

/** A textarea bound to one key of an object. */
function AreaField<T extends object>({
  label,
  obj,
  k,
  rows,
  onChange,
}: {
  label: string;
  obj: T;
  k: keyof T & string;
  rows: number;
  onChange: (patch: Partial<T>) => void;
}) {
  const v = (obj as Record<string, unknown>)[k];
  return (
    <Field label={label}>
      <Textarea rows={rows} value={typeof v === 'string' ? v : ''} onChange={(e) => onChange({ [k]: e.target.value } as Partial<T>)} />
    </Field>
  );
}

const HomepageEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { get, put } = useFetchClient();
  const save = useSaveState();

  const [form, setForm] = React.useState<Form>(EMPTY);
  // Everything the server returned, so keys this editor does not manage survive.
  const [raw, setRaw] = React.useState<Record<string, unknown>>({});
  const [figures, setFigures] = React.useState<Figure[]>([]);
  // What was last loaded or saved: the save bar's dirty flag and Renunță.
  const [baseline, setBaseline] = React.useState<Baseline>({ form: EMPTY, figures: [] });
  const [contact, setContact] = React.useState<SiteContact>({});
  const [registrationOpen, setRegistrationOpen] = React.useState<boolean | null>(null);
  const [athleteCount, setAthleteCount] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const [regTab, setRegTab] = React.useState<'open' | 'closed'>('open');
  const [aboutTab, setAboutTab] = React.useState(0);
  const [overrideLocation, setOverrideLocation] = React.useState(false);
  const [overrideWhatsapp, setOverrideWhatsapp] = React.useState(false);
  const [figureToRemove, setFigureToRemove] = React.useState<number | null>(null);

  React.useEffect(() => {
    let off = false;
    (async () => {
      try {
        const r: any = await get(CT);
        if (off) return;
        const entry = r?.data?.data ?? r?.data ?? {};
        const next = formOf(entry);
        setRaw(entry);
        setForm(next);
        setBaseline((b) => ({ ...b, form: next }));
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
        const rows = figuresOf(r?.data?.data?.figures ?? r?.data?.figures);
        if (rows) {
          setFigures(rows);
          setBaseline((b) => ({ ...b, figures: rows }));
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
        const r: any = await get(`${SPORTSPEOPLE_CT}?filters[showPublicPage][$eq]=true&pagination[pageSize]=1`);
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

  // Keep the save bar in step with the structural dirty flag (not while a save runs).
  const dirty = !deepEqual({ form, figures }, baseline);
  const { setDirty, saving: sSaving, dirty: sDirty } = save;
  React.useEffect(() => {
    if (sSaving) return;
    if (sDirty !== dirty) setDirty(dirty);
  }, [dirty, sDirty, sSaving, setDirty]);

  const upd = <K extends keyof Form>(key: K, patch: Partial<Form[K]>) =>
    setForm((f) => ({ ...f, [key]: { ...(f[key] as object), ...patch } }));

  const updPanel = (i: number, patch: Partial<AboutPanel>) =>
    setForm((f) => {
      const panels = [...(f.about.panels ?? [])];
      panels[i] = { ...(panels[i] ?? {}), ...patch };
      return { ...f, about: { ...f.about, panels } };
    });

  const selected = React.useMemo(() => new Set(form.sections.statIds ?? []), [form.sections.statIds]);

  const toggleFigure = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setForm((f) => ({
      ...f,
      sections: {
        ...f.sections,
        // Display order follows the shared list, so the page cannot end up with
        // an order nobody chose.
        statIds: figures.filter((fig) => next.has(fig.id)).map((fig) => fig.id),
      },
    }));
  };

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

  const onSave = () =>
    void save.run(async () => {
      // Cifre club first: the homepage stores ids, so the ids have to exist.
      const cleaned = figures
        .map((f) => ({
          id: f.id || slugify(f.label) || slugify(f.value),
          value: f.value.trim(),
          label: f.label.trim(),
        }))
        .filter((f) => f.value !== '' || f.label !== '');

      const fr: any = await put(FIGURES_API, { figures: cleaned });
      const storedFigures: Figure[] = figuresOf(fr?.data?.data?.figures ?? fr?.data?.figures) ?? cleaned;

      const statIds = storedFigures.filter((f) => selected.has(f.id)).map((f) => f.id);

      const body = {
        hero: { ...(raw.hero as object), ...form.hero },
        registration: { ...(raw.registration as object), ...form.registration },
        registrationClosed: { ...(raw.registrationClosed as object), ...form.registrationClosed },
        about: { ...(raw.about as object), panels: form.about.panels ?? [] },
        sections: { ...(raw.sections as object), ...form.sections, statIds },
        competitionGallery: form.competitionGallery.filter((g): g is { id: number; url: string } => g !== null).map((g) => g.id),
      };
      await put(CT, body);
      const savedForm: Form = { ...form, sections: { ...form.sections, statIds } };
      setFigures(storedFigures);
      setForm(savedForm);
      setBaseline({ form: savedForm, figures: storedFigures });
    });

  const discard = () => {
    setForm(baseline.form);
    setFigures(baseline.figures);
    setOverrideLocation(false);
    setOverrideWhatsapp(false);
    save.reset();
  };

  const panels = form.about.panels ?? [];
  const athletes = form.sections.athletes ?? {};
  const panel = panels[aboutTab] ?? {};
  const panelHeading = panel.heading ?? '';
  const inheritedLocation = contact.addressDisplay ?? '';
  const inheritedWhatsapp = contact.whatsappChannelUrl ?? '';
  const reg = form.registration;
  const regC = form.registrationClosed;
  const onReg = (p: Partial<Registration>) => upd('registration', p);
  const onRegC = (p: Partial<RegistrationClosed>) => upd('registrationClosed', p);
  const onPanel = (p: Partial<AboutPanel>) => updPanel(aboutTab, p);

  const liveBadge = <StatusBadge tone="primary">pe site</StatusBadge>;
  const gallerySlots: Array<GalleryImage | null> = form.competitionGallery.map((g) => (g ? { id: g.id, url: g.url } : null));

  return (
    <AdminPage>
      <style>{PAGE_CSS}</style>
      <Window>
        <PageHeader back={{ to: DASHBOARD_TO }} title="Pagina principală" subtitle="Textele de pe prima pagină a site-ului" />

        {loading ? (
          <Loading />
        ) : error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca pagina principală.</Notice>
          </div>
        ) : (
          <div className="ui-body">
            {/* ── Hero ── */}
            <ObjectFieldCard<Hero>
              title="Hero"
              description="Titlul EDUSPORT și fundalul video nu se editează, fac parte din design."
              value={form.hero}
              onFieldChange={(k, v) => upd('hero', { [k]: v })}
              fields={[
                { key: 'ctaLabel', label: 'Text buton' },
                { key: 'ctaUrl', label: 'Link buton' },
              ]}
            >
              <Notice
                tone="info"
                title="Evenimentul următor"
                action={
                  <Button variant="secondary" size="sm" onClick={() => navigate(ARTICLES_TO)}>
                    Vezi evenimentele
                  </Button>
                }
              >
                Se ia automat din Noutăți, primul eveniment care nu a trecut. Când nu urmează niciunul, eticheta nu se
                afișează.
              </Notice>
            </ObjectFieldCard>

            {/* ── Registration: one variant at a time ── */}
            <EditorCard title="Înscrieri" description="Pe site apare o singură variantă.">
              <Notice
                tone="info"
                title="Sezonul și starea înscrierilor"
                action={
                  <Button variant="secondary" size="sm" onClick={() => navigate(SETARI_SITE_TO)}>
                    Deschide Setări site
                  </Button>
                }
              >
                {registrationOpen === null
                  ? 'Se schimbă din Setări site, nu de aici.'
                  : registrationOpen
                    ? 'Acum înscrierile sunt deschise, deci site-ul afișează varianta „deschise". Se schimbă din Setări site.'
                    : 'Acum înscrierile sunt închise, deci site-ul afișează varianta „închise". Se schimbă din Setări site.'}
              </Notice>

              <Tabs
                label="Varianta înscrierilor"
                value={regTab}
                onChange={(id) => setRegTab(id as 'open' | 'closed')}
                items={[
                  { id: 'open', label: <>Înscrieri deschise {registrationOpen === true && liveBadge}</> },
                  { id: 'closed', label: <>Înscrieri închise {registrationOpen === false && liveBadge}</> },
                ]}
              />

              {regTab === 'open' ? (
                <>
                  <TextField label="Titlu" obj={reg} k="heading" onChange={onReg} />
                  <AreaField label="Text" obj={reg} k="body" rows={3} onChange={onReg} />
                  <AreaField label="Text secundar" obj={reg} k="bodySecondary" rows={2} onChange={onReg} />
                  <FieldRow>
                    <TextField label="Zile" obj={reg} k="scheduleDays" onChange={onReg} />
                    <TextField label="Ore" obj={reg} k="scheduleTimes" onChange={onReg} />
                  </FieldRow>
                  <InheritedField
                    label="Locație"
                    value={reg.locationName ?? ''}
                    inherited={inheritedLocation}
                    overridden={overrideLocation}
                    settingsName="Setări site"
                    onChange={(v) => onReg({ locationName: v })}
                    onOverride={() => setOverrideLocation(true)}
                    onUseSetting={() => {
                      setOverrideLocation(false);
                      onReg({ locationName: '' });
                    }}
                  />
                  <FieldRow>
                    <TextField label="Buton principal" obj={reg} k="ctaPrimaryLabel" onChange={onReg} />
                    <TextField label="Link" obj={reg} k="ctaPrimaryUrl" onChange={onReg} />
                  </FieldRow>
                  <FieldRow>
                    <TextField label="Buton secundar" obj={reg} k="ctaSecondaryLabel" onChange={onReg} />
                    <TextField label="Link" obj={reg} k="ctaSecondaryUrl" onChange={onReg} />
                  </FieldRow>
                  <FieldRow>
                    <TextField label="Link prețuri" obj={reg} k="pricesLinkLabel" onChange={onReg} />
                    <TextField label="Adresă" obj={reg} k="pricesLinkUrl" onChange={onReg} />
                  </FieldRow>
                </>
              ) : (
                <>
                  <TextField label="Titlu" obj={regC} k="heading" onChange={onRegC} />
                  <AreaField label="Text" obj={regC} k="body" rows={4} onChange={onRegC} />
                  <TextField label="Buton WhatsApp" obj={regC} k="whatsappLabel" onChange={onRegC} />
                  <InheritedField
                    label="Adresă canal WhatsApp"
                    value={regC.whatsappUrl ?? ''}
                    inherited={inheritedWhatsapp}
                    overridden={overrideWhatsapp}
                    settingsName="Setări site"
                    emptyNote="Înainte câmpul era gol aici, deci butonul nu ducea nicăieri."
                    onChange={(v) => onRegC({ whatsappUrl: v })}
                    onOverride={() => setOverrideWhatsapp(true)}
                    onUseSetting={() => {
                      setOverrideWhatsapp(false);
                      onRegC({ whatsappUrl: '' });
                    }}
                  />
                  <FieldRow>
                    <TextField label="Buton contact" obj={regC} k="contactLabel" onChange={onRegC} />
                    <TextField label="Link" obj={regC} k="contactUrl" onChange={onRegC} />
                  </FieldRow>
                </>
              )}
            </EditorCard>

            {/* ── About: one panel at a time ── */}
            <EditorCard
              title="Despre noi"
              description={`Layout-ul e construit pentru exact ${ABOUT_PANELS} panouri. Un al patrulea nu s-ar afișa.`}
              headerAction={<StatusBadge tone="neutral">{ABOUT_PANELS} panouri</StatusBadge>}
            >
              <Tabs
                label="Panourile Despre noi"
                value={String(aboutTab)}
                onChange={(id) => setAboutTab(Number(id))}
                items={Array.from({ length: ABOUT_PANELS }, (_, i) => ({
                  id: String(i),
                  label: (panels[i]?.eyebrow ?? '').trim() || `Panou ${i + 1}`,
                }))}
              />

              <TextField label="Supratitlu" obj={panel} k="eyebrow" onChange={onPanel} />
              <Field label="Titlu, se rupe unde pui Enter">
                <Textarea rows={2} className="hp-heading" value={panelHeading} onChange={(e) => onPanel({ heading: e.target.value })} />
              </Field>
              <div>
                <BreakMarkup text={panelHeading} />
                <div className="hp-prev">
                  <div className="hp-prev-t">Așa apare pe site</div>
                  <div className="hp-prev-h">{panelHeading}</div>
                </div>
              </div>
              <AreaField label="Text" obj={panel} k="body" rows={4} onChange={onPanel} />
              <FieldRow>
                <TextField label="Text buton" obj={panel} k="ctaLabel" onChange={onPanel} />
                <TextField label="Link" obj={panel} k="ctaUrl" onChange={onPanel} />
              </FieldRow>
            </EditorCard>

            {/* ── Athletes ── */}
            <ObjectFieldCard<Athletes>
              title="Sportivi"
              value={athletes}
              onFieldChange={(k, v) => upd('sections', { athletes: { ...athletes, [k]: v } })}
              fields={[
                { key: 'heading', label: 'Titlu secțiune', span: 2 },
                { key: 'intro', label: 'Descriere', type: 'textarea', rows: 3 },
                { key: 'countLabel', label: 'Etichetă sub număr' },
                { key: 'ctaLabel', label: 'Text buton' },
                { key: 'ctaUrl', label: 'Link buton', span: 2 },
              ]}
            >
              <Field label="Număr sportivi" hint="Se actualizează când adaugi sau ascunzi un sportiv.">
                <div className="hp-count">
                  <StatusBadge tone="primary">automat</StatusBadge>
                  <span>
                    <b>{athleteCount ?? '...'}</b> sportivi publici
                  </span>
                </div>
              </Field>
            </ObjectFieldCard>

            {/* ── Club figures ── */}
            <EditorCard
              title="Cifrele clubului"
              description="Pagina Istoric are deocamdată lista ei separată de cifre, în Club / Pagina Istoric."
            >
              <Notice tone="info" title="Cifrele se scriu o singură dată">
                Lista de mai jos este comună. Bifează aici doar cifrele care apar pe pagina principală. Ordinea de pe site
                este ordinea din listă.
              </Notice>
              <RepeatableList<Figure>
                items={figures}
                onChange={setFigures}
                getKey={(f, i) => f.id || `i${i}`}
                newItem={() => newFigure(figures)}
                addLabel="Adaugă cifră"
                emptyLabel="Nicio cifră în listă. Adaugă prima cifră a clubului."
                itemLabel={(f, i) => f.label || f.value || `cifra ${i + 1}`}
                reorder
                hideDelete
                aria-label="Cifrele clubului"
                renderRow={(f, i, { update }) => (
                  <div className="hp-fig">
                    <Checkbox
                      checked={selected.has(f.id)}
                      onChange={() => toggleFigure(f.id)}
                      aria-label={`Afișează ${f.label || f.value} pe pagina principală`}
                    />
                    <Input value={f.value} placeholder="Valoare" aria-label="Valoare" onChange={(e) => update({ value: e.target.value })} />
                    <Input
                      className="hp-fig-label"
                      value={f.label}
                      placeholder="Etichetă"
                      aria-label="Etichetă"
                      onChange={(e) => update({ label: e.target.value })}
                    />
                    <Button variant="ghost" size="sm" iconOnly icon={<IconTrash />} aria-label="Șterge cifra" onClick={() => setFigureToRemove(i)} />
                  </div>
                )}
              />
            </EditorCard>

            {/* ── Competition gallery ── */}
            <EditorCard title="Galeria competițiilor">
              <Notice tone="info" title="Trei imagini, în ordinea de aici">
                Secțiunea apare pe pagina principală doar dacă este aleasă cel puțin o imagine. Fără imagini, secțiunea nu
                se afișează deloc.
              </Notice>
              <Field label="Text secțiune">
                <Input
                  value={form.sections.gallery?.heading ?? ''}
                  placeholder="Pe gheață, în formă maximă. Momente din competițiile sportivilor noștri."
                  onChange={(e) => upd('sections', { gallery: { ...(form.sections.gallery ?? {}), heading: e.target.value } })}
                />
              </Field>
              <GalleryGrid
                slots={GALLERY_SLOTS}
                images={gallerySlots}
                columns={3}
                reorder
                slotLabels={['Foto 1', 'Foto 2', 'Foto 3']}
                addLabel="Alege"
                aria-label="Galeria competițiilor"
                onChange={(next) =>
                  setForm((f) => ({
                    ...f,
                    competitionGallery: next.map((g) => (g ? { id: g.id, url: g.thumbnailUrl ?? g.url } : null)),
                  }))
                }
              />
            </EditorCard>
          </div>
        )}

        {!loading && !error && <SaveBar {...save.bar} onSave={onSave} onDiscard={discard} />}
      </Window>

      <UnsavedGuard when={dirty} />

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
    </AdminPage>
  );
};

export default HomepageEditPage;
