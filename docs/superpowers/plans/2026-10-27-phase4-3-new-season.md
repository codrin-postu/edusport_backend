# Phase 4-3: New Season ("Începe sezonul", per-group copies) (backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin start the next season from Sezoane in one window: the server gives the step 2 data (groups, members, programs, disabled boxes), computes the preview with the same planner that applies, makes the next season current and copies the ticked members (main group carried over by the W25 rule) and the programs running on the old season's last day, all in one transaction with an 8-second undo; and later, per group, copies the members or the program of the previous season into an empty tab.

**Architecture:** Pure planners in `src/club/groups/new-season/` (`detect.ts` next-season detection shared with the Sezoane screen, `facts.ts` the season facts, `start-data.ts` step 2, `plan.ts` the apply plan and the main rule, `preview.ts` tiles, lines, summary and toast texts, `copy-group.ts` the per-group empty-tab copies) with every string in `copy/new-season.ts`. `service.ts` loads the facts from the plan 4-1 `GroupStore`, refuses a stale request, and applies inside one transaction holding the two season rows then the copied athletes; the undo record (kind `season`, steps `setCurrentSeason`, `deleteMembership`, `deleteEvent`, guard `registrationsAfter`) goes through the plan 4-1 `POST /club/undo`. Routes live in `src/api/club/routes/08-new-season.ts`; the group page read gains `copyFrom`.

**Tech Stack:** Strapi 5.52.1 (TypeScript), Postgres 16, Vitest 3, Node 22.

**Spec:** `docs/superpowers/specs/2026-10-27-groups-schedules-design.md` (v1.1), section 10 (all of it, server side), 3.7 (season lines), 8.1, 11. Decisions: `../edusport_frontend/docs/portal/DECISIONS.md` ("phase 4 new season" 1 to 6, "phase 4 spec review"). Agent rules: `.superpowers/phase3-shared/agent-rules.md`. Index: `docs/superpowers/plans/2026-10-27-phase4-index.md`.

**Base:** `feat/athletes` with plans 4-1 and 4-2 merged. From 4-1: `GroupStore` (`lockSeason`, `setSeasonCurrent`, `registrationsFiledAfter`), `planJoin`, `currentRows`, `checkMainGroup`, `recordAction`, `done`, `UndoStep` `setCurrentSeason`, `P4_ACTIONS.currentChanged`, `seasonCopied`, `membersCopied`, `programCopied`, `athleteCopied`, `season-pick.ts`, `sections.ts`, `series.ts`, `GroupPage`, `readGroupPage`. From 4-2: `program-plan.ts` (`asCalendarRow`), `program-text.ts` texts.

**Parallel groups:** A: T1 | B: T2, T4 | C: T3 | D: T5 | E: T6

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Detection, facts, step 2 data, copy | plans 4-1, 4-2 | new files in `new-season/`, `copy/new-season.ts`, `copy.ts` |
| B | 2 Apply plan and preview texts, 4 Per-group copies | 1 | 2: plan.ts, preview.ts; 4: copy-group.ts, group-page.ts, api-types.ts |
| C | 3 Start service (read, preview, apply) | 2 | service.ts |
| D | 5 Routes and controller | 3, 4 | routes/08-new-season.ts, controllers/new-season.ts |
| E | 6 Boot check | everything | no repo files |

## Decided while planning (low impact, decided by Claude; the user may overrule any line)

Log them in DECISIONS.md as "plan 4-3, decided by Claude (low impact, 2026-10-27)".

1. **Toast forms** (W29): both parts "2027-2028 este sezonul curent. 14 sportivi și 10 programe copiate."; only members "2027-2028 este sezonul curent. 14 sportivi copiați." ("1 sportiv copiat."); only programs "... 10 programe copiate." ("1 program copiat."); nothing "2027-2028 este sezonul curent." (`copy/new-season.ts::startToast`).
2. **Summary box forms** (step 2): "Se copiază <n> sportivi în <k> grupe și programul a <m> grupe." keeps only the parts with a count above 0 ("Se copiază programul a 9 grupe.", "Se copiază 14 sportivi în 2 grupe."); nothing copied: "Nu se copiază nimic."; the second sentence leaves out "<x> sportivi rămân fără grupă" at 0 (one: "1 sportiv rămâne fără grupă") and "<y> inactivi nu se copiază" at 0 (one: "1 inactiv nu se copiază"); with both at 0 there is no second sentence (`copy/new-season.ts::summaryText`).
3. **"Grupa principală în <next>" for a child copied nowhere** (unticked in every group): "Fără grupă" (`copy/new-season.ts`, read by plan 4-6).
4. **The inactive count and names** (summary, preview line, step 2 "<k> inactivi") are the distinct Inactiv athletes with a current membership in any active group of the current season; they are never copied, whatever is ticked.
5. **"Sportivi copiați" tile hint** names the section after the groups when every copied group is in one section, with the section's tab label: "în 2 grupe Club", "în 7 grupe Școala de patinaj" (`preview.ts`).
6. **"Copiază sportivii" on a group whose members are all Inactiv** stays enabled (it has members) and copies none; the summary shows 0 for it.
7. **Apply re-plans under the locks**: the facts are read again after the two season rows and the athletes are locked, so a membership added a moment earlier on the new season is honoured ("not written twice", W25).
8. **Per-group copy (10.6) of a past season tab** is never offered (`copyFrom` null), and the routes answer 409 "Datele s-au schimbat. Reîncarcă pagina." for it.

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes`. Commit only in the worktree your dispatch names (never in p3be or p3fe); check `git rev-parse --show-toplevel` and `git branch --show-current` before every commit.
- A dated entry in `edusport_frontend/docs/portal/DECISIONS.md` wins over the spec; the spec wins over this plan's prose; this plan's code is followed verbatim unless it fails (fix the minimum, say what and why).
- Checks after every task: the task's tests, `npx vitest run`, `npx tsc --noEmit` (zero errors).
- Code: TypeScript, no `any`, single quotes in `src/`, functions under 30 lines, cyclomatic complexity under 10, no dead code, no comments that restate code. Planners in `new-season/` are pure (no Strapi, Node or React imports): the admin bundle (plan 4-6) imports `detect.ts`, `preview` types and the copy.
- Routes: `{ auth: false, policies: ['global::is-admin'], middlewares: [] }` (any admin, W22); static before parameter paths, `/club/seasons/:documentId/start/preview` before `/club/seasons/:documentId/start` (source-reading test).
- Lock order (binding): the two season rows (sorted by id), then the copied athletes (sorted by id); no registration lock; per-group copies: athletes then the group row; one transaction for the whole start (W24) and one for its undo.
- No e-mail is sent by the new season or the per-group copies (10.7). No `acs-membership` row is written. Group rows (name, section, price list, coaches, "Program public", order) are not written.
- `pingRevalidate` (through `ctx.revalidate()`) after the start, after its undo (the record's `revalidate: true`) and after a per-group program copy.
- Copy: every string in `src/club/groups/copy/new-season.ts`; the spec's texts verbatim; Romanian number forms ("1 sportiv", "20 de sportivi"); no em dash, no middle dot, straight quotes.
- Synthetic data only; never production, `strapi_app` / `strapi_db`, 1337, 5432, 1340, 3010, `edusport-test-pg`. Task 6 uses container `es43-pg` on 127.0.0.1:55443 and Strapi on 1363.
- Commits: Conventional Commits, exactly the message in the task, no `Co-Authored-By`, no AI attribution. Never push.
- Progress board: `printf '%s | 4-3 T<n> | implementer | <status>\n' "$(date -u +%H:%M)" >> /Users/codrin/Documents/Programming/edusport_backend/.superpowers/phase3-shared/progress-board.md`.

## Review Focus

- **The window is applied after something changed** (another admin made a season current, or the target became current in another tab, or the target was created twice): the apply answers 409 "Sezonul curent s-a schimbat. Reîncarcă pagina." and writes nothing; exactly one season is current afterwards. Pinned by Task 3 and Task 6.
- **A child already placed in the new season before the start** (added on 2027-2028 in September): the copy never writes the same group twice and the existing main group stays; the one-main rule holds for every copied child. Pinned by Task 2 (`existing main kept`) and Task 3 (`checkMainGroup` after writing).
- **Undo after the season moved on** (a registration filed under 2027-2028, a group program added, the season edited, a child moved): refused with "Nu se mai poate anula. Sezonul s-a schimbat între timp."; undo right away restores 2026-2027 as current and removes every row the start wrote. Pinned by Task 3 and Task 6.
- **A season started mid-way** (applied in November 2027 for 2027-2028): memberships start today, copied series start today, a biweekly series counts its weeks from that day; the preview tile says "din <today>". Pinned by Task 2 (`seriesFrom`).
- **Inactive and anonymized athletes**: never copied, never listed as children (anonymized), listed with "Inactiv, nu se copiază" (Inactiv), counted once in the summary and the preview line. Pinned by Task 1 and Task 2.

---

## File Structure

```
src/club/groups/
  copy/new-season.ts          NEW_SEASON_COPY, startToast, summaryText, step1Rows (T1, T2)
  copy.ts                     + export * from './copy/new-season' (T1)
  new-season/
    detect.ts                 startableLabel (pure, admin bundle too), nextSeasonOf (T1)
    facts.ts                  StartFacts, currentMembersOf, runningAtEnd, targetSeriesOf, copyable, seasonEndOf, seriesStart (T1)
    start-data.ts             StartAthlete, StartGroup, StartSection, StartData, startData (T1)
    plan.ts                   GroupTick, StartRequest, readStartRequest, PlannedMember, PlannedSeries, MainOutcome, StartPlan, planStart (T2)
    preview.ts                Tile, PreviewLine, ChildMain, StartPreview, startPreview, StartResult, startResult (T2)
    service.ts                loadStartFacts, readStart, previewStart, applyStart (T3)
    copy-group.ts             CopyFrom, copyFromFor, copyMembers, copyProgram (T4)
  group-page.ts               GroupPage.copyFrom (T4)
  api-types.ts                GroupPage.copyFrom?: CopyFrom | null (T4)
src/api/club/routes/08-new-season.ts, src/api/club/controllers/new-season.ts   (T5)
```

---

### Task 1: Next-season detection, facts, step 2 data and the copy

**Files:**
- Create: `src/club/groups/new-season/detect.ts`, `src/club/groups/new-season/facts.ts`, `src/club/groups/new-season/start-data.ts`, `src/club/groups/copy/new-season.ts`
- Modify: `src/club/groups/copy.ts` (one export line)
- Test: `src/club/groups/__tests__/new-season-data.test.ts`, helper `src/club/groups/__tests__/new-season-facts.ts`

**Interfaces:**
- Consumes: plan 4-1 (`currentRows`, `groupSeries`, `runningOn`, `seasonBounds`, `listLine`, `seriesText`, `orderedSections`, `sectionLabel`, `byGroupOrder`, `ageOnIso`, `startYear`, `currentSeason`, row types), `countWords`.
- Produces:
  - `startableLabel(seasons: { label: string; isCurrent: boolean }[]): string | null` (10.1, W23: the season labelled one year after the current one, not current itself); `nextSeasonOf(seasons): SeasonRecord | null`.
  - `StartFacts = { current; target; groups; sections; athletes; memberships; events; today }`; `copyable(a)` (Nou or Activ), `currentMembersOf(f, groupId)`, `runningAtEnd(f, groupId): SeriesView[]`, `targetSeriesOf(f, groupId)`, `seriesStart(f)` (later of the target start and today), `seasonEndOf(season)`.
  - `StartData = { current: { documentId; label }; target: { documentId; label; fee }; seriesFrom; seriesTo; sections: StartSection[] }`, `StartSection = { sectionId; label; groups: StartGroup[] }`, `StartGroup = { groupId; name; members; inactive; program; programState: 'ok' | 'none' | 'exists'; defaultMembers; defaultProgram; athletes: StartAthlete[] }`, `StartAthlete = { athleteId; name; age; inactive; currentMainGroupId }`; `startData(f): StartData`.
  - copy: `NEW_SEASON_COPY` (every text of 10.2 and 10.6), `step1Rows(current, target, fee)`, `summaryText(...)`, `startToast(...)`, `childNote(...)`.

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/new-season-facts.ts` (shared by the new-season tests):

