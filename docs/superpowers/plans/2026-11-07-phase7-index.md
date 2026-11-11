# Phase 7 plans: the sportiv app, backend (index)

> **Refreshed 2026-11-11** against backend `feat/athletes` at e3bc966 (phase 6, 6b-1, 6b-2, coach additions, coach training add, coach today `next`/`week`, the behaviour-only test trim). What changed and why is in "Refresh 2026-11-11" at the end; open points are in "Open questions for the user". Phase 7 scope and the user decisions of the spec are unchanged.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement these plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strapi side of phase 7: athlete access for parents and adult athletes, the per-host account rules (including 2FA, passkeys and Securitate on both hosts), the admin "Acces portal" tools, every `/portal/sportiv/*` read route, and the skate-results integration with its cache.

**Architecture:** A new `src/club/portal/access/` module (access rows, invite outcomes, lifecycle moves) and `src/club/portal/sportiv/` (policy context, explicit views, one reader per screen) on top of the phase 6 `PortalStore`, sessions and mails, the 6b second step and passkeys, and the phase 4 and 5 reads. Competitions live in `src/club/skate/` (client, snapshot cache, pure derivations) and plug into the competition sources that already exist for the coach (`src/club/portal/coach/competitions.ts`). Every sportiv route goes through `global::is-sportiv` and an access check on the athlete id before any read. The Securitate routes (`03-security.ts`) move from `global::is-coach` to a host-generic policy (6b spec S32: "phase 7 swaps in a host-generic policy").

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS), Postgres 16, Vitest 3, Node 22.

**Spec (binding):** `docs/superpowers/specs/2026-11-07-sportiv-app-design.md` (draft v1, 2026-11-07). Earlier: `2026-11-04-coach-portal-design.md` (P6), `2026-11-07-admin-auth-roles-design.md` (P6b: second step, passkeys, Securitate, role areas), `2026-10-27-attendance-payments-design.md` (P5). Decisions: `edusport_frontend/docs/portal/DECISIONS.md` (every entry from 2026-11-09 on applies to the sportiv screens too where it names the portal kit). Design: `edusport_frontend/docs/portal/mockups/screens/sportiv-canvas-current/`. Conventions: `docs/HANDOFF.md`, `CLAUDE.md`, phase 6 plans (store pattern, transactions and row locks, Istoric lines, copy modules), `2026-11-09-coach-portal-additions.md` and `2026-11-10-coach-training-add.md` (latest patterns for coach readers, boot checks and click-through scripts). Agent rules: `.superpowers/phase3-shared/agent-rules.md`.

The website (host, BFF, screens) is the frontend plan in `edusport_frontend/docs/superpowers/plans/2026-11-07-phase7-frontend-index.md`; it consumes the contracts below and nothing else.

## User rules for every task (2026-11-10 and 2026-11-11)

- **Tests cover behaviour only:** API answers and refusals, permissions, money and presence rules, security, data exposure. No tests of layout, colour, position, computed CSS, screenshots, source reading (route-list pins, controller pins, import pins, admin UI markup), copy-string tables, schema attribute pins (only unique-index guards), fake-store parity. A copy module gets one character guard (no em or en dash, no middle dot, no curly quotes, no "Email"), not a list of its strings.
- **Machine load:** vitest always with `--maxWorkers=3`; at most one heavy job (full suite, boot check, build) at a time per agent and at most two heavy agents at once; check `uptime` first. Full suites only in the plan's last task, in a background worktree.
- **Copy:** Romanian, terse, straight quotes, "E-mail", no em dash, no en dash, no middle dot, no emoji; exact strings of the spec; server messages shown as sent.

## Plans

