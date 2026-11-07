# EduSport handoff (2026-10-27)

One page to start the next session. Rules and commands: `CLAUDE.md`. Decisions: `edusport_frontend/docs/portal/DECISIONS.md` (index at the top).

## Phases

| Phase | State |
|---|---|
| 1 Data foundation | Live (deployed, migrated) |
| 2 Registration rebuild | Merged to main 2026-10-26 (be 9f869cf, fe e35e41a). Not deployed |
| 3A + 3B Înscrieri, Sportivi, confirmation, matching, merge, delete | Built and reviewed on `feat/athletes`, polish merged. Not on main, not deployed |
| 3C Personal data (export, anonymize, inactivity list, Super Admin) | Built and reviewed on `feat/athletes` (final review fixes merged, 1610d22); boot check proved no personal data left; running on the local environment |
| 4 Groups and schedules | Complete on `feat/athletes` (9fd7947): 7 plans, per-plan and whole-branch reviews closed, user rulings applied; frontend 4-7 on frontend `feat/athletes` (f2c4e0d). Not deployed: one window for 2+3+4, `docs/architecture/15-deploy-window-2-3-4.md` |
| 5 Attendance, abonamente, payments | Complete on `feat/athletes` (ef2c970, no-overpay rule 2026-11-03), 2026-11-02: plans 5-1..5-6 built, boot-checked on throwaway Postgres (renders in frontend `docs/portal/mockups/screens/phase5-renders/`), backend final review and one combined final review for 5-5 + 5-6 closed with fix waves. Running on the local environment. Not deployed: deploy steps in `docs/superpowers/plans/2026-10-27-phase5-index.md` (Deploy) |
| 6 Login and coach portal, backend | Complete on `feat/athletes` (18967ab), 2026-11-06: 6-1 auth and accounts (6f6bf4e), 6-2 coach routes (533c786), 6-3 admin accounts and e-mails (18967ab); batched Opus reviews and three final reviews closed; boot-checked on throwaway Postgres. Open before deploy: copy round (S1-S43, disable confirmation COPY NEEDED, re-link Istoric line). Website (BFF and coach app on the antrenor host) built and merged into frontend `feat/athletes` (bb24aeb, 2026-11-07), 3 batch reviews and a final review closed; click-through renders in frontend `docs/portal/mockups/screens/phase6-clickthrough/`. Deploy needs nginx (X-Forwarded-Proto, X-Real-IP, log masking for /invitatie and ?code=), PORTAL_* env, Google redirect URI, one Next instance. Not deployed |
| 7-8 | Not started (`docs/architecture/13-roadmap.md`) |

Deploy: ONE window for phases 2, 3 and 4 (user, 2026-10-27), order in `docs/architecture/15-deploy-window-2-3-4.md`. Earlier note: ONE window for phase 2 + 3 together (DECISIONS 2026-10-26 d19), only with the user's approval, backup first, per `docs/architecture/12-phase2-deploy-runbook.md`, then `npm run migrate:athletes` steps. Merging `feat/athletes` into main also waits for that window.

## Phase 6-2 note (coach routes)

Built: 27 routes in `src/api/portal/routes/02-coach.ts` behind `global::is-coach` (BFF secret, live account check); rules in `src/club/portal/coach/` (ownership matrix, presence, lessons, athletes and card, program writes through the phase 4 services, Istoric). No coach answer carries `undo` or an auth session id. Contracts: `docs/superpowers/plans/2026-11-04-phase6-index.md` (Coach routes). Ledger: `.superpowers/sdd/2026-11-04-phase6-2-coach-routes/`.

Carried to the frontend plan:
- Branch on status and `error.name`, never on the policy message: 401 means refresh then login; a 403 whose name is not `ClubAdminError` means access was cut, go to login; a `ClubAdminError` 403 carries the Romanian text.
- Copy `src/club/portal/coach/api-types.ts` and the `Occurrence` type it imports. `/program/:eventId` takes the event `documentId`. The "Anunță părinții" flag of the date body is `notifyParents`.
- The roster lists a child from the day it is added, so the card opens for an own-group child with a future "Din data". Other groups' Program reads carry no class note.
- Istoric marks a class "înlocuitor" from the group's coach history on the class date (group "coaches" history lines), so it stays "grup" after the coach is moved off.
- The admin join accepts `from` (bounded by the start date rule and the season end); a schedule-change mail goes once per distinct parent address.
- Session revocation and the password change share the per-request `PortalStore` (`c.portal`); keep that when wiring auth.

