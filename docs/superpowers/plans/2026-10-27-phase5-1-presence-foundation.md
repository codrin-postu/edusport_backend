# Phase 5-1: Presence Foundation (data, store, shared rules, history, undo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the backend every phase 5 schema change, the `PresenceStore` (Strapi and in memory, in parity), the rules more than one later plan needs (dates, money, session keys and states, abonament state and slot choice, Club prices and audience), every Istoric line of spec 8 and the presence undo engine behind the existing `POST /club/undo`, so plans 5-2, 5-3 and 5-4 can run in parallel.

**Architecture:** Code lives in `src/club/presence/` (spec C71). Pure modules (no Strapi, Node or React imports, so the admin bundle can import them) hold the rules and are tested with Vitest. Services run on `PresenceStore`, a separate interface that extends a `Pick` of the phase 4 `GroupStore` reads, so a presence service never needs two stores; its Strapi implementation reuses `transactionScope` (P3) and spreads the phase 4 store's read functions. Undo follows phase 4: the first Istoric line of an action carries a `PresenceUndoRecord`; `POST /club/undo` looks at the record's `kind` and hands `presence` records to the new undo service, which refuses when a guarded row's stamp changed (spec 7.3).

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS), Postgres 16, Vitest 3, Node 22.

**Spec:** `docs/superpowers/specs/2026-10-27-attendance-payments-design.md` (v1, approved 2026-10-27): sections 3 (all), 4.10 (slot choice), 4.12, 4.13, 3.9, 3.10, 3.11, 7 (locks, undo engine), 8 (every line), 10.1, 11.1 (the pure parts listed per task), 11.2, 11.3 (core routers, `uscat` public), 12 step 2. Index: `docs/superpowers/plans/2026-10-27-phase5-index.md` (its "Shared interfaces" section is binding for names). Decisions: `../edusport_frontend/docs/portal/DECISIONS.md`.

**Base:** `feat/athletes` with phase 4 merged (HEAD `e85bfc4` or later).

**Parallel groups:** A: T1, T2, T4 | B: T3, T5, T7, T8, T9, T10 | C: T6, T11 | D: T12

| Group | Tasks | Runs after | Why they do not collide |
|---|---|---|---|
| A | 1 Schemas, 2 `uscat` kind, 4 Types, dates, money, copy core | nothing | 1: schema.json, routers, `types/generated`; 2: `price-item.ts`, `preturi/format.ts`, `public-info.ts`; 4: new files in `src/club/presence/` |
| B | 3 Indexes, 5 Store and fake, 7 Sessions, 8 Abonament rules, 9 Club prices, 10 History lines | 1 (3), 4 (5, 7 to 10) | 3: `indexes.ts`, `src/index.ts`; 5: `store.ts`, `__tests__/fake-store.ts`; 7: `sessions.ts`; 8: `subscriptions.ts`; 9: `billing.ts`; 10: `copy/history.ts`, `history-lines.ts`, `history-text.ts`, `subjects.ts` |
| C | 6 Strapi store, 11 Undo engine | 5 (6), 5 and 10 (11) | 6: `strapi-store.ts`, `context.ts`; 11: `undo.ts`, `action-log.ts`, `undo-service.ts`, `controllers/groups.ts` (handler `undo` only) |
| D | 12 Fixture and boot check | everything | `scripts/fixtures/phase5-shape.js` only |

Risk: **high** T1, T3, T5, T6, T8, T9, T11, T12 (schema, indexes, locks, slots, money, undo); **low** T2, T4, T7, T10. Per-task reviews run on high tasks only.

## Decided while planning (low impact, decided by Claude; the user may overrule any line)

Log them in DECISIONS.md as "plan 5-1, decided by Claude (low impact, 2026-10-27)". Each is implemented in the one place named.

