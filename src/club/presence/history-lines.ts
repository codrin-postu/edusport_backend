import { GROUP_LINES } from '../groups/copy';
import { isIsoDate, shortDate } from '../groups/dates';
import { programLine, programLineFrom, type SeriesText } from '../groups/program-text';
import { isRecord } from '../narrow';
import { SUBJECT } from '../subjects';
import { quotedChange } from '../text-leaf';
import { LESSON_FIELD_LABELS, PAYMENT_FIELD_LABELS, PRESENCE_LINES } from './copy/history';
import { METHOD_WORDS } from './copy/core';
import { longDate } from './dates';
import { ron } from './money';

/** Istoric lines of phase 5 (spec 8). Pure; names of athletes and coaches come in by id (unknown athlete: "Sportiv șters", unknown coach: "Antrenor șters"). */
export const P5_ACTIONS = {
  sessionSaved: 'session-saved',
  sessionCorrected: 'session-corrected',
  sessionCoaches: 'session-coaches',
  visitorPresent: 'visitor-present',
  subscriptionAdded: 'subscription-added',
  subscriptionExtended: 'subscription-extended',
  subscriptionCarried: 'subscription-carried',
  subscriptionCancelled: 'subscription-cancelled',
  paymentRecorded: 'payment-recorded',
  paymentEdited: 'payment-edited',
  paymentCancelled: 'payment-cancelled',
  paymentEmailSent: 'payment-email-sent',
  lessonPlanned: 'lesson-planned',
  lessonSaved: 'lesson-saved',
  lessonEdited: 'lesson-edited',
  lessonDeleted: 'lesson-deleted',
  lessonSeriesAdded: 'lesson-series-added',
  lessonSeriesEnded: 'lesson-series-ended',
} as const;

type Changes = Record<string, unknown>;
type Names = Readonly<Record<string, string>>;
type Render = (c: Changes, subjectType: string, names: Names) => string[];

const has = (o: object, key: string): boolean => Object.prototype.hasOwnProperty.call(o, key);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const dateText = (v: unknown): string => (typeof v === 'string' && isIsoDate(v) ? longDate(v) : '');
const yesNo = (v: unknown): string => (v === true ? 'Da' : v === false ? 'Nu' : '');
const namesOf = (ids: unknown, names: Names): string[] => strs(ids).map((id) => (has(names, id) ? names[id] : GROUP_LINES.deletedAthlete));
const nameList = (ids: unknown, names: Names): string => namesOf(ids, names).join(', ');
const coachList = (ids: unknown, names: Names): string => strs(ids).map((id) => (has(names, id) ? names[id] : PRESENCE_LINES.deletedCoach)).join(', ');

const FREQS = ['weekly', 'biweekly', 'monthly'] as const;
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
/** The rule a series line carries: freq, days, startTime, durationMin, from and (when kept) to; a malformed one reads as empty. */
function ruleOf(c: Changes): SeriesText {
  return {
    freq: FREQS.find((f) => f === c.freq) ?? 'weekly', days: strs(c.days).flatMap((d) => DAYS.find((x) => x === d) ?? []), startTime: text(c.startTime), durationMin: num(c.durationMin),
    from: text(c.from), ...(typeof c.to === 'string' && c.to ? { to: c.to } : {}),
  };
}

function sessionCorrected(c: Changes, _s: string, names: Names): string[] {
  return [PRESENCE_LINES.sessionCorrected({ added: namesOf(c.added, names), removed: namesOf(c.removed, names), uscat: namesOf(c.uscat, names) })];
}

function subscriptionExtended(c: Changes, subjectType: string): string[] {
  const weeks = num(c.weeks);
  if (subjectType === SUBJECT.subscription) return [PRESENCE_LINES.subscriptionExtendedSubscription(weeks, dateText(c.from), dateText(c.to))];
  return [PRESENCE_LINES.subscriptionExtendedAthlete(weeks, dateText(c.to))];
}

function paymentRecorded(c: Changes, subjectType: string): string[] {
  if (subjectType === SUBJECT.payment) return [PRESENCE_LINES.paymentRecordedShort];
  const method = typeof c.method === 'string' && has(METHOD_WORDS, c.method) ? METHOD_WORDS[c.method as keyof typeof METHOD_WORDS] : '';
  return [PRESENCE_LINES.paymentRecorded(ron(num(c.amount)), method, text(c.purposeText), text(c.receiptNo) || null)];
}