| Plan | File | Tasks | Needs merged | Delivers | Risk |
|---|---|---|---|---|---|
| 7-1 | `2026-11-07-phase7-1-access-accounts.md` | 10 | `feat/athletes` (e3bc966 or later) | schemas, per-host entry on every sign-in path (password, second step, Google, passkey, reset, invite, refresh), device and token host, `global::is-sportiv`, host-generic Securitate policy, role-aware coach disable and coach invite, parent invite, resend, remove, mails, e-mail move, anonymize, delete, merge, admin routes `14-athlete-access.ts`, bulk invite, "Acces portal" admin block, boot check | high |
| 7-2 | `2026-11-07-phase7-2-sportiv-routes.md` | 10 | 7-1 | views and forbidden keys, me and settings, athletes and picker, Acasă with promotion, Istoric, Date sportiv, Calendar and `.ics`, Parcurs with badges, money, payments, abonament, registration PDF, schedule-mail switch, routes `04-sportiv.ts`, host and access matrix, boot check | high |
| 7-3 | `2026-11-07-phase7-3-competitions.md` | 6 | 7-1 | snapshot table, skate client, cache, pure derivations (season, category, records, filters), the real sportiv competition source, competitions list and detail routes, Acasă card and Concursuri badge wiring, boot check | high |

Total 26 tasks. Order: 7-1, then 7-2 and 7-3 in parallel (one worktree each from `feat/athletes` after 7-1 is merged). 7-2 builds against `SportivCompetitionSource` (7-2 Task 1) with the null source; 7-3 Task 5 plugs the real one in. Whichever of 7-2 and 7-3 merges second runs its boot check on the merged branch. After 7-3 Task 5 is merged, coach additions Task 8 (real coach competition source, `2026-11-09-coach-portal-additions.md`) can run: it reuses the client, cache and derivations of 7-3 (see open question 6).

Model tags: **Haiku** where the plan carries the shape and the work is mechanical, **Sonnet** for integration judgment, **Opus** only for the batch and final reviews. **High risk** = auth, sessions, permissions, data exposure, data loss; those tasks get one review per batch (below), never blocking the next batch; all others only the plan's final review.

## Review batches (high-risk tasks, 3 to 4 per batch)

| Plan | Batch | Tasks |
|---|---|---|
| 7-1 | A | T1 schemas and store, T2 rules, T3 hosts on every sign-in path, T4 policies |
| 7-1 | B | T5 coach side, T6 invite and mails, T7 lifecycle, T8 admin routes |
| 7-2 | A | T1 views, T2 me and athletes, T3 Acasă, T4 Istoric and profile |
| 7-2 | B | T5 calendar, T7 money and PDF, T9 routes and matrix |
| 7-3 | A | T2 client, T5 source and routes, plus a re-read of 7-2 T9 matrix on the merged branch |

## Boot checks (throwaway Postgres, never the user's environment)

Ports checked free of every earlier plan and script (used so far include 55441 to 55476, 55491, 1337 to 1395, 1400, 1415, 1440, 3000, 3010, 3200, 3207, 3218, 3219, 3221, 3293, 3294, 18890 to 18893, 18897). Run `lsof -i :<pg> -i :<strapi>` before each check; both must be free.

| Plan | Postgres container / port | Strapi port | Other |
|---|---|---|---|
| 7-1 | `es71-pg` 127.0.0.1:55481 | 1411 | |
| 7-2 | `es72-pg` 127.0.0.1:55482 | 1412 | |
| 7-3 | `es73-pg` 127.0.0.1:55483 | 1413 | fake skate-results 127.0.0.1:18894 |
| frontend click-through | `es74-pg` 127.0.0.1:55484 | 1414 | Next 3231, fake skate-results 18895 |

Never 5432, 55442, 1337, 1340, 3010, `strapi_app`, `strapi_db`, `edusport-test-pg`, or any container of the user. The four Postgres ports are added to `THROWAWAY_PORTS` in every fixture a check loads (`scripts/fixtures/phase4-shape.js`, `phase5-shape.js`, `phase6-shape.js`, new `phase7-shape.js`) in 7-1 Task 10; the fixtures refuse any other port. Each check: `postgres:16`, fixtures in that order with `ES_THROWAWAY_DB=1 IDS_FILE=<scratch>/ids.json`, restart Strapi once to prove the schema boots, run the plan's click-through script, remove the container.

