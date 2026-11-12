# Phase 7-1: Athlete Access and Accounts Implementation Plan

> **Refreshed 2026-11-11** against `feat/athletes` e3bc966 (6b-1, 6b-2, coach additions, training add, behaviour-only tests). See the index "Refresh 2026-11-11" and "Open questions for the user".

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One account can be coach, holder of athletes, or both: athlete access rows, per-host entry on every sign-in path, the `global::is-sportiv` policy and the host-generic Securitate policy, role-aware coach disable, parent invites and their mails, access that follows the athlete e-mail, and the admin tools to grant and remove it.

**Architecture:** New module `src/club/portal/access/` with pure rules (`rules.ts`), an access store (Strapi store plus a fake for service tests), services (`invite.ts`, `lifecycle.ts`, `bulk.ts`), views (`api-types.ts`). Phase 6 and 6b files change only where named. Every write is one transaction with rows locked in the order athlete, account, team member.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS), Postgres 16, Vitest 3, Node 22.

**Spec:** `docs/superpowers/specs/2026-11-07-sportiv-app-design.md` sections 3, 4, 5.1, 5.2, 10.2, 11.1, 11.2, 13, 14.2, 14.3; 6b spec `2026-11-07-admin-auth-roles-design.md` 6, 7.2, 8, 9.2 and S32. Index: `docs/superpowers/plans/2026-11-07-phase7-index.md` (contracts, rulings and user rules binding).

**Base:** `feat/athletes` (e3bc966 or later). Ledger `p3be/.superpowers/sdd/2026-11-07-phase7-1/progress.md`.

| Task | Risk | Model | Batch |
|---|---|---|---|
| 1 Schemas, bootstrap, access store | high (data) | Sonnet | A |
| 2 Pure rules and copy | high (auth) | Haiku | A |
| 3 Host on every sign-in path, devices, tokens, sessions | high (sessions) | Sonnet | A |
| 4 `global::is-sportiv`, `global::is-portal-user`, `is-coach` host check | high (auth) | Sonnet | A |
| 5 Coach side: disable, disable-all, hook, coach invite on a holder | high (auth, data loss) | Sonnet | B |
| 6 Parent invite, resend, remove, mails | high (auth) | Sonnet | B |
| 7 Lifecycle: e-mail move, anonymize, delete, merge | high (data exposure) | Sonnet | B |
| 8 Admin routes and bulk | high (permissions) | Sonnet | B |
| 9 Admin UI | low | Sonnet | |
| 10 Fixture, boot check, click-through, diagrams | low | Haiku | |

## Global Constraints

- Everything in plan 6-1 "Global Constraints": repo `p3be`, branch per task worktree, commit messages exactly as given, no AI attribution, never push; checks per task `npx tsc --noEmit`, `npm run lint`, the task's own `npx vitest run --maxWorkers=3 <files>`; the full suite once in Task 10 in a background worktree.
- User rules of the index (behaviour-only tests, machine load, copy) bind every task.
- Code: TypeScript strict, no `any`, functions under 30 lines, complexity under 10. A session id, a pending secret or a device key never goes in an answer (except the `deviceKey` the 6b contract returns) or a log. Build a `PortalStore` per request.
- Copy: exact strings from the spec; new strings live in `src/club/portal/access/copy.ts` only. Romanian, no em or en dash, no middle dot, straight quotes, "E-mail".
- One live access per athlete (spec 3.1); status derived from the account (spec 3.1); e-mails normalized with phase 6 `normalizeEmail` (`src/club/portal/limits.ts`).
- Synthetic data only (`@example.invalid`). Postgres tests run against a throwaway container on 127.0.0.1:55481 (the index port of this plan), skipped when it is not up.
- Files this plan may touch: `src/club/portal/access/**`, `src/api/athlete-access/**`, `src/api/portal-account|portal-device|portal-token` schemas, `src/club/portal/{types,store,strapi-store,devices,security}.ts`, `src/club/portal/__tests__/fake-portal-store.ts`, `src/club/portal/auth/{issue,invite,login,google,passkey,reset,refresh,two-factor,bff}.ts`, `src/club/portal/sessions.ts`, `src/club/portal/sessions-own.ts`, `src/club/portal/accounts/**`, `src/club/portal/coach/me.ts` (device list host filter only), `src/policies/{is-coach,is-sportiv,is-portal-user}.ts`, `src/api/portal/routes/03-security.ts`, `src/api/portal/controllers/portal-security.ts`, `src/email/portal-email.ts`, `src/email/portal-access-email.ts`, `src/email/email-jobs.ts`, `src/api/email-job` schema, `src/club/athletes/{record,delete,merge}.ts`, `src/club/personal-data/anonymize-service.ts`, `src/api/club/routes/{12-portal-accounts,14-athlete-access}.ts`, `src/api/club/controllers/{portal-accounts,athlete-access}.ts`, `src/index.ts`, `src/admin/dashboard/sportivi/**`, `src/admin/dashboard/portal/AccountBlock.tsx`, `src/admin/dashboard/MembriEchipaPage.tsx`, `src/club/sportivi/access-view.ts`, `scripts/fixtures/*.js` (port allowlists and the new `phase7-shape.js`), `scripts/clickthrough-7-1.sh`, `docs/architecture/**`.

