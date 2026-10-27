# Phase 4-4: Groups and Schedules Production Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One script, `scripts/migrate-groups-schedules.js --step=<step> [--apply]`, that moves production onto groups as the owners of the program: cedilla names to comma letters, coaches linked from Membri echipă texts, "Program public" set, one weekly series per Școala group built from today's notebook (with the old Școala weekends' days and Liber / Anulat dates), the existing Club training linked to its group, and, after the user has checked the website, the old Școala series retired. Dry run by default, one step per run, idempotent, every write in Istoric as "Migrare", proven on a throwaway Postgres seeded with the production shape.

**Architecture:** Every step's decision is a pure planner in `src/club/groups/migrate/` (`group-names.ts`, `coaches.ts`, `program-public.ts`, `school-series.ts`, `link-events.ts`, `retire.ts`) tested on the production shape of `.superpowers/phase4/research.md`. The script follows `scripts/migrate-athletes-registrations.js`: it loads Strapi, reads through the plan 4-1 `GroupStore` (and `db.query` for raw values the store hides), prints the plan, and with `--apply` writes item by item (one small transaction each, never one big one) with a history line per write, refusing a step while a step it needs still has work.

**Tech Stack:** Strapi 5.52.1, Node 22 (CommonJS script, planners compiled to `dist/`), Vitest 3, Postgres 16.

**Spec:** `docs/superpowers/specs/2026-10-27-groups-schedules-design.md` (v1.1), section 4 (all of it), 3.7 (migration actor "Migrare"), W8, W14, W18, W19; DECISIONS 2026-10-19 data-q1-groups, build-q3-final-review (1), "phase 4 mockups" 7 and 11. Agent rules: `.superpowers/phase3-shared/agent-rules.md`. Index: `docs/superpowers/plans/2026-10-27-phase4-index.md`.

**Base:** `feat/athletes` with plans 4-1 and 4-2 merged (plan 4-2 is needed for `asCalendarRow`, `classDates` and the occurrence expansion that the proof compares). Runs in parallel with plans 4-3, 4-5 and 4-7.

**Parallel groups:** A: T1 | B: T2 | C: T3

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Planners | plans 4-1, 4-2 | new files in `src/club/groups/migrate/` and their tests |
| B | 2 The script | 1 | `scripts/migrate-groups-schedules.js`, `package.json` script line |
| C | 3 Proof on a throwaway Postgres | 2 | no repo files |

## Decided while planning (low impact, decided by Claude; the user may overrule any line)

Log them in DECISIONS.md as "plan 4-4, decided by Claude (low impact, 2026-10-27)".

1. **History of linking an event** (step 5): the group gets the line it would get had the program been added on the group page: "Program adăugat: Ma și Jo, 18:00, 90 min, din 1 oct 2026." for a series, "Ședință unică adăugată: ..." for one class (`link-events.ts`, script).
2. **Step 3 ("Program public")** writes no Istoric line: the value the admin sees does not change (an empty value already reads as on, W8); the script prints every group it sets.
3. **Step 6 (retire)** records `event-retired` on the calendar event (subject `calendar-event`, `{ title }`); no screen shows it.
4. **Coach texts that match two groups** (same key in two sections) are listed as unmatched, never guessed (`coaches.ts`); the same for course texts in step 4 and event titles in step 5.
5. **The window of the copied Școala series** starts on the later of the current season's start and the EARLIEST start among the old unlinked Școala series that overlap the season (production has one: 2026-10-03), and ends on the season's last day (`school-series.ts`).
6. **The time slot text** is read for its first "HH:mm" (also "H:mm" and "HH.mm"); a slot without a time is listed and skipped (`school-series.ts::slotStart`).
7. **Old `cancel` exceptions** of the Școala series are not copied (spec 4 step 4 names Liber and Anulat only); the dry run lists any it leaves.
8. **Order guard:** `coaches`, `school-series` and `link-events` refuse while `group-names` still has renames (names are matched after the rename); `retire-old-series` refuses while `school-series` still has a group to create.

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes`. Commit only in the worktree your dispatch names; check `git rev-parse --show-toplevel` and `git branch --show-current` before every commit.
- A dated entry in `edusport_frontend/docs/portal/DECISIONS.md` wins over the spec; the spec wins over this plan's prose; this plan's code is followed verbatim unless it fails (fix the minimum, say what and why).
- Checks after every task: the task's tests, `npx vitest run`, `npx tsc --noEmit` (zero errors).
- Planners: TypeScript, pure, no `any`, single quotes, functions under 30 lines, complexity under 10. The script is CommonJS JavaScript like `scripts/migrate-athletes-registrations.js` (its style: single quotes, small functions, `writeEach`).
- Dry run by default; `--apply` writes; one step per run; idempotent and re-runnable (a second `--apply` writes nothing); no big transaction (one small transaction per item); actor `migrare` (shown "Migrare"); every write printed and written to Istoric (except decided 2).
- `program.scheduleGroups` and its custom field stay in the schema and the database (rollback source and notebook fallback, W18); `team_members.groups` is never changed (W19).
- NEVER run the script against production or the user's local or TEST databases from this plan: Task 3 runs only against `es44-pg` on 127.0.0.1:55444 with Strapi on 1364. The production run is the user's deploy, in the order of spec 4 ("Deploy order"), each step dry first and shown to the user.
- Synthetic data only. Commits: Conventional Commits, exactly the message in the task, no `Co-Authored-By`, no AI attribution. Never push.
- Progress board: `printf '%s | 4-4 T<n> | implementer | <status>\n' "$(date -u +%H:%M)" >> /Users/codrin/Documents/Programming/edusport_backend/.superpowers/phase3-shared/progress-board.md`.

## Review Focus

- **Running a step twice, or after a half-finished run** (the network drops after 4 of 7 series): the second `--apply` writes only what is missing and never a second series for a group; the dry run then shows 0. Pinned by Task 1 (`skips a group that has a series`) and Task 3 (apply twice).
- **Matching that must not guess**: "Avansati" goes to Club "Avansați", never to a Școala "Avansați Gold"; a text matching two groups is listed, not linked; "Primii Paşi" (cedilla) still matches after the rename. Pinned by Task 1.
- **The website looks the same**: after steps 1 to 5, and again after step 6, every Școala weekend has the same state (curs / liber / anulat) and note as before, and `/api/club/schedule` lists the same groups at the same times as today's notebook. Pinned by Task 3 (before / after comparison).
- **Steps out of order** (`retire-old-series` before `school-series`, `school-series` before `group-names`): refused with "refused, nothing written: ..." and exit 1. Pinned by Task 3.
- **A notebook slot or a course text the planner cannot read** (a slot "dimineața", a course "Grupa nouă" that is no group): listed in the dry run and skipped, the other groups still get their series. Pinned by Task 1.

---

## File Structure

```
src/club/groups/migrate/
  group-names.ts      Rename, planGroupNames (T1)
  coaches.ts          TeamRow, CoachLink, CoachPlan, planCoachLinks (T1)
  program-public.ts   planProgramPublic (T1)
  school-series.ts    Slot, readSlots, slotStart, oldScoalaSeries, SchoolSeriesPlan, planSchoolSeries (T1)
  link-events.ts      SKIP_NAMES, EventLink, LinkPlan, planEventLinks, linkLine (T1)
  retire.ts           Retire, planRetire (T1)
