# Club Data Foundation (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the club data model (seasons, sections, groups, athletes, memberships, price lists, history) to the Strapi backend, with the business rules as tested pure functions and an idempotent migration from today's data, without changing anything the website or admin uses today.

**Architecture:** Business rules live in `src/club/` as dependency-free TypeScript modules with Vitest tests (the repo has no tests today; this phase adds the harness). New Strapi content types are declared with `schema.json` files and expose NO generated CRUD routes (`only: []`), following the 2026-09-15 security fix. A one-off script, dry-run by default, reads today's data and writes the new records using the tested planners from the compiled `dist/src/club/`.

**Tech Stack:** Strapi 5.52.1, TypeScript (root `tsconfig.json`, `strict: false`, CommonJS), Postgres (prod) / SQLite default locally, Vitest (new dev dependency), Node 22 (Docker) / 20 (CI today).

**Spec:** `docs/architecture/10-spec.md` (section 2 rules 1-9, section 4 migrations, section 7 phase 1). Mapping: `docs/architecture/07-strapi-mapping.md`. Decisions log: `../edusport_frontend/docs/portal/DECISIONS.md`.

## Global Constraints

- Nothing existing breaks: `/api/sportspeople`, the registration form endpoints, the admin pages and the calendar keep working unchanged.
- Every new content type: `draftAndPublish: false`; core router `factories.createCoreRouter(UID, { only: [] })` (no generated content-API routes).
- New admin endpoints use the existing guard object `{ auth: false, policies: ['global::is-admin'], middlewares: [] }`.
- `sportsperson` is NOT renamed in this phase (renaming its API would break the website); it plays the PublicProfile role, linked one-to-one from the new `athlete`. Display name changes later.
- Group names exactly: Skating School: "Avansați Gold", "Primii Pași", "Intermediari Silver", "Avansați Silver", "Începători", "Intermediari Bronze", "Avansați Bronze"; Club: "Profesioniști", "Avansați". Use ș/ț with comma below, never ş/ţ with cedilla.
- Price lists: "Standard" (Primii Pași, Începători, Intermediari Bronze, Intermediari Silver, Avansați Silver, Avansați Bronze) and "Avansați Gold" (Avansați Gold). Club groups: no price list yet.
- Sections: "Școala de Patinaj - AFI Cotroceni" (kind `school`) and "Club" (kind `club`).
- Season label format `YYYY-YYYY` with a hyphen; input may contain an en dash.
- Registration number `<season start year>-<4-digit sequence>`, one numbering across schools.
- A.C.S. membership states: `da`, `nu`, `in_asteptare`.
- Commit messages: Conventional Commits, no AI attribution lines, no `Co-Authored-By`. Do not push.
- Work on branch `feat/club-foundation` (not `main`).
- The migration script never runs against production in this plan; production run is a separate, user-approved step.

## Review Focus

- Season text "2025–2026" (en dash), "2025-2026 ", empty or null: normalized or skipped, never a crash or a wrong season (Task 2).
- Two registrations with the same `submittedAt`: numbering order is stable (by `documentId`), so a re-run gives the same numbers (Task 2).
- Running the migration twice: no duplicate seasons, sections, groups, athletes, price lists or numbers (Task 5 planners take existing records; Task 9 runs it twice).
- Group text with cedilla vs comma letters, different case, extra spaces ("Primii Paşi", "profesionisti ") maps to the right canonical group; unknown names are reported, not invented (Task 5).
- Subscription start where fewer than 4 school weekends are known: validity is `null` ("unknown yet"), not a date in the past (Task 4).

## Not in this phase

- Linking existing Skating School calendar events to groups: needs the admin to choose which event belongs to which group; done in phase 4 (groups and schedules) with the new "Grupă" field in the calendar panel.
- Content types for sessions, attendance, individual lessons, subscriptions, payments (phase 5), documents (phase 8), portal accounts and parent access (phase 6). The rules they need (slot use, validity, membership pricing) are already tested here.
- Renaming `sportsperson` to `public-profile` (API rename breaks the website; later).
- Assigning numbers to NEW registrations on submit (phase 2, registration rebuild).

---

## File Structure

```
src/club/
  season.ts                 normalizeSeasonLabel, seasonStartYear
  registration-number.ts    formatRegistrationNumber, parseRegistrationNumber, planRegistrationBackfill
  acs.ts                    A.C.S. membership states, carryOverAcs, effectiveAcs, usesMemberPrice
  group-membership.ts       checkMainGroup, setMainGroup, countDistinctAthletes
  subscription.ts           weekendKey, subscriptionValidUntil, canUseSlot
  migrate/
    names.ts                normalizeGroupName, nameKey, splitPersonName, parsePrice
    plan.ts                 planSeasons, planGroups, planPriceLists, planAthletes
    canonical.ts            canonical sections, groups, price lists (the constraints above as data)
  __tests__/*.test.ts       Vitest tests, one file per module
  history.ts                recordHistory(strapi, entry)
src/api/<new types>/        season, location, section, price-list, group, athlete,
                            group-membership, acs-membership, history-entry
src/components/club/price-item.json
src/api/club/               admin-only GET /club/summary (no content type)
scripts/migrate-club-foundation.js   dry-run by default, --apply to write
vitest.config.ts
```

---

### Task 1: Branch and test harness

**Files:**
- Create: `vitest.config.ts`
- Create: `src/club/__tests__/harness.test.ts`
- Modify: `package.json` (scripts + devDependencies)
- Modify: `.github/workflows/deploy.yml` (add blocking `test` job, gate `deploy-pull`)

**Interfaces:**
- Produces: `npm test` runs every `src/**/*.test.ts` once and exits non-zero on failure.

- [ ] **Step 1: Create the branch (worktree)**

```bash
cd /Users/codrin/Documents/Programming/edusport_backend
git worktree add .claude/worktrees/club-foundation -b feat/club-foundation main
cd .claude/worktrees/club-foundation
npm ci
```

- [ ] **Step 2: Install Vitest**

```bash
npm install --save-dev vitest@^3.2.0
```

- [ ] **Step 3: Add scripts to `package.json`**