## Review Focus

- **A coach who is also a parent is disabled as a coach**: his `sportiv` session keeps working, his `antrenor` sessions and devices are revoked, the U&P user is not blocked. Pinned by Task 5 (`coach disable keeps the sportiv side`).
- **Two admins invite for the same athlete at once**, or invite while another changes the athlete e-mail: one live access remains, the loser gets 409 stale and nothing is half written. Pinned by Task 6 (`concurrent invites leave one live access`, Postgres test).
- **The athlete e-mail is changed to an address of another family**: the old holder loses the athlete on the next request, the new holder gets exactly one mail, history shows the move. Pinned by Task 7.
- **A coach token on a sportiv route, a sportiv token on a coach route** (same account): 403, nothing read. Pinned by Task 4 (`host of the session decides`).
- **A second step, passkey or Google sign-in that skips the host rule**: a holder-only account finishing the 2FA code on `antrenor`, or a coach-only key on `sportiv`, gets the refusal of that path and no session. Pinned by Task 3 (`every sign-in path checks the host`).
- **An invited coach gets a parent invite**: one fresh invite, older tokens used, accepting it activates the account for both roles. Pinned by Task 6 (`invited account case 3`).

---

## File Structure

```
src/api/athlete-access/content-types/athlete-access/schema.json   (T1)
src/club/portal/access/
  types.ts        AccessRow, NewAccess, RevokeReason (T1)
  store.ts        AccessStore interface; strapi-store.ts, fake-store.ts (T1)
  indexes.ts      ensureAccessIndexes, backfillDeviceHosts (T1)
  rules.ts        canEnterHost, accessState, planInvite, inviteRefusal, isAdult, holderName (T2)
  copy.ts         ACCESS_COPY, ACCESS_ERRORS, ACCESS_ACTIONS (T2)
  api-types.ts    AccessBlock, AccessState, BulkPreview (T2)
  invite.ts       inviteAccess, resendAccess, removeAccess, linkAccess (T6)
  lifecycle.ts    moveOnEmailChange, endForAthlete, moveOnMerge (T7)
  bulk.ts         bulkPreview, bulkInvite (T8)
  context.ts      accessContext(strapi, actor) (T6)
src/club/portal/auth/issue.ts   mayEnter (T3)
src/policies/is-sportiv.ts, is-portal-user.ts, src/club/portal/sportiv/holder.ts (T4)
src/email/portal-access-email.ts (T6)
src/api/club/routes/14-athlete-access.ts, controllers/athlete-access.ts (T8)
```

---

### Task 1: Schemas, bootstrap indexes, access store (high, Sonnet)

**Files:**
- Create: `src/api/athlete-access/content-types/athlete-access/schema.json`, `src/api/athlete-access/{routes,controllers,services}/athlete-access.ts` (core factories, routes closed), `src/club/portal/access/{types,store,strapi-store,fake-store,indexes}.ts`
- Modify: `src/api/portal-account/content-types/portal-account/schema.json` (`name`, `coachDisabledAt`, `passwordChangedAt`, `notifySchedule` boolean default true), `portal-device` schema (`host` string), `portal-token` schema (`host` string), `src/club/portal/types.ts` (`AccountRow` gains `name`, `coachDisabledAt`, `passwordChangedAt`, `notifySchedule`; `DeviceRow` and `TokenRow` gain `host`), `src/club/portal/strapi-store.ts` (map the new fields; `portal_sessions.host` already exists), `src/club/portal/__tests__/fake-portal-store.ts`, `src/index.ts` (bootstrap calls after `ensurePortalIndexes`)
- Test: `src/club/portal/access/__tests__/store-pg.test.ts`

**Interfaces:**
- Produces:

