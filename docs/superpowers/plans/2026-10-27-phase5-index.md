# Phase 5 plans: attendance, abonamente, payments (index)

Spec (binding): `docs/superpowers/specs/2026-10-27-attendance-payments-design.md` (v1, approved 2026-10-27). Decisions: `edusport_frontend/docs/portal/DECISIONS.md` (a later dated entry wins). Code rules: `CLAUDE.md` (store pattern with fake and parity tests, transactions and row locks, undo records, Istoric lines, copy modules, thin admin UI with rules in `src/club`, admin tokens). Agent rules: `.superpowers/phase3-shared/agent-rules.md`. Companion screens: `.superpowers/phase5/screens/p5-*.html`; renders go to `edusport_frontend/docs/portal/mockups/screens/phase5-renders/` as `5-<n>-*.png`.

Admin only: no website change, no public route (spec 2.3).

## Plans

| Plan | File | Tasks | Needs merged | Delivers | Risk |
|---|---|---|---|---|---|
| 5-1 | `2026-10-27-phase5-1-presence-foundation.md` | 12 | phase 4 on `feat/athletes` | every phase 5 schema change (5 types, enum values, setting, `uscat`), indexes, `PresenceStore` (Strapi + fake, parity), shared rules (dates, money, session keys and states, abonament state and slot choice, Club prices and audience), every Istoric line of spec 8, the presence undo engine and the `/club/undo` dispatch, copy core | high |
| 5-2 | `2026-10-27-phase5-2-attendance.md` | 8 | 5-1 | day list and undone list, session panel read, "+ Ședință nouă" check, session save (slots, Club prices, visitors, reactivation 409, corrections, history), group tab list, individual lessons (create, read, save, delete, undo), "Pe antrenori" and CSV, athlete month attendance; routes `09-attendance.ts` | high |
| 5-3 | `2026-10-27-phase5-3-abonamente-payments.md` | 11 | 5-1 | add abonament (items, coverage, optional payment), extend with preview, cancel abonament, lists and bars, move carry and move preview (P4 06 change), Sportivi column and filter data; payments (record, edit, cancel, A.C.S.), "Pentru" options, athlete Plăți tab data, De încasat (both parts), "Plată înregistrată" e-mail job and sender; routes `10-subscriptions.ts`, `11-payments.ts` | high |
| 5-4 | `2026-10-27-phase5-4-lifecycle.md` | 5 | 5-1 | inactivity input (attendance, lessons, payments, subscriptions), personal data export and summary PDF sections, delete refusal 409, merge of attendance / lessons / subscriptions / payments, anonymize (payment note, payment e-mail jobs), new season pinned unchanged | high |
| 5-5 | `2026-10-27-phase5-5-prezenta-admin-ui.md` | 7 | 5-2 | menu entries (all four), Prezență page (3 tabs), session panel, "Ședință nouă" window, lesson window and panel, group tab "Prezență", Setări site "Prezență și plăți din", renders | low |
| 5-6 | `2026-10-27-phase5-6-money-admin-ui.md` | 8 | 5-3, 5-4, 5-5 | Abonamente page with "Prelungește abonamentele", "Adaugă abonament" window, Plăți page and payment window, De încasat, athlete tabs "Grupe și abonament" and "Plăți", panel row menu ("Adaugă abonament", "+ Plată"), move window bar, Sportivi column and filter, delete refusal dialog, renders | low |

Total 51 tasks. Per-task reviews run only on tasks tagged **high** inside each plan (every task writing money, slots, undo, locks, schema, indexes, delete, merge, anonymize). Low tasks get the plan's final review only.

## Order and parallel groups

Order: 5-1; then 5-2, 5-3 and 5-4 in parallel; then 5-5 (after 5-2); then 5-6 (after 5-3, 5-4, 5-5).