In `"scripts"`, add after `"strapi": "strapi",`:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/admin/**', 'src/plugins/**', 'node_modules/**', 'dist/**'],
    environment: 'node',
  },
});
```

- [ ] **Step 5: Write the harness test**

`src/club/__tests__/harness.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run it**

Run: `npm test`
Expected: `1 passed`.

- [ ] **Step 7: Add the CI job**

In `.github/workflows/deploy.yml`, after the `secret-scan` job and before `# ---------- deploy`, add:

```yaml
  test:
    name: Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.ref }}
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
```

Change `deploy-pull`'s `needs: [secret-scan]` to `needs: [secret-scan, test]`, and in the header comment replace `secret-scan (blocking)` with `secret-scan, test (blocking)`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/club/__tests__/harness.test.ts .github/workflows/deploy.yml
git commit -m "test: add Vitest harness and a blocking test job before deploy"
```

---

### Task 2: Season labels and registration numbers

**Files:**
- Create: `src/club/season.ts`, `src/club/registration-number.ts`
- Test: `src/club/__tests__/season.test.ts`, `src/club/__tests__/registration-number.test.ts`

**Interfaces:**
- Produces:
  - `normalizeSeasonLabel(raw: string | null | undefined): string | null`
  - `seasonStartYear(label: string): number`
  - `formatRegistrationNumber(startYear: number, seq: number): string`
  - `parseRegistrationNumber(value: string | null | undefined): { startYear: number; seq: number } | null`
  - `interface BackfillRow { documentId: string; season: string | null; submittedAt: string | null; registrationNumber: string | null }`
  - `planRegistrationBackfill(rows: BackfillRow[]): { assign: { documentId: string; registrationNumber: string }[]; skipped: { documentId: string; reason: 'no-season' }[] }`

- [ ] **Step 1: Write the failing tests**

`src/club/__tests__/season.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeSeasonLabel, seasonStartYear } from '../season';

describe('normalizeSeasonLabel', () => {
  it('accepts a hyphen', () => expect(normalizeSeasonLabel('2026-2027')).toBe('2026-2027'));
  it('turns an en dash into a hyphen', () => expect(normalizeSeasonLabel('2025–2026')).toBe('2025-2026'));
  it('trims spaces around the parts', () => expect(normalizeSeasonLabel(' 2025 - 2026 ')).toBe('2025-2026'));
  it('rejects years that are not consecutive', () => expect(normalizeSeasonLabel('2025-2027')).toBeNull());
  it('rejects empty, null and garbage', () => {
    expect(normalizeSeasonLabel('')).toBeNull();
    expect(normalizeSeasonLabel(null)).toBeNull();
    expect(normalizeSeasonLabel(undefined)).toBeNull();
    expect(normalizeSeasonLabel('sezonul trecut')).toBeNull();
  });
});

describe('seasonStartYear', () => {
  it('returns the first year', () => expect(seasonStartYear('2026-2027')).toBe(2026));
  it('throws on a non-normalized label', () => expect(() => seasonStartYear('2026')).toThrow());
});
```

`src/club/__tests__/registration-number.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  formatRegistrationNumber,
  parseRegistrationNumber,
  planRegistrationBackfill,
} from '../registration-number';

describe('formatRegistrationNumber', () => {
  it('pads to 4 digits', () => expect(formatRegistrationNumber(2026, 142)).toBe('2026-0142'));
  it('rejects 0 and 10000', () => {
    expect(() => formatRegistrationNumber(2026, 0)).toThrow(RangeError);
    expect(() => formatRegistrationNumber(2026, 10000)).toThrow(RangeError);
  });
});

describe('parseRegistrationNumber', () => {
  it('parses a valid number', () =>
    expect(parseRegistrationNumber('2026-0142')).toEqual({ startYear: 2026, seq: 142 }));
  it('returns null for anything else', () => {
    expect(parseRegistrationNumber('2026-142')).toBeNull();
    expect(parseRegistrationNumber(null)).toBeNull();
  });
});

describe('planRegistrationBackfill', () => {
  it('numbers each season in submission order, after existing numbers', () => {
    const plan = planRegistrationBackfill([
      { documentId: 'b', season: '2025–2026', submittedAt: '2025-09-02T10:00:00Z', registrationNumber: null },
      { documentId: 'a', season: '2025-2026', submittedAt: '2025-09-01T10:00:00Z', registrationNumber: null },
      { documentId: 'c', season: '2025-2026', submittedAt: '2025-08-01T10:00:00Z', registrationNumber: '2025-0007' },
      { documentId: 'd', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: null },
    ]);
    expect(plan.assign).toEqual([
      { documentId: 'a', registrationNumber: '2025-0008' },
      { documentId: 'b', registrationNumber: '2025-0009' },
      { documentId: 'd', registrationNumber: '2026-0001' },
    ]);
  });

  it('is stable when submittedAt is equal (orders by documentId)', () => {
    const rows = [
      { documentId: 'z', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: null },
      { documentId: 'm', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: null },
    ];
    expect(planRegistrationBackfill(rows).assign.map((r) => r.documentId)).toEqual(['m', 'z']);
  });

  it('puts rows without submittedAt last', () => {
    const plan = planRegistrationBackfill([
      { documentId: 'x', season: '2026-2027', submittedAt: null, registrationNumber: null },
      { documentId: 'y', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: null },
    ]);
    expect(plan.assign.map((r) => r.documentId)).toEqual(['y', 'x']);
  });

  it('skips rows without a usable season', () => {
    const plan = planRegistrationBackfill([
      { documentId: 'q', season: null, submittedAt: null, registrationNumber: null },
      { documentId: 'r', season: 'n/a', submittedAt: null, registrationNumber: null },
    ]);
    expect(plan.assign).toEqual([]);
    expect(plan.skipped).toEqual([
      { documentId: 'q', reason: 'no-season' },
      { documentId: 'r', reason: 'no-season' },
    ]);
  });

  it('assigns nothing on a second run (idempotent)', () => {
    const first = planRegistrationBackfill([
      { documentId: 'a', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: null },
    ]);
    const second = planRegistrationBackfill([
      { documentId: 'a', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: first.assign[0].registrationNumber },
    ]);
    expect(second.assign).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test -- src/club/__tests__/season.test.ts src/club/__tests__/registration-number.test.ts`
Expected: FAIL, cannot find module `../season` / `../registration-number`.

- [ ] **Step 3: Implement `src/club/season.ts`**

```ts
/** Season labels are stored as "YYYY-YYYY" with a hyphen; older data uses an en dash. */
export function normalizeSeasonLabel(raw: string | null | undefined): string | null {
  const m = /^\s*(\d{4})\s*[-–—]\s*(\d{4})\s*$/.exec(raw ?? '');
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (end !== start + 1) return null;
  return `${start}-${end}`;
}

export function seasonStartYear(label: string): number {
  const normalized = normalizeSeasonLabel(label);
  if (!normalized || normalized !== label) throw new Error(`Invalid season label: ${label}`);
  return Number(label.slice(0, 4));
}
```

- [ ] **Step 4: Implement `src/club/registration-number.ts`**

```ts
import { normalizeSeasonLabel, seasonStartYear } from './season';

export function formatRegistrationNumber(startYear: number, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1 || seq > 9999) {
    throw new RangeError(`Registration sequence out of range: ${seq}`);
  }
  return `${startYear}-${String(seq).padStart(4, '0')}`;
}

export function parseRegistrationNumber(
  value: string | null | undefined,
): { startYear: number; seq: number } | null {
  const m = /^(\d{4})-(\d{4})$/.exec(value ?? '');
  if (!m) return null;
  return { startYear: Number(m[1]), seq: Number(m[2]) };
}

export interface BackfillRow {
  documentId: string;
  season: string | null;
  submittedAt: string | null;
  registrationNumber: string | null;
}

function bySubmission(a: BackfillRow, b: BackfillRow): number {
  if (a.submittedAt && b.submittedAt && a.submittedAt !== b.submittedAt) {
    return a.submittedAt < b.submittedAt ? -1 : 1;
  }
  if (a.submittedAt && !b.submittedAt) return -1;
  if (!a.submittedAt && b.submittedAt) return 1;
  return a.documentId < b.documentId ? -1 : a.documentId > b.documentId ? 1 : 0;
}

