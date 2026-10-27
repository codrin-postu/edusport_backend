# Phase 4-5: Admin "Grupe" and the Group Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The admin screens of groups: the "Grupe" menu entry and list page (tabs per section, season, Program / Antrenori / Sportivi columns, distinct-athletes line, phone cards), the orange "Fără grupă" dropdown with "Alocă" and "Alocă toți în grupele propuse", "Grupă nouă" / "Editează grupa", and the group page (option A) with tabs Sportivi (row menu, the move window, "Adaugă și în grupă", "Scoate din grupă", "Adaugă sportivi"), Program ("Program obișnuit", the calendar in Listă / Lună, "Program nou", "Schimbă programul", the per-date panel with "Ține / Anulează / Mută", reason and the parent e-mail box) and Istoric; every action with its toast and "Anulează" for 8 seconds.

**Architecture:** Every rule a screen needs is a pure module in `src/club/grupe/` (routes, list view, group view, program view) plus the strings in `src/club/groups/copy/grupe-ui.ts`, tested with Vitest; the React components in `src/admin/dashboard/grupe/` stay thin, call the plan 4-1 / 4-2 routes through one `useGrupeApi` hook, and are pinned by source-reading tests (the admin bundle has no test runner). The group calendar reuses the existing admin calendar components (`plugins/component-preview/admin/src/calendar/CalendarView.tsx`), which gain a chip-view function, a week-title function and an optional "add on a day" handler, so the general calendar keeps its exact behaviour. A boot check on a throwaway Postgres renders every screen at 1440x900 and 390x844 for comparison with the approved mockups.

**Tech Stack:** React 18 (Strapi 5.52.1 admin, `strict: true`), the shared admin UI (`src/admin/ui`), Vitest 3, Python Playwright for the renders, Postgres 16.

**Spec:** `docs/superpowers/specs/2026-10-27-groups-schedules-design.md` (v1.1), sections 5.1 to 5.4, 6.1 to 6.4, 11, 12 (UI source tests, renders); approved mockups in `/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/phase4/` (`grupe-list.html`, `grupa-a.html`). Decisions: `../edusport_frontend/docs/portal/DECISIONS.md`. Agent rules: `.superpowers/phase3-shared/agent-rules.md`. Index: `docs/superpowers/plans/2026-10-27-phase4-index.md`.

**Base:** `feat/athletes` with plans 4-1 and 4-2 merged. Read their "Interfaces for other plans". Runs in parallel with plans 4-3, 4-4 and 4-7. Plan 4-6 builds on this plan's `DatePanel` and group page.

**Parallel groups:** A: T1, T2 | B: T3 | C: T4, T5 | D: T6 | E: T7

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Pure views and copy, 2 Program view | plans 4-1, 4-2 | 1: routes.ts, list-view.ts, group-view.ts, copy/grupe-ui.ts, copy.ts; 2: program-view.ts |
| B | 3 Menu, page, api, list, group window | A | menu.tsx, GrupePage.tsx, grupe/api.ts, undo.ts, styles.ts, PanelShell.tsx, GrupeList.tsx, GroupDialog.tsx, admin-ui-check.mjs |
| C | 4 "Fără grupă", 5 Group page with Sportivi and Istoric | 3 | 4: UnassignedButton.tsx; 5: GroupPage.tsx, GroupMenu.tsx, RosterTab.tsx, MemberMenu.tsx, MoveDialog.tsx, AddMembers.tsx, GroupHistoryTab.tsx |
| D | 6 Program tab | 5 | CalendarView.tsx, model.ts (types only), GroupPage.tsx (Program tab added), ProgramTab.tsx, GroupCalendar.tsx, ProgramDrawer.tsx, DatePanel.tsx |
| E | 7 Boot check and renders | everything | no repo files |

## Decided while planning (low impact, decided by Claude; the user may overrule any line)

Log them in DECISIONS.md as "plan 4-5, decided by Claude (low impact, 2026-10-27)".

1. **The season lives in the address**: `/plugins/edusport-grupe?season=2026-2027&section=club` and `/plugins/edusport-grupe/<id>?season=2026-2027`; the group page opens with `&tab=program` after "Creează grupa" (spec 5.4).
2. **A tab with no group** shows "Nicio grupă." under the count line (`copy/grupe-ui.ts`); every section is a tab, also with 0 groups, so its first group can be created there.
3. **"Adaugă sportivi"** lists "Fără grupă" rows (the 5.3 list, with their source line) by default and, with the switch "Toți sportivii", the P3 athlete search ("Caută sportiv", type at least two letters); athletes already in the group are hidden; the button reads "Adaugă în grupă" and is disabled until one is ticked.
4. **Date panel on a moved date** opens on "Mută" with its new date and time filled in; on a cancelled date on "Anulează" with its reason; "Anunță părinții pe e-mail" is always unticked when the panel opens (W7).
5. **"Schimbă programul" keeps "Cât de des" and "Zile"** from the series, and "Se aplică din" defaults to the series' next class date (or today when it has none) (`program-view.ts::formFromRow`).
6. **Phone shells**: the group page is a full-height bottom sheet like the athlete record; the move window, "Grupă nouă" and "Adaugă și în grupă" are full-height sheets; "Program nou" and the date panel are bottom sheets (full height); the "Fără grupă" list is a bottom sheet.
7. **Grupe menu position**: "Grupe" is the first item of "Club și școală", above "Sportivi" (spec 5.1); its Strapi menu link uses `GridFour` (the icon set has no group icon; the shell shows the label).
8. **The month grid on the group page** has no "add on this day" buttons (the general calendar keeps them); dates open the panel.

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes`. Commit only in the worktree your dispatch names; check `git rev-parse --show-toplevel` and `git branch --show-current` before every commit.
- A dated entry in `edusport_frontend/docs/portal/DECISIONS.md` wins over the spec; an approved mockup wins over older mockups; the spec wins over this plan's prose; this plan's code is followed verbatim unless it fails (fix the minimum, say what and why).
- Checks after every task: the task's tests, `npx vitest run`, `npx tsc --noEmit`, `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict` (exit 0).
- Code: TypeScript, no `any`, single quotes in `src/`, functions under 30 lines (split components), complexity under 10, no dead code, no comments that restate code. Pure modules in `src/club/**` import no React, Strapi or Node.
- Design (binding): admin tokens only (`var(--theme-*)`, `var(--ui-*)`, `var(--theme-cat-*)`), no raw colours, no dashed or dotted lines, no pills or circles (count badges and day toggles are square; only the spinner is round), every screen at 390 px wide without horizontal scroll, no backtick inside a CSS string. Read the component source and the tokens to match existing UI; never infer from screenshots.
- Copy: every string in `src/club/groups/copy/grupe-ui.ts` (or the plan 4-1 / 4-2 copy files); Romanian, terse; straight quotes; no em dash; no middle dot; no emoji; the spec's "->" is "→".
- Toasts of actions with an undo: `adminToast.success(text, { duration: 8000, action: { label: 'Anulează', onClick } })` (no X, plan 3-1); a failure shows the server's message or "Acțiunea nu a reușit. Nimic nu a fost salvat."; a load failure "Nu am putut încărca datele.".
- Synthetic data only. Never production, `strapi_app` / `strapi_db`, 1337, 5432, 1340, 3010, `edusport-test-pg`. Task 7 uses container `es45-pg` on 127.0.0.1:55445 and Strapi on 1365.
- Commits: Conventional Commits, exactly the message in the task, no `Co-Authored-By`, no AI attribution. Never push.
- Progress board: `printf '%s | 4-5 T<n> | implementer | <status>\n' "$(date -u +%H:%M)" >> /Users/codrin/Documents/Programming/edusport_backend/.superpowers/phase3-shared/progress-board.md`.

## Review Focus

- **A past season** chosen in the season select (or opened from an old link): no "Fără grupă", no "Grupă nouă", no row "...", no "Adaugă sportivi", no "Adaugă program", no "Schimbă", and the date panel opens read-only. Pinned by Task 1 (`writable`) and the source tests of Tasks 3, 5 and 6, and Task 7 renders.
- **The toast's "Anulează" after the screen moved on** (the admin closed the dropdown, switched tab or left the page): the undo still runs (plain async, no component state), the screen that is open reloads, and a refused undo shows the server's text. Pinned by Task 3 (`undo.ts` source test) and Task 7.
- **A long group or athlete name, many groups, a phone**: names wrap, the table and cards never scroll sideways at 390 px, the "Fără grupă" rows keep the group select usable. Pinned by Task 7 renders (a 40-letter group name in the fixture run).
- **Two quick clicks on "Alocă", "Mută" or "Salvează"**: the button is busy until the answer, so one request is sent. Pinned by the source tests (`busy`) of Tasks 4 to 6.
- **The date panel on a break date or on a moved date**: a break opens read-only with "Pauză: <nume>.", a moved date is addressed by its original series date (the server's key). Pinned by Task 2 (`dateKey`, `isBreak`) and Task 7.

---

## File Structure

```
src/club/groups/copy/grupe-ui.ts          GRUPE_COPY, FREQ_LABELS, WEEK_OF_MONTH_LABELS (T1, T2)
src/club/groups/copy.ts                   + export * from './copy/grupe-ui' (T1)
src/club/grupe/
  routes.ts          GRUPE_PATH, grupeListTo, groupPageTo, groupIdFromSplat, readGrupeQuery (T1)
  list-view.ts       countLine, coachesText, phoneSummary, tabItems, writable, seasonOptions, groupOptions, initialPicks, allocateItems (T1)
  group-view.ts      subtitle, groupTabs, ageText, mainText, othersText, phoneMemberLine, memberMenuItems, addCandidates (T1)
  program-view.ts    chip view, week title, panel title, duration options, program form and body, date form and body, toasts (T2)
  __tests__/         views.test.ts (T1), program-view.test.ts (T2), admin-grupe.test.ts (T3 to T6, source reading)
src/admin/dashboard/
  menu.tsx           "Grupe" above "Sportivi" (T3)
  GrupePage.tsx      list or group page by route (T3)
  grupe/
    api.ts           useGrupeApi (T3)
    undo.ts          UNDO_MS, undoToast, failToast, grupeChanged, useGrupeRefresh (T3)
    PanelShell.tsx   WindowShell (Modal or full-height sheet), PanelShell (Drawer or full-height sheet) (T3)
    styles.ts        GRUPE_CSS (T3)
    GrupeList.tsx    header, season, tabs, count line, table, cards (T3)
    GroupDialog.tsx  "Grupă nouă" / "Editează grupa" (T3)
    UnassignedButton.tsx  "Fără grupă" (T4)
    GroupPage.tsx, GroupMenu.tsx, RosterTab.tsx, MemberMenu.tsx, MoveDialog.tsx, AddMembers.tsx, GroupHistoryTab.tsx (T5)
    ProgramTab.tsx, GroupCalendar.tsx, ProgramDrawer.tsx, DatePanel.tsx (T6)
src/plugins/component-preview/admin/src/calendar/CalendarView.tsx   view, weekTitle, optional onAddOn (T6)
src/plugins/component-preview/admin/src/calendar/model.ts           Occurrence gains groupId, groupName, originalDate, originalStartTime (T6)
scripts/admin-ui-check.mjs                 dashboard/grupe held to the colour rule (T3)
```

---

### Task 1: Pure views and the Grupe copy

**Files:**
- Create: `src/club/groups/copy/grupe-ui.ts`, `src/club/grupe/routes.ts`, `src/club/grupe/list-view.ts`, `src/club/grupe/group-view.ts`
- Modify: `src/club/groups/copy.ts` (one export line)
- Test: `src/club/grupe/__tests__/views.test.ts`

**Interfaces:**
- Consumes: plan 4-1 (`api-types.ts`, `athletesText`, `groupsText`, `GROUP_TOASTS`, `countWords`), `recordIdFromSplat` (`src/club/sportivi/routes.ts`).
- Produces:
  - `GRUPE_COPY` (every Grupe and group page label; see Step 3), `FREQ_LABELS`, `WEEK_OF_MONTH_LABELS`.
  - `GRUPE_PATH = '/plugins/edusport-grupe'`, `grupeListTo(season, section)`, `groupPageTo(documentId, season, tab?)`, `groupIdFromSplat(splat)`, `readGrupeQuery(search): { season; section; tab }`.
  - `countLine(page)`, `coachesText(row)`, `phoneSummary(row)`, `tabItems(page)`, `writable(page)`, `seasonOptions(page)`, `groupOptions(groups, exceptId)`, `Picks`, `initialPicks(rows)`, `allocateItems(rows, picks)`.
  - `subtitle(page)`, `GroupTab`, `groupTabs(page)`, `ageText(age)`, `mainText(member)`, `othersText(member)`, `phoneMemberLine(member)`, `MemberAction`, `memberMenuItems()`, `addCandidates(rows, members)`.

- [ ] **Step 1: Write the failing test**

`src/club/grupe/__tests__/views.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GroupListPage, GroupPage, MemberRow } from '../../groups/api-types';
import { addCandidates, groupTabs, mainText, memberMenuItems, othersText, phoneMemberLine, subtitle } from '../group-view';
import { allocateItems, coachesText, countLine, groupOptions, initialPicks, phoneSummary, seasonOptions, tabItems, writable } from '../list-view';
import { groupIdFromSplat, groupPageTo, grupeListTo, readGrupeQuery } from '../routes';

const LIST: GroupListPage = {
  season: { documentId: 's26', label: '2026-2027', past: false },
  seasons: [{ documentId: 's27', label: '2027-2028', isCurrent: false }, { documentId: 's26', label: '2026-2027', isCurrent: true }],
  tabs: [{ documentId: 'afi', slug: 'scoala-afi', label: 'Școala de patinaj', count: 7 }, { documentId: 'club', slug: 'club', label: 'Club', count: 2 }], section: 'scoala-afi',
  athletes: 77, groups: 7, unassigned: 3,
  rows: [{ documentId: 'g1', name: 'Avansați', program: ['Lu, Mi 17:00', 'Sâ 09:00'], coaches: ['Andreea Pascu'], members: 10 }, { documentId: 'g2', name: 'Nou', program: [], coaches: [], members: 1 }],
};
const member = (over: Partial<MemberRow>): MemberRow => ({ membershipId: 'm', athleteId: 'a', name: 'Ana', age: 12, isMain: true, others: [], ...over });
const PAGE: GroupPage = {
  documentId: 'g-ib', name: 'Intermediari Bronze', section: { documentId: 'afi', name: 'Școala de patinaj', kind: 'school' }, priceList: { documentId: 'pl', name: 'Standard' },
  coaches: [{ documentId: 't', name: 'Virgil Pascu' }], programPublic: true, season: { documentId: 's26', label: '2026-2027', past: false },
  members: Array.from({ length: 11 }, (_, i) => member({ membershipId: `m${i}`, athleteId: `a${i}` })), historyCount: 5, deletable: false,
};

describe('routes (5.1, decided 1)', () => {
  it('keeps the season and the tab in the address', () => {
    expect(grupeListTo('2026-2027', 'club')).toBe('/plugins/edusport-grupe?season=2026-2027&section=club');
    expect(grupeListTo(null, null)).toBe('/plugins/edusport-grupe');
    expect(groupPageTo('g 1', '2026-2027', 'program')).toBe('/plugins/edusport-grupe/g%201?season=2026-2027&tab=program');
    expect(groupIdFromSplat('g-ib/x')).toBe('g-ib');
    expect(readGrupeQuery('?season=2027-2028&tab=program')).toEqual({ season: '2027-2028', section: null, tab: 'program' });
  });
});

describe('Grupe list (5.2)', () => {
  it('writes the count line, program lines, coaches and phone cards', () => {
    expect(countLine(LIST)).toBe('77 de sportivi în 7 grupe');
    expect(coachesText(LIST.rows[0])).toBe('Andreea Pascu');
    expect(coachesText(LIST.rows[1])).toBeNull();
    expect(phoneSummary(LIST.rows[0])).toBe('Lu, Mi 17:00, Sâ 09:00, 10 sportivi');
    expect(phoneSummary(LIST.rows[1])).toBe('Fără program, 1 sportiv');
  });

  it('tabs with counts, the season choices, and writes only on a season that is not past (W5)', () => {
    expect(tabItems(LIST)).toEqual([{ id: 'scoala-afi', label: 'Școala de patinaj', count: 7 }, { id: 'club', label: 'Club', count: 2 }]);
    expect(seasonOptions(LIST)).toEqual([{ value: '2027-2028', label: 'Sezon 2027-2028' }, { value: '2026-2027', label: 'Sezon 2026-2027' }]);
    expect(writable(LIST)).toBe(true);
    expect(writable({ ...LIST, season: { documentId: 's25', label: '2025-2026', past: true } })).toBe(false);
  });

  it('"Fără grupă": options with the section as hint, proposals preselected, rows without a group not sent (W6)', () => {
    const groups = [{ documentId: 'g1', name: 'Primii Pași', sectionName: 'Școala de patinaj' }, { documentId: 'g2', name: 'Avansați', sectionName: 'Club' }];
    expect(groupOptions(groups, 'g1')).toEqual([{ value: 'g2', label: 'Avansați', hint: 'Club' }]);
    const rows = [{ athleteId: 'a1', name: 'A', source: '', proposedGroupId: 'g1' }, { athleteId: 'a2', name: 'B', source: '', proposedGroupId: null }];
    const picks = initialPicks(rows);
    expect(allocateItems(rows, picks)).toEqual([{ athleteId: 'a1', groupId: 'g1' }]);
  });
});

describe('group page (6.1, 6.2)', () => {
  it('subtitle: section, coaches, price list, count; "Fără antrenor" and no list part when missing', () => {
    expect(subtitle(PAGE)).toBe('Școala de patinaj, Virgil Pascu, lista Standard, 11 sportivi');
    expect(subtitle({ ...PAGE, coaches: [], priceList: null })).toBe('Școala de patinaj, Fără antrenor, 11 sportivi');
  });

  it('tabs Sportivi (count), Program, Istoric (count)', () => {
    expect(groupTabs(PAGE)).toEqual([{ id: 'sportivi', label: 'Sportivi', count: 11 }, { id: 'program', label: 'Program' }, { id: 'istoric', label: 'Istoric', count: 5 }]);
  });

  it('roster cells and the phone line', () => {
    const daria = member({ isMain: false, age: 11, others: [{ name: 'Avansați', isMain: true }] });
    expect([mainText(daria), othersText(daria)]).toEqual(['Nu', 'Avansați (principală)']);
    expect(othersText(member({}))).toBeNull();
    expect(phoneMemberLine(daria)).toBe('11 ani, și în Avansați');
    expect(phoneMemberLine(member({ age: 13, others: [{ name: 'Profesioniști', isMain: false }] }))).toBe('13 ani, principală, și în Profesioniști');
    expect(phoneMemberLine(member({ age: null }))).toBe('principală');
  });

  it('row menu and add candidates', () => {
    expect(memberMenuItems().map((i) => [i.key, i.label, i.danger])).toEqual([['move', 'Mută', false], ['addAlso', 'Adaugă și în grupă', false], ['remove', 'Scoate din grupă', true]]);
    expect(addCandidates([{ athleteId: 'a0', name: 'X' }, { athleteId: 'zz', name: 'Y' }], PAGE.members).map((r) => r.athleteId)).toEqual(['zz']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/grupe/__tests__/views.test.ts`
Expected: FAIL (`Cannot find module '../group-view'`).

- [ ] **Step 3: Write `copy/grupe-ui.ts` and its export**

```ts
import { athletesText } from './core';

/** Grupe list and group page labels (spec 5, 6). Toasts and history: `core.ts`, `schedule.ts`. */
export const GRUPE_COPY = {
  title: 'Grupe',
  unassigned: 'Fără grupă',
  newGroup: 'Grupă nouă',
  season: (label: string) => `Sezon ${label}`,
  seasonLabel: 'Sezon',
  tabsLabel: 'Secțiuni',
  colGroup: 'Grupă',
  colProgram: 'Program',
  colCoaches: 'Antrenori',
  colMembers: 'Sportivi',
  noProgram: 'Fără program',
  noCoach: 'Fără antrenor',
  noGroups: 'Nicio grupă.',
  unassignedHeader: (n: number) => `${athletesText(n)} fără grupă`,
  pickGroup: 'Alege grupa',
  allocate: 'Alocă',
  allocateAll: 'Alocă toți în grupele propuse',
  windowNew: 'Grupă nouă',
  windowEdit: 'Editează grupa',
  fieldName: 'Nume',
  fieldPriceList: 'Listă de prețuri',
  optional: 'Opțional',
  fieldCoaches: 'Antrenori',
  fieldPublic: 'Program public',
  publicHint: 'Programul apare în calendarul de pe site.',
  create: 'Creează grupa',
  save: 'Salvează',
  cancel: 'Anulează',
  back: 'Grupe',
  menu: 'Mai multe acțiuni',
  edit: 'Editează grupa',
  remove: 'Șterge grupa',
  removeConfirm: (name: string) => `Ștergi grupa "${name}"? Acțiunea nu poate fi anulată.`,
  tabMembers: 'Sportivi',
  tabProgram: 'Program',
  tabHistory: 'Istoric',
  addMembers: 'Adaugă sportivi',
  colAthlete: 'Sportiv',
  colAge: 'Vârstă',
  colMain: 'Principală',
  colOthers: 'Alte grupe',
  yes: 'Da',
  no: 'Nu',
  none: 'Niciuna',
  mainMark: ' (principală)',
  phoneMain: 'principală',
  phoneAlso: (group: string) => `și în ${group}`,
  rowMove: 'Mută',
  rowAddAlso: 'Adaugă și în grupă',
  rowRemove: 'Scoate din grupă',
  moveTitle: 'Mută în altă grupă',
  addAlsoTitle: 'Adaugă și în grupă',
  fieldAthlete: 'Sportiv',
  fieldFrom: 'Din',
  fieldTo: 'În',
  move: 'Mută',
  add: 'Adaugă',
  addMembersTitle: 'Adaugă sportivi',
  allAthletes: 'Toți sportivii',
  searchAthletes: 'Caută sportiv',
  addToGroup: 'Adaugă în grupă',
  usual: 'Program obișnuit',
  change: 'Schimbă',
  addProgram: 'Adaugă program',
  fromDate: (date: string) => `din ${date}`,
  viewList: 'Listă',
  viewMonth: 'Lună',
  today: 'Azi',
  prevMonth: 'Luna anterioară',
  nextMonth: 'Luna următoare',
  drawerNew: 'Program nou',
  drawerChange: 'Schimbă programul',
  repeat: 'Se repetă',
  howOften: 'Cât de des',
  weekOfMonth: 'Săptămâna din lună',
  days: 'Zile',
  startAt: 'De la',
  duration: 'Durată',
  appliesFrom: 'Se aplică din',
  date: 'Data',
  note: 'Notă',
  endProgram: 'Șterge programul',
  endConfirm: (date: string) => `Ștergi programul din ${date}? Datele de dinainte rămân.`,
  thisDate: 'Această dată',
  keep: 'Ține',
  cancelDate: 'Anulează',
  moveDate: 'Mută',
  newDate: 'Data nouă',
  reason: 'Motiv',
  notify: 'Anunță părinții pe e-mail',
  deleteClass: 'Șterge ședința',
  deleteClassConfirm: (date: string) => `Ștergi ședința din ${date}?`,
  breakNotice: (name: string) => `Pauză: ${name}.`,
  cancelled: 'Anulată',
  movedFrom: (what: string) => `Mutată de la ${what}`,
  openGroup: 'Deschide grupa',
  nothingThisMonth: 'Nimic programat în această lună.',
} as const;

