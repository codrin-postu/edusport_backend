# Phase 6: login and the coach portal (design)

Status: draft v1 for the user's review, 2026-11-04. Covers phase 6a (coach accounts, login, sessions, the coach app, coach schedule editing). Phase 6b (two-factor, passkeys, remembered devices, admin Google login and admin two-factor, admin role split) is outlined in section 13 and gets its own spec and plan [P6 q1, q24].

Parent docs: `docs/architecture/10-spec.md` 3.11, 3.12 and 7; `docs/architecture/08-authentication.md`; `13-roadmap.md` row 6; diagrams `02c` (coach use cases), `03d` (accounts). Builds on `2026-10-27-groups-schedules-design.md` (P4) and `2026-10-27-attendance-payments-design.md` (P5). Research: `edusport_backend/.superpowers/phase6/research.md` (D1-D39 decided, C-a to C-f conflicts). Questions: `.superpowers/phase6/screens/questions.md` and screens `p6-1-scope-stack.html` to `p6-6-sesiuni-limite-domenii.html`. Answers: `.superpowers/phase6/answers.md` (all 25 answered, 2026-11-03 and 2026-11-04).

Precedence: the user's phase 6 answers win over everything below them; then a dated DECISIONS entry (later wins over earlier); then the research items; then specs; then mockups [P5 header; DEC 2026-10-26 3b Q31]. The coach mockups of 2026-10-01 (`edusport_frontend/docs/portal/mockups/coach-mobile.html`, `coach-desktop.html`) give the layout and most strings; they predate the Google and two-factor decisions [R C-e].

Citation keys:
- `[P6 qN]`: phase 6 companion answer N (1 to 25) in `answers.md`; the option text on the screen is the approved meaning.
- `[R Dn]`, `[R C-x]`: research item (decided n, conflict x), with the DECISIONS source named there.
- `[DEC <date> <id>]`: `edusport_frontend/docs/portal/DECISIONS.md`; `[DEC undated]` = the undated "Decided" / "Proposed" blocks (2026-10-01 to 2026-10-03). `[DEC 2026-11-04 p6]` = the phase 6 answer lines appended on 2026-11-04.
- `[P4 x]`, `[P5 x]`: earlier specs. `[MOCK n]`: screen n of `coach-mobile.html`. `[code]`: current code on `feat/athletes`, file named.
- `[S n]`: decided by spec author (low impact) while writing this file, listed in section 15. Each S entry is open to the user's veto.

Copy convention (as P4, P5): quoted copy is the exact UI text; `<name>` marks a value. Romanian, terse, no em dash, no en dash, no middle dot (the mockups join facts with a dot; here they are joined with commas, "grup, 12 copii"), straight quotes "...", no emoji, "E-mail" (not "Email") [DEC 2026-10-27 polish 3; DEC 2026-10-26 gaps 1]. Copy marked [S n] is proposed and goes through the companion screen round before the build (section 14.1).

Visual rules: no pills or circles (only the spinner ring is round), no dashed or dotted lines, selected state = solid primary fill, the "white, no boxes" list look in one Card [DEC undated; DEC 2026-10-06 selected-state-v2; DEC 2026-10-27 polish 1].

## 1. Intent and goals

Coaches stop using the Google Sheet. Each coach gets a personal account, logs in on `antrenor.<domain>` with Google or e-mail and password, sees today's classes, takes presence, records individual lessons, adds a new child, sees his month and hours, and keeps his Club groups' schedule up to date. Everything a coach writes is attributed to him in Istoric. A coach sees only what he needs to run a class: least privilege by group link, checked on every request [R 2.5; P6 q7, q8, q9, q20].

Success:
- The admin types an e-mail on a team member and clicks "Trimite invitația"; the coach sets a password (or uses Google with the same address) from the e-mail within 7 days [P6 q4, q5].
- A coach logs in on one form with Google, e-mail and password; nobody can tell from the answers which e-mails have an account [P6 q23; R D13].
- The session slides for 7 days of idle time and ends after 30 days at most; disabling an account or removing a group link takes effect on the next request [R D12; P6 q7].
- Azi lists the coach's classes and lessons of the day plus "De făcut"; a presence is saved the same way as in the admin Drawer and lands in the same tables [R D22, D26; P5 4.1-4.12].
- A coach can correct a saved presence for 7 days after its date; after that it reads "Arhivată. Nu mai poate fi modificată." and only the admin can change it [P6 q22, q11].
- A coach changes the schedule of his Club groups from today on, and may switch "Program public" on them; the website follows within 5 minutes [P6 q15, q16; R D34].

## 2. Scope

### 2.1 In scope (6a)
- Accounts: portal account record, invite, accept with password or Google, password reset by e-mail code, change password, disable and reactivate, sessions and the device list, lockout and limits, new-device and lockout e-mails (3, 4, 5).
- Hosts: one Next.js app picking the site by host name, `antrenor.` host with its own pages and cookies, portal hosts `noindex` (6, 12).
- Coach app: Azi, Grupe (own and "Alte grupe"), group page with Sportivi and Program, presence (own group and stand-in), individual lessons, "Adaugă sportiv" and "Sportiv nou", athlete card, Istoric with hours, Profil, Setări cont, Securitate (devices only) (9).
- Coach schedule editing of Club groups and the "Program public" switch (8).
- Admin: "Cont portal" block on the team member (invite, resend, disable, reactivate) and the coach name as actor in Istoric (10).
- `/protectia-datelor` gains one paragraph about coaches' access (copy from the club) [P6 q10].

### 2.2 Non-goals
- Phase 6b: two-factor (e-mail code, authenticator app with backup codes, passkey), remembered devices for two-factor, "Folosește cheia de acces", admin Google login, admin two-factor, admin roles beyond today's one role and Super Admin [P6 q1, q24]. Section 13.
- Parent and adult athlete portal (`sportiv.` host), "Invită părintele", parent access after "De confirmat": phase 7 [R D39]. Phase 6a only makes the account model and the host routing ready for it.
- "Staff club" admin role: phase 10 [DEC 2026-10-28 admin trim].
- Apple login [DEC 2026-10-18 user]. Magic links [R 2.2 D].
- Money in the coach app: no amounts, no amounts due, no payments, no prices [R D27, D31].
- E-mails decided against: reminders, attendance-not-done, new-registration alert, admin alert on a coach schedule change [DEC 2026-10-19 notif-q1-emails; P6 q14].
- The coach athlete card redesign (user, later) [R D28].
- Read-access logging [P6 q10].

