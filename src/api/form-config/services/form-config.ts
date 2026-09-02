/**
 * form-config service: loads the stored OVERLAY for a form and merges it with
 * the code REGISTRY into the effective render models, plus validates+builds an
 * overlay from an admin editor payload.
 *
 * The overlay carries, on top of the code registry:
 *   - per built-in question edits (label/help/required/hidden, option
 *     rename/reorder/enable, and — for freetext selects — added options)
 *   - `removed`: built-in questions marked removedFromForm (they vanish from the
 *     form but their key/column/history stay; the DB column is never dropped)
 *   - `custom`: brand-new questions the editor added, each with a generated
 *     stable key (`c_<id>`), an immutable type, label/help/required, step
 *     assignment, and (for selects) inline options with stable values
 *   - `order`: per-step ordered question keys (built-in AND custom interleaved)
 *
 * Two merged views are produced:
 *   - public: the minimal render model the public site consumes (removed +
 *     hidden questions omitted; only enabled select options)
 *   - edit:   the richer model the admin editor needs (defaults + lock flags +
 *     removable/sensitive markers + the list of removed built-ins)
 */

import { factories } from '@strapi/strapi';
import {
  REGISTRY,
  SENSITIVE_BUILTIN_KEYS,
  isCustomQuestionType,
  type FormType,
  type RegistryForm,
  type RegistryQuestion,
  type RegistryStep,
  type CustomQuestionType,
  CARD_CAPABLE_TYPES,
  isCardIcon,
  isDisplayMode,
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
  display?: string;
  title?: string;
  icon?: string;
  linkUrl?: string;
  linkLabel?: string;
  options?: Record<string, OptionOverlay>; // keyed by option value
  optionOrder?: string[]; // ordered option values
  addedOptions?: { value: string; label: string }[]; // freetext selects only
}
/** A stored option for a custom select. `value` is a server-generated stable id. */
interface CustomOption {
  value: string;
  label: string;
  enabled: boolean;
}
/** A custom (admin-added) question. `type` is immutable after creation. */
interface CustomQuestion {
  key: string; // c_<id>
  type: CustomQuestionType;
  step: string; // step key it lives in
  label: string;
  help?: string;
  required: boolean;
  options?: CustomOption[]; // select only
}
export interface Overlay {
  q?: Record<string, QuestionOverlay>;
  order?: Record<string, string[]>; // stepKey -> ordered question keys
  removed?: Record<string, boolean>; // built-in key -> removedFromForm
  custom?: CustomQuestion[];
}

const asStr = (v: unknown) => (typeof v === 'string' ? v : '');
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';

// Data-type format checks, driven by the registry / custom question `type`.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ALLOWED_RE = /^[0-9+\-\s()]+$/;
const isPhoneLike = (v: string) => PHONE_ALLOWED_RE.test(v) && v.replace(/\D/g, '').length >= 7;

const MAX_TEXT = 5000;

