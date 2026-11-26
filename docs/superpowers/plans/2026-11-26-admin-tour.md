# Admin tour ("Primii pași") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A welcome window, a 2-stop introduction and per-role practice flows ("Primii pași") inside the EduSport admin that save nothing, with progress stored per admin, plus the 2026-11-26 menu and wording decisions.

**Architecture:** Pure rules in `src/club/onboarding/` (flow catalogue and copy, progress merge, tour state machine, fixture router and write guard), tested with Vitest. A thin admin layer in `src/admin/tour/` mounts outside Strapi's providers like `EdusportShell`, installs a `window.fetch` guard while a flow runs, and draws the highlight and card with the admin UI kit. Progress lives on `admin_accounts` behind two `/club/onboarding` routes.

**Tech Stack:** Strapi 5.52 (TypeScript, PostgreSQL), React admin extensions, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-admin-tour-design.md`. Mockup (behaviour and copy reference): https://claude.ai/artifact/89hZZHc41EKGUouBmAmxFp

## Global Constraints

- Every rule from `CLAUDE.md` (no `any`, functions under 30 lines, `adminRoute(area)` on every admin route, UI kit tokens only, `node scripts/admin-ui-check.mjs --strict` exits 0, behaviour tests only, `vitest --maxWorkers=3`).
- Copy exactly as in the spec "Decisions" and "Approved flow texts"; no dashes, middle dots, emoji; straight quotes; never mention "Meniul Strapi" in tour, welcome or flow text. Any string not in the spec or in a copy file the owner approved is a question, never invented.
- A running flow must never send a non-GET request to the server. The final step's button is intercepted by the tour.
- Square corners everywhere; the progress ring is the one approved round shape (comment it as such where `admin-ui-check` or a reviewer would ask).
- Progress is per admin account, survives devices, and replay never clears it.
- Schema change on `admin_accounts` needs a Strapi restart in production (note it in the task report).

## Review Focus

1. Admin with no `admin_accounts` row yet (most existing admins): progress read returns empty and the first mark creates the row. Test in Task 2.
2. A flow's page is behind a switched-off feature or a role the admin lacks: the flow is not listed and cannot be started by URL. Test in Task 3.
3. A stray click on a real save button while a flow runs (not the tour's target): the request is refused, nothing reaches the server, the page shows its normal error path. Test in Task 5.
4. Leaving a flow mid-way (Esc, "Ieși din exemplu", sidebar navigation, page reload): the guard is removed and real data shows again. Test in Task 4 (machine) and Task 6 (uninstall on exit).
5. Target anchor missing (page still loading, collapsed sidebar group, phone width): the step waits for the anchor and opens the group or phone menu instead of placing the card on nothing. Test in Task 4 (`needsMenuOpen`).

---

### Task 1: Menu order and wording decisions

**Files:**
- Modify: `src/admin/dashboard/menu.tsx` (GROUP_ORDER, link order, Formulare hub label and position, new "Meniul Strapi" and "Primii pași" rows), `src/admin/dashboard/EdusportShell.tsx` (footer), `src/admin/MobileNav.tsx` (footer), `src/club/security/copy.ts` and `src/admin/pages/securitate/PasskeysSection.tsx` (Passkey wording), `src/admin/dashboard/DashboardPage.tsx` (only if analytics is role-gated)
- Test: `src/club/__tests__/ui-menu.test.ts`

**Interfaces:**
- Produces: `GROUP_ORDER = ['news', 'forms', 'club', 'pages', 'settings']`; `PRIMII_PASI_TO = '/primii-pasi'` exported from `menu.tsx`; footer anchors `data-tour="primii-pasi"` and `data-tour="ghid"`; `GHID_URL` constant (public site `/ghid`, from the same env the shell already uses for site links, else `https://edusport.codrin.space/ghid`).

- [ ] **Step 1: Write failing tests in `ui-menu.test.ts`**: group order is news, forms, club, pages, settings; club rows read Sportivi, Grupe, Prețuri, Prezență, Contabilitate, Calendar și serii, Tabele, Membri echipă, Competiții; the forms group ends with "Întrebările formularelor"; settings has "Meniul Strapi" with area `superAdmin` and "Primii pași" with area `any`; the footer source of both EdusportShell and MobileNav contains "Ghid EduSport" and renders "Comută la meniul Strapi" only for Super Admin; security copy contains "Passkey" and no "Chei de acces".
- [ ] **Step 2: Run** `npx vitest run src/club/__tests__/ui-menu.test.ts --maxWorkers=3`, expect FAIL.
- [ ] **Step 3: Implement.** "Meniul Strapi" row calls the shell's existing `setMode('default')`. The footer gets "Primii pași" (filled in Task 6, render a plain link now) and "Ghid EduSport" (new tab, `rel="noopener noreferrer"`) above the account rows, desktop and phone. "Analiză trafic" / "Sănătate site": confirm they show for every admin when configured; remove any Super Admin gate.
- [ ] **Step 4: Run** the test, both `tsc` configs, `node scripts/admin-ui-check.mjs --strict`. Expect PASS / exit 0.
- [ ] **Step 5: Commit** `feat(admin): menu order, Întrebările formularelor, Passkey, guide link, Strapi menu for Super Admin only`