## Branches and worktrees

Backend `/Users/codrin/Documents/Programming/edusport_backend`, frontend `/Users/codrin/Documents/Programming/edusport_frontend`.

- `.claude/worktrees/p3be` (backend, `feat/athletes`): integration branch for phases 3 and 4. Task branches merge here; nothing commits directly here except docs.
- `.claude/worktrees/p3fe` (frontend, `feat/athletes`): website side of phase 3 (birth date picker, merged-profile redirect); phase 4 website work goes here.
- `.claude/worktrees/test-main` (both repos, detached): the user's TEST env. Backend on 5c04927 (3A/3B + layout fix, before polish and 3C), frontend on f6deafc. Admin http://localhost:1340/admin, site http://localhost:3010, Postgres container `edusport-test-pg` (127.0.0.1:55442). Do not modify or stop it without the user. Rollback and start commands: `.superpowers/sdd-archive/phase3/final/test-env-report.md`.
- `.claude/worktrees/p3c-final` (backend, `fix/p3c-final`): 3C final review fixes; remove after merge.
- Main checkouts: backend on `main`, frontend on `docs/portal-design` (DECISIONS.md and mockups live there). Unrelated, keep: `calendar`, `.worktrees/finish`.

## Where things live

- Specs: `docs/superpowers/specs/` (P3 `2026-10-26-athletes-registrations-design.md`, 3C `2026-10-27-personal-data-design.md`, P4 `2026-10-27-groups-schedules-design.md` v1.1 approved).
- Plans: `docs/superpowers/plans/`. Phase 4: `2026-10-27-phase4-*.md` with the order and dependencies in `2026-10-27-phase4-index.md` (4-1 groups and memberships, 4-2 schedules, 4-3 new season, 4-4 migration, 4-5 Grupe admin UI, 4-6 admin Calendar și serii / Sezoane, 4-7 website in edusport_frontend/.claude/worktrees/p3fe/docs/superpowers/plans/). Order: 4-1, 4-2, then 4-3 / 4-4 / 4-5 / 4-7 in parallel, then 4-6.
- Research notes (production read-only facts): `edusport_backend/.superpowers/phase4/research.md`, `.superpowers/phase3c/research.md` (main checkout).
- Ledgers: phase 4 goes in `p3be/.superpowers/sdd/<date>-phase4-*/progress.md`. Phase 3 archived in `p3be/.superpowers/sdd-archive/phase3/` (per plan ledgers, task briefs, reports, reviews; `final/` holds the whole-branch reviews, `review-3c.md`, polish and TEST env reports). Phase 2 in the main checkout's `.superpowers/sdd-archive/phase2/`. Agent rules and the shared progress board: main checkout `.superpowers/phase3-shared/` (`agent-rules.md`, `progress-board.md`, UTC times).
- Mockups and renders: frontend `docs/portal/mockups/screens/` (phase 4 in `phase4/`, generators `gen_phase4.py`, `gen_sezon_nou.py`; phase 3 renders in `phase3-renders/`; prototype `prototype-registrations-v5.html`). Admin CSS extracts `mockups/admin-ui-extract.css`, `admin-calendar-extract.css`.
- Architecture: `docs/architecture/` (`10-spec.md`, `13-roadmap.md`, `09-open-items.md`, `diagrams/`).

## How work is run

- Subagent-driven: the controller dispatches one implementer per plan task in its own worktree and branch from the integration branch, then one reviewer per task (spec, then code quality); fix rounds until clean; the controller merges into `feat/athletes`. Parallel only where the plan's groups allow. Full suite and boot checks run in a worktree, never blocking.
- Every agent follows `agent-rules.md`: no product decisions (report NEEDS_DECISION), code rules, never touch production, `strapi_app`, port 1337 or the TEST env, no AI attribution, never push.
- Rulings are logged as one line in the plan's ledger (`progress.md`) and, when they change behaviour or copy, in DECISIONS.md.
- Important questions go to the user in the companion, with real screenshots or renders and options; one screen per question set; read clicks in `state/events` and the server log before moving on. Low-impact choices are decided and logged as "decided by Claude (low impact)".

