# Phase 5-5: Admin "Prezență" Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The admin screens of attendance: the four "Club și școală" menu entries (Prezență, Abonamente, Plăți, De încasat), the "Prezență" page with tabs "Ședințe" (day page with the undone list), "Lecții individuale" and "Pe antrenori" (with CSV), the session panel, the "Ședință nouă" window with its warning, the "Lecție nouă" window and the lesson panel, the group page tab "Prezență", and the Setări site field "Prezență și plăți din", rendered at desktop and phone width.

**Architecture:** As plan 4-5: every rule a screen needs (titles, dates, counts, tick state, the save body, the address) is a pure module in `src/club/prezenta/`, with every string in `src/club/presence/copy/prezenta-ui.ts`, tested with Vitest; React components in `src/admin/dashboard/prezenta/` stay thin, call the plan 5-2 routes through one `usePrezentaApi` hook and are pinned by source-reading tests (the admin bundle has no test runner). The session panel is one component used by the Prezență page and the group tab. Abonamente, Plăți and De încasat get their menu entry and an empty page shell that plan 5-6 fills.

**Tech Stack:** React 18 (Strapi 5.52.1 admin, `strict: true`), the shared admin UI (`src/admin/ui`), Vitest 3, Python Playwright for the renders, Postgres 16.

**Spec:** `docs/superpowers/specs/2026-10-27-attendance-payments-design.md` (v1, approved 2026-10-27): 3.8 (Setări field), 4.1, 4.2, 4.5, 4.7, 4.22 (as the screens show them), 5 (opening rules), 5.1 to 5.6, 5.16, 10, 11.3 (UI source-reading), 11.4 (renders). Approved mockups (recommended options chosen): `/Users/codrin/Documents/Programming/edusport_backend/.superpowers/phase5/screens/p5-1-prezenta.html` (Q1 A day page, Q3 A panel, Q4 A) and `p5-5-antrenori-individuale.html` (Q24 A, Q26 A); copy `p5-8-copy.html`. Index: `docs/superpowers/plans/2026-10-27-phase5-index.md`. Plan 5-2: `docs/superpowers/plans/2026-10-27-phase5-2-attendance.md` ("Interfaces for other plans"). Decisions: `../edusport_frontend/docs/portal/DECISIONS.md`. Agent rules: `.superpowers/phase3-shared/agent-rules.md`.

**Base:** `feat/athletes` with plans 5-1 and 5-2 merged. Plan 5-6 starts after this plan is merged: it fills the three page shells and adds the row "..." menus of `SessionPanel` and `LessonPanel`.

**Parallel groups:** A: T1 | B: T2 | C: T3, T5, T6 | D: T4 | E: T7

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Copy and pure views | plan 5-2 | `copy/prezenta-ui.ts`, `copy.ts` (one line), `src/club/prezenta/*.ts` |
| B | 2 Menu, pages, api, toasts, Setări site | 1 | `menu.tsx`, `PrezentaPage.tsx`, three shells, `prezenta/api.ts`, `prezenta/undo.ts`, `prezenta/styles.ts`, `SetariSitePage.tsx`, `admin-ui-check.mjs` |
| C | 3 Ședințe tab and "Ședință nouă", 5 Lessons and Pe antrenori, 6 Group tab | 2 | 3: `PrezentaScreen.tsx`, `DayTab.tsx`, `NewSessionWindow.tsx`, `ExistingDialog.tsx`; 5: `LessonsTab.tsx`, `NewLessonWindow.tsx`, `LessonPanel.tsx`, `CoachesTab.tsx`; 6: `grupe/PrezentaTab.tsx`, `grupe/GroupPage.tsx`, `src/club/grupe/group-view.ts` |
| D | 4 Session panel | 2 (3 and 6 mount it; until then they open a stub named in T3) | `SessionPanel.tsx`, `CoachFields.tsx`, `InactiveDialog.tsx`, `AthleteSearch.tsx` (one prop) |
| E | 7 Boot check and renders | everything | no repo files |

