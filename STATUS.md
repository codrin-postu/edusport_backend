# Status - edusport_backend

Last reviewed: 2026-08-30. Ecosystem map: `../ECOSYSTEM.md`.
Shipping history: `CHANGELOG.md`. Dashboard plan: `DASHBOARD_PLAN.md`.

## Where it runs

| | |
| --- | --- |
| Production | https://cms-edusport.codrin.space/admin (VM 178.105.192.111, containers `edusport_backend` on 127.0.0.1:1337 and `edusport_postgres`) |
| Deploy | GitHub Actions > Deploy backend > Run workflow > pick a ref. Manual only. |
| Deployed on the VM | `main` @ `97f0736`, released 2026-08-30 via Actions. Level with `origin/main`. |
| Branch in use | `main`. `staging` was merged in on 2026-08-30 and is no longer the working branch. |
| Working tree | clean except untracked `.mockups/*.html` |

Deploys must run through the GitHub Actions workflow, or as the `codrin` user on
the VM. `/opt/edusport/*` is owned by `codrin` and pulls use that account's
GitHub deploy keys, so running `scripts/deploy.sh` as root fails at the fetch
step with `Could not resolve hostname github.com-backend`.

## What works

### Content
26 content types under `src/api`, covering pages (homepage, cursuri, program,
realizari, historic, team, partners, volunteer), entities (article, competition,
sportsperson, discipline, sponsor, team-member, collaboration-event, pricing,
announcement), scheduling (calendar-event, calendar-blackout, program) and
submissions (registration-submission, contact-submission, form-config).

### Custom admin
`src/admin/dashboard` replaces the stock Strapi landing experience:
- `DashboardPage` with KPIs (sportivi, membri echipa, competitii for the current
  year, evenimente this month), a "Ce e nou" feed, a season and registration
  card with an inline open/closed toggle, upcoming events with category filter
  chips, analytics and site-health cards, quick actions.
- `InscrieriPage` spreadsheet plus detail panel: status workflow, editable
  status and date, reorderable columns, seasons, archiving, filters, pagination.
- `FormularePage` and `FormEditorPage`: edit an existing form's questions,
  reorder, rename, disable, add and remove, dynamic options.
- `MesajePage` for contact submissions.
- `SportiviPage` / `SportivEditPage`, `CompetitiiPage` / `CompetitieEditPage`,
  including skate-results search, import and linking.
- Branded navy shell and login.

### Integrations
- `GET /api/analytics/summary` proxies Umami monthly unique visitors, cached
  5 minutes, admin-guarded, returns `{connected:false}` until env is set.
- `GET /api/site-health/summary` proxies GlitchTip errors in the last 24 hours,
  same guarantees.
- `/skate/*` proxies skate-results (`SKATE_RESULTS_API`, default
  `https://skate-api.codrin.space`, plus `SKATE_RESULTS_API_KEY`), keeping the
  API key server-side.
- `@sentry/node` with a `global::sentry` middleware after `strapi::errors`,
  inert without `SENTRY_DSN`.
- Calendar occurrences expand server-side, so the frontend consumes a flat list.

## What is left

### Release
- [x] Merged `staging` into `main` and deployed 2026-08-30. The custom admin,
      forms system, skate integration, recurrence and Sentry are live.
- [x] Strapi 5.52 confirmed live; the 5.23 to 5.52 migration is done. A
      pre-release dump was taken before the deploy
      (`backups/pre-release-2026-08-30-2026.sql.gz`) and boot migrations applied
      cleanly.
- [ ] Decide what to do with the untracked `.mockups/*.html` files: commit them
      as design references or delete them.

### Wiring
- [ ] Set `UMAMI_API_URL`, `UMAMI_WEBSITE_ID`, `UMAMI_USERNAME`,
      `UMAMI_PASSWORD` and verify the `/stats` response shape against the live
      Umami instance, so the analytics card leaves "not connected".
- [ ] Set `GLITCHTIP_API_URL`, `GLITCHTIP_API_TOKEN`, `GLITCHTIP_ORG`,
      `GLITCHTIP_PROJECT` and verify the issues endpoint shape.
- [ ] Set `SENTRY_DSN` so backend errors reach GlitchTip.
- [ ] Set `SKATE_RESULTS_API_KEY` in production; mutating skate endpoints
      require it.
- [ ] Update the CORS origin and the deploy docs when the domain moves off
      `*.codrin.space`.

### Product
- [ ] Season label. Registration open/closed is real
      (`site-settings.registration.open`), but a clean "Sezon 2026/2027" label
      needs a small new field.
- [ ] Bulk select in the competitions admin, so competitions can be cleared or
      re-imported in one action.
- [ ] Automate score extraction for competitions where skate-results cannot
      resolve the source.
- [ ] "Ce e nou" feed only has the contact source today. Add registrations and
      any other sources.

### Housekeeping
- [ ] Six stale `worktree-agent-*` branches sit 34 commits behind `main`. Delete
      them if the work is merged.
- [x] Nightly backup scheduled 2026-08-30 via `/etc/cron.d/service-backups`
      (03:00 UTC, database plus uploads tarball, 14 runs kept).

## Gotchas worth remembering

- The admin hides any button labeled "Salveaza" or "Publica" through a 1px CSS
  rule used by the save-bar tagger. Custom admin buttons must opt out by not
  using the `.pce` class.
- Content saved in the admin can stay in draft. If the public site does not show
  a record, check draft state before debugging the frontend.
