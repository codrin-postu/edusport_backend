# Phase 4-2: Group Schedules, Breaks, Parent E-mails and Public Reads (backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each group the owner of its program: weekly series and single classes from the group page ("Adaugă program", "Schimbă", "Șterge programul", "Șterge ședința"), per-date "Ține / Anulează / Mută" with a reason and an opt-in parent e-mail held 15 seconds so the toast can cancel it, "Pauze" that cancel group dates only, the admin occurrences route with every group, the public occurrences without non-public groups, the public `/api/club/schedule` notebook data, and the old calendar routes refusing group events.

**Architecture:** The occurrence expansion (`src/api/calendar-event/services/expand.ts`) is rewritten into small functions and learns groups (`groupId`, `groupName`, the original date and time of a moved date), break scope and notes. Every schedule rule is a pure module in `src/club/groups/` (`program-plan.ts`: form reading, series and class events, the "Schimbă" split, "Șterge programul", date modes; `schedule-mail.ts`: recipients, next class, payload, jobs; `public-schedule.ts`: notebook slots); the services (`program.ts`, `program-dates.ts`, `breaks.ts`, `occurrences.ts`) run them on the plan 4-1 `GroupStore` inside one transaction, lock the calendar-event row before reading its exceptions, record Istoric lines with the plan 4-1 action log, and return the undo id. The parent e-mail rides the existing Brevo queue: `email-jobs.ts` learns the `schedule-change` kind and `notBefore`, `schedule-change-template.ts` renders the approved texts in the E1 letter, and `attemptScheduleChangeJobs` makes the first attempt after the hold.

**Tech Stack:** Strapi 5.52.1 (TypeScript, `strict: false` server), Postgres 16, Vitest 3, Node 22.

**Spec:** `docs/superpowers/specs/2026-10-27-groups-schedules-design.md` (v1.1), sections 3.3 to 3.6 (behaviour; the schema is plan 4-1 Task 1), 6.3, 6.5, 7.1 (server), 7.2 (refusal of group events, the admin occurrences source), 8.1, 8.2 (schedule, breaks, occurrences routes), 8.3, 9.3 (`pingRevalidate`), 11, 12. Decisions: `../edusport_frontend/docs/portal/DECISIONS.md`. Agent rules: `.superpowers/phase3-shared/agent-rules.md`. Index: `docs/superpowers/plans/2026-10-27-phase4-index.md`.

**Base:** `feat/athletes` with plan 4-1 merged (it defines `GroupStore`, the copy module, `P4_ACTIONS` with every program, date and break line, the undo steps `setEvent`, `createEvent`, `deleteEvent`, `cancelEmails`, `recordAction`, `respondAction`, the fake store and the fixture). Read plan 4-1's "Interfaces for other plans" first.

**Parallel groups:** A: T1, T2 | B: T3, T6 | C: T4 | D: T5 | E: T7 | F: T8

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Occurrence expansion, 2 Program planners and schedule copy | plan 4-1 | 1: expand.ts; 2: program-plan.ts, copy/schedule.ts, copy.ts |
| B | 3 Parent e-mail (template, queue, context), 6 Breaks | 2 (3 also needs 1) | 3: src/email/*, copy/email.ts, schedule-mail.ts, context.ts, fake store; 6: breaks.ts |
| C | 4 Program services | 3 | program.ts, copy.ts (one export line) |
| D | 5 Date modes and e-mails | 4 | program-dates.ts |
| E | 7 Reads, routes and the old calendar routes | 4 to 6 | occurrences.ts, program-read.ts, public-schedule.ts, routes/07-schedule.ts, controllers/schedule.ts, calendar-event controller |
| F | 8 Boot check | everything | no repo files |

## Decided while planning (low impact, decided by Claude; the user may overrule any line)

Log them in DECISIONS.md as "plan 4-2, decided by Claude (low impact, 2026-10-27)".

1. **Toasts the spec does not give:** "Șterge ședința" answers "Ședință ștearsă." (`copy/schedule.ts`).
2. **The parent e-mail layout** reuses the registration letter E1 (white letter, navy left bar, the CLUBUL SPORTIV / EDUSPORT header image) and its footer (contact lines and the privacy sentence); the body is exactly the approved paragraphs; no buttons, no "Sezonul / Nr. înscriere" corner (`src/email/schedule-change-template.ts`).
3. **The changed date's time** in the e-mail payload is the time the date had before the change: a date already moved keeps its moved time, otherwise the series start (`schedule-mail.ts::changedStartTime`).
4. **Notebook with 2+ schools:** `/api/club/schedule` returns one entry per school section with a public page; the website (plan 4-7) shows the first one with slots. With one school (production) nothing changes (`public-schedule.ts`).
5. **Which series feed the notebook and "Program obișnuit":** the series of the current season still running today or later (`currentSeries` of plan 4-1), so a series ended by "Schimbă" yesterday drops out at once and a change from next week shows both rows until then.
6. **A date inside a break** cannot be changed (the panel is read-only, W13); the server refuses it with 400 "Cerere invalidă." when a stale page tries (`program-dates.ts`).
7. **"Ține" on a date with nothing to undo** writes nothing and answers no undo (`program-dates.ts`).
8. **A class moved or started past midnight** (start + duration after 23:59) is refused with 400 "Cerere invalidă." (no overnight group classes, spec 3.3) (`program-plan.ts`).
9. **The public occurrences** carry `groupName` but not `groupId` (spec 8.3 lists only the name); the admin route carries both (`occurrences.ts`).
10. **Creating an event with a `group` through `/api/calendar/events`** is refused like editing one (409, the same text), so group events are only ever written by the group page (`calendar-event` controller).
11. **The group program read** is a route of its own, `GET /club/groups/:documentId/program?season=` (technical, not in spec 8.2): "Program obișnuit" rows, each with the default "Se aplică din" of "Schimbă" (the series' next class date) (`program-read.ts`).
12. **Anonymization** (3C) does not touch `schedule-change` e-mail jobs: they hold a parent address and the group's dates, no child data; a later cleanup may purge sent jobs.

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes`. Commit only in the worktree your dispatch names (never in p3be or p3fe); before every commit run `git rev-parse --show-toplevel` and `git branch --show-current` and compare with the dispatch.
- A dated entry in `edusport_frontend/docs/portal/DECISIONS.md` wins over the spec; the spec wins over this plan's prose; this plan's code is followed verbatim unless it fails (fix the minimum, say what and why).
- Checks after every task: the task's test file, the full suite (`npx vitest run`), `npx tsc --noEmit` (zero errors).
- Code: TypeScript, no `any`, single quotes in `src/`, functions under 30 lines, cyclomatic complexity under 10, data passed to a Strapi json attribute is a `type` alias, no dead code, no comments that restate code.
- Admin routes: `{ auth: false, policies: ['global::is-admin'], middlewares: [] }`; the public `/club/schedule`: `{ auth: false, policies: [], middlewares: [] }`; fixed paths before parameter paths in each routes file.
- Lock order (binding): registrations, then athletes, then groups, then calendar events (each sorted by id). Schedule writes lock the calendar-event row before reading its exceptions and take no athlete lock; adding a series or class locks the group row.
- Every write is one transaction; failures answer 500 "Acțiunea nu a reușit. Nimic nu a fost salvat." through `guarded`. Every write records its Istoric lines. Each write that changes the public calendar or notebook calls `ctx.revalidate()` after commit (`pingRevalidate`, fire and forget).
- No schema change in this plan (plan 4-1 Task 1 made them all).
- Copy: every new string in `src/club/groups/copy/schedule.ts` (re-exported by `copy.ts`); the approved e-mail texts verbatim (spec 6.5); ș and ț with the comma below; straight quotes; no em dash; no middle dot; no emoji.
- Tests and checks use synthetic data only. Never production, never `strapi_app` / `strapi_db`, ports 1337 or 5432, never the TEST environment (1340 / 3010, `edusport-test-pg`). Task 8 uses container `es42-pg` on 127.0.0.1:55442 and Strapi on 1362 only. No real e-mail is sent: no Brevo key is set in the boot check.
- Commits: Conventional Commits, exactly the message in the task, no `Co-Authored-By`, no AI attribution (check with `git log -1 --format=%B`). Never push. Never commit `.env`.
- Progress board: `printf '%s | 4-2 T<n> | implementer | <status>\n' "$(date -u +%H:%M)" >> /Users/codrin/Documents/Programming/edusport_backend/.superpowers/phase3-shared/progress-board.md`.

## Review Focus

- **The toast's "Anulează" after the parent e-mail box was ticked**: every job of that change still queued becomes `cancelled`, none is sent, the date is back as it was; a job attempted before its `notBefore` (the cron, or a restart) stays queued. Pinned by Task 3 (`notBefore` skips the attempt), Task 5 (undo cancels the jobs) and Task 8 (SQL on `email_jobs`).
- **"Schimbă" from a day that already had a cancelled or moved date**: the changed dates on or after "Se aplică din" move to the new series only when they are still class dates there; dates before it stay with the old series; the old series ends the day before, or is deleted when it never held a class. Pinned by Task 2 (`planChange`, `planEnd`) and Task 8 (occurrences before and after).
- **Breaks**: a break cancels the group dates inside it (single classes too) and old unlinked Școala dates, never a competition or a holiday; a Mută on a break date still holds; the occurrence carries the break's name. Pinned by Task 1 and Task 8.
- **A group set to "Program public" off, or made inactive**: its dates vanish from `/api/calendar/occurrences` and `/api/club/schedule` (and the website after revalidate) but stay on the admin route; `/api/calendar-events` stays closed. Pinned by Task 1 (`publicEvents`), Task 7 and Task 8.
- **Recipients**: siblings with one address get one e-mail, addresses are trimmed and lower-cased, Inactiv and anonymized athletes and athletes whose membership ended are left out, and the members are those of the season that contains the date. Pinned by Task 3 (`recipients`).

---

## File Structure

```
src/api/calendar-event/services/expand.ts           rewritten: groups, break scope and notes, moved-date originals, publicEvents (T1)
src/api/calendar-event/services/__tests__/expand.test.ts    (T1)
src/api/calendar-event/controllers/calendar-event.ts public occurrences via occurrences.ts; group events refused (T7)
src/club/groups/
  copy/schedule.ts      SCHEDULE_ERRORS, SCHEDULE_TOASTS, DURATION, durationLabel (T2)
  copy/email.ts         EMAIL_COPY (T3)
  copy.ts               + export * from './copy/schedule' (T2), + export * from './copy/email' (T4)
  program-plan.ts       SeriesInput, ClassInput, ProgramInput, DateMode, EventChange, readProgramInput, readSeriesInput, readDateMode, wantsEmail, seasonOf, eventType, seriesWrite, classWrite, asCalendarRow, classDates, isClassDate, planEnd, planChange, planDateMode, inputText (T2)
  schedule-mail.ts      SCHEDULE_HOLD_MS, recipients, nextClass, changedStartTime, schedulePayload, scheduleJobs (T3)
  context.ts            GroupContext.emails, GroupContext.now (T3)
  program.ts            addProgram, changeProgram, endProgram, deleteClass (T4)
  program-dates.ts      setDate (T5)
  breaks.ts             readBreakInput, listBreaks, createBreak, updateBreak, deleteBreak (T6)
  occurrences.ts        readRange, eventRows, loadOccurrences, publicOccurrence (T7)
  program-read.ts       ProgramRow, GroupProgram, readGroupProgram (T7)
  public-schedule.ts    ScheduleSlot, PublicSchedule, scheduleSlots, readPublicSchedule (T7)
src/email/
  schedule-change-template.ts   scheduleSubject, scheduleParagraphs, renderScheduleEmail (T3)
  registration-template.ts      emailPage shared shell (T3, output unchanged)
  job-state.ts                  isDue honours notBefore (T3)
  email-jobs.ts                 EmailJobRow kind/payload/notBefore; attemptJob for schedule-change (T3)
  strapi-email.ts               toJobRow reads them; attemptScheduleChangeJobs (T3)
src/api/club/routes/07-schedule.ts, src/api/club/controllers/schedule.ts   (T7)
```

---

### Task 1: Occurrence expansion with groups, break scope and notes

**Files:**
- Modify: `src/api/calendar-event/services/expand.ts` (whole file)
- Test: `src/api/calendar-event/services/__tests__/expand.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `CalendarEventRow` gains `group?: EventGroup | null` with `EventGroup = { documentId: string; name: string; programPublic?: boolean | null; active?: boolean | null }`; `ExceptionRow` gains `reason?: string | null`.
  - `Occurrence` gains `groupId: string | null`, `groupName: string | null`, `originalDate: string | null`, `originalStartTime: string | null` (set on a moved date: the series date and time it came from).
  - Breaks (`BlackoutRow`) cancel only events linked to a group and unlinked `scoala` events (W13); the cancelled occurrence's `note` is the break's `label`; a moved date (`override`) still holds.
  - `note` of a cancelled or moved date is `reason ?? newTitle` (old rows keep their `newTitle` notes; a moved date has only `reason`).
  - `publicEvents(events): CalendarEventRow[]` drops events of a group whose `programPublic` is false or `active` is false (spec 8.3).
  - `expandOccurrences(events, blackouts, from, to)` keeps its signature and its ordering.

- [ ] **Step 1: Write the failing test**

`src/api/calendar-event/services/__tests__/expand.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { expandOccurrences, publicEvents, type BlackoutRow, type CalendarEventRow } from '../expand';

const weekend = { freq: 'weekly' as const, sat: true, sun: true, startTime: '11:00:00.000', endTime: '11:50:00.000', seasonStart: '2026-10-03', seasonEnd: '2027-05-30' };
const ev = (over: Partial<CalendarEventRow>): CalendarEventRow => ({ id: 1, documentId: 'e1', title: 'Intermediari Bronze', type: 'scoala', recurrence: weekend, exceptions: [], ...over });
const GROUP = { documentId: 'g-ib', name: 'Intermediari Bronze', programPublic: true, active: true };
const BREAK: BlackoutRow[] = [{ label: 'Vacanța de iarnă', startDate: '2026-12-26', endDate: '2026-12-27' }];
const on = (list: ReturnType<typeof expandOccurrences>, date: string) => list.filter((o) => o.date === date);

describe('series dates', () => {
  it('expands weekly, biweekly from the series start, and monthly nth weekday', () => {
    expect(expandOccurrences([ev({})], [], '2026-11-14', '2026-11-22').map((o) => o.date)).toEqual(['2026-11-14', '2026-11-15', '2026-11-21', '2026-11-22']);
    const bi = ev({ recurrence: { ...weekend, freq: 'biweekly', sun: false } });
    expect(expandOccurrences([bi], [], '2026-10-03', '2026-10-31').map((o) => o.date)).toEqual(['2026-10-03', '2026-10-17', '2026-10-31']);
    const monthly = ev({ recurrence: { ...weekend, freq: 'monthly', sun: false, weekOfMonth: 'last' } });
    expect(expandOccurrences([monthly], [], '2026-11-01', '2026-11-30').map((o) => o.date)).toEqual(['2026-11-28']);
  });

  it('a one-off class is one date', () => {
    const one = ev({ recurrence: { freq: 'none', singleDate: '2026-11-20', startTime: '18:00:00.000', endTime: '19:00:00.000' } });
    expect(expandOccurrences([one], [], '2026-11-01', '2026-11-30').map((o) => [o.date, o.startTime, o.endTime])).toEqual([['2026-11-20', '18:00', '19:00']]);
  });
});

describe('groups (3.3)', () => {
  it('carries the group id and name; unlinked events carry nulls', () => {
    const [linked] = expandOccurrences([ev({ group: GROUP })], [], '2026-11-14', '2026-11-14');
    expect([linked.groupId, linked.groupName]).toEqual(['g-ib', 'Intermediari Bronze']);
    const [plain] = expandOccurrences([ev({ type: 'concurs', title: 'Cupa' })], [], '2026-11-14', '2026-11-14');
    expect([plain.groupId, plain.groupName]).toEqual([null, null]);
  });

  it('a moved date shows on its new date with the date and time it came from', () => {
    const moved = ev({ group: GROUP, exceptions: [{ date: '2026-11-21', kind: 'override', newDate: '2026-11-22', newStartTime: '12:00:00.000', newEndTime: '12:50:00.000', reason: 'Patinoar' }] });
    const list = expandOccurrences([moved], [], '2026-11-21', '2026-11-22');
    expect(on(list, '2026-11-21')).toEqual([]);
    expect(on(list, '2026-11-22').map((o) => [o.status, o.startTime, o.originalDate, o.originalStartTime, o.note])).toEqual([
      ['scheduled', '11:00', null, null, null], ['override', '12:00', '2026-11-21', '11:00', 'Patinoar'],
    ]);
  });

  it('a cancelled date notes its reason, old notes still read (3.4, W12)', () => {
    const cancelled = ev({ exceptions: [{ date: '2026-11-14', kind: 'anulat', reason: 'Competiție la Brașov' }, { date: '2026-11-15', kind: 'liber', newTitle: 'Vechi' }] });
    const list = expandOccurrences([cancelled], [], '2026-11-14', '2026-11-15');
    expect(list.map((o) => [o.status, o.state, o.note])).toEqual([['cancelled', 'anulat', 'Competiție la Brașov'], ['cancelled', 'liber', 'Vechi']]);
  });
});

describe('breaks (3.5, W13)', () => {
  it('cancel group dates and old Școala dates with the break name, never a competition', () => {
    const club = ev({ id: 2, documentId: 'e2', type: 'curs', title: 'Avansați', group: { ...GROUP, documentId: 'g-av', name: 'Avansați' } });
    const oldScoala = ev({ id: 3, documentId: 'e3', title: 'Școala de patinaj' });
    const contest = ev({ id: 4, documentId: 'e4', type: 'concurs', title: 'Cupa', recurrence: { freq: 'none', singleDate: '2026-12-26' } });
    const list = expandOccurrences([club, oldScoala, contest], BREAK, '2026-12-26', '2026-12-26');
    expect(list.map((o) => [o.title, o.status, o.cancelReason, o.note])).toEqual([
      ['Cupa', 'scheduled', null, null], ['Avansați', 'cancelled', 'blackout', 'Vacanța de iarnă'], ['Școala de patinaj', 'cancelled', 'blackout', 'Vacanța de iarnă'],
    ]);
  });

  it('cancel a single class of a group too, but a moved date holds', () => {
    const one = ev({ group: GROUP, recurrence: { freq: 'none', singleDate: '2026-12-27', startTime: '18:00:00.000', endTime: '19:00:00.000' } });
    expect(expandOccurrences([one], BREAK, '2026-12-27', '2026-12-27')[0].status).toBe('cancelled');
    const moved = ev({ group: GROUP, exceptions: [{ date: '2026-12-26', kind: 'override', newDate: '2026-12-28', newStartTime: '10:00:00.000', newEndTime: '10:50:00.000' }] });
    expect(on(expandOccurrences([moved], BREAK, '2026-12-26', '2026-12-28'), '2026-12-28').map((o) => o.status)).toEqual(['override']);
  });
});

describe('public filter (8.3)', () => {
  it('drops events of a group that is not public or not active; null counts as public (W8)', () => {
    const events = [
      ev({ documentId: 'a', group: GROUP }), ev({ documentId: 'b', group: { ...GROUP, programPublic: false } }),
      ev({ documentId: 'c', group: { ...GROUP, active: false } }), ev({ documentId: 'd', group: { ...GROUP, programPublic: null } }), ev({ documentId: 'e' }),
    ];
    expect(publicEvents(events).map((e) => e.documentId)).toEqual(['a', 'd', 'e']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/api/calendar-event/services/__tests__/expand.test.ts`
Expected: FAIL (`publicEvents` is not exported; `groupId` undefined; breaks cancel the competition).

- [ ] **Step 3: Rewrite `expand.ts`**

```ts
/**
 * Pure recurrence expansion for the calendar.
 *
 * Turns compact calendar-event rules into concrete dated occurrences within a [from, to] window, then applies
 * per-date exceptions (cancel / liber / anulat / override) and breaks (calendar-blackout). No DB access: the callers
 * fetch the rows (src/club/groups/occurrences.ts). Breaks cancel group events and old unlinked Școala events only
 * (phase 4 spec 3.5, W13); a moved date (override) still holds.
 */