### Task 2: Progress storage and routes

**Files:**
- Modify: `src/api/admin-account/content-types/admin-account/schema.json` (attribute `onboarding`, type `json`)
- Create: `src/club/onboarding/progress.ts`, `src/api/club/routes/16-onboarding.ts`, `src/api/club/controllers/onboarding.ts`
- Test: `src/club/onboarding/__tests__/progress.test.ts`

**Interfaces:**
- Produces: `type Progress = { introAt: string | null; flows: Partial<Record<FlowId, string>> }`; `parseProgress(raw: unknown): Progress` (anything malformed becomes empty); `markIntro(p: Progress, at: string): Progress` (keeps the first date); `markFlow(p: Progress, id: FlowId, at: string): Progress` (keeps the first date; unknown ids rejected by the caller); routes `GET /club/onboarding` and `POST /club/onboarding` body `{ intro: true } | { flow: FlowId }`, both `adminRoute('any')`, acting on the caller's own `adminUserId` only (resolved the way `src/club/admin-auth.ts` resolves the session's admin). Response: `Progress`.
- Consumes: `FlowId` from Task 3 (define the union in `src/club/onboarding/flows.ts` in this task if Task 3 has not run; Task 3 fills the catalogue).

- [ ] **Step 1: Failing tests**: `parseProgress(null)` and `parseProgress({ flows: 'x' })` give `{ introAt: null, flows: {} }`; `markIntro` twice keeps the first date; `markFlow(p, 'anunt', d)` adds it, a second call keeps the first date; replay (marking again) never removes other flows.
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement** the pure module, the routes and the controller. The controller creates the `admin_accounts` row when missing (Review Focus 1), validates the body (400 on an unknown flow id), writes inside one query.
- [ ] **Step 4: Run** tests and both `tsc`. Expect PASS.
- [ ] **Step 5: Commit** `feat(onboarding): per-admin tour progress on admin_accounts`

### Task 3: Flow catalogue, copy and visibility

**Files:**
- Create: `src/club/onboarding/flows.ts`, `src/club/onboarding/copy.ts`
- Test: `src/club/onboarding/__tests__/flows.test.ts`

**Interfaces:**
- Produces:
  - `type FlowId = 'inscriere' | 'sportiv' | 'grupa' | 'prezenta' | 'plata' | 'sedinta' | 'anunt' | 'parinte' | 'functii' | 'pagina' | 'preturi' | 'membru'`
  - `interface TourStep { anchor: string; path?: string; where: string; title: string; text?: string; action?: string; waitFor?: 'click' | 'change'; final?: true; guide?: string }`
  - `interface FlowDef extends GatedLink { id: FlowId; name: string; editorOnly?: true; steps: TourStep[] | null }` (`steps: null` = not built yet, never listed)
  - `FLOWS: FlowDef[]` in the spec's order with names: Confirmă o înscriere, Adaugă un sportiv, Creează o grupă, Completează prezența, Înregistrează o plată, Anulează sau mută o ședință, Scrie un anunț, Invită un părinte în portal, Pornește sau oprește o funcție, Modifică o pagină, Actualizează prețurile, Adaugă un membru în echipă.
  - areas / features: inscriere, sportiv, grupa, sedinta, parinte `club`; prezenta `club` + feature `prezenta`; plata `club` + feature `abonamente`; anunt `website`; functii `superAdmin`; pagina, preturi, membru `website` + `editorOnly`; parinte feature `portalParinti`.
  - `flowsFor(has: (a: AdminArea) => boolean, on: (k: FeatureKey) => boolean): FlowDef[]` = `visibleLinks(FLOWS, has, on)` minus `steps === null`, minus `editorOnly` when `has('club')`.
  - `INTRO_STEPS: TourStep[]` (anchors `primii-pasi`, `ghid`) and `WELCOME_COPY` (`title(firstName)`, `line: Record<'superAdmin' | 'club' | 'editor', string>`, `duration`, `later`, `start`, `laterToast`), `TOUR_COPY` (`exit: 'Ieși din exemplu'`, `next: 'Următorul'`, `more: 'Mai multe în ghid'`, `strip: 'Exemplu: nu se salvează nimic'`, `doneToast: 'Gata. Nu s-a salvat nimic.'`, `introDone: 'Gata.'`, page header and subtitle, `replay: 'Reia turul'`, `start: 'Începe'`, `doneLabel: 'Parcurs'`, `again: 'Reia'`, `count(n, total)` = "n din total parcurse").
  - Steps for `inscriere`, `prezenta`, `anunt` exactly as the spec's "Approved flow texts"; the other nine `steps: null`.
