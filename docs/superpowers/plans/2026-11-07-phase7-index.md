# Phase 7 plans: the sportiv app, backend (index)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement these plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strapi side of phase 7: athlete access for parents and adult athletes, the per-host account rules, the admin "Acces portal" tools, every `/portal/sportiv/*` read route, and the skate-results integration with its cache.

**Architecture:** A new `src/club/portal/access/` module (access rows, invite outcomes, lifecycle moves) and `src/club/portal/sportiv/` (policy context, explicit views, one reader per screen) on top of the phase 6 `PortalStore`, sessions and mails, and the phase 4 and 5 reads. Competitions live in `src/club/skate/` (client, snapshot cache, pure derivations). Every sportiv route goes through `global::is-sportiv` and an access check on the athlete id before any read.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS), Postgres 16, Vitest 3, Node 22.

**Spec (binding):** `docs/superpowers/specs/2026-11-07-sportiv-app-design.md` (draft v1, 2026-11-07). Earlier: `2026-11-04-coach-portal-design.md` (P6), `2026-10-27-attendance-payments-design.md` (P5). Decisions: `edusport_frontend/docs/portal/DECISIONS.md`. Design: `edusport_frontend/docs/portal/mockups/screens/phase7-sportiv-canvas/`. Conventions: `docs/HANDOFF.md`, `CLAUDE.md`, phase 6 plans (store pattern with fake and parity tests, transactions and row locks, Istoric lines, copy modules). Agent rules: `.superpowers/phase3-shared/agent-rules.md`.

The website (host, BFF, screens) is the frontend plan in `edusport_frontend/docs/superpowers/plans/2026-11-07-phase7-frontend-index.md`; it consumes the contracts below and nothing else.

## Plans

| Plan | File | Tasks | Needs merged | Delivers | Risk |
|---|---|---|---|---|---|
| 7-1 | `2026-11-07-phase7-1-access-accounts.md` | 10 | phase 6 on `feat/athletes` | schemas, per-host entry, device and token host, `global::is-sportiv`, role-aware coach disable and coach invite, parent invite, resend, remove, mails, e-mail move, anonymize, delete, merge, admin routes `13-athlete-access.ts`, bulk invite, "Acces portal" admin block, boot check | high |
| 7-2 | `2026-11-07-phase7-2-sportiv-routes.md` | 10 | 7-1 | views and forbidden keys, me and settings, athletes and picker, Acasă with promotion, Istoric, Date sportiv, Calendar and `.ics`, Parcurs with badges, money, payments, abonament, registration PDF, schedule-mail switch, routes `03-sportiv.ts`, host and access matrix, boot check | high |
| 7-3 | `2026-11-07-phase7-3-competitions.md` | 6 | 7-1 | snapshot table, skate client, cache, pure derivations (season, category, records, filters), competitions list and detail routes, Acasă card and Concursuri badge wiring, boot check | high |

Total 26 tasks. Order: 7-1, then 7-2 and 7-3 in parallel (one worktree each from `feat/athletes` after 7-1 is merged). 7-2 builds against the `CompetitionSource` interface (7-2 Task 1) with the null source; 7-3 Task 5 plugs the real one in. Whichever of 7-2 and 7-3 merges second runs its boot check on the merged branch.

Model tags: **Haiku** where the plan carries the shape and the work is mechanical, **Sonnet** for integration judgment. **High risk** = auth, sessions, permissions, data exposure, data loss; those tasks get a review per batch (below); all others only the plan's final review.

## Review batches (high-risk tasks, 3 to 4 per batch)

| Plan | Batch | Tasks |
|---|---|---|
| 7-1 | A | T1 schemas and store, T2 rules, T3 hosts and devices, T4 `is-sportiv` |
| 7-1 | B | T5 coach side, T6 invite and mails, T7 lifecycle, T8 admin routes |
| 7-2 | A | T1 views, T2 me and athletes, T3 Acasă, T4 Istoric and profile |
| 7-2 | B | T5 calendar, T7 money and PDF, T9 routes and matrix |
| 7-3 | A | T2 client, T5 routes, plus a re-read of 7-2 T9 matrix on the merged branch |

## Boot checks (throwaway Postgres, never the user's environment)

| Plan | Postgres container / port | Strapi port |
|---|---|---|
| 7-1 | `es71-pg` 127.0.0.1:55465 | 1385 |
| 7-2 | `es72-pg` 55466 | 1386 |
| 7-3 | `es73-pg` 55467 | 1387 |
| frontend click-through | `es74-pg` 55468 | 1388 |

Never 5432, 55442, 1337, 1340, 3010, `strapi_app`, `strapi_db`, `edusport-test-pg`. Each check: `scripts/fixtures/phase4-shape.js`, `phase5-shape.js`, `phase6-shape.js`, then `phase7-shape.js` (7-1 Task 10), restart Strapi once to prove the schema boots, run the plan's click-through script, remove the container. Env: `PORTAL_BFF_SECRET=test-bff-secret-000000000000000000`, `PORTAL_HOSTS=antrenor,sportiv`, `JWT_SECRET` any, Brevo unset, `SKATE_RESULTS_API=http://127.0.0.1:18893` in the 7-3 check (its fake server); `http://127.0.0.1:9` (a closed port) in every other check, so competitions answer `available: false` and the real service is never called.