type Freq = 'none' | 'weekly' | 'biweekly' | 'monthly';
type WeekOfMonth = 'first' | 'second' | 'third' | 'fourth' | 'last';

interface Recurrence {
  freq: Freq;
  mon?: boolean; tue?: boolean; wed?: boolean; thu?: boolean;
  fri?: boolean; sat?: boolean; sun?: boolean;
  weekOfMonth?: WeekOfMonth | null;
  startTime?: string | null;
  endTime?: string | null;
  /** Explicit overnight flag: the end time lands on the day AFTER `date`. */
  endsNextDay?: boolean | null;
  singleDate?: string | null;
  endDate?: string | null;
  seasonStart?: string | null;
  seasonEnd?: string | null;
}

interface ExceptionRow {
  date: string;
  kind: 'cancel' | 'override' | 'liber' | 'anulat';
  newStartTime?: string | null;
  newEndTime?: string | null;
  newTitle?: string | null;
  newDate?: string | null;
  reason?: string | null;
}

export interface EventGroup { documentId: string; name: string; programPublic?: boolean | null; active?: boolean | null }

export interface CalendarEventRow {
  id: number;
  documentId?: string;
  title: string;
  type: string;
  label?: string | null;
  color?: string | null;
  order?: number | null;
  description?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  recurrence: Recurrence;
  exceptions?: ExceptionRow[];
  group?: EventGroup | null;
}

export interface BlackoutRow {
  label: string;
  startDate: string;
  endDate: string;
}

export interface Occurrence {
  eventId: number;
  documentId?: string;
  title: string;
  type: string;
  label: string | null;
  color: string | null;
  order: number;
  date: string;                 // YYYY-MM-DD, the day the occurrence STARTS
  startTime: string | null;     // HH:mm
  endTime: string | null;       // HH:mm
  /** True when `endTime` belongs to the day after `date` (crosses midnight). */
  endsNextDay: boolean;
  /** Resolved calendar day of `endTime`, or null without an end time; equals `date` unless `endsNextDay`. */
  endDate: string | null;
  status: 'scheduled' | 'cancelled' | 'override';
  cancelReason: 'exception' | 'blackout' | null;
  state?: 'curs' | 'liber' | 'anulat' | null; // Școala only
  note?: string | null; // reason of a cancelled or moved date, the break name
  description?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  groupId: string | null;
  groupName: string | null;
  /** A moved date: the series date and start time it came from. */
  originalDate: string | null;
  originalStartTime: string | null;
}

// --- date helpers (local, date-only, no timezone drift) ---
const MS_DAY = 86_400_000;

function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
/** Strapi time is "HH:mm:ss.SSS": normalise to "HH:mm". */
function hhmm(t?: string | null): string | null {
  return t ? t.slice(0, 5) : null;
}
/** Monday-based week index since an anchor date, for biweekly parity. */
function weekIndex(d: Date, anchor: Date): number {
  const startOfWeek = (x: Date) => addDays(x, -((x.getDay() + 6) % 7));
  return Math.floor((startOfWeek(d).getTime() - startOfWeek(anchor).getTime()) / (7 * MS_DAY));
}

// JS getDay(): 0=Sun..6=Sat.
function activeWeekdays(r: Recurrence): number[] {
  const map: Array<[keyof Recurrence, number]> = [['sun', 0], ['mon', 1], ['tue', 2], ['wed', 3], ['thu', 4], ['fri', 5], ['sat', 6]];
  return map.filter(([k]) => r[k]).map(([, n]) => n);
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, which: WeekOfMonth): Date | null {
  const firstMatch = 1 + ((7 + weekday - new Date(year, month, 1).getDay()) % 7);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  if (which === 'last') {
    let day = firstMatch;
    while (day + 7 <= daysInMonth) day += 7;
    return new Date(year, month, day);
  }
  const day = firstMatch + { first: 0, second: 1, third: 2, fourth: 3 }[which] * 7;
  return day > daysInMonth ? null : new Date(year, month, day);
}

type Range = { start: Date; end: Date };

function oneOffDates(r: Recurrence, range: Range): Date[] {
  if (!r.singleDate) return [];
  const out: Date[] = [];
  const last = r.endDate ? parseYMD(r.endDate) : parseYMD(r.singleDate);
  for (let d = parseYMD(r.singleDate); d <= last; d = addDays(d, 1)) if (d >= range.start && d <= range.end) out.push(new Date(d));
  return out;
}

/** The requested range clamped to the series window. */
function seriesWindow(r: Recurrence, range: Range): { lo: Date; hi: Date } {
  const start = r.seasonStart ? parseYMD(r.seasonStart) : range.start;
  const end = r.seasonEnd ? parseYMD(r.seasonEnd) : range.end;
  return { lo: range.start > start ? range.start : start, hi: range.end < end ? range.end : end };
}

function weeklyDates(r: Recurrence, lo: Date, hi: Date): Date[] {
  const wdays = activeWeekdays(r);
  const anchor = r.seasonStart ? parseYMD(r.seasonStart) : lo;
  const out: Date[] = [];
  for (let d = new Date(lo); d <= hi; d = addDays(d, 1)) {
    if (wdays.includes(d.getDay()) && (r.freq !== 'biweekly' || weekIndex(d, anchor) % 2 === 0)) out.push(new Date(d));
  }
  return out;
}

function monthlyDates(r: Recurrence, lo: Date, hi: Date): Date[] {
  const wdays = activeWeekdays(r);
  const out: Date[] = [];
  for (let c = new Date(lo.getFullYear(), lo.getMonth(), 1); c <= new Date(hi.getFullYear(), hi.getMonth(), 1); c = new Date(c.getFullYear(), c.getMonth() + 1, 1)) {
    for (const wd of wdays) {
      const d = nthWeekdayOfMonth(c.getFullYear(), c.getMonth(), wd, r.weekOfMonth ?? 'first');
      if (d && d >= lo && d <= hi) out.push(d);
    }
  }
  return out;
}

function datesOf(r: Recurrence, range: Range): Date[] {
  if (r.freq === 'none') return oneOffDates(r, range);
  const { lo, hi } = seriesWindow(r, range);
  return r.freq === 'monthly' ? monthlyDates(r, lo, hi) : weeklyDates(r, lo, hi);
}

type Slot = Pick<Occurrence, 'status' | 'cancelReason' | 'state' | 'note' | 'startTime' | 'endTime' | 'endsNextDay' | 'title' | 'originalDate' | 'originalStartTime'> & { date: string };

function baseSlot(ev: CalendarEventRow, key: string): Slot {
  const r = ev.recurrence;
  return {
    status: 'scheduled', cancelReason: null, state: ev.type === 'scoala' ? 'curs' : null, note: null, startTime: hhmm(r.startTime), endTime: hhmm(r.endTime),
    endsNextDay: !!r.endsNextDay, title: ev.title, date: key, originalDate: null, originalStartTime: null,
  };
}

/** A moved date: new day and times; the overnight flag re-derived from the new times (an end before the start means next day). */
function overridden(slot: Slot, ex: ExceptionRow): Slot {
  const startTime = ex.newStartTime ? hhmm(ex.newStartTime) : slot.startTime;
  const endTime = ex.newEndTime ? hhmm(ex.newEndTime) : slot.endTime;
  const retimed = Boolean(ex.newStartTime || ex.newEndTime) && !!startTime && !!endTime && startTime !== endTime;
  return {
    ...slot, status: 'override', date: ex.newDate ?? slot.date, startTime, endTime, endsNextDay: retimed ? (endTime as string) < (startTime as string) : slot.endsNextDay,
    title: ex.newTitle ?? slot.title, note: ex.reason ?? null, originalDate: slot.date, originalStartTime: slot.startTime,
  };
}

function applyException(slot: Slot, ex: ExceptionRow | undefined): Slot {
  if (!ex) return slot;
  if (ex.kind === 'override') return overridden(slot, ex);
  if (ex.kind === 'cancel') return { ...slot, status: 'cancelled', cancelReason: 'exception' };
  return { ...slot, status: 'cancelled', cancelReason: 'exception', state: ex.kind, note: ex.reason ?? ex.newTitle ?? null };
}

const breakApplies = (ev: CalendarEventRow): boolean => !!ev.group || ev.type === 'scoala';

function applyBreak(slot: Slot, label: string | null): Slot {
  return label !== null && slot.status !== 'override' ? { ...slot, status: 'cancelled', cancelReason: 'blackout', note: label } : slot;
}

function toOccurrence(ev: CalendarEventRow, s: Slot): Occurrence {
  const endsNextDay = s.endsNextDay && !!s.endTime;
  return {
    eventId: ev.id, documentId: ev.documentId, title: s.title, type: ev.type, label: ev.label ?? null, color: ev.color ?? null, order: ev.order ?? 0,
    date: s.date, startTime: s.startTime, endTime: s.endTime, endsNextDay, endDate: s.endTime ? (endsNextDay ? ymd(addDays(parseYMD(s.date), 1)) : s.date) : null,
    status: s.status, cancelReason: s.cancelReason, state: s.state, note: s.note, description: ev.description ?? null, imageUrl: ev.imageUrl ?? null,
    linkUrl: ev.linkUrl ?? null, linkLabel: ev.linkLabel ?? null, groupId: ev.group?.documentId ?? null, groupName: ev.group?.name ?? null,
    originalDate: s.originalDate, originalStartTime: s.originalStartTime,
  };
}

type Break = { label: string; start: Date; end: Date };
const breakAt = (breaks: Break[], d: Date): string | null => breaks.find((b) => d >= b.start && d <= b.end)?.label ?? null;

function eventOccurrences(ev: CalendarEventRow, breaks: Break[], range: Range): Occurrence[] {
  if (!ev.recurrence) return [];
  const byDate = new Map((ev.exceptions ?? []).map((x) => [x.date, x]));
  const applies = breakApplies(ev);
  return datesOf(ev.recurrence, range).map((d) => {
    const slot = applyException(baseSlot(ev, ymd(d)), byDate.get(ymd(d)));
    return toOccurrence(ev, applyBreak(slot, applies ? breakAt(breaks, d) : null));
  });
}

const byDateThenTime = (a: Occurrence, b: Occurrence): number =>
  a.date === b.date ? (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.order - b.order : a.date.localeCompare(b.date);

export function expandOccurrences(events: CalendarEventRow[], blackouts: BlackoutRow[], from: string, to: string): Occurrence[] {
  const range: Range = { start: parseYMD(from), end: parseYMD(to) };
  const breaks: Break[] = blackouts.map((b) => ({ label: b.label, start: parseYMD(b.startDate), end: parseYMD(b.endDate) }));
  return events.flatMap((ev) => eventOccurrences(ev, breaks, range)).sort(byDateThenTime);
}

/** Spec 8.3: a group's events are public while the group is active and "Program public" is on (null counts as on, W8). */
export const publicEvents = (events: CalendarEventRow[]): CalendarEventRow[] =>
  events.filter((e) => !e.group || (e.group.programPublic !== false && e.group.active !== false));
```

- [ ] **Step 4: Run the tests and checks**

Run: `npx vitest run src/api/calendar-event/services/__tests__/expand.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors (the controller still compiles: it passes rows without `group`).

- [ ] **Step 5: Commit**

```bash
git add src/api/calendar-event/services/expand.ts src/api/calendar-event/services/__tests__/expand.test.ts
git commit -m "feat(schedules): occurrences know their group, breaks cancel group dates with the break name"
```

---
### Task 2: Program planners and the schedule copy

**Files:**
- Create: `src/club/groups/program-plan.ts`, `src/club/groups/copy/schedule.ts`
- Modify: `src/club/groups/copy.ts` (one export line)
- Test: `src/club/groups/__tests__/program-plan.test.ts`

**Interfaces:**
- Consumes: plan 4-1 (`dates.ts`, `DAY_ORDER`, `RepeatFreq`, row types, `GROUP_ERRORS`), Task 1 (`expandOccurrences`, `CalendarEventRow`, `EventGroup`).
- Produces:
  - copy: `SCHEDULE_ERRORS` (`noDays`, `endBeforeStart`, `groupEvent(group)`), `SCHEDULE_TOASTS` (`programAdded`, `classAdded(date)`, `programChanged`, `programEnded`, `classDeleted`, `dateCancelled(date)`, `dateMoved(date)`, `dateKept(date)`, `breakSaved`, `breakDeleted`), `DURATION = { min: 15, max: 240, step: 5, initial: 50 }`, `durationLabel(min)`.
  - `SeriesInput = { freq, weekOfMonth, days, startTime, durationMin, from }`, `ClassInput = { date, startTime, durationMin, note }`, `ProgramInput = { repeat: true; series } | { repeat: false; one }`, `readProgramInput(body)`, `readSeriesInput(body)` (the "Schimbă" form: same fields, `from` = "Se aplică din").
  - `DateMode = { mode: 'keep' } | { mode: 'cancel'; reason } | { mode: 'move'; newDate; newStartTime; reason }`, `readDateMode(body)`, `wantsEmail(body)`.
  - `seasonOf(seasons, date)`, `eventType(kind)` (`scoala` for a school section, `curs` for Club, W9), `seriesWrite(group, type, input, seasonEnd)`, `classWrite(group, type, input)`, `inputText(input): SeriesText`.
  - `asCalendarRow(event, groupName?)`, `classDates(event, from, to): string[]`, `isClassDate(event, date)`.
  - `EventChange = { op: 'end'; recurrence; exceptions } | { op: 'delete' }`, `planEnd(event, from)`, `planChange(event, input, title): { old: EventChange; created: EventWrite }`, `planDateMode(event, date, mode): ExceptionRow[] | null` (null: the moved class would pass midnight).

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/program-plan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  classDates, classWrite, isClassDate, planChange, planDateMode, planEnd, readDateMode, readProgramInput, seasonOf, seriesWrite, type SeriesInput,
} from '../program-plan';
import { event, G_GROUPS, G_SEASONS } from './fake-group-store';

const IB = G_GROUPS[1];
const series: SeriesInput = { freq: 'weekly', weekOfMonth: null, days: ['sat', 'sun'], startTime: '11:00', durationMin: 50, from: '2026-11-07' };
const cancel = (date: string, reason: string | null = null) => ({ date, kind: 'anulat' as const, newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason });

describe('reading the "Program nou" form (6.3, W10)', () => {
  it('reads a series: days Monday first, start + duration, Se aplică din', () => {
    expect(readProgramInput({ freq: 'weekly', days: ['sun', 'sat'], startTime: '11:00', durationMin: 50, from: '2026-11-07' }))
      .toEqual({ ok: true, value: { repeat: true, series: { ...series, days: ['sat', 'sun'] } } });
    expect(readProgramInput({ freq: 'monthly', days: ['sat'], startTime: '11:00', durationMin: 50, from: '2026-11-07' })).toMatchObject({ value: { series: { weekOfMonth: 'first' } } });
  });

  it('refuses no days ("Alege cel puțin o zi."), a duration off the 5-minute steps, a class past midnight', () => {
    expect(readProgramInput({ freq: 'weekly', days: [], startTime: '11:00', durationMin: 50, from: '2026-11-07' })).toEqual({ ok: false, error: 'Alege cel puțin o zi.' });
    expect(readProgramInput({ freq: 'weekly', days: ['sat'], startTime: '11:00', durationMin: 52, from: '2026-11-07' }).ok).toBe(false);
    expect(readProgramInput({ freq: 'weekly', days: ['sat'], startTime: '23:30', durationMin: 50, from: '2026-11-07' }).ok).toBe(false);
  });

  it('reads one class with an optional note', () => {
    expect(readProgramInput({ repeat: false, date: '2026-11-20', startTime: '18:00', durationMin: 60, note: '  Pregătire  ' }))
      .toEqual({ ok: true, value: { repeat: false, one: { date: '2026-11-20', startTime: '18:00', durationMin: 60, note: 'Pregătire' } } });
  });

  it('reads the date panel', () => {
    expect(readDateMode({ mode: 'cancel', reason: ' Competiție la Brașov ' })).toEqual({ mode: 'cancel', reason: 'Competiție la Brașov' });
    expect(readDateMode({ mode: 'move', newDate: '2026-11-22', newStartTime: '12:00' })).toEqual({ mode: 'move', newDate: '2026-11-22', newStartTime: '12:00', reason: null });
    expect(readDateMode({ mode: 'move', newDate: 'x', newStartTime: '12:00' })).toBeNull();
  });
});

describe('writing events (3.3, W9, W10)', () => {
  it('a series runs from "Se aplică din" to the end of its season, titled with the group name', () => {
    expect(seriesWrite(IB, 'scoala', series, '2027-05-31')).toEqual({
      title: 'Intermediari Bronze', type: 'scoala', description: null, groupId: 'g-ib', exceptions: [],
      recurrence: { freq: 'weekly', days: ['sat', 'sun'], weekOfMonth: null, startTime: '11:00', endTime: '11:50', singleDate: null, seasonStart: '2026-11-07', seasonEnd: '2027-05-31' },
    });
  });

  it('one class keeps its note as the description', () => {
    expect(classWrite(IB, 'scoala', { date: '2026-11-20', startTime: '18:00', durationMin: 60, note: 'Pregătire' }).recurrence)
      .toMatchObject({ freq: 'none', singleDate: '2026-11-20', startTime: '18:00', endTime: '19:00' });
  });

  it('finds the season of a date', () => {
    expect(seasonOf(G_SEASONS, '2026-11-07')?.label).toBe('2026-2027');
    expect(seasonOf(G_SEASONS, '2026-07-01')).toBeNull();
  });
});

describe('class dates', () => {
  it('lists the series dates, exceptions ignored', () => {
    const e = event({ id: 'e1', exceptions: [cancel('2026-11-14')] });
    expect(classDates(e, '2026-11-14', '2026-11-22')).toEqual(['2026-11-14', '2026-11-15', '2026-11-21', '2026-11-22']);
    expect(isClassDate(e, '2026-11-16')).toBe(false);
  });
});

describe('"Schimbă" and "Șterge programul" (W10)', () => {
  const base = event({ id: 'e1', exceptions: [cancel('2026-11-14'), cancel('2026-11-29'), cancel('2026-12-05')] });

  it('ends the old series the day before and carries later changed dates that are still class dates', () => {
    const { old, created } = planChange(base, { ...series, days: ['sat'], startTime: '12:00', from: '2026-11-28' }, 'Intermediari Bronze');
    expect(old).toEqual({ op: 'end', recurrence: { ...base.recurrence, seasonEnd: '2026-11-27' }, exceptions: [cancel('2026-11-14')] });
    expect(created.recurrence).toMatchObject({ days: ['sat'], startTime: '12:00', endTime: '12:50', seasonStart: '2026-11-28', seasonEnd: '2027-05-31' });
    expect(created.exceptions).toEqual([cancel('2026-12-05')]);
  });

  it('deletes a series that never held a class before the day', () => {
    expect(planEnd(base, '2026-10-04')).toEqual({ op: 'delete' });
    expect(planEnd(event({ id: 'e2', recurrence: { ...base.recurrence, seasonStart: '2026-11-02' } }), '2026-11-07')).toEqual({ op: 'delete' });
  });
});