```ts
// types.ts
export type RevokeReason = 'scos' | 'email_schimbat' | 'anonimizat' | 'sters' | 'unit';
export type AccessRow = { id: string; athleteId: string; accountId: string; email: string; invitedAt: string; invitedBy: string; revokedAt: string | null; revokedBy: string | null; revokeReason: RevokeReason | null; levelSeenGroup: string | null; levelSeenAt: string | null };
export type NewAccess = Pick<AccessRow, 'athleteId' | 'accountId' | 'email' | 'invitedAt' | 'invitedBy'>;
// store.ts
export interface AccessStore {
  liveByAthlete(athleteId: string): Promise<AccessRow | null>;
  liveByAccount(accountId: string): Promise<AccessRow[]>;
  createAccess(row: NewAccess): Promise<string>;
  revokeAccess(id: string, w: { revokedAt: string; revokedBy: string; revokeReason: RevokeReason }): Promise<void>;
  setLevelSeen(id: string, groupId: string, at: string): Promise<void>;
  moveAccess(id: string, athleteId: string): Promise<void>;
  lockAthlete(athleteId: string): Promise<void>;
  athleteForAccess(athleteId: string): Promise<{ id: string; name: string; email: string | null; status: string; birthDate: string | null; contactName: string | null } | null>;
}
// indexes.ts
export async function ensureAccessIndexes(knex: Knex): Promise<void>; // athlete_accesses_live_uq, see step 3
export async function backfillDeviceHosts(knex: Knex): Promise<number>; // UPDATE portal_devices SET host='antrenor' WHERE host IS NULL; same for portal_tokens
```

- [ ] **Step 1: Failing tests.** `store-pg.test.ts` (throwaway Postgres 55481, Strapi store): a second live row for one athlete throws a unique violation (`code === '23505'`); a revoked row plus a new live row is accepted; `liveByAthlete` ignores revoked rows and `liveByAccount` returns only live rows; `backfillDeviceHosts` returns the count and is idempotent (second call 0). No schema attribute pins and no fake-store tests (user rule).
- [ ] **Step 2: Run** `npx vitest run --maxWorkers=3 src/club/portal/access/__tests__/store-pg.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement.** The partial index: Strapi 5 stores manyToOne links in a link table; the live rule needs the athlete and the revoked flag in one table, so the access row also keeps a plain private `athleteKey` string column (= athlete documentId, written by `createAccess`, changed only by `moveAccess`) and the index is `CREATE UNIQUE INDEX IF NOT EXISTS athlete_accesses_live_uq ON athlete_accesses (athlete_key) WHERE revoked_at IS NULL`. Both relations `manyToOne`, unidirectional; `revokeReason` enum exactly the `RevokeReason` values. The fake store (for the service tests of later tasks) mirrors the same live rule.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/api/athlete-access src/api/portal-account src/api/portal-device src/api/portal-token src/club/portal src/index.ts && git commit -m "feat(portal): athlete access rows, account and device fields for phase 7"`

### Task 2: Pure rules, copy and admin types (high, Haiku)

**Files:**
- Create: `src/club/portal/access/{rules,copy,api-types}.ts`
- Test: `src/club/portal/access/__tests__/rules.test.ts`, `copy.test.ts`

**Interfaces:**
- Consumes: `AccountRow`, `UserAuth` (`src/club/portal/types.ts`), `AccessRow` (T1), `ageFromIso`, `todayInBucharest` (`src/club/birth-date.ts`), `countWords` (`src/club/ro-count.ts`).
- Produces:

```ts
export type Host = 'antrenor' | 'sportiv';
export function canEnterHost(account: AccountRow | null, user: UserAuth | null, host: string, liveAccess: number): boolean;
export function isCoachSide(account: AccountRow): boolean; // teamMemberId set and coachDisabledAt null
export type InvitePlan = { kind: 'create' } | { kind: 'add' } | { kind: 'reinvite'; host: Host } | { kind: 'refuse'; message: string };
export function planInvite(account: AccountRow | null, latestInviteHost: Host | null): InvitePlan;
export function inviteRefusal(athlete: { status: string; email: string | null }): string | null; // spec 4.1
export function accessState(account: AccountRow | null, live: AccessRow | null): AccessState;
export function isAdult(birthDate: string | null, today: string): boolean;
export function holderName(athlete: { contactName: string | null; name: string }): string;
```

