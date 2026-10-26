import { acsWord } from './acs';
import type { AthleteField } from './athlete-data';
import type { AthleteCard, ConfirmContext, GroupSection, RegistrationMatchView } from './athletes/api-types';
import { ADMIN_ERRORS, CONFIRM_ERRORS } from './athletes/errors';
import { ARROW } from './history-text';
import { CONFIRM_COPY, INSCRIERI_PENDING_COPY } from './inscrieri-copy';
import { requestErrorText } from './registration-panel';

/**
 * The confirm window (spec 4): what is chosen, what the button sends, the lines it shows and how a failure ends.
 * Pure; ConfirmWindow.tsx renders it. The server re-checks everything (plan 3-2 Task 17).
 */
export type Choice = 'existing' | 'new';
export type WindowState = {
  mode: 'choose' | 'search';
  athlete: AthleteCard | null;
  choice: Choice | null;
  compareOpen: boolean;
  ticks: AthleteField[] | null;
  groupId: string | null;
  makeMain: boolean;
  query: string;
};
export type WindowAction =
  | { type: 'choose'; choice: Choice }
  | { type: 'toggleCompare' }
  | { type: 'tick'; field: AthleteField; on: boolean; defaults: AthleteField[] }
  | { type: 'openSearch' }
  | { type: 'query'; text: string }
  | { type: 'closeSearch' }
  | { type: 'pick'; card: AthleteCard }
  | { type: 'pickNew' }
  | { type: 'group'; groupId: string | null }
  | { type: 'main'; on: boolean };
export type Gate = { disabled: boolean; hint: string | null; notice: string | null };
export type ConfirmBody = { choice: Choice; athleteId: string | null; groupId: string | null; makeMain: boolean; updateFields: AthleteField[] };
export type GroupChoice = { value: string; label: string; group: string };
export type Failure = { text: string; close: boolean };

export const CONFIRM_TOAST_MS = 8000;
export const SEARCH_DEBOUNCE_MS = 250;

/** "Sportiv existent" preselected only for Sigur (r3 c1); no proposed athlete: "Sportiv nou". A
 * typo match (Probabil) is at most offered, never preselected (view.preselect is null then). */
export function initialWindow(view: RegistrationMatchView): WindowState {
  const choice: Choice | null = view.existing ? view.preselect : 'new';
  return { mode: 'choose', athlete: view.existing, choice, compareOpen: false, ticks: null, groupId: null, makeMain: false, query: '' };
}

const withTick = (list: AthleteField[], field: AthleteField, on: boolean): AthleteField[] => {
  if (!on) return list.filter((f) => f !== field);
  return list.includes(field) ? list : [...list, field];
};

type Handlers = { [K in WindowAction['type']]: (s: WindowState, a: Extract<WindowAction, { type: K }>) => WindowState };

const HANDLERS: Handlers = {
  choose: (s, a) => ({ ...s, choice: a.choice }),
  toggleCompare: (s) => ({ ...s, compareOpen: !s.compareOpen }),
  tick: (s, a) => ({ ...s, ticks: withTick(s.ticks ?? a.defaults, a.field, a.on) }),
  openSearch: (s) => ({ ...s, mode: 'search', query: '' }),
  query: (s, a) => ({ ...s, query: a.text }),
  closeSearch: (s) => ({ ...s, mode: 'choose' }),
  pick: (s, a) => ({ ...s, mode: 'choose', athlete: a.card, choice: 'existing', ticks: null, compareOpen: false, makeMain: false }),
  pickNew: (s) => ({ ...s, mode: 'choose', choice: 'new', makeMain: false }),
  group: (s, a) => ({ ...s, groupId: a.groupId, makeMain: a.groupId ? s.makeMain : false }),
  main: (s, a) => ({ ...s, makeMain: a.on }),
};

export function windowReducer(s: WindowState, a: WindowAction): WindowState {
  const handle = HANDLERS[a.type] as (state: WindowState, action: WindowAction) => WindowState;
  return handle(s, a);
}

/** The athlete the confirm context is asked for: none for "Sportiv nou". */
export const contextAthleteId = (s: WindowState): string | null => (s.choice === 'new' ? null : s.athlete?.documentId ?? null);

const BLOCKED_TEXT: Record<NonNullable<ConfirmContext['blocked']>, string> = {
  'birth-date': CONFIRM_ERRORS.birthDate,
  confirmed: CONFIRM_ERRORS.taken,
  'not-confirmable': ADMIN_ERRORS.stale,
};

