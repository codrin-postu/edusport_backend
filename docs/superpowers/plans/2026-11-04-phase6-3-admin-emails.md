# Phase 6-3: Account Admin, Invite Mail and Housekeeping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The admin side of coach accounts: the invite e-mail as a queued job (`portal-invite`), the e-mail change mail, the account services (invite, resend, disable, enable, change e-mail) with their Istoric lines, the admin routes `12-portal-accounts.ts`, the team member delete hook, the daily purge, the "Cont portal" block in the admin, and the updated diagrams.

**Architecture:** Services in `src/club/portal/accounts/` on the 6-1 `PortalStore` and `PortalSessions`, one transaction each, account row locked first. The invite mail rides the existing e-mail job queue exactly as the `payment` kind does (composer, payload guard, retry cron); the e-mail change mail is a 6-1 direct send. Admin UI is thin: a "Cont portal" block in the "Membri echipă" editor (`src/admin/dashboard/MembriEchipaPage.tsx`) and the same block from the group page coaches line, importing only `accounts/api-types.ts` and `copy-admin.ts`.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS), React admin (`src/admin`, shared `../ui`), Postgres 16, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-11-04-coach-portal-design.md`: 3.6, 3.7 (account lines), 4.1, 4.3, 6.3, 10.1, 11, 12 (invite and e-mail change), 14.4 step 7 (diagrams). Index: `docs/superpowers/plans/2026-11-04-phase6-index.md`. Plan 6-1 "Interfaces for other plans".

**Base:** `feat/athletes` with plan 6-1 merged. Runs in parallel with plan 6-2.

**Parallel groups:** A: T1 | B: T2 | C: T3, T4 | D: T5, T6 | E: T7

| Group | Tasks | Runs after | Files |
|---|---|---|---|
| A | 1 Invite and e-mail change mails | 6-1 | `src/email/portal-email.ts`, `src/email/email-jobs.ts`, `src/email/strapi-email.ts`, `src/api/email-job/content-types/email-job/schema.json`, `src/email/portal-direct.ts` (one kind), `src/club/portal/copy-admin.ts`, one line in `copy.ts` |
| B | 2 Account services | 1 | `src/club/portal/accounts/{api-types,read,invite,status,email}.ts` |
| C | 3 Admin routes, 4 Delete hook and purge | 2 | 3: `src/api/club/routes/12-portal-accounts.ts`, `src/api/club/controllers/portal-accounts.ts`; 4: `src/club/portal/accounts/team-member-hook.ts`, `src/club/portal/purge.ts`, `src/index.ts`, `config/cron-tasks.ts` |
| D | 5 "Cont portal" admin block, 6 Diagrams | 3 | 5: `src/admin/dashboard/portal/**`, `MembriEchipaPage.tsx`, `grupe/GroupPage.tsx`; 6: `docs/architecture/**` |
| E | 7 Boot check | all | none (ledger only) |

**Risk and model:**

| Task | Risk | Model |
|---|---|---|
| 1 Mails and job kind | low | Haiku |
| 2 Account services | high (disable revokes sessions, account takeover by e-mail change) | Sonnet |
| 3 Admin routes | high (permissions) | Haiku |
| 4 Delete hook and purge | high (data loss) | Sonnet |
| 5 "Cont portal" block | low | Sonnet |
| 6 Diagrams | low | Haiku |
| 7 Boot check | low | Sonnet |

## Global Constraints

- Everything in plan 6-1 "Global Constraints". Boot check: `es63-pg` on 127.0.0.1:55463, Strapi on 1383. Ledger `p3be/.superpowers/sdd/2026-11-04-phase6-3/progress.md`.
- Admin rules (HANDOFF): admin `npx tsc -p src/admin --noEmit` 0 errors; admin code imports only server-free `src/club` modules (`accounts/api-types.ts`, `copy-admin.ts`, `copy.ts`); refusals come back in the `FetchError` shape the shared admin fetch helpers already read (`error.message`). UI rules: no pills or circles, no dashed or dotted lines, shared `../ui` components, toasts with `adminToast`; a custom button labelled "Salvează" opts out of the SaveBar tagger (memory: SaveBar gotcha) by not carrying the `.pce` class pattern the tagger hides.
- Copy exact from spec 10.1, 11, 12; every new string in `src/club/portal/copy-admin.ts`.
- Lock order: portal account row, then its tokens and devices; the team member is read, never locked (it is public content).
- Disabling (4.3) is one transaction: account `disabled`, user `blocked`, every device row revoked; then `sessions.revokeAll(userId)`; a failure in `revokeAll` is logged and retried once, the account stays disabled (the policy refuses a disabled account anyway).
- Files this plan may touch: listed in the parallel groups table. Nothing else.

## Review Focus

- **E-mail change to an address that already has an account, or to the same address in other case**: refused with "Adresa are deja un cont."; the same address in other case is no change. Pinned by Task 2 (`email change refuses a taken address`, `email change ignores case`).
- **Disable while the coach is mid-request**: the account is disabled, every session revoked, the next coach request answers 403 or 401, a refresh answers 401. Pinned by Task 2 (`disable revokes every session and device`) and Task 7.
- **Resend after the coach already accepted**: refused (account not `invited`), no mail queued. Pinned by Task 2 (`resend refuses an active account`).
- **Deleting a team member with an account**: the account is disabled first and keeps its rows (history, devices purge later); deleting one without an account changes nothing. Pinned by Task 4.
- **Purge removing a live lock or a live device**: only unlocked limit rows older than 24 h, devices revoked more than 30 days ago, and used or expired tokens older than 30 days go. Pinned by Task 4 (`purge keeps a running lock`, `purge keeps devices revoked 29 days ago`).

---

### Task 1: Invite mail (queued) and e-mail change mail (low, Haiku)

**Files:**
- Create: `src/email/portal-email.ts`, `src/club/portal/copy-admin.ts`
- Modify: `src/email/email-jobs.ts` (`EmailJobKind` gains `'portal-invite'`, composer branch), `src/email/strapi-email.ts` (`KINDS`, payload guard, an `attemptPortalInvite(strapi, jobId)` like `attemptPaymentEmails` without the hold), `src/api/email-job/content-types/email-job/schema.json` (enum value), `src/email/portal-direct.ts` (`PortalMail` gains `{ kind: 'email-changed'; newEmail: string }`), `src/club/portal/copy.ts` (one `export *` line)
- Test: `src/email/__tests__/portal-email.test.ts`

**Interfaces:**
- Produces:

```ts
// copy-admin.ts (server-free)
export const INVITE_MAIL = {
  subject: 'Contul tău EduSport de antrenor', greeting: (name: string) => `Bună ziua, ${name},`,
  line: (host: string) => `Ai un cont pe ${host}.`, button: 'Intră în cont', valid: 'Linkul este valabil 7 zile.', signature: 'Echipa EduSport',
};
export const EMAIL_CHANGED_MAIL = {
  subject: 'Adresa contului tău de antrenor s-a schimbat',
  line: (email: string) => `Adresa contului tău a fost schimbată în ${email}.`, advice: 'Dacă nu ai fost tu, anunță administratorul.',
};
export const ACCOUNT_BLOCK = {
  title: 'Cont portal', emailLabel: 'E-mail pentru cont', invite: 'Trimite invitația',
  invited: (date: string) => `Invitație trimisă pe ${date}.`, resend: 'Retrimite invitația',
  active: (date: string) => `Cont activ din ${date}.`, disable: 'Dezactivează contul',
  disabled: 'Cont dezactivat.', enable: 'Activează contul',
  changeEmail: 'Schimbă e-mailul', newEmail: 'E-mail nou', saveEmail: 'Salvează e-mailul',
};
export const ACCOUNT_TOASTS = { invited: 'Invitație trimisă.', disabled: 'Cont dezactivat.', enabled: 'Cont activat.', emailChanged: 'E-mail schimbat.' };
// portal-email.ts
export type PortalInvitePayload = { name: string; link: string; host: string };
export function isPortalInvitePayload(v: unknown): v is PortalInvitePayload;
export function renderPortalInvite(input: { payload: PortalInvitePayload; links: EmailLinks }): RenderedEmail;
export function portalInviteJob(i: { recipient: string; accountId: string; payload: PortalInvitePayload }, now: Date): NewPortalInviteJob; // kind 'portal-invite', status queued, sendAfter now
export const inviteLink = (siteHost: string, secret: string): string => `https://${siteHost}/invite/${secret}`;
```
`siteHost` = `antrenor.` + the registrable host of `publicSiteUrl()` (e.g. `antrenor.scoaladepatinaj.com`); locally `antrenor.localhost:3010` over `http` when `publicSiteUrl()` is `http://localhost:3010` (one helper `portalHost(siteUrl): { host: string; origin: string }`, tested for both).
- [ ] **Step 1: Failing tests**: subject and text of the invite (`"Bună ziua, Andreea Pascu,"`, `"Ai un cont pe antrenor.scoaladepatinaj.com."`, button href the link, `"Linkul este valabil 7 zile."`, `"Echipa EduSport"`); the e-mail change direct mail texts; `isPortalInvitePayload` refuses a missing link; the job composer picks the invite renderer for kind `portal-invite`; outside production the job is sent to the test address only (existing `deliveryTarget`); the email-job schema enum contains `portal-invite`; `portalHost` for production and local URLs.
- [ ] **Step 2: Run** `npx vitest run src/email/__tests__/portal-email.test.ts`. FAIL.
- [ ] **Step 3: Implement**, following every place the `payment` kind is handled (`grep -n "'payment'" src/email/*.ts`), without the payment hold, `onSent` history line or Sheet sync.
- [ ] **Step 4: Run** tests, suite, tsc, admin tsc. PASS.
- [ ] **Step 5: Commit** `feat(email): portal invite job and e-mail change mail`.

---

### Task 2: Account services (high, Sonnet)

**Files:**
- Create: `src/club/portal/accounts/api-types.ts`, `read.ts`, `invite.ts`, `status.ts`, `email.ts`
- Test: `src/club/portal/accounts/__tests__/accounts.test.ts`

**Interfaces:**
- Consumes: 6-1 `PortalStore`, `PortalSessions`, `normalizeEmail`, `newInviteSecret`, `hashSecret`, `INVITE_TTL_MS`, `PORTAL_ACTIONS`, `PORTAL_ERRORS.emailTaken`, `SendPortalMail`; T1 `portalInviteJob`, `inviteLink`, `portalHost`; `adminActor`.
- Produces:

```ts
// api-types.ts (server-free)
export type AccountState = 'none' | 'invited' | 'active' | 'disabled';
export type AccountBlock = { teamMemberId: string; accountId: string | null; state: AccountState; email: string | null; since: string | null; google: boolean };
// since: invitedAt for invited, activatedAt for active, disabledAt for disabled (YYYY-MM-DD, Bucharest); the UI formats it
export type AccountAnswer = { account: AccountBlock; toast: string };
// services
export type AccountContext = { store: PortalStore; sessions: PortalSessions; actor: string; now: () => Date; log: (m: string) => void;
  queueInvite: (job: NewPortalInviteJob) => Promise<string>; afterCommit: (jobId: string) => void; mail: SendPortalMail; hash: (p: string) => Promise<string> };
export function accountContext(strapi: Core.Strapi, ctx: AdminCtx): Promise<AccountContext>;
export async function readAccount(c: AccountContext, teamMemberId: string): Promise<AdminResult<AccountBlock>>;
export async function inviteAccount(c: AccountContext, teamMemberId: string, body: unknown): Promise<AdminResult<AccountAnswer>>;
export async function resendInvite(c: AccountContext, accountId: string): Promise<AdminResult<AccountAnswer>>;
export async function disableAccount(c: AccountContext, accountId: string): Promise<AdminResult<AccountAnswer>>;
export async function enableAccount(c: AccountContext, accountId: string): Promise<AdminResult<AccountAnswer>>;
export async function changeEmail(c: AccountContext, accountId: string, body: unknown): Promise<AdminResult<AccountAnswer>>;
```
- `inviteAccount` (4.1): team member must exist (404); it must have no account (else 409 `"Datele s-au schimbat. Reîncarcă pagina."`, phase 3 `ADMIN_ERRORS.stale`); e-mail normalized (400 `invalid`); taken by any account -> 409 `emailTaken`; transaction: U&P user with a null password hash (6-1 `createUser` is widened to `passwordHash: string | null` in both stores, with a parity case; `loginWithPassword` already compares against `DUMMY_HASH` for a null hash), so a Google-only coach shows `hasPassword: false` in 6-2 `readMe`, account `invited`, `invitedAt`, `invitedBy` = admin name, invite token, the `portal-invite` job, history `inviteSent` `{ email }`; after commit `afterCommit(jobId)`. Toast `"Invitație trimisă."`.
- `resendInvite`: account must be `invited` (409 stale otherwise); older invite tokens used, new token, new job, history `inviteResent`. Not counted by the per-e-mail mail cap (5.4).
- `disableAccount` (4.3): `invited` or `active` -> `disabled`, `disabledAt`, `disabledBy`, user `blocked`, devices revoked, unused tokens used, history `disabled`; `sessions.revokeAll(userId)` runs inside the disable transaction (account lock held, nested transaction reused), not after commit, so a failure cannot leave sessions live for a later enable to revive (final review M3). Already disabled: no change, same answer.
- `enableAccount`: `disabled` -> `active` when `activatedAt` is set, else back to `invited`; user unblocked; history `enabled`. Toast `"Cont activat."`.
- `changeEmail` (10.1, ruling of spec "decided by Claude"): normalized new e-mail; equal to the current one -> no change, same toast; taken -> 409 `emailTaken`; transaction: account and user e-mail and username updated, history `emailChanged` `{ from, to }`; after commit `mail(old, { kind: 'email-changed', newEmail })` and `mail(new, ...)`, failures logged only. When the account is `invited`: older invites used and a new invite queued to the new address. Open `reset` tokens of the account are used up in the same transaction, so a code sent to the old address stops working.
- [ ] **Step 1: Failing tests**: each rule above, plus `disable revokes every session and device` (fake sessions record `revokeAll(userId)`; device rows have `revokedAt`), `revokeAll runs inside the disable transaction` (a `revokeAll` that throws rolls the disable back: account still active), `invite creates the user with a null hash`, `email change uses up an open reset token`, `resend refuses an active account`, `email change refuses a taken address`, `email change ignores case`, the history texts through `portalHistoryText` with actor = admin e-mail name, and `readAccount` for each state.
- [ ] **Step 2 to 4**: run FAIL, implement, run PASS plus suite, tsc, admin tsc.
- [ ] **Step 5: Commit** `feat(portal): coach account invite, resend, disable, enable and e-mail change`.

---

### Task 3: Admin routes (high, Haiku)

**Files:** Create `src/api/club/routes/12-portal-accounts.ts`, `src/api/club/controllers/portal-accounts.ts`. Test: `src/club/portal/accounts/__tests__/account-routes.test.ts`.

- [ ] **Step 1: Failing test**: routes exactly

```ts
['GET /club/team-members/:documentId/account', 'POST /club/team-members/:documentId/account/invite',
 'POST /club/portal-accounts/:documentId/resend', 'POST /club/portal-accounts/:documentId/disable',
 'POST /club/portal-accounts/:documentId/enable', 'POST /club/portal-accounts/:documentId/email']
```
each `config: { auth: false, policies: ['global::is-admin'], middlewares: [] }`, handlers exist (`portal-accounts.<name>`), `staticBeforeParams` true; each handler maps the service result with `respond`.
- [ ] **Step 2: Run**, FAIL. **Step 3: Implement** (one-line handlers: `respond(ctx, await inviteAccount(await accountContext(strapi, ctx), param(ctx, 'documentId'), ctx.request.body))`). **Step 4: Run** tests, suite, tsc. PASS.
- [ ] **Step 5: Commit** `feat(portal): admin routes for coach accounts`.

---

### Task 4: Team member delete hook and daily purge (high, Sonnet)

**Files:**
- Create: `src/club/portal/accounts/team-member-hook.ts`, `src/club/portal/purge.ts`
- Modify: `src/index.ts` (bootstrap: subscribe the hook), `config/cron-tasks.ts` (task `portalPurge`)
- Test: `src/club/portal/accounts/__tests__/hook-purge.test.ts`

**Interfaces:**
- Produces:

```ts
export function subscribeTeamMemberHook(strapi: Core.Strapi): void; // strapi.db.lifecycles.subscribe({ models: ['api::team-member.team-member'], beforeDelete, beforeDeleteMany })
export async function disableForTeamMembers(c: AccountContext, teamMemberIds: string[]): Promise<number>; // disableAccount for each linked account not disabled; actor 'sistem'
export async function purgePortal(store: PortalStore, now: Date): Promise<{ limits: number; devices: number; tokens: number; sessions: number }>;
```
- Unique link (final review M3, spec 3.2): the bootstrap also creates a unique index on `portal_accounts_team_member_lnk.team_member_id` (idempotent `CREATE UNIQUE INDEX IF NOT EXISTS`, like `ensurePresenceIndexes`), so two admins inviting one team member at once cannot make two accounts; `inviteAccount` maps the unique violation to 409 `stale`. Test (PG-gated store test): a second link row for one team member is refused; the index function is idempotent.
- The hook resolves the documentIds being deleted (`event.params.where`), runs `disableForTeamMembers`, and lets the delete go on; the account keeps `teamMember` pointing at nothing (Strapi clears the relation), which `canEnter` already refuses. A hook failure throws, so the delete is refused rather than leaving an active account (spec S8).
- `portalPurge` cron: rule `{ hour: 3, minute: 30, tz: 'Europe/Bucharest' }` (Strapi cron object form), calls `purgePortal(strapiPortalStore(strapi), new Date())` and logs the counts; ruling 16 for what goes. `PortalStore` gains `purgeDevices(revokedBefore: Date)`, `purgeTokens(before: Date)` and `purgeSessions(before: Date)` (removes `portal_sessions` rows revoked or expired more than 30 days ago; both stores, parity cases added to the 6-1 store test file).
- [ ] **Step 1: Failing tests**: delete hook with an active account: account `disabled`, sessions revoked, history line actor `"sistem"`; without an account: no write; `purge keeps a running lock`; purge removes an unlocked row of 25 h ago and keeps one of 23 h ago; `purge keeps devices revoked 29 days ago`, removes 31 days; `purge removes sessions revoked or expired 31 days ago and keeps a live one and one ended 29 days ago`; tokens used 31 days ago removed, an unused valid invite kept.
- [ ] **Step 2 to 4** as above.
- [ ] **Step 5: Commit** `feat(portal): disable the account on team member delete; daily portal purge`.

---

### Task 5: "Cont portal" block in the admin (low, Sonnet)

**Files:**
- Create: `src/admin/dashboard/portal/AccountBlock.tsx`, `src/admin/dashboard/portal/api.ts`
- Modify: `src/admin/dashboard/MembriEchipaPage.tsx` (the editor modal of an existing member shows the block under the form), `src/admin/dashboard/grupe/GroupPage.tsx` (the coaches line: each coach name opens a `Window` with the same block)
- Test: `src/club/__tests__/admin-portal-block.test.ts` (source-reading test, as the other `admin-*.test.ts`)

**Interfaces:**
- Consumes: T2 `AccountBlock`, `AccountAnswer`; T1 `ACCOUNT_BLOCK`, `ACCOUNT_TOASTS`; shared `../ui` (`Button`, `Field`, `Input`, `Window`, `adminToast`, `Loading`); `useFetchClient`.
- Ruling 22: spec 10.1 says "Content Manager injection", but the team member editor is the custom "Membri echipă" page (`MembriEchipaPage.tsx` replaces the collection view, `menu.tsx:153`); the block goes there. Log it.
- Block states (spec 10.1): `none`: field "E-mail pentru cont" + button "Trimite invitația"; `invited`: "Invitație trimisă pe <dată>." + "Retrimite invitația"; `active`: "Cont activ din <dată>." + "Dezactivează contul" (asks with `ConfirmDialog`, title "Dezactivează contul", text left to the companion round as `COPY NEEDED` constant in `copy-admin.ts`); `disabled`: "Cont dezactivat." + "Activează contul"; every state but `none`: "Schimbă e-mailul" opening "E-mail nou" + "Salvează e-mailul". Dates shown with the admin's existing short date format (`d mmm yyyy`). Toasts from the answer's `toast`. Refusals shown with the answer's message.
- [ ] **Step 1: Failing source test**: `AccountBlock.tsx` imports only from `react`, `@strapi/admin/strapi-admin`, `../ui`, `../ConfirmDialog`, `./api`, and the server-free `src/club/portal/accounts/api-types` and `src/club/portal/copy-admin`; contains no `border-radius: 50%`, `9999px`, `dashed`, `dotted`; uses every `ACCOUNT_BLOCK` key; `MembriEchipaPage.tsx` and `GroupPage.tsx` render `AccountBlock`.
- [ ] **Step 2: Run**, FAIL. **Step 3: Implement.** **Step 4: Run** test, suite, `npx tsc -p src/admin --noEmit`. PASS.
- [ ] **Step 5: Render** desktop (1440) and phone (390) of the four states and the e-mail change window on the local throwaway admin (boot of Task 7 or `es63-pg`), saved as `edusport_frontend/docs/portal/mockups/screens/phase6-renders/6-3-cont-portal-*.png` for the companion round.
- [ ] **Step 6: Commit** `feat(admin): Cont portal block on team members and group coaches`.

---

### Task 6: Diagrams (low, Haiku)

**Files:** Modify `docs/architecture/diagrams/` 02c (coach use cases) and 03d (accounts); create the login and refresh sequence diagram; follow `docs/architecture/README` steps (PlantUML, English) [memory: architecture docs].

- [ ] **Step 1:** 03d: `PortalAccount` without `role`, with `teamMember` (0..1), `PortalToken`, `PortalDevice`, `PortalAuthLimit` (and `PortalSession` only if 6-1 took Task 5B, read the 6-1 ledger), U&P `User`.
- [ ] **Step 2:** 02c: coach use cases of spec 9 (Azi, presence, stand-in, lessons, add athlete, "Sportiv nou", Istoric, Program, Profil, Securitate); admin use cases of 10.1.
- [ ] **Step 3:** sequence `05x-portal-login-refresh.puml`: browser, BFF, Strapi auth routes, session manager, DB; login, refresh rotation, coach request with `is-coach`, logout.
- [ ] **Step 4:** render with the README command; check the PNGs open. **Step 5: Commit** `docs(architecture): phase 6 accounts, coach use cases, login and refresh sequence`.

---

### Task 7: Boot check (low, Sonnet)

- [ ] **Step 1:** `es63-pg` / 1383 with `phase4-shape.js`, `phase5-shape.js`, `phase6-shape.js`; an admin from the fixture; restart once.
- [ ] **Step 2:** with an admin token: invite a third synthetic coach `antrenor3@example.invalid` on a fixture team member; the `portal-invite` job is queued and (Brevo unset) waits; read its payload link; accept through `/portal/auth/invite/accept` (secret header); disable from the admin route; the coach access token now answers 403 or 401 on `/portal/coach/me` and refresh answers 401; enable; log in again; change e-mail to `antrenor3b@example.invalid`; log in with the new address; delete the team member through the content manager API and see the account `disabled`.
- [ ] **Step 3:** run `purgePortal` from `npx strapi console` and log the counts. Log every result in the ledger; remove the container. No commit (ledger only).

## Self-review

- **Spec coverage.** 3.6 invite kind (T1), 4.1 (T2), 4.3 (T2, T4), 6.3 (T3), 10.1 (T5; 10.2 needs no change, pinned in 6-2), 11 admin-made lines (T2, T4), 12 invite and e-mail change (T1), 14.4 step 7 (T6), S3 purge (T4), S8 (T4).
- **Step scan.** Exact copy is written out; service bodies left to the implementer with their rules.
- **Type consistency.** `AccountBlock` and `AccountAnswer` (T2) are the index contract's; `PortalMail` gains one kind (T1) consumed by T2.
- **Review Focus.** Each line has its named test in T2 and T4, plus the T7 boot run.
