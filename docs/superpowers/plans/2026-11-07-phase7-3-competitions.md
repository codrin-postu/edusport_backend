# Phase 7-3: Competitions from skate-results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A performance athlete's own competitions in the sportiv app: list with search, season filter, sort and paging, one competition in detail, the category, the Acasă card and the Concursuri badge, all through Strapi, cached in Postgres and alive when skate-results is down.

**Architecture:** `src/club/skate/` holds a small client (`client.ts`, timeout and API key), a snapshot cache over the `skate-snapshot` table (`cache.ts`, fresh, stale-while-revalidate, failure kept), pure derivations (`derive.ts`: season, category, short form, records, filter, sort, page, field size) and the real `CompetitionSource` (`source.ts`). Two sportiv routes use it; plan 7-2's null source is replaced in `sportivContext`.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS), Postgres 16, Vitest 3, Node 22 (`fetch`, `AbortSignal.timeout`).

**Spec:** `docs/superpowers/specs/2026-11-07-sportiv-app-design.md` sections 3.4, 6.3 (card), 7 (Concursuri badge), 8, 14.2. Index: `docs/superpowers/plans/2026-11-07-phase7-index.md` (contracts binding). skate-results: `Programming/skate-results/README.md`, `app/schemas.py` (`SkaterDetail`, `SkaterResultItem`, `SegmentDetailOut`, `ResultProtocolOut`, `EventResultItem`, `EventSearchItem`).

**Base:** `feat/athletes` with 7-1 merged. Parallel with 7-2; Task 5 needs 7-2 Task 1 (`CompetitionSource`, types) merged, else it waits. Ledger `p3be/.superpowers/sdd/2026-11-07-phase7-3/progress.md`.

| Task | Risk | Model | Batch |
|---|---|---|---|
| 1 Snapshot table and store | low | Haiku | |
| 2 Skate client | high (secret, outbound calls) | Sonnet | A |
| 3 Snapshot cache | low | Sonnet | |
| 4 Pure derivations | low | Haiku | |
| 5 Source, routes, Acasă card and badge wiring | high (data exposure) | Sonnet | A |
| 6 Fake server, boot check, click-through | low | Haiku | |

This plan has two high-risk tasks; batch A adds a re-read of 7-2 Task 9's matrix on the merged branch so the batch reviews three pieces.

## Global Constraints

- Everything in plan 7-1 "Global Constraints". Boot check `es73-pg` on 127.0.0.1:55467, Strapi 1387, fake skate-results on 127.0.0.1:18893.
- Strapi only calls skate-results; base `SKATE_RESULTS_API` (default `https://skate-api.codrin.space`), header `X-API-Key` from `SKATE_RESULTS_API_KEY` when set; the key never appears in an answer or a log. Tests and checks never reach the real service (`SKATE_RESULTS_API` points at the fake or `http://127.0.0.1:9`).
- Timeout 3000 ms per call. Freshness: results 1 hour, protocol and field size 24 hours (spec 8.3).
- Matching only through `athlete.publicProfile.skateResultsSlug` (spec 8.1); no name search anywhere in this plan.
- No other skater's name, id or score leaves Strapi: `GET /events/{id}/results` is reduced to a count per category inside `client.ts`.
- Files this plan may touch: `src/club/skate/**`, `src/api/skate-snapshot/**`, `src/club/portal/sportiv/{context,competitions,home,athletes}.ts`, `src/api/portal/routes/03-sportiv.ts`, `src/api/portal/controllers/sportiv.ts`, `scripts/portal/fake-skate.mjs`, `scripts/portal/clickthrough-7-3.sh`, `src/index.ts` (bootstrap nothing new; the table is a content type).

## Review Focus