export function planRegistrationBackfill(rows: BackfillRow[]): {
  assign: { documentId: string; registrationNumber: string }[];
  skipped: { documentId: string; reason: 'no-season' }[];
} {
  const skipped: { documentId: string; reason: 'no-season' }[] = [];
  const bySeason = new Map<string, BackfillRow[]>();
  for (const row of rows) {
    const label = normalizeSeasonLabel(row.season);
    if (!label) {
      skipped.push({ documentId: row.documentId, reason: 'no-season' });
      continue;
    }
    const list = bySeason.get(label) ?? [];
    list.push(row);
    bySeason.set(label, list);
  }
  const assign: { documentId: string; registrationNumber: string }[] = [];
  for (const label of [...bySeason.keys()].sort()) {
    const list = bySeason.get(label)!;
    const year = seasonStartYear(label);
    let seq = list.reduce((max, r) => {
      const parsed = parseRegistrationNumber(r.registrationNumber);
      return parsed && parsed.startYear === year ? Math.max(max, parsed.seq) : max;
    }, 0);
    for (const row of [...list].sort(bySubmission)) {
      if (row.registrationNumber) continue;
      seq += 1;
      assign.push({ documentId: row.documentId, registrationNumber: formatRegistrationNumber(year, seq) });
    }
  }
  return { assign, skipped };
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- src/club/__tests__/season.test.ts src/club/__tests__/registration-number.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/club/season.ts src/club/registration-number.ts src/club/__tests__/season.test.ts src/club/__tests__/registration-number.test.ts
git commit -m "feat(club): season labels and registration number rules"
```

---

### Task 3: A.C.S. membership and main-group rules

**Files:**
- Create: `src/club/acs.ts`, `src/club/group-membership.ts`
- Test: `src/club/__tests__/acs.test.ts`, `src/club/__tests__/group-membership.test.ts`

**Interfaces:**
- Produces:
  - `type AcsState = 'da' | 'nu' | 'in_asteptare'`
  - `carryOverAcs(previous: { athleteId: string; state: AcsState }[]): { athleteId: string; state: AcsState }[]`
  - `effectiveAcs(state: AcsState | null | undefined): AcsState`
  - `usesMemberPrice(state: AcsState | null | undefined): boolean`
  - `interface SeasonMembership { groupId: string; seasonId: string; isMain: boolean }`
  - `checkMainGroup(list: SeasonMembership[], seasonId: string): { ok: true } | { ok: false; reason: 'none' | 'many' }`
  - `setMainGroup(list: SeasonMembership[], seasonId: string, groupId: string): SeasonMembership[]`
  - `countDistinctAthletes(rows: { athleteId: string }[]): number`

- [ ] **Step 1: Write the failing tests**

`src/club/__tests__/acs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { carryOverAcs, effectiveAcs, usesMemberPrice } from '../acs';

describe('carryOverAcs', () => {
  it('turns last season "da" into "in_asteptare" and drops the rest', () => {
    expect(
      carryOverAcs([
        { athleteId: 'a', state: 'da' },
        { athleteId: 'b', state: 'nu' },
        { athleteId: 'c', state: 'in_asteptare' },
      ]),
    ).toEqual([{ athleteId: 'a', state: 'in_asteptare' }]);
  });
});

describe('effectiveAcs', () => {
  it('shows "nu" when there is no value for the season', () => {
    expect(effectiveAcs(undefined)).toBe('nu');
    expect(effectiveAcs(null)).toBe('nu');
  });
  it('keeps a stored value', () => expect(effectiveAcs('in_asteptare')).toBe('in_asteptare'));
});

describe('usesMemberPrice', () => {
  it('only for "da"', () => {
    expect(usesMemberPrice('da')).toBe(true);
    expect(usesMemberPrice('in_asteptare')).toBe(false);
    expect(usesMemberPrice('nu')).toBe(false);
    expect(usesMemberPrice(undefined)).toBe(false);
  });
});
```

`src/club/__tests__/group-membership.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { checkMainGroup, countDistinctAthletes, setMainGroup } from '../group-membership';

const S = 'season-2026';

describe('checkMainGroup', () => {
  it('is ok with no lists at all', () => expect(checkMainGroup([], S)).toEqual({ ok: true }));
  it('is ok with exactly one main', () =>
    expect(
      checkMainGroup(
        [
          { groupId: 'g1', seasonId: S, isMain: true },
          { groupId: 'g2', seasonId: S, isMain: false },
        ],
        S,
      ),
    ).toEqual({ ok: true }));
  it('fails with lists but no main', () =>
    expect(checkMainGroup([{ groupId: 'g1', seasonId: S, isMain: false }], S)).toEqual({ ok: false, reason: 'none' }));
  it('fails with two mains', () =>
    expect(
      checkMainGroup(
        [
          { groupId: 'g1', seasonId: S, isMain: true },
          { groupId: 'g2', seasonId: S, isMain: true },
        ],
        S,
      ),
    ).toEqual({ ok: false, reason: 'many' }));
  it('only looks at the given season', () =>
    expect(
      checkMainGroup(
        [
          { groupId: 'g1', seasonId: S, isMain: true },
          { groupId: 'g1', seasonId: 'season-2025', isMain: true },
        ],
        S,
      ),
    ).toEqual({ ok: true }));
});

describe('setMainGroup', () => {
  it('moves the main flag within the season only', () => {
    const next = setMainGroup(
      [
        { groupId: 'g1', seasonId: S, isMain: true },
        { groupId: 'g2', seasonId: S, isMain: false },
        { groupId: 'g1', seasonId: 'season-2025', isMain: true },
      ],
      S,
      'g2',
    );
    expect(next).toEqual([
      { groupId: 'g1', seasonId: S, isMain: false },
      { groupId: 'g2', seasonId: S, isMain: true },
      { groupId: 'g1', seasonId: 'season-2025', isMain: true },
    ]);
  });
  it('throws when the athlete is not on that group', () =>
    expect(() => setMainGroup([{ groupId: 'g1', seasonId: S, isMain: true }], S, 'g9')).toThrow());
});

describe('countDistinctAthletes', () => {
  it('counts someone on two groups once', () =>
    expect(countDistinctAthletes([{ athleteId: 'a' }, { athleteId: 'a' }, { athleteId: 'b' }])).toBe(2));
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test -- src/club/__tests__/acs.test.ts src/club/__tests__/group-membership.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/club/acs.ts`**

```ts
export type AcsState = 'da' | 'nu' | 'in_asteptare';

/** New season: last season's members start "în așteptare"; everyone else has no value. */
export function carryOverAcs(
  previous: { athleteId: string; state: AcsState }[],
): { athleteId: string; state: AcsState }[] {
  return previous
    .filter((p) => p.state === 'da')
    .map((p) => ({ athleteId: p.athleteId, state: 'in_asteptare' as AcsState }));
}

export function effectiveAcs(state: AcsState | null | undefined): AcsState {
  return state ?? 'nu';
}

export function usesMemberPrice(state: AcsState | null | undefined): boolean {
  return state === 'da';
}
```

- [ ] **Step 4: Implement `src/club/group-membership.ts`**

```ts
export interface SeasonMembership {
  groupId: string;
  seasonId: string;
  isMain: boolean;
}

export function checkMainGroup(
  list: SeasonMembership[],
  seasonId: string,
): { ok: true } | { ok: false; reason: 'none' | 'many' } {
  const inSeason = list.filter((m) => m.seasonId === seasonId);
  if (inSeason.length === 0) return { ok: true };
  const mains = inSeason.filter((m) => m.isMain).length;
  if (mains === 1) return { ok: true };
  return { ok: false, reason: mains === 0 ? 'none' : 'many' };
}

export function setMainGroup(list: SeasonMembership[], seasonId: string, groupId: string): SeasonMembership[] {
  if (!list.some((m) => m.seasonId === seasonId && m.groupId === groupId)) {
    throw new Error(`Athlete is not on group ${groupId} in season ${seasonId}`);
  }
  return list.map((m) => (m.seasonId === seasonId ? { ...m, isMain: m.groupId === groupId } : m));
}

export function countDistinctAthletes(rows: { athleteId: string }[]): number {
  return new Set(rows.map((r) => r.athleteId)).size;
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- src/club/__tests__/acs.test.ts src/club/__tests__/group-membership.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/club/acs.ts src/club/group-membership.ts src/club/__tests__/acs.test.ts src/club/__tests__/group-membership.test.ts
git commit -m "feat(club): A.C.S. membership per season and main-group rules"
```

---

### Task 4: Subscription validity and slot use

**Files:**
- Create: `src/club/subscription.ts`
- Test: `src/club/__tests__/subscription.test.ts`

**Interfaces:**
- Produces:
  - `weekendKey(isoDate: string): string` (the Saturday of that weekend, `YYYY-MM-DD`; weekdays return their own date)
  - `subscriptionValidUntil(startsOn: string, schoolDays: string[], weekends?: number): string | null`
    - `schoolDays`: ISO dates of Skating School sessions that really happen (cancelled, liber and paused dates already removed).
  - `interface SubscriptionState { priceListId: string; slots: number; used: number; startsOn: string; validUntil: string | null }`
  - `canUseSlot(sub: SubscriptionState, session: { date: string; priceListId: string }): boolean`

- [ ] **Step 1: Write the failing tests**

`src/club/__tests__/subscription.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { canUseSlot, subscriptionValidUntil, weekendKey } from '../subscription';

// October / November 2026: Saturdays 3, 10, 17, 24, 31 Oct, 7 Nov; Sundays the day after.
const weekends = ['2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11', '2026-10-17', '2026-10-18', '2026-10-24', '2026-10-25'];

describe('weekendKey', () => {
  it('maps Saturday and Sunday to the Saturday', () => {
    expect(weekendKey('2026-10-03')).toBe('2026-10-03');
    expect(weekendKey('2026-10-04')).toBe('2026-10-03');
  });
  it('keeps a weekday as its own key', () => expect(weekendKey('2026-10-07')).toBe('2026-10-07'));
});

describe('subscriptionValidUntil', () => {
  it('ends on the last day of the 4th school weekend from the start', () =>
    expect(subscriptionValidUntil('2026-10-03', weekends)).toBe('2026-10-25'));
  it('a free weekend (missing from schoolDays) extends it', () => {
    const withoutOct10 = weekends.filter((d) => !d.startsWith('2026-10-1') || d >= '2026-10-12');
    expect(subscriptionValidUntil('2026-10-03', [...withoutOct10, '2026-10-31', '2026-11-01'])).toBe('2026-11-01');
  });
  it('starting on a Sunday counts that weekend', () =>
    expect(subscriptionValidUntil('2026-10-04', weekends)).toBe('2026-10-25'));
  it('returns null when fewer than 4 weekends are known', () =>
    expect(subscriptionValidUntil('2026-10-17', weekends)).toBeNull());
});

describe('canUseSlot', () => {
  const sub = { priceListId: 'standard', slots: 8, used: 3, startsOn: '2026-10-03', validUntil: '2026-10-25' };
  it('yes for a session on the same list inside the validity', () =>
    expect(canUseSlot(sub, { date: '2026-10-10', priceListId: 'standard' })).toBe(true));
  it('no on another price list', () =>
    expect(canUseSlot(sub, { date: '2026-10-10', priceListId: 'gold' })).toBe(false));
  it('no before the start or after the end', () => {
    expect(canUseSlot(sub, { date: '2026-10-02', priceListId: 'standard' })).toBe(false);
    expect(canUseSlot(sub, { date: '2026-10-31', priceListId: 'standard' })).toBe(false);
  });
  it('no when all slots are used', () =>
    expect(canUseSlot({ ...sub, used: 8 }, { date: '2026-10-10', priceListId: 'standard' })).toBe(false));
  it('yes after the start when validity is not known yet', () =>
    expect(canUseSlot({ ...sub, validUntil: null }, { date: '2026-12-05', priceListId: 'standard' })).toBe(true));
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/club/__tests__/subscription.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/club/subscription.ts`**

```ts
function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function weekendKey(isoDate: string): string {
  const d = toUtc(isoDate);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() - 1);
  return toIso(d);
}

/** Valid for `weekends` school weekends from the start; days missing from schoolDays (free weekends) do not count. */
export function subscriptionValidUntil(startsOn: string, schoolDays: string[], weekends = 4): string | null {
  const days = [...new Set(schoolDays)].filter((d) => d >= startsOn).sort();
  const keys: string[] = [];
  const lastDayOfKey = new Map<string, string>();
  for (const day of days) {
    const key = weekendKey(day);
    if (!lastDayOfKey.has(key)) keys.push(key);
    lastDayOfKey.set(key, day);
  }
  if (keys.length < weekends) return null;
  return lastDayOfKey.get(keys[weekends - 1]) ?? null;
}

export interface SubscriptionState {
  priceListId: string;
  slots: number;
  used: number;
  startsOn: string;
  validUntil: string | null;
}

export function canUseSlot(sub: SubscriptionState, session: { date: string; priceListId: string }): boolean {
  if (sub.priceListId !== session.priceListId) return false;
  if (sub.used >= sub.slots) return false;
  if (session.date < sub.startsOn) return false;
  if (sub.validUntil !== null && session.date > sub.validUntil) return false;
  return true;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- src/club/__tests__/subscription.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/club/subscription.ts src/club/__tests__/subscription.test.ts
git commit -m "feat(club): subscription validity over school weekends and slot use"
```

---

### Task 5: Migration planners (names, seasons, groups, price lists, athletes)

**Files:**
- Create: `src/club/migrate/names.ts`, `src/club/migrate/canonical.ts`, `src/club/migrate/plan.ts`
- Test: `src/club/__tests__/names.test.ts`, `src/club/__tests__/plan.test.ts`

**Interfaces:**
- Consumes: `normalizeSeasonLabel` (Task 2).
- Produces:
  - `normalizeGroupName(raw: string): string`, `nameKey(raw: string): string`
  - `splitPersonName(full: string): { firstName: string; lastName: string }`
  - `parsePrice(raw: unknown): number | null`
  - `CANONICAL_SECTIONS`, `CANONICAL_GROUPS`, `CANONICAL_PRICE_LISTS` (canonical.ts)
  - `planSeasons(input: { registrationSeasons: (string | null)[]; settings: { currentSeason?: string; seasonStartDate?: string; seasonEndDate?: string }; memberFee: number | null; existing: string[] }): { create: { label: string; startMonth: string; endMonth: string; membershipFee: number | null; isCurrent: boolean; needsReview: boolean }[] }`
  - `planGroups(input: { seriesCourses: string[]; coachGroups: { coachId: string; groups: string[] }[]; existing: string[] }): { create: { name: string; sectionKind: 'school' | 'club'; priceList: string | null; coachIds: string[] }[]; unknown: string[] }`
  - `planPriceLists(input: { memberTiers: { label: string; price: unknown }[]; nonMemberTiers: { label: string; price: unknown }[]; existing: string[] }): { create: { name: string; items: { name: string; kind: 'subscription' | 'session' | 'individual'; sessions: number | null; memberPrice: number | null; nonMemberPrice: number | null }[] }[]; unmatched: string[] }`
  - `planAthletes(input: { sportspeople: { documentId: string; name: string }[]; linkedProfileIds: string[] }): { create: { firstName: string; lastName: string; publicProfileId: string; dataIncomplete: true }[] }`

- [ ] **Step 1: Write the failing tests**

`src/club/__tests__/names.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nameKey, normalizeGroupName, parsePrice, splitPersonName } from '../migrate/names';

describe('normalizeGroupName', () => {
  it('replaces cedilla letters with comma-below letters', () =>
    expect(normalizeGroupName('Primii Paşi')).toBe('Primii Pași'));
  it('trims and collapses spaces', () => expect(normalizeGroupName('  Intermediari   Silver ')).toBe('Intermediari Silver'));
});

describe('nameKey', () => {
  it('ignores case and diacritics', () => {
    expect(nameKey('Profesioniști')).toBe(nameKey('profesionisti '));
    expect(nameKey('Primii Paşi')).toBe(nameKey('Primii Pași'));
  });
});

describe('splitPersonName', () => {
  it('last word is the last name', () =>
    expect(splitPersonName('Ana Maria Dumitrescu')).toEqual({ firstName: 'Ana Maria', lastName: 'Dumitrescu' }));
  it('a single word goes to firstName', () => expect(splitPersonName('Ana')).toEqual({ firstName: 'Ana', lastName: '' }));
});

describe('parsePrice', () => {
  it('reads numbers out of text', () => {
    expect(parsePrice('890 RON')).toBe(890);
    expect(parsePrice('890,50 lei')).toBe(890.5);
    expect(parsePrice(270)).toBe(270);
  });
  it('null when there is no number', () => {
    expect(parsePrice('gratuit')).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
  });
});
```

`src/club/__tests__/plan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { planAthletes, planGroups, planPriceLists, planSeasons } from '../migrate/plan';

describe('planSeasons', () => {
  it('creates each season once, marks the current one, uses settings dates for it', () => {
    const plan = planSeasons({
      registrationSeasons: ['2025–2026', '2025-2026', '2026-2027', null, 'x'],
      settings: { currentSeason: '2026–2027', seasonStartDate: '2026-10-01', seasonEndDate: '2027-05-31' },
      memberFee: 270,
      existing: [],
    });
    expect(plan.create).toEqual([
      { label: '2025-2026', startMonth: '2025-10-01', endMonth: '2026-05-31', membershipFee: null, isCurrent: false, needsReview: true },
      { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270, isCurrent: true, needsReview: false },
    ]);
  });
  it('skips seasons that already exist', () => {
    const plan = planSeasons({ registrationSeasons: ['2026-2027'], settings: { currentSeason: '2026-2027' }, memberFee: null, existing: ['2026-2027'] });
    expect(plan.create).toEqual([]);
  });
});

describe('planGroups', () => {
  it('creates the canonical groups, links coaches by name, reports unknown text', () => {
    const plan = planGroups({
      seriesCourses: ['Avansați Gold', 'Primii Paşi', 'Intermediari Silver', 'Avansați Silver', 'Începători', 'Intermediari Bronze', 'Avansați Bronze'],
      coachGroups: [
        { coachId: 'andreea', groups: ['Profesionisti', 'Avansati'] },
        { coachId: 'virgil', groups: ['Intermediari Silver', 'Intermediari Bronze', 'Grupa Veche'] },
      ],
      existing: [],
    });
    const byName = Object.fromEntries(plan.create.map((g) => [g.name, g]));
    expect(Object.keys(byName).sort()).toEqual(
      ['Avansați', 'Avansați Bronze', 'Avansați Gold', 'Avansați Silver', 'Intermediari Bronze', 'Intermediari Silver', 'Începători', 'Primii Pași', 'Profesioniști'].sort(),
    );
    expect(byName['Avansați']).toEqual({ name: 'Avansați', sectionKind: 'club', priceList: null, coachIds: ['andreea'] });
    expect(byName['Avansați Gold'].priceList).toBe('Avansați Gold');
    expect(byName['Începători'].priceList).toBe('Standard');
    expect(byName['Intermediari Silver'].coachIds).toEqual(['virgil']);
    expect(plan.unknown).toEqual(['Grupa Veche']);
  });
  it('does not recreate existing groups (any spelling)', () => {
    const plan = planGroups({ seriesCourses: ['Primii Paşi'], coachGroups: [], existing: ['Primii Pași'] });
    expect(plan.create.find((g) => g.name === 'Primii Pași')).toBeUndefined();
  });
});

describe('planPriceLists', () => {
  it('builds Standard and Avansați Gold items from the tiers', () => {
    const plan = planPriceLists({
      memberTiers: [
        { label: 'Abonament 8 ședințe', price: '770 RON' },
        { label: 'Abonament 6 ședințe', price: '600 RON' },
        { label: '1 ședință', price: '110 RON' },
        { label: 'Abonament Avansați Gold 8 ședințe', price: '900 RON' },
      ],
      nonMemberTiers: [
        { label: 'Abonament 8 ședințe', price: '890 RON' },
        { label: 'Abonament 6 ședințe', price: '690 RON' },
        { label: '1 ședință', price: '130 RON' },
        { label: 'Abonament Avansați Gold 8 ședințe', price: '1020 RON' },
        { label: 'Taxă specială', price: '50 RON' },
      ],
      existing: [],
    });
    const standard = plan.create.find((l) => l.name === 'Standard')!;
    expect(standard.items).toContainEqual({ name: 'Abonament 8 ședințe', kind: 'subscription', sessions: 8, memberPrice: 770, nonMemberPrice: 890 });
    expect(standard.items).toContainEqual({ name: '1 ședință', kind: 'session', sessions: null, memberPrice: 110, nonMemberPrice: 130 });
    const gold = plan.create.find((l) => l.name === 'Avansați Gold')!;
    expect(gold.items).toEqual([
      { name: 'Abonament Avansați Gold 8 ședințe', kind: 'subscription', sessions: 8, memberPrice: 900, nonMemberPrice: 1020 },
    ]);
    expect(plan.unmatched).toEqual(['Taxă specială']);
  });
  it('skips lists that already exist', () => {
    const plan = planPriceLists({ memberTiers: [], nonMemberTiers: [], existing: ['Standard', 'Avansați Gold'] });
    expect(plan.create).toEqual([]);
  });
});

describe('planAthletes', () => {
  it('creates one athlete per public profile not linked yet', () => {
    const plan = planAthletes({
      sportspeople: [
        { documentId: 'p1', name: 'Maria Dumitrescu' },
        { documentId: 'p2', name: 'Ana Bălan' },
      ],
      linkedProfileIds: ['p2'],
    });
    expect(plan.create).toEqual([{ firstName: 'Maria', lastName: 'Dumitrescu', publicProfileId: 'p1', dataIncomplete: true }]);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test -- src/club/__tests__/names.test.ts src/club/__tests__/plan.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/club/migrate/names.ts`**

```ts
export function normalizeGroupName(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/ş/g, 'ș')
    .replace(/Ş/g, 'Ș')
    .replace(/ţ/g, 'ț')
    .replace(/Ţ/g, 'Ț')
    .trim()
    .replace(/\s+/g, ' ');
}

export function nameKey(raw: string): string {
  return normalizeGroupName(raw)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function splitPersonName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

export function parsePrice(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return null;
  const m = /(\d+(?:[.,]\d+)?)/.exec(raw.replace(/\s/g, ''));
  return m ? Number(m[1].replace(',', '.')) : null;
}
```

- [ ] **Step 4: Implement `src/club/migrate/canonical.ts`**

```ts
export const CANONICAL_SECTIONS = [
  { name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school' as const, slug: 'afi-cotroceni', registrationsOpen: true },
  { name: 'Club', kind: 'club' as const, slug: 'club', registrationsOpen: false },
];

export const CANONICAL_PRICE_LISTS = ['Standard', 'Avansați Gold'] as const;

export const CANONICAL_GROUPS: { name: string; sectionKind: 'school' | 'club'; priceList: string | null }[] = [
  { name: 'Avansați Gold', sectionKind: 'school', priceList: 'Avansați Gold' },
  { name: 'Primii Pași', sectionKind: 'school', priceList: 'Standard' },
  { name: 'Intermediari Silver', sectionKind: 'school', priceList: 'Standard' },
  { name: 'Avansați Silver', sectionKind: 'school', priceList: 'Standard' },
  { name: 'Începători', sectionKind: 'school', priceList: 'Standard' },
  { name: 'Intermediari Bronze', sectionKind: 'school', priceList: 'Standard' },
  { name: 'Avansați Bronze', sectionKind: 'school', priceList: 'Standard' },
  { name: 'Profesioniști', sectionKind: 'club', priceList: null },
  { name: 'Avansați', sectionKind: 'club', priceList: null },
];
```

- [ ] **Step 5: Implement `src/club/migrate/plan.ts`**

```ts
import { normalizeSeasonLabel } from '../season';
import { CANONICAL_GROUPS, CANONICAL_PRICE_LISTS } from './canonical';
import { nameKey, parsePrice, splitPersonName } from './names';

export function planSeasons(input: {
  registrationSeasons: (string | null)[];
  settings: { currentSeason?: string; seasonStartDate?: string; seasonEndDate?: string };
  memberFee: number | null;
  existing: string[];
}) {
  const current = normalizeSeasonLabel(input.settings.currentSeason ?? null);
  const labels = new Set<string>();
  for (const raw of [...input.registrationSeasons, input.settings.currentSeason ?? null]) {
    const label = normalizeSeasonLabel(raw);
    if (label) labels.add(label);
  }
  const existing = new Set(input.existing);
  const create = [...labels]
    .filter((label) => !existing.has(label))
    .sort()
    .map((label) => {
      const start = Number(label.slice(0, 4));
      const isCurrent = label === current;
      const hasDates = isCurrent && !!input.settings.seasonStartDate && !!input.settings.seasonEndDate;
      return {
        label,
        startMonth: hasDates ? input.settings.seasonStartDate! : `${start}-10-01`,
        endMonth: hasDates ? input.settings.seasonEndDate! : `${start + 1}-05-31`,
        membershipFee: isCurrent ? input.memberFee : null,
        isCurrent,
        needsReview: !hasDates,
      };
    });
  return { create };
}

export function planGroups(input: {
  seriesCourses: string[];
  coachGroups: { coachId: string; groups: string[] }[];
  existing: string[];
}) {
  const canonicalByKey = new Map(CANONICAL_GROUPS.map((g) => [nameKey(g.name), g]));
  const existingKeys = new Set(input.existing.map(nameKey));
  const coachesByKey = new Map<string, string[]>();
  const unknown: string[] = [];
  for (const raw of input.seriesCourses) {
    if (!canonicalByKey.has(nameKey(raw)) && !unknown.includes(raw.trim())) unknown.push(raw.trim());
  }
  for (const { coachId, groups } of input.coachGroups) {
    for (const raw of groups) {
      const key = nameKey(raw);
      if (!canonicalByKey.has(key)) {
        if (!unknown.includes(raw.trim())) unknown.push(raw.trim());
        continue;
      }
      coachesByKey.set(key, [...(coachesByKey.get(key) ?? []), coachId]);
    }
  }
  const create = CANONICAL_GROUPS.filter((g) => !existingKeys.has(nameKey(g.name))).map((g) => ({
    name: g.name,
    sectionKind: g.sectionKind,
    priceList: g.priceList,
    coachIds: coachesByKey.get(nameKey(g.name)) ?? [],
  }));
  return { create, unknown };
}

type ItemKind = 'subscription' | 'session' | 'individual';

function classify(label: string): { kind: ItemKind; sessions: number | null } | null {
  const key = nameKey(label);
  if (key.includes('individual')) return { kind: 'individual', sessions: null };
  const sessions = /(\d+)\s*sedint/.exec(key);
  if (key.includes('abonament') && sessions) return { kind: 'subscription', sessions: Number(sessions[1]) };
  if (/^1\s*sedint/.test(key)) return { kind: 'session', sessions: null };
  return null;
}

export function planPriceLists(input: {
  memberTiers: { label: string; price: unknown }[];
  nonMemberTiers: { label: string; price: unknown }[];
  existing: string[];
}) {
  const labels = new Map<string, string>();
  for (const t of [...input.memberTiers, ...input.nonMemberTiers]) labels.set(nameKey(t.label), t.label.trim());
  const priceOf = (tiers: { label: string; price: unknown }[], key: string) =>
    parsePrice(tiers.find((t) => nameKey(t.label) === key)?.price);
  const lists = new Map<string, { name: string; kind: ItemKind; sessions: number | null; memberPrice: number | null; nonMemberPrice: number | null }[]>(
    CANONICAL_PRICE_LISTS.map((n) => [n, []]),
  );
  const unmatched: string[] = [];
  for (const [key, label] of labels) {
    const c = classify(label);
    if (!c) {
      unmatched.push(label);
      continue;
    }
    const list = key.includes('gold') ? 'Avansați Gold' : 'Standard';
    lists.get(list)!.push({
      name: label,
      kind: c.kind,
      sessions: c.sessions,
      memberPrice: priceOf(input.memberTiers, key),
      nonMemberPrice: priceOf(input.nonMemberTiers, key),
    });
  }
  const existing = new Set(input.existing);
  const create = [...lists.entries()]
    .filter(([name]) => !existing.has(name))
    .map(([name, items]) => ({ name, items }));
  return { create, unmatched };
}

export function planAthletes(input: { sportspeople: { documentId: string; name: string }[]; linkedProfileIds: string[] }) {
  const linked = new Set(input.linkedProfileIds);
  const create = input.sportspeople
    .filter((p) => !linked.has(p.documentId))
    .map((p) => ({ ...splitPersonName(p.name), publicProfileId: p.documentId, dataIncomplete: true as const }));
  return { create };
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test -- src/club/__tests__/names.test.ts src/club/__tests__/plan.test.ts`
Expected: all PASS. If the price-list test fails on item order only, compare with `toContainEqual` (already used for Standard) rather than changing the planner.

- [ ] **Step 7: Commit**

```bash
git add src/club/migrate src/club/__tests__/names.test.ts src/club/__tests__/plan.test.ts
git commit -m "feat(club): migration planners for seasons, groups, price lists and athletes"
```

---

### Task 6: New content types (no public routes)

**Files (create, each with `content-types/<name>/schema.json`, `controllers/<name>.ts`, `routes/<name>.ts`, `services/<name>.ts`):**
- `src/api/season/`, `src/api/location/`, `src/api/section/`, `src/api/price-list/`, `src/api/group/`, `src/api/athlete/`, `src/api/group-membership/`, `src/api/acs-membership/`, `src/api/history-entry/`
- Create: `src/components/club/price-item.json`
- Test: `src/club/__tests__/schemas.test.ts`

**Interfaces:**
- Produces UIDs: `api::season.season`, `api::location.location`, `api::section.section`, `api::price-list.price-list`, `api::group.group`, `api::athlete.athlete`, `api::group-membership.group-membership`, `api::acs-membership.acs-membership`, `api::history-entry.history-entry`; component `club.price-item`.

- [ ] **Step 1: Write the failing schema test**

`src/club/__tests__/schemas.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..', 'api');
const NEW_TYPES = ['season', 'location', 'section', 'price-list', 'group', 'athlete', 'group-membership', 'acs-membership', 'history-entry'];

describe.each(NEW_TYPES)('content type %s', (name) => {
  const schema = JSON.parse(readFileSync(join(ROOT, name, 'content-types', name, 'schema.json'), 'utf8'));
  const router = readFileSync(join(ROOT, name, 'routes', `${name}.ts`), 'utf8');

  it('is a collection type without draft and publish', () => {
    expect(schema.kind).toBe('collectionType');
    expect(schema.options.draftAndPublish).toBe(false);
  });
  it('exposes no generated content-API routes', () => {
    expect(router).toContain(`createCoreRouter('api::${name}.${name}', { only: [] })`);
  });
});

it('athlete links one-to-one to the public profile (sportsperson)', () => {
  const athlete = JSON.parse(readFileSync(join(ROOT, 'athlete', 'content-types', 'athlete', 'schema.json'), 'utf8'));
  expect(athlete.attributes.publicProfile).toEqual({ type: 'relation', relation: 'oneToOne', target: 'api::sportsperson.sportsperson' });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/club/__tests__/schemas.test.ts`
Expected: FAIL, ENOENT on `season/content-types/season/schema.json`.

- [ ] **Step 3: Create the shared controller/route/service files for each type**

For each `<name>` in the list, create (example shown for `season`, repeat with the name substituted):

`src/api/season/controllers/season.ts`:
```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::season.season');
```

`src/api/season/services/season.ts`:
```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::season.season');
```

`src/api/season/routes/season.ts`:
```ts
import { factories } from '@strapi/strapi';

/** Private club data: no generated content-API routes (see registration-submission router, 2026-09-15). */
export default factories.createCoreRouter('api::season.season', { only: [] });
```

Names to create: `season`, `location`, `section`, `price-list`, `group`, `athlete`, `group-membership`, `acs-membership`, `history-entry` (UID always `api::<name>.<name>`).

- [ ] **Step 4: Create the schemas**

`src/api/season/content-types/season/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "seasons",
  "info": { "singularName": "season", "pluralName": "seasons", "displayName": "Club / Sezon" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "label": { "type": "string", "required": true, "unique": true, "regex": "^[0-9]{4}-[0-9]{4}$" },
    "startMonth": { "type": "date", "required": true },
    "endMonth": { "type": "date", "required": true },
    "membershipFee": { "type": "decimal" },
    "isCurrent": { "type": "boolean", "default": false },
    "needsReview": { "type": "boolean", "default": false }
  }
}
```

`src/api/location/content-types/location/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "locations",
  "info": { "singularName": "location", "pluralName": "locations", "displayName": "Club / Locație" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true },
    "address": { "type": "string" },
    "mapsUrl": { "type": "string" }
  }
}
```

`src/api/section/content-types/section/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "sections",
  "info": { "singularName": "section", "pluralName": "sections", "displayName": "Club / Secțiune" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true },
    "kind": { "type": "enumeration", "enum": ["school", "club"], "required": true },
    "slug": { "type": "uid", "targetField": "name", "required": true },
    "publicPage": { "type": "boolean", "default": false },
    "registrationsOpen": { "type": "boolean", "default": false },
    "order": { "type": "integer" },
    "location": { "type": "relation", "relation": "manyToOne", "target": "api::location.location" }
  }
}
```

`src/components/club/price-item.json`:
```json
{
  "collectionName": "components_club_price_items",
  "info": { "displayName": "Element de preț" },
  "options": {},
  "attributes": {
    "name": { "type": "string", "required": true },
    "kind": { "type": "enumeration", "enum": ["subscription", "session", "individual"], "required": true },
    "sessions": { "type": "integer" },
    "memberPrice": { "type": "decimal" },
    "nonMemberPrice": { "type": "decimal" },
    "included": { "type": "boolean", "default": false }
  }
}
```

`src/api/price-list/content-types/price-list/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "price_lists",
  "info": { "singularName": "price-list", "pluralName": "price-lists", "displayName": "Club / Listă de prețuri" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true, "unique": true },
    "section": { "type": "relation", "relation": "manyToOne", "target": "api::section.section" },
    "items": { "type": "component", "repeatable": true, "component": "club.price-item" }
  }
}
```

`src/api/group/content-types/group/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "club_groups",
  "info": { "singularName": "group", "pluralName": "groups", "displayName": "Club / Grupă" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true },
    "active": { "type": "boolean", "default": true },
    "order": { "type": "integer" },
    "section": { "type": "relation", "relation": "manyToOne", "target": "api::section.section" },
    "priceList": { "type": "relation", "relation": "manyToOne", "target": "api::price-list.price-list" },
    "coaches": { "type": "relation", "relation": "manyToMany", "target": "api::team-member.team-member" }
  }
}
```

`src/api/athlete/content-types/athlete/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "athletes",
  "info": { "singularName": "athlete", "pluralName": "athletes", "displayName": "Club / Sportiv" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "firstName": { "type": "string", "required": true },
    "lastName": { "type": "string" },
    "birthDate": { "type": "date" },
    "contactName": { "type": "string" },
    "phone": { "type": "string" },
    "email": { "type": "email" },
    "status": { "type": "enumeration", "enum": ["nou", "activ", "inactiv"], "default": "activ", "required": true },
    "dataIncomplete": { "type": "boolean", "default": false },
    "notes": { "type": "text" },
    "publicProfile": { "type": "relation", "relation": "oneToOne", "target": "api::sportsperson.sportsperson" }
  }
}
```

`src/api/group-membership/content-types/group-membership/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "group_memberships",
  "info": { "singularName": "group-membership", "pluralName": "group-memberships", "displayName": "Club / Apartenență la grupă" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "athlete": { "type": "relation", "relation": "manyToOne", "target": "api::athlete.athlete" },
    "group": { "type": "relation", "relation": "manyToOne", "target": "api::group.group" },
    "season": { "type": "relation", "relation": "manyToOne", "target": "api::season.season" },
    "isMain": { "type": "boolean", "default": false },
    "from": { "type": "date" },
    "to": { "type": "date" }
  }
}
```

`src/api/acs-membership/content-types/acs-membership/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "acs_memberships",
  "info": { "singularName": "acs-membership", "pluralName": "acs-memberships", "displayName": "Club / Membru A.C.S." },
  "options": { "draftAndPublish": false },
  "attributes": {
    "athlete": { "type": "relation", "relation": "manyToOne", "target": "api::athlete.athlete" },
    "season": { "type": "relation", "relation": "manyToOne", "target": "api::season.season" },
    "state": { "type": "enumeration", "enum": ["da", "nu", "in_asteptare"], "default": "in_asteptare", "required": true }
  }
}
```

`src/api/history-entry/content-types/history-entry/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "history_entries",
  "info": { "singularName": "history-entry", "pluralName": "history-entries", "displayName": "Club / Istoric" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "subjectType": { "type": "string", "required": true },
    "subjectId": { "type": "string", "required": true },
    "action": { "type": "string", "required": true },
    "changes": { "type": "json" },
    "actor": { "type": "string", "required": true },
    "at": { "type": "datetime", "required": true }
  }
}
```

- [ ] **Step 5: Run the schema test**

Run: `npm test -- src/club/__tests__/schemas.test.ts`
Expected: all PASS.

- [ ] **Step 6: Boot Strapi to check the schemas are accepted**

Run: `npm run develop` (local, default SQLite or your local Postgres), wait for "Strapi started", then stop it with Ctrl+C.
Expected: no schema errors in the log; `types/generated/contentTypes.d.ts` now contains `ApiAthleteAthlete`, `ApiGroupGroup`, `ApiSeasonSeason`.
Then run: `npx tsc --noEmit` — expected: no new errors compared with `main`.

- [ ] **Step 7: Commit**

```bash
git add src/api/season src/api/location src/api/section src/api/price-list src/api/group src/api/athlete src/api/group-membership src/api/acs-membership src/api/history-entry src/components/club src/club/__tests__/schemas.test.ts types/generated
git commit -m "feat(club): content types for seasons, sections, groups, athletes, memberships, price lists and history"
```

---

### Task 7: Links on existing types (calendar event group, registration fields)

**Files:**
- Modify: `src/api/calendar-event/content-types/calendar-event/schema.json` (attributes)
- Modify: `src/api/registration-submission/content-types/registration-submission/schema.json` (attributes)
- Test: `src/club/__tests__/existing-links.test.ts`

**Interfaces:**
- Consumes: `api::group.group`, `api::section.section`, `api::season.season`, `api::athlete.athlete` (Task 6).
- Produces: `calendar-event.group` (manyToOne, optional); `registration-submission.registrationNumber` (string, unique), `.section`, `.seasonRef`, `.athlete` (manyToOne, optional). The existing `season` string stays.

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/existing-links.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const read = (p: string) => JSON.parse(readFileSync(join(__dirname, '..', '..', 'api', p), 'utf8'));

it('calendar events can optionally belong to a group', () => {
  const s = read('calendar-event/content-types/calendar-event/schema.json');
  expect(s.attributes.group).toEqual({ type: 'relation', relation: 'manyToOne', target: 'api::group.group' });
});

it('registrations carry a number and optional links, and keep the old season text', () => {
  const s = read('registration-submission/content-types/registration-submission/schema.json');
  expect(s.attributes.registrationNumber).toEqual({ type: 'string', unique: true });
  expect(s.attributes.section).toEqual({ type: 'relation', relation: 'manyToOne', target: 'api::section.section' });
  expect(s.attributes.seasonRef).toEqual({ type: 'relation', relation: 'manyToOne', target: 'api::season.season' });
  expect(s.attributes.athlete).toEqual({ type: 'relation', relation: 'manyToOne', target: 'api::athlete.athlete' });
  expect(s.attributes.season).toEqual({ type: 'string' });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/club/__tests__/existing-links.test.ts`