/** Short, collision-resistant id used for custom keys and generated option values. */
function genId(prefix: string): string {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

/* ------------------------------------------------------------------ helpers */

function customList(overlay: Overlay): CustomQuestion[] {
  return Array.isArray(overlay.custom) ? overlay.custom : [];
}

function isRemoved(overlay: Overlay, key: string): boolean {
  return Boolean(overlay.removed?.[key]);
}

/**
 * Effective, ordered question keys for a step: honours overlay order, drops
 * removed built-ins, and interleaves custom questions assigned to this step.
 * Returns descriptors resolving each key to a built-in or a custom question.
 */
type StepEntry =
  | { key: string; builtin: RegistryQuestion; custom?: undefined }
  | { key: string; custom: CustomQuestion; builtin?: undefined };

function stepEntries(step: RegistryStep, overlay: Overlay): StepEntry[] {
  const regByKey = new Map(step.questions.map((q) => [q.key, q]));
  const regKeys = step.questions.map((q) => q.key).filter((k) => !isRemoved(overlay, k));
  const customs = customList(overlay).filter((c) => c.step === step.key);
  const custByKey = new Map(customs.map((c) => [c.key, c]));
  const custKeys = customs.map((c) => c.key);

  const valid = new Set<string>([...regKeys, ...custKeys]);
  const order = Array.isArray(overlay.order?.[step.key]) ? overlay.order![step.key] : [];
  const known: string[] = [];
  const used = new Set<string>();
  for (const k of order) {
    if (valid.has(k) && !used.has(k)) {
      used.add(k);
      known.push(k);
    }
  }
  const missing = [...regKeys, ...custKeys].filter((k) => !used.has(k));
  const finalKeys = [...known, ...missing];

  return finalKeys.map((k): StepEntry => {
    const b = regByKey.get(k);
    if (b) return { key: k, builtin: b };
    return { key: k, custom: custByKey.get(k)! };
  });
}

/** Effective option list for a BUILT-IN select (registry + freetext additions). */
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
      ? [
          ...ov!.optionOrder.filter((v) => byValue.has(v)),
          ...all.map((o) => o.value).filter((v) => !ov!.optionOrder!.includes(v)),
        ]
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

/** Effective option list for a CUSTOM select (stored inline on the question). */
function customOptions(c: CustomQuestion) {
  return (c.options ?? []).map((o) => ({
    value: o.value,
    label: o.label,
    enabled: o.enabled !== false,
    isDefault: false,
  }));
}

function builtinRequired(q: RegistryQuestion, ov: QuestionOverlay | undefined, hidden: boolean): boolean {
  if (q.type === 'info') return false;
  if (q.lockedRequired) return true;
  if (hidden) return false;
  return ov?.required === undefined ? q.required : Boolean(ov.required);
}

function builtinHidden(q: RegistryQuestion, ov?: QuestionOverlay): boolean {
  if (!q.canHide) return false;
  return Boolean(ov?.hidden);
}

/* ---------------------------------------------------------------- PUBLIC model */

function mergePublicModel(form: RegistryForm, overlay: Overlay) {
  return {
    type: form.type,
    steps: form.steps.map((step) => ({
      key: step.key,
      title: step.title,
      questions: stepEntries(step, overlay)
        .map((e) => {
          if (e.custom) {
            const c = e.custom;
            const base: Record<string, unknown> = {
              key: c.key,
              type: c.type,
              custom: true,
              label: c.label,
              help: c.help || '',
              required: Boolean(c.required),
              hidden: false,
            };
            if (c.type === 'select') {
              base.options = customOptions(c)
                .filter((o) => o.enabled)
                .map((o) => ({ value: o.value, label: o.label, enabled: true }));
            }
            return base;
          }
          const q = e.builtin!;
          const ov = overlay.q?.[q.key];
          const hidden = builtinHidden(q, ov);
          if (hidden) return null; // public consumer never sees hidden questions
          if (q.type === 'info') {
            return {
              key: q.key,
              type: q.type,
              label: asStr(ov?.label) || q.defaultLabel,
              display: asStr(ov?.display) || q.defaultDisplay || 'plain',
              title: asStr(ov?.title) || q.defaultTitle || '',
              icon: asStr(ov?.icon) || q.defaultIcon || '',
              linkUrl: asStr(ov?.linkUrl) || q.defaultLinkUrl || '',
              linkLabel: asStr(ov?.linkLabel) || q.defaultLinkLabel || '',
            };
          }
          const base: Record<string, unknown> = {
            key: q.key,
            type: q.type,
            label: asStr(ov?.label) || q.defaultLabel,
            help: asStr(ov?.help) || q.defaultHelp || '',
            required: builtinRequired(q, ov, hidden),
            hidden: false,
          };
          if (q.type === 'select') {
            base.options = effectiveOptions(q, ov)
              .filter((o) => o.enabled)
              .map((o) => ({ value: o.value, label: o.label, enabled: true }));
          }
          // A card-capable question renders as a card once it has a title or
          // an icon; otherwise these are empty and it renders plainly.
          if (CARD_CAPABLE_TYPES.has(q.type)) {
            base.display = asStr(ov?.display) || q.defaultDisplay || 'plain';
            base.title = asStr(ov?.title) || q.defaultTitle || '';
            base.icon = asStr(ov?.icon) || q.defaultIcon || '';
            base.linkUrl = asStr(ov?.linkUrl) || q.defaultLinkUrl || '';
            base.linkLabel = asStr(ov?.linkLabel) || q.defaultLinkLabel || '';
          }
          return base;
        })
        .filter((x): x is Record<string, unknown> => x !== null),
    })),
  };
}

/* ------------------------------------------------------------------ EDIT model */

function editQuestion(e: StepEntry, overlay: Overlay) {
  if (e.custom) {
    const c = e.custom;
    return {
      key: c.key,
      type: c.type,
      isBuiltin: false,
      isCustom: true,
      typeLocked: true,
      sensitive: false,
      removable: true,
      defaultLabel: '',
      label: c.label,
      help: c.help || '',
      required: Boolean(c.required),
      lockedRequired: false,
      hidden: false,
      canHide: true,
      optionSource: c.type === 'select' ? ('freetext' as const) : ('none' as const),
      cardCapable: CARD_CAPABLE_TYPES.has(c.type),
      display: 'plain',
      title: '',
      icon: '',
      linkUrl: '',
      linkLabel: '',
      options: c.type === 'select' ? customOptions(c) : [],
    };
  }
  const q = e.builtin!;
  const ov = overlay.q?.[q.key];
  const hidden = builtinHidden(q, ov);
  return {
    key: q.key,
    type: q.type,
    isBuiltin: true,
    isCustom: false,
    typeLocked: true,
    sensitive: SENSITIVE_BUILTIN_KEYS.has(q.key),
    removable: true,
    defaultLabel: q.defaultLabel,
    label: asStr(ov?.label) || q.defaultLabel,
    help: asStr(ov?.help) || q.defaultHelp || '',
    required: builtinRequired(q, ov, hidden),
    lockedRequired: Boolean(q.lockedRequired),
    hidden,
    canHide: Boolean(q.canHide),
    optionSource: q.optionSource ?? 'none',
    cardCapable: CARD_CAPABLE_TYPES.has(q.type),
    display: asStr(ov?.display) || q.defaultDisplay || 'plain',
    title: asStr(ov?.title) || q.defaultTitle || '',
    icon: asStr(ov?.icon) || q.defaultIcon || '',
    linkUrl: asStr(ov?.linkUrl) || q.defaultLinkUrl || '',
    linkLabel: asStr(ov?.linkLabel) || q.defaultLinkLabel || '',
    options: q.type === 'select' ? effectiveOptions(q, ov) : [],
  };
}

function mergeEditModel(form: RegistryForm, overlay: Overlay) {
  const removedBuiltins: { key: string; label: string; step: string }[] = [];
  for (const step of form.steps) {
    for (const q of step.questions) {
      if (isRemoved(overlay, q.key)) {
        removedBuiltins.push({
          key: q.key,
          label: asStr(overlay.q?.[q.key]?.label) || q.defaultLabel,
          step: step.key,
        });
      }
    }
  }
  return {
    type: form.type,
    removedBuiltins,
    steps: form.steps.map((step) => ({
      key: step.key,
      title: step.title,
      questions: stepEntries(step, overlay).map((e) => editQuestion(e, overlay)),
    })),
  };
}

/* ---------------------------------------------------------------- validation */

export class OverlayValidationError extends Error {}

/**
 * Validate an admin editor payload and normalize it into a stored Overlay.
 * Payload shape (array position implies order):
 *   {
 *     removedBuiltins?: string[],
 *     steps: [ { key, questions: [ {
 *        key?, type?, isCustom?, label?, help?, required?, hidden?,
 *        linkUrl?, linkLabel?,
 *        options?: [{ value?, label, enabled? }]
 *     } ] } ]
 *   }
 * `prev` is the currently-stored overlay, needed to lock a custom question's
 * type after creation.
 */
function buildOverlay(form: RegistryForm, payload: any, prev: Overlay): Overlay {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.steps)) {
    throw new OverlayValidationError('Structură invalidă: lipsește lista de pași.');
  }

  const stepByKey = new Map(form.steps.map((s) => [s.key, s]));
  const allRegistryKeys = new Set<string>();
  for (const s of form.steps) for (const q of s.questions) allRegistryKeys.add(q.key);

  const prevCustomByKey = new Map(customList(prev).map((c) => [c.key, c]));

  const overlay: Overlay = { q: {}, order: {}, removed: {}, custom: [] };
  const seenSteps = new Set<string>();
  const usedCustomKeys = new Set<string>();

  // Built-ins explicitly removed from the form.
  const removedInput = Array.isArray(payload.removedBuiltins) ? payload.removedBuiltins : [];
  for (const rk of removedInput) {
    const k = asStr(rk);
    if (allRegistryKeys.has(k)) overlay.removed![k] = true;
  }

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
      const rawKey = asStr(qIn?.key);
      const isBuiltinKey = regQByKey.has(rawKey);

      // A built-in key that belongs to a different step is rejected: built-ins
      // are registry-fixed to their step and cannot be moved across steps.
      if (!isBuiltinKey && allRegistryKeys.has(rawKey)) {
        throw new OverlayValidationError(`Întrebarea încorporată ${rawKey} nu poate fi mutată în alt pas.`);
      }

      if (isBuiltinKey) {
        const regQ = regQByKey.get(rawKey)!;
        if (seenQ.has(rawKey)) throw new OverlayValidationError(`Întrebare duplicată: ${rawKey}.`);
        // Presence in the form overrides any stale "removed" flag.
        delete overlay.removed![rawKey];
        if (qIn.type !== undefined && asStr(qIn.type) && asStr(qIn.type) !== regQ.type) {
          throw new OverlayValidationError(`Tipul întrebării ${rawKey} nu poate fi schimbat.`);
        }
        seenQ.add(rawKey);
        orderKeys.push(rawKey);
        buildBuiltinOverlay(overlay, regQ, qIn);
        continue;
      }

      // Otherwise it is a CUSTOM question (existing or brand-new).
      const custom = buildCustomQuestion(rawKey, qIn, stepKey, prevCustomByKey, usedCustomKeys);
      overlay.custom!.push(custom);
      usedCustomKeys.add(custom.key);
      orderKeys.push(custom.key);
    }

    // Persist order; append any non-removed built-in that the editor omitted.
    overlay.order![stepKey] = [
      ...orderKeys,
      ...regStep.questions
        .map((q) => q.key)
        .filter((k) => !seenQ.has(k) && !overlay.removed![k]),
    ];
  }

  return overlay;
}

