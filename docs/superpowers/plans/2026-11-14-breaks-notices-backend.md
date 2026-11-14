# Breaks per group, payment purpose list, student notices (backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Payment window "Pentru" grouped with amounts, breaks that apply to chosen groups (with real impact counts and calendar bands), stored student notices (automatic and hand-written) with per-account dismissal and an admin history, and calendar/home items that carry `reason` and `movedFrom`.

**Architecture:** Rules stay pure in `src/club/**` (tested with Vitest), admin components stay thin and use `src/admin/ui`. Breaks gain `exceptGroupIds` (null/empty = all groups) read by one rule `breakAppliesTo` inside `expandOccurrences`, so every caller (admin calendar, coach, sportiv, website, presence, schedule mail) follows it without its own change. Notices are stored rows (`portal-notice` + `portal-notice-delivery`) written by one sync (`syncNotices`) that runs from a cron every 15 minutes, on each sportiv notices read (for that account), and after an announcement save; the sportiv app reads and dismisses deliveries, the admin reads the history.

**Tech Stack:** Strapi 5.52.1 (TypeScript), PostgreSQL, React admin (`src/admin`, `src/plugins/component-preview`), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-14-breaks-notices-design.md` (sections 1, 2, 3 backend, 4, 5 backend) plus the coordinator addition of 2026-11-14 ("Către sportivi" tab, quoted in Task 11).

## Global Constraints

- Copy: Romanian, terse, no em or en dash, no middle dot, straight quotes, no emoji. Missing copy is never invented: it is written as the marker `COPY NEEDED: <what>` in the copy module and listed in Open questions.
- Visual: square corners, no pills or circles, no dashed or dotted lines, no red text, no small uppercase eyebrows, no hint lines under inputs (labels, star for required).
- Admin UI only through `src/admin/ui` components and `var(--theme-*)` / `var(--palette-*)` tokens; `node scripts/admin-ui-check.mjs --strict` exits 0.
- Every new admin route is `adminRoute(area)`: breaks `club`, Anunțuri and "Către sportivi" `website`.
- TypeScript, no `any` in new code, functions under 30 lines, complexity under 10, single quotes, semicolons.
- Store pattern: every new store method has a Strapi and a fake implementation and a test; writes inside `store.transaction`; lock order account before notice rows.
- No migration script: every new attribute reads null as its default (`exceptGroupIds` null = all groups; `showOnSite` null = true; `showOnPortal` null = false; `portalGroupIds` null = all groups).
- Tests: behaviour only (no colour, size, position or screenshot assertions). `npx vitest run --maxWorkers=3 <file>` per task; whole suite once at the end with `--maxWorkers=3`.
- Boot checks only on a throwaway Postgres (container `bn-pg-throwaway` on 127.0.0.1:55491, Strapi on port 1351), removed afterwards. Never ports 1337, 1340, 3010, 5432, 55442; never touch `edusport-test-pg`.
- Conventional Commits, no AI attribution, never push, no dependency installs.

## Review Focus

1. A break edited to untick a group that has a "Mută" on a break date: the moved date must still hold and the unticked group's dates must come back as held in Prezență (saved sessions on those dates must not be flagged "în afara programului" afterwards). Test in Task 2.
2. A group created after a break: it is cancelled by the break (null/empty `exceptGroupIds`), and an existing break row read from the database with `exceptGroupIds: null` behaves as "all groups". Test in Task 2.
3. A holder with two athletes, one cancelled session each: one notice, rows named with first names; the same account with one athlete revoked mid-window must stop seeing that child's row on the next sync, and another account must never see or dismiss it (404). Tests in Tasks 9 and 10.
4. Sync run twice with no change creates nothing new (no duplicate notice, no duplicate delivery); a changed set ends the old auto notice and creates one new one. Test in Task 9.
5. An announcement with only "Site" ticked behaves exactly as today on `/announcements/current`, and one with only "Portal sportiv" never reaches the site. Test in Task 7.

## Contract (identical in the backend and frontend plans)

`src/club/portal/sportiv/api-types.ts` (copied verbatim to the frontend `src/lib/portal/sportiv-types.ts`):

```ts
export type MovedFrom = { date: string; startTime: string | null };
export type CalendarItem = {
  date: string; startTime: string | null; endTime: string | null; kind: CalendarKind; title: string; location: string | null; coaches: string[];
  cancelled: boolean; reason: string | null; movedFrom: MovedFrom | null;
};
export type CalendarBand = { title: string; from: string; to: string; kind: 'pauza' | 'eveniment' };
export type SportivCalendar = { month: string; prevMonth: string | null; nextMonth: string | null; items: CalendarItem[]; bands: CalendarBand[] };
export type NoticeRow = { date: string; text: string; reason: string | null };
export type SportivNotice = { id: string; date: string; title: string; body: string | null; rows: NoticeRow[] };
export type SportivNotices = { count: number; notices: SportivNotice[] };
export type NoticeDismissed = { count: number };
```

- Rename: `CalendarItem.note` -> `CalendarItem.reason`. `reason`: on a cancelled item the break name or the cancel note (null when there is none); always null on a held item. `movedFrom`: the planned date and start time of a moved group date or of a lesson whose date or time was changed; null otherwise.
- `SportivHome.upcoming`: the next 3 own items from now, cancelled ones included (before: left out).
- `SportivCalendar.bands` and `CoachCalendar.bands: CalendarBand[]` (coach `api-types.ts`, same `CalendarBand`): every break that applies to at least one of the reader's groups (athlete: groups listing him; coach: own groups) and every multi-day event of those groups, overlapping the month; `from`/`to` are the full span (may run outside the month). `kind`: `pauza` for a break, `eveniment` otherwise.
- Notices, newest `date` first: `GET /portal/sportiv/me/notices` -> `{ data: SportivNotices }`; `POST /portal/sportiv/me/notices/:noticeId/dismiss` -> `{ data: NoticeDismissed }` (the new count), 404 `Nu a fost găsit.` for an id the account has no live delivery of. `id` is a Strapi documentId. Automatic notice: `title` "<n> ședințe anulate" or "<n> ședințe anulate sau mutate" (n = 1: "1 ședință anulată" / "1 ședință anulată sau mutată"), `body` null, `rows` by date. Row `text`: "18:00 Intermediari Bronze" or "18:00 lecție individuală", plus ", Ana" (first name) when the account holds more than one athlete; `reason`: break name, cancel note, "Mutată: Vin 20 noi, 17:00" (where it moved to; row `date` is the planned date) or null. Hand-written notice: `title` and `body` of the announcement, `rows` []. `date`: automatic = the day it was created, hand-written = its start day.
- Portal view (spec 9): `GET /portal/sportiv/me/notices?seen=1` (the Mesaje list is open) also records `seenAt` on the account's delivery of every notice listed, first time only; `GET /portal/sportiv/me/notices` without `seen` (the counter) records nothing. The answer is the same `SportivNotices` either way.

---

### Task 1: "Pentru" options with owed and paid, grouped in the payment window

Risk: low.

**Files:**
- Modify: `src/club/presence/payments/rules.ts` (`PaymentOption`, `option`, the four option builders)
- Modify: `src/club/bani/payment-window.ts`, `src/club/presence/copy/payments.ts`
- Modify: `src/admin/ui/Select.tsx` (prop `triggerHint`), `src/admin/dashboard/bani/PaymentWindow.tsx`
- Test: `src/club/presence/__tests__/payment-rules.test.ts`, `src/club/bani/__tests__/payment-window.test.ts`, `src/club/__tests__/money-ui-source.test.ts`

**Interfaces:**
- Produces: `PaymentOption = { for: PaymentFor; label: string; amount: number | null; isDefault: boolean; owed: number | null; paid: number }` (`amount` stays = `owed`); `optionGroup(o: PaymentOption): 'due' | 'paid' | 'other'`; `optionHint(o: PaymentOption): string | null`; `groupedOptions(options: PaymentOption[]): SelectOption[]`.

- [ ] **Step 1: Failing tests.** In `payment-rules.test.ts`, `paymentOptions carries owed and paid`: an abonament price 600 with a 220 payment gives `{ owed: 380, paid: 220 }`; an unpaid fee 270 gives `{ owed: 270, paid: 0 }`; Altceva gives `{ owed: null, paid: 0 }`. In `payment-window.test.ts`, `groups and hints`:
  ```ts
  expect(optionGroup(abon380)).toBe('due'); expect(optionHint(abon380)).toBe('rămas 380 RON');
  expect(optionHint(fee270)).toBe('270 RON');               // nothing paid yet: the full price
  expect(optionGroup(paidMonth)).toBe('paid'); expect(optionHint(paidMonth)).toBe('achitat');
  expect(optionGroup(altceva)).toBe('other'); expect(optionHint(altceva)).toBe('orice sumă');
  expect(optionGroup(emptyMonth)).toBe('other'); expect(optionHint(emptyMonth)).toBeNull(); // owed 0 and paid 0, or no price
  expect(groupedOptions([altceva, paidMonth, abon380]).map((o) => o.group)).toEqual(['De plată', 'Achitate', 'Altele']);
  ```
  In `money-ui-source.test.ts`, the payment window source renders "Pentru" before the amount field and passes `triggerHint` to its `Select`.
- [ ] **Step 2:** `npx vitest run --maxWorkers=3 src/club/presence/__tests__/payment-rules.test.ts src/club/bani/__tests__/payment-window.test.ts src/club/__tests__/money-ui-source.test.ts` fails.
- [ ] **Step 3: Implement.** `paid` = `paidFor(...)` with the builder's own match; `owed` = the existing left value. Copy in `PAYMENT_COPY`: `groupDue: 'De plată'`, `groupPaid: 'Achitate'`, `groupOther: 'Altele'`, `hintLeft: (n) => \`rămas ${ron(n)}\``, `hintPaid: 'achitat'`, `hintAny: 'orice sumă'`; full price hint is `ron(owed)`. Group rule: `owed > 0` due; `owed === 0 && paid > 0` paid; else other (decided by Claude: an option with nothing owed and nothing paid, or without a price, is "Altele" with no amount). `groupedOptions` is a stable sort by group order due, paid, other with `{ value: optionKey(o.for), label, group, hint }`. `Select` gains `triggerHint?: boolean`: the closed button shows the selected row's `hint` at its end. In `PaymentWindow.tsx`, the "Pentru" field moves right after "Sportiv"; Sumă, Data, Metodă follow; `withOption` is unchanged (choosing a line fills Sumă with what is owed).
- [ ] **Step 4:** the same command passes; `npx tsc --noEmit -p src/admin/tsconfig.json` and `node scripts/admin-ui-check.mjs --strict` exit 0.
- [ ] **Step 5:** `git commit -m "feat(bani): group the Pentru options by what is owed and show the amounts"`