```ts
import type { StartFacts } from '../new-season/facts';
import { G_GROUPS, G_SECTIONS, G_SEASONS, athleteRow, event, member } from './fake-group-store';

/** 2026-2027 current, 2027-2028 next; Filip in Intermediari Bronze (main) and Profesioniști, Ioana and Tudor (Inactiv) in Profesioniști, Ana in Intermediari Bronze. */
export const facts = (over: Partial<StartFacts> = {}): StartFacts => ({
  current: G_SEASONS[1], target: G_SEASONS[2], groups: G_GROUPS, sections: G_SECTIONS, today: '2027-09-15',
  athletes: [
    athleteRow({ id: 'a1', name: 'Filip Radu', birthDate: '2013-07-21' }), athleteRow({ id: 'a2', name: 'Ioana Marin' }),
    athleteRow({ id: 'a3', name: 'Tudor Matei', status: 'inactiv' }), athleteRow({ id: 'a4', name: 'Ana Ionescu' }), athleteRow({ id: 'a5', name: 'Sportiv anonimizat', status: 'anonimizat' }),
  ],
  memberships: [
    member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib', from: '2026-10-01' }), member({ id: 'm2', athleteId: 'a1', groupId: 'g-pro', isMain: false, from: '2026-10-15' }),
    member({ id: 'm3', athleteId: 'a2', groupId: 'g-pro' }), member({ id: 'm4', athleteId: 'a3', groupId: 'g-pro' }), member({ id: 'm5', athleteId: 'a4', groupId: 'g-ib' }),
    member({ id: 'm6', athleteId: 'a5', groupId: 'g-pro' }),
  ],
  events: [event({ id: 'e1' }), event({ id: 'e2', groupId: 'g-pro', type: 'curs', recurrence: { freq: 'weekly', days: ['tue', 'thu'], weekOfMonth: null, startTime: '18:00', endTime: '19:30', singleDate: null, seasonStart: '2026-10-01', seasonEnd: '2027-05-31' } })],
  ...over,
});
```

`src/club/groups/__tests__/new-season-data.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NEW_SEASON_COPY, startToast, step1Rows, summaryText } from '../copy';
import { nextSeasonOf, startableLabel } from '../new-season/detect';
import { startData } from '../new-season/start-data';
import { event } from './fake-group-store';
import { facts } from './new-season-facts';

describe('which season can be started (10.1, W23)', () => {
  it('is the one labelled a year after the current one', () => {
    expect(startableLabel([{ label: '2026-2027', isCurrent: true }, { label: '2027-2028', isCurrent: false }])).toBe('2027-2028');
    expect(startableLabel([{ label: '2026-2027', isCurrent: true }, { label: '2028-2029', isCurrent: false }])).toBeNull();
    expect(startableLabel([{ label: '2026-2027', isCurrent: false }, { label: '2027-2028', isCurrent: false }])).toBeNull();
    expect(nextSeasonOf(G_SEASONS)?.id).toBe('s27');
  });
});

describe('step 2 data (10.2)', () => {
  it('one table per section, active groups in order, counts, program at the season end, default ticks', () => {
    const data = startData(facts());
    expect(data.target).toEqual({ documentId: 's27', label: '2027-2028', fee: 200 });
    expect([data.seriesFrom, data.seriesTo]).toEqual(['2027-10-01', '2028-05-31']);
    expect(data.sections.map((s) => s.label)).toEqual(['Școala de patinaj', 'Club']);
    const ib = data.sections[0].groups.find((g) => g.groupId === 'g-ib');
    expect(ib).toMatchObject({ members: 2, inactive: 0, program: 'Sâ, Du 11:00', programState: 'ok', defaultMembers: false, defaultProgram: true });
    const pro = data.sections[1].groups.find((g) => g.groupId === 'g-pro');
    expect(pro).toMatchObject({ members: 3, inactive: 1, program: 'Ma, Jo 18:00', defaultMembers: true, defaultProgram: true });
    expect(pro?.athletes.map((a) => [a.name, a.inactive])).toEqual([['Filip Radu', false], ['Ioana Marin', false], ['Tudor Matei', true]]);
  });

  it('disables the program box without a running series or with one already in the new season (W26)', () => {
    const data = startData(facts({ events: [event({ id: 'e1', recurrence: { ...event({ id: 'x' }).recurrence, seasonEnd: '2027-03-31' } }), event({ id: 'e3', groupId: 'g-pro', recurrence: { ...event({ id: 'x' }).recurrence, seasonStart: '2027-10-02', seasonEnd: '2028-05-31' } })] }));
    expect(data.sections[0].groups.find((g) => g.groupId === 'g-ib')).toMatchObject({ programState: 'none', defaultProgram: false });
    expect(data.sections[1].groups.find((g) => g.groupId === 'g-pro')).toMatchObject({ programState: 'exists', defaultProgram: false });
  });
});

describe('copy (10.2, W29, decided 1 and 2)', () => {
  it('step 1 rows, the fee part left out without a fee', () => {
    expect(step1Rows('2026-2027', '2027-2028', 200)[0]).toEqual({ label: 'Înscrieri', value: 'Formularul trece pe 2027-2028, taxa de membru 200 RON. Deschis sau închis din Setări site, ca acum.' });
    expect(step1Rows('2026-2027', '2027-2028', null)[0].value).toBe('Formularul trece pe 2027-2028. Deschis sau închis din Setări site, ca acum.');
  });

  it('summary with its parts and forms', () => {
    expect(summaryText({ athletes: 14, groups: 2, programGroups: 9, unassigned: 73, inactive: 2 }))
      .toBe('Se copiază 14 sportivi în 2 grupe și programul a 9 grupe. 73 de sportivi rămân fără grupă, 2 inactivi nu se copiază.');
    expect(summaryText({ athletes: 0, groups: 0, programGroups: 9, unassigned: 1, inactive: 1 })).toBe('Se copiază programul a 9 grupe. 1 sportiv rămâne fără grupă, 1 inactiv nu se copiază.');
    expect(summaryText({ athletes: 0, groups: 0, programGroups: 0, unassigned: 0, inactive: 0 })).toBe('Nu se copiază nimic.');
  });

  it('toast with its parts', () => {
    expect(startToast('2027-2028', 14, 10)).toBe('2027-2028 este sezonul curent. 14 sportivi și 10 programe copiate.');
    expect(startToast('2027-2028', 0, 10)).toBe('2027-2028 este sezonul curent. 10 programe copiate.');
    expect(startToast('2027-2028', 1, 0)).toBe('2027-2028 este sezonul curent. 1 sportiv copiat.');
    expect(startToast('2027-2028', 0, 0)).toBe('2027-2028 este sezonul curent.');
  });

  it('keeps the window texts of the spec', () => {
    expect(NEW_SEASON_COPY.title('2027-2028')).toBe('Începe sezonul 2027-2028');
    expect(NEW_SEASON_COPY.stepOf(2)).toBe('Pasul 2 din 3');
    expect(NEW_SEASON_COPY.mainRule).toBe('Grupa principală rămâne aceeași dacă se copiază și ea. Altfel devine principală grupa copiată.');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/new-season-data.test.ts`
Expected: FAIL (`Cannot find module '../new-season/detect'`).

- [ ] **Step 3: Write `copy/new-season.ts` and its export**

`src/club/groups/copy/new-season.ts`:

```ts
import { countWords } from '../../ro-count';
import { athletesText, groupsText, seriesCountText } from './core';

/** "Începe sezonul <next>" (spec 10.2) and the per-group copies (10.6). */
export const NEW_SEASON_COPY = {
  button: (next: string) => `Începe sezonul ${next}`,
  title: (next: string) => `Începe sezonul ${next}`,
  stepOf: (n: number) => `Pasul ${n} din 3`,
  cancel: 'Anulează',
  next: 'Continuă',
  back: 'Înapoi',
  apply: (next: string) => `Începe sezonul ${next}`,
  lead1: (next: string) => `${next} devine sezonul curent. Se aplică abia la ultimul pas.`,
  onSite: 'Pe site',
  inPanel: 'În panou',
  lead2: (next: string, current: string) => `Toate grupele trec în ${next}. Alege ce copiezi din ${current}.`,
  colGroup: 'Grupă',
  colIn: (current: string) => `În ${current}`,
  colMembers: 'Copiază sportivii',
  colProgram: 'Copiază programul',
  inactiveSuffix: (k: number) => (k === 1 ? ', 1 inactiv' : `, ${k} inactivi`),
  seeAthletes: 'Vezi sportivii',
  hide: 'Ascunde',
  hideAthletes: 'Ascunde sportivii',
  noProgram: 'Fără program',
  hasProgram: (next: string) => `Are program în ${next}`,
  childHeader: 'Sportiv',
  childMainHeader: (next: string) => `Grupa principală în ${next}`,
  childInactive: 'Inactiv, nu se copiază',
  childNoGroup: 'Fără grupă',
  childKept: (current: string) => `ca în ${current}`,
  childChanged: (current: string, group: string) => `în ${current}: ${group}, care nu se copiază`,
  childMainShort: (group: string) => `Principală: ${group}`,
  phoneAllMembers: 'Sportivii, toate',
  phoneAllProgram: 'Programul, toate',
  phoneCard: (n: number, current: string) => `${athletesText(n)} în ${current}`,
  mainRule: 'Grupa principală rămâne aceeași dacă se copiază și ea. Altfel devine principală grupa copiată.',
  tileGroups: 'Grupe',
  tileGroupsHint: (next: string) => `toate trec în ${next}`,
  tileAthletes: 'Sportivi copiați',
  tileAthletesHint: (groups: number, section: string | null) => `în ${groupsText(groups)}${section ? ` ${section}` : ''}`,
  tileSeries: 'Programe copiate',
  tileSeriesHint: (from: string) => `din ${from}`,
  tileUnassigned: 'Fără grupă',
  tileUnassignedHint: (current: string) => `grupa din ${current} propusă`,
  mainChangesBold: (n: number) => `Grupa principală se schimbă pentru ${athletesText(n)}.`,
  mainKeptBold: (n: number) => `Rămâne aceeași pentru ${athletesText(n)}`,
  mainKeptRest: (name: string, group: string) => `, de exemplu ${name}: ${group}.`,
  inactiveBold: (n: number) => (n === 1 ? '1 sportiv inactiv nu se copiază:' : `${athletesText(n)} inactivi nu se copiază:`),
  unassignedBold: (n: number) => (n === 1 ? '1 sportiv intră la Fără grupă' : `${athletesText(n)} intră la Fără grupă`),
  unassignedRest: (next: string, current: string) => ` în ${next}, cu grupa principală din ${current} propusă.`,
  programBold: 'Programul se repetă',
  programRest: (from: string, to: string) => ` din ${from} până pe ${to}. Pauzele nu se copiază: adaugă vacanțele în Calendar și serii.`,
  acsBold: 'Membru A.C.S. nu se copiază.',
  acsRest: (next: string) => ` În ${next} toți pornesc de la Nu.`,
  schoolWarning: (next: string) => `Grupele Școlii nu au program în ${next}: pagina Program arată textul vechi până îl adaugi.`,
  emptyMembers: (season: string) => `Niciun sportiv în ${season}.`,
  copyMembers: (season: string) => `Copiază sportivii din ${season}`,
  copyMembersHint: (n: number, season: string, inactive: number) =>
    `${athletesText(n)} în ${season}${inactive ? `, ${inactive === 1 ? '1 inactiv nu se copiază' : `${inactive} inactivi nu se copiază`}` : ''}.`,
  emptyProgram: (season: string) => `Niciun program în ${season}.`,
  copyProgram: (season: string) => `Copiază programul din ${season}`,
  copyProgramHint: (season: string, program: string, from: string) => `În ${season}: ${program}. Se repetă din ${from}.`,
  membersCopiedToast: (n: number, season: string) => (n === 1 ? `1 sportiv copiat din ${season}.` : `${athletesText(n)} copiați din ${season}.`),
  programCopiedToast: (season: string) => `Program copiat din ${season}.`,
  seasonChanged: 'Sezonul curent s-a schimbat. Reîncarcă pagina.',
} as const;

export type Step1Row = { label: string; value: string };

/** Step 1 (10.2): "Pe site" rows then "În panou" rows; the fee part left out without a fee (W29). */
export function step1Rows(current: string, next: string, fee: number | null): Step1Row[] {
  const feePart = fee === null ? '' : `, taxa de membru ${fee} RON`;
  return [
    { label: 'Înscrieri', value: `Formularul trece pe ${next}${feePart}. Deschis sau închis din Setări site, ca acum.` },
    { label: 'Formular pe hârtie', value: `Sezonul ${next}.` },
    { label: 'Program', value: `Orarul Școlii se ia din programul grupelor în ${next}.` },
    { label: 'Calendar', value: 'Nu se schimbă. Arată fiecare dată din programul grupelor, din ambele sezoane.' },
    { label: 'Grupe, Sportivi', value: `Se deschid pe ${next}.` },
    { label: current, value: 'Rămâne de citit în Grupe, nu se mai modifică.' },
    { label: 'Membru A.C.S.', value: `Pe sezon, nu se copiază. În ${next} toți pornesc de la Nu.` },
  ];
}

export type SummaryCounts = { athletes: number; groups: number; programGroups: number; unassigned: number; inactive: number };

function copiedSentence(c: SummaryCounts): string {
  const parts = [c.athletes > 0 ? `${athletesText(c.athletes)} în ${groupsText(c.groups)}` : '', c.programGroups > 0 ? `programul a ${groupsText(c.programGroups)}` : ''].filter(Boolean);
  return parts.length ? `Se copiază ${parts.join(' și ')}.` : 'Nu se copiază nimic.';
}

/** The summary box under the tables (10.2, decided 2). */
export function summaryText(c: SummaryCounts): string {
  const rest = [
    c.unassigned === 1 ? '1 sportiv rămâne fără grupă' : c.unassigned > 0 ? `${athletesText(c.unassigned)} rămân fără grupă` : '',
    c.inactive === 1 ? '1 inactiv nu se copiază' : c.inactive > 0 ? `${countWords(c.inactive, 'inactiv', 'inactivi')} nu se copiază` : '',
  ].filter(Boolean);
  return rest.length ? `${copiedSentence(c)} ${rest.join(', ')}.` : copiedSentence(c);
}

/** The toast after applying (10.5, W29, decided 1). */
export function startToast(next: string, athletes: number, series: number): string {
  const lead = `${next} este sezonul curent.`;
  if (athletes > 0 && series > 0) return `${lead} ${athletesText(athletes)} și ${seriesCountText(series)} copiate.`;
  if (athletes > 0) return `${lead} ${athletes === 1 ? '1 sportiv copiat' : `${athletesText(athletes)} copiați`}.`;
  if (series > 0) return `${lead} ${series === 1 ? '1 program copiat' : `${seriesCountText(series)} copiate`}.`;
  return lead;
}
```

