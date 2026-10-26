# Phase 3-5: Sportivi Admin UI (3B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace today's public-profile list with the private Sportivi list (filters-v3, season selector, banner, phone cards), add the athlete record as a full page at `/plugins/edusport-sportivi/:documentId` (tabs Date | Profil public | Documente | Istoric, Editează with the zi / lună / an picker, "..." menu, possible-duplicate line, merge window, delete), the "Adaugă sportiv" search-first window, the menu section "Club și școală" and the redirect of the old editor address.

**Architecture:** Every rule the screens apply (request query, filter sections, count and plural texts, cells, header sub-line, Date tab draft check, toasts, history time, merge choices, search rows, addresses) is a pure module in `src/club/sportivi/` with Vitest tests; the admin bundle imports those modules at runtime (no DOM, React, Node or Strapi imports, like `registration-panel.ts`). The React side lives in `src/admin/dashboard/sportivi/`, is thin, uses the shared pieces of plan 3-1 (Select, FilterPanel, BottomSheet, BirthDatePicker, Radio) and calls only the routes of plan 3-2. Wiring Vitest cannot reach is pinned by source-reading tests (the phase 2B pattern) and by the Playwright renders of Task 12. The record needs no new route: Strapi registers every `addMenuLink` page as `${to}/*` (`node_modules/@strapi/admin/dist/admin/admin/src/core/apis/router.mjs:165`), so `SportiviPage` reads the splat and shows the list or the record.

**Tech Stack:** Strapi 5.52.1 admin (React 18, TypeScript `strict: true` in `src/admin`), `src/admin/ui` and the plan 3-1 additions, Vitest 3 (Node), Python Playwright, Postgres 16 in a throwaway container.

**Spec:** `docs/superpowers/specs/2026-10-26-athletes-registrations-design.md`, sections 5 (Sportivi list), 6 (athlete record, 6.1 to 6.7), 7 (menu, old editor route, dashboard tile) and the Sportivi parts of 8 (FilterPanel, BottomSheet full height, birth date picker, Select, phone width). Decisions log: `../edusport_frontend/docs/portal/DECISIONS.md` (a later dated entry wins). Visual reference: `../edusport_frontend/docs/portal/mockups/screens/prototype-registrations-v5.html` (+ `mockups/proto_js.js`, `vMember`), `filters-v3.html`, `bottom-sheet-v1.html` / `v2`, and `mockups/screens/phase3b-ref-v1/` (`index.md`; `proto-sportivi-*` and `today-sportiv-edit-*` / `today-sportivi-list-*`). Brief shared by all phase 3 plans: `.superpowers/phase3-plan-brief.md`; rules for executing agents: `.superpowers/phase3-shared/agent-rules.md`.

**Builds on (assumed merged on `feat/athletes`, consumed exactly as their "Interfaces for other plans" sections give them):**
- Plan 3-1 `docs/superpowers/plans/2026-10-26-phase3-1-shared-admin-ui.md` (with its RESOLVED block: square Radio, picker "01".."31" + month names + oldest year first + empty rows "Zi" / "Lună" / "An" + all 31 days, impossible date refused with "Alegeți data nașterii."; several filter values joined by commas; "Caută..." above 8 options; Select list under the field on phones; undo toast without X): `Select`, `FilterPanel` (`FilterSection`), `BottomSheet` (`fullHeight`, `desktop="modal"`), `useIsPhone`, `Radio`, `BirthDatePicker`, and from `src/club/ui-birth-date.ts` `DateParts`, `EMPTY_DATE`, `partsFromDisplay`, `partsToDisplay`; reused unchanged: `ConfirmDialog`, `Tabs`, `Notice`, `MenuButton` (`src/admin/dashboard/SubmissionTable.tsx`).
- Plan 3-2 `docs/superpowers/plans/2026-10-26-phase3-2-athlete-data-services.md` (N1 to N9 resolved, option A): the routes `GET/POST /api/club/athletes`, `GET /api/club/athletes/search`, `GET /api/club/athletes/merge-preview`, `POST /api/club/athletes/merge`, `GET /api/club/athletes/by-profile/:profileId`, `POST /api/club/athlete-duplicates/:pairId/dismiss`, `GET/PUT/DELETE /api/club/athletes/:documentId`, `POST .../status`, `GET .../history`, `POST .../profile`, `PUT .../profile/visibility`, the phase 2 document route `GET /api/club/registrations/:documentId/documents/:kind`; the shapes `AthleteListPage`, `AthleteListRow`, `AthleteRecord`, `AthleteEditResponse`, `AthleteCard`, `HistoryLine`, `MergePreview`, `MergeSideView` (`src/club/athletes/api-types.ts`); the helpers `ATHLETE_FIELDS`, `ATHLETE_FIELD_LABELS`, `missingText`, `AthleteField`, `AthleteStatus` (`athlete-data.ts`), `ACS_WORDS` (`acs.ts`), `STATUS_WORDS` (`history-text.ts`), `ADMIN_ERRORS` (`athletes/errors.ts`), `NO_SECTION` (`athletes/list.ts`, only in a test). The dashboard tile "Sportivi" counting active athletes is plan 3-2 Task 25 and is not repeated here.

**Matching rule (user decision after plans 3-2 and the spec):** a name match with a typo is at most "Probabil"; "Sigur" needs the exact normalized name plus the birth date; deploy grouping uses the exact rule, so twins stay separate and are flagged as possible duplicates. All of it is server side (plan 3-2); this plan only shows the saved flags and the search answers, so nothing here changes. The Task 12 fixture creates its duplicate pair directly and does not depend on the rule.

**Checked while writing:** nothing in this plan was run. The code is written against the two plans above as specified and against `main` as of 2026-10-26 (`menu.tsx`, `EdusportShell.tsx`, `SportiviPage.tsx`, `SportivEditPage.tsx`, `DashboardPage.tsx`, `CompetitiiPage.tsx`, `SubmissionTable.tsx::MenuButton`, `inscrieri/downloadPdf.ts`). Task 12 is the first run-time check.

## Needs decision

The spec leaves these open. Nothing waits on them: the code below implements option A of each, in the one place named, so another answer is a small change.

1. **"Adaugă sportiv" window** (Task 11, `AddAthleteDialog.tsx`). (a) Where: A a window over the list (Modal on desktop, full-height bottom sheet on phones); B its own page `/plugins/edusport-sportivi/nou` with a back link. (b) After "Sportiv nou": A "Nume complet" is prefilled with the searched text; B empty.
2. **"Sportiv nou" row in the "Adaugă sportiv" search** (Task 4, `search-view.ts::showNewRow`). Spec 6.7 says the form shows "only if not found"; a child whose name is close to another one's (the search ignores one typo, spec 5) could then never be added; twins with the same name always find each other. A: the row only when the search found nothing (6.7 as written); B: the row always under the results.
3. **Merge window** (Tasks 4 and 9). (a) Layout: A a window (Modal "lg" on desktop, full-height bottom sheet on phones) over the record; B its own page. (b) Text that marks the kept record above each column (no copy in the spec): A "Rămâne" (the confirmation's own word); B "Se păstrează". (c) Kept record when the window opens: A the record it was opened from (the admin can switch); B none, "Unește" disabled until one is chosen.
4. **"Vizibilitate pe site" in Profil public** (Task 8, `ProfileEditor.tsx::onSave`). Spec 6.3 keeps today's control; Istoric must show "Pagina publică pornită / oprită" (1.6), which only the athlete route writes. A: the control stays part of the form and is saved with "Salvează" (the save calls `PUT .../profile/visibility` when it changed); B: it applies at once when switched, like the prototype v5 switch.
5. **Date tab "Salvează" with nothing changed** (Task 3, `record-view.ts::saveToast`). A: "Nicio modificare." (as Înscrieri Editează, spec 3.4); B: the usual "Salvat. ..." toast.
6. **One-value filters** (Task 2, `list-view.ts::filterSections`). (a) "Fără grupă" (spec lists it beside Grupa; the list route treats `group` + `noGroup` as "either"): A the last option of the Grupa section; B its own section with the option "Da". (b) The option of "Posibile dubluri": A "Da"; B "Doar posibile dubluri".
7. **Romanian "de" from 20** in counts and ages (Task 2, `list-view.ts::countWords`). A: "20 de sportivi", "120 de sportivi", "101 sportivi", "20 de ani"; B: the spec forms as written ("20 sportivi", "20 ani").
8. **Istoric line layout** (Task 3, `record-view.ts::historyWhen`, and `HistoryTab.tsx`; plan 3-4 shows the same lines in the Înscrieri panel, so both should match). A: date and time "3 oct 2026, 14:22" in bold (months ian, feb, mar, apr, mai, iun, iul, aug, sep, oct, noi, dec), the actor beside it in muted text, the line text under them; B: "03.10.2026, 14:22" as the e-mail status shows dates today.
9. **Opening a registration from the record's "Înscrieri" block** (Task 1, `routes.ts::registrationPanelTo`; spec 6.2 "each opening the Înscrieri panel"). The Înscrieri page has no address for one registration today. A: `/plugins/edusport-inscrieri?open=<registration documentId>`, and plan 3-4 opens that panel on load; B: `/plugins/edusport-inscrieri?q=<nr>` (works today: the search shows the one row, one more click).
10. **Texts the spec does not give** (Tasks 3 and 7). A: name of the "..." button for screen readers "Mai multe acțiuni" (Strapi's own Romanian); Istoric load failure "Nu am putut încărca istoricul." (pattern of today's "Nu am putut încărca sportivii."); a failed "Vezi" reuses today's "Documentul nu a putut fi descărcat."; B: other wording.
11. **Sidebar icon of "Club și școală"** (Task 1, `EdusportShell.tsx::GROUP_ICON`). A: the person glyph "Sportivi și echipă" uses; B: a new skate glyph as prototype v5 draws "Școala de patinaj".
12. **What shows that a record is inactive** (Task 7, `AthleteRecordPage.tsx::HeaderActions`). Spec 6.1 lists no status in the header. A: only the menu label ("Marchează activ") and the Istoric line; B: also a badge "Inactiv" beside "Date incomplete" while inactive.
13. **Old editor link without `?id=` or with an unknown profile** (Task 1, `SportivEditPage.tsx`). A: the Sportivi list, no message; B: the list plus an error toast (copy needed).


> **Needs decision 1 to 13: RESOLVED (decided by Claude, low impact, 2026-10-26; logged in DECISIONS.md).** Option A everywhere EXCEPT: **#2 B**: the "Sportiv nou" row always shows under the search results (so a child whose name is close to another's can still be added); **#12 B**: an inactive record also shows an "Inactiv" badge in the header. #9 A: plan 3-4 supports `/plugins/edusport-inscrieri?open=<documentId>`.

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes` off `main`, with plans 3-1 and 3-2 merged. Run `npm ci` once on the branch first (`pdfkit`, `unpdf`). The frontend repo is touched only by Task 12's PNGs.
- Strapi 5.52.1, TypeScript, single quotes in `src/`. New functions < 30 lines, cyclomatic complexity < 10, no `any`. Existing functions already over the limit inside the moved profile editor (`ProfileEditor`, `skateStatus`) are edited in place, not refactored.
- `src/admin` is excluded from Vitest: logic goes into `src/club/sportivi/*.ts` (pure: no DOM, React, Node or Strapi imports); admin wiring is pinned by source-reading tests in `src/club/sportivi/__tests__/` and by Task 12.
- Checks after every task: the task's test file (`npx vitest run <file>`), the full suite (`npx vitest run`), `npx tsc --noEmit`, `npx tsc --noEmit -p src/admin/tsconfig.json` (zero errors each) and `node scripts/admin-ui-check.mjs --strict` (exit 0).
- Admin routes: only those of plan 3-2 (admin fetch client, `{ data }` answers; the list body is the page itself); refusals read with `requestErrorText(err, ADMIN_ERRORS.failed)` (`src/club/registration-panel.ts`). Admin routes on the server are `{ auth: false, policies: ['global::is-admin'] }` (plan 3-2); this plan adds none.
- Every change the screens make goes through a plan 3-2 route, which writes the HistoryEntry (`src/club/history.ts`); the one exception, the Profil public editor, keeps saving through the Content Manager as today (plan 3-2 "Notes for the UI plans") and sends the page switch through the athlete route (Needs decision 4).
- SaveBar tagger (`src/admin/app.tsx::tagDefaultSaveAndPreview`): a `<button>` named "Salvează" / "Publică" outside `.pce` or `.ui-root` is shrunk to 1px. Every button here sits in `AdminPage`, a `BottomSheet`, a `Modal` or a `ConfirmDialog` (all carry `.ui-root`). Task 12 counts tagged buttons (must be 0).
- Copy: Romanian UI copy exactly as the spec gives it; ș and ț with the comma below; the spec's "->" is "→"; no em dash, no middle dot, no emoji; terse; empty values blank. Copy not in the spec appears only in "Needs decision" items 3b, 5, 6b, 10 and 13, or is reused from today's admin ("Nu am putut încărca sportivii.", "Nu am putut încărca sportivul.", "Ștergi sportivul?", "Documentul nu a putut fi descărcat.", "Sortare", "Sezon", "Renunță", "Opțional" as a field hint only, DECISIONS 2026-10-19).
- Design: build from prototype v5 (`vMember`, Sportivi list), filters-v3 and bottom-sheet-v1/v2; reuse `src/admin/ui` tokens and components; colours only `var(--theme-*)`, radius only `var(--ui-radius-*)`; no rounded pills or circles; no dashed or dotted lines; no backtick inside a CSS string; every screen works at phone width (`max-width: 640px`, the breakpoint of `useIsPhone`).
- Tests use synthetic data only. Never run anything against production, the user's local database (container `strapi_db`, port 5432), the running `strapi_app` (1337) or the user's TEST environment (1340 / 3010, container `edusport-test-pg`). Task 12 uses its own Postgres on 55435 and Strapi on 1345.
- Commits: Conventional Commits, exactly the message given, no `Co-Authored-By`, no AI attribution. Never push. Before each commit check `git rev-parse --show-toplevel` and `git branch --show-current` against the dispatch.
- Decide nothing the spec leaves open: anything new goes to "Needs decision" above.

## Review Focus

- A half-picked or impossible birth date (14 March without a year; 31 April) in Date "Editează" or in "Adaugă sportiv": refused under the field with "Alegeți data nașterii.", nothing sent; clearing all three selects on Date saves an empty date (allowed, the record becomes "Date incomplete"); "Adaugă sportiv" requires it. Pinned by Task 3 `checkDraft` tests.
- On a phone, "Încarcă încă 30" and then a search, season or filter change: the list starts again at page 1 and replaces the cards, never appends the old ones. Pinned by Task 2 (`withSearch`, `withSeason`, `withSection` reset the page) and Task 6 (append only when `page > 1`, source test).
- Merge: the admin picks values, then switches the kept record: the picks restart from the new kept side, the ids swap, `take` lists only fields whose chosen value lives on the removed record, and the confirmation names the kept record. Pinned by Task 4 `mergeRequest` / `keptName` tests and Task 12 (confirm text after the switch).
- Moving between tabs with unsaved work (Date in "Editează", Profil public with changes): the work stays while the admin looks at Documente or Istoric; on phones only the visible tab's buttons sit in the sheet footer. Pinned by Task 7 and Task 8 source tests (`hidden` panels, `useRecordFooter(active ? ... : null)`).
- Counts and Romanian plurals at 0, 1, 19, 20, 101, 120 in the count line, the banner, "Arată N", the filter total and ages. Pinned by Task 2 tests.

---

## File Structure

```
src/club/sportivi/
  routes.ts                SPORTIVI_PATH, OLD_EDITOR_PATH, athleteRecordTo, addAthleteTo, wantsAddAthlete, registrationPanelTo, recordIdFromSplat, oldEditorProfileId (Task 1)
  list-view.ts             ListState, listQueryString, filterSections, sortSection, with*, counts and plurals, cells, LIST_COPY (Task 2)
  record-view.ts           RECORD_COPY, recordSubline, recordTabs, fieldRows, acsLine, registrationLine, saveToast, EditDraft, checkDraft, historyWhen, seasonFromState, menuItems (Task 3)
  search-view.ts           SEARCH_COPY, ADD_COPY, searchUrl, cardSubline, withoutAthlete, showNewRow, noResultsText (Task 4)
  merge-view.ts            MERGE_COPY, SIDES, MergeState, initialMerge, withKept, withPick, pickOf, mergeRequest, keptName, mergeRows, sides (Task 4)
  __tests__/routes.test.ts, list-view.test.ts, record-view.test.ts, search-merge.test.ts, admin-sportivi.test.ts
src/admin/dashboard/
  menu.tsx                 group "club" ("Club și școală"), Sportivi moved there, old editor = route only (Task 1)
  EdusportShell.tsx        GROUP_ICON.club (Task 1)
  SportivEditPage.tsx      rewritten: redirect to the record (Task 1)
  SportiviPage.tsx         rewritten: list or record by the route splat (Task 7)
  DashboardPage.tsx        quick action "Adaugă sportiv" -> addAthleteTo (Task 11)
  sportivi/
    ProfileEditor.tsx      moved from SportivEditPage.tsx (Task 1), adapted to the Profil public tab (Task 8)
    api.ts                 useSportiviApi: the plan 3-2 routes (Task 5)
    styles.ts              SPORTIVI_CSS (Task 5)
    AthleteSearch.tsx      search box + two-line rows (Task 5)
    useAthleteList.ts, SportiviList.tsx, ListToolbar.tsx, AthleteTable.tsx, AthleteCards.tsx (Task 6; SportiviList also Task 11)
    AthleteRecordPage.tsx  record page / phone sheet, header, tabs (Task 7; Tasks 8 and 10 extend it)
    recordFooter.tsx, DateTab.tsx, DocumentsTab.tsx, HistoryTab.tsx, openPdf.ts (Task 7)
    ProfileTab.tsx         (Task 8)
    MergeDialog.tsx        (Task 9)
    RecordMenu.tsx, DuplicateLines.tsx (Task 10)
    AddAthleteDialog.tsx   (Task 11)
```

## Tasks and parallel groups

| Group | Tasks | Runs after |
|---|---|---|
| A | 1 Routes, menu, old editor; 2 List rules; 3 Record rules; 4 Search and merge rules | plans 3-1 and 3-2 on `feat/athletes`; in parallel (separate files) |
| B | 5 API client, styles, search component | group A |
| C | 6 List screens; 7 Record page; 9 Merge window | 5; in parallel (separate files) |
| D | 8 Profil public, then 10 Menu, duplicates, delete, merge wiring | 7 (8); 8 and 9 (10); both edit `AthleteRecordPage.tsx` |
| E | 11 Adaugă sportiv | 6 (beside group D) |
| F | 12 Renders and checks on a throwaway Postgres | everything |

---

### Task 1: Addresses, menu section "Club și școală", old editor redirect

**Files:**
- Create: `src/club/sportivi/routes.ts`, `src/club/sportivi/__tests__/routes.test.ts`
- Modify: `src/admin/dashboard/menu.tsx`, `src/admin/dashboard/EdusportShell.tsx:207-214`
- Move: `src/admin/dashboard/SportivEditPage.tsx` -> `src/admin/dashboard/sportivi/ProfileEditor.tsx` (import paths only)
- Create (new content at the old path): `src/admin/dashboard/SportivEditPage.tsx`

**Interfaces:**
- Consumes: plan 3-2 `GET /api/club/athletes/by-profile/:profileId` -> `{ data: { documentId } }`.
- Produces:
  - `SPORTIVI_PATH = '/plugins/edusport-sportivi'`, `OLD_EDITOR_PATH = '/plugins/edusport-sportiv-edit'`, `ADD_PARAM = 'adauga'`
  - `athleteRecordTo(documentId: string): string` (`/plugins/edusport-sportivi/<documentId>`; plan 3-4 links here)
  - `addAthleteTo: string` (`/plugins/edusport-sportivi?adauga=1`), `wantsAddAthlete(search: string): boolean`
  - `registrationPanelTo(documentId: string): string` (Needs decision 9, option A)
  - `recordIdFromSplat(splat: string | undefined): string | null`, `oldEditorProfileId(search: string): string | null`
  - `menu.tsx`: `Group` gains `'club'`, `GROUP_LABEL.club = 'Club și școală'`, `SPORTIVI_TO = SPORTIVI_PATH`, `SPORTIV_EDIT_TO = OLD_EDITOR_PATH`
  - `src/admin/dashboard/sportivi/ProfileEditor.tsx`: today's editor, unchanged apart from import paths (adapted in Task 8)

- [ ] **Step 1: Write the failing test**

`src/club/sportivi/__tests__/routes.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OLD_EDITOR_PATH, SPORTIVI_PATH, addAthleteTo, athleteRecordTo, oldEditorProfileId, recordIdFromSplat, registrationPanelTo, wantsAddAthlete,
} from '../routes';

const src = (p: string) => join(__dirname, '..', '..', '..', p);
const read = (p: string) => readFileSync(src(p), 'utf8');

describe('Sportivi addresses (spec 5, 6, 7)', () => {
  it('the record is a full page under the list route; plan 3-4 links to it', () => {
    expect(SPORTIVI_PATH).toBe('/plugins/edusport-sportivi');
    expect(athleteRecordTo('k3j2h1')).toBe('/plugins/edusport-sportivi/k3j2h1');
    expect(athleteRecordTo('a b')).toBe('/plugins/edusport-sportivi/a%20b');
  });

  it('reads the record id from the route splat', () => {
    expect(recordIdFromSplat(undefined)).toBeNull();
    expect(recordIdFromSplat('')).toBeNull();
    expect(recordIdFromSplat('  ')).toBeNull();
    expect(recordIdFromSplat('k3j2h1')).toBe('k3j2h1');
    expect(recordIdFromSplat('k3j2h1/extra')).toBe('k3j2h1');
    expect(recordIdFromSplat('a%20b')).toBe('a b');
    expect(recordIdFromSplat('%E0')).toBeNull();
  });

  it('old editor links carry the public profile id', () => {
    expect(OLD_EDITOR_PATH).toBe('/plugins/edusport-sportiv-edit');
    expect(oldEditorProfileId('?id=sp1')).toBe('sp1');
    expect(oldEditorProfileId('?id=')).toBeNull();
    expect(oldEditorProfileId('')).toBeNull();
  });

  it('"Adaugă sportiv" from the dashboard, and one registration panel', () => {
    expect(addAthleteTo).toBe('/plugins/edusport-sportivi?adauga=1');
    expect(wantsAddAthlete('?adauga=1')).toBe(true);
    expect(wantsAddAthlete('')).toBe(false);
    expect(registrationPanelTo('r1')).toBe('/plugins/edusport-inscrieri?open=r1');
  });
});

describe('menu (spec 7)', () => {
  const menu = read('admin/dashboard/menu.tsx');

  it('"Club și școală" sits above "Sportivi și echipă" and holds Sportivi', () => {
    expect(menu).toContain("club: 'Club și școală',");
    expect(menu).toContain("export const GROUP_ORDER: Group[] = ['forms', 'program', 'club', 'team', 'pages', 'content', 'system'];");
    expect(menu).toContain("{ to: SPORTIVI_TO, label: 'Sportivi', icon: User, group: 'club', featured: true },");
    expect(menu.match(/to: SPORTIVI_TO, label/g)).toHaveLength(1);
    expect(menu).toContain("{ to: MEMBRI_TO, label: 'Membri echipă', icon: GridFour, group: 'team', featured: true },");
  });

  it('the old editor address is a route only, no menu entry', () => {
    expect(menu).toContain('path: `${SPORTIV_EDIT_TO.slice(1)}/*`');
    expect(menu).not.toContain('to: SPORTIV_EDIT_TO,');
    expect(read('admin/dashboard/EdusportShell.tsx')).toContain("club: 'user',");
  });

  it('the old editor page redirects to the record; the editor moved to the record folder', () => {
    const page = read('admin/dashboard/SportivEditPage.tsx');
    expect(page).toContain('/api/club/athletes/by-profile/');
    expect(page).toContain('athleteRecordTo(');
    expect(page).not.toContain('SPORTIV_CSS');
    expect(existsSync(src('admin/dashboard/sportivi/ProfileEditor.tsx'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/sportivi/__tests__/routes.test.ts`
Expected: FAIL (`Failed to resolve import "../routes"`).

- [ ] **Step 3: The addresses**

`src/club/sportivi/routes.ts`:

```ts
/**
 * Admin addresses of the Sportivi pages (spec 5, 6, 7). Pure: the admin bundle and the tests import it.
 * The record is a full page under the list's route: Strapi registers every menu-link page as
 * `${to}/*`, so `/plugins/edusport-sportivi/<documentId>` needs no route of its own.
 */
export const SPORTIVI_PATH = '/plugins/edusport-sportivi';
/** The old profile editor's address; it only redirects now (gaps #42). */
export const OLD_EDITOR_PATH = '/plugins/edusport-sportiv-edit';
const INSCRIERI_PATH = '/plugins/edusport-inscrieri';
export const ADD_PARAM = 'adauga';

/** The athlete record, opened in the same tab (gaps #33). Plan 3-4 links here. */
export const athleteRecordTo = (documentId: string): string => `${SPORTIVI_PATH}/${encodeURIComponent(documentId)}`;

/** The Sportivi list with "Adaugă sportiv" open (dashboard quick action). */
export const addAthleteTo = `${SPORTIVI_PATH}?${ADD_PARAM}=1`;

export const wantsAddAthlete = (search: string): boolean => new URLSearchParams(search).get(ADD_PARAM) === '1';

/** One registration's Înscrieri panel, from the record's "Înscrieri" block (spec 6.2; Needs decision 9, option A). */
export const registrationPanelTo = (documentId: string): string => `${INSCRIERI_PATH}?open=${encodeURIComponent(documentId)}`;

/** The record id in the route splat after `/plugins/edusport-sportivi/`: its first segment, decoded; null means the list. */
export function recordIdFromSplat(splat: string | undefined): string | null {
  const first = (splat ?? '').split('/')[0].trim();
  if (!first) return null;
  try {
    return decodeURIComponent(first);
  } catch {
    return null;
  }
}

/** The public profile id of an old editor link (`?id=<sportsperson documentId>`), or null. */
export function oldEditorProfileId(search: string): string | null {
  const id = (new URLSearchParams(search).get('id') ?? '').trim();
  return id || null;
}
```

- [ ] **Step 4: The menu**

In `src/admin/dashboard/menu.tsx`:

After the `} from '../pages/routes';` line that closes the first import block (line 11), add:

```ts
import { OLD_EDITOR_PATH, SPORTIVI_PATH } from '../../club/sportivi/routes';
```

Replace:

```ts
export type Group = 'forms' | 'program' | 'team' | 'pages' | 'content' | 'system';
```

with:

```ts
export type Group = 'forms' | 'program' | 'club' | 'team' | 'pages' | 'content' | 'system';
```

In `GROUP_LABEL`, after `program: 'Program și calendar',` add:

```ts
  club: 'Club și școală',
