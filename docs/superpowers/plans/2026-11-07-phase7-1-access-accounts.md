# Phase 7-1: Athlete Access and Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One account can be coach, holder of athletes, or both: athlete access rows, per-host entry, the `global::is-sportiv` policy, role-aware coach disable, parent invites and their mails, access that follows the athlete e-mail, and the admin tools to grant and remove it.

**Architecture:** New module `src/club/portal/access/` with pure rules (`rules.ts`), a store extension of the phase 6 `PortalStore` (Strapi and fake, parity tested), services (`invite.ts`, `lifecycle.ts`, `bulk.ts`), views (`api-types.ts`). Phase 6 files change only where named. Every write is one transaction with rows locked in the order athlete, account, team member.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS), Postgres 16, Vitest 3, Node 22.

**Spec:** `docs/superpowers/specs/2026-11-07-sportiv-app-design.md` sections 3, 4, 5.1, 5.2, 10.2, 11.1, 11.2, 13, 14.2, 14.3. Index: `docs/superpowers/plans/2026-11-07-phase7-index.md` (contracts and rulings binding).

**Base:** `feat/athletes` with phase 6 merged. Ledger `p3be/.superpowers/sdd/2026-11-07-phase7-1/progress.md`.

| Task | Risk | Model | Batch |
|---|---|---|---|
| 1 Schemas, bootstrap, store | high (data) | Sonnet | A |
| 2 Pure rules and copy | high (auth) | Haiku | A |
| 3 Hosts, devices, tokens, sessions | high (sessions) | Sonnet | A |
| 4 `global::is-sportiv` | high (auth) | Sonnet | A |
| 5 Coach side: disable, disable-all, hook, coach invite on a holder | high (auth, data loss) | Sonnet | B |
| 6 Parent invite, resend, remove, mails | high (auth) | Sonnet | B |
| 7 Lifecycle: e-mail move, anonymize, delete, merge | high (data exposure) | Sonnet | B |
| 8 Admin routes and bulk | high (permissions) | Sonnet | B |
| 9 Admin UI | low | Sonnet | |
| 10 Fixture, boot check, click-through, diagrams | low | Haiku | |

## Global Constraints

- Everything in plan 6-1 "Global Constraints": repo `p3be`, branch per task worktree, commit messages exactly as given, no AI attribution, never push; checks per task `npx tsc --noEmit`, `npm run lint`, the task's own `npx vitest run <files>`; full suite once in Task 10 in a background worktree.
- Code: TypeScript strict, no `any`, functions under 30 lines, complexity under 10. A session id never goes in an answer or a log. Build a `PortalStore` per request.
- Copy: exact strings from the spec; new strings live in `src/club/portal/access/copy.ts` only. Romanian, no em or en dash, no middle dot, straight quotes, "E-mail".
- One live access per athlete (spec 3.1); status derived from the account (spec 3.1); e-mails normalized with phase 6 `normalizeEmail`.
- Synthetic data only (`@example.invalid`).
- Files this plan may touch: `src/club/portal/access/**`, `src/api/athlete-access/**`, `src/api/portal-account|portal-device|portal-token` schemas, `src/club/portal/{types,store,strapi-store,limits}.ts`, `src/club/portal/auth/{issue,invite,login,google,reset,refresh}.ts`, `src/club/portal/sessions-own.ts`, `src/club/portal/accounts/**`, `src/policies/is-coach.ts`, `src/policies/is-sportiv.ts`, `src/email/portal-email.ts`, `src/email/portal-access-email.ts`, `src/email/email-jobs.ts`, `src/api/email-job` schema, `src/club/athletes/{record,delete,merge}.ts`, `src/club/personal-data/anonymize-service.ts`, `src/api/club/routes/{12-portal-accounts,13-athlete-access}.ts`, `src/api/club/controllers/athlete-access.ts`, `src/index.ts`, `src/admin/dashboard/sportivi/**`, `src/admin/dashboard/MembriEchipaPage.tsx`, `scripts/fixtures/phase7-shape.js`, `docs/architecture/diagrams/`.

## Review Focus

