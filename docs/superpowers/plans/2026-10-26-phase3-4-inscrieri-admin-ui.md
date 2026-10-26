# Phase 3-4: Înscrieri Admin UI (3A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Înscrieri screens of phase 3A in the Strapi admin: the list (Nr., Vârstă, "Sportiv existent" line and filter, school tabs and column, bulk "Mută la altă școală"), the full table view changes, the panel with its fixed header, "..." menu, match card, tabs Date | Abonament | Documente | Istoric, "Editează", status menu and footer, and the confirm window with every state (Sigur, Probabil, none, search, comparison with ticks, grouped group picker, main group tick, A.C.S. status and wish lines, season rule, blocked states), the "Anulează" toast and undo, error and concurrency messages, and the full-height bottom sheet on phones.

**Architecture:** Every rule the screens follow (cells, tabs, rows, footer and menu choices, edit fields and the patch, the confirm window's state machine, request body and lines) lives in pure modules `src/club/inscrieri-*.ts` with Vitest tests; the admin bundle imports them at runtime, as it does `registration-panel.ts` today. The React files in `src/admin/dashboard/inscrieri/` are thin: they fetch the plan 3-2 routes with the admin fetch client, render the plan 3-1 shared components and call the rules. `SubmissionTable.tsx` (shared with Voluntari) gets a few generic extension points (extra query params, list meta, toolbar and bulk slots, per-row status menu, a sortable compact header); Voluntari keeps its behaviour. Wiring Vitest cannot reach is pinned by source-reading tests (the phase 2B pattern) and by a Playwright pass on a throwaway Postgres (Task 10), which also saves the renders for the user's review.

**Tech Stack:** Strapi 5.52.1 admin (React 18, react-router-dom v6, TypeScript `strict: true` in `src/admin`), the shared `src/admin/ui` library and tokens, Vitest 3 (Node), Python Playwright (Chromium), Postgres 16 in a throwaway container.

**Spec:** `docs/superpowers/specs/2026-10-26-athletes-registrations-design.md`, sections 3 (3.1 to 3.6), 4 (4.1 to 4.8), the Înscrieri parts of 8, and 12 (browser tests and renders). Decisions log: `../edusport_frontend/docs/portal/DECISIONS.md` (a later dated entry wins). Brief shared by all phase 3 plans: `.superpowers/phase3-plan-brief.md`. Visual reference: `../edusport_frontend/docs/portal/mockups/screens/prototype-registrations-v5.html` and `mockups/screens/phase3a-ref-v1/` (`index.md` lists every state). Where v5 and the spec differ, the spec wins: no group suggestion and no schedule text in the group picker (4.3), A.C.S. shown as two read-only lines instead of v5's select (4.4), toast "Înscriere confirmată: <nume>" with "Anulează" only instead of v5's "Deschide fișa sportivului" (4.6), "Dorește să fie membru" instead of "Membru A.C.S." (3.1, 3.3), no middle dot in any line.

**Consumes, unchanged (do not redefine):**
- Plan 3-1 (`docs/superpowers/plans/2026-10-26-phase3-1-shared-admin-ui.md`, "Interfaces for other plans" and the RESOLVED block): `Select` (`SelectProps`), `SearchableSelect` with `ComboOption.group`, `RadioGroup` (`variant="card"`, `value: null` for no preselection), `adminToast.*(text, { duration, action: { label, onClick } })` (the action runs once, no X on a toast with an action), `BottomSheet` (`desktop="modal"`, `modalSize="md"`, `fullHeight`, `footer`, `dismissable`), `useIsPhone`, `BirthDatePicker` with `partsFromDisplay` / `partsToDisplay` / `EMPTY_DATE` / `BIRTH_DATE_ERROR` from `src/club/ui-birth-date.ts` (RESOLVED 2: an impossible date is refused with "Alegeți data nașterii."), `Tabs`, `ConfirmDialog`, `Modal`, `Notice`, `Loading`, `MenuButton` (exported from `SubmissionTable.tsx`).
- Plan 3-2 (`docs/superpowers/plans/2026-10-26-phase3-2-athlete-data-services.md`, "Interfaces for other plans"): the routes `GET /api/forms/inscrieri` (rows with `age`, `existingAthlete`, `athleteId`, `athleteName`, `canUndo`, `schoolId`, `schoolName`; top level `schools`, `multipleSchools`, `allSchoolsTotal`; params `existing`, `school`, `sort=age-asc|age-desc`), `PUT /api/forms/inscrieri/:documentId` (`{ data, rebuild?, changed }`), `GET /api/club/registrations/:documentId/history | match | confirm-context?athlete=`, `POST .../confirm | undo-confirmation | move-school`, `POST /api/club/registrations/move-school`, `GET /api/club/athletes/search?q=&registration=`; the JSON types `AthleteCard`, `RegistrationMatchView`, `GroupSection`, `ConfirmContext`, `ConfirmResponse`, `UndoResponse`, `MoveSchoolResponse`, `HistoryLine` (`src/club/athletes/api-types.ts`), `ComparisonRow` (`src/club/confirm/compare.ts`), `canConfirm`, `RegistrationStatus` (`src/club/confirm/plan.ts`), `CONFIRM_ERRORS`, `ADMIN_ERRORS` (`src/club/athletes/errors.ts`), `REGISTRATION_FIELD_LABELS`, `ARROW` (`src/club/history-text.ts`), `acsWord` (`src/club/acs.ts`), `AthleteField` (`src/club/athlete-data.ts`), `parseBirthDate`, `roDate` (`src/club/birth-date.ts`), `SETTABLE_STATUSES` (`src/club/registration-update.ts`, tests only).

**Athlete record links:** plan 3-2 fixes no admin path for the record (it only gives `GET /api/club/athletes/by-profile/:profileId` for the old editor redirect). This plan uses the route path `/plugins/edusport-sportivi/:documentId` (`athleteRecordPath`, Task 1), opened in the same tab with react-router's `navigate` (spec gaps #33). The menu already registers `/plugins/edusport-sportivi/*` (`menu.tsx`: `path: \`${page.to.slice(1)}/*\``), so plan 3-5 renders the record under it.

**Not run while writing:** the code below was written against the `feat/athletes` worktree on 2026-10-26 (plan 3-1 Tasks 1 to 7 and 10 merged, plan 3-2 Tasks 1 and 2 merged) and against the plan 3-2 code for its later tasks; nothing was executed. Task 10 is the first run-time check.

**Matching levels:** the levels come from the server (plan 3-2, `src/club/matching.ts`). Since the user decision of 2026-10-26 a name with a typo is at most "Probabil"; "Sigur" needs the exact normalized name plus the birth date (`sameNameExact`). The UI only reads `preselect` and `existingAthlete`, so nothing here depends on the rule; Task 10's fixture uses exact names for its Sigur rows and a different name for its Probabil row.

## Needs decision

The spec leaves these open. Every item is implemented with option A in one named place, so the answer is a small change and nothing waits on it.

1. **Panel blocks the spec does not place** (status menu, "Sezon", "Arhivare", custom answers, "Notă internă"; today all sit in the flat panel body). Implemented in `inscrieri/PanelHeader.tsx` and `inscrieri/DateTab.tsx`.
   - A: the status menu sits in the fixed header under the "Nr. / Trimis" line; "Sezon", "Arhivare", custom answers and "Notă internă" stay, at the end of the Date tab after the form answers (read mode only).
   - B: the status menu at the top of the Date tab, as today; the other four as in A.
   - C: another placement chosen by the user.
2. **Status menu on a registration whose status is "Confirmat"** (confirmed through the window, or an old "Confirmat" row without an athlete). The menu never offers "Confirmat" (spec 3.3); the spec does not say whether the menu shows at all on such a row. Implemented in `src/club/inscrieri-panel.ts::statusMenuValues` (panel and full table cell).
   - A: no menu on a "Confirmat" row, the badge only; its status changes only through "Anulează confirmarea".
   - B: the menu shows "Nou", "Contactat", "Respins"; picking one changes the status and the link to the athlete stays.
3. **Registrations sent before the phase 2 form** (no Calitate, no wish): which answers go on Date and on Abonament, and their labels (spec 3.3: "old registrations show their own questions the same way"). Implemented in `src/club/inscrieri-panel.ts::LEGACY_*` and `src/club/inscrieri-edit.ts::LEGACY_FIELDS`.
   - A: Date: "Email", "Nume părinte", "Telefon", "Nume sportiv", "Data nașterii", "Mărime tricou", "Nivel", "Experiență anterioară", "Așteptări"; Abonament: "Interes club", "Cum a aflat", "Acord regulament", "Acord confidențialitate" (today's panel wording; "Nume copil" becomes "Nume sportiv", spec 3.1).
   - B: every old answer on Date; the Abonament tab stays empty.
   - C: other split or wording.
4. **"La primul modul" value on the Abonament tab.** Implemented by `subscriptionText` (`src/club/registration-panel.ts`, unchanged).
   - A: name and price, as today ("Abonament 8 ședințe grup, 590 RON").
   - B: name only, as prototype v5 shows it.
5. **How "Vârstă" is sorted** (spec 3.1: "sortable"). Implemented in `compactHeaders` (Task 1) and `CompactTh` (Task 4).
   - A: the "Vârstă" header is a button that toggles age ascending / descending (arrow shown); while it is active the "Sortare" select shows no value.
   - B: two more "Sortare" options (copy needed), header not clickable.
6. **"De unde ați aflat" in "Editează".** Spec 3.4 says all answers are edited; plan 3-2's `EDITABLE_FIELDS` has no `source` / `sourceOther`, so the server drops them.
   - A: not editable; it stays read-only on the Abonament tab.
   - B: plan 3-2 adds `source` and `sourceOther` to `EDITABLE_FIELDS`, and this plan adds a "De unde ați aflat" select (`SOURCE_OPTIONS`) plus the "Altele" text to the edit form (`SCRIPT_FIELDS` in Task 2, under "Abonament").
7. **Copy the spec does not give.** All in `src/club/inscrieri-copy.ts::INSCRIERI_PENDING_COPY`, except (f) in `src/club/ui-table.ts::SEASON_EMPTY_LABEL`. Option A is the text below; option B is the user's wording.
   - (a) toast after an undo: "Confirmare anulată." (the history line's words).
   - (b) toasts after "Mută la altă școală": one registration "Mutată la <școală>." (the history line's words); several "Mutate la <școală>: <n>."; confirmed ones left out "Nemutate (deja confirmate): <n>.".
   - (c) the match card, the confirm window or the Istoric tab could not load: "Nu am putut încărca datele.".
   - (d) the confirm window when the registration's season matches no season (spec 4.3 treats it as ended; `seasonEndedText` needs a label): "Sezonul nu a fost găsit. Se leagă doar fișa sportivului.".
   - (e) the confirm window's season heading when the registration has no school: "Sezonul <sezon>" (with a school, v5's "<școală>, sezonul <sezon>").
   - (f) the empty row of every season Select, replacing "— fără sezon —" (em dash): "Fără sezon".
   - (g) Documente tab of an old registration, which has no PDF: "Niciun document încă." (the athlete record's text, spec 6.4).


> **Needs decision 1 to 7: RESOLVED (decided by Claude, low impact, 2026-10-26; logged in DECISIONS.md).** Option A everywhere EXCEPT: **#4 B**: "La primul modul" shows the name only, as prototype v5; **#6 B**: "De unde ați aflat" (source, sourceOther) is editable in "Editează" (all answers are edited there, DEC r2b l4); plan 3-2 Task 14 adds source/sourceOther to EDITABLE_FIELDS.

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes` off `main`. This plan runs after plans 3-1 and 3-2 are merged on that branch (it imports their components, routes and modules). Run `npm ci` once on the branch first. The frontend repo is not changed, except the render PNGs of Task 10.
- Strapi 5.52.1, TypeScript, single quotes in `src/`. New functions < 30 lines, cyclomatic complexity < 10, no `any`. Existing functions already over the limit (`SubmissionTablePage`) are edited in place, not refactored.
- `src/admin` is excluded from Vitest: logic goes into `src/club/inscrieri-*.ts` and `src/club/ui-table.ts` (pure: no DOM, React, Node or Strapi imports; from plan 3-2 modules only pure ones and `import type`), tested with Vitest; component wiring is pinned by source-reading tests in `src/club/__tests__/admin-inscrieri-*.test.ts` and by Task 10.
- Checks after every task: the task's own test files (`npx vitest run <files>`), `npx tsc --noEmit -p src/admin/tsconfig.json` (zero errors), `npx tsc --noEmit` (zero errors), `node scripts/admin-ui-check.mjs --strict` (exit 0, "all 0"). The full `npm test` runs once, in Task 10 (user rule: no long test runs per batch).
- Server code: one addition only, the `open` list parameter (Task 5, decided by the coordinator for plan 3-5's links); every other route, shape, rule and refusal text comes from plan 3-2 as listed under "Consumes". Any other gap goes to "Needs decision", never into a server change here.
- CSS: all page CSS lives in `src/admin/dashboard/inscrieri/styles.ts` (passed as `cfg.extraCss`, a global `<style>`, so portaled sheets and dialogs get it too). Colours only `var(--theme-*)`; radius only `var(--ui-radius-*)` tokens; every class `ins-` prefixed under `.ui-root`; no backtick inside a CSS string; no dashed or dotted lines; no rounded pills or circles (the initials box is a square with `--ui-radius-md`).
- Design: prototype v5 and its screenshots; reuse `src/admin/ui` tokens and components; admin pages work at phone width (the list and panel stack below 1040px as today; the confirm window is a full-height bottom sheet below 640px).
- Copy: Romanian, exactly as the spec (quoted in `src/club/inscrieri-copy.ts`); ș and ț with the comma below; no em dash, no middle dot, no emoji; terse; empty values blank, never "-" or "—". The spec's "->" is the arrow "→" (`ARROW`).
- SaveBar tagger (`src/admin/app.tsx`): a `<button>` named "Salvează" / "Publică" outside `.pce` or `.ui-root` is shrunk to 1px. The panel's "Salvează" sits inside the page's `.ui-root`; Task 10 checks that nothing is tagged.
- Record links open `/plugins/edusport-sportivi/:documentId` in the same tab (`athleteRecordPath`).
- Tests use synthetic data only. Never run anything against production, the user's local database (container `strapi_db`) or the running `strapi_app` container; Task 10 uses a throwaway Postgres on a free port.
- Commits: Conventional Commits, no AI attribution, no `Co-Authored-By`. Never push.
- Decide nothing the spec leaves open: anything new goes to "Needs decision" above.

## Review Focus

- Two admins confirm the same registration (two tabs): the second click must say "Înscrierea a fost deja confirmată de alt administrator.", close the window and refresh the list and panel, never leave a window that keeps failing. Pinned by Task 3 (`confirmFailure` tests), Task 9 (source test: `failure.close` calls `onClose` and `onDone`) and Task 10 (two pages, one context).
- "Anulează" on the toast clicked after the admin moved to another registration (the panel and the window are gone): the undo still runs once and the list refreshes. Pinned by Task 9 (the toast action calls `runUndo(post, id)` then `onDone`, both outliving the panel) and Task 10 (confirm, click another row, then the toast).
- "Editează" on a registration whose stored birth date is unreadable: saving other answers without touching the date leaves it as it is; touching the picker and leaving it incomplete is refused with "Alegeți data nașterii."; a readable old text ("14 martie 2016") shows in the picker. Pinned by Task 2 tests.
- A "Probabil" match: nothing is preselected and "Confirmă înscrierea" stays disabled with the hint until a choice; after "Caută alt sportiv" and a pick, the ticks are that athlete's defaults, not the previous one's. Pinned by Task 3 tests and Task 10.
- Old registrations and missing values (no number, no birth date, no wish, legacy fields): every cell and row is blank, never "-", "—", "undefined" or "null", and nothing crashes. Pinned by Task 1 tests and Task 10 (legacy panel render).

---

## File Structure

```
src/club/
  inscrieri-copy.ts          every Înscrieri text of the spec; INSCRIERI_PENDING_COPY (Task 1)
  inscrieri-panel.ts         list cells and meta, panel tabs, rows, footer, menu, status menu, card helpers, links, urls (Task 1)
  inscrieri-edit.ts          "Editează" fields, draft, patch, save toast (Task 2)
  inscrieri-confirm.ts       confirm window state machine, gate, request body, lines, failures (Task 3)
  ui-table.ts                shared table rules: list meta, sortable header, empty season label (Task 4)
  registration-panel.ts      exports relationshipText / sourceText / subscriptionText (Task 1); old rows API removed (Task 6)
  __tests__/inscrieri-panel.test.ts, inscrieri-edit.test.ts, inscrieri-confirm.test.ts, ui-table.test.ts,
            admin-submission-table-extras.test.ts, admin-inscrieri-list.test.ts, admin-inscrieri-panel.test.ts,
            admin-inscrieri-match.test.ts, admin-inscrieri-edit.test.ts, admin-inscrieri-confirm.test.ts
src/admin/dashboard/
  SubmissionTable.tsx        extras (params, meta, toolbar, list slot, bulk slot), statusMenu, sortable header, no em dash (Task 4)
  InscrieriPage.tsx          list columns, filter, school tabs, bulk move (Task 5); panel (Task 6)
  inscrieri/
    useClient.ts             useStableClient, dataOf (Task 5)
    icons.tsx                IconUser, IconEdit (Task 5)
    styles.ts                INSCRIERI_CSS: list, panel, match card, edit, confirm window (Task 5)
    ListControls.tsx         ExistingFilter, SchoolTabs, BulkMoveSchool (Task 5)
    moves.ts                 moveSchool (Task 5)
    RegistrationPanel.tsx    panel shell and footer (Task 6); match card (Task 7); confirm window (Task 9)
    PanelHeader.tsx          name, badge, "..." menu, Nr., Trimis, status menu (Task 6)
    PanelMenu.tsx            "..." menu, undo dialog, move dialog (Task 6)
    PanelTabs.tsx            Abonament, Documente, Istoric, RowsView (Task 6)
    DateTab.tsx              Date tab read view (Task 6); "Editează" (Task 8)
    usePanelData.ts          match view + history (Task 6)
    undo.ts                  runUndo (Task 6)
    CompareTable.tsx, MatchCard.tsx (Task 7)
    EditForm.tsx (Task 8)
    ConfirmWindow.tsx, confirm/AthletePart.tsx, confirm/AthleteSearch.tsx, confirm/SeasonPart.tsx, confirm/useConfirm.ts (Task 9)
    EditableAnswer.tsx       deleted (Task 6)
scripts/admin-ui-check.mjs   dashboard/inscrieri/ held to the colour rule (Task 5)
```

## Tasks and parallel groups

| Group | Tasks | Runs after |
|---|---|---|
| A | 1 Înscrieri rules and copy, 4 Shared table extension points | plans 3-1 and 3-2 merged; in parallel (separate files) |
| B | 2 "Editează" rules, 3 Confirm window rules, 5 List | group A; in parallel (2 and 3 are new `src/club` files, 5 owns `InscrieriPage.tsx` and the new `inscrieri/` base files) |
| C | 6 Panel shell, tabs, footer, "..." menu | group B |
| D | 7 Match card, 8 "Editează" | group C; in parallel (7 adds files and one line in `RegistrationPanel.tsx`, 8 owns `DateTab.tsx` and `EditForm.tsx`) |
| E | 9 Confirm window, toast, undo | 3, 6, 7 |
| F | 10 Checks, browser pass and renders on a throwaway Postgres | everything |

---

### Task 1: Înscrieri rules and copy (list, panel, match card, links)

**Files:**
- Create: `src/club/inscrieri-copy.ts`, `src/club/inscrieri-panel.ts`
- Modify: `src/club/registration-panel.ts` (export `relationshipText`, `subscriptionText`, `sourceText`)
- Test: `src/club/__tests__/inscrieri-panel.test.ts`

**Interfaces:**
- Consumes: `canConfirm`, `RegistrationStatus` (`src/club/confirm/plan.ts`); `REGISTRATION_FIELD_LABELS` (`src/club/history-text.ts`); `AthleteCard`, `HistoryLine`, `MoveSchoolResponse`, `RegistrationMatchView` (type only, `src/club/athletes/api-types.ts`); `MEMBERSHIP_OPTIONS` (`src/club/registration-form-options.ts`); `isScriptFormRegistration`, `registrationDocumentKinds` (`src/club/registration-panel.ts`); `SETTABLE_STATUSES` (`src/club/registration-update.ts`, test only).
- Produces:
  - `inscrieri-copy.ts`: `LIST_COPY`, `PANEL_COPY`, `MATCH_COPY`, `EDIT_TOASTS`, `CONFIRM_COPY`, `INSCRIERI_PENDING_COPY` (shapes in the code below).
  - `inscrieri-panel.ts` types: `InscriereRow = Record<string, unknown>`, `TabRow = { key: string; label: string; value: string }`, `PanelTab = 'date' | 'abonament' | 'documente' | 'istoric'`, `PanelTabItem = { id: string; label: string; count?: number | null }`, `FooterActions = { contactat: boolean; confirm: boolean; openAthlete: boolean }`, `MenuItem = 'undo' | 'move' | 'delete'`, `SchoolInfo`, `ListMeta = { schools: SchoolInfo[]; multipleSchools: boolean; allSchoolsTotal: number }`, `CompactHeaderSpec = string | { label: string; sort: readonly [string, string] }`, `ToastSpec = { tone: 'success' | 'info' | 'warning' | 'error'; text: string }`, `SelectChoice = { value: string; label: string }`.
  - constants: `ALL_SCHOOLS = 'toate'`, `AGE_SORT = ['age-asc', 'age-desc']`, `PANEL_STATUSES = ['Nou', 'Contactat', 'Respins']`, `EMPTY_LIST_META`, `LEGACY_LABELS`, `LEGACY_DATE_KEYS`, `LEGACY_ABONAMENT_KEYS`, `CLUB_URLS`.
  - functions: `cellText(v): string`, `compactHeaders(multipleSchools): CompactHeaderSpec[]`, `ageText(age): string`, `wishText(v): string`, `wishLabel(v): string`, `showsExistingLine(row): boolean`, `readListMeta(meta): ListMeta`, `listParams(existing, school, meta): Record<string, string>`, `schoolTabs(meta): PanelTabItem[]`, `moveTargets(meta, currentSchoolId): SelectChoice[]`, `moveToasts(res, schoolName, single): ToastSpec[]`, `registrationStatus(row): RegistrationStatus`, `linkedAthleteId(row): string | null`, `footerActions(row): FooterActions`, `menuItems(row, multipleSchools): MenuItem[]`, `statusMenuValues(row): readonly string[]`, `documentCount(row): number`, `panelTabs(row, historyCount): PanelTabItem[]`, `isPanelTab(v): v is PanelTab`, `dateTabRows(row): TabRow[]`, `abonamentTabRows(row): TabRow[]`, `initials(name): string`, `lastGroupText(card): string`, `cardDetailLine(card): string`, `showMatchCard(view): boolean`, `historyHead(line, formatDate): string`, `athleteRecordPath(id): string`, `inscrieriOpenPath(registrationId): string`, `readOpenParam(search): string | null`, `openListParams(registrationId): Record<string, string>`, `panelVersion(row): string`.
  - `registration-panel.ts` now exports `relationshipText(r)`, `subscriptionText(choice)`, `sourceText(r)` (bodies unchanged).

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/inscrieri-panel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AthleteCard, RegistrationMatchView } from '../athletes/api-types';
import { CONFIRM_COPY, EDIT_TOASTS, INSCRIERI_PENDING_COPY, LIST_COPY, MATCH_COPY, PANEL_COPY } from '../inscrieri-copy';
import {
  ALL_SCHOOLS,
  CLUB_URLS,
  PANEL_STATUSES,
  abonamentTabRows,
  ageText,
  athleteRecordPath,
  cardDetailLine,
  cellText,
  compactHeaders,
  dateTabRows,
  footerActions,
  historyHead,
  initials,
  inscrieriOpenPath,
  lastGroupText,
  listParams,
  menuItems,
  moveTargets,
  moveToasts,
  openListParams,
  panelTabs,
  panelVersion,
  readListMeta,
  readOpenParam,
  schoolTabs,
  showMatchCard,
  statusMenuValues,
  wishText,
} from '../inscrieri-panel';
import { SETTABLE_STATUSES } from '../registration-update';

const script = {
  documentId: 'r1', registrationNumber: '2026-0142', status: 'Nou', archived: false, athleteId: null, canUndo: false,
  email: 'parinte@exemplu.ro', parentName: 'Mihaela Dumitrescu', relationship: 'parinte', phone: '0722 111 222',
  childName: 'Maria Dumitrescu', childBirthDate: '14.03.2014', childHeight: 142, shirtSize: 'S', lastSeason: 'Începători',
  priorExperience: 'Patinaj înainte', expectations: null, membershipAnswer: 'da',
  subscriptionChoice: { priceItemName: 'Abonament 8 ședințe grup', price: 590 }, source: 'Recomandare',
  gdprConsent: true, regulationsConsent: true, existingAthlete: true, age: 12, updatedAt: '2026-10-20T10:00:00.000Z',
};
const legacy = {
  documentId: 'r7', status: 'Nou', childName: 'Mihai Pop', childBirthDate: null, parentName: 'Ion Pop', email: '', phone: '0711',
  level: 'Incepatori', howHeard: 'Facebook', clubInterest: true, regulationsAgreement: true, privacyConsent: false, shirtSize: undefined,
};
const card = (over: Partial<AthleteCard> = {}): AthleteCard => ({
  documentId: 'a1', name: 'Maria Dumitrescu', birthDate: '14.03.2014', lastGroup: { name: 'Primii Pași', season: '2025-2026' },
  lastRegistrationSeason: '2025-2026', contactName: 'Mihaela Dumitrescu', status: 'activ', ...over,
});
const view = (over: Partial<RegistrationMatchView> = {}): RegistrationMatchView => ({
  confirmed: false, athleteId: null, canConfirm: true, canUndo: false, birthDateReadable: true, notAttendedLastSeason: false,
  existing: card(), preselect: 'existing', comparison: [], candidates: [], ...over,
});
const values = (rows: { label: string; value: string }[]) => rows.map((r) => [r.label, r.value]);

describe('Înscrieri list (spec 3.1, 3.6)', () => {
  it('has the prototype v5 columns, "Școala" after the name only with 2+ schools, "Vârstă" sortable', () => {
    expect(compactHeaders(false)).toEqual([
      'Nr.', 'Trimis la', 'Nume sportiv', { label: 'Vârstă', sort: ['age-asc', 'age-desc'] }, 'Status', 'Completat de', 'Dorește să fie membru',
    ]);
    expect(compactHeaders(true).slice(2, 4)).toEqual(['Nume sportiv', 'Școala']);
  });

  it('leaves the age and wish cells blank when unknown', () => {
    expect([ageText(12), ageText(0), ageText(null), ageText(undefined), ageText(-1), ageText('12')]).toEqual(['12 ani', '0 ani', '', '', '', '']);
    expect([wishText('da'), wishText('nu'), wishText(null), wishText('poate')]).toEqual(['Da', 'Nu', '', '']);
    expect([cellText('  x '), cellText(5), cellText(null), cellText(undefined), cellText({})]).toEqual(['x', '5', '', '', '']);
  });

  it('reads the school data of the list answer defensively', () => {
    expect(readListMeta({})).toEqual({ schools: [], multipleSchools: false, allSchoolsTotal: 0 });
    const meta = readListMeta({ schools: [{ documentId: 'afi', name: 'AFI', count: 52 }, { bad: 1 }, null], multipleSchools: true, allSchoolsTotal: 64 });
    expect(meta.schools).toEqual([{ documentId: 'afi', name: 'AFI', count: 52 }]);
    expect(schoolTabs(meta)).toEqual([{ id: ALL_SCHOOLS, label: 'Toate', count: 64 }, { id: 'afi', label: 'AFI', count: 52 }]);
  });

  it('sends existing=da|nu, and the school only with 2+ schools', () => {
    const two = readListMeta({ multipleSchools: true });
    expect(listParams('', ALL_SCHOOLS, two)).toEqual({});
    expect(listParams('da', 'afi', two)).toEqual({ existing: 'da', school: 'afi' });
    expect(listParams('nu', 'afi', readListMeta({}))).toEqual({ existing: 'nu' });
    expect(listParams('poate', ALL_SCHOOLS, two)).toEqual({});
  });

  it('offers the other schools as move targets and names the school in the toasts', () => {
    const meta = readListMeta({ schools: [{ documentId: 'afi', name: 'AFI', count: 1 }, { documentId: 'p2', name: 'Patinoar 2', count: 1 }], multipleSchools: true });
    expect(moveTargets(meta, 'afi')).toEqual([{ value: 'p2', label: 'Patinoar 2' }]);
    expect(moveToasts({ moved: 1, skipped: 0 }, 'Patinoar 2', true)).toEqual([{ tone: 'success', text: 'Mutată la Patinoar 2.' }]);
    expect(moveToasts({ moved: 2, skipped: 1 }, 'AFI', false)).toEqual([
      { tone: 'success', text: 'Mutate la AFI: 2.' },
      { tone: 'warning', text: 'Nemutate (deja confirmate): 1.' },
    ]);
  });
});

describe('panel (spec 3.3, 3.5)', () => {
  it('has the four tabs with the document and history counts', () => {
    expect(panelTabs(script, 3)).toEqual([
      { id: 'date', label: 'Date' },
      { id: 'abonament', label: 'Abonament' },
      { id: 'documente', label: 'Documente', count: 2 },
      { id: 'istoric', label: 'Istoric', count: 3 },
    ]);
    expect(panelTabs({ ...script, membershipAnswer: 'nu' }, null)[2].count).toBe(1);
    expect(panelTabs(legacy, null).map((t) => t.count)).toEqual([undefined, undefined, 0, null]);
  });

  it('Date tab: the form wording, in form order, blank empties', () => {
    expect(values(dateTabRows(script))).toEqual([
      ['Adresă de e-mail', 'parinte@exemplu.ro'],
      ['Persoana care completează', 'Mihaela Dumitrescu'],
      ['Calitatea față de sportiv', 'Părinte'],
      ['Telefon de contact', '0722 111 222'],
      ['Numele copilului', 'Maria Dumitrescu'],
      ['Data nașterii copilului', '14.03.2014'],
      ['Înălțimea copilului (cm)', '142'],
      ['Măsura bluză', 'S'],
      ['Sezonul trecut a participat la cursurile ACS EduSport?', 'Începători'],
      ['Nivel de experiență / Elemente cunoscute', 'Patinaj înainte'],
      ['Așteptări de la cursurile de patinaj', ''],
    ]);
    expect(dateTabRows({ ...script, relationship: 'alta', relationshipOther: 'Bunic' })[2].value).toBe('Bunic');
  });

  it('Abonament tab: the wish in the form words, read-only rows', () => {
    expect(values(abonamentTabRows(script))).toEqual([
      ['Dorește să fie membru', 'Da, doresc să devin membru'],
      ['La primul modul', 'Abonament 8 ședințe grup, 590 RON'],
      ['De unde ați aflat', 'Recomandare'],
      ['Acord GDPR', 'Da'],
      ['Acord Regulament', 'Da'],
    ]);
    expect(abonamentTabRows({ ...script, membershipAnswer: 'nu' })[0].value).toBe('Nu, optez pentru tarife neafiliați');
  });

  it('old registrations keep their own answers, never "-", "—", "undefined" or "null" (Needs decision 3, A)', () => {
    const all = [...dateTabRows(legacy), ...abonamentTabRows(legacy)];
    expect(values(all)).toEqual([
      ['Email', ''], ['Nume părinte', 'Ion Pop'], ['Telefon', '0711'], ['Nume sportiv', 'Mihai Pop'], ['Data nașterii', ''],
      ['Mărime tricou', ''], ['Nivel', 'Incepatori'], ['Experiență anterioară', ''], ['Așteptări', ''],
      ['Interes club', 'Da'], ['Cum a aflat', 'Facebook'], ['Acord regulament', 'Da'], ['Acord confidențialitate', 'Nu'],
    ]);
    expect(all.some((r) => /^(-|—|undefined|null)$/.test(r.value))).toBe(false);
  });

  it('footer: Contactat unless already, Confirmă unless Respins or archived, the record link once confirmed', () => {
    expect(footerActions(script)).toEqual({ contactat: true, confirm: true, openAthlete: false });
    expect(footerActions({ ...script, status: 'Contactat' })).toEqual({ contactat: false, confirm: true, openAthlete: false });
    expect(footerActions({ ...script, status: 'Respins' })).toEqual({ contactat: true, confirm: false, openAthlete: false });
    expect(footerActions({ ...script, archived: true })).toEqual({ contactat: true, confirm: false, openAthlete: false });
    expect(footerActions({ ...script, status: 'Confirmat' })).toEqual({ contactat: true, confirm: true, openAthlete: false });
    expect(footerActions({ ...script, status: 'Confirmat', athleteId: 'a1' })).toEqual({ contactat: false, confirm: false, openAthlete: true });
  });

  it('"..." menu: undo only when the window confirmed it, move only with 2+ schools and before confirmation', () => {
    expect(menuItems(script, false)).toEqual(['delete']);
    expect(menuItems(script, true)).toEqual(['move', 'delete']);
    expect(menuItems({ ...script, athleteId: 'a1', canUndo: true }, true)).toEqual(['undo', 'delete']);
    expect(menuItems({ ...script, athleteId: 'a1', canUndo: false }, true)).toEqual(['delete']);
  });

  it('status menu: never "Confirmat", none on a "Confirmat" row (Needs decision 2, A), same list as the server', () => {
    expect([...PANEL_STATUSES]).toEqual([...SETTABLE_STATUSES]);
    expect(statusMenuValues(script)).toEqual(['Nou', 'Contactat', 'Respins']);
    expect(statusMenuValues({ ...script, status: 'Confirmat' })).toEqual([]);
    expect(statusMenuValues({ ...script, status: 'ciudat' })).toEqual(['Nou', 'Contactat', 'Respins']);
  });

  it('reloads the panel data when the status, the link or the save time change', () => {
    expect(panelVersion(script)).not.toBe(panelVersion({ ...script, status: 'Contactat' }));
    expect(panelVersion(script)).not.toBe(panelVersion({ ...script, athleteId: 'a1' }));
    expect(panelVersion(script)).not.toBe(panelVersion({ ...script, updatedAt: '2026-10-21T10:00:00.000Z' }));
  });
});

describe('match card, search rows, history and links (spec 3.3, 4.1, 1.6)', () => {
  it('initials from the first and last word', () => {
    expect([initials('Maria Dumitrescu'), initials('Sara-Maria Ilie'), initials('ion'), initials('  ')]).toEqual(['MD', 'SI', 'I', '']);
  });

  it('the last group, else "Ultima înscriere: <sezon>", else blank', () => {
    expect(lastGroupText(card())).toBe('Primii Pași 2025-2026');
    expect(lastGroupText(card({ lastGroup: null }))).toBe('Ultima înscriere: 2025-2026');
    expect(lastGroupText(card({ lastGroup: null, lastRegistrationSeason: null }))).toBe('');
  });

  it('search rows: birth date, last group and parent, separated by commas, empties left out', () => {
    expect(cardDetailLine(card())).toBe('14.03.2014, Primii Pași 2025-2026, Mihaela Dumitrescu');
    expect(cardDetailLine(card({ birthDate: null, lastGroup: null }))).toBe('Mihaela Dumitrescu');
  });

  it('shows the card only while unconfirmed and with a proposed athlete', () => {
    expect(showMatchCard(view())).toBe(true);
    expect(showMatchCard(view({ confirmed: true }))).toBe(false);
    expect(showMatchCard(view({ existing: null }))).toBe(false);
    expect(showMatchCard(null)).toBe(false);
  });

  it('history head: date and time, then who, separated by a comma', () => {
    const fmt = () => '3 oct 2026, 14:22';
    expect(historyHead({ at: 'x', actor: 'Ana Pop', text: 't' }, fmt)).toBe('3 oct 2026, 14:22, Ana Pop');
    expect(historyHead({ at: 'x', actor: '', text: 't' }, fmt)).toBe('3 oct 2026, 14:22');
  });

  it('reads ?open=<documentId> from the page address (the record\'s "Înscrieri" links)', () => {
    expect(readOpenParam('?open=r1')).toBe('r1');
    expect(readOpenParam('?q=x&open=%20r%201%20&season=all')).toBe('r 1');
    expect(readOpenParam(inscrieriOpenPath('abc').split('?')[1])).toBe('abc');
    expect([readOpenParam(''), readOpenParam('?open='), readOpenParam('?open=%20%20'), readOpenParam('?q=r1')]).toEqual([null, null, null, null]);
    expect(openListParams('r1')).toEqual({ open: 'r1', season: 'all', archived: 'all' });
  });

  it('links and routes', () => {
    expect(athleteRecordPath('a 1')).toBe('/plugins/edusport-sportivi/a%201');
    expect(inscrieriOpenPath('r 1')).toBe('/plugins/edusport-inscrieri?open=r%201');
    expect(CLUB_URLS.confirmContext('r1', null)).toBe('/api/club/registrations/r1/confirm-context');
    expect(CLUB_URLS.confirmContext('r1', 'a1')).toBe('/api/club/registrations/r1/confirm-context?athlete=a1');
    expect(CLUB_URLS.athleteSearch('Dumit', 'r1')).toBe('/api/club/athletes/search?q=Dumit&registration=r1');
    expect(CLUB_URLS.athleteSearch('', null)).toBe('/api/club/athletes/search?q=');
    expect(CLUB_URLS.undo('r1')).toBe('/api/club/registrations/r1/undo-confirmation');
    expect(CLUB_URLS.moveSchoolBulk).toBe('/api/club/registrations/move-school');
  });
});

describe('copy (spec copy rules)', () => {
  const strings = (o: unknown): string[] => {
    if (typeof o === 'string') return [o];
    if (typeof o === 'function') return [String((o as (...a: unknown[]) => unknown)('X', 'Y'))];
    return o && typeof o === 'object' ? Object.values(o).flatMap(strings) : [];
  };
  const all = [LIST_COPY, PANEL_COPY, MATCH_COPY, EDIT_TOASTS, CONFIRM_COPY, INSCRIERI_PENDING_COPY].flatMap(strings);

  it('has no em dash, no middle dot and the comma-below letters', () => {
    expect(all.length).toBeGreaterThan(60);
    expect(all.filter((s) => /[—·şţŞŢ]/.test(s))).toEqual([]);
  });

  it('quotes the spec word for word where it gives the text', () => {
    expect(LIST_COPY.searchPlaceholder).toBe('Caută după nr. înscriere, nume, părinte, email sau telefon...');
    expect(CONFIRM_COPY.pickHint).toBe('Alege "Sportiv existent" sau "Sportiv nou"');
    expect(CONFIRM_COPY.intent('1 ședință grup')).toBe('1 ședință grup, doar intenția părintelui; abonamentul se adaugă când e cumpărat');
    expect(PANEL_COPY.undoDialog).toEqual({
      title: 'Anulezi confirmarea?',
      message: 'Se anulează legătura cu fișa, grupa adăugată și statusul A.C.S. scris la confirmare.',
      confirm: 'Anulează confirmarea',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/inscrieri-panel.test.ts`
Expected: FAIL with "Cannot find module '../inscrieri-copy'".

- [ ] **Step 3: Write the implementation**

In `src/club/registration-panel.ts` add `export` in front of the three helpers (bodies unchanged):

```ts
export function relationshipText(r: RegistrationRow): string {
```

```ts
export function subscriptionText(choice: unknown): string {
```

```ts
export function sourceText(r: RegistrationRow): string {
```

`src/club/inscrieri-copy.ts`:

```ts
/**
 * Înscrieri copy (spec 3 and 4), word for word. INSCRIERI_PENDING_COPY holds the texts the spec does not
 * give (plan 3-4 Needs decision 7, option A until the user answers). Pure; the admin bundle imports it.
 */
export const LIST_COPY = {
  searchPlaceholder: 'Caută după nr. înscriere, nume, părinte, email sau telefon...',
  headers: ['Nr.', 'Trimis la', 'Nume sportiv', 'Vârstă', 'Status', 'Completat de', 'Dorește să fie membru'],
  school: 'Școala',
  all: 'Toate',
  existing: 'Sportiv existent',
  yes: 'Da',
  no: 'Nu',
  moveSchool: 'Mută la altă școală',
  move: 'Mută',
} as const;

export const PANEL_COPY = {
  number: 'Nr.',
  submitted: 'Trimis',
  tabs: { date: 'Date', abonament: 'Abonament', documente: 'Documente', istoric: 'Istoric' },
  abonament: { firstModule: 'La primul modul', source: 'De unde ați aflat', gdpr: 'Acord GDPR', regulations: 'Acord Regulament' },
  edit: 'Editează',
  save: 'Salvează',
  cancel: 'Anulează',
  abonamentHeading: 'Abonament',
  contactat: 'Contactat',
  confirm: 'Confirmă înscrierea',
  openAthlete: 'Deschide fișa sportivului',
  more: '...',
  undo: 'Anulează confirmarea',
  moveSchool: 'Mută la altă școală',
  delete: 'Șterge înscrierea',
  undoDialog: {
    title: 'Anulezi confirmarea?',
    message: 'Se anulează legătura cu fișa, grupa adăugată și statusul A.C.S. scris la confirmare.',
    confirm: 'Anulează confirmarea',
  },
  schoolField: 'Școala',
  archiveField: 'Arhivare',
  archived: 'Arhivat',
  active: 'Activ',
  saveFailed: 'Nu am putut salva modificarea.',
} as const;

export const MATCH_COPY = {
  existing: 'Sportiv existent',
  compare: 'Compară',
  hide: 'Ascunde',
  openFull: 'Deschide fișa completă',
  inRecord: 'În fișă',
  inRegistration: 'În înscriere',
  notAttended: 'În formular: nu a participat sezonul trecut.',
  lastRegistration: (season: string) => `Ultima înscriere: ${season}`,
} as const;

export const EDIT_TOASTS = {
  rebuilt: 'Salvat. Documentul a fost refăcut.',
  unchanged: 'Nicio modificare.',
  rebuildFailed: 'Salvat. Documentul PDF nu a putut fi refăcut.',
  saved: 'Salvat',
} as const;

export const CONFIRM_COPY = {
  title: (nr: string) => `Confirmă înscrierea ${nr}`.trim(),
  athleteSection: 'Sportiv',
  cancel: 'Anulează',
  confirm: 'Confirmă înscrierea',
  existingLabel: 'Sportiv existent',
  existingHint: 'Înscrierea se adaugă la această fișă',
  newLabel: 'Sportiv nou',
  newHint: (name: string) => `Se creează o fișă nouă: ${name}`,
  pickHint: 'Alege "Sportiv existent" sau "Sportiv nou"',
  viewRecord: 'Vezi fișa',
  compare: 'Compară și actualizează',
  hide: 'Ascunde',
  update: 'Actualizează',
  searchOther: 'Caută alt sportiv',
  searchExisting: 'Caută un sportiv existent',
  searchPlaceholder: 'Nume, data nașterii, părinte sau telefon',
  noResults: (text: string) => `Niciun sportiv găsit pentru "${text}".`,
  seasonHeading: (school: string, season: string) => `${school}, sezonul ${season}`,
  group: 'Grupa',
  noGroup: 'Fără grupă deocamdată',
  mainNow: (group: string, section: string) => `Grupă principală acum: ${group} (${section})`,
  mainTick: 'Grupă principală',
  acs: (season: string) => `Membru A.C.S. ${season}`,
  wish: 'Dorește să fie membru (formular)',
  intentHeading: 'Abonament dorit (din formular)',
  intent: (name: string) => `${name}, doar intenția părintelui; abonamentul se adaugă când e cumpărat`,
  confirmed: (name: string) => `Înscriere confirmată: ${name}`,
  undo: 'Anulează',
} as const;

/** Copy the spec does not give: plan 3-4 Needs decision 7, option A. */
export const INSCRIERI_PENDING_COPY = {
  undone: 'Confirmare anulată.',
  moved: (school: string) => `Mutată la ${school}.`,
  movedMany: (school: string, n: number | string) => `Mutate la ${school}: ${n}.`,
  notMoved: (n: number | string) => `Nemutate (deja confirmate): ${n}.`,
  loadFailed: 'Nu am putut încărca datele.',
  noSeason: 'Sezonul nu a fost găsit. Se leagă doar fișa sportivului.',
  seasonOnly: (season: string) => `Sezonul ${season}`,
  noDocuments: 'Niciun document încă.',
} as const;
```

`src/club/inscrieri-panel.ts`:

```ts
import type { AthleteCard, HistoryLine, MoveSchoolResponse, RegistrationMatchView } from './athletes/api-types';
import { canConfirm, type RegistrationStatus } from './confirm/plan';
import { REGISTRATION_FIELD_LABELS } from './history-text';
import { INSCRIERI_PENDING_COPY, LIST_COPY, MATCH_COPY, PANEL_COPY } from './inscrieri-copy';
import { MEMBERSHIP_OPTIONS } from './registration-form-options';
import { isScriptFormRegistration, registrationDocumentKinds, relationshipText, sourceText, subscriptionText } from './registration-panel';

/**
 * The Înscrieri list and panel (spec 3.1 to 3.6) as data: cells, tabs, rows, footer, menu, links and route urls.
 * Pure (no DOM, React or Strapi), so the admin bundle and the tests share it. Rows are the list rows of
 * GET /api/forms/inscrieri (plan 3-2), read defensively.
 */
export type InscriereRow = Record<string, unknown>;
export type TabRow = { key: string; label: string; value: string };
export type PanelTab = 'date' | 'abonament' | 'documente' | 'istoric';
export type PanelTabItem = { id: string; label: string; count?: number | null };
export type FooterActions = { contactat: boolean; confirm: boolean; openAthlete: boolean };
export type MenuItem = 'undo' | 'move' | 'delete';
export type SchoolInfo = { documentId: string; name: string; count: number };
export type ListMeta = { schools: SchoolInfo[]; multipleSchools: boolean; allSchoolsTotal: number };
export type CompactHeaderSpec = string | { label: string; sort: readonly [string, string] };
export type ToastSpec = { tone: 'success' | 'info' | 'warning' | 'error'; text: string };
export type SelectChoice = { value: string; label: string };

export const ALL_SCHOOLS = 'toate';
export const AGE_SORT = ['age-asc', 'age-desc'] as const;
/** The status menu (spec 3.3): "Confirmat" only through "Confirmă înscrierea". Same list as plan 3-2's SETTABLE_STATUSES. */
export const PANEL_STATUSES = ['Nou', 'Contactat', 'Respins'] as const;
export const EMPTY_LIST_META: ListMeta = { schools: [], multipleSchools: false, allSchoolsTotal: 0 };
const STATUSES: readonly RegistrationStatus[] = ['Nou', 'Contactat', 'Confirmat', 'Respins'];

/** A value as cell text: strings (trimmed) and numbers; anything else blank (empty values are blank). */
export function cellText(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  return typeof v === 'number' ? String(v) : '';
}
const yesNo = (v: unknown): string => (v === true ? 'Da' : 'Nu');

// --- list (spec 3.1, 3.6)

export function compactHeaders(multipleSchools: boolean): CompactHeaderSpec[] {
  const [nr, sent, name, age, ...rest] = LIST_COPY.headers;
  const school = multipleSchools ? [LIST_COPY.school] : [];
  return [nr, sent, name, ...school, { label: age, sort: AGE_SORT }, ...rest];
}

export const ageText = (age: unknown): string => (typeof age === 'number' && age >= 0 ? `${age} ani` : '');

export function wishText(v: unknown): string {
  if (v === 'da') return LIST_COPY.yes;
  return v === 'nu' ? LIST_COPY.no : '';
}

/** The wish in the form's words ("Da, doresc să devin membru" / "Nu, optez pentru tarife neafiliați"). */
export const wishLabel = (v: unknown): string => MEMBERSHIP_OPTIONS.find((o) => o.value === v)?.label ?? '';

/** "Sportiv existent" under the name: the server already limits it to unconfirmed rows (spec 2.1). */
export const showsExistingLine = (row: InscriereRow): boolean => row.existingAthlete === true;

const isSchool = (v: unknown): v is { documentId: string; name: string; count?: unknown } => {
  const s = v as { documentId?: unknown; name?: unknown } | null;
  return !!s && typeof s.documentId === 'string' && typeof s.name === 'string';
};

export function readListMeta(meta: Record<string, unknown>): ListMeta {
  const raw = Array.isArray(meta.schools) ? meta.schools.filter(isSchool) : [];
  const schools = raw.map((s) => ({ documentId: s.documentId, name: s.name, count: typeof s.count === 'number' ? s.count : 0 }));
  const total = typeof meta.allSchoolsTotal === 'number' ? meta.allSchoolsTotal : 0;
  return { schools, multipleSchools: meta.multipleSchools === true, allSchoolsTotal: total };
}

export function listParams(existing: string, school: string, meta: ListMeta): Record<string, string> {
  const params: Record<string, string> = {};
  if (existing === 'da' || existing === 'nu') params.existing = existing;
  if (meta.multipleSchools && school !== ALL_SCHOOLS) params.school = school;
  return params;
}

export function schoolTabs(meta: ListMeta): PanelTabItem[] {
  const all = { id: ALL_SCHOOLS, label: LIST_COPY.all, count: meta.allSchoolsTotal };
  return [all, ...meta.schools.map((s) => ({ id: s.documentId, label: s.name, count: s.count }))];
}

export const moveTargets = (meta: ListMeta, currentSchoolId: unknown): SelectChoice[] =>
  meta.schools.filter((s) => s.documentId !== currentSchoolId).map((s) => ({ value: s.documentId, label: s.name }));

export function moveToasts(res: MoveSchoolResponse, schoolName: string, single: boolean): ToastSpec[] {
  const copy = INSCRIERI_PENDING_COPY;
  const out: ToastSpec[] = [];
  if (res.moved > 0) out.push({ tone: 'success', text: single ? copy.moved(schoolName) : copy.movedMany(schoolName, res.moved) });
  if (res.skipped > 0) out.push({ tone: 'warning', text: copy.notMoved(res.skipped) });
  return out;
}

// --- panel (spec 3.3, 3.5)

export const registrationStatus = (row: InscriereRow): RegistrationStatus => STATUSES.find((s) => s === row.status) ?? 'Nou';
export const linkedAthleteId = (row: InscriereRow): string | null => cellText(row.athleteId) || null;

export function footerActions(row: InscriereRow): FooterActions {
  if (linkedAthleteId(row)) return { contactat: false, confirm: false, openAthlete: true };
  const status = registrationStatus(row);
  const confirm = canConfirm({ athleteId: null, status, archived: row.archived === true });
  return { contactat: status !== 'Contactat', confirm, openAthlete: false };
}

export function menuItems(row: InscriereRow, multipleSchools: boolean): MenuItem[] {
  const items: MenuItem[] = [];
  if (row.canUndo === true) items.push('undo');
  if (multipleSchools && !linkedAthleteId(row)) items.push('move');
  return [...items, 'delete'];
}

/** Values of the status menu (panel and full table cell); none on a "Confirmat" row (Needs decision 2, option A). */
export const statusMenuValues = (row: InscriereRow): readonly string[] => (registrationStatus(row) === 'Confirmat' ? [] : PANEL_STATUSES);

export const documentCount = (row: InscriereRow): number => (isScriptFormRegistration(row) ? registrationDocumentKinds(row).length : 0);

export function panelTabs(row: InscriereRow, historyCount: number | null): PanelTabItem[] {
  const t = PANEL_COPY.tabs;
  return [
    { id: 'date', label: t.date },
    { id: 'abonament', label: t.abonament },
    { id: 'documente', label: t.documente, count: documentCount(row) },
    { id: 'istoric', label: t.istoric, count: historyCount },
  ];
}

export const isPanelTab = (v: string): v is PanelTab => v === 'date' || v === 'abonament' || v === 'documente' || v === 'istoric';

const SCRIPT_DATE_KEYS = [
  'email', 'parentName', 'relationship', 'phone', 'childName', 'childBirthDate', 'childHeight', 'shirtSize', 'lastSeason', 'priorExperience', 'expectations',
] as const;

/** Old registrations (before the phase 2 form): their own fields, today's panel wording (Needs decision 3, option A). */
export const LEGACY_LABELS: Readonly<Record<string, string>> = {
  email: 'Email',
  parentName: 'Nume părinte',
  phone: 'Telefon',
  childName: 'Nume sportiv',
  childBirthDate: 'Data nașterii',
  shirtSize: 'Mărime tricou',
  level: 'Nivel',
  priorExperience: 'Experiență anterioară',
  expectations: 'Așteptări',
  clubInterest: 'Interes club',
  howHeard: 'Cum a aflat',
  regulationsAgreement: 'Acord regulament',
  privacyConsent: 'Acord confidențialitate',
};
export const LEGACY_DATE_KEYS = ['email', 'parentName', 'phone', 'childName', 'childBirthDate', 'shirtSize', 'level', 'priorExperience', 'expectations'] as const;
export const LEGACY_ABONAMENT_KEYS = ['clubInterest', 'howHeard', 'regulationsAgreement', 'privacyConsent'] as const;
const LEGACY_BOOLEANS = new Set<string>(['clubInterest', 'regulationsAgreement', 'privacyConsent']);

const legacyRow = (row: InscriereRow, key: string): TabRow => ({
  key,
  label: LEGACY_LABELS[key],
  value: LEGACY_BOOLEANS.has(key) ? yesNo(row[key]) : cellText(row[key]),
});

const scriptRow = (row: InscriereRow, key: string): TabRow => ({
  key,
  label: REGISTRATION_FIELD_LABELS[key],
  value: key === 'relationship' ? relationshipText(row) : cellText(row[key]),
});

/** Date tab (spec 3.3): the form's questions in form order; old registrations their own. */
export function dateTabRows(row: InscriereRow): TabRow[] {
  if (!isScriptFormRegistration(row)) return LEGACY_DATE_KEYS.map((key) => legacyRow(row, key));
  return SCRIPT_DATE_KEYS.map((key) => scriptRow(row, key));
}

/** Abonament tab (spec 3.3), read-only. */
export function abonamentTabRows(row: InscriereRow): TabRow[] {
  if (!isScriptFormRegistration(row)) return LEGACY_ABONAMENT_KEYS.map((key) => legacyRow(row, key));
  const a = PANEL_COPY.abonament;
  return [
    { key: 'membershipAnswer', label: REGISTRATION_FIELD_LABELS.membershipAnswer, value: wishLabel(row.membershipAnswer) },
    { key: 'subscriptionChoice', label: a.firstModule, value: subscriptionText(row.subscriptionChoice) },
    { key: 'source', label: a.source, value: sourceText(row) },
    { key: 'gdprConsent', label: a.gdpr, value: yesNo(row.gdprConsent) },
    { key: 'regulationsConsent', label: a.regulations, value: yesNo(row.regulationsConsent) },
  ];
}

/** Changes whenever the panel's server data may have changed (status, link, undo flag, last save). */
export const panelVersion = (row: InscriereRow): string =>
  [cellText(row.status), cellText(row.athleteId), cellText(row.updatedAt), row.canUndo === true ? '1' : '0'].join('|');

// --- match card, search rows, history (spec 3.3, 4.1, 1.6)

export function initials(name: string): string {
  const words = name.trim().split(/[\s-]+/).filter(Boolean);
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked.map((w) => w.charAt(0)).join('').toUpperCase();
}

const groupText = (card: AthleteCard): string | null => (card.lastGroup ? `${card.lastGroup.name} ${card.lastGroup.season}` : null);

export function lastGroupText(card: AthleteCard): string {
  const group = groupText(card);
  if (group) return group;
  return card.lastRegistrationSeason ? MATCH_COPY.lastRegistration(card.lastRegistrationSeason) : '';
}

/** Second line of a search row (spec 4.1): birth date, last group and parent, separated by commas. */
export const cardDetailLine = (card: AthleteCard): string =>
  [card.birthDate, groupText(card), card.contactName].filter((p): p is string => !!p).join(', ');

export const showMatchCard = (view: RegistrationMatchView | null): boolean => !!view && !view.confirmed && view.existing !== null;

export const historyHead = (line: HistoryLine, formatDate: (iso: string) => string): string =>
  [formatDate(line.at), line.actor].filter(Boolean).join(', ');

// --- links and routes (plan 3-2 "Interfaces for other plans")

/** The athlete record page (plan 3-5), same tab. */
export const athleteRecordPath = (documentId: string): string => `/plugins/edusport-sportivi/${encodeURIComponent(documentId)}`;

/** Opens Înscrieri on one registration's panel (the athlete record's "Înscrieri" block, plan 3-5). */
export const inscrieriOpenPath = (registrationId: string): string => `/plugins/edusport-inscrieri?open=${encodeURIComponent(registrationId)}`;

/** The registration to open from the page address (`?open=<documentId>`); null when absent or blank. */
export function readOpenParam(search: string): string | null {
  const value = new URLSearchParams(search).get('open');
  return value && value.trim() ? value.trim() : null;
}

/** The list query while a registration is opened by address: that one row, whatever its season or archive state. */
export const openListParams = (registrationId: string): Record<string, string> => ({ open: registrationId, season: 'all', archived: 'all' });

const registrationUrl = (id: string): string => `/api/club/registrations/${encodeURIComponent(id)}`;

function athleteSearchUrl(q: string, registrationId: string | null): string {
  const params = new URLSearchParams({ q });
  if (registrationId) params.set('registration', registrationId);
  return `/api/club/athletes/search?${params.toString()}`;
}

export const CLUB_URLS = {
  edit: (id: string) => `/api/forms/inscrieri/${encodeURIComponent(id)}`,
  history: (id: string) => `${registrationUrl(id)}/history`,
  match: (id: string) => `${registrationUrl(id)}/match`,
  confirmContext: (id: string, athleteId: string | null) =>
    `${registrationUrl(id)}/confirm-context${athleteId ? `?athlete=${encodeURIComponent(athleteId)}` : ''}`,
  confirm: (id: string) => `${registrationUrl(id)}/confirm`,
  undo: (id: string) => `${registrationUrl(id)}/undo-confirmation`,
  moveSchool: (id: string) => `${registrationUrl(id)}/move-school`,
  moveSchoolBulk: '/api/club/registrations/move-school',
  athleteSearch: athleteSearchUrl,
} as const;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/club/__tests__/inscrieri-panel.test.ts src/club/__tests__/registration-panel.test.ts && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json`
Expected: PASS; zero type errors in both projects.

- [ ] **Step 5: Commit**

```bash
git add src/club/inscrieri-copy.ts src/club/inscrieri-panel.ts src/club/registration-panel.ts src/club/__tests__/inscrieri-panel.test.ts
git commit -m "feat(club): Înscrieri list and panel rules and copy"
```

---

### Task 2: "Editează" rules (fields, draft, patch, toast)

**Files:**
- Create: `src/club/inscrieri-edit.ts`
- Test: `src/club/__tests__/inscrieri-edit.test.ts`

**Interfaces:**
- Consumes: `parseBirthDate`, `roDate` (`src/club/birth-date.ts`); `BIRTH_DATE_ERROR`, `EMPTY_DATE`, `partsFromDisplay`, `partsToDisplay`, `DateParts` (`src/club/ui-birth-date.ts`, plan 3-1); `REGISTRATION_FIELD_LABELS` (`src/club/history-text.ts`); `EDIT_TOASTS`, `LEGACY_LABELS`, `LEGACY_DATE_KEYS`, `cellText`, `InscriereRow`, `ToastSpec` (Task 1); `LAST_SEASON_OPTIONS`, `MEMBERSHIP_OPTIONS`, `RELATIONSHIP_OTHER`, `RELATIONSHIP_OTHER_LABEL` (`src/club/registration-form-options.ts`); `RELATIONSHIP_EDIT_OPTIONS`, `isScriptFormRegistration` (`src/club/registration-panel.ts`).
- Produces:
  - `type EditKind = 'text' | 'textarea' | 'height' | 'select' | 'birthDate' | 'bool'`
  - `type EditField = { key: string; label: string; kind: EditKind; options?: readonly { value: string; label: string }[]; section?: 'abonament' }`
  - `type EditDraft = { text: Record<string, string>; bools: Record<string, boolean>; birth: DateParts; birthTouched: boolean }` (`DateParts` of `ui-birth-date.ts`)
  - `type EditPatch = { patch: Record<string, unknown>; error: string | null }`
  - `editFields(row): readonly EditField[]`, `visibleFields(fields, draft): EditField[]`, `storedBirth(raw): DateParts`, `initialDraft(row, fields): EditDraft`, `editPatch(row, fields, draft): EditPatch`, `editToast(body: unknown): ToastSpec`.

Spec 3.4: one form for all answers, the wish last under "Abonament"; Nr. înscriere, Trimis la and the consents are not editable; the birth date through the zi / lună / an picker, saved as ZZ.LL.AAAA; toasts "Salvat. Documentul a fost refăcut." / "Nicio modificare." / "Salvat. Documentul PDF nu a putut fi refăcut.". A save that changes no printed answer gets no rebuild (`rebuild: null`, plan 2D `rebuildAfterEdit`), so it shows today's "Salvat". "De unde ați aflat" stays out (Needs decision 6, option A).

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/inscrieri-edit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { editFields, editPatch, editToast, initialDraft, storedBirth, visibleFields, type EditDraft } from '../inscrieri-edit';
import { EMPTY_DATE } from '../ui-birth-date';

const script = {
  documentId: 'r1', email: 'parinte@exemplu.ro', parentName: 'Mihaela Dumitrescu', relationship: 'parinte', relationshipOther: null,
  phone: '0722 111 222', childName: 'Maria Dumitrescu', childBirthDate: '14 martie 2016', childHeight: 142, shirtSize: 'S',
  lastSeason: 'Începători', priorExperience: 'Patinaj', expectations: null, membershipAnswer: 'da',
};
const legacy = { documentId: 'r7', childName: 'Mihai Pop', childBirthDate: 'ieri', parentName: 'Ion Pop', email: '', phone: '0711', level: 'Incepatori', howHeard: 'Facebook', clubInterest: true };

const draftOf = (row: Record<string, unknown>) => initialDraft(row, editFields(row));
const patchOf = (row: Record<string, unknown>, change: (d: EditDraft) => EditDraft) => editPatch(row, editFields(row), change(draftOf(row)));

describe('"Editează" fields (spec 3.4)', () => {
  it('script form: every answer in form order, the wish last under "Abonament", no consents', () => {
    const fields = editFields(script);
    expect(fields.map((f) => [f.key, f.kind, f.section ?? ''])).toEqual([
      ['email', 'text', ''], ['parentName', 'text', ''], ['relationship', 'select', ''], ['relationshipOther', 'text', ''],
      ['phone', 'text', ''], ['childName', 'text', ''], ['childBirthDate', 'birthDate', ''], ['childHeight', 'height', ''],
      ['shirtSize', 'text', ''], ['lastSeason', 'select', ''], ['priorExperience', 'textarea', ''], ['expectations', 'textarea', ''],
      ['membershipAnswer', 'select', 'abonament'],
    ]);
    expect(fields.find((f) => f.key === 'membershipAnswer')?.options).toEqual([
      { value: 'da', label: 'Da, doresc să devin membru' },
      { value: 'nu', label: 'Nu, optez pentru tarife neafiliați' },
    ]);
    expect(fields.find((f) => f.key === 'relationshipOther')?.label).toBe('Specificați calitatea (ex: Bunic, Frate):');
  });

  it('the "Alta" text shows only for Alta', () => {
    const fields = editFields(script);
    const draft = draftOf(script);
    expect(visibleFields(fields, draft).some((f) => f.key === 'relationshipOther')).toBe(false);
    const alta = { ...draft, text: { ...draft.text, relationship: 'alta' } };
    expect(visibleFields(fields, alta).some((f) => f.key === 'relationshipOther')).toBe(true);
  });

  it('old registrations: their own answers (Needs decision 3, A)', () => {
    expect(editFields(legacy).map((f) => [f.label, f.kind, f.section ?? ''])).toEqual([
      ['Email', 'text', ''], ['Nume părinte', 'text', ''], ['Telefon', 'text', ''], ['Nume sportiv', 'text', ''],
      ['Data nașterii', 'birthDate', ''], ['Mărime tricou', 'text', ''], ['Nivel', 'text', ''],
      ['Experiență anterioară', 'textarea', ''], ['Așteptări', 'textarea', ''],
      ['Cum a aflat', 'text', 'abonament'], ['Interes club', 'bool', 'abonament'],
    ]);
  });
});

describe('draft and patch', () => {
  it('a readable stored date fills the picker; an unreadable one leaves it empty', () => {
    expect(storedBirth('14 martie 2016')).toEqual({ day: 14, month: 3, year: 2016 });
    expect(storedBirth('ieri')).toEqual(EMPTY_DATE);
    expect(storedBirth(null)).toEqual(EMPTY_DATE);
    expect(draftOf(script).text.childHeight).toBe('142');
  });

  it('nothing changed: an empty patch', () => {
    expect(editPatch(script, editFields(script), draftOf(script))).toEqual({ patch: {}, error: null });
  });

  it('sends only the changed answers, trimmed', () => {
    const result = patchOf(script, (d) => ({ ...d, text: { ...d.text, phone: ' 0722 111 223 ', childHeight: '' } }));
    expect(result).toEqual({ patch: { phone: '0722 111 223', childHeight: '' }, error: null });
  });

  it('an untouched unreadable birth date stays as it is while other answers save', () => {
    const result = patchOf(legacy, (d) => ({ ...d, text: { ...d.text, phone: '0712' } }));
    expect(result).toEqual({ patch: { phone: '0712' }, error: null });
  });

  it('a touched, incomplete date is refused with the picker error', () => {
    const result = patchOf(legacy, (d) => ({ ...d, birth: { day: 2, month: 9, year: null }, birthTouched: true }));
    expect(result).toEqual({ patch: {}, error: 'Alegeți data nașterii.' });
  });

  it('a picked date is saved as ZZ.LL.AAAA; the same date in an old form is rewritten', () => {
    expect(patchOf(legacy, (d) => ({ ...d, birth: { day: 2, month: 9, year: 2016 }, birthTouched: true })).patch).toEqual({ childBirthDate: '02.09.2016' });
    expect(patchOf(script, (d) => ({ ...d, birthTouched: true })).patch).toEqual({ childBirthDate: '14.03.2016' });
    const same = { ...script, childBirthDate: '14.03.2016' };
    expect(patchOf(same, (d) => ({ ...d, birthTouched: true })).patch).toEqual({});
  });

  it('a hidden "Alta" text is not sent; booleans are', () => {
    expect(patchOf(script, (d) => ({ ...d, text: { ...d.text, relationshipOther: 'Bunic' } })).patch).toEqual({});
    expect(patchOf(legacy, (d) => ({ ...d, bools: { ...d.bools, clubInterest: false } })).patch).toEqual({ clubInterest: false });
  });
});

describe('save toast (spec 3.4)', () => {
  it('follows the PUT answer', () => {
    expect(editToast({ changed: [] })).toEqual({ tone: 'info', text: 'Nicio modificare.' });
    expect(editToast({ changed: ['phone'], rebuild: { ok: true, documents: ['acord'] } })).toEqual({ tone: 'success', text: 'Salvat. Documentul a fost refăcut.' });
    expect(editToast({ changed: ['phone'], rebuild: { ok: false, documents: [] } })).toEqual({ tone: 'warning', text: 'Salvat. Documentul PDF nu a putut fi refăcut.' });
    expect(editToast({ changed: ['expectations'], rebuild: null })).toEqual({ tone: 'success', text: 'Salvat' });
    expect(editToast(null)).toEqual({ tone: 'success', text: 'Salvat' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/inscrieri-edit.test.ts`
Expected: FAIL with "Cannot find module '../inscrieri-edit'".

- [ ] **Step 3: Write the implementation**

`src/club/inscrieri-edit.ts`:

```ts
import { parseBirthDate, roDate } from './birth-date';
import { REGISTRATION_FIELD_LABELS } from './history-text';
import { EDIT_TOASTS } from './inscrieri-copy';
import { LEGACY_DATE_KEYS, LEGACY_LABELS, cellText, type InscriereRow, type ToastSpec } from './inscrieri-panel';
import { LAST_SEASON_OPTIONS, MEMBERSHIP_OPTIONS, RELATIONSHIP_OTHER, RELATIONSHIP_OTHER_LABEL } from './registration-form-options';
import { RELATIONSHIP_EDIT_OPTIONS, isScriptFormRegistration } from './registration-panel';
import { BIRTH_DATE_ERROR, EMPTY_DATE, partsFromDisplay, partsToDisplay, type DateParts } from './ui-birth-date';

/**
 * "Editează" in the Date tab (spec 3.4): every answer in one form, the wish last under "Abonament".
 * Nr. înscriere, Trimis la and the consents are never edited. Pure; the admin form renders these fields.
 */
export type EditKind = 'text' | 'textarea' | 'height' | 'select' | 'birthDate' | 'bool';
export type EditOption = { value: string; label: string };
export type EditField = { key: string; label: string; kind: EditKind; options?: readonly EditOption[]; section?: 'abonament' };
export type EditDraft = { text: Record<string, string>; bools: Record<string, boolean>; birth: DateParts; birthTouched: boolean };
export type EditPatch = { patch: Record<string, unknown>; error: string | null };

const L = REGISTRATION_FIELD_LABELS;
const field = (key: string, kind: EditKind, label: string = L[key], options?: readonly EditOption[]): EditField =>
  options ? { key, label, kind, options } : { key, label, kind };
const LAST_SEASON_CHOICES: readonly EditOption[] = LAST_SEASON_OPTIONS.map((v) => ({ value: v, label: v }));

const SCRIPT_FIELDS: readonly EditField[] = [
  field('email', 'text'),
  field('parentName', 'text'),
  field('relationship', 'select', L.relationship, RELATIONSHIP_EDIT_OPTIONS),
  field('relationshipOther', 'text', RELATIONSHIP_OTHER_LABEL),
  field('phone', 'text'),
  field('childName', 'text'),
  field('childBirthDate', 'birthDate'),
  field('childHeight', 'height'),
  field('shirtSize', 'text'),
  field('lastSeason', 'select', L.lastSeason, LAST_SEASON_CHOICES),
  field('priorExperience', 'textarea'),
  field('expectations', 'textarea'),
  { ...field('membershipAnswer', 'select', L.membershipAnswer, MEMBERSHIP_OPTIONS), section: 'abonament' },
];

const LEGACY_KIND: Readonly<Record<string, EditKind>> = { childBirthDate: 'birthDate', priorExperience: 'textarea', expectations: 'textarea' };

/** Old registrations (Needs decision 3, option A): their Date answers, then "Cum a aflat" and "Interes club" under "Abonament". */
const LEGACY_FIELDS: readonly EditField[] = [
  ...LEGACY_DATE_KEYS.map((key) => field(key, LEGACY_KIND[key] ?? 'text', LEGACY_LABELS[key])),
  { ...field('howHeard', 'text', LEGACY_LABELS.howHeard), section: 'abonament' },
  { ...field('clubInterest', 'bool', LEGACY_LABELS.clubInterest), section: 'abonament' },
];

export const editFields = (row: InscriereRow): readonly EditField[] => (isScriptFormRegistration(row) ? SCRIPT_FIELDS : LEGACY_FIELDS);

/** The "Alta" text shows only while Calitate is "Alta" (as the form). */
export const visibleFields = (fields: readonly EditField[], draft: EditDraft): EditField[] =>
  fields.filter((f) => f.key !== 'relationshipOther' || draft.text.relationship === RELATIONSHIP_OTHER);

/** The stored text date in the picker: any readable form (spec 1.3), else empty. */
export function storedBirth(raw: unknown): DateParts {
  const parts = parseBirthDate(raw);
  return (parts && partsFromDisplay(roDate(parts))) || EMPTY_DATE;
}

export function initialDraft(row: InscriereRow, fields: readonly EditField[]): EditDraft {
  const draft: EditDraft = { text: {}, bools: {}, birth: storedBirth(row.childBirthDate), birthTouched: false };
  for (const f of fields) {
    if (f.kind === 'bool') draft.bools[f.key] = row[f.key] === true;
    else if (f.kind !== 'birthDate') draft.text[f.key] = cellText(row[f.key]);
  }
  return draft;
}

/** Untouched: no change, even for an unreadable stored date. Touched: a full date or the picker's error. */
function birthChange(row: InscriereRow, draft: EditDraft): EditPatch {
  if (!draft.birthTouched) return { patch: {}, error: null };
  const shown = partsToDisplay(draft.birth);
  if (!shown) return { patch: {}, error: BIRTH_DATE_ERROR };
  return { patch: shown === cellText(row.childBirthDate) ? {} : { childBirthDate: shown }, error: null };
}

function valueChange(row: InscriereRow, f: EditField, draft: EditDraft): Record<string, unknown> {
  if (f.kind === 'bool') {
    const next = draft.bools[f.key] === true;
    return next === (row[f.key] === true) ? {} : { [f.key]: next };
  }
  const next = (draft.text[f.key] ?? '').trim();
  return next === cellText(row[f.key]) ? {} : { [f.key]: next };
}

/** The PUT body: only the answers that changed. */
export function editPatch(row: InscriereRow, fields: readonly EditField[], draft: EditDraft): EditPatch {
  const birth = birthChange(row, draft);
  if (birth.error) return birth;
  const patch: Record<string, unknown> = { ...birth.patch };
  for (const f of visibleFields(fields, draft)) {
    if (f.kind !== 'birthDate') Object.assign(patch, valueChange(row, f, draft));
  }
  return { patch, error: null };
}

/** The toast after "Salvează", from the PUT answer `{ data, rebuild, changed }` (plan 3-2 Task 14). */
export function editToast(body: unknown): ToastSpec {
  const b = (body && typeof body === 'object' ? body : {}) as { changed?: unknown; rebuild?: { ok?: unknown } | null };
  if (Array.isArray(b.changed) && b.changed.length === 0) return { tone: 'info', text: EDIT_TOASTS.unchanged };
  if (b.rebuild?.ok === false) return { tone: 'warning', text: EDIT_TOASTS.rebuildFailed };
  return { tone: 'success', text: b.rebuild?.ok === true ? EDIT_TOASTS.rebuilt : EDIT_TOASTS.saved };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/club/__tests__/inscrieri-edit.test.ts && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json`
Expected: PASS; zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/inscrieri-edit.ts src/club/__tests__/inscrieri-edit.test.ts
git commit -m "feat(club): Înscrieri edit form rules"
```

---

### Task 3: Confirm window rules (state, gate, request, lines, failures)

**Files:**
- Create: `src/club/inscrieri-confirm.ts`
- Test: `src/club/__tests__/inscrieri-confirm.test.ts`

**Interfaces:**
- Consumes: `acsWord` (`src/club/acs.ts`); `AthleteField` (`src/club/athlete-data.ts`); `AthleteCard`, `ConfirmContext`, `GroupSection`, `RegistrationMatchView` (type only, `src/club/athletes/api-types.ts`); `ADMIN_ERRORS`, `CONFIRM_ERRORS` (`src/club/athletes/errors.ts`); `ARROW` (`src/club/history-text.ts`); `CONFIRM_COPY`, `INSCRIERI_PENDING_COPY` (Task 1); `requestErrorText` (`src/club/registration-panel.ts`).
- Produces:
  - `type Choice = 'existing' | 'new'`
  - `type WindowState = { mode: 'choose' | 'search'; athlete: AthleteCard | null; choice: Choice | null; compareOpen: boolean; ticks: AthleteField[] | null; groupId: string | null; makeMain: boolean; query: string }` (`ticks: null` = the context's default ticks, spec 4.2)
  - `type WindowAction` (`choose`, `toggleCompare`, `tick`, `openSearch`, `query`, `closeSearch`, `pick`, `pickNew`, `group`, `main`; shapes below)
  - `initialWindow(view: RegistrationMatchView): WindowState`, `windowReducer(s, a): WindowState`, `contextAthleteId(s): string | null`
  - `type Gate = { disabled: boolean; hint: string | null; notice: string | null }`, `confirmGate(s, ctx: ConfirmContext | null, loading: boolean): Gate`
  - `type ConfirmBody = { choice: Choice; athleteId: string | null; groupId: string | null; makeMain: boolean; updateFields: AthleteField[] }`, `confirmBody(s, ctx): ConfirmBody | null`
  - `seasonNote(ctx): string | null`, `seasonHeading(ctx, schoolName: string | null): string | null`, `acsLines(ctx): { status: string; wish: string } | null`, `intentLine(ctx): string | null`, `mainNowLine(ctx): string | null`, `type GroupChoice = { value: string; label: string; group: string }`, `groupChoices(groups: GroupSection[]): GroupChoice[]`, `newAthleteHint(ctx, withBirthDate: boolean): string`
  - `errorStatus(err: unknown): number | null`, `type Failure = { text: string; close: boolean }`, `confirmFailure(err): Failure`
  - `CONFIRM_TOAST_MS = 8000`, `SEARCH_DEBOUNCE_MS = 250`

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/inscrieri-confirm.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AthleteCard, ConfirmContext, RegistrationMatchView } from '../athletes/api-types';
import {
  acsLines,
  confirmBody,
  confirmFailure,
  confirmGate,
  contextAthleteId,
  errorStatus,
  groupChoices,
  initialWindow,
  intentLine,
  mainNowLine,
  newAthleteHint,
  seasonHeading,
  seasonNote,
  windowReducer,
  type WindowAction,
  type WindowState,
} from '../inscrieri-confirm';

const card = (over: Partial<AthleteCard> = {}): AthleteCard => ({
  documentId: 'a1', name: 'Maria Dumitrescu', birthDate: '14.03.2014', lastGroup: { name: 'Primii Pași', season: '2025-2026' },
  lastRegistrationSeason: '2025-2026', contactName: 'Mihaela Dumitrescu', status: 'activ', ...over,
});
const view = (over: Partial<RegistrationMatchView> = {}): RegistrationMatchView => ({
  confirmed: false, athleteId: null, canConfirm: true, canUndo: false, birthDateReadable: true, notAttendedLastSeason: false,
  existing: card(), preselect: 'existing', comparison: [], candidates: [], ...over,
});
const ctx = (over: Partial<ConfirmContext> = {}): ConfirmContext => ({
  registrationNumber: '2026-0142',
  newAthlete: { name: 'Maria Dumitrescu', birthDate: '14.03.2014' },
  season: { label: '2026-2027', running: true, endedText: null },
  groups: [
    { sectionId: 'afi', sectionName: 'Școala de Patinaj - AFI Cotroceni', groups: [{ documentId: 'g-pp', name: 'Primii Pași' }, { documentId: 'g-in', name: 'Începători' }] },
    { sectionId: 'club', sectionName: 'Club', groups: [{ documentId: 'g-pro', name: 'Profesioniști' }] },
  ],
  mainGroupNow: null,
  acs: { seasonLabel: '2026-2027', current: null, next: 'in_asteptare', wish: 'da' },
  subscriptionIntent: 'Abonament 8 ședințe grup',
  comparison: [],
  defaultUpdateFields: ['phone'],
  blocked: null,
  ...over,
});
const run = (s: WindowState, ...actions: WindowAction[]) => actions.reduce(windowReducer, s);

describe('start (spec 4.1)', () => {
  it('Sigur: "Sportiv existent" preselected', () => {
    expect(initialWindow(view())).toMatchObject({ mode: 'choose', choice: 'existing', ticks: null, groupId: null, makeMain: false });
  });

  it('Probabil: nothing chosen, the button disabled with the hint (r3 c1)', () => {
    const s = initialWindow(view({ preselect: null }));
    expect(s.choice).toBeNull();
    expect(confirmGate(s, ctx(), false)).toEqual({ disabled: true, hint: 'Alege "Sportiv existent" sau "Sportiv nou"', notice: null });
  });

  it('no match: "Sportiv nou"', () => {
    const s = initialWindow(view({ existing: null, preselect: null }));
    expect([s.athlete, s.choice, contextAthleteId(s)]).toEqual([null, 'new', null]);
  });
});

describe('choices, search and ticks (spec 4.1, 4.2)', () => {
  it('the context follows the chosen athlete; "Sportiv nou" asks for none', () => {
    const s = initialWindow(view());
    expect(contextAthleteId(s)).toBe('a1');
    expect(contextAthleteId(run(s, { type: 'choose', choice: 'new' }))).toBeNull();
  });

  it('ticks start from the defaults, then follow the admin', () => {
    const s = run(initialWindow(view()), { type: 'tick', field: 'name', on: true, defaults: ['phone'] });
    expect(s.ticks).toEqual(['phone', 'name']);
    expect(run(s, { type: 'tick', field: 'phone', on: false, defaults: ['phone'] }).ticks).toEqual(['name']);
  });

  it('a pick from the search becomes the existing athlete with its own defaults', () => {
    const ticked = run(initialWindow(view({ preselect: null })), { type: 'tick', field: 'email', on: true, defaults: [] }, { type: 'toggleCompare' }, { type: 'openSearch' }, { type: 'query', text: 'Dumit' });
    expect([ticked.mode, ticked.query]).toEqual(['search', 'Dumit']);
    const picked = run(ticked, { type: 'pick', card: card({ documentId: 'a2', name: 'Andrei Dumitrescu' }) });
    expect(picked).toMatchObject({ mode: 'choose', choice: 'existing', ticks: null, compareOpen: false });
    expect(picked.athlete?.documentId).toBe('a2');
  });

  it('"Sportiv nou" from the search, and "Anulează" back to the cards', () => {
    const s = run(initialWindow(view()), { type: 'openSearch' }, { type: 'pickNew' });
    expect([s.mode, s.choice, s.athlete?.documentId]).toEqual(['choose', 'new', 'a1']);
    expect(run(initialWindow(view()), { type: 'openSearch' }, { type: 'closeSearch' }).mode).toBe('choose');
  });

  it('clearing the group clears the main group tick', () => {
    const s = run(initialWindow(view()), { type: 'group', groupId: 'g-pp' }, { type: 'main', on: true }, { type: 'group', groupId: null });
    expect([s.groupId, s.makeMain]).toEqual([null, false]);
  });
});

describe('request body (spec 4.3, 4.5)', () => {
  it('existing athlete: the default ticks when the table was never opened', () => {
    const s = run(initialWindow(view()), { type: 'group', groupId: 'g-pp' });
    expect(confirmBody(s, ctx())).toEqual({ choice: 'existing', athleteId: 'a1', groupId: 'g-pp', makeMain: false, updateFields: ['phone'] });
  });

  it('the main group tick counts only with a current main group and a picked group', () => {
    const s = run(initialWindow(view()), { type: 'group', groupId: 'g-pp' }, { type: 'main', on: true });
    expect(confirmBody(s, ctx())?.makeMain).toBe(false);
    expect(confirmBody(s, ctx({ mainGroupNow: { name: 'Profesioniști', sectionName: 'Club' } }))?.makeMain).toBe(true);
  });

  it('new athlete: no athlete id, no field updates', () => {
    const s = run(initialWindow(view()), { type: 'choose', choice: 'new' }, { type: 'tick', field: 'email', on: true, defaults: [] });
    expect(confirmBody(s, ctx())).toEqual({ choice: 'new', athleteId: null, groupId: null, makeMain: false, updateFields: [] });
  });

  it('season ended: the group is never sent (r3b c9)', () => {
    const s = run(initialWindow(view()), { type: 'group', groupId: 'g-pp' });
    expect(confirmBody(s, ctx({ season: { label: '2025-2026', running: false, endedText: 'x' } }))?.groupId).toBeNull();
  });

  it('nothing chosen: no body', () => {
    expect(confirmBody(initialWindow(view({ preselect: null })), ctx())).toBeNull();
  });
});

describe('gate and blocked states (spec 4.7)', () => {
  it('blocked windows show the spec texts', () => {
    const s = initialWindow(view());
    expect(confirmGate(s, ctx({ blocked: 'birth-date' }), false)).toEqual({ disabled: true, hint: null, notice: 'Data nașterii nu poate fi citită. Corectați-o în Date.' });
    expect(confirmGate(s, ctx({ blocked: 'confirmed' }), false).notice).toBe('Înscrierea a fost deja confirmată de alt administrator.');
    expect(confirmGate(s, ctx({ blocked: 'not-confirmable' }), false).notice).toBe('Datele s-au schimbat. Reîncarcă pagina.');
  });

  it('disabled while loading, without a context or while searching', () => {
    const s = initialWindow(view());
    expect(confirmGate(s, ctx(), false).disabled).toBe(false);
    expect(confirmGate(s, ctx(), true).disabled).toBe(true);
    expect(confirmGate(s, null, false).disabled).toBe(true);
    expect(confirmGate(run(s, { type: 'openSearch' }), ctx(), false).disabled).toBe(true);
  });
});

describe('season, groups, A.C.S. and intent lines (spec 4.3, 4.4)', () => {
  it('season note: none while running, the ended line, the no-season line', () => {
    expect(seasonNote(ctx())).toBeNull();
    const ended = 'Sezonul 2025-2026 s-a încheiat. Se leagă doar fișa sportivului.';
    expect(seasonNote(ctx({ season: { label: '2025-2026', running: false, endedText: ended } }))).toBe(ended);
    expect(seasonNote(ctx({ season: { label: null, running: false, endedText: null } }))).toBe('Sezonul nu a fost găsit. Se leagă doar fișa sportivului.');
  });

  it('season heading with the school, without it, and none without a season', () => {
    expect(seasonHeading(ctx(), 'Școala de Patinaj - AFI Cotroceni')).toBe('Școala de Patinaj - AFI Cotroceni, sezonul 2026-2027');
    expect(seasonHeading(ctx(), null)).toBe('Sezonul 2026-2027');
    expect(seasonHeading(ctx({ season: { label: null, running: false, endedText: null } }), 'X')).toBeNull();
  });

  it('groups: the school first, then Club, each option under its section', () => {
    expect(groupChoices(ctx().groups)).toEqual([
      { value: 'g-pp', label: 'Primii Pași', group: 'Școala de Patinaj - AFI Cotroceni' },
      { value: 'g-in', label: 'Începători', group: 'Școala de Patinaj - AFI Cotroceni' },
      { value: 'g-pro', label: 'Profesioniști', group: 'Club' },
    ]);
  });

  it('A.C.S.: the status change and the wish, apart; nothing when the season ended', () => {
    expect(acsLines(ctx())).toEqual({ status: 'Membru A.C.S. 2026-2027: Nu → În așteptare', wish: 'Dorește să fie membru (formular): Da' });
    expect(acsLines(ctx({ acs: { seasonLabel: '2026-2027', current: 'da', next: null, wish: 'nu' } }))).toEqual({
      status: 'Membru A.C.S. 2026-2027: Da', wish: 'Dorește să fie membru (formular): Nu',
    });
    expect(acsLines(ctx({ acs: { seasonLabel: '2026-2027', current: null, next: null, wish: null } }))?.wish).toBe('Dorește să fie membru (formular):');
    expect(acsLines(ctx({ season: { label: '2025-2026', running: false, endedText: 'x' } }))).toBeNull();
  });

  it('main group now, intent, new athlete hint', () => {
    expect(mainNowLine(ctx())).toBeNull();
    expect(mainNowLine(ctx({ mainGroupNow: { name: 'Profesioniști', sectionName: 'Club' } }))).toBe('Grupă principală acum: Profesioniști (Club)');
    expect(intentLine(ctx())).toBe('Abonament 8 ședințe grup, doar intenția părintelui; abonamentul se adaugă când e cumpărat');
    expect(intentLine(ctx({ subscriptionIntent: null }))).toBeNull();
    expect(newAthleteHint(ctx(), true)).toBe('Se creează o fișă nouă: Maria Dumitrescu, 14.03.2014');
    expect(newAthleteHint(ctx(), false)).toBe('Se creează o fișă nouă: Maria Dumitrescu');
  });
});

describe('failures (spec 4.7)', () => {
  const fetchError = (status: number, message?: string) => ({ status, response: { data: { error: { status, message } } } });

  it('reads the status from the admin fetch error', () => {
    expect([errorStatus(fetchError(409)), errorStatus({ response: { status: 500 } }), errorStatus(new Error('x')), errorStatus(null)]).toEqual([409, 500, null, null]);
  });

  it('another admin confirmed it: the server text, close and refresh', () => {
    expect(confirmFailure(fetchError(409, 'Înscrierea a fost deja confirmată de alt administrator.'))).toEqual({
      text: 'Înscrierea a fost deja confirmată de alt administrator.', close: true,
    });
    expect(confirmFailure(fetchError(409)).text).toBe('Înscrierea a fost deja confirmată de alt administrator.');
  });

  it('anything else: "nothing was saved", the window stays', () => {
    expect(confirmFailure(fetchError(500))).toEqual({ text: 'Confirmarea nu a reușit. Nimic nu a fost salvat.', close: false });
    expect(confirmFailure(new Error('network'))).toEqual({ text: 'Confirmarea nu a reușit. Nimic nu a fost salvat.', close: false });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/inscrieri-confirm.test.ts`
Expected: FAIL with "Cannot find module '../inscrieri-confirm'".

- [ ] **Step 3: Write the implementation**

`src/club/inscrieri-confirm.ts`:

```ts
import { acsWord } from './acs';
import type { AthleteField } from './athlete-data';
import type { AthleteCard, ConfirmContext, GroupSection, RegistrationMatchView } from './athletes/api-types';
import { ADMIN_ERRORS, CONFIRM_ERRORS } from './athletes/errors';
import { ARROW } from './history-text';
import { CONFIRM_COPY, INSCRIERI_PENDING_COPY } from './inscrieri-copy';
import { requestErrorText } from './registration-panel';

/**
 * The confirm window (spec 4): what is chosen, what the button sends, the lines it shows and how a failure ends.
 * Pure; ConfirmWindow.tsx renders it. The server re-checks everything (plan 3-2 Task 17).
 */
export type Choice = 'existing' | 'new';
export type WindowState = {
  mode: 'choose' | 'search';
  athlete: AthleteCard | null;
  choice: Choice | null;
  compareOpen: boolean;
  ticks: AthleteField[] | null;
  groupId: string | null;
  makeMain: boolean;
  query: string;
};
export type WindowAction =
  | { type: 'choose'; choice: Choice }
  | { type: 'toggleCompare' }
  | { type: 'tick'; field: AthleteField; on: boolean; defaults: AthleteField[] }
  | { type: 'openSearch' }
  | { type: 'query'; text: string }
  | { type: 'closeSearch' }
  | { type: 'pick'; card: AthleteCard }
  | { type: 'pickNew' }
  | { type: 'group'; groupId: string | null }
  | { type: 'main'; on: boolean };
export type Gate = { disabled: boolean; hint: string | null; notice: string | null };
export type ConfirmBody = { choice: Choice; athleteId: string | null; groupId: string | null; makeMain: boolean; updateFields: AthleteField[] };
export type GroupChoice = { value: string; label: string; group: string };
export type Failure = { text: string; close: boolean };

export const CONFIRM_TOAST_MS = 8000;
export const SEARCH_DEBOUNCE_MS = 250;

/** "Sportiv existent" preselected only for Sigur (r3 c1); no proposed athlete: "Sportiv nou". */
export function initialWindow(view: RegistrationMatchView): WindowState {
  const choice: Choice | null = view.existing ? view.preselect : 'new';
  return { mode: 'choose', athlete: view.existing, choice, compareOpen: false, ticks: null, groupId: null, makeMain: false, query: '' };
}

const withTick = (list: AthleteField[], field: AthleteField, on: boolean): AthleteField[] => {
  if (!on) return list.filter((f) => f !== field);
  return list.includes(field) ? list : [...list, field];
};

type Handlers = { [K in WindowAction['type']]: (s: WindowState, a: Extract<WindowAction, { type: K }>) => WindowState };

const HANDLERS: Handlers = {
  choose: (s, a) => ({ ...s, choice: a.choice }),
  toggleCompare: (s) => ({ ...s, compareOpen: !s.compareOpen }),
  tick: (s, a) => ({ ...s, ticks: withTick(s.ticks ?? a.defaults, a.field, a.on) }),
  openSearch: (s) => ({ ...s, mode: 'search', query: '' }),
  query: (s, a) => ({ ...s, query: a.text }),
  closeSearch: (s) => ({ ...s, mode: 'choose' }),
  pick: (s, a) => ({ ...s, mode: 'choose', athlete: a.card, choice: 'existing', ticks: null, compareOpen: false, makeMain: false }),
  pickNew: (s) => ({ ...s, mode: 'choose', choice: 'new', makeMain: false }),
  group: (s, a) => ({ ...s, groupId: a.groupId, makeMain: a.groupId ? s.makeMain : false }),
  main: (s, a) => ({ ...s, makeMain: a.on }),
};

export function windowReducer(s: WindowState, a: WindowAction): WindowState {
  const handle = HANDLERS[a.type] as (state: WindowState, action: WindowAction) => WindowState;
  return handle(s, a);
}

/** The athlete the confirm context is asked for: none for "Sportiv nou". */
export const contextAthleteId = (s: WindowState): string | null => (s.choice === 'new' ? null : s.athlete?.documentId ?? null);

const BLOCKED_TEXT: Record<NonNullable<ConfirmContext['blocked']>, string> = {
  'birth-date': CONFIRM_ERRORS.birthDate,
  confirmed: CONFIRM_ERRORS.taken,
  'not-confirmable': ADMIN_ERRORS.stale,
};

export function confirmGate(s: WindowState, ctx: ConfirmContext | null, loading: boolean): Gate {
  if (ctx?.blocked) return { disabled: true, hint: null, notice: BLOCKED_TEXT[ctx.blocked] };
  if (s.choice === null) return { disabled: true, hint: CONFIRM_COPY.pickHint, notice: null };
  return { disabled: loading || !ctx || s.mode === 'search', hint: null, notice: null };
}

/** POST .../confirm body (plan 3-2 ConfirmRequest). An ended season sends no group (r3b c9). */
export function confirmBody(s: WindowState, ctx: ConfirmContext): ConfirmBody | null {
  if (!s.choice) return null;
  const existing = s.choice === 'existing';
  const groupId = ctx.season.running ? s.groupId : null;
  const makeMain = groupId !== null && ctx.mainGroupNow !== null && s.makeMain;
  const updateFields = existing ? s.ticks ?? ctx.defaultUpdateFields : [];
  return { choice: s.choice, athleteId: existing ? s.athlete?.documentId ?? null : null, groupId, makeMain, updateFields };
}

/** The line instead of the group and A.C.S. block when nothing but the link is written (spec 4.3). */
export function seasonNote(ctx: ConfirmContext): string | null {
  if (ctx.season.running) return null;
  return ctx.season.endedText ?? INSCRIERI_PENDING_COPY.noSeason;
}

export function seasonHeading(ctx: ConfirmContext, schoolName: string | null): string | null {
  const label = ctx.season.label;
  if (!label) return null;
  return schoolName ? CONFIRM_COPY.seasonHeading(schoolName, label) : INSCRIERI_PENDING_COPY.seasonOnly(label);
}

const wishWord = (wish: ConfirmContext['acs']['wish']): string => {
  if (wish === 'da') return 'Da';
  return wish === 'nu' ? 'Nu' : '';
};

/** "Membru A.C.S. <sezon>: Nu → În așteptare" and "Dorește să fie membru (formular): Da" (spec 4.4). */
export function acsLines(ctx: ConfirmContext): { status: string; wish: string } | null {
  const label = ctx.acs.seasonLabel;
  if (!ctx.season.running || !label) return null;
  const now = acsWord(ctx.acs.current);
  const state = ctx.acs.next ? `${now} ${ARROW} ${acsWord(ctx.acs.next)}` : now;
  return { status: `${CONFIRM_COPY.acs(label)}: ${state}`, wish: `${CONFIRM_COPY.wish}: ${wishWord(ctx.acs.wish)}`.trimEnd() };
}

export const intentLine = (ctx: ConfirmContext): string | null => (ctx.subscriptionIntent ? CONFIRM_COPY.intent(ctx.subscriptionIntent) : null);

export const mainNowLine = (ctx: ConfirmContext): string | null =>
  ctx.mainGroupNow ? CONFIRM_COPY.mainNow(ctx.mainGroupNow.name, ctx.mainGroupNow.sectionName) : null;

/** SearchableSelect options with section headers (plan 3-1 `ComboOption.group`), in the server's order. */
export const groupChoices = (groups: GroupSection[]): GroupChoice[] =>
  groups.flatMap((s) => s.groups.map((g) => ({ value: g.documentId, label: g.name, group: s.sectionName })));

export function newAthleteHint(ctx: ConfirmContext, withBirthDate: boolean): string {
  const { name, birthDate } = ctx.newAthlete;
  return CONFIRM_COPY.newHint(withBirthDate && birthDate ? `${name}, ${birthDate}` : name);
}

type ErrorShape = { status?: unknown; response?: { status?: unknown; data?: { error?: { status?: unknown } } } };

/** The HTTP status of an admin fetch error (Strapi's FetchError carries `status` from the error body). */
export function errorStatus(err: unknown): number | null {
  const e = (err && typeof err === 'object' ? err : {}) as ErrorShape;
  const status = e.status ?? e.response?.status ?? e.response?.data?.error?.status;
  return typeof status === 'number' ? status : null;
}

/** 409: another admin confirmed it; close and refresh (r4 e8). Anything else: nothing saved, stay (r4 e9). */
export function confirmFailure(err: unknown): Failure {
  if (errorStatus(err) === 409) return { text: requestErrorText(err, CONFIRM_ERRORS.taken), close: true };
  return { text: requestErrorText(err, CONFIRM_ERRORS.failed), close: false };
}
```

Note on `confirmFailure(fetchError(500))`: the fixture's 500 body carries no `message`, so `requestErrorText` falls back to `CONFIRM_ERRORS.failed`; a real 500 from plan 3-2 carries the same text as its message.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/club/__tests__/inscrieri-confirm.test.ts && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json`
Expected: PASS; zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/inscrieri-confirm.ts src/club/__tests__/inscrieri-confirm.test.ts
git commit -m "feat(club): confirm window rules"
```

---

### Task 4: Shared table extension points (SubmissionTable)

**Files:**
- Create: `src/club/ui-table.ts`
- Modify: `src/admin/dashboard/SubmissionTable.tsx`
- Test: `src/club/__tests__/ui-table.test.ts`, `src/club/__tests__/admin-submission-table-extras.test.ts`

**Interfaces:**
- Consumes: today's `SubmissionTablePage`, `TableApi`, `SubmissionTableCfg`, `MenuButton`, `statusTag`, `clearSelection`, `refetch`.
- Produces:
  - `src/club/ui-table.ts`: `type CompactHeader = string | { label: string; sort: readonly [string, string] }`, `type HeaderSortDir = 'ascending' | 'descending' | 'none'`, `listMeta(body): Record<string, unknown>` (the list answer without `data`, `pagination`, `seasons`, `activeSeason`, `formMeta`), `headerLabel(h): string`, `nextHeaderSort(sort, pair): string`, `headerSortDir(sort, pair): HeaderSortDir`, `SEASON_EMPTY_LABEL = 'Fără sezon'` (Needs decision 7f).
  - `SubmissionTableCfg.statusMenu?: (row: Row) => readonly string[]` (values offered in the panel and cell Select; `[]` = the badge only, `statusBox` renders nothing); `SubmissionTableCfg.sortOptions?: { value: string; label: string }[]`; `compact.headers: CompactHeader[] | ((api: TableApi) => CompactHeader[])`.
  - `export interface SubmissionTableExtras { params?: Record<string, string>; onMeta?: (meta: Record<string, unknown>) => void; toolbar?: React.ReactNode; aboveList?: React.ReactNode; bulkActions?: (ids: string[], done: () => void) => React.ReactNode }`; `SubmissionTablePage({ cfg, extras }: { cfg: SubmissionTableCfg; extras?: SubmissionTableExtras })` (extra params go into the list and export queries and reset the page to 1; `done` clears the selection and refetches).
  - `TableApi.pageMeta: Record<string, unknown>`, `TableApi.refetch: () => void`.
  - No em dash left in a quoted string of `SubmissionTable.tsx` (plan 3-1 "Notes for other plans"): `extraValueText` empty is `''`, the season Select's empty row is `SEASON_EMPTY_LABEL`, the stat and "Din sezonul" show `''` while unknown.
  - Voluntari passes no `extras`, no `statusMenu` and string headers: unchanged.

- [ ] **Step 1: Write the failing tests**

`src/club/__tests__/ui-table.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SEASON_EMPTY_LABEL, headerLabel, headerSortDir, listMeta, nextHeaderSort } from '../ui-table';

describe('list answer meta', () => {
  it('keeps only the keys the table does not read itself', () => {
    const body = { data: [], pagination: {}, seasons: [], activeSeason: null, formMeta: {}, schools: [1], multipleSchools: true, allSchoolsTotal: 3 };
    expect(listMeta(body)).toEqual({ schools: [1], multipleSchools: true, allSchoolsTotal: 3 });
    expect(listMeta({})).toEqual({});
  });
});

describe('sortable compact header', () => {
  const pair = ['age-asc', 'age-desc'] as const;

  it('the first click sorts by the first value, then it toggles', () => {
    expect(nextHeaderSort('newest', pair)).toBe('age-asc');
    expect(nextHeaderSort('age-asc', pair)).toBe('age-desc');
    expect(nextHeaderSort('age-desc', pair)).toBe('age-asc');
  });

  it('aria-sort follows the current sort', () => {
    expect([headerSortDir('age-asc', pair), headerSortDir('age-desc', pair), headerSortDir('name', pair)]).toEqual(['ascending', 'descending', 'none']);
    expect([headerLabel('Nr.'), headerLabel({ label: 'Vârstă', sort: pair })]).toEqual(['Nr.', 'Vârstă']);
  });

  it('the empty season row has no em dash (Needs decision 7f)', () => {
    expect(SEASON_EMPTY_LABEL).toBe('Fără sezon');
  });
});
```

`src/club/__tests__/admin-submission-table-extras.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const src = readFileSync(join(__dirname, '..', '..', 'admin', 'dashboard', 'SubmissionTable.tsx'), 'utf8');

it('takes page extras: params in the list and export queries, meta, toolbar, list slot, bulk slot', () => {
  expect(src).toContain('export interface SubmissionTableExtras {');
  expect(src).toContain('export default function SubmissionTablePage({ cfg, extras }: { cfg: SubmissionTableCfg; extras?: SubmissionTableExtras })');
  expect(src.match(/Object\.assign\((params|p), JSON\.parse\(extraKey\) as Record<string, string>\);/g)).toHaveLength(2);
  expect(src).toContain('React.useEffect(() => setPage(1), [extraKey]);');
  expect(src).toContain('const meta = listMeta(body);');
  expect(src).toContain('onMetaRef.current?.(meta);');
  expect(src).toContain('{extras?.toolbar}');
  expect(src).toContain('{extras?.aboveList}');
  expect(src).toContain('{extras?.bulkActions?.([...selectedIds], () => {');
});

it('exposes the list meta and a refetch to the page renderers', () => {
  expect(src).toContain('pageMeta: Record<string, unknown>;');
  expect(src).toContain('refetch: () => void;');
  expect(src).toMatch(/const api: TableApi = \{[\s\S]*?pageMeta,[\s\S]*?refetch,[\s\S]*?\};/);
});

it('offers per-row status values; none shows the badge and hides the panel status box', () => {
  expect(src).toContain('statusMenu?: (row: Row) => readonly string[];');
  expect(src).toContain('if (options.length === 0) return statusTag(r);');
  expect(src).toContain('statusOptions(r).length === 0 ? null : (');
  expect(src).toContain('options={options.map((v) => ({ value: v, label: v }))}');
});

it('renders sortable compact headers and keeps the Sortare select on its own options', () => {
  expect(src).toContain('headers: CompactHeader[] | ((api: TableApi) => CompactHeader[]);');
  expect(src).toContain('function CompactTh(');
  expect(src).toContain('<CompactTh key={headerLabel(h)} header={h} sort={sort} onSort={sortBy} />');
  expect(src).toContain("value={sortOptions.some((o) => o.value === sort) ? sort : ''}");
  expect(src).toContain('const [sort, setSort] = React.useState<string>(\'newest\');');
});

it('has no em dash left in a quoted string (copy rule)', () => {
  expect(src).not.toMatch(/'[^'\n]*—[^'\n]*'/);
  expect(src).toContain('placeholder={emptyLabel ?? SEASON_EMPTY_LABEL}');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/club/__tests__/ui-table.test.ts src/club/__tests__/admin-submission-table-extras.test.ts`
Expected: FAIL: "Cannot find module '../ui-table'" and the source assertions (e.g. "expected ... to contain 'export interface SubmissionTableExtras {'").

- [ ] **Step 3: Write `src/club/ui-table.ts`**

```ts
/** Rules of the shared submission table (src/admin/dashboard/SubmissionTable.tsx) that Vitest can reach. Pure. */
export type CompactHeader = string | { label: string; sort: readonly [string, string] };
export type HeaderSortDir = 'ascending' | 'descending' | 'none';

const TABLE_KEYS = new Set(['data', 'pagination', 'seasons', 'activeSeason', 'formMeta']);

/** The list answer's other keys, handed to the page (Înscrieri: schools, multipleSchools, allSchoolsTotal). */
export const listMeta = (body: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(body).filter(([key]) => !TABLE_KEYS.has(key)));

export const headerLabel = (h: CompactHeader): string => (typeof h === 'string' ? h : h.label);

/** A sortable header: the first click sorts by its first value, later clicks toggle the pair. */
export const nextHeaderSort = (sort: string, pair: readonly [string, string]): string => (sort === pair[0] ? pair[1] : pair[0]);

export function headerSortDir(sort: string, pair: readonly [string, string]): HeaderSortDir {
  if (sort === pair[0]) return 'ascending';
  return sort === pair[1] ? 'descending' : 'none';
}

/** The empty row of a season Select, without the em dash (plan 3-4 Needs decision 7f, option A). */
export const SEASON_EMPTY_LABEL = 'Fără sezon';
```

- [ ] **Step 4: Edit `src/admin/dashboard/SubmissionTable.tsx`**

Each edit replaces the exact old text with the new text.

(a) Imports. Replace:

```tsx
import { IconChevronDown, IconGrip } from '../ui/icons';
import { fieldsClearedByEdit } from '../../club/registration-edit';
```

with:

```tsx
import { IconChevronDown, IconChevronUp, IconGrip } from '../ui/icons';
import { fieldsClearedByEdit } from '../../club/registration-edit';
import { SEASON_EMPTY_LABEL, headerLabel, headerSortDir, listMeta, nextHeaderSort, type CompactHeader } from '../../club/ui-table';
```

(b) `TableApi`. Replace:

```tsx
  customFields: (r: Row) => React.ReactNode;
  internalNoteField: (r: Row) => React.ReactNode;
}
```

with:

```tsx
  customFields: (r: Row) => React.ReactNode;
  internalNoteField: (r: Row) => React.ReactNode;
  /** The list answer's other keys (Înscrieri: schools, multipleSchools, allSchoolsTotal). */
  pageMeta: Record<string, unknown>;
  /** Reload the list; the rows stay on screen, dimmed. */
  refetch: () => void;
}
```

(c) `SubmissionTableCfg`, after the fallback lists. Replace:

```tsx
  /** Fallback value lists for select-driven filter columns (when formMeta has none). */
  filterSelectFallback?: Record<string, string[]>;
```

with:

```tsx
  /** Fallback value lists for select-driven filter columns (when formMeta has none). */
  filterSelectFallback?: Record<string, string[]>;
  /** Status values offered for one row (panel and cell Select); [] shows the badge only. Default: every status. */
  statusMenu?: (row: Row) => readonly string[];
  /** Options of the "Sortare" Select. Default: Cele mai noi, Cele mai vechi, Nume A-Z. */
  sortOptions?: { value: string; label: string }[];
```

(d) Compact headers type. Replace:

```tsx
    /** Column headers of the compact list (between the checkbox and actions). */
    headers: string[];
```

with:

```tsx
    /** Column headers of the compact list (between the checkbox and actions); an object header sorts by its pair. */
    headers: CompactHeader[] | ((api: TableApi) => CompactHeader[]);
```

(e) The extras type, right after the closing `}` of `SubmissionTableCfg` (the line after `headerActions?: React.ReactNode;`). Replace:

```tsx
  /** Page-specific buttons at the start of the header actions (Înscrieri: "Formulare goale"). */
  headerActions?: React.ReactNode;
}
```

with:

```tsx
  /** Page-specific buttons at the start of the header actions (Înscrieri: "Formulare goale"). */
  headerActions?: React.ReactNode;
}

/** Page state the table does not own (Înscrieri: "Sportiv existent", school tabs, school move). */
export interface SubmissionTableExtras {
  /** Added to the list and export queries; a change goes back to page 1. */
  params?: Record<string, string>;
  /** The list answer's other keys, after every load. */
  onMeta?: (meta: Record<string, unknown>) => void;
  /** After the quick filters in toolbar B. */
  toolbar?: React.ReactNode;
  /** Between the toolbars and the list. */
  aboveList?: React.ReactNode;
  /** In the bulk bar, before "Arhivează"; `done` clears the selection and reloads. */
  bulkActions?: (ids: string[], done: () => void) => React.ReactNode;
}
```

(f) Empty custom answers. Replace:

```tsx
  if (v == null || v === '') return '—';
```

with:

```tsx
  if (v == null || v === '') return '';
```

(g) Season Select empty row. Replace:

```tsx
      placeholder={emptyLabel ?? '— fără sezon —'}
```

with:

```tsx
      placeholder={emptyLabel ?? SEASON_EMPTY_LABEL}
```

(h) Header button CSS. Replace:

```tsx
.ui-root .ui-btn.sbt-qf-on{border-color:var(--theme-primary);color:var(--theme-primary);background:var(--theme-primary-soft)}
```

with:

```tsx
.ui-root .ui-btn.sbt-qf-on{border-color:var(--theme-primary);color:var(--theme-primary);background:var(--theme-primary-soft)}
.ui-root .sbt-sorth{display:inline-flex;align-items:center;gap:4px;padding:0;border:0;background:none;font:inherit;color:inherit;letter-spacing:inherit;text-transform:inherit;cursor:pointer}
.ui-root .sbt-sorth:focus-visible{outline:2px solid var(--theme-focus);outline-offset:2px}
```

(i) The sortable header and the default sort options, before `toastFieldSaved`. Replace:

```tsx
/** "Salvat", or a warning when the field saved but the PDFs could not be rebuilt (the PUT's `rebuild`, plan 2D). */
function toastFieldSaved(body: unknown): void {
```

with:

```tsx
const DEFAULT_SORT_OPTIONS = [
  { value: 'newest', label: 'Cele mai noi' },
  { value: 'oldest', label: 'Cele mai vechi' },
  { value: 'name', label: 'Nume A-Z' },
];

/** A compact-list header; an object header is a button that toggles its two sort values. */
function CompactTh({ header, sort, onSort }: { header: CompactHeader; sort: string; onSort: (value: string) => void }) {
  if (typeof header === 'string') return <th>{header}</th>;
  const dir = headerSortDir(sort, header.sort);
  return (
    <th aria-sort={dir}>
      <button type="button" className="sbt-sorth" onClick={() => onSort(nextHeaderSort(sort, header.sort))}>
        {header.label}
        {dir === 'ascending' && <IconChevronUp size={11} />}
        {dir === 'descending' && <IconChevronDown size={11} />}
      </button>
    </th>
  );
}

/** "Salvat", or a warning when the field saved but the PDFs could not be rebuilt (the PUT's `rebuild`, plan 2D). */
function toastFieldSaved(body: unknown): void {
```

(j) Signature and the extras state. Replace:

```tsx
export default function SubmissionTablePage({ cfg }: { cfg: SubmissionTableCfg }) {
```

with:

```tsx
export default function SubmissionTablePage({ cfg, extras }: { cfg: SubmissionTableCfg; extras?: SubmissionTableExtras }) {
```

and replace:

```tsx
  const fullCss = React.useMemo(() => `${TABLE_CSS}\n${cfg.extraCss ?? ''}`, [cfg]);
```

with:

```tsx
  const fullCss = React.useMemo(() => `${TABLE_CSS}\n${cfg.extraCss ?? ''}`, [cfg]);
  // Page extras: the params travel as one string so a new object with the same values does not refetch.
  const extraKey = JSON.stringify(extras?.params ?? {});
  const onMetaRef = React.useRef(extras?.onMeta);
  onMetaRef.current = extras?.onMeta;
  const [pageMeta, setPageMeta] = React.useState<Record<string, unknown>>({});
  const statusOptions = React.useCallback(
    (r: Row): readonly string[] => cfg.statusMenu?.(r) ?? cfg.statuses.map((s) => s.value),
    [cfg],
  );
  const sortOptions = cfg.sortOptions ?? DEFAULT_SORT_OPTIONS;
```

(k) Sort state. Replace:

```tsx
  const [sort, setSort] = React.useState<'newest' | 'oldest' | 'name'>('newest');
```

with:

```tsx
  const [sort, setSort] = React.useState<string>('newest');
```

(l) Page reset on new extras. Replace:

```tsx
  // --- main list fetch
  React.useEffect(() => {
```

with:

```tsx
  // A new "Sportiv existent" value or school tab starts on page 1.
  React.useEffect(() => setPage(1), [extraKey]);

  // --- main list fetch
  React.useEffect(() => {
```

(m) Extras in the list query and the meta after it. Replace:

```tsx
    if (serverFilters.length) params.filters = serverFiltersKey;
    get(cfg.api, { params })
```

with:

```tsx
    if (serverFilters.length) params.filters = serverFiltersKey;
    Object.assign(params, JSON.parse(extraKey) as Record<string, string>);
    get(cfg.api, { params })
```

then replace:

```tsx
            extraKeys: Array.isArray(fm.extraKeys) ? fm.extraKeys : [],
          });
        }
      })
```

with:

```tsx
            extraKeys: Array.isArray(fm.extraKeys) ? fm.extraKeys : [],
          });
        }
        const meta = listMeta(body);
        setPageMeta(meta);
        onMetaRef.current?.(meta);
      })
```

and replace:

```tsx
  }, [get, cfg, page, pageSize, sort, season, search, archivedParam, serverFiltersKey, serverFilters.length, reloadTick]);
```

with:

```tsx
  }, [get, cfg, page, pageSize, sort, season, search, archivedParam, serverFiltersKey, serverFilters.length, reloadTick, extraKey]);
```

(n) Extras in the export query. Replace:

```tsx
    if (serverFilters.length) p.filters = serverFiltersKey;
    return p;
  }, [sort, archivedParam, season, search, serverFilters.length, serverFiltersKey, cfg]);
```

with:

```tsx
    if (serverFilters.length) p.filters = serverFiltersKey;
    Object.assign(p, JSON.parse(extraKey) as Record<string, string>);
    return p;
  }, [sort, archivedParam, season, search, serverFilters.length, serverFiltersKey, cfg, extraKey]);
```

(o) Status Select per row. Replace:

```tsx
  const statusSelect = (r: Row, key: string, className: string, label: string) => {
    const value = String(r[key] ?? cfg.statuses[0].value);
```

with:

```tsx
  const statusSelect = (r: Row, key: string, className: string, label: string) => {
    const options = statusOptions(r);
    if (options.length === 0) return statusTag(r);
    const value = String(r[key] ?? cfg.statuses[0].value);
```

and replace:

```tsx
        onChange={(v) => saveField(r.documentId, key, v)}
        options={cfg.statuses.map((o) => ({ value: o.value, label: o.value }))}
      />
```

with:

```tsx
        onChange={(v) => saveField(r.documentId, key, v)}
        options={options.map((v) => ({ value: v, label: v }))}
      />
```

(p) Panel status box. Replace:

```tsx
  const statusBox = React.useCallback(
    (r: Row) => (
      <div className="sbt-statusbox">
        <Field label="Status">{statusSelect(r, 'status', 'sbt-status-sel', 'Status')}</Field>
      </div>
    ),
    // statusSelect only reads cfg, statusOf and saveField.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg, statusOf, saveField],
  );
```

with:

```tsx
  const statusBox = React.useCallback(
    (r: Row) =>
      statusOptions(r).length === 0 ? null : (
        <div className="sbt-statusbox">
          <Field label="Status">{statusSelect(r, 'status', 'sbt-status-sel', 'Status')}</Field>
        </div>
      ),
    // statusSelect only reads cfg, statusOf, statusOptions, statusTag and saveField.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg, statusOf, statusOptions, statusTag, saveField],
  );
```

(q) `api`. Replace:

```tsx
    customFields,
    internalNoteField,
  };
```

with:

```tsx
    customFields,
    internalNoteField,
    pageMeta,
    refetch,
  };
  const headerSpecs = typeof cfg.compact.headers === 'function' ? cfg.compact.headers(api) : cfg.compact.headers;
  const sortBy = (value: string) => {
    setSort(value);
    setPage(1);
  };
```

(r) Stat while unknown. Replace:

```tsx
        <b className="ui-num">{seasonStat.total ?? '—'}</b> în total
```

with:

```tsx
        <b className="ui-num">{seasonStat.total ?? ''}</b> în total
```

(s) Bulk slot. Replace:

```tsx
      {cfg.archive && (
        <Button size="sm" variant="secondary" onClick={bulkArchive} disabled={busy}>
```

with:

```tsx
      {extras?.bulkActions?.([...selectedIds], () => {
        clearSelection();
        refetch();
      })}
      {cfg.archive && (
        <Button size="sm" variant="secondary" onClick={bulkArchive} disabled={busy}>
```

(t) Compact headers. Replace:

```tsx
                {cfg.compact.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
```

with:

```tsx
                {headerSpecs.map((h) => (
                  <CompactTh key={headerLabel(h)} header={h} sort={sort} onSort={sortBy} />
                ))}
```

(u) Toolbar slot and the Sortare select. Replace:

```tsx
          {advMenu}
```

with:

```tsx
          {advMenu}
          {extras?.toolbar}
```

and replace:

```tsx
          <Select
            aria-label="Sortare"
            value={sort}
            onChange={(v) => {
              setSort(v as 'newest' | 'oldest' | 'name');
              setPage(1);
            }}
            options={[
              { value: 'newest', label: 'Cele mai noi' },
              { value: 'oldest', label: 'Cele mai vechi' },
              { value: 'name', label: 'Nume A-Z' },
            ]}
          />
```

with:

```tsx
          <Select
            aria-label="Sortare"
            value={sortOptions.some((o) => o.value === sort) ? sort : ''}
            onChange={(v) => {
              setSort(v);
              setPage(1);
            }}
            options={sortOptions}
          />
```

(v) List slot. Replace:

```tsx
        {/* active filter chips */}
```

with:

```tsx
        {extras?.aboveList}

        {/* active filter chips */}
```

(w) "Mută tot sezonul" source field. Replace:

```tsx
              <Input readOnly value={season || activeSeason || '—'} />
```

with:

```tsx
              <Input readOnly value={season || activeSeason || ''} />
```

- [ ] **Step 5: Run the tests and checks**

Run: `npx vitest run src/club/__tests__/ui-table.test.ts src/club/__tests__/admin-submission-table-extras.test.ts && npx tsc --noEmit -p src/admin/tsconfig.json && npx tsc --noEmit && node scripts/admin-ui-check.mjs --strict`
Expected: PASS; zero type errors (`VoluntariPage.tsx` still compiles: string headers are `CompactHeader`s); checker exit 0, "all 0".

- [ ] **Step 6: Commit**

```bash
git add src/club/ui-table.ts src/club/__tests__/ui-table.test.ts src/club/__tests__/admin-submission-table-extras.test.ts src/admin/dashboard/SubmissionTable.tsx
git commit -m "feat(admin): submission table extras, per-row status menu, sortable header"
```

---

### Task 5: Înscrieri list (columns, "Sportiv existent", filter, school tabs and move, full table)

**Files:**
- Create: `src/admin/dashboard/inscrieri/useClient.ts`, `src/admin/dashboard/inscrieri/icons.tsx`, `src/admin/dashboard/inscrieri/styles.ts`, `src/admin/dashboard/inscrieri/ListControls.tsx`, `src/admin/dashboard/inscrieri/moves.ts`
- Modify: `src/admin/dashboard/InscrieriPage.tsx` (whole file below; the panel part is unchanged until Task 6), `scripts/admin-ui-check.mjs` (`dashboard/inscrieri/` held to the colour rule), `src/api/registration-submission/list-search.ts` (`openClause`), `src/api/registration-submission/controllers/registration-submission.ts` (`phase3Clauses` of plan 3-2 Task 15 also reads `open`)
- Test: `src/club/__tests__/admin-inscrieri-list.test.ts`, `src/api/registration-submission/__tests__/list-search.test.ts` (append)

**Interfaces:**
- Consumes: Task 1 (`LIST_COPY`, `ALL_SCHOOLS`, `EMPTY_LIST_META`, `CLUB_URLS`, `ageText`, `cellText`, `compactHeaders`, `listParams`, `moveTargets`, `moveToasts`, `readListMeta`, `schoolTabs`, `showsExistingLine`, `statusMenuValues`, `wishText`, `ListMeta`); Task 4 (`SubmissionTableExtras`, `TableApi.pageMeta`, `cfg.statusMenu`, function headers); plan 3-1 `Select`, `Tabs`, `Button`, `adminToast`; plan 3-2 `MoveSchoolResponse`, `ADMIN_ERRORS`, `requestErrorText`.
- Produces:
  - `useStableClient(): StableClient` (`get`, `post`, `put`, `del` with stable identities; answers typed `Promise<{ data: unknown }>`), `type StableClient`, `dataOf<T>(res: { data: unknown }): T` (`res.data.data`).
  - `IconUser`, `IconEdit` (page icons, square shapes only).
  - `INSCRIERI_CSS` (every class the later tasks use: list, panel, match card, edit form, confirm window); later tasks add no CSS.
  - `ExistingFilter({ value, onChange })`, `SchoolTabs({ meta, value, onChange })`, `BulkMoveSchool({ ids, meta, done })`.
  - `moveSchool(post, url, body, schoolName, single): Promise<boolean>`.
  - `GET /api/forms/inscrieri?open=<documentId>` lists that registration only (with `season=all&archived=all`, sent by `openListParams`); `openClause(v): Record<string, unknown> | null` in `list-search.ts`.
  - `/plugins/edusport-inscrieri?open=<documentId>` opens the page on that registration with its panel (the table keeps the first row open); the address is read with `useLocation`, so following the sidebar link (no `open`) shows the normal list again.
  - The list: columns "Nr." | "Trimis la" | "Nume sportiv" (+ "Sportiv existent" line) | ["Școala"] | "Vârstă" (sortable) | "Status" | "Completat de" | "Dorește să fie membru"; rows about 50px; the new search placeholder; "Sportiv existent: Da / Nu" in toolbar B; school tabs, column and bulk move only with 2+ schools; full table: "Nume sportiv", read-only "Vârstă" column, `colConfigVersion: 2`; status Select without "Confirmat" (Needs decision 2).

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/admin-inscrieri-list.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const root = join(__dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const page = read('src', 'admin', 'dashboard', 'InscrieriPage.tsx');
const controls = read('src', 'admin', 'dashboard', 'inscrieri', 'ListControls.tsx');
const css = read('src', 'admin', 'dashboard', 'inscrieri', 'styles.ts');
const checker = read('scripts', 'admin-ui-check.mjs');

it('list cells: number, date, name with the "Sportiv existent" line, school, age, status, parent, wish', () => {
  expect(page).toContain('headers: (api) => compactHeaders(readListMeta(api.pageMeta).multipleSchools)');
  expect(page).toContain('{showsExistingLine(r) && (');
  expect(page).toContain('{multiple && <td>{cellText(r.schoolName)}</td>}');
  expect(page).toContain('<td className="ui-num">{ageText(r.age)}</td>');
  expect(page).toContain('<td>{wishText(r.membershipAnswer)}</td>');
});

it('uses the spec search placeholder, the status menu without "Confirmat" and "Nume sportiv" everywhere', () => {
  expect(page).toContain('searchPlaceholder: LIST_COPY.searchPlaceholder');
  expect(page).toContain('statusMenu: statusMenuValues');
  expect(page).not.toContain('Nume copil');
  expect(page).toContain("{ key: 'age', label: 'Vârstă', type: 'text', readOnly: true, width: 90, render: (row) => ageText(row.age) }");
  expect(page).toContain('colConfigVersion: 2');
});

it('opens one registration from ?open=<documentId> (plan 3-5 links), else the filtered list', () => {
  expect(page).toContain('const open = readOpenParam(useLocation().search);');
  expect(page).toContain('params: open ? openListParams(open) : listParams(existing, school, meta)');
});

it('passes the filter, the school tabs and the bulk move as table extras', () => {
  expect(page).toContain('params: open ? openListParams(open) : listParams(existing, school, meta)');
  expect(page).toContain('toolbar: <ExistingFilter value={existing} onChange={setExisting} />');
  expect(page).toContain('aboveList: <SchoolTabs meta={meta} value={school} onChange={setSchool} />');
  expect(page).toContain('bulkActions: meta.multipleSchools ? (ids, done) => <BulkMoveSchool ids={ids} meta={meta} done={done} /> : undefined');
  expect(controls).toContain('if (!meta.multipleSchools) return null;');
  expect(controls).toContain('placeholder={LIST_COPY.all}');
});

it('keeps rows one height and colours on tokens; the inscrieri folder is held to the colour rule', () => {
  expect(css).toContain('.ui-root .sbt-clist td{height:50px;padding-top:0;padding-bottom:0}');
  expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|dashed|dotted|border-radius:(?!var\(--ui-radius-)/i);
  expect(css).not.toContain('`');
  expect(checker).toContain("join(ADMIN, 'dashboard', 'inscrieri') + sep");
});
```

Note: `styles.ts` holds the CSS in a template literal; the backtick check reads the CSS body only, so write the constant with single-quoted string parts joined by `+` (as below), not a template literal.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/admin-inscrieri-list.test.ts`
Expected: FAIL with "ENOENT ... ListControls.tsx".

- [ ] **Step 3: Write the client helper, the icons and the styles**

`src/admin/dashboard/inscrieri/useClient.ts`:

```ts
import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';

type Client = ReturnType<typeof useFetchClient>;
type Answer = Promise<{ data: unknown }>;

export type StableClient = {
  get: (url: string, config?: Parameters<Client['get']>[1]) => Answer;
  post: (url: string, data?: unknown, config?: Parameters<Client['post']>[2]) => Answer;
  put: (url: string, data?: unknown, config?: Parameters<Client['put']>[2]) => Answer;
  del: (url: string, config?: Parameters<Client['del']>[1]) => Answer;
};

/**
 * The admin fetch client with stable function identities (useFetchClient returns new ones on every render,
 * which would re-run every effect that depends on them; SubmissionTable.tsx does the same with refs).
 */
export function useStableClient(): StableClient {
  const client = useFetchClient();
  const ref = React.useRef(client);
  ref.current = client;
  return React.useMemo<StableClient>(
    () => ({
      get: (url, config) => ref.current.get(url, config),
      post: (url, data, config) => ref.current.post(url, data, config),
      put: (url, data, config) => ref.current.put(url, data, config),
      del: (url, config) => ref.current.del(url, config),
    }),
    [],
  );
}

/** `data` of a `{ data }` answer (plan 3-2 conventions). */
export const dataOf = <T>(res: { data: unknown }): T => (res.data as { data: T }).data;
```

`src/admin/dashboard/inscrieri/icons.tsx`:

```tsx
import * as React from 'react';

/** Înscrieri page icons (14px grid, currentColor, square shapes only: no circles). */
type P = { size?: number };

const svg = (size: number, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

/** Person: square head, shoulders. Used by the "Sportiv existent" line. */
export const IconUser = ({ size = 14 }: P) =>
  svg(size, <path d="M4.75 1.75h4.5v4.5h-4.5zM2 12.5c.5-2.6 2.5-3.9 5-3.9s4.5 1.3 5 3.9" stroke="currentColor" strokeWidth="1.4" />);

/** Pencil on a line. Used by "Editează". */
export const IconEdit = ({ size = 14 }: P) =>
  svg(size, <path d="M2 12.5h10M9 2.5l2.5 2.5L5.5 11H3V8.5z" stroke="currentColor" strokeWidth="1.4" />);
```

`src/admin/dashboard/inscrieri/styles.ts`:

```ts
/**
 * Înscrieri page CSS (cfg.extraCss: one global style tag, so the portaled confirm window gets it too).
 * Tokens only; every class ins- prefixed under .ui-root; written in plain strings (a backtick inside a
 * CSS template literal blanks the admin, see src/admin/ui/styles.ts).
 */
const LIST_CSS =
  '.ui-root .sbt-clist td{height:50px;padding-top:0;padding-bottom:0}' +
  '.ui-root .ins-nr{font-weight:700}' +
  '.ui-root .ins-name{line-height:1.2}' +
  '.ui-root .ins-name b{display:block}' +
  '.ui-root .ins-ex{display:flex;align-items:center;gap:5px;margin-top:1px;min-height:14px;font-size:11.5px;font-weight:600;color:var(--theme-info)}' +
  '.ui-root .ins-exf{display:inline-flex;align-items:center;gap:6px}' +
  '.ui-root .ins-schools{padding:0 18px;border-bottom:1px solid var(--theme-border)}';

const PANEL_CSS =
  '.ui-root .ins-panel{display:flex;flex-direction:column;min-width:0}' +
  '.ui-root .ins-ph{display:flex;flex-direction:column;gap:6px;padding:13px 15px 0}' +
  '.ui-root .ins-ph-top{display:flex;align-items:center;gap:8px}' +
  '.ui-root .ins-ph-name{flex:1;min-width:0;font-size:15px;color:var(--theme-text)}' +
  '.ui-root .ins-ph-meta{display:flex;flex-wrap:wrap;gap:14px;font-size:12.5px;color:var(--theme-text-secondary)}' +
  '.ui-root .ins-ph-meta b{color:var(--theme-text)}' +
  '.ui-root .ins-ph .sbt-statusbox{margin:4px 0 0}' +
  '.ui-root .ins-tabs{margin-top:10px;padding:0 15px}' +
  '.ui-root .ins-panel .sbt-pb{max-height:calc(100vh - 420px);min-height:240px}' +
  '.ui-root .ins-extra{margin-top:16px;padding-top:12px;border-top:1px solid var(--theme-border)}' +
  '.ui-root .ins-empty{margin:0;font-size:13px;color:var(--theme-text-muted)}' +
  '.ui-root .ins-his{display:flex;flex-direction:column;gap:12px;margin:0;padding:0;list-style:none}' +
  '.ui-root .ins-his li{display:flex;flex-direction:column;gap:2px;font-size:13px;color:var(--theme-text)}' +
  '.ui-root .ins-his-h{font-size:12px;font-weight:600;color:var(--theme-text-secondary)}' +
  '.ui-root .ins-foot{display:flex;flex-wrap:wrap;gap:8px;margin-left:auto}' +
  '.ui-root .ins-link{display:inline-flex;align-items:center;gap:4px;padding:0;border:0;background:none;font:inherit;font-size:12.5px;font-weight:600;color:var(--theme-primary);cursor:pointer}' +
  '.ui-root .ins-link:focus-visible{outline:2px solid var(--theme-focus);outline-offset:2px}' +
  '.ui-root .ins-label-row{display:flex;align-items:center;justify-content:space-between;gap:8px}' +
  '.ui-root .ins-label-row .ins-link{text-transform:none;letter-spacing:0}' +
  '.ui-root.sbt-menu button.ins-danger{color:var(--theme-danger)}';

const MATCH_CSS =
  '.ui-root .ins-mcard{margin:10px 15px 0;border:1px solid var(--theme-border);border-radius:var(--ui-radius-md);background:var(--theme-surface)}' +
  '.ui-root .ins-mcard-top,.ui-root .ins-acard{display:flex;align-items:center;gap:10px;padding:10px 12px}' +
  '.ui-root .ins-av{flex:none;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--ui-radius-md);background:var(--theme-primary-soft);color:var(--theme-primary);font-size:13px;font-weight:700}' +
  '.ui-root .ins-acard-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:12.5px;color:var(--theme-text-secondary)}' +
  '.ui-root .ins-acard-t b{font-size:13.5px;color:var(--theme-text)}' +
  '.ui-root .ins-mcard-body{display:flex;flex-direction:column;padding:0 12px 10px;border-top:1px solid var(--theme-border)}' +
  '.ui-root .ins-cmp-wrap{overflow-x:auto}' +
  '.ui-root .ins-cmp{width:100%;border-collapse:collapse;font-size:12.5px}' +
  '.ui-root .ins-cmp th{padding:8px 6px;text-align:left;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--theme-text-muted)}' +
  '.ui-root .ins-cmp td{padding:7px 6px;border-top:1px solid var(--theme-border);vertical-align:top;color:var(--theme-text)}' +
  '.ui-root .ins-cmp tr.is-diff td{background:var(--theme-warning-bg)}' +
  '.ui-root .ins-right{align-self:flex-end;margin-top:8px}';

const EDIT_CSS =
  '.ui-root .ins-edit-h{margin:16px 0 8px;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--theme-text-muted)}' +
  '.ui-root .ins-edit-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}';

const CONFIRM_CSS =
  '.ui-root .ins-win{display:flex;flex-direction:column;gap:16px}' +
  '.ui-root .ins-sec{display:flex;flex-direction:column;gap:10px}' +
  '.ui-root .ins-sec + .ins-sec{padding-top:14px;border-top:1px solid var(--theme-border)}' +
  '.ui-root .ins-sec-h{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--theme-text-muted)}' +
  '.ui-root .ins-acard{border:1px solid var(--theme-border);border-radius:var(--ui-radius-md);background:var(--theme-surface)}' +
  '.ui-root .ins-hint2{display:block;margin-top:4px}' +
  '.ui-root .ins-links{display:flex;flex-wrap:wrap;gap:16px}' +
  '.ui-root .ins-win .ins-cmp{min-width:520px}' +
  '.ui-root .ins-note,.ui-root .ins-line,.ui-root .ins-intent,.ui-root .ins-acs p{margin:0;font-size:13px;color:var(--theme-text)}' +
  '.ui-root .ins-acs{display:flex;flex-direction:column;gap:4px}' +
  '.ui-root .ins-search-bar{display:flex;align-items:center;gap:10px}' +
  '.ui-root .ins-search-bar .ui-input{flex:1}' +
  '.ui-root .ins-res{margin:6px 0 0;padding:0;list-style:none;border:1px solid var(--theme-border);border-radius:var(--ui-radius-md);background:var(--theme-surface)}' +
  '.ui-root .ins-res li + li{border-top:1px solid var(--theme-border)}' +
  '.ui-root .ins-res button{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border:0;background:none;font:inherit;text-align:left;color:var(--theme-text);cursor:pointer}' +
  '.ui-root .ins-res button:hover,.ui-root .ins-res button:focus-visible{background:var(--theme-surface-subtle);outline:none}' +
  '.ui-root .ins-res-t{display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--theme-text-secondary)}' +
  '.ui-root .ins-res-t b{font-size:13.5px;color:var(--theme-text)}' +
  '.ui-root .ins-res-none{padding:10px 12px;font-size:13px;color:var(--theme-text-muted)}' +
  '.ui-root .ins-foot-hint{flex:1;align-self:center;font-size:12.5px;color:var(--theme-text-muted)}';

export const INSCRIERI_CSS = [LIST_CSS, PANEL_CSS, MATCH_CSS, EDIT_CSS, CONFIRM_CSS].join('\n');
```

- [ ] **Step 4: Write the list controls and the move helper**

`src/admin/dashboard/inscrieri/moves.ts`:

```ts
import { adminToast } from '../../ui';
import type { MoveSchoolResponse } from '../../../club/athletes/api-types';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { moveToasts } from '../../../club/inscrieri-panel';
import { requestErrorText } from '../../../club/registration-panel';
import { dataOf, type StableClient } from './useClient';

/** POST a school move (spec 3.6) and toast the result; true when the request went through. */
export async function moveSchool(
  post: StableClient['post'],
  url: string,
  body: Record<string, unknown>,
  schoolName: string,
  single: boolean,
): Promise<boolean> {
  try {
    const res = dataOf<MoveSchoolResponse>(await post(url, body));
    moveToasts(res, schoolName, single).forEach((t) => adminToast[t.tone](t.text));
    return true;
  } catch (err) {
    adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
    return false;
  }
}
```

`src/admin/dashboard/inscrieri/ListControls.tsx`:

```tsx
import * as React from 'react';
import { Button, Select, Tabs } from '../../ui';
import { LIST_COPY } from '../../../club/inscrieri-copy';
import { CLUB_URLS, moveTargets, schoolTabs, type ListMeta } from '../../../club/inscrieri-panel';
import { moveSchool } from './moves';
import { useStableClient } from './useClient';

const EXISTING_OPTIONS = [
  { value: 'da', label: LIST_COPY.yes },
  { value: 'nu', label: LIST_COPY.no },
];

/** "Sportiv existent: Da / Nu" in the current toolbar (spec 3.1, gaps #22). */
export function ExistingFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <span className="ins-exf">
      <span className="sbt-lbl">{LIST_COPY.existing}:</span>
      <Select aria-label={LIST_COPY.existing} value={value} onChange={onChange} placeholder={LIST_COPY.all} options={EXISTING_OPTIONS} />
    </span>
  );
}

/** "Toate (n)", "<școală> (n)" (spec 3.6): built now, shown only with 2+ schools. */
export function SchoolTabs({ meta, value, onChange }: { meta: ListMeta; value: string; onChange: (id: string) => void }) {
  if (!meta.multipleSchools) return null;
  return <Tabs className="ins-schools" label={LIST_COPY.school} items={schoolTabs(meta)} value={value} onChange={onChange} />;
}

/** Bulk "Mută la altă școală" with a school picker (spec 3.1, 3.6); confirmed rows are left out by the server. */
export function BulkMoveSchool({ ids, meta, done }: { ids: string[]; meta: ListMeta; done: () => void }) {
  const { post } = useStableClient();
  const [target, setTarget] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const school = meta.schools.find((s) => s.documentId === target);
  const move = async () => {
    if (!school) return;
    setBusy(true);
    const ok = await moveSchool(post, CLUB_URLS.moveSchoolBulk, { documentIds: ids, sectionId: school.documentId }, school.name, false);
    setBusy(false);
    if (ok) done();
  };
  return (
    <>
      <Select aria-label={LIST_COPY.school} value={target} onChange={setTarget} options={moveTargets(meta, null)} />
      <Button size="sm" onClick={() => void move()} loading={busy} disabled={!school}>
        {LIST_COPY.moveSchool}
      </Button>
    </>
  );
}
```

- [ ] **Step 5: Rewrite `src/admin/dashboard/InscrieriPage.tsx`**

```tsx
import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '../ui';
import SubmissionTablePage, {
  DetailBody,
  DetailField,
  DetailFooter,
  DetailHeader,
  fmtDateTime,
  fmtDateShort,
  type ColumnDef,
  type Row,
  type SubmissionTableCfg,
  type SubmissionTableExtras,
  type TableApi,
} from './SubmissionTable';
import { isScriptFormRegistration, registrationPanelRows } from '../../club/registration-panel';
import { LIST_COPY } from '../../club/inscrieri-copy';
import {
  ALL_SCHOOLS,
  EMPTY_LIST_META,
  ageText,
  cellText,
  compactHeaders,
  listParams,
  openListParams,
  readListMeta,
  readOpenParam,
  showsExistingLine,
  statusMenuValues,
  wishText,
  type ListMeta,
} from '../../club/inscrieri-panel';
import { BlankFormsMenu } from './inscrieri/BlankFormsMenu';
import { EditableAnswer } from './inscrieri/EditableAnswer';
import { BulkMoveSchool, ExistingFilter, SchoolTabs } from './inscrieri/ListControls';
import { RegistrationDocuments } from './inscrieri/RegistrationDocuments';
import { RegistrationEmail } from './inscrieri/RegistrationEmail';
import { IconUser } from './inscrieri/icons';
import { INSCRIERI_CSS } from './inscrieri/styles';

/**
 * EduSport admin: the "Înscrieri" page (spec 3). A configuration of the shared SubmissionTablePage plus the
 * page state the table does not own ("Sportiv existent" filter, school tabs, bulk school move), passed as extras.
 * Rows come from GET /api/forms/inscrieri with plan 3-2's extras (age, existingAthlete, athleteId, canUndo,
 * schoolId, schoolName) and the top-level school data (schools, multipleSchools, allSchoolsTotal).
 * Google Sheets is a live connection, not an export: see SheetsDialog.tsx and the /api/sheets/* endpoints.
 */

const LEVELS = [
  'Nu a mai patinat',
  'A mai patinat in alta parte',
  'Incepatori',
  'Intermediari',
  'Avansati',
  'Performanta',
] as const;

// The registry keys that map to editable/removable built-in columns. status,
// submittedAt and internalNote are meta columns and are never "removed".
const REGISTRY_COL_KEYS = [
  'childName',
  'childBirthDate',
  'parentName',
  'email',
  'phone',
  'level',
  'shirtSize',
  'howHeard',
  'clubInterest',
  'regulationsAgreement',
  'privacyConsent',
  'priorExperience',
  'expectations',
];

// Order convention shared with VoluntariPage: `submittedAt`, the row's name column, `status`, then the rest.
// Bump `colConfigVersion` in CFG whenever this order changes (2 = "Vârstă" after the name, spec 3.2).
const BUILTIN_COLUMNS: ColumnDef[] = [
  { key: 'submittedAt', label: 'Trimis la', type: 'date', readOnly: true, width: 150 },
  { key: 'childName', label: 'Nume sportiv', type: 'text', width: 170 },
  { key: 'age', label: 'Vârstă', type: 'text', readOnly: true, width: 90, render: (row) => ageText(row.age) },
  { key: 'status', label: 'Status', type: 'status', width: 130 },
  { key: 'childBirthDate', label: 'Data nașterii', type: 'text', width: 150 },
  { key: 'parentName', label: 'Nume părinte', type: 'text', width: 170 },
  { key: 'email', label: 'Email', type: 'text', width: 210 },
  { key: 'phone', label: 'Telefon', type: 'text', width: 140 },
  { key: 'level', label: 'Nivel', type: 'level', width: 190 },
  { key: 'shirtSize', label: 'Mărime tricou', type: 'text', width: 120 },
  { key: 'howHeard', label: 'Cum a aflat', type: 'text', width: 170 },
  { key: 'clubInterest', label: 'Interes club', type: 'bool', width: 110 },
  { key: 'regulationsAgreement', label: 'Acord regulament', type: 'bool', width: 150 },
  { key: 'privacyConsent', label: 'Confidențialitate', type: 'bool', width: 140 },
  { key: 'priorExperience', label: 'Experiență anterioară', type: 'longtext', width: 240 },
  { key: 'expectations', label: 'Așteptări', type: 'longtext', width: 240 },
  { key: 'internalNote', label: 'Notă internă', type: 'longtext', width: 240 },
];

// Filter-builder column options (map to whitelisted server fields).
const FILTER_COLUMNS = [
  { key: 'childName', label: 'Nume sportiv' },
  { key: 'parentName', label: 'Nume părinte' },
  { key: 'level', label: 'Nivel' },
  { key: 'status', label: 'Status' },
  { key: 'phone', label: 'Telefon' },
  { key: 'email', label: 'Email' },
  { key: 'submittedAt', label: 'Data înscrierii' },
] as const;

/** One list row (spec 3.1): the "Sportiv existent" line sits tight under the name; rows without it keep the line empty. */
const renderCells = (r: Row, api: TableApi) => {
  const multiple = readListMeta(api.pageMeta).multipleSchools;
  return (
    <>
      <td className="ui-num ins-nr">{cellText(r.registrationNumber)}</td>
      <td className="ui-num">{fmtDateShort(r.submittedAt)}</td>
      <td className="ins-name">
        <b>{cellText(r.childName)}</b>
        <span className="ins-ex">
          {showsExistingLine(r) && (
            <>
              <IconUser size={12} />
              {LIST_COPY.existing}
            </>
          )}
        </span>
      </td>
      {multiple && <td>{cellText(r.schoolName)}</td>}
      <td className="ui-num">{ageText(r.age)}</td>
      <td>{api.statusTag(r)}</td>
      <td>{cellText(r.parentName)}</td>
      <td>{wishText(r.membershipAnswer)}</td>
    </>
  );
};

/** Answers as label/value rows (src/club/registration-panel.ts), the long texts after a gap. Replaced by the tabs in Task 6. */
function PanelAnswers({ row, save }: { row: Row; save: TableApi['saveField'] }) {
  const { rows, longRows } = registrationPanelRows(row);
  return (
    <>
      {rows.map((r) =>
        r.edit ? (
          <EditableAnswer key={r.label} row={row} edit={r.edit} save={save} />
        ) : (
          <DetailField key={r.label} label={r.label}>{r.value}</DetailField>
        ),
      )}
      {longRows.map((r, i) => (
        <DetailField key={r.label} label={r.label} style={i === 0 ? { marginTop: 11 } : undefined}>
          {r.value}
        </DetailField>
      ))}
    </>
  );
}

const renderDetail = (row: Row, api: TableApi) => {
  const scriptForm = isScriptFormRegistration(row);
  return (
    <>
      <DetailHeader>
        <b>{cellText(row.childName)}</b>
        {api.statusTag(row)}
      </DetailHeader>
      <DetailBody>
        {api.statusBox(row)}
        <DetailField label="Trimis la">{fmtDateTime(row.submittedAt)}</DetailField>
        <DetailField label="Arhivare">{row.archived ? 'Arhivat' : 'Activ'}</DetailField>
        {api.seasonField(row)}
        <PanelAnswers row={row} save={api.saveField} />
        {scriptForm && <RegistrationDocuments row={row} />}
        {scriptForm && <RegistrationEmail row={row} />}
        {api.customFields(row)}
        {api.internalNoteField(row)}
      </DetailBody>
      <DetailFooter>
        <span />
        <Button size="sm" variant="danger" onClick={() => api.removeRow(row.documentId)}>
          Șterge înscrierea
        </Button>
      </DetailFooter>
    </>
  );
};

const CFG: SubmissionTableCfg = {
  api: '/api/forms/inscrieri',
  storagePrefix: 'edusport-inscrieri-cols',
  // 1 = status moved directly after `childName`; 2 = "Vârstă" added after the name.
  colConfigVersion: 2,
  csvPrefix: 'inscrieri',
  statuses: [
    { value: 'Nou', color: 'var(--theme-primary)', soft: 'var(--theme-primary-soft)', border: 'var(--theme-primary-soft-line)' },
    { value: 'Contactat', color: 'var(--theme-info)', soft: 'var(--theme-info-bg)', border: 'var(--theme-info-border)' },
    { value: 'Confirmat', color: 'var(--theme-success)', soft: 'var(--theme-success-bg)', border: 'var(--theme-success-border)' },
    { value: 'Respins', color: 'var(--theme-danger)', soft: 'var(--theme-danger-bg)', border: 'var(--theme-danger-border)' },
  ],
  extraTags: [{ value: 'Arhivat', color: 'var(--theme-neutral)', soft: 'var(--theme-neutral-bg)', border: 'var(--theme-neutral-border)' }],
  // "Confirmat" only through "Confirmă înscrierea" (spec 3.2, 3.5); none on a Confirmat row (Needs decision 2).
  statusMenu: statusMenuValues,
  builtinColumns: BUILTIN_COLUMNS,
  registryColKeys: REGISTRY_COL_KEYS,
  filterColumns: FILTER_COLUMNS,
  quickFilterCols: ['status', 'level'],
  filterSelectFallback: { level: [...LEVELS] },
  seasons: true,
  archive: true,
  sheetsForm: 'inscrieri',
  bulk: true,
  headerActions: <BlankFormsMenu />,
  extraCss: INSCRIERI_CSS,
  texts: {
    title: 'Înscrieri',
    subtitle: 'Cererile trimise prin formularul public de înscriere.',
    searchPlaceholder: LIST_COPY.searchPlaceholder,
    empty: 'Nicio înscriere pentru filtrul curent.',
    loadError: 'Nu am putut încărca înscrierile.',
    statSuffix: ', exclus arhivate',
    deleteConfirm: 'Ștergi definitiv această înscriere și documentele ei? Acțiunea nu poate fi anulată.',
    bulkDeleteNoun: 'înscrieri',
    deleteError: 'Nu am putut șterge înscrierea.',
    saveError: 'Nu am putut salva modificarea.',
  },
  compact: {
    headers: (api) => compactHeaders(readListMeta(api.pageMeta).multipleSchools),
    renderCells,
    renderDetail,
  },
};

export default function InscrieriPage() {
  const open = readOpenParam(useLocation().search);
  const [existing, setExisting] = React.useState('');
  const [school, setSchool] = React.useState<string>(ALL_SCHOOLS);
  const [meta, setMeta] = React.useState<ListMeta>(EMPTY_LIST_META);
  const onMeta = React.useCallback((m: Record<string, unknown>) => setMeta(readListMeta(m)), []);
  const extras: SubmissionTableExtras = {
    params: open ? openListParams(open) : listParams(existing, school, meta),
    onMeta,
    toolbar: <ExistingFilter value={existing} onChange={setExisting} />,
    aboveList: <SchoolTabs meta={meta} value={school} onChange={setSchool} />,
    bulkActions: meta.multipleSchools ? (ids, done) => <BulkMoveSchool ids={ids} meta={meta} done={done} /> : undefined,
  };
  return <SubmissionTablePage cfg={CFG} extras={extras} />;
}
```

- [ ] **Step 5b: The `open` list parameter (server)**

Append to `src/api/registration-submission/__tests__/list-search.test.ts` (and add `openClause` to its import from `'../list-search'`):

```ts
describe('Înscrieri list, ?open=<documentId> (plan 3-5 links)', () => {
  it('narrows the list to that registration', () => {
    expect(openClause(' r1 ')).toEqual({ documentId: 'r1' });
    expect([openClause(''), openClause(undefined), openClause(5)]).toEqual([null, null, null]);
  });
});
```

Run: `npx vitest run src/api/registration-submission/__tests__/list-search.test.ts`
Expected: FAIL (`openClause` is not exported yet).

In `src/api/registration-submission/list-search.ts`, after `schoolClause`, add:

```ts
/** `?open=<documentId>`: one registration, for the athlete record's "Înscrieri" links (plan 3-5). */
export function openClause(v: unknown): Record<string, unknown> | null {
  return text(v) ? { documentId: text(v) } : null;
}
```

In `src/api/registration-submission/controllers/registration-submission.ts`, add `openClause` to the `'../list-search'` import and replace:

```ts
  return [existingClause(query.existing), schoolClause(query.school)].filter((c): c is Record<string, unknown> => c !== null);
```

with:

```ts
  return [existingClause(query.existing), schoolClause(query.school), openClause(query.open)].filter((c): c is Record<string, unknown> => c !== null);
```

Run: `npx vitest run src/api/registration-submission && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 6: Hold the folder to the colour rule**

In `scripts/admin-ui-check.mjs` replace:

```js
const RULED_DIRS = [UI_DIR, join(ADMIN, 'pages') + sep, join(ADMIN, 'lib') + sep];
```

with:

```js
const RULED_DIRS = [UI_DIR, join(ADMIN, 'pages') + sep, join(ADMIN, 'lib') + sep, join(ADMIN, 'dashboard', 'inscrieri') + sep];
```

- [ ] **Step 7: Run the test and checks**

Run: `npx vitest run src/club/__tests__/admin-inscrieri-list.test.ts src/club/__tests__/admin-submission-table-extras.test.ts && npx tsc --noEmit -p src/admin/tsconfig.json && npx tsc --noEmit && node scripts/admin-ui-check.mjs --strict`
Expected: PASS; zero type errors; checker exit 0 "all 0" (the existing `inscrieri/*.tsx` files use no colours; if the checker lists one, replace that value with its `--theme-*` token in the same commit).

- [ ] **Step 8: Commit**

```bash
git add src/admin/dashboard/InscrieriPage.tsx src/admin/dashboard/inscrieri/useClient.ts src/admin/dashboard/inscrieri/icons.tsx src/admin/dashboard/inscrieri/styles.ts src/admin/dashboard/inscrieri/ListControls.tsx src/admin/dashboard/inscrieri/moves.ts scripts/admin-ui-check.mjs src/club/__tests__/admin-inscrieri-list.test.ts src/api/registration-submission/list-search.ts src/api/registration-submission/controllers/registration-submission.ts src/api/registration-submission/__tests__/list-search.test.ts
git commit -m "feat(admin): Înscrieri list columns, Sportiv existent filter, school tabs, move and open link"
```

---

### Task 6: Panel shell (header, "..." menu, tabs, footer, undo, school move)

**Files:**
- Create: `src/admin/dashboard/inscrieri/RegistrationPanel.tsx`, `PanelHeader.tsx`, `PanelMenu.tsx`, `PanelTabs.tsx`, `RowsView.tsx`, `DateTab.tsx`, `usePanelData.ts`, `undo.ts` (all in `src/admin/dashboard/inscrieri/`)
- Modify: `src/admin/dashboard/InscrieriPage.tsx` (the panel), `src/club/registration-panel.ts` (old rows API removed), `src/club/__tests__/registration-panel.test.ts`
- Delete: `src/admin/dashboard/inscrieri/EditableAnswer.tsx` (in-place edits replaced by the tabs and "Editează", spec 3.3)
- Test: `src/club/__tests__/admin-inscrieri-panel.test.ts`

**Interfaces:**
- Consumes: Task 1 (`PANEL_COPY`, `LIST_COPY`, `INSCRIERI_PENDING_COPY`, `CLUB_URLS`, `abonamentTabRows`, `dateTabRows`, `cellText`, `footerActions`, `historyHead`, `isPanelTab`, `linkedAthleteId`, `menuItems`, `moveTargets`, `panelTabs`, `panelVersion`, `readListMeta`, `athleteRecordPath`, types); Task 4 (`TableApi.pageMeta`, `refetch`, `statusBox` returning null without status values); Task 5 (`useStableClient`, `dataOf`, `moveSchool`); plan 3-1 `Tabs`, `Modal`, `Select`, `Field`, `Loading`, `ConfirmDialog`, `MenuButton`; plan 3-2 `HistoryLine`, `RegistrationMatchView`, `ADMIN_ERRORS`, `requestErrorText`.
- Produces:
  - `RegistrationPanel({ row, api })` (keyed by `row.documentId` in `renderDetail`); `PanelFooter` accepts `onConfirm?: () => void` (the button is disabled until Task 9 passes it).
  - `type PanelData = { match: RegistrationMatchView | null; history: HistoryLine[] | null; failed: boolean }`, `usePanelData(documentId, version): PanelData`.
  - `runUndo(post, registrationId): Promise<boolean>` (plain async: toasts "Confirmare anulată." or the refusal text; usable after the panel is gone).
  - `RowsView({ rows })`, `DateTab({ row, api })`, `PanelExtras({ row, api })`, `PanelBody({ tab, row, api, data })`.
  - `src/club/registration-panel.ts` keeps `PanelDocumentKind`, `RegistrationRow`, `EmailStatus`, `DOCUMENT_LABELS`, `RELATIONSHIP_EDIT_OPTIONS` (plan 3-2's history texts import it), `isScriptFormRegistration`, `relationshipText`, `subscriptionText`, `sourceText` and everything from `registrationDocumentKinds` down; `PanelEdit`, `PanelRow`, `PanelRows`, `MISSING`, `MEMBERSHIP_EDIT_OPTIONS` and `registrationPanelRows` are removed.

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/admin-inscrieri-panel.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const dir = join(__dirname, '..', '..', 'admin', 'dashboard');
const read = (...p: string[]) => readFileSync(join(dir, ...p), 'utf8');
const page = read('InscrieriPage.tsx');
const panel = read('inscrieri', 'RegistrationPanel.tsx');
const header = read('inscrieri', 'PanelHeader.tsx');
const menu = read('inscrieri', 'PanelMenu.tsx');
const tabs = read('inscrieri', 'PanelTabs.tsx');
const dateTab = read('inscrieri', 'DateTab.tsx');
const data = read('inscrieri', 'usePanelData.ts');
const undo = read('inscrieri', 'undo.ts');

it('the panel replaces the flat list; the in-place edits are gone (spec 3.3)', () => {
  expect(page).toContain('const renderDetail = (row: Row, api: TableApi) => <RegistrationPanel key={row.documentId} row={row} api={api} />;');
  expect(page).not.toContain('PanelAnswers');
  expect(existsSync(join(dir, 'inscrieri', 'EditableAnswer.tsx'))).toBe(false);
});

it('fixed header: name, badge, "..." menu, Nr., Trimis, the status menu (Needs decision 1, A)', () => {
  expect(header).toContain('{api.statusTag(row)}');
  expect(header).toContain('<PanelMenu row={row} api={api} />');
  expect(header).toContain('{PANEL_COPY.number} <b className="ui-num">{nr}</b>');
  expect(header).toContain('{PANEL_COPY.submitted} <b>{fmtDateTime(row.submittedAt)}</b>');
  expect(header).toContain('{api.statusBox(row)}');
});

it('tabs Date | Abonament | Documente (n) | Istoric (n), reloaded when the row changes', () => {
  expect(panel).toContain('items={panelTabs(row, data.history ? data.history.length : null)}');
  expect(panel).toContain('usePanelData(row.documentId, panelVersion(row))');
  expect(data).toContain('Promise.all([get(CLUB_URLS.match(documentId)), get(CLUB_URLS.history(documentId))])');
  expect(tabs).toContain('<RegistrationDocuments row={row} />');
  expect(tabs).toContain('<RegistrationEmail row={row} />');
  expect(tabs).toContain('historyHead(line, fmtDateTime)');
  expect(dateTab).toContain('{api.internalNoteField(row)}');
});

it('footer: Contactat sets the status, Confirmă waits for the window, the record opens in the same tab', () => {
  expect(panel).toContain("api.saveField(row.documentId, 'status', 'Contactat')");
  expect(panel).toContain('disabled={!onConfirm}');
  expect(panel).toContain('navigate(athleteRecordPath(athleteId))');
});

it('"..." menu: undo asks first, move picks a school, delete uses the table dialog', () => {
  expect(menu).toContain('menuItems(row, meta.multipleSchools)');
  expect(menu).toMatch(/<ConfirmDialog\s+open\s+title=\{c\.title\}\s+message=\{c\.message\}\s+confirmLabel=\{c\.confirm\}/);
  expect(menu).toContain("if (item === 'delete') api.removeRow(row.documentId);");
  expect(menu).toContain('moveTargets(meta, row.schoolId)');
  expect(undo).toContain('await post(CLUB_URLS.undo(registrationId));');
  expect(undo).toContain('adminToast.success(INSCRIERI_PENDING_COPY.undone);');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/admin-inscrieri-panel.test.ts`
Expected: FAIL with "ENOENT ... RegistrationPanel.tsx".

- [ ] **Step 3: Write the data hook and the undo**

`src/admin/dashboard/inscrieri/usePanelData.ts`:

```ts
import * as React from 'react';
import type { HistoryLine, RegistrationMatchView } from '../../../club/athletes/api-types';
import { CLUB_URLS } from '../../../club/inscrieri-panel';
import { dataOf, useStableClient } from './useClient';

export type PanelData = { match: RegistrationMatchView | null; history: HistoryLine[] | null; failed: boolean };

const EMPTY: PanelData = { match: null, history: null, failed: false };

/** The match card and window start (plan 3-2 GET .../match) and the Istoric lines; reloaded when `version` changes. */
export function usePanelData(documentId: string, version: string): PanelData {
  const { get } = useStableClient();
  const [data, setData] = React.useState<PanelData>(EMPTY);
  React.useEffect(() => {
    let off = false;
    Promise.all([get(CLUB_URLS.match(documentId)), get(CLUB_URLS.history(documentId))])
      .then(([match, history]) => {
        if (!off) setData({ match: dataOf<RegistrationMatchView>(match), history: dataOf<HistoryLine[]>(history), failed: false });
      })
      .catch(() => {
        if (!off) setData({ ...EMPTY, failed: true });
      });
    return () => {
      off = true;
    };
  }, [get, documentId, version]);
  return data;
}
```

`src/admin/dashboard/inscrieri/undo.ts`:

```ts
import { adminToast } from '../../ui';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { INSCRIERI_PENDING_COPY } from '../../../club/inscrieri-copy';
import { CLUB_URLS } from '../../../club/inscrieri-panel';
import { requestErrorText } from '../../../club/registration-panel';
import type { StableClient } from './useClient';

/**
 * Undo a confirmation (spec 4.6): the toast's "Anulează" and the panel's "Anulează confirmarea". Plain async,
 * no React state, so the toast action still works after the panel is gone. Reports its own result.
 */
export async function runUndo(post: StableClient['post'], registrationId: string): Promise<boolean> {
  try {
    await post(CLUB_URLS.undo(registrationId));
    adminToast.success(INSCRIERI_PENDING_COPY.undone);
    return true;
  } catch (err) {
    adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
    return false;
  }
}
```

- [ ] **Step 4: Write the tabs**

`src/admin/dashboard/inscrieri/RowsView.tsx`:

```tsx
import * as React from 'react';
import { DetailField } from '../SubmissionTable';
import type { TabRow } from '../../../club/inscrieri-panel';

/** Label / value rows of a tab; empty values stay blank. */
export function RowsView({ rows }: { rows: TabRow[] }) {
  return (
    <>
      {rows.map((r) => (
        <DetailField key={r.key} label={r.label}>
          {r.value}
        </DetailField>
      ))}
    </>
  );
}
```

`src/admin/dashboard/inscrieri/DateTab.tsx`:

```tsx
import * as React from 'react';
import { DetailField, type Row, type TableApi } from '../SubmissionTable';
import { PANEL_COPY } from '../../../club/inscrieri-copy';
import { dateTabRows } from '../../../club/inscrieri-panel';
import { RowsView } from './RowsView';

/** "Sezon", "Arhivare", custom answers and "Notă internă", after the answers (Needs decision 1, option A). */
export function PanelExtras({ row, api }: { row: Row; api: TableApi }) {
  return (
    <div className="ins-extra">
      {api.seasonField(row)}
      <DetailField label={PANEL_COPY.archiveField}>{row.archived ? PANEL_COPY.archived : PANEL_COPY.active}</DetailField>
      {api.customFields(row)}
      {api.internalNoteField(row)}
    </div>
  );
}

/** Date tab (spec 3.3): the form's answers in form order. */
export function DateTab({ row, api }: { row: Row; api: TableApi }) {
  return (
    <>
      <RowsView rows={dateTabRows(row)} />
      <PanelExtras row={row} api={api} />
    </>
  );
}
```

`src/admin/dashboard/inscrieri/PanelTabs.tsx`:

```tsx
import * as React from 'react';
import { Loading } from '../../ui';
import { fmtDateTime, type Row, type TableApi } from '../SubmissionTable';
import { INSCRIERI_PENDING_COPY } from '../../../club/inscrieri-copy';
import { abonamentTabRows, historyHead, type PanelTab } from '../../../club/inscrieri-panel';
import { isScriptFormRegistration } from '../../../club/registration-panel';
import { DateTab } from './DateTab';
import { RegistrationDocuments } from './RegistrationDocuments';
import { RegistrationEmail } from './RegistrationEmail';
import { RowsView } from './RowsView';
import type { PanelData } from './usePanelData';

/** Documente (spec 3.3): the phase 2 PDFs and the e-mail block with "Retrimite e-mailul", moved here unchanged. */
function DocumentsTab({ row }: { row: Row }) {
  if (!isScriptFormRegistration(row)) return <p className="ins-empty">{INSCRIERI_PENDING_COPY.noDocuments}</p>;
  return (
    <>
      <RegistrationDocuments row={row} />
      <RegistrationEmail row={row} />
    </>
  );
}

/** Istoric (spec 1.6, 3.3): newest first; date and time, who, then the line. */
function HistoryTab({ data }: { data: PanelData }) {
  if (data.failed) return <p className="ins-empty">{INSCRIERI_PENDING_COPY.loadFailed}</p>;
  if (!data.history) return <Loading />;
  return (
    <ol className="ins-his">
      {data.history.map((line, i) => (
        <li key={`${line.at}-${i}`}>
          <span className="ins-his-h">{historyHead(line, fmtDateTime)}</span>
          <span>{line.text}</span>
        </li>
      ))}
    </ol>
  );
}

export function PanelBody({ tab, row, api, data }: { tab: PanelTab; row: Row; api: TableApi; data: PanelData }) {
  if (tab === 'abonament') return <RowsView rows={abonamentTabRows(row)} />;
  if (tab === 'documente') return <DocumentsTab row={row} />;
  if (tab === 'istoric') return <HistoryTab data={data} />;
  return <DateTab row={row} api={api} />;
}
```

- [ ] **Step 5: Write the header, the menu and the panel**

`src/admin/dashboard/inscrieri/PanelMenu.tsx`:

```tsx
import * as React from 'react';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Button, Field, Modal, Select } from '../../ui';
import { MenuButton, type Row, type TableApi } from '../SubmissionTable';
import { LIST_COPY, PANEL_COPY } from '../../../club/inscrieri-copy';
import { CLUB_URLS, menuItems, moveTargets, readListMeta, type ListMeta, type MenuItem } from '../../../club/inscrieri-panel';
import { moveSchool } from './moves';
import { runUndo } from './undo';
import { useStableClient } from './useClient';

const MENU_LABELS: Record<MenuItem, string> = { undo: PANEL_COPY.undo, move: PANEL_COPY.moveSchool, delete: PANEL_COPY.delete };

type DialogProps = { row: Row; api: TableApi; onClose: () => void };

/** "Anulează confirmarea" asks first (spec 4.6; dialog copy: spec Open 3). */
function UndoDialog({ row, api, onClose }: DialogProps) {
  const { post } = useStableClient();
  const [busy, setBusy] = React.useState(false);
  const c = PANEL_COPY.undoDialog;
  const confirm = async () => {
    setBusy(true);
    await runUndo(post, row.documentId);
    setBusy(false);
    onClose();
    api.refetch();
  };
  return <ConfirmDialog open title={c.title} message={c.message} confirmLabel={c.confirm} tone="danger" busy={busy} onConfirm={() => void confirm()} onCancel={onClose} />;
}

/** "Mută la altă școală" for one registration (spec 3.6); the server keeps the number, the PDFs and the subscription choice. */
function MoveSchoolDialog({ row, api, meta, onClose }: DialogProps & { meta: ListMeta }) {
  const { post } = useStableClient();
  const [target, setTarget] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const school = meta.schools.find((s) => s.documentId === target);
  const move = async () => {
    if (!school) return;
    setBusy(true);
    const ok = await moveSchool(post, CLUB_URLS.moveSchool(row.documentId), { sectionId: school.documentId }, school.name, true);
    setBusy(false);
    if (!ok) return;
    onClose();
    api.refetch();
  };
  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={busy}>{PANEL_COPY.cancel}</Button>
      <Button onClick={() => void move()} loading={busy} disabled={!school}>{LIST_COPY.move}</Button>
    </>
  );
  return (
    <Modal open onClose={onClose} dismissable={!busy} title={PANEL_COPY.moveSchool} footer={footer}>
      <Field label={PANEL_COPY.schoolField}>
        <Select value={target} onChange={setTarget} options={moveTargets(meta, row.schoolId)} />
      </Field>
    </Modal>
  );
}

/** The panel "..." menu (spec 3.3): "Anulează confirmarea", "Mută la altă școală", "Șterge înscrierea". */
export function PanelMenu({ row, api }: { row: Row; api: TableApi }) {
  const [open, setOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<'undo' | 'move' | null>(null);
  const meta = readListMeta(api.pageMeta);
  const pick = (item: MenuItem) => {
    setOpen(false);
    if (item === 'delete') api.removeRow(row.documentId);
    else setDialog(item);
  };
  return (
    <>
      <MenuButton label={PANEL_COPY.more} open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="sbt-menu" role="menu">
        {menuItems(row, meta.multipleSchools).map((item) => (
          <button key={item} type="button" role="menuitem" className={item === 'delete' ? 'ins-danger' : undefined} onClick={() => pick(item)}>
            {MENU_LABELS[item]}
          </button>
        ))}
      </MenuButton>
      {dialog === 'undo' && <UndoDialog row={row} api={api} onClose={() => setDialog(null)} />}
      {dialog === 'move' && <MoveSchoolDialog row={row} api={api} meta={meta} onClose={() => setDialog(null)} />}
    </>
  );
}
```

`src/admin/dashboard/inscrieri/PanelHeader.tsx`:

```tsx
import * as React from 'react';
import { fmtDateTime, type Row, type TableApi } from '../SubmissionTable';
import { PANEL_COPY } from '../../../club/inscrieri-copy';
import { cellText } from '../../../club/inscrieri-panel';
import { PanelMenu } from './PanelMenu';

/**
 * Fixed panel header (spec 3.3): name, status badge, "..." menu; "Nr. 2026-0142", "Trimis 3 oct 2026, 14:22";
 * then the status menu "Nou" / "Contactat" / "Respins" (Needs decision 1, option A; none on a Confirmat row).
 */
export function PanelHeader({ row, api }: { row: Row; api: TableApi }) {
  const nr = cellText(row.registrationNumber);
  return (
    <div className="ins-ph">
      <div className="ins-ph-top">
        <b className="ins-ph-name">{cellText(row.childName)}</b>
        {api.statusTag(row)}
        <PanelMenu row={row} api={api} />
      </div>
      <div className="ins-ph-meta">
        {nr && (
          <span>
            {PANEL_COPY.number} <b className="ui-num">{nr}</b>
          </span>
        )}
        <span>
          {PANEL_COPY.submitted} <b>{fmtDateTime(row.submittedAt)}</b>
        </span>
      </div>
      {api.statusBox(row)}
    </div>
  );
}
```

Note: the backend has no Prettier config; keep the two `<b>` lines as written (the test reads them).

`src/admin/dashboard/inscrieri/RegistrationPanel.tsx`:

```tsx
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Tabs } from '../../ui';
import { DetailBody, DetailFooter, type Row, type TableApi } from '../SubmissionTable';
import { PANEL_COPY } from '../../../club/inscrieri-copy';
import { athleteRecordPath, footerActions, isPanelTab, linkedAthleteId, panelTabs, panelVersion, type PanelTab } from '../../../club/inscrieri-panel';
import { PanelHeader } from './PanelHeader';
import { PanelBody } from './PanelTabs';
import { usePanelData } from './usePanelData';

type FooterProps = { row: Row; api: TableApi; onConfirm?: () => void };

/** Fixed footer (spec 3.3): "Contactat" and "Confirmă înscrierea" before confirmation, "Deschide fișa sportivului" after. */
function PanelFooter({ row, api, onConfirm }: FooterProps) {
  const navigate = useNavigate();
  const actions = footerActions(row);
  const athleteId = linkedAthleteId(row);
  return (
    <DetailFooter>
      <span className="ins-foot">
        {actions.contactat && (
          <Button size="sm" variant="secondary" onClick={() => api.saveField(row.documentId, 'status', 'Contactat')}>
            {PANEL_COPY.contactat}
          </Button>
        )}
        {actions.confirm && (
          <Button size="sm" onClick={onConfirm} disabled={!onConfirm}>
            {PANEL_COPY.confirm}
          </Button>
        )}
        {actions.openAthlete && athleteId && (
          <Button size="sm" variant="secondary" onClick={() => navigate(athleteRecordPath(athleteId))}>
            {PANEL_COPY.openAthlete}
          </Button>
        )}
      </span>
    </DetailFooter>
  );
}

/** The Înscrieri panel (spec 3.3): fixed header, tabs, scrolling body, fixed footer. Keyed by the registration. */
export function RegistrationPanel({ row, api }: { row: Row; api: TableApi }) {
  const [tab, setTab] = React.useState<PanelTab>('date');
  const data = usePanelData(row.documentId, panelVersion(row));
  return (
    <div className="ins-panel">
      <PanelHeader row={row} api={api} />
      <Tabs
        className="ins-tabs"
        items={panelTabs(row, data.history ? data.history.length : null)}
        value={tab}
        onChange={(id) => isPanelTab(id) && setTab(id)}
      />
      <DetailBody>
        <PanelBody tab={tab} row={row} api={api} data={data} />
      </DetailBody>
      <PanelFooter row={row} api={api} />
    </div>
  );
}
```

- [ ] **Step 6: Use the panel in `InscrieriPage.tsx`**

Replace the import block:

```tsx
import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '../ui';
import SubmissionTablePage, {
  DetailBody,
  DetailField,
  DetailFooter,
  DetailHeader,
  fmtDateTime,
  fmtDateShort,
  type ColumnDef,
  type Row,
  type SubmissionTableCfg,
  type SubmissionTableExtras,
  type TableApi,
} from './SubmissionTable';
import { isScriptFormRegistration, registrationPanelRows } from '../../club/registration-panel';
```

with:

```tsx
import * as React from 'react';
import { useLocation } from 'react-router-dom';
import SubmissionTablePage, {
  fmtDateShort,
  type ColumnDef,
  type Row,
  type SubmissionTableCfg,
  type SubmissionTableExtras,
  type TableApi,
} from './SubmissionTable';
```

Replace:

```tsx
import { BlankFormsMenu } from './inscrieri/BlankFormsMenu';
import { EditableAnswer } from './inscrieri/EditableAnswer';
import { BulkMoveSchool, ExistingFilter, SchoolTabs } from './inscrieri/ListControls';
import { RegistrationDocuments } from './inscrieri/RegistrationDocuments';
import { RegistrationEmail } from './inscrieri/RegistrationEmail';
```

with:

```tsx
import { BlankFormsMenu } from './inscrieri/BlankFormsMenu';
import { BulkMoveSchool, ExistingFilter, SchoolTabs } from './inscrieri/ListControls';
import { RegistrationPanel } from './inscrieri/RegistrationPanel';
```

Replace everything from the line `/** Answers as label/value rows (src/club/registration-panel.ts), the long texts after a gap. Replaced by the tabs in Task 6. */` down to and including the closing `};` of `renderDetail` with:

```tsx
/** The panel (spec 3.3): header, match card, tabs, footer, confirm window. Keyed so its state resets per registration. */
const renderDetail = (row: Row, api: TableApi) => <RegistrationPanel key={row.documentId} row={row} api={api} />;
```

- [ ] **Step 7: Remove the old rows API**

Delete `src/admin/dashboard/inscrieri/EditableAnswer.tsx` (`git rm`). Before editing, confirm nothing else imports what goes: `grep -rn "registrationPanelRows\|MEMBERSHIP_EDIT_OPTIONS\|PanelEdit\|PanelRows\|PanelRow\b\|EditableAnswer" src` lists only `src/club/registration-panel.ts` and `src/club/__tests__/registration-panel.test.ts`; also check `MISSING\b` matches only those two files (`MISSING_FIELDS_ERROR` and `MISSING_FIELD_WORDS` are other names).

In `src/club/registration-panel.ts`, replace everything from the first line down to (not including) the line `/** The PDFs a registration has: the Acord always, the Cerere de adeziune when the answer was Da. */` with:

```ts
import { MEMBERSHIP_YES, RELATIONSHIP_OPTIONS, RELATIONSHIP_OTHER, SOURCE_OTHER } from './registration-form-options';

/**
 * Registration pieces shared by the Înscrieri panel, the Sheet and the history texts: answer texts, the
 * document kinds and the e-mail block (plan 2F). The panel's tab rows live in src/club/inscrieri-panel.ts.
 * Pure, so the admin page and the tests share it.
 */

/** Mirrors `DocumentKind` of src/club/documents (plan 2D). */
export type PanelDocumentKind = 'acord' | 'adeziune';
export type RegistrationRow = Record<string, unknown>;

/**
 * `data` of GET .../email-status and POST .../resend-email (plan 2F, `RegistrationEmailStatus`):
 * the latest job ('none' before the first one), the address a resend goes to and the PDF file
 * names it would carry.
 */
export type EmailStatus = {
  status: 'queued' | 'sent' | 'failed' | 'none';
  recipient: string;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  updatedAt: string | null;
  documents: string[];
};

export const DOCUMENT_LABELS: Record<PanelDocumentKind, string> = { acord: 'Acord', adeziune: 'Cerere de adeziune' };

/** Calitate options of "Editează" ("Alta" without the form's request to specify); the history texts use them too. */
export const RELATIONSHIP_EDIT_OPTIONS = RELATIONSHIP_OPTIONS.map((o) => ({
  value: o.value,
  label: o.value === RELATIONSHIP_OTHER ? 'Alta' : o.label,
}));

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** New registrations carry the script form's answers; old ones have them empty. */
export function isScriptFormRegistration(r: RegistrationRow): boolean {
  return text(r.relationship) !== '' || text(r.membershipAnswer) !== '';
}

export function relationshipText(r: RegistrationRow): string {
  if (r.relationship === RELATIONSHIP_OTHER) return text(r.relationshipOther) || 'Alta';
  return RELATIONSHIP_OPTIONS.find((o) => o.value === r.relationship)?.label ?? '';
}

export function subscriptionText(choice: unknown): string {
  if (!choice || typeof choice !== 'object') return '';
  const { priceItemName, price } = choice as { priceItemName?: unknown; price?: unknown };
  const name = text(priceItemName);
  return name && typeof price === 'number' ? `${name}, ${price} RON` : name;
}

export function sourceText(r: RegistrationRow): string {
  const source = text(r.source);
  const other = text(r.sourceOther);
  return source === SOURCE_OTHER && other ? `${source}: ${other}` : source;
}

```

In `src/club/__tests__/registration-panel.test.ts`, replace the import block (`import { ... } from '../registration-panel';`) with:

```ts
import {
  RELATIONSHIP_EDIT_OPTIONS,
  emailPanelState,
  emailStatusText,
  fileNameFrom,
  formatEmailSentAt,
  readEmailStatus,
  registrationDocumentKinds,
  failedEmailError,
  relationshipText,
  requestErrorText,
  resendTarget,
  resendToast,
  sourceText,
  subscriptionText,
  type EmailStatus,
} from '../registration-panel';
```

and replace everything from `const value = (rows: { label: string; value: string }[], label: string) => rows.find((r) => r.label === label)?.value;` down to the closing `});` of `describe('registrationPanelRows', ...)` with:

```ts
describe('answer texts (shared by the panel tabs, the Sheet and the history)', () => {
  it('Calitate, the subscription choice and the source as the panel shows them', () => {
    expect(relationshipText(scriptForm)).toBe('Bunică');
    expect(relationshipText({ ...scriptForm, relationship: 'tutore' })).toBe('Tutore Legal');
    expect(relationshipText({})).toBe('');
    expect(subscriptionText(scriptForm.subscriptionChoice)).toBe('Abonament 8 ședințe grup, 590 RON');
    expect(sourceText(scriptForm)).toBe('Altele: Ziar');
  });

  it('Calitate options of "Editează"', () => {
    expect(RELATIONSHIP_EDIT_OPTIONS).toEqual([
      { value: 'parinte', label: 'Părinte' },
      { value: 'tutore', label: 'Tutore Legal' },
      { value: 'alta', label: 'Alta' },
    ]);
  });
});
```

- [ ] **Step 8: Run the tests and checks**

Run: `npx vitest run src/club/__tests__/admin-inscrieri-panel.test.ts src/club/__tests__/registration-panel.test.ts src/club/__tests__/inscrieri-panel.test.ts && npx tsc --noEmit -p src/admin/tsconfig.json && npx tsc --noEmit && node scripts/admin-ui-check.mjs --strict`
Expected: PASS; zero type errors; checker exit 0 "all 0".

- [ ] **Step 9: Commit**

```bash
git rm src/admin/dashboard/inscrieri/EditableAnswer.tsx
git add src/admin/dashboard/InscrieriPage.tsx src/admin/dashboard/inscrieri/RegistrationPanel.tsx src/admin/dashboard/inscrieri/PanelHeader.tsx src/admin/dashboard/inscrieri/PanelMenu.tsx src/admin/dashboard/inscrieri/PanelTabs.tsx src/admin/dashboard/inscrieri/RowsView.tsx src/admin/dashboard/inscrieri/DateTab.tsx src/admin/dashboard/inscrieri/usePanelData.ts src/admin/dashboard/inscrieri/undo.ts src/club/registration-panel.ts src/club/__tests__/registration-panel.test.ts src/club/__tests__/admin-inscrieri-panel.test.ts
git commit -m "feat(admin): Înscrieri panel with tabs, header menu, status menu and footer"
```

---

### Task 7: Match card in the panel and the comparison table

**Files:**
- Create: `src/admin/dashboard/inscrieri/CompareTable.tsx`, `src/admin/dashboard/inscrieri/MatchCard.tsx`
- Modify: `src/admin/dashboard/inscrieri/RegistrationPanel.tsx` (mount the card)
- Test: `src/club/__tests__/admin-inscrieri-match.test.ts`

**Interfaces:**
- Consumes: Task 1 (`MATCH_COPY`, `CONFIRM_COPY`, `athleteRecordPath`, `initials`, `lastGroupText`, `showMatchCard`); Task 6 (`RegistrationPanel`, `usePanelData`); plan 3-1 `Checkbox`, icons `IconChevronDown`, `IconChevronUp`, `IconChevronRight` (`src/admin/ui/icons`); plan 3-2 `RegistrationMatchView`, `ComparisonRow`, `AthleteField`.
- Produces:
  - `type CompareTicks = { selected: AthleteField[]; onTick: (field: AthleteField, on: boolean) => void }`
  - `CompareTable({ rows: ComparisonRow[]; ticks?: CompareTicks })`: columns "" | "În fișă" | "În înscriere" (| "Actualizează" ticks on differing rows when `ticks` is given); a differing row has a light background only (`tr.is-diff`), no bold, no count text; empty cells blank; scrolls sideways in its wrapper (the confirm window sets `min-width:520px`, spec 4.8).
  - `MatchCard({ view })`: initials, "Sportiv existent", last group or "Ultima înscriere: <sezon>", the line "În formular: nu a participat sezonul trecut." when the form says so; "Compară" / "Ascunde"; "Deschide fișa completă" opens the record in the same tab. Shown above the tabs only while unconfirmed (`showMatchCard`).

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/admin-inscrieri-match.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const dir = join(__dirname, '..', '..', 'admin', 'dashboard', 'inscrieri');
const read = (name: string) => readFileSync(join(dir, name), 'utf8');
const table = read('CompareTable.tsx');
const card = read('MatchCard.tsx');
const panel = read('RegistrationPanel.tsx');

it('the card shows only while unconfirmed, above the tabs (spec 3.3)', () => {
  expect(panel).toContain('{showMatchCard(data.match) && data.match && <MatchCard view={data.match} />}');
  expect(panel.indexOf('<MatchCard')).toBeGreaterThan(panel.indexOf('<PanelHeader'));
  expect(panel.indexOf('<MatchCard')).toBeLessThan(panel.indexOf('<Tabs'));
});

it('card: initials, "Sportiv existent", last group, the last-season line, Compară / Ascunde, the record link', () => {
  expect(card).toContain('{initials(card.name)}');
  expect(card).toContain('{lastGroupText(card)}');
  expect(card).toContain('{view.notAttendedLastSeason && <span>{MATCH_COPY.notAttended}</span>}');
  expect(card).toContain('{open ? MATCH_COPY.hide : MATCH_COPY.compare}');
  expect(card).toContain('<CompareTable rows={view.comparison} />');
  expect(card).toContain('navigate(athleteRecordPath(card.documentId))');
});

it('table: light background only on differences, ticks only in the window on differing rows', () => {
  expect(table).toContain("className={r.differs ? 'is-diff' : undefined}");
  expect(table).not.toContain('<b>');
  expect(table).toContain('{ticks && (');
  expect(table).toContain('{r.differs && (');
  expect(table).toContain('label={CONFIRM_COPY.update}');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/admin-inscrieri-match.test.ts`