- One worktree per plan, branched from `feat/athletes` after its "Needs merged" plans are merged; each plan's "Parallel groups" line splits its own tasks.
- 5-2, 5-3, 5-4 touch different folders and files:
  - 5-2: `src/club/presence/attendance/**`, `lessons/**`, `coaches/**`, `copy/attendance.ts`, `routes/09-attendance.ts`, `controllers/attendance.ts`.
  - 5-3: `src/club/presence/subscriptions/**`, `payments/**`, `due/**`, `copy/subscriptions.ts`, `copy/payments.ts`, `copy/email.ts`, `routes/10-subscriptions.ts`, `routes/11-payments.ts`, `controllers/subscriptions.ts`, `controllers/payments.ts`, `src/email/payment-email.ts`; in phase 4 files only `src/club/groups/members.ts` (move carry), `undo.ts` + `undo-service.ts` (one new op), `routes/06-groups.ts` (one line, move preview), `controllers/groups.ts` (one handler); in phase 3 files only the Sportivi list (`src/club/athletes/list.ts`) and its controller handler `athletes.list`; `PresenceContext` gains `paymentEmails`.
  - 5-4: `src/club/presence/lifecycle/**`, `copy/lifecycle.ts`; `src/club/personal-data/inactivity.ts`, `export-service.ts`, `summary-model.ts`, `summary-pdf.ts`, `anonymize-service.ts`; `src/club/athletes/delete.ts`, `merge.ts`, and the controller handler `athletes.remove` only.
- Shared files get one line per plan: `src/club/presence/copy.ts` (one `export * from './copy/<file>';` each), `src/api/club/routes/` (new files only). `controllers/athletes.ts` is edited by 5-3 (`list`) and 5-4 (`remove`) in different handlers.
- 5-5 owns all four menu entries and the `src/admin/app.tsx` routes of the four pages (5-6 fills three of them); 5-6 edits 5-5's `SessionPanel` row menu, so it starts after 5-5 is merged.

## Boot checks (throwaway Postgres, never the user's environment)

| Plan | Postgres container / port | Strapi port |
|---|---|---|
| 5-1 | `es51-pg` 127.0.0.1:55451 | 1371 |
| 5-2 | `es52-pg` 55452 | 1372 |
| 5-3 | `es53-pg` 55453 | 1373 |
| 5-4 | `es54-pg` 55454 | 1374 |
| 5-5 | `es55-pg` 55455 | 1375 |
| 5-6 | `es56-pg` 55456 | 1376 |
| spare (final whole-branch check) | `es57-pg` 55457 | 1377 |

Never 55442, 1337, 1340, 3010, 5432, `strapi_app`, `strapi_db`, `edusport-test-pg`. Each check starts from a copy of the phase 4 boot data (`scripts/fixtures/phase4-shape.js` plus `scripts/fixtures/phase5-shape.js` from 5-1), restarts Strapi once to prove the schema boots, and removes its container afterwards. UI plans render every screen of spec 5 at desktop (1440) and phone (390) width after building (no pre-build approvals) [DEC 2026-10-26 phase3ab].

## Deploy (spec 12, only with the user's approval)

1. Database backup.
2. Backend: new types, enum values, setting and indexes apply on restart (indexes from bootstrap, plan 5-1 decided 1); restart once more if a new attribute is not saved.
3. Frontend: no website change; check that the website price reader ignores an unknown item kind before step 4.
4. Prețuri: the club's Club prices (Ședință, Uscat, Lecție individuală) and the Avansați Gold prices.
5. Setări site: "Prezență și plăți din" = the 1st of the month after deploy.
6. Abonamente running on paper: added with "Adaugă abonament" and their real start date.
7. Production checks: Prezență today, one group tab, Abonamente, Plăți, De încasat, Pe antrenori; nothing on the public website changes.
8. Diagrams updated: 03b, 03c, 04c, 04d, 05c, 02f, 02g.

No data migration script (spec 2.2, p5 Q31).

## Shared interfaces

Defined by plan 5-1 unless a plan is named. Later plans import these names exactly.

### Content types (spec 3)

All: `draftAndPublish: false`, `pluginOptions.content-manager.visible: false`, core router `createCoreRouter(uid, { only: [] })` (no content-api route exists, so the Public role can never read them).

