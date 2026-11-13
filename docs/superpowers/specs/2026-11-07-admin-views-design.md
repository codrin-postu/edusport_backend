# Phase 11: admin views (design)

Status: draft v1, 2026-11-07, for the user's review. Admin side only. Companion screens av-1 to av-6 answered 2026-11-06 and 2026-11-07.

Parent docs: `2026-10-27-attendance-payments-design.md` (P5: sessions, attendance, lessons, abonamente, payments, "De încasat", the billing rules), `2026-11-04-coach-portal-design.md` (P6), `2026-10-26-athletes-registrations-design.md` (P3, Sportivi list and record). Research: `.superpowers/admin-views/research.md`. User answers: `.superpowers/admin-views/answers.md`. Screens and questions: `.superpowers/admin-views/screens/questions.md`, `av-1-*.html` to `av-6-*.html`; the latest revision of a screen wins (av-1c over av-1b over av-1, av-3c over av-3b over av-3, av-4b over av-4).

Precedence: the user's answers in `answers.md` win, a later line over an earlier one; then the approved mockup of the latest revision; then a dated entry in `edusport_frontend/docs/portal/DECISIONS.md` (later date wins); then P5 and P6. Where this file changes P5 the cause is cited.

Citation keys:
- `[P11 avN-qM]`: answer to question M of screen avN in `answers.md` (av1c-q1 = question 1 of the av-1c revision, av4b-q2 = question 2 of av-4b).
- `[P11 user note]`: a free-text line of the user in `answers.md` (not a numbered question).
- `[P11 scr avN]`: the approved mockup of that screen (text and layout).
- `[P5 x]`, `[P6 x]`: earlier specs, section x. `[DEC <date> <id>]`: DECISIONS. `[R n]`: research section n. `[code]`: current code on `feat/athletes`, file named.
- `[S n]`: decided by spec author (low impact), listed in section 13. Every S entry is open to the user's veto.

Copy convention (as P5): quoted copy is the exact UI text; `<name>` marks a value. Romanian, terse, no em or en dash, no middle dot, straight quotes, no emoji [DEC 2026-10-27 polish 3]. Amounts "<n> RON" with "." for thousands and "," for decimals ("18.640 RON", "12,50 RON") [P5 Q37; S1]. Visual rules: no pills, no circles (labels and segments are square), no dashed or dotted lines, no tabs except the Sportivi "Listă" / "Tabele" tab the user asked for [P11 av5-q1; DEC feedback no rounded shapes, no dashed lines].

## 1. Intent and goals

Give the admin the views phase 5 left out: attendance across a day, a week or a month in one page; a page per coach; every name in a session reachable; an athlete's full presence history with what paid for each presence; the dates behind every abonament unit; tables of athletes, payments, abonamente and presence that can be shaped, saved, shared and downloaded; and one overview of the club's money with an accounting view.

Success:
- "Prezență" shows Zi, Săptămână or Lună (Săptămână by default) with Grupe, Lecții individuale and Antrenori behind one small picker, no tabs; Grupe also has a heat grid for week and month [P11 av1-q1, av1-q2, av1-q3, av1c-q1].
- From a session or lesson every coach, athlete and group is one click away; a coach has a page with hours, sessions and lessons for any period [P11 av2-q1, av2-q2].
- An athlete's "Prezențe" lists every group session and individual lesson of the season, newest first, 10 per page, each row saying "Ședința x/y" with the abonament code, "Plătit" or "Neplătit" [P11 av3-q1, av3c-q1, user note].
- Each abonament has a short visible code ("A-0124") and shows which dates used its units [P11 av3c-q1, av4b-q1].
- Sportivi gets a "Tabele" tab: ready-made tables plus a builder; saved views shared with the author shown; downloads in .xlsx and .csv of exactly what is on screen [P11 av5-q1 to av5-q6].
- A "Bani" page gives five month figures, a breakdown by section and group (switchable to method and purpose), and an accounting view with an automatic "Nr. chitanță" and "Export contabil" [P11 av6-q1 to av6-q4].

## 2. Scope

### 2.1 In scope
- Data (3): abonament `code`, payment `receiptNo`, a counter table, saved table views.
- Endpoints (4): period queries for Prezență, grid, coach page, athlete presence history, abonament usage, table catalog, query, export, saved views, money overview, accounting and its export.
- Screens (5): Prezență page rework, session and lesson panel links, coach page, athlete record "Grupe și abonament" (abonament cards and history), Sportivi "Tabele", "Bani" page; small changes to Abonamente, Plăți, De încasat and the payment window to show the new codes.
- Performance limits (6), copy (7), tests (8), deploy (9).

### 2.2 Non-goals
- Coach app and parent app screens: unchanged; the new state words are admin only [S2].
- A calendar view of the month: optional, not now [P11 av1-q2].
- Any receipt or invoice document: "Nr. chitanță" is a number on the payment row and in exports, no PDF, no print [DEC 2026-10-19 money-q4-doc; P11 av6-q3; S3].
- An athlete quick drawer: names open the athlete page in a new browser tab instead [P11 av2-q3; P11 av5-q5].
- Pivot tables, charts, scheduled or e-mailed exports, Google Sheets sync of tables.
- Editing data from a table: tables are read only; edits stay in their pages.

### 2.3 Anti-goals
- Never renumber or reuse an abonament code or a receipt number, also after cancel, undo or delete [task brief; S4].
- Never let a saved view carry raw SQL or arbitrary field paths: the server accepts only catalog keys (4.7).
- Never show tabs on Prezență, the coach page or Bani [P11 av1-q1, av2-q2, av6-q3].
- No middle dot, no em or en dash, no pills or circles, no dashed or dotted lines in any new screen.

## 3. Data model

All new attributes follow P5 3: collection types hidden from the Content Manager, closed to the Public role.

### 3.1 Subscription: `code` [P11 av3c-q1, av3-user note, av4b-q1]
- `api::subscription.subscription` (`club_subscriptions`) gains `code`: string, `unique: true`, set once when the abonament is created (`POST /club/athletes/:documentId/subscriptions`, `src/club/presence/subscriptions/add.ts` [code]), never changed.
- Format "A-" + a sequence of at least 4 digits, "A-0001", "A-0124", growing a digit only past 9999 ("A-10000") [P11 scr av3c; S5]. One sequence for the club, never reset by season.
- The sequence is the counter `subscription` (3.3). A cancelled abonament keeps its code; an abonament removed by the 8 s undo leaves its number unused for ever [S4].
- Backfill: existing rows without a code get one in `purchasedAt` order (then `createdAt`, then `id`), at boot, idempotent; the counter is then set to the highest number used (9.2).