### Task 2: Breaks apply per group (data and expand rule)

Risk: high (every calendar reader).

**Files:**
- Modify: `src/api/calendar-blackout/content-types/calendar-blackout/schema.json` (attribute `exceptGroupIds`: `{ "type": "json" }`; description "Interval în care grupele bifate nu au ședințe")
- Modify: `src/api/calendar-event/services/expand.ts` (`BlackoutRow`, `breakApplies` -> `breakAppliesTo`, `Break`, `breakAt`, `eventOccurrences`, `expandOccurrences`)
- Modify: `src/club/groups/occurrences.ts` (`blackoutView` keeps `exceptGroupIds` for the admin, the public view stays label and dates)
- Modify: `src/club/presence/sessions.ts` (`HeldOccurrence` gains `movedFrom`, see Task 6)
- Test: `src/api/calendar-event/services/__tests__/expand-breaks.test.ts` (create), `src/club/presence/__tests__/sessions.test.ts`

**Interfaces:**
- Produces: `BlackoutRow = { label: string; startDate: string; endDate: string; exceptGroupIds?: string[] | null }`; `export function breakAppliesTo(b: Pick<BlackoutRow, 'exceptGroupIds'>, ev: Pick<CalendarEventRow, 'group' | 'type'>): boolean`; `export const exceptOf = (b: Pick<BlackoutRow, 'exceptGroupIds'>): string[]` (null -> `[]`).

- [ ] **Step 1: Failing tests** in `expand-breaks.test.ts` with two weekly group events (groups `g1`, `g2`) and a break over one week:
  ```ts
  it('a break with no exceptions cancels every group; null counts as none', ...)   // exceptGroupIds: null and [] give the same result
  it('an unticked group keeps its dates', () => {
    const o = expandOccurrences([ev1, ev2], [{ ...BREAK, exceptGroupIds: ['g2'] }], FROM, TO);
    expect(o.filter((x) => x.groupId === 'g1').every((x) => x.status === 'cancelled' && x.cancelReason === 'blackout' && x.note === 'Vacanța')).toBe(true);
    expect(o.filter((x) => x.groupId === 'g2').every((x) => x.status === 'scheduled')).toBe(true);
  });
  it('a moved date on a break day still holds', ...)                               // override stays 'override'
  it('a group created later is covered', ...)                                     // ev3 of g3 not in the list: cancelled
  it('two breaks on one day: the first that applies to the group names it', ...)  // b1 excepts g1, b2 does not: g1 gets b2's label
  it('lessons-free events: a group-less non-scoala event is never cancelled; an old group-less scoala event follows every break', ...)
  ```
  In `sessions.test.ts`: `heldOccurrences` keeps the unticked group's break dates as held.
