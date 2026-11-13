# Coach Portal Additions for the Canvas Screens Implementation Plan

> **Refreshed 2026-11-13** (Task 8 rewritten, Task 10 added; Tasks 1 to 7 and 9 are merged on `main` and unchanged). What changed:
> - Phase 7-3 is merged: Task 8 now names the real `skateClient` (`src/club/skate/client.ts`), `snapshotCache` and `resultsOf` (key `skater:<slug>`, `src/club/skate/cache.ts`), `derive.ts` (`seasonKey`, `currentCategory`, `records`) and the existing `CoachCompetitionSource`, `SkaterRef`, `clubSkaters`, `skaterOf` in `src/club/portal/coach/competitions.ts`. The coach answers keep their shape; only the source becomes real; skate-results down -> the existing `{ available: false }`.
> - User decision 2026-11-13: one competition source per athlete, never merged, as the public site (`edusport_frontend` main `src/lib/strapi-sportsperson.ts` "Competition source selection"): skate-results when the athlete's profile has `skateResultsSlug`, otherwise the Strapi `competitions` entries whose `participantData` names that profile. This applies to both portals, so Task 10 moves the merged sportiv source (`src/club/skate/source.ts`, `src/club/portal/sportiv/*`) onto the same picker.
> - Tasks 8 and 10 run sequentially on `feat/roles` in `.claude/worktrees/roles` (after plan 6b-3), never pushed; Task 10 carries their boot check (Task 9's is done); throwaway Postgres 55487, Strapi 1419, fake skate-results 18895. vitest `--maxWorkers=3`; tests behaviour only. Portal sign-in is password or Google only (no portal 2FA step anywhere in this plan).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The coach API the rebuilt coach screens need and that does not exist yet: move a child to another own group from a date, remove a child from an own group from a date (with the scheduled date on the member list), a month calendar, the next class date on the group list, the group's location, richer athlete detail (presence numbers, abonament, competitions summary, groups), not-done classes in Istoric, and a club competitions list.

**Architecture:** Additions to `src/club/portal/coach/` on top of the phase 4 group service (`src/club/groups/members.ts`, `membership-plan.ts`), the phase 5 day rows (`src/club/presence/attendance/day.ts`) and phase 6 ownership rules (`ownership.ts`, `rules.ts`). Competitions come through a small `CoachCompetitionSource` interface with a null implementation now and a real one after phase 7-3 merges. Routes in `src/api/portal/routes/02-coach.ts`, guarded by `global::is-coach`; every new route joins the phase 6 matrix test.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS), Postgres 16, Vitest 3, Node 22.

**Spec and design:** frontend spec `edusport_frontend/.claude/worktrees/p6fe/docs/superpowers/specs/2026-11-09-portal-canvas-design.md`; coach boards `edusport_frontend/.claude/worktrees/p6fe/docs/portal/mockups/screens/coach-canvas-v1/` (generator `gen_coach.py` holds the exact copy and data shapes); coach portal spec `docs/superpowers/specs/2026-11-04-coach-portal-design.md` (8.5 add, 8.7 card, 9.3 Azi, 9.4 Grupe, 9.8 Istoric); phase 4 membership rules W2 (move) and W4 (remove) as coded in `src/club/groups/membership-plan.ts`. Index: `edusport_frontend/.claude/worktrees/p6fe/docs/superpowers/plans/2026-11-09-portal-redesign-index.md`. Conventions: phase 6 plans `2026-11-04-phase6-*.md` (store pattern with fake and parity tests, transactions and row locks, Istoric lines, copy modules), `docs/HANDOFF.md`, `.superpowers/phase3-shared/agent-rules.md`.

**Base:** `feat/athletes` (6a3b002 or later). The plan file lives on `docs/portal-redesign-plan`. Each task runs in its own worktree from `feat/athletes`; the controller merges. Ledger `p3be/.superpowers/sdd/2026-11-09-coach-additions/progress.md`.

| Task | Risk | Model | Batch |
|---|---|---|---|
| 1 Dated move and remove in the group service | high (data loss, history) | Sonnet | A |
| 2 Coach move and remove routes | high (permissions) | Sonnet | A |
| 3 Coach calendar month and class location | low | Sonnet | |
| 4 Group list next date, other groups, group location, member leave date | low | Haiku | |
| 5 Athlete detail additions | high (data exposure) | Sonnet | A |
| 6 Istoric with not-done classes | low | Sonnet | |
| 7 Coach competitions with the null source | high (data exposure) | Sonnet | B |
| 8 Real competition source, one source per athlete (coach) | high (outbound calls, data exposure) | Sonnet | C |
| 9 Matrix, boot check, click-through | high (permissions) | Sonnet | B |
| 10 Sportiv competitions on the same source rule, boot check | high (data exposure) | Sonnet | C |

Model tags: Haiku where the plan carries the shape and the work is mechanical, Sonnet for integration judgment. High risk tasks get a review per batch; the rest only the plan's final review.

Order: Tasks 1 to 7 and 9 need only `feat/athletes`; Task 2 needs Task 1; Task 6 needs Task 3 (`ownClassesBetween`); Task 9 needs Tasks 1 to 7. Task 8 then Task 10 run on `feat/roles` (refresh 2026-11-13), one review for batch C after Task 10.

## Global Constraints