- **A coach who is also a parent is disabled as a coach**: his `sportiv` session keeps working, his `antrenor` sessions and devices are revoked, the U&P user is not blocked. Pinned by Task 5 (`coach disable keeps the sportiv side`).
- **Two admins invite for the same athlete at once**, or invite while another changes the athlete e-mail: one live access remains, the loser gets 409 stale and nothing is half written. Pinned by Task 6 (`concurrent invites leave one live access`, Postgres test).
- **The athlete e-mail is changed to an address of another family**: the old holder loses the athlete on the next request, the new holder gets exactly one mail, history shows the move. Pinned by Task 7.
- **A coach token on a sportiv route, a sportiv token on a coach route** (same account): 403, nothing read. Pinned by Task 4 (`host of the session decides`).
- **An invited coach gets a parent invite**: one fresh invite, older tokens used, accepting it activates the account for both roles. Pinned by Task 6 (`invited account case 3`).

---

## File Structure

```
src/api/athlete-access/content-types/athlete-access/schema.json   (T1)
src/club/portal/access/
  types.ts        AccessRow, NewAccess, RevokeReason (T1)
  store.ts        AccessStore interface; strapi-store.ts, fake-store.ts (T1)
  indexes.ts      ensureAccessIndexes, backfillDeviceHosts (T1)
  rules.ts        canEnterHost, accessState, planInvite, inviteRefusal, adult (T2)
  copy.ts         ACCESS_COPY, ACCESS_ERRORS, ACCESS_ACTIONS (T2)
  api-types.ts    AccessBlock, AccessState, BulkPreview (T2)
  invite.ts       inviteAccess, resendAccess, removeAccess, linkAccess (T6)
  lifecycle.ts    moveOnEmailChange, endForAthlete, moveOnMerge (T7)
  bulk.ts         bulkPreview, bulkInvite (T8)
  context.ts      accessContext(strapi, actor) (T6)
src/policies/is-sportiv.ts, src/club/portal/sportiv/holder.ts (T4)
src/email/portal-access-email.ts (T6)
```

---

### Task 1: Schemas, bootstrap indexes, access store (high, Sonnet)

