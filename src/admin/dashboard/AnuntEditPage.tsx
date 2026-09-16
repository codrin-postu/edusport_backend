import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { EDU_CSS } from './edusportUi';
import { ANUNTURI_TO, ANUNT_EDIT_TO } from './menu';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  ANUNT_API,
  anuntErrorMessage,
  slugifyRo,
  type Anunt,
} from './AnunturiPage';
// The date/time controls the calendar editor uses. Both live in the same vite
// bundle (src/admin/app.tsx imports the plugin by relative path), so importing
// across the boundary is safe and type-checked — see ConfirmDialog's header.
import { SafeDatePicker } from '../../plugins/component-preview/admin/src/components/SafeDatePicker';
import { TimePicker } from '../../plugins/component-preview/admin/src/components/TimePicker';

/**
 * EduSport admin — "Anunț" create / edit page (`?id=<documentId>`, no id = new).
 *
 * WHY A SEPARATE PAGE and not an in-place panel on the list: the list page owns
 * a drag-to-reorder interaction over the whole active group, and an overlay that
 * sits on top of rows being dragged fights it (pointer capture, scroll lock,
 * focus). A route also survives a refresh, is linkable, and matches the two
 * existing precedents (SportivEditPage, CompetitieEditPage) down to the sticky
 * `.pa` action bar — so nothing new has to be learned to use it.
 *
 * Writes go to the custom admin API, not the content-manager: the content type
 * is hidden there. Validation is enforced server-side; the checks below are a
 * courtesy, and any 400 the server returns is shown verbatim.
 */

interface FormState {
  title: string;
  eyebrow: string;
  message: string;
  format: 'card' | 'modal';
  ctaLabel: string;
  ctaUrl: string;
  startDate: string; // YYYY-MM-DD
  startHour: number;
  startMinute: number;
  endDate: string;
  endHour: number;
  endMinute: number;
  isActive: boolean;
  dismissDays: number;
}

const EMPTY: FormState = {
  title: '',
  eyebrow: '',
  message: '',
  format: 'card',
  ctaLabel: '',
  ctaUrl: '',
  startDate: '',
  startHour: 9,
  startMinute: 0,
  endDate: '',
  endHour: 23,
  endMinute: 59,
  isActive: true,
  dismissDays: 7,
};

// --- date/time <-> ISO -----------------------------------------------------
// FormState keeps a plain YYYY-MM-DD plus hour/minute; the API wants one ISO
// datetime. SafeDatePicker hands back a Date anchored at local noon, so only the
// calendar parts are ever read from it.

const dateFromYMD = (s: string): Date | undefined => {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};
const dateToYMD = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function toIso(ymd: string, hour: number, minute: number): string | null {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hour, minute, 0, 0).toISOString();
}

function splitIso(iso: string | null | undefined, fallbackHour: number, fallbackMinute: number) {
  if (!iso) return { date: '', hour: fallbackHour, minute: fallbackMinute };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', hour: fallbackHour, minute: fallbackMinute };
  return { date: dateToYMD(d), hour: d.getHours(), minute: d.getMinutes() };
}

/** "reapare după 7 zile" / "nu mai reapare" — shown live under the field. */
function dismissHint(days: number): string {
  if (!Number.isFinite(days) || days < 0) return '';
  if (days === 0) return 'Nu mai reapare: odată închis de un vizitator, nu îl mai vede niciodată.';
  if (days === 1) return 'Reapare după o zi de la momentul în care vizitatorul l-a închis.';
  return `Reapare după ${days} zile de la momentul în care vizitatorul l-a închis.`;
}

/** Local mirror of the server rules, so the obvious mistakes never round-trip. */
function localValidation(f: FormState): string | null {
  if (!f.title.trim()) return 'Titlul anunțului este obligatoriu.';
  if (!f.message.trim()) return 'Mesajul anunțului este obligatoriu.';
  const start = toIso(f.startDate, f.startHour, f.startMinute);
  const end = toIso(f.endDate, f.endHour, f.endMinute);
  if (!start || !end) return 'Un anunț are nevoie de o dată de început și una de final.';
  if (Date.parse(end) <= Date.parse(start)) return 'Data de final trebuie să fie după data de început.';
  if (!Number.isInteger(f.dismissDays) || f.dismissDays < 0 || f.dismissDays > 365) {
    return 'Numărul de zile trebuie să fie între 0 și 365.';
  }
  return null;
}

