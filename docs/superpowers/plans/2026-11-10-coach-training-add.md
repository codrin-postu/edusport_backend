# Coach "Antrenament nou" and Program Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The coach API behind the approved 2026-11-10 canvas: one "Antrenament nou" flow for a group (once or repeating, with "Până la") and for an individual lesson (once or repeating), program rules shown and changed one weekday at a time ("Schimbă", "Șterge" on a rule row), one date of the program cancelled with a note, moved or removed ("Șterge"), and a lesson page that edits or deletes one lesson or the lessons that follow.

**Architecture:** Group work stays on the phase 4 program model: a calendar event per series (`freq` weekly, biweekly or monthly, `days`, `startTime`/`endTime`, `seasonStart`/`seasonEnd`) or per one-off class (`freq: 'none'`, `singleDate`), dates expanded on read by `src/api/calendar-event/services/expand.ts`, exceptions per date. Repeating individual lessons are a new `lesson-series` row (the rule) whose dates are materialised as ordinary planned `individual-lesson` rows linked to it, so every presence, money, history, calendar and export reader keeps reading lesson rows as it does today. Coach routes in `src/api/portal/routes/02-coach.ts`, guarded by `global::is-coach`; every new or changed route joins the phase 6 matrix test.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS), Postgres 16, Vitest 3, Node 22.

**Spec and design:** boards `edusport_frontend/.claude/worktrees/coach-screens/docs/portal/mockups/screens/coach-canvas-v1/` (`AntrenorAdauga*`, `AntrenorDesktopAdauga*`, `AntrenorGrupaProgram`, `AntrenorProgramData`, `AntrenorProgramSchimba`, `AntrenorProgramSterge`, `AntrenorLectieDetaliu`, screenshots `s_*.png`; markup in `gen_coach.py` from the line `# ---------- antrenament nou, program, o dată, lecție ----------`). Decision log `edusport_frontend/docs/portal/DECISIONS.md`, entry "2026-11-10 (user)". Coach portal spec `docs/superpowers/specs/2026-11-04-coach-portal-design.md` (8.5, 9.3, 9.8, 9.9). Phase 4 program rules W9, W10, W12 as coded in `src/club/groups/program-plan.ts`; phase 5 lesson rules C47 to C49, C73 as coded in `src/club/presence/lessons/*`. Frontend plan: `edusport_frontend/.claude/worktrees/coach-screens/docs/superpowers/plans/2026-11-10-coach-training-screens.md` (copies the contracts below). Conventions: `docs/superpowers/plans/2026-11-09-coach-portal-additions.md`, `docs/HANDOFF.md`, `.superpowers/phase3-shared/agent-rules.md`.

**Base:** `feat/athletes` (7e369d9 or later). The plan file lives on `feat/training-add` (worktree `edusport_backend/.claude/worktrees/training-add`). Each task runs in its own worktree from `feat/training-add`; the controller merges back into it. Ledger `training-add/.superpowers/sdd/2026-11-10-training-add/progress.md`.

## What exists today (verified 2026-11-10 on 7e369d9)

| Need on the canvas | Today | This plan |
|---|---|---|
| Group, "Nu se repetă" | exists: `addProgram` with `repeat: false` writes a `freq: 'none'` event (`classWrite`); the expansion marks its date `oneOff: true`; presence rows come from `heldOccurrences` over the same expansion; the public calendar shows it when "Program public" is on; the public notebook (`scheduleSlots`) lists series only | no model change; tests pin the readers (Task 9) |
| Group, Săptămânal / La 2 săptămâni / Lunar | exists: `freq` weekly, biweekly (parity of Monday-based weeks from `seasonStart`), monthly (`weekOfMonth` first to fourth or last, per weekday) | unchanged |
| Duration on a rule | exists: `endTime` = start + `durationMin`, 15 to 240 step 5, no overnight | unchanged |
| "Până la" on add | missing: `seriesWrite` always ends the series on the season's last day | Task 2 (`until`) |
| A rule row per weekday with "Schimbă" / "Șterge" | missing: one event holds several days; `changeProgram` and `endProgram` act on all of them | Task 3 (`day`) |
| One date: Anulează with note, Mută | exists: `setDate` modes `cancel` (exception `anulat`, `reason` up to 120) and `move` (exception `override`) | unchanged |
| One date: Șterge | missing for a series date (only `keep`); a one-off class is deleted with `deleteClass` | Task 1 (mode `remove`, exception kind `sters`) |
| Individual, repeating | missing: a lesson is one row; created held and priced when its date is today or earlier | Tasks 5 and 6 |
| "Modifică lecția" (date, time, duration, coach) | partial: `PUT /lessons/:id` changes presence, duration and coaches only | Task 7 |
| "Șterge lecția" for one or the following | partial: one lesson only | Task 8 |
| Coach writes on the program | Club own groups only (`programRight`: `access === 'own' && kind === 'club'`) | unchanged (see Open questions 1) |

## Data model decisions

