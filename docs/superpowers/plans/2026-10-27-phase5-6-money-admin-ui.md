# Phase 5-6: Money Admin UI (Abonamente, Plăți, De încasat, athlete tabs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin screens of phase 5 money: the "Abonamente" page with "Prelungește abonamentele" and "Anulează abonamentul", the "Adaugă abonament" window, the "Plăți" page with the payment window, edit and "Anulează plata", "De încasat", the athlete tabs "Grupe și abonament" and "Plăți", the session panel row menu ("Adaugă abonament", "+ Plată"), the abonament bar and Gold line in the move window, the Sportivi "Abonament" column and filter, the delete refusal dialog, and check "Uscat" in Prețuri and the start date in Setări site; then render every screen at 1440 and 390.

**Architecture:** Every rule a screen needs is a pure module in `src/club/bani/` (addresses, window models, row texts, filter sections) plus the strings in `src/club/presence/copy/money-ui.ts`, tested with Vitest; the React components in `src/admin/dashboard/bani/` and the athlete record files stay thin, call the plan 5-3 routes through one `useMoneyApi` hook, and are pinned by source-reading tests (the admin bundle has no test runner), as plan 4-5 did for Grupe. The three pages fill the page components plan 5-5 registered in the menu.

**Tech Stack:** React 18 (Strapi 5.52.1 admin, `strict: true`), the shared admin UI (`src/admin/ui`), Vitest 3, Python Playwright for the renders, Postgres 16.

**Spec:** `docs/superpowers/specs/2026-10-27-attendance-payments-design.md` (v1, approved 2026-10-27): 5 (intro: phone, toasts, amounts, dates), 5.3 (row menu), 5.7 to 5.16, 7.3 (toasts with "Anulează"), 10, 11.3 (UI source tests), 11.4 (renders). Index: `docs/superpowers/plans/2026-10-27-phase5-index.md`. Consumes plans 5-3 (`docs/superpowers/plans/2026-10-27-phase5-3-abonamente-payments.md`), 5-4 (delete refusal 409 and its copy, `2026-10-27-phase5-4-lifecycle.md`), 5-5 (menu entries, page routes, `SessionPanel`, Setări field, `2026-10-27-phase5-5-prezenta-admin-ui.md`), 5-2 (athlete month attendance route). Mockups (recommended options everywhere except p5-4 Q22: the e-mail box is OFF by default): `.superpowers/phase5/screens/p5-2-abonamente.html`, `p5-3-club-preturi.html`, `p5-4-plati.html`, `p5-7-confirm.html`. Decisions: `../edusport_frontend/docs/portal/DECISIONS.md`. Agent rules: `.superpowers/phase3-shared/agent-rules.md`.

**Base:** `feat/athletes` with plans 5-3, 5-4 and 5-5 merged.

**Parallel groups:** A: T1 | B: T2, T6 | C: T3, T4, T5, T7 | D: T8

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Foundation | nothing in this plan | `src/club/bani/{routes,format}.ts`, `copy/money-ui.ts`, `bani/api.ts`, `bani/undo.ts`, `bani/AbonamentBar.tsx` |
| B | 2 Payment window, 6 Athlete tabs | 1 | 2: `payment-window.ts`, `PaymentWindow.tsx`, `CancelPaymentDialog.tsx`; 6: `athlete-money-view.ts`, `sportivi/AbonamentTab.tsx`, `PlatiTab.tsx`, `record-view.ts`, `AthleteRecordPage.tsx` |
| C | 3 Plăți, 4 Abonamente, 5 De încasat, 7 Panel menu, move bar, Sportivi, delete | 2 (3, 5, 7), 1 (4) | one page file and its view each; 7: `SessionPanel` row menu, `MoveDialog.tsx`, `list-view.ts`, `AthleteTable.tsx`, `AthleteCards.tsx`, `RecordMenu.tsx`, `DeleteRefusalDialog.tsx` |
| D | 8 Boot check and renders | everything | no repo files |

