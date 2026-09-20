# Changelog

Strapi 5 CMS, custom EduSport admin and API for the public site.
Production deploys are manual (Actions > Deploy backend > pick a ref).

## Unreleased (on `staging`, 12 commits ahead of `main`)

Committed and pushed to `staging`, not merged to `main`. Production is level
with `main`: the VM runs `bb1e7a4` (2026-08-24), released by hand rather than
through the Actions workflow.

### Added
- Custom EduSport admin: navy sidebar shell, dashboard landing page, branded
  login (`45b174e`).
- In-house registration and contact submissions admin, replacing the external
  form: spreadsheet view, detail panel, status workflow (`b686aab`).
- Seasons, archiving, pagination and filters for registrations, plus manual
  moves between seasons (`da0a7e2`).
- Editable form questions through a config overlay, with add and remove, dynamic
  options and extra-JSON answers (`cf310e8`, `3e09274`).
- skate-results integration in the admin: search, import and link competition
  results to a sportsperson (`14c892f`).
- Recurring calendar event model with a server-side expansion endpoint and a
  unified Program calendar admin (`7571c84`, `fc060a9`).
- Optional Sentry/GlitchTip error tracking, inert without a DSN (`2b7fc78`).
- Admin editor redesign mockups (`8dfe6c4`).

### Changed
- Season range (Sezon de la / pana la) scoped to Scoala de patinaj events only;
  schedule series card renamed (`e5fb225`).

## 2026-08-24 (deployed)

### Added
- `partners-page` content type with link-outs, restyled help-ways editor
  (`27aa5b3`).

### Changed
- Strapi upgraded 5.23.0 to 5.52.1 (`5f273cb`).
- CI split into separate check and deploy jobs, gated and phased deploy,
  gitleaks working-tree scan (`9ac741a`, `35945f0`, `8df3522`).

## 2026-08-23

### Added
- `sponsor`, `collaboration-event` and `volunteer-page` content (`a8b9dc9`).
- Pending content-model, admin and competition changes (`04deb75`).

## 2026-05

### Added
- `sportsperson` and `discipline` content types (`98949c0`).
- Article gallery and video custom field (`8dbba1c`).
- `contact-submission` content type (`ce23e6f`).
- Custom admin shell with a blocks toolbar image button, save bar and Romanian
  translations (`39e70b2`); mobile navigation in the admin shell (`9bd5c3d`).
- Production hand-off: Dockerfile, deploy scripts, docs, CORS (`a540f41`), and a
  manual GitHub Actions deploy with a branch selector (`3f6837d`).

### Fixed
- Docker and deploy issues: copy the whole built app into the runner stage,
  `--env-file` on every compose call, health probe on `127.0.0.1` (`587e780`,
  `7284a6e`, `ff80e5f`).

## 2026-04-16

### Added
- All EduSport content types for the skating school, domain components, seed
  scripts for every content type, admin customization and the component-preview
  plugin.
- Strapi starter template content types removed.

## 2025-08

### Added
- Initial commit and readme.