src/club/groups/__tests__/migrate.test.ts        (T1)
scripts/migrate-groups-schedules.js              (T2)
package.json                                      "migrate:groups" (T2)
```

---

### Task 1: Planners

**Files:**
- Create: `src/club/groups/migrate/group-names.ts`, `coaches.ts`, `program-public.ts`, `school-series.ts`, `link-events.ts`, `retire.ts`
- Test: `src/club/groups/__tests__/migrate.test.ts`

**Interfaces:**
- Consumes: `nameKey`, `normalizeGroupName` (`src/club/migrate/names.ts`); plan 4-1 (`GroupRecord`, `SectionRecord`, `SeasonRecord`, `EventRecord`, `EventWrite`, `ExceptionRow`, `DayKey`, `groupSeries`, `seriesView`, `classView`, `seriesText`, `seasonBounds`, `overlapsSeason`, `addMinutes`, `SeriesText`, `P4_ACTIONS`, `GROUP_SUBJECT`).
- Produces:
  - `planGroupNames(groups): Rename[]` (`{ id, from, to }`).
  - `planCoachLinks(team: TeamRow[], groups): CoachPlan` (`{ add: CoachLink[]; unmatched: { teamMemberName; text }[] }`).
  - `planProgramPublic(rows: { id; name; programPublic: unknown }[]): { id; name }[]`.
  - `readSlots(v): Slot[]`, `slotStart(timeSlot): string | null`, `oldScoalaSeries(events, season): EventRecord[]`, `planSchoolSeries({ slots, groups, sections, events, season }): SchoolSeriesPlan` (`{ create: { groupId; groupName; write: EventWrite; text: SeriesText }[]; unmatched: string[]; unreadSlots: string[]; skipped: string[]; days; from; to; exceptions; leftCancels: string[] }`).
  - `SKIP_NAMES`, `planEventLinks(events, groups): LinkPlan` (`{ link: EventLink[]; skipped: string[]; unmatched: string[] }`), `linkLine(event): { action; changes }`.
  - `planRetire(events, season): Retire[]` (`{ eventId, title, from, to, exceptions: { date, kind, note }[] }`).

- [ ] **Step 1: Write the failing test**

`src/club/groups/__tests__/migrate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { planCoachLinks } from '../migrate/coaches';
import { planGroupNames } from '../migrate/group-names';
import { linkLine, planEventLinks } from '../migrate/link-events';
import { planProgramPublic } from '../migrate/program-public';
import { planRetire } from '../migrate/retire';
import { planSchoolSeries, slotStart } from '../migrate/school-series';
import type { EventRecord, GroupRecord, Recurrence, SectionRecord } from '../types';
import { G_SEASONS } from './fake-group-store';

