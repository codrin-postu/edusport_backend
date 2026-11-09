# Phase 6b plans: admin login, 2FA, passkeys, admin roles (index)

Spec (binding, approved): `docs/superpowers/specs/2026-11-07-admin-auth-roles-design.md` (with its "decided by Claude, low impact" builder defaults). Background: `edusport_backend/.superpowers/phase6b/answers.md` (user answers and the security note, these win over everything), `research.md`, `builder-check.md` (rulings Q1 to Q8). Decisions: `edusport_frontend/docs/portal/DECISIONS.md` (`[DEC 2026-11-07 p6b]`). Conventions: `docs/HANDOFF.md`, `CLAUDE.md`, `.superpowers/phase3-shared/agent-rules.md`, the phase 6 plans `2026-11-04-phase6-*.md` (store pattern with fake and parity tests, `refuseWith`, copy modules, Istoric lines).

Backend: this repo, worktree `p3be`, branch `feat/athletes`, Strapi 5.52.1 TypeScript. The coach screens and the BFF are the frontend plan `/Users/codrin/Documents/Programming/edusport_frontend/docs/superpowers/plans/2026-11-07-phase6b-frontend.md`; it consumes the HTTP contracts below and nothing else, and starts after backend Task 21 is merged.

## Plans

| Plan | File | Tasks | Delivers |
|---|---|---|---|
| 6b-1 | `2026-11-07-phase6b-1-admin-security.md` | T1 to T17 | spike (gate), content types, copy and mails, keys and sealing, TOTP and codes, security store, 2FA lifecycle, the second step, Sentry scrub and purge, admin session handoff and devices, the route gate, admin password login with 2FA, reset and invite, Google, admin Securitate routes and the reset script, the `/login` bundle, the admin Securitate page |
| 6b-2 | `2026-11-07-phase6b-2-portal-passkeys.md` | T18 to T23 | portal second step and keyed reset code, portal Securitate 2FA routes and "Resetează 2FA", passkey core, passkey routes (admin and portal), passkey UI in the admin bundles, the domain move script |
| 6b-3 | `2026-11-07-phase6b-3-roles-checks.md` | T24 to T29 | role map and bootstrap, `global::has-role` on every admin route, admin menus and page guard, docs, boot check, click-through |

Total 29 backend tasks plus Task 0 (companion round). Frontend plan: 8 tasks (F0 to F7).

## Task 0: companion round (controller, before any UI task)

Spec 14.1: one companion screen round with real component renders and the light-mode overrides (`mockups/companion-light.html` prepended): `/login` (login, 2FA step, invite, reset), the offer screen, admin Securitate with "Administratori", coach 2FA step and Securitate, "Cont portal" with "Resetează 2FA", the e-mails. Every [S n] string and every string of the rulings below goes on it. It blocks UI tasks only (T16, T17, T19 step "Cont portal", T22, T26, frontend F4 to F6); server tasks run before it. A changed string is a one-line change in `src/club/security/copy.ts` (backend) or `src/lib/portal/copy.ts` (frontend).

## The gate (spec 14.2, plan shape ruling)

Task 1 is the spike. Nothing after it is built until the ledger `p3be/.superpowers/sdd/2026-11-07-phase6b-1/progress.md` holds `SPIKE PASS`, `SPIKE FAIL 1`, `SPIKE FAIL 2`, `SPIKE FAIL 3` or `SPIKE FAIL 4`, and the controller has answered it. The builder reports and stops.

