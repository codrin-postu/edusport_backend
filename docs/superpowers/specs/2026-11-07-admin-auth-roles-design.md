# Phase 6b: admin login and roles, 2FA, passkeys (design)

Status: draft v1 for the user's review, 2026-11-07. Covers phase 6b as outlined in the phase 6 spec section 13: our own admin login page with Google, 2FA for the admin and the coach portal, passkeys for both, and the admin role split. Builds on `2026-11-04-coach-portal-design.md` (P6), whose session, lockout, device and mail patterns are reused.

Parent docs: `docs/architecture/08-authentication.md`; `13-roadmap.md` rows 6 and 10; `2026-11-04-coach-portal-design.md` sections 4, 5, 6.1, 12, 13; `2026-11-07-admin-views-design.md` (P11) for the money pages and exports. Research: `edusport_backend/.superpowers/phase6b/research.md` (22 decided items, conflicts C1 to C9, findings 3.1 to 3.6). Questions: `.superpowers/phase6b/screens/questions.md` (screens p6b-1 to p6b-5). Answers: `.superpowers/phase6b/answers.md` (all 21 answered, 2026-11-07, plus two user notes).

Precedence: the user's phase 6b answers and notes win over everything below them; then a dated DECISIONS entry (later wins over earlier); then the research items; then earlier specs; then mockups [P6 header; DEC 2026-10-26 3b Q31].

Citation keys:
- `[P6b qN]`: phase 6b companion answer N (1 to 21) in `answers.md`; the option text on the screen, read with the research point it names (P1 to P21), is the approved meaning.
- `[P6b user note]`: the user's notes in `answers.md`: codes and secrets to security standard (CSPRNG, slow salted hash or server-keyed HMAC, never in clear, TOTP secret encrypted at rest, single use, constant-time compare, attempt limits, nothing a database leak can turn back into usable codes), and the copy rule "2FA", never "verificare în doi pași".
- `[R6b n]`, `[R6b Cn]`, `[R6b 3.x]`: research decided item n, conflict n, finding section.
- `[DEC <date> <id>]`: `edusport_frontend/docs/portal/DECISIONS.md`. `[DEC 2026-11-07 p6b]` = the answer lines appended with this spec.
- `[P6 x]`, `[P11 x]`: earlier specs. `[AUTH]`: `08-authentication.md`. `[RM n]`: roadmap row n. `[code]`: current code on `feat/athletes`, file named; `[strapi]`: `@strapi/admin` 5.52.1 in `node_modules`, file named.
- `[S n]`: decided by spec author (low impact) while writing this file, listed in section 15. Each S entry is open to the user's veto.

Copy convention (as P6): quoted copy is the exact UI text; `<name>` marks a value. Romanian, terse, no em dash, no en dash, no middle dot, straight quotes "...", no emoji, "E-mail". The second factor is called "2FA" in every visible string; "verificare în doi pași" is never used [P6b user note]. Copy marked [S n] goes through the companion screen round before the build (14.1).

Visual rules: no pills or circles (only the spinner ring is round), no dashed or dotted lines, selected state = solid primary fill, the "white, no boxes" list look in one Card [DEC undated; DEC 2026-10-06 selected-state-v2; DEC 2026-10-27 polish 1].

## 1. Intent and goals

Today an admin opens every athlete's data with a password alone [AUTH finding 4], Strapi's own login page carries our branding by DOM injection, and any admin sees everything [DEC 2026-10-19 admin-q1-roles]. Phase 6b closes those gaps: one login page of ours for the admin, an optional 2FA for admins and coaches, passkeys as a password-free sign-in, and three admin roles enforced on the server.

Success:
- An admin opens `cms-edusport.codrin.space/admin`, lands on our page `/intrare`, signs in with e-mail and password or "Continuă cu Google", passes 2FA when he turned it on, and lands in `/admin` with Strapi's own session [P6b q2, q3; DEC 2026-10-18 auth-levels-v1].
- No Strapi route issues an admin session behind our page: login, register, register-admin, reset-password and forgot-password are closed [P6b q4; R6b 3.1].
- A coach or an admin turns on 2FA in "Securitate" with an authenticator app or a code by e-mail, gets 10 backup codes once, and a device he ticks is not asked again for 30 days [P6b q5, q6; DEC 2026-10-18 twofactor-v2].
- A database dump alone yields no usable TOTP secret, backup code, e-mail code or session [P6b user note].
- A coach or an admin signs in with a passkey on `codrin.space` hosts now; after the move to `scoaladepatinaj.com` everyone enrols again by the plan of 8.6 [P6b q10].
- An "Editor site" admin sees only website content; payments, subscriptions, the phase 11 money pages and exports, and coach accounts are for Super Admin and "Administrator club"; the server refuses what the menu hides [P6b q17 to q20].

## 2. Scope

### 2.1 In scope, in build order [P6b q1]
1. 6b-1 Admin security: the spike (14.2); the `/intrare` page; the route gate; admin Google; admin lockout, devices and new-device mail; the shared 2FA core (app, e-mail code, backup codes, remembered devices) with the admin "Securitate" page; reset of a lost 2FA.
2. 6b-2 Portal 2FA: the second step after a coach's password login, the 2FA part of the coach "Securitate", "Resetează 2FA" on "Cont portal".
3. 6b-3 Passkeys: admin and coach, button and autofill, Securitate list, the one-time offer, the domain-move plan.
4. 6b-4 Roles: three roles, the role map, the `global::has-role` policy on every admin route, menus and pages hidden from the same map.

Delivery split (decided by Claude, low impact): this is one plan, the backend (6b-1 to 6b-4 server, tests, deploy) plus the `/intrare` bundle and the admin Securitate page (admin bundle). Coach screens and the BFF changes are a separate frontend plan that starts after the backend routes are green. The companion round (14.1) is task 0 of each plan and blocks all UI work, not the server work.

### 2.2 Non-goals
- Mandatory 2FA for anyone, and any banner asking admins to turn it on [P6b q8].
- Asking again for a password or code before a sensitive change (adding a passkey, turning 2FA off, changing the password) [P6b q9].
- A hardware-key-only rule for Super Admin; attestation or authenticator allowlists [P6b q11].
- Related Origin Requests (`/.well-known/webauthn`) to carry passkeys across the domain move [R6b 3.4; P6b q10].
- A community 2FA plugin; an nginx or IP allowlist in front of the admin [P6b q2].
- Strapi SSO (Enterprise) [R6b 13].
- Parent portal (`sportiv.` host): phase 7 reuses the portal parts built here [R6b 4].
- Phase 10 trim items (telemetry, NPS, promos, plugin removal) stay in phase 10 [P6b q21].
- SMS codes, Apple login, magic links [DEC 2026-10-18 user; P6 2.2].

### 2.3 Anti-goals
- Never store a TOTP secret, a backup code or an e-mail code in clear, and never log one [P6b user note].
- Never let a password alone open the admin while the owner has 2FA on, through any Strapi route [P6b q4; R6b 3.1].
- Never decide a role from a token claim: roles are read from the database on every request [R6b 3.5; code src/club/admin-auth.ts].
- Never hide a menu item without the server refusing the same area, and never refuse without hiding [P6b q18].
- Never create an admin from a Google login [R6b 4; P6b q16].
- Never reveal whether an e-mail has an account, on the admin page as on the portal [P6 5.3].
- No pills, no circles, no dashed or dotted lines.

## 3. Data model

New collection types follow P6 3: `draftAndPublish: false`, hidden from the Content Manager, core routers closed to the Public and Authenticated roles, timestamps `datetime` (UTC). A "subject" is either a portal account (`subjectType: 'portal'`, `subjectId` = portal account documentId) or an admin user (`subjectType: 'admin'`, `subjectId` = `admin::user` id as a string); plain columns, no polymorphic relation [S1].

### 3.1 2FA factor (`api::auth-factor.auth-factor`, table `auth_factors`)
- `subjectType`, `subjectId`, `kind`: enumeration `totp | email`; unique on the three.
- `secretBox`: text, nullable (TOTP only): the sealed secret of 5.2, never returned after enrolment.
- `confirmedAt`: datetime, nullable. An unconfirmed row is an enrolment in progress and is purged after 15 minutes [S2].
- `lastStep`: biginteger, nullable (TOTP replay guard, 5.3); `lastUsedAt`, `createdAt`.