- **skate-results down on a cold cache**: Acasă still answers within 3.5 s with `lastCompetition: { available: false }`, the list and detail answer `{ available: false }`, the badge is locked. Pinned by Task 5 (`down and cold`).
- **skate-results down on a warm cache**: the old data is answered with `stale: true` and `updatedAt` of the last good fetch; the failure does not overwrite the body. Pinned by Task 3.
- **A burst of opens** (parent refreshing Acasă five times): one outbound refresh per key at a time. Pinned by Task 3 (`single flight`).
- **A result id of another skater** typed into the detail URL: 404, no protocol fetched. Pinned by Task 5.
- **Diacritics and case in search** ("brasov" finds "Brașov", "CUPA" finds "Cupa României"). Pinned by Task 4.

---

### Task 1: Snapshot table and store (low, Haiku)

**Files:**
- Create: `src/api/skate-snapshot/content-types/skate-snapshot/schema.json` (spec 3.4), core factories with closed routes, `src/club/skate/{types,store,strapi-store,fake-store}.ts`
- Test: `src/club/skate/__tests__/store.test.ts`

**Interfaces:**
- Produces:

```ts
export type Snapshot = { key: string; body: unknown; fetchedAt: string; failedAt: string | null };
export interface SnapshotStore { get(key: string): Promise<Snapshot | null>; put(key: string, body: unknown, at: string): Promise<void>; fail(key: string, at: string): Promise<void> }
```

- [ ] **Step 1: Failing test** (fake and Strapi store, parity): `put` then `get` returns the body and `failedAt: null`; `fail` keeps the body and sets `failedAt`; a later `put` clears `failedAt`; `key` unique (second `put` updates, not inserts).
- [ ] **Step 2: Run** `npx vitest run src/club/skate/__tests__/store.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/api/skate-snapshot src/club/skate && git commit -m "feat(skate): snapshot table for competition data"`

### Task 2: Skate client (high, Sonnet)

**Files:**
- Create: `src/club/skate/client.ts`
- Modify: `src/api/skate/controllers/skate.ts` (reuse `base()` and the key header from `client.ts`; behaviour unchanged)
- Test: `src/club/skate/__tests__/client.test.ts`

**Interfaces:**
- Produces:

```ts
export type SkateResult = { result_id: number | null; placement: number | null; event_id: number; event_slug: string | null; event_name: string; event_date: string | null; event_location: string | null; category: string; total_score: number | null; short_score: number | null; free_score: number | null; segments: { segment: string; is_short: boolean; tss: number | null; tes: number | null; pcs: number | null; deductions: number | null }[] };
export type SkateProtocol = { result_id: number; segments: { segment: string; is_short: boolean; tss: number | null; tes: number | null; pcs: number | null; deductions: number | null; elements: { name: string; base_value: number | null; score: number | null }[] }[] };
export type Fetched<T> = { ok: true; value: T } | { ok: false; reason: 'down' | 'not_found' };
export interface SkateClient {
  results(slug: string): Promise<Fetched<SkateResult[]>>;      // GET /skaters/{slug}/results?segments=summary
  protocol(resultId: number): Promise<Fetched<SkateProtocol>>; // GET /results/{id}/protocol
  fieldSize(eventId: number, category: string): Promise<Fetched<number>>; // GET /events/{id}/results, count of rows with that category
  officialUrl(eventId: number, name: string): Promise<Fetched<string | null>>; // GET /events?q=<name>&limit=20, source_url of the row with id
}
export function skateClient(env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch): SkateClient;
```