### 2.3 Anti-goals
- Never give a coach a Strapi admin account or reach a `global::is-admin` route with a portal session [R D4].
- Never hand a Strapi token to the browser; never use the cookie Strapi U&P would set [P6 q3].
- Never filter permissions in the client: every coach route checks the link on the server, on every request [P6 q7].
- Never return a field the coach screen does not show (address, birth date, child e-mail, notes, registrations, documents, payments, amounts, other groups' rosters outside a stand-in session) [P6 q8, q9; R 2.5].
- Never reveal whether an e-mail has an account (same pages, same messages, same timing within reason) [R D13].
- Never lock an account for good [R 2.4; P6 q18].
- No pills, no circles, no dashed or dotted lines.

## 3. Data model

New collection types: `draftAndPublish: false`, hidden from the Content Manager, core routers closed to the Public and Authenticated roles (no `find` / `findOne` exposure), as P4 8.3 and P5 3. Dates `date`, timestamps `datetime` (UTC), "today" in Europe/Bucharest via `todayInBucharest` [code src/club/birth-date.ts].

### 3.1 Identity: Strapi Users & Permissions [P6 q2; R D7]
- `plugin::users-permissions.user` stays the identity and password store (bcrypt as shipped). Username = the e-mail. `confirmed: true` is set by our accept flow; `blocked` mirrors a disabled account.
- `config/plugins.ts` (today `() => ({})`): `users-permissions.config.jwtManagement: 'refresh'`; `sessions.accessTokenLifespan` 10 minutes (default), `idleRefreshTokenLifespan` 7 days, `maxRefreshTokenLifespan` 30 days [R D12; R 2.1]. A spike confirms before anything else is built: refresh rotation on use, revoke by user, revoke of one session, behaviour after password change (section 14.2).
- U&P advanced settings: registration off, e-mail confirmation off (our accept flow confirms), default role Authenticated with no permissions.
- U&P's own routes `/api/auth/*`, `/api/connect/*`, `/api/users*` are closed (route-level deny in the plugin extension `src/extensions/users-permissions/strapi-server.ts`), so login cannot bypass our lockout and no U&P provider (grant) is used [S1].
- `src/index.ts:317` hides the U&P User from the content manager with the comment "There is no login on the frontend so this type is unused": the hiding stays, the comment changes to say accounts are managed from "Cont portal" (10) [code].

### 3.2 Portal account (`api::portal-account.portal-account`, table `portal_accounts`) [R 2.2 recommendation; diagram 03d]
- `user`: oneToOne U&P user, required, unique.
- `email`: string, required, unique, trimmed lower case (the login e-mail; equal to `user.email`).
- `status`: enumeration `invited | active | disabled`, required.
- `teamMember`: oneToOne `api::team-member.team-member`, unidirectional (no inverse attribute on team-member), unique. Set = the account is a coach [S2].
- `phone`: string, optional (Setări cont).
- `googleSub`: string, unique, nullable (the Google account id after the first Google login).
- `invitedAt`, `invitedBy` (admin display name), `activatedAt`, `disabledAt`, `disabledBy`, `lastLoginAt`.
- No `role` enumeration: the coach role comes from `teamMember`, the parent role later from phase 7 access rows, so one account can be both (one account per person) [R D3; S2]. Diagram 03d is updated accordingly.
- Team member stays public website content; nothing account-related is added to `team-member` and its public API never populates the account [code src/api/team-member schema; S2].

### 3.3 Portal token (`api::portal-token.portal-token`, table `portal_tokens`)
- `account` (required), `kind`: enumeration `invite | reset`, `secretHash` (SHA-256 of the secret, never the secret), `expiresAt`, `usedAt`, `tries` (integer, default 0), `createdAt`.
- Invite: a 32-byte random secret in the link, single use, 7 days; a resend makes the older invite tokens of the account used [P6 q5].
- Reset: a 6-digit code by e-mail, single use, 10 minutes, max 5 wrong tries then the code is used up [R D6, D13]. A new code makes the older reset codes used.

### 3.4 Auth limit (`api::portal-auth-limit.portal-auth-limit`, table `portal_auth_limits`) [P6 q18; R 2.1 "per-account lockout must be stored in the DB"]
- `key`: string, unique: `login:<e-mail>`, `ip:<address>`, `mail:<e-mail>`.
- `count`, `windowStart`, `lockedUntil` (nullable), `notifiedAt` (nullable).
- Keyed by the typed e-mail string, not by the account, so an unknown e-mail behaves exactly like a known one (5.4). Rows older than 24 hours with no lock are purged by the existing cron pattern [S3].

### 3.5 Portal device (`api::portal-device.portal-device`, table `portal_devices`) [P6 q17]
- `account` (required), `deviceKeyHash` (SHA-256 of the long-lived device cookie value), `sessionId` (the U&P session id of the current refresh family), `label` (from the user agent: "Telefon, Chrome", "Calculator, Safari"), `firstSeenAt`, `lastSeenAt`, `revokedAt`.
- One row per device per account; a login from a device whose key is unknown for the account creates a row and sends the new-device e-mail (5.6). Revoked rows are purged after 30 days [S3].

### 3.6 E-mail job kind
- `email-job.kind` gains `portal-invite` (queued, retried, as `schedule-change`) [code src/email/email-jobs.ts; R 2.1].
- Reset code, lockout notice and new-device mail are NOT queued: they go through a direct send on `src/email/brevo.ts` and fail visibly (6.4) [R 2.1 "Queue vs instant"]. Outside production every mail goes to the one test address [R D16].

### 3.7 History
- `history-entry.actor` (string) gets "Antrenor <nume>" for every coach write (team member name at the time), so admin screens show who did it without schema change [P6 q14, q10; code history-entry schema]. Sessions and lessons write the same string to `savedBy` / `createdByName` [code session, individual-lesson schemas].
- New subject `portalAccount` in `src/club/subjects.ts` for account lines (11).
- An athlete created by a coach is a normal `athlete` with `status: 'nou'` [code athlete schema enum `nou | activ | inactiv | anonimizat`].

### 3.8 Unchanged
`session`, `attendance`, `individual-lesson`, `group`, `group-membership`, `calendar-event`, `section` (kind `school | club`), `group.programPublic` keep their phase 4 and 5 shapes [code schemas]. No migration of existing rows.

## 4. Accounts and invites

### 4.1 Invite [P6 q4, q5; R D5, D6]
- On a team member, the admin types "E-mail pentru cont" and clicks "Trimite invitația" (10.1). One account per team member; an e-mail already used by another account is refused ("Adresa are deja un cont.") [S4].
- Creates the U&P user (random unusable password), the portal account `invited`, an invite token, and queues `portal-invite`. History line (11).
- "Retrimite invitația" while `invited`: new token, older ones used, new e-mail.
- The invite e-mail links to `https://antrenor.<domain>/invite/<secret>`.

### 4.2 Accept [P6 q5, q6]
- The page shows the e-mail (read only) and two ways: "Parolă nouă" + "Salvează parola", or "Continuă cu Google".
- Password: rules of 5.5. On success: token used, account `active`, `activatedAt`, user `confirmed`, a session is issued and the coach lands on Azi. No new-device e-mail for this first login [S5].
- Google: allowed only when the Google e-mail (verified) equals the invited e-mail; then `googleSub` is stored and the account becomes `active` with no password set. A different Google address: "Contul Google nu are adresa <e-mail>." [S6].
- Expired or used link: "Invitația a expirat. Cere administratorului una nouă." [S7].

### 4.3 Disable and reactivate [P6 q7; R 2.5]
- "Dezactivează contul": `disabled`, user `blocked`, every session of the user revoked, every device row revoked, in one transaction. The next request of any open tab answers 401 and the app shows the login page.
- "Activează contul": back to `active`; the coach logs in again.
- Deleting a team member that has an account disables the account first (lifecycle hook on team-member delete) [S8].
- The team member's name is the coach's display name everywhere; renaming it changes "Antrenor <nume>" for new lines only.

### 4.4 Google login (existing account) [P6 q6; R D8]
- OIDC authorization code flow with PKCE, `state` and `nonce`, built in our auth routes (not the U&P grant provider) [S1].
- Accepted only when the ID token is valid, `email_verified` is true, and either `googleSub` matches an active account or the e-mail matches an active account without `googleSub` (then `googleSub` is stored).
- Anything else: "Nu am găsit un cont pentru adresa asta." [P6 q6]. An `invited` account found by Google e-mail is treated as accept (4.2) [S6].
- Google logins skip two-factor (relevant in 6b) [R D9].

## 5. Server rules: login, sessions, limits

### 5.1 Hosts and roles
- The auth routes take the portal host from the BFF (`antrenor` now, `sportiv` in phase 7). On `antrenor`, only an active account with `teamMember` set may get a session; any other case answers like a wrong password (5.3) [S9].

### 5.2 Session and cookies [P6 q3; R D12, 2.3]
- The Next.js server (BFF) calls Strapi; the browser never sees a Strapi token.
- Cookies set by the BFF, all `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, host-only (no `Domain`), names with the `__Host-` prefix in production: `__Host-es_at` (access token, max-age 10 minutes), `__Host-es_rt` (refresh token, max-age 30 days, rotated on every refresh), `__Host-es_dev` (device key, 400 days). Locally (`antrenor.localhost`, http) the same names without the prefix [S10].
- Separate hosts give separate sessions: a coach who is also a parent logs in on each address [R D3].
- Refresh: when the access cookie is missing or expired, the BFF calls `POST /portal/auth/refresh` once per request burst; an idle refresh token older than 7 days or a family older than 30 days answers 401 -> login page.
- CSRF: `SameSite=Lax` plus an `Origin` check (must equal the portal host) on every mutating BFF handler [R 2.3].
- Logout ("Ieși din cont"): revokes the current session, clears the cookies.
- Password change and reset revoke every other session of the user; the current one stays (change) or none exists (reset) [S11].

### 5.3 Login answers [R D13; P6 q23]
- Wrong e-mail, wrong password, disabled account, account without a coach link on `antrenor`: one answer, "E-mailul sau parola nu sunt corecte." [S12].
- For an unknown e-mail the server still runs one bcrypt compare against a fixed hash, so timing does not tell [S12].

### 5.4 Lockout and limits [P6 q18]
- Per e-mail: 5 wrong passwords within 15 minutes -> 15 minutes pause for that e-mail. During the pause every login with that e-mail answers "Prea multe încercări. Încearcă din nou peste 15 minute." (also for unknown e-mails) [P6 q18; S13].
- On the first lock of a window, when the e-mail belongs to an account, one lockout e-mail goes to the owner (direct send, 6.4). Never more than one per 15-minute window [P6 q18].
- Per IP: 30 login, reset and code attempts per 15 minutes; beyond that the same pause text [S14]. The IP is the client's address, forwarded by the BFF in a header Strapi trusts only with the shared secret (6.1) (decided by Claude, low impact).
- Mail sends (reset code, invite resend by the admin excluded): max 5 per hour per e-mail; beyond that the request answers as if sent and nothing goes out [P6 q18].
- A successful login resets the e-mail counter. U&P's built-in `ratelimit` stays as the floor [R 2.4].
- Lockout is always temporary; the admin needs no unlock button [R 2.4].

### 5.5 Passwords [R D6, D13]
- At least 10 characters, at most 128; refused when in the bundled list of common or leaked passwords (a local file of the top 100 000, no call to a third party) or equal to the e-mail [S15]. The builder picks the list and its license at build time (decided by Claude, low impact).
- Errors: "Parola trebuie să aibă cel puțin 10 caractere." / "Parola este prea ușor de ghicit. Alege alta." [S15].
- Every password field has the eye icon (label "Arată parola" / "Ascunde parola" for screen readers) [R D6; S16].

### 5.6 Reset by code [R D6; DEC undated "Coach login"]
- "Am uitat parola": e-mail -> "Trimite codul" -> always "Dacă adresa are cont, am trimis un cod." [S17].
- Then "Cod din e-mail" + "Parolă nouă" + "Salvează parola". Wrong or expired code: "Codul nu este corect sau a expirat." After 5 wrong tries the code is used up (same message) [R D13].
- An account with only Google (no password yet) can set one this way [S18].
- Success: password set, other sessions revoked, history line, the coach is logged in.

### 5.7 Devices and new-device e-mail [P6 q17; R D15]
- Many sessions at once. Each login binds a device row; Securitate lists the account's devices with "Deconectează" per row (revokes that session).
- A login from a device key unknown to the account sends the new-device e-mail (direct send) with device label, time and "Dacă nu ai fost tu, schimbă parola." [S19].

### 5.8 Live permission check [P6 q7]
- Policy `global::is-coach` (new, `src/policies/is-coach.ts`, beside `is-admin.ts`): verifies the U&P access token and its session, loads the portal account (`active`, user not blocked, `teamMember` set) and attaches `ctx.state.coach = { accountId, teamMemberId, name }`; 401 without a valid session, 403 otherwise [R 2.1].
- Ownership is read from the database on each request: own group = an active group whose `coaches` include the team member [code group schema]. Removing the link takes effect on the next request.
- A portal session never passes `global::is-admin` and an admin token never passes `global::is-coach` (tests, 14.3).

## 6. Routes

### 6.1 Strapi auth routes (`src/api/portal/routes/01-auth.ts`, `{ auth: false }`, our limiter)
- Only the BFF calls these: every request carries the shared secret header, and without it the route answers 403. The BFF forwards the client IP in a header Strapi reads only with that secret; the per-IP limit uses that IP (5.4) (decided by Claude, low impact).
- `POST /portal/auth/login` body `{ host, email, password, deviceKey? }`.
- Google, on the BFF and not on Strapi: `GET /api/portal/google/start?host=&invite=` and `GET /api/portal/google/callback` (the redirect URI of 14.4). State, nonce and PKCE verifier live in a short-lived httpOnly cookie on the BFF; the BFF hands the verified code/token to Strapi over the secret channel (decided by Claude, low impact).
- `POST /portal/auth/refresh`, `POST /portal/auth/logout`.
- `POST /portal/auth/reset/request` body `{ email }`; `POST /portal/auth/reset/confirm` body `{ email, code, password }`.
- `GET /portal/auth/invite/:secret` (valid or expired, e-mail); `POST /portal/auth/invite/accept` body `{ secret, password }`.

### 6.2 Strapi coach routes (`src/api/portal/routes/02-coach.ts`, `{ auth: false, policies: ['global::is-coach'] }`)
- `GET /portal/coach/me`; `PUT /portal/coach/me` body `{ phone }`; `POST /portal/coach/me/password` body `{ current, password }`; `GET /portal/coach/me/devices`; `DELETE /portal/coach/me/devices/:id`.
- `GET /portal/coach/today?date=`: own occurrences and the coach's lessons of the date, plus "De făcut".
- `GET /portal/coach/groups`; `GET /portal/coach/groups/:documentId`.
- `GET /portal/coach/session?occurrence=|id=`; `POST /portal/coach/session/check`; `PUT /portal/coach/session`.
- `GET /portal/coach/lessons/:documentId`; `POST /portal/coach/lessons`; `PUT /portal/coach/lessons/:documentId`; `DELETE /portal/coach/lessons/:documentId`.
- `GET /portal/coach/athletes/search?q=&group=`; `POST /portal/coach/groups/:documentId/members` body `{ athleteIds, from }`; `POST /portal/coach/athletes` (Sportiv nou); `GET /portal/coach/athletes/:documentId`.
- `GET /portal/coach/history?month=YYYY-MM`.
- Program: `GET /portal/coach/groups/:documentId/program?month=`; `POST /portal/coach/groups/:documentId/program`; `PUT /portal/coach/program/:eventId`; `POST /portal/coach/program/:eventId/end`; `DELETE /portal/coach/program/:eventId`; `PUT /portal/coach/program/:eventId/dates/:date`; `PUT /portal/coach/groups/:documentId/program-public` body `{ value }`.
- Static paths before parameter paths, pinned by a source-reading test [P4 8.2].
- The handlers are a thin scoped layer over the existing services: `saveSession` [code src/club/presence/attendance/save.ts], `src/club/presence/attendance/{check,panel,roster,day}.ts`, `src/club/presence/lessons/{create,save,delete,read}.ts`, `src/club/presence/coaches/hours.ts`, `addProgram` / `changeProgram` / `endProgram` / `deleteClass` [code src/club/groups/program.ts], `setDate` [code src/club/groups/program-dates.ts], `src/club/groups/schedule-mail.ts`, `src/club/groups/members.ts`, `addAthlete` pattern [code src/club/athletes/add-status.ts]. Each gets a coach context (actor "Antrenor <nume>", today) beside `presenceContext` [code src/club/presence/context.ts] and the groups context.
- Responses are built by coach view functions that pick fields explicitly; nothing from `src/club/presence/money-api.ts`, `due/`, payments or `billing.ts` amounts is reachable from a coach route [R 2.1].

### 6.3 Strapi admin routes (`src/api/club/routes/12-portal-accounts.ts`, `global::is-admin`)
- `GET /club/team-members/:documentId/account`; `POST /club/team-members/:documentId/account/invite` body `{ email }`; `POST /club/portal-accounts/:documentId/resend`; `POST .../disable`; `POST .../enable`; `POST /club/portal-accounts/:documentId/email` body `{ email }` (Schimbă e-mailul; decided by Claude, low impact).

### 6.4 Direct-send mail
- `sendNow(kind, to, payload)` on `src/email/brevo.ts`: one attempt plus one retry after 2 s; on failure the user sees "Nu am putut trimite e-mailul. Încearcă din nou." (reset only; lockout and new-device failures are logged to GlitchTip, the login itself succeeds or pauses as usual) [S20].

### 6.5 Next.js (edusport_frontend)
- `src/middleware.ts` (new): picks the site by `Host`; `antrenor.<domain>` and `antrenor.localhost` rewrite to the route group `src/app/(antrenor)/`, the main domain to `(site)`; `sportiv.` reserved for phase 7. Each host serves only its own pages; others answer 404 [R D1, D2].
- BFF route handlers under `src/app/(antrenor)/api/portal/[...path]/route.ts`: cookie handling (5.2), Origin check, then server-to-server fetch to Strapi with `Authorization: Bearer <access>`. The Google start and callback (6.1) are static routes beside it, under `src/app/(antrenor)/api/portal/google/` (decided by Claude, low impact).
- Portal host: `robots.txt` "Disallow: /", `X-Robots-Tag: noindex, nofollow`, no sitemap, no Umami script [R 2.1; S21].
- `src/lib/rate-limit.ts` (in-process, `x-real-ip`) guards the BFF login handler as a first layer; the real limits are in Strapi (5.4).

## 7. Coach permissions [P6 q8, q9, q12, q20, q21; R D19, D23, D25, D28]

| Action | Own group | Another coach's group | Școala group (own) |
|---|---|---|---|
| See name, coaches, program, next class | yes | yes ("Alte grupe") | yes |
| See roster | yes | only inside a stand-in presence | yes |
| Take presence | yes | yes, as stand-in (he is in "Antrenor") | yes, column "Grup" only |
| Correct a saved presence (7 days) | yes | only if listed on that session | yes |
| Add existing athlete to the group | yes | no | yes |
| "Sportiv nou" | yes | yes | yes |
| Contact person and phone | yes | no | yes |
| Edit program | yes (Club) | no | no, read only |
| "Program public" switch | yes (Club) | no | no |
| Name, coaches list, price list | no (admin) | no | no |

- "Own group" = the group's `coaches` include the coach's team member, checked live (5.8). A child counts as "in an own group" when he has a current-season membership in one (for the contact rule) [S22].
- Individual lessons: a coach sees and edits lessons where he is in `coaches` [S23].

## 8. Presence, corrections, new athletes

### 8.1 Presence (as P5, coach scope) [R D26; P5 4.1-4.7]
- Columns "Sportiv" | "Grup" | "Uscat"; at Școala only "Grup". The list starts empty of ticks; the coach ticks who came. "Antrenor" defaults to "<nume> (tu)", "+ Adaugă alți antrenori" adds others [MOCK 5; R D24].
- Date button opens a calendar for another day; a day that already has a saved session shows "Există deja o ședință salvată" with "Deschide prezența salvată" / "Adaugă încă o ședință în ziua asta" [code src/club/presence/copy/attendance.ts EXISTING_SESSION; MOCK 5b].
- A day with nothing scheduled: allowed, "În afara programului" [R D36; code copy core.ts].
- Under each name, Școala only: the abonament bar text "<folosite>/<total>" or "Fără abonament"; no validity date; Club rows show no abonament line (Club is billed after training, nothing for the coach) [R D27; P5 4.8; S24].
- Ticking an inactive athlete: same dialog as the admin (P5 REACTIVATE_DIALOG) [code copy attendance.ts].
- A coach may not add a visitor from another group to the session ("Adaugă doar la ședința asta" stays admin only) [S25].
- No deadline to fill a missed presence; it stays in "De făcut" [R D30].

### 8.2 Stand-in [P6 q8, q20; R D24]
- In another coach's group page: "Înlocuiesc azi" opens the presence of today's class (date button for an earlier day within the 7-day window) with the notice "Vei apărea ca antrenor la această ședință." [MOCK 6b].
- The server returns that group's roster (name, age, Școala bar) only for this presence request and only for a date from 7 days ago to today [S26]. Saving requires the coach himself in `coaches`; a save without him is refused with 403 [S26].
- Occurrence keys: the page of another coach's group returns the occurrence keys of its scheduled classes from 7 days ago to today, nothing else. A stand-in covers only a scheduled class; "În afara programului" on another coach's group is refused with 403 (its own coaches or the admin add it) (decided by Claude, low impact).

### 8.3 Corrections: the 7-day window [P6 q22, q11, q12]
- A coach may change a saved session or a saved lesson while today (Europe/Bucharest) is not later than its date plus 7 days. Example: a session of Tuesday 6 Oct can be corrected until the end of Tuesday 13 Oct. The admin can correct any time [P6 q22; P5 4.18]. This replaces "until the end of the month" (DEC 2026-10-11 prezenta-questions-v1 (3)) [DEC 2026-11-04 p6].
- Who: any coach listed on the session, or a coach of its group (current link) [P6 q12]. A coach listed on a session keeps the right to correct it within the same window after his group link is removed (decided by Claude, low impact).
- After the window the session opens read only with the line "Arhivată. Nu mai poate fi modificată." and no save button; the server refuses a write with 403 and the same text [P6 q11].
- A first save of an undone session has no deadline (8.1); its own 7 days count from the session date, so a first save made after day 7 is archived at once for the coach [S27].
- A coach who is not a coach of the group may not remove himself from "Antrenor" on a correction [S28].
- Every correction writes the P5 lines ("Prezență corectată. ...") with actor "Antrenor <nume>" [P5 8; P6 q10].

### 8.4 Individual lessons [R D26; P5 3.3, 5.5]
- "+ Lecție individuală": Sportiv, Data, Ora, Durată (default 50 min, picker hours and 5-minute steps), Antrenor; "Salvează lecția" plans it, "Salvează prezența" records it [MOCK 7, 7b, 7c].
- The athlete is picked with the search of 8.5 [S23]. Price and audience are frozen by the existing lesson save; the coach never sees them [P5 3.3].
- Delete: only a planned lesson he is on; a saved one follows the 7-day correction window, delete included [S23].

### 8.5 Adding an athlete to an own group [R D19; MOCK 8, 8b]
- "+ Adaugă sportiv" on an own group: search first ("Caută după nume"), results from club athletes with status `nou` or `activ`, then "Din data" (default today) and "Adaugă <n> sportiv" / "Adaugă <n> sportivi". Uses the P4 membership add (`mode: add`) [P4; code src/club/groups/members.ts].
- Search scope (user decision) [P6 q25]: all club athletes with status `nou` or `activ`, by name; each result shows only "<nume>, <vârstă> ani". At least 3 letters, at most 8 results, no group names, no "Înscrieri noi" section (registrations stay admin only).
- Last row: "Nu e în listă: sportiv nou" -> 8.6.

### 8.6 "Sportiv nou" [P6 q13, q21; R D25]
- Fields: "Nume și prenume" (required), "Data nașterii" (optional, zz.ll.aaaa), "Părinte" (optional), "Telefon" (optional), "E-mail" (opțional); group preselected (the group the coach came from, any group, also another coach's) [P6 q13, q21].
- Saved as an athlete `nou` with a current-season membership in that group from today; presence and billing count from day one; "Date incomplete" marker as P3 when fields are missing [R D25; DEC 2026-10-27 polish 5].
- The admin confirms it in Sportivi (filter "Nou", the existing status) = "De confirmat"; parent access only after confirmation (phase 7) [R D25; code src/club/sportivi/list-view.ts STATUS_OPTIONS; S29].
- The mockup line "Părintele primește acces la prezență, istoric și plăți." is dropped (phase 7, and only after confirmation) [S29].
- Dedupe: the P3 match refresh runs after the add as for the admin "Adaugă sportiv" [code add-status.ts refreshAllMatches].
- Contact data typed for a child of another coach's group is saved but not shown back to the coach (7) [P6 q21].

### 8.7 Athlete card [P6 q9; R D28, D29]
- Fields: name, age ("<n> ani", from the birth date; blank when unknown), groups (current season, names only), Școala abonament status, and for own-group children "Contact" (contact person) with the phone and "Sună" (`tel:` link) [P6 q9].
- Nothing else: no birth date, no e-mail, no address, no notes, no history of other groups, no percentages [P6 q9; S30]. The mockup card's month counts and recent sessions wait for the card redesign [R D28].

## 9. Coach app screens

Layout: phone bottom bar "Azi" / "Grupe" / "Istoric" / "Profil"; desktop top menu "Azi" / "Grupe" / "Istoric" with Profil under the name menu, list left and detail right [R D20]. Navy header with the EDUSPORT logo and the coach's initials (square tile, not a circle), no yellow border [R D21]. Lists "white, no boxes" in one Card, rows with time left (start only), name, one short sub-line, arrow; the whole row opens [R D22]. Links use the site Link component. Copy below; strings from the mockups are adapted only for the dot and "E-mail" rules.

### 9.1 Login (one form) [P6 q23; R D8]
- Title "Intră în cont"; button "Continuă cu Google"; separator text "sau"; fields "E-mail", "Parolă" (eye icon); button "Intră"; link "Am uitat parola".
- "Folosește cheia de acces" is added under "Intră" in 6b [P6 q23 option text; P6 q1].
- Errors: 5.3, 5.4, 4.4.

### 9.2 Invite, reset
- Invite: title "Bun venit"; line "Contul tău: <e-mail>"; "Parolă nouă", "Salvează parola"; "sau"; "Continuă cu Google" [S7]. Expired: 4.2.
- Reset: title "Am uitat parola"; "E-mail", "Trimite codul"; then "Cod din e-mail", "Parolă nouă", "Salvează parola" [MOCK 1b]; messages 5.6. Back link "Înapoi la intrare" [S17].

### 9.3 Azi [R D22; MOCK 2]
- Greeting "Bună, <prenume>" and the date ("MA 6 OCT" style as the mockup).
- Section "Grupe": own classes of the day, sub-line "grup, <n> copii" (Școala and Club alike) and "Completat" (green label, square) once saved [R D22].
- Section "Lecții individuale": the coach's lessons, sub-line "individuală, <durată>"; button "+ Lecție individuală".
- Section "De făcut": own past classes since the attendance start date with no saved session, newest first, sub-line "grup, <data>" [R D30; P5 3.8].
- Classes the coach takes as stand-in appear in Azi once saved [S31].
- Empty day: "Nicio ședință azi." [S32].

### 9.4 Grupe [R D23; MOCK 3]
- "Grupele mele": name, sub-line "<program>, <n> copii" (program text as P4 list line, e.g. "Ma, Mi 18:15").
- "Alte grupe" (collapsed by default): name, sub-line "Antrenor: <nume>, <nume>".

### 9.5 Group page, own group [MOCK 4; R D32]
- Header: group name; tabs "Sportivi" / "Program" [S33].
- "Sportivi": line "Antrenori: <nume>, <nume>"; button "Fă prezența"; list "Sportivi (<n>)" with name, "<n> ani", label "nou" when status `nou`, "și în <grupă>" for a second group; "+ Adaugă sportiv".
- "Program": 9.8.

### 9.6 Group page, another coach's group [MOCK 6; P6 q8]
- Banner "Grupa altui antrenor"; lines "Program: <program>", "Antrenori: <nume>"; button "Înlocuiesc azi" (shown when the group has a class today; else "Fă prezența ca înlocuitor" opening the date picker within 7 days) [S26]; button "+ Adaugă sportiv" goes straight to "Sportiv nou" (no search in other groups) [P6 q21; S34]. No roster, no Program tab editing (Program read only).

### 9.7 Presence [MOCK 5, 5a, 5b, 6b]
- Header: group, date button ("MA 6 OCT"); "Antrenor", "<nume> (tu)", "+ Adaugă alți antrenori"; columns "Sportiv" | "Grup" | "Uscat".
- Counter "<n> prezenți" ("1 prezent") beside the button "Salvează" [S35].
- Calendar: "Alege ziua pentru care faci prezența.", legend "are prezență salvată", button "Alege <zi> <dată>" [MOCK 5a].
- Toast after save: "Prezență salvată: <grupă>, <dată>." [code sessionSavedToast].
- Saved line: "Salvată de <actor>, <dată> <oră>" [code savedLine].
- Archived: "Arhivată. Nu mai poate fi modificată." [P6 q11].

### 9.8 Program tab (Club groups) [R D32-D36; P4 6.3; P6 q15, q16]
- Same model as the admin, phone layout: "Listă" / "Lună" switch, month navigation, "+ Adaugă program" with "Se repetă" (on: "Cât de des" "Săptămânal" / "La 2 săptămâni" / "Lunar", "Zile", "De la", "Durată", "Se aplică din"; off: one class on a date), "Schimbă" ("Se aplică din") with "Șterge programul", per date "Ține" / "Anulează" / "Mută", tick "Anunță părinții pe e-mail" (off by default) on cancel and move [R D32, D35; P4 6.3 strings and toasts].
- Switch "Program public" with the hint "Programul apare în calendarul de pe site." [P6 q16; S36].
- Past dates read only, shown "trecut" without actions; dates inside a Pauză read only with the P4 notice [P6 q15; R D36].
- Școala group: the same list read only, line "Programul Școlii îl schimbă administratorul." [R D33; S37].
- Coach writes go through the same services as the admin (`addProgram`, `setDate`, the program-public switch), so they write the same P4 3.7 field-change history lines and the same public cache refresh. The plan checks first that those services trigger the refresh; if one does not, the coach and the admin path both get it (decided by Claude, low impact).

### 9.9 Istoric [R D31; MOCK 10]
- Month switcher; summary line "<n> ședințe de grup, <n> lecții individuale, <ore> ore" (P5 hours rule) [P5 4.3].
- Rows: date tile ("7 MI"), name, sub-line "grup, <n> prezenți" / "individuală, <durată>" / "înlocuitor, <n> prezenți"; opens the saved presence (read only after the window) [MOCK 10].

### 9.10 Profil, Setări cont, Securitate [R D6; P6 q17; MOCK 11, 12]
- Profil: name, "Antrenor"; rows "Setări cont", "Securitate", "Ieși din cont".
- Setări cont: "Nume" and "E-mail" read only with the hint "Numele și e-mailul le schimbă administratorul. După schimbarea e-mailului, intri cu adresa nouă." (decided by Claude, low impact); "Telefon" editable; "Schimbă parola" ("Parola actuală", "Parola nouă", "Salvează"); toast "Salvat." [S38]. A Google-only account sees "Setează o parolă" (reset flow) instead of "Parola actuală" [S18].
- Securitate (6a): list "Dispozitiv" | "Ultima dată" (e.g. "Telefon, Chrome", "acesta", "azi" / "ieri" / "<dată>") with "Deconectează" per row [P6 q17 option screen]. Two-factor settings join in 6b.

### 9.11 States and errors
- Loading: the shared spinner. Load failure: "Nu am putut încărca datele." [DEC 2026-10-26 plan 3-4 copy].
- Write refused by a permission change in between: "Nu mai ai acces la această grupă." and the app returns to Grupe [S39].
- Session ended: back to the login page without a message.

## 10. Admin side

### 10.1 "Cont portal" on the team member [P6 q4; R D5]
- A block on the team member edit view (Content Manager injection) and the same actions from the group page coaches list [P6 q4 option text]. States:
  - none: "E-mail pentru cont", "Trimite invitația";
  - invited: "Invitație trimisă pe <dată>.", "Retrimite invitația";
  - active: "Cont activ din <dată>.", "Dezactivează contul";
  - disabled: "Cont dezactivat.", "Activează contul" [S40].
- Action in every state: "Schimbă e-mailul" opens "E-mail nou" with the button "Salvează e-mailul". The old and the new address each get a mail (12), and the change is a history line (11). A new address used by another account is refused ("Adresa are deja un cont.", 4.1) (decided by Claude, low impact).
- Toasts: "Invitație trimisă.", "Cont dezactivat.", "Cont activat.", "E-mail schimbat." [S40].

### 10.2 Istoric and admin screens
- Session panel, lesson panel, athlete and group Istoric show "Antrenor <nume>" as the actor; no screen change needed beyond the actor string [P6 q14].
- "Pe antrenori" is unchanged (it counts from `coaches`, not from who saved) [P5 4.3].

## 11. History lines

Actor "Antrenor <nume>" for coach writes, the admin name for admin writes.
- Presence, lessons: P5 section 8 lines, unchanged.
- Group (P4 3.7 lines for program changes, unchanged) plus "Program public: "Nu" -> "Da"" (field-change pattern) [P4 3.7; P6 q16].
- Athlete: P3 "created" line and the P4 membership line for "Sportiv nou" and "Adaugă sportiv".
- Portal account (subject `portalAccount`) [S41]: "Invitație trimisă la <e-mail>." / "Invitație retrimisă." / "Cont activat." / "Cont activat cu Google." / "Parolă schimbată." / "Parolă resetată." / "Cont blocat 15 minute după 5 încercări greșite." / "Cont dezactivat." / "Cont activat de administrator." / "E-mail schimbat din <vechi> în <nou>." (decided by Claude, low impact). Successful logins are not history lines (the device list holds them).

## 12. E-mails (Brevo, layout "letter" E1, Romanian) [R D15, D16; P5 9]
All texts below are [S42], to be shown in the companion round.
- Invitation (queued): subject "Contul tău EduSport de antrenor"; "Bună ziua, <nume>," / "Ai un cont pe antrenor.<domain>." / button "Intră în cont" / "Linkul este valabil 7 zile." / "Echipa EduSport".
- Reset code (direct): subject "Codul pentru parola nouă"; "Codul tău: <cod>" / "Este valabil 10 minute." / "Dacă nu ai cerut tu, ignoră acest e-mail.".
- Lockout (direct): subject "Încercări de intrare în cont"; "Am oprit intrarea în contul tău pentru 15 minute după 5 parole greșite." / "Dacă nu ai fost tu, schimbă parola după pauză.".
- New device (direct): subject "Intrare de pe un dispozitiv nou"; "<dispozitiv>, <dată> <oră>." / "Dacă nu ai fost tu, schimbă parola.".
- E-mail change (direct, to the old and the new address): subject "Adresa contului tău de antrenor s-a schimbat"; "Adresa contului tău a fost schimbată în <e-mail nou>." / "Dacă nu ai fost tu, anunță administratorul." (decided by Claude, low impact).

## 13. Phase 6b outline (own spec, decided rules carried over)
- Two-factor in the portal, each optional for everyone: e-mail code (AAL1), authenticator app with hashed backup codes (AAL2), passkey on supporting devices (AAL2); Google logins skip it; settings in Securitate with remembered devices [R D9, D11].
- Passkeys: WebAuthn `rpId` = the registrable domain (`scoaladepatinaj.com`) so one key works on `antrenor.` and `sportiv.` [R D3, 2.3]; offered as "Folosește cheia de acces" on the one-form login plus browser autofill on the e-mail field (conditional UI), since an e-mail-first page is not used [P6 q23].
- Admin login: e-mail and password or "Continuă cu Google", then optional two-factor; admin Google skips it; Strapi version pinned and the custom login tested on every update [R D14; P6 q24].
- Admin roles: split beyond one admin role and Super Admin [R D17; P6 q24].
- Companion screens first: login with passkey button, two-factor prompt, Securitate with factors [R 3 process note].

## 14. Builder notes

### 14.1 Before building
- Companion screen round (one screen per group, real component renders, light mode overrides): login, invite, reset, Azi, Grupe, own and other group page, presence with the archived state, Program tab on a phone, Setări cont, Securitate, the "Cont portal" block, the four e-mails [DEC 2026-10-27 phase 4 mockups pattern; R 3 process note; memory rule: decisions in companion].
- Strings marked [S n] are confirmed or changed in that round; the copy module is the single place to change them (`src/club/portal/copy.ts` and the frontend copy file).

### 14.2 Spike (first plan task)
U&P `jwtManagement: 'refresh'` on Strapi 5.52.1: login through our controller issuing a session for a user id, refresh rotation, idle 7 days and max 30 days honoured, revoke one session and all sessions of a user, the session manager origin name for U&P, and that U&P's own routes can be closed. Gate: nothing after the spike is built until it passes. If refresh mode cannot be driven from our controller, the fallback is our own opaque session table in Strapi (hashed token, device, last seen), with the same Securitate list (decided by Claude, low impact).

### 14.3 Tests
- Unit (pure, `src/club/portal/__tests__/`): 7-day window boundary in Europe/Bucharest (day 7 allowed, day 8 refused, DST change week), lockout windows and per-e-mail keys for unknown e-mails, mail send cap, password rules, token expiry and single use, device label parsing, coach view field allow-lists.
- Ownership matrix through the routes: own / other / Școala / removed link / disabled account; every money route and every `/club/*` route answers 401 or 403 to a portal session; coach responses contain no `price`, `amount`, `charges`, `birthDate`, `email` of a child, `notes` keys.
- Enumeration: unknown e-mail, wrong password, disabled and non-coach accounts give identical status and body.
- Session expiry: idle 7 days, max 30 days, revoke on disable, revoke on password change, logout.
- Reset code reuse, invite reuse and expiry, Google with a different e-mail, Google for an unknown e-mail.
- Frontend: host routing (each host serves only its pages), `noindex` headers, cookie flags, Origin check.
- Portal auth routes answer 403 without the BFF secret; the per-IP limit counts the forwarded IP (decided by Claude, low impact).
- Boot check on a throwaway Postgres as P5 11.4: new tables, an invited and an active synthetic coach (`antrenor1@example.invalid`), a full presence save and correction from the coach routes.

### 14.4 Deploy and hosts [P6 q19; R 2.3]
1. After the phase 2-5 deploy window; database backup first.
2. Club items (blocking production, not the build): DNS A records for `antrenor.scoaladepatinaj.com` (and `sportiv.` reserved), the Brevo SPF/DKIM/DMARC work already open, a Google Cloud OAuth client (consent screen in the club's name, redirect `https://antrenor.scoaladepatinaj.com/api/portal/google/callback`).
3. VM: nginx server block for `antrenor.` proxying to the same Next container, TLS certificate (Let's Encrypt, one more name), `X-Real-IP` passed; the egress policy unit on the VM allows Strapi to reach `oauth2.googleapis.com` and `www.googleapis.com` [memory: VM egress policy].
4. Env: Strapi `PORTAL_GOOGLE_CLIENT_ID`, `PORTAL_GOOGLE_CLIENT_SECRET`, `PORTAL_HOSTS`; Next `PORTAL_HOST_ANTRENOR`; `PORTAL_BFF_SECRET` on both, the BFF-to-Strapi secret of 6.1 (decided by Claude, low impact). Strapi CORS unchanged (server-to-server).
5. Restart the backend twice if a new attribute is not saved [memory: schema change needs restart].
6. Test and local: `antrenor.localhost:3010` against Strapi 1340; mail to the test address only; synthetic coaches only.
7. Diagrams with the build: 02c (coach use cases), 03d (portal account without role enum, token, device, auth limit), a sequence for login and refresh.
8. `/protectia-datelor` paragraph from the club before coaches get invites [P6 q10].

### 14.5 Delivery (decided by Claude, low impact)
- Two plans: backend first (branch feat/athletes, this repo); frontend second on a feat/portal branch in edusport_frontend, cut from its current working branch.
- Each repo runs its own test runner.
- The copy companion round (S1-S43) runs before the frontend plan.

## 15. Decided by spec author (low impact)
- S1 decided by spec author (low impact): our own auth routes and OIDC code; U&P's `/api/auth/*`, `/api/connect/*`, `/api/users*` closed.
- S2 decided by spec author (low impact): no role enum on the account; coach = `teamMember` set; relation only on the account side so the public team-member API cannot leak it.
- S3 decided by spec author (low impact): purge unlocked limit rows after 24 h and revoked devices after 30 days.
- S4 decided by spec author (low impact): an e-mail can belong to one account only; refusal "Adresa are deja un cont.".
- S5 decided by spec author (low impact): no new-device e-mail on the accept login.
- S6 decided by spec author (low impact): Google accept only with the same verified e-mail; "Contul Google nu are adresa <e-mail>."; an invited account reached by Google is accepted.
- S7 decided by spec author (low impact): invite page title "Bun venit", line "Contul tău: <e-mail>", expired text "Invitația a expirat. Cere administratorului una nouă.".
- S8 decided by spec author (low impact): deleting a team member disables its account first.
- S9 decided by spec author (low impact): on `antrenor` an account without a coach link is answered as a wrong password.
- S10 decided by spec author (low impact): three cookies (access 10 min, refresh 30 days rotated, device key 400 days), `__Host-` prefix in production.
- S11 decided by spec author (low impact): password change keeps the current session and ends the others; reset ends all.
- S12 decided by spec author (low impact): one login error "E-mailul sau parola nu sunt corecte." and a dummy bcrypt compare for unknown e-mails.
- S13 decided by spec author (low impact): pause text "Prea multe încercări. Încearcă din nou peste 15 minute."
- S14 decided by spec author (low impact): per-IP limit 30 attempts per 15 minutes.
- S15 decided by spec author (low impact): passwords 10 to 128 characters, local list of 100 000 common or leaked passwords, no third-party call; the two error texts.
- S16 decided by spec author (low impact): eye icon labels "Arată parola" / "Ascunde parola".
- S17 decided by spec author (low impact): reset texts "Dacă adresa are cont, am trimis un cod.", "Codul nu este corect sau a expirat.", "Înapoi la intrare".
- S18 decided by spec author (low impact): a Google-only account sets a password through the reset flow ("Setează o parolă").
- S19 decided by spec author (low impact): a device = a long-lived device cookie; new-device mail when the key is new for the account.
- S20 decided by spec author (low impact): direct send with one retry; reset failure text "Nu am putut trimite e-mailul. Încearcă din nou."
- S21 decided by spec author (low impact): no Umami on portal hosts.
- S22 decided by spec author (low impact): "in an own group" = a current-season membership in an own group.
- S23 decided by spec author (low impact): lessons visible and editable to coaches listed on them; the athlete picked with the 8.5 search; only planned lessons deleted freely, saved ones within 7 days.
- S24 decided by spec author (low impact): Club rows show no abonament line; Școala rows "<folosite>/<total>" or "Fără abonament".
- S25 decided by spec author (low impact): "Adaugă doar la ședința asta" (visitor) stays admin only.
- S26 decided by spec author (low impact): stand-in roster readable for dates from 7 days ago to today; saving requires the coach in "Antrenor"; "Înlocuiesc azi" or "Fă prezența ca înlocuitor".
- S27 decided by spec author (low impact): the 7 days always count from the session date, also after a late first save.
- S28 decided by spec author (low impact): a stand-in cannot remove himself from "Antrenor" on a correction.
- S29 decided by spec author (low impact): "De confirmat" = the Sportivi status filter "Nou"; the mockup line about parent access is dropped.
- S30 decided by spec author (low impact): the athlete card shows no percentages or recent sessions until its redesign.
- S31 decided by spec author (low impact): stand-in classes appear in Azi after saving.
- S32 decided by spec author (low impact): empty Azi text "Nicio ședință azi."
- S33 decided by spec author (low impact): coach group page tabs "Sportivi" / "Program" (no Istoric tab for coaches).
- S34 decided by spec author (low impact): in another coach's group "+ Adaugă sportiv" opens "Sportiv nou" directly.
- S35 decided by spec author (low impact): counter "<n> prezenți" beside "Salvează" (replaces the mockup counter inside the button).
- S36 decided by spec author (low impact): "Program public" hint "Programul apare în calendarul de pe site."
- S37 decided by spec author (low impact): Școala Program line "Programul Școlii îl schimbă administratorul."
- S38 decided by spec author (low impact): name and e-mail read only in Setări cont, phone stored on the account.
- S39 decided by spec author (low impact): "Nu mai ai acces la această grupă." after a lost link.
- S40 decided by spec author (low impact): "Cont portal" block states and toasts of 10.1.
- S41 decided by spec author (low impact): account history lines of 11.
- S42 decided by spec author (low impact): the four e-mail texts of 12.
- S43 decided by spec author (low impact): no undo toast in the coach app; presence is corrected by saving again, a cancelled date is restored with "Ține".

## 16. Open for the user
None.

## 17. Conflicts between sources (resolved here, flagged for the user)
1. P6 q23 B (one form) vs DEC 2026-10-18 passkey-flow-v4 (e-mail first): the later answer wins; passkeys in 6b use a button plus autofill on the one form (13).
2. P6 q22 (7 days after the session) vs DEC 2026-10-11 prezenta-questions-v1 (3) (until month end), repeated in research D30 and 2.1 and in P5 2.2 and 14.5: 7 days wins; P5 wording is historical.
3. DEC undated "Am uitat parola resets via an emailed code" vs research 2.4 / screen 2 note "reset links stay 1 hour": the decided code wins (6 digits, 10 minutes).
4. Mockup 8c "Sportiv nou" requires birth date and parent phone and promises parent access; P6 q13 makes only the name required, parent access is phase 7 after confirmation.
5. Mockup 9 athlete card (month counts, percentage, recent sessions) vs P6 q9 A field list: q9 wins.
6. Mockup 8 "Adaugă sportiv" lists "Înscrieri noi" (registrations) to coaches: dropped, registrations are admin only (R 2.5); see Open 1.
7. P6 q18 lockout e-mail to the owner is a mail kind not in DEC 2026-10-19 notif-q1-emails' "always sent" list; q18 adds it.
8. P6 q16 B gives coaches the "Program public" switch on Club groups; phase 4 had it as an admin setting (DEC 2026-10-27 phase 4 mockups 9); the later answer wins for Club groups, Școala stays admin only.
9. Research D18/D19 "removed from a group loses rights the next day" (Proposed) vs P6 q7: at once.
10. Diagram 03d `PortalAccount.role coach|parent` vs one account per person (DEC 2026-10-19 subdomains-v1): roles derived (S2), diagram updated.