- [ ] **Step 1: Failing tests**: a club admin with every switch on gets inscriere, prezenta, anunt (only built flows) and not pagina; an editor (`website`, `any`) gets anunt only; with `prezenta` off the club admin does not get prezenta; Super Admin gets the club set; no string in `copy.ts` or `flows.ts` contains "Strapi", an em/en dash, a middle dot or a curly quote; every built step has `title` and an `anchor`; every built flow has exactly one `final` step, the last.
- [ ] **Step 2: Run**, expect FAIL. **Step 3: Implement.** **Step 4: Run**, expect PASS.
- [ ] **Step 5: Commit** `feat(onboarding): flow catalogue and copy`

### Task 4: Tour state machine

**Files:**
- Create: `src/club/onboarding/machine.ts`
- Test: `src/club/onboarding/__tests__/machine.test.ts`

**Interfaces:**
- Produces: `type TourState = { kind: 'idle' } | { kind: 'intro' | 'flow'; flow?: FlowId; steps: TourStep[]; index: number }`; `type TourEvent = { type: 'startIntro' } | { type: 'startFlow'; id: FlowId } | { type: 'next' } | { type: 'target'; anchor: string; via: 'click' | 'change' } | { type: 'exit' }`; `tourReducer(s: TourState, e: TourEvent): { state: TourState; effect?: 'introDone' | { flowDone: FlowId } | 'left' }`; `currentStep(s): TourStep | null`; `progressOf(s): number` (0..1, (index + 1) / steps.length); `needsMenuOpen(step: TourStep, phone: boolean): boolean` (true for anchors in the sidebar footer or a sidebar row on phone).
- [ ] **Step 1: Failing tests**: `next` is ignored on a step with `waitFor`; `target` with the current anchor advances, with any other anchor is ignored; `target` on the `final` step returns `{ flowDone }` and idle; `next` on the last intro step returns `introDone`; `exit` from any step returns `left` and idle with no done effect; `needsMenuOpen` true for `ghid` on phone, false for a page anchor.
- [ ] **Step 2-4:** run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit** `feat(onboarding): tour state machine`

### Task 5: Write guard and example fixtures router

**Files:**
- Create: `src/club/onboarding/guard.ts`, `src/club/onboarding/fixtures.ts`
- Test: `src/club/onboarding/__tests__/guard.test.ts`

**Interfaces:**
- Produces: `type Fixture = { method: 'GET'; match: RegExp; body: unknown }`; `FIXTURES: Partial<Record<FlowId, Fixture[]>>` (filled per flow in Tasks 7-9, 11-14); `decide(req: { method: string; url: string }, flow: FlowId | null): { kind: 'pass' } | { kind: 'refuse' } | { kind: 'fixture'; body: unknown }`. Rule: no flow means pass; non-GET/HEAD means refuse; a GET matching the flow's fixture means fixture; else pass.
- [ ] **Step 1: Failing tests**: POST/PUT/PATCH/DELETE refused while any flow runs, passed when idle; a GET to a fixture url returns that body only for its own flow; an unmatched GET passes.
- [ ] **Step 2-4:** run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit** `feat(onboarding): write guard and fixture router`

### Task 6: Tour UI, welcome, Primii pași page and footer row

**Files:**
- Create: `src/admin/tour/TourRoot.tsx` (mount, state via `tourReducer`, progress fetch/post, fetch guard install and uninstall), `src/admin/tour/TourCard.tsx`, `src/admin/tour/ProgressRing.tsx`, `src/admin/tour/WelcomeDialog.tsx`, `src/admin/pages/PrimiiPasiPage.tsx`, CSS in the tour module using UI tokens
- Modify: `src/admin/app.tsx` (mount TourRoot the way EdusportShell is mounted), `src/admin/pages/routes.ts` (CUSTOM_PAGES entry for `/primii-pasi`, area `any`), shell and MobileNav footer row (ring + "done/total", hidden when all done, `data-tour="primii-pasi"`)
- Test: `src/club/__tests__/ui-tour.test.ts` (source-reading, as `ui-sheet.test.ts` does)