const ANUNT_EDIT_CSS = `
.eduf .anun-dt{display:flex;gap:10px;align-items:flex-end}
.eduf .anun-dt > .anun-dt-date{flex:1 1 190px;min-width:0}
.eduf .anun-dt > .anun-dt-time{flex:0 0 130px}
.eduf .anun-seg{display:inline-flex;border:1px solid var(--fieldborder);border-radius:var(--r);overflow:hidden}
.eduf .anun-seg button{font-family:inherit;font-size:12.5px;padding:7px 18px;border:none;background:#fff;color:var(--muted);cursor:pointer;border-right:1px solid var(--fieldborder)}
.eduf .anun-seg button:last-child{border-right:none}
.eduf .anun-seg button.is-on{background:var(--accent);color:#fff;font-weight:700}
.eduf .anun-slug{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
`;

export default function AnuntEditPage() {
  const { get, post, put, del } = useFetchClient();
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
  const [slug, setSlug] = React.useState('');
  const [takenSlugs, setTakenSlugs] = React.useState<string[]>([]);

  const upd = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  /**
   * There is no GET /anunturi/:id — the admin API exposes one list route that
   * already carries every field, so the editor reads the list and
   * picks its row out of it. The same response supplies the slugs already in
   * use, which is what keeps an auto-generated slug unique on create.
   */
  const load = React.useCallback(() => {
    setLoading(true);
    setError(false);
    get(ANUNT_API)
      .then((res: any) => {
        const list: Anunt[] = res?.data?.data ?? res?.data ?? [];
        const rows = Array.isArray(list) ? list : [];
        setTakenSlugs(rows.map((r) => r.slug ?? '').filter(Boolean));
        if (isNew) {
          setForm(EMPTY);
          setSlug('');
          return;
        }
        const a = rows.find((r) => r.documentId === id);
        if (!a) {
          setError(true);
          return;
        }
        const s = splitIso(a.startAt, EMPTY.startHour, EMPTY.startMinute);
        const e = splitIso(a.endAt, EMPTY.endHour, EMPTY.endMinute);
        setSlug(a.slug ?? '');
        setForm({
          title: a.title ?? '',
          eyebrow: a.eyebrow ?? '',
          message: a.message ?? '',
          format: a.format === 'modal' ? 'modal' : 'card',
          ctaLabel: a.ctaLabel ?? '',
          ctaUrl: a.ctaUrl ?? '',
          startDate: s.date,
          startHour: s.hour,
          startMinute: s.minute,
          endDate: e.date,
          endHour: e.hour,
          endMinute: e.minute,
          isActive: a.isActive !== false,
          dismissDays: typeof a.dismissDays === 'number' ? a.dismissDays : 7,
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [get, id, isNew]);

  React.useEffect(() => {
    load();
  }, [load]);

  /** Unique tracking id derived from the title; only ever computed on create. */
  const newSlug = (title: string): string => {
    const base = slugifyRo(title) || 'anunt';
    if (!takenSlugs.includes(base)) return base;
    for (let n = 2; n < 200; n += 1) {
      const candidate = `${base}-${n}`;
      if (!takenSlugs.includes(candidate)) return candidate;
    }
    return `${base}-${Date.now()}`;
  };

  const save = async () => {
    const problem = localValidation(form);
    if (problem) {
      setMsg({ kind: 'err', text: problem });
      return;
    }
    setSaving(true);
    setMsg(null);

    const body: Record<string, unknown> = {
      title: form.title.trim(),
      eyebrow: form.eyebrow.trim() || null,
      message: form.message.trim(),
      format: form.format,
      ctaLabel: form.ctaLabel.trim() || null,
      ctaUrl: form.ctaUrl.trim() || null,
      startAt: toIso(form.startDate, form.startHour, form.startMinute),
      endAt: toIso(form.endDate, form.endHour, form.endMinute),
      isActive: form.isActive,
      dismissDays: form.dismissDays,
    };

    try {
      if (isNew) {
        // `slug` is the Umami tracking id and the uid field is required, so it
        // is generated here rather than left to the content type's default.
        const res: any = await post(ANUNT_API, { ...body, slug: newSlug(form.title) });
        const created = res?.data?.data ?? res?.data;
        setMsg({ kind: 'ok', text: 'Anunț creat.' });
        if (created?.documentId) navigate(`${ANUNT_EDIT_TO}?id=${created.documentId}`, { replace: true });
      } else {
        // `slug` is deliberately NOT sent on update: it is the key the Umami
        // stats are grouped by, and rewriting it would orphan everything the
        // announcement has already collected.
        await put(`${ANUNT_API}/${id}`, body);
        setMsg({ kind: 'ok', text: 'Modificările au fost salvate.' });
        load();
      }
    } catch (err) {
      setMsg({ kind: 'err', text: anuntErrorMessage(err, 'Salvarea a eșuat. Verifică datele și încearcă din nou.') });
    } finally {
      setSaving(false);
    }
  };

  // -- delete ----------------------------------------------------------------

  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [delError, setDelError] = React.useState<string | null>(null);

  const confirmDelete = async () => {
    setDeleting(true);
    setDelError(null);
    try {
      await del(`${ANUNT_API}/${id}`);
      navigate(ANUNTURI_TO);
    } catch (err) {
      setDelError(anuntErrorMessage(err, 'Ștergerea a eșuat.'));
      setDeleting(false);
    }
  };

  const previewSlug = isNew ? slugifyRo(form.title) || '—' : slug || '—';

  return (
    // `pce` opts our custom "Salvează" button out of the global admin SaveBar tagger.
    <div className="eduf pce">
      <style>{EDU_CSS}</style>
      <style>{ANUNT_EDIT_CSS}</style>

      <div className="win">
        <div className="hd">
          <div>
            <h1>{isNew ? 'Anunț nou' : 'Editează anunțul'}</h1>
            <p>{isNew ? 'Completează textul și fereastra de afișare.' : form.title || 'Anunț'}</p>
          </div>
          <div className="hd-right">
            <button className="btn" type="button" onClick={() => navigate(ANUNTURI_TO)}>
              Înapoi
            </button>
            {!isNew && (
              <button
                className="btn danger"
                type="button"
                onClick={() => {
                  setDelError(null);
                  setConfirming(true);
                }}
                disabled={saving}
              >
                Șterge
              </button>
            )}
            <button className="btn pri" type="button" onClick={save} disabled={saving || loading}>
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        </div>

        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

        {loading ? (
          <div className="empty">Se încarcă...</div>
        ) : error ? (
          <div className="empty">Nu am putut încărca anunțul.</div>
        ) : (
          <div className="body" style={{ maxWidth: 760 }}>
            <div className="sec">
              <div className="sh">Text</div>
              <div className="sb">
                <div className="fld">
                  <label htmlFor="anun-eyebrow">Etichetă mică (deasupra titlului)</label>
                  <input
                    id="anun-eyebrow"
                    value={form.eyebrow}
                    onChange={(e) => upd({ eyebrow: e.target.value })}
                    placeholder="ex. Înscrieri deschise"
                  />
                  <div className="hint">Apare cu roșu-cărămiziu, deasupra titlului. Opțional.</div>
                </div>
                <div className="fld">
                  <label htmlFor="anun-title">Titlu</label>
                  <input
                    id="anun-title"
                    value={form.title}
                    onChange={(e) => upd({ title: e.target.value })}
                    placeholder="ex. Sezonul 2026–2027"
                  />
                </div>
                <div className="fld">
                  <label htmlFor="anun-message">Mesaj</label>
                  {/*
                    Plain textarea on purpose. A MarkdownEditor exists in this
                    bundle, but `message` is a plain text field that the site
                    renders as a paragraph — markdown typed here would reach the
                    visitor as literal `**asterisks**`.
                  */}
                  <textarea
                    id="anun-message"
                    rows={4}
                    value={form.message}
                    onChange={(e) => upd({ message: e.target.value })}
                    placeholder="Două-trei rânduri. Text simplu, fără formatare."
                  />
                  <div className="hint">Text simplu: cardul și modalul îl afișează ca un singur paragraf.</div>
                </div>
                <div className="fld">
                  <label>Id de urmărire (Umami)</label>
                  <div className="ro">
                    <b className="anun-slug">{previewSlug}</b>
                    <span>
                      {isNew
                        ? 'se generează automat din titlu la salvare'
                        : 'fixat la creare — statisticile sunt grupate după el'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="sec">
              <div className="sh">Afișare</div>
              <div className="sb">
                <div className="fld">
                  <label>Format</label>
                  <div className="anun-seg">
                    <button
                      type="button"
                      className={form.format === 'card' ? 'is-on' : ''}
                      onClick={() => upd({ format: 'card' })}
                    >
                      Card în colț
                    </button>
                    <button
                      type="button"
                      className={form.format === 'modal' ? 'is-on' : ''}
                      onClick={() => upd({ format: 'modal' })}
                    >
                      Modal în centru
                    </button>
                  </div>
                  <div className="hint">
                    {form.format === 'card'
                      ? 'Card discret jos-dreapta. Pentru mesaje obișnuite.'
                      : 'Blochează pagina până la o acțiune. De folosit rar, pentru anunțuri importante.'}
                  </div>
                </div>

                <div className="row">
                  <div className="fld">
                    <label htmlFor="anun-cta-label">Text buton</label>
                    <input
                      id="anun-cta-label"
                      value={form.ctaLabel}
                      onChange={(e) => upd({ ctaLabel: e.target.value })}
                      placeholder="ex. Vezi detalii"
                    />
                  </div>
                  <div className="fld">
                    <label htmlFor="anun-cta-url">Link buton</label>
                    <input
                      id="anun-cta-url"
                      value={form.ctaUrl}
                      onChange={(e) => upd({ ctaUrl: e.target.value })}
                      placeholder="/inscriere"
                    />
                  </div>
                </div>
                <div className="hint">Lasă ambele goale dacă anunțul nu trimite nicăieri.</div>
              </div>
            </div>

            <div className="sec">
              <div className="sh">Programare</div>
              <div className="sb">
                <div className="fld">
                  <label>Începe</label>
                  <div className="anun-dt">
                    <div className="anun-dt-date">
                      <SafeDatePicker
                        value={dateFromYMD(form.startDate)}
                        maxDate={dateFromYMD(form.endDate)}
                        onChange={(d) => {
                          const next = d ? dateToYMD(d) : '';
                          const endInvalid = !!next && !!form.endDate && form.endDate < next;
                          upd(endInvalid ? { startDate: next, endDate: next } : { startDate: next });
                        }}
                        onClear={() => upd({ startDate: '' })}
                        clearLabel="Șterge"
                        placeholder="zz/ll/aaaa"
                      />
                    </div>
                    <div className="anun-dt-time">
                      <TimePicker
                        id="anun-start-time"
                        hour={form.startHour}
                        minute={form.startMinute}
                        onChange={(h, m) => upd({ startHour: h, startMinute: m })}
                      />
                    </div>
                  </div>
                </div>

                <div className="fld">
                  <label>Se încheie</label>
                  <div className="anun-dt">
                    <div className="anun-dt-date">
                      <SafeDatePicker
                        value={dateFromYMD(form.endDate)}
                        minDate={dateFromYMD(form.startDate)}
                        onChange={(d) => upd({ endDate: d ? dateToYMD(d) : '' })}
                        onClear={() => upd({ endDate: '' })}
                        clearLabel="Șterge"
                        placeholder="zz/ll/aaaa"
                      />
                    </div>
                    <div className="anun-dt-time">
                      <TimePicker
                        id="anun-end-time"
                        hour={form.endHour}
                        minute={form.endMinute}
                        onChange={(h, m) => upd({ endHour: h, endMinute: m })}
                      />
                    </div>
                  </div>
                  <div className="hint">Finalul trebuie să fie după început.</div>
                </div>

                <div className="fld">
                  <label>Stare</label>
                  {/* Segmented control, same as the Format picker above: both
                      states stay visible, so there is nothing to infer from a
                      tick. */}
                  <div className="anun-seg" role="group" aria-label="Stare">
                    <button
                      type="button"
                      className={form.isActive ? 'is-on' : ''}
                      aria-pressed={form.isActive}
                      onClick={() => upd({ isActive: true })}
                    >
                      Activ
                    </button>
                    <button
                      type="button"
                      className={!form.isActive ? 'is-on' : ''}
                      aria-pressed={!form.isActive}
                      onClick={() => upd({ isActive: false })}
                    >
                      Inactiv
                    </button>
                  </div>
                  <div className="hint">
                    {form.isActive
                      ? 'Se afișează pe site între datele de mai sus. Dacă mai multe anunțuri sunt active în același timp, apare cel aflat mai sus în listă.'
                      : 'Nu se afișează pe site, dar rămâne în listă cu statisticile lui. Nu trebuie șters ca să-l oprești.'}
                  </div>
                </div>

                <div className="fld">
                  <label htmlFor="anun-dismiss">Zile până reapare după ce e închis</label>
                  <input
                    id="anun-dismiss"
                    inputMode="numeric"
                    style={{ maxWidth: 120 }}
                    value={String(form.dismissDays)}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, '');
                      upd({ dismissDays: v === '' ? 0 : Math.min(365, parseInt(v, 10)) });
                    }}
                  />
                  <div className="hint">{dismissHint(form.dismissDays)} Maxim 365. Scrie 0 pentru „niciodată".</div>
                </div>
              </div>
            </div>

          </div>
        )}

        {!loading && !error && (
          <div className="pa">
            <button className="btn" type="button" onClick={() => navigate(ANUNTURI_TO)}>
              Înapoi
            </button>
            <div className="grow" />
            <button className="btn pri" type="button" onClick={save} disabled={saving}>
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title="Ștergi anunțul?"
        message={`„${form.title || 'Anunțul'}" se șterge definitiv. Acțiunea nu poate fi anulată.`}
        detail="Dacă vrei doar să nu mai apară pe site, treci-l pe Inactiv — rămâne în listă cu statisticile lui."
        busy={deleting}
        error={delError}
        onCancel={() => {
          if (deleting) return;
          setConfirming(false);
          setDelError(null);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
