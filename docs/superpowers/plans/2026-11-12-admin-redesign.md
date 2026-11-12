# Admin redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin "Club și școală" area as Grupe, Sportivi, Prezență (3 tabs), Contabilitate (Pe scurt + 4 tabs) and Tabele (own page), with filters behind "Filtre".

**Architecture:** Pure route/query helpers in `src/club/**` (tested with vitest), thin React pages in `src/admin/dashboard/**` that reuse the existing list components as tab bodies. One new pure presence read (group x dates matrix) with a JSON and an .xlsx route. Old pages become redirects.

**Tech Stack:** Strapi 5.23 admin (React 18, react-router-dom), TypeScript strict, vitest, `write-excel-file` 4.1.1 (already a dependency).

**Spec:** `docs/superpowers/specs/2026-11-12-admin-redesign-design.md` (approved by the user 2026-11-12, including S1 to S20).

## Global Constraints

- Copy Romanian, terse; no em or en dash, no middle dot, straight quotes, no emoji. "Rămas", never "Rest". Amounts "<n> RON", "." thousands.
- Visual: no pills or circles (spinner only), no dashed or dotted lines, no eyebrow labels; only components from `src/admin/ui` (Tabs, FilterPanel, Select, SegmentedControl, Popover, Button, DataTable, Window, PageHeader).
- Athlete names open the record in a new tab; group and coach links same tab.
- No server data model change. Money and presence rules unchanged (spec 7).
- Access unchanged (S1): routes keep their current `adminRoute(...)` / `adminGuard`; new matrix routes use `adminRoute('club')`; Tabele stays `money` (`TABLES_AREA`).
- Tests check behaviour only, no visual or screenshot tests. `npx vitest run <path> --maxWorkers=3`. Check `uptime` first; wait if load > 12.
- Commits: conventional, no AI attribution, no push.
- Filters use the existing `FilterPanel` (its trigger already shows the active count, its "Șterge tot" is the spec's "Resetează" of S3; no new reset link).
- `npx tsc --noEmit -p src/admin` and the server tsc must stay clean (run per task).

## Review Focus

1. A bookmarked old address with filters (`edusport-abonamente?state=expira14&group=<id>`) must land on the right tab with the same filter. Test in Task 2.
2. A month in the future in any `month=` param (Contabilitate, matrix) is clamped to the current month in the UI and refused (400) by the matrix route. Tests in Tasks 1 and 2.
3. A group with no occurrences in the chosen month, or a group id that is not a group (404), in the matrix. Test in Task 1.
4. A saved view id of a dropped ready-made (`rm-sportivi-activi`, `rm-sportivi-plati`) opened by link still loads. Test in Task 6.
5. Restanțe with Secțiune filter "Club" hides the Școala block and its total; "Total rămas" equals the sum of visible rows. Test in Task 3.

---

### Task 1: Group presence matrix (server)

**Files:**
- Create: `src/club/presence/attendance/group-matrix.ts`
- Create: `src/club/presence/attendance/group-matrix-xlsx.ts`
- Modify: `src/club/presence/attendance/api-types.ts` (add types)
- Modify: `src/api/club/routes/09-attendance.ts`, `src/api/club/controllers/attendance.ts`
- Test: `src/club/presence/attendance/__tests__/group-matrix.test.ts` (use the fake store of `attendance-period.test.ts`)

**Interfaces:**
- Produces:
  ```ts
  export type MatrixColumn = { date: string; startTime: string; sessionId: string | null; occurrenceKey: string | null; state: AdminState };
  export type MatrixCell = { grup: boolean; uscat: boolean };
  export type MatrixRow = { athleteId: string; name: string; visitor: boolean; cells: MatrixCell[]; present: number; of: number | null };
  export type GroupMatrix = { month: string; group: { id: string; name: string; program: string }; columns: MatrixColumn[]; rows: MatrixRow[] };
  export function readGroupMatrix(store: PresenceStore, groupId: string, month: unknown, now: { date: string; time: string }): Promise<AdminResult<GroupMatrix>>;
  export function groupMatrixXlsx(m: GroupMatrix): Promise<Buffer>;
  ```
  Routes: `GET /club/attendance/group-matrix?groupId&month` and `GET /club/attendance/group-matrix.xlsx?groupId&month`, both `adminRoute('club')`, placed before parameter paths. File name `prezenta-<group slug>-<YYYY-MM>.xlsx`.

Rules (spec 4.3): columns = `periodRowsKeepingNull(store, ctx, from, to, now, groupId)` (as `readGroupMonth`), oldest first, cancelled dates excluded by that function; rows = athletes with a membership in the group active on any date of the month (`rosterOn` per column date, union), A-Z by name (`localeCompare('ro')`), then visitors (attendance rows of the month's sessions whose athlete is not in the union), A-Z. Cell from the attendance row of that column's session. `present` = cells with grup or uscat on completed columns. `of` = completed columns on dates where that athlete's membership was active (S19); `null` for visitors. Program = the group's schedule text used by the coach portal group page (reuse its helper; if none exists server side, `"<zile> <ora>"` from the season series, e.g. "Lu și Mi 19:00").

- [ ] **Step 1: Write failing tests** `group-matrix.test.ts`:
  - `refuses a month that is not YYYY-MM` -> `{ ok:false, status:400 }`; `refuses a future month` (month > `now.date` month) -> 400; `unknown group` -> 404.
  - `columns are the month's held occurrences and saved sessions, oldest first, break dates left out`.
  - `two sessions on one day give two columns`.
  - `unsaved past occurrence is necompletat and not counted in of`: athlete with 3 completed + 1 necompletat -> `of === 3`.
  - `member who joined on the 15th counts only sessions from the 15th`: `of === 2` of 4 completed.
  - `visitor rows come last with of null`.
  - `uscat-only presence counts as present`.
  - `empty month gives columns [] and rows of members with of 0`.
- [ ] **Step 2:** `npx vitest run src/club/presence/attendance/__tests__/group-matrix.test.ts --maxWorkers=3` -> FAIL (module missing).
- [ ] **Step 3:** Implement `readGroupMatrix` (one `sessions` read and one `attendances({ sessionIds })` read, no read per column) and `groupMatrixXlsx` (header row "Sportiv", "<Lu 2>"... "Total"; "x" for present, "x U"/"U" for uscat; Total "3/4"; bold frozen header like `src/club/tables/export.ts`).
- [ ] **Step 4:** Add the routes + controller methods; add a route test to `attendance-routes.test.ts`: both paths exist with `adminRoute('club')`.
- [ ] **Step 5:** Run the two test files -> PASS; server tsc clean.
- [ ] **Step 6:** Commit `feat(presence): group presence matrix by month, JSON and xlsx`.

### Task 2: Addresses: Contabilitate, Tabele, Prezență tab, redirects

**Files:**
- Create: `src/club/contabilitate/routes.ts`
- Modify: `src/club/tables/routes.ts`, `src/club/prezenta/routes.ts`, `src/club/bani/routes.ts`
- Test: `src/club/contabilitate/__tests__/routes.test.ts`, extend `src/club/prezenta/__tests__/views.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // contabilitate/routes.ts
  export const CONTABILITATE_PATH = '/plugins/edusport-contabilitate';
  export type ContabTab = 'restante' | 'abonamente' | 'plati' | 'pe-grupe';
  export type ContabQuery = { tab: ContabTab; month: string; rest: URLSearchParams }; // rest = the tab's own filter params
  export function readContabQuery(search: string, today: string): ContabQuery; // default tab 'restante'; month clamped to current like readBaniQuery
  export function contabTo(q: { tab?: ContabTab; month?: string; params?: Record<string, string> }): string;
  /** Old money page address -> new one, keeping month and filter params. null when `path` is not an old money page. */
  export function oldMoneyRedirect(path: string, search: string): string | null;
  // tables/routes.ts
  export const TABELE_PATH = '/plugins/edusport-tabele';
  export const tablesTo = (viewId: string | null): string; // now `${TABELE_PATH}${viewId ? `?v=${enc}` : ''}`
  export function readTabeleQuery(search: string): { viewId: string | null };
  export function oldTablesRedirect(search: string): string | null; // `vedere=tabele&v=x` -> tablesTo('x'); else null
  // prezenta/routes.ts
  export type PrezentaTab = 'de-completat' | 'toate' | 'tabel';
  PrezentaQuery gains: tab: PrezentaTab (default 'toate'), groupId: string | null, month: string (for tab 'tabel'; default current month, clamped)
  ```
  Mappings (spec 2): `edusport-abonamente` -> `tab=abonamente`; `edusport-plati` -> `tab=plati`; `edusport-de-incasat` -> `tab=restante`; `edusport-bani?view=prezentare` -> `tab=restante`; `view=contabilitate` -> `tab=pe-grupe`. Every other param (`month`, `state`, `group`, `method`, `type`, ...) is carried over unchanged.
- `bani/routes.ts`: `platiMonthTo`, `deIncasatMonthTo`, `abonamenteStateTo` now return `contabTo(...)` addresses.

- [ ] **Step 1: Failing tests:** `readContabQuery('', '2026-11-12')` -> `{ tab:'restante', month:'2026-11' }`; `month=2027-01` -> `'2026-11'`; `tab=bogus` -> `'restante'`; `oldMoneyRedirect('/plugins/edusport-abonamente', '?state=expira14&group=g1')` -> `'/plugins/edusport-contabilitate?tab=abonamente&state=expira14&group=g1'`; `oldMoneyRedirect('/plugins/edusport-bani','?view=contabilitate&month=2026-10')` -> `...?tab=pe-grupe&month=2026-10`; `oldMoneyRedirect('/plugins/edusport-grupe','')` -> `null`; `oldTablesRedirect('?vedere=tabele&v=rm-ramas')` -> `'/plugins/edusport-tabele?v=rm-ramas'`; `readPrezentaQuery('?tab=tabel&groupId=g1&month=2026-10', today).tab === 'tabel'`; `tab` missing -> `'toate'`; future `month` clamped.
- [ ] **Step 2:** Run -> FAIL.
- [ ] **Step 3:** Implement. Update existing tests that expect the old `tablesTo` / `platiMonthTo` strings.
- [ ] **Step 4:** Run `src/club/contabilitate src/club/prezenta src/club/bani src/club/tables` tests -> PASS.
- [ ] **Step 5:** Commit `feat(admin): addresses for Contabilitate, Tabele, Prezență tabs and old-page redirects`.

### Task 3: Contabilitate page and menu

**Files:**
- Create: `src/admin/dashboard/ContabilitatePage.tsx`, `src/admin/dashboard/bani/RestanteTab.tsx`, `src/admin/dashboard/RedirectPage.tsx`
- Modify: `bani/DeIncasatList.tsx`, `bani/PlatiList.tsx`, `bani/AbonamenteList.tsx`, `bani/BaniCards.tsx`, `bani/BaniAccounting.tsx`, `src/admin/dashboard/menu.tsx`, `src/club/presence/copy/money-ui.ts`
- Delete: `BaniPage.tsx`, `DeIncasatPage.tsx`, `PlatiPage.tsx`, `AbonamentePage.tsx` (their routes now render `RedirectPage`)
- Test: `src/club/bani/__tests__/restante.test.ts` (pure helpers), extend `src/admin` render test if one exists for Bani (`grep -rl BaniPage src/**/__tests__`), else none

**Interfaces:**
- Consumes: Task 2 `readContabQuery`, `contabTo`, `oldMoneyRedirect`, `CONTABILITATE_PATH`.
- Produces:
  - `DeIncasatList`, `PlatiList`, `AbonamenteList` each export a `...Body({ month, params, setParams, actionsHost })` that renders no `AdminPage`/`Window`/`PageHeader`; the page components are removed. Their filter state keeps living in the URL params they read today.
  - `BaniCards` takes `onOpen(tab: ContabTab, params: Record<string,string>)` instead of links; same figures.
  - Pure helpers in `src/club/bani/restante.ts`: `restanteBlocks(page: DuePage, section: 'toate'|'scoala'|'club'): { key:'scoala'|'club'; rows; total: number }[]`.
  - `RedirectPage`: reads `useLocation()`, computes `oldMoneyRedirect(pathname-prefix, search) ?? oldTablesRedirect(search)`, `<Navigate replace>`.

Screen (spec 5): `AdminPage` > `Window` > `PageHeader` title "Contabilitate", month stepper (move from BaniPage) in `actions`; then "Pe scurt" (BaniCards, `area: 'money'` [S1]); then `Tabs` items "Restanțe" / "Abonamente" / "Plăți" / "Pe grupe" inside the header window; then the active tab body in its own `Window` with its sub line:
- Restanțe: sub "<Luna an>"; `FilterPanel` sections Secțiune (single; "Toate", "Școala de patinaj", "Club") and Grupă; two `Section`s "Școala de patinaj" (sub "Toate abonamentele neachitate integral") and "Club"; each ends with "Total rămas: <n> RON"; each row ends with "+ Plată" (existing RowMenu action, now a button).
- Abonamente: sub "Școala de patinaj"; actions "Prelungește abonamentele", "+ Abonament"; FilterPanel as today.
- Plăți: sub "Încasate în <luna> <an>"; FilterPanel (Metodă, Tip); "+ Plată"; footer "Total încasat: <n> RON"; keep "Nr. chitanță".
- Pe grupe: sub "Datorat și încasat pe secțiuni, grupe și metode de plată"; BaniBreakdown, then BaniAccounting without its "Plăți din lună" list (S14), "Export contabil" kept.
Menu: `EDUSPORT_LINKS` club group = Grupe, Sportivi, Prezență, `{ to: CONTABILITATE_PATH, label: 'Contabilitate', icon: ChartPie, group:'club' }`, `{ to: TABELE_PATH, label: 'Tabele', icon: GridFour, group:'club', area: TABLES_AREA }`. `addMenuLink` for Contabilitate (position 7) and Tabele (Task 6 fills the page; register now with a placeholder import of the existing `TabelePage`). Old four money paths and nothing else: `app.router.addRoute({ path: '<path>/*', lazy: RedirectPage })` instead of `addMenuLink`.

- [ ] **Step 1: Failing tests** `restante.test.ts`: `section 'club' returns only the club block`; `total equals the sum of rows' rămas`; `school block ignores month` (same rows for two months).
- [ ] **Step 2:** Run -> FAIL. **Step 3:** Implement helpers, page, bodies, menu, redirects.
- [ ] **Step 4:** Tests PASS; admin tsc clean; manual check on local 1340 is NOT done here (final task).
- [ ] **Step 5:** Commit `feat(admin): Contabilitate page replaces Abonamente, Plăți, De încasat and Bani`.

### Task 4: Prezență tabs, De completat, Filtre

**Files:**
- Modify: `src/admin/dashboard/prezenta/PrezentaScreen.tsx`, `prezenta/GroupsList.tsx`, `src/admin/dashboard/PrezentaPage.tsx`, `src/club/presence/copy/prezenta-ui.ts`
- Create: `src/admin/dashboard/prezenta/UndoneTab.tsx`, `src/club/prezenta/filter-rows.ts`
- Test: `src/club/prezenta/__tests__/filter-rows.test.ts`

**Interfaces:**
- Consumes: Task 2 `PrezentaQuery.tab`.
- Produces: `filterPeriodRows<T extends { groupId: string }>(rows: T[], f: { sectionId: string | null; groupIds: string[] }, groups: { id: string; sectionId: string }[]): T[]`; copy `PERIOD_COPY.tabs = { deCompletat: 'De completat', toate: 'Toate ședințele', tabel: 'Tabel pe grupă' }`, `PERIOD_COPY.noUndone = 'Nicio ședință de completat.'`, `PREZENTA_COPY.sub = 'Ședințe și prezențe pe grupe'`.

Screen (spec 4): header window: title "Prezență", sub "Ședințe și prezențe pe grupe", `Tabs` with count on De completat (count from `page.undone.length`; read once via `api.period(today, today)` if the active tab did not load it; `count` null at 0). Tab "toate": the current bar (PeriodHeader, picker, Listă/Grilă) + `FilterPanel` (Secțiune single, Grupă multi; params `sectiune`, `grupa`) applied client side to Grupe rows (list and grid rows); sub line = period label; GroupsList no longer renders the undone block. Tab "de-completat": `UndoneTab` = the undone DataTable (columns Data, Ora, Grupă, Antrenor, Stare), row opens the session panel, empty line `noUndone`. Tab "tabel": Task 5 component (placeholder `null` until then). Actions "+ Ședință nouă" / "+ Lecție individuală" / "Export CSV" only on tab "toate".

- [ ] **Step 1: Failing tests:** `filterPeriodRows` with section of Club keeps only club groups; with groupIds keeps those; empty filter returns all.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** tests + prezenta tests PASS; admin tsc clean.
- [ ] **Step 5:** Commit `feat(admin): Prezență tabs, De completat on its own, filters behind Filtre`.

### Task 5: Tabel pe grupă (admin UI)

**Files:**
- Create: `src/admin/dashboard/prezenta/GroupMatrixTab.tsx`, `src/club/prezenta/matrix-view.ts`
- Modify: `prezenta/api.ts` (add `groupMatrix(groupId, month)` and `groupMatrixXlsxUrl(groupId, month)`), `PrezentaScreen.tsx`
- Test: `src/club/prezenta/__tests__/matrix-view.test.ts`

**Interfaces:**
- Consumes: Task 1 `GroupMatrix`, route paths; Task 2 `PrezentaQuery.groupId/month`.
- Produces: `columnHeader(c: MatrixColumn, sameDay: boolean): string` ("Lu 2", "Lu 2, 18:00"); `cellText(c: MatrixCell): '' | 'x' | 'x U' | 'U'` used only for screen readers and the check/"U" rendering; `totalText(r: MatrixRow): string` ("3/4", visitor "3").

Screen (spec 4.3): controls `Select` "Grupă" (groups of the season, default first group in P4 order; persisted in `groupId`), month stepper "<" "<Luna an>" ">" (next disabled at current month), button "Descarcă Excel" (downloads `groupMatrixXlsxUrl`). Sub line "<grupă>, <program>". Table: sticky first column "Sportiv" (name links to record, new tab), one column per `MatrixColumn` (header text, "azi" under today's, "necompletat" under unsaved past in the orange state colour token, future columns faded and cells shaded), check icon (success token) for grup, "U" for uscat, "Total". Visitors under a group row "Vizitatori". Column header click opens the existing session panel (`SessionPanel` with sessionId or occurrenceKey). Empty: "Nicio ședință în luna asta.". Phone: the box scrolls sideways.

- [ ] **Step 1: Failing tests** for `columnHeader`, `cellText`, `totalText` with the spec's strings.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS; admin tsc clean.
- [ ] **Step 5:** Commit `feat(admin): Prezență "Tabel pe grupă" with Excel download`.

### Task 6: Tabele page: own route, rail, ready-made list

**Files:**
- Create: `src/admin/dashboard/TabeleRoutePage.tsx`, `src/admin/dashboard/sportivi/tabele/SavedRail.tsx`
- Modify: `src/admin/dashboard/SportiviPage.tsx` (drop tabs), `sportivi/SportiviList.tsx` (drop `tabs` prop), `sportivi/tabele/TabelePage.tsx`, `src/club/tables/ready-made.ts`, `src/club/tables/copy.ts`, `src/club/tables/types.ts` (`SavedViewRow.listed?: boolean`)
- Test: extend `src/club/tables/__tests__/tables-routes.test.ts` or a new `ready-made.test.ts`; `src/club/tables/__tests__/rail.test.ts`

**Interfaces:**
- Consumes: Task 2 `TABELE_PATH`, `readTabeleQuery`, `tablesTo`.
- Produces: `railGroups(views: SavedViewRow[], meId: string): { key: 'gata' | 'mele' | 'colegi'; title: string; views: SavedViewRow[] }[]` in `src/club/tables/rail.ts` (colegi omitted when empty; ready-made with `listed === false` omitted).

Ready-made (S16): copy `ramas: 'Restanțe'`, new `contacte: 'Date de contact'` view `rm-contacte` (subject sportivi, scope season, columns `['sportiv','grupa','parinte','telefon','email']`, sort `grupa` asc then the server's default by name). Order: platiGrupa, prezentaGrupa, ramas, expira, contacte. `rm-sportivi-activi` and `rm-sportivi-plati` stay in `READY_MADE` with `listed: false`. Rail copy: "Tabele salvate", "Gata făcute", "Ale mele", "Ale colegilor". Own view "..." menu: "Redenumește", "Duplică", "Șterge" (existing NewViewModal / delete with undo). Phone: rail replaced by `Select` "Tabel salvat". Header: title "Tabele", actions "Salvează", "Exportă" (Task 7 fills Exportă; keep existing download buttons until then).

- [ ] **Step 1: Failing tests:** `readyMadeFor` returns `rm-sportivi-activi` (still resolvable); `railGroups` omits `listed:false`, puts own views in `mele`, others in `colegi`, omits `colegi` when empty; ready-made order equals the five ids above.
- [ ] **Step 2:** FAIL. **Step 3:** implement; register `TABELE_PATH` page in menu (replace Task 3 placeholder); `SportiviPage` with `?vedere=tabele` renders `RedirectPage`.
- [ ] **Step 4:** PASS (`src/club/tables`); admin tsc clean.
- [ ] **Step 5:** Commit `feat(admin): Tabele as its own page with saved-tables rail`.

### Task 7: Tabele control row, columns popover, header sort, aspect, export

**Files:**
- Create: `sportivi/tabele/ControlRow.tsx`, `sportivi/tabele/ColumnsPopover.tsx`, `sportivi/tabele/ExportMenu.tsx`, `src/club/tables/header-sort.ts`, `src/club/tables/aspect.ts`
- Modify: `TabelePage.tsx`, `ResultTable.tsx`, `src/club/tables/builder-state.ts`
- Delete: `Builder.tsx`, `ViewBar.tsx` (and `ColumnList.tsx` if replaced by the popover)
- Test: `src/club/tables/__tests__/header-sort.test.ts`, `aspect.test.ts`, extend `builder-state.test.ts`, keep `admin-tabele-render.test.ts` passing (update its expectations to the new controls)

**Interfaces:**
- Produces: `nextSort(cur: TableDefinition['sort'], column: string): TableDefinition['sort']` (none -> asc -> desc -> null); `readAspect(): 'lista' | 'foaie'` / `writeAspect(a)` (localStorage key `edusport.tabele.aspect`, try/catch, default `'lista'`); builder-state `setSubject(state, subject)` resets columns to the subject's catalog defaults, filters to [], groupBy to null, sort to null.

Control row (spec 6.3), one wrapping row: "Tabel: <Subiect> ▾" (bold; options "Sportivi", "Plăți", "Abonamente", "Prezențe"), season, period ("Tot sezonul" + months), "Secțiune: <x> ▾", "Grupă: <x> ▾", "+ Filtru" (existing FilterList logic in a Popover; a set filter shows as a button "<coloană>: <valoare>" with a remove "x"), separator, "Grupează: <x> ▾", "Coloane (<n>) ▾" (Popover: search "Caută coloană", "Afișate, în ordine" draggable via `useDragReorder`, "Ascunse"), then "Aspect:" SegmentedControl "Listă" / "Foaie de calcul". Count line "<n> de sportivi" / "plăți" / "abonamente" / "prezențe". Header click = `nextSort`, `aria-sort` set. "Foaie de calcul": class switch on ResultTable adding cell borders, "#" column (blank on group/subtotal rows), sticky header and first column, zebra rows. "Salvează" (spec 6.5): own view -> save over; else modal "Vizualizare nouă". "Exportă": Popover menu "Excel (.xlsx)", "CSV", muted line "Exact ce vezi: <r> rânduri, <c> coloane, cu filtrele aplicate".

- [ ] **Step 1: Failing tests:** `nextSort` cycle; `setSubject` resets; `readAspect` returns 'lista' when storage throws.
- [ ] **Step 2:** FAIL. **Step 3:** implement; remove Builder/ViewBar. **Step 4:** `src/club/tables` PASS; admin tsc clean.
- [ ] **Step 5:** Commit `feat(admin): Tabele control row, column popover, header sort, aspect and one Exportă`.

### Task 8: Verify end to end on local

**Files:** none new (fixes only).

- [ ] **Step 1:** Full `npx vitest run --maxWorkers=3` (background, after `uptime` check) -> all pass; both tsc runs clean; `npx eslint src/admin src/club` clean.
- [ ] **Step 2:** Build admin and restart local 1340 (`strapi build` then `strapi start` on the test-main worktree after merging this branch there, DB edusport-test-pg). Click through as admin@example.invalid: menu has 5 club entries; old URLs redirect (one per old page); Contabilitate card click switches tab; Restanțe Secțiune filter; Prezență De completat count; Tabel pe grupă for a Club and a Școala group, Descarcă Excel opens in Excel-compatible form; Tabele rail, Tabel switch, sort, aspect, export.
- [ ] **Step 3:** Fix anything found, one commit per fix.
- [ ] **Step 4:** Update `docs/HANDOFF.md` "Admin redesign" line; commit `docs: admin redesign handoff`.