`src/club/groups/copy.ts`, add:

```ts
export * from './copy/new-season';
```

- [ ] **Step 4: Write `detect.ts`, `facts.ts` and `start-data.ts`**

`src/club/groups/new-season/detect.ts`:

```ts
import type { SeasonRecord } from '../types';

type Labelled = { label: string; isCurrent: boolean };
const year = (label: string): number => Number(label.slice(0, 4));

/** The label of the season "Începe sezonul" applies to: one year after the current one, not current itself (10.1, W23). Pure. */
export function startableLabel(seasons: Labelled[]): string | null {
  const current = [...seasons].filter((s) => s.isCurrent).sort((a, b) => b.label.localeCompare(a.label))[0];
  if (!current) return null;
  return seasons.find((s) => !s.isCurrent && year(s.label) === year(current.label) + 1)?.label ?? null;
}

export function nextSeasonOf(seasons: SeasonRecord[]): SeasonRecord | null {
  const label = startableLabel(seasons);
  return label ? seasons.find((s) => s.label === label) ?? null : null;
}
```

`src/club/groups/new-season/facts.ts`:

```ts
import type { AthleteRow, MembershipRow } from '../../athletes/store';
import { currentRows } from '../membership-plan';
import { groupSeries, runningOn, seasonBounds, type SeriesView } from '../series';
import type { EventRecord, GroupRecord, SeasonRecord, SectionRecord } from '../types';

/** Everything the new-season planners read (spec 10). `memberships` holds every row of both seasons. */
export type StartFacts = {
  current: SeasonRecord; target: SeasonRecord; groups: GroupRecord[]; sections: SectionRecord[]; athletes: AthleteRow[];
  memberships: MembershipRow[]; events: EventRecord[]; today: string;
};

/** Only Nou and Activ athletes are copied (10.3); Inactiv and anonymized never. */
export const copyable = (a: AthleteRow | undefined): a is AthleteRow => !!a && (a.status === 'nou' || a.status === 'activ');
export const seasonEndOf = (s: SeasonRecord): string => seasonBounds(s).end;

export const currentMembersOf = (f: StartFacts, groupId: string): MembershipRow[] =>
  f.memberships.filter((m) => m.groupId === groupId && m.seasonId === f.current.id && !m.to);

export const targetRowsOf = (f: StartFacts, athleteId: string): MembershipRow[] => currentRows(f.memberships, athleteId, f.target.id);

/** Series still running on the current season's last day: "Program obișnuit" at the season end (10.3, W27). */
export const runningAtEnd = (f: StartFacts, groupId: string): SeriesView[] =>
  groupSeries(f.events, groupId, f.current).filter((s) => runningOn(s, seasonEndOf(f.current)));

export const targetSeriesOf = (f: StartFacts, groupId: string): SeriesView[] => groupSeries(f.events, groupId, f.target);

/** New series and memberships start on the later of the new season's start and today (10.3, W27). */
export function seriesStart(f: StartFacts): string {
  const start = seasonBounds(f.target).start;
  return f.today > start ? f.today : start;
}
```

`src/club/groups/new-season/start-data.ts`:

```ts
import { listLine } from '../program-text';
import { ageOnIso } from '../season-pick';
import { byGroupOrder, orderedSections, sectionLabel } from '../sections';
import { seriesText } from '../series';
import type { GroupRecord } from '../types';
import { currentMembersOf, runningAtEnd, seasonEndOf, seriesStart, targetSeriesOf, type StartFacts } from './facts';

/** Step 2 of the window (10.2): per section, the active groups with members, program and the default ticks. Pure. */
export type StartAthlete = { athleteId: string; name: string; age: number | null; inactive: boolean; currentMainGroupId: string | null };
export type StartGroup = {
  groupId: string; name: string; members: number; inactive: number; program: string; programState: 'ok' | 'none' | 'exists';
  defaultMembers: boolean; defaultProgram: boolean; athletes: StartAthlete[];
};
export type StartSection = { sectionId: string; label: string; groups: StartGroup[] };
export type StartData = {
  current: { documentId: string; label: string }; target: { documentId: string; label: string; fee: number | null };
  seriesFrom: string; seriesTo: string; sections: StartSection[];
};

function athletesOf(f: StartFacts, groupId: string): StartAthlete[] {
  return currentMembersOf(f, groupId)
    .map((m) => ({ m, a: f.athletes.find((x) => x.id === m.athleteId) }))
    .filter(({ a }) => !!a && a.status !== 'anonimizat')
    .map(({ m, a }) => ({
      athleteId: m.athleteId, name: a?.name ?? '', age: ageOnIso(a?.birthDate ?? null, f.today), inactive: a?.status === 'inactiv',
      currentMainGroupId: f.memberships.find((r) => r.athleteId === m.athleteId && r.seasonId === f.current.id && r.isMain && !r.to)?.groupId ?? null,
    }))
    .sort((x, y) => x.name.localeCompare(y.name, 'ro'));
}

function groupRow(f: StartFacts, g: GroupRecord, kind: 'school' | 'club'): StartGroup {
  const athletes = athletesOf(f, g.id);
  const running = runningAtEnd(f, g.id);
  const programState = targetSeriesOf(f, g.id).length ? 'exists' : running.length ? 'ok' : 'none';
  return {
    groupId: g.id, name: g.name, members: athletes.length, inactive: athletes.filter((a) => a.inactive).length,
    program: running.map((s) => listLine(seriesText(s))).join(', '), programState,
    defaultMembers: kind === 'club' && athletes.length > 0, defaultProgram: programState === 'ok', athletes,
  };
}

export function startData(f: StartFacts): StartData {
  const sections = orderedSections(f.sections).map((s) => ({
    sectionId: s.id, label: sectionLabel(s, f.sections),
    groups: f.groups.filter((g) => g.active && g.sectionId === s.id).sort(byGroupOrder).map((g) => groupRow(f, g, s.kind)),
  }));
  return {
    current: { documentId: f.current.id, label: f.current.label }, target: { documentId: f.target.id, label: f.target.label, fee: f.target.membershipFee },
    seriesFrom: seriesStart(f), seriesTo: seasonEndOf(f.target), sections: sections.filter((s) => s.groups.length > 0),
  };
}
```

- [ ] **Step 5: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/new-season-data.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 6: Commit**

```bash
git add src/club/groups/new-season src/club/groups/copy/new-season.ts src/club/groups/copy.ts src/club/groups/__tests__/new-season-data.test.ts src/club/groups/__tests__/new-season-facts.ts
git commit -m "feat(new-season): next-season detection, step 2 data and the window copy"
```

---
### Task 2: The apply plan (main rule, copies) and the preview texts

**Files:**
- Create: `src/club/groups/new-season/plan.ts`, `src/club/groups/new-season/preview.ts`
- Test: `src/club/groups/__tests__/new-season-plan.test.ts`

**Interfaces:**
- Consumes: Task 1 (`StartFacts`, `copyable`, `currentMembersOf`, `targetRowsOf`, `runningAtEnd`, `targetSeriesOf`, `seriesStart`, `seasonEndOf`, copy), plan 4-1 (`currentRows`, `seriesText`, `sectionLabel`, `shortDate`, `ARROW`).
- Produces:
  - `GroupTick = { groupId; copyMembers; excludeAthleteIds; copyProgram }`, `StartRequest = { groups: GroupTick[] }`, `readStartRequest(body): StartRequest | null`.
  - `PlannedMember = { athleteId; groupId; isMain; from }`, `PlannedSeries = { groupId; write: EventWrite; text: SeriesText }`, `MainOutcome = { athleteId; name; groupId; previousGroupId }`, `StartPlan = { members; series; mains; inactive: { athleteId; name }[]; unassignedAfter; seriesFrom; seriesTo }`, `mainFor(f, athleteId, groupIds)`, `planStart(f, req): StartPlan`.
  - `Tile`, `PreviewLine = { bold; rest }`, `ChildMain = { groupId; groupName; previousName; kept }`, `StartPreview = { summary; tiles; lines; warning; mains: Record<athleteId, ChildMain> }`, `startPreview(f, plan)`; `StartResult = { season; copied: { athletes; groups; series }; unassigned; toast }`, `startResult(f, plan)`.

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/new-season-plan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mainFor, planStart, readStartRequest, type StartRequest } from '../new-season/plan';
import { startPreview, startResult } from '../new-season/preview';
import { member } from './fake-group-store';
import { facts } from './new-season-facts';

const tick = (groupId: string, copyMembers: boolean, copyProgram = true, excludeAthleteIds: string[] = []) => ({ groupId, copyMembers, copyProgram, excludeAthleteIds });
const CLUB_ONLY: StartRequest = { groups: [tick('g-ib', false), tick('g-pro', true)] };

describe('reading the request', () => {
  it('needs a group id per row; booleans default to false', () => {
    expect(readStartRequest({ groups: [{ groupId: 'g-ib', copyMembers: true }] })).toEqual({ groups: [{ groupId: 'g-ib', copyMembers: true, copyProgram: false, excludeAthleteIds: [] }] });
    expect(readStartRequest({ groups: [{ copyMembers: true }] })).toBeNull();
  });
});

describe('who is copied (10.3)', () => {
  it('copies Nou and Activ members of ticked groups from the later of the season start and today; Inactiv and anonymized never', () => {
    const plan = planStart(facts(), CLUB_ONLY);
    expect(plan.members).toEqual([
      { athleteId: 'a1', groupId: 'g-pro', isMain: true, from: '2027-10-01' }, { athleteId: 'a2', groupId: 'g-pro', isMain: true, from: '2027-10-01' },
    ]);
    expect(plan.inactive).toEqual([{ athleteId: 'a3', name: 'Tudor Matei' }]);
    expect(plan.unassignedAfter).toBe(1);
  });

  it('an unticked child is not copied into that group only (W26)', () => {
    const plan = planStart(facts(), { groups: [tick('g-ib', true), tick('g-pro', true, true, ['a1'])] });
    expect(plan.members.filter((m) => m.athleteId === 'a1')).toEqual([{ athleteId: 'a1', groupId: 'g-ib', isMain: true, from: '2027-10-01' }]);
  });

  it('never writes a group twice; an existing main in the new season stays (W25, Review Focus)', () => {
    const f = facts({ memberships: [...facts().memberships, member({ id: 'm9', athleteId: 'a2', groupId: 'g-pro', seasonId: 's27', from: '2027-09-01' }), member({ id: 'm10', athleteId: 'a1', groupId: 'g-av', seasonId: 's27', from: '2027-09-01' })] });
    const plan = planStart(f, CLUB_ONLY);
    expect(plan.members).toEqual([{ athleteId: 'a1', groupId: 'g-pro', isMain: false, from: '2027-10-01' }]);
  });
});