/** Validate + collect one built-in question's overlay into `overlay.q`. */
function buildBuiltinOverlay(overlay: Overlay, regQ: RegistryQuestion, qIn: any): void {
  const qKey = regQ.key;
  const qov: QuestionOverlay = {};

  if (typeof qIn.label === 'string') qov.label = qIn.label.trim();
  if (typeof qIn.help === 'string') qov.help = qIn.help.trim();

  if (qIn.required !== undefined) {
    const req = asBool(qIn.required);
    if (regQ.lockedRequired && !req) {
      throw new OverlayValidationError(`Câmpul ${qKey} este obligatoriu prin lege și nu poate deveni opțional.`);
    }
    if (!regQ.lockedRequired) qov.required = req;
  }

  if (qIn.hidden !== undefined) {
    const hid = asBool(qIn.hidden);
    if (hid && !regQ.canHide) {
      throw new OverlayValidationError(`Întrebarea ${qKey} nu poate fi ascunsă.`);
    }
    if (regQ.canHide) qov.hidden = hid;
  }

  // Card fields. `checkbox` and `info` both render as a card once a title or
  // icon is present, so both accept the same properties.
  if (CARD_CAPABLE_TYPES.has(regQ.type)) {
    if (typeof qIn.display === 'string') {
      const mode = qIn.display.trim();
      if (!isDisplayMode(mode)) {
        throw new OverlayValidationError(
          `Modul de afișare "${mode}" nu este valid pentru întrebarea ${qKey}.`,
        );
      }
      qov.display = mode;
    }
    if (typeof qIn.linkUrl === 'string') qov.linkUrl = qIn.linkUrl.trim();
    if (typeof qIn.linkLabel === 'string') qov.linkLabel = qIn.linkLabel.trim();
    if (typeof qIn.title === 'string') qov.title = qIn.title.trim();
    if (typeof qIn.icon === 'string') {
      const icon = qIn.icon.trim();
      if (icon !== '' && !isCardIcon(icon)) {
        throw new OverlayValidationError(
          `Pictograma "${icon}" nu este permisă pentru întrebarea ${qKey}.`,
        );
      }
      qov.icon = icon;
    }
  }

  if (regQ.type === 'select' && Array.isArray(qIn.options)) {
    const regValues = new Set((regQ.options ?? []).map((o) => o.value));
    const optMap: Record<string, OptionOverlay> = {};
    const optionOrder: string[] = [];
    const addedOptions: { value: string; label: string }[] = [];
    const seenVals = new Set<string>();

    for (const optIn of qIn.options) {
      let value = asStr(optIn?.value).trim();
      const label = typeof optIn?.label === 'string' ? optIn.label.trim() : '';
      const isRegistryValue = value !== '' && regValues.has(value);

      if (!isRegistryValue) {
        // A brand-new option. Enum-backed selects can never gain one. These
        // selects are string-backed, so the stored VALUE is the label text
        // itself (readable, matches the registry defaults and existing data).
        if (regQ.optionSource !== 'freetext') {
          throw new OverlayValidationError(
            `Opțiune nouă interzisă pentru ${qKey}: valorile sunt fixe (necesită dezvoltare).`,
          );
        }
        if (!label) continue; // ignore an empty brand-new option
        value = label;
        if (!regValues.has(value) && !seenVals.has(value)) addedOptions.push({ value, label });
      }
      if (seenVals.has(value)) continue;
      seenVals.add(value);

      optionOrder.push(value);
      const ov: OptionOverlay = {};
      // Only a registry (fixed-value) option needs a label override; for added
      // options value === label so no override is stored.
      if (label && label !== value) ov.label = label;
      if (optIn?.enabled !== undefined) ov.enabled = asBool(optIn.enabled);
      if (Object.keys(ov).length) optMap[value] = ov;
    }

    if (Object.keys(optMap).length) qov.options = optMap;
    if (optionOrder.length) qov.optionOrder = optionOrder;
    if (addedOptions.length) qov.addedOptions = addedOptions;
  }

  if (Object.keys(qov).length) overlay.q![qKey] = qov;
}

