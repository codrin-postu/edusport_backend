# Phase 6b-2: Portal 2FA and Passkeys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The coach's second step after a password login or a reset, the coach Securitate 2FA routes and "Resetează 2FA" on "Cont portal", and passkeys for admins and coaches (sign-in by button and autofill, Securitate list, the one-time offer, the domain-move script).

**Architecture:** The portal reuses the 6b-1 security core with `Subject { type: 'portal', id: accountDocumentId }`; `loginWithPassword` and `confirmReset` end in the second step instead of `startSession` when the account has a method. Passkeys are one module `src/club/security/passkeys.ts` over `@simplewebauthn/server` 14.0.3, called by both route sets; the admin sign-in ends in `finishAdminLogin`, the coach sign-in in `startSession`.

**Tech Stack:** Strapi 5.52.1, `@simplewebauthn/server` exactly 14.0.3, `@simplewebauthn/browser` exactly 14.0.0 (admin bundles), Vitest 3, Playwright (CDP virtual authenticator) for the admin passkey test.

**Spec:** `docs/superpowers/specs/2026-11-07-admin-auth-roles-design.md` 3.4, 3.7, 6, 7, 8, 10.5, 11, 12, 13. Index: `docs/superpowers/plans/2026-11-07-phase6b-index.md` (contracts and rulings binding). Plan 6b-1 "Interfaces for other plans" lists what this plan consumes.

**Base:** `feat/athletes` with plan 6b-1 merged. The frontend plan starts after T21 is merged.

**Global Constraints:** every line of plan 6b-1 "Global Constraints" holds here, plus:
- Portal routes keep the phase 6 rules: the BFF secret first (`isBffCall`, 403 `"Forbidden"` before anything else), the client IP from `x-portal-client-ip`, the device key from the body or `x-portal-device`; the pending secret travels in the body (`pending`), never in a URL.
- WebAuthn (8.2): `rpName` "EduSport", `rpID` = `WEBAUTHN_RP_ID`, `expectedOrigin` = the exact list `WEBAUTHN_ORIGINS` (comma separated, trimmed, no wildcard), user handle `webauthnUserId` (never the e-mail or a database id), `attestationType: 'none'`, `residentKey: 'required'`, `userVerification: 'required'`, algorithms ES256 (-7) and RS256 (-257), `excludeCredentials` the subject's keys, sign-in discoverable (no `allowCredentials`), challenge single use for 5 minutes in `auth_challenges` (MAC of the challenge, purpose `passkey-register` or `passkey-login`). At most 10 keys per subject. A passkey sign-in skips password and 2FA, does not count toward the e-mail lockout, counts toward the IP rule.
- Ledger `p3be/.superpowers/sdd/2026-11-07-phase6b-2/progress.md`; board lines `6b-2 T<n>`.

**Risk and model:**

| Task | Risk | Model | Batch |
|---|---|---|---|
| 18 Portal second step, keyed reset code | high | Sonnet | B5 |
| 19 Portal Securitate 2FA routes, "Resetează 2FA" | high | Sonnet | B5 |
| 20 Passkey core | high | Sonnet | B6 |
| 21 Passkey routes, offer flag | high | Sonnet | B6 |
| 22 Passkey UI in `/login` and admin Securitate | high | Sonnet | B6 |
| 23 Domain move script, old keys | high | Haiku | B6 |

Batch B5 also holds 6b-1 T17; one final Opus review of this plan after T23.

**Parallel groups:** A: T18, T20 | B: T19, T21 | C: T22, T23. T19 and T21 both add lines to `03-security.ts`; merge T19 first.

## Review Focus

- **A coach with 2FA on resets the password** ("Am uitat parola"): the reset lands on the second step, not in the app; the old sessions are gone. Pinned by T18 (`reset then 2FA`).
- **A passkey made on the admin host used on the coach host** (one person, both roles): refused with "Cheia nu este pentru această pagină.", no session. Pinned by T21 (`wrong kind refused`).
- **An assertion from another `codrin.space` app** (analytics, atelier): refused by the origin list. Pinned by T20 (`foreign origin refused`).
- **A cloned authenticator replaying an old counter** (counter goes down on a non-synced key): refused; a synced key with counter 0 always works. Pinned by T20 (`counter`).
- **The offer after the domain move**: shown once more to subjects whose keys are all on the old rpId, never to a subject with a new key. Pinned by T23 (`cutover clears the offer flag only for old-only subjects`).

