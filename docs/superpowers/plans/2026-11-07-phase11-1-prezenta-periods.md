# Phase 11-1: Prezență Periods and Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The admin "Prezență" page shows a day, a week (default) or a month, with Grupe, Lecții individuale and Antrenori behind one square picker and a Listă / Grilă switch for Grupe, on new period routes capped at 42 days; plus the shared pieces every later phase 11 plan uses (role areas on routes, the server-free import guard, CSV, download log, thousands in amounts).

**Architecture:** Rules stay pure in `src/club/presence/` (period maths, state words, period rows, grid cells) and `src/club/prezenta/` (screen views, address), copy in `copy/prezenta-ui.ts`; the period read reuses `rowsBetween` (one occurrence expansion and one session read for the whole range). The admin page is rewritten thin in `src/admin/dashboard/prezenta/`, pinned by source-reading tests. New routes name their 6b area through `adminRoute(area)`.

**Tech Stack:** Strapi 5.52.1 (TypeScript), React 18 admin (`src/admin/ui`), Vitest 3, Python Playwright for renders, Postgres 16.

**Spec:** `docs/superpowers/specs/2026-11-07-admin-views-design.md` 1, 2, 4 (intro), 4.1, 4.8, 4.9 (CSV), 5 (intro), 5.1, 6, 7, 8, builder defaults, 12.2, 12.3, 12.10. Mockups: `.superpowers/admin-views/screens/av-1c-prezenta-separat.html` (list, picker), `av-1b-prezenta-revizuit.html` (grid, period labels). Index: `docs/superpowers/plans/2026-11-07-phase11-index.md` (contracts, role areas, rulings 1, 2, 6, 7, 8, 9, 14).

**Base:** `feat/athletes` with phase 6 merged. Worktree branch `feat/p11-1`.

