# Phase 11-3: Athlete History, Abonament Days and Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every abonament gets a short code ("A-0124") and every new payment a receipt number ("2026-0412") from one club counter that never goes back; the athlete record shows "Abonament curent" and "Alte abonamente" cards with the dates behind each used unit, and a paged "Prezențe" history of group sessions and individual lessons saying what paid for each.

**Architecture:** Formatting and the backfill plan are pure (`src/club/codes.ts`); the counter is a small table behind two `PresenceStore` methods using an atomic upsert inside the caller's transaction (`transactionScope().current()`), mirrored by the fake store with a parity test. Codes are allocated in the existing create transactions of `subscriptions/add.ts` and `payments/record.ts`. The history and the "Plată" rule are pure modules in `src/club/presence/history/` over bounded reads; the screens stay thin in `src/admin/dashboard/bani/`.

**Tech Stack:** Strapi 5.52.1 (TypeScript, knex on Postgres), React 18 admin, Vitest 3, Python Playwright, Postgres 16.

**Spec:** `docs/superpowers/specs/2026-11-07-admin-views-design.md` 2.3, 3.1, 3.2, 3.3, 3.5, 3.6, 4.3, 4.4 (athlete read), 5.4, 6 (S59), 7, 8, 9, builder defaults ("Abonament curent"), 12.7, 12.8. Mockups: `av-3c-plata-simplu.html` (q1 A), `av-4b-abonament-zile-pliabil.html` (q1 A, q2 A). Index: `docs/superpowers/plans/2026-11-07-phase11-index.md` ("Data migrations", contracts, ruling 5).