export const FREQ_LABELS = { weekly: 'Săptămânal', biweekly: 'La 2 săptămâni', monthly: 'Lunar' } as const;
export const WEEK_OF_MONTH_LABELS = { first: 'Prima', second: 'A doua', third: 'A treia', fourth: 'A patra', last: 'Ultima' } as const;
```

`src/club/groups/copy.ts`, add:

```ts
export * from './copy/grupe-ui';
```

- [ ] **Step 4: Write `routes.ts`, `list-view.ts`, `group-view.ts`**

`src/club/grupe/routes.ts`:

```ts
import { recordIdFromSplat } from '../sportivi/routes';

/** Admin addresses of Grupe (spec 5.1, decided 1). Pure: the admin bundle and the tests import it. */
export const GRUPE_PATH = '/plugins/edusport-grupe';
export type GrupeQuery = { season: string | null; section: string | null; tab: string | null };

function query(values: Record<string, string | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const grupeListTo = (season: string | null, section: string | null): string => `${GRUPE_PATH}${query({ season, section })}`;
export const groupPageTo = (documentId: string, season: string | null, tab: 'program' | null = null): string =>
  `${GRUPE_PATH}/${encodeURIComponent(documentId)}${query({ season, tab })}`;
export const groupIdFromSplat = recordIdFromSplat;

export function readGrupeQuery(search: string): GrupeQuery {
  const p = new URLSearchParams(search);
  const get = (k: string): string | null => p.get(k)?.trim() || null;
  return { season: get('season'), section: get('section'), tab: get('tab') };
}
```

`src/club/grupe/list-view.ts`:

```ts
import type { GroupChoice, GroupListPage, GroupListRow, UnassignedRow } from '../groups/api-types';
import { GRUPE_COPY, athletesText, groupsText } from '../groups/copy';

/** Grupe list (spec 5.2, 5.3). Pure. */
export const countLine = (p: Pick<GroupListPage, 'athletes' | 'groups'>): string => `${athletesText(p.athletes)} în ${groupsText(p.groups)}`;
export const coachesText = (r: GroupListRow): string | null => (r.coaches.length ? r.coaches.join(', ') : null);
export const phoneSummary = (r: GroupListRow): string => `${r.program.length ? r.program.join(', ') : GRUPE_COPY.noProgram}, ${athletesText(r.members)}`;
export const tabItems = (p: GroupListPage): { id: string; label: string; count: number }[] => p.tabs.map((t) => ({ id: t.slug, label: t.label, count: t.count }));
/** W5: writes only on a season that is not past. */
export const writable = (p: { season: { past: boolean } | null }): boolean => !!p.season && !p.season.past;
export const seasonOptions = (p: GroupListPage): { value: string; label: string }[] => p.seasons.map((s) => ({ value: s.label, label: GRUPE_COPY.season(s.label) }));

export const groupOptions = (groups: GroupChoice[], exceptId: string | null): { value: string; label: string; hint: string }[] =>
  groups.filter((g) => g.documentId !== exceptId).map((g) => ({ value: g.documentId, label: g.name, hint: g.sectionName }));

export type Picks = Record<string, string | null>;
export const initialPicks = (rows: UnassignedRow[]): Picks => Object.fromEntries(rows.map((r) => [r.athleteId, r.proposedGroupId]));

/** "Alocă toți în grupele propuse": every row with a group chosen (proposed or changed); rows without one stay (W6). */
export const allocateItems = (rows: UnassignedRow[], picks: Picks): { athleteId: string; groupId: string }[] =>
  rows.flatMap((r) => (picks[r.athleteId] ? [{ athleteId: r.athleteId, groupId: picks[r.athleteId] as string }] : []));
```

`src/club/grupe/group-view.ts`:

```ts
import type { GroupPage, MemberRow } from '../groups/api-types';
import { GRUPE_COPY, athletesText } from '../groups/copy';
import { countWords } from '../ro-count';

/** The group page (spec 6.1, 6.2). Pure. */
export type GroupTab = 'sportivi' | 'program' | 'istoric';
export type MemberAction = 'move' | 'addAlso' | 'remove';

/** "Școala de patinaj, Virgil Pascu, lista Standard, 11 sportivi"; "Fără antrenor"; no list part without a price list. */
export function subtitle(p: GroupPage): string {
  const coaches = p.coaches.length ? p.coaches.map((c) => c.name).join(', ') : GRUPE_COPY.noCoach;
  return [p.section?.name ?? '', coaches, p.priceList ? `lista ${p.priceList.name}` : '', athletesText(p.members.length)].filter(Boolean).join(', ');
}

export const groupTabs = (p: GroupPage): { id: GroupTab; label: string; count?: number }[] => [
  { id: 'sportivi', label: GRUPE_COPY.tabMembers, count: p.members.length },
  { id: 'program', label: GRUPE_COPY.tabProgram },
  { id: 'istoric', label: GRUPE_COPY.tabHistory, count: p.historyCount },
];

export const ageText = (age: number | null): string => (age === null ? '' : countWords(age, 'an', 'ani'));
export const mainText = (m: MemberRow): string => (m.isMain ? GRUPE_COPY.yes : GRUPE_COPY.no);
export const othersText = (m: MemberRow): string | null =>
  m.others.length ? m.others.map((o) => (o.isMain ? `${o.name}${GRUPE_COPY.mainMark}` : o.name)).join(', ') : null;

/** Phone card: "<n> ani, principală, și în <grupă>", parts present only when true. */
export const phoneMemberLine = (m: MemberRow): string =>
  [ageText(m.age), m.isMain ? GRUPE_COPY.phoneMain : '', ...m.others.map((o) => GRUPE_COPY.phoneAlso(o.name))].filter(Boolean).join(', ');

export const memberMenuItems = (): { key: MemberAction; label: string; danger: boolean }[] => [
  { key: 'move', label: GRUPE_COPY.rowMove, danger: false },
  { key: 'addAlso', label: GRUPE_COPY.rowAddAlso, danger: false },
  { key: 'remove', label: GRUPE_COPY.rowRemove, danger: true },
];

/** "Adaugă sportivi": athletes already in the group are not listed (W3). */
export const addCandidates = <T extends { athleteId: string }>(rows: T[], members: MemberRow[]): T[] => rows.filter((r) => !members.some((m) => m.athleteId === r.athleteId));
```

- [ ] **Step 5: Run the tests and checks**

Run: `npx vitest run src/club/grupe/__tests__/views.test.ts src/club/groups/__tests__/copy.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS (the copy scan includes the new file); zero type errors.

- [ ] **Step 6: Commit**

```bash
git add src/club/groups/copy/grupe-ui.ts src/club/groups/copy.ts src/club/grupe
git commit -m "feat(grupe): pure views and copy of the Grupe list and the group page"
```

---

### Task 2: Program view (chips, panels, forms)

**Files:**
- Create: `src/club/grupe/program-view.ts`
- Test: `src/club/grupe/__tests__/program-view.test.ts`

**Interfaces:**
- Consumes: plan 4-2 (`ProgramRow`, `Occurrence` from `src/api/calendar-event/services/expand.ts`, `DURATION`, `durationLabel`, `SCHEDULE_TOASTS`, `SCHEDULE_ERRORS`), plan 4-1 (`dayMonth`, `weekdayName`, `capitalized`, `MONTHS_SHORT`, `MONTHS_LONG`, `DAY_ORDER`, `DAY_SHORT`, `DayKey`, `WeekOfMonth`), Task 1 copy.
- Produces:
  - `ChipView = { cat: 'scoala' | 'antrenament' | 'anulat' | 'liber'; time: string; text: string; struck: boolean; title: string }`, `ChipSource` (the fields read; both occurrence types fit), `groupChip(o)` (6.3: normal "11:00"; cancelled "Anulată: <motiv>"; moved "Mutată de la 11:00 | 14 noiembrie"; break "<pauză>").
  - `weekTitle(monday: Date)` ("9 - 15 noiembrie", "26 oct - 1 noiembrie"), `panelTitle(date, time)` ("Sâmbătă, 14 noiembrie, 11:00"), `isBreak(o)`, `dateKey(o)` (the series date the server addresses), `durationOptions()`, `freqOptions()`, `weekOfMonthOptions()`, `DAY_TOGGLES` (`{ key, label }[]`, Monday first).
  - `ProgramForm = { repeat; freq; weekOfMonth; days; startTime; durationMin; from; date; note }`, `newProgramForm(today)`, `formFromRow(row, today)`, `programFormError(f)`, `programBody(f)`, `changeBody(f)`, `programToast(answer)`.
  - `DateForm = { mode; newDate; newStartTime; reason; notify }`, `dateFormOf(o)`, `dateBody(f)`, `dateToast(mode, date)`.

- [ ] **Step 1: Write the failing test**

`src/club/grupe/__tests__/program-view.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Occurrence } from '../../../api/calendar-event/services/expand';
import type { ProgramRow } from '../../groups/program-read';
import {
  changeBody, dateBody, dateFormOf, dateKey, dateToast, durationOptions, formFromRow, groupChip, isBreak, newProgramForm, panelTitle, programBody, programFormError, weekTitle,
} from '../program-view';

const occ = (over: Partial<Occurrence>): Occurrence => ({
  eventId: 1, documentId: 'e1', title: 'Intermediari Bronze', type: 'scoala', label: null, color: null, order: 0, date: '2026-11-14', startTime: '11:00', endTime: '11:50',
  endsNextDay: false, endDate: '2026-11-14', status: 'scheduled', cancelReason: null, state: 'curs', note: null, groupId: 'g-ib', groupName: 'Intermediari Bronze', originalDate: null, originalStartTime: null, ...over,
});

describe('chips of the group calendar (6.3, W12)', () => {
  it('normal, cancelled, moved and break dates', () => {
    expect(groupChip(occ({}))).toMatchObject({ cat: 'scoala', time: '11:00', text: '', struck: false });
    expect(groupChip(occ({ status: 'cancelled', cancelReason: 'exception', note: 'Competiție la Brașov' }))).toMatchObject({ cat: 'anulat', text: 'Anulată: Competiție la Brașov', struck: true });
    expect(groupChip(occ({ status: 'cancelled', cancelReason: 'exception' })).text).toBe('Anulată');
    expect(groupChip(occ({ status: 'override', date: '2026-11-21', startTime: '12:00', originalDate: '2026-11-21', originalStartTime: '11:00' })).text).toBe('Mutată de la 11:00');
    expect(groupChip(occ({ status: 'override', date: '2026-11-22', startTime: '12:00', originalDate: '2026-11-21', originalStartTime: '11:00' })).text).toBe('Mutată de la 21 noiembrie');
    expect(groupChip(occ({ status: 'cancelled', cancelReason: 'blackout', note: 'Vacanța de iarnă' }))).toMatchObject({ cat: 'liber', text: 'Vacanța de iarnă', struck: true });
    expect(groupChip(occ({ type: 'curs' })).cat).toBe('antrenament');
  });

  it('a break opens read-only; a moved date is addressed by its series date', () => {
    expect(isBreak(occ({ status: 'cancelled', cancelReason: 'blackout' }))).toBe(true);
    expect(dateKey(occ({ status: 'override', date: '2026-11-22', originalDate: '2026-11-21' }))).toBe('2026-11-21');
    expect(dateKey(occ({}))).toBe('2026-11-14');
  });
});

describe('titles', () => {
  it('week ranges and the panel title', () => {
    expect(weekTitle(new Date(2026, 10, 9))).toBe('9 - 15 noiembrie');
    expect(weekTitle(new Date(2026, 9, 26))).toBe('26 oct - 1 noiembrie');
    expect(panelTitle('2026-11-14', '11:00')).toBe('Sâmbătă, 14 noiembrie, 11:00');
  });

  it('durations 15 to 240 by 5', () => {
    const options = durationOptions();
    expect([options[0], options[options.length - 1], options.length]).toEqual([{ value: '15', label: '15 min' }, { value: '240', label: '240 min' }, 46]);
  });
});

describe('"Program nou" and "Schimbă programul" (W10, decided 5)', () => {
  it('starts as a weekly series of 50 min from today', () => {
    expect(newProgramForm('2026-11-20')).toMatchObject({ repeat: true, freq: 'weekly', days: [], durationMin: 50, from: '2026-11-20', date: '2026-11-20' });
  });

  it('needs a day; builds the series or one-class body', () => {
    const f = { ...newProgramForm('2026-11-20'), days: ['sun', 'sat'] as ('sun' | 'sat')[], startTime: '11:00' };
    expect(programFormError({ ...f, days: [] })).toBe('Alege cel puțin o zi.');
    expect(programFormError(f)).toBeNull();
    expect(programBody(f)).toEqual({ repeat: true, freq: 'weekly', weekOfMonth: null, days: ['sat', 'sun'], startTime: '11:00', durationMin: 50, from: '2026-11-20' });
    expect(programBody({ ...f, repeat: false, note: ' x ' })).toEqual({ repeat: false, date: '2026-11-20', startTime: '11:00', durationMin: 50, note: 'x' });
  });

  it('"Schimbă" keeps the series and starts on its next date', () => {
    const row: ProgramRow = { eventId: 'e1', freq: 'monthly', days: ['sat'], weekOfMonth: 'last', startTime: '11:00', durationMin: 50, from: '2026-10-04', to: '2027-05-31', text: '', fromText: '', nextDate: '2026-11-28' };
    const f = formFromRow(row, '2026-11-20');
    expect(f).toMatchObject({ freq: 'monthly', weekOfMonth: 'last', days: ['sat'], from: '2026-11-28' });
    expect(changeBody(f)).toEqual({ freq: 'monthly', weekOfMonth: 'last', days: ['sat'], startTime: '11:00', durationMin: 50, from: '2026-11-28' });
    expect(formFromRow({ ...row, nextDate: null }, '2026-11-20').from).toBe('2026-11-20');
  });
});

describe('the date panel (6.3, decided 4)', () => {
  it('opens on the date\'s current state, the e-mail box unticked', () => {
    expect(dateFormOf(occ({}))).toMatchObject({ mode: 'keep', notify: false });
    expect(dateFormOf(occ({ status: 'cancelled', cancelReason: 'exception', note: 'x' }))).toMatchObject({ mode: 'cancel', reason: 'x', notify: false });
    expect(dateFormOf(occ({ status: 'override', date: '2026-11-22', startTime: '12:00', originalDate: '2026-11-21' }))).toMatchObject({ mode: 'move', newDate: '2026-11-22', newStartTime: '12:00' });
  });

  it('sends the e-mail box only for Anulează and Mută; toasts per mode', () => {
    const f = { mode: 'keep' as const, newDate: '', newStartTime: '', reason: 'x', notify: true };
    expect(dateBody(f)).toEqual({ mode: 'keep', newDate: null, newStartTime: null, reason: null, notifyParents: false });
    expect(dateBody({ ...f, mode: 'cancel' })).toEqual({ mode: 'cancel', newDate: null, newStartTime: null, reason: 'x', notifyParents: true });
    expect([dateToast('cancel', '2026-11-14'), dateToast('move', '2026-11-21'), dateToast('keep', '2026-11-14')]).toEqual([
      'Ședința din 14 noiembrie a fost anulată.', 'Ședința din 21 noiembrie a fost mutată.', 'Ședința din 14 noiembrie se ține.',
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/grupe/__tests__/program-view.test.ts`
Expected: FAIL (`Cannot find module '../program-view'`).

- [ ] **Step 3: Write `program-view.ts`**

```ts
import type { Occurrence } from '../../api/calendar-event/services/expand';
import { DURATION, FREQ_LABELS, GRUPE_COPY, SCHEDULE_ERRORS, SCHEDULE_TOASTS, WEEK_OF_MONTH_LABELS, durationLabel } from '../groups/copy';
import { MONTHS_LONG, MONTHS_SHORT, capitalized, dayMonth, weekdayName } from '../groups/dates';
import type { ProgramRow } from '../groups/program-read';
import { DAY_ORDER, DAY_SHORT } from '../groups/program-text';
import type { DayKey, WeekOfMonth } from '../groups/types';

/** The group Program tab (spec 6.3). Pure: the admin bundle and the tests import it. */
export type ChipView = { cat: 'scoala' | 'antrenament' | 'anulat' | 'liber'; time: string; text: string; struck: boolean; title: string };
/** What the chips and the panel read of an occurrence: the API's `Occurrence` and the calendar components' one both fit. */
export type ChipSource = Pick<Occurrence, 'type' | 'status' | 'cancelReason' | 'startTime' | 'date'> & { note?: string | null; originalDate?: string | null; originalStartTime?: string | null };
export type Freq = keyof typeof FREQ_LABELS;
export type ProgramForm = { repeat: boolean; freq: Freq; weekOfMonth: WeekOfMonth; days: DayKey[]; startTime: string; durationMin: number; from: string; date: string; note: string };
export type DateMode = 'keep' | 'cancel' | 'move';
export type DateForm = { mode: DateMode; newDate: string; newStartTime: string; reason: string; notify: boolean };

export const isBreak = (o: ChipSource): boolean => o.status === 'cancelled' && o.cancelReason === 'blackout';
/** The server addresses a moved date by the series date it came from. */
export const dateKey = (o: ChipSource): string => o.originalDate ?? o.date;

function chipText(o: ChipSource): string {
  if (isBreak(o)) return o.note ?? '';
  if (o.status === 'cancelled') return o.note ? `${GRUPE_COPY.cancelled}: ${o.note}` : GRUPE_COPY.cancelled;
  if (o.status !== 'override') return '';
  const sameDay = !o.originalDate || o.originalDate === o.date;
  return GRUPE_COPY.movedFrom(sameDay ? o.originalStartTime ?? '' : dayMonth(o.originalDate as string));
}

export function groupChip(o: ChipSource): ChipView {
  const base = o.type === 'scoala' ? 'scoala' : 'antrenament';
  const cat = isBreak(o) ? 'liber' : o.status === 'cancelled' ? 'anulat' : base;
  const text = chipText(o);
  const time = o.startTime ?? '';
  return { cat, time, text, struck: o.status === 'cancelled', title: [time, text].filter(Boolean).join(' ') };
}

/** "9 - 15 noiembrie", "26 oct - 1 noiembrie" (mockup grupa-a A4). */
export function weekTitle(monday: Date): string {
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const first = monday.getMonth() === sunday.getMonth() ? `${monday.getDate()}` : `${monday.getDate()} ${MONTHS_SHORT[monday.getMonth()]}`;
  return `${first} - ${sunday.getDate()} ${MONTHS_LONG[sunday.getMonth()]}`;
}

/** "Sâmbătă, 14 noiembrie, 11:00" */
export const panelTitle = (date: string, time: string | null): string => [capitalized(weekdayName(date)), dayMonth(date), time].filter(Boolean).join(', ');

export function durationOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let m = DURATION.min; m <= DURATION.max; m += DURATION.step) out.push({ value: String(m), label: durationLabel(m) });
  return out;
}
export const freqOptions = (): { value: Freq; label: string }[] => (Object.keys(FREQ_LABELS) as Freq[]).map((value) => ({ value, label: FREQ_LABELS[value] }));
export const weekOfMonthOptions = (): { value: WeekOfMonth; label: string }[] =>
  (Object.keys(WEEK_OF_MONTH_LABELS) as WeekOfMonth[]).map((value) => ({ value, label: WEEK_OF_MONTH_LABELS[value] }));
export const DAY_TOGGLES: readonly { key: DayKey; label: string }[] = DAY_ORDER.map((key) => ({ key, label: DAY_SHORT[key] }));

export const newProgramForm = (today: string): ProgramForm => ({
  repeat: true, freq: 'weekly', weekOfMonth: 'first', days: [], startTime: '', durationMin: DURATION.initial, from: today, date: today, note: '',
});

/** Decided 5: the series as it is, from its next class date (today without one). */
export const formFromRow = (row: ProgramRow, today: string): ProgramForm => ({
  ...newProgramForm(today), freq: row.freq, weekOfMonth: row.weekOfMonth ?? 'first', days: [...row.days], startTime: row.startTime, durationMin: row.durationMin, from: row.nextDate ?? today,
});

export const programFormError = (f: ProgramForm): string | null => (f.repeat && f.days.length === 0 ? SCHEDULE_ERRORS.noDays : null);
const ordered = (days: DayKey[]): DayKey[] => DAY_ORDER.filter((d) => days.includes(d));

export const changeBody = (f: ProgramForm) => ({
  freq: f.freq, weekOfMonth: f.freq === 'monthly' ? f.weekOfMonth : null, days: ordered(f.days), startTime: f.startTime, durationMin: f.durationMin, from: f.from,
});

export function programBody(f: ProgramForm): Record<string, unknown> {
  if (f.repeat) return { repeat: true, ...changeBody(f) };
  return { repeat: false, date: f.date, startTime: f.startTime, durationMin: f.durationMin, note: f.note.trim() || null };
}

export const programToast = (answer: { date: string | null }): string => (answer.date ? SCHEDULE_TOASTS.classAdded(answer.date) : SCHEDULE_TOASTS.programAdded);

/** Decided 4: the panel opens on the date's state; the e-mail box is always unticked (W7). */
export function dateFormOf(o: ChipSource): DateForm {
  const blank: DateForm = { mode: 'keep', newDate: o.date, newStartTime: o.startTime ?? '', reason: '', notify: false };
  if (o.status === 'override') return { ...blank, mode: 'move', reason: o.note ?? '' };
  if (o.status === 'cancelled' && !isBreak(o)) return { ...blank, mode: 'cancel', reason: o.note ?? '' };
  return blank;
}

export function dateBody(f: DateForm): Record<string, unknown> {
  const move = f.mode === 'move';
  const changes = f.mode !== 'keep';
  return { mode: f.mode, newDate: move ? f.newDate : null, newStartTime: move ? f.newStartTime : null, reason: changes ? f.reason.trim() || null : null, notifyParents: changes && f.notify };
}

export function dateToast(mode: DateMode, date: string): string {
  if (mode === 'cancel') return SCHEDULE_TOASTS.dateCancelled(date);
  return mode === 'move' ? SCHEDULE_TOASTS.dateMoved(date) : SCHEDULE_TOASTS.dateKept(date);
}
```

- [ ] **Step 4: Run the tests and checks**

Run: `npx vitest run src/club/grupe/__tests__/program-view.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/grupe/program-view.ts src/club/grupe/__tests__/program-view.test.ts
git commit -m "feat(grupe): program view rules for chips, panels and the program forms"
```

---
### Task 3: Menu, page route, api, toasts, the list page and the group window

**Files:**
- Modify: `src/admin/dashboard/menu.tsx` ("Grupe" above "Sportivi")
- Modify: `scripts/admin-ui-check.mjs` (`dashboard/grupe` in `RULED_DIRS`)
- Create: `src/admin/dashboard/GrupePage.tsx`, `src/admin/dashboard/grupe/api.ts`, `undo.ts`, `styles.ts`, `PanelShell.tsx`, `GrupeList.tsx`, `GroupDialog.tsx`
- Test: `src/club/grupe/__tests__/admin-grupe.test.ts` (source reading)

**Interfaces:**
- Consumes: Task 1 views and copy; plan 4-1 routes and `api-types.ts`; plan 4-2 `GroupProgram`, `Occurrence`; `requestErrorText` (`src/club/registration-panel.ts`); `searchUrl` (`src/club/sportivi/search-view.ts`); `SPORTIVI_CSS`; the admin UI.
- Produces:
  - `useGrupeApi(): GrupeApi` with `list, unassigned, options, page, history, create, update, remove, join, allocate, move, removeMember, undo, program, occurrences, addProgram, changeProgram, endProgram, deleteClass, setDate, searchAthletes` (write calls answer `ActionBody<T>` = `{ data, undo }`).
  - `undoToast(text, actionId, api)`, `failToast(err)`, `grupeChanged()`, `useGrupeRefresh(reload)` (every open Grupe screen reloads after an action or an undo, even when the toast outlives the screen that started it), `UNDO_MS = 8000`.
  - `WindowShell({ title, footer, onClose, size?, children })` (Modal; full-height sheet on phones), `PanelShell({ title, footer, onClose, children })` (Drawer; full-height sheet on phones).
  - `GrupeList` (route `/plugins/edusport-grupe`), `GroupDialog({ mode, sectionSlug, sectionId, season, group, onClose, onSaved })`, `GRUPE_CSS`.

- [ ] **Step 1: Write the failing source test**

`src/club/grupe/__tests__/admin-grupe.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const SRC = join(__dirname, '..', '..', '..');
const source = (p: string) => readFileSync(join(SRC, p), 'utf8');
const grupe = (f: string) => source(`admin/dashboard/grupe/${f}`);

describe('menu and route (5.1)', () => {
  it('puts "Grupe" above "Sportivi" in Club și școală, on its own plugin route', () => {
    const menu = source('admin/dashboard/menu.tsx');
    expect(menu.indexOf("label: 'Grupe'")).toBeGreaterThan(-1);
    expect(menu.indexOf("label: 'Grupe'")).toBeLessThan(menu.indexOf("label: 'Sportivi'"));
    expect(menu).toContain("import('./GrupePage')");
    expect(source('admin/dashboard/GrupePage.tsx')).toContain('groupIdFromSplat');
  });
});

describe('list page (5.2)', () => {
  const list = grupe('GrupeList.tsx');

  it('has the season select, the section tabs, the count line and the four columns', () => {
    for (const s of ['seasonOptions', 'tabItems', 'countLine', 'GRUPE_COPY.colGroup', 'GRUPE_COPY.colProgram', 'GRUPE_COPY.colCoaches', 'GRUPE_COPY.colMembers']) expect(list, s).toContain(s);
    expect(list).toContain('GRUPE_COPY.noProgram');
    expect(list).toContain('GRUPE_COPY.noCoach');
  });

  it('writes only on a season that is not past (W5) and shows cards on phones', () => {
    expect(list).toContain('writable(page)');
    expect(list).toContain('phoneSummary');
  });
});

describe('group window (5.4, W11)', () => {
  const dialog = grupe('GroupDialog.tsx');

  it('has Nume, Listă de prețuri (optional), Antrenori, Program public with its hint', () => {
    for (const s of ['GRUPE_COPY.fieldName', 'GRUPE_COPY.fieldPriceList', 'GRUPE_COPY.optional', 'GRUPE_COPY.fieldCoaches', 'GRUPE_COPY.fieldPublic', 'GRUPE_COPY.publicHint', 'GRUPE_COPY.create', 'GRUPE_COPY.save']) expect(dialog, s).toContain(s);
  });

  it('toasts "Grupă creată", "Salvat." or "Nicio modificare." and opens the new group on Program', () => {
    for (const s of ['GROUP_TOASTS.created', 'GROUP_TOASTS.saved', 'GROUP_TOASTS.unchanged']) expect(dialog, s).toContain(s);
    expect(grupe('GrupeList.tsx')).toContain("'program')");
  });
});

describe('toasts with "Anulează" (8.1)', () => {
  const undo = grupe('undo.ts');

  it('holds 8 seconds, runs plain async, reloads every open Grupe screen', () => {
    expect(undo).toContain('UNDO_MS = 8000');
    expect(undo).toContain('GROUP_TOASTS.undo');
    expect(undo).toContain('GROUP_TOASTS.undone');
    expect(undo).toContain('grupeChanged()');
  });
});

describe('design rules', () => {
  it('no dashed or dotted lines, no full radius, no backtick in the CSS', () => {
    const css = grupe('styles.ts');
    expect(css).not.toMatch(/dashed|dotted|9999px|50%/);
    expect(css.split('`').length).toBe(3);
  });

  it('the grupe folder is held to the colour rule', () => {
    expect(source('../scripts/admin-ui-check.mjs')).toContain("join(ADMIN, 'dashboard', 'grupe')");
    expect(existsSync(join(SRC, 'admin/dashboard/grupe/PanelShell.tsx'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/grupe/__tests__/admin-grupe.test.ts`
Expected: FAIL (`ENOENT ... GrupeList.tsx`, no "Grupe" menu label).

- [ ] **Step 3: Menu, route, colour rule**

`src/admin/dashboard/menu.tsx`:

```ts
import { GRUPE_PATH } from '../../club/grupe/routes';
```

```ts
// Grupe: the group list, and under /<documentId> the group page (phase 4).
export const GRUPE_TO = GRUPE_PATH;
```

In `EDUSPORT_LINKS`, replace the "Club și școală" block with:

```ts
  // Club și școală (Prezență joins in phase 5)
  { to: GRUPE_TO, label: 'Grupe', icon: GridFour, group: 'club', featured: true },
  { to: SPORTIVI_TO, label: 'Sportivi', icon: User, group: 'club', featured: true },
```

Before the Sportivi `app.addMenuLink`, add:

```ts
  app.addMenuLink({
    to: GRUPE_TO,
    icon: GridFour,
    intlLabel: { id: 'edusport.menu.grupe', defaultMessage: 'Grupe' },
    Component: () => import('./GrupePage'),
    permissions: [],
    position: 6,
  });
```

`scripts/admin-ui-check.mjs`, extend `RULED_DIRS`:

```js
const RULED_DIRS = [UI_DIR, join(ADMIN, 'pages') + sep, join(ADMIN, 'lib') + sep, join(ADMIN, 'dashboard', 'sportivi') + sep, join(ADMIN, 'dashboard', 'inscrieri') + sep, join(ADMIN, 'dashboard', 'grupe') + sep];
```

`src/admin/dashboard/GrupePage.tsx`:

```tsx
import * as React from 'react';
import { useParams } from 'react-router-dom';
import { groupIdFromSplat } from '../../club/grupe/routes';
import { GroupPage } from './grupe/GroupPage';
import { GrupeList } from './grupe/GrupeList';

/** "Grupe" (spec 5) and, under /plugins/edusport-grupe/<documentId>, the group page (spec 6). */
export default function GrupePage() {
  const id = groupIdFromSplat(useParams()['*']);
  return id ? <GroupPage key={id} documentId={id} /> : <GrupeList />;
}
```

Task 5 creates `GroupPage.tsx`; until then make this task's commit compile by creating `src/admin/dashboard/grupe/GroupPage.tsx` with the final export signature and the loading state only:

```tsx
import * as React from 'react';
import { AdminPage, Loading } from '../../ui';

export function GroupPage(_props: { documentId: string }) {
  return (
    <AdminPage>
      <Loading />
    </AdminPage>
  );
}
```

Task 5 replaces the whole file.

- [ ] **Step 4: Api, toasts, shells, CSS**

`src/admin/dashboard/grupe/api.ts`:

```ts
import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { Occurrence } from '../../../api/calendar-event/services/expand';
import type { AthleteCard, HistoryLine } from '../../../club/athletes/api-types';
import type {
  ActionBody, AllocateResult, GroupListPage, GroupOptions, GroupPage, JoinResult, MoveResult, NamedRef, UnassignedPage,
} from '../../../club/groups/api-types';
import type { GroupProgram } from '../../../club/groups/program-read';
import { searchUrl } from '../../../club/sportivi/search-view';

const BASE = '/api/club';
const enc = encodeURIComponent;
type Body = Record<string, unknown>;
type Wrapped<T> = { data: { data: T } };
export type DateAnswer = { mode: 'keep' | 'cancel' | 'move'; date: string; emails: number };

function query(values: Record<string, string | null>): string {
  const s = new URLSearchParams(Object.entries(values).filter((e): e is [string, string] => !!e[1])).toString();
  return s ? `?${s}` : '';
}

/** The plan 4-1 / 4-2 admin routes. Same identity on every render (the fetch client's is not). */
export function useGrupeApi() {
  const client = useFetchClient();
  const ref = React.useRef(client);
  ref.current = client;
  return React.useMemo(() => {
    const data = async <T>(p: Promise<unknown>): Promise<T> => ((await p) as Wrapped<T>).data.data;
    const action = async <T>(p: Promise<unknown>): Promise<ActionBody<T>> => ((await p) as { data: ActionBody<T> }).data;
    const get = <T>(url: string) => data<T>(ref.current.get(url));
    const g = (id: string) => `${BASE}/groups/${enc(id)}`;
    const p = (id: string) => `${BASE}/program/${enc(id)}`;
    return {
      list: (season: string | null, section: string | null) => get<GroupListPage>(`${BASE}/groups${query({ season, section })}`),
      unassigned: (season: string | null) => get<UnassignedPage>(`${BASE}/groups/unassigned${query({ season })}`),
      options: () => get<GroupOptions>(`${BASE}/groups/options`),
      page: (id: string, season: string | null) => get<GroupPage>(`${g(id)}${query({ season })}`),
      history: (id: string) => get<HistoryLine[]>(`${g(id)}/history`),
      create: (body: Body) => data<NamedRef>(ref.current.post(`${BASE}/groups`, body)),
      update: (id: string, body: Body) => data<{ changed: boolean }>(ref.current.put(g(id), body)),
      remove: (id: string) => data<{ name: string }>(ref.current.del(g(id))),
      join: (id: string, body: Body) => action<JoinResult>(ref.current.post(`${g(id)}/members`, body)),
      allocate: (body: Body) => action<AllocateResult>(ref.current.post(`${BASE}/memberships/allocate`, body)),
      move: (membershipId: string, toGroupId: string) => action<MoveResult>(ref.current.post(`${BASE}/memberships/${enc(membershipId)}/move`, { toGroupId })),
      removeMember: (membershipId: string) => action<MoveResult>(ref.current.del(`${BASE}/memberships/${enc(membershipId)}`)),
      undo: (actionId: string) => data<{ undone: true }>(ref.current.post(`${BASE}/undo`, { actionId })),
      program: (id: string, season: string | null) => get<GroupProgram>(`${g(id)}/program${query({ season })}`),
      occurrences: (id: string, from: string, to: string) => get<Occurrence[]>(`${BASE}/calendar/occurrences${query({ from, to, group: id })}`),
      addProgram: (id: string, body: Body) => action<{ eventId: string; date: string | null }>(ref.current.post(`${g(id)}/program`, body)),
      changeProgram: (eventId: string, body: Body) => action<{ eventId: string }>(ref.current.put(p(eventId), body)),
      endProgram: (eventId: string, from: string) => action<{ eventId: string }>(ref.current.post(`${p(eventId)}/end`, { from })),
      deleteClass: (eventId: string) => action<{ date: string }>(ref.current.del(p(eventId))),
      setDate: (eventId: string, date: string, body: Body) => action<DateAnswer>(ref.current.put(`${p(eventId)}/dates/${enc(date)}`, body)),
      searchAthletes: (q: string) => get<AthleteCard[]>(searchUrl(q)),
    };
  }, []);
}

export type GrupeApi = ReturnType<typeof useGrupeApi>;
```

The admin occurrences route answers `{ data, blackouts }` (not wrapped twice): `occurrences` reads `.data.data` of the fetch response, which is the `data` array. If the fetch client returns the body at `.data`, this is right; check one call in the browser during Task 7 and adjust only this line if not.

`src/admin/dashboard/grupe/undo.ts`:

```ts
import * as React from 'react';
import { adminToast } from '../../ui';
import { GROUP_ERRORS, GROUP_TOASTS } from '../../../club/groups/copy';
import { requestErrorText } from '../../../club/registration-panel';
import type { GrupeApi } from './api';

/** The toast's "Anulează" (spec 8.1, W15): 8 seconds, no X; plain async, so it outlives the screen that started it. */
export const UNDO_MS = 8000;
const listeners = new Set<() => void>();

/** Every open Grupe screen reloads (list, group page, Program tab). */
export function grupeChanged(): void {
  listeners.forEach((fn) => fn());
}

export function useGrupeRefresh(reload: () => void): void {
  const ref = React.useRef(reload);
  ref.current = reload;
  React.useEffect(() => {
    const fn = () => ref.current();
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
}

export const failToast = (err: unknown): void => {
  adminToast.error(requestErrorText(err, GROUP_ERRORS.failed));
};

async function runUndo(api: GrupeApi, actionId: string): Promise<void> {
  try {
    await api.undo(actionId);
    adminToast.success(GROUP_TOASTS.undone);
  } catch (err) {
    failToast(err);
  } finally {
    grupeChanged();
  }
}

/** The action's toast; with an action id it carries "Anulează" for 8 seconds. Every open screen reloads at once. */
export function undoToast(text: string, actionId: string | null, api: GrupeApi): void {
  grupeChanged();
  if (!actionId) {
    adminToast.success(text);
    return;
  }
  adminToast.success(text, { duration: UNDO_MS, action: { label: GROUP_TOASTS.undo, onClick: () => void runUndo(api, actionId) } });
}
```

`src/admin/dashboard/grupe/PanelShell.tsx`:

```tsx
import * as React from 'react';
import { BottomSheet, Drawer, Modal, useIsPhone } from '../../ui';

type ShellProps = { title: React.ReactNode; footer?: React.ReactNode; onClose: () => void; children: React.ReactNode };

/** A window (Modal) on desktop, a full-height bottom sheet on phones (decided 6). */
export function WindowShell({ title, footer, onClose, children, size = 'md' }: ShellProps & { size?: 'sm' | 'md' | 'lg' }) {
  const phone = useIsPhone();
  if (phone) return <BottomSheet open fullHeight title={title} onClose={onClose} footer={footer}>{children}</BottomSheet>;
  return <Modal open size={size} title={title} onClose={onClose} footer={footer}>{children}</Modal>;
}

/** A side panel (Drawer) on desktop, a full-height bottom sheet on phones (6.3). */
export function PanelShell({ title, footer, onClose, children }: ShellProps) {
  const phone = useIsPhone();
  if (phone) return <BottomSheet open fullHeight title={title} onClose={onClose} footer={footer}>{children}</BottomSheet>;
  return <Drawer open title={title} onClose={onClose} footer={footer}>{children}</Drawer>;
}
```

`src/admin/dashboard/grupe/styles.ts`:

```ts
/**
 * CSS of Grupe and the group page (phase 4). Tokens only; no backtick inside the string; no dashed or dotted lines; no pills
 * or circles (the count badge and the day toggles are square). The Sportivi CSS (SPORTIVI_CSS) is loaded alongside it.
 */
export const GRUPE_CSS = `
.ui-root .grp-head-acts{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.ui-root .grp-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:18px;padding:0 5px;margin-left:6px;font-size:11px;font-weight:700;border-radius:var(--ui-radius-sm);background:var(--theme-cat-eveniment);color:var(--theme-cat-eveniment-fg)}
.ui-root .grp-tabs{padding:0 18px}
.ui-root .grp-lines div+div{margin-top:2px}
.ui-root .grp-form{display:flex;flex-direction:column;gap:14px}
.ui-root .grp-ua{display:flex;flex-direction:column}
.ui-root .grp-ua-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(170px,230px) auto;gap:8px 10px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--theme-border)}
.ui-root .grp-ua-row:last-child{border-bottom:none}
.ui-root .grp-ua-src{display:block;font-size:12px;color:var(--theme-text-muted)}
.ui-root .grp-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;font-size:13px;color:var(--theme-text-secondary)}
.ui-root .grp-kv{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:8px 14px;align-items:center;margin:0 0 14px}
.ui-root .grp-kv dt{font-size:12px;font-weight:700;color:var(--theme-text-secondary)}
.ui-root .grp-kv dd{margin:0;min-width:0}
.ui-root .grp-pick{display:flex;flex-direction:column;gap:2px;max-height:320px;overflow:auto}
.ui-root .grp-pick label{display:flex;align-items:center;gap:8px;padding:6px 2px}
.ui-root .grp-usual{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
.ui-root .grp-usual-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}
.ui-root .grp-days{display:flex;flex-wrap:wrap;gap:6px}
.ui-root .grp-day{min-width:40px;height:34px;padding:0 8px;font:inherit;font-weight:600;color:var(--theme-text);background:var(--theme-surface);border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);cursor:pointer}
.ui-root .grp-day[aria-pressed=true]{color:var(--theme-on-primary);background:var(--theme-primary);border-color:var(--theme-primary)}
.ui-root .grp-day:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
.ui-root .grp-danger-link{font:inherit;font-size:13px;font-weight:600;color:var(--theme-danger);background:none;border:none;padding:0;cursor:pointer;align-self:flex-start}
.ui-root .grp-cal-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:8px 0}
.ui-root .grp-cal-bar .cal-sp{flex:1}
@media (max-width:640px){
.ui-root .grp-ua-row{grid-template-columns:minmax(0,1fr) auto}
.ui-root .grp-ua-row .ui-combo{grid-column:1 / -1;grid-row:2}
.ui-root .grp-kv{grid-template-columns:minmax(0,1fr)}
}
`;
```

- [ ] **Step 5: The list page**

`src/admin/dashboard/grupe/GrupeList.tsx`:

```tsx
import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminPage, Button, DataTable, Loading, Notice, PageHeader, Select, Tabs, Window, useIsPhone, type DataColumn } from '../../ui';
import { IconPlus } from '../../ui/icons';
import type { GroupListPage, GroupListRow } from '../../../club/groups/api-types';
import { GROUP_ERRORS, GRUPE_COPY } from '../../../club/groups/copy';
import { coachesText, countLine, phoneSummary, seasonOptions, tabItems, writable } from '../../../club/grupe/list-view';
import { groupPageTo, grupeListTo, readGrupeQuery } from '../../../club/grupe/routes';
import { SPORTIVI_CSS } from '../sportivi/styles';
import { useGrupeApi, type GrupeApi } from './api';
import { GroupDialog } from './GroupDialog';
import { GRUPE_CSS } from './styles';
import { useGrupeRefresh } from './undo';

type ListState = { page: GroupListPage | null; failed: boolean; reload: () => Promise<void> };
type Open = (row: GroupListRow) => void;

function useGroupList(api: GrupeApi, season: string | null, section: string | null): ListState {
  const [page, setPage] = React.useState<GroupListPage | null>(null);
  const [failed, setFailed] = React.useState(false);
  const reload = React.useCallback(async () => {
    try {
      setPage(await api.list(season, section));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [api, season, section]);
  React.useEffect(() => {
    void reload();
  }, [reload]);
  useGrupeRefresh(() => void reload());
  return { page, failed, reload };
}

const muted = (text: string) => <span className="spv-muted">{text}</span>;

const COLUMNS: DataColumn<GroupListRow>[] = [
  { key: 'name', header: GRUPE_COPY.colGroup, render: (r) => <span className="spv-name">{r.name}</span> },
  { key: 'program', header: GRUPE_COPY.colProgram, render: (r) => (r.program.length ? <div className="grp-lines">{r.program.map((l) => <div key={l}>{l}</div>)}</div> : muted(GRUPE_COPY.noProgram)) },
  { key: 'coaches', header: GRUPE_COPY.colCoaches, render: (r) => coachesText(r) ?? muted(GRUPE_COPY.noCoach) },
  { key: 'members', header: GRUPE_COPY.colMembers, align: 'right', render: (r) => r.members },
];

function GroupCards({ page, onOpen }: { page: GroupListPage; onOpen: Open }) {
  if (!page.rows.length) return <p className="spv-count">{GRUPE_COPY.noGroups}</p>;
  return (
    <ul className="spv-cards">
      {page.rows.map((r) => (
        <li key={r.documentId}>
          <button type="button" className="spv-card" onClick={() => onOpen(r)}>
            <span className="spv-name">{r.name}</span>
            <span>{phoneSummary(r)}</span>
            {coachesText(r) ?? muted(GRUPE_COPY.noCoach)}
          </button>
        </li>
      ))}
    </ul>
  );
}

type BodyProps = { page: GroupListPage; phone: boolean; onSeason: (v: string) => void; onTab: (slug: string) => void; onOpen: Open };

function ListBody({ page, phone, onSeason, onTab, onOpen }: BodyProps) {
  return (
    <>
      <div className="spv-toolbar">
        <Select className="spv-season" aria-label={GRUPE_COPY.seasonLabel} value={page.season?.label ?? ''} options={seasonOptions(page)} onChange={onSeason} />
      </div>
      <Tabs items={tabItems(page)} value={page.section ?? ''} onChange={onTab} label={GRUPE_COPY.tabsLabel} className="grp-tabs" />
      <p className="spv-count">{countLine(page)}</p>
      {phone ? (
        <GroupCards page={page} onOpen={onOpen} />
      ) : (
        <div className="ui-body">
          <DataTable<GroupListRow> columns={COLUMNS} rows={page.rows} getRowKey={(r) => r.documentId} onRowClick={onOpen} rowLabel={(r) => r.name} pageSize={0} empty={GRUPE_COPY.noGroups} />
        </div>
      )}
    </>
  );
}

/** "Fără grupă" joins these actions in Task 4. A past season writes nothing (W5). */
function HeaderActions({ page, onNew }: { page: GroupListPage; onNew: () => void }) {
  if (!writable(page)) return null;
  return (
    <div className="grp-head-acts">
      <Button size="sm" icon={<IconPlus />} onClick={onNew}>{GRUPE_COPY.newGroup}</Button>
    </div>
  );
}

export function GrupeList() {
  const api = useGrupeApi();
  const phone = useIsPhone();
  const navigate = useNavigate();
  const query = readGrupeQuery(useLocation().search);
  const { page, failed } = useGroupList(api, query.season, query.section);
  const [creating, setCreating] = React.useState(false);
  const season = page?.season?.label ?? null;
  const go = (s: string | null, sec: string | null) => navigate(grupeListTo(s, sec), { replace: true });
  const open = (r: GroupListRow) => navigate(groupPageTo(r.documentId, season));
  const body = page ? <ListBody page={page} phone={phone} onSeason={(v) => go(v, page.section)} onTab={(t) => go(season, t)} onOpen={open} /> : null;
  const tab = page?.tabs.find((t) => t.slug === page.section) ?? null;
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS + GRUPE_CSS}</style>
      <Window>
        <PageHeader title={GRUPE_COPY.title} actions={page ? <HeaderActions page={page} onNew={() => setCreating(true)} /> : null} />
        {body ?? (failed ? <div className="ui-body"><Notice tone="danger">{GROUP_ERRORS.loadFailed}</Notice></div> : <Loading />)}
      </Window>
      {creating && tab && (
        <GroupDialog mode="new" sectionSlug={tab.slug} sectionId={tab.documentId} group={null} onClose={() => setCreating(false)} onSaved={(id) => navigate(groupPageTo(id, season, 'program'))} />
      )}
    </AdminPage>
  );
}
```

- [ ] **Step 6: The group window**

`src/admin/dashboard/grupe/GroupDialog.tsx`:

```tsx
import * as React from 'react';
import { Button, Field, Input, Notice, RelationMultiSelect, SearchableSelect, Switch, adminToast } from '../../ui';
import type { GroupOptions, GroupPage } from '../../../club/groups/api-types';
import { GROUP_ERRORS, GROUP_TOASTS, GRUPE_COPY } from '../../../club/groups/copy';
import { requestErrorText } from '../../../club/registration-panel';
import { useGrupeApi, type GrupeApi } from './api';
import { WindowShell } from './PanelShell';
import { grupeChanged } from './undo';

type Props = {
  mode: 'new' | 'edit'; sectionSlug: string; sectionId: string; group: GroupPage | null;
  onClose: () => void; onSaved: (documentId: string) => void;
};
type Draft = { name: string; priceListId: string | null; coachIds: string[]; programPublic: boolean };

const draftOf = (g: GroupPage | null): Draft => ({
  name: g?.name ?? '', priceListId: g?.priceList?.documentId ?? null, coachIds: g?.coaches.map((c) => c.documentId) ?? [], programPublic: g?.programPublic ?? true,
});

function useOptions(api: GrupeApi): GroupOptions | null {
  const [options, setOptions] = React.useState<GroupOptions | null>(null);
  React.useEffect(() => {
    api.options().then(setOptions).catch(() => setOptions({ groups: [], coaches: [], priceLists: [] }));
  }, [api]);
  return options;
}

function Fields({ draft, set, options, sectionId }: { draft: Draft; set: (d: Draft) => void; options: GroupOptions | null; sectionId: string }) {
  const lists = (options?.priceLists ?? []).filter((p) => p.sectionId === sectionId).map((p) => ({ value: p.documentId, label: p.name }));
  const coaches = (options?.coaches ?? []).map((c) => ({ documentId: c.documentId, label: c.name }));
  return (
    <div className="grp-form">
      <Field label={GRUPE_COPY.fieldName} required>
        <Input value={draft.name} maxLength={80} onChange={(e) => set({ ...draft, name: e.target.value })} />
      </Field>
      <Field label={GRUPE_COPY.fieldPriceList} hint={GRUPE_COPY.optional}>
        <SearchableSelect value={draft.priceListId} options={lists} clearable onChange={(v) => set({ ...draft, priceListId: v })} />
      </Field>
      <Field label={GRUPE_COPY.fieldCoaches}>
        <RelationMultiSelect value={draft.coachIds} options={coaches} onChange={(ids) => set({ ...draft, coachIds: ids })} />
      </Field>
      <Switch checked={draft.programPublic} onChange={(v) => set({ ...draft, programPublic: v })} label={GRUPE_COPY.fieldPublic} description={GRUPE_COPY.publicHint} />
    </div>
  );
}

/** Saves and toasts; answers the group id to open. */
async function save(api: GrupeApi, props: Props, draft: Draft): Promise<string> {
  const body = { name: draft.name, priceListId: draft.priceListId, coachIds: draft.coachIds, programPublic: draft.programPublic };
  if (props.mode === 'new' || !props.group) {
    const created = await api.create({ ...body, section: props.sectionSlug });
    adminToast.success(GROUP_TOASTS.created(created.name));
    return created.documentId;
  }
  const res = await api.update(props.group.documentId, body);
  adminToast.success(res.changed ? GROUP_TOASTS.saved : GROUP_TOASTS.unchanged);
  return props.group.documentId;
}

/** "Grupă nouă" / "Editează grupa" (5.4, W11). */
export function GroupDialog(props: Props) {
  const api = useGrupeApi();
  const options = useOptions(api);
  const [draft, setDraft] = React.useState<Draft>(() => draftOf(props.group));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      props.onSaved(await save(api, props, draft));
      grupeChanged();
      props.onClose();
    } catch (err) {
      setError(requestErrorText(err, GROUP_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  const footer = (
    <>
      <Button variant="ghost" onClick={props.onClose} disabled={busy}>{GRUPE_COPY.cancel}</Button>
      <Button loading={busy} onClick={() => void submit()}>{props.mode === 'new' ? GRUPE_COPY.create : GRUPE_COPY.save}</Button>
    </>
  );
  return (
    <WindowShell title={props.mode === 'new' ? GRUPE_COPY.windowNew : GRUPE_COPY.windowEdit} onClose={props.onClose} footer={footer}>
      {error && <Notice tone="danger">{error}</Notice>}
      <Fields draft={draft} set={setDraft} options={options} sectionId={props.sectionId} />
    </WindowShell>
  );
}
```

- [ ] **Step 7: Run the tests and checks**

Run: `npx vitest run src/club/grupe && npx vitest run && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS; zero type errors in both projects; checker exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/admin/dashboard/menu.tsx src/admin/dashboard/GrupePage.tsx src/admin/dashboard/grupe scripts/admin-ui-check.mjs src/club/grupe/__tests__/admin-grupe.test.ts
git commit -m "feat(grupe): Grupe menu entry, list page with season and section tabs, group window"
```

---

### Task 4: "Fără grupă"

**Files:**
- Create: `src/admin/dashboard/grupe/UnassignedButton.tsx`
- Modify: `src/admin/dashboard/grupe/GrupeList.tsx` (`HeaderActions` shows it)
- Test: `src/club/grupe/__tests__/admin-grupe.test.ts` (one more `describe`)

**Interfaces:**
- Consumes: Task 1 (`groupOptions`, `initialPicks`, `allocateItems`), Task 3 (`GrupeApi`, `undoToast`, `failToast`, `useGrupeRefresh`), plan 4-1 (`UnassignedPage`, `GROUP_TOASTS.allocated`, `.allocatedAll`).
- Produces: `UnassignedButton({ api, season, count })`: hidden at 0 (5.3); the orange count; a dropdown under the button on desktop, a bottom sheet on phones, titled "<n> sportivi fără grupă"; per row the name, the source line, `SearchableSelect` "Alege grupa" with the proposal preselected, "Alocă"; footer "Alocă toți în grupele propuse".

- [ ] **Step 1: Add the failing source test**

Append to `src/club/grupe/__tests__/admin-grupe.test.ts`:

```ts
describe('"Fără grupă" (5.3)', () => {
  const button = grupe('UnassignedButton.tsx');

  it('is hidden at 0, shows the orange count, opens a dropdown or a sheet with the rows', () => {
    expect(button).toContain('count === 0');
    expect(button).toContain('grp-count');
    expect(button).toContain('desktop="dropdown"');
    expect(button).toContain('GRUPE_COPY.unassignedHeader');
  });

  it('preselects the proposal, allocates one or all, toasts with undo', () => {
    for (const s of ['initialPicks', 'GRUPE_COPY.pickGroup', 'GRUPE_COPY.allocate', 'GRUPE_COPY.allocateAll', 'allocateItems', "mode: 'allocate'", 'GROUP_TOASTS.allocated', 'GROUP_TOASTS.allocatedAll', 'undoToast']) {
      expect(button, s).toContain(s);
    }
  });

  it('keeps a button busy until the answer', () => {
    expect(button).toContain('loading=');
  });

  it('the list page shows it next to "Grupă nouă" on a writable season', () => {
    expect(grupe('GrupeList.tsx')).toContain('<UnassignedButton');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/grupe/__tests__/admin-grupe.test.ts`
Expected: FAIL (`ENOENT ... UnassignedButton.tsx`).

- [ ] **Step 3: Write `UnassignedButton.tsx`**

```tsx
import * as React from 'react';
import { BottomSheet, Button, Loading, Notice, SearchableSelect, useIsPhone } from '../../ui';
import type { UnassignedPage, UnassignedRow } from '../../../club/groups/api-types';
import { GROUP_ERRORS, GROUP_TOASTS, GRUPE_COPY } from '../../../club/groups/copy';
import { allocateItems, groupOptions, initialPicks, type Picks } from '../../../club/grupe/list-view';
import type { GrupeApi } from './api';
import { failToast, undoToast, useGrupeRefresh } from './undo';

type Props = { api: GrupeApi; season: string; count: number };
type Loaded = { page: UnassignedPage | null; failed: boolean; picks: Picks; setPicks: (p: Picks) => void; reload: () => Promise<void> };

function useUnassigned(api: GrupeApi, season: string): Loaded {
  const [page, setPage] = React.useState<UnassignedPage | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [picks, setPicks] = React.useState<Picks>({});
  const reload = React.useCallback(async () => {
    try {
      const next = await api.unassigned(season);
      setPage(next);
      setPicks((old) => ({ ...initialPicks(next.rows), ...old }));
    } catch {
      setFailed(true);
    }
  }, [api, season]);
  React.useEffect(() => {
    void reload();
  }, [reload]);
  useGrupeRefresh(() => void reload());
  return { page, failed, picks, setPicks, reload };
}

type RowProps = { row: UnassignedRow; data: Loaded; busy: boolean; onAllocate: (row: UnassignedRow) => void };

function Row({ row, data, busy, onAllocate }: RowProps) {
  const options = groupOptions(data.page?.groups ?? [], null);
  const pick = data.picks[row.athleteId] ?? null;
  return (
    <div className="grp-ua-row">
      <div>
        <span className="spv-name">{row.name}</span>
        <span className="grp-ua-src">{row.source}</span>
      </div>
      <SearchableSelect value={pick} options={options} placeholder={GRUPE_COPY.pickGroup} onChange={(v) => data.setPicks({ ...data.picks, [row.athleteId]: v })} />
      <Button size="sm" variant="secondary" loading={busy} disabled={!pick} onClick={() => onAllocate(row)}>{GRUPE_COPY.allocate}</Button>
    </div>
  );
}

function useAllocate(api: GrupeApi, season: string, data: Loaded) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    try {
      await work();
    } catch (err) {
      failToast(err);
    } finally {
      setBusy(null);
    }
  };
  const groupName = (id: string) => data.page?.groups.find((g) => g.documentId === id)?.name ?? '';
  const one = (row: UnassignedRow) => void run(row.athleteId, async () => {
    const groupId = data.picks[row.athleteId] as string;
    const res = await api.join(groupId, { season, athleteIds: [row.athleteId], mode: 'allocate' });
    undoToast(GROUP_TOASTS.allocated(groupName(groupId), row.name), res.undo?.actionId ?? null, api);
  });
  const all = () => void run('all', async () => {
    const res = await api.allocate({ season, items: allocateItems(data.page?.rows ?? [], data.picks) });
    undoToast(GROUP_TOASTS.allocatedAll(res.data.allocated), res.undo?.actionId ?? null, api);
  });
  return { busy, one, all };
}

type SheetProps = { api: GrupeApi; season: string; anchorRef: React.RefObject<HTMLButtonElement | null>; onClose: () => void };

function UnassignedSheet({ api, season, anchorRef, onClose }: SheetProps) {
  const phone = useIsPhone();
  const data = useUnassigned(api, season);
  const act = useAllocate(api, season, data);
  const rows = data.page?.rows ?? [];
  const footer = (
    <Button variant={phone ? 'secondary' : 'ghost'} loading={act.busy === 'all'} disabled={!allocateItems(rows, data.picks).length} onClick={act.all}>{GRUPE_COPY.allocateAll}</Button>
  );
  const body = data.failed ? <Notice tone="danger">{GROUP_ERRORS.loadFailed}</Notice> : !data.page ? <Loading /> : (
    <div className="grp-ua">{rows.map((r) => <Row key={r.athleteId} row={r} data={data} busy={act.busy === r.athleteId} onAllocate={act.one} />)}</div>
  );
  return (
    <BottomSheet open title={GRUPE_COPY.unassignedHeader(rows.length)} desktop="dropdown" anchorRef={anchorRef} dropdownWidth={600} onClose={onClose} footer={footer}>
      {body}
    </BottomSheet>
  );
}

/** "Fără grupă" with its orange count, next to "Grupă nouă"; it belongs to the whole club and disappears at 0 (5.3). */
export function UnassignedButton({ api, season, count }: Props) {
  const anchor = React.useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = React.useState(false);
  if (count === 0) return null;
  return (
    <>
      <Button ref={anchor} variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {GRUPE_COPY.unassigned}
        <span className="grp-count">{count}</span>
      </Button>
      {open && <UnassignedSheet api={api} season={season} anchorRef={anchor} onClose={() => setOpen(false)} />}
    </>
  );
}
```

- [ ] **Step 4: Show it on the list page**

In `GrupeList.tsx`, import `UnassignedButton` and give `HeaderActions` the api:

```tsx
function HeaderActions({ page, api, onNew }: { page: GroupListPage; api: GrupeApi; onNew: () => void }) {
  if (!writable(page) || !page.season) return null;
  return (
    <div className="grp-head-acts">
      <UnassignedButton api={api} season={page.season.label} count={page.unassigned} />
      <Button size="sm" icon={<IconPlus />} onClick={onNew}>{GRUPE_COPY.newGroup}</Button>
    </div>
  );
}
```

and pass `api={api}` where `GrupeList` renders `HeaderActions`. Remove the "joins these actions in Task 4" comment.

- [ ] **Step 5: Run the tests and checks**

Run: `npx vitest run src/club/grupe && npx vitest run && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS; zero type errors; checker exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/admin/dashboard/grupe/UnassignedButton.tsx src/admin/dashboard/grupe/GrupeList.tsx src/club/grupe/__tests__/admin-grupe.test.ts
git commit -m "feat(grupe): Fără grupă with the proposed group, Alocă and Alocă toți, toasts with undo"
```

---

### Task 5: The group page, the Sportivi tab and Istoric

**Files:**
- Create (replacing the Task 3 stub): `src/admin/dashboard/grupe/GroupPage.tsx`
- Create: `GroupMenu.tsx`, `RosterTab.tsx`, `MemberMenu.tsx`, `MoveDialog.tsx`, `AddMembers.tsx`, `GroupHistoryTab.tsx` (in `src/admin/dashboard/grupe/`)
- Test: `src/club/grupe/__tests__/admin-grupe.test.ts` (one more `describe`)

**Interfaces:**
- Consumes: Tasks 1, 3; `MenuButton` (`../SubmissionTable`), `ConfirmDialog` (`src/admin/ConfirmDialog.tsx`), `athleteRecordTo` (`src/club/sportivi/routes.ts`), `historyWhen` (`src/club/sportivi/record-view.ts`), plan 4-1 toasts.
- Produces: `GroupPage({ documentId })` (full page with back link "Grupe", title, subtitle, "..." menu, tabs Sportivi / Istoric; Task 6 adds Program); `RosterTab`, `MoveDialog({ mode: 'move' | 'addAlso', member, page, api, onClose })` (no abonament section in phase 4), `AddMembers({ page, api })`, `GroupHistoryTab({ api, documentId })`.

- [ ] **Step 1: Add the failing source test**

Append to `src/club/grupe/__tests__/admin-grupe.test.ts`:

```ts
describe('group page (6.1, 6.2, 6.4)', () => {
  const page = grupe('GroupPage.tsx');
  const roster = grupe('RosterTab.tsx');
  const move = grupe('MoveDialog.tsx');
  const add = grupe('AddMembers.tsx');
  const menu = grupe('GroupMenu.tsx');

  it('header: back to Grupe, subtitle, "..." with Editează / Șterge grupa, read-only on a past season', () => {
    expect(page).toContain('GRUPE_COPY.back');
    expect(page).toContain('subtitle(page)');
    expect(page).toContain('writable(page)');
    for (const s of ['GRUPE_COPY.edit', 'GRUPE_COPY.remove', 'GRUPE_COPY.removeConfirm', 'page.deletable', 'GROUP_TOASTS.deleted']) expect(menu, s).toContain(s);
  });

  it('roster: the four columns, the athlete opens in the same tab, cards on phones, "..." per row', () => {
    for (const s of ['GRUPE_COPY.colAthlete', 'GRUPE_COPY.colAge', 'GRUPE_COPY.colMain', 'GRUPE_COPY.colOthers', 'GRUPE_COPY.none', 'athleteRecordTo', 'phoneMemberLine', '<MemberMenu']) expect(roster, s).toContain(s);
    expect(roster).not.toContain('target="_blank"');
    expect(grupe('MemberMenu.tsx')).toContain('memberMenuItems');
  });

  it('the move window: Sportiv, Din, În with "Alege grupa", no abonament in phase 4', () => {
    for (const s of ['GRUPE_COPY.moveTitle', 'GRUPE_COPY.addAlsoTitle', 'GRUPE_COPY.fieldAthlete', 'GRUPE_COPY.fieldFrom', 'GRUPE_COPY.fieldTo', 'GRUPE_COPY.pickGroup', 'GROUP_TOASTS.moved', 'GROUP_TOASTS.addedAlso', 'undoToast']) expect(move, s).toContain(s);
    expect(move).not.toMatch(/[Aa]bonament/);
  });

  it('"Scoate din grupă" has no window and toasts with undo', () => {
    expect(roster).toContain('GROUP_TOASTS.removed');
    expect(roster).toContain('api.removeMember');
  });

  it('"Adaugă sportivi": Fără grupă first, all athletes on the switch, members hidden, several ticked', () => {
    for (const s of ['GRUPE_COPY.addMembers', 'GRUPE_COPY.allAthletes', 'GRUPE_COPY.addToGroup', 'addCandidates', 'api.unassigned', 'api.searchAthletes', "mode: 'add'", 'GROUP_TOASTS.added']) expect(add, s).toContain(s);
  });

  it('Istoric reads the group history, newest first', () => {
    expect(grupe('GroupHistoryTab.tsx')).toContain('api.history');
    expect(grupe('GroupHistoryTab.tsx')).toContain('historyWhen');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/grupe/__tests__/admin-grupe.test.ts`
Expected: FAIL (`ENOENT ... RosterTab.tsx`).

- [ ] **Step 3: Write `GroupPage.tsx` and `GroupMenu.tsx`**

`src/admin/dashboard/grupe/GroupPage.tsx` (whole file):

```tsx
import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminPage, BottomSheet, Loading, Notice, PageHeader, Tabs, Window, useIsPhone } from '../../ui';
import type { GroupPage as GroupPageData } from '../../../club/groups/api-types';
import { GROUP_ERRORS, GRUPE_COPY } from '../../../club/groups/copy';
import { groupTabs, subtitle, type GroupTab } from '../../../club/grupe/group-view';
import { writable } from '../../../club/grupe/list-view';
import { grupeListTo, readGrupeQuery } from '../../../club/grupe/routes';
import { SPORTIVI_CSS } from '../sportivi/styles';
import { useGrupeApi, type GrupeApi } from './api';
import { GroupHistoryTab } from './GroupHistoryTab';
import { GroupMenu } from './GroupMenu';
import { RosterTab } from './RosterTab';
import { GRUPE_CSS } from './styles';
import { useGrupeRefresh } from './undo';

type Loaded = { page: GroupPageData | null; failed: boolean; reload: () => Promise<void> };

function useGroupPage(api: GrupeApi, id: string, season: string | null): Loaded {
  const [page, setPage] = React.useState<GroupPageData | null>(null);
  const [failed, setFailed] = React.useState(false);
  const reload = React.useCallback(async () => {
    try {
      setPage(await api.page(id, season));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [api, id, season]);
  React.useEffect(() => {
    void reload();
  }, [reload]);
  useGrupeRefresh(() => void reload());
  return { page, failed, reload };
}

/** Task 6 adds the Program tab and its panel. */
const SHOWN: readonly GroupTab[] = ['sportivi', 'istoric'];

function GroupBody({ page, api, tab, onTab }: { page: GroupPageData; api: GrupeApi; tab: GroupTab; onTab: (t: GroupTab) => void }) {
  const tabs = groupTabs(page).filter((t) => SHOWN.includes(t.id));
  return (
    <>
      <Tabs items={tabs} value={tab} onChange={(id) => onTab(id as GroupTab)} label={GRUPE_COPY.title} panelId="grp-panel" className="spv-tabs" />
      <div role="tabpanel" id="grp-panel">
        {tab === 'sportivi' && <RosterTab page={page} api={api} />}
        {tab === 'istoric' && <GroupHistoryTab api={api} documentId={page.documentId} />}
      </div>
    </>
  );
}

type ShellProps = { page: GroupPageData | null; actions: React.ReactNode; back: string; body: React.ReactNode };

/** A full page with the back link on desktop; a full-height sheet like the athlete record on phones (6.1). */
function Shell({ page, actions, back, body }: ShellProps) {
  const phone = useIsPhone();
  const navigate = useNavigate();
  if (phone) {
    return (
      <BottomSheet open fullHeight desktop="modal" title={page?.name ?? ''} onClose={() => navigate(back)}>
        {page && <div className="spv-phone-head"><span className="spv-sub2">{subtitle(page)}</span>{actions}</div>}
        {body}
      </BottomSheet>
    );
  }
  return (
    <Window>
      <PageHeader back={{ to: back, label: GRUPE_COPY.back }} title={page?.name ?? ''} subtitle={page ? subtitle(page) : undefined} actions={actions} />
      {body}
    </Window>
  );
}

export function GroupPage({ documentId }: { documentId: string }) {
  const api = useGrupeApi();
  const query = readGrupeQuery(useLocation().search);
  const { page, failed } = useGroupPage(api, documentId, query.season);
  const [tab, setTab] = React.useState<GroupTab>(query.tab === 'program' ? 'program' : 'sportivi');
  const back = grupeListTo(query.season, null);
  const actions = page && writable(page) ? <GroupMenu page={page} api={api} back={back} /> : null;
  const state = failed ? <div className="ui-body"><Notice tone="danger">{GROUP_ERRORS.loadFailed}</Notice></div> : <Loading />;
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS + GRUPE_CSS}</style>
      <Shell page={page} actions={actions} back={back} body={page ? <GroupBody page={page} api={api} tab={tab} onTab={setTab} /> : state} />
    </AdminPage>
  );
}
```

`src/admin/dashboard/grupe/GroupMenu.tsx`:

```tsx
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { adminToast } from '../../ui';
import { ConfirmDialog } from '../../ConfirmDialog';
import { MenuButton } from '../SubmissionTable';
import type { GroupPage } from '../../../club/groups/api-types';
import { GROUP_ERRORS, GROUP_TOASTS, GRUPE_COPY } from '../../../club/groups/copy';
import { requestErrorText } from '../../../club/registration-panel';
import type { GrupeApi } from './api';
import { GroupDialog } from './GroupDialog';

type Props = { page: GroupPage; api: GrupeApi; back: string };

function useDelete(page: GroupPage, api: GrupeApi, back: string) {
  const navigate = useNavigate();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.remove(page.documentId);
      adminToast.success(GROUP_TOASTS.deleted(res.name));
      navigate(back);
    } catch (err) {
      setError(requestErrorText(err, GROUP_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** Header "...": "Editează grupa"; "Șterge grupa" only for a group never used (6.1, W11). */
export function GroupMenu({ page, api, back }: Props) {
  const [open, setOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<'edit' | 'delete' | null>(null);
  const del = useDelete(page, api, back);
  const pick = (d: 'edit' | 'delete') => {
    setOpen(false);
    setDialog(d);
  };
  const label = <><span aria-hidden="true">...</span><span className="ui-sr">{GRUPE_COPY.menu}</span></>;
  return (
    <>
      <MenuButton label={label} open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="spv-menu" placement="bottom-end" role="menu" chevron={false}>
        <button type="button" role="menuitem" onClick={() => pick('edit')}>{GRUPE_COPY.edit}</button>
        {page.deletable && <button type="button" role="menuitem" className="spv-danger" onClick={() => pick('delete')}>{GRUPE_COPY.remove}</button>}
      </MenuButton>
      {dialog === 'edit' && page.section && (
        <GroupDialog mode="edit" sectionSlug="" sectionId={page.section.documentId} group={page} onClose={() => setDialog(null)} onSaved={() => undefined} />
      )}
      <ConfirmDialog open={dialog === 'delete'} title={GRUPE_COPY.remove} message={GRUPE_COPY.removeConfirm(page.name)} tone="danger" confirmLabel={GRUPE_COPY.remove} busy={del.busy} error={del.error} onCancel={() => setDialog(null)} onConfirm={() => void del.run()} />
    </>
  );
}
```

- [ ] **Step 4: Roster, row menu, move window, "Adaugă sportivi", Istoric**

`src/admin/dashboard/grupe/MemberMenu.tsx`:

```tsx
import * as React from 'react';
import { MenuButton } from '../SubmissionTable';
import type { MemberRow } from '../../../club/groups/api-types';
import { GRUPE_COPY } from '../../../club/groups/copy';
import { memberMenuItems, type MemberAction } from '../../../club/grupe/group-view';

/** Row "...": "Mută", "Adaugă și în grupă", "Scoate din grupă" (red) (6.2). */
export function MemberMenu({ member, busy, onPick }: { member: MemberRow; busy: boolean; onPick: (a: MemberAction, m: MemberRow) => void }) {
  const [open, setOpen] = React.useState(false);
  const label = <><span aria-hidden="true">...</span><span className="ui-sr">{GRUPE_COPY.menu}</span></>;
  return (
    <MenuButton label={label} open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="spv-menu" placement="bottom-end" role="menu" chevron={false} disabled={busy}>
      {memberMenuItems().map((item) => (
        <button key={item.key} type="button" role="menuitem" className={item.danger ? 'spv-danger' : undefined} onClick={() => { setOpen(false); onPick(item.key, member); }}>
          {item.label}
        </button>
      ))}
    </MenuButton>
  );
}
```

`src/admin/dashboard/grupe/RosterTab.tsx`:

```tsx
import * as React from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, useIsPhone } from '../../ui';
import type { GroupPage, MemberRow } from '../../../club/groups/api-types';
import { GROUP_TOASTS, GRUPE_COPY, athletesText } from '../../../club/groups/copy';
import { ageText, mainText, othersText, phoneMemberLine, type MemberAction } from '../../../club/grupe/group-view';
import { writable } from '../../../club/grupe/list-view';
import { athleteRecordTo } from '../../../club/sportivi/routes';
import type { GrupeApi } from './api';
import { AddMembers } from './AddMembers';
import { MemberMenu } from './MemberMenu';
import { MoveDialog } from './MoveDialog';
import { failToast, undoToast } from './undo';

type Pick = (a: MemberAction, m: MemberRow) => void;
type ListProps = { page: GroupPage; can: boolean; busy: string | null; onPick: Pick };
const muted = (text: string) => <span className="spv-muted">{text}</span>;

function MemberTable({ page, can, busy, onPick }: ListProps) {
  return (
    <table className="ui-table">
      <thead>
        <tr><th scope="col">{GRUPE_COPY.colAthlete}</th><th scope="col">{GRUPE_COPY.colAge}</th><th scope="col">{GRUPE_COPY.colMain}</th><th scope="col">{GRUPE_COPY.colOthers}</th><th scope="col"><span className="ui-sr">{GRUPE_COPY.menu}</span></th></tr>
      </thead>
      <tbody>
        {page.members.map((m) => (
          <tr key={m.membershipId}>
            <td><Link className="spv-name" to={athleteRecordTo(m.athleteId)}>{m.name}</Link></td>
            <td>{ageText(m.age)}</td>
            <td>{m.isMain ? mainText(m) : muted(mainText(m))}</td>
            <td>{othersText(m) ?? muted(GRUPE_COPY.none)}</td>
            <td>{can && <MemberMenu member={m} busy={busy === m.membershipId} onPick={onPick} />}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MemberCards({ page, can, busy, onPick }: ListProps) {
  return (
    <ul className="spv-cards">
      {page.members.map((m) => (
        <li key={m.membershipId} className="spv-card">
          <Link className="spv-name" to={athleteRecordTo(m.athleteId)}>{m.name}</Link>
          <span>{phoneMemberLine(m)}</span>
          {can && <MemberMenu member={m} busy={busy === m.membershipId} onPick={onPick} />}
        </li>
      ))}
    </ul>
  );
}

function useRemove(page: GroupPage, api: GrupeApi) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const remove = async (m: MemberRow) => {
    setBusy(m.membershipId);
    try {
      const res = await api.removeMember(m.membershipId);
      undoToast(GROUP_TOASTS.removed(page.name, m.name), res.undo?.actionId ?? null, api);
    } catch (err) {
      failToast(err);
    } finally {
      setBusy(null);
    }
  };
  return { busy, remove };
}

/** Sportivi tab (6.2): the bar, the roster, the row menu and its windows. */
export function RosterTab({ page, api }: { page: GroupPage; api: GrupeApi }) {
  const phone = useIsPhone();
  const can = writable(page);
  const { busy, remove } = useRemove(page, api);
  const [dialog, setDialog] = React.useState<{ mode: 'move' | 'addAlso'; member: MemberRow } | null>(null);
  const onPick: Pick = (a, m) => (a === 'remove' ? void remove(m) : setDialog({ mode: a, member: m }));
  const list = phone ? <MemberCards page={page} can={can} busy={busy} onPick={onPick} /> : <MemberTable page={page} can={can} busy={busy} onPick={onPick} />;
  return (
    <div className="ui-body">
      <div className="grp-bar"><span>{athletesText(page.members.length)}</span>{can && <AddMembers page={page} api={api} />}</div>
      {page.members.length ? list : <EmptyState>{athletesText(0)}</EmptyState>}
      {dialog && <MoveDialog mode={dialog.mode} member={dialog.member} page={page} api={api} onClose={() => setDialog(null)} />}
    </div>
  );
}
```

Plan 4-6 replaces the `EmptyState` of an empty roster with the "Copiază sportivii din <sezon>" state when `page.copyFrom` offers it.

`src/admin/dashboard/grupe/MoveDialog.tsx`:

```tsx
import * as React from 'react';
import { Button, Notice, SearchableSelect } from '../../ui';
import type { GroupChoice, GroupPage, MemberRow } from '../../../club/groups/api-types';
import { GROUP_ERRORS, GROUP_TOASTS, GRUPE_COPY } from '../../../club/groups/copy';
import { groupOptions } from '../../../club/grupe/list-view';
import { requestErrorText } from '../../../club/registration-panel';
import type { GrupeApi } from './api';
import { WindowShell } from './PanelShell';
import { undoToast } from './undo';

type Props = { mode: 'move' | 'addAlso'; member: MemberRow; page: GroupPage; api: GrupeApi; onClose: () => void };

function useGroups(api: GrupeApi): GroupChoice[] {
  const [groups, setGroups] = React.useState<GroupChoice[]>([]);
  React.useEffect(() => {
    api.options().then((o) => setGroups(o.groups)).catch(() => setGroups([]));
  }, [api]);
  return groups;
}

async function apply(p: Props, to: string, groups: GroupChoice[]): Promise<void> {
  const name = groups.find((g) => g.documentId === to)?.name ?? '';
  if (p.mode === 'move') {
    const res = await p.api.move(p.member.membershipId, to);
    undoToast(GROUP_TOASTS.moved(res.data.groupName, res.data.athleteName), res.undo?.actionId ?? null, p.api);
    return;
  }
  const res = await p.api.join(to, { season: p.page.season?.label ?? '', athleteIds: [p.member.athleteId], mode: 'add' });
  undoToast(GROUP_TOASTS.addedAlso(name, p.member.name), res.undo?.actionId ?? null, p.api);
}

/** The one move window (move-modal-final) and "Adaugă și în grupă" (6.2, W2, W3). No abonament in phase 4. */
export function MoveDialog(p: Props) {
  const groups = useGroups(p.api);
  const [to, setTo] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submit = async () => {
    if (!to) return setError(GROUP_ERRORS.pickGroup);
    setBusy(true);
    try {
      await apply(p, to, groups);
      p.onClose();
    } catch (err) {
      setError(requestErrorText(err, GROUP_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  const footer = <><Button variant="ghost" onClick={p.onClose} disabled={busy}>{GRUPE_COPY.cancel}</Button><Button loading={busy} onClick={() => void submit()}>{p.mode === 'move' ? GRUPE_COPY.move : GRUPE_COPY.add}</Button></>;
  return (
    <WindowShell title={p.mode === 'move' ? GRUPE_COPY.moveTitle : GRUPE_COPY.addAlsoTitle} onClose={p.onClose} footer={footer}>
      {error && <Notice tone="danger">{error}</Notice>}
      <dl className="grp-kv">
        <dt>{GRUPE_COPY.fieldAthlete}</dt><dd>{p.member.name}</dd>
        {p.mode === 'move' && <><dt>{GRUPE_COPY.fieldFrom}</dt><dd>{p.page.name}</dd></>}
        <dt>{GRUPE_COPY.fieldTo}</dt>
        <dd><SearchableSelect value={to} options={groupOptions(groups, p.page.documentId)} placeholder={GRUPE_COPY.pickGroup} onChange={(v) => { setTo(v); setError(null); }} /></dd>
      </dl>
    </WindowShell>
  );
}
```

`src/admin/dashboard/grupe/AddMembers.tsx`:

```tsx
import * as React from 'react';
import { BottomSheet, Button, Checkbox, Input, Switch } from '../../ui';
import { IconPlus } from '../../ui/icons';
import type { GroupPage } from '../../../club/groups/api-types';
import { GROUP_TOASTS, GRUPE_COPY } from '../../../club/groups/copy';
import { addCandidates } from '../../../club/grupe/group-view';
import type { GrupeApi } from './api';
import { failToast, undoToast } from './undo';

type Candidate = { athleteId: string; name: string; source: string };

/** Off: the "Fără grupă" rows of the season; on: the athlete search (two letters at least) (decided 3). */
function useCandidates(api: GrupeApi, page: GroupPage, all: boolean, q: string): Candidate[] {
  const [rows, setRows] = React.useState<Candidate[]>([]);
  React.useEffect(() => {
    let off = false;
    const load = all
      ? q.trim().length >= 2 ? api.searchAthletes(q).then((cards) => cards.map((c) => ({ athleteId: c.documentId, name: c.name, source: c.lastGroup?.name ?? '' }))) : Promise.resolve([])
      : api.unassigned(page.season?.label ?? null).then((p) => p.rows.map((r) => ({ athleteId: r.athleteId, name: r.name, source: r.source })));
    load.then((list) => { if (!off) setRows(addCandidates(list, page.members)); }).catch(() => { if (!off) setRows([]); });
    return () => { off = true; };
  }, [api, page, all, q]);
  return rows;
}

function Picker({ rows, ticked, toggle }: { rows: Candidate[]; ticked: Set<string>; toggle: (id: string) => void }) {
  return (
    <div className="grp-pick">
      {rows.map((r) => (
        <Checkbox key={r.athleteId} checked={ticked.has(r.athleteId)} onChange={() => toggle(r.athleteId)} label={<span><span className="spv-name">{r.name}</span> <span className="grp-ua-src">{r.source}</span></span>} />
      ))}
    </div>
  );
}

/** "Adaugă sportivi" (6.2, W3): tick several; each becomes main when it has no group this season; Inactiv becomes Activ. */
export function AddMembers({ page, api }: { page: GroupPage; api: GrupeApi }) {
  const anchor = React.useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [all, setAll] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [ticked, setTicked] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const rows = useCandidates(api, page, all, q);
  const toggle = (id: string) => setTicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.join(page.documentId, { season: page.season?.label ?? '', athleteIds: [...ticked], mode: 'add' });
      undoToast(GROUP_TOASTS.added(res.data.added), res.undo?.actionId ?? null, api);
      setOpen(false);
      setTicked(new Set());
    } catch (err) {
      failToast(err);
    } finally {
      setBusy(false);
    }
  };
  const footer = <Button loading={busy} disabled={!ticked.size} onClick={() => void submit()}>{GRUPE_COPY.addToGroup}</Button>;
  return (
    <>
      <Button ref={anchor} variant="secondary" size="sm" icon={<IconPlus />} onClick={() => setOpen((o) => !o)}>{GRUPE_COPY.addMembers}</Button>
      {open && (
        <BottomSheet open title={GRUPE_COPY.addMembersTitle} desktop="dropdown" anchorRef={anchor} dropdownWidth={460} onClose={() => setOpen(false)} footer={footer}>
          <Switch checked={all} onChange={setAll} label={GRUPE_COPY.allAthletes} />
          {all && <Input type="search" value={q} placeholder={GRUPE_COPY.searchAthletes} aria-label={GRUPE_COPY.searchAthletes} onChange={(e) => setQ(e.target.value)} />}
          <Picker rows={rows} ticked={ticked} toggle={toggle} />
        </BottomSheet>
      )}
    </>
  );
}
```

`AddMembers` is above 30 lines with its JSX; split the sheet into `AddSheet({ rows, all, setAll, q, setQ, ticked, toggle, footer, anchor, onClose })` in the same file to stay under the limit.

`src/admin/dashboard/grupe/GroupHistoryTab.tsx`:

```tsx
import * as React from 'react';
import { Loading, Notice } from '../../ui';
import type { HistoryLine } from '../../../club/athletes/api-types';
import { GROUP_ERRORS } from '../../../club/groups/copy';
import { historyWhen } from '../../../club/sportivi/record-view';
import type { GrupeApi } from './api';

/** Istoric (6.4): newest first, the date bold, the actor muted ("Migrare" for migration rows), the line under it. */
export function GroupHistoryTab({ api, documentId }: { api: GrupeApi; documentId: string }) {
  const [lines, setLines] = React.useState<HistoryLine[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let off = false;
    api.history(documentId).then((l) => { if (!off) setLines(l); }).catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, [api, documentId]);
  if (failed) return <div className="ui-body"><Notice tone="danger">{GROUP_ERRORS.loadFailed}</Notice></div>;
  if (!lines) return <Loading />;
  return (
    <div className="ui-body">
      <ol className="spv-hist">
        {lines.map((l, i) => (
          <li key={`${l.at}-${i}`}>
            <div className="spv-hist-h"><b>{historyWhen(l.at)}</b><span>{l.actor}</span></div>
            <div>{l.text}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 5: Run the tests and checks**

Run: `npx vitest run src/club/grupe && npx vitest run && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS; zero type errors; checker exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/admin/dashboard/grupe src/club/grupe/__tests__/admin-grupe.test.ts
git commit -m "feat(grupe): group page with Sportivi, the move window, Adaugă sportivi and Istoric"
```

---

### Task 6: The Program tab

**Files:**
- Modify: `src/plugins/component-preview/admin/src/calendar/model.ts` (`Occurrence` gains `groupId?`, `groupName?`, `originalDate?`, `originalStartTime?`)
- Modify: `src/plugins/component-preview/admin/src/calendar/CalendarView.tsx` (`view`, `weekTitle`, optional `onAddOn`)
- Create: `src/admin/dashboard/grupe/ProgramTab.tsx`, `GroupCalendar.tsx`, `ProgramDrawer.tsx`, `DatePanel.tsx`
- Modify: `src/admin/dashboard/grupe/GroupPage.tsx` (the Program tab)
- Test: `src/club/grupe/__tests__/admin-grupe.test.ts` (one more `describe`)

**Interfaces:**
- Consumes: Task 2 (`groupChip`, `weekTitle`, `panelTitle`, `isBreak`, `dateKey`, `durationOptions`, `freqOptions`, `weekOfMonthOptions`, `DAY_TOGGLES`, `newProgramForm`, `formFromRow`, `programFormError`, `programBody`, `changeBody`, `programToast`, `dateFormOf`, `dateBody`, `dateToast`), Task 3 (api, shells, toasts), plan 4-2 (`ProgramRow`, `GroupProgram`, `SCHEDULE_TOASTS`), `shortDate`, `dayMonth`.
- Produces:
  - `GridProps.view?: (o: Occurrence) => OccView` (default `occView`), `GridProps.onAddOn?` optional (no add buttons without it), `AgendaList` prop `weekTitle?: (monday: Date) => string` (default `weekLabel`). The general calendar passes nothing new and keeps its behaviour.
  - `DatePanel({ occurrence, isClass, readOnly, api, onClose, groupLink? })`: exported for plan 4-6 (the general calendar opens it with "Deschide grupa").
  - `ProgramTab({ page, api })`, `GroupCalendar({ groupId, api, reloadKey, onOpen })`, `ProgramDrawer({ mode, row, groupId, api, today, onClose })`.

- [ ] **Step 1: Add the failing source test**

Append to `src/club/grupe/__tests__/admin-grupe.test.ts`:

```ts
describe('Program tab (6.3)', () => {
  const tab = grupe('ProgramTab.tsx');
  const drawer = grupe('ProgramDrawer.tsx');
  const panel = grupe('DatePanel.tsx');
  const cal = grupe('GroupCalendar.tsx');
  const view = source('plugins/component-preview/admin/src/calendar/CalendarView.tsx');

  it('Program obișnuit rows with Schimbă, and Adaugă program, on a writable season', () => {
    for (const s of ['GRUPE_COPY.usual', 'GRUPE_COPY.change', 'GRUPE_COPY.addProgram', 'GRUPE_COPY.fromDate', 'writable(page)']) expect(tab, s).toContain(s);
  });

  it('the calendar: Listă / Lună, month navigation, Azi, group chips, week titles, no add buttons', () => {
    for (const s of ['GRUPE_COPY.viewList', 'GRUPE_COPY.viewMonth', 'GRUPE_COPY.today', 'groupChip', 'weekTitle', 'api.occurrences']) expect(cal, s).toContain(s);
    expect(cal).not.toContain('onAddOn=');
    expect(view).toContain('view = occView');
    expect(view).toContain('weekTitle = weekLabel');
  });

  it('Program nou: Se repetă, Cât de des, Săptămâna din lună for Lunar, square day toggles, De la, Durată, Se aplică din; off: Data, Notă', () => {
    for (const s of ['GRUPE_COPY.repeat', 'GRUPE_COPY.howOften', 'GRUPE_COPY.weekOfMonth', 'DAY_TOGGLES', 'aria-pressed', 'GRUPE_COPY.startAt', 'GRUPE_COPY.duration', 'GRUPE_COPY.appliesFrom', 'GRUPE_COPY.date', 'GRUPE_COPY.note', 'durationOptions']) expect(drawer, s).toContain(s);
  });

  it('Schimbă programul: no Se repetă, a red Șterge programul with its confirmation', () => {
    for (const s of ['GRUPE_COPY.drawerChange', 'GRUPE_COPY.endProgram', 'GRUPE_COPY.endConfirm', 'grp-danger-link', 'SCHEDULE_TOASTS.programChanged', 'SCHEDULE_TOASTS.programEnded']) expect(drawer, s).toContain(s);
  });

  it('the date panel: Ține / Anulează / Mută, Data nouă and De la for Mută, Motiv, the e-mail box, Șterge ședința for one class, read-only on a break', () => {
    for (const s of ['GRUPE_COPY.thisDate', 'GRUPE_COPY.keep', 'GRUPE_COPY.cancelDate', 'GRUPE_COPY.moveDate', 'GRUPE_COPY.newDate', 'GRUPE_COPY.reason', 'GRUPE_COPY.notify', 'GRUPE_COPY.deleteClass', 'GRUPE_COPY.breakNotice', 'isBreak', 'dateKey', 'dateToast', 'panelTitle']) expect(panel, s).toContain(s);
    expect(panel).toContain('maxLength={120}');
  });

  it('the group page shows the Program tab', () => {
    expect(grupe('GroupPage.tsx')).toContain('<ProgramTab');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/grupe/__tests__/admin-grupe.test.ts`
Expected: FAIL (`ENOENT ... ProgramTab.tsx`).

- [ ] **Step 3: Extend the calendar components**

`src/plugins/component-preview/admin/src/calendar/model.ts`, in `interface Occurrence`, add:

```ts
  /** Phase 4: the group of a group event (admin occurrences route), and where a moved date came from. */
  groupId?: string | null;
  groupName?: string | null;
  originalDate?: string | null;
  originalStartTime?: string | null;
```

`src/plugins/component-preview/admin/src/calendar/CalendarView.tsx`:

1. Import `type OccView` from `./model` with the existing imports.
2. `EventChipProps` gains `view?: (o: Occurrence) => OccView;`; `EventChip` destructures `view = occView` and uses `const v = view(o);`.
3. `GridProps`: make `onAddOn` optional (`onAddOn?: (date: string) => void;`) and add `view?: (o: Occurrence) => OccView;`.
4. `MonthGrid`: destructure `view`; the day cell's `onClick={onAddOn ? () => onAddOn(key) : undefined}`; render the day number as the existing `button.cal-num` only when `onAddOn` is given, else `<span className="cal-num">{d.getDate()}</span>`; pass `view={view}` to each `EventChip`.
5. `CompactMonth`: destructure `view`; marks use `(view ?? occView)(o).cat`; render the "Adaugă în această zi" button only when `onAddOn`; pass `view={view}` to `EventChip`.
6. `AgendaList`: add `weekTitle = weekLabel` to its props (type `GridProps & { focusDate: string | null; weekTitle?: (monday: Date) => string }`), use `weekTitle(w.monday)` for the section label and heading, render the day box as a `button` only with `onAddOn` (else a `div` with the same class), the empty state's "Adaugă" action only with `onAddOn`; pass `view={view}` to `EventChip`.

The Program page's `ProgramOverviewEditor` passes `onAddOn` as today, so it keeps every add button.

- [ ] **Step 4: Write `DatePanel.tsx`**

```tsx
import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button, Checkbox, DateInput, Field, Input, Notice, SegmentedControl, TimeInput } from '../../ui';
import { ConfirmDialog } from '../../ConfirmDialog';
import type { Occurrence } from '../../../api/calendar-event/services/expand';
import { GROUP_ERRORS, GRUPE_COPY, SCHEDULE_TOASTS } from '../../../club/groups/copy';
import { dayMonth } from '../../../club/groups/dates';
import { dateBody, dateFormOf, dateKey, dateToast, isBreak, panelTitle, type DateForm, type DateMode } from '../../../club/grupe/program-view';
import { requestErrorText } from '../../../club/registration-panel';
import type { GrupeApi } from './api';
import { PanelShell } from './PanelShell';
import { undoToast } from './undo';

export type DatePanelProps = { occurrence: Occurrence; isClass: boolean; readOnly: boolean; api: GrupeApi; onClose: () => void; groupLink?: string | null };

const MODES: { value: DateMode; label: string }[] = [
  { value: 'keep', label: GRUPE_COPY.keep }, { value: 'cancel', label: GRUPE_COPY.cancelDate }, { value: 'move', label: GRUPE_COPY.moveDate },
];

function DateFields({ form, set, readOnly }: { form: DateForm; set: (f: DateForm) => void; readOnly: boolean }) {
  return (
    <div className="grp-form">
      <Field label={GRUPE_COPY.thisDate}>
        <SegmentedControl<DateMode> options={MODES} value={form.mode} onChange={(mode) => set({ ...form, mode })} disabled={readOnly} block />
      </Field>
      {form.mode === 'move' && (
        <>
          <Field label={GRUPE_COPY.newDate}><DateInput value={form.newDate} onChange={(v) => set({ ...form, newDate: v ?? '' })} disabled={readOnly} /></Field>
          <Field label={GRUPE_COPY.startAt}><TimeInput value={form.newStartTime} onChange={(v) => set({ ...form, newStartTime: v ?? '' })} disabled={readOnly} /></Field>
        </>
      )}
      {form.mode !== 'keep' && (
        <>
          <Field label={GRUPE_COPY.reason} hint={GRUPE_COPY.optional}><Input value={form.reason} maxLength={120} onChange={(e) => set({ ...form, reason: e.target.value })} disabled={readOnly} /></Field>
          <Checkbox checked={form.notify} onChange={(v) => set({ ...form, notify: v })} label={GRUPE_COPY.notify} disabled={readOnly} />
        </>
      )}
    </div>
  );
}

function useDateActions(p: DatePanelProps, form: DateForm) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      p.onClose();
    } catch (err) {
      setError(requestErrorText(err, GROUP_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  const eventId = p.occurrence.documentId ?? '';
  const save = () => run(async () => {
    const res = await p.api.setDate(eventId, dateKey(p.occurrence), dateBody(form));
    undoToast(dateToast(form.mode, dateKey(p.occurrence)), res.undo?.actionId ?? null, p.api);
  });
  const remove = () => run(async () => {
    const res = await p.api.deleteClass(eventId);
    undoToast(SCHEDULE_TOASTS.classDeleted, res.undo?.actionId ?? null, p.api);
  });
  return { busy, error, save, remove };
}

/** One date of a group (6.3, W12, W13): "<Zi>, <data>, <ora>"; a break date read-only with its name. */
export function DatePanel(p: DatePanelProps) {
  const o = p.occurrence;
  const [form, setForm] = React.useState<DateForm>(() => dateFormOf(o));
  const [confirm, setConfirm] = React.useState(false);
  const act = useDateActions(p, form);
  const locked = p.readOnly || isBreak(o);
  const title = panelTitle(dateKey(o), o.originalStartTime ?? o.startTime);
  const footer = locked ? <Button variant="ghost" onClick={p.onClose}>{GRUPE_COPY.cancel}</Button> : (
    <><Button variant="ghost" onClick={p.onClose} disabled={act.busy}>{GRUPE_COPY.cancel}</Button><Button loading={act.busy} onClick={() => void act.save()}>{GRUPE_COPY.save}</Button></>
  );
  return (
    <PanelShell title={title} onClose={p.onClose} footer={footer}>
      {act.error && <Notice tone="danger">{act.error}</Notice>}
      {isBreak(o) ? <Notice tone="info">{GRUPE_COPY.breakNotice(o.note ?? '')}</Notice> : <DateFields form={form} set={setForm} readOnly={locked} />}
      {p.isClass && !locked && <button type="button" className="grp-danger-link" onClick={() => setConfirm(true)}>{GRUPE_COPY.deleteClass}</button>}
      {p.groupLink && <Link className="spv-link" to={p.groupLink}>{GRUPE_COPY.openGroup}</Link>}
      <ConfirmDialog open={confirm} title={GRUPE_COPY.deleteClass} message={GRUPE_COPY.deleteClassConfirm(dayMonth(dateKey(o)))} tone="danger" confirmLabel={GRUPE_COPY.deleteClass} busy={act.busy} onCancel={() => setConfirm(false)} onConfirm={() => void act.remove()} />
    </PanelShell>
  );
}
```

`DatePanel` is near the 30-line limit; if it passes, move the footer into `PanelFooter({ locked, busy, onClose, onSave })` in the same file.

- [ ] **Step 5: Write `ProgramDrawer.tsx`**

```tsx
import * as React from 'react';
import { Button, DateInput, Field, Input, Notice, Select, Switch, TimeInput } from '../../ui';
import { ConfirmDialog } from '../../ConfirmDialog';
import { GROUP_ERRORS, GRUPE_COPY, SCHEDULE_TOASTS } from '../../../club/groups/copy';
import { shortDate } from '../../../club/groups/dates';
import type { ProgramRow } from '../../../club/groups/program-read';
import type { DayKey } from '../../../club/groups/types';
import {
  DAY_TOGGLES, changeBody, durationOptions, formFromRow, freqOptions, newProgramForm, programBody, programFormError, programToast, weekOfMonthOptions, type Freq, type ProgramForm,
} from '../../../club/grupe/program-view';
import type { WeekOfMonth } from '../../../club/groups/types';
import { requestErrorText } from '../../../club/registration-panel';
import type { GrupeApi } from './api';
import { PanelShell } from './PanelShell';
import { undoToast } from './undo';

type Props = { mode: 'new' | 'change'; row: ProgramRow | null; groupId: string; api: GrupeApi; today: string; onClose: () => void };
type Set = (f: ProgramForm) => void;

function DayToggles({ form, set }: { form: ProgramForm; set: Set }) {
  const toggle = (d: DayKey) => set({ ...form, days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] });
  return (
    <div className="grp-days" role="group" aria-label={GRUPE_COPY.days}>
      {DAY_TOGGLES.map((d) => <button key={d.key} type="button" className="grp-day" aria-pressed={form.days.includes(d.key)} onClick={() => toggle(d.key)}>{d.label}</button>)}
    </div>
  );
}

const timeAndDuration = (form: ProgramForm, set: Set) => (
  <>
    <Field label={GRUPE_COPY.startAt}><TimeInput value={form.startTime || null} onChange={(v) => set({ ...form, startTime: v ?? '' })} /></Field>
    <Field label={GRUPE_COPY.duration}><Select value={String(form.durationMin)} options={durationOptions()} onChange={(v) => set({ ...form, durationMin: Number(v) })} /></Field>
  </>
);

function SeriesFields({ form, set }: { form: ProgramForm; set: Set }) {
  return (
    <>
      <Field label={GRUPE_COPY.howOften}><Select value={form.freq} options={freqOptions()} onChange={(v) => set({ ...form, freq: v as Freq })} /></Field>
      {form.freq === 'monthly' && <Field label={GRUPE_COPY.weekOfMonth}><Select value={form.weekOfMonth} options={weekOfMonthOptions()} onChange={(v) => set({ ...form, weekOfMonth: v as WeekOfMonth })} /></Field>}
      <Field label={GRUPE_COPY.days}><DayToggles form={form} set={set} /></Field>
      {timeAndDuration(form, set)}
      <Field label={GRUPE_COPY.appliesFrom}><DateInput value={form.from} onChange={(v) => set({ ...form, from: v ?? form.from })} /></Field>
    </>
  );
}

function ClassFields({ form, set }: { form: ProgramForm; set: Set }) {
  return (
    <>
      <Field label={GRUPE_COPY.date}><DateInput value={form.date} onChange={(v) => set({ ...form, date: v ?? form.date })} /></Field>
      {timeAndDuration(form, set)}
      <Field label={GRUPE_COPY.note} hint={GRUPE_COPY.optional}><Input value={form.note} onChange={(e) => set({ ...form, note: e.target.value })} /></Field>
    </>
  );
}

function useProgramActions(p: Props, form: ProgramForm) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      p.onClose();
    } catch (err) {
      setError(requestErrorText(err, GROUP_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    const invalid = programFormError(form);
    if (invalid) return setError(invalid);
    void run(async () => {
      if (p.mode === 'new' || !p.row) {
        const res = await p.api.addProgram(p.groupId, programBody(form));
        return undoToast(programToast(res.data), res.undo?.actionId ?? null, p.api);
      }
      const res = await p.api.changeProgram(p.row.eventId, changeBody(form));
      undoToast(SCHEDULE_TOASTS.programChanged, res.undo?.actionId ?? null, p.api);
    });
  };
  const end = () => void run(async () => {
    const res = await p.api.endProgram(p.row?.eventId ?? '', form.from);
    undoToast(SCHEDULE_TOASTS.programEnded, res.undo?.actionId ?? null, p.api);
  });
  return { busy, error, save, end };
}

/** "Program nou" / "Schimbă programul" (6.3, W10). */
export function ProgramDrawer(p: Props) {
  const [form, setForm] = React.useState<ProgramForm>(() => (p.row ? formFromRow(p.row, p.today) : newProgramForm(p.today)));
  const [confirm, setConfirm] = React.useState(false);
  const act = useProgramActions(p, form);
  const footer = <><Button variant="ghost" onClick={p.onClose} disabled={act.busy}>{GRUPE_COPY.cancel}</Button><Button loading={act.busy} onClick={act.save}>{GRUPE_COPY.save}</Button></>;
  return (
    <PanelShell title={p.mode === 'new' ? GRUPE_COPY.drawerNew : GRUPE_COPY.drawerChange} onClose={p.onClose} footer={footer}>
      {act.error && <Notice tone="danger">{act.error}</Notice>}
      <div className="grp-form">
        {p.mode === 'new' && <Switch checked={form.repeat} onChange={(v) => setForm({ ...form, repeat: v })} label={GRUPE_COPY.repeat} />}
        {form.repeat ? <SeriesFields form={form} set={setForm} /> : <ClassFields form={form} set={setForm} />}
        {p.mode === 'change' && <button type="button" className="grp-danger-link" onClick={() => setConfirm(true)}>{GRUPE_COPY.endProgram}</button>}
      </div>
      <ConfirmDialog open={confirm} title={GRUPE_COPY.endProgram} message={GRUPE_COPY.endConfirm(shortDate(form.from))} tone="danger" confirmLabel={GRUPE_COPY.endProgram} busy={act.busy} onCancel={() => setConfirm(false)} onConfirm={act.end} />
    </PanelShell>
  );
}
```

- [ ] **Step 6: Write `GroupCalendar.tsx` and `ProgramTab.tsx`**

`src/admin/dashboard/grupe/GroupCalendar.tsx`:

```tsx
import * as React from 'react';
import { Button, SegmentedControl, useIsPhone } from '../../ui';
import type { Occurrence } from '../../../api/calendar-event/services/expand';
import { GRUPE_COPY } from '../../../club/groups/copy';
import { groupChip, weekTitle } from '../../../club/grupe/program-view';
import { AgendaList, CompactMonth, MonthGrid, type CalView } from '../../../plugins/component-preview/admin/src/calendar/CalendarView';
import { RO_MONTHS, ymd, type Occurrence as CalOccurrence } from '../../../plugins/component-preview/admin/src/calendar/model';
import { CAL_CSS } from '../../../plugins/component-preview/admin/src/calendar/styles';
import type { GrupeApi } from './api';

type Props = { groupId: string; api: GrupeApi; reloadKey: number; onOpen: (o: Occurrence) => void };
type Ym = { y: number; m: number };

function useMonth(api: GrupeApi, groupId: string, ym: Ym, reloadKey: number): Occurrence[] {
  const [list, setList] = React.useState<Occurrence[]>([]);
  React.useEffect(() => {
    let off = false;
    api.occurrences(groupId, ymd(new Date(ym.y, ym.m, 1)), ymd(new Date(ym.y, ym.m + 1, 0)))
      .then((l) => { if (!off) setList(l); })
      .catch(() => { if (!off) setList([]); });
    return () => { off = true; };
  }, [api, groupId, ym, reloadKey]);
  return list;
}

const byDate = (list: Occurrence[]): Map<string, CalOccurrence[]> => {
  const out = new Map<string, CalOccurrence[]>();
  for (const o of list) out.set(o.date, [...(out.get(o.date) ?? []), o]);
  return out;
};

type BarProps = { ym: Ym; view: CalView; narrow: boolean; go: (delta: number) => void; today: () => void; setView: (v: CalView) => void };

function Bar({ ym, view, narrow, go, today, setView }: BarProps) {
  const views = [{ value: 'list' as const, label: GRUPE_COPY.viewList }, { value: 'month' as const, label: GRUPE_COPY.viewMonth }];
  return (
    <div className="grp-cal-bar">
      <Button variant="secondary" size="sm" aria-label={GRUPE_COPY.prevMonth} onClick={() => go(-1)}>‹</Button>
      <span className="cal-mon" aria-live="polite">{`${RO_MONTHS[ym.m]} ${ym.y}`}</span>
      <Button variant="secondary" size="sm" aria-label={GRUPE_COPY.nextMonth} onClick={() => go(1)}>›</Button>
      <Button variant="secondary" size="sm" onClick={today}>{GRUPE_COPY.today}</Button>
      <span className="cal-sp" />
      <SegmentedControl<CalView> aria-label={GRUPE_COPY.tabProgram} options={views} value={view} onChange={setView} block={narrow} />
    </div>
  );
}

/** The group's dates (6.3): Listă / Lună, any month, "Azi"; chips as `groupChip` writes them; no add buttons (decided 8). */
export function GroupCalendar({ groupId, api, reloadKey, onOpen }: Props) {
  const narrow = useIsPhone();
  const now = new Date();
  const [ym, setYm] = React.useState<Ym>({ y: now.getFullYear(), m: now.getMonth() });
  const [view, setView] = React.useState<CalView>('list');
  const [selected, setSelected] = React.useState<string | null>(ymd(now));
  const list = useMonth(api, groupId, ym, reloadKey);
  const grid = { y: ym.y, m: ym.m, byDate: byDate(list), todayKey: ymd(now), onEvent: (o: CalOccurrence) => onOpen(o as Occurrence), view: groupChip };
  const go = (delta: number) => setYm(({ y, m }) => ({ y: new Date(y, m + delta, 1).getFullYear(), m: new Date(y, m + delta, 1).getMonth() }));
  const body = view === 'list' ? <AgendaList {...grid} focusDate={null} weekTitle={weekTitle} />
    : narrow ? <CompactMonth {...grid} selected={selected} onSelect={setSelected} /> : <MonthGrid {...grid} onMore={() => setView('list')} />;
  return (
    <div className="ui-root cal">
      <style>{CAL_CSS}</style>
      <Bar ym={ym} view={view} narrow={narrow} go={go} today={() => setYm({ y: now.getFullYear(), m: now.getMonth() })} setView={setView} />
      <div className="cal-frame">{body}</div>
    </div>
  );
}
```

The `onEvent` callback receives the same objects the API answered (the calendar passes them back untouched), so the cast to the API `Occurrence` is safe; `groupChip` accepts both shapes (`ChipSource`).

`src/admin/dashboard/grupe/ProgramTab.tsx`:

```tsx
import * as React from 'react';
import { Button, Loading, Section } from '../../ui';
import { IconPlus } from '../../ui/icons';
import type { Occurrence } from '../../../api/calendar-event/services/expand';
import type { GroupPage } from '../../../club/groups/api-types';
import { GRUPE_COPY } from '../../../club/groups/copy';
import type { GroupProgram, ProgramRow } from '../../../club/groups/program-read';
import { writable } from '../../../club/grupe/list-view';
import { todayIso } from '../../../club/groups/http';
import type { GrupeApi } from './api';
import { DatePanel } from './DatePanel';
import { GroupCalendar } from './GroupCalendar';
import { ProgramDrawer } from './ProgramDrawer';
import { useGrupeRefresh } from './undo';

type Drawer = { mode: 'new'; row: null } | { mode: 'change'; row: ProgramRow };

function useProgram(api: GrupeApi, page: GroupPage): { program: GroupProgram | null; reloadKey: number } {
  const [program, setProgram] = React.useState<GroupProgram | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const reload = React.useCallback(() => {
    api.program(page.documentId, page.season?.label ?? null).then(setProgram).catch(() => setProgram({ season: page.season, series: [] }));
    setReloadKey((k) => k + 1);
  }, [api, page.documentId, page.season]);
  React.useEffect(() => reload(), [reload]);
  useGrupeRefresh(reload);
  return { program, reloadKey };
}

function Usual({ program, can, onChange, onAdd }: { program: GroupProgram; can: boolean; onChange: (row: ProgramRow) => void; onAdd: () => void }) {
  return (
    <Section title={GRUPE_COPY.usual}>
      <div className="grp-usual">
        {program.series.map((row) => (
          <div key={row.eventId} className="grp-usual-row">
            <b>{row.text}</b>
            <span className="spv-muted">{GRUPE_COPY.fromDate(row.fromText)}</span>
            {can && <button type="button" className="spv-link" onClick={() => onChange(row)}>{GRUPE_COPY.change}</button>}
          </div>
        ))}
        {can && <Button variant="secondary" size="sm" icon={<IconPlus />} onClick={onAdd}>{GRUPE_COPY.addProgram}</Button>}
      </div>
    </Section>
  );
}

/** Program tab (6.3): the usual program, every date, the program drawer and the date panel. */
export function ProgramTab({ page, api }: { page: GroupPage; api: GrupeApi }) {
  const can = writable(page);
  const { program, reloadKey } = useProgram(api, page);
  const [drawer, setDrawer] = React.useState<Drawer | null>(null);
  const [date, setDate] = React.useState<Occurrence | null>(null);
  if (!program) return <Loading />;
  const isClass = (o: Occurrence) => !program.series.some((s) => s.eventId === o.documentId);
  return (
    <div className="ui-body">
      <Usual program={program} can={can} onChange={(row) => setDrawer({ mode: 'change', row })} onAdd={() => setDrawer({ mode: 'new', row: null })} />
      <GroupCalendar groupId={page.documentId} api={api} reloadKey={reloadKey} onOpen={setDate} />
      {drawer && <ProgramDrawer mode={drawer.mode} row={drawer.row} groupId={page.documentId} api={api} today={todayIso()} onClose={() => setDrawer(null)} />}
      {date && <DatePanel occurrence={date} isClass={isClass(date)} readOnly={!can} api={api} onClose={() => setDate(null)} />}
    </div>
  );
}
```

`todayIso` lives in `src/club/groups/http.ts`, which imports `../birth-date` and `../admin-http` (type) only: pure enough for the admin bundle. If the admin build complains about any server import there, inline `isoDate(todayInBucharest())` from `src/club/birth-date.ts` instead.

Plan 4-6 adds the "Copiază programul din <sezon>" empty state above "Adaugă program" when `page.copyFrom` offers it.

- [ ] **Step 7: Show the Program tab**

In `GroupPage.tsx`: import `ProgramTab`; replace `SHOWN` and the panel list:

```tsx
const SHOWN: readonly GroupTab[] = ['sportivi', 'program', 'istoric'];
```

```tsx
        {tab === 'sportivi' && <RosterTab page={page} api={api} />}
        {tab === 'program' && <ProgramTab page={page} api={api} />}
        {tab === 'istoric' && <GroupHistoryTab api={api} documentId={page.documentId} />}
```

and delete the "Task 6 adds the Program tab" comment.

- [ ] **Step 8: Run the tests and checks**

Run: `npx vitest run src/club/grupe && npx vitest run && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS; zero type errors; checker exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/plugins/component-preview/admin/src/calendar src/admin/dashboard/grupe src/club/grupe/__tests__/admin-grupe.test.ts
git commit -m "feat(grupe): group Program tab with the usual program, the calendar, Program nou, Schimbă and the date panel"
```

---

### Task 7: Boot check on a throwaway Postgres and renders

**Files:** none in the repo. Temporary files in `${TMPDIR:-/tmp}/es45`. PNGs go to `/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/phase4-renders/` with the prefix `4-5-` (not committed by this task; the user reviews them).

**Interfaces:**
- Consumes: everything above, `scripts/fixtures/phase4-shape.js`.
- Proves (spec 12, renders): Grupe (school and Club tabs, past season), "Fără grupă" open with a select open and after "Alocă" with its toast, "Grupă nouă", the group page Sportivi tab with the row menu, the move window, "Adaugă și în grupă", "Adaugă sportivi", the Program tab in Listă and Lună with a cancelled, a moved, a break and a one-class date, "Program nou" with "Se repetă" on and off, "Schimbă programul", the date panel on Anulează and Mută with the e-mail box, the break panel, the toast after a date change, Istoric; each at 1440x900 and 390x844. Compared with `docs/portal/mockups/screens/phase4/grupe-list-*.png` and `grupa-a-*.png`.

Container `es45-pg` on 127.0.0.1:55445, Strapi on 1365. Never 1337, 1340, 3010 or 5432.

- [ ] **Step 1: Checks, Postgres, build, fixture, admin, Strapi**

Run the commands of plan 4-2 Task 8 Steps 1 and 2 with `es42` → `es45`, `55442` → `55445`, `1362` → `1365` (the same env file, fixture, admin user and helpers `idof`, `api`, `py`, `q`), plus `node scripts/admin-ui-check.mjs --strict` and `npx tsc --noEmit -p src/admin/tsconfig.json` in the checks. Then:

```bash
OUT=/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/phase4-renders; mkdir -p "$OUT"
IB=$(idof groups 'Intermediari Bronze')
E=$(api POST "/club/groups/$IB/program" '{"freq":"weekly","days":["sat","sun"],"startTime":"11:00","durationMin":50,"from":"2026-10-04"}' | py "print(d['data']['eventId'])")
api PUT "/club/program/$E/dates/2026-11-14" '{"mode":"cancel","reason":"Competiție la Brașov"}' > /dev/null
api PUT "/club/program/$E/dates/2026-11-21" '{"mode":"move","newDate":"2026-11-21","newStartTime":"12:00"}' > /dev/null
api POST "/club/groups/$IB/program" '{"repeat":false,"date":"2026-11-20","startTime":"18:00","durationMin":60}' > /dev/null
api POST /club/breaks '{"label":"Vacanța de iarnă","startDate":"2026-12-26","endDate":"2027-01-03"}' > /dev/null
api POST /club/groups '{"section":"club","name":"Grupa de pregătire pentru concursurile de iarnă","coachIds":[]}' > /dev/null
```

Expected: every call 200 (the last one a 47-letter group name for the wrap check).

- [ ] **Step 2: Render script**

```bash
cat > "$T/pass.py" <<'PY'
import asyncio, json, sys
from playwright.async_api import async_playwright

B = 'http://127.0.0.1:1365/admin'
IDS = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
GRUPE = B + '/plugins/edusport-grupe'
IB = IDS['groups']['Intermediari Bronze']
SIZES = (('desktop', {'width': 1440, 'height': 900}), ('phone', {'width': 390, 'height': 844}))

def shot(tag, name):
    return f'{OUT}/4-5-{name}-{tag}.png'

async def login(b, state):
    ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
    pg = await ctx.new_page()
    await pg.goto(B + '/auth/login'); await pg.wait_for_timeout(1500)
    await pg.fill('input[name=email]', 'admin@example.com'); await pg.fill('input[name=password]', 'Throwaway123')
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(4000)
    await ctx.storage_state(path=state); await ctx.close()

async def no_side_scroll(pg, r, key):
    r[key] = await pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')

async def list_pages(pg, r, tag):
    await pg.goto(GRUPE + '?section=scoala-afi'); await pg.wait_for_timeout(2500)
    r[f'line_{tag}'] = await pg.locator('.spv-count').first.inner_text()
    await pg.screenshot(path=shot(tag, 'grupe-scoala'), full_page=True)
    await pg.goto(GRUPE + '?section=club'); await pg.wait_for_timeout(2500)
    await no_side_scroll(pg, r, f'club_fits_{tag}')
    await pg.screenshot(path=shot(tag, 'grupe-club'), full_page=True)
    await pg.goto(GRUPE + '?season=2025-2026'); await pg.wait_for_timeout(2500)
    r[f'past_buttons_{tag}'] = await pg.get_by_role('button', name='Grupă nouă').count()
    await pg.screenshot(path=shot(tag, 'grupe-past'), full_page=True)

async def unassigned(pg, r, tag):
    await pg.goto(GRUPE); await pg.wait_for_timeout(2500)
    await pg.get_by_role('button', name='Fără grupă').click(); await pg.wait_for_timeout(1200)
    await pg.screenshot(path=shot(tag, 'fara-grupa'), full_page=True)
    await pg.locator('.grp-ua-row').nth(0).locator('.ui-combo').click(); await pg.wait_for_timeout(500)
    await pg.screenshot(path=shot(tag, 'fara-grupa-select'), full_page=True)
    await pg.keyboard.press('Escape')
    await pg.locator('.grp-ua-row', has_text='Matei Ionescu').get_by_role('button', name='Alocă').click(); await pg.wait_for_timeout(1200)
    r[f'toast_alloc_{tag}'] = await pg.locator('.ui-toast').last.inner_text()
    await pg.screenshot(path=shot(tag, 'alocat-toast'), full_page=True)
    await pg.locator('.ui-toast').last.get_by_role('button', name='Anulează').click(); await pg.wait_for_timeout(1500)

async def new_group(pg, r, tag):
    await pg.goto(GRUPE + '?section=club'); await pg.wait_for_timeout(2500)
    await pg.get_by_role('button', name='Grupă nouă').click(); await pg.wait_for_timeout(800)
    await pg.screenshot(path=shot(tag, 'grupa-noua'), full_page=True)
    await pg.keyboard.press('Escape')

async def roster(pg, r, tag):
    await pg.goto(f'{GRUPE}/{IB}'); await pg.wait_for_timeout(2500)
    await pg.screenshot(path=shot(tag, 'grupa-sportivi'), full_page=True)
    await pg.get_by_role('button', name='Mai multe acțiuni').nth(1).click(); await pg.wait_for_timeout(500)
    r[f'row_menu_{tag}'] = await pg.locator('.spv-menu [role=menuitem]').all_inner_texts()
    await pg.screenshot(path=shot(tag, 'grupa-meniu-rand'))
    await pg.locator('.spv-menu [role=menuitem]', has_text='Mută').click(); await pg.wait_for_timeout(800)
    r[f'move_has_abonament_{tag}'] = await pg.get_by_text('Abonament').count()
    await pg.screenshot(path=shot(tag, 'muta'))
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    await pg.get_by_role('button', name='Adaugă sportivi').click(); await pg.wait_for_timeout(1000)
    await pg.screenshot(path=shot(tag, 'adauga-sportivi'), full_page=True)
    await pg.keyboard.press('Escape')

async def program(pg, r, tag):
    await pg.goto(f'{GRUPE}/{IB}?tab=program'); await pg.wait_for_timeout(2500)
    await pg.get_by_role('button', name='Luna următoare').click(); await pg.wait_for_timeout(1500)
    r[f'chips_{tag}'] = await pg.locator('.cal-ev').all_inner_texts()
    await pg.screenshot(path=shot(tag, 'program-lista'), full_page=True)
    await pg.get_by_role('radio', name='Lună').click(); await pg.wait_for_timeout(800)
    await pg.screenshot(path=shot(tag, 'program-luna'), full_page=True)
    await pg.get_by_role('radio', name='Listă').click(); await pg.wait_for_timeout(500)
    await pg.locator('.cal-ev', has_text='Anulată').first.click(); await pg.wait_for_timeout(800)
    await pg.screenshot(path=shot(tag, 'data-anulata'))
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    await pg.locator('.cal-ev', has_text='Mutată').first.click(); await pg.wait_for_timeout(800)
    await pg.get_by_label('Anunță părinții pe e-mail').check()
    await pg.screenshot(path=shot(tag, 'data-mutata'))
    await pg.keyboard.press('Escape')

async def drawers(pg, r, tag):
    await pg.goto(f'{GRUPE}/{IB}?tab=program'); await pg.wait_for_timeout(2500)
    await pg.get_by_role('button', name='Adaugă program').click(); await pg.wait_for_timeout(800)
    await pg.screenshot(path=shot(tag, 'program-nou'))
    await pg.get_by_label('Se repetă').uncheck(); await pg.wait_for_timeout(300)
    await pg.screenshot(path=shot(tag, 'program-nou-o-data'))
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    await pg.get_by_role('button', name='Schimbă').first.click(); await pg.wait_for_timeout(800)
    await pg.screenshot(path=shot(tag, 'schimba-programul'))
    await pg.keyboard.press('Escape')

async def history(pg, r, tag):
    await pg.goto(f'{GRUPE}/{IB}'); await pg.wait_for_timeout(2500)
    await pg.get_by_role('tab', name='Istoric').click(); await pg.wait_for_timeout(1200)
    r[f'history_{tag}'] = (await pg.locator('.spv-hist li').all_inner_texts())[:3]
    await pg.screenshot(path=shot(tag, 'istoric'), full_page=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        r = {'page_errors': []}
        state = sys.argv[3]
        await login(b, state)
        for tag, size in SIZES:
            ctx = await b.new_context(viewport=size, storage_state=state)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: r['page_errors'].append(str(e)))
            for step in (list_pages, unassigned, new_group, roster, program, drawers, history):
                await step(pg, r, tag)
            await ctx.close()
        for k, v in r.items():
            print(f'{k}: {v}')
        await b.close()

asyncio.run(main())
PY
python3 "$T/pass.py" "$T/ids.json" "$OUT" "$T/state.json"
```

The calendar opens on the current month: if the run date is not in November 2026, replace the single `Luna următoare` click with clicks until the bar shows `Noiembrie 2026` (or set the browser clock with `ctx = await b.new_context(..., timezone_id='Europe/Bucharest')` and Playwright's `page.clock.set_fixed_time` to 2026-11-01). Adjust selectors to the real class names only (read the component); do not change components to fit the script.

Expected:

```
page_errors: []
line_desktop: 4 sportivi în 7 grupe
club_fits_desktop: True
past_buttons_desktop: 0
toast_alloc_desktop: Sportiv alocat în Primii Pași: Matei Ionescu. Anulează
row_menu_desktop: ['Mută', 'Adaugă și în grupă', 'Scoate din grupă']
move_has_abonament_desktop: 0
chips_desktop: (contains) '11:00', '11:00 Anulată: Competiție la Brașov', '12:00 Mutată de la 11:00', '18:00'
history_desktop: (contains) 'Ședința din 21 noiembrie mutată: 21 noiembrie, 12:00.'
(the same keys for phone; club_fits_phone: True)
```

- [ ] **Step 3: Look at the renders**

Open `phase4-renders/4-5-*.png` side by side with `phase4/grupe-list-desktop.png`, `grupe-list-phone.png`, `grupa-a-desktop.png`, `grupa-a-phone.png`. Check: the texts of spec 5 and 6 word for word; no em dash, no middle dot, straight quotes; no pill or circle (count badge and day toggles square; only the spinner round); no dashed or dotted line; "Fără program" and "Fără antrenor" muted; the long group name wraps; phone screens without horizontal scroll; the move window without any abonament text. Show them to the user in the companion. Fixes go into the owning task's files with a `fix(grupe): ...` commit and the affected steps are repeated.

- [ ] **Step 4: Clean up**

```bash
kill "$(cat "$T/pid")"
docker rm -f es45-pg
rm -rf "$T"
```

Expected: container removed. The PNGs stay in the frontend repo for the user.

---

## Interfaces for other plans

- **Plan 4-6:** `DatePanel({ occurrence, isClass, readOnly, api, onClose, groupLink })` and `useGrupeApi` (`src/admin/dashboard/grupe/`); `groupPageTo` (`src/club/grupe/routes.ts`); `PanelShell`, `WindowShell`, `undoToast`, `grupeChanged`, `useGrupeRefresh`, `GRUPE_CSS`; `RosterTab` (empty roster) and `ProgramTab` (`Usual`) are where the "Copiază ... din <sezon>" empty states go; `CalendarView` accepts `view` and optional `onAddOn` (the general calendar's group chips use `view`).

## Self-review

- **Spec coverage.** 5.1 menu and routes (T3); 5.2 title, actions, season select, tabs with counts, count line with forms, four columns with "Fără program" / "Fără antrenor", row opens the group, phone cards, past season read-only (T1, T3); 5.3 the orange button and count, hidden at 0, desktop dropdown / phone sheet, rows (name, source, select with the proposal, "Alocă"), "Alocă toți", toasts with undo (T1, T4); 5.4 the group window fields, buttons, toasts, opening on Program (T3); 6.1 header, subtitle, "..." with Editează / Șterge grupa and its rule, tabs with counts, phone sheet, season from the address (T1, T5, T6); 6.2 bar, columns, cells, phone cards, row menu, the move window without abonament, "Adaugă și în grupă", "Scoate din grupă", "Adaugă sportivi" (T1, T5); 6.3 Program obișnuit, the calendar in Listă / Lună with month navigation and "Azi", chips (normal, cancelled, moved, break), Program nou (Se repetă on / off, Cât de des, Săptămâna din lună, Zile, De la, Durată, Se aplică din, Data, Notă), Schimbă (prefilled, Se aplică din, Șterge programul), the date panel (Ține / Anulează / Mută, Data nouă, De la, Motiv, the e-mail box unticked, Șterge ședința, read-only break), toasts (T2, T6); 6.4 Istoric (T5); 11 copy and design rules (T1, T3 checker, T7 renders); 12 UI source tests and renders (T3 to T7).
- **Placeholder scan:** code in every code step; the Task 3 `GroupPage` stub is complete code that Task 5 replaces; the conditional notes (the occurrences response shape, the 30-line splits, `todayIso` in the admin bundle, the calendar month in the render script) each say exactly what to do.
- **Type consistency:** `GrupeApi` methods match the plan 4-1 / 4-2 routes and their `ActionBody` answers; `ChipSource` (T2) accepts both occurrence types used in T6; `ProgramForm`, `DateForm` (T2) are the drawer and panel state (T6); `SectionTab.documentId` (plan 4-1) feeds `GroupDialog`'s `sectionId`.
- **Review Focus:** past season (T1 `writable`, T3, T5, T6 source tests, T7), undo after the screen moved on (T3 `grupeChanged`, T7), long names and phone width (T7), double clicks (`loading` busy buttons, T4 to T6 source tests), break and moved date panels (T2, T7).