### 3.2 Backup code (`api::auth-backup-code.auth-backup-code`, table `auth_backup_codes`)
- `subjectType`, `subjectId`, `batch` (random id of the set), `codeMac` (5.4), `keyId`, `usedAt` (nullable), `createdAt`. Ten rows per batch; a new batch marks every older unused row used [P6b q6].

### 3.3 Challenge (`api::auth-challenge.auth-challenge`, table `auth_challenges`)
- `purpose`: enumeration `pending-login | email-code | reset-code | passkey-register | passkey-login`.
- `subjectType`, `subjectId` (nullable for `passkey-login`, where the key names the subject), `secretMac` (HMAC of the secret the browser or mail holds; for passkey purposes the WebAuthn challenge itself, which is single use and useless without the private key) [S3].
- `data`: json (pending login: method offered, `rememberMe`, host, device key hash; never a password or code).
- `expiresAt` (pending login and codes 10 minutes, passkey 5 minutes), `usedAt`, `tries` (default 0).
- The admin password reset code lives here (`reset-code`, subject admin); the portal keeps `portal_tokens` for its reset and invite [P6 3.3].

### 3.4 Passkey (`api::auth-passkey.auth-passkey`, table `auth_passkeys`)
- `subjectType`, `subjectId`, `credentialId` (base64url, unique), `publicKey` (base64url COSE key), `counter` (biginteger), `transports` (json), `deviceType` (`singleDevice | multiDevice`), `backedUp` (boolean), `rpId` (the rpId it was made for, 8.6), `name` (string, max 60), `createdAt`, `lastUsedAt`.
- At most 10 per subject [R6b 4].

