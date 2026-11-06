# Phase 6 plans: login and the coach portal, backend (index)

Spec (binding): `docs/superpowers/specs/2026-11-04-coach-portal-design.md` (draft v1, 2026-11-04). Decisions: `edusport_frontend/docs/portal/DECISIONS.md` (a later dated entry wins; `[DEC 2026-11-04 p6]` lines). Conventions: `docs/HANDOFF.md`, `CLAUDE.md` (store pattern with fake and parity tests, transactions and row locks, Istoric lines, copy modules, thin admin UI with rules in `src/club`). Agent rules: `.superpowers/phase3-shared/agent-rules.md`.

Backend only (Strapi, this repo, branch `feat/athletes`). The website (Next.js BFF, host routing, coach screens) is a later plan in `edusport_frontend` on `feat/portal`; it consumes the HTTP contracts below and nothing else. The copy companion round (spec 14.1) runs before the frontend plan; strings marked [S n] in the spec live in `src/club/portal/copy.ts` only, so a changed string is a one-line change.

## Plans

| Plan | File | Tasks | Needs merged | Delivers | Risk |
|---|---|---|---|---|---|
| 6-1 | `2026-11-04-phase6-1-auth-accounts.md` | 13 | phase 5 on `feat/athletes` | spike (gate), U&P config and closed routes, 4 content types, pure rules (passwords, limits, tokens, devices, 7-day window), `PortalStore` (Strapi + fake, parity), `PortalSessions` (U&P or fallback), BFF secret and client IP, login, refresh, logout, reset, invite read and accept, Google, direct-send mail and the three direct e-mails, auth routes `01-auth.ts`, boot check | high |
| 6-2 | `2026-11-04-phase6-2-coach-routes.md` | 10 | 6-1 | `global::is-coach`, coach context and ownership, coach view allow-lists, me / password / devices, today, groups, presence (own, stand-in, 7-day window), lessons, athlete search, add to group, "Sportiv nou", athlete card, Istoric month, Program and "Program public", routes `02-coach.ts`, ownership matrix, boot check | high |
| 6-3 | `2026-11-04-phase6-3-admin-emails.md` | 7 | 6-1 | invite and e-mail change mails, `portal-invite` job kind, account admin services (invite, resend, disable, enable, change e-mail), admin routes `12-portal-accounts.ts`, team member delete hook, purge cron, "Cont portal" admin block, diagrams | high |

Total 30 tasks. Per-task Opus review only on tasks tagged **high risk** (auth, sessions, lockout, permissions, data loss); all other tasks get the plan's final review only. Suggested model per task: Haiku where the plan carries the code or the work is mechanical, Sonnet for integration judgment.

## The gate

Plan 6-1 Task 1 is the spike of spec 14.2. Nothing after it is built until its result is logged in the ledger (`p3be/.superpowers/sdd/2026-11-04-phase6-1/progress.md`) as `SPIKE PASS` or `SPIKE FAIL <which check>`.

- PASS: plan 6-1 runs Task 5A (`PortalSessions` over the U&P session manager); Task 5B is skipped.
- FAIL: plan 6-1 runs Task 5B (own opaque session table `portal_sessions`); Task 5A is skipped. Task 2 then also adds the `portal-session` content type (listed inside Task 5B). Every other task in 6-1, 6-2 and 6-3 talks to `PortalSessions` only, so nothing else changes. If the U&P routes cannot be closed by the plugin extension (spike check 7), the fallback for that check alone is a global middleware `global::portal-up-closed` answering 404 on `/api/auth/*`, `/api/connect/*`, `/api/users*` (Task 1 step 7 names it).

## Order and parallel groups

Order: 6-1 (T1 gate first); then 6-2 and 6-3 in parallel.

- One worktree per plan, branched from `feat/athletes` after its "Needs merged" plans are merged.
- 6-2 touches `src/club/portal/coach/**`, `src/policies/is-coach.ts`, `src/api/portal/routes/02-coach.ts`, `src/api/portal/controllers/coach.ts`, and in older code only: `src/club/groups/members.ts` (optional `from`), `src/club/groups/group-admin.ts` (new `setProgramPublic`).
- 6-3 touches `src/club/portal/accounts/**`, `src/email/portal-email.ts`, `src/email/email-jobs.ts` (kind), `src/api/email-job` schema (enum value), `src/api/club/routes/12-portal-accounts.ts`, `src/api/club/controllers/portal-accounts.ts`, `src/index.ts` (delete hook, comment), `config/cron-tasks.ts`, `src/admin/**` ("Cont portal"), `docs/architecture/diagrams/`.
- Shared file: `src/club/portal/copy.ts` is created in 6-1; 6-2 adds no copy (screens' copy is the frontend's); 6-3 adds `copy-admin.ts` and one `export *` line.

