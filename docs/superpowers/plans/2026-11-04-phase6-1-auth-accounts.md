# Phase 6-1: Accounts, Login and Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The server side of portal login: a gated spike of U&P refresh sessions, the four portal content types, pure auth rules, `PortalStore`, `PortalSessions`, the BFF channel, login with lockout and limits, refresh, logout, reset by code, invite read and accept, Google login, the three direct e-mails, and the auth routes `01-auth.ts`.

**Architecture:** Rules that a test can pin without Strapi are pure modules in `src/club/portal/` (`passwords.ts`, `limits.ts`, `tokens.ts`, `devices.ts`, `window.ts`, `copy.ts`). Data goes through `PortalStore` (Strapi store plus an in-memory fake with parity tests, as phase 5). Sessions go through one interface, `PortalSessions`, implemented over Strapi's session manager (`sessionManager('users-permissions')`) when the spike passes, or over our own `portal_sessions` table when it fails. Services in `src/club/portal/auth/` take a `PortalAuthContext`; one controller `portal-auth` serves `src/api/portal/routes/01-auth.ts`.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS), `@strapi/plugin-users-permissions` 5.52.1 (bcryptjs as shipped), Postgres 16, Vitest 3, Node 22 (`node:crypto`), `jsonwebtoken` (already a dependency).

**Spec:** `docs/superpowers/specs/2026-11-04-coach-portal-design.md`: 3.1 to 3.6, 4.2, 4.4, 5.1 to 5.7, 6.1, 6.4, 11 (account lines written here), 12 (reset, lockout, new device), 14.2, 14.3 (auth parts). Index: `docs/superpowers/plans/2026-11-04-phase6-index.md` ("HTTP contracts" and "Rulings" are binding).

**Base:** `feat/athletes` with phase 5 merged (ef2c970 or later). Plans 6-2 and 6-3 start after this plan is merged.

**Parallel groups:** A: T1 (gate) | B: T2, T3 | C: T4, T6 | D: T5A or T5B, T7 | E: T8 | F: T9, T10, T11, T12 | G: T13

| Group | Tasks | Runs after | Files |
|---|---|---|---|
| A | 1 Spike | phase 5 | `config/plugins.ts`, `src/extensions/users-permissions/strapi-server.ts`, `src/club/portal/__tests__/spike-sessions.test.ts` |
| B | 2 Content types, 3 Pure rules and copy | 1 PASS or FAIL logged | 2: `src/api/portal-*/**`, `src/api/portal/` skeleton, `src/club/subjects.ts`, `src/index.ts` (comment, U&P settings check); 3: `src/club/portal/{copy,passwords,limits,tokens,devices,window}.ts`, `data/portal/**` |
| C | 4 PortalStore, 6 Direct-send mail | B | 4: `src/club/portal/{types,store,strapi-store}.ts`, `__tests__/fake-portal-store.ts`; 6: `src/email/brevo.ts` (`sendNow`), `src/email/portal-direct.ts` |
| D | 5A or 5B Sessions, 7 BFF guard and limiter | C | 5: `src/club/portal/sessions*.ts`; 7: `src/club/portal/auth/{bff,limit}.ts` |
| E | 8 Login | D | `src/club/portal/auth/{context,login,issue}.ts`, `src/api/portal/routes/01-auth.ts`, `src/api/portal/controllers/portal-auth.ts` |
| F | 9 Refresh and logout, 10 Reset, 11 Invite, 12 Google | E | own files under `src/club/portal/auth/`; each adds its routes and handlers (one line per route, one handler each) |
| G | 13 Fixture, route order, boot check | all | `scripts/fixtures/phase6-shape.js`, `src/club/portal/__tests__/auth-routes.test.ts` |

Group F tasks edit `01-auth.ts` and `portal-auth.ts` in separate lines; merge them one after the other.

**Risk and model:**

| Task | Risk | Model |
|---|---|---|
| 1 Spike | high | Sonnet |
| 2 Content types and config | low | Haiku |
| 3 Pure rules and copy | high (lockout) | Haiku |
| 4 PortalStore | high (lockout counters, locks) | Sonnet |
| 5A / 5B Sessions | high | Sonnet |
| 6 Direct-send mail | low | Haiku |
| 7 BFF guard and limiter | high | Sonnet |
| 8 Login | high | Sonnet |
| 9 Refresh and logout | high | Sonnet |
| 10 Reset by code | high | Sonnet |
| 11 Invite read and accept | high | Sonnet |
| 12 Google | high | Sonnet |
| 13 Boot check | low | Sonnet |

Per-task Opus review on every high task.

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, integration branch `feat/athletes`. Commit only in the worktree your dispatch names; before every commit run `git rev-parse --show-toplevel` and `git branch --show-current`.
- Spec 2.3 anti-goals hold in every task: no Strapi admin account for a coach, no Strapi token or U&P cookie to a browser, no answer that tells whether an e-mail has an account, no permanent lock.
- U&P sessions (spec 3.1): `jwtManagement: 'refresh'`, access 10 minutes, idle refresh 7 days, max refresh 30 days.
- Tokens (3.3): invite secret 32 random bytes, 7 days, single use, a resend uses up older invites; reset code 6 digits, 10 minutes, single use, 5 wrong tries then used up, a new code uses up older codes. Only SHA-256 hashes are stored.
- Limits (5.4): per e-mail 5 wrong passwords in 15 minutes then a 15-minute pause; per IP 30 login, reset and code attempts per 15 minutes; mail sends 5 per hour per e-mail, beyond that "as if sent". Lockout e-mail at most one per 15-minute window. A successful login resets the e-mail counter.
- Passwords (5.5): 10 to 128 characters, not in the common list, not equal to the e-mail.
- Every write is one `store.transaction`; failure answers 500 `"Acțiunea nu a reușit. Nimic nu a fost salvat."` through `guarded`; account history lines use subject `portalAccount` and the actions of Task 3.
- Copy: every string in `src/club/portal/copy.ts`, exactly as spec 5, 11, 12 and the index rulings give it; ș and ț with the comma below; straight quotes; no em or en dash, no middle dot, no emoji; "E-mail".
- Code: TypeScript, no `any`, single quotes, semicolons, 2-space indent, functions under 30 lines, complexity under 10. `copy.ts`, `window.ts`, `limits.ts`, `passwords.ts` (the check, not the file loader) and every `api-types.ts` import no Strapi, Node or React (the admin bundle and the frontend plan may import or copy them).
- Checks after every task: the task's test file, `npx vitest run`, `npx tsc --noEmit` (zero errors), and `npx tsc -p src/admin --noEmit` (zero errors) when a task touches anything the admin imports.
- Synthetic data only (`@example.invalid` addresses). Never touch production, `strapi_app`, `strapi_db`, `edusport-test-pg`, ports 1337, 1340, 3010, 5432, 55442. Boot checks: `es61-pg` on 127.0.0.1:55461, Strapi on 1381.
- Commits: Conventional Commits, the message given in the task, no `Co-Authored-By`, no AI attribution. Never push. Never commit `.env`.
- Progress board line per status change (`.superpowers/phase3-shared/progress-board.md`, format `HH:MM | 6-1 T<n> | implementer | <status>`); ledger `p3be/.superpowers/sdd/2026-11-04-phase6-1/progress.md`.

## Review Focus

- **Two wrong passwords at the same instant on the 5th try** (two tabs, a script): exactly one lock, exactly one lockout e-mail, count never skips the lock. Pinned by Task 4 (`concurrent hits on one key serialize`) and Task 8 (`parallel fifth failures lock once and mail once`).
- **The same refresh token used twice** (a BFF retry, a stolen copy): the second use answers 401 and does not mint a session; the rotated token keeps working. Pinned by Task 1 (spike check 2) and Task 9 (`a reused refresh token answers 401`).
- **E-mail typed with spaces or capitals** (" Antrenor1@Example.Invalid "): same account, same limit key, same lock. Pinned by Task 3 (`normalizeEmail`) and Task 8 (`mixed case and spaces hit the same key`).
- **Account disabled or coach link removed between refreshes**: the next refresh answers 401 and no new access token is minted. Pinned by Task 9 (`refresh refuses a disabled account`, `refresh refuses an account without teamMember`).
- **An unknown e-mail on every entry point** (login, reset request, reset confirm, Google): identical status and body to a known e-mail in the matching case, and a bcrypt compare still runs on login. Pinned by Task 8 (`unknown and known e-mails answer the same`), Task 10 (`request answers the same for unknown`), Task 12.

