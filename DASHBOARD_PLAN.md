# EduSport admin dashboard + observability — implementation plan

Status legend: [ ] todo, [~] in progress, [x] done, [!] blocked/needs decision

## Goal
Ship the refined admin landing page (Direction A) with real data, plus error
tracking (GlitchTip) across frontend + backend, and a traffic graph fed by
Mixpanel (monthly unique visitors). Work split across repos so streams run in
parallel.

## Repos
- `edusport_backend` — Strapi 5 admin (landing page lives here) — Stream A + D-proxy
- `edusport_frontend` — Next.js 15.5 / React 19 — Stream B + D-tracking
- `glitchtip-analytics` (new, sibling of `umami-analytics`) — Stream C
- `umami-analytics` — existing self-host pattern to mirror for C

## Decisions
- [x] Look: Direction A refined (season card, forms feed, upcoming+link, analytics graph, site health, quick actions). No week strip.
- [x] Error tracking: GlitchTip, self-hosted in its own repo. Sentry SDK (DSN via env) in FE + BE.
- [x] Analytics graph source: Umami (self-hosted, already tracking the site). Monthly unique visitors via the Umami API. NOT Mixpanel — the project does not use Mixpanel.
- [x] No frontend analytics work needed: Umami already collects on the site.
- [ ] Season label: registration open/closed is real (`site-settings.registration.open`). A clean "Sezon 2026/2027" label needs a tiny new field; default = show state + link only unless we add the field.

## Dashboard data rules
- KPIs: Sportivi, Membri echipă, Competiții (CURRENT YEAR only), Evenimente luna aceasta.
  - Competiții filter: `competition.date` within current calendar year.
  - Evenimente luna aceasta: occurrences in current month; add a type breakdown so it reads as "mostly antrenamente" (e.g. "21 · în majoritate antrenamente").
- Upcoming events list: add category filter chips (Toate / Antrenamente / Școala / Competiții / Altele) driven by occurrence `type`; default Toate. Keep "Vezi tot programul" link.
- "Ce e nou" feed: generic per-source; only contact form live today (triageStatus=new count).
- Season & registration card: read + toggle `site-settings.registration.open`; links to season/orar + pricing.
- Analytics card: Mixpanel monthly unique visitors line + total + trend; "not connected" state until creds set.
- Site health card: GlitchTip errors last 24h + link; "not connected" state until DSN/API set.

## Workstreams

### Stream A — Backend landing page (edusport_backend) — OWNER: main agent
- [x] Evolved `DashboardPage.tsx` to Direction A: navy hero, KPIs, feed, season card, upcoming, analytics+health cards, quick actions.
- [x] KPI: Competiții current-year (filter on competition.date); monthly-events shows "din care N antrenamente".
- [x] Upcoming events: category filter chips (Toate/Antrenamente/Școala/Competiții/Altele).
- [x] "Ce e nou" feed: contact source live (triageStatus=new count); empty state; extensible.
- [x] Season & registration card: reads site-settings.registration.open, inline toggle writes via content-manager PUT (optimistic + revert).
- [x] Build passes; admin boots 200; logs clean. Authed dashboard render still needs on-screen check.
- Analytics/health cards call /api/analytics/summary + /api/site-health/summary (Stream D, not built yet) → currently show "not connected" gracefully.

### Stream D — Analytics + health proxies (edusport_backend) — OWNER: main agent
- [x] `GET /api/analytics/summary` → Umami monthly unique visitors (login for token, then /api/websites/{id}/stats per month, last 6), cached 5min, admin-guarded, `{connected:false}` until env set. Env: UMAMI_API_URL, UMAMI_WEBSITE_ID, UMAMI_USERNAME, UMAMI_PASSWORD. VERIFY /stats response shape against live instance.
- [x] `GET /api/site-health/summary` → GlitchTip errors last 24h, cached, admin-guarded, graceful. Env: GLITCHTIP_API_URL, GLITCHTIP_API_TOKEN, GLITCHTIP_ORG, GLITCHTIP_PROJECT. VERIFY issues endpoint against live instance.
- [x] Backend `@sentry/node` v10 installed; `src/sentry.ts` init (inert w/o SENTRY_DSN), `global::sentry` middleware after strapi::errors captures controller errors. Env: SENTRY_DSN (+ optional SENTRY_ENVIRONMENT, SENTRY_TRACES_SAMPLE_RATE).
- [x] Routes registered (403 admin-guard, not 404); build passes; boots clean.
- Files: src/sentry.ts, src/middlewares/sentry.ts, src/api/dashboard/{controllers,routes}/dashboard.ts; edits to src/index.ts + config/middlewares.ts.

### Stream B — Frontend observability (edusport_frontend) — OWNER: subagent
- [x] Added `@sentry/nextjs` v10 (App Router: instrumentation.ts + onRequestError, instrumentation-client.ts, server/edge configs, withSentryConfig in next.config.ts). Inert when no DSN (guarded init + enabled:Boolean(dsn)). Build passes (exit 0, 33/33). Env: NEXT_PUBLIC_SENTRY_DSN, SENTRY_DSN. Uncommitted.
- [ ] (pending decision) Add Mixpanel browser tracking (project token via env) so unique-visitor data exists.

### Stream C — GlitchTip self-host repo (new `glitchtip-analytics`) — OWNER: subagent
- [x] Created `/Users/codrin/Documents/Programming/glitchtip-analytics`: docker-compose(.production) with migrate/web/worker/db(postgres16)/redis, `.env.example`, `nginx/glitchtip.conf`, `scripts/deploy.sh`+`backup.sh`, README.
- [x] Web bound to 127.0.0.1:3002 (Umami owns 3001). DSN retrieval documented (Project → Client Keys). Consuming apps set SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN. Not started, not committed.

## Sequencing
- B and C are independent of A/D and each other → parallel now.
- A and D share the backend repo → single-threaded (main agent), sequential.
- Wiring/credentials (Mixpanel creds, GlitchTip DSN) happen after C exists; code ships with env placeholders + graceful states so nothing blocks.

## Constraints
- Nothing committed or pushed without explicit request.
- No secrets in code; env only. Romanian UI copy, no emoji, no em dash.