Expected: FAIL (`group` undefined).

- [ ] **Step 3: Add the attributes**

In `calendar-event/schema.json`, add to `"attributes"` after `"order"`:
```json
    "group": { "type": "relation", "relation": "manyToOne", "target": "api::group.group" }
```

In `registration-submission/schema.json`, add to `"attributes"` after `"extra"`:
```json
    "registrationNumber": { "type": "string", "unique": true },
    "section": { "type": "relation", "relation": "manyToOne", "target": "api::section.section" },
    "seasonRef": { "type": "relation", "relation": "manyToOne", "target": "api::season.season" },
    "athlete": { "type": "relation", "relation": "manyToOne", "target": "api::athlete.athlete" }
```

If the existing `season` attribute is not exactly `{ "type": "string" }`, adjust the test's last assertion to the current value instead of changing the schema.

- [ ] **Step 4: Run the test and boot check**

Run: `npm test -- src/club/__tests__/existing-links.test.ts` — expected PASS.
Run: `npm run develop`, open the admin, check Înscrieri list and Calendar și serii still load and save as before; stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/api/calendar-event/content-types/calendar-event/schema.json src/api/registration-submission/content-types/registration-submission/schema.json src/club/__tests__/existing-links.test.ts types/generated
git commit -m "feat(club): link calendar events to groups and registrations to number, section, season and athlete"
```

---

### Task 8: History helper and admin summary endpoint

**Files:**
- Create: `src/club/history.ts`
- Create: `src/api/club/controllers/club.ts`, `src/api/club/routes/02-admin.ts`
- Test: `src/club/__tests__/history.test.ts`

**Interfaces:**
- Produces:
  - `interface HistoryInput { subjectType: string; subjectId: string; action: string; changes?: Record<string, unknown>; actor: string }`
  - `buildHistoryEntry(input: HistoryInput, now?: Date): HistoryInput & { at: string }`
  - `recordHistory(strapi: { documents: (uid: string) => { create: (args: { data: unknown }) => Promise<unknown> } }, input: HistoryInput): Promise<void>`
  - `GET /api/club/summary` (admin guard) → `{ data: { seasons: number; sections: number; groups: number; athletes: number; priceLists: number; numberedRegistrations: number } }`

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/history.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildHistoryEntry, recordHistory } from '../history';

describe('buildHistoryEntry', () => {
  it('stamps the time', () => {
    const e = buildHistoryEntry({ subjectType: 'athlete', subjectId: 'a1', action: 'created', actor: 'migrare' }, new Date('2026-10-19T08:00:00Z'));
    expect(e).toEqual({ subjectType: 'athlete', subjectId: 'a1', action: 'created', actor: 'migrare', at: '2026-10-19T08:00:00.000Z' });
  });
  it('rejects a missing actor', () =>
    expect(() => buildHistoryEntry({ subjectType: 'athlete', subjectId: 'a1', action: 'created', actor: '' })).toThrow());
});

describe('recordHistory', () => {
  it('writes through the document service', async () => {
    const create = vi.fn().mockResolvedValue({});
    await recordHistory({ documents: () => ({ create }) }, { subjectType: 'group', subjectId: 'g1', action: 'created', actor: 'migrare' });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ subjectType: 'group', subjectId: 'g1', action: 'created', actor: 'migrare' }) });
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- src/club/__tests__/history.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/club/history.ts`**