/** Validate a custom question payload into a stored CustomQuestion. */
function buildCustomQuestion(
  rawKey: string,
  qIn: any,
  stepKey: string,
  prevCustomByKey: Map<string, CustomQuestion>,
  usedCustomKeys: Set<string>,
): CustomQuestion {
  const type = asStr(qIn?.type);
  if (!isCustomQuestionType(type)) {
    throw new OverlayValidationError(`Tip de întrebare invalid: ${type || '(gol)'}.`);
  }

  // Resolve a stable key. Reuse a valid, unique c_ key (existing custom); else
  // mint a fresh one. A brand-new question arrives with no / a temp key.
  let key = rawKey;
  const reuse = /^c_[a-z0-9]+$/i.test(key) && !usedCustomKeys.has(key);
  if (!reuse) key = genId('c_');

  // Type is immutable once created.
  const prevC = prevCustomByKey.get(key);
  if (prevC && prevC.type !== type) {
    throw new OverlayValidationError('Tipul unei întrebări adăugate nu poate fi schimbat.');
  }

  const label = typeof qIn?.label === 'string' ? qIn.label.trim() : '';
  if (!label) throw new OverlayValidationError('Eticheta întrebării adăugate este obligatorie.');

  const custom: CustomQuestion = {
    key,
    type,
    step: stepKey,
    label,
    required: asBool(qIn?.required),
  };
  const help = typeof qIn?.help === 'string' ? qIn.help.trim() : '';
  if (help) custom.help = help;

  if (type === 'select') {
    // Custom selects are string-backed: the stored VALUE is the label text.
    const options: CustomOption[] = [];
    const seen = new Set<string>();
    if (Array.isArray(qIn?.options)) {
      for (const optIn of qIn.options) {
        const label2 = typeof optIn?.label === 'string' ? optIn.label.trim() : '';
        if (!label2 || seen.has(label2)) continue;
        seen.add(label2);
        options.push({ value: label2, label: label2, enabled: optIn?.enabled === undefined ? true : asBool(optIn.enabled) });
      }
    }
    custom.options = options;
  }

  return custom;
}

