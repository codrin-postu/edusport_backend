# Phase 5: attendance, subscriptions and payments (design)

Status: v1 (approved by the user 2026-10-27), 2026-10-27. Admin side only. Companion screens 7 and 8 answered (Q34-Q42); copy approved as proposed [p5 Q42].

Parent docs: `docs/architecture/10-spec.md` 2 (rules 7 to 9), 3.7 Attendance and individual lessons, 3.8 Prices, subscriptions, payments; `07-strapi-mapping.md`; `13-roadmap.md` (phase 5); diagrams `03b`, `03c`, `04c`, `04d`, `05c`, `02f`, `02g`. Builds on `2026-10-27-groups-schedules-design.md` (P4), `2026-10-27-personal-data-design.md` (P3C) and `2026-10-26-athletes-registrations-design.md` (P3). Research: `.superpowers/phase5/research.md` (D1-D74 decided, P1-P12 proposed). Companion answers: `.superpowers/phase5/answers.md` (Q1-Q33, 2026-10-27). Companion screens: `.superpowers/phase5/screens/p5-1-prezenta.html` to `p5-6-inactivitate-migrare.html`.

Precedence: the user's companion answers of 2026-10-27 win over everything below them; then a dated entry in `edusport_frontend/docs/portal/DECISIONS.md` (a later dated entry wins over an earlier one); then the research proposals; then older mockups [P4 header; DEC 2026-10-26 3b Q31]. Where this file departs from `10-spec.md`, the decision that causes it is cited.

Citation keys:
- `[p5 Qn]`: companion answer n (1 to 42) in `answers.md` (Q34-Q41 on screen p5-7, Q42 = the copy of p5-8-copy.html); the screen text of that question in `p5-*.html` is the approved copy where it says so.
- `[p5 scr n]`: the "Already decided" box or a mockup of companion screen n (1 to 6).
- `[R Dn]`, `[R Pn]`: research item (decided n, proposed n), with the DECISIONS source named there.
- `[DEC <date> <id>]`: DECISIONS entries; `[DEC undated]` = the undated "Decided" / "Proposed" blocks (2026-10-01 to 2026-10-03).
- `[P4 x]`, `[P3C x]`, `[P3 x]`: earlier specs. `[SPEC x]`: `10-spec.md`. `[code]`: current code on `feat/athletes`, file named.
- `[C n]`: decided by Claude (low impact) while writing this file, listed in section 15. Every C entry is for the user to overrule.

Copy convention (as P3, P4): quoted copy is the exact UI text; "->" in quoted copy is the arrow the UI shows; `<name>` marks a value. Romanian, terse, no em dash, no middle dot, straight quotes "...", no emoji [DEC 2026-10-27 polish 3; DEC 2026-10-26 gaps 1]. Every visible string in this file is approved: from the companion screens and DECISIONS, or from `p5-8-copy.html` [p5 Q42] (the user may still update lines later; the copy module is the single place to change them).

## 1. Intent and goals

Replace the coaches' Google Sheet for the admin: every group session and individual lesson is recorded in the panel, Școala de patinaj abonamente are sold and used up slot by slot, Club groups and individual lessons are billed after training per month, every payment is recorded once and adds up, and the admin sees who still owes. Coaches and parents get their own logins later (phases 6 and 7); phase 5 builds the data and the admin screens they will read.

Success:
- The admin opens "Prezență", sees today's sessions of every group and the past sessions nobody filled in, and fills one in a Drawer the same way the coach will (list starts empty, ticks, counter, "Salvează") [p5 Q1, Q3; DEC 2026-10-18 coach-q3-ticks].
- A Școala attendance uses one slot of the athlete's abonament (the one expiring first), shows "Fără abonament" when none is valid, and a new abonament can cover those attendances afterwards [p5 Q9; DEC 2026-10-18 flows-v1 (1)].
- "Prelungește abonamentele" extends every active Școala abonament by X weeks in one confirmed step [p5 Q7; DEC 2026-10-19 build-q2].
- A Club athlete's month shows sessions by type, amount due at the price of the day, paid and remaining, on the athlete's "Plăți" tab and on "De încasat" [p5 Q13, Q14; DEC 2026-10-19 money-q2-due].
- Every payment is in "Plăți" with its purpose; a membership fee sets A.C.S. "Da" for its season; mistakes are corrected with history or cancelled, never deleted [p5 Q18-Q23].
- "Pe antrenori" gives each coach's group sessions, individual lessons and hours for a month, with CSV [p5 Q24, Q25; DEC 2026-10-19 coach-q6-hours].
- The 3C inactivity rule, delete, merge and anonymize take attendance, abonamente and payments into account [p5 Q28-Q30].

## 2. Scope

### 2.1 In scope
- Data: sessions, attendance, individual lessons, subscriptions, payments, the price item kind "uscat", the "Plată înregistrată" e-mail job, the attendance start date setting (3).
- Admin screens (5): menu entries; "Prezență" page with tabs "Ședințe" / "Lecții individuale" / "Pe antrenori"; session panel; "+ Ședință nouă"; individual lesson window and panel; group page tab "Prezență"; athlete record tabs "Grupe și abonament" and "Plăți"; "Adaugă abonament"; "Abonamente" list with "Prelungește abonamentele"; "Plăți" list with "+ Plată", edit and "Anulează plata"; "De încasat"; the abonament bar in the P4 move window; Sportivi "Abonament" column and filter; delete refusal; "uscat" in Prețuri; the start date in Setări site.
- Rules (4), routes (6), locks and undo (7), history (8), e-mail (9), copy module (10), tests (11), deploy (12).
- Changes to 3C: inactivity input, anonymize, delete, merge and the personal data export (4.20, 4.21, 4.21a).

### 2.2 Non-goals
- Coach login and the coach app (Azi, Grupe, Istoric, coach corrections until month end): phase 6 [R D60; DEC 2026-10-18 coach-q1-nav]. Phase 5 only exposes the data the coach screens will read (abonament status per athlete, sessions per coach).
- Parent login, the digital ticket, the parent's month total: phase 7 [R D74; DEC 2026-10-11 user].
- Online card payment, provider, "Confirmare de plată": later [DEC 2026-10-19 money-q4-doc, money-q5-online].
- Invoices, receipts or any generated payment document: payments are only recorded [DEC 2026-10-19 money-q4-doc]. The undated "every payment gets an invoice" block is superseded.
- Discounts [DEC 2026-10-19 user].
- Rink settlement tracking: only the tick "Încasat la patinoar" [p5 Q21].
- Import from the coaches' Google Sheets: none; the club starts from a chosen date [p5 Q31]. The Sheets are never edited [DEC undated].
- Forwarding to her Apps Script, admin roles, reminders (abonament, amount due, attendance not done) [DEC 2026-10-19 notif-q1-emails; R D73].

### 2.3 Anti-goals (things this phase must not do)
- Never delete or silently change a money row: payments are cancelled and corrected with history; an athlete with payments or abonamente cannot be deleted [p5 Q23, Q29].
- Never re-price the past: abonament item and price frozen at purchase, Club and lesson prices frozen when the presence is saved; a later price list change touches nothing recorded [R D31, D37; p5 Q27].
- Never compute abonament validity from the calendar: start date + 4 weeks, extended only by the manual action [DEC 2026-10-19 user].
- Never put presence or billing on the public website or in a public API [SPEC 5].
- Never send an e-mail the admin did not tick [p5 Q22].
- No spreadsheet look on the group page: a list of sessions, not a roster grid with per-child month counts [DEC 2026-10-11 prezenta-tab-v1].
- No pills, no circles, no dashed or dotted lines in the new screens [P4 11].

## 3. Data model

All new collection types: `draftAndPublish: false`, hidden from the Content Manager (`pluginOptions.content-manager.visible: false`), core routers closed to the Public role (as P4 8.3). Dates are `date` (YYYY-MM-DD), times are strings "HH:mm", amounts `decimal` in RON. Relations to athletes, groups, seasons and team members are `manyToOne` unless stated. Names below are exact.

### 3.1 Session (`api::session.session`, table `club_sessions`) [R D7, D8, D20; SPEC 3.7]
A group session that has been saved at least once. A planned or undone session is not a row: it is a group occurrence (3.9) without a session [C1].
- `group` (required), `season` (required; the season containing `date`, 3.9).
- `date` (date, required), `startTime` (string, required), `durationMin` (integer, required, 5 to 600).
- `source`: enumeration `schedule | added`, required [R D7].
- `event`: manyToOne `api::calendar-event.calendar-event`, set for `schedule`, null for `added`.
- `occurrenceKey`: string, `unique: true`, `"<event documentId>|<date>|<startTime>"` for `schedule`, where date and time are the ones the class actually takes place (for a moved date: the NEW date and time); null for `added` [R D20; C2; C72]. The occurrence's `originalDate` / `originalStartTime` (P4) are used only to find the series exception, never to match a session.
- `outsideSchedule`: boolean, default false; true for an `added` session on a date where the group has no held occurrence ("În afara programului") [DEC 2026-10-19 coach-schedule-app-v3].
- `coaches`: manyToMany `api::team-member.team-member` [R D5].
- `savedBy` (string, admin display name, like `history-entry.actor`), `savedAt` (datetime), `firstSavedAt` (datetime).
- Attendance rows: 3.2. The session row stays when every tick is removed (a saved session with 0 present) [C3].

### 3.2 Attendance (`api::attendance.attendance`, table `club_attendances`) [R D1, D4, D6, D7]
One row per athlete present at a session. No row = not present; there is no "Absent" [R D1; DEC 2026-10-18 coach-q3-ticks].
- `session` (required), `athlete` (required).
- `uniqueKey`: string, `unique: true`, `"<session documentId>|<athlete documentId>"` [C2].
- `grup` (boolean), `uscat` (boolean); at least one is true (service check). Școala sessions write `grup` only [p5 Q2].
- `visitor`: boolean; true when the athlete had no membership in the session's group on that date ("Adaugă doar la ședința asta") [R D13].
- `subscription`: manyToOne `api::subscription.subscription`, the Școala slot used, null otherwise [R D30].
- `billing`: enumeration, required [C4]:
  - `slot`: Școala, a subscription slot is used;
  - `fara_abonament`: Școala, no valid subscription ("Fără abonament"); can be covered later (4.9);
  - `club`: Club, at least one ticked type has a price;
  - `inclus`: Club, at least one line is "inclus" and none is billed; an included line keeps its price [5-1 decided 9];
  - `fara_pret`: Club, the group has no price list (4.12), or nothing is billed and nothing is included [5-1 decided 9].
