# Env changes (chore/env-cleanup)

## Behaviour changes
- `PORTAL_HOSTS` empty or unset now means NO portals (before: unset meant `antrenor`). Off: portal auth and session routes answer 404, crons `portalNotices` and `portalPurge` skip, admin invite actions (coach invite, resend, athlete access invite, bulk) answer 409 "Portalurile nu sunt activate pe acest server (PORTAL_HOSTS). Invitațiile nu se pot trimite.", queued `portal-invite` and `portal-access` mails stay queued and are never sent.
- Invite and access mail links are built from `PORTAL_ANTRENOR_URL` / `PORTAL_SPORTIV_URL`, no longer derived as `antrenor.<FRONTEND_ORIGIN host>`.
- `DATABASE_CLIENT` is required; unset or empty fails at boot (only `NODE_ENV=development` defaults to sqlite).
- `SENTRY_TRACES_SAMPLE_RATE` empty now means the default 0.1 (it used to become 0).

## New names
- `PORTAL_ANTRENOR_URL`, `PORTAL_SPORTIV_URL` (origins, for example `https://antrenor.example.com`).

## Renamed or removed
- None removed from the backend template: `.env.example` had no dead names. Portal, `PORTAL_BFF_SECRET` and `PORTAL_GOOGLE_*` entries were added to it.

## Production must set before deploying
- `PORTAL_HOSTS=antrenor,sportiv` (live has it; verify the exact value includes both labels in use)
- `PORTAL_ANTRENOR_URL=https://antrenor.<site domain>` and `PORTAL_SPORTIV_URL=https://sportiv.<site domain>` (the real hosts, equal to the frontend `PORTAL_HOST_*`)
- `DATABASE_CLIENT=postgres` (live has it; verify it is non-empty)
