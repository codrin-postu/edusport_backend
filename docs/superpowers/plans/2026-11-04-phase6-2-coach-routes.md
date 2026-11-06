# Phase 6-2: Coach Routes and Permissions Implementation Plan

> **Build a `PortalStore` per request (never share one across requests). A session id never goes in an answer or a log.**

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every coach route of spec 6.2 behind `global::is-coach`: profile, password change and devices, Azi, Grupe, group page, presence (own group and stand-in, 7-day window), individual lessons, athlete search, "Adaugă sportiv", "Sportiv nou", athlete card, Istoric month, Program tab and "Program public", each answering only the fields the coach screen shows.

**Architecture:** A thin scoped layer in `src/club/portal/coach/` over the phase 4 and 5 services. The policy attaches `ctx.state.coach`; `coachContexts()` builds the phase 5 `PresenceContext`, the phase 4 `GroupContext` and the phase 3 `ServiceContext` with actor `"Antrenor <nume>"`. Each route: read ownership live (`ownership.ts`), decide the right with a pure rule (`rules.ts`), call the existing service, map the answer through an explicit view (`views.ts`) to a type of `api-types.ts`. Nothing from `money-api.ts`, `due/`, `payments/`, or `billing.ts` amounts is imported in `src/club/portal/coach/**` (source-reading test).

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS), Postgres 16, Vitest 3, Node 22.

**Spec:** `docs/superpowers/specs/2026-11-04-coach-portal-design.md`: 2.3, 5.7 (device list), 5.8, 6.2, 7, 8.1 to 8.7, 9.3 to 9.11 (data each screen reads), 10.2, 11 (group and athlete lines), 14.3 (ownership matrix, leak checks). Index: `docs/superpowers/plans/2026-11-04-phase6-index.md` ("HTTP contracts" and "Rulings" are binding). Plan 6-1 "Interfaces for other plans". Phase 4 and 5 plans for the services reused.

**Base:** `feat/athletes` with plan 6-1 merged. Runs in parallel with plan 6-3.

**Parallel groups:** A: T1, T2 | B: T3, T4, T8 | C: T5, T6, T7, T9 | D: T10

| Group | Tasks | Runs after | Files |
|---|---|---|---|
| A | 1 Policy, context, ownership; 2 Types and views | 6-1 | 1: `src/policies/is-coach.ts`, `coach/{context,ownership}.ts`; 2: `coach/{api-types,views,rules}.ts` |
| B | 3 Me and devices, 4 Today and groups, 8 Istoric | A | `coach/me.ts`; `coach/today.ts`, `coach/groups.ts`; `coach/history.ts` |
| C | 5 Presence, 6 Lessons, 7 Athletes, 9 Program | A | `coach/presence.ts` + `panel.ts` (one export); `coach/lessons.ts`; `coach/athletes.ts` + `src/club/groups/members.ts`; `coach/program.ts` + `src/club/groups/group-admin.ts` |
| D | 10 Routes, controller, matrix, boot check | all | `src/api/portal/routes/02-coach.ts`, `src/api/portal/controllers/coach.ts`, `coach/__tests__/matrix.test.ts` |

**Risk and model:**

| Task | Risk | Model |
|---|---|---|
| 1 Policy, context, ownership | high | Sonnet |
| 2 Types, views, rules | high (field leaks, permission rules) | Haiku |
| 3 Me, password, devices | high (sessions) | Sonnet |
| 4 Today, groups, group page | high (permissions) | Sonnet |
| 5 Presence | high | Sonnet |
| 6 Lessons | high | Sonnet |
| 7 Athletes | high | Sonnet |
| 8 Istoric month | low | Sonnet |
| 9 Program and "Program public" | high (permissions) | Sonnet |
| 10 Routes and matrix | high | Sonnet |

## Global Constraints

