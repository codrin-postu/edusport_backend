# Phase 6b-3: Admin Roles, Docs, Boot Check and Click-Through Implementation Plan

> **Refreshed 2026-11-13** against `main` eead7cf (branch `feat/roles`). What changed:
> - Areas already exist: `AdminArea`, `ADMIN_AREAS`, `adminRoute(area)`, `areaOfRoute` in `src/club/admin-area.ts`; 29 routes already call `adminRoute` (`13-tables.ts` all `money`; `09-attendance.ts` 6 `club` + 1 `money`; `11-payments.ts` 4 `money` on `/club/money/*`; `12-portal-accounts.ts` `disable-all` `coachAccounts`; `14-athlete-access.ts` `club`). `EdusportLink.area` exists in `src/admin/dashboard/menu.tsx` (only Tabele sets it, `TABLES_AREA` from `src/club/tables/routes.ts`), and Contabilitate `TABS` carries `area: 'money'` on "Pe grupe" (`src/admin/dashboard/ContabilitatePage.tsx`); the shell ignores both "until 6b". T24 to T26 now build on these instead of adding a second `Area` type and a `guards.ts` helper.
> - The policy name moves into `adminRoute`: it emits `global::has-role`; every plain `adminGuard` / `guard` constant (about 200 routes in 30 files: `src/api/club/routes/*`, `src/api/admin-auth/routes/02-03` and 14 other admin route files) becomes `adminRoute(<area>)`. The old plan covered only `src/api/club/routes` and `admin-auth`.
> - Admin redesign ruling S1 (`docs/superpowers/specs/2026-11-12-admin-redesign-design.md` 2): menu Grupe, Sportivi, Prezență, Contabilitate, Tabele. Contabilitate has no area; its "Pe scurt" block and "Pe grupe" tab read `/club/money/*` (`money`) and are hidden without `money`; Restanțe, Abonamente and Plăți (`10-subscriptions.ts`, the plain routes of `11-payments.ts`) are `club`, not `money` as spec 9.3 had. Old money pages are redirects with no area.
> - Portal sign-in is password or Google only (user 2026-11-11; `PORTAL_2FA` off, `src/club/portal/__tests__/portal-2fa-off.test.ts`): the coach 2FA fixture, boot step and the "Cont portal" "Resetează 2FA" screen are removed. Admin 2FA and admin passkeys stay.
> - New Task 30: the Școala program edit switch on a coach account (user 2026-11-11: an admin switch only, no 2FA requirement). Nothing for it exists in code, specs or DECISIONS.
> - All tasks run sequentially on `feat/roles` in `.claude/worktrees/roles`; never push. Ports moved off the ones used since (see Global Constraints). Tests are behaviour only; vitest `--maxWorkers=3`, Playwright `--workers=1`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three admin roles ("Super Admin", "Administrator club", "Editor site") from one role map, enforced by `global::has-role` on every admin route and mirrored in the admin menus, pages and Contabilitate parts; the Școala program switch on a coach account; then the docs, a boot check on a throwaway Postgres and a click-through with screenshots for the user.

**Architecture:** `src/club/roles/map.ts` (pure, imports only `../admin-area`) holds role codes, the area table and the native permission matrix. A bootstrap creates the two EduSport roles idempotently with Strapi's admin role service. `adminRoute(area)` emits `global::has-role`, which loads the admin's roles from the database on every request and refuses with 403 when no role opens the area; a source-reading test fails when an admin route has no area. The admin bundle reads `/admin/users/me` once (`useAreas`) and hides menu entries, pages and Contabilitate parts from the same map.

**Tech Stack:** Strapi 5.52.1 admin role and permission services, Vitest 3, Playwright, Postgres 16 in Docker.

**Spec:** `docs/superpowers/specs/2026-11-07-admin-auth-roles-design.md` 9, 10.5, 14.4, 14.5; `docs/superpowers/specs/2026-11-12-admin-redesign-design.md` 2 and S1. Index: `docs/superpowers/plans/2026-11-07-phase6b-index.md` (rulings 11, 14, 16, 19 bind this plan).

**Base:** `feat/roles` from `main` eead7cf (6b-1, 6b-2, 7, 7-3, 11 and the admin redesign merged).

## Global Constraints

