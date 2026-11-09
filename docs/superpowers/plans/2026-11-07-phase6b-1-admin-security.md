# Phase 6b-1: Admin Security and the 2FA Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Our own admin login on `/login` that hands over Strapi's own admin session, Strapi's session issuers closed, admin lockout, devices and Google, and the shared 2FA core (app, e-mail code, backup codes, remembered devices) with the admin "Securitate" page.

**Architecture:** Secrets and codes are pure modules in `src/club/security/` (keys, sealing, MACs, TOTP, codes) over one `SecurityStore` (Strapi store plus an in-memory store with parity tests, the portal pattern). Admin login services live in `src/club/admin-login/` and end in `issueAdminSession`, which calls `sessionManager('admin')` exactly as Strapi's own login controller does. Two global middlewares serve the page bundle and close Strapi's routes. The `/login` page is its own Vite bundle built from `src/admin-login/`, reusing `src/admin/ui`.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS), `@strapi/admin` 5.52.1 session manager, Postgres 16, Vitest 3, Node 22 `node:crypto`, `qrcode` exactly 1.5.4, Vite (as the admin build), React 18 as shipped with the admin.

**Spec:** `docs/superpowers/specs/2026-11-07-admin-auth-roles-design.md` 3, 4, 5, 6, 10, 12, 13, 14.2 to 14.4. Index: `docs/superpowers/plans/2026-11-07-phase6b-index.md` ("The gate", "HTTP contracts", "Rulings" are binding).

**Base:** `feat/athletes` at f4f9a75 or later. Plans 6b-2 and 6b-3 start after this plan is merged.

**Parallel groups:**

| Group | Tasks | Runs after | Files |
|---|---|---|---|
| A | 1 Spike (GATE) | base | `src/club/admin-login/__tests__/spike-*.test.ts`, scratch scripts |
| B | 2 Content types, 3 Copy and mails | 1 logged and answered | 2: `src/api/{auth-factor,auth-backup-code,auth-challenge,auth-passkey,admin-account,admin-device}/**`, `src/api/portal-account`, `portal-device` schemas, `src/club/subjects.ts`; 3: `src/club/security/{copy,api-types}.ts`, `src/email/security-mail.ts` |
| C | 4 Keys and MACs, 5 TOTP and codes | B | `src/club/security/{keys,secret-box,code-mac}.ts`; `{totp,backup-codes,email-code,qr}.ts`, `package.json` |
| D | 6 Security store | C | `src/club/security/{types,store,strapi-store}.ts`, `__tests__/memory-security-store.ts` |
| E | 7 2FA lifecycle, 8 Second step, 9 Scrub and purge | D | 7: `factors.ts`, `reset.ts`; 8: `second-step.ts`, `remembered.ts`; 9: `src/middlewares/sentry.ts`, `src/sentry.ts`, `src/club/portal/purge.ts` |
| F | 10 Session handoff and devices, 11 Gate | E | 10: `src/club/admin-login/{session,devices,admins}.ts`; 11: `src/middlewares/admin-auth-gate.ts`, `config/middlewares.ts`, `src/index.ts` (lifecycle) |
| G | 12 Password login | F | `src/club/admin-login/{context,login}.ts`, `src/api/admin-auth/**` |
| H | 13 Reset and invite, 14 Google, 15 Securitate routes | G | own files; each adds lines to `01-login.ts` / `02-security.ts` / `03-admins.ts` and one handler each in `controllers/admin-auth.ts` |
| I | 16 `/login` bundle, 17 Securitate page | H and Task 0 | `src/admin-login/**`, `vite.admin-login.config.ts`, `src/middlewares/admin-login-page.ts`, `src/admin/app.tsx`; `src/admin/pages/SecuritatePage.tsx`, `src/admin/pages/securitate/**` |

Group H tasks edit the same route and controller files in separate lines; merge them one after the other.

**Risk and model:**

| Task | Risk | Model | Batch |
|---|---|---|---|
| 1 Spike | high | Sonnet | B1 |
| 2 Content types | low | Haiku | final |
| 3 Copy, types, mails | low | Haiku | final |
| 4 Keys, sealing, MACs | high | Sonnet | B1 |
| 5 TOTP and codes | high | Sonnet | B1 |
| 6 Security store | high | Sonnet | B2 |
| 7 2FA lifecycle | high | Sonnet | B2 |
| 8 Second step | high | Sonnet | B2 |
| 9 Scrub and purge | low | Haiku | final |
| 10 Session handoff and devices | high | Sonnet | B3 |
| 11 Gate | high | Sonnet | B3 |
| 12 Password login | high | Sonnet | B3 |
| 13 Reset and invite | high | Sonnet | B4 |
| 14 Google | high | Sonnet | B4 |
| 15 Securitate routes, admins, script | high | Sonnet | B4 |
| 16 `/login` bundle | high | Sonnet | B4 |
| 17 Admin Securitate page | high | Sonnet | B5 |