| Uid | Table | Fields |
|---|---|---|
| `api::session.session` | `club_sessions` | `group`, `season`, `date`, `startTime`, `durationMin` (5..600), `source` (`schedule` / `added`), `event`, `occurrenceKey` (unique), `outsideSchedule`, `coaches` (manyToMany team-member), `savedBy`, `savedAt`, `firstSavedAt` |
| `api::attendance.attendance` | `club_attendances` | `session`, `athlete`, `uniqueKey` (unique), `grup`, `uscat`, `visitor`, `subscription`, `billing` (`slot` / `fara_abonament` / `club` / `inclus` / `fara_pret`), `charges` (json), `amount`, `audience` (`member` / `nonMember`) |
| `api::individual-lesson.individual-lesson` | `club_individual_lessons` | `athlete`, `date`, `startTime`, `durationMin` (default 50), `coaches`, `state` (`planned` / `saved`), `present`, `priceList`, `itemName`, `price`, `audience`, `amount`, `createdBy`, `savedBy`, `savedAt` |
| `api::subscription.subscription` | `club_subscriptions` | `athlete`, `season`, `priceList`, `validIn` (manyToMany price-list), `itemName`, `price`, `audience`, `slots`, `startsOn`, `validUntil`, `extendedWeeks`, `cancelled`, `cancelledAt`, `cancelledBy`, `purchasedAt`, `recordedBy` |
| `api::payment.payment` | `club_payments` | `athlete`, `amount`, `method` (`numerar` / `card` / `transfer`), `paidOn`, `purpose` (`abonament` / `cotizatie` / `club_luna` / `lectie` / `altceva`), `subscription`, `lesson`, `clubMonth`, `season`, `collectedAtRink`, `note`, `sendEmail`, `emailJob`, `acsBefore` (`da` / `nu` / `in_asteptare`), `recordedBy`, `recordedAt`, `cancelled`, `cancelledAt`, `cancelledBy` |

Changed: `email-job.kind` gains `payment`, new relation `payment` (manyToOne); `club.price-item.kind` gains `uscat`; `site-settings` gains `attendanceStartDate` (date).

Indexes (5-1, `src/club/presence/indexes.ts`, run from bootstrap): unique `club_sessions(occurrence_key)`, unique `club_attendances(unique_key)`, b-tree `club_sessions(date)`, `club_individual_lessons(date)`, `club_payments(paid_on)`, `club_subscriptions(valid_until)`.

### Store

- `PresenceStore` (`src/club/presence/store.ts`), a separate interface (spec 11.2) that `extends PresenceGroupReads = Pick<GroupStore, 'transaction' | 'lockAthlete' | 'lockHistoryEntry' | 'seasons' | 'sections' | 'groups' | 'group' | 'teamMembers' | 'athletes' | 'athlete' | 'memberships' | 'history' | 'historyEntry' | 'historyAfter' | 'adminNames' | 'setAthleteStatus' | 'recordAction' | 'record' | 'setHistoryChanges'>`. Real: `strapiPresenceStore(strapi)` (`strapi-store.ts`); fake: `fakePresenceStore(seed)` and `fakePresenceContext(seed, today)` (`__tests__/fake-store.ts`).
- Locks (order of spec 7.1): `lockAthlete` (inherited), `lockSession`, `lockLesson`, `lockSubscription`, `lockPayment`; each list sorted by id. Never outside `store.transaction`.
- Cross-store: a presence write called inside a `GroupStore` or `ClubStore` transaction wraps its work in `presence.transaction(...)` (Strapi reuses the outer transaction; the presence scope then holds it for its locks).
- `PresenceContext` (`context.ts`): `{ store: PresenceStore; actor: string; today: string; now: () => Date; log: (m: string) => void }`; `presenceContext(strapi, ctx)`. Plan 5-3 adds `paymentEmails: (paymentId: string) => void`.

### Row types (`src/club/presence/types.ts`)

`PresenceType`, `Billing`, `Charge`, `SessionSource`, `SessionRow` / `SessionWrite`, `AttendanceRow` / `AttendanceWrite`, `LessonState`, `LessonRow` / `LessonWrite`, `SubscriptionRow` / `SubscriptionWrite`, `PaymentMethod`, `PaymentPurpose`, `PaymentRow` / `PaymentWrite`, `PriceItemRow`, `PriceListRecord`, `PaymentEmailPayload`, `PaymentEmailJob`, `SubscriptionState`, `SessionState`, `HeldOccurrence`, `PresenceGuard`. `Audience` and `AcsState`, `AcsRow` are reused from `src/club/price-item.ts`, `src/club/acs.ts`, `src/club/athletes/store.ts`.