```ts
export interface HistoryInput {
  subjectType: string;
  subjectId: string;
  action: string;
  changes?: Record<string, unknown>;
  actor: string;
}

export function buildHistoryEntry(input: HistoryInput, now: Date = new Date()): HistoryInput & { at: string } {
  if (!input.actor) throw new Error('History entry needs an actor');
  return { ...input, at: now.toISOString() };
}

export async function recordHistory(
  strapi: { documents: (uid: string) => { create: (args: { data: unknown }) => Promise<unknown> } },
  input: HistoryInput,
): Promise<void> {
  await strapi.documents('api::history-entry.history-entry').create({ data: buildHistoryEntry(input) });
}
```

- [ ] **Step 4: Implement the summary endpoint**

`src/api/club/routes/02-admin.ts`:
```ts
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [{ method: 'GET', path: '/club/summary', handler: 'club.summary', config: adminGuard }],
};
```

`src/api/club/controllers/club.ts`:
```ts
export default {
  async summary(ctx) {
    const count = (uid: string, filters?: Record<string, unknown>) =>
      strapi.documents(uid as any).count(filters ? { filters } : {});
    const [seasons, sections, groups, athletes, priceLists, numberedRegistrations] = await Promise.all([
      count('api::season.season'),
      count('api::section.section'),
      count('api::group.group'),
      count('api::athlete.athlete'),
      count('api::price-list.price-list'),
      count('api::registration-submission.registration-submission', { registrationNumber: { $notNull: true } }),
    ]);
    ctx.body = { data: { seasons, sections, groups, athletes, priceLists, numberedRegistrations } };
  },
};
```