- Everything in plan 6-1 "Global Constraints" (repo, commits, checks, copy, code, synthetic data). Boot check: `es62-pg` on 127.0.0.1:55462, Strapi on 1382. Ledger `p3be/.superpowers/sdd/2026-11-04-phase6-2/progress.md`.
- Spec 2.3: every coach route checks the group link on the server on every request; never return a field the coach screen does not show (address, birth date, child e-mail, notes, registrations, documents, payments, amounts, prices, other groups' rosters outside a stand-in presence).
- Permissions are spec 7's table, exactly; "own group" = an active group whose `coachIds` include the coach's team member, read on each request.
- 7-day window (8.3): `canCoachCorrect(date, today)` from 6-1 `window.ts`; today is Bucharest's (`todayIso()`).
- Refusal texts: 403 `PORTAL_ERRORS.noAccess` for a link failure, 403 `PORTAL_ERRORS.archived` after the window, 404 `PORTAL_ERRORS.notFound`, 400 `PORTAL_ERRORS.invalid`; service refusals of phase 4 and 5 pass through unchanged.
- Coach writes go through the same phase 4 and 5 services as the admin, so locks, history lines, prices, slots and the public cache refresh are the admin's. No coach answer carries `undo`.
- Files this plan may touch: `src/club/portal/coach/**`, `src/policies/is-coach.ts`, `src/api/portal/routes/02-coach.ts`, `src/api/portal/controllers/coach.ts`; in older code only `src/club/groups/members.ts` (T7), `src/club/groups/group-admin.ts` (T9), `src/club/groups/list.ts` (export of `rowOf`, T4), `src/club/presence/attendance/panel.ts` (one export, T5).

## Review Focus

- **Group link removed while the coach has the page open**: the next read and the next write answer 403 `"Nu mai ai acces la această grupă."`, nothing written. Pinned by Task 10 (`removed link answers 403 on every group route`).
- **A stand-in tries to widen his reach**: reading the roster for a date 8 days ago, saving without himself in "Antrenor", saving an "În afara programului" session, ticking a child not on that group's list. Each refused with 403 or 400, nothing written. Pinned by Task 5.
- **Corrections around the window edge in Bucharest time**: a session of 6 Oct saved at 23:59 on 13 Oct Bucharest (21:59 UTC) passes; at 00:01 on 14 Oct (22:01 UTC on 13 Oct) it is refused. Pinned by Task 5 (`window edge uses Bucharest today`).
- **Money or personal data in any coach answer**: no key `price`, `amount`, `charges`, `birthDate`, `notes`, `address`, `audience`, `itemName`, `priceListId`, `history`, `email` (except the coach's own in `CoachMe`) anywhere in any route's JSON. Pinned by Task 2 (`views drop every forbidden key`) and Task 10 (`no route leaks a forbidden key`).
- **A portal token on admin routes and an admin token on coach routes**: every `/club/*` route answers 401 or 403 to a portal session; every coach route answers 401 to an admin token. Pinned by Task 1 and Task 10.

---

## File Structure

```
src/policies/is-coach.ts                 global::is-coach (T1)
src/club/portal/coach/
  context.ts       CoachState, coachContexts (T1)
  ownership.ts     ownGroupIds, groupAccess, ownAthlete (T1)
  api-types.ts     every coach response type (T2)
  rules.ts         presenceRight, lessonRight, programRight, cardRight (T2)
  views.ts         toCoachSession, toCoachLesson, toCoachMember, coachAbonamentText, FORBIDDEN_KEYS, forbiddenKeysIn (T2)
  me.ts            readMe, saveMe, changePassword, listDevices, revokeDevice (T3)
  today.ts         readToday (T4)
  groups.ts        readGroups, readGroupPage (T4)
  presence.ts      readCoachSession, checkCoachSession, saveCoachSession (T5)
  lessons.ts       readCoachLesson, createCoachLesson, saveCoachLesson, deleteCoachLesson (T6)
  athletes.ts      searchAthletes, addMembers, addNewAthlete, readCard (T7)
  history.ts       readCoachHistory (T8)
  program.ts       readCoachProgram, coachAddProgram, coachChangeProgram, coachEndProgram, coachDeleteClass, coachSetDate, coachProgramPublic (T9)
  __tests__/coach-seed.ts, *.test.ts
src/api/portal/routes/02-coach.ts, controllers/coach.ts (T10)
```

---

### Task 1: `global::is-coach`, coach context and ownership (high, Sonnet)

**Files:**
- Create: `src/policies/is-coach.ts`, `src/club/portal/coach/context.ts`, `src/club/portal/coach/ownership.ts`, `src/club/portal/coach/__tests__/coach-seed.ts`
- Test: `src/policies/__tests__/is-coach.test.ts`, `src/club/portal/coach/__tests__/ownership.test.ts`

**Interfaces:**
- Consumes: 6-1 `isBffCall`, `portalSessions(store, now)`, `strapiPortalStore`, `canEnter`; phase 5 `presenceContext` shape, phase 4 `groupContext` shape, `strapiPresenceStore`, `strapiGroupStore`, `strapiClubStore`; `pingRevalidate`, `attemptScheduleChangeJobs`, `attemptPaymentEmails` (not used by coach writes; pass a no-op for `paymentEmails`).
- Produces:

```ts
// context.ts
export type CoachState = { accountId: string; userId: number; sessionId: string; teamMemberId: string; name: string };
export type CoachContexts = { coach: CoachState; today: string; presence: PresenceContext; groups: GroupContext; club: ServiceContext; portal: PortalStore };
export const coachActor = (name: string): string => `Antrenor ${name}`;
export function coachContexts(strapi: Core.Strapi, coach: CoachState): CoachContexts;
// ownership.ts
export type GroupAccess = 'own' | 'other' | 'none';
export function ownGroupIds(groups: GroupRecord[], teamMemberId: string): Set<string>; // active and coachIds include
export function groupAccess(group: GroupRecord | null, teamMemberId: string): GroupAccess; // null or inactive: 'none'
export function ownAthlete(memberships: MembershipRow[], own: Set<string>, athleteId: string, seasonId: string, today: string): boolean; // a current-season membership in an own group on today (S22)
// is-coach.ts
export default async (policyContext: { request: { header: Record<string, string | undefined> }; state: Record<string, unknown> }, _c: unknown, { strapi }): Promise<boolean>;
```
Policy order (spec 5.8, ruling 6): `isBffCall` false -> throw `errors.ForbiddenError` (403); Bearer missing or `verifyAccess` null -> `errors.UnauthorizedError` (401); account by user, user row: not `canEnter(account, user, 'antrenor')` -> `ForbiddenError` (403); team member name -> `ctx.state.coach`. A failing lookup throws (500).
- [ ] **Step 1: Failing tests**:
  - Policy: no secret 403; no token 401; an admin access token (built with `src/club/__tests__/admin-sessions.ts`) 401; a valid portal token of an active coach passes and sets `state.coach` with the name; disabled account 403; account without team member 403; blocked user 403; revoked session 401.
  - `global::is-admin` with a valid portal access token: throws Unauthorized (pins spec 5.8 the other way).
  - Ownership: inactive own group is `none`; a group whose `coachIds` lost the team member is `other`; `ownAthlete` false for last season's membership and for a membership ending yesterday.
  - Context: `actorName(contexts.presence)` answers `"Antrenor Andreea Pascu"` (phase 5 fallback, ruling 13) and `contexts.groups.actor` is the same string.
- [ ] **Step 2: Run** `npx vitest run src/policies/__tests__/is-coach.test.ts src/club/portal/coach/__tests__/ownership.test.ts`. FAIL.
- [ ] **Step 3: Implement.** `coach-seed.ts` exports `C_TEAM` (`tm-andreea` "Andreea Pascu", `tm-virgil` "Virgil Pascu"), a seeded fake presence context where `tm-andreea` coaches a Club group `g-club-a` and a Școala group `g-scoala-a`, `tm-virgil` coaches `g-club-b`, athletes with birth dates, contacts, e-mails, notes and Școala abonamente (so leak tests have something to leak), and `coachCtx(teamMemberId, today)` returning `CoachContexts` over the fakes.
- [ ] **Step 4: Run** tests, suite, `npx tsc --noEmit`. PASS.
- [ ] **Step 5: Commit** `feat(portal): is-coach policy, coach contexts and live group ownership`.

---

### Task 2: Coach response types, rules and views (high, Haiku)

**Files:**
- Create: `src/club/portal/coach/api-types.ts`, `rules.ts`, `views.ts`
- Test: `src/club/portal/coach/__tests__/rules.test.ts`, `views.test.ts`

**Interfaces:**
- Produces (`api-types.ts`, server-free; reuses phase 5 `SectionKind`, `SessionState` by type import only):

```ts
export type CoachMe = { name: string; firstName: string; initials: string; email: string; phone: string | null; hasPassword: boolean; google: boolean };
export type CoachDevice = { id: string; label: string; lastSeenAt: string; current: boolean };
export type CoachClassRow = { sessionId: string | null; occurrenceKey: string | null; groupId: string; groupName: string; date: string; startTime: string; children: number; done: boolean; standIn: boolean };
export type CoachLessonRow = { lessonId: string; athleteName: string; date: string; startTime: string; durationMin: number; done: boolean };
export type CoachToday = { date: string; today: string; groups: CoachClassRow[]; lessons: CoachLessonRow[]; todo: CoachClassRow[] };
export type CoachGroupRow = { groupId: string; name: string; kind: SectionKind; program: string[]; children: number };
export type OtherGroupRow = { groupId: string; name: string; coaches: string[] };
export type CoachGroups = { mine: CoachGroupRow[]; others: OtherGroupRow[] };
export type CoachMember = { athleteId: string; name: string; age: number | null; isNew: boolean; alsoIn: string[] };
export type StandInSlot = { occurrenceKey: string; date: string; startTime: string };
export type CoachGroupPage = {
  groupId: string; name: string; kind: SectionKind; own: boolean; coaches: string[]; program: string[];
  members: CoachMember[] | null;         // null for another coach's group
  standIn: StandInSlot[];                // other group only: scheduled classes from today - 7 to today, newest first
  todayKey: string | null;               // occurrence key of today's class (own or other), drives "Fă prezența" / "Înlocuiesc azi"
  programPublic: boolean | null;         // own Club group only
};
export type CoachPresenceRow = { athleteId: string; name: string; age: number | null; inactive: boolean; visitor: boolean; grup: boolean; uscat: boolean; abonament: string | null };
export type CoachSession = {
  sessionId: string | null; occurrenceKey: string | null; added: AddedSession | null; groupId: string; groupName: string; kind: SectionKind;
  date: string; startTime: string; durationMin: number; outsideSchedule: boolean; coachIds: string[]; coachOptions: { id: string; name: string }[];
  rows: CoachPresenceRow[]; savedLine: string | null; editable: boolean; archived: boolean; standIn: boolean;
};
export type CoachLesson = {
  lessonId: string; athleteId: string; athleteName: string; date: string; startTime: string; durationMin: number; coachIds: string[];
  coachOptions: { id: string; name: string }[]; state: LessonState; present: boolean | null; savedLine: string | null; editable: boolean; archived: boolean; deletable: boolean;
};
export type CoachSearchRow = { athleteId: string; name: string; age: number | null };
export type CoachNewAthleteBody = { groupId: string; name: string; birthDate?: string | null; contactName?: string | null; phone?: string | null; email?: string | null };
export type CoachAthleteCard = { athleteId: string; name: string; age: number | null; groups: string[]; school: string | null; contact: { name: string | null; phone: string | null } | null };
export type CoachHistoryRow = { kind: 'grup' | 'inlocuitor' | 'individuala'; date: string; name: string; present: number | null; durationMin: number | null; sessionId: string | null; lessonId: string | null };
export type CoachHistory = { month: string; sessions: number; lessons: number; hours: string; rows: CoachHistoryRow[] };
export type CoachProgram = { kind: SectionKind; editable: boolean; programPublic: boolean | null; program: GroupProgram; occurrences: unknown[] /* phase 4 calendar row type of the month, as /club/calendar/occurrences answers */ };
```
Replace `unknown[]` with the phase 4 row type that `calendarRows` returns (import it by name).
- `rules.ts` (pure):

```ts
export type PresenceFacts = { access: GroupAccess; date: string; today: string; scheduled: boolean; added: boolean; saved: boolean; listed: boolean };
export type Right = { read: boolean; write: boolean; archived: boolean; mustIncludeMe: boolean };
export function presenceRight(f: PresenceFacts): Right;
export type LessonFacts = { listed: boolean; date: string; today: string; recorded: boolean };
export function lessonRight(f: LessonFacts): Right & { delete: boolean };
export function programRight(access: GroupAccess, kind: SectionKind): { read: boolean; write: boolean };
export function cardRight(own: boolean, onListedSession: boolean): { read: boolean; contact: boolean };
```
`presenceRight` (spec 7, 8.2, 8.3, rulings 7 and 8): `none` reads and writes nothing. Write never for `date > today`. `own`: read always; write when `!saved || canCoachCorrect(date, today)`; `archived = saved && !canCoachCorrect`. `other`: `mustIncludeMe`; `added` sessions neither read nor write; read when `listed` or (`scheduled` and `date >= today - 7` and `date <= today`); write when (`!saved` and `scheduled` and inside those 7 days) or (`saved` and `listed` and `canCoachCorrect`); `archived` as own. `lessonRight`: nothing unless `listed`; write when `!recorded || canCoachCorrect`; `delete` when `!recorded` or (`recorded` and `canCoachCorrect`) (S23). `programRight`: read for `own` and `other`; write only `own` and `club`. `cardRight` (ruling 21): `own` reads with contact; `onListedSession` reads without contact; else nothing.
- `views.ts`:

```ts
export const FORBIDDEN_KEYS = ['price', 'amount', 'charges', 'birthDate', 'notes', 'address', 'audience', 'itemName', 'priceListId', 'history', 'email', 'registrations', 'documents', 'payments'] as const;
export function forbiddenKeysIn(value: unknown, allow?: string[]): string[]; // recursive key walk
export function coachAbonamentText(kind: SectionKind, slots: { used: number; total: number } | null): string | null; // club: null; school: 'used/total' or 'Fără abonament'
export function toCoachSession(panel: SessionPanel, x: { ages: Map<string, number | null>; slots: Map<string, { used: number; total: number } | null>; team: NamedRow[]; right: Right; standIn: boolean }): CoachSession;
export function toCoachLesson(panel: LessonPanel, x: { team: NamedRow[]; right: Right & { delete: boolean }; paid: boolean }): CoachLesson; // deletable = right.delete && !paid
export function toCoachMember(m: MemberRow, status: AthleteStatus): CoachMember;
```
`toCoachSession` builds each field by name (no spread of `panel`). Server answers use only 6-1 `PORTAL_ERRORS` and `PORTAL_TOASTS`; the screens' copy is the frontend's.
- [ ] **Step 1: Failing tests**:

```ts
const base = { date: '2026-10-06', today: '2026-10-13', scheduled: true, added: false, saved: true, listed: false };
expect(presenceRight({ ...base, access: 'own' })).toEqual({ read: true, write: true, archived: false, mustIncludeMe: false });
expect(presenceRight({ ...base, access: 'own', today: '2026-10-14' })).toMatchObject({ read: true, write: false, archived: true });
expect(presenceRight({ ...base, access: 'own', saved: false, today: '2026-11-30' })).toMatchObject({ write: true }); // first save, no deadline (S27)
expect(presenceRight({ ...base, access: 'own', date: '2026-10-14' })).toMatchObject({ write: false }); // future
expect(presenceRight({ ...base, access: 'other', saved: false })).toMatchObject({ read: true, write: true, mustIncludeMe: true });
expect(presenceRight({ ...base, access: 'other', saved: false, date: '2026-10-05' })).toMatchObject({ read: false, write: false }); // day 8
expect(presenceRight({ ...base, access: 'other', saved: true, listed: false })).toMatchObject({ write: false });
expect(presenceRight({ ...base, access: 'other', saved: true, listed: true })).toMatchObject({ read: true, write: true });
expect(presenceRight({ ...base, access: 'other', added: true, saved: false })).toMatchObject({ read: false, write: false });
expect(presenceRight({ ...base, access: 'none', listed: true })).toMatchObject({ read: false, write: false });
expect(lessonRight({ listed: true, date: '2026-10-06', today: '2026-10-14', recorded: true })).toMatchObject({ write: false, delete: false, archived: true });
expect(lessonRight({ listed: true, date: '2026-09-01', today: '2026-10-14', recorded: false })).toMatchObject({ write: true, delete: true });
expect(programRight('own', 'school')).toEqual({ read: true, write: false });
expect(programRight('other', 'club')).toEqual({ read: true, write: false });
expect(coachAbonamentText('school', { used: 3, total: 8 })).toBe('3/8');
expect(coachAbonamentText('school', null)).toBe('Fără abonament');
expect(coachAbonamentText('club', { used: 3, total: 8 })).toBeNull();
```
`views drop every forbidden key`: `forbiddenKeysIn(toCoachSession(seededPanelWithHistory, ...))` is `[]`, also for `toCoachLesson`, `toCoachMember`; `forbiddenKeysIn({ a: [{ price: 1 }] })` is `['price']`.
- [ ] **Step 2: Run**, FAIL. **Step 3: Implement.** **Step 4: Run** tests, suite, tsc, `npx tsc -p src/admin --noEmit`. PASS.
- [ ] **Step 5: Commit** `feat(portal): coach response types, permission rules and field allow-lists`.

---

### Task 3: Profile, password change and devices (high, Sonnet)

**Files:** Create `src/club/portal/coach/me.ts`. Test: `me.test.ts`.

**Interfaces:**
- Consumes: 6-1 `PortalStore`, `PortalSessions`, `limiter`, `checkPassword`, `hashSecret`, `PORTAL_ACTIONS`.
- Produces:

```ts
export async function readMe(c: CoachContexts): Promise<AdminResult<CoachMe>>;
export async function saveMe(c: CoachContexts, body: unknown): Promise<AdminResult<{ toast: string }>>;
export async function changePassword(c: CoachContexts & { auth: PortalAuthContext }, body: unknown): Promise<AdminResult<{ toast: string }>>;
export async function listDevices(c: CoachContexts, deviceKey: string | null): Promise<AdminResult<CoachDevice[]>>;
export async function revokeDevice(c: CoachContexts & { sessions: PortalSessions }, deviceId: string): Promise<AdminResult<{ revokedCurrent: boolean }>>;
```
- `readMe`: `firstName` = the first word of the team member name, `initials` = first letters of the first and last word, upper case; `hasPassword` = user has a hash; `google` = `googleSub` set.
- `saveMe` body `{ phone: string | null }`: trimmed, empty -> null, at most 30 characters of digits, spaces, `+`, `.`, `(`, `)`; else 400 `invalid`. Answer toast `"Salvat."`.
- `changePassword` body `{ current, password }`: no stored hash or no `current` -> 400 `invalid` (a Google-only account sets a password by reset, S18); order as login (R2 I1, count before compare): `limits.emailAttempt(email)` first, `refused` -> 429 `paused`; then compare `current`; wrong `current` -> 400 `currentWrong` (429 `paused` when `locking`), and on `firstLock` call the exported `noticeLockout(c, account)` from `auth/login.ts` (lockout mail and line, not awaited); right `current` -> `limits.emailCleared(email)`; rules -> 400 rule text; then hash, history `passwordChanged` (actor `"Antrenor <nume>"`), `revokeAll(userId, coach.sessionId)` (S11), toast `"Salvat."`.
- `listDevices`: not revoked, `lastSeenAt` newest first, `current` when `hashSecret(deviceKey)` equals the row's hash.
- `revokeDevice`: a device of another account -> 404; sets `revokedAt`, `sessions.revokeDevice(userId, id)`; `revokedCurrent` when the row's `sessionId` equals `coach.sessionId`.
- [ ] **Step 1: Failing tests**: each rule above; `changePassword` ends the other sessions and keeps the current (`verifyAccess` of the current token still works, another device's token answers null); 5 wrong `current` lock the e-mail (login then answers 429); revoking another coach's device 404.
- [ ] **Step 2 to 4**: run FAIL, implement, run PASS plus suite and tsc.
- [ ] **Step 5: Commit** `feat(portal): coach profile, password change and device list`.

---

### Task 4: Azi, Grupe and the group page (high, Sonnet)

**Files:** Create `src/club/portal/coach/today.ts`, `groups.ts`; modify `src/club/groups/list.ts` (export `rowOf` as `groupListRow`). Tests: `today.test.ts`, `groups.test.ts`.

**Interfaces:**
- Consumes: phase 5 `readDay` (`day.ts`), `loadRowContext`, `rowsBetween`; phase 5 store `lessons({ from, to })`, `sessions({ ids })`; phase 4 `readGroupPage`, `groupListRow`, `currentSeason` lookups; `addDays`.
- Produces: `readToday(c, date: unknown): Promise<AdminResult<CoachToday>>`, `readGroups(c): Promise<AdminResult<CoachGroups>>`, `readGroupPage(c, groupId: string): Promise<AdminResult<CoachGroupPage>>` (named `readCoachGroupPage` to avoid the phase 4 name).
- `readToday`: `readDay(store, date, today)`; `groups` = `day` rows of own groups plus saved rows of other groups whose session `coachIds` include the coach (S31, `standIn: true`); `todo` = `undone` rows of own groups (newest first, P5 3.8 start date rule already in `readDay`); `children` = `listed`; `done` = state `salvata`. `lessons` = lessons of the date whose `coachIds` include the coach, `done` = `present !== null`. Invalid `date` -> 400.
- `readGroups`: current season; `mine` = own active groups via `groupListRow` (program lines, member count); `others` = the other active groups with coach names, ordered as the admin list.
- `readCoachGroupPage`: `none` -> 404 for an unknown or inactive group; `own` -> members from phase 4 `readGroupPage` mapped by `toCoachMember` (status from the athlete), `programPublic` for Club; `other` -> `members: null`, `standIn` = held occurrences of the group from `today - 7` to today (`rowsBetween(..., groupId)` rows with an `occurrenceKey` and not `outsideSchedule`), `programPublic: null`. `todayKey` = today's held occurrence key of the group, or null.
- [ ] **Step 1: Failing tests**: Azi of `tm-andreea` lists `g-club-a` and `g-scoala-a` classes, not `g-club-b`; a saved stand-in session of `g-club-b` with her in `coachIds` appears with `standIn: true`; an unsaved `g-club-b` class does not; `todo` holds her past unsaved classes only; empty day: three empty lists; `others` row has coach names and no `children`; the other group's page has `members: null` and only slots from the 7 days; removing her from `g-club-a` coaches turns that page into `own: false`; `forbiddenKeysIn` of each answer is `[]`.
- [ ] **Step 2 to 4** as above.
- [ ] **Step 5: Commit** `feat(portal): coach day, groups list and group page`.

---

### Task 5: Presence: read, check, save (high, Sonnet)

**Files:** Create `src/club/portal/coach/presence.ts`; modify `src/club/presence/attendance/panel.ts` (export `abonamentSlots`). Test: `presence.test.ts`.

**Interfaces:**
- Consumes: phase 5 `readPanelQuery`, `readSessionPanel`, `checkNewSession`, `saveSession`, `resolveScope`, `rosterOn`, `respondSave` body shape; T2 `presenceRight`, `toCoachSession`; T1 `groupAccess`.
- Produces:

```ts
// panel.ts, beside abonamentStatuses, from the same pickSubscription and usedSlots:
export async function abonamentSlots(store: PresenceStore, athleteIds: string[], priceListId: string | null, date: string): Promise<Map<string, { used: number; total: number } | null>>;
// presence.ts
export async function readCoachSession(c: CoachContexts, q: Record<string, unknown>): Promise<AdminResult<CoachSession>>;
export async function checkCoachSession(c: CoachContexts, body: unknown): Promise<AdminResult<SessionCheck>>;
export async function saveCoachSession(c: CoachContexts, body: unknown): Promise<SaveOutcome>;
```
- Facts for `presenceRight`: group and date from the panel query (`id`: the saved session; `occurrence`: the held occurrence; `added`: the body), `scheduled` = target has an occurrence key and is not outside the schedule, `saved` = a session row exists, `listed` = its `coachIds` include the coach.
- `readCoachSession`: right `read` false -> 403 `noAccess`; else the phase 5 panel, ages from birth dates (computed here, the date never leaves), slots via `abonamentSlots` (school only), `editable = right.write`, `archived = right.archived`, `standIn = access === 'other'`, `coachOptions` = all team members (names only).
- `checkCoachSession` body `{ groupId, date, startTime }`: own group only (`other` -> 403 `noAccess`, ruling 7: no "În afara programului" on another coach's group); else phase 5 `checkNewSession`.
- `saveCoachSession`, before calling `saveSession(c.presence, body)`: body read with phase 5 `readSaveBody` (400 on null); facts and right; `!write` -> 403 (`archived` text when `right.archived`, else `noAccess`); `mustIncludeMe` and the coach not in `coachIds` -> 403 `noAccess` (S26, S28); every ticked athlete must be on `rosterOn(memberships, groupId, seasonId, date)` or already on the saved session (ruling 8) else 400 `invalid`. Then the phase 5 save unchanged (locks, slots, prices, lines with actor `"Antrenor <nume>"`, reactivation 409).
- [ ] **Step 1: Failing tests**:
  - Own group: save, read back with `savedLine` "Salvată de Antrenor Andreea Pascu, ..."; history line actor `"Antrenor Andreea Pascu"`; correction on day 7 passes; day 8 answers 403 `"Arhivată. Nu mai poate fi modificată."` and nothing changes; read on day 8 has `archived: true, editable: false`.
  - `window edge uses Bucharest today`: `today` from `todayIso()` with system time `2026-10-13T21:59:00Z` allows a 6 Oct session; `2026-10-13T22:01:00Z` refuses it.
  - Stand-in (`tm-andreea` on `g-club-b`): read of today's class returns the roster; read 8 days back 403; save without her in `coachIds` 403; save with her passes and the session now lists her; correction by her within the window passes; removing herself on a correction 403; an `added` session on `g-club-b` 403; `check` on `g-club-b` 403.
  - Ticks: a child not on the list 400; a visitor added earlier by the admin stays tickable.
  - Reactivation: ticking an inactive child answers the phase 5 409 body; with `reactivate` it saves.
  - Leak: `forbiddenKeysIn(read)` is `[]`; Club rows have `abonament: null`; Școala rows `"3/8"` or `"Fără abonament"`.
- [ ] **Step 2 to 4** as above.
- [ ] **Step 5: Commit** `feat(portal): coach presence with stand-in and the 7-day correction window`.

---

### Task 6: Individual lessons (high, Sonnet)

**Files:** Create `src/club/portal/coach/lessons.ts`. Test: `lessons.test.ts`.

**Interfaces:**
- Consumes: phase 5 `readLesson`, `createLesson`, `saveLesson`, `deleteLesson`, `isDeletable`, `readLessonBody`, `readLessonPatch`; T2 `lessonRight`, `toCoachLesson`.
- Produces: `readCoachLesson(c, id)`, `createCoachLesson(c, body)`, `saveCoachLesson(c, id, body)`, `deleteCoachLesson(c, id)`; writes answer the phase 5 data without `undo`.
- Rules: read and write only when the coach is in the lesson's `coachIds` (else 404, so a lesson id does not tell it exists); create: `coachIds` must include the coach (403 `noAccess`) and the athlete must be `nou` or `activ` and not anonymized (400 `invalid`); save: `lessonRight.write` (archived text after the window) and the patch's `coachIds` must still include the coach (403); delete: `lessonRight.delete` and phase 5 `isDeletable` (a paid lesson stays 409 as phase 5).
- [ ] **Step 1: Failing tests**: create with only another coach 403; create then read with `createdByName` "Antrenor Andreea Pascu" in the line; planned lesson deleted any time; recorded lesson saved on day 7, refused on day 8 with the archived text; delete of a recorded lesson on day 8 refused; another coach's lesson id 404; no `price`, `itemName`, `audience` in any answer.
- [ ] **Step 2 to 4** as above.
- [ ] **Step 5: Commit** `feat(portal): coach individual lessons`.

---

### Task 7: Athlete search, "Adaugă sportiv", "Sportiv nou", athlete card (high, Sonnet)

**Files:** Create `src/club/portal/coach/athletes.ts`; modify `src/club/groups/members.ts`. Tests: `athletes.test.ts`, and two new cases in the existing phase 4 members test file.

**Interfaces:**
- Consumes: phase 3 `queryRank`, `matchesQuery` (`search.ts`), `readAthleteInput`, `isDataIncomplete`, `athleteChanges`, `refreshAllMatches`, `safely`, `HISTORY_ACTIONS.created`; phase 4 `joinGroup`, `startDateFor`; `ageFromIso`; T1 `ownAthlete`; T2 `cardRight`.
- Produces:

```ts
// members.ts
export type JoinBody = { season: string; athleteIds: string[]; mode: JoinMode; from?: string };
// readJoinBody: `from` optional, must be isIsoDate; joinOne uses it when set; from < startDateFor(season, today) or after the season end -> 400 GROUP_ERRORS.invalid
// athletes.ts
export async function searchAthletes(c: CoachContexts, q: Record<string, unknown>): Promise<AdminResult<CoachSearchRow[]>>;
export async function addMembers(c: CoachContexts, groupId: string, body: unknown): Promise<ActionResult<JoinResult>>;
export async function addNewAthlete(c: CoachContexts, body: unknown): Promise<AdminResult<{ athleteId: string; toast: string }>>;
export async function readCard(c: CoachContexts, athleteId: string): Promise<AdminResult<CoachAthleteCard>>;
```
- `searchAthletes` (8.5, P6 q25, ruling 9): `q` trimmed under 3 letters -> `[]`; athletes with status `nou` or `activ`, not anonymized; subject built from the name only (`{ names: [name], phone: null, texts: [], birthDate: null }`); excluding current members of `group` when given; ranked by `queryRank`, at most 8; rows `{ athleteId, name, age }`.
- `addMembers` body `{ athleteIds, from }`: group must be `own` (403 `noAccess`); every athlete `nou` or `activ` (400); `from` >= today (400); `joinGroup(c.groups, groupId, { season: <current season label>, athleteIds, mode: 'add', from })`; answer without `undo`.
- `addNewAthlete` body `CoachNewAthleteBody` (8.6, P6 q13 and q21, ruling 11): group active, any access but `none` (404); fields through `readAthleteInput(body, 'add')` (name required with the phase 3 text, birth date optional); one `c.groups.store.transaction`: `c.club.store.createAthlete({ ...values, status: 'nou', dataIncomplete })`, the P3 `created` line (actor `"Antrenor <nume>"`), then `joinGroup(..., { mode: 'add' })` from today; a join refusal throws so the athlete is rolled back, and the refusal is answered. After commit: `refreshAllMatches` (`safely`). Toast `"Salvat."`.
- `readCard` (8.7, ruling 21): `own` = `ownAthlete(...)`; `onListedSession` = the athlete has an attendance on a session whose `coachIds` include the coach, dated from today - 7 to today; `cardRight` false -> 403 `noAccess`; `groups` = current-season group names; `school` = `coachAbonamentText('school', slots)` when the athlete is in a Școala group today, else null; `contact` only when `own`.
- [ ] **Step 1: Failing tests**: search "ana" returns at most 8, no `inactiv`, nobody already in the group, no phone match for "0721"; `addMembers` on another coach's group 403; `from` yesterday 400; "Sportiv nou" on `g-club-b` by `tm-andreea` creates status `nou` with a membership from today and the athlete is not in her own rosters; a forced join failure (`failOn('createMembership')`) leaves no athlete; card of an own child has `contact`, of a stand-in child (listed session 3 days ago) has `contact: null`, of an unrelated child 403; no `birthDate` or `email` key in any answer. Phase 4 members tests: admin join without `from` unchanged; `from` before the season start 400.
- [ ] **Step 2 to 4** as above.
- [ ] **Step 5: Commit** `feat(portal): coach athlete search, add to group, new athlete and athlete card`.

---

### Task 8: Istoric month (low, Sonnet)

**Files:** Create `src/club/portal/coach/history.ts`. Test: `history.test.ts`.

**Interfaces:**
- Consumes: phase 5 store `sessions({ from, to })`, `attendances`, `lessons`, `coachRows`, `hoursText`.
- Produces: `readCoachHistory(c, month: unknown): Promise<AdminResult<CoachHistory>>`.
- Rows: saved sessions of the month whose `coachIds` include the coach, `kind` `grup` when the group is own today, else `inlocuitor`; `present` = present count; recorded lessons with `present === true` where the coach is listed, `kind` `individuala`, `name` = athlete name, `durationMin`. Newest first. Summary from the phase 5 `coachRows` row of this coach (same hours rule as "Pe antrenori"). Bad month -> 400.
- [ ] **Step 1: Failing tests**: counts and `hours` equal the admin "Pe antrenori" row for the same coach and month; a stand-in session is `inlocuitor`; a planned lesson is not listed.
- [ ] **Step 2 to 4** as above.
- [ ] **Step 5: Commit** `feat(portal): coach monthly history with hours`.

---

### Task 9: Program tab and "Program public" (high, Sonnet)

**Files:** Create `src/club/portal/coach/program.ts`; modify `src/club/groups/group-admin.ts`. Tests: `program.test.ts`, one case in the phase 4 group-admin test.

**Interfaces:**
- Consumes: phase 4 `readGroupProgram`, `calendarRows` / `readRange` (`occurrences.ts`, as `schedule.occurrences` uses them), `addProgram`, `changeProgram`, `endProgram`, `deleteClass`, `setDate`, `lockedEvent`; T2 `programRight`.
- Produces:

```ts
// group-admin.ts
export async function setProgramPublic(ctx: GroupContext, groupId: string, value: unknown): Promise<AdminResult<{ changed: boolean }>>; // lock group, same 'programPublic' field-change line as updateGroup, ctx.revalidate() when changed
// program.ts
export async function readCoachProgram(c: CoachContexts, groupId: string, month: unknown): Promise<AdminResult<CoachProgram>>;
export async function coachAddProgram(c: CoachContexts, groupId: string, body: unknown): Promise<AdminResult<{ eventId: string; date: string | null }>>;
export async function coachChangeProgram(c: CoachContexts, eventId: string, body: unknown): Promise<AdminResult<{ eventId: string }>>;
export async function coachEndProgram(c: CoachContexts, eventId: string, body: unknown): Promise<AdminResult<{ eventId: string }>>;
export async function coachDeleteClass(c: CoachContexts, eventId: string): Promise<AdminResult<{ date: string }>>;
export async function coachSetDate(c: CoachContexts, eventId: string, date: string, body: unknown): Promise<AdminResult<DateAnswer>>;
export async function coachProgramPublic(c: CoachContexts, groupId: string, body: unknown): Promise<AdminResult<{ toast: string }>>;
```
- Every write: the group (from the event for `/program/:eventId` routes) must give `programRight(...).write` (403 `noAccess`); any date the body names (`from`, `date`, `newDate`, the `:date` param) earlier than today -> 400 `invalid` (spec 9.8 past dates read only; Pauză dates keep the phase 4 refusal); then the phase 4 service with `c.groups` (actor `"Antrenor <nume>"`, same lines, same e-mails when `notify`, same revalidate). Answers drop `undo`.
- `coachProgramPublic` body `{ value: boolean }` (else 400): own Club only; `setProgramPublic`; toast `"Salvat."`.
- `readCoachProgram`: `programRight.read` else 404; `editable` = write right; `programPublic` for own Club, else null; occurrences of the month for this group only.
- [ ] **Step 1: Failing tests**: coach adds a weekly program on `g-club-a`: event saved, P4 history line actor `"Antrenor Andreea Pascu"`, `revalidated()` incremented; same on `g-scoala-a` 403; on `g-club-b` 403; `setDate` with `notify` on a future date queues the schedule-change jobs as the admin path; a past date 400; "Program public" off writes `Program public: "Da" → "Nu"` and revalidates; again with the same value writes nothing; `setProgramPublic` from the admin side gives the same line (group-admin test).
- [ ] **Step 2 to 4** as above.
- [ ] **Step 5: Commit** `feat(portal): coach Program tab and Program public switch`.

---

### Task 10: Routes, controller, ownership matrix, boot check (high, Sonnet)

**Files:** Create `src/api/portal/routes/02-coach.ts`, `src/api/portal/controllers/coach.ts`, `src/club/portal/coach/__tests__/matrix.test.ts`, `coach-routes.test.ts`.

**Interfaces:**
- Produces the routes of the index "Coach routes" table, exactly, in this order (static before parameter):

```ts
['GET /portal/coach/me', 'PUT /portal/coach/me', 'POST /portal/coach/me/password', 'GET /portal/coach/me/devices', 'DELETE /portal/coach/me/devices/:id',
 'GET /portal/coach/today', 'GET /portal/coach/groups', 'GET /portal/coach/groups/:documentId', 'GET /portal/coach/groups/:documentId/program',
 'POST /portal/coach/groups/:documentId/program', 'PUT /portal/coach/groups/:documentId/program-public', 'POST /portal/coach/groups/:documentId/members',
 'GET /portal/coach/session', 'POST /portal/coach/session/check', 'PUT /portal/coach/session',
 'POST /portal/coach/lessons', 'GET /portal/coach/lessons/:documentId', 'PUT /portal/coach/lessons/:documentId', 'DELETE /portal/coach/lessons/:documentId',
 'GET /portal/coach/athletes/search', 'POST /portal/coach/athletes', 'GET /portal/coach/athletes/:documentId',
 'GET /portal/coach/history',
 'PUT /portal/coach/program/:eventId', 'POST /portal/coach/program/:eventId/end', 'DELETE /portal/coach/program/:eventId', 'PUT /portal/coach/program/:eventId/dates/:date']
```
each `config: { auth: false, policies: ['global::is-coach'], middlewares: [] }`. Handlers: `respond` / `respondSave` (phase 5 409 body) / a `respondData` that answers `{ data }` from an `ActionResult` without `undo`.
- [ ] **Step 1: Failing tests**:
  - Routes: exact list, config, every handler exists, `staticBeforeParams` true.
  - Source test: no file under `src/club/portal/coach/` or `controllers/coach.ts` imports `money-api`, `due/`, `payments/`, `billing` (read the files, regex on import paths).
  - `matrix.test.ts`, the spec 7 table through the controller with the seeded fakes and `state.coach` set: for each row (roster, presence, correction, add athlete, "Sportiv nou", contact, edit program, "Program public", price list never exposed) and each column (own, other, Școala own, removed link, disabled account via the policy) the expected 200 / 403 / 404.
  - `removed link answers 403 on every group route`.
  - `no route leaks a forbidden key`: every GET answer of the matrix run passes `forbiddenKeysIn(body, route === '/portal/coach/me' ? ['email'] : [])` as `[]`.
  - Every route in `src/api/club/routes/*.ts` called with a portal session through its `global::is-admin` policy answers 401 or 403.
- [ ] **Step 2: Run**, FAIL. **Step 3: Implement.** **Step 4: Run** tests, suite, tsc. PASS.
- [ ] **Step 5: Boot check** on `es62-pg` / 1382 with `phase4-shape.js`, `phase5-shape.js`, `phase6-shape.js`: log in `antrenor1@example.invalid` through `/portal/auth/login` (secret header), then with the access token: `GET /portal/coach/today`, `GET /portal/coach/groups`, read and save today's presence of an own group, read it back (actor line), correct it, try a correction with system date + 8 days (container `TZ` unchanged; use a session dated 8 days back in the fixture) and see 403 archived text, `GET /portal/coach/history?month=` current month, `GET /club/attendance/day` with the portal token answers 401. Log results; remove the container.
- [ ] **Step 6: Commit** `feat(portal): coach routes with ownership matrix tests`.

## Interfaces for other plans

- The frontend plan copies `src/club/portal/coach/api-types.ts` and the phase 5 types it names (`SessionCheck`, `SessionSaveBody`, `SessionSaved`, `LessonBody`, `LessonPatch`, `LessonSaved`, `AddedSession`, `LessonState`, `SectionKind`) and phase 4 `GroupProgram`, `JoinResult`, `DateAnswer`, program bodies.
- `setProgramPublic` is available to the admin side (no admin UI change in this phase).

## Self-review

- **Spec coverage.** 5.7 device list (T3), 5.8 (T1), 6.2 every route (T3 to T10), 7 table (T2 rules, T10 matrix), 8.1 (T5), 8.2 (T2, T5), 8.3 (T2, T5, T6), 8.4 (T6), 8.5 (T7), 8.6 (T7), 8.7 (T7), 9.3 to 9.10 data (T3, T4, T5, T8, T9), 10.2 actor (T1 context, pinned in T5 and T6), 11 group and athlete lines (T7, T9 through phase 3 and 4 services), 14.3 matrix and leaks (T2, T10). Frontend screens, cookies, host routing: frontend plan.
- **Step scan.** Rule functions carry their full decision table in prose and tests; service bodies are left to the implementer.
- **Type consistency.** `CoachContexts` (T1) used by T3 to T10; `Right` (T2) consumed by `toCoachSession` and `toCoachLesson`; `abonamentSlots` (T5) feeds T2's `coachAbonamentText` and T7's card.
- **Review Focus.** Each line has its named test in T1, T2, T5, T10.