1. **One-off group class:** stays a `freq: 'none'` calendar event with `singleDate` (not a dated exception on a series, not a new type). It already fits every reader: occurrence key and presence rows (`heldOccurrences`), `ownClassesBetween` (calendar, Istoric not-done), Azi, the public calendar (`publicWindow`, filtered by "Program public"), and it stays out of the weekly public notebook, which lists repeating slots only. Its "Șterge" is `deleteClass`; its "Anulează" and "Mută" are `setDate` as for a series date.
2. **"Până la":** the series' `seasonEnd` is `until` when given (from <= until <= the season's last day), else the season's last day, exactly as `planEnd` already shortens a series. No new field.
3. **Rule rows per weekday:** the event keeps several days. A change or end of one weekday splits the event at `from`: the old event ends `from - 1` (or is deleted when it has no class before, as `planEnd` does), a "rest" event carries the other weekdays from `from` to the old end, and (for a change) a new event carries the new rule. The rest event starts on its first class date on or after `from` so a biweekly series keeps its parity (the expansion anchors parity on `seasonStart`). Exceptions on or after `from` go with the event whose dates they belong to.
4. **Removed date:** a new exception kind `sters` in `src/components/calendar/exception.json`; the expansion drops a `sters` date entirely (no occurrence, so no presence row, no public date, no calendar item); `keep` on that date removes the exception as for any other kind. A date with a saved session cannot be removed (409); the coach cancels it instead.
5. **Repeating individual lessons: materialised, not expanded on read.** A new collection type `api::lesson-series.lesson-series` (`club_lesson_series`: `athlete`, `coaches`, `freq`, `days` JSON, `weekOfMonth`, `startTime`, `durationMin`, `from`, `to`, `createdByName`) and a nullable `series` relation (manyToOne) on `individual-lesson`. Creating a series writes one `planned` lesson per date (same date expansion as groups, through `classDates` on a synthetic event), never held and never priced at creation, even for today. Why: lessons are money rows. The price is frozen when a lesson is held (`savedValues` in `save.ts`), payments point at lesson ids, the due, money, tables, exports, merge and delete guards all read `store.lessons(...)`. Expanding on read would make every one of those readers merge virtual lessons and would need a "materialise on tick" path; materialising keeps them unchanged, and planned future lessons are already a known state (admin-created planned lessons, amount 0).
6. **Editing a series:** "Doar această lecție" (`scope: 'one'`) edits that row only and it stays in the series. "Și lecțiile următoare" (`scope: 'following'`) ends the series the day before the lesson's date: planned rows of the series on or after that date that no payment points at are deleted; saved ones stay; then the edited values make a new series (or one lesson when "Nu se repetă") from the form's date. A later `following` rewrite replaces rows edited one by one before.
7. **Deleting:** `scope: 'one'` is today's `deleteLesson`. `scope: 'following'` deletes the planned, unpaid rows of the series from the lesson's date on and ends the series (deleted when no row is left).
8. **Conflicts:** a coach write refuses a lesson of the same athlete that overlaps (same date, time ranges intersect) another non-deleted lesson of that athlete outside the rows the same write deletes. A series is refused whole on its first conflicting date (nothing written). Group classes are not checked against lessons (today they are not either).

## Global Constraints

- Everything in the phase 6 and 2026-11-09 plans' constraints: answers built field by field in views (no store row spread), `forbiddenKeysIn` on every new answer (`src/club/portal/coach/views.ts`), today is Bucharest's (`c.today`, never `new Date()` in a rule), current season through `currentSeason`/`seasonOfDate`, Istoric lines with actor `Antrenor <nume>`, writes inside `store.transaction` with the existing lock order (seasons, athletes, groups, events; lessons after athletes; the new series row after the athlete, before its lessons), coach answers drop `undo`.
- Permissions: program writes on own Club groups only (`programRight`, unchanged); a lesson is the coach's only while his team member id is in its `coachIds` (`mine` in `lessons.ts`), anything else 404; a new lesson or series must list the coach (`coachIds` contains `c.coach.teamMemberId`, else 403 `PORTAL_ERRORS.noAccess`); the athlete must be `nou` or `activ`.
- Dates: `YYYY-MM-DD`; a one-off group class may be dated within the last 7 days (user ruling 2026-11-10, `canCoachCorrect`); a series `from` (group or lesson) and any edited lesson date not before today; `until` not before `from` and not after the last day of the season that contains `from`; a lesson series with no date in range, or more than 200 dates -> 400 `PORTAL_ERRORS.invalid` ("Cerere invalidă."). A single lesson keeps today's window (`canCoachCorrect`).
- Copy: refusals reuse `PORTAL_ERRORS`, `GROUP_ERRORS`, `SCHEDULE_ERRORS`, `ATTENDANCE_ERRORS` exactly; toasts `PORTAL_TOASTS.saved` ("Salvat.") and `LESSON_COPY.deleted` ("Lecție ștearsă."). New strings only those listed in the tasks (each in "Open questions" or marked decided by Claude). Romanian, straight quotes, no em or en dash, no middle dot.
- Money: creating, editing or deleting planned lessons never writes a price, an amount or a payment; a saved lesson's price is never touched by a plan edit; a lesson a non-cancelled payment points at is never deleted (`isDeletable`).
- Public site: the public notebook (`/api/club/schedule`) and the public calendar change only through the existing rules (series of public active groups; one-off and moved dates of public groups; removed dates gone); lessons and series never reach a public route.
- Schema changes (Tasks 1 and 5) need a Strapi restart before saves keep the new attribute; the boot check (Task 10) starts Strapi after the schema files are in place.
- Boot check: Postgres container `es-ta-pg` on 127.0.0.1:55473, Strapi 1393 (check both are free with `lsof -i :55473 -i :1393` first). Never 5432, 55442, 55469, 1337, 1340, 1389, 3010, `strapi_app`, `strapi_db`, `edusport-test-pg`, or any container of the user. Fixtures `scripts/fixtures/phase4-shape.js`, `phase5-shape.js`, `phase6-shape.js`, `coach-additions.js`, new `training-add.js`; env `PORTAL_BFF_SECRET=test-bff-secret-000000000000000000`, `PORTAL_HOSTS=antrenor`, `JWT_SECRET` any, Brevo unset, `SKATE_RESULTS_API=http://127.0.0.1:9`. The container is removed at the end.
- Files this plan may touch: `src/api/calendar-event/services/expand.ts` (Task 1, the `sters` filter only), `src/components/calendar/exception.json`, `src/club/groups/{types,program-plan,program,program-dates,program-read,program-text,series,history-lines}.ts`, `src/club/groups/copy/*.ts`, `src/api/lesson-series/**` (new), `src/api/individual-lesson/content-types/individual-lesson/schema.json`, `src/club/presence/{types,store,strapi-store,undo,undo-service,history-lines}.ts`, `src/club/presence/copy/*.ts`, `src/club/presence/lessons/**`, `src/club/presence/lifecycle/merge-rows.ts`, `src/club/presence/__tests__/fake-store.ts`, `src/club/portal/coach/**`, `src/club/portal/copy.ts`, `src/api/portal/routes/02-coach.ts`, `src/api/portal/controllers/coach.ts`, `scripts/fixtures/training-add.js`, `scripts/clickthrough-training-add.sh`.
- The frontend copies the types of `src/club/portal/coach/api-types.ts` verbatim into `src/lib/portal/api-types.ts`; every type change here is listed in the HTTP contracts below and nowhere else.

## Review Focus