Risk: **low** T1 to T8 (index: UI plans carry no per-task review; the plan's final review covers them). The money rules they show are decided and tested in plan 5-3.

## Decided while planning (low impact, decided by Claude; the user may overrule any line)

Log them in DECISIONS.md as "plan 5-6, decided by Claude (low impact, 2026-10-27)".

1. **One submit per click.** Every window that writes money (Plată nouă, Editează plata, Anulează plata, Adaugă abonament, Prelungește) guards its submit with a ref set before the request and cleared after it, besides the `loading` button; a second click while the first is in flight does nothing (the server's 10 s rule of plan 5-3 decided 1 is the second line) (`bani/useSubmitOnce.ts`).
2. **Amount input** accepts "320", "12,50" and "12.50"; more than two decimals or no number shows "Suma trebuie să fie mai mare decât 0." (`payment-window.ts::parseAmount`).
3. **Editing a payment whose link is no longer offered** (a lesson older than 12 months): the window adds the payment's own "Pentru" as the first option, labelled with its list text (`payment-window.ts::editOptions`).
4. **Delete refusal counts** are read when "Șterge sportivul" is chosen, from `GET /club/athletes/:id/payments` and `.../subscriptions` (payments incl. cancelled, every abonament); with any, the refusal opens instead of the confirmation; a 409 `{ payments, subscriptions }` from DELETE (a payment added meanwhile) opens it too (`bani/delete-refusal.ts`).
5. **Opening a row of "De încasat" or "Abonamente"** navigates to the athlete record with `?tab=plati` / `?tab=abonament` (`bani/routes.ts::athleteTabTo`).
6. **Page and tab names in the code:** pages `AbonamentePage`, `PlatiPage`, `DeIncasatPage` (plan 5-5 registers them; this plan fills them; if 5-5 named them otherwise, fill 5-5's files and keep the names of its Interfaces block); record tab ids `abonament`, `plati`.
7. **Phone layout:** tables become cards with the Sportiv name first, then the cells joined by commas in table order ("Intermediari Bronze, 5/8, 7 nov 2026, activ"), the same pattern as the Sportivi cards; windows become sheets (`Window` with `useIsPhone`).
8. **Bar segments** are square marks, used ones in `var(--theme-primary)`, free ones in the border colour; no circles, no dashed lines (`AbonamentBar.tsx`).

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes`. Commit only in the worktree your dispatch names (never in p3be or p3fe); before every commit run `git rev-parse --show-toplevel` and `git branch --show-current` and compare with the dispatch.
- A dated DECISIONS.md entry wins over the spec; the spec wins over this plan's prose.
- Checks after every task: the task's test file, `npx vitest run`, `npx tsc --noEmit`, `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict` (all zero errors).
- Admin UI: only `src/admin/ui` components and tokens (`var(--theme-*)`, `var(--palette-*)`, `var(--ui-radius-*)`), no raw hex or rgb, no `--adm-` variables; no pills or circles (only the spinner is round), no dashed or dotted lines, buttons and badges flat; tables become cards and windows sheets at phone width; filters use filters-v3 on desktop and the BottomSheet on phones; toasts with "Anulează" for 8 s and no X (spec 5).
- Rules live in `src/club/**` (pure, tested); components only render and call the api; every component pinned by a source-reading test in `src/club/__tests__/money-ui-source.test.ts`.
- Copy: every visible string from `src/club/presence/copy/` (`money-ui.ts` of this plan; `subscriptions.ts`, `payments.ts` of plan 5-3; `lifecycle.ts` of plan 5-4), exactly as the spec gives it; "RON" amounts through `ron` ("320 RON", "12,50 RON"); list dates "Mar 27 oct" (`listDate`), elsewhere "27 oct 2026" (`longDate`); no em or en dash, no middle dot, no emoji, straight quotes. A string the spec does not give is not invented: the place stays empty and is listed in "Copy gaps" below.
- The "Trimite e-mail "Plată înregistrată"" box is unticked when a window opens, every time (spec 2.3, p5 Q22 B).
- Functions under 30 lines, complexity under 10, no `any`, single quotes, semicolons, 2-space indent.
- Synthetic data only; Task 8 uses container `es56-pg` on 127.0.0.1:55456 and Strapi on 1376; never 1337, 1340, 3010, 5432, 55442, `strapi_app`, `strapi_db`, `edusport-test-pg`.
- Commits: Conventional Commits, the message given in the task, no AI attribution; never push.
- Progress board: one line per status change to `/Users/codrin/Documents/Programming/edusport_backend/.superpowers/phase3-shared/progress-board.md`.

## Copy gaps (not invented; for the user)

- Empty "Abonamente" list (no row for the filters), empty "Plăți" month, empty athlete "Plăți" tab, no attendance in the "Prezențe" month block, no earlier abonamente: spec 5 gives no text. Built as: the table header with no rows (lists), the block or heading hidden (tabs). One line each in the companion when the renders are shown.

## Review Focus

- **Double payment on a double click** on "Înregistrează", "Adaugă abonament" (with "Înregistrează plata acum"), "Prelungește <n> abonamente" or "Anulează plata": one request, one toast. Pinned by Task 1 (`useSubmitOnce` source test) and Task 8 (a double click in the render script, then one row in Plăți).
- **An amount typed with a comma or too many decimals** ("12,50", "12,505", "0", ""): 12.5 sent; the error under "Sumă" otherwise, nothing sent. Pinned by Task 2.
- **Gold line only when the carry happens** (move to Gold from Standard; to another Standard group; to Club; Gold to Standard; an athlete without abonament): line, no line, no line, no line, no bar. Pinned by Task 7 (view) and Task 8 (renders).
- **Expiry and cancel cues on Abonamente** (an expired date, a row with a payment, a cancelled row): the date in red text, no "Anulează abonamentul" item, no "..." at all. Pinned by Task 4.
- **Cancelled payments** in Plăți, the athlete tab and the totals: struck through with "anulată", left out of "Total" and of every default amount, no "Editează" / "Anulează plata" on them. Pinned by Tasks 3 and 6.
- **Phone width** (390 px, a long athlete and item name): cards wrap, no sideways scroll, windows as sheets. Pinned by Task 8 renders.

---

## File Structure

```
src/club/presence/copy/money-ui.ts     MONEY_UI_COPY (T1) + one export line in copy.ts
src/club/bani/
  routes.ts            page paths, athleteTabTo, readMoneyQuery (T1)
  format.ts            barSegments, slotsText, stateWord, expiredDate, phone card text (T1)
  payment-window.ts    draft, parseAmount, optionsFor, editOptions, checkDraft, toBody, emailBox (T2)
  plati-view.ts        filter sections, row cells, total line, row menu (T3)
  abonamente-view.ts   filter sections, row cells, row menu, extend modal model, add window model (T4)
  due-view.ts          part rows, empty state, row actions (T5)
  athlete-money-view.ts  groups lines, earlier rows, attendance rows, month rows, record tabs (T6)
  move-bar.ts          moveBarView (T7)
  delete-refusal.ts    refusalCounts (T7)
  __tests__/*.test.ts
src/club/__tests__/money-ui-source.test.ts   source-reading tests of every component (T1 to T7)
src/admin/dashboard/bani/
  api.ts               useMoneyApi (T1)
  undo.ts              moneyUndoToast, moneyChanged, useMoneyChanged (T1)
  useSubmitOnce.ts     (T1)
  AbonamentBar.tsx     (T1)
  PaymentWindow.tsx, CancelPaymentDialog.tsx   (T2)
  PlatiList.tsx        (T3)
  AbonamenteList.tsx, AddSubscriptionWindow.tsx, ExtendModal.tsx   (T4)
  DeIncasatList.tsx    (T5)
src/admin/dashboard/AbonamentePage.tsx, PlatiPage.tsx, DeIncasatPage.tsx   bodies filled (T3, T4, T5; files from plan 5-5)
src/admin/dashboard/sportivi/AbonamentTab.tsx, PlatiTab.tsx (T6), DeleteRefusalDialog.tsx (T7)
src/admin/dashboard/sportivi/AthleteRecordPage.tsx, src/club/sportivi/record-view.ts   tabs (T6)
src/admin/dashboard/sportivi/RecordMenu.tsx   delete refusal (T7)
src/admin/dashboard/sportivi/AthleteTable.tsx, AthleteCards.tsx, src/club/sportivi/list-view.ts   column and filter (T7)
src/admin/dashboard/grupe/MoveDialog.tsx      bar and Gold line (T7)
SessionPanel row menu (plan 5-5's file)        "Adaugă abonament", "+ Plată" (T7)
```

---

### Task 1: Foundation: copy, addresses, formats, api, undo toast, bar (low)

**Files:**
- Create: `src/club/presence/copy/money-ui.ts`, `src/club/bani/routes.ts`, `src/club/bani/format.ts`, `src/admin/dashboard/bani/api.ts`, `undo.ts`, `useSubmitOnce.ts`, `AbonamentBar.tsx`
- Modify: `src/club/presence/copy.ts` (one line)
- Test: `src/club/bani/__tests__/foundation.test.ts`, `src/club/__tests__/money-ui-source.test.ts` (created here, grown by every task)

**Interfaces:**
- Consumes (5-3): `money-api.ts` types, `AbonamentBar` type, `SUBSCRIPTION_COPY` (`barTitle`, `expiresOn`, `usedText`, `leftText`, `goldLine`), `PAYMENT_COPY`, `SUBSCRIPTION_STATE_WORDS`, `ron`, `listDate`, `longDate`, `monthTitle`; `adminToast`, `UNDO_MS` (as `grupe/undo.ts`), `useFetchClient` pattern of `grupe/api.ts`.
- Produces:
  - `MONEY_UI_COPY` (exact strings of spec 5.7 to 5.13):

| Key | Text |
|---|---|
| `abonamente.title`, `.subtitle`, `.extend`, `.add` | "Abonamente", "Școala de patinaj", "Prelungește abonamentele", "+ Abonament" |
| `abonamente.state`, `.stateOptions` | "Stare"; "Toate", "Active", "Epuizate", "Expirate", "Anulate" |
| `abonamente.group`, `.all` | "Grupă", "Toate" |
| `abonamente.columns` | "Sportiv", "Grupă", "Abonament", "Folosite", "Expiră", "Stare" |
| `plati.title`, `.add`, `.period`, `.method`, `.type` | "Plăți", "+ Plată", "Perioadă", "Metodă", "Tip" |
| `plati.typeOptions` | "Toate", "Abonament", "Cotizație membru", "Club", "Lecție individuală", "Altceva" |
| `plati.columns` | "Data", "Sportiv", "Pentru", "Metodă", "Sumă", "Înregistrat de" |
| `plati.total(sum)`, `.edit` | "Total: <sumă>", "Editează" |
| `due.title`, `.month`, `.school`, `.club`, `.empty` | "De încasat", "Luna", "Școala de patinaj", "Club", "Nimic de încasat în luna asta." |
| `due.schoolColumns`, `.clubColumns` | "Sportiv", "Grupă", "Abonament", "Preț", "Plătit", "Rămas"; "Sportiv", "Grupă", "Ședințe", "De plătit", "Plătit", "Rămas" |
| `tabs.abonament`, `.plati` | "Grupe și abonament", "Plăți" |
| `athlete.groups`, `.mainGroup(name)`, `.none`, `.addSubscription`, `.earlier`, `.earlierRow(...)`, `.attendance`, `.attendanceRow(...)` | "Grupe", "<grupă>, principală", "Fără abonament.", "+ Adaugă abonament", "Abonamente anterioare", "<itemName>, <start> - <expiră>, <folosite>/<sloturi>, <stare>", "Prezențe", "<listDate>, <grupă>, <tipuri>[, Fără abonament]" |
| `athlete.monthColumns` | "Luna", "Ședințe", "De plătit", "Plătit", "Rămas" |
| `sportivi.column`, `.filter`, `.filterOptions` | "Abonament", "Abonament"; "Toate", "Activ", "Fără abonament" |
| `menu.addSubscription`, `.addPayment` | "Adaugă abonament", "+ Plată" |

  - `routes.ts`: `ABONAMENTE_PATH = '/plugins/edusport-abonamente'`, `PLATI_PATH = '/plugins/edusport-plati'`, `DE_INCASAT_PATH = '/plugins/edusport-de-incasat'` (spec 5.1; the same constants plan 5-5 uses for the menu, imported from 5-5's module when it already exports them); `athleteTabTo(athleteId: string, tab: 'abonament' | 'plati'): string`; `readMoneyQuery(search: string): { month: string | null; state: string | null; group: string | null; method: string | null; purpose: string | null }`.
  - `format.ts`: `barSegments(bar: AbonamentBar): boolean[]` (true = used); `slotsText(n: number): string` ("8 ședințe", "1 ședință"); `stateWord(s: SubscriptionState): string`; `isPastDate(date: string, today: string): boolean`; `cardLine(cells: (string | null)[]): string` (non-empty cells joined by ", ").
  - `useMoneyApi()` (`bani/api.ts`): typed calls for every route of plan 5-3 Task 10 plus `undo(actionId)`, `athleteAttendance(athleteId, month)` (plan 5-2 route) and `remove(athleteId)` (P3 delete); one stable identity per render (as `useGrupeApi`).
  - `moneyUndoToast(text: string, actionId: string | null, api: MoneyApi): void`, `moneyChanged(): void`, `useMoneyChanged(reload: () => void): void` (`bani/undo.ts`, the `grupe/undo.ts` pattern: success toast, "Anulează" for `UNDO_MS` when `actionId`, refusal text from the server on a failed undo).
  - `useSubmitOnce<T>(work: () => Promise<T>): { run: () => Promise<T | undefined>; busy: boolean }` (decided 1).
  - `AbonamentBar` component props `{ bar: AbonamentBar; goldLine?: boolean }`: title left, "Expiră pe <data>" right muted, the segments, "<n> folosite" left and "<n> rămase" right, small, muted; with `goldLine` the line under it (5.7, 5.12).

- [ ] **Step 1: Write the failing tests**

`foundation.test.ts`:

```ts
it('bar segments, slots, dates (5.7, 5.9)', () => {
  expect(barSegments({ subscriptionId: 's', itemName: 'Abonament 8 ședințe', slots: 8, used: 5, validUntil: '2026-11-23' }))
    .toEqual([true, true, true, true, true, false, false, false]);
  expect([slotsText(8), slotsText(6), slotsText(1)]).toEqual(['8 ședințe', '6 ședințe', '1 ședință']);
  expect([isPastDate('2026-11-19', '2026-11-20'), isPastDate('2026-11-20', '2026-11-20')]).toEqual([true, false]);
  expect(cardLine(['Intermediari Bronze', null, '5/8', '7 nov 2026', 'activ'])).toBe('Intermediari Bronze, 5/8, 7 nov 2026, activ');
});
it('addresses (5.1, decided 5)', () => {
  expect([ABONAMENTE_PATH, PLATI_PATH, DE_INCASAT_PATH]).toEqual(['/plugins/edusport-abonamente', '/plugins/edusport-plati', '/plugins/edusport-de-incasat']);
  expect(athleteTabTo('a1', 'plati')).toBe('/plugins/edusport-sportivi/a1?tab=plati');
  expect(readMoneyQuery('?month=2026-10&state=toate')).toMatchObject({ month: '2026-10', state: 'toate', group: null });
});
it('copy of the money screens (5.7 to 5.13)', () => {
  const c = MONEY_UI_COPY;
  expect([c.abonamente.title, c.abonamente.subtitle, c.abonamente.extend, c.abonamente.add]).toEqual(['Abonamente', 'Școala de patinaj', 'Prelungește abonamentele', '+ Abonament']);
  expect(c.abonamente.stateOptions).toEqual(['Toate', 'Active', 'Epuizate', 'Expirate', 'Anulate']);
  expect(c.plati.total(ron(840))).toBe('Total: 840 RON');
  expect(c.athlete.earlierRow('Abonament 8 ședințe', '2026-09-29', '2026-10-26', 8, 8, 'epuizat')).toBe('Abonament 8 ședințe, 29 sep 2026 - 26 oct 2026, 8/8, epuizat');
  expect(c.athlete.attendanceRow('2026-10-20', 'Intermediari Bronze', 'Grup', true)).toBe('Mar 20 oct, Intermediari Bronze, Grup, Fără abonament');
  expect(c.athlete.mainGroup('Intermediari Bronze')).toBe('Intermediari Bronze, principală');
  expect(c.due.empty).toBe('Nimic de încasat în luna asta.');
  expect(c.sportivi.filterOptions).toEqual(['Toate', 'Activ', 'Fără abonament']);
});
```

`money-ui-source.test.ts` (reads files as text, as `ui-sheet.test.ts` does):

```ts
it('the bar draws square segments with tokens, no circle (decided 8)', () => {
  const s = src('admin/dashboard/bani/AbonamentBar.tsx');
  expect(s).toMatch(/barSegments\(/);
  expect(s).toMatch(/SUBSCRIPTION_COPY\.(usedText|leftText)/);
  expect(s).not.toMatch(/border-radius:\s*50%|borderRadius:\s*'50%'|dashed|dotted|#[0-9a-f]{3,6}\b/i);
});
it('one submit per click (decided 1)', () => {
  expect(src('admin/dashboard/bani/useSubmitOnce.ts')).toMatch(/inFlight\.current/);
});
it('undo toasts use the server action id and 8 s', () => {
  expect(src('admin/dashboard/bani/undo.ts')).toMatch(/UNDO_MS/);
});
```

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/bani/__tests__/foundation.test.ts src/club/__tests__/money-ui-source.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the files; add `export * from './copy/money-ui';` to `copy.ts`.
- [ ] **Step 4: Run** the Global Constraints checks; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/copy/money-ui.ts src/club/presence/copy.ts src/club/bani src/club/__tests__/money-ui-source.test.ts src/admin/dashboard/bani
git commit -m "feat(bani): money UI copy, addresses, api hook, undo toast and abonament bar"
```

---

### Task 2: Payment window ("Plată nouă", "Editează plata") and "Anulează plata" (low)

**Files:**
- Create: `src/club/bani/payment-window.ts`, `src/admin/dashboard/bani/PaymentWindow.tsx`, `src/admin/dashboard/bani/CancelPaymentDialog.tsx`
- Test: `src/club/bani/__tests__/payment-window.test.ts`, `money-ui-source.test.ts` (grows)

**Interfaces:**
- Consumes: `PaymentFor`, `PaymentOption`, `PaymentRowView` (5-3), `PAYMENT_COPY`, `METHOD_WORDS`, `ron`, `longDate`; `AthleteSearch` (`sportivi/AthleteSearch.tsx`, P3 "Caută alt sportiv"), `SegmentedControl`, `Select`, `Checkbox`, `Textarea`, `Input`, `DateInput`, `Window`, `ConfirmDialog`; Task 1 (`useMoneyApi`, `moneyUndoToast`, `useSubmitOnce`).
- Produces:

```ts
export type PaymentDraft = { athleteId: string | null; amount: string; paidOn: string; method: PaymentMethod; optionKey: string | null; collectedAtRink: boolean; sendEmail: boolean; note: string };
export type DraftErrors = Partial<Record<'amount' | 'paidOn' | 'for', string>>;
export const optionKey: (f: PaymentFor) => string;   // "abonament:<id>", "cotizatie:<id>", "club_luna:2026-10", "lectie:<id>", "altceva"
export function parseAmount(text: string): number | null;
export function newDraft(i: { athleteId: string | null; today: string; preselect: PaymentFor | null; options: PaymentOption[] }): PaymentDraft;
export function withOption(d: PaymentDraft, key: string, options: PaymentOption[]): PaymentDraft;   // amount = the option's default (empty when null); rink off unless abonament
export function editDraft(p: PaymentRowView): PaymentDraft;
export function editOptions(options: PaymentOption[], p: PaymentRowView): PaymentOption[];   // decided 3
export function checkDraft(d: PaymentDraft, today: string): DraftErrors;
export function toBody(d: PaymentDraft, options: PaymentOption[]): Record<string, unknown>;   // POST /club/payments or PUT body of plan 5-3 Task 4
export const showsRink: (d: PaymentDraft) => boolean;     // only for an abonament (C8)
export function emailBox(hasEmail: boolean): { disabled: boolean; hint: string | null };   // "Sportivul nu are e-mail." (C36)
export function cancelText(p: PaymentRowView): string;    // "Anulezi plata de 320 RON din 27 oct 2026? Rândul rămâne, marcat anulată."
```

- `PaymentWindow` props `{ mode: 'new' | 'edit'; athlete?: { id: string; name: string } | null; preselect?: PaymentFor | null; payment?: PaymentRowView; onClose(): void }`: title "Plată nouă" / "Editează plata"; fields in the spec 5.10 order; "Sportiv" is the athlete search when no athlete is given, locked text otherwise, absent on edit; "Metodă" a segmented control defaulting "Numerar" (C63); "Pentru" a Select of the athlete's options (`GET .../payments/options`, loaded after the athlete is known); "Încasat la patinoar" only when `showsRink`; the e-mail box unticked, absent on edit; "Notă" with hint "Opțional"; buttons "Renunță" / "Înregistrează" (edit "Salvează"). Toasts: "Plată înregistrată: <sumă>, <nume>." with "Anulează"; edit "Salvat." with "Anulează" or "Nicio modificare." without. Errors under their fields; a server error in a `Notice`.
- `CancelPaymentDialog` props `{ payment: PaymentRowView; onClose(): void }`: `ConfirmDialog` with `cancelText`, buttons "Renunță" / "Anulează plata" (danger); toast "Plată anulată." with "Anulează".

- [ ] **Step 1: Write the failing tests** `payment-window.test.ts`:

```ts
const opts: PaymentOption[] = [
  { for: { kind: 'abonament', subscriptionId: 'sub1' }, label: 'Abonament 8 ședințe (activ din 27 oct)', amount: 320, isDefault: false },
  { for: { kind: 'cotizatie', seasonId: 's26' }, label: 'Cotizație membru 2026-2027', amount: 100, isDefault: true },
  { for: { kind: 'club_luna', month: '2026-10' }, label: 'Club, octombrie', amount: 160, isDefault: false },
  { for: { kind: 'altceva' }, label: 'Altceva', amount: null, isDefault: false }];
it('amount text: comma or point, two decimals at most (decided 2)', () => {
  expect(['320', '12,50', '12.5', ' 40 '].map(parseAmount)).toEqual([320, 12.5, 12.5, 40]);
  expect(['', '0', '-3', '12,505', 'abc', '1e3'].map(parseAmount)).toEqual([null, null, null, null, null, null]);
});
it('a new payment: today, Numerar, e-mail off, nothing chosen; preselected from De încasat (5.10, C33, C63, p5 Q22)', () => {
  expect(newDraft({ athleteId: 'a1', today: '2026-11-20', preselect: null, options: opts }))
    .toEqual({ athleteId: 'a1', amount: '', paidOn: '2026-11-20', method: 'numerar', optionKey: null, collectedAtRink: false, sendEmail: false, note: '' });
  expect(newDraft({ athleteId: 'a1', today: '2026-11-20', preselect: { kind: 'club_luna', month: '2026-10' }, options: opts })).toMatchObject({ optionKey: 'club_luna:2026-10', amount: '160' });
});
it('choosing "Pentru" sets the default amount; rink only for an abonament (C8)', () => {
  const d = withOption(newDraft({ athleteId: 'a1', today: '2026-11-20', preselect: null, options: opts }), 'abonament:sub1', opts);
  expect([d.amount, showsRink(d)]).toEqual(['320', true]);
  const e = withOption({ ...d, collectedAtRink: true }, 'altceva', opts);
  expect([e.amount, e.collectedAtRink, showsRink(e)]).toEqual(['', false, false]);
});
it('errors of 5.10', () => {
  const d = newDraft({ athleteId: 'a1', today: '2026-11-20', preselect: null, options: opts });
  expect(checkDraft(d, '2026-11-20')).toEqual({ amount: 'Suma trebuie să fie mai mare decât 0.', for: 'Alege pentru ce este plata.' });
  expect(checkDraft({ ...d, amount: '12,50', optionKey: 'altceva', paidOn: '2026-11-21' }, '2026-11-20')).toEqual({ paidOn: 'Data nu poate fi în viitor.' });
});
it('the body sent (plan 5-3 Task 4)', () => {
  const d = { ...withOption(newDraft({ athleteId: 'a1', today: '2026-11-20', preselect: null, options: opts }), 'abonament:sub1', opts), amount: '12,50', sendEmail: true };
  expect(toBody(d, opts)).toEqual({ athleteId: 'a1', amount: 12.5, paidOn: '2026-11-20', method: 'numerar', for: { kind: 'abonament', subscriptionId: 'sub1' }, collectedAtRink: false, note: '', sendEmail: true });
});
it('edit keeps the payment\'s own Pentru when it is no longer offered (decided 3)', () => {
  const p = paymentView({ for: { kind: 'lectie', lessonId: 'old' }, purposeText: 'Lecție individuală' });
  expect(editOptions(opts, p)[0]).toMatchObject({ label: 'Lecție individuală', for: { kind: 'lectie', lessonId: 'old' } });
  expect(editDraft(p).sendEmail).toBe(false);
});
it('e-mail box disabled without an address; cancel confirmation text (C36, 5.10)', () => {
  expect([emailBox(true), emailBox(false)]).toEqual([{ disabled: false, hint: null }, { disabled: true, hint: 'Sportivul nu are e-mail.' }]);
  expect(cancelText(paymentView({ amount: 320, paidOn: '2026-10-27' }))).toBe('Anulezi plata de 320 RON din 27 oct 2026? Rândul rămâne, marcat anulată.');
});
```

Source tests (in `money-ui-source.test.ts`): `PaymentWindow.tsx` uses `useSubmitOnce`, `newDraft`, `checkDraft`, `toBody`, `emailBox`, has no `sendEmail: true` literal, renders the e-mail box only when `mode === 'new'`, uses `PAYMENT_COPY` for every label; `CancelPaymentDialog.tsx` uses `cancelText` and `moneyUndoToast`.

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/bani/__tests__/payment-window.test.ts src/club/__tests__/money-ui-source.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the three files (window split into `PaymentFields` and `useOptions` to stay under 30 lines per function).
- [ ] **Step 4: Run** the Global Constraints checks; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/bani/payment-window.ts src/club/bani/__tests__/payment-window.test.ts src/admin/dashboard/bani/PaymentWindow.tsx src/admin/dashboard/bani/CancelPaymentDialog.tsx src/club/__tests__/money-ui-source.test.ts
git commit -m "feat(bani): payment window, edit and cancel confirmation"
```

---

### Task 3: "Plăți" page (low)

**Files:**
- Create: `src/club/bani/plati-view.ts`, `src/admin/dashboard/bani/PlatiList.tsx`
- Modify: `src/admin/dashboard/PlatiPage.tsx` (plan 5-5's placeholder body)
- Test: `src/club/bani/__tests__/plati-view.test.ts`, `money-ui-source.test.ts`

**Interfaces:**
- Consumes: `PaymentList`, `PaymentRowView` (5-3), `PAYMENT_COPY.rink`, `METHOD_WORDS`, `PURPOSE_WORDS`, `monthTitle`, `addMonths`, `monthOf`, Task 1, Task 2 (`PaymentWindow`, `CancelPaymentDialog`), `FilterPanel`, `DataTable`, `PageHeader`.
- Produces: `platiSections(q: { month: string; method: string | null; purpose: string | null }, today: string): FilterSection[]` ("Perioadă" months, newest first, the last 24 months; "Metodă" "Toate" + three; "Tip" "Toate" + five, C60); `platiCells(r: PaymentRowView): { date: string; athlete: string; purpose: string; method: string; amount: string; recordedBy: string; struck: boolean; mark: string | null }` (date `listDate`, method with ", la patinoar" when ticked, `mark` "anulată" on a cancelled row); `rowMenu(r: PaymentRowView): ('edit' | 'cancel')[]` (empty for a cancelled row); `totalLine(list: PaymentList): string`.
- Page: title "Plăți", subtitle `monthTitle(month)`, "+ Plată" (primary) opens `PaymentWindow` with the athlete search; filters in the URL (`?month=&method=&purpose=`); table newest first, struck rows with "anulată"; "Total: <sumă>" under the table; row "..." "Editează" / "Anulează plata" (red); phone cards (decided 7); reloads on `useMoneyChanged`.

- [ ] **Step 1: Write the failing tests**

```ts
it('cells: rink after the method, cancelled struck with "anulată" (5.10, p5 Q23)', () => {
  expect(platiCells(paymentView({ paidOn: '2026-10-27', athleteName: 'Ana Ionescu', purposeText: 'Abonament 8 ședințe', method: 'numerar', collectedAtRink: true, amount: 320, recordedBy: 'Admin 1' })))
    .toEqual({ date: 'Mar 27 oct', athlete: 'Ana Ionescu', purpose: 'Abonament 8 ședințe', method: 'Numerar, la patinoar', amount: '320 RON', recordedBy: 'Admin 1', struck: false, mark: null });
  const c = paymentView({ cancelled: true, method: 'card', amount: 80 });
  expect([platiCells(c).struck, platiCells(c).mark, platiCells(c).method, rowMenu(c)]).toEqual([true, 'anulată', 'Card (POS)', []]);
  expect(rowMenu(paymentView({}))).toEqual(['edit', 'cancel']);
});
it('filters and total (5.10, C62)', () => {
  const s = platiSections({ month: '2026-10', method: null, purpose: null }, '2026-11-20');
  expect(s.map((x) => x.label)).toEqual(['Perioadă', 'Metodă', 'Tip']);
  expect(s[0].options[0]).toEqual({ value: '2026-11', label: 'Noiembrie 2026' });
  expect(s[2].options.map((o) => o.label)).toEqual(['Toate', 'Abonament', 'Cotizație membru', 'Club', 'Lecție individuală', 'Altceva']);
  expect(totalLine({ rows: [], total: 840 })).toBe('Total: 840 RON');
});
```

Source tests: `PlatiList.tsx` uses `platiCells`, `rowMenu`, `totalLine`, `PaymentWindow`, `CancelPaymentDialog`; the struck style is `text-decoration: line-through` (no colour literal); `PlatiPage.tsx` renders `PlatiList`.

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/bani/__tests__/plati-view.test.ts src/club/__tests__/money-ui-source.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the view, the list and the page body.
- [ ] **Step 4: Run** the Global Constraints checks; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/bani/plati-view.ts src/club/bani/__tests__/plati-view.test.ts src/admin/dashboard/bani/PlatiList.tsx src/admin/dashboard/PlatiPage.tsx src/club/__tests__/money-ui-source.test.ts
git commit -m "feat(bani): Plăți page with filters, total and row menu"
```

---

### Task 4: "Abonamente" page, "Adaugă abonament", "Prelungește abonamentele" (low)

**Files:**
- Create: `src/club/bani/abonamente-view.ts`, `src/admin/dashboard/bani/AbonamenteList.tsx`, `AddSubscriptionWindow.tsx`, `ExtendModal.tsx`
- Modify: `src/admin/dashboard/AbonamentePage.tsx` (plan 5-5's placeholder body)
- Test: `src/club/bani/__tests__/abonamente-view.test.ts`, `money-ui-source.test.ts`

**Interfaces:**
- Consumes: `SubscriptionListPage`, `SubscriptionListRow`, `NewSubscriptionForm`, `OfferedItem`, `CoverRow`, `defaultCover`, `checkCover`, `SUBSCRIPTION_COPY`, `readAmount` (5-3); Task 1, Task 2 (`parseAmount`, `emailBox`), `AthleteSearch`.
- Produces:

```ts
export function abonamenteSections(q: { state: SubscriptionStateFilter; groupId: string | null }, groups: { value: string; label: string }[]): FilterSection[];
export function abonamenteCells(r: SubscriptionListRow, today: string): { athlete: string; group: string; item: string; used: string; expires: string; expiredRed: boolean; state: string };
export const abonamentMenu = (r: SubscriptionListRow): 'cancel'[] => (r.canCancel ? ['cancel'] : []);   // 5.9, C75
export type AddDraft = { listId: string | null; itemKey: string | null; startsOn: string; cover: string[]; payNow: boolean; amount: string; method: PaymentMethod; collectedAtRink: boolean; sendEmail: boolean };
export function addDraft(form: NewSubscriptionForm): AddDraft;   // first list and item, cover = defaultCover, payNow off (C57), amount = item price
export function withItem(d: AddDraft, form: NewSubscriptionForm, listId: string, itemKey: string): AddDraft;   // cover and amount follow the item
export function toggleCover(d: AddDraft, form: NewSubscriptionForm, id: string): AddDraft;   // never more than the slots (C23)
export function coverDisabled(d: AddDraft, form: NewSubscriptionForm, id: string): boolean;
export function addBody(d: AddDraft): Record<string, unknown> | { error: string };   // plan 5-3 Task 5 body; payment only when payNow
export function addToast(name: string, withPayment: boolean): string;
export function itemOptions(form: NewSubscriptionForm): { value: string; label: string; hint: string | null }[];   // "<item>, preț membru"; list name as hint when several lists (C22)
export const extendModel: (preview: { count: number } | null, weeks: number) => { text: string; button: string; disabled: boolean };
```

- Page: title "Abonamente", subtitle "Școala de patinaj"; "Prelungește abonamentele" (secondary) and "+ Abonament" (primary); filters "Stare" (default "Active") and "Grupă"; columns of 5.9, Expiră in red text when past (`var(--theme-danger)` token), sorted as the server answers; row opens `athleteTabTo(id, 'abonament')`; row "..." only with `abonamentMenu`, item "Anulează abonamentul", no confirmation, toast "Abonament anulat." with "Anulează". "+ Abonament" opens the athlete search, then `AddSubscriptionWindow`. `ExtendModal`: title "Prelungește abonamentele Școlii de patinaj", "Număr de săptămâni" (`NumberInput` 1 to 12, default 1, C59), the text, "Renunță" / "Prelungește <n> abonamente" (disabled at 0); sends `{ weeks, key }` of the preview; a 409 shows its text in a `Notice` and reloads the preview; toast "<n> abonamente prelungite cu <x> săptămâni." with "Anulează".
- `AddSubscriptionWindow` props `{ athlete: { id: string; name: string }; onClose(): void }`: title "Adaugă abonament, <nume>"; "Abonament (lista <listă>)" Select; "Data de start" (default today; changing it reloads the form, so audience and expiry follow); "Expiră (estimat)" read-only; "Acoperă prezențe fără abonament (<n>)" with checkbox rows, hidden at 0; block "Plată" with "Înregistrează plata acum" (off) and, when on, "Sumă", "Metodă", "Încasat la patinoar", "Trimite e-mail ..." (off, `emailBox`); "Renunță" / "Adaugă abonament"; no items: the notice "Lista <listă> nu are abonamente pentru acest sportiv." and the submit disabled.

- [ ] **Step 1: Write the failing tests**

```ts
it('row cells and the red past date; menu hidden with a payment or when anulat (5.9, C75)', () => {
  const r = listRow({ athleteName: 'Ana Ionescu', groupName: 'Intermediari Bronze', slots: 8, used: 5, validUntil: '2026-11-07', state: 'activ', canCancel: true });
  expect(abonamenteCells(r, '2026-11-20')).toEqual({ athlete: 'Ana Ionescu', group: 'Intermediari Bronze', item: '8 ședințe', used: '5/8', expires: '7 nov 2026', expiredRed: true, state: 'activ' });
  expect(abonamentMenu({ ...r, canCancel: false })).toEqual([]);
  expect(abonamenteSections({ state: 'active', groupId: null }, [{ value: 'g-ib', label: 'Intermediari Bronze' }]).map((s) => [s.label, s.selected])).toEqual([['Stare', ['active']], ['Grupă', []]]);
});
it('the add window: first item, oldest rows ticked up to the slots, payment off (5.8, C23, C57)', () => {
  const form = formOf({ cover: ['t1', 't2', 't3'], items: [{ itemKey: 'Abonament 6 ședințe', slots: 6, price: 260 }] });
  const d = addDraft(form);
  expect(d).toMatchObject({ itemKey: 'Abonament 6 ședințe', cover: ['t1', 't2', 't3'], payNow: false, amount: '260', sendEmail: false });
  const two = formOf({ cover: ['t1', 't2', 't3'], items: [{ itemKey: 'Mini', slots: 2, price: 100 }] });
  const t = addDraft(two);
  expect(t.cover).toEqual(['t1', 't2']);
  expect(coverDisabled(t, two, 't3')).toBe(true);
  expect(toggleCover(t, two, 't3').cover).toEqual(['t1', 't2']);
  expect(coverDisabled(toggleCover(t, two, 't1'), two, 't3')).toBe(false);
});
it('the body and the toast (plan 5-3 Task 5, 5.8)', () => {
  const form = formOf({ cover: ['t1'], items: [{ itemKey: 'Abonament 8 ședințe', slots: 8, price: 320 }] });
  expect(addBody(addDraft(form))).toEqual({ itemKey: 'Abonament 8 ședințe', priceListId: 'pl-std', startsOn: '2026-11-20', cover: ['t1'] });
  expect(addBody({ ...addDraft(form), payNow: true, amount: '320', sendEmail: true })).toMatchObject({ payment: { amount: 320, method: 'numerar', collectedAtRink: false, sendEmail: true } });
  expect(addBody({ ...addDraft(form), payNow: true, amount: '0' })).toEqual({ error: 'Suma trebuie să fie mai mare decât 0.' });
  expect([addToast('Ana Ionescu', false), addToast('Ana Ionescu', true)]).toEqual(['Abonament adăugat: Ana Ionescu.', 'Abonament și plată înregistrate: Ana Ionescu.']);
});
it('the extend modal (5.9)', () => {
  expect(extendModel({ count: 14 }, 2)).toEqual({ text: 'Se prelungesc 14 abonamente active cu 2 săptămâni. Noua dată de expirare se calculează pentru fiecare.', button: 'Prelungește 14 abonamente', disabled: false });
  expect(extendModel({ count: 0 }, 1).disabled).toBe(true);
  expect(extendModel(null, 1).disabled).toBe(true);
});
```

Source tests: `AbonamenteList.tsx` uses `abonamenteCells`, `abonamentMenu`, `athleteTabTo`, `ExtendModal`, `AddSubscriptionWindow`, the danger token for `expiredRed`; `ExtendModal.tsx` sends `key` and uses `useSubmitOnce`; `AddSubscriptionWindow.tsx` uses `addDraft`, `toggleCover`, `coverDisabled`, `addBody`, `useSubmitOnce`, `emailBox`, and no `payNow: true` / `sendEmail: true` literal.

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/bani/__tests__/abonamente-view.test.ts src/club/__tests__/money-ui-source.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the view, the three components and the page body.
- [ ] **Step 4: Run** the Global Constraints checks; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/bani/abonamente-view.ts src/club/bani/__tests__/abonamente-view.test.ts src/admin/dashboard/bani/AbonamenteList.tsx src/admin/dashboard/bani/AddSubscriptionWindow.tsx src/admin/dashboard/bani/ExtendModal.tsx src/admin/dashboard/AbonamentePage.tsx src/club/__tests__/money-ui-source.test.ts
git commit -m "feat(bani): Abonamente page, Adaugă abonament window and extension modal"
```

---

### Task 5: "De încasat" page (low)

**Files:**
- Create: `src/club/bani/due-view.ts`, `src/admin/dashboard/bani/DeIncasatList.tsx`
- Modify: `src/admin/dashboard/DeIncasatPage.tsx` (plan 5-5's placeholder body)
- Test: `src/club/bani/__tests__/due-view.test.ts`, `money-ui-source.test.ts`

**Interfaces:**
- Consumes: `DuePage`, `SchoolDueRow`, `ClubDueRow` (5-3), `PAYMENT_COPY.sessionsText`, `PAYMENT_COPY.fromDate`, `noPriceListNotice`, `ron`, `monthTitle`; Tasks 1, 2.
- Produces: `schoolCells(r: SchoolDueRow): { athlete: string; group: string; item: string; from: string; price: string; paid: string; left: string }` ("din 27 oct" under the item); `clubCells(r: ClubDueRow): { athlete: string; group: string; sessions: string; due: string; paid: string; left: string }`; `dueParts(p: DuePage): { school: boolean; club: boolean; empty: boolean }` (a part with no rows hidden, both empty: "Nimic de încasat în luna asta.", C76); `payFor(row: SchoolDueRow | ClubDueRow, month: string): PaymentFor` (the abonament, else `club_luna` of the month).
- Page: title "De încasat", subtitle `monthTitle`, filter "Luna" (default current, the Plăți month options), the notice of 4.12 when `groupsWithoutList > 0`; part "Școala de patinaj" first, then "Club"; row opens `athleteTabTo(id, 'plati')`; row "..." "+ Plată" opens `PaymentWindow` with the athlete locked and `preselect = payFor(...)`.

- [ ] **Step 1: Write the failing tests**

```ts
it('Școala and Club cells (5.11, p5 scr 7)', () => {
  expect(schoolCells(schoolRow({ athleteName: 'Ana Ionescu', groupName: 'Intermediari Bronze', itemName: 'Abonament 8 ședințe', startsOn: '2026-10-27', price: 320, paid: 0, left: 320 })))
    .toEqual({ athlete: 'Ana Ionescu', group: 'Intermediari Bronze', item: 'Abonament 8 ședințe', from: 'din 27 oct', price: '320 RON', paid: '0 RON', left: '320 RON' });
  expect(clubCells(clubRow({ athleteName: 'David Stan', groupNames: 'Avansați', grup: 5, uscat: 2, lessons: 0, due: 260, paid: 100, left: 160 })))
    .toEqual({ athlete: 'David Stan', group: 'Avansați', sessions: '7 (5 grup, 2 uscat)', due: '260 RON', paid: '100 RON', left: '160 RON' });
  expect(clubCells(clubRow({ left: -20 })).left).toBe('-20 RON');
});
it('parts hidden when empty; both empty: the empty text (C76)', () => {
  expect(dueParts(duePage({ school: [], club: [clubRow({})] }))).toEqual({ school: false, club: true, empty: false });
  expect(dueParts(duePage({ school: [], club: [] }))).toEqual({ school: false, club: false, empty: true });
});
it('"+ Plată" preselects the abonament or the month (5.11, C33)', () => {
  expect(payFor(schoolRow({ subscriptionId: 'sub1' }), '2026-10')).toEqual({ kind: 'abonament', subscriptionId: 'sub1' });
  expect(payFor(clubRow({}), '2026-10')).toEqual({ kind: 'club_luna', month: '2026-10' });
});
```

Source tests: `DeIncasatList.tsx` uses `dueParts`, `schoolCells`, `clubCells`, `payFor`, `noPriceListNotice`, `PaymentWindow`, `athleteTabTo(..., 'plati')`, `MONEY_UI_COPY.due.empty`.

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/bani/__tests__/due-view.test.ts src/club/__tests__/money-ui-source.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the view, the list and the page body.
- [ ] **Step 4: Run** the Global Constraints checks; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/bani/due-view.ts src/club/bani/__tests__/due-view.test.ts src/admin/dashboard/bani/DeIncasatList.tsx src/admin/dashboard/DeIncasatPage.tsx src/club/__tests__/money-ui-source.test.ts
git commit -m "feat(bani): De încasat page with Școala and Club parts"
```

---

### Task 6: Athlete tabs "Grupe și abonament" and "Plăți" (low)

**Files:**
- Create: `src/club/bani/athlete-money-view.ts`, `src/admin/dashboard/sportivi/AbonamentTab.tsx`, `src/admin/dashboard/sportivi/PlatiTab.tsx`
- Modify: `src/club/sportivi/record-view.ts` (`RecordTab`, `recordTabs`, tab from `?tab=`), `src/admin/dashboard/sportivi/AthleteRecordPage.tsx` (two tab panels)
- Test: `src/club/bani/__tests__/athlete-money-view.test.ts`, `src/club/sportivi/__tests__/record-view.test.ts` (P3 test, tabs case updated), `money-ui-source.test.ts`

**Interfaces:**
- Consumes: `AthleteSubscriptions`, `AthletePayments`, `MonthRow` (5-3); plan 5-2's athlete month attendance response (`GET /club/athletes/:documentId/attendance?month=`, rows with date, group name, types and the uncovered flag; field names as plan 5-2's Interfaces block); Tasks 1 to 4 (`AbonamentBar`, `PaymentWindow`, `CancelPaymentDialog`, `AddSubscriptionWindow`, `platiCells`, `rowMenu`).
- Produces: `RecordTab = 'date' | 'abonament' | 'plati' | 'profil' | 'documente' | 'istoric'`; `recordTabs(r)` in the order "Date", "Grupe și abonament", "Plăți", "Profil public", "Documente", "Istoric" (C51), an anonymized record "Date", "Plăți", "Istoric" (C52); `tabFromSearch(search: string): RecordTab | null`; `groupLines(s: AthleteSubscriptions): string[]`; `earlierLines(s: AthleteSubscriptions): string[]`; `attendanceLine(row): { text: string; uncovered: string | null }` (the ", Fără abonament" part separate so it renders orange); `monthCells(m: MonthRow): { month: string; sessions: string; due: string; paid: string; left: string }`; `paymentsReadOnly(p: AthletePayments): boolean`.
- `AbonamentTab`: heading "Grupe" and its lines; one `AbonamentBar` per bar or "Fără abonament."; "+ Adaugă abonament" (secondary) opens `AddSubscriptionWindow`; "Abonamente anterioare" (hidden when none); "Prezențe" with the month switcher and rows opening the session panel of plan 5-5 (its open function from 5-5's Interfaces block).
- `PlatiTab`: "+ Plată" (primary, hidden when read-only); month table (row expands to its detail lines, `ExpandableRow`); payments table with the Task 3 cells and menu (no menu when read-only).

- [ ] **Step 1: Write the failing tests**

```ts
it('record tabs in order; anonymized keeps Date, Plăți, Istoric (5.7, C51, C52)', () => {
  expect(recordTabs(record({})).map((t) => t.label)).toEqual(['Date', 'Grupe și abonament', 'Plăți', 'Profil public', 'Documente', 'Istoric']);
  expect(recordTabs(record({ status: 'anonimizat' })).map((t) => t.id)).toEqual(['date', 'plati', 'istoric']);
  expect([tabFromSearch('?tab=plati'), tabFromSearch('?tab=x')]).toEqual(['plati', null]);
});
it('groups, earlier abonamente, attendance rows (5.7, p5 Q42)', () => {
  const s = { groups: [{ name: 'Intermediari Bronze', main: true }, { name: 'Uscat juniori', main: false }], bars: [],
    earlier: [{ itemName: 'Abonament 8 ședințe', startsOn: '2026-09-29', validUntil: '2026-10-26', used: 8, slots: 8, state: 'epuizat' as const }] };
  expect(groupLines(s)).toEqual(['Intermediari Bronze, principală', 'Uscat juniori']);
  expect(earlierLines(s)).toEqual(['Abonament 8 ședințe, 29 sep 2026 - 26 oct 2026, 8/8, epuizat']);
  expect(attendanceLine({ date: '2026-10-20', groupName: 'Intermediari Bronze', grup: true, uscat: false, uncovered: true }))
    .toEqual({ text: 'Mar 20 oct, Intermediari Bronze, Grup', uncovered: ', Fără abonament' });
});
it('month table cells (5.7)', () => {
  expect(monthCells({ month: '2026-10', grup: 6, uscat: 2, lessons: 1, due: 360, paid: 200, left: 160, lines: [] }))
    .toEqual({ month: 'Octombrie 2026', sessions: '9 (6 grup, 2 uscat, 1 individuală)', due: '360 RON', paid: '200 RON', left: '160 RON' });
});
```

Source tests: `AthleteRecordPage.tsx` renders `AbonamentTab` and `PlatiTab` for their tab ids and reads `tabFromSearch`; `AbonamentTab.tsx` uses `AbonamentBar`, `AddSubscriptionWindow`, `MONEY_UI_COPY.athlete.none`; the uncovered part uses the warning token (orange, `var(--theme-warning)`), never a hex; `PlatiTab.tsx` hides "+ Plată" and the row menu when `paymentsReadOnly`.

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/bani/__tests__/athlete-money-view.test.ts src/club/sportivi/__tests__/record-view.test.ts src/club/__tests__/money-ui-source.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the view, the two tabs and the record changes.
- [ ] **Step 4: Run** the Global Constraints checks; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/bani/athlete-money-view.ts src/club/bani/__tests__/athlete-money-view.test.ts src/admin/dashboard/sportivi/AbonamentTab.tsx src/admin/dashboard/sportivi/PlatiTab.tsx src/club/sportivi/record-view.ts src/club/sportivi/__tests__/record-view.test.ts src/admin/dashboard/sportivi/AthleteRecordPage.tsx src/club/__tests__/money-ui-source.test.ts
git commit -m "feat(sportivi): Grupe și abonament and Plăți tabs"
```

---

### Task 7: Panel row menu, move bar, Sportivi column and filter, delete refusal, Prețuri "Uscat", Setări check (low)

**Files:**
- Create: `src/club/bani/move-bar.ts`, `src/club/bani/delete-refusal.ts`, `src/admin/dashboard/sportivi/DeleteRefusalDialog.tsx`
- Modify: the `SessionPanel` row "..." menu of plan 5-5 (its file per 5-5's File Structure), `src/admin/dashboard/grupe/MoveDialog.tsx`, `src/club/sportivi/list-view.ts` (filter section and column), `src/admin/dashboard/sportivi/AthleteTable.tsx`, `AthleteCards.tsx`, `RecordMenu.tsx`
- Test: `src/club/bani/__tests__/move-delete.test.ts`, `src/club/sportivi/__tests__/list-view.test.ts` (P3 test grows), `money-ui-source.test.ts`

**Interfaces:**
- Consumes: `MovePreview` (5-3), `api.movePreview(membershipId, toGroupId)`; plan 5-4's refusal copy in `copy/lifecycle.ts` (title "Șterge <nume>", the two 5.14 sentences with the parts of C66, "Anonimizează"; names as 5-4's Interfaces block) and its 409 body `{ payments: number; subscriptions: number }`; `useSuperAdmin`, `AnonymizeDialog` (P3C); `KIND_OPTIONS` (`preturi/format.ts`, 5-1 added "Uscat"); plan 5-5's Setări field.
- Produces:
  - `moveBarView(p: MovePreview | null): { bar: AbonamentBar | null; goldLine: boolean }` (no preview or no bar: nothing; the line only with `carries`).
  - `refusalCounts(payments: AthletePayments | null, subs: AthleteSubscriptions | null): { payments: number; subscriptions: number }` (payments incl. cancelled; subscriptions = bars + earlier); `isBlocked(c): boolean`.
  - `list-view.ts`: filter key `abonament` (single select, options "Toate", "Activ", "Fără abonament", query `abonament=activ|fara`), column `abonament` after "Grupa" (`LIST_COPY.columns.abonament = 'Abonament'`), `abonamentCell(r: AthleteListRow): string` (blank when null).
  - Session panel row menu: "Adaugă abonament" (Școala sessions only, opens `AddSubscriptionWindow`) and "+ Plată" (opens `PaymentWindow`, athlete locked, `preselect` = the athlete's abonament for Școala, else `club_luna` of the session month) (5.3, C44).
  - `MoveDialog`: in move mode, after a target is chosen, `api.movePreview(member.membershipId, to)`; shows `AbonamentBar` with `goldLine` per `moveBarView`; nothing when no bar (5.12).
  - `RecordMenu`: "Șterge sportivul" reads the counts first (decided 4); blocked: `DeleteRefusalDialog` (buttons "Renunță", and "Anonimizează" only for a Super Admin, which opens the P3C anonymize window, C67); not blocked: the P3 confirmation; a 409 with counts from DELETE switches to the refusal.

- [ ] **Step 1: Write the failing tests**

```ts
const bar = { subscriptionId: 's', itemName: 'Abonament 8 ședințe', slots: 8, used: 5, validUntil: '2026-11-07' };
it('the move bar and the Gold line only when the carry happens (5.12)', () => {
  expect(moveBarView({ bar, carries: true })).toEqual({ bar, goldLine: true });
  expect(moveBarView({ bar, carries: false })).toEqual({ bar, goldLine: false });
  expect(moveBarView({ bar: null, carries: false })).toEqual({ bar: null, goldLine: false });
  expect(moveBarView(null)).toEqual({ bar: null, goldLine: false });
});
it('delete refusal counts: cancelled payments and every abonament count (5.14, C37)', () => {
  const c = refusalCounts(paymentsOf([{ cancelled: true }, { cancelled: false }]), { groups: [], bars: [bar], earlier: [] });
  expect(c).toEqual({ payments: 2, subscriptions: 1 });
  expect([isBlocked(c), isBlocked({ payments: 0, subscriptions: 0 })]).toEqual([true, false]);
});
```

In `list-view.test.ts`: `filterSections(...)` contains `{ key: 'abonament', label: 'Abonament', single: true }` with the three options; choosing "Activ" puts `abonament=activ` in the request query; `abonamentCell({ ...row, abonament: '5/8, 7 nov 2026' })` is `'5/8, 7 nov 2026'`, null gives `''`.

Source tests: `MoveDialog.tsx` calls `movePreview` and `moveBarView` and renders `AbonamentBar`; it shows no abonament text in add-also mode; the `SessionPanel` file has `MONEY_UI_COPY.menu.addSubscription` behind the Școala check and `MONEY_UI_COPY.menu.addPayment`; `RecordMenu.tsx` uses `refusalCounts`, `isBlocked`, `DeleteRefusalDialog`; `DeleteRefusalDialog.tsx` renders "Anonimizează" only under `isSuperAdmin`; `AthleteTable.tsx` renders `abonamentCell` after the group column; `src/admin/pages/preturi/format.ts` `KIND_OPTIONS` contains `{ value: 'uscat', label: 'Uscat' }` (5.15); the Setări page source contains "Prezență și plăți din" and "Ședințele dinainte nu apar ca nefăcute." (5.16, plan 5-5's field; this plan does not edit it).

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/bani/__tests__/move-delete.test.ts src/club/sportivi/__tests__/list-view.test.ts src/club/__tests__/money-ui-source.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the two views, the dialog and the five edits.
- [ ] **Step 4: Run** the Global Constraints checks; Expected: PASS (P3 and P4 tests unchanged apart from the tabs and filter cases named above).
- [ ] **Step 5: Commit**

```bash
git add src/club/bani/move-bar.ts src/club/bani/delete-refusal.ts src/club/bani/__tests__/move-delete.test.ts src/admin/dashboard/sportivi/DeleteRefusalDialog.tsx src/admin/dashboard/grupe/MoveDialog.tsx src/club/sportivi/list-view.ts src/club/sportivi/__tests__/list-view.test.ts src/admin/dashboard/sportivi/AthleteTable.tsx src/admin/dashboard/sportivi/AthleteCards.tsx src/admin/dashboard/sportivi/RecordMenu.tsx src/club/__tests__/money-ui-source.test.ts <the SessionPanel file of plan 5-5>
git commit -m "feat(bani): panel row menu, move bar, Sportivi Abonament column, delete refusal"
```

---

### Task 8: Boot check on a throwaway Postgres and renders (low)

**Files:** none in the repo. Temporary: `${TMPDIR:-/tmp}/es56`. PNGs to `/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/phase5-renders/` with the prefix `5-6-` (not committed by this task; the user reviews them).

Container `es56-pg` on 127.0.0.1:55456, Strapi on 1376. Never 1337, 1340, 3010, 5432, 55442.

- [ ] **Step 1: Start and seed**

As plan 5-3 Task 11 Step 1 with `es56`, port 55456 and Strapi 1376, then through the admin API (curl, one login): save a Școala session for three athletes (one with an abonament from "Adaugă abonament", two without), a Club session with Grup and Uscat ticks at member and non-member prices and one "inclus" item, a lesson; record four payments as in p5-4 (one cancelled, one with "Încasat la patinoar", one fee, one `club_luna`); give one athlete a 40-letter name and one item a long name; leave one Club group without a list.
Expected: every call answers 200; `npm run build` done before the start.

- [ ] **Step 2: Render every screen at 1440x900 and 390x844**

A Python Playwright script in `$TMP` (as plan 4-5 Task 7) logs in on `http://127.0.0.1:1376/admin` and saves, per width: `5-6-abonamente` (default filter, "Toate", the row menu open, an expired red date), `5-6-abonament-nou` (from "+ Abonament": search, then the window with coverage and "Înregistrează plata acum" on; and the "no items" notice), `5-6-prelungeste` (the modal with the count), `5-6-plati` (filters open, a cancelled struck row, the total, the row menu), `5-6-plata-noua` (empty, with errors after "Înregistrează", e-mail box disabled for an athlete without e-mail), `5-6-plata-editeaza`, `5-6-plata-anuleaza`, `5-6-de-incasat` (both parts, the notice; and an empty month), `5-6-tab-abonament`, `5-6-tab-plati` (a month row expanded), `5-6-panel-meniu` (Școala and Club session row menus), `5-6-muta` (Standard to Gold with the line; Standard to Club without it), `5-6-sportivi` (the column and the filter open), `5-6-sterge` (Super Admin and a plain admin), `5-6-preturi-uscat` (Tip select open), `5-6-setari` (the start date field). The script also double-clicks "Înregistrează" once in "Plată nouă".
Expected: every PNG written; after the double click `GET /api/club/payments?month=<this month>` has exactly one new row.

- [ ] **Step 3: Look at the renders**

Open the PNGs side by side with `p5-2-abonamente.html`, `p5-3-club-preturi.html`, `p5-4-plati.html`, `p5-7-confirm.html` (recommended options; p5-4 Q22 B: the e-mail box unticked). Check: the texts of spec 5.7 to 5.16 word for word, "RON" amounts with a decimal comma, list dates "Mar 27 oct"; no em dash, no middle dot, straight quotes; no pill or circle (bar segments square), no dashed or dotted line; phone screens without sideways scroll, windows as sheets; the Gold line only on the Standard to Gold move. Show them to the user in the companion with the "Copy gaps" lines. Fixes go into the owning task's files with a `fix(bani): ...` commit and the affected steps are repeated.

- [ ] **Step 4: Restart once and clean up**

Stop Strapi, start it again on 1376: Expected no error. Then stop it, `docker rm -f es56-pg`, `rm -rf ${TMPDIR:-/tmp}/es56`. Results on the progress board.

---

## Interfaces for other plans

None: this is the last phase 5 plan. It consumes 5-3 (`money-api.ts`, copy, rules, routes), 5-4 (refusal copy and 409 body), 5-5 (page files, menu constants, `SessionPanel`, the session panel opener, the Setări field) and 5-2 (athlete month attendance route).

## Self-review

- **Spec coverage.** 5 intro (cards, sheets, filters-v3, toasts, RON, dates: T1 to T8), 5.3 row menu (T7), 5.7 tabs, groups, bars, earlier, attendance, Plăți tab (T6), 5.8 window (T4), 5.9 list, filters, columns, red past date, row menu, extend modal and toast (T4), 5.10 list, filters, total, payment window, edit, cancel, errors, toasts (T2, T3), 5.11 De încasat (T5), 5.12 move bar and Gold line (T7), 5.13 column and filter (T7), 5.14 delete refusal (T7), 5.15 "Uscat" (T7 check; label by 5-1), 5.16 Setări (T7 check; field by 5-5), 11.3 UI source tests (T1 to T7), 11.4 renders (T8). Spec 5.1 menu and 5.2 to 5.6: plan 5-5.
- **Step scan.** Every step names a file, a signature, a test with values or a command with its expected output; no component body is written out.
- **Type consistency.** `PaymentDraft`, `optionKey`, `parseAmount` (T2) used by T4 (`addBody` reuses `parseAmount`); `platiCells`, `rowMenu` (T3) reused by T6; `AbonamentBar` component (T1) used by T6, T7; `athleteTabTo` (T1) by T4, T5; `RecordTab` ids `abonament`, `plati` (T6) match `athleteTabTo`.
- **Review Focus.** Double click (T1, T2, T4, T8), amount text (T2), Gold line (T7, T8), red date and hidden cancel (T4), cancelled rows (T3, T6), phone (T8): each has its test or render.
- **Proportion.** Eight tasks; code blocks are signatures, view tests and copy tables.
- **Cross-plan names to confirm at dispatch:** 5-5's page file names and `SessionPanel` path and opener, 5-4's refusal copy names, 5-2's attendance row fields. Each task says to use the owning plan's Interfaces block when a name differs.
