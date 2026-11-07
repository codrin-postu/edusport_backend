# Phase 11-4: Table Builder and Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sportivi gets a "Tabele" tab: ready-made tables plus a builder over four subjects (Sportivi, Plăți, Abonamente, Prezență) with scope, columns, filters, one group-by level with subtotals and sort; saved views shared with their author; downloads in .xlsx and .csv of exactly the current definition, refused above 5.000 rows.

**Architecture:** The server accepts only catalog keys: a pure validator (`src/club/tables/definition.ts`) checks every definition against the catalog before anything is read; pure row builders per subject work on one bulk read per source table, restricted by the scope (`src/club/tables/sources.ts` over `PresenceStore`); grouping, sort, cap and the file shapes are pure. The only server-only file code is the xlsx writer over `exceljs` (pinned) in `src/club/files/xlsx.ts`. Saved views are a small table with their own store (Strapi + fake, parity) and the 8 s undo through a soft delete.

**Tech Stack:** Strapi 5.52.1 (TypeScript), `exceljs` 4.4.0 (exact), React 18 admin, Vitest 3, Python Playwright, Postgres 16.

**Spec:** `docs/superpowers/specs/2026-11-07-admin-views-design.md` 2.3, 3.4, 4.7, 4.8, 4.9, 5.5, 6 (table limits, S60, S61, S62), 8, builder defaults (whole months, 12-month cap, relative periods, removed columns and archived groups), 13 (S28 to S35, S50 to S53, S60 to S63). Mockup: `.superpowers/admin-views/screens/av-5-sportivi-tabele.html` (q1 B, q2 B combination, q3 A, q4 A, q5 A, q6 A). Index: `docs/superpowers/plans/2026-11-07-phase11-index.md` (contracts "Tables", rulings 3, 4, 9, 10, 11).

**Base:** `feat/athletes` with 11-2 and 11-3 merged. Branch `feat/p11-4`.

**Parallel groups:** A: T1, T2, T8 | B: T3, T4, T6 | C: T5 | D: T7 | E: T9 | F: T10

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Catalog and validation, 2 xlsx writer, 8 Copy and views | base | 1: `tables/catalog.ts`, `definition.ts`, `period.ts`; 2: `package.json`, lockfile, `src/club/files/xlsx.ts`; 8: `tables/copy.ts`, `tables/view-state.ts` |
| B | 3 Sportivi and Abonamente rows, 4 Plăți and Prezență rows, 6 Saved views | 1 | 3: `rows-sportivi.ts`, `rows-abonamente.ts`, `sources.ts`; 4: `rows-plati.ts`, `rows-prezenta.ts`; 6: `src/api/table-view/**`, `tables/views-*.ts`, undo dispatch |
| C | 5 Group, sort, cap and the query runner | 3, 4 | `group.ts`, `sort.ts`, `query.ts`, `limit.ts`, `export.ts` |
| D | 7 Routes and controller | 2, 5, 6 | `13-tables.ts`, `controllers/tables.ts` |
| E | 9 Tabele screen | 7, 8 | `src/admin/dashboard/sportivi/tabele/**`, `SportiviPage.tsx`, `downloadPdf.ts` |
| F | 10 Volume fixture, boot check, renders | all | `scripts/fixtures/phase11-volume.js` |

## Global Constraints

- As plan 11-1 "Global Constraints" (repo, worktree checks, precedence, checks after every task, code rules, design, copy, synthetic data, commits, progress board with `11-4 T<n>`).
- Never let a definition carry SQL or field paths: only catalog keys, ops the column type allows, values of the column's type; anything else 400 "Cerere invalidă." before any read [2.3].
- Limits [6, S60, S61]: one season; Plăți and Prezență periods at most 12 months (400 "Perioada e prea lungă."); 1 to 20 columns, at most 10 filters, one group-by level; definition at most 16 KB; at most 5.000 records, else 422 "Tabelul are peste 5.000 de rânduri. Restrânge sfera sau filtrele." and nothing shown or downloaded (no silent cut); 10 s budget, else 503 "Tabelul durează prea mult. Restrânge sfera."; at most 2 queries or exports at a time per process, a third waits; at most 200 saved views ("Prea multe vizualizări salvate. Șterge una.").
- Money tables use whole months (Builder defaults): `PeriodSpec` is a month, "luna aceasta" or the season (ruling 3).
- Personal data in exports (names, phones, e-mails, parents, birth dates): files only through the authenticated `money` routes, never cached on disk, one log line per download without personal data or file names [S62].
- Every route of `13-tables.ts` uses `adminRoute('money')`; the Sportivi "Tabele" tab carries `TABLES_AREA: AdminArea = 'money'` for 6b.
- `exceljs` is imported only by `src/club/files/xlsx.ts`; the 11-1 import guard keeps it out of the admin bundle.
- The only tabs of phase 11: Sportivi "Listă" | "Tabele" [P11 av5-q1]. The builder's "Subiect" is a `SegmentedControl`.
- Every "Salvează" button of the Tabele screen and its modal sits inside `.ui-root` (SaveBar tagger opt-out).
- Task 10: `es114-pg` on 127.0.0.1:55475, Strapi 1394.

## Review Focus