### 3.2 Payment: `receiptNo` [P11 av6-q3]
- `api::payment.payment` (`club_payments`) gains `receiptNo`: string, `unique: true`, set in the create transaction (`POST /club/payments`, the payment inside "Adaugă abonament"), never changed by edit, cancel or a later change of `paidOn`.
- Format "<YYYY>-<seq>", seq at least 4 digits, "2026-0412" [P11 scr av6]; YYYY is the year of `paidOn` at creation; one sequence per year, counter `receipt:<YYYY>` (3.3) [S6]. Numbers follow the order of recording inside a year, not the order of `paidOn`.
- A cancelled payment keeps its number and shows "anulată" next to it; a payment removed by the 8 s undo leaves a gap (the number is never reused) [S4]. Gaps are visible in the accounting list only as missing numbers; no placeholder row [S7].
- Label in the UI: "Nr. chitanță" [P11 scr av6].
- No backfill [P11 review q1]: payments recorded before go-live have no number and show an empty "Nr. chitanță" cell; numbering starts at go-live.

### 3.3 Counter (`api::club-counter.club-counter`, table `club_counters`) [S8]
- `key`: string, `unique: true` ("subscription", "receipt:2026"); `value`: integer, the last number handed out.
- Next number: inside the caller's transaction, `INSERT ... ON CONFLICT (key) DO UPDATE SET value = club_counters.value + 1 RETURNING value` (knex raw on Postgres); the row lock serialises concurrent creates. The in-memory store (P5 store parity) mirrors it. Allocation runs in the same database transaction as the payment or abonament create, through the existing `transactionScope` pattern (`src/club/athletes/strapi-store.ts`, `current()`) (decided by Claude, low impact).
- Pure formatting in `src/club/codes.ts`: `formatSubscriptionCode(n)`, `formatReceiptNo(year, n)`, `parse*` and the backfill planner, on the model of `src/club/registration-number.ts` [code].

### 3.4 Saved table view (`api::table-view.table-view`, table `club_table_views`) [P11 av5-q2, av5-q4]
- `name`: string, required, 1 to 80 characters, unique among saved views (case-insensitive check in the service) [S9].
- `subject`: enumeration `sportivi | plati | abonamente | prezenta`.
- `definition`: json, the view (4.7), at most 16 KB.
- `authorId`: integer, the Strapi admin user id; `authorName`: string, the admin's display name at save time (same source as P5 `recordedBy`).
- `createdAt`, `updatedAt` (Strapi).
- Shared: every admin sees every saved view with its author; only the author can save over it or delete it; anyone can duplicate [P11 av5-q4; P11 scr av5 q4 A]. A Super Admin can also delete (cleanup after a person leaves) [S10].
- Ready-made views are code constants (`src/club/tables/ready-made.ts`), author "Sistem", never stored, read only, duplicable [P11 av5-q2; P11 scr av5].

### 3.5 Indexes
- Unique indexes from `unique: true` on `club_subscriptions.code`, `club_payments.receipt_no`, `club_counters.key`.
- No other new index: P5 already indexes `club_sessions(date)`, `club_individual_lessons(date)`, `club_payments(paid_on)`, `club_subscriptions(valid_until)` [P5 3.10].

### 3.6 History lines
- None for codes and numbers (they are set with the row; P5 lines for "Abonament adăugat" and "Plată înregistrată" gain the code or number at the end: "... (A-0124)", "... (nr. 2026-0412)") [S11].
- Saved views write no athlete history (they are not about one athlete) [S12].

## 4. Server endpoints

All admin routes: `{ auth: false, policies: ['global::is-admin'], middlewares: [] }`, static paths before parameter paths (the existing source-reading test covers the new files) [P5 6]. Dates are `YYYY-MM-DD`, Europe/Bucharest. A period is `from` and `to` inclusive; the server refuses a period longer than 42 days on Prezență and coach routes with 400 "Perioada e prea lungă." [S13]. Until phase 6b roles exist, every admin sees Bani, the accounting view and all exports; the phase 6b role map decides later (carried to 6b q17-q21) (decided by Claude, low impact).

Every phase 11 route names its area (`money`) in its route config; the 6b area test fails otherwise (spec 9.3 ruling).

### 4.1 Prezență period (`src/api/club/routes/09-attendance.ts`)
- `GET /club/attendance/period?from&to` (new): days in the period, each with the group rows (P5 `DayRow` plus `coachIds`), the undone list before `from` (4.1a), `today`, `startDate`, `groupsWithoutList`. Built from `src/club/presence/attendance/day.ts` [code] generalised to a range (one occurrence expansion and one session read for the range, not one per day).
- `GET /club/attendance/grid?from&to` (new): groups active in the period (rows, P4 group order), dates (columns), each cell `{ state, present, listed, sessions }` where a day with two sessions of one group adds both [S14].
- `GET /club/lessons?from&to` (changed, `month` kept as an alias for one release): lesson rows of the period.
- `GET /club/attendance/coaches?from&to` and `GET /club/attendance/coaches.csv?from&to` (changed, `month` kept as alias): `src/club/presence/coaches/report.ts` and `hours.ts` take a range [code].
- `GET /club/attendance/day` stays for the old screen until the new one ships, then is removed with its test [S15].
- 4.1a Undone list: unsaved held occurrences from `attendanceStartDate` to the day before `from` (P5 3.9), newest first, only for Grupe [S16].
- State words (admin): "Completat" (a session row exists, or a lesson is saved), "Necompletat" (no row and the start time has passed, on or after `attendanceStartDate`), "Urmează" (start time not reached yet) [P11 user note; P11 scr av1c; S17]. P5 3.9 "today = urmează" is replaced by "start time passed = Necompletat", as av-1c shows today's 17:30 and 18:30 rows "Necompletat".

### 4.2 Coach page (`09-attendance.ts`) [P11 av2-q2]
- `GET /club/coaches/:documentId/presence?from&to` (new; `documentId` of `api::team-member.team-member`): `{ name, totals: { sessions, lessons, hours }, days: [{ date, sessions, lessons, hours }], sessions: DayRow[], lessons: LessonListRow[] }`. A session counts for the coach when the coach is on the saved session, or on the group's coaches while unsaved (P5 5.2 Antrenor rule); hours as P5 4.3 (saved sessions with present > 0, lessons held) [P5 C18].
- `GET /club/coaches/:documentId/presence.csv?from&to` (new): columns "Data", "Tip", "Grupă sau sportiv", "Ora", "Durată", "Ore"; one line per counted session or lesson; same CSV rules as P5 C43 (BOM, ";", CRLF) through a shared helper (4.9).
- 404 "Antrenorul nu există." for an unknown id [S18].

### 4.3 Athlete presence history (`09-attendance.ts`) [P11 av3-q1, av3-q3, av3c-q1, user notes]
- `GET /club/athletes/:documentId/presence?season=<documentId>&page=<n>` (new, replaces `GET /club/athletes/:documentId/attendance?month`, removed when the new block ships [S15]).
- Page size 10, fixed, newest first (date, then start time, then id) [P11 av3-q1].
- Rows: every attendance row of the athlete whose session date is in the season, and every individual lesson of the athlete with `present` true in the season [P11 user note "Individual lessons in the same history"; S19]. Response `{ seasonLabel, total, page, pageSize, rows }`, row:
  - `kind`: `grup | individual`; `sessionId` or `lessonId`; `date`; `startTime`;
  - `place`: the group name, or for a lesson the coach names ("Cu <antrenor>") [P11 scr av3c];
  - `pay`: `{ kind: 'unit', unit, slots, code }` | `{ kind: 'paid' }` | `{ kind: 'unpaid' }` (4.3a);
  - `detail`: the one-line text of 5.4.3 for `paid` / `unpaid` rows, null for `unit` rows [P11 user note "No click detail needed for these rows"].
