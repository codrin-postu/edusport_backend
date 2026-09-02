# EduSport CMS

> Status and remaining work: [`STATUS.md`](STATUS.md). Shipping history: [`CHANGELOG.md`](CHANGELOG.md). Ecosystem map: [`../ECOSYSTEM.md`](../ECOSYSTEM.md).

Strapi 5 backend for the EduSport (scoaladepatinaj.com) website. Provides the content API
consumed by the Next.js frontend in `edusport_frontend`.

## Running the whole stack locally

The five EduSport repos are separate, so there is no root compose file. They
join a shared external docker network instead, exactly as production does, and
each repo's compose stays versioned in its own repo.

Create the network once:

```bash
docker network create edusport_net
```

Then start what you need, backend first:

```bash
cd edusport_backend       && docker compose up -d   # strapi :1337, postgres :5432
cd ../umami-analytics     && docker compose up -d   # umami :3001
cd ../glitchtip-analytics && docker compose up -d   # glitchtip :3002
cd ../edusport_frontend   && docker compose up -d   # next :3000
```

`skate-results` is optional locally: the backend defaults `SKATE_RESULTS_API` to
the hosted `https://skate-api.codrin.space`, which is where that service stays.
Run it locally only if you need to work offline, and note its database starts
empty.

Inside the network, containers address each other by name (`strapi_app:1337`,
`umami:3000`). From your machine, use the published ports above.

**The frontend cannot run in Docker and via `npm run dev` at the same time** -
both want port 3000. Stop the host dev server first, or map the container
elsewhere.

### Why the frontend needs two Strapi URLs

`NEXT_PUBLIC_STRAPI_URL` is what the browser resolves, so it must be a host
address. Server rendering happens inside the frontend container, where
`localhost` is that container, so it needs `STRAPI_INTERNAL_URL`
(`http://strapi_app:1337`). `src/lib/strapi-base.ts` in the frontend prefers the
internal one and falls back to the public one, which is automatically what
happens in the browser because non-`NEXT_PUBLIC_` variables are not bundled.

Media URLs are the exception and deliberately stay public: they become
`<img src>` values the browser has to load.


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