function paymentCancelled(c: Changes, subjectType: string): string[] {
  if (subjectType === SUBJECT.payment) return [PRESENCE_LINES.paymentCancelledShort];
  return [PRESENCE_LINES.paymentCancelled(ron(num(c.amount)), dateText(c.paidOn))];
}

/** One line per changed field; a field outside the labels is left out. */
function fieldLines(c: Changes, labels: Readonly<Record<string, string>>, format: (key: string, v: unknown) => string): string[] {
  const fields = isRecord(c.fields) ? c.fields : {};
  return Object.entries(fields).flatMap(([key, change]) => {
    if (!has(labels, key) || !isRecord(change)) return [];
    return [quotedChange(labels[key], format(key, change.from), format(key, change.to))];
  });
}

function paymentValue(key: string, v: unknown): string {
  if (key === 'amount') return typeof v === 'number' ? ron(v) : '';
  if (key === 'paidOn') return dateText(v);
  if (key === 'method') return typeof v === 'string' && has(METHOD_WORDS, v) ? METHOD_WORDS[v as keyof typeof METHOD_WORDS] : text(v);
  if (key === 'collectedAtRink') return yesNo(v);
  return text(v);
}

const lessonValue = (names: Names) => (key: string, v: unknown): string => {
  if (key === 'date') return dateText(v);
  if (key === 'durationMin') return typeof v === 'number' ? `${v} min` : '';
  if (key === 'coaches') return coachList(v, names);
  return text(v);
};

const RENDER: Readonly<Record<string, Render>> = {
  [P5_ACTIONS.sessionSaved]: (c, _s, names) => [PRESENCE_LINES.sessionSaved(num(c.present), num(c.listed), coachList(c.coachIds, names))],
  [P5_ACTIONS.sessionCorrected]: sessionCorrected,
  [P5_ACTIONS.sessionCoaches]: (c, _s, names) => [PRESENCE_LINES.sessionCoaches(coachList(c.from, names), coachList(c.to, names))],
  [P5_ACTIONS.visitorPresent]: (c) => [PRESENCE_LINES.visitorPresent(text(c.groupName), dateText(c.date))],
  [P5_ACTIONS.subscriptionAdded]: (c) => PRESENCE_LINES.subscriptionAdded(text(c.itemName), dateText(c.startsOn), dateText(c.validUntil), num(c.covered), text(c.code) || null),
  [P5_ACTIONS.subscriptionExtended]: subscriptionExtended,
  [P5_ACTIONS.subscriptionCarried]: (c) => [PRESENCE_LINES.subscriptionCarried(text(c.listName))],
  [P5_ACTIONS.subscriptionCancelled]: () => [PRESENCE_LINES.subscriptionCancelled],
  [P5_ACTIONS.paymentRecorded]: paymentRecorded,
  [P5_ACTIONS.paymentEdited]: (c) => fieldLines(c, PAYMENT_FIELD_LABELS, paymentValue),
  [P5_ACTIONS.paymentCancelled]: paymentCancelled,
  [P5_ACTIONS.paymentEmailSent]: (c) => [PRESENCE_LINES.paymentEmailSent(typeof c.recipient === 'string' ? c.recipient : null)],
  [P5_ACTIONS.lessonPlanned]: (c) => [PRESENCE_LINES.lessonPlanned(dateText(c.date), text(c.startTime), num(c.durationMin))],
  [P5_ACTIONS.lessonSaved]: (c) => [PRESENCE_LINES.lessonSaved(c.present === true)],
  [P5_ACTIONS.lessonEdited]: (c, _s, names) => fieldLines(c, LESSON_FIELD_LABELS, lessonValue(names)),
  [P5_ACTIONS.lessonDeleted]: () => [PRESENCE_LINES.lessonDeleted],
  [P5_ACTIONS.lessonSeriesAdded]: (c) => [PRESENCE_LINES.lessonSeriesAdded(programLineFrom(ruleOf(c)), num(c.count))],
  [P5_ACTIONS.lessonSeriesEnded]: (c) => [PRESENCE_LINES.lessonSeriesEnded(shortDate(text(c.endedFrom)), programLine(ruleOf(c)))],
};

/** The lines of a phase 5 action; null when the action is not one. */
export function phase5Lines(action: string, changes: unknown, subjectType: string, names: Names): string[] | null {
  if (!has(RENDER, action)) return null;
  return RENDER[action](isRecord(changes) ? changes : {}, subjectType, names);
}

/** The panel's Istoric of a session: names of athletes and coaches by id. */
export function sessionHistoryTexts(action: string, changes: unknown, names: Names): string[] {
  return phase5Lines(action, changes, SUBJECT.session, names) ?? [];
}
