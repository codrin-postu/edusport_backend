# Coach Portal Additions for the Canvas Screens Implementation Plan

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
| 8 Real competition source (after 7-3 Task 5 is merged) | high (outbound calls, data exposure) | Sonnet | B |
| 9 Matrix, boot check, click-through | high (permissions) | Sonnet | B |

Model tags: Haiku where the plan carries the shape and the work is mechanical, Sonnet for integration judgment. High risk tasks get a review per batch; the rest only the plan's final review.

Order: Tasks 1 to 7 and 9 need only `feat/athletes`; Task 2 needs Task 1; Task 6 needs Task 3 (`ownClassesBetween`); Task 9 needs Tasks 1 to 7. Task 8 waits for phase 7-3 Task 5 (`src/club/skate/*`) on `feat/athletes`; until then the null source answers `{ available: false }` and the frontend shows "Rezultatele nu sunt disponibile acum.".

## Global Constraints

- Everything in the phase 6 plans' constraints: answers built field by field in views (no store row spread), `forbiddenKeysIn` on every new answer (`src/club/portal/coach/views.ts`), today is Bucharest's (`c.today`), current season through `currentSeason`, Istoric lines with actor `Antrenor <nume>` (`coachActor`), writes inside `store.transaction` with the row locks the group service already takes.
- Permissions: a coach writes only on own groups (`groupAccess(...) === 'own'`); a move needs both the source and the target group own and active (user 2026-11-09). Competitions: every coach sees all club athletes (`scope=all`), `scope=mine` filters (user 2026-11-09). Contacts stay visible only for own children (ruling 21). Stand-in reads keep the phase 6 rules (`cardRight`).
- Dates: `from` is `YYYY-MM-DD`, not before today and not after the current season's end (`seasonBounds(season).end`); anything else 400 `"Cerere invalidă."`.
- Copy: refusals reuse `PORTAL_ERRORS` and `GROUP_ERRORS` texts exactly; the only success toast is `PORTAL_TOASTS.saved` ("Salvat."). Romanian, straight quotes, no em or en dash, no middle dot.
- Competitions: no other skater's name, id or score leaves Strapi; only athletes of the club matched through `athlete.publicProfile.skateResultsSlug` (phase 7-3 rule); names come from Strapi, not from skate-results.
- Boot check: Postgres container `es-cr-pg` on 127.0.0.1:55469, Strapi 1389. Never 5432, 55442, 1337, 1340, 3010, `strapi_app`, `strapi_db`, `edusport-test-pg`. Fixtures `scripts/fixtures/phase4-shape.js`, `phase5-shape.js`, `phase6-shape.js`; env `PORTAL_BFF_SECRET=test-bff-secret-000000000000000000`, `PORTAL_HOSTS=antrenor`, `JWT_SECRET` any, Brevo unset, `SKATE_RESULTS_API=http://127.0.0.1:9`.
- Files this plan may touch: `src/club/portal/coach/**`, `src/club/groups/members.ts` (two exports), `src/club/presence/attendance/day.ts` (one export, Task 3, only if needed), `src/api/portal/routes/02-coach.ts`, `src/api/portal/controllers/coach.ts`, `scripts/fixtures/coach-additions.js`, `scripts/clickthrough-coach-additions.sh`; Task 8 also `src/club/skate/coach-source.ts`.
- The frontend copies the types of `src/club/portal/coach/api-types.ts` verbatim into `src/lib/portal/api-types.ts` (plan B Task 1); every type change here is listed in the HTTP contracts below and nowhere else.

## Review Focus

