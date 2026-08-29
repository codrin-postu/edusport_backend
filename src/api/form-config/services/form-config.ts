/**
 * form-config service: loads the stored OVERLAY for a form and merges it with
 * the code REGISTRY into the effective render models, plus validates+builds an
 * overlay from an admin editor payload.
 *
 * Two merged views are produced:
 *   - public: the minimal render model the public site consumes
 *   - edit:   the richer model the admin editor needs (defaults + lock flags)
 */

import { factories } from '@strapi/strapi';
import {
  REGISTRY,
  type FormType,
  type RegistryForm,
  type RegistryQuestion,
  type RegistryStep,
} from '../registry';

const UID = 'api::form-config.form-config' as const;

interface OptionOverlay {
  label?: string;
  enabled?: boolean;
}
interface QuestionOverlay {
  label?: string;
  help?: string;
  required?: boolean;
  hidden?: boolean;
  linkUrl?: string;
  linkLabel?: string;
  options?: Record<string, OptionOverlay>; // keyed by option value
  optionOrder?: string[]; // ordered option values
  addedOptions?: { value: string; label: string }[]; // freetext selects only
}
export interface Overlay {
  q?: Record<string, QuestionOverlay>;
  order?: Record<string, string[]>; // stepKey -> ordered question keys
}

const asStr = (v: unknown) => (typeof v === 'string' ? v : '');
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';

// Data-type format checks, driven by the registry question `type`.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A phone may contain digits, spaces, +, -, and parentheses, and must carry
// at least ~7 actual digits to look like a real number.
const PHONE_ALLOWED_RE = /^[0-9+\-\s()]+$/;
const isPhoneLike = (v: string) => PHONE_ALLOWED_RE.test(v) && v.replace(/\D/g, '').length >= 7;

/** Ordered question keys for a step: overlay order (filtered) then any missing registry keys. */
function orderedKeys(step: RegistryStep, order?: string[]): string[] {
  const registryKeys = step.questions.map((q) => q.key);
  if (!Array.isArray(order) || order.length === 0) return registryKeys;
  const known = order.filter((k) => registryKeys.includes(k));
  const seen = new Set(known);
  const missing = registryKeys.filter((k) => !seen.has(k));
  // de-dup known while preserving first occurrence
  const dedup: string[] = [];
  const used = new Set<string>();
  for (const k of known) {
    if (!used.has(k)) {
      used.add(k);
      dedup.push(k);
    }
  }
  return [...dedup, ...missing];
}

/** Effective option list for a select question (registry + freetext additions), ordered + labelled. */
function effectiveOptions(q: RegistryQuestion, ov?: QuestionOverlay) {
  const base = (q.options ?? []).map((o) => ({ ...o, isDefault: true }));
  const added =
    q.optionSource === 'freetext' && Array.isArray(ov?.addedOptions)
      ? ov!.addedOptions.map((o) => ({ value: o.value, label: o.label, isDefault: false }))
      : [];
  const all = [...base, ...added];
  const byValue = new Map(all.map((o) => [o.value, o]));

  const order =
    Array.isArray(ov?.optionOrder) && ov!.optionOrder.length
      ? [...ov!.optionOrder.filter((v) => byValue.has(v)), ...all.map((o) => o.value).filter((v) => !ov!.optionOrder!.includes(v))]
      : all.map((o) => o.value);

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const v of order) {
    if (!seen.has(v)) {
      seen.add(v);
      ordered.push(v);
    }
  }

  return ordered.map((value) => {
    const o = byValue.get(value)!;
    const oov = ov?.options?.[value];
    return {
      value,
      label: asStr(oov?.label) || o.label,
      enabled: oov?.enabled === undefined ? true : Boolean(oov.enabled),
      isDefault: o.isDefault,
    };
  });
}