- Everything in the phase 6 plans' constraints: answers built field by field in views (no store row spread), `forbiddenKeysIn` on every new answer (`src/club/portal/coach/views.ts`), today is Bucharest's (`c.today`), current season through `currentSeason`, Istoric lines with actor `Antrenor <nume>` (`coachActor`), writes inside `store.transaction` with the row locks the group service already takes.
- Permissions: a coach writes only on own groups (`groupAccess(...) === 'own'`); a move needs both the source and the target group own and active (user 2026-11-09). Competitions: every coach sees all club athletes (`scope=all`), `scope=mine` filters (user 2026-11-09). Contacts stay visible only for own children (ruling 21). Stand-in reads keep the phase 6 rules (`cardRight`).
- Dates: `from` is `YYYY-MM-DD`, not before today and not after the current season's end (`seasonBounds(season).end`); anything else 400 `"Cerere invalidă."`.
- Copy: refusals reuse `PORTAL_ERRORS` and `GROUP_ERRORS` texts exactly; the only success toast is `PORTAL_TOASTS.saved` ("Salvat."). Romanian, straight quotes, no em or en dash, no middle dot.
- Competitions: no other skater's name, id or score leaves Strapi; only athletes of the club matched through `athlete.publicProfile.skateResultsSlug` (phase 7-3 rule), or for an athlete without a slug the hand-entered Strapi `competitions` that name the athlete's profile (user 2026-11-13; one source per athlete, never merged); names come from Strapi, not from skate-results.
- Boot check: Postgres container `es-cr-pg` on 127.0.0.1:55469, Strapi 1389. Never 5432, 55442, 1337, 1340, 3010, `strapi_app`, `strapi_db`, `edusport-test-pg`. Fixtures `scripts/fixtures/phase4-shape.js`, `phase5-shape.js`, `phase6-shape.js`; env `PORTAL_BFF_SECRET=test-bff-secret-000000000000000000`, `PORTAL_HOSTS=antrenor`, `JWT_SECRET` any, Brevo unset, `SKATE_RESULTS_API=http://127.0.0.1:9`.
- Files this plan may touch: `src/club/portal/coach/**`, `src/club/groups/members.ts` (two exports), `src/club/presence/attendance/day.ts` (one export, Task 3, only if needed), `src/api/portal/routes/02-coach.ts`, `src/api/portal/controllers/coach.ts`, `scripts/fixtures/coach-additions.js`, `scripts/clickthrough-coach-additions.sh`; Task 8 also `src/club/skate/{hand,hand-store,pick,wiring,coach-source,derive,source}.ts`; Task 10 also `src/club/skate/source.ts`, `src/club/portal/sportiv/{competitions,competitions-read,athletes,context}.ts`, `scripts/fixtures/competition-source.js`, `scripts/clickthrough-competition-source.sh`.
- The frontend copies the types of `src/club/portal/coach/api-types.ts` verbatim into `src/lib/portal/api-types.ts` (plan B Task 1); every type change here is listed in the HTTP contracts below and nowhere else.

## Review Focus

- **A future-dated move**: Ana moves from Intermediari Bronze to Intermediari Silver from 2026-11-12, today 2026-11-09. Until 11 November she is on the Bronze roster and Bronze presence; from 12 November on Silver. Her Bronze row ends 2026-11-11 (not deleted), the Silver row starts 2026-11-12. Pinned by Task 1.
- **A move from today on a row that started today** (added by mistake this morning): the row is deleted, not ended, as W4 says. Pinned by Task 1.
- **The main group leaves**: the main flag travels with the moved row (W2) or passes to the earliest remaining row on remove (W4), with the "main group changed" line. Pinned by Task 1.
- **A coach targets another coach's group** (user 2026-11-09: Mută only into own groups): move to it or remove from it answers 403 `"Nu mai ai acces la această grupă."` and writes nothing. Pinned by Task 2 and the matrix (Task 9).
- **Contact on a stand-in read**: the athlete detail of a child the coach only saw as a stand-in has `contact: null` and no abonament code; presence numbers only. Pinned by Task 5.
- **skate-results down**: competitions answer `{ available: false }` within the 7-3 timeout; Azi, Grupe and the athlete page still answer. Pinned by Task 7 (null source) and Task 8.
- **An athlete with a slug and hand-entered competitions too**: only the skate-results rows show, never both (no double count). Pinned by Task 8 (`slug wins`) and Task 10.

## HTTP contracts (binding for plan B)

Shape as phase 6: success `200 { data: T }`; refusal `{ data: null, error: { status, name: 'ClubAdminError', message } }` with the message to show; policy refusals as phase 6.

New routes in `02-coach.ts` (fixed paths before parameter paths):

| Method and path | Body or query | Answer | Refusals |
|---|---|---|---|
| `GET /portal/coach/calendar` | `month=YYYY-MM` | `CoachCalendar` | 400 invalid month |
| `POST /portal/coach/groups/:documentId/members/:athleteId/move` | `{ toGroupId: string; from: string }` | `CoachMemberChange` | 403 noAccess (source or target not own), 400 `"Alege grupa."` (missing, same or inactive target), 400 invalid date, 409 `GROUP_ERRORS.stale` (no current membership) |
| `POST /portal/coach/groups/:documentId/members/:athleteId/remove` | `{ from: string }` | `CoachMemberChange` | 403 noAccess, 400 invalid date, 409 stale |
| `GET /portal/coach/competitions` | `scope=all\|mine`, `season=YYYY-YYYY` (optional) | `CoachCompetitions` | 400 invalid scope or season |

Type changes in `src/club/portal/coach/api-types.ts`:

