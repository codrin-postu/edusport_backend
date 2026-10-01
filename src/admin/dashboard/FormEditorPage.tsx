import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import {
  AdminPage,
  Window,
  PageHeader,
  Section,
  EditorCard,
  RepeatableList,
  Field,
  FieldRow,
  Input,
  Textarea,
  Select,
  Switch,
  Button,
  StatusBadge,
  Notice,
  Loading,
  SaveBar,
  UnsavedGuard,
  useSaveState,
  adminToast,
} from '../ui';
import { FORMULARE_TO } from './menu';

/**
 * EduSport admin — "Editor formular" page.
 *
 * Edits the OVERLAY over the code registry via the admin-guarded endpoints:
 *   GET /api/forms/:type/config/edit   -> editor model (defaults + lock flags +
 *                                          removable/sensitive markers + customs)
 *   PUT /api/forms/:type/config        -> validate + save overlay
 *
 * The editor can: rename labels/help, reorder questions within a step (drag),
 * toggle required (unless locked), edit select options (rename / reorder /
 * enable-disable / add), ADD custom questions (type chosen at creation, locked
 * after), and REMOVE any question (built-in => removedFromForm, keeps the DB
 * column + history; custom => dropped from config). Question types are never
 * editable.
 *
 * Built on the shared admin UI (src/admin/ui): each step is a Section, its
 * questions a RepeatableList (drag / keyboard reorder within the step,
 * expandable rows, delete through ConfirmDialog), the options of a list
 * question a nested RepeatableList. Saving goes through the floating SaveBar
 * (useSaveState, Cmd/Ctrl+S, Renunță restores the loaded configuration) and
 * UnsavedGuard; results are toasts.
 */

interface EditOption {
  value: string;
  label: string;
  enabled: boolean;
  isDefault: boolean;
  _new?: boolean;
}
interface EditQuestion {
  key: string;
  type: string;
  isBuiltin: boolean;
  isCustom: boolean;
  typeLocked: boolean;
  sensitive: boolean;
  removable: boolean;
  defaultLabel: string;
  label: string;
  help: string;
  required: boolean;
  lockedRequired: boolean;
  hidden: boolean;
  canHide: boolean;
  optionSource: 'none' | 'enum' | 'freetext';
  /** checkbox + info render as a card once they have a title or an icon */
  cardCapable?: boolean;
  display: string; // 'plain' | 'card'
  title: string;
  icon: string;
  linkUrl: string;
  linkLabel: string;
  options: EditOption[];
  _new?: boolean; // added client-side, not yet persisted
}
interface EditStep {
  key: string;
  title: string;
  questions: EditQuestion[];
}
interface EditModel {
  type: string;
  removedBuiltins: { key: string; label: string; step: string }[];
  steps: EditStep[];
}

const TITLES: Record<string, string> = {
  inscriere: 'Înscriere cursuri',
  contact: 'Contact',
  voluntariat: 'Voluntariat',
  parteneri: 'Parteneri',
};

// Data-type badge labels. The type is registry-fixed and NOT editable here.
const TYPE_LABEL: Record<string, string> = {
  email: 'email',
  tel: 'telefon',
  text: 'text',
  longtext: 'text lung',
  date: 'dată',
  select: 'listă',
  multiselect: 'alegere multiplă',
  checkbox: 'bifă',
  info: 'bloc info',
};

