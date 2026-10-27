# Phase 5-2: Attendance Services and Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The backend of "Prezență": the day page and the undone list, the session panel read, the "+ Ședință nouă" check, the session save (Școala slots, Club prices, visitors, reactivation 409, corrections, Istoric), the group tab list, individual lessons (create, read, save, delete, undo), "Pe antrenori" with CSV and the athlete's month attendance, behind the admin routes of `09-attendance.ts`.

**Architecture:** Services in `src/club/presence/attendance/`, `lessons/` and `coaches/` run on the plan 5-1 `PresenceStore` through `PresenceContext`; every rule a service needs that the signature and a test can pin is a pure function next to it (roster on a date, default duration, the save plan, hours, CSV), so the admin bundle of plan 5-5 can import the response types and pure helpers. Writes are one `store.transaction` each, inside `guarded`, with the spec 7.1 lock order; lessons record a `PresenceUndoRecord` through `recordPresenceAction`; a session save has no undo (C46). One controller `attendance` serves the new route file.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS), Postgres 16, Vitest 3, Node 22.

**Spec:** `docs/superpowers/specs/2026-10-27-attendance-payments-design.md` (v1, approved 2026-10-27): 3.1 to 3.3, 3.8, 3.9, 4.1 to 4.7, 4.8 (slot use), 4.10, 4.12, 4.13, 4.18, 4.22, 5.2 to 5.6 (data each screen reads), 5.7 "Prezențe" block (data), 6 (attendance routes), 7.1, 7.2, 7.3 (session save, lessons), 8 (session and lesson lines), 11.1 (4.3, 4.5, 4.10, 4.12, 4.22 parts), 11.3 (routes), 11.4 (attendance parts). Index: `docs/superpowers/plans/2026-10-27-phase5-index.md` ("Shared interfaces" is binding for names). Plan 5-1: `docs/superpowers/plans/2026-10-27-phase5-1-presence-foundation.md` (its "Interfaces for other plans"). Decisions: `../edusport_frontend/docs/portal/DECISIONS.md`.

**Base:** `feat/athletes` with plan 5-1 merged. Runs in parallel with plans 5-3 and 5-4. Plan 5-5 builds the screens on this plan's routes and `api-types.ts`.

**Parallel groups:** A: T1 | B: T2, T3, T5, T6, T7 | C: T4 | D: T8

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Copy, response types, roster and view helpers | plan 5-1 | `copy/attendance.ts`, `copy.ts` (one line), `attendance/api-types.ts`, `attendance/roster.ts`, `attendance/view.ts`, `__tests__/attendance-seed.ts` |
| B | 2 Day page, 3 Panel read and check, 5 Group tab and athlete month, 6 Lessons, 7 Pe antrenori | 1 | 2: `attendance/day.ts`; 3: `attendance/panel.ts`, `attendance/check.ts`; 5: `attendance/group-month.ts`, `attendance/athlete-month.ts`; 6: `lessons/**`; 7: `coaches/**` |
| C | 4 Session save | 1 | `attendance/save-plan.ts`, `attendance/save.ts`, `attendance/http.ts` |
| D | 8 Routes, controller, boot check | everything | `routes/09-attendance.ts`, `controllers/attendance.ts` |

Risk: **high** T4, T6, T8 (slots, frozen prices, locks, undo, routes); **low** T1, T2, T3, T5, T7 (reads and pure helpers). Per-task reviews run on high tasks only.

## Decided while planning (low impact, decided by Claude; the user may overrule any line)

Log them in DECISIONS.md as "plan 5-2, decided by Claude (low impact, 2026-10-27)". Each is implemented in the one place named.

