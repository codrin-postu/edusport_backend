# Phase 6b-3: Admin Roles, Docs, Boot Check and Click-Through Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three admin roles ("Super Admin", "Administrator club", "Editor site") from one role map, enforced by `global::has-role` on every admin route and mirrored in the admin menus and pages; then the docs, a boot check on a throwaway Postgres, and a click-through with screenshots of every 6b screen.

**Architecture:** `src/club/roles/map.ts` is pure (imported by the server and the admin bundle, as `personal-data/roles.ts` today) and holds areas, role codes and the native permission matrix. A bootstrap creates the two EduSport roles idempotently with Strapi's admin role and permission services. Every route config names one area; a source-reading test fails when one does not. The admin bundle reads `/admin/users/me` once (`useAreas`) and hides menu entries and pages from the same map.

**Tech Stack:** Strapi 5.52.1 admin role and permission services, Vitest 3, Playwright for the click-through, Postgres 16 in Docker for the checks.

**Spec:** `docs/superpowers/specs/2026-11-07-admin-auth-roles-design.md` 9, 14.4, 14.5. Index: `docs/superpowers/plans/2026-11-07-phase6b-index.md` (rulings 11, 14, 16, 19 bind this plan; boot check table).

**Base:** `feat/athletes` with plans 6b-1 and 6b-2 merged.

**Global Constraints:** every line of plan 6b-1 "Global Constraints" holds here, plus:
- Roles are read from the database on every request (`requireAdminUser` populates `roles`), never from a token claim. An admin with several roles gets the union of their areas. A role with an unknown code opens `any` only.
- Codes: `strapi-super-admin`, `edusport-club-admin` ("Administrator club"), `edusport-site-editor` ("Editor site"). Strapi's Editor and Author roles stay, unmapped. No automatic role reassignment.
- Boot check `es6b2-pg` 55470 / Strapi 1392; click-through `es6b3-pg` 55471 / Strapi 1393. Never 55442, 1337, 1340, 3010, 5432.
- Ledger `p3be/.superpowers/sdd/2026-11-07-phase6b-3/progress.md`; board lines `6b-3 T<n>`.

**Risk and model:**

| Task | Risk | Model | Batch |
|---|---|---|---|
| 24 Role map and bootstrap | high | Sonnet | B7 |
| 25 `has-role` on every route | high | Sonnet | B7 |
| 26 Admin menus and page guard | high | Sonnet | B7 |
| 27 Docs and env example | low | Haiku | final |
| 28 Boot check | low | Sonnet | final |
| 29 Click-through with screenshots | low | Sonnet | final |

One final Opus review of this plan after T29. **Parallel groups:** A: T24 | B: T25, T26 | C: T27, T28 | D: T29.

## Review Focus

- **An "Editor site" admin who types a club URL** (`/admin/plugins/edusport-sportivi`, `GET /api/club/athletes`): the page says "Nu ai acces la această pagină." and the server answers 403. Pinned by T25 (`role x route matrix`) and T26 (`page opened by URL`).
- **An admin with two roles** (Editor site and Administrator club): sees and may use the union. Pinned by T24 (`area union`) and T25.
- **A blocked admin with a live access token**: every admin route answers 401, also the ones behind `is-admin` (today only the Super Admin policy refused). Pinned by T25 (`blocked admin refused everywhere`).
- **A new admin route added later without an area** (phase 11, a quick fix): the suite fails. Pinned by T25 (`every admin route names a known area`).
- **A Strapi restart after a role was renamed in Settings**: the bootstrap finds roles by code, never duplicates or renames them back. Pinned by T24 (`bootstrap is idempotent`).

---

### Task 24: Role map and bootstrap (high, Sonnet)

**Files:**
- Create: `src/club/roles/map.ts`, `src/club/roles/bootstrap.ts`
- Modify: `src/index.ts` (bootstrap call), `src/club/personal-data/roles.ts` (re-export `SUPER_ADMIN_CODE` from `map.ts`)
- Test: `src/club/roles/__tests__/map.test.ts`, `bootstrap.test.ts`

**Interfaces:**