---

## File Structure

```
src/club/portal/auth/login.ts, reset.ts, issue.ts     second step and offerPasskey (T18)
src/club/portal/auth/two-factor.ts                    portalSecondStep, portalSendCode (T18)
src/club/portal/tokens.ts                             reset code MAC (T18)
src/api/portal/routes/01-auth.ts, controllers/portal-auth.ts   2fa and passkey routes (T18, T21)
src/api/portal/routes/03-security.ts, controllers/portal-security.ts   (T19, T21)
src/club/portal/security.ts                           portal security context and handlers (T19)
src/club/portal/accounts/reset-2fa.ts                 admin "Resetează 2FA" (T19)
src/api/club/routes/12-portal-accounts.ts, controllers/portal-accounts.ts   (T19)
src/admin/dashboard/portal/AccountBlock.tsx           "Resetează 2FA" button (T19)
src/club/security/passkeys.ts                         rpConfig, registerOptions, verifyRegister, loginOptions, verifyLogin, passkeyRows (T20)
src/club/admin-login/passkey.ts                       admin passkey sign-in (T21)
src/admin-login/screens/Login.tsx, Offer.tsx, src/admin/pages/securitate/PasskeysSection.tsx   (T22)
scripts/passkeys-cutover.ts                           (T23)
```

---

### Task 18: Portal second step and the keyed reset code (high, Sonnet)

**Files:**
- Create: `src/club/portal/auth/two-factor.ts`
- Modify: `src/club/portal/auth/login.ts`, `reset.ts`, `issue.ts`, `context.ts` (adds `security: SecurityContext`), `src/club/portal/tokens.ts`, `01-auth.ts`, `controllers/portal-auth.ts`
- Test: `src/club/portal/__tests__/two-factor.test.ts`; update `login.test.ts`, `reset.test.ts`, `auth-routes.test.ts`

**Interfaces:**
- Consumes: 6b-1 `hasTwoFactor`, `openPending`, `verifySecondStep`, `sendLoginCode`, `rememberUntil`, `isRemembered`, `codeMac`, `macMatchesAny`.
- Produces:

```ts
export type PortalPending = SecondStep & { pending: string; deviceKey: string | null }; // deviceKey: the key of the unconfirmed device row made at the password step; the BFF stores it at once and sends it back with the code (index contract)
export async function afterPassword(c: PortalAuthContext, account: AccountRow, deviceKey: string | null, host: string): Promise<PortalResult<(PortalSession & { offerPasskey: boolean }) | PortalPending>>;
export async function portalSecondStep(c: PortalAuthContext, body: unknown): Promise<PortalResult<PortalSession & { offerPasskey: boolean }>>;
export async function portalSendCode(c: PortalAuthContext, body: unknown): Promise<PortalResult<CodeSent>>;
export async function offerPasskeyFor(c: PortalAuthContext, account: AccountRow): Promise<boolean>; // no key on the current rpId and passkeyOfferedAt null
```
`afterPassword`: `hasTwoFactor` empty or the bound device (by `hashSecret(deviceKey)`) has a valid `twoFactorUntil` -> `startSession` plus `offerPasskey`; keys missing and 2FA on -> 503; else `openPending` with `deviceKeyHash`, answer `PortalPending`. `loginWithPassword` and `confirmReset` call it where they called `startSession` (reset: after `revokeAll`, S17). Google login and invite accept keep `startSession` and add `offerPasskey`. `portalSecondStep` body `{ pending, method, code, remember, deviceKey? }`: `verifySecondStep`; the device key must hash to `data.deviceKeyHash` when one was bound (else 401 `pendingExpired`); `lastMethod`; `remember` -> `setPortalDeviceTwoFactor(device, rememberUntil(now))`; `startSession`. Reset code: `requestReset` stores `codeMac(keys, 'reset-code', 'portal', accountId, code)` in `portal_tokens.secretHash` (prefix `m1:<keyId>:` before the hex so a SHA-256 row is never read as a MAC); `confirmReset` checks with `macMatchesAny`; keys missing -> reset request and confirm answer 503 `"2FA nu este disponibil acum."` (spec 5.1 fail closed); an old SHA-256 row never matches (cutover ruling, no shim). Routes: `POST /portal/auth/2fa`, `POST /portal/auth/2fa/email`, `bffGuard`.

