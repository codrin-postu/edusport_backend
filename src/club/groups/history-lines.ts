import { isRecord } from '../narrow';
import { SUBJECT } from '../subjects';
import { BREAK_LINES, FIELD_LABELS, GROUP_LINES, PROGRAM_LINES, SEASON_LINES, fieldLine, seriesCountText } from './copy';
import { dayMonth, isIsoDate, shortDate, weekdayName } from './dates';
import { programLine, programLineFrom, type SeriesText } from './program-text';

/** Phase 4 Istoric lines (spec 3.7, 10.8). Pure; group lines get athlete names at read time (decided 2). */
export const GROUP_SUBJECT = 'group';
export const BREAK_SUBJECT = 'calendar-blackout';
export const SEASON_SUBJECT = 'season';
export const ATHLETE_SUBJECT = SUBJECT.athlete;

export const P4_ACTIONS = {
  groupCreated: 'group-created', groupUpdated: 'group-updated', groupDeleted: 'group-deleted',
  memberAdded: 'member-added', memberAllocated: 'member-allocated', memberMovedOut: 'member-moved-out', memberMovedIn: 'member-moved-in', memberRemoved: 'member-removed',
  athleteMoved: 'athlete-group-moved', athleteRemoved: 'athlete-group-removed', athleteCopied: 'athlete-copied',
  programAdded: 'program-added', programChanged: 'program-changed', programEnded: 'program-ended', classAdded: 'class-added', classDeleted: 'class-deleted',
  dateCancelled: 'date-cancelled', dateMoved: 'date-moved', dateKept: 'date-kept',
  breakAdded: 'break-added', breakUpdated: 'break-updated', breakDeleted: 'break-deleted',
  currentChanged: 'current-changed', seasonCopied: 'season-copied', membersCopied: 'members-copied', programCopied: 'program-copied',
  undone: 'undone',
} as const;

type Changes = Record<string, unknown>;
type Names = Readonly<Record<string, string>>;
type Render = (c: Changes, names: Names) => string[];

const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const yesNo = (v: unknown): string => (v === true ? GROUP_LINES.yes : GROUP_LINES.no);
const nameOf = (c: Changes, names: Names): string => names[text(c.athleteId)] ?? GROUP_LINES.deletedAthlete;

function asSeries(v: unknown): SeriesText | null {
  if (!isRecord(v) || !Array.isArray(v.days) || typeof v.startTime !== 'string' || typeof v.from !== 'string') return null;
  return { freq: v.freq === 'biweekly' || v.freq === 'monthly' ? v.freq : 'weekly', days: v.days, startTime: v.startTime, durationMin: num(v.durationMin), from: v.from };
}

const withSeries = (v: unknown, line: (s: SeriesText) => string): string[] => {
  const s = asSeries(v);
  return s ? [line(s)] : [];
};

const told = (c: Changes): string => (num(c.emails) > 0 ? PROGRAM_LINES.parentsTold : '');

type FieldKey = keyof typeof FIELD_LABELS;
const DATE_FIELDS: ReadonlySet<string> = new Set(['startDate', 'endDate']);
const fieldValue = (key: string, v: unknown): string => (key === 'programPublic' || key === 'isCurrent' ? yesNo(v) : DATE_FIELDS.has(key) && text(v) ? shortDate(text(v)) : text(v));

function fieldLines(c: Changes): string[] {
  const fields = isRecord(c.fields) ? c.fields : {};
  return Object.entries(fields).flatMap(([key, change]) => {
    if (!(key in FIELD_LABELS) || !isRecord(change)) return [];
    return [fieldLine(FIELD_LABELS[key as FieldKey], fieldValue(key, change.from), fieldValue(key, change.to))];
  });
}

/** The date a dated change takes effect on: `effectiveFrom`, or `from` when it is a date (it is a group name on the lines that use it for that). */
export function effectiveDate(c: Changes): string | null {
  if (typeof c.effectiveFrom === 'string' && isIsoDate(c.effectiveFrom)) return c.effectiveFrom;
  return typeof c.from === 'string' && isIsoDate(c.from) ? c.from : null;
}

/** "... din 12 noiembrie" before the final period when the change is dated. */
export function sinceDate(line: string, c: Changes): string {
  const d = effectiveDate(c);
  if (!d) return line;
  const tail = ` din ${dayMonth(d)}`;
  return line.endsWith('.') ? `${line.slice(0, -1)}${tail}.` : `${line}${tail}`;
}

function movedOut(c: Changes, names: Names): string[] {
  const main = isRecord(c.main) ? ` ${GROUP_LINES.mainChanged(text(c.main.from), text(c.main.to))}` : '';
  return [sinceDate(GROUP_LINES.movedTo(text(c.toGroup), nameOf(c, names)), c) + main];
}

function athleteCopied(c: Changes): string[] {
  const groups = Array.isArray(c.groups) ? c.groups.filter(isRecord) : [];
  const list = groups.map((g) => `${text(g.name)}${g.main === true ? SEASON_LINES.mainMark : ''}`).join(', ');
  return list ? [SEASON_LINES.athleteCopied(text(c.season), list)] : [];
}

