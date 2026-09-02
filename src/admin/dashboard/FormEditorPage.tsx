import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
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
 * editable. Light-only, shared admin tokens.
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
};

// Data-type badge labels. The type is registry-fixed and NOT editable here.
const TYPE_LABEL: Record<string, string> = {
  email: 'email',
  tel: 'telefon',
  text: 'text',
  longtext: 'text lung',
  date: 'dată',
  select: 'listă',
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

const CSS = `
.esfe{--bg:#eef0f4;--chrome:#fff;--ink:#1b1d22;--muted:#727888;--line:#e0e2e8;--border:#dcdcdc;
  --accent:#2138b8;--accent-soft:#eef1fb;--danger:#be3330;--field:#f7f8fa;--ok:#1f7a4d;--warn:#8a5a00;--warn-s:#fbf1df;--r:5px;--r2:4px;
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--bg);min-height:100%;padding:24px 16px 80px;box-sizing:border-box;line-height:1.5}
.esfe *{box-sizing:border-box}
.esfe .wrap{max-width:760px;margin:0 auto}
.esfe input,.esfe select,.esfe textarea{font-family:inherit;font-size:13px;color:var(--ink);background:#fff;border:1px solid #d0d0d0;border-radius:var(--r);padding:7px 9px}
.esfe input:focus,.esfe textarea:focus,.esfe select:focus{outline:none;border-color:var(--accent)}
.esfe textarea{resize:vertical;min-height:52px;width:100%}
.esfe .btn{font-family:inherit;font-size:12.5px;font-weight:600;padding:7px 12px;border-radius:var(--r);border:1px solid var(--line);background:#fff;color:var(--ink);cursor:pointer;white-space:nowrap}
.esfe .btn:hover{border-color:#b6bac4;background:#fafbff}
.esfe .btn.pri{background:var(--accent);border-color:var(--accent);color:#fff}
.esfe .btn.pri:hover{background:#1b2fa0}
.esfe .btn.sm{padding:6px 10px;font-size:12px}
.esfe .btn.del{color:var(--danger);border-color:#e2c4c4;background:#fff}
.esfe .btn.del:hover{background:#fdf4f3}
.esfe .btn:disabled{opacity:.55;cursor:default}
.esfe .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700}

.esfe .hd{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:6px}
.esfe .hd .ftitle{margin:0;font-size:19px;font-weight:800;letter-spacing:-.01em}
.esfe .hd .who{display:flex;align-items:center;gap:10px}
.esfe .hd .who .note{font-size:12px;color:var(--muted)}
.esfe .sub{color:var(--muted);font-size:12.5px;margin:0 0 18px}
.esfe .crumb{font-size:11.5px;color:#8a8d99;margin:0 0 10px}

.esfe .step{background:var(--chrome);border:1px solid var(--border);border-radius:8px;margin-bottom:14px;overflow:hidden;box-shadow:0 1px 3px rgba(20,26,54,.04)}
.esfe .step-h{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#f4f6fa;border-bottom:1px solid var(--line);cursor:pointer}
.esfe .step-h.collapsed{border-bottom:none}
.esfe .step-n{width:22px;height:22px;border-radius:var(--r2);background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0}
.esfe .step-t{font-size:14px;font-weight:700;flex:1;min-width:0}
.esfe .step-cnt{font-size:11px;color:var(--muted)}
.esfe .chev{color:var(--muted);font-size:13px;transition:transform .15s;display:inline-block}
.esfe .chev.open{transform:rotate(90deg)}
.esfe .step-body{padding:10px 12px}

.esfe .q{border:1px solid var(--line);border-radius:var(--r);background:#fff;margin-bottom:7px}
.esfe .q.dragging{opacity:.45}
.esfe .q.over{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
.esfe .q-row{display:flex;align-items:center;gap:9px;padding:9px 11px;cursor:pointer}
.esfe .grip{color:#b5b9c3;cursor:grab;font-size:15px;flex-shrink:0}
.esfe .q-label{font-weight:600;font-size:13px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.esfe .tbadge{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;padding:2px 7px;border-radius:var(--r2);background:var(--accent-soft);color:var(--accent);flex-shrink:0}
.esfe .tbadge.info{background:var(--warn-s);color:var(--warn)}
.esfe .reqdot{font-size:10.5px;color:var(--muted);flex-shrink:0}
.esfe .reqdot.req{color:var(--danger);font-weight:700}
.esfe .q-body{border-top:1px solid var(--line);padding:12px;display:flex;flex-direction:column;gap:11px;background:#fcfcfd}
.esfe .fld{display:flex;flex-direction:column;gap:4px}
.esfe .fld input,.esfe .fld textarea,.esfe .fld select{width:100%}
.esfe .hint2{text-transform:none;letter-spacing:0;font-weight:500;color:var(--muted);opacity:.85}
.esfe .frow{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.esfe .meta{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--muted)}
.esfe .toggle{width:32px;height:18px;border-radius:20px;background:var(--accent);position:relative;cursor:pointer;flex-shrink:0;border:none;padding:0}
.esfe .toggle::after{content:"";position:absolute;width:14px;height:14px;border-radius:50%;background:#fff;top:2px;right:2px}
.esfe .toggle.off{background:#c8ccd4}.esfe .toggle.off::after{right:auto;left:2px}
.esfe .toggle.locked{background:#d6d9e0;cursor:not-allowed}
.esfe .note{font-size:11px;color:var(--muted);font-style:italic}
.esfe .locknote{font-size:11px;color:var(--warn);background:var(--warn-s);border-radius:var(--r2);padding:2px 7px}
.esfe .warn{font-size:11px;color:var(--warn);background:var(--warn-s);border:1px solid #ecd9ac;border-radius:var(--r2);padding:6px 9px}
.esfe .hint{font-size:11px;color:var(--muted)}

.esfe .opts{border:1px solid var(--line);border-radius:var(--r);padding:9px;background:#fff}
.esfe .opt{display:flex;align-items:center;gap:8px;padding:4px 0}
.esfe .opt.over{outline:2px solid var(--accent-soft);border-radius:var(--r2)}
.esfe .opt .g{color:#c2c6cf;cursor:grab;flex-shrink:0}
.esfe .opt .val{font-size:10px;color:#a0a3ad;font-family:ui-monospace,monospace;min-width:52px;flex-shrink:0}
.esfe .opt input{flex:1}
.esfe .opt .en{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:5px;cursor:pointer;flex-shrink:0}
.esfe .opt .en .tg{width:26px;height:15px;border-radius:20px;background:var(--ok);position:relative;display:inline-block}
.esfe .opt .en .tg::after{content:"";position:absolute;width:11px;height:11px;border-radius:50%;background:#fff;top:2px;right:2px}
.esfe .opt .en.off .tg{background:#c8ccd4}.esfe .opt .en.off .tg::after{right:auto;left:2px}
.esfe .opt .x{border:none;background:none;color:#b5b9c3;cursor:pointer;font-size:13px;padding:0 2px;flex-shrink:0}
.esfe .opt .x:hover{color:var(--danger)}
.esfe .optnote{font-size:11px;color:var(--muted);margin-top:6px}
.esfe .addopt{font-size:12px;color:var(--accent);cursor:pointer;font-weight:600;margin-top:6px;display:inline-block;background:none;border:none;padding:0}

.esfe .addbtn{margin-top:6px;width:100%;font-size:12.5px;font-weight:600;color:var(--accent);background:var(--accent-soft);border:1px solid #cdd6f6;border-radius:var(--r);padding:9px;cursor:pointer}
.esfe .addbtn:hover{background:#e5eafc}
.esfe .addcard{border:1px solid #cdd6f6;border-radius:var(--r);background:#fbfcff;margin:8px 0 6px;overflow:hidden}
.esfe .addcard-h{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--accent);padding:9px 12px;background:var(--accent-soft);border-bottom:1px solid #cdd6f6}
.esfe .addcard-b{padding:11px 12px;display:flex;flex-direction:column;gap:9px}
.esfe .addrow{display:flex;gap:10px;align-items:center}

.esfe .removed{background:var(--chrome);border:1px solid var(--border);border-radius:8px;margin-bottom:14px;padding:12px 14px}
.esfe .removed h3{margin:0 0 6px;font-size:12px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.esfe .removed .ritem{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--ink);padding:5px 0}
.esfe .removed .ritem .k{color:var(--muted);font-size:11px}

.esfe .toast{position:fixed;right:20px;bottom:20px;z-index:50;padding:11px 15px;border-radius:var(--r);font-size:12.5px;font-weight:600;color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.16)}
.esfe .toast.ok{background:var(--ok)}
.esfe .toast.err{background:var(--danger)}
.esfe .state{padding:40px 0;text-align:center;color:var(--muted);font-size:13px}
`;

function useQueryType(): string {
  const location = useLocation();
  const params = new URLSearchParams(location.search || window.location.search);
  const t = params.get('type') || '';
  return t === 'contact' ? 'contact' : 'inscriere';
}

let tmpCounter = 0;
const tmpId = (p: string) => `${p}${Date.now().toString(36)}${(tmpCounter++).toString(36)}`;

export default function FormEditorPage() {
  const { get, put } = useFetchClient();
  const navigate = useNavigate();
  const type = useQueryType();

  const [model, setModel] = React.useState<EditModel | null>(null);
  const [removed, setRemoved] = React.useState<{ key: string; label: string; step: string }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const [openSteps, setOpenSteps] = React.useState<Record<string, boolean>>({});
  const [openQ, setOpenQ] = React.useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = React.useState<Record<string, boolean>>({});
  const [addDraft, setAddDraft] = React.useState<Record<string, { label: string; type: string; required: boolean }>>({});

  // drag state (question reorder within a step)
  const dragRef = React.useRef<{ step: string; key: string } | null>(null);
  const [overKey, setOverKey] = React.useState<string | null>(null);

  const showToast = React.useCallback((kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 3600);
  }, []);

  React.useEffect(() => {
    let off = false;
    setLoading(true);
    setError(null);
    get(`/api/forms/${type}/config/edit`)
      .then((r: any) => {
        if (off) return;
        const m = r.data as EditModel;
        setModel(m);
        setRemoved(m.removedBuiltins ?? []);
        const os: Record<string, boolean> = {};
        m.steps.forEach((s) => (os[s.key] = true));
        setOpenSteps(os);
        setOpenQ({});
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
  }, [get, type]);

  const mutate = React.useCallback((fn: (m: EditModel) => void) => {
    setModel((prev) => {
      if (!prev) return prev;
      const next: EditModel = JSON.parse(JSON.stringify(prev));
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

  const deleteQuestion = (stepKey: string, q: EditQuestion) => {
    if (q.isBuiltin) {
      if (q.sensitive) {
        const ok = window.confirm(
          `„${q.label}" este un câmp sensibil (${q.key}). Îl scoți din formular? Coloana și datele deja trimise rămân în tabel.`,
        );
        if (!ok) return;
      }
      setRemoved((r) => (r.some((x) => x.key === q.key) ? r : [...r, { key: q.key, label: q.label, step: stepKey }]));
    }
    mutate((m) => {
      const step = m.steps.find((s) => s.key === stepKey);
      if (step) step.questions = step.questions.filter((x) => x.key !== q.key);
    });
  };

  // --- options
  const setOpt = (stepKey: string, qKey: string, value: string, patch: Partial<EditOption>) =>
    mutate((m) => {
      const o = findQ(m, stepKey, qKey)?.options.find((x) => x.value === value);
      if (o) Object.assign(o, patch);
    });
  const removeOpt = (stepKey: string, qKey: string, value: string) =>
    mutate((m) => {
      const q = findQ(m, stepKey, qKey);
      if (q) q.options = q.options.filter((x) => x.value !== value);
    });
  const moveOpt = (stepKey: string, qKey: string, idx: number, dir: -1 | 1) =>
    mutate((m) => {
      const q = findQ(m, stepKey, qKey);
      if (!q) return;
      const j = idx + dir;
      if (j < 0 || j >= q.options.length) return;
      [q.options[idx], q.options[j]] = [q.options[j], q.options[idx]];
    });
  const addOpt = (stepKey: string, qKey: string) =>
    mutate((m) => {
      const q = findQ(m, stepKey, qKey);
      if (!q || q.optionSource === 'enum') return;
      q.options.push({ value: tmpId('tmp_'), label: '', enabled: true, isDefault: false, _new: true });
    });

  // --- add custom question
  const draftFor = (stepKey: string) => addDraft[stepKey] ?? { label: '', type: 'text', required: false };
  const openAdd = (stepKey: string) => {
    setAddOpen((s) => ({ ...s, [stepKey]: true }));
    setAddDraft((d) => ({ ...d, [stepKey]: d[stepKey] ?? { label: '', type: 'text', required: false } }));
  };
  const cancelAdd = (stepKey: string) => {
    setAddOpen((s) => ({ ...s, [stepKey]: false }));
    setAddDraft((d) => ({ ...d, [stepKey]: { label: '', type: 'text', required: false } }));
  };
  const commitAdd = (stepKey: string) => {
    const d = draftFor(stepKey);
    const label = d.label.trim();
    if (!label) {
      showToast('err', 'Eticheta întrebării este obligatorie.');
      return;
    }
    const key = tmpId('c_');
    const q: EditQuestion = {
      key,
      type: d.type,
      isBuiltin: false,
      isCustom: true,
      typeLocked: true,
      sensitive: false,
      removable: true,
      defaultLabel: '',
      label,
      help: '',
      required: d.required,
      lockedRequired: false,
      hidden: false,
      canHide: true,
      optionSource: d.type === 'select' ? 'freetext' : 'none',
      cardCapable: d.type === 'checkbox',
      display: 'plain',
      title: '',
      icon: '',
      linkUrl: '',
      linkLabel: '',
      options:
        d.type === 'select'
          ? [
              { value: tmpId('tmp_'), label: 'Opțiunea 1', enabled: true, isDefault: false, _new: true },
              { value: tmpId('tmp_'), label: 'Opțiunea 2', enabled: true, isDefault: false, _new: true },
            ]
          : [],
      _new: true,
    };
    mutate((m) => {
      const step = m.steps.find((s) => s.key === stepKey);
      if (step) step.questions.push(q);
    });
    setOpenQ((o) => ({ ...o, [key]: true }));
    cancelAdd(stepKey);
  };

  // --- drag reorder within a step
  const onQDrop = (stepKey: string, targetKey: string) =>
    mutate((m) => {
      const d = dragRef.current;
      if (!d || d.step !== stepKey || d.key === targetKey) return;
      const step = m.steps.find((s) => s.key === stepKey);
      if (!step) return;
      const from = step.questions.findIndex((q) => q.key === d.key);
      const to = step.questions.findIndex((q) => q.key === targetKey);
      if (from < 0 || to < 0) return;
      const [moved] = step.questions.splice(from, 1);
      step.questions.splice(to, 0, moved);
    });

  const save = async () => {
    if (!model) return;
    setSaving(true);
    try {
      const payload = {
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
              q.type === 'select'
                ? q.options.map((o) => ({ value: o._new ? '' : o.value, label: o.label, enabled: o.enabled }))
                : undefined,
          })),
        })),
      };
      const r: any = await put(`/api/forms/${type}/config`, payload);
      const m = r.data as EditModel;
      setModel(m);
      setRemoved(m.removedBuiltins ?? []);
      setOpenQ({});
      showToast('ok', 'Configurația a fost salvată.');
    } catch (e: any) {
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.error ||
        'Salvarea a fost respinsă. Verificați modificările.';
      showToast('err', typeof msg === 'string' ? msg : 'Salvarea a fost respinsă.');
    } finally {
      setSaving(false);
    }
  };

  return (
    // `pce` opts our own "Salvează" button out of the global admin SaveBar tagger.
    <div className="esfe pce">
      <style>{CSS}</style>
      <div className="wrap">
        <div className="crumb">Formulare / Editează întrebări</div>
        <div className="hd">
          <h1 className="ftitle">{type === 'contact' ? 'Contact' : 'Înscriere cursuri'}</h1>
          <div className="who">
            <span className="note">Modificările apar pe site după salvare</span>
            <button className="btn" type="button" onClick={() => navigate(FORMULARE_TO)}>
              Înapoi
            </button>
            <button className="btn pri" type="button" onClick={save} disabled={saving || !model}>
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        </div>
        <p className="sub">
          Editează textul, ordinea, opțiunile și întrebările formularului {TITLES[type] ?? type}. Adaugă sau șterge
          întrebări; nu se pot crea formulare noi și tipul unei întrebări nu se schimbă.
        </p>

        {loading && <div className="state">Se încarcă...</div>}
        {error && !loading && <div className="state">{error}</div>}

        {model &&
          !loading &&
          model.steps.map((step, si) => {
            const open = openSteps[step.key] !== false;
            return (
              <div className="step" key={step.key}>
                <div
                  className={`step-h ${open ? '' : 'collapsed'}`}
                  onClick={() => setOpenSteps((s) => ({ ...s, [step.key]: !open }))}
                >
                  <span className="step-n">{si + 1}</span>
                  <span className="step-t">{step.title}</span>
                  <span className="step-cnt">
                    {step.questions.length}{' '}
                    {step.questions.length === 1 ? 'element' : 'elemente'}
                  </span>
                  <span className={`chev ${open ? 'open' : ''}`}>&rsaquo;</span>
                </div>

                {open && (
                  <div className="step-body">
                    {step.questions.map((q) => {
                      const qOpen = !!openQ[q.key];
                      return (
                        <div
                          className={`q ${overKey === q.key ? 'over' : ''}`}
                          key={q.key}
                          onDragOver={(e) => {
                            if (dragRef.current?.step === step.key) {
                              e.preventDefault();
                              if (overKey !== q.key) setOverKey(q.key);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            onQDrop(step.key, q.key);
                            dragRef.current = null;
                            setOverKey(null);
                          }}
                        >
                          <div className="q-row" onClick={() => setOpenQ((o) => ({ ...o, [q.key]: !qOpen }))}>
                            <span
                              className="grip"
                              draggable
                              onClick={(e) => e.stopPropagation()}
                              onDragStart={() => {
                                dragRef.current = { step: step.key, key: q.key };
                              }}
                              onDragEnd={() => {
                                dragRef.current = null;
                                setOverKey(null);
                              }}
                              title="Trage pentru a reordona"
                            >
                              ⠿
                            </span>
                            <span className="q-label">{q.label || q.defaultLabel || '(fără etichetă)'}</span>
                            <span className={`tbadge ${q.type === 'info' ? 'info' : ''}`}>
                              {TYPE_LABEL[q.type] ?? q.type}
                            </span>
                            {q.type !== 'info' && (
                              <span className={`reqdot ${q.required ? 'req' : ''}`}>
                                {q.required ? 'obligatoriu' : 'opțional'}
                              </span>
                            )}
                            <span className={`chev ${qOpen ? 'open' : ''}`}>&rsaquo;</span>
                          </div>

                          {qOpen && (
                            <div className="q-body">
                              <div className="fld">
                                <span className="lbl">{q.type === 'info' ? 'Text informativ' : 'Etichetă (text afișat)'}</span>
                                {q.type === 'info' ? (
                                  <textarea value={q.label} onChange={(e) => setQ(step.key, q.key, { label: e.target.value })} />
                                ) : (
                                  <input value={q.label} onChange={(e) => setQ(step.key, q.key, { label: e.target.value })} />
                                )}
                                {q.defaultLabel && q.type !== 'info' && (
                                  <span className="hint">Implicit: {q.defaultLabel}</span>
                                )}
                              </div>

                              {q.type !== 'info' && (
                                <div className="fld">
                                  <span className="lbl">Text ajutor / placeholder</span>
                                  <input
                                    value={q.help}
                                    placeholder="Opțional"
                                    onChange={(e) => setQ(step.key, q.key, { help: e.target.value })}
                                  />
                                </div>
                              )}

                              {q.cardCapable && (
                                <div className="fld">
                                  <span className="lbl">
                                    Mod de afișare
                                    <span className="hint2">
                                      {' '}alege cum arată pe site
                                    </span>
                                  </span>
                                  <select
                                    value={q.display}
                                    onChange={(e) => setQ(step.key, q.key, { display: e.target.value })}
                                  >
                                    <option value="plain">
                                      {q.type === 'info' ? 'Text simplu' : 'Bifă simplă'}
                                    </option>
                                    <option value="card">Card cu pictogramă și link</option>
                                  </select>
                                </div>
                              )}

                              {q.cardCapable && q.display === 'card' && (
                                <>
                                  <div className="fld">
                                    <span className="lbl">Titlu card</span>
                                    <input
                                      value={q.title}
                                      placeholder="ex: Regulamentul Cursurilor"
                                      onChange={(e) => setQ(step.key, q.key, { title: e.target.value })}
                                    />
                                  </div>
                                  <div className="fld">
                                    <span className="lbl">Pictogramă</span>
                                    <select
                                      value={q.icon}
                                      onChange={(e) => setQ(step.key, q.key, { icon: e.target.value })}
                                    >
                                      <option value="">Fără pictogramă</option>
                                      <option value="book">Carte (regulament)</option>
                                      <option value="shield">Scut (protecția datelor)</option>
                                      <option value="calendar">Calendar (program)</option>
                                      <option value="info">Informație</option>
                                      <option value="award">Premiu</option>
                                      <option value="users">Persoane</option>
                                    </select>
                                  </div>
                                  <div className="fld">
                                    <span className="lbl">Link (opțional)</span>
                                    <input
                                      value={q.linkUrl}
                                      placeholder="https://..."
                                      onChange={(e) => setQ(step.key, q.key, { linkUrl: e.target.value })}
                                    />
                                  </div>
                                  <div className="fld">
                                    <span className="lbl">Etichetă link (opțional)</span>
                                    <input
                                      value={q.linkLabel}
                                      placeholder="Text afișat pentru link"
                                      onChange={(e) => setQ(step.key, q.key, { linkLabel: e.target.value })}
                                    />
                                  </div>
                                </>
                              )}

                              <div className="frow">
                                {q.type !== 'info' && (
                                  <div className="meta">
                                    <button
                                      type="button"
                                      className={`toggle ${q.required ? '' : 'off'} ${q.lockedRequired ? 'locked' : ''}`}
                                      onClick={() => !q.lockedRequired && setQ(step.key, q.key, { required: !q.required })}
                                      aria-label="Obligatoriu"
                                    />
                                    obligatoriu
                                    {q.lockedRequired && <span className="locknote">blocat</span>}
                                  </div>
                                )}
                                <div className="meta">
                                  tip: <span className={`tbadge ${q.type === 'info' ? 'info' : ''}`}>{TYPE_LABEL[q.type] ?? q.type}</span>
                                  {q.isCustom && <span className="note">tipul nu se poate schimba</span>}
                                </div>
                                <span style={{ marginLeft: 'auto' }}>
                                  <button className="btn sm del" type="button" onClick={() => deleteQuestion(step.key, q)}>
                                    Șterge
                                  </button>
                                </span>
                              </div>

                              {q.isBuiltin && (
                                <div className="warn">
                                  Câmp încorporat. La ștergere dispare din formular, dar coloana și datele deja trimise rămân
                                  în tabelul de rezultate.
                                </div>
                              )}

                              {q.type === 'select' && (
                                <div className="fld">
                                  <span className="lbl">Opțiuni</span>
                                  <div className="opts">
                                    {q.options.map((o, oi) => (
                                      <div className="opt" key={o.value}>
                                        <span
                                          className="g"
                                          draggable
                                          onDragStart={() => {
                                            /* option drag uses up/down buttons for reliability */
                                          }}
                                        >
                                          ⠿
                                        </span>
                                        {!o._new && o.value !== o.label && <span className="val">{o.value}</span>}
                                        <input
                                          value={o.label}
                                          placeholder="Etichetă opțiune"
                                          onChange={(e) => setOpt(step.key, q.key, o.value, { label: e.target.value })}
                                        />
                                        <span
                                          className={`en ${o.enabled ? '' : 'off'}`}
                                          onClick={() => setOpt(step.key, q.key, o.value, { enabled: !o.enabled })}
                                        >
                                          <span className="tg" />
                                          {o.enabled ? 'activ' : 'ascuns'}
                                        </span>
                                        <button
                                          className="btn sm"
                                          type="button"
                                          onClick={() => moveOpt(step.key, q.key, oi, -1)}
                                          disabled={oi === 0}
                                          style={{ padding: '2px 6px' }}
                                        >
                                          ↑
                                        </button>
                                        <button
                                          className="btn sm"
                                          type="button"
                                          onClick={() => moveOpt(step.key, q.key, oi, 1)}
                                          disabled={oi === q.options.length - 1}
                                          style={{ padding: '2px 6px' }}
                                        >
                                          ↓
                                        </button>
                                        {(q.optionSource !== 'enum' && !o.isDefault) && (
                                          <button
                                            className="x"
                                            type="button"
                                            title="Elimină opțiunea"
                                            onClick={() => removeOpt(step.key, q.key, o.value)}
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                    {q.options.length === 0 && <div className="optnote">Nicio opțiune.</div>}
                                    {q.optionSource !== 'enum' ? (
                                      <button className="addopt" type="button" onClick={() => addOpt(step.key, q.key)}>
                                        + Adaugă opțiune
                                      </button>
                                    ) : (
                                      <div className="optnote">Opțiunile acestei liste sunt fixe; se pot redenumi și dezactiva.</div>
                                    )}
                                    <div className="optnote">
                                      Poți redenumi, reordona sau dezactiva opțiuni. Redenumirea nu schimbă datele deja
                                      trimise; o opțiune ștearsă cu date vechi rămâne vizibilă în rezultate.
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {addOpen[step.key] ? (
                      <div className="addcard">
                        <div className="addcard-h">Întrebare nouă</div>
                        <div className="addcard-b">
                          <div className="fld">
                            <span className="lbl">Etichetă</span>
                            <input
                              autoFocus
                              placeholder="ex. Alergii sau probleme medicale"
                              value={draftFor(step.key).label}
                              onChange={(e) =>
                                setAddDraft((d) => ({ ...d, [step.key]: { ...draftFor(step.key), label: e.target.value } }))
                              }
                            />
                          </div>
                          <div className="addrow">
                            <div className="fld" style={{ flex: 1 }}>
                              <span className="lbl">Tip</span>
                              <select
                                value={draftFor(step.key).type}
                                onChange={(e) =>
                                  setAddDraft((d) => ({ ...d, [step.key]: { ...draftFor(step.key), type: e.target.value } }))
                                }
                              >
                                {NEW_TYPE_CHOICES.map((c) => (
                                  <option key={c.value} value={c.value}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="meta" style={{ alignSelf: 'end', paddingBottom: 8 }}>
                              <button
                                type="button"
                                className={`toggle ${draftFor(step.key).required ? '' : 'off'}`}
                                onClick={() =>
                                  setAddDraft((d) => ({
                                    ...d,
                                    [step.key]: { ...draftFor(step.key), required: !draftFor(step.key).required },
                                  }))
                                }
                                aria-label="Obligatoriu"
                              />
                              obligatoriu
                            </div>
                          </div>
                          <div className="addrow" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn sm" type="button" onClick={() => cancelAdd(step.key)}>
                              Anulează
                            </button>
                            <button className="btn sm pri" type="button" onClick={() => commitAdd(step.key)}>
                              Adaugă
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button className="addbtn" type="button" onClick={() => openAdd(step.key)}>
                        + Adaugă întrebare
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

        {model && !loading && removed.length > 0 && (
          <div className="removed">
            <h3>Câmpuri scoase din formular</h3>
            {removed.map((r) => (
              <div className="ritem" key={r.key}>
                <span>{r.label}</span>
                <span className="k">{r.key}</span>
                <span style={{ marginLeft: 'auto' }}>
                  <button
                    className="btn sm"
                    type="button"
                    onClick={() => setRemoved((cur) => cur.filter((x) => x.key !== r.key))}
                    title="Anulează scoaterea (câmpul revine în formular la salvare)"
                  >
                    Anulează
                  </button>
                </span>
              </div>
            ))}
            <div className="optnote">
              Coloanele și datele deja trimise rămân în tabelul de rezultate, marcate „(eliminată)". Anulează pentru a
              readuce câmpul în formular la următoarea salvare.
            </div>
          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}