describe('date modes (W12)', () => {
  const e = event({ id: 'e1', exceptions: [cancel('2026-11-14', 'x')] });

  it('"Ține" removes the date\'s exception', () => {
    expect(planDateMode(e, '2026-11-14', { mode: 'keep' })).toEqual([]);
  });

  it('"Anulează" writes anulat with the reason', () => {
    expect(planDateMode(e, '2026-11-15', { mode: 'cancel', reason: 'Gheață' })).toEqual([cancel('2026-11-14', 'x'), cancel('2026-11-15', 'Gheață')]);
  });

  it('"Mută" keeps the series duration; the same day leaves newDate empty; past midnight is refused', () => {
    expect(planDateMode(e, '2026-11-21', { mode: 'move', newDate: '2026-11-21', newStartTime: '12:00', reason: null })?.[1])
      .toEqual({ date: '2026-11-21', kind: 'override', newDate: null, newStartTime: '12:00', newEndTime: '12:50', newTitle: null, reason: null });
    expect(planDateMode(e, '2026-11-21', { mode: 'move', newDate: '2026-11-22', newStartTime: '23:30', reason: null })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/program-plan.test.ts`
Expected: FAIL (`Cannot find module '../program-plan'`).

- [ ] **Step 3: Write `copy/schedule.ts` and its export**

`src/club/groups/copy/schedule.ts`:

```ts
import { dayMonth } from '../dates';

/** Group program copy (spec 6.3, 7.1, 7.2, 11). */
export const SCHEDULE_ERRORS = {
  noDays: 'Alege cel puțin o zi.',
  endBeforeStart: 'Data de sfârșit trebuie să fie după data de început.',
  groupEvent: (group: string) => `Evenimentul aparține grupei ${group}. Se schimbă din pagina grupei.`,
} as const;

export const SCHEDULE_TOASTS = {
  programAdded: 'Program adăugat.',
  classAdded: (date: string) => `Ședință adăugată: ${dayMonth(date)}.`,
  programChanged: 'Program schimbat.',
  programEnded: 'Program șters.',
  classDeleted: 'Ședință ștearsă.',
  dateCancelled: (date: string) => `Ședința din ${dayMonth(date)} a fost anulată.`,
  dateMoved: (date: string) => `Ședința din ${dayMonth(date)} a fost mutată.`,
  dateKept: (date: string) => `Ședința din ${dayMonth(date)} se ține.`,
  breakSaved: 'Pauză salvată.',
  breakDeleted: 'Pauză ștearsă.',
} as const;

/** "Durată": 15 to 240 minutes in steps of 5, 50 by default (W10). */
export const DURATION = { min: 15, max: 240, step: 5, initial: 50 } as const;
export const durationLabel = (minutes: number): string => `${minutes} min`;
```

`src/club/groups/copy.ts`, add the line:

```ts
export * from './copy/schedule';
```

- [ ] **Step 4: Write `program-plan.ts`**

```ts
import { expandOccurrences, type CalendarEventRow } from '../../api/calendar-event/services/expand';
import { DURATION, GROUP_ERRORS, SCHEDULE_ERRORS } from './copy';
import { addDays, addMinutes, isIsoDate, isTime, minutesBetween, minutesOf } from './dates';
import { DAY_ORDER, type SeriesText } from './program-text';
import type { RepeatFreq } from './series';
import type { DayKey, EventRecord, EventWrite, ExceptionRow, GroupRecord, Recurrence, SeasonRecord, WeekOfMonth } from './types';

/** The group program rules (spec 3.3, 3.4, 6.3, W10, W12). Pure. */
export type SeriesInput = { freq: RepeatFreq; weekOfMonth: WeekOfMonth | null; days: DayKey[]; startTime: string; durationMin: number; from: string };
export type ClassInput = { date: string; startTime: string; durationMin: number; note: string | null };
export type ProgramInput = { repeat: true; series: SeriesInput } | { repeat: false; one: ClassInput };
export type DateMode = { mode: 'keep' } | { mode: 'cancel'; reason: string | null } | { mode: 'move'; newDate: string; newStartTime: string; reason: string | null };
export type EventChange = { op: 'end'; recurrence: Recurrence; exceptions: ExceptionRow[] } | { op: 'delete' };
type Read<T> = { ok: true; value: T } | { ok: false; error: string };
type Body = Record<string, unknown>;

const FREQS: readonly RepeatFreq[] = ['weekly', 'biweekly', 'monthly'];
const WEEKS: readonly WeekOfMonth[] = ['first', 'second', 'third', 'fourth', 'last'];
const LAST_MINUTE = 23 * 60 + 59;
const invalid = { ok: false as const, error: GROUP_ERRORS.invalid };
const isRecord = (v: unknown): v is Body => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const validDuration = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= DURATION.min && n <= DURATION.max && n % DURATION.step === 0;
/** No overnight group classes (3.3, decided 8). */
const fitsDay = (start: string, minutes: number): boolean => minutesOf(start) + minutes <= LAST_MINUTE;

function readTimes(b: Body): Read<{ startTime: string; durationMin: number }> {
  if (!isTime(b.startTime) || !validDuration(b.durationMin) || !fitsDay(b.startTime, b.durationMin)) return invalid;
  return { ok: true, value: { startTime: b.startTime, durationMin: b.durationMin } };
}

export function readSeriesInput(body: unknown): Read<SeriesInput> {
  const b = isRecord(body) ? body : {};
  const freq = FREQS.find((f) => f === b.freq);
  const days = Array.isArray(b.days) ? DAY_ORDER.filter((d) => (b.days as unknown[]).includes(d)) : [];
  const times = readTimes(b);
  if (!freq || !isIsoDate(b.from) || times.ok === false) return invalid;
  if (!days.length) return { ok: false, error: SCHEDULE_ERRORS.noDays };
  const weekOfMonth = freq === 'monthly' ? WEEKS.find((w) => w === b.weekOfMonth) ?? 'first' : null;
  return { ok: true, value: { freq, weekOfMonth, days, ...times.value, from: b.from } };
}

function readClassInput(b: Body): Read<ClassInput> {
  const times = readTimes(b);
  if (!isIsoDate(b.date) || times.ok === false) return invalid;
  return { ok: true, value: { date: b.date, ...times.value, note: text(b.note, 500) } };
}

/** "Program nou": "Se repetă" on (default) is a series; off is one class (6.3). */
export function readProgramInput(body: unknown): Read<ProgramInput> {
  const b = isRecord(body) ? body : {};
  if (b.repeat === false) {
    const one = readClassInput(b);
    return one.ok ? { ok: true, value: { repeat: false, one: one.value } } : one;
  }
  const series = readSeriesInput(b);
  return series.ok ? { ok: true, value: { repeat: true, series: series.value } } : series;
}

export function readDateMode(body: unknown): DateMode | null {
  const b = isRecord(body) ? body : {};
  const reason = text(b.reason, 120);
  if (b.mode === 'keep') return { mode: 'keep' };
  if (b.mode === 'cancel') return { mode: 'cancel', reason };
  if (b.mode === 'move' && isIsoDate(b.newDate) && isTime(b.newStartTime)) return { mode: 'move', newDate: b.newDate, newStartTime: b.newStartTime, reason };
  return null;
}

/** "Anunță părinții pe e-mail": only when ticked (W7). */
export const wantsEmail = (body: unknown): boolean => isRecord(body) && body.notifyParents === true;

export const seasonOf = (seasons: SeasonRecord[], date: string): SeasonRecord | null =>
  seasons.find((s) => s.startMonth.slice(0, 10) <= date && date <= s.endMonth.slice(0, 10)) ?? null;

/** W9: school groups write `scoala`, Club groups `curs`. */
export const eventType = (kind: 'school' | 'club'): string => (kind === 'school' ? 'scoala' : 'curs');

export const inputText = (s: SeriesInput): SeriesText => ({ freq: s.freq, days: s.days, startTime: s.startTime, durationMin: s.durationMin, from: s.from });

const seriesRecurrence = (s: SeriesInput, seasonEnd: string): Recurrence => ({
  freq: s.freq, days: s.days, weekOfMonth: s.weekOfMonth, startTime: s.startTime, endTime: addMinutes(s.startTime, s.durationMin), singleDate: null, seasonStart: s.from, seasonEnd,
});

/** A new series: from "Se aplică din" to the last day of that season (W10), titled with the group name (W9). */
export const seriesWrite = (group: GroupRecord, type: string, s: SeriesInput, seasonEnd: string): EventWrite => ({
  title: group.name, type, description: null, groupId: group.id, recurrence: seriesRecurrence(s, seasonEnd), exceptions: [],
});

/** One class: its note is the event description (6.3). */
export const classWrite = (group: GroupRecord, type: string, c: ClassInput): EventWrite => ({
  title: group.name, type, description: c.note, groupId: group.id, exceptions: [],
  recurrence: { freq: 'none', days: [], weekOfMonth: null, startTime: c.startTime, endTime: addMinutes(c.startTime, c.durationMin), singleDate: c.date, seasonStart: null, seasonEnd: null },
});

const strapiTime = (t: string | null): string | null => (t ? `${t}:00.000` : null);
const dayFlags = (days: DayKey[]) => ({
  mon: days.includes('mon'), tue: days.includes('tue'), wed: days.includes('wed'), thu: days.includes('thu'), fri: days.includes('fri'), sat: days.includes('sat'), sun: days.includes('sun'),
});

/** The expansion's row for one of our events; a group event gets its group, so breaks apply to it (3.5). */
export function asCalendarRow(e: Omit<EventRecord, 'id'> & { id?: string }, groupName = ''): CalendarEventRow {
  const r = e.recurrence;
  return {
    id: 0, documentId: e.id, title: e.title, type: e.type, description: e.description,
    recurrence: { freq: r.freq, ...dayFlags(r.days), weekOfMonth: r.weekOfMonth, startTime: strapiTime(r.startTime), endTime: strapiTime(r.endTime), singleDate: r.singleDate, seasonStart: r.seasonStart, seasonEnd: r.seasonEnd },
    exceptions: e.exceptions.map((x) => ({ ...x, newStartTime: strapiTime(x.newStartTime), newEndTime: strapiTime(x.newEndTime) })),
    group: e.groupId ? { documentId: e.groupId, name: groupName } : null,
  };
}

/** The dates the event holds a class between `from` and `to`, exceptions and breaks ignored. */
export function classDates(e: Omit<EventRecord, 'id'> & { id?: string }, from: string, to: string): string[] {
  if (from > to) return [];
  return expandOccurrences([asCalendarRow({ ...e, exceptions: [] })], [], from, to).map((o) => o.date);
}

export const isClassDate = (e: Omit<EventRecord, 'id'> & { id?: string }, date: string): boolean => classDates(e, date, date).includes(date);

/** "Șterge programul" from `from`: ends the day before; a series with no class before that day is deleted (W10). */
export function planEnd(e: EventRecord, from: string): EventChange {
  const start = e.recurrence.seasonStart ?? from;
  if (!classDates(e, start, addDays(from, -1)).length) return { op: 'delete' };
  return { op: 'end', recurrence: { ...e.recurrence, seasonEnd: addDays(from, -1) }, exceptions: e.exceptions.filter((x) => x.date < from) };
}

/** "Schimbă" from `input.from`: the old series ends (or goes), a new one starts; changed dates from that day on move when still class dates (W10). */
export function planChange(e: EventRecord, input: SeriesInput, title: string): { old: EventChange; created: EventWrite } {
  const created: EventWrite = {
    title, type: e.type, description: e.description, groupId: e.groupId, exceptions: [], recurrence: seriesRecurrence(input, e.recurrence.seasonEnd ?? input.from),
  };
  const carried = e.exceptions.filter((x) => x.date >= input.from && isClassDate(created, x.date));
  return { old: planEnd(e, input.from), created: { ...created, exceptions: carried } };
}

const blank = (date: string): ExceptionRow => ({ date, kind: 'anulat', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: null });

/** "Ține" removes the date's exception, "Anulează" writes `anulat`, "Mută" writes `override` with the series duration (W12). */
export function planDateMode(e: EventRecord, date: string, m: DateMode): ExceptionRow[] | null {
  const rest = e.exceptions.filter((x) => x.date !== date);
  if (m.mode === 'keep') return rest;
  if (m.mode === 'cancel') return [...rest, { ...blank(date), reason: m.reason }];
  const minutes = minutesBetween(e.recurrence.startTime ?? '00:00', e.recurrence.endTime ?? '00:00');
  if (!fitsDay(m.newStartTime, minutes)) return null;
  return [...rest, { ...blank(date), kind: 'override', newDate: m.newDate === date ? null : m.newDate, newStartTime: m.newStartTime, newEndTime: addMinutes(m.newStartTime, minutes), reason: m.reason }];
}
```

- [ ] **Step 5: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/program-plan.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 6: Commit**

```bash
git add src/club/groups/program-plan.ts src/club/groups/copy/schedule.ts src/club/groups/copy.ts src/club/groups/__tests__/program-plan.test.ts
git commit -m "feat(schedules): program form, series and class events, Schimbă split, Șterge programul, date modes"
```

---

### Task 3: Parent e-mail (template, queue with notBefore, recipients, context)

**Files:**
- Create: `src/club/groups/copy/email.ts`, `src/club/groups/schedule-mail.ts`, `src/email/schedule-change-template.ts`
- Modify: `src/email/registration-template.ts` (shared shell `emailPage`, `brandHtml`, `footerText` exported; output unchanged)
- Modify: `src/email/job-state.ts` (`isDue` honours `notBefore`), `src/email/email-jobs.ts` (`EmailJobRow` kind / payload / notBefore; `attemptJob` composes a schedule change), `src/email/strapi-email.ts` (`toJobRow`; `attemptScheduleChangeJobs`)
- Modify: `src/club/groups/context.ts` (`emails`, `now`), `src/club/groups/__tests__/fake-group-store.ts` (`fakeContext` records them)
- Test: `src/email/__tests__/schedule-change.test.ts`, `src/club/groups/__tests__/schedule-mail.test.ts`, `src/email/__tests__/job-state.test.ts` (one case)

**Interfaces:**
- Consumes: Task 1 (`expandOccurrences`), Task 2 (`asCalendarRow`, `DateMode`), plan 4-1 (`ScheduleChangePayload`, `ScheduleEmailJob`, `isCurrentMembership`, `dayMonth`, `weekdayName`, `withPeriod`), P3 e-mail (`deliveryTarget`, `nextJobState`, `EmailDeps`).
- Produces:
  - `EMAIL_COPY` (approved texts, spec 6.5); `scheduleSubject(payload)`, `scheduleParagraphs(payload): string[][]`, `renderScheduleEmail({ payload, links }): RenderedEmail`.
  - `SCHEDULE_HOLD_MS = 15_000`; `recipients(athletes, memberships, groupId, seasonId): string[]`; `nextClass(events, breaks, groupId, after, until): { date; startTime } | null`; `changedStartTime(event, date)`; `schedulePayload(groupName, event, date, change, next)`; `scheduleJobs(addresses, payload, groupId, changeKey, now): ScheduleEmailJob[]`.
  - `EmailJobRow` gains optional `kind`, `payload`, `notBefore`; `attemptJob` skips a job before its `notBefore` and sends a `schedule-change` from its payload; `isDue(job, now, quietMs)` returns false before `notBefore`.
  - `attemptScheduleChangeJobs(strapi, changeKey, delayMs = SCHEDULE_HOLD_MS + 1000): void`.
  - `GroupContext.emails(changeKey)` (after commit: the first attempt once the hold is over) and `GroupContext.now()`; `fakeContext(...)` returns `emailed: string[]` and a fixed `now` of 2026-11-20 10:00 UTC.

- [ ] **Step 1: Write the failing tests**

`src/email/__tests__/schedule-change.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ScheduleChangePayload } from '../../club/groups/types';
import { attemptJob, type EmailDeps, type EmailJobRow } from '../email-jobs';
import { isDue } from '../job-state';
import { renderScheduleEmail, scheduleParagraphs, scheduleSubject } from '../schedule-change-template';

const CANCEL: ScheduleChangePayload = {
  groupName: 'Primii Pași', date: '2026-11-14', startTime: '10:00', mode: 'cancel', newDate: null, newStartTime: null,
  nextDate: '2026-11-15', nextStartTime: '10:00', reason: 'Competiție la Brașov',
};
const MOVE: ScheduleChangePayload = { ...CANCEL, mode: 'move', newDate: '2026-11-15', newStartTime: '12:00', nextDate: null, nextStartTime: null, reason: 'Patinoarul este închis.' };
const LINKS = { site: 'https://scoaladepatinaj.ro', program: 'https://scoaladepatinaj.ro/cursuri/program', privacy: 'https://scoaladepatinaj.ro/protectia-datelor', headerImage: null, whatsapp: null, phone: null, email: null, facebook: null };

describe('approved texts (6.5)', () => {
  it('subjects', () => {
    expect(scheduleSubject(CANCEL)).toBe('Primii Pași: ședința de sâmbătă, 14 noiembrie, se anulează');
    expect(scheduleSubject(MOVE)).toBe('Primii Pași: ședința de sâmbătă, 14 noiembrie, se mută');
  });

  it('cancel body, paragraphs in order, Motiv on the next line of the same paragraph', () => {
    expect(scheduleParagraphs(CANCEL)).toEqual([
      ['Bună ziua,'],
      ['Ședința grupei Primii Pași de sâmbătă, 14 noiembrie, ora 10:00, se anulează.', 'Motiv: Competiție la Brașov.'],
      ['Următoarea ședință: duminică, 15 noiembrie, ora 10:00.'],
      ['Echipa EduSport'],
    ]);
  });

  it('move body; a reason ending in a period gets no second one; no reason, no Motiv; no next class, no line (W33)', () => {
    expect(scheduleParagraphs(MOVE)[1]).toEqual(['Ședința grupei Primii Pași de sâmbătă, 14 noiembrie, ora 10:00, se mută duminică, 15 noiembrie, ora 12:00.', 'Motiv: Patinoarul este închis.']);
    expect(scheduleParagraphs({ ...CANCEL, reason: null, nextDate: null, nextStartTime: null })).toEqual([
      ['Bună ziua,'], ['Ședința grupei Primii Pași de sâmbătă, 14 noiembrie, ora 10:00, se anulează.'], ['Echipa EduSport'],
    ]);
  });

  it('renders the E1 letter with escaped text and a plain-text part', () => {
    const mail = renderScheduleEmail({ payload: { ...CANCEL, groupName: 'A <b>' }, links: LINKS });
    expect(mail.html).toContain('A &lt;b&gt;');
    expect(mail.html).toContain('Politicii de Confidențialitate');
    expect(mail.text.startsWith('Bună ziua,\n\nȘedința grupei A <b> de sâmbătă')).toBe(true);
  });
});

const job = (over: Partial<EmailJobRow> = {}): EmailJobRow => ({
  documentId: 'j1', recipient: 'parinte@example.com', subject: 's', registrationDocumentId: null, status: 'queued', attempts: 0, lastError: null, sentAt: null,
  updatedAt: '2026-11-20T10:00:00.000Z', kind: 'schedule-change', payload: CANCEL, notBefore: '2026-11-20T10:00:15.000Z', ...over,
});

function deps(now: string, sent: string[]): EmailDeps {
  const config = { live: false, apiKey: 'k', sender: { email: 'scoala@example.com', name: 'Școala' }, replyTo: null, testRecipient: 'test@example.com', siteUrl: 'https://scoaladepatinaj.ro' };
  return {
    config: config as EmailDeps['config'],
    jobs: { create: async () => job(), update: async (_id, data) => job(data), findQueued: async () => [], findLatest: async () => null, countForRecipientSince: async () => 0 },
    loadRegistration: async () => null, listDocuments: async () => [], buildDocuments: async () => [], readDocument: async () => Buffer.from(''),
    loadLinks: async () => LINKS,
    send: async (m) => { sent.push(`${m.to}|${m.subject}`); return { ok: true, messageId: null }; },
    recordHistory: async () => undefined, alert: () => undefined, log: () => undefined, defer: () => undefined, now: () => new Date(now),
  };
}

describe('queue (3.6, W7)', () => {
  it('waits until notBefore, then sends to the test address outside production', async () => {
    const sent: string[] = [];
    expect((await attemptJob(deps('2026-11-20T10:00:10.000Z', sent), job())).status).toBe('queued');
    expect(sent).toEqual([]);
    expect((await attemptJob(deps('2026-11-20T10:00:16.000Z', sent), job())).status).toBe('sent');
    expect(sent).toEqual(['test@example.com|Primii Pași: ședința de sâmbătă, 14 noiembrie, se anulează']);
  });

  it('a cancelled job is never sent; the cron skips a held job', async () => {
    const sent: string[] = [];
    await attemptJob(deps('2026-11-20T11:00:00.000Z', sent), job({ status: 'cancelled' }));
    expect(sent).toEqual([]);
    expect(isDue({ status: 'queued', updatedAt: '2026-11-20T09:00:00.000Z', notBefore: '2026-11-20T12:00:00.000Z' }, new Date('2026-11-20T11:00:00.000Z'), 0)).toBe(false);
  });

  it('a schedule change without a payload fails at once', async () => {
    expect((await attemptJob(deps('2026-11-20T11:00:00.000Z', []), job({ payload: null }))).status).toBe('failed');
  });
});
```

If `EmailConfig` has other required fields, add them to `config` with throwaway values (read `src/email/config.ts`); keep `live: false` and a `testRecipient`.

`src/club/groups/__tests__/schedule-mail.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { changedStartTime, nextClass, recipients, schedulePayload, scheduleJobs } from '../schedule-mail';
import { athleteRow, event, member } from './fake-group-store';

const ATHLETES = [
  athleteRow({ id: 'a1', email: ' Parinte.Ionescu@Example.com ' }), athleteRow({ id: 'a2', email: 'parinte.ionescu@example.com' }),
  athleteRow({ id: 'a3', email: 'stan@example.com', status: 'inactiv' }), athleteRow({ id: 'a4', email: 'anon@example.com', status: 'anonimizat' }),
  athleteRow({ id: 'a5', email: 'ended@example.com' }), athleteRow({ id: 'a6', email: '' }), athleteRow({ id: 'a7', email: 'other@example.com' }),
];
const ROWS = [
  member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a2', groupId: 'g-ib', isMain: false }),
  member({ id: 'm3', athleteId: 'a3', groupId: 'g-ib' }), member({ id: 'm4', athleteId: 'a4', groupId: 'g-ib' }),
  member({ id: 'm5', athleteId: 'a5', groupId: 'g-ib', to: '2026-10-31' }), member({ id: 'm6', athleteId: 'a6', groupId: 'g-ib' }),
  member({ id: 'm7', athleteId: 'a7', groupId: 'g-ib', seasonId: 's25' }),
];

describe('recipients (6.5, W7)', () => {
  it('current members of the season, Nou and Activ, trimmed, lower case, each address once', () => {
    expect(recipients(ATHLETES, ROWS, 'g-ib', 's26')).toEqual(['parinte.ionescu@example.com']);
  });
});

describe('next class (W33)', () => {
  const e = event({ id: 'e1', exceptions: [{ date: '2026-11-15', kind: 'anulat', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: null }] });

  it('is the first held class after the date, skipping cancelled dates and breaks', () => {
    expect(nextClass([e], [], 'g-ib', '2026-11-14', '2027-05-31')).toEqual({ date: '2026-11-21', startTime: '11:00' });
    expect(nextClass([e], [{ id: 'b', label: 'Pauză', startDate: '2026-11-21', endDate: '2026-11-22' }], 'g-ib', '2026-11-14', '2027-05-31')).toEqual({ date: '2026-11-28', startTime: '11:00' });
  });

  it('is null after the season\'s last class', () => {
    expect(nextClass([e], [], 'g-ib', '2027-05-31', '2027-05-31')).toBeNull();
  });
});

describe('payload and jobs', () => {
  const e = event({ id: 'e1', exceptions: [{ date: '2026-11-21', kind: 'override', newDate: '2026-11-22', newStartTime: '12:00', newEndTime: '12:50', newTitle: null, reason: null }] });

  it('the changed date keeps the time it had (decided 3)', () => {
    expect(changedStartTime(e, '2026-11-21')).toBe('12:00');
    expect(changedStartTime(e, '2026-11-14')).toBe('11:00');
  });

  it('a cancel carries the next class, a move does not', () => {
    expect(schedulePayload('Intermediari Bronze', e, '2026-11-14', { mode: 'cancel', reason: null }, { date: '2026-11-15', startTime: '11:00' })).toEqual({
      groupName: 'Intermediari Bronze', date: '2026-11-14', startTime: '11:00', mode: 'cancel', newDate: null, newStartTime: null, nextDate: '2026-11-15', nextStartTime: '11:00', reason: null,
    });
    expect(schedulePayload('Intermediari Bronze', e, '2026-11-14', { mode: 'move', newDate: '2026-11-15', newStartTime: '12:00', reason: 'Gheață' }, null))
      .toMatchObject({ mode: 'move', newDate: '2026-11-15', newStartTime: '12:00', nextDate: null, reason: 'Gheață' });
  });

  it('one job per address, held 15 seconds, keyed by the change', () => {
    const payload = schedulePayload('Intermediari Bronze', e, '2026-11-14', { mode: 'cancel', reason: null }, null);
    expect(scheduleJobs(['a@example.com', 'b@example.com'], payload, 'g-ib', 'h7', new Date('2026-11-20T10:00:00.000Z'))).toEqual([
      { recipient: 'a@example.com', subject: 'Intermediari Bronze: ședința de sâmbătă, 14 noiembrie, se anulează', groupId: 'g-ib', changeKey: 'h7', notBefore: '2026-11-20T10:00:15.000Z', payload },
      { recipient: 'b@example.com', subject: 'Intermediari Bronze: ședința de sâmbătă, 14 noiembrie, se anulează', groupId: 'g-ib', changeKey: 'h7', notBefore: '2026-11-20T10:00:15.000Z', payload },
    ]);
  });
});
```

In `src/email/__tests__/job-state.test.ts`, inside `describe('isDue', ...)`, add:

```ts
  it('waits for notBefore', () => {
    expect(isDue({ status: 'queued', updatedAt: null, notBefore: '2026-10-20T09:00:01.000Z' }, NOW, quiet)).toBe(false);
    expect(isDue({ status: 'queued', updatedAt: null, notBefore: '2026-10-20T08:00:00.000Z' }, NOW, quiet)).toBe(true);
  });
```

(`NOW` there is 2026-10-20 09:00 UTC; check the file and adjust the two instants so the first is after `NOW` and the second before it.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/email/__tests__/schedule-change.test.ts src/club/groups/__tests__/schedule-mail.test.ts src/email/__tests__/job-state.test.ts`
Expected: FAIL (`Cannot find module '../schedule-change-template'`, `'../schedule-mail'`; the held job counted due).

- [ ] **Step 3: Write `copy/email.ts`**

```ts
import { withPeriod } from './core';

/** Parent e-mail on a schedule change, approved texts (spec 6.5). `<zi>` lower case, `<data>` "14 noiembrie", `<ora>` "10:00". */
export const EMAIL_COPY = {
  greeting: 'Bună ziua,',
  signature: 'Echipa EduSport',
  subjectCancel: (group: string, day: string, date: string) => `${group}: ședința de ${day}, ${date}, se anulează`,
  subjectMove: (group: string, day: string, date: string) => `${group}: ședința de ${day}, ${date}, se mută`,
  cancelled: (group: string, day: string, date: string, time: string) => `Ședința grupei ${group} de ${day}, ${date}, ora ${time}, se anulează.`,
  moved: (group: string, day: string, date: string, time: string, newDay: string, newDate: string, newTime: string) =>
    `Ședința grupei ${group} de ${day}, ${date}, ora ${time}, se mută ${newDay}, ${newDate}, ora ${newTime}.`,
  reason: (reason: string) => `Motiv: ${withPeriod(reason)}`,
  next: (day: string, date: string, time: string) => `Următoarea ședință: ${day}, ${date}, ora ${time}.`,
} as const;
```

- [ ] **Step 4: Share the letter shell in `registration-template.ts`**

Export `brandHtml` (add `export` to its declaration), then replace `registrationHtml` and the footer part of `registrationText` with:

```ts
/** The E1 letter around `bodyHtml`: navy left bar, white letter, the contact footer (registration and schedule e-mails). */
export function emailPage(bodyHtml: string, links: EmailLinks): string {
  return (
    `<!DOCTYPE html><html lang="ro">${HEAD}<body style="margin:0;padding:0;background:#f3f4f6;">` +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff;">' +
    `<tr><td width="6" bgcolor="${NAVY}" style="width:6px;background:${NAVY};font-size:0;line-height:0;">&nbsp;</td>` +
    `<td class="es-pad" style="padding:36px;font-family:${FONT};font-size:14px;line-height:1.5;color:#1b1d22;">${bodyHtml}</td></tr>` +
    `<tr>${footerHtml(links)}</tr>` +
    '</table></td></tr></table></body></html>'
  );
}

export function registrationHtml(input: RegistrationEmailInput): string {
  return emailPage(headerHtml(input) + introHtml(input) + stepsHtml(input.documents) + buttonsHtml(input.links) + signOffHtml(), input.links);
}

/** The footer as plain text: contact lines, then the privacy notice. */
export const footerText = (links: EmailLinks): string[] => [contactLines(links).join('\n'), `${NOTICE_START}${displayUrl(links.site)}${NOTICE_END}${PRIVACY}: ${links.privacy}`];
```

and delete `letterHtml`. In `registrationText`, replace its last two array items with `...footerText(input.links)`. Run `npx vitest run src/email/__tests__/registration-template.test.ts`: it must pass unchanged (same output).

- [ ] **Step 5: Write `schedule-change-template.ts`**

```ts
import { EMAIL_COPY } from '../club/groups/copy/email';
import { dayMonth, weekdayName } from '../club/groups/dates';
import type { ScheduleChangePayload } from '../club/groups/types';
import { brandHtml, emailPage, escapeHtml, footerText, type EmailLinks, type RenderedEmail } from './registration-template';

/** Parent e-mail on a schedule change (spec 6.5): approved texts in the E1 letter (decided 2). Pure. */
export type ScheduleEmailInput = { payload: ScheduleChangePayload; links: EmailLinks };

const when = (date: string) => ({ day: weekdayName(date), date: dayMonth(date) });

export function scheduleSubject(p: ScheduleChangePayload): string {
  const w = when(p.date);
  return p.mode === 'move' ? EMAIL_COPY.subjectMove(p.groupName, w.day, w.date) : EMAIL_COPY.subjectCancel(p.groupName, w.day, w.date);
}

function changeLine(p: ScheduleChangePayload): string {
  const w = when(p.date);
  if (p.mode === 'cancel' || !p.newDate || !p.newStartTime) return EMAIL_COPY.cancelled(p.groupName, w.day, w.date, p.startTime);
  const n = when(p.newDate);
  return EMAIL_COPY.moved(p.groupName, w.day, w.date, p.startTime, n.day, n.date, p.newStartTime);
}

/** Paragraphs in order; the lines of one paragraph are joined by a line break. */
export function scheduleParagraphs(p: ScheduleChangePayload): string[][] {
  const change = p.reason ? [changeLine(p), EMAIL_COPY.reason(p.reason)] : [changeLine(p)];
  const next = p.mode === 'cancel' && p.nextDate && p.nextStartTime ? [[EMAIL_COPY.next(weekdayName(p.nextDate), dayMonth(p.nextDate), p.nextStartTime)]] : [];
  return [[EMAIL_COPY.greeting], change, ...next, [EMAIL_COPY.signature]];
}

const paragraphHtml = (lines: string[]): string => `<p style="margin:0 0 14px;">${lines.map(escapeHtml).join('<br>')}</p>`;

export function renderScheduleEmail(input: ScheduleEmailInput): RenderedEmail {
  const paragraphs = scheduleParagraphs(input.payload);
  const body = `<div style="margin:0 0 28px;">${brandHtml(input.links.headerImage)}</div>${paragraphs.map(paragraphHtml).join('')}`;
  return {
    subject: scheduleSubject(input.payload),
    html: emailPage(body, input.links),
    text: [...paragraphs.map((lines) => lines.join('\n')), ...footerText(input.links)].join('\n\n') + '\n',
  };
}
```

- [ ] **Step 6: Queue changes**

`src/email/job-state.ts`, replace `isDue`:

```ts
/** A job the cron may try now: queued, past its `notBefore` (a schedule change's hold), untouched for `quietMs`. */
export function isDue(job: { status: EmailJobStatus; updatedAt: string | null; notBefore?: string | null }, now: Date, quietMs: number): boolean {
  if (job.status !== 'queued') return false;
  if (job.notBefore && Date.parse(job.notBefore) > now.getTime()) return false;
  const updated = job.updatedAt ? Date.parse(job.updatedAt) : 0;
  return now.getTime() - updated >= quietMs;
}
```

`src/email/email-jobs.ts`: extend the row type, and replace `tryOnce` and `attemptJob`:

```ts
import type { ScheduleChangePayload } from '../club/groups/types';
import { renderScheduleEmail } from './schedule-change-template';
```

```ts
export type EmailJobKind = 'registration' | 'schedule-change';
export type EmailJobRow = {
  documentId: string;
  recipient: string;
  subject: string;
  registrationDocumentId: string | null;
  status: EmailJobStatus;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  updatedAt: string | null;
  kind?: EmailJobKind;
  payload?: ScheduleChangePayload | null;
  notBefore?: string | null;
};
```

```ts
type Compose = (to: string) => Promise<OutgoingEmail>;

function scheduleComposer(deps: EmailDeps, payload: ScheduleChangePayload | null): Compose | null {
  if (!payload) return null;
  return async (to) => ({ to, ...renderScheduleEmail({ payload, links: await deps.loadLinks() }), attachments: [] });
}

function composerFor(deps: EmailDeps, job: EmailJobRow): Compose | null {
  if (job.kind === 'schedule-change') return scheduleComposer(deps, job.payload ?? null);
  const registrationId = job.registrationDocumentId;
  return registrationId ? (to) => compose(deps, registrationId, to) : null;
}

async function tryOnce(deps: EmailDeps, composer: Compose, to: string): Promise<AttemptOutcome> {
  try {
    const result = await deps.send(await composer(to));
    return result.ok === true ? { ok: true } : { ok: false, error: result.error };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

const held = (job: EmailJobRow, now: Date): boolean => !!job.notBefore && Date.parse(job.notBefore) > now.getTime();
const missingSource = (job: EmailJobRow): string => (job.kind === 'schedule-change' ? 'schedule change without payload' : 'registration deleted');

/**
 * One delivery attempt for a queued job. Skipped (job unchanged) while it is held (`notBefore`) or while e-mail
 * cannot be sent here; a job whose registration (or payload) is gone fails at once without an alert.
 */
export async function attemptJob(deps: EmailDeps, job: EmailJobRow): Promise<EmailJobRow> {
  if (job.status !== 'queued' || held(job, deps.now())) return job;
  const composer = composerFor(deps, job);
  if (!composer) return deps.jobs.update(job.documentId, { status: 'failed', attempts: job.attempts, lastError: missingSource(job), sentAt: null });
  const target = deliveryTarget(deps.config, job.recipient);
  if (target.ok === false) {
    deps.log('info', `[email-job] job ${job.documentId} stays queued: ${target.reason}`);
    return job;
  }
  const { alert, ...state } = nextJobState(job, await tryOnce(deps, composer, target.to), deps.now());
  const updated = await deps.jobs.update(job.documentId, state);
  deps.log(state.status === 'sent' ? 'info' : 'warn', `[email-job] job ${job.documentId}: ${state.status} after attempt ${state.attempts}`);
  if (alert) deps.alert(`[email-job] ${job.kind ?? 'registration'} e-mail failed after ${state.attempts} attempts (job ${job.documentId}): ${state.lastError}`);
  return updated;
}
```

In `retryDueJobs`, `isDue(job, now, QUIET_MS)` already receives the row; `notBefore` is on it now.

`src/email/strapi-email.ts`: extend `RawJob` and `toJobRow`, and add the first attempt of a change:

```ts
import { SCHEDULE_HOLD_MS } from '../club/groups/schedule-mail';
import type { ScheduleChangePayload } from '../club/groups/types';
```

```ts
type RawJob = {
  documentId: string;
  recipient?: string | null;
  subject?: string | null;
  status?: string | null;
  attempts?: number | null;
  lastError?: string | null;
  sentAt?: unknown;
  updatedAt?: unknown;
  registration?: { documentId?: string } | null;
  kind?: string | null;
  payload?: unknown;
  notBefore?: unknown;
};

const payloadOf = (v: unknown): ScheduleChangePayload | null => (v && typeof v === 'object' && typeof (v as { groupName?: unknown }).groupName === 'string' ? (v as ScheduleChangePayload) : null);

export function toJobRow(raw: RawJob): EmailJobRow {
  return {
    documentId: raw.documentId,
    recipient: raw.recipient ?? '',
    subject: raw.subject ?? '',
    registrationDocumentId: raw.registration?.documentId ?? null,
    status: (raw.status ?? 'queued') as EmailJobStatus,
    attempts: raw.attempts ?? 0,
    lastError: raw.lastError ?? null,
    sentAt: iso(raw.sentAt),
    updatedAt: iso(raw.updatedAt),
    kind: raw.kind === 'schedule-change' ? 'schedule-change' : 'registration',
    payload: payloadOf(raw.payload),
    notBefore: iso(raw.notBefore),
  };
}
```

```ts
async function attemptChange(strapi: Core.Strapi, changeKey: string): Promise<void> {
  const deps = buildEmailDeps(strapi);
  const rows = await strapi.documents(JOB_UID).findMany({ filters: { changeKey, status: 'queued' }, populate: POPULATE, limit: 1000 });
  for (const raw of rows) await attemptJob(deps, toJobRow(raw as unknown as RawJob));
}

/** The first attempt of a schedule change's e-mails once the hold is over (spec 6.5); the hourly cron retries. */
export function attemptScheduleChangeJobs(strapi: Core.Strapi, changeKey: string, delayMs = SCHEDULE_HOLD_MS + 1000): void {
  setTimeout(() => {
    attemptChange(strapi, changeKey).catch((err) => strapi.log.error(`[email-job] schedule change ${changeKey} crashed: ${err instanceof Error ? err.message : String(err)}`));
  }, delayMs);
}
```

Import `attemptJob` from `./email-jobs` alongside the existing imports.

- [ ] **Step 7: Write `schedule-mail.ts`**

```ts
import { expandOccurrences } from '../../api/calendar-event/services/expand';
import type { AthleteRow, MembershipRow } from '../athletes/store';
import { scheduleSubject } from '../../email/schedule-change-template';
import { isCurrentMembership } from '../group-membership';
import { addDays } from './dates';
import { asCalendarRow, type DateMode } from './program-plan';
import type { BreakRecord, EventRecord, ScheduleChangePayload, ScheduleEmailJob } from './types';

/** Parent e-mail on a schedule change (spec 6.5, W7, W33). Pure. */
export const SCHEDULE_HOLD_MS = 15_000;
const SENDABLE: ReadonlySet<string> = new Set(['nou', 'activ']);
type Held = { date: string; startTime: string };
export type Change = Exclude<DateMode, { mode: 'keep' }>;

/** The contact e-mail of every current member of the group in the season; Inactiv and anonymized left out; each address once. */
export function recipients(athletes: AthleteRow[], memberships: MembershipRow[], groupId: string, seasonId: string): string[] {
  const ids = new Set(memberships.filter((m) => m.groupId === groupId && m.seasonId === seasonId && isCurrentMembership(m)).map((m) => m.athleteId));
  const emails = athletes.filter((a) => ids.has(a.id) && SENDABLE.has(a.status)).map((a) => (a.email ?? '').trim().toLowerCase()).filter(Boolean);
  return [...new Set(emails)].sort();
}

/** The group's first held class after `after`, up to `until` (the season's last day): series, one class or a moved date at its new date. */
export function nextClass(events: EventRecord[], breaks: BreakRecord[], groupId: string, after: string, until: string): Held | null {
  const from = addDays(after, 1);
  if (from > until) return null;
  const rows = events.filter((e) => e.groupId === groupId).map((e) => asCalendarRow(e));
  const blackouts = breaks.map((b) => ({ label: b.label, startDate: b.startDate, endDate: b.endDate }));
  const held = expandOccurrences(rows, blackouts, from, until).find((o) => o.status !== 'cancelled' && o.startTime);
  return held?.startTime ? { date: held.date, startTime: held.startTime } : null;
}

/** Decided 3: the time the date had before this change. */
export function changedStartTime(e: EventRecord, date: string): string {
  const moved = e.exceptions.find((x) => x.date === date && x.kind === 'override');
  return moved?.newStartTime ?? e.recurrence.startTime ?? '';
}

export function schedulePayload(groupName: string, e: EventRecord, date: string, change: Change, next: Held | null): ScheduleChangePayload {
  const move = change.mode === 'move' ? change : null;
  return {
    groupName, date, startTime: changedStartTime(e, date), mode: move ? 'move' : 'cancel', newDate: move?.newDate ?? null, newStartTime: move?.newStartTime ?? null,
    nextDate: move ? null : next?.date ?? null, nextStartTime: move ? null : next?.startTime ?? null, reason: change.reason,
  };
}

/** One queued job per address, held 15 s so the toast's "Anulează" can cancel them (W7). */
export function scheduleJobs(addresses: string[], payload: ScheduleChangePayload, groupId: string, changeKey: string, now: Date): ScheduleEmailJob[] {
  const notBefore = new Date(now.getTime() + SCHEDULE_HOLD_MS).toISOString();
  const subject = scheduleSubject(payload);
  return addresses.map((recipient) => ({ recipient, subject, groupId, changeKey, notBefore, payload }));
}
```

- [ ] **Step 8: Context and the fake**

`src/club/groups/context.ts`: extend the type and the builder:

```ts
import { attemptScheduleChangeJobs } from '../../email/strapi-email';
```

```ts
export type GroupContext = {
  store: GroupStore; actor: string; today: string; log: (message: string) => void; revalidate: () => void;
  /** After commit: the first attempt of a schedule change's e-mails once the hold is over. */
  emails: (changeKey: string) => void;
  now: () => Date;
};
```

and in `groupContext` add:

```ts
    emails: (changeKey) => attemptScheduleChangeJobs(strapi, changeKey),
    now: () => new Date(),
```

`src/club/groups/__tests__/fake-group-store.ts`, replace `FakeContext` and `fakeContext`:

```ts
export type FakeContext = FakeGroup & { ctx: GroupContext; revalidated: () => number; logs: string[]; emailed: string[] };

/** A GroupContext over the fake store; today 20 November 2026, now 10:00 UTC, unless given. */
export function fakeContext(seed: Partial<FakeGroupState> = {}, today = '2026-11-20'): FakeContext {
  const fake = fakeGroupStore(seed);
  let pings = 0;
  const logs: string[] = [];
  const emailed: string[] = [];
  const ctx: GroupContext = {
    store: fake.store, actor: 'admin@example.com', today, log: (m) => logs.push(m), revalidate: () => { pings += 1; },
    emails: (key) => emailed.push(key), now: () => new Date(`${today}T10:00:00.000Z`),
  };
  return { ...fake, ctx, logs, emailed, revalidated: () => pings };
}
```

- [ ] **Step 9: Run the tests and checks**

Run: `npx vitest run src/email src/club/groups && npx vitest run && npx tsc --noEmit`
Expected: PASS (the registration e-mail tests unchanged); zero type errors.

- [ ] **Step 10: Commit**

```bash
git add src/email src/club/groups/copy/email.ts src/club/groups/schedule-mail.ts src/club/groups/context.ts src/club/groups/__tests__/fake-group-store.ts src/club/groups/__tests__/schedule-mail.test.ts
git commit -m "feat(schedules): parent e-mail on a schedule change, held 15 seconds, sent through the Brevo queue"
```

---
### Task 4: Program services ("Adaugă program", "Schimbă", "Șterge programul", "Șterge ședința")

**Files:**
- Create: `src/club/groups/program.ts`
- Modify: `src/club/groups/copy.ts` (add `export * from './copy/email';`)
- Test: `src/club/groups/__tests__/program.test.ts`

**Interfaces:**
- Consumes: Task 2 (`readProgramInput`, `readSeriesInput`, `seriesWrite`, `classWrite`, `planChange`, `planEnd`, `eventType`, `seasonOf`, `inputText`), plan 4-1 (`recordAction`, `done`, `ActionResult`, `seriesView`, `seriesText`, `seasonBounds`, `isPastSeason`, `P4_ACTIONS`, `GROUP_SUBJECT`, `UndoStep`).
- Produces (each: one transaction, Istoric on the group, undo, `ctx.revalidate()` after commit):
  - `addProgram(ctx, groupId, body): Promise<ActionResult<{ eventId: string; date: string | null }>>` (`date` set for one class, for its toast).
  - `changeProgram(ctx, eventId, body): Promise<ActionResult<{ eventId: string }>>` (body = the series form with `from` = "Se aplică din"; answers the new series id).
  - `endProgram(ctx, eventId, body: { from }): Promise<ActionResult<{ eventId: string }>>`.
  - `deleteClass(ctx, eventId): Promise<ActionResult<{ date: string }>>`.
  - `eventSnapshot(e): EventWrite` (also used by Task 5 tests).

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/program.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addProgram, changeProgram, deleteClass, endProgram } from '../program';
import { undoAction } from '../undo-service';
import { event, fakeContext } from './fake-group-store';

const SERIES = { freq: 'weekly', days: ['sat', 'sun'], startTime: '11:00', durationMin: 50, from: '2026-11-07' };
const actionOf = (r: { ok: boolean; data?: { actionId: string | null } }) => (r.ok && r.data?.actionId) || '';

describe('"Adaugă program" (6.3)', () => {
  it('writes a school series from Se aplică din to the season end, with a line, an undo and a website ping', async () => {
    const { ctx, state, revalidated } = fakeContext();
    const res = await addProgram(ctx, 'g-ib', SERIES);
    expect(res.ok).toBe(true);
    expect(state.events[0]).toMatchObject({ type: 'scoala', title: 'Intermediari Bronze', groupId: 'g-ib', recurrence: { seasonStart: '2026-11-07', seasonEnd: '2027-05-31', endTime: '11:50' } });
    expect(state.history[0]).toMatchObject({ subjectType: 'group', subjectId: 'g-ib', action: 'program-added', changes: { series: { days: ['sat', 'sun'], startTime: '11:00', durationMin: 50, from: '2026-11-07' } } });
    expect(revalidated()).toBe(1);
    await undoAction(ctx, { actionId: actionOf(res) });
    expect(state.events).toEqual([]);
  });

  it('a Club group writes `curs`; one class answers its date for the toast', async () => {
    const { ctx, state } = fakeContext();
    const res = await addProgram(ctx, 'g-av', { repeat: false, date: '2026-11-20', startTime: '18:00', durationMin: 60, note: null });
    expect(res).toMatchObject({ ok: true, data: { value: { date: '2026-11-20' } } });
    expect(state.events[0]).toMatchObject({ type: 'curs', recurrence: { freq: 'none', singleDate: '2026-11-20' } });
    expect(state.history[0].action).toBe('class-added');
  });

  it('refuses a past season, a date in no season, an inactive group', async () => {
    const { ctx, state } = fakeContext();
    expect((await addProgram(ctx, 'g-ib', { ...SERIES, from: '2026-03-07' })).ok).toBe(false);
    expect((await addProgram(ctx, 'g-ib', { ...SERIES, from: '2026-07-04' })).ok).toBe(false);
    state.groups[1].active = false;
    expect((await addProgram(ctx, 'g-ib', SERIES)).ok).toBe(false);
  });
});

describe('"Schimbă" and "Șterge programul" (W10)', () => {
  const seed = () => fakeContext({ events: [event({ id: 'e1', exceptions: [{ date: '2026-12-05', kind: 'anulat', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: null }] })] });

  it('ends the old series the day before and starts a new one, carried dates included; the undo restores both', async () => {
    const { ctx, state } = seed();
    const before = structuredClone(state.events);
    const res = await changeProgram(ctx, 'e1', { ...SERIES, days: ['sat'], startTime: '12:00', from: '2026-11-28' });
    expect(state.events.map((e) => [e.id, e.recurrence.seasonStart, e.recurrence.seasonEnd, e.exceptions.length])).toEqual([['e1', '2026-10-04', '2026-11-27', 0], [expect.any(String), '2026-11-28', '2027-05-31', 1]]);
    expect(state.history[0]).toMatchObject({ action: 'program-changed', changes: { from: '2026-11-28', before: { startTime: '11:00' }, after: { startTime: '12:00' } } });
    expect(state.locks).toEqual(['event:e1']);
    await undoAction(ctx, { actionId: actionOf(res) });
    expect(state.events).toEqual(before);
  });

  it('"Șterge programul" ends the series the day before, or deletes one that never held a class', async () => {
    const { ctx, state } = seed();
    await endProgram(ctx, 'e1', { from: '2027-03-01' });
    expect(state.events[0].recurrence.seasonEnd).toBe('2027-02-28');
    expect(state.history[0]).toMatchObject({ action: 'program-ended', changes: { from: '2027-03-01' } });
    const early = seed();
    await endProgram(early.ctx, 'e1', { from: '2026-10-04' });
    expect(early.state.events).toEqual([]);
  });

  it('refuses a "Se aplică din" outside the series', async () => {
    const { ctx } = seed();
    expect((await changeProgram(ctx, 'e1', { ...SERIES, from: '2027-06-05' })).ok).toBe(false);
  });
});

describe('"Șterge ședința"', () => {
  it('deletes one class with its line; the undo brings it back', async () => {
    const one = event({ id: 'c1', recurrence: { freq: 'none', days: [], weekOfMonth: null, startTime: '18:00', endTime: '19:00', singleDate: '2026-11-20', seasonStart: null, seasonEnd: null } });
    const { ctx, state } = fakeContext({ events: [one] });
    const res = await deleteClass(ctx, 'c1');
    expect(res).toMatchObject({ ok: true, data: { value: { date: '2026-11-20' } } });
    expect(state.history[0]).toMatchObject({ action: 'class-deleted', changes: { date: '2026-11-20', startTime: '18:00' } });
    await undoAction(ctx, { actionId: actionOf(res) });
    expect(state.events.map((e) => e.recurrence.singleDate)).toEqual(['2026-11-20']);
  });

  it('refuses a series', async () => {
    const { ctx } = fakeContext({ events: [event({ id: 'e1' })] });
    expect((await deleteClass(ctx, 'e1')).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/program.test.ts`
Expected: FAIL (`Cannot find module '../program'`).

- [ ] **Step 3: Add the e-mail copy export**

`src/club/groups/copy.ts`, add:

```ts
export * from './copy/email';
```

- [ ] **Step 4: Write `program.ts`**

```ts
import { guarded, refuse, type AdminResult } from '../admin-result';
import { done, recordAction, type ActionResult, type Line } from './action-log';
import type { GroupContext } from './context';
import { GROUP_ERRORS } from './copy';
import { isIsoDate } from './dates';
import { GROUP_SUBJECT, P4_ACTIONS } from './history-lines';
import { classWrite, eventType, inputText, planChange, planEnd, readProgramInput, readSeriesInput, seasonOf, seriesWrite, type EventChange, type ProgramInput } from './program-plan';
import { isPastSeason } from './season-pick';
import { seasonBounds, seriesText, seriesView, type SeriesView } from './series';
import type { EventRecord, EventWrite, GroupRecord, GroupStore, SeasonRecord, SectionRecord } from './types';
import type { UndoStep } from './undo';

/** The group's program (spec 6.3, W10): one transaction each, the event row locked first, a group line, an undo, a website ping. */
type Placed = { group: GroupRecord; section: SectionRecord; season: SeasonRecord };

export const eventSnapshot = (e: EventRecord): EventWrite => ({
  title: e.title, type: e.type, description: e.description, groupId: e.groupId, recurrence: e.recurrence, exceptions: e.exceptions,
});

/** The active group, its section and the (not past) season that contains `date`. */
async function placeOn(store: GroupStore, groupId: string, date: string): Promise<AdminResult<Placed>> {
  const [group, sections, seasons] = await Promise.all([store.group(groupId), store.sections(), store.seasons()]);
  const section = sections.find((s) => s.id === group?.sectionId);
  const season = seasonOf(seasons, date);
  if (!group || !group.active || !section) return refuse(409, GROUP_ERRORS.stale);
  if (!season || isPastSeason(season, seasons)) return refuse(409, GROUP_ERRORS.stale);
  return { ok: true, data: { group, section, season } };
}

function addedLine(groupId: string, input: ProgramInput): Line {
  if (input.repeat) return { subjectType: GROUP_SUBJECT, subjectId: groupId, action: P4_ACTIONS.programAdded, changes: { series: inputText(input.series) } };
  const { date, startTime, durationMin } = input.one;
  return { subjectType: GROUP_SUBJECT, subjectId: groupId, action: P4_ACTIONS.classAdded, changes: { date, startTime, durationMin } };
}

async function addLocked(ctx: GroupContext, groupId: string, input: ProgramInput): Promise<ActionResult<{ eventId: string; date: string | null }>> {
  await ctx.store.lockGroup(groupId);
  const placed = await placeOn(ctx.store, groupId, input.repeat ? input.series.from : input.one.date);
  if (placed.ok === false) return placed;
  const { group, section, season } = placed.data;
  const type = eventType(section.kind);
  const write = input.repeat ? seriesWrite(group, type, input.series, seasonBounds(season).end) : classWrite(group, type, input.one);
  const eventId = await ctx.store.createEvent(write);
  const actionId = await recordAction(ctx.store, ctx.actor, [addedLine(group.id, input)], { kind: 'group', steps: [{ op: 'deleteEvent', id: eventId }], revalidate: true });
  return done({ eventId, date: input.repeat ? null : input.one.date }, actionId);
}

const pinged = <T>(ctx: GroupContext, res: ActionResult<T>): ActionResult<T> => {
  if (res.ok === true) ctx.revalidate();
  return res;
};

/** POST /club/groups/:id/program: "Program nou", a series ("Se repetă" on) or one class. */
export async function addProgram(ctx: GroupContext, groupId: string, body: unknown): Promise<ActionResult<{ eventId: string; date: string | null }>> {
  const read = readProgramInput(body);
  if (read.ok === false) return refuse(400, read.error);
  return pinged(ctx, await guarded(ctx.log, `[program] adding to ${groupId}`, () => ctx.store.transaction(() => addLocked(ctx, groupId, read.value))));
}

type LockedSeries = { e: EventRecord; series: SeriesView; group: GroupRecord };

/** The series row locked and read again; `from` must fall inside it and in a season that is not past. */
async function lockedSeries(store: GroupStore, eventId: string, from: string): Promise<AdminResult<LockedSeries>> {
  await store.lockEvent(eventId);
  const e = await store.event(eventId);
  const series = e ? seriesView(e) : null;
  if (!e || !series || !e.groupId) return refuse(409, GROUP_ERRORS.stale);
  if (from < series.from || from > series.to) return refuse(400, GROUP_ERRORS.invalid);
  const placed = await placeOn(store, e.groupId, from);
  return placed.ok === false ? placed : { ok: true, data: { e, series, group: placed.data.group } };
}

/** Applies an end or a delete of the old series; answers the step that takes it back. */
async function applyChange(store: GroupStore, e: EventRecord, change: EventChange): Promise<UndoStep> {
  if (change.op === 'delete') {
    await store.deleteEvent(e.id);
    return { op: 'createEvent', event: eventSnapshot(e) };
  }
  await store.updateEvent(e.id, { recurrence: change.recurrence, exceptions: change.exceptions });
  return { op: 'setEvent', id: e.id, recurrence: e.recurrence, exceptions: e.exceptions };
}

async function changeLocked(ctx: GroupContext, eventId: string, body: unknown): Promise<ActionResult<{ eventId: string }>> {
  const read = readSeriesInput(body);
  if (read.ok === false) return refuse(400, read.error);
  const found = await lockedSeries(ctx.store, eventId, read.value.from);
  if (found.ok === false) return found;
  const { e, series, group } = found.data;
  const plan = planChange(e, read.value, group.name);
  const oldStep = await applyChange(ctx.store, e, plan.old);
  const createdId = await ctx.store.createEvent(plan.created);
  const line: Line = { subjectType: GROUP_SUBJECT, subjectId: group.id, action: P4_ACTIONS.programChanged, changes: { from: read.value.from, before: seriesText(series), after: inputText(read.value) } };
  const actionId = await recordAction(ctx.store, ctx.actor, [line], { kind: 'group', steps: [oldStep, { op: 'deleteEvent', id: createdId }], revalidate: true });
  return done({ eventId: createdId }, actionId);
}

/** PUT /club/program/:eventId: "Schimbă" from "Se aplică din" (W10). */
export async function changeProgram(ctx: GroupContext, eventId: string, body: unknown): Promise<ActionResult<{ eventId: string }>> {
  return pinged(ctx, await guarded(ctx.log, `[program] changing ${eventId}`, () => ctx.store.transaction(() => changeLocked(ctx, eventId, body))));
}

async function endLocked(ctx: GroupContext, eventId: string, from: string): Promise<ActionResult<{ eventId: string }>> {
  const found = await lockedSeries(ctx.store, eventId, from);
  if (found.ok === false) return found;
  const { e, series, group } = found.data;
  const step = await applyChange(ctx.store, e, planEnd(e, from));
  const line: Line = { subjectType: GROUP_SUBJECT, subjectId: group.id, action: P4_ACTIONS.programEnded, changes: { from, series: seriesText(series) } };
  const actionId = await recordAction(ctx.store, ctx.actor, [line], { kind: 'group', steps: [step], revalidate: true });
  return done({ eventId }, actionId);
}

/** POST /club/program/:eventId/end body `{ from }`: "Șterge programul" (W10). */
export async function endProgram(ctx: GroupContext, eventId: string, body: unknown): Promise<ActionResult<{ eventId: string }>> {
  const from = body && typeof body === 'object' ? (body as Record<string, unknown>).from : null;
  if (!isIsoDate(from)) return refuse(400, GROUP_ERRORS.invalid);
  return pinged(ctx, await guarded(ctx.log, `[program] ending ${eventId}`, () => ctx.store.transaction(() => endLocked(ctx, eventId, from))));
}

async function deleteLocked(ctx: GroupContext, eventId: string): Promise<ActionResult<{ date: string }>> {
  await ctx.store.lockEvent(eventId);
  const e = await ctx.store.event(eventId);
  const date = e?.recurrence.freq === 'none' ? e.recurrence.singleDate : null;
  if (!e || !date || !e.groupId) return refuse(409, GROUP_ERRORS.stale);
  const placed = await placeOn(ctx.store, e.groupId, date);
  if (placed.ok === false) return placed;
  await ctx.store.deleteEvent(e.id);
  const line: Line = { subjectType: GROUP_SUBJECT, subjectId: e.groupId, action: P4_ACTIONS.classDeleted, changes: { date, startTime: e.recurrence.startTime } };
  const actionId = await recordAction(ctx.store, ctx.actor, [line], { kind: 'group', steps: [{ op: 'createEvent', event: eventSnapshot(e) }], revalidate: true });
  return done({ date }, actionId);
}

/** DELETE /club/program/:eventId: "Șterge ședința" of one class (W10). */
export async function deleteClass(ctx: GroupContext, eventId: string): Promise<ActionResult<{ date: string }>> {
  return pinged(ctx, await guarded(ctx.log, `[program] deleting ${eventId}`, () => ctx.store.transaction(() => deleteLocked(ctx, eventId))));
}
```

- [ ] **Step 5: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/program.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 6: Commit**

```bash
git add src/club/groups/program.ts src/club/groups/copy.ts src/club/groups/__tests__/program.test.ts
git commit -m "feat(schedules): add, change and end a group program, delete one class, with undo"
```

---

### Task 5: Per-date "Ține / Anulează / Mută" and the parent e-mail

**Files:**
- Create: `src/club/groups/program-dates.ts`
- Test: `src/club/groups/__tests__/program-dates.test.ts`

**Interfaces:**
- Consumes: Task 2 (`readDateMode`, `wantsEmail`, `planDateMode`, `isClassDate`, `seasonOf`), Task 3 (`recipients`, `nextClass`, `schedulePayload`, `scheduleJobs`, `Change`), plan 4-1 (`recordAction`, `done`, `isPastSeason`, `seasonBounds`).
- Produces: `setDate(ctx, eventId, date, body): Promise<ActionResult<{ mode: 'keep' | 'cancel' | 'move'; date: string; emails: number }>>` (body `{ mode, newDate?, newStartTime?, reason?, notifyParents? }`). After commit: `ctx.revalidate()` when something changed, `ctx.emails(actionId)` when jobs were queued. Undo restores the exceptions and cancels the change's queued jobs (step `cancelEmails`).

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/program-dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { setDate } from '../program-dates';
import { undoAction } from '../undo-service';
import { athleteRow, event, fakeContext, member } from './fake-group-store';

const seed = () => fakeContext({
  athletes: [athleteRow({ id: 'a1', name: 'Ana', email: 'ana@example.com' }), athleteRow({ id: 'a2', name: 'Bia', email: 'Ana@example.com ' }), athleteRow({ id: 'a3', name: 'Cai', email: 'cai@example.com' })],
  memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a2', groupId: 'g-ib' }), member({ id: 'm3', athleteId: 'a3', groupId: 'g-ib' })],
  events: [event({ id: 'e1' })],
  breaks: [{ id: 'b1', label: 'Vacanța de iarnă', startDate: '2026-12-26', endDate: '2027-01-03' }],
});
const actionOf = (r: { ok: boolean; data?: { actionId: string | null } }) => (r.ok && r.data?.actionId) || '';

describe('"Anulează" (6.3, 6.5)', () => {
  it('writes anulat with the reason, a line, no e-mail when the box is not ticked', async () => {
    const { ctx, state, emailed } = seed();
    const res = await setDate(ctx, 'e1', '2026-11-14', { mode: 'cancel', reason: 'Competiție la Brașov' });
    expect(res).toMatchObject({ ok: true, data: { value: { mode: 'cancel', date: '2026-11-14', emails: 0 } } });
    expect(state.events[0].exceptions).toEqual([{ date: '2026-11-14', kind: 'anulat', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: 'Competiție la Brașov' }]);
    expect(state.history[0]).toMatchObject({ action: 'date-cancelled', changes: { date: '2026-11-14', reason: 'Competiție la Brașov', emails: 0 } });
    expect([state.jobs, emailed]).toEqual([[], []]);
  });

  it('with the box ticked: one job per address, held, keyed by the change, the next class in the payload', async () => {
    const { ctx, state, emailed } = seed();
    const res = await setDate(ctx, 'e1', '2026-11-14', { mode: 'cancel', reason: null, notifyParents: true });
    const actionId = actionOf(res);
    expect(state.jobs.map((j) => [j.recipient, j.changeKey, j.notBefore, j.status])).toEqual([
      ['ana@example.com', actionId, '2026-11-20T10:00:15.000Z', 'queued'], ['cai@example.com', actionId, '2026-11-20T10:00:15.000Z', 'queued'],
    ]);
    expect(state.jobs[0].payload).toMatchObject({ mode: 'cancel', date: '2026-11-14', startTime: '11:00', nextDate: '2026-11-15', nextStartTime: '11:00' });
    expect(state.history[0].changes.emails).toBe(2);
    expect(emailed).toEqual([actionId]);
  });

  it('the toast\'s undo restores the date and cancels every queued job of the change (W7)', async () => {
    const { ctx, state } = seed();
    const res = await setDate(ctx, 'e1', '2026-11-14', { mode: 'cancel', reason: null, notifyParents: true });
    await undoAction(ctx, { actionId: actionOf(res) });
    expect(state.events[0].exceptions).toEqual([]);
    expect(state.jobs.map((j) => j.status)).toEqual(['cancelled', 'cancelled']);
  });
});

describe('"Mută" and "Ține"', () => {
  it('moves with the series duration and a move e-mail', async () => {
    const { ctx, state } = seed();
    await setDate(ctx, 'e1', '2026-11-21', { mode: 'move', newDate: '2026-11-22', newStartTime: '12:00', reason: 'Patinoar', notifyParents: true });
    expect(state.events[0].exceptions[0]).toMatchObject({ kind: 'override', newDate: '2026-11-22', newStartTime: '12:00', newEndTime: '12:50' });
    expect(state.jobs[0].payload).toMatchObject({ mode: 'move', newDate: '2026-11-22', newStartTime: '12:00', nextDate: null });
    expect(state.history[0].action).toBe('date-moved');
  });

  it('"Ține" removes the change; on a date without one it writes nothing (decided 7)', async () => {
    const { ctx, state } = seed();
    await setDate(ctx, 'e1', '2026-11-14', { mode: 'cancel', reason: null });
    const kept = await setDate(ctx, 'e1', '2026-11-14', { mode: 'keep', notifyParents: true });
    expect(kept).toMatchObject({ ok: true, data: { value: { mode: 'keep', emails: 0 } } });
    expect(state.events[0].exceptions).toEqual([]);
    expect((await setDate(ctx, 'e1', '2026-11-15', { mode: 'keep' }))).toMatchObject({ ok: true, data: { actionId: null } });
    expect(state.jobs).toEqual([]);
  });
});

describe('refusals', () => {
  it('a date that is no class date, a break date (decided 6), an unknown mode', async () => {
    const { ctx } = seed();
    expect((await setDate(ctx, 'e1', '2026-11-16', { mode: 'cancel' })).ok).toBe(false);
    expect((await setDate(ctx, 'e1', '2026-12-26', { mode: 'cancel' })).ok).toBe(false);
    expect((await setDate(ctx, 'e1', '2026-11-14', { mode: 'later' })).ok).toBe(false);
  });

  it('locks the event row before reading it', async () => {
    const { ctx, state } = seed();
    await setDate(ctx, 'e1', '2026-11-14', { mode: 'cancel' });
    expect(state.locks).toEqual(['event:e1']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/program-dates.test.ts`
Expected: FAIL (`Cannot find module '../program-dates'`).

- [ ] **Step 3: Write `program-dates.ts`**

```ts
import { guarded, refuse, type AdminResult } from '../admin-result';
import { done, recordAction, type ActionResult, type Line } from './action-log';
import type { GroupContext } from './context';
import { GROUP_ERRORS } from './copy';
import { isIsoDate } from './dates';
import { GROUP_SUBJECT, P4_ACTIONS } from './history-lines';
import { isClassDate, planDateMode, readDateMode, seasonOf, wantsEmail, type DateMode } from './program-plan';
import { nextClass, recipients, schedulePayload, scheduleJobs, type Change } from './schedule-mail';
import { isPastSeason } from './season-pick';
import { seasonBounds } from './series';
import type { EventRecord, ExceptionRow, GroupRecord, GroupStore, SeasonRecord } from './types';
import type { UndoStep } from './undo';

/** Per date "Ține / Anulează / Mută" (spec 6.3, 6.5, W7, W12, W13). */
type DateAnswer = { mode: DateMode['mode']; date: string; emails: number };
type Spot = { e: EventRecord; group: GroupRecord; season: SeasonRecord };

const inBreak = (store: GroupStore, date: string): Promise<boolean> => store.breaks().then((list) => list.some((b) => b.startDate <= date && date <= b.endDate));

/** The locked event's group, the (not past) season of the date; the date must be a class date and not in a break. */
async function spotOf(store: GroupStore, eventId: string, date: string): Promise<AdminResult<Spot>> {
  await store.lockEvent(eventId);
  const e = await store.event(eventId);
  const group = e?.groupId ? await store.group(e.groupId) : null;
  const seasons = await store.seasons();
  const season = seasonOf(seasons, date);
  if (!e || !group || !season || isPastSeason(season, seasons)) return refuse(409, GROUP_ERRORS.stale);
  if (!isClassDate(e, date) || (await inBreak(store, date))) return refuse(400, GROUP_ERRORS.invalid);
  return { ok: true, data: { e, group, season } };
}

function dateLine(groupId: string, date: string, m: DateMode, emails: number): Line {
  const base = { subjectType: GROUP_SUBJECT, subjectId: groupId };
  if (m.mode === 'keep') return { ...base, action: P4_ACTIONS.dateKept, changes: { date } };
  if (m.mode === 'cancel') return { ...base, action: P4_ACTIONS.dateCancelled, changes: { date, reason: m.reason, emails } };
  return { ...base, action: P4_ACTIONS.dateMoved, changes: { date, newDate: m.newDate, newStartTime: m.newStartTime, reason: m.reason, emails } };
}

const same = (a: ExceptionRow[], b: ExceptionRow[]): boolean => JSON.stringify(a) === JSON.stringify(b);

async function addressesOf(store: GroupStore, spot: Spot): Promise<string[]> {
  const [athletes, memberships] = await Promise.all([store.athletes(), store.memberships({ groupId: spot.group.id, seasonId: spot.season.id })]);
  return recipients(athletes, memberships, spot.group.id, spot.season.id);
}

async function queueEmails(ctx: GroupContext, spot: Spot, date: string, change: Change, addresses: string[], actionId: string): Promise<void> {
  const [events, breaks, fresh] = await Promise.all([ctx.store.events({ groupId: spot.group.id }), ctx.store.breaks(), ctx.store.event(spot.e.id)]);
  const next = change.mode === 'cancel' ? nextClass(events, breaks, spot.group.id, date, seasonBounds(spot.season).end) : null;
  const payload = schedulePayload(spot.group.name, fresh ?? spot.e, date, change, next);
  await ctx.store.createEmailJobs(scheduleJobs(addresses, payload, spot.group.id, actionId, ctx.now()));
}

async function dateLocked(ctx: GroupContext, eventId: string, date: string, m: DateMode, notify: boolean): Promise<ActionResult<DateAnswer>> {
  const found = await spotOf(ctx.store, eventId, date);
  if (found.ok === false) return found;
  const spot = found.data;
  const exceptions = planDateMode(spot.e, date, m);
  if (!exceptions) return refuse(400, GROUP_ERRORS.invalid);
  if (same(spot.e.exceptions, exceptions)) return done({ mode: m.mode, date, emails: 0 }, null);
  const change: Change | null = m.mode === 'keep' ? null : m;
  const addresses = change && notify ? await addressesOf(ctx.store, spot) : [];
  await ctx.store.updateEvent(spot.e.id, { exceptions });
  const steps: UndoStep[] = [{ op: 'setEvent', id: spot.e.id, recurrence: spot.e.recurrence, exceptions: spot.e.exceptions }];
  if (addresses.length) steps.push({ op: 'cancelEmails' });
  const actionId = await recordAction(ctx.store, ctx.actor, [dateLine(spot.group.id, date, m, addresses.length)], { kind: 'group', steps, revalidate: true });
  if (change && addresses.length) await queueEmails(ctx, spot, date, change, addresses, actionId);
  return done({ mode: m.mode, date, emails: addresses.length }, actionId);
}

/** PUT /club/program/:eventId/dates/:date body `{ mode, newDate, newStartTime, reason, notifyParents }`. */
export async function setDate(ctx: GroupContext, eventId: string, date: string, body: unknown): Promise<ActionResult<DateAnswer>> {
  const m = readDateMode(body);
  if (!m || !isIsoDate(date)) return refuse(400, GROUP_ERRORS.invalid);
  const res = await guarded(ctx.log, `[program] date ${date} of ${eventId}`, () => ctx.store.transaction(() => dateLocked(ctx, eventId, date, m, wantsEmail(body))));
  if (res.ok === true && res.data.actionId) {
    ctx.revalidate();
    if (res.data.value.emails > 0) ctx.emails(res.data.actionId);
  }
  return res;
}
```

- [ ] **Step 4: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/program-dates.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/groups/program-dates.ts src/club/groups/__tests__/program-dates.test.ts
git commit -m "feat(schedules): keep, cancel or move one date, opt-in parent e-mail cancelled by the undo"
```

---

### Task 6: "Pauze" (breaks)

**Files:**
- Create: `src/club/groups/breaks.ts`
- Test: `src/club/groups/__tests__/breaks.test.ts`

**Interfaces:**
- Consumes: plan 4-1 (`recordLines`, `BREAK_SUBJECT`, `P4_ACTIONS`, `GROUP_ERRORS`), Task 2 (`SCHEDULE_ERRORS`), `isIsoDate`, `changedFields` (`src/club/admin-result.ts`).
- Produces: `BreakInput`, `readBreakInput(body)`, `listBreaks(store): Promise<BreakRecord[]>` (sorted by "De la"), `createBreak(ctx, body): Promise<AdminResult<BreakRecord>>`, `updateBreak(ctx, id, body): Promise<AdminResult<{ changed: boolean }>>`, `deleteBreak(ctx, id): Promise<AdminResult<{ label: string }>>`. No undo (spec 7.1 toasts have no "Anulează"); every write records a break line and pings the website.

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/breaks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createBreak, deleteBreak, listBreaks, readBreakInput, updateBreak } from '../breaks';
import { fakeContext } from './fake-group-store';

const BODY = { label: ' Vacanța de iarnă ', startDate: '2026-12-20', endDate: '2027-01-06' };

describe('the break window (7.1)', () => {
  it('reads Nume, De la, Până la; the end before the start is refused with the spec text', () => {
    expect(readBreakInput(BODY)).toEqual({ ok: true, value: { label: 'Vacanța de iarnă', startDate: '2026-12-20', endDate: '2027-01-06' } });
    expect(readBreakInput({ ...BODY, endDate: '2026-12-19' })).toEqual({ ok: false, error: 'Data de sfârșit trebuie să fie după data de început.' });
    expect(readBreakInput({ ...BODY, endDate: '2026-12-20' }).ok).toBe(true);
    expect(readBreakInput({ ...BODY, label: '' }).ok).toBe(false);
  });
});

describe('Pauze writes', () => {
  it('create, edit and delete, each with its line and a website ping', async () => {
    const { ctx, state, revalidated } = fakeContext();
    const created = await createBreak(ctx, BODY);
    const id = created.ok ? created.data.id : '';
    expect(await updateBreak(ctx, id, { ...BODY, endDate: '2027-01-08' })).toEqual({ ok: true, data: { changed: true } });
    expect(await updateBreak(ctx, id, { ...BODY, endDate: '2027-01-08' })).toEqual({ ok: true, data: { changed: false } });
    expect(await deleteBreak(ctx, id)).toEqual({ ok: true, data: { label: 'Vacanța de iarnă' } });
    expect(state.history.map((h) => [h.subjectType, h.action])).toEqual([['calendar-blackout', 'break-added'], ['calendar-blackout', 'break-updated'], ['calendar-blackout', 'break-deleted']]);
    expect(state.history[1].changes).toEqual({ fields: { endDate: { from: '2027-01-06', to: '2027-01-08' } } });
    expect(revalidated()).toBe(3);
  });

  it('lists by De la', async () => {
    const { store } = fakeContext({ breaks: [{ id: 'b2', label: 'Paște', startDate: '2027-04-03', endDate: '2027-04-12' }, { id: 'b1', label: 'Iarnă', startDate: '2026-12-20', endDate: '2027-01-06' }] });
    expect((await listBreaks(store)).map((b) => b.id)).toEqual(['b1', 'b2']);
  });

  it('an unknown break is 404', async () => {
    const { ctx } = fakeContext();
    expect((await deleteBreak(ctx, 'nope')).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/breaks.test.ts`
Expected: FAIL (`Cannot find module '../breaks'`).

- [ ] **Step 3: Write `breaks.ts`**

```ts
import { changedFields, guarded, refuse, type AdminResult } from '../admin-result';
import { recordLines } from './action-log';
import type { GroupContext } from './context';
import { GROUP_ERRORS, SCHEDULE_ERRORS } from './copy';
import { isIsoDate } from './dates';
import { BREAK_SUBJECT, P4_ACTIONS } from './history-lines';
import type { BreakRecord, GroupStore } from './types';

/** "Pauze" (spec 3.5, 7.1, W13): Nume, De la, Până la; no undo; every write pings the website. */
export type BreakInput = { label: string; startDate: string; endDate: string };
type Read = { ok: true; value: BreakInput } | { ok: false; error: string };
const KEYS = ['label', 'startDate', 'endDate'] as const;

export function readBreakInput(body: unknown): Read {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const label = typeof b.label === 'string' ? b.label.trim().slice(0, 120) : '';
  if (!label) return { ok: false, error: GROUP_ERRORS.nameRequired };
  if (!isIsoDate(b.startDate) || !isIsoDate(b.endDate)) return { ok: false, error: GROUP_ERRORS.invalid };
  if (b.endDate < b.startDate) return { ok: false, error: SCHEDULE_ERRORS.endBeforeStart };
  return { ok: true, value: { label, startDate: b.startDate, endDate: b.endDate } };
}

export const listBreaks = async (store: GroupStore): Promise<BreakRecord[]> =>
  [...(await store.breaks())].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.label.localeCompare(b.label, 'ro'));

const line = (id: string, action: string, changes: Record<string, unknown>) => ({ subjectType: BREAK_SUBJECT, subjectId: id, action, changes });

function pinged<T>(ctx: GroupContext, res: AdminResult<T>): AdminResult<T> {
  if (res.ok === true) ctx.revalidate();
  return res;
}

export async function createBreak(ctx: GroupContext, body: unknown): Promise<AdminResult<BreakRecord>> {
  const read = readBreakInput(body);
  if (read.ok === false) return refuse(400, read.error);
  const res = await guarded(ctx.log, '[breaks] adding', () => ctx.store.transaction(async () => {
    const id = await ctx.store.createBreak(read.value);
    await recordLines(ctx.store, ctx.actor, [line(id, P4_ACTIONS.breakAdded, { ...read.value })]);
    return { ok: true as const, data: { id, ...read.value } };
  }));
  return pinged(ctx, res);
}

async function updateInTransaction(ctx: GroupContext, id: string, input: BreakInput): Promise<AdminResult<{ changed: boolean }>> {
  const current = (await ctx.store.breaks()).find((b) => b.id === id);
  if (!current) return refuse(404, GROUP_ERRORS.notFound);
  const fields = changedFields<BreakInput>(KEYS, current, input);
  if (!Object.keys(fields).length) return { ok: true, data: { changed: false } };
  await ctx.store.updateBreak(id, input);
  await recordLines(ctx.store, ctx.actor, [line(id, P4_ACTIONS.breakUpdated, { fields })]);
  return { ok: true, data: { changed: true } };
}

export async function updateBreak(ctx: GroupContext, id: string, body: unknown): Promise<AdminResult<{ changed: boolean }>> {
  const read = readBreakInput(body);
  if (read.ok === false) return refuse(400, read.error);
  const res = await guarded(ctx.log, `[breaks] editing ${id}`, () => ctx.store.transaction(() => updateInTransaction(ctx, id, read.value)));
  return res.ok === true && res.data.changed ? pinged(ctx, res) : res;
}

export async function deleteBreak(ctx: GroupContext, id: string): Promise<AdminResult<{ label: string }>> {
  const res = await guarded(ctx.log, `[breaks] deleting ${id}`, () => ctx.store.transaction(async () => {
    const current = (await ctx.store.breaks()).find((b) => b.id === id);
    if (!current) return refuse(404, GROUP_ERRORS.notFound);
    await ctx.store.deleteBreak(id);
    await recordLines(ctx.store, ctx.actor, [line(id, P4_ACTIONS.breakDeleted, { label: current.label })]);
    return { ok: true as const, data: { label: current.label } };
  }));
  return pinged(ctx, res);
}
```

- [ ] **Step 4: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/breaks.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/groups/breaks.ts src/club/groups/__tests__/breaks.test.ts
git commit -m "feat(schedules): Pauze, each write in Istoric and pinging the website"
```

---
### Task 7: Reads, routes `07-schedule.ts`, the public reads and the old calendar routes

**Files:**
- Create: `src/club/groups/occurrences.ts`, `src/club/groups/program-read.ts`, `src/club/groups/public-schedule.ts`
- Create: `src/api/club/routes/07-schedule.ts`, `src/api/club/controllers/schedule.ts`
- Modify: `src/api/calendar-event/controllers/calendar-event.ts` (public occurrences through `occurrences.ts`; group events refused)
- Test: `src/club/groups/__tests__/schedule-reads.test.ts`, `src/club/groups/__tests__/schedule-routes.test.ts`

**Interfaces:**
- Consumes: Tasks 1 to 6; plan 4-1 (`currentSeries`, `seriesText`, `programLine`, `shortDate`, `currentSeason`, `pickSeason`, `seasonRef`, `orderedSections`, `byGroupOrder`, `respondAction`, `queryText`, `todayIso`, `strapiGroupStore`, `groupContext`).
- Produces:

| Method | Path | Handler | Answer `data` |
|---|---|---|---|
| GET | `/club/schedule` (public) | `schedule.publicSchedule` | `PublicSchedule` (`Cache-Control: public, max-age=60`) |
| GET | `/club/calendar/occurrences` | `schedule.occurrences` | `Occurrence[]` (+ `blackouts`), `?from&to[&group=<documentId>]`, 92-day cap |
| GET | `/club/breaks` | `schedule.breaks` | `BreakRecord[]` |
| POST | `/club/breaks` | `schedule.createBreak` | `BreakRecord` |
| PUT | `/club/breaks/:documentId` | `schedule.updateBreak` | `{ changed }` |
| DELETE | `/club/breaks/:documentId` | `schedule.deleteBreak` | `{ label }` |
| GET | `/club/groups/:documentId/program` | `schedule.program` | `GroupProgram` (`?season=`) |
| POST | `/club/groups/:documentId/program` | `schedule.addProgram` | `{ eventId, date }` + undo |
| PUT | `/club/program/:eventId` | `schedule.changeProgram` | `{ eventId }` + undo |
| POST | `/club/program/:eventId/end` | `schedule.endProgram` | `{ eventId }` + undo |
| DELETE | `/club/program/:eventId` | `schedule.deleteClass` | `{ date }` + undo |
| PUT | `/club/program/:eventId/dates/:date` | `schedule.setDate` | `{ mode, date, emails }` + undo |

  - `occurrences.ts`: `readRange(query)`, `CalendarWindow`, `calendarRows(strapi)`, `publicWindow(window, range)`, `adminWindow(window, range, groupId)`, `PublicOccurrence`, `eventGroupName(strapi, documentId)`, `groupNameOf(strapi, groupDocumentId)`.
  - `program-read.ts`: `ProgramRow = { eventId, freq, days, weekOfMonth, startTime, durationMin, from, to, text, fromText, nextDate }`, `GroupProgram = { season, series: ProgramRow[] }`, `programRows(events, groupId, season, today)`, `readGroupProgram(store, groupId, label, today)`.
  - `public-schedule.ts`: `ScheduleSlot = { start, end, groups: string[] }`, `PublicSchedule = { section: { name, slug }; slots: ScheduleSlot[] }[]`, `scheduleSlots(groups, events, season, today)`, `readPublicSchedule(store, today)`.
  - `/api/calendar/occurrences` keeps its address, its 92-day cap and its shape, minus non-public groups, plus `groupName`, `originalDate`, `originalStartTime`.
  - `/api/calendar/events` (create, update, delete) answers 409 "Evenimentul aparține grupei <grupă>. Se schimbă din pagina grupei." for a group event (W18, decided 10).

- [ ] **Step 1: Write the failing tests**

`src/club/groups/__tests__/schedule-reads.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CalendarEventRow } from '../../../api/calendar-event/services/expand';
import { adminWindow, publicWindow, readRange } from '../occurrences';
import { readGroupProgram } from '../program-read';
import { readPublicSchedule, scheduleSlots } from '../public-schedule';
import { G_GROUPS, G_SEASONS, event, fakeGroupStore } from './fake-group-store';

const TODAY = '2026-11-20';
const at = (startTime: string, endTime: string, days: ('sat' | 'sun' | 'tue')[] = ['sat', 'sun']) =>
  ({ freq: 'weekly' as const, days, weekOfMonth: null, startTime, endTime, singleDate: null, seasonStart: '2026-10-04', seasonEnd: '2027-05-31' });

describe('notebook slots (8.3, 9.1, W20)', () => {
  it('groups public, active school groups by start and end, in group order, once each', () => {
    const events = [
      event({ id: 'e1', groupId: 'g-is', recurrence: at('10:00', '10:50') }), event({ id: 'e2', groupId: 'g-pp', recurrence: at('10:00', '10:50') }),
      event({ id: 'e3', groupId: 'g-ib', recurrence: at('11:00', '11:50') }), event({ id: 'e4', groupId: 'g-ib', recurrence: { ...at('11:00', '11:50'), seasonEnd: '2026-11-01' } }),
    ];
    expect(scheduleSlots(G_GROUPS.filter((g) => g.sectionId === 'afi'), events, G_SEASONS[1], TODAY)).toEqual([
      { start: '10:00', end: '10:50', groups: ['Primii Pași', 'Intermediari Silver'] }, { start: '11:00', end: '11:50', groups: ['Intermediari Bronze'] },
    ]);
  });

  it('reads the current season; a non-public or inactive group is left out; Club never', async () => {
    const groups = G_GROUPS.map((g) => (g.id === 'g-is' ? { ...g, programPublic: false } : g));
    const store = fakeGroupStore({ groups, events: [event({ id: 'e1', groupId: 'g-is' }), event({ id: 'e2', groupId: 'g-pp' }), event({ id: 'e3', groupId: 'g-av', type: 'curs' })] }).store;
    expect(await readPublicSchedule(store, TODAY)).toEqual([
      { section: { name: 'Școala de Patinaj - AFI Cotroceni', slug: 'scoala-afi' }, slots: [{ start: '11:00', end: '11:50', groups: ['Primii Pași'] }] },
    ]);
  });
});

describe('Program obișnuit rows (6.3)', () => {
  it('texts, from, and the next class date as the default of "Se aplică din"', async () => {
    const store = fakeGroupStore({ events: [event({ id: 'e1' })] }).store;
    const program = await readGroupProgram(store, 'g-ib', null, TODAY);
    expect(program?.series).toEqual([{
      eventId: 'e1', freq: 'weekly', days: ['sat', 'sun'], weekOfMonth: null, startTime: '11:00', durationMin: 50, from: '2026-10-04', to: '2027-05-31',
      text: 'Sâ și Du, 11:00, 50 min', fromText: '4 oct 2026', nextDate: '2026-11-21',
    }]);
  });
});

describe('occurrence windows (8.2, 8.3)', () => {
  const rows: CalendarEventRow[] = [
    { id: 1, documentId: 'e1', title: 'Intermediari Bronze', type: 'scoala', recurrence: { freq: 'weekly', sat: true, startTime: '11:00:00.000', endTime: '11:50:00.000', seasonStart: '2026-10-03', seasonEnd: '2027-05-30' }, group: { documentId: 'g-ib', name: 'Intermediari Bronze', programPublic: false, active: true } },
    { id: 2, documentId: 'e2', title: 'Avansați', type: 'curs', recurrence: { freq: 'weekly', sat: true, startTime: '18:00:00.000', endTime: '19:30:00.000', seasonStart: '2026-10-03', seasonEnd: '2027-05-30' }, group: { documentId: 'g-av', name: 'Avansați', programPublic: true, active: true } },
  ];
  const range = { from: '2026-11-14', to: '2026-11-14' };

  it('the public window drops a non-public group and never shows a group id', () => {
    const out = publicWindow({ events: rows, blackouts: [] }, range);
    expect(out.data.map((o) => o.groupName)).toEqual(['Avansați']);
    expect(Object.keys(out.data[0])).not.toContain('groupId');
  });

  it('the admin window keeps every group, or one group', () => {
    expect(adminWindow({ events: rows, blackouts: [] }, range, null).data.map((o) => o.groupId)).toEqual(['g-ib', 'g-av']);
    expect(adminWindow({ events: rows, blackouts: [] }, range, 'g-av').data.map((o) => o.groupId)).toEqual(['g-av']);
  });

  it('keeps the 92-day cap and the date format', () => {
    expect(readRange({ from: '2026-11-01', to: '2027-02-15' })).toEqual({ ok: false, error: 'range too large (max 92 days)' });
    expect(readRange({ from: 'x', to: '2026-11-30' }).ok).toBe(false);
    expect(readRange({ from: '2026-11-01', to: '2026-11-30' })).toEqual({ ok: true, value: { from: '2026-11-01', to: '2026-11-30' } });
  });
});
```

`src/club/groups/__tests__/schedule-routes.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import schedule from '../../../api/club/controllers/schedule';
import scheduleRoutes from '../../../api/club/routes/07-schedule';

const routes = scheduleRoutes.routes;
const ADMIN = { auth: false, policies: ['global::is-admin'], middlewares: [] };

describe('07-schedule routes (8.2, 8.3)', () => {
  it('are admin-only, except the public notebook read', () => {
    for (const r of routes) expect(r.config, r.path).toEqual(r.path === '/club/schedule' ? { auth: false, policies: [], middlewares: [] } : ADMIN);
  });

  it('point at handlers that exist', () => {
    for (const r of routes) expect(typeof (schedule as Record<string, unknown>)[r.handler.split('.')[1]], r.handler).toBe('function');
  });

  it('declare fixed paths before parameter paths', () => {
    const paths = routes.map((r) => r.path);
    expect(paths.indexOf('/club/breaks')).toBeLessThan(paths.indexOf('/club/breaks/:documentId'));
  });

  it('the old calendar routes refuse group events and the public occurrences filter them', () => {
    const code = readFileSync(join(__dirname, '..', '..', '..', 'api', 'calendar-event', 'controllers', 'calendar-event.ts'), 'utf8');
    expect(code).toContain('SCHEDULE_ERRORS.groupEvent');
    expect(code).toContain('publicWindow');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/groups/__tests__/schedule-reads.test.ts src/club/groups/__tests__/schedule-routes.test.ts`
Expected: FAIL (`Cannot find module '../occurrences'`).

- [ ] **Step 3: Write `occurrences.ts`**

```ts
import type { Core } from '@strapi/strapi';
import { expandOccurrences, publicEvents, type BlackoutRow, type CalendarEventRow, type Occurrence } from '../../api/calendar-event/services/expand';

/** Occurrence reads (spec 8.2, 8.3): rows from Strapi, the expansion, then the public or the admin view. */
const EVENT = 'api::calendar-event.calendar-event' as const;
const BLACKOUT = 'api::calendar-blackout.calendar-blackout' as const;
const GROUP = 'api::group.group' as const;
const DAY = 86_400_000;
const MAX_DAYS = 92;

export type RangeQuery = { from: string; to: string };
export type CalendarWindow = { events: CalendarEventRow[]; blackouts: BlackoutRow[] };
export type PublicOccurrence = Omit<Occurrence, 'groupId'>;

const isYMD = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function readRange(q: Record<string, unknown>): { ok: true; value: RangeQuery } | { ok: false; error: string } {
  const { from, to } = q;
  if (!isYMD(from) || !isYMD(to)) return { ok: false, error: 'from and to must be YYYY-MM-DD' };
  if (new Date(to).getTime() - new Date(from).getTime() > MAX_DAYS * DAY) return { ok: false, error: 'range too large (max 92 days)' };
  return { ok: true, value: { from, to } };
}

export async function calendarRows(strapi: Core.Strapi): Promise<CalendarWindow> {
  const events = (await strapi.documents(EVENT).findMany({ populate: ['recurrence', 'exceptions', 'group'], limit: 1000 })) as unknown as CalendarEventRow[];
  const blackouts = (await strapi.documents(BLACKOUT).findMany({ limit: 1000 })) as unknown as BlackoutRow[];
  return { events, blackouts };
}

const blackoutView = (b: BlackoutRow): BlackoutRow => ({ label: b.label, startDate: b.startDate, endDate: b.endDate });
const publicOccurrence = (o: Occurrence): PublicOccurrence => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'groupId')) as PublicOccurrence;

/** Public: no group whose program is not public or that is inactive; `groupName`, never `groupId` (decided 9). */
export function publicWindow(w: CalendarWindow, r: RangeQuery): { data: PublicOccurrence[]; blackouts: BlackoutRow[] } {
  return { data: expandOccurrences(publicEvents(w.events), w.blackouts, r.from, r.to).map(publicOccurrence), blackouts: w.blackouts.map(blackoutView) };
}

/** Admin: every group (non-public ones too); `group=<documentId>` keeps one group's events (the Program tab). */
export function adminWindow(w: CalendarWindow, r: RangeQuery, groupId: string | null): { data: Occurrence[]; blackouts: BlackoutRow[] } {
  const events = groupId ? w.events.filter((e) => e.group?.documentId === groupId) : w.events;
  return { data: expandOccurrences(events, w.blackouts, r.from, r.to), blackouts: w.blackouts.map(blackoutView) };
}

/** The name of the group a calendar event belongs to; null for an event of no group (or an unknown one). */
export async function eventGroupName(strapi: Core.Strapi, documentId: string): Promise<string | null> {
  const e = (await strapi.documents(EVENT).findOne({ documentId, populate: ['group'] })) as unknown as { group?: { name?: string } | null } | null;
  return e?.group?.name ?? null;
}

export async function groupNameOf(strapi: Core.Strapi, groupDocumentId: string): Promise<string | null> {
  const g = await strapi.documents(GROUP).findOne({ documentId: groupDocumentId, fields: ['name'] });
  return g ? String(g.name) : null;
}
```

- [ ] **Step 4: Write `program-read.ts` and `public-schedule.ts`**

`src/club/groups/program-read.ts`:

```ts
import type { SeasonRef } from './api-types';
import { shortDate } from './dates';
import { classDates } from './program-plan';
import { programLine } from './program-text';
import { pickSeason, seasonRef } from './season-pick';
import { currentSeries, seriesText, type RepeatFreq } from './series';
import type { DayKey, EventRecord, GroupStore, SeasonRecord, WeekOfMonth } from './types';

/** "Program obișnuit" (6.3): one row per series of the season still running; `nextDate` is the default "Se aplică din" of "Schimbă" (decided 11). */
export type ProgramRow = {
  eventId: string; freq: RepeatFreq; days: DayKey[]; weekOfMonth: WeekOfMonth | null; startTime: string; durationMin: number;
  from: string; to: string; text: string; fromText: string; nextDate: string | null;
};
export type GroupProgram = { season: SeasonRef | null; series: ProgramRow[] };

export function programRows(events: EventRecord[], groupId: string, season: SeasonRecord, today: string): ProgramRow[] {
  return currentSeries(events, groupId, season, today).map((s) => {
    const e = events.find((x) => x.id === s.eventId);
    const start = today > s.from ? today : s.from;
    return {
      eventId: s.eventId, freq: s.freq, days: s.days, weekOfMonth: s.weekOfMonth, startTime: s.startTime, durationMin: s.durationMin, from: s.from, to: s.to,
      text: programLine(seriesText(s)), fromText: shortDate(s.from), nextDate: e ? classDates(e, start, s.to)[0] ?? null : null,
    };
  });
}

export async function readGroupProgram(store: GroupStore, groupId: string, label: string | null, today: string): Promise<GroupProgram | null> {
  const [group, seasons, events] = await Promise.all([store.group(groupId), store.seasons(), store.events({ groupId })]);
  if (!group) return null;
  const season = pickSeason(seasons, label);
  return { season: season ? seasonRef(season, seasons) : null, series: season ? programRows(events, groupId, season, today) : [] };
}
```

`src/club/groups/public-schedule.ts`:

```ts
import { currentSeason } from './season-pick';
import { byGroupOrder, orderedSections } from './sections';
import { currentSeries } from './series';
import type { EventRecord, GroupRecord, GroupStore, SeasonRecord } from './types';

/** GET /api/club/schedule (spec 8.3, 9.1, W20): the notebook data, public and active school groups only, no private data. */
export type ScheduleSlot = { start: string; end: string; groups: string[] };
export type PublicSchedule = { section: { name: string; slug: string }; slots: ScheduleSlot[] }[];

export function scheduleSlots(groups: GroupRecord[], events: EventRecord[], season: SeasonRecord, today: string): ScheduleSlot[] {
  const slots = new Map<string, ScheduleSlot>();
  for (const g of [...groups].sort(byGroupOrder)) {
    for (const s of currentSeries(events, g.id, season, today)) {
      const slot = slots.get(`${s.startTime}-${s.endTime}`) ?? { start: s.startTime, end: s.endTime, groups: [] };
      if (!slot.groups.includes(g.name)) slot.groups.push(g.name);
      slots.set(`${s.startTime}-${s.endTime}`, slot);
    }
  }
  return [...slots.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

export async function readPublicSchedule(store: GroupStore, today: string): Promise<PublicSchedule> {
  const [seasons, sections, groups, events] = await Promise.all([store.seasons(), store.sections(), store.groups(), store.events()]);
  const season = currentSeason(seasons);
  if (!season) return [];
  return orderedSections(sections)
    .filter((s) => s.kind === 'school' && s.publicPage)
    .map((s) => ({
      section: { name: s.name, slug: s.slug },
      slots: scheduleSlots(groups.filter((g) => g.sectionId === s.id && g.active && g.programPublic), events, season, today),
    }));
}
```

- [ ] **Step 5: Routes and controller**

`src/api/club/routes/07-schedule.ts`:

```ts
/**
 * Group programs, dates, breaks and occurrences (spec 8.2) plus the public notebook read (8.3).
 * Admin routes: auth off, `global::is-admin`. Fixed paths before parameter paths.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };
const open = { auth: false, policies: [], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/schedule', handler: 'schedule.publicSchedule', config: open },
    { method: 'GET', path: '/club/calendar/occurrences', handler: 'schedule.occurrences', config: adminGuard },
    { method: 'GET', path: '/club/breaks', handler: 'schedule.breaks', config: adminGuard },
    { method: 'POST', path: '/club/breaks', handler: 'schedule.createBreak', config: adminGuard },
    { method: 'PUT', path: '/club/breaks/:documentId', handler: 'schedule.updateBreak', config: adminGuard },
    { method: 'DELETE', path: '/club/breaks/:documentId', handler: 'schedule.deleteBreak', config: adminGuard },
    { method: 'GET', path: '/club/groups/:documentId/program', handler: 'schedule.program', config: adminGuard },
    { method: 'POST', path: '/club/groups/:documentId/program', handler: 'schedule.addProgram', config: adminGuard },
    { method: 'PUT', path: '/club/program/:eventId', handler: 'schedule.changeProgram', config: adminGuard },
    { method: 'POST', path: '/club/program/:eventId/end', handler: 'schedule.endProgram', config: adminGuard },
    { method: 'DELETE', path: '/club/program/:eventId', handler: 'schedule.deleteClass', config: adminGuard },
    { method: 'PUT', path: '/club/program/:eventId/dates/:date', handler: 'schedule.setDate', config: adminGuard },
  ],
};
```

`src/api/club/controllers/schedule.ts`:

```ts
import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { createBreak, deleteBreak, listBreaks, updateBreak } from '../../../club/groups/breaks';
import { groupContext } from '../../../club/groups/context';
import { GROUP_ERRORS } from '../../../club/groups/copy';
import { queryText, respondAction, todayIso } from '../../../club/groups/http';
import { adminWindow, calendarRows, readRange } from '../../../club/groups/occurrences';
import { addProgram, changeProgram, deleteClass, endProgram } from '../../../club/groups/program';
import { setDate } from '../../../club/groups/program-dates';
import { readGroupProgram } from '../../../club/groups/program-read';
import { readPublicSchedule } from '../../../club/groups/public-schedule';
import { strapiGroupStore } from '../../../club/groups/strapi-store';

type PublicCtx = AdminCtx & { set: (field: string, value: string) => void };
const param = (ctx: AdminCtx, key: string): string => ctx.params[key] ?? '';
const store = () => strapiGroupStore(strapi);

/** Group programs, breaks, occurrences (routes/07-schedule.ts). */
export default {
  async publicSchedule(ctx: PublicCtx) {
    ctx.set('Cache-Control', 'public, max-age=60');
    ctx.body = { data: await readPublicSchedule(store(), todayIso()) };
  },

  async occurrences(ctx: AdminCtx) {
    const range = readRange(ctx.query);
    if (range.ok === false) return refuseWith(ctx, 400, range.error);
    ctx.body = adminWindow(await calendarRows(strapi), range.value, queryText(ctx.query.group));
  },

  async breaks(ctx: AdminCtx) {
    ctx.body = { data: await listBreaks(store()) };
  },

  async createBreak(ctx: AdminCtx) {
    respond(ctx, await createBreak(await groupContext(strapi, ctx), ctx.request.body));
  },

  async updateBreak(ctx: AdminCtx) {
    respond(ctx, await updateBreak(await groupContext(strapi, ctx), param(ctx, 'documentId'), ctx.request.body));
  },

  async deleteBreak(ctx: AdminCtx) {
    respond(ctx, await deleteBreak(await groupContext(strapi, ctx), param(ctx, 'documentId')));
  },

  async program(ctx: AdminCtx) {
    const program = await readGroupProgram(store(), param(ctx, 'documentId'), queryText(ctx.query.season), todayIso());
    if (!program) return refuseWith(ctx, 404, GROUP_ERRORS.notFound);
    ctx.body = { data: program };
  },

  async addProgram(ctx: AdminCtx) {
    respondAction(ctx, await addProgram(await groupContext(strapi, ctx), param(ctx, 'documentId'), ctx.request.body));
  },

  async changeProgram(ctx: AdminCtx) {
    respondAction(ctx, await changeProgram(await groupContext(strapi, ctx), param(ctx, 'eventId'), ctx.request.body));
  },

  async endProgram(ctx: AdminCtx) {
    respondAction(ctx, await endProgram(await groupContext(strapi, ctx), param(ctx, 'eventId'), ctx.request.body));
  },

  async deleteClass(ctx: AdminCtx) {
    respondAction(ctx, await deleteClass(await groupContext(strapi, ctx), param(ctx, 'eventId')));
  },

  async setDate(ctx: AdminCtx) {
    respondAction(ctx, await setDate(await groupContext(strapi, ctx), param(ctx, 'eventId'), param(ctx, 'date'), ctx.request.body));
  },
};
```

- [ ] **Step 6: The old calendar controller**

In `src/api/calendar-event/controllers/calendar-event.ts`:

1. Add the imports:

```ts
import { refuseWith } from '../../../club/admin-http';
import { SCHEDULE_ERRORS } from '../../../club/groups/copy';
import { calendarRows, eventGroupName, groupNameOf, publicWindow, readRange } from '../../../club/groups/occurrences';
```

2. Replace the body of `occurrences(ctx)` with:

```ts
    const range = readRange(ctx.query);
    if (range.ok === false) return ctx.badRequest(range.error);
    ctx.body = publicWindow(await calendarRows(strapi), range.value);
```

and delete the now unused `expandOccurrences`, `CalendarEventRow`, `BlackoutRow`, `DAY` and `isYMD` imports and constants.

3. At the start of `updateEvent` and `deleteEvent`, after reading `documentId`:

```ts
    const owner = await eventGroupName(strapi, documentId);
    if (owner) return refuseWith(ctx, 409, SCHEDULE_ERRORS.groupEvent(owner));
```

4. In `createEvent`, after reading `data`:

```ts
    const groupId = typeof data?.group === 'string' ? data.group : null;
    const owner = groupId ? await groupNameOf(strapi, groupId) : null;
    if (owner) return refuseWith(ctx, 409, SCHEDULE_ERRORS.groupEvent(owner));
```

- [ ] **Step 7: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/schedule-reads.test.ts src/club/groups/__tests__/schedule-routes.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 8: Commit**

```bash
git add src/club/groups/occurrences.ts src/club/groups/program-read.ts src/club/groups/public-schedule.ts src/api/club/routes/07-schedule.ts src/api/club/controllers/schedule.ts src/api/calendar-event/controllers/calendar-event.ts src/club/groups/__tests__/schedule-reads.test.ts src/club/groups/__tests__/schedule-routes.test.ts
git commit -m "feat(schedules): group program, breaks and occurrences routes, public notebook read, group events closed to the old calendar routes"
```

---

### Task 8: Boot check on a throwaway Postgres

**Files:** none in the repo. Temporary files in `${TMPDIR:-/tmp}/es42` (removed at the end).

**Interfaces:**
- Consumes: everything above, `scripts/fixtures/phase4-shape.js` (plan 4-1 Task 12).
- Proves (spec 12): a group series and its dates on the admin route; the public route without a non-public group; `/api/club/schedule` slots; a cancelled date with e-mail jobs queued (held 15 s, one per address, `changeKey` = the action id) and the undo cancelling them; a held job left queued without Brevo (no real e-mail); "Mută" with the original date; "Schimbă" carrying a changed date; "Șterge programul"; one class added and deleted; a break cancelling group and old Școala dates with its name, a competition untouched; the old routes refusing a group event; `/api/calendar-events` 404.

Container `es42-pg` on 127.0.0.1:55442, Strapi on 1362. Never 1337, 1340, 3010 or 5432. Run from the worktree root.

- [ ] **Step 1: Full checks**

```bash
REPO=$(git rev-parse --show-toplevel); cd "$REPO"
npx vitest run
npx tsc --noEmit
```

Expected: all PASS, zero type errors.

- [ ] **Step 2: Postgres, environment, build, fixture, Strapi**

```bash
T="${TMPDIR:-/tmp}/es42"; mkdir -p "$T/private"
cat > "$T/env" <<'ENV'
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=55442
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=strapi
HOST=127.0.0.1
PORT=1362
APP_KEYS=throwawayA,throwawayB
API_TOKEN_SALT=throwaway
ADMIN_JWT_SECRET=throwaway
TRANSFER_TOKEN_SALT=throwaway
JWT_SECRET=throwaway
ENCRYPTION_KEY=throwaway
STRAPI_TELEMETRY_DISABLED=true
ENV
echo "PRIVATE_FILES_DIR=$T/private" >> "$T/env"
docker run -d --name es42-pg -e POSTGRES_USER=strapi -e POSTGRES_PASSWORD=strapi -e POSTGRES_DB=strapi -p 127.0.0.1:55442:5432 postgres:16
until docker exec es42-pg pg_isready -U strapi >/dev/null 2>&1; do sleep 1; done
(set -a; . "$T/env"; set +a; npm run build)
(set -a; . "$T/env"; set +a; ES_THROWAWAY_DB=1 IDS_FILE="$T/ids.json" node scripts/fixtures/phase4-shape.js)
(set -a; . "$T/env"; set +a; npx strapi admin:create-user --email=admin@example.com --password='Throwaway123' --firstname=Admin)
(set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi start > "$T/strapi.log" 2>&1 & echo $! > "$T/pid")
until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1362/_health | grep -q 204; do sleep 2; done
TOKEN=$(curl -s -X POST http://127.0.0.1:1362/admin/login -H 'Content-Type: application/json' -d '{"email":"admin@example.com","password":"Throwaway123"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])')
idof() { python3 -c "import json,sys; d=json.load(open('$T/ids.json')); print(d[sys.argv[1]][sys.argv[2]])" "$1" "$2"; }
api() { curl -s -X "$1" "http://127.0.0.1:1362/api$2" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' ${3:+-d "$3"}; }
pub() { curl -s "http://127.0.0.1:1362/api$1"; }
py() { python3 -c "import json,sys; d=json.load(sys.stdin); $1"; }
q() { docker exec -i es42-pg psql -U strapi -d strapi -At -c "$1"; }
IB=$(idof groups 'Intermediari Bronze'); AV=$(idof groups 'Avansați')
```

Expected: `phase 4 fixture ok`; `/_health` 204; a token.

- [ ] **Step 3: A series, its dates, the public reads**

```bash
A=$(api POST "/club/groups/$IB/program" '{"freq":"weekly","days":["sat","sun"],"startTime":"11:00","durationMin":50,"from":"2026-11-07"}' | py "print(d['undo']['actionId'])")
E=$(api GET "/club/groups/$IB/program" | py "r=d['data']['series'][0]; print(r['eventId']); print(r['text'], r['fromText'], file=sys.stderr)")
api GET "/club/calendar/occurrences?from=2026-11-14&to=2026-11-15&group=$IB" | py "print([(o['date'], o['startTime'], o['groupName']) for o in d['data']])"
pub '/calendar/occurrences?from=2026-11-14&to=2026-11-14' | py "print(sorted({o.get('groupName') or o['title'] for o in d['data']}), any('groupId' in o for o in d['data']))"
curl -s -D - -o "$T/schedule.json" http://127.0.0.1:1362/api/club/schedule | grep -i '^cache-control'
py "print(d['data'])" < "$T/schedule.json"
```

Expected: the program row prints `Sâ și Du, 11:00, 50 min 7 nov 2026` on stderr; `[('2026-11-14', '11:00', 'Intermediari Bronze'), ('2026-11-15', '11:00', 'Intermediari Bronze')]`; the public list contains `Intermediari Bronze` and `Școala de patinaj` and `False` (no `groupId`); `Cache-Control: public, max-age=60`; `[{'section': {'name': 'Școala de Patinaj - AFI Cotroceni', 'slug': 'scoala-afi'}, 'slots': [{'start': '11:00', 'end': '11:50', 'groups': ['Intermediari Bronze']}]}]`.

- [ ] **Step 4: A cancelled date with parent e-mails, held, and the undo (Review Focus)**

```bash
C=$(api PUT "/club/program/$E/dates/2026-11-14" '{"mode":"cancel","reason":"Competiție la Brașov","notifyParents":true}' | py "print(d['undo']['actionId']); print(d['data'], file=sys.stderr)")
q "select recipient, status, kind, change_key = '$C', not_before > created_at from email_jobs where kind = 'schedule-change' order by recipient"
api POST /club/undo "{\"actionId\":\"$C\"}" | py "print(d['data'])"
q "select distinct status from email_jobs where change_key = '$C'"
api GET "/club/calendar/occurrences?from=2026-11-14&to=2026-11-14&group=$IB" | py "print([o['status'] for o in d['data']])"
C2=$(api PUT "/club/program/$E/dates/2026-11-14" '{"mode":"cancel","reason":null,"notifyParents":true}' | py "print(d['undo']['actionId'])")
sleep 20
q "select distinct status, attempts from email_jobs where change_key = '$C2'"
grep -c 'stays queued' "$T/strapi.log"
```

Expected: stderr `{'mode': 'cancel', 'date': '2026-11-14', 'emails': 3}`; three rows `parinte.ionescu@example.com`, `parinte.radu@example.com`, `parinte.stan@example.com` (Ana, Filip, Daria), each `queued|schedule-change|t|t`; `{'undone': True}`; `cancelled`; `['scheduled', 'scheduled']`; after 20 s the second change's jobs are still `queued|0` (no Brevo key here: nothing is sent); the log has at least one `stays queued` line.

- [ ] **Step 5: Move, "Schimbă", "Șterge programul", one class**

```bash
api PUT "/club/program/$E/dates/2026-11-21" '{"mode":"move","newDate":"2026-11-22","newStartTime":"12:00","reason":"Patinoar"}' | py "print(d['data'])"
api GET "/club/calendar/occurrences?from=2026-11-21&to=2026-11-22&group=$IB" | py "print([(o['date'], o['startTime'], o['status'], o.get('originalDate')) for o in d['data']])"
api PUT "/club/program/$E/dates/2026-12-05" '{"mode":"cancel","reason":"Test"}' > /dev/null
N=$(api PUT "/club/program/$E" '{"freq":"weekly","days":["sat"],"startTime":"12:00","durationMin":50,"from":"2026-11-28"}' | py "print(d['data']['eventId'])")
q "select document_id, (select season_end from components_calendar_recurrences r join calendar_events_cmps c on c.cmp_id = r.id and c.component_type = 'calendar.recurrence' where c.entity_id = e.id) from calendar_events e where document_id in ('$E', '$N')"
api GET "/club/calendar/occurrences?from=2026-12-05&to=2026-12-06&group=$IB" | py "print([(o['date'], o['startTime'], o['status']) for o in d['data']])"
api POST "/club/program/$N/end" '{"from":"2027-03-01"}' | py "print(d['data'])"
CL=$(api POST "/club/groups/$IB/program" '{"repeat":false,"date":"2026-11-20","startTime":"18:00","durationMin":60}' | py "print(d['data']['eventId'])")
api DELETE "/club/program/$CL" | py "print(d['data'])"
api GET "/club/groups/$IB/history" | py "print([l['text'] for l in d['data']][:6])"
```

Expected: `{'mode': 'move', 'date': '2026-11-21', 'emails': 0}`; `[('2026-11-22', '11:00', 'scheduled', None), ('2026-11-22', '12:00', 'override', '2026-11-21')]`; the old series ends `2026-11-27`, the new one `2027-05-31` (if the component join differs, read both series with `GET /club/groups/$IB/program` instead: two rows until 27 November, the old one's `to` is `2026-11-27`); 5 December prints `[('2026-12-05', '12:00', 'cancelled')]` (the carried cancel on the new 12:00 series; 6 December is a Sunday, not in the new series); `{'eventId': ...}`; `{'date': '2026-11-20'}`; the newest lines include `Ședință unică ștearsă: vineri, 20 noiembrie, 18:00.`, `Ședință unică adăugată: vineri, 20 noiembrie, 18:00, 60 min.`, `Program șters din 1 mar 2027: Sâ, 12:00, 50 min.`, `Program schimbat din 28 nov 2026: Sâ și Du, 11:00, 50 min → Sâ, 12:00, 50 min.`

- [ ] **Step 6: Breaks**

```bash
api POST /club/breaks '{"label":"Vacanța de iarnă","startDate":"2026-12-26","endDate":"2027-01-03"}' | py "print(d['data']['label'])"
api POST /club/breaks '{"label":"X","startDate":"2027-01-05","endDate":"2027-01-04"}' | py "print(d['error']['message'])"
api GET "/club/calendar/occurrences?from=2026-12-26&to=2026-12-26" | py "print(sorted((o['title'], o['status'], o.get('note')) for o in d['data']))"
api GET "/club/calendar/occurrences?from=2026-12-05&to=2026-12-05" | py "print([(o['title'], o['status']) for o in d['data'] if o['type'] == 'concurs'])"
```

Expected: `Vacanța de iarnă`; `Data de sfârșit trebuie să fie după data de început.`; on 26 December `('Intermediari Bronze', 'cancelled', 'Vacanța de iarnă')` and `('Școala de patinaj', 'cancelled', 'Vacanța de iarnă')` (the old unlinked series) are there; `[('Bellu Memorial', 'scheduled')]`.

- [ ] **Step 7: "Program public" off, old routes, closed core routes**

```bash
api PUT "/club/groups/$IB" '{"name":"Intermediari Bronze","priceListId":null,"coachIds":[],"programPublic":false}' | py "print(d['data'])"
pub '/calendar/occurrences?from=2026-11-14&to=2026-11-15' | py "print(any(o.get('groupName') == 'Intermediari Bronze' for o in d['data']))"
api GET "/club/calendar/occurrences?from=2026-11-14&to=2026-11-15" | py "print(any(o.get('groupName') == 'Intermediari Bronze' for o in d['data']))"
pub /club/schedule | py "print(d['data'][0]['slots'])"
api PUT "/calendar/events/$E" '{"title":"x"}' | py "print(d['error']['status'], d['error']['message'])"
api DELETE "/calendar/events/$E" | py "print(d['error']['status'])"
for p in /calendar-events /calendar-blackouts; do echo "$p $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:1362/api$p")"; done
```

Expected: `{'changed': True}`; `False` (public); `True` (admin); `[]`; `409 Evenimentul aparține grupei Intermediari Bronze. Se schimbă din pagina grupei.`; `409`; `/calendar-events 404`, `/calendar-blackouts 404`.

- [ ] **Step 8: Clean up**

```bash
kill "$(cat "$T/pid")"
docker rm -f es42-pg
rm -rf "$T"
```

Expected: container removed. No commit in this task unless a check failed (then a `fix(schedules): ...` commit in the owning task's files and the affected steps repeated).

---

## Interfaces for other plans

- **Admin UI (plan 4-5, Program tab; plan 4-6, Calendar și serii):** the route table of Task 7; `GroupProgram`, `ProgramRow` (`program-read.ts`); `Occurrence` with `groupId`, `groupName`, `originalDate`, `originalStartTime`, `cancelReason`, `note` (`expand.ts`); the date route body `{ mode: 'keep' | 'cancel' | 'move', newDate, newStartTime, reason, notifyParents }`; the program body `{ repeat, freq, weekOfMonth, days, startTime, durationMin, from }` or `{ repeat: false, date, startTime, durationMin, note }`; `SCHEDULE_TOASTS`, `SCHEDULE_ERRORS`, `DURATION`, `durationLabel` (copy). Every write answers `{ data, undo: { actionId } | null }`; undo through `POST /club/undo` (plan 4-1).
- **Website (plan 4-7):** `GET /api/club/schedule` → `{ data: PublicSchedule }`; `GET /api/calendar/occurrences` occurrences gain `groupName`, `originalDate`, `originalStartTime`, and a break-cancelled occurrence carries the break name in `note`.
- **New season (plan 4-3):** `seriesWrite`-style events are copied with `EventWrite` and `createEvent`; `classDates`, `asCalendarRow`, `eventType`, `seasonOf` (`program-plan.ts`); `programRows` for "Program copiat" texts.
- **Migration (plan 4-4):** `asCalendarRow`, `classDates`, `eventType`, `inputText` (`program-plan.ts`); `SeriesText` / `programLineFrom` (plan 4-1) for "Program adăugat" lines.

## Self-review

- **Spec coverage.** 3.3 group link, types W9, recurrence, start + duration, season end (T2, T4); 3.4 exceptions with `reason`, Ține / Anulează / Mută, note `reason ?? newTitle` (T1, T2, T5); 3.5 breaks scope and note, override holds (T1, T6); 3.6 e-mail job kind, group, payload, changeKey, notBefore, cancelled on undo (T3, T5); 6.3 Program obișnuit rows, Program nou (series, one class), Schimbă (split, carried dates), Șterge programul, Șterge ședința, date panel, break date read-only, toasts' copy (T2, T4, T5, T7); 6.5 recipients, jobs, hold, texts, next class, history ending (T3, T5); 7.1 server side of Pauze (T6); 7.2 old routes refuse group events, admin occurrences route (T7); 8.1 locks (event row first), all or nothing, undo (T4, T5); 8.2 schedule, breaks, occurrences routes, `{ data, undo }`, `pingRevalidate` (T4 to T7); 8.3 public occurrences filter and `groupName`, `/api/club/schedule`, closed core routers (plan 4-1 T1; T7, T8); 9.3 revalidate pings (T4 to T6); 11 copy (T2, T3); 12 unit tests and the boot check (T1 to T8). Screens: plans 4-5 and 4-6; website: plan 4-7; migration: plan 4-4.
- **Placeholder scan:** every code step carries its code; the two "read the file" notes (e-mail config fields, `NOW` in the job-state test) name the exact adjustment.
- **Type consistency:** `SeriesInput`, `ProgramInput`, `DateMode`, `EventChange` (T2) are used with these names in T4 and T5; `Change`, `SCHEDULE_HOLD_MS`, `scheduleJobs` (T3) in T5 and `strapi-email.ts`; `GroupContext.emails` and `now` (T3) in T5; `ProgramRow`, `GroupProgram` (T7) are what the admin plan reads; `UndoStep` ops `setEvent`, `createEvent`, `deleteEvent`, `cancelEmails` come from plan 4-1.
- **Review Focus:** undo cancels queued jobs and a held job is not attempted (T3, T5, T8); Schimbă with changed dates (T2, T8); breaks scope (T1, T8); a non-public or inactive group (T1, T7, T8); recipients (T3).