```

Replace:

```ts
export const GROUP_ORDER: Group[] = ['forms', 'program', 'team', 'pages', 'content', 'system'];
```

with:

```ts
export const GROUP_ORDER: Group[] = ['forms', 'program', 'club', 'team', 'pages', 'content', 'system'];
```

Replace:

```ts
// Admin routes for the custom Sportivi (sportsperson) list + edit pages.
export const SPORTIVI_TO = '/plugins/edusport-sportivi';
export const SPORTIV_EDIT_TO = '/plugins/edusport-sportiv-edit';
```

with:

```ts
// Sportivi: the private athlete list, and under /<documentId> the athlete record.
// The old profile editor address only redirects to the record (spec 7).
export const SPORTIVI_TO = SPORTIVI_PATH;
export const SPORTIV_EDIT_TO = OLD_EDITOR_PATH;
```

Replace:

```ts
  // Sportivi și echipă
  { to: SPORTIVI_TO, label: 'Sportivi', icon: User, group: 'team', featured: true },
```

with:

```ts
  // Club și școală (Grupe and Prezență join in phase 4)
  { to: SPORTIVI_TO, label: 'Sportivi', icon: User, group: 'club', featured: true },

  // Sportivi și echipă
```

Replace the whole `app.addMenuLink({ to: SPORTIV_EDIT_TO, ... position: 7, });` block with:

```ts
  // The old profile editor: route only, it redirects to the athlete record (spec 7).
  app.router.addRoute({
    path: `${SPORTIV_EDIT_TO.slice(1)}/*`,
    lazy: async () => {
      const mod = await import('./SportivEditPage');
      return { Component: mod.default };
    },
  });
```

In `src/admin/dashboard/EdusportShell.tsx`, `GROUP_ICON` (Needs decision 11, option A), after `program: 'calendar',` add:

```ts
  club: 'user',
```

- [ ] **Step 5: Move the editor, then write the redirect**

```bash
mkdir -p src/admin/dashboard/sportivi
git mv src/admin/dashboard/SportivEditPage.tsx src/admin/dashboard/sportivi/ProfileEditor.tsx
```

In `src/admin/dashboard/sportivi/ProfileEditor.tsx` change only the imports:
- `} from '../ui';` -> `} from '../../ui';`
- `import { usePageForm } from '../lib';` -> `import { usePageForm } from '../../lib';`
- `import { PROGRAM_TYPES } from './constants';` -> `import { PROGRAM_TYPES } from '../constants';`
- `import { SPORTIVI_TO, SPORTIV_EDIT_TO } from './menu';` -> `import { SPORTIVI_TO, SPORTIV_EDIT_TO } from '../menu';`
- `import { ConfirmDialog } from '../ConfirmDialog';` -> `import { ConfirmDialog } from '../../ConfirmDialog';`
- replace `import { SPORTIV_DELETE_COPY } from './SportiviPage';` with (Task 7 rewrites `SportiviPage.tsx`; Task 8 removes this delete copy with the button):

```ts
/** Today's delete copy, kept with the editor until plan 3-5 Task 8 removes its delete button. */
const SPORTIV_DELETE_COPY = {
  title: 'Ștergi sportivul?',
  message: (name: string) =>
    `„${name}" se șterge definitiv, împreună cu profilul, rezultatele și sezoanele. Acțiunea nu poate fi anulată.`,
} as const;
```

New `src/admin/dashboard/SportivEditPage.tsx` (Needs decision 13, option A):

```tsx
import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { AdminPage, Loading } from '../ui';
import { SPORTIVI_PATH, athleteRecordTo, oldEditorProfileId } from '../../club/sportivi/routes';

/**
 * The old profile editor's address (gaps #42). `?id=<public profile>` (Competiții rows, old
 * bookmarks) opens that athlete's record; anything else opens the Sportivi list.
 */
export default function SportivEditPage() {
  const { get } = useFetchClient();
  const navigate = useNavigate();
  const { search } = useLocation();
  const started = React.useRef(false);
  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    const go = (to: string) => navigate(to, { replace: true });
    const profileId = oldEditorProfileId(search);
    if (!profileId) return go(SPORTIVI_PATH);
    get(`/api/club/athletes/by-profile/${encodeURIComponent(profileId)}`)
      .then((r: { data?: { data?: { documentId?: unknown } } }) => {
        const id = r?.data?.data?.documentId;
        go(typeof id === 'string' ? athleteRecordTo(id) : SPORTIVI_PATH);
      })
      .catch(() => go(SPORTIVI_PATH));
  }, [get, navigate, search]);
  return (
    <AdminPage>
      <Loading />
    </AdminPage>
  );
}
```

- [ ] **Step 6: Run the tests and the checks**

Run: `npx vitest run src/club/sportivi/__tests__/routes.test.ts && npx vitest run && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS (7 tests in the file), full suite green, zero type errors, checker exit 0. If the admin `tsc` reports another `Record<Group, ...>` without `club`, add `club` there with the value its `team` entry has.

- [ ] **Step 7: Commit**

```bash
git add src/club/sportivi/routes.ts src/club/sportivi/__tests__/routes.test.ts src/admin/dashboard/menu.tsx src/admin/dashboard/EdusportShell.tsx src/admin/dashboard/SportivEditPage.tsx src/admin/dashboard/sportivi/ProfileEditor.tsx
git commit -m "feat(sportivi): Club și școală section, record address, old editor redirect"
```

---

### Task 2: Sportivi list rules

**Files:**
- Create: `src/club/sportivi/list-view.ts`
- Test: `src/club/sportivi/__tests__/list-view.test.ts`

**Interfaces:**
- Consumes: `ACS_WORDS` (`src/club/acs.ts`), `STATUS_WORDS` (`src/club/history-text.ts`), `AthleteListPage`, `AthleteListRow` (`src/club/athletes/api-types.ts`).
- Produces:
  - `type SortKey = 'name' | 'age' | 'group'`, `type ListFilters`, `type FilterKey`, `type ListState = { season: string; q: string; filters: ListFilters; sort: SortKey; dir: 'asc' | 'desc'; page: number }`, `type Choice`, `type SectionModel` (same shape as plan 3-1 `FilterSection`)
  - `NO_SECTION`, `NO_GROUP`, `PAGE_SIZE = { desktop: 50, phone: 30 }`, `LIST_COPY`, `EMPTY_FILTERS`, `INITIAL_LIST_STATE`, `SORT_OPTIONS`
  - `listQueryString(s: ListState, pageSize: number): string` (query of `GET /api/club/athletes`)
  - `countWords(n, one, many)`, `athletesText(n)`, `ageText(age)`, `showLabel(n)`, `countLine(page)`, `incompleteBanner(n)`
  - `groupCell(row)`, `acsCell(row)`, `profileCell(row)`, `missingTip(row)`, `cardLine(row)`, `groupHeader(season)`, `seasonOptions(page)`, `seasonValue(state, page)`
  - `filterSections(state, page): SectionModel[]`, `sortSection(state): SectionModel`
  - `withSection(state, key, selected)`, `clearFilters(state)`, `withSearch(state, q)`, `withSeason(state, season)`, `withPage(state, page)`, `withHeaderSort(state, key)`, `showIncomplete(state)`

- [ ] **Step 1: Write the failing test**

`src/club/sportivi/__tests__/list-view.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AthleteListPage, AthleteListRow } from '../../athletes/api-types';
import { NO_SECTION as API_NO_SECTION } from '../../athletes/list';
import {
  INITIAL_LIST_STATE, LIST_COPY, NO_GROUP, NO_SECTION, ageText, athletesText, cardLine, clearFilters, countLine, filterSections, groupCell, groupHeader,
  incompleteBanner, listQueryString, missingTip, acsCell, profileCell, seasonOptions, seasonValue, showIncomplete, showLabel, sortSection,
  withHeaderSort, withPage, withSearch, withSeason, withSection, type ListState,
} from '../list-view';

const page = (over: Partial<AthleteListPage> = {}): AthleteListPage => ({
  data: [],
  pagination: { page: 1, pageSize: 50, total: 218, pageCount: 5 },
  unfiltered: 240,
  incomplete: 12,
  season: { documentId: 's26', label: '2026-2027' },
  seasons: [{ documentId: 's25', label: '2025-2026', isCurrent: false }, { documentId: 's26', label: '2026-2027', isCurrent: true }],
  options: {
    sections: [{ value: 'afi', label: 'Școala de patinaj' }, { value: 'club', label: 'Club' }],
    groups: [{ value: 'g-pp', label: 'Primii Pași', sectionName: 'Școala de patinaj' }, { value: 'g-pro', label: 'Profesioniști', sectionName: 'Club' }],
  },
  ...over,
});
const row = (over: Partial<AthleteListRow> = {}): AthleteListRow => ({
  documentId: 'a1', name: 'Maria Pop', age: 10, birthDate: '14.03.2016', status: 'activ', dataIncomplete: false, missing: [], mainGroup: null,
  contactName: null, phone: null, acs: 'nu', publicProfile: 'ascuns', possibleDuplicate: false, ...over,
});
const params = (qs: string) => Object.fromEntries(new URLSearchParams(qs));

describe('the list request (spec 5)', () => {
  it('asks for Nume A-Z, page 1, 50 rows by default; inactive stay hidden (no status)', () => {
    expect(listQueryString(INITIAL_LIST_STATE, 50)).toBe('sort=name&dir=asc&page=1&pageSize=50');
  });

  it('sends every filter as the plan 3-2 list route reads it', () => {
    const s: ListState = {
      season: 's25', q: '  maria ', sort: 'age', dir: 'desc', page: 2,
      filters: { section: [NO_SECTION], group: ['g-pp', NO_GROUP], acs: ['in_asteptare'], profile: ['public'], data: ['incomplete'], status: ['activ', 'inactiv'], duplicates: ['da'] },
    };
    expect(params(listQueryString(s, 30))).toEqual({
      season: 's25', q: 'maria', section: 'none', group: 'g-pp', noGroup: 'true', acs: 'in_asteptare', profile: 'public', data: 'incomplete',
      status: 'activ,inactiv', duplicates: 'true', sort: 'age', dir: 'desc', page: '2', pageSize: '30',
    });
  });

  it('"Fără grupă" alone sends only noGroup; "Fără secțiune" is the route own value', () => {
    const s = withSection(INITIAL_LIST_STATE, 'group', [NO_GROUP]);
    expect(params(listQueryString(s, 50))).toMatchObject({ noGroup: 'true' });
    expect(params(listQueryString(s, 50)).group).toBeUndefined();
    expect(NO_SECTION).toBe(API_NO_SECTION);
  });
});

describe('counts and plurals (Needs decision 7, option A)', () => {
  it('sportivi, with "de" from 20', () => {
    expect([0, 1, 2, 19, 20, 101, 119, 120, 200].map(athletesText)).toEqual([
      '0 sportivi', '1 sportiv', '2 sportivi', '19 sportivi', '20 de sportivi', '101 sportivi', '119 sportivi', '120 de sportivi', '200 de sportivi',
    ]);
  });

  it('banner, phone footer, count line, ages', () => {
    expect(incompleteBanner(1)).toBe('1 sportiv are date incomplete.');
    expect(incompleteBanner(12)).toBe('12 sportivi au date incomplete.');
    expect(incompleteBanner(25)).toBe('25 de sportivi au date incomplete.');
    expect(showLabel(1)).toBe('Arată 1 sportiv');
    expect(showLabel(218)).toBe('Arată 218 de sportivi');
    expect(countLine(page())).toBe('218 din 240 de sportivi');
    expect(countLine(page({ pagination: { page: 1, pageSize: 50, total: 3, pageCount: 1 }, unfiltered: 16 }))).toBe('3 din 16 sportivi');
    expect([ageText(null), ageText(10), ageText(38)]).toEqual(['', '10 ani', '38 de ani']);
  });
});

describe('cells (spec 5)', () => {
  it('group, A.C.S., profile, missing marker tooltip, phone card line', () => {
    expect(groupCell(row())).toBe('Fără grupă');
    expect(groupCell(row({ mainGroup: { documentId: 'g-pp', name: 'Primii Pași' } }))).toBe('Primii Pași');
    expect([acsCell(row({ acs: 'da' })), acsCell(row()), acsCell(row({ acs: 'in_asteptare' }))]).toEqual(['Da', 'Nu', 'În așteptare']);
    expect([profileCell(row({ publicProfile: 'public' })), profileCell(row())]).toEqual(['Public', 'Ascuns']);
    expect(missingTip(row({ dataIncomplete: true, missing: ['data nașterii', 'e-mail'] }))).toBe('Lipsesc: data nașterii, e-mail');
    expect(missingTip(row({ dataIncomplete: true, missing: [] }))).toBeNull();
    expect(cardLine(row({ mainGroup: { documentId: 'g-pp', name: 'Primii Pași' } }))).toBe('10 ani, Primii Pași');
    expect(cardLine(row({ age: null }))).toBe('Fără grupă');
  });

  it('season header, selector options and value', () => {
    expect(groupHeader(page().season)).toBe('Grupa 2026-2027');
    expect(groupHeader(null)).toBe('Grupa');
    expect(seasonOptions(page())).toEqual([{ value: 's25', label: 'Sezon 2025-2026' }, { value: 's26', label: 'Sezon 2026-2027' }]);
    expect(seasonOptions(null)).toEqual([]);
    expect(seasonValue(INITIAL_LIST_STATE, page())).toBe('s26');
    expect(seasonValue(withSeason(INITIAL_LIST_STATE, 's25'), page())).toBe('s25');
  });

  it('copy of the header and the empty list', () => {
    expect(LIST_COPY.subtitle).toBe('Toți sportivii clubului. Doar în panou, nu sunt publici.');
    expect(LIST_COPY.search).toBe('Caută după nume, părinte, telefon, e-mail sau nr. înscriere...');
    expect(LIST_COPY.empty).toBe('Niciun sportiv nu corespunde filtrelor.');
    expect(LIST_COPY.more).toBe('Încarcă încă 30');
  });
});

describe('filters-v3 sections (spec 5)', () => {
  it('sections in the spec order, with their options and the chosen values', () => {
    const s = withSection(INITIAL_LIST_STATE, 'acs', ['da']);
    const sections = filterSections(s, page());
    expect(sections.map((x) => x.label)).toEqual(['Secțiune', 'Grupa', 'Membru A.C.S.', 'Profil public', 'Date', 'Status', 'Posibile dubluri']);
    const labels = (key: string) => sections.find((x) => x.key === key)?.options.map((o) => o.label);
    expect(labels('section')).toEqual(['Școala de patinaj', 'Club', 'Fără secțiune']);
    expect(labels('group')).toEqual(['Primii Pași', 'Profesioniști', 'Fără grupă']);
    expect(labels('acs')).toEqual(['Da', 'Nu', 'În așteptare']);
    expect(labels('profile')).toEqual(['Public', 'Ascuns']);
    expect(labels('data')).toEqual(['Complete', 'Incomplete']);
    expect(labels('status')).toEqual(['Nou', 'Activ', 'Inactiv']);
    expect(labels('duplicates')).toEqual(['Da']);
    expect(sections.find((x) => x.key === 'acs')?.selected).toEqual(['da']);
  });

  it('before the first answer only the fixed options show', () => {
    expect(filterSections(INITIAL_LIST_STATE, null)[1].options).toEqual([{ value: NO_GROUP, label: 'Fără grupă' }]);
  });

  it('sort is one more single section on phones', () => {
    expect(sortSection(INITIAL_LIST_STATE)).toEqual({
      key: 'sort', label: 'Sortare', single: true, selected: ['name'],
      options: [{ value: 'name', label: 'Nume A-Z' }, { value: 'age', label: 'Vârstă' }, { value: 'group', label: 'Grupă' }],
    });
  });
});

describe('state changes', () => {
  const far = withPage(INITIAL_LIST_STATE, 3);

  it('every search, season, filter or sort change starts again at page 1', () => {
    expect(withSearch(far, 'ana').page).toBe(1);
    expect(withSeason(far, 's25').page).toBe(1);
    expect(withSection(far, 'status', ['inactiv'])).toMatchObject({ page: 1, filters: { status: ['inactiv'] } });
    expect(withSection(far, 'sort', ['age'])).toMatchObject({ page: 1, sort: 'age', dir: 'asc' });
    expect(withHeaderSort(far, 'age').page).toBe(1);
    expect(withSection(far, 'unknown', ['x'])).toBe(far);
  });

  it('header sort toggles the direction of the same column', () => {
    const asc = withHeaderSort(INITIAL_LIST_STATE, 'group');
    expect([asc.sort, asc.dir]).toEqual(['group', 'asc']);
    expect(withHeaderSort(asc, 'group').dir).toBe('desc');
    expect(withHeaderSort(withHeaderSort(asc, 'group'), 'group').dir).toBe('asc');
    expect(withHeaderSort(INITIAL_LIST_STATE, 'name').dir).toBe('desc');
  });

  it('"Șterge tot" clears the filters only; "Arată-i" picks Date: Incomplete', () => {
    const busy = withSearch(withSection(withSeason(INITIAL_LIST_STATE, 's25'), 'acs', ['da']), 'ana');
    expect(clearFilters(busy)).toMatchObject({ season: 's25', q: 'ana', filters: { acs: [] }, page: 1 });
    expect(showIncomplete(INITIAL_LIST_STATE).filters.data).toEqual(['incomplete']);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/sportivi/__tests__/list-view.test.ts`
Expected: FAIL (`Failed to resolve import "../list-view"`).

- [ ] **Step 3: The rules**

`src/club/sportivi/list-view.ts`:

```ts
import { ACS_WORDS } from '../acs';
import type { AthleteListPage, AthleteListRow } from '../athletes/api-types';
import { STATUS_WORDS } from '../history-text';

/**
 * Rules of the Sportivi list (spec 5): the query of GET /api/club/athletes (plan 3-2), the
 * filters-v3 sections, the cells and the count texts. Pure: the admin bundle imports it.
 */

export type SortKey = 'name' | 'age' | 'group';
export type ListFilters = {
  section: string[];
  group: string[];
  acs: string[];
  profile: string[];
  data: string[];
  status: string[];
  duplicates: string[];
};
export type FilterKey = keyof ListFilters;
export type ListState = { season: string; q: string; filters: ListFilters; sort: SortKey; dir: 'asc' | 'desc'; page: number };
export type Choice = { value: string; label: string };
/** Same shape as plan 3-1 `FilterSection`. */
export type SectionModel = { key: string; label: string; options: Choice[]; selected: string[]; single?: boolean };

/** "Fără secțiune" is the route's `section=none`; "Fără grupă" inside Grupa becomes `noGroup=true` (Needs decision 6, option A). */
export const NO_SECTION = 'none';
export const NO_GROUP = 'none';
export const PAGE_SIZE = { desktop: 50, phone: 30 } as const;

export const LIST_COPY = {
  title: 'Sportivi',
  subtitle: 'Toți sportivii clubului. Doar în panou, nu sunt publici.',
  add: 'Adaugă sportiv',
  search: 'Caută după nume, părinte, telefon, e-mail sau nr. înscriere...',
  season: 'Sezon',
  sort: 'Sortare',
  empty: 'Niciun sportiv nu corespunde filtrelor.',
  loadFailed: 'Nu am putut încărca sportivii.',
  showThem: 'Arată-i',
  more: 'Încarcă încă 30',
  incompleteMarker: 'date lipsă',
  incompleteBadge: 'Date incomplete',
  noGroup: 'Fără grupă',
  columns: { name: 'Sportiv', age: 'Vârstă', contact: 'Contact', acs: 'Membru A.C.S.', profile: 'Profil public' },
} as const;

const FILTER_KEYS: readonly FilterKey[] = ['section', 'group', 'acs', 'profile', 'data', 'status', 'duplicates'];
export const EMPTY_FILTERS: ListFilters = { section: [], group: [], acs: [], profile: [], data: [], status: [], duplicates: [] };
export const INITIAL_LIST_STATE: ListState = { season: '', q: '', filters: EMPTY_FILTERS, sort: 'name', dir: 'asc', page: 1 };

export const SORT_OPTIONS: Choice[] = [
  { value: 'name', label: 'Nume A-Z' },
  { value: 'age', label: 'Vârstă' },
  { value: 'group', label: 'Grupă' },
];
const ACS_OPTIONS: Choice[] = (['da', 'nu', 'in_asteptare'] as const).map((value) => ({ value, label: ACS_WORDS[value] }));
const STATUS_OPTIONS: Choice[] = (['nou', 'activ', 'inactiv'] as const).map((value) => ({ value, label: STATUS_WORDS[value] }));
const PROFILE_OPTIONS: Choice[] = [{ value: 'public', label: 'Public' }, { value: 'ascuns', label: 'Ascuns' }];
const DATA_OPTIONS: Choice[] = [{ value: 'complete', label: 'Complete' }, { value: 'incomplete', label: 'Incomplete' }];
const DUPLICATE_OPTIONS: Choice[] = [{ value: 'da', label: 'Da' }];

/** Query string of GET /api/club/athletes: lists comma-separated, inactive hidden unless Status asks (spec 5). */
export function listQueryString(s: ListState, pageSize: number): string {
  const p = new URLSearchParams();
  if (s.season) p.set('season', s.season);
  if (s.q.trim()) p.set('q', s.q.trim());
  const f = s.filters;
  const lists: [string, string[]][] = [
    ['section', f.section], ['group', f.group.filter((g) => g !== NO_GROUP)], ['acs', f.acs],
    ['profile', f.profile], ['data', f.data], ['status', f.status],
  ];
  for (const [key, values] of lists) if (values.length) p.set(key, values.join(','));
  if (f.group.includes(NO_GROUP)) p.set('noGroup', 'true');
  if (f.duplicates.length) p.set('duplicates', 'true');
  p.set('sort', s.sort);
  p.set('dir', s.dir);
  p.set('page', String(s.page));
  p.set('pageSize', String(pageSize));
  return p.toString();
}

/** Romanian "de" after 20, 100, 120, ... but not after 101 to 119 (Needs decision 7, option A). */
const needsDe = (n: number): boolean => n >= 20 && (n % 100 === 0 || n % 100 >= 20);
export const countWords = (n: number, one: string, many: string): string => (n === 1 ? `1 ${one}` : `${n} ${needsDe(n) ? 'de ' : ''}${many}`);
export const athletesText = (n: number): string => countWords(n, 'sportiv', 'sportivi');
export const ageText = (age: number | null): string => (age === null ? '' : countWords(age, 'an', 'ani'));
export const showLabel = (n: number): string => `Arată ${athletesText(n)}`;
export const countLine = (p: AthleteListPage): string => `${p.pagination.total} din ${athletesText(p.unfiltered)}`;
export const incompleteBanner = (n: number): string => (n === 1 ? '1 sportiv are date incomplete.' : `${athletesText(n)} au date incomplete.`);

export const groupCell = (r: AthleteListRow): string => r.mainGroup?.name ?? LIST_COPY.noGroup;
export const acsCell = (r: AthleteListRow): string => ACS_WORDS[r.acs];
export const profileCell = (r: AthleteListRow): string => (r.publicProfile === 'public' ? 'Public' : 'Ascuns');
/** Tooltip of "date lipsă"; none when a deploy-marked record names no field (plan 3-2 note). */
export const missingTip = (r: AthleteListRow): string | null => (r.missing.length ? `Lipsesc: ${r.missing.join(', ')}` : null);
export const cardLine = (r: AthleteListRow): string => [ageText(r.age), groupCell(r)].filter(Boolean).join(', ');
export const groupHeader = (season: AthleteListPage['season']): string => (season ? `Grupa ${season.label}` : 'Grupa');

export const seasonOptions = (p: AthleteListPage | null): Choice[] =>
  (p?.seasons ?? []).map((s) => ({ value: s.documentId, label: `${LIST_COPY.season} ${s.label}` }));
export const seasonValue = (s: ListState, p: AthleteListPage | null): string => s.season || p?.season?.documentId || '';

export function filterSections(s: ListState, p: AthleteListPage | null): SectionModel[] {
  const f = s.filters;
  const sections = p?.options.sections ?? [];
  const groups = (p?.options.groups ?? []).map((g) => ({ value: g.value, label: g.label }));
  return [
    { key: 'section', label: 'Secțiune', options: [...sections, { value: NO_SECTION, label: 'Fără secțiune' }], selected: f.section },
    { key: 'group', label: 'Grupa', options: [...groups, { value: NO_GROUP, label: LIST_COPY.noGroup }], selected: f.group },
    { key: 'acs', label: 'Membru A.C.S.', options: ACS_OPTIONS, selected: f.acs },
    { key: 'profile', label: 'Profil public', options: PROFILE_OPTIONS, selected: f.profile },
    { key: 'data', label: 'Date', options: DATA_OPTIONS, selected: f.data },
    { key: 'status', label: 'Status', options: STATUS_OPTIONS, selected: f.status },
    { key: 'duplicates', label: 'Posibile dubluri', options: DUPLICATE_OPTIONS, selected: f.duplicates },
  ];
}

export const sortSection = (s: ListState): SectionModel => ({ key: 'sort', label: LIST_COPY.sort, options: SORT_OPTIONS, selected: [s.sort], single: true });

const isFilterKey = (key: string): key is FilterKey => (FILTER_KEYS as readonly string[]).includes(key);
const toSort = (v: string | undefined): SortKey => (v === 'age' || v === 'group' ? v : 'name');

export function withSection(s: ListState, key: string, selected: string[]): ListState {
  if (key === 'sort') return { ...s, sort: toSort(selected[0]), dir: 'asc', page: 1 };
  if (!isFilterKey(key)) return s;
  return { ...s, filters: { ...s.filters, [key]: selected }, page: 1 };
}

export const clearFilters = (s: ListState): ListState => ({ ...s, filters: EMPTY_FILTERS, page: 1 });
export const withSearch = (s: ListState, q: string): ListState => ({ ...s, q, page: 1 });
export const withSeason = (s: ListState, season: string): ListState => ({ ...s, season, page: 1 });
export const withPage = (s: ListState, page: number): ListState => ({ ...s, page });
export const withHeaderSort = (s: ListState, key: SortKey): ListState => ({
  ...s, sort: key, dir: s.sort === key && s.dir === 'asc' ? 'desc' : 'asc', page: 1,
});
export const showIncomplete = (s: ListState): ListState => withSection(s, 'data', ['incomplete']);
```