- [ ] **Step 1: Failing tests**:
  - password login with 2FA on -> `PortalPending` (`pending` 43 chars, `methods`, `last`, `email`), no session row created.
  - `portalSecondStep` right TOTP -> session, `offerPasskey` true for an account with no key; with `remember` the device row gets `twoFactorUntil` + 30 days; the next login with that device key skips the step.
  - another device key than the one bound -> 401 `"Intrarea a expirat. Intră din nou."`.
  - `reset then 2FA`: a right reset code on an account with 2FA -> every old session revoked, answer `PortalPending`; the password is changed.
  - Google login of an account with 2FA -> session (skips).
  - a stored reset token row holds `m1:` and no 6-digit string; a row stored as plain SHA-256 before the deploy -> `badCode`.
  - keys missing, account without 2FA -> password login works; with 2FA -> 503.
  - routes: both new paths exist, BFF secret required (403 without, no store call), order test updated.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc).
- [ ] **Step 5: Commit** `feat(portal): 2FA step after password login and reset, keyed reset code`.

---

### Task 19: Portal Securitate 2FA routes and "Resetează 2FA" (high, Sonnet). Admin button after Task 0

**Files:**
- Create: `src/api/portal/routes/03-security.ts`, `src/api/portal/controllers/portal-security.ts`, `src/club/portal/security.ts`, `src/club/portal/accounts/reset-2fa.ts`
- Modify: `src/api/club/routes/12-portal-accounts.ts`, `src/api/club/controllers/portal-accounts.ts`, `src/club/portal/accounts/api-types.ts` (`twoFactor: boolean`), `src/club/portal/accounts/read.ts`, `src/club/portal/coach/me.ts` (devices gain `twoFactorUntil`), `src/club/portal/coach/api-types.ts`, `src/admin/dashboard/portal/AccountBlock.tsx`, `src/admin/dashboard/portal/api.ts`
- Test: `src/club/portal/__tests__/security-routes.test.ts`, `src/club/portal/accounts/__tests__/reset-2fa.test.ts`, update `src/club/__tests__/admin-portal-block.test.ts`

**Interfaces:**
- Consumes: 6b-1 `factors.ts`, `resetTwoFactor`; `global::is-coach` gives the account (read `src/policies/is-coach.ts` for where it leaves it on `ctx.state`).
- Produces: the portal Securitate rows of the index except the passkey rows (T21), each `{ auth: false, policies: ['global::is-coach'], middlewares: [] }`; `resetPortalTwoFactor(c, accountId, adminName)` for `POST /club/portal-accounts/:documentId/reset-2fa` (`global::is-admin` until T25 sets area `coachAccounts`). `SecurityContext.endSessions` for the portal = `sessions.revokeAll(userId)`; `forgetDevices` clears `twoFactorUntil` on the account's devices. Admin block: "Resetează 2FA" shown when `twoFactor`, confirm "Resetezi 2FA pentru <nume>? Toate dispozitivele vor fi deconectate.", toast "2FA resetat.", `.pce` on the buttons; it shows for every admin in this task, and T26 hides it without `coachAccounts`.
- [ ] **Step 1: Failing tests**: each route needs the BFF secret and a coach Bearer (403 / 401 otherwise); enrol app then confirm returns 10 codes once and `GET security` never returns them or the secret; `DELETE` the last method deletes codes; the 409 of ruling 2; admin reset: methods and codes gone, sessions revoked, devices forgotten, history `"2FA resetat de <nume admin>."` on `portalAccount`, mail to the coach, passkeys kept, `AccountBlock.twoFactor` false after; `GET /portal/coach/me/devices` rows carry `twoFactorUntil`; the admin block renders the button only when `twoFactor` and posts to the reset path.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc, `tsc -p src/admin`).
- [ ] **Step 5: Commit** `feat(portal): coach Securitate 2FA routes and admin Resetează 2FA`.