```ts
export type NextClass = { date: string; startTime: string };
// changed
export type CoachClassRow = { /* existing fields */ location: string | null };
export type CoachGroupRow = { /* existing fields */ next: NextClass | null };
export type OtherGroupRow = { groupId: string; name: string; coaches: string[]; program: string[]; children: number; next: NextClass | null };
export type CoachGroupPage = { /* existing fields */ location: string | null };
/** `leavesOn`: the date a scheduled move or removal takes effect (the membership's `to` + 1 day), null when none; the member is listed until `to` (user 2026-11-09). */
export type CoachMember = { /* existing fields */ leavesOn: string | null };
export type CoachHistoryRow = { /* existing fields */ done: boolean; occurrenceKey: string | null };
export type CoachAthleteCard = {
  /* existing fields: athleteId, name, age, groups, school, contact */
  sectionName: string | null;                                   // section of the main group today, e.g. "Școala de patinaj"
  groupRows: { groupId: string; name: string; program: string[] }[]; // current groups, main first
  presence: { season: number; lessons: number; last: string | null; missedThisMonth: number };
  abonament: { code: string | null; next: number; slots: number; validUntil: string; location: string | null } | null; // own children only
  competitions: CoachAthleteCompetitions;
};
// new
export type CoachCalendarItem = {
  kind: 'grup' | 'individual'; cancelled: boolean; date: string; startTime: string; durationMin: number | null; title: string;
  children: number | null; location: string | null; done: boolean; standIn: boolean;
  sessionId: string | null; occurrenceKey: string | null; lessonId: string | null;
};
export type CoachCalendar = { month: string; today: string; days: { date: string; items: CoachCalendarItem[] }[] };
export type CoachMemberChange = { athleteName: string; groupName: string; from: string; toast: string };
export type CoachCompetitionMember = { athleteId: string; name: string; category: string; placement: number | null; total: number | null };
export type CoachCompetitionEvent = { eventId: string; name: string; date: string | null; location: string | null; members: CoachCompetitionMember[] };
export type CoachCompetitions =
  | { available: false }
  | { available: true; stale: boolean; seasons: string[]; season: string; events: CoachCompetitionEvent[] };
export type CoachAthleteCompetitions =
  | { available: false }
  | { available: true; category: string | null; season: string; count: number; podiums: number;
      recent: { eventName: string; date: string | null; location: string | null; placement: number | null; total: number | null }[] };
```

Meaning: `presence.season` = group presences (grup or uscat ticked) plus present lessons in the current season; `presence.lessons` = present lessons in the season; `presence.last` = the date of the latest of those; `presence.missedThisMonth` = saved sessions of the child's current groups this month, date on or before today, where the child was on the roster and not ticked. `abonament.next` and `slots` as the sportiv app's `AbonamentShort` (Ședința `next`/`slots`). `competitions` for a child without a skate slug: `{ available: true, category: null, season, count: 0, podiums: 0, recent: [] }`; the frontend hides the section when `count` is 0. Events are ordered newest first; members by placement (null last), then name. `seasons` newest first; default season = the current one (`YYYY-YYYY` of `currentSeason`).

---

### Task 1: Dated move and remove in the group service (high, Sonnet)

**Files:**
- Modify: `src/club/groups/members.ts` (two exports; the admin functions keep their signature and behaviour)
- Test: `src/club/groups/__tests__/members-dated.test.ts`

**Interfaces:**
- Consumes: `planMove`, `planRemove`, `leaveWrite` (`membership-plan.ts`, already date-parametric through their `today` argument), `locate`, `applyPlan`, `recordAction`, `MoveCarry`.
- Produces:

```ts
/** Move from `effective` on (W2): the old row ends effective - 1 (or is deleted when it starts on or after `effective`), the new row starts `effective`. */
export async function moveMembershipFrom(ctx: GroupContext, membershipId: string, toGroupId: string, effective: string, carry?: MoveCarry): Promise<ActionResult<MoveResult & { carried: number }>>;
/** Remove from `effective` on (W4). */
export async function removeMembershipFrom(ctx: GroupContext, membershipId: string, effective: string): Promise<ActionResult<MoveResult>>;
```

  `moveLocked` and `removeLocked` take an `effective` argument; `moveMembership` passes `ctx.today` and the arrival date `startDateFor(l.season, ctx.today)` exactly as today, the new exports pass `effective` for both the leave and the arrival. History lines are the existing ones; when `effective !== ctx.today` each line's `changes` gains `from: effective`. The carry runs with `today: ctx.today` (it moves the abonament list, independent of the date).