// Choices for a NEW custom question (label -> internal type).
const NEW_TYPE_CHOICES: { value: string; label: string }[] = [
  { value: 'text', label: 'Text scurt' },
  { value: 'longtext', label: 'Text lung' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Telefon' },
  { value: 'date', label: 'Dată' },
  { value: 'select', label: 'Listă' },
  { value: 'checkbox', label: 'Bifă' },
];

// Page-local bits, tokens only. Kept free of backticks.
const CSS = `
.ui-root .fe-step-closed .ui-sec-b{display:none}
.ui-root .fe-step-closed .ui-sec-h{border-bottom:none}
.ui-root .fe-step-aside{display:flex;align-items:center;gap:8px}
.ui-root .fe-sum{display:flex;align-items:center;gap:8px;min-width:0}
.ui-root .fe-sum-l{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ui-root .fe-meta{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:var(--ui-fs-caption);color:var(--theme-text-muted)}
.ui-root .fe-meta-i{display:inline-flex;align-items:center;gap:6px}
.ui-root .fe-opt{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ui-root .fe-opt .ui-input{flex:1;min-width:140px;width:auto}
.ui-root .fe-opt-val{font-size:10px;color:var(--theme-text-muted);font-family:var(--ui-font-mono);min-width:52px;flex-shrink:0}
.ui-root .fe-opt .ui-switch{font-size:var(--ui-fs-caption);color:var(--theme-text-muted);min-width:70px}
.ui-root .fe-add-acts{display:flex;justify-content:flex-end;gap:8px}
.ui-root .fe-add-row{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap}
.ui-root .fe-add-row .ui-field{flex:1;min-width:180px}
.ui-root .fe-add-row .ui-switch{padding-bottom:8px}
.ui-root .fe-ritem{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--theme-text);padding:5px 0;border-bottom:1px solid var(--theme-border-subtle)}
.ui-root .fe-ritem:last-of-type{border-bottom:none}
.ui-root .fe-ritem-k{color:var(--theme-text-muted);font-size:11px}
.ui-root .fe-ritem .ui-btn{margin-left:auto}
`;

const EDITOR_TYPES = ['inscriere', 'contact', 'voluntariat', 'parteneri'];

function useQueryType(): string {
  const location = useLocation();
  const params = new URLSearchParams(location.search || window.location.search);
  const t = params.get('type') || '';
  return EDITOR_TYPES.includes(t) ? t : 'inscriere';
}

let tmpCounter = 0;
const tmpId = (p: string) => `${p}${Date.now().toString(36)}${(tmpCounter++).toString(36)}`;

export default function FormEditorPage() {
  const { get, put } = useFetchClient();
  const type = useQueryType();
  const save = useSaveState();
  const { reset: resetSave, setDirty } = save;

  const [model, setModel] = React.useState<EditModel | null>(null);
  const [removed, setRemoved] = React.useState<RemovedBuiltin[]>([]);
  // Last loaded / saved configuration: the dirty baseline and what Renunță restores.
  const [baseline, setBaseline] = React.useState<{ model: EditModel; removed: RemovedBuiltin[] } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [openSteps, setOpenSteps] = React.useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = React.useState<Record<string, boolean>>({});
  const [addDraft, setAddDraft] = React.useState<Record<string, AddDraft>>({});
  // Remounts a step's list after an add, so the new question opens.
  const [listGen, setListGen] = React.useState<Record<string, { n: number; open: string[] }>>({});

  const adopt = React.useCallback((m: EditModel) => {
    const rem = m.removedBuiltins ?? [];
    setModel(m);
    setRemoved(rem);
    setBaseline({ model: clone(m), removed: clone(rem) });
  }, []);

  React.useEffect(() => {
    let off = false;
    setLoading(true);
    setError(null);
    resetSave();
    get(`/api/forms/${type}/config/edit`)
      .then((r: any) => {
        if (off) return;
        const m = r.data as EditModel;
        adopt(m);
        const os: Record<string, boolean> = {};
        m.steps.forEach((s) => (os[s.key] = true));
        setOpenSteps(os);
        setListGen({});
      })
      .catch(() => {
        if (!off) setError('Nu am putut încărca configurația formularului.');
      })
      .finally(() => {
        if (!off) setLoading(false);
      });
    return () => {
      off = true;
    };
  }, [get, type, adopt, resetSave]);

  // Dirty = differs from the last loaded / saved configuration.
  React.useEffect(() => {
    if (!model || !baseline) return;
    const same =
      JSON.stringify(model.steps) === JSON.stringify(baseline.model.steps) &&
      JSON.stringify(removed) === JSON.stringify(baseline.removed);
    setDirty(!same);
  }, [model, removed, baseline, setDirty]);

  const mutate = React.useCallback((fn: (m: EditModel) => void) => {
    setModel((prev) => {
      if (!prev) return prev;
      const next: EditModel = clone(prev);
      fn(next);
      return next;
    });
  }, []);

  const findQ = (m: EditModel, stepKey: string, qKey: string) =>
    m.steps.find((s) => s.key === stepKey)?.questions.find((x) => x.key === qKey);

  const setQ = (stepKey: string, qKey: string, patch: Partial<EditQuestion>) =>
    mutate((m) => {
      const q = findQ(m, stepKey, qKey);
      if (q) Object.assign(q, patch);
    });

  // Reorder or delete within a step (from the RepeatableList). A deleted
  // built-in question is remembered in `removed` (removedFromForm on save:
  // the DB column and the history stay); a custom one is simply dropped.
  const setStepQuestions = (stepKey: string, next: EditQuestion[]) => {
    const prev = model?.steps.find((s) => s.key === stepKey)?.questions ?? [];
    const gone = prev.filter((q) => q.isBuiltin && !next.some((n) => n.key === q.key));
    if (gone.length > 0) {
      setRemoved((r) => [
        ...r,
        ...gone.filter((q) => !r.some((x) => x.key === q.key)).map((q) => ({ key: q.key, label: q.label, step: stepKey })),
      ]);
    }
    mutate((m) => {
      const step = m.steps.find((s) => s.key === stepKey);
      if (step) step.questions = next;
    });
  };

  const setOptions = (stepKey: string, qKey: string, next: EditOption[]) =>
    mutate((m) => {
      const q = findQ(m, stepKey, qKey);
      if (q) q.options = next;
    });

  // --- add custom question
  const draftFor = (stepKey: string): AddDraft => addDraft[stepKey] ?? EMPTY_DRAFT;
  const setDraft = (stepKey: string, patch: Partial<AddDraft>) =>
    setAddDraft((d) => ({ ...d, [stepKey]: { ...(d[stepKey] ?? EMPTY_DRAFT), ...patch } }));
  const openAdd = (stepKey: string) => {
    setAddOpen((s) => ({ ...s, [stepKey]: true }));
    setAddDraft((d) => ({ ...d, [stepKey]: d[stepKey] ?? EMPTY_DRAFT }));
  };
  const cancelAdd = (stepKey: string) => {
    setAddOpen((s) => ({ ...s, [stepKey]: false }));
    setAddDraft((d) => ({ ...d, [stepKey]: EMPTY_DRAFT }));
  };
  const commitAdd = (stepKey: string) => {
    const d = draftFor(stepKey);
    const label = d.label.trim();
    if (!label) {
      adminToast.error('Eticheta întrebării este obligatorie.');
      return;
    }
    const q = newCustomQuestion(label, d.type, d.required);
    mutate((m) => {
      const step = m.steps.find((s) => s.key === stepKey);
      if (step) step.questions.push(q);
    });
    setListGen((g) => ({ ...g, [stepKey]: { n: (g[stepKey]?.n ?? 0) + 1, open: [q.key] } }));
    cancelAdd(stepKey);
  };

  const discard = () => {
    if (!baseline) return;
    setModel(clone(baseline.model));
    setRemoved(clone(baseline.removed));
    resetSave();
  };

  const onSave = () => {
    if (!model) return;
    void save.run(async () => {
      try {
        const r: any = await put(`/api/forms/${type}/config`, toPayload(model, removed));
        adopt(r.data as EditModel);
        setListGen({});
      } catch (e: any) {
        const msg =
          e?.response?.data?.error?.message ||
          e?.response?.data?.error ||
          'Salvarea a fost respinsă. Verificați modificările.';
        throw new Error(typeof msg === 'string' ? msg : 'Salvarea a fost respinsă.');
      }
    });
  };

  const title = TITLES[type] ?? type;

  const renderQuestion = (stepKey: string, q: EditQuestion) => (
    <QuestionBody
      q={q}
      onChange={(patch) => setQ(stepKey, q.key, patch)}
      onOptions={(next) => setOptions(stepKey, q.key, next)}
    />
  );

  return (
    <AdminPage>
      <style>{CSS}</style>
      <Window>
        <PageHeader
          back={{ to: FORMULARE_TO, label: 'Formulare' }}
          title={title}
          subtitle={
            <>
              Editează textul, ordinea, opțiunile și întrebările formularului {title}. Adaugă sau șterge întrebări; nu
              se pot crea formulare noi și tipul unei întrebări nu se schimbă. Modificările apar pe site după salvare.
            </>
          }
        />

        {loading ? (
          <Loading />
        ) : error || !model ? (
          <div className="ui-body">
            <Notice tone="danger">{error ?? 'Nu am putut încărca configurația formularului.'}</Notice>
          </div>
        ) : (
          <div className="ui-body">
            {model.steps.map((step, si) => {
              const open = openSteps[step.key] !== false;
              const gen = listGen[step.key];
              const n = step.questions.length;
              return (
                <Section
                  key={step.key}
                  className={open ? undefined : 'fe-step-closed'}
                  title={`${si + 1}. ${step.title}`}
                  aside={
                    <span className="fe-step-aside">
                      <span className="ui-hint ui-num">
                        {n} {n === 1 ? 'element' : 'elemente'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-expanded={open}
                        onClick={() => setOpenSteps((s) => ({ ...s, [step.key]: !open }))}
                      >
                        {open ? 'Restrânge' : 'Extinde'}
                      </Button>
                    </span>
                  }
                >
                  {open ? (
                    <>
                      <RepeatableList<EditQuestion>
                        key={`${type}-${step.key}-${gen?.n ?? 0}`}
                        aria-label={`Întrebările pasului ${step.title}`}
                        items={step.questions}
                        onChange={(next) => setStepQuestions(step.key, next)}
                        getKey={(q) => q.key}
                        reorder
                        expandable
                        defaultExpanded={gen?.open}
                        confirmDelete={{
                          message: 'Întrebarea dispare din formular după ce salvezi.',
                          detail:
                            'Un câmp încorporat își păstrează coloana și datele deja trimise în tabelul de rezultate și poate fi readus din lista câmpurilor scoase.',
                        }}
                        itemLabel={(q) => `${q.sensitive ? 'câmpul sensibil ' : 'întrebarea '}„${questionLabel(q)}”`}
                        renderSummary={(q) => <QuestionSummary q={q} />}
                        renderRow={(q) => renderQuestion(step.key, q)}
                        onAdd={addOpen[step.key] ? undefined : () => openAdd(step.key)}
                        addLabel="Adaugă întrebare"
                        emptyLabel="Nicio întrebare în acest pas."
                      />
                      {addOpen[step.key] && (
                        <EditorCard title="Întrebare nouă">
                          <Field label="Etichetă" required>
                            <Input
                              autoFocus
                              placeholder="ex. Alergii sau probleme medicale"
                              value={draftFor(step.key).label}
                              onChange={(e) => setDraft(step.key, { label: e.target.value })}
                            />
                          </Field>
                          <div className="fe-add-row">
                            <Field label="Tip" hint="Tipul nu se mai poate schimba după adăugare.">
                              <Select
                                value={draftFor(step.key).type}
                                onChange={(v) => setDraft(step.key, { type: v })}
                                options={NEW_TYPE_CHOICES}
                              />
                            </Field>
                            <Switch
                              checked={draftFor(step.key).required}
                              onChange={(v) => setDraft(step.key, { required: v })}
                              label="Obligatoriu"
                            />
                          </div>
                          <div className="fe-add-acts">
                            <Button variant="secondary" size="sm" onClick={() => cancelAdd(step.key)}>
                              Anulează
                            </Button>
                            <Button size="sm" onClick={() => commitAdd(step.key)}>
                              Adaugă
                            </Button>
                          </div>
                        </EditorCard>
                      )}
                    </>
                  ) : null}
                </Section>
              );
            })}

            {removed.length > 0 && (
              <Section title="Câmpuri scoase din formular">
                <div>
                  {removed.map((r) => (
                    <div className="fe-ritem" key={r.key}>
                      <span>{r.label}</span>
                      <span className="fe-ritem-k">{r.key}</span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setRemoved((cur) => cur.filter((x) => x.key !== r.key))}
                        title="Anulează scoaterea (câmpul revine în formular la salvare)"
                      >
                        Anulează
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="ui-hint">
                  Coloanele și datele deja trimise rămân în tabelul de rezultate, marcate „(eliminată)". Anulează pentru a
                  readuce câmpul în formular la următoarea salvare.
                </div>
              </Section>
            )}
          </div>
        )}

        {!loading && model && <SaveBar {...save.bar} onSave={onSave} onDiscard={discard} />}
      </Window>
      <UnsavedGuard when={save.dirty} />
    </AdminPage>
  );
}

// ---- helpers ---------------------------------------------------------------

type RemovedBuiltin = { key: string; label: string; step: string };
type AddDraft = { label: string; type: string; required: boolean };
const EMPTY_DRAFT: AddDraft = { label: '', type: 'text', required: false };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const questionLabel = (q: EditQuestion) => q.label || q.defaultLabel || '(fără etichetă)';

function newCustomQuestion(label: string, type: string, required: boolean): EditQuestion {
  return {
    key: tmpId('c_'),
    type,
    isBuiltin: false,
    isCustom: true,
    typeLocked: true,
    sensitive: false,
    removable: true,
    defaultLabel: '',
    label,
    help: '',
    required,
    lockedRequired: false,
    hidden: false,
    canHide: true,
    optionSource: type === 'select' ? 'freetext' : 'none',
    cardCapable: type === 'checkbox',
    display: 'plain',
    title: '',
    icon: '',
    linkUrl: '',
    linkLabel: '',
    options:
      type === 'select'
        ? [
            { value: tmpId('tmp_'), label: 'Opțiunea 1', enabled: true, isDefault: false, _new: true },
            { value: tmpId('tmp_'), label: 'Opțiunea 2', enabled: true, isDefault: false, _new: true },
          ]
        : [],
    _new: true,
  };
}

function toPayload(model: EditModel, removed: RemovedBuiltin[]) {
  return {
    removedBuiltins: removed.map((r) => r.key),
    steps: model.steps.map((s) => ({
      key: s.key,
      questions: s.questions.map((q) => ({
        key: q._new ? '' : q.key,
        type: q.type,
        isCustom: q.isCustom,
        label: q.label,
        help: q.help,
        required: q.required,
        hidden: q.hidden,
        display: q.display,
        title: q.title,
        icon: q.icon,
        linkUrl: q.linkUrl,
        linkLabel: q.linkLabel,
        options:
          q.type === 'select' || q.type === 'multiselect'
            ? q.options.map((o) => ({ value: o._new ? '' : o.value, label: o.label, enabled: o.enabled }))
            : undefined,
      })),
    })),
  };
}

function TypeBadge({ type }: { type: string }) {
  return <StatusBadge tone={type === 'info' ? 'warning' : 'primary'}>{TYPE_LABEL[type] ?? type}</StatusBadge>;
}

/** Collapsed row: label, the Field-style required mark, the data-type badge. */
function QuestionSummary({ q }: { q: EditQuestion }) {
  const req = q.type !== 'info' && q.required;
  return (
    <span className="fe-sum">
      <span className="fe-sum-l">
        {questionLabel(q)}
        {req && (
          <>
            <span className="ui-req" aria-hidden="true">
              *
            </span>
            <span className="ui-sr"> (obligatoriu)</span>
          </>
        )}
      </span>
      <TypeBadge type={q.type} />
    </span>
  );
}

const ICON_OPTIONS = [
  { value: '', label: 'Fără pictogramă' },
  { value: 'book', label: 'Carte (regulament)' },
  { value: 'shield', label: 'Scut (protecția datelor)' },
  { value: 'calendar', label: 'Calendar (program)' },
  { value: 'info', label: 'Informație' },
  { value: 'award', label: 'Premiu' },
  { value: 'users', label: 'Persoane' },
];

/** The expanded editor of one question. */
function QuestionBody({
  q,
  onChange,
  onOptions,
}: {
  q: EditQuestion;
  onChange: (patch: Partial<EditQuestion>) => void;
  onOptions: (next: EditOption[]) => void;
}) {
  const isInfo = q.type === 'info';
  return (
    <>
      <Field
        label={isInfo ? 'Text informativ' : 'Etichetă (text afișat)'}
        hint={q.defaultLabel && !isInfo ? `Implicit: ${q.defaultLabel}` : undefined}
      >
        {isInfo ? (
          <Textarea value={q.label} onChange={(e) => onChange({ label: e.target.value })} />
        ) : (
          <Input value={q.label} onChange={(e) => onChange({ label: e.target.value })} />
        )}
      </Field>

      {!isInfo && (
        <Field label="Text ajutor / placeholder">
          <Input value={q.help} placeholder="Opțional" onChange={(e) => onChange({ help: e.target.value })} />
        </Field>
      )}

      {q.cardCapable && (
        <Field label="Mod de afișare" hint="Alege cum arată pe site.">
          <Select
            value={q.display}
            onChange={(v) => onChange({ display: v })}
            options={[
              { value: 'plain', label: isInfo ? 'Text simplu' : 'Bifă simplă' },
              { value: 'card', label: 'Card cu pictogramă și link' },
            ]}
          />
        </Field>
      )}

      {q.cardCapable && q.display === 'card' && (
        <>
          <FieldRow>
            <Field label="Titlu card">
              <Input value={q.title} placeholder="ex: Regulamentul Cursurilor" onChange={(e) => onChange({ title: e.target.value })} />
            </Field>
            <Field label="Pictogramă">
              <Select value={q.icon} onChange={(v) => onChange({ icon: v })} options={ICON_OPTIONS} />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Link (opțional)">
              <Input value={q.linkUrl} placeholder="https://..." onChange={(e) => onChange({ linkUrl: e.target.value })} />
            </Field>
            <Field label="Etichetă link (opțional)">
              <Input
                value={q.linkLabel}
                placeholder="Text afișat pentru link"
                onChange={(e) => onChange({ linkLabel: e.target.value })}
              />
            </Field>
          </FieldRow>
        </>
      )}

      <div className="fe-meta">
        {!isInfo && (
          <span className="fe-meta-i">
            <Switch
              checked={q.required}
              onChange={(v) => onChange({ required: v })}
              disabled={q.lockedRequired}
              label="Obligatoriu"
            />
            {q.lockedRequired && <StatusBadge tone="warning">blocat</StatusBadge>}
          </span>
        )}
        <span className="fe-meta-i">
          tip: <TypeBadge type={q.type} />
          {q.isCustom && <span>tipul nu se poate schimba</span>}
        </span>
      </div>

      {q.isBuiltin && (
        <Notice tone="warning">
          Câmp încorporat. La ștergere dispare din formular, dar coloana și datele deja trimise rămân în tabelul de
          rezultate.
        </Notice>
      )}

      {(q.type === 'select' || q.type === 'multiselect') && <OptionsEditor q={q} onOptions={onOptions} />}
    </>
  );
}

/** Options of a list question: rename, reorder, enable / hide, add and remove (free-text lists only). */
function OptionsEditor({ q, onOptions }: { q: EditQuestion; onOptions: (next: EditOption[]) => void }) {
  const fixed = q.optionSource === 'enum';
  return (
    <div className="ui-field">
      <span className="ui-label">Opțiuni</span>
      <RepeatableList<EditOption>
        aria-label={`Opțiunile întrebării ${questionLabel(q)}`}
        items={q.options}
        onChange={onOptions}
        getKey={(o) => o.value}
        reorder
        hideDelete
        itemLabel={(o, i) => `opțiunea ${o.label || i + 1}`}
        newItem={fixed ? undefined : () => ({ value: tmpId('tmp_'), label: '', enabled: true, isDefault: false, _new: true })}
        addLabel="Adaugă opțiune"
        emptyLabel="Nicio opțiune."
        renderRow={(o, i, api) => (
          <div className="fe-opt">
            {!o._new && o.value !== o.label && <span className="fe-opt-val">{o.value}</span>}
            <Input
              value={o.label}
              placeholder="Etichetă opțiune"
              aria-label={`Eticheta opțiunii ${i + 1}`}
              onChange={(e) => api.update({ label: e.target.value })}
            />
            <Switch
              checked={o.enabled}
              onChange={(v) => api.update({ enabled: v })}
              label={o.enabled ? 'activ' : 'ascuns'}
            />
            {!fixed && !o.isDefault && (
              <button
                type="button"
                className="ui-iconbtn ui-iconbtn--danger"
                title="Elimină opțiunea"
                aria-label={`Elimină opțiunea ${o.label || i + 1}`}
                onClick={api.remove}
              >
                <span aria-hidden="true">✕</span>
              </button>
            )}
          </div>
        )}
      />
      {fixed && <div className="ui-hint">Opțiunile acestei liste sunt fixe; se pot redenumi și dezactiva.</div>}
      <div className="ui-hint">
        Poți redenumi, reordona sau dezactiva opțiuni. Redenumirea nu schimbă datele deja trimise; o opțiune ștearsă cu
        date vechi rămâne vizibilă în rezultate.
      </div>
    </div>
  );
}