- `charges`: json, frozen at save, `[{ type: "grup" | "uscat", itemName: string, price: number | null, included: boolean }]`; empty for Școala [R D37; C5].
- `amount`: decimal, the sum of `charges[].price` that are not included and not null; 0 otherwise.
- `audience`: enumeration `member | nonMember`, frozen at save (A.C.S. of the session's season, 4.13).

### 3.3 Individual lesson (`api::individual-lesson.individual-lesson`, table `club_individual_lessons`) [R D61-D63; DEC undated]
A one-to-one lesson, coach and one athlete; it carries its own presence (no attendance row) [C6].
- `athlete` (required), `date` (required), `startTime` (required), `durationMin` (integer, required, default 50, 5-minute steps) [DEC undated].
- `coaches`: manyToMany team-member [R D5].
- `state`: enumeration `planned | saved`, required. `present`: boolean, null while planned.
- `priceList` (manyToOne price-list: the current list of the athlete's main group on the lesson date, null when none), `itemName` (string), `price` (decimal, null when no price), `audience` (`member | nonMember`), a snapshot taken at the first save with `present` true [p5 Q27; C73].
- `amount`: decimal, `price` when present and priced, else 0.
- `createdByName`, `savedBy` (strings), `savedAt` (datetime).

### 3.4 Subscription (`api::subscription.subscription`, table `club_subscriptions`) [R D23-D35; SPEC 2 rule 7]
A Școala abonament bought by an athlete.
- `athlete` (required), `season` (required, the season containing `startsOn`).
- `priceList` (required, the list the item came from), `validIn`: manyToMany price-list, the other lists it was carried to by a move (4.11) [p5 Q10].
- `itemName` (string, required, frozen), `price` (decimal, frozen), `audience` (`member | nonMember`, frozen), `slots` (integer, required, the item's `sessions`, 6 or 8) [R D31; p5 Q11].
- `startsOn` (date, required), `validUntil` (date, required) = `subscriptionValidUntil(startsOn, extendedWeeks)` of `src/club/subscription.ts` (last valid day = start + 27 days + 7 per extra week) [code].
- `extendedWeeks`: integer, default 0.
- `cancelled`: boolean, default false; `cancelledAt`, `cancelledBy` [p5 Q40].
- `purchasedAt` (datetime), `recordedBy` (string).
- Used slots = count of attendance rows with this `subscription`; not stored [C7].
- State, derived [R D32]: `activ` (not cancelled, used < slots, today <= validUntil); `epuizat` (used >= slots); `expirat` (used < slots, today > validUntil); `anulat` (cancelled).

### 3.5 Payment (`api::payment.payment`, table `club_payments`) [R D44, D45, D49; p5 Q19]
- `athlete` (required).
- `amount` (decimal, required, > 0), `method`: enumeration `numerar | card | transfer`, required [DEC 2026-10-06 Q7].
- `paidOn` (date, required, not after today).
- `purpose`: enumeration `abonament | cotizatie | club_luna | lectie | altceva`, required ("Pentru") [p5 Q19].
- `subscription` (purpose `abonament`), `lesson`: manyToOne individual-lesson (purpose `lectie`), `clubMonth`: string "YYYY-MM" (purpose `club_luna`).
- `season` (required): the chosen season for `cotizatie` [DEC 2026-10-19 membership-season-v1]; for every other purpose the season containing `paidOn` (3.9).
- `collectedAtRink`: boolean, default false ("Încasat la patinoar"), only with purpose `abonament` [p5 Q21; C8].
- `note`: text, optional.
- `sendEmail`: boolean, default false; `emailJob`: manyToOne email-job [p5 Q22].
- `acsBefore`: enumeration `da | nu | in_asteptare`, nullable: the A.C.S. state of `season` before a `cotizatie` payment set it to Da (for the revert in 4.17) [C9].
- `recordedBy` (string), `recordedAt` (datetime).
- `cancelled`: boolean, default false; `cancelledAt` (datetime), `cancelledBy` (string) [p5 Q23].

### 3.6 Price item kind "uscat" (component `club.price-item`) [p5 Q12]
- `kind` enum becomes `subscription | session | individual | uscat`; `PRICE_ITEM_KINDS` in `src/club/price-item.ts` and `KIND_LABELS` in `src/admin/pages/preturi/format.ts` gain it.
- Label in Prețuri: "Uscat" [C10] (the companion table shows the type as "uscat"; the existing labels are capitalised, "Ședință", "Lecție individuală").
- `included` ("inclus") is kept and used: an included item is recorded, shown "inclus", never billed [p5 Q17].
- Public reads (`/api/club/public`, website Prețuri, form) leave out `uscat` items; a test pins it [C11].

### 3.7 E-mail job (`api::email-job.email-job`)
- `kind` enum gains `payment`; new `payment`: manyToOne payment. `payload` json `{ athleteName, amount, method, paidOn, purposeText }`; `notBefore` = now + 15 seconds so the toast's "Anulează" can cancel it (P4 W7 pattern) [p5 Q22; C12].

### 3.8 Setting: attendance start date [p5 Q31]
- Site settings (`api::site-settings.site-settings`, next to `personalData`) gains `attendanceStartDate` (date, nullable).
- Before this date nothing is "nefăcută", no Club billing is listed in "De încasat", and the Prezență page does not list undone sessions [C13]. Sessions can still be saved for earlier dates by choice (the admin may back-fill).
- Null (not set): the Prezență page shows the notice of 5.2 and lists no undone sessions.
- Setări site field label "Prezență și plăți din", hint "Ședințele dinainte nu apar ca nefăcute." [p5 Q42].
- Value at go-live: the 1st of the month after deploy [p5 Q38].

### 3.9 Derived, no table
- Group occurrence: a P4 admin occurrence (`expandOccurrences`, `src/api/calendar-event/services/expand.ts`) of an event linked to an active group, status `scheduled` or `override` (held). Cancelled ones (exception or break) produce no session [R D9; P4 3.3-3.5].
- Session state on lists [R D8; p5 scr 1]: "salvată" (a session row exists); "urmează" (no row, date today or later); "nefăcută" (no row, date before today, on or after `attendanceStartDate`). Cancelled dates are not listed [C14].
- Season of a date: the season whose `startMonth`..`endMonth` (first to last day of those months) contains it; else the latest season starting before it; else none [C15].
- Membership on a date: a group membership with `from` <= date (or null) and `to` null or >= date [P4 3.2].
- Club month of an athlete (4.14) and "Pe antrenori" (4.3): computed on read.

### 3.10 Indexes and uniqueness
- Unique: `club_sessions.occurrence_key`, `club_attendances.unique_key` (schema `unique: true`; Postgres allows many nulls) [C2].
- Service checks inside the transaction (with the row locks of 7): one attendance per athlete per session; one `schedule` session per occurrence; a duplicate insert caught by the unique index answers 409 "Prezența s-a schimbat între timp. Reîncarcă." [p5 Q42].
- New migration `database/migrations/2026102801_phase5_indexes.js` (the folder exists) adds b-tree indexes: `club_sessions(date)`, `club_individual_lessons(date)`, `club_payments(paid_on)`, `club_subscriptions(valid_until)`; join tables get Strapi's own indexes [C16].

### 3.11 History subjects
New `subjectType` values in `src/club/subjects.ts`: `session`, `lesson`, `subscription`, `payment`; lines in 8 [SPEC 2 rule 9].

## 4. Rules

### 4.1 Presence types [R D1-D6; p5 Q2]
- Group session columns "Sportiv" | "Grup" | "Uscat"; at Școala only "Sportiv" | "Grup". Present = any type ticked; nothing ticked = not present, no row [p5 scr 1].
- Uscat is a per-athlete tick on the group session, not a session of its own [p5 Q2].
- Individual is a separate lesson (3.3), never a tick on a group session [R D4].
- The list starts empty; a forgotten tick = absent, no slot used [DEC 2026-10-18 coach-q3-ticks; p5 Q3].

### 4.2 Coaches per session [R D5; p5 Q25]
- Every session and lesson has "Antrenor"; "+ Adaugă alți antrenori" adds one more field per coach. A stand-in is the same field set to another coach.
- Admin default for a new session: the group's coaches, one field each, in their order; for a lesson: the athlete's main group's first coach, else empty [C17].
- At least one coach is required to save: "Alege antrenorul." [p5 Q42].

### 4.3 Hours and "Pe antrenori" [R D22, D58; p5 Q24, Q25]
- Counted from saved rows only. A session counts for every coach in its `coaches` with its full `durationMin` (several coaches each get the full duration) [p5 Q25].
- A session with 0 present does not count; a lesson counts only when `present` is true [C18].
- "Ore" = minutes / 60, one decimal, comma ("21,5"); a coach is listed when the month has at least one counted session or lesson; sorted by name. No amounts [DEC 2026-10-19 coach-q6-hours].

### 4.4 Sessions from group occurrences [R D9, D20; P4 3.3]
- Every held occurrence of an active group's event is a planned session; two intervals a day are two sessions.
- First "Salvează" creates the session row (`source` `schedule`, `event`, `occurrenceKey`, `durationMin` = occurrence end - start); later saves correct it (4.18).
- Matching: a held occurrence matches a saved session only by `occurrenceKey` built from the date and time it takes place (3.1) [C72].
- A date cancelled or moved on the Program tab after its session was saved: the saved session stays on its old date and time, shown "În afara programului" (`outsideSchedule` recomputed on read: no held occurrence of the group at that date and time). A moved date is a new planned session on its new date, to fill like any other; Școala ticks on both use two slots, which the admin corrects by unticking one [C19; C72].

### 4.5 "+ Ședință nouă" (after the fact) [p5 Q4, Q5; DEC 2026-10-11 user; R D10-D12]
- Started from the Prezență page or from the group tab "Prezență" (group preselected) [p5 Q4].
- Fields "Grupă", "Data", "Ora", "Antrenor", plus "Durată" (default the duration of the group's series running on that weekday, else 50 min; Select 15 to 240 min by 5 as P4 6.3) [p5 scr 1 (Q4 fields); C20].
- Not on the website; no calendar event is written [DEC 2026-10-11 user].
- When the group has a held occurrence on that date at that time with no session: the panel opens that occurrence (a `schedule` session) instead of an added one [C21].
- When the group already has a saved session that date: warning "Există deja o ședință salvată" (with the saved session's time, "x din y" and "Salvată de <admin>") and buttons "Deschide prezența salvată" / "Adaugă încă o ședință în ziua asta"; same date and same time: only "Deschide prezența salvată" [DEC undated (date warning); p5 Q5].
- No group: not allowed; a session always belongs to a group [p5 Q4 A over C].

### 4.6 Out-of-schedule sessions [DEC 2026-10-19 coach-schedule-app-v3]
- An added session on a date with no held occurrence of its group shows "În afara programului" in the group tab and on the Prezență page, and never on the website.

### 4.7 Visitors [R D13; p5 Q16]
- "+ Adaugă doar la ședința asta" adds an athlete who is not on the group's list on that date to this session only: `visitor` true, no membership, the main group unchanged, kept in history [DEC 2026-10-11 prezenta-questions-v1 (2)].
- Under a visitor's name: the main group of the season [SPEC 3.7; R P10].
- Billing: in a Club group, the visited group's prices (4.12); in a Școala group, a slot of the visitor's own abonament when valid for that group's list (4.10), else "Fără abonament" [p5 Q16].
- Anonymized athletes are never offered; an inactive athlete: 4.22.

### 4.8 Școala abonament: slots and expiry [R D23-D26, D30; p5 Q11]
- Prepaid, 6 or 8 slots; the two differ only in the slot count [p5 Q11].
- Each Școala attendance with "Grup" uses one slot; an extra session the same day uses another [DEC 2026-10-03].
- Validity: `startsOn` + 4 weeks minus 1 day is the last valid day ("Expiră pe 23 nov 2026" for a start on 27 oct), an estimate; never from the calendar [DEC 2026-10-19 user; code subscription.ts; p5 Q36].
- After `validUntil` unused slots are lost [R D26].
- Registration confirmation creates no subscription [DEC 2026-10-05].
- An attendance without a valid abonament (`fara_abonament`) is never billed on its own: it waits to be covered by a new abonament (4.9); a single session paid on the spot is recorded as a payment "Altceva" [p5 Q39].

### 4.8a "Anulează abonamentul" [p5 Q40]
- For an abonament added by mistake, after the 8 s undo: the row stays with `cancelled` true (state `anulat`), never deleted; the attendance rows that used its slots lose the link and become `fara_abonament` ("Fără abonament"); they can be covered again (4.9).
- Not offered while a non-cancelled payment points to it (cancel the payment first) [p5 Q40; C75].
- Locks: the athlete, then the subscription (7.1). Undo from the toast restores the links (7.3).

### 4.9 Adding an abonament and covering earlier attendances [p5 Q8; DEC 2026-10-18 flows-v1 (1); DEC 2026-10-06 open-questions-v2 (5)]
- Any admin; from the athlete tab, the Abonamente list and the session panel [R D28, D56].
- Item: `subscription` items of a Școala list, offered to the athlete's audience on the start date (A.C.S. of the season of `startsOn`, 4.13; `offeredItems`) [DEC 2026-10-20 phase2-q4-gold]. The list: the athlete's main school group's list on the start date; with no school group, every school list (list name as option hint) [C22].
- Frozen: `itemName`, `price` (audience price), `audience`, `slots` [R D31].
- Coverage: the athlete's attendances with `billing` `fara_abonament` in groups whose list the new subscription is valid for, any date, oldest first; ticked by default up to the slot count; more ticks than slots are refused (box disabled) [C23]. Covered rows get `subscription` and `billing` `slot`.
- Optional payment in the same step (4.15) [p5 Q8].

### 4.10 Which abonament a Școala attendance uses [p5 Q9, Q10]
On save, for each Școala attendance without a slot yet, the candidates are the athlete's subscriptions that are not cancelled, valid for the session group's list (`priceList` or one of `validIn`), with `startsOn` <= date <= `validUntil` and used < slots; the one with the earliest `validUntil` is used, then the earliest `startsOn`, then the earliest `purchasedAt` [p5 Q9; C24]. None: `billing` `fara_abonament`.
- A row that already has a slot keeps it on a re-save; unticking deletes the row and frees the slot [C25].
- Abonament status for an athlete on a date (shown under the name in Școala sessions, exposed for the coach app): "<n> ședințe rămase" for the subscription 4.10 would use, else "Fără abonament" [DEC 2026-10-18 coach-q2-money]. Number forms: "1 ședință rămasă" [DEC 2026-10-26 gaps 10 (number forms)].

### 4.11 Standard vs Gold [p5 Q10; DEC 2026-10-10 user (Gold move)]
- A subscription works in groups on its own list; groups on the same list share it [DEC 2026-10-10 main-group-v1].
- A Standard abonament keeps working after a move to Avansați Gold; a Gold abonament does not work in Standard groups [p5 Q10].
- Mechanism [p5 Q35; C26]: on "Mută" from a school group to a school group on another list, each active subscription of the athlete valid for the old list is carried (the new list is added to `validIn`) when the subscription's frozen price is lower than the new list's price for a `subscription` item with the same slot count and audience, or when the new list has no such price yet. Gold -> Standard is never carried because the Gold price is higher. The carry is what makes the move window show "Abonamentul actual rămâne valabil. Următorul, la prețul Avansați Gold." [DEC 2026-10-10 move-modal-v3 Q2 B].
- The next abonament is bought from the new group's list (4.9) [DEC 2026-10-10 user].

### 4.12 Club billing [DEC 2026-10-19 money-q2-due; R D36, D37; p5 Q12, Q15, Q16, Q17]
- Club groups (section kind `club`) are paid after training. On save, each attendance's ticked types are priced from the session group's price list as it is at that moment: "Grup" -> the list's first `session` item, "Uscat" -> its first `uscat` item [C27].
- Price = member price with A.C.S. "Da" for the session's season, else non-member price (4.13). Both ticked = both charged [C28].
- Not billed, presence still recorded [p5 Q15, Q17; DEC undated "Proposed price lists"]:
  - group without a price list: `fara_pret`;
  - item missing, or its price for the audience missing: that line `price` null;
  - item marked "inclus": line `included` true, shown "inclus", price kept on the line, not billed;
  - billing word [5-1 decided 9]: `inclus` when at least one line is included and none is billed; an included line keeps its price; `fara_pret` (shown "fără preț") when nothing is billed and nothing is included.
- Frozen: a later price list change or A.C.S. change does not re-price saved attendances; a membership fee paid mid-month leaves the month's saved sessions at the non-member price, member price from the next saved session on [p5 Q41]; a correction (4.18) prices only rows it adds or whose ticks it changes [R D37; C29].
- Price source (attendance, lesson, abonament alike): the group's price list as it is at the moment of saving (`group.priceList` has no history); each row stores the price it was billed at (snapshot). A row saved later for a past date (back-fill, coverage, a past lesson) uses the current list too; there is no price-list history [C73].
- Notice while any active group of the current season has no price list: "<n> grupe fără listă de prețuri: prezența se înregistrează, nimic nu se calculează." ("1 grupă fără listă de prețuri: ...") on "De încasat" and on the Prezență page [p5 scr 3 Q15; C30].

### 4.13 Audience (member / non-member) [DEC 2026-10-19 money-q1-member, membership-season-v1]
- `member` only when the athlete's A.C.S. state for the season of the date is "Da"; else `nonMember` (`usesMemberPrice`, `src/club/acs.ts`).

### 4.14 Monthly settlement and "De încasat" [p5 Q13, Q14; DEC 2026-10-19 money-q2-due]
Per athlete per calendar month (Club month = month of the session or lesson date):
- Ședințe: count of Club attendances by type (Grup ticks, Uscat ticks) and of present individual lessons.
- De plătit: sum of `amount` of those Club attendances and lessons.
- Plătit: sum of non-cancelled payments with purpose `club_luna` and `clubMonth` = that month, plus non-cancelled `lectie` payments of lessons dated in that month [C31].
- Rămas: De plătit - Plătit (may be negative after an overpayment; shown with "-") [C32].
- A payment is for a month and allocated to that month's due; never tied to single sessions [p5 Q14].
- Months before `attendanceStartDate` are not listed [C13].
- Școala part [p5 Q34]: every subscription not cancelled whose frozen `price` minus its non-cancelled `abonament` payments is more than 0, whatever month it was bought in; Preț, Plătit, Rămas per subscription. A subscription with no price (`price` null) is not listed [C76].

### 4.15 Payments and "Pentru" [p5 Q18, Q19; DEC 2026-10-06 Q7]
- Any admin records a payment from "Plăți", the athlete tab "Plăți", "De încasat" (row) and the session panel (row) [p5 Q18; DEC 2026-10-19 admin-q1-roles].
- Fields: Sportiv, Sumă, Data, Metodă ("Numerar" / "Card (POS)" / "Transfer bancar"), Pentru, "Încasat la patinoar", "Trimite e-mail "Plată înregistrată"", Notă [p5 scr 4 Q19].
- "Pentru" options and default amounts [p5 scr 4 Q19; C33]:
  - abonament: the athlete's subscriptions not cancelled, newest first, "<itemName> (activ din <data>)"; amount = frozen price minus non-cancelled payments for it;
  - cotizație membru: "Cotizație membru <sezon>", every season, default current; amount = the season's `membershipFee`;
  - lună Club: "Club, <lună>" for the athlete's months with a Club or lesson due in the last 12 months and the current month; amount = Rămas of that month (not below 0);
  - lecție individuală: the athlete's present, priced lessons of the last 12 months, "Lecție individuală, <data>"; amount = price minus paid;
  - altceva: no link; amount empty.
- The amount can always be changed; a payment may be partial or larger than the due.

### 4.16 Membership fee sets A.C.S. [p5 Q20; DEC 2026-10-19 money-q1-member]
- A non-cancelled `cotizatie` payment sets A.C.S. "Da" for its season (creates or updates `acs-membership`), in the same transaction; `acsBefore` keeps the old state; history line "Membru A.C.S. <sezon>: <vechi> -> Da" (existing P3 line) [code history-text.ts].
- Already "Da": nothing changes, `acsBefore` = "da".

### 4.17 Corrections and "Anulează plata" [p5 Q23]
- "Editează" changes Sumă, Data, Metodă, Pentru, "Încasat la patinoar", Notă; never Sportiv (cancel and record again) [C34]. Each changed field goes to history old -> new (8).
- "Anulează plata": the row stays, `cancelled` true, struck through with "anulată", ignored by every total and default [p5 Q23].
- Cancelling or re-purposing a `cotizatie` payment: when no other non-cancelled fee payment of that season remains and A.C.S. of that season is still "Da", A.C.S. goes back to `acsBefore` with the history line [C9].
- No e-mail on edit or cancel [C12].

### 4.18 Attendance corrections [R D14, D17]
- The admin can open and change any saved session or lesson at any time; each save after the first writes one history line listing the changes (8) [DEC 2026-10-11 prezenta-questions-v1 (3)].
- Removing a tick deletes the row (slot freed); adding re-runs 4.10 / 4.12 for that row only.
- A lesson or attendance referenced by a non-cancelled payment can still be corrected; the payment is not changed [C35].

### 4.19 "Plată înregistrată" e-mail [p5 Q22; DEC 2026-10-19 notif-q1-emails]
- Off by default; the admin ticks it per payment. Sent to the athlete's contact e-mail; without an e-mail the box is disabled with hint "Sportivul nu are e-mail." [C36; p5 Q42]. Text: 9.

### 4.20 Inactivity (3C) [p5 Q28; P3C 5; code inactivity.ts]
- `lastActiveYears` input gains `attendances` (athlete, session date or lesson date with `present` true), `payments` (non-cancelled, `paidOn`) and `subscriptions` (`startsOn`), each turned into a season by 3.9 [p5 Q28].

### 4.21 Delete, merge, anonymize [p5 Q29, Q30; DEC 2026-10-26 s9, d39; DEC 2026-10-27 3C 2]
- Delete is refused while the athlete has any payment (cancelled ones too) or any subscription; the dialog of 5.14 offers anonymize instead [p5 Q29; C37].
- Otherwise delete removes the athlete's attendance rows (sessions stay, counts drop) and individual lessons, with the existing P3 steps [p5 Q29].
- Merge moves attendance, lessons, subscriptions and payments to the kept athlete; when both are present at one session, one row is kept with the union of ticks and the slot of the kept athlete's row, else the other's (the freed slot returns) [p5 Q29; C38].
- Anonymize keeps payments (amount, date, method, season, purpose, links), attendance, lessons and subscriptions; clears payment `note`; scrubs the payment e-mail jobs as the existing jobs (P3C 4) [p5 Q30].

### 4.21a Personal data export (3C) [P3C; DEC 2026-10-27 3C 1, 6; C74]
- "Exportă datele" (`src/club/personal-data/export-service.ts`, `summary-model.ts`, `summary-pdf.ts`) includes the child's attendance, individual lessons, abonamente and payments (GDPR access), all dates, cancelled payments included and marked.
- Summary PDF gains four sections after the existing ones; headings and row formats [p5 Q42]:
  - "Prezență": "<data>, <grupă>, <ora>, Grup" (or "Uscat", "Grup, Uscat"), "27 oct 2026, Intermediari Bronze, 17:00, Grup"; visitor rows end with ", doar la ședința asta"; never another child's name [DEC 2026-10-27 3C 1];
  - "Lecții individuale": "28 oct 2026, 18:00, 50 min, antrenor Virgil Pascu, prezent, 80 RON" (absent: "absent", no amount);
  - "Abonamente": "Abonament 8 ședințe, din 27 oct 2026, expiră pe 23 nov 2026, 5/8, activ, 320 RON";
  - "Plăți": "27 oct 2026, 320 RON, Numerar, Abonament 8 ședințe, la patinoar" (", la patinoar" only when ticked; a cancelled row ends with ", anulată"); notes included.
- Empty section: "Nimic înregistrat." [p5 Q42].
- Tests: summary model sections, no other athlete named, cancelled marked.

### 4.22 Reactivation by attendance [p5 Q33]
- Saving a session that ticks an Inactiv athlete asks the admin: title "Sportiv inactiv", text "<nume> are statusul Inactiv. Reactivezi sportivul?", buttons "Salvează fără" / "Reactivează și salvează" [p5 Q42]. Reactivating sets Activ with the P3 line "Reactivat" [DEC 2026-10-18 states-v2].

### 4.23 New season [p5 Q32]
- Nothing is copied or closed: active subscriptions keep working across the season change (their `season` stays the purchase season), Club months and their balances stay with the athlete. "Începe sezonul" (P4 10) is not changed.

### 4.24 Start without import [p5 Q31]
- No import of the Sheets; `attendanceStartDate` (3.8) is the 1st of the month after deploy [p5 Q38]; abonamente running on paper at that date are added with "Adaugă abonament" and their real start date when the club wants them tracked [p5 Q38].

## 5. Admin screens

All screens work at phone width: tables become cards, the Drawer becomes a full-screen sheet, filters use filters-v3 on desktop and the BottomSheet on phones, toasts with "Anulează" for 8 s and no X [R D55; DEC 2026-10-06 filters-v3; DEC 2026-10-10 aloca-v2 (a)]. Amounts are shown as "<n> RON" everywhere, like Prețuri ("320 RON", decimals with a comma, "12,50 RON") [p5 Q37; C39]. Dates in lists "Mar 27 oct", elsewhere "27 oct 2026" [p5 scr 1, 2].

### 5.1 Menu [p5 Q6, Q13, Q18; DEC 2026-10-10 aloca-v2 (c)]
"Club și școală": "Grupe", "Sportivi", "Prezență", "Abonamente", "Plăți", "De încasat" [C40 (order and De încasat as its own entry)]. Routes `/plugins/edusport-prezenta`, `/plugins/edusport-abonamente`, `/plugins/edusport-plati`, `/plugins/edusport-de-incasat`.

### 5.2 Prezență page [p5 Q1, Q24, Q26; p5 scr 1, 5]
- Title "Prezență". Tabs "Ședințe" | "Lecții individuale" | "Pe antrenori" [p5 scr 5].
- Notice when `attendanceStartDate` is not set: "Setează data de început a prezenței în Setări site." [p5 Q42].
- Notice of 4.12 when it applies.

Tab "Ședințe" (day page) [p5 scr 1 A]:
- Date line "Marți, 27 oct 2026" with "<", "Azi", ">" and a date picker; button "+ Ședință nouă" (primary).
- Section "Nefăcute din zilele trecute (<n>)": every undone occurrence (3.9) from `attendanceStartDate` to yesterday, newest first; columns "Data" | "Ora" | "Grupă" | "Antrenor" | "Stare"; Stare "nefăcută" in orange. Shown above the day whatever day is chosen; hidden at 0 [p5 scr 1 A; C41].
- Section for the chosen day: "Azi, marți 27 oct" for today; another day "<Zi>, <data>" ("Luni, 26 oct") [p5 Q42]. Columns "Ora" | "Grupă" | "Antrenor" | "Prezenți" | "Stare"; Prezenți "<x> din <y>" (x = present athletes on the group's list, y = the list on that date; visitors not counted) [C42]; Stare "urmează" / "salvată" / "nefăcută"; an out-of-schedule session adds "În afara programului" under the group name. Sorted by start time, then group order.
- Empty day: "Nicio ședință în ziua asta." [p5 Q42].
- Antrenor: the session's coaches, or the group's coaches when unsaved, joined by commas.
- A row opens the session panel (5.3).

Tab "Lecții individuale" [p5 Q26; p5 scr 5 A]:
- Month line "<" "Octombrie 2026" ">" (the same switcher as "Pe antrenori"), button "+ Lecție individuală" (primary).
- Columns "Data" | "Ora" | "Sportiv" | "Antrenor" | "Durată" | "Stare"; Durată "50 min"; Stare "urmează" / "salvată" / "nefăcută" (planned, date passed). Sorted by date and time. Row opens the lesson panel (5.5).
- Empty month: "Nicio lecție individuală în luna asta." [p5 Q42].

Tab "Pe antrenori" [p5 Q24; p5 scr 5 A]:
- Month line as above, button "Export CSV".
- Columns "Antrenor" | "Ședințe grup" | "Lecții individuale" | "Ore" (4.3). Empty: "Nicio ședință salvată în luna asta." [p5 Q42].
- CSV: same columns and header words, separator ";", UTF-8 with BOM, file `pe-antrenori-<YYYY-MM>.csv` [C43].

Phone: tabs scroll; rows are cards ("17:00 Intermediari Bronze", "Virgil Pascu, 6 din 9, salvată"); the panel opens full screen [DEC 2026-10-11 prezenta-tab-v1].

### 5.3 Session panel (Drawer) [p5 Q3 A; p5 scr 1; DEC 2026-10-11 prezenta-tab-v1]
- Title "<Grupă>, <ora>" ("Intermediari Bronze, 17:00"), subtitle "<Zi> <data>" ("Marți 27 oct 2026"); "În afara programului" under it when it applies.
- "Antrenor": one SearchableSelect per coach (Membri echipă), "+ Adaugă alți antrenori"; a removable extra field [R D5].
- Table "Sportiv" | "Grup" | "Uscat" (Club) or "Sportiv" | "Grup" (Școala); rows = the group's list on that date sorted by name, then visitors. Starts empty for an unsaved session; a saved one shows its ticks [p5 Q3].
- Under the name: Școala, the abonament status (4.10); visitor, the main group (4.7). Row "..." menu: "Adaugă abonament" (Școala) and "+ Plată" [R D56; p5 Q18; C44].
- "+ Adaugă doar la ședința asta": the athlete search of "Caută alt sportiv" (P3 4.1), anonymized left out, athletes already in the table left out; the picked athlete joins the table ticked "Grup" [DEC 2026-10-11 prezenta-questions-v1 (2); C45].
- Footer: "<x> din <y> prezenți" (visitors counted in neither, as C42) [p5 scr 1], "Închide" (ghost), "Salvează" (primary).
- Saved: a muted line "Salvată de <admin>, <data> <ora>" [DEC 2026-10-11 prezenta-tab-v1 ("Salvată de ...")].
- Toast after save: "Prezență salvată: <grupă>, <data>." ("Prezență salvată: Intermediari Bronze, 27 oct.") [p5 Q42], no "Anulează" (a save is corrected by saving again) [C46].
- Closing with unsaved ticks: "Închizi fără să salvezi?" with "Rămâi" / "Închide" [p5 Q42].

### 5.4 "+ Ședință nouă" window [p5 Q4; p5 scr 1]
- Modal (sheet on phones), title "Ședință nouă" [p5 Q42]; "Grupă" (SearchableSelect, active groups with the section hint; preselected and locked from the group tab), "Data" (default the Prezență page's day), "Ora", "Durată" (4.5), "Antrenor" (+ "+ Adaugă alți antrenori"); buttons "Anulează" / "Continuă" [p5 Q42].
- "Continuă" runs 4.5 (warning or the existing occurrence) and opens the session panel; the session row is written only by "Salvează".

### 5.5 Individual lessons [p5 Q26, Q27; DEC undated (lessons)]
- "+ Lecție individuală" opens the window "Lecție nouă" [DEC 2026-10-01 coach-mobile screen name]: "Sportiv" (athlete search), "Data", "Ora", "Durată" (default 50 min, 5-minute steps, Select as 4.5), "Antrenor" (+ "+ Adaugă alți antrenori"); buttons "Anulează" / "Salvează".
- A date in the future creates a planned lesson; today or earlier records it held (`state` saved, `present` true, priced) [C47].
- Lesson panel (Drawer), title "Lecție individuală, <ora>" [p5 Q42], subtitle "<Zi> <data>"; the athlete row with one tick (ticked by default on a planned lesson) [DEC undated], "Antrenor", "Durată"; footer "Închide" / "Salvează"; "Salvată de <admin>, <data> <ora>"; row "..." "+ Plată".
- Saving with the tick off: the lesson is saved as not held: no price, no hours, Stare "salvată", the athlete name muted [C48].
- A planned lesson, or a saved one without a non-cancelled payment, has a red link "Șterge lecția", confirmation "Ștergi lecția din <data>?", toast "Lecție ștearsă." with "Anulează" [C49; p5 Q42].
- Price: the `individual` item of the current price list of the athlete's main group on the lesson date, audience 4.13, a snapshot at the first save with present true (C73); no list or item: no price, shown "fără preț" on the Plăți tab [p5 Q27; p5 Q42].

### 5.6 Group page tab "Prezență" [DEC 2026-10-11 prezenta-tab-v1 B; P4 6.1; p5 Q4]
- Tabs become "Sportivi" | "Program" | "Prezență" | "Istoric" [DEC 2026-10-27 phase 4 mockups 2].
- Month switcher "<" "Octombrie 2026" ">", button "+ Ședință nouă" (group preselected).
- A list of the month's sessions (held occurrences and saved sessions), newest first: "Data" | "Ora" | "Prezenți" | "Antrenor" | "Stare", Prezenți "<x> din <y>" and, when > 0, "Din alte grupe: <n>" under it; Stare "nefăcută" (orange), "urmează", "salvată"; "În afara programului" under the date when it applies [DEC 2026-10-11 prezenta-tab-v1 B; C50 (column headers from p5 scr 1)].
- No roster table with per-child counts [DEC 2026-10-11 prezenta-tab-v1 B].
- Click opens the session panel (5.3). Past seasons are read-only (P4 W5): the panel opens without "Salvează".
- Empty month: "Nicio ședință în luna asta." [p5 Q42].

### 5.7 Athlete record tabs [R D54; p5 Q6, Q13; DEC 2026-10-05 members-v1]
Tabs: "Date" | "Grupe și abonament" | "Plăți" | "Profil public" | "Documente" | "Istoric" [C51]; an anonymized record keeps "Date" and "Istoric" only (as today) plus "Plăți" read-only [C52].

"Grupe și abonament" [p5 scr 2 Q6]:
- Groups of the selected season: heading "Grupe", rows "<grupă>, principală" / "<grupă>" [p5 Q42]; read-only, changed from Grupe [DEC 2026-10-10 main-group-v1].
- Abonament bar for each subscription that is `activ` [DEC 2026-10-10 move-v4 Q1 A]: title "Abonament Școala de patinaj, <n> ședințe" left (the frozen `itemName` when it differs from that pattern [C53]), "Expiră pe <data>" right muted, a bar of n segments (used = primary), "<n> folosite" left and "<n> rămase" right, small, muted [p5 scr 2]. None: "Fără abonament." [p5 Q42].
- "+ Adaugă abonament" (secondary) [p5 scr 2].
- Earlier subscriptions (epuizat, expirat, anulat): heading "Abonamente anterioare", rows "<itemName>, <data start> - <expiră>, <folosite>/<sloturi>, <stare>" ("Abonament 8 ședințe, 29 sep 2026 - 26 oct 2026, 8/8, epuizat") [p5 Q42].
- Attendance of the month: heading "Prezențe", month switcher, rows "<data>, <grupă>, <tipuri>[, Fără abonament]" ("Mar 20 oct, Intermediari Bronze, Grup, Fără abonament", the last part in orange, only for an uncovered Școala row) [C54; p5 Q42]. Rows open the session panel.

"Plăți" [p5 Q13 A]:
- Button "+ Plată" (primary) [p5 Q18].
- Month table: "Luna" | "Ședințe" | "De plătit" | "Plătit" | "Rămas", months with a Club or lesson due or a Club payment, newest first [p5 scr 3 Q13 (columns); C55]; Ședințe as "8 (6 grup, 2 uscat)" [p5 scr 3], with lessons "9 (6 grup, 2 uscat, 1 individuală)" [p5 Q42]. A row opens its detail: one line per attendance or lesson, "Mar 6 oct, Profesioniști, Grup 40 RON, Uscat inclus" [p5 Q42].
- Payments table: "Data" | "Pentru" | "Metodă" | "Sumă" | "Înregistrat de", newest first, cancelled rows struck with "anulată", row "..." "Editează" / "Anulează plata" [p5 scr 4].

### 5.8 "Adaugă abonament" window [p5 Q8 A; p5 scr 2]
- Modal (sheet on phones), title "Adaugă abonament, <nume>". From the Abonamente list "+ Abonament" opens the athlete search first [C56].
- "Abonament (lista <listă>)": Select of 4.9 items, option "<item>, preț membru" or "<item>, preț nemembru" [p5 scr 2].
- "Data de start" (default today), "Expiră (estimat)" computed, read-only.
- "Acoperă prezențe fără abonament (<n>)": checkbox rows "Mar 20 oct, Intermediari Bronze" (4.9); hidden at 0.
- Block "Plată": checkbox "Înregistrează plata acum" (off by default [C57]); when on: "Sumă" (default the frozen price), "Metodă", "Încasat la patinoar", "Trimite e-mail "Plată înregistrată"" (off); the payment date is today [C57].
- Buttons "Renunță" / "Adaugă abonament".
- Toast "Abonament adăugat: <nume>." / with payment "Abonament și plată înregistrate: <nume>." with "Anulează" [p5 Q42].
- No items for the athlete's audience: "Lista <listă> nu are abonamente pentru acest sportiv." [p5 Q42].

### 5.9 Abonamente list and "Prelungește abonamentele" [p5 Q6, Q7; p5 scr 2]
- Title "Abonamente", subtitle "Școala de patinaj"; buttons "Prelungește abonamentele" (secondary) and "+ Abonament" (primary).
- Filters "Stare" (options "Toate", "Active", "Epuizate", "Expirate", "Anulate"; default "Active") [p5 Q42] and "Grupă" ("Toate" and the school groups) [p5 scr 2].
- Columns "Sportiv" | "Grupă" | "Abonament" | "Folosite" | "Expiră" | "Stare": Grupă = the athlete's main group today; Abonament "8 ședințe"; Folosite "5/8"; Expiră "7 nov 2026", past dates in red text [DEC 2026-10-03 Proposed (Expiră column); R P6]; Stare "activ", "epuizat", "expirat", "anulat" [p5 scr 2; p5 Q42]. Sorted by Expiră ascending [C58]. Row opens the athlete record on "Grupe și abonament".
- Row "...": "Anulează abonamentul" [p5 Q40; p5 Q42], only on a row not `anulat`; hidden while a non-cancelled payment points to the abonament (cancel the payment first) [p5 Q40; C75]. No confirmation; effect 4.8a; toast "Abonament anulat." with "Anulează" [C75].
- "Prelungește abonamentele" opens the Modal "Prelungește abonamentele Școlii de patinaj": "Număr de săptămâni" (integer 1 to 12, default 1 [C59]), text "Se prelungesc <n> abonamente active cu <x> săptămâni. Noua dată de expirare se calculează pentru fiecare.", buttons "Renunță" / "Prelungește <n> abonamente" [p5 scr 2 Q7]. Number forms "1 abonament activ", "1 săptămână", "20 de abonamente active". n = subscriptions `activ` today on school lists; one that expired during the break is not extended [C77]. n = 0: the button is disabled.
- Effect: `extendedWeeks` += x, `validUntil` recomputed, one history line each (8), one action for undo. Toast "<n> abonamente prelungite cu <x> săptămâni." ("14 abonamente prelungite cu 2 săptămâni.") with "Anulează" [p5 Q42].

### 5.10 Plăți list and the payment window [p5 Q18-Q23; p5 scr 4]
- Title "Plăți", subtitle the chosen month ("Octombrie 2026"), button "+ Plată" (primary).
- Filters "Perioadă" (month, default current), "Metodă" ("Toate", "Numerar", "Card (POS)", "Transfer bancar"), "Tip" ("Toate", "Abonament", "Cotizație membru", "Club", "Lecție individuală", "Altceva") [p5 scr 4; C60 (Tip labels from the "Pentru" words)].
- Columns "Data" | "Sportiv" | "Pentru" | "Metodă" | "Sumă" | "Înregistrat de"; Pentru as "Abonament 8 ședințe", "Club, septembrie", "Cotizație membru 2026-2027", "Lecție individuală", "Altceva" plus the note's first words when present [p5 scr 4; C61]; a rink payment adds ", la patinoar" after the method ("Numerar, la patinoar") [p5 Q42]; cancelled rows struck through with "anulată" [p5 Q23]. Newest first.
- Month total under the table: "Total: <sumă>" ("Total: 840 RON"), cancelled rows left out [C62; p5 Q42].
- Row "...": "Editează", "Anulează plata" (red).
- Window "Plată nouă" (Modal; sheet on phones): "Sportiv" (athlete search; locked when opened from an athlete), "Sumă", "Data" (default today), "Metodă" (segmented "Numerar" / "Card (POS)" / "Transfer bancar", default "Numerar" [C63]), "Pentru" (4.15), "Încasat la patinoar" (only for abonament), "Trimite e-mail "Plată înregistrată"" (off), "Notă" (hint "Opțional"); buttons "Renunță" / "Înregistrează" [p5 scr 4 Q19].
- Opened from "De încasat" or the session panel, "Pentru" is preselected (the month, the abonament) [C33].
- Toast "Plată înregistrată: <sumă>, <nume>." ("Plată înregistrată: 320 RON, Ana Ionescu.") [p5 Q42] with "Anulează" (undo removes the row and cancels the queued e-mail; refused after a later change, 7.3).
- "Editează": the same window titled "Editează plata" [p5 Q42], without "Sportiv" and the e-mail box, button "Salvează"; toast "Salvat." / "Nicio modificare." [DEC 2026-10-26 plan 3-5].
- "Anulează plata": confirmation "Anulezi plata de <sumă> din <data>? Rândul rămâne, marcat anulată." with "Renunță" / "Anulează plata"; toast "Plată anulată." with "Anulează" [p5 Q42].
- Errors "Suma trebuie să fie mai mare decât 0.", "Data nu poate fi în viitor.", "Alege pentru ce este plata." [p5 Q42].

### 5.11 De încasat [p5 Q13 A, Q34 A; p5 scr 3; p5 scr 7]
- Title "De încasat", subtitle the month ("Octombrie 2026"), filter "Luna" (default current month) [p5 scr 7 Q34].
- Notice of 4.12 when it applies.
- Part "Școala de patinaj" first [p5 Q34]: columns "Sportiv" | "Grupă" | "Abonament" | "Preț" | "Plătit" | "Rămas"; Abonament = the frozen item name with "din <data>" under it ("Abonament 8 ședințe", "din 27 oct"); Grupă = the athlete's main group today; independent of "Luna"; sorted by start date; row "...": "+ Plată" with "Pentru" = that abonament [p5 scr 7 Q34].
- Part "Club", columns "Sportiv" | "Grupă" | "Ședințe" | "De plătit" | "Plătit" | "Rămas" (4.14); Grupă = the Club groups of the athlete's attendances that month, joined by commas; athletes with De plătit > 0 or a payment for that month; sorted by Rămas descending, then name [C64].
- Row opens the athlete record on "Plăți"; row "...": "+ Plată" with "Pentru" = that month.
- A part with no rows is hidden [C76]; both empty: "Nimic de încasat în luna asta." [p5 Q42].

### 5.12 Move window abonament bar [DEC 2026-10-10 move-v4 Q1 A, move-modal-v3 Q2 B, user (move-modal-final); P4 6.2]
- The P4 move window shows the bar of the subscription 4.10 would use today (title, "Expiră pe <data>", segments, "<n> folosite", "<n> rămase"); hidden when the athlete has none [DEC 2026-10-10 user].
- The line "Abonamentul actual rămâne valabil. Următorul, la prețul Avansați Gold." only when 4.11 carries the subscription to the target list; same-list and Club moves show the bar with no text [DEC 2026-10-10 user (move-modal-final)]. A move that does not carry (Gold -> Standard) shows the bar with no text [C26].
- The carry is written in the move's transaction and undone with it.

### 5.13 Sportivi list: "Abonament" [R D54; DEC 2026-10-26 phase3b s4]
- Column "Abonament" after "Grupa": "5/8, 7 nov 2026" for the subscription 4.10 would use today, blank when none [C65].
- Filter section "Abonament" in filters-v3: options "Toate", "Activ", "Fără abonament" [p5 Q42].

### 5.14 Delete refusal [p5 Q29 A; p5 scr 6]
- "Șterge sportivul" on an athlete with payments or subscriptions opens, instead of the delete confirmation: title "Șterge <nume>", text "Sportivul are <plăți> și <abonamente>. Ștergerea este blocată cât timp există plăți sau abonamente.", "Poți anonimiza sportivul în schimb: numele și datele personale se șterg, sumele plăților rămân.", buttons "Renunță" / "Anonimizează" [p5 scr 6].
- A part with 0 is left out with its "și" ("Sportivul are 1 abonament.") [C66]. "Anonimizează" opens the existing 3C anonymize window and shows only for a Super Admin; others see "Renunță" only [DEC 2026-10-27 3C 6; C67].

### 5.15 Prețuri: "uscat" [p5 Q12; p5 scr 3]
- The item Tip select gains "Uscat" (3.6). The item side panel and the "Preț incomplet" rule are unchanged [DEC 2026-10-19 phase2-designs-v1].

### 5.16 Setări site
- Field of 3.8 next to "Ani până la anonimizare" [C13].

## 6. Routes

All admin routes: config `{ auth: false, policies: ['global::is-admin'], middlewares: [] }` like P3 and P4; static paths before parameter paths in each file, pinned by a source-reading test [P4 8.2, 10.9]. Write routes answer `{ data, undo: { actionId } }` where undo applies. New files `src/api/club/routes/09-attendance.ts`, `10-subscriptions.ts`, `11-payments.ts`.

Attendance (`09-attendance.ts`):
- `GET /club/attendance/day?date=YYYY-MM-DD`: the day's occurrences and sessions of every active group, the undone list (3.9), the notices.
- `GET /club/attendance/session?occurrence=<eventId>|<date>|<time>` or `?id=<documentId>`: panel data (group, date, coaches, list with abonament status and main group, ticks, saved line).
- `POST /club/attendance/session/check` body `{ groupId, date, startTime }`: 4.5 result (`existing` / `occurrence` / `free`).
- `PUT /club/attendance/session` body `{ id | occurrence | added: { groupId, date, startTime, durationMin }, coachIds, ticks: [{ athleteId, grup, uscat }], reactivate: athleteIds }`: save (4.4-4.12, 4.18, 4.22); 409 with `{ inactive: [{ id, name }] }` when an inactive athlete is ticked and not in `reactivate` or `keepInactive`.
- `GET /club/groups/:documentId/attendance?month=YYYY-MM`: the group tab list.
- `GET /club/lessons?month=YYYY-MM`, `GET /club/lessons/:documentId`, `POST /club/lessons`, `PUT /club/lessons/:documentId` (presence, coaches, duration), `DELETE /club/lessons/:documentId`.
- `GET /club/attendance/coaches?month=YYYY-MM` and `GET /club/attendance/coaches.csv?month=YYYY-MM` (`Content-Disposition: attachment`).
- `GET /club/athletes/:documentId/attendance?month=YYYY-MM`: the record's attendance block.

Subscriptions (`10-subscriptions.ts`):
- `GET /club/subscriptions?state=&group=`: the list; `GET /club/subscriptions/extend/preview`: the count n.
- `POST /club/subscriptions/extend` body `{ weeks }` (409 when n changed since the preview: "Abonamentele s-au schimbat. Reîncarcă pagina." [p5 Q42]).
- `GET /club/athletes/:documentId/subscriptions/new?startsOn=`: items, audience, coverage candidates, expiry.
- `POST /club/athletes/:documentId/subscriptions` body `{ itemKey, priceListId, startsOn, cover: attendanceIds, payment?: { amount, method, collectedAtRink, sendEmail } }`.
- `POST /club/subscriptions/:documentId/cancel` [p5 Q40] (409 while a non-cancelled payment points to it).
- `GET /club/athletes/:documentId/subscriptions`: bars and earlier ones.

Payments (`11-payments.ts`):
- `GET /club/payments?month=&method=&purpose=`: list and total.
- `GET /club/athletes/:documentId/payments`: month table and payments; `GET /club/athletes/:documentId/payments/options`: "Pentru" options with default amounts.
- `POST /club/payments`, `PUT /club/payments/:documentId`, `POST /club/payments/:documentId/cancel`.
- `GET /club/due?month=YYYY-MM`: "De încasat", both parts (the Școala part ignores the month) [p5 Q34].

Changed: `POST /club/memberships/:documentId/move` (P4) also returns and applies the 4.11 carry; `GET /club/memberships/:documentId/move-preview` (new, in `06-groups.ts`) returns the bar and the Gold line flag; athlete delete answers 409 `{ payments, subscriptions }` (5.14); the Sportivi list route gains the column and filter; `POST /club/undo` (P4) handles the new actions.

## 7. Locks, transactions, undo

### 7.1 Lock order
Order: registrations > seasons > session > athletes > groups > events > lessons > attendances > subscriptions > payments > undo entry. Never lock a session after an athlete. Each list is sorted by id; every writer takes only the suffix it needs, in this order, and re-reads after locking [code locks.ts; strapi-store.ts; undo-service.ts; P4 8.1; C68]:
- Session save: the session row when it exists (else the unique `occurrenceKey` insert guards the race), then every athlete ticked before or now, then their candidate subscriptions.
- Add subscription: the athlete only; the covered attendance rows are updated by id under that lock (their sessions are not locked).
- Extend: the subscription rows only (sorted); a concurrent session save waits on the subscription row it uses; no cycle because extend never takes an athlete lock.
- Payment write: the athlete, then the linked lesson or subscription, then the payment.
- Move with carry: the P4 athlete lock, then the athlete's subscriptions.
- Delete / merge (P3): registrations, athletes, then their sessions' attendance rows, subscriptions, payments.

### 7.2 Transactions
- One transaction per action; all or nothing; failure "Acțiunea nu a reușit. Nimic nu a fost salvat." [P3C 7].
- A session save writes the session, its attendance rows, slot links, frozen prices, A.C.S. reads, reactivations and history together.
- A payment with "Trimite e-mail" queues the e-mail job in the same transaction (`notBefore` +15 s).

### 7.3 Undo (toast "Anulează", 8 s) [DEC 2026-10-10 aloca-v2 (a); P4 W15]
| Action | Undo | Refused when |
|---|---|---|
| Session save | none, correct by saving again [C46] | |
| Add subscription (with coverage, payment) | deletes the subscription and its payment, restores covered rows to `fara_abonament`, cancels the queued e-mail | a slot of it was used since, or the payment was edited |
| Extend | subtracts the weeks from the same rows | any of them extended or cancelled since |
| Record payment | deletes the payment (and A.C.S. back to `acsBefore`), cancels the queued e-mail | the payment was edited or cancelled since |
| Edit payment | restores the old values | changed again since |
| Anulează plata | un-cancels | changed since |
| Anulează abonamentul | un-cancels and restores the slot links | a freed attendance was covered or re-saved since |
| Create / delete lesson | deletes / restores | the lesson was saved or paid since |
| Move with carry (P4) | P4 undo also removes the carry | P4 rule |
Refusal text: "Nu se mai poate anula. Datele s-au schimbat între timp." [p5 Q42]. Undo writes "Anulat: <linia>" (P4 3.7).

## 8. History lines

Actor = admin name. Field changes use the P3 pattern `<Câmp>: "<vechi>" -> "<nou>"` [P3 1.6]. Every line below is approved [p5 Q42] (examples in `p5-8-copy.html`), the reused P3 lines as before.

Session (`session`; shown in the panel under "Istoric" [C69]):
- "Prezență salvată: <x> din <y>, antrenor <nume>." (first save)
- "Prezență corectată. Sportivi adăugați: <nume>, <nume>. Sportivi scoși: <nume>. Uscat bifat: <nume>." (later saves; only the parts present; number forms "Sportiv adăugat: <nume>.")
- "Antrenori: "<vechi>" -> "<nou>"" (field-change pattern, approved form)

Athlete (`athlete`):
- "Prezent la <grupă>, <data>, doar la ședința asta." (visitor)
- "Abonament adăugat: <item>, din <data>, expiră pe <data>." / "Acoperă <n> prezențe fără abonament."
- "Abonament prelungit cu <x> săptămâni: expiră pe <data>."
- "Plată înregistrată: <sumă>, <metodă>, <pentru>." / "Plată anulată: <sumă>, <data>."
- "Membru A.C.S. <sezon>: <vechi> -> <nou>" (P3 line, approved [code history-text.ts])
- "Reactivat" (P3 line, approved)

Subscription (`subscription`): "Abonament adăugat ...", "Prelungit cu <x> săptămâni: <vechi> -> <nou>.", "Valabil și în lista <listă>." (carry), "Abonament anulat." [p5 Q40].

Payment (`payment`): "Plată înregistrată." / field changes ("Sumă: "300 RON" -> "320 RON"") / "Plată anulată." / "E-mail "Plată înregistrată" trimis la <adresă>." (no address after anonymize).

Lesson (`lesson`): "Lecție programată: <data>, <ora>, <durată>." / "Lecție salvată: prezent." / "Lecție salvată: absent." / field changes / "Lecție ștearsă."

Group (`group`): none for attendance (the group Istoric stays roster, program and settings) [C69].

## 9. "Plată înregistrată" e-mail [p5 Q22; DEC 2026-10-19 notif-q1-emails]
- One `email-job`, kind `payment`, to the athlete's contact e-mail (trimmed, lower case); the existing Brevo queue, retries, GlitchTip alert; outside production to the one test address [P4 6.5; DEC 2026-10-19 design sections 1-4].
- Layout "letter" E1 like the registration e-mail [DEC 2026-10-05 email-e-v2].
- Subject: "Plată înregistrată: <sportiv>" [p5 Q42].
- Body, paragraphs: "Bună ziua," / "Am înregistrat plata de <sumă> pentru <sportiv>." / "Pentru: <pentru>. Metodă: <metodă>. Data: <data>." / "Acesta nu este un document fiscal." [C70] / "Echipa EduSport" [p5 Q42].
- Not sent for edits, cancellations or anything not ticked.

## 10. Copy module and errors

### 10.1 Module
Every phase 5 string lives in `src/club/presence/copy.ts` (re-exporting `copy/attendance.ts`, `copy/subscriptions.ts`, `copy/payments.ts`, `copy/history.ts`, `copy/email.ts`), as P4 11 [C71]. Number forms through `countWords` (`src/club/ro-count.ts`). Rules: Romanian, terse, one line, no em dash, no middle dot, straight quotes, no emoji; empty values blank except the approved words ("Fără abonament", "nefăcută", "urmează", "salvată", "inclus", "anulată") [P4 11].

### 10.2 Approved strings (from the companion screens and DECISIONS)
"Prezență", "Ședințe", "Lecții individuale", "Pe antrenori", "Azi", "+ Ședință nouă", "Nefăcute din zilele trecute (<n>)", "Azi, <zi> <data>", "Data", "Ora", "Grupă", "Antrenor", "Stare", "Prezenți", "<x> din <y>", "nefăcută", "urmează", "salvată", "+ Adaugă alți antrenori", "Sportiv", "Grup", "Uscat", "+ Adaugă doar la ședința asta", "<x> din <y> prezenți", "Închide", "Salvează", "Salvată de ...", "În afara programului", "Din alte grupe: <n>", "Există deja o ședință salvată", "Deschide prezența salvată", "Adaugă încă o ședință în ziua asta", "<n> ședințe rămase", "Fără abonament", "+ Lecție individuală", "Lecție nouă", "Durată", "Export CSV", "Ședințe grup", "Ore", "Abonamente", "Școala de patinaj", "Prelungește abonamentele", "+ Abonament", "Stare: Active", "Grupă: Toate", "Abonament", "Folosite", "Expiră", "activ", "epuizat", "Prelungește abonamentele Școlii de patinaj", "Număr de săptămâni", "Se prelungesc <n> abonamente active cu <x> săptămâni. Noua dată de expirare se calculează pentru fiecare.", "Renunță", "Prelungește <n> abonamente", "Grupe și abonament", "Plăți", "Abonament Școala de patinaj, <n> ședințe", "Expiră pe <data>", "<n> folosite", "<n> rămase", "+ Adaugă abonament", "Adaugă abonament, <nume>", "Abonament (lista <listă>)", "Data de start", "Expiră (estimat)", "Acoperă prezențe fără abonament (<n>)", "Plată", "Înregistrează plata acum", "Sumă", "Metodă", "Adaugă abonament", "Abonamentul actual rămâne valabil. Următorul, la prețul Avansați Gold.", "De încasat", "Club", "Preț", "Luna", "Ședințe", "De plătit", "Plătit", "Rămas", "<n> (<a> grup, <b> uscat)", "<n> grupe fără listă de prețuri: prezența se înregistrează, nimic nu se calculează.", "inclus", "+ Plată", "Perioadă", "Tip", "Toate", "Pentru", "Înregistrat de", "Numerar", "Card (POS)", "Transfer bancar", "Plată nouă", "Încasat la patinoar", "Trimite e-mail "Plată înregistrată"", "Notă", "opțional" (as the hint "Opțional" [DEC 2026-10-19 phase2-designs-v1]), "Înregistrează", "Abonament <n> ședințe (activ din <data>)", "Club, <lună>", "Cotizație membru <sezon>", "Lecție individuală", "anulată", "Anulează plata", "Șterge <nume>", the two 5.14 sentences, "Anonimizează", "Salvat.", "Nicio modificare.", "Acțiunea nu a reușit. Nimic nu a fost salvat.", "Nu am putut încărca datele.".

### 10.3 Copy approved in companion screen 8 [p5 Q42]
Every string proposed in sections 3 to 9 was approved as proposed on 2026-10-27 (`.superpowers/phase5/screens/p5-8-copy.html`, 87 lines; the user may update lines later). No COPY NEEDED marker remains. A later change goes into the copy module only.

## 11. Tests and boot check

### 11.1 Unit (pure, `src/club/presence/__tests__/`)
- Occurrence to planned session and state words (salvată, urmează, nefăcută; start date; cancelled left out); occurrence key from the date and time a class takes place (a moved date is a new session, the saved one stays "În afara programului"); season of a date.
- 4.5: existing occurrence, warning with and without the same time, out-of-schedule flag; duration default.
- 4.10: candidate filter (list, `validIn`, dates, used), earliest expiry then start then purchase; re-save keeps slots; untick frees; Școala visitor; abonament status words and number forms.
- 4.9: offered items per audience, list choice with and without a school group, coverage candidates and the slot cap, `validUntil` (start + 27 days), frozen fields.
- 4.11 carry: Standard -> Gold carried, Gold -> Standard not, missing Gold price carried, Club move nothing, move undo.
- 4.12: Grup and Uscat items, both ticked, inclus, missing item, missing audience price, no list (`fara_pret`), visitor at the visited group's prices, frozen on correction, notice count and forms.
- 4.14: month sums incl. lessons and lesson payments, cancelled payments ignored, negative remainder, months before the start date hidden; Școala part of "De încasat" (price minus non-cancelled payments > 0, month ignored, no-price rows out) [p5 Q34].
- 4.8a: "Anulează abonamentul" frees the slots to `fara_abonament`, hidden while a payment points to it, undo restores the links [p5 Q40]; `fara_abonament` rows never appear in any due [p5 Q39].
- 4.15-4.17: Pentru options and default amounts; A.C.S. Da on a fee payment, `acsBefore`, revert on cancel only when no other fee payment and still Da; edit history lines; cancelled rows out of totals.
- 4.3: hours per coach (several coaches full duration, 0-present sessions and absent lessons out), "21,5" format, CSV text (BOM, ";").
- 4.20: `lastActiveYears` with attendance, lessons, payments (cancelled out), subscriptions.
- 4.21: delete refusal counts and the dialog sentence parts; merge plan for overlapping sessions; anonymize clears payment notes and keeps amounts.
- 4.22: inactive detection and the 409 payload.
- Undo planners and refusals of 7.3; history lines of 8; copy module without em dash, middle dot or curly quotes.

### 11.2 Store parity
A `PresenceStore` interface (`src/club/presence/store.ts`) with `strapiPresenceStore` and the fake `__tests__/fake-store.ts`, every method in both, with `fake-store.test.ts` and `strapi-store.test.ts` [P3 12; CLAUDE.md store pattern]. Transactions and locks through the existing scope (`lockRow`).

### 11.3 Routes and UI source-reading
- Every new route uses the admin guard; static before parameter paths; core routers of the five new types answer 403 to the Public role; public price reads leave out `uscat`.
- UI: menu entries and order; Prezență tabs and columns; panel columns per section (no Uscat at Școala); the list starting empty; group tab "Prezență" between "Program" and "Istoric"; record tabs order; Abonamente buttons and modal text; Plăți filters and columns; "Trimite e-mail" unticked by default; "anulată" rows struck; delete refusal dialog; move window bar and Gold line.

### 11.4 Boot check (throwaway Postgres, as P4 12)
Start the backend on a copy of the P4 boot data; set `attendanceStartDate`; then:
- save a Școala session for two athletes, one with an 8-slot abonament (slot used, "7 ședințe rămase"), one without ("Fără abonament"); add an abonament covering it; extend all by 1 week and undo;
- save a Club session with Grup and Uscat at member and non-member prices, an "inclus" item and a group without a list; record a "Club, <lună>" payment; `GET /club/due` matches;
- record a fee payment: A.C.S. Da for the season; cancel it: back to the old state;
- record a payment with the e-mail ticked: job queued to the test address; undo cancels it;
- move a Standard athlete to Avansați Gold: carry written, bar and line returned; their slot is used in a Gold session;
- "Pe antrenori" and its CSV for the month;
- delete an athlete with a payment: 409; anonymize: payment kept, note cleared; inactivity list sees attendance seasons;
- restart once to prove the schema boots (new types, enum values) [memory: schema change needs a restart].
- Renders after implementation (no pre-build approvals) of every screen in 5, desktop and phone [DEC 2026-10-26 phase3ab].

## 12. Deploy order
1. Backup of the database [P3 11].
2. Deploy the backend: new types (3.1-3.5), enum values (3.6, 3.7), setting (3.8) and the index migration (3.10) apply on restart; restart the container once more if a new attribute is not saved [memory: schema change needs restart].
3. Frontend: no website change in phase 5; check that the website price reader ignores an unknown item kind (3.6) before step 4 [C11].
4. In Prețuri: the club's Club prices (Ședință, Uscat, Lecție individuală) and the Avansați Gold prices (Open 1).
5. In Setări site: `attendanceStartDate` = the 1st of the month after deploy [p5 Q38].
6. Abonamente running on paper: added by hand with "Adaugă abonament" and their real start date [p5 Q38].
7. Checks on production: Prezență today, one group tab, Abonamente, Plăți, De încasat, Pe antrenori; nothing on the public website changes.
8. Diagrams updated with the build: 03b (session, attendance, lesson), 03c (subscription, payment, uscat), 04c (subscription states incl. `anulat`, extension), 04d (session states), 05c (save sequence with slots and prices), 02f and 02g (admin use cases).

No data migration script: there is nothing to import [p5 Q31].

## 13. Open items (for the user; each has the default the build uses)
1. Prices: Club Ședință / Uscat / Lecție individuală and the Avansați Gold prices still come from the club [R D43]. Default: until they are entered in Prețuri, those lines are "fără preț" and nothing is billed. Not blocking the build; blocking real billing at go-live.
2. Rink settlement [p5 Q21]: later, when the club explains the flow; only the tick "Încasat la patinoar" now. Not blocking.

Answered on 2026-10-27 and moved into the rules: start date [p5 Q38]; e-mail text and every other string [p5 Q42]; carry rule [p5 Q35]; Școala attendance without abonament [p5 Q39]; A.C.S. mid-month [p5 Q41]; abonament correction [p5 Q40]; currency [p5 Q37]; unpaid abonamente in "De încasat" [p5 Q34]; expiry date [p5 Q36]. Shown on p5-7 as decided by Claude and not objected to: extension scope (C77), lesson saved with the tick off (C48), a saved session whose Program date changes (C19, C72). Taken by Claude as low impact: Sportivi "Abonament" value (C65, filter options [p5 Q42]), record blocks on "Grupe și abonament" (C54, copy [p5 Q42]), "Altceva" note optional (C78).

## 14. Conflicts between sources (resolved here, flagged for the user)
1. Mockup p5 scr 2 shows start 27 oct -> "Expiră (estimat) 24 nov"; the built `subscriptionValidUntil` gives 23 nov (start + 4 weeks - 1 day): resolved by p5 Q36, 23 nov.
2. SPEC 2 rule 7 "same price list only" vs DEC 2026-10-10 Gold decision: resolved by p5 Q10 (Standard works in Gold, not the reverse).
3. Mockups write "lei"; the built Prețuri page writes "RON": resolved by p5 Q37, "RON" everywhere.
4. p5 scr 5 shows "Pe antrenori" with a month switcher, p5 scr 1 shows "Ședințe" as a day page: the page switches its header per tab (C41).
5. Research D14 (coach corrections until month end) applies to phase 6; the admin corrects any time.
6. DEC undated "every payment gets an invoice" vs DEC 2026-10-19 money-q4-doc: no document (later date wins).
7. DEC undated "a group's payment setting is a price list OR Fără plată prin portal" vs p5 Q15 A: no switch; a missing list means nothing billed with the notice.
8. DEC undated "6 or 8 sessions in 30 days" / "valid 4 school weekends" vs DEC 2026-10-19 user: start + 4 weeks, manual extension.
9. MEM and DEC undated "a Plăți person" vs DEC 2026-10-19 admin-q1-roles: one admin role.
10. p5 Q22 recommended "on by default"; the user chose B: off by default.

## 15. Decided by Claude

Every entry is decided by Claude (low impact) and open to the user's veto. Q5, Q11, Q17 and Q33 were already shown in the companion as decided by Claude and are sourced as [p5 Qn]; C72-C74 are the coordinator's rulings on the builder check.

- C1 decided by Claude (low impact): a session row exists only once saved; planned and undone sessions are derived from occurrences.
- C2 decided by Claude (low impact): uniqueness through string keys with `unique: true` (`occurrenceKey`, `uniqueKey`); moved dates keyed by the date and time they take place (C72).
- C3 decided by Claude (low impact): a saved session with every tick removed stays saved, "0 din <y>".
- C4 decided by Claude (low impact): attendance `billing` enum `slot | fara_abonament | club | inclus | fara_pret`.
- C5 decided by Claude (low impact): Club prices frozen per attendance as a `charges` json plus `amount`.
- C6 decided by Claude (low impact): an individual lesson holds its own presence (`present`), no attendance row.
- C7 decided by Claude (low impact): used slots are counted from attendance rows, not stored.
- C8 decided by Claude (low impact): "Încasat la patinoar" shown only when "Pentru" is an abonament.
- C9 decided by Claude (low impact): `acsBefore` on fee payments; cancel or re-purpose reverts A.C.S. only when no other fee payment of the season remains and the state is still Da.
- C10 decided by Claude (low impact): Prețuri type label "Uscat".
- C11 decided by Claude (low impact): public price reads leave out `uscat` items; deploy checks the website reader.
- C12 decided by Claude (low impact): payment e-mail job held 15 s for undo; no e-mail on edit or cancel.
- C13 decided by Claude (low impact): `attendanceStartDate` in site settings, next to "Ani până la anonimizare"; before it nothing is "nefăcută" or listed in "De încasat".
- C14 decided by Claude (low impact): cancelled dates are not listed on Prezență or the group tab.
- C15 decided by Claude (low impact): season of a date from `startMonth`..`endMonth`, else the latest season started before it.
- C16 decided by Claude (low impact): one index migration in `database/migrations`.
- C17 decided by Claude (low impact): default coaches: the group's coaches for a session, the main group's first coach for a lesson.
- C18 decided by Claude (low impact): hours skip sessions with 0 present and lessons not held.
- C19 decided by Claude (low impact), shown on p5-7 without objection: a saved session whose date is later cancelled or moved stays on its old date, shown "În afara programului" (C72).
- C20 decided by Claude (low impact): "+ Ședință nouă" also asks "Durată", defaulting to the group's series duration or 50 min.
- C21 decided by Claude (low impact): "+ Ședință nouă" on an existing unsaved occurrence opens that occurrence.
- C22 decided by Claude (low impact): abonament items from the main school group's list, every school list when the athlete has no school group.
- C23 decided by Claude (low impact): coverage rows ticked by default, oldest first, capped at the slot count.
- C24 decided by Claude (low impact): tie-breaks after the earliest expiry: earliest start, then earliest purchase.
- C25 decided by Claude (low impact): a re-save keeps existing slots; unticking frees the slot.
- C26 decided by Claude (low impact): the carry is stored in `validIn`; the price comparison itself is [p5 Q35].
- C27 decided by Claude (low impact): Grup uses the list's first `session` item, Uscat its first `uscat` item.
- C28 decided by Claude (low impact): Grup and Uscat both ticked are both charged.
- C29 decided by Claude (low impact): corrections price only added or changed rows.
- C30 decided by Claude (low impact): the no-price-list notice shows on "De încasat" and Prezență, for active groups of the current season.
- C31 decided by Claude (low impact): individual lessons are part of the Club month; lesson payments count for the lesson's month.
- C32 decided by Claude (low impact): "Rămas" can be negative, shown with "-".
- C33 decided by Claude (low impact): "Pentru" option formats and default amounts of 4.15; preselected when opened from De încasat or a panel.
- C34 decided by Claude (low impact): a payment's athlete is never edited.
- C35 decided by Claude (low impact): correcting a paid lesson or attendance does not change the payment.
- C36 decided by Claude (low impact): the e-mail box is disabled without a contact e-mail.
- C37 decided by Claude (low impact): cancelled payments also block delete.
- C38 decided by Claude (low impact): merge of two rows at one session keeps the union of ticks and one slot.
- C39 decided by Claude (low impact): decimals with a comma ("12,50 RON"); the word RON itself is [p5 Q37].
- C40 decided by Claude (low impact): menu order Grupe, Sportivi, Prezență, Abonamente, Plăți, De încasat; De încasat as its own page.
- C41 decided by Claude (low impact): the undone section shows on every day; Ședințe uses a day switcher, the other tabs a month switcher.
- C42 decided by Claude (low impact): "<x> din <y>" counts the group's list only; visitors via "Din alte grupe".
- C43 decided by Claude (low impact): CSV with ";", UTF-8 BOM, file `pe-antrenori-<YYYY-MM>.csv`, summary columns only.
- C44 decided by Claude (low impact): "Adaugă abonament" and "+ Plată" from the panel through a row "..." menu.
- C45 decided by Claude (low impact): a visitor joins the table ticked "Grup".
- C46 decided by Claude (low impact): a session save has a toast without "Anulează".
- C47 decided by Claude (low impact): a lesson created for today or earlier is recorded held.
- C48 decided by Claude (low impact), shown on p5-7 without objection: a lesson saved with the tick off is kept as not held.
- C49 decided by Claude (low impact): "Șterge lecția" only while not paid, with undo.
- C50 decided by Claude (low impact): group tab column headers reuse the p5 screen 1 headers.
- C51 decided by Claude (low impact): record tab order Date, Grupe și abonament, Plăți, Profil public, Documente, Istoric.
- C52 decided by Claude (low impact): an anonymized record also shows "Plăți", read-only.
- C53 decided by Claude (low impact): the bar title uses the frozen item name when it differs from the standard pattern.
- C54 decided by Claude (low impact): the record shows the month's attendance on "Grupe și abonament".
- C55 decided by Claude (low impact): the Plăți tab month table columns and the months it lists.
- C56 decided by Claude (low impact): "+ Abonament" on the list starts with the athlete search.
- C57 decided by Claude (low impact): "Înregistrează plata acum" off by default; that payment is dated today.
- C58 decided by Claude (low impact): Abonamente sorted by expiry ascending; Grupă = main group today.
- C59 decided by Claude (low impact): "Număr de săptămâni" 1 to 12, default 1.
- C60 decided by Claude (low impact): Plăți "Tip" option labels from the "Pentru" words.
- C61 decided by Claude (low impact): "Altceva" rows show the note's first words.
- C62 decided by Claude (low impact): a month total under the Plăți list.
- C63 decided by Claude (low impact): method default "Numerar".
- C64 decided by Claude (low impact): De încasat lists owing and paid athletes, sorted by "Rămas" descending.
- C65 decided by Claude (low impact): Sportivi "Abonament" value "5/8, 7 nov 2026", blank when none.
- C66 decided by Claude (low impact): the delete refusal sentence drops a part with 0.
- C67 decided by Claude (low impact): "Anonimizează" in the refusal only for a Super Admin.
- C68 decided by Claude (low impact): lock order registrations, athletes, sessions or lessons, subscriptions, payments.
- C69 decided by Claude (low impact): session history in the panel; the group Istoric gets no attendance lines.
- C70 decided by Claude (low impact): the e-mail text carries "Acesta nu este un document fiscal." as the online confirmation will.
- C71 decided by Claude (low impact): code lives in `src/club/presence/` with its copy module and `PresenceStore`.
- C72 decided by Claude (low impact) (controller ruling on builder-check Q1, 2026-10-27): a session is keyed by the date and time it actually takes place; a date moved after its session was saved leaves the saved session on its old date ("În afara programului") and the new date is a new session to fill; the expansion's original-date fields only locate the series exception.
- C73 decided by Claude (low impact) (controller ruling on builder-check Q4): every attendance, lesson and abonament row stores the price it was billed at when saved (snapshot); back-filled rows use the group's current list at save time; no price-list history.
- C74 decided by Claude (low impact) (controller ruling on builder-check Q3): the 3C export includes the child's attendance, individual lessons, abonamente and payments, with four summary PDF sections (4.21a).
- C75 decided by Claude (low impact): "Anulează abonamentul" has no confirmation (undo toast instead, toast reuses the approved line "Abonament anulat."); the menu item is hidden, not refused with a message, while a payment points to the abonament.
- C76 decided by Claude (low impact): the Școala part of "De încasat" ignores the month, lists abonamente with a price only, sorted by start date; an empty part is hidden.
- C77 decided by Claude (low impact), shown on p5-7 without objection: "Prelungește abonamentele" extends only abonamente still active today.
- C78 decided by Claude (low impact): a payment "Altceva" needs no note.