## Companion

- Folder: `edusport_backend/.superpowers/brainstorm/80180-1792422211/` (`content/` = screens, older ones in `content/archive/`; `state/server-info` has the URL with its key; `state/events` the clicks). Server pid 80195, port 63197, 7-day idle timeout.
- Start a new one: `bash ~/.claude/plugins/cache/claude-plugins-official/superpowers/6.4.1/skills/brainstorming/scripts/start-server.sh --project-dir /Users/codrin/Documents/Programming/edusport_backend --idle-timeout-minutes 10080`
- Prepend `edusport_frontend/docs/portal/mockups/companion-light.html` to every screen (light mode).

## Open items for the club

- Retention: "Ani până la anonimizare" default 5; confirm the period with the accountant / lawyer (`09-open-items.md`).
- Brevo: DNS for scoaladepatinaj.com (SPF include, DKIM, DMARC), mail-tester 9/10; production key only in the VM env, test key deleted, Authorized IPs on.
- Legal numbers on the documents (`src/club/documents/association.ts`: C.I.F., C.I.S., registry no., IBAN, branch).
- WhatsApp channel link (Setări site, Contact).
- Real Avansați Gold prices.
- Apps Script forwarding of registrations: blocked until her script can be edited (doPost).
- A better rule for the proposed group of a child with no group (today: last season's main group).
- VM: `REVALIDATE_FRONTEND_URL` / `REVALIDATE_SECRET` set? Without them the website updates within 5 minutes.

## Parked technical items (phase 3 ledgers)

Resolved since parking: athlete row lock and merge/delete locks (polish 12), main group history line (polish 10), unlinked registration history (polish 11).

- 3-2 T11: strapi-store Minor 6 (missing rows) and Minor 8 (populate).
- 3-2 T16: parse the search query once; old registration contacts not searchable.
- 3-2 T21: unknown `?season=` fallback untested; profile slug TOCTOU.
- 3-2 T22: `setAthleteStatus` refreshes matches even when the status did not change; missing-name 400 test.
- 3-2 T23: frontend profile cache 30 min; strapi-store delete tests.
- 3-4 T8: focus tests, enum fallback test.
- 3-5 T11: AthleteSearch Escape may double-fire with the dialog Escape. 3-5 T8: indentation.
- 3C T4: summary PDF header offsets not shared with `documents/pdf/frame.ts`.
- 3C T13: Setări save may overwrite `reviewHiddenUntilSeason` set in another tab.
- Phase 11: the `month` query of `/club/lessons` and `/club/attendance/coaches(.csv)` is an alias kept one release; remove it in the release after phase 11.
- Final reviews: minors in `final/review-area1-data.md`, `review-area2-inscrieri.md` (M1-M11), `review-area3-sportivi-web.md` (M1-M14), and 3C `review-3c.md` M1-M7 (not covered by the I1-I3 fixes). Some were fixed in the visual and polish rounds; check before scheduling.


## Local environment (2026-11-02)

One local EduSport only: Strapi 1340 + website 3010 + `edusport-test-pg`, worktrees `test-main`, running feat/athletes at ef2c970 (phases 2-5, no-overpay rule), frontend f2c4e0d (4-7); groups migration steps 1-5 applied; phase 5 tables and indexes created on restart, "Prezență și plăți din" = 2026-10-01 (backup test-main/.test-private/test-pg-before-phase5.dump) with synthetic data. Login admin@example.invalid / Throwaway1! (Super Admin). DB backups before each update in the session scratchpad (`test-pg-before-*.dump`). The old `strapi_app` / `strapi_db` (1337 / 5432) is stopped, data kept in its volume.

## Review load (user, 2026-10-27)

Per-task review only for high-risk tasks (data loss, locks, undo, security, migrations); no pre-flight scans; one final Opus review per plan; nothing waits on a review.

## Models (user, 2026-10-27)

Implementers: Haiku where the plan carries the code or the work is mechanical (renders, docs, single-file fixes); Sonnet for tasks needing judgment; Opus only for specs, plans, high-risk and final reviews. Save tokens: short prompts, batched agents.