/* ------------------------------------------------------------------- service */

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
    const prev = await this.loadOverlay(type);
    const overlay = buildOverlay(REGISTRY[type], payload, prev);
    await this.saveOverlay(type, overlay);
    return mergeEditModel(REGISTRY[type], overlay);
  },

  /**
   * Data-type format validation for the FIXED (built-in) email/tel fields.
   * Empty values pass here (presence is enforced separately). Removed built-ins
   * are skipped. Returns the first Romanian error, or null.
   */
  async validateFieldFormats(type: FormType, values: Record<string, unknown>): Promise<string | null> {
    const overlay = await this.loadOverlay(type);
    for (const step of REGISTRY[type].steps) {
      for (const q of step.questions) {
        if (q.type !== 'email' && q.type !== 'tel') continue;
        if (isRemoved(overlay, q.key)) continue;
        const raw = values[q.key];
        const val = typeof raw === 'string' ? raw.trim() : '';
        if (!val) continue;
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

  /**
   * Validate a provided BUILT-IN select value (e.g. `level`, `reason`) against
   * the currently-enabled options in the effective config. Empty values pass.
   * `values` is a key->string map. Returns the first Romanian error, or null.
   */
  async validateBuiltinSelects(type: FormType, values: Record<string, string>): Promise<string | null> {
    const overlay = await this.loadOverlay(type);
    for (const step of REGISTRY[type].steps) {
      for (const q of step.questions) {
        if (q.type !== 'select') continue;
        if (isRemoved(overlay, q.key)) continue;
        if (!(q.key in values)) continue;
        const val = asStr(values[q.key]).trim();
        if (!val) continue;
        const enabled = new Set(effectiveOptions(q, overlay.q?.[q.key]).filter((o) => o.enabled).map((o) => o.value));
        if (!enabled.has(val)) {
          const label = asStr(overlay.q?.[q.key]?.label) || q.defaultLabel;
          return `Valoare invalidă pentru câmpul "${label}".`;
        }
      }
    }
    return null;
  },

  /**
   * Effective requiredness map (key -> bool) for BUILT-IN questions, honouring
   * locks, overlay, hidden and removed. Removed built-ins are required:false.
   */
  async effectiveRequired(type: FormType): Promise<Record<string, boolean>> {
    const overlay = await this.loadOverlay(type);
    const out: Record<string, boolean> = {};
    for (const step of REGISTRY[type].steps) {
      for (const q of step.questions) {
        if (isRemoved(overlay, q.key)) {
          out[q.key] = false;
          continue;
        }
        const ov = overlay.q?.[q.key];
        out[q.key] = builtinRequired(q, ov, builtinHidden(q, ov));
      }
    }
    return out;
  },

  /**
   * Validate + collect the custom answers from a public submit's `extra` map.
   * Only known custom questions are considered; unknown keys are ignored.
   * Returns { error } (Romanian, 400) or { values } (the map to store in `extra`).
   */
  async validateExtra(
    type: FormType,
    extraRaw: unknown,
  ): Promise<{ error?: string; values?: Record<string, unknown> }> {
    const overlay = await this.loadOverlay(type);
    const customs = customList(overlay).filter((c) => REGISTRY[type].steps.some((s) => s.key === c.step));
    const src = extraRaw && typeof extraRaw === 'object' ? (extraRaw as Record<string, unknown>) : {};
    const values: Record<string, unknown> = {};

    for (const c of customs) {
      const raw = src[c.key];
      if (c.type === 'checkbox') {
        const b = asBool(raw);
        if (c.required && !b) return { error: `Câmpul "${c.label}" este obligatoriu.` };
        values[c.key] = b;
        continue;
      }
      if (c.type === 'select') {
        const val = asStr(raw).trim();
        if (c.required && !val) return { error: `Câmpul "${c.label}" este obligatoriu.` };
        if (val) {
          const enabled = new Set(customOptions(c).filter((o) => o.enabled).map((o) => o.value));
          if (!enabled.has(val)) return { error: `Valoare invalidă pentru câmpul "${c.label}".` };
        }
        values[c.key] = val;
        continue;
      }
      // text / longtext / email / tel / date
      const val = asStr(raw).trim().slice(0, MAX_TEXT);
      if (c.required && !val) return { error: `Câmpul "${c.label}" este obligatoriu.` };
      if (val && c.type === 'email' && !EMAIL_RE.test(val)) {
        return { error: `Adresa de email din câmpul "${c.label}" nu este validă.` };
      }
      if (val && c.type === 'tel' && !isPhoneLike(val)) {
        return { error: `Numărul de telefon din câmpul "${c.label}" nu este valid.` };
      }
      values[c.key] = val;
    }

    return { values };
  },

  /**
   * Metadata the admin results table needs to render union columns:
   *   - removedBuiltins: built-in keys removed from the form (label with suffix)
   *   - customs: active custom questions (key + label + type + step)
   *   - selectOptions: enabled option values per built-in select (for filters)
   */
  async adminFormMeta(type: FormType) {
    const overlay = await this.loadOverlay(type);
    const removedBuiltins: string[] = [];
    const selectOptions: Record<string, { value: string; label: string }[]> = {};
    for (const step of REGISTRY[type].steps) {
      for (const q of step.questions) {
        if (isRemoved(overlay, q.key)) removedBuiltins.push(q.key);
        if (q.type === 'select' && !isRemoved(overlay, q.key)) {
          selectOptions[q.key] = effectiveOptions(q, overlay.q?.[q.key])
            .filter((o) => o.enabled)
            .map((o) => ({ value: o.value, label: o.label }));
        }
      }
    }
    const customs = customList(overlay)
      .filter((c) => REGISTRY[type].steps.some((s) => s.key === c.step))
      .map((c) => ({ key: c.key, label: c.label, type: c.type, step: c.step }));
    return { removedBuiltins, customs, selectOptions };
  },
}));

export { OverlayValidationError as _OverlayValidationError };