---

### Task 20: Passkey core (high, Sonnet)

**Files:**
- Create: `src/club/security/passkeys.ts`
- Modify: `package.json` (`"@simplewebauthn/server": "14.0.3"`), `.env.example` (`WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGINS` with the local values and a comment that the production values are deploy-time)
- Test: `src/club/security/__tests__/passkeys.test.ts`

**Interfaces:**

```ts
export type RpConfig = { rpId: string; origins: string[] };
export function rpConfig(env?: NodeJS.ProcessEnv): RpConfig | null; // null when either is missing; routes answer 503
export type PasskeyOwner = { subject: Subject; userHandle: string; userName: string }; // userHandle = webauthnUserId
export async function registerOptions(c: SecurityContext, rp: RpConfig, o: PasskeyOwner): Promise<PortalResult<PasskeyRegisterOptions>>; // 409 passkeyLimit at 10 keys on any rpId
export async function verifyRegister(c: SecurityContext, rp: RpConfig, o: PasskeyOwner, response: unknown, name: string): Promise<PortalResult<PasskeyRow>>;
export async function loginOptions(c: SecurityContext, rp: RpConfig): Promise<PortalResult<PasskeyLoginOptions>>;
export type PasskeyLogin = { subject: Subject; passkeyId: string };
export async function verifyLogin(c: SecurityContext, rp: RpConfig, kind: SubjectType, response: unknown): Promise<PortalResult<PasskeyLogin>>;
export async function passkeyRows(c: SecurityContext, rp: RpConfig, s: Subject): Promise<PasskeyRowView[]>; // `old` = rpId differs from rp.rpId, newest first
export async function renamePasskey(...), deletePasskey(...); // owner check, 404 otherwise; delete writes history and no mail
```
`verifyRegister`: the challenge is read from `response.clientDataJSON` (base64url JSON `challenge`), looked up by MAC with purpose `passkey-register` for that subject, `consumeOnce`; `verifyRegistrationResponse` with `expectedChallenge`, `expectedOrigin: rp.origins`, `expectedRPID: rp.rpId`, `requireUserVerification: true`; store credential id, public key (base64url), counter, transports, `deviceType`, `backedUp`, `rpId`, `name`; history `"Cheie de acces creată: <nume>."`; mail `changed` with the passkey name (S26). `verifyLogin`: challenge by MAC with purpose `passkey-login`, `consumeOnce`; credential by id: none -> 401 `passkeyFailed`; owner kind differs from `kind` -> 401 `passkeyOtherKind`; `rpId` differs from the current one -> 401 `passkeyFailed`; `verifyAuthenticationResponse` with the stored key and counter; counter saved, `lastUsedAt`. Any throw from the library -> 401 `passkeyFailed`, logged without the response body.

- [ ] **Step 1: Failing tests** with a software authenticator built in the test (P-256 key pair via `node:crypto`, hand-built `attestationObject` with `fmt: 'none'` and `authenticatorData` with UV and BE/BS flags; a helper `__tests__/soft-authenticator.ts`): register then sign in -> `PasskeyLogin` for the right subject; `foreign origin refused` (`https://atelier.codrin.space`); wrong rpId hash refused; a challenge used twice refused; an expired challenge (5 minutes + 1 s) refused; `counter`: stored 5, assertion 3 on a single-device key -> 401, synced key with 0 and 0 -> accepted; the 11th register -> 409 `"Ai deja 10 chei de acces. Șterge una ca să adaugi alta."`; `excludeCredentials` lists the subject's keys; user handle in the options is `webauthnUserId`, never the e-mail; a stored row holds no private material (only `publicKey`); `rpConfig` null -> the caller's 503.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc).
- [ ] **Step 5: Commit** `feat(security): passkey registration and sign-in (WebAuthn, discoverable)`.

---

### Task 21: Passkey routes and the offer flag (high, Sonnet)