Env of every check: `PORTAL_BFF_SECRET=test-bff-secret-000000000000000000`, `PORTAL_HOSTS=antrenor,sportiv`, `JWT_SECRET` any, `AUTH_SECRET_KEY` and `AUTH_CODE_KEY` from `openssl rand -base64 32` at the start of the check (never written to a file in the repo; without them reset and 2FA answer 503), `WEBAUTHN_RP_ID=localhost`, `WEBAUTHN_ORIGINS=http://antrenor.localhost:<next>,http://sportiv.localhost:<next>`, `ADMIN_HOST=localhost:<strapi>`, `ADMIN_ORIGIN=http://localhost:<strapi>`, Brevo unset (mails log "blocked: no-key"), `SKATE_RESULTS_API=http://127.0.0.1:18894` in the 7-3 check (its fake server) and `http://127.0.0.1:9` (a closed port) in every other backend check, so competitions answer `available: false` and the real service is never called. Admin calls of a click-through use an admin session from `POST /api/admin-auth/login` (the 6b gate closes `POST /admin/login`).

Fixture `phase7-shape.js` (synthetic only): `parinte1@example.invalid` (password `Throwaway-Parent-1`) holding "Ana Ionescu" (Școala, Intermediari Bronze, active abonament 4/8, 26 presences this season, one earlier main group) and "Matei Ionescu" (Școala, Începători); `sportiv18@example.invalid` adult athlete "Ioana Marin" (Club Performanță, skate slug `ioana-marin-test`); `antrenor1@example.invalid` (phase 6 coach) also holding "Radu Pop"; "Elena Stan" status `nou` with an e-mail (no access); `parinte2fa@example.invalid` holding "Sara Dinu" with the 2FA app on (TOTP secret written only to the scratch `IDS_FILE`).

## HTTP contracts (binding for the frontend plan)

Shape as phase 6: success `200 { data: T }`; handler refusal `{ data: null, error: { status, name: 'ClubAdminError', message } }`, `message` the exact text to show. Policy refusals are Strapi errors: read the status and `error.name`, never the message. Dates `YYYY-MM-DD`, times `HH:mm`, months `YYYY-MM`, instants ISO UTC; ids are documentIds; money numbers in RON.

### Auth routes (phase 6 and 6b, changed)

- `host` in every login-like body (`login`, `2fa` pending data, `google`, `passkey/verify`, `reset/confirm`, `invite/accept`, `refresh`) accepts `'antrenor' | 'sportiv'`; the BFF sends the host of its site, never the client's. On `sportiv` the account needs a live access (spec 5.1); the refusal is the phase 6 401 "E-mailul sau parola nu sunt corecte." (passkey: the 6b 401 "Nu am putut folosi cheia de acces.").
- Unchanged from 6b and binding for the sportiv BFF too: `login`, `reset/confirm` and a first Google link by e-mail of an account with 2FA answer `SecondStep & { pending: string; deviceKey: string | null }`. The BFF keeps `pending` in its own HttpOnly cookie, stores `deviceKey` at once as its device cookie (replacing any other) and sends it back as `deviceKey` with `POST /api/portal/auth/2fa`; without it the code answers 401 "Intrarea a expirat. Intră din nou.". A session answer with `deviceKey: null` means keep the current key. The pending data carries the host of the password step; the code step enters only that host. A Google link removed earlier (`googleUnlinkedAt`) is never re-made by e-mail. Session answers carry `offerPasskey`.
- `POST /api/portal/auth/invite/read` answers `{ state: 'valid'; email; host: 'antrenor' | 'sportiv' } | { state: 'expired'; email: null; host: null }`. Accept on either host; when the page's host cannot be entered after accept, the answer is 200 `{ data: { session: null, host } }` and the BFF shows the login page of that host. Otherwise `data` is the session answer as today.
- Sign-in URLs (6b, English) on both hosts: `/login`, `/login/2fa`, `/forgot-password`, `/invite`, `/invite/<secret>`; Google refusals come back as `/login?error=google`. Mails link `https://<host>/invite/<secret>` (`inviteLink`).
- `GET /me/devices` (both hosts) lists only the confirmed, not revoked devices of the session's host (6b hides unconfirmed rows: `isConfirmedDevice`).

### Securitate (`src/api/portal/routes/03-security.ts`, now `{ auth: false, policies: ['global::is-portal-user'] }`)