Expected: FAIL with "ENOENT ... CompareTable.tsx".

- [ ] **Step 3: Write the table and the card**

`src/admin/dashboard/inscrieri/CompareTable.tsx`:

```tsx
import * as React from 'react';
import { Checkbox } from '../../ui';
import type { AthleteField } from '../../../club/athlete-data';
import type { ComparisonRow } from '../../../club/confirm/compare';
import { CONFIRM_COPY, MATCH_COPY } from '../../../club/inscrieri-copy';

export type CompareTicks = { selected: AthleteField[]; onTick: (field: AthleteField, on: boolean) => void };

/**
 * "În fișă" / "În înscriere" (spec 3.3, 4.2): differences on a light background only, empty cells blank.
 * With `ticks` (the confirm window) each differing row gets an "Actualizează" tick.
 */
export function CompareTable({ rows, ticks }: { rows: ComparisonRow[]; ticks?: CompareTicks }) {
  return (
    <div className="ins-cmp-wrap">
      <table className="ins-cmp">
        <thead>
          <tr>
            <th aria-hidden="true" />
            <th>{MATCH_COPY.inRecord}</th>
            <th>{MATCH_COPY.inRegistration}</th>
            {ticks && <th aria-hidden="true" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.field} className={r.differs ? 'is-diff' : undefined}>
              <td>{r.label}</td>
              <td>{r.athlete}</td>
              <td>{r.registration}</td>
              {ticks && (
                <td>
                  {r.differs && (
                    <Checkbox checked={ticks.selected.includes(r.field)} onChange={(on) => ticks.onTick(r.field, on)} label={CONFIRM_COPY.update} />
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`src/admin/dashboard/inscrieri/MatchCard.tsx`:

```tsx
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconChevronDown, IconChevronRight, IconChevronUp } from '../../ui/icons';
import type { RegistrationMatchView } from '../../../club/athletes/api-types';
import { MATCH_COPY } from '../../../club/inscrieri-copy';
import { athleteRecordPath, initials, lastGroupText } from '../../../club/inscrieri-panel';
import { CompareTable } from './CompareTable';

