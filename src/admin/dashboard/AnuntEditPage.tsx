import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import {
  AdminPage,
  Window,
  PageHeader,
  Section,
  Field,
  FieldRow,
  Input,
  Textarea,
  DateRangeInput,
  TimeInput,
  NumberInput,
  SegmentedControl,
  Button,
  Notice,
  Loading,
  SaveBar,
  UnsavedGuard,
  releaseUnsavedGuards,
  useSaveState,
  adminToast,
  parseTimeText,
} from '../ui';
import { usePageForm } from '../lib';
import { ANUNTURI_TO, ANUNT_EDIT_TO } from './menu';
import { ConfirmDialog } from '../ConfirmDialog';
import { ANUNT_API, anuntErrorMessage, slugifyRo, type Anunt } from './AnunturiPage';

/**
 * EduSport admin, "Anunț" create / edit page (`?id=<documentId>`, no id = new).
 *
 * WHY A SEPARATE PAGE and not an in-place panel on the list: the list page owns
 * a drag-to-reorder interaction over the whole active group, and an overlay that
 * sits on top of rows being dragged fights it (pointer capture, scroll lock,
 * focus). A route also survives a refresh, is linkable, and matches the two
 * existing precedents (SportivEditPage, CompetitieEditPage).
 *
 * Writes go to the custom admin API, not the content-manager: the content type
 * is hidden there. Validation is enforced server-side; the checks below are a
 * courtesy, and any 400 the server returns is shown verbatim.
 *
 * Built on the shared admin UI (src/admin/ui): usePageForm + the floating
 * SaveBar + UnsavedGuard, toasts for feedback. Dates on DateRangeInput (native
 * date inputs, plain YYYY-MM-DD strings, so no timezone shift), times on
 * TimeInput.
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

const FORMAT_OPTIONS = [
  { value: 'card', label: 'Card în colț' },
  { value: 'modal', label: 'Modal în centru' },
] as const;
const STATE_OPTIONS = [
  { value: 'on', label: 'Activ' },
  { value: 'off', label: 'Inactiv' },
] as const;

// Page-local styles, tokens only. No backticks inside.
const ANUNT_EDIT_CSS = `
.ui-root .anun-narrow{max-width:760px;width:100%}
.ui-root .anun-slug{font-family:var(--ui-font-mono);font-size:12px;font-weight:700;color:var(--theme-text)}
.ui-root .anun-ro{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.ui-root .anun-days{max-width:140px}
`;

// --- date/time <-> ISO -----------------------------------------------------
// FormState keeps a plain YYYY-MM-DD plus hour/minute; the API wants one ISO
// datetime in the browser's local time.

const pad2 = (n: number) => String(n).padStart(2, '0');
const dateToYMD = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const hhmm = (h: number, m: number) => `${pad2(h)}:${pad2(m)}`;

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

/** "reapare după 7 zile" / "nu mai reapare", shown live under the field. */
function dismissHint(days: number): string {
  if (!Number.isFinite(days) || days < 0) return '';
  if (days === 0) return 'Nu mai reapare: odată închis de un vizitator, nu îl mai vede niciodată.';
  if (days === 1) return 'Reapare după o zi de la momentul în care vizitatorul l-a închis.';
  return `Reapare după ${days} zile de la momentul în care vizitatorul l-a închis.`;
}

type Problem = { field: 'title' | 'message' | 'dates' | 'days'; text: string };

/** Local mirror of the server rules, so the obvious mistakes never round-trip. */
function localValidation(f: FormState): Problem | null {
  if (!f.title.trim()) return { field: 'title', text: 'Titlul anunțului este obligatoriu.' };
  if (!f.message.trim()) return { field: 'message', text: 'Mesajul anunțului este obligatoriu.' };
  const start = toIso(f.startDate, f.startHour, f.startMinute);
  const end = toIso(f.endDate, f.endHour, f.endMinute);
  if (!start || !end) return { field: 'dates', text: 'Un anunț are nevoie de o dată de început și una de final.' };
  if (Date.parse(end) <= Date.parse(start)) return { field: 'dates', text: 'Data de final trebuie să fie după data de început.' };
  if (!Number.isInteger(f.dismissDays) || f.dismissDays < 0 || f.dismissDays > 365) {
    return { field: 'days', text: 'Numărul de zile trebuie să fie între 0 și 365.' };
  }
  return null;
}