function effRequired(q: RegistryQuestion, ov: QuestionOverlay | undefined, hidden: boolean): boolean {
  if (q.type === 'info') return false;
  if (q.lockedRequired) return true;
  if (hidden) return false;
  return ov?.required === undefined ? q.required : Boolean(ov.required);
}

function effHidden(q: RegistryQuestion, ov?: QuestionOverlay): boolean {
  if (!q.canHide) return false;
  return Boolean(ov?.hidden);
}

/** Build the PUBLIC effective model. Hidden questions are omitted. */
function mergePublicModel(form: RegistryForm, overlay: Overlay) {
  return {
    type: form.type,
    steps: form.steps.map((step) => ({
      key: step.key,
      title: step.title,
      questions: orderedKeys(step, overlay.order?.[step.key])
        .map((k) => step.questions.find((q) => q.key === k)!)
        .map((q) => {
          const ov = overlay.q?.[q.key];
          const hidden = effHidden(q, ov);
          if (hidden) return null; // public consumer never sees hidden questions
          if (q.type === 'info') {
            return {
              key: q.key,
              type: q.type,
              label: asStr(ov?.label) || q.defaultLabel,
              linkUrl: asStr(ov?.linkUrl) || q.defaultLinkUrl || '',
              linkLabel: asStr(ov?.linkLabel) || q.defaultLinkLabel || '',
            };
          }
          const base: Record<string, unknown> = {
            key: q.key,
            type: q.type,
            label: asStr(ov?.label) || q.defaultLabel,
            help: asStr(ov?.help) || q.defaultHelp || '',
            required: effRequired(q, ov, hidden),
            hidden: false,
          };
          if (q.type === 'select') {
            base.options = effectiveOptions(q, ov)
              .filter((o) => o.enabled) // public only sees enabled options
              .map((o) => ({ value: o.value, label: o.label, enabled: true }));
          }
          return base;
        })
        .filter((x): x is Record<string, unknown> => x !== null),
    })),
  };
}

/** Build the ADMIN EDIT model (defaults + lock flags + all options with enabled/isDefault). */
function mergeEditModel(form: RegistryForm, overlay: Overlay) {
  return {
    type: form.type,
    steps: form.steps.map((step) => ({
      key: step.key,
      title: step.title,
      questions: orderedKeys(step, overlay.order?.[step.key])
        .map((k) => step.questions.find((q) => q.key === k)!)
        .map((q) => {
          const ov = overlay.q?.[q.key];
          const hidden = effHidden(q, ov);
          return {
            key: q.key,
            type: q.type,
            defaultLabel: q.defaultLabel,
            label: asStr(ov?.label) || q.defaultLabel,
            help: asStr(ov?.help) || q.defaultHelp || '',
            required: effRequired(q, ov, hidden),
            lockedRequired: Boolean(q.lockedRequired),
            hidden,
            canHide: Boolean(q.canHide),
            optionSource: q.optionSource ?? 'none',
            linkUrl: asStr(ov?.linkUrl) || q.defaultLinkUrl || '',
            linkLabel: asStr(ov?.linkLabel) || q.defaultLinkLabel || '',
            options: q.type === 'select' ? effectiveOptions(q, ov) : [],
          };
        }),
    })),
  };
}

/** Thrown to signal a 400 to the controller. */
export class OverlayValidationError extends Error {}

/**
 * Validate an admin editor payload and normalize it into a stored Overlay.
 * Payload shape (order is implied by array position):
 *   { steps: [ { key, questions: [ { key, label?, help?, required?, hidden?,
 *                                     linkUrl?, linkLabel?,
 *                                     options?: [{value,label,enabled}] } ] } ] }
 * Rejects: unknown step/question keys, type changes, new enum option VALUES,
 * required:false on lockedRequired, hidden on a non-canHide question.
 */