function seasonCopied(c: Changes): string[] {
  const parts = [num(c.athletes) > 0 ? SEASON_LINES.membersPart(num(c.athletes), num(c.groups)) : '', num(c.series) > 0 ? seriesCountText(num(c.series)) : ''].filter(Boolean);
  return parts.length ? [SEASON_LINES.copied(text(c.from), parts)] : [];
}

const date = (c: Changes, key = 'date'): string => dayMonth(text(c[key]));

const ROSTER: Readonly<Record<string, Render>> = {
  [P4_ACTIONS.groupCreated]: () => [GROUP_LINES.created],
  [P4_ACTIONS.groupUpdated]: fieldLines,
  [P4_ACTIONS.groupDeleted]: (c) => [GROUP_LINES.deleted(text(c.name))],
  [P4_ACTIONS.memberAdded]: (c, n) => [GROUP_LINES.memberAdded(nameOf(c, n))],
  [P4_ACTIONS.memberAllocated]: (c, n) => [GROUP_LINES.memberAllocated(nameOf(c, n))],
  [P4_ACTIONS.memberRemoved]: (c, n) => [sinceDate(GROUP_LINES.memberRemoved(nameOf(c, n)), c)],
  [P4_ACTIONS.memberMovedOut]: movedOut,
  [P4_ACTIONS.memberMovedIn]: (c, n) => [sinceDate(GROUP_LINES.movedFrom(text(c.fromGroup), nameOf(c, n)), c)],
  [P4_ACTIONS.athleteMoved]: (c) => [sinceDate(GROUP_LINES.athleteMoved(text(c.from), text(c.to)), c)],
  [P4_ACTIONS.athleteRemoved]: (c) => [sinceDate(GROUP_LINES.athleteRemoved(text(c.groupName)), c)],
  [P4_ACTIONS.athleteCopied]: athleteCopied,
};

const PROGRAM: Readonly<Record<string, Render>> = {
  [P4_ACTIONS.programAdded]: (c) => withSeries(c.series, (s) => PROGRAM_LINES.added(programLineFrom(s))),
  [P4_ACTIONS.programChanged]: (c) => {
    const before = asSeries(c.before);
    const after = asSeries(c.after);
    return before && after ? [PROGRAM_LINES.changed(shortDate(text(c.from)), programLine(before), programLine(after))] : [];
  },
  [P4_ACTIONS.programEnded]: (c) => withSeries(c.series, (s) => PROGRAM_LINES.ended(shortDate(text(c.from)), programLine(s))),
  [P4_ACTIONS.classAdded]: (c) => [PROGRAM_LINES.classAdded(weekdayName(text(c.date)), date(c), text(c.startTime), num(c.durationMin))],
  [P4_ACTIONS.classDeleted]: (c) => [PROGRAM_LINES.classDeleted(weekdayName(text(c.date)), date(c), text(c.startTime))],
  [P4_ACTIONS.dateCancelled]: (c) => [PROGRAM_LINES.cancelled(date(c), text(c.reason) || null) + told(c)],
  [P4_ACTIONS.dateMoved]: (c) => [PROGRAM_LINES.moved(date(c), date(c, 'newDate'), text(c.newStartTime)) + told(c)],
  [P4_ACTIONS.dateKept]: (c) => [PROGRAM_LINES.kept(date(c))],
};

const OTHER: Readonly<Record<string, Render>> = {
  [P4_ACTIONS.breakAdded]: (c) => [BREAK_LINES.added(text(c.label), shortDate(text(c.startDate)), shortDate(text(c.endDate)))],
  [P4_ACTIONS.breakUpdated]: fieldLines,
  [P4_ACTIONS.breakDeleted]: (c) => [BREAK_LINES.deleted(text(c.label))],
  [P4_ACTIONS.currentChanged]: (c) => [fieldLine(FIELD_LABELS.isCurrent, yesNo(c.from), yesNo(c.to))],
  [P4_ACTIONS.seasonCopied]: seasonCopied,
  [P4_ACTIONS.membersCopied]: (c) => [SEASON_LINES.membersCopied(text(c.from), num(c.count))],
  [P4_ACTIONS.programCopied]: (c) => withSeries(c.series, (s) => PROGRAM_LINES.copied(text(c.from), programLineFrom(s))),
};

const RENDER: Readonly<Record<string, Render>> = { ...ROSTER, ...PROGRAM, ...OTHER };

/** The lines of a phase 4 action; null when the action is not one (the P3 renderer owns it). */
export function phase4Lines(action: string, changes: unknown, names: Names): string[] | null {
  const render = RENDER[action];
  return render ? render(isRecord(changes) ? changes : {}, names) : null;
}

/** Group Istoric: every line there is phase 4; an undone line is the inner line prefixed with "Anulat: ". */
export function groupHistoryTexts(action: string, changes: unknown, names: Names): string[] {
  const c = isRecord(changes) ? changes : {};
  if (action === P4_ACTIONS.undone) return groupHistoryTexts(text(c.undoneAction), c.undoneChanges, names).map(GROUP_LINES.undone);
  return phase4Lines(action, c, names) ?? [];
}

/** Athlete ids named by a group line (an undone line: by its inner line), for the name lookup. */
export function athleteIdsOf(changes: unknown): string[] {
  if (!isRecord(changes)) return [];
  if (isRecord(changes.undoneChanges)) return athleteIdsOf(changes.undoneChanges);
  return typeof changes.athleteId === 'string' ? [changes.athleteId] : [];
}