**Files:**
- Create: `src/api/athlete-access/content-types/athlete-access/schema.json`, `src/api/athlete-access/{routes,controllers,services}/athlete-access.ts` (core factories, routes closed), `src/club/portal/access/{types,store,strapi-store,fake-store,indexes}.ts`
- Modify: `src/api/portal-account/content-types/portal-account/schema.json` (`name`, `coachDisabledAt`, `passwordChangedAt`, `notifySchedule` default true), `portal-device` schema (`host` string), `portal-token` schema (`host` string), `src/club/portal/types.ts` (`AccountRow`, `DeviceRow`, `TokenRow` gain the fields), `src/club/portal/strapi-store.ts`, `src/club/portal/__tests__/fake-portal-store.ts`, `src/index.ts` (bootstrap calls), `src/club/subjects.ts` (no new subject; access lines use `athlete` and `portalAccount`)
- Test: `src/club/portal/access/__tests__/store.test.ts`, `store-pg.test.ts`, `src/club/portal/__tests__/schemas.test.ts`

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
export async function ensureAccessIndexes(knex: Knex): Promise<void>; // CREATE UNIQUE INDEX IF NOT EXISTS athlete_accesses_live_uq ON athlete_accesses_athlete_lnk (athlete_id) ... see step 3
export async function backfillDeviceHosts(knex: Knex): Promise<number>; // UPDATE portal_devices SET host='antrenor' WHERE host IS NULL
```

- [ ] **Step 1: Failing tests.** `schemas.test.ts`: athlete-access has the attributes of spec 3.1 with `revokeReason` enum exactly `['scos','email_schimbat','anonimizat','sters','unit']`, both relations `manyToOne` and unidirectional (no `inversedBy`); account has `notifySchedule` `{ type: 'boolean', default: true }`. `store.test.ts` (fake and Strapi store, same cases, parity): `liveByAthlete` ignores revoked rows; `liveByAccount` returns only live rows; `createAccess` then `revokeAccess` then `liveByAthlete` is null. `store-pg.test.ts` (throwaway Postgres 55465): a second live row for one athlete throws a unique violation (`code === '23505'`); a revoked row plus a new live row is accepted; `backfillDeviceHosts` returns the count and is idempotent (second call 0).
- [ ] **Step 2: Run** `npx vitest run src/club/portal/access src/club/portal/__tests__/schemas.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement.** The partial index: Strapi 5 stores manyToOne links in a link table; the live rule needs the athlete and the revoked flag in one table, so the access row also keeps a plain `athleteKey` string column (= athlete documentId, written by `createAccess`, never changed except by `moveAccess`) and the index is `CREATE UNIQUE INDEX IF NOT EXISTS athlete_accesses_live_uq ON athlete_accesses (athlete_key) WHERE revoked_at IS NULL`. Add `athleteKey` to the schema (private) and to the schema test. Bootstrap order in `src/index.ts`: after `ensurePortalIndexes`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/api/athlete-access src/api/portal-account src/api/portal-device src/api/portal-token src/club/portal src/index.ts && git commit -m "feat(portal): athlete access rows, account and device fields for phase 7"`

### Task 2: Pure rules, copy and admin types (high, Haiku)

**Files:**
- Create: `src/club/portal/access/{rules,copy,api-types}.ts`
- Test: `src/club/portal/access/__tests__/rules.test.ts`, `copy.test.ts`

**Interfaces:**
- Consumes: `AccountRow`, `UserAuth` (phase 6), `AccessRow` (T1), `ageFromIso`, `todayInBucharest` [code src/club/birth-date.ts].
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

- [ ] **Step 1: Failing tests.** `canEnterHost`: active coach with live 0 on `antrenor` true, on `sportiv` false; same with live 1 on `sportiv` true; `coachDisabledAt` set: `antrenor` false, `sportiv` with live 1 true; status `invited` false everywhere; `user.blocked` false everywhere; host `'admin'` false. `planInvite(null, null)` -> `create`; active -> `add`; invited with latest invite host `antrenor` -> `{ kind: 'reinvite', host: 'antrenor' }`, with null -> `sportiv`; disabled -> refuse `"Contul acestei adrese este dezactivat."`. `inviteRefusal({ status: 'nou', email: 'a@example.invalid' })` = `"Confirmă sportivul întâi."`; email null = `"Adaugă un e-mail în Date."`; `anonimizat` = `"Sportivul este anonimizat."`; `activ` with e-mail = null. `isAdult('2008-11-07','2026-11-07')` true, `('2008-11-08','2026-11-07')` false, `(null, ...)` false (spec 5.4). `holderName` prefers a non-empty trimmed `contactName`. `copy.test.ts`: no string in `ACCESS_COPY`, `ACCESS_ERRORS`, `ACCESS_ACTIONS` contains `—`, `–`, `·`, or `Email`.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/access/__tests__/rules.test.ts src/club/portal/access/__tests__/copy.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the functions; copy constants hold every string of spec 4, 13 and the index contracts (toasts "Invitație trimisă.", "Acces adăugat.", "Acces scos.", `"<n> invitații trimise."` via `countWords`).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/access && git commit -m "feat(portal): access rules, copy and admin types"`

### Task 3: Hosts on sessions, devices and tokens (high, Sonnet)

**Files:**
- Modify: `src/club/portal/auth/issue.ts` (`canEnter` delegates to `canEnterHost` with the live access count read from `AccessStore`), `auth/login.ts`, `auth/google.ts`, `auth/reset.ts`, `auth/invite.ts` (accept on the token host; `session: null` answer of the contract), `auth/bff.ts` (`PORTAL_HOSTS` default stays `['antrenor']`), `sessions-own.ts` (no default host; `revokeAllOnHost(userId, host)`), `src/club/portal/accounts/invite.ts` (`revokeAccess(c, account, host?)`), `src/email/portal-email.ts` (`portalHost(siteUrl, site: Host)`), `src/club/portal/coach/me.ts` (device list filtered by host)
- Test: `src/club/portal/__tests__/login.test.ts`, `invite.test.ts`, `sessions-own.test.ts`, `src/club/portal/coach/__tests__/me.test.ts` (extend)