function buildOverlay(form: RegistryForm, payload: any): Overlay {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.steps)) {
    throw new OverlayValidationError('Structură invalidă: lipsește lista de pași.');
  }

  const stepByKey = new Map(form.steps.map((s) => [s.key, s]));
  const overlay: Overlay = { q: {}, order: {} };
  const seenSteps = new Set<string>();

  for (const stepIn of payload.steps) {
    const stepKey = asStr(stepIn?.key);
    const regStep = stepByKey.get(stepKey);
    if (!regStep) throw new OverlayValidationError(`Pas necunoscut: ${stepKey || '(gol)'}.`);
    if (seenSteps.has(stepKey)) throw new OverlayValidationError(`Pas duplicat: ${stepKey}.`);
    seenSteps.add(stepKey);
    if (!Array.isArray(stepIn.questions)) {
      throw new OverlayValidationError(`Pasul ${stepKey} nu are o listă de întrebări.`);
    }

    const regQByKey = new Map(regStep.questions.map((q) => [q.key, q]));
    const orderKeys: string[] = [];
    const seenQ = new Set<string>();

    for (const qIn of stepIn.questions) {
      const qKey = asStr(qIn?.key);
      const regQ = regQByKey.get(qKey);
      if (!regQ) throw new OverlayValidationError(`Întrebare necunoscută: ${qKey || '(gol)'} în pasul ${stepKey}.`);
      if (seenQ.has(qKey)) throw new OverlayValidationError(`Întrebare duplicată: ${qKey}.`);
      // reject an attempt to change the type
      if (qIn.type !== undefined && asStr(qIn.type) && asStr(qIn.type) !== regQ.type) {
        throw new OverlayValidationError(`Tipul întrebării ${qKey} nu poate fi schimbat.`);
      }
      seenQ.add(qKey);
      orderKeys.push(qKey);

      const qov: QuestionOverlay = {};

      if (typeof qIn.label === 'string') qov.label = qIn.label.trim();
      if (typeof qIn.help === 'string') qov.help = qIn.help.trim();

      // required
      if (qIn.required !== undefined) {
        const req = asBool(qIn.required);
        if (regQ.lockedRequired && !req) {
          throw new OverlayValidationError(`Câmpul ${qKey} este obligatoriu prin lege și nu poate deveni opțional.`);
        }
        if (!regQ.lockedRequired) qov.required = req;
      }

      // hidden
      if (qIn.hidden !== undefined) {
        const hid = asBool(qIn.hidden);
        if (hid && !regQ.canHide) {
          throw new OverlayValidationError(`Întrebarea ${qKey} nu poate fi ascunsă.`);
        }
        if (regQ.canHide) qov.hidden = hid;
      }

      // info block link
      if (regQ.type === 'info') {
        if (typeof qIn.linkUrl === 'string') qov.linkUrl = qIn.linkUrl.trim();
        if (typeof qIn.linkLabel === 'string') qov.linkLabel = qIn.linkLabel.trim();
      }

      // options (selects only)
      if (regQ.type === 'select' && Array.isArray(qIn.options)) {
        const regValues = new Set((regQ.options ?? []).map((o) => o.value));
        const optMap: Record<string, OptionOverlay> = {};
        const optionOrder: string[] = [];
        const addedOptions: { value: string; label: string }[] = [];
        const seenVals = new Set<string>();

        for (const optIn of qIn.options) {
          const value = asStr(optIn?.value);
          if (!value) continue;
          if (seenVals.has(value)) continue;
          seenVals.add(value);

          const isRegistryValue = regValues.has(value);
          if (!isRegistryValue) {
            if (regQ.optionSource !== 'freetext') {
              // enum-backed selects can never gain a new option VALUE
              throw new OverlayValidationError(
                `Opțiune nouă interzisă pentru ${qKey}: valorile sunt fixe (necesită dezvoltare).`,
              );
            }
            addedOptions.push({ value, label: asStr(optIn?.label) || value });
          }

          optionOrder.push(value);
          const ov: OptionOverlay = {};
          if (typeof optIn?.label === 'string') ov.label = optIn.label.trim();
          if (optIn?.enabled !== undefined) ov.enabled = asBool(optIn.enabled);
          if (Object.keys(ov).length) optMap[value] = ov;
        }

        if (Object.keys(optMap).length) qov.options = optMap;
        if (optionOrder.length) qov.optionOrder = optionOrder;
        if (addedOptions.length) qov.addedOptions = addedOptions;
      }

      if (Object.keys(qov).length) overlay.q![qKey] = qov;
    }

    // record the question order for this step (append any omitted registry keys)
    overlay.order![stepKey] = [
      ...orderKeys,
      ...regStep.questions.map((q) => q.key).filter((k) => !seenQ.has(k)),
    ];
  }

  return overlay;
}

