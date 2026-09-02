import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { EDU_CSS } from './edusportUi';
import { DASHBOARD_TO } from './menu';

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
 */

const CT = '/content-manager/single-types/api::homepage.homepage';
const SITE_SETTINGS_TO = '/content-manager/single-types/api::site-settings.site-settings';
const ARTICLES_TO = '/content-manager/collection-types/api::article.article';
const SPORTSPEOPLE_CT = '/content-manager/collection-types/api::sportsperson.sportsperson';

// ---------------------------------------------------------------------------
// Shapes. These mirror exactly what the frontend reads; see
// edusport_frontend/src/app/homepage/_types.ts.
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
  athletes?: {
    heading?: string;
    intro?: string;
    countLabel?: string;
    ctaLabel?: string;
    ctaUrl?: string;
  };
  stats?: StatItem[];
};

type Form = {
  hero: Hero;
  registration: Registration;
  registrationClosed: RegistrationClosed;
  about: About;
  sections: Sections;
};

const EMPTY: Form = {
  hero: {},
  registration: {},
  registrationClosed: {},
  about: { panels: [] },
  sections: { athletes: {}, stats: [] },
};

// The About layout is built for exactly three panels; a fourth would not render.
const ABOUT_PANELS = 3;

const HomepageEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { get, put } = useFetchClient();

  const [form, setForm] = React.useState<Form>(EMPTY);
  // Everything the server returned, so keys this editor does not manage survive.
  const [raw, setRaw] = React.useState<Record<string, unknown>>({});
  const [athleteCount, setAthleteCount] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

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
          sections: {
            athletes: entry.sections?.athletes ?? {},
            stats: entry.sections?.stats ?? [],
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

  const updStat = (i: number, patch: Partial<StatItem>) =>
    setForm((f) => {
      const stats = [...(f.sections.stats ?? [])];
      stats[i] = { ...(stats[i] ?? {}), ...patch };
      return { ...f, sections: { ...f.sections, stats } };
    });

  const addStat = () =>
    setForm((f) => ({
      ...f,
      sections: { ...f.sections, stats: [...(f.sections.stats ?? []), { value: '', label: '' }] },
    }));

  const removeStat = (i: number) =>
    setForm((f) => ({
      ...f,
      sections: { ...f.sections, stats: (f.sections.stats ?? []).filter((_, k) => k !== i) },
    }));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await put(CT, {
        hero: { ...(raw.hero as object), ...form.hero },
        registration: { ...(raw.registration as object), ...form.registration },
        registrationClosed: { ...(raw.registrationClosed as object), ...form.registrationClosed },
        about: { ...(raw.about as object), panels: form.about.panels ?? [] },
        sections: { ...(raw.sections as object), ...form.sections },
      });
      setMsg({ kind: 'ok', text: 'Modificările au fost salvate.' });
    } catch {
      setMsg({ kind: 'err', text: 'Nu am putut salva. Încearcă din nou.' });
    } finally {
      setSaving(false);
    }
  };

  const panels = form.about.panels ?? [];
  const stats = form.sections.stats ?? [];
  const athletes = form.sections.athletes ?? {};

  // `pce` opts our "Salvează" button out of the global admin SaveBar tagger,
  // which would otherwise clip it to 1x1. See app.tsx.
  return (
    <div className="eduf pce">
      <style>{EDU_CSS}</style>
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

            {/* ── Registration open ── */}
            <div className="sec">
              <div className="sh">Înscrieri deschise</div>
              <div className="sb">
                <div className="notice" style={{ marginBottom: 13 }}>
                  <span className="ico">i</span>
                  <span className="ntx">
                    <b>Sezonul și starea înscrierilor</b>
                    <span>Se schimbă din Setări site, nu de aici.</span>
                  </span>
                  <button className="btn sm" type="button" onClick={() => navigate(SITE_SETTINGS_TO)}>
                    Deschide Setări site
                  </button>
                </div>

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
                    rows={2}
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
                <div className="fld" style={{ marginTop: 12 }}>
                  <label>Locație</label>
                  <input
                    value={form.registration.locationName ?? ''}
                    onChange={(e) => upd('registration', { locationName: e.target.value })}
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
              </div>
            </div>

            {/* ── Registration closed ── */}
            <div className="sec">
              <div className="sh">
                Înscrieri închise
                <span className="lbl">se afișează când înscrierile sunt oprite</span>
              </div>
              <div className="sb">
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
                    rows={2}
                    value={form.registrationClosed.body ?? ''}
                    onChange={(e) => upd('registrationClosed', { body: e.target.value })}
                  />
                </div>
                <div className="row">
                  <div className="fld">
                    <label>Buton WhatsApp</label>
                    <input
                      value={form.registrationClosed.whatsappLabel ?? ''}
                      onChange={(e) => upd('registrationClosed', { whatsappLabel: e.target.value })}
                    />
                  </div>
                  <div className="fld">
                    <label>Link</label>
                    <input
                      value={form.registrationClosed.whatsappUrl ?? ''}
                      onChange={(e) => upd('registrationClosed', { whatsappUrl: e.target.value })}
                    />
                  </div>
                </div>
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
              </div>
            </div>

            {/* ── About ── */}
            <div className="sec">
              <div className="sh">
                Despre noi
                <span className="lbl">{ABOUT_PANELS} panouri</span>
              </div>
              <div className="sb">
                {Array.from({ length: ABOUT_PANELS }).map((_, i) => {
                  const p = panels[i] ?? {};
                  return (
                    <div className="season" key={i}>
                      <div className="sthd">
                        <span className="lbl">Panou {i + 1}</span>
                        <input
                          value={p.heading ?? ''}
                          placeholder="Titlu"
                          onChange={(e) => updPanel(i, { heading: e.target.value })}
                        />
                        <div style={{ flex: 1 }} />
                      </div>
                      <div className="sbody">
                        <div className="fld">
                          <label>Eyebrow</label>
                          <input
                            value={p.eyebrow ?? ''}
                            onChange={(e) => updPanel(i, { eyebrow: e.target.value })}
                          />
                        </div>
                        <div className="fld">
                          <label>Text</label>
                          <textarea
                            rows={2}
                            value={p.body ?? ''}
                            onChange={(e) => updPanel(i, { body: e.target.value })}
                          />
                        </div>
                        <div className="row">
                          <div className="fld">
                            <label>Text buton</label>
                            <input
                              value={p.ctaLabel ?? ''}
                              onChange={(e) => updPanel(i, { ctaLabel: e.target.value })}
                            />
                          </div>
                          <div className="fld">
                            <label>Link</label>
                            <input
                              value={p.ctaUrl ?? ''}
                              onChange={(e) => updPanel(i, { ctaUrl: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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

            {/* ── Stats ── */}
            <div className="sec">
              <div className="sh">
                Statistici
                <button className="addbtn" type="button" onClick={addStat}>
                  + Adaugă
                </button>
              </div>
              <div className="sb">
                {stats.length === 0 ? (
                  <div className="hint">Nicio statistică adăugată.</div>
                ) : (
                  <table className="mini">
                    <thead>
                      <tr>
                        <th style={{ width: 120 }}>Valoare</th>
                        <th>Etichetă</th>
                        <th className="act" />
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map((st, i) => (
                        <tr key={i}>
                          <td>
                            <input
                              value={st.value ?? ''}
                              onChange={(e) => updStat(i, { value: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              value={st.label ?? ''}
                              onChange={(e) => updStat(i, { label: e.target.value })}
                            />
                          </td>
                          <td className="act">
                            <button className="rm" type="button" onClick={() => removeStat(i)}>
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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
    </div>
  );
};

export default HomepageEditPage;