```ts
export type Area = 'any' | 'website' | 'club' | 'money' | 'coachAccounts' | 'settings' | 'superAdmin';
export const AREAS: readonly Area[];
export const ROLE_CODES = { superAdmin: 'strapi-super-admin', clubAdmin: 'edusport-club-admin', siteEditor: 'edusport-site-editor' } as const;
export const ROLE_NAMES = { clubAdmin: 'Administrator club', siteEditor: 'Editor site' } as const;
export const ROLE_AREAS: Record<string, readonly Area[]>; // spec 9.2 table
export function areasFor(roleCodes: readonly string[]): Set<Area>; // union; unknown codes give 'any'
export const canUse = (roleCodes: readonly string[], area: Area): boolean;
export const WEBSITE_UIDS: readonly string[]; export const CLUB_ADMIN_UIDS: readonly string[]; // index ruling 11
export const CM_ACTIONS: readonly string[]; // plugin::content-manager.explorer.{create,read,update,delete,publish}
export const MEDIA_ACTIONS: readonly string[]; // the 5.52.1 upload action ids for read, create, update, delete, download and copy link, read from node_modules/@strapi/upload/dist/server and pinned as literals
export function nativePermissions(code: 'edusport-club-admin' | 'edusport-site-editor'): { action: string; subject: string | null }[];
// bootstrap.ts
export async function bootstrapRoles(strapi: Core.Strapi): Promise<{ created: string[]; unassigned: string[] }>; // logs one line per admin without an EduSport role
```
`bootstrapRoles`: find `admin::role` by `code`; create the missing one with its name and code (spike T1 fact; FAIL 3 path: by name, index "The gate"); assign `nativePermissions` with the admin role service (`assignPermissions` or the 5.52.1 name; read `@strapi/admin/dist/server/server/src/services/role.js`) only when the role was created, so a Super Admin's later edits in Settings stay; list active admins whose roles contain none of the three codes: `[roles] admin <id> <e-mail> has no EduSport role` (spec 14.5 step 6 checklist). `WEBSITE_UIDS` and `CLUB_ADMIN_UIDS` exactly as index ruling 11, after the grep it names (record the dropped UIDs in the ledger).

- [ ] **Step 1: Failing tests**: the spec 9.2 table as a `describe.each` over (area, role) pairs with the yes/no of the spec; `area union` (`['edusport-site-editor', 'edusport-club-admin']` opens `club` and `website`, not `superAdmin`); unknown code opens `any` only; `nativePermissions('edusport-site-editor')` holds exactly `WEBSITE_UIDS x CM_ACTIONS` plus `MEDIA_ACTIONS` and no club UID; club admin adds `CLUB_ADMIN_UIDS`; the matrix is pinned as a snapshot-free literal list; `map.ts` source has no `import`. Bootstrap with a fake strapi: `bootstrap is idempotent` (run twice: two roles created once, permissions assigned once; a renamed role is found by code and not renamed back); unassigned admins logged by id and e-mail.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc, `tsc -p src/admin`).
- [ ] **Step 5: Commit** `feat(roles): role map, native permission matrix and role bootstrap`.

---

### Task 25: `global::has-role` on every admin route (high, Sonnet)

**Files:**
- Create: `src/policies/has-role.ts`, `src/api/club/__tests__/route-areas.test.ts` (S41)
- Modify: `src/policies/is-admin.ts`, `src/policies/is-super-admin.ts` (thin wrappers), every file in `src/api/club/routes/02-*.ts` to `13-*.ts` that exists, `src/api/admin-auth/routes/02-security.ts`, `03-admins.ts`, `src/api/club/controllers/club.ts` (summary by area; read where `club.summary` lives), `src/club/admin-auth.ts` (`requireAdminUser` refuses `blocked: true`), `docs/superpowers/specs/2026-11-07-admin-views-design.md` (index ruling 19 line)
- Test: `src/policies/__tests__/has-role.test.ts`, `src/club/__tests__/role-route-matrix.test.ts`, update `club-summary.test.ts`