### Pure helpers (5-1)

- `dates.ts`: `seasonOfDate(seasons, date)`, `monthOf(date)`, `isMonth(v)`, `monthRange(month)`, `addMonths(month, n)`, `monthTitle(month)` ("Octombrie 2026"), `monthName(month)` ("septembrie"), `listDate(date)` ("Mar 27 oct"), `longDate(date)` ("27 oct 2026").
- `money.ts`: `toMoney(v)`, `sumMoney(values)`, `ron(n)` ("320 RON", "12,50 RON", "-20 RON").
- `sessions.ts`: `occurrenceKey(eventId, date, startTime)`, `readOccurrenceKey(key)`, `attendanceKey(sessionId, athleteId)`, `heldOccurrences(window, groups, from, to)`, `sessionState(input)`, `isOutsideSchedule(session, held)`, `durationOf(occurrence)`.
- `subscriptions.ts`: `usedSlots(attendances)`, `subscriptionState(sub, used, today)`, `isValidForList(sub, priceListId)`, `slotCandidates(subs, used, priceListId, date)`, `pickSubscription(subs, used, priceListId, date)`, `remainingOf(sub, used)`, `abonamentStatusText(remaining)`.
- `billing.ts`: `audienceFor(acsRows, athleteId, seasonId)`, `clubCharges(list, ticks, audience)`, `lessonPrice(list, audience)`, `groupsWithoutPriceList(groups)`.

Owned by later plans (not shared): hours and CSV (5-2), coverage, carry, extension, month settlement and De încasat math (5-3), merge plan of attendance (5-4).

### Copy module files

`src/club/presence/copy.ts` re-exports, one line per file:

| File | Plan | Holds |
|---|---|---|
| `copy/core.ts` | 5-1 | `PRESENCE_ERRORS`, `PRESENCE_WORDS`, `SESSION_STATE_WORDS`, `SUBSCRIPTION_STATE_WORDS`, `METHOD_WORDS`, `PURPOSE_WORDS`, `remainingText`, `noPriceListNotice` |
| `copy/history.ts` | 5-1 | `PRESENCE_LINES` (every line of spec 8) |
| `copy/attendance.ts` | 5-2 | attendance errors, toasts, warning texts, reactivation dialog, CSV header |
| `copy/subscriptions.ts` | 5-3 | abonament window, extend modal, toasts |
| `copy/payments.ts` | 5-3 | payment window, errors, "Pentru" option texts, De încasat |
| `copy/email.ts` | 5-3 | "Plată înregistrată" subject and paragraphs |
| `copy/lifecycle.ts` | 5-4 | delete refusal sentences, summary PDF headings and row formats |
| `copy/prezenta-ui.ts` | 5-5 | Prezență page, panels, windows, group tab labels |
| `copy/money-ui.ts` | 5-6 | Abonamente, Plăți, De încasat, athlete tabs, move bar labels |

One test (`src/club/presence/__tests__/copy.test.ts`, 5-1) scans every file in `copy/`: no em or en dash, no middle dot, no curly quotes, no emoji.

### Routes

New files (spec 6), all `{ auth: false, policies: ['global::is-admin'], middlewares: [] }`, static before parameter paths (source-reading test in each plan): `09-attendance.ts` (5-2, controller `attendance`), `10-subscriptions.ts` (5-3, controller `subscriptions`), `11-payments.ts` (5-3, controller `payments`). Changed: `06-groups.ts` gains `GET /club/memberships/:documentId/move-preview` (5-3); `POST /club/undo` (P4) dispatches presence actions (5-1); `DELETE /club/athletes/:documentId` answers 409 `{ payments, subscriptions }` (5-4); `GET /club/athletes` gains `abonament` filter and column (5-3). Plan 5-1 adds no route.

### History subjects and actions

Subjects (`src/club/subjects.ts` gains): `session`, `lesson`, `subscription`, `payment` (athlete lines use the existing `athlete`).

`P5_ACTIONS` (`src/club/presence/history-lines.ts`):