---

## File Structure

```
config/plugins.ts                                  U&P jwtSecret, jwtManagement 'refresh', sessions lifespans (T1)
src/extensions/users-permissions/strapi-server.ts  removes U&P content-api routes (T1)
data/portal/common-passwords.txt, data/portal/README   (T3)
src/api/portal-account/**, portal-token/**, portal-auth-limit/**, portal-device/**   schemas, empty services (T2)
src/api/portal/routes/01-auth.ts, controllers/portal-auth.ts   (T8, grown by T9 to T12)
src/club/portal/
  copy.ts          PORTAL_COPY, PORTAL_ERRORS, PORTAL_ACTIONS, portalHistoryText, mail copy (T3)
  passwords.ts     checkPassword, loadCommonPasswords (T3)
  limits.ts        rules, keys, normalizeEmail, isLocked, afterHit, afterSuccess (T3)
  tokens.ts        newInviteSecret, newResetCode, newDeviceKey, hashSecret, tokenState, TTLs (T3)
  devices.ts       deviceLabel (T3)
  window.ts        correctionDeadline, canCoachCorrect (T3)
  types.ts, store.ts, strapi-store.ts   PortalStore (T4)
  sessions.ts      PortalSessions interface (T5)
  sessions-up.ts   U&P implementation (T5A) | sessions-own.ts + src/api/portal-session/** (T5B)
  auth/bff.ts      requireBff, clientIp, userAgent (T7)
  auth/limit.ts    hitIp, checkEmailLock, failEmail, clearEmail, allowMail (T7)
  auth/context.ts  PortalAuthContext, portalAuthContext (T8)
  auth/issue.ts    issueSession (T8)
  auth/login.ts    loginWithPassword (T8)
  auth/refresh.ts  refreshSession, logout (T9)
  auth/reset.ts    requestReset, confirmReset (T10)
  auth/invite.ts   readInvite, acceptInvite (T11)
  auth/google.ts   googleConfig, exchangeCode, verifyIdToken, loginWithGoogle (T12)
  __tests__/...
src/email/brevo.ts         + sendNow (T6)
src/email/portal-direct.ts renderPortalMail, sendPortalMail (T6)
scripts/fixtures/phase6-shape.js   (T13)
```

---

### Task 1: Spike: U&P refresh sessions driven from our code (high, Sonnet). GATE

**Files:**
- Modify: `config/plugins.ts`
- Create: `src/extensions/users-permissions/strapi-server.ts`, `src/club/portal/__tests__/spike-sessions.test.ts`

**Interfaces:**
- Consumes: Strapi's session manager as the test helper `src/club/__tests__/admin-sessions.ts` loads it (`createSessionManager({ db })` from `@strapi/core/dist/services/session-manager.js`, in-memory rows).
- Produces: the ledger line `SPIKE PASS` or `SPIKE FAIL <check n>`, and the facts Task 5A relies on (method names and return shapes), written as assertions in the spike test file, which stays in the suite.

- [ ] **Step 1: Config.** `config/plugins.ts` becomes:

```ts
export default ({ env }) => ({
  'users-permissions': {
    config: {
      jwtSecret: env('JWT_SECRET'),
      jwtManagement: 'refresh',
      sessions: { accessTokenLifespan: 600, idleRefreshTokenLifespan: 7 * 24 * 3600, maxRefreshTokenLifespan: 30 * 24 * 3600 },
    },
  },
});
```
Check the unit the bootstrap passes (`node_modules/@strapi/plugin-users-permissions/dist/server/bootstrap/index.js` `defineOrigin('users-permissions', ...)` and its `DEFAULT_*` constants): if the defaults are seconds, keep seconds; if milliseconds, convert. Record which in the test as a named constant.

- [ ] **Step 2: Unit spike test** `spike-sessions.test.ts`, origin `users-permissions` defined on an in-memory manager with the config above. Each check is one `it`:
  1. `generateRefreshToken('7', 'dev-1', { type: 'refresh' })` then `generateAccessToken(token)` gives an access token; `validateAccessToken(access)` answers `{ isValid: true, payload: { userId: '7', sessionId } }` and `isSessionActive(sessionId)` is true.
  2. `rotateRefreshToken(t1)` gives `t2`; `rotateRefreshToken(t1)` again answers an `error`; `t2` still rotates.
  3. Idle: with the clock moved 7 days and 1 second after the last use (`vi.setSystemTime`), rotation answers an `error`; at 6 days 23 hours it works.
  4. Max: rotating every day, the 31st day answers an `error`.
  5. `revokeSessionById` (or the method the manager has; read `session-manager.js`) ends one session; another session of the same user still rotates.
  6. `invalidateRefreshToken('7')` ends every session of user 7; `invalidateRefreshToken('7', 'dev-1')` ends only the sessions with `deviceId: 'dev-1'`.
  7. `listSessions('7')` returns rows with `sessionId`, `deviceId`, and a creation or last-use time.
  8. Whether `sessionId` changes on rotation (assert what it does; Task 5A stores the latest).
- [ ] **Step 3: Close U&P routes** in `src/extensions/users-permissions/strapi-server.ts`:

```ts
export default (plugin: { routes: Record<string, { routes: unknown[] } | unknown> }) => {
  const api = plugin.routes['content-api'] as { routes: unknown[] } | undefined;
  if (api) api.routes = [];
  return plugin;
};
```
Adjust to the real shape of `plugin.routes['content-api']` in 5.52.1 (a function or an object; read `dist/server/routes/index.js`). The goal: no `/api/auth/*`, `/api/connect/*`, `/api/users*`, `/api/users-permissions/*` route exists.
- [ ] **Step 4: Boot spike** on `es61-pg` (fresh Postgres 16, `scripts/fixtures/phase4-shape.js` not needed), Strapi on 1381 with `JWT_SECRET` set. Checks, each written to the ledger:
  9. Strapi boots with the config (no "Missing jwtSecret", no origin error).
  10. `curl -s -o /dev/null -w '%{http_code}' -X POST localhost:1381/api/auth/local` and `GET /api/users/me` and `GET /api/connect/google` answer 404 or 405.
  11. In `npx strapi console` (or a one-off script under the worktree's scratch folder): `strapi.sessionManager('users-permissions').generateRefreshToken(String(id), 'dev-x', { type: 'refresh' })` works for a user created with `strapi.documents('plugin::users-permissions.user').create`, and the row lands in `strapi_sessions` (or the table the manager uses) with `origin = 'users-permissions'`.
- [ ] **Step 5: Run** `npx vitest run src/club/portal/__tests__/spike-sessions.test.ts`. Expected: all 8 pass.
- [ ] **Step 6: Decide.** All 11 checks pass: ledger `SPIKE PASS`, continue with Task 5A. Any of 1 to 8 or 11 fails: `SPIKE FAIL <n>`, continue with Task 5B (the spike test then keeps only the checks that passed, others deleted). Check 9 fails: stop and report NEEDS_DECISION.
- [ ] **Step 7: If only check 10 fails** (routes still answer): add a global middleware `src/middlewares/portal-up-closed.ts` answering 404 for paths matching `^/api/(auth|connect|users|users-permissions)(/|$)`, register it in `config/middlewares.ts` before `strapi::router`, re-run check 10. Log `SPIKE PASS (routes by middleware)`.
- [ ] **Step 8: Commit**

```bash
git add config/plugins.ts src/extensions src/club/portal/__tests__/spike-sessions.test.ts
git commit -m "feat(portal): U&P refresh sessions config and closed U&P routes (spike)"
```

---

### Task 2: Portal content types, subject and U&P settings check (low, Haiku)

**Files:**
- Create: `src/api/portal-account/content-types/portal-account/schema.json`, `src/api/portal-token/content-types/portal-token/schema.json`, `src/api/portal-auth-limit/content-types/portal-auth-limit/schema.json`, `src/api/portal-device/content-types/portal-device/schema.json`, and for each the `services/<name>.ts` (`factories.createCoreService`), no routes and no controllers.
- Modify: `src/club/subjects.ts` (add `portalAccount: 'portal-account'`), `src/index.ts` (comment at the U&P hiding; bootstrap check).
- Test: `src/club/portal/__tests__/schemas.test.ts`

**Interfaces:**
- Produces: tables `portal_accounts`, `portal_tokens`, `portal_auth_limits`, `portal_devices`; `SUBJECT.portalAccount`.

- [ ] **Step 1: Failing test** reading the four `schema.json` files:

```ts
it('portal-account has the spec 3.2 fields', () => {
  const a = schema('portal-account');
  expect(a.collectionName).toBe('portal_accounts');
  expect(a.options.draftAndPublish).toBe(false);
  expect(a.pluginOptions['content-manager'].visible).toBe(false);
  expect(a.attributes.user).toMatchObject({ type: 'relation', relation: 'oneToOne', target: 'plugin::users-permissions.user' });
  expect(a.attributes.email).toMatchObject({ type: 'string', required: true, unique: true });
  expect(a.attributes.status).toMatchObject({ type: 'enumeration', enum: ['invited', 'active', 'disabled'], required: true });
  expect(a.attributes.teamMember).toMatchObject({ type: 'relation', relation: 'oneToOne', target: 'api::team-member.team-member' });
  expect(a.attributes.teamMember.inversedBy).toBeUndefined();
  expect(a.attributes.googleSub).toMatchObject({ type: 'string', unique: true });
  for (const k of ['invitedAt', 'activatedAt', 'disabledAt', 'lastLoginAt']) expect(a.attributes[k].type).toBe('datetime');
  for (const k of ['phone', 'invitedBy', 'disabledBy']) expect(a.attributes[k].type).toBe('string');
  expect(a.attributes.role).toBeUndefined();
});
it('team-member schema gains nothing', () => expect(Object.keys(schema('team-member').attributes)).toEqual(['name', 'role', 'bio', 'photo', 'groups', 'order']));
```
Same style for `portal-token` (`account` manyToOne required, `kind` enum `invite | reset`, `secretHash` string required, `expiresAt` datetime required, `usedAt` datetime, `tries` integer default 0), `portal-auth-limit` (`key` string required unique, `count` integer default 0, `windowStart` datetime required, `lockedUntil`, `notifiedAt` datetime), `portal-device` (`account` manyToOne required, `deviceKeyHash` string required, `sessionId` string, `label` string required, `firstSeenAt`, `lastSeenAt` datetime required, `revokedAt` datetime). Every type: hidden from the Content Manager, `draftAndPublish: false`, no `routes/` folder (assert with `existsSync`).
- [ ] **Step 2: Run** `npx vitest run src/club/portal/__tests__/schemas.test.ts`. Expected: FAIL (files missing).
- [ ] **Step 3: Create the schemas** as asserted; `collectionName` as spec 3.2 to 3.5; `info.displayName` `"Portal / Cont"`, `"Portal / Token"`, `"Portal / Limită"`, `"Portal / Dispozitiv"`.
- [ ] **Step 4: `src/index.ts`.** Replace the comment "There is no login on the frontend so this type is unused." with "Portal accounts are managed from "Cont portal" on the team member, never here." In `bootstrap`, add `checkUpSettings(strapi)` (new function in `src/club/portal/up-settings.ts`): reads the U&P advanced store (`strapi.store({ type: 'plugin', name: 'users-permissions', key: 'advanced' })`) and, when `allow_register` or `email_confirmation` is true, sets both false and logs `[portal] U&P registration and e-mail confirmation turned off`. Test it with a fake store object (`up-settings.test.ts`: true -> set false and logged; false -> untouched).
- [ ] **Step 5: Run** both tests, the suite, `npx tsc --noEmit`. Expected: PASS, 0 errors.
- [ ] **Step 6: Commit**

```bash
git add src/api/portal-account src/api/portal-token src/api/portal-auth-limit src/api/portal-device src/club/subjects.ts src/index.ts src/club/portal/up-settings.ts src/club/portal/__tests__/schemas.test.ts src/club/portal/__tests__/up-settings.test.ts
git commit -m "feat(portal): portal account, token, auth limit and device types"
```

---

### Task 3: Pure rules and copy (high, Haiku)

**Files:**
- Create: `src/club/portal/copy.ts`, `passwords.ts`, `limits.ts`, `tokens.ts`, `devices.ts`, `window.ts`, `data/portal/common-passwords.txt`, `data/portal/README`
- Test: `src/club/portal/__tests__/rules.test.ts`, `copy.test.ts`

**Interfaces:**
- Produces:

```ts
// copy.ts (server-free)
export const PORTAL_ERRORS: {
  wrongLogin: 'E-mailul sau parola nu sunt corecte.';
  paused: 'Prea multe încercări. Încearcă din nou peste 15 minute.';
  googleNoAccount: 'Nu am găsit un cont pentru adresa asta.';
  inviteExpired: 'Invitația a expirat. Cere administratorului una nouă.';
  badCode: 'Codul nu este corect sau a expirat.';
  sendFailed: 'Nu am putut trimite e-mailul. Încearcă din nou.';
  passwordShort: 'Parola trebuie să aibă cel puțin 10 caractere.';
  passwordLong: 'Parola poate avea cel mult 128 de caractere.';
  passwordWeak: 'Parola este prea ușor de ghicit. Alege alta.';
  currentWrong: 'Parola actuală nu este corectă.';
  emailTaken: 'Adresa are deja un cont.';
  archived: 'Arhivată. Nu mai poate fi modificată.';
  noAccess: 'Nu mai ai acces la această grupă.';
  invalid: 'Cerere invalidă.';
  failed: 'Acțiunea nu a reușit. Nimic nu a fost salvat.';
  notFound: 'Nu a fost găsit.';
  loadFailed: 'Nu am putut încărca datele.';
};
export const googleOtherEmail = (email: string): string => `Contul Google nu are adresa ${email}.`;
export const RESET_SENT = 'Dacă adresa are cont, am trimis un cod.';
export const PORTAL_TOASTS = { saved: 'Salvat.' };
export const PORTAL_ACTIONS = {
  inviteSent: 'portal-invite-sent', inviteResent: 'portal-invite-resent', activated: 'portal-activated',
  activatedGoogle: 'portal-activated-google', passwordChanged: 'portal-password-changed', passwordReset: 'portal-password-reset',
  locked: 'portal-locked', disabled: 'portal-disabled', enabled: 'portal-enabled', emailChanged: 'portal-email-changed',
} as const;
export function portalHistoryText(action: string, changes: Record<string, unknown>): string | null;
export const MAIL_COPY: {
  reset: { subject: 'Codul pentru parola nouă'; code: (c: string) => string; valid: 'Este valabil 10 minute.'; ignore: 'Dacă nu ai cerut tu, ignoră acest e-mail.' };
  lockout: { subject: 'Încercări de intrare în cont'; text: 'Am oprit intrarea în contul tău pentru 15 minute după 5 parole greșite.'; advice: 'Dacă nu ai fost tu, schimbă parola după pauză.' };
  newDevice: { subject: 'Intrare de pe un dispozitiv nou'; line: (device: string, date: string, time: string) => string; advice: 'Dacă nu ai fost tu, schimbă parola.' };
  signature: 'Echipa EduSport';
};
// limits.ts (server-free)
export type LimitRule = { max: number; windowMs: number; lockMs: number | null };
export const LOGIN_RULE: LimitRule; // { max: 5, windowMs: 900_000, lockMs: 900_000 }
export const IP_RULE: LimitRule;    // { max: 30, windowMs: 900_000, lockMs: null }
export const MAIL_RULE: LimitRule;  // { max: 5, windowMs: 3_600_000, lockMs: null }
export type LimitState = { count: number; windowStart: string; lockedUntil: string | null; notifiedAt: string | null };
export type HitOutcome = { state: LimitState; blocked: boolean; firstLock: boolean };
export const normalizeEmail: (raw: unknown) => string | null; // trimmed, lower case, 3..254 chars, one '@' with text on both sides
export const loginKey: (email: string) => string; // 'login:' + email
export const ipKey: (ip: string) => string;       // 'ip:' + ip
export const mailKey: (email: string) => string;  // 'mail:' + email
export function isLocked(s: LimitState | null, rule: LimitRule, now: Date): boolean;
export function afterHit(s: LimitState | null, rule: LimitRule, now: Date): HitOutcome;
export const afterSuccess: (now: Date) => LimitState; // count 0, new window, no lock, notifiedAt kept null
// passwords.ts
export function checkPassword(password: unknown, email: string, common: ReadonlySet<string>): string | null; // error text or null
export function loadCommonPasswords(rootDir: string): ReadonlySet<string>; // reads data/portal/common-passwords.txt once
// tokens.ts (node:crypto)
export const INVITE_TTL_MS = 7 * 24 * 3600_000; export const RESET_TTL_MS = 10 * 60_000; export const RESET_MAX_TRIES = 5;
export const newInviteSecret: () => string; // 32 bytes, base64url
export const newResetCode: () => string;    // crypto.randomInt, 6 digits, zero padded
export const newDeviceKey: () => string;    // 32 bytes, base64url
export const hashSecret: (s: string) => string; // sha256 hex
export type TokenState = 'valid' | 'expired' | 'used';
export function tokenState(t: { expiresAt: string; usedAt: string | null; tries: number; kind: 'invite' | 'reset' }, now: Date): TokenState;
export const sameHash: (a: string, b: string) => boolean; // timingSafeEqual on equal-length hex
// devices.ts (server-free)
export function deviceLabel(userAgent: string | null): string;
// window.ts (server-free)
export const CORRECTION_DAYS = 7;
export const correctionDeadline: (date: string) => string; // addDays(date, 7)
export const canCoachCorrect: (date: string, today: string) => boolean; // today <= deadline
```

- [ ] **Step 1: Failing tests** (`rules.test.ts`), one `it` per line:

```ts
// window
expect(canCoachCorrect('2026-10-06', '2026-10-13')).toBe(true);   // spec 8.3 example, day 7
expect(canCoachCorrect('2026-10-06', '2026-10-14')).toBe(false);  // day 8
expect(canCoachCorrect('2026-10-20', '2026-10-27')).toBe(true);   // DST ends 25 Oct inside the week
expect(canCoachCorrect('2026-10-20', '2026-10-28')).toBe(false);
expect(canCoachCorrect('2026-10-06', '2026-10-06')).toBe(true);
// limits
const t0 = new Date('2026-11-04T10:00:00Z');
let s: LimitState | null = null;
for (let i = 1; i <= 4; i += 1) s = afterHit(s, LOGIN_RULE, t0).state;
const fifth = afterHit(s, LOGIN_RULE, t0);
expect(fifth).toMatchObject({ blocked: true, firstLock: true });
expect(fifth.state.lockedUntil).toBe('2026-11-04T10:15:00.000Z');
expect(isLocked(fifth.state, LOGIN_RULE, new Date('2026-11-04T10:14:59Z'))).toBe(true);
expect(isLocked(fifth.state, LOGIN_RULE, new Date('2026-11-04T10:15:00Z'))).toBe(false);
expect(afterHit(fifth.state, LOGIN_RULE, new Date('2026-11-04T10:05:00Z')).firstLock).toBe(false); // during the pause
// a window that ran out starts again at 1
expect(afterHit({ count: 4, windowStart: '2026-11-04T09:00:00.000Z', lockedUntil: null, notifiedAt: null }, LOGIN_RULE, t0).state.count).toBe(1);
// IP: 30 pass, the 31st is blocked, no lockedUntil
// MAIL: 5 per hour, 6th blocked
expect(normalizeEmail('  Antrenor1@Example.Invalid ')).toBe('antrenor1@example.invalid');
expect(normalizeEmail('no-at-sign')).toBeNull();
expect(normalizeEmail('a'.repeat(250) + '@x.ro')).toBeNull();
expect(loginKey('a@b.ro')).toBe('login:a@b.ro');
// passwords
const common = new Set(['parola12345', 'qwertyuiop']);
expect(checkPassword('scurt', 'a@b.ro', common)).toBe(PORTAL_ERRORS.passwordShort);
expect(checkPassword('x'.repeat(129), 'a@b.ro', common)).toBe(PORTAL_ERRORS.passwordLong);
expect(checkPassword('Parola12345', 'a@b.ro', common)).toBe(PORTAL_ERRORS.passwordWeak); // case-insensitive list
expect(checkPassword('antrenor1@example.invalid', 'antrenor1@example.invalid', common)).toBe(PORTAL_ERRORS.passwordWeak);
expect(checkPassword('patine-albastre-7', 'a@b.ro', common)).toBeNull();
expect(checkPassword('ăîșțâăîșțâ', 'a@b.ro', common)).toBeNull(); // 10 characters, counted as code points
// tokens
expect(newResetCode()).toMatch(/^\d{6}$/);
expect(newInviteSecret()).toMatch(/^[A-Za-z0-9_-]{43}$/);
expect(hashSecret('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
expect(tokenState({ kind: 'reset', expiresAt: '2026-11-04T10:10:00Z', usedAt: null, tries: 0 }, t0)).toBe('valid');
expect(tokenState({ kind: 'reset', expiresAt: '2026-11-04T10:10:00Z', usedAt: null, tries: 5 }, t0)).toBe('used');
expect(tokenState({ kind: 'invite', expiresAt: '2026-11-04T09:59:59Z', usedAt: null, tries: 0 }, t0)).toBe('expired');
// devices
expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Version/17.0 Mobile Safari/604.1')).toBe('Telefon, Safari');
expect(deviceLabel('Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile Safari/537.36')).toBe('Telefon, Chrome');
expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36 Edg/120.0')).toBe('Calculator, Edge');
expect(deviceLabel('Mozilla/5.0 (Macintosh) Gecko/20100101 Firefox/121.0')).toBe('Calculator, Firefox');
expect(deviceLabel('Mozilla/5.0 (iPad; CPU OS 17_0) Version/17.0 Safari/604.1')).toBe('Tabletă, Safari');
expect(deviceLabel(null)).toBe('Dispozitiv necunoscut');
```
`copy.test.ts`: every string in `copy.ts` has no U+2013, U+2014 or U+00B7 character, no emoji, and the `PORTAL_ACTIONS` texts:

```ts
expect(portalHistoryText(PORTAL_ACTIONS.inviteSent, { email: 'a@b.ro' })).toBe('Invitație trimisă la a@b.ro.');
expect(portalHistoryText(PORTAL_ACTIONS.inviteResent, {})).toBe('Invitație retrimisă.');
expect(portalHistoryText(PORTAL_ACTIONS.activated, {})).toBe('Cont activat.');
expect(portalHistoryText(PORTAL_ACTIONS.activatedGoogle, {})).toBe('Cont activat cu Google.');
expect(portalHistoryText(PORTAL_ACTIONS.passwordChanged, {})).toBe('Parolă schimbată.');
expect(portalHistoryText(PORTAL_ACTIONS.passwordReset, {})).toBe('Parolă resetată.');
expect(portalHistoryText(PORTAL_ACTIONS.locked, {})).toBe('Cont blocat 15 minute după 5 încercări greșite.');
expect(portalHistoryText(PORTAL_ACTIONS.disabled, {})).toBe('Cont dezactivat.');
expect(portalHistoryText(PORTAL_ACTIONS.enabled, {})).toBe('Cont activat de administrator.');
expect(portalHistoryText(PORTAL_ACTIONS.emailChanged, { from: 'a@b.ro', to: 'c@d.ro' })).toBe('E-mail schimbat din a@b.ro în c@d.ro.');
expect(portalHistoryText('other', {})).toBeNull();
expect(MAIL_COPY.reset.code('042517')).toBe('Codul tău: 042517');
expect(MAIL_COPY.newDevice.line('Telefon, Chrome', '4 nov 2026', '18:05')).toBe('Telefon, Chrome, 4 nov 2026 18:05.');
```
`"Dispozitiv necunoscut"` and `"Tabletă"` are new strings: put them in `copy.ts` as `DEVICE_WORDS` and list them in the ledger for the companion round.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/__tests__/rules.test.ts src/club/portal/__tests__/copy.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the modules with the signatures above. `afterHit`: when `s` is null or the window ran out (`now - windowStart >= windowMs`) and no lock is running, start a window at `now` with count 1; else count + 1. With `lockMs`, reaching `max` sets `lockedUntil = now + lockMs`, `firstLock = notifiedAt === null || now - notifiedAt >= windowMs` and sets `notifiedAt = now` when `firstLock`. A hit while locked keeps the state and answers `blocked: true, firstLock: false`. Without `lockMs`, `blocked = count > max`. `deviceLabel`: kind from `iPad|Tablet` (Tabletă), else `Mobi|Android|iPhone` (Telefon), else Calculator; browser `Edg/` Edge, `Firefox/` Firefox, `Chrome/` Chrome, `Safari/` Safari, else "Browser".
- [ ] **Step 4: Password list.** Download SecLists `Passwords/Common-Credentials/10-million-password-list-top-100000.txt` (MIT), lower case, unique, one per line, into `data/portal/common-passwords.txt`; `data/portal/README` names the source URL, the commit and "MIT License, Daniel Miessler". `loadCommonPasswords(root)` reads it with `readFileSync`, returns a `Set`; a missing file throws `[portal] common password list missing` (boot fails loudly). Add a test that the shipped file has at least 90 000 lines and contains `123456`.
- [ ] **Step 5: Run** the tests, suite, `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add src/club/portal data/portal
git commit -m "feat(portal): password, limit, token, device and correction window rules; portal copy"
```

---

### Task 4: PortalStore (Strapi and fake, parity) (high, Sonnet)

**Files:**
- Create: `src/club/portal/types.ts`, `store.ts`, `strapi-store.ts`, `__tests__/fake-portal-store.ts`, `__tests__/portal-store.test.ts` (runs the same cases on the fake and on the Strapi store over the existing Strapi test harness used by `src/club/presence/__tests__/strapi-store.test.ts`)

**Interfaces:**
- Consumes: `transactionScope(strapi)` from `src/club/athletes/strapi-store.ts` (nested transactions reuse the outer one; `lockRow(table, id)`).
- Produces:

```ts
export type AccountStatus = 'invited' | 'active' | 'disabled';
export type AccountRow = {
  id: string; userId: number; email: string; status: AccountStatus; teamMemberId: string | null; phone: string | null; googleSub: string | null;
  invitedAt: string | null; invitedBy: string | null; activatedAt: string | null; disabledAt: string | null; disabledBy: string | null; lastLoginAt: string | null;
};
export type AccountWrite = Partial<Omit<AccountRow, 'id' | 'userId'>>;
export type TokenRow = { id: string; accountId: string; kind: 'invite' | 'reset'; secretHash: string; expiresAt: string; usedAt: string | null; tries: number; createdAt: string };
export type LimitRow = LimitState & { id: string; key: string };
export type DeviceRow = { id: string; accountId: string; deviceKeyHash: string; sessionId: string | null; label: string; firstSeenAt: string; lastSeenAt: string; revokedAt: string | null };
export type UserAuth = { id: number; email: string; passwordHash: string | null; blocked: boolean; confirmed: boolean };

export interface PortalStore {
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  lockAccount(id: string): Promise<void>;
  lockLimit(key: string): Promise<LimitRow>;          // inserts the row when missing (count 0, windowStart now), then SELECT ... FOR UPDATE
  saveLimit(id: string, s: LimitState): Promise<void>;
  purgeLimits(olderThan: Date, now: Date): Promise<number>;
  account(id: string): Promise<AccountRow | null>;
  accountByEmail(email: string): Promise<AccountRow | null>;
  accountByGoogleSub(sub: string): Promise<AccountRow | null>;
  accountByTeamMember(teamMemberId: string): Promise<AccountRow | null>;
  accountByUser(userId: number): Promise<AccountRow | null>;
  createAccount(a: AccountWrite & { userId: number; email: string; status: AccountStatus }): Promise<string>;
  updateAccount(id: string, a: AccountWrite): Promise<void>;
  user(id: number): Promise<UserAuth | null>;
  createUser(email: string, passwordHash: string): Promise<number>; // username = email, provider 'local', role Authenticated, confirmed false
  updateUser(id: number, u: { email?: string; passwordHash?: string; blocked?: boolean; confirmed?: boolean }): Promise<void>;
  tokens(accountId: string, kind: 'invite' | 'reset'): Promise<TokenRow[]>;
  tokenByHash(hash: string): Promise<TokenRow | null>;
  createToken(t: Omit<TokenRow, 'id' | 'createdAt' | 'usedAt' | 'tries'>): Promise<string>;
  updateToken(id: string, t: { usedAt?: string; tries?: number }): Promise<void>;
  devices(accountId: string): Promise<DeviceRow[]>;
  deviceByKey(accountId: string, keyHash: string): Promise<DeviceRow | null>;
  createDevice(d: Omit<DeviceRow, 'id' | 'revokedAt'>): Promise<string>;
  updateDevice(id: string, d: Partial<Pick<DeviceRow, 'sessionId' | 'lastSeenAt' | 'revokedAt' | 'label'>>): Promise<void>;
  teamMemberName(id: string): Promise<string | null>;
  record(line: { subjectId: string; action: string; changes: Record<string, unknown>; actor: string }): Promise<void>; // history-entry, subject SUBJECT.portalAccount
}
export function strapiPortalStore(strapi: Core.Strapi): PortalStore;
export function fakePortalStore(seed?: Partial<FakePortalState>): { store: PortalStore; state: FakePortalState; failOn(m: keyof PortalStore): void };
```
`passwordHash` writes are the raw bcrypt hash: `createUser` / `updateUser` write through `strapi.db.query('plugin::users-permissions.user')` (the query engine does not re-hash), and the caller hashes with `bcryptjs` (`hash(password, 10)`), the library U&P ships.

- [ ] **Step 1: Failing parity tests**: create, read by e-mail (stored lower case), by Google sub, by team member, by user; update; token by hash; device by key; `lockLimit` creates once (second call returns the same id); `purgeLimits` removes rows with `windowStart < olderThan` and no `lockedUntil > now`; `record` writes subject `portal-account`; `createUser` stores `username === email`, `provider: 'local'`, role Authenticated, `confirmed: false`, the given hash verbatim; `concurrent hits on one key serialize` (Strapi store only: two `transaction(() => lockLimit(k).then(...))` in parallel each increment once, final count 2).
- [ ] **Step 2: Run** `npx vitest run src/club/portal/__tests__/portal-store.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both stores. `lockLimit` on Postgres: `INSERT INTO portal_auth_limits (document_id, key, count, window_start, ...) ... ON CONFLICT (key) DO NOTHING` through `strapi.db.connection`, then `lockRow`. A unique-violation from a racing insert is not an error.
- [ ] **Step 4: Run** tests, suite, tsc. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/club/portal/types.ts src/club/portal/store.ts src/club/portal/strapi-store.ts src/club/portal/__tests__
git commit -m "feat(portal): PortalStore with Strapi and fake implementations"
```

---

### Task 5: PortalSessions interface, then 5A or 5B (high, Sonnet)

**Files (both paths):** Create `src/club/portal/sessions.ts` (interface only).

```ts
export type IssuedTokens = { accessToken: string; refreshToken: string; accessExpiresAt: string; sessionId: string };
export type AccessCheck = { userId: number; sessionId: string } | null;
export interface PortalSessions {
  issue(userId: number, deviceId: string): Promise<IssuedTokens>;
  refresh(refreshToken: string): Promise<(IssuedTokens & { userId: number; deviceId: string }) | null>; // null: unknown, reused, idle > 7 d, family > 30 d
  verifyAccess(accessToken: string): Promise<AccessCheck>;     // signature, expiry, session still active
  revoke(refreshToken: string): Promise<void>;                 // logout; unknown token is a no-op
  revokeDevice(userId: number, deviceId: string): Promise<void>;
  revokeAll(userId: number, exceptSessionId?: string): Promise<void>;
}
```

#### Task 5A (SPIKE PASS): `src/club/portal/sessions-up.ts`

- Produces: `upSessions(strapi: { sessionManager: (origin: 'users-permissions') => UpOrigin }): PortalSessions`, with `UpOrigin` typed from the methods the spike pinned.
- [ ] **Step 1: Failing tests** `sessions-up.test.ts` over the in-memory manager of Task 1: issue then `verifyAccess` gives the user; `refresh` rotates and the old token answers null; `revokeDevice(7, 'dev-1')` ends only that device; `revokeAll(7, keep)` ends all but `keep`; `verifyAccess` after `revokeAll` answers null; an admin access token (origin `admin`, same secret test) answers null; `refresh` returns the `deviceId` the session was issued with.
- [ ] **Step 2: Run**, expect FAIL. **Step 3: Implement**: `issue` = `generateRefreshToken(String(userId), deviceId, { type: 'refresh' })` then `generateAccessToken`; `accessExpiresAt` = now + 600 s; `verifyAccess` mirrors `src/club/admin-auth.ts::sessionUserId` on origin `users-permissions` and returns null on any throw; `revokeAll` with `exceptSessionId` = `listSessions` then `revokeSessionById` for the others. **Step 4: Run**, expect PASS. **Step 5: Commit** `feat(portal): portal sessions over the U&P session manager`.

#### Task 5B (SPIKE FAIL): own session table

**Files:** Create `src/api/portal-session/content-types/portal-session/schema.json` (hidden, `draftAndPublish: false`: `account` manyToOne required, `deviceId` string required, `refreshHash` string required unique, `accessHash` string unique, `accessExpiresAt` datetime, `familyStartedAt` datetime required, `lastUsedAt` datetime required, `revokedAt` datetime), `src/club/portal/sessions-own.ts`; add `sessions(...)` methods to `PortalStore` (both stores, parity).

- Produces: `ownSessions(store: PortalStore, now: () => Date): PortalSessions`. Opaque tokens: 32 random bytes base64url; only SHA-256 hashes stored. Access valid 10 minutes; refresh rotates on use (new refresh hash and access hash on the same row, `lastUsedAt` now); a refresh older than 7 days idle or a family older than 30 days answers null; a reused (old) refresh token answers null and revokes the row (theft signal). `sessionId` = the row's documentId.
- [ ] **Step 1: Failing tests** `sessions-own.test.ts`: the 5A list plus idle 7 days and max 30 days with a fake clock, and `a reused refresh token revokes the family`.
- [ ] **Step 2 to 5:** as 5A. Commit `feat(portal): own portal session table (spike fallback)`.

---

### Task 6: Direct-send mail and the three direct e-mails (low, Haiku)

**Files:**
- Modify: `src/email/brevo.ts`
- Create: `src/email/portal-direct.ts`
- Test: `src/email/__tests__/portal-direct.test.ts`

**Interfaces:**
- Consumes: `sendWithBrevo`, `readEmailConfig`, `deliveryTarget`, `brandHtml`, `emailPage`, `escapeHtml`, `footerText` (as `renderPaymentEmail` uses them), `MAIL_COPY`.
- Produces:

```ts
// brevo.ts
export async function sendNow(message: OutgoingEmail, options: BrevoOptions, wait?: (ms: number) => Promise<void>): Promise<SendResult>; // one try, one retry after 2000 ms
// portal-direct.ts
export type PortalMail =
  | { kind: 'reset'; code: string }
  | { kind: 'lockout' }
  | { kind: 'new-device'; device: string; at: Date };
export function renderPortalMail(mail: PortalMail, links: EmailLinks): RenderedEmail;
export type SendPortalMail = (to: string, mail: PortalMail) => Promise<boolean>; // true when sent
export function portalMailSender(strapi: Core.Strapi): SendPortalMail; // deliveryTarget (test address outside production), sendNow, logs and GlitchTip on failure
```
- [ ] **Step 1: Failing tests**: `sendNow` with a `fetchFn` failing once then succeeding answers ok and waited 2000 ms once; failing twice answers `{ ok: false }`. Rendered texts:

```ts
expect(renderPortalMail({ kind: 'reset', code: '042517' }, links).subject).toBe('Codul pentru parola nouă');
expect(renderPortalMail({ kind: 'reset', code: '042517' }, links).text).toContain('Codul tău: 042517\n\nEste valabil 10 minute.\n\nDacă nu ai cerut tu, ignoră acest e-mail.');
expect(renderPortalMail({ kind: 'lockout' }, links).subject).toBe('Încercări de intrare în cont');
const nd = renderPortalMail({ kind: 'new-device', device: 'Telefon, Chrome', at: new Date('2026-11-04T16:05:00Z') }, links);
expect(nd.subject).toBe('Intrare de pe un dispozitiv nou');
expect(nd.text).toContain('Telefon, Chrome, 4 nov 2026 18:05.'); // Bucharest time
expect(nd.text).toContain('Dacă nu ai fost tu, schimbă parola.');
```
and `portalMailSender` with config `live: false` sends to the test recipient only.
- [ ] **Step 2: Run**, FAIL. **Step 3: Implement**: E1 letter as `renderPaymentEmail` (brand header, one paragraph per line group, signature `"Echipa EduSport"`). Date as phase 5 `longDate` of the Bucharest day plus `HH:mm` Bucharest. **Step 4: Run**, PASS. **Step 5: Commit** `feat(email): direct-send portal mails (reset code, lockout, new device)`.

---

### Task 7: BFF channel and limiter service (high, Sonnet)

**Files:**
- Create: `src/club/portal/auth/bff.ts`, `src/club/portal/auth/limit.ts`
- Test: `src/club/portal/__tests__/bff-limit.test.ts`

**Interfaces:**
- Produces:

```ts
// bff.ts
export const BFF_HEADERS = { secret: 'x-portal-secret', ip: 'x-portal-client-ip', userAgent: 'x-portal-user-agent', device: 'x-portal-device' } as const;
export function isBffCall(headers: Record<string, string | string[] | undefined>, secret: string | undefined): boolean; // timingSafeEqual on sha256 of both; false when the env secret is unset or shorter than 32 chars
export function clientIp(headers: Record<string, string | string[] | undefined>): string;    // trimmed header, max 64 chars, else 'unknown'
export function userAgent(headers: Record<string, string | string[] | undefined>): string | null; // max 512 chars
export const PORTAL_HOSTS = (env?: NodeJS.ProcessEnv) => string[]; // PORTAL_HOSTS split on ',', default ['antrenor']
// limit.ts
export type Limiter = {
  ipBlocked(ip: string): Promise<boolean>;                      // counts the attempt
  emailLocked(email: string): Promise<boolean>;                 // no count
  emailFailed(email: string): Promise<{ firstLock: boolean }>;  // counts a wrong password
  emailCleared(email: string): Promise<void>;
  mailAllowed(email: string): Promise<boolean>;                 // counts a send
};
export function limiter(store: PortalStore, now: () => Date): Limiter; // each call one transaction: lockLimit, rule, saveLimit
```
- [ ] **Step 1: Failing tests** (fake store): wrong secret, missing secret, env secret unset all false; right secret true; `ipBlocked` false 30 times then true; `emailFailed` 5 times gives `firstLock` true once; `emailLocked` true for 15 minutes for an e-mail with no account; `emailCleared` resets; `mailAllowed` 5 true then false within the hour, true again after.
- [ ] **Step 2: Run**, FAIL. **Step 3: Implement.** **Step 4: Run**, PASS. **Step 5: Commit** `feat(portal): BFF secret channel and DB-backed auth limits`.

---

### Task 8: Login with password, session issue and devices (high, Sonnet)

**Files:**
- Create: `src/club/portal/auth/context.ts`, `issue.ts`, `login.ts`, `src/api/portal/routes/01-auth.ts`, `src/api/portal/controllers/portal-auth.ts`
- Test: `src/club/portal/__tests__/login.test.ts`

**Interfaces:**
- Consumes: Tasks 3 to 7.
- Produces:

```ts
// context.ts
export type PortalAuthContext = {
  store: PortalStore; sessions: PortalSessions; limits: Limiter; mail: SendPortalMail; common: ReadonlySet<string>;
  hosts: string[]; ip: string; userAgent: string | null; now: () => Date; log: (m: string) => void;
  hash: (password: string) => Promise<string>; compare: (password: string, hash: string) => Promise<boolean>;
};
export function portalAuthContext(strapi: Core.Strapi, ctx: PortalCtx): PortalAuthContext; // PortalCtx = AdminCtx + request.headers
export const DUMMY_HASH: string; // bcrypt hash of a random string made once at module load (cost 10)
// issue.ts
export type PortalSession = { accessToken: string; refreshToken: string; accessExpiresAt: string; deviceKey: string | null };
export function canEnter(account: AccountRow | null, user: UserAuth | null, host: string): boolean; // active, user not blocked, host 'antrenor' needs teamMemberId
export async function issueSession(c: PortalAuthContext, account: AccountRow, deviceKey: string | null, o: { notifyNewDevice: boolean }): Promise<PortalSession>;
// login.ts
export type LoginBody = { host: string; email: string; password: string; deviceKey: string | null };
export function readLoginBody(body: unknown, hosts: string[]): LoginBody | null;
export async function loginWithPassword(c: PortalAuthContext, body: unknown): Promise<AdminResult<PortalSession>>;
```
`issueSession`: finds the device by `hashSecret(deviceKey)` for the account (not revoked); when none, creates a key (`newDeviceKey`) if `deviceKey` is null or unknown to the account (an unknown key from another account's row is reused as is, a new row for this account), creates the row with `deviceLabel(c.userAgent)`, and when `notifyNewDevice` sends the new-device mail (failure logged, never fails the login); then `sessions.issue(userId, device.id)`, stores `sessionId`, `lastSeenAt`, account `lastLoginAt`; answers `deviceKey` only when it was created.

`loginWithPassword` order (spec 5.3, 5.4): read body (400 `invalid`); `ipBlocked` (429 `paused`); `emailLocked` (429 `paused`); load account and user by e-mail; `compare(password, user?.passwordHash ?? DUMMY_HASH)` always runs once; wrong or `!canEnter` -> `emailFailed`, on `firstLock` with an account: lockout mail and history line `locked` (actor `"sistem"`), answer 401 `wrongLogin` (or 429 `paused` when this failure locked); right -> `emailCleared`, `issueSession(..., { notifyNewDevice: true })`.

Route: `POST /portal/auth/login`, `config: { auth: false, policies: [], middlewares: [] }`. Controller: `if (!isBffCall(...)) return refuseWith(ctx, 403, 'Forbidden');` first in every handler (a shared `bffOnly(handler)` wrapper in the controller file).
- [ ] **Step 1: Failing tests**:
  - `unknown and known e-mails answer the same`: unknown e-mail, wrong password, disabled account, active account without team member on `antrenor`, `invited` account: each `{ ok: false, status: 401, error: 'E-mailul sau parola nu sunt corecte.' }`, and `compare` called exactly once in each.
  - `mixed case and spaces hit the same key`.
  - 5 wrong passwords then the right one: 429 `paused`; after 15 minutes (fake clock) the right one logs in and the counter is cleared.
  - `parallel fifth failures lock once and mail once` (`Promise.all` of two failures after three, fake store with serialized transactions): one lockout mail, one `portal-locked` line.
  - Lockout of an unknown e-mail: 429 on the 6th try, no mail, no history.
  - A login with no device key: `deviceKey` non-null, one device row, one new-device mail; again with that key: `deviceKey` null, no mail, `lastSeenAt` updated.
  - Mail failure on new device: login still succeeds, error logged.
  - 31st attempt from one IP: 429 even with the right password.
  - Controller: no secret header -> 403 and no store call.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/__tests__/login.test.ts`. FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests, suite, tsc. PASS.
- [ ] **Step 5: Commit** `feat(portal): password login with lockout, limits and device binding`.

---

### Task 9: Refresh and logout (high, Sonnet)

**Files:** Create `src/club/portal/auth/refresh.ts`; modify `01-auth.ts`, `portal-auth.ts`. Test: `refresh.test.ts`.

**Interfaces:**
- Produces: `refreshSession(c, body: unknown): Promise<AdminResult<PortalSession>>` (`deviceKey: null` always), `logout(c, body: unknown): Promise<AdminResult<{ ok: true }>>`.
- `refreshSession`: `sessions.refresh(token)`; null -> 401 `""`; then load the account by user: `canEnter(account, user, 'antrenor')` false -> `sessions.revoke(newRefresh)` and 401; the device row (`deviceId`) revoked -> 401; else update device `sessionId`, `lastSeenAt` and answer. Not counted by the IP limiter (refresh is not a login attempt).
- [ ] **Step 1: Failing tests**: refresh works and rotates; `a reused refresh token answers 401`; `refresh refuses a disabled account`; `refresh refuses an account without teamMember`; refresh after the device was revoked answers 401; logout of a valid token then refresh answers 401; logout of garbage answers `{ ok: true }`.
- [ ] **Step 2 to 4**: run FAIL, implement, run PASS (plus suite and tsc).
- [ ] **Step 5: Commit** `feat(portal): refresh with live account check, and logout`.

---

### Task 10: Reset by code (high, Sonnet)

**Files:** Create `src/club/portal/auth/reset.ts`; modify `01-auth.ts`, `portal-auth.ts`. Test: `reset.test.ts`.

**Interfaces:**
- Produces: `requestReset(c, body: unknown): Promise<AdminResult<{ message: string }>>`, `confirmReset(c, body: unknown): Promise<AdminResult<PortalSession>>`.
- `requestReset`: `ipBlocked` -> 429; normalize e-mail (invalid -> 400); account not `disabled` with that e-mail and `mailAllowed(email)` -> in one transaction mark older reset tokens used, create a code token (`RESET_TTL_MS`), then `mail(email, { kind: 'reset', code })`; send failure -> 503 `sendFailed` and the new token marked used. Every other case answers `{ message: RESET_SENT }` after the same steps that do not send.
- `confirmReset` body `{ host, email, code, password, deviceKey? }`: `ipBlocked` -> 429; password rules (400 with the rule text, checked before the code so a code try is not spent on a bad password); latest unused reset token of the account; `tryCode`: wrong code -> `tries + 1` (5th wrong marks it used), answer 400 `badCode`; unknown e-mail answers 400 `badCode` too. Right code: one transaction: token used, password hash set, `confirmed: true`, account `active` if it was `invited` (with `activatedAt`), history `passwordReset`; then `revokeAll(userId)`; then `canEnter` on the host, `issueSession(..., { notifyNewDevice: true })`. A host check that fails after a correct reset answers 401 `wrongLogin` (password stays set).
- [ ] **Step 1: Failing tests**: `request answers the same for unknown`; 6th request within the hour sends nothing and answers the same; a second code uses up the first; wrong code 5 times then the right one: `badCode`; expired after 10 minutes; code reuse after success: `badCode`; success revokes the other sessions (`revokeAll` called) and logs in; Google-only account (no password hash) can set a password (S18); send failure answers 503.
- [ ] **Step 2 to 4** as above.
- [ ] **Step 5: Commit** `feat(portal): password reset by e-mailed code`.

---

### Task 11: Invite read and accept (high, Sonnet)

**Files:** Create `src/club/portal/auth/invite.ts`; modify `01-auth.ts`, `portal-auth.ts`. Test: `invite.test.ts`.

**Interfaces:**
- Produces: `readInvite(c, secret: string): Promise<AdminResult<{ state: 'valid'; email: string } | { state: 'expired'; email: null }>>`, `acceptInvite(c, body: unknown): Promise<AdminResult<PortalSession>>`, and for 6-3 and Task 12: `activateInvited(c, account: AccountRow, how: 'password' | 'google', token: TokenRow): Promise<void>` (inside a transaction: token used, account `active`, `activatedAt`, user `confirmed`, history `activated` or `activatedGoogle`, actor `"Antrenor <nume>"` from `teamMemberName`).
- `readInvite`: `ipBlocked` -> 429; token by `hashSecret(secret)`, kind invite, `tokenState` valid and account `invited` -> valid with the e-mail; anything else -> expired.
- `acceptInvite` body `{ secret, password, deviceKey? }`: `ipBlocked`; password rules with the account e-mail; lock the account; re-check token and status; expired or used -> 410 `inviteExpired`; set the hash; `activateInvited(..., 'password', token)`; `issueSession(..., { notifyNewDevice: false })` (S5).
- [ ] **Step 1: Failing tests**: valid read; read after 7 days and 1 second: expired; accept twice: second 410; accept after a resend with the old secret: 410; password rules answer before the token is used; accept sends no new-device mail; history line `Cont activat.` with actor `Antrenor <nume>`.
- [ ] **Step 2 to 4** as above.
- [ ] **Step 5: Commit** `feat(portal): invite read and accept with password`.

---

### Task 12: Google login and Google accept (high, Sonnet)

**Files:** Create `src/club/portal/auth/google.ts`; modify `01-auth.ts`, `portal-auth.ts`. Test: `google.test.ts`.

**Interfaces:**
- Produces:

```ts
export type GoogleClient = { clientId: string; clientSecret: string; fetchFn: typeof fetch; now: () => Date };
export type GoogleIdentity = { sub: string; email: string };
export function googleClient(env?: NodeJS.ProcessEnv): GoogleClient | null; // null when PORTAL_GOOGLE_CLIENT_ID or _SECRET unset
export async function exchangeCode(g: GoogleClient, i: { code: string; codeVerifier: string; redirectUri: string }): Promise<string | null>; // POST https://oauth2.googleapis.com/token, returns id_token
export async function verifyIdToken(g: GoogleClient, idToken: string, nonce: string): Promise<GoogleIdentity | null>;
export async function loginWithGoogle(c: PortalAuthContext, g: GoogleClient | null, body: unknown): Promise<AdminResult<PortalSession>>;
export function googleConfig(g: GoogleClient | null): AdminResult<{ clientId: string | null }>;
```
- `verifyIdToken`: JWKS from `https://www.googleapis.com/oauth2/v3/certs`, cached by `kid` for the `max-age` of the response (at most 24 h), key via `crypto.createPublicKey({ key: jwk, format: 'jwk' })`, `jsonwebtoken.verify` with `algorithms: ['RS256']`, `audience: clientId`, `issuer: ['https://accounts.google.com', 'accounts.google.com']`; then `payload.nonce === nonce` and `payload.email_verified === true`; e-mail normalized.
- `loginWithGoogle` body `{ host, code, codeVerifier, redirectUri, nonce, invite?, deviceKey? }`: `ipBlocked`; `g` null -> 502 `loadFailed`; exchange or verify fails -> 401 `googleNoAccount`; with `invite`: token valid and account `invited` required (else 410), Google e-mail must equal the account e-mail (else 401 `googleOtherEmail(account.email)`), then store `googleSub`, `activateInvited(..., 'google')`, issue without new-device mail. Without `invite`: account by `sub` (active), else by e-mail when active and `googleSub` null (store the sub); an `invited` account found by e-mail is accepted as above (S6, with its latest valid invite token; none valid -> 410); `canEnter` false or nothing found -> 401 `googleNoAccount`; issue with new-device mail. A Google login does not touch the e-mail lockout counter (no password).
- [ ] **Step 1: Failing tests** with a local RSA key pair, a fake `fetchFn` serving the token endpoint and the JWKS: valid token logs in; wrong `aud`, wrong `iss`, expired, wrong nonce, `email_verified: false`: 401 `googleNoAccount`; unknown e-mail: 401 `googleNoAccount` (same body as a disabled account); invite with another Google e-mail: 401 `"Contul Google nu are adresa antrenor2@example.invalid."`; `googleSub` stored on first login and used on the next even after the Google e-mail changed; Google unconfigured: 502.
- [ ] **Step 2 to 4** as above.
- [ ] **Step 5: Commit** `feat(portal): Google login and Google invite accept (OIDC code, PKCE, nonce)`.

---

### Task 13: Route order, fixture and boot check (low, Sonnet)

**Files:**
- Create: `src/club/portal/__tests__/auth-routes.test.ts`, `scripts/fixtures/phase6-shape.js`

- [ ] **Step 1: Route test**: the routes of `01-auth.ts` are exactly

```ts
['POST /portal/auth/login', 'GET /portal/auth/google/config', 'POST /portal/auth/google', 'POST /portal/auth/refresh', 'POST /portal/auth/logout',
 'POST /portal/auth/reset/request', 'POST /portal/auth/reset/confirm', 'POST /portal/auth/invite/accept', 'GET /portal/auth/invite/:secret']
```
each `config: { auth: false, policies: [], middlewares: [] }`, static before parameter paths (`staticBeforeParams` from `src/club/groups/__tests__/route-order.ts`), every handler exists, every handler answers 403 without the secret (call each with a fake ctx).
- [ ] **Step 2: Fixture** `phase6-shape.js` (style of `phase5-shape.js`): two team members linked as coaches of two groups from `phase4-shape.js`, U&P users and portal accounts `antrenor1@example.invalid` (active, bcrypt of `Throwaway-Coach-1`, team member 1) and `antrenor2@example.invalid` (invited, invite token whose secret is written to the fixture's `IDS_FILE` as `invite2`).
- [ ] **Step 3: Boot check** on `es61-pg` / 1381 with the index env: restart once; `curl` with the secret header: login of `antrenor1` gives a session; refresh rotates; the old refresh answers 401; logout then refresh answers 401; 6 wrong passwords answer 401 x5 then 429; `GET /portal/auth/invite/<invite2>` valid; accept with `patine-albastre-7` logs in; without the secret every route answers 403; `/api/auth/local` answers 404 or 405. Log each result in the ledger; remove the container.
- [ ] **Step 4: Commit**

```bash
git add src/club/portal/__tests__/auth-routes.test.ts scripts/fixtures/phase6-shape.js
git commit -m "test(portal): auth route order, phase 6 fixture"
```

## Interfaces for other plans

- **Store and sessions.** `PortalStore`, `strapiPortalStore`, `fakePortalStore`; `PortalSessions` (`issue`, `refresh`, `verifyAccess`, `revoke`, `revokeDevice`, `revokeAll`); the factory the controllers use is `portalSessions(strapi)` in `sessions.ts` (returns 5A or 5B).
- **Auth helpers.** `isBffCall`, `clientIp`, `userAgent`, `BFF_HEADERS`; `limiter`; `issueSession`, `canEnter`; `activateInvited`; `checkPassword`; `hashSecret`, `newInviteSecret`, `INVITE_TTL_MS`.
- **Rules.** `canCoachCorrect`, `correctionDeadline` (`window.ts`), `normalizeEmail`.
- **Copy.** `PORTAL_ERRORS`, `PORTAL_TOASTS`, `PORTAL_ACTIONS`, `portalHistoryText`, `MAIL_COPY`; 6-3 adds `copy-admin.ts` with one `export *` line.
- **Mail.** `SendPortalMail`, `portalMailSender`, `sendNow`.

## Self-review

- **Spec coverage.** 3.1 (T1, T2), 3.2 to 3.5 (T2, T4), 3.6 direct mails (T6; invite kind in 6-3), 4.2 accept (T11, T12), 4.4 Google (T12), 5.1 hosts (T8 `canEnter`), 5.2 sessions server side (T5, T9), 5.3 (T8), 5.4 (T3, T7, T8, T10), 5.5 (T3), 5.6 (T10), 5.7 new-device mail (T8; device list in 6-2), 6.1 (T7 to T13), 6.4 (T6, T10), 11 account lines written by auth (T8, T10, T11, T12), 12 (T6), 14.2 (T1), 14.3 auth tests (T8 to T13). Disable, invite creation, e-mail change, devices list, password change: 6-2 and 6-3.
- **Step scan.** Bodies left to the implementer except the limit algorithm (T3 step 3) and the login order (T8), which the tests alone do not fix.
- **Type consistency.** `PortalSession` (T8) is the index contract's type; `LimitState` (T3) is the store's `LimitRow` base (T4); `PortalSessions.refresh` returns `deviceId` used by T9.
- **Review Focus.** Each line has its named test in T1, T3, T4, T8, T9, T10, T12.