/** The production shape read on 2026-10-27 (.superpowers/phase4/research.md). */
const SECTIONS: SectionRecord[] = [
  { id: 'afi', name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', publicPage: true, order: 1, slug: 'scoala-afi' },
  { id: 'club', name: 'Club', kind: 'club', publicPage: false, order: 2, slug: 'club' },
];
const grp = (id: string, name: string, sectionId: string, order: number): GroupRecord => ({ id, name, sectionId, order, active: true, priceListId: null, coachIds: [], programPublic: true });
const GROUPS: GroupRecord[] = [
  grp('gold', 'Avansați Gold', 'afi', 1), grp('pp', 'Primii Pași', 'afi', 2), grp('inc', 'Începători', 'afi', 3), grp('is', 'Intermediari Silver', 'afi', 4),
  grp('ib', 'Intermediari Bronze', 'afi', 5), grp('as', 'Avansați Silver', 'afi', 6), grp('ab', 'Avansați Bronze', 'afi', 7), grp('pro', 'Profesioniști', 'club', 1), grp('av', 'Avansați', 'club', 2),
];
const SLOTS = [
  { timeSlot: '09:00 - 09:50', courses: ['Avansați Gold'] },
  { timeSlot: '10:00 - 10:50', courses: ['Primii Paşi', 'Intermediari Silver', 'Avansați Silver'] },
  { timeSlot: '11:00 - 11:50', courses: ['Începători', 'Intermediari Bronze', 'Avansați Bronze'] },
];
const rec = (over: Partial<Recurrence>): Recurrence => ({ freq: 'weekly', days: ['sat', 'sun'], weekOfMonth: null, startTime: '10:00', endTime: '12:50', singleDate: null, seasonStart: '2026-10-03', seasonEnd: '2027-05-30', ...over });
const ev = (id: string, title: string, type: string, recurrence: Recurrence, over: Partial<EventRecord> = {}): EventRecord => ({ id, title, type, description: null, groupId: null, recurrence, exceptions: [], ...over });
const EVENTS: EventRecord[] = [
  ev('e-av', 'Antrenament: Avansati', 'curs', rec({ days: ['tue', 'thu'], startTime: '18:00', endTime: '19:30', seasonStart: '2026-10-01', seasonEnd: '2027-05-31' })),
  ev('e-titlu', 'Titlu', 'curs', rec({ freq: 'none', days: [], singleDate: '2026-11-03', startTime: '10:00', endTime: '11:00', seasonStart: null, seasonEnd: null })),
  ev('e-old', 'Școala de patinaj', 'scoala', rec({ seasonStart: '2025-10-04', seasonEnd: '2026-05-31' })),
  ev('e-now', 'Școala de patinaj', 'scoala', rec({}), { exceptions: [
    { date: '2026-10-31', kind: 'liber', newDate: null, newStartTime: null, newEndTime: null, newTitle: 'Vacanța de toamnă', reason: null },
    { date: '2026-11-14', kind: 'anulat', newDate: null, newStartTime: null, newEndTime: null, newTitle: 'Patinoar închis', reason: null },
    { date: '2026-11-21', kind: 'cancel', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: null },
  ] }),
  ev('e-cupa', 'Cupa Primaverii', 'concurs', rec({ freq: 'none', days: [], singleDate: '2027-04-10' })),
  ev('e-test', 'Curs Grupa A', 'curs', rec({ days: ['mon'] })),
];
const SEASON = G_SEASONS[1];

describe('step 1 group-names', () => {
  it('rewrites cedilla letters with comma letters and nothing else', () => {
    expect(planGroupNames([{ id: 'pp', name: 'Primii Paşi' }, { id: 'ib', name: 'Intermediari Bronze' }, { id: 'x', name: 'Ţarc Ş' }])).toEqual([
      { id: 'pp', from: 'Primii Paşi', to: 'Primii Pași' }, { id: 'x', from: 'Ţarc Ş', to: 'Țarc Ș' },
    ]);
  });
});

describe('step 2 coaches (exact key match, W19)', () => {
  it('links the production texts: Club Avansați, never a Școala Avansați <nivel>', () => {
    const team = [{ id: 'andreea', name: 'Andreea Pascu', groups: ['Profesionisti', 'Avansati'] }, { id: 'virgil', name: 'Virgil Pascu', groups: ['Intermediari Silver', 'Intermediari Bronze'] }];
    expect(planCoachLinks(team, GROUPS)).toEqual({
      add: [
        { groupId: 'pro', groupName: 'Profesioniști', teamMemberId: 'andreea', teamMemberName: 'Andreea Pascu' }, { groupId: 'av', groupName: 'Avansați', teamMemberId: 'andreea', teamMemberName: 'Andreea Pascu' },
        { groupId: 'is', groupName: 'Intermediari Silver', teamMemberId: 'virgil', teamMemberName: 'Virgil Pascu' }, { groupId: 'ib', groupName: 'Intermediari Bronze', teamMemberId: 'virgil', teamMemberName: 'Virgil Pascu' },
      ],
      unmatched: [],
    });
  });

  it('lists unknown and ambiguous texts; skips a coach already on the group', () => {
    const groups = [...GROUPS.map((g) => (g.id === 'pro' ? { ...g, coachIds: ['andreea'] } : g)), grp('av2', 'Avansati', 'afi', 9)];
    expect(planCoachLinks([{ id: 'andreea', name: 'Andreea Pascu', groups: ['Profesionisti', 'Avansati', 'Grupa nouă', 3] }], groups)).toEqual({
      add: [], unmatched: [{ teamMemberName: 'Andreea Pascu', text: 'Avansati' }, { teamMemberName: 'Andreea Pascu', text: 'Grupa nouă' }],
    });
  });
});

describe('step 3 program-public (W8)', () => {
  it('lists groups without a value only', () => {
    expect(planProgramPublic([{ id: 'a', name: 'A', programPublic: null }, { id: 'b', name: 'B', programPublic: false }, { id: 'c', name: 'C', programPublic: undefined }])).toEqual([{ id: 'a', name: 'A' }, { id: 'c', name: 'C' }]);
  });
});

describe('step 4 school-series (W14, decided 5 to 7)', () => {
  it('reads the first time of a slot', () => {
    expect([slotStart('09:00 - 09:50'), slotStart('9.30-10.20'), slotStart('dimineața')]).toEqual(['09:00', '09:30', null]);
  });

  it('one weekly series per Școala group: 50 min, the old days, its window, its Liber and Anulat dates as reasons', () => {
    const plan = planSchoolSeries({ slots: SLOTS, groups: GROUPS, sections: SECTIONS, events: EVENTS, season: SEASON });
    expect(plan.create.map((c) => [c.groupName, c.write.recurrence.startTime, c.write.recurrence.endTime])).toEqual([
      ['Avansați Gold', '09:00', '09:50'], ['Primii Pași', '10:00', '10:50'], ['Intermediari Silver', '10:00', '10:50'], ['Avansați Silver', '10:00', '10:50'],
      ['Începători', '11:00', '11:50'], ['Intermediari Bronze', '11:00', '11:50'], ['Avansați Bronze', '11:00', '11:50'],
    ]);
    expect(plan.create[1].write).toMatchObject({ title: 'Primii Pași', type: 'scoala', groupId: 'pp', recurrence: { freq: 'weekly', days: ['sat', 'sun'], seasonStart: '2026-10-03', seasonEnd: '2027-05-31' } });
    expect(plan.create[1].write.exceptions).toEqual([
      { date: '2026-10-31', kind: 'liber', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: 'Vacanța de toamnă' },
      { date: '2026-11-14', kind: 'anulat', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: 'Patinoar închis' },
    ]);
    expect(plan.leftCancels).toEqual(['2026-11-21']);
    expect(plan.create[0].text).toEqual({ freq: 'weekly', days: ['sat', 'sun'], startTime: '09:00', durationMin: 50, from: '2026-10-03' });
  });

  it('lists unknown courses and unreadable slots; skips a group that already has a series; Sat + Sun without an old series', () => {
    const slots = [...SLOTS, { timeSlot: 'dimineața', courses: ['Începători'] }, { timeSlot: '12:00', courses: ['Grupa nouă'] }];
    const events = [...EVENTS.filter((e) => e.id !== 'e-now'), ev('g1', 'Primii Pași', 'scoala', rec({ startTime: '10:00', endTime: '10:50' }), { groupId: 'pp' })];
    const plan = planSchoolSeries({ slots, groups: GROUPS, sections: SECTIONS, events, season: SEASON });
    expect(plan.unreadSlots).toEqual(['dimineața']);
    expect(plan.unmatched).toEqual(['Grupa nouă']);
    expect(plan.skipped).toEqual(['Primii Pași']);
    expect(plan.create).toHaveLength(6);
    expect([plan.days, plan.from]).toEqual([['sat', 'sun'], '2026-10-01']);
  });
});

describe('step 5 link-events', () => {
  it('links "Antrenament: Avansati" to Club Avansați; leaves "Titlu", test names and other types alone', () => {
    const plan = planEventLinks(EVENTS, GROUPS);
    expect(plan.link).toEqual([{ eventId: 'e-av', title: 'Antrenament: Avansati', groupId: 'av', groupName: 'Avansați' }]);
    expect(plan.skipped).toEqual(['Curs Grupa A']);
    expect(plan.unmatched).toEqual(['Titlu']);
  });

  it('writes the line the group page would write (decided 1)', () => {
    expect(linkLine(EVENTS[0])).toEqual({ action: 'program-added', changes: { series: { freq: 'weekly', days: ['tue', 'thu'], startTime: '18:00', durationMin: 90, from: '2026-10-01' } } });
    expect(linkLine(EVENTS[1])).toEqual({ action: 'class-added', changes: { date: '2026-11-03', startTime: '10:00', durationMin: 60 } });
  });
});

describe('step 6 retire-old-series', () => {
  it('lists the unlinked Școala series of the current season with their dates and exceptions; the old season\'s stays', () => {
    expect(planRetire(EVENTS, SEASON)).toEqual([{
      eventId: 'e-now', title: 'Școala de patinaj', from: '2026-10-03', to: '2027-05-30',
      exceptions: [{ date: '2026-10-31', kind: 'liber', note: 'Vacanța de toamnă' }, { date: '2026-11-14', kind: 'anulat', note: 'Patinoar închis' }, { date: '2026-11-21', kind: 'cancel', note: null }],
    }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/migrate.test.ts`
Expected: FAIL (`Cannot find module '../migrate/coaches'`).

- [ ] **Step 3: Write `group-names.ts`, `coaches.ts`, `program-public.ts`**

`src/club/groups/migrate/group-names.ts`:

```ts
import { normalizeGroupName } from '../../migrate/names';

/** Step 1 (spec 4): any group name with cedilla letters is rewritten with comma letters; every rename printed. Pure. */
export type Rename = { id: string; from: string; to: string };

export const planGroupNames = (groups: { id: string; name: string }[]): Rename[] =>
  groups.map((g) => ({ id: g.id, from: g.name, to: normalizeGroupName(g.name) })).filter((r) => r.from !== r.to);
```

`src/club/groups/migrate/coaches.ts`:

```ts
import { nameKey } from '../../migrate/names';
import type { GroupRecord } from '../types';

/** Step 2 (spec 4, W19): each Membri echipă `groups` text matched by key to ONE group; the member added to its coaches when missing. Pure. */
export type TeamRow = { id: string; name: string; groups: unknown };
export type CoachLink = { groupId: string; groupName: string; teamMemberId: string; teamMemberName: string };
export type CoachPlan = { add: CoachLink[]; unmatched: { teamMemberName: string; text: string }[] };

const texts = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []);

/** Exactly one group with the same key; two or none is no match (decided 4). */
export function matchOne(groups: GroupRecord[], text: string): GroupRecord | null {
  const hits = groups.filter((g) => nameKey(g.name) === nameKey(text));
  return hits.length === 1 ? hits[0] : null;
}

export function planCoachLinks(team: TeamRow[], groups: GroupRecord[]): CoachPlan {
  const plan: CoachPlan = { add: [], unmatched: [] };
  for (const t of team) {
    for (const text of texts(t.groups)) {
      const g = matchOne(groups, text);
      if (!g) plan.unmatched.push({ teamMemberName: t.name, text });
      else if (!g.coachIds.includes(t.id)) plan.add.push({ groupId: g.id, groupName: g.name, teamMemberId: t.id, teamMemberName: t.name });
    }
  }
  return plan;
}
```

`src/club/groups/migrate/program-public.ts`:

```ts
/** Step 3 (spec 4, W8): groups whose "Program public" was never written get `true`, so the website shows what it shows today. Pure. */
export const planProgramPublic = (rows: { id: string; name: string; programPublic: unknown }[]): { id: string; name: string }[] =>
  rows.filter((r) => r.programPublic === null || r.programPublic === undefined).map(({ id, name }) => ({ id, name }));
```

- [ ] **Step 4: Write `school-series.ts`**

```ts
import { nameKey } from '../../migrate/names';
import { addMinutes } from '../dates';
import type { SeriesText } from '../program-text';
import { groupSeries, overlapsSeason, seasonBounds } from '../series';
import type { DayKey, EventRecord, EventWrite, ExceptionRow, GroupRecord, SeasonRecord, SectionRecord } from '../types';

/** Step 4 (spec 4, W14): one weekly series per Școala group from today's notebook (`program.scheduleGroups`). Pure. */
export type Slot = { timeSlot: string; courses: string[] };
export type SchoolSeriesInput = { slots: unknown; groups: GroupRecord[]; sections: SectionRecord[]; events: EventRecord[]; season: SeasonRecord };
export type PlannedSchoolSeries = { groupId: string; groupName: string; write: EventWrite; text: SeriesText };
export type SchoolSeriesPlan = {
  create: PlannedSchoolSeries[]; unmatched: string[]; unreadSlots: string[]; skipped: string[]; days: DayKey[]; from: string; to: string;
  exceptions: ExceptionRow[]; leftCancels: string[];
};

const MINUTES = 50;
const WEEKEND: DayKey[] = ['sat', 'sun'];
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function readSlots(v: unknown): Slot[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isRecord).map((s) => ({ timeSlot: typeof s.timeSlot === 'string' ? s.timeSlot : '', courses: Array.isArray(s.courses) ? s.courses.filter((c): c is string => typeof c === 'string') : [] }));
}

/** Decided 6: the first "HH:mm" (also "H:mm", "HH.mm") of the slot text. */
export function slotStart(timeSlot: string): string | null {
  const m = /(\d{1,2})[:.](\d{2})/.exec(timeSlot);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/** The unlinked weekly Școala series whose window overlaps the season (production: the 2026-2027 weekends). */
export const oldScoalaSeries = (events: EventRecord[], season: SeasonRecord): EventRecord[] =>
  events.filter((e) => !e.groupId && e.type === 'scoala' && e.recurrence.freq !== 'none' && overlapsSeason({ from: e.recurrence.seasonStart ?? '', to: e.recurrence.seasonEnd ?? '' }, season));

function windowOf(old: EventRecord[], season: SeasonRecord): { from: string; to: string } {
  const b = seasonBounds(season);
  const starts = old.map((e) => e.recurrence.seasonStart ?? b.start).sort();
  const earliest = starts[0] ?? b.start;
  return { from: earliest > b.start ? earliest : b.start, to: b.end };
}

/** W14: the Liber and Anulat dates of the old series inside the window, the note as `reason`; `cancel` left (decided 7). */
function copiedExceptions(old: EventRecord[], from: string, to: string): { exceptions: ExceptionRow[]; leftCancels: string[] } {
  const inside = old.flatMap((e) => e.exceptions).filter((x) => x.date >= from && x.date <= to);
  const exceptions = inside
    .filter((x) => x.kind === 'liber' || x.kind === 'anulat')
    .filter((x, i, all) => all.findIndex((y) => y.date === x.date) === i)
    .map((x) => ({ date: x.date, kind: x.kind, newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: x.reason ?? x.newTitle }));
  return { exceptions, leftCancels: inside.filter((x) => x.kind === 'cancel').map((x) => x.date) };
}

type Context = { schoolGroups: GroupRecord[]; events: EventRecord[]; season: SeasonRecord; days: DayKey[]; from: string; to: string; exceptions: ExceptionRow[] };

function seriesFor(c: Context, g: GroupRecord, start: string): PlannedSchoolSeries {
  const write: EventWrite = {
    title: g.name, type: 'scoala', description: null, groupId: g.id, exceptions: c.exceptions,
    recurrence: { freq: 'weekly', days: c.days, weekOfMonth: null, startTime: start, endTime: addMinutes(start, MINUTES), singleDate: null, seasonStart: c.from, seasonEnd: c.to },
  };
  return { groupId: g.id, groupName: g.name, write, text: { freq: 'weekly', days: c.days, startTime: start, durationMin: MINUTES, from: c.from } };
}

function slotPlan(c: Context, slot: Slot, plan: SchoolSeriesPlan): void {
  const start = slotStart(slot.timeSlot);
  if (!start) return void plan.unreadSlots.push(slot.timeSlot);
  for (const course of slot.courses) {
    const hits = c.schoolGroups.filter((g) => nameKey(g.name) === nameKey(course));
    if (hits.length !== 1) plan.unmatched.push(course);
    else if (groupSeries(c.events, hits[0].id, c.season).length) plan.skipped.push(hits[0].name);
    else plan.create.push(seriesFor(c, hits[0], start));
  }
}

export function planSchoolSeries(input: SchoolSeriesInput): SchoolSeriesPlan {
  const schools = new Set(input.sections.filter((s) => s.kind === 'school').map((s) => s.id));
  const old = oldScoalaSeries(input.events, input.season);
  const days = [...new Set(old.flatMap((e) => e.recurrence.days))];
  const { from, to } = windowOf(old, input.season);
  const { exceptions, leftCancels } = copiedExceptions(old, from, to);
  const c: Context = {
    schoolGroups: input.groups.filter((g) => schools.has(g.sectionId ?? '')), events: input.events, season: input.season, days: days.length ? days : WEEKEND, from, to, exceptions,
  };
  const plan: SchoolSeriesPlan = { create: [], unmatched: [], unreadSlots: [], skipped: [], days: c.days, from, to, exceptions, leftCancels };
  for (const slot of readSlots(input.slots)) slotPlan(c, slot, plan);
  return plan;
}
```

Order the days Monday first if a test needs it: `DAY_ORDER.filter((d) => days.includes(d))` from `../program-text` (production is Sat and Sun; the test expects `['sat', 'sun']`).

- [ ] **Step 5: Write `link-events.ts` and `retire.ts`**

`src/club/groups/migrate/link-events.ts`:

```ts
import { nameKey } from '../../migrate/names';
import { P4_ACTIONS } from '../history-lines';
import { classView, seriesText, seriesView } from '../series';
import type { EventRecord, GroupRecord } from '../types';
import { matchOne } from './coaches';

/** Step 5 (spec 4): unlinked `curs` events whose title, without "Antrenament:" or "Curs", names ONE group get `group` set. Pure. */
export const SKIP_NAMES: readonly string[] = ['Grupa A', 'Weekend curs', 'Performanță', 'Grupa Mică', 'Grupa Mare'];
export type EventLink = { eventId: string; title: string; groupId: string; groupName: string };
export type LinkPlan = { link: EventLink[]; skipped: string[]; unmatched: string[] };

const PREFIX = /^\s*(antrenament\s*:|curs\b)\s*/i;
const SKIP: ReadonlySet<string> = new Set(SKIP_NAMES.map(nameKey));
export const bareTitle = (title: string): string => title.replace(PREFIX, '').trim();

export function planEventLinks(events: EventRecord[], groups: GroupRecord[]): LinkPlan {
  const plan: LinkPlan = { link: [], skipped: [], unmatched: [] };
  for (const e of events.filter((x) => !x.groupId && x.type === 'curs')) {
    const name = bareTitle(e.title);
    const g = SKIP.has(nameKey(name)) ? null : matchOne(groups, name);
    if (SKIP.has(nameKey(name))) plan.skipped.push(e.title);
    else if (!g) plan.unmatched.push(e.title);
    else plan.link.push({ eventId: e.id, title: e.title, groupId: g.id, groupName: g.name });
  }
  return plan;
}

/** Decided 1: the line the group page writes when the program is added there. */
export function linkLine(e: EventRecord): { action: string; changes: Record<string, unknown> } {
  const series = seriesView(e);
  if (series) return { action: P4_ACTIONS.programAdded, changes: { series: seriesText(series) } };
  const one = classView(e);
  return { action: P4_ACTIONS.classAdded, changes: { date: one?.date ?? null, startTime: one?.startTime ?? null, durationMin: one?.durationMin ?? null } };
}
```

`src/club/groups/migrate/retire.ts`:

```ts
import type { EventRecord, SeasonRecord } from '../types';
import { oldScoalaSeries } from './school-series';

/** Step 6 (spec 4, W14): the unlinked Școala series step 4 copied, listed with their dates and exceptions before they go. Pure. */
export type Retire = { eventId: string; title: string; from: string; to: string; exceptions: { date: string; kind: string; note: string | null }[] };

export const planRetire = (events: EventRecord[], season: SeasonRecord): Retire[] =>
  oldScoalaSeries(events, season).map((e) => ({
    eventId: e.id, title: e.title, from: e.recurrence.seasonStart ?? '', to: e.recurrence.seasonEnd ?? '',
    exceptions: e.exceptions.map((x) => ({ date: x.date, kind: x.kind, note: x.reason ?? x.newTitle })),
  }));
```

- [ ] **Step 6: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/migrate.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS; zero type errors.

- [ ] **Step 7: Commit**

```bash
git add src/club/groups/migrate src/club/groups/__tests__/migrate.test.ts
git commit -m "feat(migration): planners for group names, coaches, program public, school series, event links and retiring the old series"
```

---

### Task 2: The script `scripts/migrate-groups-schedules.js`

**Files:**
- Create: `scripts/migrate-groups-schedules.js`
- Modify: `package.json` (add `"migrate:groups": "node scripts/migrate-groups-schedules.js"` after `"migrate:athletes"`)
- Test: `src/club/groups/__tests__/migrate-script.test.ts` (source-reading)

**Interfaces:**
- Consumes: the Task 1 planners from `dist/src/club/groups/migrate/*`, `dist/src/club/groups/strapi-store` (`strapiGroupStore`), `history-lines` (`P4_ACTIONS`, `GROUP_SUBJECT`), `season-pick` (`currentSeason`).
- Produces: `node scripts/migrate-groups-schedules.js --step=<group-names | coaches | program-public | school-series | link-events | retire-old-series> [--apply]`; prints `[dry-run]` / `[apply]` lines; exit 0 on success, 1 on a refusal ("refused, nothing written: ...") or a failure (the item, how many were written before it, "re-running the step continues safely"), 2 on an unknown step.

- [ ] **Step 1: Write the failing source test**

`src/club/groups/__tests__/migrate-script.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = readFileSync(join(__dirname, '..', '..', '..', '..', 'scripts', 'migrate-groups-schedules.js'), 'utf8');

describe('migrate-groups-schedules.js (spec 4)', () => {
  it('has the six steps in order, dry run by default, actor migrare', () => {
    for (const step of ['group-names', 'coaches', 'program-public', 'school-series', 'link-events', 'retire-old-series']) expect(SCRIPT).toContain(`'${step}'`);
    expect(SCRIPT).toContain("process.argv.includes('--apply')");
    expect(SCRIPT).toContain("const ACTOR = 'migrare'");
  });

  it('reads the planners from dist and writes item by item', () => {
    expect(SCRIPT).toContain("require(`../dist/src/club/groups/${p}`)");
    expect(SCRIPT).toContain('async function writeEach');
    expect(SCRIPT).not.toMatch(/store\.transaction\(async \(\) => \{\s*for/);
  });

  it('never touches team_members.groups or program.scheduleGroups', () => {
    expect(SCRIPT).not.toMatch(/team-member[^\n]*update/);
    expect(SCRIPT).not.toMatch(/scheduleGroups\s*:/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/club/groups/__tests__/migrate-script.test.ts`
Expected: FAIL (`ENOENT ... migrate-groups-schedules.js`).

- [ ] **Step 3: Write the script**

`scripts/migrate-groups-schedules.js`:

```js
'use strict';
/**
 * Phase 4 deploy data (spec 4). One step per run, in this order:
 *   group-names, coaches, program-public, school-series, link-events, retire-old-series
 * retire-old-series runs only after the user has checked /cursuri/program, the website calendar and the group Program tabs.
 * Dry run by default; pass --apply to write. Each step is idempotent and re-runnable; no big transaction.
 * Usage: node scripts/migrate-groups-schedules.js --step=<step> [--apply]
 * Needs the compiled code (npm run build): planners are read from dist/src/club/groups.
 */
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const APPLY = process.argv.includes('--apply');
const STEP = (process.argv.find((a) => a.startsWith('--step=')) || '').slice('--step='.length);
const ACTOR = 'migrare';
const GROUP = 'api::group.group';
const TEAM = 'api::team-member.team-member';
const EVENT = 'api::calendar-event.calendar-event';

const log = (...a) => console.log(APPLY ? '[apply]' : '[dry-run]', ...a);
const lib = (p) => require(`../dist/src/club/groups/${p}`);

class StepRefused extends Error {}

async function writeEach(items, label, write) {
  for (let i = 0; i < items.length; i += 1) {
    try {
      await write(items[i]);
    } catch (e) {
      throw new Error(`${label(items[i])} failed; ${i} of ${items.length} written before it; re-running the step continues safely: ${e.message}`, { cause: e });
    }
  }
}

async function currentSeasonOf({ store }) {
  const season = lib('season-pick').currentSeason(await store.seasons());
  if (!season) throw new StepRefused('no current Sezon: mark one current before this step');
  return season;
}

const groupLine = (groupId, action, changes) => ({ subjectType: lib('history-lines').GROUP_SUBJECT, subjectId: groupId, action, changes, actor: ACTOR });

async function namesPlan({ store }) {
  return lib('migrate/group-names').planGroupNames(await store.groups());
}

async function stepGroupNames(ctx) {
  const { P4_ACTIONS } = lib('history-lines');
  const plan = await namesPlan(ctx);
  log('group names to rewrite:', plan.length);
  plan.forEach((r) => log(`  "${r.from}" -> "${r.to}"`));
  if (!APPLY) return;
  await writeEach(plan, (r) => `group ${r.id}`, (r) => ctx.store.transaction(async () => {
    await ctx.store.updateGroup(r.id, { name: r.to });
    await ctx.store.record(groupLine(r.id, P4_ACTIONS.groupUpdated, { fields: { name: { from: r.from, to: r.to } } }));
  }));
}

async function coachPlan({ app, store }) {
  const team = (await app.db.query(TEAM).findMany({ select: ['documentId', 'name', 'groups'], limit: 1000 })).map((t) => ({ id: t.documentId, name: t.name, groups: t.groups }));
  return { plan: lib('migrate/coaches').planCoachLinks(team, await store.groups()), team };
}

function byGroup(links) {
  const out = new Map();
  for (const l of links) out.set(l.groupId, [...(out.get(l.groupId) || []), l]);
  return [...out.entries()];
}

async function stepCoaches(ctx) {
  const { P4_ACTIONS } = lib('history-lines');
  const { plan, team } = await coachPlan(ctx);
  const nameOf = (ids) => team.filter((t) => ids.includes(t.id)).map((t) => t.name).join(', ');
  log('coach links to add:', plan.add.length, 'unmatched texts:', plan.unmatched.length);
  plan.add.forEach((l) => log(`  ${l.teamMemberName} -> ${l.groupName}`));
  plan.unmatched.forEach((u) => log(`  unmatched, skipped: ${u.teamMemberName}: "${u.text}"`));
  if (!APPLY) return;
  await writeEach(byGroup(plan.add), ([groupId]) => `coaches of ${groupId}`, ([groupId, links]) => ctx.store.transaction(async () => {
    const group = await ctx.store.group(groupId);
    const coachIds = [...new Set([...group.coachIds, ...links.map((l) => l.teamMemberId)])];
    await ctx.store.updateGroup(groupId, { coachIds });
    await ctx.store.record(groupLine(groupId, P4_ACTIONS.groupUpdated, { fields: { coaches: { from: nameOf(group.coachIds), to: nameOf(coachIds) } } }));
  }));
}

async function stepProgramPublic({ app, store }) {
  const rows = (await app.db.query(GROUP).findMany({ select: ['documentId', 'name', 'programPublic'], limit: 1000 })).map((g) => ({ id: g.documentId, name: g.name, programPublic: g.programPublic }));
  const plan = lib('migrate/program-public').planProgramPublic(rows);
  log('groups to set "Program public" on (no Istoric line, decided 2):', plan.length);
  plan.forEach((g) => log(`  ${g.name}`));
  if (!APPLY) return;
  await writeEach(plan, (g) => `group ${g.name}`, (g) => store.updateGroup(g.id, { programPublic: true }));
}

async function seriesPlan(ctx) {
  const { store, app } = ctx;
  const program = await app.documents('api::program.program').findFirst({});
  const [groups, sections, events] = await Promise.all([store.groups(), store.sections(), store.events()]);
  return lib('migrate/school-series').planSchoolSeries({ slots: program ? program.scheduleGroups : [], groups, sections, events, season: await currentSeasonOf(ctx) });
}

async function stepSchoolSeries(ctx) {
  const { P4_ACTIONS } = lib('history-lines');
  const { programLineFrom } = lib('program-text');
  const plan = await seriesPlan(ctx);
  log('series to create:', plan.create.length, 'days:', plan.days.join(','), 'window:', plan.from, '->', plan.to, 'copied dates:', plan.exceptions.length);
  plan.create.forEach((c) => log(`  ${c.groupName}: ${programLineFrom(c.text)}`));
  plan.skipped.forEach((n) => log(`  already has a series, skipped: ${n}`));
  plan.unmatched.forEach((t) => log(`  course text matches no Școala group, skipped: "${t}"`));
  plan.unreadSlots.forEach((t) => log(`  slot without a time, skipped: "${t}"`));
  plan.leftCancels.forEach((d) => log(`  old "cancel" date not copied: ${d}`));
  if (!APPLY) return;
  await writeEach(plan.create, (c) => `series of ${c.groupName}`, (c) => ctx.store.transaction(async () => {
    await ctx.store.createEvent(c.write);
    await ctx.store.record(groupLine(c.groupId, P4_ACTIONS.programAdded, { series: c.text }));
  }));
}

async function linkPlan({ store }) {
  return lib('migrate/link-events').planEventLinks(await store.events(), await store.groups());
}

async function stepLinkEvents(ctx) {
  const { linkLine } = lib('migrate/link-events');
  const plan = await linkPlan(ctx);
  const events = await ctx.store.events();
  log('events to link:', plan.link.length);
  plan.link.forEach((l) => log(`  "${l.title}" -> ${l.groupName}`));
  plan.skipped.forEach((t) => log(`  test or demo name, skipped: "${t}"`));
  plan.unmatched.forEach((t) => log(`  matches no group, left alone: "${t}"`));
  if (!APPLY) return;
  await writeEach(plan.link, (l) => `event "${l.title}"`, (l) => ctx.store.transaction(async () => {
    await ctx.app.documents(EVENT).update({ documentId: l.eventId, data: { group: l.groupId } });
    const line = linkLine(events.find((e) => e.id === l.eventId));
    await ctx.store.record(groupLine(l.groupId, line.action, line.changes));
  }));
}

async function stepRetire(ctx) {
  const plan = lib('migrate/retire').planRetire(await ctx.store.events(), await currentSeasonOf(ctx));
  log('old Școala series to delete:', plan.length);
  plan.forEach((r) => log(`  "${r.title}" ${r.from} -> ${r.to}; exceptions: ${r.exceptions.map((x) => `${x.date} ${x.kind}${x.note ? ` (${x.note})` : ''}`).join(', ') || 'none'}`));
  if (!APPLY) return;
  await writeEach(plan, (r) => `event ${r.eventId}`, (r) => ctx.store.transaction(async () => {
    await ctx.store.deleteEvent(r.eventId);
    await ctx.store.record({ subjectType: 'calendar-event', subjectId: r.eventId, action: 'event-retired', changes: { title: r.title }, actor: ACTOR });
  }));
}

/** Work a step still has; a later step refuses to run while a step it needs has some (decided 8). */
const PENDING = {
  'group-names': async (ctx) => (await namesPlan(ctx)).length,
  'school-series': async (ctx) => (await seriesPlan(ctx)).create.length,
};
const NEEDS = { coaches: ['group-names'], 'school-series': ['group-names'], 'link-events': ['group-names'], 'retire-old-series': ['school-series'] };

async function requirePreviousSteps(ctx) {
  for (const previous of NEEDS[STEP] || []) {
    const left = await PENDING[previous](ctx);
    if (left) throw new StepRefused(`--step=${previous} still has ${left} item(s) to write: run it with --apply first, then this step`);
  }
}

/** Strapi's post-commit events still read through the pool; destroying it under them exits 1 after a success. */
async function shutDown(app) {
  const idle = await require('../dist/src/club/deploy/pool-idle').waitForIdlePool(app.db.connection.client.pool);
  if (!idle) console.error('database connections still busy after 5 s; shutting down anyway');
  await app.destroy();
}

const STEPS = {
  'group-names': stepGroupNames,
  coaches: stepCoaches,
  'program-public': stepProgramPublic,
  'school-series': stepSchoolSeries,
  'link-events': stepLinkEvents,
  'retire-old-series': stepRetire,
};

async function main() {
  const step = STEPS[STEP];
  if (!step) {
    console.error(`--step must be one of: ${Object.keys(STEPS).join(', ')}`);
    process.exit(2);
  }
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const ctx = { app, store: lib('strapi-store').strapiGroupStore(app) };
  try {
    await requirePreviousSteps(ctx);
    await step(ctx);
  } catch (e) {
    console.error(e instanceof StepRefused ? `refused, nothing written: ${e.message}` : e);
    await shutDown(app);
    process.exit(1);
  }
  await shutDown(app);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

`package.json`, in `scripts`, after `"migrate:athletes"`:

```json
    "migrate:groups": "node scripts/migrate-groups-schedules.js",
```

- [ ] **Step 4: Run the tests and checks**

Run: `npx vitest run src/club/groups/__tests__/migrate-script.test.ts && npx vitest run && npx tsc --noEmit && node --check scripts/migrate-groups-schedules.js`
Expected: PASS; zero type errors; `node --check` silent.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-groups-schedules.js package.json src/club/groups/__tests__/migrate-script.test.ts
git commit -m "feat(migration): groups and schedules deploy script, one step per run, dry run by default"
```

---

### Task 3: Proof on a throwaway Postgres seeded with the production shape

**Files:** none in the repo. Temporary files in `${TMPDIR:-/tmp}/es44`.

**Interfaces:**
- Consumes: Tasks 1 and 2, `scripts/fixtures/phase4-shape.js` (plan 4-1).
- Proves (spec 4, 12): every step dry, then `--apply`, then `--apply` again writing nothing; refusals out of order; after steps 1 to 5 Grupe shows the 7 Școala groups with a program and the 2 Club groups (Avansați with its linked training); coaches linked; names with comma letters; `/api/club/schedule` equals today's notebook; the Școala weekends on the public calendar have the same states and notes before step 4, after step 5 and after step 6.

Container `es44-pg` on 127.0.0.1:55444, Strapi on 1364 (only for the reads after the steps; the script itself boots Strapi on its own and does not listen). Never 1337, 1340, 3010 or 5432.

- [ ] **Step 1: Checks, Postgres, build, fixture**

```bash
REPO=$(git rev-parse --show-toplevel); cd "$REPO"
npx vitest run && npx tsc --noEmit
T="${TMPDIR:-/tmp}/es44"; mkdir -p "$T/private"
```

Write `$T/env` exactly as in plan 4-2 Task 8 Step 2 with `DATABASE_PORT=55444` and `PORT=1364`, then:

```bash
docker run -d --name es44-pg -e POSTGRES_USER=strapi -e POSTGRES_PASSWORD=strapi -e POSTGRES_DB=strapi -p 127.0.0.1:55444:5432 postgres:16
until docker exec es44-pg pg_isready -U strapi >/dev/null 2>&1; do sleep 1; done
(set -a; . "$T/env"; set +a; npm run build)
(set -a; . "$T/env"; set +a; ES_THROWAWAY_DB=1 IDS_FILE="$T/ids.json" node scripts/fixtures/phase4-shape.js)
(set -a; . "$T/env"; set +a; npx strapi admin:create-user --email=admin@example.com --password='Throwaway123' --firstname=Admin)
q() { docker exec -i es44-pg psql -U strapi -d strapi -At -c "$1"; }
run() { (set -a; . "$T/env"; set +a; node scripts/migrate-groups-schedules.js "$@"); echo "exit $?"; }
q "update club_groups set program_public = null"
```

Expected: `phase 4 fixture ok`, the admin created. The last line makes "Program public" empty on every group, as a column added by the deploy is in production.

- [ ] **Step 2: The website weekends before (reference)**

```bash
serve() { (set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi start > "$T/strapi.log" 2>&1 & echo $! > "$T/pid"); until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1364/_health | grep -q 204; do sleep 2; done; }
stop() { kill "$(cat "$T/pid")"; while kill -0 "$(cat "$T/pid")" 2>/dev/null; do sleep 1; done; }
weekends() {
  for r in 2026-10-01:2026-12-29 2026-12-30:2027-03-29 2027-03-30:2027-05-31; do curl -s "http://127.0.0.1:1364/api/calendar/occurrences?from=${r%%:*}&to=${r##*:}"; echo; done | python3 -c '
import json, sys
days = {}
for line in sys.stdin:
    if not line.strip(): continue
    for o in json.loads(line)["data"]:
        if o["type"] != "scoala": continue
        st = ("liber" if o.get("cancelReason") == "blackout" else "anulat") if o["status"] == "cancelled" else "curs"
        days.setdefault(o["date"], []).append((st, o.get("note") or ""))
def merge(v):
    states = [s for s, _ in v]
    state = "curs" if "curs" in states else "anulat" if "anulat" in states else "liber"
    note = next((n for _, n in v if n), "")
    return state, note
print(json.dumps({d: merge(v) for d, v in sorted(days.items())}, ensure_ascii=False))'
}
serve
weekends > "$T/before.json"
curl -s http://127.0.0.1:1364/api/club/schedule > "$T/schedule-before.json"
stop
python3 -c "import json; d=json.load(open('$T/before.json')); print(len(d), d['2026-10-31'], d['2026-11-14'])"
```

Expected: about 70 weekend dates; `['anulat', 'Vacanța de toamnă']` for 31 October (the website's existing reading of a cancelled date) and `['anulat', 'Patinoar închis']` for 14 November; `/api/club/schedule` has no slots yet. (The merge is the W21 rule of plan 4-7; before migration only the old series exists, so it is the old series' own state.)

- [ ] **Step 3: Out-of-order refusals**

```bash
run --step=school-series
run --step=retire-old-series
run --step=nonsense
```

Expected: `refused, nothing written: --step=group-names still has 1 item(s) to write ...` and `exit 1`; `refused, nothing written: --step=school-series still has 7 item(s) to write ...` and `exit 1`; `--step must be one of: ...` and `exit 2`.

- [ ] **Step 4: Steps 1 to 5, each dry, apply, apply again**

```bash
for s in group-names coaches program-public school-series link-events; do
  echo "== $s"; run --step=$s; run --step=$s --apply; run --step=$s --apply | tail -2
done
```

Expected, per step (the dry run and the first apply print the same plan; the second apply prints 0 and `exit 0`):
- `group-names`: `group names to rewrite: 1`, `"Primii Paşi" -> "Primii Pași"`; then `0`.
- `coaches`: `coach links to add: 4 unmatched texts: 0`, `Andreea Pascu -> Profesioniști`, `Andreea Pascu -> Avansați`, `Virgil Pascu -> Intermediari Silver`, `Virgil Pascu -> Intermediari Bronze`; then `0`.
- `program-public`: `9`; then `0`.
- `school-series`: `series to create: 7 days: sat,sun window: 2026-10-03 -> 2027-05-31 copied dates: 2`, one line per group, e.g. `Primii Pași: Sâ și Du, 10:00, 50 min, din 3 oct 2026`; then `series to create: 0` and seven `already has a series, skipped` lines.
- `link-events`: `events to link: 1`, `"Antrenament: Avansati" -> Avansați`, `matches no group, left alone: "Titlu"`; then `0`.

- [ ] **Step 5: Checks after step 5**

```bash
q "select name from club_groups order by id" | tr '\n' ',' ; echo
q "select g.name, string_agg(t.name, ', ' order by t.name) from club_groups g join club_groups_coaches_lnk l on l.group_id = g.id join team_members t on t.id = l.team_member_id group by g.name order by g.name"
q "select count(*) from club_groups where program_public is null"
q "select subject_type, action, actor from history_entries where actor = 'migrare' group by 1, 2, 3 order by 1, 2"
q "select count(*) from programs where schedule_groups is not null"
serve
TOKEN=$(curl -s -X POST http://127.0.0.1:1364/admin/login -H 'Content-Type: application/json' -d '{"email":"admin@example.com","password":"Throwaway123"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])')
weekends > "$T/after5.json"
python3 -c "import json; a=json.load(open('$T/before.json')); b=json.load(open('$T/after5.json')); print('same' if a == b else [d for d in a if a.get(d) != b.get(d)][:10])"
curl -s http://127.0.0.1:1364/api/club/schedule | python3 -c 'import json,sys; [print(s["start"], s["end"], s["groups"]) for s in json.load(sys.stdin)["data"][0]["slots"]]'
```

```bash
curl -s "http://127.0.0.1:1364/api/club/groups?section=scoala-afi" -H "Authorization: Bearer $TOKEN" | python3 -c 'import json,sys; [print(r["name"], r["program"], r["coaches"]) for r in json.load(sys.stdin)["data"]["rows"]]'
curl -s "http://127.0.0.1:1364/api/club/groups?section=club" -H "Authorization: Bearer $TOKEN" | python3 -c 'import json,sys; [print(r["name"], r["program"], r["coaches"]) for r in json.load(sys.stdin)["data"]["rows"]]'
curl -s "http://127.0.0.1:1364/api/club/groups/$(python3 -c "import json; print(json.load(open('$T/ids.json'))['groups']['Primii Paşi'])")/history" -H "Authorization: Bearer $TOKEN" | python3 -c 'import json,sys; [print(l["actor"], l["text"]) for l in json.load(sys.stdin)["data"]]'
stop
```

Expected: the names list has `Primii Pași` (comma) and no cedilla; coaches: Avansați and Profesioniști `Andreea Pascu`, Intermediari Bronze and Intermediari Silver `Virgil Pascu`; `0` empty "Program public"; history rows from `migrare`: `group|group-updated`, `group|program-added`; `1` (the notebook data kept, W18); `same` (every weekend has the same state and note); the slots `09:00 09:50 ['Avansați Gold']`, `10:00 10:50 ['Primii Pași', 'Intermediari Silver', 'Avansați Silver']`, `11:00 11:50 ['Începători', 'Intermediari Bronze', 'Avansați Bronze']` (today's notebook, comma letters); the seven Școala rows each with one program line (`Sâ, Du 09:00`, `Sâ, Du 10:00`, ...); Club: Profesioniști `[]`, Avansați `['Ma, Jo 18:00']`, both `['Andreea Pascu']`; Primii Pași's Istoric shows `Migrare` with `Program adăugat: Sâ și Du, 10:00, 50 min, din 3 oct 2026.` and `Nume: "Primii Paşi" → "Primii Pași"`.

- [ ] **Step 6: Step 6 (after the user's check in production; here at once)**

```bash
run --step=retire-old-series
run --step=retire-old-series --apply
run --step=retire-old-series --apply | tail -2
q "select title from calendar_events e where not exists (select 1 from calendar_events_group_lnk l where l.calendar_event_id = e.id) and type = 'scoala'"
serve
weekends > "$T/after6.json"
python3 -c "import json; a=json.load(open('$T/before.json')); b=json.load(open('$T/after6.json')); print('same' if a == b else [d for d in a if a.get(d) != b.get(d)][:10])"
stop
```

Expected: the dry run lists one series `"Școala de patinaj" 2026-10-03 -> 2027-05-30; exceptions: 2026-10-31 liber (Vacanța de toamnă), 2026-11-14 anulat (Patinoar închis)`; the second apply `0`; the remaining unlinked Școala event is the 2025-2026 one only; `same`.

- [ ] **Step 7: Clean up**

```bash
docker rm -f es44-pg
rm -rf "$T"
```

Expected: container removed. No commit unless a check failed (then a `fix(migration): ...` commit in the planner or the script, and the affected steps repeated).

---

## Notes for the deploy (spec 4, "Deploy order")

1. Database backup. 2. Backend deploy (schema of plan 4-1 applied on restart). 3. Frontend deploy (plan 4-7; the notebook falls back to `program.scheduleGroups` while no school group has a series). 4. Steps 1 to 5 of this script, each `--step=<s>` dry, shown to the user, then `--apply`. 5. Checks: Grupe, each group's Program, /cursuri/program, /inscrieri "Programul pe următoarea lună". 6. `--step=retire-old-series` dry, then `--apply` after the user approves.

## Self-review

- **Spec coverage.** Spec 4 steps 1 (T1 `planGroupNames`, T2), 2 (coaches, exact key, unmatched listed, `team_members.groups` untouched), 3 (program-public), 4 (school series: course matching, first time + 50 min, days from the old series or Sat + Sun, window, Liber / Anulat copied as reasons, type, title, group, history line, idempotent skip), 5 (link-events: prefix stripped, "Antrenament: Avansati" and "Curs Avansati" forms, "Titlu"/"Eveniment"/"Vacanta scolara" left alone, test names skipped), 6 (retire after the check, dry run lists dates and exceptions); script shape (dry run, `--apply`, one step, idempotent, no big transaction, planners from `dist`, actor "migrare", every write logged and in history); `program.scheduleGroups` kept (W18); proof on the production shape with apply twice and the website comparison (T3).
- **Placeholder scan:** code in every code step; the env file of Task 3 is copied from plan 4-2 Task 8 by its exact location with the two values to change.
- **Type consistency:** `SchoolSeriesPlan.create[].text` is a `SeriesText` for `programLineFrom` and the `program-added` line; `EventLink` ids are documentIds used by `documents(EVENT).update`; `matchOne` is shared by coaches and links.
- **Review Focus:** apply twice and half-finished runs (T1 skip test, T3 loop), no guessing (T1), same website (T3), order refusals (T2, T3), unreadable inputs (T1).