- **A series lesson created for today is not billed**: a weekly series from today writes today's row `planned`, `present: null`, `price: null`, `amount: 0`; the due and money reads for the athlete are the same before and after. Pinned by Task 6.
- **Biweekly parity on a weekday split**: a biweekly Tue and Thu series from 2026-09-01; "Șterge" on Tuesday from 2026-11-17 leaves Thursday classes on exactly the same dates as before. Pinned by Task 3.
- **A removed date with presence**: "Șterge" on a date whose session is saved answers 409 and writes nothing; on an unsaved date the occurrence, the presence row, the public date and the calendar item are all gone, and "Ține" brings them back. Pinned by Tasks 1 and 4.
- **"Și lecțiile următoare" never deletes a saved or paid lesson**: today's saved lesson and a planned lesson with a payment stay, the others go, the series ends the day before. Pinned by Tasks 7 and 8.
- **Another coach's lesson or group**: plan edit, scoped delete and every program write on another coach's lesson or group answer 404 or 403 and write nothing. Pinned by the matrix (Task 10).
- **Lock order**: a series create locks the athlete, then creates the series row, then the lessons; a scoped edit locks the athlete, then each affected lesson by id. No deadlock in the parallel create test (two series for the same athlete at once: one wins, the other 409 conflict). Pinned by Task 6.

## HTTP contracts (binding for the frontend plan)

Shape as phase 6: success `200 { data: T }`; refusal `{ data: null, error: { status, name: 'ClubAdminError', message } }` with the message to show.

Changed and new routes in `02-coach.ts` (fixed paths before parameter paths):

| Method and path | Body or query | Answer | Refusals |
|---|---|---|---|
| `POST /portal/coach/groups/:documentId/program` | today's body; a series also takes `until?: string \| null` | `{ eventId, date }` (unchanged) | as today; 400 invalid when `until` < `from` or after the season end; a series `from` or `until` before today is 400; a one-off class (`repeat: false`) may be dated today or any of the last 7 days (`canCoachCorrect`, user ruling 2026-11-10), older is 400 |
| `GET /portal/coach/groups/:documentId/program` | `month=YYYY-MM` | `CoachProgram` (gains `rules`) | as today |
| `PUT /portal/coach/program/:eventId` | today's body plus `day?: DayKey` | `{ eventId }` (the new rule's event) | as today; 400 invalid when `day` is not one of the event's days |
| `POST /portal/coach/program/:eventId/end` | `{ from: string; day?: DayKey }` | `{ eventId }` | as today; 400 invalid as above |
| `PUT /portal/coach/program/:eventId/dates/:date` | today's body; `mode` also `'remove'` | `DateAnswer` (`mode` gains `'remove'`, `emails: 0`) | as today; 409 `GROUP_ERRORS.datePresence` when the date has a saved session |
| `POST /portal/coach/lessons` | today's body plus `repeat?: LessonRepeat \| null` (with `repeat`, `date` is "Din data") | `CoachLessonCreated` | as today; 400 invalid (see Global Constraints), 409 `LESSON_ERRORS.conflict(...)` |
| `GET /portal/coach/lessons/:documentId` | | `CoachLesson` (gains `series`, `planEditable`) | as today |
| `PUT /portal/coach/lessons/:documentId/plan` | `CoachLessonPlanBody` | `CoachLessonCreated` | 404 not mine; 409 `PRESENCE_ERRORS.stale` when the lesson is saved or its date is before today; 400 invalid; 403 noAccess when `coachIds` lacks the coach; 409 conflict |
| `DELETE /portal/coach/lessons/:documentId` | query `scope=one\|following` (default `one`) | `{ deleted: true; count: number; toast: string }` | as today; 400 invalid scope; `following` on a lesson without a series is `one` |

Type changes in `src/club/portal/coach/api-types.ts`:

```ts
import type { DayKey, WeekOfMonth } from '../../groups/types';
import type { RepeatFreq } from '../../groups/series';
export type { DayKey, WeekOfMonth, RepeatFreq };
// new
/** One weekday of a series: the rows of "Program săptămânal". `untilSeasonEnd` is true when `to` is the season's last day. */
export type CoachProgramRule = {
  eventId: string; day: DayKey; freq: RepeatFreq; weekOfMonth: WeekOfMonth | null; startTime: string; durationMin: number;
  from: string; to: string; untilSeasonEnd: boolean; nextDate: string | null;
};
export type LessonRepeat = { freq: RepeatFreq; days: DayKey[]; weekOfMonth?: WeekOfMonth | null; until: string | null };
export type LessonSeriesView = { seriesId: string; freq: RepeatFreq; days: DayKey[]; weekOfMonth: WeekOfMonth | null; startTime: string; durationMin: number; from: string; to: string; untilSeasonEnd: boolean };
export type CoachLessonCreated = { lessonId: string; seriesId: string | null; count: number; toast: string };
export type CoachLessonPlanBody = {
  date: string; startTime: string; durationMin: number; coachIds: string[]; scope: 'one' | 'following'; repeat?: LessonRepeat | null;
};
// changed
export type CoachProgram = { /* existing fields */ rules: CoachProgramRule[] };
export type CoachLesson = { /* existing fields */ series: LessonSeriesView | null; planEditable: boolean };
```

Meaning: `rules` = the series of `program.series` split per weekday, ordered by weekday (Monday first), then start time; `nextDate` = the first class date of that weekday from today on, null when none is left. `planEditable` = the lesson is planned, its date is today or later, and the coach is listed. `count` = lessons written (1 for a single lesson). A `following` edit answers the new first lesson's id. The single-date `DateAnswer.mode` union is `'keep' | 'cancel' | 'move' | 'remove'`. `Occurrence` is unchanged; a removed date has no occurrence.

New strings (see Open questions 4): `GROUP_ERRORS.datePresence = 'Data are prezența salvată. Poți doar să o anulezi.'`; `LESSON_ERRORS.conflict = (day: string, time: string) => \`Sportivul are deja o lecție pe ${day}, la ${time}.\`` (`day` as `shortDay`, e.g. "joi, 13 nov"); `LESSON_COPY.deletedMany = 'Lecții șterse.'` (decided by Claude, low impact).

---

