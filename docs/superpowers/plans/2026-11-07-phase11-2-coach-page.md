# Phase 11-2: Coach Page and Click-Through Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every coach, athlete and group in a session or lesson panel is one click away, a coach has an admin page with hours, sessions and lessons for any period with a CSV, and a session panel opened from an abonament unit highlights that athlete.

**Architecture:** The coach page read is pure over bulk reads (`src/club/presence/coaches/page.ts`), counting as P5 4.3 and the 5.2 Antrenor rule; the CSV goes through the shared `toCsv`. The panels gain a read line of links; the coach page is a new admin route under the Prezență page splat, reusing 11-1's `PeriodHeader`.

**Tech Stack:** Strapi 5.52.1 (TypeScript), React 18 admin (`src/admin/ui`), Vitest 3, Python Playwright, Postgres 16.

**Spec:** `docs/superpowers/specs/2026-11-07-admin-views-design.md` 4.2, 4.4 (session `athlete` query), 4.8, 4.9, 5 (intro: link targets), 5.2, 5.3, 8. Mockup: `.superpowers/admin-views/screens/av-2-prezenta-detalii.html` (q1 A, q2 A, q3 C). Index: `docs/superpowers/plans/2026-11-07-phase11-index.md` (contracts, ruling 13). Plan 11-1 "Interfaces for other plans".

**Base:** `feat/athletes` with 11-1 merged. Branch `feat/p11-2`. Runs in parallel with 11-3; shared files: `09-attendance.ts`, `controllers/attendance.ts` (different routes and handlers); the second plan to merge rebases.

**Parallel groups:** A: T1, T3 | B: T2 | C: T4, T5 | D: T6

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Coach page read, 3 Copy and views | base | 1: `coaches/page.ts`; 3: `copy/prezenta-ui.ts`, `src/club/prezenta/coach-view.ts` |
| B | 2 CSV, routes, panel `athlete` | 1 | `coaches/coach-csv.ts`, `attendance/panel.ts`, `09-attendance.ts`, controller |
| C | 4 Panel links, 5 Coach page | 2, 3 | 4: `SessionPanel.tsx`, `LessonPanel.tsx`, `PanelLinks.tsx`; 5: `CoachPage.tsx`, `PrezentaPage.tsx`, `api.ts` |
| D | 6 Boot check and renders | all | none |

## Global Constraints