- [ ] **Step 1: Failing tests** (fake group store, phase 4 fixtures): today `2026-11-09`; Ana main in Bronze (row from `2026-09-01`), also in Uscat. `moveMembershipFrom(ctx, bronzeRow, silver, '2026-11-12')` -> Bronze row `to: '2026-11-11'`, new Silver row `from: '2026-11-12'`, `isMain: true`, Uscat untouched; lines `memberMovedOut` (Bronze), `memberMovedIn` (Silver), `athleteMoved`, each `changes.from === '2026-11-12'`; `rosterOn(..., 'Bronze', '2026-11-11')` contains Ana, `rosterOn(..., 'Bronze', '2026-11-12')` does not, Silver the reverse. A row with `from: '2026-11-09'` moved from `'2026-11-09'` is deleted. `removeMembershipFrom(ctx, bronzeRow, '2026-11-20')` -> Bronze `to: '2026-11-19'`, Uscat becomes main, a `mainGroupChanged` line. The admin `moveMembership` and `removeMembership` give exactly the writes they gave before (existing tests in `src/club/groups/__tests__/` stay green unchanged). A second dated move on a row that already has a `to` -> 409 `GROUP_ERRORS.stale`.
- [ ] **Step 2: Run** `npx vitest run src/club/groups/__tests__/members-dated.test.ts src/club/groups/__tests__`. Expected: FAIL on the new file only.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/groups && git commit -m "feat(groups): move and remove a membership from a chosen date"`

### Task 2: Coach move and remove routes (high, Sonnet)

**Files:**
- Create: `src/club/portal/coach/members.ts`
- Modify: `src/club/portal/coach/api-types.ts` (`CoachMemberChange`), `src/api/portal/routes/02-coach.ts`, `src/api/portal/controllers/coach.ts`
- Test: `src/club/portal/coach/__tests__/members.test.ts`

**Interfaces:**
- Produces:

```ts
export function readChangeBody(body: unknown, today: string, seasonEnd: string, move: boolean): { toGroupId: string | null; from: string } | null;
export async function moveMember(c: CoachContexts, groupId: string, athleteId: string, body: unknown): Promise<CoachResult<CoachMemberChange>>;
export async function removeMember(c: CoachContexts, groupId: string, athleteId: string, body: unknown): Promise<CoachResult<CoachMemberChange>>;
```

  Order of checks: source access (`groupAccess` own, else 403 `PORTAL_ERRORS.noAccess`), body (400 `PORTAL_ERRORS.invalid`), target for a move (missing, same as source or inactive -> 400 `GROUP_ERRORS.pickGroup` "Alege grupa."; not own -> 403 noAccess), then the current-season membership of `athleteId` in `groupId` with no `to` (none -> 409 `GROUP_ERRORS.stale`), then `moveMembershipFrom` with `presenceCarry(c.presence.store).carry` or `removeMembershipFrom` on `c.groups` (actor `Antrenor <nume>`). Answer `{ athleteName, groupName, from, toast: PORTAL_TOASTS.saved }` (`groupName` = target for a move, source for a remove). Routes: `route('POST', '/groups/:documentId/members/:athleteId/move', 'moveMember')`, `route('POST', '/groups/:documentId/members/:athleteId/remove', 'removeMember')`, placed after `/groups/:documentId/members`.

- [ ] **Step 1: Failing tests** (coach seed `coach-seed.ts`, coach `tm-andreea` owns `g-club-a`, `g-scoala-a`): move `a-club-1` from `g-club-a` to `g-scoala-a` from today -> 200, toast "Salvat.", history actor "Antrenor Andreea Pascu"; to `g-club-b` (Virgil's) -> 403 "Nu mai ai acces la această grupă.", no write (store write count unchanged); from `g-club-b` -> 403; to `g-old` (inactive) -> 400 "Alege grupa."; to the same group -> 400 "Alege grupa."; `from` yesterday, `from` after the season end, `from: '12.11.2026'` -> 400 "Cerere invalidă."; `a-free` (no membership) -> 409; remove `a-scoala-2` from `g-scoala-a` from `2026-11-20` -> 200 and the row ends `2026-11-19`; the answer keys are exactly `athleteName, groupName, from, toast` (`forbiddenKeysIn` empty).
- [ ] **Step 2: Run** `npx vitest run src/club/portal/coach/__tests__/members.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the module, routes and controller handlers (copy the shape of `addMembers` in the controller).
- [ ] **Step 4: Run** the same command and `npx vitest run src/club/portal/coach/__tests__/coach-routes.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/coach src/api/portal && git commit -m "feat(portal): coach moves or removes a child from a date"`

### Task 3: Coach calendar month and class location (low, Sonnet)

**Files:**
- Create: `src/club/portal/coach/calendar.ts`
- Modify: `src/club/portal/coach/{api-types,today}.ts`, routes and controller; `src/club/presence/attendance/day.ts` only if cancelled dates are not reachable (see Step 3)
- Test: `src/club/portal/coach/__tests__/calendar.test.ts`, `today.test.ts` (extend)

**Interfaces:**
- Produces:

```ts
/** Own groups' classes (scheduled and cancelled) between two dates, plus saved stand-in sessions that list the coach. */
export async function ownClassesBetween(c: CoachContexts, from: string, to: string): Promise<CoachCalendarItem[]>;
export async function readCoachCalendar(c: CoachContexts, month: unknown): Promise<AdminResult<CoachCalendar>>;
export async function locationOfGroup(c: CoachContexts, group: GroupRecord): Promise<string | null>; // the section's location name, as 7-2 `levelOf` reads it
```

  Rows come from `rowsWithCoachIds(store, ctx, from, to)` (`day.ts`, gives `durationMin`) for own groups; `done` = `state === 'salvata'`; `children` = `listed`; lessons of the coach in the range (`store.lessons({ from, to })`, coach in `coachIds`) as `kind: 'individual'`, `title` = athlete name, `done` = `present !== null`, `children: null`. Days without items are left out; items in a day by start time, then the group's order. `CoachClassRow.location` is filled in `today.ts` through `locationOfGroup`. Route `route('GET', '/calendar', 'calendar')`.

- [ ] **Step 1: Failing tests:** `readCoachCalendar(c, '2026-11')` for `tm-andreea`: every weekly class of `g-club-a` and `g-scoala-a` in November appears on its date with `startTime`, `durationMin`, `location`; a cancelled date (an exception in the seed event) appears with `cancelled: true`; a saved session of `g-club-b` listing Andreea appears with `standIn: true`; Virgil's unsaved classes do not appear; a lesson appears as `individual` with the athlete name; `month: '2026-13'` -> 400 "Cerere invalidă."; `readToday` rows carry `location`.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/coach/__tests__/calendar.test.ts src/club/portal/coach/__tests__/today.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Read `day.ts` lines 29 to 80 first. If cancelled occurrences are dropped before `rowsWithCoachIds` returns, add one export `cancelledBetween(store, ctx, from, to, groupIds)` next to it built from the same occurrence expansion, and note it in the ledger.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club && git add src/api/portal && git commit -m "feat(portal): coach month calendar and class location"`

### Task 4: Group list next date, other groups, group location, member leave date (low, Haiku)