1. **Indexes from bootstrap, not a migration file (replaces C16's file).** Strapi runs `database/migrations` before its schema sync, so on the first deploy the new tables do not exist yet when a migration runs, and a migration runs only once. `ensurePresenceIndexes(knex)` runs in `bootstrap` (after the sync) on every start with `create index if not exists`; the indexes are the ones of spec 3.10, plus the two unique ones (`occurrence_key`, `unique_key`) created as Postgres unique indexes, because Strapi's `unique: true` is checked by the application only and does not stop two concurrent inserts (`src/club/presence/indexes.ts`).
2. **One store, no second store in a service.** `PresenceStore extends PresenceGroupReads` (a `Pick` of `GroupStore`), so 5-2 to 5-4 services get one store; the fake composes `fakeGroupStore` and its transaction restores both states (`store.ts`, `__tests__/fake-store.ts`).
3. **Read-only joined fields.** `AttendanceRow` carries `sessionDate` and `groupId` read from its session (never written), so month sums, exports and coverage need no second query (`types.ts`).
4. **Duplicate key error.** Both stores throw `UniqueKeyError` on a second `occurrenceKey` or `uniqueKey`; services answer it with 409 "Prezența s-a schimbat între timp. Reîncarcă." (`store.ts`, `strapi-store.ts::asUniqueKeyError`).
5. **Undo refusal by stamps.** Spec 7.3 lists a refusal condition per action ("a slot of it was used since", "edited since"). The record keeps a stamp (a JSON text of the fields that matter) of every guarded row; the undo is refused when any stamp differs now or the row is gone. Later Istoric lines on the same athlete do not refuse a presence undo (`undo.ts`).
6. **Session lines store ids.** Session lines keep athlete and coach ids; names are read when shown, so an anonymized child shows as "Sportiv anonimizat", never the old name (phase 4 decided 2) (`history-lines.ts`).
7. **E-mail line key.** "E-mail "Plată înregistrată" trimis la <adresă>." stores the address under `recipient`, a key the 3C scrub already nulls; with no address the line reads "E-mail "Plată înregistrată" trimis." (`history-lines.ts`).
8. **Weekday abbreviations** for list dates ("Mar 27 oct"): `Dum`, `Lun`, `Mar`, `Mie`, `Joi`, `Vin`, `Sâm` (`dates.ts`).
9. **Club billing word when ticked lines mix "inclus" and missing prices:** `inclus` when at least one line is included and none is priced; `fara_pret` only when every line has no price and none is included; with no price list `charges` is empty (`billing.ts`).
10. **A missing item** gives a charge line with `itemName: ''` and `price: null` (`billing.ts`).
11. **Number form** of the coverage line: "Acoperă 1 prezență fără abonament." (`copy/history.ts`).
12. **Copy files.** Spec 10.1 names five files; plans add `core.ts` (5-1), `lifecycle.ts` (5-4), `prezenta-ui.ts` (5-5) and `money-ui.ts` (5-6), so parallel plans never edit the same lines (index, "Copy module files").

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes`. Commit only in the worktree your dispatch names (never in p3be or p3fe); before every commit run `git rev-parse --show-toplevel` and `git branch --show-current` and compare with the dispatch.
- A dated DECISIONS.md entry wins over the spec; the spec wins over this plan's prose.
- Checks after every task: the task's test file (`npx vitest run <file>`), the full suite (`npx vitest run`), `npx tsc --noEmit` (zero errors); a task touching `src/admin` also `npx tsc --noEmit -p src/admin/tsconfig.json` and `node scripts/admin-ui-check.mjs --strict`.
- Code: TypeScript, no `any`, single quotes, semicolons, 2-space indent, functions under 30 lines, cyclomatic complexity under 10, json attribute data typed with a `type` alias, no dead code, no comments that restate code.
- Data rules (spec 3): dates `YYYY-MM-DD`, times `HH:mm`, amounts in RON as numbers (Postgres `decimal`), every new type `draftAndPublish: false`, hidden from the Content Manager, core router `{ only: [] }`.
- Lock order (spec 7.1, binding): registrations, athletes (sorted by id), sessions / lessons, subscriptions (sorted), payments (sorted); re-read after locking; never lock outside `store.transaction`.
- Every write action is one transaction; failure answers 500 "Acțiunea nu a reușit. Nimic nu a fost salvat." through `guarded` (`src/club/admin-result.ts`); every write records its Istoric lines.
- After a schema change: `DATABASE_CLIENT=postgres npx strapi ts:generate-types` and commit `types/generated/` in the same task. A new attribute is saved only after Strapi restarts.
- Copy: every phase 5 string in `src/club/presence/copy.ts` and its `copy/` files, exactly as the spec gives it; ș and ț with the comma below; straight quotes; the spec's "->" is "→" (`ARROW` of `src/club/text-leaf.ts`); no em or en dash, no middle dot, no emoji; number forms through `countWords` (`src/club/ro-count.ts`).
- Synthetic data only. Never touch production, `strapi_app`, `strapi_db`, `edusport-test-pg`, ports 1337, 1340, 3010, 5432, 55442. Task 12 uses container `es51-pg` on 127.0.0.1:55451 and Strapi on 1371.
- Commits: Conventional Commits, the message given in the task, no `Co-Authored-By`, no AI attribution (check with `git log -1 --format=%B`). Never push. Never commit `.env`.
- Progress board: one line per status change to `/Users/codrin/Documents/Programming/edusport_backend/.superpowers/phase3-shared/progress-board.md`, e.g. `printf '%s | 5-1 T5 | implementer | tests green\n' "$(date -u +%H:%M)" >> <that path>`.

## Review Focus

- **Two admins save the same planned session at the same moment** (no session row yet): exactly one `club_sessions` row with that `occurrenceKey`; the second insert fails on the unique index and becomes `UniqueKeyError` (later 409), never a second session or a 500. Pinned by Task 5 (`createSession refuses a second occurrence key`), Task 6 (`asUniqueKeyError`) and Task 12 (two SQL inserts).
- **A date on the edge of an abonament** (the start day, the last valid day `validUntil`, the day after) and **two abonamente with the same expiry**: the start and last days use a slot, the day after does not; ties go to the earlier start, then the earlier purchase. Pinned by Task 8.
- **Decimal amounts and sums** (`12.5`, `0.1 + 0.2`, a price read from Postgres as the text `"40.00"`): sums never show float noise, "12,50 RON" with a comma, text prices read as numbers. Pinned by Task 4 (`money`) and Task 6 (mappers).
- **An undo after the row changed or vanished** (payment edited, slot used, lesson deleted by merge) and **an undo sent twice**: refused with "Nu se mai poate anula. Datele s-au schimbat între timp.", nothing reverted. Pinned by Task 11.
- **A date between two seasons** (July, after a season's `endMonth`) or before any season: the season is the latest one started before it, else none; nothing throws. Pinned by Task 4 (`seasonOfDate`).

---

## File Structure

```
src/api/session/**, attendance/**, individual-lesson/**, subscription/**, payment/**   schema.json, routes, controllers, services (T1)
src/api/email-job/content-types/email-job/schema.json   kind payment, relation payment (T1)
src/api/site-settings/content-types/site-settings/schema.json   attendanceStartDate (T1)
src/components/club/price-item.json                     kind uscat (T2)
src/club/price-item.ts, src/club/public-info.ts, src/admin/pages/preturi/format.ts   uscat (T2)
src/club/presence/
  indexes.ts         PRESENCE_INDEXES, ensurePresenceIndexes (T3)
  types.ts           row and write types (T4)
  dates.ts           seasonOfDate, month helpers, listDate, longDate (T4)
  money.ts           toMoney, sumMoney, ron (T4)
  copy.ts            re-exports copy/*.ts (T4; one line per later plan)
  copy/core.ts       PRESENCE_ERRORS, PRESENCE_WORDS, state words, method and purpose words, remainingText, noPriceListNotice (T4)
  store.ts           PresenceGroupReads, PresenceStore, where types, UniqueKeyError (T5)
  strapi-store.ts    strapiPresenceStore, mappers, asUniqueKeyError (T6)
  context.ts         PresenceContext, presenceContext (T6)
  sessions.ts        keys, heldOccurrences, sessionState, isOutsideSchedule, durationOf (T7)
  subscriptions.ts   usedSlots, subscriptionState, isValidForList, slotCandidates, pickSubscription, remainingOf, abonamentStatusText (T8)
  billing.ts         audienceFor, clubCharges, lessonPrice, groupsWithoutPriceList (T9)
  copy/history.ts    PRESENCE_LINES, PAYMENT_FIELD_LABELS, LESSON_FIELD_LABELS (T10)
  history-lines.ts   SESSION_SUBJECT .. PAYMENT_SUBJECT, P5_ACTIONS, phase5Lines, sessionHistoryTexts (T10)
  undo.ts            PresenceUndoStep, PresenceGuard, PresenceUndoRecord, stamps, readPresenceRecord, presenceLockTargets (T11)
  action-log.ts      recordPresenceAction, recordPresenceLines (T11)
  undo-service.ts    undoKindOf, undoPresenceAction (T11)
  __tests__/fake-store.ts   fakePresenceStore, fakePresenceContext, seeds and builders (T5)
  __tests__/*.test.ts       one file per task
src/club/history-text.ts, src/club/subjects.ts   phase 5 fallback, subjects (T10)
src/api/club/controllers/groups.ts               undo dispatch (T11)
src/index.ts                                     bootstrap calls ensurePresenceIndexes (T3)
scripts/fixtures/phase5-shape.js                 prices, Gold list and group, start date on a throwaway database (T12)
```

---

### Task 1: Schemas of the five types, e-mail job, setting (high)

**Files:**
- Create: `src/api/{session,attendance,individual-lesson,subscription,payment}/content-types/<name>/schema.json`, and for each `routes/<name>.ts`, `controllers/<name>.ts`, `services/<name>.ts` (factory one-liners)
- Modify: `src/api/email-job/content-types/email-job/schema.json`, `src/api/site-settings/content-types/site-settings/schema.json`, `src/email/__tests__/email-job-schema.test.ts`
- Test: `src/club/presence/__tests__/schemas.test.ts`
- Regenerate: `types/generated/`

**Interfaces:**
- Consumes: nothing.
- Produces: the attributes of the index table "Content types", exactly. Relations: `manyToOne` unless named; `coaches` `manyToMany` to `api::team-member.team-member` (no inverse); `validIn` `manyToMany` to `api::price-list.price-list` (no inverse); `event` to `api::calendar-event.calendar-event`; `lesson` to `api::individual-lesson.individual-lesson`; `emailJob` to `api::email-job.email-job`; email-job `payment` to `api::payment.payment`.

- [ ] **Step 1: Write the failing test** `src/club/presence/__tests__/schemas.test.ts` (reads the json files as the phase 4 `schemas.test.ts` does):

```ts
const NEW = ['session', 'attendance', 'individual-lesson', 'subscription', 'payment'];
it('every phase 5 type is private, hidden, without draft (3)', () => {
  for (const n of NEW) {
    const s = json(`api/${n}/content-types/${n}/schema.json`);
    expect(s.options).toEqual({ draftAndPublish: false });
    expect(s.pluginOptions).toEqual({ 'content-manager': { visible: false } });
    expect(source(`api/${n}/routes/${n}.ts`), n).toContain('{ only: [] }');
  }
});
it('tables are named as spec 3', () => {
  expect(NEW.map((n) => json(`api/${n}/content-types/${n}/schema.json`).collectionName))
    .toEqual(['club_sessions', 'club_attendances', 'club_individual_lessons', 'club_subscriptions', 'club_payments']);
});
it('session keys and enums (3.1)', () => {
  const a = json('api/session/content-types/session/schema.json').attributes;
  expect(a.occurrenceKey).toEqual({ type: 'string', unique: true });
  expect(a.source).toEqual({ type: 'enumeration', enum: ['schedule', 'added'], required: true });
  expect(a.durationMin).toEqual({ type: 'integer', required: true, min: 5, max: 600 });
  expect(a.coaches).toEqual({ type: 'relation', relation: 'manyToMany', target: 'api::team-member.team-member' });
  expect(a.outsideSchedule).toEqual({ type: 'boolean', default: false });
});
it('attendance billing, charges, audience (3.2)', () => {
  const a = json('api/attendance/content-types/attendance/schema.json').attributes;
  expect(a.uniqueKey).toEqual({ type: 'string', unique: true });
  expect(a.billing).toEqual({ type: 'enumeration', enum: ['slot', 'fara_abonament', 'club', 'inclus', 'fara_pret'], required: true });
  expect(a.charges).toEqual({ type: 'json' });
  expect(a.amount).toEqual({ type: 'decimal', default: 0 });
  expect(a.audience).toEqual({ type: 'enumeration', enum: ['member', 'nonMember'] });
});
it('lesson state and duration (3.3)', () => {
  const a = json('api/individual-lesson/content-types/individual-lesson/schema.json').attributes;
  expect(a.state).toEqual({ type: 'enumeration', enum: ['planned', 'saved'], required: true, default: 'planned' });
  expect(a.durationMin).toEqual({ type: 'integer', required: true, default: 50, min: 5, max: 600 });
  expect(a.present).toEqual({ type: 'boolean' });
});
it('subscription frozen fields and validIn (3.4)', () => {
  const a = json('api/subscription/content-types/subscription/schema.json').attributes;
  expect(a.validIn).toEqual({ type: 'relation', relation: 'manyToMany', target: 'api::price-list.price-list' });
  expect(a.slots).toEqual({ type: 'integer', required: true, min: 1 });
  expect(a.extendedWeeks).toEqual({ type: 'integer', default: 0, min: 0 });
  expect(a.cancelled).toEqual({ type: 'boolean', default: false });
});
it('payment purpose, method, acsBefore (3.5)', () => {
  const a = json('api/payment/content-types/payment/schema.json').attributes;
  expect(a.method).toEqual({ type: 'enumeration', enum: ['numerar', 'card', 'transfer'], required: true });
  expect(a.purpose).toEqual({ type: 'enumeration', enum: ['abonament', 'cotizatie', 'club_luna', 'lectie', 'altceva'], required: true });
  expect(a.acsBefore).toEqual({ type: 'enumeration', enum: ['da', 'nu', 'in_asteptare'] });
  expect(a.clubMonth).toEqual({ type: 'string', regex: '^\\d{4}-\\d{2}$' });
  expect(a.collectedAtRink).toEqual({ type: 'boolean', default: false });
});
it('e-mail jobs know payments; settings know the start date (3.7, 3.8)', () => {
  const j = json('api/email-job/content-types/email-job/schema.json').attributes;
  expect(j.kind.enum).toEqual(['registration', 'schedule-change', 'payment']);
  expect(j.payment).toEqual({ type: 'relation', relation: 'manyToOne', target: 'api::payment.payment' });
  expect(json('api/site-settings/content-types/site-settings/schema.json').attributes.attendanceStartDate).toEqual({ type: 'date' });
});
```

Also: the remaining attributes of each type (spec 3.1 to 3.5) as `{ type }` with `required: true` where the spec says required; `amount` of payment `{ type: 'decimal', required: true, min: 0.01 }`. In `email-job-schema.test.ts` append `'payment'` to the keys list.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/club/presence/__tests__/schemas.test.ts src/email/__tests__/email-job-schema.test.ts`
Expected: FAIL (files missing).

- [ ] **Step 3: Write the schemas, routers, controllers, services**

`info.displayName`: "Club / Ședință", "Club / Prezență", "Club / Lecție individuală", "Club / Abonament", "Club / Plată". Routers: `factories.createCoreRouter(uid, { only: [] })`; controllers and services: `factories.createCoreController(uid)` / `createCoreService(uid)`.

- [ ] **Step 4: Regenerate types and run the checks**

Run: `DATABASE_CLIENT=postgres npx strapi ts:generate-types && npx vitest run && npx tsc --noEmit`
Expected: PASS; `types/generated/contentTypes.d.ts` contains `ApiSessionSession` and `attendanceStartDate`.

- [ ] **Step 5: Commit**

```bash
git add src/api/session src/api/attendance src/api/individual-lesson src/api/subscription src/api/payment src/api/email-job src/api/site-settings src/email/__tests__/email-job-schema.test.ts src/club/presence/__tests__/schemas.test.ts types/generated
git commit -m "feat(presence): sessions, attendance, lessons, subscriptions, payments schemas"
```

---

### Task 2: Price item kind "uscat" (low)

**Files:**
- Modify: `src/components/club/price-item.json`, `src/club/price-item.ts`, `src/club/public-info.ts`, `src/admin/pages/preturi/format.ts`
- Test: `src/club/presence/__tests__/uscat-kind.test.ts`
- Regenerate: `types/generated/`

**Interfaces:**
- Produces: `PRICE_ITEM_KINDS = ['subscription', 'session', 'individual', 'uscat']`; `KIND_LABELS.uscat = 'Uscat'` (C10); `toPublicItem` returns null for `kind: 'uscat'` (C11).

- [ ] **Step 1: Write the failing test**

```ts
it('uscat is a price item kind (3.6)', () => {
  expect(PRICE_ITEM_KINDS).toEqual(['subscription', 'session', 'individual', 'uscat']);
  expect(json('components/club/price-item.json').attributes.kind.enum).toEqual(['subscription', 'session', 'individual', 'uscat']);
});
it('Prețuri labels it "Uscat" (C10)', () => {
  expect(KIND_LABELS.uscat).toBe('Uscat');
});
it('public price reads leave uscat out (C11)', () => {
  expect(toPublicItem({ name: 'Uscat', kind: 'uscat', memberPrice: 20, nonMemberPrice: 25 })).toBeNull();
  expect(toPublicItem({ name: 'Ședință grup', kind: 'session', memberPrice: 40, nonMemberPrice: 50 })?.kind).toBe('session');
});
```

`KIND_LABELS` is imported from `../../../admin/pages/preturi/format` (it only imports a type and constants; if Vitest cannot load it, read the file as text and assert `uscat: 'Uscat'`).

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/club/presence/__tests__/uscat-kind.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the four edits; `toPublicItem` refuses `raw.kind === 'uscat'` next to the `isPriceItemKind` check.
- [ ] **Step 4: Run** `DATABASE_CLIENT=postgres npx strapi ts:generate-types && npx vitest run && npx tsc --noEmit && npx tsc --noEmit -p src/admin/tsconfig.json && node scripts/admin-ui-check.mjs --strict`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/components/club/price-item.json src/club/price-item.ts src/club/public-info.ts src/admin/pages/preturi/format.ts src/club/presence/__tests__/uscat-kind.test.ts types/generated
git commit -m "feat(prices): price item kind uscat, left out of public reads"
```

---

### Task 3: Indexes, run from bootstrap (high)

**Files:**
- Create: `src/club/presence/indexes.ts`
- Modify: `src/index.ts` (bootstrap)
- Test: `src/club/presence/__tests__/indexes.test.ts`

**Interfaces:**
- Consumes: the tables of Task 1.
- Produces: `PRESENCE_INDEXES: readonly { name: string; table: string; column: string; unique: boolean }[]` and `ensurePresenceIndexes(knex: Knex): Promise<void>`.

- [ ] **Step 1: Write the failing test**

```ts
it('names every index of 3.10 and the two unique keys (decided 1)', () => {
  expect(PRESENCE_INDEXES).toEqual([
    { name: 'club_sessions_occurrence_key_uq', table: 'club_sessions', column: 'occurrence_key', unique: true },
    { name: 'club_attendances_unique_key_uq', table: 'club_attendances', column: 'unique_key', unique: true },
    { name: 'club_sessions_date_idx', table: 'club_sessions', column: 'date', unique: false },
    { name: 'club_individual_lessons_date_idx', table: 'club_individual_lessons', column: 'date', unique: false },
    { name: 'club_payments_paid_on_idx', table: 'club_payments', column: 'paid_on', unique: false },
    { name: 'club_subscriptions_valid_until_idx', table: 'club_subscriptions', column: 'valid_until', unique: false },
  ]);
});
it('creates each index if missing, skipping a table that does not exist yet', async () => {
  const sql: string[] = [];
  const knex = Object.assign((t: string) => t, {
    schema: { hasTable: async (t: string) => t !== 'club_payments' },
    raw: async (q: string) => { sql.push(q); },
  }) as unknown as Knex;
  await ensurePresenceIndexes(knex);
  expect(sql).toContain('create unique index if not exists "club_sessions_occurrence_key_uq" on "club_sessions" ("occurrence_key")');
  expect(sql).toContain('create index if not exists "club_sessions_date_idx" on "club_sessions" ("date")');
  expect(sql.some((q) => q.includes('club_payments'))).toBe(false);
});
it('bootstrap runs it', () => {
  expect(readFileSync(join(SRC, 'index.ts'), 'utf8')).toMatch(/ensurePresenceIndexes\(strapi\.db\.connection\)/);
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/club/presence/__tests__/indexes.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** `ensurePresenceIndexes`: for each entry, `hasTable` then `knex.raw` with the exact text above. In `src/index.ts` `bootstrap`, `await ensurePresenceIndexes(strapi.db.connection)`; a failure is logged with `strapi.log.error('[presence] indexes: <code>')` and does not stop the boot.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/indexes.ts src/index.ts src/club/presence/__tests__/indexes.test.ts
git commit -m "feat(presence): unique and date indexes created at bootstrap"
```

---

### Task 4: Types, dates, money, copy core (low)

**Files:**
- Create: `src/club/presence/types.ts`, `dates.ts`, `money.ts`, `copy.ts`, `copy/core.ts`
- Test: `src/club/presence/__tests__/foundation.test.ts`, `src/club/presence/__tests__/copy.test.ts`

**Interfaces:**
- Consumes: `SeasonRecord`, `PriceListRow` (`src/club/groups/types.ts`), `MONTHS_LONG`, `MONTHS_SHORT`, `shortDate`, `capitalized`, `isIsoDate` (`src/club/groups/dates.ts`), `Audience`, `PriceItemKind` (`src/club/price-item.ts`), `AcsState` (`src/club/acs.ts`), `countWords`.
- Produces (`types.ts`):

```ts
export type PresenceType = 'grup' | 'uscat';
export type Billing = 'slot' | 'fara_abonament' | 'club' | 'inclus' | 'fara_pret';
export type Charge = { type: PresenceType; itemName: string; price: number | null; included: boolean };
export type SessionSource = 'schedule' | 'added';
export type SessionWrite = {
  groupId: string; seasonId: string; date: string; startTime: string; durationMin: number; source: SessionSource; eventId: string | null;
  occurrenceKey: string | null; outsideSchedule: boolean; coachIds: string[]; savedBy: string; savedAt: string; firstSavedAt: string;
};
export type SessionRow = SessionWrite & { id: string };
export type AttendanceWrite = {
  sessionId: string; athleteId: string; uniqueKey: string; grup: boolean; uscat: boolean; visitor: boolean; subscriptionId: string | null;
  billing: Billing; charges: Charge[]; amount: number; audience: Audience | null;
};
export type AttendanceRow = AttendanceWrite & { id: string; sessionDate: string; groupId: string };   // read-only joins (decided 3)
export type LessonState = 'planned' | 'saved';
export type LessonWrite = {
  athleteId: string; date: string; startTime: string; durationMin: number; coachIds: string[]; state: LessonState; present: boolean | null;
  priceListId: string | null; itemName: string | null; price: number | null; audience: Audience | null; amount: number;
  createdByName: string; savedBy: string | null; savedAt: string | null;
};
export type LessonRow = LessonWrite & { id: string };
export type SubscriptionWrite = {
  athleteId: string; seasonId: string; priceListId: string; validIn: string[]; itemName: string; price: number | null; audience: Audience; slots: number;
  startsOn: string; validUntil: string; extendedWeeks: number; cancelled: boolean; cancelledAt: string | null; cancelledBy: string | null;
  purchasedAt: string; recordedBy: string;
};
export type SubscriptionRow = SubscriptionWrite & { id: string };
export type SubscriptionState = 'activ' | 'epuizat' | 'expirat' | 'anulat';
export type PaymentMethod = 'numerar' | 'card' | 'transfer';
export type PaymentPurpose = 'abonament' | 'cotizatie' | 'club_luna' | 'lectie' | 'altceva';
export type PaymentWrite = {
  athleteId: string; amount: number; method: PaymentMethod; paidOn: string; purpose: PaymentPurpose; subscriptionId: string | null; lessonId: string | null;
  clubMonth: string | null; seasonId: string; collectedAtRink: boolean; note: string | null; sendEmail: boolean; emailJobId: string | null;
  acsBefore: AcsState | null; recordedBy: string; recordedAt: string; cancelled: boolean; cancelledAt: string | null; cancelledBy: string | null;
};
export type PaymentRow = PaymentWrite & { id: string };
export type PriceItemRow = { name: string; kind: PriceItemKind; sessions: number | null; memberPrice: number | null; nonMemberPrice: number | null; included: boolean };
export type PriceListRecord = PriceListRow & { items: PriceItemRow[] };
export type PaymentEmailPayload = { athleteName: string; amount: number; method: PaymentMethod; paidOn: string; purposeText: string };
export type PaymentEmailJob = { recipient: string; subject: string; paymentId: string; notBefore: string; payload: PaymentEmailPayload };
export type SessionState = 'salvata' | 'urmeaza' | 'nefacuta';
export type HeldOccurrence = { key: string; eventId: string; groupId: string; date: string; startTime: string; endTime: string | null; durationMin: number };
```

- `dates.ts`: `seasonOfDate(seasons: SeasonRecord[], date: string): SeasonRecord | null`; `monthOf(date: string): string`; `isMonth(v: unknown): v is string`; `monthRange(month: string): { from: string; to: string }`; `addMonths(month: string, n: number): string`; `monthTitle(month: string): string`; `monthName(month: string): string`; `listDate(date: string): string`; `longDate(date: string): string` (= `shortDate`).
- `money.ts`: `toMoney(v: unknown): number | null`; `sumMoney(values: readonly number[]): number` (sums in whole bani, `Math.round(x * 100)`); `ron(n: number): string`.
- `copy/core.ts`:
  - `PRESENCE_ERRORS = { notFound: 'Nu a fost găsit.', invalid: 'Cerere invalidă.', stale: 'Datele s-au schimbat. Reîncarcă pagina.', failed: 'Acțiunea nu a reușit. Nimic nu a fost salvat.', conflict: 'Prezența s-a schimbat între timp. Reîncarcă.', undoChanged: 'Nu se mai poate anula. Datele s-au schimbat între timp.', loadFailed: 'Nu am putut încărca datele.' }` (literal strings: this file imports nothing from `athletes/`, so the history modules stay free of cycles).
  - `PRESENCE_WORDS = { noSubscription: 'Fără abonament', included: 'inclus', cancelledPayment: 'anulată', outsideSchedule: 'În afara programului', noPrice: 'fără preț' }`.
  - `SESSION_STATE_WORDS: Record<SessionState, string> = { salvata: 'salvată', urmeaza: 'urmează', nefacuta: 'nefăcută' }`; `SUBSCRIPTION_STATE_WORDS: Record<SubscriptionState, string>` = the four words themselves.
  - `METHOD_WORDS: Record<PaymentMethod, string> = { numerar: 'Numerar', card: 'Card (POS)', transfer: 'Transfer bancar' }`; `PURPOSE_WORDS: Record<PaymentPurpose, string> = { abonament: 'Abonament', cotizatie: 'Cotizație membru', club_luna: 'Club', lectie: 'Lecție individuală', altceva: 'Altceva' }` (C60).
  - `remainingText(n: number): string` ("<n> ședințe rămase", "1 ședință rămasă"); `noPriceListNotice(n: number): string`.
- `copy.ts`: `export * from './copy/core';` (Task 10 adds `./copy/history`; later plans one line each).

- [ ] **Step 1: Write the failing tests**

`foundation.test.ts` (uses `G_SEASONS` of the phase 4 fake):

```ts
it('season of a date: containing season, else the latest started before, else none (3.9, C15)', () => {
  expect(seasonOfDate(G_SEASONS, '2026-11-05')?.id).toBe('s26');
  expect(seasonOfDate(G_SEASONS, '2026-05-31')?.id).toBe('s25');
  expect(seasonOfDate(G_SEASONS, '2026-07-15')?.id).toBe('s25');
  expect(seasonOfDate(G_SEASONS, '2024-01-01')).toBeNull();
});
it('months', () => {
  expect(monthOf('2026-10-27')).toBe('2026-10');
  expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  expect(addMonths('2026-12', 1)).toBe('2027-01');
  expect(addMonths('2026-01', -1)).toBe('2025-12');
  expect([isMonth('2026-10'), isMonth('2026-13'), isMonth('2026-1'), isMonth(null)]).toEqual([true, false, false, false]);
  expect(monthTitle('2026-10')).toBe('Octombrie 2026');
  expect(monthName('2026-09')).toBe('septembrie');
});
it('list and long dates (5)', () => {
  expect(listDate('2026-10-27')).toBe('Mar 27 oct');
  expect(listDate('2026-10-25')).toBe('Dum 25 oct');
  expect(longDate('2026-11-23')).toBe('23 nov 2026');
});
it('money: RON with a decimal comma, no float noise, text read as number (5, C39)', () => {
  expect([ron(320), ron(12.5), ron(-20), ron(0), ron(40.05)]).toEqual(['320 RON', '12,50 RON', '-20 RON', '0 RON', '40,05 RON']);
  expect(sumMoney([0.1, 0.2])).toBe(0.3);
  expect(sumMoney([])).toBe(0);
  expect([toMoney('40.00'), toMoney(12.5), toMoney(null), toMoney('x'), toMoney('')]).toEqual([40, 12.5, null, null, null]);
});
it('remaining slots and the no-price-list notice, with number forms (4.10, 4.12)', () => {
  expect([remainingText(7), remainingText(1), remainingText(20)]).toEqual(['7 ședințe rămase', '1 ședință rămasă', '20 de ședințe rămase']);
  expect(noPriceListNotice(2)).toBe('2 grupe fără listă de prețuri: prezența se înregistrează, nimic nu se calculează.');
  expect(noPriceListNotice(1)).toBe('1 grupă fără listă de prețuri: prezența se înregistrează, nimic nu se calculează.');
});
```

`copy.test.ts`: every `.ts` file in `src/club/presence/copy/` has no `—`, `–`, `·`, `„`, `”`, `“`, and no character in the emoji ranges (`/\p{Extended_Pictographic}/u`); `copy.ts` has one `export * from './copy/<file>';` line per file in `copy/`.

- [ ] **Step 2: Run to verify they fail** — `npx vitest run src/club/presence/__tests__/foundation.test.ts src/club/presence/__tests__/copy.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the five files. `listDate` weekday abbreviations (decided 8): `['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm']`. `ron`: an integer shows no decimals, else two decimals with a comma.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/types.ts src/club/presence/dates.ts src/club/presence/money.ts src/club/presence/copy.ts src/club/presence/copy/core.ts src/club/presence/__tests__/foundation.test.ts src/club/presence/__tests__/copy.test.ts
git commit -m "feat(presence): row types, dates, money and core copy"
```

---

### Task 5: `PresenceStore` and the in-memory store (high)

**Files:**
- Create: `src/club/presence/store.ts`, `src/club/presence/__tests__/fake-store.ts`
- Test: `src/club/presence/__tests__/fake-store.test.ts`

**Interfaces:**
- Consumes: Task 4 types; `GroupStore`, `fakeGroupStore`, `FakeGroupState`, `G_*` seeds, `athleteRow`, `member`; `CalendarWindow` (`src/club/groups/occurrences.ts`); `AcsRow`, `AcsState`; `HistoryInput`.
- Produces (`store.ts`):

```ts
export type PresenceGroupReads = Pick<GroupStore, 'transaction' | 'lockAthlete' | 'lockHistoryEntry' | 'seasons' | 'sections' | 'groups' | 'group'
  | 'teamMembers' | 'athletes' | 'athlete' | 'memberships' | 'history' | 'historyEntry' | 'historyAfter' | 'adminNames' | 'setAthleteStatus'
  | 'recordAction' | 'record' | 'setHistoryChanges'>;
export type Range = { from?: string; to?: string };
export type SessionWhere = Range & { ids?: string[]; groupId?: string };
export type AttendanceWhere = Range & { ids?: string[]; sessionIds?: string[]; athleteId?: string; subscriptionIds?: string[]; billing?: Billing[] }; // from/to on the session date
export type LessonWhere = Range & { ids?: string[]; athleteId?: string };
export type SubscriptionWhere = { ids?: string[]; athleteId?: string };
export type PaymentWhere = Range & { ids?: string[]; athleteId?: string; subscriptionId?: string; lessonId?: string }; // from/to on paidOn
export class UniqueKeyError extends Error {}
export interface PresenceStore extends PresenceGroupReads {
  lockSession(id: string): Promise<void>; lockLesson(id: string): Promise<void>; lockSubscription(id: string): Promise<void>; lockPayment(id: string): Promise<void>;
  priceListRecords(): Promise<PriceListRecord[]>;
  acsRows(where: { athleteId?: string; seasonId?: string }): Promise<AcsRow[]>;
  /** null deletes the row; one row per athlete and season. */
  setAcs(athleteId: string, seasonId: string, state: AcsState | null): Promise<void>;
  calendarWindow(): Promise<CalendarWindow>;
  attendanceStartDate(): Promise<string | null>;
  sessions(where?: SessionWhere): Promise<SessionRow[]>; session(id: string): Promise<SessionRow | null>; sessionByKey(key: string): Promise<SessionRow | null>;
  /** Throws UniqueKeyError on a second occurrenceKey. */
  createSession(data: SessionWrite): Promise<string>; updateSession(id: string, data: Partial<SessionWrite>): Promise<void>;
  attendances(where?: AttendanceWhere): Promise<AttendanceRow[]>;
  /** Throws UniqueKeyError on a second uniqueKey. */
  createAttendance(data: AttendanceWrite): Promise<string>; updateAttendance(id: string, data: Partial<AttendanceWrite>): Promise<void>; deleteAttendance(id: string): Promise<void>;
  lessons(where?: LessonWhere): Promise<LessonRow[]>; lesson(id: string): Promise<LessonRow | null>;
  createLesson(data: LessonWrite): Promise<string>; updateLesson(id: string, data: Partial<LessonWrite>): Promise<void>; deleteLesson(id: string): Promise<void>;
  subscriptions(where?: SubscriptionWhere): Promise<SubscriptionRow[]>; subscription(id: string): Promise<SubscriptionRow | null>;
  createSubscription(data: SubscriptionWrite): Promise<string>; updateSubscription(id: string, data: Partial<SubscriptionWrite>): Promise<void>; deleteSubscription(id: string): Promise<void>;
  payments(where?: PaymentWhere): Promise<PaymentRow[]>; payment(id: string): Promise<PaymentRow | null>;
  createPayment(data: PaymentWrite): Promise<string>; updatePayment(id: string, data: Partial<PaymentWrite>): Promise<void>; deletePayment(id: string): Promise<void>;
  /** Queued, kind `payment`, linked to the payment. */
  createPaymentEmailJob(job: PaymentEmailJob): Promise<string>;
  /** Queued jobs of the payment become `cancelled`; answers how many. */
  cancelPaymentEmailJob(paymentId: string): Promise<number>;
  sentPaymentEmailJobs(paymentId: string): Promise<number>;
}
```

- Produces (`__tests__/fake-store.ts`): `FakePresenceState = { sessions; attendances (AttendanceWrite & { id }); lessons; subscriptions; payments; priceLists: PriceListRecord[]; acs: AcsRow[]; calendar: CalendarWindow; startDate: string | null; jobs: FakePaymentJob[] }`; `FakePaymentJob = PaymentEmailJob & { id: string; status: 'queued' | 'sending' | 'cancelled' | 'sent' }`; `fakePresenceStore(seed?: { group?: Partial<FakeGroupState> } & Partial<FakePresenceState>): { store: PresenceStore; state: FakePresenceState; group: FakeGroupState; failOn(method: keyof PresenceStore): void }`; `fakePresenceContext(seed, today = '2026-11-20'): { ctx: PresenceContext } & that` (`PresenceContext` type from Task 6; this file imports it as a type). Seeds:
  - `P_LISTS: PriceListRecord[]`: `pl-std` "Standard" (afi): "Abonament 8 ședințe" subscription 8, 320 / 360; "Abonament 6 ședințe" subscription 6, 260 / 290. `pl-gold` "Avansați Gold" (afi): "Abonament 8 ședințe Gold" subscription 8, 400 / 440. `pl-club` "Club" (club): "Ședință grup" session 40 / 50; "Uscat" uscat 20 / 25; "Lecție individuală" individual 80 / 100. `pl-club-inclus` "Club inclus" (club): "Ședință grup" session 40 / 50; "Uscat" uscat 20 / 25 `included: true`.
  - `P_GROUPS`: `G_GROUPS` with `g-av.priceListId = 'pl-club'` (`g-pro` keeps none), plus `{ id: 'g-gold', name: 'Avansați Gold', sectionId: 'afi', order: 4, priceListId: 'pl-gold', coachIds: ['tm-virgil'] }`.
  - Builders: `sessionRow(over)`, `attendanceRow(over)`, `lessonRow(over)`, `subscriptionRow(over)` (default pl-std, 8 slots, 320, member, startsOn `2026-10-27`, validUntil `2026-11-23`), `paymentRow(over)` (default 320 numerar `2026-10-27` altceva s26).
  - Rules: every lock (inherited and presence) appends `<kind>:<id>` to the one list `group.locks`, so tests see the whole order; locks outside a transaction throw (`fake: lock on <kind>:<id> outside a transaction`); `transaction` snapshots its own state and the group state and restores both when the work throws; `createSession` / `createAttendance` throw `UniqueKeyError` on a used key; `attendances` fills `sessionDate` and `groupId` from the session; filters as the where types say; lists sorted by id.

- [ ] **Step 1: Write the failing test** `fake-store.test.ts`:

```ts
it('rolls back presence and group state together', async () => {
  const { store, state, group, failOn } = fakePresenceStore({ group: { athletes: [athleteRow({ id: 'a1' })] } });
  failOn('record');
  await expect(store.transaction(async () => {
    await store.createPayment(paymentRow({ athleteId: 'a1' }));
    await store.setAthleteStatus('a1', 'inactiv');
    await store.record({ subjectType: 'payment', subjectId: 'p', action: 'payment-recorded', actor: 'x' });
  })).rejects.toThrow('fake failure in record');
  expect(state.payments).toEqual([]);
  expect(group.athletes[0].status).not.toBe('inactiv');
});
it('createSession refuses a second occurrence key; createAttendance a second unique key', async () => {
  const { store } = fakePresenceStore();
  await store.createSession(sessionRow({ occurrenceKey: 'ev1|2026-11-07|11:00' }));
  await expect(store.createSession(sessionRow({ occurrenceKey: 'ev1|2026-11-07|11:00' }))).rejects.toBeInstanceOf(UniqueKeyError);
  await store.createSession(sessionRow({ occurrenceKey: null }));
  await store.createSession(sessionRow({ occurrenceKey: null }));
  await store.createAttendance(attendanceRow({ uniqueKey: 's1|a1' }));
  await expect(store.createAttendance(attendanceRow({ uniqueKey: 's1|a1' }))).rejects.toBeInstanceOf(UniqueKeyError);
});
it('attendance rows carry their session date and group; filters by session date and subscription', async () => {
  const { store } = fakePresenceStore({ sessions: [sessionRow({ id: 's1', groupId: 'g-ib', date: '2026-11-07' }), sessionRow({ id: 's2', groupId: 'g-ib', date: '2026-12-05' })],
    attendances: [attendanceRow({ id: 't1', sessionId: 's1', subscriptionId: 'sub1' }), attendanceRow({ id: 't2', sessionId: 's2' })] });
  expect((await store.attendances({ from: '2026-11-01', to: '2026-11-30' })).map((a) => [a.id, a.sessionDate, a.groupId])).toEqual([['t1', '2026-11-07', 'g-ib']]);
  expect((await store.attendances({ subscriptionIds: ['sub1'] })).map((a) => a.id)).toEqual(['t1']);
});
it('setAcs creates, updates and deletes the one row of an athlete and season', async () => {
  const { store } = fakePresenceStore();
  await store.setAcs('a1', 's26', 'da');
  await store.setAcs('a1', 's26', 'nu');
  expect((await store.acsRows({ athleteId: 'a1' })).map((r) => r.state)).toEqual(['nu']);
  await store.setAcs('a1', 's26', null);
  expect(await store.acsRows({ athleteId: 'a1' })).toEqual([]);
});
it('cancels only the queued e-mail of one payment and counts sent ones', async () => {
  const { store, state } = fakePresenceStore();
  await store.createPaymentEmailJob(job({ paymentId: 'p1' }));
  await store.createPaymentEmailJob(job({ paymentId: 'p2' }));
  state.jobs[1].status = 'sent';
  expect(await store.cancelPaymentEmailJob('p1')).toBe(1);
  expect(await store.sentPaymentEmailJobs('p2')).toBe(1);
  expect(state.jobs.map((j) => j.status)).toEqual(['cancelled', 'sent']);
});
it('locks only inside a transaction and records their order', async () => {
  const { store, group } = fakePresenceStore();
  await expect(store.lockPayment('p1')).rejects.toThrow('outside a transaction');
  await store.transaction(async () => { await store.lockAthlete('a1'); await store.lockSubscription('sub1'); await store.lockPayment('p1'); });
  expect(group.locks).toEqual(['athlete:a1', 'subscription:sub1', 'payment:p1']);
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/club/presence/__tests__/fake-store.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** `store.ts` and the fake (split into small builders per row kind, as `fake-group-store.ts` does, to keep functions under 30 lines; `withFailures` wrapper as phase 4).
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/store.ts src/club/presence/__tests__/fake-store.ts src/club/presence/__tests__/fake-store.test.ts
git commit -m "feat(presence): PresenceStore interface and in-memory store"
```

---

### Task 6: Strapi presence store and context (high)

**Files:**
- Create: `src/club/presence/strapi-store.ts`, `src/club/presence/context.ts`
- Test: `src/club/presence/__tests__/strapi-store.test.ts`

**Interfaces:**
- Consumes: `PresenceStore` (Task 5), `transactionScope`, `raws`, `str`, `text`, `linkId` (`src/club/athletes/strapi-store.ts`), `strapiGroupStore`, `calendarRows`, `adminActor`, `todayIso`.
- Produces: `strapiPresenceStore(strapi: Core.Strapi): PresenceStore`; mappers `toSessionRow(r: Raw): SessionRow`, `toAttendanceRow(r: Raw): AttendanceRow`, `toLessonRow`, `toSubscriptionRow`, `toPaymentRow`, `toPriceListRecord`; `asUniqueKeyError(err: unknown): UniqueKeyError | null`; `PresenceContext = { store: PresenceStore; actor: string; today: string; now: () => Date; log: (m: string) => void }`; `presenceContext(strapi, ctx: AdminCtx): Promise<PresenceContext>`.
- Implementation decisions: one `transactionScope(strapi)` for the store; locks `scope.lockRow('athletes' | 'club_sessions' | 'club_individual_lessons' | 'club_subscriptions' | 'club_payments' | 'history_entries', id)`; the `PresenceGroupReads` functions other than `transaction`, `lockAthlete`, `lockHistoryEntry` are taken from `strapiGroupStore(strapi)`; reads through `strapi.db.query(uid).findMany({ where, populate })` mapping relations to documentIds; writes through `strapi.documents(uid)` (relations by documentId, `as never` for the data object when `tsc` asks); attendance reads populate `session` with `date` and `group`; `create*` wraps the call and rethrows `asUniqueKeyError(err) ?? err`; `attendanceStartDate` from `site-settings.attendanceStartDate`; `calendarWindow` = `calendarRows(strapi)`; e-mail jobs with `kind: 'payment'`, `subject`, `recipient`, `payload`, `notBefore`, `payment`.

- [ ] **Step 1: Write the failing test**

```ts
it('has exactly the methods of the fake store (11.2)', () => {
  expect(Object.keys(strapiPresenceStore({} as Core.Strapi)).sort()).toEqual(Object.keys(fakePresenceStore().store).sort());
});
it('maps a session with its relations', () => {
  expect(toSessionRow({ documentId: 's1', group: { documentId: 'g-ib' }, season: { documentId: 's26' }, date: '2026-11-07', startTime: '11:00:00.000',
    durationMin: 50, source: 'schedule', event: { documentId: 'ev1' }, occurrenceKey: 'ev1|2026-11-07|11:00', outsideSchedule: null,
    coaches: [{ documentId: 'tm-virgil' }], savedBy: 'Ana', savedAt: '2026-11-07T10:00:00.000Z', firstSavedAt: '2026-11-07T10:00:00.000Z' }))
    .toEqual({ id: 's1', groupId: 'g-ib', seasonId: 's26', date: '2026-11-07', startTime: '11:00', durationMin: 50, source: 'schedule', eventId: 'ev1',
      occurrenceKey: 'ev1|2026-11-07|11:00', outsideSchedule: false, coachIds: ['tm-virgil'], savedBy: 'Ana', savedAt: '2026-11-07T10:00:00.000Z', firstSavedAt: '2026-11-07T10:00:00.000Z' });
});
it('reads decimals given as text and keeps charges', () => {
  const row = toAttendanceRow({ documentId: 't1', session: { documentId: 's1', date: '2026-11-07', group: { documentId: 'g-av' } }, athlete: { documentId: 'a1' },
    uniqueKey: 's1|a1', grup: true, uscat: false, visitor: false, subscription: null, billing: 'club',
    charges: [{ type: 'grup', itemName: 'Ședință grup', price: 40, included: false }], amount: '40.00', audience: 'member' });
  expect([row.amount, row.sessionDate, row.groupId, row.subscriptionId]).toEqual([40, '2026-11-07', 'g-av', null]);
});
it('maps payments, subscriptions (validIn ids), lessons and price lists (items with included)', () => { /* one row each, every field asserted */ });
it('turns a duplicate key into UniqueKeyError (decided 4)', () => {
  expect(asUniqueKeyError({ code: '23505' })).toBeInstanceOf(UniqueKeyError);
  expect(asUniqueKeyError({ cause: { code: '23505' } })).toBeInstanceOf(UniqueKeyError);
  expect(asUniqueKeyError(Object.assign(new Error('This attribute must be unique'), { name: 'ValidationError' }))).toBeInstanceOf(UniqueKeyError);
  expect(asUniqueKeyError(new Error('connection lost'))).toBeNull();
});
it('takes every lock inside one transaction scope', async () => { /* stub strapi.db.transaction and getConnection; assert table names and document_id */ });
```

The "maps ..." test lists each field of `PaymentRow`, `SubscriptionRow`, `LessonRow`, `PriceListRecord` with one raw row each (time strings cut to `HH:mm`, missing booleans `false`, missing relations `null`, empty `validIn` `[]`).

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/club/presence/__tests__/strapi-store.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** `strapi-store.ts` (split into `lookups`, `sessionRows`, `attendanceRows`, `lessonRows`, `subscriptionRows`, `paymentRows`, `jobs` parts spread into the store, as `strapiGroupStore` does) and `context.ts`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/strapi-store.ts src/club/presence/context.ts src/club/presence/__tests__/strapi-store.test.ts
git commit -m "feat(presence): Strapi presence store and service context"
```

---

### Task 7: Session keys, held occurrences, states (low)

**Files:**
- Create: `src/club/presence/sessions.ts`
- Test: `src/club/presence/__tests__/sessions.test.ts`

**Interfaces:**
- Consumes: `expandOccurrences`, `CalendarEventRow`, `Occurrence` (`src/api/calendar-event/services/expand.ts`), `CalendarWindow`, `GroupRecord`, `minutesBetween`, `HeldOccurrence`, `SessionState`.
- Produces:
  - `occurrenceKey(eventId: string, date: string, startTime: string): string` = `"<eventId>|<date>|<startTime>"` (3.1, C72).
  - `readOccurrenceKey(key: unknown): { eventId: string; date: string; startTime: string } | null` (valid only with an ISO date and `HH:mm`).
  - `attendanceKey(sessionId: string, athleteId: string): string` = `"<sessionId>|<athleteId>"`.
  - `durationOf(o: Pick<Occurrence, 'startTime' | 'endTime' | 'endsNextDay'>): number` (minutes; 50 without an end time; +1440 when `endsNextDay`).
  - `heldOccurrences(window: CalendarWindow, groups: GroupRecord[], from: string, to: string): HeldOccurrence[]`: expanded occurrences with status `scheduled` or `override`, of an event with a `documentId` linked to an active group, with a start time; keyed by the date and time they take place; sorted by date, start time, group id.
  - `sessionState(i: { saved: boolean; date: string; today: string; startDate: string | null }): SessionState | null`: `salvata` when saved; `urmeaza` when `date >= today`; `nefacuta` when `startDate` is set and `startDate <= date < today`; else null (not listed).
  - `isOutsideSchedule(s: { groupId: string; date: string; startTime: string }, held: HeldOccurrence[]): boolean`.

- [ ] **Step 1: Write the failing test** (one weekly event `ev-ib` of `g-ib`, Saturday and Sunday 11:00 to 11:50 from 2026-10-04; exceptions: `2026-11-07` cancel, `2026-11-08` override to `newDate 2026-11-10`, `newStartTime 17:00`, `newEndTime 17:50`; one event of the inactive group `g-old`; one event without group):

```ts
it('keys a session by the date and time the class takes place (C72)', () => {
  expect(occurrenceKey('ev-ib', '2026-11-10', '17:00')).toBe('ev-ib|2026-11-10|17:00');
  expect(readOccurrenceKey('ev-ib|2026-11-10|17:00')).toEqual({ eventId: 'ev-ib', date: '2026-11-10', startTime: '17:00' });
  expect([readOccurrenceKey('ev|2026-02-30|17:00'), readOccurrenceKey('ev|2026-11-10'), readOccurrenceKey(3)]).toEqual([null, null, null]);
  expect(attendanceKey('s1', 'a1')).toBe('s1|a1');
});
it('lists held occurrences of active groups only; a cancelled date is left out; a moved one is on its new date (3.9, 4.4, C14)', () => {
  expect(heldOccurrences(window, P_GROUPS_WITH_OLD, '2026-11-07', '2026-11-15').map((o) => o.key))
    .toEqual(['ev-ib|2026-11-10|17:00', 'ev-ib|2026-11-14|11:00', 'ev-ib|2026-11-15|11:00']);
  expect(heldOccurrences(window, P_GROUPS_WITH_OLD, '2026-11-14', '2026-11-14')[0]).toMatchObject({ groupId: 'g-ib', eventId: 'ev-ib', durationMin: 50, endTime: '11:50' });
});
it('state words: saved, coming, undone only from the start date (3.9, C13)', () => {
  const s = (saved: boolean, date: string, startDate: string | null) => sessionState({ saved, date, today: '2026-11-20', startDate });
  expect(s(true, '2026-11-01', null)).toBe('salvata');
  expect(s(false, '2026-11-20', '2026-11-01')).toBe('urmeaza');
  expect(s(false, '2026-11-19', '2026-11-01')).toBe('nefacuta');
  expect(s(false, '2026-10-31', '2026-11-01')).toBeNull();
  expect(s(false, '2026-11-19', null)).toBeNull();
});
it('a saved session whose date was cancelled or moved is outside the schedule (4.4, C19)', () => {
  const held = heldOccurrences(window, P_GROUPS_WITH_OLD, '2026-11-07', '2026-11-15');
  expect(isOutsideSchedule({ groupId: 'g-ib', date: '2026-11-07', startTime: '11:00' }, held)).toBe(true);
  expect(isOutsideSchedule({ groupId: 'g-ib', date: '2026-11-14', startTime: '11:00' }, held)).toBe(false);
});
it('duration from the occurrence, 50 without an end time', () => {
  expect(durationOf({ startTime: '17:00', endTime: '18:30', endsNextDay: false })).toBe(90);
  expect(durationOf({ startTime: '17:00', endTime: null, endsNextDay: false })).toBe(50);
  expect(durationOf({ startTime: '23:30', endTime: '00:20', endsNextDay: true })).toBe(50);
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/club/presence/__tests__/sessions.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** `sessions.ts`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/sessions.ts src/club/presence/__tests__/sessions.test.ts
git commit -m "feat(presence): session keys, held occurrences and state words"
```

---

### Task 8: Abonament state and slot choice (high)

**Files:**
- Create: `src/club/presence/subscriptions.ts`
- Test: `src/club/presence/__tests__/subscriptions.test.ts`

**Interfaces:**
- Consumes: `SubscriptionRow`, `AttendanceRow`, `SubscriptionState`, `remainingText`, `PRESENCE_WORDS`.
- Produces:
  - `usedSlots(rows: readonly Pick<AttendanceRow, 'subscriptionId'>[]): Map<string, number>` (C7).
  - `subscriptionState(sub: SubscriptionRow, used: number, today: string): SubscriptionState`: `anulat` if cancelled, else `epuizat` if used >= slots, else `expirat` if today > validUntil, else `activ` (3.4).
  - `isValidForList(sub: SubscriptionRow, priceListId: string): boolean` (`priceListId` or one of `validIn`).
  - `slotCandidates(subs: SubscriptionRow[], used: Map<string, number>, priceListId: string, date: string): SubscriptionRow[]`: not cancelled, valid for the list, `startsOn <= date <= validUntil`, used < slots; sorted by `validUntil`, then `startsOn`, then `purchasedAt` (4.10, C24).
  - `pickSubscription(...same): SubscriptionRow | null` = the first candidate.
  - `remainingOf(sub: SubscriptionRow, used: Map<string, number>): number`.
  - `abonamentStatusText(remaining: number | null): string` = `remainingText(n)` or "Fără abonament".

- [ ] **Step 1: Write the failing test** (subs built with `subscriptionRow`):

```ts
const a = subscriptionRow({ id: 'a', startsOn: '2026-10-27', validUntil: '2026-11-23', purchasedAt: '2026-10-27T09:00:00.000Z' });
const b = subscriptionRow({ id: 'b', startsOn: '2026-11-01', validUntil: '2026-11-28', purchasedAt: '2026-11-01T09:00:00.000Z' });
const gold = subscriptionRow({ id: 'g', priceListId: 'pl-gold', price: 400, startsOn: '2026-11-02', validUntil: '2026-11-29' });
const carried = subscriptionRow({ id: 'c', validIn: ['pl-gold'], startsOn: '2026-10-20', validUntil: '2026-11-16' });
const none = new Map<string, number>();

it('uses the abonament expiring first, then the earlier start, then the earlier purchase (4.10, C24)', () => {
  expect(pickSubscription([b, a], none, 'pl-std', '2026-11-05')?.id).toBe('a');
  expect(pickSubscription([b, a], new Map([['a', 8]]), 'pl-std', '2026-11-05')?.id).toBe('b');
  const twin = subscriptionRow({ id: 'a2', startsOn: '2026-10-27', validUntil: '2026-11-23', purchasedAt: '2026-10-27T08:00:00.000Z' });
  expect(pickSubscription([a, twin], none, 'pl-std', '2026-11-05')?.id).toBe('a2');
});
it('the start day and the last valid day use a slot, the day after does not (4.8)', () => {
  expect(pickSubscription([a], none, 'pl-std', '2026-10-27')?.id).toBe('a');
  expect(pickSubscription([a], none, 'pl-std', '2026-11-23')?.id).toBe('a');
  expect(pickSubscription([a], none, 'pl-std', '2026-11-24')).toBeNull();
  expect(pickSubscription([a], none, 'pl-std', '2026-10-26')).toBeNull();
});
it('a cancelled abonament is never used; a carried Standard works in Gold, Gold never in Standard (4.11, p5 Q10)', () => {
  expect(pickSubscription([{ ...a, cancelled: true }], none, 'pl-std', '2026-11-05')).toBeNull();
  expect(pickSubscription([gold, carried], none, 'pl-gold', '2026-11-05')?.id).toBe('c');
  expect(pickSubscription([gold], none, 'pl-std', '2026-11-05')).toBeNull();
});
it('states (3.4)', () => {
  expect(subscriptionState(a, 3, '2026-11-23')).toBe('activ');
  expect(subscriptionState(a, 3, '2026-11-24')).toBe('expirat');
  expect(subscriptionState(a, 8, '2026-11-24')).toBe('epuizat');
  expect(subscriptionState({ ...a, cancelled: true }, 8, '2026-11-01')).toBe('anulat');
});
it('used slots are counted from attendance rows (C7)', () => {
  expect([...usedSlots([{ subscriptionId: 'a' }, { subscriptionId: 'a' }, { subscriptionId: null }])]).toEqual([['a', 2]]);
  expect(remainingOf(a, new Map([['a', 3]]))).toBe(5);
});
it('status under a name (4.10)', () => {
  expect([abonamentStatusText(7), abonamentStatusText(1), abonamentStatusText(null)]).toEqual(['7 ședințe rămase', '1 ședință rămasă', 'Fără abonament']);
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/club/presence/__tests__/subscriptions.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** `subscriptions.ts`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/subscriptions.ts src/club/presence/__tests__/subscriptions.test.ts
git commit -m "feat(presence): abonament state and slot choice"
```

---

### Task 9: Club prices, audience, lesson price (high)

**Files:**
- Create: `src/club/presence/billing.ts`
- Test: `src/club/presence/__tests__/billing.test.ts`

**Interfaces:**
- Consumes: `PriceListRecord`, `Charge`, `Billing`, `Audience`, `priceFor`, `usesMemberPrice`, `AcsRow`, `GroupRecord`, `sumMoney`.
- Produces:
  - `audienceFor(acs: readonly AcsRow[], athleteId: string, seasonId: string | null): Audience` (4.13).
  - `clubCharges(list: PriceListRecord | null, ticks: { grup: boolean; uscat: boolean }, audience: Audience): { charges: Charge[]; billing: Extract<Billing, 'club' | 'inclus' | 'fara_pret'>; amount: number }`: "Grup" prices the list's first `session` item, "Uscat" its first `uscat` item (C27); both ticked, both lines (C28); a line's `price` is `priceFor(item, audience)` (kept on an included line too), `included` the item's flag; a missing item gives `{ itemName: '', price: null, included: false }` (decided 10); `amount` = sum of prices of lines not included and not null; billing per decided 9; no list: `{ charges: [], billing: 'fara_pret', amount: 0 }`.
  - `lessonPrice(list: PriceListRecord | null, audience: Audience): { itemName: string | null; price: number | null }` (first `individual` item, 5.5).
  - `groupsWithoutPriceList(groups: readonly GroupRecord[]): number` (active groups with no list, 4.12 notice).

- [ ] **Step 1: Write the failing test** (lists from `P_LISTS`):

```ts
const club = list('pl-club'); const inclus = list('pl-club-inclus');
it('Grup and Uscat at member and non-member prices, both charged (4.12, C27, C28)', () => {
  expect(clubCharges(club, { grup: true, uscat: true }, 'member')).toEqual({ billing: 'club', amount: 60, charges: [
    { type: 'grup', itemName: 'Ședință grup', price: 40, included: false }, { type: 'uscat', itemName: 'Uscat', price: 20, included: false }] });
  expect(clubCharges(club, { grup: true, uscat: false }, 'nonMember')).toMatchObject({ billing: 'club', amount: 50 });
});
it('an included item is recorded and never billed (p5 Q17)', () => {
  expect(clubCharges(inclus, { grup: true, uscat: true }, 'member')).toMatchObject({ billing: 'club', amount: 40 });
  expect(clubCharges(inclus, { grup: false, uscat: true }, 'member')).toEqual({ billing: 'inclus', amount: 0,
    charges: [{ type: 'uscat', itemName: 'Uscat', price: 20, included: true }] });
});
it('no list, missing item, missing audience price (4.12, p5 Q15)', () => {
  expect(clubCharges(null, { grup: true, uscat: false }, 'member')).toEqual({ charges: [], billing: 'fara_pret', amount: 0 });
  const noUscat = { ...club, items: club.items.filter((i) => i.kind !== 'uscat') };
  expect(clubCharges(noUscat, { grup: false, uscat: true }, 'member')).toEqual({ billing: 'fara_pret', amount: 0,
    charges: [{ type: 'uscat', itemName: '', price: null, included: false }] });
  expect(clubCharges(noUscat, { grup: true, uscat: true }, 'member')).toMatchObject({ billing: 'club', amount: 40 });
  const noMember = { ...club, items: club.items.map((i) => ({ ...i, memberPrice: null })) };
  expect(clubCharges(noMember, { grup: true, uscat: false }, 'member')).toMatchObject({ billing: 'fara_pret', amount: 0 });
});
it('member price only with A.C.S. Da for that season (4.13)', () => {
  const acs = [{ id: 'x', athleteId: 'a1', seasonId: 's26', state: 'da' as const }, { id: 'y', athleteId: 'a2', seasonId: 's26', state: 'in_asteptare' as const }];
  expect([audienceFor(acs, 'a1', 's26'), audienceFor(acs, 'a2', 's26'), audienceFor(acs, 'a3', 's26'), audienceFor(acs, 'a1', 's25'), audienceFor(acs, 'a1', null)])
    .toEqual(['member', 'nonMember', 'nonMember', 'nonMember', 'nonMember']);
});
it('lesson price from the first individual item (5.5)', () => {
  expect(lessonPrice(club, 'nonMember')).toEqual({ itemName: 'Lecție individuală', price: 100 });
  expect(lessonPrice(inclus, 'member')).toEqual({ itemName: null, price: null });
  expect(lessonPrice(null, 'member')).toEqual({ itemName: null, price: null });
});
it('counts active groups without a price list (4.12)', () => {
  expect(groupsWithoutPriceList([...P_GROUPS, { ...P_GROUPS[0], id: 'g-x', active: false, priceListId: null }])).toBe(1); // g-pro
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/club/presence/__tests__/billing.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** `billing.ts`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/billing.ts src/club/presence/__tests__/billing.test.ts
git commit -m "feat(presence): Club charges, audience and lesson price"
```

---

### Task 10: Istoric lines of phase 5 (low)

**Files:**
- Create: `src/club/presence/copy/history.ts`, `src/club/presence/history-lines.ts`
- Modify: `src/club/presence/copy.ts` (one export line), `src/club/subjects.ts`, `src/club/history-text.ts`
- Test: `src/club/presence/__tests__/history-lines.test.ts`

**Interfaces:**
- Consumes: `ARROW`, `quotedChange` (`text-leaf.ts`), `countWords`, `longDate`, `ron`, `METHOD_WORDS`, `GROUP_LINES.deletedAthlete` (phase 4 copy), `phase4Lines`.
- Produces:
  - `SUBJECT` (`subjects.ts`) gains `session: 'session'`, `lesson: 'lesson'`, `subscription: 'subscription'`, `payment: 'payment'` (3.11).
  - `P5_ACTIONS` with the actions of the index table "History subjects and actions" (`sessionSaved: 'session-saved'`, ..., `lessonDeleted: 'lesson-deleted'`).
  - The `changes` each action stores (writers in 5-2 to 5-4 use exactly these keys):

| Action | `changes` |
|---|---|
| `session-saved` | `{ present: number; listed: number; coachIds: string[] }` |
| `session-corrected` | `{ added: string[]; removed: string[]; uscat: string[] }` (athlete ids) |
| `session-coaches` | `{ from: string[]; to: string[] }` (coach ids) |
| `visitor-present` | `{ groupName: string; date: string }` |
| `subscription-added` | `{ itemName: string; startsOn: string; validUntil: string; covered: number }` |
| `subscription-extended` | `{ weeks: number; from: string; to: string }` |
| `subscription-carried` | `{ listName: string }` |
| `subscription-cancelled`, `lesson-deleted` | `{}` |
| `payment-recorded` | `{ amount: number; method: PaymentMethod; purposeText: string }` |
| `payment-edited`, `lesson-edited` | `{ fields: Record<string, { from: unknown; to: unknown }> }` |
| `payment-cancelled` | `{ amount: number; paidOn: string }` |
| `payment-email-sent` | `{ recipient: string \| null }` |
| `lesson-planned` | `{ date: string; startTime: string; durationMin: number }` |
| `lesson-saved` | `{ present: boolean }` |

  - `PRESENCE_LINES` (`copy/history.ts`, exact copy of spec 8) and `PAYMENT_FIELD_LABELS = { amount: 'Sumă', paidOn: 'Data', method: 'Metodă', purposeText: 'Pentru', collectedAtRink: 'Încasat la patinoar', note: 'Notă' }`, `LESSON_FIELD_LABELS = { date: 'Data', startTime: 'Ora', durationMin: 'Durată', coaches: 'Antrenor' }`. `copy/history.ts` imports only `text-leaf.ts`, `ro-count.ts`.
  - `phase5Lines(action: string, changes: unknown, subjectType: string, names: Readonly<Record<string, string>>): string[] | null` (null for an action that is not phase 5).
  - `sessionHistoryTexts(action: string, changes: unknown, names: Readonly<Record<string, string>>): string[]` (the panel's Istoric; names of athletes and coaches by id; unknown id -> `GROUP_LINES.deletedAthlete`).
  - `historyTexts` (`history-text.ts`) ends with `phase4Lines(action, c, {}) ?? phase5Lines(action, c, subjectType, {}) ?? []`.

- [ ] **Step 1: Write the failing test**

```ts
const names = { a1: 'Ana Ionescu', a2: 'Mihai Pop', a3: 'Ioana Dinu', 'tm-virgil': 'Virgil Pascu', 'tm-andreea': 'Andreea Pascu' };
const lines = (action: string, changes: object, subject = 'athlete') => phase5Lines(action, changes, subject, names);
it('session lines (8)', () => {
  expect(sessionHistoryTexts('session-saved', { present: 6, listed: 9, coachIds: ['tm-virgil'] }, names)).toEqual(['Prezență salvată: 6 din 9, antrenor Virgil Pascu.']);
  expect(sessionHistoryTexts('session-corrected', { added: ['a1', 'a2'], removed: ['a3'], uscat: ['a1'] }, names))
    .toEqual(['Prezență corectată. Sportivi adăugați: Ana Ionescu, Mihai Pop. Sportiv scos: Ioana Dinu. Uscat bifat: Ana Ionescu.']);
  expect(sessionHistoryTexts('session-corrected', { added: ['a1'], removed: [], uscat: [] }, names)).toEqual(['Prezență corectată. Sportiv adăugat: Ana Ionescu.']);
  expect(sessionHistoryTexts('session-coaches', { from: ['tm-virgil'], to: ['tm-virgil', 'tm-andreea'] }, names))
    .toEqual(['Antrenori: "Virgil Pascu" → "Virgil Pascu, Andreea Pascu"']);
  expect(sessionHistoryTexts('session-corrected', { added: ['gone'], removed: [], uscat: [] }, names)).toEqual([`Prezență corectată. Sportiv adăugat: ${GROUP_LINES.deletedAthlete}.`]);
});
it('athlete and subscription lines (8)', () => {
  expect(lines('visitor-present', { groupName: 'Intermediari Bronze', date: '2026-10-27' })).toEqual(['Prezent la Intermediari Bronze, 27 oct 2026, doar la ședința asta.']);
  expect(lines('subscription-added', { itemName: 'Abonament 8 ședințe', startsOn: '2026-10-27', validUntil: '2026-11-23', covered: 2 }))
    .toEqual(['Abonament adăugat: Abonament 8 ședințe, din 27 oct 2026, expiră pe 23 nov 2026.', 'Acoperă 2 prezențe fără abonament.']);
  expect(lines('subscription-added', { itemName: 'Abonament 8 ședințe', startsOn: '2026-10-27', validUntil: '2026-11-23', covered: 1 })[1]).toBe('Acoperă 1 prezență fără abonament.');
  expect(lines('subscription-extended', { weeks: 2, from: '2026-11-23', to: '2026-12-07' })).toEqual(['Abonament prelungit cu 2 săptămâni: expiră pe 7 dec 2026.']);
  expect(lines('subscription-extended', { weeks: 1, from: '2026-11-23', to: '2026-11-30' }, 'subscription')).toEqual(['Prelungit cu 1 săptămână: 23 nov 2026 → 30 nov 2026.']);
  expect(lines('subscription-carried', { listName: 'Avansați Gold' }, 'subscription')).toEqual(['Valabil și în lista Avansați Gold.']);
  expect(lines('subscription-cancelled', {}, 'subscription')).toEqual(['Abonament anulat.']);
});
it('payment lines (8)', () => {
  expect(lines('payment-recorded', { amount: 320, method: 'numerar', purposeText: 'Abonament 8 ședințe' })).toEqual(['Plată înregistrată: 320 RON, Numerar, Abonament 8 ședințe.']);
  expect(lines('payment-recorded', { amount: 320, method: 'numerar', purposeText: 'x' }, 'payment')).toEqual(['Plată înregistrată.']);
  expect(lines('payment-edited', { fields: { amount: { from: 300, to: 320 }, collectedAtRink: { from: false, to: true } } }, 'payment'))
    .toEqual(['Sumă: "300 RON" → "320 RON"', 'Încasat la patinoar: "Nu" → "Da"']);
  expect(lines('payment-cancelled', { amount: 12.5, paidOn: '2026-10-27' })).toEqual(['Plată anulată: 12,50 RON, 27 oct 2026.']);
  expect(lines('payment-cancelled', { amount: 12.5, paidOn: '2026-10-27' }, 'payment')).toEqual(['Plată anulată.']);
  expect(lines('payment-email-sent', { recipient: 'ana@example.com' }, 'payment')).toEqual(['E-mail "Plată înregistrată" trimis la ana@example.com.']);
  expect(lines('payment-email-sent', { recipient: null }, 'payment')).toEqual(['E-mail "Plată înregistrată" trimis.']);
});
it('lesson lines (8)', () => {
  expect(lines('lesson-planned', { date: '2026-10-28', startTime: '18:00', durationMin: 50 }, 'lesson')).toEqual(['Lecție programată: 28 oct 2026, 18:00, 50 min.']);
  expect([lines('lesson-saved', { present: true }, 'lesson'), lines('lesson-saved', { present: false }, 'lesson')]).toEqual([['Lecție salvată: prezent.'], ['Lecție salvată: absent.']]);
  expect(lines('lesson-edited', { fields: { durationMin: { from: 50, to: 60 } } }, 'lesson')).toEqual(['Durată: "50 min" → "60 min"']);
  expect(lines('lesson-deleted', {}, 'lesson')).toEqual(['Lecție ștearsă.']);
  expect(lines('group-created', {})).toBeNull();
});
it('Istoric renders phase 5 lines and their undo (3.11, 7.3)', () => {
  expect(historyTexts('payment-cancelled', { amount: 320, paidOn: '2026-10-27' }, 'athlete')).toEqual(['Plată anulată: 320 RON, 27 oct 2026.']);
  expect(historyTexts('undone', { undoneAction: 'subscription-cancelled', undoneChanges: {} }, 'subscription')).toEqual(['Anulat: Abonament anulat.']);
  expect(SUBJECT).toMatchObject({ session: 'session', lesson: 'lesson', subscription: 'subscription', payment: 'payment' });
});
it('stores no child name in session lines (decided 6)', () => {
  expect(JSON.stringify({ added: ['a1'], removed: [], uscat: [] })).not.toContain('Ana');
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/club/presence/__tests__/history-lines.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the two files (a `Record<action, Render>` table like phase 4 `history-lines.ts`); payment field values: `amount` with `ron`, `paidOn` with `longDate`, `method` with `METHOD_WORDS`, booleans "Da" / "Nu"; lesson `durationMin` as "<n> min", `date` with `longDate`. Add the `export * from './copy/history';` line and the two edits to `subjects.ts` and `history-text.ts`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS (the P3 `history-text.test.ts` unchanged).
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/copy/history.ts src/club/presence/history-lines.ts src/club/presence/copy.ts src/club/subjects.ts src/club/history-text.ts src/club/presence/__tests__/history-lines.test.ts
git commit -m "feat(presence): Istoric lines for sessions, lessons, abonamente and payments"
```

---

### Task 11: Presence undo engine and the `/club/undo` dispatch (high)

**Files:**
- Create: `src/club/presence/undo.ts`, `src/club/presence/action-log.ts`, `src/club/presence/undo-service.ts`
- Modify: `src/api/club/controllers/groups.ts` (handler `undo` only)
- Test: `src/club/presence/__tests__/undo.test.ts`, `src/club/presence/__tests__/undo-service.test.ts`

**Interfaces:**
- Consumes: `PresenceStore`, `PresenceContext`, `usedSlots`, `Line`, `subjectsOf`, `ActionResult` (`src/club/groups/action-log.ts`), `readActionId` (`src/club/groups/undo-service.ts`), `P4_ACTIONS.undone`, `guarded`, `refuse`, `PRESENCE_ERRORS`.
- Produces (`undo.ts`):

```ts
export type PresenceUndoStep =
  | { op: 'deleteSubscription'; id: string }
  | { op: 'setSubscription'; id: string; values: Partial<Pick<SubscriptionWrite, 'extendedWeeks' | 'validUntil' | 'cancelled' | 'cancelledAt' | 'cancelledBy' | 'validIn'>> }
  | { op: 'setAttendanceSlot'; id: string; subscriptionId: string | null; billing: 'slot' | 'fara_abonament' }
  | { op: 'deletePayment'; id: string }
  | { op: 'setPayment'; id: string; values: Partial<PaymentWrite> }
  | { op: 'setAcs'; athleteId: string; seasonId: string; state: AcsState | null }
  | { op: 'cancelPaymentEmail'; paymentId: string }
  | { op: 'deleteLesson'; id: string }
  | { op: 'createLesson'; row: LessonWrite };
export type GuardType = 'subscription' | 'payment' | 'lesson' | 'attendance';
export type PresenceGuard = { type: GuardType; id: string; stamp: string | null };
export type PresenceUndoRecord = { kind: 'presence'; steps: PresenceUndoStep[]; subjects: Subject[]; athletes: string[]; guards: PresenceGuard[] };
export const subscriptionStamp = (row: SubscriptionRow | null, used: number): string | null;   // [extendedWeeks, validUntil, cancelled, validIn sorted, used]
export const paymentStamp = (row: PaymentRow | null): string | null;                          // [amount, method, paidOn, purpose, subscriptionId, lessonId, clubMonth, seasonId, collectedAtRink, note, cancelled]
export const lessonStamp = (row: LessonRow | null, paid: number): string | null;              // [state, present, date, startTime, durationMin, coachIds, paid]
export const attendanceStamp = (row: AttendanceRow | null): string | null;                    // [subscriptionId, billing, grup, uscat]
export function readPresenceRecord(v: unknown): PresenceUndoRecord | null;
/** Lock order of 7.1: athletes, lessons, subscriptions, payments; each sorted and unique. */
export function presenceLockTargets(r: PresenceUndoRecord): { athletes: string[]; lessons: string[]; subscriptions: string[]; payments: string[] };
```

- `action-log.ts`: `recordPresenceAction(store: PresenceStore, actor: string, lines: Line[], undo: Omit<PresenceUndoRecord, 'kind' | 'subjects'>): Promise<string>` (first line carries `changes.undo`, the rest `changes.actionId`; answers the action id); `recordPresenceLines(store, actor, lines): Promise<void>`; `guardOf(store: PresenceStore, type: GuardType, id: string): Promise<PresenceGuard>` (reads the row and computes its stamp now; writers call it after their writes, inside the transaction).
- `undo-service.ts`: `undoKindOf(store: Pick<PresenceStore, 'historyEntry'>, body: unknown): Promise<'presence' | 'other'>`; `undoPresenceAction(ctx: PresenceContext, body: unknown): Promise<AdminResult<{ undone: true }>>`. Algorithm, in one `store.transaction` inside `guarded(ctx.log, '[undo-presence] <id>', ...)`:
  1. no action id: 400 `invalid`; no entry: 404 `notFound`; no record, or `changes.undone === true`: 409 `undoChanged`.
  2. Lock `presenceLockTargets(record)` in order (athletes, lessons, subscriptions, payments), then `lockHistoryEntry(actionId)`; re-read the entry; undone now: 409.
  3. Every guard's stamp now (`guardOf`) must equal the recorded one, and every `cancelPaymentEmail` step must have `sentPaymentEmailJobs(paymentId) === 0`; else 409 `undoChanged`.
  4. Run the steps in reverse order (`createLesson` writes `row`; `setAcs` calls `store.setAcs`; the others the matching store method).
  5. Write one `P4_ACTIONS.undone` line per line of the action (the entry and `historyAfter(entry.seq, record.subjects)` lines whose `changes.actionId` is the entry id) with `{ undoneAction, undoneChanges (without undo, actionId, undone), undoneOf: entry.id }`, then `setHistoryChanges(entry.id, { ...entry.changes, undone: true })`.
- `controllers/groups.ts` `undo`: `(await undoKindOf(strapiGroupStore(strapi), body)) === 'presence'` -> `respond(ctx, await undoPresenceAction(await presenceContext(strapi, ctx), body))`, else the phase 4 call unchanged.

- [ ] **Step 1: Write the failing tests**

`undo.test.ts`:

```ts
it('stamps change when a guarded field changes, and are null for a missing row (decided 5)', () => {
  const sub = subscriptionRow({ id: 'a' });
  expect(subscriptionStamp(sub, 0)).not.toBe(subscriptionStamp(sub, 1));
  expect(subscriptionStamp(sub, 0)).not.toBe(subscriptionStamp({ ...sub, extendedWeeks: 1 }, 0));
  expect(subscriptionStamp(null, 0)).toBeNull();
  const pay = paymentRow({ id: 'p' });
  expect(paymentStamp(pay)).toBe(paymentStamp({ ...pay, recordedAt: 'later' }));
  expect(paymentStamp(pay)).not.toBe(paymentStamp({ ...pay, note: 'x' }));
  expect(lessonStamp(lessonRow({ id: 'l' }), 0)).not.toBe(lessonStamp(lessonRow({ id: 'l' }), 1));
  expect(attendanceStamp(attendanceRow({ id: 't', billing: 'slot', subscriptionId: 'a' }))).not.toBe(attendanceStamp(attendanceRow({ id: 't', billing: 'fara_abonament', subscriptionId: null })));
});
it('locks athletes, lessons, subscriptions, payments, each sorted (7.1)', () => {
  expect(presenceLockTargets({ kind: 'presence', subjects: [], athletes: ['a2', 'a1'], guards: [{ type: 'payment', id: 'p2', stamp: null }, { type: 'subscription', id: 's1', stamp: null }],
    steps: [{ op: 'deletePayment', id: 'p1' }, { op: 'deleteLesson', id: 'l1' }, { op: 'setAcs', athleteId: 'a3', seasonId: 's26', state: null }] }))
    .toEqual({ athletes: ['a1', 'a2', 'a3'], lessons: ['l1'], subscriptions: ['s1'], payments: ['p1', 'p2'] });
});
it('reads only presence records', () => {
  expect(readPresenceRecord({ kind: 'group', steps: [], subjects: [] })).toBeNull();
  expect(readPresenceRecord({ kind: 'presence', steps: [], subjects: [], athletes: [], guards: [] })?.kind).toBe('presence');
});
```

`undo-service.test.ts` (fake context; a "record payment" action built in the test with `recordPresenceAction`: payment `p1` created, A.C.S. set from no row to Da, e-mail job queued; steps `deletePayment p1`, `setAcs a1 s26 null`, `cancelPaymentEmail p1`; guard `payment p1`):

```ts
it('takes the action back and writes "Anulat" lines (7.3)', async () => {
  const f = await recordedPayment();
  expect(await undoPresenceAction(f.ctx, { actionId: f.actionId })).toEqual({ ok: true, data: { undone: true } });
  expect(f.state.payments).toEqual([]);
  expect(await f.store.acsRows({ athleteId: 'a1' })).toEqual([]);
  expect(f.state.jobs.map((j) => j.status)).toEqual(['cancelled']);
  expect(f.group.history.filter((h) => h.action === 'undone').map((h) => h.subjectType).sort()).toEqual(['athlete', 'payment']);
});
it('is refused after the payment was edited, and when sent twice (7.3)', async () => {
  const f = await recordedPayment();
  await f.store.updatePayment('p1', { amount: 300 });
  expect(await undoPresenceAction(f.ctx, { actionId: f.actionId })).toEqual({ ok: false, status: 409, error: 'Nu se mai poate anula. Datele s-au schimbat între timp.' });
  expect(f.state.payments).toHaveLength(1);
  const g = await recordedPayment();
  await undoPresenceAction(g.ctx, { actionId: g.actionId });
  expect((await undoPresenceAction(g.ctx, { actionId: g.actionId })).ok).toBe(false);
});
it('is refused when the row is gone or the e-mail already went out', async () => {
  const f = await recordedPayment();
  await f.store.deletePayment('p1');
  expect((await undoPresenceAction(f.ctx, { actionId: f.actionId })).ok).toBe(false);
  const g = await recordedPayment();
  g.state.jobs[0].status = 'sent';
  expect((await undoPresenceAction(g.ctx, { actionId: g.actionId })).ok).toBe(false);
  expect(g.state.payments).toHaveLength(1);
});
it('rolls everything back when a step fails', async () => {
  const f = await recordedPayment();
  f.failOn('setAcs');
  expect(await undoPresenceAction(f.ctx, { actionId: f.actionId })).toEqual({ ok: false, status: 500, error: 'Acțiunea nu a reușit. Nimic nu a fost salvat.' });
  expect(f.state.payments).toHaveLength(1);
});
it('takes the locks in order (7.1)', async () => {
  const f = await recordedPayment();
  await undoPresenceAction(f.ctx, { actionId: f.actionId });
  expect(f.group.locks.slice(-3)).toEqual(['athlete:a1', 'payment:p1', `history:${f.actionId}`]);
});
it('dispatch: presence records go to the presence undo, others to phase 4', async () => {
  const f = await recordedPayment();
  expect(await undoKindOf(f.store, { actionId: f.actionId })).toBe('presence');
  expect(await undoKindOf(f.store, { actionId: 'missing' })).toBe('other');
  expect(readFileSync(join(SRC, 'api/club/controllers/groups.ts'), 'utf8')).toMatch(/undoKindOf\(.*\) === 'presence'/);
});
```

- [ ] **Step 2: Run to verify they fail** — `npx vitest run src/club/presence/__tests__/undo.test.ts src/club/presence/__tests__/undo-service.test.ts`; Expected: FAIL.
- [ ] **Step 3: Implement** the three files and the controller change.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`; Expected: PASS (phase 4 `undo-service.test.ts` unchanged).
- [ ] **Step 5: Commit**

```bash
git add src/club/presence/undo.ts src/club/presence/action-log.ts src/club/presence/undo-service.ts src/api/club/controllers/groups.ts src/club/presence/__tests__/undo.test.ts src/club/presence/__tests__/undo-service.test.ts
git commit -m "feat(presence): undo engine with row stamps behind POST /club/undo"
```

---

### Task 12: Phase 5 fixture and boot check on a throwaway Postgres (high)

**Files:**
- Create: `scripts/fixtures/phase5-shape.js` (committed; plans 5-2 to 5-6 reuse it)
- Temporary: `${TMPDIR:-/tmp}/es51` (removed at the end)

**Interfaces:**
- Consumes: `scripts/fixtures/phase4-shape.js` (run first), everything above.
- Produces: `ES_THROWAWAY_DB=1 IDS_FILE=<path> node scripts/fixtures/phase5-shape.js` on a database already seeded by `phase4-shape.js`: adds to the Club list the items "Ședință grup" (session 40 / 50), "Uscat" (uscat 20 / 25), "Lecție individuală" (individual 80 / 100); creates the list "Avansați Gold" (school section; "Abonament 8 ședințe Gold", subscription, 8, 400 / 440) and an active school group "Avansați Gold" on it with one coach; leaves one Club group without a list; sets `site-settings.attendanceStartDate` to `2026-11-01`; merges `{ priceLists: { <name>: id }, groups: { 'Avansați Gold': id } }` into the ids file. Refuses unless `ES_THROWAWAY_DB=1` and the phase 4 seasons exist and no Gold list exists yet.

Container `es51-pg` on 127.0.0.1:55451, Strapi on 1371. Never 1337, 1340, 3010, 5432, 55442.

- [ ] **Step 1: Write the fixture** (same opening guard and `createStrapi(...).load()` pattern as `scripts/fixtures/phase4-shape.js`; writes through `strapi.documents`).

- [ ] **Step 2: Start the throwaway database and Strapi**

Run (from the worktree root): `docker run -d --name es51-pg -e POSTGRES_PASSWORD=es51 -e POSTGRES_DB=es51 -p 127.0.0.1:55451:5432 postgres:16`; a throwaway `.env` copy in `${TMPDIR:-/tmp}/es51` with `DATABASE_HOST=127.0.0.1 DATABASE_PORT=55451 DATABASE_NAME=es51 DATABASE_USERNAME=postgres DATABASE_PASSWORD=es51 PORT=1371`; `npm run build`; `ES_THROWAWAY_DB=1 IDS_FILE=$TMP/ids.json node scripts/fixtures/phase4-shape.js && ES_THROWAWAY_DB=1 IDS_FILE=$TMP/ids.json node scripts/fixtures/phase5-shape.js`; start Strapi on 1371; stop it; start it again (spec 11.4: restart once).
Expected: both boots log no error; the second boot logs no `[presence] indexes` line.

- [ ] **Step 3: Check the schema, indexes and keys**

Run: `psql postgresql://postgres:es51@127.0.0.1:55451/es51 -c "\d club_sessions" -c "\d club_attendances" -c "select indexname from pg_indexes where tablename like 'club_%' order by 1"`
Expected: the five tables exist with the columns of Task 1; the six index names of Task 3 are listed.

Run two inserts of `club_sessions` rows with the same `occurrence_key` (`insert into club_sessions (document_id, occurrence_key, date, start_time, duration_min, source) values ('x1', 'k|2026-11-07|11:00', '2026-11-07', '11:00', 50, 'added')`, then `'x2'` with the same key).
Expected: the second fails with `duplicate key value violates unique constraint "club_sessions_occurrence_key_uq"`; two rows with `occurrence_key` null both succeed. Delete the test rows.

- [ ] **Step 4: Check nothing is public**

Run: `for p in sessions attendances individual-lessons subscriptions payments; do curl -s -o /dev/null -w "%{http_code} $p\n" http://127.0.0.1:1371/api/$p; done` and `curl -s http://127.0.0.1:1371/api/club/public | grep -c '"uscat"'`
Expected: every status is 404 (never 200); the grep count is 0.

- [ ] **Step 5: Check the phase 4 undo still works through the dispatch**

As plan 4-1 Task 12 (admin login once with curl): allocate one child with `POST /api/club/memberships/allocate`, then `POST /api/club/undo` with the answered `actionId`.
Expected: `{"data":{"undone":true}}`; a second identical undo answers 409.

- [ ] **Step 6: Clean up and commit**

Run: stop Strapi, `docker rm -f es51-pg`, `rm -rf ${TMPDIR:-/tmp}/es51`.

```bash
git add scripts/fixtures/phase5-shape.js
git commit -m "test(presence): phase 5 fixture and boot check"
```

---

## Interfaces for other plans

The index's "Shared interfaces" section is the contract; in short:

- **Store and context.** `PresenceStore` (`store.ts`) with `UniqueKeyError`; `strapiPresenceStore(strapi)`; `PresenceContext`, `presenceContext(strapi, ctx)`; fake `fakePresenceStore(seed)`, `fakePresenceContext(seed, today)`, seeds `P_LISTS`, `P_GROUPS` (plus phase 4 `G_SEASONS`, `G_TEAM`, `athleteRow`, `member`), builders `sessionRow`, `attendanceRow`, `lessonRow`, `subscriptionRow`, `paymentRow`. Plan 5-3 adds `paymentEmails` to `PresenceContext` and the fake context.
- **Rules.** `dates.ts`, `money.ts`, `sessions.ts`, `subscriptions.ts`, `billing.ts` as listed in Tasks 4, 7, 8, 9.
- **History.** `P5_ACTIONS` and the `changes` table of Task 10; `phase5Lines`, `sessionHistoryTexts`; `SUBJECT.session | lesson | subscription | payment`.
- **Undo.** `recordPresenceAction(store, actor, lines, { steps, athletes, guards })`, `guardOf(store, type, id)`; reuse phase 4 `done`, `ActionResult`, `respondAction`. Writers compute guards after their writes, inside their transaction.
- **Copy.** `copy/core.ts` (`PRESENCE_ERRORS`, `PRESENCE_WORDS`, `SESSION_STATE_WORDS`, `SUBSCRIPTION_STATE_WORDS`, `METHOD_WORDS`, `PURPOSE_WORDS`, `remainingText`, `noPriceListNotice`), `copy/history.ts`. A later plan adds `copy/<file>.ts` and one export line.
- **Fixture.** `scripts/fixtures/phase5-shape.js` after `phase4-shape.js`, ids merged into the same `IDS_FILE`.

## Self-review

- **Spec coverage.** 3.1 to 3.5 types (T1), 3.6 `uscat` and public reads (T2), 3.7 e-mail kind and relation (T1; job writes in 5-3), 3.8 setting (T1; Setări field 5-5), 3.9 derived occurrence, state, season of a date, membership on a date (T4, T7; membership on a date is the phase 4 `isCurrentMembership` with a date, used in 5-2), 3.10 uniqueness and indexes (T3, T5, T6), 3.11 subjects (T10); 4.10 slot choice and status (T8); 4.12 and 4.13 prices and audience (T9); 5.15 label (T2); 7.1 lock order (T5, T11), 7.3 undo engine and refusal text (T11; each action's record in 5-2 and 5-3); 8 every line (T10); 10.1 module (T4, T10); 11.2 parity (T5, T6); 11.3 core routers and `uscat` public (T1, T2, T12); 11.4 restart once (T12); 12 step 2 (T3, T12). Everything else (4.1 to 4.9, 4.11, 4.14 to 4.24, 5, 6, 9) belongs to plans 5-2 to 5-6 per the index.
- **Step scan.** Code appears only as signatures, test assertions and exact copy; bodies are left to the implementer except the undo algorithm (T11), which the signatures do not determine.
- **Type consistency.** `AttendanceRow.sessionDate` / `groupId` (T4) are filled by both stores (T5, T6) and read by T8 (`usedSlots` takes only `subscriptionId`); `PresenceContext` (T6) is used by the fake context (T5, type import) and T11; `Line`, `ActionResult` come from phase 4; `PRESENCE_ERRORS.undoChanged` (T4) is the refusal of T11.
- **Review Focus.** Concurrent saves (T5, T6, T12), abonament edge dates and ties (T8), decimals (T4, T6), undo after a change or twice (T11), dates between seasons (T4): each has its test.
- **Proportion.** Twelve tasks over the foundation of a 700-line spec; code blocks are signatures and assertions.