Fixture `phase7-shape.js` (synthetic only): `parinte1@example.invalid` (password `Throwaway-Parent-1`) holding "Ana Ionescu" (Școala, Intermediari Bronze, active abonament 4/8, 26 presences this season, one earlier main group) and "Matei Ionescu" (Școala, Începători); `sportiv18@example.invalid` adult athlete "Ioana Marin" (Club Performanță, skate slug `ioana-marin-test`); `antrenor1@example.invalid` (phase 6 coach) also holding "Radu Pop"; "Elena Stan" status `nou` with an e-mail (no access).

## HTTP contracts (binding for the frontend plan)

Shape as phase 6: success `200 { data: T }`; handler refusal `{ data: null, error: { status, name: 'ClubAdminError', message } }`, `message` the exact text to show. Policy refusals are Strapi errors: read the status and `error.name`, never the message. Dates `YYYY-MM-DD`, times `HH:mm`, months `YYYY-MM`, instants ISO UTC; ids are documentIds; money numbers in RON.

### Auth routes (phase 6, changed)
- `host` in every login-like body accepts `'antrenor' | 'sportiv'`; the BFF sends the host of its site. On `sportiv` the account needs a live access (spec 5.1); refusal is the phase 6 401 "E-mailul sau parola nu sunt corecte.".
- `POST /api/portal/auth/invite/read` answers `{ state: 'valid'; email; host: 'antrenor' | 'sportiv' } | { state: 'expired'; email: null; host: null }`. Accept on either host; when the page's host cannot be entered after accept, the answer is 200 `{ data: { session: null, host } }` and the BFF shows the login page of that host. Otherwise `data` is the `PortalSession` as today.
- `GET /me/devices` (both hosts) lists only the devices of the session's host.

### Sportiv routes (`src/api/portal/routes/03-sportiv.ts`, `{ auth: false, policies: ['global::is-sportiv'] }`)

Policy: 403 non-`ClubAdminError` = secret refused or the account can no longer enter `sportiv` (clear cookies, login); 401 = refresh once. Handler 403 `"Nu mai ai acces la acest sportiv."` (`ClubAdminError`) = this athlete is no longer held: go to `/` (picker or the only athlete). 404 `"Nu a fost găsit."`; 400 `"Cerere invalidă."`.

Types live in `src/club/portal/sportiv/api-types.ts` (7-2 Task 1; no Strapi, Node or React imports, copied verbatim by the frontend):

```ts
export type SectionKind = 'school' | 'club';
export type SportivMe = { email: string; name: string | null; phone: string | null; hasPassword: boolean; passwordChangedAt: string | null; notifySchedule: boolean; devices: number };
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
export type SportivHistory = { seasonLabel: string | null; total: number; group: number; individual: number; page: number; pageSize: 10; rows: HistoryRow[] };
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
export type SportivPayments = { page: number; pageSize: 10; total: number; rows: PaymentRow[] };
export type Ticket = { code: string | null; itemName: string; startsOn: string; validUntil: string; slots: number; used: string[]; left: number };
export type SportivSubscriptions = { active: Ticket | null; earlier: { itemName: string; used: number; slots: number; validUntil: string }[] };
export type CompetitionSort = 'recent' | 'place' | 'points';
export type SportivCompetitions = { available: false } | {
  available: true; stale: boolean; updatedAt: string; total: number;
  category: { current: string; seasonLabel: string; previous: { short: string; sinceYear: number } | null } | null;
  records: { best: number | null; podiums: number; wins: number }; seasons: string[]; page: number; pageSize: 8; filtered: number; rows: CompetitionRow[];
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
| `POST /api/portal/sportiv/me/password` | `{ current?: string, password }` | `{ toast: "Salvat." }` (phase 6 rules and texts) |
| `GET /api/portal/sportiv/me/devices` | header `x-portal-device` | `CoachDevice[]` (phase 6 type, renamed `PortalDevice` in the copy) |
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

### Admin routes (`src/api/club/routes/13-athlete-access.ts`, `global::is-admin`)

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
| `POST /api/club/portal-accounts/:documentId/disable-all` | `{}` | `{ account: AccountBlock; toast: "Cont dezactivat." }` |

`AccountBlock` (phase 6) gains `hasSportiv: boolean` and `coachDisabled: boolean`; "Dezactivează tot" shows when `hasSportiv`.

## Rulings made while planning (low impact, decided by Claude)

Log each in DECISIONS.md as "plan 7, decided by Claude (low impact, 2026-11-07)".
1. Access code lives in `src/club/portal/access/`, sportiv reads in `src/club/portal/sportiv/`, competitions in `src/club/skate/` (7-1 T1, 7-2 T1, 7-3 T1).
2. The access check runs in the controller helper `withAthlete(ctx, handler)` before the reader is called, so a reader never receives an athlete id that was not checked (7-2 T9).
3. History page size 10, payments 10, competitions 8, as drawn (7-2 T4, T7; 7-3 T5).
4. `.ics` UID = `<kind>-<id>-<date>@edusport`; times as Europe/Bucharest floating local times with `TZID` (7-2 T5).
5. The coach-side disable keeps the U&P user unblocked; only "Dezactivează tot" blocks it (7-1 T5).
6. A sportiv session is told apart from a coach session by `portal_sessions.host`, checked in both policies (7-1 T3, T4).
7. Bulk invite caps at 200 ids per call, as the anonymize bulk (`MAX_BULK`) (7-1 T8).
