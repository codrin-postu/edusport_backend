# 11. Phase 1 migration runbook

Covers the production run of `scripts/migrate-club-foundation.js` (seasons, sections,
price lists, groups, athletes, registration numbers). Source: `.github/workflows/deploy.yml`,
`scripts/deploy.sh`, `scripts/backup.sh`, `docker-compose.production.yml`, and the
final whole-branch review (section I3).

## Production facts

- Reach the VM with `ssh edusport-vm`.
- Deploy path: `/opt/edusport/edusport_backend`.
- Compose file: `docker-compose.production.yml`, env file `.env.production`.
- Compose service for the app is `backend` (container name `edusport_backend`,
  from `docker-compose.production.yml`). The postgres service is `postgres`
  (container name `edusport_postgres`).
- Run `docker compose -f docker-compose.production.yml ps` on the VM first and
  confirm the real container names before running anything, in case they drift
  from this doc.
- Commands against the running app go through:
  `docker compose -f docker-compose.production.yml --env-file .env.production exec backend <command>`.
- `npm run migrate:club` runs `node scripts/migrate-club-foundation.js` directly
  (unlike the seed scripts, which call `docker exec strapi_app ...`; that name
  is stale, the production container is `edusport_backend`). Run it through
  `docker compose exec backend npm run migrate:club` so it uses the deployed
  code and the container's environment, not a local checkout.

## Order of steps

1. Deploy the branch with the normal pipeline (GitHub Actions, "Deploy backend",
   pick the branch). This runs `scripts/deploy.sh all` on the VM: pull, build,
   `up` (which runs `docker compose up -d backend`, and Strapi applies the new
   schema on boot), then `health`. Wait for deploy-health to pass before
   continuing.
2. Take a database backup. Either let `scripts/backup.sh` run (it is meant to
   be on a VM cron job, check on the VM whether it is installed) or run its
   dump step by hand:
   `docker compose -f docker-compose.production.yml exec -T postgres pg_dump -U <DATABASE_USERNAME> -d <DATABASE_NAME> | gzip -9 > strapi-$(date +%F).sql.gz`
   (`DATABASE_USERNAME` and `DATABASE_NAME` come from `.env.production`; check
   on the VM for the exact values). Store the dump outside the container, for
   example under `/opt/edusport/edusport_backend/backups/` next to the files
   `backup.sh` already produces, or copy it off the VM.
3. Run the dry run inside the already-deployed container:
   `docker compose -f docker-compose.production.yml --env-file .env.production exec backend npm run migrate:club`
4. Review its output: counts of seasons, sections, price lists, groups,
   athletes to create, and registration numbers to assign or skip. Fix any
   data problem it reports (unmatched price labels, unrecognized season text,
   unknown group text) before continuing.
5. Run it for real:
   `docker compose -f docker-compose.production.yml --env-file .env.production exec backend npm run migrate:club -- --apply`
6. Run the dry run again. Expect it to report nothing left to do (0 to create
   everywhere, 0 registration numbers to assign). If it still lists work, stop
   and check why before re-running `--apply`.
7. Check `GET /api/club/summary` as an admin. The route requires an admin JWT
   (the token the admin panel stores after login; policy `global::is-admin` in
   `src/policies/is-admin.ts`). It returns counts only, no admin UI screen for
   it yet, so call it directly with that bearer token.

## Boot side effects

Quoted from the final whole-branch review, section I3:

> `createStrapi(...).load()` runs `db.schema.sync()`, all bootstrap writes in
> `src/index.ts` (core-store layout overrides, navigation normalization, sheets
> legacy link) and starts the cron provider (Sheets reconcile).
>
> The dry run therefore makes no domain writes, but it is not DB-read-only.
>
> Run from a checkout that differs from the deployed code, the schema sync
> would alter the production schema.

This is why step 3 and step 5 run inside the already-deployed container
(`docker compose exec backend ...`) and not from a local checkout: the schema
is already in place from step 1, so booting Strapi for the dry run does not
change it further.

## The Google Sheet

`--apply` updates registration-submission rows (`registrationNumber`,
`seasonRef`, `section`). Each update fires the Sheets lifecycle hook
(`src/sheets/lifecycle.ts`), which enqueues the row and triggers a debounced
re-sync of the Înscrieri sheet (`src/sheets/queue.ts`, 2 second debounce).

`registrationNumber` is not a column the Sheets sync writes (checked in
`src/sheets`, no reference to it in `src/sheets/registry.ts` or
`src/sheets/matrix.ts`), so the sheet content does not change even though the
sync runs.

## Recovery

User decision: if the run stops partway, fix the cause and re-run. The script
is idempotent and skips completed work (seasons by label, sections by name,
price lists by name, groups by `nameKey`, athletes by linked profile,
registration numbers by rows that already have one). Restore the backup only
if data looks wrong after a run, not as the default response to a crash.

## Numbers

User decision: a numbered registration that later moves to another season
keeps its number. Numbers are never reissued, including after a season move.