- [ ] **Step 5: Run tests and check the endpoint**

Run: `npm test` — expected: every test PASS.
Run: `npm run develop`, log in to the admin, copy the admin JWT from the browser (Application, cookies/storage `jwtToken`), then:
`curl -s -H "Authorization: Bearer <jwt>" http://localhost:1337/api/club/summary`
Expected: `{"data":{"seasons":0,"sections":0,"groups":0,"athletes":0,"priceLists":0,"numberedRegistrations":0}}`.
And without the header: `curl -s -o /dev/null -w '%{http_code}' http://localhost:1337/api/club/summary` → `403`.

- [ ] **Step 6: Commit**

```bash
git add src/club/history.ts src/club/__tests__/history.test.ts src/api/club
git commit -m "feat(club): history helper and admin summary endpoint"
```

---

### Task 9: Migration script (dry-run by default)

**Files:**
- Create: `scripts/migrate-club-foundation.js`
- Modify: `package.json` (script `migrate:club`)

**Interfaces:**
- Consumes (compiled): `dist/src/club/migrate/plan.js` (`planSeasons`, `planGroups`, `planPriceLists`, `planAthletes`), `dist/src/club/migrate/canonical.js` (`CANONICAL_SECTIONS`), `dist/src/club/registration-number.js` (`planRegistrationBackfill`), `dist/src/club/migrate/names.js` (`parsePrice`), `dist/src/club/history.js` (`recordHistory`), `dist/src/club/season.js` (`normalizeSeasonLabel`).
- Produces: `npm run migrate:club` (dry run, prints the plan) and `npm run migrate:club -- --apply` (writes). Safe to re-run.