**Files:**
- Create: `src/club/admin-login/passkey.ts`, `src/club/portal/auth/passkey.ts`
- Modify: `src/api/admin-auth/routes/01-login.ts`, `02-security.ts`, `controllers/admin-auth.ts`, `src/api/portal/routes/01-auth.ts`, `03-security.ts`, `controllers/portal-auth.ts`, `controllers/portal-security.ts`, `src/club/admin-login/login.ts` (`offerPasskey` in `finishAdminLogin`), `src/club/security/factors.ts` (`securityView.passkeys`)
- Test: `src/club/admin-login/__tests__/passkey-routes.test.ts`, `src/club/portal/__tests__/passkey-routes.test.ts`

**Interfaces:**
- Consumes: T20; 6b-1 `finishAdminLogin`; `startSession`, `canEnter`.
- Produces: the passkey rows of the index tables (admin and portal). Admin sign-in: `verifyLogin(kind 'admin')`, `adminById`, `canEnterAdmin` false -> 401 `passkeyFailed`; `finishAdminLogin(admin, rememberMe, { newDeviceMail: true, passkey: true })` (`offerPasskey: false`). Portal sign-in: `verifyLogin(kind 'portal')`, account by documentId, `canEnter(host)` false -> 401 `passkeyFailed`; `startSession`. Register on Securitate: the owner from the session (`ensureAdminAccount` or the portal account's `webauthnUserId`, created on first need), `userName` the e-mail, name default ruling 4. `passkey-offer/dismiss` and a successful register set `passkeyOfferedAt`. `offerPasskey` = no key on the current rpId and `passkeyOfferedAt` null. IP rule on options and verify.
- [ ] **Step 1: Failing tests** (soft authenticator of T20): `wrong kind refused` (admin key on `/portal/auth/passkey/verify` -> 401 `"Cheia nu este pentru această pagină."` and the reverse); admin sign-in issues the Strapi session and skips 2FA for an admin with 2FA on; a blocked admin's key -> 401 `"Nu am putut folosi cheia de acces."`; a disabled coach's key -> same; the portal routes need the BFF secret; register from Securitate then `GET security` lists the key, `old: false`; rename to 61 characters -> 400; delete of another subject's key -> 404; `offerPasskey` true after a password login with no key, false after dismiss, false after register; the e-mail lockout counter is untouched by a failed passkey; the 31st passkey attempt from one IP -> 429.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc).
- [ ] **Step 5: Commit** `feat(auth): passkey sign-in and Securitate routes for admin and coach`.

---

### Task 22: Passkey UI in `/login` and the admin Securitate page (high, Sonnet). After Task 0

**Files:**
- Create: `src/admin-login/passkey.ts`, `src/admin-login/screens/Offer.tsx`, `src/admin/pages/securitate/PasskeysSection.tsx`, `tests/e2e-admin/passkeys.spec.ts` (Playwright, run against the T28 boot instance only, skipped without `ADMIN_E2E_BASE`)
- Modify: `package.json` (`"@simplewebauthn/browser": "14.0.0"`), `src/admin-login/screens/Login.tsx`, `src/admin-login/App.tsx` (`/login/passkey`), `src/admin/pages/SecuritatePage.tsx`
- Test: `src/admin-login/__tests__/passkey-ui.test.tsx`, `src/club/__tests__/admin-securitate-passkeys.test.tsx`

**Interfaces:**
- Consumes: the admin passkey contracts; `browserSupportsWebAuthn`, `browserSupportsWebAuthnAutofill`, `platformAuthenticatorIsAvailable`, `startAuthentication`, `startRegistration` from `@simplewebauthn/browser`.
- Produces: Login: "Folosește cheia de acces" under "Intră" and autofill on "E-mail" (`autocomplete="username webauthn"`, conditional mediation started on mount, aborted when the button flow starts), both only when supported; cancel or failure -> "Nu am putut folosi cheia de acces."; the server's 401 text shown as sent. Offer (`/login/passkey`, after a handoff with `offerPasskey` and `platformAuthenticatorIsAvailable()`): title "Creează o cheie de acces", line "Intri cu amprenta, fața sau codul telefonului, fără parolă.", "Creează" and "Nu acum"; both end in `/admin` (dismiss posts first). The offer runs after `storeHandoff` stored the token and before `location.assign`, using the access token for the `me/passkeys` calls. Securitate "Chei de acces": rows "<nume>", "Creată <dată>, folosită <dată>", "Redenumește" (field "Nume"), "Șterge"; old rows "Cheie veche, nu mai merge. Creează una nouă." with "Șterge" only; button "Creează o cheie de acces" on supporting devices; toasts of 11.3.
- [ ] **Step 1: Failing tests** with `@simplewebauthn/browser` mocked: the button and autofill render only when supported; a cancelled `startAuthentication` shows the failure text; the offer shows once and both buttons call dismiss or register then go to `/admin`; Securitate lists keys and old keys with the right texts and buttons; every button has `.pce`. Playwright spec (CDP `WebAuthn.addVirtualAuthenticator`, `ctap2`, `internal`, `hasResidentKey`, `hasUserVerification`, `isUserVerified`): password login, offer "Creează", logout, sign in by the button, then by autofill; wrong origin is covered by T20.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc, `tsc -p src/admin`, the bundle build). The Playwright spec runs in T28.
- [ ] **Step 5: Commit** `feat(admin-login): passkey button, autofill, offer and Securitate list`.