One Opus review per batch (index), one final Opus review of this plan after T17.

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes`. Commit only in the worktree your dispatch names; before every commit run `git rev-parse --show-toplevel` and `git branch --show-current`.
- Strapi stays pinned at exactly 5.52.1; `@simplewebauthn/server` exactly 14.0.3, `@simplewebauthn/browser` exactly 14.0.0, `qrcode` exactly 1.5.4: no caret, no tilde.
- Spec 2.3 anti-goals hold in every task: no TOTP secret, backup code or e-mail code in clear in a row or a log; no password-only admin entry while 2FA is on, through any route; roles never from a token claim; never create an admin from Google; never reveal whether an e-mail has an account.
- Keys (5.1): `AUTH_SECRET_KEY` seals TOTP secrets, `AUTH_CODE_KEY` MACs codes; 32 bytes base64 each; never Strapi's `ENCRYPTION_KEY`; `keyId` = first 8 hex of SHA-256 of the key; `_OLD` keys still open or check rows with their `keyId`. Missing or short: every 2FA and passkey route answers 503 `"2FA nu este disponibil acum."`, logs an error, and a password login of an account with 2FA on is refused the same way.
- Codes (5.2 to 5.4): TOTP secret 20 bytes `randomBytes`, AES-256-GCM, 12-byte IV, additional data `totp:<subjectType>:<subjectId>`, stored `v1.<keyId>.<iv>.<ciphertext>.<tag>` base64url. TOTP RFC 6238 SHA-1, 6 digits, 30 s, one step either side, a step at or below `lastStep` refused. Backup code 10 Crockford base32 characters (no I, L, O, U) each from `crypto.randomInt`, shown "XXXXX XXXXX". E-mail and reset code 6 digits `randomInt`. Stored only as `HMAC-SHA-256(AUTH_CODE_KEY, "<purpose>:<subjectType>:<subjectId>:<normalized>")` hex plus `keyId`; normalized = upper case, spaces and hyphens removed, O as 0, I and L as 1. Compare with `timingSafeEqual` against every unused code, no early exit; single use by compare-and-set (`consumeOnce`, one guarded `UPDATE ... WHERE usedAt IS NULL`, 0 rows = refused).
- Limits (5.5, 4.5): `admin:login:<e-mail>` 5 wrong in 15 min -> 15 min pause; `admin:ip:<address>` 30 per 15 min (counts second-step and passkey attempts); `admin:mail:<e-mail>` 5 per hour; `2fa:<subjectType>:<subjectId>` 5 wrong codes in 15 min -> pending login ends, 15 min pause, one lockout mail per window; 5 wrong codes end one pending login. A success clears the subject counter. Reuse `src/club/portal/limits.ts` rules and `auth/limit.ts`.
- Cookies: `HttpOnly`, `SameSite=Lax`, `Secure` in production. Device `__Host-es_adm_dev` (locally `es_adm_dev`), 400 days, 32 random bytes; pending `__Host-es_adm_2fa` (locally `es_adm_2fa`), 10 minutes, path `/`; Google state cookie path `/api/admin-auth/google`, 10 minutes. Strapi's `strapi_admin_refresh` with Strapi's own options builder.
- Every write is one `store.transaction`; failure answers 500 `"Acțiunea nu a reușit. Nimic nu a fost salvat."`. History lines: subject `adminUser` (admin) or `portalAccount` (coach), texts of spec 13 only.
- Copy: every string in `src/club/security/copy.ts` exactly as spec 10 to 13 and the index rulings give it; "2FA" in every visible string, never "verificare în doi pași"; Romanian, terse, ș and ț with the comma below, straight quotes, no em or en dash, no middle dot, no emoji, "E-mail".
- UI (T16, T17): no pills or circles (only the spinner ring), no dashed or dotted lines, selected state solid primary fill, "white, no boxes" lists in one Card, tokens from `src/admin/ui/tokens.ts`; no button labelled "Salvează" or "Publică" without the `.pce` opt-out class (SaveBar tagger).
- Code: TypeScript, no `any`, single quotes, semicolons, 2-space indent, functions under 30 lines, complexity under 10. `copy.ts`, `api-types.ts`, `code-mac.ts` normalisation and `src/club/roles/map.ts` import no Strapi or React.
- Checks after every task: the task's test file, `npx vitest run`, `npx tsc --noEmit` (zero errors), and `npx tsc -p src/admin --noEmit` when the task touches anything the admin bundle imports. No long runs in the foreground (memory rule).
- Synthetic data only (`@example.invalid`). Never production, `strapi_app`, `strapi_db`, `edusport-test-pg`, ports 1337, 1340, 3010, 5432, 55442. Spike: `es6b1-pg` 127.0.0.1:55469, Strapi 1391. Keys for tests are fixed test constants in `__tests__/keys.ts`, never real keys.
- Commits: Conventional Commits, the message in the task, no `Co-Authored-By`, no AI attribution. Never push. Never commit `.env`.
- Progress board line per status change (`.superpowers/phase3-shared/progress-board.md`, `HH:MM | 6b-1 T<n> | implementer | <status>`); ledger `p3be/.superpowers/sdd/2026-11-07-phase6b-1/progress.md`.

## Review Focus

- **Two parallel requests with the same backup code or e-mail code** (double click, a retry): exactly one opens, the other gets the bad code answer and counts as wrong. Pinned by T6 (`consumeOnce races open once`, both stores) and T8 (`parallel backup code use opens once`).
- **A TOTP code typed twice inside its 90-second window** (a shoulder surfer, a replay): the second use is refused even within the window. Pinned by T5 (`replay at the same step is refused`) and T6 (`acceptStep compare-and-set`).
- **A database dump without the env keys**: no sealed secret opens, no stored MAC matches a known code list. Pinned by T4 (`leak test`) and T6 (`dump of the new tables gives no usable code`).
- **Codes typed with spaces, hyphens, lower case or O for 0** ("abcde-fghjk", "0O1Il"): same code. Pinned by T5 (`normalize`).
- **An admin who has 2FA on and Strapi's own `POST /admin/login`** (an old bookmark, a script): 404, no session. Pinned by T11 (`closed routes answer 404`) and T28 boot check.

---

## File Structure

```
src/api/auth-factor/**, auth-backup-code/**, auth-challenge/**, auth-passkey/**, admin-account/**, admin-device/**   schemas, empty services (T2)
src/api/admin-auth/routes/01-login.ts, 02-security.ts, 03-admins.ts; controllers/admin-auth.ts   (T12, grown by T13 to T15)
src/club/security/
  copy.ts           SECURITY_COPY, SECURITY_ERRORS, SECURITY_TOASTS, SECURITY_ACTIONS, securityHistoryText, SECURITY_MAIL (T3)
  api-types.ts      the index contract types (T3)
  keys.ts           loadKeys, currentKey, keyById, KeysMissing (T4)
  secret-box.ts     seal, open (T4)
  code-mac.ts       normalizeCode, codeMac, macMatchesAny (T4)
  totp.ts           newTotpSecret, base32, totpAt, checkTotp, otpauthUrl (T5)
  backup-codes.ts   newBackupCodes, formatBackupCode (T5)
  email-code.ts     newEmailCode, EMAIL_CODE_TTL_MS, EMAIL_CODE_MAX_TRIES (T5)
  qr.ts             qrSvg (T5)
  types.ts, store.ts, strapi-store.ts   SecurityStore (T6)
  factors.ts        securityView, startTotp, confirmTotp, sendEnrolCode, confirmEmail, turnOff, newBatch (T7)
  reset.ts          resetTwoFactor (T7)
  second-step.ts    hasTwoFactor, openPending, readPending, sendLoginCode, verifySecondStep (T8)
  remembered.ts     rememberUntil, isRemembered, forgetDevices (T8)
  passkeys.ts       (plan 6b-2, T20)
src/club/admin-login/
  admins.ts         adminByEmail, adminById, canEnterAdmin, ensureAdminAccount (T10)
  devices.ts        ADMIN_DEVICE_COOKIE, bindAdminDevice, listAdminDevices, disconnectAdminDevice (T10)
  session.ts        issueAdminSession, endAdminSessions (T10)
  context.ts        AdminLoginContext, adminLoginContext, adminOrigin, originAllowed (T12)
  login.ts          loginAdmin, secondStepAdmin, sendAdminLoginCode (T12)
  reset.ts, invite.ts, google.ts   (T13, T14)
  security.ts       admin Securitate services (T15)
src/middlewares/admin-auth-gate.ts, admin-login-page.ts   (T11, T16)
src/email/security-mail.ts   renderSecurityMail (T3)
src/admin-login/**, vite.admin-login.config.ts   (T16)
src/admin/pages/SecuritatePage.tsx, src/admin/pages/securitate/**   (T17)
scripts/admin-reset-2fa.ts   (T15)
```

---

### Task 1: Spike: our controller issues Strapi's admin session (high, Sonnet). GATE

**Files:**
- Create: `src/club/admin-login/__tests__/spike-admin-session.test.ts`, a scratch route under the worktree's scratch folder (`.superpowers/sdd/2026-11-07-phase6b-1/spike/`, not committed) for the boot checks.

**Interfaces:**
- Consumes: `node_modules/@strapi/admin/dist/server/shared/utils/session-auth.js` (`REFRESH_COOKIE_NAME`, `buildCookieOptionsWithExpiry`, `getSessionManager`), `server/src/controllers/authentication.js` (the login handler, read lines 60 to 90), `server/src/routes/authentication.js`, the admin SPA `admin/src/reducer.mjs`, `utils/getFetchClient.mjs`, `shared/utils/auth-cookie-name.js`; the session manager test helper `src/club/__tests__/admin-sessions.ts`.
- Produces: the ledger line (index "The gate") and the facts T10 relies on, written as assertions in the spike test, which stays in the suite: method names, the `{ token, absoluteExpiresAt }` shape, the cookie name and options, the `jwtToken` storage keys, the lifetimes.

- [ ] **Step 1: Unit spike test** on the in-memory manager, origin `admin`, Strapi's default admin session config. One `it` per check:
  1. `generateRefreshToken('7', 'dev-1', { type: 'refresh' })` answers `{ token, absoluteExpiresAt }`; `generateAccessToken(token)` gives an access token; `validateAccessToken` is valid with `userId: '7'`.
  2. `type: 'session'`: idle 2 hours, max 1 day; `type: 'refresh'`: idle 14 days, max 30 days (fake clock).
  3. `rotateRefreshToken` works once per token; the old one then answers an error.
  4. `invalidateRefreshToken('7')` ends every session of 7; `invalidateRefreshToken('7', 'dev-1')` ends only `dev-1` (record FAIL 4 if the second form is absent).
  5. `buildCookieOptionsWithExpiry('session', exp, false)` and `('refresh', exp, true)`: record `httpOnly`, `sameSite`, `path`, `domain`, `secure`, `expires` as assertions.
- [ ] **Step 2: Boot spike** on `es6b1-pg` (fresh Postgres 16), Strapi 1391, a throwaway admin `admin1@example.invalid` from `npx strapi admin:create-user`. A scratch controller (`auth: false`) does what T10 will do for that admin id: `generateRefreshToken(String(id), 'spike-dev', { type })`, `ctx.cookies.set(REFRESH_COOKIE_NAME, token, buildCookieOptionsWithExpiry(...))`, `generateAccessToken`, answers the access token. With Playwright (scratch script):
  1. remember: page script stores `localStorage.jwtToken` (JSON string as the SPA writes it, read `reducer.mjs`) and `isLoggedIn`, then `location.assign('/admin')`: the dashboard opens logged in; reload keeps it; no remember: the `jwtToken` cookie the SPA reads (name from `auth-cookie-name.js`), same result.
  2. `POST /admin/access-token` rotates; `POST /admin/logout` ends it (next `/admin` lands on login).
  3. `admin::role` create with `code: 'edusport-site-editor'` keeps the code; a Content Manager permission on `api::article.article` only hides Settings, Marketplace and the Content-Type Builder for an admin of that role; `GET /admin/users/me` answers `roles[].code` for that admin.
  4. A scratch global middleware answers 404 to `POST /admin/login` placed after `strapi::body`; `GET /admin/auth/login` answered 302 to `/login` by the same middleware; in the SPA, a logout navigates to `/admin/auth/login` and a `history` listener in `app.tsx`'s bootstrap replaces it with `/login` (record which hook catches it).
- [ ] **Step 3: Run** `npx vitest run src/club/admin-login/__tests__/spike-admin-session.test.ts`. Expected: PASS for every check that holds; keep the failing ones as `it.fails` with a comment naming the FAIL number.
- [ ] **Step 4: Decide and stop.** All pass: ledger `SPIKE PASS`. Else ledger `SPIKE FAIL <n>` with what was seen. Report to the controller and stop until answered (index "The gate" lists the paths). Remove the container.
- [ ] **Step 5: Commit**

```bash
git add src/club/admin-login/__tests__/spike-admin-session.test.ts
git commit -m "test(admin-login): spike, Strapi admin session issued from our code"
```

---

### Task 2: Content types and subject (low, Haiku)

**Files:**
- Create: `src/api/<name>/content-types/<name>/schema.json` and `src/api/<name>/services/<name>.ts` (`factories.createCoreService`) for `auth-factor`, `auth-backup-code`, `auth-challenge`, `auth-passkey`, `admin-account`, `admin-device`; no routes, no controllers.
- Modify: `src/api/portal-account/content-types/portal-account/schema.json`, `src/api/portal-device/content-types/portal-device/schema.json`, `src/club/subjects.ts`.
- Test: `src/club/security/__tests__/schemas.test.ts`

**Interfaces:**
- Produces: tables `auth_factors`, `auth_backup_codes`, `auth_challenges`, `auth_passkeys`, `admin_accounts`, `admin_devices`; `SUBJECT.adminUser = 'admin-user'`.

- [ ] **Step 1: Failing test** reading each `schema.json` (style of `src/club/portal/__tests__/schemas.test.ts`). Every new type: `draftAndPublish: false`, `pluginOptions['content-manager'].visible === false`, `pluginOptions['content-type-builder'].visible === false`, no `routes/` folder. Fields exactly as spec 3.1 to 3.6:

```ts
it('auth-factor', () => {
  const s = schema('auth-factor');
  expect(s.collectionName).toBe('auth_factors');
  expect(s.attributes.subjectType).toMatchObject({ type: 'enumeration', enum: ['portal', 'admin'], required: true });
  expect(s.attributes.subjectId).toMatchObject({ type: 'string', required: true });
  expect(s.attributes.kind).toMatchObject({ type: 'enumeration', enum: ['totp', 'email'], required: true });
  expect(s.attributes.secretBox.type).toBe('text');
  expect(s.attributes.lastStep.type).toBe('biginteger');
  for (const k of ['confirmedAt', 'lastUsedAt']) expect(s.attributes[k].type).toBe('datetime');
});
```
Same style: `auth-backup-code` (`subjectType`, `subjectId`, `batch` string required, `codeMac` string required, `keyId` string required, `usedAt` datetime); `auth-challenge` (`purpose` enum `pending-login | email-code | reset-code | passkey-register | passkey-login` required, `subjectType` enum not required, `subjectId` string, `secretMac` string required unique, `data` json, `expiresAt` datetime required, `usedAt` datetime, `tries` integer default 0); `auth-passkey` (`credentialId` string required unique, `publicKey` text required, `counter` biginteger default 0, `transports` json, `deviceType` enum `singleDevice | multiDevice`, `backedUp` boolean, `rpId` string required, `name` string maxLength 60 required, `lastUsedAt` datetime); `admin-account` (`adminUserId` integer required unique, `googleSub` string unique, `webauthnUserId` string required unique, `lastMethod` enum `totp | email | backup`, `passkeyOfferedAt` datetime, `securityNotes` json: holds `{ backupNotice: number }` for spec 6.3 S29, plan ruling); `admin-device` (`adminUserId` integer required, `deviceKeyHash` string required, `strapiDeviceId` string required unique, `label` string required, `firstSeenAt`, `lastSeenAt` datetime required, `twoFactorUntil`, `revokedAt` datetime). `portal-account` gains `webauthnUserId` string unique, `lastMethod` enum, `passkeyOfferedAt` datetime, `securityNotes` json; `portal-device` gains `twoFactorUntil` datetime.
- [ ] **Step 2: Run** `npx vitest run src/club/security/__tests__/schemas.test.ts`. FAIL.
- [ ] **Step 3: Create the schemas**, the services and the subject. The unique on (`subjectType`, `subjectId`, `kind`) of `auth_factors` is a database index created in `src/index.ts` bootstrap with knex `createIndex` if absent (Strapi schemas have no compound unique); name `auth_factors_subject_kind_uq`, unique. Add it to the test as a source-reading check of `src/index.ts`.
- [ ] **Step 4: Run** test, suite, tsc. PASS.
- [ ] **Step 5: Commit** `feat(security): 2FA, challenge, passkey and admin account content types`.

---

### Task 3: Copy, contract types and security mails (low, Haiku)

**Files:**
- Create: `src/club/security/copy.ts`, `src/club/security/api-types.ts`, `src/email/security-mail.ts`
- Test: `src/club/security/__tests__/copy.test.ts`, `src/email/__tests__/security-mail.test.ts`

**Interfaces:**
- Produces: `SECURITY_ERRORS` (`unavailable`, `badCode`, `pendingExpired`, `paused`, `passkeyFailed`, `passkeyOtherKind`, `appAlreadyOn`, `passkeyLimit`, `selfReset`, `wrongCurrent`, `noAccess`, `googleNoAccount`), `SECURITY_TOASTS` (`twoFactorOn`, `twoFactorOff`, `newCodes`, `passkeyCreated`, `passkeyDeleted`, `saved`, `passwordChanged`, `twoFactorReset`), `SECURITY_COPY` (every screen string of spec 10.1 to 10.5 and 11.2, 11.3, 8.4, 8.6 step 3, 6.3 notice `backupLeft(n)`, 6.4 `rememberedUntil(date)`, 4.6 Google hint), `SECURITY_ACTIONS` and `securityHistoryText(action, changes)` for the spec 13 lines, `SECURITY_MAIL` (spec 12), the index types verbatim; `renderSecurityMail(kind: 'code' | 'lockout2fa' | 'reset2fa' | 'changed', data): { subject: string; html: string; text: string }` in layout E1 (`src/email/portal-direct.ts` pattern), signature "Echipa EduSport".

- [ ] **Step 1: Failing tests**: every spec string present exactly (a table test listing each string with its key); no value contains `"verificare"`, `—`, `–`, `·`, a curly quote, or `Email` without the hyphen (scan all values); `securityHistoryText('backupUsed', { left: 3 })` is `"Cod de rezervă folosit, mai sunt 3."`; `securityHistoryText('reset', { by: 'Ana Pop' })` is `"2FA resetat de Ana Pop."`; `api-types.ts` source has no `import`. Mail: `renderSecurityMail('code', { code: '123456' })` subject `"Codul tău pentru 2FA"` and the three lines of spec 12; `changed` with `{ passkey: 'Telefon' }` has `"A fost creată o cheie de acces: Telefon."`; the code appears once in html and text and nowhere else (no header, no subject).
- [ ] **Step 2: Run** both tests. FAIL.
- [ ] **Step 3: Implement.** Mail sending reuses `sendPortalMail` / `sendNow` (outside production every mail goes to the one test address, as phase 6).
- [ ] **Step 4: Run** tests, suite, tsc, `tsc -p src/admin`. PASS.
- [ ] **Step 5: Commit** `feat(security): copy, contract types and 2FA e-mails`.

---

### Task 4: Keys, sealed secrets, code MACs (high, Sonnet)

**Files:**
- Create: `src/club/security/keys.ts`, `secret-box.ts`, `code-mac.ts`, `__tests__/keys.ts` (fixed test keys)
- Test: `src/club/security/__tests__/crypto.test.ts`

**Interfaces:**

```ts
// keys.ts
export type Key = { id: string; bytes: Buffer };
export type Keys = { secret: Key; secretOld: Key | null; code: Key; codeOld: Key | null };
export class KeysMissing extends Error {}
export function loadKeys(env?: NodeJS.ProcessEnv): Keys | null; // null when either current key is missing or not 32 bytes after base64 decode; logs nothing itself
export const keyId = (bytes: Buffer): string; // first 8 hex of sha256
export function requireKeys(k: Keys | null): Keys; // throws KeysMissing
// secret-box.ts
export function seal(k: Keys, plain: Buffer, aad: string): string; // v1.<keyId>.<iv>.<ct>.<tag>
export function open(k: Keys, boxed: string, aad: string): { plain: Buffer; stale: boolean } | null; // stale: sealed under the old key, caller re-seals
export const totpAad = (subjectType: 'portal' | 'admin', subjectId: string): string; // `totp:${t}:${id}`
// code-mac.ts
export type CodePurpose = 'backup' | 'email-code' | 'reset-code' | 'pending-login' | 'passkey';
export function normalizeCode(raw: string): string;
export function codeMac(k: Keys, purpose: CodePurpose, subjectType: string, subjectId: string, code: string, which?: 'current' | 'old'): { mac: string; keyId: string };
export function macMatchesAny(k: Keys, purpose: CodePurpose, subjectType: string, subjectId: string, typed: string, rows: { id: string; mac: string; keyId: string }[]): string | null; // id of the match
```
`macMatchesAny` computes the typed MAC once per key id present, then compares with `timingSafeEqual` against every row (equal-length hex buffers), keeps the first match id without breaking the loop.

- [ ] **Step 1: Failing tests**:
  - `loadKeys`: missing, empty, 31 bytes, 33 bytes -> null; two valid -> ids are 8 hex; `_OLD` loaded when set.
  - seal then open round trip; open with the other subject's aad -> null (`moved ciphertext refused`); a flipped byte in ct or tag -> null; open under a key set without the sealing key -> null; sealed with the old key and opened after rotation -> `stale: true`; two seals of the same secret differ (random IV).
  - `normalizeCode(' abcde-fghjk ')` = `'ABCDEFGHJK'`; `normalizeCode('o0iIl1')` = `'001111'`.
  - `codeMac` differs by purpose, subject type, subject id and key; equal for `'ABCDE FGHJK'` and `'abcde-fghjk'`.
  - `macMatchesAny`: a match in position 1 and position 10 of 10 rows both found; a spy on `timingSafeEqual` is called 10 times in each case (`ten-way compare without early exit`); a row under the old key matches when the old key is loaded.
  - `leak test`: seal 3 secrets and MAC 10 known codes, then with a fresh key set of other random keys: every `open` is null and `macMatchesAny` finds nothing for every known code.
- [ ] **Step 2: Run** `npx vitest run src/club/security/__tests__/crypto.test.ts`. FAIL.
- [ ] **Step 3: Implement** with `node:crypto` only (`createCipheriv('aes-256-gcm')`, `createHmac('sha256')`, `timingSafeEqual`, `randomBytes(12)`).
- [ ] **Step 4: Run** test, suite, tsc. PASS.
- [ ] **Step 5: Commit** `feat(security): env keys, sealed TOTP secrets and keyed code MACs`.

---

### Task 5: TOTP, backup codes, e-mail codes, QR (high, Sonnet)

**Files:**
- Create: `src/club/security/totp.ts`, `backup-codes.ts`, `email-code.ts`, `qr.ts`
- Modify: `package.json` (`"qrcode": "1.5.4"`, `"@types/qrcode"` pinned exactly to the current version at install)
- Test: `src/club/security/__tests__/codes.test.ts`

**Interfaces:**

```ts
export const TOTP_STEP_S = 30; export const TOTP_DIGITS = 6;
export function newTotpSecret(): Buffer; // randomBytes(20)
export function base32(b: Buffer): string; // RFC 4648, no padding
export function totpAt(secret: Buffer, step: number): string;
export function checkTotp(secret: Buffer, code: string, now: Date, lastStep: number | null): number | null; // accepted step or null; tries step-1, step, step+1; refuses steps <= lastStep
export function otpauthUrl(email: string, secret: Buffer): string; // otpauth://totp/EduSport:<email>?secret=<b32>&issuer=EduSport
export function groupedKey(secret: Buffer): string; // base32 in groups of 4, space separated
export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function newBackupCodes(n?: number): string[]; // 10 by default, each 10 chars via randomInt(32)
export const formatBackupCode = (c: string): string; // 'XXXXX XXXXX'
export const EMAIL_CODE_TTL_MS = 600_000; export const EMAIL_CODE_MAX_TRIES = 5;
export const newEmailCode = (): string; // 6 digits, randomInt(1_000_000) padded
export async function qrSvg(text: string): Promise<string>; // qrcode toString type 'svg', margin 1, error level M
```

- [ ] **Step 1: Failing tests**:
  - RFC 6238 appendix B vectors (SHA-1 secret `12345678901234567890`) truncated to 6 digits: T = 59, 1111111109, 1111111111, 1234567890, 2000000000, 20000000000 give `287082`, `081804`, `050471`, `005924`, `279037`, `353130`.
  - window: the code of step-1 and step+1 accepted, step-2 refused; `replay at the same step is refused` (`lastStep` = accepted step -> null); a code of an earlier step than `lastStep` refused.
  - codes not of 6 digits -> null without computing.
  - `newBackupCodes()`: 10 distinct, each matches `/^[0-9A-HJKMNP-TV-Z]{10}$/`; `randomInt` spied, called 100 times; `formatBackupCode('ABCDEFGHJK')` = `'ABCDE FGHJK'`.
  - `newEmailCode()` matches `/^\d{6}$/`.
  - `otpauthUrl('admin1@example.invalid', secret)` exact string; `qrSvg` output starts with `<svg` and contains no `otpauth` text node.
- [ ] **Step 2: Run** `npx vitest run src/club/security/__tests__/codes.test.ts`. FAIL.
- [ ] **Step 3: Implement** `totpAt` with `createHmac('sha1')`, dynamic truncation per RFC 4226; no TOTP dependency.
- [ ] **Step 4: Run** test, suite, tsc. PASS.
- [ ] **Step 5: Commit** `feat(security): TOTP (RFC 6238), backup and e-mail codes, QR SVG`.

---

### Task 6: SecurityStore (high, Sonnet)

**Files:**
- Create: `src/club/security/types.ts`, `store.ts`, `strapi-store.ts`, `__tests__/memory-security-store.ts`
- Test: `src/club/security/__tests__/security-store.test.ts` (both stores, parity), `security-store-pg.test.ts` (Strapi store on the throwaway Postgres, skipped without `SECURITY_PG_URL`, pattern of `portal-store-pg.test.ts`)

**Interfaces:**

```ts
export type SubjectType = 'portal' | 'admin';
export type Subject = { type: SubjectType; id: string };
export type FactorRow = { id: string; subject: Subject; kind: 'totp' | 'email'; secretBox: string | null; confirmedAt: string | null; lastStep: number | null; lastUsedAt: string | null; createdAt: string };
export type BackupRow = { id: string; subject: Subject; batch: string; codeMac: string; keyId: string; usedAt: string | null; createdAt: string };
export type ChallengeRow = { id: string; purpose: ChallengePurpose; subject: Subject | null; secretMac: string; data: Record<string, unknown>; expiresAt: string; usedAt: string | null; tries: number };
export type PasskeyRow = { id: string; subject: Subject; credentialId: string; publicKey: string; counter: number; transports: string[]; deviceType: string; backedUp: boolean; rpId: string; name: string; createdAt: string; lastUsedAt: string | null };
export type AdminAccountRow = { id: string; adminUserId: number; googleSub: string | null; webauthnUserId: string; lastMethod: TwoFactorMethod | null; passkeyOfferedAt: string | null };
export type AdminDeviceRow = { id: string; adminUserId: number; deviceKeyHash: string; strapiDeviceId: string; label: string; firstSeenAt: string; lastSeenAt: string; twoFactorUntil: string | null; revokedAt: string | null };
export interface SecurityStore {
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  factors(s: Subject): Promise<FactorRow[]>;
  upsertFactor(s: Subject, kind: 'totp' | 'email', f: { secretBox: string | null }): Promise<string>; // replaces an unconfirmed row
  confirmFactor(id: string, at: string): Promise<void>;
  updateFactor(id: string, f: { secretBox?: string; lastUsedAt?: string }): Promise<void>;
  acceptStep(id: string, step: number): Promise<boolean>; // UPDATE ... SET lastStep WHERE id AND (lastStep IS NULL OR lastStep < step); true when 1 row
  deleteFactors(s: Subject, kind?: 'totp' | 'email'): Promise<number>;
  unusedBackup(s: Subject): Promise<BackupRow[]>;
  insertBackupBatch(s: Subject, batch: string, rows: { codeMac: string; keyId: string }[], at: string): Promise<void>; // marks every older unused row used first
  deleteBackup(s: Subject): Promise<number>;
  createChallenge(c: Omit<ChallengeRow, 'id' | 'usedAt' | 'tries'>): Promise<string>;
  challengeByMac(mac: string): Promise<ChallengeRow | null>;
  openChallenges(s: Subject, purpose: ChallengePurpose): Promise<ChallengeRow[]>;
  addTry(id: string): Promise<number>; // atomic tries + 1, returns the new count
  consumeOnce(table: 'backup' | 'challenge', id: string, at: string): Promise<boolean>; // guarded UPDATE WHERE usedAt IS NULL
  passkeys(s: Subject): Promise<PasskeyRow[]>; passkeyByCredential(credentialId: string): Promise<PasskeyRow | null>;
  createPasskey(p: Omit<PasskeyRow, 'id' | 'lastUsedAt'>): Promise<string>; updatePasskey(id: string, p: { counter?: number; lastUsedAt?: string; name?: string }): Promise<void>; deletePasskey(id: string): Promise<void>;
  adminAccount(adminUserId: number): Promise<AdminAccountRow | null>; adminAccountByGoogleSub(sub: string): Promise<AdminAccountRow | null>; adminAccountByHandle(h: string): Promise<AdminAccountRow | null>;
  ensureAdminAccount(adminUserId: number): Promise<AdminAccountRow>; // creates with a 32-byte base64url webauthnUserId
  updateAdminAccount(id: string, a: Partial<Omit<AdminAccountRow, 'id' | 'adminUserId'>>): Promise<void>;
  adminDevices(adminUserId: number): Promise<AdminDeviceRow[]>; adminDeviceByKey(adminUserId: number, keyHash: string): Promise<AdminDeviceRow | null>;
  createAdminDevice(d: Omit<AdminDeviceRow, 'id' | 'revokedAt' | 'twoFactorUntil'>): Promise<string>; updateAdminDevice(id: string, d: Partial<Pick<AdminDeviceRow, 'lastSeenAt' | 'twoFactorUntil' | 'revokedAt' | 'label'>>): Promise<void>;
  portalAccountExtra(accountId: string): Promise<{ webauthnUserId: string | null; lastMethod: TwoFactorMethod | null; passkeyOfferedAt: string | null }>;
  updatePortalAccountExtra(accountId: string, a: Partial<{ webauthnUserId: string; lastMethod: TwoFactorMethod; passkeyOfferedAt: string | null }>): Promise<void>;
  setPortalDeviceTwoFactor(deviceId: string, until: string | null): Promise<void>;
  securityNotes(s: Subject): Promise<{ backupNotice?: number }>; setSecurityNotes(s: Subject, n: { backupNotice?: number }): Promise<void>; // the json field of admin_accounts / portal_accounts
  record(line: { subjectType: SubjectType; subjectId: string; action: string; changes: Record<string, unknown>; actor: string }): Promise<void>; // history, subject adminUser or portalAccount
  purge(now: Date): Promise<Record<string, number>>; // spec 3.9 rules except the old-rpId passkeys (T23)
}
export function strapiSecurityStore(strapi: Core.Strapi): SecurityStore;
```
`acceptStep`, `addTry` and `consumeOnce` use `strapi.db.getConnection(<table>)` with `transacting(scope.current())` when inside a transaction (pattern of `portal/strapi-store.ts` `lockLimit`), returning the affected row count; never `SELECT ... FOR UPDATE`. The memory store serializes these three on a per-id promise chain so its race tests mean the same.

- [ ] **Step 1: Failing tests** (`describe.each([memory, strapi-fake-db])` where the Strapi variant runs on the pg test only):
  - `consumeOnce races open once`: `Promise.all` of two `consumeOnce('backup', id)` -> exactly one true; same for `challenge`.
  - `acceptStep compare-and-set`: steps 10 then 10 -> true, false; 12 then 11 -> true, false; parallel 13 and 13 -> one true.
  - `insertBackupBatch` marks the older unused rows used and leaves 10 unused.
  - `upsertFactor` on an unconfirmed row replaces it; on a confirmed row of the same kind throws (the caller checks first).
  - `addTry` parallel x5 ends at 5.
  - `ensureAdminAccount` twice returns the same row; `webauthnUserId` decodes to 32 bytes.
  - `purge`: unconfirmed factors older than 15 minutes, used or expired challenges older than 1 day, used backup codes older than 30 days, revoked admin devices older than 30 days are removed; newer ones stay (fake clock).
  - `dump of the new tables gives no usable code`: after enrolling a TOTP factor and a batch through the T4 helpers, a JSON dump of every row of the store contains none of the 10 codes in any normalization and no base32 of the secret.
- [ ] **Step 2: Run** both test files (`SECURITY_PG_URL=postgres://...@127.0.0.1:55469/...` for the pg file only when the controller provides the container). FAIL.
- [ ] **Step 3: Implement** both stores.
- [ ] **Step 4: Run** tests, suite, tsc. PASS.
- [ ] **Step 5: Commit** `feat(security): security store with compare-and-set single use`.

---

### Task 7: 2FA lifecycle and reset (high, Sonnet)

**Files:**
- Create: `src/club/security/factors.ts`, `src/club/security/reset.ts`, `src/club/security/context.ts`
- Test: `src/club/security/__tests__/factors.test.ts`, `reset.test.ts`

**Interfaces:**

```ts
// context.ts
export type SecurityContext = {
  store: SecurityStore; keys: Keys | null; now: () => Date; log: (m: string) => void;
  mail: (to: string, kind: SecurityMailKind, data: Record<string, unknown>) => Promise<boolean>;
  limits: Limiter; ip: string; userAgent: string | null; actor: string;
  endSessions: (s: Subject, o: { exceptDevice?: string }) => Promise<void>; // admin: T10 endAdminSessions; portal: sessions.revokeAll
  forgetDevices: (s: Subject, o: { exceptDevice?: string }) => Promise<void>; // T8 forgetDevices
};
// factors.ts (s: the signed-in subject, email: its address)
export async function securityView(c: SecurityContext, s: Subject, email: string): Promise<SecurityView>; // clears backupNotice after reading
export async function startTotp(c: SecurityContext, s: Subject, email: string): Promise<PortalResult<TotpStart>>;
export async function confirmTotp(c: SecurityContext, s: Subject, code: string): Promise<PortalResult<MethodOn>>;
export async function sendEnrolCode(c: SecurityContext, s: Subject, email: string): Promise<PortalResult<CodeSent>>;
export async function confirmEmail(c: SecurityContext, s: Subject, code: string): Promise<PortalResult<MethodOn>>;
export async function turnOff(c: SecurityContext, s: Subject, email: string, kind: 'totp' | 'email'): Promise<PortalResult<{ toast: string }>>;
export async function newBatch(c: SecurityContext, s: Subject): Promise<PortalResult<BackupBatch>>;
// reset.ts
export async function resetTwoFactor(c: SecurityContext, s: Subject, email: string, by: string | 'server'): Promise<void>;
```
Rules (spec 5.2, 6.2, 6.5, 6.6): every function starts with `keys` missing -> 503 `unavailable` and an error log. `startTotp`: 409 `appAlreadyOn` when a confirmed totp exists; seals a new secret into an unconfirmed row, answers `qrSvg(otpauthUrl)` and `groupedKey`; the secret is never returned by any other call. `confirmTotp`: opens the unconfirmed row, `checkTotp` with `lastStep` null, then `acceptStep`, `confirmFactor`; first method on -> a new batch (10 codes MAC'd with purpose `backup`) returned once in `MethodOn.backupCodes`. Enrol code: a `email-code` challenge with `data.enrol: true`, 10 minutes, 5 tries, mail `code`, older open enrol codes used up; within `mailAllowed` else "as if sent". `turnOff`: deletes the kind; the last method off also deletes backup codes and calls `forgetDevices` (S30); mail `changed` with `twoFactorOff`; history line. `resetTwoFactor`: deletes factors and backup codes, `forgetDevices`, `endSessions` for every device, history `reset` (`by` = admin name or `"server"` line), mail `reset2fa`; passkeys stay. Each change writes its spec 13 line with actor `c.actor`.

- [ ] **Step 1: Failing tests** (memory store, fixed test keys, fake mail and clock):
  - start then confirm with the right code -> `twoFactorOn` toast, 10 codes, factor confirmed, history `"2FA activat: aplicație."`; a second start -> 409.
  - confirm with a wrong code -> 400 `badCode`, factor stays unconfirmed; after 15 minutes the purge removes it.
  - e-mail enrol: code mailed, the 6th send in an hour sends nothing but answers `CodeSent`; 5 wrong confirm tries use the code up; a right code after that -> `badCode`.
  - second method on -> `backupCodes: null`.
  - turn off one of two -> codes stay; turn off the last -> codes deleted, `forgetDevices` called, mail `changed`, history `"2FA oprit: aplicație."`.
  - `newBatch` with no method -> 400; with one -> 10 new codes, the old ones refused at login (T8 uses them).
  - `resetTwoFactor(..., 'Ana Pop')` -> factors and codes gone, passkeys kept, `endSessions` and `forgetDevices` called, history `"2FA resetat de Ana Pop."`, mail `reset2fa`; `'server'` -> `"2FA resetat de pe server."`.
  - keys missing -> every function answers 503 `"2FA nu este disponibil acum."`.
  - `securityView` returns `backupNotice` once then null.
- [ ] **Step 2: Run** both tests. FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests, suite, tsc. PASS.
- [ ] **Step 5: Commit** `feat(security): 2FA enrolment, backup codes, turn off and reset`.

---

### Task 8: The second step and remembered devices (high, Sonnet)

**Files:**
- Create: `src/club/security/second-step.ts`, `src/club/security/remembered.ts`
- Test: `src/club/security/__tests__/second-step.test.ts`

**Interfaces:**

```ts
// remembered.ts
export const REMEMBER_MS = 30 * 24 * 3600_000;
export const rememberUntil = (now: Date): string; // now + 30 days, fixed
export const isRemembered = (until: string | null, now: Date): boolean;
export async function forgetDevices(store: SecurityStore, s: Subject, o: { exceptDevice?: string }): Promise<void>; // twoFactorUntil = null on admin or portal devices
// second-step.ts
export const PENDING_TTL_MS = 600_000; export const PENDING_MAX_WRONG = 5;
export type PendingData = { method: TwoFactorMethod; rememberMe: boolean; host: string; deviceKeyHash: string | null };
export async function hasTwoFactor(c: SecurityContext, s: Subject): Promise<TwoFactorMethod[]>; // confirmed kinds, plus 'backup' when unused codes exist; [] when none
export async function openPending(c: SecurityContext, s: Subject, email: string, d: Omit<PendingData, 'method'>, lastMethod: TwoFactorMethod | null): Promise<{ secret: string; step: SecondStep }>;
export async function sendLoginCode(c: SecurityContext, secret: string): Promise<PortalResult<CodeSent>>;
export type Verified = { subject: Subject; data: PendingData; method: TwoFactorMethod; backupLeft: number | null };
export async function verifySecondStep(c: SecurityContext, secret: string, method: TwoFactorMethod, code: string): Promise<PortalResult<Verified>>;
```
`openPending`: 32 random bytes base64url, `pending-login` challenge (MAC purpose `pending-login`, 10 minutes), `SecondStep` as the index defines `last`; when `last` is `email` it sends the code at once (spec 6.3). `verifySecondStep` order: keys -> 503; `ipBlocked` -> 429; challenge by MAC: missing, used, expired -> 401 `pendingExpired`; subject counter locked (`2fa:<type>:<id>`) -> end the pending (`consumeOnce`) and 429 `paused`; check by method (totp: open, `checkTotp` with `lastStep`, `acceptStep`, re-seal when `stale`; email: open `email-code` challenges of the subject, `macMatchesAny`, `consumeOnce`; backup: `unusedBackup`, `macMatchesAny`, `consumeOnce`); wrong -> subject counter hit (`firstLock` -> lockout mail with the 2FA line and history `"Blocat 15 minute după 5 coduri greșite."`), pending `addTry` (5 -> `consumeOnce` the pending), 400 `badCode` or 429 when locking; right -> `consumeOnce` the pending (false -> 401 `pendingExpired`), clear the subject counter; backup -> history `backupUsed` with the count left and `setSecurityNotes(s, { backupNotice: left })` (T7 `securityView` reads and clears it). The caller saves `lastMethod`, sets `twoFactorUntil` when `remember`, and issues the session.

- [ ] **Step 1: Failing tests**:
  - right TOTP -> `Verified`; the same code again on a new pending -> 400 (`replay`).
  - `parallel backup code use opens once`: two pendings, `Promise.all` with the same backup code -> one `Verified`, one 400.
  - 5 wrong codes on one pending -> the 6th try answers 401 `pendingExpired` even with the right code.
  - 5 wrong codes across two pendings of one subject within 15 minutes -> 429 `paused`, one lockout mail, one history line; after 15 minutes a right code on a new pending works.
  - expired pending after 10 minutes -> 401; a used pending -> 401.
  - e-mail method: `openPending` with `last: 'email'` sends one mail; `sendLoginCode` makes the older code unusable; the 6th send in an hour answers `CodeSent` without a mail.
  - a code for another subject's pending never matches (MAC bound to the subject).
  - `isRemembered` false at exactly 30 days and 1 ms; `forgetDevices` with `exceptDevice` keeps that one.
  - keys missing -> 503.
- [ ] **Step 2: Run** `npx vitest run src/club/security/__tests__/second-step.test.ts`. FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** test, suite, tsc. PASS.
- [ ] **Step 5: Commit** `feat(security): second step at login with attempt limits and remembered devices`.

---

### Task 9: Sentry scrub and purge (low, Haiku)

**Files:**
- Modify: `src/sentry.ts` (the `beforeSend` of the Sentry init), `src/club/portal/purge.ts`, `config/cron-tasks.ts` (comment)
- Test: `src/__tests__/sentry-scrub.test.ts`, `src/club/portal/__tests__/purge.test.ts` (extend)

**Interfaces:**
- Produces: `scrubAuthEvent(event)`: for a request URL path starting with `/api/admin-auth/`, `/api/portal/auth/`, `/api/portal/me/`, `/login`, drops `request.data`, `request.cookies`, the `cookie` and `authorization` headers and the query string; `purgePortal` also calls `securityStore.purge(now)` and returns its counts merged.

- [ ] **Step 1: Failing tests**: an event for `POST /api/admin-auth/2fa` with `data: { code: '123456' }` comes out with no `123456` anywhere in `JSON.stringify(event)`; same for `/api/portal/me/2fa/totp/confirm`; an event for `/api/club/summary` keeps its data. Purge counts include `factors`, `challenges`, `backupCodes`, `adminDevices`.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc).
- [ ] **Step 5: Commit** `feat(security): drop auth bodies from Sentry and purge 2FA rows`.

---

### Task 10: Admin session handoff, admins and devices (high, Sonnet)

**Files:**
- Create: `src/club/admin-login/admins.ts`, `devices.ts`, `session.ts`
- Test: `src/club/admin-login/__tests__/session.test.ts`

**Interfaces:**

```ts
// admins.ts
export type AdminRow = { id: number; email: string; firstname: string | null; lastname: string | null; isActive: boolean; blocked: boolean; passwordHash: string | null; roleCodes: string[] };
export async function adminByEmail(strapi: Core.Strapi, email: string): Promise<AdminRow | null>; // case-insensitive
export async function adminById(strapi: Core.Strapi, id: number): Promise<AdminRow | null>;
export const canEnterAdmin = (a: AdminRow | null): a is AdminRow; // isActive === true && blocked !== true
export const adminName = (a: AdminRow): string; // "<firstname> <lastname>" trimmed, else the e-mail
// devices.ts
export const ADMIN_DEVICE_COOKIE = (secure: boolean): string; // '__Host-es_adm_dev' | 'es_adm_dev'
export async function bindAdminDevice(c: { store: SecurityStore; now: () => Date; userAgent: string | null }, adminId: number, cookieValue: string | null): Promise<{ device: AdminDeviceRow; newKey: string | null; isNew: boolean }>;
export async function listAdminDevices(store: SecurityStore, adminId: number, cookieValue: string | null): Promise<AdminDeviceView[]>;
export async function disconnectAdminDevice(c: AdminSessionCtx, adminId: number, deviceId: string, cookieValue: string | null): Promise<PortalResult<{ revokedCurrent: boolean }>>;
// session.ts
export type AdminSessionCtx = { strapi: Core.Strapi; koa: KoaContext; store: SecurityStore; now: () => Date };
export async function issueAdminSession(c: AdminSessionCtx, adminId: number, device: AdminDeviceRow, rememberMe: boolean): Promise<{ accessToken: string }>;
export async function endAdminSessions(c: AdminSessionCtx, adminId: number, o: { exceptDevice?: string }): Promise<void>; // invalidateRefreshToken per device or all
```
`issueAdminSession` does exactly the spike-proven steps (T1 facts): `generateRefreshToken(String(adminId), device.strapiDeviceId, { type: rememberMe ? 'refresh' : 'session', metadata })`, sets `REFRESH_COOKIE_NAME` with `buildCookieOptionsWithExpiry(type, absoluteExpiresAt, koa.request.secure)`, `generateAccessToken`; an `error` answer throws. `bindAdminDevice`: an unknown or missing key makes a new key and row (`strapiDeviceId` = `randomUUID()`), `isNew` true; the caller sends the new-device mail (portal mail as is, spec 4.8). `endAdminSessions` with `exceptDevice` ends every other device and calls `forgetDevices` for them (password change, S17).

- [ ] **Step 1: Failing tests** (in-memory session manager from `src/club/__tests__/admin-sessions.ts`, a fake koa ctx recording cookies):
  - issue with remember -> refresh session type `refresh`, cookie name `strapi_admin_refresh`, the options the spike recorded; without -> type `session`.
  - the access token validates for the admin id and the session's `deviceId` is `device.strapiDeviceId`.
  - `bindAdminDevice` with no cookie -> `newKey` 43 chars base64url, row stored with SHA-256 of the key; again with that key -> same row, `newKey` null, `lastSeenAt` moved.
  - a device key of another admin -> a new row for this admin.
  - `disconnectAdminDevice` ends only that device's sessions, sets `revokedAt`, `revokedCurrent` true when the cookie is that device's.
  - `endAdminSessions(..., { exceptDevice })` leaves that device's session active and clears the others' `twoFactorUntil`.
  - `canEnterAdmin`: inactive -> false; `blocked: true` -> false; `blocked: null` and active -> true.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc).
- [ ] **Step 5: Commit** `feat(admin-login): Strapi admin session handoff and admin devices`.

---

### Task 11: The route gate and the redirect (high, Sonnet)

**Files:**
- Create: `src/middlewares/admin-auth-gate.ts`
- Modify: `config/middlewares.ts` (`'global::admin-auth-gate'` right after `'strapi::body'`), `src/index.ts` (bootstrap: `admin::user` lifecycle `beforeUpdate` / `afterUpdate` for e-mail change)
- Test: `src/middlewares/__tests__/admin-auth-gate.test.ts`, `src/club/admin-login/__tests__/email-change.test.ts`

**Interfaces:**
- Produces: `gateDecision(method: string, path: string, body: unknown, enabled: boolean): 'pass' | 'notFound' | 'forbidden' | { redirect: string }` (pure, exported for the test) and the middleware around it. `onAdminEmailChange(strapi, adminId)`: clears `googleSub`, ends every session (`endAdminSessions`), forgets every device's 2FA.
- Rules (spec 4.4, rulings 9, 15): with `enabled` (`ADMIN_GATE !== 'off'`): `POST /admin/login`, `/admin/register`, `/admin/register-admin`, `/admin/reset-password`, `/admin/forgot-password` -> 404; `PUT /admin/users/me` whose body has `password`, `currentPassword` or `email` -> 403; `PUT /admin/users/:id` with `password` -> 403; `GET /admin/auth/<anything>` -> 302 to the matching `/login` path (`register` -> `/invite`, `forgot-password` and `reset-password` -> `/forgot-password`, else `/login`), keeping only `registrationToken` and `code` from the query; `POST /admin/access-token`, `POST /admin/logout`, everything else -> pass. Disabled: everything passes.

- [ ] **Step 1: Failing tests**: `closed routes answer 404` (each of the five, enabled); disabled -> pass; profile `PUT` with `{ firstname }` passes, with `{ password }` or `{ email }` -> 403; `PUT /admin/users/5 { password }` -> 403, `{ roles }` passes; `GET /admin/auth/register?registrationToken=abc&x=1` -> `{ redirect: '/invite?registrationToken=abc' }`; `GET /admin/auth/login` -> `/login`; `POST /admin/access-token` and `/admin/logout` pass. Source-reading test: `config/middlewares.ts` lists `global::admin-auth-gate` immediately after `strapi::body`. E-mail change: an `admin::user` update that changes `email` calls `onAdminEmailChange`; an update without an e-mail change does not.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc).
- [ ] **Step 5: Commit** `feat(admin-login): close Strapi's session routes and redirect /admin/auth`.

---

### Task 12: Admin password login with the second step (high, Sonnet)

**Files:**
- Create: `src/club/admin-login/context.ts`, `login.ts`, `src/api/admin-auth/routes/01-login.ts`, `src/api/admin-auth/controllers/admin-auth.ts`
- Test: `src/club/admin-login/__tests__/login.test.ts`, `src/club/admin-login/__tests__/admin-auth-routes.test.ts`

**Interfaces:**

```ts
// context.ts
export type AdminLoginContext = SecurityContext & AdminSessionCtx & { compare: (p: string, h: string) => Promise<boolean>; secure: boolean; cookie: (name: string) => string | null; setCookie: (name: string, value: string, maxAgeMs: number, path?: string) => void; clearCookie: (name: string, path?: string) => void };
export function adminOrigin(env?: NodeJS.ProcessEnv): string; // ruling 7
export const originAllowed = (origin: string | undefined, expected: string): boolean; // exact match
export function adminLoginContext(strapi: Core.Strapi, koa: KoaContext): AdminLoginContext;
// login.ts
export async function loginAdmin(c: AdminLoginContext, body: unknown): Promise<PortalResult<AdminHandoff | SecondStep>>;
export async function secondStepAdmin(c: AdminLoginContext, body: unknown): Promise<PortalResult<AdminHandoff>>;
export async function sendAdminLoginCode(c: AdminLoginContext): Promise<PortalResult<CodeSent>>;
export async function finishAdminLogin(c: AdminLoginContext, admin: AdminRow, rememberMe: boolean, o: { newDeviceMail: boolean; passkey: boolean }): Promise<AdminHandoff>; // binds the device, issues the session, computes offerPasskey; used by T13, T14, T21
```
`loginAdmin` order (spec 4.5, the portal `loginWithPassword` order with `admin:` keys): body (400); `ipBlocked(admin:ip)` -> 429; `emailAttempt(admin:login)` refused -> 429; `adminByEmail`; `compare(password, admin?.passwordHash ?? DUMMY_HASH)` always once; wrong or `!canEnterAdmin` -> refuse (lockout mail and `adminUser` history line on the first lock, only for a known admin); right -> `emailCleared`; `hasTwoFactor` non-empty and the device (cookie) has no valid `twoFactorUntil` -> keys missing 503, else `openPending` and set the pending cookie (index ruling 8), answer `SecondStep`; else `finishAdminLogin`. `secondStepAdmin`: pending from the cookie, `verifySecondStep`, then `lastMethod`, `twoFactorUntil` when `remember`, clear the pending cookie, `finishAdminLogin`. The controller checks `originAllowed` first on every POST (403 `"Forbidden"`, no store call). Routes: the eight paths of the index table that this task owns (`login`, `2fa`, `2fa/email`), each `config: { auth: false, policies: [], middlewares: [] }`.

- [ ] **Step 1: Failing tests**:
  - `unknown and known e-mails answer the same`: unknown, wrong password, inactive, blocked -> `{ ok: false, status: 401, error: 'E-mailul sau parola nu sunt corecte.' }`, `compare` once each.
  - 5 wrong then right -> 429 pause; after 15 minutes the right one passes; lockout mail once (parallel fifth failures).
  - 31st attempt from one IP -> 429.
  - no 2FA -> `AdminHandoff`, `strapi_admin_refresh` set, a device row and a new-device mail; again with the device cookie -> no mail.
  - 2FA on, no remembered device -> `SecondStep` with `methods`, `last`, the pending cookie set `HttpOnly`, no refresh cookie set.
  - 2FA on, remembered device -> handoff directly; 31 days later -> `SecondStep`.
  - `secondStepAdmin` right code with `remember` -> handoff and `twoFactorUntil` 30 days; the pending cookie cleared.
  - keys missing and 2FA on -> 503 `"2FA nu este disponibil acum."`, no session.
  - controller: a POST with `Origin: https://evil.example` -> 403 and no store call; routes test: the paths exist, fixed before parameter paths (`staticBeforeParams` from `src/club/groups/__tests__/route-order.ts`), every handler exists.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc).
- [ ] **Step 5: Commit** `feat(admin-login): password login with lockout, devices and the 2FA step`.

---

### Task 13: Admin reset by code and invite accept (high, Sonnet)

**Files:**
- Create: `src/club/admin-login/reset.ts`, `invite.ts`
- Modify: `01-login.ts`, `controllers/admin-auth.ts`
- Test: `src/club/admin-login/__tests__/reset-invite.test.ts`

**Interfaces:**
- Produces: `requestAdminReset(c, body)`, `confirmAdminReset(c, body): Promise<PortalResult<AdminHandoff | SecondStep>>`, `readAdminInvite(c, body)`, `acceptAdminInvite(c, body): Promise<PortalResult<AdminHandoff>>`, `registerInvited(c, registrationToken: string, password: string): Promise<AdminRow | null>` (T14 Google accept reuses it with a random 64-character password).
- Reset (spec 4.7, P6 5.6): request as the portal `requestReset` (same 1500 ms floor, `admin:mail` limit, same answer for unknown, inactive or blocked admins), the code a `reset-code` challenge (MAC purpose `reset-code`, 10 minutes, 5 tries, a new code uses up older ones); confirm: IP limit, password rules (`checkPassword` with the e-mail) before the code, `macMatchesAny` plus `consumeOnce`; right -> set the password through `strapi.service('admin::user').updateById(id, { password })`, history `"Parolă resetată."`, `endAdminSessions` (all) and `forgetDevices` (all), then `hasTwoFactor` -> `SecondStep` with the pending cookie, else `finishAdminLogin`.
- Invite: `readAdminInvite` through `strapi.service('admin::user').findRegistrationInfo(token)`: found -> `valid` with the e-mail, else `expired`; accept: password rules, `strapi.service('admin::user').register({ registrationToken, userInfo: { firstname, lastname, password } })` with the names the registration info holds; a used or unknown token -> 410; then `finishAdminLogin` without the new-device mail.

- [ ] **Step 1: Failing tests**: request answers the same for unknown, blocked and known; 6th request in an hour sends nothing; wrong code 5 times then right -> 400; expired after 10 minutes; code reuse -> 400; success ends the other sessions and logs in; success with 2FA on answers `SecondStep`; a stored reset challenge row holds no 6-digit string; invite read valid and expired; accept twice -> second 410; password rule text before the token is touched.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc).
- [ ] **Step 5: Commit** `feat(admin-login): reset by e-mailed code and invite accept`.

---

### Task 14: Admin Google login (high, Sonnet)

**Files:**
- Create: `src/club/admin-login/google.ts`
- Modify: `01-login.ts`, `controllers/admin-auth.ts`
- Test: `src/club/admin-login/__tests__/google.test.ts`

**Interfaces:**
- Consumes: `googleClient`, `exchangeCode`, `verifyIdToken` from `src/club/portal/auth/google.ts`.
- Produces: `startAdminGoogle(c, query): { redirect: string }` (state, nonce, PKCE verifier and `remember` and optional `registrationToken` in the 10-minute cookie on path `/api/admin-auth/google`; `redirect_uri` = `<adminOrigin>/api/admin-auth/google/callback`, `scope=openid email`), `adminGoogleCallback(c, query): Promise<{ redirect: string }>`.
- Rules (spec 4.6, ruling 5): state must match the cookie (else `/login?error=google`); identity valid; an active admin whose account has that `googleSub`, or whose e-mail equals the Google e-mail (case-insensitive) and whose account has no `googleSub` (then store it, history `"Google conectat."`); with a `registrationToken`: the invite e-mail must equal the Google e-mail, `registerInvited` with a random 64-character password; never creates an admin otherwise. Success: `finishAdminLogin(..., { newDeviceMail: true })`, the access token into the `jwtToken` cookie (Strapi's name, not HttpOnly, as Strapi's SSO), redirect `/login/done?remember=<0|1>`. Google logins skip 2FA. Not counted by the e-mail lockout; counted by the IP rule.

- [ ] **Step 1: Failing tests** with a local RSA key pair and a fake `fetchFn` (pattern of `src/club/portal/__tests__/google.test.ts`): match by sub; match by e-mail stores the sub; e-mail match when the account already has another sub -> refused; inactive or blocked admin -> refused; unknown e-mail -> `/login?error=google` and no admin created (`admin::user` count unchanged); wrong state -> refused; invite with another Google e-mail -> refused; invite with the same e-mail -> registered and logged in; 2FA on is skipped.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc).
- [ ] **Step 5: Commit** `feat(admin-login): Google login and Google invite accept`.

---

### Task 15: Admin Securitate routes, Administratori, reset script (high, Sonnet)

**Files:**
- Create: `src/club/admin-login/security.ts`, `src/api/admin-auth/routes/02-security.ts`, `03-admins.ts`, `scripts/admin-reset-2fa.ts`
- Modify: `controllers/admin-auth.ts`, `package.json` (`"admin:reset-2fa": "node -r ts-node/register scripts/admin-reset-2fa.ts"` or the pattern the existing TS scripts use; read `scripts/` first)
- Test: `src/club/admin-login/__tests__/security-routes.test.ts`

**Interfaces:**
- Consumes: T7 `factors.ts` and `reset.ts` with `Subject { type: 'admin', id: String(adminId) }`; T10 devices; `checkPassword`.
- Produces: the `/api/admin-auth/me/*` and `/api/admin-auth/admins*` rows of the index (passkey rows are added by T21). Policies: until T25 lands, `02-security.ts` uses `global::is-admin` and `03-admins.ts` `global::is-super-admin`; T25 swaps both to `has-role`. `changeAdminPassword`: compare `current` (wrong -> 400 `wrongCurrent`, counts on `admin:login:<e-mail>`), rules, update, history `"Parolă schimbată."`, `endAdminSessions` except the current device. `unlinkGoogle`: `googleSub` null, history `"Legătura cu Google eliminată."`. `resetAdminTwoFactor(by, targetId)`: self -> 403 `selfReset`; target unknown -> 404; else `resetTwoFactor` with `by` = `adminName(by)`. Script `npm run admin:reset-2fa -- <e-mail>`: boots Strapi headless (`createStrapi().load()` pattern of existing scripts), calls `resetTwoFactor(..., 'server')`, prints `2FA reset: <e-mail>` or `No admin: <e-mail>` and exits 1.

- [ ] **Step 1: Failing tests**: each route exists with its policy; `GET me/security` returns the `SecurityView` shape for the caller only; password change with a wrong current -> 400 and one hit on the lockout key; right -> other device sessions ended, current kept; `GET admins` as Super Admin lists `twoFactor` and `self`; reset of self -> 403 `"Nu poți reseta propriul 2FA."`; reset of another -> history line with the caller's name, mail; a non Super Admin gets 403 from the policy; every mutating route refuses a foreign `Origin`; the script source calls `resetTwoFactor` with `'server'`.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc).
- [ ] **Step 5: Commit** `feat(admin-login): admin Securitate routes, Administratori reset and server script`.

---

### Task 16: The `/login` bundle and the SPA redirect (high, Sonnet). After Task 0

**Files:**
- Create: `src/admin-login/main.tsx`, `src/admin-login/App.tsx`, `src/admin-login/screens/{Login,SecondStep,Invite,Reset,Done}.tsx`, `src/admin-login/handoff.ts`, `src/admin-login/api.ts`, `src/admin-login/index.html`, `vite.admin-login.config.ts`, `src/middlewares/admin-login-page.ts`
- Modify: `config/middlewares.ts` (`'global::admin-login-page'` after the gate), `package.json` (`"build": "strapi build && vite build -c vite.admin-login.config.ts"`), `src/admin/app.tsx` (remove `AUTH_COPY` and `applyLoginBranding`; bootstrap listens to SPA navigation and replaces `/admin/auth/*` with the matching `/login` path as T11's map), `src/admin/dashboard/loginBranding.ts` (export the brand art for reuse; the Strapi login injection goes)
- Test: `src/admin-login/__tests__/handoff.test.ts`, `src/admin-login/__tests__/screens.test.tsx` (React Testing Library, the existing admin test setup), `src/middlewares/__tests__/admin-login-page.test.ts`

**Interfaces:**
- Consumes: the index admin login contracts; `src/admin/ui` components and tokens; `SECURITY_COPY`.
- Produces: `storeHandoff(h: AdminHandoff, w: Window): void` (remember: `localStorage.setItem('jwtToken', JSON.stringify(token))` and `isLoggedIn` as the spike recorded; else the `jwtToken` cookie, path `/admin`, the SPA's cookie options) then `w.location.assign('/admin')`; the middleware serves `dist/admin-login/index.html` for `GET /login` and its subpaths (`/invitatie`, `/parola`, `/2fa`, `/cheie`, `/gata`) and the hashed assets under `/login/assets/*` with `Cache-Control: no-store` on the html, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`.
- Screens (spec 10.1 to 10.3, 11.2 copy): Login ("Intră în cont", "Continuă cu Google", "sau", "E-mail", "Parolă" with "Arată parola" / "Ascunde parola", "Ține-mă minte", "Intră", "Am uitat parola"); the passkey button and autofill are added by T22; SecondStep (11.2 texts, "Ține minte dispozitivul 30 de zile" ticked by default, "Altă metodă", "Trimite din nou", "Înapoi la intrare", expired pending returns to Login with the ruling 1 text); Invite (e-mail read only, "Parolă nouă", "Salvează parola" with `.pce`, "sau", "Continuă cu Google"); Reset (three states of 4.7); Done (`/login/done`: moves the cookie token to `localStorage` when `remember=1`, opens `/admin`). Brand layer as today on the left (navy shape, wordmark, "Panou de administrare").

- [ ] **Step 1: Failing tests**: `storeHandoff` remember and not (jsdom); Login renders every string exactly, submits `{ email, password, rememberMe }`, shows the 401 text from the server as sent; a `SecondStep` answer routes to `/login/2fa` with `last` preselected; SecondStep submit sends `{ method, code, remember: true }` by default; the middleware serves html for the six paths, 404 for `/login/../x`, and never for `/admin/*`; `app.tsx` source has no `AUTH_COPY` and no `applyLoginBranding` call.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc, `tsc -p src/admin`, `vite build -c vite.admin-login.config.ts` builds without warnings about missing modules).
- [ ] **Step 5: Commit** `feat(admin-login): /login page bundle and redirect from Strapi's auth pages`.

---

### Task 17: Admin "Securitate" page (high, Sonnet). After Task 0

**Files:**
- Create: `src/admin/pages/SecuritatePage.tsx`, `src/admin/pages/securitate/{TwoFactorSection,BackupCodesWindow,PasswordSection,GoogleSection,DevicesSection,AdminsSection,api}.tsx`
- Modify: `src/admin/dashboard/menu.tsx` (entry "Securitate", system group, route `/plugins/edusport-securitate`, ruling 16), `src/admin/pages/routes.ts`
- Test: `src/club/__tests__/admin-securitate.test.tsx`

**Interfaces:**
- Consumes: the index admin Securitate contracts through `useFetchClient`; `useIsSuperAdmin` (replaced by `useAreas` in T26); `SECURITY_COPY`, `SECURITY_TOASTS`.
- Produces: the page of spec 10.4: sections "2FA" and "Chei de acces" (the passkey list and button are added by T22; this task renders the section header and an empty state only when T22 is absent), "Parolă", "Google", "Dispozitive" with the 6.4 sub-line, and for Super Admin "Administratori". Backup codes window: title "Coduri de rezervă", the 11.3 line, "Descarcă" (ruling 12), "Copiază", "Gata"; codes never kept in state after "Gata". `backupNotice` shows "Mai ai <n> coduri de rezervă." once. Confirm texts of 6.5 and 11.3. Every button carries `.pce`; no label is "Salvează" or "Publică".

- [ ] **Step 1: Failing tests** with a fake fetch client: the app enrolment flow (start shows the QR SVG and the key, confirm shows the backup window, "Gata" clears the codes from the DOM and state); turn off the last method shows "Oprești 2FA? Codurile de rezervă vor fi șterse."; "Generează coduri noi" asks "Codurile vechi nu vor mai merge."; password change sends `{ current, password }` and shows "Parolă schimbată."; the Administratori section is absent for a non Super Admin and has no reset button on the own row; every `<button>` has the `pce` class; no visible text contains "verificare".
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc, `tsc -p src/admin`).
- [ ] **Step 5: Commit** `feat(admin): Securitate page with 2FA, password, Google, devices and Administratori`.

## Interfaces for other plans

- **Security core.** `SecurityStore`, `strapiSecurityStore`, the memory store; `SecurityContext`; `loadKeys`, `seal`, `open`, `codeMac`, `macMatchesAny`; `checkTotp`; `factors.ts` functions; `resetTwoFactor`; `hasTwoFactor`, `openPending`, `sendLoginCode`, `verifySecondStep`; `rememberUntil`, `isRemembered`, `forgetDevices`.
- **Admin login.** `finishAdminLogin` (T21 passkey sign-in), `adminLoginContext`, `originAllowed`, `adminByEmail`, `canEnterAdmin`, `adminName`, `endAdminSessions`.
- **Copy and types.** `SECURITY_*`, `securityHistoryText`, `renderSecurityMail`, `api-types.ts` (copied by the frontend plan F1).

## Self-review

- **Spec coverage.** 3.1 to 3.6, 3.8 (T2, T6); 3.9 (T6, T9; old rpId in T23); 4.1 (T16); 4.2 (T1, T10); 4.3 (T12 to T15); 4.4 (T11); 4.5 (T12); 4.6 (T14); 4.7 (T13); 4.8 (T10, T11 e-mail change, T15); 5.1 to 5.6 (T4 to T9); 6.1 to 6.6 admin side (T7, T8, T15); 10.1 to 10.4 (T16, T17); 12, 13 (T3, used by T7 to T15); 14.2 (T1); 14.4 unit, leak, race and admin login tests (T4 to T15). Portal 2FA, passkeys, roles, boot check: plans 6b-2 and 6b-3. Fallback tasks T10F: index "The gate".
- **Step scan.** Bodies left to the implementer except the login order (T12) and the second-step order (T8), which the tests do not fully fix. The backup notice is the one storage decision added here (index ruling 17): a json field `securityNotes` on both account tables (T2), written by T8, read and cleared by T7.
- **Type consistency.** `SecondStep`, `AdminHandoff`, `SecurityView`, `MethodOn` come from `api-types.ts` (T3) and the index; `Subject` (T6) is used by T7, T8, T15; `finishAdminLogin` (T12) is called by T13, T14 and T21.
- **Review Focus.** Each line has its named test in T4, T5, T6, T8, T11.
