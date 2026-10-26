import type { FieldChange } from './admin-result';
import { birthDateSortKey } from './birth-date';
import type { RebuildResult } from './documents';
import type { HistoryInput } from './history';
import { HISTORY_ACTIONS, SUBJECT } from './history-text';
import { REGISTRATION_EDIT_ERROR, REGISTRATION_EDIT_FIELDS, documentRebuiltEntry, normalizeRegistrationEdit, registrationEditError } from './registration-edit';
import { LAST_SEASON_OPTIONS, RELATIONSHIP_OTHER, SOURCE_OPTIONS, SOURCE_OTHER } from './registration-form-options';
import { parseChildHeight } from './registration-input';

/**
 * PUT /api/forms/inscrieri/:documentId: the panel's "Editează" and the full table's cell edits (spec 3.2, 3.4).
 * Only changed fields are saved; each is written old -> new; the PDFs are rebuilt when a printed field changed;
 * no e-mail. "Confirmat" is set only by "Confirmă înscrierea" (spec 3.5).
 */
export const SETTABLE_STATUSES = ['Nou', 'Contactat', 'Respins'] as const;
export const STATUS_ERROR = 'Stare invalidă.';

export const EDITABLE_FIELDS: ReadonlySet<string> = new Set<string>([
  'email', 'phone', 'childName', 'childBirthDate', 'parentName', 'shirtSize', 'howHeard', 'level', 'priorExperience', 'expectations',
  'clubInterest', 'regulationsAgreement', 'privacyConsent', 'status', 'internalNote', 'archived', 'season',
  ...REGISTRATION_EDIT_FIELDS, 'childHeight', 'lastSeason', 'source', 'sourceOther',
]);
const MATCH_FIELDS = ['childName', 'childBirthDate', 'phone', 'email'];

export type RegistrationEditDeps = {
  find(id: string): Promise<Record<string, unknown> | null>;
  save(id: string, data: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  seasonIdForLabel(label: unknown): Promise<string | null>;
  rebuild(id: string, data: Record<string, unknown>): Promise<RebuildResult | null>;
  record(entry: HistoryInput): Promise<void>;
  refreshMatch(id: string): Promise<void>;
  log(message: string): void;
};
export type RegistrationEditResult =
  | { ok: true; data: Record<string, unknown>; rebuild: RebuildResult | null; changed: string[] }
  | { ok: false; status: 400 | 404; error: string };

const NOT_FOUND = { ok: false as const, status: 404 as const, error: 'not-found' };
const trimOrEmpty = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';
const blankToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

export function pickEditable(raw: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!EDITABLE_FIELDS.has(key)) continue;
    if (key === 'archived') data[key] = asBool(value);
    else if (key === 'season') data[key] = trimOrEmpty(value) || null;
    else data[key] = value;
  }
  return data;
}

const validHeight = (v: unknown) => v === null || v === '' || parseChildHeight(String(v).trim()) !== null;
const validLastSeason = (v: unknown) => v === null || v === '' || (LAST_SEASON_OPTIONS as readonly unknown[]).includes(v);
const validSource = (v: unknown) => v === null || v === '' || (SOURCE_OPTIONS as readonly unknown[]).includes(v);

export function editError(data: Record<string, unknown>): string | null {
  if ('status' in data && !(SETTABLE_STATUSES as readonly unknown[]).includes(data.status)) return STATUS_ERROR;
  if ('childHeight' in data && !validHeight(data.childHeight)) return REGISTRATION_EDIT_ERROR;
  if ('lastSeason' in data && !validLastSeason(data.lastSeason)) return REGISTRATION_EDIT_ERROR;
  if ('source' in data && !validSource(data.source)) return REGISTRATION_EDIT_ERROR;
  return registrationEditError(data);
}

const OTHER_TEXTS = [
  ['relationship', 'relationshipOther', RELATIONSHIP_OTHER],
  ['source', 'sourceOther', SOURCE_OTHER],
] as const;

/** An "other" text is kept only while its answer (sent, else stored) is "Alta" / "Altele". */
function clearOtherTexts(out: Record<string, unknown>, before: Record<string, unknown>): void {
  for (const [main, other, otherValue] of OTHER_TEXTS) {
    if (!(main in out) && !(other in out)) continue;
    const answer = main in out ? out[main] : before[main];
    if (answer !== otherValue) out[other] = null;
  }
}

function normalizeEdit(data: Record<string, unknown>, before: Record<string, unknown>): Record<string, unknown> {
  const out = normalizeRegistrationEdit(data);
  if ('childHeight' in out) out.childHeight = out.childHeight === null || out.childHeight === '' ? null : Number(String(out.childHeight).trim());
  if ('lastSeason' in out) out.lastSeason = trimOrEmpty(out.lastSeason) || null;
  if (typeof out.sourceOther === 'string') out.sourceOther = out.sourceOther.trim() || null;
  clearOtherTexts(out, before);
  return out;
}

/** Only values that change are checked: an old answer outside today's options passes while it stays as stored. */
function changedOnly(before: Record<string, unknown>, picked: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(picked).filter(([key, value]) => blankToNull(before[key]) !== blankToNull(value)));
}

export function editChanges(before: Record<string, unknown>, data: Record<string, unknown>): Record<string, FieldChange> {
  const out: Record<string, FieldChange> = {};
  for (const [key, to] of Object.entries(data)) {
    const from = blankToNull(before[key]);
    if (from !== blankToNull(to)) out[key] = { from, to: blankToNull(to) };
  }
  return out;
}

async function withDerived(deps: RegistrationEditDeps, changes: Record<string, FieldChange>): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = Object.fromEntries(Object.entries(changes).map(([k, c]) => [k, c.to]));
  if ('season' in data) data.seasonRef = await deps.seasonIdForLabel(data.season);
  if ('childBirthDate' in data) data.childBirthDateParsed = birthDateSortKey(data.childBirthDate);
  return data;
}

async function guarded(deps: RegistrationEditDeps, what: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (err) {
    deps.log(`[inscrieri] ${what} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function saveChanges(deps: RegistrationEditDeps, id: string, changes: Record<string, FieldChange>, actor: string): Promise<RegistrationEditResult> {
  const data = await withDerived(deps, changes);
  const saved = await deps.save(id, data);
  if (!saved) return NOT_FOUND;
  await guarded(deps, `history of ${id}`, () => deps.record({ subjectType: SUBJECT.registration, subjectId: id, action: HISTORY_ACTIONS.updated, changes: { fields: changes }, actor }));
  const rebuild = await deps.rebuild(id, data);
  if (rebuild?.ok) await guarded(deps, `rebuild history of ${id}`, () => deps.record(documentRebuiltEntry(id, rebuild.documents, actor)));
  if (MATCH_FIELDS.some((k) => k in changes)) await guarded(deps, `match of ${id}`, () => deps.refreshMatch(id));
  return { ok: true, data: saved, rebuild, changed: Object.keys(changes) };
}

export async function updateRegistration(deps: RegistrationEditDeps, id: string, raw: Record<string, unknown>, actor: string): Promise<RegistrationEditResult> {
  const before = await deps.find(id);
  if (!before) return NOT_FOUND;
  const sent = changedOnly(before, pickEditable(raw));
  const error = editError(sent);
  if (error) return { ok: false, status: 400, error };
  const changes = editChanges(before, normalizeEdit(sent, before));
  if (Object.keys(changes).length === 0) return { ok: true, data: before, rebuild: null, changed: [] };
  return saveChanges(deps, id, changes, actor);
}
