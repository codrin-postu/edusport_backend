# Phase 4-6: Admin "Calendar și serii" (Pauze, group events) and the New-Season Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the admin side of phase 4: the "Pauze" section at the top of "Calendar și serii" (table, cards, window, edit, delete), the "Serii de cursuri Școala de Patinaj" section removed, the general calendar reading the admin occurrences route with group events shown as "<ora> <grupă>" and opening the group date panel with "Deschide grupa", "Școala de patinaj" no longer offered for new events; on Sezoane, the "Începe sezonul <next>" button and its three-step window with preview, toast and undo; on the group page, the empty-tab states "Copiază sportivii / programul din <sezon>".

**Architecture:** Rules in pure modules (`src/club/calendar/pauze-view.ts`, `src/club/groups/new-season/window-view.ts`, strings in `src/club/groups/copy/calendar-ui.ts`) with Vitest tests; React components in `src/admin/dashboard/program/` (Pauze) and `src/admin/pages/sezoane/` (new-season window) plus small edits to `ProgramEditPage.tsx`, `ProgramOverviewEditor.tsx`, the calendar model and drawer, `SezoanePage.tsx`, and the plan 4-5 group page tabs, each pinned by source-reading tests. The screens call the plan 4-2 break and occurrence routes and the plan 4-3 new-season routes; undo goes through plan 4-1's `POST /club/undo` with plan 4-5's `undoToast`. A boot check renders every screen at 1440x900 and 390x844 for comparison with the approved mockups `pauze-a` and `sezon-nou-a`.

**Tech Stack:** React 18 (Strapi 5.52.1 admin), the shared admin UI, Vitest 3, Python Playwright, Postgres 16.

**Spec:** `docs/superpowers/specs/2026-10-27-groups-schedules-design.md` (v1.1), sections 7 (all), 10.1, 10.2, 10.5 (toast), 10.6 (empty states), 11, 12; mockups `/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/phase4/pauze-a.html` (chosen), `sezon-nou-a.html` (chosen). Decisions: `../edusport_frontend/docs/portal/DECISIONS.md`. Agent rules: `.superpowers/phase3-shared/agent-rules.md`. Index: `docs/superpowers/plans/2026-10-27-phase4-index.md`.

