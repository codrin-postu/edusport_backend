# Phase 5-3: Abonamente and Payments (backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin API every money rule of phase 5: add an abonament (items, coverage of "Fără abonament" attendances, optional payment), extend all active ones, cancel one, the Gold carry on a group move and its preview, the Sportivi "Abonament" column data, payments (record, edit, cancel, A.C.S. effect), the "Pentru" options, the athlete "Plăți" tab data, "De încasat" (Școala and Club parts) and the "Plată înregistrată" e-mail, behind `10-subscriptions.ts`, `11-payments.ts` and one new `06-groups.ts` route.

**Architecture:** Pure rules in `src/club/presence/subscriptions/rules.ts`, `carry.ts`, `payments/rules.ts` and `due/settlement.ts` (no Strapi imports; the admin bundle of plan 5-6 imports them). Services take a `PresenceContext` (plan 5-1) and run one `store.transaction` each with the 7.1 lock suffix they need; every write records its Istoric lines and, where spec 7.3 has one, a `PresenceUndoRecord` through `recordPresenceAction`, so the existing `POST /club/undo` takes it back. The Gold carry is a port the phase 4 move calls inside its own transaction, and its undo is one new phase 4 undo op served by the same port. The e-mail is a new job kind on the existing Brevo queue.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS), Postgres 16, Vitest 3, Node 22.

**Spec:** `docs/superpowers/specs/2026-10-27-attendance-payments-design.md` (v1, approved 2026-10-27): 3.4, 3.5, 3.7, 4.8, 4.8a, 4.9, 4.11, 4.13 to 4.17, 4.19, 5.7 (data), 5.8 to 5.13 (data and server copy), 6 (subscriptions, payments, move preview, Sportivi), 7.1 to 7.3, 8 (writers), 9, 11.1 (4.8a, 4.9, 4.11, 4.14 to 4.17), 11.3, 11.4. Index: `docs/superpowers/plans/2026-10-27-phase5-index.md` ("Shared interfaces" is binding for names). Consumes plan 5-1: `docs/superpowers/plans/2026-10-27-phase5-1-presence-foundation.md`. Mockups (recommended options chosen everywhere except p5-4 Q22, where the e-mail is OFF by default): `.superpowers/phase5/screens/p5-2-abonamente.html`, `p5-3-club-preturi.html`, `p5-4-plati.html`, `p5-7-confirm.html`. Decisions: `../edusport_frontend/docs/portal/DECISIONS.md`.

**Base:** `feat/athletes` with plan 5-1 merged.