**Interfaces:**
- Consumes: `canEnterHost` (T2), `AccessStore.liveByAccount` (T1).
- Produces: `bindDevice` writes `host`; `PortalSessions.revokeAllOnHost(userId: number, host: Host): Promise<void>`; `issueSession(c, account, deviceKey, { notifyNewDevice, host })` unchanged signature; invite tokens created with `host`; invite read answers `host`; `passwordChangedAt` set on accept, reset confirm and password change.

- [ ] **Step 1: Failing tests.** Login on `sportiv` with an active account and no live access answers 401 `"E-mailul sau parola nu sunt corecte."` and runs the same bcrypt compare (timing helper of 6-1); with a live access answers a session whose row has `host: 'sportiv'` and whose device row has `host: 'sportiv'`. `revokeAllOnHost(u, 'antrenor')` leaves the sportiv session usable (`verifyAccess` non-null). Invite read of a token with `host: 'sportiv'` answers `host: 'sportiv'`. Accept of an invited coach-only account on the `sportiv` page answers `{ session: null, host: 'sportiv' }` with the account now `active`. Accept sets `passwordChangedAt`. `listDevices` on an antrenor session omits sportiv devices. `portalHost('https://www.codrin.space', 'sportiv').host === 'sportiv.codrin.space'`.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/__tests__ src/club/portal/coach/__tests__/me.test.ts`. Expected: the new cases FAIL, the phase 6 cases still pass.
- [ ] **Step 3: Implement.** Existing callers of `portalHost(siteUrl)` pass `'antrenor'`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal src/email/portal-email.ts && git commit -m "feat(portal): per-host entry, device and invite host"`

### Task 4: `global::is-sportiv` and the holder state (high, Sonnet)

**Files:**
- Create: `src/policies/is-sportiv.ts`, `src/club/portal/sportiv/holder.ts`
- Modify: `src/policies/is-coach.ts` (session host must be `antrenor`)
- Test: `src/policies/__tests__/is-sportiv.test.ts`, `src/policies/__tests__/is-coach.test.ts` (extend)

**Interfaces:**
- Consumes: `isBffCall`, `portalSessions`, `strapiPortalStore`, `canEnterHost`, `AccessStore`.
- Produces:

```ts
// holder.ts
export type HolderState = { accountId: string; userId: number; sessionId: string; athleteIds: string[] };
export const NO_ACCESS = 'Nu mai ai acces la acest sportiv.';
export function holdsAthlete(holder: HolderState, athleteId: string): boolean;
```
`PortalSessions.verifyAccess` returns `{ userId, sessionId, host }` (add `host`; phase 6 callers ignore it).