**Files:**
- Modify: `src/club/portal/coach/{api-types,groups}.ts`
- Test: `src/club/portal/coach/__tests__/groups.test.ts` (extend)

**Interfaces:**
- Consumes: `ownClassesBetween` is not needed; `next` is the first scheduled, not cancelled occurrence of the group from now on (date today with a start time later than now counts; read the occurrence expansion used by `groupListRow`), searched up to 60 days ahead, else null.
- Produces: `CoachMember.leavesOn` on `CoachGroupPage.members`: the member list keeps a current-season membership of the group while `to` is null or on or after today (as `ownAthlete` already counts it) and sets `leavesOn` to `to` + 1 day when `to` is set, else null (user 2026-11-09: the row shows "până pe <d mmm>"). `CoachGroupRow.next`, `OtherGroupRow.program`, `OtherGroupRow.children` (count only, no names), `OtherGroupRow.next`, `CoachGroupPage.location` (through `locationOfGroup` of Task 3; if Task 3 is not merged yet, implement `locationOfGroup` here and Task 3 reuses it).

- [ ] **Step 1: Failing tests:** on Tuesday `2026-11-10` at 12:00 a group with classes Tue and Thu 17:30 -> `next: { date: '2026-11-10', startTime: '17:30' }`; at 18:00 the same day -> `'2026-11-12'`; a group with no class in 60 days -> `null`; `others[0]` has `program`, `children`, `next` and no member names anywhere in the answer; `readCoachGroupPage` has `location` equal to the section's location name, `null` without one; after `removeMembershipFrom(..., '2026-11-20')` on today `2026-11-09` the child is still in `members` with `leavesOn: '2026-11-20'`, on `2026-11-20` it is gone; a child without a scheduled change has `leavesOn: null`.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/coach/__tests__/groups.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/coach && git commit -m "feat(portal): next class date, location and leave date on coach groups"`

### Task 5: Athlete detail additions (high, Sonnet)

**Files:**
- Modify: `src/club/portal/coach/{api-types,athletes,views}.ts`
- Test: `src/club/portal/coach/__tests__/athletes.test.ts` (extend)

**Interfaces:**
- Consumes: `cardRight`, `ownAthlete`, `abonamentSlots` (as `schoolText` uses it), `rosterOn`, `presentCounts`, the competition source of Task 7 (until Task 7 is merged, `competitions: { available: false }`).
- Produces: `readCard` returns the extended `CoachAthleteCard`. `abonament` and `contact` only when `right.contact` (own child); `presence`, `groupRows`, `sectionName`, `competitions` for any read right. `abonament.code` is the phase 11 code (`A-0124` shape) or null; `location` the abonament group's section location.

- [ ] **Step 1: Failing tests:** own child `a-scoala-1` with 3 ticked sessions, 1 present lesson and 1 saved session this month where unticked -> `presence: { season: 4, lessons: 1, last: <latest date>, missedThisMonth: 1 }`, `abonament.next` and `slots` from the seed abonament, `groupRows[0].name === 'Școala A'`, `sectionName` the seed section name; a stand-in child (listed session only) -> `contact: null`, `abonament: null`, `presence` present; `forbiddenKeysIn(answer)` empty (no `notes`, `phone` outside `contact`, `email`, `birthDate`, price); an anonymized child -> 404.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/coach/__tests__/athletes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/coach && git commit -m "feat(portal): presence, abonament and groups on the coach athlete page"`

### Task 6: Istoric with not-done classes (low, Sonnet)

**Files:**
- Modify: `src/club/portal/coach/{api-types,history}.ts`
- Test: `src/club/portal/coach/__tests__/history.test.ts` (extend)

**Interfaces:**
- Consumes: `ownClassesBetween` (Task 3).
- Produces: every existing row gains `done: true` and its `occurrenceKey` (null for lessons); own groups' scheduled, not cancelled classes of the month, dated on or before today, without a saved session, are added as `{ kind: 'grup', done: false, present: null, durationMin, sessionId: null, occurrenceKey, lessonId: null }`. Totals (`sessions`, `lessons`, `hours`) unchanged (they count saved work only).

- [ ] **Step 1: Failing tests:** November with one unsaved past class of `g-club-a` -> one row `done: false` with its `occurrenceKey`; a future class of the month is not listed; a cancelled one is not listed; `sessions` is the same number as before the change.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/coach/__tests__/history.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/coach && git commit -m "feat(portal): not-done classes in the coach Istoric"`

### Task 7: Coach competitions with the null source (high, Sonnet)

**Files:**
- Create: `src/club/portal/coach/competitions.ts`
- Modify: `src/club/portal/coach/{api-types,context,athletes}.ts`, routes and controller
- Test: `src/club/portal/coach/__tests__/competitions.test.ts`

**Interfaces:**
- Produces:

```ts
export type SkaterRef = { athleteId: string; name: string; slug: string };
export interface CoachCompetitionSource {
  club(skaters: SkaterRef[], season: string | null): Promise<Omit<Extract<CoachCompetitions, { available: true }>, 'available'> | null>;
  athlete(skater: SkaterRef, season: string): Promise<Omit<Extract<CoachAthleteCompetitions, { available: true }>, 'available'> | null>;
}
export const nullCoachCompetitions: CoachCompetitionSource; // both methods resolve null
export async function readCoachCompetitions(c: CoachContexts, q: Record<string, unknown>): Promise<AdminResult<CoachCompetitions>>;
```

  `CoachContexts` gains `competitions: CoachCompetitionSource` (`coachContexts` wires `nullCoachCompetitions`). `scope=all`: every active athlete of the current season with a skate slug; `scope=mine`: those currently in own groups. A `null` from the source -> `{ available: false }`. Route `route('GET', '/competitions', 'competitions')`. `readCard` (Task 5) fills `competitions` through `source.athlete` (no slug -> available with zeros, null -> `{ available: false }`).