**Parallel groups:** A: T1, T2, T3 | B: T4, T8, T9 | C: T5, T6, T7 | D: T10 | E: T11

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Abonament rules, 2 Payment and settlement rules, 3 E-mail | 5-1 | 1: `subscriptions/rules.ts`, `copy/subscriptions.ts`; 2: `payments/rules.ts`, `due/settlement.ts`, `copy/payments.ts`; 3: `copy/email.ts`, `src/email/*`, `context.ts`, fake context. `copy.ts` gets one line from each, appended in commit order |
| B | 4 Payment writes, 8 Move carry, 9 Sportivi data | A (9's activity part also after plan 5-4) | 4: `payments/record.ts`, `edit.ts`, `cancel.ts`; 8: `subscriptions/carry.ts`, `move.ts`, `groups/members.ts`, `groups/undo.ts`, `groups/undo-service.ts`; 9: `subscriptions/cells.ts`, `athletes/list.ts`, `athletes/api-types.ts` |
| C | 5 Add and cancel abonament, 6 Extend, 7 Reads | 4 (5), A (6, 7) | 5: `subscriptions/add.ts`, `cancel.ts`; 6: `subscriptions/extend.ts`; 7: `money-api.ts`, `subscriptions/reads.ts`, `payments/reads.ts`, `due/reads.ts` |
| D | 10 Routes and controllers | everything above | route and controller files only |
| E | 11 Boot check | everything | no repo files |

Risk: **high** T1, T2, T3, T4, T5, T6, T7, T8, T11 (slots, money, A.C.S., e-mail sending, locks, undo, totals); **low** T9, T10. Per-task reviews run on high tasks only.

## Decided while planning (low impact, decided by Claude; the user may overrule any line)

Log them in DECISIONS.md as "plan 5-3, decided by Claude (low impact, 2026-10-27)". Each is implemented in the one place named.

1. **Double click.** A payment identical to one the same admin recorded for the same athlete less than 10 s ago (amount, method, `paidOn`, purpose and its link, not cancelled) is not written again; the answer repeats the first payment with no undo (`actionId` null). Same for an abonament (athlete, list, item, `startsOn`, by the same admin, less than 10 s). No new copy (`payments/record.ts`, `subscriptions/add.ts`).
2. **Amounts.** A sent amount must be a finite number with at most two decimals (checked as `Math.abs(n * 100 - Math.round(n * 100)) < 1e-6`) and `0 < n <= 100000`; it is stored rounded to bani. More decimals or more than 100000: 400 "Cerere invalidă."; 0 or less: "Suma trebuie să fie mai mare decât 0." (`payments/rules.ts::readAmount`).
3. **Extend key.** The preview answers `{ count, key }`; `key` is a stamp of the extendable rows (`id:extendedWeeks:validUntil`, sorted). `POST /club/subscriptions/extend` must send the same `key`; a different one (a second click, a slot used, a new abonament) answers 409 "Abonamentele s-au schimbat. Reîncarcă pagina." (`subscriptions/rules.ts::extendKey`).
4. **"activ din" and "din" dates** use the short day and month of the mockups ("27 oct"), not "27 oct 2026" (`startText` in `subscriptions/rules.ts`).
5. **"Club, <lună>" options:** the current month always, plus the 11 months before it that have a Club or lesson due; 12 consecutive months never repeat a month name (`payments/rules.ts::paymentOptions`).
6. **`acsBefore` null** means the athlete had no A.C.S. row for that season; a revert then deletes the row (`setAcs(..., null)`) (`payments/rules.ts`).
7. **Cancelling a payment** also cancels its e-mail while it is still queued (inside the 15 s hold); its undo does not queue it again (`payments/cancel.ts`).
8. **Refusals without new copy:** a payment or abonament for an anonymized athlete, "Trimite e-mail" for an athlete without a contact e-mail, a link to a cancelled abonament or a lesson not held, "Anulează abonamentul" while a non-cancelled payment points to it: 409 `PRESENCE_ERRORS.stale` ("Datele s-au schimbat. Reîncarcă pagina."). A covered attendance that is no longer "Fără abonament": 409 `PRESENCE_ERRORS.conflict`.
9. **Lists for "the abonament 4.10 would use today"** (Sportivi cell, move bar): the lists of the athlete's current groups in the season of today that are school groups; with none, every list (`currentSubscription`).
10. **Carry with a frozen price null:** carried only when the new list has no price for that item (`carry.ts`).
11. **Move answer** gains `carried: number`; the move's undo is refused (phase 4 text "Nu se mai poate anula. ...", `GROUP_ERRORS.undoGroup`) once a carried abonament used a slot in a group of the new list (`groups/undo-service.ts`).
12. **Number forms of the bar labels:** "1 folosită", "1 rămasă" (`countWords`), the approved "<n> folosite", "<n> rămase" otherwise (`copy/subscriptions.ts`).
13. **"E-mail ... trimis la <adresă>." line** is written when the job is sent (first attempt or the hourly cron), actor = the payment's `recordedBy` (`strapi-email.ts` `onSent`).
14. **De încasat and the Plăți tab with no start date set:** no month limit (`due/settlement.ts`).
15. **Months on the Plăți tab and the Club part:** a month is listed when the athlete has a Club attendance, a present lesson or a non-cancelled Club or lesson payment in it; Club attendance = `billing` `club`, `inclus` or `fara_pret` (`due/settlement.ts`).
16. **"Ședințe" text** drops a zero part: "6 (6 grup)", "9 (6 grup, 2 uscat, 1 individuală)" (`copy/payments.ts::sessionsText`).
17. **"Altceva" in Plăți:** "Altceva, <first 4 words of the note>" (C61) (`payments/rules.ts::listPurposeText`).
18. **`itemKey`** of the add body is the item's name (unique per school, phase 2 rule) (`subscriptions/add.ts`).
19. **Detail lines on the Plăți tab:** an attendance "<Zi dd lun>, <grupă>, Grup 40 RON, Uscat inclus" (a line without price "Grup fără preț"); a lesson "<Zi dd lun>, Lecție individuală 80 RON" ("Lecție individuală fără preț") (`copy/payments.ts`).
20. **Files outside the index's 5-3 list, each with a one-purpose edit:** `src/email/email-jobs.ts` and `src/email/strapi-email.ts` (the new job kind would otherwise be sent as a registration e-mail by the hourly cron), `src/club/athletes/api-types.ts` (`AthleteListRow.abonament`), `src/club/presence/__tests__/fake-store.ts` (fake `paymentEmails`), new `src/club/presence/money-api.ts` (response types plan 5-6 imports); `controllers/groups.ts` changes three handlers (`move`, `undo`, new `movePreview`).
21. **Inactivity on the Sportivi list** (relay from plan 5-4): `athleteListPage` gains a last parameter `presence: ListPresence` after `now`, so phase 3 callers stay unchanged; the controller passes plan 5-4's `loadPresenceActivity(presence)` as `activity` (`list.ts`, `controllers/athletes.ts`).

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes`. Commit only in the worktree your dispatch names (never in p3be or p3fe); before every commit run `git rev-parse --show-toplevel` and `git branch --show-current` and compare with the dispatch.
- A dated DECISIONS.md entry wins over the spec; the spec wins over this plan's prose.
- Checks after every task: the task's test file (`npx vitest run <file>`), the full suite (`npx vitest run`), `npx tsc --noEmit` (zero errors).
- Code: TypeScript, no `any`, single quotes, semicolons, 2-space indent, functions under 30 lines, cyclomatic complexity under 10, no dead code, no comments that restate code.
- Data (spec 3.4, 3.5): dates `YYYY-MM-DD`; amounts in RON as numbers, sums through `sumMoney`, shown through `ron` ("320 RON", "12,50 RON"); `validUntil` = `subscriptionValidUntil(startsOn, extendedWeeks)` (`src/club/subscription.ts`); prices frozen at purchase, never re-read.
- Lock order (spec 7.1, binding): athletes (sorted), lessons, subscriptions (sorted), payments (sorted); re-read after locking; never lock outside `store.transaction`. Extend never locks an athlete.
- Every write action is one transaction inside `guarded(ctx.log, '<tag>', ...)`; failure 500 "Acțiunea nu a reușit. Nimic nu a fost salvat."; every write records its Istoric lines with the `changes` keys of plan 5-1 Task 10; an undoable action records through `recordPresenceAction(store, actor, lines, { steps, athletes, guards })` with guards from `guardOf` after its writes; the answer is `ActionResult` (`done(value, actionId)`).
- Undo refusal text: "Nu se mai poate anula. Datele s-au schimbat între timp." (`PRESENCE_ERRORS.undoChanged`, plan 5-1).
- Never send an e-mail the admin did not tick (spec 2.3, 4.19); `sendEmail` is false unless the body says `true`.
- Copy: every string in `src/club/presence/copy/*.ts`, exactly as the spec gives it; ș and ț with the comma below; straight quotes; "->" is "→" (`ARROW`); no em or en dash, no middle dot, no emoji; number forms through `countWords`.
- Synthetic data only. Never touch production, `strapi_app`, `strapi_db`, `edusport-test-pg`, ports 1337, 1340, 3010, 5432, 55442. Task 11 uses container `es53-pg` on 127.0.0.1:55453 and Strapi on 1373.
- Commits: Conventional Commits, the message given in the task, no `Co-Authored-By`, no AI attribution (check with `git log -1 --format=%B`). Never push. Never commit `.env`.
- Progress board: one line per status change to `/Users/codrin/Documents/Programming/edusport_backend/.superpowers/phase3-shared/progress-board.md`, e.g. `printf '%s | 5-3 T4 | implementer | tests green\n' "$(date -u +%H:%M)" >> <that path>`.

## Review Focus

- **Double payment on a double click** (two identical `POST /club/payments`, or two "Adaugă abonament" with a payment, within a second): one payment row, one abonament, one e-mail job; the second answer carries the first's values and `actionId` null. Pinned by Task 4 (`a second identical payment within 10 s is not written`), Task 5 (`a second identical abonament ...`) and Task 11 (two curl calls).
- **A slot used twice under concurrency** (a session save gives a "Fără abonament" row a slot while the "Adaugă abonament" window is open; more rows ticked than slots; a row freed by "Anulează abonamentul" covered again): coverage is checked again under the athlete lock, a row that is no longer `fara_abonament` refuses the whole action with 409 and nothing is written, never more covered rows than slots. Pinned by Task 1 (`checkCover`), Task 5.
- **Gold carry** (Standard -> Gold carried, Gold -> Standard not, Gold list without a price yet, a carried abonament then used in a Gold session and the move undone): carried exactly when spec 4.11 says, the line "Valabil și în lista Avansați Gold." written in the move, the undo removes the carry and is refused once a Gold slot was used. Pinned by Task 8.
- **Expiry and extension edges** (an abonament on its last valid day, one expired yesterday, one used up, a cancelled one; extend sent twice from one preview; the extension undone after another extension): only the first is extended, `validUntil` recomputed from `startsOn` + 27 days + 7 per week, the second request 409, the undo refused. Pinned by Task 1 (`extendableIds`) and Task 6.
- **Cancel with payments** ("Anulează abonamentul" while a payment points to it; after that payment is cancelled; the toast undo after a freed row was covered again; "Anulează plata" on a fee payment while another fee payment of the season remains): refused, allowed, refused, A.C.S. left "Da". Pinned by Task 5 and Task 4.
- **Rounding of RON amounts** (`12.345`, `0.1 + 0.2`, `0.004`, a price read as `"40.00"`, three payments of 33.33 against a 100 RON price): refused, 0.3, refused, 40, "Rămas" 0,01 RON never float noise. Pinned by Task 2 and Task 7.

---

## File Structure

```
src/club/presence/
  copy/subscriptions.ts      SUBSCRIPTION_COPY: window, extend modal, toasts, bar labels (T1)
  copy/payments.ts           PAYMENT_COPY: window labels, errors, "Pentru" texts, De încasat texts, sessionsText, detail lines (T2)
  copy/email.ts              PAYMENT_EMAIL_COPY (T3)
  copy.ts                    + three export lines (T1, T2, T3)
  subscriptions/rules.ts     school lists, offered items, coverage, write builder, extension, bar, current abonament, cell text (T1)
  subscriptions/add.ts       newSubscriptionForm, addSubscription (T5)
  subscriptions/cancel.ts    cancelSubscription (T5)
  subscriptions/extend.ts    extendPreview, extendSubscriptions (T6)
  subscriptions/reads.ts     listSubscriptions, athleteSubscriptions (T7)
  subscriptions/carry.ts     carryList (pure, 4.11) (T8)
  subscriptions/move.ts      presenceCarry (move port and undo ports), movePreview (T8)
  subscriptions/cells.ts     abonamentCells (Sportivi) (T9)
  payments/rules.ts          readPaymentInput, purpose fields and texts, options, A.C.S. effect, field changes (T2)
  payments/record.ts         writePaymentLocked, recordPayment (T4)
  payments/edit.ts           editPayment (T4)
  payments/cancel.ts         cancelPayment (T4)
  payments/reads.ts          listPayments, athletePayments, athletePaymentOptions (T7)
  due/settlement.ts          clubMonths, schoolDue, mainGroupToday (pure) (T2)
  due/reads.ts               readDue (T7)
  money-api.ts               response types of every 10/11 route (T7)
  context.ts                 + paymentEmails (T3)
  __tests__/fake-store.ts    fake context + paymentEmails, emailsAfter (T3)
src/email/payment-email.ts   template, payload check, job builder (T3)
src/email/email-jobs.ts, src/email/strapi-email.ts   kind payment, onSent, attemptPaymentEmails (T3)
src/club/groups/members.ts, undo.ts, undo-service.ts   carry in the move, op uncarry (T8)
src/club/athletes/list.ts, api-types.ts                "Abonament" column and filter (T9)
src/api/club/routes/10-subscriptions.ts, 11-payments.ts, 06-groups.ts (one line)   (T10)
src/api/club/controllers/subscriptions.ts, payments.ts, groups.ts (move, undo, movePreview), athletes.ts (list)   (T10)
```

---

### Task 1: Abonament rules and copy (high)

**Files:**
- Create: `src/club/presence/subscriptions/rules.ts`, `src/club/presence/copy/subscriptions.ts`
- Modify: `src/club/presence/copy.ts` (one line)
- Test: `src/club/presence/__tests__/subscription-rules.test.ts`

**Interfaces:**
- Consumes (5-1): `SubscriptionRow`, `SubscriptionWrite`, `AttendanceRow`, `PriceListRecord`, `slotCandidates`, `subscriptionState`, `isValidForList`, `usedSlots`, `listDate`, `longDate`, `sumMoney`; `GroupRecord`, `SectionRecord`, `SeasonRecord`, `MembershipRow`; `priceFor`, `offeredItems`, `Audience`; `subscriptionValidUntil`; `MONTHS_SHORT`; `countWords`.
- Produces (`subscriptions/rules.ts`):

```ts
export type OfferedItem = { itemKey: string; itemName: string; slots: number; price: number; priceListId: string; listName: string };
export type CoverRow = { attendanceId: string; date: string; groupId: string; groupName: string; priceListId: string | null };
export type AbonamentBar = { subscriptionId: string; itemName: string; slots: number; used: number; validUntil: string };
export function schoolListIds(lists: readonly PriceListRecord[], sections: readonly SectionRecord[]): Set<string>;
/** C22: the athlete's main school group's list on the date; with no school group, every school list. */
export function listsForAthlete(lists: PriceListRecord[], schoolIds: Set<string>, mainSchoolListId: string | null): PriceListRecord[];
export function offeredSubscriptionItems(list: PriceListRecord, audience: Audience): OfferedItem[];
export function coverCandidates(rows: readonly AttendanceRow[], groups: readonly GroupRecord[]): CoverRow[];
export function defaultCover(rows: readonly CoverRow[], priceListId: string, slots: number): string[];
export function checkCover(ids: readonly string[], rows: readonly CoverRow[], priceListId: string, slots: number): boolean;
export function subscriptionWrite(i: { athleteId: string; seasonId: string; item: OfferedItem; audience: Audience; startsOn: string; actor: string; now: string }): SubscriptionWrite;
export function extendableIds(subs: readonly SubscriptionRow[], used: Map<string, number>, schoolIds: Set<string>, today: string): string[];
export function extendKey(subs: readonly SubscriptionRow[]): string;
export function extendedValues(sub: SubscriptionRow, weeks: number): { extendedWeeks: number; validUntil: string };
export function barOf(sub: SubscriptionRow, used: Map<string, number>): AbonamentBar;
export function currentSubscription(subs: SubscriptionRow[], used: Map<string, number>, listIds: readonly string[], today: string): SubscriptionRow | null;
export function athleteListIdsToday(memberships: readonly MembershipRow[], groups: readonly GroupRecord[], schoolIds: Set<string>, seasonId: string | null, athleteId: string): string[];
export function startText(date: string): string;   // "27 oct"
```

- Produces (`copy/subscriptions.ts`), `SUBSCRIPTION_COPY`:

| Key | Text |
|---|---|
| `windowTitle(name)` | "Adaugă abonament, <nume>" |
| `itemLabel(list)` | "Abonament (lista <listă>)" |
| `itemOption(itemName, audience)` | "<item>, preț membru" / "<item>, preț nemembru" |
| `startsOn`, `expires` | "Data de start", "Expiră (estimat)" |
| `cover(n)` | "Acoperă prezențe fără abonament (<n>)" |
| `coverRow(date, group)` | "<listDate>, <grupă>" ("Mar 20 oct, Intermediari Bronze") |
| `paymentBlock`, `payNow` | "Plată", "Înregistrează plata acum" |
| `cancel`, `submit` | "Renunță", "Adaugă abonament" |
| `noItems(list)` | "Lista <listă> nu are abonamente pentru acest sportiv." |
| `added(name)`, `addedWithPayment(name)` | "Abonament adăugat: <nume>.", "Abonament și plată înregistrate: <nume>." |
| `cancelAction`, `cancelled` | "Anulează abonamentul", "Abonament anulat." |
| `extendTitle`, `weeks` | "Prelungește abonamentele Școlii de patinaj", "Număr de săptămâni" |
| `extendText(n, x)` | "Se prelungesc <n abonamente active> cu <x săptămâni>. Noua dată de expirare se calculează pentru fiecare." |
| `extendButton(n)` | "Prelungește <n abonamente>" |
| `extended(n, x)` | "<n abonamente prelungite> cu <x săptămâni>." |
| `extendStale` | "Abonamentele s-au schimbat. Reîncarcă pagina." |
| `barTitle(itemName, slots)` | "Abonament Școala de patinaj, <n> ședințe" when `itemName === 'Abonament <n> ședințe'`, else `itemName` (C53) |
| `expiresOn(date)` | "Expiră pe <longDate>" |
| `usedText(n)`, `leftText(n)` | "<n> folosite" / "1 folosită"; "<n> rămase" / "1 rămasă" (decided 12) |
| `goldLine` | "Abonamentul actual rămâne valabil. Următorul, la prețul Avansați Gold." |

- [ ] **Step 1: Write the failing test** `subscription-rules.test.ts` (seeds `P_LISTS`, `P_GROUPS` of the 5-1 fake; `g-ib` "Intermediari Bronze" on `pl-std`, `g-gold` on `pl-gold`, `g-av` Club on `pl-club`; sections `afi` school, Club section `club`):

```ts
const schoolIds = schoolListIds(P_LISTS, P_SECTIONS);
it('school lists only; the main school group list, else every school list (4.9, C22)', () => {
  expect([...schoolIds].sort()).toEqual(['pl-gold', 'pl-std']);
  expect(listsForAthlete(P_LISTS, schoolIds, 'pl-std').map((l) => l.id)).toEqual(['pl-std']);
  expect(listsForAthlete(P_LISTS, schoolIds, null).map((l) => l.id).sort()).toEqual(['pl-gold', 'pl-std']);
});
it('offers subscription items at the audience price only (4.9)', () => {
  expect(offeredSubscriptionItems(list('pl-std'), 'member')).toEqual([
    { itemKey: 'Abonament 8 ședințe', itemName: 'Abonament 8 ședințe', slots: 8, price: 320, priceListId: 'pl-std', listName: 'Standard' },
    { itemKey: 'Abonament 6 ședințe', itemName: 'Abonament 6 ședințe', slots: 6, price: 260, priceListId: 'pl-std', listName: 'Standard' }]);
  const noMember = { ...list('pl-std'), items: list('pl-std').items.map((i) => ({ ...i, memberPrice: null })) };
  expect(offeredSubscriptionItems(noMember, 'member')).toEqual([]);
});
it('coverage: own "Fără abonament" rows in groups of the list, oldest first, capped at the slots (4.9, C23)', () => {
  const rows = [attendanceRow({ id: 't3', sessionDate: '2026-10-20', groupId: 'g-ib', billing: 'fara_abonament' }),
    attendanceRow({ id: 't1', sessionDate: '2026-10-13', groupId: 'g-ib', billing: 'fara_abonament' }),
    attendanceRow({ id: 't2', sessionDate: '2026-10-06', groupId: 'g-gold', billing: 'fara_abonament' }),
    attendanceRow({ id: 't4', sessionDate: '2026-10-01', groupId: 'g-ib', billing: 'slot', subscriptionId: 'x' })];
  const c = coverCandidates(rows, P_GROUPS);
  expect(c.map((r) => r.attendanceId)).toEqual(['t2', 't1', 't3']);
  expect(defaultCover(c, 'pl-std', 1)).toEqual(['t1']);
  expect(checkCover(['t1', 't3'], c, 'pl-std', 2)).toBe(true);
  expect(checkCover(['t1', 't3'], c, 'pl-std', 1)).toBe(false);   // more than the slots
  expect(checkCover(['t2'], c, 'pl-std', 8)).toBe(false);         // Gold row, not this list
  expect(checkCover(['t4'], c, 'pl-std', 8)).toBe(false);         // already has a slot
  expect(checkCover(['t1', 't1'], c, 'pl-std', 8)).toBe(false);   // twice
});
it('freezes item, price, audience, slots; validUntil = start + 27 days (3.4, p5 Q36)', () => {
  const item = offeredSubscriptionItems(list('pl-std'), 'nonMember')[0];
  expect(subscriptionWrite({ athleteId: 'a1', seasonId: 's26', item, audience: 'nonMember', startsOn: '2026-10-27', actor: 'Ana', now: '2026-10-27T09:00:00.000Z' }))
    .toEqual({ athleteId: 'a1', seasonId: 's26', priceListId: 'pl-std', validIn: [], itemName: 'Abonament 8 ședințe', price: 360, audience: 'nonMember', slots: 8,
      startsOn: '2026-10-27', validUntil: '2026-11-23', extendedWeeks: 0, cancelled: false, cancelledAt: null, cancelledBy: null, purchasedAt: '2026-10-27T09:00:00.000Z', recordedBy: 'Ana' });
});
it('extends only abonamente active today on school lists (5.9, C77)', () => {
  const last = subscriptionRow({ id: 'last', validUntil: '2026-11-20' });
  const gone = subscriptionRow({ id: 'gone', validUntil: '2026-11-19' });
  const full = subscriptionRow({ id: 'full', slots: 6 });
  const off = subscriptionRow({ id: 'off', cancelled: true });
  const used = new Map([['full', 6]]);
  expect(extendableIds([last, gone, full, off], used, schoolIds, '2026-11-20')).toEqual(['last']);
  expect(extendedValues({ ...last, startsOn: '2026-10-24', extendedWeeks: 0 }, 2)).toEqual({ extendedWeeks: 2, validUntil: '2026-12-04' });
  expect(extendedValues({ ...last, startsOn: '2026-10-24', extendedWeeks: 2 }, 1)).toEqual({ extendedWeeks: 3, validUntil: '2026-12-11' });
  expect(extendKey([last])).not.toBe(extendKey([{ ...last, extendedWeeks: 1 }]));
  expect(extendKey([last, gone])).toBe(extendKey([gone, last]));
});
it('bar, current abonament and Sportivi cell (5.7, 5.12, 5.13, decided 9)', () => {
  const a = subscriptionRow({ id: 'a', validUntil: '2026-11-23' });
  const used = new Map([['a', 5]]);
  expect(barOf(a, used)).toEqual({ subscriptionId: 'a', itemName: 'Abonament 8 ședințe', slots: 8, used: 5, validUntil: '2026-11-23' });
  expect(currentSubscription([a], used, ['pl-std'], '2026-11-20')?.id).toBe('a');
  expect(currentSubscription([a], used, ['pl-gold'], '2026-11-20')).toBeNull();
  expect(currentSubscription([a], used, [], '2026-11-20')?.id).toBe('a');
  expect(abonamentCellText(barOf(a, used))).toBe('5/8, 23 nov 2026');
  expect(startText('2026-10-27')).toBe('27 oct');
});
it('copy (5.8, 5.9, 5.12)', () => {
  const c = SUBSCRIPTION_COPY;
  expect(c.extendText(14, 2)).toBe('Se prelungesc 14 abonamente active cu 2 săptămâni. Noua dată de expirare se calculează pentru fiecare.');
  expect(c.extendText(1, 1)).toBe('Se prelungesc 1 abonament activ cu 1 săptămână. Noua dată de expirare se calculează pentru fiecare.');
  expect(c.extendText(20, 1)).toContain('20 de abonamente active');
  expect([c.extendButton(14), c.extendButton(1)]).toEqual(['Prelungește 14 abonamente', 'Prelungește 1 abonament']);
  expect([c.extended(14, 2), c.extended(1, 1)]).toEqual(['14 abonamente prelungite cu 2 săptămâni.', '1 abonament prelungit cu 1 săptămână.']);
  expect([c.barTitle('Abonament 8 ședințe', 8), c.barTitle('Abonament 8 ședințe Gold', 8)]).toEqual(['Abonament Școala de patinaj, 8 ședințe', 'Abonament 8 ședințe Gold']);
  expect([c.usedText(5), c.usedText(1), c.leftText(3), c.leftText(1)]).toEqual(['5 folosite', '1 folosită', '3 rămase', '1 rămasă']);
  expect(c.expiresOn('2026-11-23')).toBe('Expiră pe 23 nov 2026');
  expect(c.coverRow('2026-10-20', 'Intermediari Bronze')).toBe('Mar 20 oct, Intermediari Bronze');
  expect(c.itemOption('Abonament 8 ședințe', 'member')).toBe('Abonament 8 ședințe, preț membru');
  expect(c.noItems('Standard')).toBe('Lista Standard nu are abonamente pentru acest sportiv.');
});
```

`abonamentCellText(bar: AbonamentBar): string` lives in `rules.ts` too ("<used>/<slots>, <longDate>").

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/subscription-rules.test.ts`; Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** `rules.ts` and `copy/subscriptions.ts`; add `export * from './copy/subscriptions';` to `copy.ts`. `coverCandidates` keeps `billing === 'fara_abonament'` rows, sorted by `sessionDate`, then id; a row's `priceListId` is its group's. `currentSubscription` with empty `listIds` runs `slotCandidates` once per distinct list of the athlete's subs and keeps the first by the 4.10 order. `extendedValues` uses `subscriptionValidUntil(sub.startsOn, sub.extendedWeeks + weeks)`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/subscriptions/rules.ts src/club/presence/copy/subscriptions.ts src/club/presence/copy.ts src/club/presence/__tests__/subscription-rules.test.ts
git commit -m "feat(abonamente): offered items, coverage, extension and bar rules"
```

---

### Task 2: Payment rules, "Pentru", A.C.S. effect, month settlement (high)

**Files:**
- Create: `src/club/presence/payments/rules.ts`, `src/club/presence/due/settlement.ts`, `src/club/presence/copy/payments.ts`
- Modify: `src/club/presence/copy.ts` (one line)
- Test: `src/club/presence/__tests__/payment-rules.test.ts`, `src/club/presence/__tests__/settlement.test.ts`

**Interfaces:**
- Consumes (5-1): `PaymentRow`, `PaymentWrite`, `PaymentMethod`, `PaymentPurpose`, `AttendanceRow`, `LessonRow`, `SubscriptionRow`, `SeasonRecord`, `METHOD_WORDS`, `PURPOSE_WORDS`, `PRESENCE_WORDS`, `toMoney`, `sumMoney`, `ron`, `monthOf`, `monthName`, `monthTitle`, `addMonths`, `isMonth`, `listDate`, `longDate`, `seasonOfDate`; `isIsoDate`; `AcsState`; `startText` (Task 1).
- Produces (`payments/rules.ts`):

```ts
export type PaymentFor =
  | { kind: 'abonament'; subscriptionId: string } | { kind: 'cotizatie'; seasonId: string }
  | { kind: 'club_luna'; month: string } | { kind: 'lectie'; lessonId: string } | { kind: 'altceva' };
export type PaymentInput = { amount: number; paidOn: string; method: PaymentMethod; for: PaymentFor; collectedAtRink: boolean; note: string | null };
export type NewPaymentInput = PaymentInput & { athleteId: string; sendEmail: boolean };
export type Checked<T> = { ok: true; value: T } | { ok: false; status: 400; error: string };
export function readAmount(v: unknown): Checked<number>;
export function readPaymentInput(body: unknown, today: string): Checked<PaymentInput>;
export function readNewPayment(body: unknown, today: string): Checked<NewPaymentInput>;
export type PurposeFields = Pick<PaymentWrite, 'purpose' | 'subscriptionId' | 'lessonId' | 'clubMonth' | 'seasonId' | 'collectedAtRink'>;
export function purposeFields(f: PaymentFor, collectedAtRink: boolean, seasonOfPaidOn: string): PurposeFields;
export type PurposeNames = { itemName?: string | null; seasonLabel?: string | null };
export function purposeText(p: Pick<PaymentRow, 'purpose' | 'clubMonth'>, names: PurposeNames): string;
export function listPurposeText(p: Pick<PaymentRow, 'purpose' | 'clubMonth' | 'note'>, names: PurposeNames): string;
export function sameFor(p: PaymentRow, fields: PurposeFields): boolean;
export type PaymentOption = { for: PaymentFor; label: string; amount: number | null; isDefault: boolean };
export function paymentOptions(i: { subs: SubscriptionRow[]; payments: PaymentRow[]; seasons: SeasonRecord[]; months: ClubMonth[]; lessons: LessonRow[]; today: string }): PaymentOption[];
export function acsOnFee(current: AcsState | null): { set: boolean; acsBefore: AcsState | null };
export function acsRevert(payment: PaymentRow, others: readonly PaymentRow[], current: AcsState | null): { revert: boolean; to: AcsState | null };
export function paymentFieldChanges(before: PaymentRow, after: PaymentWrite, texts: { before: string; after: string }): Record<string, { from: unknown; to: unknown }>;
export const paidFor = (payments: readonly PaymentRow[], match: (p: PaymentRow) => boolean): number;   // non-cancelled only, sumMoney
```

- Produces (`due/settlement.ts`):

```ts
export type ClubLine = { date: string; groupName: string | null; charges: Charge[]; lesson: { price: number | null } | null };
export type ClubMonth = { month: string; grup: number; uscat: number; lessons: number; due: number; paid: number; left: number; groupIds: string[]; lines: ClubLine[] };
export const isClubAttendance = (a: Pick<AttendanceRow, 'billing'>): boolean;   // club | inclus | fara_pret
export function clubMonths(i: { attendances: AttendanceRow[]; lessons: LessonRow[]; payments: PaymentRow[]; groupNames: ReadonlyMap<string, string>; startDate: string | null }): ClubMonth[];
export type SchoolDue = { subscriptionId: string; athleteId: string; itemName: string; startsOn: string; price: number; paid: number; left: number };
export function schoolDue(subs: readonly SubscriptionRow[], payments: readonly PaymentRow[]): SchoolDue[];
export function mainGroupToday(memberships: readonly MembershipRow[], groups: readonly GroupRecord[], seasonId: string | null): Map<string, GroupRecord>;
```

- Produces (`copy/payments.ts`), `PAYMENT_COPY`: window labels "Plată nouă", "Editează plata", "Sportiv", "Sumă", "Data", "Metodă", "Pentru", "Încasat la patinoar", "Trimite e-mail "Plată înregistrată"", "Notă", hint "Opțional", "Renunță", "Înregistrează", "Salvează", `noEmail` "Sportivul nu are e-mail."; errors `amount` "Suma trebuie să fie mai mare decât 0.", `future` "Data nu poate fi în viitor.", `purpose` "Alege pentru ce este plata."; toasts `recorded(sum, name)` "Plată înregistrată: <sumă>, <nume>.", `saved` "Salvat.", `unchanged` "Nicio modificare.", `cancelled` "Plată anulată."; `cancelConfirm(sum, date)` "Anulezi plata de <sumă> din <data>? Rândul rămâne, marcat anulată.", `cancelAction` "Anulează plata"; option texts `optAbonament(item, date)` "<itemName> (activ din <startText>)", `optFee(season)` "Cotizație membru <sezon>", `optMonth(month)` "Club, <lună>", `optLesson(date)` "Lecție individuală, <longDate>"; `rink` ", la patinoar"; `sessionsText(grup, uscat, lessons)`; detail `chargeText(charge)` ("Grup 40 RON", "Uscat inclus", "Grup fără preț"), `lessonLine(date, price)`; De încasat `due` texts "De încasat", "Școala de patinaj", "Club", "Nimic de încasat în luna asta.", `fromDate(date)` "din <startText>".

- [ ] **Step 1: Write the failing tests**

`payment-rules.test.ts`:

```ts
const today = '2026-11-20';
const body = (over: object) => ({ athleteId: 'a1', amount: 320, paidOn: '2026-11-20', method: 'numerar', for: { kind: 'altceva' }, collectedAtRink: false, note: '', sendEmail: false, ...over });
it('amounts: two decimals, more than 0, at most 100000, stored rounded (decided 2)', () => {
  expect([readAmount(12.5), readAmount(0.1 + 0.2), readAmount(100000)].map((r) => r.ok && r.value)).toEqual([12.5, 0.3, 100000]);
  expect(readAmount(0)).toEqual({ ok: false, status: 400, error: 'Suma trebuie să fie mai mare decât 0.' });
  expect(readAmount(-5)).toEqual({ ok: false, status: 400, error: 'Suma trebuie să fie mai mare decât 0.' });
  expect([readAmount(12.345), readAmount(0.004), readAmount(100000.01), readAmount('320'), readAmount(Number.NaN)].map((r) => r.ok === false && r.error))
    .toEqual(['Cerere invalidă.', 'Cerere invalidă.', 'Cerere invalidă.', 'Cerere invalidă.', 'Cerere invalidă.']);
});
it('date not in the future, a purpose, a method (5.10)', () => {
  expect(readNewPayment(body({ paidOn: '2026-11-21' }), today)).toEqual({ ok: false, status: 400, error: 'Data nu poate fi în viitor.' });
  expect(readNewPayment(body({ for: null }), today)).toEqual({ ok: false, status: 400, error: 'Alege pentru ce este plata.' });
  expect(readNewPayment(body({ for: { kind: 'club_luna', month: '2026-13' } }), today).ok).toBe(false);
  expect(readNewPayment(body({ method: 'cec' }), today)).toEqual({ ok: false, status: 400, error: 'Cerere invalidă.' });
  expect(readNewPayment(body({ note: '  ' }), today)).toMatchObject({ ok: true, value: { note: null, sendEmail: false } });
  expect(readNewPayment(body({ sendEmail: 'true' }), today)).toMatchObject({ ok: true, value: { sendEmail: false } });
});
it('purpose fields: fee season chosen, others the season of the date; rink only for abonament (3.5, C8)', () => {
  expect(purposeFields({ kind: 'cotizatie', seasonId: 's25' }, true, 's26')).toEqual({ purpose: 'cotizatie', subscriptionId: null, lessonId: null, clubMonth: null, seasonId: 's25', collectedAtRink: false });
  expect(purposeFields({ kind: 'abonament', subscriptionId: 'sub1' }, true, 's26')).toEqual({ purpose: 'abonament', subscriptionId: 'sub1', lessonId: null, clubMonth: null, seasonId: 's26', collectedAtRink: true });
  expect(purposeFields({ kind: 'club_luna', month: '2026-09' }, false, 's26')).toMatchObject({ purpose: 'club_luna', clubMonth: '2026-09' });
});
it('"Pentru" texts (5.10, C61, decided 17)', () => {
  expect(purposeText({ purpose: 'abonament', clubMonth: null }, { itemName: 'Abonament 8 ședințe' })).toBe('Abonament 8 ședințe');
  expect(purposeText({ purpose: 'club_luna', clubMonth: '2026-09' }, {})).toBe('Club, septembrie');
  expect(purposeText({ purpose: 'cotizatie', clubMonth: null }, { seasonLabel: '2026-2027' })).toBe('Cotizație membru 2026-2027');
  expect(purposeText({ purpose: 'lectie', clubMonth: null }, {})).toBe('Lecție individuală');
  expect(listPurposeText({ purpose: 'altceva', clubMonth: null, note: 'o ședință plătită la intrare ieri' }, {})).toBe('Altceva, o ședință plătită la');
  expect(listPurposeText({ purpose: 'altceva', clubMonth: null, note: null }, {})).toBe('Altceva');
});
it('options and default amounts (4.15, C33, decided 4 and 5)', () => {
  const sub = subscriptionRow({ id: 'sub1', startsOn: '2026-10-27', price: 320 });
  const paid = paymentRow({ id: 'p1', purpose: 'abonament', subscriptionId: 'sub1', amount: 100 });
  const gone = paymentRow({ id: 'p2', purpose: 'abonament', subscriptionId: 'sub1', amount: 50, cancelled: true });
  const opts = paymentOptions({ subs: [sub, subscriptionRow({ id: 'x', cancelled: true })], payments: [paid, gone], seasons: G_SEASONS,
    months: [month('2026-09', { due: 340, paid: 400 }), month('2025-10', { due: 80 })], lessons: [lessonRow({ id: 'l1', date: '2026-10-28', state: 'saved', present: true, price: 80, amount: 80 })], today });
  expect(opts.map((o) => [o.label, o.amount])).toEqual([
    ['Abonament 8 ședințe (activ din 27 oct)', 220],
    ['Cotizație membru 2026-2027', 100], ['Cotizație membru 2025-2026', 100],
    ['Club, noiembrie', 0], ['Club, septembrie', 0],
    ['Lecție individuală, 28 oct 2026', 80],
    ['Altceva', null]]);
  expect(opts.find((o) => o.isDefault && o.for.kind === 'cotizatie')?.label).toBe('Cotizație membru 2026-2027');
});
it('a fee sets A.C.S. Da and keeps the state before; the revert only when no other fee and still Da (4.16, 4.17, C9, decided 6)', () => {
  expect([acsOnFee(null), acsOnFee('nu'), acsOnFee('da')]).toEqual([{ set: true, acsBefore: null }, { set: true, acsBefore: 'nu' }, { set: false, acsBefore: 'da' }]);
  const fee = paymentRow({ id: 'f1', purpose: 'cotizatie', seasonId: 's26', acsBefore: 'nu' });
  expect(acsRevert(fee, [], 'da')).toEqual({ revert: true, to: 'nu' });
  expect(acsRevert({ ...fee, acsBefore: null }, [], 'da')).toEqual({ revert: true, to: null });
  expect(acsRevert(fee, [paymentRow({ id: 'f2', purpose: 'cotizatie', seasonId: 's26' })], 'da').revert).toBe(false);
  expect(acsRevert(fee, [paymentRow({ id: 'f2', purpose: 'cotizatie', seasonId: 's26', cancelled: true })], 'da').revert).toBe(true);
  expect(acsRevert(fee, [], 'nu').revert).toBe(false);
  expect(acsRevert({ ...fee, acsBefore: 'da' }, [], 'da').revert).toBe(false);
});
it('field changes for history, purpose as text (4.17, 8)', () => {
  const before = paymentRow({ id: 'p', amount: 300, method: 'numerar', note: null });
  expect(paymentFieldChanges(before, { ...before, amount: 320, method: 'card' }, { before: 'Altceva', after: 'Altceva' }))
    .toEqual({ amount: { from: 300, to: 320 }, method: { from: 'numerar', to: 'card' } });
  expect(paymentFieldChanges(before, { ...before }, { before: 'Altceva', after: 'Club, septembrie' })).toEqual({ purposeText: { from: 'Altceva', to: 'Club, septembrie' } });
});
```

`month(m, over)` builds a `ClubMonth` with zero counts. `G_SEASONS` labels `2025-2026` / `2026-2027` and `membershipFee` 100 (set in the seed if the phase 4 seed leaves it null).

`settlement.test.ts`:

```ts
const att = (id: string, date: string, over: object) => attendanceRow({ id, sessionDate: date, groupId: 'g-av', athleteId: 'a1', ...over });
const grup = (price: number | null, included = false) => ({ type: 'grup' as const, itemName: 'Ședință grup', price, included });
const uscat = (price: number | null, included = false) => ({ type: 'uscat' as const, itemName: 'Uscat', price, included });
it('a month: counts by type, due, paid (Club month and lesson payments), left (4.14, C31)', () => {
  const months = clubMonths({
    attendances: [att('t1', '2026-10-06', { grup: true, uscat: true, billing: 'club', charges: [grup(40), uscat(20, true)], amount: 40 }),
      att('t2', '2026-10-13', { grup: true, billing: 'club', charges: [grup(40)], amount: 40 }),
      att('t3', '2026-10-20', { grup: true, billing: 'fara_abonament', groupId: 'g-ib', charges: [], amount: 0 })],
    lessons: [lessonRow({ id: 'l1', date: '2026-10-28', state: 'saved', present: true, price: 80, amount: 80 }), lessonRow({ id: 'l2', date: '2026-10-29', state: 'saved', present: false, amount: 0 })],
    payments: [paymentRow({ id: 'p1', purpose: 'club_luna', clubMonth: '2026-10', amount: 50 }), paymentRow({ id: 'p2', purpose: 'lectie', lessonId: 'l1', amount: 80 }),
      paymentRow({ id: 'p3', purpose: 'club_luna', clubMonth: '2026-10', amount: 500, cancelled: true })],
    groupNames: new Map([['g-av', 'Avansați']]), startDate: '2026-10-01' });
  expect(months).toHaveLength(1);
  expect(months[0]).toMatchObject({ month: '2026-10', grup: 2, uscat: 1, lessons: 1, due: 160, paid: 130, left: 30, groupIds: ['g-av'] });
  expect(PAYMENT_COPY.sessionsText(2, 1, 1)).toBe('4 (2 grup, 1 uscat, 1 individuală)');
  expect(PAYMENT_COPY.sessionsText(6, 0, 0)).toBe('6 (6 grup)');
});
it('negative left, months before the start date hidden, no start date no limit (C32, C13, decided 14)', () => {
  const pay = paymentRow({ id: 'p', purpose: 'club_luna', clubMonth: '2026-09', amount: 400 });
  const a = att('t', '2026-09-08', { grup: true, billing: 'club', charges: [grup(40)], amount: 40 });
  expect(clubMonths({ attendances: [a], lessons: [], payments: [pay], groupNames: new Map(), startDate: null })[0]).toMatchObject({ due: 40, paid: 400, left: -360 });
  expect(clubMonths({ attendances: [a], lessons: [], payments: [pay], groupNames: new Map(), startDate: '2026-10-01' })).toEqual([]);
});
it('Rămas without float noise (Review Focus)', () => {
  const pays = [1, 2, 3].map((i) => paymentRow({ id: `p${i}`, purpose: 'abonament', subscriptionId: 's', amount: 33.33 }));
  expect(schoolDue([subscriptionRow({ id: 's', price: 100 })], pays)[0]).toMatchObject({ price: 100, paid: 99.99, left: 0.01 });
});
it('Școala part: price minus non-cancelled payments > 0, cancelled and unpriced out, by start date (4.14, p5 Q34, C76)', () => {
  const subs = [subscriptionRow({ id: 'b', startsOn: '2026-10-27', price: 320 }), subscriptionRow({ id: 'a', startsOn: '2026-10-20', price: 260 }),
    subscriptionRow({ id: 'paid', price: 320 }), subscriptionRow({ id: 'off', price: 320, cancelled: true }), subscriptionRow({ id: 'free', price: null })];
  const pays = [paymentRow({ id: 'p1', purpose: 'abonament', subscriptionId: 'a', amount: 100 }), paymentRow({ id: 'p2', purpose: 'abonament', subscriptionId: 'paid', amount: 320 }),
    paymentRow({ id: 'p3', purpose: 'abonament', subscriptionId: 'b', amount: 320, cancelled: true })];
  expect(schoolDue(subs, pays).map((r) => [r.subscriptionId, r.paid, r.left])).toEqual([['a', 100, 160], ['b', 0, 320]]);
});
it('"Fără abonament" attendance is never in any due (p5 Q39)', () => {
  const a = att('t', '2026-10-20', { groupId: 'g-ib', grup: true, billing: 'fara_abonament', charges: [], amount: 0 });
  expect(clubMonths({ attendances: [a], lessons: [], payments: [], groupNames: new Map(), startDate: null })).toEqual([]);
});
it('detail lines (decided 19)', () => {
  expect([PAYMENT_COPY.chargeText(grup(40)), PAYMENT_COPY.chargeText(uscat(20, true)), PAYMENT_COPY.chargeText(grup(null))]).toEqual(['Grup 40 RON', 'Uscat inclus', 'Grup fără preț']);
  expect(PAYMENT_COPY.lessonLine('2026-10-28', 80)).toBe('Mie 28 oct, Lecție individuală 80 RON');
});
```

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/presence/__tests__/payment-rules.test.ts src/club/presence/__tests__/settlement.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the three files; add `export * from './copy/payments';`. `clubMonths` groups by `monthOf(sessionDate | date)`, leaves out months before `monthOf(startDate)`, sorts newest first; `paid` counts `club_luna` by `clubMonth` and `lectie` by the month of its lesson's date. `paymentOptions` order: abonamente (newest `startsOn` first), seasons (newest first, the current season is the default), Club months (newest first), lessons (newest first, `date >= addMonths(monthOf(today), -11)` start), "Altceva".
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/payments/rules.ts src/club/presence/due/settlement.ts src/club/presence/copy/payments.ts src/club/presence/copy.ts src/club/presence/__tests__/payment-rules.test.ts src/club/presence/__tests__/settlement.test.ts
git commit -m "feat(plati): payment input, Pentru options, A.C.S. effect and month settlement"
```

---

### Task 3: "Plată înregistrată" e-mail (high)

**Files:**
- Create: `src/email/payment-email.ts`, `src/club/presence/copy/email.ts`
- Modify: `src/email/email-jobs.ts` (kind, payload type, `composerFor`, `onSent`), `src/email/strapi-email.ts` (`RawJob`, `toJobRow`, populate, `buildEmailDeps.onSent`, `attemptPaymentEmails`), `src/club/presence/context.ts` (`paymentEmails`), `src/club/presence/__tests__/fake-store.ts` (fake context), `src/club/presence/copy.ts` (one line)
- Test: `src/email/__tests__/payment-email.test.ts`

**Interfaces:**
- Consumes: `PaymentEmailPayload`, `PaymentEmailJob` (5-1 types), `METHOD_WORDS`, `ron`, `longDate`, `P5_ACTIONS.paymentEmailSent`, `strapiPresenceStore`, `brandHtml`, `emailPage`, `escapeHtml`, `footerText`, `RenderedEmail`, `EmailLinks`, `attemptJob`, `buildEmailDeps`, `recordHistory`, `safely`.
- Produces:
  - `PAYMENT_EMAIL_COPY = { subject: (name) => 'Plată înregistrată: <sportiv>', greeting: 'Bună ziua,', recorded: (sum, name) => 'Am înregistrat plata de <sumă> pentru <sportiv>.', details: (purpose, method, date) => 'Pentru: <pentru>. Metodă: <metodă>. Data: <data>.', notFiscal: 'Acesta nu este un document fiscal.', signature: 'Echipa EduSport' }` (spec 9).
  - `payment-email.ts`: `PAYMENT_HOLD_MS = 15_000`; `isPaymentPayload(v: unknown): v is PaymentEmailPayload`; `paymentParagraphs(p: PaymentEmailPayload): string[][]`; `renderPaymentEmail(i: { payload: PaymentEmailPayload; links: EmailLinks }): RenderedEmail`; `paymentEmailJob(i: { recipient: string; paymentId: string; payload: PaymentEmailPayload }, now: Date): PaymentEmailJob` (recipient trimmed, lower case; subject `PAYMENT_EMAIL_COPY.subject(payload.athleteName)`; `notBefore` = now + 15 s).
  - `email-jobs.ts`: `EmailJobKind = 'registration' | 'schedule-change' | 'payment'`; `EmailJobRow.payload?: ScheduleChangePayload | PaymentEmailPayload | null`; `EmailJobRow.paymentDocumentId?: string | null`; `EmailDeps.onSent?: (job: EmailJobRow) => Promise<void>` (called once after a job is written `sent`; a throw is logged with `deps.log('warn', ...)`, never fails the attempt).
  - `strapi-email.ts`: `attemptPaymentEmails(strapi: Core.Strapi, paymentId: string, delayMs = PAYMENT_HOLD_MS + 1000): void` (after the hold, every still-queued job of the payment through `attemptJob`); `onSent` for kind `payment` writes the `payment-email-sent` line (`{ recipient: job.recipient }`, subject `payment`, actor = the payment's `recordedBy`) (decided 13).
  - `PresenceContext.paymentEmails: (paymentId: string) => void` (`presenceContext` wires `attemptPaymentEmails`); `fakePresenceContext` returns `emailsAfter: string[]` (the ids its `paymentEmails` received).

- [ ] **Step 1: Write the failing test** `payment-email.test.ts`:

```ts
const payload = { athleteName: 'Ana Ionescu', amount: 320, method: 'numerar' as const, paidOn: '2026-10-27', purposeText: 'Abonament 8 ședințe' };
it('subject and paragraphs as approved (9, p5 Q42)', () => {
  expect(paymentParagraphs(payload)).toEqual([['Bună ziua,'], ['Am înregistrat plata de 320 RON pentru Ana Ionescu.'],
    ['Pentru: Abonament 8 ședințe. Metodă: Numerar. Data: 27 oct 2026.'], ['Acesta nu este un document fiscal.'], ['Echipa EduSport']]);
  const r = renderPaymentEmail({ payload, links: LINKS });
  expect(r.subject).toBe('Plată înregistrată: Ana Ionescu');
  expect(r.text).toContain('Am înregistrat plata de 320 RON pentru Ana Ionescu.');
  expect(r.html).toContain('Acesta nu este un document fiscal.');
});
it('a job held 15 s, address trimmed and lower case (3.7, 9)', () => {
  expect(paymentEmailJob({ recipient: ' Ana@Example.com ', paymentId: 'p1', payload }, new Date('2026-10-27T10:00:00.000Z')))
    .toEqual({ recipient: 'ana@example.com', subject: 'Plată înregistrată: Ana Ionescu', paymentId: 'p1', notBefore: '2026-10-27T10:00:15.000Z', payload });
});
it('payload check', () => {
  expect(isPaymentPayload(payload)).toBe(true);
  expect(isPaymentPayload({ ...payload, amount: '320' })).toBe(false);
  expect(isPaymentPayload({ ...payload, paidOn: '27.10.2026' })).toBe(false);
});
it('the queue sends a payment job with the payment letter and calls onSent once (email-jobs)', async () => {
  const deps = fakeDeps();   // the email-jobs.test.ts fake deps, with an onSent spy
  const job = { ...queuedJob(), kind: 'payment' as const, registrationDocumentId: null, paymentDocumentId: 'p1', payload };
  expect((await attemptJob(deps, job)).status).toBe('sent');
  expect(deps.sent[0].subject).toBe('Plată înregistrată: Ana Ionescu');
  expect(deps.onSentCalls).toEqual(['p1']);
});
it('a payment job without a valid payload fails without sending', async () => {
  const deps = fakeDeps();
  expect((await attemptJob(deps, { ...queuedJob(), kind: 'payment', registrationDocumentId: null, payload: null })).status).toBe('failed');
  expect(deps.sent).toEqual([]);
});
it('the job row knows the payment kind and link', () => {
  expect(toJobRow({ documentId: 'j', kind: 'payment', payload, payment: { documentId: 'p1' } })).toMatchObject({ kind: 'payment', paymentDocumentId: 'p1', payload });
  expect(toJobRow({ documentId: 'j', kind: 'registration', payload: null })).toMatchObject({ kind: 'registration', paymentDocumentId: null });
});
it('the fake context records the e-mails asked after commit', () => {
  const f = fakePresenceContext({});
  f.ctx.paymentEmails('p1');
  expect(f.emailsAfter).toEqual(['p1']);
});
```

`LINKS`, `fakeDeps`, `queuedJob` come from the existing `email-jobs.test.ts` / `schedule-change.test.ts` helpers (move them to `src/email/__tests__/helpers.ts` when they are local; add `onSent` and `onSentCalls` there).

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/email/__tests__/payment-email.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** `payment-email.ts` as `schedule-change-template.ts` (E1 letter, `paragraphHtml`, footer); `copy/email.ts` and its export line; in `email-jobs.ts` add the `payment` branch to `composerFor` (`isPaymentPayload(job.payload)` -> `renderPaymentEmail`) and `missingSource` text `'payment without payload'`, and call `deps.onSent` after a `sent` finish; in `strapi-email.ts` `RawJob.payment`, `POPULATE = ['registration', 'payment']`, `toJobRow` maps `kind` and the payload per kind, `attemptPaymentEmails` mirrors `attemptScheduleChangeJobs` with the filter `{ payment: { documentId: paymentId }, status: 'queued' }`. `context.ts` and the fake context gain `paymentEmails`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS (the registration and schedule-change e-mail tests unchanged).
- [ ] **Step 5: Commit**

```bash
git add src/email/payment-email.ts src/email/email-jobs.ts src/email/strapi-email.ts src/email/__tests__ src/club/presence/copy/email.ts src/club/presence/copy.ts src/club/presence/context.ts src/club/presence/__tests__/fake-store.ts
git commit -m "feat(plati): Plată înregistrată e-mail job kind, letter and sender"
```

---

### Task 4: Record, edit and cancel a payment (high)

**Files:**
- Create: `src/club/presence/payments/record.ts`, `edit.ts`, `cancel.ts`
- Test: `src/club/presence/__tests__/payment-writes.test.ts`

**Interfaces:**
- Consumes: Task 2 (`readNewPayment`, `readPaymentInput`, `purposeFields`, `purposeText`, `sameFor`, `acsOnFee`, `acsRevert`, `paymentFieldChanges`), Task 3 (`paymentEmailJob`), 5-1 (`PresenceContext`, `recordPresenceAction`, `recordPresenceLines`, `guardOf`, `P5_ACTIONS`, `SUBJECT`, `PRESENCE_ERRORS`, `seasonOfDate`, `audienceFor`), `HISTORY_ACTIONS.acsChanged`, `isAnonymized`, `done`, `guarded`, `refuse`.
- Produces:

```ts
export type PaymentResult = { paymentId: string; amount: number; athleteName: string };
export type PaymentDraft = { athlete: AthleteRow; input: PaymentInput; sendEmail: boolean };
export type PaymentWritten = { paymentId: string; lines: Line[]; steps: PresenceUndoStep[]; emailQueued: boolean; duplicate: boolean };
/** Inside a transaction, the athlete already locked; locks the linked lesson or subscription, then writes. Used by Task 5. */
export function writePaymentLocked(ctx: PresenceContext, d: PaymentDraft): Promise<AdminResult<PaymentWritten>>;
export function recordPayment(ctx: PresenceContext, body: unknown): Promise<ActionResult<PaymentResult>>;
export function editPayment(ctx: PresenceContext, paymentId: string, body: unknown): Promise<ActionResult<{ changed: boolean }>>;
export function cancelPayment(ctx: PresenceContext, paymentId: string): Promise<ActionResult<{ cancelled: true }>>;
```

Rules the tests pin (spec 4.15 to 4.17, 7.1 to 7.3, decided 1, 7, 8):
- Lock order: `lockAthlete`, then `lockLesson` / `lockSubscription` of the link, then `lockPayment` (edit, cancel); everything re-read after the locks.
- The link must belong to the athlete: an abonament not cancelled, a lesson `saved` and `present`; a fee season must exist; else 409 stale (link) or 400 invalid (season). Anonymized athlete: 409 stale. `sendEmail` with no contact e-mail: 409 stale.
- Record: `createPayment` with `recordedBy` = actor, `recordedAt` = `ctx.now()`; fee: `acsOnFee`, `setAcs(da)` and `acsBefore`, line `acs-changed` `{ season: <label>, from, to: 'da' }` on the athlete; e-mail: `createPaymentEmailJob(paymentEmailJob(...))` then `updatePayment(id, { emailJobId })`; lines `payment-recorded` on the athlete (`{ amount, method, purposeText }`) and the payment; undo steps in this order `deletePayment`, `setAcs` (only when set, `state` = `acsBefore`), `cancelPaymentEmail` (only when queued); guard `payment`; after commit `ctx.paymentEmails(id)` when queued.
- Edit: never the athlete, never `sendEmail`; no field changed answers `{ changed: false }` with no line and `actionId` null; a re-purposed or re-seasoned fee reverts the old season by `acsRevert` and sets the new one by `acsOnFee`; line `payment-edited` `{ fields }` on the payment; undo `setPayment` (old values incl. `acsBefore`) plus one `setAcs` per season it changed.
- Cancel: `cancelled`, `cancelledAt`, `cancelledBy`; `cancelPaymentEmailJob(id)`; `acsRevert` with the other fee payments of that athlete and season; lines `payment-cancelled` on the athlete (`{ amount, paidOn }`) and the payment; undo `setPayment { cancelled: false, cancelledAt: null, cancelledBy: null }` plus `setAcs` when reverted. Already cancelled: 409 stale.

- [ ] **Step 1: Write the failing test** `payment-writes.test.ts` (fake context, today `2026-11-20`, athlete `a1` "Ana Ionescu" with e-mail `ana@example.com`, `a2` without e-mail, `a9` anonymized):

```ts
const pay = (over: object = {}) => ({ athleteId: 'a1', amount: 320, paidOn: '2026-11-20', method: 'numerar', for: { kind: 'altceva' }, collectedAtRink: false, note: '', sendEmail: false, ...over });
it('records a payment with lines and an undo (4.15, 8)', async () => {
  const f = fakePresenceContext(seed());
  const res = await recordPayment(f.ctx, pay());
  expect(res).toMatchObject({ ok: true, data: { value: { amount: 320, athleteName: 'Ana Ionescu' } } });
  expect(f.state.payments).toHaveLength(1);
  expect(f.state.payments[0]).toMatchObject({ purpose: 'altceva', seasonId: 's26', recordedBy: 'Admin Test', sendEmail: false, emailJobId: null, cancelled: false });
  expect(historyTexts(f, 'athlete', 'a1')).toEqual(['Plată înregistrată: 320 RON, Numerar, Altceva.']);
  expect(f.state.jobs).toEqual([]);
  expect(f.emailsAfter).toEqual([]);
});
it('a fee sets A.C.S. Da; its undo deletes the payment and the A.C.S. row (4.16, 7.3)', async () => {
  const f = fakePresenceContext(seed());
  const res = await recordPayment(f.ctx, pay({ amount: 100, for: { kind: 'cotizatie', seasonId: 's26' } }));
  expect((await f.store.acsRows({ athleteId: 'a1', seasonId: 's26' })).map((r) => r.state)).toEqual(['da']);
  expect(f.state.payments[0].acsBefore).toBeNull();
  expect(historyTexts(f, 'athlete', 'a1')).toContain('Membru A.C.S. 2026-2027: Nu → Da');
  await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) });
  expect(f.state.payments).toEqual([]);
  expect(await f.store.acsRows({ athleteId: 'a1', seasonId: 's26' })).toEqual([]);
});
it('the ticked e-mail is queued 15 s and attempted after commit; never without the tick (4.19, 2.3)', async () => {
  const f = fakePresenceContext(seed());
  await recordPayment(f.ctx, pay({ sendEmail: true }));
  expect(f.state.jobs).toMatchObject([{ recipient: 'ana@example.com', status: 'queued', payload: { athleteName: 'Ana Ionescu', amount: 320, purposeText: 'Altceva' } }]);
  expect(f.state.payments[0].emailJobId).toBe(f.state.jobs[0].id);
  expect(f.emailsAfter).toEqual([f.state.payments[0].id]);
  expect((await recordPayment(f.ctx, pay({ athleteId: 'a2', sendEmail: true }))).ok).toBe(false);
});
it('a second identical payment within 10 s is not written (decided 1)', async () => {
  const f = fakePresenceContext(seed());
  const first = await recordPayment(f.ctx, pay({ sendEmail: true }));
  const second = await recordPayment(f.ctx, pay({ sendEmail: true }));
  expect(f.state.payments).toHaveLength(1);
  expect(f.state.jobs).toHaveLength(1);
  expect(second).toMatchObject({ ok: true, data: { actionId: null, value: { paymentId: valueOf(first).paymentId } } });
  f.advance(11_000);
  await recordPayment(f.ctx, pay());
  expect(f.state.payments).toHaveLength(2);
});
it('refuses a cancelled abonament, a lesson not held, an anonymized athlete, a future date (8 decided)', async () => {
  const f = fakePresenceContext(seed());
  expect(await recordPayment(f.ctx, pay({ for: { kind: 'abonament', subscriptionId: 'sub-off' } }))).toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
  expect((await recordPayment(f.ctx, pay({ for: { kind: 'lectie', lessonId: 'l-absent' } }))).ok).toBe(false);
  expect((await recordPayment(f.ctx, pay({ athleteId: 'a9' }))).ok).toBe(false);
  expect(await recordPayment(f.ctx, pay({ paidOn: '2026-11-21' }))).toEqual({ ok: false, status: 400, error: 'Data nu poate fi în viitor.' });
  expect(f.state.payments).toEqual([]);
});
it('locks athlete, then the abonament, then nothing else (7.1)', async () => {
  const f = fakePresenceContext(seed());
  await recordPayment(f.ctx, pay({ for: { kind: 'abonament', subscriptionId: 'sub1' }, collectedAtRink: true }));
  expect(f.group.locks).toEqual(['athlete:a1', 'subscription:sub1']);
  expect(f.state.payments[0]).toMatchObject({ purpose: 'abonament', subscriptionId: 'sub1', collectedAtRink: true });
});
it('edit: field lines old -> new, nothing changed answers changed false (4.17)', async () => {
  const f = fakePresenceContext(seed({ payments: [paymentRow({ id: 'p1', athleteId: 'a1', amount: 300 })] }));
  expect(await editPayment(f.ctx, 'p1', { amount: 300, paidOn: '2026-10-27', method: 'numerar', for: { kind: 'altceva' }, collectedAtRink: false, note: '' }))
    .toEqual({ ok: true, data: { value: { changed: false }, actionId: null } });
  await editPayment(f.ctx, 'p1', { amount: 320, paidOn: '2026-10-27', method: 'numerar', for: { kind: 'club_luna', month: '2026-10' }, collectedAtRink: true, note: '' });
  expect(f.state.payments[0]).toMatchObject({ amount: 320, purpose: 'club_luna', clubMonth: '2026-10', collectedAtRink: false });
  expect(historyTexts(f, 'payment', 'p1')).toEqual(['Sumă: "300 RON" → "320 RON"', 'Pentru: "Altceva" → "Club, octombrie"']);
});
it('re-purposing a fee reverts A.C.S. only when no other fee of the season remains (C9)', async () => {
  const f = fakePresenceContext(seed({ acs: [acsRow('a1', 's26', 'da')], payments: [paymentRow({ id: 'f1', athleteId: 'a1', purpose: 'cotizatie', seasonId: 's26', acsBefore: 'nu', amount: 100 })] }));
  await editPayment(f.ctx, 'f1', { amount: 100, paidOn: '2026-10-27', method: 'numerar', for: { kind: 'altceva' }, collectedAtRink: false, note: '' });
  expect((await f.store.acsRows({ athleteId: 'a1', seasonId: 's26' }))[0].state).toBe('nu');
});
it('cancel: row kept struck, queued e-mail cancelled, A.C.S. reverted; undo un-cancels; second cancel refused (4.17, decided 7)', async () => {
  const f = fakePresenceContext(seed());
  await recordPayment(f.ctx, pay({ amount: 100, for: { kind: 'cotizatie', seasonId: 's26' }, sendEmail: true }));
  const id = f.state.payments[0].id;
  const res = await cancelPayment(f.ctx, id);
  expect(f.state.payments[0]).toMatchObject({ cancelled: true, cancelledBy: 'Admin Test' });
  expect(f.state.jobs[0].status).toBe('cancelled');
  expect(await f.store.acsRows({ athleteId: 'a1', seasonId: 's26' })).toEqual([]);
  expect(historyTexts(f, 'athlete', 'a1')).toContain('Plată anulată: 100 RON, 20 nov 2026.');
  expect((await cancelPayment(f.ctx, id)).ok).toBe(false);
  await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) });
  expect(f.state.payments[0].cancelled).toBe(false);
  expect((await f.store.acsRows({ athleteId: 'a1', seasonId: 's26' }))[0].state).toBe('da');
});
it('cancelling one fee while another fee of the season remains leaves A.C.S. Da (Review Focus)', async () => {
  const f = fakePresenceContext(seed({ acs: [acsRow('a1', 's26', 'da')], payments: [
    paymentRow({ id: 'f1', athleteId: 'a1', purpose: 'cotizatie', seasonId: 's26', acsBefore: 'nu' }), paymentRow({ id: 'f2', athleteId: 'a1', purpose: 'cotizatie', seasonId: 's26', acsBefore: 'da' })] }));
  await cancelPayment(f.ctx, 'f1');
  expect((await f.store.acsRows({ athleteId: 'a1', seasonId: 's26' }))[0].state).toBe('da');
});
it('one failing write rolls everything back (7.2)', async () => {
  const f = fakePresenceContext(seed());
  f.failOn('createPaymentEmailJob');
  expect(await recordPayment(f.ctx, pay({ sendEmail: true }))).toEqual({ ok: false, status: 500, error: 'Acțiunea nu a reușit. Nimic nu a fost salvat.' });
  expect(f.state.payments).toEqual([]);
  expect(f.emailsAfter).toEqual([]);
});
```

`seed()` (local to the test): athletes `a1`, `a2`, `a9` (status `anonimizat`), subscriptions `sub1` (a1) and `sub-off` (a1, cancelled), lessons `l-absent` (a1, saved, present false); `historyTexts(f, type, id)` renders `f.group.history` lines of that subject with `historyTexts` of `history-text.ts`; `f.advance(ms)` moves `ctx.now` (add it to `fakePresenceContext` if 5-1 did not: a mutable clock).

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/payment-writes.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the three files (one exported service each, helpers below 30 lines: `lockLink`, `checkLink`, `findDuplicate`, `applyFee`, `queueEmail`, `paymentLines`). The duplicate check reads the athlete's payments after the athlete lock: same `amount`, `method`, `paidOn`, purpose fields, `recordedBy`, not cancelled, `ctx.now() - recordedAt < 10_000`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/payments/record.ts src/club/presence/payments/edit.ts src/club/presence/payments/cancel.ts src/club/presence/__tests__/payment-writes.test.ts src/club/presence/__tests__/fake-store.ts
git commit -m "feat(plati): record, edit and cancel payments with A.C.S. and undo"
```

---

### Task 5: Add an abonament, "Anulează abonamentul" (high)

**Files:**
- Create: `src/club/presence/subscriptions/add.ts`, `src/club/presence/subscriptions/cancel.ts`
- Test: `src/club/presence/__tests__/subscription-writes.test.ts`

**Interfaces:**
- Consumes: Task 1 (`schoolListIds`, `listsForAthlete`, `offeredSubscriptionItems`, `coverCandidates`, `defaultCover`, `checkCover`, `subscriptionWrite`, `athleteListIdsToday`), Task 2 (`readAmount`), Task 4 (`writePaymentLocked`), 5-1 (`audienceFor`, `seasonOfDate`, `usedSlots`, `subscriptionStamp` via `guardOf`, `recordPresenceAction`).
- Produces:

```ts
export type NewSubscriptionForm = {
  athleteName: string; hasEmail: boolean; audience: Audience; startsOn: string; validUntil: string;
  lists: { priceListId: string; listName: string; items: OfferedItem[] }[];
  cover: CoverRow[];
};
export type AddSubscriptionResult = { subscriptionId: string; athleteName: string; withPayment: boolean };
export function newSubscriptionForm(store: PresenceStore, athleteId: string, startsOn: string | null, today: string): Promise<AdminResult<NewSubscriptionForm>>;
export function addSubscription(ctx: PresenceContext, athleteId: string, body: unknown): Promise<ActionResult<AddSubscriptionResult>>;
export function cancelSubscription(ctx: PresenceContext, subscriptionId: string): Promise<ActionResult<{ cancelled: true }>>;
```

Body: `{ itemKey: string; priceListId: string; startsOn: string; cover: string[]; payment?: { amount: number; method: PaymentMethod; collectedAtRink: boolean; sendEmail: boolean } }` (spec 6). The payment is dated today, purpose `abonament` with the new id, note null (C57).

Rules the tests pin (4.8a, 4.9, 7.1 to 7.3, decided 1, 8): athlete locked first and re-read; the list must be in `listsForAthlete` for the athlete's main school group on `startsOn`; the item offered to the audience of `seasonOfDate(startsOn)`; no season for `startsOn`: 400; the cover ids checked by `checkCover` against the athlete's rows read after the lock (else 409 `PRESENCE_ERRORS.conflict`, nothing written); covered rows get `subscriptionId` and `billing: 'slot'`; lines `subscription-added` on the athlete and the subscription (`{ itemName, startsOn, validUntil, covered }`) plus the payment's lines; undo steps `deleteSubscription`, `setAttendanceSlot` per covered row (`null`, `fara_abonament`), then the payment's steps; guards `subscription` (after the cover, so the used count is in the stamp) and `payment`. Cancel: athlete then subscription locked; already cancelled or a non-cancelled payment with this `subscriptionId`: 409 stale; freed rows become `fara_abonament`; line `subscription-cancelled` on the subscription; undo `setSubscription { cancelled: false, cancelledAt: null, cancelledBy: null }` and `setAttendanceSlot(id, subId, 'slot')` per freed row; guards the subscription and each freed attendance.

- [ ] **Step 1: Write the failing test** `subscription-writes.test.ts` (athlete `a1` main group `g-ib` (pl-std) in s26, A.C.S. none; three `fara_abonament` rows `t1` 2026-10-06, `t2` 2026-10-13, `t3` 2026-10-20 in `g-ib`; today `2026-11-20`):

```ts
const add = (over: object = {}) => ({ itemKey: 'Abonament 8 ședințe', priceListId: 'pl-std', startsOn: '2026-10-27', cover: ['t1', 't2'], ...over });
it('the form: items of the main school list at the audience price, coverage oldest first, expiry (5.8)', async () => {
  const f = fakePresenceContext(seed());
  const form = await newSubscriptionForm(f.store, 'a1', '2026-10-27', '2026-11-20');
  expect(form).toMatchObject({ ok: true, data: { audience: 'nonMember', validUntil: '2026-11-23', hasEmail: true,
    lists: [{ priceListId: 'pl-std', listName: 'Standard', items: [{ itemKey: 'Abonament 8 ședințe', price: 360 }, { itemKey: 'Abonament 6 ședințe', price: 290 }] }] } });
  expect(form.ok && form.data.cover.map((c) => c.attendanceId)).toEqual(['t1', 't2', 't3']);
});
it('adds, freezes, covers and writes the lines (4.9, 8)', async () => {
  const f = fakePresenceContext(seed());
  const res = await addSubscription(f.ctx, 'a1', add());
  expect(res).toMatchObject({ ok: true, data: { value: { athleteName: 'Ana Ionescu', withPayment: false } } });
  expect(f.state.subscriptions[0]).toMatchObject({ itemName: 'Abonament 8 ședințe', price: 360, audience: 'nonMember', slots: 8, validUntil: '2026-11-23', recordedBy: 'Admin Test' });
  expect(f.state.attendances.filter((a) => a.billing === 'slot').map((a) => a.id)).toEqual(['t1', 't2']);
  expect(historyTexts(f, 'athlete', 'a1')).toEqual(['Abonament adăugat: Abonament 8 ședințe, din 27 oct 2026, expiră pe 23 nov 2026.', 'Acoperă 2 prezențe fără abonament.']);
});
it('with the payment: one action, the toast undo removes both and restores the rows (5.8, 7.3)', async () => {
  const f = fakePresenceContext(seed());
  const res = await addSubscription(f.ctx, 'a1', add({ payment: { amount: 360, method: 'numerar', collectedAtRink: true, sendEmail: true } }));
  expect(f.state.payments[0]).toMatchObject({ purpose: 'abonament', subscriptionId: f.state.subscriptions[0].id, paidOn: '2026-11-20', collectedAtRink: true });
  expect(f.state.jobs).toHaveLength(1);
  expect(f.group.locks.slice(0, 2)).toEqual(['athlete:a1', `subscription:${f.state.subscriptions[0].id}`]);
  await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) });
  expect([f.state.subscriptions, f.state.payments]).toEqual([[], []]);
  expect(f.state.attendances.every((a) => a.billing === 'fara_abonament' && a.subscriptionId === null)).toBe(true);
  expect(f.state.jobs[0].status).toBe('cancelled');
});
it('the undo is refused once a slot of it was used (7.3)', async () => {
  const f = fakePresenceContext(seed());
  const res = await addSubscription(f.ctx, 'a1', add({ cover: [] }));
  await f.store.updateAttendance('t3', { subscriptionId: f.state.subscriptions[0].id, billing: 'slot' });
  expect((await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) })).ok).toBe(false);
});
it('a covered row that got a slot meanwhile refuses everything; more rows than slots refused (Review Focus)', async () => {
  const f = fakePresenceContext(seed());
  await f.store.updateAttendance('t2', { subscriptionId: 'other', billing: 'slot' });
  expect(await addSubscription(f.ctx, 'a1', add())).toEqual({ ok: false, status: 409, error: 'Prezența s-a schimbat între timp. Reîncarcă.' });
  expect(f.state.subscriptions).toEqual([]);
  expect((await addSubscription(f.ctx, 'a1', add({ itemKey: 'Abonament 6 ședințe', cover: ['t1', 't2', 't3', 'x4', 'x5', 'x6', 'x7'] }))).ok).toBe(false);
});
it('a second identical abonament within 10 s is not written (decided 1)', async () => {
  const f = fakePresenceContext(seed());
  await addSubscription(f.ctx, 'a1', add({ cover: [] }));
  expect(await addSubscription(f.ctx, 'a1', add({ cover: [] }))).toMatchObject({ ok: true, data: { actionId: null } });
  expect(f.state.subscriptions).toHaveLength(1);
});
it('refuses an item not offered, a list not the athlete\'s, a Gold item for a Standard athlete (4.9)', async () => {
  const f = fakePresenceContext(seed());
  expect((await addSubscription(f.ctx, 'a1', add({ itemKey: 'Nu există' }))).ok).toBe(false);
  expect((await addSubscription(f.ctx, 'a1', add({ priceListId: 'pl-gold', itemKey: 'Abonament 8 ședințe Gold' }))).ok).toBe(false);
});
it('"Anulează abonamentul": row kept anulat, its rows back to "Fără abonament"; undo restores the links (4.8a, p5 Q40)', async () => {
  const f = fakePresenceContext(seed());
  await addSubscription(f.ctx, 'a1', add());
  const id = f.state.subscriptions[0].id;
  const res = await cancelSubscription(f.ctx, id);
  expect(f.state.subscriptions[0]).toMatchObject({ cancelled: true, cancelledBy: 'Admin Test' });
  expect(f.state.attendances.map((a) => a.billing)).toEqual(['fara_abonament', 'fara_abonament', 'fara_abonament']);
  expect(historyTexts(f, 'subscription', id)).toContain('Abonament anulat.');
  await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) });
  expect(f.state.attendances.filter((a) => a.subscriptionId === id).map((a) => a.id)).toEqual(['t1', 't2']);
});
it('cancel refused while a payment points to it, allowed after that payment is cancelled (C75)', async () => {
  const f = fakePresenceContext(seed());
  await addSubscription(f.ctx, 'a1', add({ payment: { amount: 360, method: 'numerar', collectedAtRink: false, sendEmail: false } }));
  const id = f.state.subscriptions[0].id;
  expect(await cancelSubscription(f.ctx, id)).toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
  await cancelPayment(f.ctx, f.state.payments[0].id);
  expect((await cancelSubscription(f.ctx, id)).ok).toBe(true);
});
it('the cancel undo is refused once a freed row was covered again (7.3)', async () => {
  const f = fakePresenceContext(seed());
  await addSubscription(f.ctx, 'a1', add());
  const res = await cancelSubscription(f.ctx, f.state.subscriptions[0].id);
  f.advance(11_000);
  await addSubscription(f.ctx, 'a1', add({ cover: ['t1'] }));
  expect((await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) })).ok).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/subscription-writes.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** `add.ts` (helpers `readAddBody`, `pickItem`, `coverRows`, `addLines`, `findDuplicate`) and `cancel.ts`. The main school list on `startsOn`: the athlete's current main membership in `seasonOfDate(startsOn)` whose group's list is a school list.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/subscriptions/add.ts src/club/presence/subscriptions/cancel.ts src/club/presence/__tests__/subscription-writes.test.ts