**Interfaces:**
- Produces: route config `policies: [{ name: 'global::has-role', config: { area: '<area>' } }]` on every admin route; `hasRole(policyContext, config, { strapi })`: `requireAdminUser` (401 for no session, inactive, blocked), then `canUse(roleCodes, area)` else Strapi `ForbiddenError` (403); with `HAS_ROLE_ENFORCED=false` (index ruling 14) it logs `[has-role] would refuse <area> for <id>` and passes. `adminGuard(area)` helper in `src/api/club/routes/guards.ts` replaces the per-file `adminGuard` constants. Areas per spec 9.3 for the files that exist on this branch: `02-admin.ts` `any` (the summary answers only the counts of the caller's areas); `03-admin-prices-seasons.ts` price lists and price notes `website`, seasons `settings`; `03-documents.ts` admin routes, `04-registrations.ts`, `05-athletes.ts`, `06-groups.ts`, `07-schedule.ts` admin routes, `08-new-season.ts`, `09-attendance.ts` `club`, except `/club/attendance/coaches.csv` `money`; `05-athletes.ts` Super Admin routes `superAdmin`; `10-subscriptions.ts`, `11-payments.ts` `money`; `12-portal-accounts.ts` `coachAccounts`; `admin-auth` `02` `any`, `03` `superAdmin`. Public, portal and `01-login` routes are untouched.
- [ ] **Step 1: Failing tests**:
  - `every admin route names a known area`: reads every route file under `src/api/club/routes` and `src/api/admin-auth/routes/0[23]-*.ts`; each route either has `auth: false` with no policy and is in the public allow-list (`01-public.ts` paths), or has exactly one `global::has-role` policy whose `area` is in `AREAS`; no `global::is-admin` left in route files.
  - `role x route matrix`: for every admin route and each of the three roles plus "no EduSport role", the policy answers pass or 403 as `canUse` says (fake strapi with an active admin per role).
  - `blocked admin refused everywhere`: `blocked: true` -> 401 on `is-admin`, `is-super-admin` and `has-role`.
  - `HAS_ROLE_ENFORCED=false`: a site editor passes `club` and one log line is written.
  - summary: a site editor's `GET /club/summary` answer carries only `website` and `any` counts.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc).
- [ ] **Step 5: Commit** `feat(roles): has-role policy with an area on every admin route`.

---

### Task 26: Admin menus and the page guard (high, Sonnet). After Task 0

**Files:**
- Create: `src/admin/lib/useAreas.ts`, `src/admin/ui/NoAccess.tsx`
- Modify: `src/admin/dashboard/menu.tsx` (every `EDUSPORT_LINKS` entry and every `addMenuLink` names `area`), `src/admin/dashboard/EdusportShell.tsx` (hides entries), each page component reached from a menu entry (wraps its body in `<AreaGate area="...">`), `src/admin/dashboard/sportivi/useSuperAdmin.ts` (removed; callers move to `useAreas().has('superAdmin')`), `src/admin/dashboard/portal/AccountBlock.tsx` ("Resetează 2FA" and the whole block need `coachAccounts`), `src/admin/pages/securitate/AdminsSection.tsx` (`superAdmin`)
- Test: `src/club/__tests__/admin-areas.test.tsx`

**Interfaces:**
- Produces: `useAreas(): { ready: boolean; has: (a: Area) => boolean }` (one `/admin/users/me` read per page load, shared by a module-level promise; `has` is false until ready); `AreaGate({ area, children })` renders "Nu ai acces la această pagină." when ready and not allowed, nothing while loading. Menu to area per spec 9.4: Formulare, Înscrieri, Voluntari, Parteneri (forms), Contact, Calendar și serii, Grupe, Sportivi, Prezență `club`; Abonamente, Plăți, De încasat `money`; Membri echipă, Competiții, Discipline and every `pages` and `content` entry, Media, Meniu site `website`; Setări site, Sezoane `settings`; Panou EduSport and Securitate `any`.
- [ ] **Step 1: Failing tests**: `menu entries per role`: for each role the rendered shell shows exactly the entries of its areas (a table of labels per role); every `EDUSPORT_LINKS` entry has an `area` in `AREAS` (source and value check); `page opened by URL` without the area shows "Nu ai acces la această pagină." and makes no data call; no file imports `useIsSuperAdmin`; the "Cont portal" block is absent for a site editor.
- [ ] **Step 2: Run** FAIL. **Step 3: Implement.** **Step 4: Run** PASS (suite, tsc, `tsc -p src/admin`).
- [ ] **Step 5: Commit** `feat(admin): menus and pages hidden from the role map`.

---

### Task 27: Docs and env example (low, Haiku)

**Files:**
- Modify: `docs/architecture/08-authentication.md` (admin sessions through Strapi's manager, our page, the gate, keys and rotation, the 5.6 leak table, rpId now and after the move, roles; the AAL2 note of spec 17.9), `docs/architecture/13-roadmap.md` rows 6 and 10 (10 loses "Staff club"), `docs/architecture/README.md` steps as they say, `.env.example` (`AUTH_SECRET_KEY`, `AUTH_CODE_KEY`, `ADMIN_HOST`, `ADMIN_ORIGIN`, `ADMIN_GATE`, `HAS_ROLE_ENFORCED`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGINS`, `WEBAUTHN_MOVED_AT`, each with a one-line comment and no value for the keys), `/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/DECISIONS.md` (Security index lines and the index rulings as "plan 6b, decided by Claude (low impact, 2026-11-07)"; commit in the frontend repo on its current branch)
- Create: `docs/architecture/diagrams/admin-login.puml`, `docs/architecture/diagrams/second-step.puml` (PlantUML, English, the existing diagram style)
- [ ] **Step 1:** Write the docs. **Step 2:** `grep -rn "verificare în doi pași\|—\|–\|·" docs/architecture/08-authentication.md docs/architecture/diagrams/admin-login.puml docs/architecture/diagrams/second-step.puml` prints nothing. **Step 3:** Render both diagrams with the command the architecture README names; they render without errors.
- [ ] **Step 4: Commit** `docs: phase 6b admin login, 2FA, passkeys and roles` (backend), `docs(decisions): phase 6b plan rulings` (frontend).

---

### Task 28: Fixture and boot check (low, Sonnet)

**Files:**
- Create: `scripts/fixtures/phase6b-shape.js` (style of `phase6-shape.js`)
- Test: the boot check itself, results in the ledger

- [ ] **Step 1: Fixture**: the four synthetic admins of the index (two Super Admins, one per EduSport role), password `Throwaway-Admin-1`; `admin2@example.invalid` with 2FA app on (secret sealed with the check's `AUTH_SECRET_KEY`, the base32 written only to the fixture's `IDS_FILE` in the scratch folder) and a backup batch (the 10 codes written to the same file); coach `antrenor1@example.invalid` with 2FA app on likewise.
- [ ] **Step 2: Boot** on `es6b2-pg` 55470, Strapi 1392, the index env; restart once. Check and log each:
  1. the six new tables exist; `auth_factors_subject_kind_uq` exists; the two roles exist with their codes; the bootstrap log names no admin (all assigned).
  2. `POST /admin/login`, `/admin/register`, `/admin/register-admin`, `/admin/reset-password`, `/admin/forgot-password` -> 404; `GET /admin/auth/login` -> 302 `/intrare`; `GET /intrare` -> 200 html.
  3. `admin1` password login -> handoff; `GET /admin/users/me` with the token -> 200; `POST /admin/access-token` rotates.
  4. `admin2` login -> `SecondStep`; TOTP from the fixture secret -> handoff; the same code again on a new pending -> 400; a backup code -> handoff, again -> 400.
  5. `admin4` (Editor site) -> `GET /api/club/athletes` 403, `GET /api/club/summary` 200 with website counts only; `admin3` -> athletes 200, `GET /api/admin-auth/admins` 403.
  6. portal: `antrenor1` login through the BFF secret -> `PortalPending`; `/portal/auth/2fa` with TOTP -> session; Securitate `GET /portal/me/security` lists `totp: true`, no secret in the body.
  7. a dump (`pg_dump --data-only -t auth_*`) grepped for every fixture code and the base32 secrets prints nothing.
  8. `npm run admin:reset-2fa -- admin2@example.invalid` prints `2FA reset: admin2@example.invalid`; the next login of admin2 gets a handoff without the step.
  9. the passkey Playwright spec of 6b-2 T22 against this instance (`ADMIN_E2E_BASE=http://localhost:1392`) passes.
- [ ] **Step 3:** Remove the container. Log `BOOT PASS` or the failing check.
- [ ] **Step 4: Commit** `test: phase 6b fixture and boot check`.

---

### Task 29: Click-through with screenshots (low, Sonnet)

**Files:**
- Create: `scripts/admin-login/clickthrough.mjs` (Playwright, pattern of the frontend `scripts/portal/clickthrough.mjs`), output in `edusport_frontend/docs/portal/mockups/screens/phase6b-clickthrough/` (commit in the frontend repo on its current branch)

- [ ] **Step 1:** Start `es6b3-pg` 55471, Strapi 1393 with the T28 fixture. Screens at 1280 px and 390 px, light mode, `ro-RO`, reduced motion: 01 `/intrare`; 02 wrong password text; 03 pause after 5 tries; 04 second step app, 05 e-mail, 06 backup, 07 "Altă metodă" open; 08 expired pending; 09 offer; 10 `/intrare/invitatie`; 11 `/intrare/parola` three states; 12 Securitate (2FA off), 13 app setup with QR, 14 backup codes window, 15 Securitate with passkeys and an old key, 16 devices with the 2FA line, 17 Administratori with the reset confirm; 18 "Cont portal" with "Resetează 2FA" and its confirm; 19 the menu as Super Admin, 20 as Administrator club, 21 as Editor site; 22 "Nu ai acces la această pagină."; 23 to 26 the four e-mails (rendered html from `renderSecurityMail`).
- [ ] **Step 2:** Write `index.html` in the output folder listing each screen with its file name; check every crop by eye against Task 0's approved screens (memory rule: review crops, no rebaseline); log mismatches in the ledger.
- [ ] **Step 3:** Remove the container.
- [ ] **Step 4: Commit** (frontend repo) `docs: phase 6b click-through screens`.

## Self-review

- **Spec coverage.** 9.1 (T24), 9.2 (T24), 9.3 (T25, with the phase 11 line), 9.4 (T26), 14.4 roles tests (T25, T26), boot check (T28), 14.5 docs (T27), deploy steps (index). Companion round: index Task 0.
- **Step scan.** The bootstrap rule "assign permissions only on create" is the one behaviour fixed here beyond the spec; it keeps Super Admin edits in Settings.
- **Type consistency.** `Area`, `AREAS`, `canUse` (T24) are used by T25 and T26; the `area` config key is the same in the policy, the route test and the menu.
- **Review Focus.** Each line has its named test in T24, T25, T26.