- [ ] **Step 1: Failing tests:** with the null source -> `{ available: false }` for both scopes and for the card; with a fake source returning two events -> the answer passes them through with members filtered to the requested scope (a member not in the scope list is dropped even when the fake returns it), events newest first, members by placement; `scope=x` -> 400; `season=2026` -> 400; the fake receives only slugs of club athletes and never a name search.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/coach/__tests__/competitions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command and `npx vitest run src/club/portal/coach/__tests__/athletes.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/coach src/api/portal && git commit -m "feat(portal): coach competitions list behind a competition source"`

### Task 8: Real competition source, one source per athlete (high, Sonnet; refreshed 2026-11-13)

Source rule (user 2026-11-13, as the public site): an athlete's competitions come from exactly one source. With a `skateResultsSlug` on the athlete's profile: skate-results through the 7-3 client and snapshot cache. Without one: the Strapi `api::competition.competition` entries (hand-entered on the admin Competiții page) whose `participantData` has a row with `documentId` equal to the profile id. Never both. An athlete without a profile has no competitions.

**Files:**
- Create: `src/club/skate/hand.ts` (pure mapping), `src/club/skate/hand-store.ts` (port, Strapi and fake), `src/club/skate/pick.ts` (the source rule), `src/club/skate/wiring.ts` (Strapi wiring shared by both portals), `src/club/skate/coach-source.ts`
- Modify: `src/club/skate/derive.ts` (move `currentSeason` out of `source.ts` as `seasonOfToday`), `src/club/skate/source.ts` (use `seasonOfToday`; nothing else in this task), `src/club/portal/coach/competitions.ts` (`SkaterRef`, `clubSkaters`, `skaterOf`), `src/club/portal/coach/context.ts` (wire the real source)
- Test: `src/club/skate/__tests__/hand.test.ts`, `pick.test.ts`, `coach-source.test.ts`; update `src/club/portal/coach/__tests__/competitions.test.ts` and `athletes.test.ts` where they rely on "no slug -> zeros"

**Interfaces:**
- Consumes: `skateClient`, `SkateClient`, `SkateResult`, `Fetched` (`client.ts`); `snapshotCache`, `resultsOf`, `Cached` (`cache.ts`); `strapiSnapshotStore`; `fakeSnapshotStore` (`fake-store.ts`); `seasonKey`, `currentCategory`, `records` (`derive.ts`); `CoachCompetitionSource`, `clubSkaters`, `skaterOf`, `athleteCompetitions`, `readCoachCompetitions` (`coach/competitions.ts`).
- Produces:

```ts
// coach/competitions.ts (changed): the profile id joins, the slug may be absent
export type SkaterRef = { athleteId: string; name: string; profileId: string; slug: string | null };
// clubSkaters: every athlete in scope that has a profile (slug or not); skaterOf: a ref when the athlete has a profile, else null.

// derive.ts
export function seasonOfToday(now: Date): string; // seasonKey of today's Bucharest date, e.g. '2026-2027' on 2026-11-13

// hand.ts
export type HandEntry = { id: number; name: string; date: string | null; location: string | null; participantData: unknown };
export function handResults(entries: HandEntry[], profileId: string): SkateResult[];

// hand-store.ts
export interface HandCompetitionStore { byProfiles(profileIds: string[]): Promise<Map<string, SkateResult[]>> } // every asked id present, [] when none
export function strapiHandCompetitions(strapi: Core.Strapi): HandCompetitionStore;
export function fakeHandCompetitions(entries: HandEntry[]): HandCompetitionStore & { calls: string[][] };

// pick.ts
export type CompetitionResults = {
  one(ref: SkaterRef): Promise<Cached<SkateResult[]>>;
  many(refs: SkaterRef[]): Promise<Map<string, Cached<SkateResult[]>>>; // keyed by athleteId
};
export function pickedResults(cache: ReturnType<typeof snapshotCache>, client: SkateClient, hand: HandCompetitionStore, now: () => Date): CompetitionResults;

// wiring.ts
export function strapiCompetitions(strapi: Core.Strapi, now: () => Date): { cache: ReturnType<typeof snapshotCache>; client: SkateClient; results: CompetitionResults };

// coach-source.ts
export function skateCoachSource(results: CompetitionResults, now: () => Date): CoachCompetitionSource;
```