| Task | Risk | Model | Batch |
|---|---|---|---|
| 1 Removed date: exception `sters`, expansion, `setDate` mode `remove` | high (schema, presence data) | Sonnet | A |
| 2 "Până la" on a new series | low | Haiku | |
| 3 One weekday changed or ended (event split) | high (program data, parity) | Sonnet | A |
| 4 Coach program answer and routes (`rules`, `until`, `day`, `remove`) | high (permissions) | Sonnet | A |
| 5 Lesson series model, store, undo ops | high (schema, money rows) | Sonnet | B |
| 6 Create a repeating lesson (coach) with conflicts | high (money rows, locks) | Sonnet | B |
| 7 Edit a lesson's plan, one or following | high (deletes rows) | Sonnet | B |
| 8 Delete one or following | high (deletes rows) | Sonnet | B |
| 9 Readers: Azi, calendar, Istoric, lesson page, money pins, merge | low | Sonnet | |
| 10 Matrix, boot check, click-through | high (permissions) | Sonnet | final |

Model tags: Haiku where the plan carries the shape and the work is mechanical, Sonnet for integration judgment. High risk tasks get a review per batch; the rest only the plan's final review.

Order: Tasks 1, 2, 5 start in parallel. Task 3 needs Task 2 (shared `program-plan.ts`; merge 2 first). Task 4 needs 1 to 3. Tasks 6 to 8 need 5, and run in that order (shared `lessons/`). Task 9 needs 4 and 6. Task 10 needs all.

---

### Task 1: Removed date: exception `sters`, expansion, `setDate` mode `remove` (high, Sonnet)

**Files:**
- Modify: `src/components/calendar/exception.json` (enum gains `"sters"`), `src/club/groups/types.ts` (`ExceptionKind` gains `'sters'`), `src/api/calendar-event/services/expand.ts` (`eventOccurrences` drops a slot whose exception kind is `sters`), `src/club/groups/program-plan.ts` (`DateMode` gains `{ mode: 'remove' }`, `readDateMode`, `planDateMode`), `src/club/groups/program-dates.ts` (`dateLine`, the saved-session check), `src/club/groups/history-lines.ts` and `src/club/groups/copy/core.ts` (`P4_ACTIONS.dateRemoved`, `PROGRAM_LINES.removed`), `src/club/groups/copy/*.ts` (`GROUP_ERRORS.datePresence`)
- Test: `src/club/groups/__tests__/program-remove.test.ts`, `src/api/calendar-event/services/__tests__/expand.test.ts` (extend; create beside the existing expansion tests if they live elsewhere, find them with `grep -rl expandOccurrences src --include='*.test.ts'`)

**Interfaces:**
- Produces:

```ts
export type DateMode = { mode: 'keep' } | { mode: 'cancel'; reason: string | null } | { mode: 'move'; newDate: string; newStartTime: string; reason: string | null } | { mode: 'remove' };
// planDateMode(e, date, { mode: 'remove' }) -> [...rest, { date, kind: 'sters', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: null }]
// P4_ACTIONS.dateRemoved = 'date-removed'; PROGRAM_LINES.removed = (date: string) => `Ședința din ${date} ștearsă din program.`
```

  `dateLocked` with `remove`: after `spotOf`, reads the group's sessions on the date through the presence store the group context can reach (the same read `heldOccurrences` callers use; if the group context has no presence store, pass a `hasSavedSession(groupId, date)` function into `GroupContext` from `src/club/groups/context.ts` built on the session table, and note it in the ledger); a saved one -> 409 `GROUP_ERRORS.datePresence`. No e-mail is ever queued for `remove` (`notifyParents` ignored). Undo step `setEvent` as for the other modes. Website ping as today.