- 4.3a "Plată" rule [P11 scr av3c "What Plătit means"; S20]:
  - Școala row with a slot: `unit` = the row's place in its abonament's use order (attendance rows of that subscription sorted by session date, start time, then attendance id), `slots` = the abonament's slots, `code` = its code. The "Ședința x/y" label has the same colour in every row; the abonament's payment status is never shown on it [P11 review q2].
  - Școala row without a slot (`fara_abonament`): `unpaid`.
  - Club row: `paid` when the athlete's Club month of that date (P5 4.14) has Rămas 0, else `unpaid`. A row with amount 0 (`inclus`, `fara_pret`) follows its month the same way.
  - Individual lesson: its payments are linked by lessonId (purpose `lectie`, the phase 5 lesson link on payments); `paid` when the lesson's left amount is 0 under phase 5 rules, else `unpaid` (a lesson's price counts once, DEC 2026-11-03 (4)) (decided by Claude, low impact).
- The summary count is `total` (same season) [P11 av3-q3].

### 4.4 Abonament usage (`src/api/club/routes/10-subscriptions.ts`) [P11 av4-q1, av4b-q1, av4b-q2]
- `GET /club/athletes/:documentId/subscriptions` (changed): `AthleteSubscriptions` (`src/club/presence/money-api.ts` [code]) becomes `{ groups, current, others }`, each abonament `{ id, code, label, startsOn, validUntil, state, used, slots, uses: [{ unit, sessionId, date, startTime, groupName }] }`; `uses` lists only used units, in use order [P11 user note "used sessions only"]. `current` is the abonament P5 4.10 would use today, else null; `others` every other abonament of the athlete, newest `startsOn` first [S21].
- `GET /club/subscriptions?state=&group=` (changed): rows carry `code`; new state value `expira14` (active, `validUntil` within today to today + 13) for the Bani link (5.6.4) [S22].
- `GET /club/attendance/session?id=<sessionId>&athlete=<athleteDocumentId>` (changed): the optional `athlete` marks that row for the panel to scroll to and highlight [P11 av4b-q2].

### 4.5 Payments and codes (`src/api/club/routes/11-payments.ts`)
- `GET /club/payments`, `GET /club/athletes/:documentId/payments`: rows carry `receiptNo`; "Pentru" texts of an abonament carry its code (5.7) [S23].
- `GET /club/athletes/:documentId/payments/options`: abonament options carry the code.
- `GET /club/due?month`: the Școala part rows carry the code.

### 4.6 Money overview (`11-payments.ts`) [P11 av6-q1, av6-q2, av6-q3]
- `GET /club/money/overview?month=YYYY-MM` (new): `{ month, cards, bySection, byMethod, byPurpose }`, computed on read in `src/club/money/overview.ts` (pure) from one read per source for the month [S24]:
  - `cards.collected`: sum of non-cancelled payments with `paidOn` in the month; `cards.collectedPrev`: the same for the month before (for "+6% față de oct", hidden when the previous month is 0).
  - `cards.left` and `cards.due`: the totals of the "De încasat" page for that month (P5 5.11): Rămas of both parts, and De plătit plus Preț of both parts. The card and its link show the same numbers [P11 av6-q4; S25].
  - `cards.activeSubscriptions`: abonamente in state `activ` on the reference day, counted exactly as the Abonamente list counts them for Stare "Active" (current season only, abonamente not started yet included), so the card and its link show the same number (decided by Claude, low impact); `cards.schoolAthletes`: athletes with a membership in a Școala group on that day. Reference day: today for the current month, the month's last day for a past month [S26].
  - `cards.expiring`: active abonamente with `validUntil` from the reference day to 13 days later, counted exactly as the list counts Stare "Expiră în 14 zile" (decided by Claude, low impact).
  - `cards.unpaidAthletes`: athletes with Rămas > 0 in either part of "De încasat" for that month.
  - `bySection`: per section, then per group: Datorat, Încasat, Rămas, Încasat %. Datorat = the Club due (P5 4.14) of attendances in that group's sessions in the month, plus the price of abonamente with `startsOn` in the month, put on the athlete's Școala group on `startsOn` (the main one first, else the first school group current on that day; none: the "Fără grupă" row), plus lessons of the month put on the athlete's main group on the lesson date. Încasat = the part of that Datorat already paid: abonament payments for that abonament; for a Club month, its payments spread over the month's lines oldest first [S27]. Under phase 5 rules, cancelled abonamente are left out of Datorat; the card "Încasat" counts payments by payment date, while this breakdown counts the payments applied to those dues (the note in 5.6.2 explains the difference) (decided by Claude, low impact). Section rows carry the sum of their groups; money with no main group (lessons-only athletes, a month between seasons, a group with no section) goes to a last section block "Fără grupă" with one row of the same name, so Total counts every due of the month (decided by Claude, low impact); a last row "Total".
  - `byMethod`: per method, Încasat (cash by `paidOn`) and count of payments; `byPurpose`: the same per "Pentru".
  - The month switcher stops at the current month [S26].
- `GET /club/money/accounting?month` (new): `{ byMethod: { numerar, card, transfer, cancelled }, payments: [{ paidOn, receiptNo, athleteName, purposeText, method, amount, cancelled }] }`; payments of the month by `paidOn`, ordered by date then receipt number, cancelled rows included and marked [P11 av6-q3; P11 scr av6].
- `GET /club/money/accounting.xlsx?month` and `GET /club/money/accounting.csv?month` (new, `Content-Disposition: attachment`): "Export contabil" (5.6.5).

### 4.7 Table builder (`src/api/club/routes/13-tables.ts`, new) [P11 av5-q1 to av5-q6]
- `GET /club/tables/catalog`: subjects, their columns (key, label, type `text | number | money | date | label`), filters, group-by options, ready-made views.
- `POST /club/tables/query` body `{ definition }`: validates the definition against the catalog, answers `{ columns, groups: [{ key, label, count, subtotal, rows }] | null, rows, total, truncated: false }`. Definition:
  - `subject`: `sportivi | plati | abonamente | prezenta`;
  - `scope`: `{ seasonId, sectionId | null, groupId | null, period: { from, to } | null }`;
  - `columns`: ordered catalog keys, 1 to 20;
  - `filters`: up to 10 of `{ column, op: 'eq' | 'in' | 'gt' | 'lt' | 'empty' | 'notEmpty', value }`, only ops the column type allows;
  - `groupBy`: `grupa | sectiune | luna | antrenor | null` (one level) [P11 av5-q3];
  - `sort`: `{ column, dir: 'asc' | 'desc' }` (rows sort inside each group).