Rules the signatures leave open:
- `handResults`: one `SkateResult` per `participantData` row of that profile (non-object rows skipped): `result_id = id * 100 + i` (i = the row's index among that profile's rows; stable, numeric, and unique per athlete), `event_id = id`, `event_slug: null`, `event_name`, `event_date`, `event_location` from the entry, `category` the row's string or `''`, `placement` and `total_score` (from `score`) a finite number or null, `short_score` / `free_score` null, `segments: []`.
- `strapiHandCompetitions`: one `strapi.db.query('api::competition.competition').findMany` with `where: { sportspeople: { documentId: { $in: ids } } }`, select `id`, `name`, `date`, `location`, `participantData` (the type has no draft and publish); no query for an empty list.
- `pickedResults`: a ref with a slug -> `resultsOf(cache, client, slug)` and the hand store is not asked; without a slug -> `{ available: true, value: <hand rows>, stale: false, updatedAt: now().toISOString() }` and the client is not called. `many` makes one hand store call for all slug-less refs and runs the skate reads in parallel (the cache already dedupes per key).
- `skateCoachSource.club(skaters, season)`: `season ?? seasonOfToday(now())`. When any slug skater's read is `{ available: false }` (skate-results down, cold) the answer is `null` (the existing coach unavailable state). Otherwise `stale` is true when any read is stale; `seasons` = every season (`seasonKey`) of any row with a `result_id`, newest first; events of the chosen season grouped by `eventId` = `s-<event_id>` for skate rows and `h-<event_id>` for hand rows (so ids from the two sources never meet), name, date and location from the first row; one member per athlete per event, the row with the best placement (null last). `readCoachCompetitions` keeps its own filtering, names from Strapi and ordering.
- `skateCoachSource.athlete(skater, season)`: unavailable -> `null`; missing (skate 404) -> `{ category: null, season, count: 0, podiums: 0, recent: [] }`; otherwise over the season's rows with a `result_id`: `category` = `currentCategory(rows, season)?.current` or null when empty; `count` = distinct `event_id`; `podiums` = `records(seasonRows).podiums`; `recent` = the 3 newest rows (the frontend shows 3) as `{ eventName, date, location, placement, total }`.
- `coachContexts` sets `competitions: skateCoachSource(strapiCompetitions(strapi, now).results, now)`. `nullCoachCompetitions` stays for tests.

- [ ] **Step 1: Failing tests**:
  - `hand.test.ts`: entry `{ id: 12, name: 'Cupa Reșiței', date: '2026-10-20', location: 'Reșița', participantData: [{ documentId: 'p1', category: 'Juniori', placement: 2, score: 80.5 }, { documentId: 'p2', category: 'Novice', placement: 1 }, { documentId: 'p1', category: 'Duet' }, 'x'] }` -> for `p1` two rows with `result_id` 1200 and 1201, `event_id` 12, categories `'Juniori'` and `'Duet'`, placements 2 and null, totals 80.5 and null, `segments` `[]`; for `p3` `[]`; `participantData: null` -> `[]`.
  - `pick.test.ts`: `slug wins`: a ref with slug `ioana-marin-test` whose profile also has a hand entry -> `one` answers the fake client's rows only and `fakeHandCompetitions(...).calls` is empty; `no slug, hand entries`: `one` answers the hand rows with `stale: false` and the fake client records no call; `no slug, none`: value `[]`; `many` over two slug-less refs and one slug ref -> exactly one hand call with both profile ids.
  - `coach-source.test.ts` (fake client as in `source.test.ts`, `snapshotCache(fakeSnapshotStore(), () => NOW, () => undefined)`, NOW 2026-11-13): two slug skaters at skate event 501 -> one event `s-501` with two members; one skater with two categories at event 501 -> one member with the better placement; a hand-only athlete -> event `h-12`; a skate event 12 and a hand entry 12 stay two events; every slug read cold and down -> `club` resolves `null`, also when a hand athlete is in the list; one slug skater warm with a failed refresh and one hand athlete -> `stale: true` with both events; `season: null` -> `season: '2026-2027'`; `seasons` newest first; `athlete`: two podiums of three results this season -> `count: 3, podiums: 2`, `recent` length 3 newest first; a hand row with category `''` -> `category: null`; a skate 404 slug -> zeros; every URL the fake fetch saw contains a slug and no athlete name.
  - `competitions.test.ts` / `athletes.test.ts`: `clubSkaters` includes a profile without slug with `slug: null`; `skaterOf` of an athlete without profile is null and the card answers zeros.
- [ ] **Step 2: Run** `npx vitest run --maxWorkers=3 src/club/skate src/club/portal/coach`. Expected: FAIL.
- [ ] **Step 3: Implement** the Interfaces above.
- [ ] **Step 4: Run** the whole suite and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/skate src/club/portal/coach && git commit -m "feat(portal): coach competitions from skate-results or hand-entered, one source per athlete"`

### Task 9: Matrix, boot check, click-through (high, Sonnet)

**Files:**
- Modify: `src/club/portal/coach/__tests__/matrix.test.ts` (new routes), `src/club/portal/coach/__tests__/coach-routes.test.ts`
- Create: `scripts/fixtures/coach-additions.js` (synthetic: the phase 6 coach `antrenor1@example.invalid` owns "Intermediari Bronze" and "Intermediari Silver", child "Ana Popescu" main in Bronze; another coach owns "Performanță"), `scripts/clickthrough-coach-additions.sh`

- [ ] **Step 1: Failing matrix rows:** every new route without a session -> 401; with a session of a disabled account -> 403 (policy); `move` and `remove` on another coach's group -> 403 `ClubAdminError` "Nu mai ai acces la această grupă."; `GET /calendar` and `/competitions` with a stand-in coach show no other group's unsaved classes and no contact field.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/coach/__tests__/matrix.test.ts src/club/portal/coach/__tests__/coach-routes.test.ts`. Expected: FAIL, then implement the missing route config until PASS.
- [ ] **Step 3: Boot check** on `es-cr-pg` (55469) and Strapi 1389 with the fixtures listed in Global Constraints plus `coach-additions.js`; restart Strapi once; run the click-through: login as `antrenor1@example.invalid` (`Throwaway-Coach-1`) through the BFF secret, `GET /calendar?month=<this month>` 200, move Ana to Silver from tomorrow 200, the Bronze group page still lists her today with `leavesOn` = tomorrow, `GET /history` 200 with a `done` field on every row, `GET /competitions?scope=mine` 200 `{ available: false }` (closed skate port). Remove the container.
- [ ] **Step 4: Commit** `git add src/club/portal/coach scripts && git commit -m "test(portal): coach additions matrix and boot check"`

### Task 10: Sportiv competitions on the same source rule, boot check (high, Sonnet; added 2026-11-13)

