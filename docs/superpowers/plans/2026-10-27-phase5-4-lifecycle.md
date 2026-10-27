# Phase 5-4: Lifecycle (inactivity, export, delete, merge, anonymize, new season) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the phase 3 and 3C athlete lifecycle aware of phase 5 data: the inactivity rule counts attendance, lessons, payments and abonamente; "Exportă datele" includes them with four new summary PDF sections; "Șterge sportivul" is refused (409) while payments or abonamente exist and otherwise removes attendance and lessons; "Unește" moves every presence and money row without a double slot; "Anonimizează" keeps every money row and clears payment notes, payment e-mails and their Istoric values; "Începe sezonul" stays unchanged and pinned by tests.

**Architecture:** New rules live in `src/club/presence/lifecycle/` (pure planners plus small store-driven helpers) and `src/club/presence/copy/lifecycle.ts`; the existing services (`athletes/delete.ts`, `athletes/merge.ts`, `personal-data/*`) call them. Those services run on `ClubStore`; the presence rows are reached through a second store, `PresenceStore` (plan 5-1), passed in explicitly. Every write action runs the whole work inside `club.transaction(() => presence.transaction(work))` (index "Cross-store": Strapi reuses the outer transaction; in the fakes both states roll back together because the work runs inside both). Locks keep spec 7.1: the existing P3 registration and athlete locks first, then lessons, subscriptions, payments (each sorted); sessions are never locked here.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS), Postgres 16, Vitest 3, pdfkit, Node 22.

**Spec:** `docs/superpowers/specs/2026-10-27-attendance-payments-design.md` (v1, approved 2026-10-27): 4.20, 4.21, 4.21a, 4.23, 5.14 (copy and the 409 only; the dialog is plan 5-6), 6 (athlete delete 409), 7.1 (Delete / merge line), 7.2, 8 ("no address after anonymize"), 11.1 (4.20, 4.21 bullets), 11.4 (delete, anonymize, inactivity bullets). Index: `docs/superpowers/plans/2026-10-27-phase5-index.md` ("Shared interfaces" binding for names). Foundation consumed: `docs/superpowers/plans/2026-10-27-phase5-1-presence-foundation.md`. 3C spec for the scrub rules: `docs/superpowers/specs/2026-10-27-personal-data-design.md`. Decisions: `../edusport_frontend/docs/portal/DECISIONS.md`.

**Base:** `feat/athletes` with plan 5-1 merged.

**Parallel groups:** A: T1, T2 | B: T3 | C: T4, T5 | D: T6

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Inactivity and new season, 2 Export and summary PDF | 5-1 | 1: `lifecycle/activity.ts`, `personal-data/inactivity.ts`, `review.ts`, controller `personal-data` handlers `inactiveSummary` / `hideReview`; 2: `lifecycle/export-rows.ts`, `copy/lifecycle.ts` (created), `copy.ts` line, `export-service.ts`, `summary-model.ts`, `personal-data/http.ts` (`exportContext`) |
| B | 3 Delete refusal | 2 | `lifecycle/transaction.ts`, `delete-guard.ts`, `http.ts`, `copy/lifecycle.ts` (appends), `athletes/delete.ts`, controller `athletes.remove` |
| C | 4 Merge, 5 Anonymize | 3 (and 2 for 5) | 4: `lifecycle/merge-plan.ts`, `merge-rows.ts`, `athletes/merge.ts`, controller `athletes.merge`; 5: `lifecycle/anonymize-rows.ts`, `anonymize-service.ts`, `personal-data/http.ts` (`anonymizeContext`), `athletes/store.ts`, `strapi-store.ts`, `__tests__/fake-store.ts` (one method) |
| D | 6 Boot check | everything | no committed file |

Risk: **high** on every task (delete, merge, anonymize, money rows, locks, personal data). Per-task reviews run on all six.

## Decided while planning (low impact, decided by Claude; the user may overrule any line)

Log them in DECISIONS.md as "plan 5-4, decided by Claude (low impact, 2026-10-27)". Each is implemented in the one place named.