- [ ] **Step 1: Failing tests.** Expansion: an event weekly Fri from `2026-10-02` with exception `{ date: '2026-11-13', kind: 'sters' }` gives no occurrence on 13 November and keeps 6 and 20 November; `publicWindow` and `adminWindow` the same; a `sters` exception on a one-off class removes its only date. Service (fake group store, coach seed, today `2026-11-10`): `setDate(ctx, 'ev-g-club-a', '2026-11-13', { mode: 'remove' })` -> `{ mode: 'remove', date: '2026-11-13', emails: 0 }`, the event's exceptions hold one `sters` row, one Istoric line `date-removed` whose text is "Ședința din 13 nov 2026 ștearsă din program." (date as `shortDate`); `{ mode: 'remove', notifyParents: true }` queues no job; then `{ mode: 'keep' }` on the same date removes the exception and the date expands again; a date with a saved session -> 409 "Data are prezența salvată. Poți doar să o anulezi." and the exceptions are unchanged; a date that is not a class date -> 400 `GROUP_ERRORS.invalid`; `heldOccurrences` over the window has no row for the removed date.
- [ ] **Step 2: Run** `npx vitest run src/club/groups/__tests__/program-remove.test.ts src/api/calendar-event`. Expected: FAIL.
- [ ] **Step 3: Implement.** Keep every existing kind's behaviour; `readDateMode` accepts `mode: 'remove'` with no other field.
- [ ] **Step 4: Run** the same command and `npx vitest run src/club/groups src/club/presence`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/components src/api/calendar-event src/club/groups && git commit -m "feat(program): remove one date of a series"`

### Task 2: "Până la" on a new series (low, Haiku)

**Files:**
- Modify: `src/club/groups/program-plan.ts` (`SeriesInput.until`, `readSeriesInput`, `seriesWrite`), `src/club/groups/program.ts` (`addLocked` checks `until` against the season), `src/club/groups/program-text.ts` (`SeriesText.to?`, `programLineFrom` adds the end), `src/club/groups/history-lines.ts` (`asSeries` reads `to`)
- Test: `src/club/groups/__tests__/program-until.test.ts`

**Interfaces:**
- Produces: `SeriesInput = { ...; until: string | null }` (`readSeriesInput`: `until` absent or null -> null; an ISO date -> it; anything else -> invalid). `seriesWrite(group, type, s, seasonEnd)` writes `seasonEnd: s.until ?? seasonEnd`. `addLocked`: `until` < `from` or > `seasonBounds(season).end` -> 400 `GROUP_ERRORS.invalid`. `inputText` carries `to: s.until` when set; `programLineFrom` gives "Ma și Jo, 17:30, 60 min, din 11 nov 2026, până pe 31 mar 2027" when `to` is set, the old text otherwise. `changeProgram` ignores `until` (the new rule keeps the old end, as `planChange` does today).

- [ ] **Step 1: Failing tests** (today `2026-11-10`, season 2026-2027 ending `2027-06-30`): add weekly Tue, Thu 17:30, 60 min from `2026-11-11` with `until: '2027-03-31'` -> event `seasonEnd: '2027-03-31'`, line "Program adăugat: Ma și Jo, 17:30, 60 min, din 11 nov 2026, până pe 31 mar 2027."; without `until` -> `seasonEnd: '2027-06-30'` and the old line text; `until: '2026-11-10'` (before `from`) -> 400; `until: '2027-07-01'` -> 400; `until: '31.03.2027'` -> 400; `readGroupProgram` lists the series with `to: '2027-03-31'`; on `2027-04-01` it is gone from `currentSeries`.
- [ ] **Step 2: Run** `npx vitest run src/club/groups/__tests__/program-until.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command and `npx vitest run src/club/groups`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/groups && git commit -m "feat(program): a new series may end before the season does"`

### Task 3: One weekday changed or ended (high, Sonnet)

**Files:**
- Modify: `src/club/groups/program-plan.ts` (`planDayChange`, `planDayEnd`), `src/club/groups/program.ts` (`changeLocked`, `endLocked`, `endProgram` read `day`)
- Test: `src/club/groups/__tests__/program-day.test.ts`

**Interfaces:**
- Produces:

```ts
export type DayPlan = { old: EventChange; rest: EventWrite | null; created: EventWrite | null };
/** "Schimbă" on one weekday's row from `input.from`; `day` absent or the event's only day -> today's planChange with `rest: null`. */
export function planDayChange(e: EventRecord, day: DayKey | null, input: SeriesInput, title: string): DayPlan;
/** "Șterge" on one weekday's row from `from`; `day` absent or the only day -> today's planEnd with `rest: null, created: null`. */
export function planDayEnd(e: EventRecord, day: DayKey | null, from: string): DayPlan;
```

  `rest` = the old event's rule with `days` minus `day`, `seasonStart` = the first class date of the rest on or after `from` (null rest when there is none), `seasonEnd` = the old end, exceptions of the rest's class dates on or after `from`. `created` = as `planChange` today, carrying the exceptions on or after `from` that are class dates of the new rule and were on `day`. `day` not in `e.recurrence.days` -> `changeProgram`/`endProgram` answer 400 `GROUP_ERRORS.invalid`. Writes: old change, then `createEvent(rest)`, then `createEvent(created)`; undo steps `[oldStep, deleteEvent rest, deleteEvent created]`. Lines: `programChanged` with `before` = the old rule with `days: [day]`, `after` = the input; `programEnded` with `series` = the old rule with `days: [day]`. Answer `eventId` = created (change) or the old id (end), as today.

- [ ] **Step 1: Failing tests** (today `2026-11-10`): weekly Tue and Thu 17:30 from `2026-09-01` to `2027-06-30`. `endProgram(ctx, id, { from: '2026-11-17', day: 'tue' })` -> old event ends `2026-11-16`, a rest event Thu 17:30 from `2026-11-19` to `2027-06-30`; `classDates` of old plus rest between `2026-11-17` and `2026-12-31` are exactly the Thursdays; line "Program șters din 17 nov 2026: Ma, 17:30, 60 min." `changeProgram(ctx, id, { freq: 'weekly', days: ['tue'], startTime: '18:00', durationMin: 60, from: '2026-11-17', day: 'tue' })` -> old ends `2026-11-16`, rest Thu 17:30, new Tue 18:00 from `2026-11-17`; an `anulat` exception on Thu `2026-11-26` moves to the rest event, one on Tue `2026-11-24` moves to the new event. Biweekly Tue and Thu from `2026-09-01`: end Tue from `2026-11-17` -> the Thursday dates between `2026-11-17` and `2027-01-31` equal the Thursday dates of the original series in that range. `day: 'fri'` on that event -> 400; no `day` -> today's behaviour (the existing tests in `src/club/groups/__tests__/` stay green unchanged); undo of the day change puts back the single original event and deletes both new ones.
- [ ] **Step 2: Run** `npx vitest run src/club/groups/__tests__/program-day.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command and `npx vitest run src/club/groups`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/groups && git commit -m "feat(program): change or end one weekday of a series"`

### Task 4: Coach program answer and routes (high, Sonnet)

**Files:**
- Modify: `src/club/portal/coach/{api-types,program}.ts`
- Test: `src/club/portal/coach/__tests__/program.test.ts` (extend)

**Interfaces:**
- Produces: `readCoachProgram` adds `rules: CoachProgramRule[]` (built from `program.series`: one entry per day, `untilSeasonEnd = row.to === seasonBounds(season).end`, `nextDate` = first `classDates` date of that day from today to `row.to`). `coachAddProgram`, `coachChangeProgram`, `coachEndProgram`, `coachSetDate` pass the new fields through unchanged; `inPast` also checks `until`. The order of checks stays: event or group found (404), `programRight.write` (403 noAccess), past date (400), service.

- [ ] **Step 1: Failing tests** (coach seed, `tm-andreea`, today `2026-11-20`): `g-club-a` with weekly Tue and Thu -> `rules` `[{ day: 'tue', ... }, { day: 'thu', ... }]` with `from`, `to`, `durationMin: 60`, `untilSeasonEnd: true`, `nextDate` the next Tuesday and Thursday; add with `until` -> 200 and `untilSeasonEnd: false` afterwards; `until` yesterday -> 400 "Cerere invalidă."; end with `day: 'tue'` from `2026-11-24` -> 200 and `rules` has only Thursday from that day; `setDate` `remove` on an own Club date -> 200, on `g-scoala-a` -> 403 "Nu mai ai acces la această grupă.", on Virgil's group -> 403, on a past date -> 400; the answer of `readCoachProgram` on another coach's group still has `description: null` on occurrences and `rules` present (read only); `forbiddenKeysIn` empty.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/coach/__tests__/program.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command and `npx vitest run src/club/portal/coach/__tests__/coach-routes.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/coach && git commit -m "feat(portal): coach program rules per weekday, Până la and removed dates"`

### Task 5: Lesson series model, store, undo ops (high, Sonnet)

**Files:**
- Create: `src/api/lesson-series/content-types/lesson-series/schema.json`, `src/api/lesson-series/{controllers,routes,services}/lesson-series.ts` (Strapi factories, no public route: the routes file exports `{ routes: [] }` as other club-only types do; copy from `src/api/individual-lesson/`)
- Modify: `src/api/individual-lesson/content-types/individual-lesson/schema.json` (`"series": { "type": "relation", "relation": "manyToOne", "target": "api::lesson-series.lesson-series" }`), `src/club/presence/{types,store,strapi-store,undo,undo-service}.ts`, `src/club/presence/__tests__/fake-store.ts`, `src/club/presence/lifecycle/merge-rows.ts` (series rows follow their athlete on a merge), `src/club/presence/lifecycle/delete-guard.ts` (`removePresenceRows` also deletes the athlete's series rows after its lessons)
- Test: `src/club/presence/__tests__/lesson-series-store.test.ts`, `src/club/presence/__tests__/lesson-series-pg.test.ts` (Postgres parity, as `history-pg.test.ts` does)

**Interfaces:**
- Produces:

```ts
export type LessonSeriesWrite = {
  athleteId: string; coachIds: string[]; freq: RepeatFreq; days: DayKey[]; weekOfMonth: WeekOfMonth | null;
  startTime: string; durationMin: number; from: string; to: string; createdByName: string;
};
export type LessonSeriesRow = LessonSeriesWrite & { id: string };
// LessonWrite gains seriesId: string | null (existing rows read null)
// PresenceStore gains:
lessonSeries(id: string): Promise<LessonSeriesRow | null>;
lessonSeriesOf(athleteId: string): Promise<LessonSeriesRow[]>;
lockLessonSeries(id: string): Promise<void>;
createLessonSeries(data: LessonSeriesWrite): Promise<string>;
updateLessonSeries(id: string, data: Partial<Pick<LessonSeriesWrite, 'to' | 'coachIds'>>): Promise<void>;
deleteLessonSeries(id: string): Promise<void>;
// LessonWhere gains seriesId?: string
// UndoStep gains { op: 'deleteLessonSeries'; id: string } | { op: 'createLessonSeries'; row: LessonSeriesWrite; lessonIds: string[] } | { op: 'setLessonSeries'; id: string; to: string }
```

  `createLessonSeries` undo recreates the row and relinks `lessonIds` (the lessons it put back first). Every existing `LessonWrite` producer sets `seriesId: null` (create, the `createLesson` undo keeps the value it stored). Lock order in the store doc comment: athletes, lesson series, lessons.

- [ ] **Step 1: Failing tests:** fake and Postgres stores agree on create, read, update `to`, delete, `lessons({ seriesId })`; a lesson written with `seriesId` reads it back, an old lesson reads `null`; `lessonSeriesOf` lists by `from`; the undo of a series create deletes its lessons then the series; merge moves both a lesson and its series to the kept athlete; `removePresenceRows` leaves no series row.
- [ ] **Step 2: Run** `npx vitest run src/club/presence/__tests__/lesson-series-store.test.ts` and, with the test Postgres the existing pg tests use, `npx vitest run src/club/presence/__tests__/lesson-series-pg.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same commands and `npx vitest run src/club/presence`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/api/lesson-series src/api/individual-lesson src/club/presence && git commit -m "feat(presence): lesson series rows linked to planned lessons"`

### Task 6: Create a repeating lesson (coach) with conflicts (high, Sonnet)

**Files:**
- Create: `src/club/presence/lessons/series.ts`
- Modify: `src/club/presence/lessons/input.ts` (`readLessonRepeat`), `src/club/presence/history-lines.ts` and `src/club/presence/copy/history.ts` (`P5_ACTIONS.lessonSeriesAdded`, `lessonSeriesEnded`), `src/club/presence/copy/attendance.ts` (`LESSON_ERRORS.conflict`), `src/club/portal/coach/{api-types,lessons}.ts`
- Test: `src/club/presence/__tests__/lesson-series.test.ts`, `src/club/portal/coach/__tests__/lessons.test.ts` (extend)

**Interfaces:**
- Produces:

```ts
/** The dates of the rule from `from` to `to`, by the group expansion (classDates on a synthetic event), breaks ignored (Open question 3). */
export function seriesDates(rule: Pick<LessonSeriesWrite, 'freq' | 'days' | 'weekOfMonth' | 'startTime' | 'durationMin' | 'from' | 'to'>): string[];
/** The first lesson of the athlete (outside `ignore`) whose time range meets [startTime, startTime + durationMin) on `date`. */
export function conflictOf(lessons: LessonRow[], date: string, startTime: string, durationMin: number, ignore: Set<string>): LessonRow | null;
export async function createLessonSeries(ctx: PresenceContext, b: LessonBody & { repeat: LessonRepeat }): Promise<ActionResult<CoachLessonCreated>>;
export async function createCoachLesson(c: CoachContexts, body: unknown): Promise<CoachResult<CoachLessonCreated>>; // replaces the old answer type
```

  Without `repeat`: today's `createLesson` plus the conflict check (409) and the answer `{ lessonId, seriesId: null, count: 1, toast }`. With `repeat`: `from` = `date` >= today; `to` = `until` or the last day of the season of `from`; season missing -> 400; dates from `seriesDates`, none or more than 200 -> 400; monthly without `weekOfMonth` -> `'first'` (as `readSeriesInput`). In one transaction: lock the athlete, read it (`nou`/`activ`, coaches exist), check every date for a conflict against the athlete's lessons (first one -> 409 `LESSON_ERRORS.conflict(shortDay(date), startTime)`, nothing written), create the series, then one lesson per date: `state: 'planned'`, `present: null`, no price, `amount: 0`, `seriesId`. Lines: one `lessonSeriesAdded` on `SUBJECT.athlete` (text "Lecții individuale programate: <programLineFrom of the rule>, <n> lecții." with `roCount`) and one `lessonPlanned` per lesson; undo steps `deleteLesson` per lesson then `deleteLessonSeries`; guards per lesson as `createLocked`. Toast "Salvat.".

- [ ] **Step 1: Failing tests** (today `2026-11-10`, Tuesday): weekly Tue, Thu 17:30, 45 min from `2026-11-10` until `2026-12-03` -> `count: 8`, eight lessons on 10, 12, 17, 19, 24, 26 November, 1 and 3 December, all `planned` with `price: null`, `amount: 0` (today's included), each `seriesId` equal to the answer's; the athlete's due and money reads (`src/club/presence/due/reads.ts`, `src/club/money/sources.ts` through their public functions) are deep-equal before and after; biweekly Tue from `2026-11-10` until `2026-12-31` -> 10, 24 November, 8, 22 December; monthly Wed `weekOfMonth: 'second'` from `2026-11-01` to `2027-01-31` -> 11 November, 9 December, 13 January; an existing lesson on `2026-11-19` 17:00 to 18:00 -> 409 "Sportivul are deja o lecție pe joi, 19 nov, la 17:30." and no row written; one at 18:15 the same day is not a conflict; `until` before `from` -> 400; `from` yesterday -> 400; coachIds without the coach -> 403; a single lesson without `repeat` keeps today's behaviour (held and priced when the date is today) and answers `count: 1`; two parallel series creates for the same athlete and the same dates (Postgres test): one 200, one 409; the Istoric of the athlete shows "Lecții individuale programate: Ma și Jo, 17:30, 45 min, din 10 nov 2026, până pe 3 dec 2026, 8 lecții."
- [ ] **Step 2: Run** `npx vitest run src/club/presence/__tests__/lesson-series.test.ts src/club/portal/coach/__tests__/lessons.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command and `npx vitest run src/club/presence src/club/portal/coach`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/presence src/club/portal/coach && git commit -m "feat(portal): coach adds repeating individual lessons"`

### Task 7: Edit a lesson's plan, one or following (high, Sonnet)

**Files:**
- Create: `src/club/presence/lessons/plan.ts`
- Modify: `src/club/presence/lessons/input.ts` (`readLessonPlan`), `src/club/presence/copy/history.ts` (`LESSON_FIELD_LABELS` gains `date: 'Data'`, `startTime: 'Ora'`), `src/club/presence/history-lines.ts`, `src/club/portal/coach/{api-types,lessons,views}.ts`, `src/api/portal/routes/02-coach.ts` (`route('PUT', '/lessons/:documentId/plan', 'planLesson')` before `/lessons/:documentId`), `src/api/portal/controllers/coach.ts`
- Test: `src/club/presence/__tests__/lesson-plan.test.ts`, `src/club/portal/coach/__tests__/lessons.test.ts` (extend)

**Interfaces:**
- Produces:

```ts
export async function planLesson(ctx: PresenceContext, id: string, b: CoachLessonPlanBody): Promise<ActionResult<CoachLessonCreated>>;
export async function planCoachLesson(c: CoachContexts, id: string, body: unknown): Promise<CoachResult<CoachLessonCreated>>;
```

  Checks: `mine` (404), the lesson `planned` and its date >= today (else 409 `PRESENCE_ERRORS.stale`), body valid with `date` >= today (400), `coachIds` contains the coach (403). `scope: 'one'`: with `repeat` on a series lesson -> 400; otherwise update `date`, `startTime`, `durationMin`, `coachIds` (conflict check ignoring itself), one `lessonEdited` line with the changed fields; with `repeat` on a lesson without a series, that lesson becomes the first row of a new series from `b.date` (Task 6 rules for the others). `scope: 'following'` on a series lesson: lock the athlete, the series, the rows of the series dated on or after the lesson's date (by id); delete those `planned` and `isDeletable`; set the series `to` = lesson date - 1 (delete the series when it has no row left); then write the edited plan as Task 6 does (a new series with `repeat`, one planned lesson without); the conflict check ignores the deleted rows. Lines: `lessonDeleted` per deleted row, `lessonSeriesEnded` on the athlete ("Lecții individuale oprite din <shortDate>: <rule text>."), then the create lines. One undo action holds every step in reverse. `scope: 'following'` on a lesson without a series is `one`.

- [ ] **Step 1: Failing tests** (today `2026-11-10`, the 8-lesson series of Task 6): `one` on the 19 November lesson to 18:00, 60 min -> that row only changes, still in the series, line "Ora: 17:30 -> 18:00" style as `fieldLines` gives; `following` on the 19 November lesson with `repeat: { freq: 'weekly', days: ['thu'], until: null }`, 18:00, 60 min -> rows of 19, 24, 26 November, 1, 3 December deleted, 10, 12, 17 November stay, the old series `to: '2026-11-18'`, a new series Thu 18:00 from `2026-11-19` to the season end with its rows; a planned row with a payment pointing at it stays and the series still ends; today's saved row is never deleted (seed one saved on `2026-11-10` and edit `following` from it -> 409 stale, since a saved lesson is not plan-editable); a lesson of Virgil -> 404; a `date` in the past -> 400; `following` with no `repeat` -> a single planned lesson; undo of a `following` edit gives back exactly the eight original rows and the series `to`.
- [ ] **Step 2: Run** `npx vitest run src/club/presence/__tests__/lesson-plan.test.ts src/club/portal/coach/__tests__/lessons.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/presence src/club/portal/coach src/api/portal && git commit -m "feat(portal): coach changes one lesson or the lessons that follow"`

### Task 8: Delete one or following (high, Sonnet)

**Files:**
- Modify: `src/club/presence/lessons/delete.ts` (`deleteLessonsFrom`), `src/club/portal/coach/lessons.ts` (`deleteCoachLesson(c, id, query)`), `src/api/portal/controllers/coach.ts` (passes `ctx.query`), `src/club/presence/copy/attendance.ts` (`LESSON_COPY.deletedMany`)
- Test: `src/club/presence/__tests__/lesson-delete-following.test.ts`, `src/club/portal/coach/__tests__/lessons.test.ts` (extend)

**Interfaces:**
- Produces:

```ts
export async function deleteLessonsFrom(ctx: PresenceContext, id: string): Promise<ActionResult<{ deleted: true; count: number; toast: string }>>;
```

  `scope=one` (or absent): today's `deleteLesson`, answer gains `count: 1`. `scope=following` on a series lesson: the coach's `right.delete` on the lesson (as today), then the Task 7 deletion part (planned, deletable rows on or after the lesson's date; the lesson itself must be deletable, else 409 stale) and the series end; toast "Lecții șterse." when more than one row went, "Lecție ștearsă." for one. `scope=x` -> 400.

- [ ] **Step 1: Failing tests:** `following` on the 24 November lesson of the 8-lesson series -> `count: 4`, 10 to 19 November stay, series `to: '2026-11-23'`; on the 10 November lesson -> all 8 go and the series row is deleted; `one` on a series lesson deletes only it and leaves the series; a paid row in range stays and `count` excludes it; another coach's lesson -> 404; `scope=x` -> 400 "Cerere invalidă."; the answer keys are exactly `deleted, count, toast`.
- [ ] **Step 2: Run** `npx vitest run src/club/presence/__tests__/lesson-delete-following.test.ts src/club/portal/coach/__tests__/lessons.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/presence src/club/portal/coach src/api/portal && git commit -m "feat(portal): coach deletes one lesson or the lessons that follow"`

### Task 9: Readers: Azi, calendar, Istoric, lesson page, money pins, merge (low, Sonnet)

**Files:**
- Modify: `src/club/portal/coach/{views,lessons}.ts` (`CoachLesson.series`, `planEditable`)
- Test: `src/club/portal/coach/__tests__/{today,calendar,history,lessons}.test.ts` (extend), `src/club/presence/__tests__/money-reads.test.ts` (extend)

**Interfaces:**
- Consumes: lesson rows (series rows are ordinary planned lessons); one-off group classes through `ownClassesBetween` and `rowsWithCoachIds`.
- Produces: `readCoachLesson` fills `series` from `lessonSeries(row.seriesId)` (`untilSeasonEnd` against the season of `from`) and `planEditable`.

- [ ] **Step 1: Failing tests:** a series lesson appears in `readToday` on its date as a `CoachLessonRow` (`done: false`), in `readCoachCalendar` as `kind: 'individual'` with the athlete's name, and after a save in `readCoachHistory` counted in `lessons`; a one-off class added with `repeat: false` for `g-club-a` on `2026-11-25` appears in the calendar on that date with its `occurrenceKey`, in Azi on that date, and in Istoric as not done after the date; a removed date (Task 1) appears in none of them; `readCoachLesson` of a series lesson -> `series` with `freq`, `days`, `from`, `to`, `untilSeasonEnd`, and `planEditable: true`; of a saved lesson -> `planEditable: false`; of a plain lesson -> `series: null`; the money overview and the due list of the month are deep-equal before and after creating a series of future lessons; `forbiddenKeysIn` empty on every answer.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/coach src/club/presence/__tests__/money-reads.test.ts`. Expected: FAIL on the new assertions only.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club && git commit -m "feat(portal): coach readers show repeating lessons and one-off classes"`

### Task 10: Matrix, boot check, click-through (high, Sonnet)

**Files:**
- Modify: `src/club/portal/coach/__tests__/matrix.test.ts`
- Create: `scripts/fixtures/training-add.js`, `scripts/clickthrough-training-add.sh`

**Permission matrix (rows added to `matrix.test.ts`):**

| Route | Own Club group or own lesson | Own Școala group | Another coach's group or lesson | Removed link | Other refusals pinned |
|---|---|---|---|---|---|
| `POST /groups/:id/program` with `until` | 200 | 403 | 403 | 403 | 400 `until` out of season |
| `PUT /program/:eventId` with `day` | 200 | 403 | 403 | 403 | 400 day not in event |
| `POST /program/:eventId/end` with `day` | 200 | 403 | 403 | 403 | 400 past `from` |
| `PUT /program/:eventId/dates/:date` `remove` | 200 | 403 | 403 | 403 | 409 saved session, 400 past date |
| `POST /lessons` with `repeat` | 200 (coach listed) | n/a | 403 (coach not listed) | n/a | 409 conflict, 400 `from` past |
| `PUT /lessons/:id/plan` | 200 | n/a | 404 | n/a | 409 saved lesson |
| `DELETE /lessons/:id?scope=following` | 200 | n/a | 404 | n/a | 400 bad scope |

- [ ] **Step 1: Matrix:** add the rows above; every answer passes `forbiddenKeysIn`, no `undo` or `actionId`, no price.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/coach/__tests__/matrix.test.ts`. Expected: PASS.
- [ ] **Step 3: Full suite in this worktree:** `npx tsc --noEmit && npx vitest run`. Record the counts in the ledger.
- [ ] **Step 4: Boot check** on a throwaway Postgres: `lsof -i :55473 -i :1393` (both free), `docker run -d --name es-ta-pg -e POSTGRES_PASSWORD=pg -p 127.0.0.1:55473:5432 postgres:16`, Strapi with `DATABASE_PORT=55473 PORT=1393` and the env of Global Constraints; it boots, the tables `club_lesson_series` and the `series` link of `club_individual_lessons` exist (`\dt` in `psql` inside the container), the exception enum accepts `sters`; load the fixtures (phase 4, 5, 6, coach additions, then `training-add.js`: a Club group of `antrenor1@example.invalid` with Tue and Thu 17:30, one athlete with a lesson).
- [ ] **Step 5: Click-through** `scripts/clickthrough-training-add.sh` with curl through the coach BFF secret: add a weekly group series with `until`, read `rules`, end Tuesday from next week, remove one Thursday, keep it back, add a one-off class, create an 8-lesson series, read the lesson (`series` set), edit `following`, delete `following`; each step checks the status and one field; any non-2xx fails the script. Then `docker rm -f es-ta-pg`.
- [ ] **Step 6: Commit** `git add src/club/portal/coach scripts && git commit -m "test(portal): training add matrix, boot check fixtures and click-through"`

