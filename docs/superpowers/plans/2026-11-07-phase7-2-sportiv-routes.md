# Phase 7-2: Sportiv Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every `/portal/sportiv/*` route of the index contracts: settings, athletes and picker, Acasă with the promotion moment, Istoric, Date sportiv, Calendar and its `.ics`, Parcurs with badges, money, payments, abonament, the registration PDF, and the holder's schedule-mail switch.

**Architecture:** `src/club/portal/sportiv/` holds one reader per screen over the phase 4 and 5 stores, pure derivations in their own files (`months.ts`, `badges.ts`, `path.ts`, `calendar.ts`, `ics.ts`, `money.ts`), and explicit views (`views.ts`) that build the `api-types.ts` shapes field by field. The controller wraps each `:athleteId` handler in `withAthlete`, which checks `holdsAthlete` before calling the reader. Competition data comes through a `CompetitionSource` interface; this plan ships the null source, plan 7-3 the real one.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS), Postgres 16, Vitest 3, Node 22.

**Spec:** `docs/superpowers/specs/2026-11-07-sportiv-app-design.md` sections 5.2 to 5.4, 6.2 to 6.10, 7, 9, 10.1, 11.3, 14.2. Index: `docs/superpowers/plans/2026-11-07-phase7-index.md` (contracts and rulings binding).

**Base:** `feat/athletes` with 7-1 merged. Parallel with 7-3. Ledger `p3be/.superpowers/sdd/2026-11-07-phase7-2/progress.md`.

| Task | Risk | Model | Batch |
|---|---|---|---|
| 1 Types, views, forbidden keys, context, `CompetitionSource` | high (data exposure) | Sonnet | A |
| 2 Me, settings, devices, athletes and picker | high (auth) | Sonnet | A |
| 3 Acasă and promotion | high (data exposure) | Sonnet | A |
| 4 Istoric and Date sportiv | high (data exposure) | Haiku | A |
| 5 Calendar and `.ics` | high (data exposure) | Sonnet | B |
| 6 Parcurs and badges | low | Sonnet | |
| 7 Money, payments, abonament, registration PDF | high (data exposure) | Sonnet | B |
| 8 Schedule-mail switch | low | Haiku | |
| 9 Routes, controller, host and access matrix | high (permissions) | Sonnet | B |
| 10 Boot check and click-through | low | Haiku | |

## Global Constraints