| Action | Subject | Line (spec 8) |
|---|---|---|
| `session-saved` | session | "Prezență salvată: <x> din <y>, antrenor <nume>." |
| `session-corrected` | session | "Prezență corectată. Sportivi adăugați: ... Sportivi scoși: ... Uscat bifat: ..." |
| `session-coaches` | session | "Antrenori: "<vechi>" -> "<nou>"" |
| `visitor-present` | athlete | "Prezent la <grupă>, <data>, doar la ședința asta." |
| `subscription-added` | athlete, subscription | "Abonament adăugat: <item>, din <data>, expiră pe <data>." (+ "Acoperă <n> prezențe fără abonament.") |
| `subscription-extended` | athlete, subscription | "Abonament prelungit cu <x> săptămâni: expiră pe <data>." / "Prelungit cu <x> săptămâni: <vechi> -> <nou>." |
| `subscription-carried` | subscription | "Valabil și în lista <listă>." |
| `subscription-cancelled` | subscription | "Abonament anulat." |
| `payment-recorded` | athlete, payment | "Plată înregistrată: <sumă>, <metodă>, <pentru>." / "Plată înregistrată." |
| `payment-edited` | payment | field changes ("Sumă: "300 RON" -> "320 RON"") |
| `payment-cancelled` | athlete, payment | "Plată anulată: <sumă>, <data>." / "Plată anulată." |
| `payment-email-sent` | payment | "E-mail "Plată înregistrată" trimis la <adresă>." (key `recipient`, scrubbed on anonymize) |
| `lesson-planned` | lesson | "Lecție programată: <data>, <ora>, <durată>." |
| `lesson-saved` | lesson | "Lecție salvată: prezent." / "Lecție salvată: absent." |
| `lesson-edited` | lesson | field changes |
| `lesson-deleted` | lesson | "Lecție ștearsă." |

Reused P3 lines: "Membru A.C.S. <sezon>: <vechi> -> <nou>" (`HISTORY_ACTIONS` of `history-text.ts`), "Reactivat". Session lines store athlete and coach ids; names are read at display (`sessionHistoryTexts(action, changes, names)`), so an anonymized child never appears by old name. Undo writes the P4 `undone` line ("Anulat: <linia>").

### Undo

`PresenceUndoRecord` (`src/club/presence/undo.ts`): `{ kind: 'presence'; steps: PresenceUndoStep[]; subjects: Subject[]; athletes: string[]; guards: PresenceGuard[] }`, stored as `changes.undo` on the action's first line by `recordPresenceAction(store, actor, lines, undo)` (`action-log.ts`). Steps (`op`): `deleteSubscription`, `setSubscription`, `setAttendanceSlot`, `deletePayment`, `setPayment`, `setAcs`, `cancelPaymentEmail`, `deleteLesson`, `createLesson`. A guard holds a row's stamp at the time of the action; undo is refused with "Nu se mai poate anula. Datele s-au schimbat între timp." when any current stamp differs (spec 7.3 refusal column).

| Action (plan) | Steps | Guards |
|---|---|---|
| Add abonament (5-3) | `deleteSubscription`, `setAttendanceSlot` per covered row (back to `fara_abonament`), `deletePayment`, `cancelPaymentEmail` | subscription (incl. used count), payment |
| Extend (5-3) | `setSubscription` per row (old `extendedWeeks`, `validUntil`) | each subscription |
| Record payment (5-3) | `deletePayment`, `setAcs` (state before, null = no row), `cancelPaymentEmail` | payment |
| Edit payment (5-3) | `setPayment` (old values), `setAcs` when re-purposed | payment |
| Anulează plata (5-3) | `setPayment` (not cancelled), `setAcs` when it reverted | payment |
| Anulează abonamentul (5-3) | `setSubscription` (not cancelled), `setAttendanceSlot` per freed row | subscription, each freed attendance |
| Create lesson (5-2) | `deleteLesson` | lesson (incl. paid count) |
| Delete lesson (5-2) | `createLesson` | none |
| Move with carry (5-3) | P4 record gains op `uncarry` `{ subscriptionId, priceListId }` | P4 rule |

Session save has no undo (C46).