/**
 * "Sportiv existent" card above the tabs (spec 3.3), only while unconfirmed: no levels, no ticks, no count;
 * "Deschide fișa completă" opens the record in the same tab (gaps #33).
 */
export function MatchCard({ view }: { view: RegistrationMatchView }) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const card = view.existing;
  if (!card) return null;
  return (
    <div className="ins-mcard">
      <div className="ins-mcard-top">
        <span className="ins-av">{initials(card.name)}</span>
        <span className="ins-acard-t">
          <b>{MATCH_COPY.existing}</b>
          <span>{lastGroupText(card)}</span>
          {view.notAttendedLastSeason && <span>{MATCH_COPY.notAttended}</span>}
        </span>
        <button type="button" className="ins-link" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? MATCH_COPY.hide : MATCH_COPY.compare}
          {open ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
        </button>
      </div>
      {open && (
        <div className="ins-mcard-body">
          <CompareTable rows={view.comparison} />
          <button type="button" className="ins-link ins-right" onClick={() => navigate(athleteRecordPath(card.documentId))}>
            {MATCH_COPY.openFull}
            <IconChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Mount the card**

In `src/admin/dashboard/inscrieri/RegistrationPanel.tsx` replace:

```tsx
import { athleteRecordPath, footerActions, isPanelTab, linkedAthleteId, panelTabs, panelVersion, type PanelTab } from '../../../club/inscrieri-panel';
import { PanelHeader } from './PanelHeader';
```

with:

```tsx
import { athleteRecordPath, footerActions, isPanelTab, linkedAthleteId, panelTabs, panelVersion, showMatchCard, type PanelTab } from '../../../club/inscrieri-panel';
import { MatchCard } from './MatchCard';
import { PanelHeader } from './PanelHeader';
```

and replace:

```tsx
      <PanelHeader row={row} api={api} />
```

with:

```tsx
      <PanelHeader row={row} api={api} />
      {showMatchCard(data.match) && data.match && <MatchCard view={data.match} />}
```

- [ ] **Step 5: Run the test and checks**

Run: `npx vitest run src/club/__tests__/admin-inscrieri-match.test.ts src/club/__tests__/admin-inscrieri-panel.test.ts && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS; zero type errors; checker exit 0 "all 0".

- [ ] **Step 6: Commit**

```bash
git add src/admin/dashboard/inscrieri/CompareTable.tsx src/admin/dashboard/inscrieri/MatchCard.tsx src/admin/dashboard/inscrieri/RegistrationPanel.tsx src/club/__tests__/admin-inscrieri-match.test.ts
git commit -m "feat(admin): Sportiv existent card with the comparison table"
```

---

### Task 8: "Editează" in the Date tab

**Files:**
- Create: `src/admin/dashboard/inscrieri/EditForm.tsx`
- Modify: `src/admin/dashboard/inscrieri/DateTab.tsx` (whole file below)
- Test: `src/club/__tests__/admin-inscrieri-edit.test.ts`

**Interfaces:**
- Consumes: Task 2 (`editFields`, `visibleFields`, `initialDraft`, `editPatch`, `editToast`, `EditDraft`, `EditField`); Task 1 (`PANEL_COPY`, `EDIT_TOASTS`, `CLUB_URLS.edit`, `dateTabRows`); Task 5 (`useStableClient`, `IconEdit`); Task 6 (`PanelExtras`, `TableApi.refetch`); plan 3-1 `BirthDatePicker`, `Select`, `Field`, `Input`, `Textarea`, `Checkbox`, `Button`, `adminToast`; plan 3-2 PUT `/api/forms/inscrieri/:documentId`, `requestErrorText`.
- Produces: `EditForm({ row, api, onDone })`; `DateTab` with one "Editează" link on the first field row (no extra row, spec 3.4); "Salvează" / "Anulează"; save sends one PUT with the changed answers only (an empty patch toasts "Nicio modificare." without a request), toasts from `editToast`, never an e-mail prompt, then reloads the list (the age, the "Sportiv existent" line and the panel data follow).

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/admin-inscrieri-edit.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const dir = join(__dirname, '..', '..', 'admin', 'dashboard', 'inscrieri');
const form = readFileSync(join(dir, 'EditForm.tsx'), 'utf8');
const dateTab = readFileSync(join(dir, 'DateTab.tsx'), 'utf8');

it('"Editează" sits on the first field row, no extra row (spec 3.4)', () => {
  expect(dateTab).toContain('label={i === 0 ? <EditLabel label={r.label} onEdit={() => setEditing(true)} /> : r.label}');
  expect(dateTab).toContain('if (editing) return <EditForm row={row} api={api} onDone={() => setEditing(false)} />;');
});

it('one form: the birth date picker, the wish under "Abonament", Salvează / Anulează', () => {
  expect(form).toContain('<BirthDatePicker value={draft.birth}');
  expect(form).toContain('birthTouched: true');
  expect(form).toContain('{abonament.length > 0 && <div className="ins-edit-h">{PANEL_COPY.abonamentHeading}</div>}');
  expect(form).toContain('{PANEL_COPY.save}');
  expect(form).toContain('{PANEL_COPY.cancel}');
});

it('saves the changed answers in one PUT, toasts from the answer, reloads; never an e-mail', () => {
  expect(form).toContain('const { patch, error: refused } = editPatch(row, fields, draft);');
  expect(form).toContain('if (Object.keys(patch).length === 0) {');
  expect(form).toContain('await put(CLUB_URLS.edit(row.documentId), patch)');
  expect(form).toContain('const toast = editToast(res.data);');
  expect(form).toContain('api.refetch();');
  expect(form).not.toMatch(/resend|Retrimite/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/admin-inscrieri-edit.test.ts`
Expected: FAIL with "ENOENT ... EditForm.tsx".

- [ ] **Step 3: Write the form**

`src/admin/dashboard/inscrieri/EditForm.tsx`:

```tsx
import * as React from 'react';
import { BirthDatePicker, Button, Checkbox, Field, Input, Select, Textarea, adminToast } from '../../ui';
import type { Row, TableApi } from '../SubmissionTable';
import { EDIT_TOASTS, PANEL_COPY } from '../../../club/inscrieri-copy';
import { editFields, editPatch, editToast, initialDraft, visibleFields, type EditDraft, type EditField } from '../../../club/inscrieri-edit';
import { CLUB_URLS } from '../../../club/inscrieri-panel';
import { requestErrorText } from '../../../club/registration-panel';
import { useStableClient } from './useClient';

type SetDraft = React.Dispatch<React.SetStateAction<EditDraft>>;
type ControlProps = { field: EditField; draft: EditDraft; setDraft: SetDraft };

function EditControl({ field, draft, setDraft }: ControlProps) {
  const value = draft.text[field.key] ?? '';
  const setText = (v: string) => setDraft((d) => ({ ...d, text: { ...d.text, [field.key]: v } }));
  if (field.kind === 'birthDate') {
    return <BirthDatePicker value={draft.birth} onChange={(birth) => setDraft((d) => ({ ...d, birth, birthTouched: true }))} />;
  }
  if (field.kind === 'select') return <Select value={value} onChange={setText} options={[...(field.options ?? [])]} />;
  if (field.kind === 'textarea') return <Textarea rows={3} value={value} onChange={(e) => setText(e.target.value)} />;
  return <Input value={value} inputMode={field.kind === 'height' ? 'numeric' : undefined} onChange={(e) => setText(e.target.value)} />;
}

function EditRow({ field, draft, setDraft, error }: ControlProps & { error: string | null }) {
  if (field.kind === 'bool') {
    const setBool = (on: boolean) => setDraft((d) => ({ ...d, bools: { ...d.bools, [field.key]: on } }));
    return (
      <div className="sbt-fld">
        <Checkbox checked={draft.bools[field.key] === true} onChange={setBool} label={field.label} />
      </div>
    );
  }
  return (
    <Field label={field.label} error={field.kind === 'birthDate' && error ? error : undefined} className="sbt-fld">
      <EditControl field={field} draft={draft} setDraft={setDraft} />
    </Field>
  );
}

/** One PUT with the changed answers (spec 3.4): the server rebuilds the PDFs and writes old → new; no e-mail. */
function useEditSave(row: Row, api: TableApi, onDone: () => void) {
  const { put } = useStableClient();
  const [busy, setBusy] = React.useState(false);
  const run = async (patch: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await put(CLUB_URLS.edit(row.documentId), patch);
      const toast = editToast(res.data);
      adminToast[toast.tone](toast.text);
      onDone();
      api.refetch();
    } catch (err) {
      adminToast.error(requestErrorText(err, PANEL_COPY.saveFailed));
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/** "Editează" (spec 3.4): every answer at once; the wish last under "Abonament"; consents, number and date sent stay. */
export function EditForm({ row, api, onDone }: { row: Row; api: TableApi; onDone: () => void }) {
  const fields = React.useMemo(() => editFields(row), [row]);
  const [draft, setDraft] = React.useState<EditDraft>(() => initialDraft(row, fields));
  const [error, setError] = React.useState<string | null>(null);
  const save = useEditSave(row, api, onDone);
  const submit = () => {
    const { patch, error: refused } = editPatch(row, fields, draft);
    setError(refused);
    if (refused) return;
    if (Object.keys(patch).length === 0) {
      adminToast.info(EDIT_TOASTS.unchanged);
      onDone();
      return;
    }
    void save.run(patch);
  };
  const shown = visibleFields(fields, draft);
  const main = shown.filter((f) => !f.section);
  const abonament = shown.filter((f) => f.section === 'abonament');
  const rowOf = (f: EditField) => <EditRow key={f.key} field={f} draft={draft} setDraft={setDraft} error={error} />;
  return (
    <div className="ins-edit">
      {main.map(rowOf)}
      {abonament.length > 0 && <div className="ins-edit-h">{PANEL_COPY.abonamentHeading}</div>}
      {abonament.map(rowOf)}
      <div className="ins-edit-actions">
        <Button size="sm" variant="secondary" onClick={onDone} disabled={save.busy}>{PANEL_COPY.cancel}</Button>
        <Button size="sm" onClick={submit} loading={save.busy}>{PANEL_COPY.save}</Button>
      </div>
    </div>
  );
}
```

Note: `EditForm` is about 30 lines with its JSX; if the reviewer counts it over the limit, move the two `filter` lines and `rowOf` into a `FieldList({ fields, draft, setDraft, error })` component in the same file.

- [ ] **Step 4: Rewrite `src/admin/dashboard/inscrieri/DateTab.tsx`**

```tsx
import * as React from 'react';
import { DetailField, type Row, type TableApi } from '../SubmissionTable';
import { PANEL_COPY } from '../../../club/inscrieri-copy';
import { dateTabRows } from '../../../club/inscrieri-panel';
import { EditForm } from './EditForm';
import { IconEdit } from './icons';

/** "Sezon", "Arhivare", custom answers and "Notă internă", after the answers (Needs decision 1, option A). */
export function PanelExtras({ row, api }: { row: Row; api: TableApi }) {
  return (
    <div className="ins-extra">
      {api.seasonField(row)}
      <DetailField label={PANEL_COPY.archiveField}>{row.archived ? PANEL_COPY.archived : PANEL_COPY.active}</DetailField>
      {api.customFields(row)}
      {api.internalNoteField(row)}
    </div>
  );
}

/** The first row's label with the "Editează" link on its right (spec 3.4: no extra row). */
function EditLabel({ label, onEdit }: { label: string; onEdit: () => void }) {
  return (
    <span className="ins-label-row">
      <span>{label}</span>
      <button type="button" className="ins-link" onClick={onEdit}>
        <IconEdit size={12} />
        {PANEL_COPY.edit}
      </button>
    </span>
  );
}

/** Date tab (spec 3.3, 3.4): the form's answers in form order, or the "Editează" form. */
export function DateTab({ row, api }: { row: Row; api: TableApi }) {
  const [editing, setEditing] = React.useState(false);
  if (editing) return <EditForm row={row} api={api} onDone={() => setEditing(false)} />;
  return (
    <>
      {dateTabRows(row).map((r, i) => (
        <DetailField key={r.key} label={i === 0 ? <EditLabel label={r.label} onEdit={() => setEditing(true)} /> : r.label}>
          {r.value}
        </DetailField>
      ))}
      <PanelExtras row={row} api={api} />
    </>
  );
}
```

- [ ] **Step 5: Run the tests and checks**

Run: `npx vitest run src/club/__tests__/admin-inscrieri-edit.test.ts src/club/__tests__/admin-inscrieri-panel.test.ts src/club/__tests__/inscrieri-edit.test.ts && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS; zero type errors; checker exit 0 "all 0".

- [ ] **Step 6: Commit**

```bash
git add src/admin/dashboard/inscrieri/EditForm.tsx src/admin/dashboard/inscrieri/DateTab.tsx src/club/__tests__/admin-inscrieri-edit.test.ts
git commit -m "feat(admin): Editează in the Înscrieri Date tab"
```

---

### Task 9: Confirm window, "Anulează" toast and undo

**Files:**
- Create: `src/admin/dashboard/inscrieri/ConfirmWindow.tsx`, `src/admin/dashboard/inscrieri/confirm/useConfirm.ts`, `src/admin/dashboard/inscrieri/confirm/AthletePart.tsx`, `src/admin/dashboard/inscrieri/confirm/AthleteSearch.tsx`, `src/admin/dashboard/inscrieri/confirm/SeasonPart.tsx`
- Modify: `src/admin/dashboard/inscrieri/RegistrationPanel.tsx` (open the window)
- Test: `src/club/__tests__/admin-inscrieri-confirm.test.ts`

**Interfaces:**
- Consumes: Task 3 (`initialWindow`, `windowReducer`, `contextAthleteId`, `confirmGate`, `confirmBody`, `confirmFailure`, `seasonNote`, `seasonHeading`, `acsLines`, `intentLine`, `mainNowLine`, `groupChoices`, `newAthleteHint`, `CONFIRM_TOAST_MS`, `SEARCH_DEBOUNCE_MS`, types); Task 1 (`CONFIRM_COPY`, `MATCH_COPY`, `INSCRIERI_PENDING_COPY`, `CLUB_URLS`, `athleteRecordPath`, `cardDetailLine`, `cellText`, `initials`, `lastGroupText`); Task 5 (`useStableClient`, `dataOf`); Task 6 (`runUndo`, `usePanelData`); Task 7 (`CompareTable`); plan 3-1 `BottomSheet`, `RadioGroup`, `SearchableSelect` (groups), `Checkbox`, `Field`, `Input`, `Notice`, `Loading`, `adminToast` with `action`; plan 3-2 `ConfirmContext`, `ConfirmResponse`, `AthleteCard`, `RegistrationMatchView`, the confirm-context, confirm and search routes.
- Produces:
  - `ConfirmWindow({ row, view, onClose, onDone })`: `BottomSheet desktop="modal" modalSize="md" fullHeight` titled "Confirmă înscrierea <nr>", footer "Anulează" + "Confirmă înscrierea" (+ the hint when nothing is chosen); sections "Sportiv" and the season block.
  - `useConfirmContext(registrationId, athleteId): { data: ConfirmContext | null; loading: boolean; failed: boolean }`, `useConfirmSubmit(registrationId, onClose, onDone): { busy; run(state, ctx) }`.
  - `type SearchState = { cards: AthleteCard[] | null; failed: boolean }`, `useAthleteSearch(registrationId: string | null, query): SearchState`, `AthleteResultList({ search, query, onPick, onNew })` (reusable by plan 3-5's "Adaugă sportiv", spec P13), `AthleteSearch({ registrationId, query, dispatch })`.
  - Success: the window closes, the list reloads (the panel shows "Confirmat", hides the card, offers "Deschide fișa sportivului"), toast "Înscriere confirmată: <nume>" for 8 seconds with "Anulează" only; its click runs `runUndo` once and reloads, also after the panel is gone. 409: the server text, close, reload. Other failures: "Confirmarea nu a reușit. Nimic nu a fost salvat.", the window stays.

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/admin-inscrieri-confirm.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const dir = join(__dirname, '..', '..', 'admin', 'dashboard', 'inscrieri');
const read = (...p: string[]) => readFileSync(join(dir, ...p), 'utf8');
const panel = read('RegistrationPanel.tsx');
const win = read('ConfirmWindow.tsx');
const hooks = read('confirm', 'useConfirm.ts');
const athlete = read('confirm', 'AthletePart.tsx');
const search = read('confirm', 'AthleteSearch.tsx');
const season = read('confirm', 'SeasonPart.tsx');

it('the panel opens the window once the match data is in', () => {
  expect(panel).toContain('onConfirm={data.match ? () => setConfirming(true) : undefined}');
  expect(panel).toContain('{confirming && data.match && (');
  expect(panel).toContain('onDone={api.refetch}');
});

it('a Modal on desktop, a full-height bottom sheet on phones (spec 4.8)', () => {
  expect(win).toContain('desktop="modal"');
  expect(win).toContain('modalSize="md"');
  expect(win).toContain('fullHeight');
  expect(win).toContain('title={CONFIRM_COPY.title(cellText(row.registrationNumber))}');
  expect(win).toContain('React.useReducer(windowReducer, view, initialWindow)');
  expect(win).toContain('{gate.hint && <span className="ins-foot-hint">{gate.hint}</span>}');
});

it('toast with "Anulează" only, 8 seconds; the undo outlives the panel; 409 closes and reloads', () => {
  expect(hooks).toContain('duration: CONFIRM_TOAST_MS, action: { label: CONFIRM_COPY.undo, onClick: undo }');
  expect(hooks).toContain('const undo = () => void runUndo(post, registrationId).then(onDone);');
  expect(hooks).toContain('if (!failure.close) return;');
  expect(hooks).toContain('await post(CLUB_URLS.confirm(registrationId), body)');
});

it('choice cards, compare with ticks, search in place, "Vezi fișa" in the same tab (spec 4.1, 4.2)', () => {
  expect(athlete).toContain('variant="card"');
  expect(athlete).toContain('value={state.choice}');
  expect(athlete).toContain('<CompareTable rows={ctx.comparison} ticks={ticks} />');
  expect(athlete).toContain('navigate(athleteRecordPath(card.documentId))');
  expect(search).toContain('placeholder={CONFIRM_COPY.searchPlaceholder}');
  expect(search).toContain('{CONFIRM_COPY.noResults(text)}');
  expect(search).toContain('{cardDetailLine(card)}');
});

it('groups under their section, main group line and tick, A.C.S. lines, season note, intent (spec 4.3, 4.4)', () => {
  expect(season).toContain('options={groupChoices(ctx.groups)}');
  expect(season).toContain('placeholder={CONFIRM_COPY.noGroup}');
  expect(season).toContain('label={CONFIRM_COPY.mainTick}');
  expect(season).toContain('{note ? <p className="ins-note">{note}</p> : <GroupAndAcs state={state} dispatch={dispatch} ctx={ctx} />}');
  expect(season).toContain('<p>{acs.status}</p>');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/admin-inscrieri-confirm.test.ts`
Expected: FAIL with "ENOENT ... ConfirmWindow.tsx".

- [ ] **Step 3: Write the hooks**

`src/admin/dashboard/inscrieri/confirm/useConfirm.ts`:

```ts
import * as React from 'react';
import { adminToast } from '../../../ui';
import type { ConfirmContext, ConfirmResponse } from '../../../../club/athletes/api-types';
import { CONFIRM_COPY } from '../../../../club/inscrieri-copy';
import { CONFIRM_TOAST_MS, confirmBody, confirmFailure, type WindowState } from '../../../../club/inscrieri-confirm';
import { CLUB_URLS } from '../../../../club/inscrieri-panel';
import { runUndo } from '../undo';
import { dataOf, useStableClient } from '../useClient';

type ContextState = { data: ConfirmContext | null; loading: boolean; failed: boolean };

/** GET .../confirm-context?athlete= (plan 3-2): reloaded for every chosen athlete; the old answer stays while loading. */
export function useConfirmContext(registrationId: string, athleteId: string | null): ContextState {
  const { get } = useStableClient();
  const [state, setState] = React.useState<ContextState>({ data: null, loading: true, failed: false });
  React.useEffect(() => {
    let off = false;
    setState((s) => ({ ...s, loading: true }));
    get(CLUB_URLS.confirmContext(registrationId, athleteId))
      .then((res) => {
        if (!off) setState({ data: dataOf<ConfirmContext>(res), loading: false, failed: false });
      })
      .catch(() => {
        if (!off) setState({ data: null, loading: false, failed: true });
      });
    return () => {
      off = true;
    };
  }, [get, registrationId, athleteId]);
  return state;
}

/** "Confirmă înscrierea" (spec 4.5 to 4.7): all or nothing on the server; here the toast, the undo and the failures. */
export function useConfirmSubmit(registrationId: string, onClose: () => void, onDone: () => void) {
  const { post } = useStableClient();
  const [busy, setBusy] = React.useState(false);
  const succeed = (res: ConfirmResponse) => {
    onClose();
    onDone();
    const undo = () => void runUndo(post, registrationId).then(onDone);
    adminToast.success(CONFIRM_COPY.confirmed(res.athleteName), { duration: CONFIRM_TOAST_MS, action: { label: CONFIRM_COPY.undo, onClick: undo } });
  };
  const fail = (err: unknown) => {
    const failure = confirmFailure(err);
    adminToast.error(failure.text);
    if (!failure.close) return;
    onClose();
    onDone();
  };
  const run = async (state: WindowState, ctx: ConfirmContext) => {
    const body = confirmBody(state, ctx);
    if (!body) return;
    setBusy(true);
    try {
      succeed(dataOf<ConfirmResponse>(await post(CLUB_URLS.confirm(registrationId), body)));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}
```

- [ ] **Step 4: Write the search**

`src/admin/dashboard/inscrieri/confirm/AthleteSearch.tsx`:

```tsx
import * as React from 'react';
import { Input, Loading } from '../../../ui';
import type { AthleteCard } from '../../../../club/athletes/api-types';
import { CONFIRM_COPY, INSCRIERI_PENDING_COPY } from '../../../../club/inscrieri-copy';
import { SEARCH_DEBOUNCE_MS, type WindowAction } from '../../../../club/inscrieri-confirm';
import { CLUB_URLS, cardDetailLine, initials } from '../../../../club/inscrieri-panel';
import { dataOf, useStableClient } from '../useClient';

export type SearchState = { cards: AthleteCard[] | null; failed: boolean };

/** GET /api/club/athletes/search (plan 3-2); without text: the registration's candidates, the proposed one first. */
export function useAthleteSearch(registrationId: string | null, query: string): SearchState {
  const { get } = useStableClient();
  const [state, setState] = React.useState<SearchState>({ cards: null, failed: false });
  React.useEffect(() => {
    let off = false;
    const timer = window.setTimeout(() => {
      get(CLUB_URLS.athleteSearch(query.trim(), registrationId))
        .then((res) => {
          if (!off) setState({ cards: dataOf<AthleteCard[]>(res), failed: false });
        })
        .catch(() => {
          if (!off) setState({ cards: null, failed: true });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      off = true;
      window.clearTimeout(timer);
    };
  }, [get, registrationId, query]);
  return state;
}

type ListProps = { search: SearchState; query: string; onPick: (card: AthleteCard) => void; onNew: () => void };

/** Two-line rows (spec 4.1): the name, then birth date, last group and parent; nothing found: the line and "Sportiv nou". */
export function AthleteResultList({ search, query, onPick, onNew }: ListProps) {
  if (search.failed) return <p className="ins-empty">{INSCRIERI_PENDING_COPY.loadFailed}</p>;
  if (!search.cards) return <Loading />;
  const text = query.trim();
  const none = search.cards.length === 0;
  if (none && !text) return null;
  return (
    <ul className="ins-res">
      {search.cards.map((card) => (
        <li key={card.documentId}>
          <button type="button" onClick={() => onPick(card)}>
            <span className="ins-av">{initials(card.name)}</span>
            <span className="ins-res-t">
              <b>{card.name}</b>
              <span>{cardDetailLine(card)}</span>
            </span>
          </button>
        </li>
      ))}
      {none && <li className="ins-res-none">{CONFIRM_COPY.noResults(text)}</li>}
      {none && (
        <li>
          <button type="button" onClick={onNew}>
            <span className="ins-res-t">
              <b>{CONFIRM_COPY.newLabel}</b>
            </span>
          </button>
        </li>
      )}
    </ul>
  );
}

/** "Caută alt sportiv" replaces the cards in place (spec 4.1): no second window; "Anulează" goes back. */
export function AthleteSearch({ registrationId, query, dispatch }: { registrationId: string; query: string; dispatch: React.Dispatch<WindowAction> }) {
  const search = useAthleteSearch(registrationId, query);
  return (
    <div className="ins-search">
      <div className="ins-search-bar">
        <Input
          type="search"
          aria-label={CONFIRM_COPY.searchPlaceholder}
          placeholder={CONFIRM_COPY.searchPlaceholder}
          value={query}
          onChange={(e) => dispatch({ type: 'query', text: e.target.value })}
        />
        <button type="button" className="ins-link" onClick={() => dispatch({ type: 'closeSearch' })}>
          {CONFIRM_COPY.cancel}
        </button>
      </div>
      <AthleteResultList search={search} query={query} onPick={(card) => dispatch({ type: 'pick', card })} onNew={() => dispatch({ type: 'pickNew' })} />
    </div>
  );
}
```

- [ ] **Step 5: Write the two sections**

`src/admin/dashboard/inscrieri/confirm/AthletePart.tsx`:

```tsx
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { RadioGroup, type RadioOption } from '../../../ui';
import type { AthleteField } from '../../../../club/athlete-data';
import type { AthleteCard, ConfirmContext, RegistrationMatchView } from '../../../../club/athletes/api-types';
import { CONFIRM_COPY, MATCH_COPY } from '../../../../club/inscrieri-copy';
import { newAthleteHint, type Choice, type WindowAction, type WindowState } from '../../../../club/inscrieri-confirm';
import { athleteRecordPath, initials, lastGroupText } from '../../../../club/inscrieri-panel';
import { CompareTable } from '../CompareTable';
import { AthleteSearch } from './AthleteSearch';

type Dispatch = React.Dispatch<WindowAction>;
type PartProps = { state: WindowState; dispatch: Dispatch; ctx: ConfirmContext };

/** The proposed (or picked) athlete: initials, name, last group, "Vezi fișa" in the same tab (gaps #33). */
function ProposedCard({ card, onLeave }: { card: AthleteCard; onLeave: () => void }) {
  const navigate = useNavigate();
  const open = () => {
    onLeave();
    navigate(athleteRecordPath(card.documentId));
  };
  return (
    <div className="ins-acard">
      <span className="ins-av">{initials(card.name)}</span>
      <span className="ins-acard-t">
        <b>{card.name}</b>
        <span>{lastGroupText(card)}</span>
      </span>
      <button type="button" className="ins-link" onClick={open}>
        {CONFIRM_COPY.viewRecord}
      </button>
    </div>
  );
}

function choiceOptions(ctx: ConfirmContext, notAttended: boolean): RadioOption<Choice>[] {
  const existingHint = (
    <>
      {CONFIRM_COPY.existingHint}
      {notAttended && <span className="ins-hint2">{MATCH_COPY.notAttended}</span>}
    </>
  );
  return [
    { value: 'existing', label: CONFIRM_COPY.existingLabel, hint: existingHint },
    { value: 'new', label: CONFIRM_COPY.newLabel, hint: newAthleteHint(ctx, false) },
  ];
}

type WithAthleteProps = PartProps & { athlete: AthleteCard; notAttended: boolean; onLeave: () => void };

/** Two choice cards, "Compară și actualizează" with the "Actualizează" ticks, "Caută alt sportiv" (spec 4.1, 4.2). */
function WithAthlete({ state, dispatch, ctx, athlete, notAttended, onLeave }: WithAthleteProps) {
  const defaults = ctx.defaultUpdateFields;
  const ticks = { selected: state.ticks ?? defaults, onTick: (field: AthleteField, on: boolean) => dispatch({ type: 'tick', field, on, defaults }) };
  const comparable = ctx.comparison.length > 0;
  return (
    <>
      <ProposedCard card={athlete} onLeave={onLeave} />
      <RadioGroup<Choice> variant="card" aria-label={CONFIRM_COPY.athleteSection} value={state.choice} onChange={(choice) => dispatch({ type: 'choose', choice })} options={choiceOptions(ctx, notAttended)} />
      {state.compareOpen && comparable && <CompareTable rows={ctx.comparison} ticks={ticks} />}
      <div className="ins-links">
        {comparable && (
          <button type="button" className="ins-link" onClick={() => dispatch({ type: 'toggleCompare' })}>
            {state.compareOpen ? CONFIRM_COPY.hide : CONFIRM_COPY.compare}
          </button>
        )}
        <button type="button" className="ins-link" onClick={() => dispatch({ type: 'openSearch' })}>
          {CONFIRM_COPY.searchOther}
        </button>
      </div>
    </>
  );
}

/** No match (spec 4.1): "Sportiv nou" with name and birth date, and "Caută un sportiv existent". */
function NoMatch({ ctx, dispatch }: { ctx: ConfirmContext; dispatch: Dispatch }) {
  return (
    <>
      <div className="ins-acard">
        <span className="ins-av">{initials(ctx.newAthlete.name)}</span>
        <span className="ins-acard-t">
          <b>{CONFIRM_COPY.newLabel}</b>
          <span>{newAthleteHint(ctx, true)}</span>
        </span>
      </div>
      <div className="ins-links">
        <button type="button" className="ins-link" onClick={() => dispatch({ type: 'openSearch' })}>
          {CONFIRM_COPY.searchExisting}
        </button>
      </div>
    </>
  );
}

type AthletePartProps = PartProps & { view: RegistrationMatchView; registrationId: string; onLeave: () => void };

/** Section "Sportiv" (spec 4.1). */
export function AthletePart({ state, dispatch, ctx, view, registrationId, onLeave }: AthletePartProps) {
  const choosing = state.mode === 'choose';
  return (
    <section className="ins-sec">
      <div className="ins-sec-h">{CONFIRM_COPY.athleteSection}</div>
      {!choosing && <AthleteSearch registrationId={registrationId} query={state.query} dispatch={dispatch} />}
      {choosing && state.athlete && (
        <WithAthlete state={state} dispatch={dispatch} ctx={ctx} athlete={state.athlete} notAttended={view.notAttendedLastSeason} onLeave={onLeave} />
      )}
      {choosing && !state.athlete && <NoMatch ctx={ctx} dispatch={dispatch} />}
    </section>
  );
}
```

`src/admin/dashboard/inscrieri/confirm/SeasonPart.tsx`:

```tsx
import * as React from 'react';
import { Checkbox, Field, SearchableSelect } from '../../../ui';
import type { ConfirmContext } from '../../../../club/athletes/api-types';
import { CONFIRM_COPY } from '../../../../club/inscrieri-copy';
import { acsLines, groupChoices, intentLine, mainNowLine, seasonHeading, seasonNote, type WindowAction, type WindowState } from '../../../../club/inscrieri-confirm';

type Props = { state: WindowState; dispatch: React.Dispatch<WindowAction>; ctx: ConfirmContext };

/** Group (school's groups, then Club, under their section names; optional), main group, A.C.S. (spec 4.3, 4.4). */
function GroupAndAcs({ state, dispatch, ctx }: Props) {
  const mainNow = state.choice === 'existing' ? mainNowLine(ctx) : null;
  const acs = acsLines(ctx);
  return (
    <>
      {mainNow && <p className="ins-line">{mainNow}</p>}
      <Field label={CONFIRM_COPY.group}>
        <SearchableSelect
          aria-label={CONFIRM_COPY.group}
          value={state.groupId}
          onChange={(groupId) => dispatch({ type: 'group', groupId })}
          options={groupChoices(ctx.groups)}
          placeholder={CONFIRM_COPY.noGroup}
        />
      </Field>
      {mainNow && <Checkbox checked={state.makeMain} disabled={!state.groupId} onChange={(on) => dispatch({ type: 'main', on })} label={CONFIRM_COPY.mainTick} />}
      {acs && (
        <div className="ins-acs">
          <p>{acs.status}</p>
          <p>{acs.wish}</p>
        </div>
      )}
    </>
  );
}

/** The season block (spec 4.3): heading, then the ended line or group and A.C.S.; the form's abonament as the parent's intent (4.4). */
export function SeasonPart({ state, dispatch, ctx, schoolName }: Props & { schoolName: string | null }) {
  const heading = seasonHeading(ctx, schoolName);
  const note = seasonNote(ctx);
  const intent = intentLine(ctx);
  return (
    <section className="ins-sec">
      {heading && <div className="ins-sec-h">{heading}</div>}
      {note ? <p className="ins-note">{note}</p> : <GroupAndAcs state={state} dispatch={dispatch} ctx={ctx} />}
      {intent && (
        <>
          <div className="ins-sec-h">{CONFIRM_COPY.intentHeading}</div>
          <p className="ins-intent">{intent}</p>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Write the window and open it from the panel**

`src/admin/dashboard/inscrieri/ConfirmWindow.tsx`:

```tsx
import * as React from 'react';
import { BottomSheet, Button, Loading, Notice } from '../../ui';
import type { Row } from '../SubmissionTable';
import type { RegistrationMatchView } from '../../../club/athletes/api-types';
import { CONFIRM_COPY, INSCRIERI_PENDING_COPY } from '../../../club/inscrieri-copy';
import { confirmGate, contextAthleteId, initialWindow, windowReducer, type Gate } from '../../../club/inscrieri-confirm';
import { cellText } from '../../../club/inscrieri-panel';
import { AthletePart } from './confirm/AthletePart';
import { SeasonPart } from './confirm/SeasonPart';
import { useConfirmContext, useConfirmSubmit } from './confirm/useConfirm';

type FooterProps = { gate: Gate; busy: boolean; onCancel: () => void; onConfirm: () => void };

function WindowFooter({ gate, busy, onCancel, onConfirm }: FooterProps) {
  return (
    <>
      {gate.hint && <span className="ins-foot-hint">{gate.hint}</span>}
      <Button variant="secondary" onClick={onCancel} disabled={busy}>{CONFIRM_COPY.cancel}</Button>
      <Button onClick={onConfirm} loading={busy} disabled={gate.disabled}>{CONFIRM_COPY.confirm}</Button>
    </>
  );
}

type Props = { row: Row; view: RegistrationMatchView; onClose: () => void; onDone: () => void };

/** "Confirmă înscrierea <nr>" (spec 4): a Modal on desktop, a full-height bottom sheet on phones (4.8). One at a time. */
export function ConfirmWindow({ row, view, onClose, onDone }: Props) {
  const [state, dispatch] = React.useReducer(windowReducer, view, initialWindow);
  const ctx = useConfirmContext(row.documentId, contextAthleteId(state));
  const submit = useConfirmSubmit(row.documentId, onClose, onDone);
  const gate = confirmGate(state, ctx.data, ctx.loading);
  const confirm = () => {
    if (ctx.data) void submit.run(state, ctx.data);
  };
  const footer = <WindowFooter gate={gate} busy={submit.busy} onCancel={onClose} onConfirm={confirm} />;
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={CONFIRM_COPY.title(cellText(row.registrationNumber))}
      desktop="modal"
      modalSize="md"
      fullHeight
      dismissable={!submit.busy}
      bodyClassName="ins-win"
      footer={footer}
    >
      {ctx.failed && <Notice tone="danger">{INSCRIERI_PENDING_COPY.loadFailed}</Notice>}
      {!ctx.failed && !ctx.data && <Loading />}
      {ctx.data && gate.notice && <Notice tone="warning">{gate.notice}</Notice>}
      {ctx.data && <AthletePart state={state} dispatch={dispatch} ctx={ctx.data} view={view} registrationId={row.documentId} onLeave={onClose} />}
      {ctx.data && <SeasonPart state={state} dispatch={dispatch} ctx={ctx.data} schoolName={cellText(row.schoolName) || null} />}
    </BottomSheet>
  );
}
```

In `src/admin/dashboard/inscrieri/RegistrationPanel.tsx` replace:

```tsx
import { MatchCard } from './MatchCard';
```

with:

```tsx
import { ConfirmWindow } from './ConfirmWindow';
import { MatchCard } from './MatchCard';
```

replace:

```tsx
  const [tab, setTab] = React.useState<PanelTab>('date');
```

with:

```tsx
  const [tab, setTab] = React.useState<PanelTab>('date');
  const [confirming, setConfirming] = React.useState(false);
```

and replace:

```tsx
      <PanelFooter row={row} api={api} />
```

with:

```tsx
      <PanelFooter row={row} api={api} onConfirm={data.match ? () => setConfirming(true) : undefined} />
      {confirming && data.match && (
        <ConfirmWindow row={row} view={data.match} onClose={() => setConfirming(false)} onDone={api.refetch} />
      )}
```

- [ ] **Step 7: Run the tests and checks**

Run: `npx vitest run src/club/__tests__/admin-inscrieri-confirm.test.ts src/club/__tests__/admin-inscrieri-panel.test.ts src/club/__tests__/admin-inscrieri-match.test.ts src/club/__tests__/inscrieri-confirm.test.ts && npx tsc --noEmit -p src/admin/tsconfig.json && npx tsc --noEmit && node scripts/admin-ui-check.mjs --strict`
Expected: PASS; zero type errors; checker exit 0 "all 0".

- [ ] **Step 8: Commit**

```bash
git add src/admin/dashboard/inscrieri/ConfirmWindow.tsx src/admin/dashboard/inscrieri/confirm src/admin/dashboard/inscrieri/RegistrationPanel.tsx src/club/__tests__/admin-inscrieri-confirm.test.ts
git commit -m "feat(admin): confirm window with match choice, comparison, groups, A.C.S. and undo toast"
```

---

### Task 10: Checks, browser pass and renders on a throwaway Postgres

**Files:** none in the repo. Temporary files live in `${TMPDIR:-/tmp}/es34` and are removed at the end. The renders are copied to `/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/phase3-renders/` (prefix `3-4-`) for the user's post-build review; they are not committed by this plan.

**Interfaces:**
- Consumes: everything above, plans 3-1 and 3-2 (routes, `scripts/migrate-athletes-registrations.js --step=match-backfill`).
- Proves (spec 12 browser tests for 3A): the list columns, the "Sportiv existent" line and filter; the panel tabs, match card, "Editează", "..." menu; the confirm window for Sigur (preselected), Probabil (nothing chosen, disabled, hint), no match, search with and without results, grouped group picker, main group line and tick, unreadable birth date, ended season; confirm, toast, undo from the toast after leaving the row, undo from the menu; the concurrent second confirm; `?open=<documentId>`; the phone sheet at full height; two schools: tabs, column, bulk and single move. Nothing tagged by the SaveBar tagger, no page errors.

If port 55436 or 1342 is taken, pick free ones and change them everywhere below (also `B` in `pass.py`). Start Strapi as a background job and poll `/_health`. Log in once per page context (Strapi rate-limits `/admin/login`). Synthetic data only.

- [ ] **Step 1: Full checks**

```bash
cd /Users/codrin/Documents/Programming/edusport_backend
npm test
npx tsc --noEmit
npx tsc --noEmit -p src/admin/tsconfig.json
node scripts/admin-ui-check.mjs --strict
```

Expected: every test PASSES (the ten new files of this plan included), zero type errors in both projects, checker exit 0 with "all 0".

- [ ] **Step 2: Postgres, environment, build**

```bash
T="${TMPDIR:-/tmp}/es34"; mkdir -p "$T/shots"
cat > "$T/env" <<'EOF'
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=55436
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=strapi
HOST=127.0.0.1
PORT=1342
APP_KEYS=throwawayA,throwawayB
API_TOKEN_SALT=throwaway
ADMIN_JWT_SECRET=throwaway
TRANSFER_TOKEN_SALT=throwaway
JWT_SECRET=throwaway
ENCRYPTION_KEY=throwaway
STRAPI_TELEMETRY_DISABLED=true
EOF
docker run -d --name es34-pg -e POSTGRES_USER=strapi -e POSTGRES_PASSWORD=strapi -e POSTGRES_DB=strapi \
  -p 127.0.0.1:55436:5432 postgres:16
until docker exec es34-pg pg_isready -U strapi >/dev/null 2>&1; do sleep 1; done
(set -a; . "$T/env"; set +a; npm run build)
```

Expected: `✔ Building admin panel`; `dist/src/club/` holds the compiled planners the match backfill reads.

- [ ] **Step 3: Synthetic data, saved matches, an admin, Strapi**

The rows cover every state: r1 Maria Dumitrescu (exact name + birth date of an athlete: Sigur; phone differs), r2 Andrei Popescu (no match, Contactat), r3 Sara-Maria Ilie (same birth date and phone as athlete Sara Ilie, one common name word: Probabil, form says "Nu a participat"), r4 Andrei Dumitrescu (Sigur; the athlete already has a main group this season), r5 Luca Stoica (unreadable birth date), r6 Elena Radu (season 2025-2026, ended), r7 Mihai Pop (old registration, no phase 2 answers), r8 Ana Ilie (Respins).

```bash
cat > "$T/fixture.js" <<'EOF'
const { writeFileSync } = require('node:fs');
const { createStrapi, compileStrapi } = require('@strapi/strapi');
(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  const s25 = await d('api::season.season').create({ data: { label: '2025-2026', startMonth: '2025-10-01', endMonth: '2026-05-31', isCurrent: false } });
  const s26 = await d('api::season.season').create({ data: { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', isCurrent: true } });
  const afi = await d('api::section.section').create({ data: { name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', slug: 'afi-cotroceni', publicPage: true, order: 1 } });
  const club = await d('api::section.section').create({ data: { name: 'Club', kind: 'club', slug: 'club', order: 2 } });
  const group = (name, section, order) => d('api::group.group').create({ data: { name, section: section.documentId, order, active: true } });
  const pp = await group('Primii Pași', afi, 1);
  await group('Începători', afi, 2);
  await group('Intermediari Bronze', afi, 3);
  const pro = await group('Profesioniști', club, 1);
  await group('Avansați', club, 2);
  const athlete = (data) => d('api::athlete.athlete').create({ data: { status: 'activ', dataIncomplete: false, ...data } });
  const maria = await athlete({ name: 'Maria Dumitrescu', birthDate: '2014-03-14', contactName: 'Mihaela Dumitrescu', phone: '0722 111 22', email: 'parinte@exemplu.ro' });
  const andrei = await athlete({ name: 'Andrei Dumitrescu', birthDate: '2011-11-02', contactName: 'Mihaela Dumitrescu', phone: '0722 333 444', email: 'andrei.d@exemplu.ro' });
  await athlete({ name: 'Sara Ilie', birthDate: '2015-05-20', contactName: 'Dan Ilie', phone: '0733 000 111', email: 'dan.ilie@exemplu.ro' });
  await athlete({ name: 'Ioana Dumitru', birthDate: '2015-07-19', contactName: 'Radu Dumitru', phone: '0744 000 222', email: 'radu@exemplu.ro' });
  const member = (a, g, s, from) => d('api::group-membership.group-membership').create({ data: { athlete: a.documentId, group: g.documentId, season: s.documentId, isMain: true, from } });
  await member(maria, pp, s25, '2025-10-01');
  await member(andrei, pro, s26, '2026-10-01');
  const base = {
    status: 'Nou', archived: false, section: afi.documentId, season: s26.label, seasonRef: s26.documentId, relationship: 'parinte',
    shirtSize: 'S', source: 'Recomandare', gdprConsent: true, regulationsConsent: true, membershipAnswer: 'da', childHeight: 140,
    subscriptionChoice: { priceItemName: 'Abonament 8 ședințe grup', price: 590 }, lastSeason: 'Începători',
    priorExperience: 'Patinaj înainte, frânare', expectations: 'Să învețe piruete',
  };
  const reg = (data) => d('api::registration-submission.registration-submission').create({ data: { ...base, ...data } });
  const ids = {};
  ids.r1 = (await reg({ registrationNumber: '2026-0142', childName: 'Maria Dumitrescu', childBirthDate: '14.03.2014', childBirthDateParsed: '2014-03-14', parentName: 'Mihaela Dumitrescu', phone: '0722 111 222', email: 'parinte@exemplu.ro', childHeight: 142, submittedAt: '2026-10-20T11:22:00.000Z' })).documentId;
  ids.r2 = (await reg({ registrationNumber: '2026-0141', status: 'Contactat', childName: 'Andrei Popescu', childBirthDate: '02.09.2016', childBirthDateParsed: '2016-09-02', parentName: 'Ioana Popescu', phone: '0755 100 200', email: 'ioana.p@exemplu.ro', membershipAnswer: 'nu', subscriptionChoice: { priceItemName: '1 ședință grup', price: 80 }, lastSeason: 'Nu a participat', submittedAt: '2026-10-19T09:00:00.000Z' })).documentId;
  ids.r3 = (await reg({ registrationNumber: '2026-0140', childName: 'Sara-Maria Ilie', childBirthDate: '20.05.2015', childBirthDateParsed: '2015-05-20', parentName: 'Dan Ilie', phone: '0733 000 111', email: 'dan.ilie@exemplu.ro', lastSeason: 'Nu a participat', submittedAt: '2026-10-18T09:00:00.000Z' })).documentId;
  ids.r4 = (await reg({ registrationNumber: '2026-0139', childName: 'Andrei Dumitrescu', childBirthDate: '02.11.2011', childBirthDateParsed: '2011-11-02', parentName: 'Mihaela Dumitrescu', phone: '0722 333 444', email: 'andrei.d@exemplu.ro', submittedAt: '2026-10-17T09:00:00.000Z' })).documentId;
  ids.r5 = (await reg({ registrationNumber: '2026-0138', childName: 'Luca Stoica', childBirthDate: 'ieri', parentName: 'Ion Stoica', phone: '0766 000 333', email: 'ion.s@exemplu.ro', submittedAt: '2026-10-16T09:00:00.000Z' })).documentId;
  ids.r6 = (await reg({ registrationNumber: '2025-0090', season: s25.label, seasonRef: s25.documentId, childName: 'Elena Radu', childBirthDate: '01.01.2013', childBirthDateParsed: '2013-01-01', parentName: 'Mara Radu', phone: '0777 000 444', email: 'mara@exemplu.ro', submittedAt: '2026-05-02T09:00:00.000Z' })).documentId;
  ids.r7 = (await reg({ registrationNumber: '2026-0137', relationship: null, membershipAnswer: null, subscriptionChoice: null, source: null, lastSeason: null, childHeight: null, gdprConsent: null, regulationsConsent: null, childName: 'Mihai Pop', childBirthDate: '03.04.2015', childBirthDateParsed: '2015-04-03', parentName: 'Ion Pop', phone: '0711 000 555', email: '', level: 'Incepatori', howHeard: 'Facebook', clubInterest: true, regulationsAgreement: true, privacyConsent: true, submittedAt: '2026-10-15T09:00:00.000Z' })).documentId;
  ids.r8 = (await reg({ registrationNumber: '2026-0136', status: 'Respins', childName: 'Ana Ilie', childBirthDate: '05.06.2017', childBirthDateParsed: '2017-06-05', parentName: 'Dan Ilie', phone: '0799 000 666', email: 'ana@exemplu.ro', submittedAt: '2026-10-14T09:00:00.000Z' })).documentId;
  writeFileSync(process.env.IDS_FILE, JSON.stringify(ids));
  console.log('fixture ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
EOF
(set -a; . "$T/env"; set +a; cp "$T/fixture.js" ./es34-fixture.js && IDS_FILE="$T/ids.json" node ./es34-fixture.js; rm ./es34-fixture.js)
(set -a; . "$T/env"; set +a; node scripts/migrate-athletes-registrations.js --step=match-backfill --apply)
(set -a; . "$T/env"; set +a; npx strapi admin:create-user --email=admin@example.com --password='Throwaway123' --firstname=Admin)
(set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi start > "$T/strapi.log" 2>&1 & echo $! > "$T/pid")
until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1342/_health | grep -q 204; do sleep 2; done
```

Expected: `fixture ok`; the backfill reports `sigur` 2 (r1, r4), `probabil` 1 (r3) and none for the others; the admin is created; `/_health` answers 204.

- [ ] **Step 4: Browser pass, one school**

Needs Python Playwright with Chromium (`pip install playwright && playwright install chromium`).

```bash
cat > "$T/pass.py" <<'EOF'
import asyncio, json, re, sys
from playwright.async_api import async_playwright

B = 'http://127.0.0.1:1342/admin'
INS = B + '/plugins/edusport-inscrieri'
OUT, MODE, IDS = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
TAGGED = "document.querySelectorAll('[data-edusport-default-save]').length"
r = {'tagged': 0, 'page_errors': []}

async def login(pg):
    await pg.goto(B + '/auth/login'); await pg.wait_for_timeout(1500)
    await pg.fill('input[name=email]', 'admin@example.com'); await pg.fill('input[name=password]', 'Throwaway123')
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(4000)

async def shot(target, name, full=False):
    kw = {'full_page': True} if full else {}
    await target.screenshot(path=f'{OUT}/3-4-{name}.png', **kw)

async def open_list(pg, query=''):
    await pg.goto(INS + query); await pg.wait_for_timeout(3500)

async def pick(pg, nr):
    await pg.locator('tr.ui-table-click', has_text=nr).first.click(); await pg.wait_for_timeout(1500)
    return pg.locator('.sbt-panel')

def window(pg):
    return pg.locator('[role=dialog]', has_text='Confirmă înscrierea 20')

async def open_window(pg, nr):
    panel = await pick(pg, nr)
    await panel.locator('.sbt-pa').get_by_role('button', name='Confirmă înscrierea').click()
    await pg.wait_for_timeout(1500)
    return window(pg)

async def close_window(pg):
    await window(pg).get_by_role('button', name='Anulează', exact=True).last.click(); await pg.wait_for_timeout(500)

async def status_of(pg, nr):
    await open_list(pg)
    return (await pg.locator('tr.ui-table-click', has_text=nr).locator('.sbt-tag').text_content()).strip()

async def list_and_panel(pg):
    await open_list(pg); await shot(pg, 'list', True)
    r['headers'] = [h.strip() for h in await pg.locator('table.sbt-clist thead th').all_text_contents() if h.strip()]
    r['existing_line_rows'] = await pg.locator('tr.ui-table-click:has(.ins-ex svg) .ins-nr').all_text_contents()
    await pg.get_by_role('combobox', name='Sportiv existent').click(); await pg.get_by_role('option', name='Da', exact=True).click()
    await pg.wait_for_timeout(2000); r['filter_da_rows'] = await pg.locator('tr.ui-table-click .ins-nr').all_text_contents()
    await shot(pg, 'list-existing-da', True)
    panel = await pick(pg, '2026-0142')
    for name in ['Date', 'Abonament', 'Documente', 'Istoric']:
        await panel.get_by_role('tab', name=re.compile('^' + name)).click(); await pg.wait_for_timeout(600)
        await shot(panel, 'panel-' + name.lower())
    await panel.get_by_role('tab', name=re.compile('^Date')).click()
    await panel.locator('.ins-mcard .ins-link').click(); await pg.wait_for_timeout(400); await shot(panel, 'matchcard-compare')
    await panel.get_by_role('button', name='Editează').click(); await pg.wait_for_timeout(400); await shot(panel, 'panel-edit')
    await panel.get_by_role('button', name='Anulează').click()
    await panel.locator('.ins-ph').get_by_role('button', name=re.compile(r'^\.\.\.')).click(); await pg.wait_for_timeout(300)
    r['menu_items'] = await pg.get_by_role('menuitem').all_text_contents()
    await shot(pg, 'panel-menu'); await pg.keyboard.press('Escape')

async def window_states(pg):
    await open_list(pg)
    dlg = await open_window(pg, '2026-0142'); await shot(dlg, 'confirm-sigur')
    r['sigur_preselected'] = await dlg.get_by_role('radio', name=re.compile('^Sportiv existent')).is_checked()
    await dlg.get_by_role('button', name='Compară și actualizează').click(); await shot(dlg, 'confirm-compare')
    r['ticked_by_default'] = await dlg.locator('.ins-cmp input[type=checkbox]:checked').count()
    await dlg.get_by_role('button', name='Caută alt sportiv').click()
    await dlg.get_by_role('searchbox').fill('Dumit'); await pg.wait_for_timeout(1200); await shot(dlg, 'confirm-search')
    r['search_rows'] = await dlg.locator('.ins-res-t b').all_text_contents()
    await dlg.get_by_role('searchbox').fill('zzzz'); await pg.wait_for_timeout(1200); await shot(dlg, 'confirm-search-none')
    r['search_none'] = await dlg.locator('.ins-res-none').text_content()
    await dlg.locator('.ins-search-bar .ins-link').click()
    await dlg.get_by_role('combobox', name='Grupa').click(); await pg.wait_for_timeout(300)
    r['group_headers'] = await pg.locator('.ui-opt-group').all_text_contents()
    await shot(dlg, 'confirm-groups'); await pg.keyboard.press('Escape'); await close_window(pg)
    dlg = await open_window(pg, '2026-0139')
    await dlg.get_by_role('combobox', name='Grupa').click(); await pg.get_by_role('option', name='Începători').click()
    r['main_group_line'] = await dlg.locator('.ins-line').text_content(); await shot(dlg, 'confirm-main-group'); await close_window(pg)
    dlg = await open_window(pg, '2026-0140'); await shot(dlg, 'confirm-probabil')
    r['probabil_disabled'] = await dlg.get_by_role('button', name='Confirmă înscrierea').is_disabled()
    r['probabil_hint'] = await dlg.locator('.ins-foot-hint').text_content(); await close_window(pg)
    dlg = await open_window(pg, '2026-0141'); await shot(dlg, 'confirm-new'); await close_window(pg)
    dlg = await open_window(pg, '2026-0138'); r['birth_date_notice'] = await dlg.locator('.ui-notice').first.text_content()
    await shot(dlg, 'confirm-birth-date'); await close_window(pg)
    await open_list(pg, '?open=' + IDS['r6'])
    r['open_link_rows'] = await pg.locator('tr.ui-table-click .ins-nr').all_text_contents()
    dlg = await open_window(pg, '2025-0090'); r['season_ended'] = await dlg.locator('.ins-note').text_content()
    await shot(dlg, 'confirm-season-ended'); await close_window(pg)

async def confirm_and_undo(pg):
    await open_list(pg)
    dlg = await open_window(pg, '2026-0141')
    await dlg.get_by_role('combobox', name='Grupa').click(); await pg.get_by_role('option', name='Primii Pași').click()
    await dlg.get_by_role('button', name='Confirmă înscrierea').click(); await pg.wait_for_timeout(1200)
    r['confirmed_toast'] = (await pg.locator('.ui-toast').first.text_content()).strip()
    await shot(pg, 'toast-confirmed', True)
    panel = pg.locator('.sbt-panel'); r['after_confirm_footer'] = await panel.locator('.sbt-pa').text_content()
    await shot(panel, 'panel-confirmed')
    await panel.locator('.ins-ph').get_by_role('button', name=re.compile(r'^\.\.\.')).click()
    await pg.get_by_role('menuitem', name='Anulează confirmarea').click(); await pg.wait_for_timeout(300)
    await shot(pg, 'undo-dialog'); await pg.get_by_role('dialog').get_by_role('button', name='Anulează confirmarea').click()
    await pg.wait_for_timeout(1500); r['menu_undo_status'] = await status_of(pg, '2026-0141')
    dlg = await open_window(pg, '2026-0142'); await dlg.get_by_role('button', name='Confirmă înscrierea').click()
    await pg.wait_for_timeout(1000)
    panel = await pick(pg, '2026-0137'); await shot(panel, 'panel-legacy-date')
    await panel.get_by_role('tab', name=re.compile('^Abonament')).click(); await shot(panel, 'panel-legacy-abonament')
    await pg.locator('.ui-toast').get_by_role('button', name='Anulează').click(); await pg.wait_for_timeout(2000)
    r['toast_undo_status'] = await status_of(pg, '2026-0142')

async def concurrent(ctx, pg):
    other = await ctx.new_page()
    await open_list(pg); dlg_a = await open_window(pg, '2026-0140')
    await dlg_a.get_by_text('Sportiv nou', exact=True).click()
    await open_list(other); dlg_b = await open_window(other, '2026-0140')
    await dlg_b.get_by_text('Sportiv nou', exact=True).click()
    await dlg_b.get_by_role('button', name='Confirmă înscrierea').click(); await other.wait_for_timeout(1500)
    await dlg_a.get_by_role('button', name='Confirmă înscrierea').click(); await pg.wait_for_timeout(1500)
    r['concurrent_message'] = (await pg.locator('.ui-toast', has_text='alt administrator').first.text_content()).strip()
    r['concurrent_window_closed'] = await window(pg).count() == 0
    await other.close()

async def phone(ctx):
    pg = await ctx.new_page(); await pg.set_viewport_size({'width': 390, 'height': 844})
    await open_list(pg); await shot(pg, 'phone-list', True)
    panel = await pick(pg, '2026-0139'); await panel.scroll_into_view_if_needed(); await shot(pg, 'phone-panel', True)
    await panel.locator('.sbt-pa').get_by_role('button', name='Confirmă înscrierea').click(); await pg.wait_for_timeout(1500)
    sheet = pg.locator('.ui-sheet'); r['phone_sheet_height'] = round((await sheet.bounding_box())['height'])
    await shot(pg, 'phone-confirm')
    await sheet.get_by_role('button', name='Compară și actualizează').click(); await shot(pg, 'phone-confirm-compare')
    r['tagged'] += await pg.evaluate(TAGGED); await pg.close()

async def two_schools(pg):
    await open_list(pg); await shot(pg, 'two-schools-list', True)
    r['school_tabs'] = [t.strip() for t in await pg.locator('.ins-schools [role=tab]').all_text_contents()]
    await pg.locator('tr.ui-table-click', has_text='2026-0143').locator('input[type=checkbox]').check()
    await shot(pg, 'two-schools-bulk')
    panel = await pick(pg, '2026-0143')
    await panel.locator('.ins-ph').get_by_role('button', name=re.compile(r'^\.\.\.')).click()
    r['menu_items_two_schools'] = await pg.get_by_role('menuitem').all_text_contents()
    await pg.get_by_role('menuitem', name='Mută la altă școală').click(); await pg.wait_for_timeout(300)
    await shot(pg, 'two-schools-move-dialog')
    dlg = pg.get_by_role('dialog'); await dlg.get_by_role('combobox').click()
    await pg.get_by_role('option', name='Școala de Patinaj - AFI Cotroceni').click()
    await dlg.get_by_role('button', name='Mută', exact=True).click(); await pg.wait_for_timeout(1200)
    r['move_toast'] = (await pg.locator('.ui-toast').first.text_content()).strip()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1440, 'height': 1000})
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: r['page_errors'].append(str(e)))
        await login(pg)
        if MODE == 'one-school':
            await list_and_panel(pg); await window_states(pg); await confirm_and_undo(pg); await concurrent(ctx, pg); await phone(ctx)
        else:
            await two_schools(pg)
        r['tagged'] += await pg.evaluate(TAGGED)
        for k, v in r.items():
            print(f'{k}: {v}')
        await b.close()

asyncio.run(main())
EOF
python3 "$T/pass.py" "$T/shots" one-school "$T/ids.json"
```

Expected output:

```
tagged: 0
page_errors: []
headers: ['Nr.', 'Trimis la', 'Nume sportiv', 'Vârstă', 'Status', 'Completat de', 'Dorește să fie membru', 'Acțiuni']
existing_line_rows: ['2026-0142', '2026-0140', '2026-0139']
filter_da_rows: ['2026-0142', '2026-0140', '2026-0139']
menu_items: ['Șterge înscrierea']
sigur_preselected: True
ticked_by_default: 1
search_rows: ['Maria Dumitrescu', 'Andrei Dumitrescu', 'Ioana Dumitru']   (order: the proposed athlete first)
search_none: Niciun sportiv găsit pentru "zzzz".
group_headers: ['Școala de Patinaj - AFI Cotroceni', 'Club']
main_group_line: Grupă principală acum: Profesioniști (Club)
probabil_disabled: True
probabil_hint: Alege "Sportiv existent" sau "Sportiv nou"
birth_date_notice: Data nașterii nu poate fi citită. Corectați-o în Date.
open_link_rows: ['2025-0090']
season_ended: Sezonul 2025-2026 s-a încheiat. Se leagă doar fișa sportivului.
confirmed_toast: Înscriere confirmată: Andrei PopescuAnulează
after_confirm_footer: Deschide fișa sportivului
menu_undo_status: Contactat
toast_undo_status: Nou
concurrent_message: Înscrierea a fost deja confirmată de alt administrator.
concurrent_window_closed: True
phone_sheet_height: 844
```

(`confirmed_toast` is the toast's text with its button label; the check is that it starts with "Înscriere confirmată: Andrei Popescu" and that "Anulează" is the only button. If a selector does not match the rendered markup of plans 3-1 / 3-2, fix the selector, not the component, and note it in the report.)

- [ ] **Step 5: Browser pass, two schools**

```bash
kill "$(cat "$T/pid")"; sleep 3
cat > "$T/fixture2.js" <<'EOF'
const { createStrapi, compileStrapi } = require('@strapi/strapi');
(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  const [s26] = await d('api::season.season').findMany({ filters: { label: '2026-2027' } });
  const p2 = await d('api::section.section').create({ data: { name: 'Școala de Patinaj - Patinoar 2', kind: 'school', slug: 'patinoar-2', publicPage: true, order: 3 } });
  await d('api::registration-submission.registration-submission').create({ data: {
    registrationNumber: '2026-0143', status: 'Nou', archived: false, section: p2.documentId, season: s26.label, seasonRef: s26.documentId,
    childName: 'Ana Marin', childBirthDate: '09.09.2016', childBirthDateParsed: '2016-09-09', parentName: 'Ioana Marin', phone: '0788 000 777',
    email: 'ioana.m@exemplu.ro', relationship: 'parinte', membershipAnswer: 'nu', gdprConsent: true, regulationsConsent: true, submittedAt: '2026-10-21T09:00:00.000Z',
  } });
  console.log('fixture2 ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
EOF
(set -a; . "$T/env"; set +a; cp "$T/fixture2.js" ./es34-fixture2.js && node ./es34-fixture2.js; rm ./es34-fixture2.js)
(set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi start > "$T/strapi.log" 2>&1 & echo $! > "$T/pid")
until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1342/_health | grep -q 204; do sleep 2; done
python3 "$T/pass.py" "$T/shots" two-schools "$T/ids.json"
```

Expected output (each tab's text is its label followed by its count badge):

```
tagged: 0
page_errors: []
school_tabs: three tabs: 'Toate' with the total, 'Școala de Patinaj - AFI Cotroceni' with its count, 'Școala de Patinaj - Patinoar 2' with 1
menu_items_two_schools: ['Mută la altă școală', 'Șterge înscrierea']
move_toast: Mutată la Școala de Patinaj - AFI Cotroceni.
```

and the list shows the "Școala" column after "Nume sportiv", the bulk bar a school picker with "Mută la altă școală".

- [ ] **Step 6: Save the renders for the user's review**

```bash
D=/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/phase3-renders
mkdir -p "$D" && cp "$T"/shots/3-4-*.png "$D"/ && ls "$D" | grep -c '^3-4-'
```

Expected: about 38 files (`3-4-list.png` ... `3-4-two-schools-move-dialog.png`). Compare them with `phase3a-ref-v1/` (list, panel tabs, match card, confirm window states, toast, confirmed panel) and the spec differences listed under "Spec" above; the user reviews them after the build (DECISIONS phase3ab). Fixes go into the owning task's files with a `fix(inscrieri): ...` commit. Do not commit the PNGs from this plan.

- [ ] **Step 7: Clean up**

```bash
kill "$(cat "$T/pid")"
docker rm -f es34-pg
rm -rf "$T"
```

Expected: container removed. No commit in this task unless a check failed.

---

## Interfaces for other plans

All paths relative to the backend repo; the pure helpers import from `src/club`, the components from `src/admin/dashboard/inscrieri`.

- **Athlete record route:** this plan links to `/plugins/edusport-sportivi/:documentId` (`athleteRecordPath(documentId)`, `src/club/inscrieri-panel.ts`) from "Deschide fișa sportivului", "Deschide fișa completă" and "Vezi fișa", in the same tab. Plan 3-5 renders the record at that path (the menu's `/plugins/edusport-sportivi/*` route already reaches it).
- **Opening a registration from the record (plan 3-5, "Înscrieri" block):** link to `inscrieriOpenPath(registrationDocumentId)` = `/plugins/edusport-inscrieri?open=<documentId>`; the page lists that one registration (any season, archived too) with its panel open. Server side: `GET /api/forms/inscrieri?open=<documentId>` (`openClause`, Task 5).
- **Search rows like "Caută alt sportiv" (plan 3-5 "Adaugă sportiv", spec P13):** `useAthleteSearch(registrationId: string | null, query)` and `AthleteResultList({ search, query, onPick, onNew })` (`src/admin/dashboard/inscrieri/confirm/AthleteSearch.tsx`), `CONFIRM_COPY.searchPlaceholder`, `CONFIRM_COPY.noResults(text)`, `CONFIRM_COPY.newLabel`, `cardDetailLine(card)`, `initials(name)`, `lastGroupText(card)`, `CLUB_URLS.athleteSearch(q, null)`.
- **Admin fetch with stable identities:** `useStableClient()`, `dataOf<T>(res)` (`src/admin/dashboard/inscrieri/useClient.ts`).
- **Shared table:** `SubmissionTableExtras`, `cfg.statusMenu`, `cfg.sortOptions`, object compact headers `{ label, sort: [asc, desc] }`, `TableApi.pageMeta`, `TableApi.refetch` (`SubmissionTable.tsx`); `listMeta`, `nextHeaderSort`, `headerSortDir`, `SEASON_EMPTY_LABEL` (`src/club/ui-table.ts`). Voluntari is unchanged.
- **Removed:** `registrationPanelRows`, `PanelEdit`, `PanelRow`, `PanelRows`, `MISSING`, `MEMBERSHIP_EDIT_OPTIONS` (`src/club/registration-panel.ts`) and `EditableAnswer.tsx`. `RELATIONSHIP_EDIT_OPTIONS` stays (plan 3-2's history texts import it).

## Self-review

**1. Spec coverage**

- 3.1 list: columns as v5 with "Dorește să fie membru" (Tasks 1, 5); "Nume sportiv" in the list, full table and filter builder (Task 5); "Vârstă" "<n> ani", blank when unknown, sortable (Tasks 1, 4, 5; Needs decision 5); "Sportiv existent" line with icon, tight, rows one height (Tasks 1, 5); filter "Sportiv existent" Da / Nu in the current toolbar (Task 5); new search placeholder (Tasks 1, 5); existing list, filters, bulk, CSV, Sheets, "Formulare goale" kept, extras in the export query (Tasks 4, 5); bulk "Mută la altă școală" with 2+ schools (Task 5).
- 3.2 full table: cell editing kept (server history from plan 3-2), "Vârstă" column, no "Confirmat" in the cell (Tasks 4, 5; Needs decision 2).
- 3.3 panel: fixed header with name, badge, Nr., Trimis (Task 6); status menu without "Confirmat" (Tasks 1, 4, 6; Needs decisions 1, 2); "..." menu with undo (only when confirmed through the window, asks first), move, delete (Tasks 1, 6); match card with initials, last group or "Ultima înscriere", the last-season line, Compară / Ascunde, comparison with light background only, blank cells, same-tab record link (Tasks 1, 7); tabs Date | Abonament | Documente (n) | Istoric (n) with the form's wording (Tasks 1, 6; Needs decisions 3, 4); Documente moves the phase 2 blocks (Task 6); Istoric newest first, date, time, who, text (Tasks 1, 6); footer rules (Tasks 1, 6, 9).
- 3.4 Editează: one link on the first row, all answers incl. Calitate and the wish last under "Abonament", birth date picker saved as ZZ.LL.AAAA, number / date sent / consents never edited, toasts, no resend prompt, match refresh through the list reload (Tasks 2, 8; Needs decision 6).
- 3.5 status: Confirmat only through the window, Contactat footer and menu, Respins / archived not confirmable, old Confirmat rows still confirmable, undo restores the status (Tasks 1, 6, 9; server plan 3-2).
- 3.6 school: 2+ schools counted by the server, tabs "Toate (n)", "<școală> (n)", column "Școala", move in the menu and in bulk before confirmation, toasts (Tasks 1, 5, 6; Needs decision 7b).
- 4.1 window: title, section "Sportiv", footer; proposed card with "Vezi fișa"; choice cards; preselect only Sigur; the hint; the last-season line; no match with "Caută un sportiv existent"; search in place with placeholder, "Anulează", candidates first, two-line rows, nothing-found line and "Sportiv nou" row; Radio card styling (Tasks 3, 9).
- 4.2 compare and update: link, ticks on differing rows, defaults (name and birth date off), default ticks when never opened, blank cells (Tasks 3, 7, 9).
- 4.3 season and groups: running vs ended line, no-season case (Needs decision 7d), grouped picker (school then Club), optional "Fără grupă deocamdată", main group line and tick (Tasks 3, 9).
- 4.4 A.C.S. status and wish lines apart, "Nu → În așteptare", intent line, no prices (Tasks 3, 9).
- 4.5 / 4.6: request body (Task 3); toast 8 seconds with "Anulează" only, undo from the toast or the menu (Open 3 dialog), the panel shows "Confirmat" and "Deschide fișa sportivului" after the reload (Tasks 6, 9).
- 4.7: all-or-nothing and concurrency texts, unreadable birth date block, Respins / archived (Tasks 3, 9, 10).
- 4.8 phone: full-height bottom sheet, cards stacked (plan 3-1 RadioGroup), comparison scrolling sideways (`min-width:520px` in its wrapper) (Tasks 5, 9, 10).
- 8, Înscrieri parts: custom Select (status menu, filter, school pickers), Radio cards, Toast action, BottomSheet full height, SearchableSelect groups, BirthDatePicker, Tabs; every new screen at phone width (Tasks 4 to 10).
- 12: unit tests for the UI rules (Tasks 1 to 4); browser tests and renders (Task 10). The pre-build phone render of 4.8 was replaced by post-build review (DECISIONS phase3ab), Task 10 Step 6.
- Coordinator additions: `?open=<documentId>` (Tasks 1, 5); matching rule change needs no UI change (header note).

**2. Placeholder scan:** no "TBD", "similar to" or step without code; option B of each Needs decision item names its single place of change.

**3. Type consistency:** `InscriereRow`, `TabRow`, `PanelTab`, `ListMeta`, `ToastSpec`, `CompactHeaderSpec` (Task 1) and `CompactHeader` (Task 4) have the same shape; `EditDraft` / `EditField` (Task 2) and `WindowState` / `WindowAction` / `Gate` / `ConfirmBody` (Task 3) are used verbatim in Tasks 8 and 9; `PanelData` (Task 6) in Tasks 7 and 9; `StableClient` / `dataOf` (Task 5) everywhere; the two `DateParts` types are kept apart (`src/club/birth-date.ts` numbers only, `src/club/ui-birth-date.ts` nullable parts; `inscrieri-edit.ts` imports the picker's).

**4. Review Focus:** each of the five lines has its test: concurrent confirm (Task 3 `confirmFailure`, Task 9 source test, Task 10 `concurrent`), undo after leaving the row (Task 9 source test, Task 10 `toast_undo_status`), unreadable stored birth date in "Editează" (Task 2 tests), Probabil and ticks after a pick (Task 3 tests, Task 10 `probabil_*`), blank cells for old registrations (Task 1 legacy test, Task 10 legacy renders).
