import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { FORMULARE_TO } from './menu';

/**
 * EduSport admin — "Editor formular" page.
 *
 * Registered as an admin route (see ./menu.tsx) so it renders inside Strapi's
 * providers and can use useFetchClient / useNavigate. Reached from the Formulare
 * hub's "Editează întrebări" button with ?type=inscriere|contact.
 *
 * It edits the OVERLAY over the code registry via the admin-guarded endpoints:
 *   GET /api/forms/:type/config/edit   -> editor model (defaults + lock flags)
 *   PUT /api/forms/:type/config        -> validate + save overlay
 *
 * New questions / field types / enum option values are OUT of scope. The editor
 * only changes labels, help text, required (unless locked), hidden (only when
 * canHide), option labels/order/enabled, per-question order, and info blocks.
 * Light-only, shared admin tokens (system-ui, #fff, #dcdcdc borders, accent
 * #2138b8, danger #be3330, #d0d0d0 fields, squared buttons; horizontal
 * separators only).
 */

interface EditOption {
  value: string;
  label: string;
  enabled: boolean;
  isDefault: boolean;
}
interface EditQuestion {
  key: string;
  type: string;
  defaultLabel: string;
  label: string;
  help: string;
  required: boolean;
  lockedRequired: boolean;
  hidden: boolean;
  canHide: boolean;
  optionSource: 'none' | 'enum' | 'freetext';
  linkUrl: string;
  linkLabel: string;
  options: EditOption[];
}
interface EditStep {
  key: string;
  title: string;
  questions: EditQuestion[];
}
interface EditModel {
  type: string;
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
  select: 'listă',
  checkbox: 'bifă',
  date: 'dată',
  info: 'bloc info',
};

const CSS = `
.esfe { font-family: system-ui, -apple-system, sans-serif; color: #1b1d26; background: #f6f7f9; min-height: 100%; padding: 16px 20px 60px; box-sizing: border-box; }
.esfe * { box-sizing: border-box; }

.esfe-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.esfe-head h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -.01em; }
.esfe-head p { margin: 3px 0 0; font-size: 12.5px; color: #6a6e7a; }
.esfe-head .crumb { font-size: 11.5px; color: #8a8d99; margin: 0 0 6px; }

.esfe-btn { font-family: inherit; font-size: 12.5px; font-weight: 600; padding: 8px 13px; border-radius: 4px; border: 1px solid #d0d0d0; background: #fff; color: #1b1d26; cursor: pointer; white-space: nowrap; }
.esfe-btn:hover { border-color: #b6bac4; background: #fafbff; }
.esfe-btn.pri { background: #2138b8; border-color: #2138b8; color: #fff; }
.esfe-btn.pri:hover { background: #1b2fa0; }
.esfe-btn:disabled { opacity: .55; cursor: default; }
.esfe-btn:disabled:hover { border-color: #d0d0d0; background: #fff; }
.esfe-btn.mini { padding: 4px 8px; font-size: 12px; font-weight: 700; }

.esfe-actions { display: flex; align-items: center; gap: 8px; }

.esfe-step { background: #fff; border: 1px solid #dcdcdc; border-radius: 5px; margin-bottom: 16px; overflow: hidden; }
.esfe-step-h { padding: 11px 15px; border-bottom: 1px solid #ececec; background: #fbfbfc; font-size: 13px; font-weight: 800; letter-spacing: .01em; display: flex; align-items: baseline; gap: 9px; }
.esfe-step-h .k { font-size: 11px; font-weight: 600; color: #a0a3ad; }

.esfe-q { padding: 14px 15px; border-bottom: 1px solid #f0f1f4; }
.esfe-q:last-child { border-bottom: none; }
.esfe-q.hidden { background: #fbfbfc; }

.esfe-q-top { display: flex; align-items: center; gap: 10px; }
.esfe-q-key { font-size: 11px; color: #8a8d99; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.esfe-q-type { font-size: 10px; font-weight: 800; letter-spacing: .03em; text-transform: uppercase; color: #2138b8; background: #eef1fb; border-radius: 4px; padding: 3px 8px; }
.esfe-q-move { margin-left: auto; display: flex; gap: 5px; }

.esfe-field { margin-top: 10px; }
.esfe-field label { display: block; font-size: 11.5px; font-weight: 700; color: #4a4d59; margin-bottom: 4px; }
.esfe-input, .esfe-area { width: 100%; font-family: inherit; font-size: 13px; color: #1b1d26; padding: 7px 9px; border: 1px solid #d0d0d0; border-radius: 4px; background: #fff; }
.esfe-input:focus, .esfe-area:focus { outline: none; border-color: #2138b8; }
.esfe-area { min-height: 54px; resize: vertical; }
.esfe-hint { font-size: 11px; color: #8a8d99; margin-top: 4px; }
.esfe-def { font-size: 11px; color: #a0a3ad; margin-top: 3px; }

.esfe-toggles { display: flex; gap: 18px; margin-top: 12px; flex-wrap: wrap; }
.esfe-tog { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: #4a4d59; }
.esfe-tog input { width: 15px; height: 15px; accent-color: #2138b8; }
.esfe-tog.disabled { color: #a0a3ad; }
.esfe-lock { font-size: 10.5px; color: #a0a3ad; font-weight: 600; }

.esfe-opts { margin-top: 12px; border: 1px solid #ececec; border-radius: 4px; }
.esfe-opts-h { font-size: 11.5px; font-weight: 700; color: #4a4d59; padding: 8px 10px; border-bottom: 1px solid #ececec; background: #fbfbfc; display: flex; align-items: center; justify-content: space-between; }
.esfe-opt { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-bottom: 1px solid #f4f5f7; }
.esfe-opt:last-child { border-bottom: none; }
.esfe-opt .val { font-size: 10.5px; color: #a0a3ad; font-family: ui-monospace, monospace; min-width: 74px; }
.esfe-opt .lab { flex: 1; }
.esfe-opt input.esfe-input { padding: 5px 8px; font-size: 12.5px; }
.esfe-opt .en { display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: #4a4d59; }
.esfe-opt.off { opacity: .55; }
.esfe-opt-note { font-size: 11px; color: #8a8d99; padding: 8px 10px; }

.esfe-toast { position: fixed; right: 20px; bottom: 20px; z-index: 50; padding: 11px 15px; border-radius: 4px; font-size: 12.5px; font-weight: 600; color: #fff; box-shadow: 0 4px 16px rgba(0,0,0,.16); }
.esfe-toast.ok { background: #1f7a4d; }
.esfe-toast.err { background: #be3330; }

.esfe-state { padding: 40px 0; text-align: center; color: #8a8d99; font-size: 13px; }
`;