- [ ] **Step 4: Run the tests and the checks**

Run: `npx vitest run src/club/sportivi/__tests__/list-view.test.ts && npx vitest run && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json`
Expected: PASS (14 tests in the file), full suite green, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/sportivi/list-view.ts src/club/sportivi/__tests__/list-view.test.ts
git commit -m "feat(sportivi): list query, filter sections and count texts"
```

---

### Task 3: Athlete record rules

**Files:**
- Create: `src/club/sportivi/record-view.ts`
- Test: `src/club/sportivi/__tests__/record-view.test.ts`

**Interfaces:**
- Consumes: `ACS_WORDS`; `ATHLETE_FIELDS`, `ATHLETE_FIELD_LABELS`, `missingText`, `AthleteField`, `AthleteStatus` (`athlete-data.ts`); `AthleteRecord`, `AthleteEditResponse`; `ADMIN_ERRORS` (`nameRequired` "Completați numele.", `birthDate` "Alegeți data nașterii."); plan 3-1 `DateParts`, `EMPTY_DATE`, `partsFromDisplay`, `partsToDisplay` (`src/club/ui-birth-date.ts`).
- Produces:
  - `type RecordTab = 'date' | 'profil' | 'documente' | 'istoric'`, `type MenuKey = 'status' | 'merge' | 'delete'`, `RECORD_COPY`
  - `recordSubline(r)`, `recordTabs(r)`, `fieldRows(r): FieldRowView[]`, `acsLine(r): string | null`, `registrationLine(reg)`, `saveToast(res)`
  - `type EditDraft = { name: string; birth: DateParts; contactName: string; phone: string; email: string }`, `type EditBody = { name; birthDate; contactName; phone; email }` (all strings, the body of `PUT /api/club/athletes/:id` and `POST /api/club/athletes`), `type DraftErrors`, `type DraftCheck`, `EMPTY_DRAFT`, `editDraft(r)`, `newAthleteDraft(text)`, `checkDraft(d, birthRequired): DraftCheck`
  - `historyWhen(iso): string`, `seasonFromState(state: unknown): string | null`, `menuItems(status): { key: MenuKey; label: string }[]`

- [ ] **Step 1: Write the failing test**

`src/club/sportivi/__tests__/record-view.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AthleteRecord } from '../../athletes/api-types';
import {
  EMPTY_DRAFT, RECORD_COPY, acsLine, checkDraft, editDraft, fieldRows, historyWhen, menuItems, newAthleteDraft, recordSubline, recordTabs,
  registrationLine, saveToast, seasonFromState,
} from '../record-view';

const record = (over: Partial<AthleteRecord> = {}): AthleteRecord => ({
  documentId: 'a1',
  fields: { name: 'Maria Pop', birthDate: '14.03.2016', contactName: 'Ana Pop', phone: '0722 000 000', email: null },
  missing: ['email'],
  status: 'activ',
  dataIncomplete: true,
  header: { birthDate: '14.03.2016', mainGroup: 'Primii Pași' },
  season: { documentId: 's26', label: '2026-2027' },
  acs: { seasonLabel: '2026-2027', state: 'in_asteptare' },
  registrations: [{ documentId: 'r1', number: '2026-0142', season: '2026-2027', status: 'Confirmat' }],
  documents: [],
  profile: null,
  duplicates: [],
  historyCount: 4,
  ...over,
});

describe('header (spec 6.1)', () => {
  it('sub-line: birth date and main group, or "data nașterii lipsește"', () => {
    expect(recordSubline(record())).toBe('14.03.2016, Primii Pași');
    expect(recordSubline(record({ header: { birthDate: null, mainGroup: 'Primii Pași' } }))).toBe('data nașterii lipsește, Primii Pași');
    expect(recordSubline(record({ header: { birthDate: '14.03.2016', mainGroup: null } }))).toBe('14.03.2016');
    expect(recordSubline(record({ header: { birthDate: null, mainGroup: null } }))).toBe('data nașterii lipsește');
  });

  it('tabs Date | Profil public | Documente | Istoric (n)', () => {
    expect(recordTabs(record())).toEqual([
      { id: 'date', label: 'Date' },
      { id: 'profil', label: 'Profil public' },
      { id: 'documente', label: 'Documente' },
      { id: 'istoric', label: 'Istoric', count: 4 },
    ]);
  });

  it('"..." menu: Marchează inactiv / activ, Unește cu alt sportiv, Șterge sportivul', () => {
    expect(menuItems('activ').map((i) => i.label)).toEqual(['Marchează inactiv', 'Unește cu alt sportiv', 'Șterge sportivul']);
    expect(menuItems('nou')[0].label).toBe('Marchează inactiv');
    expect(menuItems('inactiv')[0]).toEqual({ key: 'status', label: 'Marchează activ' });
  });

  it('the record season comes from the list (navigation state)', () => {
    expect(seasonFromState({ season: 's25' })).toBe('s25');
    expect([seasonFromState(null), seasonFromState({}), seasonFromState({ season: '' }), seasonFromState('s25')]).toEqual([null, null, null, null]);
  });
});

describe('Date tab (spec 6.2)', () => {
  it('rows in order, "lipsește" on missing fields, empty values blank', () => {
    const rows = fieldRows(record());
    expect(rows.map((r) => r.label)).toEqual(['Nume și prenume', 'Data nașterii', 'Persoana de contact', 'Telefon', 'E-mail']);
    expect(rows[4]).toEqual({ field: 'email', label: 'E-mail', value: '', missing: true });
    expect(rows[1].missing).toBe(false);
  });

  it('A.C.S. line and the "Înscrieri" rows', () => {
    expect(acsLine(record())).toBe('Membru A.C.S. 2026-2027: În așteptare');
    expect(acsLine(record({ acs: { seasonLabel: null, state: 'nu' } }))).toBeNull();
    expect(registrationLine(record().registrations[0])).toBe('2026-0142, 2026-2027, Confirmat');
    expect(registrationLine({ documentId: 'r2', number: null, season: '2025-2026', status: 'Nou' })).toBe('2025-2026, Nou');
  });

  it('toasts after saving (Needs decision 5, option A for no change)', () => {
    expect(saveToast({ record: record(), changed: [] })).toBe('Nicio modificare.');
    expect(saveToast({ record: record({ missing: ['birthDate', 'email'] }), changed: ['phone'] })).toBe('Salvat. Mai lipsesc: data nașterii, e-mail.');
    expect(saveToast({ record: record({ missing: [] }), changed: ['email'] })).toBe('Salvat. Datele sunt complete.');
  });

  it('the draft starts from the record; the picker gets the stored date', () => {
    expect(editDraft(record())).toEqual({ name: 'Maria Pop', birth: { day: 14, month: 3, year: 2016 }, contactName: 'Ana Pop', phone: '0722 000 000', email: '' });
    expect(editDraft(record({ fields: { ...record().fields, birthDate: null } })).birth).toEqual({ day: null, month: null, year: null });
    expect(newAthleteDraft('  Ion Pop ')).toEqual({ ...EMPTY_DRAFT, name: 'Ion Pop' });
  });

  it('checkDraft: trimmed body, name required, no half or impossible date', () => {
    const d = editDraft(record());
    expect(checkDraft({ ...d, name: ' Maria  Pop ', email: ' m@x.ro ' }, false)).toEqual({
      ok: true, body: { name: 'Maria  Pop', birthDate: '14.03.2016', contactName: 'Ana Pop', phone: '0722 000 000', email: 'm@x.ro' },
    });
    expect(checkDraft({ ...d, name: '  ' }, false)).toEqual({ ok: false, field: 'name', error: 'Completați numele.' });
    expect(checkDraft({ ...d, birth: { day: 14, month: 3, year: null } }, false)).toEqual({ ok: false, field: 'birthDate', error: 'Alegeți data nașterii.' });
    expect(checkDraft({ ...d, birth: { day: 31, month: 4, year: 2016 } }, false)).toMatchObject({ ok: false, field: 'birthDate' });
  });

  it('an empty date is allowed on Date and refused by "Adaugă sportiv" (gaps #41)', () => {
    const blank = { ...editDraft(record()), birth: { day: null, month: null, year: null } };
    expect(checkDraft(blank, false)).toMatchObject({ ok: true, body: { birthDate: '' } });
    expect(checkDraft(blank, true)).toEqual({ ok: false, field: 'birthDate', error: 'Alegeți data nașterii.' });
  });
});