- As plan 11-1 "Global Constraints" (repo, worktree checks, precedence, checks after every task, code rules, design, copy, synthetic data, commits, progress board with `11-2 T<n>`).
- Every route this plan adds uses `adminRoute(area)`: coach page `club`, coach CSV `money` (index, "Role areas").
- Period at most 42 days: 400 "Perioada e prea lungă." (`readPeriodQuery`).
- Links: an athlete opens `athleteRecordTo(id)` in a new browser tab (`target="_blank"`, `rel="noopener"`); a coach or group opens in the same tab [P11 av2-q3; S36].
- Task 6: `es112-pg` on 127.0.0.1:55473 (11-1's container is gone by then), Strapi 1392.

## Review Focus

- **A coach on a session only through the group** (session unsaved) counts it in "Ședințe", but its hours count only once the session is saved with someone present (P5 4.3); a coach removed from a saved session no longer sees it. Pinned by T1.
- **A coach id that is not a team member, or a team member who coaches nothing**: 404 "Antrenorul nu există." vs an empty page with the three empty texts. Pinned by T1 and T5 source test.
- **The CSV of a coach with a ";" or a quote in a group or athlete name**, and minutes like 50 written "0,8" hours: one line per counted item, Excel opens it in columns. Pinned by T2.
- **`athlete` naming someone not on the session** (moved away, or a typo): the panel opens normally, `highlightAthleteId` null, no error. Pinned by T2.
- **Back link** from the coach page goes to where the admin came from (Prezență with Antrenori and the same period, or the panel's page), else Prezență with Antrenori. Pinned by T5 source test and T6 click-through.

## Review batch

High task T2 is reviewed in batch R1 with 11-1 T1 and T5 (index). The plan's final review (Opus) runs after T6.

---

### Task 1: Coach page read (low, Sonnet)

**Files:**
- Create: `src/club/presence/coaches/page.ts`
- Modify: `src/club/presence/attendance/api-types.ts` (`CoachPage`), `src/club/presence/copy/core.ts` (`coachNotFound: 'Antrenorul nu există.'`)
- Test: `src/club/presence/__tests__/coach-page.test.ts`

**Interfaces:**
- Consumes: 11-1 `readPeriod` internals (`loadRowContext`, `rowsBetween`), `listLessons`, `adminState`, `hoursText`, `presentCounts`, `rosterOn`.
- Produces: `CoachPage = { name: string; totals: { sessions: number; lessons: number; hours: string }; days: { date: string; sessions: number; lessons: number; hours: string }[]; sessions: PeriodRow[]; lessons: PeriodLessonRow[] }`; `readCoachPage(store: PresenceStore, coachId: string, period: Period, now: { date; time }): Promise<AdminResult<CoachPage>>`.
  - `sessions`: rows of the period whose `coachIds` include the coach (saved: the session's coaches; unsaved: the group's), state not null, newest first (date desc, time desc) [P11 scr av2].
  - `lessons`: lessons of the period with the coach, newest first.
  - Counts: `totals.sessions` / `lessons` and `days` count what P5 4.3 counts (saved sessions with present > 0, lessons with `present` true); `hours` by `hoursText`; `days` only days with hours, ascending.
  - 404 `coachNotFound` when `coachId` is not in `store.teamMembers()`.

- [ ] **Step 1: Write the failing test** on `attendanceSeed()` (coach `Virgil Pascu` on group `Profesioniști`; a saved session with 2 present; an unsaved held occurrence; a saved session where he was removed from the coaches; a present 50 min lesson and an absent one):

```ts
it('lists the coach sessions by the 5.2 rule and counts hours as 4.3', async () => {
  const page = ok(await readCoachPage(f.store, VIRGIL, { from: '2026-11-01', to: '2026-11-30' }, { date: '2026-11-20', time: '20:00' }));
  expect(page.sessions.map((r) => [r.date, r.adminState])).toEqual([['2026-11-20', 'necompletat'], ['2026-11-14', 'completat']]);
  expect(page.totals).toEqual({ sessions: 1, lessons: 1, hours: '1,8' });
  expect(page.days).toEqual([{ date: '2026-11-14', sessions: 1, lessons: 0, hours: '1,0' }, { date: '2026-11-18', sessions: 0, lessons: 1, hours: '0,8' }]);
});
it('answers 404 for an unknown coach', async () => {
  expect(await readCoachPage(f.store, 'nope', P, NOW)).toEqual({ ok: false, status: 404, error: 'Antrenorul nu există.' });
});
```

(Adjust only the seed's dates and durations so the numbers hold; the expectations are the rule.)

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/coach-page.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** with one `rowsBetween`, one `lessons({ from, to })`, one attendance read for the saved sessions.
- [ ] **Step 4: Run** `npx vitest run`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/coaches/page.ts src/club/presence/attendance/api-types.ts src/club/presence/copy/core.ts src/club/presence/__tests__/coach-page.test.ts
git commit -m "feat(presence): coach page read for any period"
```

---

### Task 2: Coach CSV, routes and the panel `athlete` query (high, Sonnet)

**Files:**
- Create: `src/club/presence/coaches/coach-csv.ts`
- Modify: `src/club/presence/attendance/panel.ts` (`readPanelQuery`, `SessionPanel`), `src/club/presence/attendance/api-types.ts`, `src/api/club/routes/09-attendance.ts`, `src/api/club/controllers/attendance.ts`
- Test: `src/club/presence/__tests__/coach-page.test.ts` (CSV), `attendance-panel.test.ts`, `attendance-routes.test.ts`

**Interfaces:**
- Produces: `COACH_CSV_HEADER = ['Data', 'Tip', 'Grupă sau sportiv', 'Ora', 'Durată', 'Ore']` (in `copy/attendance.ts`); `coachCsv(page: CoachPage): string` (one line per counted session or lesson, oldest first: `csvDate`, "Grup" or "Individual", group name or athlete name, "HH:mm", "<n> min", hours as `hoursText`); `coachCsvName(name: string, period: Period): string` -> `antrenor-<slug>-<from>-<to>.csv` (slug ruling 13: lower case, diacritics folded, letters and digits, "-"); `SessionPanel.highlightAthleteId: string | null` (the `athlete` query when that athlete has a row in the panel, else null); `readPanelQuery` keeps every P5 form and reads optional `athlete`.
- Routes (static before params): `GET /club/coaches/:documentId/presence` -> `attendance.coachPage` (`adminRoute('club')`); `GET /club/coaches/:documentId/presence.csv` -> `attendance.coachCsv` (`adminRoute('money')`, `text/csv; charset=utf-8`, attachment name from `coachCsvName`, one `downloadLogLine({ adminId, kind: 'coach-csv', rows })`). The `.csv` path is declared before the plain path.

- [ ] **Step 1: Write the failing tests**:

```ts
it('writes the coach CSV, one line per counted item (4.2)', () => {
  const csv = coachCsv(pageWith([{ kind: 'grup', date: '2026-11-14', name: 'Grupa "A"; seara', time: '17:00', min: 60 }, { kind: 'individual', date: '2026-11-18', name: 'Ana Ionescu', time: '18:00', min: 50 }]));
  expect(csv).toBe('﻿Data;Tip;Grupă sau sportiv;Ora;Durată;Ore\r\n14.11.2026;Grup;"Grupa ""A""; seara";17:00;60 min;1,0\r\n18.11.2026;Individual;Ana Ionescu;18:00;50 min;0,8\r\n');
  expect(coachCsvName('Andrei Popă', { from: '2026-11-01', to: '2026-11-30' })).toBe('antrenor-andrei-popa-2026-11-01-2026-11-30.csv');
});
it('marks the athlete to highlight only when on the session (4.4)', async () => {
  expect(ok(await readSessionPanel(f.store, { id: S14, athlete: A1 }, TODAY)).highlightAthleteId).toBe(A1);
  expect(ok(await readSessionPanel(f.store, { id: S14, athlete: 'other' }, TODAY)).highlightAthleteId).toBeNull();
});
it('coach routes name their areas', () => {
  expect(areaOfRoute(byPath('GET /club/coaches/:documentId/presence').config)).toBe('club');
  expect(areaOfRoute(byPath('GET /club/coaches/:documentId/presence.csv').config)).toBe('money');
});
```

The exact-list route test gains both paths (the `.csv` one first).

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/presence/__tests__/coach-page.test.ts src/club/presence/__tests__/attendance-panel.test.ts src/club/presence/__tests__/attendance-routes.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement**; the handlers read the period with `readPeriodQuery` and `bucharestNow(new Date())`.
- [ ] **Step 4: Run** `npx vitest run`, both `tsc`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/coaches/coach-csv.ts src/club/presence/copy/attendance.ts src/club/presence/attendance/panel.ts src/club/presence/attendance/api-types.ts src/api/club/routes/09-attendance.ts src/api/club/controllers/attendance.ts src/club/presence/__tests__/coach-page.test.ts src/club/presence/__tests__/attendance-panel.test.ts src/club/presence/__tests__/attendance-routes.test.ts
git commit -m "feat(attendance): coach page routes and CSV, session highlight"
```

---

### Task 3: Coach page copy and views (low, Haiku)

**Files:**
- Modify: `src/club/presence/copy/prezenta-ui.ts`
- Create: `src/club/prezenta/coach-view.ts`
- Test: `src/club/prezenta/__tests__/coach-view.test.ts`

**Interfaces:**
- Produces (copy, exact): `COACH_COPY = { subtitle: 'Antrenor', back: 'Înapoi', tiles: { sessions: 'Ședințe grup', lessons: 'Lecții individuale', hours: 'Ore' }, picker: { ore: 'Ore', sedinte: 'Ședințe', lectii: 'Lecții individuale' }, total: 'Total', emptySessions: 'Nicio ședință în perioada asta.', emptyLessons: 'Nicio lecție individuală în perioada asta.', emptyHours: 'Nicio oră în perioada asta.' }`; `PANEL_LINKS = { coaches: 'Antrenori: ', openGroup: 'Deschide grupa' }`. Columns reuse `PREZENTA_COPY` ("Data", "Ora", "Grupă", "Prezenți", "Stare", "Sportiv", "Durată", "Ședințe grup", "Lecții individuale", "Ore").
- Produces (`coach-view.ts`): `CoachShow = 'ore' | 'sedinte' | 'lectii'` (default `sedinte`) [S46]; `readCoachQuery(search, today): { view: PeriodView; date: string; show: CoachShow }` (missing view: `luna` [S45]); `coachRowDate(date, today)` ("Mie 4 noi", year added outside the current year); `durationText(min)` ("50 min", reuse P5); `backTarget(state: unknown): string` (a `from` path in `location.state` that starts with `/plugins/edusport-`, else `prezentaTo({ show: 'antrenori' })`).

- [ ] **Step 1: Write the failing test** with the examples above, plus `readCoachQuery('', '2026-11-06')` -> `{ view: 'luna', date: '2026-11-06', show: 'sedinte' }` and `backTarget({ from: 'https://evil' })` -> the Prezență fallback.
- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/prezenta/__tests__/coach-view.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/copy/prezenta-ui.ts src/club/prezenta/coach-view.ts src/club/prezenta/__tests__/coach-view.test.ts
git commit -m "feat(prezenta): coach page copy and views"
```

---

### Task 4: Links in the session and lesson panels (low, Sonnet)

**Files:**
- Create: `src/admin/dashboard/prezenta/PanelLinks.tsx`
- Modify: `src/admin/dashboard/prezenta/SessionPanel.tsx`, `LessonPanel.tsx`, `styles.ts`, `api.ts` (`session(..., athlete?)`)
- Test: `src/club/prezenta/__tests__/admin-prezenta.test.ts` (extend)

**Interfaces:**
- Produces: `CoachLinks({ coaches: { id: string; name: string }[]; from: string })` (the read line "Antrenori: <nume>, <nume>", each a link to `coachPageTo(id, 'luna', date)` passing `state: { from }`) [S43, S45]; `AthleteLink({ id, name })` (new tab); `SessionPanel` prop `highlightAthleteId` scrolls that row into view and gives it the selected-row background [S44].

- [ ] **Step 1: Write the failing source tests**: `SessionPanel.tsx` renders `CoachLinks` above `CoachFields`, links the title's group name with `groupPageTo(` and shows `PANEL_LINKS.openGroup` under the title; every athlete name in `SessionPanel.tsx` and `LessonPanel.tsx` goes through `AthleteLink`; `PanelLinks.tsx` contains `target="_blank"` and `rel="noopener"` for athletes and neither for coaches; `scrollIntoView` is called for the highlighted row; no `dashed` or `dotted`.
- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/prezenta/__tests__/admin-prezenta.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement**; coach names come from the panel's `coachIds` and the coach options the panel already loads; links stay keyboard reachable; the editors stay unchanged.
- [ ] **Step 4: Run** all checks; Expected: PASS, 0, exit 0.
- [ ] **Step 5: Commit**

```bash
git add src/admin/dashboard/prezenta/PanelLinks.tsx src/admin/dashboard/prezenta/SessionPanel.tsx src/admin/dashboard/prezenta/LessonPanel.tsx src/admin/dashboard/prezenta/styles.ts src/admin/dashboard/prezenta/api.ts src/club/prezenta/__tests__/admin-prezenta.test.ts
git commit -m "feat(prezenta): coach, athlete and group links in the panels"
```

---

### Task 5: Coach page (low, Sonnet)

**Files:**
- Create: `src/admin/dashboard/prezenta/CoachPage.tsx`
- Modify: `src/admin/dashboard/PrezentaPage.tsx` (splat `antrenor/<id>` -> `CoachPage`, as `SportiviPage` does with `recordIdFromSplat`), `src/admin/dashboard/prezenta/api.ts` (`coachPage(id, from, to)`, `coachCsv(id, from, to)`)
- Test: `src/club/prezenta/__tests__/admin-prezenta.test.ts` (extend)

**Interfaces:**
- Consumes: 11-1 `PeriodHeader`; T2 routes; T3 views.
- Produces: the page of spec 5.3: back link "Înapoi" (`backTarget`), title "<nume>", subtitle "Antrenor", `PeriodHeader` plus "Export CSV" at the right, three square `StatTile`s, `SegmentedControl` "Ore" / "Ședințe" / "Lecții individuale" (no `Tabs`), the three tables (Ore with a last "Total" row; Ședințe rows open `SessionPanel`, group name a link; Lecții rows open `LessonPanel`, athlete a new-tab link), the empty texts; address `?view=&date=&show=`.

- [ ] **Step 1: Write the failing source tests**: `CoachPage.tsx` imports no `Tabs`, uses `SegmentedControl`, `StatTile`, `PeriodHeader`, `COACH_COPY.back`, `downloadPdf(` with `coachCsv`; `PrezentaPage.tsx` routes the `antrenor` splat to `CoachPage`; no `dashed`, `dotted` or round radius.
- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/prezenta/__tests__/admin-prezenta.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement**; phone: tiles stack, tables become cards (P5 pattern).
- [ ] **Step 4: Run** all checks; Expected: PASS, 0, exit 0.
- [ ] **Step 5: Commit**

```bash
git add src/admin/dashboard/prezenta/CoachPage.tsx src/admin/dashboard/PrezentaPage.tsx src/admin/dashboard/prezenta/api.ts src/club/prezenta/__tests__/admin-prezenta.test.ts
git commit -m "feat(prezenta): coach page with hours, sessions and lessons"
```

---

### Task 6: Boot check, click-through and renders (low, Sonnet)

**Files:** none in the repo. `T=${TMPDIR:-/tmp}/es112`. PNGs to `.../phase11-renders/11-2-<name>-<desktop|phone>.png`.

- [ ] **Step 1: Database, build, data**: as 11-1 Task 8 Step 2 with `es112`, port 55473, Strapi 1392; in addition a coach `K` on two groups, a saved session of each, one unsaved held occurrence, two lessons of `K` (one present, one absent), an athlete with a `;` in a group name.
- [ ] **Step 2: Curl checks**

```bash
api GET "/club/coaches/$K/presence?from=$FROM&to=$TO" | py "d=d['data']; print(d['name'], d['totals'], len(d['sessions']), len(d['lessons']))"
api GET "/club/coaches/nope/presence?from=$FROM&to=$TO"
api GET "/club/coaches/$K/presence?from=2026-01-01&to=2026-03-01"
curl -s -D - -o $T/k.csv -H "Authorization: Bearer $JWT" "http://127.0.0.1:1392/api/club/coaches/$K/presence.csv?from=$FROM&to=$TO" | grep -i content-disposition; head -c 3 $T/k.csv | xxd
api GET "/club/attendance/session?id=$S&athlete=$A" | py "print(d['data']['highlightAthleteId'])"
```

Expected: totals match the saved sessions with present > 0 and the present lesson; unknown: 404 "Antrenorul nu există."; 60 days: 400 "Perioada e prea lungă."; `attachment; filename="antrenor-<slug>-<from>-<to>.csv"`, file starts `efbbbf`, the `;` name quoted; `highlightAthleteId` equals `$A`; one `[download] ... kind=coach-csv` log line without names. Restart Strapi once: no error.

- [ ] **Step 3: Click-through and renders** (11-1 pattern): `antrenori-lista` -> click a coach -> `antrenor-sedinte`; picker `Ore` -> `antrenor-ore`, `Lecții individuale` -> `antrenor-lectii`; "Înapoi" returns to Antrenori with the same period (`r['back_url']`); open a session from the coach page -> `panou-linkuri` (`r['coach_links']`, `r['athlete_link_targets']` all `_blank`); "Deschide grupa" -> the group page (`r['group_url']`); `/club/attendance/session?...&athlete=` opened from the address -> `panou-evidentiat`. Expected: no `[role=tab]`, phone `no_side_scroll` True, `page_errors == []`.
- [ ] **Step 4: Look at the renders** next to av-2 (q1 A, q2 A): texts of 5.2 and 5.3 word for word, square tiles, no pill, circle, dashed or dotted line. Fixes in T3 to T5 files with `fix(prezenta): ...`.
- [ ] **Step 5: Clean up**: stop Strapi, `docker rm -f es112-pg`, `rm -rf "$T"`.

---

## Interfaces for other plans

- **11-3:** the session panel's `athlete` query (`usePrezentaApi().session({ id }, athleteId)` and `SessionPanel` prop `highlightAthleteId`) for "Vezi zilele" rows; `AthleteLink`.
- **11-4, 11-5:** `AthleteLink` for athlete names in tables and the accounting list.