- Roles are read from the database on every request (`requireAdminUser` populates `roles`), never from a token claim. Several roles give the union of their areas. A role with an unknown code opens `any` only.
- Codes: `strapi-super-admin`, `edusport-club-admin` ("Administrator club"), `edusport-site-editor` ("Editor site"). Strapi's Editor and Author roles stay, unmapped. No automatic role reassignment.
- `AdminArea` and `ADMIN_AREAS` stay in `src/club/admin-area.ts`; no second area type.
- Copy exactly as given; missing copy is `COPY NEEDED` and a question for the user, never invented. Romanian, straight quotes, no em or en dash, no middle dot.
- Admin UI: only `src/admin/ui` components and tokens; `node scripts/admin-ui-check.mjs --strict` exits 0. Buttons on new admin blocks opt out of the SaveBar tagger (no "Salvează"/"Publică" label).
- Tests: behaviour only, no layout, style or screenshot assertions. `npx vitest run --maxWorkers=3`; Playwright `--workers=1`; `*-pg.test.ts` files serially. Every task: `npx tsc --noEmit` and `npx tsc --noEmit -p src/admin/tsconfig.json`.
- Throwaway Postgres only, removed afterwards: T28 `es6b3-boot-pg` 127.0.0.1:55485 / Strapi 1417; T29 `es6b3-ct-pg` 55486 / Strapi 1418. Never 1337, 1340, 1414, 1415, 3010, 5432, 55442, `edusport-test-pg`; check the port is free (`lsof -iTCP:<port> -sTCP:LISTEN`) before starting.
- Branch `feat/roles`, worktree `.claude/worktrees/roles`, tasks in order T24, T25, T26, T30, T27, T28, T29. Never push. Ledger `.superpowers/sdd/2026-11-07-phase6b-3/progress.md` (git-ignored) in this worktree.

**Risk and model:**

| Task | Risk | Model |
|---|---|---|
| 24 Role map and bootstrap | high | Sonnet |
| 25 `has-role` on every admin route | high | Sonnet |
| 26 Admin menus, page guard, Contabilitate parts | high | Sonnet |
| 30 Școala program switch on a coach account | high | Sonnet |
| 27 Docs and env example | low | Haiku |
| 28 Boot check | low | Sonnet |
| 29 Click-through with screenshots | low | Sonnet |

One review after T26 and T30 (the high tasks together), one final Opus review after T29.

## Review Focus

- **An "Editor site" admin who types a club URL** (`/admin/plugins/edusport-sportivi`, `GET /api/club/athletes`): the page shows "Nu ai acces la această pagină." without loading data and the server answers 403. Pinned by T25 (`role x route matrix`) and T26 (`page opened by URL`).
- **An admin with `club` but not `money`** (no such role today; any future role or a renamed code): Contabilitate opens on Restanțe, without "Pe scurt", without the "Pe grupe" tab, and makes no `/club/money/*` call; `?tab=pe-grupe` falls back to Restanțe. Pinned by T26 (`contabilitate parts by area`).
- **A blocked admin with a live access token**: every admin route answers 401, also the ones that were `is-admin`. Pinned by T25 (`blocked admin refused everywhere`).
- **A new admin route added later with a plain `{ policies: ['global::is-admin'] }`**: the suite fails. Pinned by T25 (`every admin route names a known area`).
- **A coach whose Școala switch is turned off while his Program tab is open**: the next write answers 403 "Nu mai ai acces la această grupă." and writes nothing. Pinned by T30 (`switch read per request`).

---

### Task 24: Role map and bootstrap (high, Sonnet)

**Files:**
- Create: `src/club/roles/map.ts`, `src/club/roles/bootstrap.ts`
- Modify: `src/index.ts` (call `bootstrapRoles` in `bootstrap`), `src/club/personal-data/roles.ts` (`SUPER_ADMIN_CODE = ROLE_CODES.superAdmin`)
- Test: `src/club/roles/__tests__/map.test.ts`, `src/club/roles/__tests__/bootstrap.test.ts`

**Interfaces:**
- Consumes: `AdminArea`, `ADMIN_AREAS` from `src/club/admin-area.ts`.
- Produces:

```ts
// map.ts (imports only '../admin-area')
export const ROLE_CODES = { superAdmin: 'strapi-super-admin', clubAdmin: 'edusport-club-admin', siteEditor: 'edusport-site-editor' } as const;
export const ROLE_NAMES = { clubAdmin: 'Administrator club', siteEditor: 'Editor site' } as const;
export const ROLE_AREAS: Readonly<Record<string, readonly AdminArea[]>>; // spec 9.2: super admin all 7; club admin all but superAdmin; site editor any, website
export function areasFor(roleCodes: readonly string[]): Set<AdminArea>; // union; 'any' always; unknown codes add nothing
export function canUse(roleCodes: readonly string[], area: AdminArea): boolean;
export function roleCodesOf(user: unknown): string[]; // `roles[].code` of an admin user row or of the `/admin/users/me` `data`
export const WEBSITE_UIDS: readonly string[]; export const CLUB_ADMIN_UIDS: readonly string[]; // index ruling 11
export const CM_ACTIONS: readonly string[];    // plugin::content-manager.explorer.{create,read,update,delete,publish}
export const MEDIA_ACTIONS: readonly string[]; // 5.52.1 upload action ids for read, create (assets.create), update, delete, download, copy link; read from node_modules/@strapi/upload/dist/server and pinned as literals
export function nativePermissions(code: 'edusport-club-admin' | 'edusport-site-editor'): { action: string; subject: string | null }[];
// bootstrap.ts
export async function bootstrapRoles(strapi: Core.Strapi): Promise<{ created: string[]; unassigned: number[] }>;
```