describe('Istoric and copy', () => {
  it('time in Bucharest, "3 oct 2026, 14:22" (Needs decision 8, option A)', () => {
    expect(historyWhen('2026-10-03T11:22:00.000Z')).toBe('3 oct 2026, 14:22');
    expect(historyWhen('2026-12-01T08:05:00.000Z')).toBe('1 dec 2026, 10:05');
    expect(historyWhen('nope')).toBe('');
  });

  it('copy from the spec', () => {
    expect(RECORD_COPY.requiredHint).toBe('Obligatorii pentru "complet": nume, data nașterii, persoana de contact, telefon, e-mail.');
    expect(RECORD_COPY.inactiveDialog).toEqual({ title: 'Marchezi sportivul ca inactiv?', message: 'Nu mai apare în liste. Istoricul rămâne.', confirm: 'Marchează inactiv' });
    expect(RECORD_COPY.deleteDialog.message('Ana Pop')).toBe(
      '„Ana Pop” se șterge definitiv, împreună cu profilul public, rezultatele și sezoanele. Înscrierile rămân, fără legătură. Acțiunea nu poate fi anulată.',
    );
    expect(RECORD_COPY.duplicate.line('Ana Pop')).toBe('Posibil același copil cu Ana Pop');
    expect([RECORD_COPY.duplicate.merge, RECORD_COPY.duplicate.dismiss]).toEqual(['Unește', 'Nu e același copil']);
    expect(RECORD_COPY.profile).toEqual({
      create: 'Creează profil public', nameHint: 'Numele se schimbă în Date.', note: 'Datele de contact și data nașterii nu ajung niciodată aici.',
    });
    expect(RECORD_COPY.noDocuments).toBe('Niciun document încă.');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/sportivi/__tests__/record-view.test.ts`
Expected: FAIL (`Failed to resolve import "../record-view"`).

- [ ] **Step 3: The rules**

`src/club/sportivi/record-view.ts`:

```ts
import { ACS_WORDS } from '../acs';
import { ATHLETE_FIELDS, ATHLETE_FIELD_LABELS, missingText, type AthleteField, type AthleteStatus } from '../athlete-data';
import type { AthleteEditResponse, AthleteRecord } from '../athletes/api-types';
import { ADMIN_ERRORS } from '../athletes/errors';
import { EMPTY_DATE, partsFromDisplay, partsToDisplay, type DateParts } from '../ui-birth-date';

/** Rules of the athlete record (spec 6): header, Date tab, toasts, Istoric time, "..." menu. Pure. */

export type RecordTab = 'date' | 'profil' | 'documente' | 'istoric';
export type MenuKey = 'status' | 'merge' | 'delete';

export const RECORD_COPY = {
  back: 'Sportivi',
  tabsLabel: 'Fișa sportivului',
  incomplete: 'Date incomplete',
  noBirthDate: 'data nașterii lipsește',
  missing: 'lipsește',
  requiredHint: 'Obligatorii pentru "complet": nume, data nașterii, persoana de contact, telefon, e-mail.',
  edit: 'Editează',
  save: 'Salvează',
  cancel: 'Anulează',
  noChange: 'Nicio modificare.',
  complete: 'Salvat. Datele sunt complete.',
  registrations: 'Înscrieri',
  noDocuments: 'Niciun document încă.',
  view: 'Vezi',
  download: 'Descarcă',
  documentFailed: 'Documentul nu a putut fi descărcat.',
  loadFailed: 'Nu am putut încărca sportivul.',
  historyFailed: 'Nu am putut încărca istoricul.',
  tabs: { date: 'Date', profil: 'Profil public', documente: 'Documente', istoric: 'Istoric' },
  menu: { button: 'Mai multe acțiuni', inactive: 'Marchează inactiv', active: 'Marchează activ', merge: 'Unește cu alt sportiv', remove: 'Șterge sportivul' },
  inactiveDialog: { title: 'Marchezi sportivul ca inactiv?', message: 'Nu mai apare în liste. Istoricul rămâne.', confirm: 'Marchează inactiv' },
  deleteDialog: {
    title: 'Ștergi sportivul?',
    message: (name: string) =>
      `„${name}” se șterge definitiv, împreună cu profilul public, rezultatele și sezoanele. Înscrierile rămân, fără legătură. Acțiunea nu poate fi anulată.`,
  },
  duplicate: { line: (name: string) => `Posibil același copil cu ${name}`, merge: 'Unește', dismiss: 'Nu e același copil' },
  profile: {
    create: 'Creează profil public',
    nameHint: 'Numele se schimbă în Date.',
    note: 'Datele de contact și data nașterii nu ajung niciodată aici.',
  },
} as const;

/** "<data nașterii>, <grupa principală>", or "data nașterii lipsește" (spec 6.1; no middle dot, gaps #1). */
export function recordSubline(r: AthleteRecord): string {
  return [r.header.birthDate ?? RECORD_COPY.noBirthDate, r.header.mainGroup].filter(Boolean).join(', ');
}

export function recordTabs(r: AthleteRecord): { id: RecordTab; label: string; count?: number }[] {
  return [
    { id: 'date', label: RECORD_COPY.tabs.date },
    { id: 'profil', label: RECORD_COPY.tabs.profil },
    { id: 'documente', label: RECORD_COPY.tabs.documente },
    { id: 'istoric', label: RECORD_COPY.tabs.istoric, count: r.historyCount },
  ];
}

export type FieldRowView = { field: AthleteField; label: string; value: string; missing: boolean };
export const fieldRows = (r: AthleteRecord): FieldRowView[] =>
  ATHLETE_FIELDS.map((field) => ({ field, label: ATHLETE_FIELD_LABELS[field], value: r.fields[field] ?? '', missing: r.missing.includes(field) }));

/** "Membru A.C.S. <sezon>: <stare>" of the selected or current season, read-only (gaps #11). */
export const acsLine = (r: AthleteRecord): string | null => (r.acs.seasonLabel ? `Membru A.C.S. ${r.acs.seasonLabel}: ${ACS_WORDS[r.acs.state]}` : null);

/** "<nr>, <sezon>, <status>" (gaps #11); an empty part is left out. */
export const registrationLine = (reg: AthleteRecord['registrations'][number]): string => [reg.number, reg.season, reg.status].filter(Boolean).join(', ');

/** "Salvat. Mai lipsesc: <câmpuri>." / "Salvat. Datele sunt complete." (proto v5); no change: Needs decision 5, option A. */
export function saveToast(res: AthleteEditResponse): string {
  if (res.changed.length === 0) return RECORD_COPY.noChange;
  const missing = res.record.missing;
  return missing.length ? `Salvat. Mai lipsesc: ${missingText(missing)}.` : RECORD_COPY.complete;
}

export type EditDraft = { name: string; birth: DateParts; contactName: string; phone: string; email: string };
export type EditBody = { name: string; birthDate: string; contactName: string; phone: string; email: string };
export type DraftErrors = Partial<Record<'name' | 'birthDate', string>>;
export type DraftCheck = { ok: true; body: EditBody } | { ok: false; field: 'name' | 'birthDate'; error: string };

export const EMPTY_DRAFT: EditDraft = { name: '', birth: EMPTY_DATE, contactName: '', phone: '', email: '' };

export function editDraft(r: AthleteRecord): EditDraft {
  const f = r.fields;
  return { name: f.name ?? '', birth: partsFromDisplay(f.birthDate) ?? EMPTY_DATE, contactName: f.contactName ?? '', phone: f.phone ?? '', email: f.email ?? '' };
}

/** "Sportiv nou" in "Adaugă sportiv": the searched text becomes the name (Needs decision 1b, option A). */
export const newAthleteDraft = (text: string): EditDraft => ({ ...EMPTY_DRAFT, name: text.trim() });

const isBlankDate = (p: DateParts): boolean => p.day === null && p.month === null && p.year === null;

/** The body to send, or the first refusal: a name, and a whole possible date or none (required by "Adaugă sportiv", gaps #41). */
export function checkDraft(d: EditDraft, birthRequired: boolean): DraftCheck {
  const name = d.name.trim();
  if (!name) return { ok: false, field: 'name', error: ADMIN_ERRORS.nameRequired };
  const birthDate = isBlankDate(d.birth) ? '' : partsToDisplay(d.birth);
  if (birthDate === null || (birthRequired && !birthDate)) return { ok: false, field: 'birthDate', error: ADMIN_ERRORS.birthDate };
  return { ok: true, body: { name, birthDate, contactName: d.contactName.trim(), phone: d.phone.trim(), email: d.email.trim() } };
}

const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

/** "3 oct 2026, 14:22" in Bucharest time (Needs decision 8, option A); '' for an unreadable value. */
export function historyWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${Number(part('day'))} ${MONTHS[Number(part('month')) - 1]} ${part('year')}, ${part('hour')}:${part('minute')}`;
}

/** The season the list showed, passed as navigation state to the record (spec 6.2 "selected/current season"). */
export function seasonFromState(state: unknown): string | null {
  const season = state && typeof state === 'object' ? (state as { season?: unknown }).season : null;
  return typeof season === 'string' && season ? season : null;
}

export function menuItems(status: AthleteStatus): { key: MenuKey; label: string }[] {
  return [
    { key: 'status', label: status === 'inactiv' ? RECORD_COPY.menu.active : RECORD_COPY.menu.inactive },
    { key: 'merge', label: RECORD_COPY.menu.merge },
    { key: 'delete', label: RECORD_COPY.menu.remove },
  ];
}
```

- [ ] **Step 4: Run the tests and the checks**

Run: `npx vitest run src/club/sportivi/__tests__/record-view.test.ts && npx vitest run && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json`
Expected: PASS (12 tests in the file), full suite green, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/sportivi/record-view.ts src/club/sportivi/__tests__/record-view.test.ts
git commit -m "feat(sportivi): record header, Date tab draft check and history time"
```

---

### Task 4: Search rows and merge choices

**Files:**
- Create: `src/club/sportivi/search-view.ts`, `src/club/sportivi/merge-view.ts`
- Test: `src/club/sportivi/__tests__/search-merge.test.ts`

**Interfaces:**
- Consumes: `AthleteCard`, `MergePreview`, `MergeSideView`; `ATHLETE_FIELDS`, `ATHLETE_FIELD_LABELS`, `AthleteField`.
- Produces:
  - `search-view.ts`: `SEARCH_COPY`, `ADD_COPY`, `type SearchResult = { q: string; cards: AthleteCard[] }`, `searchUrl(q)`, `cardSubline(card)`, `withoutAthlete(cards, id?)`, `showNewRow(result)`, `noResultsText(result)`
  - `merge-view.ts`: `MERGE_COPY`, `type Side = 'a' | 'b'`, `SIDES`, `type MergeState = { kept: Side; picks: Partial<Record<AthleteField, Side>> }`, `initialMerge()`, `withKept(side)`, `withPick(state, field, side)`, `pickOf(state, field)`, `sides(preview)`, `mergeRequest(preview, state): { keptId: string; removedId: string; take: AthleteField[] }`, `keptName(preview, state)`, `type MergeRow`, `mergeRows(preview)`. Side `a` is the preview's `kept` (the record the window was opened from), `b` its `removed`.

- [ ] **Step 1: Write the failing test**

`src/club/sportivi/__tests__/search-merge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AthleteCard, MergePreview, MergeSideView } from '../../athletes/api-types';
import { ADD_COPY, SEARCH_COPY, cardSubline, noResultsText, searchUrl, showNewRow, withoutAthlete } from '../search-view';
import { MERGE_COPY, initialMerge, keptName, mergeRequest, mergeRows, withKept, withPick } from '../merge-view';

const card = (over: Partial<AthleteCard> = {}): AthleteCard => ({
  documentId: 'a1', name: 'Maria Pop', birthDate: '14.03.2016', lastGroup: { name: 'Primii Pași', season: '2025-2026' },
  lastRegistrationSeason: '2025-2026', contactName: 'Ana Pop', status: 'activ', ...over,
});

describe('search rows (spec 4.1, 6.7)', () => {
  it('two lines: the name, then birth date, last group and parent with commas', () => {
    expect(cardSubline(card())).toBe('14.03.2016, Primii Pași, Ana Pop');
    expect(cardSubline(card({ birthDate: null, lastGroup: null }))).toBe('Ana Pop');
    expect(cardSubline(card({ birthDate: null, lastGroup: null, contactName: null }))).toBe('');
  });

  it('"Sportiv nou" only after a search found nothing (Needs decision 2, option A)', () => {
    expect(showNewRow(null)).toBe(false);
    expect(showNewRow({ q: 'Ion', cards: [card()] })).toBe(false);
    expect(showNewRow({ q: 'Ion', cards: [] })).toBe(true);
    expect(noResultsText({ q: 'Zzz', cards: [] })).toBe('Niciun sportiv găsit pentru "Zzz".');
  });

  it('query, the record itself left out of the merge search, copy', () => {
    expect(searchUrl('  maria pop ')).toBe('/api/club/athletes/search?q=maria%20pop');
    expect(withoutAthlete([card(), card({ documentId: 'a2' })], 'a1').map((c) => c.documentId)).toEqual(['a2']);
    expect(withoutAthlete([card()], undefined)).toHaveLength(1);
    expect(SEARCH_COPY).toEqual({ placeholder: 'Nume, data nașterii, părinte sau telefon', newAthlete: 'Sportiv nou' });
    expect([ADD_COPY.title, ADD_COPY.name, ADD_COPY.birth, ADD_COPY.contact, ADD_COPY.phone, ADD_COPY.email]).toEqual([
      'Adaugă sportiv', 'Nume complet', 'Data nașterii', 'Persoana de contact', 'Telefon', 'E-mail',
    ]);
  });
});

const side = (documentId: string, name: string, fields: Partial<MergeSideView['fields']>): MergeSideView => ({
  documentId, name, status: 'activ', profileSlug: null, registrations: 1,
  fields: { name, birthDate: '21.06.2015', contactName: 'Dan Ilie', phone: '0755 777 888', email: '', ...fields },
});
const preview: MergePreview = {
  kept: side('a1', 'Sara Ilie', { email: 'dan@example.com' }),
  removed: side('a2', 'Sara-Maria Ilie', { phone: '0755 000 000' }),
  differing: ['name', 'phone', 'email'],
};

describe('merge (spec 6.6)', () => {
  it('opens with the current record kept and its values (Needs decision 3c, option A)', () => {
    expect(mergeRequest(preview, initialMerge())).toEqual({ keptId: 'a1', removedId: 'a2', take: [] });
    expect(keptName(preview, initialMerge())).toBe('Sara Ilie');
  });

  it('a value picked from the other record is taken', () => {
    expect(mergeRequest(preview, withPick(initialMerge(), 'phone', 'b')).take).toEqual(['phone']);
    expect(mergeRequest(preview, withPick(initialMerge(), 'birthDate', 'b')).take).toEqual([]);
  });

  it('switching the kept record restarts the picks from it and swaps the ids', () => {
    const picked = withPick(initialMerge(), 'phone', 'b');
    const other = withKept('b');
    expect(other).toEqual({ kept: 'b', picks: {} });
    expect(mergeRequest(preview, other)).toEqual({ keptId: 'a2', removedId: 'a1', take: [] });
    expect(mergeRequest(preview, withPick(other, 'email', 'a')).take).toEqual(['email']);
    expect(keptName(preview, other)).toBe('Sara-Maria Ilie');
    expect(mergeRequest(preview, picked).keptId).toBe('a1');
  });

  it('rows per field, differences flagged, empty values blank', () => {
    expect(mergeRows(preview).map((r) => [r.label, r.a, r.b, r.differs])).toEqual([
      ['Nume și prenume', 'Sara Ilie', 'Sara-Maria Ilie', true],
      ['Data nașterii', '21.06.2015', '21.06.2015', false],
      ['Persoana de contact', 'Dan Ilie', 'Dan Ilie', false],
      ['Telefon', '0755 777 888', '0755 000 000', true],
      ['E-mail', 'dan@example.com', '', true],
    ]);
  });

  it('confirmation copy (spec Open 3)', () => {
    expect(MERGE_COPY.confirmTitle).toBe('Unești cele două fișe?');
    expect(MERGE_COPY.confirmMessage('Sara Ilie')).toBe('Rămâne fișa „Sara Ilie”. Cealaltă se șterge. Acțiunea nu poate fi anulată.');
    expect([MERGE_COPY.confirmLabel, MERGE_COPY.title, MERGE_COPY.kept]).toEqual(['Unește', 'Unește cu alt sportiv', 'Rămâne']);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/sportivi/__tests__/search-merge.test.ts`
Expected: FAIL (`Failed to resolve import "../search-view"`).

- [ ] **Step 3: The rules**

`src/club/sportivi/search-view.ts`:

```ts
import type { AthleteCard } from '../athletes/api-types';

/** The search of "Caută alt sportiv" (spec 4.1), reused by "Adaugă sportiv" (6.7) and the merge (6.6). Pure. */

export const SEARCH_COPY = { placeholder: 'Nume, data nașterii, părinte sau telefon', newAthlete: 'Sportiv nou' } as const;

export const ADD_COPY = {
  title: 'Adaugă sportiv',
  name: 'Nume complet',
  birth: 'Data nașterii',
  contact: 'Persoana de contact',
  phone: 'Telefon',
  email: 'E-mail',
  optional: 'Opțional',
  submit: 'Adaugă sportiv',
  cancel: 'Anulează',
} as const;

export type SearchResult = { q: string; cards: AthleteCard[] };

export const searchUrl = (q: string): string => `/api/club/athletes/search?q=${encodeURIComponent(q.trim())}`;

/** Second line of a result row: birth date, last group, parent, separated by commas (gaps #1). */
export const cardSubline = (c: AthleteCard): string => [c.birthDate, c.lastGroup?.name, c.contactName].filter(Boolean).join(', ');

export const withoutAthlete = (cards: AthleteCard[], id: string | undefined): AthleteCard[] => (id ? cards.filter((c) => c.documentId !== id) : cards);

/** "Sportiv nou" only after a search found nothing (spec 6.7; Needs decision 2, option A). */
export const showNewRow = (result: SearchResult | null): boolean => result !== null && result.cards.length === 0;

export const noResultsText = (result: SearchResult): string => `Niciun sportiv găsit pentru "${result.q}".`;
```

`src/club/sportivi/merge-view.ts`:

```ts
import { ATHLETE_FIELDS, ATHLETE_FIELD_LABELS, type AthleteField } from '../athlete-data';
import type { MergePreview, MergeSideView } from '../athletes/api-types';

/**
 * The merge window (spec 6.6): which record is kept and, per differing field, whose value stays.
 * Side `a` is the record the window was opened from (the preview's `kept`), `b` the other one.
 */

export type Side = 'a' | 'b';
export const SIDES: readonly Side[] = ['a', 'b'];
export type MergeState = { kept: Side; picks: Partial<Record<AthleteField, Side>> };

export const MERGE_COPY = {
  title: 'Unește cu alt sportiv',
  kept: 'Rămâne',
  submit: 'Unește',
  cancel: 'Anulează',
  profile: 'Profil public',
  registrations: 'Înscrieri',
  confirmTitle: 'Unești cele două fișe?',
  confirmMessage: (name: string) => `Rămâne fișa „${name}”. Cealaltă se șterge. Acțiunea nu poate fi anulată.`,
  confirmLabel: 'Unește',
} as const;

/** Needs decision 3c, option A: the current record is kept until the admin switches. */
export const initialMerge = (): MergeState => ({ kept: 'a', picks: {} });
export const withKept = (kept: Side): MergeState => ({ kept, picks: {} });
export const withPick = (s: MergeState, field: AthleteField, side: Side): MergeState => ({ ...s, picks: { ...s.picks, [field]: side } });
export const pickOf = (s: MergeState, field: AthleteField): Side => s.picks[field] ?? s.kept;
export const sides = (p: MergePreview): Record<Side, MergeSideView> => ({ a: p.kept, b: p.removed });

/** Body of POST /api/club/athletes/merge: `take` = differing fields whose chosen value lives on the removed record. */
export function mergeRequest(p: MergePreview, s: MergeState): { keptId: string; removedId: string; take: AthleteField[] } {
  const v = sides(p);
  const removed: Side = s.kept === 'a' ? 'b' : 'a';
  return { keptId: v[s.kept].documentId, removedId: v[removed].documentId, take: p.differing.filter((f) => pickOf(s, f) === removed) };
}

export const keptName = (p: MergePreview, s: MergeState): string => sides(p)[s.kept].name;

export type MergeRow = { field: AthleteField; label: string; a: string; b: string; differs: boolean };
export const mergeRows = (p: MergePreview): MergeRow[] =>
  ATHLETE_FIELDS.map((field) => ({
    field, label: ATHLETE_FIELD_LABELS[field], a: p.kept.fields[field] ?? '', b: p.removed.fields[field] ?? '', differs: p.differing.includes(field),
  }));
```

- [ ] **Step 4: Run the tests and the checks**

Run: `npx vitest run src/club/sportivi/__tests__/search-merge.test.ts && npx vitest run && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json`
Expected: PASS (8 tests in the file), full suite green, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/sportivi/search-view.ts src/club/sportivi/merge-view.ts src/club/sportivi/__tests__/search-merge.test.ts
git commit -m "feat(sportivi): search rows and merge choices"
```

---

### Task 5: API client, page styles, search component

**Files:**
- Create: `src/admin/dashboard/sportivi/api.ts`, `src/admin/dashboard/sportivi/styles.ts`, `src/admin/dashboard/sportivi/AthleteSearch.tsx`
- Test: `src/club/sportivi/__tests__/admin-sportivi.test.ts` (source-reading; later tasks add `describe` blocks)

**Interfaces:**
- Consumes: plan 3-2 routes and shapes; `EditBody` (Task 3); `searchUrl`, `SEARCH_COPY`, `cardSubline`, `withoutAthlete`, `showNewRow`, `noResultsText`, `SearchResult` (Task 4).
- Produces:
  - `useSportiviApi(): SportiviApi` (stable across renders) with `list(query): Promise<AthleteListPage>`, `record(id, season: string | null): Promise<AthleteRecord>`, `history(id): Promise<HistoryLine[]>`, `update(id, body: EditBody): Promise<AthleteEditResponse>`, `setStatus(id, status: 'activ' | 'inactiv'): Promise<{ status: AthleteStatus }>`, `remove(id): Promise<void>`, `createProfile(id): Promise<AthleteRecord>`, `setVisibility(id, on: boolean): Promise<AthleteRecord>`, `search(q): Promise<AthleteCard[]>`, `add(body: EditBody): Promise<{ documentId: string }>`, `mergePreview(kept, removed): Promise<MergePreview>`, `merge(keptId, removedId, take: AthleteField[]): Promise<{ documentId: string }>`, `dismissDuplicate(pairId): Promise<{ pairId: string }>`
  - `SPORTIVI_CSS` (classes `spv-*` under `.ui-root`)
  - `AthleteSearch` props `{ api: SportiviApi; onPick: (card: AthleteCard) => void; onNew?: (text: string) => void; exclude?: string }`

- [ ] **Step 1: Write the failing test**

`src/club/sportivi/__tests__/admin-sportivi.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(__dirname, '..', '..', '..', 'admin', 'dashboard', p), 'utf8');

describe('API client and styles (Task 5)', () => {
  it('calls exactly the plan 3-2 routes', () => {
    const api = read('sportivi/api.ts');
    for (const path of [
      "'/api/club/athletes'", '/history`', '/status`', '/profile`', '/profile/visibility`', '/merge-preview?kept=', '/merge`',
      '/api/club/athlete-duplicates/', 'searchUrl(q)',
    ]) expect(api).toContain(path);
  });

  it('the CSS keeps to tokens: no backtick inside, no dashed or dotted lines, no pills or circles', () => {
    const css = read('sportivi/styles.ts');
    const body = css.slice(css.indexOf('`') + 1, css.lastIndexOf('`'));
    expect(body).not.toContain('`');
    expect(body).not.toMatch(/dashed|dotted|50%|999px/);
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it('the search reuses the confirm window wording and two-line rows', () => {
    const s = read('sportivi/AthleteSearch.tsx');
    expect(s).toContain('SEARCH_COPY.placeholder');
    expect(s).toContain('cardSubline(c)');
    expect(s).toContain('showNewRow(result)');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/sportivi/__tests__/admin-sportivi.test.ts`
Expected: FAIL (`ENOENT ... sportivi/api.ts`).

- [ ] **Step 3: The client**

`src/admin/dashboard/sportivi/api.ts`:

```ts
import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { AthleteField, AthleteStatus } from '../../../club/athlete-data';
import type {
  AthleteCard, AthleteEditResponse, AthleteListPage, AthleteRecord, HistoryLine, MergePreview,
} from '../../../club/athletes/api-types';
import type { EditBody } from '../../../club/sportivi/record-view';
import { searchUrl } from '../../../club/sportivi/search-view';

const BASE = '/api/club/athletes';
const enc = encodeURIComponent;
type Wrapped<T> = { data: { data: T } };

/** The plan 3-2 admin routes the Sportivi screens call. Same identity on every render (the fetch client's is not). */
export function useSportiviApi() {
  const client = useFetchClient();
  const ref = React.useRef(client);
  ref.current = client;
  return React.useMemo(() => {
    const get = async <T>(url: string): Promise<T> => ((await ref.current.get(url)) as Wrapped<T>).data.data;
    const post = async <T>(url: string, body: unknown): Promise<T> => ((await ref.current.post(url, body)) as Wrapped<T>).data.data;
    const put = async <T>(url: string, body: unknown): Promise<T> => ((await ref.current.put(url, body)) as Wrapped<T>).data.data;
    const one = (id: string) => `${BASE}/${enc(id)}`;
    return {
      list: async (query: string) => (await ref.current.get(`${BASE}?${query}`)).data as AthleteListPage,
      record: (id: string, season: string | null) => get<AthleteRecord>(`${one(id)}${season ? `?season=${enc(season)}` : ''}`),
      history: (id: string) => get<HistoryLine[]>(`${one(id)}/history`),
      update: (id: string, body: EditBody) => put<AthleteEditResponse>(one(id), body),
      setStatus: (id: string, status: 'activ' | 'inactiv') => post<{ status: AthleteStatus }>(`${one(id)}/status`, { status }),
      remove: async (id: string) => { await ref.current.del(one(id)); },
      createProfile: (id: string) => post<AthleteRecord>(`${one(id)}/profile`, {}),
      setVisibility: (id: string, on: boolean) => put<AthleteRecord>(`${one(id)}/profile/visibility`, { on }),
      search: (q: string) => get<AthleteCard[]>(searchUrl(q)),
      add: (body: EditBody) => post<{ documentId: string }>(BASE, body),
      mergePreview: (kept: string, removed: string) => get<MergePreview>(`${BASE}/merge-preview?kept=${enc(kept)}&removed=${enc(removed)}`),
      merge: (keptId: string, removedId: string, take: AthleteField[]) => post<{ documentId: string }>(`${BASE}/merge`, { keptId, removedId, take }),
      dismissDuplicate: (pairId: string) => post<{ pairId: string }>(`/api/club/athlete-duplicates/${enc(pairId)}/dismiss`, {}),
    };
  }, []);
}

export type SportiviApi = ReturnType<typeof useSportiviApi>;
```

- [ ] **Step 4: The styles**

`src/admin/dashboard/sportivi/styles.ts`:

```ts
/**
 * CSS of the Sportivi list, record and windows (plan 3-5). Tokens only (var(--theme-*), var(--ui-*)).
 * No backtick inside the string (one stray backtick blanks the admin); no dashed or dotted lines;
 * no pills or circles. Popovers and sheets portal with .ui-root, so these rules reach them.
 */
export const SPORTIVI_CSS = `
.ui-root .spv-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 18px;border-bottom:1px solid var(--theme-border)}
.ui-root .spv-q{flex:1 1 280px;min-width:0}
.ui-root .spv-sort{display:flex;align-items:center;gap:6px;margin-left:auto;font-size:12.5px;color:var(--theme-text-secondary)}
.ui-root .spv-banner{padding:12px 18px 0}
.ui-root .spv-name{font-weight:600;color:var(--theme-text)}
.ui-root a.spv-name{text-decoration:none}
.ui-root a.spv-name:hover{text-decoration:underline}
.ui-root .spv-miss{display:block;font-size:11.5px;line-height:1.2;margin-top:1px;color:var(--theme-warning)}
.ui-root .spv-muted{color:var(--theme-text-muted)}
.ui-root .spv-sub2{display:block;font-size:12px;color:var(--theme-text-muted)}
.ui-root .spv-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 18px;border-top:1px solid var(--theme-border);font-size:12.5px;color:var(--theme-text-secondary)}
.ui-root .spv-count{margin:0;padding:10px 16px 0;font-size:12.5px;color:var(--theme-text-secondary)}
.ui-root .spv-cards{list-style:none;margin:0;padding:10px 16px;display:flex;flex-direction:column;gap:8px}
.ui-root .spv-card{display:flex;flex-direction:column;align-items:flex-start;gap:3px;width:100%;text-align:left;font:inherit;color:var(--theme-text);background:var(--theme-surface);border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);padding:10px 12px;cursor:pointer}
.ui-root .spv-card:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
.ui-root .spv-more{padding:0 16px 16px}
.ui-root .spv-more .ui-btn{width:100%}
.ui-root .spv-head-acts{display:flex;align-items:center;gap:8px}
.ui-root .spv-phone-head{display:flex;flex-direction:column;gap:6px;padding:0 0 10px}
.ui-root .spv-phone-head .spv-head-acts{justify-content:space-between}
.ui-root .spv-dups{display:flex;flex-direction:column;gap:8px;padding:12px 18px 0}
.ui-root .spv-dup-acts{display:flex;gap:6px;flex-wrap:wrap}
.ui-root .spv-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 24px;margin:0}
.ui-root .spv-field{min-width:0}
.ui-root .spv-label{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-text-secondary)}
.ui-root .spv-link{font:inherit;font-size:12.5px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--theme-primary);background:none;border:none;padding:0;cursor:pointer}
.ui-root .spv-link:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
.ui-root .spv-missing{display:block;margin:2px 0 0;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-warning)}
.ui-root .spv-value{margin:4px 0 0;min-height:20px;color:var(--theme-text);overflow-wrap:anywhere}
.ui-root .spv-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 24px}
.ui-root .spv-actions{display:flex;justify-content:flex-end;gap:8px}
.ui-root .spv-line{margin:0;color:var(--theme-text)}
.ui-root .spv-h{margin:0;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-text-secondary)}
.ui-root .spv-rows{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:4px}
.ui-root .spv-docs,.ui-root .spv-hist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.ui-root .spv-doc{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--theme-border)}
.ui-root .spv-doc-acts{display:flex;gap:4px}
.ui-root .spv-hist li{padding:8px 0;border-bottom:1px solid var(--theme-border);color:var(--theme-text);overflow-wrap:anywhere}
.ui-root .spv-hist-h{display:flex;gap:10px;flex-wrap:wrap;font-size:12.5px}
.ui-root .spv-hist-h span{color:var(--theme-text-muted)}
.ui-root .spv-search{display:flex;flex-direction:column;gap:8px}
.ui-root .spv-results{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.ui-root .spv-result{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;font:inherit;color:var(--theme-text);background:var(--theme-surface);border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);padding:8px 12px;cursor:pointer}
.ui-root .spv-result:hover{border-color:var(--theme-primary);background:var(--theme-primary-soft)}
.ui-root .spv-result:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
.ui-root .spv-result-sub{font-size:12px;color:var(--theme-text-muted)}
.ui-root .spv-merge-wrap{overflow-x:auto}
.ui-root .spv-merge{width:100%;min-width:520px;border-collapse:collapse}
.ui-root .spv-merge th,.ui-root .spv-merge td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--theme-border)}
.ui-root .spv-merge thead th{display:table-cell}
.ui-root .spv-merge th[scope=row]{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-text-secondary);white-space:nowrap}
.ui-root .spv-merge td.spv-diff{background:var(--theme-warning-bg)}
.ui-root.ui-pop.spv-menu{width:240px;padding:5px}
.ui-root.spv-menu button{display:block;width:100%;text-align:left;font:inherit;font-size:12.5px;color:var(--theme-text);background:none;border:none;padding:8px 10px;border-radius:var(--ui-radius-sm);cursor:pointer}
.ui-root.spv-menu button:hover,.ui-root.spv-menu button:focus-visible{background:var(--theme-surface-subtle);outline:none}
.ui-root.spv-menu button.spv-danger{color:var(--theme-danger)}
@media (max-width: 640px){
.ui-root .spv-toolbar{padding:10px 16px}
.ui-root .spv-toolbar > *{min-height:40px}
.ui-root .spv-q{flex-basis:100%}
.ui-root .spv-fields,.ui-root .spv-form{grid-template-columns:minmax(0,1fr)}
.ui-root .spv-banner,.ui-root .spv-dups{padding:10px 0 0}
}
`;
```

- [ ] **Step 5: The search component**

`src/admin/dashboard/sportivi/AthleteSearch.tsx`:

```tsx
import * as React from 'react';
import { Input } from '../../ui';
import type { AthleteCard } from '../../../club/athletes/api-types';
import {
  SEARCH_COPY, cardSubline, noResultsText, showNewRow, withoutAthlete, type SearchResult,
} from '../../../club/sportivi/search-view';
import type { SportiviApi } from './api';

type Props = { api: SportiviApi; onPick: (card: AthleteCard) => void; onNew?: (text: string) => void; exclude?: string };

/** Server search 250 ms after the last key; the answer remembers its own text, so a late answer never mislabels. */
function useAthleteSearch(api: SportiviApi, text: string, exclude: string | undefined): SearchResult | null {
  const [result, setResult] = React.useState<SearchResult | null>(null);
  React.useEffect(() => {
    const q = text.trim();
    if (!q) {
      setResult(null);
      return undefined;
    }
    let off = false;
    const t = window.setTimeout(() => {
      api.search(q)
        .then((cards) => { if (!off) setResult({ q, cards: withoutAthlete(cards, exclude) }); })
        .catch(() => { if (!off) setResult(null); });
    }, 250);
    return () => { off = true; window.clearTimeout(t); };
  }, [api, text, exclude]);
  return result;
}

function ResultRow({ name, sub, onClick }: { name: string; sub?: string; onClick: () => void }) {
  return (
    <button type="button" className="spv-result" onClick={onClick}>
      <span className="spv-name">{name}</span>
      {sub ? <span className="spv-result-sub">{sub}</span> : null}
    </button>
  );
}

/** "Caută alt sportiv" (spec 4.1) for "Adaugă sportiv" (6.7) and the merge (6.6). */
export function AthleteSearch({ api, onPick, onNew, exclude }: Props) {
  const [text, setText] = React.useState('');
  const result = useAthleteSearch(api, text, exclude);
  return (
    <div className="spv-search">
      <Input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={SEARCH_COPY.placeholder} aria-label={SEARCH_COPY.placeholder} autoFocus />
      {result && result.cards.length > 0 && (
        <ul className="spv-results">
          {result.cards.map((c) => (
            <li key={c.documentId}>
              <ResultRow name={c.name} sub={cardSubline(c)} onClick={() => onPick(c)} />
            </li>
          ))}
        </ul>
      )}
      {result && result.cards.length === 0 && <p className="spv-muted">{noResultsText(result)}</p>}
      {onNew && result && showNewRow(result) && <ResultRow name={SEARCH_COPY.newAthlete} onClick={() => onNew(result.q)} />}
    </div>
  );
}
```

- [ ] **Step 6: Run the tests and the checks**

Run: `npx vitest run src/club/sportivi/__tests__/admin-sportivi.test.ts && npx vitest run && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS (3 tests in the file), full suite green, zero type errors, checker exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/admin/dashboard/sportivi/api.ts src/admin/dashboard/sportivi/styles.ts src/admin/dashboard/sportivi/AthleteSearch.tsx src/club/sportivi/__tests__/admin-sportivi.test.ts
git commit -m "feat(sportivi): admin API client, styles and athlete search"
```

---

### Task 6: Sportivi list screens (desktop table, phone cards)

**Files:**
- Create: `src/admin/dashboard/sportivi/useAthleteList.ts`, `SportiviList.tsx`, `ListToolbar.tsx`, `AthleteTable.tsx`, `AthleteCards.tsx` (all in `src/admin/dashboard/sportivi/`)
- Modify: `src/club/sportivi/__tests__/admin-sportivi.test.ts` (append a `describe`)

**Interfaces:**
- Consumes: Task 2 (everything listed there), `athleteRecordTo` (Task 1), `useSportiviApi` and `SPORTIVI_CSS` (Task 5); plan 3-1 `Select`, `FilterPanel`, `useIsPhone`; `Pager`, `Notice`, `EmptyState`, `Loading`, `StatusBadge`, `Input`, `Button`.
- Produces: `SportiviList` (no props; mounted by `SportiviPage` in Task 7; "Adaugă sportiv" added in Task 11), `type AthleteList = { state; setState; page; rows; loading; failed }`, `useAthleteList(api, phone)`.

What the screens show (spec 5): header "Sportivi" with the subtitle (no Export, no Coloane); toolbar: search, season Select ("Sezon 2026-2027"), "Filtre" (filters-v3, total "<N> sportivi"), on desktop "Sortare:" with "Nume A-Z" / "Vârstă" / "Grupă"; on phones the sort is one more section in the filter sheet. Banner "N sportivi au date incomplete." with "Arată-i". Desktop table: Sportiv ("date lipsă" with the tooltip "Lipsesc: ..."), Vârstă, "Grupa <sezon>", Contact (person, phone under it), Membru A.C.S., Profil public; sortable headers Sportiv, Vârstă, Grupa; 50 per page, count "<n> din <m> sportivi". Phone: cards (name, "10 ani, Primii Pași", "Date incomplete"), 30 at a time, "Încarcă încă 30". A row or card opens the record in the same tab, passing the selected season.

- [ ] **Step 1: Write the failing test**

Append to `src/club/sportivi/__tests__/admin-sportivi.test.ts`:

```ts
describe('list screens (Task 6)', () => {
  it('desktop 50 rows, phone 30 appended only after page 1', () => {
    const hook = read('sportivi/useAthleteList.ts');
    expect(hook).toContain('phone ? PAGE_SIZE.phone : PAGE_SIZE.desktop');
    expect(hook).toContain('const append = phone && state.page > 1;');
  });

  it('header and toolbar as spec 5: no Export, no Coloane, sort in the sheet on phones', () => {
    const list = read('sportivi/SportiviList.tsx');
    const bar = read('sportivi/ListToolbar.tsx');
    expect(list).toContain('LIST_COPY.subtitle');
    expect(bar).toContain('<FilterPanel');
    expect(bar).toContain('phone ? [...filters, sortSection(state)] : filters');
    expect(`${list}${bar}`).not.toMatch(/Export|Coloane/);
  });

  it('rows open the record with the selected season; phone cards load 30 more', () => {
    expect(read('sportivi/SportiviList.tsx')).toContain('navigate(athleteRecordTo(documentId), { state: { season:');
    expect(read('sportivi/AthleteCards.tsx')).toContain('LIST_COPY.more');
    expect(read('sportivi/AthleteTable.tsx')).toContain('withHeaderSort(state, sortKey)');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/sportivi/__tests__/admin-sportivi.test.ts`
Expected: FAIL (`ENOENT ... sportivi/useAthleteList.ts`).

- [ ] **Step 3: The list state**

`src/admin/dashboard/sportivi/useAthleteList.ts`:

```ts
import * as React from 'react';
import type { AthleteListPage, AthleteListRow } from '../../../club/athletes/api-types';
import { INITIAL_LIST_STATE, PAGE_SIZE, listQueryString, type ListState } from '../../../club/sportivi/list-view';
import type { SportiviApi } from './api';

/** Kept while the admin moves between the list and a record, so "Sportivi" brings the same view back. */
let remembered: ListState = INITIAL_LIST_STATE;

export type AthleteList = {
  state: ListState;
  setState: (next: ListState) => void;
  page: AthleteListPage | null;
  /** Phone: every card loaded so far; desktop reads `page.data`. */
  rows: AthleteListRow[];
  loading: boolean;
  failed: boolean;
};

function useDebounced(value: string, ms: number): string {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useAthleteList(api: SportiviApi, phone: boolean): AthleteList {
  const [state, setRaw] = React.useState<ListState>(remembered);
  const [page, setPage] = React.useState<AthleteListPage | null>(null);
  const [rows, setRows] = React.useState<AthleteListRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const q = useDebounced(state.q, 300);
  const query = listQueryString({ ...state, q }, phone ? PAGE_SIZE.phone : PAGE_SIZE.desktop);
  const append = phone && state.page > 1;
  React.useEffect(() => {
    let off = false;
    setLoading(true);
    api.list(query)
      .then((p) => {
        if (off) return;
        setPage(p);
        setRows((prev) => (append ? [...prev, ...p.data] : p.data));
        setFailed(false);
      })
      .catch(() => { if (!off) setFailed(true); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [api, query, append]);
  const setState = React.useCallback((next: ListState) => {
    remembered = next;
    setRaw(next);
  }, []);
  return { state, setState, page, rows, loading, failed };
}
```

- [ ] **Step 4: Toolbar and banner**

`src/admin/dashboard/sportivi/ListToolbar.tsx`:

```tsx
import * as React from 'react';
import { Button, FilterPanel, Input, Notice, Select } from '../../ui';
import {
  LIST_COPY, SORT_OPTIONS, athletesText, clearFilters, filterSections, incompleteBanner, seasonOptions, seasonValue, showIncomplete, showLabel,
  sortSection, withSearch, withSeason, withSection,
} from '../../../club/sportivi/list-view';
import type { AthleteList } from './useAthleteList';

/** Search, season, filters-v3 and sort (spec 5). On phones the sort is one more section of the filter sheet. */
export function ListToolbar({ list, phone }: { list: AthleteList; phone: boolean }) {
  const { state, setState, page } = list;
  const filters = filterSections(state, page);
  const total = page?.pagination.total ?? 0;
  return (
    <div className="spv-toolbar">
      <Input
        type="search"
        className="spv-q"
        value={state.q}
        onChange={(e) => setState(withSearch(state, e.target.value))}
        placeholder={LIST_COPY.search}
        aria-label={LIST_COPY.search}
      />
      <Select aria-label={LIST_COPY.season} value={seasonValue(state, page)} options={seasonOptions(page)} onChange={(v) => setState(withSeason(state, v))} />
      <FilterPanel
        sections={phone ? [...filters, sortSection(state)] : filters}
        onChange={(key, selected) => setState(withSection(state, key, selected))}
        onClearAll={() => setState(clearFilters(state))}
        totalLabel={athletesText(total)}
        showLabel={showLabel(total)}
      />
      {!phone && (
        <label className="spv-sort">
          <span>{LIST_COPY.sort}:</span>
          <Select aria-label={LIST_COPY.sort} value={state.sort} options={SORT_OPTIONS} onChange={(v) => setState(withSection(state, 'sort', [v]))} />
        </label>
      )}
    </div>
  );
}

/** "N sportivi au date incomplete." + "Arată-i" (3b Q21, gaps #10). */
export function IncompleteBanner({ list }: { list: AthleteList }) {
  const n = list.page?.incomplete ?? 0;
  if (n === 0) return null;
  const action = (
    <Button size="sm" variant="secondary" onClick={() => list.setState(showIncomplete(list.state))}>
      {LIST_COPY.showThem}
    </Button>
  );
  return (
    <div className="spv-banner">
      <Notice tone="warning" action={action}>
        {incompleteBanner(n)}
      </Notice>
    </div>
  );
}
```

- [ ] **Step 5: Desktop table and phone cards**

`src/admin/dashboard/sportivi/AthleteTable.tsx`:

```tsx
import * as React from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, Loading, Pager } from '../../ui';
import type { AthleteListRow } from '../../../club/athletes/api-types';
import {
  LIST_COPY, acsCell, ageText, countLine, groupCell, groupHeader, missingTip, profileCell, withHeaderSort, withPage, type SortKey,
} from '../../../club/sportivi/list-view';
import { athleteRecordTo } from '../../../club/sportivi/routes';
import type { AthleteList } from './useAthleteList';

type Open = (documentId: string) => void;

function SortHeader({ list, sortKey, children }: { list: AthleteList; sortKey: SortKey; children: React.ReactNode }) {
  const { state, setState } = list;
  const dir = state.sort === sortKey ? state.dir : null;
  return (
    <th scope="col" aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
      <button type="button" onClick={() => setState(withHeaderSort(state, sortKey))}>
        {children}
        <span className="ui-table-sort" aria-hidden="true">{dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : ''}</span>
      </button>
    </th>
  );
}

function Row({ row, onOpen }: { row: AthleteListRow; onOpen: Open }) {
  const open = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpen(row.documentId);
  };
  return (
    <tr className="ui-table-click" onClick={() => onOpen(row.documentId)}>
      <td>
        <Link className="spv-name" to={athleteRecordTo(row.documentId)} onClick={open}>{row.name}</Link>
        {row.dataIncomplete && <span className="spv-miss" title={missingTip(row) ?? undefined}>{LIST_COPY.incompleteMarker}</span>}
      </td>
      <td>{ageText(row.age)}</td>
      <td className={row.mainGroup ? undefined : 'spv-muted'}>{groupCell(row)}</td>
      <td>
        {row.contactName}
        <span className="spv-sub2">{row.phone}</span>
      </td>
      <td>{acsCell(row)}</td>
      <td>{profileCell(row)}</td>
    </tr>
  );
}

/** Desktop Sportivi table, 50 rows a page (spec 5; documents-bulk-v1). */
export function AthleteTable({ list, onOpen }: { list: AthleteList; onOpen: Open }) {
  const { page, state, setState, failed } = list;
  if (failed) return <EmptyState>{LIST_COPY.loadFailed}</EmptyState>;
  if (!page) return <Loading />;
  if (page.data.length === 0) return <EmptyState>{LIST_COPY.empty}</EmptyState>;
  return (
    <>
      <div className="ui-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <SortHeader list={list} sortKey="name">{LIST_COPY.columns.name}</SortHeader>
              <SortHeader list={list} sortKey="age">{LIST_COPY.columns.age}</SortHeader>
              <SortHeader list={list} sortKey="group">{groupHeader(page.season)}</SortHeader>
              <th scope="col">{LIST_COPY.columns.contact}</th>
              <th scope="col">{LIST_COPY.columns.acs}</th>
              <th scope="col">{LIST_COPY.columns.profile}</th>
            </tr>
          </thead>
          <tbody>{page.data.map((row) => <Row key={row.documentId} row={row} onOpen={onOpen} />)}</tbody>
        </table>
      </div>
      <div className="spv-foot">
        <span>{countLine(page)}</span>
        {page.pagination.pageCount > 1 && <Pager page={state.page} pageCount={page.pagination.pageCount} onChange={(p) => setState(withPage(state, p))} />}
      </div>
    </>
  );
}
```

`src/admin/dashboard/sportivi/AthleteCards.tsx`:

```tsx
import * as React from 'react';
import { Button, EmptyState, Loading, StatusBadge } from '../../ui';
import { LIST_COPY, cardLine, countLine, withPage } from '../../../club/sportivi/list-view';
import type { AthleteList } from './useAthleteList';

/** Phone Sportivi: cards, 30 at a time (3b Q30, gaps #37). */
export function AthleteCards({ list, onOpen }: { list: AthleteList; onOpen: (documentId: string) => void }) {
  const { page, rows, state, setState, loading, failed } = list;
  if (failed) return <EmptyState>{LIST_COPY.loadFailed}</EmptyState>;
  if (!page) return <Loading />;
  if (rows.length === 0) return <EmptyState>{LIST_COPY.empty}</EmptyState>;
  const more = page.pagination.page < page.pagination.pageCount;
  return (
    <>
      <p className="spv-count">{countLine(page)}</p>
      <ul className="spv-cards">
        {rows.map((r) => (
          <li key={r.documentId}>
            <button type="button" className="spv-card" onClick={() => onOpen(r.documentId)}>
              <span className="spv-name">{r.name}</span>
              <span className="spv-sub2">{cardLine(r)}</span>
              {r.dataIncomplete && <StatusBadge tone="warning">{LIST_COPY.incompleteBadge}</StatusBadge>}
            </button>
          </li>
        ))}
      </ul>
      {more && (
        <div className="spv-more">
          <Button variant="secondary" loading={loading} onClick={() => setState(withPage(state, state.page + 1))}>
            {LIST_COPY.more}
          </Button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 6: The list page**

`src/admin/dashboard/sportivi/SportiviList.tsx`:

```tsx
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminPage, PageHeader, Window, useIsPhone } from '../../ui';
import { LIST_COPY, seasonValue } from '../../../club/sportivi/list-view';
import { athleteRecordTo } from '../../../club/sportivi/routes';
import { useSportiviApi } from './api';
import { AthleteCards } from './AthleteCards';
import { AthleteTable } from './AthleteTable';
import { IncompleteBanner, ListToolbar } from './ListToolbar';
import { SPORTIVI_CSS } from './styles';
import { useAthleteList } from './useAthleteList';

/** The private list of every athlete (spec 5), replacing today's public-profile list. */
export function SportiviList() {
  const api = useSportiviApi();
  const phone = useIsPhone();
  const navigate = useNavigate();
  const list = useAthleteList(api, phone);
  const open = (documentId: string) =>
    navigate(athleteRecordTo(documentId), { state: { season: seasonValue(list.state, list.page) || null } });
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS}</style>
      <Window>
        <PageHeader title={LIST_COPY.title} subtitle={LIST_COPY.subtitle} />
        <ListToolbar list={list} phone={phone} />
        <IncompleteBanner list={list} />
        {phone ? <AthleteCards list={list} onOpen={open} /> : <AthleteTable list={list} onOpen={open} />}
      </Window>
    </AdminPage>
  );
}
```

- [ ] **Step 7: Run the tests and the checks**

Run: `npx vitest run src/club/sportivi/__tests__/admin-sportivi.test.ts && npx vitest run && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS (6 tests in the file), full suite green, zero admin type errors, checker exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/admin/dashboard/sportivi/useAthleteList.ts src/admin/dashboard/sportivi/SportiviList.tsx src/admin/dashboard/sportivi/ListToolbar.tsx src/admin/dashboard/sportivi/AthleteTable.tsx src/admin/dashboard/sportivi/AthleteCards.tsx src/club/sportivi/__tests__/admin-sportivi.test.ts
git commit -m "feat(sportivi): private athlete list with filters, banner and phone cards"
```

---

### Task 7: Athlete record page: header, Date, Documente, Istoric, phone sheet

**Files:**
- Create: `src/admin/dashboard/sportivi/AthleteRecordPage.tsx`, `recordFooter.tsx`, `DateTab.tsx`, `DocumentsTab.tsx`, `HistoryTab.tsx`, `openPdf.ts` (all in `src/admin/dashboard/sportivi/`)
- Rewrite: `src/admin/dashboard/SportiviPage.tsx`
- Modify: `src/club/sportivi/__tests__/admin-sportivi.test.ts` (append a `describe`)

**Interfaces:**
- Consumes: Task 1 `SPORTIVI_PATH`, `recordIdFromSplat`, `registrationPanelTo`; Task 3 (everything listed there); Task 5 `useSportiviApi`, `SPORTIVI_CSS`; Task 6 `SportiviList`; plan 3-1 `BottomSheet`, `BirthDatePicker`, `useIsPhone`; `Tabs`, `PageHeader`, `StatusBadge`, `Notice`, `Field`, `Input`, `Button`, `adminToast`; `downloadPdf`, `registrationDocumentUrl` (`src/admin/dashboard/inscrieri/downloadPdf.ts`); `requestErrorText`.
- Produces:
  - `SportiviPage` (default export): the list, or `AthleteRecordPage` for `/plugins/edusport-sportivi/<documentId>`
  - `AthleteRecordPage({ documentId })`; inside it `useAthleteRecord(api, id, season): Loaded` with `type Loaded = { record: AthleteRecord | null; failed: boolean; reload: () => Promise<void>; setRecord: (r: AthleteRecord) => void }`, `HeaderActions`, `RecordContent` (Tasks 8 and 10 change these two)
  - `recordFooter.tsx`: `type FooterAction = { label: string; onClick: () => void; variant?: 'primary' | 'secondary'; disabled?: boolean; loading?: boolean }`, `RecordFooterContext`, `useRecordFooter(actions: FooterAction[] | null): boolean`, `FooterButtons`
  - `DateTab({ record, api, onSaved, active })`, `DocumentsTab({ record })`, `HistoryTab({ api, documentId })`, `viewPdf(get, url)`

The page (spec 6.1 to 6.5): desktop full page in the Window, back link "Sportivi", title = name, sub-line, "Date incomplete" badge (Task 10 adds the "..." menu beside it). Phone: a full-height bottom sheet titled with the name, closing to the list; sub-line and badge at the top of its body; tabs scroll sideways (Tabs does); the tab's "Anulează" / "Salvează" go into the sheet's sticky footer. The record opens on Date (gaps #34). Date and (Task 8) Profil public stay mounted while hidden, so unsaved work survives a look at another tab; only the visible tab hands buttons to the phone footer.

- [ ] **Step 1: Write the failing test**

Append to `src/club/sportivi/__tests__/admin-sportivi.test.ts`:

```ts
describe('athlete record (Task 7)', () => {
  it('one route: the splat after /plugins/edusport-sportivi/ is the record id', () => {
    const page = read('SportiviPage.tsx');
    expect(page).toContain("recordIdFromSplat(useParams()['*'])");
    expect(page).toContain('<AthleteRecordPage key={id} documentId={id} />');
    expect(page).not.toContain('content-manager');
  });

  it('desktop page with back link; phone full-height sheet with a footer for the tab buttons', () => {
    const rec = read('sportivi/AthleteRecordPage.tsx');
    expect(rec).toContain('back={{ to: SPORTIVI_PATH, label: RECORD_COPY.back }}');
    expect(rec).toContain('fullHeight');
    expect(rec).toContain('<RecordFooterContext.Provider value={setFooter}>');
    expect(rec).toContain("hidden={tab !== 'date'}");
    expect(rec).toContain("active={tab === 'date'}");
  });

  it('Date tab: Editează, picker, draft check, footer only while visible', () => {
    const date = read('sportivi/DateTab.tsx');
    for (const s of ['RECORD_COPY.edit', '<BirthDatePicker', 'checkDraft(draft, false)', 'useRecordFooter(props.active ? buttons : null)', 'registrationPanelTo(']) {
      expect(date).toContain(s);
    }
  });

  it('Documente through the admin-guarded routes; Istoric with the shared time format', () => {
    expect(read('sportivi/DocumentsTab.tsx')).toContain('registrationDocumentUrl(d.registrationDocumentId, d.kind)');
    expect(read('sportivi/HistoryTab.tsx')).toContain('historyWhen(l.at)');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/sportivi/__tests__/admin-sportivi.test.ts`
Expected: FAIL (the `SportiviPage.tsx` expectations and `ENOENT ... AthleteRecordPage.tsx`).

- [ ] **Step 3: The phone footer and the PDF viewer**

`src/admin/dashboard/sportivi/recordFooter.tsx`:

```tsx
import * as React from 'react';
import { Button } from '../../ui';

export type FooterAction = { label: string; onClick: () => void; variant?: 'primary' | 'secondary'; disabled?: boolean; loading?: boolean };
type SetFooter = (actions: FooterAction[] | null) => void;

/** Set on phones by the record's bottom sheet: the visible tab puts its buttons in the sticky footer (spec 6.1). */
export const RecordFooterContext = React.createContext<SetFooter | null>(null);

/**
 * Hands `actions` to the phone footer and returns true when it did (the tab then renders no
 * buttons of its own). Re-sent only when a label or state changes; clicks always reach the
 * latest handlers.
 */
export function useRecordFooter(actions: FooterAction[] | null): boolean {
  const set = React.useContext(RecordFooterContext);
  const latest = React.useRef(actions);
  latest.current = actions;
  const key = actions ? actions.map((a) => `${a.label}:${a.disabled ? 1 : 0}:${a.loading ? 1 : 0}`).join('|') : '';
  React.useEffect(() => {
    if (!set) return undefined;
    const now = latest.current;
    set(now ? now.map((a, i) => ({ ...a, onClick: () => latest.current?.[i]?.onClick() })) : null);
    return () => set(null);
  }, [set, key]);
  return set !== null;
}

export function FooterButtons({ actions }: { actions: FooterAction[] }) {
  return (
    <>
      {actions.map((a) => (
        <Button key={a.label} variant={a.variant ?? 'primary'} onClick={a.onClick} disabled={a.disabled} loading={a.loading}>
          {a.label}
        </Button>
      ))}
    </>
  );
}
```

`src/admin/dashboard/sportivi/openPdf.ts`:

```ts
import type { useFetchClient } from '@strapi/admin/strapi-admin';

type Get = ReturnType<typeof useFetchClient>['get'];

/** Opens an admin-guarded PDF in a new tab ("Vezi", spec 6.4): the route needs the admin token, so a plain link cannot. */
export async function viewPdf(get: Get, url: string): Promise<void> {
  const tab = window.open('', '_blank');
  try {
    const r = await get(url, { responseType: 'blob' });
    const href = URL.createObjectURL(r.data);
    if (tab) tab.location.href = href;
    else window.location.assign(href);
    setTimeout(() => URL.revokeObjectURL(href), 60000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}
```

- [ ] **Step 4: Date tab**

`src/admin/dashboard/sportivi/DateTab.tsx`:

```tsx
import * as React from 'react';
import { Link } from 'react-router-dom';
import { BirthDatePicker, Button, Field, Input, adminToast } from '../../ui';
import { ATHLETE_FIELD_LABELS, type AthleteField } from '../../../club/athlete-data';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { requestErrorText } from '../../../club/registration-panel';
import {
  RECORD_COPY, acsLine, checkDraft, editDraft, fieldRows, registrationLine, saveToast, type DraftErrors, type EditDraft,
} from '../../../club/sportivi/record-view';
import { registrationPanelTo } from '../../../club/sportivi/routes';
import type { SportiviApi } from './api';
import { useRecordFooter, type FooterAction } from './recordFooter';

type Props = { record: AthleteRecord; api: SportiviApi; onSaved: (record: AthleteRecord) => void; active: boolean };

function useDateEdit({ record, api, onSaved }: Props) {
  const [draft, setDraft] = React.useState<EditDraft | null>(null);
  const [errors, setErrors] = React.useState<DraftErrors>({});
  const [saving, setSaving] = React.useState(false);
  const cancel = () => {
    setDraft(null);
    setErrors({});
  };
  const save = async () => {
    if (!draft) return;
    const check = checkDraft(draft, false);
    if (!check.ok) return setErrors({ [check.field]: check.error });
    setSaving(true);
    try {
      const res = await api.update(record.documentId, check.body);
      onSaved(res.record);
      cancel();
      if (res.changed.length) adminToast.success(saveToast(res));
      else adminToast.info(saveToast(res));
    } catch (err) {
      adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
    } finally {
      setSaving(false);
    }
  };
  return { draft, setDraft, errors, saving, cancel, save, start: () => setDraft(editDraft(record)) };
}

function FieldLabel({ record, field }: { record: AthleteRecord; field: AthleteField }) {
  return (
    <>
      {ATHLETE_FIELD_LABELS[field]}
      {record.missing.includes(field) && <span className="spv-missing">{RECORD_COPY.missing}</span>}
    </>
  );
}

function DateView({ record, onEdit }: { record: AthleteRecord; onEdit: () => void }) {
  return (
    <dl className="spv-fields">
      {fieldRows(record).map((row, i) => (
        <div key={row.field} className="spv-field">
          <dt className="spv-label">
            <span>{row.label}</span>
            {i === 0 && <button type="button" className="spv-link" onClick={onEdit}>{RECORD_COPY.edit}</button>}
          </dt>
          {row.missing && <dd className="spv-missing">{RECORD_COPY.missing}</dd>}
          <dd className="spv-value">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type FormProps = { record: AthleteRecord; draft: EditDraft; errors: DraftErrors; onChange: (d: EditDraft) => void };

function DateForm({ record, draft, errors, onChange }: FormProps) {
  const set = (patch: Partial<EditDraft>) => onChange({ ...draft, ...patch });
  const label = (field: AthleteField) => <FieldLabel record={record} field={field} />;
  return (
    <div className="spv-form">
      <Field label={label('name')} error={errors.name}>
        <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label={label('birthDate')} error={errors.birthDate}>
        <BirthDatePicker value={draft.birth} onChange={(birth) => set({ birth })} />
      </Field>
      <Field label={label('contactName')}>
        <Input value={draft.contactName} onChange={(e) => set({ contactName: e.target.value })} />
      </Field>
      <Field label={label('phone')}>
        <Input type="tel" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} />
      </Field>
      <Field label={label('email')}>
        <Input type="email" value={draft.email} onChange={(e) => set({ email: e.target.value })} />
      </Field>
    </div>
  );
}

/** A.C.S. line of the selected / current season and the "Înscrieri" block (gaps #11). */
function RecordFacts({ record }: { record: AthleteRecord }) {
  const acs = acsLine(record);
  return (
    <>
      {acs && <p className="spv-line">{acs}</p>}
      {record.registrations.length > 0 && (
        <section aria-labelledby="spv-regs">
          <h3 className="spv-h" id="spv-regs">{RECORD_COPY.registrations}</h3>
          <ul className="spv-rows">
            {record.registrations.map((r) => (
              <li key={r.documentId}>
                <Link to={registrationPanelTo(r.documentId)}>{registrationLine(r)}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Date (spec 6.2): "Editează" like the Înscrieri panel; "Date incomplete" is recomputed by the server on every save. */
export function DateTab(props: Props) {
  const edit = useDateEdit(props);
  const buttons: FooterAction[] | null = edit.draft
    ? [
        { label: RECORD_COPY.cancel, variant: 'secondary', onClick: edit.cancel, disabled: edit.saving },
        { label: RECORD_COPY.save, onClick: () => void edit.save(), loading: edit.saving },
      ]
    : null;
  const inFooter = useRecordFooter(props.active ? buttons : null);
  return (
    <div className="ui-body">
      {edit.draft ? (
        <DateForm record={props.record} draft={edit.draft} errors={edit.errors} onChange={edit.setDraft} />
      ) : (
        <DateView record={props.record} onEdit={edit.start} />
      )}
      <p className="ui-hint">{RECORD_COPY.requiredHint}</p>
      {buttons && !inFooter && (
        <div className="spv-actions">
          {buttons.map((b) => (
            <Button key={b.label} variant={b.variant ?? 'primary'} onClick={b.onClick} disabled={b.disabled} loading={b.loading}>
              {b.label}
            </Button>
          ))}
        </div>
      )}
      <RecordFacts record={props.record} />
    </div>
  );
}
```

- [ ] **Step 5: Documente and Istoric**

`src/admin/dashboard/sportivi/DocumentsTab.tsx`:

```tsx
import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { Button, adminToast } from '../../ui';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { RECORD_COPY } from '../../../club/sportivi/record-view';
import { downloadPdf, registrationDocumentUrl } from '../inscrieri/downloadPdf';
import { viewPdf } from './openPdf';

/** Documente (spec 6.4): the PDFs of the athlete's registrations, through the admin-guarded routes. */
export function DocumentsTab({ record }: { record: AthleteRecord }) {
  const { get } = useFetchClient();
  const failed = () => adminToast.error(RECORD_COPY.documentFailed);
  if (record.documents.length === 0) {
    return (
      <div className="ui-body">
        <p className="spv-muted">{RECORD_COPY.noDocuments}</p>
      </div>
    );
  }
  return (
    <div className="ui-body">
      <ul className="spv-docs">
        {record.documents.map((d) => {
          const url = registrationDocumentUrl(d.registrationDocumentId, d.kind);
          return (
            <li key={url} className="spv-doc">
              <span>{d.label}</span>
              <span className="spv-doc-acts">
                <Button size="sm" variant="ghost" onClick={() => void viewPdf(get, url).catch(failed)}>{RECORD_COPY.view}</Button>
                <Button size="sm" variant="ghost" onClick={() => void downloadPdf(get, url, `${d.kind}.pdf`).catch(failed)}>{RECORD_COPY.download}</Button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

`src/admin/dashboard/sportivi/HistoryTab.tsx`:

```tsx
import * as React from 'react';
import { Loading, Notice } from '../../ui';
import type { HistoryLine } from '../../../club/athletes/api-types';
import { RECORD_COPY, historyWhen } from '../../../club/sportivi/record-view';
import type { SportiviApi } from './api';

/** Istoric (spec 6.5): newest first, one line per change, the actor by name ("Migrare" for migration rows). Read on every opening. */
export function HistoryTab({ api, documentId }: { api: SportiviApi; documentId: string }) {
  const [lines, setLines] = React.useState<HistoryLine[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let off = false;
    api.history(documentId)
      .then((l) => { if (!off) setLines(l); })
      .catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, [api, documentId]);
  if (failed) return <div className="ui-body"><Notice tone="danger">{RECORD_COPY.historyFailed}</Notice></div>;
  if (!lines) return <Loading />;
  return (
    <div className="ui-body">
      <ol className="spv-hist">
        {lines.map((l, i) => (
          <li key={`${l.at}-${i}`}>
            <div className="spv-hist-h">
              <b>{historyWhen(l.at)}</b>
              <span>{l.actor}</span>
            </div>
            <div>{l.text}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 6: The record page and the route**

`src/admin/dashboard/sportivi/AthleteRecordPage.tsx`:

```tsx
import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminPage, BottomSheet, Loading, Notice, PageHeader, StatusBadge, Tabs, Window, useIsPhone } from '../../ui';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { RECORD_COPY, recordSubline, recordTabs, seasonFromState, type RecordTab } from '../../../club/sportivi/record-view';
import { SPORTIVI_PATH } from '../../../club/sportivi/routes';
import { useSportiviApi, type SportiviApi } from './api';
import { DateTab } from './DateTab';
import { DocumentsTab } from './DocumentsTab';
import { HistoryTab } from './HistoryTab';
import { FooterButtons, RecordFooterContext, type FooterAction } from './recordFooter';
import { SPORTIVI_CSS } from './styles';

type Loaded = { record: AthleteRecord | null; failed: boolean; reload: () => Promise<void>; setRecord: (r: AthleteRecord) => void };

function useAthleteRecord(api: SportiviApi, id: string, season: string | null): Loaded {
  const [record, setRecord] = React.useState<AthleteRecord | null>(null);
  const [failed, setFailed] = React.useState(false);
  const reload = React.useCallback(async () => {
    try {
      setRecord(await api.record(id, season));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [api, id, season]);
  React.useEffect(() => {
    void reload();
  }, [reload]);
  return { record, failed, reload, setRecord };
}

/** Badge (and, from Task 10, the "..." menu) beside the name. Needs decision 12, option A: no status badge. */
function HeaderActions({ record }: { record: AthleteRecord }) {
  return (
    <div className="spv-head-acts">
      {record.dataIncomplete && <StatusBadge tone="warning">{RECORD_COPY.incomplete}</StatusBadge>}
    </div>
  );
}

type ContentProps = { record: AthleteRecord; api: SportiviApi; loaded: Loaded; head: React.ReactNode };

function RecordContent({ record, api, loaded, head }: ContentProps) {
  const [tab, setTab] = React.useState<RecordTab>('date');
  return (
    <>
      {head}
      <Tabs items={recordTabs(record)} value={tab} onChange={(t) => setTab(t as RecordTab)} label={RECORD_COPY.tabsLabel} panelId="spv-panel" />
      <div role="tabpanel" id="spv-panel">
        <div hidden={tab !== 'date'}>
          <DateTab record={record} api={api} onSaved={loaded.setRecord} active={tab === 'date'} />
        </div>
        {tab === 'documente' && <DocumentsTab record={record} />}
        {tab === 'istoric' && <HistoryTab api={api} documentId={record.documentId} />}
      </div>
    </>
  );
}

function PhoneShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const [footer, setFooter] = React.useState<FooterAction[] | null>(null);
  return (
    <RecordFooterContext.Provider value={setFooter}>
      <BottomSheet open fullHeight desktop="modal" title={title} onClose={onClose} footer={footer ? <FooterButtons actions={footer} /> : undefined}>
        {children}
      </BottomSheet>
    </RecordFooterContext.Provider>
  );
}

function RecordState({ failed }: { failed: boolean }) {
  if (!failed) return <Loading />;
  return (
    <div className="ui-body">
      <Notice tone="danger">{RECORD_COPY.loadFailed}</Notice>
    </div>
  );
}

/** The athlete record (spec 6): a full page on desktop, a full-height bottom sheet on phones (3b Q7). */
export function AthleteRecordPage({ documentId }: { documentId: string }) {
  const api = useSportiviApi();
  const phone = useIsPhone();
  const navigate = useNavigate();
  const { state } = useLocation();
  const loaded = useAthleteRecord(api, documentId, seasonFromState(state));
  const { record } = loaded;
  const actions = record ? <HeaderActions record={record} /> : null;
  const head = phone && record ? <div className="spv-phone-head"><span className="spv-sub2">{recordSubline(record)}</span>{actions}</div> : null;
  const body = record ? <RecordContent record={record} api={api} loaded={loaded} head={head} /> : <RecordState failed={loaded.failed} />;
  const title = record?.fields.name ?? '';
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS}</style>
      {phone ? (
        <PhoneShell title={title} onClose={() => navigate(SPORTIVI_PATH)}>{body}</PhoneShell>
      ) : (
        <Window>
          <PageHeader back={{ to: SPORTIVI_PATH, label: RECORD_COPY.back }} title={title} subtitle={record ? recordSubline(record) : undefined} actions={actions} />
          {body}
        </Window>
      )}
    </AdminPage>
  );
}
```

(The "Profil public" tab shows an empty panel until Task 8 adds it.)

Rewrite `src/admin/dashboard/SportiviPage.tsx`:

```tsx
import * as React from 'react';
import { useParams } from 'react-router-dom';
import { recordIdFromSplat } from '../../club/sportivi/routes';
import { AthleteRecordPage } from './sportivi/AthleteRecordPage';
import { SportiviList } from './sportivi/SportiviList';

/**
 * "Sportivi" (spec 5) and, under /plugins/edusport-sportivi/<documentId>, the athlete record
 * (spec 6). Strapi routes the menu link as `${to}/*`, so the splat holds the record id.
 */
export default function SportiviPage() {
  const id = recordIdFromSplat(useParams()['*']);
  return id ? <AthleteRecordPage key={id} documentId={id} /> : <SportiviList />;
}
```

- [ ] **Step 7: Run the tests and the checks**

Run: `npx vitest run src/club/sportivi/__tests__/admin-sportivi.test.ts && npx vitest run && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS (10 tests in the file), full suite green, zero admin type errors, checker exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/admin/dashboard/SportiviPage.tsx src/admin/dashboard/sportivi/AthleteRecordPage.tsx src/admin/dashboard/sportivi/recordFooter.tsx src/admin/dashboard/sportivi/DateTab.tsx src/admin/dashboard/sportivi/DocumentsTab.tsx src/admin/dashboard/sportivi/HistoryTab.tsx src/admin/dashboard/sportivi/openPdf.ts src/club/sportivi/__tests__/admin-sportivi.test.ts
git commit -m "feat(sportivi): athlete record page with Date, Documente and Istoric"
```

---

### Task 8: Profil public tab (today's editor moved in)

**Files:**
- Create: `src/admin/dashboard/sportivi/ProfileTab.tsx`
- Modify: `src/admin/dashboard/sportivi/ProfileEditor.tsx` (moved in Task 1), `src/admin/dashboard/sportivi/AthleteRecordPage.tsx` (`RecordContent`)
- Modify: `src/club/sportivi/__tests__/admin-sportivi.test.ts` (append a `describe`)

**Interfaces:**
- Consumes: Task 3 `RECORD_COPY.profile`; Task 5 `SportiviApi.createProfile`, `setVisibility`; Task 7 `useRecordFooter`, `FooterAction`, `RecordContent`; `AthleteRecord.profile`.
- Produces: `ProfileTab({ record, api, onRecord, active })`; `ProfileEditor({ profileId, athleteId, athleteName, api, onRecord, active })` (named export; the default page export goes).

What changes in the editor (spec 6.3; 3b s1, s2; gaps #38; P12): every section and control of today stays (Identitate, Poveste, Echipă și discipline, Mișcări și hobby-uri, Obiectiv de carieră, Rezultate competiții with the skate-results link and import, Galerie, Programe pe sezon; Fotografie, Slug, Activ din, Vizibilitate pe site); no page header and no delete (the record has both); "Nume" shows the athlete name read-only with "Numele se schimbă în Date."; Slug read-only; the save no longer sends `name`, `slug` or `showPublicPage`, and a changed "Vizibilitate pe site" goes through `PUT /api/club/athletes/:id/profile/visibility` (Needs decision 4, option A), which writes "Pagina publică pornită / oprită". On phones "Renunță" / "Salvează" go to the sheet footer instead of the floating SaveBar. No profile yet: "Creează profil public" (page off, "Profil public creat" line written by the route). The note "Datele de contact și data nașterii nu ajung niciodată aici." shows in both states.

- [ ] **Step 1: Write the failing test**

Append to `src/club/sportivi/__tests__/admin-sportivi.test.ts`:

```ts
describe('Profil public (Task 8)', () => {
  const editor = read('sportivi/ProfileEditor.tsx');

  it('name read-only from the athlete, slug read-only, nothing of them saved', () => {
    expect(editor).toContain('<Input value={athleteName} readOnly />');
    expect(editor).toContain('hint={RECORD_COPY.profile.nameHint}');
    expect(editor).toContain('<Input value={v.slug} readOnly />');
    const body = editor.slice(editor.indexOf('function buildBody'), editor.indexOf('// ---- skate-results'));
    expect(body).toContain('skateResultsSlug');
    expect(body).not.toMatch(/\bname:|\bslug:|showPublicPage:/);
  });

  it('the page switch goes through the athlete route; no delete and no page chrome', () => {
    expect(editor).toContain('api.setVisibility(athleteId, v.showPublicPage)');
    expect(editor).not.toMatch(/ConfirmDialog|PageHeader|SPORTIV_DELETE_COPY|export default/);
    expect(editor).toContain('{ready && active && !inFooter && <SaveBar');
  });

  it('every section of today stays', () => {
    for (const s of ['Identitate', 'Poveste', 'Echipă și discipline', 'Mișcări și hobby-uri', 'Obiectiv de carieră', 'Rezultate competiții', 'Galerie', 'Programe pe sezon', 'Fotografie', 'Activ din', 'Vizibilitate pe site']) {
      expect(editor).toContain(s);
    }
  });

  it('the tab: note, "Creează profil public", stays mounted once opened', () => {
    const tab = read('sportivi/ProfileTab.tsx');
    expect(tab).toContain('RECORD_COPY.profile.note');
    expect(tab).toContain('RECORD_COPY.profile.create');
    expect(read('sportivi/AthleteRecordPage.tsx')).toContain("seen.includes('profil') && (");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/sportivi/__tests__/admin-sportivi.test.ts`
Expected: FAIL (the editor still has its page header, delete and default export).

- [ ] **Step 3: Adapt the editor**

In `src/admin/dashboard/sportivi/ProfileEditor.tsx`, make these replacements, in order.

(a) Replace everything from the first line through the end of the file's doc comment (the `*/` line before `const CT =`) with:

```tsx
import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import {
  TwoColumn,
  Section,
  Field,
  FieldRow,
  Input,
  Textarea,
  Select,
  DateInput,
  TagsInput,
  RelationMultiSelect,
  SegmentedControl,
  GalleryGrid,
  RepeatableList,
  Button,
  StatusBadge,
  Notice,
  Loading,
  SaveBar,
  UnsavedGuard,
  useSaveState,
  adminToast,
  type GalleryImage,
} from '../../ui';
import { usePageForm } from '../../lib';
import { PROGRAM_TYPES } from '../constants';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { RECORD_COPY } from '../../../club/sportivi/record-view';
import type { SportiviApi } from './api';
import { useRecordFooter, type FooterAction } from './recordFooter';

/**
 * EduSport admin, the "Profil public" tab of the athlete record (spec 6.3): today's whole profile
 * editor (it was SportivEditPage), with the name read-only (it follows the athlete name, changed
 * in Date) and the slug read-only (the address never changes after creation).
 *
 * Two columns. Left rail: photo (single media), slug, activeSince, page visibility.
 * Right: name/description, story (blocks, edited as plain text), team & disciplines
 * (relation multi-selects), favoriteMoves/hobbies (json string arrays), careerGoal,
 * skate-results link + import, gallery (multiple media), seasons (repeatable
 * component with per-season programs).
 *
 * Reads scalars + media via content-manager GET; relations via the dedicated
 * content-manager relations endpoint (list GET returns counts only). Writes via
 * content-manager PUT (never name, slug or showPublicPage): media as numeric file ids,
 * relations as { set:[{id}] }, story converted between the blocks structure and plain
 * text, then publishes through /api/sportspeople/:id/publish. The page switch goes
 * through the athlete route, which writes "Pagina publică pornită / oprită" (spec 1.6).
 *
 * Built on the shared admin UI (src/admin/ui): usePageForm keeps the working copy and
 * the dirty flag against the loaded profile; on desktop the floating SaveBar saves
 * (Cmd/Ctrl+S), on phones the record's sheet footer does; UnsavedGuard asks before
 * leaving with edits.
 */
```

(b) Delete the whole `slugify` function, from its doc comment `/** URL-safe slug from a name; ...` through its closing `}` (the name and slug are no longer written here).

(c) Replace `buildBody` with:

```ts
function buildBody(form: FormState) {
  return {
    description: form.description || null,
    story: textToBlocks(form.storyText),
    activeSince: form.activeSince || null,
    careerGoal: form.careerGoal || null,
    favoriteMoves: form.favoriteMoves.map((s) => s.trim()).filter(Boolean),
    hobbies: form.hobbies.map((s) => s.trim()).filter(Boolean),
    photo: form.photo ? form.photo.id : null,
    gallery: form.gallery.map((g) => g.id),
    disciplines: { set: form.disciplines.map((d) => ({ id: d.id })) },
    coaches: { set: form.coaches.map((c) => ({ id: c.id })) },
    choreographers: { set: form.choreographers.map((c) => ({ id: c.id })) },
    seasons: form.seasons.map((s) => ({
      season: s.season,
      programs: s.programs.map((p) => ({ type: p.type, title: p.title, artist: p.artist ?? null })),
    })),
    skateResultsSlug: form.skateResultsSlug || null,
  };
}
```

(d) Replace:

```tsx
export default function SportivEditPage() {
  const { get, put, post, del } = useFetchClient();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search || window.location.search);
  const id = params.get('id') || '';
  const isNew = !id;
```

with:

```tsx
type ProfileEditorProps = {
  profileId: string;
  athleteId: string;
  athleteName: string;
  api: SportiviApi;
  onRecord: (record: AthleteRecord) => void;
  /** The tab is visible: only then its buttons reach the phone footer or the SaveBar shows. */
  active: boolean;
};

export function ProfileEditor({ profileId, athleteId, athleteName, api, onRecord, active }: ProfileEditorProps) {
  const { get, put, post } = useFetchClient();
  const id = profileId;
```

(e) Replace `const [loading, setLoading] = React.useState(!isNew);` with `const [loading, setLoading] = React.useState(true);` and delete the line `const [showErrors, setShowErrors] = React.useState(false);`.

(f) In the load effect, replace:

```tsx
  React.useEffect(() => {
    if (isNew) {
      loadedFor.current = '';
      setLoaded(EMPTY);
      setLoading(false);
      setError(false);
      return;
    }
    if (loadedFor.current === id) return;
```

with:

```tsx
  React.useEffect(() => {
    if (loadedFor.current === id) return;
```

and its dependency list `}, [id, isNew, fetchEntry]);` with `}, [id, fetchEntry]);`.

(g) Replace everything from `const nameMissing = !v.name.trim();` through the end of `confirmDelete` (the `};` just before `const ready = !loading && !error;`) with:

```tsx
  const onSave = () => {
    const body = buildBody(v);
    // Save updates the draft; publishing makes it live (visibility is still gated by the
    // page switch). Publish failure never blocks the save. The publish action rejects the
    // update-shaped body (relations as {set:...}), so send an empty payload.
    const publish = async () => {
      try {
        await post(`/api/sportspeople/${id}/publish`, {});
      } catch {
        /* leave as draft if publish endpoint is unavailable */
      }
    };
    void save.run(async () => {
      await put(`${CT}/${id}`, body);
      if (v.showPublicPage !== loaded.showPublicPage) onRecord(await api.setVisibility(athleteId, v.showPublicPage));
      await publish();
      const fresh = await fetchEntry(id);
      loadedFor.current = id;
      setLoaded(fresh);
    }, 'Salvarea a eșuat. Verifică datele și încearcă din nou.');
  };

  const discard = () => form.reset();
```

(h) After `const status = skateStatus(job, skateLinked);` add:

```tsx
  const buttons: FooterAction[] | null =
    ready && form.dirty
      ? [
          { label: 'Renunță', variant: 'secondary', onClick: discard, disabled: save.saving },
          { label: 'Salvează', onClick: onSave, loading: save.saving },
        ]
      : null;
  const inFooter = useRecordFooter(active ? buttons : null);
```

(i) In `rail`, replace the Slug field:

```tsx
      <Field label="Slug" hint="Se generează din nume dacă e gol.">
        <Input value={v.slug} onChange={(e) => upd({ slug: e.target.value })} placeholder="ex. nume-sportiv" />
      </Field>
```

with:

```tsx
      <Field label="Slug">
        <Input value={v.slug} readOnly />
      </Field>
```

(j) Replace the opening of the returned JSX, from `return (` through the line `{loading ? (` (the `AdminPage`, `style`, `Window` and `PageHeader` with its delete button), with:

```tsx
  return (
    <>
      <style>{SPORTIV_CSS}</style>
        {loading ? (
```

(k) In the Identitate section, replace the Nume field:

```tsx
                <Field label="Nume" required error={showErrors && nameMissing ? 'Numele este obligatoriu.' : undefined}>
                  <Input value={v.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Nume și prenume" />
                </Field>
```

with:

```tsx
                <Field label="Nume" hint={RECORD_COPY.profile.nameHint}>
                  <Input value={athleteName} readOnly />
                </Field>
```

(l) Replace the end of the file, from `          </TwoColumn>` through the last `}`, with:

```tsx
          </TwoColumn>
        )}

        {ready && active && !inFooter && <SaveBar {...save.bar} onSave={onSave} onDiscard={discard} />}
      <UnsavedGuard when={form.dirty} />
    </>
  );
}
```

(m) Run `npx tsc --noEmit -p src/admin/tsconfig.json`; any remaining reference to `isNew`, `navigate`, `del`, `releaseUnsavedGuards`, `SPORTIVI_TO`, `SPORTIV_EDIT_TO`, `ConfirmDialog`, `confirmOpen`, `deleting`, `delError`, `nameMissing`, `showErrors` or `SPORTIV_DELETE_COPY` belongs to the removed header, delete or create flow: delete it together with the statement it sits in. `Button` stays (skate-results). Keep every other line as it is.

- [ ] **Step 4: The tab, mounted in the record**

`src/admin/dashboard/sportivi/ProfileTab.tsx`:

```tsx
import * as React from 'react';
import { Button, adminToast } from '../../ui';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { requestErrorText } from '../../../club/registration-panel';
import { RECORD_COPY } from '../../../club/sportivi/record-view';
import type { SportiviApi } from './api';
import { ProfileEditor } from './ProfileEditor';

type Props = { record: AthleteRecord; api: SportiviApi; onRecord: (record: AthleteRecord) => void; active: boolean };

/** Profil public (spec 6.3): today's whole profile editor, or "Creează profil public" (page off, 3b Q3). */
export function ProfileTab({ record, api, onRecord, active }: Props) {
  const [busy, setBusy] = React.useState(false);
  const create = async () => {
    setBusy(true);
    try {
      onRecord(await api.createProfile(record.documentId));
    } catch (err) {
      adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="ui-body">
        <p className="ui-hint">{RECORD_COPY.profile.note}</p>
        {!record.profile && (
          <div>
            <Button onClick={() => void create()} loading={busy}>{RECORD_COPY.profile.create}</Button>
          </div>
        )}
      </div>
      {record.profile && (
        <ProfileEditor
          key={record.profile.documentId}
          profileId={record.profile.documentId}
          athleteId={record.documentId}
          athleteName={record.fields.name ?? ''}
          api={api}
          onRecord={onRecord}
          active={active}
        />
      )}
    </>
  );
}
```

In `src/admin/dashboard/sportivi/AthleteRecordPage.tsx` add `import { ProfileTab } from './ProfileTab';` and replace `RecordContent` with:

```tsx
function RecordContent({ record, api, loaded, head }: ContentProps) {
  const [tab, setTab] = React.useState<RecordTab>('date');
  const [seen, setSeen] = React.useState<RecordTab[]>(['date']);
  const show = (id: string) => {
    const next = id as RecordTab;
    setTab(next);
    setSeen((s) => (s.includes(next) ? s : [...s, next]));
  };
  return (
    <>
      {head}
      <Tabs items={recordTabs(record)} value={tab} onChange={show} label={RECORD_COPY.tabsLabel} panelId="spv-panel" />
      <div role="tabpanel" id="spv-panel">
        <div hidden={tab !== 'date'}>
          <DateTab record={record} api={api} onSaved={loaded.setRecord} active={tab === 'date'} />
        </div>
        {seen.includes('profil') && (
          <div hidden={tab !== 'profil'}>
            <ProfileTab record={record} api={api} onRecord={loaded.setRecord} active={tab === 'profil'} />
          </div>
        )}
        {tab === 'documente' && <DocumentsTab record={record} />}
        {tab === 'istoric' && <HistoryTab api={api} documentId={record.documentId} />}
      </div>
    </>
  );
}
```

- [ ] **Step 5: Run the tests and the checks**

Run: `npx vitest run src/club/sportivi/__tests__/admin-sportivi.test.ts && npx vitest run && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS (14 tests in the file), full suite green, zero admin type errors, checker exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/admin/dashboard/sportivi/ProfileEditor.tsx src/admin/dashboard/sportivi/ProfileTab.tsx src/admin/dashboard/sportivi/AthleteRecordPage.tsx src/club/sportivi/__tests__/admin-sportivi.test.ts
git commit -m "feat(sportivi): Profil public tab with today's profile editor"
```

---

### Task 9: Merge window

**Files:**
- Create: `src/admin/dashboard/sportivi/MergeDialog.tsx`
- Modify: `src/club/sportivi/__tests__/admin-sportivi.test.ts` (append a `describe`)

**Interfaces:**
- Consumes: Task 4 merge rules; Task 5 `SportiviApi.mergePreview`, `merge`, `AthleteSearch`; plan 3-1 `BottomSheet`, `Radio`; `ConfirmDialog`, `Loading`, `Button`, `adminToast`.
- Produces: `MergeDialog(props: MergeDialogProps)`, `type MergeDialogProps = { record: AthleteRecord; otherId: string | null; api: SportiviApi; onClose: () => void; onMerged: (keptId: string) => void }`. Mounted by Task 10.

The window (spec 6.6; d39; Needs decision 3, option A): title "Unește cu alt sportiv"; without `otherId` it first shows the athlete search (the record itself left out); then a table: one column per record (name, "Rămâne" radio), one row per field ("Nume și prenume" ... "E-mail") with a radio per value where the two differ (light background, as the 3A comparison), then "Profil public" (the address) and "Înscrieri" (count). Footer "Anulează" + "Unește"; "Unește" opens the confirmation "Unești cele două fișe?" / "Rămâne fișa „<nume>”. Cealaltă se șterge. Acțiunea nu poate fi anulată." / "Unește". The table scrolls sideways on phones.

- [ ] **Step 1: Write the failing test**

Append to `src/club/sportivi/__tests__/admin-sportivi.test.ts`:

```ts
describe('merge window (Task 9)', () => {
  const merge = read('sportivi/MergeDialog.tsx');

  it('search first when no other record is given, then the comparison', () => {
    expect(merge).toContain('<AthleteSearch api={api} exclude={record.documentId}');
    expect(merge).toContain('api.mergePreview(keptId, otherId)');
  });

  it('kept record and per-field choice, confirmation naming the kept record', () => {
    expect(merge).toContain('label={MERGE_COPY.kept}');
    expect(merge).toContain('withPick(state, row.field, side)');
    expect(merge).toContain('MERGE_COPY.confirmMessage(keptName(preview, state))');
    expect(merge).toContain('mergeRequest(preview, state)');
  });

  it('modal on desktop, full-height sheet on phones', () => {
    expect(merge).toContain('desktop="modal" modalSize="lg" fullHeight');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/sportivi/__tests__/admin-sportivi.test.ts`
Expected: FAIL (`ENOENT ... MergeDialog.tsx`).

- [ ] **Step 3: The window**

`src/admin/dashboard/sportivi/MergeDialog.tsx`:

```tsx
import * as React from 'react';
import { BottomSheet, Button, Loading, Radio, adminToast } from '../../ui';
import { ConfirmDialog } from '../../ConfirmDialog';
import type { AthleteRecord, MergePreview } from '../../../club/athletes/api-types';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { requestErrorText } from '../../../club/registration-panel';
import {
  MERGE_COPY, SIDES, initialMerge, keptName, mergeRequest, mergeRows, pickOf, sides, withKept, withPick, type MergeRow, type MergeState,
} from '../../../club/sportivi/merge-view';
import type { SportiviApi } from './api';
import { AthleteSearch } from './AthleteSearch';

export type MergeDialogProps = {
  record: AthleteRecord;
  otherId: string | null;
  api: SportiviApi;
  onClose: () => void;
  onMerged: (keptId: string) => void;
};

function useMergePreview(api: SportiviApi, keptId: string, otherId: string | null, onFail: () => void): MergePreview | null {
  const [preview, setPreview] = React.useState<MergePreview | null>(null);
  const fail = React.useRef(onFail);
  fail.current = onFail;
  React.useEffect(() => {
    setPreview(null);
    if (!otherId) return undefined;
    let off = false;
    api.mergePreview(keptId, otherId)
      .then((p) => { if (!off) setPreview(p); })
      .catch((err) => {
        if (off) return;
        adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
        fail.current();
      });
    return () => { off = true; };
  }, [api, keptId, otherId]);
  return preview;
}

type TableProps = { preview: MergePreview; state: MergeState; onChange: (s: MergeState) => void };

function MergeFieldRow({ row, state, onChange }: { row: MergeRow } & Omit<TableProps, 'preview'>) {
  return (
    <tr>
      <th scope="row">{row.label}</th>
      {SIDES.map((side) => (
        <td key={side} className={row.differs ? 'spv-diff' : undefined}>
          {row.differs ? (
            <Radio name={`spv-${row.field}`} value={side} checked={pickOf(state, row.field) === side} onChange={() => onChange(withPick(state, row.field, side))} label={row[side]} />
          ) : (
            row[side]
          )}
        </td>
      ))}
    </tr>
  );
}

function MergeTable({ preview, state, onChange }: TableProps) {
  const v = sides(preview);
  return (
    <div className="spv-merge-wrap">
      <table className="spv-merge">
        <thead>
          <tr>
            <td />
            {SIDES.map((side) => (
              <th key={side} scope="col">
                <span className="spv-name">{v[side].name}</span>
                <Radio name="spv-kept" value={side} checked={state.kept === side} onChange={() => onChange(withKept(side))} label={MERGE_COPY.kept} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mergeRows(preview).map((row) => <MergeFieldRow key={row.field} row={row} state={state} onChange={onChange} />)}
          <tr><th scope="row">{MERGE_COPY.profile}</th><td>{v.a.profileSlug}</td><td>{v.b.profileSlug}</td></tr>
          <tr><th scope="row">{MERGE_COPY.registrations}</th><td>{v.a.registrations}</td><td>{v.b.registrations}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/** "Unește cu alt sportiv" (spec 6.6): the kept record and, per differing field, the value that stays; no undo. */
export function MergeDialog({ record, otherId, api, onClose, onMerged }: MergeDialogProps) {
  const [other, setOther] = React.useState<string | null>(otherId);
  const preview = useMergePreview(api, record.documentId, other, () => setOther(null));
  const [state, setState] = React.useState<MergeState>(initialMerge);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => setState(initialMerge()), [preview]);
  const submit = async () => {
    if (!preview) return;
    const req = mergeRequest(preview, state);
    setBusy(true);
    setError(null);
    try {
      onMerged((await api.merge(req.keptId, req.removedId, req.take)).documentId);
    } catch (err) {
      setError(requestErrorText(err, ADMIN_ERRORS.failed));
      setBusy(false);
    }
  };
  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={busy}>{MERGE_COPY.cancel}</Button>
      <Button onClick={() => setConfirming(true)} disabled={!preview || busy}>{MERGE_COPY.submit}</Button>
    </>
  );
  const body = !other ? (
    <AthleteSearch api={api} exclude={record.documentId} onPick={(c) => setOther(c.documentId)} />
  ) : preview ? (
    <MergeTable preview={preview} state={state} onChange={setState} />
  ) : (
    <Loading />
  );
  return (
    <>
      <BottomSheet open onClose={onClose} title={MERGE_COPY.title} desktop="modal" modalSize="lg" fullHeight dismissable={!busy} footer={footer}>
        {body}
      </BottomSheet>
      <ConfirmDialog
        open={confirming && preview !== null}
        title={MERGE_COPY.confirmTitle}
        message={preview ? MERGE_COPY.confirmMessage(keptName(preview, state)) : ''}
        confirmLabel={MERGE_COPY.confirmLabel}
        busyLabel={MERGE_COPY.confirmLabel}
        busy={busy}
        error={error}
        onCancel={() => { if (!busy) { setConfirming(false); setError(null); } }}
        onConfirm={() => void submit()}
      />
    </>
  );
}
```

- [ ] **Step 4: Run the tests and the checks**

Run: `npx vitest run src/club/sportivi/__tests__/admin-sportivi.test.ts && npx vitest run && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS (17 tests in the file when Task 8 is in, 13 without it), full suite green, zero admin type errors, checker exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/admin/dashboard/sportivi/MergeDialog.tsx src/club/sportivi/__tests__/admin-sportivi.test.ts
git commit -m "feat(sportivi): merge window with kept record and per-field choice"
```

---

### Task 10: "..." menu, possible duplicates, delete, merge wiring

**Files:**
- Create: `src/admin/dashboard/sportivi/RecordMenu.tsx`, `src/admin/dashboard/sportivi/DuplicateLines.tsx`
- Modify: `src/admin/dashboard/sportivi/AthleteRecordPage.tsx` (`HeaderActions`, `RecordContent`, `AthleteRecordPage`)
- Modify: `src/club/sportivi/__tests__/admin-sportivi.test.ts` (append a `describe`)

**Interfaces:**
- Consumes: Task 3 `menuItems`, `MenuKey`, `RECORD_COPY.menu`, `inactiveDialog`, `deleteDialog`, `duplicate`; Task 1 `SPORTIVI_PATH`, `athleteRecordTo`; Task 5 `setStatus`, `remove`, `dismissDuplicate`; Task 9 `MergeDialog`; `MenuButton` (`src/admin/dashboard/SubmissionTable.tsx`), `ConfirmDialog`, `Notice`.
- Produces: `RecordMenu({ record, api, reload, onMerge })`, `DuplicateLines({ record, api, reload, onMerge })`; the record page opens `MergeDialog` from the menu (other record searched) and from a duplicate line (other record given).

Behaviour (spec 6.1, 6.6; Open 3): the "..." button (screen-reader name "Mai multe acțiuni", Needs decision 10) lists "Marchează inactiv" (or "Marchează activ" on an inactive record), "Unește cu alt sportiv", "Șterge sportivul". "Marchează inactiv" asks "Marchezi sportivul ca inactiv?" / "Nu mai apare în liste. Istoricul rămâne." / "Marchează inactiv"; "Marchează activ" applies at once. "Șterge sportivul" asks "Ștergi sportivul?" with the spec message and today's "Șterge definitiv", then returns to the list. Each duplicate pair shows "Posibil același copil cu <nume>" with "Unește" (merge with that record chosen) and "Nu e același copil" (removes the flag for good). After a merge the kept record shows (reloaded when it is this one).

- [ ] **Step 1: Write the failing test**

Append to `src/club/sportivi/__tests__/admin-sportivi.test.ts`:

```ts
describe('menu, duplicates, merge wiring (Task 10)', () => {
  it('"..." menu with the spec dialogs', () => {
    const menu = read('sportivi/RecordMenu.tsx');
    for (const s of ['menuItems(record.status)', 'RECORD_COPY.menu.button', 'RECORD_COPY.inactiveDialog.title', 'RECORD_COPY.deleteDialog.message(', "api.setStatus(record.documentId, 'inactiv')", 'navigate(SPORTIVI_PATH, { replace: true })']) {
      expect(menu).toContain(s);
    }
  });

  it('duplicate line: Unește with the other record, Nu e același copil', () => {
    const dups = read('sportivi/DuplicateLines.tsx');
    expect(dups).toContain('onMerge(d.documentId)');
    expect(dups).toContain('api.dismissDuplicate(pairId)');
    expect(dups).toContain('RECORD_COPY.duplicate.line(d.name)');
  });

  it('the record mounts the menu, the lines and the merge window', () => {
    const rec = read('sportivi/AthleteRecordPage.tsx');
    expect(rec).toContain('<RecordMenu');
    expect(rec).toContain('<DuplicateLines');
    expect(rec).toContain('<MergeDialog');
    expect(rec).toContain('if (keptId === documentId) void loaded.reload();');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/sportivi/__tests__/admin-sportivi.test.ts`
Expected: FAIL (`ENOENT ... RecordMenu.tsx`).

- [ ] **Step 3: The menu and the duplicate lines**

`src/admin/dashboard/sportivi/RecordMenu.tsx`:

```tsx
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { adminToast } from '../../ui';
import { ConfirmDialog } from '../../ConfirmDialog';
import { MenuButton } from '../SubmissionTable';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { requestErrorText } from '../../../club/registration-panel';
import { RECORD_COPY, menuItems, type MenuKey } from '../../../club/sportivi/record-view';
import { SPORTIVI_PATH } from '../../../club/sportivi/routes';
import type { SportiviApi } from './api';

type Props = { record: AthleteRecord; api: SportiviApi; reload: () => Promise<void>; onMerge: () => void };
type Dialog = 'inactive' | 'delete' | null;

async function activate(api: SportiviApi, id: string, reload: () => Promise<void>): Promise<void> {
  try {
    await api.setStatus(id, 'activ');
    await reload();
  } catch (err) {
    adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
  }
}

type DialogsProps = Omit<Props, 'onMerge'> & { dialog: Dialog; onClose: () => void };

/** "Marchează inactiv" and "Șterge sportivul" confirmations (spec Open 3, 6.6). */
function RecordDialogs({ record, api, reload, dialog, onClose }: DialogsProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      onClose();
    } catch (err) {
      setError(requestErrorText(err, ADMIN_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  const cancel = () => {
    if (busy) return;
    setError(null);
    onClose();
  };
  const inactive = RECORD_COPY.inactiveDialog;
  return (
    <>
      <ConfirmDialog
        open={dialog === 'inactive'} title={inactive.title} message={inactive.message} confirmLabel={inactive.confirm} busyLabel={inactive.confirm}
        tone="default" busy={busy} error={error} onCancel={cancel}
        onConfirm={() => void run(async () => { await api.setStatus(record.documentId, 'inactiv'); await reload(); })}
      />
      <ConfirmDialog
        open={dialog === 'delete'} title={RECORD_COPY.deleteDialog.title} message={RECORD_COPY.deleteDialog.message(record.fields.name ?? '')}
        busy={busy} error={error} onCancel={cancel}
        onConfirm={() => void run(async () => { await api.remove(record.documentId); navigate(SPORTIVI_PATH, { replace: true }); })}
      />
    </>
  );
}

/** Header "..." menu (spec 6.1, gaps #8). */
export function RecordMenu({ record, api, reload, onMerge }: Props) {
  const [open, setOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const pick = (key: MenuKey) => {
    setOpen(false);
    if (key === 'merge') onMerge();
    else if (key === 'delete') setDialog('delete');
    else if (record.status === 'inactiv') void activate(api, record.documentId, reload);
    else setDialog('inactive');
  };
  const label = (
    <>
      <span aria-hidden="true">...</span>
      <span className="ui-sr">{RECORD_COPY.menu.button}</span>
    </>
  );
  return (
    <>
      <MenuButton label={label} open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="spv-menu" role="menu">
        {menuItems(record.status).map((item) => (
          <button key={item.key} type="button" role="menuitem" className={item.key === 'delete' ? 'spv-danger' : undefined} onClick={() => pick(item.key)}>
            {item.label}
          </button>
        ))}
      </MenuButton>
      <RecordDialogs record={record} api={api} reload={reload} dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
```

`src/admin/dashboard/sportivi/DuplicateLines.tsx`:

```tsx
import * as React from 'react';
import { Button, Notice, adminToast } from '../../ui';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { requestErrorText } from '../../../club/registration-panel';
import { RECORD_COPY } from '../../../club/sportivi/record-view';
import type { SportiviApi } from './api';

type Props = { record: AthleteRecord; api: SportiviApi; reload: () => Promise<void>; onMerge: (otherId: string) => void };

/** "Posibil același copil cu <nume>" under the header (DEC 2026-10-26 d12; P10): "Unește" / "Nu e același copil". */
export function DuplicateLines({ record, api, reload, onMerge }: Props) {
  if (record.duplicates.length === 0) return null;
  const dismiss = async (pairId: string) => {
    try {
      await api.dismissDuplicate(pairId);
      await reload();
    } catch (err) {
      adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
    }
  };
  return (
    <div className="spv-dups">
      {record.duplicates.map((d) => {
        const actions = (
          <span className="spv-dup-acts">
            <Button size="sm" variant="secondary" onClick={() => onMerge(d.documentId)}>{RECORD_COPY.duplicate.merge}</Button>
            <Button size="sm" variant="ghost" onClick={() => void dismiss(d.pairId)}>{RECORD_COPY.duplicate.dismiss}</Button>
          </span>
        );
        return (
          <Notice key={d.pairId} tone="info" action={actions}>
            {RECORD_COPY.duplicate.line(d.name)}
          </Notice>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Wire them into the record**

In `src/admin/dashboard/sportivi/AthleteRecordPage.tsx`:

Add the imports:

```tsx
import { athleteRecordTo } from '../../../club/sportivi/routes';
import { DuplicateLines } from './DuplicateLines';
import { MergeDialog } from './MergeDialog';
import { RecordMenu } from './RecordMenu';
```

(merge `athleteRecordTo` into the existing `SPORTIVI_PATH` import line).

Replace `HeaderActions` with:

```tsx
type HeaderProps = { record: AthleteRecord; api: SportiviApi; loaded: Loaded; onMerge: () => void };

/** Badge and "..." menu beside the name. Needs decision 12, option A: no status badge. */
function HeaderActions({ record, api, loaded, onMerge }: HeaderProps) {
  return (
    <div className="spv-head-acts">
      {record.dataIncomplete && <StatusBadge tone="warning">{RECORD_COPY.incomplete}</StatusBadge>}
      <RecordMenu record={record} api={api} reload={loaded.reload} onMerge={onMerge} />
    </div>
  );
}
```

In `RecordContent`: extend `ContentProps` with `onMerge: (otherId: string) => void`, destructure it, and render the lines right after `{head}`:

```tsx
      {head}
      <DuplicateLines record={record} api={api} reload={loaded.reload} onMerge={onMerge} />
```

Replace `AthleteRecordPage` with:

```tsx
type MergeTarget = { otherId: string | null };

/** The athlete record (spec 6): a full page on desktop, a full-height bottom sheet on phones (3b Q7). */
export function AthleteRecordPage({ documentId }: { documentId: string }) {
  const api = useSportiviApi();
  const phone = useIsPhone();
  const navigate = useNavigate();
  const { state } = useLocation();
  const loaded = useAthleteRecord(api, documentId, seasonFromState(state));
  const [merge, setMerge] = React.useState<MergeTarget | null>(null);
  const { record } = loaded;
  const merged = (keptId: string) => {
    setMerge(null);
    if (keptId === documentId) void loaded.reload();
    else navigate(athleteRecordTo(keptId), { replace: true });
  };
  const actions = record ? <HeaderActions record={record} api={api} loaded={loaded} onMerge={() => setMerge({ otherId: null })} /> : null;
  const head = phone && record ? <div className="spv-phone-head"><span className="spv-sub2">{recordSubline(record)}</span>{actions}</div> : null;
  const body = record
    ? <RecordContent record={record} api={api} loaded={loaded} head={head} onMerge={(otherId) => setMerge({ otherId })} />
    : <RecordState failed={loaded.failed} />;
  const title = record?.fields.name ?? '';
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS}</style>
      {phone ? (
        <PhoneShell title={title} onClose={() => navigate(SPORTIVI_PATH)}>{body}</PhoneShell>
      ) : (
        <Window>
          <PageHeader back={{ to: SPORTIVI_PATH, label: RECORD_COPY.back }} title={title} subtitle={record ? recordSubline(record) : undefined} actions={actions} />
          {body}
        </Window>
      )}
      {record && merge && <MergeDialog record={record} otherId={merge.otherId} api={api} onClose={() => setMerge(null)} onMerged={merged} />}
    </AdminPage>
  );
}
```

- [ ] **Step 5: Run the tests and the checks**

Run: `npx vitest run src/club/sportivi/__tests__/admin-sportivi.test.ts && npx vitest run && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS (20 tests in the file), full suite green, zero admin type errors, checker exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/admin/dashboard/sportivi/RecordMenu.tsx src/admin/dashboard/sportivi/DuplicateLines.tsx src/admin/dashboard/sportivi/AthleteRecordPage.tsx src/club/sportivi/__tests__/admin-sportivi.test.ts
git commit -m "feat(sportivi): record menu, possible duplicates, delete and merge"
```

---

### Task 11: "Adaugă sportiv" (search first) and the dashboard shortcut

**Files:**
- Create: `src/admin/dashboard/sportivi/AddAthleteDialog.tsx`
- Modify: `src/admin/dashboard/sportivi/SportiviList.tsx`, `src/admin/dashboard/DashboardPage.tsx:18,409`
- Modify: `src/club/sportivi/__tests__/admin-sportivi.test.ts` (append a `describe`)

**Interfaces:**
- Consumes: Task 3 `checkDraft`, `newAthleteDraft`, `EditDraft`, `DraftErrors`; Task 4 `ADD_COPY`; Task 5 `AthleteSearch`, `SportiviApi.add`; Task 1 `athleteRecordTo`, `addAthleteTo`, `wantsAddAthlete`, `SPORTIVI_PATH`; Task 6 `SportiviList`; plan 3-1 `BottomSheet`, `BirthDatePicker`.
- Produces: `AddAthleteDialog({ api, onClose })`; the list header button "Adaugă sportiv"; `?adauga=1` opens it; the dashboard quick action "Adaugă sportiv" points there.

Behaviour (spec 6.7; gaps #41; Needs decisions 1 and 2, option A): window "Adaugă sportiv" over the list (Modal on desktop, full-height sheet on phones). The search comes first (same placeholder and rows as "Caută alt sportiv"); a result opens that record; when nothing is found: "Niciun sportiv găsit pentru "<text>"." and a "Sportiv nou" row, which shows the form with the searched text as "Nume complet". Form: "Nume complet" and "Data nașterii" required, "Persoana de contact", "Telefon", "E-mail" with the hint "Opțional". "Adaugă sportiv" creates the athlete ("Activ", "Date incomplete" without the optional fields; server, plan 3-2) and opens its record.

- [ ] **Step 1: Write the failing test**

Append to `src/club/sportivi/__tests__/admin-sportivi.test.ts`:

```ts
describe('Adaugă sportiv (Task 11)', () => {
  it('search first, "Sportiv nou" form, birth date required', () => {
    const add = read('sportivi/AddAthleteDialog.tsx');
    expect(add).toContain('onNew={(text) => setForm(newAthleteDraft(text))}');
    expect(add).toContain('checkDraft(form, true)');
    expect(add).toContain('hint={ADD_COPY.optional}');
    expect(add).toContain('desktop="modal" modalSize="md" fullHeight');
  });

  it('opened from the list header and from the dashboard', () => {
    expect(read('sportivi/SportiviList.tsx')).toContain('wantsAddAthlete(search)');
    const dash = read('DashboardPage.tsx');
    expect(dash).toContain("{ label: 'Adaugă sportiv', to: addAthleteTo, ic: 'S' },");
    expect(dash).not.toContain('SPORTIV_EDIT_TO');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/club/sportivi/__tests__/admin-sportivi.test.ts`
Expected: FAIL (`ENOENT ... AddAthleteDialog.tsx`).

- [ ] **Step 3: The window**

`src/admin/dashboard/sportivi/AddAthleteDialog.tsx`:

```tsx
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { BirthDatePicker, BottomSheet, Button, Field, Input, adminToast } from '../../ui';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { requestErrorText } from '../../../club/registration-panel';
import { checkDraft, newAthleteDraft, type DraftErrors, type EditDraft } from '../../../club/sportivi/record-view';
import { athleteRecordTo } from '../../../club/sportivi/routes';
import { ADD_COPY } from '../../../club/sportivi/search-view';
import type { SportiviApi } from './api';
import { AthleteSearch } from './AthleteSearch';

type FormProps = { form: EditDraft; errors: DraftErrors; onChange: (d: EditDraft) => void };

function AddForm({ form, errors, onChange }: FormProps) {
  const set = (patch: Partial<EditDraft>) => onChange({ ...form, ...patch });
  return (
    <div className="spv-form">
      <Field label={ADD_COPY.name} required error={errors.name}>
        <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label={ADD_COPY.birth} required error={errors.birthDate}>
        <BirthDatePicker value={form.birth} onChange={(birth) => set({ birth })} />
      </Field>
      <Field label={ADD_COPY.contact} hint={ADD_COPY.optional}>
        <Input value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} />
      </Field>
      <Field label={ADD_COPY.phone} hint={ADD_COPY.optional}>
        <Input type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
      </Field>
      <Field label={ADD_COPY.email} hint={ADD_COPY.optional}>
        <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
      </Field>
    </div>
  );
}

/** "Adaugă sportiv" (spec 6.7): search first; the "Sportiv nou" form only when nothing is found. */
export function AddAthleteDialog({ api, onClose }: { api: SportiviApi; onClose: () => void }) {
  const navigate = useNavigate();
  const [form, setForm] = React.useState<EditDraft | null>(null);
  const [errors, setErrors] = React.useState<DraftErrors>({});
  const [busy, setBusy] = React.useState(false);
  const open = (documentId: string) => navigate(athleteRecordTo(documentId));
  const submit = async () => {
    if (!form) return;
    const check = checkDraft(form, true);
    if (!check.ok) return setErrors({ [check.field]: check.error });
    setBusy(true);
    try {
      open((await api.add(check.body)).documentId);
    } catch (err) {
      adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
      setBusy(false);
    }
  };
  const cancel = <Button variant="secondary" onClick={onClose} disabled={busy}>{ADD_COPY.cancel}</Button>;
  const footer = form ? <>{cancel}<Button onClick={() => void submit()} loading={busy}>{ADD_COPY.submit}</Button></> : cancel;
  return (
    <BottomSheet open onClose={onClose} title={ADD_COPY.title} desktop="modal" modalSize="md" fullHeight dismissable={!busy} footer={footer}>
      {form ? (
        <AddForm form={form} errors={errors} onChange={setForm} />
      ) : (
        <AthleteSearch api={api} onPick={(c) => open(c.documentId)} onNew={(text) => setForm(newAthleteDraft(text))} />
      )}
    </BottomSheet>
  );
}
```

- [ ] **Step 4: Open it from the list and the dashboard**

Replace `src/admin/dashboard/sportivi/SportiviList.tsx` with:

```tsx
import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminPage, Button, PageHeader, Window, useIsPhone } from '../../ui';
import { IconPlus } from '../../ui/icons';
import { LIST_COPY, seasonValue } from '../../../club/sportivi/list-view';
import { SPORTIVI_PATH, athleteRecordTo, wantsAddAthlete } from '../../../club/sportivi/routes';
import { AddAthleteDialog } from './AddAthleteDialog';
import { useSportiviApi } from './api';
import { AthleteCards } from './AthleteCards';
import { AthleteTable } from './AthleteTable';
import { IncompleteBanner, ListToolbar } from './ListToolbar';
import { SPORTIVI_CSS } from './styles';
import { useAthleteList } from './useAthleteList';

/** The private list of every athlete (spec 5), replacing today's public-profile list. */
export function SportiviList() {
  const api = useSportiviApi();
  const phone = useIsPhone();
  const navigate = useNavigate();
  const { search } = useLocation();
  const list = useAthleteList(api, phone);
  const [adding, setAdding] = React.useState(() => wantsAddAthlete(search));
  const open = (documentId: string) =>
    navigate(athleteRecordTo(documentId), { state: { season: seasonValue(list.state, list.page) || null } });
  const closeAdd = () => {
    setAdding(false);
    if (wantsAddAthlete(search)) navigate(SPORTIVI_PATH, { replace: true });
  };
  const add = <Button icon={<IconPlus />} onClick={() => setAdding(true)}>{LIST_COPY.add}</Button>;
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS}</style>
      <Window>
        <PageHeader title={LIST_COPY.title} subtitle={LIST_COPY.subtitle} actions={add} />
        <ListToolbar list={list} phone={phone} />
        <IncompleteBanner list={list} />
        {phone ? <AthleteCards list={list} onOpen={open} /> : <AthleteTable list={list} onOpen={open} />}
      </Window>
      {adding && <AddAthleteDialog api={api} onClose={closeAdd} />}
    </AdminPage>
  );
}
```

In `src/admin/dashboard/DashboardPage.tsx`:
- line 18: `import { FORMULARE_TO, PROGRAM_EDIT_TO, SPORTIV_EDIT_TO } from './menu';` -> `import { FORMULARE_TO, PROGRAM_EDIT_TO } from './menu';` and add `import { addAthleteTo } from '../../club/sportivi/routes';`
- line 409: `{ label: 'Adaugă sportiv', to: SPORTIV_EDIT_TO, ic: 'S' },` -> `{ label: 'Adaugă sportiv', to: addAthleteTo, ic: 'S' },`

(If the quick actions navigate with a router call that drops the query, check that `/plugins/edusport-sportivi?adauga=1` opens the window in Task 12; `QuickAction.to` is passed to `navigate`, which keeps it.)

- [ ] **Step 5: Run the tests and the checks**

Run: `npx vitest run src/club/sportivi/__tests__/admin-sportivi.test.ts && npx vitest run && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS (22 tests in the file once Tasks 8 to 10 are in), full suite green, zero admin type errors, checker exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/admin/dashboard/sportivi/AddAthleteDialog.tsx src/admin/dashboard/sportivi/SportiviList.tsx src/admin/dashboard/DashboardPage.tsx src/club/sportivi/__tests__/admin-sportivi.test.ts
git commit -m "feat(sportivi): Adaugă sportiv with search first and dashboard shortcut"
```

---

### Task 12: Build, checks and renders on a throwaway Postgres

**Files:** none in the backend repo. Temporary files in `${TMPDIR:-/tmp}/es35` (removed at the end). PNGs go to `/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/phase3-renders/` with the prefix `3-5-` (not committed by this task; the user reviews them).

**Interfaces:**
- Consumes: everything above, plans 3-1 and 3-2.
- Proves: the admin bundle builds; the list, filters, banner, record tabs, Editează, "..." menu, duplicate line, merge window and its confirmation, "Adaugă sportiv" (results, nothing found, form), the old editor redirect, the sidebar order and the phone layouts render with synthetic data; nothing is tagged by the SaveBar tagger; no native select; no page errors.

If port 55435 or 1345 is taken, pick free ones and change them everywhere below (also `B` in `pass.py`). Never use 1337, 1340, 3010 or 5432. Log in once with curl and once in the browser (Strapi rate-limits `/admin/login`).

- [ ] **Step 1: Full checks**

```bash
cd /Users/codrin/Documents/Programming/edusport_backend
npx vitest run
npx tsc --noEmit
npx tsc --noEmit -p src/admin/tsconfig.json
node scripts/admin-ui-check.mjs --strict
```

Expected: all tests PASS, zero type errors in both projects, checker exit 0.

- [ ] **Step 2: Postgres, environment, build**

```bash
T="${TMPDIR:-/tmp}/es35"; mkdir -p "$T"
OUT=/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/phase3-renders; mkdir -p "$OUT"
cat > "$T/env" <<'EOF'
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=55435
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=strapi
HOST=127.0.0.1
PORT=1345
APP_KEYS=throwawayA,throwawayB
API_TOKEN_SALT=throwaway
ADMIN_JWT_SECRET=throwaway
TRANSFER_TOKEN_SALT=throwaway
JWT_SECRET=throwaway
ENCRYPTION_KEY=throwaway
STRAPI_TELEMETRY_DISABLED=true
EOF
docker run -d --name es35-pg -e POSTGRES_USER=strapi -e POSTGRES_PASSWORD=strapi -e POSTGRES_DB=strapi \
  -p 127.0.0.1:55435:5432 postgres:16
until docker exec es35-pg pg_isready -U strapi >/dev/null 2>&1; do sleep 1; done
(set -a; . "$T/env"; set +a; npm run build)
```

Expected: `✔ Building admin panel`.

- [ ] **Step 3: Synthetic data, an admin, Strapi**

```bash
cat > "$T/fixture.js" <<'EOF'
const fs = require('node:fs');
const { createStrapi, compileStrapi } = require('@strapi/strapi');
const FIRST = ['Ana', 'Bianca', 'Carla', 'Daria', 'Elisa', 'Filip', 'Gabriel', 'Horia', 'Irina', 'Matei'];
const LAST = ['Pop', 'Ionescu', 'Radu', 'Georgescu', 'Stan'];
(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  const now = new Date();
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const season = (a, isCurrent) => d('api::season.season').create({ data: { label: `${a}-${a + 1}`, startMonth: `${a}-09-01`, endMonth: `${a + 1}-06-30`, membershipFee: 270, isCurrent } });
  const prev = await season(y - 1, false);
  const cur = await season(y, true);
  const school = await d('api::section.section').create({ data: { name: 'Școala de patinaj', kind: 'school', slug: 'scoala', publicPage: true, order: 1 } });
  const club = await d('api::section.section').create({ data: { name: 'Club', kind: 'club', slug: 'club', order: 2 } });
  const group = async (name, section, order) => (await d('api::group.group').create({ data: { name, section: section.documentId, order, active: true } })).documentId;
  const g = { pp: await group('Primii Pași', school, 1), inc: await group('Începători', school, 2), ab: await group('Avansați Bronze', school, 3), pro: await group('Profesioniști', club, 1) };
  const athlete = async (a) => {
    const v = { contactName: null, phone: null, email: null, birthDate: null, status: 'activ', ...a };
    v.dataIncomplete = !(v.name && v.birthDate && v.contactName && v.phone && v.email);
    return (await d('api::athlete.athlete').create({ data: v })).documentId;
  };
  const member = (athleteId, groupId) => d('api::group-membership.group-membership').create({ data: { athlete: athleteId, group: groupId, season: cur.documentId, isMain: true, from: `${y}-09-15` } });
  const acs = (athleteId, state) => d('api::acs-membership.acs-membership').create({ data: { athlete: athleteId, season: cur.documentId, state } });
  const profile = async (name, slug) => (await d('api::sportsperson.sportsperson').create({ data: { name, slug, showPublicPage: true }, status: 'published' })).documentId;
  const ids = {};
  ids.mariaProfile = await profile('Maria Dumitrescu', 'maria-dumitrescu');
  ids.maria = await athlete({ name: 'Maria Dumitrescu', birthDate: '2014-03-14', contactName: 'Mihaela Dumitrescu', phone: '0722 111 222', email: 'parinte@example.com', publicProfile: ids.mariaProfile });
  await member(ids.maria, g.inc); await acs(ids.maria, 'da');
  ids.andrei = await athlete({ name: 'Andrei Popescu', birthDate: '2016-09-02', contactName: 'Ioana Popescu', phone: '0744 555 666' });
  await member(ids.andrei, g.pp); await acs(ids.andrei, 'in_asteptare');
  ids.ioana = await athlete({ name: 'Ioana Marinescu', publicProfile: await profile('Ioana Marinescu', 'ioana-marinescu') });
  await member(ids.ioana, g.pro);
  ids.sara = await athlete({ name: 'Sara Ilie', birthDate: '2015-06-21', contactName: 'Dan Ilie', phone: '0755 777 888', email: 'dan.ilie@example.com' });
  await member(ids.sara, g.ab);
  ids.saraMaria = await athlete({ name: 'Sara-Maria Ilie', birthDate: '2015-06-21', contactName: 'Dan Ilie', phone: '0755 777 888' });
  await d('api::athlete-duplicate.athlete-duplicate').create({ data: { first: ids.sara, second: ids.saraMaria } });
  ids.tudor = await athlete({ name: 'Tudor Enache', birthDate: '2012-02-10', contactName: 'Irina Enache', phone: '0721 000 102', email: 'irina@example.com', status: 'inactiv' });
  ids.luca = await athlete({ name: 'Luca Stoica', birthDate: '2013-01-01', contactName: 'Paul Stoica', phone: '0721 000 103', email: 'paul@example.com' });
  const groups = [g.pp, g.inc, g.ab, g.pro];
  const states = ['da', 'nu', 'in_asteptare'];
  for (let i = 0; i < 50; i += 1) {
    const last = LAST[Math.floor(i / 10)];
    const id = await athlete({ name: `${FIRST[i % 10]} ${last}`, birthDate: `${2012 + (i % 8)}-0${1 + (i % 9)}-1${i % 10}`, contactName: `Părinte ${last}`, phone: `0730 000 ${100 + i}`, email: i % 4 === 0 ? null : `p${i}@example.com` });
    if (i % 5 !== 4) await member(id, groups[i % 4]);
    if (states[i % 3] !== 'nu') await acs(id, states[i % 3]);
  }
  const reg = (number, s) => d('api::registration-submission.registration-submission').create({ data: {
    email: 'parinte@example.com', phone: '0722 111 222', childName: 'Maria Dumitrescu', childBirthDate: '14.03.2014', parentName: 'Mihaela Dumitrescu',
    shirtSize: 'S', status: 'Confirmat', season: s.label, seasonRef: s.documentId, section: school.documentId, registrationNumber: number,
    submittedAt: `${number.slice(0, 4)}-09-20T10:00:00.000Z`, relationship: 'parinte', childHeight: 142, lastSeason: 'Începători', membershipAnswer: 'da',
    subscriptionChoice: { priceItemName: 'Abonament 8 ședințe grup', price: 590, member: true }, source: 'Facebook',
    gdprConsent: true, regulationsConsent: true, priorExperience: 'Nu este cazul', expectations: 'Să patineze', archived: false, athlete: ids.maria,
  } });
  await reg(`${y - 1}-0087`, prev);
  await reg(`${y}-0142`, cur);
  fs.writeFileSync(process.env.IDS_FILE, JSON.stringify(ids));
  console.log('fixture ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
EOF
(set -a; . "$T/env"; set +a; IDS_FILE="$T/ids.json" node -e "$(cat "$T/fixture.js")")
(set -a; . "$T/env"; set +a; npx strapi admin:create-user --email=admin@example.com --password='Throwaway123' --firstname=Admin)
(set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi start > "$T/strapi.log" 2>&1 & echo $! > "$T/pid")
until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1345/_health | grep -q 204; do sleep 2; done
```

Expected: `fixture ok`, the admin created, `/_health` answers 204.

- [ ] **Step 4: History lines and one added athlete through the real routes**

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:1345/admin/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Throwaway123"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])')
MARIA=$(python3 -c "import json; print(json.load(open('$T/ids.json'))['maria'])")
api() { curl -s -o /dev/null -w '%{http_code}\n' -X "$1" "http://127.0.0.1:1345/api$2" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$3"; }
api PUT "/club/athletes/$MARIA" '{"name":"Maria Dumitrescu","birthDate":"14.03.2014","contactName":"Mihaela Dumitrescu","phone":"0722 111 333","email":"parinte@example.com"}'
api PUT "/club/athletes/$MARIA/profile/visibility" '{"on":false}'
api PUT "/club/athletes/$MARIA/profile/visibility" '{"on":true}'
api POST "/club/athletes" '{"name":"Victor Lungu","birthDate":"05.05.2015"}'
```

Expected: four lines `200`.

- [ ] **Step 5: Renders and checks**

Needs Python Playwright with Chromium (`pip install playwright && playwright install chromium`).

```bash
cat > "$T/pass.py" <<'EOF'
import asyncio, json, re, sys
from playwright.async_api import async_playwright

B = 'http://127.0.0.1:1345/admin'
IDS = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
NATIVE = "document.querySelectorAll('.ui-root select').length"
TAGGED = "document.querySelectorAll('[data-edusport-default-save]').length"
LIST = B + '/plugins/edusport-sportivi'

def shot(name):
    return f'{OUT}/3-5-{name}.png'

async def login(pg):
    await pg.goto(B + '/auth/login'); await pg.wait_for_timeout(1500)
    await pg.fill('input[name=email]', 'admin@example.com'); await pg.fill('input[name=password]', 'Throwaway123')
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(4000)

async def scan(pg, r):
    r['native_selects'] += await pg.evaluate(NATIVE)
    r['tagged'] += await pg.evaluate(TAGGED)

async def record(pg, key):
    await pg.goto(f"{LIST}/{IDS[key]}"); await pg.wait_for_timeout(2500)

async def list_desktop(pg, r):
    await pg.goto(LIST); await pg.wait_for_timeout(3000)
    r['list_count'] = await pg.locator('.spv-foot span').first.inner_text()
    r['banner'] = await pg.locator('.spv-banner').inner_text()
    await pg.screenshot(path=shot('list'), full_page=True); await scan(pg, r)
    await pg.locator('.ui-fbtn').click()
    dd = pg.locator('.ui-sheetdd')
    await dd.locator('.ui-fnav-item', has_text='Posibile dubluri').click()
    await dd.get_by_label('Da', exact=True).check(); await pg.wait_for_timeout(1200)
    r['dup_total'] = await dd.locator('.ui-ff-total').inner_text()
    await pg.screenshot(path=shot('list-filters'))
    await dd.get_by_role('button', name='Șterge tot').click(); await dd.get_by_role('button', name='Gata').click()
    await pg.get_by_role('button', name='Arată-i').click(); await pg.wait_for_timeout(1500)
    r['incomplete_count'] = await pg.locator('.spv-foot span').first.inner_text()
    await pg.screenshot(path=shot('list-incomplete'), full_page=True)
    await pg.locator('.ui-fbtn').click(); await pg.locator('.ui-sheetdd').get_by_role('button', name='Șterge tot').click()
    await pg.locator('.ui-sheetdd').get_by_role('button', name='Gata').click()

async def record_desktop(pg, r):
    await pg.goto(LIST); await pg.wait_for_timeout(2500)
    await pg.get_by_role('link', name='Maria Dumitrescu').click(); await pg.wait_for_timeout(2500)
    r['record_url_ok'] = f"/plugins/edusport-sportivi/{IDS['maria']}" in pg.url
    r['subline'] = await pg.locator('.ui-ph-sub').inner_text()
    await pg.screenshot(path=shot('record-date'), full_page=True); await scan(pg, r)
    await pg.get_by_role('button', name='Editează').click(); await pg.wait_for_timeout(500)
    await pg.screenshot(path=shot('record-date-edit'), full_page=True); await scan(pg, r)
    await pg.get_by_role('button', name='Anulează').click()
    for tab, name in [('Profil public', 'record-profil'), ('Documente', 'record-documente'), (re.compile('^Istoric'), 'record-istoric')]:
        await pg.get_by_role('tab', name=tab).click(); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=shot(name), full_page=True); await scan(pg, r)
    r['history_lines'] = await pg.locator('.spv-hist li').count()
    await pg.get_by_role('tab', name='Documente').click(); await pg.wait_for_timeout(500)
    r['documents'] = await pg.locator('.spv-doc').count()
    await pg.get_by_role('button', name='Mai multe acțiuni').click(); await pg.wait_for_timeout(300)
    r['menu'] = await pg.locator('.spv-menu [role=menuitem]').all_inner_texts()
    await pg.screenshot(path=shot('record-menu')); await pg.keyboard.press('Escape')
    await record(pg, 'andrei'); await pg.get_by_role('tab', name='Profil public').click(); await pg.wait_for_timeout(800)
    await pg.screenshot(path=shot('record-profil-none'), full_page=True)
    await record(pg, 'ioana'); await pg.screenshot(path=shot('record-incomplete'), full_page=True)

async def merge_desktop(pg, r):
    await record(pg, 'sara')
    r['duplicate_line'] = await pg.locator('.spv-dups').inner_text()
    await pg.screenshot(path=shot('record-duplicate'), full_page=True)
    await pg.locator('.spv-dups').get_by_role('button', name='Unește', exact=True).click(); await pg.wait_for_timeout(2000)
    await pg.screenshot(path=shot('merge')); await scan(pg, r)
    await pg.get_by_role('radio', name='Rămâne').nth(1).check(); await pg.wait_for_timeout(300)
    await pg.screenshot(path=shot('merge-kept-other'))
    await pg.get_by_role('dialog').get_by_role('button', name='Unește', exact=True).click(); await pg.wait_for_timeout(500)
    r['merge_confirm'] = await pg.get_by_text('Rămâne fișa').inner_text()
    await pg.screenshot(path=shot('merge-confirm'))
    await pg.locator('[role=dialog]').last.get_by_role('button', name='Anulează').click()
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)

async def add_desktop(pg, r):
    await pg.goto(LIST); await pg.wait_for_timeout(2500)
    await pg.get_by_role('button', name='Adaugă sportiv').click(); await pg.wait_for_timeout(500)
    box = pg.get_by_placeholder('Nume, data nașterii, părinte sau telefon')
    await box.fill('Maria'); await pg.wait_for_timeout(1500)
    r['add_results'] = await pg.locator('.spv-results .spv-result').count()
    await pg.screenshot(path=shot('adauga-cauta'))
    await box.fill('Zzzz Nou'); await pg.wait_for_timeout(1500)
    r['add_none'] = await pg.get_by_role('dialog').locator('.spv-muted').inner_text()
    await pg.screenshot(path=shot('adauga-niciun'))
    await pg.get_by_role('button', name='Sportiv nou').click(); await pg.wait_for_timeout(500)
    r['add_prefill'] = await pg.get_by_role('dialog').get_by_role('textbox').first.input_value()
    await pg.screenshot(path=shot('adauga-form')); await scan(pg, r)
    await pg.keyboard.press('Escape')

async def misc_desktop(pg, r):
    await pg.goto(f"{B}/plugins/edusport-sportiv-edit?id={IDS['mariaProfile']}"); await pg.wait_for_timeout(3500)
    r['redirect_ok'] = pg.url.endswith(f"/plugins/edusport-sportivi/{IDS['maria']}")
    r['menu_groups'] = await pg.locator('.esd-glabel').all_inner_texts()
    await pg.locator('.esd-side').screenshot(path=shot('sidebar'))
    await pg.goto(LIST + '?adauga=1'); await pg.wait_for_timeout(2500)
    r['add_from_dashboard'] = await pg.get_by_role('dialog').count() == 1

async def phone(b, state, r):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, storage_state=state)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: r['page_errors'].append(str(e)))
    await pg.goto(LIST); await pg.wait_for_timeout(3000)
    r['phone_cards'] = await pg.locator('.spv-card').count()
    await pg.screenshot(path=shot('phone-list'), full_page=True); await scan(pg, r)
    await pg.get_by_role('button', name='Încarcă încă 30').click(); await pg.wait_for_timeout(2000)
    r['phone_cards_more'] = await pg.locator('.spv-card').count()
    await pg.locator('.ui-fbtn').click(); await pg.wait_for_timeout(400)
    r['phone_show'] = await pg.locator('.ui-sheet .ui-ff-show').inner_text()
    await pg.screenshot(path=shot('phone-filters')); await pg.keyboard.press('Escape')
    await pg.goto(f"{LIST}/{IDS['maria']}"); await pg.wait_for_timeout(3000)
    await pg.screenshot(path=shot('phone-record'))
    await pg.get_by_role('button', name='Editează').click(); await pg.wait_for_timeout(500)
    r['phone_footer'] = await pg.locator('.ui-sheet-f').inner_text()
    await pg.screenshot(path=shot('phone-record-edit')); await scan(pg, r)
    await pg.locator('.ui-sheet-f').get_by_role('button', name='Anulează').click()
    await pg.goto(f"{LIST}/{IDS['sara']}"); await pg.wait_for_timeout(3000)
    await pg.locator('.spv-dups').get_by_role('button', name='Unește', exact=True).click(); await pg.wait_for_timeout(2000)
    await pg.screenshot(path=shot('phone-merge'))
    await pg.goto(LIST); await pg.wait_for_timeout(2500)
    await pg.get_by_role('button', name='Adaugă sportiv').click(); await pg.wait_for_timeout(600)
    await pg.screenshot(path=shot('phone-adauga')); await scan(pg, r)
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        pg = await ctx.new_page()
        r = {'native_selects': 0, 'tagged': 0, 'page_errors': []}
        pg.on('pageerror', lambda e: r['page_errors'].append(str(e)))
        await login(pg)
        await list_desktop(pg, r)
        await record_desktop(pg, r)
        await merge_desktop(pg, r)
        await add_desktop(pg, r)
        await misc_desktop(pg, r)
        await phone(b, await ctx.storage_state(), r)
        for k, v in r.items():
            print(f'{k}: {v}')
        await b.close()

asyncio.run(main())
EOF
python3 "$T/pass.py" "$T/ids.json" "$OUT"
```

Expected output (the numbers follow from the fixture: 56 active athletes + "Victor Lungu", 17 of them incomplete, one duplicate pair, Maria with two "Da" registrations):

```
native_selects: 0
tagged: 0
page_errors: []
list_count: 57 din 57 de sportivi
banner: 17 sportivi au date incomplete.
Arată-i
dup_total: 2 sportivi
incomplete_count: 17 din 57 de sportivi
record_url_ok: True
subline: 14.03.2014, Începători
documents: 4
history_lines: 3
menu: ['Marchează inactiv', 'Unește cu alt sportiv', 'Șterge sportivul']
duplicate_line: Posibil același copil cu Sara-Maria Ilie
Unește
Nu e același copil
merge_confirm: Rămâne fișa „Sara-Maria Ilie”. Cealaltă se șterge. Acțiunea nu poate fi anulată.
add_results: 2
add_none: Niciun sportiv găsit pentru "Zzzz Nou".
add_prefill: Zzzz Nou
redirect_ok: True
menu_groups: ['Formulare', 'Program și calendar', 'Club și școală', 'Sportivi și echipă', 'Pagini site', 'Articole și media', 'Sistem']
add_from_dashboard: True
phone_cards: 30
phone_cards_more: 57
phone_show: Arată 57 de sportivi
phone_footer: Anulează
Salvează
```

`add_results` counts the search rows for "Maria" (Maria Dumitrescu and Sara-Maria Ilie by the name-word rule); any number from 1 up is fine.

- [ ] **Step 6: Look at the renders**

Open the PNGs in `phase3-renders/` (`3-5-*.png`) beside prototype v5 (`phase3b-ref-v1/proto-sportivi-*.png`), filters-v3 and bottom-sheet-v1/v2, and today's editor (`today-sportiv-edit-*.png`, every section must still be there in `3-5-record-profil.png`). Check: no em dash, no middle dot, no pill or circle, no dashed line, empty values blank, the "date lipsă" marker under the name, "Fără grupă" muted, the phone controls one height. Show them to the user in the companion (renders are reviewed after implementation, DECISIONS phase3ab). Fixes go into the owning task's files with a `fix(sportivi): ...` commit and the run is repeated.

- [ ] **Step 7: Clean up**

```bash
kill "$(cat "$T/pid")"
docker rm -f es35-pg
rm -rf "$T"
```

Expected: container removed. No commit in this task unless a check failed (then the fix commit above). The PNGs stay in the frontend repo for the user to review.

---

## Interfaces for other plans

From `src/club/sportivi/routes.ts` (pure; importable from the admin bundle and tests):

```ts
export const SPORTIVI_PATH = '/plugins/edusport-sportivi';
export const athleteRecordTo: (documentId: string) => string;   // '/plugins/edusport-sportivi/<documentId>', same tab
export const addAthleteTo: string;                              // '/plugins/edusport-sportivi?adauga=1'
export const registrationPanelTo: (documentId: string) => string; // '/plugins/edusport-inscrieri?open=<documentId>' (Needs decision 9, option A)
```

- **Plan 3-4 (Înscrieri UI):** "Deschide fișa completă", "Vezi fișa" and "Deschide fișa sportivului" navigate to `athleteRecordTo(athleteId)` in the same tab (gaps #33); the record opens on Date of the current season. Under Needs decision 9 option A, the Înscrieri page opens the panel of `?open=<registration documentId>` on load (this plan's "Înscrieri" block links there); under option B nothing is needed from 3-4.
- **Plan 3-4, Istoric:** this plan formats `HistoryLine.at` with `historyWhen` (`src/club/sportivi/record-view.ts`, "3 oct 2026, 14:22", Europe/Bucharest) and shows `actor` beside it, the text under (Needs decision 8). Reuse `historyWhen` so both Istoric tabs read the same.
- `src/admin/dashboard/sportivi/AthleteSearch.tsx` (`AthleteSearch`, props `{ api, onPick, onNew?, exclude? }`) is the same search as the confirm window's "Caută alt sportiv"; plan 3-4 may reuse it with its own `onPick` (it calls `GET /api/club/athletes/search?q=` without `registration`).

## Notes for other plans

- **Plan 3-4:** this plan imports `downloadPdf` and `registrationDocumentUrl` from `src/admin/dashboard/inscrieri/downloadPdf.ts`; if 3-4 moves that file, keep the two exports (or update `DocumentsTab.tsx`).
- **Plan 3-2:** `SportivEditPage.tsx` now only redirects; `CompetitiiPage.tsx` keeps navigating to `SPORTIV_EDIT_TO?id=<profile>` and lands on the record through `GET /api/club/athletes/by-profile/:profileId`. The dashboard tile is 3-2 Task 25; this plan only repoints the quick action "Adaugă sportiv".
- `SPORTIV_DELETE_COPY` is gone from `SportiviPage.tsx` (Task 7); no other file imports it after Task 8.

## Self-review

- **Spec coverage.**
  - 5 Sportivi list: menu entry replaced (Tasks 1, 7); header, subtitle, "Adaugă sportiv", no Export / Coloane (6, 11); toolbar search with the gaps #9 placeholder, season selector "Sezon <x>" changing only Grupa and A.C.S. (6, list route of 3-2), filters-v3 with Secțiune, Grupa, Fără grupă, Membru A.C.S., Profil public, Date, Status, Posibile dubluri, live total, "Șterge tot", "Gata", search above 8 (Task 2 sections, plan 3-1 FilterPanel); sort "Nume A-Z" / "Vârstă" / "Grupă" with sortable headers (2, 6); columns and cells, "Fără grupă", A.C.S. three states, "Public" / "Ascuns", "date lipsă" + "Lipsesc: ..." (2, 6); inactive hidden unless Status asks (2: no default status); banner with singular (2, 6); 50 per page, empty text, count line (2, 6); same-tab links (6); phone cards, 30 at a time, "Încarcă încă 30", filters and sort in the bottom sheet, "Arată N sportivi" / "Arată 1 sportiv", controls one height (2, 5, 6).
  - 6.1 full page with back link "Sportivi", phone full-height sheet with scrolling tabs and footer "Salvează" (7); header name, sub-line, "Date incomplete" (3, 7); "..." menu (3, 10); duplicate line under the header (10); tabs, opens on Date (3, 7). 6.2 fields, Editează with the picker, "lipsește", hint, toasts, A.C.S. line, "Înscrieri" block (3, 7); name change renames the profile (server, plan 3-2). 6.3 whole editor moved, name and slug read-only, "Creează profil public", visibility as today, note (8). 6.4 Documente rows, "Vezi" / "Descarcă", empty text (7). 6.5 Istoric (3, 7). 6.6 Marchează inactiv / activ with the Open 3 dialog, duplicates with "Unește" / "Nu e același copil", delete with the spec message, merge with kept record, per-field choice and the Open 3 confirmation (3, 4, 9, 10). 6.7 search first, rows as 4.1, "Sportiv nou" form, required fields, "Activ" (4, 5, 11).
  - 7 section "Club și școală" above "Sportivi și echipă", Sportivi only (1); old editor route redirects (1); dashboard tile (plan 3-2 Task 25; quick action repointed in 11).
  - 8 (Sportivi parts): FilterPanel, BottomSheet full height (record, merge, add), BirthDatePicker shared with Editează, Select, phone width (5 to 11, Task 12 phone renders).
  - 12 browser checks for 3B: list filters incl. "Posibile dubluri", record tabs, duplicate line, merge (window and confirmation, not executed on the data so the phone renders keep the pair), Adaugă sportiv, old editor redirect (Task 12). Delete is pinned by the Task 10 source test only; Task 12 does not delete (no data to spare for the phone pass).
- **Placeholder scan:** every step carries its code or the exact replacement; no TBD, no "similar to Task N".
- **Type consistency:** `ListState`, `SectionModel`, `EditDraft`, `EditBody`, `DraftErrors`, `MergeState`, `Side`, `SearchResult`, `FooterAction`, `SportiviApi`, `AthleteList`, `Loaded` are defined once (Tasks 2 to 7) and used with the same names; `useRecordFooter(active ? ... : null)` in Date and Profil public; `onMerge` is `() => void` on the menu and `(otherId: string) => void` on the duplicate lines and `RecordContent`, as written in Task 10.
- **Review Focus:** each line has its test: birth date (Task 3), phone paging (Tasks 2 and 6), merge switch (Task 4, Task 12 confirm text), tabs keeping work (Tasks 7 and 8), plurals (Task 2).