- [ ] **Step 1: Failing tests** (fake `fetch`): slug is URL-encoded; `X-API-Key` sent only when the env key is set; a 404 -> `not_found`; a 500, a network error and a 3001 ms delay -> `down`; a non-array JSON for results -> `down`; `fieldSize` returns a number and the returned value has no names (type and runtime: the function returns a plain number); no log line contains the key (log spy over every case); response bodies over 2 MB -> `down`.
- [ ] **Step 2: Run** `npx vitest run src/club/skate/__tests__/client.test.ts src/api/skate`. Expected: new FAIL, admin proxy tests PASS.
- [ ] **Step 3: Implement** with `AbortSignal.timeout(3000)`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/skate src/api/skate && git commit -m "feat(skate): server client with timeout and key"`

### Task 3: Snapshot cache (low, Sonnet)

**Files:**
- Create: `src/club/skate/cache.ts`
- Test: `src/club/skate/__tests__/cache.test.ts`

**Interfaces:**
- Consumes: `SnapshotStore` (T1), `Fetched<T>` (T2).
- Produces:

```ts
export type Cached<T> = { available: false } | { available: true; value: T; stale: boolean; updatedAt: string } | { available: true; missing: true };
export function snapshotCache(store: SnapshotStore, now: () => Date, schedule: (job: () => Promise<void>) => void): {
  read<T>(key: string, maxAgeMs: number, load: () => Promise<Fetched<T>>): Promise<Cached<T>>;
};
export const RESULTS_MAX_AGE = 3_600_000; export const DETAIL_MAX_AGE = 86_400_000;
```

- [ ] **Step 1: Failing tests.** Fresh snapshot -> answered, `load` not called. Old snapshot -> answered at once with `stale: false` (or `true` when `failedAt` is set), and one refresh scheduled; the refresh success replaces the body. `single flight`: five reads of one old key schedule one refresh. No snapshot -> `load` inline: ok stores and answers; `down` answers `{ available: false }` and stores nothing; `not_found` answers `{ available: true, missing: true }` and stores an empty marker for the max age. A failed refresh calls `store.fail` and keeps the body; the next read answers `stale: true` with the old `updatedAt`.
- [ ] **Step 2: Run** `npx vitest run src/club/skate/__tests__/cache.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** In-flight keys in a module `Map`, removed in `finally`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/skate && git commit -m "feat(skate): snapshot cache with stale answers"`

### Task 4: Pure derivations (low, Haiku)

**Files:**
- Create: `src/club/skate/derive.ts`
- Test: `src/club/skate/__tests__/derive.test.ts`

**Interfaces:**
- Produces:

```ts
export function seasonKey(date: string | null, name: string): string | null; // Sep to Aug, as edusport_frontend src/lib/skate-results.ts
export function shortCategory(category: string): string;
export function currentCategory(rows: SkateResult[], currentSeason: string): { current: string; seasonLabel: string; previous: { short: string; sinceYear: number } | null } | null;
export function records(rows: SkateResult[]): { best: number | null; podiums: number; wins: number };
export function fold(s: string): string; // lower case, diacritics removed (ș ş -> s, ț ţ -> t, ă â -> a, î -> i)
export function listRows(rows: SkateResult[], q: { q: string; season: string | null; sort: CompetitionSort; page: number }): { filtered: number; rows: CompetitionRow[]; seasons: string[] };
export function toRow(r: SkateResult): CompetitionRow;
```

- [ ] **Step 1: Failing tests.** `seasonKey('2026-10-26','x')` "2026-2027"; `('2026-06-15','x')` "2025-2026"; `(null,'Winter Cup 2026')` "2025-2026"; none -> null. `shortCategory('Advanced Novice Girls')` "Adv. Novice"; `'Junior Women'` "Junior"; `'Basic Novice Boys'` "Basic Novice"; `'Senior Ice Dance'` unchanged. `currentCategory`: latest in current season Advanced Novice Girls, earlier Basic Novice from season 2024-2025 -> `previous: { short: 'Basic Novice', sinceYear: 2025 }` (the start year of the first season of the current category); no result this season -> the latest result's category with its season. `records`: best total, placements 1 to 3 counted as podiums, 1 as wins; null placements ignored. `listRows`: "brasov" finds a location "Brașov"; "CUPA" finds "Cupa României"; season filter; sort `recent` by date desc (null dates last), `place` by placement asc (null last) then date desc, `points` by total desc; page 2 of 41 with 8 per page gives rows 9 to 16; `seasons` distinct, newest first; `toRow.resultId` is the string of `result_id`, rows without `result_id` dropped.
- [ ] **Step 2: Run** `npx vitest run src/club/skate/__tests__/derive.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/skate && git commit -m "feat(skate): season, category, records and list derivations"`

### Task 5: Source, routes, Acasă card and badge (high, Sonnet)

**Files:**
- Create: `src/club/skate/source.ts`, `src/club/portal/sportiv/competitions-read.ts`
- Modify: `src/club/portal/sportiv/context.ts` (real source), `src/api/portal/routes/03-sportiv.ts` and `controllers/sportiv.ts` (two routes inside `withAthlete`), `src/club/portal/sportiv/home.ts` (category in `SportivHome.category` and the subline, spec 6.3)
- Test: `src/club/skate/__tests__/source.test.ts`, `src/club/portal/sportiv/__tests__/competitions.test.ts`

**Interfaces:**
- Consumes: T2 to T4; `CompetitionSource` and types (7-2 T1); `withAthlete` (7-2 T9).
- Produces: `skateSource(strapi, cache, client): CompetitionSource` (adds `list(athleteId, query): Promise<SportivCompetitions>` and `detail(athleteId, resultId): Promise<SportivCompetition | null>` beside the 7-2 methods), `readCompetitions(c, athleteId, query)`, `readCompetition(c, athleteId, resultId)`.

- [ ] **Step 1: Failing tests.** `forAthlete` reads `athlete.publicProfile.skateResultsSlug`; no profile or empty slug -> null (route 404 "Nu a fost găsit."). `list` with a warm cache of 41 results: `total` 41, `filtered` per query, `pageSize` 8, `category.current` "Advanced Novice Girls", `records`. `detail` of a result id not in the athlete's results -> null (404) and the client's `protocol` not called; of his own -> segments short first, elements mapped `{ name, base, score }`, `field` from `fieldSize`, `officialUrl` or null. `down and cold`: client `down` everywhere -> `last` `{ available: false }`, `list` `{ available: false }`, `count` null (badge locked), and `readHome` still answers the rest. `count` returns the distinct event count and their dates oldest first. Leak walk: `forbiddenKeysIn` of list and detail answers empty, and no string field equals a fixture name of another skater.
- [ ] **Step 2: Run** `npx vitest run src/club/skate/__tests__/source.test.ts src/club/portal/sportiv/__tests__/competitions.test.ts src/club/portal/sportiv/__tests__/matrix.test.ts`. Expected: FAIL (matrix PASS).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/club/skate src/club/portal/sportiv src/api/portal && git commit -m "feat(portal): sportiv competitions from skate-results"`