`bootstrapRoles`: find `admin::role` by `code`; create a missing one with its name and code; assign `nativePermissions` through the admin role service (`assignPermissions`, or the 5.52.1 name in `@strapi/admin/dist/server/server/src/services/role.js`) only when the role was just created, so a Super Admin's later edits in Settings stay. Then list active admins whose role codes contain none of the three and log one line each: `[roles] admin <id> has no EduSport role` (id only, CLAUDE.md log rule; decided by Claude, low impact). `WEBSITE_UIDS` and `CLUB_ADMIN_UIDS` as index ruling 11 after its grep; record dropped UIDs in the ledger.

- [ ] **Step 1: Failing tests** (`map.test.ts`, `bootstrap.test.ts`):
  - `describe.each` over the spec 9.2 table: `canUse([code], area)` equals the table's yes/no for every (area, role) pair.
  - `area union`: `areasFor(['edusport-site-editor', 'edusport-club-admin'])` has `club` and `website`, not `superAdmin`.
  - `areasFor(['strapi-editor'])` equals `new Set(['any'])`; `areasFor([])` equals `new Set(['any'])`.
  - `roleCodesOf({ roles: [{ code: 'a' }, { code: 'b' }] })` is `['a', 'b']`; `roleCodesOf(null)` is `[]`.
  - `nativePermissions('edusport-site-editor')` equals exactly `WEBSITE_UIDS x CM_ACTIONS` plus `MEDIA_ACTIONS` with subject null, and contains no `CLUB_ADMIN_UIDS` subject; the club admin's list is that plus `CLUB_ADMIN_UIDS x CM_ACTIONS`. Lists pinned as literals, no snapshot.
  - `map.ts` source has exactly one import, from `'../admin-area'`.
  - `bootstrap is idempotent` (fake strapi): two runs create each role once and assign permissions once; a role renamed to "Club" is found by code and not renamed back.
  - `unassigned admins`: an active admin with only `strapi-editor` is returned in `unassigned` and logged as `[roles] admin 7 has no EduSport role`; the log line holds no `@`.