**Interfaces:**
- Consumes: Tasks 1-5. Exposes `window` event `edusport:tour-start` with `{ flow?: FlowId }` so pages and the Primii pași page start a flow without importing the root.
- Behaviour: welcome shows when `introAt` is null on first panel load; "Mai târziu" posts intro and toasts `laterToast`; intro and flows per the machine; light dim (`--theme-surface-overlay` at reduced opacity, page readable), primary outline, card beside the target (bottom sheet under the phone breakpoint), strip during flows; the final step's button is intercepted in the capture phase (`preventDefault`, `stopPropagation`) before the page sees it; on any exit or flow end the fetch guard is uninstalled and the page re-fetches (navigate to Primii pași on done).
- [ ] **Step 1: Failing source tests**: TourRoot installs the guard only while `kind === 'flow'` and restores `window.fetch` on exit; TourCard renders `where`, ring, title, optional text, optional action, guide link to `/ghid/<slug>`, "Ieși din exemplu", and "Următorul" only without `waitFor`; no "Strapi" text in `src/admin/tour/**`; ProgressRing is the only `border-radius: 50%` / `<circle>` in the tour folder.
- [ ] **Step 2-4:** run (FAIL), implement, run tests, both `tsc`, `admin-ui-check --strict` (PASS).
- [ ] **Step 5: Manual check** on the local admin (1340): new account sees the welcome; intro 2 stops; footer ring. Report screenshots paths, do not modify the local database beyond your own admin row.
- [ ] **Step 6: Commit** `feat(admin): tour, welcome window and Primii pași`

### Task 7: Flow "Confirmă o înscriere"

**Files:** `src/club/onboarding/fixtures.ts` (inscriere: the registrations list and one registration "Maria Popescu", shapes read from the real endpoints used by `src/admin/dashboard/InscrieriPage.tsx` and `inscrieri/RegistrationPanel.tsx`), `data-tour` anchors in those components (`ins-maria` on the example row, `ins-confirma`, `ins-sportiv`, `ins-grupa`, `ins-confirma-final`), `flows.ts` steps paths. Test: `guard.test.ts` (fixture urls match what the page requests), `ui-tour.test.ts` (anchors present).
- [ ] Steps: failing tests, run, implement, run (PASS), manual walk on 1340 (nothing in the network tab but GETs), commit `feat(onboarding): flow Confirmă o înscriere`.

### Task 8: Flow "Completează prezența"

Same shape as Task 7 for `PrezentaPage` and its session panel: anchors `ses-1`, `ses-antrenor`, `ses-lista`, `ses-salveaza`; fixtures for De completat and one session with five example athletes. Commit `feat(onboarding): flow Completează prezența`.

### Task 9: Flow "Scrie un anunț"

Same shape for `AnunturiPage` and `AnuntEditPage`: anchors `anunt-nou`, `unde`, `pentru`, `text`, `programare`, `anunt-salveaza`; fixtures for the list and the groups the form loads. Commit `feat(onboarding): flow Scrie un anunț`.

### Task 10: Copy for the nine remaining flows (owner gate)

**Files:** `docs/superpowers/plans/2026-11-26-admin-tour-copy.md`
- [ ] Draft the steps of sportiv, grupa, plata, sedinta, parinte, functii, pagina, preturi, membru from the guide pages named in the spec (`adauga-un-sportiv`, `creeaza-o-grupa`, `inregistreaza-o-plata`, `anuleaza-sau-muta-o-sedinta`, `invita-un-parinte-in-portal`, `functiile-platformei`, `paginile-site-ului`, `preturi`, `echipa-sponsori-si-alte-liste`), one row per step: anchor, where, title, text, action, in the spec's copy style (one short line, idiomatic Romanian, no explanations).
- [ ] Commit `docs(onboarding): draft copy for remaining flows`. **Stop: the controller shows the table to the owner; Tasks 11-14 start only after approval, with the approved wording.**

### Task 11: Flows "Adaugă un sportiv" and "Creează o grupă"
### Task 12: Flows "Înregistrează o plată" and "Anulează sau mută o ședință"
### Task 13: Flows "Invită un părinte în portal" and "Pornește sau oprește o funcție"
### Task 14: Flows "Modifică o pagină", "Actualizează prețurile", "Adaugă un membru în echipă"

Each: same shape as Task 7, with the approved copy from Task 10, fixtures read from the real endpoints of the pages involved, anchors, failing tests first, manual walk on 1340 with GETs only, one commit per task (`feat(onboarding): flows ...`). For "sedinta" the "Anunță părinții pe e-mail" box is shown, never sent; for "parinte" the invite button is the final step; for "functii" the switch is the final step.

### Task 15: Guide updates (edusport_frontend)

**Files:** a new branch `docs/ghid-primii-pasi` from frontend `main`; pages under `src/content/ghid/pages/` that name changed menu paths or labels: Noutăți first (panoul-de-administrare, meniul-si-pagina-acasa), Prețuri position, "Întrebările formularelor", "Passkey" (contul-tau-parola-si-2fa, siguranta if it names it), the Ghid link and Primii pași (meniul-si-pagina-acasa: one short paragraph). Same copy style.
- [ ] Run the guide script tests and `npx tsc --noEmit` in the frontend worktree; commit `docs(ghid): menu order, Passkey, Primii pași`. Screenshots are retaken by the controller after the backend build is running locally.