- `POST /club/tables/export` body `{ definition, format: 'xlsx' | 'csv', name }`: the same query, all rows, as a file (4.9) [P11 av5-q6].
- Saved views: `GET /club/table-views`, `POST /club/table-views` body `{ name, definition }`, `PUT /club/table-views/:documentId` (author or Super Admin, else 403 "Doar autorul poate modifica vizualizarea."), `DELETE /club/table-views/:documentId` (same rule). Delete answers `{ undo: { actionId } }` for the 8 s undo (P4 W15 pattern) [S28].
- Rows are built in `src/club/tables/` (pure: `catalog.ts`, `definition.ts` validation, `rows-*.ts` per subject, `group.ts` subtotals, `sort.ts`) from bulk reads by `src/api/club/services/tables.ts`: one read per source table restricted by the scope, no read per row [S29].
- Subjects and their columns (labels are the column headers) [P11 scr av5; S30]:
  - "Sportivi", one row per athlete with a membership in the scope (season, section, group): "Sportiv", "Vârstă", "Data nașterii", "Grupă" (main group), "Grupe", "Secțiune", "Antrenor" (main group's coaches), "Părinte", "Telefon", "E-mail", "Membru A.C.S.", "Stare", "Abonament" (code and "3/8" of the current abonament), "Expiră", "Prezențe" (count in the period), "De plătit", "Plătit", "Rămas", "Stare plată". Money for the period: the athlete's Club months in the period (P5 4.14) plus abonamente with `startsOn` in the period, with what is paid for them, whenever paid; "Stare plată" = "Achitat" (Rămas 0, De plătit > 0), "Parțial" (0 < Plătit < De plătit), "Neachitat" (Plătit 0, De plătit > 0), blank when nothing is due [P11 scr av5].
  - "Plăți", one row per payment with `paidOn` in the period: "Data", "Nr. chitanță", "Sportiv", "Grupă", "Secțiune", "Pentru", "Metodă", "La patinoar", "Sumă", "Înregistrat de", "Stare" ("anulată" or blank), "Notă".
  - "Abonamente", one row per abonament with `startsOn` in the period (or in the season without a period): "Cod", "Sportiv", "Grupă", "Abonament", "Început", "Expiră", "Folosite", "Preț", "Plătit", "Rămas", "Stare".
  - "Prezență", one row per attendance and per held individual lesson in the period: "Data", "Ora", "Sportiv", "Grupă", "Tip", "Antrenor", "Plată" (the 4.3a label text: "Ședința 3/8 A-0124", "Plătit", "Neplătit"), "Sumă".
- Group by: "Grupă" (the row's group; for Sportivi and Plăți the athlete's main group in the scope season), "Secțiune", "Lună" (Plăți by `paidOn`, Abonamente by `startsOn`, Prezență by date; not offered for Sportivi), "Antrenor" (Prezență: each coach of the row; a row with two coaches appears under each and counts once in "Total" [S31]; Sportivi: the main group's first coach). Subtotal row: sums of number and money columns, "<a> din <n>" under "Stare plată" (a = Achitat) [P11 scr av5]; a last "Total" row.
- Ready-made views (read only) [P11 scr av5 q2 B; P11 user note]: "Plăți pe grupă luna aceasta" (Sportivi, current month, Sportiv, De plătit, Plătit, Rămas, Stare plată, by Grupă), "Prezență pe grupă" (Prezență, current month, by Grupă), "Sportivi activi" (Sportivi, Stare = activ, Grupă, Abonament, Telefon), "Rămas de plată" (Sportivi, season, Rămas > 0, sorted by Rămas descending), "Abonamente care expiră" (Abonamente, active, Expiră within 14 days), "Sportivi pe grupă, cu plăți" (Sportivi, current month, by Grupă, with money columns).

### 4.8 Errors
"Nu am putut încărca datele." (existing) for a failed read; "Perioada e prea lungă."; "Tabelul are peste 5.000 de rânduri. Restrânge sfera sau filtrele."; "Tabelul durează prea mult. Restrânge sfera."; "Există deja o vizualizare cu numele ăsta."; "Doar autorul poate modifica vizualizarea."; "Antrenorul nu există."; "Descărcarea nu a reușit." [S32].

### 4.9 Files: CSV and xlsx
- CSV: `src/club/presence/coaches/csv.ts` [code] is generalised into `src/club/csv.ts` (`toCsv(header, rows)`: BOM, ";", CRLF, quoting), used by Pe antrenori, the coach page, the table export and "Export contabil". Numbers in CSV use "," as decimal mark and no thousands mark ("1200,50"), dates "dd.mm.yyyy", for Excel with Romanian settings [S33].
- xlsx: library `exceljs` (MIT, maintained, writes styles, number formats, frozen panes and autofilter, no native dependency) in the backend only, pinned to an exact version [S34]. Not SheetJS: the npm build is outdated and newer builds come from its own CDN, outside the lockfile.
- Table .xlsx: one sheet named after the view (31 characters max), header row bold and frozen, autofilter, money and numbers as numbers with format `#,##0.00`, dates as dates `dd.mm.yyyy`, group header rows and subtotal rows bold, "Total" bold, columns sized to content up to 60 characters [P11 scr av5 q6 A "Foi formatate, subtotaluri îngroșate, sume ca numere"].
- Table .csv: one line per record, no group header or subtotal lines; with a group-by, its column comes first [P11 scr av5 q6 A "Un rând pe înregistrare"].
- File names: `<view name in lower case, letters and digits, words joined by "-">-<YYYY-MM-DD>.xlsx` / `.csv` [S35]; "Export contabil": `contabil-<YYYY-MM>.xlsx` / `.csv`; coach: `antrenor-<name>-<from>-<to>.csv`; Pe antrenori `pe-antrenori-<from>-<to>.csv` (was `-<YYYY-MM>`).
- Download in the admin: the existing blob helper (`src/admin/dashboard/inscrieri/downloadPdf.ts` [code]), POST variant for the table export.

## 5. Screens

All screens work at phone width as in P5 5 (tables become cards or scroll inside their box, Drawer becomes a full-screen sheet). Names that lead to an athlete open the athlete page in a new browser tab (`athleteRecordTo`, `target="_blank"`, `rel="noopener"`) [P11 av2-q3; P11 av5-q5]. Names that lead to a coach or a group open in the same tab [S36].

### 5.1 Prezență page [P11 av1-q1, av1-q2, av1-q3, av1c-q1, av1c-q2, user notes; P11 scr av1b, av1c]
Replaces the P5 tabs "Ședințe" | "Lecții individuale" | "Pe antrenori" (P5 5.2).

Header:
- Title "Prezență"; under it the period label.
- Controls in one row: view dropdown (Select) "Zi" / "Săptămână" / "Lună", default "Săptămână"; "<" and ">" step one period; "Azi" jumps to the period holding today; picker (SegmentedControl, square) "Grupe" / "Lecții individuale" / "Antrenori", default "Grupe"; switch "Listă" / "Grilă", shown only for Grupe in Săptămână and Lună [P11 av1c-q1; P11 scr av1c "Grilă rămâne pentru Grupe"].
- Action at the right: "+ Ședință nouă" (Grupe), "+ Lecție individuală" (Lecții individuale), "Export CSV" (Antrenori) [P5 5.2; S37].
- Period label: Zi "Vineri, 6 noi 2026"; Săptămână (Monday to Sunday) "2-8 noi", across months "30 noi - 6 dec", across years "29 dec 2025 - 4 ian 2026"; Lună "Noiembrie 2026" [P11 scr av1b; S38]. Clicking the label opens the native date input; the chosen date sets the period holding it [S38].
- URL `?view=zi|saptamana|luna&date=YYYY-MM-DD&show=grupe|lectii|antrenori&layout=lista|grila`; old `?tab=sedinte|lectii|antrenori&month=` links map to `show` with `view=luna` [S39].
- Notices of P5 5.2 (start date not set, groups without a price list) stay above the list.

Grupe, Listă:
- "Necompletate din zilele trecute (<n>)" first, rows "Data" | "Ora" | "Grupă" | "Antrenor" | "Stare" (P5 5.2 section renamed with the new word), hidden at 0 [S16].
- Day header rows "Luni 2 noi", today "Vineri 6 noi (azi)", shown in capitals by CSS, lower height and a slightly smaller font than P5's section titles [P11 user note "Day header rows"]. Days without sessions are left out.
- Columns "Ora" | "Grupă" | "Antrenor" | "Prezenți" | "Stare"; Prezenți "<x>/<y>" ("8/9"), "0/<y>" while unsaved [P11 scr av1c]; Stare "Completat" / "Necompletat" (orange) / "Urmează"; "În afara programului" under the group name when it applies. Sorted by time, then group order.
- Lună opens scrolled to today's day header (or the first day for another month) [P11 av1-q2]; Zi shows one day without a day header [S40].
- Row opens the session panel (5.2).
- Empty: "Nicio ședință în perioada asta." [S41].

Grupe, Grilă (Săptămână and Lună) [P11 av1-q2 addition; P11 scr av1b]:
- Rows: the groups active in the period; columns: the days. Week headers "Lu 2", "Ma 3", "Mi 4", "J 5", "V 6", "S 7", "D 8"; month headers "1" to "31".
- Cell: the share present of listed, "92%" in the week, "92" in the month; a planned day (Urmează) is shaded without a number; a day without a session is empty. Square cells, colour steps 0%, 1-59%, 60-79%, 80-94%, 95-100%, tokens from the theme [P11 scr av1b].
- Legend under the grid: week "Prezenți din listați", month "Prezenți din listați, % în celule", then "0%", "1-59%", "60-79%", "80-94%", "95-100%", "planificat", "fără ședință".
- A cell opens the Zi view of that date with Grupe [S42]. On phones the grid scrolls sideways inside its box with the group column fixed.

Lecții individuale (Listă only) [P11 scr av1c]:
- Day header rows as above; columns "Ora" | "Sportiv" | "Antrenor" | "Stare"; Stare as above (a planned lesson whose time passed is "Necompletat"; a lesson saved with the tick off is "Completat" with the athlete name muted, P5 C48).
- Row opens the lesson panel. Empty: "Nicio lecție individuală în perioada asta." [S41].

Antrenori [P11 av1c-q1 "coach hours live under Antrenori"; P11 scr av1c]:
- Columns "Antrenor" | "Ședințe grup" | "Lecții individuale" | "Ore" ("3,5"); "Export CSV" downloads the same rows for the period.
- Row opens the coach page (5.3) with the same view and date.
- Empty: "Nicio ședință completată în perioada asta." [S41].

Phone: the controls wrap to two rows (view and arrows, then the picker); rows become cards as in P5.

### 5.2 Session and lesson panels [P11 av2-q1, av4b-q2]
- P5 5.3 and 5.5 panels stay; added:
  - Coach names in "Antrenori" are links to the coach page [P11 av2-q1]. The coach SearchableSelects stay for editing; the links sit in the read line above them: "Antrenori: <nume>, <nume>" [S43].
  - Every athlete name is a link (new browser tab) [P11 av2-q3].
  - The group name in the title is a link to the group page, and a link "Deschide grupa" sits under the title [P11 scr av2 q1 A]. "Deschide grupa" opens the existing admin group page route, `src/admin/dashboard/grupe/GroupPage` (decided by Claude, low impact).
  - Opened with `athlete` (from an abonament unit), that row is scrolled into view and highlighted with the selected-row background [P11 av4b-q2; S44].

### 5.3 Coach page [P11 av2-q2; P11 scr av2 q2 A]
- Route `/plugins/edusport-prezenta/antrenor/<teamMemberDocumentId>` with the same `view` and `date` query as Prezență; opened from Antrenori it keeps that period, opened from a panel it uses Lună of the session's date [S45].
- Back link "Înapoi" (DEC 2026-11-07 phase 6 website "back link copy Înapoi") to the page it came from, else Prezență with Antrenori.
- Title "<nume>", subtitle "Antrenor".
- Controls: view dropdown "Zi" / "Săptămână" / "Lună", "<", ">", "Azi", period label (5.1); "Export CSV" at the right.
- Figures (StatTile, square): "Ședințe grup" <n>, "Lecții individuale" <n>, "Ore" <h> [P11 scr av2].
- Picker (no tabs) "Ore" / "Ședințe" / "Lecții individuale", default "Ședințe" [P11 av2-q2; S46]:
  - Ore: "Data" | "Ședințe grup" | "Lecții individuale" | "Ore", one row per day with hours, a last row "Total".
  - Ședințe: "Data" | "Ora" | "Grupă" | "Prezenți" | "Stare", newest first [P11 scr av2]; Data "Mie 4 noi"; group name a link; row opens the session panel.
  - Lecții individuale: "Data" | "Ora" | "Sportiv" | "Durată" | "Stare"; Durată "50 min"; athlete a link; row opens the lesson panel.
- Empty: "Nicio ședință în perioada asta." / "Nicio lecție individuală în perioada asta." / Ore "Nicio oră în perioada asta." [S41].

### 5.4 Athlete record, "Grupe și abonament" [P11 av3, av3c, av4b]
Order: "Grupe" (P5), "Abonament curent", "Alte abonamente", "+ Adaugă abonament" (P5), "Prezențe". The P5 bar and "Abonamente anterioare" are replaced [P11 av4b-q1].

5.4.1 Abonament card [P11 av4b-q1; P11 scr av4b]:
- Heading "Abonament curent"; one card for the abonament P5 4.10 would use today; none: "Fără abonament." (P5 copy).
- Card line 1: the code "A-0124" (muted), the name "Școala <luna>" from the month of `startsOn` ("Școala noiembrie"), the period "1 noi - 30 noi" (`startsOn` to `validUntil`; the year added when it is not the current year: "1 sep 2025 - 28 sep 2025"), the state label (square) "Activ" / "Epuizat" / "Expirat" / "Anulat" [P11 scr av4b; S47].
- Line 2: the compact bar of `slots` square segments, used filled, and the count "3/8" [P11 av4b user note "no folosite text"].
- "Vezi zilele" / "Ascunde zilele" opens and closes the dated list under the card; hidden when nothing is used. Closed by default.
- Dated list: used units only [P11 user note], rows "Ședința 1" | "Lun 2 noi, 17:00" | "<grupă>", with a chevron; a row opens the session panel with the athlete highlighted [P11 av4b-q2].
- Heading "Alte abonamente" [P11 user note]: the athlete's other abonamente, same card, newest `startsOn` first; hidden when there is none.
- Phone (390 px): the same card, lines wrap; the dated list under it [P11 scr av4b].

5.4.2 "Prezențe" [P11 av3-q1, av3-q3, av3c-q1; user notes]:
- Heading "Prezențe"; a card above the list with one line "<X> prezențe în sezonul <Y>" ("42 de prezențe în sezonul 2026-2027", "1 prezență în sezonul 2026-2027", number forms by `countWords`) for the season chosen on the tab [P11 av3-q3; S48].
- Columns "Data" | "Grupă" | "Tip" | "Plată".
- Data "Vin 6 noi, 18:00" (with the year when not the current year).
- Grupă: the group name; a lesson "Cu <antrenor>" ("Cu Andrei Pop") [P11 scr av3c].
- Tip: square label "Grup" or "Individual" only (an out-of-schedule session is "Grup") [P11 user note].
- Plată: a square label "Ședința <x>/<y>" with the code "A-0124" as grey text beside it, outside the label; else the square label "Plătit" or "Neplătit" (orange) [P11 av3c-q1; P11 user note]. The "Ședința <x>/<y>" label has the same colour in every row; the abonament's payment status is never shown on it [P11 review q2].
- Pager under the list (`src/admin/ui/Pager.tsx` [code]): "1 - 10 din 42", previous / next and page numbers, 10 per page, newest first [P11 av3-q1].
- Clicks: a "Ședința x/y" row opens the session panel, no detail line [P11 user note "No click detail needed for these rows"]. A "Plătit" / "Neplătit" row opens one detail line under it (ExpandableRow) with the text and a link [P11 scr av3c q1 A; S49]:
  - Club: "Club, <luna>: de plătit <sumă>, plătit <sumă>, rămas <sumă>." ("Club, noiembrie: de plătit 400 RON, plătit 200 RON, rămas 200 RON.");
  - lesson: "Lecție individuală: <preț>, plătit <sumă>." ("Lecție individuală: 150 RON, plătit 0 RON."), no price: "Lecție individuală: fără preț.";
  - Școala without abonament: "Fără abonament.";
  - link "Deschide ședința" / "Deschide lecția".
- Empty: "Nicio prezență în sezonul <Y>." [S41].

### 5.5 Sportivi, "Tabele" [P11 av5-q1 to av5-q6; P11 scr av5]
- The Sportivi page gets a tab row "Listă" | "Tabele" (the only tabs in this phase) [P11 av5-q1]. URL `?vedere=tabele&v=<view id>` [S50].
- Top row: "Vizualizare" (Select, groups "Gata făcute" then "Salvate"; a saved option shows "<nume>" with the author as hint; a ready-made one "Gata făcută" as hint); buttons "Salvează" (only the author's own view, enabled when changed), "Salvează ca nouă", "Duplică", "Șterge" (author or Super Admin), "Descarcă .xlsx", "Descarcă .csv" [P11 scr av5 q2 A, q4 A]. Default view: "Plăți pe grupă luna aceasta" [S51].
- Builder block (open by default on desktop, a BottomSheet "Editează tabelul" on phones) [S52]:
  - "Subiect": SegmentedControl "Sportivi" / "Plăți" / "Abonamente" / "Prezență".
  - "Sfera": "Sezon", "Secțiune" ("Toate"), "Grupă" ("Toate"), "Perioada" (month picker, or "Tot sezonul") [P11 scr av5].
  - "Coloane, în ordine": the subject's columns as a checklist, ticked ones draggable to reorder (`useDragReorder` [code]).
  - "Filtre": one line per filter "<coloană>: <valoare>", "+ filtru" [P11 scr av5]; the quick filters "Stare" and "Grupă" also sit above the table [P11 av5-q5].
  - "Grupează după": "Fără", "Grupă", "Secțiune", "Lună", "Antrenor", with subtotals [P11 av5-q3].
  - "Sortare": column and direction ("Sportiv A-Z"); a click on a column header sorts too [P11 av5-q5].
- Table: group header rows "<grupă>, <n> sportivi" (Plăți "<n> plăți", Abonamente "<n> abonamente", Prezență "<n> prezențe"), collapsible; rows; "Subtotal <grupă>"; last row "Total" [P11 scr av5 q3 A]. Money "1.200 RON"; the money header for Sportivi reads "Rămas" (never "Rest") [P11 user note].
- A row with an athlete opens the athlete page in a new browser tab [P11 av5-q5].
- "Salvează ca nouă" / "Duplică": Modal "Vizualizare nouă", field "Nume" (Duplică prefills "<nume> (copie)"), buttons "Renunță" / "Salvează"; toast "Vizualizare salvată." [S53]. "Salvează": toast "Salvat." (existing). "Șterge": confirmation "Ștergi vizualizarea "<nume>"?" with "Renunță" / "Șterge"; toast "Vizualizare ștearsă." with "Anulează" [S53].
- A changed ready-made or someone else's view shows "Salvează ca nouă" only.
- Download: exactly the current definition, all rows, not only the visible part (4.9) [P11 av5-q6].
- Empty: "Niciun rând pentru alegerile astea." [S41].

### 5.6 "Bani" page [P11 av6-q1 to av6-q4; P11 scr av6]
- Menu "Club și școală": a new entry "Bani" after "De încasat" [S54]. Route `/plugins/edusport-bani?view=prezentare|contabilitate&month=YYYY-MM`.
- Title "Bani"; month switcher "<" "Noiembrie 2026" ">" (stops at the current month); picker (no tab) "Prezentare" / "Contabilitate", default "Prezentare" [P11 av6-q3 "placed with the page's picker, no tab"].

5.6.1 Prezentare, figure cards [P11 av6-q1]:
- Five square cards, each label, big figure, one muted line:
  - "Încasat" "18.640 RON", "+6% față de oct" ("-4% față de oct"; hidden when the previous month is 0);
  - "De încasat" "3.760 RON", "din 22.400 RON datorat";
  - "Abonamente active" "112", "din 159 sportivi";
  - "Expiră în 14 zile" "17", "abonamente" ("1 abonament");
  - "Neachitați" "23", "sportivi cu rămas de plată" (the mockup's "sportivi cu rest", renamed) [P11 user note "Rămas"; S55].
- A card is a link [P11 av6-q4]: Încasat -> Plăți with that month; De încasat and Neachitați -> De încasat with that month; Abonamente active -> Abonamente with Stare "Active"; Expiră în 14 zile -> Abonamente with Stare "Expiră în 14 zile" (new filter option, 4.4) [S22].

5.6.2 Breakdown [P11 av6-q2]:
- Heading "Pe secțiune și grupă"; switch (SegmentedControl) "Secțiune și grupă" / "Metodă" / "Scop".
- Secțiune și grupă: columns "Grupă" | "Datorat" | "Încasat" | "Rămas" | "Încasat %"; a section header row carrying its subtotal, its groups under it, a last row "Total"; "75%" rounded to whole percent; a group with Datorat 0 shows "-" under % [S56].
- Metodă: "Metodă" | "Încasat" | "Plăți", rows "Numerar", "Card (POS)", "Transfer bancar", "Total".
- Scop: "Scop" | "Încasat" | "Plăți", rows "Abonament", "Cotizație membru", "Club", "Lecție individuală", "Altceva", "Total" (the P5 "Tip" words).
- Note under Secțiune și grupă (muted): "Încasat aici: plătit din ce s-a datorat în luna asta." [S57], because the card "Încasat" counts payments by date.

5.6.3 Contabilitate [P11 av6-q3; P11 scr av6]:
- Button "Export contabil" (Popover with ".xlsx" and ".csv").
- Figures: "Numerar", "Card (POS)", "Transfer bancar", "Anulate" (sum of cancelled payments of the month).
- Heading "Plăți din lună"; columns "Data" | "Nr. chitanță" | "Sportiv" | "Pentru" | "Metodă" | "Sumă"; Data "04.11"; Pentru as in Plăți ("Abonament A-0124", "Club, noiembrie", "Cotizație membru 2026-2027", "Lecție individuală", "Altceva") [S23]; cancelled rows struck through with "anulată"; ordered by date then number; athlete a link (new tab).
- Empty: "Nicio plată în luna asta." [S41].

5.6.4 Abonamente filter (P5 5.9): "Stare" gains "Expiră în 14 zile" [S22].

5.6.5 "Export contabil" content [S58]:
- .xlsx sheets: "Plăți" (Data, Nr. chitanță, Sportiv, Pentru, Metodă, La patinoar, Sumă, Stare, Înregistrat de), "Pe metodă" (Metodă, Încasat, Plăți, Total), "Pe grupă" (the 5.6.2 table). Formats as 4.9.
- .csv: the "Plăți" sheet only.

### 5.7 Codes elsewhere [S23]
- Abonamente list (P5 5.9): the "Abonament" cell shows the code muted before "8 ședințe".
- De încasat Școala part (P5 5.11): code before the item name.
- Payment window "Pentru" (P5 4.15): "A-0124, Abonament 8 ședințe (activ din <data>)".
- Plăți list (P5 5.10) and the athlete's Plăți payments table (P5 5.7): new column "Nr. chitanță" after "Data"; abonament payments "Abonament A-0124".
- Toast after a payment (P5 5.10) unchanged; the number shows in the list.

## 6. Performance limits

- Prezență, grid, coach page: period at most 42 days (4.1); one occurrence expansion and one bulk read per source for the whole period; target under 500 ms for a month with 20 groups [S13].
- Athlete history: SQL count plus one page of 10; lessons and attendances merged by date in the service with the limit applied to each source (page n needs at most 10 x n rows of each) [S59].
- Table builder [S29; S60]:
  - Scope: one season at most; Plăți and Prezență periods at most 12 months.
  - Result: at most 5.000 rows on screen and in the file; above that the query answers 422 with "Tabelul are peste 5.000 de rânduri. Restrânge sfera sau filtrele." and nothing is shown or downloaded (no silent cut).
  - At most 20 columns, 10 filters, one group-by level.
  - Server budget 10 s per query or export; over it 503 "Tabelul durează prea mult. Restrânge sfera."
  - At most 2 table queries or exports at a time per server process; a third waits in line (no error).
  - Screen: all result rows load at once; the body renders in windows of 200 rows while scrolling when the result has more than 1.000 rows.
  - Export size: 5.000 x 20 cells, about 1 MB as .xlsx, written in memory (no streaming needed at this size).
  - Saved definition at most 16 KB; at most 200 saved views (then "Salvează ca nouă" answers "Prea multe vizualizări salvate. Șterge una." [S61]).
- Money overview: one read per source for the month; target under 1 s for 300 athletes.
- Every download writes one server log line: admin, kind, row count, no personal data [S62].

## 7. Copy

All new strings live in the copy modules: `src/club/presence/copy/prezenta-ui.ts` (Prezență, coach page, history, cards), `copy/money-ui.ts` (Bani, codes), new `src/club/tables/copy.ts` (Tabele) [S63]. The approved and decided strings are those quoted in sections 4 and 5. Changed P5 strings: "salvată" -> "Completat", "nefăcută" -> "Necompletat", "urmează" -> "Urmează" (admin only), "Nefăcute din zilele trecute (<n>)" -> "Necompletate din zilele trecute (<n>)", "Abonamente anterioare" -> "Alte abonamente", "<n> folosite" / "<n> rămase" -> "<x>/<y>" on the card, the P5 abonament title "Abonament Școala de patinaj, <n> ședințe" -> "Școala <luna>" on the card, "Rest" -> "Rămas" wherever the mockups wrote it.

## 8. Tests

- Pure (`src/club/**/__tests__/`): week bounds and period labels (month and year crossings); state words by start time; grid cell sums for two sessions a day; coach counting (saved vs unsaved coaches, hours rule); history row order, unit numbers in use order, 4.3a for every case (slot, no slot, Club paid and unpaid, lesson by lectie payment and by month); code and receipt formatting, growth past 9999, backfill order, counter never going back after undo; table definition validation (unknown key, too many columns, bad op), each subject's rows, group-by subtotals and "a din n", Antrenor double rows counted once in Total, sort inside groups, row cap; CSV numbers and dates; overview cards, FIFO split of a Club month, % rounding.
- Store parity for the counter (in-memory and Strapi stores give the same numbers).
- Routes: source-reading test for static before parameter paths in `09`, `10`, `11`, `13`; author check on PUT and DELETE of views.
- xlsx: a smoke test that opens the written file with exceljs and checks sheet name, a bold subtotal row and a numeric money cell.
- Renders after implementation of every screen in 5, desktop and phone, reviewed against the approved mockups (av-1c, av-2, av-3c, av-4b, av-5, av-6) [DEC 2026-10-26 phase3ab].

## 9. Deploy

### 9.1 Order
1. Database backup.
2. Backend: new content types (counter, table view) and attributes (`code`, `receiptNo`) apply on restart; restart once more if a new attribute is not saved [memory: schema change needs restart].
3. Boot backfill (9.2) runs once; check that every abonament has a code. Payments keep an empty receipt number before go-live [P11 review q1].
4. `exceljs` installed in the image (backend `package.json`).
5. Check on production: Prezență week and month, grid, coach page, an athlete's Prezențe and abonament days, one table and both downloads, Bani both views and "Export contabil".

### 9.2 Backfill
- `src/club/codes-backfill.ts`, called from `bootstrap()`, in one transaction: abonamente without `code` in `purchasedAt` order; then the subscription counter set to the highest number in use. Payments get no backfill: receipt numbers start at go-live [P11 review q1]. Idempotent; no-op when phase 5 data is empty [S64].

## 10. What is left to the builder

- Component reuse and file split inside `src/admin/dashboard/prezenta/` (PrezentaScreen rework, period header, grid), `sportivi/` (Tabele), `bani/` (cards, history block, Bani page), as long as the copy stays in the copy modules.
- Exact colours of the grid steps and labels, from the existing tokens, checked on rendered crops in light and dark [DEC feedback contrast].
- The row windowing technique for large tables and the drag handle of the column list.
- The SQL or knex shape of each bulk read, within the limits of 6.
- Plan split into tasks and the test files' names.
- Any wording not quoted here goes to the user first; nothing is invented [DEC feedback no generic filler copy].

## 11. Open for the user

None.

## Builder defaults (decided by Claude, low impact)
- Money tables use whole months only; Prezență and Plăți cap 12 months; the 5.000 row cap wins with "Prea multe rânduri, restrânge filtrele.".
- Lessons exist only once created; a created lesson past its time without a save is "Necompletat".
- `/attendance/day` and `/athletes/:id/attendance?month` stay until the plan proves no coach or portal caller uses them.
- Saved views keep relative periods; a removed column is dropped with a notice on open; an archived or deleted group or season in a filter is ignored with a notice, never blocks.
- exceljs: latest stable 4.x pinned exactly, pure JS; image rebuild at deploy.
- "Abonament curent" = active today; two active: the one ending sooner first; none active: no current block, all under "Alte abonamente", newest first.

## 12. Conflicts between sources (resolved here, flagged for the user)

1. P5 2.2 non-goal and DEC 2026-10-19 money-q4-doc ("no receipts or generated payment document") vs av6-q3 A ("Nr. chitanță"): resolved as a number only, no document (later answer wins) [S3].
2. P5 5.2 tabs "Ședințe" / "Lecții individuale" / "Pe antrenori" vs P11 av1-q3 and av1c-q1: replaced by the view dropdown and the picker.
3. P5 3.9 "urmează" for today vs av-1c showing today's unsaved sessions "Necompletat": the start time decides [S17].
4. av5-q5 A text "athlete drawer" vs av2-q3 C and the user's av5 note: new browser tab, no drawer.
5. av-6 mockup "lei" and "Rest" vs P5 Q37 "RON" and the user's "Rămas": RON and Rămas.
6. av6-q3 A "Contabilitate tab" vs the no-tabs preference: a picker, as the user's answer says.
7. av3c-q1 A "detail on click" vs the user note "no click detail needed" for abonament rows: detail only for "Plătit" / "Neplătit" rows [S49].
8. P5 5.7 abonament bar title and "Abonamente anterioare" vs av-4b: av-4b wins ("Școala <luna>", "Alte abonamente", "3/8").
9. DEC 2026-10-27 nr format "26-001" (registrations) vs the av-6 receipt "2026-0412": different objects; the receipt keeps the approved mockup's format [S6].
10. av-1b grid shows an unsaved past session as "0%": kept as the mockup shows (0 present of listed) [P11 scr av1b].

## 13. Decided by spec author (low impact)

Each line is decided by spec author (low impact), open to the user's veto.
- S1: thousands with "." in amounts and counts ("18.640 RON", "5.000").
- S2: new state words only in the admin; coach app copy unchanged.
- S3: "Nr. chitanță" is a stored number, no document.
- S4: codes and numbers never reused; undo leaves a gap.
- S5: abonament code "A-" plus at least 4 digits, one club-wide sequence.
- S6: receipt "<YYYY>-<seq>", year of `paidOn` at creation, sequence per year, mockup format.
- S7: no placeholder rows for gaps in the accounting list.
- S8: one counter table with an atomic upsert-increment.
- S9: saved view names unique, 1 to 80 characters.
- S10: a Super Admin may also delete any saved view.
- S11: P5 history lines for a new abonament and a payment end with the code or number.
- S12: saved views write no history.
- S13: Prezență and coach periods capped at 42 days.
- S14: grid cell adds a group's sessions of the same day.
- S15: old routes (`/attendance/day`, `/athletes/:id/attendance?month`) removed once the new screens ship; `month` alias kept one release on lessons and coaches.
- S16: "Necompletate din zilele trecute (<n>)" kept for Grupe, covering days before the period.
- S17: Necompletat once the start time has passed, Urmează before.
- S18: unknown coach answers 404 "Antrenorul nu există.".
- S19: history covers the season chosen on the tab; lessons only when held.
- S20: the Plătit / Neplătit rule of 4.3a.
- S21: "Abonament curent" = the one P5 4.10 would use today; the rest under "Alte abonamente", newest first.
- S22: Abonamente filter "Expiră în 14 zile" (state `expira14`).
- S23: code and receipt number shown in Abonamente, De încasat, the payment window, Plăți and the athlete's payments.
- S24: overview computed on read, no stored totals.
- S25: De încasat card equals the De încasat page for that month.
- S26: reference day today or the month's last day; no future months.
- S27: breakdown Încasat = paid against the month's dues, Club months split oldest line first; abonament on the main school group at start, lesson on the main group on its date.
- S28: deleting a saved view has the 8 s undo.
- S29: table rows built in pure modules from bulk reads.
- S30: column catalog of 4.7.
- S31: "Antrenor" grouping repeats a two-coach row under each coach, counted once in Total.
- S32: error texts of 4.8.
- S33: CSV numbers with "," decimals and dates "dd.mm.yyyy".
- S34: `exceljs` for xlsx, backend only, exact version pinned.
- S35: download file names of 4.9.
- S36: coach and group links open in the same tab.
- S37: action buttons follow the picker.
- S38: period label formats; label opens the date input.
- S39: URL keys and mapping of old links.
- S40: Zi has no day header row.
- S41: empty-state texts of 5.
- S42: a grid cell opens Zi on that date.
- S43: read line "Antrenori: ..." with links above the editors.
- S44: the athlete's row highlighted when opened from an abonament unit.
- S45: coach page period inherited, else Lună of the session date.
- S46: coach page picker default "Ședințe".
- S47: card name "Școala <luna>" from the start month, year added outside the current year.
- S48: "<X> prezențe în sezonul <Y>" with number forms.
- S49: detail line only for Plătit / Neplătit rows, with its texts.
- S50: Tabele URL keys.
- S51: default view "Plăți pe grupă luna aceasta".
- S52: builder open on desktop, BottomSheet on phones.
- S53: "Vizualizare nouă" modal and toasts.
- S54: menu entry "Bani" after "De încasat".
- S55: "sportivi cu rămas de plată" instead of "sportivi cu rest".
- S56: "-" under % when Datorat is 0.
- S57: the muted note under the breakdown.
- S58: "Export contabil" sheets.
- S59: history paging over two sources.
- S60: table limits of 6.
- S61: at most 200 saved views.
- S62: one log line per download, no personal data.
- S63: copy module files.
- S64: backfill at boot, idempotent.