- [ ] **Step 2:** `npx vitest run --maxWorkers=3 src/api/calendar-event/services/__tests__/expand-breaks.test.ts src/club/presence/__tests__/sessions.test.ts` fails.
- [ ] **Step 3: Implement.** `breakAppliesTo`: an event of a group applies unless its group documentId is in `exceptOf(b)`; a group-less event applies only when `type === 'scoala'` (old unlinked Școala events, unchanged); anything else never. `Break` keeps `except: Set<string>`; `breakAt(breaks, d, ev)` returns the label of the first break covering `d` that applies to `ev`. Update the header comment of `expand.ts` to say "breaks cancel the events of their groups". `blackoutView` in `adminWindow` returns `{ label, startDate, endDate, exceptGroupIds: exceptOf(b) }`; `publicWindow` keeps the old three fields.
- [ ] **Step 4:** the same command passes, plus `npx vitest run --maxWorkers=3 src/club/groups src/club/presence src/club/portal` (the existing callers) passes unchanged.
- [ ] **Step 5:** `git commit -m "feat(calendar): breaks cancel only the groups they apply to"`

### Task 3: Break input, impact counts and the Pauze list figures

Risk: medium.

**Files:**
- Modify: `src/club/groups/breaks.ts`, `src/club/groups/types.ts` (`BreakRecord`), `src/club/groups/strapi-store.ts` (`toBreak`, writes), `src/club/groups/__tests__/fake-group-store.ts`
- Create: `src/club/calendar/break-impact.ts`
- Modify: `src/api/club/routes/07-schedule.ts`, `src/api/club/controllers/schedule.ts`
- Modify: `src/club/groups/copy/calendar-ui.ts` (`PAUZE_COPY`)
- Test: `src/club/groups/__tests__/breaks.test.ts`, `src/club/calendar/__tests__/break-impact.test.ts` (create), `src/club/groups/__tests__/schedule-routes.test.ts`

**Interfaces:**
- Consumes: `breakAppliesTo`, `exceptOf` (Task 2).
- Produces:
  - `BreakRecord = { id: string; label: string; startDate: string; endDate: string; exceptGroupIds: string[] }`; `BreakInput` gains `exceptGroupIds: string[]` (sorted, unique, only ids of existing groups; unknown ids are a 400 `GROUP_ERRORS.invalid`).
  - `type ImpactGroup = { id: string; name: string; sessions: number }`; `type ImpactSection = { id: string; name: string; kind: 'school' | 'club'; groups: ImpactGroup[] }`; `type BreakImpact = { sections: ImpactSection[] }`.
  - `breakImpact(w: CalendarWindow, groups: GroupRecord[], sections: SectionRecord[], from: string, to: string): BreakImpact` (pure): per active group, the count of its occurrences in `from..to` with status `scheduled` expanded WITHOUT breaks (a moved date holds, an exception-cancelled date is not counted); sections in `order`, groups in `order`; sections with no active group left out.
  - `impactTitle(impact: BreakImpact, except: string[]): string`; `groupLine(g: ImpactGroup, ticked: boolean): string`; `breakListLine(impact: BreakImpact, except: string[]): string`.
  - `GET /club/breaks` rows carry `cancels: string` (the list line); `POST /club/breaks/impact` body `{ startDate, endDate }` -> `{ data: BreakImpact }` (area `club`, declared before `/club/breaks/:documentId`).
- [ ] **Step 1: Failing tests.** `break-impact.test.ts`:
  ```ts
  expect(impactTitle(impact, [])).toBe('Se anulează 10 ședințe la 6 din 6 grupe');
  expect(impactTitle(impact, ['g6'])).toBe('Se anulează 8 ședințe la 5 din 6 grupe');
  expect(groupLine({ id: 'g1', name: 'A', sessions: 2 }, true)).toBe('2 ședințe');
  expect(groupLine({ id: 'g1', name: 'A', sessions: 1 }, true)).toBe('1 ședință');
  expect(groupLine({ id: 'g1', name: 'A', sessions: 0 }, true)).toBe('nicio ședință');
  expect(groupLine({ id: 'g1', name: 'A', sessions: 2 }, false)).toBe('rămâne');
  expect(breakListLine(impact, [])).toBe('10 ședințe, toate grupele');
  expect(breakListLine(impact, ['g6'])).toBe('8 ședințe, 5 din 6 grupe');
  it('counts the held dates in the range although a break already covers them (the 0-sessions bug)', ...) // window with the break saved: counts unchanged
  it('a moved date counts, an exception-cancelled date does not, an inactive group is left out', ...)
  ```
  `breaks.test.ts`: `readBreakInput` reads `exceptGroupIds` (sorted, deduplicated; a non-array is refused); updating only the ticks writes one `break-updated` line with `fields.exceptGroupIds` and an unchanged tick set (other order) is `changed: false`. `schedule-routes.test.ts`: `/club/breaks/impact` is `adminRoute('club')` and listed before `/club/breaks/:documentId`.
- [ ] **Step 2:** `npx vitest run --maxWorkers=3 src/club/calendar/__tests__/break-impact.test.ts src/club/groups/__tests__/breaks.test.ts src/club/groups/__tests__/schedule-routes.test.ts` fails.
- [ ] **Step 3: Implement.** Copy in `PAUZE_COPY`: `impactTitle: (n, k, m) => \`Se anulează ${countWords(n, 'ședință', 'ședințe')} la ${k} din ${m} grupe\``, `none: 'nicio ședință'`, `stays: 'rămâne'`, `rest: 'Lecțiile individuale și competițiile rămân.'`, `colCancels: 'Se anulează'`, `allGroups: 'toate grupele'`, `someGroups: (k, m) => \`${k} din ${m} grupe\``, `school: 'Școala de patinaj'`, `club: 'Club'`; remove `hint` ('Nicio ședință a grupelor în aceste zile.'). Counts sum the ticked groups (spec S4). The tick comparison for history uses the sorted arrays, not `===`. The list line is computed in `listBreaks` callers from the same window.
- [ ] **Step 4:** the same command passes.
- [ ] **Step 5:** `git commit -m "feat(pauze): groups per break, real session counts in the dialog and the list"`

### Task 4: Pauze dialog tick tree and list column (admin UI)

Risk: medium.

**Files:**
- Create: `src/club/calendar/group-ticks.ts` (pure tree state), `src/admin/dashboard/GroupTickTree.tsx`
- Modify: `src/admin/dashboard/program/BreakDialog.tsx`, `PauzeSection.tsx`, `useBreaks.ts`; `src/club/calendar/pauze-view.ts` (`BreakDraft` gains `exceptGroupIds`)
- Test: `src/club/calendar/__tests__/group-ticks.test.ts` (create), `src/club/__tests__/phase4-views.test.ts` (source reading)