The sportiv portal (phase 7-3, merged) reads only skate-results and treats an athlete without a slug as having no competitions. It moves onto Task 8's `CompetitionResults`, so both portals follow the one-source rule. Answer shapes (`SportivCompetitions`, `SportivCompetition`, `LastCompetition`, the path badge count, `performance` in the athlete list) do not change.

**Files:**
- Modify: `src/club/skate/source.ts`, `src/club/portal/sportiv/context.ts` (wire through `strapiCompetitions`), `src/club/portal/sportiv/competitions.ts` (`skaterOf`), `src/club/portal/sportiv/competitions-read.ts` (404 only without a profile), `src/club/portal/sportiv/athletes.ts` (`performance`)
- Create: `scripts/fixtures/competition-source.js`, `scripts/clickthrough-competition-source.sh` (pattern of `scripts/clickthrough-7-3.sh`, with `scripts/fake-skate.mjs`)
- Test: `src/club/skate/__tests__/source.test.ts`, `src/club/portal/sportiv/__tests__/competitions.test.ts`, `src/club/portal/sportiv/__tests__/athletes.test.ts`

**Interfaces:**
- Consumes: `CompetitionResults`, `pickedResults`, `strapiCompetitions`, `fakeHandCompetitions`, `SkaterRef` with `profileId` and `slug: string | null`, `seasonOfToday` (Task 8).
- Produces: `skateSportivSource(cache: Cache, client: SkateClient, results: CompetitionResults, now?: () => Date, log?: (message: string) => void, homeBudgetMs?: number): SportivCompetitionSource & SportivCompetitionViews` (new third parameter; every results read goes through `results.one(skater)`).
- Rules for a slug-less ref (hand rows): `last` with no field size read (`field: null`); `count` and `list` as today over the hand rows with `stale: false`; `detail` finds the row by `resultId` among the athlete's own hand rows and answers `segments: []`, `field: null`, `officialUrl: null` (the competition type has no link field), `best` from `records`; no protocol, field size or official-URL read and no client call. The "slug not found" log stays for slug refs only.
- `skaterOf` (sportiv) returns a ref when the athlete has a profile and is not anonymized; `readCompetitions` and `readCompetition` answer 404 only when it is null.
- `performance` in the athlete list: true when the athlete has a slug, or has no slug and at least one hand row (one `results.many` call for the listed athletes). Decided by Claude (low impact): it keeps the Concursuri entry hidden for athletes with nothing to show.

- [ ] **Step 1: Failing tests**:
  - `source.test.ts` `slug athlete -> skate-results only`: Ioana's ref (slug `ioana-marin-test`) with a hand entry "Cupa Dublă" for her profile -> `list` total equals the fake client's result count, no row named "Cupa Dublă", and the hand store saw no call.
  - `no-slug athlete with hand-entered competitions -> those only`: ref `{ slug: null, profileId: 'p-matei' }` with two hand entries -> `list` `{ available: true, stale: false, total: 2 }` and rows newest first with `categoryShort` from `shortCategory`; `detail('1200')` -> `segments: []`, `field: null`, `officialUrl: null`; `last` -> the newer row with `field: null`; `count` -> `{ count: 2, dates: [<older>, <newer>] }`; the fake fetch saw no call.
  - `no-slug and none -> empty`: `list` -> `{ available: true, total: 0, rows: [] }`; `last` -> `'none'` (Acasă `lastCompetition: null`, card hidden); `count` -> `{ count: 0, dates: [] }`.
  - `detail` of another athlete's hand `resultId` -> null (404).
  - sportiv reads: an athlete without a profile -> 404 on Concursuri; a slug-less athlete with a profile -> 200; athlete list `performance` false for a slug-less athlete with no hand rows, true with one.
- [ ] **Step 2: Run** `npx vitest run --maxWorkers=3 src/club/skate src/club/portal/sportiv`. Expected: FAIL.
- [ ] **Step 3: Implement** the Interfaces above.
- [ ] **Step 4: Run** the whole suite and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Boot check and click-through.** Fixture `competition-source.js` on top of `phase4-shape.js` to `phase7-shape.js` and `coach-additions.js` (synthetic only): a profile without slug for "Matei Ionescu" with two hand-entered competitions ("Cupa Reșiței" 2026-10-20, category "Începători", placement 1; "Cupa Timișoarei" 2026-11-08, placement 3), and a hand entry "Cupa Dublă" whose `participantData` names Ioana Marin's profile (slugged). Throwaway Postgres `es-cs-pg` 127.0.0.1:55487, Strapi 1419, `SKATE_RESULTS_API=http://127.0.0.1:18895`, fake skate-results on 18895, env as Global Constraints; check each port is free first; restart Strapi once. The script prints PASS or FAIL per step:
  1. `parinte1` Concursuri for Matei -> 200, `total: 2`; detail of one row -> 200 with `segments: []`; Acasă `lastCompetition.row.eventName` "Cupa Timișoarei".
  2. Concursuri for Ioana -> the fake's rows only, no "Cupa Dublă".
  3. Sara (slug, no results) Acasă -> `lastCompetition: null`.
  4. `antrenor1` `GET /portal/coach/competitions?scope=all` -> 200 `available: true` with `h-` events for Matei and `s-` events for Ioana, and no event named "Cupa Dublă".
  5. Fake skate-results stopped and `skate_snapshots` emptied -> coach competitions `{ available: false }`; Matei's sportiv Concursuri still 200 with `total: 2`.
  Remove the container and its volume.
- [ ] **Step 6: Commit** `git add src/club/skate src/club/portal/sportiv scripts && git commit -m "feat(portal): sportiv competitions follow the one-source rule"`