## Boot checks (throwaway Postgres, never the user's environment)

| Plan | Postgres container / port | Strapi port |
|---|---|---|
| 6-1 (spike and T13) | `es61-pg` 127.0.0.1:55461 | 1381 |
| 6-2 | `es62-pg` 55462 | 1382 |
| 6-3 | `es63-pg` 55463 | 1383 |
| spare (final whole-branch check) | `es64-pg` 55464 | 1384 |

Never 55442, 1337, 1340, 3010, 5432, `strapi_app`, `strapi_db`, `edusport-test-pg`. Each check starts from `scripts/fixtures/phase4-shape.js` plus `phase5-shape.js`, then `scripts/fixtures/phase6-shape.js` (6-1 Task 13: two synthetic coaches `antrenor1@example.invalid` active with password `Throwaway-Coach-1`, `antrenor2@example.invalid` invited; both linked to `G_TEAM`-like team members), restarts Strapi once to prove the schema boots, and removes its container afterwards. Env for checks: `PORTAL_BFF_SECRET=test-bff-secret-000000000000000000`, `PORTAL_HOSTS=antrenor`, `JWT_SECRET` any, Brevo unset (direct mails log "blocked: no-key").

## Deploy (spec 14.4, only with the user's approval)

1. After the phase 2-5 window; database backup first.
2. Env on Strapi: `JWT_SECRET` (if not set), `PORTAL_BFF_SECRET` (32+ random bytes, base64), `PORTAL_HOSTS=antrenor`, `PORTAL_GOOGLE_CLIENT_ID`, `PORTAL_GOOGLE_CLIENT_SECRET`. Same `PORTAL_BFF_SECRET` on the Next container.
3. Restart; restart once more if a new attribute is not saved. Check the four `portal_*` tables exist and `GET /api/auth/local` answers 404 or 405 (closed).
4. U&P advanced settings in the admin: registration off, e-mail confirmation off, default role Authenticated with no permissions (Task 2 asserts it on bootstrap and logs an error otherwise).
5. VM egress unit: allow `oauth2.googleapis.com`, `www.googleapis.com` from the Strapi container.
6. Invites only after the `/protectia-datelor` paragraph is live (club copy).

## HTTP contracts (binding for the frontend plan)

Every response uses the existing shape: success `200 { data: T }`; refusal `{ data: null, error: { status, name: 'ClubAdminError', message } }` (`refuseWith` in `src/club/admin-http.ts`), `message` being the exact Romanian text to show. Dates `YYYY-MM-DD`, times `HH:mm`, months `YYYY-MM`, instants ISO UTC; ids are documentIds.

### Headers the BFF sends on every `/api/portal/*` call

- `x-portal-secret: <PORTAL_BFF_SECRET>`: required on auth and coach routes; missing or wrong answers `403` with message `"Forbidden"` before anything else runs (no limiter hit, no DB read).
- `x-portal-client-ip: <client address>`: the address the BFF read from `x-real-ip`; read only when the secret matched. Missing: the limiter uses `unknown`.
- `x-portal-user-agent: <browser user agent>`: on login-like calls, for the device label.
- `x-portal-device: <device key cookie value>`: on `GET /me/devices`, to mark the current device.
- `authorization: Bearer <access token>`: coach routes only.

### Session object (returned by every successful login-like call)

```ts
type PortalSession = { accessToken: string; refreshToken: string; accessExpiresAt: string; deviceKey: string | null };
```
`deviceKey` is non-null only when Strapi created a new device key (the request had none or an unknown one); the BFF then sets `__Host-es_dev` (400 days). Cookie names and flags are the BFF's job (spec 5.2).

### Auth routes (`src/api/portal/routes/01-auth.ts`, `{ auth: false }`)