export function confirmGate(s: WindowState, ctx: ConfirmContext | null, loading: boolean): Gate {
  if (ctx?.blocked) return { disabled: true, hint: null, notice: BLOCKED_TEXT[ctx.blocked] };
  if (s.choice === null) return { disabled: true, hint: CONFIRM_COPY.pickHint, notice: null };
  return { disabled: loading || !ctx || s.mode === 'search', hint: null, notice: null };
}

/** POST .../confirm body (plan 3-2 ConfirmRequest). An ended season sends no group (r3b c9). The
 * "Grupă principală" tick only counts with both a picked group and an existing current main group
 * (the admin UI shows the tick only then, off by default; see initialWindow/HANDLERS.main/group). */
export function confirmBody(s: WindowState, ctx: ConfirmContext): ConfirmBody | null {
  if (!s.choice) return null;
  const existing = s.choice === 'existing';
  const groupId = ctx.season.running ? s.groupId : null;
  const makeMain = groupId !== null && ctx.mainGroupNow !== null && s.makeMain;
  const updateFields = existing ? s.ticks ?? ctx.defaultUpdateFields : [];
  return { choice: s.choice, athleteId: existing ? s.athlete?.documentId ?? null : null, groupId, makeMain, updateFields };
}

/** The line instead of the group and A.C.S. block when nothing but the link is written (spec 4.3). */
export function seasonNote(ctx: ConfirmContext): string | null {
  if (ctx.season.running) return null;
  return ctx.season.endedText ?? INSCRIERI_PENDING_COPY.noSeason;
}

export function seasonHeading(ctx: ConfirmContext, schoolName: string | null): string | null {
  const label = ctx.season.label;
  if (!label) return null;
  return schoolName ? CONFIRM_COPY.seasonHeading(schoolName, label) : INSCRIERI_PENDING_COPY.seasonOnly(label);
}

const wishWord = (wish: ConfirmContext['acs']['wish']): string => {
  if (wish === 'da') return 'Da';
  return wish === 'nu' ? 'Nu' : '';
};

/** "Membru A.C.S. <sezon>: Nu → În așteptare" and "Dorește să fie membru (formular): Da" (spec 4.4). */
export function acsLines(ctx: ConfirmContext): { status: string; wish: string } | null {
  const label = ctx.acs.seasonLabel;
  if (!ctx.season.running || !label) return null;
  const now = acsWord(ctx.acs.current);
  const state = ctx.acs.next ? `${now} ${ARROW} ${acsWord(ctx.acs.next)}` : now;
  return { status: `${CONFIRM_COPY.acs(label)}: ${state}`, wish: `${CONFIRM_COPY.wish}: ${wishWord(ctx.acs.wish)}`.trimEnd() };
}

export const intentLine = (ctx: ConfirmContext): string | null => (ctx.subscriptionIntent ? CONFIRM_COPY.intent(ctx.subscriptionIntent) : null);

/** "Grupă principală acum: <grupă> (<secțiune>)" — the athlete's current main group line, shown
 * only when there is one; the admin UI uses its presence to decide whether to offer the tick. */
export const mainNowLine = (ctx: ConfirmContext): string | null =>
  ctx.mainGroupNow ? CONFIRM_COPY.mainNow(ctx.mainGroupNow.name, ctx.mainGroupNow.sectionName) : null;

/** SearchableSelect options with section headers (plan 3-1 `ComboOption.group`), in the server's order. */
export const groupChoices = (groups: GroupSection[]): GroupChoice[] =>
  groups.flatMap((s) => s.groups.map((g) => ({ value: g.documentId, label: g.name, group: s.sectionName })));

export function newAthleteHint(ctx: ConfirmContext, withBirthDate: boolean): string {
  const { name, birthDate } = ctx.newAthlete;
  return CONFIRM_COPY.newHint(withBirthDate && birthDate ? `${name}, ${birthDate}` : name);
}

type ErrorShape = { status?: unknown; response?: { status?: unknown; data?: { error?: { status?: unknown } } } };

/** The HTTP status of an admin fetch error (Strapi's FetchError carries `status` from the error body). */
export function errorStatus(err: unknown): number | null {
  const e = (err && typeof err === 'object' ? err : {}) as ErrorShape;
  const status = e.status ?? e.response?.status ?? e.response?.data?.error?.status;
  return typeof status === 'number' ? status : null;
}

/** 409: another admin confirmed it; close and refresh (r4 e8). Anything else: nothing saved, stay (r4 e9). */
export function confirmFailure(err: unknown): Failure {
  if (errorStatus(err) === 409) return { text: requestErrorText(err, CONFIRM_ERRORS.taken), close: true };
  return { text: requestErrorText(err, CONFIRM_ERRORS.failed), close: false };
}