### Task 6: Fake server, boot check, click-through (low, Haiku)

**Files:**
- Create: `scripts/portal/fake-skate.mjs` (Node http on 127.0.0.1:18893: `/skaters/ioana-marin-test/results` 41 synthetic results over three seasons, `/results/<id>/protocol`, `/events/<id>/results` with synthetic names, `/events?q=`; env `FAKE_SKATE_DOWN=1` answers 503), `scripts/portal/clickthrough-7-3.sh`

- [ ] **Step 1: Boot** `es73-pg` on 55467, Strapi 1387 with `SKATE_RESULTS_API=http://127.0.0.1:18893`, fixtures 4 to 7, the fake server, restart Strapi once.
- [ ] **Step 2: Click-through** `bash scripts/portal/clickthrough-7-3.sh http://127.0.0.1:1387` as `sportiv18@example.invalid`: `home.lastCompetition.available` true; `competitions?page=1` 8 rows of 41; `?q=brasov` only Brașov rows; `?sort=points` first total is the max; detail of row 1 has two segments; a stranger result id -> 404; restart the fake with `FAKE_SKATE_DOWN=1`, set `fetchedAt` back 2 hours in `skate_snapshots`, open the list twice -> second answer `stale: true`; delete the snapshots -> list `{ available: false }`. Each prints `OK`.
- [ ] **Step 3: Full suite** in a background worktree `npx vitest run`. Expected: PASS. Stop the fake, `docker rm -f es73-pg`.
- [ ] **Step 4: Commit** `git add scripts/portal && git commit -m "chore(skate): fake skate-results and phase 7-3 click-through"`