function toForm(a: Anunt): FormState {
  const s = splitIso(a.startAt, EMPTY.startHour, EMPTY.startMinute);
  const e = splitIso(a.endAt, EMPTY.endHour, EMPTY.endMinute);
  return {
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
  };
}

interface Loaded {
  rows: Anunt[];
}

export default function AnuntEditPage() {
  const { get, post, put, del } = useFetchClient();
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
  const [problem, setProblem] = React.useState<Problem | null>(null);
  const [slug, setSlug] = React.useState('');
  const [takenSlugs, setTakenSlugs] = React.useState<string[]>([]);
  const loadedFor = React.useRef<string | null>(null);

  /**
   * There is no GET /anunturi/:id: the admin API exposes one list route that
   * already carries every field, so the editor reads the list and
   * picks its row out of it. The same response supplies the slugs already in
   * use, which is what keeps an auto-generated slug unique on create.
   */
  const fetchList = React.useCallback(async (): Promise<Loaded> => {
    const res: any = await get(ANUNT_API);
    const list: Anunt[] = res?.data?.data ?? res?.data ?? [];
    return { rows: Array.isArray(list) ? list : [] };
  }, [get]);

  /** Applies a fresh list to the page; false when the entry is not in it. */
  const apply = React.useCallback((docId: string, { rows }: Loaded): boolean => {
    setTakenSlugs(rows.map((r) => r.slug ?? '').filter(Boolean));
    if (!docId) {
      setLoaded(EMPTY);
      setSlug('');
      return true;
    }
    const a = rows.find((r) => r.documentId === docId);
    if (!a) return false;
    setSlug(a.slug ?? '');
    setLoaded(toForm(a));
    return true;
  }, []);

  React.useEffect(() => {
    if (loadedFor.current === id) return;
    let off = false;
    setLoading(true);
    setError(false);
    fetchList()
      .then((list) => {
        if (off) return;
        if (apply(id, list)) loadedFor.current = id;
        else setError(true);
      })
      .catch(() => !off && setError(true))
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
  }, [id, fetchList, apply]);

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

  const onSave = () => {
    const found = localValidation(v);
    setProblem(found);
    if (found) {
      adminToast.error(found.text);
      return;
    }

    const body: Record<string, unknown> = {
      title: v.title.trim(),
      eyebrow: v.eyebrow.trim() || null,
      message: v.message.trim(),
      format: v.format,
      ctaLabel: v.ctaLabel.trim() || null,
      ctaUrl: v.ctaUrl.trim() || null,
      startAt: toIso(v.startDate, v.startHour, v.startMinute),
      endAt: toIso(v.endDate, v.endHour, v.endMinute),
      isActive: v.isActive,
      dismissDays: v.dismissDays,
    };

    let createdId: string | null = null;
    void save
      .run(async () => {
        try {
          if (isNew) {
            // `slug` is the Umami tracking id and the uid field is required, so it
            // is generated here rather than left to the content type's default.
            const res: any = await post(ANUNT_API, { ...body, slug: newSlug(v.title) });
            const created = res?.data?.data ?? res?.data;
            if (created?.documentId) {
              createdId = created.documentId as string;
              const list = await fetchList().catch(() => null);
              if (list && apply(createdId, list)) loadedFor.current = createdId;
            }
          } else {
            // `slug` is deliberately NOT sent on update: it is the key the Umami
            // stats are grouped by, and rewriting it would orphan everything the
            // announcement has already collected.
            await put(`${ANUNT_API}/${id}`, body);
            const list = await fetchList().catch(() => null);
            if (list) apply(id, list);
          }
        } catch (err) {
          throw new Error(anuntErrorMessage(err, 'Salvarea a eșuat. Verifică datele și încearcă din nou.'));
        }
      })
      .then((ok) => {
        if (ok && createdId) {
          releaseUnsavedGuards();
          navigate(`${ANUNT_EDIT_TO}?id=${createdId}`, { replace: true });
        }
      });
  };

  const discard = () => {
    setProblem(null);
    form.reset();
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
      releaseUnsavedGuards();
      navigate(ANUNTURI_TO);
    } catch (err) {
      setDelError(anuntErrorMessage(err, 'Ștergerea a eșuat.'));
      setDeleting(false);
    }
  };

  const previewSlug = (isNew ? slugifyRo(v.title) : slug) || '-';
  const ready = !loading && !error;
  const errFor = (field: Problem['field']) => (problem?.field === field ? problem.text : undefined);

  const setTime = (which: 'start' | 'end') => (t: string | null) => {
    const hm = t ? parseTimeText(t) : null;
    if (!hm) return;
    upd(which === 'start' ? { startHour: hm.hour, startMinute: hm.minute } : { endHour: hm.hour, endMinute: hm.minute });
  };

  return (
    <AdminPage>
      <style>{ANUNT_EDIT_CSS}</style>
      <Window>
        <PageHeader
          back={{ to: ANUNTURI_TO, label: 'Anunțuri' }}
          title={isNew ? 'Anunț nou' : 'Editează anunțul'}
          subtitle={isNew ? 'Completează textul și fereastra de afișare.' : loaded.title || 'Anunț'}
          actions={
            ready && !isNew ? (
              <Button
                variant="danger"
                onClick={() => {
                  setDelError(null);
                  setConfirming(true);
                }}
                disabled={save.saving}
              >
                Șterge
              </Button>
            ) : undefined
          }
        />

        {loading ? (
          <Loading />
        ) : error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca anunțul.</Notice>
          </div>
        ) : (
          <div className="ui-body">
            <div className="anun-narrow ui-stack">
              <Section title="Text">
                <div className="ui-stack">
                  <Field label="Etichetă mică (deasupra titlului)" hint="Apare cu roșu-cărămiziu, deasupra titlului. Opțional.">
                    <Input value={v.eyebrow} onChange={(e) => upd({ eyebrow: e.target.value })} placeholder="ex. Înscrieri deschise" />
                  </Field>
                  <Field label="Titlu" required error={errFor('title')}>
                    <Input value={v.title} onChange={(e) => upd({ title: e.target.value })} placeholder="ex. Sezonul 2026–2027" />
                  </Field>
                  {/*
                    Plain textarea on purpose. A MarkdownEditor exists in this
                    bundle, but `message` is a plain text field that the site
                    renders as a paragraph: markdown typed here would reach the
                    visitor as literal `**asterisks**`.
                  */}
                  <Field
                    label="Mesaj"
                    required
                    error={errFor('message')}
                    hint="Text simplu: cardul și modalul îl afișează ca un singur paragraf."
                  >
                    <Textarea
                      rows={4}
                      value={v.message}
                      onChange={(e) => upd({ message: e.target.value })}
                      placeholder="Două-trei rânduri. Text simplu, fără formatare."
                    />
                  </Field>
                  <div className="ui-field">
                    <span className="ui-label">Id de urmărire (Umami)</span>
                    <div className="anun-ro">
                      <code className="anun-slug">{previewSlug}</code>
                      <span className="ui-hint">
                        {isNew
                          ? 'se generează automat din titlu la salvare'
                          : 'fixat la creare, statisticile sunt grupate după el'}
                      </span>
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Afișare">
                <div className="ui-stack">
                  <div className="ui-field">
                    <span className="ui-label" id="anun-format-label">
                      Format
                    </span>
                    <SegmentedControl
                      aria-labelledby="anun-format-label"
                      options={[...FORMAT_OPTIONS]}
                      value={v.format}
                      onChange={(format) => upd({ format })}
                    />
                    <div className="ui-hint">
                      {v.format === 'card'
                        ? 'Card discret jos-dreapta. Pentru mesaje obișnuite.'
                        : 'Blochează pagina până la o acțiune. De folosit rar, pentru anunțuri importante.'}
                    </div>
                  </div>

                  <div>
                    <FieldRow>
                      <Field label="Text buton">
                        <Input value={v.ctaLabel} onChange={(e) => upd({ ctaLabel: e.target.value })} placeholder="ex. Vezi detalii" />
                      </Field>
                      <Field label="Link buton">
                        <Input value={v.ctaUrl} onChange={(e) => upd({ ctaUrl: e.target.value })} placeholder="/inscriere" />
                      </Field>
                    </FieldRow>
                    <div className="ui-hint">Lasă ambele goale dacă anunțul nu trimite nicăieri.</div>
                  </div>
                </div>
              </Section>

              <Section title="Programare">
                <div className="ui-stack">
                  <DateRangeInput
                    startLabel="Începe"
                    endLabel="Se încheie"
                    required
                    value={{ start: v.startDate || null, end: v.endDate || null }}
                    onChange={(r) => upd({ startDate: r.start ?? '', endDate: r.end ?? '' })}
                    error={errFor('dates')}
                    hint="Finalul trebuie să fie după început."
                  />
                  <FieldRow>
                    <Field label="Ora de început">
                      <TimeInput value={hhmm(v.startHour, v.startMinute)} allowEmpty={false} onChange={setTime('start')} />
                    </Field>
                    <Field label="Ora de final">
                      <TimeInput value={hhmm(v.endHour, v.endMinute)} allowEmpty={false} onChange={setTime('end')} />
                    </Field>
                  </FieldRow>

                  <div className="ui-field">
                    <span className="ui-label" id="anun-state-label">
                      Stare
                    </span>
                    {/* Segmented control, same as the Format picker above: both
                        states stay visible, so there is nothing to infer from a
                        tick. */}
                    <SegmentedControl
                      aria-labelledby="anun-state-label"
                      options={[...STATE_OPTIONS]}
                      value={v.isActive ? 'on' : 'off'}
                      onChange={(s) => upd({ isActive: s === 'on' })}
                    />
                    <div className="ui-hint">
                      {v.isActive
                        ? 'Se afișează pe site între datele de mai sus. Dacă mai multe anunțuri sunt active în același timp, apare cel aflat mai sus în listă.'
                        : 'Nu se afișează pe site, dar rămâne în listă cu statisticile lui. Nu trebuie șters ca să-l oprești.'}
                    </div>
                  </div>

                  <Field
                    label="Zile până reapare după ce e închis"
                    error={errFor('days')}
                    hint={`${dismissHint(v.dismissDays)} Maxim 365. Scrie 0 pentru „niciodată".`}
                  >
                    <NumberInput
                      className="anun-days"
                      value={v.dismissDays}
                      min={0}
                      max={365}
                      label="zilele"
                      onChange={(n) => upd({ dismissDays: n ?? 0 })}
                    />
                  </Field>
                </div>
              </Section>
            </div>
          </div>
        )}

        {ready && <SaveBar {...save.bar} onSave={onSave} onDiscard={discard} />}
      </Window>

      <ConfirmDialog
        open={confirming}
        title="Ștergi anunțul?"
        message={`„${loaded.title || 'Anunțul'}" se șterge definitiv. Acțiunea nu poate fi anulată.`}
        detail="Dacă vrei doar să nu mai apară pe site, treci-l pe Inactiv: rămâne în listă cu statisticile lui."
        busy={deleting}
        error={delError}
        onCancel={() => {
          if (deleting) return;
          setConfirming(false);
          setDelError(null);
        }}
        onConfirm={confirmDelete}
      />
      <UnsavedGuard when={form.dirty} />
    </AdminPage>
  );
}