Paths, bodies and answers unchanged from the 6b index (`/portal/me/security`, `2fa/totp`, `2fa/email`, `backup-codes`, `reauth`, `passkeys`, `passkey-offer/dismiss`). The policy accepts a live session of either host whose account may still enter that host (7-1 T4) and sets `ctx.state.portalUser`; the controller reads it instead of `ctx.state.coach`. Devices listed under Securitate are the session host's only.

### Sportiv routes (`src/api/portal/routes/04-sportiv.ts`, `{ auth: false, policies: ['global::is-sportiv'] }`)

Policy: 403 non-`ClubAdminError` = secret refused or the account can no longer enter `sportiv` (clear cookies, login); 401 = refresh once. Handler 403 `"Nu mai ai acces la acest sportiv."` (`ClubAdminError`) = this athlete is no longer held: go to `/` (picker or the only athlete). 404 `"Nu a fost găsit."`; 400 `"Cerere invalidă."`.

Types live in `src/club/portal/sportiv/api-types.ts` (7-2 Task 1; no Strapi, Node or React imports, copied verbatim by the frontend). Lists that can grow page by 20 (user rule 2026-11-10: 20 rows, then "Arată mai multe" adds the next 20):

```ts
export type SectionKind = 'school' | 'club';
export type SportivMe = { email: string; name: string | null; phone: string | null; hasPassword: boolean; google: boolean; passwordChangedAt: string | null; notifySchedule: boolean; devices: number };
export type PortalDevice = { id: string; label: string; lastSeenAt: string; current: boolean; twoFactorUntil: string | null }; // same shape as CoachDevice
export type SportivAthleteRow = { id: string; name: string; firstName: string; groupName: string | null; age: number | null; section: SectionKind | null; inPicker: boolean; performance: boolean };
export type SportivAthletes = { athletes: SportivAthleteRow[] };
export type CalendarKind = 'grupa' | 'individual' | 'concurs';
export type CalendarItem = { date: string; startTime: string | null; endTime: string | null; kind: CalendarKind; title: string; location: string | null; coaches: string[]; cancelled: boolean; note: string | null };
export type MonthBar = { month: string; count: number | null; state: 'past' | 'current' | 'future' };
export type Level = { groupId: string; groupName: string; sectionName: string; section: SectionKind; location: string | null };
export type AbonamentShort = { code: string | null; next: number; slots: number; validUntil: string };
export type CompetitionRow = { resultId: string; eventName: string; date: string | null; location: string | null; category: string; categoryShort: string; placement: number | null; total: number | null };
export type LastCompetition = { available: false } | { available: true; stale: boolean; updatedAt: string; row: CompetitionRow; field: number | null };
export type Promotion = { from: string; to: string };
export type SportivHome = {
  athlete: { id: string; name: string; firstName: string; age: number | null; inactive: boolean };
  level: Level | null; category: string | null; seasonLabel: string | null;
  presences: { total: number; months: MonthBar[] }; upcoming: CalendarItem[];
  abonament: AbonamentShort | null; lastCompetition: LastCompetition | null; promotion: Promotion | null;
};
export type SportivProfile = { name: string; birthDate: string | null; age: number | null; contactName: string | null; phone: string | null; email: string | null };
export type HistoryRow = { date: string; startTime: string | null; kind: 'Grup' | 'Individual'; groupName: string | null; coaches: string[] };
export type SportivHistory = { seasonLabel: string | null; total: number; group: number; individual: number; page: number; pageSize: 20; rows: HistoryRow[] };
export type SportivCalendar = { month: string; prevMonth: string | null; nextMonth: string | null; items: CalendarItem[] };
export type BadgeKey = 'antrenamente' | 'sezon' | 'prima' | 'concursuri';
export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'ice';
export type Badge = { key: BadgeKey; tier: Tier | null; label: string; count: number; next: number | null; tiers: { threshold: number; tier: Tier; reachedOn: string | null }[] };
export type SportivPath = {
  now: { groupName: string; since: string; location: string | null; program: string | null } | null;
  next: { groupName: string } | null; before: { groupName: string; from: string; to: string }[]; badges: Badge[];
};
export type MoneyLine = { text: string; amount: number };
export type SportivMoney = { left: number; lines: MoneyLine[]; advance: number | null; abonament: (AbonamentShort & { itemName: string; startsOn: string }) | null; document: { seasonLabel: string } | null };
export type PaymentRow = { what: string; paidOn: string; method: 'numerar' | 'card' | 'transfer'; amount: number };
export type SportivPayments = { page: number; pageSize: 20; total: number; rows: PaymentRow[] };
export type Ticket = { code: string | null; itemName: string; startsOn: string; validUntil: string; slots: number; used: string[]; left: number };
export type SportivSubscriptions = { active: Ticket | null; earlier: { itemName: string; used: number; slots: number; validUntil: string }[] };
export type CompetitionSort = 'recent' | 'place' | 'points';
export type SportivCompetitions = { available: false } | {
  available: true; stale: boolean; updatedAt: string; total: number;
  category: { current: string; seasonLabel: string; previous: { short: string; sinceYear: number } | null } | null;
  records: { best: number | null; podiums: number; wins: number }; seasons: string[]; page: number; pageSize: 20; filtered: number; rows: CompetitionRow[];
};
export type Segment = { name: string; isShort: boolean; score: number | null; tes: number | null; pcs: number | null; deductions: number | null; elements: { name: string; base: number | null; score: number | null }[] };
export type SportivCompetition = { available: false } | {
  available: true; stale: boolean; updatedAt: string; row: CompetitionRow; field: number | null; best: number | null; segments: Segment[]; officialUrl: string | null;
};
```