- **A view saved by someone else, or a ready-made one, changed on screen**: only "Salvează ca nouă" is offered; a crafted `PUT` or `DELETE` by a non-author answers 403 "Doar autorul poate modifica vizualizarea." while a Super Admin may delete. Pinned by T6 and T8 (`actionsFor`).
- **A saved view naming a column the catalog no longer has, or a group or season that is archived or deleted**: the view opens with the column dropped or the filter ignored and one notice line; it never blocks [Builder defaults]. Pinned by T1 (`repairDefinition`) and T9 source test.
- **A definition one row over the cap** (5.001 records) on screen and in the download: 422, no partial table, no file. **Exactly 5.000** works. Pinned by T5 and T10.
- **Three downloads at once from three admins**: two run, the third waits and then succeeds; none times out because it waited (the 10 s budget starts when the work starts). Pinned by T5 (`createLimiter`) and T10.
- **Names with ";", quotes, leading "=", "+", "-", "@" in a CSV or xlsx cell** (formula injection when the accountant opens the file): text cells starting with one of `= + - @` are written with a leading apostrophe in CSV and as plain strings (never formulas) in xlsx. Pinned by T2 and T5 (`tableCsv`).

## Review batches

High tasks T1 and T2 are in batch R3 with 11-3 T7; T6 and T7 are in batch R4 with 11-5 T2 and T3 (index). The plan's final review (Opus) runs after T10.

---

## Catalog (T1 holds it; labels are the column headers, exact)

| Subject (`key`, label) | Columns `key: label (type)` |
|---|---|
| `sportivi`, "Sportivi" | `sportiv`: "Sportiv" (text), `varsta`: "Vârstă" (number), `dataNasterii`: "Data nașterii" (date), `grupa`: "Grupă" (label), `grupe`: "Grupe" (text), `sectiune`: "Secțiune" (label), `antrenor`: "Antrenor" (text), `parinte`: "Părinte" (text), `telefon`: "Telefon" (text), `email`: "E-mail" (text), `membruAcs`: "Membru A.C.S." (label), `stare`: "Stare" (label), `abonament`: "Abonament" (text), `expira`: "Expiră" (date), `prezente`: "Prezențe" (number), `dePlatit`: "De plătit" (money), `platit`: "Plătit" (money), `ramas`: "Rămas" (money), `starePlata`: "Stare plată" (label) |
| `plati`, "Plăți" | `data`: "Data" (date), `nrChitanta`: "Nr. chitanță" (text), `sportiv`, `grupa`, `sectiune`, `pentru`: "Pentru" (text), `metoda`: "Metodă" (label), `laPatinoar`: "La patinoar" (label), `suma`: "Sumă" (money), `inregistratDe`: "Înregistrat de" (text), `stare`: "Stare" (label, "anulată" or blank), `nota`: "Notă" (text) |
| `abonamente`, "Abonamente" | `cod`: "Cod" (text), `sportiv`, `grupa`, `abonament`: "Abonament" (text), `inceput`: "Început" (date), `expira`, `folosite`: "Folosite" (number), `pret`: "Preț" (money), `platit`, `ramas`, `stare` (label) |
| `prezenta`, "Prezență" | `data`, `ora`: "Ora" (text), `sportiv`, `grupa`, `tip`: "Tip" (label), `antrenor`, `plata`: "Plată" (text, `payLabel`), `suma`: "Sumă" (money) |

Ops by type: text `eq`, `in`, `empty`, `notEmpty`; label `eq`, `in`, `empty`, `notEmpty`; number, money, date `eq`, `gt`, `lt`, `empty`, `notEmpty`. Group by: `grupa`, `sectiune`, `antrenor` for every subject; `luna` for Plăți (`paidOn`), Abonamente (`startsOn`), Prezență (date), not Sportivi. Labels of the group-by list: "Fără", "Grupă", "Secțiune", "Lună", "Antrenor".

Ready-made views (`src/club/tables/ready-made.ts`, ids `rm-*`, author "Sistem", read only) [4.7]:

| Id | Name | Definition |
|---|---|---|
| `rm-plati-grupa` | "Plăți pe grupă luna aceasta" (default view, S51) | sportivi, `{ kind: 'current' }`, columns sportiv, dePlatit, platit, ramas, starePlata, group by grupa |
| `rm-prezenta-grupa` | "Prezență pe grupă" | prezenta, current month, columns data, ora, sportiv, tip, plata, group by grupa |
| `rm-sportivi-activi` | "Sportivi activi" | sportivi, season, filter stare eq "activ", columns sportiv, grupa, abonament, telefon |
| `rm-ramas` | "Rămas de plată" | sportivi, season, filter ramas gt 0, columns sportiv, grupa, dePlatit, platit, ramas, sort ramas desc |
| `rm-expira` | "Abonamente care expiră" | abonamente, season, filters stare eq "Activ", expira lt today + 14 (resolved at query time as the special value `"+14d"`), columns cod, sportiv, grupa, abonament, expira, folosite |
| `rm-sportivi-plati` | "Sportivi pe grupă, cu plăți" | sportivi, current month, columns sportiv, varsta, telefon, dePlatit, platit, ramas, starePlata, group by grupa |

---

### Task 1: Catalog, definition validation and periods (high, Sonnet)

**Files:**
- Create: `src/club/tables/catalog.ts`, `src/club/tables/ready-made.ts`, `src/club/tables/definition.ts`, `src/club/tables/period.ts`, `src/club/tables/types.ts`
- Test: `src/club/tables/__tests__/definition.test.ts`