- [ ] **Step 1: Write the script**

`scripts/migrate-club-foundation.js`:

```js
'use strict';
/**
 * Phase 1 data migration: seasons, sections, groups, price lists, athletes from
 * public profiles, registration numbers. Dry run by default; pass --apply to write.
 * Idempotent: every planner receives what already exists.
 */
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const APPLY = process.argv.includes('--apply');
const ACTOR = 'migrare';

async function main() {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const lib = (p) => require(`../dist/src/club/${p}`);
  const { planSeasons, planGroups, planPriceLists, planAthletes } = lib('migrate/plan');
  const { CANONICAL_SECTIONS } = lib('migrate/canonical');
  const { planRegistrationBackfill } = lib('registration-number');
  const { parsePrice } = lib('migrate/names');
  const { recordHistory } = lib('history');
  const { normalizeSeasonLabel } = lib('season');
  const docs = (uid) => app.documents(uid);
  const log = (...a) => console.log(APPLY ? '[apply]' : '[dry-run]', ...a);
  const created = async (uid, subjectType, data) => {
    if (!APPLY) return { documentId: `(new ${subjectType})`, ...data };
    const doc = await docs(uid).create({ data });
    await recordHistory(app, { subjectType, subjectId: doc.documentId, action: 'created', actor: ACTOR, changes: data });
    return doc;
  };

  try {
    // Seasons
    const settings = (await docs('api::site-settings.site-settings').findFirst({}))?.registration ?? {};
    const pricing = (await docs('api::pricing.pricing').findFirst({}))?.tiers ?? {};
    const regRows = await app.db.query('api::registration-submission.registration-submission').findMany({
      select: ['documentId', 'season', 'submittedAt', 'registrationNumber'],
      limit: 100000,
    });
    const existingSeasons = await docs('api::season.season').findMany({ limit: 1000 });
    const seasonPlan = planSeasons({
      registrationSeasons: regRows.map((r) => r.season),
      settings,
      memberFee: parsePrice(pricing.memberFeePrice),
      existing: existingSeasons.map((s) => s.label),
    });
    for (const s of seasonPlan.create) {
      log('season', s.label, s.isCurrent ? '(current)' : '', s.needsReview ? '(needs review)' : '');
      await created('api::season.season', 'season', s);
    }

    // Sections
    const existingSections = await docs('api::section.section').findMany({ limit: 100 });
    const sectionsByKind = {};
    for (const s of existingSections) sectionsByKind[s.kind] = s;
    for (const s of CANONICAL_SECTIONS) {
      if (existingSections.some((e) => e.name === s.name)) continue;
      log('section', s.name);
      sectionsByKind[s.kind] = await created('api::section.section', 'section', s);
    }

    // Price lists
    const existingLists = await docs('api::price-list.price-list').findMany({ limit: 100 });
    const listPlan = planPriceLists({
      memberTiers: pricing.memberTiers ?? [],
      nonMemberTiers: pricing.nonMemberTiers ?? [],
      existing: existingLists.map((l) => l.name),
    });
    const listsByName = Object.fromEntries(existingLists.map((l) => [l.name, l]));
    for (const l of listPlan.create) {
      log('price list', l.name, `${l.items.length} items`);
      listsByName[l.name] = await created('api::price-list.price-list', 'price-list', {
        name: l.name,
        items: l.items,
        section: sectionsByKind.school?.documentId,
      });
    }
    if (listPlan.unmatched.length) log('price labels to review by hand:', listPlan.unmatched.join(', '));

    // Groups
    const program = await docs('api::program.program').findFirst({});
    const seriesCourses = (program?.scheduleGroups ?? []).flatMap((g) => g.courses ?? []);
    const coaches = await docs('api::team-member.team-member').findMany({ limit: 500 });
    const existingGroups = await docs('api::group.group').findMany({ limit: 500 });
    const groupPlan = planGroups({
      seriesCourses,
      coachGroups: coaches.map((c) => ({ coachId: c.documentId, groups: Array.isArray(c.groups) ? c.groups : [] })),
      existing: existingGroups.map((g) => g.name),
    });
    for (const g of groupPlan.create) {
      log('group', g.name, g.sectionKind, g.priceList ?? '(no price list)', `coaches: ${g.coachIds.length}`);
      await created('api::group.group', 'group', {
        name: g.name,
        section: sectionsByKind[g.sectionKind]?.documentId,
        priceList: g.priceList ? listsByName[g.priceList]?.documentId : null,
        coaches: g.coachIds,
      });
    }
    if (groupPlan.unknown.length) log('group text to review by hand:', groupPlan.unknown.join(', '));

    // Athletes from public profiles
    const profiles = await app.db.query('api::sportsperson.sportsperson').findMany({ select: ['documentId', 'name'], limit: 5000 });
    const uniqueProfiles = [...new Map(profiles.map((p) => [p.documentId, p])).values()];
    const linked = await docs('api::athlete.athlete').findMany({ populate: { publicProfile: { fields: ['documentId'] } }, limit: 5000 });
    const athletePlan = planAthletes({
      sportspeople: uniqueProfiles,
      linkedProfileIds: linked.map((a) => a.publicProfile?.documentId).filter(Boolean),
    });
    for (const a of athletePlan.create) {
      log('athlete', `${a.firstName} ${a.lastName}`);
      await created('api::athlete.athlete', 'athlete', {
        firstName: a.firstName,
        lastName: a.lastName,
        dataIncomplete: true,
        publicProfile: a.publicProfileId,
      });
    }

    // Registration numbers
    const numberPlan = planRegistrationBackfill(regRows);
    log('registration numbers to assign:', numberPlan.assign.length, 'skipped (no season):', numberPlan.skipped.length);
    if (APPLY) {
      const seasons = await docs('api::season.season').findMany({ limit: 1000 });
      const seasonByLabel = Object.fromEntries(seasons.map((s) => [s.label, s.documentId]));
      const regById = Object.fromEntries(regRows.map((r) => [r.documentId, r]));
      for (const a of numberPlan.assign) {
        const label = normalizeSeasonLabel(regById[a.documentId].season);
        await docs('api::registration-submission.registration-submission').update({
          documentId: a.documentId,
          data: { registrationNumber: a.registrationNumber, seasonRef: seasonByLabel[label], section: sectionsByKind.school?.documentId },
        });
      }
    }
  } catch (e) {
    console.error(e);
    await app.destroy();
    process.exit(1);
  }
  await app.destroy();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Register the npm script**

In `package.json` `"scripts"`, after `"seed:navigation"` add:
```json
    "migrate:club": "node scripts/migrate-club-foundation.js",