## Open questions for the user

Each has a default the plan builds if the user does not answer.

1. **Program writes on Școala groups.** The boards show "Intermediari Bronze, Școala de patinaj" with "Schimbă", "Șterge" and the public switch, but today a coach may change only his Club groups' program (spec 9.9, `programRight`) and the public switch is Club only. Default: keep the rule; a Școala group's Program tab stays read only and the "Antrenament nou" group picker lists own Club groups only.
2. **"Lunar".** The form has day squares but no week of the month. Default: the frontend sends the week of the month of "Din data" (days 1 to 7 first, 8 to 14 second, 15 to 21 third, 22 to 28 fourth, 29 to 31 last), the summary says it (frontend plan); the backend keeps `weekOfMonth` as today.
3. **Pauză dates in a lesson series.** Today a club break cancels group classes only (`breakApplies`). Default: a repeating lesson keeps its dates inside a Pauză (they are written as planned lessons the coach can delete).
4. **Refusal texts.** Defaults: "Data are prezența salvată. Poți doar să o anulezi." (removing a date with presence) and "Sportivul are deja o lecție pe joi, 19 nov, la 17:30." (lesson conflict).
5. **Who may be the lesson's coach.** The board has one "Antrenor" select; today a coach's lesson must list the coach himself (403 otherwise). Default: keep the rule; the form shows the coach and may add others (frontend plan).
6. **Parents told of a cancelled date.** The single-date sheet says "Părinții văd data anulată și nota." and has no e-mail tick. Default: no e-mail from the coach's cancel (`notifyParents` not sent); the note shows wherever the date shows.