- **A future-dated move**: Ana moves from Intermediari Bronze to Intermediari Silver from 2026-11-12, today 2026-11-09. Until 11 November she is on the Bronze roster and Bronze presence; from 12 November on Silver. Her Bronze row ends 2026-11-11 (not deleted), the Silver row starts 2026-11-12. Pinned by Task 1.
- **A move from today on a row that started today** (added by mistake this morning): the row is deleted, not ended, as W4 says. Pinned by Task 1.
- **The main group leaves**: the main flag travels with the moved row (W2) or passes to the earliest remaining row on remove (W4), with the "main group changed" line. Pinned by Task 1.
- **A coach targets another coach's group** (user 2026-11-09: Mută only into own groups): move to it or remove from it answers 403 `"Nu mai ai acces la această grupă."` and writes nothing. Pinned by Task 2 and the matrix (Task 9).
- **Contact on a stand-in read**: the athlete detail of a child the coach only saw as a stand-in has `contact: null` and no abonament code; presence numbers only. Pinned by Task 5.
- **skate-results down**: competitions answer `{ available: false }` within the 7-3 timeout; Azi, Grupe and the athlete page still answer. Pinned by Task 7 (null source) and Task 8.

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

### Task 8: Real competition source (high, Sonnet; after phase 7-3 Task 5 is merged)

**Files:**
- Create: `src/club/skate/coach-source.ts`
- Modify: `src/club/portal/coach/context.ts` (wire the real source)
- Test: `src/club/skate/__tests__/coach-source.test.ts`

**Interfaces:**
- Consumes: the 7-3 client and snapshot cache (`src/club/skate/{client,cache,derive}.ts`), per-skater results by slug (the same call the sportiv competitions list uses), `deriveSeason`, category derivation.
- Produces: `skateCoachSource(strapi, cache, client): CoachCompetitionSource`. `club` groups the skaters' results by event id within the season, one member per skater per event (category, placement, total); `stale` true when any skater's snapshot is stale; `seasons` = seasons that have at least one result of any club skater. Calls go through the cache (one refresh per key at a time); a cold cache with the service down returns null.

- [ ] **Step 1: Failing tests** (fake client from 7-3 Task 6): two skaters at the same event become one event with two members; a skater with no results adds nothing; service down and cold -> null; warm and down -> data with `stale: true`; no outbound call carries a name.
- [ ] **Step 2: Run** `npx vitest run src/club/skate/__tests__/coach-source.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command and the Task 7 tests. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/skate src/club/portal/coach && git commit -m "feat(portal): coach competitions from skate-results"`

### Task 9: Matrix, boot check, click-through (high, Sonnet)

**Files:**
- Modify: `src/club/portal/coach/__tests__/matrix.test.ts` (new routes), `src/club/portal/coach/__tests__/coach-routes.test.ts`
- Create: `scripts/fixtures/coach-additions.js` (synthetic: the phase 6 coach `antrenor1@example.invalid` owns "Intermediari Bronze" and "Intermediari Silver", child "Ana Popescu" main in Bronze; another coach owns "Performanță"), `scripts/clickthrough-coach-additions.sh`

- [ ] **Step 1: Failing matrix rows:** every new route without a session -> 401; with a session of a disabled account -> 403 (policy); `move` and `remove` on another coach's group -> 403 `ClubAdminError` "Nu mai ai acces la această grupă."; `GET /calendar` and `/competitions` with a stand-in coach show no other group's unsaved classes and no contact field.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/coach/__tests__/matrix.test.ts src/club/portal/coach/__tests__/coach-routes.test.ts`. Expected: FAIL, then implement the missing route config until PASS.
- [ ] **Step 3: Boot check** on `es-cr-pg` (55469) and Strapi 1389 with the fixtures listed in Global Constraints plus `coach-additions.js`; restart Strapi once; run the click-through: login as `antrenor1@example.invalid` (`Throwaway-Coach-1`) through the BFF secret, `GET /calendar?month=<this month>` 200, move Ana to Silver from tomorrow 200, the Bronze group page still lists her today with `leavesOn` = tomorrow, `GET /history` 200 with a `done` field on every row, `GET /competitions?scope=mine` 200 `{ available: false }` (closed skate port). Remove the container.
- [ ] **Step 4: Commit** `git add src/club/portal/coach scripts && git commit -m "test(portal): coach additions matrix and boot check"`