- [ ] **Step 1: Failing tests.** No secret -> 403; wrong secret -> 403 before any store call (spy); no bearer -> 401; a token of an `antrenor` session -> 403; a sportiv token of an account whose only access was revoked a moment ago -> 403; an anonymized athlete is not counted (access to it alone -> 403); a valid case sets `state.holder.athleteIds` to the live athlete ids, sorted, and never puts `sessionId` in a log line (log spy). `is-coach`: a sportiv-session token of a coach account -> 403.
- [ ] **Step 2: Run** `npx vitest run src/policies`. Expected: FAIL.
- [ ] **Step 3: Implement** in the order of spec 5.2.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/policies src/club/portal/sportiv/holder.ts src/club/portal/sessions*.ts && git commit -m "feat(portal): is-sportiv policy and host-bound sessions"`

### Task 5: Coach side on a shared account (high, Sonnet)

**Files:**
- Modify: `src/club/portal/accounts/status.ts` (`disableAccount` role-aware, new `disableAll`), `accounts/team-member-hook.ts` (`disableForTeamMembers` role-aware), `accounts/invite.ts` (`relinkAccount` split: holder not disabled -> `addCoachRole`), `accounts/read.ts` + `api-types.ts` (`hasSportiv`, `coachDisabled`), `src/club/portal/copy-admin.ts` (texts of spec 4.3, 13)
- Test: `src/club/portal/accounts/__tests__/accounts.test.ts`, `hook-purge.test.ts` (extend)

**Interfaces:**
- Consumes: `revokeAllOnHost` (T3), `AccessStore.liveByAccount` (T1), `queueAccessMail` (T6 produces; this task calls it through `AccountContext.queueAccess` and the test passes a spy).
- Produces: `disableAccount(c, accountId)`, `enableAccount(c, accountId)`, `disableAll(c, accountId): Promise<AdminResult<AccountAnswer>>`, `addCoachRole(c, holder, teamMemberId, name)`.

- [ ] **Step 1: Failing tests.** `coach disable keeps the sportiv side`: account with team member and one live access -> after `disableAccount` status `active`, `coachDisabledAt` set, user not blocked, antrenor session revoked, sportiv session valid, antrenor devices revoked, sportiv device not; history line "Partea de antrenor dezactivată". Without access: phase 6 behaviour unchanged (existing tests stay green). `enableAccount` clears `coachDisabledAt`. `disableAll`: status `disabled`, user blocked, every session and device revoked, line "Cont dezactivat complet". Hook on team member delete with a live access: as `disableAccount`. Coach invite to an active parent account: `teamMemberId` set, `passwordHash` unchanged, `googleSub` unchanged, sessions untouched, one `portal-access` job with variant `coach`, line "Rol de antrenor adăugat"; to an invited parent account: one fresh invite with host `antrenor`; to a disabled account with no team member: phase 6 re-link (password cleared).
- [ ] **Step 2: Run** `npx vitest run src/club/portal/accounts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/accounts src/club/portal/copy-admin.ts && git commit -m "feat(portal): coach side disable and coach role on a shared account"`

### Task 6: Parent invite, resend, remove, mails (high, Sonnet)

**Files:**
- Create: `src/club/portal/access/{invite,context}.ts`, `src/email/portal-access-email.ts`
- Modify: `src/email/portal-email.ts` (parent variant: `PortalInvitePayload.children: string[]`, copy of spec 11.1 when `host` starts with `sportiv.`), `src/email/email-jobs.ts` and `src/api/email-job` schema (kind `portal-access`, renderer dispatch)
- Test: `src/club/portal/access/__tests__/invite.test.ts`, `invite-pg.test.ts`, `src/email/__tests__/portal-access-email.test.ts`

**Interfaces:**
- Consumes: `planInvite`, `inviteRefusal`, `holderName` (T2); `useUpTokens`, `queueFreshInvite` (phase 6, now taking a host); `AccessStore`.
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

- [ ] **Step 1: Failing tests.** Case 1 (no account): user and account created, `name` = contact name, token host `sportiv`, one `portal-invite` job whose rendered text contains "Ai primit acces la portalul EduSport pentru Ana Ionescu." and the link `https://sportiv.<host>/invitatie/`, line "Acces portal: invitație trimisă la parinte1@example.invalid"; toast "Invitație trimisă.". Case 2 (active): access row, one `portal-access` job, text "Ai acces și la Ana Ionescu în portalul EduSport.", toast "Acces adăugat.". Case 3 (`invited account case 3`): older invite tokens used, one invite job on the host of the latest token. Case 4 (disabled): 409, nothing written. Refusals of `inviteRefusal` answer 409 or 400 with the texts. An athlete with a live access to another account: that row revoked `email_schimbat` first. `resendAccess` on an active account: 409 stale. `removeAccess`: row revoked `scos`, line "Acces portal scos: <e-mail>". Postgres `concurrent invites leave one live access`: two parallel `inviteAccess` for one athlete -> one success, one 409 `ADMIN_ERRORS.stale`, one live row, one job. Mail renderer: no `—`, `–`, `·`; subject "Acces nou în portalul EduSport"; coach variant text "Poți intra și pe antrenor.<domain> cu același cont.".
- [ ] **Step 2: Run** `npx vitest run src/club/portal/access/__tests__/invite.test.ts src/email/__tests__/portal-access-email.test.ts`, then `invite-pg.test.ts` against 55465. Expected: FAIL.
- [ ] **Step 3: Implement** with lock order athlete, account; jobs released after commit (`afterCommit`).
- [ ] **Step 4: Run** the same commands. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/access src/email src/api/email-job && git commit -m "feat(portal): parent invite, access mails, remove access"`

### Task 7: Access follows the athlete (high, Sonnet)

**Files:**
- Create: `src/club/portal/access/lifecycle.ts`
- Modify: `src/club/athletes/record.ts` (`updateAthlete` calls `moveOnEmailChange` in its transaction), `src/club/athletes/delete.ts`, `src/club/athletes/merge.ts`, `src/club/personal-data/anonymize-service.ts`
- Test: `src/club/portal/access/__tests__/lifecycle.test.ts`, extend `src/club/athletes/__tests__` merge and delete tests

**Interfaces:**
- Consumes: `linkAccess` (T6), `AccessStore`.
- Produces:

```ts
export async function moveOnEmailChange(c: AccessContext, athleteId: string, before: string | null, after: string | null): Promise<void>;
export async function endForAthlete(c: AccessContext, athleteId: string, reason: 'anonimizat' | 'sters'): Promise<void>;
export async function moveOnMerge(c: AccessContext, keptId: string, removedId: string, keptEmail: string | null): Promise<void>;
```

- [ ] **Step 1: Failing tests.** E-mail change with a live access to A: A's row revoked `email_schimbat`; new e-mail of active account B -> B row live and one `portal-access` job; new e-mail without account -> invited account and one invite job; new e-mail empty -> no live row, no job; line "Acces portal mutat la <e-mail>". Same e-mail with other letter case -> nothing changes. No live access before -> nothing happens (no invite on a plain edit). Anonymize -> revoked `anonimizat`, inside the anonymize transaction (a forced failure after it rolls the revoke back). Delete -> revoked `sters` before the athlete row is removed. Merge: removed has access, kept has none, kept e-mail equals the access e-mail -> row moved (`athleteKey` = kept); kept already has one -> removed's row revoked `unit`; e-mails differ -> revoked `unit`.
- [ ] **Step 2: Run** `npx vitest run src/club/portal/access/__tests__/lifecycle.test.ts src/club/athletes`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/access src/club/athletes src/club/personal-data && git commit -m "feat(portal): access moves with the athlete e-mail, ends on anonymize, delete, merge"`

