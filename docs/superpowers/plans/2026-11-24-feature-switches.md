# Feature switches (Funcții) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five club-wide feature switches (Prezență, Abonamente și plăți, Portalul antrenorilor, Portalul părinților, Parcurs și insigne) on a Super Admin page "Funcții"; a disabled feature disappears from the admin, the portals and the e-mails, and its routes refuse, without touching data.

**Architecture:** One pure module (`src/club/features/`) owns the keys, defaults, dependency rule and copy. The backend stores the choice in a new single type, checks it in the existing `has-role` policy (admin), a new portal policy (portal API) and the e-mail sender. The admin reads it once (`useFeatures`) next to `useAreas` and filters menu, pages and in-page spots through pure filters. The frontend portals read the effective set from the portal `/me` payload.

**Tech Stack:** Strapi 5.52 (TypeScript), React admin (src/admin), Vitest; Next.js 15 frontend, node:test (`scripts/**/*.test.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-24-feature-switches-design.md` (approved 2026-11-24) and `docs/superpowers/specs/2026-11-24-feature-switches-inventory.md` (file list per feature).

## Global Constraints

- Backend worktree `edusport_backend/.claude/worktrees/features`, branch `feat/feature-switches` (based on `chore/env-cleanup`). Frontend: new worktree `edusport_frontend/.claude/worktrees/features`, branch `feat/feature-switches` from frontend `chore/env-cleanup` (Task 9 creates it).
- Backend code rules (CLAUDE.md): no `any`, single quotes, semicolons, functions under 30 lines, complexity under 10, rules in `src/club/**` with Vitest next to them, admin components thin, admin UI only `src/admin/ui` components and tokens, `node scripts/admin-ui-check.mjs --strict` exits 0.
- Feature keys exactly: `prezenta`, `abonamente`, `portalAntrenori`, `portalParinti`, `parcurs`.
- Missing row, missing key or non-boolean value = active. Effective portal = installed (backend `PORTAL_HOSTS` lists `antrenor` / `sportiv`) AND active.
- `abonamente` requires `prezenta`: switching `prezenta` off switches `abonamente` off in the same save; enabling `abonamente` while `prezenta` is off is refused (409 `needsPrezenta`). Enabling a portal that is not installed is refused (409 `notInstalled`).
- Disabled admin route: 403, error details `{ code: 'featureOff', feature }`. Role is checked first. Disabled portal (whole host): 404. Disabled feature route inside an active portal: 404.
- Disabling never deletes or edits data. Queued e-mail jobs of a disabled feature become `cancelled`; job kinds: `payment` -> `abonamente`, `portal-invite` -> `portalAntrenori`, `portal-access` -> `portalParinti`.
- All Romanian copy verbatim from spec section 7 (page, card, intro, five descriptions, dependent line, not-installed line, footer "Mereu active: ...", five warning dialogs with title "Dezactivezi <nume>?", buttons "Anulează" / "Dezactivează"). Coach portal description ends at "sportivii" when `prezenta` is off.
- Copy rules: no em or en dash, no middle dot, no emoji, straight quotes. Visual rules: no pills or circles, no dashed lines, flat buttons.
- Tests are behaviour tests only (no layout or wording snapshots). Commits: Conventional Commits, no AI attribution, never push.
- Machine load: `npx vitest run <files>` per task; full suite once at the end with `--maxWorkers=3`.

## Review Focus

1. A Club admin (not Super Admin) sends `PUT /club/features` while `HAS_ROLE_ENFORCED=false`: must still get 403 (the `superAdmin` area is always enforced). Test in Task 3.
2. `prezenta` switched off while `abonamente` is on: one save turns both off, history and response list `abonamente` in `alsoOff`, and queued `payment` jobs are cancelled. Test in Task 3.
3. A `payment` job already queued when `abonamente` goes off, then picked by the hourly retry: cancelled at claim time, never sent. Test in Task 3.
4. Direct address of a disabled admin page (`/admin/plugins/...prezenta`): NoAccess screen, no data call. Test in Task 6 (pure gate decision).
5. A parent with an open portal session when `portalParinti` goes off: the next API call answers 404, and the frontend shows its not-found page, not a crash. Tests in Task 4 (backend) and Task 9 (frontend nav and guard).

---

### Task 1: Pure features module and copy

**Files:**
- Create: `src/club/features/features.ts`, `src/club/features/copy.ts`, `src/club/features/__tests__/features.test.ts`

**Interfaces:**
- Produces:
  - `type FeatureKey = 'prezenta' | 'abonamente' | 'portalAntrenori' | 'portalParinti' | 'parcurs'`; `const FEATURE_KEYS: readonly FeatureKey[]` (that order, the page order).
  - `type Features = Record<FeatureKey, boolean>`; `type Installed = { portalAntrenori: boolean; portalParinti: boolean }`.
  - `installedPortals(hosts: readonly string[]): Installed` (`antrenor` -> `portalAntrenori`, `sportiv` -> `portalParinti`).
  - `readFeatures(raw: unknown, installed: Installed): Features` (saved choice -> effective set).
  - `savedFeatures(raw: unknown): Features` (saved choice only, defaults applied, no install check; the page shows it).
  - `applyChange(saved: Features, key: FeatureKey, on: boolean, installed: Installed): { ok: true; next: Features; alsoOff: FeatureKey[] } | { ok: false; code: 'needsPrezenta' | 'notInstalled' }`.
  - `JOB_FEATURE: Record<'payment' | 'portal-invite' | 'portal-access', FeatureKey>`.
  - `FEATURES_COPY` with `page`, `card`, `intro`, `footer`, `needsPrezenta`, `notInstalled`, `items: Record<FeatureKey, { name: string; text: string }>`, `coachTextWithoutPrezenta`, `warning: Record<FeatureKey, string>`, `warningTitle(name: string): string`, `alsoOffLine: string`, `cancel`, `confirm`, and the history line `lastChange(who: string, date: string): string` (copy: "Ultima modificare: <who>, <date>."). Strings verbatim from spec section 7.

- [ ] **Step 1: Write the failing tests** in `features.test.ts`:
  - `readFeatures(null, both)` and `readFeatures({ features: 'x' }, both)` -> all five true.
  - `readFeatures({ features: { prezenta: false, abonamente: true } }, both)` -> `prezenta` false and `abonamente` false (dependency).
  - `readFeatures({}, { portalAntrenori: false, portalParinti: true }).portalAntrenori === false`.
  - `applyChange(allOn, 'prezenta', false, both)` -> `{ ok: true, alsoOff: ['abonamente'] }`, `next.abonamente === false`.
  - `applyChange({ ...allOn, prezenta: false, abonamente: false }, 'abonamente', true, both)` -> `{ ok: false, code: 'needsPrezenta' }`.
  - `applyChange(allOn, 'portalParinti', true, { portalAntrenori: true, portalParinti: false })` -> `{ ok: false, code: 'notInstalled' }`; switching the same portal off is allowed.
  - `installedPortals(['antrenor'])` -> `{ portalAntrenori: true, portalParinti: false }`.
- [ ] **Step 2: Run** `npx vitest run src/club/features/__tests__/features.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `features.ts` and `copy.ts` with the signatures above. Pure, no imports outside `src/club` (the admin bundle imports it).
- [ ] **Step 4: Run** the same command. Expected: PASS. Then `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(features): feature keys, defaults, dependency rule and copy`.

### Task 2: Storage, loader and the admin route gate

**Files:**
- Create: `src/api/feature-settings/content-types/feature-settings/schema.json` (single type, `collectionName: 'feature_settings'`, `draftAndPublish: false`, `content-manager.visible: false`, attribute `features` json), plus the usual `routes/feature-settings.ts`, `services/`, `controllers/` core files as other single types have.
- Create: `src/club/features/strapi-store.ts`, `src/club/features/__tests__/route-gate.test.ts`.
- Modify: `src/club/admin-area.ts`, `src/policies/has-role.ts`, `src/api/club/routes/09-attendance.ts`, `10-subscriptions.ts`, `11-payments.ts`, `12-portal-accounts.ts`, `14-athlete-access.ts`, `05-athletes.ts` (parcurs routes 25-28), the tables controller (`src/api/club/controllers/` file serving `13-tables.ts`) and `src/club/tables/*` catalog.

**Interfaces:**
- Consumes: Task 1 `readFeatures`, `installedPortals`, `FeatureKey`.
- Produces:
  - `loadFeatures(strapi: Core.Strapi): Promise<Features>` (one `findFirst` on `api::feature-settings.feature-settings`, `installedPortals(PORTAL_HOSTS())`), and `loadSaved(strapi): Promise<Features>`, `saveFeatures(strapi, f: Features): Promise<void>` in `strapi-store.ts`.
  - `featureRoute(feature: FeatureKey, area: AdminArea): AdminRouteConfig` in `admin-area.ts`: same shape as `adminRoute(area)` with `config: { area, feature }`. `AdminRouteConfig` policy config type widens to `{ area: AdminArea; feature?: FeatureKey }`; `areaOfRoute` unchanged.
  - `has-role` reads `config.feature`; after the role check, if the feature is off, throws `ForbiddenError('Feature is off', { code: 'featureOff', feature })`.
  - `tableSubjectFeature(subject): FeatureKey | null` in `src/club/tables/` (`prezenta`, `sedinte` -> `prezenta`; `plati`, `abonamente` -> `abonamente`; `sportivi` -> null). Catalog leaves out disabled subjects; `query`/`export` of one answer 403 `featureOff`; saved views of a disabled subject are left out of the list.

- [ ] **Step 1: Write the failing tests** in `route-gate.test.ts` (source-reading, like the existing area tests): every route in `09-attendance.ts` names feature `prezenta` (coach CSVs too), `10-subscriptions.ts` and `11-payments.ts` name `abonamente`, `12-portal-accounts.ts` names `portalAntrenori`, `14-athlete-access.ts` names `portalParinti`, the four parcurs routes in `05-athletes.ts` name `parcurs`, and no other route file names a feature. Plus a unit test of the `has-role` policy with a stubbed `strapi` (feature off -> ForbiddenError with `details.code === 'featureOff'`; role refused first -> plain ForbiddenError). Plus `tableSubjectFeature` cases.
- [ ] **Step 2: Run** `npx vitest run src/club/features src/club/tables`. Expected: FAIL.
- [ ] **Step 3: Implement** the schema, store, `featureRoute`, the `has-role` check and the route changes. Keep the existing area of every route as it is.
- [ ] **Step 4: Run** the same tests, the existing area tests (`npx vitest run src/club/__tests__`), and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(features): store the switches and refuse disabled admin routes`.

### Task 3: Funcții API, history and e-mail guards

**Files:**
- Create: `src/api/club/routes/15-features.ts`, `src/api/club/controllers/features.ts`, `src/club/features/change.ts`, `src/club/features/__tests__/change.test.ts`.
- Modify: `src/email/email-jobs.ts` (`EmailDeps`, `attemptJob`, `EmailJobStore`), `src/email/strapi-email.ts`, the fake job store used by email tests, `src/email/__tests__/` (new cases).

**Interfaces:**
- Consumes: Task 1 `applyChange`, `JOB_FEATURE`; Task 2 `loadSaved`, `saveFeatures`, `loadFeatures`.
- Produces:
  - Routes: `GET /club/features` (`adminRoute('any')`) -> `{ saved: Features; features: Features; installed: Installed; lastChange: { by: string; at: string } | null }`; `PUT /club/features` (`adminRoute('superAdmin')`), body `{ key: FeatureKey; on: boolean }` -> same shape plus `alsoOff: FeatureKey[]`; 409 `{ code: 'needsPrezenta' | 'notInstalled' }`; 400 on a bad body.
  - `changeFeatures(port: FeaturePort, input: { key; on; actor }): Promise<ChangeResult>` in `change.ts`, with `FeaturePort = { saved(): Promise<Features>; save(f): Promise<void>; cancelJobs(kinds: string[]): Promise<number>; history(entry: HistoryInput): Promise<void>; installed: Installed }`. Order: compute with `applyChange`, save, cancel jobs of every switched-off feature's kinds, write one history entry `{ subjectType: 'features', subjectId: 'club', action: 'featuresChanged', changes: { key, on, alsoOff }, actor }`.
  - `EmailJobStore.cancelQueuedOfKinds(kinds: string[], reason: 'featureOff'): Promise<number>` (conditional write `queued` -> `cancelled`, like `cancelQueuedInvites`).
  - `EmailDeps.featureOn?: (feature: FeatureKey) => Promise<boolean>`; `attemptJob` checks `JOB_FEATURE[job.kind]` before the claim and cancels the job (status `cancelled`, lastError `featureOff`) when off.

- [ ] **Step 1: Write the failing tests:** `change.test.ts` with a fake port (prezenta off -> save called with both off, `cancelJobs(['payment'])`, one history entry with `alsoOff: ['abonamente']`; `needsPrezenta` and `notInstalled` -> nothing saved, nothing cancelled; switching a feature on cancels nothing). Email: a queued `payment` job with `featureOn` resolving false -> status `cancelled`, `send` never called; with true -> sent as before; a `schedule-change` job is never checked. Route source test: `15-features.ts` GET is area `any`, PUT is area `superAdmin`. Policy test: PUT area `superAdmin` refused for a Club admin with `HAS_ROLE_ENFORCED=false` (existing `enforced()` rule).
- [ ] **Step 2: Run** `npx vitest run src/club/features src/email`. Expected: FAIL.
- [ ] **Step 3: Implement** the route file, controller (thin: parse body, build the port from Task 2 store + `recordHistory` + `cancelQueuedOfKinds`, call `changeFeatures`, answer), `lastChange` from the newest `featuresChanged` history entry, and the e-mail guard wired in `buildEmailDeps` with `featureOn: async (k) => (await loadFeatures(strapi))[k]`.
- [ ] **Step 4: Run** the same tests and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(features): Funcții API, history and e-mail guards`.

### Task 4: Portals: per-host switch, feature routes, crons, payload

**Files:**
- Create: `src/policies/portal-feature.ts`, `src/club/features/__tests__/portal-gate.test.ts`.
- Modify: `src/policies/portal-session.ts` (`portalCaller`), `src/api/portal/controllers/portal-auth.ts`, `src/api/portal/routes/02-coach.ts`, `04-sportiv.ts`, the coach and sportiv `me` controllers, `src/club/portal/access/invite.ts`, `src/club/portal/accounts/invite.ts`, `config/cron-tasks.ts`.

**Interfaces:**
- Consumes: Task 2 `loadFeatures`.
- Produces:
  - `portalCaller` answers 404 when the caller's host portal is not effective (`antrenor` host -> `portalAntrenori`, `sportiv` host -> `portalParinti`); login, refresh and invite acceptance in `portal-auth` answer 404 the same way.
  - Policy `global::portal-feature`, config `{ feature: FeatureKey }`: 404 when off. Applied to: coach `/session`, `/session/check`, `PUT /session`, `/lessons*` (prezenta), coach parcurs and awards routes (parcurs); sportiv `/history` (prezenta), `/money`, `/payments`, `/subscriptions` (abonamente), `/path`, `/pin-recipients`, `/pins` (parcurs).
  - Coach and sportiv `GET /me` payloads gain `features: { prezenta: boolean; abonamente: boolean; parcurs: boolean }`. The sportiv home payload leaves out `presences` when `prezenta` is off and the abonament card data when `abonamente` is off; the coach `today` payload keeps sessions and drops the attendance state when `prezenta` is off.
  - Invites (both kinds) answer 409 `portalsOff` when the target portal is not effective (same copy as today).
  - Crons: `portalNotices` runs only when `portalParinti` is effective; `portalPurge` purges portal tables when any portal is effective and always runs the housekeeping.

- [ ] **Step 1: Write the failing tests** in `portal-gate.test.ts`: route source test (exactly the routes above carry `global::portal-feature` with the named feature, no others); `portal-feature` policy with a stub returning off -> NotFoundError; a pure helper `hostFeature(host: string): 'portalAntrenori' | 'portalParinti' | null` cases; `me` payload builder includes the three flags. Extend the existing `portal-session` test: host `sportiv` with `portalParinti` off -> 404 for a valid session.
- [ ] **Step 2: Run** `npx vitest run src/club/features src/club/portal`. Expected: FAIL.
- [ ] **Step 3: Implement** as listed. Reuse `loadFeatures` once per request.
- [ ] **Step 4: Run** the same tests and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(features): portals follow the switches`.

### Task 5: Always-active flows create no data for a disabled feature

**Files:**
- Modify: whichever of these create memberships, payments or attendance (verify by reading): `src/club/new-season/*` (route `08-new-season.ts`), registration confirm (`src/club/confirm/*`), group moves (`src/club/groups/*`, `MoveDialog` backend), `src/club/presence/subscriptions/add.ts` callers.
- Create: `src/club/features/__tests__/flows.test.ts` or tests next to each flow.

**Interfaces:**
- Consumes: Task 2 `loadFeatures` (passed into the flow as a plain `Features` value, so the flows stay pure).
- Produces: each flow that would create a membership or payment skips that step when `abonamente` is off; nothing creates attendance when `prezenta` is off. Existing data is never touched.

- [ ] **Step 1: Inventory** every write of `api::subscription.subscription`, `api::payment.payment` and attendance rows outside routes 09, 10, 11 (`grep -rn "subscription.subscription\|payment.payment\|attendance" src/club --include=*.ts -l`). Write the list into the task report.
- [ ] **Step 2: Write the failing tests:** for each flow found, with `abonamente` (or `prezenta`) off the fake store records no new membership, payment or attendance, and the rest of the flow result is unchanged.
- [ ] **Step 3: Run** them. Expected: FAIL. **Step 4: Implement** the skip. **Step 5: Run** them and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(features): active flows skip disabled features`. If Step 1 finds no such write, commit nothing and say so in the report.

### Task 6: Admin: useFeatures, menu and page gating

**Files:**
- Create: `src/admin/lib/useFeatures.ts`, `src/club/features/visible.ts`, `src/club/features/__tests__/visible.test.ts`.
- Modify: `src/admin/dashboard/menu.tsx` (`EdusportLink.feature?: FeatureKey`, entries Prezență -> `prezenta`, Contabilitate and the four old money redirects -> `abonamente`), `src/admin/pages/routes.ts` (CUSTOM_PAGES `feature?`), `src/admin/lib/AreaGate.tsx`, `src/admin/MobileNav.tsx`, the sidebar component that calls `visibleLinks`.

**Interfaces:**
- Consumes: Task 3 `GET /club/features`.
- Produces:
  - `useFeatures(): { ready: boolean; on: (k: FeatureKey) => boolean; data: FeaturesResponse | null }` (one shared read like `useAreas`; on error `ready: true` and every feature on: fail open).
  - `visibleLinks(links, has, on)` (third parameter `on: (k: FeatureKey) => boolean`); a link with `feature` shows only when `on(feature)`.
  - `tablesVisible(on): boolean` (Tabele shows when `prezenta` or `abonamente` is on) in `visible.ts`; Tabele link uses it.
  - `gateDecision(areaOk: boolean, featureOk: boolean): 'show' | 'noAccess'` in `visible.ts`; `AreaGate` takes `feature?` and waits for both reads; `gatedLazy(area, load, feature?)`.

- [ ] **Step 1: Write the failing tests** in `visible.test.ts`: `visibleLinks` hides Prezență when `prezenta` off and Contabilitate when `abonamente` off, keeps every link without `feature`; `tablesVisible` cases; `gateDecision(true, false) === 'noAccess'`.
- [ ] **Step 2: Run** `npx vitest run src/club/features`. Expected: FAIL.
- [ ] **Step 3: Implement.** Components stay thin; logic in `visible.ts`.
- [ ] **Step 4: Run** the tests, `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** `feat(admin): menu and pages follow the switches`.

### Task 7: Admin: in-page spots

**Files:**
- Modify (inventory "Admin" lines): `src/club/sportivi/record-view.ts` (`recordTabs(r, on)`), `src/admin/dashboard/sportivi/AthleteRecordPage.tsx`, `src/club/grupe/group-view.ts` + `grupe/GroupPage.tsx`, `src/club/sportivi/list-view.ts` + `AthleteTable.tsx` + `AthleteCards.tsx`, `src/club/tables/*` + `sportivi/tabele/TypeBar.tsx`, `grupe/MoveDialog.tsx`, `prezenta/RowMoneyMenu.tsx`, `prezenta/PanelLinks.tsx`, `bani/PresenceHistory.tsx` host, `portal/AccountBlock.tsx` hosts (`MembriEchipaPage.tsx`, `GroupPage.tsx`), `sportivi/DateTab.tsx` (AccessBlock), `SportiviList.tsx` (BulkInviteBar), `AnuntEditPage.tsx` + `anunturi/PortalRecipients.tsx`.
- Test: tests next to each pure view module touched.

**Interfaces:**
- Consumes: Task 6 `useFeatures`.
- Produces: pure filters take `on: (k: FeatureKey) => boolean`: `recordTabs(r, on)` (drops `abonament`, `plati` for `abonamente`; `parcurs` for `parcurs`), group tabs (drops Prezență for `prezenta`), Sportivi list columns and filters (drops Abonament for `abonamente`), Tabele subjects (Task 2 `tableSubjectFeature`). Components hide: money menu and abonament bar (`abonamente`), presence links and history (`prezenta`), Cont portal (`portalAntrenori`), Acces portal, bulk invite and the Anunțuri portal option (`portalParinti`). The athlete delete refusal stays.

- [ ] **Step 1: Write the failing tests** for each pure filter (cases per feature on/off, anonymized record still filtered by `ANONYMIZED_TABS` first).
- [ ] **Step 2: Run** them. Expected: FAIL. **Step 3: Implement.** **Step 4: Run** them, both `tsc`, `admin-ui-check --strict`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): hide disabled features inside pages`.

### Task 8: Admin: the Funcții page

**Files:**
- Create: `src/admin/pages/FunctiiPage.tsx`, `src/club/features/page-view.ts`, `src/club/features/__tests__/page-view.test.ts`.
- Modify: `src/admin/pages/routes.ts` (`FUNCTII_TO = '/plugins/edusport-functii'`, CUSTOM_PAGES entry area `superAdmin`), `src/admin/dashboard/menu.tsx` (link label `Funcții`, group `system`, after Securitate, area `superAdmin`).

**Interfaces:**
- Consumes: Task 1 copy and `applyChange`; Task 3 routes; Task 6 `useFeatures`.
- Produces: `featureRows(data: FeaturesResponse): { key; name; text; on; disabled: boolean; reason: 'needsPrezenta' | 'notInstalled' | null }[]` (text switches to the coach line without attendance and to the dependent or not-installed line as spec section 7 says); `warningFor(saved, key, installed): { title: string; body: string; alsoOff: string[] }` (names of the features `applyChange` switches off with it).
- Page: header `Funcții`, one `EditorCard` "Funcțiile platformei" with the intro, one `Field` + `Switch` per row with the text beside it (as mockup Functii_B), the footer line and the last-change line. Turning a switch off opens `Modal` with `warningFor` (title, body, "Odată cu Prezența se dezactivează și:" list when not empty, buttons Anulează / Dezactivează danger); turning on saves at once. After a save, refresh the shared `useFeatures` read so the menu updates without reload.

- [ ] **Step 1: Write the failing tests** for `featureRows` (prezenta off -> abonamente disabled with `needsPrezenta` text, coach text shortened; portal not installed -> disabled with `notInstalled`) and `warningFor` (prezenta -> alsoOff names `Abonamente și plăți`; parcurs -> empty list).
- [ ] **Step 2: Run** `npx vitest run src/club/features`. Expected: FAIL.
- [ ] **Step 3: Implement** the view module and the page (thin).
- [ ] **Step 4: Run** tests, both `tsc`, `admin-ui-check --strict`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): Funcții page`.

### Task 9: Frontend portals

**Files (frontend worktree):**
- Setup: `git -C /Users/codrin/Documents/Programming/edusport_frontend worktree add .claude/worktrees/features -b feat/feature-switches chore/env-cleanup`.
- Create: `src/lib/portal/features.ts`, `scripts/portal/features.test.mjs`.
- Modify: `src/lib/portal/api-types.ts` (`me` gains `features`), `src/app/(antrenor)/antrenor/_lib/nav.ts`, `src/app/(sportiv)/sportiv/(app)/_lib/nav.ts`, `src/lib/portal/coach-routes.ts`, `sportiv-routes.ts`, coach pages `prezenta`, `lectie`, `antrenament/nou`, `calendar/SessionSheet.tsx`, `grupe/[id]/GroupView.tsx`, `sportiv/[id]/ParcursSection.tsx`, `(app)/page.tsx`, `_ui/SessionRow.tsx`; sportiv pages `[athleteId]/page.tsx` (presences and abonament cards), `istoric`, `plati`, `parcurs`.

**Interfaces:**
- Consumes: Task 4 `me.features`, 404s.
- Produces: `type PortalFeatures = { prezenta: boolean; abonamente: boolean; parcurs: boolean }`, `portalFeatures(me: unknown): PortalFeatures` (missing -> all true), `coachNav(features)` without the Prezență item when off, `sportivNav(athleteId, performance, features)` without Istoric (prezenta), Plăți (abonamente), Parcurs (parcurs); route allow-lists drop the same paths; whole-feature pages call `notFound()`; mixed pages hide the parts. A 404 from the backend on a portal API call shows the existing not-found page.

- [ ] **Step 1: Write the failing tests** in `scripts/portal/features.test.mjs`: `portalFeatures({})` all true; `sportivNav('a1', true, { prezenta: false, abonamente: true, parcurs: false })` hrefs are exactly `/a1`, `/a1/concursuri`, `/a1/plati`; coach nav without prezenta has no `/prezenta`; allow-lists refuse `/sportiv/api/portal/sportiv/athletes/a1/money` when `abonamente` off.
- [ ] **Step 2: Run** `npm run test:scripts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run test:scripts`, `npm run lint`, `npx tsc --noEmit`, `npm run check:tokens`. Expected: PASS, 0 lint errors.
- [ ] **Step 5: Commit** `feat(portal): portals follow the feature switches`.

### Task 10: Docs and full check

**Files:**
- Modify: backend `docs/HANDOFF.md` (feature switches: where, defaults, rollout order after `chore/env-cleanup`); frontend guide page `src/content/ghid/pages/` new page `functii.ts` in group "Echipă și acces" (title "Funcțiile platformei", steps to open Funcții, what deactivation does, using the approved copy only), registry entry; install guide `portalurile-optional.ts` one line: a portal installed on the server is activated from Funcții.

- [ ] **Step 1: Write the docs.** Guide copy uses only spec section 7 sentences and on-screen labels.
- [ ] **Step 2: Run** backend `npm test -- --maxWorkers=3`, both `tsc`, `admin-ui-check --strict`; frontend `npm run test:scripts`, `npm run lint`, `npx tsc --noEmit`, `npm run check:tokens`, `npx playwright test -c playwright.e2e.config.ts tests/e2e/ghid.spec.ts --workers=2`. Expected: all PASS.
- [ ] **Step 3: Commit** in each repo `docs: feature switches` and `docs(ghid): Funcțiile platformei`.