describe('the main group (W25)', () => {
  it('last season\'s main when it is copied; else the copied group joined earliest, then the group order', () => {
    const f = facts();
    expect(mainFor(f, 'a1', ['g-pro', 'g-ib'])).toBe('g-ib');
    expect(mainFor(f, 'a1', ['g-pro'])).toBe('g-pro');
    expect(mainFor(facts({ memberships: [member({ id: 'x1', athleteId: 'a9', groupId: 'g-pp', isMain: true }), member({ id: 'x2', athleteId: 'a9', groupId: 'g-av', isMain: false, from: '2026-10-01' }), member({ id: 'x3', athleteId: 'a9', groupId: 'g-pro', isMain: false, from: '2026-10-01' })] }), 'a9', ['g-av', 'g-pro'])).toBe('g-pro');
  });
});

describe('programs copied (10.3, W27)', () => {
  it('copies the series running on the old season\'s last day into the new window, title = current name, no exceptions', () => {
    const plan = planStart(facts(), CLUB_ONLY);
    expect(plan.series.map((s) => [s.groupId, s.write.title, s.write.recurrence.seasonStart, s.write.recurrence.seasonEnd, s.write.exceptions.length])).toEqual([
      ['g-ib', 'Intermediari Bronze', '2027-10-01', '2028-05-31', 0], ['g-pro', 'Profesioniști', '2027-10-01', '2028-05-31', 0],
    ]);
    expect(plan.series[1].write.recurrence).toMatchObject({ freq: 'weekly', days: ['tue', 'thu'], startTime: '18:00', endTime: '19:30' });
  });

  it('a season started mid-way copies from today (Review Focus)', () => {
    const plan = planStart(facts({ today: '2027-11-03' }), CLUB_ONLY);
    expect([plan.seriesFrom, plan.members[0].from, plan.series[0].write.recurrence.seasonStart]).toEqual(['2027-11-03', '2027-11-03', '2027-11-03']);
  });

  it('does not copy into a group that already has a series in the new season', () => {
    const f = facts({ events: [...facts().events, { ...facts().events[0], id: 'e9', recurrence: { ...facts().events[0].recurrence, seasonStart: '2027-10-04', seasonEnd: '2028-05-31' } }] });
    expect(planStart(f, CLUB_ONLY).series.map((s) => s.groupId)).toEqual(['g-pro']);
  });
});