Risk: **low** for every task (screens only; the rules and writes are plan 5-2's). The plan's final review covers all tasks.

## Decided while planning (low impact, decided by Claude; the user may overrule any line)

Log them in DECISIONS.md as "plan 5-5, decided by Claude (low impact, 2026-10-27)". Each is implemented in the one place named.

1. **Menu links live in `src/admin/dashboard/menu.tsx`** (where phase 4 registered Grupe and Sportivi with `app.addMenuLink`), not in `src/admin/app.tsx` as the index line says; same four entries, order of C40. Icons: Prezență `Clock`, Abonamente `Book`, Plăți `ChartCircle`, De încasat `Bell` (the set has no closer ones; the shell shows the label).
2. **Address:** `/plugins/edusport-prezenta?tab=sedinte&date=2026-10-27`, `?tab=lectii&month=2026-10`, `?tab=antrenori&month=2026-10`; a missing or bad value falls back to today / the current month (`src/club/prezenta/routes.ts`).
3. **Page shells** for Abonamente ("Abonamente", subtitle "Școala de patinaj"), Plăți ("Plăți") and De încasat ("De încasat"): title only until plan 5-6 (`AbonamentePage.tsx`, `PlatiPage.tsx`, `DeIncasatPage.tsx`).
4. **Inactive athletes**: the approved dialog names one athlete, so several inactive athletes get one dialog each, in list order; the answers are sent together in one second save (`InactiveDialog.tsx`, `panel-view.ts::answerInactive`).
5. **"Prezența s-a schimbat între timp. Reîncarcă."** shows as an error toast; the panel stays open with its ticks so nothing is lost (`SessionPanel.tsx`).
6. **The panel closes after "Salvează"** and every open Prezență screen reloads (`prezentaChanged`).
7. **An extra coach field is removed by clearing it** (no new "remove" string); the first field cannot be removed (`panel-view.ts::setCoach`).
8. **"+ Ședință nouă" and "Lecție nouă"**: "Continuă" / "Salvează" stay disabled until Grupă (Sportiv), Data and Ora are set; with no coach the field shows "Alege antrenorul.". Durată defaults from `GET /club/attendance/session/defaults` (sessions) or 50 (lessons); coaches from the defaults routes; Lecție nouă's Data defaults to today.
9. **Existing-session warning rows** read "<ora>, <x> din <y>, Salvată de <admin>" ("11:00, 6 din 9, Salvată de Ana Admin") (`day-view.ts::existingLine`).
10. **Visitor search** is the P3 `AthleteSearch` with a new optional prop `hideStatus` (`['anonimizat']`) and `exclude` = athletes already in the table, without "Sportiv nou"; a picked visitor shows `lastGroup.name` under the name until the save re-reads the main group (`AthleteSearch.tsx`, `panel-view.ts::addVisitor`).
11. **Lesson delete confirmation** buttons "Renunță" / "Șterge lecția" (both approved strings) (`LessonPanel.tsx`).
12. **Phone cards** for lessons: "18:00 Ana Ionescu" over "Virgil Pascu, 50 min, salvată", the session card pattern of 5.2 (`day-view.ts::lessonCard`).
13. **Hidden labels** of the day arrows: "Ziua anterioară" / "Ziua următoare"; the month arrows reuse the P4 calendar's "Luna anterioară" / "Luna următoare" (`copy/prezenta-ui.ts`).
14. **"nefăcută"** is coloured with the token the P4 "Fără grupă" text uses (`--theme-cat-eveniment-soft-fg`); "În afara programului" and "Salvată de ..." are muted (`--theme-text-muted` as the P4 styles use for muted text) (`prezenta/styles.ts`).

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes`. Commit only in the worktree your dispatch names; check `git rev-parse --show-toplevel` and `git branch --show-current` before every commit.
- A dated DECISIONS.md entry wins over the spec; an approved mockup wins over older mockups; the spec wins over this plan's prose.
- Checks after every task: the task's tests, `npx vitest run`, `npx tsc --noEmit`, `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict` (exit 0).
- Code: TypeScript, no `any`, single quotes in `src/`, functions under 30 lines (split components), complexity under 10, no dead code, no comments that restate code. Pure modules in `src/club/**` import no React, Strapi or Node.
- Design (binding): admin tokens only (`var(--theme-*)`, `var(--ui-*)`, `var(--theme-cat-*)`), no raw colours; no pills, no circles (only the spinner is round); no dashed or dotted lines; every screen at 390 px wide without horizontal scroll; tables become cards on phones; the Drawer becomes a full-screen sheet and Modals become sheets (P4 `PanelShell` / `WindowShell`); filters and switchers as P4. Read the component source and the tokens to match existing UI; never infer from screenshots.
- Copy: every string in `src/club/presence/copy/prezenta-ui.ts` or the plan 5-1 / 5-2 copy files, exactly as spec 5 and p5-8 give it; ș and ț with the comma below; straight quotes; no em or en dash; no middle dot; no emoji.
- Toasts: an action with an undo uses `adminToast.success(text, { duration: 8000, action: { label: 'Anulează', onClick } })` (no X); the session save toast has no "Anulează" (C46); a failure shows the server's message or "Acțiunea nu a reușit. Nimic nu a fost salvat."; a load failure "Nu am putut încărca datele.".
- Busy buttons: every write button is disabled while its request runs (one request per click).
- Synthetic data only. Never production, `strapi_app` / `strapi_db`, 1337, 1340, 3010, 5432, 55442, `edusport-test-pg`. Task 7 uses container `es55-pg` on 127.0.0.1:55455 and Strapi on 1375.
- Commits: Conventional Commits, exactly the message in the task, no `Co-Authored-By`, no AI attribution. Never push.
- Progress board: `printf '%s | 5-5 T<n> | implementer | <status>\n' "$(date -u +%H:%M)" >> /Users/codrin/Documents/Programming/edusport_backend/.superpowers/phase3-shared/progress-board.md`.

## Review Focus

- **Closing the panel with unsaved ticks** (Închide, Escape, the sheet's swipe, a click outside): "Închizi fără să salvezi?" with "Rămâi" / "Închide"; after a save, or with no change, it closes without asking. Pinned by Task 1 (`isDirty`) and Task 4 (source test: every close path goes through `requestClose`).
- **A save answered 409** (an inactive athlete, or someone saved meanwhile): the inactive dialogs come one per athlete and the save is sent once more with the answers; a conflict keeps the ticks. Pinned by Task 1 (`readInactive`, `answerInactive`) and Task 4 source tests, Task 7 render of the dialog.
- **A past season on the group page**: the tab lists sessions, but "+ Ședință nouă" is hidden and the panel opens without "Salvează", ticks, coach fields or "+ Adaugă doar la ședința asta" disabled. Pinned by Task 6 (`writable`) and Task 4 (`readOnly`), Task 7.
- **A day or month with nothing, and no start date**: "Nicio ședință în ziua asta." / "Nicio lecție individuală în luna asta." / "Nicio ședință salvată în luna asta." / "Nicio ședință în luna asta."; the undone section hidden at 0; "Setează data de început a prezenței în Setări site." when the date is not set. Pinned by Task 1 and the source tests of Tasks 3, 5, 6, and Task 7.
- **A phone with long names**: day rows and lesson rows as cards, the panel full screen, the tick table without horizontal scroll with a 40-letter group and athlete name. Pinned by Task 7 (`no_side_scroll` on every phone screen).

---

## File Structure

```
src/club/presence/copy/prezenta-ui.ts   PREZENTA_COPY, SETARI_COPY, SHELL_COPY (T1)
src/club/presence/copy.ts               + export * from './copy/prezenta-ui'; (T1)
src/club/prezenta/
  routes.ts       PREZENTA_PATH, ABONAMENTE_PATH, PLATI_PATH, DE_INCASAT_PATH, PrezentaTab, PrezentaQuery, readPrezentaQuery, prezentaTo (T1)
  day-view.ts     dayLine, dayTitle, longDayTitle, addDays, countText, stateWord, sessionCard, lessonCard, existingLine, undoneTitle, visitorsText, durationText (T1)
  panel-view.ts   columnsFor, initialTicks, toggleTick, footerCounts, isDirty, coach fields, addVisitor, saveBody, readInactive, answerInactive (T1)
  __tests__/views.test.ts (T1), __tests__/admin-prezenta.test.ts (T2 to T6, source reading)
src/admin/dashboard/
  menu.tsx                 four entries and links (T2)
  PrezentaPage.tsx         the page route (T2)
  AbonamentePage.tsx, PlatiPage.tsx, DeIncasatPage.tsx   shells (T2)
  prezenta/
    api.ts                 usePrezentaApi (T2)
    undo.ts                prezentaChanged, usePrezentaRefresh, undoToast, failToast (T2)
    styles.ts              PREZENTA_CSS (T2)
    PrezentaScreen.tsx     header, notices, tabs (T3)
    DayTab.tsx, NewSessionWindow.tsx, ExistingDialog.tsx   (T3)
    SessionPanel.tsx, CoachFields.tsx, InactiveDialog.tsx  (T4)
    LessonsTab.tsx, NewLessonWindow.tsx, LessonPanel.tsx, CoachesTab.tsx   (T5)
  grupe/PrezentaTab.tsx, grupe/GroupPage.tsx (tab added)   (T6)
  sportivi/AthleteSearch.tsx   optional hideStatus (T4)
src/club/grupe/group-view.ts   groupTabs gains "Prezență" (T6)
src/admin/pages/SetariSitePage.tsx   "Prezență și plăți din" (T2)
scripts/admin-ui-check.mjs           dashboard/prezenta held to the colour rule (T2)
```

---

### Task 1: Copy and pure views (low)

**Files:**
- Create: `src/club/presence/copy/prezenta-ui.ts`, `src/club/prezenta/routes.ts`, `src/club/prezenta/day-view.ts`, `src/club/prezenta/panel-view.ts`
- Modify: `src/club/presence/copy.ts` (one line)
- Test: `src/club/prezenta/__tests__/views.test.ts`

**Interfaces:**
- Consumes: plan 5-2 `api-types.ts` (`DayRow`, `SessionPanel`, `PanelRow`, `SessionSaveBody`, `Tick`, `SavedOnDay`, `InactiveAthlete`, `LessonListRow`, `SectionKind`), `shortDay`, `savedLine`; plan 5-1 `longDate`, `monthTitle`, `isMonth`, `addMonths`, `SESSION_STATE_WORDS`, `PRESENCE_WORDS`; P3 `AthleteCard`; phase 4 `isIsoDate`.
- Produces (`copy/prezenta-ui.ts`):

```ts
export const PREZENTA_COPY = {
  title: 'Prezență', tabSessions: 'Ședințe', tabLessons: 'Lecții individuale', tabCoaches: 'Pe antrenori',
  today: 'Azi', prevDay: 'Ziua anterioară', nextDay: 'Ziua următoare', prevMonth: 'Luna anterioară', nextMonth: 'Luna următoare',
  newSession: '+ Ședință nouă', newLesson: '+ Lecție individuală', exportCsv: 'Export CSV',
  startNotice: 'Setează data de început a prezenței în Setări site.',
  colDate: 'Data', colTime: 'Ora', colGroup: 'Grupă', colCoach: 'Antrenor', colPresent: 'Prezenți', colState: 'Stare',
  colAthlete: 'Sportiv', colDuration: 'Durată', colGroupSessions: 'Ședințe grup', colLessons: 'Lecții individuale', colHours: 'Ore',
  emptyDay: 'Nicio ședință în ziua asta.', emptyLessons: 'Nicio lecție individuală în luna asta.', emptyCoaches: 'Nicio ședință salvată în luna asta.',
  emptyGroupMonth: 'Nicio ședință în luna asta.', tabGroup: 'Prezență',
  coach: 'Antrenor', addCoaches: '+ Adaugă alți antrenori', grup: 'Grup', uscat: 'Uscat', addVisitor: '+ Adaugă doar la ședința asta',
  close: 'Închide', save: 'Salvează', cancel: 'Anulează', continue: 'Continuă', giveUp: 'Renunță', history: 'Istoric',
  closeConfirm: 'Închizi fără să salvezi?', stay: 'Rămâi',
  newSessionTitle: 'Ședință nouă', newLessonTitle: 'Lecție nouă',
} as const;
export const SETARI_COPY = { attendanceStart: 'Prezență și plăți din', attendanceStartHint: 'Ședințele dinainte nu apar ca nefăcute.' } as const;
export const SHELL_COPY = { abonamente: 'Abonamente', abonamenteSub: 'Școala de patinaj', plati: 'Plăți', deIncasat: 'De încasat' } as const;
```

  Menu labels reuse `PREZENTA_COPY.title` and `SHELL_COPY`. Before writing, check that "Luna anterioară" / "Luna următoare" are the exact P4 calendar labels (`plugins/component-preview/admin/src/calendar/`); use those words.
- Produces (`routes.ts`): `PREZENTA_PATH = '/plugins/edusport-prezenta'`, `ABONAMENTE_PATH = '/plugins/edusport-abonamente'`, `PLATI_PATH = '/plugins/edusport-plati'`, `DE_INCASAT_PATH = '/plugins/edusport-de-incasat'` (5.1); `PrezentaTab = 'sedinte' | 'lectii' | 'antrenori'`; `PrezentaQuery = { tab: PrezentaTab; date: string; month: string }`; `readPrezentaQuery(search: string, today: string): PrezentaQuery`; `prezentaTo(q: Partial<PrezentaQuery>): string` (only the keys given, in the order tab, date, month).
- Produces (`day-view.ts`): `dayLine(date)` ("Marți, 27 oct 2026"); `dayTitle(date, today)` ("Azi, marți 27 oct" / "Luni, 26 oct"); `longDayTitle(date)` ("Marți 27 oct 2026", panel subtitles); `addDays(date, n)`; `countText(x, y)` ("6 din 9"); `stateWord(s: SessionState | null)` ('' for null); `sessionCard(r: DayRow): { title: string; line: string }`; `lessonCard(r: LessonListRow)` (decided 12); `existingLine(s: SavedOnDay)` (decided 9); `undoneTitle(n)` ("Nefăcute din zilele trecute (2)"); `visitorsText(n)` ("Din alte grupe: 2"); `durationText(min)` ("50 min"); `panelTitle(groupName, time)` ("Intermediari Bronze, 17:00"); `lessonTitle(time)` ("Lecție individuală, 18:00"); `footerText(x, y)` ("4 din 6 prezenți").
- Produces (`panel-view.ts`):
  - `Ticks = Record<string, { grup: boolean; uscat: boolean }>`; `columnsFor(kind: SectionKind): string[]` (school `['Sportiv', 'Grup']`, club `['Sportiv', 'Grup', 'Uscat']`; 5.3).
  - `initialTicks(p: SessionPanel): Ticks` (saved ticks; an unsaved session starts empty, p5 Q3); `toggleTick(t: Ticks, athleteId: string, type: 'grup' | 'uscat'): Ticks`.
  - `footerCounts(rows: PanelRow[], t: Ticks): { present: number; listed: number }` (x = any row ticked, visitors included; y = non-visitor rows; 5.3).
  - `isDirty(a: { ticks: Ticks; coaches: (string | null)[]; visitors: string[] }, b: same): boolean`.
  - `CoachFields = (string | null)[]`; `addCoachField(f)`; `setCoach(f, index, id: string | null)` (clearing an extra field removes it, decided 7); `coachIdsOf(f): string[]` (filled, unique).
  - `addVisitor(rows: PanelRow[], card: AthleteCard): PanelRow[]` (appended, `visitor` true, `mainGroup` = `card.lastGroup?.name ?? null`); the caller ticks it "Grup" (C45).
  - `saveBody(p: SessionPanel, t: Ticks, coaches: CoachFields, answers: { reactivate: string[]; keepInactive: string[] }): SessionSaveBody` (`id` when saved, else `occurrence`, else `added`; ticks only for rows with any tick; school rows send `uscat: false`).
  - `readInactive(err: unknown): InactiveAthlete[] | null` (from `err.response.data.error.details.inactive`, status 409).
  - `answerInactive(answers, athleteId: string, reactivate: boolean)`.

- [ ] **Step 1: Write the failing test** `src/club/prezenta/__tests__/views.test.ts`:

```ts
it('day lines and titles (5.2, 5.3, p5 Q42)', () => {
  expect(dayLine('2026-10-27')).toBe('Marți, 27 oct 2026');
  expect([dayTitle('2026-10-27', '2026-10-27'), dayTitle('2026-10-26', '2026-10-27')]).toEqual(['Azi, marți 27 oct', 'Luni, 26 oct']);
  expect(longDayTitle('2026-10-27')).toBe('Marți 27 oct 2026');
  expect([panelTitle('Intermediari Bronze', '17:00'), lessonTitle('18:00')]).toEqual(['Intermediari Bronze, 17:00', 'Lecție individuală, 18:00']);
  expect([addDays('2026-10-31', 1), addDays('2026-03-01', -1)]).toEqual(['2026-11-01', '2026-02-28']);
});
it('counts, states and short texts (5.2, 5.3, 5.6)', () => {
  expect([countText(6, 9), footerText(4, 6), undoneTitle(2), visitorsText(2), durationText(50)])
    .toEqual(['6 din 9', '4 din 6 prezenți', 'Nefăcute din zilele trecute (2)', 'Din alte grupe: 2', '50 min']);
  expect([stateWord('nefacuta'), stateWord('urmeaza'), stateWord('salvata'), stateWord(null)]).toEqual(['nefăcută', 'urmează', 'salvată', '']);
  expect(existingLine({ sessionId: 's1', startTime: '11:00', present: 6, listed: 9, savedBy: 'Ana Admin' })).toBe('11:00, 6 din 9, Salvată de Ana Admin');
});
it('phone cards (5.2, decided 12)', () => {
  expect(sessionCard(dayRow({ startTime: '17:00', groupName: 'Intermediari Bronze', coachNames: ['Virgil Pascu'], present: 6, listed: 9, state: 'salvata' })))
    .toEqual({ title: '17:00 Intermediari Bronze', line: 'Virgil Pascu, 6 din 9, salvată' });
  expect(lessonCard(lessonListRow({ startTime: '18:00', athleteName: 'Ana Ionescu', coachNames: ['Virgil Pascu'], durationMin: 50, state: 'salvata' })))
    .toEqual({ title: '18:00 Ana Ionescu', line: 'Virgil Pascu, 50 min, salvată' });
});
it('address (decided 2)', () => {
  expect(readPrezentaQuery('?tab=lectii&month=2026-10', '2026-10-27')).toEqual({ tab: 'lectii', date: '2026-10-27', month: '2026-10' });
  expect(readPrezentaQuery('?tab=x&date=2026-13-01&month=2026-1', '2026-10-27')).toEqual({ tab: 'sedinte', date: '2026-10-27', month: '2026-10' });
  expect(prezentaTo({ tab: 'sedinte', date: '2026-10-26' })).toBe('/plugins/edusport-prezenta?tab=sedinte&date=2026-10-26');
  expect([PREZENTA_PATH, ABONAMENTE_PATH, PLATI_PATH, DE_INCASAT_PATH]).toEqual(['/plugins/edusport-prezenta', '/plugins/edusport-abonamente', '/plugins/edusport-plati', '/plugins/edusport-de-incasat']);
});
it('panel columns: no Uscat at Școala; the list starts empty (5.3, p5 Q3, 4.1)', () => {
  expect([columnsFor('school'), columnsFor('club')]).toEqual([['Sportiv', 'Grup'], ['Sportiv', 'Grup', 'Uscat']]);
  expect(Object.values(initialTicks(panel({ sessionId: null, rows: [row('a1'), row('a2')] }))).some((t) => t.grup || t.uscat)).toBe(false);
  expect(initialTicks(panel({ sessionId: 's1', rows: [row('a1', { grup: true })] }))).toEqual({ a1: { grup: true, uscat: false } });
});
it('footer counts visitors in x only (5.3)', () => {
  const rows = [row('a1'), row('a2'), row('a7', { visitor: true })];
  expect(footerCounts(rows, { a1: { grup: true, uscat: false }, a7: { grup: true, uscat: false } })).toEqual({ present: 2, listed: 2 });
  expect(footerCounts(rows, toggleTick({}, 'a2', 'uscat'))).toEqual({ present: 1, listed: 2 });
});
it('dirty state drives the close question (5.3)', () => {
  const a = { ticks: {}, coaches: ['tm-virgil'], visitors: [] };
  expect(isDirty(a, a)).toBe(false);
  expect(isDirty(a, { ...a, ticks: { a1: { grup: true, uscat: false } } })).toBe(true);
  expect(isDirty({ ...a, ticks: { a1: { grup: true, uscat: false } } }, { ...a, ticks: { a1: { grup: false, uscat: false } } })).toBe(true);
  expect(isDirty(a, { ...a, coaches: ['tm-virgil', 'tm-andreea'] })).toBe(true);
});
it('coach fields: add, set, clear removes an extra one (4.2, decided 7)', () => {
  expect(addCoachField(['tm-virgil'])).toEqual(['tm-virgil', null]);
  expect(setCoach(['tm-virgil', 'tm-andreea'], 1, null)).toEqual(['tm-virgil']);
  expect(setCoach(['tm-virgil'], 0, null)).toEqual([null]);
  expect(coachIdsOf(['tm-virgil', null, 'tm-virgil', 'tm-andreea'])).toEqual(['tm-virgil', 'tm-andreea']);
});
it('a visitor joins the table; the save body (4.7, C45, plan 5-2 decided 2)', () => {
  const rows = addVisitor([row('a1')], { documentId: 'a7', name: 'Irina Neagu', lastGroup: { name: 'Avansați Gold', season: '2026-2027' } } as AthleteCard);
  expect(rows[1]).toMatchObject({ athleteId: 'a7', name: 'Irina Neagu', visitor: true, mainGroup: 'Avansați Gold', grup: false });
  const p = panel({ sessionId: null, occurrenceKey: 'ev-ib|2026-11-14|11:00', kind: 'school', rows });
  expect(saveBody(p, { a7: { grup: true, uscat: true }, a1: { grup: false, uscat: false } }, ['tm-virgil', null], { reactivate: [], keepInactive: ['a3'] }))
    .toEqual({ occurrence: 'ev-ib|2026-11-14|11:00', coachIds: ['tm-virgil'], ticks: [{ athleteId: 'a7', grup: true, uscat: false }], reactivate: [], keepInactive: ['a3'] });
  expect(saveBody(panel({ sessionId: 's1' }), {}, ['tm-virgil'], { reactivate: [], keepInactive: [] })).toMatchObject({ id: 's1' });
});
it('reads the inactive 409 and collects the answers (4.22, decided 4)', () => {
  const err = { response: { status: 409, data: { error: { details: { inactive: [{ id: 'a3', name: 'Ioana Dinu' }] } } } } };
  expect(readInactive(err)).toEqual([{ id: 'a3', name: 'Ioana Dinu' }]);
  expect(readInactive({ response: { status: 409, data: { error: { message: 'Prezența s-a schimbat între timp. Reîncarcă.' } } } })).toBeNull();
  expect(answerInactive(answerInactive({ reactivate: [], keepInactive: [] }, 'a3', true), 'a4', false)).toEqual({ reactivate: ['a3'], keepInactive: ['a4'] });
});
```

`dayRow`, `lessonListRow`, `panel`, `row` are small builders at the top of the test file.

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/prezenta/__tests__/views.test.ts`; Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the four files and the export line. Weekday names: `['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă']`, capitalized where the line starts with them.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS (the 5-1 `copy.test.ts` also scans `prezenta-ui.ts`).
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/copy/prezenta-ui.ts src/club/presence/copy.ts src/club/prezenta
git commit -m "feat(prezenta): copy and pure views of the Prezență screens"
```

---

### Task 2: Menu entries, pages, api, toasts, Setări site (low)

**Files:**
- Create: `src/admin/dashboard/PrezentaPage.tsx`, `AbonamentePage.tsx`, `PlatiPage.tsx`, `DeIncasatPage.tsx`, `src/admin/dashboard/prezenta/api.ts`, `prezenta/undo.ts`, `prezenta/styles.ts`
- Modify: `src/admin/dashboard/menu.tsx`, `src/admin/pages/SetariSitePage.tsx`, `scripts/admin-ui-check.mjs` (`RULED_DIRS` gains `dashboard/prezenta`)
- Test: `src/club/prezenta/__tests__/admin-prezenta.test.ts` (source reading; Tasks 3 to 6 add to it)

**Interfaces:**
- Consumes: T1; plan 5-2 routes and types; P4 `useGrupeApi` pattern (`grupe/api.ts`), `grupe/undo.ts` pattern, `requestErrorText`, `adminToast`; `downloadPdf` (`inscrieri/downloadPdf.ts`, any blob with the server's file name).
- Produces:
  - `usePrezentaApi()` (stable identity, as `useGrupeApi`): `day(date)`, `session(q: { id } | { occurrence } | AddedSession)`, `defaults(groupId, date)`, `check(body)`, `save(body): Promise<{ data: SessionSaved; undo: null }>`, `groupMonth(groupId, month)`, `lessons(month)`, `lesson(id)`, `lessonNew(athleteId, date)`, `createLesson(body)`, `saveLesson(id, body)`, `deleteLesson(id)` (writes answer `ActionBody<T>`), `coaches(month)`, `coachesCsv(month)` (`downloadPdf(get, '/api/club/attendance/coaches.csv?month=…', coachesCsvName(month))`), `options()` (`GET /club/groups/options`: groups and coaches), `undo(actionId)`, `search` (the P3 search URL, for `AthleteSearch`).
  - `undo.ts`: `UNDO_MS = 8000`, `prezentaChanged()`, `usePrezentaRefresh(reload)`, `undoToast(api, text, actionId)`, `failToast(err)` (server message or "Acțiunea nu a reușit. Nimic nu a fost salvat.").
  - Menu: in the `club` group after "Sportivi", in this order: `{ to: PREZENTA_PATH, label: 'Prezență', icon: Clock }`, Abonamente (`Book`), Plăți (`ChartCircle`), De încasat (`Bell`) (C40, decided 1); one `app.addMenuLink` each, `Component: () => import('./<Page>')`; the comment "(Prezență joins in phase 5)" removed.
  - `PrezentaPage.tsx`: renders `PrezentaScreen` (T3) with the query of the address; until T3 lands, `AdminPage` with `PageHeader title="Prezență"`.
  - Shells (decided 3): `AdminPage` + `PageHeader` with `SHELL_COPY` titles; Abonamente with subtitle "Școala de patinaj".
  - Setări site: `SiteSettings` gains `attendanceStartDate: string | null`; a `DateInput` in the card that holds "Ani până la anonimizare", label `SETARI_COPY.attendanceStart`, hint `SETARI_COPY.attendanceStartHint`; an empty field saves `null` (3.8, 5.16).

- [ ] **Step 1: Write the failing test** `admin-prezenta.test.ts`:

```ts
const src = (p: string) => readFileSync(join(ADMIN, p), 'utf8');
it('menu: Grupe, Sportivi, Prezență, Abonamente, Plăți, De încasat in Club și școală (5.1, C40)', () => {
  const menu = src('dashboard/menu.tsx');
  const order = ['GRUPE_TO', 'SPORTIVI_TO', 'PREZENTA_PATH', 'ABONAMENTE_PATH', 'PLATI_PATH', 'DE_INCASAT_PATH'].map((k) => menu.indexOf(`{ to: ${k}`));
  expect(order.every((i, n) => i > 0 && (n === 0 || i > order[n - 1]))).toBe(true);
  for (const page of ['PrezentaPage', 'AbonamentePage', 'PlatiPage', 'DeIncasatPage']) expect(menu).toContain(`import('./${page}')`);
  expect(menu).not.toContain('Prezență joins in phase 5');
});
it('the api reaches every plan 5-2 route', () => {
  const api = src('dashboard/prezenta/api.ts');
  for (const p of ['/attendance/day', '/attendance/session/defaults', '/attendance/session/check', '/attendance/session', '/attendance/coaches', 'coaches.csv',
    '/lessons/new', '/lessons', '/attendance', '/groups/options', '/undo']) expect(api, p).toContain(p);
});
it('undo toasts last 8 s with "Anulează" and no X', () => {
  const undo = src('dashboard/prezenta/undo.ts');
  expect(undo).toContain('UNDO_MS = 8000');
  expect(undo).toMatch(/action: \{ label: 'Anulează'/);
});
it('Setări site has "Prezență și plăți din" with its hint (3.8, 5.16)', () => {
  const page = src('pages/SetariSitePage.tsx');
  expect(page).toContain('SETARI_COPY.attendanceStart');
  expect(page).toContain('SETARI_COPY.attendanceStartHint');
  expect(page).toContain('attendanceStartDate');
});
it('the three shells carry their titles', () => {
  expect(src('dashboard/AbonamentePage.tsx')).toMatch(/SHELL_COPY\.abonamente[\s\S]*SHELL_COPY\.abonamenteSub/);
  expect(src('dashboard/PlatiPage.tsx')).toContain('SHELL_COPY.plati');
  expect(src('dashboard/DeIncasatPage.tsx')).toContain('SHELL_COPY.deIncasat');
});
it('prezenta components are held to the colour rule', () => {
  expect(readFileSync(join(ROOT, 'scripts/admin-ui-check.mjs'), 'utf8')).toContain("'dashboard', 'prezenta'");
});
```

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/prezenta/__tests__/admin-prezenta.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the files above.
- [ ] **Step 4: Run** the checks of Global Constraints; Expected: PASS, `admin-ui-check` exit 0.
- [ ] **Step 5: Commit**

```bash
git add src/admin/dashboard/menu.tsx src/admin/dashboard/PrezentaPage.tsx src/admin/dashboard/AbonamentePage.tsx src/admin/dashboard/PlatiPage.tsx src/admin/dashboard/DeIncasatPage.tsx src/admin/dashboard/prezenta src/admin/pages/SetariSitePage.tsx scripts/admin-ui-check.mjs src/club/prezenta/__tests__/admin-prezenta.test.ts
git commit -m "feat(prezenta): menu entries, pages, api and the attendance start date setting"
```

---

### Task 3: Prezență page, tab "Ședințe" and the "Ședință nouă" window (low)

**Files:**
- Create: `src/admin/dashboard/prezenta/PrezentaScreen.tsx`, `DayTab.tsx`, `NewSessionWindow.tsx`, `ExistingDialog.tsx`
- Modify: `src/admin/dashboard/PrezentaPage.tsx`, `src/club/prezenta/__tests__/admin-prezenta.test.ts`

**Interfaces:**
- Consumes: T1, T2; P4 `WindowShell`, `durationOptions()` (`src/club/grupe/program-view.ts`); `SessionPanel` (T4; until T4 is merged, `DayTab` imports it from `./SessionPanel` where T4 lives; if T3 runs first, add a one-line `SessionPanel` stub that renders `null` and leave the import as is for T4 to replace).
- Produces:
  - `PrezentaScreen({ query, onQuery })`: title "Prezență"; `Notice` "Setează data de început a prezenței în Setări site." when `startDate` is null; `Notice` `noPriceListNotice(groupsWithoutList)` when > 0 (4.12); `Tabs` "Ședințe" | "Lecții individuale" | "Pe antrenori" (5.2), the header line per tab (C41: day switcher on Ședințe, month switcher on the others); phone: tabs scroll.
  - `DayTab({ date, onDate })`: date line `dayLine(date)` with "<", "Azi", ">" and a `DateInput`, button "+ Ședință nouă" (primary); section `undoneTitle(n)` with columns "Data" | "Ora" | "Grupă" | "Antrenor" | "Stare" (dates `listDate`, Stare "nefăcută" coloured, decided 14), hidden at 0; section `dayTitle(date, today)` with columns "Ora" | "Grupă" | "Antrenor" | "Prezenți" | "Stare", "În afara programului" muted under the group name, "Nicio ședință în ziua asta." when empty; phone cards `sessionCard`; a row opens `SessionPanel` with `{ id }` or `{ occurrence }`; `usePrezentaRefresh` reloads.
  - `NewSessionWindow({ date, groupId?, onOpen, onClose })` ("Ședință nouă", 5.4): "Grupă" `SearchableSelect` (options from `api.options()`, hint = `sectionName`; preselected and disabled when `groupId` is given), "Data" (default `date`), "Ora" `TimeInput`, "Durată" `Select` of `durationOptions()` (default from `api.defaults`), "Antrenor" `CoachFields` (T4; default from `api.defaults`); "Anulează" / "Continuă" (decided 8). "Continuă" calls `api.check` and: `occurrence` -> `onOpen({ occurrence })`; `free` -> `onOpen({ added })`; `existing` -> `ExistingDialog`.
  - `ExistingDialog({ check, onOpenSaved, onAddAnother, onClose })`: title "Există deja o ședință salvată", one `existingLine` per saved session, buttons "Deschide prezența salvată" and, unless `sameTime`, "Adaugă încă o ședință în ziua asta" (4.5, p5 Q5).

- [ ] **Step 1: Write the failing test** (append to `admin-prezenta.test.ts`):

```ts
it('Prezență: three tabs, notices, the day switcher (5.2, C41)', () => {
  const s = src('dashboard/prezenta/PrezentaScreen.tsx');
  for (const k of ['tabSessions', 'tabLessons', 'tabCoaches', 'startNotice']) expect(s, k).toContain(`PREZENTA_COPY.${k}`);
  expect(s).toContain('noPriceListNotice(');
});
it('Ședințe: undone section above the day, columns, empty text, phone cards (5.2)', () => {
  const d = src('dashboard/prezenta/DayTab.tsx');
  expect(d.indexOf('undoneTitle(')).toBeLessThan(d.indexOf('dayTitle('));
  for (const k of ['colDate', 'colTime', 'colGroup', 'colCoach', 'colState', 'colPresent', 'emptyDay', 'newSession', 'today', 'prevDay', 'nextDay'])
    expect(d, k).toContain(`PREZENTA_COPY.${k}`);
  expect(d).toContain('sessionCard(');
  expect(d).toContain('PRESENCE_WORDS.outsideSchedule');
  expect(d).toMatch(/undone\.length > 0/);
});
it('Ședință nouă: fields, check and the warning (5.4, 4.5)', () => {
  const w = src('dashboard/prezenta/NewSessionWindow.tsx');
  for (const k of ['newSessionTitle', 'colGroup', 'colDate', 'colTime', 'colDuration', 'coach', 'cancel', 'continue']) expect(w, k).toContain(`PREZENTA_COPY.${k}`);
  expect(w).toContain('api.check(');
  expect(w).toContain('durationOptions()');
  const e = src('dashboard/prezenta/ExistingDialog.tsx');
  for (const k of ['title', 'open', 'addAnother']) expect(e, k).toContain(`EXISTING_SESSION.${k}`);
  expect(e).toMatch(/!check\.sameTime/);
});
```

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/prezenta/__tests__/admin-prezenta.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the four components and wire `PrezentaPage` to `PrezentaScreen` (query from `useLocation().search`, `onQuery` navigates to `prezentaTo`).
- [ ] **Step 4: Run** the checks of Global Constraints; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/admin/dashboard/prezenta/PrezentaScreen.tsx src/admin/dashboard/prezenta/DayTab.tsx src/admin/dashboard/prezenta/NewSessionWindow.tsx src/admin/dashboard/prezenta/ExistingDialog.tsx src/admin/dashboard/PrezentaPage.tsx src/club/prezenta/__tests__/admin-prezenta.test.ts
git commit -m "feat(prezenta): Ședințe day page and the new session window"
```

---

### Task 4: Session panel (low)

**Files:**
- Create: `src/admin/dashboard/prezenta/SessionPanel.tsx` (replaces a T3 stub if one exists), `CoachFields.tsx`, `InactiveDialog.tsx`
- Modify: `src/admin/dashboard/sportivi/AthleteSearch.tsx` (optional `hideStatus?: AthleteStatus[]`, results with those statuses left out), `src/club/prezenta/__tests__/admin-prezenta.test.ts`

**Interfaces:**
- Consumes: T1, T2; P4 `PanelShell`; P3 `AthleteSearch`; `ConfirmDialog` (`src/admin/ConfirmDialog.tsx`); plan 5-2 `REACTIVATE_DIALOG`, `ATTENDANCE_ERRORS`, `PRESENCE_ERRORS`, `PRESENCE_WORDS`.
- Produces:
  - `SessionPanel({ target: { id: string } | { occurrence: string } | { added: AddedSession }, readOnly?: boolean, onClose })` (5.3): loads `api.session(target)`; title `panelTitle`, subtitle `longDayTitle(date)`, "În afara programului" under it when set; "Antrenor" `CoachFields`; a table with `columnsFor(kind)` and one `Checkbox` per type (labels hidden, the column header names them), rows in the order the server gives; under the name: Școala `abonament` (with "Fără abonament" orange when `noSubscription`), visitor `mainGroup`; "+ Adaugă doar la ședința asta" opens `AthleteSearch` (`hideStatus={['anonimizat']}`, `exclude` = row ids, no "Sportiv nou"; decided 10) and the picked athlete is added ticked "Grup"; a muted `savedLine`; section "Istoric" with `history` when not empty (C69); footer `footerText(x, y)`, "Închide" (ghost), "Salvează" (primary, busy). `readOnly`: no "Salvează", every control disabled, no visitor search.
  - Close: every close path (button, Escape, sheet close, outside click) calls `requestClose()`, which asks `ConfirmDialog` "Închizi fără să salvezi?" with "Rămâi" / "Închide" only when `isDirty` (5.3).
  - Save: no coach -> `ATTENDANCE_ERRORS.noCoach` under the field and nothing sent; `api.save(saveBody(...))`; 200 -> `adminToast.success(data.toast)` (no action, C46), `prezentaChanged()`, close (decided 6); 409 with `readInactive` -> `InactiveDialog` per athlete (decided 4), then one more save with the answers; other errors -> `failToast` and the panel stays as it is (decided 5).
  - `CoachFields({ value: CoachFields, options, disabled?, error?, onChange })` (4.2): one `SearchableSelect` per field (Membri echipă), "+ Adaugă alți antrenori" (link button) adds a field; clearing an extra field removes it (decided 7).
  - `InactiveDialog({ athlete, onAnswer })`: title "Sportiv inactiv", text `REACTIVATE_DIALOG.text(name)`, buttons "Salvează fără" / "Reactivează și salvează" (4.22).

- [ ] **Step 1: Write the failing test** (append):

```ts
it('panel: title, coaches, table by section, visitor, footer, saved line, Istoric (5.3)', () => {
  const p = src('dashboard/prezenta/SessionPanel.tsx');
  for (const f of ['panelTitle(', 'longDayTitle(', 'columnsFor(', 'footerText(', 'savedLine', 'initialTicks(', 'saveBody(']) expect(p, f).toContain(f);
  for (const k of ['addVisitor', 'close', 'save', 'history']) expect(p, k).toContain(`PREZENTA_COPY.${k}`);
  expect(p).toContain("hideStatus={['anonimizat']}");
  expect(p).toContain('PRESENCE_WORDS.outsideSchedule');
});
it('panel: closing asks only when dirty; the save toast has no undo (5.3, C46)', () => {
  const p = src('dashboard/prezenta/SessionPanel.tsx');
  expect(p).toContain('isDirty(');
  for (const k of ['closeConfirm', 'stay']) expect(p, k).toContain(`PREZENTA_COPY.${k}`);
  expect(p).not.toMatch(/onClose=\{onClose\}/);
  expect(p).toMatch(/adminToast\.success\([^)]*toast\)/);
  expect(p).not.toMatch(/adminToast\.success\([^)]*toast[^)]*action/);
});
it('panel: inactive 409 dialogs, then one more save; read-only hides Salvează (4.22, 5.6)', () => {
  const p = src('dashboard/prezenta/SessionPanel.tsx');
  expect(p).toContain('readInactive(');
  expect(p).toContain('answerInactive(');
  expect(p).toMatch(/!readOnly && [\s\S]*PREZENTA_COPY\.save/);
  const d = src('dashboard/prezenta/InactiveDialog.tsx');
  for (const k of ['title', 'text(', 'keep', 'reactivate']) expect(d, k).toContain(`REACTIVATE_DIALOG.${k}`);
});
it('coach fields (4.2)', () => {
  const c = src('dashboard/prezenta/CoachFields.tsx');
  expect(c).toContain('PREZENTA_COPY.addCoaches');
  expect(c).toContain('setCoach(');
  expect(c).toContain('SearchableSelect');
});
it('the athlete search can hide anonymized athletes', () => {
  expect(src('dashboard/sportivi/AthleteSearch.tsx')).toMatch(/hideStatus\?: /);
});
```

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/prezenta/__tests__/admin-prezenta.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the three components and the `AthleteSearch` prop (default: nothing hidden, so P3 callers are unchanged).
- [ ] **Step 4: Run** the checks of Global Constraints; Expected: PASS (P3 sportivi tests unchanged).
- [ ] **Step 5: Commit**

```bash
git add src/admin/dashboard/prezenta/SessionPanel.tsx src/admin/dashboard/prezenta/CoachFields.tsx src/admin/dashboard/prezenta/InactiveDialog.tsx src/admin/dashboard/sportivi/AthleteSearch.tsx src/club/prezenta/__tests__/admin-prezenta.test.ts
git commit -m "feat(prezenta): session panel with coaches, ticks, visitors and reactivation"
```

---

### Task 5: Lecții individuale and Pe antrenori tabs, lesson window and panel (low)

**Files:**
- Create: `src/admin/dashboard/prezenta/LessonsTab.tsx`, `NewLessonWindow.tsx`, `LessonPanel.tsx`, `CoachesTab.tsx`
- Modify: `src/admin/dashboard/prezenta/PrezentaScreen.tsx` (mounts the two tabs), `src/club/prezenta/__tests__/admin-prezenta.test.ts`

**Interfaces:**
- Consumes: T1, T2, T4 (`CoachFields`); plan 5-2 `LESSON_COPY`, `ATTENDANCE_ERRORS`; 5-1 `monthTitle`, `addMonths`; P3 `AthleteSearch`; `durationOptions()`.
- Produces:
  - `MonthLine({ month, onMonth, action })` (in `LessonsTab.tsx`, exported for `CoachesTab` and the group tab): "<" `monthTitle(month)` ">" (hidden labels "Luna anterioară" / "Luna următoare") and the action button.
  - `LessonsTab({ month, onMonth })` (5.2, p5 Q26 A): button "+ Lecție individuală" (primary); columns "Data" | "Ora" | "Sportiv" | "Antrenor" | "Durată" | "Stare" (`listDate`, `durationText`, `stateWord`; a saved absent lesson's name muted, C48); "Nicio lecție individuală în luna asta."; phone `lessonCard`; a row opens `LessonPanel`.
  - `NewLessonWindow({ onClose })` ("Lecție nouă", 5.5): "Sportiv" (`AthleteSearch`, `hideStatus={['anonimizat']}`), "Data" (today), "Ora", "Durată" (`durationOptions()`, default 50), "Antrenor" (`CoachFields`, default from `api.lessonNew`); "Anulează" / "Salvează" (busy; decided 8); the answer's toast with "Anulează" (`undoToast`, plan 5-2 decided 12).
  - `LessonPanel({ id, onClose })` (5.5): title `lessonTitle(startTime)`, subtitle `longDayTitle(date)`; the athlete row with one `Checkbox` (ticked by default on a planned lesson, else `present`); "Antrenor" `CoachFields`; "Durată" `Select`; muted `savedLine`; red link "Șterge lecția" only when `deletable`, `ConfirmDialog` `LESSON_COPY.deleteConfirm(date)` with "Renunță" / "Șterge lecția" (decided 11), then `undoToast(api, LESSON_COPY.deleted, actionId)`; footer "Închide" / "Salvează" (toast "Salvat." or "Nicio modificare.", no undo).
  - `CoachesTab({ month, onMonth })` (5.2, p5 Q24 A): button "Export CSV" (`api.coachesCsv(month)`); columns "Antrenor" | "Ședințe grup" | "Lecții individuale" | "Ore"; "Nicio ședință salvată în luna asta.".

- [ ] **Step 1: Write the failing test** (append):

```ts
it('Lecții individuale: month line, columns, empty, cards (5.2)', () => {
  const t = src('dashboard/prezenta/LessonsTab.tsx');
  for (const k of ['newLesson', 'colDate', 'colTime', 'colAthlete', 'colCoach', 'colDuration', 'colState', 'emptyLessons', 'prevMonth', 'nextMonth'])
    expect(t, k).toContain(`PREZENTA_COPY.${k}`);
  expect(t).toContain('monthTitle(');
  expect(t).toContain('lessonCard(');
});
it('Lecție nouă: fields and undo toast (5.5)', () => {
  const w = src('dashboard/prezenta/NewLessonWindow.tsx');
  for (const k of ['newLessonTitle', 'colAthlete', 'colDate', 'colTime', 'colDuration', 'coach', 'cancel', 'save']) expect(w, k).toContain(`PREZENTA_COPY.${k}`);
  expect(w).toContain("hideStatus={['anonimizat']}");
  expect(w).toContain('undoToast(');
});
it('lesson panel: title, tick, delete only when deletable, with confirmation and undo (5.5, C49)', () => {
  const p = src('dashboard/prezenta/LessonPanel.tsx');
  expect(p).toContain('lessonTitle(');
  expect(p).toMatch(/deletable && [\s\S]*LESSON_COPY\.deleteLink/);
  expect(p).toContain('LESSON_COPY.deleteConfirm(');
  expect(p).toMatch(/undoToast\([^)]*LESSON_COPY\.deleted/);
});
it('Pe antrenori: columns, CSV, empty (5.2, p5 Q24)', () => {
  const c = src('dashboard/prezenta/CoachesTab.tsx');
  for (const k of ['exportCsv', 'colCoach', 'colGroupSessions', 'colLessons', 'colHours', 'emptyCoaches']) expect(c, k).toContain(`PREZENTA_COPY.${k}`);
  expect(c).toContain('api.coachesCsv(');
});
```

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/prezenta/__tests__/admin-prezenta.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the four components and mount them in `PrezentaScreen`.
- [ ] **Step 4: Run** the checks of Global Constraints; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/admin/dashboard/prezenta/LessonsTab.tsx src/admin/dashboard/prezenta/NewLessonWindow.tsx src/admin/dashboard/prezenta/LessonPanel.tsx src/admin/dashboard/prezenta/CoachesTab.tsx src/admin/dashboard/prezenta/PrezentaScreen.tsx src/club/prezenta/__tests__/admin-prezenta.test.ts
git commit -m "feat(prezenta): individual lessons and the Pe antrenori report"
```

---

### Task 6: Group page tab "Prezență" (low)

**Files:**
- Create: `src/admin/dashboard/grupe/PrezentaTab.tsx`
- Modify: `src/club/grupe/group-view.ts` (`GroupTab` and `groupTabs`), `src/club/grupe/__tests__/views.test.ts` (its `groupTabs` expectation), `src/admin/dashboard/grupe/GroupPage.tsx` (`SHOWN` and the tab body), `src/club/prezenta/__tests__/admin-prezenta.test.ts`

**Interfaces:**
- Consumes: T1, T3 (`NewSessionWindow` with `groupId`), T4 (`SessionPanel` with `readOnly`), T5 (`MonthLine`); P4 `writable(page)`, `GroupPage` data; plan 5-2 `GET /club/groups/:documentId/attendance`.
- Produces:
  - `GroupTab` gains `'prezenta'`; `groupTabs(page)` = Sportivi, Program, Prezență, Istoric (5.6, DEC 2026-10-27 phase 4 mockups 2); the tab label `PREZENTA_COPY.tabGroup`.
  - `PrezentaTab({ page })`: `MonthLine` (current month) with "+ Ședință nouă" (group preselected and locked) only when `writable(page)`; columns "Data" | "Ora" | "Prezenți" | "Antrenor" | "Stare"; `visitorsText(n)` under Prezenți when n > 0; "În afara programului" muted under the date; "nefăcută" coloured; "Nicio ședință în luna asta."; phone `sessionCard`; a row opens `SessionPanel` with `readOnly={!writable(page)}` (P4 W5); no roster grid (DEC 2026-10-11 prezenta-tab-v1 B).

- [ ] **Step 1: Write the failing test**

In `src/club/grupe/__tests__/views.test.ts` change the `groupTabs` expectation to `['sportivi', 'program', 'prezenta', 'istoric']` with labels `['Sportivi', 'Program', 'Prezență', 'Istoric']`. Append to `admin-prezenta.test.ts`:

```ts
it('group tab Prezență: between Program and Istoric, month list, read-only past season (5.6)', () => {
  const g = src('dashboard/grupe/GroupPage.tsx');
  expect(g).toMatch(/SHOWN[^\n]*'program', 'prezenta', 'istoric'/);
  const t = src('dashboard/grupe/PrezentaTab.tsx');
  for (const k of ['colDate', 'colTime', 'colPresent', 'colCoach', 'colState', 'emptyGroupMonth', 'newSession']) expect(t, k).toContain(`PREZENTA_COPY.${k}`);
  expect(t).toContain('visitorsText(');
  expect(t).toMatch(/writable\(page\) && [\s\S]*NewSessionWindow|writable\(page\) \?/);
  expect(t).toContain('readOnly={!writable(page)}');
  expect(t).toContain('groupId={page.documentId}');
});
```

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/grupe/__tests__/views.test.ts src/club/prezenta/__tests__/admin-prezenta.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the tab and the two edits.
- [ ] **Step 4: Run** the checks of Global Constraints; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/admin/dashboard/grupe/PrezentaTab.tsx src/admin/dashboard/grupe/GroupPage.tsx src/club/grupe/group-view.ts src/club/grupe/__tests__/views.test.ts src/club/prezenta/__tests__/admin-prezenta.test.ts
git commit -m "feat(grupe): group page tab Prezență"
```

---

### Task 7: Boot check on a throwaway Postgres and renders (low)

**Files:** none in the repo. Temporary files in `T=${TMPDIR:-/tmp}/es55`. PNGs go to `/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/mockups/screens/phase5-renders/` as `5-5-<name>-<desktop|phone>.png` (not committed by this task; the user reviews them).

**Interfaces:**
- Consumes: everything above; `scripts/fixtures/phase4-shape.js`, `scripts/fixtures/phase5-shape.js`; plan 5-2 Task 8's `seed-sub.js` pattern and curl helpers.
- Proves (spec 11.4 renders of 5.1 to 5.6, 5.16): menu with the four entries; Prezență Ședințe (today with an undone list, another day, an empty day, the start-date notice); "Ședință nouă" and its warning; the session panel (Școala unsaved with abonament status, Club saved with Grup, Uscat and a visitor, the inactive dialog, the close question, a read-only past-season panel); Lecții individuale; "Lecție nouă"; the lesson panel and its delete confirmation; Pe antrenori; the group tab Prezență; Setări site field; the three shells; each at 1440x900 and 390x844, compared with `p5-1-prezenta.html` (options A) and `p5-5-antrenori-individuale.html` (options A).

Container `es55-pg` on 127.0.0.1:55455, Strapi on 1375. Never 1337, 1340, 3010, 5432, 55442.

- [ ] **Step 1: Database, build, fixtures, data**

Run plan 5-2 Task 8 Step 5's commands with `es52` -> `es55`, `55452` -> `55455`, `1372` -> `1375`, plus `npx tsc --noEmit -p src/admin/tsconfig.json` and `node scripts/admin-ui-check.mjs --strict`. Then: set `attendanceStartDate` to the first day of the current month (`psql ... -c "update site_settings set attendance_start_date = date_trunc('month', now())::date"`); rename one school group to a 40-letter name and one athlete to a 40-letter name (wrap check); through the plan 5-2 routes: save one Școala session today (two athletes, one with the abonament), save one Club session yesterday with Grup, Uscat and a visitor, add one session out of the schedule, set one athlete Inactiv (`POST /club/athletes/:id/status`), create one lesson today and one next week.
Expected: every call 200; the day route lists at least one "nefăcută" in `undone`.

- [ ] **Step 2: Render script**

Write `$T/pass.py` on the plan 4-5 Task 7 pattern (login once, `storage_state`, both sizes, `page_errors`, `no_side_scroll`), steps:
  - `menu`: the sidebar labels of "Club și școală" -> `r['menu']`; screenshot `menu`.
  - `day`: `/plugins/edusport-prezenta` -> `sedinte-azi`; the "<" button -> `sedinte-alta-zi`; a date with nothing -> `sedinte-gol`; `r['undone_title']`, `r['day_title']`.
  - `new_session`: "+ Ședință nouă", fill the Club group, yesterday, the saved time -> `sedinta-noua`; "Continuă" -> `sedinta-existenta` (`r['existing_buttons']`).
  - `panel`: open today's Școala row -> `panou-scoala` (`r['school_headers']`, `r['abonament_texts']`); tick one, Escape -> `panou-inchizi`; open the Club row -> `panou-club` (`r['club_headers']`); tick the Inactiv athlete, "Salvează" -> `panou-inactiv`.
  - `lessons`: tab "Lecții individuale" -> `lectii`; "+ Lecție individuală" -> `lectie-noua`; open today's lesson -> `lectie-panou`; "Șterge lecția" -> `lectie-sterge`.
  - `coaches`: tab "Pe antrenori" -> `pe-antrenori` (`r['coach_rows']`).
  - `group_tab`: the Școala group page, tab "Prezență" -> `grupa-prezenta` (`r['group_tabs']`); the same group with `?season=<past>` and a row -> `grupa-prezenta-trecut` (`r['past_save_buttons']`).
  - `settings`: Setări site -> `setari-prezenta`; set the date empty in a second context to render the notice -> `sedinte-fara-data` (restore it after).
  - `shells`: Abonamente, Plăți, De încasat -> `abonamente-gol`, `plati-gol`, `de-incasat-gol`.
  - Every phone step records `no_side_scroll`.

Run: `python3 "$T/pass.py" "$T/ids.json" "$OUT" "$T/state.json"`. Adjust selectors to the real class names only (read the components); never change components to fit the script.

Expected (desktop; the same keys for phone with every `fits_*` True):

```
page_errors: []
menu: (contains, in order) Grupe, Sportivi, Prezență, Abonamente, Plăți, De încasat
undone_title: Nefăcute din zilele trecute (<n>)
day_title: Azi, <zi> <data>
existing_buttons: ['Deschide prezența salvată'] (same time) or both buttons
school_headers: ['Sportiv', 'Grup']
club_headers: ['Sportiv', 'Grup', 'Uscat']
abonament_texts: (contains) '7 ședințe rămase', 'Fără abonament'
coach_rows: (one row per coach with "Ore" like '0,8')
group_tabs: ['Sportivi', 'Program', 'Prezență', 'Istoric']
past_save_buttons: 0
```

- [ ] **Step 3: Look at the renders**

Open `phase5-renders/5-5-*.png` next to the two mockups (options A). Check: every text of spec 5.1 to 5.6 word for word; no em dash, no middle dot, straight quotes; no pill or circle; no dashed or dotted line; "nefăcută" coloured, "În afara programului" and "Salvată de ..." muted; long names wrap; phone screens without horizontal scroll and the panel full screen. Show them to the user in the companion. A fix goes into the owning task's files with a `fix(prezenta): ...` commit and the affected steps are repeated.

- [ ] **Step 4: Clean up**

Run: stop Strapi, `docker rm -f es55-pg`, `rm -rf "$T"`. Expected: container removed; the PNGs stay in the frontend repo for the user.

---

## Interfaces for other plans

- **Plan 5-6:** `ABONAMENTE_PATH`, `PLATI_PATH`, `DE_INCASAT_PATH` and the three shells (`AbonamentePage.tsx`, `PlatiPage.tsx`, `DeIncasatPage.tsx`) to fill; `SessionPanel` rows (`PanelRow` with `abonament`, `noSubscription`) and `LessonPanel` get their row "..." menus ("Adaugă abonament", "+ Plată"); `usePrezentaApi`, `undoToast`, `prezentaChanged`, `CoachFields`, `MonthLine`, the `AthleteSearch` `hideStatus` prop, `PREZENTA_CSS`.

## Self-review

- **Spec coverage.** 5.1 menu and routes (T1, T2); 5.2 title, tabs, notices (start date, no price list), Ședințe day line with "<", "Azi", ">" and a picker, "+ Ședință nouă", the undone section (hidden at 0), the day section titles, columns, "x din y", states, "În afara programului", empty day, coaches, row opens the panel, phone cards; Lecții individuale month line, button, columns, empty; Pe antrenori month line, CSV, columns, empty (T1, T3, T5); 5.3 title, subtitle, coaches with "+ Adaugă alți antrenori", columns per section, starting empty, abonament status, visitor main group, "+ Adaugă doar la ședința asta" without anonymized or listed athletes, footer, saved line, toast without undo, close question (T1, T4); 4.22 dialog (T4); 5.4 window, preselected group, Continuă with the 4.5 results (T3); 5.5 window, held or planned, panel, tick, "Șterge lecția" with confirmation and undo (T5); 5.6 tab order, month list, "Din alte grupe", read-only past season, empty month (T6); 3.8 / 5.16 Setări field (T2); 11.3 UI source tests (T2 to T6); 11.4 renders (T7). Row "..." menus of 5.3 and 5.5, the athlete tabs (5.7) and 5.8 to 5.15 are plan 5-6.
- **Step scan.** Pure steps carry the spec's values as assertions; component steps give props, the copy keys and the behaviour the source tests pin; no component body is written out.
- **Type consistency.** `SessionPanel` target (`{ id } | { occurrence } | { added }`) matches plan 5-2's `readPanelQuery`; `saveBody` returns plan 5-2's `SessionSaveBody` with `reactivate` and `keepInactive`; `readInactive` reads plan 5-2's `error.details.inactive`; `CoachFields` (T1 type, T4 component) is used by T3 and T5; `MonthLine` (T5) by T6.
- **Review Focus.** Close question (T1, T4), 409 handling (T1, T4, T7), past season (T4, T6, T7), empty states and no start date (T1, T3, T5, T6, T7), phone width with long names (T7): each has its test or render check.
- **Proportion.** Seven tasks for the Prezență screens; code blocks are the copy table, type signatures and test assertions.