---

### Task 23: Domain move script and old keys (high, Haiku)

**Files:**
- Create: `scripts/passkeys-cutover.ts`, `src/club/security/cutover.ts`
- Modify: `src/club/security/strapi-store.ts` and the memory store (`purgeOldPasskeys(rpId, before)`), `src/club/portal/purge.ts` (calls it when `WEBAUTHN_MOVED_AT` is set), `package.json` (`"passkeys:cutover"`), `docs/architecture/08-authentication.md` (runbook section, spec 8.6 steps 1 to 6)
- Test: `src/club/security/__tests__/cutover.test.ts`

**Interfaces:**
- Produces: `planCutover(store, currentRpId): Promise<{ perRpId: Record<string, number>; subjectsToOffer: Subject[] }>`, `applyCutover(store, plan): Promise<number>` (clears `passkeyOfferedAt` for those subjects; deletes nothing). Script: `npm run passkeys:cutover -- --dry-run` prints the counts and the subject count; without the flag applies and prints the same. Purge: when `WEBAUTHN_MOVED_AT` (ISO date) is set, keys whose `rpId` differs from `WEBAUTHN_RP_ID` and that are older than `WEBAUTHN_MOVED_AT` + 30 days are deleted.
- [ ] **Step 1: Failing tests**: `cutover clears the offer flag only for old-only subjects` (subject A only old keys -> cleared; B one old one new -> kept; C no keys -> untouched); dry run changes nothing; purge removes old-rpId keys only after 30 days and never a current-rpId key.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc).
- [ ] **Step 5: Commit** `feat(security): passkey domain-move script and old-key purge`.

## Interfaces for other plans

- The frontend plan consumes the index contracts only: `PortalPending`, `/portal/auth/2fa`, `/2fa/email`, `/passkey/options`, `/passkey/verify`, `/portal/me/*`, `offerPasskey`, `CoachDevice.twoFactorUntil`.
- Plan 6b-3 sets the areas of `02-security.ts` (`any`), `03-admins.ts` (`superAdmin`), the reset-2fa route (`coachAccounts`) and hides the "Resetează 2FA" button without `coachAccounts`.

## Self-review

- **Spec coverage.** 3.4 (T20), 3.7 (T18, T19), 6 portal side (T18, T19), 6.6 portal and "Cont portal" (T19), 7.1 (T18, T19, T21), 8.1 to 8.4 (T20 to T22), 8.5 env (T20), 8.6 (T23), 10.5 (T19), 11 server side (T19, T21), 12 changed mail (T20), 13 passkey lines (T20, T21). Coach screens: frontend plan.
- **Step scan.** The verify order of T20 and the `afterPassword` branch of T18 are the only bodies the plan fixes; the rest are signatures and tests.
- **Type consistency.** `PortalPending` (T18) = index `SecondStep & { pending }`; `PasskeyLogin` (T20) used by T21; `offerPasskey` computed in one place per side (`offerPasskeyFor`, `finishAdminLogin`).
- **Review Focus.** Each line has its named test in T18, T20, T21, T23.