- [ ] **Step 2: Run** `npx vitest run --maxWorkers=3 src/club/roles`. Expected: FAIL.
- [ ] **Step 3: Implement** the Interfaces above.
- [ ] **Step 4: Run** the same command, the whole suite and both `tsc`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(roles): role map, native permission matrix and role bootstrap`.

---

### Task 25: `global::has-role` on every admin route (high, Sonnet)

**Files:**
- Create: `src/policies/has-role.ts`, `src/club/roles/summary.ts`, `src/club/roles/__tests__/route-areas.test.ts`
- Modify: `src/club/admin-area.ts` (`adminRoute` emits `global::has-role`; `AdminRouteConfig` and `areaOfRoute` follow), `src/club/admin-auth.ts` (`requireAdminUser` refuses `blocked === true` with 401), `src/policies/is-admin.ts` and `src/policies/is-super-admin.ts` (thin wrappers of `hasRole` with `any` and `superAdmin`), `src/api/club/controllers/club.ts` (`summary` answers only the caller's areas), every route file in the table below, the doc comments naming `global::is-admin` in `src/api/*/controllers/*.ts`, `docs/superpowers/specs/2026-11-07-admin-views-design.md` 4 (ruling 19 line, only if missing)
- Test: `src/policies/__tests__/has-role.test.ts`, `src/club/roles/__tests__/role-route-matrix.test.ts`; update the tests that pin the old policy names: `src/club/__tests__/{admin-area,athlete-routes,club-admin-routes,club-routes}.test.ts`, `src/policies/__tests__/{admin-routes,is-admin}.test.ts`, `src/club/groups/__tests__/{routes,new-season-routes,schedule-routes}.test.ts`, `src/club/presence/__tests__/{attendance-routes,money-routes}.test.ts`, `src/club/documents/__tests__/routes.test.ts`, `src/club/admin-login/__tests__/security-routes.test.ts`, `src/club/personal-data/__tests__/super-admin.test.ts`, `src/club/portal/accounts/__tests__/reset-2fa.test.ts`, `src/email/__tests__/email-routes.test.ts` (and the coach and sportiv `matrix.test.ts` only where they name `global::is-admin`)

**Interfaces:**
- Consumes: `canUse`, `areasFor`, `roleCodesOf` (T24).
- Produces:
  - `adminRoute(area: AdminArea)` -> `{ auth: false, policies: [{ name: 'global::has-role', config: { area } }], middlewares: [] }`; `areaOfRoute(config)` reads `global::has-role`.
  - `hasRole(policyContext, config: { area?: unknown }, { strapi }): Promise<boolean>` (default export of `has-role.ts`): `requireAdminUser` (401 for no session, inactive, blocked); an area not in `ADMIN_AREAS` throws a plain `Error` (500; the source test prevents it); `canUse(roleCodesOf(user), area)` else Strapi `errors.ForbiddenError` (403). Before returning true it sets `policyContext.state.adminAreas = [...areasFor(codes)]`. `HAS_ROLE_ENFORCED` (index ruling 14): unset means `true` outside `NODE_ENV=production` and `false` in production; only `'true'` / `'false'` are read; off, a refusal becomes the log line `[has-role] would refuse <area> for <id>` and passes.
  - `summaryFor(counts: ClubSummary, areas: ReadonlySet<AdminArea>): Partial<ClubSummary>` in `summary.ts`, with `SUMMARY_AREAS`: `seasons` `settings`; `priceLists` `website`; `sections`, `groups`, `athletes`, `activeAthletes`, `numberedRegistrations` `club`.
- Route areas (areas already set in code stay as they are):

| Route file | Area |
|---|---|
| `club/routes/02-admin.ts` (`/club/summary`) | `any` |
| `club/routes/03-admin-prices-seasons.ts` | prices, price lists, price notes `website`; `/club/seasons*` `settings` |
| `club/routes/03-documents.ts` (2 admin routes), `04-registrations.ts`, `06-groups.ts`, `07-schedule.ts` (admin routes; `/club/schedule` stays public), `08-new-season.ts` | `club` |
| `club/routes/05-athletes.ts` | `club`; the three `superAdminGuard` routes `superAdmin` |
| `club/routes/09-attendance.ts` plain routes | `club`, except `/club/attendance/coaches.csv` `money` |
| `club/routes/10-subscriptions.ts`, `11-payments.ts` plain routes (`/club/payments*`, `/club/due`, athlete payments) | `club` (redesign S1) |
| `club/routes/12-portal-accounts.ts` | `coachAccounts` |
| `admin-auth/routes/02-security.ts` | `any` |
| `admin-auth/routes/03-admins.ts` | `superAdmin` |
| `announcement`, `club-figures`, `navigation`, `skate`, `sportsperson/02-publish` admin routes | `website` |
| `calendar-event/02-admin`, `email-job/02-admin`, `form-config/02-admin`, `partner-submission/02-admin`, `registration-submission/02-admin`, `volunteer-submission/02-admin`, `sheet-link/02-admin` | `club` |
| `dashboard/dashboard.ts` (`/analytics/summary`, `/site-health/summary`) | `any` |

  Public, portal (`src/api/portal/**`), `admin-auth/01-login.ts` and `01-public.ts` routes are untouched. The non-club areas above are decided by Claude (low impact): website content and the skate linker feed public pages; forms, sheets, calendar events and registration e-mails are club work.

- [ ] **Step 1: Failing tests**:
  - `every admin route names a known area` (`route-areas.test.ts`): imports every route module under `src/api/*/routes/`; each route either has a config without `global::has-role` and is on an allow-list of public and portal paths (the `01-*` files, `src/api/portal/**`, `/club/schedule`, the default core routers), or has exactly one `global::has-role` policy whose `area` is in `ADMIN_AREAS`; the source of no route file contains `global::is-admin` or `global::is-super-admin`.
  - `route table`: `areaOfRoute` of `GET /club/attendance/coaches.csv` is `money`; `POST /club/payments` `club`; `GET /club/money/overview` `money`; `POST /club/athletes/anonymize` `superAdmin`; `GET /club/seasons` `settings`; `GET /club/prices` `website`; `GET /admin-auth/admins` `superAdmin`; `GET /skate/events` `website`; `GET /forms/inscrieri` `club`.
  - `role x route matrix` (`role-route-matrix.test.ts`): for every admin route and each of the three roles plus "only `strapi-editor`", `hasRole` resolves true or rejects with status 403 exactly as `canUse(codes, areaOfRoute(config))` says (fake strapi: active admin per role, `HAS_ROLE_ENFORCED=true`).
  - `blocked admin refused everywhere`: `blocked: true` -> 401 from `is-admin`, `is-super-admin` and `has-role`.
  - `enforcement off`: `HAS_ROLE_ENFORCED=false`, a site editor passes `club` and exactly one line `[has-role] would refuse club for <id>` is logged; `NODE_ENV=production` with the variable unset behaves the same.
  - `adminAreas on state`: after a pass, `policyContext.state.adminAreas` of a site editor equals `['any', 'website']` (any order).
  - summary: `summaryFor(counts, new Set(['any', 'website']))` is `{ priceLists }` only; the club admin's set gives all seven keys.
  - the existing route tests now expect `global::has-role` with the table's area.
- [ ] **Step 2: Run** `npx vitest run --maxWorkers=3 src/policies src/club/roles src/club/__tests__/admin-area.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**: the policy, the wrappers, the summary filter, then each route file's constant replaced by `adminRoute(<area>)` (one import from `src/club/admin-area`), then the old-name tests and controller comments.
- [ ] **Step 4: Run** the whole suite and both `tsc`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(roles): has-role policy with an area on every admin route`.

---

### Task 26: Admin menus, page guard and Contabilitate parts (high, Sonnet)

**Files:**
- Create: `src/admin/lib/useAreas.ts`, `src/admin/ui/NoAccess.tsx`
- Modify: `src/admin/dashboard/menu.tsx` (`EdusportLink.area` required; every `addMenuLink` and `addRoute` component wrapped in `AreaGate`; comment "the shell ignores it until 6b" removed), `src/admin/pages/routes.ts` (`CustomPageRoute.area` required on every `CUSTOM_PAGES` entry), `src/admin/dashboard/EdusportShell.tsx` and `src/admin/MobileNav.tsx` (hide entries outside the areas), `src/admin/dashboard/ContabilitatePage.tsx` (hide "Pe scurt" and "Pe grupe" without `money`), `src/club/contabilitate/routes.ts` (tab fallback), callers of `useIsSuperAdmin` (`PersonalDataNotice.tsx`, `SecuritatePage.tsx`, `sportivi/AthleteRecordPage.tsx`, `sportivi/SportiviList.tsx`) move to `useAreas().has('superAdmin')`; `src/admin/dashboard/sportivi/useSuperAdmin.ts` deleted; `src/admin/dashboard/portal/AccountBlock.tsx` renders only with `coachAccounts`
- Test: `src/club/__tests__/admin-areas.test.ts` (source-reading and pure, as `ui-sheet.test.ts`), `src/club/contabilitate/__tests__/routes.test.ts`

**Interfaces:**
- Consumes: `areasFor`, `roleCodesOf` (T24); `AdminArea`; `SECURITY_ERRORS.noAccess` ("Nu ai acces la această pagină.", `src/club/security/copy.ts`).
- Produces:
  - `useAreas(): { ready: boolean; has: (a: AdminArea) => boolean }`: one `GET /admin/users/me` per page load shared through a module-level promise; `has` is false until ready; a failed read stays not ready.
  - `AreaGate({ area, children })`: nothing while not ready; `NoAccess` when ready and not allowed; `children` otherwise. The page component is not mounted until allowed, so it makes no data call.
  - `NoAccess()`: the existing `EmptyState` with the text `SECURITY_ERRORS.noAccess`, no button.
  - `visibleLinks(links: EdusportLink[], has: (a: AdminArea) => boolean): EdusportLink[]` in `menu.tsx`, used by the shell and `MobileNav`.
  - `visibleTabs(has): typeof TABS` in `ContabilitatePage.tsx`; `readContabQuery(search, today, allowed: readonly ContabTab[])` returns `restante` for a tab not in `allowed`.
- Menu and page areas (spec 9.4 with redesign S1): Formulare, Înscrieri, Voluntari, Parteneri (forms), Contact, form editor, Calendar și serii, Grupe, Sportivi (and the old profile editor redirect), Prezență, Contabilitate, the four old money redirects `club`; Tabele `TABLES_AREA` (`money`); Membri echipă, Competiții, editor competiție, Discipline, every `pages` and `content` entry and editor (Anunțuri, anunț, Sponsori, Articole, articol, Evenimente colaborare, eveniment, Momente istoric, Pagina principală, Voluntariat), Media, Meniu site `website`; Setări site, Sezoane `settings`; Panou EduSport, Securitate (ruling 16), UI reference `any`.

- [ ] **Step 1: Failing tests**:
  - `menu entries per role`: for each role's area set, `visibleLinks(EDUSPORT_LINKS, has).map((l) => l.label)` equals a literal list (Super Admin and Administrator club: all; Editor site: Membri echipă, Competiții, Discipline, the ten `pages` labels, Articole, Anunțuri, Sponsori, Evenimente colaborare, Momente istoric, Media, Meniu site, Securitate).
  - every `EDUSPORT_LINKS` and `CUSTOM_PAGES` entry has an `area` in `ADMIN_AREAS`; every `addMenuLink` and `addRoute` in `menu.tsx` source passes through `AreaGate`.
  - `page opened by URL`: `AreaGate` source returns `NoAccess` when ready and not allowed and does not render `children` before ready.
  - `contabilitate parts by area`: `visibleTabs` without `money` is Restanțe, Abonamente, Plăți; with `money` all four; `readContabQuery('?tab=pe-grupe', today, ['restante','abonamente','plati'])` gives tab `restante`; `ContabilitatePage.tsx` source calls the overview and accounting loaders only when `has('money')`.
  - no file under `src/admin` imports `useSuperAdmin` or `useIsSuperAdmin`; `AccountBlock.tsx` source gates on `coachAccounts`.
- [ ] **Step 2: Run** `npx vitest run --maxWorkers=3 src/club/__tests__/admin-areas.test.ts src/club/contabilitate`. Expected: FAIL.
- [ ] **Step 3: Implement** the Interfaces above.
- [ ] **Step 4: Run** the whole suite, both `tsc` and `node scripts/admin-ui-check.mjs --strict`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): menus, pages and Contabilitate parts hidden from the role map`.

---

### Task 30: Școala program switch on a coach account (high, Sonnet)

User 2026-11-11: the Școala edit privilege on a coach account is an admin switch only, no 2FA requirement. Today a coach writes the Program only of own Club groups (`programRight` in `src/club/portal/coach/rules.ts`: `write: access === 'own' && kind === 'club'`; coach spec 2026-11-04 line "Școala stays admin only"). Scope decided by Claude, to confirm with the user: the switch lets that coach write the Program of his **own** Școala groups with the same routes and rules as Club groups; "Program public", group name, coaches and price list stay admin only.

**Files:**
- Modify: `src/api/portal-account/content-types/portal-account/schema.json` (attribute `schoolEdit`: boolean, default false, required false), `src/club/portal/store.ts` + `strapi-store.ts` + `__tests__/fake-store.ts` (`AccountRow.schoolEdit: boolean`, written by `updateAccount`), `src/club/portal/accounts/api-types.ts` (`AccountBlock.schoolEdit: boolean`), `src/club/portal/accounts/read.ts` (`blockOf` fills it), `src/club/portal/accounts/status.ts` (`setSchoolEdit`), `src/api/club/routes/12-portal-accounts.ts` + `src/api/club/controllers/portal-accounts.ts`, `src/club/portal/copy.ts` / `copy-admin.ts` (history action and label), `src/club/portal/coach/context.ts` (`CoachState.schoolEdit`), the place `global::is-coach` builds `CoachState` (`src/policies/is-coach.ts` and its helper), `src/club/portal/coach/rules.ts`, `src/club/portal/coach/program.ts`, `src/admin/dashboard/portal/AccountBlock.tsx` + `portal/api.ts`
- Test: `src/club/portal/accounts/__tests__/school-edit.test.ts`, `src/club/portal/coach/__tests__/rules.test.ts`, `src/club/portal/coach/__tests__/program.test.ts`

**Interfaces:**
- Produces:
  - `PUT /api/club/portal-accounts/:documentId/school-edit`, body `{ on: boolean }`, `adminRoute('coachAccounts')`, answer `AccountAnswer` with toast `PORTAL_TOASTS.saved` ("Salvat."); 400 `PORTAL_ERRORS.invalid` for a body without a boolean `on`; 404 for an unknown account; a no-op (same value) answers 200 without a history line.
  - `setSchoolEdit(c: AccountContext, accountId: string, body: unknown): Promise<AdminResult<AccountAnswer>>`: inside the account lock, `updateAccount(id, { schoolEdit })` and one history line, action `PORTAL_ACTIONS.schoolEditOn` / `schoolEditOff` (text `COPY NEEDED`), actor the admin.
  - `programRight(access: GroupAccess, kind: SectionKind, schoolEdit: boolean): { read: boolean; write: boolean }`: write when `access === 'own'` and (`kind === 'club'` or `schoolEdit`).
  - `CoachState.schoolEdit: boolean`, read from the account row on every request by `is-coach` (so a switch change applies to the next request).
  - Admin: in "Cont portal", for an account in state `invited` or `active`, a `Switch` from `src/admin/ui` with label `ACCOUNT_BLOCK.schoolEdit` (`COPY NEEDED`); toggling calls the route and shows the toast. Opts out of the SaveBar tagger.
- No coach HTTP shape changes: `CoachProgram.editable` already follows `programRight`.

- [ ] **Step 1: Failing tests**:
  - `rules.test.ts`: `programRight('own', 'school', false)` -> `{ read: true, write: false }`; `('own', 'school', true)` -> write true; `('other', 'school', true)` -> write false; `('own', 'club', false)` -> write true.
  - `program.test.ts`: a coach with `schoolEdit: true` adds a weekday rule to his own Școala group (200, Istoric line with actor `Antrenor <nume>`); the same coach on another coach's Școala group -> 403 "Nu mai ai acces la această grupă."; `switch read per request`: the same request with `schoolEdit: false` -> 403 and nothing written; `GET` program of the own Școala group has `editable: true` only with the switch on.
  - `school-edit.test.ts`: on then off writes two history lines with the two actions and the admin actor; same value twice writes one; `{ on: 'yes' }` -> 400 "Cerere invalidă."; unknown id -> 404; `readAccount` answers `schoolEdit`.
  - `role-route-matrix` (T25) picks the new route up with `coachAccounts`.
- [ ] **Step 2: Run** `npx vitest run --maxWorkers=3 src/club/portal/accounts src/club/portal/coach/__tests__/rules.test.ts src/club/portal/coach/__tests__/program.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Restart Strapi twice in any boot check after the schema change (a new attribute is dropped until restart).
- [ ] **Step 4: Run** the whole suite, both `tsc` and `node scripts/admin-ui-check.mjs --strict`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(portal): admin switch lets a coach edit his Școala groups' program`.

---

### Task 27: Docs and env example (low, Haiku)

**Files:**
- Modify: `docs/architecture/08-authentication.md` (new section "Admin roles": the three roles, the area table, `has-role`, `HAS_ROLE_ENFORCED` and the deploy order; one line that the portal signs in with password or Google only and coach Școala program rights come from the account switch), `docs/architecture/13-roadmap.md` row 6 (roles built) and row 10 (drops "Staff club"), `docs/architecture/README.md` steps as it says, `.env.example` (add only `HAS_ROLE_ENFORCED` with a one-line comment; the other 6b variables are already there), `CLAUDE.md` "Where logic lives" line on admin routes (`adminRoute(area)` and `global::has-role` instead of `global::is-admin` / `global::is-super-admin`), `docs/HANDOFF.md` (6b-3 status line), `/Users/codrin/Documents/Programming/edusport_frontend/docs/portal/DECISIONS.md` (one dated entry "2026-11-13 plan 6b-3, decided by Claude (low impact)": the non-club route areas of T25, Restanțe/Abonamente/Plăți `club` per S1, bootstrap logs ids only, the T30 scope; commit in the frontend repo on its current branch, never push)
- Create: `docs/architecture/diagrams/admin-roles.puml` (PlantUML, English, the existing diagram style: request -> `has-role` -> roles from the database -> 200 or 403; admin bundle -> `useAreas` -> menu and `AreaGate`)

- [ ] **Step 1:** Write the docs.
- [ ] **Step 2:** `grep -n "—\|–\|·" docs/architecture/08-authentication.md docs/architecture/diagrams/admin-roles.puml` prints nothing.
- [ ] **Step 3:** Render the diagram with the command `docs/architecture/README.md` names; it renders without errors and the SVG is committed beside it.
- [ ] **Step 4: Commit** `docs: phase 6b admin roles` (backend), `docs(decisions): plan 6b-3 rulings` (frontend).

---

### Task 28: Fixture and boot check (low, Sonnet)

**Files:**
- Create: `scripts/fixtures/phase6b-shape.js` (style of `phase6-shape.js`, synthetic only)
- Test: the boot check itself, results in the ledger

- [ ] **Step 1: Fixture**: four admins, password `Throwaway-Admin-1`: `admin1@example.invalid` and `admin2@example.invalid` Super Admins, `admin3@example.invalid` Administrator club, `admin4@example.invalid` Editor site; `admin2` with the 2FA app on (secret sealed with the check's `AUTH_SECRET_KEY`, base32 written only to `IDS_FILE` in the scratch folder) and a backup batch (the 10 codes in the same file); coach `antrenor1@example.invalid` (`Throwaway-Coach-1`) with a portal account owning one Școala group and one Club group, `schoolEdit` false.
- [ ] **Step 2: Boot** `es6b3-boot-pg` on 55485, Strapi 1417, `HAS_ROLE_ENFORCED=true`, `ADMIN_GATE` on, `ADMIN_ORIGIN=http://localhost:1417`, `PORTAL_BFF_SECRET=test-bff-secret-000000000000000000`, `PORTAL_HOSTS=antrenor`, Brevo unset; restart twice. Check and log each:
  1. both EduSport roles exist with their codes; the bootstrap log names no fixture admin; the `portal_accounts` table has the `school_edit` column.
  2. `admin1` password login -> handoff; `GET /admin/users/me` 200.
  3. `admin2` login -> second step; TOTP from the fixture secret -> handoff; a backup code -> handoff, the same again -> 400.
  4. `admin4` (Editor site): `GET /api/club/athletes` 403, `GET /api/club/summary` 200 with `priceLists` only, `GET /api/anunturi` 200, `GET /api/club/money/overview` 403; `admin3`: athletes 200, `GET /api/club/money/overview?month=<this month>` 200, `GET /api/admin-auth/admins` 403; `admin1`: admins 200.
  5. `admin1` blocked in the database with its token still live -> `GET /api/club/summary` 401.
  6. portal: `antrenor1` password login through the BFF secret -> a session directly (no pending step); a program write on his Școala group -> 403; `admin3` `PUT /api/club/portal-accounts/<id>/school-edit` `{ on: true }` -> 200; the same write again -> 200; the Club group write -> 200 throughout.
  7. `pg_dump --data-only -t 'auth_*'` grepped for every fixture code and the base32 secret prints nothing.
  8. `tests/e2e-admin/passkeys.spec.ts` with `ADMIN_E2E_BASE=http://localhost:1417 npx playwright test --workers=1` passes (index deploy note 9).
- [ ] **Step 3:** Remove the container and its volume. Log `BOOT PASS` or the failing check.
- [ ] **Step 4: Commit** `test: phase 6b roles fixture and boot check`.

---

### Task 29: Click-through with screenshots (low, Sonnet)

**Files:**
- Create: `scripts/admin-login/clickthrough.mjs` (Playwright, `--workers=1`, pattern of the frontend `scripts/portal/clickthrough.mjs`), output in `edusport_frontend/docs/portal/mockups/screens/phase6b-clickthrough/` (commit in the frontend repo on its current branch, never push)

Screenshots are for the user to look at, not baselines; the script asserts only that each screen loaded (status and one visible text).

- [ ] **Step 1:** Start `es6b3-ct-pg` 55486, Strapi 1418 with the T28 fixture. Screens at 1280 px and 390 px, light mode, `ro-RO`, reduced motion: 01 `/login`; 02 wrong password; 03 pause after 5 tries; 04 second step app, 05 e-mail, 06 backup, 07 "Altă metodă" open; 08 expired pending; 09 passkey offer; 10 `/invite`; 11 `/forgot-password` three states; 12 Securitate (2FA off), 13 app setup with QR, 14 backup codes window, 15 Securitate with passkeys, 16 devices, 17 Administratori with the reset confirm; 18 "Cont portal" with the Școala switch off and on; 19 the menu as Super Admin, 20 as Administrator club, 21 as Editor site; 22 "Nu ai acces la această pagină." (Editor site on `/admin/plugins/edusport-sportivi`); 23 Contabilitate as Administrator club; 24 to 27 the four admin e-mails (rendered html from `renderSecurityMail`).
- [ ] **Step 2:** Write `index.html` in the output folder listing each screen with its file name; look at every crop against the approved screens and note mismatches in the ledger for the user.
- [ ] **Step 3:** Remove the container and its volume.
- [ ] **Step 4: Commit** (frontend repo) `docs: phase 6b click-through screens`.

## Self-review

- **Spec coverage.** 9.1 (T24), 9.2 (T24), 9.3 (T25 with the S1 change and the routes outside `src/api/club`), 9.4 (T26), 10.5 "Cont portal" gate (T26; the 2FA button is gone with portal 2FA), 14.4 roles tests (T25, T26), boot check (T28), 14.5 docs (T27). Redesign S1 (T25 areas, T26 Contabilitate). User 2026-11-11 switch (T30).
- **Type consistency.** `AdminArea` / `ADMIN_AREAS` (existing) are used by T24 to T26; `adminRoute` keeps its signature; `canUse`, `areasFor`, `roleCodesOf` from T24 are used in T25 and T26; `programRight` gains `schoolEdit` in T30 and its only caller is `program.ts`.
- **Review Focus.** Each line has its named test in T25, T26 or T30.
- **Open for the user.** T30 scope (own Școala groups' Program only) and the copy marked `COPY NEEDED` (switch label, two history actions).
