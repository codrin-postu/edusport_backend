# ARCHITECTURE — EduSport CMS

## Request flow (backend perspective)

```
                       +---------------------+
                       |    Public client    |
                       | (browser / Next.js) |
                       +----------+----------+
                                  |
                                  v   HTTPS (443)
                       +---------------------+
                       |  nginx reverse proxy |
                       |  TLS termination     |
                       +----------+----------+
                                  |
                                  v   docker network: edusport_net
                       +---------------------+
                       |  Strapi backend     |
                       |  Node.js, port 1337 |
                       |  /api  /admin  /uploads  /_health
                       +----------+----------+
                                  |
                  +---------------+----------------+
                  v                                v
        +-------------------+            +-------------------+
        |  PostgreSQL 16    |            |  Named volume     |
        |  named volume     |            |  uploads          |
        |  pgdata           |            |  /opt/app/public/ |
        +-------------------+            |  uploads          |
                                         +-------------------+
```

Inbound traffic always passes through nginx (host) and reaches Strapi over the
`edusport_net` Docker network. Strapi never exposes a host port directly.

## Content types

All content types live under `src/api/<name>/` and follow Strapi 5's standard
layout (`content-types/`, `controllers/`, `routes/`, `services/`):

- `announcement`
- `article`
- `competition`
- `contact-submission` (write-only from the public site, populates `data/`)
- `course-regulations`
- `cursuri-page`
- `historic-page`
- `history-milestone`
- `homepage`
- `pricing`
- `program-page`
- `realizari-page`
- `site-settings`
- `team-member`
- `team-page`

Most are single types tied to specific frontend pages; a few (`article`,
`announcement`, `competition`, `history-milestone`, `team-member`) are
collections.

## Custom plugin

`src/plugins/component-preview/` is an in-repo Strapi plugin that registers a
custom admin field used to preview dynamic-zone components in the editor. It
ships with the codebase, has no separate npm package, and is rebuilt by
`strapi build` whenever the admin bundle is produced.

## Upload pipeline

Strapi's local upload provider writes files to `public/uploads/`. In
production this path is backed by the `uploads` Docker named volume defined in
`docker-compose.production.yml`. Files served back to the frontend come out of
the same path via Strapi's `/uploads/<file>` route.

Because the data lives on a volume (not inside the image), rebuilds and
redeploys do not lose media. The `scripts/backup.sh` cron tars this volume
nightly.

## Build outputs

- `npm run build` (a.k.a. `strapi build`) produces:
  - `dist/` — compiled TypeScript output for the backend runtime.
  - `build/` — the admin panel single-page bundle.
- The production Dockerfile copies both into the runner stage and prunes dev
  dependencies before final assembly.

## Database

PostgreSQL 16 (alpine). The connection settings come entirely from environment
variables read by `config/database.ts`. Schema migrations are run by Strapi
automatically on boot — there is no separate migration command.

## Webhooks

After each entry mutation, Strapi calls
`POST https://scoaladepatinaj.com/api/revalidate` with the shared
`x-revalidate-secret` header. The frontend uses this to invalidate ISR caches
for affected routes. Configuration lives in the Strapi admin under
*Settings -> Webhooks* (documented in `DEPLOY.md`).
