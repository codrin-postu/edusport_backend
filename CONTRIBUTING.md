# CONTRIBUTING — EduSport CMS

## Branching and commits

- Branch off `main`. Open a pull request when work is ready.
- Never push directly to `main`.
- Commit messages use imperative present tense with a type prefix:
  - `feat:` — new feature or content type
  - `fix:` — bug fix
  - `chore:` — tooling, deps, infra
  - `docs:` — documentation only
  - `refactor:` — internal restructuring with no behaviour change

## Content-type changes

Strapi 5 will auto-migrate the database schema on boot. That makes additive
changes safe but destructive ones dangerous.

- **Adding a field** is safe in any environment.
- **Renaming a field** is two deploys: add the new field, backfill data,
  remove the old field.
- **Removing a field in production must always have a documented backfill
  plan** (or an explicit decision that the data can be lost). Never drop a
  field in a hotfix.
- If a content type changes shape, update the corresponding seed script under
  `scripts/seed-*.js` so a fresh database can still be bootstrapped.

## Seed scripts

- Each seeder is a standalone Node script that uses the Strapi API.
- Naming convention: `scripts/seed-<feature>.js`.
- Scripts must be idempotent (re-running them should not duplicate entries).
- Document any new seeder by adding an `npm run seed:<name>` entry in
  `package.json`.

## Before opening a PR

```bash
npm run build       # admin + server build must succeed
```

For local manual testing, start the dev stack with `docker compose up` and
walk through the admin UI for the affected content type.