- Everything in plan 7-1 "Global Constraints". Boot check `es72-pg` on 127.0.0.1:55466, Strapi 1386.
- Today is Bucharest's (`todayIso()` / `todayInBucharest`). Current season = `findCurrentSeason` [code src/club/current-season.ts].
- No reader imports `src/club/presence/money-api.ts` types into an answer; money answers are built only by `money.ts` and `views.ts` of this plan (source-reading test, Task 9).
- Forbidden keys (spec 5.4) never appear in any sportiv answer: `notes`, `recordedBy`, `note` (payment), `history`, `priceListId`, `audience`, `charges`, `registrations`, `roster`, `visitor`, `skaterName`, `sessionId`. The calendar item key `note` (a cancelled date's reason) is the one allowed `note`, checked by path.
- Amounts: "inclus" and "fara_pret" billing and groups without a price list contribute nothing and produce no line (spec 6.8).
- Files this plan may touch: `src/club/portal/sportiv/**`, `src/api/portal/routes/03-sportiv.ts`, `src/api/portal/controllers/sportiv.ts`, `src/club/groups/schedule-mail.ts`, in older code one export each where named.

## Review Focus

- **A holder opens another family's athlete id** by editing the URL: 403 "Nu mai ai acces la acest sportiv." on every route, including the two binary ones, with no store read for that athlete. Pinned by Task 9 (`every athlete route refuses a foreign id before reading`).
- **An athlete changes group mid season** (Începători to Intermediari Bronze in January): Acasă shows the new group, Parcurs "Până acum" lists the old one with its dates, the promotion shows once and not on a second device. Pinned by Task 3 and Task 6.
- **Season boundaries**: on 1 September the new season has no presences: Acasă shows 0 and the month bars start at September; Istoric shows the new season empty; badges still count all time. Pinned by Task 3 (`new season day one`) and Task 6.
- **An inactive athlete with nothing owed and no presence for 13 months**: absent from the picker list, still readable by URL while the access lives. Pinned by Task 2.
- **A Școala abonament fully used** and a club month overpaid by a correction: "Ședința 8/8", Rămas 0, "Avans: <x> RON". Pinned by Task 7.

---

## File Structure

```
src/club/portal/sportiv/
  api-types.ts     copy of the index types (T1)
  views.ts         toHome, toHistoryRow, toCalendarItem, toPaymentRow, toTicket, FORBIDDEN_KEYS, forbiddenKeysIn (T1)
  context.ts       sportivContext(strapi, holder) (T1)
  competitions.ts  CompetitionSource, nullCompetitions (T1)
  me.ts            readMe, saveMe, saveNotifications, changePassword, listDevices, revokeDevice (T2)
  athletes.ts      readAthletes, inPicker (T2)
  months.ts        monthBars (T3)
  level.ts         mainGroupNow, levelOf, promotionFor (T3)
  home.ts          readHome, markPromotionSeen (T3)
  history.ts       readHistory, readProfile (T4)
  calendar.ts      ownItems, readCalendar (T5)
  ics.ts           toIcs (T5)
  path.ts          nextLevel, earlierLevels, readPath (T6)
  badges.ts        badges (T6)
  money.ts         readMoney, readPayments, readSubscriptions, readAcord (T7)
src/api/portal/routes/03-sportiv.ts, controllers/sportiv.ts (T9)
```

---

### Task 1: Types, views, forbidden keys, context (high, Sonnet)

**Files:**
- Create: `src/club/portal/sportiv/{api-types,views,context,competitions}.ts`
- Test: `src/club/portal/sportiv/__tests__/views.test.ts`, `sportiv-seed.ts` (fake store seed of the index fixture)

**Interfaces:**
- Consumes: `HolderState` (7-1 T4); `strapiPresenceStore`, `strapiGroupStore`, `strapiClubStore`, `strapiPortalStore`, `AccessStore`.
- Produces:

```ts
export type SportivContext = { holder: HolderState; today: string; presence: PresenceStore; groups: GroupStore; club: ClubStore; portal: PortalStore; access: AccessStore; competitions: CompetitionSource; calendar: () => Promise<CalendarWindow> };
export function sportivContext(strapi: Core.Strapi, holder: HolderState): SportivContext;
export interface CompetitionSource {
  forAthlete(athleteId: string): Promise<{ slug: string } | null>; // performance or not
  last(athleteId: string): Promise<LastCompetition | null>;
  count(athleteId: string): Promise<{ count: number; dates: string[] } | null>; // event dates oldest first, for badge tiers
}
export const nullCompetitions: CompetitionSource; // every method null
export const FORBIDDEN_KEYS: readonly string[];
export function forbiddenKeysIn(value: unknown, allow?: readonly string[]): string[]; // dotted paths
```
`api-types.ts` is the index block verbatim.

- [ ] **Step 1: Failing tests.** `forbiddenKeysIn({ a: { notes: 'x' } })` -> `['a.notes']`; with `allow: ['items.*.note']`, a calendar item `note` passes and a payment `note` fails; each `to*` view given a store row carrying every forbidden key returns an object with exactly the contract keys (`Object.keys` compared sorted).
- [ ] **Step 2: Run** `npx vitest run src/club/portal/sportiv/__tests__/views.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `api-types.ts` imports nothing.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/sportiv && git commit -m "feat(portal): sportiv types, views and context"`

### Task 2: Me, settings, devices, athletes and picker (high, Sonnet)

**Files:**
- Create: `src/club/portal/sportiv/{me,athletes}.ts`
- Test: `src/club/portal/sportiv/__tests__/me.test.ts`, `athletes.test.ts`

**Interfaces:**
- Consumes: phase 6 `changePassword` and device helpers of `coach/me.ts` (extract the host-neutral parts to `src/club/portal/me-shared.ts`; coach `me.ts` calls them, its tests stay green).
- Produces: `readMe(c): Promise<SportivMe>`, `saveMe(c, body)`, `saveNotifications(c, body)`, `changePassword(c, body)`, `listDevices(c, deviceKey)`, `revokeDevice(c, id)`, `readAthletes(c): Promise<SportivAthletes>`, `inPicker(a: { status: string }, owes: boolean, lastPresence: string | null, today: string): boolean`.

- [ ] **Step 1: Failing tests.** `saveMe({ name: '  Maria Ionescu ', phone: '0712 000 111' })` stores trimmed name, toast "Salvat."; name `''` or 81 characters -> 400 "Numele trebuie să aibă între 1 și 80 de caractere."; body with `email` -> e-mail unchanged. `saveNotifications({ schedule: false })` stores false. `readMe` `devices` counts only sportiv devices not revoked. `changePassword` sets `passwordChangedAt`. `inPicker`: `activ` true; `inactiv` with owes false and last presence 13 months ago false; 11 months ago true; owes true true. `readAthletes` rows sorted by name, `performance` from `competitions.forAthlete` (null source -> false), `age` null without birth date, `firstName` from `firstName` else the first word of `name`.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/sportiv/__tests__/me.test.ts src/club/portal/sportiv/__tests__/athletes.test.ts src/club/portal/coach/__tests__/me.test.ts`. Expected: new FAIL, coach PASS.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal && git commit -m "feat(portal): sportiv settings, devices and athlete list"`

### Task 3: Acasă and the promotion moment (high, Sonnet)

**Files:**
- Create: `src/club/portal/sportiv/{months,level,home}.ts`
- Test: `src/club/portal/sportiv/__tests__/months.test.ts`, `level.test.ts`, `home.test.ts`

**Interfaces:**
- Consumes: `mainGroupToday` [code src/club/presence/due/settlement.ts], `ownItems` (T5; Task 3 may land first: then `home.ts` imports a stub `upcoming` that T5 replaces, noted in the ledger), `athleteSubscriptions`, `CompetitionSource.last`, `AccessStore.setLevelSeen`.
- Produces:

```ts
export function monthBars(seasonStart: string, today: string, counts: Map<string, number>): MonthBar[]; // spec 6.3, six months
export function levelOf(group: GroupRecord, section: SectionRecord, location: string | null): Level;
export function promotionFor(seen: string | null, now: GroupRecord | null, groups: GroupRecord[], sections: SectionRecord[]): { promotion: Promotion | null; store: string | null }; // store = value to write silently, null = nothing
export async function readHome(c: SportivContext, athleteId: string): Promise<SportivHome>;
export async function markPromotionSeen(c: SportivContext, athleteId: string): Promise<{ ok: true }>;
```

- [ ] **Step 1: Failing tests.** `monthBars('2026-09-01','2026-11-07', {2026-09:7, 2026-10:8, 2026-11:6})` -> months sep to feb with states past, past, current, future x3 and counts 7, 8, 6, null x3; on `2027-03-15` the window starts at 2026-12. `new season day one`: season start today -> first bar current with count 0. `promotionFor(null, G1)` -> `{ promotion: null, store: 'G1' }`; seen G1, now G2 same section higher `order` -> promotion `{ from: 'Intermediari Bronze', to: 'Intermediari Silver' }`, store null; seen G2, now G1 (lower) -> no promotion, store G1; Școala group to a Club group -> promotion. `readHome` with the seed: `presences.total` 26 (group rows plus present lessons, uscat included), `upcoming` the next 3 own items from now (a cancelled one skipped), `abonament.next` 5 when 4 used of 8, 8 when 8 used of 8, `abonament.code` null when the field does not exist, `lastCompetition` null with the null source, `level.location` the section location name; inactive athlete -> `athlete.inactive` true and `upcoming` empty. `markPromotionSeen` writes the current main group; a second `readHome` returns `promotion: null`.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/sportiv/__tests__/months.test.ts src/club/portal/sportiv/__tests__/level.test.ts src/club/portal/sportiv/__tests__/home.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `readHome` writes the silent `store` value in the same request (no transaction needed: one row update).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/sportiv && git commit -m "feat(portal): sportiv Acasă and the promotion moment"`

### Task 4: Istoric and Date sportiv (high, Haiku)

**Files:**
- Create: `src/club/portal/sportiv/history.ts`
- Test: `src/club/portal/sportiv/__tests__/history.test.ts`

**Interfaces:**
- Consumes: presence store reads by athlete (attendance rows with session, lessons); `ageFromIso`.
- Produces: `readHistory(c, athleteId, page: unknown): Promise<SportivHistory>`, `readProfile(c, athleteId): Promise<SportivProfile>`.

- [ ] **Step 1: Failing tests.** Seed of 26 presences (22 group with 2 uscat, 4 lessons): `total` 26, `group` 22, `individual` 4; page 1 has 10 rows newest first, a lesson row `kind: 'Individual'`, `groupName: null`; page 3 has 6 rows; page 4 -> empty rows, `page` 4; page `'x'` -> 1. Only the current season. A visitor row on another group is still the athlete's own presence and counts (it is his). Coach names only, no ids. `readProfile` returns the six fields and no `notes`, `status`, `dataIncomplete`.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/sportiv/__tests__/history.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/sportiv && git commit -m "feat(portal): sportiv history and athlete data"`

### Task 5: Calendar and the phone calendar file (high, Sonnet)

**Files:**
- Create: `src/club/portal/sportiv/{calendar,ics}.ts`
- Test: `src/club/portal/sportiv/__tests__/calendar.test.ts`, `ics.test.ts`

**Interfaces:**
- Consumes: `expandOccurrences` [code src/api/calendar-event/services/expand.ts], `calendarRows` [code src/club/groups/occurrences.ts], memberships, lessons.
- Produces:

```ts
export function ownItems(i: { occurrences: Occurrence[]; memberships: MembershipRow[]; lessons: LessonRow[]; groups: GroupRecord[]; athleteId: string; from: string; to: string }): CalendarItem[]; // sorted by date, time
export async function readCalendar(c: SportivContext, athleteId: string, month: unknown): Promise<AdminResult<SportivCalendar>>;
export function toIcs(items: CalendarItem[], now: Date, athleteFirstName: string): string;
```

- [ ] **Step 1: Failing tests.** An occurrence of the athlete's group on a day his membership does not cover (before `from`) is left out; a cancelled occurrence comes with `cancelled: true` and its `note`; a `concurs` event linked to his group appears with kind `concurs`; a `concurs` of another group does not; planned and saved lessons appear as `individual` with title "lecție individuală"; another child's lesson never appears. `readCalendar` month outside the season -> 400 "Cerere invalidă."; `prevMonth` null on the first season month. `toIcs`: starts `BEGIN:VCALENDAR`, `VERSION:2.0`, has `TZID=Europe/Bucharest`, one `VEVENT` per not-cancelled item from today to season end, at most 300, `UID:grupa-<id>-<date>@edusport`, `SUMMARY:Intermediari Bronze`, lines folded at 75 octets, CRLF line ends; a text with a comma is escaped `\,`.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/sportiv/__tests__/calendar.test.ts src/club/portal/sportiv/__tests__/ics.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/sportiv && git commit -m "feat(portal): sportiv calendar and ics file"`

### Task 6: Parcurs and badges (low, Sonnet)

**Files:**
- Create: `src/club/portal/sportiv/{path,badges}.ts`
- Test: `src/club/portal/sportiv/__tests__/path.test.ts`, `badges.test.ts`

**Interfaces:**
- Consumes: `levelOf` (T3), `programText` [code src/club/groups/program-text.ts], `CompetitionSource.count`.
- Produces:

```ts
export function nextLevel(now: GroupRecord, groups: GroupRecord[]): GroupRecord | null; // same section, active, next higher order
export function earlierLevels(memberships: MembershipRow[], seasons: SeasonRow[], groups: GroupRecord[], currentId: string | null): { groupName: string; from: string; to: string }[];
export type BadgeInput = { presenceDates: string[]; competitions: { count: number; dates: string[] } | null; seasons: { months: string[]; presentMonths: Set<string>; finished: boolean }[] };
export function badges(i: BadgeInput): Badge[]; // order antrenamente, sezon, prima, concursuri
export async function readPath(c: SportivContext, athleteId: string): Promise<SportivPath>;
```

- [ ] **Step 1: Failing tests.** 24 presences -> antrenamente `tier: null`, `label` "Antrenamente", `next` 25; 25 -> bronze, label "25 antrenamente", `tiers[0].reachedOn` = the 25th date; 63 -> silver, `next` 100; 250 -> platinum, `next` null. Concursuri null source -> `tier: null`, label "Concursuri", count 0; 1 -> bronze "1 concurs"; 5 -> gold "5 concursuri"; 25 -> ice. Sezon complet: a finished season with 9 session months all present -> bronze; one month missing -> none; 5 session months all present -> none; unfinished season never counts; two seasons -> silver. Prima lecție: first presence date as `reachedOn`, tier bronze; no presence -> `tier: null`. `nextLevel` skips inactive groups and other sections; none -> null. `earlierLevels` merges two consecutive memberships of one group in one season, newest first, formats from and to as `YYYY-MM`. `readPath.now.program` "Marți și joi, 17:30, cu Alina Gheorghe" from the seed.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/sportiv/__tests__/path.test.ts src/club/portal/sportiv/__tests__/badges.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/sportiv && git commit -m "feat(portal): sportiv path and badges"`

### Task 7: Money, payments, abonament, registration PDF (high, Sonnet)

**Files:**
- Create: `src/club/portal/sportiv/money.ts`
- Modify: `src/club/documents/storage.ts` (export the read of one stored document by registration and kind if not exported)
- Test: `src/club/portal/sportiv/__tests__/money.test.ts`

**Interfaces:**
- Consumes: `athletePayments` [code presence/payments/reads.ts], `athleteSubscriptions` [code presence/subscriptions/reads.ts], `clubMonths`, `schoolDue` [code presence/due/settlement.ts], document storage.
- Produces: `readMoney(c, athleteId): Promise<SportivMoney>`, `readPayments(c, athleteId, page): Promise<SportivPayments>`, `readSubscriptions(c, athleteId): Promise<SportivSubscriptions>`, `readAcord(c, athleteId): Promise<AdminResult<{ fileName: string; data: Buffer }>>`, `paymentWhat(p: PaymentRowView): string`.

- [ ] **Step 1: Failing tests.** Club month with 150 left on group "Club Performanță" -> line `{ text: 'Club Performanță noiembrie', amount: 150 }`; an "inclus" session adds nothing and no line; a group without a price list adds nothing; Școala unpaid abonament 320 -> "Abonament Școala noiembrie"; unpaid lesson -> "Lecție 12 noi"; paid above due -> `left` 0 and `advance` the difference; nothing -> `left` 0, `lines` []. `paymentWhat`: abonament -> "Abonament <luna>" from the abonament start month, lesson -> "Lecție <d mmm>", club_luna -> "Club <luna>", cotizatie -> "Cotizație <sezon>", altceva -> "Altă plată". Cancelled payments absent; methods mapped to "numerar", "card", "transfer"; 10 per page newest first. `readSubscriptions.active.used` = the dates that used its slots, oldest first; `earlier` only the last 12 months, cancelled left out. `readAcord`: the current-season registration's `acord` file; none -> 404 "Nu a fost găsit."; an older season's file never returned. `forbiddenKeysIn` of each answer is empty.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/sportiv/__tests__/money.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/sportiv src/club/documents && git commit -m "feat(portal): sportiv money, payments, abonament and registration PDF"`

### Task 8: Schedule-mail switch (low, Haiku)

**Files:**
- Modify: `src/club/groups/schedule-mail.ts` (`recipients` takes the set of athlete ids whose access account has `notifySchedule` false), its caller in `src/club/groups/program-dates.ts`
- Test: `src/club/groups/__tests__/schedule-mail.test.ts` (extend)

**Interfaces:**
- Produces: `recipients(athletes, memberships, groupId, seasonId, muted: ReadonlySet<string>): string[]`.

- [ ] **Step 1: Failing test.** Two members, one muted -> one address; muted set empty -> phase 4 result unchanged; the address of a live access equals the athlete e-mail (spec 11.3), so no other address source is added.
- [ ] **Step 2: Run** `npx vitest run src/club/groups/__tests__/schedule-mail.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**; the caller reads the muted ids with one query (`athlete_accesses` live join `portal_accounts.notify_schedule = false`).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/groups && git commit -m "feat(groups): schedule mails honour the holder's switch"`

### Task 9: Routes, controller, host and access matrix (high, Sonnet)

**Files:**
- Create: `src/api/portal/routes/03-sportiv.ts`, `src/api/portal/controllers/sportiv.ts`
- Test: `src/club/portal/sportiv/__tests__/sportiv-routes.test.ts`, `matrix.test.ts`

**Interfaces:**
- Consumes: every reader above; `holdsAthlete`, `NO_ACCESS` (7-1 T4); `pdfHeaders` [code documents/requests.ts].
- Produces: `withAthlete(ctx, run: (c: SportivContext, athleteId: string) => Promise<unknown>)`, the route table of the index.

- [ ] **Step 1: Failing tests.** Source reading: every route has `auth: false` and `policies: ['global::is-sportiv']`; `/me/*` and `/athletes` before `/athletes/:athleteId/*`; `calendar.ics` before any `:param` sibling; no file under `src/club/portal/sportiv/` imports `money-api` values or `billing.ts`. Matrix (fake stores, policy stubbed with a holder of athlete A): `every athlete route refuses a foreign id before reading`: for each `:athleteId` route with B -> 403 `NO_ACCESS` as `ClubAdminError`, and the store spy saw no read with B; a revoked access between two calls -> 403 on the second. Host matrix (real policies over the fake session store): a coach session on each sportiv route -> 403, a sportiv session on each coach route -> 403, a sportiv session on three `/club/*` routes -> 401 or 403. Leak walk: the JSON of every route for the seed has `forbiddenKeysIn(...)` empty (allow list `items.*.note`, `upcoming.*.note`). `.ics` answer has `Content-Type: text/calendar; charset=utf-8`.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/sportiv/__tests__/sportiv-routes.test.ts src/club/portal/sportiv/__tests__/matrix.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/api/portal src/club/portal/sportiv && git commit -m "feat(portal): sportiv routes with access checks"`

### Task 10: Boot check and click-through (low, Haiku)

**Files:**
- Create: `scripts/portal/clickthrough-7-2.sh`

- [ ] **Step 1: Boot** `es72-pg` on 55466, Strapi 1386, fixtures 4 to 7, restart once. Expected: Strapi up, `GET /api/portal/sportiv/me` with the secret and no bearer -> 401.
- [ ] **Step 2: Click-through** `bash scripts/portal/clickthrough-7-2.sh http://127.0.0.1:1386`: log in `parinte1@example.invalid` on `sportiv`; `GET /athletes` lists Ana and Matei; Ana `home` total 26 and `abonament.next` 5; `history?page=3` 6 rows; `calendar` this month; `calendar.ics` starts `BEGIN:VCALENDAR`; `path` badges antrenamente bronze; `money`, `payments`, `subscriptions`; `documents/acord` `%PDF`; Ioana's id -> 403 "Nu mai ai acces la acest sportiv."; `competitions` of Ioana as `sportiv18` -> 404 while the null source is in place (after 7-3 merges, the merged-branch check expects `{ available: false }` with `SKATE_RESULTS_API=http://127.0.0.1:9`). Each prints `OK`.
- [ ] **Step 3: Full suite** in a background worktree `npx vitest run`. Expected: PASS. `docker rm -f es72-pg`.
- [ ] **Step 4: Commit** `git add scripts/portal && git commit -m "chore(portal): phase 7-2 click-through"`