**Interfaces:**
- Consumes: `BreakImpact`, `impactTitle`, `groupLine` (Task 3).
- Produces: `type TickTree = { sections: { id: string; name: string; groups: { id: string; name: string; sessions?: number }[] }[] }`; `sectionState(s, except: string[]): 'all' | 'none' | 'some'`; `toggleSection(s, except: string[]): string[]`; `toggleGroup(id: string, except: string[]): string[]`; component `GroupTickTree({ tree, except, onChange, counts }: { tree: TickTree; except: string[]; onChange: (except: string[]) => void; counts: boolean })` (also used by Task 7 with `counts={false}`).
- [ ] **Step 1: Failing tests.** `group-ticks.test.ts`: section all ticked -> `'all'`, one group unticked -> `'some'`, all unticked -> `'none'`; `toggleSection` on `'some'` or `'none'` ticks all its groups, on `'all'` unticks all; `toggleGroup` adds or removes one id and keeps the list sorted. Source test: `BreakDialog.tsx` posts to `/api/club/breaks/impact` when both dates are valid, renders `GroupTickTree` with `counts`, shows `PAUZE_COPY.rest`, and no longer references `PAUZE_COPY.hint`; `PauzeSection.tsx` has the `colCancels` column before the row menu.
- [ ] **Step 2:** `npx vitest run --maxWorkers=3 src/club/calendar/__tests__/group-ticks.test.ts src/club/__tests__/phase4-views.test.ts` fails.
- [ ] **Step 3: Implement.** Dialog order: Nume, De la, Până la, then the impact box (title `impactTitle`, two sections with a `Checkbox` with `indeterminate` for `'some'` and the section sum, each group with its `Checkbox` and `groupLine`, last line `PAUZE_COPY.rest`). The impact reloads when either date changes (debounced 300 ms, no request with invalid dates). Phone list: the card's second line becomes `breakPhoneLine(r)` then the `cancels` line. Edit column: keep the existing row menu (Editează, Șterge).
- [ ] **Step 4:** tests pass; `npx tsc --noEmit -p src/admin/tsconfig.json` and `node scripts/admin-ui-check.mjs --strict` exit 0.
- [ ] **Step 5:** `git commit -m "feat(pauze): pick the groups in the break window"`

### Task 5: Multi-day events as one band in the admin month grid

Risk: medium.

**Files:**
- Create: `src/club/calendar/bands.ts`
- Modify: `src/club/calendar/break-days.ts` (remove `breakDaysIn` and `withoutBlackoutSessions` once unused)
- Modify: `src/plugins/component-preview/admin/src/calendar/CalendarView.tsx` (`MonthGrid`), `src/plugins/component-preview/admin/src/ProgramOverviewEditor.tsx`, `src/plugins/component-preview/admin/src/calendar/styles.ts`
- Test: `src/club/calendar/__tests__/bands.test.ts` (create)

**Interfaces:**
- Produces:
  - `type Span = { key: string; title: string; from: string; to: string; kind: 'pauza' | 'eveniment' }`
  - `multiDaySpans(occ: Pick<Occurrence, 'eventId' | 'title' | 'date' | 'oneOff' | 'status'>[]): Span[]`: runs of two or more consecutive dates of the same one-off event (cancelled dates break a run).
  - `breakSpans(b: BlackoutRow[]): Span[]`
  - `type BandPiece = { key: string; title: string; col: number; span: number; lane: number }`; `weekBands(week: string[], spans: Span[]): BandPiece[]`: one piece per span per week row it touches, clipped to the row, `col` 0..6 Monday first, lanes assigned first-fit by `from`, then longer first.
  - `bandsFor(w: CalendarWindow, groupIds: Set<string>, from: string, to: string): CalendarBand[]` (used by Task 6): breaks that apply to at least one id in `groupIds` and multi-day events of those groups, overlapping `from..to`.
- [ ] **Step 1: Failing tests** in `bands.test.ts`:
  ```ts
  expect(weekBands(WEEK_1, [{ key: 'b', title: 'Vacanța', from: '2026-12-20', to: '2027-01-06', kind: 'pauza' }])).toEqual([{ key: 'b', title: 'Vacanța', col: 6, span: 1, lane: 0 }]);
  it('a span over three weeks gives one piece per row, each with the title', ...)
  it('two overlapping spans take two lanes; a later non-overlapping one reuses lane 0', ...)
  it('a three-day competition becomes one span; a weekly series never does', ...)
  it('bandsFor leaves out a break that excepts all the given groups', ...)
  ```