**Base:** `feat/athletes` with 11-1 merged. Branch `feat/p11-3`. Runs in parallel with 11-2; **Task 9 starts only after 11-2 is merged** (it uses the session panel's `athlete` query and `AthleteLink`): rebase on `feat/athletes` first.

**Parallel groups:** A: T1, T8 | B: T2 | C: T3, T5, T6 | D: T4, T7 | E: T9 | F: T10

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Codes rules, 8 Copy and views | base | 1: `src/club/codes.ts`; 8: `copy/prezenta-ui.ts`, `src/club/bani/athlete-cards-view.ts`, `history-view.ts` |
| B | 2 Counter type and store | 1 | `src/api/club-counter/**`, `presence/store.ts`, `strapi-store.ts`, fake store |
| C | 3 Codes on create, 5 Abonament usage, 6 Presence history | 2 | 3: schemas, `types.ts`, `add.ts`, `record.ts`, `history-lines.ts`, `copy/history.ts`; 5: `subscriptions/usage.ts`; 6: `presence/history/**`, two store reads |
| D | 4 Backfill, 7 Routes | 3; 6 | 4: `src/club/codes-backfill.ts`, `src/index.ts`; 7: `09-attendance.ts`, controller |
| E | 9 Athlete record screen | 5, 7, 8, plan 11-2 merged | `src/admin/dashboard/bani/**`, `10-subscriptions` handler, old month route removed |
| F | 10 Boot check and renders | all | none |

## Global Constraints

- As plan 11-1 "Global Constraints" (repo, worktree checks, precedence, checks after every task, code rules, design, copy, synthetic data, commits, progress board with `11-3 T<n>`).
- Codes and numbers are never renumbered or reused, also after cancel, undo or delete [2.3, S4]. Abonament code "A-" + at least 4 digits, one club sequence, counter key `subscription` [S5]. Receipt "<YYYY>-<seq>", seq at least 4 digits, YYYY the year of `paidOn` at creation, counter key `receipt:<YYYY>` [S6]. No receipt backfill: numbering starts at go-live [P11 review q1].
- Allocation runs inside the create's `store.transaction`, after every refusal, as the last step before the create (ruling 5). The counter row lock (`ON CONFLICT ... DO UPDATE`) is the only serialisation; no lock order change elsewhere (the counter is taken last, after every row lock of the create).
- Every route this plan adds uses `adminRoute(area)`: athlete presence history `club`.
- "Ședința <x>/<y>" has the same colour in every row; the abonament's payment status is never shown on it [P11 review q2].
- Task 10: `es113-pg` on 127.0.0.1:55474, Strapi 1393.

## Review Focus

- **Two admins adding abonamente (or recording payments) at the same moment**: two distinct consecutive numbers, never the same, never a unique violation answered as a 500. Pinned by T2 (fake parity), T3 (allocation order) and T10 (20 parallel creates).
- **The 8 s undo of "Adaugă abonament" with a payment**: both rows go, the next abonament takes the next number, the gap stays; a cancelled payment keeps its number. Pinned by T3 and T10.
- **A payment recorded on 2 January with `paidOn` 31 December**: number "<previous year>-<seq>" from that year's counter; a later edit of `paidOn` never changes it. Pinned by T3.
- **Backfill on a database where some abonamente already have codes** (a second boot, or rows created between deploy and backfill): only rows without a code get one, after the highest code in use, and the counter never goes down. Pinned by T1 (`planCodeBackfill`) and T4, T10 (second boot is a no-op).
- **An athlete with attendance rows in two abonamente and in Club, plus lessons, across page boundaries**: page 2 starts with the 11th newest row, units count in each abonament's use order (not page order), and a Club row turns "Plătit" once its month's Rămas is 0. Pinned by T6.

## Review batches

High tasks T1, T2, T3, T4 form batch R2; T7 is in batch R3 with 11-4 T1 and T2 (index). The plan's final review (Opus) runs after T10.

---

### Task 1: Codes and the backfill plan (high, Sonnet)

**Files:**
- Create: `src/club/codes.ts`
- Test: `src/club/__tests__/codes.test.ts`

**Interfaces:**
- Produces: `formatSubscriptionCode(n: number): string` ("A-0001", "A-0124", "A-10000"; RangeError for n < 1 or not an integer); `parseSubscriptionCode(v: string | null | undefined): number | null`; `formatReceiptNo(year: number, n: number): string` ("2026-0412", "2026-10000"); `parseReceiptNo(v): { year: number; seq: number } | null`; `RECEIPT_KEY = (year: number) => \`receipt:${year}\``, `SUBSCRIPTION_KEY = 'subscription'`; `type BackfillInput = { id: string; purchasedAt: string | null; createdAt: string | null; numericId: number; code: string | null }`; `planCodeBackfill(rows: BackfillInput[], counter: number): { assign: { id: string; code: string }[]; counterAtLeast: number }` (rows without a code in `purchasedAt`, then `createdAt`, then `numericId` order, nulls last; numbers start after `max(counter, highest code in use)`; `counterAtLeast` = the highest number in use after the plan; an empty plan when every row has a code).

- [ ] **Step 1: Write the failing test**

```ts
it('formats codes and receipt numbers, growing a digit past 9999', () => {
  expect(formatSubscriptionCode(1)).toBe('A-0001');
  expect(formatSubscriptionCode(124)).toBe('A-0124');
  expect(formatSubscriptionCode(10000)).toBe('A-10000');
  expect(formatReceiptNo(2026, 412)).toBe('2026-0412');
  expect(parseSubscriptionCode('A-10000')).toBe(10000);
  expect(parseReceiptNo('2026-0412')).toEqual({ year: 2026, seq: 412 });
  expect(parseSubscriptionCode('26-001')).toBeNull();
  expect(() => formatSubscriptionCode(0)).toThrow(RangeError);
});
it('backfills in purchase order after the highest code and never lowers the counter (9.2)', () => {
  const rows = [r('s3', '2026-10-03', 'A-0007'), r('s1', '2026-10-01', null), r('s2', null, null), r('s0', '2026-09-30', null)];
  expect(planCodeBackfill(rows, 5)).toEqual({ assign: [{ id: 's0', code: 'A-0008' }, { id: 's1', code: 'A-0009' }, { id: 's2', code: 'A-0010' }], counterAtLeast: 10 });
  expect(planCodeBackfill([r('s1', '2026-10-01', 'A-0003')], 9)).toEqual({ assign: [], counterAtLeast: 9 });
});
```

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/__tests__/codes.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** on the model of `src/club/registration-number.ts` (no imports from Strapi or Node).
- [ ] **Step 4: Run** `npx vitest run`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/codes.ts src/club/__tests__/codes.test.ts
git commit -m "feat(codes): abonament codes, receipt numbers and the backfill plan"
```

---

### Task 2: Counter table and store methods (high, Sonnet)

**Files:**
- Create: `src/api/club-counter/content-types/club-counter/schema.json`, `src/api/club-counter/routes/club-counter.ts` (`createCoreRouter(uid, { only: [] })`), `controllers/club-counter.ts`, `services/club-counter.ts` (factories, as the phase 5 types)
- Modify: `src/club/presence/store.ts`, `src/club/presence/strapi-store.ts`, `src/club/presence/__tests__/fake-store.ts`
- Test: `src/club/presence/__tests__/schemas.test.ts`, `fake-store.test.ts`, `strapi-store.test.ts`

**Interfaces:**
- Produces: type `api::club-counter.club-counter`, `collectionName: 'club_counters'`, `draftAndPublish: false`, hidden from the Content Manager, attributes `key` (string, required, unique), `value` (integer, required, min 0).
- Produces (`PresenceStore`): `nextCounter(key: string): Promise<number>` (inside a transaction only, throws "counter taken outside a transaction" otherwise; value after `+1`, 1 for a new key); `raiseCounter(key: string, atLeast: number): Promise<void>` (value becomes `greatest(value, atLeast)`, row created when missing); `counterValue(key: string): Promise<number>` (0 when missing).
- Strapi: `scope.current()` knex in the transaction; `insert({ document_id: createId(), key, value: 1, created_at, updated_at, published_at }).onConflict('key').merge({ value: knex.raw('club_counters.value + 1'), updated_at }).returning('value')` (the portal `lockLimit` pattern, `src/club/portal/strapi-store.ts`); `raiseCounter` merges `greatest(club_counters.value, ?)`.

- [ ] **Step 1: Write the failing tests**:

```ts
it('fake and real counters hand out the same numbers and never go back', async () => {
  const s = fakePresenceStore(seed());
  await expect(s.nextCounter('subscription')).rejects.toThrow('outside a transaction');
  expect(await s.transaction(async () => [await s.nextCounter('subscription'), await s.nextCounter('subscription')])).toEqual([1, 2]);
  await s.transaction(() => s.raiseCounter('subscription', 1));
  expect(await s.counterValue('subscription')).toBe(2);
  await s.transaction(() => s.raiseCounter('receipt:2026', 40));
  expect(await s.transaction(() => s.nextCounter('receipt:2026'))).toBe(41);
});
it('the Strapi counter is one upsert in the open transaction', async () => {
  const calls: string[] = [];
  const store = strapiPresenceStore(countingStrapi(calls));            // records knex calls, as lockingStrapi
  await store.transaction(() => store.nextCounter('subscription'));
  expect(calls).toEqual(['club_counters in trx', 'insert key=subscription value=1', 'onConflict key', 'merge value+1', 'returning value']);
});
```

`schemas.test.ts` pins the schema (unique `key`, hidden, `only: []`); `strapi-store.test.ts` "has exactly the methods of the fake store" passes with the three methods.

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/presence/__tests__/fake-store.test.ts src/club/presence/__tests__/strapi-store.test.ts src/club/presence/__tests__/schemas.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement**; the fake's transaction flag is the one its locks already use.
- [ ] **Step 4: Run** `npx vitest run`, `npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/api/club-counter src/club/presence/store.ts src/club/presence/strapi-store.ts src/club/presence/__tests__/fake-store.ts src/club/presence/__tests__/fake-store.test.ts src/club/presence/__tests__/strapi-store.test.ts src/club/presence/__tests__/schemas.test.ts
git commit -m "feat(presence): club counter with an atomic next number"
```

---

### Task 3: Code and receipt number on create (high, Sonnet)

**Files:**
- Modify: `src/api/subscription/content-types/subscription/schema.json` (`code`: string, unique), `src/api/payment/content-types/payment/schema.json` (`receiptNo`: string, unique), `src/club/presence/types.ts`, `strapi-store.ts` (`toSubscriptionRow`, `toPaymentRow`, create data), fake store, `subscriptions/add.ts`, `payments/record.ts`, `history-lines.ts`, `copy/history.ts`
- Test: `src/club/presence/__tests__/subscription-writes.test.ts`, `payment-writes.test.ts`, `history-lines.test.ts`, `schemas.test.ts`, `strapi-store.test.ts`

**Interfaces:**
- Consumes: T1 formatters and keys, T2 `nextCounter`.
- Produces: `SubscriptionRow = SubscriptionWrite & { id: string; code: string | null }`; `PaymentRow = PaymentWrite & { id: string; receiptNo: string | null }`; `createSubscription(data: SubscriptionWrite, code: string): Promise<string>`; `createPayment(data: PaymentWrite, receiptNo: string): Promise<string>`; `updateSubscription` / `updatePayment` never write either field (`Partial<...Write>` does not hold them). Every caller of the two creates passes a number (`tsc` lists them).
- `add.ts`: `code = formatSubscriptionCode(await store.nextCounter(SUBSCRIPTION_KEY))` right before `createSubscription`, after `findDuplicate` and `coverAllowed`; the "subscription-added" changes gain `code`.
- `record.ts` (`writePaymentLocked`): `receiptNo = formatReceiptNo(year(input.paidOn), await store.nextCounter(RECEIPT_KEY(year)))` right before `createPayment`, after `findDuplicate` and `overpayRefusal`; "payment-recorded" changes gain `receiptNo`.
- Lines (spec 3.6, S11): "Abonament adăugat: ... (A-0124)" and "Plată înregistrată: ..., ... (nr. 2026-0412)": the suffix is added when the key is present; old lines without it read as before.

- [ ] **Step 1: Write the failing tests**:

```ts
it('gives each new abonament the next code; undo leaves the gap (S4)', async () => {
  const ctx = fakePresenceContext(seed(), '2026-11-06');
  const a = ok(await addSubscription(ctx, A1, body()));
  expect((await ctx.store.subscription(a.value.subscriptionId))?.code).toBe('A-0001');
  ok(await undoPresenceAction(ctx, { actionId: a.actionId }));
  const b = ok(await addSubscription(ctx, A1, body()));
  expect((await ctx.store.subscription(b.value.subscriptionId))?.code).toBe('A-0002');
});
it('a double click takes no number', async () => {
  ok(await addSubscription(ctx, A1, body()));
  ok(await addSubscription(ctx, A1, body()));       // same within 10 s: the first row back
  expect(await ctx.store.counterValue('subscription')).toBe(1);
});
it('a refused abonament takes no number', async () => {
  expect((await addSubscription(ctx, A1, { ...body(), cover: ['not-his'] })).ok).toBe(false);
  expect(await ctx.store.counterValue('subscription')).toBe(0);
});
it('numbers payments per year of paidOn and never changes them', async () => {
  const p = ok(await recordPayment(ctx, pay({ paidOn: '2025-12-31' })));
  expect((await ctx.store.payment(p.value.paymentId))?.receiptNo).toBe('2025-0001');
  ok(await editPayment(ctx, p.value.paymentId, { ...pay(), paidOn: '2026-01-02' }));
  ok(await cancelPayment(ctx, p.value.paymentId));
  expect((await ctx.store.payment(p.value.paymentId))?.receiptNo).toBe('2025-0001');
  const q = ok(await recordPayment(ctx, pay({ paidOn: '2026-01-02' })));
  expect((await ctx.store.payment(q.value.paymentId))?.receiptNo).toBe('2026-0001');
});
it('history lines end with the code and the number (S11)', () => {
  expect(lineOf('subscription-added', { itemName: 'Abonament 8 ședințe', startsOn: '2026-11-01', validUntil: '2026-11-30', covered: 0, code: 'A-0124' }))
    .toContain('(A-0124)');
  expect(lineOf('payment-recorded', { amount: 320, method: 'numerar', purposeText: 'Abonament', receiptNo: '2026-0412' })).toMatch(/\(nr\. 2026-0412\)$/);
});
```

(`lineOf` wraps the existing history text builder; the abonament with payment inside "Adaugă abonament" gets both, in that order.)

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/presence/__tests__/subscription-writes.test.ts src/club/presence/__tests__/payment-writes.test.ts src/club/presence/__tests__/history-lines.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement**; `schemas.test.ts` pins `unique: true` on both attributes.
- [ ] **Step 4: Run** `npx vitest run`, both `tsc`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/api/subscription/content-types/subscription/schema.json src/api/payment/content-types/payment/schema.json src/club/presence src/club/presence/__tests__
git commit -m "feat(presence): abonament code and receipt number on create"
```

---

### Task 4: Boot backfill of abonament codes (high, Sonnet)

**Files:**
- Create: `src/club/codes-backfill.ts`
- Modify: `src/index.ts` (one call after `ensurePresenceIndexes`, inside its own try / catch with the `[codes]` log, as the index blocks)
- Test: `src/club/__tests__/codes-backfill.test.ts`

**Interfaces:**
- Consumes: T1 `planCodeBackfill`, T2 `raiseCounter`, `counterValue`.
- Produces: `type CodesBackfillPorts = { transaction: <T>(work: () => Promise<T>) => Promise<T>; lockAll: () => Promise<void>; rows: () => Promise<BackfillInput[]>; setCode: (id: string, code: string) => Promise<void>; counterValue: (key: string) => Promise<number>; raiseCounter: (key: string, n: number) => Promise<void> }`; `runCodesBackfill(ports: CodesBackfillPorts, log: (m: string) => void): Promise<{ assigned: number }>` (one transaction: lock `club_subscriptions` rows without a code `for update`, read, plan, write, raise; log `[codes] backfill: <n> abonamente` only when n > 0; no-op on an empty table [S64]); `codesBackfillPorts(strapi)` (knex through the presence store's scope: `setCode` with `strapi.db.query(SUBSCRIPTION).update`, `rows` with `select document_id, id, purchased_at, created_at, code`).

- [ ] **Step 1: Write the failing test** with in-memory ports: three rows without codes and one "A-0002" -> codes "A-0003", "A-0004", "A-0005" in purchase order, counter 5, log `[codes] backfill: 3 abonamente`; a second run assigns 0, logs nothing, counter still 5; a port that throws in `setCode` leaves no code written (the transaction port rolls back the in-memory copy) and the error reaches the caller.
- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/__tests__/codes-backfill.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** and wire it in `bootstrap()`.
- [ ] **Step 4: Run** `npx vitest run`, `npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/codes-backfill.ts src/index.ts src/club/__tests__/codes-backfill.test.ts
git commit -m "feat(codes): boot backfill of abonament codes"
```

---

### Task 5: Abonament usage (low, Sonnet)

**Files:**
- Create: `src/club/presence/subscriptions/usage.ts`
- Modify: `src/club/presence/money-api.ts` (new types beside the old ones; the old ones go in T9)
- Test: `src/club/presence/__tests__/usage.test.ts`

**Interfaces:**
- Produces: `SubscriptionUse = { unit: number; sessionId: string; date: string; startTime: string; groupName: string }`; `SubscriptionCard = { id: string; code: string | null; label: string; startsOn: string; validUntil: string; state: SubscriptionState; used: number; slots: number; uses: SubscriptionUse[] }` (`label` = `itemName`; the screen builds "Școala <luna>"); `AthleteSubscriptionCards = { groups: { name: string; main: boolean }[]; current: SubscriptionCard[]; others: SubscriptionCard[] }`; `usesOf(sub: SubscriptionRow, atts: AttendanceRow[], sessions: Map<string, SessionRow>, groupNames: Map<string, string>): SubscriptionUse[]` (rows with `subscriptionId === sub.id`, ordered by session date, start time, attendance id; unit 1..n); `readAthleteSubscriptionCards(store, athleteId, seasonId | null, today): Promise<AdminResult<AthleteSubscriptionCards>>` (`current`: state `activ` today, ending sooner first; `others`: the rest, newest `startsOn` first) [Builder defaults; S21].

- [ ] **Step 1: Write the failing test**: an 8-slot abonament used on 2 noi 17:00, 4 noi 17:00 and 4 noi 10:00 lists units `[1, '2026-11-02'], [2, '2026-11-04' 10:00], [3, '2026-11-04' 17:00]`; two active abonamente ending 30 noi and 15 noi -> `current` ids in order [15 noi, 30 noi]; an expired and a cancelled one under `others`, newest first; none active -> `current: []`.
- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/usage.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** with one subscription read, one attendance read (`subscriptionIds`), one session read (`ids`).
- [ ] **Step 4: Run** `npx vitest run`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/subscriptions/usage.ts src/club/presence/money-api.ts src/club/presence/__tests__/usage.test.ts
git commit -m "feat(abonamente): dated units of each abonament"
```

---

### Task 6: Athlete presence history and the "Plată" rule (low, Sonnet)

**Files:**
- Create: `src/club/presence/history/pay.ts`, `history/read.ts`
- Modify: `src/club/presence/store.ts`, `strapi-store.ts`, fake store (two bounded reads), `attendance/api-types.ts` (`HistoryRow`, `PresenceHistory`), `copy/prezenta-ui.ts` (`HISTORY_DETAIL`)
- Test: `src/club/presence/__tests__/presence-history.test.ts`, `fake-store.test.ts`, `strapi-store.test.ts`

**Interfaces:**
- Produces (store, S59): `athleteAttendancePage(athleteId: string, from: string, to: string, take: number): Promise<{ total: number; rows: (AttendanceRow & { startTime: string })[] }>` (session date in range, newest first by session date, start time, id desc; `take` rows); `athleteLessonPage(athleteId, from, to, take): Promise<{ total: number; rows: LessonRow[] }>` (`present` true only). Real: one count and one limited query each (knex join on the session for the order).
- Produces (`pay.ts`, pure, 4.3a): `type PayInput = { row: HistorySource; subscriptionUnits: Map<string, number>; slots: Map<string, { slots: number; code: string | null }>; clubMonths: ClubMonth[]; lessonPaid: Map<string, number> }`; `payOf(i): HistoryRow['pay']`; `detailOf(i): string | null` ("Club, noiembrie: de plătit 400 RON, plătit 200 RON, rămas 200 RON.", "Lecție individuală: 150 RON, plătit 0 RON.", "Lecție individuală: fără preț.", "Fără abonament.", null for unit rows); `payLabel(pay): string` ("Ședința 3/8 A-0124", "Plătit", "Neplătit"; reused by the 11-4 Prezență subject).
- Rule: Școala row with `subscriptionId`: `unit` (place in that abonament's use order, from `usesOf`), `slots`, `code`; Școala `fara_abonament`: `unpaid`; Club row (`club`, `inclus`, `fara_pret`): `paid` when its Club month (P5 `clubMonths`) has `left` 0, else `unpaid`; lesson: `paid` when `amount` minus non-cancelled `lectie` payments with that `lessonId` is 0 or less (a null price counts as 0), else `unpaid`.
- Produces: `readPresenceHistory(store, athleteId: string, seasonId: unknown, page: unknown): Promise<AdminResult<PresenceHistory>>` (`PresenceHistory = { seasonLabel; total; page; pageSize: 10; rows: HistoryRow[] }`; reads `take = 10 * page` of each source, merges newest first (date, start time, then id), slices the page; `place` = group name, or "Cu <antrenor>" with the lesson's coach names joined by ", "; 404 unknown athlete or season; page < 1 or not an integer: 400).

- [ ] **Step 1: Write the failing tests** (seed: athlete with 6 rows in abonament A-0001 (8 slots), 3 rows in A-0002, 2 Club rows in November (month left 200) and 1 in October (left 0), 1 `fara_abonament`, 2 present lessons (one paid by a `lectie` payment, one not), 1 absent lesson):

```ts
it('pages 10 newest first over both sources', async () => {
  const p1 = ok(await readPresenceHistory(f.store, ATH, SEASON, 1));
  expect([p1.total, p1.rows.length]).toEqual([15, 10]);
  const p2 = ok(await readPresenceHistory(f.store, ATH, SEASON, 2));
  expect(p2.rows.length).toBe(5);
  expect(p2.rows[0].date <= p1.rows[9].date).toBe(true);
});
it('labels each row by the 4.3a rule', async () => {
  const rows = (await allPages()).map((r) => [r.kind, payLabel(r.pay), r.detail]);
  expect(rows).toContainEqual(['grup', 'Ședința 6/8 A-0001', null]);
  expect(rows).toContainEqual(['grup', 'Neplătit', 'Club, noiembrie: de plătit 400 RON, plătit 200 RON, rămas 200 RON.']);
  expect(rows).toContainEqual(['grup', 'Plătit', 'Club, octombrie: de plătit 40 RON, plătit 40 RON, rămas 0 RON.']);
  expect(rows).toContainEqual(['grup', 'Neplătit', 'Fără abonament.']);
  expect(rows).toContainEqual(['individual', 'Plătit', 'Lecție individuală: 150 RON, plătit 150 RON.']);
  expect(rows).toContainEqual(['individual', 'Neplătit', 'Lecție individuală: 150 RON, plătit 0 RON.']);
  expect(rows.filter(([k]) => k === 'individual')).toHaveLength(2);            // the absent lesson is left out
});
```

Store parity: the fake and the Strapi query builder order and limit the same way (fake test; Strapi test records the knex calls).

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/presence/__tests__/presence-history.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement**; the Club months come from one read of the athlete's attendances, lessons and payments of the season (bounded by one athlete).
- [ ] **Step 4: Run** `npx vitest run`, `npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/history src/club/presence/store.ts src/club/presence/strapi-store.ts src/club/presence/attendance/api-types.ts src/club/presence/copy/prezenta-ui.ts src/club/presence/__tests__
git commit -m "feat(presence): athlete presence history with what paid for each row"
```

---

### Task 7: Presence history route (high, Sonnet)

**Files:**
- Modify: `src/api/club/routes/09-attendance.ts`, `src/api/club/controllers/attendance.ts`
- Test: `src/club/presence/__tests__/attendance-routes.test.ts`

**Interfaces:**
- Produces: `GET /club/athletes/:documentId/presence` -> `attendance.athletePresence` (`adminRoute('club')`), query `season`, `page`; declared beside the other `/club/athletes/:documentId/*` routes, fixed paths first.

- [ ] **Step 1: Write the failing test**: the route exists with area `club`; the exact-list test gains it; static-before-params holds.
- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/attendance-routes.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** (one line handler over `readPresenceHistory`).
- [ ] **Step 4: Run** `npx vitest run`, both `tsc`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/api/club/routes/09-attendance.ts src/api/club/controllers/attendance.ts src/club/presence/__tests__/attendance-routes.test.ts
git commit -m "feat(attendance): athlete presence history route"
```

---

### Task 8: Copy and views for the cards and the history (low, Haiku)

**Files:**
- Modify: `src/club/presence/copy/prezenta-ui.ts`
- Create: `src/club/bani/athlete-cards-view.ts`, `src/club/bani/history-view.ts`
- Test: `src/club/bani/__tests__/athlete-cards-view.test.ts`, `history-view.test.ts`

**Interfaces:**
- Produces (copy, exact): `CARD_COPY = { current: 'Abonament curent', others: 'Alte abonamente', none: 'Fără abonament.', showDays: 'Vezi zilele', hideDays: 'Ascunde zilele', unit: (n: number) => \`Ședința ${n}\`, states: { activ: 'Activ', epuizat: 'Epuizat', expirat: 'Expirat', anulat: 'Anulat' } }`; `HISTORY_COPY = { title: 'Prezențe', cols: ['Data', 'Grupă', 'Tip', 'Plată'], grup: 'Grup', individual: 'Individual', paid: 'Plătit', unpaid: 'Neplătit', openSession: 'Deschide ședința', openLesson: 'Deschide lecția', with: (names: string) => \`Cu ${names}\`, empty: (season: string) => \`Nicio prezență în sezonul ${season}.\` }`.
- Produces (`athlete-cards-view.ts`): `cardName(startsOn)` ("Școala noiembrie") [S47]; `cardPeriod(startsOn, validUntil, today)` ("1 noi - 30 noi", "1 sep 2025 - 28 sep 2025" outside the current year); `cardCount(used, slots)` ("3/8"); `segments(used, slots): boolean[]`; `useRow(u: SubscriptionUse, today)` -> `{ title: 'Ședința 1', when: 'Lun 2 noi, 17:00', group }`.
- Produces (`history-view.ts`): `historyCount(total, seasonLabel)` ("42 de prezențe în sezonul 2026-2027", "1 prezență în sezonul 2026-2027", by `countWords`) [S48]; `historyDate(date, time, today)` ("Vin 6 noi, 18:00", year added outside the current year); `payView(pay): { label: string; code: string | null; tone: 'unit' | 'paid' | 'unpaid' }` (one tone for every unit row).

- [ ] **Step 1: Write the failing tests** with every example above.
- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/bani/__tests__/athlete-cards-view.test.ts src/club/bani/__tests__/history-view.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/copy/prezenta-ui.ts src/club/bani/athlete-cards-view.ts src/club/bani/history-view.ts src/club/bani/__tests__/athlete-cards-view.test.ts src/club/bani/__tests__/history-view.test.ts
git commit -m "feat(bani): views for abonament cards and the presence history"
```

---

### Task 9: "Grupe și abonament" screen (low, Sonnet)

Starts after plan 11-2 is merged (rebase first).

**Files:**
- Create: `src/admin/dashboard/bani/AbonamentCard.tsx`, `src/admin/dashboard/bani/PresenceHistory.tsx`
- Modify: `src/admin/dashboard/bani/AbonamentTab.tsx`, `bani/api.ts`, `bani/styles.ts`, `src/api/club/controllers/subscriptions.ts` (`athlete` handler -> `readAthleteSubscriptionCards`), `src/club/presence/money-api.ts` (old `bars` / `earlier` types removed), `src/api/club/routes/09-attendance.ts` and `controllers/attendance.ts` (remove `GET /club/athletes/:documentId/attendance`)
- Delete: `src/club/presence/attendance/athlete-month.ts`, `src/club/presence/__tests__/attendance-month.test.ts`, the now unused `bani/AbonamentBar.tsx` parts and `athlete-money-view.ts` helpers (`tsc` and the import guard list them)
- Test: `src/club/__tests__/money-ui-source.test.ts` (extend), `attendance-routes.test.ts`, `money-routes.test.ts`

**Interfaces:**
- Consumes: T5, T7, T8; 11-2 `usePrezentaApi().session(..., athleteId)`, `SessionPanel` `highlightAthleteId`, `AthleteLink`.
- Produces: spec 5.4: order "Grupe", "Abonament curent", "Alte abonamente" (hidden when empty), "+ Adaugă abonament", "Prezențe". Card: line 1 code muted, name, period, square state label; line 2 square segments and "3/8" (no "folosite"); "Vezi zilele" / "Ascunde zilele" (closed by default, hidden at 0 used); dated rows with a chevron open `SessionPanel` with the athlete highlighted. History: the count card, columns "Data" | "Grupă" | "Tip" | "Plată", `Pager` (10 a page), a unit row opens the session panel, a "Plătit" / "Neplătit" row opens an `ExpandableRow` line with the detail and "Deschide ședința" / "Deschide lecția"; empty text. The season is the tab's season (`seasonId` prop).

- [ ] **Step 1: Write the failing source tests**: `AbonamentTab.tsx` renders `CARD_COPY.current` before `CARD_COPY.others` and `HISTORY_COPY.title` last, imports no `MonthLine`; `AbonamentCard.tsx` toggles with `CARD_COPY.showDays` / `hideDays` and passes the athlete id to the session panel; `PresenceHistory.tsx` uses `Pager`, `ExpandableRow` only for `pay.kind !== 'unit'`, one class for every unit label (no class derived from the abonament's payment state); no `dashed`, `dotted`, `border-radius: 50%` in `bani/`; the route list has no `/club/athletes/:documentId/attendance`.
- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/__tests__/money-ui-source.test.ts src/club/presence/__tests__/attendance-routes.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement**; phone 390 px: card lines wrap, dated list under the card, history rows as cards.
- [ ] **Step 4: Run** all checks (`npx vitest run`, both `tsc`, `node scripts/admin-ui-check.mjs --strict`); Expected: PASS, 0, exit 0.
- [ ] **Step 5: Commit**

```bash
git add -A src/admin/dashboard/bani src/api/club src/club/presence src/club/bani src/club/__tests__/money-ui-source.test.ts
git commit -m "feat(bani): abonament cards with their days and the presence history"
```

---

### Task 10: Boot check, concurrency, click-through and renders (low, Sonnet)

**Files:** none in the repo. `T=${TMPDIR:-/tmp}/es113`. PNGs to `.../phase11-renders/11-3-<name>-<desktop|phone>.png`.

- [ ] **Step 1: Phase 5 data first, then the new code**: start `es113-pg` (55474); check out the commit before T1 (`git worktree add $T/before <sha>`), build it, run `phase4-shape.js` and `phase5-shape.js`, and through its routes add 5 abonamente (two for one athlete) and 3 payments; stop it. Build this branch, start Strapi 1393 on the same database.
- [ ] **Step 2: Backfill checks**

```bash
psql -h 127.0.0.1 -p 55474 -U postgres es113 -c "select code, purchased_at from club_subscriptions order by purchased_at"
psql ... -c "select key, value from club_counters"
psql ... -c "select count(*) from club_payments where receipt_no is null"
```

Expected: codes "A-0001".."A-0005" in `purchased_at` order; `subscription | 5`; the 3 old payments have no number; the log has one `[codes] backfill: 5 abonamente`. Restart Strapi: no second backfill line, codes unchanged.

- [ ] **Step 3: Concurrency**: 20 parallel `POST /club/payments` for 20 athletes (`paidOn` today) and 10 parallel `POST /club/athletes/:id/subscriptions` (different athletes), with `xargs -P 20` over prepared bodies.

```bash
psql ... -c "select count(*), count(distinct receipt_no), min(receipt_no), max(receipt_no) from club_payments where receipt_no is not null"
psql ... -c "select count(distinct code) from club_subscriptions"
```

Expected: every call 200; 20 distinct numbers "<YYYY>-0001".."<YYYY>-0020"; 15 distinct codes, the new ones "A-0006".."A-0015". Then add one abonament with a payment, `POST /club/undo` it, add another: its code skips one number and the receipt skips one number. Cancel a payment: its `receipt_no` stays.

- [ ] **Step 4: History and usage**: `GET /club/athletes/$A/presence?season=$S&page=1` and `page=2` (an athlete with 12 rows, one Club month partly paid, one lesson); `GET /club/athletes/$A/subscriptions` (`current`, `others`, `uses` dates). Expected: 10 + 2 rows, labels by the 4.3a rule, `uses` in use order.
- [ ] **Step 5: Click-through and renders**: the athlete record, tab "Grupe și abonament": `abonament-curent`, `vezi-zilele` (expanded), a unit row -> `panou-sportiv-evidentiat`, `alte-abonamente`, `prezente-pagina-1`, the pager -> `prezente-pagina-2`, a "Neplătit" row -> `prezenta-detaliu`, an athlete without anything -> `fara-abonament`. Record `r['card_lines']`, `r['history_count']`, `r['pay_labels']`, `r['unit_label_classes']` (one value). Expected: phone `no_side_scroll` True, `page_errors == []`.
- [ ] **Step 6: Look at the renders** next to av-3c and av-4b: texts of 5.4 word for word, "3/8" without "folosite", the unit label the same colour on every row, square labels and segments, no dashed or dotted line. Fixes in T8 or T9 files with `fix(bani): ...`.
- [ ] **Step 7: Clean up**: stop Strapi, `docker rm -f es113-pg`, `git worktree remove $T/before`, `rm -rf "$T"`.

---

## Interfaces for other plans

- **11-4:** `SubscriptionRow.code`, `PaymentRow.receiptNo`, `usesOf`, `payOf`, `payLabel`, `formatSubscriptionCode`.
- **11-5:** `PaymentRow.receiptNo`, `SubscriptionRow.code` for the Abonamente, Plăți, De încasat and payment window texts; `formatReceiptNo`.
