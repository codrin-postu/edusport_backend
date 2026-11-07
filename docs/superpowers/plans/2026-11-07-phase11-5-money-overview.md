# Phase 11-5: Money Overview and Accounting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Bani" page with five month figures that link to the existing pages, a breakdown by section and group (switchable to method and purpose), and an accounting view with "Nr. chitanță" and "Export contabil" in .xlsx and .csv; the abonament codes and receipt numbers appear in Abonamente, Plăți, De încasat and the payment window; then the whole-phase boot check and click-through for the companion.

**Architecture:** The overview and the accounting list are computed on read by pure modules in `src/club/money/` from one read per source for the month (P5 settlement rules reused, no stored totals); the export reuses 11-4's `writeXlsx` and the shared `toCsv`. The screen is thin in `src/admin/dashboard/bani/BaniPage.tsx`; every new route and menu entry names area `money`.

**Tech Stack:** Strapi 5.52.1 (TypeScript), `exceljs` 4.4.0 (from 11-4), React 18 admin, Vitest 3, Python Playwright, Postgres 16.

**Spec:** `docs/superpowers/specs/2026-11-07-admin-views-design.md` 3.2 (display), 4.4 (`expira14`), 4.5, 4.6, 4.8, 4.9, 5.6, 5.7, 6 (money overview, S62), 7, 8, 9, 12.1, 12.5, 12.6, 13 (S22 to S27, S54 to S58). Mockup: `.superpowers/admin-views/screens/av-6-bani-overview.html` (q1 A, q2 A, q3 A as a picker, q4 B). Index: `docs/superpowers/plans/2026-11-07-phase11-index.md` (contracts "Abonamente and payments", ruling 12).

**Base:** `feat/athletes` with 11-4 merged. Branch `feat/p11-5`.

**Parallel groups:** A: T1, T4 | B: T2, T5 | C: T3 | D: T6 | E: T7

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Overview rules, 4 Copy and views | base | 1: `src/club/money/overview.ts`, `sources.ts`; 4: `copy/money-ui.ts`, `src/club/bani/money-view.ts`, `bani/routes.ts` |
| B | 2 Accounting and its export, 5 Codes in existing screens | 1; 4 | 2: `src/club/money/accounting.ts`, `accounting-export.ts`; 5: `bani/{AbonamenteList,DeIncasatList,PlatiList,PlatiTab,PaymentWindow}.tsx`, `bani/*-view.ts` |
| C | 3 Routes and the changed responses | 1, 2 | `11-payments.ts`, `controllers/payments.ts`, `subscriptions/reads.ts`, `payments/reads.ts`, `due/reads.ts`, `money-api.ts` |
| D | 6 Bani page | 3, 4 | `BaniPage.tsx`, `bani/Bani*.tsx`, `menu.tsx` |
| E | 7 Whole-phase boot check and click-through | all, plans 11-1 to 11-4 merged | none |

## Global Constraints

- As plan 11-1 "Global Constraints" (repo, worktree checks, precedence, checks after every task, code rules, design, copy, synthetic data, commits, progress board with `11-5 T<n>`).
- Every route this plan adds uses `adminRoute('money')`; the "Bani" menu entry carries `area: 'money'` (Super Admin and "Administrator club" once 6b is merged) [6b 9.2].
- Amounts "18.640 RON" (`ron` with thousands, 11-1); percent whole numbers "75%", "-" when Datorat is 0 [S56]; dates in the accounting list "04.11".
- Money rules are P5's: cancelled payments are not collected; cancelled abonamente are out of Datorat; the card "Încasat" counts payments by `paidOn`, the breakdown counts what was paid against the month's dues (the muted note says so) [S27, builder default].
- No tabs on Bani: "Prezentare" / "Contabilitate" and "Secțiune și grupă" / "Metodă" / "Scop" are `SegmentedControl`s [P11 av6-q3].
- No document: "Nr. chitanță" is a number on the row and in exports, no PDF, no print [S3].
- Task 7: `es115-pg` on 127.0.0.1:55476, Strapi 1395.

## Review Focus