| Method and path | Body | Success `data` | Refusals (status, message) |
|---|---|---|---|
| `POST /api/portal/auth/login` | `{ host: 'antrenor', email, password, deviceKey?: string }` | `PortalSession` | 400 `"Cerere invalidă."`; 401 `"E-mailul sau parola nu sunt corecte."`; 429 `"Prea multe încercări. Încearcă din nou peste 15 minute."` |
| `POST /api/portal/auth/google` | `{ host, code, codeVerifier, redirectUri, nonce, invite?: string, deviceKey?: string }` | `PortalSession` | 400; 401 `"Nu am găsit un cont pentru adresa asta."`; 401 `"Contul Google nu are adresa <e-mail>."` (invite only); 410 `"Invitația a expirat. Cere administratorului una nouă."`; 429; 502 `"Nu am putut încărca datele."` (Google unreachable) |
| `GET /api/portal/auth/google/config` | none | `{ clientId: string \| null }` | none |
| `POST /api/portal/auth/refresh` | `{ refreshToken }` | `Omit<PortalSession, 'deviceKey'> & { deviceKey: null }` | 401 `""` |
| `POST /api/portal/auth/logout` | `{ refreshToken }` | `{ ok: true }` (always, also for an unknown token) | none |
| `POST /api/portal/auth/reset/request` | `{ email }` | `{ message: "Dacă adresa are cont, am trimis un cod." }` | 400; 429; 503 `"Nu am putut trimite e-mailul. Încearcă din nou."` |
| `POST /api/portal/auth/reset/confirm` | `{ host, email, code, password, deviceKey? }` | `PortalSession` | 400 `"Codul nu este corect sau a expirat."`; 400 `"Cerere invalidă."`; 400 password rule texts; 401 "E-mailul sau parola nu sunt corecte." (password set, but the account cannot enter: disabled, host, no team member); 429 |
| `POST /api/portal/auth/invite/read` | `{ secret }` | `{ state: 'valid'; email: string } \| { state: 'expired'; email: null }` | 429 |
| `POST /api/portal/auth/invite/accept` | `{ secret, password, deviceKey? }` | `PortalSession` | 400 `"Cerere invalidă."`; 400 password rule texts; 401 "E-mailul sau parola nu sunt corecte." (as reset confirm); 410 invite expired text; 429 |

Every route behind the BFF secret can also answer 401 "E-mailul sau parola nu sunt corecte." when a login-like route loses the race with a disable (`issue.ts`), 400 `"Cerere invalidă."` for a malformed body, and 500 `"Acțiunea nu a reușit. Nimic nu a fost salvat."` from the guard (`portal-auth.ts`). The frontend plan handles all three.

Password rule texts (400): `"Parola trebuie să aibă cel puțin 10 caractere."`, `"Parola este prea ușor de ghicit. Alege alta."`, `"Parola poate avea cel mult 128 de caractere."` (plan ruling 1, companion round).

Google (BFF side, for the frontend plan): the BFF builds the authorization URL (`response_type=code`, `scope=openid email`, `code_challenge_method=S256`, `state`, `nonce`, `redirect_uri=https://antrenor.<domain>/api/portal/google/callback`), keeps state, nonce and the verifier in its short cookie, checks `state` on the callback and posts `code`, `codeVerifier`, `redirectUri`, `nonce` to `/api/portal/auth/google`. Strapi exchanges the code with the client secret and verifies the ID token. The client id is the only Google value the BFF needs (`GET /api/portal/auth/google/config`).

### Coach routes (`src/api/portal/routes/02-coach.ts`, `{ auth: false, policies: ['global::is-coach'] }`)

Policy refusals (`global::is-coach`) are Strapi errors, so the body is `{ error: { name, message } }` and the message text is not stable. Read the status and `error.name`, never the message:
- 401 (any name or message): the access token is missing, expired or revoked. The BFF refreshes once, then goes to login.
- 403 whose `error.name` is not `ClubAdminError`: the BFF secret was refused or the account can no longer enter (disabled, host, team member unlinked). Access was cut: clear the cookies and go to login. Do not treat it as a group refusal.
- 403 with `error.name` `ClubAdminError`: a handler refusal that carries the Romanian message to show (below).

Handler refusals: 403 `"Nu mai ai acces la această grupă."` when the link check fails; 403 `"Arhivată. Nu mai poate fi modificată."` when the 7-day window is over; 404 `"Nu a fost găsit."` (`ADMIN_ERRORS.notFound`) for an unknown id. Response types are in `src/club/portal/coach/api-types.ts` (plan 6-2 Task 2), which imports no Strapi, Node or React so the frontend plan can copy it verbatim. Its `Occurrence` type comes from `src/api/calendar-event/services/expand.ts` and goes on the frontend copy list with it. Every `/program/:eventId` route takes the event `documentId` (as on the admin side), not the numeric `Occurrence.eventId`.

