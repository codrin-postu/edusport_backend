# Phase 4 plans: groups and schedules (index)

Spec: `docs/superpowers/specs/2026-10-27-groups-schedules-design.md` (v1.1, approved 2026-10-27). Decisions: `edusport_frontend/docs/portal/DECISIONS.md`. Agent rules: `.superpowers/phase3-shared/agent-rules.md`. Mockups: `edusport_frontend/docs/portal/mockups/screens/phase4/`; renders go to `.../screens/phase4-renders/` as `4-<n>-*.png`.

## Plans

| Plan | File | Tasks | Needs merged | Delivers |
|---|---|---|---|---|
| 4-1 | `2026-10-27-phase4-1-groups-memberships.md` | 12 | phase 3 + 3C on `feat/athletes` | every phase 4 schema change, `GroupStore`, Grupe reads, group admin, memberships (Alocă, Mută, Scoate, Adaugă), undo, routes `06-groups`, fixture |
| 4-2 | `2026-10-27-phase4-2-schedules.md` | 8 | 4-1 | group programs (series, single classes), per-date Ține / Anulează / Mută, Pauze, parent e-mails (15 s hold), expansion rewrite, `GET /api/club/schedule`, routes `07-schedule` |
| 4-3 | `2026-10-27-phase4-3-new-season.md` | 6 | 4-1, 4-2 | new season: step data, preview, apply in one transaction, undo, per-group copy, routes `08-new-season` |
| 4-4 | `2026-10-27-phase4-4-migration.md` | 3 | 4-1, 4-2 | `scripts/migrate-groups-schedules.js` steps 1 to 6 and the proof on a throwaway database |
| 4-5 | `2026-10-27-phase4-5-grupe-admin-ui.md` | 7 | 4-1, 4-2 | admin Grupe: list, Fără grupă, group page, roster, move, add, Istoric, Program tab with DatePanel and drawer |
| 4-6 | `2026-10-27-phase4-6-calendar-sezoane-admin-ui.md` | 6 | 4-1, 4-2, 4-3, 4-5 | admin Calendar și serii (Pauze, Serii removed, group dates in the calendar) and Sezoane "Începe sezonul" window |
| 4-7 | `edusport_frontend/docs/superpowers/plans/2026-10-27-phase4-7-website-program.md` (frontend `feat/athletes`) | 4 | nothing (codes against plan 4-2's contract, falls back to the CMS series) | `/cursuri/program` notebook from `/api/club/schedule`, one Școala tile per day on `/cursuri/program` and `/inscrieri` |

## Order and parallel work

Order: 4-1, then 4-2, then 4-3, 4-4, 4-5 and 4-7 in parallel, then 4-6 (after 4-3 and 4-5). 4-7 lives in the frontend repo and may start at any time.

- Backend plans run one worktree each, branched from `feat/athletes` after their "Needs merged" plans are merged; each plan's own "Parallel groups" line splits its tasks.
- 4-3, 4-4 and 4-5 touch different folders (`src/club/groups/new-season*`, `scripts/migrate-groups-schedules.js` + `src/club/migrate/`, `src/admin/**` + `src/club/grupe/`); the shared files they all extend are `src/club/groups/copy.ts` (one re-export line each) and `src/api/club/routes/` (one new file each): merge conflicts there are one line.
- 4-6 edits 4-5's `DatePanel`, `RosterTab`, `ProgramTab` and `api.ts`, so it starts only after 4-5 is merged.
- Boot checks use their own throwaway Postgres and ports (4-1 es41-pg 55441 / Strapi 1361 up to 4-6 es46-pg 55446 / 1366; 4-7 uses the e2e mock on 18897 / 3207). Never `strapi_app`, `strapi_db`, 1337, `edusport-test-pg`, 1340 or 3010.

## Deploy (spec 4, after phase 2 + 3 are live, only with the user's approval)

1. Database backup.
2. Backend (schema applied on restart).
3. Frontend (4-7; the notebook falls back to the CMS series until step 4 of the migration).
4. `migrate-groups-schedules` steps 1 to 5: each dry run shown to the user, then `--apply`.
5. Checks: Grupe, each group's Program, `/cursuri/program`, `/inscrieri` "Programul pe următoarea lună".
6. Step 6 (`retire-old-series`): dry run, then `--apply` after the user approves.

## Decided while planning

Each plan lists its own "Decided while planning" lines (low impact, decided by Claude, for the user to overrule); executing agents log them in DECISIONS.md as "plan 4-<n>, decided by Claude (low impact, 2026-10-27)".