- **A Club month paid in two payments, one in the next month**: the breakdown's Încasat for the month includes both (paid against that month's dues, oldest line first), while the card "Încasat" of the next month counts the second by its date. Pinned by T1 (FIFO test).
- **A past month and the current month**: the reference day for "Abonamente active", "Expiră în 14 zile" and "din <n> sportivi" is the month's last day for a past month and today for the current one; ">" stops at the current month and a future `month` answers 400. Pinned by T1 and T3.
- **Cancelled payments in the accounting view**: listed struck through with "anulată", summed under "Anulate", never in "Numerar" / "Card (POS)" / "Transfer bancar" nor in the export's "Pe metodă" totals; a payment before go-live shows an empty "Nr. chitanță". Pinned by T2.
- **A month with no payments, or a group with Datorat 0**: "Nicio plată în luna asta.", "-" under %, the "+n% față de <luna>" line hidden when the previous month is 0. Pinned by T1 and T4.
- **The card links carry the same numbers as the page they open** (De încasat for the month: Rămas and De plătit of both parts). Pinned by T1 (`cards.left` equals the sum of `readDue` rows) and T7.

## Review batches

High tasks T2 and T3 are in batch R4 with 11-4 T6 and T7 (index). The plan's final review (Opus) runs after T7.

---

### Task 1: Overview rules (low, Sonnet)

**Files:**
- Create: `src/club/money/overview.ts`, `src/club/money/sources.ts`, `src/club/money/types.ts`
- Test: `src/club/money/__tests__/overview.test.ts`, `src/club/money/__tests__/money-seed.ts`

**Interfaces:**
- Consumes: P5 `clubMonths`, `schoolDue`, `mainGroupToday`, `subscriptionState`, `usedSlots`, `readDue` totals; `monthRange`, `addMonths`.
- Produces (`types.ts`): `Money4`, `SectionBlock`, `TallyRow`, `MoneyOverview` (index contracts).
- Produces: `MoneySources = { athletes, groups, sections, memberships, attendances, lessons, subscriptions, payments, startDate }`; `loadMoneySources(store: PresenceStore, month: string): Promise<MoneySources>` (one read per source; payments of the month and the month before, attendances and lessons of the month, subscriptions of the athletes concerned); `moneyOverview(src, month, today): MoneyOverview`:
  - `collected` / `collectedPrev`: non-cancelled payments with `paidOn` in the month / the month before;
  - `left`, `due`: the "De încasat" totals for the month (Rămas of both parts; De plătit plus Preț of both parts) [S25];
  - reference day: today for the current month, the last day for a past month [S26]; `activeSubscriptions`: state `activ` on it; `schoolAthletes`: athletes with a membership in a Școala group on it; `expiring`: active with `validUntil` from it to 13 days later; `unpaidAthletes`: Rămas > 0 in either part;
  - `bySection`: per section and group, Datorat = Club due of the attendances in that group's sessions of the month + price of abonamente with `startsOn` in the month on the athlete's main school group at `startsOn` + lessons of the month on the athlete's main group at the lesson date; Încasat = abonament payments for those abonamente, and for a Club month its payments spread over the month's lines oldest first; Rămas; `percent` rounded, null at Datorat 0 [S27, S56];
  - `byMethod` (numerar, card, transfer) and `byPurpose` (abonament, cotizatie, club_luna, lectie, altceva): Încasat and count of non-cancelled payments by `paidOn`.

- [ ] **Step 1: Write the failing test** on `moneySeed()` (2 sections, 3 groups, payments in November and October, a Club month of 400 paid 300 in November and 100 on 3 December, an abonament of 320 paid 200, a cancelled abonament, a cancelled payment, a lesson of 150 unpaid):