- [ ] **Step 1: Failing tests.** `canEnterHost`: active coach with live 0 on `antrenor` true, on `sportiv` false; with live 1 on `sportiv` true; `coachDisabledAt` set: `antrenor` false, `sportiv` with live 1 true; status `invited` false everywhere; `user.blocked` false everywhere; host `'admin'` false. `planInvite(null, null)` -> `create`; active -> `add`; invited with latest invite host `antrenor` -> `{ kind: 'reinvite', host: 'antrenor' }`, with null -> `sportiv`; disabled -> refuse `"Contul acestei adrese este dezactivat."`. `inviteRefusal`: `nou` -> `"Confirmă sportivul întâi."`; no e-mail -> `"Adaugă un e-mail în Date."`; `anonimizat` -> `"Sportivul este anonimizat."`; `activ` with e-mail -> null. `isAdult('2008-11-07','2026-11-07')` true, `('2008-11-08','2026-11-07')` false, null false. `holderName` prefers a non-empty trimmed `contactName`. `copy.test.ts`: the character guard only (no `—`, `–`, `·`, curly quotes, `Email` in any value).
- [ ] **Step 2: Run** `npx vitest run --maxWorkers=3 src/club/portal/access/__tests__/rules.test.ts src/club/portal/access/__tests__/copy.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the functions; copy constants hold every string of spec 4, 13 and the index contracts (toasts "Invitație trimisă.", "Acces adăugat.", "Acces scos.", bulk toast built as `countWords(n, 'invitație trimisă', 'invitații trimise') + '.'`).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/access && git commit -m "feat(portal): access rules, copy and admin types"`

### Task 3: Host on every sign-in path, devices, tokens, sessions (high, Sonnet)

**Files:**
- Modify: `src/club/portal/auth/issue.ts` (new `mayEnter`; `createDeviceRow(c, account, host)` writes `host`; `mailNewDevice` names the host; `canEnter` stays the pure antrenor rule used inside `mayEnter`), every `canEnter` call site: `auth/login.ts`, `auth/reset.ts`, `auth/invite.ts` (accept on the token host; `session: null` answer of the contract; `DEFAULT_HOST` removed), `auth/google.ts` (four call sites, first link and the pending link), `auth/passkey.ts`, `auth/two-factor.ts` (`openSecondStep` creates the device row on the pending host; `portalSecondStep` checks `mayEnter` for `data.host`), `auth/refresh.ts`; `auth/bff.ts` (`PORTAL_HOSTS` default stays `['antrenor']`); `src/club/portal/store.ts` and `strapi-store.ts` (`deviceByKey(accountId, hash, host)`), `sessions-own.ts` (no default host; `revokeAllOnHost(userId, host)`; `verifyAccess` answers `host`), `sessions.ts` (interface), `src/club/portal/accounts/invite.ts` (`revokeAccess(c, account, host?)`; invite tokens carry `host`), `src/email/portal-email.ts` (`portalHost(siteUrl, site: Host = 'antrenor')`), `src/club/portal/coach/me.ts` (device list of the session host only), `src/club/portal/security.ts` (`portalSecurity` takes `{ accountId, userId, host, actor }` instead of `CoachState`)
- Test: `src/club/portal/__tests__/hosts.test.ts` (new), extend `login.test.ts`, `invite.test.ts`, `two-factor.test.ts`, `google.test.ts`, `sessions-own.test.ts`

**Interfaces:**
- Consumes: `canEnterHost` (T2), `AccessStore.liveByAccount` (T1).
- Produces:

```ts
// issue.ts
export async function mayEnter(c: PortalAuthContext, account: AccountRow | null, user: UserAuth | null, host: string): Promise<boolean>; // reads the live access count only for 'sportiv'
// sessions.ts
revokeAllOnHost(userId: number, host: Host): Promise<void>;
verifyAccess(token: string): Promise<{ userId: number; sessionId: string; host: string } | null>;
```
`issueSession` and `startSession` keep their signatures (`{ notifyNewDevice, host }`); invite tokens are created with `host`; invite read answers `host`; `passwordChangedAt` is set on accept, reset confirm and password change.