### Task 8: Admin routes and bulk invite (high, Sonnet)

**Files:**
- Create: `src/club/portal/access/bulk.ts`, `src/api/club/routes/13-athlete-access.ts`, `src/api/club/controllers/athlete-access.ts`
- Modify: `src/api/club/routes/12-portal-accounts.ts` and its controller (`disable-all`)
- Test: `src/club/portal/access/__tests__/bulk.test.ts`, `access-routes.test.ts`

**Interfaces:**
- Consumes: T5, T6 services; `MAX_BULK` [code personal-data/anonymize-plan.ts].
- Produces: `bulkPreview(c, ids): Promise<AdminResult<BulkPreview>>`, `bulkInvite(c, ids): Promise<AdminResult<{ sent: number; toast: string }>>`, routes of the index table.

- [ ] **Step 1: Failing tests.** Routes test (source reading, as 6-3): every route in `13-athlete-access.ts` has `policies: ['global::is-admin']`; static paths `/club/athletes/access/bulk-*` come before `/club/athletes/:documentId/...`. Bulk: ids of two siblings with one e-mail -> preview `{ invites: 2, addresses: 1 }`; a `nou`, a no-e-mail, an already-held athlete listed in `skipped` with the reasons of the contract; 201 ids -> 400 `"Cerere invalidă."`; `bulkInvite` sends one invite job naming both children ("pentru Ana Ionescu și Matei Ionescu"), toast `"1 invitație trimisă."` (built as `countWords(n, 'invitație trimisă', 'invitații trimise') + '.'`, so 25 gives "25 de invitații trimise."). Body of the access answer equals `AccessBlock` of the contract (key set compared exactly).
- [ ] **Step 2: Run** `npx vitest run src/club/portal/access/__tests__/bulk.test.ts src/club/portal/access/__tests__/access-routes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Bulk sends per address in its own transaction; one failing address does not stop the others; the answer counts only sent ones.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/portal/access src/api/club && git commit -m "feat(portal): admin access routes and bulk invite"`