| Method and path | Query / body | `data` |
|---|---|---|
| `GET /api/portal/sportiv/me` | | `SportivMe` |
| `PUT /api/portal/sportiv/me` | `{ name: string, phone: string \| null }` | `{ toast: "Salvat." }`; 400 `"Numele trebuie să aibă între 1 și 80 de caractere."` |
| `PUT /api/portal/sportiv/me/notifications` | `{ schedule: boolean }` | `{ toast: "Salvat." }` |
| `POST /api/portal/sportiv/me/password` | `{ current?: string, password }` | `{ toast: "Salvat." }` (phase 6 rules and texts; remembered 2FA devices forgotten as 6b) |
| `GET /api/portal/sportiv/me/devices` | header `x-portal-device` | `PortalDevice[]` |
| `DELETE /api/portal/sportiv/me/devices/:id` | | `{ revokedCurrent: boolean }` |
| `GET /api/portal/sportiv/athletes` | | `SportivAthletes` |
| `GET /api/portal/sportiv/athletes/:athleteId/home` | | `SportivHome` |
| `POST /api/portal/sportiv/athletes/:athleteId/promotion/seen` | `{}` | `{ ok: true }` |
| `GET /api/portal/sportiv/athletes/:athleteId/profile` | | `SportivProfile` |
| `GET /api/portal/sportiv/athletes/:athleteId/history` | `?page=` (1 based) | `SportivHistory` |
| `GET /api/portal/sportiv/athletes/:athleteId/calendar` | `?month=YYYY-MM` (default current) | `SportivCalendar`; 400 outside the season |
| `GET /api/portal/sportiv/athletes/:athleteId/calendar.ics` | | `text/calendar; charset=utf-8`, `Content-Disposition: attachment; filename="edusport-<prenume>.ics"` |
| `GET /api/portal/sportiv/athletes/:athleteId/path` | | `SportivPath` |
| `GET /api/portal/sportiv/athletes/:athleteId/money` | | `SportivMoney` |
| `GET /api/portal/sportiv/athletes/:athleteId/payments` | `?page=` | `SportivPayments` |
| `GET /api/portal/sportiv/athletes/:athleteId/subscriptions` | | `SportivSubscriptions` |
| `GET /api/portal/sportiv/athletes/:athleteId/documents/acord` | | `application/pdf` attachment; 404 when none |
| `GET /api/portal/sportiv/athletes/:athleteId/competitions` | `?q=&season=&sort=recent\|place\|points&page=` | `SportivCompetitions`; 404 for a non-performance athlete |
| `GET /api/portal/sportiv/athletes/:athleteId/competitions/:resultId` | | `SportivCompetition`; 404 when the result is not in this athlete's history |

The two binary routes answer refusals as JSON with the usual shape.