export default factories.createCoreService(UID, ({ strapi }) => ({
  async loadOverlay(type: FormType): Promise<Overlay> {
    try {
      const doc = await strapi.documents(UID).findFirst({ filters: { type } });
      const overlay = (doc as any)?.overlay;
      return overlay && typeof overlay === 'object' ? (overlay as Overlay) : {};
    } catch {
      return {};
    }
  },

  async saveOverlay(type: FormType, overlay: Overlay): Promise<void> {
    const existing = await strapi.documents(UID).findFirst({ filters: { type } });
    const data = { type, overlay } as any;
    if (existing) {
      await strapi.documents(UID).update({ documentId: (existing as any).documentId, data });
    } else {
      await strapi.documents(UID).create({ data });
    }
  },

  async publicConfig(type: FormType) {
    const overlay = await this.loadOverlay(type);
    return mergePublicModel(REGISTRY[type], overlay);
  },

  async editConfig(type: FormType) {
    const overlay = await this.loadOverlay(type);
    return mergeEditModel(REGISTRY[type], overlay);
  },

  /** Validate + persist an editor payload. Throws OverlayValidationError on 400. */
  async saveConfig(type: FormType, payload: any) {
    const overlay = buildOverlay(REGISTRY[type], payload);
    await this.saveOverlay(type, overlay);
    return mergeEditModel(REGISTRY[type], overlay);
  },

  /**
   * Data-type format validation driven by the registry `type`. For every field
   * whose registry type is `email` or `tel`, verify the value's shape. Empty
   * values pass here (presence is enforced separately by the effective-required
   * check), so an optional/blank email or phone is accepted. Returns the first
   * Romanian error message (naming the field by its effective label), or null.
   */
  async validateFieldFormats(type: FormType, values: Record<string, unknown>): Promise<string | null> {
    const overlay = await this.loadOverlay(type);
    for (const step of REGISTRY[type].steps) {
      for (const q of step.questions) {
        if (q.type !== 'email' && q.type !== 'tel') continue;
        const raw = values[q.key];
        const val = typeof raw === 'string' ? raw.trim() : '';
        if (!val) continue; // empty/optional passes; presence handled elsewhere
        const label = asStr(overlay.q?.[q.key]?.label) || q.defaultLabel;
        if (q.type === 'email' && !EMAIL_RE.test(val)) {
          return `Adresa de email din câmpul "${label}" nu este validă.`;
        }
        if (q.type === 'tel' && !isPhoneLike(val)) {
          return `Numărul de telefon din câmpul "${label}" nu este valid.`;
        }
      }
    }
    return null;
  },

  /** Effective requiredness map (key -> bool) honoring locks, overlay and hidden. */
  async effectiveRequired(type: FormType): Promise<Record<string, boolean>> {
    const overlay = await this.loadOverlay(type);
    const out: Record<string, boolean> = {};
    for (const step of REGISTRY[type].steps) {
      for (const q of step.questions) {
        const ov = overlay.q?.[q.key];
        out[q.key] = effRequired(q, ov, effHidden(q, ov));
      }
    }
    return out;
  },
}));

export { OverlayValidationError as _OverlayValidationError };
