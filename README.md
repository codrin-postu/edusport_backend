# EduSport CMS

Strapi 5 backend for the EduSport (scoaladepatinaj.com) website. Provides the content API
consumed by the Next.js frontend in `edusport_frontend`.

## Overview

- Strapi 5 with TypeScript.
- PostgreSQL 16 as the persistence layer.
- Media uploads stored on a Docker named volume (`public/uploads`).
- One in-repo plugin: `src/plugins/component-preview` (built automatically by `strapi build`).
- Roughly fifteen content types under `src/api/`, covering site settings, homepage,
  pricing, courses, articles, announcements, competitions, team members, history,
  and contact submissions.

## Content types

The current set under `src/api/` is:

```
announcement, article, competition, contact-submission,
course-regulations, cursuri-page, historic-page, history-milestone,
homepage, pricing, program-page, realizari-page,
site-settings, team-member, team-page
```

Each is a standard Strapi content type with its own controller, route, service,
and schema. Adding a new one follows the usual `strapi generate content-type` flow.

## Local development

The repo ships with a development Docker Compose stack (`docker-compose.yml`) that
runs Strapi via `strapi develop` against a local Postgres.

```bash
cp .env.example .env
docker compose up
```

The admin panel is available at <http://localhost:1337/admin>. On first boot,
create an admin user via the form, then either:

- run a seed script to populate sample content (see below), or
- import a dump from another environment with `strapi import`.

### Seed scripts

The `scripts/` directory contains one-off seeders. They are designed to run
inside the live container so that they share Strapi's runtime:

```bash
npm run seed:homepage
npm run seed:cursuri-page
npm run seed:regulations
npm run seed:pricing
npm run seed:content
```

These call `docker exec strapi_app node scripts/seed-*.js`. Adjust the container
name in `package.json` if you renamed the service.

## Custom plugin

`src/plugins/component-preview/` is an in-repo Strapi plugin that provides a
custom admin field for previewing dynamic-zone components. There is no separate
install step. The admin build (`strapi build`) picks it up automatically.

## Production

The production stack uses `Dockerfile.production` and
`docker-compose.production.yml`. See:

- [DEPLOY.md](./DEPLOY.md) for full provisioning and deployment instructions.
- [ARCHITECTURE.md](./ARCHITECTURE.md) for the request-flow diagram and
  cross-service overview.
- [CONTRIBUTING.md](./CONTRIBUTING.md) for branching, commits, and content-type
  conventions.

## Reference

- Strapi admin: `/admin`
- Health check: `/_health`
- Default port: `1337`
- Frontend repo: `edusport_frontend`