### Admin routes (`src/api/club/routes/14-athlete-access.ts`, `adminRoute('club')` of `src/club/admin-area.ts`)

```ts
export type AccessState = 'none' | 'invited' | 'active' | 'disabled';
export type AccessBlock = { athleteId: string; state: AccessState; email: string | null; since: string | null; adult: boolean; canInvite: boolean; hint: string | null };
export type BulkPreview = { invites: number; addresses: number; skipped: { athleteId: string; name: string; reason: 'nou' | 'fără e-mail' | 'are deja acces' | 'anonimizat' }[] };
```

| Method and path | Body | `data` |
|---|---|---|
| `GET /api/club/athletes/:documentId/access` | | `AccessBlock` |
| `POST /api/club/athletes/:documentId/access/invite` | `{}` | `{ access: AccessBlock; toast: "Invitație trimisă." \| "Acces adăugat." }`; 409 `"Contul acestei adrese este dezactivat."`; 409 `"Confirmă sportivul întâi."`; 400 `"Adaugă un e-mail în Date."` |
| `POST /api/club/athletes/:documentId/access/resend` | `{}` | `{ access; toast: "Invitație trimisă." }`; 409 stale |
| `POST /api/club/athletes/:documentId/access/remove` | `{}` | `{ access; toast: "Acces scos." }` |
| `POST /api/club/athletes/access/bulk-preview` | `{ ids: string[] }` (max 200) | `BulkPreview` |
| `POST /api/club/athletes/access/bulk-invite` | `{ ids: string[] }` | `{ sent: number; toast: "<n> invitații trimise." }` |
| `POST /api/club/portal-accounts/:documentId/disable-all` (in `12-portal-accounts.ts`, `adminRoute('coachAccounts')`) | `{}` | `{ account: AccountBlock; toast: "Cont dezactivat." }` |

`AccountBlock` (phase 6, with 6b `twoFactor`) gains `hasSportiv: boolean` and `coachDisabled: boolean`; "Dezactivează tot" shows when `hasSportiv`.

## Rulings made while planning (low impact, decided by Claude)

Log each in DECISIONS.md as "plan 7, decided by Claude (low impact, 2026-11-07)" (1 to 7) or "(2026-11-11 refresh)" (8 to 14).
1. Access code lives in `src/club/portal/access/`, sportiv reads in `src/club/portal/sportiv/`, competitions in `src/club/skate/` (7-1 T1, 7-2 T1, 7-3 T1).
2. The access check runs in the controller helper `withAthlete(ctx, handler)` before the reader is called, so a reader never receives an athlete id that was not checked (7-2 T9).
3. Superseded 2026-11-11: history, payments and competitions page by 20 (user list-limit rule of 2026-11-10), not 10, 10 and 8 as drawn (7-2 T4, T7; 7-3 T5).
4. `.ics` UID = `<kind>-<id>-<date>@edusport`; times as Europe/Bucharest floating local times with `TZID` (7-2 T5).
5. The coach-side disable keeps the U&P user unblocked; only "Dezactivează tot" blocks it (7-1 T5).
6. A sportiv session is told apart from a coach session by `portal_sessions.host` (the column exists since phase 6), checked in both policies (7-1 T3, T4).
7. Bulk invite caps at 200 ids per call, as the anonymize bulk (`MAX_BULK`) (7-1 T8).
8. Route files are `04-sportiv.ts` and `14-athlete-access.ts` (spec 10.1 and 10.2 said `03-` and `13-`; `03-security.ts` and `13-tables.ts` exist now).
9. New admin routes use `adminRoute(area)` (`club` for athlete access, `coachAccounts` for disable-all), as 6b route areas.
10. Securitate policy name `global::is-portal-user`, state `ctx.state.portalUser = { accountId, userId, sessionId, host, actor }`; `is-coach` keeps setting `ctx.state.coach` and also refuses a session whose host is not `antrenor`.
11. History actor of a holder (Securitate lines, 6b): the account `name`, else its e-mail; a coach keeps "Antrenor <nume>". Holder logins and reads still write no lines (spec 13).
12. A device row belongs to one host: `createDeviceRow` writes the host of the sign-in, and `deviceByKey` finds a row only on the host asked. The new-device mail limit stays per account (one mail an hour across both hosts) and the mail names the host.
13. The sportiv competition source is a separate interface beside `CoachCompetitionSource`, both in the existing pattern (interface, null source, `SkaterRef` from `athlete.profileId` and `skateResultsSlug`); the slug lookup is shared (7-2 T1).
14. The forbidden-key walker of `src/club/portal/coach/views.ts` moves to `src/club/portal/forbidden-keys.ts` and reports dotted paths with a path allow list; coach and sportiv keep their own key lists (7-2 T1).