| Method and path | Query / body | `data` type |
|---|---|---|
| `GET /api/portal/coach/me` | | `CoachMe` (includes `coachId`, the coach's team member documentId, and `coachOptions: { id, name }[]`, the team members who coach any group) |
| `PUT /api/portal/coach/me` | `{ phone: string \| null }` | `{ toast: "Salvat." }` |
| `POST /api/portal/coach/me/password` | `{ current?: string, password }` | `{ toast: "Salvat." }` |
| `GET /api/portal/coach/me/devices` | header `x-portal-device` (device key, optional, marks "acesta") | `CoachDevice[]` |
| `DELETE /api/portal/coach/me/devices/:id` | | `{ revokedCurrent: boolean }` |
| `GET /api/portal/coach/today` | `?date=` (default today) | `CoachToday` |
| `GET /api/portal/coach/groups` | | `CoachGroups` |
| `GET /api/portal/coach/groups/:documentId` | | `CoachGroupPage` |
| `GET /api/portal/coach/groups/:documentId/saved-days` | `?month=YYYY-MM` | `CoachSavedDays` `{ month, dates: string[] }` (ascending; own group: every saved date; other group: only dates listing the coach; 404 missing or inactive group, 400 bad month; no session ids) |
| `GET /api/portal/coach/session` | `?occurrence=` or `?id=` or `?group=&date=&time=&duration=` | `CoachSession` |
| `POST /api/portal/coach/session/check` | `{ groupId, date, startTime }` | `CoachSessionCheck` (own group, or another group on a scheduled class of today - 7 to today, else 403; phase 5 `SessionCheck`, but each `saved` row has `listed: boolean`, true when the calling coach is in that session's coaches, in place of the roster count) |
| `PUT /api/portal/coach/session` | `SessionSaveBody` (phase 5 type) | `SessionSaved`; 409 reactivation body as phase 5 |
| `GET /api/portal/coach/lessons/:documentId` | | `CoachLesson` |
| `POST /api/portal/coach/lessons` | `LessonBody` (phase 5) | `LessonSaved` |
| `PUT /api/portal/coach/lessons/:documentId` | `LessonPatch` (phase 5) | `LessonSaved` |
| `DELETE /api/portal/coach/lessons/:documentId` | | `{ deleted: true; toast: string }` |
| `GET /api/portal/coach/athletes/search` | `?q=&group=` | `CoachSearchRow[]` |
| `POST /api/portal/coach/athletes` | `CoachNewAthleteBody` | `{ athleteId: string; toast: string }` |
| `GET /api/portal/coach/athletes/:documentId` | | `CoachAthleteCard` |
| `POST /api/portal/coach/groups/:documentId/members` | `{ athleteIds: string[], from: string }` | `JoinResult` (phase 4) |
| `GET /api/portal/coach/history` | `?month=YYYY-MM` | `CoachHistory` |
| `GET /api/portal/coach/groups/:documentId/program` | `?month=` | `CoachProgram` |
| `POST /api/portal/coach/groups/:documentId/program` | phase 4 add body | `{ eventId: string; date: string \| null }` |
| `PUT /api/portal/coach/groups/:documentId/program-public` | `{ value: boolean }` | `{ toast: "Salvat." }` |
| `PUT /api/portal/coach/program/:eventId` | phase 4 change body | `{ eventId: string }` |
| `POST /api/portal/coach/program/:eventId/end` | phase 4 end body | `{ eventId: string }` |
| `DELETE /api/portal/coach/program/:eventId` | | `{ date: string }` |
| `PUT /api/portal/coach/program/:eventId/dates/:date` | phase 4 date body (`{ mode, newDate?, newStartTime?, reason?, notifyParents? }`; the flag is `notifyParents`, a `notify` key is ignored and no parent is mailed) | phase 4 `DateAnswer` |

No coach answer carries an `undo` object (spec S43).

### Admin routes (`src/api/club/routes/12-portal-accounts.ts`, `global::is-admin`)

| Method and path | Body | `data` |
|---|---|---|
| `GET /api/club/team-members/:documentId/account` | | `AccountBlock` (`src/club/portal/accounts/api-types.ts`) |
| `POST /api/club/team-members/:documentId/account/invite` | `{ email }` | `{ account: AccountBlock; toast: "Invitație trimisă." }` |
| `POST /api/club/portal-accounts/:documentId/resend` | | `{ account; toast: "Invitație trimisă." }` |
| `POST /api/club/portal-accounts/:documentId/disable` | | `{ account; toast: "Cont dezactivat." }` |
| `POST /api/club/portal-accounts/:documentId/enable` | | `{ account; toast: "Cont activat." }` |
| `POST /api/club/portal-accounts/:documentId/email` | `{ email }` | `{ account; toast: "E-mail schimbat." }` |

## Rulings made while planning (low impact, decided by Claude; the user may overrule any line)

Log each in DECISIONS.md as "plan 6, decided by Claude (low impact, 2026-11-04)". Each is implemented in the one task named.

1. **Password over 128 characters** has no text in the spec: `"Parola poate avea cel mult 128 de caractere."`, goes to the companion round (6-1 T3).
2. **Wrong current password** on "Schimbă parola" has no text: `"Parola actuală nu este corectă."`, companion round; it counts as a wrong password for the per-e-mail lockout (6-2 T3).
3. **Google route on Strapi.** Spec 6.1 says the BFF "hands the verified code/token to Strapi" and 14.4 puts the client secret on Strapi: Strapi does the code exchange and the ID token check at `POST /portal/auth/google`; the BFF only holds state, nonce and the PKCE verifier (6-1 T11). ID token signature checked with Google's JWKS through `node:crypto` and the existing `jsonwebtoken`; no new dependency.
4. **Reset confirm and invite accept log the coach in**, so their bodies carry `host` (confirm) and `deviceKey` (both), beyond spec 6.1 (6-1 T9, T10).
5. **Device key is made by Strapi**: a login without a known key gets a new 32-byte key back in `deviceKey`; the U&P session `deviceId` is the device row's documentId, so "Deconectează" revokes by device (6-1 T5A). The device row's `sessionId` holds the latest session id for display and the boot check.
6. **The BFF secret is also required on coach routes** (checked first in `global::is-coach`), so a stolen access token alone is not enough from outside the BFF (6-2 T1).
7. **Coach presence dates**: a coach saves only dates up to today (no future session); own group first saves have no deadline (S27); stand-in first saves only within the 7 days and only on a scheduled occurrence (6-2 T5).
8. **Coach ticks are limited to the group's list on that date** plus athletes already on the saved session (visitors added by the admin stay; S25) (6-2 T5).
9. **Athlete search** matches names only (no phone, no registration texts), excludes current members of `group`, sorts by the phase 3 rank (6-2 T7).
10. **"Din data"** on "Adaugă sportiv": phase 4 `JoinBody` has no date; it gains optional `from`, accepted only from today to the season end, admin path unchanged (6-2 T7).
11. **"Sportiv nou" is one transaction**: athlete `nou` plus membership from today, rolled back together; the match refresh runs after commit (6-2 T7).
12. **"Program public" for coaches** gets a narrow service `setProgramPublic(ctx, groupId, value)` beside `updateGroup`, writing the same field-change line and revalidating; checked: `addProgram`, `changeProgram`, `endProgram`, `deleteClass` (`program.ts:58`) and `setDate` (`program-dates.ts:88`) already call `ctx.revalidate()` (6-2 T9).
13. **Coach actor**: `PresenceContext.actor` and `GroupContext.actor` are `"Antrenor <nume>"`; phase 5 `actorName()` falls back to the actor when no admin has that e-mail, so `savedBy` and `createdByName` read `"Antrenor <nume>"` with no phase 5 change (6-2 T1 pins it).
14. **Common password list**: SecLists `Passwords/Common-Credentials/10-million-password-list-top-100000.txt` (MIT license), stored lower case at `data/portal/common-passwords.txt` with its `LICENSE` line in `data/portal/README`; loaded once at bootstrap from `strapi.dirs.app.root` (6-1 T3).
15. **Expired invite on accept answers 410**; a used one too (same text) (6-1 T10).
16. **Purge** runs daily at 03:30 Bucharest as cron task `portalPurge`: limit rows older than 24 h with no running lock, revoked devices older than 30 days, used or expired tokens older than 30 days (6-3 T4).
17. **Securitate lists only devices not revoked**, newest `lastSeenAt` first; "Deconectează" on the current device logs out (`revokedCurrent: true`, the BFF clears cookies) (6-2 T3).
18. **Lockout history line** is written only when the e-mail belongs to an account (6-1 T7).
19. **Lockout history line actor** is `"sistem"` (no person made it) (6-1 T8).
20. **Device label words** beyond the spec examples: `"Tabletă"`, `"Browser"` (unknown browser), `"Dispozitiv necunoscut"` (no user agent); companion round (6-1 T3).
21. **Athlete card access**: a child in an own group (current-season membership) with "Contact"; a child on a session the coach is listed on from 7 days ago to today without "Contact"; anyone else 403 (6-2 T7).
22. **"Cont portal" lives in the "Membri echipă" editor** (`MembriEchipaPage.tsx`), not a Content Manager injection: that custom page replaces the team member collection view (`menu.tsx:153`). The disable confirmation text is a `COPY NEEDED` gap for the companion round (6-3 T5).
23. **Account lines made by no person** (lockout, team member delete) use actor `"sistem"` (6-1 T8, 6-3 T4).