describe('preview (10.2 step 3, decided 5)', () => {
  it('tiles, lines with bold parts, the always-present A.C.S. line, child mains', () => {
    const f = facts();
    const preview = startPreview(f, planStart(f, CLUB_ONLY));
    expect(preview.tiles).toEqual([
      { label: 'Grupe', value: '5', hint: 'toate trec în 2027-2028' }, { label: 'Sportivi copiați', value: '2', hint: 'în 1 grupă Club' },
      { label: 'Programe copiate', value: '2', hint: 'din 1 oct 2027' }, { label: 'Fără grupă', value: '1', hint: 'grupa din 2026-2027 propusă' },
    ]);
    expect(preview.lines).toEqual([
      { bold: 'Grupa principală se schimbă pentru 1 sportiv.', rest: ' Filip Radu: Intermediari Bronze → Profesioniști.' },
      { bold: 'Rămâne aceeași pentru 1 sportiv', rest: ', de exemplu Ioana Marin: Profesioniști.' },
      { bold: '1 sportiv inactiv nu se copiază:', rest: ' Tudor Matei.' },
      { bold: '1 sportiv intră la Fără grupă', rest: ' în 2027-2028, cu grupa principală din 2026-2027 propusă.' },
      { bold: 'Programul se repetă', rest: ' din 1 oct 2027 până pe 31 mai 2028. Pauzele nu se copiază: adaugă vacanțele în Calendar și serii.' },
      { bold: 'Membru A.C.S. nu se copiază.', rest: ' În 2027-2028 toți pornesc de la Nu.' },
    ]);
    expect(preview.summary).toBe('Se copiază 2 sportivi în 1 grupă și programul a 2 grupe. 1 sportiv rămâne fără grupă, 1 inactiv nu se copiază.');
    expect(preview.mains.a1).toEqual({ groupId: 'g-pro', groupName: 'Profesioniști', previousName: 'Intermediari Bronze', kept: false });
    expect(preview.warning).toBeNull();
  });

  it('warns when no school group gets a program, and leaves out lines whose count is 0', () => {
    const f = facts();
    const preview = startPreview(f, planStart(f, { groups: [tick('g-ib', false, false), tick('g-pro', false, false)] }));
    expect(preview.warning).toBe('Grupele Școlii nu au program în 2027-2028: pagina Program arată textul vechi până îl adaugi.');
    expect(preview.lines.map((l) => l.bold)).toEqual(['1 sportiv inactiv nu se copiază:', '3 sportivi intră la Fără grupă', 'Membru A.C.S. nu se copiază.']);
  });

  it('the result carries the toast', () => {
    const f = facts();
    expect(startResult(f, planStart(f, CLUB_ONLY))).toEqual({ season: '2027-2028', copied: { athletes: 2, groups: 1, series: 2 }, unassigned: 1, toast: '2027-2028 este sezonul curent. 2 sportivi și 2 programe copiate.' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/new-season-plan.test.ts`
Expected: FAIL (`Cannot find module '../new-season/plan'`).

- [ ] **Step 3: Write `plan.ts`**

```ts
import type { MembershipRow } from '../../athletes/store';
import { currentRows } from '../membership-plan';
import type { SeriesText } from '../program-text';
import { seriesText, type SeriesView } from '../series';
import type { EventWrite, GroupRecord } from '../types';
import { copyable, currentMembersOf, runningAtEnd, seasonEndOf, seriesStart, targetRowsOf, targetSeriesOf, type StartFacts } from './facts';

/** What "Începe sezonul" writes (spec 10.3, W25 to W27). Pure: preview and apply run the same function. */
export type GroupTick = { groupId: string; copyMembers: boolean; excludeAthleteIds: string[]; copyProgram: boolean };
export type StartRequest = { groups: GroupTick[] };
export type PlannedMember = { athleteId: string; groupId: string; isMain: boolean; from: string };
export type PlannedSeries = { groupId: string; write: EventWrite; text: SeriesText };
export type MainOutcome = { athleteId: string; name: string; groupId: string; previousGroupId: string | null };
export type StartPlan = {
  members: PlannedMember[]; series: PlannedSeries[]; mains: MainOutcome[]; inactive: { athleteId: string; name: string }[];
  unassignedAfter: number; seriesFrom: string; seriesTo: string;
};

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function readStartRequest(body: unknown): StartRequest | null {
  const list = isRecord(body) && Array.isArray(body.groups) ? body.groups : null;
  if (!list) return null;
  const groups = list.filter(isRecord).map((g) => ({
    groupId: typeof g.groupId === 'string' ? g.groupId : '', copyMembers: g.copyMembers === true, copyProgram: g.copyProgram === true, excludeAthleteIds: ids(g.excludeAthleteIds),
  }));
  return groups.length === list.length && groups.every((g) => g.groupId) ? { groups } : null;
}

const activeGroup = (f: StartFacts, id: string): GroupRecord | undefined => f.groups.find((g) => g.id === id && g.active);

/** Per athlete, the groups the start copies them into: ticked, not unticked, Nou or Activ, not already in that group in the new season. */
function copiesOf(f: StartFacts, req: StartRequest): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const t of req.groups.filter((x) => x.copyMembers && activeGroup(f, x.groupId))) {
    for (const m of currentMembersOf(f, t.groupId)) {
      const a = f.athletes.find((x) => x.id === m.athleteId);
      if (!copyable(a) || t.excludeAthleteIds.includes(a.id) || targetRowsOf(f, a.id).some((r) => r.groupId === t.groupId)) continue;
      out.set(a.id, [...(out.get(a.id) ?? []), t.groupId]);
    }
  }
  return out;
}

const oldRows = (f: StartFacts, athleteId: string): MembershipRow[] => currentRows(f.memberships, athleteId, f.current.id);
const orderOf = (f: StartFacts, groupId: string): number => f.groups.find((g) => g.id === groupId)?.order ?? 9999;

/** W25: an existing main in the new season stays (null: no copy is main); else last season's main if copied; else the earliest joined, then the group order. */
export function mainFor(f: StartFacts, athleteId: string, groupIds: string[]): string | null {
  if (targetRowsOf(f, athleteId).some((r) => r.isMain)) return null;
  const rows = oldRows(f, athleteId);
  const oldMain = rows.find((r) => r.isMain)?.groupId;
  if (oldMain && groupIds.includes(oldMain)) return oldMain;
  const joined = (id: string) => rows.find((r) => r.groupId === id)?.from ?? '9999-12-31';
  return [...groupIds].sort((a, b) => joined(a).localeCompare(joined(b)) || orderOf(f, a) - orderOf(f, b))[0] ?? null;
}

function plannedMembers(f: StartFacts, copies: Map<string, string[]>): PlannedMember[] {
  const from = seriesStart(f);
  return [...copies.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([athleteId, groupIds]) => {
    const main = mainFor(f, athleteId, groupIds);
    return groupIds.map((groupId) => ({ athleteId, groupId, isMain: groupId === main, from }));
  });
}

function mainsOf(f: StartFacts, members: PlannedMember[]): MainOutcome[] {
  const athleteIds = [...new Set(members.map((m) => m.athleteId))];
  return athleteIds.map((id) => {
    const target = members.find((m) => m.athleteId === id && m.isMain)?.groupId ?? targetRowsOf(f, id).find((r) => r.isMain)?.groupId ?? '';
    return { athleteId: id, name: f.athletes.find((a) => a.id === id)?.name ?? '', groupId: target, previousGroupId: oldRows(f, id).find((r) => r.isMain)?.groupId ?? null };
  });
}

function seriesCopy(f: StartFacts, group: GroupRecord, s: SeriesView): PlannedSeries {
  const from = seriesStart(f);
  const type = f.events.find((e) => e.id === s.eventId)?.type ?? 'curs';
  const write: EventWrite = {
    title: group.name, type, description: null, groupId: group.id, exceptions: [],
    recurrence: { freq: s.freq, days: s.days, weekOfMonth: s.weekOfMonth, startTime: s.startTime, endTime: s.endTime, singleDate: null, seasonStart: from, seasonEnd: seasonEndOf(f.target) },
  };
  return { groupId: group.id, write, text: { ...seriesText(s), from } };
}

function plannedSeries(f: StartFacts, req: StartRequest): PlannedSeries[] {
  return req.groups.filter((t) => t.copyProgram && !targetSeriesOf(f, t.groupId).length).flatMap((t) => {
    const group = activeGroup(f, t.groupId);
    return group ? runningAtEnd(f, t.groupId).map((s) => seriesCopy(f, group, s)) : [];
  });
}

/** Decided 4: distinct Inactiv athletes with a current membership in an active group of the current season. */
function inactiveOf(f: StartFacts): { athleteId: string; name: string }[] {
  const placed = new Set(f.memberships.filter((m) => m.seasonId === f.current.id && !m.to && activeGroup(f, m.groupId)).map((m) => m.athleteId));
  return f.athletes.filter((a) => placed.has(a.id) && a.status === 'inactiv').map((a) => ({ athleteId: a.id, name: a.name ?? '' })).sort((x, y) => x.name.localeCompare(y.name, 'ro'));
}

export function planStart(f: StartFacts, req: StartRequest): StartPlan {
  const copies = copiesOf(f, req);
  const members = plannedMembers(f, copies);
  return {
    members, series: plannedSeries(f, req), mains: mainsOf(f, members), inactive: inactiveOf(f),
    unassignedAfter: f.athletes.filter((a) => copyable(a) && !copies.has(a.id) && !targetRowsOf(f, a.id).length).length,
    seriesFrom: seriesStart(f), seriesTo: seasonEndOf(f.target),
  };
}
```

- [ ] **Step 4: Write `preview.ts`**

```ts
import { ARROW, NEW_SEASON_COPY, startToast, summaryText } from '../copy';
import { shortDate } from '../dates';
import { sectionLabel } from '../sections';
import { seriesStart, targetSeriesOf, type StartFacts } from './facts';
import type { MainOutcome, StartPlan } from './plan';

/** Step 3 of the window and the toast (10.2, 10.5, W29). Pure; counts come from the plan the apply uses. */
export type Tile = { label: string; value: string; hint: string };
export type PreviewLine = { bold: string; rest: string };
export type ChildMain = { groupId: string; groupName: string; previousName: string | null; kept: boolean };
export type StartPreview = { summary: string; tiles: Tile[]; lines: PreviewLine[]; warning: string | null; mains: Record<string, ChildMain> };
export type StartResult = { season: string; copied: { athletes: number; groups: number; series: number }; unassigned: number; toast: string };

const C = NEW_SEASON_COPY;
const nameOf = (f: StartFacts, id: string | null): string => f.groups.find((g) => g.id === id)?.name ?? '';
const copiedGroupIds = (plan: StartPlan): string[] => [...new Set(plan.members.map((m) => m.groupId))];
const copiedAthletes = (plan: StartPlan): number => new Set(plan.members.map((m) => m.athleteId)).size;
const programGroups = (plan: StartPlan): number => new Set(plan.series.map((s) => s.groupId)).size;

function oneSection(f: StartFacts, groupIds: string[]): string | null {
  const ids = new Set(groupIds.map((id) => f.groups.find((g) => g.id === id)?.sectionId));
  const section = ids.size === 1 ? f.sections.find((s) => ids.has(s.id)) : undefined;
  return section ? sectionLabel(section, f.sections) : null;
}

function tiles(f: StartFacts, plan: StartPlan): Tile[] {
  const groups = copiedGroupIds(plan);
  return [
    { label: C.tileGroups, value: String(f.groups.filter((g) => g.active).length), hint: C.tileGroupsHint(f.target.label) },
    { label: C.tileAthletes, value: String(copiedAthletes(plan)), hint: C.tileAthletesHint(groups.length, oneSection(f, groups)) },
    { label: C.tileSeries, value: String(plan.series.length), hint: C.tileSeriesHint(shortDate(seriesStart(f))) },
    { label: C.tileUnassigned, value: String(plan.unassignedAfter), hint: C.tileUnassignedHint(f.current.label) },
  ];
}

function mainLines(f: StartFacts, mains: MainOutcome[]): PreviewLine[] {
  const changed = mains.filter((m) => m.previousGroupId && m.previousGroupId !== m.groupId);
  const kept = mains.filter((m) => m.previousGroupId === m.groupId).sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const lines: PreviewLine[] = [];
  if (changed.length) lines.push({ bold: C.mainChangesBold(changed.length), rest: changed.map((m) => ` ${m.name}: ${nameOf(f, m.previousGroupId)} ${ARROW} ${nameOf(f, m.groupId)}.`).join('') });
  if (kept.length) lines.push({ bold: C.mainKeptBold(kept.length), rest: C.mainKeptRest(kept[0].name, nameOf(f, kept[0].groupId)) });
  return lines;
}

function otherLines(f: StartFacts, plan: StartPlan): PreviewLine[] {
  const lines: PreviewLine[] = [];
  if (plan.inactive.length) lines.push({ bold: C.inactiveBold(plan.inactive.length), rest: ` ${plan.inactive.map((a) => a.name).join(', ')}.` });
  if (plan.unassignedAfter) lines.push({ bold: C.unassignedBold(plan.unassignedAfter), rest: C.unassignedRest(f.target.label, f.current.label) });
  if (plan.series.length) lines.push({ bold: C.programBold, rest: C.programRest(shortDate(plan.seriesFrom), shortDate(plan.seriesTo)) });
  lines.push({ bold: C.acsBold, rest: C.acsRest(f.target.label) });
  return lines;
}

/** W29: the warning when no school group will have a program in the new season (9.1 fallback). */
function schoolWarning(f: StartFacts, plan: StartPlan): string | null {
  const schools = new Set(f.sections.filter((s) => s.kind === 'school').map((s) => s.id));
  const covered = f.groups.some((g) => g.active && schools.has(g.sectionId ?? '') && (targetSeriesOf(f, g.id).length || plan.series.some((s) => s.groupId === g.id)));
  return covered ? null : C.schoolWarning(f.target.label);
}

const childMains = (f: StartFacts, mains: MainOutcome[]): Record<string, ChildMain> => Object.fromEntries(mains.map((m) => [m.athleteId, {
  groupId: m.groupId, groupName: nameOf(f, m.groupId), previousName: m.previousGroupId ? nameOf(f, m.previousGroupId) : null, kept: m.previousGroupId === m.groupId,
}]));

export function startPreview(f: StartFacts, plan: StartPlan): StartPreview {
  return {
    summary: summaryText({ athletes: copiedAthletes(plan), groups: copiedGroupIds(plan).length, programGroups: programGroups(plan), unassigned: plan.unassignedAfter, inactive: plan.inactive.length }),
    tiles: tiles(f, plan), lines: [...mainLines(f, plan.mains), ...otherLines(f, plan)], warning: schoolWarning(f, plan), mains: childMains(f, plan.mains),
  };
}

export function startResult(f: StartFacts, plan: StartPlan): StartResult {
  const athletes = copiedAthletes(plan);
  return {
    season: f.target.label, copied: { athletes, groups: copiedGroupIds(plan).length, series: plan.series.length }, unassigned: plan.unassignedAfter,
    toast: startToast(f.target.label, athletes, plan.series.length),
  };
}
```

- [ ] **Step 5: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/new-season-plan.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 6: Commit**

```bash
git add src/club/groups/new-season/plan.ts src/club/groups/new-season/preview.ts src/club/groups/__tests__/new-season-plan.test.ts
git commit -m "feat(new-season): apply plan with the main-group rule, preview tiles, lines, summary and toast"
```

---

### Task 3: Start service (read, preview, apply)

**Files:**
- Create: `src/club/groups/new-season/service.ts`
- Test: `src/club/groups/__tests__/new-season-service.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2; plan 4-1 (`GroupContext`, `recordAction`, `done`, `ActionResult`, `Line`, `checkMainGroup`, `currentSeason`, `P4_ACTIONS`, `SEASON_SUBJECT`, `GROUP_SUBJECT`, `ATHLETE_SUBJECT`, `UndoStep`).
- Produces:
  - `loadStartFacts(store, targetId, today): Promise<AdminResult<StartFacts>>` (409 "Sezonul curent s-a schimbat. Reîncarcă pagina." when the target is not the season right after the current one, W28).
  - `readStart(store, targetId, today): Promise<AdminResult<StartData>>`, `previewStart(store, targetId, body, today): Promise<AdminResult<StartPreview>>`, `applyStart(ctx, targetId, body): Promise<ActionResult<StartResult>>`.
  - The apply writes, in one transaction: every other season `isCurrent` false and the target true; the planned memberships and series; lines: target `current-changed` (first line, undo record kind `season`, `registrationsAfter: { seasonId: target, at: now }`, `revalidate: true`), target `season-copied`, current `current-changed`, per group `members-copied` and `program-copied`, per athlete `athlete-copied`. Undo steps: `setCurrentSeason { id: current, otherId: target }`, a `deleteMembership` per membership, a `deleteEvent` per series.

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/new-season-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyStart, previewStart, readStart } from '../new-season/service';
import { undoAction } from '../undo-service';
import { joinGroup } from '../members';
import { fakeContext } from './fake-group-store';
import { facts } from './new-season-facts';

const seed = (today = '2027-09-15') => {
  const f = facts();
  return fakeContext({ athletes: f.athletes, memberships: f.memberships, events: f.events }, today);
};
const BODY = { groups: [{ groupId: 'g-ib', copyMembers: false, copyProgram: true }, { groupId: 'g-pro', copyMembers: true, copyProgram: true }] };
const actionOf = (r: { ok: boolean; data?: { actionId: string | null } }) => (r.ok && r.data?.actionId) || '';

describe('reading and previewing (10.9)', () => {
  it('serves step 2 and the preview of the same plan', async () => {
    const { store } = seed();
    expect((await readStart(store, 's27', '2027-09-15')).ok).toBe(true);
    const preview = await previewStart(store, 's27', BODY, '2027-09-15');
    expect(preview.ok && preview.data.tiles[1]).toEqual({ label: 'Sportivi copiați', value: '2', hint: 'în 1 grupă Club' });
  });

  it('refuses a target that is not the next season (W28)', async () => {
    const { store } = seed();
    expect(await readStart(store, 's25', '2027-09-15')).toEqual({ ok: false, status: 409, error: 'Sezonul curent s-a schimbat. Reîncarcă pagina.' });
  });
});

describe('applying (10.4, 10.5, W24)', () => {
  it('makes the season current, writes the copies and the lines, in one action', async () => {
    const { ctx, state, revalidated } = seed();
    const res = await applyStart(ctx, 's27', BODY);
    expect(res).toMatchObject({ ok: true, data: { value: { season: '2027-2028', copied: { athletes: 2, groups: 1, series: 2 }, toast: '2027-2028 este sezonul curent. 2 sportivi și 2 programe copiate.' } } });
    expect(state.seasons.filter((s) => s.isCurrent).map((s) => s.id)).toEqual(['s27']);
    expect(state.memberships.filter((m) => m.seasonId === 's27').map((m) => [m.athleteId, m.groupId, m.isMain])).toEqual([['a1', 'g-pro', true], ['a2', 'g-pro', true]]);
    expect(state.events.filter((e) => e.recurrence.seasonStart === '2027-10-01')).toHaveLength(2);
    expect(state.history.map((h) => [h.subjectType, h.subjectId, h.action])).toEqual([
      ['season', 's27', 'current-changed'], ['season', 's27', 'season-copied'], ['season', 's26', 'current-changed'],
      ['group', 'g-pro', 'members-copied'], ['group', 'g-ib', 'program-copied'], ['group', 'g-pro', 'program-copied'],
      ['athlete', 'a1', 'athlete-copied'], ['athlete', 'a2', 'athlete-copied'],
    ]);
    expect(state.history[1].changes).toMatchObject({ from: '2026-2027', athletes: 2, groups: 1, series: 2 });
    expect(state.locks.slice(0, 2)).toEqual(['season:s26', 'season:s27']);
    expect(revalidated()).toBe(1);
  });

  it('undo right away restores the old season and removes every row (W15)', async () => {
    const { ctx, state } = seed();
    const before = structuredClone({ seasons: state.seasons, memberships: state.memberships, events: state.events });
    const res = await applyStart(ctx, 's27', BODY);
    expect(await undoAction(ctx, { actionId: actionOf(res) })).toEqual({ ok: true, data: { undone: true } });
    expect({ seasons: state.seasons, memberships: state.memberships, events: state.events }).toEqual(before);
  });

  it('undo is refused after any later group or athlete change, even in a group it did not touch, or a filed registration (W28)', async () => {
    const one = seed();
    const res = await applyStart(one.ctx, 's27', BODY);
    await joinGroup(one.ctx, 'g-pp', { season: '2027-2028', athleteIds: ['a4'], mode: 'add' });
    expect(await undoAction(one.ctx, { actionId: actionOf(res) })).toEqual({ ok: false, status: 409, error: 'Nu se mai poate anula. Sezonul s-a schimbat între timp.' });
    const two = seed();
    const res2 = await applyStart(two.ctx, 's27', BODY);
    two.state.filedAfter = 1;
    expect((await undoAction(two.ctx, { actionId: actionOf(res2) })).ok).toBe(false);
  });

  it('a second apply is refused and writes nothing (Review Focus)', async () => {
    const { ctx, state } = seed();
    await applyStart(ctx, 's27', BODY);
    const count = state.memberships.length;
    expect(await applyStart(ctx, 's27', BODY)).toEqual({ ok: false, status: 409, error: 'Sezonul curent s-a schimbat. Reîncarcă pagina.' });
    expect(state.memberships).toHaveLength(count);
  });

  it('writes nothing when a write fails half way', async () => {
    const { ctx, state, failOn } = seed();
    failOn('createEvent');
    expect((await applyStart(ctx, 's27', BODY)).ok).toBe(false);
    expect(state.seasons.find((s) => s.isCurrent)?.id).toBe('s26');
    expect(state.memberships.some((m) => m.seasonId === 's27')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/new-season-service.test.ts`
Expected: FAIL (`Cannot find module '../new-season/service'`).

- [ ] **Step 3: Write `service.ts`**

```ts
import { guarded, refuse, type AdminResult } from '../../admin-result';
import { checkMainGroup } from '../../group-membership';
import { done, recordAction, type ActionResult, type Line } from '../action-log';
import type { GroupContext } from '../context';
import { NEW_SEASON_COPY } from '../copy';
import { ATHLETE_SUBJECT, GROUP_SUBJECT, P4_ACTIONS, SEASON_SUBJECT } from '../history-lines';
import { currentSeason } from '../season-pick';
import type { GroupStore } from '../types';
import type { UndoStep } from '../undo';
import { nextSeasonOf } from './detect';
import type { StartFacts } from './facts';
import { planStart, readStartRequest, type StartPlan, type StartRequest } from './plan';
import { startPreview, startResult, type StartPreview, type StartResult } from './preview';
import { startData, type StartData } from './start-data';

/** "Începe sezonul <next>" (spec 10.4, 10.5, 10.9). */
const changed = () => refuse(409, NEW_SEASON_COPY.seasonChanged);

export async function loadStartFacts(store: GroupStore, targetId: string, today: string): Promise<AdminResult<StartFacts>> {
  const [seasons, groups, sections, athletes, memberships, events] = await Promise.all([
    store.seasons(), store.groups(), store.sections(), store.athletes(), store.memberships(), store.events(),
  ]);
  const current = currentSeason(seasons);
  const target = nextSeasonOf(seasons);
  if (!current || !target || target.id !== targetId) return changed();
  return { ok: true, data: { current, target, groups, sections, athletes, memberships, events, today } };
}

export async function readStart(store: GroupStore, targetId: string, today: string): Promise<AdminResult<StartData>> {
  const f = await loadStartFacts(store, targetId, today);
  return f.ok === false ? f : { ok: true, data: startData(f.data) };
}

export async function previewStart(store: GroupStore, targetId: string, body: unknown, today: string): Promise<AdminResult<StartPreview>> {
  const req = readStartRequest(body);
  if (!req) return refuse(400, NEW_SEASON_COPY.seasonChanged);
  const f = await loadStartFacts(store, targetId, today);
  return f.ok === false ? f : { ok: true, data: startPreview(f.data, planStart(f.data, req)) };
}

/** Flags, then every membership and series; answers the steps that take them back. */
async function writeStart(store: GroupStore, f: StartFacts, plan: StartPlan): Promise<UndoStep[]> {
  const steps: UndoStep[] = [{ op: 'setCurrentSeason', id: f.current.id, otherId: f.target.id }];
  for (const s of await store.seasons()) if (s.isCurrent && s.id !== f.target.id) await store.setSeasonCurrent(s.id, false);
  await store.setSeasonCurrent(f.target.id, true);
  for (const m of plan.members) {
    const id = await store.createMembership({ athleteId: m.athleteId, groupId: m.groupId, seasonId: f.target.id, isMain: m.isMain, from: m.from });
    steps.push({ op: 'deleteMembership', id, athleteId: m.athleteId });
  }
  for (const s of plan.series) steps.push({ op: 'deleteEvent', id: await store.createEvent(s.write) });
  for (const id of new Set(plan.members.map((m) => m.athleteId))) {
    if (checkMainGroup(await store.memberships({ athleteId: id, seasonId: f.target.id }), f.target.id).ok === false) throw new Error(`main group rule broken for ${id}`);
  }
  return steps;
}

const groupName = (f: StartFacts, id: string): string => f.groups.find((g) => g.id === id)?.name ?? '';

function groupLines(f: StartFacts, plan: StartPlan): Line[] {
  const counts = new Map<string, number>();
  for (const m of plan.members) counts.set(m.groupId, (counts.get(m.groupId) ?? 0) + 1);
  const members = [...counts].map(([id, count]): Line => ({ subjectType: GROUP_SUBJECT, subjectId: id, action: P4_ACTIONS.membersCopied, changes: { from: f.current.label, count } }));
  const series = plan.series.map((s): Line => ({ subjectType: GROUP_SUBJECT, subjectId: s.groupId, action: P4_ACTIONS.programCopied, changes: { from: f.current.label, series: s.text } }));
  return [...members, ...series];
}

function athleteLines(f: StartFacts, plan: StartPlan): Line[] {
  const byAthlete = new Map<string, { name: string; main: boolean }[]>();
  for (const m of plan.members) byAthlete.set(m.athleteId, [...(byAthlete.get(m.athleteId) ?? []), { name: groupName(f, m.groupId), main: m.isMain }]);
  return [...byAthlete].map(([id, groups]) => ({ subjectType: ATHLETE_SUBJECT, subjectId: id, action: P4_ACTIONS.athleteCopied, changes: { season: f.target.label, groups } }));
}

function startLines(f: StartFacts, plan: StartPlan): Line[] {
  const r = startResult(f, plan).copied;
  return [
    { subjectType: SEASON_SUBJECT, subjectId: f.target.id, action: P4_ACTIONS.currentChanged, changes: { from: false, to: true } },
    { subjectType: SEASON_SUBJECT, subjectId: f.target.id, action: P4_ACTIONS.seasonCopied, changes: { from: f.current.label, athletes: r.athletes, groups: r.groups, series: r.series } },
    { subjectType: SEASON_SUBJECT, subjectId: f.current.id, action: P4_ACTIONS.currentChanged, changes: { from: true, to: false } },
    ...groupLines(f, plan), ...athleteLines(f, plan),
  ];
}

/** Two season rows, then the athletes the first plan copies; the facts are read again and the plan made again under the locks (decided 7). */
async function lockedFacts(ctx: GroupContext, targetId: string, req: StartRequest): Promise<AdminResult<StartFacts>> {
  const first = await loadStartFacts(ctx.store, targetId, ctx.today);
  if (first.ok === false) return first;
  for (const id of [first.data.current.id, targetId].sort()) await ctx.store.lockSeason(id);
  for (const id of [...new Set(planStart(first.data, req).members.map((m) => m.athleteId))].sort()) await ctx.store.lockAthlete(id);
  return loadStartFacts(ctx.store, targetId, ctx.today);
}

async function applyLocked(ctx: GroupContext, targetId: string, req: StartRequest): Promise<ActionResult<StartResult>> {
  const f = await lockedFacts(ctx, targetId, req);
  if (f.ok === false) return f;
  const plan = planStart(f.data, req);
  const steps = await writeStart(ctx.store, f.data, plan);
  const actionId = await recordAction(ctx.store, ctx.actor, startLines(f.data, plan), {
    kind: 'season', steps, revalidate: true, registrationsAfter: { seasonId: targetId, at: ctx.now().toISOString() },
  });
  return done(startResult(f.data, plan), actionId);
}

/** POST /club/seasons/:id/start: one transaction for everything (W24); a website ping after commit. */
export async function applyStart(ctx: GroupContext, targetId: string, body: unknown): Promise<ActionResult<StartResult>> {
  const req = readStartRequest(body);
  if (!req) return changed();
  const res = await guarded(ctx.log, `[new-season] starting ${targetId}`, () => ctx.store.transaction(() => applyLocked(ctx, targetId, req)));
  if (res.ok === true) ctx.revalidate();
  return res;
}
```

- [ ] **Step 4: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/new-season-service.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/club/groups/new-season/service.ts src/club/groups/__tests__/new-season-service.test.ts
git commit -m "feat(new-season): start the next season in one transaction, with preview and undo"
```

---

### Task 4: Per-group copies and `copyFrom` on the group page

**Files:**
- Create: `src/club/groups/new-season/copy-group.ts`
- Modify: `src/club/groups/api-types.ts` (`CopyFrom`, `GroupPage.copyFrom?`), `src/club/groups/group-page.ts` (fills `copyFrom`)
- Test: `src/club/groups/__tests__/copy-group.test.ts`

**Interfaces:**
- Consumes: plan 4-1 (`planJoin`, `currentRows`, `recordAction`, `done`, `pickSeason`, `previousSeason`, `isPastSeason`, `startDateFor`, `groupSeries`, `runningOn`, `seasonBounds`, `programLine`, `seriesText`, `P4_ACTIONS`), Task 1 copy.
- Produces:
  - `CopyFrom = { season: string; members: number; inactive: number; program: string[]; programFrom: string | null }` (spec 10.9 shape plus `programFrom`, the "Se repetă din" date text); `GroupPage.copyFrom?: CopyFrom | null`.
  - `copyFromFor(facts): CopyFrom | null`: `members` > 0 only while the group has no current member in the page season and active members in the previous one; `program` non-empty only while the group has no series in the page season and series running on the previous season's last day; null when neither, or the page season is past.
  - `copyMembers(ctx, groupId, body: { season }): Promise<ActionResult<{ copied: number; from: string }>>`, `copyProgram(ctx, groupId, body: { season }): Promise<ActionResult<{ series: number; from: string }>>` (409 "Datele s-au schimbat. Reîncarcă pagina." once the tab is not empty; W31: main only when the athlete has no group in the season yet).

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/copy-group.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readGroupPage } from '../group-page';
import { copyMembers, copyProgram } from '../new-season/copy-group';
import { undoAction } from '../undo-service';
import { athleteRow, event, fakeContext, member } from './fake-group-store';

const seed = () => fakeContext({
  seasons: [
    { id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', isCurrent: false, membershipFee: 270 },
    { id: 's27', label: '2027-2028', startMonth: '2027-10-01', endMonth: '2028-05-31', isCurrent: true, membershipFee: 200 },
  ],
  athletes: [athleteRow({ id: 'a1', name: 'Ana' }), athleteRow({ id: 'a2', name: 'Bia' }), athleteRow({ id: 'a3', name: 'Cai', status: 'inactiv' })],
  memberships: [
    member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a2', groupId: 'g-ib' }), member({ id: 'm3', athleteId: 'a3', groupId: 'g-ib' }),
    member({ id: 'm4', athleteId: 'a2', groupId: 'g-pro', seasonId: 's27', from: '2027-10-01' }),
  ],
  events: [event({ id: 'e1' })],
}, '2027-10-10');

describe('copyFrom on the group page (10.6, 10.9)', () => {
  it('offers members and program while both tabs are empty', async () => {
    const page = await readGroupPage(seed().store, 'g-ib', '2027-2028', '2027-10-10');
    expect(page?.copyFrom).toEqual({ season: '2026-2027', members: 2, inactive: 1, program: ['Sâ și Du, 11:00, 50 min'], programFrom: '10 oct 2027' });
  });

  it('is null on a past season and when the previous season has nothing', async () => {
    expect((await readGroupPage(seed().store, 'g-ib', '2026-2027', '2027-10-10'))?.copyFrom).toBeNull();
    expect((await readGroupPage(seed().store, 'g-pp', '2027-2028', '2027-10-10'))?.copyFrom).toBeNull();
  });
});

describe('"Copiază sportivii din <sezon>" (W31)', () => {
  it('copies every active member, main only for an athlete with no group in the season; undo takes it back', async () => {
    const { ctx, state } = seed();
    const res = await copyMembers(ctx, 'g-ib', { season: '2027-2028' });
    expect(res).toMatchObject({ ok: true, data: { value: { copied: 2, from: '2026-2027' } } });
    expect(state.memberships.filter((m) => m.seasonId === 's27' && m.groupId === 'g-ib').map((m) => [m.athleteId, m.isMain, m.from])).toEqual([['a1', true, '2027-10-10'], ['a2', false, '2027-10-10']]);
    expect(state.history.map((h) => h.action)).toEqual(['members-copied', 'athlete-copied', 'athlete-copied']);
    await undoAction(ctx, { actionId: res.ok ? res.data.actionId ?? '' : '' });
    expect(state.memberships.filter((m) => m.seasonId === 's27' && m.groupId === 'g-ib')).toEqual([]);
  });

  it('refuses once the tab is not empty', async () => {
    const { ctx } = seed();
    await copyMembers(ctx, 'g-ib', { season: '2027-2028' });
    expect(await copyMembers(ctx, 'g-ib', { season: '2027-2028' })).toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
  });
});

describe('"Copiază programul din <sezon>"', () => {
  it('copies the series running on the old season\'s last day from the later of the season start and today', async () => {
    const { ctx, state, revalidated } = seed();
    const res = await copyProgram(ctx, 'g-ib', { season: '2027-2028' });
    expect(res).toMatchObject({ ok: true, data: { value: { series: 1, from: '2026-2027' } } });
    expect(state.events[1].recurrence).toMatchObject({ seasonStart: '2027-10-10', seasonEnd: '2028-05-31', startTime: '11:00' });
    expect(state.history[0]).toMatchObject({ action: 'program-copied', changes: { from: '2026-2027' } });
    expect(revalidated()).toBe(1);
    expect((await copyProgram(ctx, 'g-ib', { season: '2027-2028' })).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/copy-group.test.ts`
Expected: FAIL (`Cannot find module '../new-season/copy-group'`).

- [ ] **Step 3: Write `copy-group.ts`**

```ts
import type { AthleteRow, MembershipRow } from '../../athletes/store';
import { guarded, refuse, type AdminResult } from '../../admin-result';
import { isCurrentMembership } from '../../group-membership';
import { done, recordAction, type ActionResult, type Line } from '../action-log';
import type { CopyFrom } from '../api-types';
import type { GroupContext } from '../context';
import { GROUP_ERRORS } from '../copy';
import { shortDate } from '../dates';
import { ATHLETE_SUBJECT, GROUP_SUBJECT, P4_ACTIONS } from '../history-lines';
import { currentRows, planJoin } from '../membership-plan';
import { programLine } from '../program-text';
import { isPastSeason, pickSeason, previousSeason, startDateFor } from '../season-pick';
import { groupSeries, runningOn, seasonBounds, seriesText, type SeriesView } from '../series';
import type { EventRecord, EventWrite, GroupRecord, GroupStore, SeasonRecord } from '../types';
import type { UndoStep } from '../undo';

/** Per-group copies into an empty tab (spec 10.6, W31). */
export type CopyFacts = { group: GroupRecord; season: SeasonRecord; seasons: SeasonRecord[]; memberships: MembershipRow[]; athletes: AthleteRow[]; events: EventRecord[]; today: string };

const COPYABLE: ReadonlySet<string> = new Set(['nou', 'activ']);
const membersIn = (f: CopyFacts, seasonId: string) => f.memberships.filter((m) => m.groupId === f.group.id && m.seasonId === seasonId && isCurrentMembership(m));
const statusOf = (f: CopyFacts, id: string) => f.athletes.find((a) => a.id === id)?.status ?? '';
const running = (f: CopyFacts, prev: SeasonRecord): SeriesView[] => groupSeries(f.events, f.group.id, prev).filter((s) => runningOn(s, seasonBounds(prev).end));

export function copyFromFor(f: CopyFacts): CopyFrom | null {
  const prev = previousSeason(f.season, f.seasons);
  if (!prev || isPastSeason(f.season, f.seasons)) return null;
  const old = membersIn(f, prev.id).filter((m) => statusOf(f, m.athleteId) !== 'anonimizat');
  const emptyRoster = membersIn(f, f.season.id).length === 0;
  const emptyProgram = groupSeries(f.events, f.group.id, f.season).length === 0;
  const members = emptyRoster ? old.filter((m) => COPYABLE.has(statusOf(f, m.athleteId))).length : 0;
  const program = emptyProgram ? running(f, prev).map((s) => programLine(seriesText(s))) : [];
  if (!members && !program.length) return null;
  return {
    season: prev.label, members, inactive: emptyRoster ? old.filter((m) => statusOf(f, m.athleteId) === 'inactiv').length : 0, program,
    programFrom: program.length ? shortDate(startDateFor(f.season, f.today)) : null,
  };
}

async function copyFacts(store: GroupStore, groupId: string, label: unknown, today: string): Promise<AdminResult<CopyFacts>> {
  const [group, seasons, memberships, athletes, events] = await Promise.all([store.group(groupId), store.seasons(), store.memberships({ groupId }), store.athletes(), store.events({ groupId })]);
  const season = typeof label === 'string' ? pickSeason(seasons, label) : null;
  if (!group || !group.active || !season || season.label !== label || isPastSeason(season, seasons)) return refuse(409, GROUP_ERRORS.stale);
  return { ok: true, data: { group, season, seasons, memberships, athletes, events, today } };
}

const seasonOf = (body: unknown): unknown => (body && typeof body === 'object' ? (body as Record<string, unknown>).season : null);

async function joinCopied(ctx: GroupContext, f: CopyFacts, athleteId: string): Promise<{ steps: UndoStep[]; main: boolean } | null> {
  const rows = currentRows(await ctx.store.memberships({ athleteId, seasonId: f.season.id }), athleteId, f.season.id);
  const plan = planJoin(rows, f.group.id, { athleteId, seasonId: f.season.id, from: startDateFor(f.season, ctx.today) });
  const write = plan.writes[0];
  if (!write || write.op !== 'create') return null;
  const id = await ctx.store.createMembership({ athleteId, groupId: f.group.id, seasonId: f.season.id, isMain: write.isMain, from: write.from });
  return { steps: [{ op: 'deleteMembership', id, athleteId }], main: write.isMain };
}

async function membersLocked(ctx: GroupContext, groupId: string, label: unknown): Promise<ActionResult<{ copied: number; from: string }>> {
  const first = await copyFacts(ctx.store, groupId, label, ctx.today);
  if (first.ok === false) return first;
  const from = copyFromFor(first.data);
  if (!from || !from.members) return refuse(409, GROUP_ERRORS.stale);
  const prev = previousSeason(first.data.season, first.data.seasons) as SeasonRecord;
  const ids = membersIn(first.data, prev.id).map((m) => m.athleteId).filter((id) => COPYABLE.has(statusOf(first.data, id))).sort();
  for (const id of ids) await ctx.store.lockAthlete(id);
  await ctx.store.lockGroup(groupId);
  const steps: UndoStep[] = [];
  const lines: Line[] = [{ subjectType: GROUP_SUBJECT, subjectId: groupId, action: P4_ACTIONS.membersCopied, changes: { from: from.season, count: ids.length } }];
  for (const id of ids) {
    const joined = await joinCopied(ctx, first.data, id);
    if (!joined) continue;
    steps.push(...joined.steps);
    lines.push({ subjectType: ATHLETE_SUBJECT, subjectId: id, action: P4_ACTIONS.athleteCopied, changes: { season: first.data.season.label, groups: [{ name: first.data.group.name, main: joined.main }] } });
  }
  const actionId = await recordAction(ctx.store, ctx.actor, lines, { kind: 'group', steps, revalidate: false });
  return done({ copied: steps.length, from: from.season }, actionId);
}

/** POST /club/groups/:id/copy-members body `{ season }`. */
export const copyMembers = (ctx: GroupContext, groupId: string, body: unknown): Promise<ActionResult<{ copied: number; from: string }>> =>
  guarded(ctx.log, `[new-season] copying members into ${groupId}`, () => ctx.store.transaction(() => membersLocked(ctx, groupId, seasonOf(body))));

function seriesCopy(f: CopyFacts, s: SeriesView): EventWrite {
  const type = f.events.find((e) => e.id === s.eventId)?.type ?? 'curs';
  return {
    title: f.group.name, type, description: null, groupId: f.group.id, exceptions: [],
    recurrence: { freq: s.freq, days: s.days, weekOfMonth: s.weekOfMonth, startTime: s.startTime, endTime: s.endTime, singleDate: null, seasonStart: startDateFor(f.season, f.today), seasonEnd: seasonBounds(f.season).end },
  };
}

async function programLocked(ctx: GroupContext, groupId: string, label: unknown): Promise<ActionResult<{ series: number; from: string }>> {
  await ctx.store.lockGroup(groupId);
  const f = await copyFacts(ctx.store, groupId, label, ctx.today);
  if (f.ok === false) return f;
  const from = copyFromFor(f.data);
  const prev = previousSeason(f.data.season, f.data.seasons);
  if (!from || !from.program.length || !prev) return refuse(409, GROUP_ERRORS.stale);
  const steps: UndoStep[] = [];
  const lines: Line[] = [];
  for (const s of running(f.data, prev)) {
    steps.push({ op: 'deleteEvent', id: await ctx.store.createEvent(seriesCopy(f.data, s)) });
    lines.push({ subjectType: GROUP_SUBJECT, subjectId: groupId, action: P4_ACTIONS.programCopied, changes: { from: prev.label, series: { ...seriesText(s), from: startDateFor(f.data.season, ctx.today) } } });
  }
  const actionId = await recordAction(ctx.store, ctx.actor, lines, { kind: 'group', steps, revalidate: true });
  return done({ series: steps.length, from: prev.label }, actionId);
}

/** POST /club/groups/:id/copy-program body `{ season }`. */
export async function copyProgram(ctx: GroupContext, groupId: string, body: unknown): Promise<ActionResult<{ series: number; from: string }>> {
  const res = await guarded(ctx.log, `[new-season] copying the program into ${groupId}`, () => ctx.store.transaction(() => programLocked(ctx, groupId, seasonOf(body))));
  if (res.ok === true) ctx.revalidate();
  return res;
}
```

The `as SeasonRecord` in `membersLocked` is safe: `copyFromFor` returned a value, so the previous season exists; if your linter rejects the assertion, read `previousSeason` once more and return the stale refusal when it is null.

- [ ] **Step 4: `copyFrom` on the group page**

`src/club/groups/api-types.ts`, add and extend:

```ts
/** Empty-tab copies (10.6, 10.9): `members` and `program` are what the tab can copy from `season`; `programFrom` the "Se repetă din" date. */
export type CopyFrom = { season: string; members: number; inactive: number; program: string[]; programFrom: string | null };
```

and in `GroupPage` add `copyFrom?: CopyFrom | null;`.

`src/club/groups/group-page.ts`: import `copyFromFor` from `./new-season/copy-group`; in `readGroupPage`, read every membership and the group's events once more for it and add the field to the returned object:

```ts
  const [allRows, groupEvents] = await Promise.all([store.memberships({ groupId: id }), store.events({ groupId: id })]);
  const copyFrom = season ? copyFromFor({ group, season, seasons, memberships: allRows, athletes, events: groupEvents, today }) : null;
```

```ts
    members: memberRows({ group, current, athletes, groups, today }), historyCount: history.length, deletable, copyFrom,
```

If `readGroupPage` grows past 30 lines with these lines, move the two `Promise.all` reads into a helper `pageReads(store, id)` in the same file.

- [ ] **Step 5: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/copy-group.test.ts src/club/groups/__tests__/reads.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS (the plan 4-1 reads test keeps passing: `copyFrom` is null in its seed); zero type errors.

- [ ] **Step 6: Commit**

```bash
git add src/club/groups/new-season/copy-group.ts src/club/groups/api-types.ts src/club/groups/group-page.ts src/club/groups/__tests__/copy-group.test.ts
git commit -m "feat(new-season): copy members or the program of the previous season into an empty group tab"
```

---

### Task 5: Routes `08-new-season.ts` and the controller

**Files:**
- Create: `src/api/club/routes/08-new-season.ts`, `src/api/club/controllers/new-season.ts`
- Test: `src/club/groups/__tests__/new-season-routes.test.ts`

**Interfaces:**
- Consumes: Tasks 3 and 4, plan 4-1 (`groupContext`, `respondAction`, `todayIso`, `strapiGroupStore`, `respond`).
- Produces:

| Method | Path | Handler | Answer |
|---|---|---|---|
| GET | `/club/seasons/:documentId/start` | `newSeason.data` | `{ data: StartData }` |
| POST | `/club/seasons/:documentId/start/preview` | `newSeason.preview` | `{ data: StartPreview }` |
| POST | `/club/seasons/:documentId/start` | `newSeason.apply` | `{ data: StartResult, undo }` |
| POST | `/club/groups/:documentId/copy-members` | `newSeason.copyMembers` | `{ data: { copied, from }, undo }` |
| POST | `/club/groups/:documentId/copy-program` | `newSeason.copyProgram` | `{ data: { series, from }, undo }` |

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/new-season-routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import newSeason from '../../../api/club/controllers/new-season';
import routes from '../../../api/club/routes/08-new-season';

describe('08-new-season routes (10.9)', () => {
  it('are admin-only (any admin, W22)', () => {
    for (const r of routes.routes) expect(r.config, r.path).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
  });

  it('point at handlers that exist', () => {
    for (const r of routes.routes) expect(typeof (newSeason as Record<string, unknown>)[r.handler.split('.')[1]], r.handler).toBe('function');
  });

  it('declare the preview path before the start path', () => {
    const paths = routes.routes.map((r) => `${r.method} ${r.path}`);
    expect(paths.indexOf('POST /club/seasons/:documentId/start/preview')).toBeLessThan(paths.indexOf('POST /club/seasons/:documentId/start'));
    expect(paths).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/new-season-routes.test.ts`
Expected: FAIL (`Cannot find module`).

- [ ] **Step 3: Write the routes and the controller**

`src/api/club/routes/08-new-season.ts`:

```ts
/** "Începe sezonul <next>" and the per-group copies (spec 10.9). Admin only; fixed paths before parameter paths. */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/seasons/:documentId/start', handler: 'new-season.data', config: adminGuard },
    { method: 'POST', path: '/club/seasons/:documentId/start/preview', handler: 'new-season.preview', config: adminGuard },
    { method: 'POST', path: '/club/seasons/:documentId/start', handler: 'new-season.apply', config: adminGuard },
    { method: 'POST', path: '/club/groups/:documentId/copy-members', handler: 'new-season.copyMembers', config: adminGuard },
    { method: 'POST', path: '/club/groups/:documentId/copy-program', handler: 'new-season.copyProgram', config: adminGuard },
  ],
};
```

`src/api/club/controllers/new-season.ts`:

```ts
import { respond, type AdminCtx } from '../../../club/admin-http';
import { groupContext } from '../../../club/groups/context';
import { respondAction, todayIso } from '../../../club/groups/http';
import { copyMembers, copyProgram } from '../../../club/groups/new-season/copy-group';
import { applyStart, previewStart, readStart } from '../../../club/groups/new-season/service';
import { strapiGroupStore } from '../../../club/groups/strapi-store';

const id = (ctx: AdminCtx): string => ctx.params.documentId ?? '';

/** routes/08-new-season.ts (all `global::is-admin`). */
export default {
  async data(ctx: AdminCtx) {
    respond(ctx, await readStart(strapiGroupStore(strapi), id(ctx), todayIso()));
  },

  async preview(ctx: AdminCtx) {
    respond(ctx, await previewStart(strapiGroupStore(strapi), id(ctx), ctx.request.body, todayIso()));
  },

  async apply(ctx: AdminCtx) {
    respondAction(ctx, await applyStart(await groupContext(strapi, ctx), id(ctx), ctx.request.body));
  },

  async copyMembers(ctx: AdminCtx) {
    respondAction(ctx, await copyMembers(await groupContext(strapi, ctx), id(ctx), ctx.request.body));
  },

  async copyProgram(ctx: AdminCtx) {
    respondAction(ctx, await copyProgram(await groupContext(strapi, ctx), id(ctx), ctx.request.body));
  },
};
```

The controller file name `new-season.ts` registers as `new-season` in Strapi (handler `new-season.data`); the test reads the default export's keys.

- [ ] **Step 4: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/new-season-routes.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/api/club/routes/08-new-season.ts src/api/club/controllers/new-season.ts src/club/groups/__tests__/new-season-routes.test.ts
git commit -m "feat(new-season): admin routes for starting a season and the per-group copies"
```

---

### Task 6: Boot check on a throwaway Postgres

**Files:** none in the repo. Temporary files in `${TMPDIR:-/tmp}/es43`.

**Interfaces:**
- Consumes: everything above, `scripts/fixtures/phase4-shape.js` (plan 4-1).
- Proves (spec 10.10): `GET .../start` and `.../start/preview` match the planner; apply with Club members and every program: exactly one season current (2027-2028); `/api/club/public` returns 2027-2028 and its fee; `/api/club/schedule` returns the copied school slots; public occurrences show dates of both seasons; no `acs-membership` row for 2027-2028; the Inactiv athlete not copied; `GET /club/groups/unassigned?season=2027-2028` lists the school children with their 2026-2027 group proposed and "Din 2026-2027"; undo right away restores everything; apply again, add a membership in 2027-2028, undo: 409 with the refusal text; per-group "copy-members" and "copy-program" on an empty group, and their undo.

Container `es43-pg` on 127.0.0.1:55443, Strapi on 1363. Never 1337, 1340, 3010 or 5432.

- [ ] **Step 1: Checks, Postgres, build, fixture, Strapi, helpers**

Run Steps 2 and 3 of plan 4-2 Task 8 with `es42` replaced by `es43`, `55442` by `55443` and `1362` by `1363` (same env file, same fixture, same admin, same helpers `idof`, `api`, `pub`, `py`, `q`). Then:

```bash
IB=$(idof groups 'Intermediari Bronze'); PRO=$(idof groups 'Profesioniști'); INC=$(idof groups 'Începători')
api POST "/club/groups/$IB/program" '{"freq":"weekly","days":["sat","sun"],"startTime":"11:00","durationMin":50,"from":"2026-11-07"}' > /dev/null
api POST "/club/groups/$PRO/program" '{"freq":"weekly","days":["tue","thu"],"startTime":"18:00","durationMin":90,"from":"2026-11-03"}' > /dev/null
GOLD=$(idof groups 'Avansați Gold')
api POST "/club/groups/$GOLD/program" '{"freq":"weekly","days":["sat"],"startTime":"09:00","durationMin":50,"from":"2026-11-07"}' > /dev/null
NEXT=$(api POST /club/seasons '{"label":"2027-2028","startMonth":"2027-10","endMonth":"2028-05","membershipFee":200}' | py "print([s['documentId'] for s in d['data'] if s['label'] == '2027-2028'][0])")
```

Expected: the three programs answer 200; `NEXT` holds the new season's id (created not current).

- [ ] **Step 2: Step 2 data and the preview**

```bash
api GET "/club/seasons/$NEXT/start" | py "p=d['data']; print(p['target'], [(s['label'], [(g['name'], g['members'], g['inactive'], g['programState'], g['defaultMembers']) for g in s['groups']]) for s in p['sections']])"
BODY=$(api GET "/club/seasons/$NEXT/start" | py "print(json.dumps({'groups': [{'groupId': g['groupId'], 'copyMembers': g['defaultMembers'], 'copyProgram': g['defaultProgram'] and g['name'] != 'Avansați Gold', 'excludeAthleteIds': []} for s in d['data']['sections'] for g in s['groups']]}))")
api POST "/club/seasons/$NEXT/start/preview" "$BODY" | py "p=d['data']; print(p['summary']); print(p['tiles']); print([l['bold'] for l in p['lines']]); print(p['warning'])"
```

Expected: target `{'documentId': ..., 'label': '2027-2028', 'fee': 200}`; the school table lists the 7 groups (Intermediari Bronze with 3 members, `ok`, `False`; Avansați Gold with 1 member, `ok`), the Club table Profesioniști (2 members, `ok`, `True`) and Avansați (1 member, `none`, `True`); the body leaves Avansați Gold's program unticked (for Step 5); the summary starts with `Se copiază 3 sportivi în 2 grupe și programul a 2 grupe.`; four tiles; the lines end with `Membru A.C.S. nu se copiază.`; `None` (Intermediari Bronze gets a program).

- [ ] **Step 3: Apply and check the website reads**

```bash
A=$(api POST "/club/seasons/$NEXT/start" "$BODY" | py "print(d['undo']['actionId']); print(d['data'], file=sys.stderr)")
q "select label from seasons where is_current"
pub /club/public | py "print(d['data']['season']['label'], d['data']['membershipFee'])"
pub /club/schedule | py "print(d['data'][0]['slots'])"
pub '/calendar/occurrences?from=2027-05-22&to=2027-08-20' | py "print(sorted({o['date'][:7] for o in d['data'] if o.get('groupName')}))"
pub '/calendar/occurrences?from=2027-10-01&to=2027-12-20' | py "print(sorted({o['date'][:7] for o in d['data'] if o.get('groupName')}))"
q "select count(*) from acs_memberships m join acs_memberships_season_lnk l on l.acs_membership_id = m.id join seasons s on s.id = l.season_id where s.label = '2027-2028'"
api GET '/club/groups/unassigned?season=2027-2028' | py "print([(r['name'], r['source'], r['proposedGroupId'] is not None) for r in d['data']['rows']])"
api GET "/club/groups/$PRO?season=2027-2028" | py "print([m['name'] for m in d['data']['members']])"
```

Expected: stderr `{'season': '2027-2028', 'copied': {'athletes': 3, 'groups': 2, 'series': 2}, 'unassigned': ..., 'toast': '2027-2028 este sezonul curent. 3 sportivi și 2 programe copiate.'}`; only `2027-2028` is current; `2027-2028 200`; `[{'start': '11:00', 'end': '11:50', 'groups': ['Intermediari Bronze']}]`; group dates in `2027-05` (the old season) and in `2027-10` to `2027-12` (the new one); `0` A.C.S. rows for 2027-2028; the unassigned list holds Ana Ionescu and Luca Mihai with `Din 2026-2027, <n> ani` and `True` (their 2026-2027 main group proposed), and Elisa Georgescu, Matei Ionescu and Sofia Tănase with `Adăugat în Sportivi...` and `False` (no 2026-2027 membership, no 2027-2028 registration); Tudor Matei (Inactiv) is not listed; Profesioniști in 2027-2028 lists Filip Radu and Ioana Marin.

- [ ] **Step 4: Undo, apply again, refused undo**

```bash
api POST /club/undo "{\"actionId\":\"$A\"}" | py "print(d['data'])"
q "select label from seasons where is_current"
q "select count(*) from group_memberships m join group_memberships_season_lnk l on l.group_membership_id = m.id join seasons s on s.id = l.season_id where s.label = '2027-2028'"
A2=$(api POST "/club/seasons/$NEXT/start" "$BODY" | py "print(d['undo']['actionId'])")
api POST "/club/groups/$INC/members" "{\"season\":\"2027-2028\",\"athleteIds\":[\"$(idof athletes 'Sofia Tănase')\"],\"mode\":\"add\"}" > /dev/null
api POST /club/undo "{\"actionId\":\"$A2\"}" | py "print(d['error']['status'], d['error']['message'])"
```

Expected: `{'undone': True}`; `2026-2027`; `0`; `409 Nu se mai poate anula. Sezonul s-a schimbat între timp.`

- [ ] **Step 5: Per-group copies on an empty group**

```bash
api GET "/club/groups/$GOLD?season=2027-2028" | py "print(d['data']['copyFrom'])"
CM=$(api POST "/club/groups/$GOLD/copy-members" '{"season":"2027-2028"}' | py "print(d['undo']['actionId']); print(d['data'], file=sys.stderr)")
CP=$(api POST "/club/groups/$GOLD/copy-program" '{"season":"2027-2028"}' | py "print(d['undo']['actionId']); print(d['data'], file=sys.stderr)")
api POST "/club/groups/$GOLD/copy-members" '{"season":"2027-2028"}' | py "print(d['error']['status'])"
api POST /club/undo "{\"actionId\":\"$CP\"}" | py "print(d['data'])"
api POST /club/undo "{\"actionId\":\"$CM\"}" | py "print(d['data'])"
```

Expected (2027-2028 is current after Step 4's refused undo): `copyFrom` `{'season': '2026-2027', 'members': 1, 'inactive': 0, 'program': ['Sâ, 09:00, 50 min'], 'programFrom': '1 oct 2027'}` (Luca Mihai; school groups default to no members, and Avansați Gold's program was left unticked); stderr `{'copied': 1, 'from': '2026-2027'}` and `{'series': 1, 'from': '2026-2027'}`; `409`; `{'undone': True}` twice.

- [ ] **Step 6: Clean up**

```bash
kill "$(cat "$T/pid")"
docker rm -f es43-pg
rm -rf "$T"
```

Expected: container removed. No commit unless a check failed (then a `fix(new-season): ...` commit in the owning task's files, and the affected steps repeated).

---

## Interfaces for other plans

- **Sezoane window (plan 4-6):** `startableLabel(seasons)` (`new-season/detect.ts`, pure) decides the row that shows "Începe sezonul <next>"; `StartData`, `StartGroup`, `StartAthlete` (`start-data.ts`), `StartRequest`, `GroupTick` (`plan.ts`), `StartPreview`, `Tile`, `PreviewLine`, `ChildMain`, `StartResult` (`preview.ts`); routes of Task 5; every text in `NEW_SEASON_COPY`, `step1Rows`, `summaryText`, `startToast` (`copy/new-season.ts`). Step 2 calls the preview route after each tick change for the summary and the child main groups (`mains`).
- **Group page empty states (plan 4-6):** `GroupPage.copyFrom?: CopyFrom | null`; routes `copy-members` / `copy-program` with body `{ season }`; texts `emptyMembers`, `copyMembers`, `copyMembersHint`, `emptyProgram`, `copyProgram`, `copyProgramHint`, `membersCopiedToast`, `programCopiedToast`.
- **Undo:** through plan 4-1's `POST /club/undo` (record kind `season` → refusal "Nu se mai poate anula. Sezonul s-a schimbat între timp.").

## Self-review

- **Spec coverage.** 10.1 start point and its conditions (T1 `startableLabel`; button: plan 4-6); 10.2 step 1 rows, step 2 tables, defaults, disabled boxes, child lists, rule line, summary, step 3 tiles, lines, warning (T1, T2; screens: plan 4-6); 10.3 members copied (sources, never copied, `from`, not twice, main rule, one main), children not copied (Fără grupă through plan 4-1's rule), A.C.S. untouched, program copy (source, new window, not copied things) (T2, T3); 10.4 current flag and its readers (T3, T6 checks `/api/club/public`, schedule, occurrences); 10.5 one transaction, locks, re-plan, 409, toast, undo and its limits (T3, T6); 10.6 per-group copies and empty states' data (T4, T6); 10.7 rules (T2 to T4); 10.8 history lines (T3, T4; texts in plan 4-1); 10.9 routes and `copyFrom` (T4, T5); 10.10 unit, store, route and boot proof (T1 to T6; UI source tests in plan 4-6).
- **Placeholder scan:** code in every code step; two guarded notes (the `as SeasonRecord` and the 30-line split) say exactly what to do.
- **Type consistency:** `StartFacts` (T1) feeds `planStart`, `startPreview`, `startResult` (T2) and `loadStartFacts` (T3); `StartRequest` read by `readStartRequest` (T2) in T3; `CopyFrom` (T4) is the `GroupPage.copyFrom` type; undo steps `setCurrentSeason { id, otherId }`, `deleteMembership { id, athleteId }`, `deleteEvent { id }` are plan 4-1's.
- **Review Focus:** stale apply (T3 second apply, T6), existing new-season main (T2), undo limits (T3, T6), mid-season start (T2), inactive and anonymized (T1, T2).