### 3.5 Admin account (`api::admin-account.admin-account`, table `admin_accounts`)
- `adminUserId`: integer, unique (Strapi's `admin::user` cannot take new attributes) [S4].
- `googleSub`: string, unique, nullable [P6b q16]; `webauthnUserId`: string (32 random bytes, base64url), the WebAuthn user handle; `lastMethod`: `totp | email | backup`, nullable; `passkeyOfferedAt`: datetime, nullable [P6b q12].
- Created on first need (login, Securitate) for an existing admin.

### 3.6 Admin device (`api::admin-device.admin-device`, table `admin_devices`) [P6b q15]
- As `portal_devices` [P6 3.5]: `adminUserId`, `deviceKeyHash` (SHA-256 of the device cookie), `strapiDeviceId` (the `deviceId` passed to Strapi's session manager, so "Deconectează" ends that session), `label`, `firstSeenAt`, `lastSeenAt`, `twoFactorUntil` (nullable), `revokedAt`.

### 3.7 Portal changes
- `portal_accounts` gains `webauthnUserId`, `lastMethod`, `passkeyOfferedAt` (as 3.5) [S4].
- `portal_devices` gains `twoFactorUntil` (nullable) [P6b q5].
- `portal_auth_limits` is reused for the admin and for 2FA with new key prefixes: `admin:login:<e-mail>`, `admin:ip:<address>`, `admin:mail:<e-mail>`, `2fa:<subjectType>:<subjectId>` [P6b q13; R6b P13].
- The portal reset code moves from plain SHA-256 to the keyed MAC of 5.4 (a 6-digit code under plain SHA-256 is reversed from a dump in milliseconds) [P6b user note; S5]. Invite secrets and session tokens keep SHA-256 (32 random bytes cannot be guessed back) [code src/club/portal/tokens.ts, sessions-own.ts].
- Cutover (decided by Claude, low impact): pending portal reset codes stored as SHA-256 are invalid after deploy, because the check moves to the keyed MAC above; the user requests another (10 minute lifetime). No compatibility shim.

### 3.8 History
- New subject `adminUser` in `src/club/subjects.ts` for admin 2FA lines; `portalAccount` gets the 2FA lines of section 13 [P6 3.7; P6b q7].

### 3.9 Purge
The daily portal purge [code src/club/portal/purge.ts] also removes: unconfirmed factors older than 15 minutes, used or expired challenges older than 1 day, used backup codes older than 30 days, revoked admin devices older than 30 days, and old-rpId passkeys 30 days after the domain move (8.6) [S6].

## 4. Admin login

### 4.1 The page [P6b q3; R6b 3.1]
- Our own page on the CMS host at `/intrare` (with `/intrare/invitatie`, `/intrare/parola`, `/intrare/2fa`, `/intrare/cheie`), served by a global middleware `global::admin-login-page` (`src/middlewares/admin-login-page.ts`) from a bundle built from `src/admin-login/` with its own Vite config into `dist/admin-login/`. It reuses `src/admin/ui` components and tokens and the brand layer art of `src/admin/dashboard/loginBranding.ts`, which leaves the Strapi login page with the move [S7].
- Every `/admin/auth/*` address goes to `/intrare`: the server answers a GET with 302 (keeping `registrationToken` and `code` in the query), and the admin bundle's bootstrap (`src/admin/app.tsx`) replaces the location when the SPA navigates there on its own (logout, expired session) [S7]. `AUTH_COPY` and the auth branding injection are removed from `app.tsx`.
- Same-origin JSON calls to `/api/admin-auth/*` (4.3). Every mutating call checks that `Origin` equals `https://<ADMIN_HOST>` (locally `http://localhost:1337`); cookies `HttpOnly`, `Secure` in production, `SameSite=Lax` [P6 5.2 pattern; S8].

### 4.2 Session handoff [P6b q3, q14; R6b 3.1]
- The last step (password without 2FA, second step, Google, passkey, invite accept, reset) calls Strapi's own session manager: `sessionManager('admin').generateRefreshToken(userId, deviceId, { type: rememberMe ? 'refresh' : 'session' })`, sets `strapi_admin_refresh` with Strapi's cookie options (`HttpOnly`, `SameSite` lax, Strapi's path and domain config), then `generateAccessToken` [strapi shared/utils/session-auth.js, server/src/controllers/authentication.js].
- The access token reaches the SPA the way Strapi's own SSO handoff does: with "Ține-mă minte" in `localStorage` `jwtToken` plus `isLoggedIn`; without it in the `jwtToken` cookie the SPA reads [strapi admin/src/reducer.mjs, utils/getFetchClient.mjs, shared/utils/auth-cookie-name.js]. Then `location.assign('/admin')`.
- Lifetimes stay Strapi's defaults: "Ține-mă minte" 14 days idle, 30 days max; otherwise 2 hours idle, 1 day max. `admin.auth.sessions` is not configured [P6b q14].
- `deviceId` = the `strapiDeviceId` of the admin device row (3.6), so one device has one Strapi session family [S9].
- The spike (14.2) proves this before anything else is built; its fallback is written there.

### 4.3 Routes (`src/api/admin-auth/routes/01-login.ts`, `{ auth: false }`, Origin check and our limiter in the controller)
- `POST /api/admin-auth/login` body `{ email, password, rememberMe }` -> session (4.2), or `{ step: '2fa', methods, last }` with the pending cookie of 6.3.
- `POST /api/admin-auth/2fa` body `{ method, code, remember }`; `POST /api/admin-auth/2fa/email` (sends the e-mail code).
- `GET /api/admin-auth/google/start?remember=`; `GET /api/admin-auth/google/callback` (redirect URI `https://<ADMIN_HOST>/api/admin-auth/google/callback`).
- `POST /api/admin-auth/passkey/options`; `POST /api/admin-auth/passkey/verify`.
- `POST /api/admin-auth/reset/request` body `{ email }`; `POST /api/admin-auth/reset/confirm` body `{ email, code, password }`.
- `POST /api/admin-auth/invite/read` body `{ registrationToken }`; `POST /api/admin-auth/invite/accept` body `{ registrationToken, password }` (token in the body, out of the request log [code src/api/portal/routes/01-auth.ts pattern]).
- Fixed paths before parameter paths, pinned by the existing source-reading test [P4 8.2].

### 4.4 Closing Strapi's session issuers [P6b q4; R6b 3.1, P4]
- A global middleware `global::admin-auth-gate` (`src/middlewares/admin-auth-gate.ts`, placed after `strapi::body` in `config/middlewares.ts`) answers 404 to `POST /admin/login`, `POST /admin/register`, `POST /admin/register-admin`, `POST /admin/reset-password` and `POST /admin/forgot-password` [strapi server/src/routes/authentication.js].
- `POST /admin/access-token` (refresh rotation) and `POST /admin/logout` stay Strapi's.
- `PUT /admin/users/me` with a `password`, `currentPassword` or `email` key answers 403: the password changes only in our Securitate (rules of P6 5.5), the e-mail only by a Super Admin [S10]. `PUT /admin/users/:id` with a `password` key answers 403 [S10].
- A first admin on an empty database comes from `npx strapi admin:create-user` on the server; `register-admin` stays closed [S11].
- Every Strapi upgrade re-runs the gate tests and the spike checks; the version stays pinned at 5.52.1 [R6b 14; DEC 2026-10-18 auth-levels-v1].

### 4.5 Password login [P6b q13; P6 5.3, 5.4, 5.5]
- An admin may enter when `isActive` is true and `blocked` is not true; both flags are read on every login and on every request (9.4) [R6b C9; S12].
- Same answers as the portal: "E-mailul sau parola nu sunt corecte." for a wrong e-mail, a wrong password, an inactive or blocked admin; a dummy bcrypt compare for unknown e-mails [P6 5.3; code src/club/portal/auth/context.ts DUMMY_HASH].
- Same limits as the portal on `admin:` keys: 5 wrong passwords per e-mail in 15 minutes -> 15-minute pause "Prea multe încercări. Încearcă din nou peste 15 minute.", one lockout e-mail per window, 30 attempts per IP per 15 minutes, 5 mails per hour per e-mail [P6b q13; code src/club/portal/limits.ts, auth/limit.ts]. The IP is the request IP nginx forwards (`X-Real-IP`, Koa `proxy: true` as today) [S13].
- Strapi's built-in `admin::rateLimit` stays as the floor [R6b P13].
- A login with the password of an admin who has 2FA on and no remembered device gets the second step (6.3).

### 4.6 Google [P6b q16; DEC 2026-10-18 admin-login-pages-v3]
- OIDC code flow with PKCE, `state` and `nonce`, reusing `exchangeCode` and `verifyIdToken` of `src/club/portal/auth/google.ts` [code]; state, nonce and verifier in a 10-minute `HttpOnly` cookie on path `/api/admin-auth/google` [S14].
- Accepted when the ID token is valid, `email_verified` is true, and `googleSub` matches an active admin, or the e-mail equals an active admin's e-mail (case-insensitive) whose admin account has no `googleSub`; then `googleSub` is stored [P6b q16]. Never creates an admin [R6b 4].
- Anything else: "Nu am găsit un cont pentru adresa asta." [P6 4.4 copy].
- Google logins skip 2FA; Securitate advises "Pornește 2-Step Verification în contul Google." [DEC 2026-10-18 admin-login-pages-v3; S15].
- The same Google OAuth client as the portal, with the admin redirect URI added [S14].

### 4.7 Invite and reset [P6b q4; R6b 3.5]
- Admins are still invited in Strapi's Settings, Users (Super Admin only, Strapi's own permission). The link Strapi shows (`/admin/auth/register?registrationToken=`) lands on `/intrare/invitatie` (4.1).
- The page shows the e-mail read only, "Parolă nouă" + "Salvează parola", or "sau" + "Continuă cu Google" (same verified e-mail only). Accept registers through Strapi's `admin::user` service with our password rules (P6 5.5); a Google accept registers with a random 64-character password the admin can replace by reset [P6 4.2 pattern; S16].
- "Am uitat parola": e-mail -> "Trimite codul" -> "Dacă adresa are cont, am trimis un cod." -> "Cod din e-mail" + "Parolă nouă" + "Salvează parola"; 6 digits, 10 minutes, 5 tries, single use, keyed MAC (5.4) [P6 5.6; S16].
- A reset ends every session and remembered device of the admin; if 2FA is on, the second step follows before the session [S17].
- History line and mail as 13 and 12.

### 4.8 Devices and new-device mail [P6b q15]
- Device cookie `__Host-es_adm_dev` on the CMS host (random 32 bytes, 400 days; locally `es_adm_dev`), bound as P6 5.7 [S9].
- A login from a device key unknown for the admin sends the portal's new-device mail [P6b q15; P6 12].
- Admin Securitate lists "Dispozitiv" | "Ultima dată" with "Deconectează" (ends that Strapi session family through `invalidateRefreshToken(userId, deviceId)` and forgets the device) [P6 9.10 pattern].
- A password change ends every other session of the admin and forgets the other devices' 2FA [P6 5.2; S17].
- An admin e-mail change (Super Admin, Settings, Users) clears `googleSub` and ends the admin's sessions, through a lifecycle on `admin::user` [DEC 2026-11-06 q27 pattern; S10].
- Cutover (decided by Claude, low impact): admin sessions opened before the deploy have no `admin_devices` row and keep working until they expire; the first `/intrare` login creates the device row. No compatibility shim.

## 5. Secrets and codes [P6b user note]

### 5.1 Keys
- Two server keys, 32 random bytes each, base64, only in the VM `.env.production` (chmod 600) and the local `.env`, never in the database, the repo or a database backup: `AUTH_SECRET_KEY` (seals TOTP secrets) and `AUTH_CODE_KEY` (MACs codes) [P6b user note; S18].
- Dedicated keys, not Strapi's `ENCRYPTION_KEY` (which seals API tokens), so a rotation of one never breaks the other [S18].
- `keyId` = the first 8 hex characters of SHA-256 of the key. Rotation: the new key becomes current, the old one is set as `AUTH_SECRET_KEY_OLD` / `AUTH_CODE_KEY_OLD` and still opens or checks rows with its `keyId`; a TOTP secret is re-sealed with the current key at its next use [S18].
- Missing or short keys: every 2FA and passkey route answers 503 "2FA nu este disponibil acum." and logs an error; a password login of an account with 2FA on is refused the same way (fail closed) [S19].

### 5.2 TOTP secret at rest
- 20 bytes from `crypto.randomBytes`, shown once at enrolment (QR and text), then sealed: AES-256-GCM, 12-byte random IV, additional data `totp:<subjectType>:<subjectId>` so a sealed value cannot be moved to another subject, stored as `v1.<keyId>.<iv>.<ciphertext>.<tag>` (base64url) [P6b user note; S20].
- Never returned again: Securitate shows "Activ" or "Oprit" only. A new app means turning it off and on [S20].

### 5.3 TOTP check
- RFC 6238: SHA-1, 6 digits, 30 seconds, one step either side; a step at or below `lastStep` is refused (no replay), `lastStep` saved in the same transaction with a row lock [R6b 4].
- Compare-and-set instead of a row lock (decided by Claude, low impact): the `lastStep` save is one guarded `UPDATE` that sets `lastStep` only where the stored value is null or below the accepted step, and counts as accepted only when one row changed. The in-memory store mirrors it.
- Written in `src/club/security/totp.ts` with `node:crypto` (about 40 lines) and tested against the RFC 6238 vectors; no TOTP dependency on the login path [R6b 3.4; S21].
- Enrolment QR: `otpauth://totp/EduSport:<e-mail>?secret=<base32>&issuer=EduSport`, rendered on the server to SVG by `qrcode` pinned to exactly 1.5.4, so both front ends only show it [S21].

### 5.4 Backup codes and e-mail codes
- Backup code: 10 characters from Crockford base32 (no I, L, O, U), each character from `crypto.randomInt`, 50 bits, shown once grouped "XXXXX XXXXX" [P6b q6; P6b user note; S22].
- E-mail code and reset code: 6 digits from `crypto.randomInt` [P6 3.3].
- Stored only as `HMAC-SHA-256(AUTH_CODE_KEY, "<purpose>:<subjectType>:<subjectId>:<normalized code>")`, hex, with `keyId`. Normalized = upper case, spaces and hyphens removed, O read as 0 and I or L as 1 [P6b user note; S22].
- Check: compute the MAC of the typed code once, compare it with `crypto.timingSafeEqual` against every unused code of the subject, with no early exit; mark the match used in the same transaction under a row lock (`usedAt` must still be null), so one code opens once even under parallel requests [P6b user note].
- Single-use check by compare-and-set, not a row lock (decided by Claude, low impact; replaces the row lock named above): `store.ts` exposes `consumeOnce(...)`, implemented in `strapi-store.ts` as one guarded `UPDATE ... SET usedAt WHERE id = ? AND usedAt IS NULL` that returns the row count; 0 is a refusal. No explicit `SELECT ... FOR UPDATE` is needed, since the document service has none. The in-memory store mirrors it, and the race tests of 14.4 run against both.
- Single use: a used backup code never opens again; an e-mail code is used on success or after 5 wrong tries; a new e-mail code makes the older ones used [P6 3.3; P6b user note].
- Server-keyed MAC instead of a slow hash: with 50-bit random codes a keyed MAC is as strong offline while the key is safe, and checking ten codes per attempt with bcrypt would cost a second per try [P6b user note allows either; S22].

### 5.5 Attempt limits [P6b user note; P6b q13]
- Per subject (`2fa:<subjectType>:<subjectId>`): 5 wrong codes of any kind (app, e-mail, backup) in 15 minutes -> the pending login ends and the second step pauses for 15 minutes with "Prea multe încercări. Încearcă din nou peste 15 minute.", plus one lockout mail per window (12) [P6 5.4 rules; S23].
- Per pending login: 5 wrong codes end it; the person starts again from the password [S23].
- Per IP: the 30 per 15 minutes rule counts second-step attempts too [P6 5.4].
- A success clears the subject counter.

### 5.6 What a database leak gives
| Stored | Leak without the env keys |
|---|---|
| TOTP secret | sealed, AES-256-GCM; nothing |
| Backup, e-mail, reset codes | keyed MAC; cannot be tested offline |
| Passkey public key, counter | public by design; signs nothing |
| Passkey and login challenges | single use, 5 to 10 minutes, need the private key or the code |
| Session, refresh, device, invite secrets | SHA-256 of 32 random bytes [code sessions-own.ts, tokens.ts] |
| Passwords | bcrypt as today (Strapi admin, U&P) |

Codes and secrets never reach a log: the request bodies of `/api/admin-auth/*` and `/portal/auth/*` and the 2FA routes are dropped by the Sentry `beforeSend` scrub [code src/middlewares/sentry.ts pattern; S24].

## 6. 2FA rules (admin and portal) [DEC 2026-10-18 twofactor-v2, auth-levels-v1; AUTH]

### 6.1 Methods
- "Aplicație de autentificare" (TOTP, AAL2) and "Cod pe e-mail" (AAL1), each optional, on or off independently; "Coduri de rezervă" come with the first method turned on [DEC 2026-10-18 twofactor-v2; P6b q6, q8].
- A passkey is a sign-in method, not a 2FA method: it replaces password and code, is managed in Securitate beside the methods, and is never asked after a password (8) [R6b C3; AUTH Decisions].
- 2FA is optional for every admin and coach; no banner, no reminder [P6b q8].
- Google logins skip 2FA, in the portal and in the admin [DEC 2026-10-18 admin-login-pages-v3; P6 4.4].

### 6.2 Turning on
- App: Securitate -> "Activează" -> QR, the text key, "Cod din aplicație" -> "Activează". The factor counts only after a right code [S25].
- E-mail: "Activează" sends a code to the account e-mail; typing it turns the method on [S25].
- First method on: the 10 backup codes are shown once ("Descarcă", "Copiază", "Gata") [P6b q6].
- No password or second factor is asked again for these changes [P6b q9]. A mail tells the owner when a method is turned off or a passkey is added (12) [S26].

### 6.3 The second step at login
- After a right password, when the subject has a confirmed method and the device has no valid `twoFactorUntil`, the server answers a pending login instead of a session: a 32-byte secret in an `HttpOnly` cookie (`__Host-es_adm_2fa` on the CMS host; on the portal the BFF keeps it as `__Host-es_2fa`), 10 minutes, its MAC in `auth_challenges` [S27].
- The page offers the last used method (`lastMethod`) with "Altă metodă" listing the others the subject has [DEC 2026-10-18 twofactor-v2].
- "Cod pe e-mail" sends the code when chosen (or when it is the last method), "Trimite din nou" sends a new one within the mail limit [P6 5.4].
- Tick "Ține minte dispozitivul 30 de zile", on by default [P6b q5; S28].
- A right code ends the pending login, saves `lastMethod`, sets `twoFactorUntil` = now + 30 days on the device when ticked, and issues the session (4.2 for the admin, `startSession` for the portal [code src/club/portal/auth/issue.ts]).
- A backup code used at login writes a history line and leaves "Mai ai <n> coduri de rezervă." on the next Securitate visit [S29].

### 6.4 Remembered devices [P6b q5]
- 30 days from the 2FA success on that device, not sliding [S28].
- Forgotten when: the device is disconnected, the password is changed or reset, 2FA is reset by an admin, or the last method is turned off [S28].
- Securitate shows under each device "2FA ținut minte până la <dată>." when set [S28].

### 6.5 Backup codes [P6b q6]
- 10 codes, shown once, never again. "Generează coduri noi" (confirm "Codurile vechi nu vor mai merge.") makes a new batch and cancels the old one.
- Turning the last method off deletes the codes and forgets the remembered devices [S30].

### 6.6 Lost phone, no backup code [P6b q7]
- Portal: on "Cont portal", "Resetează 2FA" (shown when the account has a method), for Super Admin and Administrator club (9.2). Confirm "Resetezi 2FA pentru <nume>? Toate dispozitivele vor fi deconectate." -> methods and backup codes deleted, remembered devices forgotten, every session ended; history line with the admin's name; mail to the owner [P6b q7; S31].
- Admin: a Super Admin resets another admin's 2FA in the admin Securitate section "Administratori" (10.4), same effects, history line, mail. A Super Admin cannot reset his own [P6b q7; S31].
- Last resort: `npm run admin:reset-2fa -- <e-mail>` on the server (`scripts/admin-reset-2fa.ts`), same effects, actor "server" [R6b P7; S31].
- Passkeys stay after a reset; the owner deletes a lost one in Securitate after signing in [S31].

## 7. Portal 2FA (6b-2)

### 7.1 Server
- `loginWithPassword` [code src/club/portal/auth/login.ts]: after `canEnter`, an account with a confirmed method and no valid `twoFactorUntil` on the bound device gets the pending answer (6.3) instead of `startSession`.
- `src/club/portal/auth/reset.ts`: after a reset, an account with 2FA on gets the pending answer [S17].
- Google login and invite accept are unchanged (6.1; a new account has no method).
- Routes, added to `src/api/portal/routes/01-auth.ts` (BFF secret, as P6 6.1): `POST /portal/auth/2fa` body `{ pending, method, code, remember, deviceKey? }`; `POST /portal/auth/2fa/email` body `{ pending }`; `POST /portal/auth/passkey/options`; `POST /portal/auth/passkey/verify` body `{ host, response, deviceKey? }`.
- Securitate routes in a new `src/api/portal/routes/03-security.ts` with `global::is-coach` (the only portal host now; phase 7 swaps in a host-generic policy) [S32]: `GET /portal/me/security`; `POST /portal/me/2fa/totp` (start); `POST /portal/me/2fa/totp/confirm` body `{ code }`; `DELETE /portal/me/2fa/totp`; `POST /portal/me/2fa/email` (send); `POST /portal/me/2fa/email/confirm` body `{ code }`; `DELETE /portal/me/2fa/email`; `POST /portal/me/backup-codes`; `POST /portal/me/passkeys/options`; `POST /portal/me/passkeys` body `{ response, name }`; `PUT /portal/me/passkeys/:id` body `{ name }`; `DELETE /portal/me/passkeys/:id`; `POST /portal/me/passkey-offer/dismiss`.
- Admin side: `POST /club/portal-accounts/:documentId/reset-2fa` in `12-portal-accounts.ts` (area `coachAccounts`, 9.2).

### 7.2 Frontend (edusport_frontend, second plan)
- The BFF login handler keeps the pending secret in `__Host-es_2fa` (10 minutes, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`; locally without the prefix) and never hands it to page script [P6 5.2; S27].
- Pages: `/intrare/2fa` (6.3, 11.2), the offer screen (8.4), Securitate sections (11.3); "Folosește cheia de acces" and autofill on the login form (8.3).

## 8. Passkeys (6b-3)

### 8.1 Library [R6b 3.4]
- Server: `@simplewebauthn/server` pinned to exactly 14.0.3 (backend). Browser: `@simplewebauthn/browser` pinned to exactly 14.0.0 (the `/intrare` bundle and edusport_frontend). No caret ranges; every upgrade is a reviewed change [R6b 3.4; S33].
- Node 22 as today (the library needs 20 or later) [code package.json engines].

### 8.2 Ceremonies
- Register: `rpName` "EduSport", `rpID` from `WEBAUTHN_RP_ID`, user handle `webauthnUserId` (random, never the e-mail or a database id), `userName` the e-mail, `attestationType: 'none'`, `residentKey: 'required'`, `userVerification: 'required'`, `excludeCredentials` the subject's keys, algorithms ES256 and RS256 [R6b 3.4; P6b q11].
- Sign in: discoverable (no `allowCredentials`), `userVerification: 'required'`, challenge single use for 5 minutes in `auth_challenges` [R6b 3.4].
- Verify: `expectedRPID` = `WEBAUTHN_RP_ID`, `expectedOrigin` = the exact list `WEBAUTHN_ORIGINS` (CMS host and coach host), counter saved, `lastUsedAt` set [R6b 3.4].
- Any passkey is accepted, synced or hardware (AAL2) [P6b q11].
- Admin and coach are separate subjects with separate user handles: a person who is both has one key per role. A key of the other kind answers "Cheia nu este pentru această pagină." [S34].
- A passkey sign-in skips the password and 2FA (user verification is the second factor) [AUTH Decisions; DEC 2026-10-18 passkey-flow-v4]. It does not count toward the password lockout; the IP rule counts it [S35].
- Disabled, blocked or inactive subjects: "Nu am putut folosi cheia de acces." (no account detail) [S35].

### 8.3 On the login pages [P6 13; P6 q23]
- One form as today; under "Intră" the button "Folosește cheia de acces" and browser autofill on the "E-mail" field (`autocomplete="username webauthn"`, conditional UI), shown only when the browser supports WebAuthn [P6 9.1; DEC 2026-10-18 passkey-flow-v4]. The OS window for Face ID, fingerprint or PIN is the OS's [R6b 11].
- Cancel or failure: "Nu am putut folosi cheia de acces." [S36].

### 8.4 The one-time offer [P6b q12]
- After a password login (with or without 2FA) on a device where `isUserVerifyingPlatformAuthenticatorAvailable()` is true, a subject with no passkey on the current rpId and no `passkeyOfferedAt` sees once: title "Creează o cheie de acces", line "Intri cu amprenta, fața sau codul telefonului, fără parolă.", buttons "Creează" and "Nu acum" [P6b q12; S36].
- Either button sets `passkeyOfferedAt`; it is never shown again, except once after the domain move (8.6). Securitate always offers "Creează o cheie de acces" on supporting devices [P6b q12].

### 8.5 Domain now [P6b q10]
- `WEBAUTHN_RP_ID=codrin.space` in production now, so one key works on `cms-edusport.codrin.space` and on the coach host the phase 6 deploy gives under `codrin.space`; locally `localhost` (works for `antrenor.localhost`) [P6b q10; R6b 3.4].
- `codrin.space` also hosts other apps (analytics, glitchtip, atelier). A page there could ask the browser for one of our keys, but its assertion carries its own origin, which `WEBAUTHN_ORIGINS` refuses [S37].
- Hosts and env values (decided by Claude, low impact): the CMS and coach hostnames come from the phase 6 deploy notes (`antrenor.<domain>`, the CMS host). `WEBAUTHN_RP_ID=codrin.space` until the move; `WEBAUTHN_ORIGINS` lists the CMS origin and the antrenor origin on that domain. Local origins: `http://localhost:1337` and `http://antrenor.localhost:<port>`. These are deploy-time env values listed in `.env.example`, never code constants. If a host is missing from the phase 6 notes, the plan marks it as a deploy-time env value.

### 8.6 Re-enrolment after the move to scoaladepatinaj.com [P6b q10]
1. The DNS cutover deploy sets `WEBAUTHN_RP_ID=scoaladepatinaj.com` and `WEBAUTHN_ORIGINS` to the new hosts in the same step that moves `cms.` and `antrenor.` [R6b C5].
2. A script `scripts/passkeys-cutover.ts` (dry run first, then real) counts keys per rpId and clears `passkeyOfferedAt` for every subject whose keys are all on the old rpId, so the offer (8.4) shows once more. It deletes nothing [S38].
3. Old-rpId keys are never offered by the browser on the new hosts; Securitate lists them as "Cheie veche, nu mai merge. Creează una nouă." with "Șterge"; the purge removes them 30 days after the move [S38].
4. Admins and coaches sign in on the new host with password (and 2FA) or Google, then create a new key from the offer or Securitate. Every admin and coach has a password or Google, so nobody depends on a passkey alone [P6b q10; S38].
5. TOTP and backup codes are not bound to a domain and keep working. Device cookies are host-bound, so the first login on a new host asks 2FA once and sends the new-device mail; the cutover note to the club says so [S38].
6. The cutover runbook (with the phase 6 hosts runbook, P6 14.4) gets these steps and a check that at least two Super Admins can sign in before the switch [R6b 6; S38].

## 9. Admin roles (6b-4)

### 9.1 Roles [P6b q17]
- "Super Admin": Strapi's `strapi-super-admin`, everything [code src/club/personal-data/roles.ts].
- "Administrator club" (code `edusport-club-admin`): every EduSport page and route, club, money and website, except Super Admin areas: no Strapi Settings, Marketplace, Content-Type Builder, admin users, API tokens; no anonymize or hiding the yearly review; no reset of an admin's 2FA [R6b P17].
- "Editor site" (code `edusport-site-editor`): website content only: articles, announcements, sponsors, collaboration events, history moments, the site pages, team members and competitions, price pages, media, site menu. No athletes, registrations, forms results, attendance, groups, money, settings or coach accounts [R6b P17].
- Roles are created by an idempotent bootstrap (`src/club/roles/bootstrap.ts`, called from `src/index.ts`) with fixed codes, and get Strapi's native Content Manager and Media Library permissions for their website content types only. Club collection types are never granted (they are reached through `/club/*` routes alone) [P6b q18; S39].
- Existing admins (decided by Claude, low impact): no automatic role reassignment. A role with an unknown code gets area `any` only. Strapi's built-in Editor and Author roles stay in place, unmapped. The bootstrap logs every admin that has no EduSport role at boot.
- Native permissions (decided by Claude, low impact): the UID list comes from the `website` rows of 9.4 and from `src/api/*/schema.json`. Both `edusport-club-admin` and `edusport-site-editor` get all five actions, publish included, on those UIDs, plus Media Library read, create, update and delete. Anything not in that list is not granted. The matrix sits in `roles/map.ts` next to the areas, and a test pins it.
- An admin with several roles gets the union of their areas.

### 9.2 One role map [P6b q18]
`src/club/roles/map.ts` (pure, imported by the server and the admin bundle, as `roles.ts` today) holds the areas and who may use them:

| Area | Super Admin | Administrator club | Editor site |
|---|---|---|---|
| `any` (dashboard, own Securitate) | yes | yes | yes |
| `website` | yes | yes | yes |
| `club` (registrations, athletes, groups, schedule, attendance, new season, forms results) | yes | yes | no |
| `money` (subscriptions, payments, De încasat, phase 11 Bani, accounting, every export) | yes | yes | no |
| `coachAccounts` ("Cont portal", "Resetează 2FA") | yes | yes | no |
| `settings` (Setări site, Sezoane) | yes | yes | no |
| `superAdmin` (anonymize, hide yearly review, "Administratori" 2FA reset, saved-view cleanup) | yes | no | no |

- `money` holds the phase 11 money pages and exports for Super Admin and Administrator club [P6b q19; P11 4.1 to 4.9]. `coachAccounts` follows [P6b q20]. The three areas `club`, `money` and `coachAccounts` have the same roles today and stay separate keys so a later change is one line [S40].

### 9.3 Server: `global::has-role` [P6b q18]
- New policy `src/policies/has-role.ts`, config `{ area }`: an access token of an active admin session, the admin active and not blocked (401 otherwise, as `requireAdminUser` [code src/club/admin-auth.ts]), roles loaded from the database, then 403 when no role opens the area.
- Every route in `src/api/club/routes/02` to `13` and `src/api/admin-auth/routes/02-03` names an area. Route files today -> area [code route files]:
  - `02-admin.ts` (`/club/summary`): `any`; the handler answers only the counts of the caller's areas.
  - `03-admin-prices-seasons.ts`: price lists and price notes `website`; seasons `settings`.
  - `03-documents.ts` (admin routes), `04-registrations.ts`, `05-athletes.ts`, `06-groups.ts`, `07-schedule.ts` (admin routes), `08-new-season.ts`, `09-attendance.ts`: `club`, except `/club/attendance/coaches.csv` and the phase 11 `.csv` routes: `money`.
  - `05-athletes.ts` Super Admin routes: `superAdmin` (today `global::is-super-admin`).
  - `10-subscriptions.ts`, `11-payments.ts`, phase 11 `/club/money/*` and `13-tables.ts`: `money`.
  - `12-portal-accounts.ts`: `coachAccounts`.
- `global::is-admin` and `global::is-super-admin` become thin wrappers of `has-role` with `any` and `superAdmin`, and both now refuse a blocked admin (today only the Super Admin one does) [R6b 17, C9; DEC 2026-10-19 admin-q1-roles note].
- A source-reading test fails when an admin route has no area or an unknown one [S41].
- Phase 11 (decided by Claude, low impact): 6b maps only the routes that exist in this worktree. Phase 11 route files name their area from the start; the S41 test enforces it, and a line saying so goes into the P11 plan.

### 9.4 Admin UI: the same map [P6b q18, q21]
- `useAreas()` in `src/admin/lib/` reads `/admin/users/me` once (roles) and replaces `useIsSuperAdmin` [code src/admin/dashboard/sportivi/useSuperAdmin.ts].
- Every entry of `EDUSPORT_LINKS` and every `addMenuLink` in `src/admin/dashboard/menu.tsx` names its area; `EdusportShell` hides entries outside the caller's areas, and each page opened by URL without its area shows "Nu ai acces la această pagină." [S42]. Menu -> area:
  - Formulare, Înscrieri, Voluntari, Parteneri (forms), Contact: `club`.
  - Calendar și serii, Grupe, Sportivi, Prezență: `club`. Sportivi "Tabele", Abonamente, Plăți, De încasat, Bani: `money`.
  - Membri echipă, Competiții, Discipline: `website`; the "Cont portal" block on a team member: `coachAccounts`.
  - Pagina principală, Cursuri, Prețuri, Regulament, Pagina Program, Pagina Echipă, Istoric, Realizări, Parteneri (page), Voluntariat: `website`.
  - Articole, Anunțuri, Sponsori, Evenimente colaborare, Momente istoric, Media, Meniu site: `website`.
  - Setări site, Sezoane: `settings`. Panou EduSport, Securitate: `any`.
- Strapi's own menu (Settings, Marketplace, Content-Type Builder, Content Manager types) hides itself through the native permissions of 9.1 [R6b 3.5].
- Phase 6b builds the roles and the hiding fully; phase 10 keeps only its trim items and drops its "Staff club" role, which "Administrator club" replaces [P6b q21; RM 10].

## 10. Admin screens

### 10.1 Login (`/intrare`) [P6b q3; P6 9.1]
- Brand layer as today (navy shape, EDUSPORT wordmark, "Panou de administrare"); form on the right.
- Title "Intră în cont"; "Continuă cu Google"; "sau"; "E-mail"; "Parolă" (eye icon, "Arată parola" / "Ascunde parola"); tick "Ține-mă minte" [code src/admin/app.tsx AUTH_COPY]; button "Intră"; "Folosește cheia de acces"; link "Am uitat parola" [P6 9.1; S43].
- Errors: 4.5, 4.6, 8.3.

### 10.2 Second step (`/intrare/2fa`) and the offer: as 11.2 and 8.4, same copy.

### 10.3 Invite and reset: as P6 9.2 copy, admin context (4.7).

### 10.4 "Securitate" (admin, `src/admin/pages/SecuritatePage.tsx`, route `/plugins/edusport-securitate`, area `any`) [R6b 4]
- Sections in one page: "2FA" and "Chei de acces" (as 11.3); "Parolă": "Parola actuală", "Parola nouă", button "Schimbă parola", toast "Parolă schimbată." [S44]; "Google": "Conectat: <e-mail>" with "Elimină legătura", or "Neconectat." plus the line "Pornește 2-Step Verification în contul Google." [S15]; "Dispozitive" (4.8).
- Super Admin only, "Administratori": rows "<nume>", "<e-mail>", "2FA activ" / "2FA oprit", action "Resetează 2FA" (not on his own row), confirm and toast as 6.6 [P6b q7; S31].
- Every button on this page opts out of the SaveBar tagger (no "Salvează" or "Publică" label, and the `.pce` opt-out class) [memory: SaveBar tagger gotcha; S44].

### 10.5 "Cont portal" (team member)
- New button "Resetează 2FA" when the account has a method; confirm "Resetezi 2FA pentru <nume>? Toate dispozitivele vor fi deconectate."; toast "2FA resetat." [P6b q7; P6 10.1; S31]. Hidden without `coachAccounts`.

## 11. Portal screens (coach app)

### 11.1 Login: as P6 9.1 with "Folosește cheia de acces" and autofill (8.3).

### 11.2 Second step [DEC 2026-10-18 twofactor-v2; S45]
- Title "2FA".
- App: "Scrie codul din aplicația de autentificare."; field "Cod".
- E-mail: "Am trimis un cod pe <e-mail>."; field "Cod din e-mail"; link "Trimite din nou".
- Backup: "Scrie unul dintre codurile de rezervă."; field "Cod de rezervă".
- Tick "Ține minte dispozitivul 30 de zile"; button "Verifică"; link "Altă metodă" (list "Aplicație de autentificare", "Cod pe e-mail", "Cod de rezervă"); back "Înapoi la intrare".
- Errors: "Codul nu este corect sau a expirat." [code src/club/portal/copy.ts badCode]; pause text 5.5.

### 11.3 Securitate [P6 9.10; DEC 2026-10-18 twofactor-v2; S45]
- "2FA": rows "Aplicație de autentificare" and "Cod pe e-mail", each "Activ" / "Oprit" with "Activează" / "Oprește"; row "Coduri de rezervă", "<n> rămase", "Generează coduri noi".
- App setup: "Scanează codul cu aplicația de autentificare."; "Sau scrie cheia: <cheie>"; "Cod din aplicație"; "Activează".
- E-mail setup: "Am trimis un cod pe <e-mail>."; "Cod din e-mail"; "Activează".
- Backup codes screen: title "Coduri de rezervă"; "Fiecare cod merge o singură dată. Păstrează-le, nu le mai arătăm."; "Descarcă", "Copiază", "Gata".
- Turn off: "Oprești <metodă>?" (last method: "Oprești 2FA? Codurile de rezervă vor fi șterse."), buttons "Oprește" / "Renunță".
- "Chei de acces": rows "<nume>", sub-line "Creată <dată>, folosită <dată>"; "Redenumește" (field "Nume"), "Șterge"; button "Creează o cheie de acces" (supporting devices only); old-rpId rows 8.6.
- "Dispozitive": as P6 9.10, plus 6.4 line.
- Toasts: "2FA activat.", "2FA oprit.", "Coduri noi generate.", "Cheie de acces creată.", "Cheie de acces ștearsă.", "Salvat." (rename).

## 12. E-mails (direct send, Brevo, layout E1) [P6 3.6, 6.4, 12; S46]
- 2FA code: subject "Codul tău pentru 2FA"; "Codul tău: <cod>" / "Este valabil 10 minute." / "Dacă nu ai încercat tu să intri, schimbă parola.".
- 2FA lockout: the P6 lockout mail with the line "Am oprit intrarea în contul tău pentru 15 minute după 5 coduri greșite.".
- 2FA reset: subject "2FA a fost resetat"; "Administratorul a resetat 2FA pentru contul tău." / "Dacă nu ai cerut tu, anunță administratorul.".
- Account change: subject "Setările contului tău s-au schimbat"; "2FA a fost oprit." or "A fost creată o cheie de acces: <nume>." / "Dacă nu ai fost tu, schimbă parola." [S26].
- Admin: reset code, lockout and new-device mails are the portal mails as they are [P6b q13, q15].
- Signature "Echipa EduSport". Outside production every mail goes to the one test address [P6 3.6].

## 13. History lines [P6 11; S47]
Subject `portalAccount` (coach) and `adminUser` (admin); actor the person, or the admin's name for a reset, or "server" for the script.
- "2FA activat: aplicație." / "2FA activat: cod pe e-mail." / "2FA oprit: aplicație." / "2FA oprit: cod pe e-mail."
- "Coduri de rezervă noi." / "Cod de rezervă folosit, mai sunt <n>."
- "Cheie de acces creată: <nume>." / "Cheie de acces ștearsă: <nume>."
- "2FA resetat de <nume admin>." / "2FA resetat de pe server."
- "Blocat 15 minute după 5 coduri greșite."
- Admin only: "Parolă schimbată." / "Parolă resetată." / "Google conectat." / "Legătura cu Google eliminată."

## 14. Builder notes

### 14.1 Before building
- Companion screen round with real component renders and the light-mode overrides: `/intrare` (login, 2FA step, invite, reset), the offer screen, admin Securitate with "Administratori", coach 2FA step and Securitate, "Cont portal" with "Resetează 2FA", the e-mails [R6b 21; memory: decisions in companion].
- Strings marked [S n] are confirmed there; copy lives in `src/club/security/copy.ts` (shared), `src/club/portal/copy.ts` and the frontend copy file.

### 14.2 Task 1: spike (gate for everything after it) [R6b 3.6]
On Strapi 5.52.1, locally:
1. A controller of ours issues an admin session for a user id (`generateRefreshToken`, `strapi_admin_refresh` with Strapi's options, `generateAccessToken`); the access token handed over as in 4.2 (both "Ține-mă minte" ways); `/admin` opens logged in; `POST /admin/access-token` rotates; logout ends it; idle and max lifetimes match Strapi's defaults.
2. The gate refuses the five routes of 4.4; `/admin/auth/*` reaches `/intrare` by server redirect and by the SPA navigation (logout, 401).
3. `admin::role` takes a fixed `code`; native Content Manager permissions per role hide Strapi's menus; `/admin/users/me` returns the roles for a non-Super-Admin.
4. `invalidateRefreshToken(userId)` ends every session of an admin, and `(userId, deviceId)` one device.

Fallback if step 1 fails (the SPA does not accept a session we issue): our page still does every check (password, lockout, 2FA, Google, passkey), then sends the browser to `/admin/auth/login?ticket=<secret>` with a single-use 60-second ticket (MAC in `auth_challenges`). A small script in the admin bundle on that route posts Strapi's own `POST /admin/login` with the ticket, so Strapi's SPA code issues and stores its own session; the gate lets `POST /admin/login` through only with a valid ticket, and a local passport strategy wrapper accepts the ticket in place of the password. If the fallback fails too, the build stops and the user chooses between this spec and injection into Strapi's form (P6b q3 option B) [S48].
If step 3 fails (no fixed code), roles are matched by name, created by the bootstrap and protected from renaming by a check at boot [S48].
Plan shape (decided by Claude, low impact): one plan, written for the main path, with the spike as task 1 and a hard checkpoint: the builder reports the spike result to the controller and stops until it is answered. Fallback tasks are listed but not expanded. If both the Strapi session handoff and the ticket fallback fail, the build stops; there is no third design.

### 14.3 Module layout (new)
- `src/club/security/`: `keys.ts`, `secret-box.ts`, `code-mac.ts`, `totp.ts`, `backup-codes.ts`, `email-code.ts`, `second-step.ts`, `remembered.ts`, `passkeys.ts`, `qr.ts`, `store.ts` + `strapi-store.ts` + an in-memory store for tests (the portal pattern [code src/club/portal/store.ts, strapi-store.ts]), `copy.ts`.
- `src/club/admin-login/`: `context.ts`, `login.ts`, `google.ts`, `session.ts` (4.2), `devices.ts`, `invite.ts`, `reset.ts`, `admins.ts`.
- `src/middlewares/admin-login-page.ts`, `src/middlewares/admin-auth-gate.ts`; `config/middlewares.ts` lists both.
- `src/api/admin-auth/routes/01-login.ts`, `02-security.ts` (area `any`: `GET /api/admin-auth/me/security` and the same 2FA, passkey, device, password and Google routes as 7.1 under `/api/admin-auth/me/*`), `03-admins.ts` (area `superAdmin`: `GET /api/admin-auth/admins`, `POST /api/admin-auth/admins/:id/reset-2fa`).
- `src/club/roles/map.ts`, `src/club/roles/bootstrap.ts`, `src/policies/has-role.ts`; `src/admin/lib/useAreas.ts`.
- `src/admin-login/` (page source) and `vite.admin-login.config.ts`; `npm run build` builds it.
- Reused: `src/club/portal/limits.ts`, `auth/limit.ts`, `devices.ts` (labels), `passwords.ts`, `auth/google.ts`, `src/email/portal-direct.ts` [code].

### 14.4 Tests
- Unit (pure): TOTP RFC 6238 vectors, window and replay; seal and open, wrong key, moved ciphertext (other subject) refused, key rotation; backup code alphabet, normalisation, single use, ten-way compare without early exit; e-mail code expiry and tries; limits for the `admin:` and `2fa:` keys; role map and area union; route-to-area table.
- Leak test: a dump of the new tables plus a known code list gives no match without the env keys.
- Races: two parallel uses of one backup code or e-mail code open once.
- Admin login: enumeration (unknown, wrong, inactive, blocked give the same status and body), lockout and mail, Google link and refusals, invite accept, reset then 2FA, remembered device skip and expiry, device mail.
- Gate: the five closed routes answer 404; `PUT /admin/users/me` with password or e-mail refused; access-token and logout still work.
- Portal: password then 2FA, Google skips, reset then 2FA, BFF secret required on the new routes, pending cookie never readable by page script.
- Passkeys with a virtual authenticator (Playwright CDP WebAuthn) on both surfaces: register, sign in by button and by autofill, wrong origin refused, wrong kind refused, counter, old rpId row not offered.
- Roles: every admin route x every role (expected 200 or 403), menu entries per role, a page opened by URL without its area.
- Boot check on a throwaway Postgres (P5 11.4 pattern): new tables, roles created, synthetic admins (`admin1@example.invalid`) per role and a coach with 2FA.

### 14.5 Deploy
1. Strapi env: `AUTH_SECRET_KEY`, `AUTH_CODE_KEY` (`openssl rand -base64 32` on the VM), `WEBAUTHN_RP_ID=codrin.space`, `WEBAUTHN_ORIGINS`, `ADMIN_HOST=cms-edusport.codrin.space`. Next: nothing new beyond the browser library [S18].
2. Google Cloud: add the redirect URI `https://cms-edusport.codrin.space/api/admin-auth/google/callback` to the portal's OAuth client; the VM egress policy already allows Google for the portal [P6 14.4; memory: VM egress policy].
3. Before switching the gate on in production: at least two Super Admins sign in on `/intrare` [R6b 6].
4. Restart the backend twice if a new attribute is not saved [memory: schema change needs restart].
5. Docs with the build: `08-authentication.md` (admin sessions, keys, rpId now and after the move), `13-roadmap.md` rows 6 and 10 (10 loses "Staff club"), the DECISIONS Security index, a sequence diagram for the admin login and the 2FA step.
6. Role assignment (decided by Claude, low impact): before the gate of step 3 is switched on, the checklist step "a Super Admin assigns Administrator club or Editor site to every non-super admin before the policy is enabled" must be done. The bootstrap log lists each admin without an EduSport role, and that list is the checklist.
7. Cutover note (decided by Claude, low impact): pending portal reset codes are invalid after deploy and the user requests another; existing admin sessions keep working until they expire; the first `/intrare` login creates the device row.

## 15. Decided by spec author (low impact)
- S1 decided by spec author (low impact): one set of 2FA tables for portal and admin subjects, plain `subjectType` and `subjectId` columns.
- S2 decided by spec author (low impact): unconfirmed factors purged after 15 minutes.
- S3 decided by spec author (low impact): one `auth_challenges` table for pending logins, codes and WebAuthn challenges; secrets stored as MACs.
- S4 decided by spec author (low impact): `admin_accounts` beside `admin::user` for Google, user handle, last method and offer flag; the same three fields on `portal_accounts`.
- S5 decided by spec author (low impact): the portal reset code moves to the keyed MAC, required by the user note.
- S6 decided by spec author (low impact): the purge rules of 3.9.
- S7 decided by spec author (low impact): page path `/intrare` and subpaths, own Vite bundle reusing `src/admin/ui`, server and client redirect of `/admin/auth/*`, Strapi login branding removed.
- S8 decided by spec author (low impact): Origin check on every mutating `/api/admin-auth` call.
- S9 decided by spec author (low impact): admin device cookie `__Host-es_adm_dev`, 400 days, one Strapi session family per device.
- S10 decided by spec author (low impact): password only through our Securitate, Strapi profile and user-edit password fields refused; an admin e-mail change clears Google and ends sessions.
- S11 decided by spec author (low impact): `register-admin` closed for good; first admin by CLI.
- S12 decided by spec author (low impact): an admin enters only when `isActive` and not `blocked`.
- S13 decided by spec author (low impact): admin per-IP limit uses the nginx-forwarded IP.
- S14 decided by spec author (low impact): admin Google state cookie on its own path; same OAuth client as the portal.
- S15 decided by spec author (low impact): Securitate hint "Pornește 2-Step Verification în contul Google." and the Google row texts.
- S16 decided by spec author (low impact): admin invite and reset use the portal copy and rules; Google accept sets a random password.
- S17 decided by spec author (low impact): a reset ends all sessions and remembered devices, then 2FA still follows; a password change forgets other devices' 2FA.
- S18 decided by spec author (low impact): two dedicated env keys, key ids, rotation through `_OLD` keys.
- S19 decided by spec author (low impact): missing keys fail closed with "2FA nu este disponibil acum.".
- S20 decided by spec author (low impact): AES-256-GCM with subject-bound additional data; the secret is never shown again.
- S21 decided by spec author (low impact): TOTP written in house; QR SVG by `qrcode` 1.5.4 on the server.
- S22 decided by spec author (low impact): backup code format and the keyed MAC for all short codes.
- S23 decided by spec author (low impact): 5 wrong codes per subject in 15 minutes pause the second step; 5 wrong codes end a pending login.
- S24 decided by spec author (low impact): auth request bodies dropped from Sentry.
- S25 decided by spec author (low impact): a method counts only after a right code at setup.
- S26 decided by spec author (low impact): a mail when 2FA is turned off or a passkey is added.
- S27 decided by spec author (low impact): the pending login lives in an `HttpOnly` cookie, 10 minutes.
- S28 decided by spec author (low impact): "Ține minte dispozitivul 30 de zile" on by default; 30 days fixed, not sliding; when it is forgotten; the device sub-line.
- S29 decided by spec author (low impact): "Mai ai <n> coduri de rezervă." after a backup code is used.
- S30 decided by spec author (low impact): the last method off deletes backup codes and forgets devices.
- S31 decided by spec author (low impact): reset effects (methods, codes, devices, sessions; passkeys kept), "Administratori" section, no self reset, server script, the confirm and toast texts.
- S32 decided by spec author (low impact): portal Securitate routes in `03-security.ts` under `global::is-coach` until phase 7.
- S33 decided by spec author (low impact): exact pins without ranges.
- S34 decided by spec author (low impact): separate keys per role; "Cheia nu este pentru această pagină.".
- S35 decided by spec author (low impact): passkey failures do not count toward the password lockout; one refusal text.
- S36 decided by spec author (low impact): offer and passkey error texts.
- S37 decided by spec author (low impact): the shared `codrin.space` risk handled by the exact origin list.
- S38 decided by spec author (low impact): cutover script, old-key label and 30-day purge, runbook steps.
- S39 decided by spec author (low impact): role codes `edusport-club-admin`, `edusport-site-editor`; idempotent bootstrap; native permissions only for website types.
- S40 decided by spec author (low impact): separate `club`, `money`, `coachAccounts` keys with the same roles.
- S41 decided by spec author (low impact): a source-reading test for route areas.
- S42 decided by spec author (low impact): "Nu ai acces la această pagină." and the menu-to-area list.
- S43 decided by spec author (low impact): admin login copy taken from the portal form plus "Ține-mă minte".
- S44 decided by spec author (low impact): admin password section texts; SaveBar opt-out on the Securitate page.
- S45 decided by spec author (low impact): second step and Securitate texts of 11.2 and 11.3.
- S46 decided by spec author (low impact): the new e-mail texts of 12.
- S47 decided by spec author (low impact): the history lines of 13.
- S48 decided by spec author (low impact): the spike fallbacks of 14.2.

## 16. Open for the user
None.

## 17. Conflicts between sources (resolved here, flagged for the user)
1. P6b q10 B (passkeys on `codrin.space` now, enrol again after the move) vs P6 13, R6b 8 and DEC 2026-10-19 subdomains-v1 (rpId `scoaladepatinaj.com`): the later answer wins; `scoaladepatinaj.com` comes with the move (8.6).
2. DEC 2026-10-18 twofactor-v2 and P6 13 list the passkey as a 2FA method; AUTH and DEC passkey-flow-v4 say it replaces password and code: it is a sign-in method managed in Securitate, never asked after a password (6.1) [R6b C3].
3. DEC 2026-10-18 twofactor-v2 "admin two-factor is not built in" vs admin-login-pages-v3 and auth-levels-v1 the same day: it meant "not a Strapi feature"; 6b is that design [R6b C2].
4. RM row 10 and DEC 2026-10-28 admin trim put a "Staff club" role in phase 10; P6b q21 A gives roles and hiding to 6b, and "Administrator club" replaces "Staff club".
5. P11 4 "every admin sees Bani, the accounting view and all exports until 6b": now area `money`, Super Admin and Administrator club [P6b q19].
6. R6b 4 (backup codes SHA-256, TOTP secret under Strapi's `ENCRYPTION_KEY`) vs the user note: keyed MAC and dedicated keys (5.1, 5.4). P6 3.3 reset code SHA-256: moved to the keyed MAC (S5).
7. P6 5.6 "success: the coach is logged in" after a reset: with 2FA on, the second step follows first (S17).
8. Research P7 copy "Resetează verificarea în doi pași" vs the user note: "Resetează 2FA".
9. P6b q14 A keeps Strapi's admin session lengths (14 days idle with "Ține-mă minte"), longer than the AAL2 yardstick in AUTH (1 hour idle, 24 hours) for an admin with an app or passkey: the user's answer wins; AUTH notes it.
10. R6b P8 recommended a banner for admins without 2FA; the user chose none [P6b q8]. R6b 6 risk "at least two Super Admins before 2FA is mandatory" stays as a deploy check only (14.5).