```ts
it('cards for the month (5.6.1)', () => {
  const o = moneyOverview(src, '2026-11', '2026-11-20');
  expect(o.cards).toMatchObject({ collected: 500, collectedPrev: 120, activeSubscriptions: 1, expiring: 1, unpaidAthletes: 2 });
  expect(o.cards.left).toBe(sumOfDue(readDueRows('2026-11')).left);
});
it('breakdown pays the month dues oldest line first, whenever paid (S27)', () => {
  const g = group(moneyOverview(src, '2026-11', '2026-12-05'), 'Avansați');
  expect(g.totals).toEqual({ due: 400, paid: 400, left: 0, percent: 100 });
  expect(group(moneyOverview(src, '2026-11', '2026-12-05'), 'Fără datorii').totals.percent).toBeNull();
});
it('a past month uses its last day as reference day (S26)', () => {
  expect(moneyOverview(src, '2026-10', '2026-11-20').cards.activeSubscriptions).toBe(activeOn('2026-10-31'));
});
```

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/money/__tests__/overview.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** (pure over `MoneySources`; no stored totals) [S24].
- [ ] **Step 4: Run** `npx vitest run`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/money src/club/money/__tests__
git commit -m "feat(money): month overview figures and the section and group breakdown"
```

---

### Task 2: Accounting list and "Export contabil" (high, Sonnet)

**Files:**
- Create: `src/club/money/accounting.ts`, `src/club/money/accounting-export.ts`
- Test: `src/club/money/__tests__/accounting.test.ts`

**Interfaces:**
- Consumes: T1 sources and overview; 11-4 `XlsxSheet`, `writeXlsx` (called by the controller), `toCsv`, `csvNumber`, `csvDate`; P5 `listPurposeText` with codes (11-4 T4), `METHOD_WORDS`.
- Produces: `Accounting` (index); `accounting(src, month): Accounting` (payments with `paidOn` in the month, cancelled included and marked, ordered by date then receipt number (null numbers first, then by `recordedAt`); `byMethod` sums of non-cancelled; `cancelled` sum of cancelled); `accountingSheets(acc: Accounting, overview: MoneyOverview, extra: { collectedAtRink: Map<string, boolean>; recordedBy: Map<string, string> }): XlsxSheet[]` (sheets "Plăți": Data, Nr. chitanță, Sportiv, Pentru, Metodă, La patinoar, Sumă, Stare, Înregistrat de; "Pe metodă": Metodă, Încasat, Plăți, with a "Total" row; "Pe grupă": the Secțiune și grupă table with section rows bold and "Total") [S58, ruling 12]; `accountingCsv(...)`: the "Plăți" sheet only; `accountingName(month, ext)` -> `contabil-<YYYY-MM>.<ext>`.

- [ ] **Step 1: Write the failing test**: the cancelled payment is in `payments` with `cancelled: true` and in `byMethod.cancelled`, not in `byMethod.numerar`; a pre-go-live payment has `receiptNo: null` and sorts before numbered ones of the same day; the "Plăți" sheet's "Stare" is "anulată" for it; sheet names `['Plăți', 'Pe metodă', 'Pe grupă']`; the CSV has the "Plăți" header `Data;Nr. chitanță;Sportiv;Pentru;Metodă;La patinoar;Sumă;Stare;Înregistrat de` and dates "04.11.2026"; `accountingName('2026-11', 'xlsx')` is `contabil-2026-11.xlsx`.
- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/money/__tests__/accounting.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** (pure; text cells pass through 11-4's formula-safe rule).
- [ ] **Step 4: Run** `npx vitest run`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/money/accounting.ts src/club/money/accounting-export.ts src/club/money/__tests__/accounting.test.ts
git commit -m "feat(money): accounting list and Export contabil sheets"
```

---

### Task 3: Money routes and the changed responses (high, Sonnet)

**Files:**
- Modify: `src/api/club/routes/11-payments.ts`, `src/api/club/controllers/payments.ts`, `src/club/presence/money-api.ts`, `src/club/presence/subscriptions/reads.ts`, `src/club/presence/payments/reads.ts` (or the list builder that makes `PaymentRowView`), `src/club/presence/due/reads.ts`
- Test: `src/club/presence/__tests__/money-routes.test.ts`, `money-reads.test.ts`, `src/club/money/__tests__/money-routes.test.ts`

**Interfaces:**
- Produces (routes, all `adminRoute('money')`, before the parameter paths): `GET /club/money/overview` -> `payments.moneyOverview`; `GET /club/money/accounting` -> `payments.accounting`; `GET /club/money/accounting.xlsx` -> `payments.accountingXlsx`; `GET /club/money/accounting.csv` -> `payments.accountingCsv` (`month` required, not after the current month: 400; files through the 11-4 export limiter `exportLimit` and one `downloadLogLine({ adminId, kind: 'accounting-xlsx' | 'accounting-csv', rows })`).
- Produces (changed): `SubscriptionStateFilter` gains `'expira14'` (active, `validUntil` from today to today + 13) [S22]; `SubscriptionListRow.code`; `PaymentRowView.receiptNo: string | null`; `SchoolDueRow.code: string | null`; payment options use the code labels (11-4 T4).