```

- [ ] **Step 3: Get local data that looks like production**

Use the existing export/import scripts locally (`npm run export:content` on a copy, or a local Postgres restore of a backup). Never point this at production in this task. Check the compiled path exists after one `npm run build`: `ls dist/src/club/migrate/plan.js`.

- [ ] **Step 4: Dry run**

Run: `npm run migrate:club`
Expected: lines for 1-2 seasons (current one marked), 2 sections, 2 price lists, 9 groups (Avansați and Profesioniști as club, Andreea Pascu as coach; Intermediari Silver/Bronze with Virgil Pascu), one athlete per public profile, the count of registration numbers, and any "to review by hand" lists. Nothing is written: `curl` the summary endpoint and see all zeros.

- [ ] **Step 5: Apply, then re-run to prove idempotency**

Run: `npm run migrate:club -- --apply`
Then `curl -s -H "Authorization: Bearer <jwt>" http://localhost:1337/api/club/summary`
Expected: seasons >= 1, sections 2, groups 9, priceLists 2, athletes = number of public profiles, numberedRegistrations = registrations with a season.
Run `npm run migrate:club -- --apply` again, then the summary again.
Expected: identical numbers; the dry-run part prints nothing to create.
Spot-check in the admin content manager: "Primii Pași" spelled with ș; registration numbers like `2026-0001`; history entries with actor "migrare".

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-club-foundation.js package.json
git commit -m "feat(club): idempotent phase 1 data migration (dry run by default)"
```

---

### Task 10: Docs

**Files:**
- Modify: `docs/architecture/07-strapi-mapping.md` (status line under each table)
- Modify: `docs/architecture/README.md` (Steps list: mark 1-7 done, plan link)

- [ ] **Step 1: Update `07-strapi-mapping.md`**

Add at the top, under the title:
```markdown
Status (phase 1, branch `feat/club-foundation`): new types created; `sportsperson` kept under its current API name and linked one-to-one from `athlete` (rename later); migration script `npm run migrate:club` (dry run) / `-- --apply`.
```

- [ ] **Step 2: Update `README.md`**

Under "## Steps", append:
```markdown
Implementation: phase 1 plan in `docs/superpowers/plans/2026-10-19-club-data-foundation.md`.
```

- [ ] **Step 3: Full check and commit**

Run: `npm test` (all PASS) and `npx tsc --noEmit` (no new errors).

```bash
git add docs/architecture/07-strapi-mapping.md docs/architecture/README.md
git commit -m "docs(architecture): phase 1 status and plan link"
```
