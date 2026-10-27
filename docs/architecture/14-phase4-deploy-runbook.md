# 14. Phase 4 deploy runbook (groups and schedules)

Operator steps for phase 4 (Grupe, group programs, new season, parent schedule e-mails). Spec: `docs/superpowers/specs/2026-10-27-groups-schedules-design.md` (section 4); plan index: `docs/superpowers/plans/2026-10-27-phase4-index.md` ("Deploy"). Production facts and the command prefix are in `11-migration-runbook.md`. Every step below needs the user's approval before it is run.

All script commands run on the VM inside the backend container:

`docker compose -f docker-compose.production.yml --env-file .env.production exec backend npm run migrate:groups -- --step=<step> [--apply]`

Pipe each run through `tee` into a file (for example `step-4-dry.log`): the rollback below uses the apply output.

## Prerequisites

- The phase 2 + 3 window is done (`12-phase2-deploy-runbook.md` and the phase 3 handoff) and its checks passed.
- The backend and frontend builds of phase 4 are the ones to deploy (same branch, built from the same commit).
- A current Sezon is marked current (Sezoane). The script refuses without one.

## Step 0: one main per athlete (before anything is deployed)

On a **copy** of the production database (restore last night's dump into a scratch Postgres; never on production), run this read-only SQL. It lists every athlete with zero or several current main memberships in any season. A membership is current while its `to` date is empty.

```sql
select a.athlete_id, s.season_id,
       count(*) as current_rows,
       count(*) filter (where m.is_main) as mains
from group_memberships m
join group_memberships_athlete_lnk a on a.group_membership_id = m.id
join group_memberships_season_lnk s on s.group_membership_id = m.id
where m."to" is null
group by a.athlete_id, s.season_id
having count(*) filter (where m.is_main) <> 1
order by s.season_id, a.athlete_id;
```

If the link tables are named differently, check with `\dt group_memberships*` first.

- Empty result: go on.
- Any row: **stop**. Phase 4 moves and undos answer 500 for those athletes and no script repairs them. Fix the rows by hand (one current main each) in the P3 athlete record, on production, then repeat this step on a fresh copy.

## Deploy

1. Backup: database and uploads (`scripts/backup.sh`). Keep it on the VM.
2. `npm run build` in the backend (the migration script reads the compiled planners from `dist/src/club/groups`; a stale or missing `dist` runs old code).
3. Deploy the backend (schema is applied on restart).
4. Deploy the frontend. Until step 4 below is applied, the website calendar falls back to the CMS series.

## Migration steps

Steps run one per command, in this order. For each one:

1. Dry run (no `--apply`). Read it.
2. Show the dry run to the user and wait for approval.
3. Apply (`--apply`).
4. Dry run again. Expect `0` items to write and `athletes breaking the one-main-per-season rule: 0` (the mains line is printed at the end of every dry run). Anything else: stop and report.

Rules for the whole sequence:

- Do not start a step at :00 or :30 (the script process also runs the hourly crons; a cron firing mid-step makes it compete for rows). Start at :05 to :25 or :35 to :55.
- If `school-series` stops midway (the error says "N of M written before it"), rerun the same command **at once**; it continues where it stopped and skips what is done. Do not run later steps in between.
- After any apply, public pages cache up to 5 minutes: wait 5 minutes before checking the website.
- Before step 6, compare its dry run with step 4's: the old series it lists for deletion must be the ones step 4 replaced, and no Școala group may be missing a new series (the script refuses if one is).

| # | `--step=` | What it writes | Rollback |
|---|---|---|---|
| 1 | `group-names` | Rewrites group names to the new names; one Istoric line each | Rename each group back from the apply output (`"from" -> "to"`), in Grupe |
| 2 | `coaches` | Adds coach links to groups from the team members' group text | Remove the added coaches (apply output lists member and group) in each group's edit |
| 3 | `program-public` | Sets "Program public" on groups | Clear it on the groups the apply output lists (empty reads as public) |
| 4 | `school-series` | Creates one series per Școala group, with copied exceptions | Delete the new series from each group's Program tab; the old series are untouched until step 6, so the website falls back to them |
| 5 | `link-events` | Links existing events to their group | Clear the group on the events the apply output lists |
| 6 | `retire-old-series` | Deletes the old "Serii de cursuri Școala de Patinaj" events | Not reversible by script: restore from the backup of Deploy step 1 (or re-create the series from the log of the dry run) |

A failed or doubtful step that cannot be rolled back by hand: restore the Deploy step 1 backup, then redeploy the previous backend image.

Step 6 runs only after the user has checked `/cursuri/program`, the website calendar and each Școala group's Program tab, and approves it.

## Checks (after step 5, then again after step 6)

Wait 5 minutes after the last apply, then:

- Grupe: every group in the right section, names and coaches as expected, counts per group look right.
- Each group's Program tab: the series and any copied dates match what the club expects.
- `/cursuri/program` on the website: the schedule matches the group programs.
- `/inscrieri`: "Programul pe următoarea lună" shows the right classes.
- One real action in Grupe on a throwaway athlete (Alocă, then the toast "Anulează"), then confirm Istoric shows both lines. Remove the test athlete afterwards.
- GlitchTip: no new errors since the deploy.