## Refresh 2026-11-11 (what changed in these plans)

- Base, ports, env and fixtures: new boot-check ports (none of 55465 to 55468 or 1385 to 1388 are used any more), 6b env (`AUTH_*`, `WEBAUTHN_*`, `ADMIN_*`), fixture port allowlists, click-through scripts at `scripts/clickthrough-7-*.sh` (the repo keeps them there, not in `scripts/portal/`).
- 6b landed: every sign-in path (second step, Google first link, passkey, reset) learns the host; unconfirmed devices and `deviceKey` round trip kept; Securitate becomes host-generic, so the sportiv Setări gets 2FA and passkeys (spec 6.9: "hidden until P6b-2 ships", it shipped); admin route areas.
- Coach additions and training add: reuse `ownClassesBetween`'s building blocks (`loadRowContext`, `rowsWithCoachIds`, `expandOccurrences`, `store.lessons`, `locationsOf`) for the sportiv calendar so one-off classes, removed dates and lesson series appear exactly as for the coach; reuse `CoachCompetitionSource`'s pattern, `SkaterRef` and `clubSkaters`' slug lookup; reuse the card's abonament reading (`abonamentSlots`, `pickSubscription`, `usedSlots`); reuse `FORBIDDEN_KEYS`'s walker.
- Names fixed against the code: `programText` does not exist (use `programLine` and `daysSpoken` of `src/club/groups/program-text.ts` with `readGroupProgram`); `athleteSubscriptions` does not exist (use `readAthleteSubscriptionCards` of `src/club/presence/subscriptions/usage.ts`); `countWords` lives in `src/club/ro-count.ts`; `relinkAccount` is private in `accounts/invite.ts`.
- Tests rewritten to behaviour: route-list and source-reading tests, schema attribute pins, fake-store parity tests and copy-string tables removed; Postgres tests kept for unique indexes and races.
- List limits: page size 20.

## Open questions for the user (each has a default the plans follow until answered)

1. **Securitate on sportiv:** the spec hid the 2FA row until 6b-2 shipped; it has. Default: the sportiv Setări shows 2FA, chei de acces and devices exactly as the coach Securitate, through the host-generic routes (7-1 T4, frontend T12).
2. **Frontend order:** the coach 2FA step, passkey login and Securitate UI (frontend plan `2026-11-07-phase6b-frontend.md`, on `docs/portal-design`) are not built yet, and that plan still names `/intrare` paths. Default: refresh and run it before the phase 7 frontend, which then makes those parts site-aware; the backend phase 7 plans do not wait for it.
3. **List limits on sportiv:** the boards draw a pager (10 per page, competitions 8). Default: 20 rows, then "Arată mai multe" (the 2026-11-10 rule for every portal list).
4. **Promotion moment and badge zoom motion:** the boards animate for up to 2 s with an overshoot; the 2026-11-11 motion rule says one effect per element, 80 to 180 ms, no bounce. Default: the motion rule (same sequence, token timings, no overshoot); the reduced-motion state shows the new level at once.
5. **Now tile on sportiv desktop pages:** the kit page header shows it on every page from the desktop breakpoint. Default: keep it on sportiv pages too (one header for both portals).
6. **Coach real competition source** (coach additions Task 8) waits for 7-3. Default: run it from its own plan right after 7-3 Task 5 merges, not folded into 7-3.
7. **Account button on sportiv:** the kit sidebar account button is a link (layout v2); the sportiv design opens the athlete menu. Default: the link opens the athlete menu as a URL-driven popup (`?cont=1` over the current page), the same pattern as the coach form popups.