- [ ] **Step 1: Failing tests.** `every sign-in path checks the host` (fake stores): a holder-only account (no team member, one live access) gets a session on `sportiv` and the refusal of the path on `antrenor` for password login (401 "E-mailul sau parola nu sunt corecte.", same bcrypt compare as 6-1's timing case), reset confirm, Google login, passkey verify (401 "Nu am putut folosi cheia de acces."), the second step (a pending opened on `sportiv` succeeds on the code; a pending whose data says `antrenor` for that account answers 401 and issues nothing) and refresh; a coach-only account is refused on `sportiv` on the same paths. An account with 2FA logging in on `sportiv` gets `SecondStep & { pending, deviceKey }` and the device row made at the password step has `host: 'sportiv'`. Login on `sportiv` writes `host: 'sportiv'` on the session and the device. `deviceByKey` with the right key on the other host finds nothing. `revokeAllOnHost(u, 'antrenor')` leaves the sportiv session usable. Invite read of a `sportiv` token answers `host: 'sportiv'`. Accept of an invited coach-only account on the `sportiv` page answers `{ session: null, host: 'sportiv' }` with the account now `active`. Accept sets `passwordChangedAt`. `listDevices` on an antrenor session omits sportiv devices. The new-device mail text names `sportiv.<domain>` for a sportiv device. `portalHost('https://www.codrin.space', 'sportiv').host === 'sportiv.codrin.space'`.
- [ ] **Step 2: Run** `npx vitest run --maxWorkers=3 src/club/portal/__tests__ src/club/portal/coach/__tests__/me.test.ts`. Expected: the new cases FAIL, the phase 6 and 6b cases still pass.
- [ ] **Step 3: Implement.** Existing callers of `portalHost(siteUrl)` keep the default `'antrenor'`. A pending second step stores the host already (`openPending` data); only the device row and the final check change.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal src/email/portal-email.ts && git commit -m "feat(portal): per-host entry on every sign-in path, device and invite host"`

### Task 4: `global::is-sportiv`, `global::is-portal-user` and the holder state (high, Sonnet)

**Files:**
- Create: `src/policies/is-sportiv.ts`, `src/policies/is-portal-user.ts`, `src/club/portal/sportiv/holder.ts`
- Modify: `src/policies/is-coach.ts` (the session host must be `antrenor`), `src/api/portal/routes/03-security.ts` (guard `global::is-portal-user`), `src/api/portal/controllers/portal-security.ts` (reads `ctx.state.portalUser`; its `coachOnly` wrapper becomes `signedIn`)
- Test: `src/policies/__tests__/is-sportiv.test.ts`, `src/policies/__tests__/is-portal-user.test.ts`, extend `src/policies/__tests__/is-coach.test.ts`, extend `src/club/portal/__tests__/security-routes.test.ts` (behaviour: a sportiv session reads its own Securitate)

**Interfaces:**
- Consumes: `isBffCall`, `portalSessions`, `strapiPortalStore`, `mayEnter` (T3), `AccessStore`.
- Produces:

```ts
// holder.ts
export type HolderState = { accountId: string; userId: number; sessionId: string; athleteIds: string[] };
export const NO_ACCESS = 'Nu mai ai acces la acest sportiv.';
export function holdsAthlete(holder: HolderState, athleteId: string): boolean;
// is-portal-user.ts sets
export type PortalUserState = { accountId: string; userId: number; sessionId: string; host: 'antrenor' | 'sportiv'; actor: string }; // actor: index ruling 11
```

- [ ] **Step 1: Failing tests.** `is-sportiv`: no secret -> 403; wrong secret -> 403 before any store call (spy); no bearer -> 401; a token of an `antrenor` session -> 403 (`host of the session decides`); a sportiv token of an account whose only access was revoked a moment ago -> 403; an anonymized athlete is not counted (access to it alone -> 403); a valid case sets `state.holder.athleteIds` to the live athlete ids, sorted, and no log line carries the session id (log spy). `is-coach`: a sportiv-session token of a coach account -> 403. `is-portal-user`: a live session of either host whose account may enter that host passes with the host in the state; a sportiv session of an account with no live access left -> 403; no bearer -> 401. Securitate: a sportiv session `GET /portal/me/security` answers its own methods; enabling the 2FA app from a sportiv session writes the history line with the account name as actor.
- [ ] **Step 2: Run** `npx vitest run --maxWorkers=3 src/policies src/club/portal/__tests__/security-routes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** in the order of spec 5.2.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/policies src/club/portal src/api/portal && git commit -m "feat(portal): is-sportiv and host-generic Securitate policies"`

### Task 5: Coach side on a shared account (high, Sonnet)

**Files:**
- Modify: `src/club/portal/accounts/status.ts` (`disableAccount` role-aware, new `disableAll`), `accounts/team-member-hook.ts` (`disableForTeamMembers` role-aware), `accounts/invite.ts` (the private `relinkAccount` path splits: a holder that is not disabled -> new `addCoachRole`; `resendInvite` also accepts an invited holder that is being given the coach role), `accounts/read.ts` + `accounts/api-types.ts` (`hasSportiv`, `coachDisabled`), `src/club/portal/copy-admin.ts` (texts of spec 4.3, 13)
- Test: extend `src/club/portal/accounts/__tests__/accounts.test.ts`, `hook-purge.test.ts`

**Interfaces:**
- Consumes: `revokeAllOnHost` (T3), `AccessStore.liveByAccount` (T1), `queueAccessMail` (T6 produces; this task calls it through `AccountContext.queueAccess` and the test passes a spy).
- Produces: `disableAccount(c, accountId)`, `enableAccount(c, accountId)`, `disableAll(c, accountId): Promise<AdminResult<AccountAnswer>>`, `addCoachRole(c, holder, teamMemberId, name)`.

- [ ] **Step 1: Failing tests.** `coach disable keeps the sportiv side`: account with team member and one live access -> after `disableAccount` status `active`, `coachDisabledAt` set, user not blocked, antrenor session revoked, sportiv session valid, antrenor devices revoked, sportiv device not; history line "Partea de antrenor dezactivată". Without access: phase 6 behaviour unchanged (existing tests stay green). `enableAccount` clears `coachDisabledAt`. `disableAll`: status `disabled`, user blocked, every session and device revoked, line "Cont dezactivat complet". Hook on team member delete with a live access: as `disableAccount`. Coach invite to an active parent account: `teamMemberId` set, `passwordHash`, `googleSub`, 2FA methods and passkeys unchanged, sessions untouched, one `portal-access` job with variant `coach`, line "Rol de antrenor adăugat"; to an invited parent account: one fresh invite with host `antrenor`; to a disabled account with no team member: phase 6 re-link (password and Google cleared).
- [ ] **Step 2: Run** `npx vitest run --maxWorkers=3 src/club/portal/accounts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/accounts src/club/portal/copy-admin.ts && git commit -m "feat(portal): coach side disable and coach role on a shared account"`

### Task 6: Parent invite, resend, remove, mails (high, Sonnet)

**Files:**
- Create: `src/club/portal/access/{invite,context}.ts`, `src/email/portal-access-email.ts`
- Modify: `src/email/portal-email.ts` (parent variant: `PortalInvitePayload.children: string[]`, copy of spec 11.1 when `host` starts with `sportiv.`; link through `inviteLink`, path `/invite/<secret>`), `src/email/email-jobs.ts` and `src/api/email-job` schema (kind `portal-access` added to the enum, renderer dispatch)
- Test: `src/club/portal/access/__tests__/invite.test.ts`, `invite-pg.test.ts`, `src/email/__tests__/portal-access-email.test.ts`

**Interfaces:**
- Consumes: `planInvite`, `inviteRefusal`, `holderName` (T2); `useUpTokens`, `queueFreshInvite` (`accounts/invite.ts`, now taking a host); `AccessStore`.
- Produces:

```ts
export type AccessContext = AccountContext & { access: AccessStore; queueAccess: (job: NewPortalAccessJob) => Promise<string> };
export async function linkAccess(c: AccessContext, athleteId: string, email: string): Promise<AdminResult<{ toast: string }>>; // inside a caller's transaction when c.inTx; used by T7 and T8
export async function inviteAccess(c: AccessContext, athleteId: string): Promise<AdminResult<AccessAnswer>>;
export async function resendAccess(c: AccessContext, athleteId: string): Promise<AdminResult<AccessAnswer>>;
export async function removeAccess(c: AccessContext, athleteId: string): Promise<AdminResult<AccessAnswer>>;
export type AccessAnswer = { access: AccessBlock; toast: string };
export type PortalAccessPayload = { name: string; variant: 'child' | 'coach'; childName: string | null; link: string; host: string };
export function renderPortalAccess(input: { payload: PortalAccessPayload; links: EmailLinks }): RenderedEmail;
```

- [ ] **Step 1: Failing tests.** Case 1 (no account): user and account created, `name` = contact name, token host `sportiv`, one `portal-invite` job whose rendered text contains "Ai primit acces la portalul EduSport pentru Ana Ionescu." and the link `https://sportiv.<host>/invite/`, line "Acces portal: invitație trimisă la parinte1@example.invalid"; toast "Invitație trimisă.". Case 2 (active): access row, one `portal-access` job, text "Ai acces și la Ana Ionescu în portalul EduSport.", toast "Acces adăugat.". Case 3 (`invited account case 3`): older invite tokens used, one invite job on the host of the latest token. Case 4 (disabled): 409, nothing written. Refusals of `inviteRefusal` answer 409 or 400 with the texts. An athlete with a live access to another account: that row revoked `email_schimbat` first. `resendAccess` on an active account: 409 stale. `removeAccess`: row revoked `scos`, line "Acces portal scos: <e-mail>". Postgres (55481) `concurrent invites leave one live access`: two parallel `inviteAccess` for one athlete -> one success, one 409 `ADMIN_ERRORS.stale`, one live row, one job. Mail renderer: subject "Acces nou în portalul EduSport"; coach variant text "Poți intra și pe antrenor.<domain> cu același cont.". (The character guard of the copy module covers dashes and dots; no string table.)
- [ ] **Step 2: Run** `npx vitest run --maxWorkers=3 src/club/portal/access/__tests__/invite.test.ts src/email/__tests__/portal-access-email.test.ts`, then `invite-pg.test.ts` against 55481. Expected: FAIL.
- [ ] **Step 3: Implement** with lock order athlete, account; jobs released after commit (`afterCommit`).
- [ ] **Step 4: Run** the same commands. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/access src/email src/api/email-job && git commit -m "feat(portal): parent invite, access mails, remove access"`

### Task 7: Access follows the athlete (high, Sonnet)

**Files:**
- Create: `src/club/portal/access/lifecycle.ts`
- Modify: `src/club/athletes/record.ts` (`updateAthlete` calls `moveOnEmailChange` in its transaction), `src/club/athletes/delete.ts`, `src/club/athletes/merge.ts`, `src/club/personal-data/anonymize-service.ts`
- Test: `src/club/portal/access/__tests__/lifecycle.test.ts`, extend the merge and delete tests in `src/club/athletes/__tests__`

**Interfaces:**
- Consumes: `linkAccess` (T6), `AccessStore`.
- Produces:

```ts
export async function moveOnEmailChange(c: AccessContext, athleteId: string, before: string | null, after: string | null): Promise<void>;
export async function endForAthlete(c: AccessContext, athleteId: string, reason: 'anonimizat' | 'sters'): Promise<void>;
export async function moveOnMerge(c: AccessContext, keptId: string, removedId: string, keptEmail: string | null): Promise<void>;
```

- [ ] **Step 1: Failing tests.** E-mail change with a live access to A: A's row revoked `email_schimbat`; new e-mail of active account B -> B row live and one `portal-access` job; new e-mail without account -> invited account and one invite job; new e-mail empty -> no live row, no job; line "Acces portal mutat la <e-mail>". Same e-mail with other letter case -> nothing changes. No live access before -> nothing happens (no invite on a plain edit). Anonymize -> revoked `anonimizat`, inside the anonymize transaction (a forced failure after it rolls the revoke back). Delete -> revoked `sters` before the athlete row is removed. Merge: removed has access, kept has none, kept e-mail equals the access e-mail -> row moved (`athleteKey` = kept); kept already has one -> removed's row revoked `unit`; e-mails differ -> revoked `unit`.
- [ ] **Step 2: Run** `npx vitest run --maxWorkers=3 src/club/portal/access/__tests__/lifecycle.test.ts src/club/athletes`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/access src/club/athletes src/club/personal-data && git commit -m "feat(portal): access moves with the athlete e-mail, ends on anonymize, delete, merge"`

### Task 8: Admin routes and bulk invite (high, Sonnet)

**Files:**
- Create: `src/club/portal/access/bulk.ts`, `src/api/club/routes/14-athlete-access.ts` (every route `adminRoute('club')`; static `/club/athletes/access/bulk-*` paths before `/club/athletes/:documentId/...`), `src/api/club/controllers/athlete-access.ts`
- Modify: `src/api/club/routes/12-portal-accounts.ts` (`disable-all` with `adminRoute('coachAccounts')`) and `src/api/club/controllers/portal-accounts.ts`
- Test: `src/club/portal/access/__tests__/bulk.test.ts`, `access-routes.test.ts`

**Interfaces:**
- Consumes: T5, T6 services; `MAX_BULK` (`src/club/personal-data/anonymize-plan.ts`); `adminRoute` (`src/club/admin-area.ts`).
- Produces: `bulkPreview(c, ids): Promise<AdminResult<BulkPreview>>`, `bulkInvite(c, ids): Promise<AdminResult<{ sent: number; toast: string }>>`, routes of the index table.

- [ ] **Step 1: Failing tests.** Behaviour only (no route-list or source pins, user rule): through the controller with a stubbed admin, `GET .../access` answers the `AccessBlock` of the contract; `POST /club/athletes/access/bulk-preview` is not captured by the `:documentId` routes (it answers a `BulkPreview`, not a 404); `disable-all` answers the account block. Bulk: ids of two siblings with one e-mail -> preview `{ invites: 2, addresses: 1 }`; a `nou`, a no-e-mail, an already-held athlete listed in `skipped` with the reasons of the contract; 201 ids -> 400 `"Cerere invalidă."`; `bulkInvite` sends one invite job naming both children ("pentru Ana Ionescu și Matei Ionescu"), toast `"1 invitație trimisă."`; 25 sent -> "25 de invitații trimise.".
- [ ] **Step 2: Run** `npx vitest run --maxWorkers=3 src/club/portal/access/__tests__/bulk.test.ts src/club/portal/access/__tests__/access-routes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Bulk sends per address in its own transaction; one failing address does not stop the others; the answer counts only sent ones.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/access src/api/club && git commit -m "feat(portal): admin access routes and bulk invite"`

### Task 9: Admin UI (low, Sonnet)

**Files:**
- Create: `src/admin/dashboard/sportivi/AccessBlock.tsx`, `src/admin/dashboard/sportivi/BulkInviteDialog.tsx`, `src/club/sportivi/access-view.ts`
- Modify: `src/admin/dashboard/sportivi/DateTab.tsx` (block at the bottom; e-mail hint of spec 4.4 under the e-mail field while it differs from the stored value and a live access exists), `SportiviList.tsx` + `ListToolbar.tsx` (bulk action "Invită în portal"), `src/admin/dashboard/portal/AccountBlock.tsx` ("Dezactivează tot" when `hasSportiv`, confirmation of spec 4.3; the 6b "Resetează 2FA" button stays), `src/admin/dashboard/sportivi/api.ts`
- Test: `src/club/sportivi/__tests__/access-view.test.ts`

**Interfaces:**
- Consumes: the admin contracts; existing admin UI parts (`ui-sheet`, `ui-table`, `admin-http`, admin `Toast`).
- Produces: `accessActions(block: AccessBlock): ('invite' | 'resend' | 'remove')[]` in `src/club/sportivi/access-view.ts`.

- [ ] **Step 1: Failing test** (logic only, no labels): `none` + `canInvite` -> `['invite']`; `invited` -> `['resend','remove']`; `active` -> `['remove']`; `canInvite: false` -> `[]`.
- [ ] **Step 2: Run** `npx vitest run --maxWorkers=3 src/club/sportivi/__tests__/access-view.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the helper and the components (site admin parts only; no new colours; no button labeled "Salvează" or "Publică", so the SaveBar tagger leaves them; status texts and the "Sportiv 18+" tag from spec 4.6).
- [ ] **Step 4: Run** the test, `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict` and `npm run build` (admin bundle, one build at a time). Expected: PASS, build ok. The UI is checked by hand on the throwaway Strapi in Task 10.
- [ ] **Step 5: Commit** `git add src/admin src/club/sportivi && git commit -m "feat(admin): Acces portal block, bulk invite, Dezactivează tot"`

### Task 10: Fixture, boot check, click-through, docs (low, Haiku)

**Files:**
- Create: `scripts/fixtures/phase7-shape.js` (index "Fixture"; same guards as `coach-additions.js`: `ES_THROWAWAY_DB=1`, `IDS_FILE`, `THROWAWAY_PORTS`), `scripts/clickthrough-7-1.sh` (pattern of `scripts/clickthrough-training-add.sh`; refuses any `BASE` other than `http://127.0.0.1:1411`)
- Modify: `THROWAWAY_PORTS` in `scripts/fixtures/{phase4-shape,phase5-shape,phase6-shape,coach-additions,training-add,phase11-volume}.js` (add 55481, 55482, 55483, 55484), `docs/architecture/diagrams/03d-class-registrations-documents-accounts.puml` (AthleteAccess, account fields), `02b-use-cases-parent.puml` (holder use cases), regenerate their `.svg`, `docs/architecture/08-authentication.md` (hosts, `WEBAUTHN_ORIGINS` must list `sportiv.` too), `docs/architecture/13-roadmap.md` row 7 "In progress", `docs/HANDOFF.md` (phase 7-1 note)

- [ ] **Step 1: Boot.** `lsof -i :55481 -i :1411` (both free); `docker run -d --name es71-pg -e POSTGRES_PASSWORD=pg -p 127.0.0.1:55481:5432 postgres:16`; Strapi on 1411 with the index env; load phase 4, 5, 6 and 7 fixtures; restart Strapi once. Expected: `select count(*) from athlete_accesses where revoked_at is null` = 5 (Ana, Matei, Ioana, Radu, Sara), the index `athlete_accesses_live_uq` exists, `portal_devices` has no null host.
- [ ] **Step 2: Click-through** `IDS_FILE=<scratch>/ids.json BASE=http://127.0.0.1:1411 bash scripts/clickthrough-7-1.sh` (curl with the BFF secret): login `parinte1@example.invalid` on `sportiv` -> 200 session; same on `antrenor` -> 401; login `antrenor1@example.invalid` on both -> 200 (he holds Radu); login `parinte2@example.invalid` on `sportiv` -> 200 session (password or Google only, no portal 2FA); a sportiv session `GET /api/portal/me/security` -> 200; admin session (`/api/admin-auth/login`): invite "Elena Stan" -> 409 "Confirmă sportivul întâi."; remove Matei's access then invite it again -> "Acces adăugat."; disable `antrenor1` as coach -> his sportiv refresh still 200, antrenor refresh 401. Expected: every line prints `PASS`. Then open the admin "Acces portal" block once by hand on the throwaway Strapi and note it in the ledger.
- [ ] **Step 3: Full suite** in a background worktree: `npx vitest run --maxWorkers=3`. Expected: PASS. Then `docker rm -f es71-pg`.
- [ ] **Step 4: Commit** `git add scripts docs && git commit -m "chore(portal): phase 7 fixture, boot check and diagrams"`
