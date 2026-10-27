# Phase 4-1: Groups, Memberships and Undo (backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the backend every phase 4 schema change and the group roster: the group store (Strapi and in-memory), the Grupe list, "Fără grupă", the group page read, "Grupă nouă" / "Editează grupa" / "Șterge grupa", "Alocă", "Alocă toți", "Adaugă sportivi", "Adaugă și în grupă", "Mută", "Scoate din grupă", one undo route for every phase 4 action, every phase 4 Istoric line, and the admin routes of `06-groups.ts`.

**Architecture:** Rules are pure modules in `src/club/groups/` (dates, copy, program texts, series reading, membership plans, history lines, undo records), tested with Vitest. Services run them on one storage interface, `GroupStore` (`src/club/groups/types.ts`), implemented on Strapi (`strapi-store.ts`, document service writes, `db.query` reads, the P3 transaction and row-lock helper) and in memory for tests (`__tests__/fake-group-store.ts`, whose transaction restores a snapshot). Every write action records its Istoric lines; the first line of an action carries the undo record, and its documentId is the `actionId` the toast's "Anulează" sends to `POST /club/undo`. The P3 `ClubStore` gains the membership `to` date, and the P3 readers count current memberships only. Plans 4-2 (schedules), 4-3 (new season), 4-4 (migration) and the admin plans 4-5 / 4-6 consume what this plan defines; they read the "Interfaces for other plans" section at the end.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS, `strict: false` server), Postgres 16, Vitest 3, Node 22.

**Spec:** `docs/superpowers/specs/2026-10-27-groups-schedules-design.md` (v1.1, approved 2026-10-27), sections 1, 2, 3 (data, all of it: the later plans add no schema), 5.2 to 5.4, 6.1, 6.2, 6.4, 8.1, 8.2 (group, membership and undo routes), 11, 12. Decisions: `../edusport_frontend/docs/portal/DECISIONS.md` (a later dated entry wins over the spec). Rules for executing agents: `.superpowers/phase3-shared/agent-rules.md` (they apply to phase 4 unchanged). Index of the phase 4 plans: `docs/superpowers/plans/2026-10-27-phase4-index.md`.

**Base:** `feat/athletes` with phase 3 and 3C merged. 3C Task 10 (security fix) changes `src/policies/is-admin.ts` and `src/club/admin-actor.ts`; this plan uses `global::is-admin` and `adminActor(...)` by name only and edits neither file.

**Parallel groups:** A: T1, T2 | B: T3, T4 | C: T5, T6 | D: T7, T8 | E: T9 | F: T10 | G: T11 | H: T12

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Schemas, 2 Foundation (types, dates, copy, program texts, series) | nothing | 1: schema.json, routers, types/generated; 2: new files in `src/club/groups/` |
| B | 3 Membership rules and `MembershipRow.to`, 4 History lines | 2 | 3: membership-plan.ts, group-membership.ts, athletes/store.ts, athletes/strapi-store.ts, fake-store.ts, P3 readers; 4: history-lines.ts, history-text.ts, copy/core.ts |
| C | 5 Undo records, 6 Group store and context | 3 (and 4 for 6's history rows) | 5: undo.ts; 6: groups/strapi-store.ts, groups/context.ts, groups/__tests__/fake-group-store.ts, the P3 `transactionScope` export |
| D | 7 Grupe reads, 8 Group create / edit / delete | 6 | 7: list.ts, unassigned.ts, group-page.ts, api-types.ts; 8: group-admin.ts |
| E | 9 Membership actions | 7 (options) | members.ts, action-log.ts |
| F | 10 Undo route service | 9 | undo-service.ts |
| G | 11 Group Istoric read, routes, controller | 7 to 10 | routes/06-groups.ts, controllers/groups.ts |
| H | 12 Production-shape fixture and boot check | everything | scripts/fixtures/phase4-shape.js only |

## Decided while planning (low impact, decided by Claude; the user may overrule any line)

Log them in DECISIONS.md as "plan 4-1, decided by Claude (low impact, 2026-10-27)". Each is implemented in the one place named.

1. **Move lines on the two groups.** Spec 3.7 gives "Mutat în <grupă>: <nume>." and "Mutat din <grupă>: <nume>." with "(on the group left)" after the second; the approved mockup grupa-a A10 shows "... mutată în Intermediari Silver" on the group the child left. The group left gets "Mutat în <grupa nouă>: <nume>." (plus the main-group sentence), the group joined gets "Mutat din <grupa veche>: <nume>." (`history-lines.ts`).
2. **Group Istoric never stores a child's name.** Group lines store the athlete id and show the athlete's current name when read, so a later anonymization (3C) leaves "Sportiv anonimizat" in group Istoric, not the old name (`history-lines.ts`, `group-history.ts`).
3. **Undo refusal is per subject.** "A later change touched the same rows" (W15) is checked as: any later Istoric line on the same group, athlete or season, written by anything other than the action itself. A later change to another child of the same group therefore also refuses the undo with "Nu se mai poate anula. Grupa s-a schimbat între timp." (`undo.ts::undoRefusal`). The new-season undo (plan 4-3) is refused after any later group, athlete or season line anywhere ("anything changed since", spec 10.5) (`undo-service.ts::laterLines`). The server does not check the 8 seconds; the toast is the only way in.
4. **After a successful "Anulează"** the admin shows the toast "Anulat." (`copy/core.ts`, `GROUP_TOASTS.undone`); a refused undo shows the refusal text as an error toast.
5. **"Șterge grupa"** answers the toast "Grupă ștearsă: <nume>." and writes the group line "Grupă ștearsă: <nume>." (kept in the database, no screen shows it) (`group-admin.ts`).
6. **"Alocă" leaves the status as it is** (a "Nou" child stays "Nou"); only "Adaugă sportivi" and "Adaugă și în grupă" reactivate an "Inactiv" child (spec 6.2) (`members.ts`).
7. **Past season.** A season is past when its label sorts before the current season's label (so 2026-2027 becomes read-only the moment 2027-2028 is made current, as the new-season window says). Writes on a past season answer 409 "Datele s-au schimbat. Reîncarcă pagina." (`season-pick.ts::isPastSeason`).
8. **Proposed group** (5.3) is the athlete's current main row of the previous season (the season whose label starts one year earlier), when that group is still active (`unassigned.ts`).
9. **History of the "Copiat din" season line** leaves out a part whose count is 0 ("Copiat din 2026-2027: 10 programe."), and writes no line when nothing was copied (`history-lines.ts`, used by plan 4-3).
10. **One single class deleted ("Șterge ședința")** has no line in spec 3.7; it writes "Ședință unică ștearsă: <zi>, <data>, <ora>." (`history-lines.ts`, used by plan 4-2).
11. **"Ședința din <data> mutată"** ends with " Părinții anunțați pe e-mail." when the box was ticked, as the cancelled line does (spec 6.5 last line) (`history-lines.ts`).
12. **A reason that already ends in ".", "!" or "?"** gets no second period in the cancelled line either (the W33 e-mail rule) (`history-lines.ts::sentence`).
13. **Core routers.** `calendar-event` and `calendar-blackout` get `createCoreRouter(uid, { only: [] })` like `group` already has, so `/api/calendar-events` and `/api/calendar-blackouts` do not exist for anyone (404), whatever the Public role allows. Nothing reads them (checked: frontend and backend). The spec's "403" check becomes "never 200" (Task 12).
14. **Copy module.** Spec 11 wants every phase 4 string in `src/club/groups/copy.ts`. It is one module made of files: `copy.ts` re-exports `copy/core.ts` (this plan), `copy/schedule.ts` (4-2), `copy/new-season.ts` (4-3), `copy/grupe-ui.ts` (4-5), `copy/calendar-ui.ts` (4-6), so plans running in parallel never edit the same lines. One test scans every file in `copy/`.
15. **Extra read routes** (technical, not in spec 8.2): `GET /club/groups/options` (price lists, coaches and the group choices of the move window) and `GET /club/groups/:documentId/history`'s count in the page read.
16. **Group names** are compared with `nameKey` of `src/club/migrate/names.ts` (case and diacritics, cedilla and comma letters equal) within the group's section; a name is stored with comma letters (`normalizeGroupName`).

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes`. Commit only in the worktree your dispatch names (never in the integration worktrees p3be or p3fe); before every commit run `git rev-parse --show-toplevel` and `git branch --show-current` and compare with the dispatch.
- A dated entry in `edusport_frontend/docs/portal/DECISIONS.md` wins over the spec; the spec wins over this plan's prose; this plan's code is followed verbatim unless it fails (fix the minimum, say what and why).
- Checks after every task: the task's test file (`npx vitest run <file>`), the full suite (`npx vitest run`), `npx tsc --noEmit` (zero errors).
- Code: TypeScript, no `any` (Strapi uids as `as const` strings or `UID.ContentType`), single quotes in `src/`, functions under 30 lines, cyclomatic complexity under 10, data passed to a Strapi json attribute is a `type` alias, no dead code, no comments that restate code.
- Admin routes: `{ auth: false, policies: ['global::is-admin'], middlewares: [] }`; fixed paths before parameter paths in each routes file (`/club/groups/unassigned` and `/club/groups/options` before `/club/groups/:documentId`). The actor comes from `adminActor` (`src/club/admin-actor.ts`).
- Lock order (binding): registrations, then athletes (sorted by id), then groups (sorted by id), then calendar events. Phase 4 membership writes take no registration lock. Season rows (plan 4-3 only) are locked before athletes. Never call a lock outside `store.transaction`.
- Every write is all or nothing per action (one `store.transaction`); a failure answers 500 with "Acțiunea nu a reușit. Nimic nu a fost salvat." through `guarded` (`src/club/admin-result.ts`). Every write records its Istoric lines (SPEC 2 rule 9).
- After a schema change: `DATABASE_CLIENT=postgres npx strapi ts:generate-types` and commit `types/generated/` in the same task. A new attribute is saved only after Strapi restarts.
- `src/admin` is excluded from Vitest; rules live in `src/club/**` (pure modules have no Strapi, Node or React imports so the admin bundle can import them).
- Copy: Romanian copy exactly as the spec gives it; every phase 4 string in `src/club/groups/copy.ts` (and its `copy/` files); ș and ț with the comma below; straight quotes "..."; the spec's "->" is the arrow "→"; no em dash; no middle dot; no emoji; terse; gender-neutral forms (W1).
- Tests and checks use synthetic data only. Never run anything against production, the user's local containers `strapi_app` / `strapi_db`, ports 1337 or 5432, or the user's TEST environment (ports 1340 / 3010, container `edusport-test-pg`). Task 12 uses container `es41-pg` on 127.0.0.1:55441 and Strapi on 1361 only.
- Commits: Conventional Commits, exactly the message in the task, no `Co-Authored-By`, no AI attribution (after each commit run `git log -1 --format=%B` and amend if a trailer slipped in). Never push. Never commit `.env`.
- Progress board: one appended line per status change to `/Users/codrin/Documents/Programming/edusport_backend/.superpowers/phase3-shared/progress-board.md`, e.g. `printf '%s | 4-1 T6 | implementer | tests green | 22/22\n' "$(date -u +%H:%M)" >> <that path>`.

## Review Focus

- **Two admins act on the same child at the same moment** (one clicks "Alocă", the other "Adaugă sportivi" with the same child into another group): both run, one after the other on the athlete lock, and the child ends with exactly one main group; never two mains, never zero. Pinned by Task 9 (`second join is not main`) and Task 12 (two parallel curl calls, then the SQL count of main rows).
- **Undo after someone else changed the group** (the admin's own toast is still on screen, another admin moved another child out): the undo is refused with "Nu se mai poate anula. Grupa s-a schimbat între timp." and nothing is reverted; an undo sent twice is refused the second time. Pinned by Task 5 and Task 10.
- **Ending a membership that started today or in the future** (a child placed by mistake this morning, or before the season starts): the row is deleted rather than ended with `to` before `from`, and the undo brings back an identical row. Pinned by Task 3 (`leaveWrite`) and Task 10 (`createMembership` undo).
- **A season switch, a past season, or a season label that does not exist** in the query (`?season=2019-2020`, an old link after 2027-2028 became current): reads fall back to the current season, writes on a past season answer 409, nothing throws. Pinned by Task 7 (`pickSeason`) and Task 9 (`past season is refused`).
- **Anonymized athletes in group lists** (3C): never offered in "Fără grupă", never addable, shown in a roster as "Sportiv anonimizat" (their current name), and group Istoric shows the anonymized name, not the old one. Pinned by Task 7 (`anonymized never unassigned`) and Task 11 (`group Istoric reads the current name`).

---

## File Structure

```
src/api/group/content-types/group/schema.json                    programPublic (T1)
src/components/calendar/exception.json                           reason (T1)
src/api/email-job/content-types/email-job/schema.json            kind schedule-change, group, payload, changeKey, notBefore (T1)
src/api/calendar-event/routes/calendar-event.ts                  core router { only: [] } (T1)
src/api/calendar-blackout/routes/calendar-blackout.ts            core router { only: [] } (T1)
src/club/groups/
  types.ts            row types, GroupStore, ScheduleChangePayload (T2)
  dates.ts            ISO date and time helpers, Romanian date texts (T2)
  copy.ts             re-exports copy/*.ts (T2; one export line per later plan)
  copy/core.ts        GROUP_ERRORS, GROUP_TOASTS, GROUP_LINES, sourceLine, membersText, groupsText (T2)
  program-text.ts     DAY_ORDER, DAY_SHORT, DAY_OF_INDEX, daysList, daysSpoken, listLine, programLine, programLineFrom (T2)
  series.ts           SeriesView, ClassView, seriesView, classView, seasonBounds, overlapsSeason, runningOn, groupSeries, currentSeries, seriesText (T2)
  membership-plan.ts  MembershipWrite, MembershipPlan, currentRows, leaveWrite, planJoin, planMove, planRemove, earliestRow (T3)
  history-lines.ts    GROUP_SUBJECT, BREAK_SUBJECT, SEASON_SUBJECT, P4_ACTIONS, phase4Lines, groupHistoryTexts, sentence (T4)
  undo.ts             UndoStep, UndoRecord, Subject, membershipUndo, readUndoRecord, undoRefusal, undoLockTargets (T5)
  strapi-store.ts     strapiGroupStore (T6)
  context.ts          GroupContext, groupContext (T6)
  season-pick.ts      startYear, currentSeason, pickSeason, isPastSeason, previousSeason, seasonRef, seasonChoices, startDateFor (T7)
  api-types.ts        every JSON shape of the 06-groups routes (T7)
  list.ts             readGroupList (T7)
  unassigned.ts       unassignedRows, readUnassigned, groupChoices (T7)
  group-page.ts       readGroupPage, readGroupOptions (T7)
  sections.ts         orderedSections, sectionLabel, byGroupOrder, groupChoices (T7)
  group-history.ts    readGroupHistory (T7)
  group-admin.ts      readGroupInput, createGroup, updateGroup, deleteGroup (T8)
  action-log.ts       Line, ActionResult, subjectsOf, recordAction, recordLines, done (T9)
  members.ts          readJoinBody, readAllocateBody, joinGroup, allocateAll, moveMembership, removeMembership (T9)
  undo-service.ts     readActionId, undoAction (T10)
  http.ts             respondAction, todayIso, queryText (T11)
  __tests__/fake-group-store.ts   fakeGroupStore, fakeContext, seed rows (T6)
  __tests__/*.test.ts            one test file per task
src/club/history-text.ts           historyTexts falls back to phase 4 lines and "Anulat: " (T4)
src/club/group-membership.ts       checkMainGroup on current rows, isCurrentMembership (T3)
src/club/athletes/store.ts, strapi-store.ts, __tests__/fake-store.ts   MembershipRow.to (T3); transactionScope (T6)
src/club/athletes/confirm-service.ts, confirm-read.ts, record.ts, list.ts  current memberships only (T3)
src/api/club/routes/06-groups.ts, src/api/club/controllers/groups.ts       (T11)
scripts/fixtures/phase4-shape.js   the production shape on a throwaway database (T12)
```

---

### Task 1: Schemas

**Files:**
- Modify: `src/api/group/content-types/group/schema.json`
- Modify: `src/components/calendar/exception.json`
- Modify: `src/api/email-job/content-types/email-job/schema.json`
- Modify: `src/api/calendar-event/routes/calendar-event.ts`
- Modify: `src/api/calendar-blackout/routes/calendar-blackout.ts`
- Modify: `src/email/__tests__/email-job-schema.test.ts`
- Create: `src/club/groups/__tests__/schemas.test.ts`
- Regenerate: `types/generated/`

**Interfaces:**
- Consumes: nothing.
- Produces (database attributes every later phase 4 task reads and writes):
  - group: `programPublic` boolean, default true (read as `programPublic !== false`, W8).
  - `calendar.exception`: `reason` string, max 120.
  - email-job: `kind` enum `registration | schedule-change`; `group` manyToOne group; `payload` json; `changeKey` string; `notBefore` datetime.
  - No content-api routes for `calendar-event` and `calendar-blackout` (Decided 13).

- [ ] **Step 1: Write the failing schema test**

`src/club/groups/__tests__/schemas.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..', '..');
const json = (p: string) => JSON.parse(readFileSync(join(SRC, p), 'utf8'));
const source = (p: string) => readFileSync(join(SRC, p), 'utf8');

describe('phase 4 schema', () => {
  it('groups carry "Program public", on by default (3.1, W8)', () => {
    expect(json('api/group/content-types/group/schema.json').attributes.programPublic).toEqual({ type: 'boolean', default: true });
  });

  it('a per-date exception keeps an optional reason of at most 120 characters (3.4)', () => {
    expect(json('components/calendar/exception.json').attributes.reason).toEqual({ type: 'string', maxLength: 120 });
  });

  it('e-mail jobs know schedule changes: group, payload, change key and a not-before time (3.6)', () => {
    const a = json('api/email-job/content-types/email-job/schema.json').attributes;
    expect(a.kind).toEqual({ type: 'enumeration', enum: ['registration', 'schedule-change'], required: true, default: 'registration' });
    expect(a.group).toEqual({ type: 'relation', relation: 'manyToOne', target: 'api::group.group' });
    expect(a.payload).toEqual({ type: 'json' });
    expect(a.changeKey).toEqual({ type: 'string' });
    expect(a.notBefore).toEqual({ type: 'datetime' });
  });

  it('calendar events and breaks have no generated content-api routes, so a non-public group never leaks (8.3)', () => {
    for (const name of ['calendar-event', 'calendar-blackout']) {
      expect(source(`api/${name}/routes/${name}.ts`), name).toContain('{ only: [] }');
    }
  });
});
```

In `src/email/__tests__/email-job-schema.test.ts`, replace the keys assertion of the second test with:

```ts
  expect(Object.keys(attributes)).toEqual([
    'recipient', 'subject', 'kind', 'registration', 'status', 'attempts', 'lastError', 'sentAt', 'group', 'payload', 'changeKey', 'notBefore',
  ]);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/groups/__tests__/schemas.test.ts src/email/__tests__/email-job-schema.test.ts`
Expected: FAIL (`programPublic` undefined, keys differ, `only: []` missing).

- [ ] **Step 3: Write the schemas and routers**

`src/api/group/content-types/group/schema.json`, after the `coaches` attribute (add a comma after its closing brace):

```json
    "programPublic": { "type": "boolean", "default": true }
```

`src/components/calendar/exception.json`, after `"newDate": { "type": "date" }` (add a comma after it):

```json
    "reason": { "type": "string", "maxLength": 120 }
```

`src/api/email-job/content-types/email-job/schema.json`: change the `kind` line and add four attributes after `sentAt`:

```json
    "kind": { "type": "enumeration", "enum": ["registration", "schedule-change"], "required": true, "default": "registration" },
```

```json
    "sentAt": { "type": "datetime" },
    "group": { "type": "relation", "relation": "manyToOne", "target": "api::group.group" },
    "payload": { "type": "json" },
    "changeKey": { "type": "string" },
    "notBefore": { "type": "datetime" }
```

`src/api/calendar-event/routes/calendar-event.ts` (whole file):

```ts
import { factories } from '@strapi/strapi';

/** No generated content-api routes: the calendar is read through /api/calendar/occurrences and written through the admin routes. */
export default factories.createCoreRouter('api::calendar-event.calendar-event', { only: [] });
```

`src/api/calendar-blackout/routes/calendar-blackout.ts` (whole file):

```ts
import { factories } from '@strapi/strapi';

/** No generated content-api routes: breaks are read through the occurrences routes and written through /api/club/breaks. */
export default factories.createCoreRouter('api::calendar-blackout.calendar-blackout', { only: [] });
```

- [ ] **Step 4: Regenerate the types and run the checks**

Run: `DATABASE_CLIENT=postgres npx strapi ts:generate-types && npx vitest run src/club/groups/__tests__/schemas.test.ts src/email/__tests__/email-job-schema.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; `types/generated/contentTypes.d.ts` contains `programPublic` and `notBefore`, `types/generated/components.d.ts` contains `reason`; zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/api/group src/components/calendar/exception.json src/api/email-job/content-types src/api/calendar-event/routes/calendar-event.ts src/api/calendar-blackout/routes/calendar-blackout.ts src/email/__tests__/email-job-schema.test.ts src/club/groups/__tests__/schemas.test.ts types/generated
git commit -m "feat(groups): program public, exception reason, schedule-change e-mail jobs, no core calendar routes"
```

---

### Task 2: Foundation (types, dates, copy, program texts, series)

**Files:**
- Create: `src/club/groups/types.ts`, `src/club/groups/dates.ts`, `src/club/groups/copy.ts`, `src/club/groups/copy/core.ts`, `src/club/groups/program-text.ts`, `src/club/groups/series.ts`
- Test: `src/club/groups/__tests__/foundation.test.ts`, `src/club/groups/__tests__/copy.test.ts`

**Interfaces:**
- Consumes: `MembershipRow`, `AthleteRow`, `RegistrationRow`, `SectionRow` (`src/club/athletes/store.ts`; `MembershipRow.to` arrives in Task 6, `types.ts` only re-uses the type), `HistoryInput` (`src/club/history.ts`), `countWords` (`src/club/ro-count.ts`), `AthleteStatus` (`src/club/athlete-data.ts`).
- Produces:
  - `types.ts`: `DayKey`, `Freq`, `WeekOfMonth`, `ExceptionKind`, `ExceptionRow`, `Recurrence`, `EventRecord`, `EventWrite`, `BreakRecord`, `GroupRecord`, `GroupWrite`, `SectionRecord`, `SeasonRecord`, `NamedRow`, `PriceListRow`, `HistoryEntryRow`, `ActionRef`, `Subject`, `ScheduleChangePayload`, `ScheduleEmailJob`, `MembershipWhere`, `GroupStore` (every method, used by plans 4-1 to 4-4).
  - `dates.ts`: `MONTHS_LONG`, `MONTHS_SHORT`, `WEEKDAYS`, `isIsoDate(v): v is string`, `isTime(v): v is string`, `addDays(iso, n): string`, `weekdayIndex(iso): number`, `weekdayName(iso): string`, `capitalized(s): string`, `dayMonth(iso): string`, `shortDate(iso): string`, `hhmm(t): string | null`, `minutesOf(t): number`, `timeOf(min): string`, `addMinutes(t, n): string`, `minutesBetween(a, b): number`, `clampDate(iso, lo, hi): string`.
  - `copy/core.ts`: `ARROW`, `GROUP_ERRORS`, `GROUP_TOASTS`, `GROUP_LINES`, `FIELD_LABELS`, `sourceLine(kind, season, age): string`, `athletesText(n)`, `groupsText(n)`, `seriesCountText(n)`.
  - `program-text.ts`: `DAY_ORDER`, `DAY_SHORT`, `DAY_OF_INDEX`, `SeriesText`, `daysList`, `daysSpoken`, `listLine`, `programLine`, `programLineFrom`.
  - `series.ts`: `RepeatFreq`, `SeriesView`, `ClassView`, `seriesView(e)`, `classView(e)`, `seasonBounds(s)`, `overlapsSeason(x, s)`, `runningOn(s, date)`, `groupSeries(events, groupId, season)`, `groupClasses(events, groupId, season)`, `currentSeries(events, groupId, season, today)`, `seriesText(s)`.

- [ ] **Step 1: Write the failing tests**

`src/club/groups/__tests__/foundation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addDays, addMinutes, clampDate, dayMonth, isIsoDate, isTime, minutesBetween, shortDate, weekdayName } from '../dates';
import { daysList, daysSpoken, listLine, programLine, programLineFrom } from '../program-text';
import { classView, currentSeries, groupSeries, runningOn, seriesView } from '../series';
import type { EventRecord, Recurrence, SeasonRecord } from '../types';

const SEASON: SeasonRecord = { id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', isCurrent: true, membershipFee: 270 };
const rec = (over: Partial<Recurrence>): Recurrence => ({
  freq: 'weekly', days: ['sat', 'sun'], weekOfMonth: null, startTime: '11:00', endTime: '11:50', singleDate: null, seasonStart: '2026-10-04', seasonEnd: '2027-05-31', ...over,
});
const ev = (id: string, over: Partial<Recurrence> = {}, groupId: string | null = 'g-ib'): EventRecord => ({
  id, title: 'Intermediari Bronze', type: 'scoala', description: null, groupId, recurrence: rec(over), exceptions: [],
});

describe('dates', () => {
  it('formats the Romanian dates of the spec', () => {
    expect(dayMonth('2026-11-14')).toBe('14 noiembrie');
    expect(shortDate('2026-10-04')).toBe('4 oct 2026');
    expect(weekdayName('2026-11-14')).toBe('sâmbătă');
  });

  it('adds days across months and years, and rejects impossible dates', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-02-28')).toBe(true);
  });

  it('works on HH:mm times', () => {
    expect(isTime('09:05')).toBe(true);
    expect(isTime('24:00')).toBe(false);
    expect(addMinutes('11:00', 50)).toBe('11:50');
    expect(minutesBetween('10:00', '11:30')).toBe(90);
    expect(clampDate('2026-09-01', '2026-10-01', '2027-05-31')).toBe('2026-10-01');
  });
});

describe('program texts (5.2, 6.3, 3.7)', () => {
  const s = { freq: 'weekly' as const, days: ['sun', 'sat'] as const, startTime: '11:00', durationMin: 50, from: '2026-10-04' };

  it('lists days Monday first', () => {
    expect(daysList(['sun', 'sat'])).toBe('Sâ, Du');
    expect(daysSpoken(['fri', 'mon', 'wed'])).toBe('Lu, Mi și Vi');
    expect(daysSpoken(['sat'])).toBe('Sâ');
  });

  it('writes the list, Program obișnuit and history forms', () => {
    expect(listLine(s)).toBe('Sâ, Du 11:00');
    expect(programLine(s)).toBe('Sâ și Du, 11:00, 50 min');
    expect(programLine({ ...s, freq: 'biweekly' })).toBe('Sâ și Du, 11:00, 50 min, la 2 săptămâni');
    expect(programLine({ ...s, freq: 'monthly' })).toBe('Sâ și Du, 11:00, 50 min, lunar');
    expect(programLineFrom(s)).toBe('Sâ și Du, 11:00, 50 min, din 4 oct 2026');
  });
});

describe('series of a group', () => {
  it('reads a series and a one-off class, start + duration', () => {
    expect(seriesView(ev('e1'))).toMatchObject({ eventId: 'e1', freq: 'weekly', startTime: '11:00', durationMin: 50, from: '2026-10-04', to: '2027-05-31' });
    expect(seriesView(ev('e2', { freq: 'none', singleDate: '2026-11-20' }))).toBeNull();
    expect(classView(ev('e2', { freq: 'none', singleDate: '2026-11-20', startTime: '18:00', endTime: '19:00' }))).toEqual({
      eventId: 'e2', date: '2026-11-20', startTime: '18:00', endTime: '19:00', durationMin: 60, note: null,
    });
  });

  it('keeps the series of the group that touch the season, oldest first', () => {
    const events = [ev('late', { seasonStart: '2026-11-07' }), ev('early'), ev('other', {}, 'g-pp'), ev('old', { seasonStart: '2025-10-04', seasonEnd: '2026-05-31' })];
    expect(groupSeries(events, 'g-ib', SEASON).map((s) => s.eventId)).toEqual(['early', 'late']);
  });

  it('Program obișnuit drops a series that ended before today; a past season shows what ran on its last day', () => {
    const events = [ev('ended', { seasonEnd: '2026-11-06' }), ev('now', { seasonStart: '2026-11-07' })];
    expect(currentSeries(events, 'g-ib', SEASON, '2026-11-20').map((s) => s.eventId)).toEqual(['now']);
    expect(currentSeries(events, 'g-ib', SEASON, '2027-09-01').map((s) => s.eventId)).toEqual(['now']);
    expect(currentSeries(events, 'g-ib', SEASON, '2026-09-01').map((s) => s.eventId)).toEqual(['ended', 'now']);
  });

  it('knows whether a series runs on a date', () => {
    const s = seriesView(ev('e1'));
    expect(s && runningOn(s, '2027-05-31')).toBe(true);
    expect(s && runningOn(s, '2026-10-03')).toBe(false);
  });
});
```

`src/club/groups/__tests__/copy.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GROUP_TOASTS, athletesText, groupsText, sourceLine } from '../copy';

const DIR = join(__dirname, '..', 'copy');