**Base:** `feat/athletes` with plans 4-1, 4-2, 4-3 and 4-5 merged (this plan edits plan 4-5's `DatePanel`, `RosterTab`, `ProgramTab`, `api.ts`).

**Parallel groups:** A: T1 | B: T2, T3, T4 | C: T5 | D: T6

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Pure views and copy | plans 4-1 to 4-5 | pauze-view.ts, window-view.ts, copy/calendar-ui.ts, copy.ts |
| B | 2 Pauze and the page, 3 General calendar, 4 Sezoane window | 1 | 2: ProgramEditPage.tsx, program/*; 3: ProgramOverviewEditor.tsx, calendar/model.ts, calendar/EventDrawer.tsx, grupe/DatePanel.tsx; 4: SezoanePage.tsx, sezoane/NewSeasonDialog.tsx, sezoane/useNewSeason.ts |
| C | 5 Group empty-tab copies | 1 | grupe/api.ts, RosterTab.tsx, ProgramTab.tsx |
| D | 6 Boot check and renders | everything | no repo files |

## Decided while planning (low impact, decided by Claude; the user may overrule any line)

Log them in DECISIONS.md as "plan 4-6, decided by Claude (low impact, 2026-10-27)".

1. **"Calendar și serii" keeps its title "Program" and subtitle** (as in mockup pauze-a); the page loses its save bar (only the removed "Serii" section used it); `program.scheduleGroups` stays in the database untouched (W18).
2. **Pauze delete confirmation**: title "Șterge", message "Ștergi pauza "<nume>"?", button "Șterge" (spec 7.1 gives the message only).
3. **A group event in the general calendar** opens the plan 4-5 date panel (with "Șterge ședința" for one class, read through the existing read route `GET /api/calendar/events/:id`) plus the link "Deschide grupa"; the panel is read-only for a past season's date.
4. **Step 2 refreshes its summary and the children's main group** by asking `POST .../start/preview` 300 ms after the last tick change; step 3 shows the same answer.
5. **After "Începe sezonul"** Grupe opens on the new season (spec 10.5) and the toast is shown there; if the user stays on Sezoane by closing the window early, nothing was written.
6. **"Începe sezonul" on phones** sits under the season name in the row (spec 10.1); the click never opens the row's edit panel.

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes`. Commit only in the worktree your dispatch names; check `git rev-parse --show-toplevel` and `git branch --show-current` before every commit.
- A dated entry in `edusport_frontend/docs/portal/DECISIONS.md` wins over the spec; an approved mockup wins over older mockups; this plan's code is followed verbatim unless it fails (fix the minimum, say what and why).
- Checks after every task: the task's tests, `npx vitest run`, `npx tsc --noEmit`, `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict` (exit 0).
- Code: TypeScript, no `any`, single quotes in `src/`, functions under 30 lines (split components), complexity under 10, no dead code. Pure modules import no React, Strapi or Node.
- Design (binding): admin tokens only, no raw colours, no dashed or dotted lines, no pills or circles (square checkboxes), phone width 390 px without horizontal scroll, no backtick inside a CSS string. Match existing components from their source.
- Copy: every string in the `copy/` files (`calendar-ui.ts` here; `new-season.ts` of plan 4-3; `grupe-ui.ts`, `schedule.ts`, `core.ts`); Romanian, terse, straight quotes, no em dash, no middle dot.
- Toasts with undo: plan 4-5's `undoToast` (8 s, "Anulează", no X).
- Synthetic data only. Never production, `strapi_app` / `strapi_db`, 1337, 5432, 1340, 3010, `edusport-test-pg`. Task 6 uses container `es46-pg` on 127.0.0.1:55446 and Strapi on 1366.
- Commits: Conventional Commits, exactly the message in the task, no `Co-Authored-By`, no AI attribution. Never push.
- Progress board: `printf '%s | 4-6 T<n> | implementer | <status>\n' "$(date -u +%H:%M)" >> /Users/codrin/Documents/Programming/edusport_backend/.superpowers/phase3-shared/progress-board.md`.

## Review Focus

- **The header ticks of step 2** with mixed rows, disabled rows (0 sportivi, "Fără program", "Are program în <next>") and unticked children: ticking a header ticks only enabled rows; ticking a group's "Copiază sportivii" ticks its active children again; children are disabled while the group is unticked. Pinned by Task 1 (`window-view` tests) and Task 6 renders.
- **Two quick clicks on "Începe sezonul 2027-2028"**: one request (busy button); a stale window (another admin started the season) shows "Sezonul curent s-a schimbat. Reîncarcă pagina." and writes nothing. Pinned by Task 4 source test (`loading=`) and Task 6.
- **A break whose "Până la" is before "De la"**: the window shows "Data de sfârșit trebuie să fie după data de început." before sending; the server says the same if it is sent anyway. Pinned by Task 1 (`breakFormError`) and Task 6.
- **A group event in the general calendar after this plan**: never opens the old event drawer (whose save the server now refuses with 409), always the group date panel. Pinned by Task 3 source test and Task 6.
- **Empty tabs on a past season** or when the previous season has nothing: no copy buttons, the normal empty state. Pinned by Task 5 source test (`copyFrom` and `writable`) and plan 4-3's `copyFromFor` tests.

---

## File Structure

```
src/club/groups/copy/calendar-ui.ts      PAUZE_COPY (T1)
src/club/groups/copy.ts                  + export * from './copy/calendar-ui' (T1)
src/club/calendar/pauze-view.ts          BreakDraft, breakRows, breakPhoneLine, emptyBreakDraft, draftOfBreak, breakFormError, breakBody (T1)
src/club/groups/new-season/window-view.ts  Ticks, initialTicks, headerState, setSection, toggleGroup, toggleChild, startBody, inLine, programCell, childMain (T1)
src/club/__tests__/phase4-views.test.ts  (T1); src/club/__tests__/admin-phase4-calendar.test.ts (T2 to T5, source reading)
src/admin/dashboard/ProgramEditPage.tsx  Pauze on top, Calendar, no Serii, no save bar (T2)
src/admin/dashboard/program/PauzeSection.tsx, BreakDialog.tsx, useBreaks.ts   (T2)
src/plugins/component-preview/admin/src/ProgramOverviewEditor.tsx   admin occurrences, group events open the date panel (T3)
src/plugins/component-preview/admin/src/calendar/model.ts           occView group chips, NEW_EVENT_CATEGORY_OPTIONS (T3)
src/plugins/component-preview/admin/src/calendar/EventDrawer.tsx    new events without "Școala de patinaj" (T3)
src/admin/dashboard/grupe/DatePanel.tsx  occurrence prop typed by the fields it reads (T3)
src/admin/pages/SezoanePage.tsx, sezoane/NewSeasonDialog.tsx, sezoane/NewSeasonSteps.tsx, sezoane/useNewSeason.ts  (T4)
src/admin/dashboard/grupe/api.ts, RosterTab.tsx, ProgramTab.tsx    copy-members / copy-program (T5)
```

---

### Task 1: Pure views and the copy

**Files:**
- Create: `src/club/groups/copy/calendar-ui.ts`, `src/club/calendar/pauze-view.ts`, `src/club/groups/new-season/window-view.ts`
- Modify: `src/club/groups/copy.ts` (one export line)
- Test: `src/club/__tests__/phase4-views.test.ts`

**Interfaces:**
- Consumes: plan 4-1 (`BreakRecord`, `shortDate`, `isIsoDate`, `athletesText`), plan 4-2 (`SCHEDULE_ERRORS`), plan 4-3 (`StartData`, `StartSection`, `StartGroup`, `StartAthlete`, `StartRequest`, `ChildMain`, `NEW_SEASON_COPY`).
- Produces:
  - `PAUZE_COPY` (section, button, columns, menu, window titles, hint, delete confirmation).
  - `BreakDraft = { label; startDate; endDate }`, `breakRows(list)` (sorted by "De la", dates "20 dec 2026"), `breakPhoneLine(b)` ("20 dec 2026 - 7 ian 2027"), `emptyBreakDraft()`, `draftOfBreak(b)`, `breakFormError(d)`, `breakBody(d)`.
  - `Ticks = Record<groupId, { members: boolean; program: boolean; excluded: string[] }>`, `initialTicks(data)`, `membersEnabled(g)`, `programEnabled(g)`, `headerState(section, ticks, key)` (`{ checked, indeterminate, disabled }`), `setSection(section, ticks, key, on)`, `toggleGroup(ticks, group, key)`, `toggleChild(ticks, groupId, athleteId)`, `startBody(data, ticks): StartRequest`, `inLine(group)` ("10 sportivi, 1 inactiv"), `programCell(group, next)` (the list text, "Fără program" or "Are program în <next>"), `childMain(child, groupId, mains, current)` (`{ main; note }`).

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/phase4-views.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { breakBody, breakFormError, breakPhoneLine, breakRows, draftOfBreak } from '../calendar/pauze-view';
import type { StartData } from '../groups/new-season/start-data';
import { childMain, headerState, initialTicks, inLine, programCell, setSection, startBody, toggleChild, toggleGroup } from '../groups/new-season/window-view';

const BREAKS = [{ id: 'b2', label: 'Vacanța de primăvară', startDate: '2027-04-03', endDate: '2027-04-11' }, { id: 'b1', label: 'Vacanța de iarnă', startDate: '2026-12-20', endDate: '2027-01-07' }];

describe('Pauze (7.1)', () => {
  it('rows by De la with short dates; the phone line', () => {
    expect(breakRows(BREAKS).map((r) => [r.label, r.from, r.to])).toEqual([['Vacanța de iarnă', '20 dec 2026', '7 ian 2027'], ['Vacanța de primăvară', '3 apr 2027', '11 apr 2027']]);
    expect(breakPhoneLine(BREAKS[1])).toBe('20 dec 2026 - 7 ian 2027');
  });

  it('the window needs a name and an end not before the start', () => {
    expect(breakFormError({ label: 'X', startDate: '2026-12-20', endDate: '2026-12-19' })).toBe('Data de sfârșit trebuie să fie după data de început.');
    expect(breakFormError({ label: ' ', startDate: '2026-12-20', endDate: '2026-12-21' })).toBe('Completați numele.');
    expect(breakFormError(draftOfBreak(BREAKS[0]))).toBeNull();
    expect(breakBody({ label: ' Iarnă ', startDate: '2026-12-20', endDate: '2026-12-20' })).toEqual({ label: 'Iarnă', startDate: '2026-12-20', endDate: '2026-12-20' });
  });
});

const child = (athleteId: string, inactive = false) => ({ athleteId, name: athleteId, age: 12, inactive, currentMainGroupId: 'g-pro' });
const DATA: StartData = {
  current: { documentId: 's26', label: '2026-2027' }, target: { documentId: 's27', label: '2027-2028', fee: 200 }, seriesFrom: '2027-10-01', seriesTo: '2028-05-31',
  sections: [
    { sectionId: 'afi', label: 'Școala de patinaj', groups: [
      { groupId: 'g-ib', name: 'Intermediari Bronze', members: 2, inactive: 0, program: 'Sâ, Du 11:00', programState: 'ok', defaultMembers: false, defaultProgram: true, athletes: [child('a1'), child('a4')] },
      { groupId: 'g-pp', name: 'Primii Pași', members: 0, inactive: 0, program: '', programState: 'none', defaultMembers: false, defaultProgram: false, athletes: [] },
    ] },
    { sectionId: 'club', label: 'Club', groups: [
      { groupId: 'g-pro', name: 'Profesioniști', members: 3, inactive: 1, program: 'Ma, Jo 18:00', programState: 'exists', defaultMembers: true, defaultProgram: false, athletes: [child('a1'), child('a2'), child('a3', true)] },
    ] },
  ],
};

describe('step 2 ticks (10.2, W26)', () => {
  it('default ticks; header states with mixed and disabled rows', () => {
    const ticks = initialTicks(DATA);
    expect(ticks['g-pro']).toEqual({ members: true, program: false, excluded: [] });
    expect(headerState(DATA.sections[0], ticks, 'program')).toEqual({ checked: true, indeterminate: false, disabled: false });
    expect(headerState(DATA.sections[0], ticks, 'members')).toEqual({ checked: false, indeterminate: false, disabled: false });
    expect(headerState(DATA.sections[1], ticks, 'program')).toEqual({ checked: false, indeterminate: false, disabled: true });
    const mixed = setSection(DATA.sections[0], ticks, 'members', true);
    expect([mixed['g-ib'].members, mixed['g-pp'].members]).toEqual([true, false]);
  });

  it('unticking a child applies to that group only; ticking the group ticks every child again', () => {
    let ticks = toggleChild(initialTicks(DATA), 'g-pro', 'a1');
    expect(ticks['g-pro'].excluded).toEqual(['a1']);
    ticks = toggleGroup(toggleGroup(ticks, DATA.sections[1].groups[0], 'members'), DATA.sections[1].groups[0], 'members');
    expect(ticks['g-pro']).toEqual({ members: true, program: false, excluded: [] });
  });

  it('the request carries every group of every section', () => {
    expect(startBody(DATA, initialTicks(DATA))).toEqual({ groups: [
      { groupId: 'g-ib', copyMembers: false, copyProgram: true, excludeAthleteIds: [] },
      { groupId: 'g-pp', copyMembers: false, copyProgram: false, excludeAthleteIds: [] },
      { groupId: 'g-pro', copyMembers: true, copyProgram: false, excludeAthleteIds: [] },
    ] });
  });

  it('row texts and the children main group lines', () => {
    expect(inLine(DATA.sections[1].groups[0])).toBe('3 sportivi, 1 inactiv');
    expect([programCell(DATA.sections[0].groups[0], '2027-2028'), programCell(DATA.sections[0].groups[1], '2027-2028'), programCell(DATA.sections[1].groups[0], '2027-2028')])
      .toEqual(['Sâ, Du 11:00', 'Fără program', 'Are program în 2027-2028']);
    const mains = { a1: { groupId: 'g-pro', groupName: 'Profesioniști', previousName: 'Intermediari Bronze', kept: false }, a2: { groupId: 'g-pro', groupName: 'Profesioniști', previousName: 'Profesioniști', kept: true } };
    expect(childMain(child('a1'), 'g-ib', mains, '2026-2027')).toEqual({ main: 'Profesioniști', note: 'în 2026-2027: Intermediari Bronze, care nu se copiază' });
    expect(childMain(child('a2'), 'g-ib', mains, '2026-2027')).toEqual({ main: 'Profesioniști', note: 'ca în 2026-2027' });
    expect(childMain(child('a2'), 'g-pro', mains, '2026-2027')).toEqual({ main: 'Profesioniști', note: null });
    expect(childMain(child('a9'), 'g-ib', mains, '2026-2027')).toEqual({ main: 'Fără grupă', note: null });
    expect(childMain(child('a3', true), 'g-pro', mains, '2026-2027')).toEqual({ main: '', note: 'Inactiv, nu se copiază' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/phase4-views.test.ts`
Expected: FAIL (`Cannot find module '../calendar/pauze-view'`).

- [ ] **Step 3: Write `copy/calendar-ui.ts` and its export**

```ts
/** "Calendar și serii": the Pauze section and its window (spec 7.1). */
export const PAUZE_COPY = {
  section: 'Pauze',
  add: 'Adaugă pauză',
  colName: 'Nume',
  colFrom: 'De la',
  colTo: 'Până la',
  menu: 'Mai multe acțiuni',
  edit: 'Editează',
  remove: 'Șterge',
  removeConfirm: (label: string) => `Ștergi pauza "${label}"?`,
  windowNew: 'Pauză nouă',
  windowEdit: 'Editează pauza',
  hint: 'Nicio ședință a grupelor în aceste zile.',
  cancel: 'Anulează',
  save: 'Salvează',
  calendar: 'Calendar',
  autosave: 'se salvează automat',
} as const;
```

`src/club/groups/copy.ts`, add `export * from './copy/calendar-ui';`.

- [ ] **Step 4: Write `pauze-view.ts` and `window-view.ts`**

`src/club/calendar/pauze-view.ts`:

```ts
import { GROUP_ERRORS, SCHEDULE_ERRORS } from '../groups/copy';
import { isIsoDate, shortDate } from '../groups/dates';
import type { BreakRecord } from '../groups/types';

/** Pauze (spec 7.1). Pure. */
export type BreakDraft = { label: string; startDate: string; endDate: string };

export const breakRows = (list: BreakRecord[]): (BreakRecord & { from: string; to: string })[] =>
  [...list].sort((a, b) => a.startDate.localeCompare(b.startDate)).map((b) => ({ ...b, from: shortDate(b.startDate), to: shortDate(b.endDate) }));
export const breakPhoneLine = (b: BreakRecord): string => `${shortDate(b.startDate)} - ${shortDate(b.endDate)}`;
export const emptyBreakDraft = (): BreakDraft => ({ label: '', startDate: '', endDate: '' });
export const draftOfBreak = (b: BreakRecord): BreakDraft => ({ label: b.label, startDate: b.startDate, endDate: b.endDate });

export function breakFormError(d: BreakDraft): string | null {
  if (!d.label.trim()) return GROUP_ERRORS.nameRequired;
  if (!isIsoDate(d.startDate) || !isIsoDate(d.endDate)) return GROUP_ERRORS.invalid;
  return d.endDate < d.startDate ? SCHEDULE_ERRORS.endBeforeStart : null;
}

export const breakBody = (d: BreakDraft): BreakDraft => ({ label: d.label.trim(), startDate: d.startDate, endDate: d.endDate });
```

`src/club/groups/new-season/window-view.ts`:

```ts
import { GRUPE_COPY, NEW_SEASON_COPY, athletesText } from '../copy';
import type { StartRequest } from './plan';
import type { ChildMain } from './preview';
import type { StartAthlete, StartData, StartGroup, StartSection } from './start-data';

/** Step 2 of "Începe sezonul" (10.2, W26). Pure. */
export type Tick = { members: boolean; program: boolean; excluded: string[] };
export type Ticks = Record<string, Tick>;
export type TickKey = 'members' | 'program';

export const membersEnabled = (g: StartGroup): boolean => g.members > 0;
export const programEnabled = (g: StartGroup): boolean => g.programState === 'ok';
const enabled = (g: StartGroup, key: TickKey): boolean => (key === 'members' ? membersEnabled(g) : programEnabled(g));

export const initialTicks = (data: StartData): Ticks =>
  Object.fromEntries(data.sections.flatMap((s) => s.groups).map((g) => [g.groupId, { members: g.defaultMembers, program: g.defaultProgram, excluded: [] }]));

export function headerState(section: StartSection, ticks: Ticks, key: TickKey): { checked: boolean; indeterminate: boolean; disabled: boolean } {
  const rows = section.groups.filter((g) => enabled(g, key));
  const on = rows.filter((g) => ticks[g.groupId]?.[key]).length;
  return { checked: rows.length > 0 && on === rows.length, indeterminate: on > 0 && on < rows.length, disabled: rows.length === 0 };
}

export function setSection(section: StartSection, ticks: Ticks, key: TickKey, on: boolean): Ticks {
  const next = { ...ticks };
  for (const g of section.groups.filter((x) => enabled(x, key))) next[g.groupId] = { ...next[g.groupId], [key]: on, excluded: key === 'members' && on ? [] : next[g.groupId].excluded };
  return next;
}

/** Ticking "Copiază sportivii" ticks every active child again (W26). */
export function toggleGroup(ticks: Ticks, g: StartGroup, key: TickKey): Ticks {
  const t = ticks[g.groupId];
  const on = !t[key];
  return { ...ticks, [g.groupId]: { ...t, [key]: on, excluded: key === 'members' && on ? [] : t.excluded } };
}

export function toggleChild(ticks: Ticks, groupId: string, athleteId: string): Ticks {
  const t = ticks[groupId];
  const excluded = t.excluded.includes(athleteId) ? t.excluded.filter((id) => id !== athleteId) : [...t.excluded, athleteId];
  return { ...ticks, [groupId]: { ...t, excluded } };
}

export const startBody = (data: StartData, ticks: Ticks): StartRequest => ({
  groups: data.sections.flatMap((s) => s.groups).map((g) => ({
    groupId: g.groupId, copyMembers: ticks[g.groupId].members, copyProgram: ticks[g.groupId].program, excludeAthleteIds: ticks[g.groupId].excluded,
  })),
});

/** "10 sportivi, 1 inactiv" (the "În <sezon>" column). */
export const inLine = (g: StartGroup): string => `${athletesText(g.members)}${g.inactive ? NEW_SEASON_COPY.inactiveSuffix(g.inactive) : ''}`;

export function programCell(g: StartGroup, next: string): string {
  if (g.programState === 'exists') return NEW_SEASON_COPY.hasProgram(next);
  return g.programState === 'none' ? NEW_SEASON_COPY.noProgram : g.program;
}

/** "Grupa principală în <next>" of one child in one group's list, with the muted second line when useful. */
export function childMain(child: StartAthlete, groupId: string, mains: Record<string, ChildMain>, current: string): { main: string; note: string | null } {
  if (child.inactive) return { main: '', note: NEW_SEASON_COPY.childInactive };
  const m = mains[child.athleteId];
  if (!m) return { main: NEW_SEASON_COPY.childNoGroup, note: null };
  if (m.kept) return { main: m.groupName, note: m.groupId === groupId ? null : NEW_SEASON_COPY.childKept(current) };
  return { main: m.groupName, note: m.previousName ? NEW_SEASON_COPY.childChanged(current, m.previousName) : null };
}

export { GRUPE_COPY };
```

Remove the last line (`export { GRUPE_COPY };`) if nothing imports it from here (nothing in this plan does).

- [ ] **Step 5: Run the tests and checks**

Run: `npx vitest run src/club/__tests__/phase4-views.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 6: Commit**

```bash
git add src/club/groups/copy/calendar-ui.ts src/club/groups/copy.ts src/club/calendar/pauze-view.ts src/club/groups/new-season/window-view.ts src/club/__tests__/phase4-views.test.ts
git commit -m "feat(calendar): pure views for Pauze and the new-season window"
```

---

### Task 2: Pauze section, "Serii de cursuri" removed

**Files:**
- Create: `src/admin/dashboard/program/useBreaks.ts`, `PauzeSection.tsx`, `BreakDialog.tsx`
- Modify: `src/admin/dashboard/ProgramEditPage.tsx` (whole file)
- Modify: `scripts/admin-ui-check.mjs` (`dashboard/program` in `RULED_DIRS`)
- Test: `src/club/__tests__/admin-phase4-calendar.test.ts`

**Interfaces:**
- Consumes: Task 1; plan 4-2 routes `/api/club/breaks`; `MenuButton`, `ConfirmDialog`, `DataTable`, `WindowShell` (plan 4-5), `requestErrorText`, `SCHEDULE_TOASTS.breakSaved`, `.breakDeleted`.
- Produces: `useBreaks()` (`list`, `save(id | null, draft)`, `remove(id)`, `failed`), `PauzeSection`, `BreakDialog({ target: BreakRecord | null, onClose, onSave })`; `ProgramEditPage` = header, Pauze, Calendar (no Serii, no save bar).

- [ ] **Step 1: Write the failing source test**

`src/club/__tests__/admin-phase4-calendar.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const source = (p: string) => readFileSync(join(SRC, p), 'utf8');

describe('Calendar și serii (7.1, 7.3)', () => {
  const page = source('admin/dashboard/ProgramEditPage.tsx');
  const section = source('admin/dashboard/program/PauzeSection.tsx');
  const dialog = source('admin/dashboard/program/BreakDialog.tsx');

  it('Pauze comes first, then the Calendar; the "Serii de cursuri" editor and its save bar are gone', () => {
    expect(page.indexOf('<PauzeSection')).toBeGreaterThan(-1);
    expect(page.indexOf('<PauzeSection')).toBeLessThan(page.indexOf('<ProgramOverviewEditor'));
    expect(page).not.toMatch(/ScheduleGroupsInner|Serii de cursuri|<SaveBar/);
  });

  it('the section: Adaugă pauză, Nume / De la / Până la, Editează and a red Șterge with its confirmation, cards on phones', () => {
    for (const s of ['PAUZE_COPY.add', 'PAUZE_COPY.colName', 'PAUZE_COPY.colFrom', 'PAUZE_COPY.colTo', 'PAUZE_COPY.edit', 'PAUZE_COPY.remove', 'PAUZE_COPY.removeConfirm', 'breakRows', 'breakPhoneLine', 'spv-danger']) expect(section, s).toContain(s);
  });

  it('the window: Nume, De la, Până la, the hint, Anulează / Salvează, the date order checked first, toasts', () => {
    for (const s of ['PAUZE_COPY.windowNew', 'PAUZE_COPY.windowEdit', 'PAUZE_COPY.hint', 'breakFormError', 'SCHEDULE_TOASTS.breakSaved', 'loading=']) expect(dialog, s).toContain(s);
    expect(section).toContain('SCHEDULE_TOASTS.breakDeleted');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/admin-phase4-calendar.test.ts`
Expected: FAIL (`ENOENT ... PauzeSection.tsx`).

- [ ] **Step 3: Write `useBreaks.ts`, `BreakDialog.tsx`, `PauzeSection.tsx`**

`src/admin/dashboard/program/useBreaks.ts`:

```ts
import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { BreakDraft } from '../../../club/calendar/pauze-view';
import type { BreakRecord } from '../../../club/groups/types';

const BASE = '/api/club/breaks';

/** Pauze (routes of plan 4-2). `save` and `remove` throw the server's message. */
export function useBreaks() {
  const client = useFetchClient();
  const ref = React.useRef(client);
  ref.current = client;
  const [list, setList] = React.useState<BreakRecord[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const reload = React.useCallback(async () => {
    try {
      setList(((await ref.current.get(BASE)) as { data: { data: BreakRecord[] } }).data.data);
    } catch {
      setFailed(true);
    }
  }, []);
  React.useEffect(() => {
    void reload();
  }, [reload]);
  const save = async (id: string | null, d: BreakDraft) => {
    await (id ? ref.current.put(`${BASE}/${encodeURIComponent(id)}`, d) : ref.current.post(BASE, d));
    await reload();
  };
  const remove = async (id: string) => {
    await ref.current.del(`${BASE}/${encodeURIComponent(id)}`);
    await reload();
  };
  return { list, failed, save, remove };
}

export type Breaks = ReturnType<typeof useBreaks>;
```

`src/admin/dashboard/program/BreakDialog.tsx`:

```tsx
import * as React from 'react';
import { Button, DateInput, Field, FieldRow, Input, Notice, adminToast } from '../../ui';
import { breakBody, breakFormError, draftOfBreak, emptyBreakDraft, type BreakDraft } from '../../../club/calendar/pauze-view';
import { GROUP_ERRORS, PAUZE_COPY, SCHEDULE_TOASTS } from '../../../club/groups/copy';
import type { BreakRecord } from '../../../club/groups/types';
import { requestErrorText } from '../../../club/registration-panel';
import { WindowShell } from '../grupe/PanelShell';
import type { Breaks } from './useBreaks';

type Props = { target: BreakRecord | null; breaks: Breaks; onClose: () => void };

/** "Pauză nouă" / "Editează pauza" (7.1); a sheet on phones. */
export function BreakDialog({ target, breaks, onClose }: Props) {
  const [draft, setDraft] = React.useState<BreakDraft>(() => (target ? draftOfBreak(target) : emptyBreakDraft()));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submit = async () => {
    const invalid = breakFormError(draft);
    if (invalid) return setError(invalid);
    setBusy(true);
    try {
      await breaks.save(target?.id ?? null, breakBody(draft));
      adminToast.success(SCHEDULE_TOASTS.breakSaved);
      onClose();
    } catch (err) {
      setError(requestErrorText(err, GROUP_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  const footer = <><Button variant="ghost" onClick={onClose} disabled={busy}>{PAUZE_COPY.cancel}</Button><Button loading={busy} onClick={() => void submit()}>{PAUZE_COPY.save}</Button></>;
  return (
    <WindowShell title={target ? PAUZE_COPY.windowEdit : PAUZE_COPY.windowNew} onClose={onClose} footer={footer} size="sm">
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label={PAUZE_COPY.colName}><Input value={draft.label} maxLength={120} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></Field>
      <FieldRow>
        <Field label={PAUZE_COPY.colFrom}><DateInput value={draft.startDate || null} onChange={(v) => setDraft({ ...draft, startDate: v ?? '' })} /></Field>
        <Field label={PAUZE_COPY.colTo}><DateInput value={draft.endDate || null} onChange={(v) => setDraft({ ...draft, endDate: v ?? '' })} /></Field>
      </FieldRow>
      <p className="ui-hint">{PAUZE_COPY.hint}</p>
    </WindowShell>
  );
}
```

`src/admin/dashboard/program/PauzeSection.tsx`:

```tsx
import * as React from 'react';
import { Button, DataTable, Loading, Notice, Section, adminToast, useIsPhone, type DataColumn } from '../../ui';
import { IconPlus } from '../../ui/icons';
import { ConfirmDialog } from '../../ConfirmDialog';
import { MenuButton } from '../SubmissionTable';
import { breakPhoneLine, breakRows } from '../../../club/calendar/pauze-view';
import { GROUP_ERRORS, PAUZE_COPY, SCHEDULE_TOASTS } from '../../../club/groups/copy';
import type { BreakRecord } from '../../../club/groups/types';
import { requestErrorText } from '../../../club/registration-panel';
import { BreakDialog } from './BreakDialog';
import { useBreaks, type Breaks } from './useBreaks';

type Row = BreakRecord & { from: string; to: string };
type Pick = (b: BreakRecord, what: 'edit' | 'delete') => void;

function RowMenu({ row, onPick }: { row: BreakRecord; onPick: Pick }) {
  const [open, setOpen] = React.useState(false);
  const pick = (what: 'edit' | 'delete') => { setOpen(false); onPick(row, what); };
  const label = <><span aria-hidden="true">...</span><span className="ui-sr">{PAUZE_COPY.menu}</span></>;
  return (
    <MenuButton label={label} open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="spv-menu" placement="bottom-end" role="menu" chevron={false}>
      <button type="button" role="menuitem" onClick={() => pick('edit')}>{PAUZE_COPY.edit}</button>
      <button type="button" role="menuitem" className="spv-danger" onClick={() => pick('delete')}>{PAUZE_COPY.remove}</button>
    </MenuButton>
  );
}

const columns = (onPick: Pick): DataColumn<Row>[] => [
  { key: 'label', header: PAUZE_COPY.colName, render: (r) => <span className="spv-name">{r.label}</span> },
  { key: 'from', header: PAUZE_COPY.colFrom, render: (r) => r.from },
  { key: 'to', header: PAUZE_COPY.colTo, render: (r) => r.to },
  { key: 'menu', header: <span className="ui-sr">{PAUZE_COPY.menu}</span>, align: 'right', render: (r) => <RowMenu row={r} onPick={onPick} /> },
];

function BreakList({ rows, onPick }: { rows: Row[]; onPick: Pick }) {
  if (!useIsPhone()) return <DataTable<Row> columns={columns(onPick)} rows={rows} getRowKey={(r) => r.id} pageSize={0} />;
  return (
    <ul className="spv-cards">
      {rows.map((r) => (
        <li key={r.id} className="spv-card"><span className="spv-name">{r.label}</span><span>{breakPhoneLine(r)}</span><RowMenu row={r} onPick={onPick} /></li>
      ))}
    </ul>
  );
}

function useRemove(breaks: Breaks, done: () => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (b: BreakRecord) => {
    setBusy(true);
    try {
      await breaks.remove(b.id);
      adminToast.success(SCHEDULE_TOASTS.breakDeleted);
      done();
    } catch (err) {
      setError(requestErrorText(err, GROUP_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** "Pauze" at the top of "Calendar și serii" (7.1, mock pauze-a A1). */
export function PauzeSection() {
  const breaks = useBreaks();
  const [edit, setEdit] = React.useState<{ target: BreakRecord | null } | null>(null);
  const [del, setDel] = React.useState<BreakRecord | null>(null);
  const remove = useRemove(breaks, () => setDel(null));
  const onPick: Pick = (b, what) => (what === 'edit' ? setEdit({ target: b }) : setDel(b));
  const add = <Button variant="secondary" size="sm" icon={<IconPlus />} onClick={() => setEdit({ target: null })}>{PAUZE_COPY.add}</Button>;
  const body = breaks.failed ? <Notice tone="danger">{GROUP_ERRORS.loadFailed}</Notice> : breaks.list ? <BreakList rows={breakRows(breaks.list)} onPick={onPick} /> : <Loading />;
  return (
    <Section title={PAUZE_COPY.section} aside={add}>
      {body}
      {edit && <BreakDialog target={edit.target} breaks={breaks} onClose={() => setEdit(null)} />}
      <ConfirmDialog open={!!del} title={PAUZE_COPY.remove} message={PAUZE_COPY.removeConfirm(del?.label ?? '')} tone="danger" confirmLabel={PAUZE_COPY.remove} busy={remove.busy} error={remove.error} onCancel={() => setDel(null)} onConfirm={() => del && void remove.run(del)} />
    </Section>
  );
}
```

- [ ] **Step 4: `ProgramEditPage.tsx` (whole file) and the colour rule**

```tsx
import * as React from 'react';
import { AdminPage, PageHeader, Section, StatusBadge, Window } from '../ui';
import { DASHBOARD_TO } from './menu';
import ProgramOverviewEditor from '../../plugins/component-preview/admin/src/ProgramOverviewEditor';
import { PAUZE_COPY } from '../../club/groups/copy';
import { SPORTIVI_CSS } from './sportivi/styles';
import { PauzeSection } from './program/PauzeSection';

/**
 * "Calendar și serii" (/plugins/edusport-program): Pauze, then the calendar, which writes calendar events itself.
 * The schedule series belong to the groups since phase 4 (spec 7.3); `program.scheduleGroups` stays in the database
 * as the notebook fallback and is no longer edited here, so the page needs no save bar.
 */
const ProgramEditPage: React.FC = () => (
  <AdminPage>
    <style>{SPORTIVI_CSS}</style>
    <Window>
      <PageHeader back={{ to: DASHBOARD_TO }} title="Program" subtitle="Calendarul sezonului și seriile de cursuri" />
      <div className="ui-body">
        <PauzeSection />
        <Section title={PAUZE_COPY.calendar} aside={<StatusBadge tone="neutral">{PAUZE_COPY.autosave}</StatusBadge>}>
          <ProgramOverviewEditor name="overview" attribute={{}} />
        </Section>
      </div>
    </Window>
  </AdminPage>
);

export default ProgramEditPage;
```

`scripts/admin-ui-check.mjs`: add `join(ADMIN, 'dashboard', 'program') + sep` to `RULED_DIRS`.

- [ ] **Step 5: Run the tests and checks**

Run: `npx vitest run src/club/__tests__/admin-phase4-calendar.test.ts && npx vitest run && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS (if an older source test asserted the "Serii de cursuri" section on this page, update it to the new rule in the same commit); zero type errors; checker exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/admin/dashboard/ProgramEditPage.tsx src/admin/dashboard/program scripts/admin-ui-check.mjs src/club/__tests__/admin-phase4-calendar.test.ts
git commit -m "feat(calendar): Pauze section on Calendar și serii, the Serii de cursuri editor removed"
```

---

### Task 3: The general calendar and group events

**Files:**
- Modify: `src/plugins/component-preview/admin/src/ProgramOverviewEditor.tsx` (admin occurrences route; group events open the date panel)
- Modify: `src/plugins/component-preview/admin/src/calendar/model.ts` (`occView` group chips, `NEW_EVENT_CATEGORY_OPTIONS`)
- Modify: `src/plugins/component-preview/admin/src/calendar/EventDrawer.tsx` (new events without "Școala de patinaj")
- Modify: `src/admin/dashboard/grupe/DatePanel.tsx` (`occurrence` typed by the fields it reads)
- Test: `src/club/__tests__/admin-phase4-calendar.test.ts` (one more `describe`)

**Interfaces:**
- Consumes: plan 4-5 (`DatePanel`, `useGrupeApi`, `groupPageTo`, `ChipSource`), plan 4-2 (`GET /api/club/calendar/occurrences`).
- Produces: `DatePanelProps.occurrence: ChipSource & { documentId?: string }`; in the general calendar a group occurrence (with `groupId`) reads "<ora> <grupă>" and opens `DatePanel` with `groupLink`; `NEW_EVENT_CATEGORY_OPTIONS` (every category but `scoala`).

- [ ] **Step 1: Add the failing source test**

Append to `src/club/__tests__/admin-phase4-calendar.test.ts`:

```ts
describe('the general calendar (7.2, W18)', () => {
  const editor = source('plugins/component-preview/admin/src/ProgramOverviewEditor.tsx');
  const model = source('plugins/component-preview/admin/src/calendar/model.ts');
  const drawer = source('plugins/component-preview/admin/src/calendar/EventDrawer.tsx');

  it('reads the admin occurrences route, so non-public groups show too', () => {
    expect(editor).toContain('/api/club/calendar/occurrences');
    expect(editor).not.toContain("fetch(`/api/calendar/occurrences");
  });

  it('group events read "<ora> <grupă>" and open the group date panel with "Deschide grupa"', () => {
    expect(model).toContain('o.groupName');
    expect(editor).toContain('<DatePanel');
    expect(editor).toContain('groupPageTo');
    expect(editor).toContain('o.groupId');
  });

  it('new events no longer offer "Școala de patinaj"', () => {
    expect(model).toContain('NEW_EVENT_CATEGORY_OPTIONS');
    expect(drawer).toContain('NEW_EVENT_CATEGORY_OPTIONS');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/admin-phase4-calendar.test.ts`
Expected: FAIL.

- [ ] **Step 3: Model and drawer**

In `calendar/model.ts`, after `CATEGORY_OPTIONS`:

```ts
/** New events (W18): group programs are written on the group page, so "Școala de patinaj" is not offered. */
export const NEW_EVENT_CATEGORY_OPTIONS = CATEGORY_OPTIONS.filter((c) => c.value !== 'scoala');
```

At the start of `occView`, before `const isScoala`:

```ts
  if (o.groupName) {
    const cancelled = o.status === 'cancelled';
    const cat: CalendarCategory = cancelled ? (o.cancelReason === 'blackout' ? 'liber' : 'anulat') : o.type === 'scoala' ? 'scoala' : 'antrenament';
    const time = hhmm(o.startTime);
    return { cat, time, text: o.groupName, struck: cancelled, title: `${time} ${o.groupName}`.trim() };
  }
```

In `EventDrawer.tsx`, import `NEW_EVENT_CATEGORY_OPTIONS` and use `options={form.documentId ? CATEGORY_OPTIONS : NEW_EVENT_CATEGORY_OPTIONS}` on the category `Select` (line 195).

- [ ] **Step 4: `DatePanel` occurrence type**

In `src/admin/dashboard/grupe/DatePanel.tsx`, replace the `Occurrence` import and the prop type:

```ts
import type { ChipSource } from '../../../club/grupe/program-view';
```

```ts
export type PanelOccurrence = ChipSource & { documentId?: string };
export type DatePanelProps = { occurrence: PanelOccurrence; isClass: boolean; readOnly: boolean; api: GrupeApi; onClose: () => void; groupLink?: string | null };
```

(plan 4-5's `ProgramTab` passes the API `Occurrence`, which fits.)

- [ ] **Step 5: `ProgramOverviewEditor.tsx`**

1. Imports:

```ts
import { DatePanel } from '../../../../admin/dashboard/grupe/DatePanel';
import { useGrupeApi } from '../../../../admin/dashboard/grupe/api';
import { groupPageTo } from '../../../../club/grupe/routes';
```

2. Replace the occurrences `fetch(...)` chain with the admin route through the fetch client (`get` is already destructured from `useFetchClient()`):

```ts
    get(`/api/club/calendar/occurrences?from=${ymd(first)}&to=${ymd(last)}`)
      .then((r: { data?: { data?: unknown } }) => { if (!cancelled) setOccurrences(Array.isArray(r?.data?.data) ? (r.data?.data as Occurrence[]) : []); })
      .catch(() => { if (!cancelled) setOccurrences([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
```

and add `get` to the effect's dependency list only if the linter asks (the fetch client changes identity on every render; keep `[ym, reloadKey]` and read `get` through a ref like `useGrupeApi` does if it re-runs).

3. A state and a handler for group events:

```ts
  const grupeApi = useGrupeApi();
  const [groupDate, setGroupDate] = React.useState<{ o: Occurrence; isClass: boolean } | null>(null);
  const openGroupDate = async (o: Occurrence) => {
    const res = (await get(`${CM_EVENT}/${o.documentId}`).catch(() => null)) as { data?: { data?: { recurrence?: { freq?: string } } } } | null;
    setGroupDate({ o, isClass: res?.data?.data?.recurrence?.freq === 'none' });
  };
```

4. In `grid`, route group events to it:

```ts
    onEvent: (o: Occurrence, date: string) => void (o.groupId ? openGroupDate(o) : openEdit(o.documentId, date)),
```

5. After the `EventDrawer`, render:

```tsx
      {groupDate && (
        <DatePanel occurrence={groupDate.o} isClass={groupDate.isClass} readOnly={false} api={grupeApi} groupLink={groupPageTo(groupDate.o.groupId ?? '', null)}
          onClose={() => { setGroupDate(null); setReloadKey((k) => k + 1); }} />
      )}
```

The date panel's server refuses a past season's date (409, shown in the panel); decided 3.

- [ ] **Step 6: Run the tests and checks**

Run: `npx vitest run src/club/__tests__/admin-phase4-calendar.test.ts && npx vitest run && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS; zero type errors; checker exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/component-preview/admin/src/ProgramOverviewEditor.tsx src/plugins/component-preview/admin/src/calendar/model.ts src/plugins/component-preview/admin/src/calendar/EventDrawer.tsx src/admin/dashboard/grupe/DatePanel.tsx src/club/__tests__/admin-phase4-calendar.test.ts
git commit -m "feat(calendar): group events in the general calendar open the group date panel"
```

---

### Task 4: Sezoane: "Începe sezonul <next>" and its window

**Files:**
- Create: `src/admin/pages/sezoane/useNewSeason.ts`, `NewSeasonDialog.tsx`, `NewSeasonSteps.tsx`
- Modify: `src/admin/pages/SezoanePage.tsx`
- Test: `src/club/__tests__/admin-phase4-calendar.test.ts` (one more `describe`)

**Interfaces:**
- Consumes: Task 1 (`window-view`), plan 4-3 (`startableLabel`, `StartData`, `StartPreview`, `StartResult`, routes, `NEW_SEASON_COPY`, `step1Rows`), plan 4-5 (`useGrupeApi` for undo, `undoToast`, `grupeListTo`, `WindowShell`).
- Produces: `useNewSeason(targetId)` (`data`, `preview`, `refresh(ticks)`, `apply(ticks)`), `NewSeasonDialog({ season, onClose })` (3 steps), the Sezoane button column.

- [ ] **Step 1: Add the failing source test**

Append to `src/club/__tests__/admin-phase4-calendar.test.ts`:

```ts
describe('new season (10.1, 10.2, 10.5)', () => {
  const page = source('admin/pages/SezoanePage.tsx');
  const dialog = source('admin/pages/sezoane/NewSeasonDialog.tsx');
  const steps = source('admin/pages/sezoane/NewSeasonSteps.tsx');

  it('the button shows on the next season only and its click does not open the row', () => {
    expect(page).toContain('startableLabel');
    expect(page).toContain('NEW_SEASON_COPY.button');
    expect(page).toContain('stopPropagation');
  });

  it('three steps with their buttons; the last applies with a busy button', () => {
    for (const s of ['NEW_SEASON_COPY.stepOf', 'NEW_SEASON_COPY.next', 'NEW_SEASON_COPY.back', 'NEW_SEASON_COPY.apply', 'NEW_SEASON_COPY.cancel', 'loading=']) expect(dialog, s).toContain(s);
  });

  it('step 1 rows, step 2 tables with header ticks and children, step 3 tiles, lines and warning', () => {
    for (const s of ['step1Rows', 'NEW_SEASON_COPY.onSite', 'NEW_SEASON_COPY.inPanel', 'headerState', 'indeterminate', 'NEW_SEASON_COPY.seeAthletes', 'childMain', 'NEW_SEASON_COPY.mainRule', 'StatTile', 'preview.lines', 'preview.warning', 'preview.summary']) {
      expect(steps, s).toContain(s);
    }
  });

  it('after applying: Grupe on the new season and the toast with "Anulează"', () => {
    expect(dialog).toContain('grupeListTo');
    expect(dialog).toContain('undoToast');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/admin-phase4-calendar.test.ts`
Expected: FAIL.

- [ ] **Step 3: `useNewSeason.ts`**

```ts
import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { ActionBody } from '../../../club/groups/api-types';
import { startBody, type Ticks } from '../../../club/groups/new-season/window-view';
import type { StartPreview, StartResult } from '../../../club/groups/new-season/preview';
import type { StartData } from '../../../club/groups/new-season/start-data';

/** Routes of plan 4-3 for one target season; the preview is asked 300 ms after the last change (decided 4). */
export function useNewSeason(targetId: string) {
  const client = useFetchClient();
  const ref = React.useRef(client);
  ref.current = client;
  const base = `/api/club/seasons/${encodeURIComponent(targetId)}/start`;
  const [data, setData] = React.useState<StartData | null>(null);
  const [preview, setPreview] = React.useState<StartPreview | null>(null);
  const [failed, setFailed] = React.useState<unknown>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    ref.current.get(base).then((r) => setData((r as { data: { data: StartData } }).data.data)).catch(setFailed);
  }, [base]);
  const refresh = React.useCallback((d: StartData, ticks: Ticks) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      ref.current.post(`${base}/preview`, startBody(d, ticks)).then((r) => setPreview((r as { data: { data: StartPreview } }).data.data)).catch(setFailed);
    }, 300);
  }, [base]);
  const apply = async (d: StartData, ticks: Ticks): Promise<ActionBody<StartResult>> => ((await ref.current.post(base, startBody(d, ticks))) as { data: ActionBody<StartResult> }).data;
  return { data, preview, failed, refresh, apply };
}
```

- [ ] **Step 4: `NewSeasonSteps.tsx`**

```tsx
import * as React from 'react';
import { Button, Checkbox, Notice, StatTile, useIsPhone } from '../../ui';
import { NEW_SEASON_COPY, step1Rows } from '../../../club/groups/copy';
import type { StartPreview } from '../../../club/groups/new-season/preview';
import type { StartData, StartGroup, StartSection } from '../../../club/groups/new-season/start-data';
import {
  childMain, headerState, inLine, membersEnabled, programCell, programEnabled, setSection, toggleChild, toggleGroup, type TickKey, type Ticks,
} from '../../../club/groups/new-season/window-view';

const C = NEW_SEASON_COPY;
type StepProps = { data: StartData; ticks: Ticks; setTicks: (t: Ticks) => void; preview: StartPreview | null };

/** Step 1 (10.2): what changes when the season becomes current; nothing written yet. */
export function StepOne({ data }: { data: StartData }) {
  const rows = step1Rows(data.current.label, data.target.label, data.target.fee);
  const list = (part: typeof rows) => <dl className="grp-kv">{part.map((r) => <React.Fragment key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></React.Fragment>)}</dl>;
  return (
    <>
      <p>{C.lead1(data.target.label)}</p>
      <h3 className="cal-st">{C.onSite}</h3>
      {list(rows.slice(0, 4))}
      <h3 className="cal-st">{C.inPanel}</h3>
      {list(rows.slice(4))}
    </>
  );
}

function HeaderBox({ section, ticks, setTicks, k, label }: { section: StartSection; ticks: Ticks; setTicks: (t: Ticks) => void; k: TickKey; label: string }) {
  const h = headerState(section, ticks, k);
  return <Checkbox checked={h.checked} indeterminate={h.indeterminate} disabled={h.disabled} onChange={(on) => setTicks(setSection(section, ticks, k, on))} label={label} />;
}

function Children({ g, p }: { g: StartGroup; p: StepProps }) {
  const tick = p.ticks[g.groupId];
  return (
    <div className="grp-pick">
      {g.athletes.map((a) => {
        const m = childMain(a, g.groupId, p.preview?.mains ?? {}, p.data.current.label);
        return (
          <div key={a.athleteId} className="grp-usual-row">
            <Checkbox checked={!a.inactive && tick.members && !tick.excluded.includes(a.athleteId)} disabled={a.inactive || !tick.members} onChange={() => p.setTicks(toggleChild(p.ticks, g.groupId, a.athleteId))} label={a.age === null ? a.name : `${a.name}, ${a.age} ani`} />
            <span>{m.main}</span>
            {m.note && <span className="spv-muted">{m.note}</span>}
          </div>
        );
      })}
    </div>
  );
}

function GroupRow({ g, p }: { g: StartGroup; p: StepProps }) {
  const [open, setOpen] = React.useState(false);
  const tick = p.ticks[g.groupId];
  return (
    <div className="grp-ua-row">
      <div><span className="spv-name">{g.name}</span><span className="grp-ua-src">{inLine(g)}</span>
        {g.members > 0 && <button type="button" className="spv-link" onClick={() => setOpen((o) => !o)}>{open ? C.hide : C.seeAthletes}</button>}
      </div>
      <Checkbox checked={tick.members} disabled={!membersEnabled(g)} onChange={() => p.setTicks(toggleGroup(p.ticks, g, 'members'))} label={C.colMembers} />
      <Checkbox checked={tick.program} disabled={!programEnabled(g)} onChange={() => p.setTicks(toggleGroup(p.ticks, g, 'program'))} label={programCell(g, p.data.target.label)} />
      {open && <Children g={g} p={p} />}
    </div>
  );
}

/** Step 2 (10.2): one table per section, the header ticks, "Vezi sportivii", the rule line and the summary. */
export function StepTwo(p: StepProps) {
  return (
    <>
      <p>{C.lead2(p.data.target.label, p.data.current.label)}</p>
      {p.data.sections.map((s) => (
        <section key={s.sectionId}>
          <h3 className="cal-st">{s.label}</h3>
          <div className="grp-bar">
            <HeaderBox section={s} ticks={p.ticks} setTicks={p.setTicks} k="members" label={useIsPhone() ? C.phoneAllMembers : C.colMembers} />
            <HeaderBox section={s} ticks={p.ticks} setTicks={p.setTicks} k="program" label={useIsPhone() ? C.phoneAllProgram : C.colProgram} />
          </div>
          <div className="grp-ua">{s.groups.map((g) => <GroupRow key={g.groupId} g={g} p={p} />)}</div>
        </section>
      ))}
      <p className="spv-muted">{C.mainRule}</p>
      {p.preview && <Notice tone="info">{p.preview.summary}</Notice>}
    </>
  );
}

/** Step 3 (10.2): four tiles, the lines with their bold part, the warning. */
export function StepThree({ preview }: { preview: StartPreview }) {
  return (
    <>
      <div className="grp-bar">{preview.tiles.map((t) => <StatTile key={t.label} label={t.label} value={t.value} caption={t.hint} />)}</div>
      <ul className="grp-usual">{preview.lines.map((l) => <li key={l.bold}><b>{l.bold}</b>{l.rest}</li>)}</ul>
      {preview.warning && <Notice tone="warning">{preview.warning}</Notice>}
    </>
  );
}

export { Button };
```

Move the two `useIsPhone()` calls in `StepTwo` to one `const phone = useIsPhone();` at its top (hooks may not run inside `map`), and drop the trailing `export { Button };` (unused). Split `StepTwo` into `SectionTable({ s, p, phone })` if it passes 30 lines.

- [ ] **Step 5: `NewSeasonDialog.tsx`**

```tsx
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Loading, Notice } from '../../ui';
import { GROUP_ERRORS, NEW_SEASON_COPY } from '../../../club/groups/copy';
import { initialTicks, type Ticks } from '../../../club/groups/new-season/window-view';
import { grupeListTo } from '../../../club/grupe/routes';
import { requestErrorText } from '../../../club/registration-panel';
import { useGrupeApi } from '../../dashboard/grupe/api';
import { WindowShell } from '../../dashboard/grupe/PanelShell';
import { undoToast } from '../../dashboard/grupe/undo';
import { StepOne, StepThree, StepTwo } from './NewSeasonSteps';
import { useNewSeason } from './useNewSeason';

const C = NEW_SEASON_COPY;
type Props = { season: { documentId: string; label: string }; onClose: () => void };

function useApply(ns: ReturnType<typeof useNewSeason>, ticks: Ticks | null) {
  const navigate = useNavigate();
  const grupe = useGrupeApi();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async () => {
    if (!ns.data || !ticks) return;
    setBusy(true);
    try {
      const res = await ns.apply(ns.data, ticks);
      navigate(grupeListTo(res.data.season, null));
      undoToast(res.data.toast, res.undo?.actionId ?? null, grupe);
    } catch (err) {
      setError(requestErrorText(err, GROUP_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** "Începe sezonul <next>" (10.2): three steps; nothing is written before the last button (W24). */
export function NewSeasonDialog({ season, onClose }: Props) {
  const ns = useNewSeason(season.documentId);
  const [step, setStep] = React.useState(1);
  const [ticks, setTicksState] = React.useState<Ticks | null>(null);
  React.useEffect(() => { if (ns.data && !ticks) { const t = initialTicks(ns.data); setTicksState(t); ns.refresh(ns.data, t); } }, [ns, ticks]);
  const setTicks = (t: Ticks) => { setTicksState(t); if (ns.data) ns.refresh(ns.data, t); };
  const act = useApply(ns, ticks);
  const footer = (
    <>
      <Button variant="ghost" onClick={step === 1 ? onClose : () => setStep(step - 1)} disabled={act.busy}>{step === 1 ? C.cancel : C.back}</Button>
      {step < 3 ? <Button onClick={() => setStep(step + 1)} disabled={!ns.data}>{C.next}</Button> : <Button loading={act.busy} disabled={!ns.preview} onClick={() => void act.run()}>{C.apply(season.label)}</Button>}
    </>
  );
  const failed = ns.failed ? requestErrorText(ns.failed, GROUP_ERRORS.loadFailed) : null;
  const body = !ns.data || !ticks ? <Loading /> : step === 1 ? <StepOne data={ns.data} /> : step === 2 ? <StepTwo data={ns.data} ticks={ticks} setTicks={setTicks} preview={ns.preview} /> : ns.preview ? <StepThree preview={ns.preview} /> : <Loading />;
  return (
    <WindowShell title={<>{C.title(season.label)} <span className="spv-muted">{C.stepOf(step)}</span></>} onClose={onClose} footer={footer} size="lg">
      {(act.error || failed) && <Notice tone="danger">{act.error ?? failed}</Notice>}
      {body}
    </WindowShell>
  );
}
```

`NewSeasonDialog` passes 30 lines with the footer; move `footer` into `DialogFooter({ step, setStep, onClose, busy, ready, apply, label })` and `body` into `StepBody(...)` in the same file. The 409 "Sezonul curent s-a schimbat. Reîncarcă pagina." arrives through `requestErrorText` on load or apply.

- [ ] **Step 6: Sezoane button**

In `SezoanePage.tsx`:

```tsx
import { useIsPhone } from '../ui';
import { NEW_SEASON_COPY } from '../../club/groups/copy';
import { startableLabel } from '../../club/groups/new-season/detect';
import { GRUPE_CSS } from '../dashboard/grupe/styles';
import { NewSeasonDialog } from './sezoane/NewSeasonDialog';
```

Turn `COLUMNS` into `columns(startable: string | null, phone: boolean, onStart: (s: AdminSeason) => void)`:

```tsx
function StartButton({ s, onStart }: { s: AdminSeason; onStart: (s: AdminSeason) => void }) {
  return (
    <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); onStart(s); }}>{NEW_SEASON_COPY.button(s.label)}</Button>
  );
}

const columns = (startable: string | null, phone: boolean, onStart: (s: AdminSeason) => void): DataColumn<AdminSeason>[] => [
  { key: 'label', header: 'Sezon', render: (s) => (phone && s.label === startable ? <><div>{s.label}</div><StartButton s={s} onStart={onStart} /></> : s.label) },
  { key: 'period', header: 'Perioadă', render: (s) => formatPeriod(s.startMonth, s.endMonth) },
  { key: 'membershipFee', header: 'Taxă de membru', render: (s) => (s.membershipFee === null ? '-' : `${s.membershipFee} RON`) },
  { key: 'isCurrent', header: 'Curent', render: (s) => (s.isCurrent ? <StatusBadge tone="success">Curent</StatusBadge> : null) },
  ...(phone ? [] : [{ key: 'start', header: '', render: (s: AdminSeason) => (s.label === startable ? <StartButton s={s} onStart={onStart} /> : null) }]),
];
```

`SeasonsTable` takes `onStart` and computes `startableLabel(seasons)` and `useIsPhone()`; `SezoanePage` holds `const [starting, setStarting] = React.useState<AdminSeason | null>(null);`, renders `{starting && <NewSeasonDialog season={{ documentId: starting.documentId, label: starting.label }} onClose={() => setStarting(null)} />}` and adds `GRUPE_CSS` in a `<style>` element (the window's rows reuse its classes; add `SPORTIVI_CSS` too).

- [ ] **Step 7: Run the tests and checks**

Run: `npx vitest run src/club/__tests__/admin-phase4-calendar.test.ts && npx vitest run && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS (update `admin-sezoane-route.test.ts` only if it pinned the old `COLUMNS` constant); zero type errors; checker exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/admin/pages/SezoanePage.tsx src/admin/pages/sezoane src/club/__tests__/admin-phase4-calendar.test.ts
git commit -m "feat(sezoane): Începe sezonul, a three-step window with preview, toast and undo"
```

---

### Task 5: Empty group tabs: "Copiază sportivii / programul din <sezon>"

**Files:**
- Modify: `src/admin/dashboard/grupe/api.ts` (`copyMembers`, `copyProgram`), `RosterTab.tsx`, `ProgramTab.tsx`
- Test: `src/club/__tests__/admin-phase4-calendar.test.ts` (one more `describe`)

**Interfaces:**
- Consumes: plan 4-3 (`GroupPage.copyFrom`, routes `copy-members`, `copy-program`, `NEW_SEASON_COPY` empty-state texts and toasts), plan 4-5 (`writable`, `undoToast`).
- Produces: the two empty states of spec 10.6.

- [ ] **Step 1: Add the failing source test**

```ts
describe('empty group tabs (10.6, W31)', () => {
  const roster = source('admin/dashboard/grupe/RosterTab.tsx');
  const program = source('admin/dashboard/grupe/ProgramTab.tsx');

  it('Sportivi: "Niciun sportiv în <sezon>.", "Copiază sportivii din <sezon>", the hint, the toast with undo', () => {
    for (const s of ['page.copyFrom', 'NEW_SEASON_COPY.emptyMembers', 'NEW_SEASON_COPY.copyMembers', 'NEW_SEASON_COPY.copyMembersHint', 'NEW_SEASON_COPY.membersCopiedToast', 'api.copyMembers', 'writable(page)']) expect(roster, s).toContain(s);
  });

  it('Program: "Niciun program în <sezon>.", "Copiază programul din <sezon>" beside "Adaugă program", the hint, the toast', () => {
    for (const s of ['page.copyFrom', 'NEW_SEASON_COPY.emptyProgram', 'NEW_SEASON_COPY.copyProgram', 'NEW_SEASON_COPY.copyProgramHint', 'NEW_SEASON_COPY.programCopiedToast', 'api.copyProgram']) expect(program, s).toContain(s);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/__tests__/admin-phase4-calendar.test.ts`
Expected: FAIL.

- [ ] **Step 3: Api and the two empty states**

`api.ts`, in the returned object:

```ts
      copyMembers: (id: string, season: string) => action<{ copied: number; from: string }>(ref.current.post(`${g(id)}/copy-members`, { season })),
      copyProgram: (id: string, season: string) => action<{ series: number; from: string }>(ref.current.post(`${g(id)}/copy-program`, { season })),
```

`RosterTab.tsx`: add

```tsx
function CopyMembers({ page, api }: { page: GroupPage; api: GrupeApi }) {
  const [busy, setBusy] = React.useState(false);
  const from = page.copyFrom;
  if (!from || !from.members || !page.season || !writable(page)) return <EmptyState>{athletesText(0)}</EmptyState>;
  const run = async () => {
    setBusy(true);
    try {
      const res = await api.copyMembers(page.documentId, page.season?.label ?? '');
      undoToast(NEW_SEASON_COPY.membersCopiedToast(res.data.copied, res.data.from), res.undo?.actionId ?? null, api);
    } catch (err) {
      failToast(err);
    } finally {
      setBusy(false);
    }
  };
  const action = <Button variant="secondary" size="sm" loading={busy} onClick={() => void run()}>{NEW_SEASON_COPY.copyMembers(from.season)}</Button>;
  return (
    <EmptyState action={action}>
      {NEW_SEASON_COPY.emptyMembers(page.season.label)}
      <span className="spv-sub2">{NEW_SEASON_COPY.copyMembersHint(from.members, from.season, from.inactive)}</span>
    </EmptyState>
  );
}
```

and render `{page.members.length ? list : <CopyMembers page={page} api={api} />}` (imports: `Button`, `NEW_SEASON_COPY`). "Adaugă sportivi" stays in the bar.

`ProgramTab.tsx`: in `Usual`, when `program.series.length === 0` and `copyFrom.program.length > 0` on a writable page, show before the "Adaugă program" button:

```tsx
function CopyProgram({ page, api }: { page: GroupPage; api: GrupeApi }) {
  const [busy, setBusy] = React.useState(false);
  const from = page.copyFrom;
  if (!from || !from.program.length || !page.season) return null;
  const run = async () => {
    setBusy(true);
    try {
      const res = await api.copyProgram(page.documentId, page.season?.label ?? '');
      undoToast(NEW_SEASON_COPY.programCopiedToast(res.data.from), res.undo?.actionId ?? null, api);
    } catch (err) {
      failToast(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grp-usual">
      <span>{NEW_SEASON_COPY.emptyProgram(page.season.label)}</span>
      <span className="spv-muted">{NEW_SEASON_COPY.copyProgramHint(from.season, from.program.join('; '), from.programFrom ?? '')}</span>
      <Button variant="secondary" size="sm" loading={busy} onClick={() => void run()}>{NEW_SEASON_COPY.copyProgram(from.season)}</Button>
    </div>
  );
}
```

Pass `page` and `api` to `Usual` and render `{can && !program.series.length && <CopyProgram page={page} api={api} />}` above the "Adaugă program" button, which stays (secondary, as spec 10.6 asks). Import `failToast`, `undoToast`, `NEW_SEASON_COPY`.

- [ ] **Step 4: Run the tests and checks**

Run: `npx vitest run src/club/__tests__/admin-phase4-calendar.test.ts src/club/grupe && npx vitest run && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`
Expected: PASS; zero type errors; checker exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/admin/dashboard/grupe/api.ts src/admin/dashboard/grupe/RosterTab.tsx src/admin/dashboard/grupe/ProgramTab.tsx src/club/__tests__/admin-phase4-calendar.test.ts
git commit -m "feat(grupe): copy members or the program of the previous season into an empty group tab"
```

---

### Task 6: Boot check on a throwaway Postgres and renders

**Files:** none in the repo. Temporary files in `${TMPDIR:-/tmp}/es46`. PNGs to `/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/phase4-renders/` with the prefix `4-6-` (not committed; the user reviews them).

**Interfaces:**
- Consumes: everything above, `scripts/fixtures/phase4-shape.js`.
- Proves: Calendar și serii with Pauze (desktop table, phone cards), the break window, the date-order error, the general calendar month with group chips and a break, a group event opening the date panel with "Deschide grupa", the category list for a new event without "Școala de patinaj"; Sezoane with the button on the next season only; the window's three steps (step 2 with a header tick mixed and "Vezi sportivii" open), the toast on Grupe after applying; the group page empty tabs with the copy buttons; each at 1440x900 and 390x844. Compared with `phase4/pauze-a-*.png` and `phase4/sezon-nou-a-*.png`.

Container `es46-pg` on 127.0.0.1:55446, Strapi on 1366. Never 1337, 1340, 3010 or 5432.

- [ ] **Step 1: Environment and data**

Run plan 4-2 Task 8 Steps 1 and 2 with `es42` → `es46`, `55442` → `55446`, `1362` → `1366` (plus `npx tsc --noEmit -p src/admin/tsconfig.json` and `node scripts/admin-ui-check.mjs --strict` in the checks). Then:

```bash
OUT=/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/phase4-renders; mkdir -p "$OUT"
IB=$(idof groups 'Intermediari Bronze'); PRO=$(idof groups 'Profesioniști')
api POST "/club/groups/$IB/program" '{"freq":"weekly","days":["sat","sun"],"startTime":"11:00","durationMin":50,"from":"2026-10-04"}' > /dev/null
api POST "/club/groups/$PRO/program" '{"freq":"weekly","days":["mon","wed","fri"],"startTime":"18:00","durationMin":90,"from":"2026-10-05"}' > /dev/null
api POST /club/breaks '{"label":"Vacanța de iarnă","startDate":"2026-12-20","endDate":"2027-01-07"}' > /dev/null
api POST /club/breaks '{"label":"Vacanța de primăvară","startDate":"2027-04-03","endDate":"2027-04-11"}' > /dev/null
api POST /club/seasons '{"label":"2027-2028","startMonth":"2027-10","endMonth":"2028-05","membershipFee":200}' > /dev/null
```

Expected: each call 200.

- [ ] **Step 2: Render script**

Write `$T/pass.py` with the login, `shot`, `SIZES` and `main` of plan 4-5 Task 7 (prefix `4-6-`), and these steps:

```python
PROG = B + '/plugins/edusport-program'
SEZ = B + '/plugins/edusport-sezoane'

async def pauze(pg, r, tag):
    await pg.goto(PROG); await pg.wait_for_timeout(3000)
    r[f'sections_{tag}'] = await pg.locator('.ui-section-title, h2').all_inner_texts()
    await pg.screenshot(path=shot(tag, 'calendar-si-serii'), full_page=True)
    await pg.get_by_role('button', name='Adaugă pauză').click(); await pg.wait_for_timeout(600)
    await pg.get_by_label('Nume').fill('Test'); await pg.get_by_label('De la').fill('2027-02-10'); await pg.get_by_label('Până la').fill('2027-02-09')
    await pg.get_by_role('button', name='Salvează').click(); await pg.wait_for_timeout(500)
    r[f'order_error_{tag}'] = await pg.locator('.ui-notice').first.inner_text()
    await pg.screenshot(path=shot(tag, 'pauza-noua'))
    await pg.keyboard.press('Escape')

async def calendar(pg, r, tag):
    await pg.goto(PROG); await pg.wait_for_timeout(3000)
    r[f'group_chip_{tag}'] = await pg.locator('.cal-ev', has_text='Intermediari Bronze').count()
    await pg.screenshot(path=shot(tag, 'calendar-grupe'), full_page=True)
    await pg.locator('.cal-ev', has_text='Intermediari Bronze').first.click(); await pg.wait_for_timeout(1200)
    r[f'open_group_link_{tag}'] = await pg.get_by_role('link', name='Deschide grupa').count()
    await pg.screenshot(path=shot(tag, 'calendar-panou-grupa'))
    await pg.keyboard.press('Escape')

async def sezoane(pg, r, tag):
    await pg.goto(SEZ); await pg.wait_for_timeout(2500)
    r[f'start_buttons_{tag}'] = await pg.get_by_role('button', name='Începe sezonul 2027-2028').count()
    await pg.screenshot(path=shot(tag, 'sezoane'), full_page=True)
    await pg.get_by_role('button', name='Începe sezonul 2027-2028').click(); await pg.wait_for_timeout(1500)
    await pg.screenshot(path=shot(tag, 'sezon-pas-1'), full_page=True)
    await pg.get_by_role('button', name='Continuă').click(); await pg.wait_for_timeout(1500)
    await pg.get_by_role('button', name='Vezi sportivii').first.click(); await pg.wait_for_timeout(800)
    await pg.screenshot(path=shot(tag, 'sezon-pas-2'), full_page=True)
    await pg.get_by_role('button', name='Continuă').click(); await pg.wait_for_timeout(1500)
    r[f'preview_{tag}'] = await pg.locator('.grp-usual li').all_inner_texts()
    await pg.screenshot(path=shot(tag, 'sezon-pas-3'), full_page=True)
    await pg.keyboard.press('Escape')
```

Run the window to the end only once, on desktop, after the phone pass:

```python
async def apply_once(pg, r):
    await pg.goto(SEZ); await pg.wait_for_timeout(2500)
    await pg.get_by_role('button', name='Începe sezonul 2027-2028').click(); await pg.wait_for_timeout(1500)
    for _ in range(2):
        await pg.get_by_role('button', name='Continuă').click(); await pg.wait_for_timeout(1500)
    await pg.get_by_role('button', name='Începe sezonul 2027-2028').last.click(); await pg.wait_for_timeout(2500)
    r['after_url'] = pg.url
    r['toast'] = await pg.locator('.ui-toast').last.inner_text()
    await pg.screenshot(path=shot('desktop', 'sezon-aplicat'), full_page=True)
    await pg.goto(B + '/plugins/edusport-grupe/' + IDS['groups']['Avansați Gold'] + '?season=2027-2028'); await pg.wait_for_timeout(2500)
    r['copy_members'] = await pg.get_by_role('button', name='Copiază sportivii din 2026-2027').count()
    await pg.screenshot(path=shot('desktop', 'grupa-goala-sportivi'), full_page=True)
    await pg.get_by_role('tab', name='Program').click(); await pg.wait_for_timeout(1500)
    r['copy_program'] = await pg.get_by_role('button', name='Copiază programul din 2026-2027').count()
    await pg.screenshot(path=shot('desktop', 'grupa-goala-program'), full_page=True)
```

Before `apply_once`, give Avansați Gold a program so its empty Program tab offers the copy: `api POST "/club/groups/$(idof groups 'Avansați Gold')/program" '{"freq":"weekly","days":["sat"],"startTime":"09:00","durationMin":50,"from":"2026-10-04"}'` in Step 1, and untick its "Copiază programul" in the window (click its row's program checkbox in step 2 before continuing; the step function's selectors may need the real class names: read the component, do not change it for the script).

Expected:

```
page_errors: []
sections_desktop: (contains, in this order) Pauze, Calendar; no "Serii de cursuri"
order_error_desktop: Data de sfârșit trebuie să fie după data de început.
group_chip_desktop: > 0
open_group_link_desktop: 1
start_buttons_desktop: 1
preview_desktop: (contains) Membru A.C.S. nu se copiază. În 2027-2028 toți pornesc de la Nu.
after_url: .../plugins/edusport-grupe?season=2027-2028
toast: (starts with) 2027-2028 este sezonul curent.
copy_members: 1
copy_program: 1
(the same per-size keys for phone)
```

- [ ] **Step 3: Look at the renders**

Open `phase4-renders/4-6-*.png` beside `phase4/pauze-a-*.png` and `phase4/sezon-nou-a-*.png`. Check the texts of spec 7 and 10 word for word, no em dash, no middle dot, straight quotes, square checkboxes (the mixed header state visible), no pill or circle, no dashed or dotted line, phone screens without horizontal scroll, the Sezoane button under the season name on phones. Show them to the user in the companion. Fixes go into the owning task's files with a `fix(calendar): ...`, `fix(sezoane): ...` or `fix(grupe): ...` commit, and the affected steps are repeated.

- [ ] **Step 4: Clean up**

```bash
kill "$(cat "$T/pid")"
docker rm -f es46-pg
rm -rf "$T"
```

Expected: container removed.

---

## Self-review

- **Spec coverage.** 7.1 Pauze section, button, table and cards, row menu with confirmation, window with hint and the date-order error, toasts, effect shown in the calendar (T1, T2, T6); 7.2 the calendar section stays, reads the admin route, group chips, group events open the group panel with "Deschide grupa", "Școala de patinaj" not offered for new events (T3; the 409 of the old routes: plan 4-2); 7.3 the Serii section gone (T2); 10.1 button on the next season only, click not opening the row, phone placement (T4); 10.2 the three steps, step 1 rows, step 2 tables with header ticks, mixed state, defaults, disabled boxes, "Vezi sportivii" with the main group lines, the rule line, the summary, phone ticks, step 3 tiles, lines and warning, buttons (T1, T4); 10.5 toast and Grupe on the new season (T4); 10.6 the empty states (T5); 11 copy; 12 UI source tests and renders (T2 to T6).
- **Placeholder scan:** code in every code step; the notes that remain (30-line splits, hooks out of `map`, selectors read from the components, an old test pinning `COLUMNS`) each say exactly what to do.
- **Type consistency:** `Ticks`, `startBody` (T1) feed `useNewSeason` (T4); `PanelOccurrence` (T3) accepts both occurrence types; `copyMembers` / `copyProgram` (T5) answer the plan 4-3 shapes.
- **Review Focus:** header ticks (T1), double click and stale window (T4, T6), break dates (T1, T6), group events (T3, T6), empty tabs on past seasons (T5).