- [ ] **Step 2:** `npx vitest run --maxWorkers=3 src/club/calendar/__tests__/bands.test.ts` fails.
- [ ] **Step 3: Implement.** `MonthGrid` renders, per week row, the `weekBands` pieces above the day chips (grid columns `col + 1` / span `span`, name at the start of each piece, `liber` category tint for `pauza`, the event's category for `eveniment`). `ProgramOverviewEditor` stops removing blackout-cancelled sessions and stops adding per-day break chips: those sessions stay as chips with `cal-ev--cancel` (faded, struck through), sessions of unticked groups stay normal; the days of a multi-day one-off event no longer get a per-day chip. `CompactMonth` (phone) is unchanged.
- [ ] **Step 4:** tests pass; admin `tsc` and `admin-ui-check --strict` exit 0. Manual check (no test): a break over a month boundary and a three-day competition in the general calendar.
- [ ] **Step 5:** `git commit -m "feat(calendar): multi-day events as one band per week in the month grid"`

### Task 6: Sportiv items carry reason and movedFrom; cancelled lessons; Acasă keeps cancelled; bands

Risk: high (sportiv answers, leak tests, contract rename).

**Files:**
- Modify: `src/club/portal/sportiv/api-types.ts`, `views.ts` (`toCalendarItem`, `toHome`, constants), `calendar.ts` (`ownItems`, `readCalendar`), `home.ts` (`upcoming`)
- Modify: `src/club/portal/coach/api-types.ts`, `src/club/portal/coach/calendar.ts` (`readCoachCalendar` adds `bands`)
- Modify: `src/club/presence/types.ts` (`HeldOccurrence.movedFrom`; `LessonWrite` gains `movedFromDate: string | null; movedFromTime: string | null`), `src/club/presence/sessions.ts`, `src/club/presence/lessons/plan.ts` (`editOne`, `oldValues`), `src/club/presence/lessons/delete.ts`, `src/club/presence/lessons/cut.ts`
- Modify: `src/api/individual-lesson/content-types/individual-lesson/schema.json` (`movedFromDate`: date, `movedFromTime`: string)
- Create: `src/api/lesson-cancellation/` (content type `lesson-cancellation`, collection `lesson_cancellations`, hidden in the content manager, no routes: `athleteId` string required, `date` date required, `startTime` string required, `durationMin` integer)
- Modify: `src/club/presence/store.ts`, `strapi-store.ts`, `src/club/presence/__tests__/fake-store.ts` (if named differently, the presence fake store)
- Test: `src/club/portal/sportiv/__tests__/calendar.test.ts`, `home.test.ts`, `views.test.ts`, `matrix.test.ts`; `src/club/presence/__tests__/lesson-plan.test.ts` (or the existing plan test file); presence store parity tests

**Interfaces:**
- Consumes: `bandsFor` (Task 5), `breakAppliesTo` (Task 2).
- Produces: the Contract types; `HeldOccurrence.movedFrom: MovedFrom | null`; presence store `recordLessonCancel(row: { athleteId: string; date: string; startTime: string; durationMin: number }): Promise<void>`, `lessonCancels(q: { athleteId: string; from: string; to: string }): Promise<{ date: string; startTime: string; durationMin: number }[]>`, `pruneLessonCancels(before: string): Promise<number>`.
- [ ] **Step 1: Failing tests.**
  - `calendar.test.ts`: a break-cancelled class has `{ cancelled: true, reason: 'Vacanța de iarnă', movedFrom: null }`; a calendar cancel with note "Gheață ocupată" has `reason: 'Gheață ocupată'`; a moved class (2026-11-18 18:00 -> 2026-11-20 17:00) is held on 2026-11-20 with `movedFrom: { date: '2026-11-18', startTime: '18:00' }`; a lesson moved from 16:00 to 17:00 has `movedFrom: { date, startTime: '16:00' }`; a deleted planned lesson appears as `{ kind: 'individual', cancelled: true, reason: null }` unless a lesson exists again at that date and time (undo); `readCalendar` answers `bands` with the athlete's break and leaves out a break that excepts his group.
  - `home.test.ts`: `upcoming` keeps a cancelled item among the next 3 (before: skipped).
  - `views.test.ts`: `toCalendarItem` drops a `reason` on a held item and keeps `movedFrom` only as `{ date, startTime }`; `SPORTIV_FORBIDDEN_KEYS` still contains `note` and no answer path may carry `note` any more (`SPORTIV_ALLOWED_PATHS` is `[]`; `CALENDAR_NOTE_PATHS`, `HOME_NOTE_PATHS` removed).
  - Lesson plan test: `editOne` changing date or time of a planned lesson stores `movedFromDate/movedFromTime` = the values before (kept when already set, so two edits still show the first planned slot); undo restores them; changing only coaches or duration stores nothing.
  - `delete.ts` test: deleting a planned lesson dated today or later records one lesson cancellation; deleting a saved lesson or a past one records none.
- [ ] **Step 2:** `npx vitest run --maxWorkers=3 src/club/portal/sportiv src/club/presence/__tests__` fails on the new cases.
- [ ] **Step 3: Implement.** Rename old -> new: `CalendarItem.note` -> `CalendarItem.reason`; `CALENDAR_NOTE_PATHS` / `HOME_NOTE_PATHS` -> removed; `SPORTIV_ALLOWED_PATHS` -> `[]`. Row items take `movedFrom` from `held.get(r.occurrenceKey)?.movedFrom`; `heldOccurrences` sets it from `originalDate/originalStartTime` when `status === 'override'`. `followingLocked` (cut) records a cancellation for each deleted planned future lesson. Cancellations older than today are pruned by the existing daily portal purge cron (`config/cron-tasks.ts`, `portalPurge`, add the count to its log line). Coach `CoachCalendar` gains `bands` from `bandsFor(calendar, ownGroupIds, from, to)`; sportiv from the groups listing the athlete on any day of the month.
- [ ] **Step 4:** the same command passes; the matrix leak test still passes for every route.
- [ ] **Step 5:** `git commit -m "feat(sportiv): reason and movedFrom on items, cancelled lessons, bands, Acasă keeps cancelled sessions"`

### Task 7: Announcements for the student portal (data and editor)

Risk: medium.

**Files:**
- Modify: `src/api/announcement/content-types/announcement/schema.json` (`showOnSite` boolean default true, `showOnPortal` boolean default false, `portalGroupIds` json, `portalAuthor` string)
- Modify: `src/api/announcement/controllers/announcement.ts` (`ADMIN_FIELDS`, `current`, `createAnnouncement` sets `portalAuthor` from `adminActor(...)`, new `groups` handler), `src/api/announcement/services/validate-announcement.ts`, `src/api/announcement/routes/02-admin.ts`
- Create: `src/club/anunturi/view.ts` (pure)
- Modify: `src/admin/dashboard/AnuntEditPage.tsx`, `src/admin/dashboard/AnunturiPage.tsx`
- Test: `src/club/anunturi/__tests__/view.test.ts` (create), `src/api/announcement/__tests__/announcement.test.ts` (create), `src/club/__tests__/anunturi-source.test.ts` (create)

**Interfaces:**
- Consumes: `GroupTickTree` (Task 4, `counts={false}`; "Toate grupele" maps to `portalGroupIds: null`).
- Produces: `audienceText(a: { showOnPortal: boolean | null; portalGroupIds: string[] | null }): string` ("Toți" for site-only, "Toate grupele" for the portal with all groups, else `countWords(n, 'grupă', 'grupe')`); `siteFieldsShown(a): boolean` (false only when Portal sportiv is ticked and Site is not); `GET /anunturi/groups` (area `website`) -> `{ data: TickTree }` (sections and active groups, names only).
- [ ] **Step 1: Failing tests.** `view.test.ts`: `audienceText` gives "Toți" for a site-only row (spec 4), "Toate grupele" for the portal with `portalGroupIds: null` (the later addition wins over spec 4's "Toți" there), "2 grupe" for two ids, "1 grupă" for one; null `showOnSite` reads as ticked. `announcement.test.ts` (controller with a fake `strapi.documents`): `current` filters `showOnSite: { $ne: false }` so a portal-only row is never returned and a row with `showOnSite: null` still is; create refuses when neither place is ticked and when `portalGroupIds` is `[]`; a write keeps `portalGroupIds` sorted and unique. Source test: the editor has the sections "Unde apare" (checkboxes "Site", "Portal sportiv") and "Pentru cine" (rendered only when "Portal sportiv" is ticked, `SegmentedControl` "Toate grupele" | "Grupe alese"); "Format", "Text buton", "Link buton" sit inside a `siteFieldsShown` condition; the page has no `ui-hint` element and no `hint=` prop. (The list itself changes in Task 11.)
- [ ] **Step 2:** `npx vitest run --maxWorkers=3 src/club/anunturi src/api/announcement src/club/__tests__/anunturi-source.test.ts` fails.
- [ ] **Step 3: Implement.** The last ticked place cannot be unticked (its checkbox is disabled), so the UI never sends neither; the server refusal texts are `COPY NEEDED: no place ticked` and `COPY NEEDED: no group chosen` (Open questions). Decided by Claude: when only "Portal sportiv" is ticked, also hide "Etichetă mică", "Zile până reapare" and the Umami id row (they act on the site only). Remove every grey hint line on the editor (the `hint` props and the `ui-hint` divs, including the Format and Stare explanations). After a successful create or update with `showOnPortal`, call `safely(() => syncNotices(...), log, 'notices-sync')` (Task 9; wire the call in Task 9 if Task 9 lands later).
- [ ] **Step 4:** tests pass; admin `tsc` and `admin-ui-check --strict` exit 0.
- [ ] **Step 5:** `git commit -m "feat(anunturi): show an announcement on the site, the student portal or both"`

### Task 8: Notice store

Risk: high (new tables, personal data).

**Files:**
- Create: `src/api/portal-notice/content-types/portal-notice/schema.json` (collection `portal_notices`, hidden: `kind` enum `auto|anunt` required; `account` manyToOne `api::portal-account.portal-account`; `announcement` manyToOne `api::announcement.announcement`; `key` string; `title` string; `rows` json; `athleteIds` json; `groupIds` json; `lastDate` date; `endedAt` datetime; `stoppedAt` datetime), with core service/controller and `routes` `only: []`
- Create: `src/api/portal-notice-delivery/content-types/portal-notice-delivery/schema.json` (collection `portal_notice_deliveries`, hidden: `notice` manyToOne portal-notice required; `account` manyToOne portal-account required; `deliveredAt` datetime required; `dismissedAt` datetime)
- Create: `src/club/portal/notices/store.ts`, `strapi-store.ts`, `__tests__/fake-store.ts`, `__tests__/store.test.ts`
- Modify: `src/club/portal/access/store.ts`, `strapi-store.ts`, `fake-store.ts` (`dropNoticesForAthlete`), `src/club/portal/access/lifecycle.ts`, `src/club/portal/purge.ts`
- Test: `src/club/portal/notices/__tests__/store.test.ts`, `src/club/portal/access/__tests__/lifecycle.test.ts` (existing name)

**Interfaces:**
- Produces:
  ```ts
  export type NoticeKind = 'auto' | 'anunt';
  export type NoticeRecord = { id: string; kind: NoticeKind; accountId: string | null; announcementId: string | null; key: string | null; title: string;
    rows: NoticeRow[]; athleteIds: string[]; groupIds: string[]; lastDate: string | null; createdAt: string; endedAt: string | null; stoppedAt: string | null };
  export type DeliveryRecord = { id: string; noticeId: string; accountId: string; deliveredAt: string; dismissedAt: string | null };
  export interface NoticeStore {
    transaction<T>(fn: () => Promise<T>): Promise<T>;
    liveAutoNotice(accountId: string): Promise<NoticeRecord | null>;       // kind auto, endedAt null
    noticeOfAnnouncement(announcementId: string): Promise<NoticeRecord | null>;
    createNotice(n: Omit<NoticeRecord, 'id' | 'createdAt' | 'endedAt' | 'stoppedAt'>, at: string): Promise<string>;
    endNotice(id: string, at: string): Promise<void>;
    stopNotice(id: string, at: string): Promise<void>;
    notices(q: { since?: string }): Promise<NoticeRecord[]>;
    notice(id: string): Promise<NoticeRecord | null>;
    deliveries(q: { noticeId?: string; accountId?: string; open?: boolean }): Promise<DeliveryRecord[]>;
    deliver(noticeId: string, accountIds: string[], at: string): Promise<number>;   // skips accounts already delivered; returns the count created
    dismiss(deliveryId: string, at: string): Promise<void>;
  }
  ```
  `AccessStore.dropNoticesForAthlete(athleteId: string): Promise<void>` (deletes auto notices whose `athleteIds` contain the id, with their deliveries).
- [ ] **Step 1: Failing tests.** `store.test.ts` runs the same cases against the fake (and, like the other `*-pg.test.ts` suites, against Postgres only when its env var is set): `deliver` twice to the same account creates one delivery; `deliveries({ accountId, open: true })` leaves out dismissed ones; `liveAutoNotice` ignores ended notices; `notices({})` newest first. Lifecycle test: deleting, anonymizing or merging away an athlete removes the auto notices that name him and their deliveries, and keeps other accounts' notices. Purge test: a deleted account's deliveries and auto notices go with it.
- [ ] **Step 2:** `npx vitest run --maxWorkers=3 src/club/portal/notices src/club/portal/access` fails.
- [ ] **Step 3: Implement** the Strapi store over `strapi.documents` (`deliver` checks existing rows inside the caller's transaction after `lockAccount`), the fake, and the three lifecycle calls (`endForAthlete` both branches, `moveOnMerge` for `removedId`).
- [ ] **Step 4:** the same command passes.
- [ ] **Step 5:** `git commit -m "feat(portal): notice and delivery store"`

### Task 9: Notice sync (automatic and hand-written) and cron

Risk: high.

**Files:**
- Create: `src/club/portal/notices/auto.ts` (pure rows, title, key), `src/club/portal/notices/sync.ts`, `src/club/portal/notices/copy.ts`
- Modify: `config/cron-tasks.ts` (task `portalNotices`, rule `'*/15 * * * *'`, tz `Europe/Bucharest`, logs counts only)
- Test: `src/club/portal/notices/__tests__/auto.test.ts`, `sync.test.ts` (create)

**Interfaces:**
- Consumes: `ownItems` (Task 6), `NoticeStore` (Task 8), `heldAthleteIds` (`src/club/portal/sportiv/holder.ts`), announcement fields (Task 7).
- Produces:
  - `autoRows(items: { athleteFirstName: string; item: CalendarItem }[], manyAthletes: boolean, today: string): NoticeRow[]`: cancelled items dated today..today+14 and moved items whose planned or new date is in that window, sorted by date then time; moved rows use the planned date and time with reason `NOTICE_COPY.movedTo(date, time)`.
  - `autoTitle(rows: NoticeRow[], anyMoved: boolean): string`; `autoKey(rows: NoticeRow[]): string` (sha256 of the rows JSON, first 16 hex).
  - `syncNotices(c: NoticeSyncContext, scope: { accountId?: string }): Promise<{ created: number; delivered: number; ended: number }>` with `NoticeSyncContext = { notices: NoticeStore; portal: PortalStore; access: AccessStore; sportiv: (holder: HolderState) => SportivContext; now: () => Date; today: string; log: (m: string) => void }`.
- [ ] **Step 1: Failing tests.** `auto.test.ts`:
  ```ts
  expect(autoTitle(rows2, false)).toBe('2 ședințe anulate');
  expect(autoTitle(rows2, true)).toBe('2 ședințe anulate sau mutate');
  expect(autoTitle(rows1, false)).toBe('1 ședință anulată');
  expect(rows[0]).toEqual({ date: '2026-11-18', text: '18:00 Intermediari Bronze, Ana', reason: 'Vacanța de iarnă' });   // two athletes held
  expect(oneAthleteRow.text).toBe('18:00 Intermediari Bronze');
  expect(movedRow).toEqual({ date: '2026-11-18', text: '18:00 Intermediari Bronze', reason: 'Mutată: Vin 20 noi, 17:00' });
  it('leaves out a cancelled date 15 days ahead and yesterday', ...)
  ```
  `sync.test.ts` (fakes, seed with two accounts):
  - first run creates one auto notice and one delivery for the holder with cancellations; a second run with no change creates nothing;
  - a new cancellation ends the old notice and creates one new one (the old delivery is no longer open for reading, Task 10);
  - when every row is past, the auto notice is ended;
  - an active hand-written announcement for group `g1` is delivered to the account holding an athlete in `g1` today and not to the other; "Toate grupele" reaches both; a scheduled (future `startAt`), inactive, stopped or site-only one reaches nobody;
  - an account that gains an athlete in `g1` while the announcement is active gets it on the next run (recipients are recorded at delivery and topped up while active);
  - `scope.accountId` touches only that account.
- [ ] **Step 2:** `npx vitest run --maxWorkers=3 src/club/portal/notices` fails.
- [ ] **Step 3: Implement.** `NOTICE_COPY` (in `copy.ts`): `title`, `titleMoved` via `countWords(n, 'ședință anulată', 'ședințe anulate')` / `countWords(n, 'ședință anulată sau mutată', 'ședințe anulate sau mutate')`; `movedTo: (date, time) => \`Mutată: ${shortDay(date)}, ${time}\`` with `shortDay` = "Vin 20 noi" (weekdays Dum Lun Mar Mie Joi Vin Sâm and months ian feb mar apr mai iun iul aug sep oct noi dec, the portal date-block words; decided by Claude: the spec example "Vi" is written in the portal's three-letter form so the notice matches the date blocks). Each account runs in its own `notices.transaction` after `portal.lockAccount(accountId)`; a failure of one account is logged by code and the next one runs. Accounts in scope: active accounts with at least one live access (no team member). Recipients are recorded at delivery (not computed at read time) so the admin history shows who actually received a message, even after memberships change.
- [ ] **Step 4:** the same command passes.
- [ ] **Step 5:** `git commit -m "feat(portal): write automatic and hand-written notices to the accounts"`

### Task 10: Sportiv notice routes

Risk: high (leak surface).

**Files:**
- Modify: `src/api/portal/routes/04-sportiv.ts` (add `route('GET', '/me/notices', 'notices')` and `route('POST', '/me/notices/:noticeId/dismiss', 'dismissNotice')` with the other `/me/*` paths), `src/api/portal/controllers/sportiv.ts` (both through `own`)
- Create: `src/club/portal/sportiv/notices.ts`
- Modify: `src/club/portal/sportiv/views.ts` (`toNotices`), `src/club/portal/sportiv/context.ts` (adds `notices: NoticeStore`)
- Test: `src/club/portal/sportiv/__tests__/notices.test.ts` (create), `matrix.test.ts`

**Interfaces:**
- Consumes: `syncNotices` (Task 9), Contract types.
- Produces: `readNotices(c: SportivContext): Promise<SportivNotices>` (runs `syncNotices(..., { accountId })` first, then open deliveries of the account whose notice is not ended or stopped and, for `anunt`, whose announcement is still active, still on the portal and still for one of the account's groups); `dismissNotice(c: SportivContext, noticeId: unknown): Promise<AdminResult<NoticeDismissed>>`.
- [ ] **Step 1: Failing tests.** `notices.test.ts`: the answer lists the account's notices newest first with `count` equal to the list length; dismissing one returns `{ count: n - 1 }` and it never comes back (also from a second session of the same account, the dismissal is per account); dismissing an id delivered only to another account, an unknown id or a non-string answers 404 `Nu a fost găsit.` and changes nothing; a hand-written notice whose announcement was edited to "Site" only disappears. `matrix.test.ts`: both routes refuse without the BFF secret or a sportiv session (same matrix as the other `/me/*` routes), and the notices answer passes `forbiddenPathsIn(answer, SPORTIV_FORBIDDEN_KEYS)` and carries no e-mail, no athlete id and no other account's child name.
- [ ] **Step 2:** `npx vitest run --maxWorkers=3 src/club/portal/sportiv/__tests__/notices.test.ts src/club/portal/sportiv/__tests__/matrix.test.ts` fails.
- [ ] **Step 3: Implement** `toNotices` field by field (`id`, `date`, `title`, `body`, `rows` with `date`, `text`, `reason`); `date` = `createdAt` day for auto, `startAt` day (Bucharest) for anunt.
- [ ] **Step 4:** the same command passes.
- [ ] **Step 5:** `git commit -m "feat(sportiv): notices list and dismiss routes"`

### Task 11: Anunțuri: one list with places, automatic messages, recipients and "Oprește"

Risk: medium (personal data on a `website` page).

Coordinator text (binding, 2026-11-14, replaces the spec 4 list columns "Unde"): no tabs. One list for everything: each announcement row shows icons for where it goes (globe = Site, person = Portal sportiv), coloured while active there, grey when scheduled or ended; automatic cancellation/move messages appear in the same list marked "Automat" with only the portal icon; a FilterPanel filter "Unde" (Toate / Site / Portal sportiv). Opening a row: the editor as now; for portal announcements also "Trimis la <n> conturi", "Închis de <n>", the accounts list (e-mail, athletes, closed yes/no with date) and "Oprește". Automatic messages open read-only. Kept from the first addition: Tip "Automat" / "Scris de <admin>", Pentru "Toate grupele" / "<n> grupe", area `website`, no money data, recipients and dismissals recorded with dates.

**Files:**
- Create: `src/club/anunturi/portal-history.ts` (pure views and the stop service), `src/admin/dashboard/anunturi/PortalRecipients.tsx` (the block under the editor), `src/admin/dashboard/anunturi/AutoNoticeView.tsx` (read-only page for an automatic message)
- Modify: `src/admin/ui/icons.tsx` (`IconGlobe`, `IconUser`, same stroke style as the others)
- Modify: `src/api/announcement/routes/02-admin.ts` (`GET /anunturi/portal/:noticeId`, `POST /anunturi/portal/:noticeId/stop`, both `adminRoute('website')`, declared before `/anunturi/:documentId`), `src/api/announcement/controllers/announcement.ts` (`buildRows` merges automatic notices into the list; two handlers)
- Modify: `src/admin/dashboard/AnunturiPage.tsx` (icons, "Automat" rows, `FilterPanel` "Unde"; an automatic row opens `AutoNoticeView`), `src/admin/dashboard/AnuntEditPage.tsx` (renders `PortalRecipients` when `showOnPortal` and the announcement has a notice)
- Test: `src/club/anunturi/__tests__/portal-history.test.ts` (create), `src/club/__tests__/admin-areas.test.ts` (existing), `src/club/__tests__/anunturi-source.test.ts` (from Task 7)

**Interfaces:**
- Consumes: `NoticeStore` (Task 8), `audienceText` (Task 7).
- Produces:
  - `type PlaceState = 'active' | 'waiting' | 'ended' | null` (null = not sent there); `type ListRow = { id: string; source: 'anunt' | 'auto'; title: string; site: PlaceState; portal: PlaceState; kind: string; audience: string }` (`kind` "Automat" or "Scris de <admin>"; the existing announcement row fields stay for `anunt` rows).
  - `placeStates(a, notice: NoticeRecord | null, now: number): { site: PlaceState; portal: PlaceState }` (portal is `ended` once stopped or ended); `filterRows(rows: ListRow[], where: 'toate' | 'site' | 'portal'): ListRow[]`.
  - `type Recipients = { sentTo: string; closedBy: string; stopped: boolean; canStop: boolean; accounts: { email: string; athletes: string[]; closed: boolean; closedAt: string | null }[] }`; `GET /anunturi/portal/:noticeId` -> `{ data: Recipients & { title: string; rows: NoticeRow[]; groups: string[] } }`.
  - `stopNotice(store: NoticeStore, id: string, at: string): Promise<AdminResult<{ stopped: true }>>`.
- [ ] **Step 1: Failing tests.** `portal-history.test.ts`:
  - `placeStates`: a site+portal announcement inside its window gives `{ site: 'active', portal: 'active' }`; before `startAt` `'waiting'` for both; after `endAt` `'ended'`; stopped on the portal gives `portal: 'ended'` while `site` stays `'active'`; a site-only one has `portal: null`; an automatic notice has `site: null` and `portal` `'active'` until ended.
  - `filterRows`: "site" keeps rows with `site !== null`, "portal" keeps rows with `portal !== null` (automatic rows included), "toate" keeps all.
  - list rows: automatic notices appear with `kind: 'Automat'`, newest first among themselves; a hand-written one with `portalAuthor` "Ioana Pop" has `kind: 'Scris de Ioana Pop'`; `audience` "Toate grupele" or "3 grupe" (automatic: the distinct groups of its rows).
  - recipients: `sentTo` "1 cont" / "12 conturi" / "20 de conturi" (`countWords(n, 'cont', 'conturi')`), `closedBy` the count of dismissed deliveries, accounts with e-mail, the names of the athletes the account holds now, `closed` and `closedAt`.
  - `stopNotice` on a hand-written notice sets `stoppedAt` and the sportiv read (Task 10) no longer shows it while the site still does; on an automatic notice it is a 409 and nothing changes; a second stop is a no-op `{ stopped: true }`.
  - Areas test: the two routes are `website`. Source test: `AnunturiPage.tsx` has no `Tabs`, renders a `FilterPanel` with section "Unde" and options "Toate", "Site", "Portal sportiv"; an automatic row has no reorder grip and no delete; `AutoNoticeView.tsx` renders no input.
- [ ] **Step 2:** `npx vitest run --maxWorkers=3 src/club/anunturi src/club/__tests__/admin-areas.test.ts src/club/__tests__/anunturi-source.test.ts` fails.
- [ ] **Step 3: Implement.** Copy: `site: 'Site'`, `portal: 'Portal sportiv'`, `filterWhere: 'Unde'`, `filterAll: 'Toate'`, `auto: 'Automat'`, `by: (name) => \`Scris de ${name}\``, `sentTo: (n) => \`Trimis la ${countWords(n, 'cont', 'conturi')}\``, `closedBy: (n) => \`Închis de ${n}\``, `stop: 'Oprește'`, `allGroups: 'Toate grupele'`. The icons carry `aria-label` "Site" / "Portal sportiv" plus the state word for screen readers (`COPY NEEDED: state words for active, scheduled, ended`); colour comes from theme tokens (active: the accent token used for the live row today; waiting and ended: the muted token). Automatic rows are not reorderable (priority applies to the site only) and sort after the reorderable active site rows, by date. A null `portalAuthor`: `COPY NEEDED: author unknown`. The stop confirmation text, the accounts list headings and the "no recipients yet" line are `COPY NEEDED`. The detail reads never touch payments or prices.
- [ ] **Step 4:** tests pass; admin `tsc` and `admin-ui-check --strict` exit 0.
- [ ] **Step 5:** `git commit -m "feat(anunturi): one list with places, automatic messages and their recipients"`

### Task 12: Boot check and whole-branch verification

Risk: low.

- [ ] **Step 1:** `npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict` exit 0.
- [ ] **Step 2:** `npx vitest run --maxWorkers=3` passes.
- [ ] **Step 3: Boot on a throwaway database.** `docker run -d --name bn-pg-throwaway -e POSTGRES_PASSWORD=throwaway -p 127.0.0.1:55491:5432 postgres:16`, then `npm run build` and start Strapi with `PORT=1351 DATABASE_HOST=127.0.0.1 DATABASE_PORT=55491 DATABASE_PASSWORD=throwaway` (other `DATABASE_*` from `.env.example`). Expected: Strapi starts, the tables `portal_notices`, `portal_notice_deliveries`, `lesson_cancellations` exist, `calendar_blackouts.except_group_ids` and the four announcement columns exist, and the `portalNotices` cron logs one run within 15 minutes or on a manual trigger. Then `docker rm -f bn-pg-throwaway` and stop Strapi.
- [ ] **Step 4:** add a "Breaks and notices" entry to `docs/HANDOFF.md` (branch, contract rename `note` -> `reason`, deploy order: backend and frontend together, because the frontend reads `reason`). Commit `docs(handoff): breaks per group and student notices`.

## Open questions (for the user)

1. The portal month grids (sportiv and coach) are compact day-mark grids without event names, and the coach calendar shows no breaks today. Add the labelled band strip there (plan default, frontend Task 3 and the `bands` fields), or leave the portal grids as they are?
2. Opening a portal announcement shows parents' e-mails and children's names. Keep that list on the `website` area (as asked), or show the accounts list only to `club` admins?
3. Copy marked `COPY NEEDED`: empty "Mesaje" list; failed dismiss toast; refusals "no place ticked" and "no group chosen"; "Oprește" confirmation; accounts list headings and "no recipients yet"; author unknown; the state words of the place icons (active, scheduled, ended).