1. **Three reads beyond spec 6**, because the windows need defaults before "Continuă" / "Salvează": `GET /club/attendance/session/defaults?group=&date=` answers `{ durationMin, coachIds }` (4.5 Durată, C17, C20); `GET /club/lessons/new?athlete=&date=` answers `{ coachIds }` (C17); `GET /club/attendance/session?group=&date=&time=&duration=` reads the panel of an added session not saved yet (`check.ts`, `panel.ts`, `09-attendance.ts`).
2. **Reactivation 409.** Spec 6 names `keepInactive` in the 409 condition but not in the body; the body gains `keepInactive: athleteIds` ("Salvează fără"). The answer is `{ data: null, error: { status: 409, name: 'ClubAdminError', message: 'Sportiv inactiv', details: { inactive: [{ id, name }] } } }` (`attendance/http.ts::respondSave`).
3. **Only newly ticked inactive athletes are asked** (no attendance row yet in this session), so re-saving a corrected session never asks again (`save.ts`).
4. **Școala rows hold "Grup" only** (4.1, p5 Q2): at a school group a tick `{ grup: false, uscat: true }` is no presence and `uscat` is stored false (`save-plan.ts`).
5. **A save that changes nothing writes nothing** (no row, no line, `savedAt` unchanged) and answers the same toast (`save.ts`).
6. **The first-save line counts like the footer** (5.3): x = every present athlete, visitors included; y = the group's list on that date (`save.ts`). Lists and the group tab count x on the list only (C42).
7. **"În afara programului"** for an `added` session = no held occurrence of its group on that date (3.1, 4.6); for a `schedule` session = none at that date and time (4.4, plan 5-1 `isOutsideSchedule`) (`view.ts::outsideFor`).
8. **No season for the date** (before every season) refuses the save with 400 `PRESENCE_ERRORS.invalid`; a session needs `season` (3.1) (`save.ts`).
9. **An added session needs an active group** (5.4 offers active groups); corrections of a saved session of a group made inactive later are allowed (`save.ts`).
10. **Group tab Stare** of a past unsaved date before `attendanceStartDate` (or with none set) is blank; the date is still listed (5.6 lists held occurrences) (`group-month.ts`).
11. **Lesson lines:** creating a lesson always writes "Lecție programată: ..."; a lesson created held (C47) also writes "Lecție salvată: prezent.". `lesson-edited` stores `coaches` as names joined by ", " (staff, never anonymized) and `durationMin` as minutes (`lessons/create.ts`, `lessons/save.ts`).
12. **Lesson toasts.** Spec 7.3 gives create an undo but no toast text: create and save answer the approved "Salvat." (save with no change "Nicio modificare.") [DEC 2026-10-26 plan 3-5]; flagged for the user (`copy/attendance.ts`).
13. **A paid lesson** (a non-cancelled payment with `lessonId`) cannot be deleted: 409 `PRESENCE_ERRORS.stale` (the link is hidden in 5-5, C49) (`lessons/delete.ts`).
14. **Durations** on the server: integer 5 to 600 in steps of 5 for lessons and added sessions (3.1, 3.3); the windows offer the P4 Select 15 to 240 (`view.ts::isDuration`).
15. **CSV:** lines end with `\r\n`; a cell containing `;` or `"` is quoted with `"` doubled (`coaches/csv.ts`).
16. **The panel read carries the session's Istoric** (C69) as `history: string[]`; no separate route (`panel.ts`).
17. **Audience is frozen on every row** (3.2 says so; Școala rows store it unused).
18. **Athlete month block** rows newest first (`athlete-month.ts`).

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes`. Commit only in the worktree your dispatch names (never in p3be or p3fe); before every commit run `git rev-parse --show-toplevel` and `git branch --show-current` and compare with the dispatch.
- A dated DECISIONS.md entry wins over the spec; the spec wins over this plan's prose.
- Files this plan may touch (index): `src/club/presence/attendance/**`, `lessons/**`, `coaches/**`, `copy/attendance.ts`, one export line in `src/club/presence/copy.ts`, `src/api/club/routes/09-attendance.ts`, `src/api/club/controllers/attendance.ts`, tests under `src/club/presence/__tests__/`. Nothing else.
- Checks after every task: the task's test file (`npx vitest run <file>`), the full suite (`npx vitest run`), `npx tsc --noEmit` (zero errors).
- Code: TypeScript, no `any`, single quotes, semicolons, 2-space indent, functions under 30 lines, cyclomatic complexity under 10, no dead code, no comments that restate code. `api-types.ts`, `roster.ts`, `view.ts`, `save-plan.ts`, `coaches/hours.ts`, `coaches/csv.ts` import no Strapi, Node or React (plan 5-5 imports them).
- Data rules (spec 3): dates `YYYY-MM-DD`, times `HH:mm`, months `YYYY-MM`, amounts numbers in RON; ids are documentIds.
- Lock order (spec 7.1): athletes (sorted), then sessions / lessons, then subscriptions (sorted); a session save locks the session row first when it exists, then athletes, then their subscriptions; re-read after locking; never lock outside `store.transaction`.
- Every write is one transaction; failure answers 500 "Acțiunea nu a reușit. Nimic nu a fost salvat." through `guarded`; a duplicate key (`UniqueKeyError`) answers 409 "Prezența s-a schimbat între timp. Reîncarcă."; every write records its Istoric lines (P5_ACTIONS and the `changes` table of plan 5-1 Task 10, exactly).
- Prices are snapshots (C73): the group's price list as it is at the moment of saving; a correction prices only rows it adds or whose ticks change (C29).
- Copy: every string in `src/club/presence/copy/attendance.ts` or plan 5-1 `copy/core.ts`, exactly as the spec gives it; ș and ț with the comma below; straight quotes; "->" is "→" (`ARROW`); no em or en dash, no middle dot, no emoji; number forms through `countWords`.
- Synthetic data only. Never touch production, `strapi_app`, `strapi_db`, `edusport-test-pg`, ports 1337, 1340, 3010, 5432, 55442. Task 8 uses container `es52-pg` on 127.0.0.1:55452 and Strapi on 1372.
- Commits: Conventional Commits, the message given in the task, no `Co-Authored-By`, no AI attribution (check with `git log -1 --format=%B`). Never push. Never commit `.env`.
- Progress board: `printf '%s | 5-2 T<n> | implementer | <status>\n' "$(date -u +%H:%M)" >> /Users/codrin/Documents/Programming/edusport_backend/.superpowers/phase3-shared/progress-board.md`.

## Review Focus

- **Two admins save the same planned session at once** (no row yet): one session, the other answer is 409 "Prezența s-a schimbat între timp. Reîncarcă.", nothing half written. Pinned by Task 4 (`a duplicate occurrence key answers 409 and writes nothing`) and Task 8 (two parallel PUTs).
- **A correction after prices, A.C.S. or abonamente changed**: rows not touched keep their frozen charges and slot, even when their abonament has expired since; a row whose ticks change is repriced at today's list; an unticked Școala row frees its slot. Pinned by Task 4 (`corrections keep frozen rows`, `re-save keeps a slot of an expired abonament`, `untick frees the slot`).
- **A bad tick list**: an unknown or anonymized athlete, the same athlete twice, a tick with neither type, Uscat at a school group, no coach: refused with 400 or ignored as the spec says, never a 500. Pinned by Task 4 (`refuses bad ticks`, `Școala ignores Uscat`).
- **The same athlete twice on one day** (two Școala sessions, or an occurrence moved after its session was saved): each attendance uses its own slot; the saved one stays "În afara programului". Pinned by Task 4 (`two sessions the same day use two slots`) and Task 2 (`a saved session whose date was cancelled stays, outside the schedule`).
- **A lesson undo after it changed, or a paid lesson deleted**: undo of a create is refused after "Salvează" ("Nu se mai poate anula. Datele s-au schimbat între timp."); delete of a paid lesson is refused; delete then undo brings it back with every field. Pinned by Task 6.

---

## File Structure

```
src/club/presence/
  copy/attendance.ts       ATTENDANCE_ERRORS, ATTENDANCE_TOASTS, EXISTING_SESSION, REACTIVATE_DIALOG, LESSON_COPY, CSV_HEADER, sessionSavedToast (T1)
  copy.ts                  + export * from './copy/attendance'; (T1)
  attendance/
    api-types.ts           every response and body type of 09-attendance (T1)
    roster.ts              onDate, rosterOn, mainGroupOn (T1)
    view.ts                savedLine, typesText, shortDay, isDuration, isTime, defaultDuration, outsideFor, presentCounts (T1)
    day.ts                 readDay (T2)
    panel.ts               readSessionPanel, readPanelQuery (T3)
    check.ts               checkNewSession, sessionDefaults (T3)
    save-plan.ts           planRows (T4)
    save.ts                saveSession, readSaveBody (T4)
    http.ts                respondSave (T4)
    group-month.ts         readGroupMonth (T5)
    athlete-month.ts       readAthleteMonth (T5)
  lessons/
    input.ts               readLessonBody, readLessonPatch (T6)
    read.ts                listLessons, readLesson, newLessonDefaults, lessonListState (T6)
    create.ts              createLesson (T6)
    save.ts                saveLesson (T6)
    delete.ts              deleteLesson (T6)
  coaches/
    hours.ts               coachRows, hoursText (T7)
    csv.ts                 coachesCsv, coachesCsvName (T7)
    report.ts              readCoachMonth (T7)
  __tests__/attendance-seed.ts   attendanceSeed, A_* seeds (T1)
  __tests__/attendance-*.test.ts, lessons.test.ts, coaches.test.ts, attendance-routes.test.ts
src/api/club/routes/09-attendance.ts       (T8)
src/api/club/controllers/attendance.ts     (T8)
```

---

### Task 1: Copy, response types, roster and view helpers (low)

**Files:**
- Create: `src/club/presence/copy/attendance.ts`, `src/club/presence/attendance/api-types.ts`, `attendance/roster.ts`, `attendance/view.ts`, `src/club/presence/__tests__/attendance-seed.ts`
- Modify: `src/club/presence/copy.ts` (one line)
- Test: `src/club/presence/__tests__/attendance-view.test.ts`

**Interfaces:**
- Consumes (5-1): `SessionState`, `HeldOccurrence`, `CalendarWindow`, `durationOf`, `isOutsideSchedule`, `longDate`, `listDate`, `PRESENCE_ERRORS`, `fakePresenceContext`, `sessionRow`, `attendanceRow`, `subscriptionRow`, `lessonRow`, `paymentRow`, `P_LISTS`; phase 4 `MembershipRow`, `MONTHS_SHORT`, `athleteRow`, `member`, `G_SEASONS`, `G_TEAM`.
- Produces (`api-types.ts`):

```ts
export type SectionKind = 'school' | 'club';
export type DayRow = {
  sessionId: string | null; occurrenceKey: string | null; groupId: string; groupName: string; date: string; startTime: string;
  coachNames: string[]; present: number; listed: number; visitors: number; state: SessionState | null; outsideSchedule: boolean;
};
export type DayPage = { date: string; today: string; startDate: string | null; groupsWithoutList: number; undone: DayRow[]; day: DayRow[] };
export type PanelRow = {
  athleteId: string; name: string; visitor: boolean; inactive: boolean; mainGroup: string | null; abonament: string | null;
  grup: boolean; uscat: boolean; noSubscription: boolean;
};
export type AddedSession = { groupId: string; date: string; startTime: string; durationMin: number };
export type SessionPanel = {
  sessionId: string | null; occurrenceKey: string | null; added: AddedSession | null; groupId: string; groupName: string; kind: SectionKind;
  date: string; startTime: string; durationMin: number; outsideSchedule: boolean; coachIds: string[]; rows: PanelRow[]; savedLine: string | null; history: string[];
};
export type SavedOnDay = { sessionId: string; startTime: string; present: number; listed: number; savedBy: string };
export type SessionCheck =
  | { kind: 'existing'; sameTime: boolean; saved: SavedOnDay[] }
  | { kind: 'occurrence'; occurrenceKey: string }
  | { kind: 'free'; outsideSchedule: boolean };
export type SessionDefaults = { durationMin: number; coachIds: string[] };
export type Tick = { athleteId: string; grup: boolean; uscat: boolean };
export type SessionSaveBody = {
  id?: string; occurrence?: string; added?: AddedSession; coachIds: string[]; ticks: Tick[]; reactivate: string[]; keepInactive: string[];
};
export type InactiveAthlete = { id: string; name: string };
export type SessionSaved = { sessionId: string; toast: string };
export type GroupMonth = { month: string; rows: DayRow[] };
export type LessonListRow = {
  lessonId: string; date: string; startTime: string; athleteId: string; athleteName: string; coachNames: string[]; durationMin: number;
  state: SessionState; present: boolean | null;
};
export type LessonPanel = {
  lessonId: string; athleteId: string; athleteName: string; date: string; startTime: string; durationMin: number; coachIds: string[];
  state: LessonState; present: boolean | null; savedLine: string | null; deletable: boolean;
};
export type LessonBody = { athleteId: string; date: string; startTime: string; durationMin: number; coachIds: string[] };
export type LessonPatch = { present: boolean; durationMin: number; coachIds: string[] };
export type LessonSaved = { lessonId: string; changed: boolean; toast: string };
export type CoachRow = { coachId: string; name: string; sessions: number; lessons: number; minutes: number; hours: string };
export type AthleteMonthRow = { sessionId: string; date: string; groupName: string; types: string; noSubscription: boolean };
```

- Produces (`roster.ts`): `onDate(m: MembershipRow, date: string): boolean` (`from` null or <= date, `to` null or >= date; 3.9); `rosterOn(ms: MembershipRow[], groupId: string, seasonId: string, date: string): string[]` (athlete ids, unique); `mainGroupOn(ms: MembershipRow[], athleteId: string, seasonId: string, date: string): string | null` (group id of the main membership on that date).
- Produces (`view.ts`): `savedLine(savedBy: string, savedAt: string): string` ("Salvată de <admin>, <longDate> <HH:mm>" in Europe/Bucharest); `typesText(t: { grup: boolean; uscat: boolean }): string`; `shortDay(date: string): string` ("27 oct"); `isTime(v: unknown): v is string`; `isDuration(v: unknown): v is number` (decided 14); `defaultDuration(window: CalendarWindow, groupId: string, date: string): number` (the group's series whose weekday and range cover the date, its `durationOf`, else 50; C20); `outsideFor(s: { source: SessionSource; groupId: string; date: string; startTime: string }, held: HeldOccurrence[]): boolean` (decided 7); `presentCounts(rows: Pick<AttendanceRow, 'athleteId' | 'visitor'>[], listed: string[]): { present: number; visitors: number }` (present = rows of athletes on the list).
- Produces (`copy/attendance.ts`):
  - `ATTENDANCE_ERRORS = { noCoach: 'Alege antrenorul.', inactive: 'Sportiv inactiv' }`.
  - `sessionSavedToast(groupName: string, date: string): string` = "Prezență salvată: <grupă>, <shortDay>.".
  - `EXISTING_SESSION = { title: 'Există deja o ședință salvată', open: 'Deschide prezența salvată', addAnother: 'Adaugă încă o ședință în ziua asta', savedBy: (name: string) => \`Salvată de ${name}\` }`.
  - `REACTIVATE_DIALOG = { title: 'Sportiv inactiv', text: (name: string) => \`${name} are statusul Inactiv. Reactivezi sportivul?\`, keep: 'Salvează fără', reactivate: 'Reactivează și salvează' }`.
  - `LESSON_COPY = { saved: 'Salvat.', unchanged: 'Nicio modificare.', deleted: 'Lecție ștearsă.', deleteLink: 'Șterge lecția', deleteConfirm: (date: string) => \`Ștergi lecția din ${shortDay(date)}?\` }` (decided 12; p5 Q42 gives "Ștergi lecția din 28 oct?").
  - `CSV_HEADER = ['Antrenor', 'Ședințe grup', 'Lecții individuale', 'Ore'] as const`.
  - `shortDay` and `savedLine` are defined in `copy/attendance.ts` (they hold copy) and re-exported by `view.ts`; the copy file imports only `MONTHS_SHORT` (`src/club/groups/dates.ts`), `longDate` (5-1 `dates.ts`) and `ro-count.ts`, never `attendance/*` (no cycle).
- Produces (`__tests__/attendance-seed.ts`): `attendanceSeed(today = '2026-11-20', over?)` = `fakePresenceContext({...}, today)` with:
  - groups (replace `P_GROUPS`): `g-ib` "Intermediari Bronze" (section `afi`, school, order 2, `pl-std`, coaches `['tm-virgil']`); `g-club` "Profesioniști" (section `club`, order 5, `pl-club`, coaches `['tm-andreea', 'tm-virgil']`); `g-nolist` "Performanță" (club, order 6, no list, `['tm-andreea']`); `g-gold` "Avansați Gold" (`afi`, order 4, `pl-gold`, `['tm-virgil']`).
  - athletes: `a1` Ana Ionescu, `a2` Mihai Pop, `a3` Ioana Dinu (status `inactiv`), `a5` David Stan, `a6` Luca Marin, `a7` Irina Neagu, `a9` (status `anonimizat`, name "Sportiv anonimizat").
  - memberships `s26`, main, `from` null: a1, a2, a3 in `g-ib`; a5, a6 in `g-club`; a7 in `g-gold`.
  - A.C.S.: a6 `s26` `da`. Subscriptions: `sub-a1` (a1, `pl-std`, 8 slots, `2026-11-01` to `2026-11-28`, 320, member, purchased `2026-11-01T09:00:00.000Z`); `sub-a7` (a7, `pl-gold`, 8 slots, same dates, 400).
  - calendar: `ev-ib` weekly Saturday and Sunday 11:00 to 11:50 from `2026-10-04`, group `g-ib`; `ev-club` weekly Friday 17:00 to 18:30 from `2026-10-02`, group `g-club`.
  - `startDate: '2026-11-01'`; actor "Ana Admin"; team `tm-virgil` Virgil Pascu, `tm-andreea` Andreea Pascu.
  - Dates used below: 2026-11-13 Friday, 2026-11-14 Saturday, 2026-11-15 Sunday, 2026-11-17 Tuesday, 2026-11-20 Friday (today).

- [ ] **Step 1: Write the failing test** `attendance-view.test.ts`:

```ts
it('membership on a date (3.9)', () => {
  const ms = [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-11-15' }),
    member({ id: 'm2', athleteId: 'a2', groupId: 'g-ib', seasonId: 's26', isMain: true, from: null, to: '2026-11-10' }),
    member({ id: 'm3', athleteId: 'a3', groupId: 'g-ib', seasonId: 's26', isMain: false, from: null })];
  expect(rosterOn(ms, 'g-ib', 's26', '2026-11-14')).toEqual(['a3']);
  expect(rosterOn(ms, 'g-ib', 's26', '2026-11-15')).toEqual(['a1', 'a3']);
  expect(mainGroupOn(ms, 'a1', 's26', '2026-11-20')).toBe('g-ib');
  expect(mainGroupOn(ms, 'a3', 's26', '2026-11-20')).toBeNull();
});
it('saved line in Bucharest time (5.3)', () => {
  expect(savedLine('Ana Admin', '2026-10-27T15:52:00.000Z')).toBe('Salvată de Ana Admin, 27 oct 2026 17:52');
  expect(savedLine('Ana Admin', '2026-07-01T15:52:00.000Z')).toBe('Salvată de Ana Admin, 1 iul 2026 18:52');
});
it('types, toast and dialogs (5.3, 4.22, p5 Q42)', () => {
  expect([typesText({ grup: true, uscat: false }), typesText({ grup: false, uscat: true }), typesText({ grup: true, uscat: true })]).toEqual(['Grup', 'Uscat', 'Grup, Uscat']);
  expect(sessionSavedToast('Intermediari Bronze', '2026-10-27')).toBe('Prezență salvată: Intermediari Bronze, 27 oct.');
  expect(REACTIVATE_DIALOG.text('Ana Ionescu')).toBe('Ana Ionescu are statusul Inactiv. Reactivezi sportivul?');
  expect(LESSON_COPY.deleteConfirm('2026-10-28')).toBe('Ștergi lecția din 28 oct?');
  expect(ATTENDANCE_ERRORS.noCoach).toBe('Alege antrenorul.');
});
it('default duration from the series of that weekday, else 50 (C20)', () => {
  const { state } = attendanceSeed();
  expect(defaultDuration(state.calendar, 'g-club', '2026-11-20')).toBe(90);
  expect(defaultDuration(state.calendar, 'g-ib', '2026-11-14')).toBe(50);
  expect(defaultDuration(state.calendar, 'g-club', '2026-11-17')).toBe(50);
  expect(defaultDuration(state.calendar, 'g-club', '2026-09-25')).toBe(50);
});
it('outside the schedule: added by date, schedule by date and time (decided 7)', () => {
  const held = [{ key: 'ev-ib|2026-11-14|11:00', eventId: 'ev-ib', groupId: 'g-ib', date: '2026-11-14', startTime: '11:00', endTime: '11:50', durationMin: 50 }];
  expect(outsideFor({ source: 'added', groupId: 'g-ib', date: '2026-11-14', startTime: '15:00' }, held)).toBe(false);
  expect(outsideFor({ source: 'added', groupId: 'g-ib', date: '2026-11-17', startTime: '15:00' }, held)).toBe(true);
  expect(outsideFor({ source: 'schedule', groupId: 'g-ib', date: '2026-11-14', startTime: '12:00' }, held)).toBe(true);
});
it('counts present on the list and visitors apart (C42)', () => {
  expect(presentCounts([{ athleteId: 'a1', visitor: false }, { athleteId: 'a7', visitor: true }], ['a1', 'a2', 'a3'])).toEqual({ present: 1, visitors: 1 });
});
it('times and durations', () => {
  expect([isTime('17:00'), isTime('7:00'), isTime('24:00'), isTime(1700)]).toEqual([true, false, false, false]);
  expect([isDuration(50), isDuration(5), isDuration(600), isDuration(52), isDuration(0), isDuration(605), isDuration('50')]).toEqual([true, true, true, false, false, false, false]);
});
```

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/attendance-view.test.ts`; Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the five files and the export line (`export * from './copy/attendance';`). `savedLine` formats with `Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })` and the Bucharest date through `longDate`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS (the 5-1 `copy.test.ts` sees the new file and its export line).
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/copy/attendance.ts src/club/presence/copy.ts src/club/presence/attendance/api-types.ts src/club/presence/attendance/roster.ts src/club/presence/attendance/view.ts src/club/presence/__tests__/attendance-seed.ts src/club/presence/__tests__/attendance-view.test.ts
git commit -m "feat(attendance): copy, response types, roster and view helpers"
```

---

### Task 2: Day page and the undone list (low)

**Files:**
- Create: `src/club/presence/attendance/day.ts`
- Test: `src/club/presence/__tests__/attendance-day.test.ts`

**Interfaces:**
- Consumes: T1 (`DayRow`, `DayPage`, `rosterOn`, `presentCounts`, `outsideFor`); 5-1 `heldOccurrences`, `sessionState`, `seasonOfDate`, `groupsWithoutPriceList`, store reads `calendarWindow`, `attendanceStartDate`, `sessions`, `attendances`, `groups`, `memberships`, `teamMembers`, `seasons`.
- Produces: `readDay(store: PresenceStore, date: unknown, today: string): Promise<AdminResult<DayPage>>` (400 `invalid` for a date that is not ISO). Day rows: the held occurrences of the date plus saved sessions of the date not matched by key, sorted by start time then group `order`; `coachNames` = the session's coaches, or the group's coaches when unsaved, in their order; `state` from `sessionState`; rows with a null state are not listed (3.9). Undone: held occurrences from `startDate` to `today - 1` with no session, newest first (date desc, then start time asc), `[]` when `startDate` is null (3.8). `groupsWithoutList` = `groupsWithoutPriceList(groups)` (4.12, C30).

- [ ] **Step 1: Write the failing test** (seed of T1; a saved session `s14` for `ev-ib|2026-11-14|11:00` with a1 present and a7 as visitor):

```ts
it('lists the day with states, counts and coaches (5.2)', async () => {
  const f = attendanceSeed();
  const page = ok(await readDay(f.store, '2026-11-20', '2026-11-20'));
  expect(page.day.map((r) => [r.startTime, r.groupName, r.coachNames, `${r.present} din ${r.listed}`, r.state]))
    .toEqual([['17:00', 'Profesioniști', ['Andreea Pascu', 'Virgil Pascu'], '0 din 2', 'urmeaza']]);
});
it('a saved session counts its list only; the visitor is apart (C42)', async () => {
  const f = withSaved14(attendanceSeed());
  const r = ok(await readDay(f.store, '2026-11-14', '2026-11-20')).day[0];
  expect([r.sessionId, r.present, r.listed, r.visitors, r.state]).toEqual(['s14', 1, 3, 1, 'salvata']);
});
it('undone list: from the start date to yesterday, newest first, saved ones out (5.2, C41)', async () => {
  const f = withSaved14(attendanceSeed('2026-11-20', { startDate: '2026-11-13' }));
  expect(ok(await readDay(f.store, '2026-11-20', '2026-11-20')).undone.map((r) => r.occurrenceKey))
    .toEqual(['ev-ib|2026-11-15|11:00', 'ev-club|2026-11-13|17:00']);
});
it('no start date: no undone list, the page says so (3.8)', async () => {
  const page = ok(await readDay(attendanceSeed('2026-11-20', { startDate: null }).store, '2026-11-20', '2026-11-20'));
  expect([page.undone, page.startDate]).toEqual([[], null]);
});
it('a saved session whose date was cancelled stays, outside the schedule (4.4, C19)', async () => {
  const f = withSaved14(attendanceSeed());
  cancelDate(f, 'ev-ib', '2026-11-14');
  const day = ok(await readDay(f.store, '2026-11-14', '2026-11-20')).day;
  expect(day.map((r) => [r.sessionId, r.outsideSchedule])).toEqual([['s14', true]]);
});
it('an added session out of the schedule is listed with the flag; the notice counts groups without a list', async () => {
  const f = attendanceSeed();
  f.state.sessions.push(sessionRow({ id: 'sx', groupId: 'g-ib', date: '2026-11-17', startTime: '18:00', source: 'added', eventId: null, occurrenceKey: null }));
  const page = ok(await readDay(f.store, '2026-11-17', '2026-11-20'));
  expect(page.day.map((r) => [r.sessionId, r.outsideSchedule, r.state])).toEqual([['sx', true, 'salvata']]);
  expect(page.groupsWithoutList).toBe(1);
});
it('an empty day and a bad date', async () => {
  const f = attendanceSeed();
  expect(ok(await readDay(f.store, '2026-11-17', '2026-11-20')).day).toEqual([]);
  expect(await readDay(f.store, '2026-13-01', '2026-11-20')).toEqual({ ok: false, status: 400, error: 'Cerere invalidă.' });
});
```

`ok`, `withSaved14` and `cancelDate` are helpers in `attendance-seed.ts` (add them there in this task).

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/attendance-day.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** `readDay` (one `attendances({ sessionIds })` read for the day's sessions, one for the undone range is not needed: undone rows have no session).
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/attendance/day.ts src/club/presence/__tests__/attendance-day.test.ts src/club/presence/__tests__/attendance-seed.ts
git commit -m "feat(attendance): day page and undone sessions"
```

---

### Task 3: Session panel read, "+ Ședință nouă" check and defaults (low)

**Files:**
- Create: `src/club/presence/attendance/panel.ts`, `attendance/check.ts`
- Test: `src/club/presence/__tests__/attendance-panel.test.ts`

**Interfaces:**
- Consumes: T1; 5-1 `readOccurrenceKey`, `heldOccurrences`, `pickSubscription`, `usedSlots`, `remainingOf`, `abonamentStatusText`, `sessionHistoryTexts`, `seasonOfDate`.
- Produces:
  - `PanelQuery = { id: string } | { occurrence: string } | { added: AddedSession }`; `readPanelQuery(q: Record<string, unknown>): PanelQuery | null` (`id`, or `occurrence`, or `group` + `date` + `time` + `duration`).
  - `readSessionPanel(store: PresenceStore, q: PanelQuery, today: string): Promise<AdminResult<SessionPanel>>`. Rows: the group's list on that date (`rosterOn`) sorted by name, then the session's visitors sorted by name; ticks from saved rows (an unsaved session starts empty, p5 Q3); `abonament` (school only) = `abonamentStatusText` of the subscription `pickSubscription` would use on that date for the session group's list, null at Club; `noSubscription` = saved row with billing `fara_abonament`; `mainGroup` (visitors only) = name of `mainGroupOn` in the season of the date; `inactive` = status `inactiv`; anonymized rows show "Sportiv anonimizat" (their stored name). Unsaved: `coachIds` = group's coaches, `durationMin` from the occurrence or `added`. `history` = the session's lines through `sessionHistoryTexts` with athlete and coach names. 404 `notFound` for an unknown id, a key that is not a held occurrence and has no session, or an unknown or inactive group for `added`.
  - `checkNewSession(store: PresenceStore, body: unknown): Promise<AdminResult<SessionCheck>>` (4.5, C21): body `{ groupId, date, startTime }`; saved sessions of the group that date -> `existing` (`sameTime` when one starts at `startTime`; `saved` sorted by time with "x din y" counts and `savedBy`); else a held occurrence at that date and time -> `occurrence`; else `free` with `outsideFor({ source: 'added', ... })`. 400 `invalid` for a missing group, bad date or time; 404 for an unknown or inactive group (p5 Q4: a session always has a group).
  - `sessionDefaults(store: PresenceStore, q: Record<string, unknown>): Promise<AdminResult<SessionDefaults>>` (`group`, `date`): `defaultDuration` and the group's coaches (C17, C20).

- [ ] **Step 1: Write the failing test**

```ts
it('an unsaved Școala occurrence: list by name, empty ticks, abonament status, group coaches (5.3, 4.10)', async () => {
  const f = attendanceSeed();
  f.state.sessions.push(sessionRow({ id: 's7', groupId: 'g-ib', date: '2026-11-07', startTime: '11:00', occurrenceKey: 'ev-ib|2026-11-07|11:00' }));
  f.state.attendances.push(attendanceRow({ id: 't0', sessionId: 's7', athleteId: 'a1', subscriptionId: 'sub-a1', billing: 'slot' }));
  const p = ok(await readSessionPanel(f.store, { occurrence: 'ev-ib|2026-11-15|11:00' }, '2026-11-20'));
  expect([p.groupName, p.kind, p.durationMin, p.coachIds, p.sessionId, p.savedLine]).toEqual(['Intermediari Bronze', 'school', 50, ['tm-virgil'], null, null]);
  expect(p.rows.map((r) => [r.name, r.grup, r.abonament, r.inactive])).toEqual([
    ['Ana Ionescu', false, '7 ședințe rămase', false], ['Ioana Dinu', false, 'Fără abonament', true], ['Mihai Pop', false, 'Fără abonament', false]]);
});
it('a saved Club session: ticks, visitor with main group last, saved line, Istoric (5.3, 4.7, C69)', async () => {
  const f = withSavedClub(attendanceSeed());   // s13 on 2026-11-13 17:00: a5 grup+uscat, a7 visitor grup, saved by Ana Admin at 2026-11-13T16:05:00.000Z
  const p = ok(await readSessionPanel(f.store, { id: 's13' }, '2026-11-20'));
  expect(p.rows.map((r) => [r.name, r.grup, r.uscat, r.visitor, r.mainGroup, r.abonament])).toEqual([
    ['David Stan', true, true, false, null, null], ['Luca Marin', false, false, false, null, null], ['Irina Neagu', true, false, true, 'Avansați Gold', null]]);
  expect(p.savedLine).toBe('Salvată de Ana Admin, 13 nov 2026 18:05');
  expect(p.history).toEqual(['Prezență salvată: 2 din 2, antrenor Andreea Pascu.']);
});
it('an added session not saved yet; unknown targets answer 404', async () => {
  const f = attendanceSeed();
  const p = ok(await readSessionPanel(f.store, { added: { groupId: 'g-ib', date: '2026-11-17', startTime: '18:00', durationMin: 60 } }, '2026-11-20'));
  expect([p.outsideSchedule, p.durationMin, p.rows.length]).toEqual([true, 60, 3]);
  expect((await readSessionPanel(f.store, { occurrence: 'ev-ib|2026-11-17|11:00' }, '2026-11-20')).ok).toBe(false);
  expect(await readSessionPanel(f.store, { id: 'nope' }, '2026-11-20')).toEqual({ ok: false, status: 404, error: 'Nu a fost găsit.' });
});
it('"+ Ședință nouă" check (4.5, C21, p5 Q5)', async () => {
  const f = withSaved14(attendanceSeed());
  expect(ok(await checkNewSession(f.store, { groupId: 'g-ib', date: '2026-11-15', startTime: '11:00' }))).toEqual({ kind: 'occurrence', occurrenceKey: 'ev-ib|2026-11-15|11:00' });
  expect(ok(await checkNewSession(f.store, { groupId: 'g-ib', date: '2026-11-14', startTime: '15:00' })))
    .toEqual({ kind: 'existing', sameTime: false, saved: [{ sessionId: 's14', startTime: '11:00', present: 1, listed: 3, savedBy: 'Ana Admin' }] });
  expect(ok(await checkNewSession(f.store, { groupId: 'g-ib', date: '2026-11-14', startTime: '11:00' }))).toMatchObject({ kind: 'existing', sameTime: true });
  expect(ok(await checkNewSession(f.store, { groupId: 'g-ib', date: '2026-11-17', startTime: '18:00' }))).toEqual({ kind: 'free', outsideSchedule: true });
  expect(ok(await checkNewSession(f.store, { groupId: 'g-ib', date: '2026-11-21', startTime: '15:00' }))).toEqual({ kind: 'free', outsideSchedule: false });
  expect((await checkNewSession(f.store, { date: '2026-11-17', startTime: '18:00' })).ok).toBe(false);
});
it('defaults for the new session window (C17, C20)', async () => {
  const f = attendanceSeed();
  expect(ok(await sessionDefaults(f.store, { group: 'g-club', date: '2026-11-20' }))).toEqual({ durationMin: 90, coachIds: ['tm-andreea', 'tm-virgil'] });
  expect(ok(await sessionDefaults(f.store, { group: 'g-club', date: '2026-11-17' }))).toEqual({ durationMin: 50, coachIds: ['tm-andreea', 'tm-virgil'] });
});
it('reads the panel query', () => {
  expect(readPanelQuery({ occurrence: 'ev-ib|2026-11-15|11:00' })).toEqual({ occurrence: 'ev-ib|2026-11-15|11:00' });
  expect(readPanelQuery({ group: 'g-ib', date: '2026-11-17', time: '18:00', duration: '60' })).toEqual({ added: { groupId: 'g-ib', date: '2026-11-17', startTime: '18:00', durationMin: 60 } });
  expect(readPanelQuery({ group: 'g-ib', date: '2026-11-17', time: '18:00', duration: '52' })).toBeNull();
  expect(readPanelQuery({})).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/attendance-panel.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** `panel.ts` and `check.ts` (`withSavedClub` joins the seed helpers).
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/attendance/panel.ts src/club/presence/attendance/check.ts src/club/presence/__tests__/attendance-panel.test.ts src/club/presence/__tests__/attendance-seed.ts
git commit -m "feat(attendance): session panel read, new session check and defaults"
```

---

### Task 4: Session save (high)

**Files:**
- Create: `src/club/presence/attendance/save-plan.ts`, `attendance/save.ts`, `attendance/http.ts`
- Test: `src/club/presence/__tests__/attendance-save-plan.test.ts`, `src/club/presence/__tests__/attendance-save.test.ts`

**Interfaces:**
- Consumes: T1, T3 (`readSessionPanel` is not called; the roster and checks are re-read under the locks); 5-1 `occurrenceKey`, `readOccurrenceKey`, `attendanceKey`, `heldOccurrences`, `durationOf`, `seasonOfDate`, `slotCandidates`, `pickSubscription`, `usedSlots`, `clubCharges`, `audienceFor`, `UniqueKeyError`, `recordPresenceLines`, `P5_ACTIONS`, `SUBJECT`, `PRESENCE_ERRORS`; P3 `HISTORY_ACTIONS.reactivated`; phase 4 `done`, `ActionResult`, `Line`.
- Produces:
  - `RowPlan = { creates: AttendanceWrite[]; updates: { id: string; data: Partial<AttendanceWrite> }[]; deletes: string[]; added: string[]; removed: string[]; uscatTicked: string[]; newVisitors: string[] }`.
  - `planRows(i: { sessionId: string; kind: SectionKind; listed: string[]; existing: AttendanceRow[]; ticks: Tick[]; list: PriceListRecord | null; subs: SubscriptionRow[]; used: Map<string, number>; date: string; audience: (athleteId: string) => Audience }): RowPlan` (pure). Per athlete:
    - nothing ticked (school: `grup` false; club: both false) and a row exists -> delete (slot freed, C25), `removed`;
    - ticked, no row -> create: `visitor` = not in `listed`; school: `billing` `slot` with the candidate of `pickSubscription(subs of the athlete, used, list id, date)` (the map updated after each pick so two rows never take one last slot), else `fara_abonament`, `charges` `[]`, `amount` 0, `uscat` false (decided 4); club: `clubCharges(list, ticks, audience)`; `added`; `newVisitors` when visitor;
    - ticked, row exists, ticks unchanged -> nothing (frozen, C29); school row keeps its slot even when its abonament expired since (C25);
    - club row, ticks changed -> update with `clubCharges` at today's list (C29); `uscatTicked` when `uscat` went false -> true.
  - `readSaveBody(body: unknown): SessionSaveBody | null` (exactly one of `id`, `occurrence`, `added`; `ticks` an array of `{ athleteId: string; grup: boolean; uscat: boolean }`; `reactivate`, `keepInactive` default `[]`; ids are strings).
  - `SaveOutcome = ActionResult<SessionSaved> | { ok: false; status: 409; error: string; inactive: InactiveAthlete[] }`.
  - `saveSession(ctx: PresenceContext, body: unknown): Promise<SaveOutcome>`.
  - `respondSave(ctx: AdminCtx, outcome: SaveOutcome): void` (decided 2; otherwise `respondAction`).

Algorithm of `saveSession` (the order matters; the signature and tests do not fix it):

```
1. readSaveBody; null, a duplicate athleteId, coachIds empty ("Alege antrenorul.", 400) or an unknown coach -> 400.
2. Resolve the target outside the transaction (validation only): id -> session (404 if none);
   occurrence -> sessionByKey(key) ?? held occurrence of that key (404 if neither);
   added -> active group, ISO date, isTime, isDuration (400 / 404).
   season = seasonOfDate(seasons, date) ?? 400 invalid (decided 8).
3. guarded(ctx.log, '[attendance] save <target>', () => store.transaction(async () => {
   a. sessionId known -> lockSession(sessionId); re-read the session (an occurrence key may now have a session: use it).
   b. athletes = sorted unique (existing rows' athletes + ticked); lockAthlete each; re-read athletes.
      Any ticked athlete unknown or anonymized -> 400 invalid.
   c. Newly ticked athletes with status inactiv not in reactivate or keepInactive -> return the 409 outcome (decided 3).
   d. School: subs = subscriptions of the ticked athletes; lockSubscription each candidate (sorted); used = usedSlots(attendances({ subscriptionIds })).
   e. Create the session when missing (catch UniqueKeyError -> 409 conflict); planRows; apply deletes, updates, creates in that order.
   f. reactivate: setAthleteStatus(id, 'activ') + athlete line HISTORY_ACTIONS.reactivated.
   g. Nothing planned, coaches unchanged, not new, nothing reactivated -> done({ sessionId, toast }, null) without writes (decided 5).
   h. updateSession: coachIds, savedBy = actor, savedAt = now (firstSavedAt only at create).
   i. Lines: first save -> session-saved { present: every row after the save, listed, coachIds } (decided 6);
      later -> session-corrected { added, removed, uscat } when any part is non-empty; session-coaches { from, to } when coaches changed;
      visitor-present { groupName, date } on each new visitor (subject athlete).
   j. done({ sessionId, toast: sessionSavedToast(groupName, date) }, null)   // no undo (C46)
}))
```

- [ ] **Step 1: Write the failing tests**

`attendance-save-plan.test.ts` (pure, rows and subs built with the 5-1 builders):

```ts
const base = { sessionId: 's1', listed: ['a1', 'a2'], date: '2026-11-14', audience: () => 'nonMember' as const, used: new Map<string, number>() };
it('Școala: slot when valid, else Fără abonament; Uscat ignored (4.10, decided 4)', () => {
  const p = planRows({ ...base, kind: 'school', list: list('pl-std'), existing: [], subs: [subscriptionRow({ id: 'sub-a1', athleteId: 'a1', startsOn: '2026-11-01', validUntil: '2026-11-28' })],
    ticks: [{ athleteId: 'a1', grup: true, uscat: true }, { athleteId: 'a2', grup: true, uscat: false }, { athleteId: 'a3', grup: false, uscat: true }] });
  expect(p.creates.map((c) => [c.athleteId, c.billing, c.subscriptionId, c.uscat, c.uniqueKey, c.visitor])).toEqual([
    ['a1', 'slot', 'sub-a1', false, 's1|a1', false], ['a2', 'fara_abonament', null, false, 's1|a2', false]]);
});
it('the last slot is used once (4.8)', () => {
  const sub = subscriptionRow({ id: 'sub-a1', athleteId: 'a1', slots: 8, startsOn: '2026-11-01', validUntil: '2026-11-28' });
  const p = planRows({ ...base, kind: 'school', list: list('pl-std'), existing: [], subs: [sub], used: new Map([['sub-a1', 8]]), ticks: [{ athleteId: 'a1', grup: true, uscat: false }] });
  expect(p.creates[0].billing).toBe('fara_abonament');
});
it('Club: priced on create, frozen when unchanged, repriced when ticks change (4.12, C29)', () => {
  const kept = attendanceRow({ id: 't5', sessionId: 's1', athleteId: 'a1', grup: true, uscat: false, billing: 'club', amount: 50,
    charges: [{ type: 'grup', itemName: 'Ședință grup', price: 50, included: false }] });
  const changed = attendanceRow({ id: 't6', sessionId: 's1', athleteId: 'a2', grup: true, uscat: false, billing: 'club', amount: 50 });
  const p = planRows({ ...base, kind: 'club', list: list('pl-club'), existing: [kept, changed], subs: [],
    ticks: [{ athleteId: 'a1', grup: true, uscat: false }, { athleteId: 'a2', grup: true, uscat: true }] });
  expect(p.updates).toEqual([{ id: 't6', data: expect.objectContaining({ uscat: true, billing: 'club', amount: 75 }) }]);
  expect([p.creates, p.deletes, p.uscatTicked]).toEqual([[], [], ['a2']]);
});
it('untick deletes the row and frees its slot; a re-save keeps a slot of an expired abonament (C25)', () => {
  const row = attendanceRow({ id: 't1', sessionId: 's1', athleteId: 'a1', subscriptionId: 'sub-old', billing: 'slot' });
  const kept = planRows({ ...base, kind: 'school', list: list('pl-std'), existing: [row], subs: [], ticks: [{ athleteId: 'a1', grup: true, uscat: false }] });
  expect([kept.creates, kept.updates, kept.deletes]).toEqual([[], [], []]);
  const off = planRows({ ...base, kind: 'school', list: list('pl-std'), existing: [row], subs: [], ticks: [] });
  expect([off.deletes, off.removed]).toEqual([['t1'], ['a1']]);
});
it('a visitor in a Club group pays the visited group's prices (4.7, p5 Q16)', () => {
  const p = planRows({ ...base, kind: 'club', list: list('pl-club'), existing: [], subs: [], audience: () => 'member', ticks: [{ athleteId: 'a7', grup: true, uscat: false }] });
  expect(p.creates[0]).toMatchObject({ visitor: true, billing: 'club', amount: 40, audience: 'member' });
  expect(p.newVisitors).toEqual(['a7']);
});
it('a group without a price list records presence, bills nothing (4.12)', () => {
  expect(planRows({ ...base, kind: 'club', list: null, existing: [], subs: [], ticks: [{ athleteId: 'a1', grup: true, uscat: true }] }).creates[0])
    .toMatchObject({ billing: 'fara_pret', charges: [], amount: 0, grup: true, uscat: true });
});
```

`attendance-save.test.ts` (seed of T1, today `2026-11-20`):

```ts
const save = (f: Seed, body: object) => saveSession(f.ctx, { coachIds: ['tm-virgil'], reactivate: [], keepInactive: [], ...body });
const grup = (athleteId: string) => ({ athleteId, grup: true, uscat: false });

it('first save of a Școala occurrence: session, slots, line, toast, no undo (4.4, 4.10, 8, C46)', async () => {
  const f = attendanceSeed();
  const r = await save(f, { occurrence: 'ev-ib|2026-11-14|11:00', ticks: [grup('a1'), grup('a2')] });
  expect(r).toEqual({ ok: true, data: { value: { sessionId: expect.any(String), toast: 'Prezență salvată: Intermediari Bronze, 14 nov.' }, actionId: null } });
  expect(f.state.sessions[0]).toMatchObject({ groupId: 'g-ib', seasonId: 's26', date: '2026-11-14', startTime: '11:00', durationMin: 50, source: 'schedule',
    eventId: 'ev-ib', occurrenceKey: 'ev-ib|2026-11-14|11:00', outsideSchedule: false, coachIds: ['tm-virgil'], savedBy: 'Ana Admin' });
  expect(f.state.attendances.map((a) => [a.athleteId, a.billing, a.subscriptionId])).toEqual([['a1', 'slot', 'sub-a1'], ['a2', 'fara_abonament', null]]);
  expect(sessionLines(f)).toEqual(['Prezență salvată: 2 din 3, antrenor Virgil Pascu.']);
});
it('Club save at member and non-member prices; correction lines (4.12, 4.13, 8)', async () => {
  const f = attendanceSeed();
  const r = ok(await save(f, { occurrence: 'ev-club|2026-11-13|17:00', ticks: [{ athleteId: 'a5', grup: true, uscat: true }, grup('a6')] }));
  expect(f.state.attendances.map((a) => [a.athleteId, a.audience, a.amount])).toEqual([['a5', 'nonMember', 75], ['a6', 'member', 40]]);
  setPrice(f, 'pl-club', 'Ședință grup', { nonMemberPrice: 60 });
  await save(f, { id: r.sessionId, coachIds: ['tm-virgil', 'tm-andreea'], ticks: [{ athleteId: 'a5', grup: true, uscat: true }, { athleteId: 'a6', grup: true, uscat: true }] });
  expect(f.state.attendances.find((a) => a.athleteId === 'a5')?.amount).toBe(75);
  expect(f.state.attendances.find((a) => a.athleteId === 'a6')?.amount).toBe(60);
  expect(sessionLines(f).slice(1)).toEqual(['Prezență corectată. Uscat bifat: Luca Marin.', 'Antrenori: "Virgil Pascu" → "Virgil Pascu, Andreea Pascu"']);
});
it('untick frees the slot; a save with no change writes nothing (C25, decided 5)', async () => {
  const f = attendanceSeed();
  const id = ok(await save(f, { occurrence: 'ev-ib|2026-11-14|11:00', ticks: [grup('a1')] })).sessionId;
  const before = f.group.history.length;
  await save(f, { id, ticks: [grup('a1')] });
  expect(f.group.history.length).toBe(before);
  await save(f, { id, ticks: [] });
  expect(f.state.attendances).toEqual([]);
  expect(sessionLines(f).at(-1)).toBe('Prezență corectată. Sportiv scos: Ana Ionescu.');
  expect(f.state.sessions).toHaveLength(1);   // a saved session with 0 present stays (C3)
});
it('two sessions the same day use two slots (4.8)', async () => {
  const f = attendanceSeed();
  await save(f, { occurrence: 'ev-ib|2026-11-14|11:00', ticks: [grup('a1')] });
  await save(f, { added: { groupId: 'g-ib', date: '2026-11-14', startTime: '15:00', durationMin: 50 }, ticks: [grup('a1')] });
  expect(f.state.attendances.map((a) => a.subscriptionId)).toEqual(['sub-a1', 'sub-a1']);
  expect(f.state.sessions[1]).toMatchObject({ source: 'added', eventId: null, occurrenceKey: null, outsideSchedule: false });
});
it('a visitor: flagged, own abonament only when valid for the list, athlete line (4.7, p5 Q16)', async () => {
  const f = attendanceSeed();
  await save(f, { occurrence: 'ev-ib|2026-11-14|11:00', ticks: [grup('a7')] });
  expect(f.state.attendances[0]).toMatchObject({ athleteId: 'a7', visitor: true, billing: 'fara_abonament' });
  expect(athleteLines(f, 'a7')).toEqual(['Prezent la Intermediari Bronze, 14 nov 2026, doar la ședința asta.']);
});
it('an inactive athlete: 409 with the list, then reactivate or keep (4.22)', async () => {
  const f = attendanceSeed();
  const body = { occurrence: 'ev-ib|2026-11-14|11:00', ticks: [grup('a3')] };
  expect(await save(f, body)).toEqual({ ok: false, status: 409, error: 'Sportiv inactiv', inactive: [{ id: 'a3', name: 'Ioana Dinu' }] });
  expect([f.state.sessions, f.state.attendances]).toEqual([[], []]);
  ok(await save(f, { ...body, reactivate: ['a3'] }));
  expect(f.group.athletes.find((a) => a.id === 'a3')?.status).toBe('activ');
  expect(athleteLines(f, 'a3')).toContain('Reactivat');
  const g = attendanceSeed();
  ok(await save(g, { ...body, keepInactive: ['a3'] }));
  expect(g.group.athletes.find((a) => a.id === 'a3')?.status).toBe('inactiv');
});
it('refuses bad ticks, no coach, no season (5.3, decided 8)', async () => {
  const f = attendanceSeed();
  const o = { occurrence: 'ev-ib|2026-11-14|11:00' };
  expect(await save(f, { ...o, coachIds: [], ticks: [grup('a1')] })).toEqual({ ok: false, status: 400, error: 'Alege antrenorul.' });
  for (const ticks of [[grup('a9')], [grup('nope')], [grup('a1'), grup('a1')], [{ athleteId: 'a1', grup: 'da' }]])
    expect((await save(f, { ...o, ticks })).ok, JSON.stringify(ticks)).toBe(false);
  expect((await save(f, { added: { groupId: 'g-ib', date: '2024-01-06', startTime: '11:00', durationMin: 50 }, ticks: [] })).ok).toBe(false);
  expect((await save(f, { added: { groupId: 'g-ib', date: '2026-11-17', startTime: '11:00', durationMin: 3 }, ticks: [] })).ok).toBe(false);
  expect(f.state.sessions).toEqual([]);
});
it('a duplicate occurrence key answers 409 and writes nothing (3.10)', async () => {
  const f = attendanceSeed();
  f.store.createSession = async () => { throw new UniqueKeyError('dup'); };
  expect(await save(f, { occurrence: 'ev-ib|2026-11-14|11:00', ticks: [grup('a1')] })).toEqual({ ok: false, status: 409, error: 'Prezența s-a schimbat între timp. Reîncarcă.' });
  expect(f.state.attendances).toEqual([]);
});
it('an occurrence saved meanwhile is corrected, not duplicated', async () => {
  const f = withSaved14(attendanceSeed());
  ok(await save(f, { occurrence: 'ev-ib|2026-11-14|11:00', ticks: [grup('a1'), grup('a2')] }));
  expect(f.state.sessions.filter((s) => s.occurrenceKey === 'ev-ib|2026-11-14|11:00')).toHaveLength(1);
});
it('rolls back on a failure (7.2)', async () => {
  const f = attendanceSeed();
  f.failOn('createAttendance');
  expect(await save(f, { occurrence: 'ev-ib|2026-11-14|11:00', ticks: [grup('a1')] })).toEqual({ ok: false, status: 500, error: 'Acțiunea nu a reușit. Nimic nu a fost salvat.' });
  expect(f.state.sessions).toEqual([]);
});
it('locks the session, then athletes, then subscriptions (7.1)', async () => {
  const f = withSaved14(attendanceSeed());
  await save(f, { id: 's14', ticks: [grup('a2'), grup('a1')] });
  expect(f.group.locks).toEqual(['session:s14', 'athlete:a1', 'athlete:a2', 'athlete:a7', 'subscription:sub-a1']);
});
it('answers the inactive 409 with details (decided 2)', () => {
  const ctx = fakeCtx();
  respondSave(ctx, { ok: false, status: 409, error: 'Sportiv inactiv', inactive: [{ id: 'a3', name: 'Ioana Dinu' }] });
  expect([ctx.status, ctx.body]).toEqual([409, { data: null, error: { status: 409, name: 'ClubAdminError', message: 'Sportiv inactiv', details: { inactive: [{ id: 'a3', name: 'Ioana Dinu' }] } } }]);
});
```

`sessionLines`, `athleteLines` (texts through `sessionHistoryTexts` / `phase5Lines` and the P3 `historyTexts`), `setPrice`, `fakeCtx` join the seed helpers.

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/presence/__tests__/attendance-save-plan.test.ts src/club/presence/__tests__/attendance-save.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** `save-plan.ts`, `save.ts` (split steps a to i into helpers under 30 lines), `http.ts`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/attendance/save-plan.ts src/club/presence/attendance/save.ts src/club/presence/attendance/http.ts src/club/presence/__tests__/attendance-save-plan.test.ts src/club/presence/__tests__/attendance-save.test.ts src/club/presence/__tests__/attendance-seed.ts
git commit -m "feat(attendance): session save with slots, Club prices, visitors and reactivation"
```

---

### Task 5: Group tab list and the athlete's month (low)

**Files:**
- Create: `src/club/presence/attendance/group-month.ts`, `attendance/athlete-month.ts`
- Test: `src/club/presence/__tests__/attendance-month.test.ts`

**Interfaces:**
- Consumes: T1, T2's row builder (export `dayRow(...)` from `day.ts` if it keeps both files short; else a shared `rows.ts` in this folder), 5-1 `isMonth`, `monthRange`.
- Produces:
  - `readGroupMonth(store: PresenceStore, groupId: string, month: unknown, today: string): Promise<AdminResult<GroupMonth>>` (5.6): held occurrences of the group in the month plus its saved sessions in the month, newest first (date desc, then start time desc); `present` / `listed` / `visitors` as T2; `state` null for an unsaved past date outside the start date rule, row kept (decided 10). 404 unknown group, 400 bad month.
  - `readAthleteMonth(store: PresenceStore, athleteId: string, month: unknown): Promise<AdminResult<AthleteMonthRow[]>>` (5.7 "Prezențe"): the athlete's attendances whose session date is in the month, newest first; `types` = `typesText`; `noSubscription` = billing `fara_abonament` (C54). 404 unknown athlete.

- [ ] **Step 1: Write the failing test**

```ts
it('the group tab lists the month newest first with counts and visitors (5.6)', async () => {
  const f = withSaved14(attendanceSeed());
  const m = ok(await readGroupMonth(f.store, 'g-ib', '2026-11', '2026-11-20'));
  expect(m.rows.map((r) => [r.date, r.state])).toEqual([
    ['2026-11-29', 'urmeaza'], ['2026-11-28', 'urmeaza'], ['2026-11-22', 'urmeaza'], ['2026-11-21', 'urmeaza'], ['2026-11-15', 'nefacuta'],
    ['2026-11-14', 'salvata'], ['2026-11-08', 'nefacuta'], ['2026-11-07', 'nefacuta'], ['2026-11-01', 'nefacuta']]);
  const r14 = m.rows.find((r) => r.date === '2026-11-14')!;
  expect([r14.present, r14.listed, r14.visitors]).toEqual([1, 3, 1]);
});
it('dates before the start date are listed without a state (decided 10)', async () => {
  const m = ok(await readGroupMonth(attendanceSeed().store, 'g-ib', '2026-10', '2026-11-20'));
  expect(m.rows.map((r) => r.date)).toEqual(['2026-10-31', '2026-10-25', '2026-10-24', '2026-10-18', '2026-10-17', '2026-10-11', '2026-10-10', '2026-10-04']);
  expect(m.rows.every((r) => r.state === null)).toBe(true);
});
it('an empty month, a bad month, an unknown group', async () => {
  const f = attendanceSeed();
  expect(ok(await readGroupMonth(f.store, 'g-ib', '2026-09', '2026-11-20')).rows).toEqual([]);
  expect((await readGroupMonth(f.store, 'g-ib', '2026-9', '2026-11-20')).ok).toBe(false);
  expect(await readGroupMonth(f.store, 'nope', '2026-11', '2026-11-20')).toEqual({ ok: false, status: 404, error: 'Nu a fost găsit.' });
});
it("the athlete's month: newest first, types, uncovered Școala rows (5.7, C54)", async () => {
  const f = attendanceSeed();
  await saveSession(f.ctx, { occurrence: 'ev-ib|2026-11-14|11:00', coachIds: ['tm-virgil'], ticks: [{ athleteId: 'a2', grup: true, uscat: false }], reactivate: [], keepInactive: [] });
  await saveSession(f.ctx, { occurrence: 'ev-ib|2026-11-15|11:00', coachIds: ['tm-virgil'], ticks: [{ athleteId: 'a2', grup: true, uscat: false }], reactivate: [], keepInactive: [] });
  expect(ok(await readAthleteMonth(f.store, 'a2', '2026-11')).map((r) => [r.date, r.groupName, r.types, r.noSubscription]))
    .toEqual([['2026-11-15', 'Intermediari Bronze', 'Grup', true], ['2026-11-14', 'Intermediari Bronze', 'Grup', true]]);
  expect(ok(await readAthleteMonth(f.store, 'a2', '2026-10'))).toEqual([]);
});
```

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/attendance-month.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the two files.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/attendance/group-month.ts src/club/presence/attendance/athlete-month.ts src/club/presence/attendance/day.ts src/club/presence/__tests__/attendance-month.test.ts
git commit -m "feat(attendance): group tab month list and athlete month attendance"
```

---

### Task 6: Individual lessons (high)

**Files:**
- Create: `src/club/presence/lessons/input.ts`, `lessons/read.ts`, `lessons/create.ts`, `lessons/save.ts`, `lessons/delete.ts`
- Test: `src/club/presence/__tests__/lessons.test.ts`

**Interfaces:**
- Consumes: T1 (`LessonBody`, `LessonPatch`, `LessonListRow`, `LessonPanel`, `LessonSaved`, `mainGroupOn`, `savedLine`, `isTime`, `isDuration`, `LESSON_COPY`, `ATTENDANCE_ERRORS`); 5-1 `lessonPrice`, `audienceFor`, `seasonOfDate`, `sessionState`, `recordPresenceAction`, `recordPresenceLines`, `guardOf`, `P5_ACTIONS`, `SUBJECT.lesson`, `LESSON_FIELD_LABELS` keys, `undoPresenceAction` (tests).
- Produces:
  - `readLessonBody(body: unknown): LessonBody | null`; `readLessonPatch(body: unknown): LessonPatch | null` (`present` boolean, `durationMin` by `isDuration`, `coachIds` string array).
  - `lessonListState(l: LessonRow, today: string): SessionState` (`saved` -> `salvata`; planned, date >= today -> `urmeaza`; planned, earlier -> `nefacuta`; 5.2).
  - `listLessons(store, month: unknown, today: string): Promise<AdminResult<LessonListRow[]>>` (sorted by date, then time).
  - `readLesson(store, id: string): Promise<AdminResult<LessonPanel>>` (`deletable` = no non-cancelled payment with this `lessonId`; C49).
  - `newLessonDefaults(store, q: Record<string, unknown>): Promise<AdminResult<{ coachIds: string[] }>>` (`athlete`, `date`: the first coach of the athlete's main group on that date, else `[]`; C17).
  - `createLesson(ctx, body: unknown): Promise<ActionResult<LessonSaved>>` (5.5, C47): date > today -> `planned`, `present` null, no price; else `saved`, `present` true, snapshot (decided below); lines `lesson-planned` and, when held, `lesson-saved { present: true }` (decided 11); undo `{ steps: [{ op: 'deleteLesson', id }], athletes: [athleteId], guards: [guardOf(store, 'lesson', id)] }`; toast "Salvat.".
  - `saveLesson(ctx, id: string, body: unknown): Promise<ActionResult<LessonSaved>>` (no undo): sets `state` `saved`, `present`, `savedBy`, `savedAt`; the price snapshot is taken when `present` becomes true and the lesson has no `itemName` and no `price` yet (C73), never re-taken; `present` false -> `amount` 0 (C48); `amount` = `price` when present and priced; lines `lesson-saved` when state or `present` changed, `lesson-edited { fields }` for `durationMin` and `coaches` (names, decided 11); no change -> `{ changed: false, toast: 'Nicio modificare.' }` and no write.
  - `deleteLesson(ctx, id: string): Promise<ActionResult<{ deleted: true; toast: string }>>`: 409 `stale` when paid (decided 13); deletes, line `lesson-deleted`, undo `{ steps: [{ op: 'createLesson', row: <every LessonWrite field> }], athletes: [athleteId], guards: [] }`; toast "Lecție ștearsă.".
  - Snapshot: main group of the athlete on the lesson date (`mainGroupOn` in `seasonOfDate`), its `priceListId`, `lessonPrice(list, audienceFor(acs, athleteId, season))`; no group or list -> `priceListId` null, `itemName` null, `price` null.
  - Validation: `readLessonBody` null, anonymized or unknown athlete, unknown coach -> 400 `invalid`; `coachIds` empty -> 400 "Alege antrenorul.". Locks: athlete, then lesson (7.1).

- [ ] **Step 1: Write the failing test**

```ts
const body = (over: object = {}) => ({ athleteId: 'a5', date: '2026-11-25', startTime: '18:00', durationMin: 50, coachIds: ['tm-virgil'], ...over });
it('a future lesson is planned, with its line and an undo (5.5, 8, 7.3)', async () => {
  const f = attendanceSeed();
  const r = await createLesson(f.ctx, body());
  expect(r).toEqual({ ok: true, data: { value: { lessonId: expect.any(String), changed: true, toast: 'Salvat.' }, actionId: expect.any(String) } });
  expect(f.state.lessons[0]).toMatchObject({ state: 'planned', present: null, price: null, amount: 0, createdByName: 'Ana Admin', durationMin: 50 });
  expect(lessonLines(f)).toEqual(['Lecție programată: 25 nov 2026, 18:00, 50 min.']);
  expect(ok(await undoPresenceAction(f.ctx, { actionId: ok(r).actionId }))).toEqual({ undone: true });
  expect(f.state.lessons).toEqual([]);
});
it('a lesson today is held and priced from the main group list (C47, 5.5, 4.13)', async () => {
  const f = attendanceSeed();
  await createLesson(f.ctx, body({ date: '2026-11-20' }));
  expect(f.state.lessons[0]).toMatchObject({ state: 'saved', present: true, priceListId: 'pl-club', itemName: 'Lecție individuală', price: 100, audience: 'nonMember', amount: 100, savedBy: 'Ana Admin' });
  expect(lessonLines(f)).toEqual(['Lecție programată: 20 nov 2026, 18:00, 50 min.', 'Lecție salvată: prezent.']);
  await createLesson(f.ctx, body({ athleteId: 'a6', date: '2026-11-20' }));
  expect(f.state.lessons[1]).toMatchObject({ audience: 'member', price: 80, amount: 80 });
});
it('no individual item in the list: no price (p5 Q27)', async () => {
  const f = attendanceSeed();
  await createLesson(f.ctx, body({ athleteId: 'a1', date: '2026-11-20' }));
  expect(f.state.lessons[0]).toMatchObject({ present: true, priceListId: 'pl-std', itemName: null, price: null, amount: 0 });
});
it('saved absent, then present: priced then, never re-priced (C48, C73)', async () => {
  const f = attendanceSeed();
  const id = ok(await createLesson(f.ctx, body())).value.lessonId;
  ok(await saveLesson(f.ctx, id, { present: false, durationMin: 50, coachIds: ['tm-virgil'] }));
  expect(f.state.lessons[0]).toMatchObject({ state: 'saved', present: false, price: null, amount: 0 });
  ok(await saveLesson(f.ctx, id, { present: true, durationMin: 60, coachIds: ['tm-virgil', 'tm-andreea'] }));
  expect(f.state.lessons[0]).toMatchObject({ present: true, price: 100, amount: 100, durationMin: 60 });
  setPrice(f, 'pl-club', 'Lecție individuală', { nonMemberPrice: 120 });
  ok(await saveLesson(f.ctx, id, { present: true, durationMin: 50, coachIds: ['tm-virgil', 'tm-andreea'] }));
  expect(f.state.lessons[0].price).toBe(100);
  expect(lessonLines(f).slice(1)).toEqual(['Lecție salvată: absent.', 'Lecție salvată: prezent.', 'Durată: "50 min" → "60 min"',
    'Antrenor: "Virgil Pascu" → "Virgil Pascu, Andreea Pascu"', 'Durată: "60 min" → "50 min"']);
  expect(ok(await saveLesson(f.ctx, id, { present: true, durationMin: 50, coachIds: ['tm-virgil', 'tm-andreea'] })).value).toMatchObject({ changed: false, toast: 'Nicio modificare.' });
});
it('the undo of a create is refused after a save (7.3)', async () => {
  const f = attendanceSeed();
  const r = ok(await createLesson(f.ctx, body()));
  ok(await saveLesson(f.ctx, r.value.lessonId, { present: true, durationMin: 50, coachIds: ['tm-virgil'] }));
  expect(await undoPresenceAction(f.ctx, { actionId: r.actionId })).toEqual({ ok: false, status: 409, error: 'Nu se mai poate anula. Datele s-au schimbat între timp.' });
});
it('delete with undo; a paid lesson is not deleted (C49, decided 13)', async () => {
  const f = attendanceSeed();
  const id = ok(await createLesson(f.ctx, body({ date: '2026-11-20' }))).value.lessonId;
  const before = { ...f.state.lessons[0] };
  const d = await deleteLesson(f.ctx, id);
  expect(ok(d).value).toEqual({ deleted: true, toast: 'Lecție ștearsă.' });
  ok(await undoPresenceAction(f.ctx, { actionId: ok(d).actionId }));
  const { id: _old, ...fields } = before;
  expect(f.state.lessons[0]).toMatchObject(fields);
  const back = f.state.lessons[0].id;
  f.state.payments.push(paymentRow({ id: 'p1', athleteId: 'a5', purpose: 'lectie', lessonId: back }));
  expect(await deleteLesson(f.ctx, back)).toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
  f.state.payments[0].cancelled = true;
  expect((await deleteLesson(f.ctx, back)).ok).toBe(true);
});
it('lists the month with states and reads the panel (5.2, 5.5)', async () => {
  const f = attendanceSeed();
  f.state.lessons.push(lessonRow({ id: 'l1', athleteId: 'a1', date: '2026-11-18', startTime: '18:00', state: 'planned' }),
    lessonRow({ id: 'l2', athleteId: 'a5', date: '2026-11-25', startTime: '09:00', state: 'planned' }),
    lessonRow({ id: 'l0', athleteId: 'a6', date: '2026-11-18', startTime: '10:00', state: 'saved', present: true, savedBy: 'Ana Admin', savedAt: '2026-11-18T09:00:00.000Z' }));
  expect(ok(await listLessons(f.store, '2026-11', '2026-11-20')).map((l) => [l.lessonId, l.state])).toEqual([['l0', 'salvata'], ['l1', 'nefacuta'], ['l2', 'urmeaza']]);
  expect(ok(await readLesson(f.store, 'l0'))).toMatchObject({ athleteName: 'Luca Marin', savedLine: 'Salvată de Ana Admin, 18 nov 2026 11:00', deletable: true });
  expect(ok(await newLessonDefaults(f.store, { athlete: 'a5', date: '2026-11-25' }))).toEqual({ coachIds: ['tm-andreea'] });
  expect(ok(await newLessonDefaults(f.store, { athlete: 'a9', date: '2026-11-25' }))).toEqual({ coachIds: [] });
});
it('refuses a bad lesson (5.5, decided 14)', async () => {
  const f = attendanceSeed();
  expect(await createLesson(f.ctx, body({ coachIds: [] }))).toEqual({ ok: false, status: 400, error: 'Alege antrenorul.' });
  for (const over of [{ durationMin: 52 }, { startTime: '18' }, { date: '2026-02-30' }, { athleteId: 'a9' }, { athleteId: 'nope' }, { coachIds: ['nope'] }])
    expect((await createLesson(f.ctx, body(over))).ok, JSON.stringify(over)).toBe(false);
  expect(f.state.lessons).toEqual([]);
});
it('locks the athlete, then the lesson (7.1)', async () => {
  const f = attendanceSeed();
  const id = ok(await createLesson(f.ctx, body())).value.lessonId;
  f.group.locks.length = 0;
  await saveLesson(f.ctx, id, { present: true, durationMin: 50, coachIds: ['tm-virgil'] });
  expect(f.group.locks).toEqual(['athlete:a5', `lesson:${id}`]);
});
```

`lessonLines` joins the seed helpers (texts of `subjectType` `lesson` through `phase5Lines`).

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/lessons.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the five files.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/lessons src/club/presence/__tests__/lessons.test.ts src/club/presence/__tests__/attendance-seed.ts
git commit -m "feat(lessons): individual lessons with price snapshot, delete and undo"
```

---

### Task 7: "Pe antrenori" and CSV (low)

**Files:**
- Create: `src/club/presence/coaches/hours.ts`, `coaches/csv.ts`, `coaches/report.ts`
- Test: `src/club/presence/__tests__/coaches.test.ts`

**Interfaces:**
- Consumes: T1 (`CoachRow`, `CSV_HEADER`); 5-1 `isMonth`, `monthRange`.
- Produces:
  - `hoursText(minutes: number): string` = minutes / 60 rounded to one decimal, comma ("21,5", "19,0"; 4.3).
  - `coachRows(i: { sessions: Pick<SessionRow, 'id' | 'coachIds' | 'durationMin'>[]; presentBySession: Map<string, number>; lessons: Pick<LessonRow, 'coachIds' | 'durationMin' | 'state' | 'present'>[]; names: Record<string, string> }): CoachRow[]`: a session counts for each of its coaches with its full duration (p5 Q25) when it has at least one present; a lesson counts when `present` is true (C18); coaches with a count only; sorted by name (`localeCompare` 'ro').
  - `coachesCsv(rows: CoachRow[]): string` = `﻿` + header and rows joined by `;`, each line ending `\r\n` (C43, decided 15); `coachesCsvName(month: string): string` = `pe-antrenori-<YYYY-MM>.csv`.
  - `readCoachMonth(store: PresenceStore, month: unknown): Promise<AdminResult<CoachRow[]>>`.

- [ ] **Step 1: Write the failing test**

```ts
const names = { 'tm-virgil': 'Virgil Pascu', 'tm-andreea': 'Andreea Pascu', 'tm-dan': 'Dan Toma' };
const rows = coachRows({ names,
  sessions: [{ id: 's1', coachIds: ['tm-virgil'], durationMin: 50 }, { id: 's2', coachIds: ['tm-virgil', 'tm-andreea'], durationMin: 90 }, { id: 's3', coachIds: ['tm-dan'], durationMin: 50 }],
  presentBySession: new Map([['s1', 2], ['s2', 1], ['s3', 0]]),
  lessons: [{ coachIds: ['tm-virgil'], durationMin: 50, state: 'saved', present: true }, { coachIds: ['tm-dan'], durationMin: 50, state: 'saved', present: false },
    { coachIds: ['tm-dan'], durationMin: 50, state: 'planned', present: null }] });
it('each coach gets the full duration; empty sessions and absent lessons do not count (4.3, p5 Q25, C18)', () => {
  expect(rows).toEqual([
    { coachId: 'tm-andreea', name: 'Andreea Pascu', sessions: 1, lessons: 0, minutes: 90, hours: '1,5' },
    { coachId: 'tm-virgil', name: 'Virgil Pascu', sessions: 2, lessons: 1, minutes: 190, hours: '3,2' }]);
});
it('hours with one decimal and a comma (4.3)', () => {
  expect([hoursText(1290), hoursText(1140), hoursText(50), hoursText(0)]).toEqual(['21,5', '19,0', '0,8', '0,0']);
});
it('CSV with BOM, ";" and the screen headers (C43)', () => {
  expect(coachesCsv(rows)).toBe('﻿Antrenor;Ședințe grup;Lecții individuale;Ore\r\nAndreea Pascu;1;0;1,5\r\nVirgil Pascu;2;1;3,2\r\n');
  expect(coachesCsv([{ ...rows[0], name: 'Pop; "Junior"' }])).toContain('"Pop; ""Junior""";1;0;1,5');
  expect(coachesCsvName('2026-11')).toBe('pe-antrenori-2026-11.csv');
});
it('reads the month from saved rows only', async () => {
  const f = attendanceSeed();
  await saveSession(f.ctx, { occurrence: 'ev-club|2026-11-13|17:00', coachIds: ['tm-andreea'], ticks: [{ athleteId: 'a5', grup: true, uscat: false }], reactivate: [], keepInactive: [] });
  expect(ok(await readCoachMonth(f.store, '2026-11'))).toEqual([{ coachId: 'tm-andreea', name: 'Andreea Pascu', sessions: 1, lessons: 0, minutes: 90, hours: '1,5' }]);
  expect(ok(await readCoachMonth(f.store, '2026-10'))).toEqual([]);
  expect((await readCoachMonth(f.store, 'x')).ok).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/coaches.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the three files.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/coaches src/club/presence/__tests__/coaches.test.ts
git commit -m "feat(attendance): Pe antrenori hours and CSV"
```

---

### Task 8: Routes, controller and boot check (high)

**Files:**
- Create: `src/api/club/routes/09-attendance.ts`, `src/api/club/controllers/attendance.ts`
- Test: `src/club/presence/__tests__/attendance-routes.test.ts`
- Temporary: `${TMPDIR:-/tmp}/es52` (removed at the end)

**Interfaces:**
- Consumes: T2 to T7; 5-1 `presenceContext`, `strapiPresenceStore`; phase 4 `respondAction`, `todayIso`, `queryText`; `respond`, `refuseWith`.
- Produces (spec 6 plus decided 1), in this order, every one `{ auth: false, policies: ['global::is-admin'], middlewares: [] }`:

| Method and path | Handler | Service |
|---|---|---|
| `GET /club/attendance/day` | `attendance.day` | `readDay(store, query.date, today)` |
| `GET /club/attendance/session/defaults` | `attendance.defaults` | `sessionDefaults` |
| `POST /club/attendance/session/check` | `attendance.check` | `checkNewSession` |
| `GET /club/attendance/session` | `attendance.session` | `readPanelQuery` (null -> 400) then `readSessionPanel` |
| `PUT /club/attendance/session` | `attendance.save` | `saveSession` -> `respondSave` |
| `GET /club/attendance/coaches` | `attendance.coaches` | `readCoachMonth` |
| `GET /club/attendance/coaches.csv` | `attendance.coachesCsv` | `readCoachMonth` -> `coachesCsv`; `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="pe-antrenori-<month>.csv"` |
| `GET /club/lessons` | `attendance.lessons` | `listLessons` |
| `GET /club/lessons/new` | `attendance.lessonNew` | `newLessonDefaults` |
| `POST /club/lessons` | `attendance.createLesson` | `createLesson` -> `respondAction` |
| `GET /club/lessons/:documentId` | `attendance.lesson` | `readLesson` |
| `PUT /club/lessons/:documentId` | `attendance.saveLesson` | `saveLesson` -> `respondAction` |
| `DELETE /club/lessons/:documentId` | `attendance.deleteLesson` | `deleteLesson` -> `respondAction` |
| `GET /club/groups/:documentId/attendance` | `attendance.groupMonth` | `readGroupMonth` |
| `GET /club/athletes/:documentId/attendance` | `attendance.athleteMonth` | `readAthleteMonth` |

- [ ] **Step 1: Write the failing test** `attendance-routes.test.ts` (as phase 4 `routes.test.ts`, with its `staticBeforeParams`):

```ts
it('are all admin-only and point at handlers that exist (6, 11.3)', () => {
  for (const r of routes) {
    expect(r.config, r.path).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
    expect(typeof (attendance as Record<string, unknown>)[r.handler.split('.')[1]], r.handler).toBe('function');
    expect(r.handler.startsWith('attendance.')).toBe(true);
  }
});
it('declare fixed paths before parameter paths', () => {
  expect(staticBeforeParams(routes.map((r) => r.path))).toBe(true);
});
it('are exactly the attendance routes', () => {
  expect(routes.map((r) => `${r.method} ${r.path}`)).toEqual([
    'GET /club/attendance/day', 'GET /club/attendance/session/defaults', 'POST /club/attendance/session/check', 'GET /club/attendance/session',
    'PUT /club/attendance/session', 'GET /club/attendance/coaches', 'GET /club/attendance/coaches.csv', 'GET /club/lessons', 'GET /club/lessons/new',
    'POST /club/lessons', 'GET /club/lessons/:documentId', 'PUT /club/lessons/:documentId', 'DELETE /club/lessons/:documentId',
    'GET /club/groups/:documentId/attendance', 'GET /club/athletes/:documentId/attendance']);
});
it('the CSV handler sends a file and the save handler answers the inactive 409 (C43, decided 2)', () => {
  const src = readFileSync(join(SRC, 'api/club/controllers/attendance.ts'), 'utf8');
  expect(src).toContain("'text/csv; charset=utf-8'");
  expect(src).toMatch(/attachment; filename="\$\{coachesCsvName\(/);
  expect(src).toContain('respondSave(');
});
```

`staticBeforeParams` moves from `src/club/groups/__tests__/routes.test.ts` only if both tests can import it without editing phase 4 files; otherwise copy the six lines into this test.

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/attendance-routes.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the route file and the controller (one line per handler where possible; `store = () => strapiPresenceStore(strapi)`; writes through `presenceContext(strapi, ctx)`).
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS. Commit:

```bash
git add src/api/club/routes/09-attendance.ts src/api/club/controllers/attendance.ts src/club/presence/__tests__/attendance-routes.test.ts
git commit -m "feat(attendance): admin routes for attendance, lessons and coaches"
```

- [ ] **Step 5: Boot check on a throwaway Postgres**

Container `es52-pg` on 127.0.0.1:55452, Strapi on 1372. Never 1337, 1340, 3010, 5432, 55442.

Run (worktree root): `docker run -d --name es52-pg -e POSTGRES_PASSWORD=es52 -e POSTGRES_DB=es52 -p 127.0.0.1:55452:5432 postgres:16`; a throwaway env in `$T=${TMPDIR:-/tmp}/es52` (`DATABASE_PORT=55452 DATABASE_NAME=es52 DATABASE_PASSWORD=es52 PORT=1372`, the rest as plan 5-1 Task 12); `npm run build`; `phase4-shape.js` then `phase5-shape.js` with `ES_THROWAWAY_DB=1 IDS_FILE=$T/ids.json`; a throwaway `$T/seed-sub.js` (the fixture's `createStrapi(...).load()` pattern) that creates through `strapi.documents('api::subscription.subscription')` one subscription for one athlete of a school group (8 slots, its group's list, `startsOn` the 1st of the current month, `validUntil` from `subscriptionValidUntil`); start Strapi; admin login with curl as plan 4-1 Task 12 (helpers `api`, `idof`, `py`).

Then, with the school group `S`, its two athletes `A` (with the abonament) and `B`, the Club group `C` with two athletes (one set to A.C.S. Da in Sportivi), the Club group without a list `N`, and a coach `K`:

```bash
api GET "/club/attendance/day?date=$TODAY" | py "print(len(d['data']['day']), d['data']['groupsWithoutList'])"
api PUT /club/attendance/session "{\"added\":{\"groupId\":\"$S\",\"date\":\"$TODAY\",\"startTime\":\"19:00\",\"durationMin\":50},\"coachIds\":[\"$K\"],\"ticks\":[{\"athleteId\":\"$A\",\"grup\":true,\"uscat\":false},{\"athleteId\":\"$B\",\"grup\":true,\"uscat\":false}],\"reactivate\":[],\"keepInactive\":[]}"
api GET "/club/attendance/session?id=<sessionId>" | py "print([r['abonament'] for r in d['data']['rows']])"
# Club session: Grup + Uscat at member and non-member prices; then the group without a list
api GET "/club/attendance/coaches?month=$MONTH"; curl -s -D - -o $T/pe.csv -H "Authorization: Bearer $JWT" "http://127.0.0.1:1372/api/club/attendance/coaches.csv?month=$MONTH" | grep -i content-disposition; head -c 3 $T/pe.csv | xxd
# two parallel first saves of the same unsaved occurrence
( api PUT /club/attendance/session "$OCC_BODY" & api PUT /club/attendance/session "$OCC_BODY" & wait ) | grep -c 'Prezența s-a schimbat'
# lesson: create today, then undo
api POST /club/lessons "{\"athleteId\":\"$CA\",\"date\":\"$TODAY\",\"startTime\":\"18:00\",\"durationMin\":50,\"coachIds\":[\"$K\"]}"
api POST /club/undo '{"actionId":"<actionId>"}'
```

Expected: the day answers 200; the Școala save answers its toast; the panel shows "7 ședințe rămase" for A and "Fără abonament" for B (abonament status read after the save: A used one slot of 8); `club_attendances` rows (psql) carry `amount` 40 / 50 (+20 / 25 Uscat) by audience and `fara_pret` for `N`; the coaches route lists K with the session's hours; the CSV header is `attachment; filename="pe-antrenori-<month>.csv"` and the file starts with `efbbbf`; of the two parallel saves exactly one is refused with the conflict text (count 1) and `select count(*) from club_sessions where occurrence_key = '<key>'` is 1; the lesson undo answers `{"data":{"undone":true}}`. Stop Strapi, start it again (spec 11.4: restart once): no error in the log.

- [ ] **Step 6: Clean up**

Run: stop Strapi, `docker rm -f es52-pg`, `rm -rf ${TMPDIR:-/tmp}/es52`. Expected: container removed; nothing to commit.

---

## Interfaces for other plans

- **Plan 5-5 (screens):** every type of `src/club/presence/attendance/api-types.ts`; the routes of Task 8; copy `ATTENDANCE_ERRORS`, `EXISTING_SESSION`, `REACTIVATE_DIALOG`, `LESSON_COPY`, `sessionSavedToast` (`copy/attendance.ts`); pure `savedLine`, `typesText`, `shortDay`, `isDuration` (`attendance/view.ts`); the inactive 409 arrives as `error.details.inactive`; the save body carries `reactivate` and `keepInactive`; a save answers `undo: null`, lesson create and delete answer an `actionId` for `POST /club/undo`.
- **Plan 5-6 (athlete tabs):** `GET /club/athletes/:documentId/attendance?month=` (`AthleteMonthRow[]`); `PanelRow.abonament` and `noSubscription` for the panel's row menu.
- **Plan 5-4 (merge, delete, export):** nothing new; lessons and attendance rows are plain 5-1 rows.

## Self-review

- **Spec coverage.** 4.1 types and empty start (T3, T4); 4.2 coaches required and defaults (T3, T4, T6); 4.3 hours and "Pe antrenori" (T7); 4.4 sessions from occurrences, matching by key, moved and cancelled dates (T2, T4); 4.5 check and duration default (T1, T3); 4.6 out of schedule (T1, T2, T3); 4.7 visitors (T3, T4); 4.8 one slot per Școala attendance, two the same day (T4); 4.10 slot choice and status words (T3, T4); 4.12 Club prices, inclus, no list, frozen corrections (T4); 4.13 audience (T4, T6); 4.18 corrections and lines (T4, T6); 4.22 reactivation 409 (T4, T8); 5.2 data of the three tabs (T2, T6, T7); 5.3 panel data, saved line, toast (T1, T3, T4); 5.4 check (T3); 5.5 lessons (T6); 5.6 group tab (T5); 5.7 "Prezențe" block data (T5); 6 attendance routes (T8); 7.1 locks (T4, T6); 7.2 one transaction (T4, T6); 7.3 lesson undo, session save without undo (T4, T6); 8 session and lesson lines (T4, T6); 11.4 attendance parts (T8). Spec 5.2's notice texts and 5.4 to 5.6 screens are plan 5-5; abonamente, payments, De încasat plan 5-3; 4.20, 4.21 plan 5-4.
- **Step scan.** Tests carry the spec's values; code steps give signatures and the save algorithm (which the tests do not order); no body is written out where a signature and a test decide it.
- **Type consistency.** `SessionSaveBody`, `Tick`, `AddedSession` (T1) are read by `readSaveBody` (T4) and `readPanelQuery` (T3); `DayRow` is shared by T2 and T5; `LessonSaved` by create and save (T6); 5-1 names (`pickSubscription`, `clubCharges`, `audienceFor`, `lessonPrice`, `recordPresenceAction`, `guardOf`, `UniqueKeyError`, `P5_ACTIONS` keys and `changes`) are used as 5-1 defines them.
- **Review Focus.** Concurrent first save (T4, T8), corrections after changes (T4), bad ticks (T4), two sessions a day and a cancelled date (T2, T4), lesson undo and paid delete (T6): each has its test.
- **Proportion.** Eight tasks over the attendance part of a 700-line spec; code blocks are type declarations, signatures, assertions and one algorithm outline.