### Task 9: Admin UI (low, Sonnet)

**Files:**
- Create: `src/admin/dashboard/sportivi/AccessBlock.tsx`, `src/admin/dashboard/sportivi/BulkInviteDialog.tsx`
- Modify: `src/admin/dashboard/sportivi/DateTab.tsx` (block at the bottom; e-mail hint of spec 4.4 under the e-mail field while it differs from the stored value and a live access exists), `SportiviList.tsx` + `ListToolbar.tsx` (bulk action "Invită în portal"), `src/admin/dashboard/MembriEchipaPage.tsx` ("Dezactivează tot" when `hasSportiv`, confirmation of spec 4.3), `src/admin/dashboard/sportivi/api.ts`
- Test: `src/club/sportivi/__tests__/access-view.test.ts` (pure view helpers in `src/club/sportivi/access-view.ts`)

**Interfaces:**
- Consumes: the admin contracts; existing admin UI parts (`ui-sheet`, `ui-table`, `admin-http`).
- Produces: `accessLines(block: AccessBlock): { status: string; tags: string[]; actions: ('invite' | 'resend' | 'remove')[] }` in `src/club/sportivi/access-view.ts`.

- [ ] **Step 1: Failing test.** `accessLines` for `none` + `canInvite` -> actions `['invite']`, status "Fără acces în portal."; `invited` -> status "Invitat", actions `['resend','remove']`; `active` + `adult` -> tags `['Sportiv 18+']`, actions `['remove']`; `canInvite: false` -> no invite, `hint` shown.
- [ ] **Step 2: Run** `npx vitest run src/club/sportivi/__tests__/access-view.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the view helper and the components (site admin parts only; no new colors; buttons not labeled "Salvează" or "Publică" so the SaveBar tagger leaves them, memory rule).
- [ ] **Step 4: Run** the test and `npm run build` (admin bundle). Expected: PASS, build ok.
- [ ] **Step 5: Commit** `git add src/admin src/club/sportivi && git commit -m "feat(admin): Acces portal block, bulk invite, Dezactivează tot"`

### Task 10: Fixture, boot check, click-through, docs (low, Haiku)

**Files:**
- Create: `scripts/fixtures/phase7-shape.js` (index "Fixture"), `scripts/portal/clickthrough-7-1.sh`
- Modify: `docs/architecture/diagrams/03d-*.puml` (AthleteAccess, account fields), `02b-*.puml` (holder use cases), `docs/architecture/13-roadmap.md` row 7 "In progress", `docs/HANDOFF.md` (phase 7-1 note)

- [ ] **Step 1: Boot.** `docker run -d --name es71-pg -e POSTGRES_PASSWORD=pg -p 127.0.0.1:55465:5432 postgres:16-alpine`; Strapi on 1385 with the index env; load the four fixtures; restart Strapi once. Expected: `select count(*) from athlete_accesses where revoked_at is null` = 4 (Ana, Matei, Ioana, Radu), the index `athlete_accesses_live_uq` exists, `portal_devices` has no null host.
- [ ] **Step 2: Click-through** `bash scripts/portal/clickthrough-7-1.sh http://127.0.0.1:1385` (curl with the BFF secret): login `parinte1@example.invalid` on `sportiv` -> 200 session; same on `antrenor` -> 401; login `antrenor1@example.invalid` on both -> 200; admin token: invite "Elena Stan" -> 409 "Confirmă sportivul întâi."; remove Matei's access then invite it again -> "Acces adăugat."; disable `antrenor1` as coach -> his sportiv refresh still 200, antrenor refresh 401. Expected: every line prints `OK`.
- [ ] **Step 3: Full suite** in a background worktree: `npx vitest run`. Expected: PASS. Then `docker rm -f es71-pg`.
- [ ] **Step 4: Commit** `git add scripts docs && git commit -m "chore(portal): phase 7 fixture, boot check and diagrams"`