1. **Presence store passed in, not built in the services.** `deleteAthlete`, `mergeAthletes` take a third argument `presence: PresenceStore`; `ExportContext` and `AnonymizeContext` gain `presence`; the review functions take it as an argument. Controllers build it with `strapiPresenceStore(strapi)` (`delete.ts`, `merge.ts`, `personal-data/http.ts`, `review.ts`).
2. **One nesting for both stores.** `inBothTransactions(club, presence, work)` = `club.transaction(() => presence.transaction(work))`; every write of this plan uses it so a failure anywhere rolls back both fake states and the one Strapi transaction (`lifecycle/transaction.ts`).
3. **No session locks in delete or merge.** Spec 7.1 has a session save lock its session and then athletes; delete and merge hold athletes, so locking a session after them could close a cycle. Attendance rows are changed by id under the athlete locks only (`delete-guard.ts`, `merge-rows.ts`).
4. **Delete answer shape.** The service answers `{ ok: true, data: { deleted: false, blocked: { payments, subscriptions } } }` when refused (nothing written); `respondDelete` turns it into HTTP 409 `{ data: { payments, subscriptions }, error: { status: 409, name: 'ClubAdminError', message: <refusal sentence> } }`; a delete answers `{ data: { documentId } }` as before (`lifecycle/http.ts`). Counts include cancelled rows (C37).
5. **Merged attendance row** (C38): ticks are the union; `subscriptionId` = the kept row's, else the removed row's; Școala billing `slot` with a subscription else `fara_abonament`; Club charges per type taken from the kept row, else the removed row; `amount` = sum of lines not included and priced; billing `club` when one line is billable, else `inclus` when one line is included, else `fara_pret` (5-1 decided 9); `visitor` only when both were visitors; `audience` and `uniqueKey` the kept row's. Removed rows at other sessions get `uniqueKey = attendanceKey(sessionId, keptId)` (`merge-plan.ts`).
6. **Session Istoric after a merge.** Session lines keep the removed athlete's id and read "Sportiv șters" from then on; they are not rewritten (`merge-rows.ts` writes nothing to history).
7. **Payment notes in Istoric.** `payment-edited` lines store `fields.note.{from,to}`; `note` is not a 3C personal key, so anonymize scrubs those pairs with `scrubPaymentChanges`, on the payment subject lines of the child's payments, and leaves `HISTORY_PERSONAL_KEYS` unchanged (`lifecycle/anonymize-rows.ts`).
8. **Payment e-mail jobs scrubbed by payment link**, not by address (the contact e-mail may have changed since): new `ClubStore.scrubPaymentEmailJobs(paymentIds)` nulls `recipient`, `subject`, `lastError` and `payload` (it holds the child's name), queued jobs become `cancelled` (P3C 4) (`athletes/store.ts`, `strapi-store.ts`, fake).
9. **Inactivity input stays backward compatible:** `InactivityInput.activity` is optional, so callers that do not pass it (the Sportivi list, plan 5-3's file) still compile; lessons count only with `present === true`, payments only when not cancelled, subscriptions always (spec names no filter) (`inactivity.ts`, `activity.ts`).
10. **Export row order:** newest first in each of the four sections, like the existing groups and Istoric sections (`export-rows.ts`).
11. **Export lines where spec 4.21a is silent:** a planned lesson has no presence word and no amount; a present lesson without price shows no amount; one coach "antrenor <nume>", several "antrenori <nume> și <nume>", none: the part is left out; a payment note is appended as ", Notă: <text>" before ", anulată"; payment "Pentru" text: abonament -> the subscription's item name ("Abonament 8 ședințe"), cotizatie -> "Cotizație membru <sezon>", club_luna -> "Club, <lună> <an>" ("Club, octombrie 2026"), lectie -> "Lecție individuală", altceva -> "Altceva" (`copy/lifecycle.ts`, `export-rows.ts`).
12. **Summary rows** carry the whole spec line as the value with an empty label (as the existing footer and "Nimic înregistrat." rows); `summary-pdf.ts` is not changed, only read back in a test.
13. **Boot data** for this check is a throwaway script in `$T`, never committed (Task 6).

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes`. Commit only in the worktree your dispatch names (never in p3be or p3fe); before every commit run `git rev-parse --show-toplevel` and `git branch --show-current` and compare with the dispatch.
- A dated DECISIONS.md entry wins over the spec; the spec wins over this plan's prose.
- Checks after every task: the task's test files (`npx vitest run <files>`), the full suite (`npx vitest run`), `npx tsc --noEmit` (zero errors).
- Code: TypeScript, no `any`, single quotes, semicolons, 2-space indent, functions under 30 lines, cyclomatic complexity under 10, no dead code, no comments that restate code.
- Files: those the index gives 5-4, plus (no other phase 5 plan edits them) `personal-data/review.ts`, `personal-data/http.ts`, `controllers/personal-data.ts` (handlers `inactiveSummary`, `hideReview`), one method in `athletes/store.ts`, `strapi-store.ts`, `__tests__/fake-store.ts`, and the existing tests of the services changed; `controllers/athletes.ts`: handlers `remove` (T3) and `merge` (T4) only. Never `athletes/list.ts` or the `list` handler (plan 5-3).
- Lock order (spec 7.1, binding): registrations, athletes (sorted), lessons, subscriptions (sorted), payments (sorted); re-read after locking; never lock outside a transaction.
- Every write action is one transaction (decided 2); failure answers 500 "Acțiunea nu a reușit. Nimic nu a fost salvat." through `guarded`; every write keeps its existing Istoric line.
- Money rows (spec 2.3): a payment or subscription row is never deleted by this plan; amount, method, `paidOn`, season, purpose and links never change on anonymize.
- Copy: every new string in `src/club/presence/copy/lifecycle.ts`, exactly as spec 4.21a and 5.14 give it; ș and ț with the comma below; straight quotes; no em or en dash, no middle dot, no emoji; number forms through `countWords` (`src/club/ro-count.ts`).
- Privacy (DEC 2026-10-27 3C 1): an export never names another child; an anonymized child's name, contact and notes appear nowhere in the database after "Anonimizează".
- Synthetic data only. Never touch production, `strapi_app`, `strapi_db`, `edusport-test-pg`, ports 1337, 1340, 3010, 5432, 55442. Task 6 uses container `es54-pg` on 127.0.0.1:55454 and Strapi on 1374.
- Commits: Conventional Commits, the message given in the task, no `Co-Authored-By`, no AI attribution (check with `git log -1 --format=%B`). Never push. Never commit `.env`.
- Progress board: one line per status change to `/Users/codrin/Documents/Programming/edusport_backend/.superpowers/phase3-shared/progress-board.md`, e.g. `printf '%s | 5-4 T3 | implementer | tests green\n' "$(date -u +%H:%M)" >> <that path>`.

## Review Focus

- **The export of a child who trained next to other children** (shared sessions, a visitor row, a merged record): the four sections hold only this child's rows, dates, group names, coach names and amounts; no other athlete's name appears anywhere in the summary, the Istoric section included. Pinned by Task 2 (`never names another child`) and Task 6 (grep of `rezumat.pdf`).
- **Anonymize of a child with payments, a payment note, a sent and a queued "Plată înregistrată" e-mail and an edited note in Istoric:** every payment row stays with amount, date, method, season, purpose, links and `cancelled`; `note` is null; both jobs lose recipient, subject and payload (queued -> cancelled, sent stays sent); the Istoric pairs and the `recipient` are null; attendance, lessons and subscriptions are untouched. Pinned by Task 5 and Task 6 (`pg_dump` search finds nothing).
- **Delete while a money row exists, including only a cancelled payment or only a cancelled abonament:** 409 with the counts, nothing written, the athlete, its groups and attendance still there; with neither, attendance rows and lessons go and the session rows stay. Pinned by Task 3 and Task 6.
- **Merge of two records present at the same session, both on an abonament slot:** one row remains, ticks united, the kept row's slot used, the removed row's slot free again (used count down by one); no second row for one athlete at one session (`uniqueKey` rekeyed); every lesson, subscription and payment (cancelled too) now belongs to the kept athlete. Pinned by Task 4.
- **An athlete whose only recent activity is phase 5 data** (a visitor attendance, a payment in a season with no membership, a lesson marked absent, a cancelled payment): attendance and a non-cancelled payment keep the child off "Inactivi de peste N ani"; an absent lesson or a cancelled payment do not. Pinned by Task 1.

---

## File Structure

```
src/club/presence/lifecycle/
  activity.ts          ActivityRow, ActivitySource, presenceActivity, loadPresenceActivity (T1)
  export-rows.ts       PresenceExportFacts, loadPresenceExportFacts, paymentPurposeText, presenceSummary (T2)
  transaction.ts       inBothTransactions (T3)
  delete-guard.ts      DeleteBlock, deleteBlockOf, removePresenceRows (T3)
  http.ts              respondDelete (T3)
  merge-plan.ts        mergedAttendance, planAttendanceMerge, AttendanceMergePlan (T4)
  merge-rows.ts        mergePresenceRows (T4)
  anonymize-rows.ts    scrubPaymentChanges, clearPaymentNotes (T5)
  __tests__/           activity, new-season, export-rows, delete, merge-plan, merge, anonymize tests
src/club/presence/copy/lifecycle.ts   LIFECYCLE_PDF, line formatters (T2); LIFECYCLE_DELETE, deleteBlockedText (T3)
src/club/presence/copy.ts             one export line (T2)
src/club/personal-data/inactivity.ts  activity input (T1)
src/club/personal-data/review.ts      presence argument (T1)
src/club/personal-data/summary-model.ts   SummaryPresence, four sections (T2)
src/club/personal-data/export-service.ts  presence facts (T2)
src/club/personal-data/http.ts        presence in exportContext (T2), anonymizeContext (T5)
src/club/personal-data/anonymize-service.ts   payment rows, jobs, Istoric (T5)
src/club/athletes/delete.ts           refusal and presence rows (T3)
src/club/athletes/merge.ts            presence rows (T4)
src/club/athletes/store.ts, strapi-store.ts, __tests__/fake-store.ts   scrubPaymentEmailJobs (T5)
src/api/club/controllers/athletes.ts       remove (T3), merge (T4)
src/api/club/controllers/personal-data.ts  inactiveSummary, hideReview (T1)
```

---

### Task 1: Inactivity input and the new season pin (high)

**Files:**
- Create: `src/club/presence/lifecycle/activity.ts`
- Modify: `src/club/personal-data/inactivity.ts`, `src/club/personal-data/review.ts`, `src/api/club/controllers/personal-data.ts` (handlers `inactiveSummary`, `hideReview` only), `src/club/personal-data/__tests__/list-review.test.ts` (new argument)
- Test: `src/club/presence/lifecycle/__tests__/activity.test.ts`, `src/club/presence/lifecycle/__tests__/new-season.test.ts`

**Interfaces:**
- Consumes: `PresenceStore` (`attendances`, `lessons`, `payments`, `subscriptions`, `seasons`), `seasonOfDate(seasons: SeasonRecord[], date: string)`, `pickSubscription`, `subscriptionState`, row types, `fakePresenceStore`, `subscriptionRow`, `paymentRow`, `lessonRow`, `attendanceRow`, `G_SEASONS`.
- Produces:

```ts
// activity.ts
export type ActivityRow = { athleteId: string; seasonId: string };
export type ActivitySource = {
  seasons: SeasonRecord[];
  attendances: readonly Pick<AttendanceRow, 'athleteId' | 'sessionDate'>[];
  lessons: readonly Pick<LessonRow, 'athleteId' | 'date' | 'present'>[];
  payments: readonly Pick<PaymentRow, 'athleteId' | 'paidOn' | 'cancelled'>[];
  subscriptions: readonly Pick<SubscriptionRow, 'athleteId' | 'startsOn'>[];
};
/** One row per athlete and season, sorted by athlete then season id; a date with no season is dropped. */
export function presenceActivity(src: ActivitySource): ActivityRow[];
export async function loadPresenceActivity(presence: PresenceStore): Promise<ActivityRow[]>;
// inactivity.ts
export type InactivityInput = { /* existing fields */ activity?: readonly { athleteId: string; seasonId: string }[] };
export function lastActiveYears(input: Pick<InactivityInput, 'memberships' | 'registrations' | 'seasons' | 'activity'>): Map<string, number>;
// review.ts
export async function inactiveSummary(store: ClubStore, presence: PresenceStore, now: Date): Promise<InactiveSummary>;
export const readInactiveSummary: (store: ClubStore, presence: PresenceStore, log: (m: string) => void, now: Date) => Promise<AdminResult<InactiveSummary>>;
export function hideInactiveReview(ctx: ServiceContext, presence: PresenceStore, now: Date): Promise<AdminResult<InactiveSummary>>;
```

- [ ] **Step 1: Write the failing tests**

`activity.test.ts`:

```ts
const src = (over: Partial<ActivitySource>): ActivitySource => ({ seasons: G_SEASONS, attendances: [], lessons: [], payments: [], subscriptions: [], ...over });
it('turns attendance, present lessons, live payments and abonamente into seasons (4.20, 3.9)', () => {
  expect(presenceActivity(src({
    attendances: [{ athleteId: 'a1', sessionDate: '2026-11-07' }, { athleteId: 'a1', sessionDate: '2026-11-08' }],
    lessons: [{ athleteId: 'a2', date: '2026-03-10', present: true }, { athleteId: 'a3', date: '2026-11-10', present: false }, { athleteId: 'a3', date: '2026-11-11', present: null }],
    payments: [{ athleteId: 'a4', paidOn: '2026-07-15', cancelled: false }, { athleteId: 'a5', paidOn: '2026-11-01', cancelled: true }],
    subscriptions: [{ athleteId: 'a6', startsOn: '2026-10-27' }],
  }))).toEqual([{ athleteId: 'a1', seasonId: 's26' }, { athleteId: 'a2', seasonId: 's25' }, { athleteId: 'a4', seasonId: 's25' }, { athleteId: 'a6', seasonId: 's26' }]);
});
it('drops a date before every season', () => {
  expect(presenceActivity(src({ attendances: [{ athleteId: 'a1', sessionDate: '2024-01-01' }] }))).toEqual([]);
});
it('loads every source from the store', async () => {
  const { store } = fakePresenceStore({ sessions: [sessionRow({ id: 's1', date: '2026-11-07' })], attendances: [attendanceRow({ id: 't1', sessionId: 's1', athleteId: 'a1' })],
    payments: [paymentRow({ id: 'p1', athleteId: 'a2', paidOn: '2026-10-27' })] });
  expect(await loadPresenceActivity(store)).toEqual([{ athleteId: 'a1', seasonId: 's26' }, { athleteId: 'a2', seasonId: 's26' }]);
});
it('phase 5 activity keeps a child off the inactive list (4.20)', () => {
  const base = { athletes: [athlete('a1'), athlete('a2')], memberships: [member('a1', 's20'), member('a2', 's20')], registrations: [], seasons: SEASONS, retentionYears: 5, now: NOW };
  expect([...inactiveAthleteIds(base)]).toEqual(['a1', 'a2']);
  expect([...inactiveAthleteIds({ ...base, activity: [{ athleteId: 'a1', seasonId: 's26' }] })]).toEqual(['a2']);
  expect(lastActiveYears({ ...base, activity: [{ athleteId: 'a2', seasonId: 's25' }] }).get('a2')).toBe(2025);
});
```

(`SEASONS`, `NOW`, `athlete`, `member` copied from `settings-inactivity.test.ts`.)

`new-season.test.ts`:

```ts
it('an abonament bought last season keeps working across the season change (4.23)', () => {
  const sub = subscriptionRow({ id: 'old', seasonId: 's26', startsOn: '2027-09-20', validUntil: '2027-10-17' });
  expect(seasonOfDate(G_SEASONS, '2027-10-05')?.id).toBe('s27');
  expect(pickSubscription([sub], new Map(), 'pl-std', '2027-10-05')?.id).toBe('old');
  expect(subscriptionState(sub, 3, '2027-10-05')).toBe('activ');
});
it('"Începe sezonul" reads and writes nothing of phase 5 (4.23)', () => {
  for (const file of readdirSync(join(SRC, 'club/groups/new-season'))) {
    const text = readFileSync(join(SRC, 'club/groups/new-season', file), 'utf8');
    expect(text, file).not.toMatch(/from '[^']*presence\//);
    expect(text, file).not.toMatch(/club_(sessions|attendances|individual_lessons|subscriptions|payments)/);
    expect(text, file).not.toMatch(/\.(create|update|delete)(Session|Attendance|Lesson|Subscription|Payment)\(/);
  }
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/club/presence/lifecycle/__tests__/activity.test.ts src/club/presence/lifecycle/__tests__/new-season.test.ts`
Expected: FAIL (`activity.ts` missing); the two new-season tests already PASS (they pin existing behaviour; keep them).

- [ ] **Step 3: Implement**

`activity.ts` with a `Set` of `"<athleteId>|<seasonId>"`; `loadPresenceActivity` reads the five lists with `Promise.all` (no filter; the store rows are mapped already). In `inactivity.ts`, `lastActiveYears` adds `for (const a of input.activity ?? []) note(a.athleteId, labels.get(a.seasonId));` and the header comment names the phase 5 sources. In `review.ts`, `inactiveSummary` reads `loadPresenceActivity(presence)` in the same `Promise.all` and passes `activity`. In `controllers/personal-data.ts`, `inactiveSummary` and `hideReview` pass `strapiPresenceStore(strapi)`. Update `list-review.test.ts` calls with `fakePresenceStore().store`.

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS (the 3C `settings-inactivity.test.ts` unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/club/presence/lifecycle/activity.ts src/club/presence/lifecycle/__tests__/activity.test.ts src/club/presence/lifecycle/__tests__/new-season.test.ts src/club/personal-data/inactivity.ts src/club/personal-data/review.ts src/club/personal-data/__tests__/list-review.test.ts src/api/club/controllers/personal-data.ts
git commit -m "feat(lifecycle): inactivity counts attendance, lessons, payments and abonamente"
```

---

### Task 2: Personal data export and the four summary sections (high)

**Files:**
- Create: `src/club/presence/copy/lifecycle.ts`, `src/club/presence/lifecycle/export-rows.ts`
- Modify: `src/club/presence/copy.ts` (one line), `src/club/personal-data/summary-model.ts`, `src/club/personal-data/export-service.ts`, `src/club/personal-data/http.ts` (`exportContext` only), `src/club/personal-data/__tests__/summary.test.ts`, `src/club/personal-data/__tests__/export.test.ts`
- Test: `src/club/presence/lifecycle/__tests__/export-rows.test.ts`

**Interfaces:**
- Consumes: `longDate`, `monthName`, `ron`, `METHOD_WORDS`, `PURPOSE_WORDS`, `PRESENCE_WORDS.cancelledPayment`, `SUBSCRIPTION_STATE_WORDS`, `usedSlots`, `subscriptionState`, `PresenceStore`, `PERSONAL_DATA_COPY.pdf.none` ("Nimic înregistrat."), `isoDate` (`src/club/birth-date.ts`).
- Produces:

```ts
// copy/lifecycle.ts
export const LIFECYCLE_PDF = { attendance: 'Prezență', lessons: 'Lecții individuale', subscriptions: 'Abonamente', payments: 'Plăți' } as const;
export type AttendanceLine = { date: string; groupName: string; startTime: string; grup: boolean; uscat: boolean; visitor: boolean };
export type LessonLine = { date: string; startTime: string; durationMin: number; coachNames: string[]; present: boolean | null; price: number | null };
export type SubscriptionLine = { itemName: string; startsOn: string; validUntil: string; used: number; slots: number; state: SubscriptionState; price: number | null };
export type PaymentLine = { paidOn: string; amount: number; method: PaymentMethod; purposeText: string; collectedAtRink: boolean; note: string | null; cancelled: boolean };
export function attendanceLine(r: AttendanceLine): string;
export function lessonLine(r: LessonLine): string;
export function subscriptionLine(r: SubscriptionLine): string;
export function paymentLine(r: PaymentLine): string;
// summary-model.ts
export type SummaryPresence = { attendance: string[]; lessons: string[]; subscriptions: string[]; payments: string[] };
export type SummaryInput = { /* existing */ presence: SummaryPresence };
// export-rows.ts
export type PresenceExportFacts = {
  attendances: AttendanceRow[]; sessions: SessionRow[]; lessons: LessonRow[]; subscriptions: SubscriptionRow[]; used: Map<string, number>;
  payments: PaymentRow[]; groups: readonly { id: string; name: string }[]; coaches: readonly { id: string; name: string }[]; seasons: readonly { id: string; label: string }[];
};
export async function loadPresenceExportFacts(presence: PresenceStore, athleteId: string): Promise<PresenceExportFacts>;
export function paymentPurposeText(p: PaymentRow, f: Pick<PresenceExportFacts, 'subscriptions' | 'seasons'>): string;
export function presenceSummary(f: PresenceExportFacts, today: string): SummaryPresence;
// export-service.ts
export type ExportContext = ServiceContext & { storedDocuments: ...; now: () => Date; presence: PresenceStore };
```

- [ ] **Step 1: Write the failing tests**

`export-rows.test.ts`:

```ts
it('row formats of spec 4.21a', () => {
  expect(attendanceLine({ date: '2026-10-27', groupName: 'Intermediari Bronze', startTime: '17:00', grup: true, uscat: false, visitor: false })).toBe('27 oct 2026, Intermediari Bronze, 17:00, Grup');
  expect(attendanceLine({ date: '2026-10-27', groupName: 'Avansați', startTime: '18:00', grup: true, uscat: true, visitor: false })).toBe('27 oct 2026, Avansați, 18:00, Grup, Uscat');
  expect(attendanceLine({ date: '2026-10-27', groupName: 'Avansați', startTime: '18:00', grup: false, uscat: true, visitor: true })).toBe('27 oct 2026, Avansați, 18:00, Uscat, doar la ședința asta');
  expect(lessonLine({ date: '2026-10-28', startTime: '18:00', durationMin: 50, coachNames: ['Virgil Pascu'], present: true, price: 80 })).toBe('28 oct 2026, 18:00, 50 min, antrenor Virgil Pascu, prezent, 80 RON');
  expect(lessonLine({ date: '2026-10-28', startTime: '18:00', durationMin: 50, coachNames: ['Virgil Pascu'], present: false, price: 80 })).toBe('28 oct 2026, 18:00, 50 min, antrenor Virgil Pascu, absent');
  expect(lessonLine({ date: '2026-10-28', startTime: '18:00', durationMin: 60, coachNames: ['Virgil Pascu', 'Andreea Pascu'], present: null, price: null })).toBe('28 oct 2026, 18:00, 60 min, antrenori Virgil Pascu și Andreea Pascu');
  expect(subscriptionLine({ itemName: 'Abonament 8 ședințe', startsOn: '2026-10-27', validUntil: '2026-11-23', used: 5, slots: 8, state: 'activ', price: 320 })).toBe('Abonament 8 ședințe, din 27 oct 2026, expiră pe 23 nov 2026, 5/8, activ, 320 RON');
  expect(paymentLine({ paidOn: '2026-10-27', amount: 320, method: 'numerar', purposeText: 'Abonament 8 ședințe', collectedAtRink: true, note: null, cancelled: false })).toBe('27 oct 2026, 320 RON, Numerar, Abonament 8 ședințe, la patinoar');
  expect(paymentLine({ paidOn: '2026-10-27', amount: 12.5, method: 'card', purposeText: 'Altceva', collectedAtRink: false, note: 'taxă concurs', cancelled: true })).toBe('27 oct 2026, 12,50 RON, Card (POS), Altceva, Notă: taxă concurs, anulată');
});
it('"Pentru" text per purpose (decided 11)', () => {
  const f = { subscriptions: [subscriptionRow({ id: 'sub1', itemName: 'Abonament 8 ședințe' })], seasons: [{ id: 's26', label: '2026-2027' }] };
  const p = (over: Partial<PaymentRow>) => paymentPurposeText(paymentRow(over), f);
  expect([p({ purpose: 'abonament', subscriptionId: 'sub1' }), p({ purpose: 'cotizatie', seasonId: 's26' }), p({ purpose: 'club_luna', clubMonth: '2026-10' }), p({ purpose: 'lectie' }), p({ purpose: 'altceva' })])
    .toEqual(['Abonament 8 ședințe', 'Cotizație membru 2026-2027', 'Club, octombrie 2026', 'Lecție individuală', 'Altceva']);
});
it('loads only this child\'s rows and never names another child (4.21a, DEC 2026-10-27 3C 1)', async () => {
  const f = await loadPresenceExportFacts(sharedSessionStore(), 'a1');   // s1 holds a1 and a2 ("Mihai Pop"); a2 also has a lesson and a payment
  expect(f.attendances.map((a) => a.athleteId)).toEqual(['a1']);
  expect([f.lessons, f.payments, f.subscriptions].flat().every((r) => r.athleteId === 'a1')).toBe(true);
  expect(JSON.stringify(presenceSummary(f, '2026-11-20'))).not.toContain('Mihai');
});
it('newest first; cancelled payments kept and marked; used slots and state from today (4.21a)', () => {
  const s = presenceSummary(facts(), '2026-11-20');
  expect(s.attendance).toEqual(['8 nov 2026, Intermediari Bronze, 11:00, Grup', '7 nov 2026, Intermediari Bronze, 11:00, Grup']);
  expect(s.subscriptions).toEqual(['Abonament 8 ședințe, din 27 oct 2026, expiră pe 23 nov 2026, 2/8, activ, 320 RON']);
  expect(s.payments.at(-1)).toMatch(/, anulată$/);
});
```

`sharedSessionStore()` and `facts()` are local builders on `fakePresenceStore` / plain rows (session `s1` of `g-ib` on 2026-11-07 11:00, `s2` on 2026-11-08, subscription `sub1` used by both a1 rows, payments `p1` 320 numerar and `p2` cancelled).

In `summary.test.ts`: the input builder gains `presence: { attendance: [], lessons: [], subscriptions: [], payments: [] }`; the section order test expects the existing five titles followed by `'Prezență', 'Lecții individuale', 'Abonamente', 'Plăți'`; new test `an empty presence section says "Nimic înregistrat."` and `presence lines are rows with an empty label`; the PDF read-back test also finds `'Lecții individuale'` and one seeded line. In `export.test.ts`: `setup()` passes `presence: fakePresenceStore(...).store`; new test `the summary carries the child's payments, not another child's` (reads the model through a spy on `renderSummaryPdf`, or reads back the PDF text as the existing test does).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/club/presence/lifecycle/__tests__/export-rows.test.ts src/club/personal-data/__tests__/summary.test.ts src/club/personal-data/__tests__/export.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

- `copy/lifecycle.ts`: imports `longDate`, `ron` (presence `dates.ts`, `money.ts`), `METHOD_WORDS`, `PRESENCE_WORDS`, `SUBSCRIPTION_STATE_WORDS` (`copy/core.ts`) only. Words: "Grup", "Uscat", "doar la ședința asta", "antrenor", "antrenori", "și", "prezent", "absent", "din", "expiră pe", "la patinoar", "Notă", `PRESENCE_WORDS.cancelledPayment`. Parts are joined with ", ".
- `copy.ts`: add `export * from './copy/lifecycle';`.
- `export-rows.ts`: `loadPresenceExportFacts` reads, for this athlete only, `attendances({ athleteId })`, `sessions({ ids })` of those rows, `lessons({ athleteId })`, `subscriptions({ athleteId })`, `payments({ athleteId })`, `usedSlots(await presence.attendances({ subscriptionIds }))`, `groups()`, `teamMembers()`, `seasons()`. It never reads another athlete's row or any session Istoric. `presenceSummary` builds the four line lists with the formatters, sorted newest first (attendance by date then start time; lessons by date then time; subscriptions by `startsOn`; payments by `paidOn` then `recordedAt`).
- `summary-model.ts`: four `single(LIFECYCLE_PDF.<x>, lines.map((l) => row('', l)))` sections after Istoric.
- `export-service.ts`: `buildExport` adds `presence: presenceSummary(await loadPresenceExportFacts(ctx.presence, athlete.id), isoDate(ctx.today))`. `personal-data/http.ts` `exportContext` adds `presence: strapiPresenceStore(strapi)`.

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS (5-1 `copy.test.ts` passes with the new copy file and its export line).

- [ ] **Step 5: Commit**

```bash
git add src/club/presence/copy/lifecycle.ts src/club/presence/copy.ts src/club/presence/lifecycle/export-rows.ts src/club/presence/lifecycle/__tests__/export-rows.test.ts src/club/personal-data/summary-model.ts src/club/personal-data/export-service.ts src/club/personal-data/http.ts src/club/personal-data/__tests__/summary.test.ts src/club/personal-data/__tests__/export.test.ts
git commit -m "feat(lifecycle): export includes attendance, lessons, abonamente and payments"
```

---

### Task 3: Delete refusal and presence rows on delete (high)

**Files:**
- Create: `src/club/presence/lifecycle/transaction.ts`, `src/club/presence/lifecycle/delete-guard.ts`, `src/club/presence/lifecycle/http.ts`
- Modify: `src/club/presence/copy/lifecycle.ts` (append), `src/club/athletes/delete.ts`, `src/api/club/controllers/athletes.ts` (handler `remove` only), `src/club/athletes/__tests__/delete.test.ts`
- Test: `src/club/presence/lifecycle/__tests__/delete.test.ts`

**Interfaces:**
- Consumes: `ClubStore`, `ServiceContext`, `lockAthletesWithRegistrations`, `PresenceStore` (`payments`, `subscriptions`, `attendances`, `lessons`, `lockLesson`, `deleteAttendance`, `deleteLesson`, `transaction`), `respond`, `AdminCtx`, `countWords`, `strapiPresenceStore`.
- Produces:

```ts
// transaction.ts
export function inBothTransactions<T>(club: Pick<ClubStore, 'transaction'>, presence: Pick<PresenceStore, 'transaction'>, work: () => Promise<T>): Promise<T>;
// delete-guard.ts
export type DeleteBlock = { payments: number; subscriptions: number };
/** Counts every payment and subscription of the athlete, cancelled ones too (C37); null when both are 0. */
export async function deleteBlockOf(presence: PresenceStore, athleteId: string): Promise<DeleteBlock | null>;
/** Locks the athlete's lessons (sorted), then deletes its lessons and attendance rows; sessions stay. */
export async function removePresenceRows(presence: PresenceStore, athleteId: string): Promise<void>;
// copy/lifecycle.ts
export const LIFECYCLE_DELETE = {
  title: (name: string) => `Șterge ${name}`,
  anonymizeInstead: 'Poți anonimiza sportivul în schimb: numele și datele personale se șterg, sumele plăților rămân.',
  cancel: 'Renunță',
  anonymize: 'Anonimizează',
} as const;
export function deleteBlockedText(payments: number, subscriptions: number): string;
// delete.ts
export type DeleteOutcome = { deleted: true; documentId: string } | { deleted: false; blocked: DeleteBlock };
export async function deleteAthlete(ctx: ServiceContext, id: string, presence: PresenceStore): Promise<AdminResult<DeleteOutcome>>;
// http.ts
export function respondDelete(ctx: AdminCtx, result: AdminResult<DeleteOutcome>): void;
```

HTTP (index "Routes", spec 6): `DELETE /club/athletes/:documentId` answers 200 `{ data: { documentId } }`, or 409 `{ data: { payments, subscriptions }, error: { status: 409, name: 'ClubAdminError', message: deleteBlockedText(payments, subscriptions) } }`. Plan 5-6 reads `data.payments` and `data.subscriptions`.

- [ ] **Step 1: Write the failing tests**

`lifecycle/__tests__/delete.test.ts` (club fake from `athletes/__tests__/fake-store.ts`, presence fake from 5-1):

```ts
it('refusal sentence drops a part with 0, with number forms (5.14, C66)', () => {
  expect(deleteBlockedText(2, 1)).toBe('Sportivul are 2 plăți și 1 abonament. Ștergerea este blocată cât timp există plăți sau abonamente.');
  expect(deleteBlockedText(0, 1)).toBe('Sportivul are 1 abonament. Ștergerea este blocată cât timp există plăți sau abonamente.');
  expect(deleteBlockedText(1, 0)).toBe('Sportivul are 1 plată. Ștergerea este blocată cât timp există plăți sau abonamente.');
  expect(deleteBlockedText(20, 3)).toBe('Sportivul are 20 de plăți și 3 abonamente. Ștergerea este blocată cât timp există plăți sau abonamente.');
  expect(LIFECYCLE_DELETE.title('Ana Ionescu')).toBe('Șterge Ana Ionescu');
});
it('is refused while a payment exists, a cancelled one too; nothing is written (4.21, C37)', async () => {
  const f = setup({ payments: [paymentRow({ id: 'p1', athleteId: 'a1', cancelled: true })] });
  expect(await deleteAthlete(f.ctx, 'a1', f.presence)).toEqual({ ok: true, data: { deleted: false, blocked: { payments: 1, subscriptions: 0 } } });
  expect(f.club.state.athletes.map((a) => a.id)).toContain('a1');
  expect(f.club.state.memberships).toHaveLength(1);
  expect(f.pres.state.attendances).toHaveLength(1);
  expect(f.club.state.history).toEqual([]);
});
it('is refused while only a cancelled abonament exists', async () => {
  const f = setup({ subscriptions: [subscriptionRow({ id: 'sub1', athleteId: 'a1', cancelled: true })] });
  expect(await deleteAthlete(f.ctx, 'a1', f.presence)).toEqual({ ok: true, data: { deleted: false, blocked: { payments: 0, subscriptions: 1 } } });
});
it('otherwise removes attendance rows and lessons, keeps the session (4.21)', async () => {
  const f = setup({});
  expect(await deleteAthlete(f.ctx, 'a1', f.presence)).toEqual({ ok: true, data: { deleted: true, documentId: 'a1' } });
  expect(f.pres.state.attendances.map((a) => a.athleteId)).toEqual(['a2']);
  expect(f.pres.state.lessons).toEqual([]);
  expect(f.pres.state.sessions).toHaveLength(1);
});
it('reads payments only after holding the athlete lock (7.1)', async () => { /* spy on presence.payments records f.club.state.locks.includes('athlete:a1') at call time: true */ });
it('rolls both stores back when a later step fails', async () => {
  const f = setup({});
  f.club.failOn('deleteAthlete');
  expect(await deleteAthlete(f.ctx, 'a1', f.presence)).toEqual({ ok: false, status: 500, error: 'Acțiunea nu a reușit. Nimic nu a fost salvat.' });
  expect(f.pres.state.attendances).toHaveLength(2);
  expect(f.pres.state.lessons).toHaveLength(1);
});
it('answers 409 with the counts and the sentence; a delete as before (6, 5.14)', () => {
  const ctx = { status: 200, body: null } as AdminCtx;
  respondDelete(ctx, { ok: true, data: { deleted: false, blocked: { payments: 2, subscriptions: 1 } } });
  expect([ctx.status, ctx.body]).toEqual([409, { data: { payments: 2, subscriptions: 1 }, error: { status: 409, name: 'ClubAdminError', message: deleteBlockedText(2, 1) } }]);
  const ok = { status: 200, body: null } as AdminCtx;
  respondDelete(ok, { ok: true, data: { deleted: true, documentId: 'a1' } });
  expect(ok.body).toEqual({ data: { documentId: 'a1' } });
});
it('the remove handler passes a presence store and answers through respondDelete', () => {
  expect(source('api/club/controllers/athletes.ts')).toMatch(/respondDelete\(ctx, await deleteAthlete\(await serviceContext\(strapi, ctx\), ctx\.params\.documentId \?\? '', strapiPresenceStore\(strapi\)\)\)/);
});
```

`setup(over)`: club fake with `a1` (membership `m1`), `a2`; presence fake with session `s1`, attendance rows of `a1` and `a2` at `s1`, lesson `l1` of `a1`, plus `over`. `source(p)` = `readFileSync(join(SRC, p), 'utf8')` as in the 5-1 tests.

In `athletes/__tests__/delete.test.ts`: every call passes `fakePresenceStore().store`; expected answers become `{ ok: true, data: { deleted: true, documentId: 'a1' } }`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/club/presence/lifecycle/__tests__/delete.test.ts src/club/athletes/__tests__/delete.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`deleteInTransaction(ctx, id, presence)`: P3 locks and checks unchanged; then `const blocked = await deleteBlockOf(presence, id)`; if blocked answer `{ ok: true, data: { deleted: false, blocked } }` before any write; else `removePresenceRows`, then the P3 steps; answers `{ deleted: true, documentId }`. `deleteAthlete` runs it through `guarded(... inBothTransactions(ctx.store, presence, ...))` and refreshes matches only when `deleted` is true. `deleteBlockedText` uses `countWords(n, 'plată', 'plăți')` and `countWords(n, 'abonament', 'abonamente')`. `respondDelete` uses `respond` for every other answer. Controller `remove`: `respondDelete(ctx, await deleteAthlete(await serviceContext(strapi, ctx), ctx.params.documentId ?? '', strapiPresenceStore(strapi)))`.

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/club/presence/lifecycle/transaction.ts src/club/presence/lifecycle/delete-guard.ts src/club/presence/lifecycle/http.ts src/club/presence/copy/lifecycle.ts src/club/presence/lifecycle/__tests__/delete.test.ts src/club/athletes/delete.ts src/club/athletes/__tests__/delete.test.ts src/api/club/controllers/athletes.ts
git commit -m "feat(lifecycle): delete refused while payments or abonamente exist"
```

---

### Task 4: Merge of attendance, lessons, abonamente and payments (high)

**Files:**
- Create: `src/club/presence/lifecycle/merge-plan.ts`, `src/club/presence/lifecycle/merge-rows.ts`
- Modify: `src/club/athletes/merge.ts`, `src/api/club/controllers/athletes.ts` (handler `merge` only), `src/club/athletes/__tests__/merge.test.ts`
- Test: `src/club/presence/lifecycle/__tests__/merge-plan.test.ts`, `src/club/presence/lifecycle/__tests__/merge.test.ts`

**Interfaces:**
- Consumes: `inBothTransactions` (T3), `attendanceKey`, `sumMoney`, `usedSlots`, `AttendanceRow`, `AttendanceWrite`, `Charge`, `PresenceStore` (`attendances`, `lessons`, `subscriptions`, `payments`, `lockLesson`, `lockSubscription`, `lockPayment`, `updateAttendance`, `deleteAttendance`, `updateLesson`, `updateSubscription`, `updatePayment`).
- Produces:

```ts
// merge-plan.ts (pure)
export type AttendanceMergePlan = { remove: string[]; update: { id: string; data: Partial<AttendanceWrite> }[] };
/** Decided 5: the kept row's fields after a union with the removed row at the same session. */
export function mergedAttendance(kept: AttendanceRow, removed: AttendanceRow): Pick<AttendanceWrite, 'grup' | 'uscat' | 'visitor' | 'subscriptionId' | 'billing' | 'charges' | 'amount'>;
/** `remove` = removed rows at a session the kept athlete also has; `update` = the merged kept rows, then the other removed rows moved and rekeyed. */
export function planAttendanceMerge(kept: AttendanceRow[], removed: AttendanceRow[], keptId: string): AttendanceMergePlan;
// merge-rows.ts
/** Locks lessons, subscriptions, payments of both athletes (each sorted), then applies the plan (remove before update) and moves every lesson, subscription and payment. */
export async function mergePresenceRows(presence: PresenceStore, keptId: string, removedId: string): Promise<void>;
// merge.ts
export async function mergeAthletes(ctx: ServiceContext, request: MergeRequest, presence: PresenceStore): Promise<Result>;
```

- [ ] **Step 1: Write the failing tests**

`merge-plan.test.ts`:

```ts
const k = (over: Partial<AttendanceRow>) => attendanceRow({ id: 'tk', sessionId: 's1', athleteId: 'k', uniqueKey: 's1|k', ...over });
const r = (over: Partial<AttendanceRow>) => attendanceRow({ id: 'tr', sessionId: 's1', athleteId: 'r', uniqueKey: 's1|r', ...over });
it('Școala: one row, the kept slot wins, else the removed slot (C38)', () => {
  expect(mergedAttendance(k({ billing: 'slot', subscriptionId: 'subK' }), r({ billing: 'slot', subscriptionId: 'subR' }))).toMatchObject({ subscriptionId: 'subK', billing: 'slot' });
  expect(mergedAttendance(k({ billing: 'fara_abonament', subscriptionId: null }), r({ billing: 'slot', subscriptionId: 'subR' }))).toMatchObject({ subscriptionId: 'subR', billing: 'slot' });
  expect(mergedAttendance(k({ billing: 'fara_abonament', subscriptionId: null }), r({ billing: 'fara_abonament', subscriptionId: null }))).toMatchObject({ subscriptionId: null, billing: 'fara_abonament' });
});
it('Club: union of ticks and of frozen charges, amount and billing recomputed (C38, 5-1 decided 9)', () => {
  const grup = { type: 'grup' as const, itemName: 'Ședință grup', price: 40, included: false };
  const uscat = { type: 'uscat' as const, itemName: 'Uscat', price: 20, included: true };
  expect(mergedAttendance(k({ billing: 'club', grup: true, uscat: false, charges: [grup], amount: 40 }), r({ billing: 'inclus', grup: false, uscat: true, charges: [uscat], amount: 0 })))
    .toEqual({ grup: true, uscat: true, visitor: false, subscriptionId: null, billing: 'club', charges: [grup, uscat], amount: 40 });
  expect(mergedAttendance(k({ billing: 'inclus', grup: false, uscat: true, charges: [uscat], amount: 0 }), r({ billing: 'fara_pret', grup: true, uscat: false, charges: [{ ...grup, price: null }], amount: 0 })))
    .toMatchObject({ billing: 'inclus', amount: 0 });
});
it('visitor only when both were visitors', () => {
  expect(mergedAttendance(k({ visitor: true }), r({ visitor: false })).visitor).toBe(false);
  expect(mergedAttendance(k({ visitor: true }), r({ visitor: true })).visitor).toBe(true);
});
it('plans removal of the overlap and rekeys the rest to the kept athlete', () => {
  const plan = planAttendanceMerge([k({})], [r({}), r({ id: 'tr2', sessionId: 's2', uniqueKey: 's2|r' })], 'k');
  expect(plan.remove).toEqual(['tr']);
  expect(plan.update.find((u) => u.id === 'tr2')?.data).toEqual({ athleteId: 'k', uniqueKey: 's2|k' });
  expect(plan.update.map((u) => u.id)).toEqual(['tk', 'tr2']);
});
```

`lifecycle/__tests__/merge.test.ts` (club fake with `k`, `r`; presence fake with session `s1` where both are present on their own 8-slot subscriptions `subK` and `subR`, session `s2` with `r` only, lesson `lr`, payments `pr` and cancelled `pr2` of `r`):

```ts
it('moves attendance, lessons, abonamente and payments; no double row, the removed slot returns (4.21, C38)', async () => {
  const f = setup();
  expect((await mergeAthletes(f.ctx, { keptId: 'k', removedId: 'r', take: [] }, f.presence)).ok).toBe(true);
  expect(f.pres.state.attendances.map((a) => [a.sessionId, a.athleteId, a.uniqueKey, a.subscriptionId])).toEqual([['s1', 'k', 's1|k', 'subK'], ['s2', 'k', 's2|k', 'subR']]);
  const used = usedSlots(await f.presence.attendances());
  expect([used.get('subK'), used.get('subR')]).toEqual([1, 1]);
  expect([...f.pres.state.lessons, ...f.pres.state.subscriptions, ...f.pres.state.payments].every((x) => x.athleteId === 'k')).toBe(true);
  expect(f.pres.state.payments).toHaveLength(2);
});
it('locks registrations and athletes first, then lessons, subscriptions, payments, each sorted (7.1)', async () => {
  const f = setup();
  await mergeAthletes(f.ctx, { keptId: 'k', removedId: 'r', take: [] }, f.presence);
  expect(f.pres.group.locks).toEqual(['lesson:lr', 'subscription:subK', 'subscription:subR', 'payment:pr', 'payment:pr2']);
  expect(f.club.state.locks.slice(-2)).toEqual(['athlete:k', 'athlete:r']);
});
it('rolls both stores back when a later step fails', async () => {
  const f = setup();
  f.club.failOn('deleteAthlete');
  expect((await mergeAthletes(f.ctx, { keptId: 'k', removedId: 'r', take: [] }, f.presence)).ok).toBe(false);
  expect(f.pres.state.attendances.map((a) => a.athleteId).sort()).toEqual(['k', 'r', 'r']);
  expect(f.pres.state.payments.every((p) => p.athleteId === 'r')).toBe(true);
});
it('the merge handler passes a presence store', () => {
  expect(source('api/club/controllers/athletes.ts')).toMatch(/mergeAthletes\(await serviceContext\(strapi, ctx\), request, strapiPresenceStore\(strapi\)\)/);
});
```

In `athletes/__tests__/merge.test.ts`: every `mergeAthletes` call passes `fakePresenceStore().store`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/club/presence/lifecycle/__tests__/merge-plan.test.ts src/club/presence/lifecycle/__tests__/merge.test.ts src/club/athletes/__tests__/merge.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`planAttendanceMerge`: index kept rows by `sessionId`; each removed row at a kept session goes to `remove` and its kept row gets `mergedAttendance(kept, removed)`; every other removed row gets `{ athleteId: keptId, uniqueKey: attendanceKey(sessionId, keptId) }`; updates sorted kept rows first, then by id. `mergePresenceRows` applies `remove` before `update` so no `uniqueKey` collides. `merge.ts`: `applyMerge` calls `mergePresenceRows(presence, kept.id, removed.id)` first; `mergeAthletes` runs `mergeInTransaction` through `inBothTransactions(ctx.store, presence, ...)`. Controller `merge` passes `strapiPresenceStore(strapi)`.

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/club/presence/lifecycle/merge-plan.ts src/club/presence/lifecycle/merge-rows.ts src/club/presence/lifecycle/__tests__/merge-plan.test.ts src/club/presence/lifecycle/__tests__/merge.test.ts src/club/athletes/merge.ts src/club/athletes/__tests__/merge.test.ts src/api/club/controllers/athletes.ts
git commit -m "feat(lifecycle): merge moves attendance, lessons, abonamente and payments"
```

---

### Task 5: Anonymize keeps money rows, clears notes and payment e-mails (high)

**Files:**
- Create: `src/club/presence/lifecycle/anonymize-rows.ts`
- Modify: `src/club/personal-data/anonymize-service.ts`, `src/club/personal-data/http.ts` (`anonymizeContext` only), `src/club/athletes/store.ts` (`ClubEmailJob`, `scrubPaymentEmailJobs`), `src/club/athletes/strapi-store.ts` (`personalDataStore`), `src/club/athletes/__tests__/fake-store.ts` (`fakePersonalData`), `src/club/athletes/__tests__/store-3c.test.ts`, `src/club/personal-data/__tests__/anonymize-service.test.ts`
- Test: `src/club/presence/lifecycle/__tests__/anonymize.test.ts`

**Interfaces:**
- Consumes: `inBothTransactions` (T3), `scrubChanges`, `scrubbedJobStatus`, `SUBJECT.payment`, `PresenceStore` (`payments`, `lockPayment`, `updatePayment`), `ClubStore.history`, `setHistoryChanges`.
- Produces:

```ts
// anonymize-rows.ts
/** `scrubChanges`, plus `fields.note` of a payment-edited line becomes { from: null, to: null } (decided 7). */
export function scrubPaymentChanges(changes: Record<string, unknown>): Record<string, unknown>;
/** Locks the athlete's payments (sorted), sets `note` null where set; answers every payment id of the athlete. */
export async function clearPaymentNotes(presence: PresenceStore, athleteId: string): Promise<string[]>;
// athletes/store.ts
export type ClubEmailJob = { /* existing */ kind?: 'registration' | 'schedule-change' | 'payment'; paymentId?: string | null; payload?: unknown };
/** Payment e-mail jobs linked to these payments: recipient, subject, lastError, payload null; queued -> cancelled (decided 8). */
scrubPaymentEmailJobs(paymentIds: string[]): Promise<void>;
// anonymize-service.ts
export type AnonymizeContext = ServiceContext & { removeFiles: RemoveFiles; now: () => Date; presence: PresenceStore };
```

- [ ] **Step 1: Write the failing tests**

`lifecycle/__tests__/anonymize.test.ts` (club fake with `a1` "Carla Vasilescu", e-mail `mama.vasilescu@example.com`, and `a2`; club `emailJobs`: `j1` kind payment `paymentId: 'p1'` queued, `j2` kind payment `paymentId: 'p2'` sent, `j3` kind payment of `a2`'s `p9` queued, each with `payload: { athleteName: ... }`; club history: payment `p1` lines `payment-email-sent { recipient: 'mama.vasilescu@example.com' }` and `payment-edited { fields: { note: { from: null, to: 'Plătit de bunica Vasilescu' }, amount: { from: 300, to: 320 } } }`; presence fake: payments `p1` (note "Plătit de bunica Vasilescu"), `p2` cancelled, subscription `sub1`, attendance `t1`, lesson `l1` of `a1`, payment `p9` of `a2` with a note):

```ts
it('keeps every payment with amount, date, method, season, purpose and links; clears only the note (4.21, p5 Q30)', async () => {
  const f = setup();
  const before = f.pres.state.payments.map(({ note, ...rest }) => rest);
  expect(await anonymizeAthlete(f.ctx, 'a1')).toEqual({ ok: true, data: { documentId: 'a1' } });
  expect(f.pres.state.payments.map(({ note, ...rest }) => rest)).toEqual(before);
  expect(f.pres.state.payments.map((p) => [p.id, p.note])).toEqual([['p1', null], ['p2', null], ['p9', 'Pentru Mihai']]);
});
it('keeps attendance, lessons and abonamente as they were', async () => {
  const f = setup();
  const snapshot = structuredClone([f.pres.state.attendances, f.pres.state.lessons, f.pres.state.subscriptions]);
  await anonymizeAthlete(f.ctx, 'a1');
  expect([f.pres.state.attendances, f.pres.state.lessons, f.pres.state.subscriptions]).toEqual(snapshot);
});
it('scrubs the child\'s payment e-mails: queued cancelled, sent kept, another child\'s untouched (P3C 4)', async () => {
  const f = setup();
  await anonymizeAthlete(f.ctx, 'a1');
  expect(f.club.state.emailJobs.map((j) => [j.id, j.status, j.recipient, j.subject, j.payload ?? null])).toEqual([
    ['j1', 'cancelled', null, null, null], ['j2', 'sent', null, null, null], ['j3', 'queued', 'tata.pop@example.com', 'Plată înregistrată: Mihai Pop', { athleteName: 'Mihai Pop' }],
  ]);
});
it('blanks the address and the note in the payments\' Istoric, keeps the rest (8, decided 7)', async () => {
  const f = setup();
  await anonymizeAthlete(f.ctx, 'a1');
  const lines = f.club.state.history.filter((h) => h.subjectType === 'payment' && h.subjectId === 'p1');
  expect(lines.map((h) => h.changes)).toEqual([{ recipient: null }, { fields: { note: { from: null, to: null }, amount: { from: 300, to: 320 } } }]);
  expect(JSON.stringify(f.club.state)).not.toMatch(/Vasilescu|mama\.vasilescu/);
  expect(JSON.stringify(f.pres.state)).not.toMatch(/Vasilescu/);
});
it('locks the athlete, then its payments sorted (7.1)', async () => {
  const f = setup();
  await anonymizeAthlete(f.ctx, 'a1');
  expect(f.club.state.locks.at(-1)).toBe('athlete:a1');
  expect(f.pres.group.locks).toEqual(['payment:p1', 'payment:p2']);
});
it('rolls both stores back on a failure', async () => {
  const f = setup();
  f.club.failOn('scrubPaymentEmailJobs');
  expect(await anonymizeAthlete(f.ctx, 'a1')).toEqual({ ok: false, status: 500, error: 'Acțiunea nu a reușit. Nimic nu a fost salvat.' });
  expect(f.pres.state.payments.find((p) => p.id === 'p1')?.note).toBe('Plătit de bunica Vasilescu');
  expect(f.club.state.athletes.find((a) => a.id === 'a1')?.name).toBe('Carla Vasilescu');
});
it('scrubPaymentChanges nulls a note pair and the 3C keys, nothing else', () => {
  expect(scrubPaymentChanges({ fields: { note: { from: 'a', to: 'b' }, method: { from: 'numerar', to: 'card' } } }))
    .toEqual({ fields: { note: { from: null, to: null }, method: { from: 'numerar', to: 'card' } } });
  expect(scrubPaymentChanges({ recipient: 'x@example.com', amount: 320 })).toEqual({ recipient: null, amount: 320 });
});
```

`store-3c.test.ts`: `scrubPaymentEmailJobs` on the fake (linked jobs only, queued -> cancelled, payload null) and the Strapi store (stubbed `db.query` called with `where: { kind: 'payment', payment: { documentId: { $in: ['p1'] } } }` and data with `payload: null`); the existing parity test covers the method list. `anonymize-service.test.ts`: `ctx` gains `presence: fakePresenceStore().store`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/club/presence/lifecycle/__tests__/anonymize.test.ts src/club/athletes/__tests__/store-3c.test.ts src/club/personal-data/__tests__/anonymize-service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`anonymizeInTransaction`: after `scrubRegistrations`, `const paymentIds = await clearPaymentNotes(ctx.presence, id)`; `await ctx.store.scrubPaymentEmailJobs(paymentIds)`; for each id, `scrubRows(ctx.store, await ctx.store.history(SUBJECT.payment, pid), scrubPaymentChanges)` (`scrubRows` gains a `scrub` parameter defaulting to `scrubChanges`). `anonymizeOne` runs it through `inBothTransactions(ctx.store, ctx.presence, ...)`. Strapi `scrubPaymentEmailJobs`: return early on an empty list; `findMany({ where: { kind: 'payment', payment: { documentId: { $in: ids } } }, select: ['id', 'status'] })`, then `update` with `{ ...scrubbedJob(status), payload: null }`. `personal-data/http.ts` `anonymizeContext` adds `presence: strapiPresenceStore(strapi)`.

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/club/presence/lifecycle/anonymize-rows.ts src/club/presence/lifecycle/__tests__/anonymize.test.ts src/club/personal-data/anonymize-service.ts src/club/personal-data/http.ts src/club/athletes/store.ts src/club/athletes/strapi-store.ts src/club/athletes/__tests__/fake-store.ts src/club/athletes/__tests__/store-3c.test.ts src/club/personal-data/__tests__/anonymize-service.test.ts
git commit -m "feat(lifecycle): anonymize keeps payments, clears notes and payment e-mails"
```

---

### Task 6: Boot check on a throwaway Postgres (high)

**Files:** none committed. Temporary: `${TMPDIR:-/tmp}/es54` (removed at the end).

**Interfaces:**
- Consumes: everything above; `scripts/fixtures/phase4-shape.js` and `scripts/fixtures/phase5-shape.js` (5-1). Both guards must accept port 55454; if `grep -c 55454 scripts/fixtures/phase4-shape.js` prints 0, stop and report BLOCKED (plan 5-1 owns that list).
- Proves (spec 11.4 and this plan's Review Focus): export carries the four sections and never names the other child at the shared session; delete with a payment is 409 with counts, without money rows it removes attendance and keeps the session; merge leaves one row per session and moves the money rows; inactivity summary counts phase 5 activity; after "Anonimizează" a search of the whole database for the seeded personal values finds nothing while payment counts and sums are unchanged; restart once.

Container `es54-pg` on 127.0.0.1:55454, Strapi on 1374. Never 1337, 1340, 3010, 5432, 55442.

- [ ] **Step 1: Full checks**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, zero type errors.

- [ ] **Step 2: Postgres, environment, build, base fixtures**

As plan 3C Task 14 Step 2 with `T="${TMPDIR:-/tmp}/es54"`, container `es54-pg`, `DATABASE_PORT=55454`, `PORT=1374`; then `(set -a; . "$T/env"; set +a; npm run build && ES_THROWAWAY_DB=1 IDS_FILE=$T/ids.json node scripts/fixtures/phase4-shape.js && ES_THROWAWAY_DB=1 IDS_FILE=$T/ids.json node scripts/fixtures/phase5-shape.js && npx strapi admin:create-user --email=admin@example.com --password='Throwaway123' --firstname=Admin)`.
Expected: both fixtures print their "ok" line; the Super Admin is created.

- [ ] **Step 3: Lifecycle data (throwaway script `$T/lifecycle.js`)**

Same opening as plan 3C Task 14 Step 3 (`createStrapi(await compileStrapi()).load()`, `app.documents(uid)`), refusing unless `ES_THROWAWAY_DB=1`. It reads the ids file, then creates, writing the new ids back into it:

| Key | Rows |
|---|---|
| season | `2019-2020` (startMonth `2019-10-01`, endMonth `2020-05-31`, not current) |
| `carla` | athlete "Carla Vasilescu", birth `2013-06-18`, contact "Mama Vasilescu", phone "0799 555 101", e-mail `mama.vasilescu@example.com`, notes "Astm ușor"; membership Intermediari Bronze 2026-2027 |
| `bogdan` | athlete "Bogdan Cernat"; one payment 50 numerar `2026-10-20` altceva, cancelled |
| `paul` | athlete "Paul Dobre"; membership Intermediari Bronze 2026-2027; no money rows |
| `radu`, `raduDup` | athletes "Radu Enache" and "Radu Enache" (duplicate); each an 8-slot Standard subscription from `2026-10-27` |
| `oldA`, `oldB` | athletes "Vechi Unu", "Vechi Doi", membership in 2019-2020 only; `oldA` also attendance below |
| session `sess` | Intermediari Bronze, 2026-2027, `2026-11-07` 11:00, 50 min, source `added`, coach Virgil Pascu; attendance (`uniqueKey` "<sess>|<athlete>") of carla (slot on her subscription), Ana Ionescu, paul, radu (slot), raduDup (slot), oldA |
| carla money | subscription 8 slots 320 member from `2026-10-27` to `2026-11-23`; payment `pay1` 320 numerar `2026-10-27` abonament linked, `collectedAtRink` true, note "Plătit de bunica Vasilescu"; lesson `2026-10-28` 18:00 50 min Virgil Pascu saved present 80 |
| e-mail jobs | kind payment, `payment` `pay1`, recipient `mama.vasilescu@example.com`, subject "Plată înregistrată: Carla Vasilescu", payload `{ athleteName: 'Carla Vasilescu' }`, status `sent`, `sentAt` now |
| history | payment `pay1`: `payment-email-sent { recipient: 'mama.vasilescu@example.com' }`; `payment-edited { fields: { note: { from: null, to: 'Plătit de bunica Vasilescu' } } }` |

Run: `(set -a; . "$T/env"; set +a; ES_THROWAWAY_DB=1 IDS_FILE=$T/ids.json node $T/lifecycle.js)`; start Strapi on 1374 in the background; wait for `/_health` 204.
Expected: `lifecycle fixture ok`.

- [ ] **Step 4: Export never names the other child**

With `login`, `idof`, `call` as plan 3C Task 14 Step 4 (port 1374, `SUPER=$(login admin@example.com)`): download `/club/athletes/$CARLA/export`, unzip, read `rezumat.pdf` text as there.
Expected: `ok:` for `Prezență`, `7 nov 2026, Intermediari Bronze, 11:00, Grup`, `Lecții individuale`, `28 oct 2026, 18:00, 50 min, antrenor Virgil Pascu, prezent, 80 RON`, `Abonamente`, `1/8, activ, 320 RON` (`expirat` instead of `activ` when the check runs after 23 nov 2026), `Plăți`, `27 oct 2026, 320 RON, Numerar, Abonament 8 ședințe, la patinoar`; `grep -c 'Ana Ionescu\|Paul Dobre\|Radu Enache' $T/rezumat.txt` prints 0.

- [ ] **Step 5: Delete refusal and delete**

Run: `curl -s -X DELETE http://127.0.0.1:1374/api/club/athletes/$BOGDAN -H "Authorization: Bearer $SUPER" -w ' %{http_code}\n'`, then the same for `$PAUL`, then `q "select count(*) from club_attendances; select count(*) from club_sessions"` (`q` as plan 3C Task 14 Step 6, container `es54-pg`).
Expected: Bogdan: `409` with body `{"data":{"payments":1,"subscriptions":0},"error":{"status":409,"name":"ClubAdminError","message":"Sportivul are 1 plată. Ștergerea este blocată cât timp există plăți sau abonamente."}}`, Bogdan still listed; Paul: `200`; attendance count 5 (6 before), session count unchanged (1).

- [ ] **Step 6: Merge**

Run: `call "$SUPER" POST /club/athletes/merge "{\"keptId\":\"$RADU\",\"removedId\":\"$RADUDUP\",\"take\":[]}"`, then `q` the attendance rows of `sess` with their athlete document ids and subscription ids, and the athlete of both subscriptions.
Expected: `200`; one attendance row for Radu at `sess` (key `<sess>|<radu>`), its subscription Radu's own; both subscriptions now linked to Radu; attendance count 4.

- [ ] **Step 7: Inactivity sees attendance seasons**

Run: `curl -s http://127.0.0.1:1374/api/club/athletes/inactive-summary -H "Authorization: Bearer $SUPER"`
Expected: `"count":1` (Vechi Doi only; Vechi Unu is active through the 2026 attendance).

- [ ] **Step 8: Anonymize leaves no personal data, keeps the money**

Before: `MONEY="select count(*), sum(amount) from club_payments; select count(*) from club_subscriptions; select count(*) from club_attendances; select count(*) from club_individual_lessons"`; `q "$MONEY" > $T/money-before`; `SEEDED='Vasilescu|Carla|0799 555 101|0799555101|mama\.vasilescu@example\.com|2013-06-18|18\.06\.2013|Astm|bunica'`; `search` as plan 3C Task 14 Step 6 (`pg_dump` of `es54-pg` grepped for `$SEEDED`) prints several hits.
Run: `call "$SUPER" POST "/club/athletes/$CARLA/anonymize" '{}'`; `q "$MONEY" > $T/money-after`; `diff $T/money-before $T/money-after`; `search`; `q "select note, amount, method, paid_on, purpose, cancelled from club_payments order by id"`; `q "select status, recipient, subject, payload from email_jobs where kind = 'payment'"`.
Expected: `200`; `diff` prints nothing; `search` prints nothing; Carla's payment row keeps `320.00 | numerar | 2026-10-27 | abonament | f` with an empty note; the job reads `sent` with empty recipient, subject and payload.

- [ ] **Step 9: Restart once, clean up**

Run: stop Strapi, start it again on 1374 (spec 11.4), wait for `/_health` 204, stop it; `docker rm -f es54-pg`; `rm -rf "$T"`.
Expected: the second boot logs no error. Nothing to commit; log the result on the progress board.

---

## Interfaces for other plans

- **Plan 5-6 (delete refusal dialog):** HTTP 409 body of Task 3 (`data.payments`, `data.subscriptions`, `error.message`); `LIFECYCLE_DELETE.title(name)`, `deleteBlockedText(payments, subscriptions)`, `LIFECYCLE_DELETE.anonymizeInstead`, `.cancel`, `.anonymize` from `src/club/presence/copy.ts`; "Anonimizează" opens the existing 3C window (Super Admin only, C67).
- **Plan 5-3 (Sportivi list, `list.ts` and the `list` handler):** pass `activity: await loadPresenceActivity(presence)` to `inactiveAthleteIds` in `athleteListPage`, so the "Inactivi de peste N ani" filter sees phase 5 activity (Task 1 makes the field optional so nothing breaks before that).
- **Any later writer** of lifecycle-sensitive rows uses `inBothTransactions` when it mixes `ClubStore` and `PresenceStore` writes.

## Self-review

- **Spec coverage.** 4.20 (T1), 4.21 delete (T3), merge (T4), anonymize (T5), 4.21a export and the four sections, empty section, no other child, cancelled marked (T2), 4.23 new season (T1 tests, nothing to build), 5.14 copy and the 409 (T3; dialog in 5-6), 6 delete 409 (T3), 7.1 Delete / merge lock line (T3, T4, T5), 7.2 one transaction (decided 2), 8 "no address after anonymize" (T5), 11.1 4.20 and 4.21 bullets (T1, T3, T4, T5), 11.4 delete, anonymize, inactivity bullets (T6). Not here: 4.22 reactivation (5-2), every other rule per the index.
- **Step scan.** Code appears as signatures, test assertions and exact copy; bodies left to the implementer except the merge row rule (decided 5) and the order of writes inside `mergePresenceRows` (remove before update), which the signatures do not fix.
- **Type consistency.** `DeleteOutcome` (T3) is what `respondDelete` (T3) reads; `inBothTransactions` (T3) is used by T4 and T5 with the same argument order (club, presence, work); `ActivityRow` (T1) matches the inline type of `InactivityInput.activity`; `SummaryPresence` (T2, `summary-model.ts`) is what `presenceSummary` returns; `ClubEmailJob.paymentId` (T5) is what the fake filters on; `PresenceExportFacts.used` comes from 5-1 `usedSlots`.
- **Review Focus.** Export with other children (T2, T6), anonymize of money rows, notes, sent and queued jobs and Istoric (T5, T6), delete with cancelled-only rows (T3, T6), merge at one session with two slots (T4, T6), phase 5 activity in inactivity incl. absent lessons and cancelled payments (T1, T6): each has its test.
- **Proportion.** Six tasks over four spec subsections plus copy; code blocks are signatures and assertions.