**Parallel groups:** A: T1, T2 | B: T3, T4, T6 | C: T5 | D: T7 | E: T8

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Role areas and import guard, 2 CSV, money and period rules | base | T1: `src/club/admin-area.ts`, one test; T2: `src/club/csv.ts`, `download-log.ts`, `presence/money.ts`, `presence/period.ts`, `coaches/csv.ts` |
| B | 3 Period read and grid, 4 Lessons and coaches by range, 6 Screen copy and views | A | 3: `attendance/period.ts`, `grid.ts`, `group-month.ts`, `api-types.ts`; 4: `lessons/read.ts`, `coaches/report.ts`; 6: `src/club/prezenta/*`, `copy/prezenta-ui.ts` |
| C | 5 Routes | 3, 4 | `09-attendance.ts`, `controllers/attendance.ts`, route test |
| D | 7 Prezență page | 5, 6 | `src/admin/dashboard/prezenta/**`, `grupe/PrezentaTab.tsx`, `bani/AbonamentTab.tsx` (one import) |
| E | 8 Boot check and renders | all | fixtures' port lists only |

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes`. Commit only in the worktree your dispatch names; check `git rev-parse --show-toplevel` and `git branch --show-current` before every commit.
- Precedence: `answers.md` (later line wins) > latest approved mockup > dated DECISIONS entry > P5 / P6. The spec wins over this plan's prose.
- Checks after every task: the task's tests, `npx vitest run`, `npx tsc --noEmit`, `npx tsc --noEmit -p src/admin/tsconfig.json` (0 errors), `node scripts/admin-ui-check.mjs --strict` (exit 0).
- Code: TypeScript, no `any`, single quotes in `src/`, functions under 30 lines, complexity under 10, no dead code. Pure modules in `src/club/**` import no React, Strapi or Node; admin code imports only server-free `src/club` modules (T1 test).
- Dates `YYYY-MM-DD` in Europe/Bucharest; weeks Monday to Sunday; a period at most 42 days on Prezență and coach routes: 400 "Perioada e prea lungă." [S13].
- Every route this plan adds uses `adminRoute(area)` (index, "Role areas"); changed routes keep `adminGuard`.
- Design: admin tokens only; no tabs on Prezență (picker `SegmentedControl`, view `Select`); no pills, no circles; no dashed or dotted lines; 390 px without horizontal scroll; any "Salvează" inside `.ui-root`.
- Copy: exactly the spec's quoted strings, in `copy/prezenta-ui.ts` or `copy/core.ts`; no em or en dash, no middle dot, straight quotes; a string the spec does not give is `COPY NEEDED` and goes to the user.
- Synthetic data only; never production, `strapi_app` / `strapi_db`, 1337, 1340, 3010, 5432, 55442, `edusport-test-pg`. Task 8: `es111-pg` on 127.0.0.1:55473, Strapi 1391.
- Commits: exactly the message in the task, no `Co-Authored-By`, no AI attribution. Never push.
- Progress board: `printf '%s | 11-1 T<n> | implementer | <status>\n' "$(date -u +%H:%M)" >> /Users/codrin/Documents/Programming/edusport_backend/.superpowers/phase3-shared/progress-board.md`.

## Review Focus

- **A week across a month or year end** ("30 noi - 6 dec", "29 dec 2025 - 4 ian 2026") and a Lună starting mid-week: `periodOf`, `periodLabel` and the grid's columns agree, and "<" / ">" never skip or repeat a day. Pinned by T2 (`period.test.ts`) and T6 (`period-view.test.ts`).
- **Today's sessions around the start time**: 17:29 "Urmează", 17:30 "Necompletat", a saved one "Completat"; a lesson saved with the tick off "Completat" (name muted); a date before `attendanceStartDate` not listed. Pinned by T2 (`adminState`) and T3.
- **A period of 43 days, `to` before `from`, a bad date, or `month=2026-13`**: 400 with "Perioada e prea lungă." or "Cerere invalidă.", nothing read. Pinned by T2 (`readPeriodQuery`) and T8 (curl).
- **Old links** `?tab=sedinte&date=` / `?tab=lectii&month=` / `?tab=antrenori&month=` open the same content in the new page (`show`, `view=luna`). Pinned by T6 (`readPrezentaQuery`).
- **A group with two sessions on one day in the grid** adds both (present and listed summed, `sessions: 2`), and a day with only a planned session is shaded without a number. Pinned by T3 (`grid.test.ts`).

## Review batch

High tasks T1 and T5 are reviewed in batch R1 together with 11-2 T2 (index). The plan's final review (Opus) runs after T8.

---

## File Structure

```
src/club/admin-area.ts                     AdminArea, ADMIN_AREAS, adminRoute, areaOfRoute (T1)
src/club/__tests__/admin-area.test.ts      areas, helper shape (T1)
src/club/__tests__/admin-imports.test.ts   admin bundle reaches no server module (T1)
src/club/csv.ts                            CSV_BOM, toCsv, csvNumber, csvDate (T2)
src/club/download-log.ts                   downloadLogLine (T2)
src/club/presence/money.ts                 ron with thousands, groupedInt (T2)
src/club/presence/period.ts                PeriodView, periodOf, stepPeriod, readPeriodQuery, bucharestNow, adminState (T2)
src/club/presence/coaches/csv.ts           on toCsv, pe-antrenori-<from>-<to>.csv (T2)
src/club/presence/attendance/period.ts     readPeriod (T3)
src/club/presence/attendance/grid.ts       gridCells, readGrid (T3)
src/club/presence/attendance/group-month.ts  rows gain adminState (T3)
src/club/presence/attendance/api-types.ts  PeriodRow, PeriodPage, GridCell, GridPage, PeriodLessonRow (T3)
src/club/presence/lessons/read.ts          listLessons by range (T4)
src/club/presence/coaches/report.ts        readCoachPeriod (T4)
src/api/club/routes/09-attendance.ts       period, grid; lessons and coaches by range (T5); day route removed (T7)
src/api/club/controllers/attendance.ts     handlers (T5, T7)
src/club/presence/copy/core.ts             periodTooLong (T2)
src/club/presence/copy/prezenta-ui.ts      PERIOD_COPY, STATE_COPY, GRID_COPY (T6)
src/club/prezenta/routes.ts                new query, old link mapping, coachPageTo (T6)
src/club/prezenta/period-view.ts           labels, day headers, grid headers and cells, legend (T6)
src/admin/dashboard/prezenta/
  PeriodHeader.tsx, PrezentaScreen.tsx, GroupsList.tsx, GroupsGrid.tsx, LessonsList.tsx, CoachesList.tsx, MonthLine.tsx (T7)
  DayTab.tsx, LessonsTab.tsx, CoachesTab.tsx   removed (T7)
src/admin/dashboard/grupe/PrezentaTab.tsx  admin words, MonthLine import (T7)
src/admin/dashboard/bani/AbonamentTab.tsx  MonthLine import only (T7)
scripts/fixtures/phase{4,5,6}-shape.js     ports 55473-55476 (T8)
```

---

### Task 1: Role areas and the server-free import guard (high, Sonnet)

**Files:**
- Create: `src/club/admin-area.ts`
- Modify: `src/admin/dashboard/menu.tsx` (type only: `EdusportLink` gains `area?: AdminArea`)
- Test: `src/club/__tests__/admin-area.test.ts`, `src/club/__tests__/admin-imports.test.ts`

**Interfaces:**
- Produces: `type AdminArea = 'any' | 'website' | 'club' | 'money' | 'coachAccounts' | 'settings' | 'superAdmin'`; `ADMIN_AREAS: readonly AdminArea[]` (that order); `type AdminRouteConfig = { auth: false; policies: [{ name: 'global::is-admin'; config: { area: AdminArea } }]; middlewares: [] }`; `adminRoute(area: AdminArea): AdminRouteConfig`; `areaOfRoute(config: unknown): AdminArea | null` (the area of an `adminRoute` config, else null).

- [ ] **Step 1: Write the failing tests**

```ts
// admin-area.test.ts
it('names the 6b areas verbatim', () => {
  expect(ADMIN_AREAS).toEqual(['any', 'website', 'club', 'money', 'coachAccounts', 'settings', 'superAdmin']);
});
it('builds an is-admin route that carries its area', () => {
  expect(adminRoute('money')).toEqual({ auth: false, policies: [{ name: 'global::is-admin', config: { area: 'money' } }], middlewares: [] });
  expect(areaOfRoute(adminRoute('club'))).toBe('club');
  expect(areaOfRoute({ auth: false, policies: ['global::is-admin'], middlewares: [] })).toBeNull();
});
it('is-admin still ignores its config (access is "any admin" until 6b)', () => {
  expect(readFileSync(join(SRC, 'policies/is-admin.ts'), 'utf8')).toMatch(/_config: unknown/);
});
```

`admin-imports.test.ts`: walk every `.ts` / `.tsx` under `src/admin`, collect value imports (skip `import type` and `export type`) that resolve into `src/club`, follow their value imports transitively inside `src/club`, and fail when a reached file imports `@strapi/strapi` (value), `node:*`, `exceljs`, `pdfkit`, `knex`, or a path containing `strapi-store` or `club/files/`. Message: the admin file and the chain. Files that already break the rule before phase 11 go in a `KNOWN` list in the test with the comment "before phase 11"; the task report lists them. New entries are refused in review.

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/__tests__/admin-area.test.ts src/club/__tests__/admin-imports.test.ts`; Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `src/club/admin-area.ts` (no imports) and the optional `area` field on `EdusportLink`.
- [ ] **Step 4: Run** the two tests, `npx vitest run`, both `tsc`; Expected: PASS, 0 errors.
- [ ] **Step 5: Commit**

```bash
git add src/club/admin-area.ts src/admin/dashboard/menu.tsx src/club/__tests__/admin-area.test.ts src/club/__tests__/admin-imports.test.ts
git commit -m "feat(admin): role areas on admin routes and a server-free import guard"
```

---

### Task 2: CSV, download log, amounts and period rules (low, Haiku)

**Files:**
- Create: `src/club/csv.ts`, `src/club/download-log.ts`, `src/club/presence/period.ts`
- Modify: `src/club/presence/money.ts`, `src/club/presence/coaches/csv.ts`, `src/club/presence/copy/core.ts`
- Test: `src/club/__tests__/csv.test.ts`, `src/club/presence/__tests__/period.test.ts`, update amount expectations in existing tests that print 1.000 RON or more (`npx vitest run` names them)

**Interfaces:**
- Produces (`csv.ts`): `CSV_BOM = '﻿'`; `toCsv(header: readonly string[], rows: readonly (readonly (string | number | null)[])[]): string` (BOM, ";", CRLF after every line, a cell quoted when it holds ";", a quote or a line break; `null` is empty); `csvNumber(n: number): string` ("1200,50", "40", no thousands mark); `csvDate(iso: string): string` ("06.11.2026").
- Produces (`download-log.ts`): `downloadLogLine(i: { adminId: string | number | null; kind: string; rows: number }): string` -> `"[download] admin=<id> kind=<kind> rows=<n>"` (no names, no file names) [S62].
- Produces (`money.ts`): `ron(n)` -> "18.640 RON", "1.200,50 RON", "320 RON", "-20 RON" (ruling 8); `groupedInt(n: number): string` ("5.000").
- Produces (`period.ts`):
  - `type PeriodView = 'zi' | 'saptamana' | 'luna'`; `type Period = { from: string; to: string }`;
  - `periodOf(view: PeriodView, date: string): Period` (Zi: the date; Săptămână: Monday to Sunday holding it; Lună: the calendar month);
  - `stepPeriod(view: PeriodView, date: string, n: number): string` (the date `n` periods away, kept on the period's first day);
  - `MAX_PERIOD_DAYS = 42`; `readPeriodQuery(q: Record<string, unknown>): Checked<Period>` (`from` and `to` ISO dates, `from <= to`, at most 42 days inclusive; or `month` as alias -> its month; else 400 `invalid`; too long 400 `PRESENCE_ERRORS.periodTooLong`);
  - `bucharestNow(d: Date): { date: string; time: string }` (`Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', ... })`, time `HH:mm`);
  - `type AdminState = 'completat' | 'necompletat' | 'urmeaza' | null`; `adminState(i: { saved: boolean; date: string; startTime: string; startDate: string | null; now: { date: string; time: string } }): AdminState` (saved: completat; before `startDate` or no `startDate` and not saved in the past: null as P5; date and time not reached: urmeaza; else necompletat) [S17, ruling 6].
- `copy/core.ts` gains `periodTooLong: 'Perioada e prea lungă.'` and `downloadFailed: 'Descărcarea nu a reușit.'` in `PRESENCE_ERRORS`.
- `coaches/csv.ts`: `coachesCsv` uses `toCsv`; `coachesCsvName(from, to)` -> `pe-antrenori-<from>-<to>.csv`.

- [ ] **Step 1: Write the failing tests** (values are the spec's):

```ts
it('weeks run Monday to Sunday across months and years', () => {
  expect(periodOf('saptamana', '2026-11-06')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
  expect(periodOf('saptamana', '2026-12-03')).toEqual({ from: '2026-11-30', to: '2026-12-06' });
  expect(periodOf('saptamana', '2026-01-01')).toEqual({ from: '2025-12-29', to: '2026-01-04' });
  expect(periodOf('luna', '2026-02-14')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  expect(stepPeriod('saptamana', '2026-11-06', -1)).toBe('2026-10-26');
  expect(stepPeriod('luna', '2026-01-31', 1)).toBe('2026-02-01');
});
it('caps the period at 42 days and keeps month as an alias', () => {
  expect(readPeriodQuery({ from: '2026-11-01', to: '2026-12-12' })).toEqual({ ok: true, value: { from: '2026-11-01', to: '2026-12-12' } });
  expect(readPeriodQuery({ from: '2026-11-01', to: '2026-12-13' })).toEqual({ ok: false, status: 400, error: 'Perioada e prea lungă.' });
  expect(readPeriodQuery({ from: '2026-11-08', to: '2026-11-02' })).toMatchObject({ ok: false, error: 'Cerere invalidă.' });
  expect(readPeriodQuery({ month: '2026-11' })).toEqual({ ok: true, value: { from: '2026-11-01', to: '2026-11-30' } });
});
it('names the admin state by start time', () => {
  const base = { saved: false, date: '2026-11-06', startTime: '17:30', startDate: '2026-11-01' };
  expect(adminState({ ...base, now: { date: '2026-11-06', time: '17:29' } })).toBe('urmeaza');
  expect(adminState({ ...base, now: { date: '2026-11-06', time: '17:30' } })).toBe('necompletat');
  expect(adminState({ ...base, saved: true, now: { date: '2026-11-05', time: '09:00' } })).toBe('completat');
  expect(adminState({ ...base, date: '2026-10-30', now: { date: '2026-11-06', time: '09:00' } })).toBeNull();
});
it('reads Bucharest wall time', () => {
  expect(bucharestNow(new Date('2026-11-06T15:30:00Z'))).toEqual({ date: '2026-11-06', time: '17:30' });
  expect(bucharestNow(new Date('2026-07-01T21:30:00Z'))).toEqual({ date: '2026-07-02', time: '00:30' });
});
// csv.test.ts
it('writes Excel-friendly CSV', () => {
  expect(toCsv(['A', 'B'], [['x;y', 1200.5], [null, 'a"b']])).toBe('﻿A;B\r\n"x;y";1200.5\r\n;"a""b"\r\n');
  expect(csvNumber(1200.5)).toBe('1200,50');
  expect(csvNumber(40)).toBe('40');
  expect(csvDate('2026-11-06')).toBe('06.11.2026');
  expect(downloadLogLine({ adminId: 3, kind: 'tables-xlsx', rows: 120 })).toBe('[download] admin=3 kind=tables-xlsx rows=120');
});
it('groups thousands in amounts', () => {
  expect(ron(18640)).toBe('18.640 RON');
  expect(ron(1200.5)).toBe('1.200,50 RON');
  expect(ron(-20)).toBe('-20 RON');
  expect(groupedInt(5000)).toBe('5.000');
});
```

(`toCsv` writes numbers as given; callers pass `csvNumber(...)` text where a decimal comma is wanted.)

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/__tests__/csv.test.ts src/club/presence/__tests__/period.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the modules; `periodOf` uses `addDays` and `weekdayIndex` from `src/club/groups/dates.ts`, `monthRange` from `presence/dates.ts`.
- [ ] **Step 4: Run** `npx vitest run`; update the expectations of existing tests that now print the thousands mark (list them in the report); Expected: PASS. Both `tsc`: 0 errors.
- [ ] **Step 5: Commit**

```bash
git add src/club/csv.ts src/club/download-log.ts src/club/presence/period.ts src/club/presence/money.ts src/club/presence/coaches/csv.ts src/club/presence/copy/core.ts src/club/__tests__/csv.test.ts src/club/presence/__tests__/period.test.ts src/club/presence/__tests__
git commit -m "feat(presence): period rules, admin state words, shared CSV and grouped amounts"
```

---

### Task 3: Period read and grid (low, Sonnet)

**Files:**
- Create: `src/club/presence/attendance/period.ts`, `src/club/presence/attendance/grid.ts`
- Modify: `src/club/presence/attendance/api-types.ts`, `src/club/presence/attendance/group-month.ts`
- Test: `src/club/presence/__tests__/attendance-period.test.ts`, `src/club/presence/__tests__/grid.test.ts` (seed: `attendanceSeed()` from `attendance-seed.ts`)

**Interfaces:**
- Consumes: `loadRowContext`, `rowsBetween`, `byStartThenOrder` (`day.ts`); `adminState`, `Period` (T2); `groupsWithoutPriceList`.
- Produces (`api-types.ts`): `PeriodRow = DayRow & { coachIds: string[]; adminState: AdminState }` (coachIds: the saved session's coaches, else the group's); `PeriodPage = { from; to; today; startDate; groupsWithoutList; undone: PeriodRow[]; days: { date: string; rows: PeriodRow[] }[] }`; `GridCell = { date: string; state: AdminState; present: number; listed: number; sessions: number }`; `GridPage = { from; to; dates: string[]; rows: { groupId: string; groupName: string; cells: GridCell[] }[] }`; `PeriodLessonRow = LessonListRow & { adminState: AdminState }`; `GroupMonth.rows: PeriodRow[]`.
- Produces: `readPeriod(store: PresenceStore, period: Period, now: { date: string; time: string }): Promise<AdminResult<PeriodPage>>` (one `rowsBetween(from, to)`; rows with a null state left out; days ascending, rows by `byStartThenOrder`; days without rows left out; undone = unsaved held occurrences from `startDate` to `from - 1`, newest first [S16]); `gridCells(rows: PeriodRow[], groups: GroupRecord[], period: Period): GridPage` (pure; groups that have a row in the period, P4 group order; a day's cells of one group add `present`, `listed`, `sessions`; `state`: necompletat if any is, else urmeaza if any is, else completat; no session: `state: null, sessions: 0`) [S14]; `readGrid(store, period, now)`; `readGroupMonth` rows carry `coachIds` and `adminState` (ruling 7).

- [ ] **Step 1: Write the failing tests**

```ts
it('lists the week by day with admin words, the undone list before from (4.1, 4.1a)', async () => {
  const f = attendanceSeed();
  const page = ok(await readPeriod(f.store, { from: '2026-11-16', to: '2026-11-22' }, { date: '2026-11-20', time: '17:30' }));
  expect(page.days.map((d) => d.date)).toEqual(['2026-11-20']);              // days without rows left out
  expect(page.days[0].rows.map((r) => [r.startTime, r.adminState])).toEqual([['17:00', 'necompletat']]);
  expect(page.undone.every((r) => r.date < '2026-11-16' && r.sessionId === null)).toBe(true);
});
it('adds two sessions of a group on one day and shades a planned day (S14)', () => {
  const rows = [row({ date: '2026-11-03', present: 8, listed: 9, adminState: 'completat' }), row({ date: '2026-11-03', present: 3, listed: 9, adminState: 'completat' }),
    row({ date: '2026-11-05', present: 0, listed: 9, adminState: 'urmeaza' })];
  const grid = gridCells(rows, [group('g1', 'Intermediari Bronze')], { from: '2026-11-02', to: '2026-11-08' });
  expect(grid.dates).toHaveLength(7);
  expect(grid.rows[0].cells[1]).toEqual({ date: '2026-11-03', state: 'completat', present: 11, listed: 18, sessions: 2 });
  expect(grid.rows[0].cells[3]).toMatchObject({ state: 'urmeaza', sessions: 1 });
  expect(grid.rows[0].cells[0]).toEqual({ date: '2026-11-02', state: null, present: 0, listed: 0, sessions: 0 });
});
```

(`row` and `group` are small builders in the test file; `ok` as in the phase 5 tests.)

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/presence/__tests__/attendance-period.test.ts src/club/presence/__tests__/grid.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the two modules and the `group-month.ts` change; `now` and `startDate` decide `adminState`, `startTime` from the row.
- [ ] **Step 4: Run** `npx vitest run` (the existing `attendance-day.test.ts` and portal tests still pass: `readDay` is unchanged); Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/attendance/period.ts src/club/presence/attendance/grid.ts src/club/presence/attendance/api-types.ts src/club/presence/attendance/group-month.ts src/club/presence/__tests__/attendance-period.test.ts src/club/presence/__tests__/grid.test.ts
git commit -m "feat(presence): attendance by period and the group grid"
```

---

### Task 4: Lessons and coach hours by range (low, Sonnet)

**Files:**
- Modify: `src/club/presence/lessons/read.ts`, `src/club/presence/coaches/report.ts`
- Test: `src/club/presence/__tests__/lessons.test.ts`, `src/club/presence/__tests__/coaches.test.ts` (extend)

**Interfaces:**
- Consumes: `readPeriodQuery`, `adminState` (T2).
- Produces: `listLessons(store, query: Record<string, unknown>, now: { date; time }): Promise<AdminResult<PeriodLessonRow[]>>` (`from` / `to` or `month`; a planned lesson whose time passed: necompletat; saved: completat, `present` as saved; ordered by date, time) [Builder defaults: lessons exist only once created]; `readCoachPeriod(store, query): Promise<AdminResult<CoachRow[]>>` (P5 counting unchanged, range from the query; replaces `readCoachMonth`).

- [ ] **Step 1: Write the failing tests**: `listLessons(f.store, { from: '2026-11-16', to: '2026-11-22' }, { date: '2026-11-20', time: '19:00' })` lists the 18:00 planned lesson of 2026-11-20 as `necompletat`; `{ month: '2026-11' }` gives the same rows as `{ from: '2026-11-01', to: '2026-11-30' }`; `readCoachPeriod(f.store, { from: '2026-11-14', to: '2026-11-14' })` counts only that day's saved session; `{ from: '2026-11-01', to: '2026-12-31' }` answers 400 "Perioada e prea lungă.".
- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/presence/__tests__/lessons.test.ts src/club/presence/__tests__/coaches.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement**; the controller's callers are updated in T5 (until then keep `readCoachMonth` as a one-line wrapper so `tsc` passes; T5 removes it).
- [ ] **Step 4: Run** `npx vitest run`, `npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/lessons/read.ts src/club/presence/coaches/report.ts src/club/presence/__tests__/lessons.test.ts src/club/presence/__tests__/coaches.test.ts
git commit -m "feat(presence): lessons and coach hours for any period"
```

---

### Task 5: Routes (high, Sonnet)

**Files:**
- Modify: `src/api/club/routes/09-attendance.ts`, `src/api/club/controllers/attendance.ts`, `src/club/presence/coaches/report.ts` (drop the wrapper), `docs/HANDOFF.md` (one line, ruling 14)
- Test: `src/club/presence/__tests__/attendance-routes.test.ts`

**Interfaces:**
- Consumes: T1 `adminRoute`, `areaOfRoute`; T2 `readPeriodQuery`, `bucharestNow`, `downloadLogLine`; T3 `readPeriod`, `readGrid`; T4.
- Produces (route order: static before parameter paths): `GET /club/attendance/period` -> `attendance.period` (`adminRoute('club')`); `GET /club/attendance/grid` -> `attendance.grid` (`adminRoute('club')`); `GET /club/lessons` and `GET /club/attendance/coaches(.csv)` read `from` / `to` or `month` (existing guard). The CSV handler writes `downloadLogLine({ adminId, kind: 'coaches-csv', rows })` with `strapi.log.info`; `adminId` from `verifiedAdminId(ctx.request.header.authorization, strapi)`.

- [ ] **Step 1: Write the failing test** (extend the existing one):

```ts
it('new phase 11 routes name their area; the others keep the phase 5 guard', () => {
  const areas = Object.fromEntries(routes.filter((r) => areaOfRoute(r.config) !== null).map((r) => [`${r.method} ${r.path}`, areaOfRoute(r.config)]));
  expect(areas).toEqual({ 'GET /club/attendance/period': 'club', 'GET /club/attendance/grid': 'club' });
  for (const r of routes.filter((x) => areaOfRoute(x.config) === null)) expect(r.config).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
});
it('the coaches CSV is named by period and logged without personal data', () => {
  const src = readFileSync(join(SRC, 'api/club/controllers/attendance.ts'), 'utf8');
  expect(src).toMatch(/coachesCsvName\(period\.from, period\.to\)/);
  expect(src).toContain('downloadLogLine(');
});
```

The exact-list test gains the two paths after `GET /club/attendance/day`.

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/attendance-routes.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the routes and handlers (period 400s through `refuseWith`); add to `docs/HANDOFF.md`: "Phase 11: the `month` query of `/club/lessons` and `/club/attendance/coaches(.csv)` is an alias kept one release; remove it in the release after phase 11."
- [ ] **Step 4: Run** `npx vitest run`, both `tsc`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/api/club/routes/09-attendance.ts src/api/club/controllers/attendance.ts src/club/presence/coaches/report.ts src/club/presence/__tests__/attendance-routes.test.ts docs/HANDOFF.md
git commit -m "feat(attendance): period and grid routes, lessons and coach hours by range"
```

---

### Task 6: Screen copy, address and pure views (low, Haiku)

**Files:**
- Modify: `src/club/presence/copy/prezenta-ui.ts`, `src/club/prezenta/routes.ts`
- Create: `src/club/prezenta/period-view.ts`
- Test: `src/club/prezenta/__tests__/period-view.test.ts`

**Interfaces:**
- Produces (copy; exact spec strings): `PERIOD_COPY = { views: { zi: 'Zi', saptamana: 'Săptămână', luna: 'Lună' }, today: 'Azi', show: { grupe: 'Grupe', lectii: 'Lecții individuale', antrenori: 'Antrenori' }, layout: { lista: 'Listă', grila: 'Grilă' }, newSession: '+ Ședință nouă', newLesson: '+ Lecție individuală', exportCsv: 'Export CSV', undoneTitle: (n: number) => `Necompletate din zilele trecute (${n})`, outside: 'În afara programului', todaySuffix: ' (azi)', emptyGroups: 'Nicio ședință în perioada asta.', emptyLessons: 'Nicio lecție individuală în perioada asta.', emptyCoaches: 'Nicio ședință completată în perioada asta.' }`; `STATE_COPY = { completat: 'Completat', necompletat: 'Necompletat', urmeaza: 'Urmează' }`; `GRID_COPY = { legendWeek: 'Prezenți din listați', legendMonth: 'Prezenți din listați, % în celule', steps: ['0%', '1-59%', '60-79%', '80-94%', '95-100%'], planned: 'planificat', none: 'fără ședință' }`. Column labels reuse `PREZENTA_COPY` ("Ora", "Grupă", "Antrenor", "Prezenți", "Stare", "Data", "Sportiv", "Ședințe grup", "Lecții individuale", "Ore"). Hidden arrow labels: `COPY NEEDED` for "previous / next period" (ask the user; until answered reuse "Luna anterioară" / "Luna următoare" for Lună and "Ziua anterioară" / "Ziua următoare" for Zi, and mark Săptămână `COPY NEEDED` in the report).
- Produces (`routes.ts`): `PrezentaShow = 'grupe' | 'lectii' | 'antrenori'`; `PrezentaLayout = 'lista' | 'grila'`; `PrezentaQuery = { view: PeriodView; date: string; show: PrezentaShow; layout: PrezentaLayout }`; `readPrezentaQuery(search, today)` (defaults `saptamana`, today, `grupe`, `lista`; `layout` forced to `lista` unless `show` is grupe and view is not zi; old `tab=sedinte|lectii|antrenori` maps to `show` with `view=luna`, the old `date` or `month`'s first day as `date`) [S39]; `prezentaTo(q: Partial<PrezentaQuery>)` (keys in the order view, date, show, layout); `COACH_SEGMENT = 'antrenor'`; `coachPageTo(teamMemberId: string, view: PeriodView, date: string): string` -> `/plugins/edusport-prezenta/antrenor/<id>?view=<v>&date=<d>`.
- Produces (`period-view.ts`): `periodLabel(view, period, today)` (Zi "Vineri, 6 noi 2026"; Săptămână "2-8 noi", "30 noi - 6 dec", "29 dec 2025 - 4 ian 2026"; Lună "Noiembrie 2026") [S38]; `dayHeader(date, today)` ("Luni 2 noi", "Vineri 6 noi (azi)"); `gridHeader(view, date)` ("Lu 2", "Ma 3", "Mi 4", "J 5", "V 6", "S 7", "D 8"; month "1".."31"); `cellText(view, cell)` ("92%" week, "92" month, "" for planned or none, percent rounded from present / listed); `cellStep(cell): 'none' | 'planned' | 's0' | 's1' | 's2' | 's3' | 's4'` (0%, 1-59, 60-79, 80-94, 95-100); `scrollTarget(days, today, period)` (today's date if in the period, else the first day).

- [ ] **Step 1: Write the failing test** with every example above, plus `readPrezentaQuery('?tab=lectii&month=2026-10', '2026-11-06')` -> `{ view: 'luna', date: '2026-10-01', show: 'lectii', layout: 'lista' }` and `readPrezentaQuery('?view=zi&layout=grila', d).layout === 'lista'`.
- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/prezenta/__tests__/period-view.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement**; dates from `MONTHS_SHORT`, `WEEKDAYS` (`groups/dates.ts`).
- [ ] **Step 4: Run** `npx vitest run` (the copy scan included); Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/copy/prezenta-ui.ts src/club/prezenta/routes.ts src/club/prezenta/period-view.ts src/club/prezenta/__tests__/period-view.test.ts
git commit -m "feat(prezenta): period labels, address and grid views"
```

---

### Task 7: Prezență page with view, picker and grid (low, Sonnet)

**Files:**
- Create: `src/admin/dashboard/prezenta/{PeriodHeader,GroupsList,GroupsGrid,LessonsList,CoachesList,MonthLine}.tsx`
- Modify: `src/admin/dashboard/prezenta/{PrezentaScreen.tsx,api.ts,styles.ts}`, `src/admin/dashboard/PrezentaPage.tsx`, `src/admin/dashboard/grupe/PrezentaTab.tsx`, `src/admin/dashboard/bani/AbonamentTab.tsx` (MonthLine import only), `src/api/club/routes/09-attendance.ts` and `controllers/attendance.ts` (remove `/club/attendance/day` and `attendance.day`, ruling 2), `src/club/presence/__tests__/attendance-routes.test.ts` (list)
- Delete: `src/admin/dashboard/prezenta/{DayTab,LessonsTab,CoachesTab}.tsx`
- Test: `src/club/prezenta/__tests__/admin-prezenta.test.ts` (rewrite the parts about the removed files), `src/club/__tests__/money-ui-source.test.ts` (the `LessonsTab` line moves to `LessonsList`)

**Interfaces:**
- Consumes: T5 routes; T6 views and copy; `usePrezentaApi` (add `period(from, to)`, `grid(from, to)`, `lessons(from, to)`, `coaches(from, to)`, `coachesCsv(from, to)`; remove `day`).
- Produces: `PeriodHeader({ view, date, today, onChange })` (Select "Zi" / "Săptămână" / "Lună", "<", ">", "Azi", the label as a button that opens a native `<input type="date">`; also used by the 11-2 coach page); `MonthLine` and `useMonthLoad` moved unchanged from `LessonsTab.tsx`.

- [ ] **Step 1: Write the failing source tests** (in `admin-prezenta.test.ts`): `PrezentaScreen.tsx` imports no `Tabs` and renders `SegmentedControl` with the three `PERIOD_COPY.show` labels; the Listă / Grilă control renders only when `query.show === 'grupe' && query.view !== 'zi'`; `GroupsList.tsx` uses `dayHeader(` and `STATE_COPY`, and `PERIOD_COPY.undoneTitle(`; `GroupsGrid.tsx` uses `cellStep(` and `cellText(`, a `position: sticky` group column, and no `border-radius` other than `var(--ui-radius-*)`; a cell click calls `onQuery({ view: 'zi', date, show: 'grupe' })` [S42]; `CoachesList.tsx` rows navigate with `coachPageTo(`; `LessonsList.tsx` mutes the athlete name when `present === false` (P5 C48); every file under `dashboard/prezenta` contains no `dashed`, `dotted` or `border-radius: 50%`; `PrezentaPage.tsx` reads `readPrezentaQuery`; `api.ts` has no `/attendance/day`.
- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/prezenta/__tests__/admin-prezenta.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** spec 5.1: header row (view, arrows, Azi, picker, Listă / Grilă), action at the right per `show` [S37]; P5 notices above; Grupe Listă (undone section first, hidden at 0, day header rows in capitals by CSS, lower and smaller than P5 section titles, columns "Ora" | "Grupă" | "Antrenor" | "Prezenți" "<x>/<y>" | "Stare", "Necompletat" in the colour P5 used for "nefăcută", "În afara programului" muted under the group; Lună scrolls to `scrollTarget`; Zi without a day header [S40]); grid (square cells, the five steps from existing theme tokens chosen on rendered light and dark crops, legend under it, phone: sideways scroll inside the box); Lecții individuale and Antrenori lists; rows open the existing panels; phone: controls wrap to two rows, rows become cards (P5 pattern). Group tab rows switch to `STATE_COPY[r.adminState]`. Remove the day route, handler and its test entry.
- [ ] **Step 4: Run** all checks (`npx vitest run`, both `tsc`, `node scripts/admin-ui-check.mjs --strict`); Expected: PASS, 0, exit 0.
- [ ] **Step 5: Commit**

```bash
git add -A src/admin/dashboard/prezenta src/admin/dashboard/PrezentaPage.tsx src/admin/dashboard/grupe/PrezentaTab.tsx src/admin/dashboard/bani/AbonamentTab.tsx src/api/club/routes/09-attendance.ts src/api/club/controllers/attendance.ts src/club/prezenta/__tests__/admin-prezenta.test.ts src/club/__tests__/money-ui-source.test.ts src/club/presence/__tests__/attendance-routes.test.ts
git commit -m "feat(prezenta): day, week and month views with picker and grid"
```

---

### Task 8: Boot check, click-through and renders (low, Sonnet)

**Files:**
- Modify: `scripts/fixtures/phase4-shape.js`, `phase5-shape.js`, `phase6-shape.js` (add 55473, 55474, 55475, 55476 to `THROWAWAY_PORTS`)
- Temporary: `T=${TMPDIR:-/tmp}/es111` (removed at the end). PNGs: `/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/phase11-renders/11-1-<name>-<desktop|phone>.png` (not committed; the user reviews them).

- [ ] **Step 1: Port lists**: add the four ports; commit:

```bash
git add scripts/fixtures/phase4-shape.js scripts/fixtures/phase5-shape.js scripts/fixtures/phase6-shape.js
git commit -m "chore(fixtures): phase 11 throwaway ports"
```

- [ ] **Step 2: Database, build, fixtures.** As plan 5-2 Task 8 Step 5 with `es52` -> `es111`, port 55452 -> 55473, Strapi 1372 -> 1391: `docker run -d --name es111-pg -e POSTGRES_PASSWORD=es111 -e POSTGRES_DB=es111 -p 127.0.0.1:55473:5432 postgres:16`; `npm run build`; `phase4-shape.js`, `phase5-shape.js` with `ES_THROWAWAY_DB=1 IDS_FILE=$T/ids.json`; set `attendance_start_date` to the 1st of last month; through the routes save one session yesterday, one session today 2 h ago, two sessions of one group on one day this week (one `added` out of schedule), a lesson today 1 h ago (unsaved) and one tomorrow; admin login with curl (helpers `api`, `py`).
- [ ] **Step 3: Curl checks**

```bash
api GET "/club/attendance/period?from=$MON&to=$SUN" | py "print([(d['date'], [r['adminState'] for r in d['rows']]) for d in d['data']['days']])"
api GET "/club/attendance/period?from=2026-11-01&to=2026-12-13"     # 43 days
api GET "/club/attendance/grid?from=$MON&to=$SUN" | py "print([c for r in d['data']['rows'] for c in r['cells'] if c['sessions']==2])"
api GET "/club/lessons?from=$TODAY&to=$TODAY" | py "print([l['adminState'] for l in d['data']])"
api GET "/club/lessons?month=$MONTH" | py "print(len(d['data']))"
curl -s -D - -o $T/pe.csv -H "Authorization: Bearer $JWT" "http://127.0.0.1:1391/api/club/attendance/coaches.csv?from=$MON&to=$SUN" | grep -i content-disposition
curl -s -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:1391/api/club/attendance/period?from=$MON&to=$SUN"   # no token
api GET "/club/attendance/day?date=$TODAY"                           # removed
```

Expected: today's earlier session `necompletat`, yesterday's saved `completat`, tomorrow's `urmeaza`; the 43-day call answers 400 "Perioada e prea lungă."; one grid cell with `sessions: 2` and summed counts; today's past lesson `necompletat`; the month alias answers rows; `attachment; filename="pe-antrenori-<MON>-<SUN>.csv"`; no token: 401; the day route: 404 or 405; the Strapi log has one `[download] admin=<id> kind=coaches-csv rows=<n>` line and no name. Restart Strapi once: no error.

- [ ] **Step 4: Click-through and renders.** `$T/pass.py` on the plan 5-5 Task 7 pattern (login once, `storage_state`, 1440x900 and 390x844, `page_errors`, `no_side_scroll`): `saptamana-grupe-lista`, `saptamana-grupe-grila`, `luna-grupe-lista` (scrolled to today), `luna-grupe-grila`, `zi-grupe`, `saptamana-lectii`, `saptamana-antrenori`, `vechi-link` (`?tab=lectii&month=<m>`), a grid cell click -> `zi-din-grila`, `grupa-tab-prezenta`. Record `r['picker']`, `r['views']`, `r['states']`, `r['legend']`, `r['period_label']`. Expected: `picker == ['Grupe', 'Lecții individuale', 'Antrenori']`, `views == ['Zi', 'Săptămână', 'Lună']`, states only from "Completat", "Necompletat", "Urmează", no `[role=tab]` on the page, every phone `no_side_scroll` True, `page_errors == []`.
- [ ] **Step 5: Look at the renders** next to av-1c and av-1b: every string of 5.1 word for word, no em dash, no middle dot, straight quotes, no pill or circle, no dashed or dotted line, day headers lower and smaller than P5 section titles, grid steps readable in light and dark (crop check). Fixes go into T6 or T7 files with `fix(prezenta): ...`, the affected steps repeated. The screenshots go to the companion in 11-5 T7.
- [ ] **Step 6: Clean up**: stop Strapi, `docker rm -f es111-pg`, `rm -rf "$T"`.

---

## Interfaces for other plans

- **11-2:** `PeriodHeader`, `coachPageTo`, `COACH_SEGMENT`, `PeriodRow`, `PeriodLessonRow`, `readPeriodQuery`, `bucharestNow`, `adminState`, `toCsv`, `csvNumber`, `csvDate`, `downloadLogLine`, `adminRoute`.
- **11-3, 11-4, 11-5:** `adminRoute`, `AdminArea`, `toCsv`, `csvNumber`, `csvDate`, `downloadLogLine`, `ron` (grouped), `groupedInt`, `bucharestNow`, the import guard (new admin files are checked automatically).