- PASS: tasks run as written.
- FAIL 1 (the SPA does not accept a session we issue): fallback path "ticket". T10 becomes T10F: `session.ts` issues a single-use 60-second ticket (32 random bytes, MAC in `auth_challenges`, purpose `pending-login` with `data.ticket: true`) and answers `{ redirect: '/admin/auth/login?ticket=<secret>' }`; T11 lets `POST /admin/login` through only with a valid ticket in the body and wraps Strapi's local passport strategy so a ticket stands in for the password; T16 adds a small script in the admin bundle on `/admin/auth/login?ticket=` that posts Strapi's own `POST /admin/login` so the SPA stores its own session. T12 to T15, T21 and T22 call the T10F function instead of `issueAdminSession`; their tests change only in the handoff assertion. The fallback tasks are listed, not expanded: the controller expands them after a FAIL 1, then dispatches. If the ticket fallback also fails, the build stops and the user chooses between this spec and injection into Strapi's form (P6b q3 option B). No third design.
- FAIL 2 (gate or redirect): stop and report; the controller decides with the user.
- FAIL 3 (`admin::role` takes no fixed `code`): T24 matches roles by name, creates them by the bootstrap, and a boot check refuses a renamed role (logs an error, the role gets area `any`).
- FAIL 4 (`invalidateRefreshToken` by device): T10 ends one device by listing the admin's sessions and revoking the ones whose `deviceId` matches; nothing else changes.

## Order, batches, reviews

Order: T1 (gate, checkpoint) -> T2, T3 -> T4, T5 -> T6 -> T7, T8, T9 -> T10, T11 -> T12 -> T13, T14, T15 -> T16, T17 (after Task 0) -> T18, T19, T20 -> T21 -> T22, T23 -> T24 -> T25, T26 -> T27, T28 -> T29. Frontend F1 to F7 after T21 is merged (F4 to F6 after Task 0).

Review load (memory rules): per-task review only inside a batch of high tasks; one Opus review per batch, run when the batch's last task is merged, never blocking the next batch; one final Opus review per plan file.

| Batch | Tasks (all high) | Focus for the Opus reviewer |
|---|---|---|
| B1 | T1, T4, T5 | spike facts; key handling, AES-GCM with bound additional data, MAC input, TOTP vectors and replay, CSPRNG use |
| B2 | T6, T7, T8 | compare-and-set single use, ten-way compare without early exit, attempt limits, pending login, remembered devices |
| B3 | T10, T11, T12 | Strapi session handoff and cookies, closed Strapi routes, enumeration, lockout, Origin check |
| B4 | T13, T14, T15, T16 | reset and invite, Google linking rules, Securitate routes and the admin 2FA reset, the `/login` handoff code |
| B5 | T17, T18, T19 | admin Securitate page, portal second step, portal Securitate and "Resetează 2FA" |
| B6 | T20, T21, T22, T23 | WebAuthn options and verification, origin list, kind check, counter, offer flag, cutover script |
| B7 | T24, T25, T26 | role bootstrap and native permissions, every route's area, menu and page hiding from the same map |
| Final 6b-1 | whole plan | after T17 |
| Final 6b-2 | whole plan | after T23 |
| Final 6b-3 | whole plan | after T29 |

Frontend: batches FB1 (F2, F3, F4), FB2 (F5, F6), one final review.

## Boot checks and click-through (throwaway Postgres, never the user's environment)

| Use | Postgres container / port | Strapi port | Next port |
|---|---|---|---|
| T1 spike | `es6b1-pg` 127.0.0.1:55469 | 1391 | |
| T28 boot check | `es6b2-pg` 55470 | 1392 | |
| T29 click-through | `es6b3-pg` 55471 | 1393 | |
| frontend F7 click-through | `es6b4-pg` 55472 | 1394 | 3294 |