describe('phase 4 copy (spec 11)', () => {
  it('has no em dash, no middle dot, no curly quotes and no cedilla letters in any copy file', () => {
    for (const file of readdirSync(DIR)) {
      const text = readFileSync(join(DIR, file), 'utf8');
      expect(text, file).not.toMatch(/[—·“”„şţŞŢ]/);
    }
  });

  it('uses the Romanian number forms', () => {
    expect(athletesText(1)).toBe('1 sportiv');
    expect(athletesText(20)).toBe('20 de sportivi');
    expect(groupsText(1)).toBe('1 grupă');
    expect(GROUP_TOASTS.allocatedAll(1)).toBe('1 sportiv alocat în grupa propusă.');
    expect(GROUP_TOASTS.allocatedAll(3)).toBe('3 sportivi alocați în grupele propuse.');
    expect(GROUP_TOASTS.added(20)).toBe('20 de sportivi adăugați în grupă.');
  });

  it('writes the "Fără grupă" source line, the age left out when unknown (5.3, W30)', () => {
    expect(sourceLine('registration', null, 12)).toBe('Înscriere Școală, 12 ani');
    expect(sourceLine('previous', '2026-2027', 1)).toBe('Din 2026-2027, 1 an');
    expect(sourceLine('added', null, null)).toBe('Adăugat în Sportivi');
  });

  it('keeps the gender-neutral toasts (W1)', () => {
    expect(GROUP_TOASTS.allocated('Intermediari Bronze', 'Elisa Georgescu')).toBe('Sportiv alocat în Intermediari Bronze: Elisa Georgescu.');
    expect(GROUP_TOASTS.moved('Intermediari Silver', 'Ana Ionescu')).toBe('Sportiv mutat în Intermediari Silver: Ana Ionescu.');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/groups/__tests__/foundation.test.ts src/club/groups/__tests__/copy.test.ts`
Expected: FAIL (`Cannot find module '../dates'`).

- [ ] **Step 3: Write `types.ts`**

```ts
import type { AthleteRow, MembershipRow, RegistrationRow, SectionRow } from '../athletes/store';
import type { AthleteStatus } from '../athlete-data';
import type { HistoryInput } from '../history';

/** Phase 4 rows as the group services see them. Ids are Strapi documentIds; dates 'YYYY-MM-DD'; times 'HH:mm'. */
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type Freq = 'none' | 'weekly' | 'biweekly' | 'monthly';
export type WeekOfMonth = 'first' | 'second' | 'third' | 'fourth' | 'last';
export type ExceptionKind = 'cancel' | 'override' | 'liber' | 'anulat';
export type ExceptionRow = {
  date: string; kind: ExceptionKind; newDate: string | null; newStartTime: string | null; newEndTime: string | null; newTitle: string | null; reason: string | null;
};
export type Recurrence = {
  freq: Freq; days: DayKey[]; weekOfMonth: WeekOfMonth | null; startTime: string | null; endTime: string | null;
  singleDate: string | null; seasonStart: string | null; seasonEnd: string | null;
};
export type EventRecord = { id: string; title: string; type: string; description: string | null; groupId: string | null; recurrence: Recurrence; exceptions: ExceptionRow[] };
export type EventWrite = Omit<EventRecord, 'id'>;
export type BreakRecord = { id: string; label: string; startDate: string; endDate: string };
export type GroupRecord = {
  id: string; name: string; sectionId: string | null; order: number | null; active: boolean; priceListId: string | null; coachIds: string[]; programPublic: boolean;
};
export type GroupWrite = { name: string; sectionId: string; priceListId: string | null; coachIds: string[]; programPublic: boolean };
export type SectionRecord = SectionRow & { slug: string };
export type SeasonRecord = { id: string; label: string; startMonth: string; endMonth: string; isCurrent: boolean; membershipFee: number | null };
export type NamedRow = { id: string; name: string };
export type PriceListRow = { id: string; name: string; sectionId: string | null };
export type HistoryEntryRow = { id: string; seq: number; subjectType: string; subjectId: string; action: string; changes: Record<string, unknown>; actor: string; at: string };
export type ActionRef = { id: string; seq: number };
export type Subject = { type: string; id: string };
/** Stored on a `schedule-change` e-mail job (spec 3.6); `startTime` is the time of the changed date. */
export type ScheduleChangePayload = {
  groupName: string; date: string; startTime: string; mode: 'cancel' | 'move'; newDate: string | null; newStartTime: string | null;
  nextDate: string | null; nextStartTime: string | null; reason: string | null;
};
export type ScheduleEmailJob = { recipient: string; subject: string; groupId: string; changeKey: string; notBefore: string; payload: ScheduleChangePayload };
export type MembershipWhere = { seasonId?: string; groupId?: string; athleteId?: string };
export type NewMembership = { athleteId: string; groupId: string; seasonId: string; isMain: boolean; from: string | null };

export interface GroupStore {
  /** All writes inside `work` are saved together or not at all. */
  transaction<T>(work: () => Promise<T>): Promise<T>;
  /** Inside a transaction: row locks held until it ends. Order: seasons, athletes, groups, events (each sorted by id). */
  lockSeason(id: string): Promise<void>;
  lockAthlete(id: string): Promise<void>;
  lockGroup(id: string): Promise<void>;
  lockEvent(id: string): Promise<void>;
  seasons(): Promise<SeasonRecord[]>;
  sections(): Promise<SectionRecord[]>;
  groups(): Promise<GroupRecord[]>;
  group(id: string): Promise<GroupRecord | null>;
  teamMembers(): Promise<NamedRow[]>;
  priceLists(): Promise<PriceListRow[]>;
  athletes(): Promise<AthleteRow[]>;
  athlete(id: string): Promise<AthleteRow | null>;
  /** Every row, ended ones included; filter with `isCurrentMembership`. */
  memberships(where?: MembershipWhere): Promise<MembershipRow[]>;
  membership(id: string): Promise<MembershipRow | null>;
  registrations(): Promise<RegistrationRow[]>;
  /** Registrations filed under the season after `at` (new-season undo, W28). */
  registrationsFiledAfter(seasonId: string, at: string): Promise<number>;
  events(where?: { groupId?: string }): Promise<EventRecord[]>;
  event(id: string): Promise<EventRecord | null>;
  breaks(): Promise<BreakRecord[]>;
  history(subjectType: string, subjectId: string): Promise<HistoryEntryRow[]>;
  historyEntry(id: string): Promise<HistoryEntryRow | null>;
  /** Lines after `seq` on any of the subjects (null: on any subject at all), oldest first. */
  historyAfter(seq: number, subjects: Subject[] | null): Promise<HistoryEntryRow[]>;
  adminNames(emails: string[]): Promise<Record<string, string>>;
  createGroup(data: GroupWrite & { order: number }): Promise<string>;
  updateGroup(id: string, data: Partial<GroupWrite>): Promise<void>;
  deleteGroup(id: string): Promise<void>;
  createMembership(data: NewMembership & { to?: string | null }): Promise<string>;
  updateMembership(id: string, data: { isMain?: boolean; to?: string | null }): Promise<void>;
  deleteMembership(id: string): Promise<void>;
  setAthleteStatus(id: string, status: AthleteStatus): Promise<void>;
  createEvent(data: EventWrite): Promise<string>;
  updateEvent(id: string, data: Partial<Pick<EventRecord, 'recurrence' | 'exceptions' | 'title'>>): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  createBreak(data: Omit<BreakRecord, 'id'>): Promise<string>;
  updateBreak(id: string, data: Omit<BreakRecord, 'id'>): Promise<void>;
  deleteBreak(id: string): Promise<void>;
  /** Queued `schedule-change` jobs; answers how many were written. */
  createEmailJobs(jobs: ScheduleEmailJob[]): Promise<number>;
  /** Every job of the change still queued becomes `cancelled`; answers how many. */
  cancelEmailJobs(changeKey: string): Promise<number>;
  setSeasonCurrent(id: string, isCurrent: boolean): Promise<void>;
  /** Writes one Istoric line and answers its documentId and order (the undo `actionId`). */
  recordAction(entry: HistoryInput): Promise<ActionRef>;
  record(entry: HistoryInput): Promise<void>;
  setHistoryChanges(id: string, changes: Record<string, unknown>): Promise<void>;
}
```

- [ ] **Step 4: Write `dates.ts`**

```ts
/** Dates and times as phase 4 shows them (spec 3.7, 6.3, 6.5). Pure: ISO 'YYYY-MM-DD' and 'HH:mm' in, Romanian text out. */
export const MONTHS_LONG = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'] as const;
export const MONTHS_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'] as const;
/** Indexed like `getUTCDay()`: 0 is Sunday. */
export const WEEKDAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'] as const;

const pad = (n: number): string => String(n).padStart(2, '0');
const utc = (iso: string): Date => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const toIso = (dt: Date): string => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;

export const isIsoDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && toIso(utc(v)) === v;
export const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export function addDays(iso: string, n: number): string {
  const dt = utc(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return toIso(dt);
}

export const weekdayIndex = (iso: string): number => utc(iso).getUTCDay();
export const weekdayName = (iso: string): string => WEEKDAYS[weekdayIndex(iso)];
export const capitalized = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
/** "14 noiembrie" */
export const dayMonth = (iso: string): string => `${utc(iso).getUTCDate()} ${MONTHS_LONG[utc(iso).getUTCMonth()]}`;
/** "4 oct 2026" */
export const shortDate = (iso: string): string => `${utc(iso).getUTCDate()} ${MONTHS_SHORT[utc(iso).getUTCMonth()]} ${utc(iso).getUTCFullYear()}`;
/** Strapi times arrive as "HH:mm:ss.SSS". */
export const hhmm = (t: string | null | undefined): string | null => (t ? t.slice(0, 5) : null);
export const minutesOf = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const timeOf = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
export const addMinutes = (t: string, n: number): string => timeOf(minutesOf(t) + n);
export const minutesBetween = (start: string, end: string): number => minutesOf(end) - minutesOf(start);
export const clampDate = (iso: string, lo: string, hi: string): string => (iso < lo ? lo : iso > hi ? hi : iso);
```

- [ ] **Step 5: Write the copy module**

`src/club/groups/copy.ts`:

```ts
/** Every phase 4 string (spec 11). One file per plan under ./copy, re-exported here. */
export * from './copy/core';
```

`src/club/groups/copy/core.ts`:

```ts
import { ADMIN_ERRORS } from '../../athletes/errors';
import { countWords } from '../../ro-count';

/** The arrow the spec writes as "->". */
export const ARROW = '→';

export const athletesText = (n: number): string => countWords(n, 'sportiv', 'sportivi');
export const groupsText = (n: number): string => countWords(n, 'grupă', 'grupe');
export const seriesCountText = (n: number): string => countWords(n, 'program', 'programe');
const ageText = (age: number | null): string | null => (age === null ? null : countWords(age, 'an', 'ani'));

export const GROUP_ERRORS = {
  ...ADMIN_ERRORS,
  nameTaken: 'Există deja o grupă cu acest nume.',
  pickGroup: 'Alege grupa.',
  undoGroup: 'Nu se mai poate anula. Grupa s-a schimbat între timp.',
  undoSeason: 'Nu se mai poate anula. Sezonul s-a schimbat între timp.',
  loadFailed: 'Nu am putut încărca datele.',
} as const;

export const GROUP_TOASTS = {
  undo: 'Anulează',
  undone: 'Anulat.',
  created: (name: string) => `Grupă creată: ${name}.`,
  saved: 'Salvat.',
  unchanged: 'Nicio modificare.',
  deleted: (name: string) => `Grupă ștearsă: ${name}.`,
  allocated: (group: string, name: string) => `Sportiv alocat în ${group}: ${name}.`,
  allocatedAll: (n: number) => (n === 1 ? '1 sportiv alocat în grupa propusă.' : `${athletesText(n)} alocați în grupele propuse.`),
  moved: (group: string, name: string) => `Sportiv mutat în ${group}: ${name}.`,
  addedAlso: (group: string, name: string) => `Sportiv adăugat și în ${group}: ${name}.`,
  removed: (group: string, name: string) => `Sportiv scos din ${group}: ${name}.`,
  added: (n: number) => (n === 1 ? '1 sportiv adăugat în grupă.' : `${athletesText(n)} adăugați în grupă.`),
} as const;

/** Istoric lines of the group roster and the athlete (spec 3.7). Program, break and season lines: `history-lines.ts`. */
export const GROUP_LINES = {
  created: 'Grupă creată.',
  deleted: (name: string) => `Grupă ștearsă: ${name}.`,
  memberAdded: (name: string) => `Sportiv adăugat: ${name}.`,
  memberAllocated: (name: string) => `Sportiv alocat: ${name}.`,
  movedTo: (group: string, name: string) => `Mutat în ${group}: ${name}.`,
  movedFrom: (group: string, name: string) => `Mutat din ${group}: ${name}.`,
  mainChanged: (from: string, to: string) => `Grupa principală schimbată: ${from} ${ARROW} ${to}`,
  memberRemoved: (name: string) => `Sportiv scos: ${name}.`,
  athleteMoved: (from: string, to: string) => `Mutat din ${from} în ${to}`,
  athleteRemoved: (group: string) => `Scos din grupa ${group}`,
  undone: (line: string) => `Anulat: ${line}`,
  yes: 'Da',
  no: 'Nu',
} as const;

/** Field labels of "Editează grupa" and "Editează pauza" lines (`<Câmp>: "<vechi>" -> "<nou>"`). */
export const FIELD_LABELS = {
  name: 'Nume',
  priceList: 'Listă de prețuri',
  coaches: 'Antrenori',
  programPublic: 'Program public',
  label: 'Nume',
  startDate: 'De la',
  endDate: 'Până la',
  isCurrent: 'Curent',
} as const;

export type SourceKind = 'registration' | 'previous' | 'added';

/** "Fără grupă" second line (5.3, W30): "Înscriere Școală, 12 ani", "Din 2026-2027, 12 ani", "Adăugat în Sportivi, 13 ani". */
export function sourceLine(kind: SourceKind, previousSeason: string | null, age: number | null): string {
  const lead = kind === 'registration' ? 'Înscriere Școală' : kind === 'previous' ? `Din ${previousSeason ?? ''}` : 'Adăugat în Sportivi';
  return [lead, ageText(age)].filter(Boolean).join(', ');
}
```

- [ ] **Step 6: Write `program-text.ts` and `series.ts`**

`src/club/groups/program-text.ts`:

```ts
import { shortDate } from './dates';
import type { DayKey, Freq } from './types';

/** Program texts (5.2 list column, 6.3 "Program obișnuit", 3.7 history). Pure. */
export const DAY_ORDER: readonly DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_SHORT: Readonly<Record<DayKey, string>> = { mon: 'Lu', tue: 'Ma', wed: 'Mi', thu: 'Jo', fri: 'Vi', sat: 'Sâ', sun: 'Du' };
/** `getUTCDay()` index to DayKey. */
export const DAY_OF_INDEX: readonly DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export type SeriesText = { freq: Freq; days: readonly DayKey[]; startTime: string; durationMin: number; from: string };

const ordered = (days: readonly DayKey[]): string[] => DAY_ORDER.filter((d) => days.includes(d)).map((d) => DAY_SHORT[d]);
const FREQ_SUFFIX: Readonly<Record<Freq, string>> = { none: '', weekly: '', biweekly: ', la 2 săptămâni', monthly: ', lunar' };

/** "Sâ, Du" */
export const daysList = (days: readonly DayKey[]): string => ordered(days).join(', ');

/** "Sâ și Du", "Lu, Mi și Vi" */
export function daysSpoken(days: readonly DayKey[]): string {
  const names = ordered(days);
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} și ${names[names.length - 1]}`;
}

/** "Sâ, Du 10:00": start time only (5.2). */
export const listLine = (s: SeriesText): string => `${daysList(s.days)} ${s.startTime}`;
/** "Sâ și Du, 11:00, 50 min" and ", la 2 săptămâni" / ", lunar" (6.3). */
export const programLine = (s: SeriesText): string => `${daysSpoken(s.days)}, ${s.startTime}, ${s.durationMin} min${FREQ_SUFFIX[s.freq]}`;
/** "Sâ și Du, 11:00, 50 min, din 4 oct 2026" (3.7). */
export const programLineFrom = (s: SeriesText): string => `${programLine(s)}, din ${shortDate(s.from)}`;
```

`src/club/groups/series.ts`:

```ts
import { clampDate, hhmm, minutesBetween } from './dates';
import type { SeriesText } from './program-text';
import type { DayKey, EventRecord, WeekOfMonth } from './types';

/** A group's weekly series and one-off classes, read off calendar events (spec 3.3). Pure. */
export type RepeatFreq = 'weekly' | 'biweekly' | 'monthly';
export type SeriesView = {
  eventId: string; freq: RepeatFreq; days: DayKey[]; weekOfMonth: WeekOfMonth | null; startTime: string; endTime: string; durationMin: number; from: string; to: string;
};
export type ClassView = { eventId: string; date: string; startTime: string; endTime: string; durationMin: number; note: string | null };
type SeasonDates = { startMonth: string; endMonth: string };

const isRepeat = (f: string): f is RepeatFreq => f === 'weekly' || f === 'biweekly' || f === 'monthly';

export function seriesView(e: EventRecord): SeriesView | null {
  const r = e.recurrence;
  const start = hhmm(r.startTime);
  const end = hhmm(r.endTime);
  if (!isRepeat(r.freq) || !start || !end || !r.seasonStart || !r.seasonEnd) return null;
  return {
    eventId: e.id, freq: r.freq, days: r.days, weekOfMonth: r.weekOfMonth, startTime: start, endTime: end,
    durationMin: minutesBetween(start, end), from: r.seasonStart, to: r.seasonEnd,
  };
}

export function classView(e: EventRecord): ClassView | null {
  const r = e.recurrence;
  const start = hhmm(r.startTime);
  const end = hhmm(r.endTime);
  if (r.freq !== 'none' || !r.singleDate || !start || !end) return null;
  return { eventId: e.id, date: r.singleDate, startTime: start, endTime: end, durationMin: minutesBetween(start, end), note: e.description };
}

export const seasonBounds = (s: SeasonDates): { start: string; end: string } => ({ start: s.startMonth.slice(0, 10), end: s.endMonth.slice(0, 10) });

export function overlapsSeason(x: { from: string; to: string }, season: SeasonDates): boolean {
  const b = seasonBounds(season);
  return x.from <= b.end && x.to >= b.start;
}

export const runningOn = (s: SeriesView, date: string): boolean => s.from <= date && s.to >= date;
const byStart = (a: SeriesView, b: SeriesView): number => a.from.localeCompare(b.from) || a.startTime.localeCompare(b.startTime);

/** Every series of the group that touches the season, oldest first. */
export function groupSeries(events: EventRecord[], groupId: string, season: SeasonDates): SeriesView[] {
  return events
    .filter((e) => e.groupId === groupId)
    .map(seriesView)
    .filter((s): s is SeriesView => s !== null && overlapsSeason(s, season))
    .sort(byStart);
}

/** One-off classes of the group inside the season, by date. */
export function groupClasses(events: EventRecord[], groupId: string, season: SeasonDates): ClassView[] {
  const b = seasonBounds(season);
  return events
    .filter((e) => e.groupId === groupId)
    .map(classView)
    .filter((c): c is ClassView => c !== null && c.date >= b.start && c.date <= b.end)
    .sort((a, b2) => a.date.localeCompare(b2.date));
}

/** "Program obișnuit" (6.3) and the Grupe "Program" column (5.2): the season's series still running today or later; a past season, on its last day. */
export function currentSeries(events: EventRecord[], groupId: string, season: SeasonDates, today: string): SeriesView[] {
  const b = seasonBounds(season);
  const cutoff = clampDate(today, b.start, b.end);
  return groupSeries(events, groupId, season).filter((s) => s.to >= cutoff);
}

export const seriesText = (s: SeriesView): SeriesText => ({ freq: s.freq, days: s.days, startTime: s.startTime, durationMin: s.durationMin, from: s.from });
```

- [ ] **Step 7: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/foundation.test.ts src/club/groups/__tests__/copy.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 8: Commit**

```bash
git add src/club/groups
git commit -m "feat(groups): phase 4 types, dates, copy, program texts and series reading"
```

---
### Task 3: Membership rules, `MembershipRow.to`, current rows in the P3 readers

**Files:**
- Create: `src/club/groups/membership-plan.ts`
- Modify: `src/club/group-membership.ts`
- Modify: `src/club/athletes/store.ts` (`MembershipRow`, `createMembership`)
- Modify: `src/club/athletes/strapi-store.ts` (`toMembership` reads `to`, exported)
- Modify: `src/club/athletes/__tests__/fake-store.ts` (`createMembership` writes `to: null`)
- Modify: `src/club/athletes/confirm-service.ts:23-29`, `src/club/athletes/confirm-read.ts:52-58`, `src/club/athletes/record.ts:21-24`, `src/club/athletes/list.ts:85-90`
- Test: `src/club/groups/__tests__/membership-plan.test.ts`, `src/club/groups/__tests__/current-rows.test.ts`, `src/club/__tests__/group-membership.test.ts`

**Interfaces:**
- Consumes: `addDays` (Task 2).
- Produces:
  - `MembershipRow.to?: string | null` (null or absent while current); `ClubStore.createMembership(data: Omit<MembershipRow, 'id' | 'to'>)`.
  - `isCurrentMembership(m: { to?: string | null }): boolean` and `checkMainGroup` on current rows (`src/club/group-membership.ts`).
  - `membership-plan.ts`: `MembershipWrite`, `MainChange`, `MembershipPlan`, `JoinFacts`, `currentRows(rows, athleteId, seasonId)`, `leaveWrite(row, today)`, `planJoin(current, groupId, facts)`, `planMove(current, row, toGroupId, facts, today)`, `planRemove(current, row, today)`, `earliestRow(rows)`.
  - `toMembership(raw): MembershipRow` exported from `src/club/athletes/strapi-store.ts`.

- [ ] **Step 1: Write the failing tests**

`src/club/groups/__tests__/membership-plan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { MembershipRow } from '../../athletes/store';
import { currentRows, earliestRow, leaveWrite, planJoin, planMove, planRemove } from '../membership-plan';

const TODAY = '2026-11-20';
const F = { athleteId: 'a1', seasonId: 's26', from: TODAY };
const row = (id: string, groupId: string, isMain: boolean, from: string | null = '2026-10-01', to: string | null = null): MembershipRow =>
  ({ id, athleteId: 'a1', groupId, seasonId: 's26', isMain, from, to });

describe('current rows', () => {
  it('keeps the athlete\'s rows of the season that have not ended', () => {
    const rows = [row('m1', 'g-ib', true), row('m2', 'g-pp', false, '2026-10-01', '2026-10-31'), { ...row('m3', 'g-pro', false), seasonId: 's25' }];
    expect(currentRows(rows, 'a1', 's26').map((r) => r.id)).toEqual(['m1']);
  });
});

describe('leaving a group (W4)', () => {
  it('ends a row that already applied on yesterday', () => {
    expect(leaveWrite(row('m1', 'g-ib', true), TODAY)).toEqual({ op: 'end', id: 'm1', to: '2026-11-19' });
  });

  it('deletes a row that starts today or later (it never applied)', () => {
    expect(leaveWrite(row('m1', 'g-ib', true, TODAY), TODAY)).toEqual({ op: 'delete', id: 'm1' });
    expect(leaveWrite(row('m1', 'g-ib', true, '2027-10-01'), TODAY)).toEqual({ op: 'delete', id: 'm1' });
  });
});

describe('joining a group (3.2, W3)', () => {
  it('is main when the athlete has no group this season', () => {
    expect(planJoin([], 'g-ib', F)).toEqual({ writes: [{ op: 'create', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: TODAY }], main: null });
  });

  it('is not main next to another group', () => {
    expect(planJoin([row('m1', 'g-pro', true)], 'g-ib', F).writes).toEqual([{ op: 'create', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: false, from: TODAY }]);
  });

  it('writes nothing when the athlete is already in the group', () => {
    expect(planJoin([row('m1', 'g-ib', true)], 'g-ib', F)).toEqual({ writes: [], main: null });
  });
});

describe('"Mută" (W2)', () => {
  it('from the main row: the new group becomes main', () => {
    const main = row('m1', 'g-ib', true);
    expect(planMove([main], main, 'g-is', F, TODAY)).toEqual({
      writes: [{ op: 'end', id: 'm1', to: '2026-11-19' }, { op: 'create', athleteId: 'a1', groupId: 'g-is', seasonId: 's26', isMain: true, from: TODAY }],
      main: { fromGroupId: 'g-ib', toGroupId: 'g-is' },
    });
  });

  it('from another row: the main group stays where it was', () => {
    const main = row('m1', 'g-pro', true);
    const other = row('m2', 'g-ib', false);
    expect(planMove([main, other], other, 'g-is', F, TODAY)).toEqual({
      writes: [{ op: 'end', id: 'm2', to: '2026-11-19' }, { op: 'create', athleteId: 'a1', groupId: 'g-is', seasonId: 's26', isMain: false, from: TODAY }],
      main: null,
    });
  });

  it('into a group the athlete is already in: that row keeps going and takes the main flag', () => {
    const main = row('m1', 'g-ib', true);
    const there = row('m2', 'g-pro', false);
    expect(planMove([main, there], main, 'g-pro', F, TODAY).writes).toEqual([{ op: 'end', id: 'm1', to: '2026-11-19' }, { op: 'main', id: 'm2', isMain: true }]);
  });
});

describe('"Scoate din grupă" (W4)', () => {
  it('the remaining group with the earliest start becomes main', () => {
    const main = row('m1', 'g-ib', true, '2026-10-01');
    const late = row('m2', 'g-pro', false, '2026-11-01');
    const early = row('m3', 'g-av', false, '2026-10-15');
    expect(planRemove([main, late, early], main, TODAY)).toEqual({
      writes: [{ op: 'end', id: 'm1', to: '2026-11-19' }, { op: 'main', id: 'm3', isMain: true }],
      main: { fromGroupId: 'g-ib', toGroupId: 'g-av' },
    });
  });

  it('a non-main row leaves alone; the last row leaves the athlete with none', () => {
    const main = row('m1', 'g-ib', true);
    expect(planRemove([main, row('m2', 'g-pro', false)], row('m2', 'g-pro', false), TODAY)).toEqual({ writes: [{ op: 'end', id: 'm2', to: '2026-11-19' }], main: null });
    expect(planRemove([main], main, TODAY)).toEqual({ writes: [{ op: 'end', id: 'm1', to: '2026-11-19' }], main: null });
  });

  it('earliest row: null starts last, then the id', () => {
    expect(earliestRow([row('b', 'g1', false, null), row('a', 'g2', false, null)])?.id).toBe('a');
    expect(earliestRow([row('b', 'g1', false, null), row('c', 'g2', false, '2026-10-01')])?.id).toBe('c');
  });
});
```

`src/club/groups/__tests__/current-rows.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { athleteListPage, readListQuery } from '../../athletes/list';
import { readAthleteRecord } from '../../athletes/record';
import { athleteRow, fakeClubStore } from '../../athletes/__tests__/fake-store';

const TODAY = { year: 2026, month: 11, day: 20 };
const seed = () => fakeClubStore({
  athletes: [athleteRow({ id: 'a1', name: 'Ana Ionescu' })],
  memberships: [
    { id: 'm-old', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: '2026-10-01', to: '2026-10-31' },
    { id: 'm-now', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-11-01', to: null },
  ],
});

describe('P3 screens read current memberships only (spec 2, 3.2)', () => {
  it('Sportivi "Grupa" shows the group the athlete is in now', async () => {
    const page = await athleteListPage(seed().store, readListQuery({ season: 's26' }), TODAY);
    expect(page.data[0].mainGroup?.name).toBe('Intermediari Bronze');
  });

  it('the record header shows the current main group', async () => {
    const record = await readAthleteRecord(seed().store, 'a1', 's26');
    expect(record?.header.mainGroup).toBe('Intermediari Bronze');
  });

  it('a membership created through the store is current', async () => {
    const { store } = fakeClubStore();
    const id = await store.createMembership({ athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null });
    expect((await store.memberships('a1')).find((m) => m.id === id)?.to).toBeNull();
  });
});
```

In `src/club/__tests__/group-membership.test.ts`, inside `describe('checkMainGroup', ...)`, add:

```ts
  it('ignores ended rows: a past main plus a current main is fine', () =>
    expect(checkMainGroup([{ groupId: 'g1', seasonId: S, isMain: true, to: '2026-10-31' }, { groupId: 'g2', seasonId: S, isMain: true, to: null }], S)).toEqual({ ok: true }));
  it('ended rows alone count as no group', () =>
    expect(checkMainGroup([{ groupId: 'g1', seasonId: S, isMain: false, to: '2026-10-31' }], S)).toEqual({ ok: true }));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/groups/__tests__/membership-plan.test.ts src/club/groups/__tests__/current-rows.test.ts src/club/__tests__/group-membership.test.ts`
Expected: FAIL (`Cannot find module '../membership-plan'`, "Primii Pași" instead of "Intermediari Bronze", `to` undefined, the ended main counted).

- [ ] **Step 3: `to` on memberships**

`src/club/athletes/store.ts`: change the `MembershipRow` line and `createMembership`:

```ts
/** `to` is the last day of an ended membership; null (or absent in old test seeds) while current (spec 3.2). */
export type MembershipRow = { id: string; athleteId: string; groupId: string; seasonId: string; isMain: boolean; from: string | null; to?: string | null };
```

```ts
  createMembership(data: Omit<MembershipRow, 'id' | 'to'>): Promise<string>;
```

`src/club/athletes/strapi-store.ts`: replace `const toMembership = ...` with:

```ts
export const toMembership = (r: Raw): MembershipRow => ({
  id: text(r.documentId), athleteId: linkId(r.athlete) ?? '', groupId: linkId(r.group) ?? '', seasonId: linkId(r.season) ?? '', isMain: r.isMain === true,
  from: str(r.from), to: str(r.to),
});
```

`src/club/athletes/__tests__/fake-store.ts`, in `fakeRowWrites`:

```ts
    createMembership: async (data) => {
      const id = next('gm');
      s.memberships.push({ ...data, id, to: null });
      return id;
    },
```

`src/club/group-membership.ts`: replace `SeasonMembership` and `checkMainGroup`:

```ts
export interface SeasonMembership {
  groupId: string;
  seasonId: string;
  isMain: boolean;
  to?: string | null;
}

/** A membership is current until it gets its `to` date (spec 3.2). */
export const isCurrentMembership = (m: { to?: string | null }): boolean => !m.to;

/** Exactly one current main membership per athlete per season, whenever there is any current one (SPEC 2 rule 2). */
export function checkMainGroup(
  list: SeasonMembership[],
  seasonId: string,
): { ok: true } | { ok: false; reason: 'none' | 'many' } {
  const inSeason = list.filter((m) => m.seasonId === seasonId && isCurrentMembership(m));
  if (inSeason.length === 0) return { ok: true };
  const mains = inSeason.filter((m) => m.isMain).length;
  if (mains === 1) return { ok: true };
  return { ok: false, reason: mains === 0 ? 'none' : 'many' };
}
```

- [ ] **Step 4: Current rows in the P3 readers**

Each file imports `isCurrentMembership` from `'../group-membership'`.

`src/club/athletes/confirm-service.ts`, in `seasonRows`:

```ts
    seasonMemberships: memberships.filter((m) => m.seasonId === seasonId && isCurrentMembership(m)).map(({ id, groupId, isMain }) => ({ id, groupId, isMain })),
```

`src/club/athletes/confirm-read.ts`, in `athleteSeasonState`:

```ts
  const main = memberships.find((m) => m.seasonId === season.id && m.isMain && isCurrentMembership(m));
```

`src/club/athletes/record.ts`, in `mainGroupName`:

```ts
  const main = src.memberships.find((m) => m.seasonId === src.season?.id && m.isMain && isCurrentMembership(m));
```

`src/club/athletes/list.ts`, in `buildIndex`:

```ts
    memberships: groupBy(src.memberships.filter((m) => m.seasonId === seasonId && isCurrentMembership(m)), (m) => m.athleteId),
```

- [ ] **Step 5: Write `membership-plan.ts`**

```ts
import type { MembershipRow } from '../athletes/store';
import { isCurrentMembership } from '../group-membership';
import { addDays } from './dates';

/** Membership writes of one action (spec 3.2, 6.2, W2 to W4). Pure: the services apply the writes in order. */
export type MembershipWrite =
  | { op: 'create'; athleteId: string; groupId: string; seasonId: string; isMain: boolean; from: string }
  | { op: 'end'; id: string; to: string }
  | { op: 'delete'; id: string }
  | { op: 'main'; id: string; isMain: boolean };
export type MainChange = { fromGroupId: string; toGroupId: string } | null;
export type MembershipPlan = { writes: MembershipWrite[]; main: MainChange };
export type JoinFacts = { athleteId: string; seasonId: string; from: string };

export const currentRows = (rows: MembershipRow[], athleteId: string, seasonId: string): MembershipRow[] =>
  rows.filter((r) => r.athleteId === athleteId && r.seasonId === seasonId && isCurrentMembership(r));

/** W4: a row that never applied (starts today or later) is deleted; any other ends yesterday and stays as history. */
export function leaveWrite(row: MembershipRow, today: string): MembershipWrite {
  return row.from !== null && row.from >= today ? { op: 'delete', id: row.id } : { op: 'end', id: row.id, to: addDays(today, -1) };
}

/** "Alocă", "Adaugă sportivi", "Adaugă și în grupă": main only without a group this season; nothing when already in it. */
export function planJoin(current: MembershipRow[], groupId: string, f: JoinFacts): MembershipPlan {
  if (current.some((r) => r.groupId === groupId)) return { writes: [], main: null };
  return { writes: [{ op: 'create', athleteId: f.athleteId, groupId, seasonId: f.seasonId, isMain: current.length === 0, from: f.from }], main: null };
}

/** Who becomes main after the main row leaves: the earliest `from` (no date last), then the id. */
export function earliestRow(rows: MembershipRow[]): MembershipRow | null {
  const key = (r: MembershipRow) => r.from ?? '9999-12-31';
  return [...rows].sort((a, b) => key(a).localeCompare(key(b)) || a.id.localeCompare(b.id))[0] ?? null;
}

function arrive(current: MembershipRow[], row: MembershipRow, toGroupId: string, f: JoinFacts): MembershipWrite[] {
  const there = current.find((r) => r.groupId === toGroupId);
  if (!there) return [{ op: 'create', athleteId: f.athleteId, groupId: toGroupId, seasonId: f.seasonId, isMain: row.isMain, from: f.from }];
  return row.isMain && !there.isMain ? [{ op: 'main', id: there.id, isMain: true }] : [];
}

/** "Mută": this row ends, "În" starts (or keeps its row); the main flag travels with the row (W2). */
export function planMove(current: MembershipRow[], row: MembershipRow, toGroupId: string, f: JoinFacts, today: string): MembershipPlan {
  return {
    writes: [leaveWrite(row, today), ...arrive(current, row, toGroupId, f)],
    main: row.isMain ? { fromGroupId: row.groupId, toGroupId } : null,
  };
}

/** "Scoate din grupă": when the main row leaves and others remain, the earliest remaining one becomes main (W4). */
export function planRemove(current: MembershipRow[], row: MembershipRow, today: string): MembershipPlan {
  const heir = row.isMain ? earliestRow(current.filter((r) => r.id !== row.id)) : null;
  const writes: MembershipWrite[] = [leaveWrite(row, today)];
  if (heir) writes.push({ op: 'main', id: heir.id, isMain: true });
  return { writes, main: heir ? { fromGroupId: row.groupId, toGroupId: heir.groupId } : null };
}
```

- [ ] **Step 6: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/membership-plan.test.ts src/club/groups/__tests__/current-rows.test.ts src/club/__tests__/group-membership.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 7: Commit**

```bash
git add src/club/groups/membership-plan.ts src/club/group-membership.ts src/club/athletes src/club/groups/__tests__/membership-plan.test.ts src/club/groups/__tests__/current-rows.test.ts src/club/__tests__/group-membership.test.ts
git commit -m "feat(groups): membership plans, ended memberships kept with their to date, P3 screens read current rows"
```

---

### Task 4: Istoric lines of phase 4

**Files:**
- Create: `src/club/groups/history-lines.ts`
- Modify: `src/club/groups/copy/core.ts` (program, break and season line texts, `withPeriod`, `fieldLine`)
- Modify: `src/club/history-text.ts` (`historyTexts` falls back to phase 4 lines and renders "Anulat: ")
- Test: `src/club/groups/__tests__/history-lines.test.ts`

**Interfaces:**
- Consumes: `copy` (Task 2), `dayMonth`, `shortDate`, `weekdayName` (Task 2), `programLine`, `programLineFrom`, `SeriesText` (Task 2), `HISTORY_ACTIONS` (`src/club/history-text.ts`).
- Produces:
  - `GROUP_SUBJECT = 'group'`, `BREAK_SUBJECT = 'calendar-blackout'`, `SEASON_SUBJECT = 'season'`, `ATHLETE_SUBJECT = 'athlete'`.
  - `P4_ACTIONS` (every action string below) and the `changes` shape each one stores (table in Step 3).
  - `phase4Lines(action, changes, names): string[] | null` (null for an action that is not phase 4); `groupHistoryTexts(action, changes, names): string[]` (handles `undone`); `athleteIdsOf(changes): string[]` (ids a group line names, for the name lookup).
  - copy: `PROGRAM_LINES`, `BREAK_LINES`, `SEASON_LINES`, `withPeriod(text)`, `fieldLine(label, from, to)`.

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/history-lines.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { historyTexts } from '../../history-text';
import { P4_ACTIONS, athleteIdsOf, groupHistoryTexts, phase4Lines } from '../history-lines';

const NAMES = { a1: 'Ana Ionescu', a2: 'Elisa Georgescu' };
const series = { freq: 'weekly', days: ['sat', 'sun'], startTime: '11:00', durationMin: 50, from: '2026-10-04' };
const lines = (action: string, changes: Record<string, unknown>) => phase4Lines(action, changes, NAMES);

describe('group roster lines (3.7, W1, decided 1 and 2)', () => {
  it('names the athlete from the current name, never a stored one', () => {
    expect(lines(P4_ACTIONS.memberAllocated, { athleteId: 'a2' })).toEqual(['Sportiv alocat: Elisa Georgescu.']);
    expect(lines(P4_ACTIONS.memberAdded, { athleteId: 'a2' })).toEqual(['Sportiv adăugat: Elisa Georgescu.']);
    expect(lines(P4_ACTIONS.memberRemoved, { athleteId: 'a1' })).toEqual(['Sportiv scos: Ana Ionescu.']);
  });

  it('writes the move on both groups, the main sentence on the group left', () => {
    expect(lines(P4_ACTIONS.memberMovedOut, { athleteId: 'a1', toGroup: 'Intermediari Silver', main: { from: 'Intermediari Bronze', to: 'Intermediari Silver' } }))
      .toEqual(['Mutat în Intermediari Silver: Ana Ionescu. Grupa principală schimbată: Intermediari Bronze → Intermediari Silver']);
    expect(lines(P4_ACTIONS.memberMovedOut, { athleteId: 'a1', toGroup: 'Avansați', main: null })).toEqual(['Mutat în Avansați: Ana Ionescu.']);
    expect(lines(P4_ACTIONS.memberMovedIn, { athleteId: 'a1', fromGroup: 'Intermediari Bronze' })).toEqual(['Mutat din Intermediari Bronze: Ana Ionescu.']);
  });

  it('writes the group settings one line per field', () => {
    expect(lines(P4_ACTIONS.groupCreated, {})).toEqual(['Grupă creată.']);
    expect(lines(P4_ACTIONS.groupUpdated, { fields: { name: { from: 'Grupa A', to: 'Grupa B' }, programPublic: { from: true, to: false } } }))
      .toEqual(['Nume: "Grupa A" → "Grupa B"', 'Program public: "Da" → "Nu"']);
  });
});

describe('athlete lines', () => {
  it('reads like the P3 lines', () => {
    expect(lines(P4_ACTIONS.athleteMoved, { from: 'Intermediari Bronze', to: 'Intermediari Silver' })).toEqual(['Mutat din Intermediari Bronze în Intermediari Silver']);
    expect(lines(P4_ACTIONS.athleteRemoved, { groupName: 'Avansați' })).toEqual(['Scos din grupa Avansați']);
    expect(lines(P4_ACTIONS.athleteCopied, { season: '2027-2028', groups: [{ name: 'Avansați', main: true }, { name: 'Profesioniști', main: false }] }))
      .toEqual(['Copiat în 2027-2028: Avansați (principală), Profesioniști.']);
  });
});

describe('program lines (3.7, decided 10 to 12)', () => {
  it('adds, changes and ends a series', () => {
    expect(lines(P4_ACTIONS.programAdded, { series })).toEqual(['Program adăugat: Sâ și Du, 11:00, 50 min, din 4 oct 2026.']);
    expect(lines(P4_ACTIONS.programChanged, { from: '2026-11-21', before: series, after: { ...series, startTime: '12:00' } }))
      .toEqual(['Program schimbat din 21 nov 2026: Sâ și Du, 11:00, 50 min → Sâ și Du, 12:00, 50 min.']);
    expect(lines(P4_ACTIONS.programEnded, { from: '2026-12-01', series })).toEqual(['Program șters din 1 dec 2026: Sâ și Du, 11:00, 50 min.']);
  });

  it('adds and deletes a single class', () => {
    expect(lines(P4_ACTIONS.classAdded, { date: '2026-11-20', startTime: '18:00', durationMin: 60 })).toEqual(['Ședință unică adăugată: vineri, 20 noiembrie, 18:00, 60 min.']);
    expect(lines(P4_ACTIONS.classDeleted, { date: '2026-11-20', startTime: '18:00' })).toEqual(['Ședință unică ștearsă: vineri, 20 noiembrie, 18:00.']);
  });

  it('cancels, moves and keeps a date', () => {
    expect(lines(P4_ACTIONS.dateCancelled, { date: '2026-11-14', reason: 'Competiție la Brașov', emails: 9 }))
      .toEqual(['Ședința din 14 noiembrie anulată: Competiție la Brașov. Părinții anunțați pe e-mail.']);
    expect(lines(P4_ACTIONS.dateCancelled, { date: '2026-11-14', reason: 'Gheață topită!', emails: 0 })).toEqual(['Ședința din 14 noiembrie anulată: Gheață topită!']);
    expect(lines(P4_ACTIONS.dateCancelled, { date: '2026-11-14', reason: null, emails: 0 })).toEqual(['Ședința din 14 noiembrie anulată.']);
    expect(lines(P4_ACTIONS.dateMoved, { date: '2026-11-21', newDate: '2026-11-22', newStartTime: '12:00', emails: 3 }))
      .toEqual(['Ședința din 21 noiembrie mutată: 22 noiembrie, 12:00. Părinții anunțați pe e-mail.']);
    expect(lines(P4_ACTIONS.dateKept, { date: '2026-11-14' })).toEqual(['Ședința din 14 noiembrie se ține.']);
  });
});

describe('break and season lines', () => {
  it('writes the Pauze lines', () => {
    expect(lines(P4_ACTIONS.breakAdded, { label: 'Vacanța de iarnă', startDate: '2026-12-20', endDate: '2027-01-06' }))
      .toEqual(['Pauză adăugată: Vacanța de iarnă, 20 dec 2026 - 6 ian 2027.']);
    expect(lines(P4_ACTIONS.breakUpdated, { fields: { endDate: { from: '2027-01-06', to: '2027-01-08' } } })).toEqual(['Până la: "6 ian 2027" → "8 ian 2027"']);
    expect(lines(P4_ACTIONS.breakDeleted, { label: 'Vacanța de iarnă' })).toEqual(['Pauză ștearsă: Vacanța de iarnă.']);
  });

  it('writes the new season lines, parts with 0 left out (decided 9)', () => {
    expect(lines(P4_ACTIONS.currentChanged, { from: false, to: true })).toEqual(['Curent: "Nu" → "Da"']);
    expect(lines(P4_ACTIONS.seasonCopied, { from: '2026-2027', athletes: 14, groups: 2, series: 10 })).toEqual(['Copiat din 2026-2027: 14 sportivi în 2 grupe, 10 programe.']);
    expect(lines(P4_ACTIONS.seasonCopied, { from: '2026-2027', athletes: 0, groups: 0, series: 1 })).toEqual(['Copiat din 2026-2027: 1 program.']);
    expect(lines(P4_ACTIONS.seasonCopied, { from: '2026-2027', athletes: 0, groups: 0, series: 0 })).toEqual([]);
    expect(lines(P4_ACTIONS.membersCopied, { from: '2026-2027', count: 11 })).toEqual(['Sportivi copiați din 2026-2027: 11.']);
    expect(lines(P4_ACTIONS.programCopied, { from: '2026-2027', series: { ...series, from: '2027-10-01' } })).toEqual(['Program copiat din 2026-2027: Sâ și Du, 11:00, 50 min, din 1 oct 2027.']);
  });
});

describe('undo lines (3.7, W15)', () => {
  it('prefixes the undone line on a group', () => {
    expect(groupHistoryTexts(P4_ACTIONS.undone, { undoneAction: P4_ACTIONS.memberAllocated, undoneChanges: { athleteId: 'a2' } }, NAMES))
      .toEqual(['Anulat: Sportiv alocat: Elisa Georgescu.']);
  });

  it('renders on an athlete through the P3 Istoric, P3 lines included', () => {
    expect(historyTexts(P4_ACTIONS.undone, { undoneAction: 'group-added', undoneChanges: { groupName: 'Avansați' } }, 'athlete')).toEqual(['Anulat: Adăugat în grupa Avansați']);
    expect(historyTexts(P4_ACTIONS.athleteRemoved, { groupName: 'Avansați' }, 'athlete')).toEqual(['Scos din grupa Avansați']);
  });

  it('collects the athlete ids a group line names, inner undo lines included', () => {
    expect(athleteIdsOf({ undoneAction: P4_ACTIONS.memberAdded, undoneChanges: { athleteId: 'a1' } })).toEqual(['a1']);
    expect(athleteIdsOf({ athleteId: 'a2' })).toEqual(['a2']);
  });

  it('is null for an action that is not phase 4, and tolerates bad stored values', () => {
    expect(phase4Lines('confirmed', {}, NAMES)).toBeNull();
    expect(lines(P4_ACTIONS.programAdded, { series: 'broken' })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/history-lines.test.ts`
Expected: FAIL (`Cannot find module '../history-lines'`).

- [ ] **Step 3: Add the line texts to `copy/core.ts`**

Append to `src/club/groups/copy/core.ts`:

```ts
/** "Motiv" and line endings: a text that already ends in ".", "!" or "?" gets no second period (W33, decided 12). */
export const withPeriod = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);
export const fieldLine = (label: string, from: string, to: string): string => `${label}: "${from}" ${ARROW} "${to}"`;

export const PROGRAM_LINES = {
  added: (program: string) => `Program adăugat: ${program}.`,
  changed: (from: string, before: string, after: string) => `Program schimbat din ${from}: ${before} ${ARROW} ${after}.`,
  ended: (from: string, program: string) => `Program șters din ${from}: ${program}.`,
  classAdded: (day: string, date: string, time: string, minutes: number) => `Ședință unică adăugată: ${day}, ${date}, ${time}, ${minutes} min.`,
  classDeleted: (day: string, date: string, time: string) => `Ședință unică ștearsă: ${day}, ${date}, ${time}.`,
  cancelled: (date: string, reason: string | null) => (reason ? `Ședința din ${date} anulată: ${withPeriod(reason)}` : `Ședința din ${date} anulată.`),
  moved: (date: string, newDate: string, time: string) => `Ședința din ${date} mutată: ${newDate}, ${time}.`,
  kept: (date: string) => `Ședința din ${date} se ține.`,
  parentsTold: ' Părinții anunțați pe e-mail.',
  copied: (season: string, program: string) => `Program copiat din ${season}: ${program}.`,
} as const;

export const BREAK_LINES = {
  added: (label: string, from: string, to: string) => `Pauză adăugată: ${label}, ${from} - ${to}.`,
  deleted: (label: string) => `Pauză ștearsă: ${label}.`,
} as const;

export const SEASON_LINES = {
  copied: (from: string, parts: string[]) => `Copiat din ${from}: ${parts.join(', ')}.`,
  membersPart: (athletes: number, groups: number) => `${athletesText(athletes)} în ${groupsText(groups)}`,
  membersCopied: (from: string, count: number) => `Sportivi copiați din ${from}: ${count}.`,
  athleteCopied: (season: string, groups: string) => `Copiat în ${season}: ${groups}.`,
  mainMark: ' (principală)',
} as const;
```

- [ ] **Step 4: Write `history-lines.ts`**

Stored `changes` per action (every value plain JSON):

| Action (`P4_ACTIONS`) | Subject | `changes` |
|---|---|---|
| `groupCreated` `'group-created'` | group | `{}` |
| `groupUpdated` `'group-updated'` | group | `{ fields: { name?, priceList?, coaches?, programPublic?: { from, to } } }` (texts; programPublic booleans) |
| `groupDeleted` `'group-deleted'` | group | `{ name }` |
| `memberAdded` / `memberAllocated` / `memberRemoved` | group | `{ athleteId }` |
| `memberMovedOut` `'member-moved-out'` | group left | `{ athleteId, toGroup, main: { from, to } \| null }` |
| `memberMovedIn` `'member-moved-in'` | group joined | `{ athleteId, fromGroup }` |
| `athleteMoved` `'athlete-group-moved'` | athlete | `{ from, to }` |
| `athleteRemoved` `'athlete-group-removed'` | athlete | `{ groupName }` |
| `athleteCopied` `'athlete-copied'` | athlete | `{ season, groups: { name, main }[] }` |
| `programAdded` | group | `{ series: SeriesText }` |
| `programChanged` | group | `{ from, before: SeriesText, after: SeriesText }` |
| `programEnded` | group | `{ from, series: SeriesText }` |
| `classAdded` | group | `{ date, startTime, durationMin }` |
| `classDeleted` | group | `{ date, startTime }` |
| `dateCancelled` | group | `{ date, reason, emails }` |
| `dateMoved` | group | `{ date, newDate, newStartTime, reason, emails }` |
| `dateKept` | group | `{ date }` |
| `breakAdded` / `breakDeleted` | calendar-blackout | `{ label, startDate, endDate }` / `{ label }` |
| `breakUpdated` | calendar-blackout | `{ fields: { label?, startDate?, endDate?: { from, to } } }` |
| `currentChanged` | season | `{ from: boolean, to: boolean }` |
| `seasonCopied` | season | `{ from, athletes, groups, series }` |
| `membersCopied` / `programCopied` | group | `{ from, count }` / `{ from, series: SeriesText }` |
| `undone` `'undone'` | any | `{ undoneAction, undoneChanges }` |

Every action line of an action except the first also stores `actionId`; the first stores `undo` (Task 5). Renderers ignore both.

`src/club/groups/history-lines.ts`:

```ts
import { BREAK_LINES, FIELD_LABELS, GROUP_LINES, PROGRAM_LINES, SEASON_LINES, fieldLine, seriesCountText } from './copy';
import { dayMonth, shortDate, weekdayName } from './dates';
import { programLine, programLineFrom, type SeriesText } from './program-text';

/** Phase 4 Istoric lines (spec 3.7, 10.8). Pure; group lines get athlete names at read time (decided 2). */
export const GROUP_SUBJECT = 'group';
export const BREAK_SUBJECT = 'calendar-blackout';
export const SEASON_SUBJECT = 'season';
export const ATHLETE_SUBJECT = 'athlete';

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

const isRecord = (v: unknown): v is Changes => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const yesNo = (v: unknown): string => (v === true ? GROUP_LINES.yes : GROUP_LINES.no);
const nameOf = (c: Changes, names: Names): string => names[text(c.athleteId)] ?? '';

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

function movedOut(c: Changes, names: Names): string[] {
  const main = isRecord(c.main) ? ` ${GROUP_LINES.mainChanged(text(c.main.from), text(c.main.to))}` : '';
  return [GROUP_LINES.movedTo(text(c.toGroup), nameOf(c, names)) + main];
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
  [P4_ACTIONS.memberRemoved]: (c, n) => [GROUP_LINES.memberRemoved(nameOf(c, n))],
  [P4_ACTIONS.memberMovedOut]: movedOut,
  [P4_ACTIONS.memberMovedIn]: (c, n) => [GROUP_LINES.movedFrom(text(c.fromGroup), nameOf(c, n))],
  [P4_ACTIONS.athleteMoved]: (c) => [GROUP_LINES.athleteMoved(text(c.from), text(c.to))],
  [P4_ACTIONS.athleteRemoved]: (c) => [GROUP_LINES.athleteRemoved(text(c.groupName))],
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
```

- [ ] **Step 5: Wire it into the P3 Istoric**

In `src/club/history-text.ts`, add the imports and replace `historyTexts`:

```ts
import { GROUP_LINES } from './groups/copy';
import { P4_ACTIONS, phase4Lines } from './groups/history-lines';
```

```ts
/** P3 lines first; then phase 4 lines (athlete subject: moves, removals, copies); "Anulat: " before an undone line. */
export function historyTexts(action: string, changes: unknown, subjectType: string): string[] {
  const c = isRecord(changes) ? changes : {};
  const render = RENDER[action];
  if (render) return render(c, subjectType);
  if (action === P4_ACTIONS.undone) return historyTexts(text(c.undoneAction), c.undoneChanges, subjectType).map(GROUP_LINES.undone);
  return phase4Lines(action, c, {}) ?? [];
}
```

- [ ] **Step 6: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/history-lines.test.ts src/club/__tests__/history-text.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 7: Commit**

```bash
git add src/club/groups/history-lines.ts src/club/groups/copy/core.ts src/club/history-text.ts src/club/groups/__tests__/history-lines.test.ts
git commit -m "feat(groups): phase 4 Istoric lines for groups, programs, breaks and seasons, with Anulat lines"
```

---

### Task 5: Undo records and the refusal rule

**Files:**
- Create: `src/club/groups/undo.ts`
- Test: `src/club/groups/__tests__/undo.test.ts`

**Interfaces:**
- Consumes: `MembershipWrite` (Task 3), `MembershipRow` (Task 3), `EventWrite`, `ExceptionRow`, `HistoryEntryRow`, `Recurrence`, `Subject` (Task 2), `AthleteStatus`.
- Produces:
  - `MembershipSnapshot`, `UndoStep` (ops: `deleteMembership`, `setMembership`, `createMembership`, `setStatus`, `deleteEvent`, `setEvent`, `createEvent`, `cancelEmails`, `setCurrentSeason`), `UndoKind = 'group' | 'season'`, `UndoRecord = { kind; steps; subjects; revalidate; registrationsAfter? }`.
  - `membershipUndo(write, before, createdId): UndoStep`, `readUndoRecord(v): UndoRecord | null`, `undoRefusal(entry, later): 'missing' | 'changed' | null`, `undoLockTargets(steps): { seasons; athletes; groups; events }` (each sorted, unique).
  - Steps are applied in reverse order of the array (Task 10).

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/undo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { MembershipRow } from '../../athletes/store';
import type { HistoryEntryRow } from '../types';
import { membershipUndo, readUndoRecord, undoLockTargets, undoRefusal, type UndoRecord } from '../undo';

const row: MembershipRow = { id: 'm1', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-10-01', to: null };
const RECORD: UndoRecord = { kind: 'group', steps: [{ op: 'deleteMembership', id: 'm9', athleteId: 'a1' }], subjects: [{ type: 'group', id: 'g-ib' }], revalidate: false };
const entry = (over: Partial<HistoryEntryRow> = {}): HistoryEntryRow => ({
  id: 'h1', seq: 10, subjectType: 'group', subjectId: 'g-ib', action: 'member-allocated', changes: { athleteId: 'a1', undo: RECORD }, actor: 'admin@example.com', at: '2026-11-20T10:00:00.000Z', ...over,
});

describe('the step that takes back one membership write', () => {
  it('deletes a created row', () => {
    expect(membershipUndo({ op: 'create', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-11-20' }, null, 'm9'))
      .toEqual({ op: 'deleteMembership', id: 'm9', athleteId: 'a1' });
  });

  it('reopens an ended row with its main flag', () => {
    expect(membershipUndo({ op: 'end', id: 'm1', to: '2026-11-19' }, row, null)).toEqual({ op: 'setMembership', id: 'm1', athleteId: 'a1', isMain: true, to: null });
  });

  it('re-creates a deleted row exactly', () => {
    expect(membershipUndo({ op: 'delete', id: 'm1' }, row, null)).toEqual({
      op: 'createMembership', row: { athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-10-01', to: null },
    });
  });

  it('flips a main flag back', () => {
    expect(membershipUndo({ op: 'main', id: 'm1', isMain: true }, { ...row, isMain: false }, null)).toEqual({ op: 'setMembership', id: 'm1', athleteId: 'a1', isMain: false, to: null });
  });

  it('refuses a delete or a flag change without the row as it was', () => {
    expect(() => membershipUndo({ op: 'delete', id: 'm1' }, null, null)).toThrow();
  });
});

describe('refusal (W15, decided 3)', () => {
  it('lets the undo run when nothing else was written on its subjects', () => {
    const own = entry({ id: 'h2', seq: 11, subjectType: 'athlete', subjectId: 'a1', changes: { actionId: 'h1' } });
    expect(undoRefusal(entry(), [own])).toBeNull();
  });

  it('refuses after a later line by another action, after an undo, and for an unknown action', () => {
    const other = entry({ id: 'h5', seq: 15, changes: { athleteId: 'a2' } });
    expect(undoRefusal(entry(), [other])).toBe('changed');
    expect(undoRefusal(entry({ changes: { undo: RECORD, undone: true } }), [])).toBe('changed');
    expect(undoRefusal(entry({ changes: {} }), [])).toBe('changed');
    expect(undoRefusal(null, [])).toBe('missing');
  });

  it('reads only a record with steps, subjects and a kind', () => {
    expect(readUndoRecord(RECORD)).toEqual(RECORD);
    expect(readUndoRecord({ steps: [] })).toBeNull();
    expect(readUndoRecord('x')).toBeNull();
  });
});

describe('locks an undo takes', () => {
  it('lists seasons, athletes, groups and events, sorted and once each', () => {
    expect(undoLockTargets([
      { op: 'setMembership', id: 'm2', athleteId: 'b', isMain: true, to: null },
      { op: 'createMembership', row: { athleteId: 'a', groupId: 'g2', seasonId: 's26', isMain: false, from: null, to: null } },
      { op: 'deleteMembership', id: 'm3', athleteId: 'a' },
      { op: 'setEvent', id: 'e2', recurrence: { freq: 'weekly', days: [], weekOfMonth: null, startTime: null, endTime: null, singleDate: null, seasonStart: null, seasonEnd: null }, exceptions: [] },
      { op: 'deleteEvent', id: 'e1' },
      { op: 'setCurrentSeason', id: 's26', otherId: 's27' },
      { op: 'cancelEmails' },
    ])).toEqual({ seasons: ['s26', 's27'], athletes: ['a', 'b'], groups: ['g2'], events: ['e1', 'e2'] });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/undo.test.ts`
Expected: FAIL (`Cannot find module '../undo'`).

- [ ] **Step 3: Write `undo.ts`**

```ts
import type { AthleteStatus } from '../athlete-data';
import type { MembershipRow } from '../athletes/store';
import type { MembershipWrite } from './membership-plan';
import type { EventWrite, ExceptionRow, HistoryEntryRow, Recurrence, Subject } from './types';

/**
 * What a phase 4 action wrote, stored as `undo` on its first Istoric line (spec 8.1, W15). `POST /club/undo` applies the
 * steps in reverse order, in one transaction, and only while nothing else was written on the action's subjects.
 */
export type MembershipSnapshot = { athleteId: string; groupId: string; seasonId: string; isMain: boolean; from: string | null; to: string | null };
export type UndoStep =
  | { op: 'deleteMembership'; id: string; athleteId: string }
  | { op: 'setMembership'; id: string; athleteId: string; isMain: boolean; to: string | null }
  | { op: 'createMembership'; row: MembershipSnapshot }
  | { op: 'setStatus'; athleteId: string; status: AthleteStatus }
  | { op: 'deleteEvent'; id: string }
  | { op: 'setEvent'; id: string; recurrence: Recurrence; exceptions: ExceptionRow[] }
  | { op: 'createEvent'; event: EventWrite }
  | { op: 'cancelEmails' }
  | { op: 'setCurrentSeason'; id: string; otherId: string };
export type UndoKind = 'group' | 'season';
export type UndoRecord = {
  kind: UndoKind; steps: UndoStep[]; subjects: Subject[]; revalidate: boolean;
  /** New season (W28): refused once a registration was filed under this season after `at`. */
  registrationsAfter?: { seasonId: string; at: string };
};
export type UndoRefusal = 'missing' | 'changed';

function snapshot(row: MembershipRow | null): MembershipSnapshot {
  if (!row) throw new Error('undo needs the membership as it was');
  return { athleteId: row.athleteId, groupId: row.groupId, seasonId: row.seasonId, isMain: row.isMain, from: row.from, to: row.to ?? null };
}

/** The step that takes back one membership write; `before` is the row as it was, `createdId` the row a create wrote. */
export function membershipUndo(write: MembershipWrite, before: MembershipRow | null, createdId: string | null): UndoStep {
  if (write.op === 'create') return { op: 'deleteMembership', id: createdId ?? '', athleteId: write.athleteId };
  if (write.op === 'delete') return { op: 'createMembership', row: snapshot(before) };
  const was = snapshot(before);
  return write.op === 'end'
    ? { op: 'setMembership', id: write.id, athleteId: was.athleteId, isMain: was.isMain, to: null }
    : { op: 'setMembership', id: write.id, athleteId: was.athleteId, isMain: was.isMain, to: was.to };
}

export function readUndoRecord(v: unknown): UndoRecord | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Partial<UndoRecord>;
  const kindOk = r.kind === 'group' || r.kind === 'season';
  return kindOk && Array.isArray(r.steps) && Array.isArray(r.subjects) ? (r as UndoRecord) : null;
}

/** W15 (decided 3): refused once any later line on a subject of the action was written by anything but the action itself. */
export function undoRefusal(entry: HistoryEntryRow | null, later: HistoryEntryRow[]): UndoRefusal | null {
  if (!entry) return 'missing';
  if (!readUndoRecord(entry.changes.undo) || entry.changes.undone === true) return 'changed';
  return later.some((h) => h.id !== entry.id && h.changes.actionId !== entry.id) ? 'changed' : null;
}

export type LockTargets = { seasons: string[]; athletes: string[]; groups: string[]; events: string[] };
const sorted = (ids: string[]): string[] => [...new Set(ids)].sort();

function targetsOf(step: UndoStep): Partial<Record<keyof LockTargets, string[]>> {
  switch (step.op) {
    case 'deleteMembership': case 'setMembership': case 'setStatus': return { athletes: [step.athleteId] };
    case 'createMembership': return { athletes: [step.row.athleteId], groups: [step.row.groupId] };
    case 'deleteEvent': case 'setEvent': return { events: [step.id] };
    case 'setCurrentSeason': return { seasons: [step.id, step.otherId] };
    default: return {};
  }
}

/** Rows the undo locks, in the binding order of the Global Constraints (seasons, athletes, groups, events). */
export function undoLockTargets(steps: UndoStep[]): LockTargets {
  const all = steps.map(targetsOf);
  const pick = (k: keyof LockTargets) => sorted(all.flatMap((t) => t[k] ?? []));
  return { seasons: pick('seasons'), athletes: pick('athletes'), groups: pick('groups'), events: pick('events') };
}
```

- [ ] **Step 4: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/undo.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/groups/undo.ts src/club/groups/__tests__/undo.test.ts
git commit -m "feat(groups): undo records of phase 4 actions and the refusal rule"
```

---
### Task 6: Group store (Strapi and in memory) and the service context

**Files:**
- Modify: `src/club/athletes/strapi-store.ts` (export `transactionScope`; P3 `transactions` uses it)
- Create: `src/club/groups/strapi-store.ts`, `src/club/groups/context.ts`
- Create: `src/club/groups/__tests__/fake-group-store.ts`
- Test: `src/club/groups/__tests__/group-store.test.ts`

**Interfaces:**
- Consumes: `GroupStore` and the row types (Task 2), `toMembership` (Task 3), `strapiClubStore`, `toAthleteRow`, `toRegistrationRow` (P3), `buildHistoryEntry` (`src/club/history.ts`), `adminActor`, `pingRevalidate` (`src/utils/revalidate.ts`), `athleteRow`, `registrationRow` (P3 fake store).
- Produces:
  - `transactionScope(strapi): { transaction, lockRow(table, id) }` (`src/club/athletes/strapi-store.ts`).
  - `strapiGroupStore(strapi: Core.Strapi): GroupStore`; mappers `toGroupRecord`, `toRecurrence`, `toException`, `toEventRecord`, `recurrenceData`, `exceptionData` (exported for plans 4-2 and 4-4).
  - `GroupContext = { store; actor; today; log; revalidate }` and `groupContext(strapi, ctx)` (`context.ts`). Plan 4-2 adds `emails`.
  - Test helpers (`__tests__/fake-group-store.ts`): `FakeGroupState`, `FakeJob`, `fakeGroupStore(seed)`, `fakeContext(seed?, today?)`, seed rows `G_SEASONS`, `G_SECTIONS`, `G_GROUPS`, `G_TEAM`, `G_PRICE_LISTS`, builders `member(over)`, `event(over)`, re-exported `athleteRow`, `registrationRow`.

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/group-store.test.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import { strapiGroupStore } from '../strapi-store';
import { athleteRow, fakeGroupStore, member } from './fake-group-store';

describe('the in-memory group store', () => {
  it('has exactly the methods of the Strapi store', () => {
    const real = Object.keys(strapiGroupStore({} as Core.Strapi)).sort();
    expect(Object.keys(fakeGroupStore().store).sort()).toEqual(real);
  });

  it('rolls a failed transaction back completely', async () => {
    const { store, state, failOn } = fakeGroupStore({ athletes: [athleteRow({ id: 'a1' })] });
    failOn('record');
    await expect(store.transaction(async () => {
      await store.createMembership({ athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-11-20' });
      await store.record({ subjectType: 'group', subjectId: 'g-ib', action: 'member-allocated', actor: 'x' });
    })).rejects.toThrow('fake failure in record');
    expect(state.memberships).toEqual([]);
  });

  it('filters memberships by season, group and athlete', async () => {
    const { store } = fakeGroupStore({ memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a2', groupId: 'g-pp', seasonId: 's25' })] });
    expect((await store.memberships({ seasonId: 's26' })).map((m) => m.id)).toEqual(['m1']);
    expect((await store.memberships({ groupId: 'g-pp' })).map((m) => m.id)).toEqual(['m2']);
    expect((await store.memberships({ athleteId: 'a1', groupId: 'g-ib' })).map((m) => m.id)).toEqual(['m1']);
  });

  it('answers an action id and finds later lines on the same subjects', async () => {
    const { store } = fakeGroupStore();
    const ref = await store.recordAction({ subjectType: 'group', subjectId: 'g-ib', action: 'member-allocated', changes: { athleteId: 'a1' }, actor: 'x' });
    await store.record({ subjectType: 'athlete', subjectId: 'a1', action: 'group-added', changes: { actionId: ref.id }, actor: 'x' });
    await store.record({ subjectType: 'group', subjectId: 'g-pp', action: 'member-added', actor: 'x' });
    expect((await store.historyEntry(ref.id))?.seq).toBe(ref.seq);
    const later = await store.historyAfter(ref.seq, [{ type: 'athlete', id: 'a1' }, { type: 'group', id: 'g-ib' }]);
    expect(later.map((h) => h.action)).toEqual(['group-added']);
  });

  it('cancels only the queued e-mail jobs of one change', async () => {
    const { store, state } = fakeGroupStore();
    const job = { recipient: 'p@example.com', subject: 's', groupId: 'g-ib', notBefore: '2026-11-20T10:00:15.000Z', payload: { groupName: 'Intermediari Bronze', date: '2026-11-21', startTime: '11:00', mode: 'cancel' as const, newDate: null, newStartTime: null, nextDate: null, nextStartTime: null, reason: null } };
    await store.createEmailJobs([{ ...job, changeKey: 'h1' }, { ...job, changeKey: 'h1' }, { ...job, changeKey: 'h2' }]);
    state.jobs[1].status = 'sent';
    expect(await store.cancelEmailJobs('h1')).toBe(1);
    expect(state.jobs.map((j) => j.status)).toEqual(['cancelled', 'sent', 'queued']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/group-store.test.ts`
Expected: FAIL (`Cannot find module '../strapi-store'`).

- [ ] **Step 3: Share the P3 transaction scope**

In `src/club/athletes/strapi-store.ts`, replace `function transactions(...)` with:

```ts
type Scope = { transaction: ClubStore['transaction']; lockRow: (table: string, id: string) => Promise<void> };

/**
 * One transaction scope and the row locks taken inside it. A nested `transaction` reuses the outer one (Strapi), so
 * `active` is restored, not cleared, when it ends. The group store (src/club/groups/strapi-store.ts) has its own scope.
 */
export function transactionScope(strapi: Core.Strapi): Scope {
  let active: Knex.Transaction | null = null;
  return {
    async transaction<T>(work: () => Promise<T>): Promise<T> {
      return await strapi.db.transaction(async ({ trx }: { trx: Knex.Transaction }) => {
        const outer = active;
        active = trx;
        try {
          return await work();
        } finally {
          active = outer;
        }
      });
    },
    lockRow: async (table, id) => {
      if (active) await strapi.db.getConnection(table).transacting(active).forUpdate().where('document_id', id).select('id');
    },
  };
}

function transactions(strapi: Core.Strapi): Pick<ClubStore, 'transaction' | 'lockRegistration' | 'lockAthlete'> {
  const scope = transactionScope(strapi);
  return { transaction: scope.transaction, lockRegistration: (id) => scope.lockRow('registration_submissions', id), lockAthlete: (id) => scope.lockRow('athletes', id) };
}
```

- [ ] **Step 4: Write `src/club/groups/strapi-store.ts`**

```ts
import type { Core } from '@strapi/strapi';
import { strapiClubStore, toMembership, transactionScope } from '../athletes/strapi-store';
import { buildHistoryEntry } from '../history';
import { hhmm } from './dates';
import type {
  BreakRecord, DayKey, EventRecord, ExceptionKind, ExceptionRow, Freq, GroupRecord, GroupStore, HistoryEntryRow, Recurrence, SeasonRecord, SectionRecord, WeekOfMonth,
} from './types';

const GROUP = 'api::group.group' as const;
const SECTION = 'api::section.section' as const;
const SEASON = 'api::season.season' as const;
const TEAM = 'api::team-member.team-member' as const;
const PRICE_LIST = 'api::price-list.price-list' as const;
const MEMBERSHIP = 'api::group-membership.group-membership' as const;
const ATHLETE = 'api::athlete.athlete' as const;
const REGISTRATION = 'api::registration-submission.registration-submission' as const;
const EVENT = 'api::calendar-event.calendar-event' as const;
const BLACKOUT = 'api::calendar-blackout.calendar-blackout' as const;
const JOB = 'api::email-job.email-job' as const;
const HISTORY = 'api::history-entry.history-entry' as const;
const MAX = 100000;
const BY_ID = 'id:asc' as const;
const EVENT_POPULATE: ('recurrence' | 'exceptions' | 'group')[] = ['recurrence', 'exceptions', 'group'];

type Raw = Record<string, unknown>;
const raws = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : str(v));
const linkId = (v: unknown): string | null => (v && typeof v === 'object' ? str((v as Raw).documentId) : null);
const among = <T extends string>(values: readonly T[], v: unknown): T | null => values.find((x) => x === v) ?? null;
const DAYS: readonly DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const FREQS: readonly Freq[] = ['none', 'weekly', 'biweekly', 'monthly'];
const WEEKS: readonly WeekOfMonth[] = ['first', 'second', 'third', 'fourth', 'last'];
const KINDS: readonly ExceptionKind[] = ['cancel', 'override', 'liber', 'anulat'];
/** Strapi `time` attributes are written as "HH:mm:ss.SSS". */
const time = (t: string | null): string | null => (t ? `${t}:00.000` : null);

export function toGroupRecord(g: Raw): GroupRecord {
  return {
    id: text(g.documentId), name: text(g.name), sectionId: linkId(g.section), order: typeof g.order === 'number' ? g.order : null, active: g.active !== false,
    priceListId: linkId(g.priceList), coachIds: raws(g.coaches).map((c) => text(c.documentId)), programPublic: g.programPublic !== false,
  };
}

export function toRecurrence(r: Raw | null): Recurrence {
  const v = r ?? {};
  return {
    freq: among(FREQS, v.freq) ?? 'weekly', days: DAYS.filter((d) => v[d] === true), weekOfMonth: among(WEEKS, v.weekOfMonth),
    startTime: hhmm(str(v.startTime)), endTime: hhmm(str(v.endTime)), singleDate: str(v.singleDate), seasonStart: str(v.seasonStart), seasonEnd: str(v.seasonEnd),
  };
}

export const toException = (x: Raw): ExceptionRow => ({
  date: text(x.date), kind: among(KINDS, x.kind) ?? 'cancel', newDate: str(x.newDate), newStartTime: hhmm(str(x.newStartTime)),
  newEndTime: hhmm(str(x.newEndTime)), newTitle: str(x.newTitle), reason: str(x.reason),
});

export const toEventRecord = (e: Raw): EventRecord => ({
  id: text(e.documentId), title: text(e.title), type: text(e.type), description: str(e.description), groupId: linkId(e.group),
  recurrence: toRecurrence(e.recurrence && typeof e.recurrence === 'object' ? (e.recurrence as Raw) : null), exceptions: raws(e.exceptions).map(toException),
});

export function recurrenceData(r: Recurrence): Raw {
  return {
    freq: r.freq, ...Object.fromEntries(DAYS.map((d) => [d, r.days.includes(d)])), weekOfMonth: r.weekOfMonth, startTime: time(r.startTime), endTime: time(r.endTime),
    endsNextDay: false, singleDate: r.singleDate, endDate: null, seasonStart: r.seasonStart, seasonEnd: r.seasonEnd,
  };
}

export const exceptionData = (x: ExceptionRow): Raw => ({
  date: x.date, kind: x.kind, newDate: x.newDate, newStartTime: time(x.newStartTime), newEndTime: time(x.newEndTime), newTitle: x.newTitle, reason: x.reason,
});

const fee = (v: unknown): number | null => (typeof v === 'number' ? v : v === null || v === undefined || v === '' ? null : Number(v));
const toSeason = (s: Raw): SeasonRecord => ({
  id: text(s.documentId), label: text(s.label), startMonth: text(s.startMonth), endMonth: text(s.endMonth), isCurrent: s.isCurrent === true, membershipFee: fee(s.membershipFee),
});
const toSection = (s: Raw): SectionRecord => ({
  id: text(s.documentId), name: text(s.name), kind: s.kind === 'club' ? 'club' : 'school', publicPage: s.publicPage === true,
  order: typeof s.order === 'number' ? s.order : null, slug: text(s.slug),
});
const toHistoryEntry = (r: Raw): HistoryEntryRow => ({
  id: text(r.documentId), seq: Number(r.id), subjectType: text(r.subjectType), subjectId: text(r.subjectId), action: text(r.action),
  changes: r.changes && typeof r.changes === 'object' ? (r.changes as Record<string, unknown>) : {}, actor: text(r.actor), at: iso(r.at) ?? '',
});
const toBreak = (b: Raw): BreakRecord => ({ id: text(b.documentId), label: text(b.label), startDate: text(b.startDate), endDate: text(b.endDate) });

type Keys<K extends keyof GroupStore> = Pick<GroupStore, K>;

function lookups(strapi: Core.Strapi): Keys<'seasons' | 'sections' | 'groups' | 'group' | 'teamMembers' | 'priceLists'> {
  const groups = () => strapi.documents(GROUP);
  const populate: ('section' | 'priceList' | 'coaches')[] = ['section', 'priceList', 'coaches'];
  return {
    seasons: async () => raws(await strapi.documents(SEASON).findMany({ sort: BY_ID, limit: 1000 })).map(toSeason),
    sections: async () => raws(await strapi.documents(SECTION).findMany({ sort: BY_ID, limit: 1000 })).map(toSection),
    groups: async () => raws(await groups().findMany({ populate, sort: BY_ID, limit: 1000 })).map(toGroupRecord),
    group: async (id) => {
      const g = await groups().findOne({ documentId: id, populate });
      return g ? toGroupRecord(g as unknown as Raw) : null;
    },
    teamMembers: async () => raws(await strapi.documents(TEAM).findMany({ fields: ['name'], sort: ['order:asc', 'name:asc'], limit: 1000 })).map((t) => ({ id: text(t.documentId), name: text(t.name) })),
    priceLists: async () =>
      raws(await strapi.documents(PRICE_LIST).findMany({ fields: ['name'], populate: ['section'], sort: BY_ID, limit: 1000 })).map((p) => ({ id: text(p.documentId), name: text(p.name), sectionId: linkId(p.section) })),
  };
}

function peopleReads(strapi: Core.Strapi): Keys<'athletes' | 'athlete' | 'memberships' | 'membership' | 'registrations' | 'registrationsFiledAfter' | 'adminNames'> {
  const club = strapiClubStore(strapi);
  const by = (key: string, id: string | undefined) => (id ? { [key]: { documentId: id } } : {});
  return {
    athletes: () => club.athletes(),
    athlete: (id) => club.athlete(id),
    memberships: async (w = {}) => {
      const filters = { ...by('season', w.seasonId), ...by('group', w.groupId), ...by('athlete', w.athleteId) };
      return raws(await strapi.documents(MEMBERSHIP).findMany({ filters, populate: ['athlete', 'group', 'season'], sort: BY_ID, limit: MAX })).map(toMembership);
    },
    membership: async (id) => {
      const m = await strapi.documents(MEMBERSHIP).findOne({ documentId: id, populate: ['athlete', 'group', 'season'] });
      return m ? toMembership(m as unknown as Raw) : null;
    },
    registrations: () => club.registrations(),
    registrationsFiledAfter: (seasonId, at) => strapi.documents(REGISTRATION).count({ filters: { seasonRef: { documentId: seasonId }, createdAt: { $gt: at } } }),
    adminNames: (emails) => club.adminNames(emails),
  };
}

function calendarReads(strapi: Core.Strapi): Keys<'events' | 'event' | 'breaks'> {
  const events = () => strapi.documents(EVENT);
  return {
    events: async (w = {}) => {
      const filters = w.groupId ? { group: { documentId: w.groupId } } : {};
      return raws(await events().findMany({ filters, populate: EVENT_POPULATE, sort: BY_ID, limit: MAX })).map(toEventRecord);
    },
    event: async (id) => {
      const e = await events().findOne({ documentId: id, populate: EVENT_POPULATE });
      return e ? toEventRecord(e as unknown as Raw) : null;
    },
    breaks: async () => raws(await strapi.documents(BLACKOUT).findMany({ sort: ['startDate:asc', 'id:asc'], limit: 1000 })).map(toBreak),
  };
}

function historyReads(strapi: Core.Strapi): Keys<'history' | 'historyEntry' | 'historyAfter'> {
  const query = (where: Raw) => strapi.db.query(HISTORY).findMany({ where, orderBy: { id: 'asc' }, limit: MAX });
  return {
    history: async (subjectType, subjectId) => raws(await query({ subjectType, subjectId })).map(toHistoryEntry),
    historyEntry: async (id) => {
      const row = await strapi.db.query(HISTORY).findOne({ where: { documentId: id } });
      return row ? toHistoryEntry(row as Raw) : null;
    },
    historyAfter: async (seq, subjects) => {
      if (subjects === null) return raws(await query({ id: { $gt: seq } })).map(toHistoryEntry);
      if (!subjects.length) return [];
      return raws(await query({ id: { $gt: seq }, $or: subjects.map((s) => ({ subjectType: s.type, subjectId: s.id })) })).map(toHistoryEntry);
    },
  };
}

function groupWrites(strapi: Core.Strapi): Keys<'createGroup' | 'updateGroup' | 'deleteGroup' | 'setAthleteStatus' | 'setSeasonCurrent'> {
  const groups = () => strapi.documents(GROUP);
  const relations = (d: { sectionId?: string; priceListId?: string | null; coachIds?: string[] }) => ({
    ...(d.sectionId === undefined ? {} : { section: d.sectionId }),
    ...(d.priceListId === undefined ? {} : { priceList: d.priceListId }),
    ...(d.coachIds === undefined ? {} : { coaches: d.coachIds }),
  });
  return {
    createGroup: async (d) => (await groups().create({ data: { name: d.name, order: d.order, active: true, programPublic: d.programPublic, ...relations(d) } })).documentId,
    updateGroup: async (id, d) => {
      await groups().update({ documentId: id, data: { ...(d.name === undefined ? {} : { name: d.name }), ...(d.programPublic === undefined ? {} : { programPublic: d.programPublic }), ...relations(d) } });
    },
    deleteGroup: async (id) => {
      await groups().delete({ documentId: id });
    },
    setAthleteStatus: async (id, status) => {
      await strapi.documents(ATHLETE).update({ documentId: id, data: { status } });
    },
    setSeasonCurrent: async (id, isCurrent) => {
      await strapi.documents(SEASON).update({ documentId: id, data: { isCurrent } });
    },
  };
}

function membershipWrites(strapi: Core.Strapi): Keys<'createMembership' | 'updateMembership' | 'deleteMembership'> {
  const rows = () => strapi.documents(MEMBERSHIP);
  return {
    createMembership: async (d) =>
      (await rows().create({ data: { athlete: d.athleteId, group: d.groupId, season: d.seasonId, isMain: d.isMain, from: d.from, to: d.to ?? null } })).documentId,
    updateMembership: async (id, d) => {
      await rows().update({ documentId: id, data: { ...(d.isMain === undefined ? {} : { isMain: d.isMain }), ...(d.to === undefined ? {} : { to: d.to }) } });
    },
    deleteMembership: async (id) => {
      await rows().delete({ documentId: id });
    },
  };
}

function calendarWrites(strapi: Core.Strapi): Keys<'createEvent' | 'updateEvent' | 'deleteEvent' | 'createBreak' | 'updateBreak' | 'deleteBreak'> {
  const events = () => strapi.documents(EVENT);
  const blackouts = () => strapi.documents(BLACKOUT);
  return {
    createEvent: async (d) => (await events().create({
      data: { title: d.title, type: d.type as 'curs', description: d.description, group: d.groupId, recurrence: recurrenceData(d.recurrence), exceptions: d.exceptions.map(exceptionData) },
    })).documentId,
    updateEvent: async (id, d) => {
      const data = { ...(d.title === undefined ? {} : { title: d.title }), ...(d.recurrence ? { recurrence: recurrenceData(d.recurrence) } : {}), ...(d.exceptions ? { exceptions: d.exceptions.map(exceptionData) } : {}) };
      await events().update({ documentId: id, data });
    },
    deleteEvent: async (id) => {
      await events().delete({ documentId: id });
    },
    createBreak: async (d) => (await blackouts().create({ data: d })).documentId,
    updateBreak: async (id, d) => {
      await blackouts().update({ documentId: id, data: d });
    },
    deleteBreak: async (id) => {
      await blackouts().delete({ documentId: id });
    },
  };
}

function jobAndHistoryWrites(strapi: Core.Strapi): Keys<'createEmailJobs' | 'cancelEmailJobs' | 'recordAction' | 'record' | 'setHistoryChanges'> {
  return {
    createEmailJobs: async (jobs) => {
      for (const j of jobs) {
        await strapi.documents(JOB).create({
          data: { recipient: j.recipient, subject: j.subject, kind: 'schedule-change', group: j.groupId, payload: j.payload, changeKey: j.changeKey, notBefore: j.notBefore, status: 'queued', attempts: 0 },
        });
      }
      return jobs.length;
    },
    cancelEmailJobs: async (changeKey) => (await strapi.db.query(JOB).updateMany({ where: { changeKey, status: 'queued' }, data: { status: 'cancelled' } })).count,
    recordAction: async (entry) => {
      const row = await strapi.documents(HISTORY).create({ data: buildHistoryEntry(entry) });
      return { id: row.documentId, seq: Number(row.id) };
    },
    record: async (entry) => {
      await strapi.documents(HISTORY).create({ data: buildHistoryEntry(entry) });
    },
    setHistoryChanges: async (id, changes) => {
      await strapi.db.query(HISTORY).update({ where: { documentId: id }, data: { changes } });
    },
  };
}

/** GroupStore on Strapi: document service for writes (validation, lifecycles, the recurrence check), db queries for history. */
export function strapiGroupStore(strapi: Core.Strapi): GroupStore {
  const scope = transactionScope(strapi);
  return {
    transaction: scope.transaction,
    lockSeason: (id) => scope.lockRow('seasons', id),
    lockAthlete: (id) => scope.lockRow('athletes', id),
    lockGroup: (id) => scope.lockRow('club_groups', id),
    lockEvent: (id) => scope.lockRow('calendar_events', id),
    ...lookups(strapi), ...peopleReads(strapi), ...calendarReads(strapi), ...historyReads(strapi),
    ...groupWrites(strapi), ...membershipWrites(strapi), ...calendarWrites(strapi), ...jobAndHistoryWrites(strapi),
  };
}
```

If `tsc` rejects a document-service `data` object (Strapi's generated input types), cast only that object with `as never` at the call (the P3 store does the same where needed) and say so in the report; do not widen to `any`.

- [ ] **Step 5: Write `src/club/groups/context.ts`**

```ts
import type { Core } from '@strapi/strapi';
import { pingRevalidate } from '../../utils/revalidate';
import { adminActor } from '../admin-actor';
import type { AdminCtx } from '../admin-http';
import { isoDate, todayInBucharest } from '../birth-date';
import { strapiGroupStore } from './strapi-store';
import type { GroupStore } from './types';

/** What every phase 4 service gets from its controller. `today` is Bucharest's date, 'YYYY-MM-DD'. */
export type GroupContext = { store: GroupStore; actor: string; today: string; log: (message: string) => void; revalidate: () => void };

export async function groupContext(strapi: Core.Strapi, ctx: AdminCtx): Promise<GroupContext> {
  return {
    store: strapiGroupStore(strapi),
    actor: await adminActor(ctx.request.header.authorization, strapi),
    today: isoDate(todayInBucharest()),
    log: (message) => strapi.log.error(message),
    revalidate: () => {
      void pingRevalidate();
    },
  };
}
```

- [ ] **Step 6: Write the in-memory store**

`src/club/groups/__tests__/fake-group-store.ts`:

```ts
import type { AthleteRow, MembershipRow, RegistrationRow } from '../../athletes/store';
import { athleteRow, registrationRow } from '../../athletes/__tests__/fake-store';
import type { HistoryInput } from '../../history';
import type { GroupContext } from '../context';
import type {
  BreakRecord, EventRecord, GroupRecord, GroupStore, HistoryEntryRow, NamedRow, PriceListRow, Recurrence, ScheduleEmailJob, SeasonRecord, SectionRecord,
} from '../types';

export { athleteRow, registrationRow };
export type FakeJob = ScheduleEmailJob & { id: string; status: 'queued' | 'cancelled' | 'sent' };
export type FakeGroupState = {
  seasons: SeasonRecord[]; sections: SectionRecord[]; groups: GroupRecord[]; teamMembers: NamedRow[]; priceLists: PriceListRow[]; athletes: AthleteRow[];
  memberships: MembershipRow[]; registrations: RegistrationRow[]; events: EventRecord[]; breaks: BreakRecord[]; history: HistoryEntryRow[]; jobs: FakeJob[];
  locks: string[]; admins: Record<string, string>; filedAfter: number;
};
export type FakeGroup = { store: GroupStore; state: FakeGroupState; failOn(method: keyof GroupStore): void };

export const G_SEASONS: SeasonRecord[] = [
  { id: 's25', label: '2025-2026', startMonth: '2025-10-01', endMonth: '2026-05-31', isCurrent: false, membershipFee: 250 },
  { id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', isCurrent: true, membershipFee: 270 },
  { id: 's27', label: '2027-2028', startMonth: '2027-10-01', endMonth: '2028-05-31', isCurrent: false, membershipFee: 200 },
];
export const G_SECTIONS: SectionRecord[] = [
  { id: 'afi', name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', publicPage: true, order: 1, slug: 'scoala-afi' },
  { id: 'club', name: 'Club', kind: 'club', publicPage: false, order: 2, slug: 'club' },
];
const grp = (id: string, name: string, sectionId: string, order: number, over: Partial<GroupRecord> = {}): GroupRecord =>
  ({ id, name, sectionId, order, active: true, priceListId: null, coachIds: [], programPublic: true, ...over });
export const G_GROUPS: GroupRecord[] = [
  grp('g-pp', 'Primii Pași', 'afi', 1, { priceListId: 'pl-std' }),
  grp('g-ib', 'Intermediari Bronze', 'afi', 2, { priceListId: 'pl-std', coachIds: ['tm-virgil'] }),
  grp('g-is', 'Intermediari Silver', 'afi', 3, { priceListId: 'pl-std', coachIds: ['tm-virgil'] }),
  grp('g-pro', 'Profesioniști', 'club', 1, { coachIds: ['tm-andreea'] }),
  grp('g-av', 'Avansați', 'club', 2, { coachIds: ['tm-andreea'] }),
];
export const G_TEAM: NamedRow[] = [{ id: 'tm-andreea', name: 'Andreea Pascu' }, { id: 'tm-virgil', name: 'Virgil Pascu' }];
export const G_PRICE_LISTS: PriceListRow[] = [{ id: 'pl-std', name: 'Standard', sectionId: 'afi' }, { id: 'pl-club', name: 'Club', sectionId: 'club' }];

export const member = (over: Partial<MembershipRow> & { id: string; athleteId: string; groupId: string }): MembershipRow =>
  ({ seasonId: 's26', isMain: true, from: '2026-10-01', to: null, ...over });
const WEEKEND: Recurrence = { freq: 'weekly', days: ['sat', 'sun'], weekOfMonth: null, startTime: '11:00', endTime: '11:50', singleDate: null, seasonStart: '2026-10-04', seasonEnd: '2027-05-31' };
export const event = (over: Partial<EventRecord> & { id: string }): EventRecord =>
  ({ title: 'Intermediari Bronze', type: 'scoala', description: null, groupId: 'g-ib', recurrence: WEEKEND, exceptions: [], ...over });

function must<T extends { id: string }>(rows: T[], id: string): T {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`fake: no row ${id}`);
  return row;
}
const copy = <T>(v: T): T => structuredClone(v);
type Next = (prefix: string) => string;
type K<Keys extends keyof GroupStore> = Pick<GroupStore, Keys>;

function fakeLookups(s: FakeGroupState): K<'seasons' | 'sections' | 'groups' | 'group' | 'teamMembers' | 'priceLists' | 'athletes' | 'athlete' | 'registrations' | 'registrationsFiledAfter' | 'adminNames'> {
  return {
    seasons: async () => copy(s.seasons),
    sections: async () => copy(s.sections),
    groups: async () => copy(s.groups),
    group: async (id) => copy(s.groups.find((g) => g.id === id) ?? null),
    teamMembers: async () => copy(s.teamMembers),
    priceLists: async () => copy(s.priceLists),
    athletes: async () => copy(s.athletes),
    athlete: async (id) => copy(s.athletes.find((a) => a.id === id) ?? null),
    registrations: async () => copy(s.registrations),
    registrationsFiledAfter: async () => s.filedAfter,
    adminNames: async (emails) => Object.fromEntries(emails.filter((e) => s.admins[e]).map((e) => [e, s.admins[e]])),
  };
}

function fakeRows(s: FakeGroupState): K<'memberships' | 'membership' | 'events' | 'event' | 'breaks' | 'history' | 'historyEntry' | 'historyAfter'> {
  const hit = (v: string | undefined, actual: string) => v === undefined || v === actual;
  return {
    memberships: async (w = {}) => copy(s.memberships.filter((m) => hit(w.seasonId, m.seasonId) && hit(w.groupId, m.groupId) && hit(w.athleteId, m.athleteId))),
    membership: async (id) => copy(s.memberships.find((m) => m.id === id) ?? null),
    events: async (w = {}) => copy(s.events.filter((e) => w.groupId === undefined || e.groupId === w.groupId)),
    event: async (id) => copy(s.events.find((e) => e.id === id) ?? null),
    breaks: async () => copy([...s.breaks].sort((a, b) => a.startDate.localeCompare(b.startDate))),
    history: async (type, id) => copy(s.history.filter((h) => h.subjectType === type && h.subjectId === id)),
    historyEntry: async (id) => copy(s.history.find((h) => h.id === id) ?? null),
    historyAfter: async (seq, subjects) =>
      copy(s.history.filter((h) => h.seq > seq && (subjects === null || subjects.some((x) => x.type === h.subjectType && x.id === h.subjectId)))),
  };
}

function fakeGroupWrites(s: FakeGroupState, next: Next): K<'createGroup' | 'updateGroup' | 'deleteGroup' | 'setAthleteStatus' | 'setSeasonCurrent'> {
  return {
    createGroup: async (d) => {
      const id = next('g');
      s.groups.push({ id, name: d.name, sectionId: d.sectionId, order: d.order, active: true, priceListId: d.priceListId, coachIds: [...d.coachIds], programPublic: d.programPublic });
      return id;
    },
    updateGroup: async (id, d) => {
      Object.assign(must(s.groups, id), Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)));
    },
    deleteGroup: async (id) => {
      s.groups = s.groups.filter((g) => g.id !== id);
    },
    setAthleteStatus: async (id, status) => {
      must(s.athletes, id).status = status;
    },
    setSeasonCurrent: async (id, isCurrent) => {
      must(s.seasons, id).isCurrent = isCurrent;
    },
  };
}

function fakeMembershipWrites(s: FakeGroupState, next: Next): K<'createMembership' | 'updateMembership' | 'deleteMembership'> {
  return {
    createMembership: async (d) => {
      const id = next('gm');
      s.memberships.push({ ...d, id, to: d.to ?? null });
      return id;
    },
    updateMembership: async (id, d) => {
      Object.assign(must(s.memberships, id), Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)));
    },
    deleteMembership: async (id) => {
      must(s.memberships, id);
      s.memberships = s.memberships.filter((m) => m.id !== id);
    },
  };
}

function fakeCalendarWrites(s: FakeGroupState, next: Next): K<'createEvent' | 'updateEvent' | 'deleteEvent' | 'createBreak' | 'updateBreak' | 'deleteBreak'> {
  return {
    createEvent: async (d) => {
      const id = next('ev');
      s.events.push({ ...copy(d), id });
      return id;
    },
    updateEvent: async (id, d) => {
      Object.assign(must(s.events, id), copy(Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined))));
    },
    deleteEvent: async (id) => {
      must(s.events, id);
      s.events = s.events.filter((e) => e.id !== id);
    },
    createBreak: async (d) => {
      const id = next('br');
      s.breaks.push({ ...d, id });
      return id;
    },
    updateBreak: async (id, d) => {
      Object.assign(must(s.breaks, id), d);
    },
    deleteBreak: async (id) => {
      s.breaks = s.breaks.filter((b) => b.id !== id);
    },
  };
}

function fakeJobsAndHistory(s: FakeGroupState, next: Next, tick: () => string): K<'createEmailJobs' | 'cancelEmailJobs' | 'recordAction' | 'record' | 'setHistoryChanges'> {
  const push = (entry: HistoryInput) => {
    const seq = s.history.reduce((max, h) => Math.max(max, h.seq), 0) + 1;
    const row: HistoryEntryRow = { id: `h${seq}`, seq, subjectType: entry.subjectType, subjectId: entry.subjectId, action: entry.action, changes: copy(entry.changes ?? {}), actor: entry.actor, at: tick() };
    s.history.push(row);
    return { id: row.id, seq };
  };
  return {
    createEmailJobs: async (jobs) => {
      for (const j of jobs) s.jobs.push({ ...copy(j), id: next('job'), status: 'queued' });
      return jobs.length;
    },
    cancelEmailJobs: async (changeKey) => {
      const queued = s.jobs.filter((j) => j.changeKey === changeKey && j.status === 'queued');
      for (const j of queued) j.status = 'cancelled';
      return queued.length;
    },
    recordAction: async (entry) => push(entry),
    record: async (entry) => {
      push(entry);
    },
    setHistoryChanges: async (id, changes) => {
      must(s.history, id).changes = copy(changes);
    },
  };
}

function withFailures(store: GroupStore, failing: Set<string>): GroupStore {
  const wrapped: Record<string, unknown> = {};
  for (const [key, fn] of Object.entries(store) as [string, (...args: unknown[]) => Promise<unknown>][]) {
    wrapped[key] = (...args: unknown[]) => (failing.delete(key) ? Promise.reject(new Error(`fake failure in ${key}`)) : fn(...args));
  }
  return wrapped as unknown as GroupStore;
}

const EMPTY: FakeGroupState = {
  seasons: G_SEASONS, sections: G_SECTIONS, groups: G_GROUPS, teamMembers: G_TEAM, priceLists: G_PRICE_LISTS, athletes: [], memberships: [], registrations: [],
  events: [], breaks: [], history: [], jobs: [], locks: [], admins: {}, filedAfter: 0,
};

/** In-memory GroupStore; a transaction restores a snapshot when its work throws, so all-or-nothing is unit tested. */
export function fakeGroupStore(seed: Partial<FakeGroupState> = {}): FakeGroup {
  const state: FakeGroupState = structuredClone({ ...EMPTY, ...seed });
  const failing = new Set<string>();
  let n = 0;
  const next: Next = (prefix) => `${prefix}-${(n += 1)}`;
  const tick = () => new Date(Date.UTC(2026, 10, 20, 10, 0, 0) + (n += 1) * 1000).toISOString();
  const lock = (kind: string) => async (id: string) => {
    state.locks.push(`${kind}:${id}`);
  };
  const base: GroupStore = {
    async transaction<T>(work: () => Promise<T>): Promise<T> {
      const snapshot = structuredClone(state);
      try {
        return await work();
      } catch (err) {
        Object.assign(state, snapshot);
        throw err;
      }
    },
    lockSeason: lock('season'), lockAthlete: lock('athlete'), lockGroup: lock('group'), lockEvent: lock('event'),
    ...fakeLookups(state), ...fakeRows(state), ...fakeGroupWrites(state, next), ...fakeMembershipWrites(state, next),
    ...fakeCalendarWrites(state, next), ...fakeJobsAndHistory(state, next, tick),
  };
  return { store: withFailures(base, failing), state, failOn: (method) => failing.add(method) };
}

export type FakeContext = FakeGroup & { ctx: GroupContext; revalidated: () => number; logs: string[] };

/** A GroupContext over the fake store; today 20 November 2026 unless given. */
export function fakeContext(seed: Partial<FakeGroupState> = {}, today = '2026-11-20'): FakeContext {
  const fake = fakeGroupStore(seed);
  let pings = 0;
  const logs: string[] = [];
  const ctx: GroupContext = { store: fake.store, actor: 'admin@example.com', today, log: (m) => logs.push(m), revalidate: () => { pings += 1; } };
  return { ...fake, ctx, logs, revalidated: () => pings };
}
```

- [ ] **Step 7: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/group-store.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS (the P3 suites included: the shared scope changes no behaviour); zero type errors.

- [ ] **Step 8: Commit**

```bash
git add src/club/athletes/strapi-store.ts src/club/groups/strapi-store.ts src/club/groups/context.ts src/club/groups/__tests__/fake-group-store.ts src/club/groups/__tests__/group-store.test.ts
git commit -m "feat(groups): group store on Strapi and in memory, shared transaction scope, service context"
```

---
### Task 7: Grupe reads (list, "Fără grupă", group page, options, group Istoric)

**Files:**
- Create: `src/club/groups/season-pick.ts`, `src/club/groups/sections.ts`, `src/club/groups/api-types.ts`, `src/club/groups/list.ts`, `src/club/groups/unassigned.ts`, `src/club/groups/group-page.ts`, `src/club/groups/group-history.ts`
- Modify: `src/club/groups/copy/core.ts` (`SECTION_LABELS`)
- Test: `src/club/groups/__tests__/reads.test.ts`

**Interfaces:**
- Consumes: Tasks 2 to 6; `registrationSeasonLabel` (`src/club/athletes/cards.ts`), `ageFromIso`, `partsFromIso` (`src/club/birth-date.ts`), `actorLabel` (`src/club/history-text.ts`), `HistoryLine` (`src/club/athletes/api-types.ts`).
- Produces:
  - `season-pick.ts`: `startYear(label)`, `currentSeason(seasons)`, `pickSeason(seasons, label)`, `isPastSeason(season, seasons)`, `previousSeason(season, seasons)`, `seasonRef(season, seasons): SeasonRef`, `seasonChoices(seasons): SeasonChoice[]`, `startDateFor(season, today)` (membership `from`, gaps #29), `ageOnIso(birthDate, today)`.
  - `sections.ts`: `orderedSections(sections)`, `sectionLabel(section, sections)`, `byGroupOrder`, `groupChoices(groups, sections): GroupChoice[]`.
  - `api-types.ts`: `SeasonRef`, `SeasonChoice`, `SectionTab`, `GroupListRow`, `GroupListPage`, `GroupChoice`, `UnassignedRow`, `UnassignedPage`, `MemberRow`, `NamedRef`, `GroupPage`, `GroupOptions`, `JoinResult`, `MoveResult`, `AllocateResult`, `ActionBody<T> = { data: T; undo: { actionId: string } | null }`.
  - `readGroupList(store, query, today): Promise<GroupListPage>`, `readListQuery(q)`.
  - `unassignedRows(facts): UnassignedRow[]`, `readUnassigned(store, label, today): Promise<UnassignedPage>`.
  - `readGroupPage(store, id, label, today): Promise<GroupPage | null>`, `readGroupOptions(store): Promise<GroupOptions>`.
  - `readGroupHistory(store, groupId): Promise<HistoryLine[]>`.

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/reads.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readGroupHistory } from '../group-history';
import { readGroupOptions, readGroupPage } from '../group-page';
import { readGroupList, readListQuery } from '../list';
import { readUnassigned } from '../unassigned';
import { athleteRow, event, fakeGroupStore, member, registrationRow } from './fake-group-store';

const TODAY = '2026-11-20';
const seed = () => fakeGroupStore({
  athletes: [
    athleteRow({ id: 'a1', name: 'Ana Ionescu', birthDate: '2014-05-02' }),
    athleteRow({ id: 'a2', name: 'Daria Stan', birthDate: '2015-03-10' }),
    athleteRow({ id: 'a3', name: 'Elisa Georgescu', birthDate: '2014-09-01', status: 'nou' }),
    athleteRow({ id: 'a4', name: 'Matei Ionescu', birthDate: '2017-02-14' }),
    athleteRow({ id: 'a5', name: 'Sofia Tănase' }),
    athleteRow({ id: 'a6', name: 'Tudor Matei', status: 'inactiv' }),
    athleteRow({ id: 'a7', name: 'Sportiv anonimizat', status: 'anonimizat' }),
  ],
  memberships: [
    member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }),
    member({ id: 'm2', athleteId: 'a2', groupId: 'g-av' }),
    member({ id: 'm3', athleteId: 'a2', groupId: 'g-ib', isMain: false }),
    member({ id: 'm4', athleteId: 'a4', groupId: 'g-pp', seasonId: 's25' }),
    member({ id: 'm5', athleteId: 'a1', groupId: 'g-pp', to: '2026-10-31', isMain: false }),
  ],
  registrations: [registrationRow({ id: 'r1', athleteId: 'a3', seasonId: 's26' })],
  events: [event({ id: 'e1' }), event({ id: 'e2', groupId: 'g-av', type: 'curs', title: 'Avansați', recurrence: { freq: 'weekly', days: ['tue', 'thu'], weekOfMonth: null, startTime: '18:00', endTime: '19:30', singleDate: null, seasonStart: '2026-10-01', seasonEnd: '2027-05-31' } })],
});

describe('Grupe list (5.2)', () => {
  it('shows one tab per section, the school one as "Școala de patinaj", with group counts', async () => {
    const page = await readGroupList(seed().store, readListQuery({}), TODAY);
    expect(page.tabs).toEqual([{ documentId: 'afi', slug: 'scoala-afi', label: 'Școala de patinaj', count: 3 }, { documentId: 'club', slug: 'club', label: 'Club', count: 2 }]);
    expect(page.season).toEqual({ documentId: 's26', label: '2026-2027', past: false });
    expect(page.section).toBe('scoala-afi');
  });

  it('lists the groups with program, coaches and current members; the line counts distinct athletes', async () => {
    const page = await readGroupList(seed().store, readListQuery({ section: 'scoala-afi' }), TODAY);
    expect(page.rows).toEqual([
      { documentId: 'g-pp', name: 'Primii Pași', program: [], coaches: [], members: 0 },
      { documentId: 'g-ib', name: 'Intermediari Bronze', program: ['Sâ, Du 11:00'], coaches: ['Virgil Pascu'], members: 2 },
      { documentId: 'g-is', name: 'Intermediari Silver', program: [], coaches: ['Virgil Pascu'], members: 0 },
    ]);
    expect([page.athletes, page.groups]).toEqual([2, 3]);
    expect(page.unassigned).toBe(3);
  });

  it('falls back to the current season for an unknown label and marks a past season', async () => {
    expect((await readGroupList(seed().store, readListQuery({ season: '2019-2020' }), TODAY)).season?.label).toBe('2026-2027');
    expect((await readGroupList(seed().store, readListQuery({ season: '2025-2026' }), TODAY)).season?.past).toBe(true);
  });
});

describe('"Fără grupă" (5.3, W6, W30)', () => {
  it('lists Nou and Activ athletes without a current group, anonymized and inactive never', async () => {
    const page = await readUnassigned(seed().store, null, TODAY);
    expect(page.rows).toEqual([
      { athleteId: 'a3', name: 'Elisa Georgescu', source: 'Înscriere Școală, 12 ani', proposedGroupId: null },
      { athleteId: 'a4', name: 'Matei Ionescu', source: 'Din 2025-2026, 9 ani', proposedGroupId: 'g-pp' },
      { athleteId: 'a5', name: 'Sofia Tănase', source: 'Adăugat în Sportivi', proposedGroupId: null },
    ]);
  });

  it('offers every active group, school first, the section as hint', async () => {
    const page = await readUnassigned(seed().store, null, TODAY);
    expect(page.groups.map((g) => `${g.name} / ${g.sectionName}`)).toEqual([
      'Primii Pași / Școala de patinaj', 'Intermediari Bronze / Școala de patinaj', 'Intermediari Silver / Școala de patinaj', 'Profesioniști / Club', 'Avansați / Club',
    ]);
  });

  it('proposes nothing when last season\'s group is no longer active', async () => {
    const fake = seed();
    fake.state.groups[0].active = false;
    expect((await readUnassigned(fake.store, null, TODAY)).rows[1].proposedGroupId).toBeNull();
  });
});

describe('group page (6.1, 6.2)', () => {
  it('reads the header and the roster, other groups with the main one marked', async () => {
    const page = await readGroupPage(seed().store, 'g-ib', null, TODAY);
    expect(page?.section).toEqual({ documentId: 'afi', name: 'Școala de patinaj', kind: 'school' });
    expect(page?.priceList).toEqual({ documentId: 'pl-std', name: 'Standard' });
    expect(page?.coaches).toEqual([{ documentId: 'tm-virgil', name: 'Virgil Pascu' }]);
    expect(page?.members).toEqual([
      { membershipId: 'm1', athleteId: 'a1', name: 'Ana Ionescu', age: 12, isMain: true, others: [] },
      { membershipId: 'm3', athleteId: 'a2', name: 'Daria Stan', age: 11, isMain: false, others: [{ name: 'Avansați', isMain: true }] },
    ]);
    expect(page?.deletable).toBe(false);
  });

  it('a group that never had a member or an event can be deleted; an unknown one is null', async () => {
    expect((await readGroupPage(seed().store, 'g-is', null, TODAY))?.deletable).toBe(true);
    expect(await readGroupPage(seed().store, 'nope', null, TODAY)).toBeNull();
  });

  it('options carry price lists with their section and the coaches', async () => {
    const options = await readGroupOptions(seed().store);
    expect(options.priceLists).toEqual([{ documentId: 'pl-std', name: 'Standard', sectionId: 'afi' }, { documentId: 'pl-club', name: 'Club', sectionId: 'club' }]);
    expect(options.coaches.map((c) => c.name)).toEqual(['Andreea Pascu', 'Virgil Pascu']);
  });
});

describe('group Istoric (6.4, decided 2)', () => {
  it('shows the athlete\'s current name, newest first, "Migrare" for migration rows', async () => {
    const fake = seed();
    await fake.store.record({ subjectType: 'group', subjectId: 'g-ib', action: 'group-created', actor: 'migrare' });
    await fake.store.record({ subjectType: 'group', subjectId: 'g-ib', action: 'member-allocated', changes: { athleteId: 'a7' }, actor: 'admin@example.com' });
    const lines = await readGroupHistory(fake.store, 'g-ib');
    expect(lines.map((l) => [l.actor, l.text])).toEqual([['admin@example.com', 'Sportiv alocat: Sportiv anonimizat.'], ['Migrare', 'Grupă creată.']]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/reads.test.ts`
Expected: FAIL (`Cannot find module '../group-history'`).

- [ ] **Step 3: Write `season-pick.ts`, `sections.ts` and the section label**

Append to `src/club/groups/copy/core.ts`:

```ts
/** The school tab and hint while the club has one school (5.2, W16). */
export const SECTION_LABELS = { school: 'Școala de patinaj' } as const;
```

`src/club/groups/season-pick.ts`:

```ts
import { ageFromIso, partsFromIso } from '../birth-date';
import type { SeasonChoice, SeasonRef } from './api-types';
import type { SeasonRecord } from './types';

export const startYear = (label: string): number => Number(label.slice(0, 4));

/** The season marked current; several marked current should not happen, the latest label wins (as `pickCurrentSeason`). */
export function currentSeason(seasons: SeasonRecord[]): SeasonRecord | null {
  return [...seasons].filter((s) => s.isCurrent).sort((a, b) => b.label.localeCompare(a.label))[0] ?? null;
}

/** The season the query names, else the current one (W5). */
export const pickSeason = (seasons: SeasonRecord[], label: string | null): SeasonRecord | null => seasons.find((s) => s.label === label) ?? currentSeason(seasons);

/** Decided 7: older than the current season. */
export function isPastSeason(season: SeasonRecord, seasons: SeasonRecord[]): boolean {
  const current = currentSeason(seasons);
  return current !== null && season.label < current.label;
}

export const previousSeason = (season: SeasonRecord, seasons: SeasonRecord[]): SeasonRecord | null =>
  seasons.find((s) => startYear(s.label) === startYear(season.label) - 1) ?? null;

export const seasonRef = (season: SeasonRecord, seasons: SeasonRecord[]): SeasonRef => ({ documentId: season.id, label: season.label, past: isPastSeason(season, seasons) });

export const seasonChoices = (seasons: SeasonRecord[]): SeasonChoice[] =>
  [...seasons].sort((a, b) => b.label.localeCompare(a.label)).map((s) => ({ documentId: s.id, label: s.label, isCurrent: s.isCurrent }));

/** Membership `from`: today, or the season start when it has not started (gaps #29, same rule as `membershipFrom`). */
export function startDateFor(season: SeasonRecord, today: string): string {
  const start = season.startMonth.slice(0, 10);
  return today < start ? start : today;
}

export function ageOnIso(birthDate: string | null, today: string): number | null {
  const parts = partsFromIso(today);
  return parts ? ageFromIso(birthDate, parts) : null;
}
```

`src/club/groups/sections.ts`:

```ts
import type { GroupChoice } from './api-types';
import { SECTION_LABELS } from './copy';
import type { GroupRecord, SectionRecord } from './types';

const rank = (s: SectionRecord): number => (s.kind === 'school' ? 0 : 1);

/** Schools first, then Club, each in its order (5.2, 5.3). */
export const orderedSections = (sections: SectionRecord[]): SectionRecord[] =>
  [...sections].sort((a, b) => rank(a) - rank(b) || (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'ro'));

/** "Școala de patinaj" while there is one school; with 2+ schools, each school's own name (W16). */
export function sectionLabel(section: SectionRecord, sections: SectionRecord[]): string {
  const schools = sections.filter((s) => s.kind === 'school').length;
  return section.kind === 'school' && schools === 1 ? SECTION_LABELS.school : section.name;
}

export const byGroupOrder = (a: GroupRecord, b: GroupRecord): number => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'ro');

/** Every active group, school first then Club, in their order; the section as the hint (5.3, 6.2). */
export function groupChoices(groups: GroupRecord[], sections: SectionRecord[]): GroupChoice[] {
  return orderedSections(sections).flatMap((s) =>
    groups.filter((g) => g.active && g.sectionId === s.id).sort(byGroupOrder).map((g) => ({ documentId: g.id, name: g.name, sectionName: sectionLabel(s, sections) })),
  );
}
```

- [ ] **Step 4: Write `api-types.ts`**

```ts
/** JSON shapes of the 06-groups routes (spec 8.2). The admin UI (plan 4-5) reads these. */
export type SeasonRef = { documentId: string; label: string; past: boolean };
export type SeasonChoice = { documentId: string; label: string; isCurrent: boolean };
export type NamedRef = { documentId: string; name: string };
export type SectionTab = { documentId: string; slug: string; label: string; count: number };
export type GroupListRow = { documentId: string; name: string; program: string[]; coaches: string[]; members: number };
export type GroupListPage = {
  season: SeasonRef | null; seasons: SeasonChoice[]; tabs: SectionTab[]; section: string | null;
  /** Distinct athletes with a current membership in the tab's groups, and the number of groups (the line under the tabs). */
  athletes: number; groups: number; rows: GroupListRow[]; unassigned: number;
};
export type GroupChoice = { documentId: string; name: string; sectionName: string };
export type UnassignedRow = { athleteId: string; name: string; source: string; proposedGroupId: string | null };
export type UnassignedPage = { season: SeasonRef | null; rows: UnassignedRow[]; groups: GroupChoice[] };
export type MemberRow = { membershipId: string; athleteId: string; name: string; age: number | null; isMain: boolean; others: { name: string; isMain: boolean }[] };
export type GroupPage = {
  documentId: string; name: string; section: (NamedRef & { kind: 'school' | 'club' }) | null; priceList: NamedRef | null; coaches: NamedRef[];
  programPublic: boolean; season: SeasonRef | null; members: MemberRow[]; historyCount: number; deletable: boolean;
};
export type GroupOptions = { groups: GroupChoice[]; coaches: NamedRef[]; priceLists: (NamedRef & { sectionId: string | null })[] };
export type JoinResult = { added: number; athleteNames: string[]; groupName: string };
export type AllocateResult = { allocated: number };
export type MoveResult = { athleteName: string; groupName: string };
/** Every write route answers this (spec 8.2): `undo` is null when the action wrote nothing to take back. */
export type ActionBody<T> = { data: T; undo: { actionId: string } | null };
```

- [ ] **Step 5: Write `unassigned.ts`**

```ts
import { registrationSeasonLabel } from '../athletes/cards';
import type { AthleteRow, MembershipRow, RegistrationRow } from '../athletes/store';
import { isCurrentMembership } from '../group-membership';
import type { UnassignedPage, UnassignedRow } from './api-types';
import { sourceLine, type SourceKind } from './copy';
import { ageOnIso, pickSeason, previousSeason, seasonRef } from './season-pick';
import { groupChoices } from './sections';
import type { GroupRecord, GroupStore, SeasonRecord } from './types';

export type UnassignedFacts = {
  season: SeasonRecord; seasons: SeasonRecord[]; athletes: AthleteRow[]; memberships: MembershipRow[]; registrations: RegistrationRow[]; groups: GroupRecord[]; today: string;
};
type Prev = SeasonRecord | null;

const ELIGIBLE: ReadonlySet<string> = new Set(['nou', 'activ']);

function sourceKind(a: AthleteRow, f: UnassignedFacts, previous: Prev): SourceKind {
  if (f.registrations.some((r) => r.athleteId === a.id && registrationSeasonLabel(r, f.seasons) === f.season.label)) return 'registration';
  return previous && f.memberships.some((m) => m.athleteId === a.id && m.seasonId === previous.id) ? 'previous' : 'added';
}

/** Decided 8: last season's current main row, when that group is still active. */
function proposedGroup(a: AthleteRow, f: UnassignedFacts, previous: Prev): string | null {
  if (!previous) return null;
  const main = f.memberships.find((m) => m.athleteId === a.id && m.seasonId === previous.id && m.isMain && isCurrentMembership(m));
  const group = main ? f.groups.find((g) => g.id === main.groupId) : undefined;
  return group?.active ? group.id : null;
}

function unassignedRow(a: AthleteRow, f: UnassignedFacts, previous: Prev): UnassignedRow {
  return {
    athleteId: a.id, name: a.name ?? '',
    source: sourceLine(sourceKind(a, f, previous), previous?.label ?? null, ageOnIso(a.birthDate, f.today)),
    proposedGroupId: proposedGroup(a, f, previous),
  };
}

/** "Fără grupă" (5.3, W6): Nou or Activ athletes with no current membership in the season, by name. */
export function unassignedRows(f: UnassignedFacts): UnassignedRow[] {
  const placed = new Set(f.memberships.filter((m) => m.seasonId === f.season.id && isCurrentMembership(m)).map((m) => m.athleteId));
  const previous = previousSeason(f.season, f.seasons);
  return f.athletes
    .filter((a) => ELIGIBLE.has(a.status) && !placed.has(a.id))
    .map((a) => unassignedRow(a, f, previous))
    .sort((x, y) => x.name.localeCompare(y.name, 'ro'));
}

export async function unassignedFor(store: GroupStore, season: SeasonRecord, seasons: SeasonRecord[], today: string): Promise<UnassignedRow[]> {
  const [athletes, memberships, registrations, groups] = await Promise.all([store.athletes(), store.memberships(), store.registrations(), store.groups()]);
  return unassignedRows({ season, seasons, athletes, memberships, registrations, groups, today });
}

export async function readUnassigned(store: GroupStore, label: string | null, today: string): Promise<UnassignedPage> {
  const [seasons, sections, groups] = await Promise.all([store.seasons(), store.sections(), store.groups()]);
  const season = pickSeason(seasons, label);
  return {
    season: season ? seasonRef(season, seasons) : null,
    rows: season ? await unassignedFor(store, season, seasons, today) : [],
    groups: groupChoices(groups, sections),
  };
}
```

- [ ] **Step 6: Write `list.ts`**

```ts
import type { MembershipRow } from '../athletes/store';
import { isCurrentMembership } from '../group-membership';
import type { GroupListPage, GroupListRow, SectionTab } from './api-types';
import { listLine } from './program-text';
import { pickSeason, seasonChoices, seasonRef } from './season-pick';
import { byGroupOrder, orderedSections, sectionLabel } from './sections';
import { currentSeries, seriesText } from './series';
import { unassignedFor } from './unassigned';
import type { EventRecord, GroupRecord, GroupStore, NamedRow, SeasonRecord, SectionRecord } from './types';

export type ListQuery = { season: string | null; section: string | null };
const queryText = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
export const readListQuery = (q: Record<string, unknown>): ListQuery => ({ season: queryText(q.season), section: queryText(q.section) });

type ListFacts = { season: SeasonRecord | null; sections: SectionRecord[]; groups: GroupRecord[]; current: MembershipRow[]; events: EventRecord[]; team: NamedRow[]; today: string };

const tabsOf = (sections: SectionRecord[], groups: GroupRecord[]): SectionTab[] =>
  orderedSections(sections).map((s) => ({ documentId: s.id, slug: s.slug, label: sectionLabel(s, sections), count: groups.filter((g) => g.active && g.sectionId === s.id).length }));

function rowOf(g: GroupRecord, f: ListFacts): GroupListRow {
  const program = f.season ? currentSeries(f.events, g.id, f.season, f.today).map((s) => listLine(seriesText(s))) : [];
  const coaches = f.team.filter((t) => g.coachIds.includes(t.id)).map((t) => t.name);
  return { documentId: g.id, name: g.name, program, coaches, members: f.current.filter((m) => m.groupId === g.id).length };
}

function tabRows(f: ListFacts, sectionId: string | undefined): { rows: GroupListRow[]; athletes: number } {
  const groups = f.groups.filter((g) => g.active && g.sectionId === sectionId).sort(byGroupOrder);
  const ids = new Set(groups.map((g) => g.id));
  return { rows: groups.map((g) => rowOf(g, f)), athletes: new Set(f.current.filter((m) => ids.has(m.groupId)).map((m) => m.athleteId)).size };
}

/** Grupe (5.2): tabs, the open tab's groups (inactive left out) and the distinct-athletes line, for one season. */
export async function readGroupList(store: GroupStore, q: ListQuery, today: string): Promise<GroupListPage> {
  const [seasons, sections, groups, events, team] = await Promise.all([store.seasons(), store.sections(), store.groups(), store.events(), store.teamMembers()]);
  const season = pickSeason(seasons, q.season);
  const current = season ? (await store.memberships({ seasonId: season.id })).filter(isCurrentMembership) : [];
  const tabs = tabsOf(sections, groups);
  const section = sections.find((s) => s.slug === q.section) ?? orderedSections(sections)[0];
  const { rows, athletes } = tabRows({ season, sections, groups, current, events, team, today }, section?.id);
  return {
    season: season ? seasonRef(season, seasons) : null, seasons: seasonChoices(seasons), tabs, section: section?.slug ?? null,
    athletes, groups: rows.length, rows, unassigned: season ? (await unassignedFor(store, season, seasons, today)).length : 0,
  };
}
```

- [ ] **Step 7: Write `group-history.ts` and `group-page.ts`**

`src/club/groups/group-history.ts`:

```ts
import type { HistoryLine } from '../athletes/api-types';
import { actorLabel } from '../history-text';
import { GROUP_SUBJECT, athleteIdsOf, groupHistoryTexts } from './history-lines';
import type { GroupStore } from './types';

type Line = HistoryLine & { seq: number };

/** Group Istoric (6.4): newest first, the actor by name ("Migrare" for migration rows), athletes by their current name (decided 2). */
export async function readGroupHistory(store: GroupStore, groupId: string): Promise<HistoryLine[]> {
  const rows = await store.history(GROUP_SUBJECT, groupId);
  const ids = new Set(rows.flatMap((r) => athleteIdsOf(r.changes)));
  const names = ids.size ? Object.fromEntries((await store.athletes()).filter((a) => ids.has(a.id)).map((a) => [a.id, a.name ?? ''])) : {};
  const emails = [...new Set(rows.map((r) => r.actor).filter((a) => a.includes('@')))];
  const admins = emails.length ? await store.adminNames(emails) : {};
  const lines: Line[] = rows.flatMap((r) => groupHistoryTexts(r.action, r.changes, names).map((text) => ({ at: r.at, actor: actorLabel(r.actor, admins), text, seq: r.seq })));
  return lines.sort((a, b) => b.at.localeCompare(a.at) || b.seq - a.seq).map(({ at, actor, text }) => ({ at, actor, text }));
}
```

`src/club/groups/group-page.ts`:

```ts
import type { AthleteRow, MembershipRow } from '../athletes/store';
import { isCurrentMembership } from '../group-membership';
import type { GroupOptions, GroupPage, MemberRow } from './api-types';
import { readGroupHistory } from './group-history';
import { ageOnIso, pickSeason, seasonRef } from './season-pick';
import { groupChoices, sectionLabel } from './sections';
import type { GroupRecord, GroupStore } from './types';

type Roster = { group: GroupRecord; current: MembershipRow[]; athletes: AthleteRow[]; groups: GroupRecord[]; today: string };

function memberRow(m: MembershipRow, r: Roster, people: Map<string, AthleteRow>, groupName: Map<string, string>): MemberRow {
  const a = people.get(m.athleteId);
  const others = r.current.filter((o) => o.athleteId === m.athleteId && o.groupId !== r.group.id).map((o) => ({ name: groupName.get(o.groupId) ?? '', isMain: o.isMain }));
  return { membershipId: m.id, athleteId: m.athleteId, name: a?.name ?? '', age: ageOnIso(a?.birthDate ?? null, r.today), isMain: m.isMain, others };
}

/** Sportivi tab (6.2): the group's current members of the season, by name, with their other current groups. */
function memberRows(r: Roster): MemberRow[] {
  const people = new Map(r.athletes.map((a) => [a.id, a]));
  const groupName = new Map(r.groups.map((g) => [g.id, g.name]));
  return r.current.filter((m) => m.groupId === r.group.id).map((m) => memberRow(m, r, people, groupName)).sort((a, b) => a.name.localeCompare(b.name, 'ro'));
}

async function neverUsed(store: GroupStore, id: string): Promise<boolean> {
  const [memberships, events] = await Promise.all([store.memberships({ groupId: id }), store.events({ groupId: id })]);
  return memberships.length === 0 && events.length === 0;
}

/** The group page header and roster (6.1, 6.2) for the season in the URL, else the current one; null for an unknown group. */
export async function readGroupPage(store: GroupStore, id: string, label: string | null, today: string): Promise<GroupPage | null> {
  const group = await store.group(id);
  if (!group) return null;
  const [seasons, sections, team, priceLists, athletes, groups, history, deletable] = await Promise.all([
    store.seasons(), store.sections(), store.teamMembers(), store.priceLists(), store.athletes(), store.groups(), readGroupHistory(store, id), neverUsed(store, id),
  ]);
  const season = pickSeason(seasons, label);
  const current = season ? (await store.memberships({ seasonId: season.id })).filter(isCurrentMembership) : [];
  const section = sections.find((s) => s.id === group.sectionId);
  const priceList = priceLists.find((p) => p.id === group.priceListId);
  return {
    documentId: group.id, name: group.name, section: section ? { documentId: section.id, name: sectionLabel(section, sections), kind: section.kind } : null,
    priceList: priceList ? { documentId: priceList.id, name: priceList.name } : null,
    coaches: team.filter((t) => group.coachIds.includes(t.id)).map((t) => ({ documentId: t.id, name: t.name })),
    programPublic: group.programPublic, season: season ? seasonRef(season, seasons) : null,
    members: memberRows({ group, current, athletes, groups, today }), historyCount: history.length, deletable,
  };
}

export async function readGroupOptions(store: GroupStore): Promise<GroupOptions> {
  const [groups, sections, team, priceLists] = await Promise.all([store.groups(), store.sections(), store.teamMembers(), store.priceLists()]);
  return {
    groups: groupChoices(groups, sections),
    coaches: team.map((t) => ({ documentId: t.id, name: t.name })),
    priceLists: priceLists.map((p) => ({ documentId: p.id, name: p.name, sectionId: p.sectionId })),
  };
}
```

- [ ] **Step 8: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/reads.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 9: Commit**

```bash
git add src/club/groups src/club/groups/__tests__/reads.test.ts
git commit -m "feat(groups): Grupe list, Fără grupă, group page, options and group Istoric reads"
```

---

### Task 8: "Grupă nouă", "Editează grupa", "Șterge grupa"

**Files:**
- Create: `src/club/groups/group-admin.ts`, `src/club/groups/action-log.ts`
- Test: `src/club/groups/__tests__/group-admin.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 4, 6, 7; `normalizeGroupName`, `nameKey` (`src/club/migrate/names.ts`); `guarded`, `refuse`, `AdminResult`, `FieldChange` (`src/club/admin-result.ts`).
- Produces:
  - `action-log.ts`: `Line = { subjectType; subjectId; action; changes? }`, `ActionResult<T> = AdminResult<{ value: T; actionId: string | null }>`, `done(value, actionId)`, `subjectsOf(lines): Subject[]`, `recordAction(store, actor, lines, undo: Omit<UndoRecord, 'subjects'>): Promise<string>` (first line carries `undo`, the others `actionId`), `recordLines(store, actor, lines): Promise<void>` (no undo).
  - `group-admin.ts`: `GroupInput`, `readGroupInput(body)`, `createGroup(ctx, body): Promise<AdminResult<NamedRef>>` (body `{ section: <slug>, name, priceListId, coachIds, programPublic }`), `updateGroup(ctx, id, body): Promise<AdminResult<{ changed: boolean }>>`, `deleteGroup(ctx, id): Promise<AdminResult<{ name: string }>>`.

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/group-admin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createGroup, deleteGroup, readGroupInput, updateGroup } from '../group-admin';
import { event, fakeContext, member } from './fake-group-store';

const body = (over: Record<string, unknown> = {}) => ({ section: 'scoala-afi', name: 'Începători', priceListId: 'pl-std', coachIds: ['tm-virgil'], programPublic: true, ...over });

describe('reading the group window (5.4, W11)', () => {
  it('trims the name, writes comma letters and defaults "Program public" to on', () => {
    expect(readGroupInput({ name: '  Primii Paşi ', coachIds: ['tm-virgil'] })).toEqual({ ok: true, value: { name: 'Primii Pași', priceListId: null, coachIds: ['tm-virgil'], programPublic: true } });
    expect(readGroupInput({ name: ' ' })).toEqual({ ok: false, error: 'Completați numele.' });
  });
});

describe('"Grupă nouă"', () => {
  it('creates the group last in its section, with a history line', async () => {
    const { ctx, state } = fakeContext();
    const res = await createGroup(ctx, body());
    expect(res).toEqual({ ok: true, data: { documentId: expect.any(String), name: 'Începători' } });
    const created = state.groups.find((g) => g.name === 'Începători');
    expect(created).toMatchObject({ sectionId: 'afi', order: 4, priceListId: 'pl-std', coachIds: ['tm-virgil'], programPublic: true, active: true });
    expect(state.history.map((h) => [h.subjectType, h.action])).toEqual([['group', 'group-created']]);
  });

  it('refuses a name already used in the section, ignoring case and diacritics (W17)', async () => {
    const { ctx } = fakeContext();
    expect(await createGroup(ctx, body({ name: 'primii pasi' }))).toEqual({ ok: false, status: 409, error: 'Există deja o grupă cu acest nume.' });
    expect((await createGroup(ctx, body({ section: 'club', name: 'Primii Pași', priceListId: null }))).ok).toBe(true);
  });

  it('refuses a price list of another section or an unknown coach', async () => {
    const { ctx } = fakeContext();
    expect((await createGroup(ctx, body({ priceListId: 'pl-club' }))).ok).toBe(false);
    expect((await createGroup(ctx, body({ coachIds: ['nobody'] }))).ok).toBe(false);
  });
});

describe('"Editează grupa"', () => {
  it('writes one line per changed field, old -> new, and pings the website for a public change', async () => {
    const { ctx, state, revalidated } = fakeContext();
    const res = await updateGroup(ctx, 'g-ib', { name: 'Intermediari Bronz', priceListId: null, coachIds: ['tm-virgil', 'tm-andreea'], programPublic: false });
    expect(res).toEqual({ ok: true, data: { changed: true } });
    expect(state.history[0].changes).toEqual({ fields: {
      name: { from: 'Intermediari Bronze', to: 'Intermediari Bronz' }, priceList: { from: 'Standard', to: '' },
      coaches: { from: 'Virgil Pascu', to: 'Andreea Pascu, Virgil Pascu' }, programPublic: { from: true, to: false },
    } });
    expect(revalidated()).toBe(1);
  });

  it('answers "no change" without a line', async () => {
    const { ctx, state } = fakeContext();
    expect(await updateGroup(ctx, 'g-ib', { name: 'Intermediari Bronze', priceListId: 'pl-std', coachIds: ['tm-virgil'], programPublic: true })).toEqual({ ok: true, data: { changed: false } });
    expect(state.history).toEqual([]);
  });
});

describe('"Șterge grupa" (W11)', () => {
  it('deletes a group that never had a member or an event', async () => {
    const { ctx, state } = fakeContext();
    expect(await deleteGroup(ctx, 'g-is')).toEqual({ ok: true, data: { name: 'Intermediari Silver' } });
    expect(state.groups.some((g) => g.id === 'g-is')).toBe(false);
  });

  it('refuses (409) once it had an ended membership or an event', async () => {
    const used = fakeContext({ memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-is', to: '2026-10-31' })] });
    expect(await deleteGroup(used.ctx, 'g-is')).toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
    const scheduled = fakeContext({ events: [event({ id: 'e1', groupId: 'g-is' })] });
    expect((await deleteGroup(scheduled.ctx, 'g-is')).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/group-admin.test.ts`
Expected: FAIL (`Cannot find module '../group-admin'`).

- [ ] **Step 3: Write `action-log.ts`**

```ts
import type { AdminResult } from '../admin-result';
import type { GroupStore, Subject } from './types';
import type { UndoRecord } from './undo';

/** One Istoric line of an action. */
export type Line = { subjectType: string; subjectId: string; action: string; changes?: Record<string, unknown> };
/** A write route's answer: the value, and the action id the toast's "Anulează" sends (null: nothing to undo). */
export type ActionResult<T> = AdminResult<{ value: T; actionId: string | null }>;

export const done = <T>(value: T, actionId: string | null): ActionResult<T> => ({ ok: true, data: { value, actionId } });

export function subjectsOf(lines: Line[]): Subject[] {
  const seen = new Map<string, Subject>();
  for (const l of lines) seen.set(`${l.subjectType}:${l.subjectId}`, { type: l.subjectType, id: l.subjectId });
  return [...seen.values()];
}

/** Writes the lines; the first carries the undo record, the others its id (`actionId`). Answers the action id. */
export async function recordAction(store: GroupStore, actor: string, lines: Line[], undo: Omit<UndoRecord, 'subjects'>): Promise<string> {
  const [first, ...rest] = lines;
  const record: UndoRecord = { ...undo, subjects: subjectsOf(lines) };
  const ref = await store.recordAction({ ...first, changes: { ...first.changes, undo: record }, actor });
  for (const line of rest) await store.record({ ...line, changes: { ...line.changes, actionId: ref.id }, actor });
  return ref.id;
}

/** Lines of an action with no undo (group window, breaks). */
export async function recordLines(store: GroupStore, actor: string, lines: Line[]): Promise<void> {
  for (const line of lines) await store.record({ ...line, actor });
}
```

- [ ] **Step 4: Write `group-admin.ts`**

```ts
import { guarded, refuse, type AdminResult, type FieldChange } from '../admin-result';
import { nameKey, normalizeGroupName } from '../migrate/names';
import { recordLines } from './action-log';
import type { NamedRef } from './api-types';
import type { GroupContext } from './context';
import { GROUP_ERRORS } from './copy';
import { GROUP_SUBJECT, P4_ACTIONS } from './history-lines';
import type { GroupRecord, GroupStore, NamedRow, PriceListRow } from './types';

/** "Grupă nouă" / "Editează grupa" (5.4, W11, W17). */
export type GroupInput = { name: string; priceListId: string | null; coachIds: string[]; programPublic: boolean };
type Read = { ok: true; value: GroupInput } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const idList = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x !== ''))] : []);

export function readGroupInput(body: unknown): Read {
  const b = isRecord(body) ? body : {};
  const name = typeof b.name === 'string' ? normalizeGroupName(b.name) : '';
  if (!name) return { ok: false, error: GROUP_ERRORS.nameRequired };
  const priceListId = typeof b.priceListId === 'string' && b.priceListId ? b.priceListId : null;
  return { ok: true, value: { name, priceListId, coachIds: idList(b.coachIds), programPublic: b.programPublic !== false } };
}

const nameTaken = (groups: GroupRecord[], sectionId: string, name: string, exceptId: string | null): boolean =>
  groups.some((g) => g.sectionId === sectionId && g.id !== exceptId && nameKey(g.name) === nameKey(name));

type Refs = { priceLists: PriceListRow[]; team: NamedRow[]; groups: GroupRecord[] };
const loadRefs = async (store: GroupStore): Promise<Refs> => {
  const [priceLists, team, groups] = await Promise.all([store.priceLists(), store.teamMembers(), store.groups()]);
  return { priceLists, team, groups };
};

function inputRefusal(refs: Refs, sectionId: string, input: GroupInput, exceptId: string | null): AdminResult<never> | null {
  const list = input.priceListId ? refs.priceLists.find((p) => p.id === input.priceListId) : null;
  if (input.priceListId && list?.sectionId !== sectionId) return refuse(400, GROUP_ERRORS.invalid);
  if (input.coachIds.some((id) => !refs.team.some((t) => t.id === id))) return refuse(400, GROUP_ERRORS.invalid);
  return nameTaken(refs.groups, sectionId, input.name, exceptId) ? refuse(409, GROUP_ERRORS.nameTaken) : null;
}

async function createInTransaction(ctx: GroupContext, sectionSlug: unknown, input: GroupInput): Promise<AdminResult<NamedRef>> {
  const section = (await ctx.store.sections()).find((s) => s.slug === sectionSlug);
  if (!section) return refuse(400, GROUP_ERRORS.invalid);
  const refs = await loadRefs(ctx.store);
  const refusal = inputRefusal(refs, section.id, input, null);
  if (refusal) return refusal;
  const order = Math.max(0, ...refs.groups.filter((g) => g.sectionId === section.id).map((g) => g.order ?? 0)) + 1;
  const id = await ctx.store.createGroup({ ...input, sectionId: section.id, order });
  await recordLines(ctx.store, ctx.actor, [{ subjectType: GROUP_SUBJECT, subjectId: id, action: P4_ACTIONS.groupCreated }]);
  return { ok: true, data: { documentId: id, name: input.name } };
}

/** "Creează grupa": the open tab's section, last in its order; the page then opens on "Program" (5.4). */
export async function createGroup(ctx: GroupContext, body: unknown): Promise<AdminResult<NamedRef>> {
  const read = readGroupInput(body);
  if (read.ok === false) return refuse(400, read.error);
  const section = isRecord(body) ? body.section : null;
  return guarded(ctx.log, '[groups] creating a group', () => ctx.store.transaction(() => createInTransaction(ctx, section, read.value)));
}

const listName = (refs: Refs, id: string | null): string => refs.priceLists.find((p) => p.id === id)?.name ?? '';
const coachNames = (refs: Refs, ids: string[]): string => refs.team.filter((t) => ids.includes(t.id)).map((t) => t.name).join(', ');

function groupChanges(g: GroupRecord, input: GroupInput, refs: Refs): Record<string, FieldChange> {
  const pairs: [string, unknown, unknown][] = [
    ['name', g.name, input.name], ['priceList', listName(refs, g.priceListId), listName(refs, input.priceListId)],
    ['coaches', coachNames(refs, g.coachIds), coachNames(refs, input.coachIds)], ['programPublic', g.programPublic, input.programPublic],
  ];
  return Object.fromEntries(pairs.filter(([, from, to]) => from !== to).map(([key, from, to]) => [key, { from, to }]));
}

async function updateInTransaction(ctx: GroupContext, id: string, input: GroupInput): Promise<AdminResult<{ changed: boolean; publicChange: boolean }>> {
  await ctx.store.lockGroup(id);
  const group = await ctx.store.group(id);
  if (!group || !group.sectionId) return refuse(404, GROUP_ERRORS.notFound);
  const refs = await loadRefs(ctx.store);
  const refusal = inputRefusal(refs, group.sectionId, input, id);
  if (refusal) return refusal;
  const fields = groupChanges(group, input, refs);
  if (!Object.keys(fields).length) return { ok: true, data: { changed: false, publicChange: false } };
  await ctx.store.updateGroup(id, input);
  await recordLines(ctx.store, ctx.actor, [{ subjectType: GROUP_SUBJECT, subjectId: id, action: P4_ACTIONS.groupUpdated, changes: { fields } }]);
  return { ok: true, data: { changed: true, publicChange: 'name' in fields || 'programPublic' in fields } };
}

/** "Salvează" of "Editează grupa": "Salvat." or "Nicio modificare." (5.4); a name or "Program public" change pings the website. */
export async function updateGroup(ctx: GroupContext, id: string, body: unknown): Promise<AdminResult<{ changed: boolean }>> {
  const read = readGroupInput(body);
  if (read.ok === false) return refuse(400, read.error);
  const res = await guarded(ctx.log, `[groups] editing ${id}`, () => ctx.store.transaction(() => updateInTransaction(ctx, id, read.value)));
  if (res.ok === false) return res;
  if (res.data.publicChange) ctx.revalidate();
  return { ok: true, data: { changed: res.data.changed } };
}

async function deleteInTransaction(ctx: GroupContext, id: string): Promise<AdminResult<{ name: string }>> {
  await ctx.store.lockGroup(id);
  const group = await ctx.store.group(id);
  if (!group) return refuse(404, GROUP_ERRORS.notFound);
  const [memberships, events] = await Promise.all([ctx.store.memberships({ groupId: id }), ctx.store.events({ groupId: id })]);
  if (memberships.length || events.length) return refuse(409, GROUP_ERRORS.stale);
  await ctx.store.deleteGroup(id);
  await recordLines(ctx.store, ctx.actor, [{ subjectType: GROUP_SUBJECT, subjectId: id, action: P4_ACTIONS.groupDeleted, changes: { name: group.name } }]);
  return { ok: true, data: { name: group.name } };
}

/** "Șterge grupa": only a group that never had a membership or an event (W11). */
export const deleteGroup = (ctx: GroupContext, id: string): Promise<AdminResult<{ name: string }>> =>
  guarded(ctx.log, `[groups] deleting ${id}`, () => ctx.store.transaction(() => deleteInTransaction(ctx, id)));
```

- [ ] **Step 5: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/group-admin.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 6: Commit**

```bash
git add src/club/groups/group-admin.ts src/club/groups/action-log.ts src/club/groups/__tests__/group-admin.test.ts
git commit -m "feat(groups): create, edit and delete a group, names unique per section"
```

---

### Task 9: Membership actions ("Alocă", "Alocă toți", "Adaugă sportivi", "Adaugă și în grupă", "Mută", "Scoate din grupă")

**Files:**
- Create: `src/club/groups/members.ts`
- Test: `src/club/groups/__tests__/members.test.ts`

**Interfaces:**
- Consumes: `planJoin`, `planMove`, `planRemove`, `currentRows`, `MembershipPlan` (Task 3), `checkMainGroup` (Task 3), `membershipUndo`, `UndoStep` (Task 5), `recordAction`, `done`, `Line`, `ActionResult` (Task 8), `pickSeason`, `isPastSeason`, `startDateFor` (Task 7), `HISTORY_ACTIONS.groupAdded`, `.mainGroupChanged`, `.reactivated` (P3).
- Produces (body shapes are the route bodies of spec 8.2):
  - `readJoinBody(body): JoinBody | null` (`{ season, athleteIds (1 to 200), mode: 'allocate' | 'add' }`), `readAllocateBody(body): AllocateBody | null` (`{ season, items: { athleteId, groupId }[] }`).
  - `joinGroup(ctx, groupId, body): Promise<ActionResult<JoinResult>>`, `allocateAll(ctx, body): Promise<ActionResult<AllocateResult>>`, `moveMembership(ctx, membershipId, body: { toGroupId }): Promise<ActionResult<MoveResult>>`, `removeMembership(ctx, membershipId): Promise<ActionResult<MoveResult>>`.
  - `mode: 'allocate'` writes only for an athlete with no group in the season (a stale "Fără grupă" row is skipped); `mode: 'add'` reactivates an "Inactiv" athlete ("Reactivat", decided 6).

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/members.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { allocateAll, joinGroup, moveMembership, removeMembership } from '../members';
import { athleteRow, fakeContext, member } from './fake-group-store';

const ATHLETES = [
  athleteRow({ id: 'a1', name: 'Ana Ionescu' }), athleteRow({ id: 'a2', name: 'Daria Stan' }), athleteRow({ id: 'a3', name: 'Elisa Georgescu', status: 'nou' }),
  athleteRow({ id: 'a4', name: 'Tudor Matei', status: 'inactiv' }), athleteRow({ id: 'a5', name: 'Sportiv anonimizat', status: 'anonimizat' }),
];
const seed = (memberships = [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' })]) => fakeContext({ athletes: ATHLETES, memberships });
const current = (state: { memberships: { athleteId: string; to?: string | null }[] }, athleteId: string) => state.memberships.filter((m) => m.athleteId === athleteId && !m.to);

describe('"Alocă" (5.3)', () => {
  it('places the athlete as main from today, writes group and athlete lines and answers an undo', async () => {
    const { ctx, state } = seed();
    const res = await joinGroup(ctx, 'g-ib', { season: '2026-2027', athleteIds: ['a3'], mode: 'allocate' });
    expect(res).toEqual({ ok: true, data: { value: { added: 1, athleteNames: ['Elisa Georgescu'], groupName: 'Intermediari Bronze' }, actionId: 'h1' } });
    expect(current(state, 'a3')).toMatchObject([{ groupId: 'g-ib', isMain: true, from: '2026-11-20' }]);
    expect(state.history.map((h) => [h.subjectType, h.action])).toEqual([['group', 'member-allocated'], ['athlete', 'group-added']]);
    expect(state.history[0].changes.undo).toMatchObject({ kind: 'group', steps: [{ op: 'deleteMembership', athleteId: 'a3' }] });
    expect(state.history[1].changes.actionId).toBe('h1');
    expect(state.athletes.find((a) => a.id === 'a3')?.status).toBe('nou');
  });

  it('starts on the season start when the season has not begun (gaps #29)', async () => {
    const { ctx, state } = seed();
    await joinGroup(ctx, 'g-ib', { season: '2027-2028', athleteIds: ['a3'], mode: 'allocate' });
    expect(state.memberships.find((m) => m.athleteId === 'a3')?.from).toBe('2027-10-01');
  });

  it('skips an athlete who got a group meanwhile: nothing written, no undo', async () => {
    const { ctx, state } = seed();
    const res = await joinGroup(ctx, 'g-pp', { season: '2026-2027', athleteIds: ['a1'], mode: 'allocate' });
    expect(res).toEqual({ ok: true, data: { value: { added: 0, athleteNames: [], groupName: 'Primii Pași' }, actionId: null } });
    expect(state.history).toEqual([]);
  });

  it('refuses a past season, an inactive group and an anonymized athlete', async () => {
    const { ctx, state } = seed();
    expect(await joinGroup(ctx, 'g-ib', { season: '2025-2026', athleteIds: ['a3'], mode: 'allocate' })).toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
    state.groups[0].active = false;
    expect((await joinGroup(ctx, 'g-pp', { season: '2026-2027', athleteIds: ['a3'], mode: 'allocate' })).ok).toBe(false);
    expect((await joinGroup(ctx, 'g-ib', { season: '2026-2027', athleteIds: ['a5'], mode: 'add' })).ok).toBe(false);
  });

  it('locks athletes sorted by id, then the group', async () => {
    const { ctx, state } = seed();
    await joinGroup(ctx, 'g-ib', { season: '2026-2027', athleteIds: ['a3', 'a2'], mode: 'add' });
    expect(state.locks).toEqual(['athlete:a2', 'athlete:a3', 'group:g-ib']);
  });
});

describe('"Adaugă sportivi" and "Adaugă și în grupă" (6.2, W3)', () => {
  it('a second group is not main; an inactive athlete is reactivated', async () => {
    const { ctx, state } = seed();
    await joinGroup(ctx, 'g-pro', { season: '2026-2027', athleteIds: ['a1', 'a4'], mode: 'add' });
    expect(current(state, 'a1').map((m) => [m.groupId, (m as { isMain: boolean }).isMain])).toEqual([['g-ib', true], ['g-pro', false]]);
    expect(state.athletes.find((a) => a.id === 'a4')?.status).toBe('activ');
    expect(state.history.filter((h) => h.subjectId === 'a4').map((h) => h.action)).toEqual(['group-added', 'reactivated']);
  });

  it('two joins of the same child one after the other never make two mains (Review Focus)', async () => {
    const { ctx, state } = seed();
    await joinGroup(ctx, 'g-pp', { season: '2026-2027', athleteIds: ['a3'], mode: 'add' });
    await joinGroup(ctx, 'g-pro', { season: '2026-2027', athleteIds: ['a3'], mode: 'add' });
    expect(current(state, 'a3').filter((m) => (m as { isMain: boolean }).isMain)).toHaveLength(1);
  });
});

describe('"Alocă toți în grupele propuse"', () => {
  it('allocates every item in one action', async () => {
    const { ctx, state } = seed();
    const res = await allocateAll(ctx, { season: '2026-2027', items: [{ athleteId: 'a3', groupId: 'g-pp' }, { athleteId: 'a2', groupId: 'g-av' }] });
    expect(res).toEqual({ ok: true, data: { value: { allocated: 2 }, actionId: 'h1' } });
    expect(state.history[0].changes.undo).toMatchObject({ steps: [{ op: 'deleteMembership', athleteId: 'a2' }, { op: 'deleteMembership', athleteId: 'a3' }] });
  });
});

describe('"Mută" (W2)', () => {
  it('ends the row yesterday, the new group becomes main, four lines', async () => {
    const { ctx, state } = seed();
    const res = await moveMembership(ctx, 'm1', { toGroupId: 'g-is' });
    expect(res).toEqual({ ok: true, data: { value: { athleteName: 'Ana Ionescu', groupName: 'Intermediari Silver' }, actionId: 'h1' } });
    expect(state.memberships.find((m) => m.id === 'm1')?.to).toBe('2026-11-19');
    expect(current(state, 'a1')).toMatchObject([{ groupId: 'g-is', isMain: true }]);
    expect(state.history.map((h) => [h.subjectId, h.action])).toEqual([
      ['g-ib', 'member-moved-out'], ['g-is', 'member-moved-in'], ['a1', 'athlete-group-moved'], ['a1', 'main-group-changed'],
    ]);
    expect(state.history[0].changes).toMatchObject({ athleteId: 'a1', toGroup: 'Intermediari Silver', main: { from: 'Intermediari Bronze', to: 'Intermediari Silver' } });
  });

  it('refuses without a target ("Alege grupa.") and for an ended row', async () => {
    const { ctx } = seed([member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib', to: '2026-10-31' })]);
    expect(await moveMembership(ctx, 'm1', {})).toEqual({ ok: false, status: 400, error: 'Alege grupa.' });
    expect((await moveMembership(ctx, 'm1', { toGroupId: 'g-is' })).ok).toBe(false);
  });
});

describe('"Scoate din grupă" (W4)', () => {
  it('promotes the remaining group and says so on the athlete', async () => {
    const { ctx, state } = seed([member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a1', groupId: 'g-pro', isMain: false, from: '2026-10-15' })]);
    await removeMembership(ctx, 'm1');
    expect(current(state, 'a1')).toMatchObject([{ id: 'm2', isMain: true }]);
    expect(state.history.map((h) => h.action)).toEqual(['member-removed', 'athlete-group-removed', 'main-group-changed']);
    expect(state.history[2].changes).toEqual({ from: 'Intermediari Bronze', to: 'Profesioniști', actionId: 'h1' });
  });

  it('deletes a row placed today, keeping the undo able to re-create it', async () => {
    const { ctx, state } = seed([member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib', from: '2026-11-20' })]);
    await removeMembership(ctx, 'm1');
    expect(state.memberships).toEqual([]);
    expect(state.history[0].changes.undo).toMatchObject({ steps: [{ op: 'createMembership', row: { groupId: 'g-ib', from: '2026-11-20', isMain: true } }] });
  });

  it('writes nothing when a write fails half way (all or nothing)', async () => {
    const { ctx, state, failOn } = seed([member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a1', groupId: 'g-pro', isMain: false })]);
    failOn('record');
    expect(await removeMembership(ctx, 'm1')).toEqual({ ok: false, status: 500, error: 'Acțiunea nu a reușit. Nimic nu a fost salvat.' });
    expect(current(state, 'a1').map((m) => m.athleteId)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/members.test.ts`
Expected: FAIL (`Cannot find module '../members'`).

- [ ] **Step 3: Write `members.ts`**

```ts
import { guarded, refuse, type AdminResult } from '../admin-result';
import type { AthleteRow, MembershipRow } from '../athletes/store';
import { checkMainGroup, isCurrentMembership } from '../group-membership';
import { HISTORY_ACTIONS } from '../history-text';
import { isAnonymized } from '../personal-data/anonymize-plan';
import { done, recordAction, type ActionResult, type Line } from './action-log';
import type { AllocateResult, JoinResult, MoveResult } from './api-types';
import type { GroupContext } from './context';
import { GROUP_ERRORS } from './copy';
import { ATHLETE_SUBJECT, GROUP_SUBJECT, P4_ACTIONS } from './history-lines';
import { currentRows, planJoin, planMove, planRemove, type MembershipPlan, type MembershipWrite } from './membership-plan';
import { isPastSeason, startDateFor } from './season-pick';
import type { GroupRecord, GroupStore, SeasonRecord } from './types';
import { membershipUndo, type UndoStep } from './undo';

/** The group roster actions (spec 5.3, 6.2, 8.1): one transaction each, athletes locked by id then the groups. */
export type JoinMode = 'allocate' | 'add';
export type JoinBody = { season: string; athleteIds: string[]; mode: JoinMode };
export type AllocateBody = { season: string; items: { athleteId: string; groupId: string }[] };
type Outcome = { joined: boolean; lines: Line[]; steps: UndoStep[]; name: string };
const MAX_ITEMS = 200;

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const ids = (v: unknown): string[] | null => (Array.isArray(v) && v.length > 0 && v.length <= MAX_ITEMS && v.every((x) => typeof x === 'string' && x) ? [...new Set(v as string[])] : null);

export function readJoinBody(body: unknown): JoinBody | null {
  if (!isRecord(body) || typeof body.season !== 'string') return null;
  const athleteIds = ids(body.athleteIds);
  const mode = body.mode === 'allocate' || body.mode === 'add' ? body.mode : null;
  return athleteIds && mode ? { season: body.season, athleteIds, mode } : null;
}

export function readAllocateBody(body: unknown): AllocateBody | null {
  if (!isRecord(body) || typeof body.season !== 'string' || !Array.isArray(body.items) || !body.items.length || body.items.length > MAX_ITEMS) return null;
  const items = body.items.filter(isRecord).filter((i) => typeof i.athleteId === 'string' && typeof i.groupId === 'string').map((i) => ({ athleteId: String(i.athleteId), groupId: String(i.groupId) }));
  return items.length === body.items.length ? { season: body.season, items } : null;
}

/** A season that exists and is not past (W5, decided 7). */
async function writableSeason(store: GroupStore, match: (s: SeasonRecord) => boolean): Promise<AdminResult<SeasonRecord>> {
  const seasons = await store.seasons();
  const season = seasons.find(match);
  if (!season) return refuse(400, GROUP_ERRORS.invalid);
  return isPastSeason(season, seasons) ? refuse(409, GROUP_ERRORS.stale) : { ok: true, data: season };
}

async function lockAll(store: GroupStore, athleteIds: string[], groupIds: string[]): Promise<void> {
  for (const id of [...new Set(athleteIds)].sort()) await store.lockAthlete(id);
  for (const id of [...new Set(groupIds)].sort()) await store.lockGroup(id);
}

async function applyWrite(store: GroupStore, w: MembershipWrite, rows: MembershipRow[]): Promise<UndoStep> {
  if (w.op === 'create') return membershipUndo(w, null, await store.createMembership({ athleteId: w.athleteId, groupId: w.groupId, seasonId: w.seasonId, isMain: w.isMain, from: w.from }));
  const before = rows.find((r) => r.id === w.id) ?? null;
  if (w.op === 'end') await store.updateMembership(w.id, { to: w.to });
  else if (w.op === 'delete') await store.deleteMembership(w.id);
  else await store.updateMembership(w.id, { isMain: w.isMain });
  return membershipUndo(w, before, null);
}

/** Applies the writes in order; then the one-main rule must hold on current rows, or the whole action rolls back (8.1). */
async function applyPlan(store: GroupStore, plan: MembershipPlan, rows: MembershipRow[], athleteId: string, seasonId: string): Promise<UndoStep[]> {
  const steps: UndoStep[] = [];
  for (const w of plan.writes) steps.push(await applyWrite(store, w, rows));
  if (checkMainGroup(await store.memberships({ athleteId, seasonId }), seasonId).ok === false) throw new Error(`main group rule broken for ${athleteId}`);
  return steps;
}

const currentOf = async (store: GroupStore, athleteId: string, seasonId: string): Promise<MembershipRow[]> =>
  currentRows(await store.memberships({ athleteId, seasonId }), athleteId, seasonId);

function joinLines(a: AthleteRow, g: GroupRecord, mode: JoinMode, reactivated: boolean): Line[] {
  const lines: Line[] = [
    { subjectType: GROUP_SUBJECT, subjectId: g.id, action: mode === 'allocate' ? P4_ACTIONS.memberAllocated : P4_ACTIONS.memberAdded, changes: { athleteId: a.id } },
    { subjectType: ATHLETE_SUBJECT, subjectId: a.id, action: HISTORY_ACTIONS.groupAdded, changes: { groupName: g.name } },
  ];
  return reactivated ? [...lines, { subjectType: ATHLETE_SUBJECT, subjectId: a.id, action: HISTORY_ACTIONS.reactivated }] : lines;
}

async function joinOne(ctx: GroupContext, a: AthleteRow, g: GroupRecord, season: SeasonRecord, mode: JoinMode): Promise<Outcome> {
  const rows = await currentOf(ctx.store, a.id, season.id);
  const skip = { joined: false, lines: [], steps: [], name: a.name ?? '' };
  if (mode === 'allocate' && rows.length) return skip;
  const plan = planJoin(rows, g.id, { athleteId: a.id, seasonId: season.id, from: startDateFor(season, ctx.today) });
  if (!plan.writes.length) return skip;
  const reactivated = mode === 'add' && a.status === 'inactiv';
  const steps = await applyPlan(ctx.store, plan, rows, a.id, season.id);
  if (reactivated) {
    await ctx.store.setAthleteStatus(a.id, 'activ');
    steps.push({ op: 'setStatus', athleteId: a.id, status: 'inactiv' });
  }
  return { joined: true, lines: joinLines(a, g, mode, reactivated), steps, name: a.name ?? '' };
}

async function loadPeople(store: GroupStore, athleteIds: string[]): Promise<AthleteRow[] | null> {
  const people = await Promise.all(athleteIds.map((id) => store.athlete(id)));
  return people.every((a): a is AthleteRow => a !== null && !isAnonymized(a)) ? people : null;
}

async function activeGroup(store: GroupStore, id: string): Promise<GroupRecord | null> {
  const g = await store.group(id);
  return g && g.active ? g : null;
}

async function finish(ctx: GroupContext, outcomes: Outcome[]): Promise<string | null> {
  const joined = outcomes.filter((o) => o.joined);
  if (!joined.length) return null;
  return recordAction(ctx.store, ctx.actor, joined.flatMap((o) => o.lines), { kind: 'group', steps: joined.flatMap((o) => o.steps), revalidate: false });
}

async function joinLocked(ctx: GroupContext, groupId: string, req: JoinBody): Promise<ActionResult<JoinResult>> {
  const season = await writableSeason(ctx.store, (s) => s.label === req.season);
  if (season.ok === false) return season;
  await lockAll(ctx.store, req.athleteIds, [groupId]);
  const group = await activeGroup(ctx.store, groupId);
  const people = await loadPeople(ctx.store, req.athleteIds);
  if (!group) return refuse(409, GROUP_ERRORS.stale);
  if (!people) return refuse(400, GROUP_ERRORS.invalid);
  const outcomes: Outcome[] = [];
  for (const a of people) outcomes.push(await joinOne(ctx, a, group, season.data, req.mode));
  const joined = outcomes.filter((o) => o.joined);
  return done({ added: joined.length, athleteNames: joined.map((o) => o.name), groupName: group.name }, await finish(ctx, outcomes));
}

/** POST /club/groups/:id/members: "Alocă" (one, allocate), "Adaugă sportivi" (several, add), "Adaugă și în grupă" (one, add). */
export async function joinGroup(ctx: GroupContext, groupId: string, body: unknown): Promise<ActionResult<JoinResult>> {
  const req = readJoinBody(body);
  if (!req) return refuse(400, GROUP_ERRORS.invalid);
  return guarded(ctx.log, `[groups] adding to ${groupId}`, () => ctx.store.transaction(() => joinLocked(ctx, groupId, req)));
}

async function allocateLocked(ctx: GroupContext, req: AllocateBody): Promise<ActionResult<AllocateResult>> {
  const season = await writableSeason(ctx.store, (s) => s.label === req.season);
  if (season.ok === false) return season;
  const items = [...req.items].sort((a, b) => a.athleteId.localeCompare(b.athleteId));
  await lockAll(ctx.store, items.map((i) => i.athleteId), items.map((i) => i.groupId));
  const people = await loadPeople(ctx.store, items.map((i) => i.athleteId));
  const groups = await Promise.all(items.map((i) => activeGroup(ctx.store, i.groupId)));
  if (!people || groups.some((g) => g === null)) return refuse(409, GROUP_ERRORS.stale);
  const outcomes: Outcome[] = [];
  for (let i = 0; i < items.length; i += 1) outcomes.push(await joinOne(ctx, people[i], groups[i] as GroupRecord, season.data, 'allocate'));
  return done({ allocated: outcomes.filter((o) => o.joined).length }, await finish(ctx, outcomes));
}

/** POST /club/memberships/allocate: "Alocă toți în grupele propuse" (rows without a group are not sent, W6). */
export async function allocateAll(ctx: GroupContext, body: unknown): Promise<ActionResult<AllocateResult>> {
  const req = readAllocateBody(body);
  if (!req) return refuse(400, GROUP_ERRORS.invalid);
  return guarded(ctx.log, '[groups] allocating all', () => ctx.store.transaction(() => allocateLocked(ctx, req)));
}

type Located = { row: MembershipRow; season: SeasonRecord; athlete: AthleteRow; from: GroupRecord };

/** The current row, its season (not past), athlete and group, read again under the locks. */
async function locate(ctx: GroupContext, membershipId: string, extraGroupId: string | null): Promise<AdminResult<Located>> {
  const first = await ctx.store.membership(membershipId);
  if (!first || !isCurrentMembership(first)) return refuse(409, GROUP_ERRORS.stale);
  const season = await writableSeason(ctx.store, (s) => s.id === first.seasonId);
  if (season.ok === false) return season;
  await lockAll(ctx.store, [first.athleteId], extraGroupId ? [first.groupId, extraGroupId] : [first.groupId]);
  const [row, athlete, from] = await Promise.all([ctx.store.membership(membershipId), ctx.store.athlete(first.athleteId), ctx.store.group(first.groupId)]);
  if (!row || !isCurrentMembership(row) || !athlete || !from) return refuse(409, GROUP_ERRORS.stale);
  return { ok: true, data: { row, season: season.data, athlete, from } };
}

const groupNameOf = async (store: GroupStore, id: string): Promise<string> => (await store.group(id))?.name ?? '';

function moveLines(l: Located, to: GroupRecord, main: { from: string; to: string } | null): Line[] {
  const a = l.athlete.id;
  const lines: Line[] = [
    { subjectType: GROUP_SUBJECT, subjectId: l.from.id, action: P4_ACTIONS.memberMovedOut, changes: { athleteId: a, toGroup: to.name, main } },
    { subjectType: GROUP_SUBJECT, subjectId: to.id, action: P4_ACTIONS.memberMovedIn, changes: { athleteId: a, fromGroup: l.from.name } },
    { subjectType: ATHLETE_SUBJECT, subjectId: a, action: P4_ACTIONS.athleteMoved, changes: { from: l.from.name, to: to.name } },
  ];
  return main ? [...lines, { subjectType: ATHLETE_SUBJECT, subjectId: a, action: HISTORY_ACTIONS.mainGroupChanged, changes: main }] : lines;
}

async function moveLocked(ctx: GroupContext, membershipId: string, toGroupId: string): Promise<ActionResult<MoveResult>> {
  const found = await locate(ctx, membershipId, toGroupId);
  if (found.ok === false) return found;
  const l = found.data;
  const to = await activeGroup(ctx.store, toGroupId);
  if (!to || to.id === l.row.groupId) return refuse(400, GROUP_ERRORS.pickGroup);
  const rows = await currentOf(ctx.store, l.athlete.id, l.season.id);
  const plan = planMove(rows, l.row, to.id, { athleteId: l.athlete.id, seasonId: l.season.id, from: startDateFor(l.season, ctx.today) }, ctx.today);
  const steps = await applyPlan(ctx.store, plan, rows, l.athlete.id, l.season.id);
  const main = plan.main ? { from: l.from.name, to: to.name } : null;
  const actionId = await recordAction(ctx.store, ctx.actor, moveLines(l, to, main), { kind: 'group', steps, revalidate: false });
  return done({ athleteName: l.athlete.name ?? '', groupName: to.name }, actionId);
}

/** POST /club/memberships/:id/move body `{ toGroupId }`: the one move window (6.2, W2). */
export async function moveMembership(ctx: GroupContext, membershipId: string, body: unknown): Promise<ActionResult<MoveResult>> {
  const toGroupId = isRecord(body) && typeof body.toGroupId === 'string' && body.toGroupId ? body.toGroupId : null;
  if (!toGroupId) return refuse(400, GROUP_ERRORS.pickGroup);
  return guarded(ctx.log, `[groups] moving ${membershipId}`, () => ctx.store.transaction(() => moveLocked(ctx, membershipId, toGroupId)));
}

async function removeLocked(ctx: GroupContext, membershipId: string): Promise<ActionResult<MoveResult>> {
  const found = await locate(ctx, membershipId, null);
  if (found.ok === false) return found;
  const l = found.data;
  const rows = await currentOf(ctx.store, l.athlete.id, l.season.id);
  const plan = planRemove(rows, l.row, ctx.today);
  const steps = await applyPlan(ctx.store, plan, rows, l.athlete.id, l.season.id);
  const lines: Line[] = [
    { subjectType: GROUP_SUBJECT, subjectId: l.from.id, action: P4_ACTIONS.memberRemoved, changes: { athleteId: l.athlete.id } },
    { subjectType: ATHLETE_SUBJECT, subjectId: l.athlete.id, action: P4_ACTIONS.athleteRemoved, changes: { groupName: l.from.name } },
  ];
  if (plan.main) lines.push({ subjectType: ATHLETE_SUBJECT, subjectId: l.athlete.id, action: HISTORY_ACTIONS.mainGroupChanged, changes: { from: l.from.name, to: await groupNameOf(ctx.store, plan.main.toGroupId) } });
  const actionId = await recordAction(ctx.store, ctx.actor, lines, { kind: 'group', steps, revalidate: false });
  return done({ athleteName: l.athlete.name ?? '', groupName: l.from.name }, actionId);
}

/** DELETE /club/memberships/:id: "Scoate din grupă", no window (6.2, W4). */
export const removeMembership = (ctx: GroupContext, membershipId: string): Promise<ActionResult<MoveResult>> =>
  guarded(ctx.log, `[groups] removing ${membershipId}`, () => ctx.store.transaction(() => removeLocked(ctx, membershipId)));
```

- [ ] **Step 4: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/members.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/groups/members.ts src/club/groups/__tests__/members.test.ts
git commit -m "feat(groups): allocate, add, move and remove members, one main group per season, undo records"
```

---

### Task 10: The undo route service

**Files:**
- Create: `src/club/groups/undo-service.ts`
- Test: `src/club/groups/__tests__/undo-service.test.ts`

**Interfaces:**
- Consumes: `readUndoRecord`, `undoRefusal`, `undoLockTargets`, `UndoStep`, `UndoRecord` (Task 5), `P4_ACTIONS` (Task 4), the Task 9 actions (in tests).
- Produces: `readActionId(body): string | null`, `undoAction(ctx, body): Promise<AdminResult<{ undone: true }>>` for every phase 4 action (a `group` record is refused after a later line on its own subjects; a `season` record after any later group, athlete or season line, plus its `registrationsAfter` guard) (membership actions here; program, date, new-season and per-group copy records from plans 4-2 and 4-3 use the same steps). After a successful undo whose record has `revalidate: true`, `ctx.revalidate()` is called once.

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/undo-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { joinGroup, moveMembership, removeMembership } from '../members';
import { undoAction } from '../undo-service';
import { athleteRow, fakeContext, member } from './fake-group-store';

const seed = () => fakeContext({
  athletes: [athleteRow({ id: 'a1', name: 'Ana Ionescu' }), athleteRow({ id: 'a2', name: 'Daria Stan' }), athleteRow({ id: 'a3', name: 'Tudor Matei', status: 'inactiv' })],
  memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a2', groupId: 'g-ib' })],
});
const actionOf = (res: { ok: boolean; data?: { actionId: string | null } }): string => (res.ok && res.data?.actionId) || '';

describe('"Anulează" from the toast (8.1, W15)', () => {
  it('takes back a move exactly and writes "Anulat" on every subject', async () => {
    const { ctx, state } = seed();
    const before = structuredClone(state.memberships);
    const actionId = actionOf(await moveMembership(ctx, 'm1', { toGroupId: 'g-is' }));
    expect(await undoAction(ctx, { actionId })).toEqual({ ok: true, data: { undone: true } });
    expect(state.memberships).toEqual(before);
    const undone = state.history.filter((h) => h.action === 'undone');
    expect(undone.map((h) => h.subjectId)).toEqual(['g-ib', 'g-is', 'a1', 'a1']);
    expect(undone[0].changes).toEqual({ undoneAction: 'member-moved-out', undoneChanges: { athleteId: 'a1', toGroup: 'Intermediari Silver', main: { from: 'Intermediari Bronze', to: 'Intermediari Silver' } } });
  });

  it('re-creates a deleted row and turns a reactivated athlete inactive again', async () => {
    const { ctx, state } = seed();
    const added = actionOf(await joinGroup(ctx, 'g-pro', { season: '2026-2027', athleteIds: ['a3'], mode: 'add' }));
    await undoAction(ctx, { actionId: added });
    expect(state.athletes.find((a) => a.id === 'a3')?.status).toBe('inactiv');
    expect(state.memberships.filter((m) => m.athleteId === 'a3')).toEqual([]);
  });

  it('refuses a second undo, and an undo after another change on the group', async () => {
    const { ctx } = seed();
    const first = actionOf(await removeMembership(ctx, 'm1'));
    await removeMembership(ctx, 'm2');
    expect(await undoAction(ctx, { actionId: first })).toEqual({ ok: false, status: 409, error: 'Nu se mai poate anula. Grupa s-a schimbat între timp.' });
    const fresh = seed();
    const again = actionOf(await removeMembership(fresh.ctx, 'm1'));
    expect((await undoAction(fresh.ctx, { actionId: again })).ok).toBe(true);
    expect(await undoAction(fresh.ctx, { actionId: again })).toEqual({ ok: false, status: 409, error: 'Nu se mai poate anula. Grupa s-a schimbat între timp.' });
  });

  it('answers 404 for an unknown action, 400 without one; the season text for a season action', async () => {
    const { ctx, state } = seed();
    expect(await undoAction(ctx, { actionId: 'nope' })).toEqual({ ok: false, status: 404, error: 'Nu a fost găsit.' });
    expect((await undoAction(ctx, {})).ok).toBe(false);
    await ctx.store.recordAction({ subjectType: 'season', subjectId: 's27', action: 'current-changed', changes: { from: false, to: true, undo: { kind: 'season', steps: [], subjects: [{ type: 'season', id: 's27' }], revalidate: true, registrationsAfter: { seasonId: 's27', at: '2026-11-20T10:00:00.000Z' } } }, actor: 'x' });
    state.filedAfter = 1;
    expect(await undoAction(ctx, { actionId: 'h1' })).toEqual({ ok: false, status: 409, error: 'Nu se mai poate anula. Sezonul s-a schimbat între timp.' });
  });

  it('locks the rows before checking, in the binding order', async () => {
    const { ctx, state } = seed();
    const actionId = actionOf(await moveMembership(ctx, 'm1', { toGroupId: 'g-is' }));
    state.locks = [];
    await undoAction(ctx, { actionId });
    expect(state.locks).toEqual(['athlete:a1']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/undo-service.test.ts`
Expected: FAIL (`Cannot find module '../undo-service'`).

- [ ] **Step 3: Write `undo-service.ts`**

```ts
import { guarded, refuse, type AdminResult } from '../admin-result';
import type { GroupContext } from './context';
import { GROUP_ERRORS } from './copy';
import { P4_ACTIONS } from './history-lines';
import type { GroupStore, HistoryEntryRow } from './types';
import { readUndoRecord, undoLockTargets, undoRefusal, type LockTargets, type UndoKind, type UndoRecord, type UndoStep } from './undo';

/** POST /club/undo body `{ actionId }`: the toast's "Anulează" for every phase 4 action (spec 8.1, 8.2, W15). */
type Run<K extends UndoStep['op']> = (store: GroupStore, step: Extract<UndoStep, { op: K }>, actionId: string) => Promise<void>;
type Runners = { [K in UndoStep['op']]: Run<K> };

const RUN: Runners = {
  deleteMembership: (s, st) => s.deleteMembership(st.id),
  setMembership: (s, st) => s.updateMembership(st.id, { isMain: st.isMain, to: st.to }),
  createMembership: async (s, st) => {
    await s.createMembership(st.row);
  },
  setStatus: (s, st) => s.setAthleteStatus(st.athleteId, st.status),
  deleteEvent: (s, st) => s.deleteEvent(st.id),
  setEvent: (s, st) => s.updateEvent(st.id, { recurrence: st.recurrence, exceptions: st.exceptions }),
  createEvent: async (s, st) => {
    await s.createEvent(st.event);
  },
  cancelEmails: async (s, _st, actionId) => {
    await s.cancelEmailJobs(actionId);
  },
  setCurrentSeason: async (s, st) => {
    await s.setSeasonCurrent(st.otherId, false);
    await s.setSeasonCurrent(st.id, true);
  },
};

const runStep = (store: GroupStore, step: UndoStep, actionId: string): Promise<void> =>
  (RUN[step.op] as (s: GroupStore, st: UndoStep, id: string) => Promise<void>)(store, step, actionId);

export function readActionId(body: unknown): string | null {
  const v = body && typeof body === 'object' ? (body as Record<string, unknown>).actionId : null;
  return typeof v === 'string' && v ? v : null;
}

async function lockTargets(store: GroupStore, t: LockTargets): Promise<void> {
  for (const id of t.seasons) await store.lockSeason(id);
  for (const id of t.athletes) await store.lockAthlete(id);
  for (const id of t.groups) await store.lockGroup(id);
  for (const id of t.events) await store.lockEvent(id);
}

const refusalText = (kind: UndoKind): string => (kind === 'season' ? GROUP_ERRORS.undoSeason : GROUP_ERRORS.undoGroup);
/** A season action is refused after ANY later group, athlete or season line (10.5: "anything changed since"); a group action, after one on its own subjects. */
const SEASON_WATCH: ReadonlySet<string> = new Set(['group', 'athlete', 'season']);

async function laterLines(store: GroupStore, seq: number, record: UndoRecord): Promise<HistoryEntryRow[]> {
  if (record.kind === 'group') return store.historyAfter(seq, record.subjects);
  return (await store.historyAfter(seq, null)).filter((h) => SEASON_WATCH.has(h.subjectType));
}

async function filedAfter(store: GroupStore, record: UndoRecord): Promise<boolean> {
  const guard = record.registrationsAfter;
  return !!guard && (await store.registrationsFiledAfter(guard.seasonId, guard.at)) > 0;
}

const stripMeta = (changes: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(changes).filter(([k]) => k !== 'undo' && k !== 'actionId'));

/** "Anulat: <line>" on every subject the action wrote to (3.7), then the action is marked undone. */
async function writeUndone(ctx: GroupContext, entry: HistoryEntryRow, later: HistoryEntryRow[]): Promise<void> {
  const own = [entry, ...later.filter((h) => h.changes.actionId === entry.id)];
  for (const line of own) {
    await ctx.store.record({ subjectType: line.subjectType, subjectId: line.subjectId, action: P4_ACTIONS.undone, changes: { undoneAction: line.action, undoneChanges: stripMeta(line.changes) }, actor: ctx.actor });
  }
  await ctx.store.setHistoryChanges(entry.id, { ...entry.changes, undone: true });
}

async function undoLocked(ctx: GroupContext, actionId: string): Promise<AdminResult<{ revalidate: boolean }>> {
  const first = await ctx.store.historyEntry(actionId);
  if (!first) return refuse(404, GROUP_ERRORS.notFound);
  const record = readUndoRecord(first.changes.undo);
  if (!record) return refuse(409, GROUP_ERRORS.undoGroup);
  await lockTargets(ctx.store, undoLockTargets(record.steps));
  const entry = await ctx.store.historyEntry(actionId);
  const later = await laterLines(ctx.store, first.seq, record);
  const refusal = undoRefusal(entry, later);
  if (refusal === 'missing' || !entry) return refuse(404, GROUP_ERRORS.notFound);
  if (refusal || (await filedAfter(ctx.store, record))) return refuse(409, refusalText(record.kind));
  for (const step of [...record.steps].reverse()) await runStep(ctx.store, step, actionId);
  await writeUndone(ctx, entry, later);
  return { ok: true, data: { revalidate: record.revalidate } };
}

export async function undoAction(ctx: GroupContext, body: unknown): Promise<AdminResult<{ undone: true }>> {
  const actionId = readActionId(body);
  if (!actionId) return refuse(400, GROUP_ERRORS.invalid);
  const res = await guarded(ctx.log, `[undo] ${actionId}`, () => ctx.store.transaction(() => undoLocked(ctx, actionId)));
  if (res.ok === false) return res;
  if (res.data.revalidate) ctx.revalidate();
  return { ok: true, data: { undone: true } };
}
```

- [ ] **Step 4: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/undo-service.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/groups/undo-service.ts src/club/groups/__tests__/undo-service.test.ts
git commit -m "feat(groups): one undo route for phase 4 actions, refused after a later change"
```

---

### Task 11: Routes `06-groups.ts` and the controller

**Files:**
- Create: `src/club/groups/http.ts`, `src/api/club/routes/06-groups.ts`, `src/api/club/controllers/groups.ts`
- Test: `src/club/groups/__tests__/routes.test.ts`

**Interfaces:**
- Consumes: every service of Tasks 7 to 10; `respond`, `refuseWith`, `AdminCtx` (`src/club/admin-http.ts`).
- Produces (all `{ auth: false, policies: ['global::is-admin'], middlewares: [] }`; reads answer `{ data }`, writes `{ data, undo }`):

| Method | Path | Handler | Body / query | Answer `data` |
|---|---|---|---|---|
| GET | `/club/groups` | `groups.list` | `?season=<label>&section=<slug>` | `GroupListPage` |
| GET | `/club/groups/unassigned` | `groups.unassigned` | `?season=` | `UnassignedPage` |
| GET | `/club/groups/options` | `groups.options` | | `GroupOptions` |
| POST | `/club/groups` | `groups.create` | `{ section, name, priceListId, coachIds, programPublic }` | `NamedRef` |
| POST | `/club/memberships/allocate` | `groups.allocate` | `{ season, items }` | `AllocateResult` + undo |
| POST | `/club/memberships/:documentId/move` | `groups.move` | `{ toGroupId }` | `MoveResult` + undo |
| DELETE | `/club/memberships/:documentId` | `groups.remove` | | `MoveResult` + undo |
| POST | `/club/undo` | `groups.undo` | `{ actionId }` | `{ undone: true }` |
| GET | `/club/groups/:documentId/history` | `groups.history` | | `HistoryLine[]` |
| GET | `/club/groups/:documentId` | `groups.page` | `?season=` | `GroupPage` |
| PUT | `/club/groups/:documentId` | `groups.update` | group window body | `{ changed }` |
| DELETE | `/club/groups/:documentId` | `groups.destroy` | | `{ name }` |
| POST | `/club/groups/:documentId/members` | `groups.join` | `{ season, athleteIds, mode }` | `JoinResult` + undo |

  - `http.ts`: `respondAction(ctx, result)`, `todayIso()`, `queryText(v)`.

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import groups from '../../../api/club/controllers/groups';
import groupRoutes from '../../../api/club/routes/06-groups';

const routes = groupRoutes.routes;
const controllers: Record<string, Record<string, unknown>> = { groups };

/** Within one path prefix, every path after the first parameter path is a parameter path too (spec 10.9 rule). */
function staticBeforeParams(paths: string[]): boolean {
  const prefixes = [...new Set(paths.map((p) => p.split('/').slice(0, 3).join('/')))];
  return prefixes.every((prefix) => {
    const own = paths.filter((p) => p.startsWith(`${prefix}/`) || p === prefix);
    const firstParam = own.findIndex((p) => p.includes(':'));
    return firstParam < 0 || own.slice(firstParam).every((p) => p.includes(':'));
  });
}

describe('06-groups routes (8.2)', () => {
  it('are all admin-only', () => {
    for (const r of routes) expect(r.config, r.path).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
  });

  it('point at handlers that exist', () => {
    for (const r of routes) {
      const [controller, action] = r.handler.split('.');
      expect(typeof controllers[controller]?.[action], r.handler).toBe('function');
    }
  });

  it('declare fixed paths before parameter paths', () => {
    expect(staticBeforeParams(routes.map((r) => r.path))).toBe(true);
    expect(staticBeforeParams(['/club/groups/:documentId', '/club/groups/unassigned'])).toBe(false);
  });

  it('cover the spec routes', () => {
    expect(routes.map((r) => `${r.method} ${r.path}`)).toEqual(expect.arrayContaining([
      'GET /club/groups', 'GET /club/groups/unassigned', 'POST /club/groups', 'PUT /club/groups/:documentId', 'DELETE /club/groups/:documentId',
      'GET /club/groups/:documentId', 'GET /club/groups/:documentId/history', 'POST /club/groups/:documentId/members', 'POST /club/memberships/allocate',
      'POST /club/memberships/:documentId/move', 'DELETE /club/memberships/:documentId', 'POST /club/undo',
    ]));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/routes.test.ts`
Expected: FAIL (`Cannot find module '../../../api/club/controllers/groups'`).

- [ ] **Step 3: Write `http.ts`, the routes and the controller**

`src/club/groups/http.ts`:

```ts
import { refuseWith, type AdminCtx } from '../admin-http';
import { isoDate, todayInBucharest } from '../birth-date';
import type { ActionResult } from './action-log';

export const todayIso = (): string => isoDate(todayInBucharest());
export const queryText = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** `{ data, undo }` (spec 8.2) or the refusal in Strapi's error shape. */
export function respondAction<T>(ctx: AdminCtx, result: ActionResult<T>): void {
  if (result.ok === false) return refuseWith(ctx, result.status, result.error);
  ctx.body = { data: result.data.value, undo: result.data.actionId ? { actionId: result.data.actionId } : null };
}
```

`src/api/club/routes/06-groups.ts`:

```ts
/**
 * Admin API of Grupe (spec 5, 6, 8.2). Content-api routes (under /api), auth off, `global::is-admin`.
 * Fixed paths come before parameter paths within each prefix (a source-reading test checks it).
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/groups', handler: 'groups.list', config: adminGuard },
    { method: 'GET', path: '/club/groups/unassigned', handler: 'groups.unassigned', config: adminGuard },
    { method: 'GET', path: '/club/groups/options', handler: 'groups.options', config: adminGuard },
    { method: 'POST', path: '/club/groups', handler: 'groups.create', config: adminGuard },
    { method: 'GET', path: '/club/groups/:documentId/history', handler: 'groups.history', config: adminGuard },
    { method: 'GET', path: '/club/groups/:documentId', handler: 'groups.page', config: adminGuard },
    { method: 'PUT', path: '/club/groups/:documentId', handler: 'groups.update', config: adminGuard },
    { method: 'DELETE', path: '/club/groups/:documentId', handler: 'groups.destroy', config: adminGuard },
    { method: 'POST', path: '/club/groups/:documentId/members', handler: 'groups.join', config: adminGuard },
    { method: 'POST', path: '/club/memberships/allocate', handler: 'groups.allocate', config: adminGuard },
    { method: 'POST', path: '/club/memberships/:documentId/move', handler: 'groups.move', config: adminGuard },
    { method: 'DELETE', path: '/club/memberships/:documentId', handler: 'groups.remove', config: adminGuard },
    { method: 'POST', path: '/club/undo', handler: 'groups.undo', config: adminGuard },
  ],
};
```

`src/api/club/controllers/groups.ts`:

```ts
import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { groupContext } from '../../../club/groups/context';
import { GROUP_ERRORS } from '../../../club/groups/copy';
import { createGroup, deleteGroup, updateGroup } from '../../../club/groups/group-admin';
import { readGroupHistory } from '../../../club/groups/group-history';
import { readGroupOptions, readGroupPage } from '../../../club/groups/group-page';
import { queryText, respondAction, todayIso } from '../../../club/groups/http';
import { readGroupList, readListQuery } from '../../../club/groups/list';
import { allocateAll, joinGroup, moveMembership, removeMembership } from '../../../club/groups/members';
import { strapiGroupStore } from '../../../club/groups/strapi-store';
import { readUnassigned } from '../../../club/groups/unassigned';
import { undoAction } from '../../../club/groups/undo-service';

const store = () => strapiGroupStore(strapi);
const id = (ctx: AdminCtx): string => ctx.params.documentId ?? '';

/** Admin API of Grupe (routes/06-groups.ts, all `global::is-admin`). */
export default {
  async list(ctx: AdminCtx) {
    ctx.body = { data: await readGroupList(store(), readListQuery(ctx.query), todayIso()) };
  },

  async unassigned(ctx: AdminCtx) {
    ctx.body = { data: await readUnassigned(store(), queryText(ctx.query.season), todayIso()) };
  },

  async options(ctx: AdminCtx) {
    ctx.body = { data: await readGroupOptions(store()) };
  },

  async page(ctx: AdminCtx) {
    const page = await readGroupPage(store(), id(ctx), queryText(ctx.query.season), todayIso());
    if (!page) return refuseWith(ctx, 404, GROUP_ERRORS.notFound);
    ctx.body = { data: page };
  },

  async history(ctx: AdminCtx) {
    if (!(await store().group(id(ctx)))) return refuseWith(ctx, 404, GROUP_ERRORS.notFound);
    ctx.body = { data: await readGroupHistory(store(), id(ctx)) };
  },

  async create(ctx: AdminCtx) {
    respond(ctx, await createGroup(await groupContext(strapi, ctx), ctx.request.body));
  },

  async update(ctx: AdminCtx) {
    respond(ctx, await updateGroup(await groupContext(strapi, ctx), id(ctx), ctx.request.body));
  },

  async destroy(ctx: AdminCtx) {
    respond(ctx, await deleteGroup(await groupContext(strapi, ctx), id(ctx)));
  },

  async join(ctx: AdminCtx) {
    respondAction(ctx, await joinGroup(await groupContext(strapi, ctx), id(ctx), ctx.request.body));
  },

  async allocate(ctx: AdminCtx) {
    respondAction(ctx, await allocateAll(await groupContext(strapi, ctx), ctx.request.body));
  },

  async move(ctx: AdminCtx) {
    respondAction(ctx, await moveMembership(await groupContext(strapi, ctx), id(ctx), ctx.request.body));
  },

  async remove(ctx: AdminCtx) {
    respondAction(ctx, await removeMembership(await groupContext(strapi, ctx), id(ctx)));
  },

  async undo(ctx: AdminCtx) {
    respond(ctx, await undoAction(await groupContext(strapi, ctx), ctx.request.body));
  },
};
```

- [ ] **Step 4: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/routes.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/groups/http.ts src/api/club/routes/06-groups.ts src/api/club/controllers/groups.ts src/club/groups/__tests__/routes.test.ts
git commit -m "feat(groups): admin routes for Grupe, memberships and undo"
```

---
### Task 12: Production-shape fixture and boot check on a throwaway Postgres

**Files:**
- Create: `scripts/fixtures/phase4-shape.js` (committed; plans 4-2 to 4-7 reuse it)
- Temporary: `${TMPDIR:-/tmp}/es41` (removed at the end)

**Interfaces:**
- Consumes: everything above.
- Produces: `node scripts/fixtures/phase4-shape.js` seeds an EMPTY throwaway database with the production shape of `.superpowers/phase4/research.md` (9 groups, "Primii Paşi" with the cedilla, `program.scheduleGroups`, the calendar events, the blackout, the two coaches' `groups` texts) plus synthetic children, and writes their ids to `$IDS_FILE` as JSON: `{ seasons: { '2025-2026', '2026-2027' }, sections: { school, club }, groups: { <name>: id }, athletes: { <name>: id }, events: { <title or title#n>: id }, team: { <name>: id } }`. It refuses to run unless `ES_THROWAWAY_DB=1` is set and the database has no season yet.
- Proves (spec 12): Grupe totals, "Fără grupă" sources and proposals, allocate / undo / second undo refused, allocate all, move (old row ended yesterday), remove with promotion, add with "Reactivat", two parallel allocations of one child leave exactly one current main row, undo refused after another change, group Istoric, no generated routes for calendar events, breaks and groups, the name rule, delete refused for a used group.

Container `es41-pg` on 127.0.0.1:55441, Strapi on 1361. If a port is taken, pick a free one and change it everywhere below. Never use 1337, 1340, 3010 or 5432. Run every command from the root of the worktree your dispatch names (`REPO=$(git rev-parse --show-toplevel)`). Log in once with curl (Strapi rate-limits `/admin/login`).

- [ ] **Step 1: Write the fixture**

`scripts/fixtures/phase4-shape.js`:

```js
'use strict';
/**
 * Phase 4 boot-check fixture: the production shape read on 2026-10-27 (.superpowers/phase4/research.md) plus synthetic
 * children, on an EMPTY throwaway database only. Usage (from the repo root, with the throwaway env loaded):
 *   ES_THROWAWAY_DB=1 IDS_FILE=/tmp/x/ids.json node scripts/fixtures/phase4-shape.js
 */
const fs = require('node:fs');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

if (process.env.ES_THROWAWAY_DB !== '1' || !process.env.IDS_FILE) {
  console.error('refused: set ES_THROWAWAY_DB=1 and IDS_FILE (throwaway databases only)');
  process.exit(2);
}

const ids = { seasons: {}, sections: {}, groups: {}, athletes: {}, events: {}, team: {} };
const rec = (o) => ({ freq: 'weekly', mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false, endsNextDay: false, ...o });
const time = (t) => `${t}:00.000`;

async function seasonsAndSections(d) {
  const season = async (label, startMonth, endMonth, membershipFee, isCurrent) => (ids.seasons[label] = (await d('api::season.season').create({ data: { label, startMonth, endMonth, membershipFee, isCurrent } })).documentId);
  await season('2025-2026', '2025-10-01', '2026-05-31', 250, false);
  await season('2026-2027', '2026-10-01', '2027-05-31', 270, true);
  ids.sections.school = (await d('api::section.section').create({ data: { name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', slug: 'scoala-afi', publicPage: true, registrationsOpen: true, order: 1 } })).documentId;
  ids.sections.club = (await d('api::section.section').create({ data: { name: 'Club', kind: 'club', slug: 'club', publicPage: false, order: 2 } })).documentId;
}

async function groupsAndCoaches(d) {
  const list = async (name, section) => (await d('api::price-list.price-list').create({ data: { name, section } })).documentId;
  const standard = await list('Standard', ids.sections.school);
  const gold = await list('Avansați Gold', ids.sections.school);
  const club = await list('Club', ids.sections.club);
  const school = [['Avansați Gold', gold], ['Primii Paşi', standard], ['Începători', standard], ['Intermediari Silver', standard], ['Intermediari Bronze', standard], ['Avansați Silver', standard], ['Avansați Bronze', standard]];
  for (const [i, [name, priceList]] of school.entries()) ids.groups[name] = (await d('api::group.group').create({ data: { name, section: ids.sections.school, priceList, order: i + 1, active: true } })).documentId;
  for (const [i, name] of ['Profesioniști', 'Avansați'].entries()) ids.groups[name] = (await d('api::group.group').create({ data: { name, section: ids.sections.club, priceList: club, order: i + 1, active: true } })).documentId;
  ids.team['Andreea Pascu'] = (await d('api::team-member.team-member').create({ data: { name: 'Andreea Pascu', role: 'Antrenor', groups: ['Profesionisti', 'Avansati'], order: 1 } })).documentId;
  ids.team['Virgil Pascu'] = (await d('api::team-member.team-member').create({ data: { name: 'Virgil Pascu', role: 'Instructor', groups: ['Intermediari Silver', 'Intermediari Bronze'], order: 2 } })).documentId;
}

async function program(d) {
  const scheduleGroups = [
    { timeSlot: '09:00 - 09:50', courses: ['Avansați Gold'] },
    { timeSlot: '10:00 - 10:50', courses: ['Primii Paşi', 'Intermediari Silver', 'Avansați Silver'] },
    { timeSlot: '11:00 - 11:50', courses: ['Începători', 'Intermediari Bronze', 'Avansați Bronze'] },
  ];
  await d('api::program.program').create({ data: { scheduleGroups } });
}

const EVENTS = [
  ['Antrenament: Avansati', 'curs', rec({ tue: true, thu: true, startTime: time('18:00'), endTime: time('19:30'), seasonStart: '2026-10-01', seasonEnd: '2027-05-31' })],
  ['Titlu', 'curs', rec({ freq: 'none', singleDate: '2026-11-03', startTime: time('10:00'), endTime: time('11:00') })],
  ['Școala de patinaj', 'scoala', rec({ sat: true, sun: true, startTime: time('10:00'), endTime: time('12:50'), seasonStart: '2025-10-04', seasonEnd: '2026-05-31' })],
  ['Școala de patinaj', 'scoala', rec({ sat: true, sun: true, startTime: time('10:00'), endTime: time('12:50'), seasonStart: '2026-10-03', seasonEnd: '2027-05-30' }), [
    { date: '2026-10-31', kind: 'liber', newTitle: 'Vacanța de toamnă' }, { date: '2026-11-14', kind: 'anulat', newTitle: 'Patinoar închis' },
  ]],
  ['Bellu Memorial', 'concurs', rec({ freq: 'none', singleDate: '2026-12-05' })],
  ['Cupa Primaverii', 'concurs', rec({ freq: 'none', singleDate: '2027-04-10' })],
  ['Eveniment', 'eveniment', rec({ freq: 'none', singleDate: '2026-11-11' })],
  ['Serbare Craciun', 'eveniment', rec({ freq: 'none', singleDate: '2026-12-20' })],
  ['Serbare final de sezon', 'eveniment', rec({ freq: 'none', singleDate: '2027-05-29' })],
  ['Vacanta scolara', 'vacanta', rec({ freq: 'none', singleDate: '2026-10-24', endDate: '2026-11-01' })],
  ['Vacanta scolara', 'vacanta', rec({ freq: 'none', singleDate: '2026-12-20', endDate: '2027-01-07' })],
  ['Vacanta scolara', 'vacanta', rec({ freq: 'none', singleDate: '2027-04-03', endDate: '2027-04-12' })],
];

async function calendar(d) {
  for (const [title, type, recurrence, exceptions = []] of EVENTS) {
    const key = ids.events[title] ? `${title}#${Object.keys(ids.events).filter((k) => k.startsWith(title)).length + 1}` : title;
    ids.events[key] = (await d('api::calendar-event.calendar-event').create({ data: { title, type, recurrence, exceptions } })).documentId;
  }
  await d('api::calendar-blackout.calendar-blackout').create({ data: { label: 'Vacanța de iarnă', startDate: '2026-01-14', endDate: '2026-01-16' } });
}

const KIDS = [
  ['Ana Ionescu', '2014-05-02', 'activ', 'parinte.ionescu@example.com', [['2026-2027', 'Intermediari Bronze', true]]],
  ['Matei Ionescu', '2017-02-14', 'activ', 'Parinte.Ionescu@example.com ', [['2025-2026', 'Primii Paşi', true]]],
  ['Daria Stan', '2015-03-10', 'activ', 'parinte.stan@example.com', [['2026-2027', 'Avansați', true], ['2026-2027', 'Intermediari Bronze', false]]],
  ['Filip Radu', '2013-07-21', 'activ', 'parinte.radu@example.com', [['2026-2027', 'Intermediari Bronze', true], ['2026-2027', 'Profesioniști', false]]],
  ['Elisa Georgescu', '2014-09-01', 'nou', 'parinte.georgescu@example.com', []],
  ['Sofia Tănase', null, 'activ', 'parinte.tanase@example.com', []],
  ['Tudor Matei', '2012-01-05', 'inactiv', 'parinte.matei@example.com', [['2025-2026', 'Avansați Bronze', true]]],
  ['Ioana Marin', '2011-11-11', 'activ', 'parinte.marin@example.com', [['2026-2027', 'Profesioniști', true]]],
  ['Luca Mihai', '2012-04-04', 'activ', 'parinte.mihai@example.com', [['2026-2027', 'Avansați Gold', true]]],
];

async function children(d) {
  for (const [name, birthDate, status, email, rows] of KIDS) {
    const id = (await d('api::athlete.athlete').create({ data: { name, birthDate, status, email, contactName: 'Părinte Test', phone: '0700000000', dataIncomplete: false } })).documentId;
    ids.athletes[name] = id;
    for (const [label, group, isMain] of rows) {
      await d('api::group-membership.group-membership').create({ data: { athlete: id, group: ids.groups[group], season: ids.seasons[label], isMain, from: `${label.slice(0, 4)}-10-01`, to: null } });
    }
  }
  await d('api::registration-submission.registration-submission').create({ data: {
    email: 'parinte.georgescu@example.com', phone: '0700000000', childName: 'Elisa Georgescu', childBirthDate: '01.09.2014', parentName: 'Părinte Test', shirtSize: 'S',
    status: 'Confirmat', season: '2026-2027', seasonRef: ids.seasons['2026-2027'], section: ids.sections.school, registrationNumber: '2026-0901', submittedAt: '2026-10-05T10:00:00.000Z',
    relationship: 'parinte', gdprConsent: true, regulationsConsent: true, submissionKey: 'phase4-fixture-elisa', archived: false, athlete: ids.athletes['Elisa Georgescu'],
  } });
}

(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  if ((await d('api::season.season').count({})) > 0) {
    console.error('refused: the database already has seasons; the fixture needs an empty throwaway database');
    await app.destroy();
    process.exit(2);
  }
  await seasonsAndSections(d);
  await groupsAndCoaches(d);
  await program(d);
  await calendar(d);
  await children(d);
  fs.writeFileSync(process.env.IDS_FILE, JSON.stringify(ids, null, 2));
  console.log('phase 4 fixture ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Full checks**

```bash
REPO=$(git rev-parse --show-toplevel); cd "$REPO"
npx vitest run
npx tsc --noEmit
```

Expected: all tests PASS, zero type errors.

- [ ] **Step 3: Postgres, environment, build, fixture, Strapi**

```bash
T="${TMPDIR:-/tmp}/es41"; mkdir -p "$T/private"
cat > "$T/env" <<'ENV'
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=55441
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=strapi
HOST=127.0.0.1
PORT=1361
APP_KEYS=throwawayA,throwawayB
API_TOKEN_SALT=throwaway
ADMIN_JWT_SECRET=throwaway
TRANSFER_TOKEN_SALT=throwaway
JWT_SECRET=throwaway
ENCRYPTION_KEY=throwaway
STRAPI_TELEMETRY_DISABLED=true
ENV
echo "PRIVATE_FILES_DIR=$T/private" >> "$T/env"
docker run -d --name es41-pg -e POSTGRES_USER=strapi -e POSTGRES_PASSWORD=strapi -e POSTGRES_DB=strapi -p 127.0.0.1:55441:5432 postgres:16
until docker exec es41-pg pg_isready -U strapi >/dev/null 2>&1; do sleep 1; done
(set -a; . "$T/env"; set +a; npm run build)
(set -a; . "$T/env"; set +a; ES_THROWAWAY_DB=1 IDS_FILE="$T/ids.json" node scripts/fixtures/phase4-shape.js)
(set -a; . "$T/env"; set +a; ES_THROWAWAY_DB=1 IDS_FILE="$T/again.json" node scripts/fixtures/phase4-shape.js); echo "second run exit $?"
(set -a; . "$T/env"; set +a; npx strapi admin:create-user --email=admin@example.com --password='Throwaway123' --firstname=Admin)
(set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi start > "$T/strapi.log" 2>&1 & echo $! > "$T/pid")
until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1361/_health | grep -q 204; do sleep 2; done
```

Expected: `✔ Building admin panel`; `phase 4 fixture ok`; `second run exit 2` (refused on a non-empty database); the admin created; `/_health` answers 204.

- [ ] **Step 4: Helpers**

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:1361/admin/login -H 'Content-Type: application/json' -d '{"email":"admin@example.com","password":"Throwaway123"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])')
idof() { python3 -c "import json,sys; d=json.load(open('$T/ids.json')); print(d[sys.argv[1]][sys.argv[2]])" "$1" "$2"; }
api() { curl -s -X "$1" "http://127.0.0.1:1361/api$2" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' ${3:+-d "$3"}; }
code() { curl -s -o /dev/null -w '%{http_code}\n' -X "$1" "http://127.0.0.1:1361/api$2" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' ${3:+-d "$3"}; }
py() { python3 -c "import json,sys; d=json.load(sys.stdin); $1"; }
q() { docker exec -i es41-pg psql -U strapi -d strapi -At -c "$1"; }
IB=$(idof groups 'Intermediari Bronze'); IS=$(idof groups 'Intermediari Silver'); PP=$(idof groups 'Primii Paşi'); INC=$(idof groups 'Începători'); PRO=$(idof groups 'Profesioniști')
ANA=$(idof athletes 'Ana Ionescu'); ELISA=$(idof athletes 'Elisa Georgescu'); MATEI=$(idof athletes 'Matei Ionescu'); SOFIA=$(idof athletes 'Sofia Tănase'); TUDOR=$(idof athletes 'Tudor Matei'); FILIP=$(idof athletes 'Filip Radu')
MAINS="select a.document_id, count(*) from group_memberships m join group_memberships_athlete_lnk la on la.group_membership_id = m.id join athletes a on a.id = la.athlete_id join group_memberships_season_lnk ls on ls.group_membership_id = m.id join seasons s on s.id = ls.season_id where s.label = '2026-2027' and m.\"to\" is null and m.is_main group by 1 having count(*) <> 1"
```

If the link-table names differ, list them with `q '\dt group_memberships*'` and adjust `MAINS` (keep its meaning: athletes with a number of current main rows in 2026-2027 other than one).

- [ ] **Step 5: Grupe and "Fără grupă"**

```bash
api GET '/club/groups?section=scoala-afi' | py "p=d['data']; print([(t['label'], t['count']) for t in p['tabs']]); print(p['athletes'], p['groups'], p['unassigned']); print([(r['name'], r['members'], r['program'], r['coaches']) for r in p['rows']])"
api GET '/club/groups/unassigned' | py "print([(r['name'], r['source'], r['proposedGroupId'] is not None) for r in d['data']['rows']])"
```

Expected: `[('Școala de patinaj', 7), ('Club', 2)]`; `4 7 3` (Ana, Daria, Filip, Luca distinct in the school tab; Daria and Filip once each); seven rows in group order with `program` `[]` (no linked series until migration step 4) and `coaches` `[]`; the unassigned rows `('Elisa Georgescu', 'Înscriere Școală, 12 ani', False)`, `('Matei Ionescu', 'Din 2025-2026, 9 ani', True)`, `('Sofia Tănase', 'Adăugat în Sportivi', False)` (ages as of the run date; Tudor is Inactiv and not listed).

- [ ] **Step 6: Allocate, undo, allocate all, move, remove, add**

```bash
A1=$(api POST "/club/groups/$IB/members" "{\"season\":\"2026-2027\",\"athleteIds\":[\"$ELISA\"],\"mode\":\"allocate\"}" | py "print(d['undo']['actionId'])")
code POST /club/undo "{\"actionId\":\"$A1\"}"
api POST /club/undo "{\"actionId\":\"$A1\"}" | py "print(d['error']['status'], d['error']['message'])"
api POST /club/memberships/allocate "{\"season\":\"2026-2027\",\"items\":[{\"athleteId\":\"$MATEI\",\"groupId\":\"$PP\"},{\"athleteId\":\"$SOFIA\",\"groupId\":\"$INC\"}]}" | py "print(d['data'], d['undo'] is not None)"
M=$(q "select m.document_id from group_memberships m join group_memberships_athlete_lnk la on la.group_membership_id = m.id join athletes a on a.id = la.athlete_id where a.document_id = '$ANA' and m.\"to\" is null")
api POST "/club/memberships/$M/move" "{\"toGroupId\":\"$IS\"}" | py "print(d['data'])"
q "select \"to\" = current_date - 1 from group_memberships where document_id = '$M'"
MF=$(q "select m.document_id from group_memberships m join group_memberships_athlete_lnk la on la.group_membership_id = m.id join athletes a on a.id = la.athlete_id join group_memberships_group_lnk lg on lg.group_membership_id = m.id join club_groups g on g.id = lg.group_id where a.document_id = '$FILIP' and g.name = 'Intermediari Bronze' and m.\"to\" is null")
code DELETE "/club/memberships/$MF"
api GET "/club/athletes/$FILIP/history" | py "print([l['text'] for l in d['data']][:2])"
api POST "/club/groups/$PRO/members" "{\"season\":\"2026-2027\",\"athleteIds\":[\"$TUDOR\"],\"mode\":\"add\"}" | py "print(d['data'])"
q "select status from athletes where document_id = '$TUDOR'"
```

Expected: `200`; `409 Nu se mai poate anula. Grupa s-a schimbat între timp.`; `{'allocated': 2} True`; `{'athleteName': 'Ana Ionescu', 'groupName': 'Intermediari Silver'}`; `t`; `200`; Filip's two newest lines are `Grupa principală schimbată: Intermediari Bronze → Profesioniști` and `Scos din grupa Intermediari Bronze` (either order: same second); `{'added': 1, 'athleteNames': ['Tudor Matei'], 'groupName': 'Profesioniști'}`; `activ`.

- [ ] **Step 7: Two admins at the same moment, and the undo refusal (Review Focus)**

```bash
NEW=$(api POST /club/athletes '{"name":"Radu Paralel","birthDate":"03.03.2015","contactName":"Părinte","phone":"0700000001","email":"paralel@example.com"}' | py "print(d['data']['documentId'])")
api POST "/club/groups/$PP/members" "{\"season\":\"2026-2027\",\"athleteIds\":[\"$NEW\"],\"mode\":\"add\"}" > "$T/r1" &
api POST "/club/groups/$INC/members" "{\"season\":\"2026-2027\",\"athleteIds\":[\"$NEW\"],\"mode\":\"add\"}" > "$T/r2" &
wait
q "$MAINS"
q "select count(*) from group_memberships m join group_memberships_athlete_lnk la on la.group_membership_id = m.id join athletes a on a.id = la.athlete_id where a.document_id = '$NEW' and m.is_main and m.\"to\" is null"
U=$(api POST "/club/groups/$IB/members" "{\"season\":\"2026-2027\",\"athleteIds\":[\"$ELISA\"],\"mode\":\"allocate\"}" | py "print(d['undo']['actionId'])")
MD=$(q "select m.document_id from group_memberships m join group_memberships_athlete_lnk la on la.group_membership_id = m.id join athletes a on a.id = la.athlete_id join group_memberships_group_lnk lg on lg.group_membership_id = m.id join club_groups g on g.id = lg.group_id where a.document_id = '$(idof athletes 'Daria Stan')' and g.name = 'Intermediari Bronze' and m.\"to\" is null")
code DELETE "/club/memberships/$MD"
api POST /club/undo "{\"actionId\":\"$U\"}" | py "print(d['error']['message'])"
```

Expected: `$MAINS` prints nothing (every athlete with a current row has exactly one main); the count for Radu Paralel is `1`; the last line `Nu se mai poate anula. Grupa s-a schimbat între timp.`

- [ ] **Step 8: Istoric, the group window, closed routes**

```bash
api GET "/club/groups/$IB/history" | py "print([l['text'] for l in d['data']][:4])"
code POST /club/groups '{"section":"scoala-afi","name":"primii pasi"}'
api POST /club/groups '{"section":"scoala-afi","name":"primii pasi"}' | py "print(d['error']['message'])"
NG=$(api POST /club/groups '{"section":"club","name":"Grupa de test","coachIds":[],"programPublic":false}' | py "print(d['data']['documentId'])")
code DELETE "/club/groups/$NG"
code DELETE "/club/groups/$IB"
for p in /calendar-events /calendar-blackouts /groups; do echo "$p $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:1361/api$p")"; done
```

Expected: the four newest Intermediari Bronze lines include `Sportiv scos: Daria Stan.`, `Sportiv alocat: Elisa Georgescu.`, `Anulat: Sportiv alocat: Elisa Georgescu.` and `Mutat în Intermediari Silver: Ana Ionescu. Grupa principală schimbată: Intermediari Bronze → Intermediari Silver`; `409`; `Există deja o grupă cu acest nume.`; `200`; `409`; each of the three closed routes prints `404` (never 200).

- [ ] **Step 9: Clean up**

```bash
kill "$(cat "$T/pid")"
docker rm -f es41-pg
rm -rf "$T"
```

Expected: container removed. Commit only the fixture:

```bash
git add scripts/fixtures/phase4-shape.js
git commit -m "test(groups): production-shape fixture for the phase 4 boot checks"
```

---

## Interfaces for other plans

- **Store and context.** `GroupStore` (`src/club/groups/types.ts`) has every phase 4 read and write, events, breaks, e-mail jobs and seasons included; `strapiGroupStore(strapi)`; `GroupContext` and `groupContext(strapi, ctx)` (`context.ts`); fake: `fakeContext(seed, today)`, `fakeGroupStore(seed)`, seeds `G_SEASONS` (s25 past, s26 current, s27 next), `G_SECTIONS` (afi school `scoala-afi`, club), `G_GROUPS` (g-pp, g-ib, g-is school; g-pro, g-av club), `G_TEAM`, `G_PRICE_LISTS`, builders `member`, `event`, `athleteRow`, `registrationRow` (`__tests__/fake-group-store.ts`). Plan 4-2 adds `emails: (changeKey: string) => void` to `GroupContext` and to `fakeContext`.
- **Mappers** (`strapi-store.ts`): `toEventRecord`, `toRecurrence`, `toException`, `recurrenceData`, `exceptionData`, `toGroupRecord`.
- **Texts.** `dates.ts` (`dayMonth`, `shortDate`, `weekdayName`, `addDays`, `addMinutes`, `minutesBetween`, `isIsoDate`, `isTime`, `clampDate`, `hhmm`, `capitalized`), `program-text.ts` (`listLine`, `programLine`, `programLineFrom`, `daysSpoken`, `DAY_ORDER`, `DAY_SHORT`, `DAY_OF_INDEX`), `copy.ts` (`GROUP_ERRORS`, `GROUP_TOASTS`, `GROUP_LINES`, `PROGRAM_LINES`, `BREAK_LINES`, `SEASON_LINES`, `FIELD_LABELS`, `SECTION_LABELS`, `withPeriod`, `fieldLine`, `sourceLine`, `athletesText`, `groupsText`, `seriesCountText`). A later plan adds `copy/<file>.ts` and one `export * from './copy/<file>';` line.
- **Series.** `series.ts`: `seriesView`, `classView`, `groupSeries`, `groupClasses`, `currentSeries`, `runningOn`, `seasonBounds`, `overlapsSeason`, `seriesText`.
- **History.** `P4_ACTIONS` with the `changes` table of Task 4, `GROUP_SUBJECT`, `BREAK_SUBJECT`, `SEASON_SUBJECT`, `ATHLETE_SUBJECT`, `groupHistoryTexts`, `phase4Lines`.
- **Undo.** `UndoStep` ops (`deleteMembership`, `setMembership`, `createMembership`, `setStatus`, `deleteEvent`, `setEvent`, `createEvent`, `cancelEmails` (cancels the jobs whose `changeKey` is the action id), `setCurrentSeason`), `UndoRecord`, `membershipUndo`; `recordAction(store, actor, lines, { kind, steps, revalidate, registrationsAfter? })` returns the action id; `done(value, actionId)`, `ActionResult<T>`, `respondAction(ctx, result)` (`http.ts`); `undoAction` serves every record.
- **Membership rules.** `planJoin`, `planMove`, `planRemove`, `leaveWrite`, `currentRows`, `earliestRow`, `isCurrentMembership`, `checkMainGroup`; `startDateFor(season, today)`, `pickSeason`, `currentSeason`, `previousSeason`, `isPastSeason`, `startYear`, `seasonRef`, `seasonChoices`, `ageOnIso` (`season-pick.ts`); `orderedSections`, `sectionLabel`, `groupChoices`, `byGroupOrder` (`sections.ts`); `unassignedRows`, `unassignedFor` (`unassigned.ts`).
- **Routes and shapes** (admin UI, plan 4-5): the table of Task 11 and `api-types.ts`. Plan 4-3 adds `copyFrom: CopyFrom | null` to `GroupPage`.
- **Fixture.** `scripts/fixtures/phase4-shape.js` with `ES_THROWAWAY_DB=1 IDS_FILE=<path>`; ids JSON as in Task 12.

## Self-review

- **Spec coverage.**
  - 3.1 Group `programPublic` (T1), name rule (T8), carry-over (no per-season group rows); 3.2 memberships, current rows, `from` (T3, T7 `startDateFor`), end or delete (T3), one main per season (T3, T9); 3.3 to 3.6 schema (T1; behaviour in 4-2); 3.7 every history line and "Anulat" (T4, T10).
  - 5.2 list (T7); 5.3 "Fără grupă" rows, proposal, options, "Alocă", "Alocă toți", toasts' copy (T7, T9, T2 copy); 5.4 group window (T8).
  - 6.1 header and "Șterge grupa" rule (T7, T8); 6.2 roster columns data, row menu actions, move window rules, "Adaugă și în grupă", "Scoate din grupă", "Adaugă sportivi" with Reactivat (T7, T9); 6.4 Istoric (T7).
  - 8.1 rules: one main, history kept, distinct counts, season scoping and past read-only, locks, all or nothing, undo (T3, T7, T9, T10); 8.2 group, membership and undo routes (T11); 8.3 core routers closed (T1, decided 13). Program, date, break, occurrence, schedule and public routes: plan 4-2; new season: plan 4-3; migration: plan 4-4; screens: plans 4-5, 4-6.
  - 11 copy module and texts (T2, T4); 12 unit tests, store parity (T6), route source test (T11), boot check (T12).
- **Placeholder scan:** every code step carries its code; the one conditional instruction (cast a document-service `data` object `as never` if `tsc` rejects it) names exactly what to do.
- **Type consistency:** `MembershipRow.to` (T3) is read by `currentRows`, `membershipUndo`, `isCurrentMembership`; `GroupStore.membership` (T2) is implemented in T6 and used in T9; `ActionResult`, `done`, `recordAction` (T8) are used in T9; `UndoRecord.kind` drives the refusal text in T10; `GroupPage` (T7) is what the controller returns (T11).
- **Review Focus:** concurrent joins (T9 sequential test, T12 parallel curl and `MAINS`), undo after another change and twice (T5, T10, T12), delete-instead-of-end and its undo (T3, T9, T10), unknown or past season (T7, T9), anonymized athletes (T7 unassigned, T7 group Istoric, T9 refusal).