function useQueryType(): string {
  const location = useLocation();
  const params = new URLSearchParams(location.search || window.location.search);
  const t = params.get('type') || '';
  return t === 'contact' ? 'contact' : 'inscriere';
}

export default function FormEditorPage() {
  const { get, put } = useFetchClient();
  const navigate = useNavigate();
  const type = useQueryType();

  const [model, setModel] = React.useState<EditModel | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const showToast = React.useCallback((kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  React.useEffect(() => {
    let off = false;
    setLoading(true);
    setError(null);
    get(`/api/forms/${type}/config/edit`)
      .then((r: any) => {
        if (off) return;
        setModel(r.data as EditModel);
      })
      .catch(() => {
        if (off) return;
        setError('Nu am putut încărca configurația formularului.');
      })
      .finally(() => {
        if (!off) setLoading(false);
      });
    return () => {
      off = true;
    };
  }, [get, type]);

  // Immutable update helper: deep-clone, mutate, set.
  const mutate = React.useCallback((fn: (m: EditModel) => void) => {
    setModel((prev) => {
      if (!prev) return prev;
      const next: EditModel = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
  }, []);

  const setQ = (stepKey: string, qKey: string, patch: Partial<EditQuestion>) =>
    mutate((m) => {
      const step = m.steps.find((s) => s.key === stepKey);
      const q = step?.questions.find((x) => x.key === qKey);
      if (q) Object.assign(q, patch);
    });

  const moveQ = (stepKey: string, idx: number, dir: -1 | 1) =>
    mutate((m) => {
      const step = m.steps.find((s) => s.key === stepKey);
      if (!step) return;
      const j = idx + dir;
      if (j < 0 || j >= step.questions.length) return;
      const arr = step.questions;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
    });

  const moveOpt = (stepKey: string, qKey: string, idx: number, dir: -1 | 1) =>
    mutate((m) => {
      const q = m.steps.find((s) => s.key === stepKey)?.questions.find((x) => x.key === qKey);
      if (!q) return;
      const j = idx + dir;
      if (j < 0 || j >= q.options.length) return;
      [q.options[idx], q.options[j]] = [q.options[j], q.options[idx]];
    });

  const setOpt = (stepKey: string, qKey: string, value: string, patch: Partial<EditOption>) =>
    mutate((m) => {
      const q = m.steps.find((s) => s.key === stepKey)?.questions.find((x) => x.key === qKey);
      const o = q?.options.find((x) => x.value === value);
      if (o) Object.assign(o, patch);
    });

  const addOpt = (stepKey: string, qKey: string) =>
    mutate((m) => {
      const q = m.steps.find((s) => s.key === stepKey)?.questions.find((x) => x.key === qKey);
      if (!q || q.optionSource === 'enum') return;
      const value = `opt_${Date.now().toString(36)}`;
      q.options.push({ value, label: '', enabled: true, isDefault: false });
    });

  const save = async () => {
    if (!model) return;
    setSaving(true);
    try {
      const payload = {
        steps: model.steps.map((s) => ({
          key: s.key,
          questions: s.questions.map((q) => ({
            key: q.key,
            type: q.type,
            label: q.label,
            help: q.help,
            required: q.required,
            hidden: q.hidden,
            linkUrl: q.linkUrl,
            linkLabel: q.linkLabel,
            options: q.type === 'select' ? q.options.map((o) => ({ value: o.value, label: o.label, enabled: o.enabled })) : undefined,
          })),
        })),
      };
      const r: any = await put(`/api/forms/${type}/config`, payload);
      setModel(r.data as EditModel);
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
    // `pce` opts our own "Salvează" button out of the global admin SaveBar
    // tagger (src/admin/app.tsx), which would otherwise visually hide any
    // button labelled "Salvează".
    <div className="esfe pce">
      <style>{CSS}</style>

      <div className="esfe-head">
        <div>
          <div className="crumb">Formulare / Editează întrebări</div>
          <h1>Editor formular: {TITLES[type] ?? type}</h1>
          <p>
            Modificați etichetele, textele de ajutor, ordinea și opțiunile. Câmpurile, tipurile și adăugarea de întrebări
            noi nu pot fi schimbate din editor.
          </p>
        </div>
        <div className="esfe-actions">
          <button className="esfe-btn" type="button" onClick={() => navigate(FORMULARE_TO)}>
            Înapoi
          </button>
          <button className="esfe-btn pri" type="button" onClick={save} disabled={saving || !model}>
            {saving ? 'Se salvează...' : 'Salvează'}
          </button>
        </div>
      </div>

      {loading && <div className="esfe-state">Se încarcă...</div>}
      {error && !loading && <div className="esfe-state">{error}</div>}

      {model &&
        !loading &&
        model.steps.map((step) => (
          <div className="esfe-step" key={step.key}>
            <div className="esfe-step-h">
              {step.title}
              <span className="k">{step.key}</span>
            </div>
            {step.questions.map((q, qi) => (
              <div className={`esfe-q ${q.hidden ? 'hidden' : ''}`} key={q.key}>
                <div className="esfe-q-top">
                  <span className="esfe-q-type">{TYPE_LABEL[q.type] ?? q.type}</span>
                  <span className="esfe-q-key">{q.key}</span>
                  <div className="esfe-q-move">
                    <button className="esfe-btn mini" type="button" onClick={() => moveQ(step.key, qi, -1)} disabled={qi === 0} title="Mută mai sus">
                      ↑
                    </button>
                    <button
                      className="esfe-btn mini"
                      type="button"
                      onClick={() => moveQ(step.key, qi, 1)}
                      disabled={qi === step.questions.length - 1}
                      title="Mută mai jos"
                    >
                      ↓
                    </button>
                  </div>
                </div>

                <div className="esfe-field">
                  <label>{q.type === 'info' ? 'Text informativ' : 'Etichetă'}</label>
                  {q.type === 'info' ? (
                    <textarea
                      className="esfe-area"
                      value={q.label}
                      onChange={(e) => setQ(step.key, q.key, { label: e.target.value })}
                    />
                  ) : (
                    <input
                      className="esfe-input"
                      value={q.label}
                      onChange={(e) => setQ(step.key, q.key, { label: e.target.value })}
                    />
                  )}
                  <div className="esfe-def">Implicit: {q.defaultLabel}</div>
                </div>

                {q.type !== 'info' && (
                  <div className="esfe-field">
                    <label>Text de ajutor</label>
                    <input
                      className="esfe-input"
                      value={q.help}
                      placeholder="Opțional"
                      onChange={(e) => setQ(step.key, q.key, { help: e.target.value })}
                    />
                  </div>
                )}

                {(q.type === 'email' || q.type === 'tel') && (
                  <div className="esfe-hint">
                    Câmp de tip {q.type === 'email' ? 'email' : 'telefon'}, validat automat.
                  </div>
                )}

                {q.type === 'info' && (
                  <>
                    <div className="esfe-field">
                      <label>Link (opțional)</label>
                      <input
                        className="esfe-input"
                        value={q.linkUrl}
                        placeholder="https://..."
                        onChange={(e) => setQ(step.key, q.key, { linkUrl: e.target.value })}
                      />
                    </div>
                    <div className="esfe-field">
                      <label>Etichetă link (opțional)</label>
                      <input
                        className="esfe-input"
                        value={q.linkLabel}
                        placeholder="Text afișat pentru link"
                        onChange={(e) => setQ(step.key, q.key, { linkLabel: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {q.type !== 'info' && (
                  <div className="esfe-toggles">
                    <label className={`esfe-tog ${q.lockedRequired ? 'disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={q.required}
                        disabled={q.lockedRequired}
                        onChange={(e) => setQ(step.key, q.key, { required: e.target.checked })}
                      />
                      Obligatoriu
                      {q.lockedRequired && <span className="esfe-lock">(blocat)</span>}
                    </label>

                    <label className={`esfe-tog ${!q.canHide ? 'disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={q.hidden}
                        disabled={!q.canHide}
                        onChange={(e) => setQ(step.key, q.key, { hidden: e.target.checked })}
                      />
                      Ascuns
                      {!q.canHide && <span className="esfe-lock">(nu se poate ascunde)</span>}
                    </label>
                  </div>
                )}

                {q.type === 'info' && q.canHide && (
                  <div className="esfe-toggles">
                    <label className="esfe-tog">
                      <input type="checkbox" checked={q.hidden} onChange={(e) => setQ(step.key, q.key, { hidden: e.target.checked })} />
                      Ascuns
                    </label>
                  </div>
                )}

                {q.type === 'select' && (
                  <div className="esfe-opts">
                    <div className="esfe-opts-h">
                      <span>Opțiuni</span>
                      {q.optionSource === 'enum' ? (
                        <span className="esfe-lock">opțiunile fixe, adăugarea necesită dezvoltare</span>
                      ) : (
                        <button className="esfe-btn mini" type="button" onClick={() => addOpt(step.key, q.key)}>
                          + adaugă opțiune
                        </button>
                      )}
                    </div>
                    {q.options.map((o, oi) => (
                      <div className={`esfe-opt ${o.enabled ? '' : 'off'}`} key={o.value}>
                        <span className="val">{o.value}</span>
                        <input
                          className="esfe-input lab"
                          value={o.label}
                          onChange={(e) => setOpt(step.key, q.key, o.value, { label: e.target.value })}
                        />
                        <label className="en">
                          <input
                            type="checkbox"
                            checked={o.enabled}
                            onChange={(e) => setOpt(step.key, q.key, o.value, { enabled: e.target.checked })}
                          />
                          activ
                        </label>
                        <button className="esfe-btn mini" type="button" onClick={() => moveOpt(step.key, q.key, oi, -1)} disabled={oi === 0}>
                          ↑
                        </button>
                        <button
                          className="esfe-btn mini"
                          type="button"
                          onClick={() => moveOpt(step.key, q.key, oi, 1)}
                          disabled={oi === q.options.length - 1}
                        >
                          ↓
                        </button>
                      </div>
                    ))}
                    {q.options.length === 0 && <div className="esfe-opt-note">Nicio opțiune.</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

      {toast && <div className={`esfe-toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}