git commit -m "feat(abonamente): add with coverage and payment, cancel, both undoable"
```

---

### Task 6: "Prelungește abonamentele" (high)

**Files:**
- Create: `src/club/presence/subscriptions/extend.ts`
- Test: `src/club/presence/__tests__/extend.test.ts`

**Interfaces:**
- Consumes: Task 1 (`extendableIds`, `extendKey`, `extendedValues`, `schoolListIds`, `SUBSCRIPTION_COPY.extendStale`), 5-1 (`usedSlots`, `recordPresenceAction`, `guardOf`).
- Produces: `extendPreview(store: PresenceStore, today: string): Promise<{ count: number; key: string }>`; `extendSubscriptions(ctx: PresenceContext, body: unknown): Promise<ActionResult<{ count: number; weeks: number }>>`. Body `{ weeks: integer 1..12, key: string }` (C59, decided 3). Locks: the subscription rows only, sorted (7.1); the set and key computed again after the locks; a different key or count 0: 409 "Abonamentele s-au schimbat. Reîncarcă pagina.". Lines per row: `subscription-extended` `{ weeks, from, to }` on the athlete and on the subscription. Undo: `setSubscription { extendedWeeks, validUntil }` (old values) per row; guards each subscription; `athletes` of the record = the rows' athletes.

- [ ] **Step 1: Write the failing test** `extend.test.ts` (today `2026-11-20`; `a` active, `b` active ending today, `c` expired yesterday, `d` used up, `e` cancelled):

```ts
it('the preview counts abonamente active today (5.9, C77)', async () => {
  const f = fakePresenceContext(seed());
  expect((await extendPreview(f.store, '2026-11-20')).count).toBe(2);
});
it('extends each by the weeks, recomputes validUntil, writes the lines; no athlete lock (5.9, 7.1, 8)', async () => {
  const f = fakePresenceContext(seed());
  const { key } = await extendPreview(f.store, '2026-11-20');
  expect(await extendSubscriptions(f.ctx, { weeks: 2, key })).toMatchObject({ ok: true, data: { value: { count: 2, weeks: 2 } } });
  expect(f.state.subscriptions.find((s) => s.id === 'b')).toMatchObject({ extendedWeeks: 2, validUntil: '2026-12-04' });
  expect(f.state.subscriptions.find((s) => s.id === 'c')?.extendedWeeks).toBe(0);
  expect(f.group.locks).toEqual(['subscription:a', 'subscription:b']);
  expect(historyTexts(f, 'subscription', 'b')).toEqual(['Prelungit cu 2 săptămâni: 20 nov 2026 → 4 dec 2026.']);
  expect(historyTexts(f, 'athlete', 'a2')).toEqual(['Abonament prelungit cu 2 săptămâni: expiră pe 4 dec 2026.']);
});
it('the same preview sent twice: the second is refused (decided 3, Review Focus)', async () => {
  const f = fakePresenceContext(seed());
  const { key } = await extendPreview(f.store, '2026-11-20');
  await extendSubscriptions(f.ctx, { weeks: 1, key });
  expect(await extendSubscriptions(f.ctx, { weeks: 1, key })).toEqual({ ok: false, status: 409, error: 'Abonamentele s-au schimbat. Reîncarcă pagina.' });
});
it('weeks outside 1 to 12 or not whole: 400', async () => {
  const f = fakePresenceContext(seed());
  const { key } = await extendPreview(f.store, '2026-11-20');
  for (const weeks of [0, 13, 1.5, '2']) expect((await extendSubscriptions(f.ctx, { weeks, key })).ok).toBe(false);
});
it('undo subtracts the weeks; refused after another extension (7.3)', async () => {
  const f = fakePresenceContext(seed());
  const res = await extendSubscriptions(f.ctx, { weeks: 1, key: (await extendPreview(f.store, '2026-11-20')).key });
  expect(await undoPresenceAction(f.ctx, { actionId: actionIdOf(res) })).toEqual({ ok: true, data: { undone: true } });
  expect(f.state.subscriptions.find((s) => s.id === 'a')?.extendedWeeks).toBe(0);
  const again = await extendSubscriptions(f.ctx, { weeks: 1, key: (await extendPreview(f.store, '2026-11-20')).key });
  await extendSubscriptions(f.ctx, { weeks: 1, key: (await extendPreview(f.store, '2026-11-20')).key });
  expect((await undoPresenceAction(f.ctx, { actionId: actionIdOf(again) })).ok).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/extend.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** `extend.ts`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/subscriptions/extend.ts src/club/presence/__tests__/extend.test.ts
git commit -m "feat(abonamente): extend active abonamente by weeks with preview key and undo"
```

---

### Task 7: Reads: Abonamente, athlete tabs, "Pentru", Plăți, De încasat (high)

**Files:**
- Create: `src/club/presence/money-api.ts`, `subscriptions/reads.ts`, `payments/reads.ts`, `due/reads.ts`
- Test: `src/club/presence/__tests__/money-reads.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 2; 5-1 (`subscriptionState`, `usedSlots`, `seasonOfDate`, `monthOf`, `isMonth`, `groupsWithoutPriceList`); `currentSeason`.
- Produces (`money-api.ts`, imported by plan 5-6):

```ts
export type SubscriptionStateFilter = 'toate' | 'active' | 'epuizate' | 'expirate' | 'anulate';
export type SubscriptionListRow = { subscriptionId: string; athleteId: string; athleteName: string; groupName: string | null; slots: number; used: number;
  validUntil: string; expired: boolean; state: SubscriptionState; canCancel: boolean };
export type SubscriptionListPage = { rows: SubscriptionListRow[]; groups: { value: string; label: string }[] };
export type AthleteSubscriptions = { groups: { name: string; main: boolean }[]; bars: AbonamentBar[]; earlier: { itemName: string; startsOn: string; validUntil: string; used: number; slots: number; state: SubscriptionState }[] };
export type MonthRow = { month: string; grup: number; uscat: number; lessons: number; due: number; paid: number; left: number; lines: string[] };
export type PaymentRowView = { paymentId: string; athleteId: string; athleteName: string; paidOn: string; purpose: PaymentPurpose; purposeText: string; method: PaymentMethod;
  collectedAtRink: boolean; amount: number; recordedBy: string; cancelled: boolean; for: PaymentFor; note: string | null };
export type AthletePayments = { months: MonthRow[]; payments: PaymentRowView[]; hasEmail: boolean; readOnly: boolean };
export type PaymentList = { rows: PaymentRowView[]; total: number };
export type SchoolDueRow = SchoolDue & { athleteName: string; groupName: string | null };
export type ClubDueRow = { athleteId: string; athleteName: string; groupNames: string; grup: number; uscat: number; lessons: number; due: number; paid: number; left: number };
export type DuePage = { month: string; school: SchoolDueRow[]; club: ClubDueRow[]; groupsWithoutList: number };
```

- Services: `readSubscriptionQuery(q: Record<string, unknown>): { state: SubscriptionStateFilter; groupId: string | null }` (default `active`); `listSubscriptions(store, q, today): Promise<SubscriptionListPage>` (Grupă = main group today, sorted `validUntil` ascending, `canCancel` = not `anulat` and no non-cancelled payment points to it, `groups` = active school groups); `athleteSubscriptions(store, athleteId, seasonId: string | null, today): Promise<AthleteSubscriptions | null>` (bars = state `activ`; earlier = the rest, newest `startsOn` first); `athletePayments(store, athleteId, today): Promise<AthletePayments | null>` (months from `clubMonths` with detail lines as text, payments newest first, `readOnly` for an anonymized athlete, C52); `athletePaymentOptions(store, athleteId, today): Promise<PaymentOption[] | null>`; `readPaymentQuery(q)` (month default `monthOf(today)`, method and purpose null for "Toate"); `listPayments(store, q, today): Promise<PaymentList>` (by `paidOn` in the month, newest first, `total` without cancelled rows); `readDue(store, month, today): Promise<DuePage>` (school part from `schoolDue` ignoring the month; Club part from `clubMonths` of each athlete for that month, athletes with `due > 0` or a payment for that month, sorted `left` descending then name; `groupsWithoutList` = `groupsWithoutPriceList` of active groups of the current season).

- [ ] **Step 1: Write the failing test** `money-reads.test.ts`:

```ts
it('Abonamente: default Active, Grupă = main group today, sorted by expiry, cancel hidden with a payment (5.9, C58, C75)', async () => {
  const f = fakePresenceContext(listSeed());
  const page = await listSubscriptions(f.store, readSubscriptionQuery({}), '2026-11-20');
  expect(page.rows.map((r) => [r.athleteName, r.groupName, `${r.used}/${r.slots}`, r.validUntil, r.state, r.canCancel])).toEqual([
    ['Sofia Dinu', 'Intermediari Bronze', '2/8', '2026-11-21', 'activ', true],
    ['Ana Ionescu', 'Intermediari Bronze', '5/8', '2026-11-23', 'activ', false]]);
  const all = await listSubscriptions(f.store, readSubscriptionQuery({ state: 'toate' }), '2026-11-20');
  expect(all.rows.find((r) => r.state === 'expirat')?.expired).toBe(true);
  expect((await listSubscriptions(f.store, readSubscriptionQuery({ state: 'epuizate' }), '2026-11-20')).rows.map((r) => r.athleteName)).toEqual(['Matei Popescu']);
});
it('athlete abonament tab: groups of the season, active bars, earlier ones (5.7)', async () => {
  const f = fakePresenceContext(listSeed());
  expect(await athleteSubscriptions(f.store, 'a1', 's26', '2026-11-20')).toEqual({
    groups: [{ name: 'Intermediari Bronze', main: true }],
    bars: [{ subscriptionId: 'sa', itemName: 'Abonament 8 ședințe', slots: 8, used: 5, validUntil: '2026-11-23' }],
    earlier: [{ itemName: 'Abonament 8 ședințe', startsOn: '2026-09-29', validUntil: '2026-10-26', used: 8, slots: 8, state: 'epuizat' }] });
});
it('Plăți list: month, filters, newest first, total without cancelled (5.10, C62)', async () => {
  const f = fakePresenceContext(listSeed());
  const list = await listPayments(f.store, readPaymentQuery({ month: '2026-10' }, '2026-11-20'), '2026-11-20');
  expect(list.rows.map((r) => [r.paidOn, r.purposeText, r.cancelled])).toEqual([
    ['2026-10-27', 'Abonament 8 ședințe', false], ['2026-10-26', 'Club, septembrie', false], ['2026-10-22', 'Lecție individuală', true]]);
  expect(list.total).toBe(660);
  expect((await listPayments(f.store, readPaymentQuery({ month: '2026-10', method: 'transfer' }, '2026-11-20'), '2026-11-20')).rows).toHaveLength(1);
  expect((await listPayments(f.store, readPaymentQuery({ month: '2026-10', purpose: 'club_luna' }, '2026-11-20'), '2026-11-20')).total).toBe(340);
});
it('De încasat: Școala part ignores the month; Club part owing first; notice count (5.11, p5 Q34, C64)', async () => {
  const f = fakePresenceContext(listSeed());
  const due = await readDue(f.store, '2026-10', '2026-11-20');
  expect(due.school.map((r) => [r.athleteName, r.groupName, r.price, r.paid, r.left])).toEqual([['Sofia Dinu', 'Intermediari Bronze', 320, 0, 320]]);
  expect(due.club.map((r) => [r.athleteName, r.groupNames, r.due, r.paid, r.left])).toEqual([
    ['Matei Popescu', 'Profesioniști', 340, 0, 340], ['David Stan', 'Avansați', 260, 100, 160], ['Ioana Dinu', 'Avansați', 240, 240, 0]]);
  expect(due.groupsWithoutList).toBe(1);
  expect((await readDue(f.store, '2026-09', '2026-11-20')).club).toEqual([]);   // before the start date 2026-10-01
});
it('athlete Plăți tab: months newest first with detail lines; read-only when anonymized (5.7, C52)', async () => {
  const f = fakePresenceContext(listSeed());
  const tab = await athletePayments(f.store, 'a4', '2026-11-20');
  expect(tab?.months[0]).toMatchObject({ month: '2026-10', grup: 5, uscat: 2, due: 260, paid: 100, left: 160 });
  expect(tab?.months[0].lines[0]).toBe('Mar 6 oct, Avansați, Grup 40 RON, Uscat inclus');
  expect((await athletePayments(f.store, 'a9', '2026-11-20'))?.readOnly).toBe(true);
  expect(await athletePayments(f.store, 'missing', '2026-11-20')).toBeNull();
});
```

`listSeed()` (test-local): athletes Ana (a1), Sofia (a2), Matei (a3, Club `g-pro` and an epuizat abonament), David (a4, `g-av`), Ioana (a5, `g-av`), a9 anonymized; payments as in the mockup of p5-4 (27 oct 320 abonament, 26 oct 340 `club_luna` 2026-09 transfer, 22 oct 80 lesson cancelled); start date 2026-10-01; the attendance and lesson rows giving the De încasat numbers above.

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/money-reads.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the four files; each read loads its rows once (`subscriptions()`, `attendances({ subscriptionIds })`, `payments(...)`, `memberships()`, `groups()`, `athletes()`), never one query per athlete.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/money-api.ts src/club/presence/subscriptions/reads.ts src/club/presence/payments/reads.ts src/club/presence/due/reads.ts src/club/presence/__tests__/money-reads.test.ts
git commit -m "feat(plati): Abonamente, Plăți, athlete tabs, Pentru options and De încasat reads"
```

---

### Task 8: Gold carry on "Mută", move preview, carry undo (high)

**Files:**
- Create: `src/club/presence/subscriptions/carry.ts`, `src/club/presence/subscriptions/move.ts`
- Modify: `src/club/groups/members.ts` (`moveMembership`, `moveLocked`), `src/club/groups/undo.ts` (op `uncarry`, `CarryPorts`), `src/club/groups/undo-service.ts` (runner, refusal, `undoAction` ports parameter)
- Test: `src/club/presence/__tests__/carry.test.ts`, `src/club/groups/__tests__/move-carry.test.ts`

**Interfaces:**
- Consumes: Task 1 (`barOf`, `currentSubscription`, `athleteListIdsToday`, `schoolListIds`), 5-1 (`subscriptionState`, `isValidForList`, `usedSlots`, `P5_ACTIONS.subscriptionCarried`, `SUBJECT.subscription`), `priceFor`, phase 4 `Line`, `UndoStep`, `GroupContext`.
- Produces:

```ts
// carry.ts (pure, 4.11, p5 Q35, decided 10)
export function carryList(i: { subs: SubscriptionRow[]; used: Map<string, number>; fromListId: string; to: PriceListRecord; today: string }): SubscriptionRow[];
// groups/members.ts
export type CarryInput = { athleteId: string; fromGroupId: string; toGroupId: string; today: string };
export type CarryOutcome = { lines: Line[]; steps: UndoStep[]; carried: number };
export type MoveCarry = (i: CarryInput) => Promise<CarryOutcome>;
export const NO_CARRY: MoveCarry;   // answers { lines: [], steps: [], carried: 0 }
export function moveMembership(ctx: GroupContext, membershipId: string, body: unknown, carry?: MoveCarry): Promise<ActionResult<MoveResult & { carried: number }>>;
// groups/undo.ts
export type UndoStep = ... | { op: 'uncarry'; subscriptionId: string; priceListId: string };
export type CarryPorts = { uncarry(subscriptionId: string, priceListId: string): Promise<void>; carryUsed(subscriptionId: string, priceListId: string): Promise<boolean> };
export const NO_CARRY_PORTS: CarryPorts;   // uncarry throws 'carry undo needs the presence store'; carryUsed answers false
// groups/undo-service.ts
export function undoAction(ctx: GroupContext, body: unknown, ports?: CarryPorts): Promise<AdminResult<{ undone: true }>>;
// subscriptions/move.ts
export type MovePreview = { bar: AbonamentBar | null; carries: boolean };
export function presenceCarry(store: PresenceStore): { carry: MoveCarry; ports: CarryPorts };
export function movePreview(store: PresenceStore, i: { athleteId: string; fromGroupId: string; toGroupId: string | null }, today: string): Promise<MovePreview>;
```

- Rules: the carry runs only from a school group to a school group, both with a list, the lists different (5.12: same-list and Club moves carry nothing); inside `presence.transaction` (reuses the move's transaction), each carried subscription locked (sorted) after the move's athlete lock, re-read, `validIn` gains the new list; one line `subscription-carried` `{ listName }` on the subscription per carry, part of the move's action (its `actionId`); one `uncarry` step each. The move undo runs `uncarry` (remove that list from `validIn`) and is refused with `GROUP_ERRORS.undoGroup` when `carryUsed` (an attendance with that subscription in a group whose list is the carried list). Preview: `bar` = `currentSubscription` over the athlete's school lists today (decided 9); `carries` = a target is given and `carryList` contains the bar's subscription.

- [ ] **Step 1: Write the failing tests**

`carry.test.ts`:

```ts
const std = subscriptionRow({ id: 'std', priceListId: 'pl-std', price: 320, audience: 'member', slots: 8, validUntil: '2026-11-23' });
const gold = subscriptionRow({ id: 'gold', priceListId: 'pl-gold', price: 400, audience: 'member', slots: 8, validUntil: '2026-11-23' });
const none = new Map<string, number>();
it('Standard -> Gold carried (cheaper); Gold -> Standard never; missing Gold price carried (4.11, p5 Q35)', () => {
  expect(carryList({ subs: [std], used: none, fromListId: 'pl-std', to: list('pl-gold'), today: '2026-11-20' }).map((s) => s.id)).toEqual(['std']);
  expect(carryList({ subs: [gold], used: none, fromListId: 'pl-gold', to: list('pl-std'), today: '2026-11-20' })).toEqual([]);
  const noPrice = { ...list('pl-gold'), items: list('pl-gold').items.map((i) => ({ ...i, memberPrice: null })) };
  expect(carryList({ subs: [std], used: none, fromListId: 'pl-std', to: noPrice, today: '2026-11-20' })).toHaveLength(1);
  const sixOnly = { ...list('pl-gold'), items: [] };
  expect(carryList({ subs: [std], used: none, fromListId: 'pl-std', to: sixOnly, today: '2026-11-20' })).toHaveLength(1);
});
it('only active abonamente valid for the old list and not yet valid for the new one (4.11)', () => {
  const args = (subs: SubscriptionRow[], used = none) => ({ subs, used, fromListId: 'pl-std', to: list('pl-gold'), today: '2026-11-20' });
  expect(carryList(args([{ ...std, cancelled: true }]))).toEqual([]);
  expect(carryList(args([std], new Map([['std', 8]])))).toEqual([]);
  expect(carryList(args([{ ...std, validUntil: '2026-11-19' }]))).toEqual([]);
  expect(carryList(args([{ ...std, validIn: ['pl-gold'] }]))).toEqual([]);
  expect(carryList(args([{ ...std, price: null }]))).toEqual([]);   // decided 10
});
it('the port writes the carry and its line; the preview shows the bar and the Gold flag (5.12)', async () => {
  const f = fakePresenceContext(moveSeed());   // a1 in g-ib (pl-std) with std
  const { carry } = presenceCarry(f.store);
  let out!: CarryOutcome;
  await f.store.transaction(async () => { await f.store.lockAthlete('a1'); out = await carry({ athleteId: 'a1', fromGroupId: 'g-ib', toGroupId: 'g-gold', today: '2026-11-20' }); });
  expect(out.carried).toBe(1);
  expect(out.steps).toEqual([{ op: 'uncarry', subscriptionId: 'std', priceListId: 'pl-gold' }]);
  expect(out.lines).toEqual([{ subjectType: 'subscription', subjectId: 'std', action: 'subscription-carried', changes: { listName: 'Avansați Gold' } }]);
  expect(f.state.subscriptions[0].validIn).toEqual(['pl-gold']);
  expect(f.group.locks).toEqual(['athlete:a1', 'subscription:std']);
  const g = fakePresenceContext(moveSeed());
  expect(await movePreview(g.store, { athleteId: 'a1', fromGroupId: 'g-ib', toGroupId: 'g-gold' }, '2026-11-20')).toEqual({ bar: { subscriptionId: 'std', itemName: 'Abonament 8 ședințe', slots: 8, used: 0, validUntil: '2026-11-23' }, carries: true });
  expect((await movePreview(g.store, { athleteId: 'a1', fromGroupId: 'g-ib', toGroupId: 'g-av' }, '2026-11-20')).carries).toBe(false);
  expect((await movePreview(g.store, { athleteId: 'a1', fromGroupId: 'g-ib', toGroupId: null }, '2026-11-20')).carries).toBe(false);
});
it('Club moves and same-list moves carry nothing', async () => {
  const f = fakePresenceContext(moveSeed());
  const { carry } = presenceCarry(f.store);
  await f.store.transaction(async () => {
    expect((await carry({ athleteId: 'a1', fromGroupId: 'g-ib', toGroupId: 'g-av', today: '2026-11-20' })).carried).toBe(0);
    expect((await carry({ athleteId: 'a1', fromGroupId: 'g-ib', toGroupId: 'g-ib2', today: '2026-11-20' })).carried).toBe(0);
  });
});
it('undo ports: uncarry removes the list; carryUsed sees a slot used in a Gold group', async () => {
  const f = fakePresenceContext(moveSeed({ validIn: ['pl-gold'] }));
  const { ports } = presenceCarry(f.store);
  expect(await ports.carryUsed('std', 'pl-gold')).toBe(false);
  f.state.attendances.push(attendanceRow({ id: 't9', sessionId: 'sg', subscriptionId: 'std', billing: 'slot' }));   // sg is a g-gold session
  expect(await ports.carryUsed('std', 'pl-gold')).toBe(true);
  await f.store.transaction(() => ports.uncarry('std', 'pl-gold'));
  expect(f.state.subscriptions[0].validIn).toEqual([]);
});
```

`move-carry.test.ts` (phase 4 fake group context, a stub `MoveCarry` returning one line and one `uncarry` step, stub `CarryPorts` recording calls):

```ts
it('the move writes the carry lines in its action and answers carried (5.12)', async () => {
  const f = fakeGroupContext(moveGroupSeed());
  const res = await moveMembership(f.ctx, 'm1', { toGroupId: 'g-gold' }, stubCarry);
  expect(res).toMatchObject({ ok: true, data: { value: { carried: 1 } } });
  expect(f.state.history.find((h) => h.action === 'subscription-carried')?.changes.actionId).toBe(actionIdOf(res));
});
it('without a carry port the move is unchanged (phase 4 tests)', async () => {
  const f = fakeGroupContext(moveGroupSeed());
  expect(await moveMembership(f.ctx, 'm1', { toGroupId: 'g-gold' })).toMatchObject({ ok: true, data: { value: { carried: 0 } } });
});
it('the move undo runs uncarry; refused when the carry was used (7.3)', async () => {
  const f = fakeGroupContext(moveGroupSeed());
  const res = await moveMembership(f.ctx, 'm1', { toGroupId: 'g-gold' }, stubCarry);
  expect(await undoAction(f.ctx, { actionId: actionIdOf(res) }, stubPorts({ used: true }))).toEqual({ ok: false, status: 409, error: GROUP_ERRORS.undoGroup });
  const ports = stubPorts({ used: false });
  expect((await undoAction(f.ctx, { actionId: actionIdOf(res) }, ports)).ok).toBe(true);
  expect(ports.calls).toEqual([['uncarry', 'std', 'pl-gold']]);
});
```

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/club/presence/__tests__/carry.test.ts src/club/groups/__tests__/move-carry.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** `carry.ts`, `move.ts`; in `members.ts` `moveLocked` calls `carry(...)` after `applyPlan` and before `recordAction`, appends its lines and steps; in `undo.ts` add the op and the ports types (`targetsOf` needs no case); in `undo-service.ts` the runner type gains a 4th `ports` argument, `uncarry: (_s, st, _id, p) => p.uncarry(st.subscriptionId, st.priceListId)`, and `undoLocked` refuses when any `uncarry` step has `await ports.carryUsed(...)` true (checked with the other refusals, before the steps run).
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS (every phase 4 members and undo test unchanged).
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/subscriptions/carry.ts src/club/presence/subscriptions/move.ts src/club/groups/members.ts src/club/groups/undo.ts src/club/groups/undo-service.ts src/club/presence/__tests__/carry.test.ts src/club/groups/__tests__/move-carry.test.ts
git commit -m "feat(abonamente): carry a cheaper abonament on a move to Gold, preview and undo"
```

---

### Task 9: Sportivi "Abonament" column and filter data, presence activity in "Inactivi" (low)

**Files:**
- Create: `src/club/presence/subscriptions/cells.ts`
- Modify: `src/club/athletes/list.ts` (`AthleteListQuery.abonament`, `ListSource.abonamente?`, `publicRow`, `TESTS`, `athleteListPage`), `src/club/athletes/api-types.ts` (`AthleteListRow.abonament: string | null`)
- Test: `src/club/presence/__tests__/cells.test.ts`

**Needs merged:** plan 5-4's `src/club/lifecycle/activity.ts` (`loadPresenceActivity`) and its optional `InactivityInput.activity` for Steps 1 to 4 of the activity part; if 5-4 is not merged yet when this task starts, do the abonament part first and the activity part (the last test and the `activity` wiring) once it is.

**Interfaces:**
- Consumes: Task 1 (`currentSubscription`, `athleteListIdsToday`, `barOf`, `abonamentCellText`, `schoolListIds`); plan 5-4: `loadPresenceActivity(presence: PresenceStore): Promise<NonNullable<InactivityInput['activity']>>` and `InactivityInput.activity?` (`src/club/personal-data/inactivity.ts`), names exactly as plan 5-4 defines them.
- Produces: `abonamentCells(store: PresenceStore, today: string): Promise<Map<string, AbonamentBar>>` (one read of subscriptions, attendances by subscription ids, memberships, groups, price lists, sections); `readListQuery` reads `abonament=activ|fara` (else null); `export type ListPresence = { abonamente?: ReadonlyMap<string, AbonamentBar>; activity?: InactivityInput['activity'] }`; `athleteListPage(store, q, today, now: Date = new Date(), presence: ListPresence = {})` (new parameter appended, so every existing caller and test keeps working); `inactiveAthleteIds({ ..., activity: presence.activity })` so "Inactivi de peste N ani" counts attendance, lessons, payments and abonamente as activity (spec 4.20, relay from plan 5-4); row `abonament` = `abonamentCellText(bar)` or null (5.13, C65).

- [ ] **Step 1: Write the failing test** `cells.test.ts`:

```ts
it('one cell per athlete with an abonament 4.10 would use today (5.13, C65)', async () => {
  const f = fakePresenceContext(cellSeed());   // a1 5/8 until 2026-11-23 in g-ib; a2 expired; a3 none
  const cells = await abonamentCells(f.store, '2026-11-20');
  expect([...cells.keys()]).toEqual(['a1']);
  expect(abonamentCellText(cells.get('a1')!)).toBe('5/8, 23 nov 2026');
});
it('the list shows the column and filters Activ / Fără abonament (5.13)', () => {
  const cells = new Map([['a1', { subscriptionId: 'sa', itemName: 'Abonament 8 ședințe', slots: 8, used: 5, validUntil: '2026-11-23' }]]);
  const src = { ...LIST_SOURCE, abonamente: cells };   // the P3 list test source with a1, a2
  expect(listAthletes(src, { ...readListQuery({}) }).data.map((r) => [r.documentId, r.abonament])).toEqual([['a1', '5/8, 23 nov 2026'], ['a2', null]]);
  expect(listAthletes(src, readListQuery({ abonament: 'activ' })).data.map((r) => r.documentId)).toEqual(['a1']);
  expect(listAthletes(src, readListQuery({ abonament: 'fara' })).data.map((r) => r.documentId)).toEqual(['a2']);
  expect(readListQuery({ abonament: 'x' }).abonament).toBeNull();
});
it('"Inactivi de peste N ani" counts presence activity passed in (4.20, plan 5-4)', async () => {
  // the P3C list-review seed: athlete old1 with no registration or membership for 3 seasons, retention 2 years
  const { store } = setupInactive();
  const ids = async (presence: ListPresence) => (await athleteListPage(store, readListQuery({ inactive: 'true' }), TODAY, NOW, presence)).data.map((r) => r.documentId);
  expect(await ids({})).toContain('old1');
  const f = fakePresenceContext({ payments: [paymentRow({ id: 'p', athleteId: 'old1', paidOn: '2026-10-27', seasonId: 's26' })] });
  expect(await ids({ activity: await loadPresenceActivity(f.store) })).not.toContain('old1');
});
```

`setupInactive`, `TODAY`, `NOW` come from `src/club/personal-data/__tests__/list-review.test.ts` (move its `setup` to a shared helper file if it is local). The payment's season must be one the P3C seed counts as recent.

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/cells.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** `cells.ts` and the list changes (one more entry in `TESTS`; `activity` handed to `inactiveAthleteIds`).
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json`; Expected: PASS (P3 list tests unchanged).
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/subscriptions/cells.ts src/club/athletes/list.ts src/club/athletes/api-types.ts src/club/presence/__tests__/cells.test.ts
git commit -m "feat(sportivi): Abonament column and filter data"
```

---

### Task 10: Routes and controllers (low)

**Files:**
- Create: `src/api/club/routes/10-subscriptions.ts`, `src/api/club/routes/11-payments.ts`, `src/api/club/controllers/subscriptions.ts`, `src/api/club/controllers/payments.ts`
- Modify: `src/api/club/routes/06-groups.ts` (one line), `src/api/club/controllers/groups.ts` (`move`, `undo`, new `movePreview`), `src/api/club/controllers/athletes.ts` (`list`)
- Test: `src/club/presence/__tests__/money-routes.test.ts`

**Interfaces:**
- Consumes: every service above; `presenceContext`, `strapiPresenceStore`, `respond`, `respondAction`, `refuseWith`, `queryText`, `todayIso`, `strapiGroupStore`.
- Produces (spec 6; all `{ auth: false, policies: ['global::is-admin'], middlewares: [] }`; reads answer `{ data }`; writes `{ data, undo }` through `respondAction`):

| Method, path | Handler | Service |
|---|---|---|
| GET `/club/subscriptions` | `subscriptions.list` | `listSubscriptions(readSubscriptionQuery(ctx.query))` |
| GET `/club/subscriptions/extend/preview` | `subscriptions.extendPreview` | `extendPreview` |
| POST `/club/subscriptions/extend` | `subscriptions.extend` | `extendSubscriptions` |
| POST `/club/subscriptions/:documentId/cancel` | `subscriptions.cancel` | `cancelSubscription` |
| GET `/club/athletes/:documentId/subscriptions/new` | `subscriptions.form` | `newSubscriptionForm(?startsOn=)` (404 / 400) |
| GET `/club/athletes/:documentId/subscriptions` | `subscriptions.athlete` | `athleteSubscriptions(?season=)` (404 when null) |
| POST `/club/athletes/:documentId/subscriptions` | `subscriptions.add` | `addSubscription` |
| GET `/club/payments` | `payments.list` | `listPayments(readPaymentQuery)` |
| POST `/club/payments` | `payments.create` | `recordPayment` |
| GET `/club/due` | `payments.due` | `readDue(?month=)` (an invalid month: 400) |
| PUT `/club/payments/:documentId` | `payments.update` | `editPayment` |
| POST `/club/payments/:documentId/cancel` | `payments.cancel` | `cancelPayment` |
| GET `/club/athletes/:documentId/payments/options` | `payments.options` | `athletePaymentOptions` |
| GET `/club/athletes/:documentId/payments` | `payments.athlete` | `athletePayments` |
| GET `/club/memberships/:documentId/move-preview` (06-groups, after `allocate`) | `groups.movePreview` | membership by id (404), `movePreview(?to=)` |

`groups.move` passes `presenceCarry(strapiPresenceStore(strapi)).carry`; `groups.undo` (after the 5-1 presence dispatch) passes its `ports`; `athletes.list` calls `athleteListPage(clubStore(strapi), readListQuery(ctx.query), todayInBucharest(), new Date(), { abonamente: await abonamentCells(presence, todayIso()), activity: await loadPresenceActivity(presence) })` with `presence = strapiPresenceStore(strapi)`.

- [ ] **Step 1: Write the failing test** `money-routes.test.ts` (reads the route files as text and imports them, as the phase 4 route test does):

```ts
it('every new route is admin only (6, 11.3)', () => {
  for (const r of [...subscriptionRoutes.routes, ...paymentRoutes.routes]) expect(r.config, r.path).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
});
it('the paths and handlers of spec 6', () => {
  expect(subscriptionRoutes.routes.map((r) => `${r.method} ${r.path} ${r.handler}`)).toEqual([
    'GET /club/subscriptions subscriptions.list', 'GET /club/subscriptions/extend/preview subscriptions.extendPreview', 'POST /club/subscriptions/extend subscriptions.extend',
    'POST /club/subscriptions/:documentId/cancel subscriptions.cancel', 'GET /club/athletes/:documentId/subscriptions/new subscriptions.form',
    'GET /club/athletes/:documentId/subscriptions subscriptions.athlete', 'POST /club/athletes/:documentId/subscriptions subscriptions.add']);
  expect(paymentRoutes.routes.map((r) => `${r.method} ${r.path} ${r.handler}`)).toEqual([
    'GET /club/payments payments.list', 'POST /club/payments payments.create', 'GET /club/due payments.due', 'PUT /club/payments/:documentId payments.update',
    'POST /club/payments/:documentId/cancel payments.cancel', 'GET /club/athletes/:documentId/payments/options payments.options', 'GET /club/athletes/:documentId/payments payments.athlete']);
});
it('static before parameter paths in each file; move preview in 06-groups (P4 8.2)', () => {
  for (const file of [subscriptionRoutes, paymentRoutes, groupRoutes]) expect(staticBeforeParams(file.routes)).toBe(true);
  expect(groupRoutes.routes.some((r) => r.path === '/club/memberships/:documentId/move-preview' && r.handler === 'groups.movePreview')).toBe(true);
});
it('every handler exists in its controller', () => {
  for (const r of [...subscriptionRoutes.routes, ...paymentRoutes.routes]) {
    const [name, fn] = r.handler.split('.');
    expect(typeof CONTROLLERS[name][fn], r.handler).toBe('function');
  }
});
it('the move and undo handlers pass the presence carry; the Sportivi list passes the cells', () => {
  const groups = readFileSync(join(SRC, 'api/club/controllers/groups.ts'), 'utf8');
  expect(groups).toMatch(/moveMembership\([^)]*presenceCarry\(/s);
  expect(groups).toMatch(/undoAction\([^)]*ports/s);
  const athletes = readFileSync(join(SRC, 'api/club/controllers/athletes.ts'), 'utf8');
  expect(athletes).toMatch(/abonamentCells\(/);
  expect(athletes).toMatch(/activity: await loadPresenceActivity\(/);
});
```

`staticBeforeParams` is the helper of the phase 4 route test (import it).

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/club/presence/__tests__/money-routes.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the four new files and the three edits. A read handler with a missing athlete answers 404 `PRESENCE_ERRORS.notFound`; a bad `month` or `startsOn` 400 `PRESENCE_ERRORS.invalid`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/api/club/routes/10-subscriptions.ts src/api/club/routes/11-payments.ts src/api/club/routes/06-groups.ts src/api/club/controllers/subscriptions.ts src/api/club/controllers/payments.ts src/api/club/controllers/groups.ts src/api/club/controllers/athletes.ts src/club/presence/__tests__/money-routes.test.ts
git commit -m "feat(plati): abonamente, payments, De încasat and move preview routes"
```

---

### Task 11: Boot check on a throwaway Postgres (high)

**Files:** none in the repo. Temporary: `${TMPDIR:-/tmp}/es53` (scripts, `.env`, ids file, cookies), removed at the end.

**Interfaces:**
- Consumes: `scripts/fixtures/phase4-shape.js`, `scripts/fixtures/phase5-shape.js` (5-1), every route of Task 10, `POST /club/undo`.

Container `es53-pg` on 127.0.0.1:55453, Strapi on 1373. Never 1337, 1340, 3010, 5432, 55442.

- [ ] **Step 1: Start the database and Strapi**

Run (from the worktree root): `docker run -d --name es53-pg -e POSTGRES_PASSWORD=es53 -e POSTGRES_DB=es53 -p 127.0.0.1:55453:5432 postgres:16`; a throwaway `.env` in `$TMP=${TMPDIR:-/tmp}/es53` with `DATABASE_HOST=127.0.0.1 DATABASE_PORT=55453 DATABASE_NAME=es53 DATABASE_USERNAME=postgres DATABASE_PASSWORD=es53 PORT=1373`; `npm run build`; `ES_THROWAWAY_DB=1 IDS_FILE=$TMP/ids.json node scripts/fixtures/phase4-shape.js && ES_THROWAWAY_DB=1 IDS_FILE=$TMP/ids.json node scripts/fixtures/phase5-shape.js`; then a temporary `$TMP/attendance.js` (same guard and `createStrapi(...).load()` pattern) that writes through `strapi.documents`: one saved Școala session of the Standard group on 2026-11-07 with two attendance rows `fara_abonament` (athletes A and B), and one Club session of the Club group with a list on 2026-11-07 with one row `club`, charges `[{ type: 'grup', itemName: 'Ședință grup', price: 50, included: false }]`, amount 50 (athlete C). Start Strapi on 1373; log in once as admin with curl (as plan 4-1 Task 12) into `$TMP/cookies`.
Expected: no error in the log.

- [ ] **Step 2: Abonament with coverage and payment, e-mail, undo**

`GET /api/club/athletes/<A>/subscriptions/new?startsOn=2026-11-01` -> `POST /api/club/athletes/<A>/subscriptions` with the first item, `cover` = A's row, `payment` `{ amount: <price>, method: 'numerar', collectedAtRink: true, sendEmail: true }`.
Expected: `data.withPayment` true; `psql -c "select billing, subscription_id is not null from club_attendances"` shows A's row `slot`; `select status, recipient, not_before > now() from email_jobs where kind='payment'` one `queued` row to A's address. Send the same POST twice within a second: Expected one more subscription only (two rows in total), the second answer `undo: null`. `POST /api/club/undo` with the first answer's `actionId`: Expected `{"data":{"undone":true}}`, the row back to `fara_abonament`, the job `cancelled`.

- [ ] **Step 3: Extend, preview key, undo**

`GET /api/club/subscriptions/extend/preview` -> `POST /api/club/subscriptions/extend` `{ weeks: 1, key }` twice.
Expected: first `count` = preview count, `valid_until` + 7 days in `club_subscriptions`; second 409 "Abonamentele s-au schimbat. Reîncarcă pagina."; `POST /api/club/undo` of the first: back to the old dates.

- [ ] **Step 4: Fee payment, A.C.S., cancel, Club due**

`POST /api/club/payments` `{ athleteId: <C>, amount: 100, paidOn: <today>, method: 'card', for: { kind: 'cotizatie', seasonId: <current> }, collectedAtRink: false, note: '', sendEmail: false }`.
Expected: `select state from acs_memberships ...` = `da` for C and that season. `POST /api/club/payments/<id>/cancel`: Expected the state back to its old value (or no row). `POST /api/club/payments` `{ athleteId: <C>, amount: 20, ..., for: { kind: 'club_luna', month: '2026-11' } }`; `GET /api/club/due?month=2026-11`: Expected C in `club` with `due` 50, `paid` 20, `left` 30; `GET /api/club/payments?month=<this month>`: `total` without the cancelled fee.

- [ ] **Step 5: Gold carry and move preview**

`GET /api/club/memberships/<A's membership>/move-preview?to=<Avansați Gold group>`: Expected `bar` of A's abonament, `carries: true`. `POST /api/club/memberships/<id>/move` `{ toGroupId: <Gold> }`: Expected `carried: 1`, the join table of `valid_in` holds the Gold list, a history line `subscription-carried`. `POST /api/club/undo` with its `actionId`: Expected undone, the carry gone.

- [ ] **Step 5b: Move with carry inside a group transaction commits and rolls back together**

A temporary `$TMP/carry.js` (same guard and `createStrapi(...).load()` pattern as `attendance.js`) calls the Task 8 move-with-carry service inside a `GroupStore` transaction (the presence transaction nests in it), then throws once the move has returned, so the outer transaction rolls back. Expected after the throw: `psql` shows A's membership still in the old group, A's subscription `valid_in` without the Gold list, and no `subscription-carried` line. Then the same call without the throw. Expected: commit, membership moved, `valid_in` holds the Gold list, the `subscription-carried` line written.

- [ ] **Step 6: Sportivi and guards**

`GET /api/club/athletes?abonament=activ`: Expected rows with `abonament` "<used>/<slots>, <date>". `curl -s -o /dev/null -w "%{http_code}"` on `/api/club/payments` and `/api/club/subscriptions` without the admin cookie: Expected 401 or 403, never 200.

- [ ] **Step 7: Restart once, clean up**

Stop Strapi, start it again on 1373: Expected no error. Then stop Strapi, `docker rm -f es53-pg`, `rm -rf ${TMPDIR:-/tmp}/es53`. Nothing to commit; write the results (one line per step) on the progress board.

---

## Interfaces for other plans

- **Plan 5-6** imports `money-api.ts` types; `SUBSCRIPTION_COPY`, `PAYMENT_COPY`; `AbonamentBar`, `CoverRow`, `OfferedItem`, `defaultCover`, `checkCover`, `startText`, `abonamentCellText` (`subscriptions/rules.ts`); `PaymentFor`, `PaymentOption`, `readAmount` (`payments/rules.ts`); `NewSubscriptionForm`, `MovePreview`; the routes of Task 10 (bodies as listed in Tasks 4, 5, 6, 8).
- **Plan 5-4** (delete refusal, anonymize, export) reads payments and subscriptions through `PresenceStore` only; it does not need this plan's services. This plan consumes its `loadPresenceActivity` in Task 9 and Task 10 (the Sportivi "Inactivi" filter), so Task 9's activity part waits for 5-4's merge. Anonymize scrubs `payment-email-sent` lines through the `recipient` key and the payment e-mail jobs (kind `payment`, now mapped by `toJobRow`).
- **Plan 5-2** is not touched: the session save keeps choosing slots with 5-1 `pickSubscription`; this plan only reads attendance rows.

## Self-review

- **Spec coverage.** 4.8 slots and expiry (T1, T6), 4.8a cancel (T5), 4.9 items, list choice, coverage, payment (T1, T5), 4.11 carry (T8), 4.13 audience on start date (T5), 4.14 settlement and both De încasat parts (T2, T7), 4.15 Pentru options and amounts (T2, T7), 4.16 fee sets A.C.S. (T2, T4), 4.17 edit and cancel (T4), 4.19 and 9 e-mail (T3, T4), 5.7 tab data (T7), 5.8 window data and toasts copy (T1, T5), 5.9 list, filters, cancel item, extend modal copy and effect (T1, T6, T7), 5.10 list, total, errors, toasts copy (T2, T4, T7), 5.11 De încasat (T7), 5.12 move bar and Gold line (T1, T8), 5.13 Sportivi data (T9), 4.20 inactivity on the Sportivi list with 5-4's activity (T9, T10), 6 routes (T10), 7.1 locks (T4, T5, T6, T8), 7.2 one transaction (T4), 7.3 undo rows for add, extend, record, edit, cancel payment, cancel abonament, move (T4 to T8), 8 writer lines (T4 to T8), 11.1 tests named in the tasks, 11.3 route guards (T10), 11.4 boot steps of this plan (T11). UI (5.7 to 5.14 screens), 5.14 delete dialog: plan 5-6; delete refusal and lifecycle: plan 5-4.
- **Step scan.** Every step names a file, a signature, a test with values, or a command with its expected output; bodies only where the spec fixes copy.
- **Type consistency.** `AbonamentBar` (T1) is used by T7, T8, T9 and 5-6; `PaymentFor` (T2) by T4, T7, `money-api.ts`; `writePaymentLocked` (T4) by T5; `CarryPorts`, `MoveCarry` (T8) by T10; `PresenceContext.paymentEmails` (T3) by T4, T5; `ClubMonth` (T2) by T7.
- **Review Focus.** Double click (T4, T5, T11), slots under concurrency (T1, T5), Gold carry (T8, T11), expiry and extension (T1, T6, T11), cancel with payments (T4, T5), rounding (T2, T7): each has its test.
- **Proportion.** Eleven tasks; code blocks are signatures, assertions and copy tables.