**Interfaces:**
- Produces (`types.ts`): `Subject`, `ColumnType = 'text' | 'number' | 'money' | 'date' | 'label'`, `CatalogColumn = { key: string; label: string; type: ColumnType }`, `FilterOp`, `GroupKey`, `PeriodSpec` (index), `TableDefinition` (index), `CellValue = string | number | null`, `TableRow = { athleteId: string | null; groupKeys: Partial<Record<GroupKey, { key: string; label: string }[]>>; cells: Record<string, CellValue> }`.
- Produces: `CATALOG: Record<Subject, { label: string; columns: CatalogColumn[]; groupBy: GroupKey[] }>`; `READY_MADE: SavedViewRow[]`; `readDefinition(body: unknown, catalog = CATALOG): Checked<TableDefinition>` (shape, keys, ops by type, value types, 1..20 columns, unique columns, <= 10 filters, sort column among the columns, group-by allowed for the subject, JSON size <= 16 KB; else 400 "Cerere invalidă."); `repairDefinition(d: unknown, known: { seasons: string[]; sections: string[]; groups: string[] }): { definition: TableDefinition | null; notices: string[] }` (drops unknown columns and filters on them, ignores a missing section or group, falls back to the current season; notice texts from `TABLES_COPY.notices`, `COPY NEEDED` until the user gives them); `resolvePeriod(p: PeriodSpec, season: { start: string; end: string }, today: string): { from: string; to: string }` (null: the season; `current`: today's month; a month: that month; clipped to the season); `MAX_PERIOD_MONTHS = 12`.

- [ ] **Step 1: Write the failing test**

```ts
const base: TableDefinition = { subject: 'plati', scope: { seasonId: 's1', sectionId: null, groupId: null, period: { kind: 'current' } }, columns: ['data', 'suma'], filters: [], groupBy: null, sort: null };
it('accepts only catalog keys and allowed ops', () => {
  expect(readDefinition({ definition: base })).toEqual({ ok: true, value: base });
  for (const bad of [
    { ...base, subject: 'users' }, { ...base, columns: ['data', 'athlete.email'] }, { ...base, columns: [] },
    { ...base, columns: Array.from({ length: 21 }, () => 'data') }, { ...base, filters: [{ column: 'suma', op: 'in', value: ['1'] }] },
    { ...base, filters: [{ column: 'suma', op: 'gt', value: 'drop table' }] }, { ...base, groupBy: 'luna', subject: 'sportivi', columns: ['sportiv'] },
    { ...base, sort: { column: 'nota', dir: 'asc' } }, { ...base, scope: { ...base.scope, period: { from: '2026-01-01', to: '2027-12-31' } } },
  ]) expect(readDefinition({ definition: bad }).ok, JSON.stringify(bad)).toBe(false);
  expect(readDefinition({ definition: { ...base, filters: Array.from({ length: 11 }, () => ({ column: 'suma', op: 'gt', value: 1 })) } }).ok).toBe(false);
  expect(readDefinition({ definition: { ...base, columns: ['data'], extra: 'x'.repeat(17000) } }).ok).toBe(false);
});
it('repairs a stale saved view with notices, never blocks', () => {
  const r = repairDefinition({ ...base, columns: ['data', 'gone'], scope: { ...base.scope, groupId: 'g-old' } }, { seasons: ['s1'], sections: [], groups: [] });
  expect(r.definition?.columns).toEqual(['data']);
  expect(r.definition?.scope.groupId).toBeNull();
  expect(r.notices).toHaveLength(2);
});
it('resolves relative periods and keeps them inside the season', () => {
  expect(resolvePeriod({ kind: 'current' }, { start: '2026-09-01', end: '2027-08-31' }, '2026-11-06')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  expect(resolvePeriod(null, { start: '2026-09-01', end: '2027-08-31' }, '2026-11-06')).toEqual({ from: '2026-09-01', to: '2027-08-31' });
});
it('every ready-made view is valid', () => {
  for (const v of READY_MADE) expect(readDefinition({ definition: v.definition }).ok, v.name).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/tables/__tests__/definition.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** (pure; a filter value is checked against the column type: number and money finite numbers, date ISO or `"+<n>d"`, label among the column's known values, text at most 200 characters).
- [ ] **Step 4: Run** `npx vitest run`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/tables src/club/tables/__tests__/definition.test.ts
git commit -m "feat(tables): column catalog, ready-made views and definition validation"
```

---

### Task 2: `exceljs` pinned and the xlsx writer (high, Sonnet)

**Files:**
- Modify: `package.json`, `package-lock.json` (`npm install exceljs@4.4.0 --save-exact`)
- Create: `src/club/files/xlsx.ts`
- Test: `src/club/files/__tests__/xlsx.test.ts`

**Interfaces:**
- Produces: `XlsxCell = string | number | { date: string } | null`; `XlsxRowStyle = 'body' | 'group' | 'subtotal' | 'total'`; `XlsxSheet = { name: string; columns: { header: string; type: ColumnType }[]; rows: { cells: XlsxCell[]; style: XlsxRowStyle }[] }`; `writeXlsx(sheets: XlsxSheet[]): Promise<Buffer>` (sheet name cut to 31 characters with `[]:*?/\` removed; header bold, frozen (`views: [{ state: 'frozen', ySplit: 1 }]`), autofilter on the header; money and number cells as numbers with `numFmt '#,##0.00'` (money) or `'0'` / `'0.##'` (number); dates as Excel dates `dd.mm.yyyy`; group, subtotal and total rows bold; column width = longest text, 8 to 60 characters; a text cell starting with `=`, `+`, `-`, `@` stays a string value, never a formula); `xlsxName(name: string, date: string)` and `csvName(...)` (`<slug>-<YYYY-MM-DD>.xlsx`, slug as 11-2 ruling 13) [S35].

- [ ] **Step 1: Write the failing smoke test** (spec 8): write a sheet "Plăți pe grupă luna aceasta, noiembrie" with a header, a group row, two body rows (one name `=HYPERLINK("x")`), a subtotal and a total; read the buffer back with `new ExcelJS.Workbook().xlsx.load(buf)`; expect the sheet name length 31, `getRow(1).font.bold` true, `views[0].ySplit` 1, `autoFilter` set, the subtotal row bold, the money cell `value` a number `1200.5` with `numFmt '#,##0.00'`, the date cell a `Date`, the `=HYPERLINK` cell a string with no `formula`.
- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/files/__tests__/xlsx.test.ts`; Expected: FAIL.
- [ ] **Step 3: Install and implement**; check `npm ls exceljs` shows exactly 4.4.0 and the lockfile has no native build step (`grep -c '"hasInstallScript": true' package-lock.json` unchanged from before the install; report both numbers).
- [ ] **Step 4: Run** `npx vitest run`, `npx tsc --noEmit`, and the 11-1 import guard; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/club/files/xlsx.ts src/club/files/__tests__/xlsx.test.ts
git commit -m "feat(files): xlsx writer on exceljs 4.4.0"
```

---

### Task 3: Sources, Sportivi and Abonamente rows (low, Sonnet)

**Files:**
- Create: `src/club/tables/sources.ts`, `src/club/tables/rows-sportivi.ts`, `src/club/tables/rows-abonamente.ts`
- Test: `src/club/tables/__tests__/rows-sportivi.test.ts`, `rows-abonamente.test.ts`, `src/club/tables/__tests__/tables-seed.ts`

**Interfaces:**
- Consumes: `PresenceStore` reads (each called at most once per query, with the scope's range where the store takes one); P5 `clubMonths`, `schoolDue` rules, `subscriptionState`, `usedSlots`; 11-3 `SubscriptionRow.code`, `usesOf`.
- Produces: `TableSources = { athletes, memberships, groups, sections, seasons, teamNames, acs, attendances, sessions, lessons, subscriptions, payments }` (scope-restricted); `loadSources(store: PresenceStore, d: TableDefinition, period: { from; to }): Promise<TableSources>` (only the tables the subject needs); `sportiviRows(src, d, period, today): TableRow[]`; `abonamenteRows(src, d, period, today): TableRow[]`.
- Sportivi rules (4.7): one row per athlete with a membership in the scope (season, section, group); "Grupă" the main group; "Antrenor" the main group's coaches; money for the period = the athlete's Club months in the period plus abonamente with `startsOn` in the period, each with what is paid for it whenever paid; "Stare plată": "Achitat" (Rămas 0, De plătit > 0), "Parțial" (0 < Plătit < De plătit), "Neachitat" (Plătit 0, De plătit > 0), null when nothing is due; "Abonament": "<code> <used>/<slots>" of the current abonament (11-3 rule), "Prezențe": attendance rows in the period. `groupKeys`: grupa (main group in the scope season), sectiune, antrenor (main group's first coach).
- Abonamente rules: one row per abonament with `startsOn` in the period (season when no period); "Folosite" used count; "Preț", "Plătit", "Rămas" from the abonament's non-cancelled payments; "Stare" `SUBSCRIPTION_STATE_WORDS`.

- [ ] **Step 1: Write the failing tests** on `tablesSeed()` (2 groups in 2 sections, 6 athletes, abonamente paid fully, partly and not at all, Club months with and without payments, one athlete in no group of the scope): Sportivi rows for November give the expected `dePlatit`, `platit`, `ramas`, `starePlata` per athlete (`'Achitat'`, `'Parțial'`, `'Neachitat'`, `null`); the athlete outside the scope is absent; a group scope keeps only that group's members; Abonamente rows give `cod` "A-0001"... and the right `ramas`; the store spy records each read at most once.
- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/tables/__tests__/rows-sportivi.test.ts src/club/tables/__tests__/rows-abonamente.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** (no read per row).
- [ ] **Step 4: Run** `npx vitest run`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/tables/sources.ts src/club/tables/rows-sportivi.ts src/club/tables/rows-abonamente.ts src/club/tables/__tests__
git commit -m "feat(tables): Sportivi and Abonamente rows from bulk reads"
```

---

### Task 4: Plăți and Prezență rows (low, Sonnet)

**Files:**
- Create: `src/club/tables/rows-plati.ts`, `src/club/tables/rows-prezenta.ts`
- Test: `src/club/tables/__tests__/rows-plati.test.ts`, `rows-prezenta.test.ts`

**Interfaces:**
- Consumes: T3 sources; 11-3 `payOf`, `payLabel`; P5 `listPurposeText`, `METHOD_WORDS`.
- Produces (codes in "Pentru", spec 5.7, used here and by 11-5): `PurposeNames` (`src/club/presence/payments/rules.ts`) gains `code?: string | null`; with a code, `listPurposeText` of an abonament payment answers "Abonament A-0124" and `PAYMENT_COPY.optAbonament(item, start, code)` answers "A-0124, Abonament 8 ședințe (activ din <data>)"; without a code (none can exist after the 11-3 backfill, but old rows in tests) the P5 texts stay. `purposeTextOf` reads the subscription's `code`. Tests in `payment-rules.test.ts`.
- Produces: `platiRows(src, d, period): TableRow[]` (one row per payment with `paidOn` in the period, cancelled included with "Stare" "anulată"; "Grupă" the athlete's main group in the scope season; `luna` = month of `paidOn`); `prezentaRows(src, d, period): TableRow[]` (one row per attendance and per held individual lesson in the period; "Tip" "Grup" / "Individual"; "Antrenor" the session's or lesson's coaches; `groupKeys.antrenor` one entry per coach; "Plată" `payLabel`; "Sumă" the attendance or lesson amount).

- [ ] **Step 1: Write the failing tests**: `listPurposeText` of an abonament payment with code "A-0124" is "Abonament A-0124" and the option label "A-0124, Abonament 8 ședințe (activ din 1 noi 2026)" (the P5 date format of `startText`); Plăți rows keep a cancelled payment with `stare: 'anulată'` and `nrChitanta` null for a payment before go-live; Prezență: a session with two coaches yields one row with `groupKeys.antrenor` of length 2; "Plată" texts "Ședința 3/8 A-0001", "Plătit", "Neplătit"; the absent lesson is left out.
- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/tables/__tests__/rows-plati.test.ts src/club/tables/__tests__/rows-prezenta.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/tables/rows-plati.ts src/club/tables/rows-prezenta.ts src/club/tables/__tests__ src/club/presence/payments/rules.ts src/club/presence/payments/common.ts src/club/presence/copy/payments.ts src/club/presence/__tests__/payment-rules.test.ts
git commit -m "feat(tables): Plăți and Prezență rows"
```

---

### Task 5: Filters, group-by, sort, cap, limiter and file shapes (low, Sonnet)

**Files:**
- Create: `src/club/tables/filter.ts`, `group.ts`, `sort.ts`, `query.ts`, `limit.ts`, `export.ts`
- Test: `src/club/tables/__tests__/query.test.ts`, `limit.test.ts`, `export.test.ts`

**Interfaces:**
- Produces: `applyFilters(rows, d): TableRow[]`; `sortRows(rows, sort, columns): TableRow[]` (ro collation for text, nulls last); `groupRows(rows, d, columns): { groups: TableGroup[] | null; total: TableTotals }` (`TableGroup = { key; label; count; subtotal: Record<string, CellValue>; rows: TableRow[] }`; subtotals: sums of number and money columns, "<a> din <n>" under "Stare plată" (a = "Achitat"); groups ordered by label (Grupă by P4 group order, Lună ascending); a row under several coaches appears under each, counted once in `total` [S31]); `MAX_ROWS = 5000`; `runQuery(rowsOf: () => Promise<TableRow[]>, d, columns, budget: Budget): Promise<AdminResult<TableResult>>` (cap counted on records after filters, before grouping repeats (ruling 11): 422 text; `TableResult` as the index; `budget.check()` after reads, rows and grouping (ruling 10)); `createLimiter(max: number): <T>(work: () => Promise<T>) => Promise<T>` (FIFO, never rejects for waiting); `exportLimit = createLimiter(2)` (shared by tables and 11-5 accounting); `startBudget(ms: number, now: () => number): Budget` (`check()` throws `BudgetError` past `ms`; the query handler turns it into 503); `tableSheet(result, name): XlsxSheet` (group header rows "<grupă>, <n> sportivi" / "<n> plăți" / "<n> abonamente" / "<n> prezențe", body, "Subtotal <grupă>", "Total"); `tableCsv(result): string` (one line per record, no group or subtotal lines, the group-by column first when grouped; numbers `csvNumber`, dates `csvDate`; a text starting with `= + - @` gets a leading `'`).

- [ ] **Step 1: Write the failing tests**:

```ts
it('groups with subtotals and counts two-coach rows once in Total (S31)', () => {
  const r = groupRows([row({ antrenor: ['k1', 'k2'], suma: 40 }), row({ antrenor: ['k1'], suma: 50 })], { ...def, groupBy: 'antrenor' }, cols);
  expect(r.groups?.map((g) => [g.label, g.count, g.subtotal.suma])).toEqual([['Ana', 2, 90], ['Bogdan', 1, 40]]);
  expect(r.total.suma).toBe(90);
});
it('writes "a din n" under Stare plată', () => {
  expect(groupRows(threeAthletes(['Achitat', 'Parțial', 'Achitat']), byGroup, sportiviCols).groups?.[0].subtotal.starePlata).toBe('2 din 3');
});
it('refuses above 5.000 records and accepts exactly 5.000', async () => {
  expect(await runQuery(async () => rows(5001), def, cols, noBudget)).toEqual({ ok: false, status: 422, error: 'Tabelul are peste 5.000 de rânduri. Restrânge sfera sau filtrele.' });
  expect((await runQuery(async () => rows(5000), def, cols, noBudget)).ok).toBe(true);
});
it('runs at most two at a time, the third waits', async () => {
  const limit = createLimiter(2);
  const log: string[] = [];
  const job = (id: string, gate: Promise<void>) => limit(async () => { log.push(`start ${id}`); await gate; log.push(`end ${id}`); });
  const [g1, g2, g3] = [deferred(), deferred(), deferred()];
  const all = Promise.all([job('a', g1.p), job('b', g2.p), job('c', g3.p)]);
  await tick(); expect(log).toEqual(['start a', 'start b']);
  g1.resolve(); await tick(); expect(log).toContain('start c');
  g2.resolve(); g3.resolve(); await all;
});
it('CSV has one line per record, the group column first, safe text', () => {
  expect(tableCsv(groupedResult).split('\r\n')[0]).toBe('﻿Grupă;Sportiv;Sumă');
  expect(tableCsv(resultWith('=1+1'))).toContain(";'=1+1;");
});
```

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/tables/__tests__/query.test.ts src/club/tables/__tests__/limit.test.ts src/club/tables/__tests__/export.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** (pure; `limit.ts` uses only promises).
- [ ] **Step 4: Run** `npx vitest run`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/tables/filter.ts src/club/tables/group.ts src/club/tables/sort.ts src/club/tables/query.ts src/club/tables/limit.ts src/club/tables/export.ts src/club/tables/__tests__
git commit -m "feat(tables): filters, group-by with subtotals, the row cap and file shapes"
```

---

### Task 6: Saved views with author rule and undo (high, Sonnet)

**Files:**
- Create: `src/api/table-view/content-types/table-view/schema.json` (+ core router `only: []`, controller, service), `src/club/tables/views-store.ts` (interface + `strapiTableViewStore`), `src/club/tables/views-service.ts`, `src/club/tables/__tests__/fake-views-store.ts`
- Modify: `src/club/subjects.ts` (`tableView: 'table-view'`), `src/club/presence/undo-service.ts` (`undoKindOf` gains `'table-view'`), `src/api/club/controllers/groups.ts` (the `/club/undo` handler dispatches it)
- Test: `src/club/tables/__tests__/views-service.test.ts`, `views-store.test.ts` (parity)

**Interfaces:**
- Produces (schema): `club_table_views`: `name` string required (1..80), `subject` enumeration, `definition` json required, `authorId` integer required, `authorName` string, `deletedAt` datetime; hidden from the Content Manager.
- Produces (`TableViewStore`): `transaction`, `lockView(id)`, `views({ includeDeleted?: boolean })`, `view(id)`, `createView(row)`, `updateView(id, patch)`, `setDeleted(id, at: string | null)`, `purgeDeletedBefore(iso)`, `recordAction(actor, line)` (the group store's), `historyEntry(id)`.
- Produces (`views-service.ts`): `type Caller = { adminId: number; name: string; superAdmin: boolean }`; `listViews(store, caller): Promise<SavedViewRow[]>` (`mine` = author, `canDelete` = author or Super Admin [S10]); `createView(store, caller, body)` (`readDefinition`, name 1..80 trimmed, unique among not deleted, case-insensitive: 400 "Există deja o vizualizare cu numele ăsta."; 200 views: 400 "Prea multe vizualizări salvate. Șterge una."; toast "Vizualizare salvată."); `updateView(store, caller, id, body)` (author only: 403 "Doar autorul poate modifica vizualizarea."; a Super Admin may not edit someone else's, only delete; toast "Salvat."); `deleteView(store, caller, id): Promise<ActionResult<{ deleted: true; toast: string }>>` (author or Super Admin; sets `deletedAt`, writes one history line on subject `table-view` with `changes.undo = { kind: 'table-view', id }`, purges rows deleted more than a day ago; toast "Vizualizare ștearsă."); `undoViewDelete(store, actionId)` (within the P4 undo window; restores `deletedAt = null` unless a live view took the name meanwhile: 409 "Există deja o vizualizare cu numele ăsta.").

- [ ] **Step 1: Write the failing tests**: the author creates, updates and deletes; another admin's `PUT` and `DELETE` answer 403 with the text; a Super Admin's `DELETE` of someone else's view works and his `PUT` answers 403; duplicate names differ only by case: 400; the 201st view: 400; delete then undo brings the same `id` back and it lists again; a deleted view's name can be reused, and undo then answers 409; the fake and Strapi stores expose the same methods.
- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/tables/__tests__/views-service.test.ts src/club/tables/__tests__/views-store.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement**; the undo record never names athletes (no athlete history, S12).
- [ ] **Step 4: Run** `npx vitest run`, `npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/api/table-view src/club/tables/views-store.ts src/club/tables/views-service.ts src/club/subjects.ts src/club/presence/undo-service.ts src/api/club/controllers/groups.ts src/club/tables/__tests__
git commit -m "feat(tables): saved views shared with their author, delete with undo"
```

---

### Task 7: Routes and controller (high, Sonnet)

**Files:**
- Create: `src/api/club/routes/13-tables.ts`, `src/api/club/controllers/tables.ts`
- Test: `src/club/tables/__tests__/tables-routes.test.ts`

**Interfaces:**
- Consumes: T1 to T6; 11-1 `adminRoute`, `downloadLogLine`; `verifiedAdminId`, `adminActor`, `isSuperAdminRequest` (the caller).
- Produces (order, all `adminRoute('money')`): `GET /club/tables/catalog` -> `tables.catalog`; `POST /club/tables/query` -> `tables.query`; `POST /club/tables/export` -> `tables.export`; `GET /club/table-views` -> `tables.views`; `POST /club/table-views` -> `tables.createView`; `PUT /club/table-views/:documentId` -> `tables.updateView`; `DELETE /club/table-views/:documentId` -> `tables.deleteView`. Query and export run through `exportLimit` (T5: `export const exportLimit = createLimiter(2)` in `limit.ts`, one per process); the budget starts inside the limiter (10 000 ms). Export: `xlsx` -> `writeXlsx([tableSheet(result, name)])`, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`; `csv` -> `tableCsv`, `text/csv; charset=utf-8`; attachment names from `xlsxName` / `csvName`; one `downloadLogLine({ adminId, kind: 'tables-xlsx' | 'tables-csv', rows: result.count })`.

- [ ] **Step 1: Write the failing test** (as `attendance-routes.test.ts`): the exact route list; every config `areaOfRoute(...) === 'money'`; static before params; every handler exists; the controller source contains `exportLimit(`, `startBudget(10_000`, `downloadLogLine(`, both content types, and no `strapi.db.query` (reads go through the store).
- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/tables/__tests__/tables-routes.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run`, both `tsc`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/api/club/routes/13-tables.ts src/api/club/controllers/tables.ts src/club/tables/__tests__/tables-routes.test.ts
git commit -m "feat(tables): admin routes for tables, exports and saved views"
```

---

### Task 8: Tabele copy and screen state (low, Haiku)

**Files:**
- Create: `src/club/tables/copy.ts`, `src/club/tables/view-state.ts`, `src/club/tables/routes.ts`
- Modify: `src/club/presence/__tests__/copy.test.ts` (scan `src/club/tables/copy.ts` too)
- Test: `src/club/tables/__tests__/view-state.test.ts`

**Interfaces:**
- Produces (copy, exact): `TABLES_COPY = { tabs: { lista: 'Listă', tabele: 'Tabele' }, view: 'Vizualizare', readyGroup: 'Gata făcute', savedGroup: 'Salvate', readyHint: 'Gata făcută', save: 'Salvează', saveAsNew: 'Salvează ca nouă', duplicate: 'Duplică', remove: 'Șterge', xlsx: 'Descarcă .xlsx', csv: 'Descarcă .csv', editMobile: 'Editează tabelul', subject: 'Subiect', scope: 'Sfera', season: 'Sezon', section: 'Secțiune', group: 'Grupă', all: 'Toate', period: 'Perioada', wholeSeason: 'Tot sezonul', columns: 'Coloane, în ordine', filters: 'Filtre', addFilter: '+ filtru', groupBy: 'Grupează după', none: 'Fără', sort: 'Sortare', subtotal: (g: string) => \`Subtotal ${g}\`, total: 'Total', newTitle: 'Vizualizare nouă', name: 'Nume', copyOf: (n: string) => \`${n} (copie)\`, giveUp: 'Renunță', saved: 'Vizualizare salvată.', savedShort: 'Salvat.', confirmDelete: (n: string) => \`Ștergi vizualizarea "${n}"?\`, deleted: 'Vizualizare ștearsă.', undo: 'Anulează', empty: 'Niciun rând pentru alegerile astea.', errors: { tooMany: 'Tabelul are peste 5.000 de rânduri. Restrânge sfera sau filtrele.', tooSlow: 'Tabelul durează prea mult. Restrânge sfera.', nameTaken: 'Există deja o vizualizare cu numele ăsta.', notAuthor: 'Doar autorul poate modifica vizualizarea.', tooManyViews: 'Prea multe vizualizări salvate. Șterge una.', download: 'Descărcarea nu a reușit.' }, notices: { droppedColumn: 'COPY NEEDED', ignoredFilter: 'COPY NEEDED' } }`, plus the ready-made names and the group header counts by `countWords` ("12 sportivi", "1 plată", "8 abonamente", "40 de prezențe"). The two notice strings are not in the spec: ask the user; until then they are the only `COPY NEEDED` values and the copy test allows exactly these two.
- Produces (`routes.ts`): `TABLES_AREA: AdminArea = 'money'`; `readTablesQuery(search)` -> `{ tab: 'lista' | 'tabele'; viewId: string | null }` (`?vedere=tabele&v=<id>`) [S50]; `tablesTo(viewId)`.
- Produces (`view-state.ts`): `isDirty(saved, current)`; `actionsFor(view: SavedViewRow | ReadyMade, dirty: boolean): { save: boolean; saveAsNew: boolean; duplicate: boolean; remove: boolean }` (own view: save when dirty, save as new, duplicate, remove; someone else's or ready-made: save as new and duplicate only, and remove for a Super Admin on someone else's) [5.5]; `groupHeader(subject, label, count)` ("Intermediari Bronze, 12 sportivi"); `windowed(count): boolean` (true above 1.000 rows; windows of 200).

- [ ] **Step 1: Write the failing test** with the rules above, and the copy scan over `tables/copy.ts`.
- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/tables/__tests__/view-state.test.ts src/club/presence/__tests__/copy.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/tables/copy.ts src/club/tables/view-state.ts src/club/tables/routes.ts src/club/presence/__tests__/copy.test.ts src/club/tables/__tests__/view-state.test.ts
git commit -m "feat(tables): Tabele copy, address and screen state"
```

---

### Task 9: Sportivi "Tabele" screen (low, Sonnet)

**Files:**
- Create: `src/admin/dashboard/sportivi/tabele/{TabelePage,ViewBar,Builder,ColumnList,FilterList,ResultTable,NewViewModal}.tsx`, `tabele/api.ts`, `tabele/styles.ts`
- Modify: `src/admin/dashboard/SportiviPage.tsx` (tab row "Listă" | "Tabele" on the list, not on the record), `src/admin/dashboard/inscrieri/downloadPdf.ts` (`downloadPost(post, url, body, fallbackName)`), `scripts/admin-ui-check.mjs` (colour rule covers `dashboard/sportivi/tabele`)
- Test: `src/club/tables/__tests__/admin-tabele.test.ts`

**Interfaces:**
- Consumes: T7 routes; T8 copy, state, address; 11-2 `AthleteLink`; `Tabs`, `Select` (grouped options), `SegmentedControl`, `Checkbox`, `useDragReorder`, `Modal`, `BottomSheet`, `Popover`, `adminToast`.
- Produces: spec 5.5: view bar (Select with "Gata făcute" then "Salvate", author as hint; buttons by `actionsFor`, "Descarcă .xlsx", "Descarcă .csv"); builder open on desktop, a `BottomSheet` "Editează tabelul" on phones [S52]; subject, scope (season, section "Toate", group "Toate", month or "Tot sezonul"), column checklist with drag reorder, filters with "+ filtru", quick filters "Stare" and "Grupă" above the table, group by, sort (and header click); table with collapsible group headers, subtotal rows, "Total", money "1.200 RON"; a row with an athlete opens the record in a new tab; notices from `repairDefinition` above the table; errors from the server shown with their text; delete with confirmation and the 8 s undo toast; the default view "Plăți pe grupă luna aceasta".

- [ ] **Step 1: Write the failing source tests**: `SportiviPage.tsx` renders `Tabs` with `TABLES_COPY.tabs` only on the list; `TabelePage.tsx` wraps in `AdminPage` (`.ui-root`, SaveBar opt-out) and `NewViewModal.tsx` uses `Modal`; no `Tabs` import outside `SportiviPage.tsx`; `ViewBar.tsx` calls `actionsFor(`; downloads go through `downloadPost(` with the current definition; `ResultTable.tsx` uses `windowed(`; athlete rows use `AthleteLink` or `window.open(..., '_blank', 'noopener')`; no `dashed`, `dotted` or round radius under `sportivi/tabele`.
- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/tables/__tests__/admin-tabele.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement**; phone 390 px: the view bar wraps, the table scrolls inside its box with the first column fixed.
- [ ] **Step 4: Run** all checks (`npx vitest run`, both `tsc`, `node scripts/admin-ui-check.mjs --strict`); Expected: PASS, 0, exit 0.
- [ ] **Step 5: Commit**

```bash
git add src/admin/dashboard/sportivi/tabele src/admin/dashboard/SportiviPage.tsx src/admin/dashboard/inscrieri/downloadPdf.ts scripts/admin-ui-check.mjs src/club/tables/__tests__/admin-tabele.test.ts
git commit -m "feat(sportivi): Tabele tab with builder, saved views and downloads"
```

---

### Task 10: Volume fixture, boot check, click-through and renders (low, Sonnet)

**Files:**
- Create: `scripts/fixtures/phase11-volume.js` (CommonJS, the `phase5-shape.js` guard: refuses without `ES_THROWAWAY_DB=1`, `IDS_FILE`, and a port in `THROWAWAY_PORTS`; synthetic only: 130 athletes "Sportiv Test 001".."130", parents "Părinte Test <n>", e-mails `sportiv<n>@example.invalid`, phones `0700 000 <nnn>`; 4 groups in 2 sections; sessions on 45 dates of the season with every member present (about 5.850 attendance rows), abonamente with codes through the add service, payments through the record service, one name `=1+1 Test`)
- Temporary: `T=${TMPDIR:-/tmp}/es114`. PNGs to `.../phase11-renders/11-4-<name>-<desktop|phone>.png`.

- [ ] **Step 1: Fixture and commit**

```bash
git add scripts/fixtures/phase11-volume.js
git commit -m "chore(fixtures): phase 11 synthetic volume data"
```

- [ ] **Step 2: Database, build, data**: `es114-pg` on 55475, `npm run build`, `phase4-shape.js`, `phase5-shape.js`, `phase11-volume.js`, Strapi 1394, admin login; a second admin `admin2@example.invalid` (Strapi admin create through `strapi.admin.services.user` in a throwaway script) for the author rule.
- [ ] **Step 3: Curl checks**

```bash
api POST /club/tables/query '{"definition":<prezenta, season, columns data,sportiv,plata>}'                      # > 5.000
api POST /club/tables/query '{"definition":<prezenta, current month>}' | py "print(d['data']['count'])"
api POST /club/tables/query '{"definition":<plati, columns data,"athlete.email">}'
curl -s -D - -o $T/t.xlsx -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' -d '{"definition":<rm-plati-grupa>,"format":"xlsx","name":"Plăți pe grupă luna aceasta"}' http://127.0.0.1:1394/api/club/tables/export | grep -i content-disposition
node -e "const E=require('exceljs');(async()=>{const w=new E.Workbook();await w.xlsx.load(require('fs').readFileSync('$T/t.xlsx'));const s=w.worksheets[0];console.log(s.name,s.getRow(1).font.bold,s.views[0].ySplit)})()"
curl ... format csv | head -2                                                                                   # one line per record
for i in 1 2 3; do (curl -s -o /dev/null -w "%{http_code} %{time_total}\n" ...export xlsx season plati...) & done; wait
api2 PUT /club/table-views/$V '{"name":"x","definition":...}'; api2 DELETE /club/table-views/$V
api DELETE /club/table-views/$V | py "print(d['undo'])"; api POST /club/undo "{\"actionId\":\"$A\"}"
```

Expected: the season Prezență query answers 422 with the text and no export file is written for the same definition; the month query answers its count; the field path answers 400 "Cerere invalidă."; `attachment; filename="plati-pe-grupa-luna-aceasta-<today>.xlsx"`; exceljs reads the sheet name, `true`, `1`; the CSV header plus records, the `=1+1 Test` cell starting with `'`; the three parallel exports all answer 200, the third later than the first two; admin2 gets 403 "Doar autorul poate modifica vizualizarea." twice; the author's delete answers an undo and the undo brings the view back with the same id; the log has one `[download]` line per file, no names. Restart Strapi once: no error.

- [ ] **Step 4: Click-through and renders**: Sportivi -> "Tabele" (`tabele-implicit`), every ready-made view (`tabele-<id>`), the builder with a custom definition grouped by Antrenor (`tabele-builder`), "Salvează ca nouă" modal (`tabele-modal`), the saved view as admin2 (`tabele-alt-autor`, only "Salvează ca nouă" and "Duplică"), the 422 state (`tabele-prea-mare`), phone with the BottomSheet (`tabele-telefon`). Record `r['tabs']` (`['Listă', 'Tabele']`), `r['view_groups']`, `r['buttons']`, `r['save_visible']` (the "Salvează" button's bounding box larger than 1x1: SaveBar opt-out works). Expected: phone `no_side_scroll` True, `page_errors == []`.
- [ ] **Step 5: Look at the renders** next to av-5 (options of the answers): texts of 5.5 word for word, "Rămas" never "Rest", square labels, subtotal rows bold, no pill, circle, dashed or dotted line. Fixes in T8 or T9 files with `fix(tabele): ...`.
- [ ] **Step 6: Clean up**: stop Strapi, `docker rm -f es114-pg`, `rm -rf "$T"`.

---

## Interfaces for other plans

- **11-5:** `writeXlsx`, `XlsxSheet`, `xlsxName` pattern, `downloadPost`, `exportLimit` from `src/club/tables/limit.ts` (the accounting export shares it), `phase11-volume.js` for the final check.
