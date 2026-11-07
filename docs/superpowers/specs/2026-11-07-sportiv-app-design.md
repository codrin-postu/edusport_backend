# Phase 7: the sportiv app, parent and athlete portal (design)

Status: draft v1 for the user's review, 2026-11-07. Covers phase 7: access for a parent or an adult athlete on `sportiv.<domain>`, the admin side that grants it, and the sportiv app itself (dashboard, history, calendar, progress with badges, competitions, money, settings). Two-factor and passkeys are phase 6b and are not built here [P7 q5].

Parent docs: `docs/architecture/10-spec.md` 3.3, 3.11; `13-roadmap.md` row 7; diagrams `02b` (parent use cases), `03d` (accounts). Builds on `2026-11-04-coach-portal-design.md` (P6: accounts, sessions, BFF, hosts), `2026-10-27-attendance-payments-design.md` (P5: money rules), `2026-10-27-groups-schedules-design.md` (P4). Reads `2026-11-07-admin-auth-roles-design.md` (P6b) and `2026-11-07-admin-views-design.md` (P11) but depends on neither to ship.

Sources:
- Answers and notes: `edusport_backend/.superpowers/phase7/answers.md` (screens 1 and 2 answered, screen 3 q10 answered with the rework notes; later lines win).
- Approved design: `edusport_frontend/docs/portal/mockups/screens/phase7-sportiv-canvas/*.dc.html`, 11 artboards (README there; live canvas https://claude.ai/artifact/KxCdLAg91hYSVyqhcChVPB). Layout, copy and palette are matched as drawn.
- Research: `edusport_backend/.superpowers/phase7/research.md` (D1 to D33 decided, C-a to C-n conflicts, 3.x code findings, L1 to L8 low-impact items). Questions: `.superpowers/phase7/screens/questions.md` (q1 to q27).
- Competitions: the `skate-results` service (repo `Programming/skate-results`, `README.md`, `app/main.py`, `app/schemas.py`) and how the website shows it (`edusport_frontend/src/lib/skate-results.ts`, `src/app/despre-noi/sportivi/[slug]/`).

Precedence: the user's phase 7 answers and notes win (a later line over an earlier one), then the approved design, then a later dated DECISIONS entry, then research items, then earlier specs, then older mockups [P6 header]. Unanswered questions take the research's recommended option (A) unless an answer or the design overrides them; each is listed in section 17.

Citation keys:
- `[P7 qN]`: phase 7 answer N in `answers.md`. `[P7 note]`: a dated user note in `answers.md` (q10 block), named by its topic ("rework", "ice palette", "badges", "competitions", "jumps parked", "approved design").
- `[DS <board>]`: an artboard of the approved design (`Main`, `MainPerf`, `Istoric`, `Calendar`, `Progres`, `Plati`, `Setari`, `Concursuri`, `ConcursDetaliu`, `Promovare`, `Cont`).
- `[R7 Dn]`, `[R7 C-x]`, `[R7 3.x]`, `[R7 Ln]`: research items. `[DEC <date> <id>]`: `edusport_frontend/docs/portal/DECISIONS.md`.
- `[P6 x]`, `[P5 x]`, `[P6b x]`, `[P11 x]`: earlier specs, section x. `[SR]`: skate-results code, file named. `[code]`: current code on `feat/athletes`, file named.
- `[S n]`: decided by spec author (low impact), listed in section 16, each open to the user's veto.
- `[Q-rec qN]`: taken as recommended, listed in section 17 for the user to confirm.

Copy convention (as P6): quoted copy is exact UI text; `<name>` marks a value. Romanian, terse, no em or en dash, no middle dot, straight quotes, no emoji, "E-mail". Ranges written with a spaced hyphen as drawn ("sep 2025 - iun 2026", "1 - 10 din 26") [DS Progres, Istoric]. Synthetic data only, in tests and fixtures (`@example.invalid`).

## 1. Intent and goals

A parent (or an athlete 18+ who holds the e-mail) opens `sportiv.<domain>` and sees, for each athlete he holds, a dashboard worth opening: the current level, the number of presences this season, the next classes, the abonament, what is still to pay; then the presence history, a calendar of his own classes, a progress page with badges, and for performance athletes every competition with scores, ranks and points [P7 note rework; P7 note competitions]. The admin grants access from the athlete record with one click.

Success:
- On a confirmed athlete with an e-mail, the admin clicks "Invită în portal"; the holder of that e-mail gets one mail naming the child and sets a password or uses Google within 7 days [P7 q6, q7, q22].
- One account holds several athletes; an athlete has exactly one access e-mail, the e-mail on the athlete record; when that e-mail changes, access moves with it [P7 q10].
- A coach who is also a parent uses one account on both hosts; disabling the coach side never locks him out of `sportiv.` [P7 q1, q2].
- Every sportiv route checks, on every request, that a live access links this account to the athlete in the URL; nothing outside the list of section 6 is ever answered [P7 q10; R7 L5].
- Competition data comes from skate-results through Strapi only, survives the service being down, and never shows a skater who is not linked to this athlete by the admin [P7 note competitions].
- After a level change the dashboard plays the promotion moment once [P7 note rework].

## 2. Scope

### 2.1 In scope
- Data: `athlete-access` collection; portal account `name`, `coachDisabledAt`, `passwordChangedAt`, `notifySchedule`; portal device and token `host`; `skate-snapshot` cache table (3).
- Accounts and rules: per-host entry, role-aware coach disable and coach invite on a parent account, parent invite and its four cases, access moves on e-mail change, ends on remove, anonymize, delete, merge (4, 5).
- Admin: "Acces portal" block on the athlete record tab "Date", bulk "Invită în portal" on Sportivi, history lines (4.6, 13).
- Sportiv app on `sportiv.<domain>`: login, invite, reset (shared with the coach app), account menu and picker, Acasă, Istoric, Calendar with the phone calendar file, Parcurs with badges, Concursuri and one competition, Abonament și plăți with the registration PDF, Setări (6 to 9).
- Mails: parent invite, "Ai acces și la <copil>", coach role added, schedule mails honouring the holder's switch (11).

### 2.2 Non-goals
- 2FA and passkeys on either host (P6b; the Setări "2FA" row appears only once P6b-2 ships, 6.9) [P7 q5].
- Online payment, buying or renewing an abonament, invoices, receipts [R7 D28; R7 C-c].
- Jumps (Toe loop to Axel) and any coach marking of jumps: parked [P7 note jumps parked].
- A "Nivel nou" badge [P7 note badges].
- Automatic name matching of an athlete to skate-results skaters (5.4, 8.1) [S1].
- Abonament code generation (P11 3.1); phase 7 shows the code when the field exists (6.8) [S2].
- A home screen install row or a web manifest for `sportiv.` [Q-rec q24].
- Parent-side changes to athlete data (only phone and name of the account are editable) [P7 q10; R7 D8].

### 2.3 Anti-goals
- Never answer data of an athlete the account holds no live access to, nor staff notes, older registrations, other children of a group, prices of other athletes, other skaters' names or scores [P7 q10; R7 L5].
- Never let a portal session pass `global::is-admin` or the other host's policy (`is-coach` vs `is-sportiv`) [P6 5.8].
- Never call skate-results from the browser; never expose its API key [code src/api/skate/controllers/skate.ts].
- Never reveal whether an e-mail has an account [P6 5.3].
- No red text except the weekday or month word in calendar date blocks; no pills, no circles, no dashed or dotted lines; no tabs [P7 note ice palette; DEC 2026-11-07 av1-q1].

## 3. Data model

New types follow P6 3: `draftAndPublish: false`, hidden from the Content Manager, core routers closed, relations unidirectional so no public API populates them.

### 3.1 Athlete access (`api::athlete-access.athlete-access`, table `athlete_accesses`) [P7 q10, q9; R7 3.3.2]
- `athlete`: manyToOne `api::athlete.athlete`, required. `account`: manyToOne `api::portal-account.portal-account`, required.
- `email`: string, the normalized athlete e-mail at link time (for history and the "moved" check).
- `invitedAt`, `invitedBy` (admin display name), `revokedAt` (nullable), `revokedBy` (nullable), `revokeReason`: enumeration `scos | email_schimbat | anonimizat | sters | unit` (nullable).
- `levelSeenGroup`: string (group documentId, nullable), `levelSeenAt`: datetime (nullable) (9).
- Live access = `revokedAt` null. At most one live access per athlete: a partial unique index `athlete_accesses_live_uq` on the athlete link where `revoked_at IS NULL`, created at bootstrap beside `ensurePortalIndexes` [code src/club/portal/accounts/team-member-hook.ts] [S3]. Revoked rows stay as history; purged with the athlete.
- Status is derived, not stored: "Invitat" while the account is `invited`, "Activ" when `active`, "Cont dezactivat" when `disabled` [Q-rec q25].

### 3.2 Portal account additions [P7 q1, q4; DS Setari]
- `name`: string, nullable: the holder's display name. Prefilled on invite from the athlete's `contactName`, else the athlete `name`; editable by the admin and by the holder in Setări [P7 q4; Q-rec q24 as drawn].
- `coachDisabledAt`: datetime, nullable: the coach side was ended while the account keeps its sportiv side (4.3) [P7 q1].
- `passwordChangedAt`: datetime, nullable: set by accept, reset and change; Setări shows "schimbată acum <n> <unit>" [DS Setari; S4].
- `notifySchedule`: boolean, default true: the holder's switch "E-mail la schimbări de program" (11.3) [DS Setari; Q-rec q21].

### 3.3 Device and token host [R7 3.3.4; P7 q1]
- `portal-device.host`: string, required for new rows; existing rows backfilled to `antrenor` at bootstrap (idempotent). Securitate lists only the devices of the current host; the coach-side disable revokes `antrenor` devices and sessions only.
- `portal-token.host`: string, nullable: the host an invite link points to; reset codes keep null (reset works on either host).

### 3.4 Skate snapshot (`api::skate-snapshot.skate-snapshot`, table `skate_snapshots`) (8.3)
- `key`: string, unique: `skater:<slug>`, `protocol:<resultId>`, `field:<eventId>:<category>`. `body`: json. `fetchedAt`: datetime. `failedAt`: datetime, nullable (last refresh failure).

### 3.5 Unchanged
`athlete`, `group`, `group-membership`, `session`, `attendance`, `individual-lesson`, `subscription`, `payment`, `calendar-event`, `section`, `location`, `sportsperson` keep their shapes [code schemas]. `email-job.kind` gains `portal-access` (11.2).

## 4. Access: grant, move, end

### 4.1 Who can be invited [P7 q6, q10; R7 D5, D6]
- Manual only: the admin clicks "Invită în portal" on the athlete record; nothing is sent on confirmation [R7 C-b].
- The e-mail is the athlete record's `email`, shown read only in the dialog; nothing else is proposed and nothing can be typed [P7 q6 C].
- Disabled with a hint while the athlete is `nou` ("Confirmă sportivul întâi."), has no e-mail ("Adaugă un e-mail în Date."), or is `anonimizat` [Q-rec q26; S5].

### 4.2 Invite outcomes [P7 q7, q8; R7 D10]
One transaction with the athlete row locked, then the account row (lock order athlete, account). In every case a live access row is created for this athlete and that account; an existing live access of the athlete to another account is revoked first with reason `email_schimbat` (4.4).
1. No account for the e-mail: U&P user with an unusable password, account `invited` with `name` (3.2), invite token with host `sportiv`, queued `portal-invite` (parent variant, 11.1).
2. Active account (parent, coach or both): access added at once, queued `portal-access` "Ai acces și la <copil>"; no invitation [P7 q7 A].
3. Invited account (a pending coach or parent invite): access added; the older invite tokens are used up and one fresh invite goes out on the host of the account's latest invite; accepting it activates the account for both roles [P7 q8 A].
4. Disabled account (only by "Dezactivează tot", 4.3): refused 409 "Contul acestei adrese este dezactivat." [S6].
- "Retrimite invitația" on a live access whose account is `invited`: as case 3. Toast "Invitație trimisă." [P6 10.1].

### 4.3 Coach side and parent side on one account [P7 q1 A, q2 A; R7 C-k, C-l, C-m]
- Roles stay derived: coach = `teamMember` set and `coachDisabledAt` null; sportiv = at least one live access [R7 D19].
- "Dezactivează contul" on the team member: when the account has a live access, sets `coachDisabledAt`, revokes the `antrenor` sessions and devices only; status stays `active`. Without a live access, as P6 4.3 (status `disabled`, user blocked, everything revoked). "Activează contul" clears `coachDisabledAt` or the disabled status.
- "Dezactivează tot" appears on the team member's "Cont portal" block when the account also has a live access: P6 4.3 full disable [P7 q1 A]. Confirmation "Dezactivezi tot contul lui <nume>? Toate dispozitivele vor fi deconectate, și pe sportiv." [S7].
- Team member delete hook: same rule as "Dezactivează contul" [code team-member-hook.ts].
- Coach invite with the e-mail of an account that has no team member: when the account is not `disabled`, the team member is linked, password, Google link and sessions stay, `coachDisabledAt` cleared, and one `portal-access` mail "Poți intra și pe antrenor.<domain> cu același cont." goes out (an `invited` account gets a fresh invite instead). Only a `disabled` account with no team member is re-linked as today (password and Google cleared) [P7 q2 A; code accounts/invite.ts relinkAccount].
- An account with no live access left stays as it is, but cannot enter `sportiv.` (5.1) [P7 q9 A].

### 4.4 Access moves with the athlete e-mail [P7 q10]
- `updateAthlete` [code src/club/athletes/record.ts] with a changed `email` on an athlete that has a live access: in the same transaction the access is revoked (`email_schimbat`) and, when the new e-mail is not empty, the 4.2 outcome runs for the new e-mail. An empty new e-mail just ends the access.
- The admin edit dialog shows, under the e-mail field, while the value differs: "Accesul în portal trece la <e-mail nou>." or, when empty, "Accesul în portal se oprește." [S8].
- The old holder's next request for that athlete answers 403 "Nu mai ai acces la acest sportiv." and the app returns to the picker [R7 L7].

### 4.5 What ends access [P7 q9 A]
- "Scoate accesul" on the athlete record (confirm "Scoți accesul lui <e-mail> la <sportiv>?"): reason `scos`, at once [S9 copy].
- Anonymize: reason `anonimizat`, in the anonymize transaction [code src/club/personal-data/anonymize-service.ts].
- Delete: reason `sters`, before the athlete row goes [code src/club/athletes/delete.ts].
- Merge [code src/club/athletes/merge.ts]: the removed athlete's live access moves to the kept athlete when the kept one has none and the kept e-mail equals the access e-mail; otherwise it is revoked with `unit`. The kept athlete's own access stays.
- An athlete turning 18 changes nothing: whoever holds the e-mail keeps access; the admin block shows "Sportiv 18+" beside the status [Q-rec q12].
- Status `inactiv` keeps access read only (6.2) [Q-rec q14].

### 4.6 Admin screens [Q-rec q26, q27]
- Athlete record, tab "Date", block "Acces portal" at the bottom: line "<e-mail>" with the status word ("Invitat", "Activ", "Cont dezactivat"), "Sportiv 18+" when the age is 18 or more, the access date "din <d mmm yyyy>"; buttons "Invită în portal" (no live access), "Retrimite invitația" (account `invited`), "Scoate accesul" (live access). No access: "Fără acces în portal." [S10 copy].
- Sportivi list: bulk action "Invită în portal" on the selected rows. One preview dialog: "<n> invitații către <m> adrese" and the rows that are skipped with the reason ("nou", "fără e-mail", "are deja acces"); "Trimite". One mail per distinct e-mail; a mail for several children names them all ("pentru Ana Ionescu și Matei Ionescu") [Q-rec q27; S11].
- Rollout: a pilot with 3 to 5 families first, then the rest; a deploy step, not a feature [Q-rec q27].

## 5. Server rules

### 5.1 Hosts [P7 q3 A; R7 C-m, 3.3.1]
- `canEnter(account, user, host, liveAccessCount)` becomes per host: `antrenor` = active account, user not blocked, `teamMember` set, `coachDisabledAt` null; `sportiv` = active account, user not blocked, at least one live access to an athlete not `anonimizat`; any other host = false. Anything else answers like a wrong password [P6 5.3].
- `PORTAL_HOSTS` gains `sportiv` (env `PORTAL_HOSTS=antrenor,sportiv`). The constants `DEFAULT_HOST` in `auth/invite.ts` and `sessions-own.ts` become explicit per call [R7 3.3.1].
- Invite accept: allowed on the token's host; after accept, a session is issued only when `canEnter` holds for the host of the page, else the login page shows. Google accept follows the same rule [P6 4.2].
- Login, reset, refresh, logout, lockout, limits, password rules, device binding: unchanged P6 5.2 to 5.7, with `host` stored on the device row [P6 5].

### 5.2 Policy `global::is-sportiv` [R7 3.3.1]
- `src/policies/is-sportiv.ts`, beside `is-coach.ts`, same order: BFF secret (403), bearer and live session whose `host` is `sportiv` (401), account and user read again with `canEnter(..., 'sportiv', n)` (403). Sets `ctx.state.holder = { accountId, userId, sessionId, athleteIds }`, `athleteIds` = athletes with a live access, read on this request.
- A coach session (host `antrenor`) never passes `is-sportiv` and a sportiv session never passes `is-coach`: `is-coach` gains the same session host check [S12].
- Every route with `:athleteId` refuses 403 "Nu mai ai acces la acest sportiv." when the id is not in `athleteIds`, before any read (a `ClubAdminError`, so the app can tell it from a cut session) [R7 L7].

### 5.3 Who is shown in the picker [Q-rec q14; R7 D11]
- Every athlete with a live access, except an `inactiv` athlete who owes nothing and has no presence in the last 12 months. Such an athlete is still reachable by URL while the access lives.
- Order: by name. With one athlete the app opens his Acasă; with two or more and no athlete in the URL it opens the picker [R7 D11].

### 5.4 Data exposure rules [P7 q10; R7 L5]
- Shown: athlete name, birth date, age, contact name, phone, e-mail; current-season groups with program line and coach names; presence; abonament and money of this athlete; the current-season registration form PDF; the athlete's own competition results [P7 q10; P7 note competitions].
- Never: `notes`, older registrations, any registration field, other children (no rosters, no counts of a group), coach phone or e-mail, prices of price lists, payment `recordedBy`, `note`, cancelled payments, history lines, other skaters [P7 q10; Q-rec q18].
- Each response is built by an explicit view of `src/club/portal/sportiv/views.ts`; a test walks every route's JSON for the forbidden keys `notes`, `recordedBy`, `note`, `history`, `priceListId`, `audience`, `charges`, `registrations`, `roster`, `visitor`, `skaterName`, `sessionId` (P6 14.3 pattern).
- Age is computed from the birth date on each request; no birth date = treated as a child [Q-rec q13].

## 6. The sportiv app

### 6.1 Look [P7 note ice palette; DS all]
- Tokens: background `#f6f9fd`, highlight `#e1ecfb`, lines `#dde6f3`, accent ice `#8fb8f5`, navy `#0e1a3c` for text and key cards, muted text `#5f657a`, cream on navy `#fbf8f1`, muted on navy `#c0c0c4`, calendar red `#be3330`, concurs marker `#4a7bd0`. Card: white, 1 px `#dde6f3` border, square corners, shadow `8px 8px 0 rgba(14,26,60,0.16)`. Key card: navy with the number in ice.
- Fonts: League Spartan 600 to 800 for headings and numbers, Inter 400 to 700 for text.
- Header: light, no navy block: "EDUSPORT" wordmark left; right a navy square button with the athlete's first name and a chevron (44 px), opening the account menu (6.10) [DS Main].
- Bottom menu: floating navy bar 16 px from the edges, radius 18, active item ice fill radius 13 with navy text, others `#c0c0c4`; items "Acasă", "Istoric", "Concursuri" (performance athletes only, 8.2), "Parcurs", "Plăți". These two radii and the 6 px date block are the user's chosen look, rounded rectangles, not pills or circles [P7 note ice palette; DS Main, MainPerf].
- Red only on the weekday or month word of date blocks; links navy, underline on hover; no red eyebrows or hovers [P7 note no red].
- Mobile first, 390 px artboards; on wider screens the column stays 480 px wide, centered [S13].
- URL keeps the athlete: `/<athleteId>/...`; never in a cookie [R7 3.4.6].

### 6.2 States
- Loading: the site Spinner; error "Nu am putut încărca datele." with "Încearcă din nou" [R7 L6].
- Inactive athlete: every page read only as usual (the app has no writes for the athlete); Acasă shows "Sportiv inactiv." under the subline and no "Următoarele ședințe" [Q-rec q14; S14].
- Session end: the login page, silently [R7 L6].

### 6.3 Acasă [DS Main, MainPerf; P7 note rework, presence card]
- Greeting "Bună, <prenume>" (athlete first name), h1 = the current main group name, subline "<section name>, <location>, <age> ani"; for a performance athlete the section name is replaced by the competition category (8.5) ("Advanced Novice Girls, Patinoar Nord, 13 ani"). Location = the group's section location name [code section.location].
- Main group = the current-season membership with `isMain` covering today (P5 `mainGroupToday`) [code src/club/presence/due/settlement.ts].
- Presence card (navy): big number = presences in the current season (group sessions plus individual lessons present), label "prezențe în sezon"; no percentage [P7 note presence card]. Month bars: six months starting at the later of the season start and three months before the current month; count above each bar; past months cream, current month ice, future months a 2 px `#3d4660` line; month words "sep", "oct", "noi", "dec", "ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug" [DS Main; S15].
- "Următoarele ședințe" with "Calendar ›": the next 3 own items from now (6.5), row "<HH:mm>, <group name>" or "<HH:mm>, lecție individuală", subline "<location>, cu <coach names>"; date block weekday word ("Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum") in red caps and day number. Nothing ahead: "Nicio ședință programată." [S16].
- Performance athletes: card "Ultimul concurs" with "Toate ›" before "Următoarele ședințe": "Locul" and the big placement, the event name, "<category>, <n> concurenți", "Total <98,42> puncte" (8.4) [DS MainPerf; S17 for the field line].
- Abonament card (Școala athlete with an active abonament): eyebrow "ABONAMENT", "Ședința <n>/<slots>", "<code>, valabil până la <d mmm>", "Detalii ›" to Plăți. The number is the next session: "Ședința 5/8" means 4 used [DS Main; S18]. Without the code field: "valabil până la <d mmm>".
- Only the current level on the dashboard, no path card [P7 note dashboard].
- Promotion moment over the dashboard (9).

### 6.4 Istoric [DS Istoric; P11 av3 rules]
- h1 "Istoric prezență", subline "<full name>, sezonul <label>". Current season only, newest first [S19, design over q11].
- Summary card: "<n> prezențe", "<g> grup", "<i> individuale" (uscat counts as grup) [DS Istoric].
- Rows: "<Zi d mmm>, <HH:mm>" ("Joi 5 noi, 17:30"), "<group>, cu <coaches>" or "Lecție, cu <coach>", square label "Grup" or "Individual"; group rows on `#e8eef7`, individual on `#e1ecfb` [DS Istoric].
- 10 per page, "<a> - <b> din <n>", buttons "Înapoi" and "Înainte" (‹ ›) [DEC 2026-11-07 av3-q1].
- Empty: "Nicio prezență în acest sezon." [S16].

### 6.5 Calendar [DS Calendar; P7 note settings and calendar]
- h1 "Calendar", subline "<full name>, doar ședințele proprii" [S20, the design's "doar ședințele ei" is gendered].
- Month switcher "‹ Noiembrie 2026 ›" (labels "Luna trecută", "Luna viitoare"), within the current season.
- Grid "L Ma Mi J V S D"; under a day, one small square per kind present: "grupă" navy, "individual" ice, "concurs" `#4a7bd0`, "anulată" `#c0c0c4`; legend under the grid. Today outlined navy; selected day filled `#e1ecfb`.
- Items: occurrences of the athlete's current-season groups for the days his membership covers (P4 `expandOccurrences`), cancelled ones as "anulată"; his individual lessons (planned and saved); `calendar-event` of type `concurs` linked to one of his groups [code expand.ts; S21].
- Selected day list "Joi, 12 noiembrie": "<HH:mm> - <HH:mm>, <group name | lecție individuală>", subline "<location>, cu <coaches>"; a cancelled one ends with ", anulată" and its note when present.
- "Adaugă în calendarul telefonului": downloads `edusport-<prenume>.ics` with the own items from today to the season end (at most 300), cancelled ones left out; no subscription URL [S22].

### 6.6 Parcurs [DS Progres; P7 note path; P7 note badges]
- Title "Parcurs"; the name stays until the user renames it (one copy constant) [S23].
- "Nivelul tău acum" (navy): main group name in ice, "din <luna yyyy>, <location>", program line "<Zile>, <HH:mm>, cu <coaches>" ("Marți și joi, 17:30, cu Alina Gheorghe") from the group's weekly schedule [P4 program text; code src/club/groups/program-text.ts].
- "Următorul nivel": the next active group of the same section by `order`; "Antrenorul decide când treci mai departe."; hidden when there is none [S24].
- "Până acum": earlier main groups, one row per season and group, newest first, "<group>" and "<mmm yyyy> - <mmm yyyy>" from the membership dates (season bounds when open) [DS Progres].
- At most the next level is shown; no full ladder [P7 note path].
- "Realizări": badges (7), grid of 3.

### 6.7 Concursuri and one competition
Specified in section 8 (8.4 list, 8.6 detail) [DS Concursuri, ConcursDetaliu].

### 6.8 Abonament și plăți [DS Plati; Q-rec q15 to q19]
- h1 "Abonament și plăți", subline full name.
- "Rămas de plată" card: total left now; lines below it: Club, "<group> <luna>: <x> RON" per group and month with something left; Școala, "Abonament <item>: <x> RON" per unpaid abonament; an unpaid lesson "Lecție <d mmm>". Under them "Plata se face la club." When paid exceeds due: "Avans: <x> RON". Nothing left: "Nimic de plată." [Q-rec q15, q17; R7 D29; S25].
- Groups without a price list, "inclus" and "fără preț" sessions show no amount and no line, and count nothing [Q-rec q16; R7 C-e].
- "Abonament" card (active abonament): "<code>", "<item name>, <d mmm> - <d mmm>", "Ședința <n> din <slots>", "Vezi zilele ›" opening a sheet: the ticket grid of DEC "Grilă curată" (used boxes navy with date, next outlined "următoarea", empty light), "Valabil până la <d mmm>, <r> rămase", the note "Data se poate prelungi dacă școala are un weekend liber.", then "Alte abonamente" with the last 12 months' used up or expired ones "<item>, <used>/<slots>, valabil până la <d mmm>" [R7 D25; Q-rec q19; DEC 2026-11-07 av4b-q1].
- "Plăți": rows "<what>" with "<d mmm>, <metodă>" and the amount; what = "Abonament <luna>", "Lecție <d mmm>", "Club <luna>", "Cotizație <sezon>", "Altă plată"; method "numerar", "card", "transfer"; cancelled hidden; 10 per page as Istoric [DS Plati; Q-rec q18].
- "Documente": "Fișa de înscriere <sezon>" with "PDF" and "Descarcă": the `acord` PDF of the athlete's current-season registration (the "Formular de înscriere" the registration produces); the block is hidden when there is none [P7 q10; code src/club/documents/acord-content.ts; S26].

### 6.9 Setări [DS Setari; Q-rec q24 as drawn]
- Opened from the account menu, no bottom menu, back link "‹ Înapoi". h1 "Setări", subline "Cont: <e-mail>".
- "Contul meu": "Nume" (editable sheet, 1 to 80 characters), "E-mail" with "îl schimbă clubul" (no action), "Telefon" (editable sheet, optional). Toast "Salvat." [P6 6.2].
- "Sportivi": one row per athlete "<full name>", "<group>, <age> ani", right "Școala" or "Club"; a tap opens "Date sportiv" (read only: "Nume", "Data nașterii", "Vârsta", "Persoană de contact", "Telefon", "E-mail", note "Le schimbă clubul.", button "Deschide panoul") [P7 q10; S27].
- "Securitate": "Parolă" "schimbată acum <n> <zile|luni>" or "nesetată" (Google only), opening "Schimbă parola" (P6 flow; no password yet: the reset flow with the e-mail prefilled); "Dispozitive" "<n> dispozitive conectate" opening the P6 device list for this host. The "2FA" row of the design is hidden until P6b-2 ships [P7 q5; P6b 2.1].
- "Notificări": "E-mail la schimbări de program" with "pornit" / "oprit", a square switch (`notifySchedule`, 11.3); "E-mail la dispozitiv nou" with "mereu pornit", no switch (a security mail, always sent) [DS Setari; R7 D17; S28].
- "Ieșire": logs out this device [P6 5.2].

### 6.10 Account menu and picker [DS Cont; R7 D11]
- The header button opens a sheet "Alege sportivul": "Sportivi în cont" rows "<full name>", "<group>, <age> ani", the current one marked with a navy left bar; "Setări"; "Ieșire".
- The picker page (two or more athletes, none chosen) shows the same list titled "Sportivi" with "Alege sportivul." [R7 D11].
- Shown as personal when the only athlete is 18+: no parent wording anywhere (the app already speaks of the athlete) [R7 D12].

### 6.11 Login, invite, reset [P6 9.1, 9.2]
- The coach app's pages (login with "Continuă cu Google" and e-mail and password, "Am uitat parola", invitation) are shared and restyled with the ice tokens on `sportiv.` [Q-rec q23]. Heading "Intră în cont", invite heading "Bine ai venit" with the e-mail read only [S29].

## 7. Badges [P7 note badges; DS Progres]

Computed on read from existing data; nothing stored. Order: Antrenamente, Sezon complet, Prima lecție, Concursuri. Frames: bronze `#b87333` / `#e3b48a`, silver `#9ca3af` / `#e5e7eb`, gold `#c9a227` / `#f1dc8a`, platinum `#7f8ea3` / `#dfe5ee`, ice `#8fb8f5` / `#e1ecfb`; locked `#d5dbe5` / `#eef1f6` with a `#c3cad6` inner [DS Progres for bronze, silver, locked; S30 for gold, platinum, ice]. Hexagon shape of the design; tier words for screen readers "bronz", "argint", "aur", "platină", "gheață".

| Badge | Counts | Tiers | Label |
|---|---|---|---|
| Antrenamente | every presence ever: attendance rows of the athlete (grup or uscat) plus saved individual lessons with `present` | 25 bronze, 50 silver, 100 gold, 250 platinum | "<prag> antrenamente"; locked "Antrenamente" |
| Concursuri | distinct competitions in the athlete's skate-results history (8) | 1 bronze, 2 silver, 5 gold, 10 platinum, 25 ice | "1 concurs", "<prag> concursuri"; locked "Concursuri" |
| Sezon complet | finished seasons where the athlete had at least one presence in every month in which his main group had a saved session, with at least 6 such months | 1 bronze, 2 silver, 3 gold, 4 platinum, 5 ice | "Sezon complet" |
| Prima lecție | the first presence ever | single, bronze | "Prima lecție" |

- Reached date of a tier = the date of the presence (or competition) that crossed it.
- Tap a badge: a zoom dialog (scale in 0.32 s, dimmed backdrop 0.2 s; none under reduced motion) with the badge large, its name, each tier "<prag>" with "<d mmm yyyy>" or "încă nu", and "<x> din <next>" toward the next tier; "Închide" [DS Progres keyframes es-zoom; P7 note jumps for the zoom idea; S31].
- Concursuri is shown, locked, also for non-performance athletes [DS Progres].
- No "Nivel nou" badge; no jump badges [P7 note badges; P7 note jumps parked].

## 8. Competitions (skate-results) [P7 note competitions]

### 8.1 Matching an athlete to skater records [SR app/main.py `_get_skater`; code athlete.publicProfile]
- The link already exists and is set by the admin: `athlete.publicProfile` (oneToOne sportsperson) -> `sportsperson.skateResultsSlug`, picked in the Sportivi profile editor from a skate-results search [code src/admin/dashboard/sportivi/ProfileEditor.tsx]. skate-results resolves current and retired slugs, so a merge on its side keeps the link [SR `_get_skater`].
- No automatic name matching: a folded-name guess could show another child's results to a parent (data exposure) [S1]. An athlete without a slug simply has no competitions.
- A performance athlete, for the app, is one with a slug [S32]; the Concursuri menu item and the Acasă card appear only for him.

### 8.2 What Strapi reads [SR README; SR app/schemas.py]
- `GET /skaters/{slug}` (profile) and `GET /skaters/{slug}/results?segments=summary` (every result: placement, event id, slug, name, date, location, category, totals, segments with TSS, TES, PCS, deductions).
- `GET /results/{resultId}/protocol` for one competition (elements with base value and score per segment).
- `GET /events/{eventId}/results` only to count the field of the athlete's category ("din <n>"); names are dropped at once.
- Base URL `SKATE_RESULTS_API` (default `https://skate-api.codrin.space`), `X-API-Key` from `SKATE_RESULTS_API_KEY` when set, as the admin proxy [code src/api/skate/controllers/skate.ts]. Timeout 3 s per call [S33].

### 8.3 Cache and the service down [S33]
- Table `skate_snapshots` (3.4). Read path: a snapshot younger than 1 hour (results), 24 hours (protocol, field) is answered as is. Older: the snapshot is answered at once and one refresh runs after the response (single flight per key in the process); no snapshot: Strapi fetches inline within the 3 s timeout.
- A failed refresh keeps the old body and sets `failedAt`. Answers carry `updatedAt` (the snapshot's `fetchedAt`) and `stale: true` when the last refresh failed; the app then shows under the list "Rezultatele pot fi mai vechi. Actualizate <d mmm>." [S34].
- No snapshot and the service unreachable: the competition answers are `{ available: false }`; the app shows "Rezultatele nu sunt disponibile acum." in place of the list, the Acasă card and the detail; the Concursuri badge counts 0 and stays locked; nothing else on the page fails.
- A slug that skate-results answers 404 for: treated as no competitions, logged once a day to GlitchTip [S35].
- The admin's re-import in skate-results shows within the hour; snapshots of an athlete whose slug changed are left to age out (keys are per slug).

### 8.4 Concursuri page [DS Concursuri; P7 note competitions page]
- h1 "Concursuri", subline "<full name>, <n> concursuri" with the Romanian count ("41 de concursuri") [code src/club/ro-count.ts].
- Category card: "Categoria de concurs, sezonul <label>" with the current category (8.5); a line "din <an> înainte: <categorie scurtă>" when an earlier category differs.
- Records card: "<best> record total", "<p> podiumuri" (placement 1 to 3), "<w> victorii" (placement 1).
- Filters (no tabs): "Caută" with placeholder "Nume concurs sau oraș" (name and location, diacritics folded); "Sezon" select "Toate sezoanele" plus each season present; "Ordine" select "Cele mai noi", "Cel mai bun loc", "Cele mai multe puncte". Done on the server over the cached list.
- Rows: placement in a navy square (podium in ice), event name, "<d mmm yyyy>, <oraș>, <categorie scurtă>", total with two decimals and a comma. 8 per page, "<a> - <b> din <n>". A tap opens the detail.
- Empty filter result: "Niciun concurs găsit." [S16].
- Season of a result = the website's rule, September to August from the event date, else the year in the name [code edusport_frontend src/lib/skate-results.ts `seasonKey`].

### 8.5 Competition category [P7 note category]
- Current category = the category of the latest result in the current season; without one, the latest result's category with that result's season in the label.
- Shown as the source writes it, untranslated ("Junior Women", "Advanced Novice Girls") [S36].
- Short form for rows: "Advanced" -> "Adv.", a trailing "Girls", "Boys", "Women", "Men", "Ladies" dropped ("Adv. Novice", "Junior"); other words kept [DS Concursuri; S36].
- Shown on Acasă (subline) and on Concursuri (card) [P7 note category].

### 8.6 One competition [DS ConcursDetaliu]
- Back "‹ Concursuri"; h1 event name; "<date>, <location>, <category>" (date as the source gives it, formatted when ISO).
- "Rezultat" card: "Locul <p> din <n>", "Total <x>", "record: <best>".
- One card per segment, short first: "Program scurt" / "Program liber" (other segment names as given) with the segment score, rows "TES", "PCS", "Deduceri", then the table "Element", "Bază", "Scor" from the protocol. No protocol: the totals only.
- "Clasamentul complet (pagina oficială) ›": the event's source URL, opened in a new tab; hidden when unknown.

## 9. Promotion moment [P7 note rework promotion; DS Promovare; task brief]

- A level change = the main group today differs from the access row's `levelSeenGroup`. First read with `levelSeenGroup` null: stored silently. A change to a later group (same section, higher `order`, or Școala to Club) returns `promotion: { from, to }`; any other change is stored silently [S24 ordering; S37].
- Shown once per level change and per access: the app posts `POST .../promotion/seen` after the dialog closes (or on "Mai departe"); the server stores `levelSeenGroup` = the current main group. Another device of the same account then sees nothing.
- The moment: the dashboard behind dims (0.3 s); a white card rises 12 px (0.4 s); inside, eyebrow "Nivel nou", the old level slides up and out, the new one slides in from below (1.6 s each, from 0.5 s), then a 4 px ice line draws to 56 px (2 s from 0.5 s); "Felicitări, <prenume>! Ai trecut la nivelul următor."; button "Mai departe". Focus moves into the dialog; Escape closes it [DS Promovare keyframes].
- `prefers-reduced-motion: reduce`: no movement, the new level and the line shown at once, the old level hidden [DS Promovare media query].

## 10. Routes

### 10.1 Sportiv routes (`src/api/portal/routes/03-sportiv.ts`, `{ auth: false, policies: ['global::is-sportiv'] }`)
Static paths before parameter paths [P4 8.2].
- `GET /portal/sportiv/me`; `PUT /portal/sportiv/me` `{ name, phone }`; `PUT /portal/sportiv/me/notifications` `{ schedule }`; `POST /portal/sportiv/me/password`; `GET /portal/sportiv/me/devices`; `DELETE /portal/sportiv/me/devices/:id`.
- `GET /portal/sportiv/athletes` (menu and picker).
- `GET /portal/sportiv/athletes/:athleteId/home`; `POST .../promotion/seen`; `GET .../profile` (Date sportiv); `GET .../history?page=`; `GET .../calendar?month=`; `GET .../calendar.ics`; `GET .../path`; `GET .../money`; `GET .../payments?page=`; `GET .../subscriptions`; `GET .../documents/acord`; `GET .../competitions?q=&season=&sort=&page=`; `GET .../competitions/:resultId`.
- Reuses: `athletePayments`, `athleteSubscriptions`, `clubMonths`, `schoolDue` [code presence], `readAthleteMonth` and the lesson reads [code presence/attendance, lessons], `expandOccurrences` [code expand.ts], the registration document storage [code documents/storage.ts], `ageFromIso`, `todayInBucharest` [code birth-date.ts].

### 10.2 Admin routes (`src/api/club/routes/13-athlete-access.ts`, `global::is-admin`)
- `GET /club/athletes/:documentId/access`; `POST .../access/invite`; `POST .../access/resend`; `POST .../access/remove`; `POST /club/athletes/access/bulk-preview` `{ ids }`; `POST /club/athletes/access/bulk-invite` `{ ids }`.
- `12-portal-accounts.ts` gains `POST /club/portal-accounts/:documentId/disable-all`.

### 10.3 Next.js [R7 3.4]
- `src/lib/portal/host.ts`: `Site` gains `sportiv` (env `PORTAL_HOST_SPORTIV`, `sportiv.localhost` outside production); `routeRequest` rewrites to `/sportiv/...`; the main site 404s `/sportiv` [R7 L1].
- Route group `src/app/(sportiv)/sportiv/`; shared auth and shell parts move to `src/app/_portal/` with copy split into shared and per-app files [Q-rec q23].
- BFF: `sportiv-routes.ts` allowlist mirroring the backend list; the coach list never forwards `/portal/sportiv/*` and the reverse; the `host` sent to Strapi comes from the site, never from the client. Google redirect URI from `PORTAL_HOST_SPORTIV`.
- `robots.txt` "Disallow: /", `X-Robots-Tag: noindex, nofollow`, no Umami on `sportiv.` [R7 D2].

## 11. Mails

### 11.1 Parent invite [Q-rec q22; R7 C-h]
- Subject "Acces la portalul EduSport". "Bună, <nume>," / "Ai primit acces la portalul EduSport pentru <copil>." (several: "pentru <copil> și <copil>") / button "Intră în portal" to `https://sportiv.<domain>/invitatie/<secret>` / "Linkul este valabil 7 zile." / signature as P6 [S38].
- `PortalInvitePayload` gains `children: string[]`; `portalHost(siteUrl, site)` takes the host [R7 3.3.6].

### 11.2 Access added (`portal-access`, queued) [P7 q7 A]
- "Ai acces și la <copil>" variant: subject "Acces nou în portalul EduSport"; "Ai acces și la <copil> în portalul EduSport." / button "Intră în portal" to `https://sportiv.<domain>/` [S38].
- Coach role variant: "Poți intra și pe antrenor.<domain> cu același cont." / button to `https://antrenor.<domain>/` [S38].

### 11.3 Optional mails [Q-rec q20; DS Setari]
- "Plată înregistrată" and schedule changes go to the e-mail of the live access's account (which equals the athlete e-mail) or, without a live access, the athlete e-mail as today.
- Schedule-change mails skip an athlete whose access account has `notifySchedule` false [code src/club/groups/schedule-mail.ts `recipients`]. "Plată înregistrată" stays the admin's per-payment choice.
- New-device and lockout mails: host-neutral wording checked; the device line names the host ("pe sportiv.<domain>") [R7 3.3.6; S39].

## 12. Frontend structure (summary)
- Shared folder `src/app/_portal/`: `AuthFrame`, `PasswordField`, `AuthBits`, `Sheet`, `Toast`, `Spinner`, `SquareLabel`, `Row`, `ListCard`, `LoadError`, `BackHeader`, login, reset and invite forms, taking a theme and a copy object. Coach screens keep their look [Q-rec q23].
- Sportiv parts: `IceHeader`, `FloatingNav`, `DateBlock`, `KeyCard`, `MonthBars`, `Badge` (SVG hexagon), `BadgeZoom`, `PromotionDialog`, `Pager`, `TicketGrid`, `SquareSwitch`.
- Copy: `src/lib/portal/copy-shared.ts`, `copy.ts` (coach), `copy-sportiv.ts` [Q-rec q23].

## 13. History lines [R7 L3]
- Athlete: "Acces portal: invitație trimisă la <e-mail>", "Acces portal adăugat: <e-mail>", "Acces portal scos: <e-mail>", "Acces portal mutat la <e-mail>", "Acces portal oprit (anonimizat)" [S40].
- Account subject: "Acces la <sportiv>", "Partea de antrenor dezactivată", "Cont dezactivat complet", "Rol de antrenor adăugat" [S40].
- Holder logins and reads write no lines [R7 L3; P6 q10].

## 14. Builder notes

### 14.1 Before building
- The strings marked [S n] go through one companion copy round before the frontend screens; they live in the copy modules only [P6 14.1].
- Diagrams `02b`, `03d` (AthleteAccess replaces ParentAccess, account fields), roadmap row 7 [R7 3.3.9].

### 14.2 Tests (as P6 14.3)
- Host matrix: a sportiv session on every coach route 401 or 403, a coach session on every sportiv route 401 or 403, any portal session on `/club/*` 401 or 403.
- Access matrix: every `:athleteId` route with an athlete of another account, a revoked access, an anonymized athlete: 403, nothing read.
- Forbidden keys walk over every sportiv route (5.4).
- Coach disable with a live access keeps the sportiv session working and ends the antrenor ones.
- E-mail change moves the access in one transaction; a concurrent second invite for the same athlete loses on the live unique index.
- Skate client against a fake server: fresh, stale, failed refresh, 404 slug, timeout.

### 14.3 Boot checks
Throwaway Postgres only, ports 55465 to 55468 (one per plan), Strapi 1385 to 1388; never 5432, 55442, 1337, 1340, 3010 or the user's containers. Fixture `scripts/fixtures/phase7-shape.js`: synthetic families (`parinte1@example.invalid` with two children, one Școala one Club, the Club child linked to a fake skate slug; `sportiv18@example.invalid` adult athlete; `antrenor1@example.invalid` also holding a child).

### 14.4 Deploy (with the user's approval)
- After the phase 6 deploy; database backup first. Env: `PORTAL_HOSTS=antrenor,sportiv`; Next `PORTAL_HOST_SPORTIV`. DNS, nginx block and certificate for `sportiv.`; Google OAuth redirect URI `https://sportiv.<domain>/api/portal/google/callback`; restart twice if a new attribute is not saved [R7 D32; memory: schema change needs restart].
- VM egress: Strapi already reaches `skate-api.codrin.space`; confirm in the egress unit.
- Pilot 3 to 5 families, then bulk [Q-rec q27].

## 15. Conflicts resolved here
- One access per athlete [P7 q10] replaces "many parent accounts per child" [R7 D7, D9]; the access list becomes one row. The admin block shows one e-mail.
- q11 "no percentage, month switcher" vs the design: the design wins (current season, paged, count card) [DS Istoric].
- q21 "nothing to switch" vs the design's Notificări: the design wins for schedule mails; the new-device mail stays always on [R7 D17; S28].
- q24 "name read only" vs the design's editable Nume: the design wins [DS Setari].
- Design "2FA" row vs keeping 2FA out of phase 7: hidden until P6b-2 [P7 q5].
- Design "12 din 18" on Acasă reads as a mistyped field line: "<category>, <n> concurenți" [S17].
- Research D21 navy header and four tabs "Acasă / Prezență / Plăți / Profil": replaced by the light header and the design's menu [P7 note ice palette].

## 16. Decided by spec author (low impact)
Each "decided by spec author (low impact)"; the user may veto any line.
- S1. No automatic name matching to skate-results; only the admin's slug link.
- S2. Abonament code shown only when the P11 field exists; no code work in phase 7.
- S3. One live access per athlete enforced by a partial unique index created at bootstrap.
- S4. `passwordChangedAt` field for "schimbată acum <n> <unit>": under 60 days in days, else months.
- S5. Invite disabled hints "Confirmă sportivul întâi." and "Adaugă un e-mail în Date."; hidden on anonymized athletes.
- S6. Invite to a fully disabled account refused "Contul acestei adrese este dezactivat."
- S7. "Dezactivează tot" confirmation text.
- S8. E-mail field hints "Accesul în portal trece la <e-mail nou>." and "Accesul în portal se oprește."
- S9. "Scoate accesul" confirmation "Scoți accesul lui <e-mail> la <sportiv>?".
- S10. Admin block copy: title "Acces portal", "Fără acces în portal.", "din <d mmm yyyy>", "Sportiv 18+".
- S11. Bulk preview "<n> invitații către <m> adrese", skip reasons "nou", "fără e-mail", "are deja acces"; one mail per address naming all its children.
- S12. `is-coach` also checks the session host.
- S13. Column 480 px max on wide screens.
- S14. "Sportiv inactiv." line on Acasă; no upcoming list.
- S15. Month bar window: six months from max(season start, current month minus 3).
- S16. Empty texts "Nicio ședință programată.", "Nicio prezență în acest sezon.", "Niciun concurs găsit.".
- S17. Last competition line "<category>, <n> concurenți".
- S18. "Ședința <n>/<slots>" = the next session number (used plus one), capped at slots; a full ticket shows "Ședința <slots>/<slots>".
- S19. Istoric current season only.
- S20. Calendar subline "doar ședințele proprii".
- S21. Calendar "concurs" = `calendar-event` type `concurs` linked to one of the athlete's groups.
- S22. Phone calendar = a downloaded `.ics` from today to the season end, at most 300 items, no subscription feed.
- S23. "Parcurs" kept as the title until renamed.
- S24. Next level = next active group of the same section by `order`; Școala to Club also counts as a promotion.
- S25. Rămas lines per group month, abonament and lesson; "Nimic de plată.".
- S26. The document shown is the `acord` PDF only.
- S27. "Date sportiv" read-only page from the Setări Sportivi row.
- S28. New-device mail row "mereu pornit", no switch.
- S29. Auth headings "Intră în cont", "Bine ai venit".
- S30. Gold, platinum and ice frame colors.
- S31. Badge zoom shows tiers with dates and progress.
- S32. Performance athlete = athlete with a skate slug.
- S33. Skate cache in a table: 1 h for results, 24 h protocol and field size, refresh after response, 3 s timeout.
- S34. Stale line "Rezultatele pot fi mai vechi. Actualizate <d mmm>.".
- S35. A 404 slug = no competitions, logged once a day.
- S36. Category untranslated; short form rule.
- S37. Promotion only to a later group; other changes stored silently.
- S38. Mail texts of 11.1, 11.2.
- S39. Device mail names the host.
- S40. History line texts.

## 17. Taken as recommended (user to confirm)
- q11: overridden by the design: current season, 10 per page, count card, no percentage, no month switcher.
- q12 A: a parent keeps access when the child turns 18; "Sportiv 18+" on the admin block.
- q13 A: age from the birth date on each request; none means a child.
- q14 A: an inactive athlete stays read only; out of the picker when nothing is owed and no presence in 12 months.
- q15 A: Rămas per group month (Club) and per unpaid abonament (Școala), "Avans" when over, no pay button.
- q16 A: no amount and no line for groups without a price list, "inclus" or "fără preț".
- q17 A: "Plata se face la club." under the amount.
- q18 A: payments with date, amount, method, what; cancelled hidden; no recorder.
- q19 A: active ticket in "Grilă curată" plus "Alte abonamente" of the last 12 months.
- q20 A: optional mails to the access account, else the athlete e-mail.
- q21: overridden by the design: a schedule-mail switch in Setări; new-device mail always on.
- q22 A: the invite names the child; "Ai acces și la <copil>" for an existing account.
- q23 A: shared auth and shell parts in one folder, one route group per host, copy split.
- q24: as drawn: name and phone editable by the holder, e-mail read only, no home screen row.
- q25 A: access status derived from the account status.
- q26 A: "Acces portal" block at the bottom of the "Date" tab, disabled while "nou".
- q27 A: bulk "Invită în portal" on Sportivi and a pilot of 3 to 5 families.

## 18. Open for the user
None.