Never 55442, 1337, 1340, 3010, 5432, `strapi_app`, `strapi_db`, `edusport-test-pg`. Each check: fresh `postgres:16`, fixtures `scripts/fixtures/phase4-shape.js`, `phase5-shape.js`, `phase6-shape.js`, then `phase6b-shape.js` (T28), restart Strapi once, remove the container afterwards. Env for every check: `AUTH_SECRET_KEY` and `AUTH_CODE_KEY` from `openssl rand -base64 32` at the start of the check (never written to a file in the repo), `WEBAUTHN_RP_ID=localhost`, `WEBAUTHN_ORIGINS=http://localhost:<strapi port>,http://antrenor.localhost:<next port>`, `ADMIN_HOST=localhost:<strapi port>`, `ADMIN_ORIGIN=http://localhost:<strapi port>`, `PORTAL_BFF_SECRET=test-bff-secret-000000000000000000`, `PORTAL_HOSTS=antrenor`, Brevo unset (mails log "blocked: no-key"). Synthetic admins: `admin1@example.invalid` (Super Admin), `admin2@example.invalid` (Super Admin), `admin3@example.invalid` (Administrator club), `admin4@example.invalid` (Editor site), password `Throwaway-Admin-1`; coach `antrenor1@example.invalid` with 2FA app on (TOTP secret generated by the fixture and written to the fixture's `IDS_FILE` in the scratch folder only).

## Deploy (spec 14.5, only with the user's approval)

1. Database backup first. Strapi env: `AUTH_SECRET_KEY`, `AUTH_CODE_KEY` (`openssl rand -base64 32` on the VM, `.env.production` chmod 600), `WEBAUTHN_RP_ID=codrin.space`, `WEBAUTHN_ORIGINS=https://cms-edusport.codrin.space,https://antrenor.<coach domain>` (the coach host is a deploy-time value from the phase 6 hosts runbook), `ADMIN_HOST=cms-edusport.codrin.space`.
2. Google Cloud: redirect URI `https://cms-edusport.codrin.space/api/admin-auth/google/callback` on the portal's OAuth client.
3. Restart; restart once more if a new attribute is not saved. Check the six new tables and `POST /admin/login` answering 404.
4. Role assignment: the bootstrap log lists every admin without an EduSport role; a Super Admin assigns "Administrator club" or "Editor site" to each before `HAS_ROLE_ENFORCED=true` is set (ruling 14). Until then `has-role` checks only `any` and logs the area it would refuse.
5. At least two Super Admins sign in on `/login` before the gate goes live in production (`ADMIN_GATE=on`, ruling 15).
6. Key rotation: keep `AUTH_CODE_KEY_OLD` until every backup-code batch MACed under the old key id has been regenerated; a MAC cannot be re-keyed, so removing it early silently locks out users whose only recovery is their backup codes. Sealed TOTP secrets re-seal themselves at next use.
7. Cutover note: pending portal reset codes are invalid after deploy; existing admin sessions keep working until they expire; the first `/login` login creates the device row.

## HTTP contracts

Response shape as phase 6: success `200 { data: T }`; refusal `{ data: null, error: { status, name: 'ClubAdminError', message } }` from `refuseWith`, `message` the exact Romanian text. Instants ISO UTC. Policy refusals (`global::is-coach`, `global::has-role`) are Strapi errors: read the status and `error.name`, never the message.

### Shared types (`src/club/security/api-types.ts`, imports no Strapi, Node or React; the frontend copies it verbatim)

```ts
export type TwoFactorMethod = 'totp' | 'email' | 'backup';
export type SecondStep = { step: '2fa'; methods: TwoFactorMethod[]; last: TwoFactorMethod; email: string };
export type PasskeyRow = { id: string; name: string; createdAt: string; lastUsedAt: string | null; old: boolean };
export type SecurityView = {
  email: string;
  totp: boolean; emailCode: boolean; backupLeft: number; backupNotice: number | null;
  passkeys: PasskeyRow[]; passkeyLimit: 10;
};
export type TotpStart = { qrSvg: string; key: string }; // key: base32 in groups of 4
export type MethodOn = { toast: string; backupCodes: string[] | null }; // codes only when this was the first method
export type BackupBatch = { toast: string; backupCodes: string[] }; // "XXXXX XXXXX"
export type CodeSent = { sentTo: string };
// WebAuthn JSON shapes are @simplewebauthn/server 14.0.3 types, passed through unchanged:
export type PasskeyRegisterOptions = { options: unknown };
export type PasskeyLoginOptions = { options: unknown };
```
`last` is `lastMethod` when the subject still has it, else the first of `methods` in the order totp, email, backup. `backupNotice` is the count left when a backup code was used at login since the last Securitate visit (spec 6.3, S29), else null; reading the view clears it.

### Portal: changed auth answers (`src/api/portal/routes/01-auth.ts`)

- `POST /api/portal/auth/login`, `POST /api/portal/auth/reset/confirm`: `data` is `PortalSession & { offerPasskey: boolean }` or `SecondStep & { pending: string; deviceKey: string | null }` (pending: 32 random bytes base64url; the BFF moves it into `__Host-es_2fa` and never gives it to page script). `deviceKey` is the key of the device row the server made for this browser at the password step (null when the browser's own key already named a live device): the BFF must store it at once (its device cookie), replacing any other, and send it back as `deviceKey` in the body of `POST /api/portal/auth/2fa` (without the right key the code answers 401 `"Intrarea a expirat. Intră din nou."`). A session answer with `deviceKey: null` means "keep the current key". The row stays unconfirmed (not listed, purged after 24 h) until the code succeeds [T21 fix, M1/M2]. New refusal: 503 `"2FA nu este disponibil acum."` (keys missing and the account has 2FA on).
- `offerPasskey`: true when the subject has no passkey on the current rpId and `passkeyOfferedAt` is null. Present on every login-like answer (login, 2fa, reset confirm, invite accept, Google); always false after a passkey sign-in. The browser adds the `isUserVerifyingPlatformAuthenticatorAvailable()` check.

| Method and path | Body | Success `data` | Refusals (status, message) |
|---|---|---|---|
| `POST /api/portal/auth/2fa` | `{ pending, method: TwoFactorMethod, code, remember: boolean, deviceKey?: string }` | `PortalSession & { offerPasskey }` | 400 `"Cerere invalidă."`; 400 `"Codul nu este corect sau a expirat."`; 401 `"Intrarea a expirat. Intră din nou."` (pending unknown, used, expired or ended by 5 wrong codes; ruling 1); 429 `"Prea multe încercări. Încearcă din nou peste 15 minute."`; 503 |
| `POST /api/portal/auth/2fa/email` | `{ pending }` | `CodeSent` (also when the mail limit is spent: "as if sent") | 401 expired text; 429; 503; 503 `"Nu am putut trimite e-mailul. Încearcă din nou."` |
| `POST /api/portal/auth/passkey/options` | `{ host: 'antrenor' }` | `PasskeyLoginOptions` | 400; 429; 503 |
| `POST /api/portal/auth/passkey/verify` | `{ host, response, deviceKey? }` | `PortalSession & { offerPasskey: false }` | 401 `"Nu am putut folosi cheia de acces."`; 401 `"Cheia nu este pentru această pagină."`; 429; 503 |

### Portal Securitate (`src/api/portal/routes/03-security.ts`, `{ auth: false, policies: ['global::is-coach'] }`, BFF headers and Bearer as coach routes)

| Method and path | Body | `data` |
|---|---|---|
| `GET /api/portal/me/security` | | `SecurityView` |
| `POST /api/portal/me/2fa/totp` | | `TotpStart` (409 `"Aplicația este deja activă."` when on; ruling 2) |
| `POST /api/portal/me/2fa/totp/confirm` | `{ code }` | `MethodOn`, toast `"2FA activat."`; 400 bad code text |
| `DELETE /api/portal/me/2fa/totp` | | `{ toast: "2FA oprit." }` |
| `POST /api/portal/me/2fa/email` | | `CodeSent` |
| `POST /api/portal/me/2fa/email/confirm` | `{ code }` | `MethodOn` |
| `DELETE /api/portal/me/2fa/email` | | `{ toast: "2FA oprit." }` |
| `POST /api/portal/me/backup-codes` | | `BackupBatch`, toast `"Coduri noi generate."`; 400 `"Cerere invalidă."` with no method on |
| `POST /api/portal/me/passkeys/options` | | `PasskeyRegisterOptions`; 409 `"Ai deja 10 chei de acces. Șterge una ca să adaugi alta."` (ruling 3) |
| `POST /api/portal/me/passkeys` | `{ response, name?: string }` | `{ toast: "Cheie de acces creată."; passkey: PasskeyRow }`; 400 `"Nu am putut folosi cheia de acces."`; 409 limit text |
| `PUT /api/portal/me/passkeys/:id` | `{ name }` (1 to 60 characters after trim) | `{ toast: "Salvat." }`; 400 invalid; 404 `"Nu a fost găsit."` |
| `DELETE /api/portal/me/passkeys/:id` | | `{ toast: "Cheie de acces ștearsă." }`; 404 |
| `POST /api/portal/me/passkey-offer/dismiss` | | `{ ok: true }` |
| `POST /api/portal/me/reauth` | `{ password }`, or `{ method: TwoFactorMethod, code }` when the account has 2FA | `{ ok: true }`; 400 `"Cerere invalidă."`; 400 wrong password `"Parola actuală nu este corectă."` or bad code text; 403 `reauthRequired` (no live device for the session); 429 (IP rule, e-mail or 2FA lock) |

`POST /api/portal/me/passkeys/options` and `POST /api/portal/me/passkeys` also answer 403 `"Confirmă din nou ca să continui."` (COPY NEEDED) when the session's last confirmation is older than 10 minutes: the client then calls `reauth` and retries (user ruling 2026-11-09, spec 8.2). The e-mail code of a re-confirmation is the one `POST /api/portal/me/2fa/email` sends.

`GET /api/portal/coach/me/devices`: each `CoachDevice` gains `twoFactorUntil: string | null` (spec 6.4). `name` missing on passkey create: the device label of the request user agent (`deviceLabel`, ruling 4). Rate limits: the IP rule counts every `POST` of this table except dismiss.

### Admin: "Resetează 2FA" on "Cont portal" (`src/api/club/routes/12-portal-accounts.ts`, area `coachAccounts`)

| `POST /api/club/portal-accounts/:documentId/reset-2fa` | | `{ account: AccountBlock; toast: "2FA resetat." }`; 404 | 

`AccountBlock` gains `twoFactor: boolean` (the account has a confirmed method; the button shows only then).

### Admin login (`src/api/admin-auth/routes/01-login.ts`, `{ auth: false }`; same-origin; every POST checks `Origin` against the admin origin first: 403 `"Forbidden"`)

`AdminHandoff = { accessToken: string; remember: boolean; offerPasskey: boolean }`. The refresh cookie `strapi_admin_refresh` is set by the answer. The page stores `accessToken` as spec 4.2 (remember: `localStorage` `jwtToken` and `isLoggedIn`; else cookie `jwtToken`) and calls `location.assign('/admin')`; with `offerPasskey` and platform support it first shows `/login/passkey`.

| Method and path | Body | Success `data` | Refusals |
|---|---|---|---|
| `POST /api/admin-auth/login` | `{ email, password, rememberMe: boolean }` | `AdminHandoff` or `SecondStep` (pending in `__Host-es_adm_2fa`) | 400 invalid; 401 `"E-mailul sau parola nu sunt corecte."`; 429 pause; 503 2FA unavailable |
| `POST /api/admin-auth/2fa` | `{ method, code, remember: boolean }` | `AdminHandoff` | as portal 2fa |
| `POST /api/admin-auth/2fa/email` | `{}` | `CodeSent` | as portal |
| `GET /api/admin-auth/google/start?remember=0\|1` | | 302 to Google | |
| `GET /api/admin-auth/google/callback` | Google query | 302 to `/login/done` with the access token in the `jwtToken` cookie (ruling 5), or 302 to `/login?eroare=google` | the page shows `"Nu am găsit un cont pentru adresa asta."` |
| `POST /api/admin-auth/passkey/options` | `{}` | `PasskeyLoginOptions` | 429; 503 |
| `POST /api/admin-auth/passkey/verify` | `{ response, rememberMe: boolean }` | `AdminHandoff` | 401 passkey texts; 429; 503 |
| `POST /api/admin-auth/reset/request` | `{ email }` | `{ message: "Dacă adresa are cont, am trimis un cod." }` | 400; 429; 503 send failure |
| `POST /api/admin-auth/reset/confirm` | `{ email, code, password }` | `AdminHandoff` or `SecondStep` | 400 bad code; 400 password rule texts; 429 |
| `POST /api/admin-auth/invite/read` | `{ registrationToken }` | `{ state: 'valid'; email: string } \| { state: 'expired'; email: null }` | 429 |
| `POST /api/admin-auth/invite/accept` | `{ registrationToken, password }` | `AdminHandoff` | 400; 400 password rules; 410 `"Invitația a expirat. Cere administratorului una nouă."`; 429 |
| `GET /api/admin-auth/invite/google?registrationToken=` | | 302 to Google (accept on callback, same verified e-mail only) | callback refusal 302 `/invite?eroare=google` |

### Admin Securitate (`src/api/admin-auth/routes/02-security.ts`, area `any`; `03-admins.ts`, area `superAdmin`; admin Bearer token from `useFetchClient`, plus the Origin check on mutating calls)

Same bodies and answers as the portal Securitate table, under `/api/admin-auth/me/*` (`reauth` included, the device cookie names the session's device; `security`, `2fa/totp`, `2fa/totp/confirm`, `2fa/email`, `2fa/email/confirm`, `backup-codes`, `passkeys/options`, `passkeys`, `passkeys/:id`, `passkey-offer/dismiss`), plus:

| Method and path | Body | `data` |
|---|---|---|
| `GET /api/admin-auth/me/devices` | cookie `__Host-es_adm_dev` marks the current one | `{ id, label, lastSeenAt, current, twoFactorUntil }[]` |
| `DELETE /api/admin-auth/me/devices/:id` | | `{ revokedCurrent: boolean }` |
| `POST /api/admin-auth/me/password` | `{ current, password }` | `{ toast: "Parolă schimbată." }`; 400 `"Parola actuală nu este corectă."` (counts toward the e-mail lockout, as phase 6 ruling 2); 400 password rule texts |
| `GET /api/admin-auth/me/google` | | `{ email: string \| null }` |
| `DELETE /api/admin-auth/me/google` | | `{ toast: "Salvat." }` |
| `GET /api/admin-auth/admins` | | `{ id: number; name: string; email: string; twoFactor: boolean; self: boolean }[]` |
| `POST /api/admin-auth/admins/:id/reset-2fa` | | `{ toast: "2FA resetat." }`; 403 `"Nu poți reseta propriul 2FA."` on self (ruling 6); 404 |

## Rulings made while planning (low impact, decided by Claude, 2026-11-07; the user may overrule any line)

Log each in DECISIONS.md as "plan 6b, decided by Claude (low impact, 2026-11-07)". Strings go on the Task 0 screen.

1. **Expired pending login** has no text in the spec: `"Intrarea a expirat. Intră din nou."`, status 401; the page goes back to the password form (T8, T12, T18).
2. **Turning on an app that is already on** answers 409 `"Aplicația este deja activă."` (a new app needs off then on, spec 5.2) (T15, T19).
3. **The 11th passkey** answers 409 `"Ai deja 10 chei de acces. Șterge una ca să adaugi alta."` (T21).
4. **Passkey name** defaults to the device label of the creating browser; rename takes 1 to 60 characters after trim (T21).
5. **Admin Google handoff** sets the access token in Strapi's `jwtToken` cookie, as Strapi's own SSO does, for both "Ține-mă minte" values; `/login/done` moves it to `localStorage` when remember was ticked, then opens `/admin` (T14, checked by spike step 1).
6. **Self reset refused** with 403 `"Nu poți reseta propriul 2FA."`; the button is not shown on the own row anyway (T15).
7. **Admin origin** is `ADMIN_ORIGIN` when set, else `https://<ADMIN_HOST>` in production, else `http://localhost:<PORT or 1337>`; the boot checks set `ADMIN_ORIGIN` (T12).
8. **Pending login cookie path** is `/` (the `__Host-` prefix requires it); locally `es_adm_2fa` (T12).
9. **Admin password rules** are the portal rules (10 to 128 characters, common list, not the e-mail), stricter than Strapi's own; Strapi's profile password field is refused by the gate (T11, T13, T15).
10. **`GET /admin/registration-info`** stays Strapi's (read only, needs the token); our page uses the `admin::user` service directly (T13).
11. **Native Content Manager grants** (spec 9.1 matrix, fixed here): `WEBSITE_UIDS` to both EduSport roles: article, announcement, collaboration-event, competition, course-regulations, cursuri-page, discipline, historic-page, history-milestone, homepage, club-figures, navigation, partners-page, pricing, program, program-page, realizari-page, sponsor, sportsperson, team-member, team-page, volunteer-page. `CLUB_ADMIN_UIDS` to "Administrator club" only: site-settings (area `settings`) and the forms results the club pages read through the Content Manager (contact-submission, partner-submission, volunteer-submission, registration-submission; T24 confirms each by `grep -rn "<uid>" src/admin` and drops the ones no page reads). Every other UID is not granted (T24).
12. **Backup code download** is a text file `edusport-coduri-de-rezerva.txt`, one code per line (T17, frontend F6).
13. **2FA lockout pause** reuses `"Prea multe încercări. Încearcă din nou peste 15 minute."` (spec 5.5) (T8).
14. **Role enforcement switch**: `HAS_ROLE_ENFORCED` (default `true` outside production, `false` in production until deploy step 4); off, `has-role` lets every active admin through and logs `[has-role] would refuse <area> for <id>`. It exists only for the deploy order of spec 14.5 step 6 (T25).
15. **Gate switch**: `ADMIN_GATE` (default `on` outside production; production `off` until two Super Admins have signed in on `/login`, spec 14.5 step 3). Off, the five Strapi routes stay open and `/admin/auth/*` is not redirected; everything else runs (T11).
16. **Admin "Securitate" menu entry** sits in the system group, label `"Securitate"`, area `any` (T17, T26).
17. **Where "Mai ai <n> coduri de rezervă." lives**: spec 3 has no field for it; a json field `securityNotes` on `admin_accounts` and `portal_accounts` holds `{ backupNotice }`, set when a backup code opens a login, cleared when Securitate is read (6b-1 T2, T7, T8).
18. **Admin Google handoff page**: `/login/done` is a sixth page path beside the five of spec 4.1 (T14, T16).
19. **Phase 11 line**: T25 appends to `docs/superpowers/specs/2026-11-07-admin-views-design.md` 4 a line "every phase 11 route names its area (`money`) in its route config; the 6b area test fails otherwise" (spec 9.3 ruling).
20. **Old-key purge date**: spec 8.6 step 3 purges old-rpId keys "30 days after the move" with no source for the date; the cutover deploy sets `WEBAUTHN_MOVED_AT` (ISO date) and the purge reads it (6b-2 T23).
21. **Portal reset code row format**: the keyed MAC is stored in `portal_tokens.secretHash` as `m1:<keyId>:<hex>`, so an old SHA-256 row is never read as a MAC (6b-2 T18).