- [ ] **Step 1: Write the failing tests**: route list and areas (`money` for the four), static before params; `readSubscriptionQuery({ state: 'expira14' }).state === 'expira14'` and the list keeps only active abonamente ending within 14 days; payment and due rows carry `receiptNo` / `code`; the controller source has `exportLimit(`, `downloadLogLine(` and both content types.
- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/presence/__tests__/money-routes.test.ts src/club/presence/__tests__/money-reads.test.ts src/club/money/__tests__/money-routes.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run`, both `tsc`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/api/club/routes/11-payments.ts src/api/club/controllers/payments.ts src/club/presence/money-api.ts src/club/presence/subscriptions/reads.ts src/club/presence/payments src/club/presence/due/reads.ts src/club/presence/__tests__ src/club/money/__tests__/money-routes.test.ts
git commit -m "feat(money): overview and accounting routes, codes and receipt numbers in lists"
```

---

### Task 4: Bani copy and views (low, Haiku)

**Files:**
- Modify: `src/club/presence/copy/money-ui.ts`, `src/club/bani/routes.ts`
- Create: `src/club/bani/money-view.ts`
- Test: `src/club/bani/__tests__/money-view.test.ts`

**Interfaces:**
- Produces (copy, exact): `BANI_COPY = { title: 'Bani', menu: 'Bani', views: { prezentare: 'Prezentare', contabilitate: 'Contabilitate' }, cards: { collected: 'Încasat', left: 'De încasat', active: 'Abonamente active', expiring: 'Expiră în 14 zile', unpaid: 'Neachitați' }, dueOf: (s: string) => \`din ${s} datorat\`, athletesOf: (n: number) => \`din ${n} sportivi\`, unpaidLine: 'sportivi cu rămas de plată', breakdown: 'Pe secțiune și grupă', switch: { sectiune: 'Secțiune și grupă', metoda: 'Metodă', scop: 'Scop' }, cols: { group: 'Grupă', due: 'Datorat', paid: 'Încasat', left: 'Rămas', percent: 'Încasat %', method: 'Metodă', purpose: 'Scop', count: 'Plăți' }, total: 'Total', note: 'Încasat aici: plătit din ce s-a datorat în luna asta.', exportBtn: 'Export contabil', xlsx: '.xlsx', csv: '.csv', figures: { numerar: 'Numerar', card: 'Card (POS)', transfer: 'Transfer bancar', cancelled: 'Anulate' }, listTitle: 'Plăți din lună', listCols: ['Data', 'Nr. chitanță', 'Sportiv', 'Pentru', 'Metodă', 'Sumă'], cancelledMark: 'anulată', empty: 'Nicio plată în luna asta.', receipt: 'Nr. chitanță', expiringFilter: 'Expiră în 14 zile' }`; purpose rows reuse the P5 "Tip" words ("Abonament", "Cotizație membru", "Club", "Lecție individuală", "Altceva").
- Produces (`routes.ts`): `BANI_PATH = '/plugins/edusport-bani'`; `readBaniQuery(search, today)` -> `{ view: 'prezentare' | 'contabilitate'; month: string }` (a month after today's falls back to the current one); `baniTo(q)`; `platiMonthTo(month)`, `deIncasatMonthTo(month)`, `abonamenteStateTo('active' | 'expira14')`.
- Produces (`money-view.ts`): `trendText(now, prev, prevMonth)` ("+6% față de oct", "-4% față de oct", null when prev is 0); `expiringLine(n)` ("abonamente", "1 abonament"); `percentText(p)` ("75%", "-"); `accountingDate(iso)` ("04.11"); `nextMonthAllowed(month, today)`.

- [ ] **Step 1: Write the failing test** with every example above (e.g. `trendText(18640, 17585, '2026-10') === '+6% față de oct'`).
- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/bani/__tests__/money-view.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run` (copy scan included); Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/copy/money-ui.ts src/club/bani/routes.ts src/club/bani/money-view.ts src/club/bani/__tests__/money-view.test.ts
git commit -m "feat(bani): Bani copy, address and figure texts"
```

---

### Task 5: Codes and receipt numbers in the existing screens (low, Haiku)

**Files:**
- Modify: `src/admin/dashboard/bani/{AbonamenteList,DeIncasatList,PlatiList,PlatiTab,PaymentWindow}.tsx`, `src/club/bani/{abonamente-view,due-view,plati-view}.ts`
- Test: `src/club/bani/__tests__/*.test.ts` (extend), `src/club/__tests__/money-ui-source.test.ts`

**Interfaces:**
- Produces (spec 5.7): Abonamente "Abonament" cell "<code> 8 ședințe" with the code muted; filter "Stare" gains "Expiră în 14 zile" (`expira14`); De încasat Școala rows show the code before the item name; the payment window "Pentru" shows the option labels with the code; Plăți list and the athlete's Plăți table get the column "Nr. chitanță" after "Data" (empty for older payments), abonament payments read "Abonament A-0124"; the toast after a payment unchanged.

- [ ] **Step 1: Write the failing tests**: view functions give the cells above (`abonamentCell({ code: 'A-0124', slots: 8 })` -> `{ code: 'A-0124', text: '8 ședințe' }`; `platiColumns()` has "Nr. chitanță" at index 1); the filter options end with "Expiră în 14 zile"; source tests find the new column in `PlatiList.tsx` and `PlatiTab.tsx`.
- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/bani/__tests__ src/club/__tests__/money-ui-source.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks; Expected: PASS, 0, exit 0.
- [ ] **Step 5: Commit**

```bash
git add src/admin/dashboard/bani src/club/bani src/club/__tests__/money-ui-source.test.ts
git commit -m "feat(bani): abonament codes and receipt numbers in the money screens"
```

---

### Task 6: "Bani" page (low, Sonnet)

**Files:**
- Create: `src/admin/dashboard/BaniPage.tsx`, `src/admin/dashboard/bani/{BaniCards,BaniBreakdown,BaniAccounting}.tsx`
- Modify: `src/admin/dashboard/menu.tsx` (entry "Bani" after "De încasat" in group `club`, `area: 'money'`, `addMenuLink` with `position: 7` and its own icon from `@strapi/icons`), `src/admin/dashboard/bani/api.ts`, `bani/styles.ts`
- Test: `src/club/__tests__/money-ui-source.test.ts` (extend), `src/club/__tests__/admin-menu-*.test.ts` if it pins the list

**Interfaces:**
- Consumes: T3 routes, T4 copy and views, 11-4 `downloadPdf` (GET blobs), 11-2 `AthleteLink`.
- Produces: spec 5.6: title "Bani", month switcher "<" "Noiembrie 2026" ">" (">" disabled at the current month), picker "Prezentare" / "Contabilitate"; Prezentare: five square cards, each a link (Încasat -> Plăți of the month; De încasat and Neachitați -> De încasat of the month; Abonamente active -> Abonamente "Active"; Expiră în 14 zile -> Abonamente "Expiră în 14 zile"); "Pe secțiune și grupă" with its switch; section header rows with subtotals, groups under them, "Total"; the muted note under Secțiune și grupă; Contabilitate: "Export contabil" (Popover ".xlsx" / ".csv"), four figures, "Plăți din lună" (struck rows with "anulată", athlete a new-tab link), empty text.

- [ ] **Step 1: Write the failing source tests**: `BaniPage.tsx` imports no `Tabs`, uses two `SegmentedControl`s and `StatTile` or square card links; the menu has "Bani" right after "De încasat" with `area: 'money'`; cards link with `platiMonthTo(`, `deIncasatMonthTo(`, `abonamenteStateTo(`; `BaniAccounting.tsx` uses `Popover` and `downloadPdf(` for both formats; no `dashed`, `dotted` or round radius; text-decoration line-through for cancelled rows comes from a class, not inline colour.
- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/__tests__/money-ui-source.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement**; phone: cards stack two a row then one, tables become cards.
- [ ] **Step 4: Run** all checks; Expected: PASS, 0, exit 0.
- [ ] **Step 5: Commit**

```bash
git add src/admin/dashboard/BaniPage.tsx src/admin/dashboard/bani src/admin/dashboard/menu.tsx src/club/__tests__
git commit -m "feat(bani): Bani page with figures, breakdown and accounting"
```

---

### Task 7: Whole-phase boot check, click-through and companion review (low, Sonnet)

Runs on `feat/athletes` after plans 11-1 to 11-4 and this plan's T1 to T6 are merged (a fresh worktree `feat/p11-check`, nothing committed except fixes).

**Files:** none in the repo. `T=${TMPDIR:-/tmp}/es115`. PNGs to `/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/phase11-renders/11-5-<name>-<desktop|phone>.png`.

- [ ] **Step 1: Database, build, data**: `es115-pg` on 55476, `npm run build`, `phase4-shape.js`, `phase5-shape.js`, `phase11-volume.js` (11-4), Strapi 1395, admin login. Check the backfill log line and `select count(*) from club_subscriptions where code is null` = 0.
- [ ] **Step 2: Every phase 11 route, with and without a token**

```bash
for p in "/club/attendance/period?from=$MON&to=$SUN" "/club/attendance/grid?from=$M1&to=$MEND" "/club/coaches/$K/presence?from=$M1&to=$MEND" \
  "/club/athletes/$A/presence?season=$S&page=1" "/club/tables/catalog" "/club/table-views" "/club/money/overview?month=$MONTH" "/club/money/accounting?month=$MONTH"; do
  printf '%s %s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $JWT" "$B$p")" "$(curl -s -o /dev/null -w '%{http_code}' "$B$p")" "$p"; done
```

Expected: `200 401` on every line.

- [ ] **Step 3: Caps and exports**
  - Period caps: 43 days on `/attendance/period`, `/attendance/grid`, `/coaches/:id/presence`: 400 "Perioada e prea lungă.".
  - 5.000 cap: the season Prezență table: 422 with the text, on query and on export (no file); the month table: 200.
  - Exports: tables .xlsx and .csv, coach .csv, Pe antrenori .csv, Export contabil .xlsx and .csv: each `attachment` with the spec 4.9 name; every xlsx opens with exceljs; every CSV starts with the BOM, uses ";" and CRLF; the `=1+1 Test` cell is safe in each; the accounting sums equal the overview's `collected` for the month plus "Anulate".
  - `GET /club/money/overview?month=<next month>`: 400.
  - The log: one `[download]` line per file, no names. Restart Strapi once: no error, no second backfill.
- [ ] **Step 4: Click-through and renders for the companion**: one pass over every phase 11 screen at 1440x900 and 390x844 (the 11-1 pattern): Prezență (week list, week grid, month list, day, lessons, coaches), session panel with links and a highlighted athlete, coach page (three pickers), athlete "Grupe și abonament" (cards, "Vezi zilele", Prezențe pages, a detail line), Sportivi "Tabele" (default view, builder, modal, 422 state, other author), Bani (Prezentare with each breakdown switch, Contabilitate with the export Popover), Abonamente with "Expiră în 14 zile", Plăți with "Nr. chitanță", De încasat with codes, the payment window "Pentru". Record per screen `page_errors`, `no_side_scroll`, `tabs` (only on Sportivi), `round_or_dashed` (computed styles: any `border-style: dashed|dotted` or `border-radius: 50%` outside the spinner, expected 0).
- [ ] **Step 5: Companion review**: put the PNGs side by side with the approved mockups (av-1c, av-1b, av-2, av-3c, av-4b, av-5, av-6) on a companion screen (prepend `mockups/companion-light.html`), one question per screen "Aprobat / De schimbat" plus a free note, and wait for the user's answers (read the events and `server.log`; never push a new screen while answers are pending). Every "De schimbat" becomes a `fix(<scope>): ...` commit in the owning plan's files, followed by the affected render.
- [ ] **Step 6: Clean up**: stop Strapi, `docker rm -f es115-pg`, `rm -rf "$T"`. Update `docs/HANDOFF.md` with the phase 11 state (built, not deployed, the deploy steps of the index) in a `docs: phase 11 admin views built` commit.

---

## Interfaces for other plans

- **6b:** every phase 11 route carries its area through `adminRoute`; `BANI_PATH` and `TABLES_AREA` for the menu and page map; `money` holds Bani, accounting and every export.
