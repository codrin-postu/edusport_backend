# Phase 2E: Google Sheet Columns per Season Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Înscrieri Google Sheet one column set per season tab: a tab filled by the new registration form shows Nr. înscriere, Școală, the script form's questions under the short titles of the approved screen, Acord GDPR, Acord Regulament, Notă internă and "Deschide documentul" linking to the registration in the admin; older tabs keep exactly the columns they have today.

**Architecture:** `matrix.ts` builds column plans from small column tables; a new `script-form.ts` holds the new form's columns. `inscrieriTabPlans(rows, tabFor)` groups the rows by tab and picks each tab's plan from the rows it holds. `registry.ts` exposes those plans as `resolveTabPlans()`, and `sync.ts` renders, checks and repairs every tab against its own plan (`planOf(ctx, tab)`), keeping the queue, the debounce, insert-before-delete moves and the idempotent resync and reconcile. The Document cell is written as the text "Deschide documentul" (writes stay RAW) and then made a rich-text link to `/admin/plugins/edusport-inscrieri?q=<Nr. înscriere>&season=all` by `updateCells` requests, one `spreadsheets.batchUpdate` per sync operation, sent after the inserts and before any delete. The Înscrieri page reads `?q=` and `?season=` on load, and its quick search also matches the registration number.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS, `strict: false`), Vitest 3, Google Sheets API v4 through `src/sheets/client.ts` (its `SHEETS_DRY_RUN` in-memory spreadsheet drives the sync tests), React admin (Strapi admin, `src/admin`).

**Validated:** the code in this plan was applied on 2026-10-21 to a scratch copy of the repo with plan 2A's Task 1 (schema) and Task 2 (`inscriere` registry) applied: Vitest 131 tests passed, `npx tsc --noEmit` and `npx tsc -p src/admin/tsconfig.json --noEmit` reported zero errors, and the Task 5 boot check was run as written (outputs below are the observed ones; the container was removed).

**Spec:** `docs/superpowers/specs/2026-10-19-registration-rebuild-design.md` section 4.3, read with `../edusport_frontend/docs/portal/DECISIONS.md` 2026-10-05 (decisions-1-5, points 1 and 2; screen `mockups/screens/decisions-1-5.html`) and 2026-10-05 (consents as two Da/Nu columns). Interfaces from plan 2A: `docs/superpowers/plans/2026-10-19-phase2a-registration-data.md` (assumed merged).

**User decisions (2026-10-21), applied here:**
- E1: old-website rows in a switched tab use the same columns; their old-only answers stay in the admin.
- E2: a new-form registration moved into an old season switches that tab too (the rule below, no season list).
- E3: the 2026-2027 titles are the short ones of the approved screen `decisions-1-5.html`, in its order; the columns it does not show get short titles in the same style: Școală (after Stare), Altă calitate (after Calitatea față de sportiv), Altă sursă (after De unde ați aflat). The screen's "E-mail" column belongs to plan 2F.
- E4: "Notă internă" (`internalNote`) right before Document.
- E5: the Document cell shows "Deschide documentul" as a rich-text link; the extra request is accepted, batched once per operation, and tested with the dry-run spreadsheet.
- `CMS_PUBLIC_URL` is the shared env var (2F uses it too).

**The rule that picks a tab's columns (no season list):** a tab gets the new form's columns when at least one of its rows came from the new form, recognised by a stored `membershipAnswer` (`da` or `nu`). The new form always sends it (`lockedRequired` in 2A's registry) and older rows keep `null` (2A Task 1: no default on the new fields, "which is how the admin and the Sheet tell old from new"). Every other tab, `fara-sezon` included, keeps today's columns, planned over the rows of those tabs only, so a new season never changes an old tab. Chosen over the season label because it needs no hardcoded season and no year comparison, and the 2026-2027 tab switches by itself at its first new-form registration.

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, branch `feat/registration-rebuild`.
- Strapi 5, TypeScript in `src/`, single quotes in `src/`.
- Functions < 30 lines, cyclomatic complexity < 10, no `any` (`UID.ContentType` for UIDs). Scope in this plan: every new or rewritten function follows the limits; the existing long functions of `sync.ts`, `format.ts` and `client.ts` that only change by a few lines (`upsertMulti`, `reconcileSingle`, `batchSingle`, `formatRequests`, `batchUpdateSheet`, ...) keep their current size, and existing `as any` casts on lines this plan does not rewrite stay.
- Tests: Vitest via `npm test`, plus `npx tsc --noEmit` with zero errors after every task; tasks that touch `src/admin` also run `npx tsc -p src/admin/tsconfig.json --noEmit` with zero errors.
- Test helpers that are not test files are named `*.test.helper.ts`, so the root `tsconfig.json` exclude `**/*.test.*` keeps them out of the Strapi build (checked: `dist/src/sheets/__tests__` is not produced).
- No schema change in 2E: no content type is added or changed, so no `ts:generate-types` and no Strapi restart are needed for it.
- Copy rules for user-visible text (Sheet headers and cells, admin): no em dash, no middle dot, no emoji; terse; UI copy in Romanian, code and docs in English; never pad the client's own wording; Romanian ș and ț with the comma below.
- No rounded pills or circles in UI; no dashed or dotted lines (2E adds no UI element).
- Commits: Conventional Commits, no AI attribution, no `Co-Authored-By`. Never push. Never run anything against production.
- Boot checks use a throwaway Postgres container on a free port (this plan uses 55491) with Strapi on 1338 or higher (this plan uses 1349; 1337 is taken), never the user's local database (`strapi_db`) or the running `strapi_app` container; remove the container afterwards. Other planners' containers (`es2a-pg`, `es2b-pg`, ...) are not touched.
- Keep the queue (`queue.ts`), the 2 s debounce, insert-before-delete moves, and the idempotent resync and reconcile; `queue.ts`, `lifecycle.ts` and `store.ts` are not changed. `client.ts` only gains the link cell, the first row of an append, and dry-run links.

## Review Focus

- The first new-form registration of a season whose tab already holds rows from the old website form: the tab switches to the new columns in the same queue flush, old rows keep the answers both forms share, and the 2025-2026 tab stays byte for byte as it was (Task 4: "switches a season tab to the new columns when its first new-form row arrives").
- The last new-form row leaves a season tab (its season is changed): no copy is left behind and the next reconciles do not rewrite the whole spreadsheet again and again (Task 4: "moves a row between seasons...", "settles after the last new-form row leaves a season").
- The Document link after every kind of write: values writes leave plain text, so the link is set again for each written row, stays on its row when rows above it are deleted, and is absent (empty cell, no link) without `CMS_PUBLIC_URL` (Task 4: links asserted after resync, a queued edit, the first new-form row, a move, a reconcile repair, a delete; "shows no link and no text without CMS_PUBLIC_URL"; Task 5 Step 2).
- An admin who is logged out clicks the Document link: after login they land on the Înscrieri page with that registration open, in every season (Task 5 Step 4: the login keeps `redirectTo` with the query).
- When a tab switches columns, `Stare` moves from column B to C: its status colours move with it, without stale or stacked rules (Task 4: "moves the status colours with the Stare column, without stacking rules").

---

## File Structure

```
src/sheets/
  cells.ts            yesNo, cellStr, listStr, extraCell: how a stored value prints (Task 2; moved out of matrix.ts)
  admin-link.ts       INSCRIERI_ADMIN_PATH, cmsPublicUrl, registrationAdminUrl (Task 2)
  script-form.ts      isScriptFormRow, SCRIPT_FORM_LEAD / SCRIPT_FORM_COLS / SCRIPT_FORM_TAIL (Task 2)
  matrix.ts           BuiltinCol with `cell`, layouts, planFromMeta, TabPlans, singlePlan, ID_LABEL, inscrieriTabPlans (Task 2)
  registry.ts         Spec.tabPlans / populate, Descriptor.resolveTabPlans / fetchByIds, typed UIDs (Task 3)
  sync.ts             contexts carry one plan (single) or TabPlans (multi); every tab checked and written with its own plan; link requests queued and sent once per operation (Task 4)
  format.ts           `link` width (Task 2); link cells, LINK_TEXT, linkRequests; status-colour rules found by content (Task 4)
  client.ts           LinkCell, firstRowOf, append start row, dry-run links and _dryLinks (Task 4)
  __tests__/fakes.test.helper.ts   global `strapi` fake for the Sheets tests (Task 2)
  __tests__/matrix-legacy.test.ts  today's Înscrieri columns, pinned before the refactor (Task 2)
  __tests__/admin-link.test.ts, script-form-plan.test.ts (Task 2), registry-tabs.test.ts (Task 3), format-links.test.ts, sync-tabs.test.ts (Task 4)
src/api/registration-submission/
  list-search.ts      quickSearchClause: the Înscrieri quick search, now with the registration number (Task 1)
  controllers/registration-submission.ts  buildListFilters uses quickSearchClause (Task 1)
src/admin/dashboard/SubmissionTable.tsx   initialQuery: `?q=` and `?season=` set the first list query (Task 1)
.env.example, docker-compose.yml          CMS_PUBLIC_URL (Task 1)
```

## Tasks and parallel groups

| Group | Tasks | Runs after |
|---|---|---|
| A | 1 Admin search and link target, 2 Script-form columns per tab | plan 2A merged; both in parallel (separate files) |
| B | 3 Registry: per-tab plans, relations, fetch by id | group A |
| C | 4 Sync engine per tab, Document links, status colours | group B |
| D | 5 Boot check on a throwaway Postgres and the browser | everything |

---

### Task 1: Admin search and link target

**Files:**
- Create: `src/api/registration-submission/list-search.ts`
- Test: `src/api/registration-submission/__tests__/list-search.test.ts`
- Modify: `src/api/registration-submission/controllers/registration-submission.ts` (imports; the quick-search block of `buildListFilters`)
- Modify: `src/admin/dashboard/SubmissionTable.tsx` (a helper before `export default function SubmissionTablePage`; the three "server query state" lines)
- Modify: `.env.example`, `docker-compose.yml`

**Interfaces:**
- Consumes: the `registrationNumber` column (phase 1; plan 2A adds the database unique index).
- Produces:
  - `type QuickSearchClause = { $or: Record<string, { $containsi: string }>[] }`; `quickSearchClause(q: string): QuickSearchClause | null` (`list-search.ts`).
  - Link target (the contract Task 2's `registrationAdminUrl` builds): `<CMS_PUBLIC_URL>/admin/plugins/edusport-inscrieri?q=<registrationNumber>&season=all` opens Înscrieri with that text in the search box and "Toate sezoanele"; the list then holds that one registration and the compact view opens it in the detail panel (existing behaviour: the first row is selected).
  - Env `CMS_PUBLIC_URL`: the CMS public origin, no trailing slash.

Why this task: the Înscrieri page has no address for one registration today (`SubmissionTable.tsx` keeps `selectedId` in React state only, and `GET /api/forms/inscrieri` has no single-row route). Reusing the existing search box and season filter needs no new route and no new UI, and clearing the search returns to the usual list.

- [ ] **Step 1: Write the failing test**

`src/api/registration-submission/__tests__/list-search.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { quickSearchClause } from '../list-search';

describe('Înscrieri quick search', () => {
  it('matches the registration number as well as names, e-mail and phone', () => {
    expect(quickSearchClause(' 2026-0142 ')).toEqual({
      $or: [
        { childName: { $containsi: '2026-0142' } },
        { parentName: { $containsi: '2026-0142' } },
        { email: { $containsi: '2026-0142' } },
        { phone: { $containsi: '2026-0142' } },
        { registrationNumber: { $containsi: '2026-0142' } },
      ],
    });
  });

  it('adds no clause for an empty search', () => {
    expect(quickSearchClause('   ')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- src/api/registration-submission/__tests__/list-search.test.ts`
Expected: FAIL (`Failed to load url ../list-search` / cannot find module).

- [ ] **Step 3: Create the search clause**

`src/api/registration-submission/list-search.ts`:

```ts
/**
 * The Înscrieri quick search (`?q=` on GET /api/forms/inscrieri): child, parent, e-mail, phone and the
 * registration number. The number is what the Google Sheet's Document link searches for
 * (src/sheets/admin-link.ts).
 */
const QUICK_SEARCH_FIELDS = ['childName', 'parentName', 'email', 'phone', 'registrationNumber'] as const;

export type QuickSearchClause = { $or: Record<string, { $containsi: string }>[] };

export function quickSearchClause(q: string): QuickSearchClause | null {
  const term = q.trim();
  if (!term) return null;
  return { $or: QUICK_SEARCH_FIELDS.map((field) => ({ [field]: { $containsi: term } })) };
}
```

- [ ] **Step 4: Use it in the list endpoint**

In `src/api/registration-submission/controllers/registration-submission.ts`, after the line

```ts
import { resyncForm } from '../../../sheets/sync';
```

add

```ts
import { quickSearchClause } from '../list-search';
```

and in `buildListFilters` replace

```ts
  // --- quick search across name/parent/email/phone
  const q = trimOrEmpty(query.q);
  if (q) {
    and.push({
      $or: [
        { childName: { $containsi: q } },
        { parentName: { $containsi: q } },
        { email: { $containsi: q } },
        { phone: { $containsi: q } },
      ],
    });
  }
```

with

```ts
  // --- quick search across name/parent/email/phone/registration number
  const search = quickSearchClause(trimOrEmpty(query.q));
  if (search) and.push(search);
```

(The CSV export goes through the same `buildListFilters`, so an export from a searched list also matches the number.)

- [ ] **Step 5: Let the page URL set the first query**

In `src/admin/dashboard/SubmissionTable.tsx`, directly above

```tsx
export default function SubmissionTablePage({ cfg }: { cfg: SubmissionTableCfg }) {
```

add

```tsx
/** The first list query from the page URL: `?q=` (search) and `?season=` (a season label or `all`). */
function initialQuery(): { q: string; season: string } {
  if (typeof window === 'undefined') return { q: '', season: '' };
  const params = new URLSearchParams(window.location.search);
  return { q: (params.get('q') ?? '').trim(), season: (params.get('season') ?? '').trim() };
}
```

and replace

```tsx
  // --- server query state
  const [season, setSeason] = React.useState<string>(''); // '' => server default (active)
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
```

with

```tsx
  // --- server query state; `?q=` and `?season=` in the page URL set the first query (the
  // Google Sheet's Document link opens one registration this way, see src/sheets/admin-link.ts)
  const [initial] = React.useState(initialQuery);
  const [season, setSeason] = React.useState<string>(initial.season); // '' => server default (active)
  const [searchInput, setSearchInput] = React.useState(initial.q);
  const [search, setSearch] = React.useState(initial.q);
```

The season select already shows `all` as "Toate sezoanele" (`seasonSelectValue = season || activeSeason || 'all'`), and the server already reads `season=all` as every season. The other pages built on `SubmissionTablePage` (Voluntari, Parteneri, Mesaje) only gain the same optional `?q=`.

- [ ] **Step 6: Document the variable**

In `.env.example`, after

```
# Legacy: seeds the Înscrieri link on first boot if no link record exists yet.
SHEETS_SPREADSHEET_ID=
SHEETS_TAB_NAME=
```

add

```
# Public address of this CMS (no trailing slash), e.g. https://cms.example.com.
# The Înscrieri Sheet's "Document" column links to the admin with it; unset,
# that column stays empty.
CMS_PUBLIC_URL=
```

In `docker-compose.yml`, after

```yaml
      SHEETS_SPREADSHEET_ID: ${SHEETS_SPREADSHEET_ID:-}
      SHEETS_TAB_NAME: ${SHEETS_TAB_NAME:-}
```

add

```yaml
      # Public CMS address for the Înscrieri Sheet's "Document" links.
      CMS_PUBLIC_URL: ${CMS_PUBLIC_URL:-http://localhost:1337}
```

(Production reads `.env.production` through `env_file`, so it needs no compose change; see "Notes for later plans".)

- [ ] **Step 7: Run the tests and both type checks**

Run: `npm test -- src/api/registration-submission/__tests__/list-search.test.ts` (PASS), then `npm test`, `npx tsc --noEmit` and `npx tsc -p src/admin/tsconfig.json --noEmit`.
Expected: all PASS, zero type errors.

- [ ] **Step 8: Commit**

```bash
git add src/api/registration-submission/list-search.ts src/api/registration-submission/__tests__/list-search.test.ts \
  src/api/registration-submission/controllers/registration-submission.ts src/admin/dashboard/SubmissionTable.tsx \
  .env.example docker-compose.yml
git commit -m "feat(inscrieri): search by registration number and open a search from the page URL"
```

---

### Task 2: Script-form columns per season tab

**Files:**
- Create: `src/sheets/cells.ts`, `src/sheets/admin-link.ts`, `src/sheets/script-form.ts`
- Modify: `src/sheets/matrix.ts` (whole file replaced; the four forms' column tables are unchanged)
- Modify: `src/sheets/format.ts` (`WIDTH`: one entry for the new `link` column type)
- Test: `src/sheets/__tests__/fakes.test.helper.ts`, `src/sheets/__tests__/matrix-legacy.test.ts`, `src/sheets/__tests__/admin-link.test.ts`, `src/sheets/__tests__/script-form-plan.test.ts`

**Interfaces:**
- Consumes: plan 2A's stored fields on `registration-submission` (`registrationNumber`, `section` relation, `relationship`, `relationshipOther`, `childHeight`, `lastSeason`, `membershipAnswer`, `subscriptionChoice` `{ priceItemName, price, member }`, `source`, `sourceOther`, `gdprConsent`, `regulationsConsent`) and, in the test only, 2A's `inscriere` registry (`REGISTRY`, `questionMap` from `src/api/form-config/registry.ts`). The link target from Task 1 (a fixed string here; no import).
- Produces:
  - `cells.ts`: `yesNo(v: unknown): string`, `cellStr(v: unknown): string`, `listStr(v: unknown): string`, `extraCell(v: unknown): string` (`matrix.ts` re-exports the first three, as before).
  - `admin-link.ts`: `INSCRIERI_ADMIN_PATH = '/admin/plugins/edusport-inscrieri'`, `cmsPublicUrl(env?: NodeJS.ProcessEnv): string`, `registrationAdminUrl(origin: string, registrationNumber: unknown): string`.
  - `script-form.ts`: `isScriptFormRow(row: RowLike): boolean`, `SCRIPT_FORM_LEAD`, `SCRIPT_FORM_COLS`, `SCRIPT_FORM_TAIL: BuiltinCol[]`.
  - `matrix.ts`: `interface BuiltinCol { key; label; type?; cell?: (r: RowLike) => string }` (now exported), `interface TabPlans { forTab(tab: string): ColumnPlan }`, `singlePlan(plan: ColumnPlan): TabPlans`, `ID_LABEL = 'ID'`, `inscrieriTabPlans(rows: RowLike[], tabFor: (doc: RowLike) => string): Promise<TabPlans>`, and `ColumnType` gains `'link'` (an address, shown as a link from Task 4). Unchanged exports: `RowLike`, `ColumnType`, `ColumnPlan`, `Matrix`, `INSCRIERI_COLS` and the other `*_COLS`, `inscrieriPlan`, `voluntariPlan`, `parteneriPlan`, `contactPlan`, `buildInscrieriMatrix`, `buildVoluntariMatrix`.

The new tab's columns, in order (user decision E3: the approved screen `decisions-1-5.html` option A, its titles and order; the columns it does not show get short titles in its style): `Nr. înscriere`, `Trimis la`, `Stare`, `Școală`, `Adresă de e-mail`, `Persoana care completează`, `Calitatea față de sportiv`, `Altă calitate`, `Telefon de contact`, `Numele copilului`, `Data nașterii`, `Înălțimea (cm)`, `Măsura bluză`, `Sezonul trecut`, `Nivel de experiență`, `Așteptări`, `Membru A.C.S.`, `La primul modul`, `De unde ați aflat`, `Altă sursă`, `Acord GDPR`, `Acord Regulament`, any custom questions, `Notă internă` (E4), `Document`, `ID`. The questions follow the script form's order (2A's registry; a test pins it). `ID` stays last because it is the sync key. Cells: membership `da`/`nu` prints "Da"/"Nu"; relationship codes print "Părinte", "Tutore Legal", "Alta" (the free text is in Altă calitate); the subscription prints its `priceItemName`; Școală prints the section name; Document is a `link` column whose value is the address (or nothing without `CMS_PUBLIC_URL` or a number). Until Task 4 the address is written as plain text; Task 4 shows it as "Deschide documentul" linking to it. Rows from the old website form in such a tab fill the columns both forms share; their old-only answers stay in the admin (E1).

- [ ] **Step 1: Pin today's columns before touching anything**

`src/sheets/__tests__/fakes.test.helper.ts`:

```ts
/**
 * A minimal global `strapi` for the Sheets tests: form-config meta, a document store per content type, a logger.
 * Only what src/sheets touches is faked.
 */
import { vi } from 'vitest';

export type FormMetaFake = { removedBuiltins: string[]; customs: { key: string; label: string; type?: string }[] };
export type Doc = Record<string, unknown> & { documentId: string };

type FindArgs = { filters?: { documentId?: { $in?: string[] } }; populate?: unknown };

export function installStrapi(docs: Doc[], meta: FormMetaFake = { removedBuiltins: [], customs: [] }) {
  const findMany = vi.fn(async (args: FindArgs = {}) => {
    const ids = args.filters?.documentId?.$in;
    return ids ? docs.filter((d) => ids.includes(d.documentId)) : [...docs];
  });
  const fake = {
    service: () => ({ adminFormMeta: async () => meta }),
    documents: () => ({ findMany, count: async () => docs.length }),
    log: { info: () => undefined, warn: () => undefined, error: () => undefined },
  };
  (globalThis as unknown as { strapi: unknown }).strapi = fake;
  return { findMany };
}
```

`src/sheets/__tests__/matrix-legacy.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { buildInscrieriMatrix, inscrieriPlan } from '../matrix';
import { installStrapi } from './fakes.test.helper';

const OLD_ROW = {
  documentId: 'doc-old',
  submittedAt: '2025-09-14T15:02:00.000Z',
  status: 'Confirmat',
  childName: 'Ana Bălan',
  childBirthDate: '2016-05-05',
  parentName: 'Elena Bălan',
  email: 'parinte3@exemplu.ro',
  phone: '0722000000',
  level: 'Incepatori',
  shirtSize: 'S',
  howHeard: 'Prieteni',
  clubInterest: true,
  regulationsAgreement: true,
  privacyConsent: false,
  priorExperience: '1 an',
  expectations: 'Piruete',
  internalNote: null,
  extra: { c1: true, retired: 'x' },
};

describe('Înscrieri columns as they are today (characterization)', () => {
  beforeEach(() => {
    installStrapi([], { removedBuiltins: ['level'], customs: [{ key: 'c1', label: 'Întrebare', type: 'checkbox' }] });
  });

  it('keeps the header, types and cells of the old tabs', async () => {
    const plan = await inscrieriPlan([OLD_ROW]);
    expect(plan.header).toEqual([
      'Trimis la', 'Stare', 'Nume copil', 'Data nasterii', 'Nume parinte', 'Email', 'Telefon', 'Nivel (eliminata)',
      'Marime tricou', 'Cum a aflat', 'Interes club', 'Acord regulament', 'Acord confidentialitate',
      'Experienta anterioara', 'Asteptari', 'Nota interna', 'Întrebare', 'retired (eliminata)', 'ID',
    ]);
    expect(plan.types).toEqual([
      'datetime', 'status', 'text', 'date', 'text', 'email', 'tel', 'text', 'text', 'text', 'bool', 'bool', 'bool',
      'longtext', 'longtext', 'longtext', 'bool', 'text', 'id',
    ]);
    expect(plan.row(OLD_ROW)).toEqual([
      '2025-09-14T15:02:00.000Z', 'Confirmat', 'Ana Bălan', '2016-05-05', 'Elena Bălan', 'parinte3@exemplu.ro',
      '0722000000', 'Incepatori', 'S', 'Prieteni', 'Da', 'Da', 'Nu', '1 an', 'Piruete', '', 'Da', 'x', 'doc-old',
    ]);
  });

  it('keeps the CSV export on the same columns', async () => {
    const m = await buildInscrieriMatrix([OLD_ROW]);
    expect(m.header[0]).toBe('Trimis la');
    expect(m.matrix).toHaveLength(1);
  });
});
```

Run: `npm test -- src/sheets/__tests__/matrix-legacy.test.ts`
Expected: PASS on the current code (this is the characterization the refactor must keep).

- [ ] **Step 2: Write the failing tests**

`src/sheets/__tests__/admin-link.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { INSCRIERI_ADMIN_PATH, cmsPublicUrl, registrationAdminUrl } from '../admin-link';

describe('link to a registration in the admin', () => {
  it('opens the Înscrieri page searching that number in every season', () => {
    expect(registrationAdminUrl('https://cms.example.ro', '2026-0142')).toBe(
      'https://cms.example.ro/admin/plugins/edusport-inscrieri?q=2026-0142&season=all',
    );
  });

  it('points at the Înscrieri menu route under the /admin basename', () => {
    expect(INSCRIERI_ADMIN_PATH).toBe('/admin/plugins/edusport-inscrieri');
  });

  it('is empty without a number or without a configured origin', () => {
    expect(registrationAdminUrl('https://cms.example.ro', null)).toBe('');
    expect(registrationAdminUrl('https://cms.example.ro', '  ')).toBe('');
    expect(registrationAdminUrl('', '2026-0142')).toBe('');
  });

  it('reads the origin from CMS_PUBLIC_URL without a trailing slash', () => {
    expect(cmsPublicUrl({ CMS_PUBLIC_URL: ' https://cms.example.ro/ ' })).toBe('https://cms.example.ro');
    expect(cmsPublicUrl({})).toBe('');
  });
});
```

`src/sheets/__tests__/script-form-plan.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { inscrieriPlan, inscrieriTabPlans } from '../matrix';
import type { RowLike } from '../matrix';
import { SCRIPT_FORM_COLS, isScriptFormRow } from '../script-form';
import { REGISTRY } from '../../api/form-config/registry';
import { installStrapi } from './fakes.test.helper';

const tabFor = (r: RowLike) => (typeof r.season === 'string' && r.season ? r.season : 'fara-sezon');

const OLD_ROW: RowLike = {
  documentId: 'doc-old',
  season: '2025-2026',
  submittedAt: '2025-09-14T15:02:00.000Z',
  status: 'Confirmat',
  childName: 'Ana Bălan',
  level: 'Incepatori',
  clubInterest: true,
  extra: { retired: 'x' },
};

const NEW_ROW: RowLike = {
  documentId: 'doc-new',
  season: '2026-2027',
  registrationNumber: '2026-0142',
  submittedAt: '2026-10-03T11:22:00.000Z',
  status: 'Nou',
  section: { name: 'AFI Cotroceni' },
  email: 'parinte@exemplu.ro',
  parentName: 'Mihaela Dumitrescu',
  relationship: 'parinte',
  relationshipOther: null,
  phone: '0722111222',
  childName: 'Maria Dumitrescu',
  childBirthDate: '14.03.2014',
  childHeight: 142,
  shirtSize: 'S',
  lastSeason: 'Începători',
  priorExperience: 'Patinaj înainte, frânare',
  expectations: 'Să învețe piruete',
  membershipAnswer: 'da',
  subscriptionChoice: { priceItemName: 'Abonament 8', price: 300, member: true },
  source: 'Recomandare',
  sourceOther: null,
  gdprConsent: true,
  regulationsConsent: true,
  extra: {},
};

/** The approved screen decisions-1-5.html (option A), with the columns it does not show in its style. */
const SCRIPT_HEADER = [
  'Nr. înscriere', 'Trimis la', 'Stare', 'Școală', 'Adresă de e-mail', 'Persoana care completează',
  'Calitatea față de sportiv', 'Altă calitate', 'Telefon de contact', 'Numele copilului', 'Data nașterii',
  'Înălțimea (cm)', 'Măsura bluză', 'Sezonul trecut', 'Nivel de experiență', 'Așteptări', 'Membru A.C.S.',
  'La primul modul', 'De unde ați aflat', 'Altă sursă', 'Acord GDPR', 'Acord Regulament', 'Notă internă',
  'Document', 'ID',
];

/** The 2026-2027 columns of the approved screen, in its order (its E-mail column belongs to plan 2F). */
const SCREEN_ORDER = [
  'Nr. înscriere', 'Trimis la', 'Stare', 'Adresă de e-mail', 'Persoana care completează', 'Calitatea față de sportiv',
  'Telefon de contact', 'Numele copilului', 'Data nașterii', 'Înălțimea (cm)', 'Măsura bluză', 'Sezonul trecut',
  'Nivel de experiență', 'Așteptări', 'Membru A.C.S.', 'La primul modul', 'De unde ați aflat', 'Acord GDPR',
  'Acord Regulament', 'Document',
];

describe('which columns a season tab gets', () => {
  beforeEach(() => installStrapi([]));

  it('recognises a row from the new form by its stored membership answer', () => {
    expect(isScriptFormRow({ membershipAnswer: 'da' })).toBe(true);
    expect(isScriptFormRow({ membershipAnswer: 'nu' })).toBe(true);
    expect(isScriptFormRow({ membershipAnswer: null })).toBe(false);
    expect(isScriptFormRow({})).toBe(false);
    expect(isScriptFormRow({ membershipAnswer: 'Da' })).toBe(false);
  });

  it('gives a tab with new-form rows the script form columns and keeps the old tabs as they are', async () => {
    const noSeason: RowLike = { ...OLD_ROW, documentId: 'doc-x', season: null, extra: {} };
    const plans = await inscrieriTabPlans([OLD_ROW, noSeason, NEW_ROW], tabFor);
    const today = await inscrieriPlan([OLD_ROW, noSeason]);
    expect(plans.forTab('2026-2027').header).toEqual(SCRIPT_HEADER);
    expect(plans.forTab('2025-2026').header).toEqual(today.header);
    expect(plans.forTab('fara-sezon').header).toEqual(today.header);
    expect(plans.forTab('2024-2025').header).toEqual(today.header);
  });

  it('switches a tab as soon as one of its rows comes from the new form, with no season list', async () => {
    const later = { ...NEW_ROW, documentId: 'doc-later', season: '2031-2032' };
    const plans = await inscrieriTabPlans([OLD_ROW, later], tabFor);
    expect(plans.forTab('2031-2032').header).toEqual(SCRIPT_HEADER);
    expect(plans.forTab('2025-2026').header[0]).toBe('Trimis la');
  });

  it('never adds a new-form custom answer to the old tabs', async () => {
    const answered = { ...NEW_ROW, extra: { tricouMarime: 'M' } };
    const plans = await inscrieriTabPlans([OLD_ROW, answered], tabFor);
    expect(plans.forTab('2025-2026').header).not.toContain('tricouMarime (eliminata)');
    expect(plans.forTab('2026-2027').header).toContain('tricouMarime (eliminata)');
    expect(plans.forTab('2026-2027').header.slice(-3)).toEqual(['Notă internă', 'Document', 'ID']);
  });
});

describe('a new-form row in its season tab', () => {
  const saved = process.env.CMS_PUBLIC_URL;
  beforeEach(() => {
    installStrapi([]);
    process.env.CMS_PUBLIC_URL = 'https://cms.example.ro/';
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.CMS_PUBLIC_URL;
    else process.env.CMS_PUBLIC_URL = saved;
  });

  it('prints codes as the form shows them, Da/Nu for yes/no answers, the note and the registration address', async () => {
    const plan = (await inscrieriTabPlans([NEW_ROW], tabFor)).forTab('2026-2027');
    expect(plan.row({ ...NEW_ROW, internalNote: 'Sună după 18' })).toEqual([
      '2026-0142', '2026-10-03T11:22:00.000Z', 'Nou', 'AFI Cotroceni', 'parinte@exemplu.ro', 'Mihaela Dumitrescu',
      'Părinte', '', '0722111222', 'Maria Dumitrescu', '14.03.2014', '142', 'S', 'Începători',
      'Patinaj înainte, frânare', 'Să învețe piruete', 'Da', 'Abonament 8', 'Recomandare', '', 'Da', 'Da',
      'Sună după 18', 'https://cms.example.ro/admin/plugins/edusport-inscrieri?q=2026-0142&season=all', 'doc-new',
    ]);
  });

  it('prints Tutore Legal, Alta with its text, Nu, and a refused consent', async () => {
    const other = {
      ...NEW_ROW,
      relationship: 'alta',
      relationshipOther: 'Bunic',
      membershipAnswer: 'nu',
      source: 'Altele',
      sourceOther: 'Afiș',
      gdprConsent: false,
    };
    const plan = (await inscrieriTabPlans([other], tabFor)).forTab('2026-2027');
    const cells = Object.fromEntries(plan.header.map((h, i) => [h, plan.row(other)[i]]));
    expect(cells['Calitatea față de sportiv']).toBe('Alta');
    expect(cells['Altă calitate']).toBe('Bunic');
    expect(cells['Membru A.C.S.']).toBe('Nu');
    expect(cells['Altă sursă']).toBe('Afiș');
    expect(cells['Acord GDPR']).toBe('Nu');
    expect(plan.row({ ...NEW_ROW, relationship: 'tutore' })[6]).toBe('Tutore Legal');
  });

  it('leaves the Document cell empty when the CMS address is not configured', async () => {
    delete process.env.CMS_PUBLIC_URL;
    const plan = (await inscrieriTabPlans([NEW_ROW], tabFor)).forTab('2026-2027');
    expect(plan.row(NEW_ROW).at(-2)).toBe('');
  });

  it('shows an old-form row moved into a new season with the answers both forms share', async () => {
    const moved = { ...OLD_ROW, documentId: 'doc-moved', season: '2026-2027', email: 'a@b.ro', phone: '0700' };
    const plan = (await inscrieriTabPlans([NEW_ROW, moved], tabFor)).forTab('2026-2027');
    const cells = Object.fromEntries(plan.header.map((h, i) => [h, plan.row(moved)[i]]));
    expect(cells['Numele copilului']).toBe('Ana Bălan');
    expect(cells['Adresă de e-mail']).toBe('a@b.ro');
    expect(cells['Membru A.C.S.']).toBe('');
    expect(cells['Școală']).toBe('');
    expect(cells.Document).toBe('');
  });

  it('types the columns for the sheet: dates, contacts, long texts, Da/Nu, the status', async () => {
    const plan = (await inscrieriTabPlans([NEW_ROW], tabFor)).forTab('2026-2027');
    const types = Object.fromEntries(plan.header.map((h, i) => [h, plan.types[i]]));
    expect(types['Trimis la']).toBe('datetime');
    expect(types.Stare).toBe('status');
    expect(types['Data nașterii']).toBe('date');
    expect(types['Adresă de e-mail']).toBe('email');
    expect(types['Telefon de contact']).toBe('tel');
    expect(types['Așteptări']).toBe('longtext');
    expect(types['Notă internă']).toBe('longtext');
    expect(types.Document).toBe('link');
    expect(types['Membru A.C.S.']).toBe('bool');
    expect(types['Acord Regulament']).toBe('bool');
    expect(types.ID).toBe('id');
  });
});

describe('titles and order', () => {
  it('follow the approved screen, with the extra columns in their places', async () => {
    installStrapi([]);
    const header = (await inscrieriTabPlans([NEW_ROW], tabFor)).forTab('2026-2027').header;
    expect(header.filter((h) => SCREEN_ORDER.includes(h))).toEqual(SCREEN_ORDER);
  });

  it('ask the questions in the script form order (2A registry)', () => {
    const registryOrder = REGISTRY.inscriere.steps.flatMap((s) => s.questions.map((x) => x.key));
    expect(SCRIPT_FORM_COLS.map((c) => c.key).filter((k) => k !== 'section')).toEqual(registryOrder);
  });

  it('never use an em dash, a middle dot or a cedilla', () => {
    const all = JSON.stringify(SCRIPT_FORM_COLS.map((c) => c.label));
    expect(all).not.toMatch(/[—·şţŞŢ]/);
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npm test -- src/sheets/__tests__/admin-link.test.ts src/sheets/__tests__/script-form-plan.test.ts`
Expected: FAIL (cannot find module `../admin-link` and `../script-form`).

- [ ] **Step 4: Create the cell helpers, the link and the column table**

`src/sheets/cells.ts`:

```ts
/**
 * How one stored value is printed in a Sheet cell (and in the CSV export).
 * Kept apart from `matrix.ts` so the column tables can use them without an import cycle.
 */

/** Booleans as Da/Nu; anything else (null: "not asked") as an empty cell. */
export const yesNo = (v: unknown): string => (v === true ? 'Da' : v === false ? 'Nu' : '');

export const cellStr = (v: unknown): string => (v == null ? '' : String(v));

/** A json string array, comma-joined. */
export const listStr = (v: unknown): string => (Array.isArray(v) ? v.map((x) => cellStr(x)).join(', ') : cellStr(v));

/** A custom answer: booleans as Da/Nu, arrays comma-joined. */
export function extraCell(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Da' : 'Nu';
  if (Array.isArray(v)) return listStr(v);
  return cellStr(v);
}
```

`src/sheets/admin-link.ts`:

```ts
/**
 * Links from the Google Sheet back into the admin.
 *
 * The Înscrieri page (src/admin/dashboard/menu.tsx `INSCRIERI_TO`, under the `/admin` basename) reads
 * `?q=` into its search box and `?season=` into its season filter when it loads
 * (src/admin/dashboard/SubmissionTable.tsx `initialQuery`). The search matches the registration number,
 * so the list holds that one registration and the compact view opens it.
 */

export const INSCRIERI_ADMIN_PATH = '/admin/plugins/edusport-inscrieri';

/** The CMS public origin, e.g. `https://cms.example.com`; empty when not configured. */
export function cmsPublicUrl(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.CMS_PUBLIC_URL ?? '').trim().replace(/\/+$/, '');
}

/** Link to the admin Înscrieri page with this registration open, or '' without an origin or a number. */
export function registrationAdminUrl(origin: string, registrationNumber: unknown): string {
  const nr = typeof registrationNumber === 'string' ? registrationNumber.trim() : '';
  if (!origin || !nr) return '';
  const query = new URLSearchParams({ q: nr, season: 'all' });
  return `${origin}${INSCRIERI_ADMIN_PATH}?${query.toString()}`;
}
```

`src/sheets/script-form.ts`:

```ts
/**
 * The columns of an Înscrieri season tab filled by the new registration form.
 *
 * DECISIONS 2026-10-05 (decisions-1-5, point 1): each season tab has only its own season's columns, so a
 * tab whose rows came from the new form gets these columns, and an older tab keeps the old ones
 * (`INSCRIERI_COLS` in matrix.ts). Titles and order are the approved screen's (mockups/screens/
 * decisions-1-5.html, option A); the columns it does not show get short titles in the same style
 * (Școală, Altă calitate, Altă sursă). "Membru A.C.S." is kept (point 2). Order: Nr. înscriere, the
 * system columns (Trimis la, Stare), Școală, the script form's questions in its order, the two
 * consents, custom questions, Notă internă, Document (a link to the registration), ID.
 */
import { cellStr } from './cells';
import { cmsPublicUrl, registrationAdminUrl } from './admin-link';
import type { BuiltinCol, RowLike } from './matrix';

const RELATIONSHIP_CELLS: Record<string, string> = { parinte: 'Părinte', tutore: 'Tutore Legal', alta: 'Alta' };
const MEMBERSHIP_CELLS: Record<string, string> = { da: 'Da', nu: 'Nu' };

/**
 * The rule that picks a tab's columns: a row came from the new form when it stores a membership answer.
 * The new form always sends one; older rows keep null (plan 2A, Task 1: no default on the new fields).
 */
export function isScriptFormRow(row: RowLike): boolean {
  return row?.membershipAnswer === 'da' || row?.membershipAnswer === 'nu';
}

/** A stored code printed with its label; an unknown value is printed as stored. */
const labelled = (labels: Record<string, string>, v: unknown): string => labels[cellStr(v)] ?? cellStr(v);

/** One field of a populated relation or a json object, as text. */
function fieldOf(v: unknown, key: string): string {
  return v && typeof v === 'object' ? cellStr((v as Record<string, unknown>)[key]) : '';
}

export const SCRIPT_FORM_LEAD: BuiltinCol[] = [{ key: 'registrationNumber', label: 'Nr. înscriere' }];

export const SCRIPT_FORM_COLS: BuiltinCol[] = [
  { key: 'section', label: 'Școală', cell: (r) => fieldOf(r.section, 'name') },
  { key: 'email', label: 'Adresă de e-mail', type: 'email' },
  { key: 'parentName', label: 'Persoana care completează' },
  { key: 'relationship', label: 'Calitatea față de sportiv', cell: (r) => labelled(RELATIONSHIP_CELLS, r.relationship) },
  { key: 'relationshipOther', label: 'Altă calitate' },
  { key: 'phone', label: 'Telefon de contact', type: 'tel' },
  { key: 'childName', label: 'Numele copilului' },
  { key: 'childBirthDate', label: 'Data nașterii', type: 'date' },
  { key: 'childHeight', label: 'Înălțimea (cm)' },
  { key: 'shirtSize', label: 'Măsura bluză' },
  { key: 'lastSeason', label: 'Sezonul trecut' },
  { key: 'priorExperience', label: 'Nivel de experiență', type: 'longtext' },
  { key: 'expectations', label: 'Așteptări', type: 'longtext' },
  {
    key: 'membershipAnswer',
    label: 'Membru A.C.S.',
    type: 'bool',
    cell: (r) => labelled(MEMBERSHIP_CELLS, r.membershipAnswer),
  },
  { key: 'subscriptionChoice', label: 'La primul modul', cell: (r) => fieldOf(r.subscriptionChoice, 'priceItemName') },
  { key: 'source', label: 'De unde ați aflat' },
  { key: 'sourceOther', label: 'Altă sursă' },
  { key: 'gdprConsent', label: 'Acord GDPR', type: 'bool' },
  { key: 'regulationsConsent', label: 'Acord Regulament', type: 'bool' },
];

/** After the custom questions: the admin's note, then the link to the registration in the admin. */
export const SCRIPT_FORM_TAIL: BuiltinCol[] = [
  { key: 'internalNote', label: 'Notă internă', type: 'longtext' },
  {
    key: 'document',
    label: 'Document',
    type: 'link',
    cell: (r) => registrationAdminUrl(cmsPublicUrl(), r.registrationNumber),
  },
];
```

- [ ] **Step 5: Replace `src/sheets/matrix.ts`**

Replace the whole file with:

```ts
/**
 * The single source of truth for every form's export columns.
 *
 * Both the CSV export (`exportCsv` in each submission controller) and the
 * Google Sheets sync (`src/sheets/registry.ts`) build their columns here, so
 * the two can never drift apart again — the bug that motivated this module was
 * exactly that drift: the CSV had a dynamic header while the Sheets writer used
 * a stale 17-column static one.
 *
 * Every form's column set is: `Trimis la`, `Stare`, the built-in columns
 * (removed-from-form ones suffixed " (eliminata)"), the custom questions from
 * the form config (removed-but-with-data ones likewise suffixed), and finally
 * `ID` — the documentId, which is the sync key. The ID column is ALWAYS last.
 *
 * Înscrieri has two column sets, picked per season tab (`inscrieriTabPlans`):
 * today's, and the new registration form's (`script-form.ts`), which adds
 * `Nr. înscriere` before `Trimis la` and `Document` before `ID`.
 */

import type { FormType } from '../api/form-config/registry';
import { cellStr, extraCell, listStr, yesNo } from './cells';
import { isScriptFormRow, SCRIPT_FORM_COLS, SCRIPT_FORM_LEAD, SCRIPT_FORM_TAIL } from './script-form';

const FORM_CONFIG_UID = 'api::form-config.form-config' as const;

export interface RowLike {
  documentId?: string | null;
  status?: string | null;
  submittedAt?: string | null;
  extra?: Record<string, unknown> | null;
  [k: string]: unknown;
}

/**
 * What a column HOLDS, as opposed to what it is called.
 *
 * This is the second half of the "one source of truth" this module exists for:
 * the CSV export needs the labels, the Sheets sync needs the labels AND the
 * types — which columns are real dates (so they can be written as date values
 * rather than text), which one is the status (so it can be colour-coded), and
 * how wide each should be. Deriving both from the same plan is what keeps a
 * newly added custom question correctly typed in the sheet without touching
 * `sync.ts`.
 *
 *   datetime  an instant (submittedAt) — shown dd.mm.yyyy hh:mm, Europe/Bucharest
 *   date      a calendar date (a birth date) — shown dd.mm.yyyy, never shifted
 *   status    the workflow state; the colour-coded column
 *   email/tel contact details, only ever used to size the column
 *   text      a short free-text answer
 *   longtext  a paragraph (motivation, message, internal note)
 *   bool      rendered Da/Nu
 *   list      a json string array, rendered comma-joined
 *   link      an address, shown as "Deschide documentul" linking to it
 *   id        the documentId — always the last column, the sync key
 */
export type ColumnType =
  | 'datetime'
  | 'date'
  | 'status'
  | 'email'
  | 'tel'
  | 'text'
  | 'longtext'
  | 'bool'
  | 'list'
  | 'link'
  | 'id';

/** A resolved column set: the header, its types, plus how to render one document. */
export interface ColumnPlan {
  header: string[];
  /** One entry per header column, same order. */
  types: ColumnType[];
  row(doc: RowLike): string[];
}

export interface Matrix {
  header: string[];
  matrix: string[][];
}

/**
 * Column plans of a partitioned form, one per tab (Înscrieri: one tab per season).
 * `forTab` answers for any tab name; a tab with no rows in the database gets the default plan.
 */
export interface TabPlans {
  forTab(tab: string): ColumnPlan;
}

/** One plan for every tab (forms whose columns do not depend on the tab). */
export function singlePlan(plan: ColumnPlan): TabPlans {
  return { forTab: () => plan };
}

export { cellStr, listStr, yesNo } from './cells';

/** A fixed column: a row field, its header label, and how it is printed. */
export interface BuiltinCol {
  key: string;
  label: string;
  /** Drives BOTH how the cell renders and how the sheet formats it. */
  type?: ColumnType;
  /** A renderer for values that are not printed as stored (codes, relations, json). */
  cell?: (r: RowLike) => string;
}

/** Where the fixed columns go around the system columns and the custom questions. */
interface Layout {
  /** Before `Trimis la`. */
  lead: BuiltinCol[];
  /** After `Stare`; a built-in removed from the form config gets " (eliminata)". */
  builtins: BuiltinCol[];
  /** After the custom questions, before `ID`. */
  tail: BuiltinCol[];
}

interface FormMeta {
  removedBuiltins: string[];
  customs: { key: string; label: string; type?: string }[];
}

/** The header of the last column, which holds the documentId (the sync key). */
export const ID_LABEL = 'ID';

/**
 * A custom question's editor type -> the column type. The editor's list lives
 * in `src/api/form-config/registry.ts` (CUSTOM_QUESTION_TYPES); anything it
 * grows that is not mapped here falls back to a plain short text column.
 */
const CUSTOM_TYPES: Record<string, ColumnType> = {
  text: 'text',
  longtext: 'longtext',
  email: 'email',
  tel: 'tel',
  date: 'date',
  select: 'text',
  checkbox: 'bool',
};

async function loadMeta(type: string): Promise<FormMeta> {
  try {
    const meta = await strapi.service(FORM_CONFIG_UID).adminFormMeta(type as FormType);
    return {
      removedBuiltins: meta?.removedBuiltins ?? [],
      customs: meta?.customs ?? [],
    };
  } catch {
    // No config context: fall back to "nothing removed, no custom questions".
    return { removedBuiltins: [], customs: [] };
  }
}

const extraOf = (r: RowLike): Record<string, unknown> =>
  r?.extra && typeof r.extra === 'object' ? (r.extra as Record<string, unknown>) : {};

/** Render one fixed column for one row. */
function builtinCell(c: BuiltinCol, r: RowLike): string {
  if (c.cell) return c.cell(r);
  if (c.type === 'bool') return yesNo(r?.[c.key]);
  if (c.type === 'list') return listStr(r?.[c.key]);
  return cellStr(r?.[c.key]);
}

/**
 * The custom-question columns: every question in the form config, then the
 * answer keys found in `rows` that no longer have a question, as "(eliminata)".
 * A question whose type the config no longer reports is treated as text: a
 * wrong WIDTH is harmless, a wrong date parse would not be.
 */
function customColumns(meta: FormMeta, rows: RowLike[]): BuiltinCol[] {
  const byKey = new Map(meta.customs.map((c) => [c.key, c]));
  const answered = new Set(rows.flatMap((r) => Object.keys(extraOf(r))));
  const retired = [...answered].filter((k) => !byKey.has(k)).sort();
  const answer = (key: string) => (r: RowLike) => extraCell(extraOf(r)[key]);
  return [
    ...meta.customs.map((c) => {
      const q = byKey.get(c.key)!;
      return { key: q.key, label: q.label, type: CUSTOM_TYPES[String(q.type ?? '')] ?? 'text', cell: answer(q.key) };
    }),
    ...retired.map((k) => ({ key: k, label: `${k} (eliminata)`, type: 'text' as ColumnType, cell: answer(k) })),
  ];
}

/** `Trimis la` and `Stare`, the same on every form. */
function systemColumns(type: string): BuiltinCol[] {
  return [
    { key: 'submittedAt', label: 'Trimis la', type: 'datetime' },
    { key: 'status', label: 'Stare', type: 'status', cell: (r) => cellStr(statusOf(type, r)) },
  ];
}

/**
 * Build a column plan from an already loaded form config.
 *
 * `rows` is used only to discover custom answer keys that no longer exist in
 * the form config but still carry data; those become trailing "(eliminata)"
 * columns. Pass every row you are about to write so no answer is silently lost.
 */
function planFromMeta(type: string, layout: Layout, rows: RowLike[], meta: FormMeta): ColumnPlan {
  const removed = new Set(meta.removedBuiltins);
  const columns: BuiltinCol[] = [
    ...layout.lead,
    ...systemColumns(type),
    ...layout.builtins.map((c) => (removed.has(c.key) ? { ...c, label: `${c.label} (eliminata)` } : c)),
    ...customColumns(meta, rows),
    ...layout.tail,
    { key: 'documentId', label: ID_LABEL, type: 'id' },
  ];
  return {
    header: columns.map((c) => c.label),
    types: columns.map((c) => c.type ?? 'text'),
    row: (r) => columns.map((c) => builtinCell(c, r)),
  };
}

/** Build the column plan for one single-tab form (see `planFromMeta`). */
async function buildPlan(type: string, builtins: BuiltinCol[], rows: RowLike[]): Promise<ColumnPlan> {
  return planFromMeta(type, { lead: [], builtins, tail: [] }, rows, await loadMeta(type));
}

/** Contact submissions keep their state in `triageStatus`, not `status`. */
function statusOf(type: string, r: RowLike): unknown {
  return type === 'contact' ? (r?.triageStatus ?? r?.status) : r?.status;
}

const toMatrix = (plan: ColumnPlan, rows: RowLike[]): Matrix => ({
  header: plan.header,
  matrix: rows.map(plan.row),
});

/** Rows grouped by the tab they belong in, in their original order. */
function groupByTab(rows: RowLike[], tabFor: (doc: RowLike) => string): Map<string, RowLike[]> {
  const groups = new Map<string, RowLike[]>();
  for (const r of rows) {
    const tab = tabFor(r);
    const list = groups.get(tab);
    if (list) list.push(r);
    else groups.set(tab, [r]);
  }
  return groups;
}

/* ------------------------------------------------------------- Înscrieri */

// Built-in export columns, in the historic HEADER order (between the two meta
// columns and the trailing ID). `bool` fields render Da/Nu.
//
// NOTE `childBirthDate` is a plain string column in the schema (it predates the
// date type) but it always holds a calendar date, so it is typed `date` here —
// which is exactly what makes it sortable in the sheet instead of alphabetical.
export const INSCRIERI_COLS: BuiltinCol[] = [
  { key: 'childName', label: 'Nume copil' },
  { key: 'childBirthDate', label: 'Data nasterii', type: 'date' },
  { key: 'parentName', label: 'Nume parinte' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Telefon', type: 'tel' },
  { key: 'level', label: 'Nivel' },
  { key: 'shirtSize', label: 'Marime tricou' },
  { key: 'howHeard', label: 'Cum a aflat' },
  { key: 'clubInterest', label: 'Interes club', type: 'bool' },
  { key: 'regulationsAgreement', label: 'Acord regulament', type: 'bool' },
  { key: 'privacyConsent', label: 'Acord confidentialitate', type: 'bool' },
  { key: 'priorExperience', label: 'Experienta anterioara', type: 'longtext' },
  { key: 'expectations', label: 'Asteptari', type: 'longtext' },
  { key: 'internalNote', label: 'Nota interna', type: 'longtext' },
];

export const inscrieriPlan = (rows: RowLike[]) => buildPlan('inscriere', INSCRIERI_COLS, rows);

const INSCRIERI_LAYOUT: Layout = { lead: [], builtins: INSCRIERI_COLS, tail: [] };
const SCRIPT_FORM_LAYOUT: Layout = { lead: SCRIPT_FORM_LEAD, builtins: SCRIPT_FORM_COLS, tail: SCRIPT_FORM_TAIL };

/**
 * Înscrieri columns per season tab. A tab holding at least one row from the new
 * form (`isScriptFormRow`) gets the script-form columns, planned over its own
 * rows. Every other tab keeps today's columns, planned over the rows of those
 * tabs only, so a new season never changes an old tab. No season list.
 */
export async function inscrieriTabPlans(rows: RowLike[], tabFor: (doc: RowLike) => string): Promise<TabPlans> {
  const meta = await loadMeta('inscriere');
  const groups = [...groupByTab(rows, tabFor)];
  const scriptTabs = groups.filter(([, list]) => list.some(isScriptFormRow));
  const legacyRows = groups.filter(([, list]) => !list.some(isScriptFormRow)).flatMap(([, list]) => list);
  const legacy = planFromMeta('inscriere', INSCRIERI_LAYOUT, legacyRows, meta);
  const byTab = new Map(scriptTabs.map(([tab, list]) => [tab, planFromMeta('inscriere', SCRIPT_FORM_LAYOUT, list, meta)]));
  return { forTab: (tab) => byTab.get(tab) ?? legacy };
}

/* -------------------------------------------------------------- Voluntari */

// Romanian headers matching the admin column labels. `bool` renders Da/Nu,
// `list` joins the json string-array (helpAreas).
export const VOLUNTARI_COLS: BuiltinCol[] = [
  { key: 'fullName', label: 'Nume' },
  { key: 'birthDate', label: 'Data nasterii', type: 'date' },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'phone', label: 'Telefon', type: 'tel' },
  { key: 'city', label: 'Oras' },
  { key: 'occupation', label: 'Ocupatie' },
  { key: 'helpAreas', label: 'Cum ajuta', type: 'list' },
  { key: 'availability', label: 'Disponibilitate' },
  { key: 'frequency', label: 'Frecventa' },
  { key: 'skatingExperience', label: 'Experienta patinaj' },
  { key: 'childrenExperience', label: 'Experienta cu copiii', type: 'longtext' },
  { key: 'motivation', label: 'Motivatie', type: 'longtext' },
  { key: 'howHeard', label: 'Cum a aflat' },
  { key: 'parentName', label: 'Nume parinte' },
  { key: 'parentPhone', label: 'Telefon parinte', type: 'tel' },
  { key: 'parentalConsent', label: 'Acord parinti', type: 'bool' },
  { key: 'privacyConsent', label: 'Acord confidentialitate', type: 'bool' },
  { key: 'internalNote', label: 'Nota interna', type: 'longtext' },
];

export const voluntariPlan = (rows: RowLike[]) => buildPlan('voluntariat', VOLUNTARI_COLS, rows);

/* -------------------------------------------------------------- Parteneri */

export const PARTENERI_COLS: BuiltinCol[] = [
  { key: 'companyName', label: 'Companie' },
  { key: 'contactName', label: 'Persoana de contact' },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'phone', label: 'Telefon', type: 'tel' },
  { key: 'collaborationType', label: 'Tip colaborare' },
  { key: 'message', label: 'Mesaj', type: 'longtext' },
  { key: 'privacyConsent', label: 'Acord confidentialitate', type: 'bool' },
  { key: 'internalNote', label: 'Nota interna', type: 'longtext' },
];

export const parteneriPlan = (rows: RowLike[]) => buildPlan('parteneri', PARTENERI_COLS, rows);

/* ---------------------------------------------------------------- Contact */

export const CONTACT_COLS: BuiltinCol[] = [
  { key: 'name', label: 'Nume' },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'phone', label: 'Telefon', type: 'tel' },
  { key: 'reason', label: 'Motiv' },
  { key: 'message', label: 'Mesaj', type: 'longtext' },
  { key: 'internalNote', label: 'Nota interna', type: 'longtext' },
];

export const contactPlan = (rows: RowLike[]) => buildPlan('contact', CONTACT_COLS, rows);

/* --------------------------------------------- matrix helpers (CSV export) */

/** Înscrieri: dynamic header + matrix, as used by the CSV export. */
export async function buildInscrieriMatrix(rows: RowLike[]): Promise<Matrix> {
  return toMatrix(await inscrieriPlan(rows), rows);
}

/** Voluntari: dynamic header + matrix, as used by the CSV export. */
export async function buildVoluntariMatrix(rows: RowLike[]): Promise<Matrix> {
  return toMatrix(await voluntariPlan(rows), rows);
}
```

In `src/sheets/format.ts` (`WIDTH` must list every `ColumnType`), replace

```ts
  list: 200,
  id: 190,
};
```

with

```ts
  list: 200,
  id: 190,
  link: 160,
};
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npm test -- src/sheets` then `npm test` and `npx tsc --noEmit`.
Expected: all PASS (the characterization of Step 1 included), zero type errors.

- [ ] **Step 7: Commit**

```bash
git add src/sheets/cells.ts src/sheets/admin-link.ts src/sheets/script-form.ts src/sheets/matrix.ts src/sheets/format.ts \
  src/sheets/__tests__/fakes.test.helper.ts src/sheets/__tests__/matrix-legacy.test.ts src/sheets/__tests__/admin-link.test.ts \
  src/sheets/__tests__/script-form-plan.test.ts
git commit -m "feat(sheets): new registration form columns, planned per season tab"
```

---

### Task 3: Registry: per-tab plans, relations, fetch by id

**Files:**
- Modify: `src/sheets/registry.ts` (whole file replaced)
- Test: `src/sheets/__tests__/registry-tabs.test.ts`

**Interfaces:**
- Consumes: Task 2 (`TabPlans`, `singlePlan`, `inscrieriTabPlans`), `installStrapi` from `src/sheets/__tests__/fakes.test.helper.ts`.
- Produces (on `FormDescriptor` / `Descriptor`, used by Task 4):
  - `fetchByIds(ids: string[]): Promise<RowLike[]>`: the queued documents, with the same relations as `fetchAll` (`[]` for no ids, without a query).
  - `resolveTabPlans(rows?: RowLike[]): Promise<TabPlans>`: cached 15 s like `resolvePlan`, cleared by `invalidate()`; a form without `tabPlans` gets `singlePlan(plan)`.
  - `fetchAll()` and `fetchByIds()` populate `section` (`{ fields: ['name'] }`) for Înscrieri, for the Școală column.
  - `uid` is typed `UID.ContentType`, which removes the `as any` on the UID passed to `strapi.documents(...)` (the existing cast on `sort` stays: Strapi's types reject `submittedAt` for a union of UIDs).

- [ ] **Step 1: Write the failing test**

`src/sheets/__tests__/registry-tabs.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { getForm } from '../registry';
import { installStrapi } from './fakes.test.helper';

const newRow = { documentId: 'new-1', season: '2026-2027', membershipAnswer: 'da', registrationNumber: '2026-0001' };
const oldRow = { documentId: 'old-1', season: '2025-2026', childName: 'Ana' };

describe('form descriptors and per-tab plans', () => {
  beforeEach(() => {
    getForm('inscrieri').invalidate();
    getForm('voluntari').invalidate();
  });

  it('reads registrations with the name of their school, oldest first', async () => {
    const { findMany } = installStrapi([oldRow, newRow]);
    await getForm('inscrieri').fetchAll();
    expect(findMany).toHaveBeenCalledWith({
      sort: { submittedAt: 'asc' },
      limit: 5000,
      populate: { section: { fields: ['name'] } },
    });
  });

  it('reads queued registrations by id with the same relations, and nothing for no ids', async () => {
    const { findMany } = installStrapi([oldRow, newRow]);
    const rows = await getForm('inscrieri').fetchByIds(['new-1']);
    expect(rows.map((r) => r.documentId)).toEqual(['new-1']);
    expect(findMany).toHaveBeenCalledWith({
      filters: { documentId: { $in: ['new-1'] } },
      limit: 1,
      populate: { section: { fields: ['name'] } },
    });
    findMany.mockClear();
    expect(await getForm('inscrieri').fetchByIds([])).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('plans each Înscrieri tab from its own rows', async () => {
    installStrapi([oldRow, newRow]);
    const plans = await getForm('inscrieri').resolveTabPlans();
    expect(plans.forTab('2026-2027').header[0]).toBe('Nr. înscriere');
    expect(plans.forTab('2025-2026').header[0]).toBe('Trimis la');
  });

  it('reuses the tab plans for a short while, until invalidated', async () => {
    const { findMany } = installStrapi([oldRow, newRow]);
    await getForm('inscrieri').resolveTabPlans();
    await getForm('inscrieri').resolveTabPlans();
    expect(findMany).toHaveBeenCalledTimes(1);
    getForm('inscrieri').invalidate();
    await getForm('inscrieri').resolveTabPlans();
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('gives the single-tab forms one plan for every tab, read without relations', async () => {
    const { findMany } = installStrapi([]);
    const plans = await getForm('voluntari').resolveTabPlans();
    expect(plans.forTab('a').header).toEqual(plans.forTab('b').header);
    expect(findMany).toHaveBeenCalledWith({ sort: { submittedAt: 'asc' }, limit: 5000 });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- src/sheets/__tests__/registry-tabs.test.ts`
Expected: FAIL (`fetchByIds is not a function`, `resolveTabPlans is not a function`, and `fetchAll` called without `populate`).

- [ ] **Step 3: Replace `src/sheets/registry.ts`**

Replace the whole file with:

```ts
/**
 * One descriptor per synced form.
 *
 * Every descriptor knows how to fetch its rows, build its header, and render a
 * single document. The LAST column of every row is the `documentId` — that is
 * the sync key `sync.ts` looks rows up by.
 *
 * Column logic is NOT duplicated here: it comes from `matrix.ts`, which the CSV
 * exports use too, so the Sheet and the CSV can never disagree about columns.
 *
 * Plan caching: `buildHeader()` resolves the current column plan (form config +
 * every custom answer key present in the data) and caches it briefly; `toRow()`
 * renders against that cached plan. Always `await buildHeader()` (directly or
 * via `sync.ensureHeader`) before calling `toRow()` — `sync.ts` does.
 *
 * A partitioned form can pick its columns per tab (`tabPlans`); `sync.ts` asks
 * for those with `resolveTabPlans()`. Without `tabPlans`, every tab gets the
 * form's one plan.
 */
import type { UID } from '@strapi/strapi';
import { sanitizeTabName } from './client';
import type { ColumnPlan, RowLike, TabPlans } from './matrix';
import { contactPlan, inscrieriPlan, inscrieriTabPlans, parteneriPlan, voluntariPlan, singlePlan } from './matrix';

export type FormKey = 'inscrieri' | 'voluntari' | 'parteneri' | 'contact';

export const FORM_KEYS: FormKey[] = ['inscrieri', 'voluntari', 'parteneri', 'contact'];

export function isFormKey(v: unknown): v is FormKey {
  return typeof v === 'string' && (FORM_KEYS as string[]).includes(v);
}

/**
 * How a form decides WHICH tab a row belongs in.
 *
 * A form without a `partition` is single-tab: every row goes to `link.tab`,
 * exactly as before. A form WITH a partition is multi-tab: the tab name is
 * derived from a field on the row itself, and `link.tab` is ignored entirely
 * (see the `tab` comment in sheet-link/schema.json).
 */
export interface Partition {
  /** The row field the tab name is derived from. */
  field: string;
  /** Tab used by rows whose `field` is empty or null. */
  fallbackTab: string;
  /** Resolve one row's tab name, already sanitised for the Sheets API. */
  tabFor(doc: RowLike): string;
}

export interface FormDescriptor {
  key: FormKey;
  uid: string;
  label: string;
  /** Present only on multi-tab forms. */
  readonly partition?: Partition;
  /** Every row in the database, oldest first (the order they are written in). */
  fetchAll(): Promise<RowLike[]>;
  /** These documents, with the same relations as `fetchAll`. */
  fetchByIds(ids: string[]): Promise<RowLike[]>;
  /** Resolve + cache the column plan of every tab (partitioned forms). */
  resolveTabPlans(rows?: RowLike[]): Promise<TabPlans>;
  /** Resolve + cache the current column plan, returning its header. */
  buildHeader(): Promise<string[]>;
  /** Render one document against the cached plan. */
  toRow(doc: RowLike): string[];
  /** Index of the documentId column — always the last one. */
  readonly idIndex: number;
}

/** How long a resolved column plan is reused before it is rebuilt. */
const PLAN_TTL_MS = 15_000;

/** Hard cap on rows read from the database in one pass (matches the CSV export). */
export const ROW_LIMIT = 5000;

/**
 * Tab used by Înscrieri rows carrying no season. Chosen over a Romanian-
 * diacritic name so the tab title survives every A1 range, URL and CSV export
 * path untouched.
 */
export const INSCRIERI_FALLBACK_TAB = 'fara-sezon';

/** Build a "tab name comes from this field" rule. */
function byField(field: string, fallbackTab: string): Partition {
  return {
    field,
    fallbackTab,
    tabFor: (doc) => sanitizeTabName(doc?.[field], fallbackTab),
  };
}

interface Spec {
  key: FormKey;
  uid: UID.ContentType;
  label: string;
  plan: (rows: RowLike[]) => Promise<ColumnPlan>;
  partition?: Partition;
  /** Columns chosen per tab, from the rows that tab holds (partitioned forms only). */
  tabPlans?: (rows: RowLike[], tabFor: (doc: RowLike) => string) => Promise<TabPlans>;
  /** Relations a row needs for its cells. */
  populate?: Record<string, { fields: string[] }>;
}

const SPECS: Spec[] = [
  {
    key: 'inscrieri',
    uid: 'api::registration-submission.registration-submission',
    label: 'Înscrieri',
    plan: inscrieriPlan,
    // One tab per season: "2025-2026", "2024-2025", … and `fara-sezon` for the
    // rows that have none. Every other form stays single-tab.
    partition: byField('season', INSCRIERI_FALLBACK_TAB),
    // A season tab filled by the new registration form gets its own columns.
    tabPlans: inscrieriTabPlans,
    // The "Școală" column prints the section's name.
    populate: { section: { fields: ['name'] } },
  },
  {
    key: 'voluntari',
    uid: 'api::volunteer-submission.volunteer-submission',
    label: 'Voluntari',
    plan: voluntariPlan,
  },
  {
    key: 'parteneri',
    uid: 'api::partner-submission.partner-submission',
    label: 'Parteneri',
    plan: parteneriPlan,
  },
  {
    key: 'contact',
    uid: 'api::contact-submission.contact-submission',
    label: 'Contact',
    plan: contactPlan,
  },
];

class Descriptor implements FormDescriptor {
  private cached: { plan: ColumnPlan; at: number } | null = null;
  private cachedTabs: { plans: TabPlans; at: number } | null = null;

  constructor(private readonly spec: Spec) {}

  get key(): FormKey {
    return this.spec.key;
  }

  get uid(): UID.ContentType {
    return this.spec.uid;
  }

  get label(): string {
    return this.spec.label;
  }

  get partition(): Partition | undefined {
    return this.spec.partition;
  }

  get idIndex(): number {
    // The ID column is always last; -1 until a plan has been resolved.
    return this.cached ? this.cached.plan.header.length - 1 : -1;
  }

  async fetchAll(): Promise<RowLike[]> {
    const docs = await strapi.documents(this.spec.uid).findMany({
      sort: { submittedAt: 'asc' } as any,
      limit: ROW_LIMIT,
      ...this.populateArg(),
    });
    return (docs ?? []) as unknown as RowLike[];
  }

  async fetchByIds(ids: string[]): Promise<RowLike[]> {
    if (!ids.length) return [];
    const docs = await strapi.documents(this.spec.uid).findMany({
      filters: { documentId: { $in: ids } },
      limit: ids.length,
      ...this.populateArg(),
    });
    return (docs ?? []) as unknown as RowLike[];
  }

  private populateArg(): { populate?: Record<string, { fields: string[] }> } {
    return this.spec.populate ? { populate: this.spec.populate } : {};
  }

  async count(): Promise<number> {
    try {
      return await strapi.documents(this.spec.uid).count({});
    } catch {
      return 0;
    }
  }

  /** Resolve the column plan over every row currently in the database. */
  async resolvePlan(rows?: RowLike[]): Promise<ColumnPlan> {
    if (!rows && this.cached && Date.now() - this.cached.at < PLAN_TTL_MS) return this.cached.plan;
    const source = rows ?? (await this.fetchAll());
    const plan = await this.spec.plan(source);
    this.cached = { plan, at: Date.now() };
    return plan;
  }

  /** Resolve the column plan of every tab, over every row currently in the database. */
  async resolveTabPlans(rows?: RowLike[]): Promise<TabPlans> {
    const fresh = this.cachedTabs && Date.now() - this.cachedTabs.at < PLAN_TTL_MS;
    if (!rows && fresh) return this.cachedTabs.plans;
    const source = rows ?? (await this.fetchAll());
    const { tabPlans, partition } = this.spec;
    const plans = tabPlans && partition ? await tabPlans(source, partition.tabFor) : singlePlan(await this.spec.plan(source));
    this.cachedTabs = { plans, at: Date.now() };
    return plans;
  }

  async buildHeader(): Promise<string[]> {
    return (await this.resolvePlan()).header;
  }

  toRow(doc: RowLike): string[] {
    if (!this.cached) {
      throw new Error(`[sheets] toRow(${this.spec.key}) called before buildHeader()`);
    }
    return this.cached.plan.row(doc);
  }

  invalidate(): void {
    this.cached = null;
    this.cachedTabs = null;
  }
}

const REGISTRY: Record<FormKey, Descriptor> = SPECS.reduce(
  (acc, spec) => {
    acc[spec.key] = new Descriptor(spec);
    return acc;
  },
  {} as Record<FormKey, Descriptor>,
);

export function getForm(key: FormKey): Descriptor {
  return REGISTRY[key];
}

export function allForms(): Descriptor[] {
  return FORM_KEYS.map((k) => REGISTRY[k]);
}

export type { Descriptor };
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test -- src/sheets` then `npm test` and `npx tsc --noEmit`.
Expected: all PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add src/sheets/registry.ts src/sheets/__tests__/registry-tabs.test.ts
git commit -m "feat(sheets): registry resolves column plans per tab and reads the school name"
```

---

### Task 4: Sync engine per tab, Document links, status colours

**Files:**
- Modify: `src/sheets/sync.ts` (whole file replaced)
- Modify: `src/sheets/format.ts` (header comment and imports; link cells in `toCells` / `toDisplay`; `LINK_TEXT`, `LinkRequest`, `linkRequests`; `statusRuleIndices` replaced by `ownRuleIndices`)
- Modify: `src/sheets/client.ts` (`LinkCell`, `isLinkCell`, `cellApi`; `firstRowOf`; `appendValues` returns `startRow`; dry-run links and `_dryLinks`)
- Test: `src/sheets/__tests__/format-links.test.ts`, `src/sheets/__tests__/sync-tabs.test.ts`

**Interfaces:**
- Consumes: Task 2 (`ColumnPlan`, `TabPlans`, `ID_LABEL`, the `link` column type), Task 3 (`Descriptor.resolveTabPlans`, `fetchByIds`, `invalidate`), `installStrapi` / `Doc` from the test helper. `store.ts`, `queue.ts` and `lifecycle.ts` unchanged.
- Produces: the same exported API as today, with the same signatures: `SyncResult`, `ensureHeader`, `upsertRow`, `deleteRow`, `resyncForm`, `reconcile`, `applyBatch`. Behaviour per tab:
  - every row is rendered with `planOf(ctx, tab)`, the plan of the tab it is written to; every header check compares a tab with its own plan;
  - a write (`applyBatch`, `upsertRow`) on a partitioned form plans over the rows as they are now (`freshPlans`), so the first new-form row of a season switches its tab in the same flush (through the existing "header changed, rewrite everything" path);
  - a tab's ID column is read at the end of its own plan first (one read, as today) and otherwise found from its header row (`'tab'!1:1`), so a tab laid out for other columns is still ours;
  - reconcile: a tab whose header is not its plan's triggers the full rewrite, except a tab with no rows left in the database, which keeps its columns and is only searched for rows to remove; a resync removes, from such tabs, the copies of rows it just wrote elsewhere (the source half of a move);
  - `format.ts`: status-colour rules are recognised by content (TEXT_EQ on one of the form's status values), so the rules follow `Stare` when it moves and never stack.
  - Document links (user decision E5): `format.ts` exports `LINK_TEXT = 'Deschide documentul'`, `type LinkRequest`, `linkRequests(sheetId: number, startRow: number, rows: Cell[][]): LinkRequest[]`; a `link` value becomes a `LinkCell` in `toCells` and shows `LINK_TEXT` in `toDisplay` (nothing when the address is empty). `client.ts` exports `interface LinkCell { kind: 'link'; text; url }` (part of `Cell`), `isLinkCell(c)`, `firstRowOf(range): number | null`; `appendValues` now resolves to `{ appended, startRow }` (1-based first row, from the API's `updatedRange`); dry run: `_dryLinks(spreadsheetId, tab): Record<string, string>` (A1 cell -> address), links cleared by a values write or a clear, and moved with their rows on delete.
  - `sync.ts`: every write of rows with link cells (resync, update in place, append) queues `linkRequests` for the rows' real positions; `sendLinks` sends them in one `spreadsheets.batchUpdate` per operation, after the inserts and before any delete. Never fatal (logged). Reconcile compares the shown text, so an address that changes later (a new `CMS_PUBLIC_URL`) is applied by a full rewrite.

- [ ] **Step 1: Write the failing tests**

`src/sheets/__tests__/format-links.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { firstRowOf } from '../client';
import { LINK_TEXT, linkRequests, toCells, toDisplay } from '../format';

const URL = 'https://cms.example.ro/admin/plugins/edusport-inscrieri?q=2026-0142&season=all';

describe('link cells', () => {
  it('write the text and keep the address for the link', () => {
    expect(LINK_TEXT).toBe('Deschide documentul');
    expect(toCells(['text', 'link'], ['a', URL])).toEqual(['a', { kind: 'link', text: 'Deschide documentul', url: URL }]);
    expect(toDisplay(['text', 'link'], ['a', URL])).toEqual(['a', 'Deschide documentul']);
  });

  it('stay empty without an address', () => {
    expect(toCells(['link'], [''])).toEqual(['']);
    expect(toDisplay(['link'], [''])).toEqual(['']);
  });

  it('become one rich-text link request per link cell, at its sheet position', () => {
    const rows = toCells(['text', 'link'], ['a', URL]);
    expect(linkRequests(7, 4, [rows, ['b', '']])).toEqual([
      {
        updateCells: {
          range: { sheetId: 7, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 1, endColumnIndex: 2 },
          rows: [
            {
              values: [
                {
                  userEnteredValue: { stringValue: 'Deschide documentul' },
                  textFormatRuns: [{ startIndex: 0, format: { link: { uri: URL } } }],
                },
              ],
            },
          ],
          fields: 'userEnteredValue,textFormatRuns',
        },
      },
    ]);
  });

  it('find where appended rows landed from the API range', () => {
    expect(firstRowOf("'2026-2027'!A5:Y6")).toBe(5);
    expect(firstRowOf('Date!$A$12:$C$12')).toBe(12);
    expect(firstRowOf(undefined)).toBeNull();
  });
});
```

`src/sheets/__tests__/sync-tabs.test.ts`:

```ts
/**
 * The Înscrieri sync against the in-memory spreadsheet of SHEETS_DRY_RUN:
 * per-tab columns through resync, reconcile, queued batches, moves and deletes.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { _dryLinks, _dryResetAll, getSpreadsheet, getValues } from '../client';
import { inscrieriPlan } from '../matrix';
import { getForm } from '../registry';
import { applyBatch, deleteRow, reconcile, resyncForm } from '../sync';
import { flush, queueUpsert } from '../queue';
import { installStrapi } from './fakes.test.helper';
import type { Doc } from './fakes.test.helper';

const logSync = vi.hoisted(() => vi.fn());
vi.mock('../store', () => ({
  getLink: async (form: string) => ({
    form,
    spreadsheetId: 'sheet-1',
    spreadsheetName: 'Test',
    tab: 'Date',
    enabled: true,
    intervalHours: 4,
    lastSyncAt: null,
    lastSyncOk: null,
    lastSyncMessage: null,
    lastReconcileAt: null,
  }),
  logSync,
}));

const ENV = { GOOGLE_SA_EMAIL: 'robot@example.iam', GOOGLE_SA_PRIVATE_KEY: 'key', SHEETS_DRY_RUN: '1', CMS_PUBLIC_URL: 'https://cms.example.ro' };
const saved: Record<string, string | undefined> = {};

const oldRow = (id: string, season: string | null, childName: string): Doc => ({
  documentId: id,
  season,
  submittedAt: '2025-09-14T15:02:00.000Z',
  status: 'Confirmat',
  childName,
  childBirthDate: '2016-05-05',
  parentName: 'Elena Bălan',
  email: 'parinte3@exemplu.ro',
  phone: '0722000000',
  level: 'Incepatori',
  shirtSize: 'S',
  howHeard: 'Prieteni',
  clubInterest: true,
  regulationsAgreement: true,
  privacyConsent: true,
  extra: {},
});

const newRow = (id: string, nr: string, childName: string): Doc => ({
  documentId: id,
  season: '2026-2027',
  registrationNumber: nr,
  submittedAt: '2026-10-03T11:22:00.000Z',
  status: 'Nou',
  section: { name: 'AFI Cotroceni' },
  email: 'parinte@exemplu.ro',
  parentName: 'Mihaela Dumitrescu',
  relationship: 'parinte',
  phone: '0722111222',
  childName,
  childBirthDate: '14.03.2014',
  childHeight: 142,
  shirtSize: 'S',
  lastSeason: 'Începători',
  priorExperience: 'Nimic',
  expectations: 'Piruete',
  membershipAnswer: 'da',
  subscriptionChoice: { priceItemName: 'Abonament 8', price: 300, member: true },
  source: 'Recomandare',
  gdprConsent: true,
  regulationsConsent: true,
  extra: {},
});

/** A tab as the sheet shows it, each row without its empty trailing cells. */
const tab = async (name: string) => {
  const grid = (await getValues('sheet-1', `'${name}'!A1:AZ`)).data ?? [];
  return grid.map((row) => {
    const cells = [...row];
    while (cells.length && cells[cells.length - 1] === '') cells.pop();
    return cells;
  });
};
const column = (grid: string[][], label: string) => grid.slice(1).map((r) => r[grid[0].indexOf(label)]);
const link = (nr: string) => `https://cms.example.ro/admin/plugins/edusport-inscrieri?q=${nr}&season=all`;
/** The dry-run links of a tab, as row -> address, read from its Document column. */
const links = async (name: string) => {
  const grid = await tab(name);
  const col = String.fromCharCode(65 + grid[0].indexOf('Document'));
  const all = _dryLinks('sheet-1', name);
  return Object.fromEntries(Object.entries(all).filter(([at]) => at.startsWith(col)).map(([at, uri]) => [Number(at.slice(1)), uri]));
};

let docs: Doc[];
const store = () => installStrapi(docs);

beforeAll(() => {
  for (const [k, v] of Object.entries(ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
});
afterAll(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});
beforeEach(() => {
  _dryResetAll();
  logSync.mockClear();
  getForm('inscrieri').invalidate();
  docs = [oldRow('old-1', '2025-2026', 'Ana Bălan'), oldRow('old-2', null, 'Fără Sezon'), newRow('new-1', '2026-0142', 'Maria Dumitrescu')];
  store();
});

describe('Înscrieri tabs with their own columns', () => {
  it('writes the old seasons with today\'s columns and 2026-2027 with the new form\'s', async () => {
    const res = await resyncForm('inscrieri', 'manual');
    expect(res.ok).toBe(true);
    const today = await inscrieriPlan(docs.slice(0, 2));
    expect((await tab('2025-2026'))[0]).toEqual(today.header);
    expect((await tab('fara-sezon'))[0]).toEqual(today.header);
    const season = await tab('2026-2027');
    expect(season[0].slice(0, 4)).toEqual(['Nr. înscriere', 'Trimis la', 'Stare', 'Școală']);
    expect(season[0].slice(-3)).toEqual(['Notă internă', 'Document', 'ID']);
    expect(season[1].slice(0, 4)).toEqual(['2026-0142', '03.10.2026 14:22', 'Nou', 'AFI Cotroceni']);
    expect(column(season, 'Membru A.C.S.')).toEqual(['Da']);
    expect(column(season, 'Document')).toEqual(['Deschide documentul']);
    expect(await links('2026-2027')).toEqual({ 2: link('2026-0142') });
    expect(_dryLinks('sheet-1', '2025-2026')).toEqual({});
  });

  it('finds nothing to change on the next reconcile (idempotent)', async () => {
    await resyncForm('inscrieri', 'manual');
    const res = await reconcile('inscrieri', 'manual');
    expect(res).toMatchObject({ ok: true, added: 0, updated: 0, removed: 0 });
    expect(logSync).toHaveBeenLastCalledWith('inscrieri', 'manual', { added: 0, updated: 0, removed: 0 }, true, 'Verificare: +0 ~0 -0');
  });

  it('a queued edit updates the row in place with its tab\'s columns', async () => {
    await resyncForm('inscrieri', 'manual');
    docs[2] = { ...docs[2], status: 'Contactat' };
    store();
    const res = await applyBatch('inscrieri', ['new-1'], []);
    expect(res).toMatchObject({ ok: true, added: 0, updated: 1, removed: 0 });
    expect((await tab('2026-2027'))[1][2]).toBe('Contactat');
    expect((await tab('2026-2027')).length).toBe(2);
    expect(await links('2026-2027')).toEqual({ 2: link('2026-0142') });
  });

  it('switches a season tab to the new columns when its first new-form row arrives', async () => {
    docs = [oldRow('old-1', '2025-2026', 'Ana Bălan'), oldRow('old-3', '2026-2027', 'Vechi Formular')];
    store();
    await resyncForm('inscrieri', 'manual');
    expect((await tab('2026-2027'))[0][0]).toBe('Trimis la');
    const before2025 = await tab('2025-2026');

    docs.push(newRow('new-1', '2026-0142', 'Maria Dumitrescu'));
    store();
    queueUpsert('inscrieri', 'new-1');
    await flush('inscrieri');

    const season = await tab('2026-2027');
    expect(season[0][0]).toBe('Nr. înscriere');
    expect(column(season, 'ID')).toEqual(['old-3', 'new-1']);
    expect(column(season, 'Numele copilului')).toEqual(['Vechi Formular', 'Maria Dumitrescu']);
    expect(await links('2026-2027')).toEqual({ 3: link('2026-0142') });
    expect(await tab('2025-2026')).toEqual(before2025);
    expect((await reconcile('inscrieri', 'manual')).updated).toBe(0);
  });

  it('moves the status colours with the Stare column, without stacking rules', async () => {
    docs = [oldRow('old-3', '2026-2027', 'Vechi Formular')];
    store();
    await resyncForm('inscrieri', 'manual');
    docs.push(newRow('new-1', '2026-0142', 'Maria Dumitrescu'));
    store();
    await applyBatch('inscrieri', ['new-1'], []);
    await reconcile('inscrieri', 'manual');
    const info = await getSpreadsheet('sheet-1');
    const rules = info.data!.tabs.find((t) => t.title === '2026-2027')!.conditionalFormats;
    expect(rules).toHaveLength(4);
    expect(rules.every((r) => r.ranges[0].startColumnIndex === 2)).toBe(true);
  });

  it('moves a row between seasons with no copy left behind; an old-form row takes the new columns of its new tab', async () => {
    await resyncForm('inscrieri', 'manual');
    docs[0] = { ...docs[0], season: '2026-2027' };
    store();
    const res = await applyBatch('inscrieri', ['old-1'], []);
    expect(res.ok).toBe(true);
    const season = await tab('2026-2027');
    expect(column(season, 'ID')).toEqual(['new-1', 'old-1']);
    expect(column(season, 'Numele copilului')).toEqual(['Maria Dumitrescu', 'Ana Bălan']);
    expect(column(season, 'Document')).toEqual(['Deschide documentul', '']);
    expect(await links('2026-2027')).toEqual({ 2: link('2026-0142') });
    expect(await tab('2025-2026')).toHaveLength(1);
  });

  it('switches an old season tab too when a new-form row is moved into it (the rule has no season list)', async () => {
    await resyncForm('inscrieri', 'manual');
    docs[2] = { ...docs[2], season: '2025-2026' };
    store();
    const res = await applyBatch('inscrieri', ['new-1'], []);
    expect(res.ok).toBe(true);
    const old = await tab('2025-2026');
    expect(old[0][0]).toBe('Nr. înscriere');
    expect(column(old, 'ID')).toEqual(['old-1', 'new-1']);
    expect(await tab('2026-2027')).toHaveLength(1);
  });

  it('settles after the last new-form row leaves a season: no rewrite on every reconcile', async () => {
    await resyncForm('inscrieri', 'manual');
    docs[2] = { ...docs[2], season: '2025-2026' };
    store();
    await applyBatch('inscrieri', ['new-1'], []);
    await reconcile('inscrieri', 'manual');
    logSync.mockClear();
    expect(await reconcile('inscrieri', 'manual')).toMatchObject({ ok: true, added: 0, updated: 0, removed: 0 });
    expect(logSync.mock.calls.map((c) => c[4])).not.toContain('Antet diferit: rescriere completă');
  });

  it('keeps each link on its row when a row above it is removed', async () => {
    docs.push(newRow('new-2', '2026-0143', 'Ioana Popescu'));
    store();
    await resyncForm('inscrieri', 'manual');
    expect(await links('2026-2027')).toEqual({ 2: link('2026-0142'), 3: link('2026-0143') });
    await deleteRow('inscrieri', 'new-1');
    expect(await links('2026-2027')).toEqual({ 2: link('2026-0143') });
  });

  it('shows no link and no text without CMS_PUBLIC_URL', async () => {
    delete process.env.CMS_PUBLIC_URL;
    try {
      await resyncForm('inscrieri', 'manual');
      expect(column(await tab('2026-2027'), 'Document')).toEqual(['']);
      expect(_dryLinks('sheet-1', '2026-2027')).toEqual({});
    } finally {
      process.env.CMS_PUBLIC_URL = ENV.CMS_PUBLIC_URL;
    }
  });

  it('removes a deleted registration from a tab with the new columns', async () => {
    await resyncForm('inscrieri', 'manual');
    const res = await deleteRow('inscrieri', 'new-1');
    expect(res).toMatchObject({ ok: true, removed: 1 });
    expect(await tab('2026-2027')).toHaveLength(1);
  });

  it('repairs a lost write and a row left in the wrong tab on reconcile', async () => {
    await resyncForm('inscrieri', 'manual');
    docs.push(newRow('new-2', '2026-0143', 'Ioana Popescu'));
    docs[0] = { ...docs[0], season: '2026-2027' };
    store();
    const res = await reconcile('inscrieri', 'manual');
    expect(res).toMatchObject({ ok: true });
    const season = await tab('2026-2027');
    expect(column(season, 'ID').sort()).toEqual(['new-1', 'new-2', 'old-1']);
    const linked = Object.values(await links('2026-2027')).sort();
    expect(linked).toEqual([link('2026-0142'), link('2026-0143')]);
    expect(column(await tab('2025-2026'), 'ID')).toEqual([]);
    expect((await reconcile('inscrieri', 'manual'))).toMatchObject({ added: 0, updated: 0, removed: 0 });
  });

  it('leaves a tab that is not ours alone', async () => {
    await resyncForm('inscrieri', 'manual');
    const { updateValues } = await import('../client');
    await updateValues('sheet-1', "'Note'!A1", [['Notițele mele', 'nu atinge']]);
    await reconcile('inscrieri', 'manual');
    expect(await tab('Note')).toEqual([['Notițele mele', 'nu atinge']]);
  });
});

describe('single-tab forms keep working as before', () => {
  it('writes Voluntari to its one tab, then finds nothing to change, then updates in place', async () => {
    getForm('voluntari').invalidate();
    docs = [{ documentId: 'v-1', fullName: 'Ion Pop', submittedAt: '2026-01-01T10:00:00.000Z', status: 'Nou' }];
    store();
    expect((await resyncForm('voluntari', 'manual')).ok).toBe(true);
    expect((await tab('Date'))[0].slice(0, 3)).toEqual(['Trimis la', 'Stare', 'Nume']);
    expect(await reconcile('voluntari', 'manual')).toMatchObject({ ok: true, added: 0, updated: 0, removed: 0 });
    docs[0] = { ...docs[0], status: 'Acceptat' };
    store();
    expect(await applyBatch('voluntari', ['v-1'], [])).toMatchObject({ ok: true, added: 0, updated: 1 });
    expect((await tab('Date'))[1][1]).toBe('Acceptat');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- src/sheets/__tests__/format-links.test.ts src/sheets/__tests__/sync-tabs.test.ts`
Expected: FAIL. Observed on the code before this task: 3 of 4 in `format-links` (no `LINK_TEXT`, no `linkRequests`, no `firstRowOf`) and 9 of 15 in `sync-tabs`, among them "writes the old seasons with today's columns and 2026-2027 with the new form's" (the 2026-2027 tab gets today's columns) and "moves the status colours with the Stare column, without stacking rules" (8 rules instead of 4).

- [ ] **Step 3: Link cells and status-colour rules in `src/sheets/format.ts`**

Apply these replacements in `src/sheets/format.ts` (after Task 2's `link: 160` line):

Replace

```ts
 * the sheet and this module emits the matching `deleteConditionalFormatRule`s
 * first. Re-running a sync therefore leaves the rule count unchanged.
 */
import type { Cell } from './client';
import type { ColumnType } from './matrix';
import type { FormKey } from './registry';
```

with

```ts
 * the sheet and this module emits the matching `deleteConditionalFormatRule`s
 * first. Re-running a sync therefore leaves the rule count unchanged.
 *
 * Our rules are found by WHAT they are (a TEXT_EQ on one of the form's status
 * values), not by the column they sit on: when a tab changes column set (an
 * Înscrieri season tab switching to the new form's columns), `Stare` moves, and
 * the rules left on its old column are removed instead of lingering there.
 */
import { cellText, isLinkCell } from './client';
import type { Cell, LinkCell } from './client';
import type { ColumnType } from './matrix';
import type { FormKey } from './registry';
```

Replace

```ts
  t === 'date' ? 'date' : t === 'datetime' ? 'datetime' : null;

/**
 * A rendered row -> the cells the API is given. Date columns become tagged
 * date cells (serial + the text they will display); everything else stays the
 * exact string `matrix.ts` produced, because the write is still RAW.
 */
export function toCells(types: ColumnType[], row: string[]): Cell[] {
  return row.map((value, i) => {
    const kind = dateKind(types[i]);
    if (!kind) return value;
    const parsed = parseDateCell(value, kind);
    return parsed ? { kind: 'date' as const, serial: parsed.serial, text: parsed.text } : value;
  });
}

/**
 * The same row as the SHEET WILL SHOW IT. `values.get` returns formatted
 * values, so this is what a reconcile compares against — not the raw ISO
 * string, which the sheet no longer contains.
 */
export function toDisplay(types: ColumnType[], row: string[]): string[] {
  return row.map((value, i) => {
    const kind = dateKind(types[i]);
    if (!kind) return value;
    const parsed = parseDateCell(value, kind);
    return parsed ? parsed.text : value;
  });
}

```

with

```ts
  t === 'date' ? 'date' : t === 'datetime' ? 'datetime' : null;

/** The text a link cell shows (the Înscrieri "Document" column); its address is the rich-text link. */
export const LINK_TEXT = 'Deschide documentul';

/** One rendered value -> the cell the API is given. */
function toCell(type: ColumnType, value: string): Cell {
  if (type === 'link') return value ? { kind: 'link', text: LINK_TEXT, url: value } : '';
  const kind = dateKind(type);
  if (!kind) return value;
  const parsed = parseDateCell(value, kind);
  return parsed ? { kind: 'date', serial: parsed.serial, text: parsed.text } : value;
}

/**
 * A rendered row -> the cells the API is given. Date columns become tagged
 * date cells (serial + the text they will display), a link column a link cell
 * (its text, its address); everything else stays the exact string `matrix.ts`
 * produced, because the write is still RAW.
 */
export function toCells(types: ColumnType[], row: string[]): Cell[] {
  return row.map((value, i) => toCell(types[i], value));
}

/**
 * The same row as the SHEET WILL SHOW IT. `values.get` returns formatted
 * values, so this is what a reconcile compares against — not the raw ISO
 * string, nor a link's address, neither of which the sheet shows.
 */
export function toDisplay(types: ColumnType[], row: string[]): string[] {
  return toCells(types, row).map(cellText);
}

/* ------------------------------------------------------------- link cells */

/** A cell's text with one rich-text run linking all of it. */
type LinkValue = {
  userEnteredValue: { stringValue: string };
  textFormatRuns: { startIndex: number; format: { link: { uri: string } } }[];
};

/** One `spreadsheets.batchUpdate` request that turns a cell's text into a link. */
export type LinkRequest = {
  updateCells: {
    range: {
      sheetId: number;
      startRowIndex: number;
      endRowIndex: number;
      startColumnIndex: number;
      endColumnIndex: number;
    };
    rows: { values: LinkValue[] }[];
    fields: string;
  };
};

function linkRequest(sheetId: number, row: number, col: number, cell: LinkCell): LinkRequest {
  const value: LinkValue = {
    userEnteredValue: { stringValue: cell.text },
    textFormatRuns: [{ startIndex: 0, format: { link: { uri: cell.url } } }],
  };
  return {
    updateCells: {
      range: { sheetId, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: col, endColumnIndex: col + 1 },
      rows: [{ values: [value] }],
      fields: 'userEnteredValue,textFormatRuns',
    },
  };
}

/**
 * The rich-text link requests for the link cells of `rows`, written from the
 * 0-based sheet row `startRow`. A values write leaves plain text, so these go
 * out after every write of such rows.
 */
export function linkRequests(sheetId: number, startRow: number, rows: Cell[][]): LinkRequest[] {
  const out: LinkRequest[] = [];
  rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (isLinkCell(cell)) out.push(linkRequest(sheetId, startRow + r, c, cell));
    }),
  );
  return out;
}

```

Replace

```ts
  String(rule?.booleanRule?.condition?.values?.[0]?.userEnteredValue ?? '');

/** Indices (ascending) of the rules currently sitting on the status column. */
function statusRuleIndices(state: TabState | undefined, statusIndex: number): number[] {
  if (!state || statusIndex < 0) return [];
  const out: number[] = [];
  state.conditionalFormats.forEach((rule, i) => {
    if (ruleColumn(rule) === statusIndex) out.push(i);
  });
  return out;
```

with

```ts
  String(rule?.booleanRule?.condition?.values?.[0]?.userEnteredValue ?? '');

/** The condition type of a rule as read back from `spreadsheets.get` (e.g. 'TEXT_EQ'). */
const ruleKind = (rule: { booleanRule?: { condition?: { type?: string } } }): string =>
  String(rule?.booleanRule?.condition?.type ?? '');

/** Indices (ascending) of the status-colour rules this module adds for `form`, on any column. */
function ownRuleIndices(state: TabState | undefined, form: FormKey): number[] {
  if (!state) return [];
  const values = new Set(STATUS_STYLES[form].map((s) => s.value));
  const out: number[] = [];
  state.conditionalFormats.forEach((rule, i) => {
    if (ruleKind(rule) === 'TEXT_EQ' && values.has(ruleValue(rule))) out.push(i);
  });
  return out;
```

Replace

```ts
  if (state.frozenRowCount !== 1) return false;
  const want = statusIndex < 0 ? [] : STATUS_STYLES[form].map((s) => s.value);
  const have = statusRuleIndices(state, statusIndex).map((i) => ruleValue(state.conditionalFormats[i]));
  return have.length === want.length && want.every((v, i) => have[i] === v);
}
```

with

```ts
  if (state.frozenRowCount !== 1) return false;
  const want = statusIndex < 0 ? [] : STATUS_STYLES[form].map((s) => s.value);
  const own = ownRuleIndices(state, form).map((i) => state.conditionalFormats[i]);
  if (!own.every((rule) => ruleColumn(rule) === statusIndex)) return false;
  const have = own.map(ruleValue);
  return have.length === want.length && want.every((v, i) => have[i] === v);
}
```

Replace

```ts
    // shift the index of a later one. This is the whole idempotency story:
    // without it every sync would stack another copy of all four rules.
    const existing = statusRuleIndices(state, statusIndex);
    for (const index of [...existing].sort((a, b) => b - a)) {
      requests.push({ deleteConditionalFormatRule: { sheetId, index } });
```

with

```ts
    // shift the index of a later one. This is the whole idempotency story:
    // without it every sync would stack another copy of all four rules.
    const existing = ownRuleIndices(state, form);
    for (const index of [...existing].sort((a, b) => b - a)) {
      requests.push({ deleteConditionalFormatRule: { sheetId, index } });
```

- [ ] **Step 4: Link cells, append position and dry-run links in `src/sheets/client.ts`**

Apply these replacements in `src/sheets/client.ts`:

Replace

```ts
}

/** One cell heading for the API: plain text, or a real date. */
export type Cell = string | DateCell;

/** What the sheet will show for a cell — the diffable form. */
export const cellText = (c: Cell): string => (typeof c === 'string' ? c : c.text);

/** What the API is given for a cell. */
export const cellApi = (c: Cell): string | number => (typeof c === 'string' ? c : c.serial);

/** Values as the API wants them: serial numbers for dates, strings otherwise. */
```

with

```ts
}

/**
 * A cell whose text links somewhere. The values API can only write `text`
 * (writes are RAW, so a HYPERLINK formula would stay text); the address is
 * attached afterwards as a rich-text link through `spreadsheets.batchUpdate`
 * (`format.ts` `linkRequests`). A read returns `text`, the diffable form.
 */
export interface LinkCell {
  readonly kind: 'link';
  readonly text: string;
  readonly url: string;
}

/** One cell heading for the API: plain text, a real date, or a link. */
export type Cell = string | DateCell | LinkCell;

export const isLinkCell = (c: Cell): c is LinkCell => typeof c !== 'string' && c.kind === 'link';

/** What the sheet will show for a cell — the diffable form. */
export const cellText = (c: Cell): string => (typeof c === 'string' ? c : c.text);

/** What the API is given for a cell. */
export const cellApi = (c: Cell): string | number => {
  if (typeof c === 'string') return c;
  return c.kind === 'date' ? c.serial : c.text;
};

/** Values as the API wants them: serial numbers for dates, strings otherwise. */
```

Replace

```ts
const dryRules = new Map<string, any[]>();
const dryFrozen = new Set<string>();

const dryKey = (id: string, tab: string) => `${id}::${tab}`;
```

with

```ts
const dryRules = new Map<string, any[]>();
const dryFrozen = new Set<string>();
/** Dry-run rich-text links per tab: `${row}:${col}` (0-based) -> address. */
const dryLinkStore = new Map<string, Map<string, string>>();

const dryKey = (id: string, tab: string) => `${id}::${tab}`;
```

Replace

```ts
  dryRules.clear();
  dryFrozen.clear();
}

interface ParsedRange {
```

with

```ts
  dryRules.clear();
  dryFrozen.clear();
  dryLinkStore.clear();
}

/** Dry-run links of one tab, keyed by A1 cell (e.g. `X2`). For tests and the dry-run log. */
export function _dryLinks(spreadsheetId: string, tab: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [at, uri] of dryLinkStore.get(dryKey(spreadsheetId, tab)) ?? []) {
    const [row, col] = at.split(':').map(Number);
    out[`${colLetter(col)}${row + 1}`] = uri;
  }
  return out;
}

const dryLinksOf = (id: string, tab: string): Map<string, string> => {
  const key = dryKey(id, tab);
  if (!dryLinkStore.has(key)) dryLinkStore.set(key, new Map());
  return dryLinkStore.get(key)!;
};

interface ParsedRange {
```

Replace

```ts
  const { tab, startCol, startRow } = parseRange(range);
  const grid = dryGrid(spreadsheetId, tab);
  values.forEach((row, r) => {
    const target = startRow + r;
```

with

```ts
  const { tab, startCol, startRow } = parseRange(range);
  const grid = dryGrid(spreadsheetId, tab);
  // Writing a value through the values API leaves plain text: a link on that
  // cell is gone until it is set again.
  const links = dryLinksOf(spreadsheetId, tab);
  values.forEach((row, r) => {
    const target = startRow + r;
```

Replace

```ts
    row.forEach((cell, c) => {
      line[startCol + c] = cell;
    });
  });
}

function dryAppend(spreadsheetId: string, range: string, values: string[][]): number {
  const { tab } = parseRange(range);
  const grid = dryGrid(spreadsheetId, tab);
  for (const row of values) grid.push([...row]);
  return grid.length;
}

```

with

```ts
    row.forEach((cell, c) => {
      line[startCol + c] = cell;
      links.delete(`${target}:${startCol + c}`);
    });
  });
}

/** Append rows; returns the 1-based sheet row of the first one. */
function dryAppend(spreadsheetId: string, range: string, values: string[][]): number {
  const { tab } = parseRange(range);
  const grid = dryGrid(spreadsheetId, tab);
  const first = grid.length + 1;
  for (const row of values) grid.push([...row]);
  return first;
}

```

Replace

```ts
  const grid = dryGrid(spreadsheetId, tab);
  for (const r of [...rows].sort((a, b) => b - a)) grid.splice(r, 1);
}

function dryClear(spreadsheetId: string, tab: string): void {
  dryStore.set(dryKey(spreadsheetId, tab), []);
}

```

with

```ts
  const grid = dryGrid(spreadsheetId, tab);
  for (const r of [...rows].sort((a, b) => b - a)) grid.splice(r, 1);
  // Links move with their rows, like any cell format.
  const links = dryLinksOf(spreadsheetId, tab);
  const moved = [...links].flatMap(([at, uri]) => {
    const [row, col] = at.split(':').map(Number);
    if (rows.includes(row)) return [];
    return [[`${row - rows.filter((d) => d < row).length}:${col}`, uri] as [string, string]];
  });
  dryLinkStore.set(dryKey(spreadsheetId, tab), new Map(moved));
}

function dryClear(spreadsheetId: string, tab: string): void {
  dryStore.set(dryKey(spreadsheetId, tab), []);
  dryLinkStore.delete(dryKey(spreadsheetId, tab));
}

/** The tab a dry-run sheetId belongs to (sheetIds are given in creation order). */
function dryTabOf(spreadsheetId: string, sheetId: number): string | null {
  const keys = [...dryStore.keys()].filter((k) => k.startsWith(`${spreadsheetId}::`));
  return keys[sheetId]?.split('::')[1] ?? null;
}

type DryLinkRequest = {
  updateCells?: {
    range?: { sheetId?: number; startRowIndex?: number; startColumnIndex?: number };
    rows?: { values?: { textFormatRuns?: { format?: { link?: { uri?: string } } }[] }[] }[];
  };
};

/** Record the rich-text links an `updateCells` request sets. */
function dryApplyLink(spreadsheetId: string, request: DryLinkRequest): void {
  const range = request.updateCells?.range;
  const uri = request.updateCells?.rows?.[0]?.values?.[0]?.textFormatRuns?.[0]?.format?.link?.uri;
  const tab = range ? dryTabOf(spreadsheetId, range.sheetId ?? -1) : null;
  if (!range || !uri || tab === null) return;
  dryLinksOf(spreadsheetId, tab).set(`${range.startRowIndex}:${range.startColumnIndex}`, uri);
}

```

Replace

```ts

/** Append rows to the end of the tab. */
export async function appendValues(
  spreadsheetId: string,
  range: string,
  values: Cell[][],
): Promise<OpResult<{ appended: number }>> {
  if (!isConfigured()) return fail('not_configured');
  if (values.length === 0) return done({ appended: 0 });
  if (isDryRun()) {
    const shown = dryValues(values);
    const total = dryAppend(spreadsheetId, range, shown);
    dryLog('values.append', { spreadsheetId, range, ...rowsDetail(shown), sheetRows: total });
    return done({ appended: values.length });
  }
  const c = await clients();
  if (!c) return fail('client_unavailable', 'Nu am putut autentifica contul de serviciu.');
  try {
    await c.sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
```

with

```ts

/** Append rows to the end of the tab. */
/** The 1-based first row of an A1 range such as `'2026-2027'!A5:X6`, or null. */
export function firstRowOf(range: unknown): number | null {
  const m = /!\$?[A-Z]*\$?(\d+)/i.exec(String(range ?? ''));
  return m ? Number(m[1]) : null;
}

/**
 * Append rows to the end of the tab. `startRow` is the 1-based sheet row the
 * first one landed on (from the API's `updatedRange`), or null if unknown.
 */
export async function appendValues(
  spreadsheetId: string,
  range: string,
  values: Cell[][],
): Promise<OpResult<{ appended: number; startRow: number | null }>> {
  if (!isConfigured()) return fail('not_configured');
  if (values.length === 0) return done({ appended: 0, startRow: null });
  if (isDryRun()) {
    const startRow = dryAppend(spreadsheetId, range, dryValues(values));
    dryLog('values.append', { spreadsheetId, range, ...rowsDetail(dryValues(values)), startRow });
    return done({ appended: values.length, startRow });
  }
  const c = await clients();
  if (!c) return fail('client_unavailable', 'Nu am putut autentifica contul de serviciu.');
  try {
    const res = await c.sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
```

Replace

```ts
      requestBody: { values: apiValues(values) },
    });
    return done({ appended: values.length });
  } catch (err) {
    const { reason, message } = classify(err, 'append_failed');
```

with

```ts
      requestBody: { values: apiValues(values) },
    });
    return done({ appended: values.length, startRow: firstRowOf(res?.data?.updates?.updatedRange) });
  } catch (err) {
    const { reason, message } = classify(err, 'append_failed');
```

Replace

```ts
  if (requests.length === 0) return done(true as const);
  if (isDryRun()) {
    const key = dryKey(spreadsheetId, tab);
    const rules = [...(dryRules.get(key) ?? [])];
```

with

```ts
  if (requests.length === 0) return done(true as const);
  if (isDryRun()) {
    for (const r of requests) if (r.updateCells) dryApplyLink(spreadsheetId, r);
    const key = dryKey(spreadsheetId, tab);
    const rules = [...(dryRules.get(key) ?? [])];
```

- [ ] **Step 5: Replace `src/sheets/sync.ts`**

Replace the whole file with:

```ts
/**
 * The sync engine: how a form's database rows become (and stay) a spreadsheet.
 *
 * The app owns the tabs. Row 1 of every tab is the header; every data row's
 * LAST cell is the documentId, which is how a row is located for an update or a
 * delete. Nothing here ever throws — every entry point returns a result
 * carrying a specific `reason` so the admin can tell "no credentials" from "the
 * append was rejected" from "the service account has no access to that file".
 *
 * TWO LAYOUTS
 * -----------
 * A form is either SINGLE-TAB or PARTITIONED, decided by `partition` on its
 * registry descriptor (`registry.ts`):
 *
 *   single-tab  (voluntari, parteneri, contact)
 *       Every row lives in `link.tab`. Unchanged behaviour.
 *
 *   partitioned (inscrieri)
 *       The tab name is derived from the row itself — the season, e.g.
 *       "2025-2026" — with `fara-sezon` for rows carrying no season. Tabs are
 *       created on demand; `link.tab` is ignored for such a form.
 *
 * Both layouts share one per-operation tab cache (`ctx.tabs`), filled by the
 * single `spreadsheets.get` that `context()` already had to make, so writing a
 * hundred rows across five seasons still costs zero extra metadata reads.
 *
 * MOVING A ROW BETWEEN TABS
 * -------------------------
 * When a submission's season changes, its row must move. The insert into the
 * new tab always happens BEFORE the delete from the old one. A crash between
 * the two therefore leaves a duplicate, which the next `reconcile` removes —
 * strictly better than the opposite order, where the same crash loses the row.
 *
 * COLUMNS PER TAB
 * ---------------
 * A partitioned form's tabs need not share columns: `ctx.plans.forTab(tab)`
 * gives each tab its own plan (Înscrieri: a season tab filled by the new
 * registration form has the script-form columns, older tabs keep theirs; see
 * `matrix.ts` `inscrieriTabPlans`). Every row is rendered with the plan of the
 * tab it is written to, and every header check compares a tab with its own
 * plan. A tab's ID column is looked for at the end of its own plan first (one
 * read in the steady state), then found from its header row, so a tab still
 * laid out for other columns is recognised as ours: rewritten, and its rows
 * moved or removed, never mistaken for a stranger's.
 *
 * LINK CELLS
 * ----------
 * A `link` column (Înscrieri "Document") is written as its text through the
 * values API, then turned into a rich-text link by an `updateCells` request.
 * Every write of such rows queues those requests (`queueLinks`); one
 * `spreadsheets.batchUpdate` per operation sends them all (`sendLinks`), after
 * the inserts and before any delete, while the row numbers still hold. A
 * reconcile compares the shown text only, so a changed address (a new
 * `CMS_PUBLIC_URL`) is applied by a full rewrite ("Sincronizează acum").
 */
import {
  appendValues,
  batchUpdateSheet,
  batchUpdateValues,
  clearValues,
  colLetter,
  createTab,
  deleteRows,
  getSpreadsheet,
  getValues,
  isConfigured,
  quoteTab,
  updateValues,
} from './client';
import type { Cell, TabInfo } from './client';
import { formatIsCurrent, formatRequests, linkRequests, toCells, toDisplay } from './format';
import type { LinkRequest, TabState } from './format';
import { ID_LABEL } from './matrix';
import type { ColumnPlan, ColumnType, RowLike, TabPlans } from './matrix';
import type { FormKey, Partition } from './registry';
import { getForm } from './registry';
import type { SheetLink, SyncCounts, SyncTrigger } from './store';
import { getLink, logSync } from './store';

export interface SyncResult extends SyncCounts {
  ok: boolean;
  /** Present when nothing happened or something failed. */
  reason?: string;
  message?: string;
  skipped?: boolean;
  /**
   * Partitioned forms only: tabs that still exist but no longer match any row
   * in the database. They are left in place (an archived season is worth
   * keeping) and only reported.
   */
  staleTabs?: string[];
}

const EMPTY: SyncCounts = { added: 0, updated: 0, removed: 0 };

const skip = (reason: string): SyncResult => ({ ...EMPTY, ok: true, skipped: true, reason });
const failed = (reason: string, message?: string): SyncResult => ({ ...EMPTY, ok: false, reason, message });

/* ------------------------------------------------------------------ context */

interface BaseCtx {
  form: FormKey;
  link: SheetLink;
  spreadsheetId: string;
  /** tab title -> numeric sheetId, for every tab in the spreadsheet. */
  tabs: Map<string, number>;
  /**
   * Formatting state of each tab as it was when this operation started, read
   * from the one `spreadsheets.get` above. Absent for a tab we just created.
   */
  tabState: Map<string, TabState>;
  /** Tabs this operation created; their header is known to be current. */
  fresh: Set<string>;
  /** Tabs this operation has already formatted; never format one twice. */
  formatted: Set<string>;
  /** Link requests for rows written by this operation, not sent yet. */
  links: LinkRequest[];
}

/** Single-tab form: one fixed target tab and one column plan, resolved up front. */
interface SingleCtx extends BaseCtx {
  kind: 'single';
  tab: string;
  sheetId: number;
  plan: ColumnPlan;
}

/** Partitioned form: the tab is decided per row, lazily, and so are its columns. */
interface MultiCtx extends BaseCtx {
  kind: 'multi';
  partition: Partition;
  plans: TabPlans;
}

type Ctx = SingleCtx | MultiCtx;

// An explicit discriminant, not a `partition !== null` test: this project
// compiles with `strict: false`, where `null` is assignable to everything and
// a nullability-based type guard therefore narrows to `never`.
const isMulti = (ctx: Ctx): ctx is MultiCtx => ctx.kind === 'multi';

/** The columns of `tab`: the form's one plan, or the tab's own on a partitioned form. */
const planOf = (ctx: Ctx, tab: string): ColumnPlan => (isMulti(ctx) ? ctx.plans.forTab(tab) : ctx.plan);

/** A1 letter of a plan's last (ID) column. */
const lastColOf = (plan: ColumnPlan): string => colLetter(plan.header.length - 1);

/**
 * Resolve everything an operation needs: the link, the spreadsheet's tab list,
 * and the current column plan(s). For a single-tab form the target tab is
 * created here if missing; a partitioned form creates tabs lazily, per row.
 * Returns a result instead of a context when the form is not syncable now.
 */
async function context(form: FormKey): Promise<Ctx | SyncResult> {
  if (!isConfigured()) return skip('not_configured');
  const link = await getLink(form);
  if (!link.spreadsheetId) return skip('not_connected');
  if (!link.enabled) return skip('disabled');

  const info = await getSpreadsheet(link.spreadsheetId);
  if (!info.ok) return failed(info.reason ?? 'read_failed', info.message);

  const base = baseContext(form, link, info.data!.tabs);
  const desc = getForm(form);
  const partition = desc.partition;
  if (partition) return { ...base, kind: 'multi', partition, plans: await desc.resolveTabPlans() };
  return singleContext(base, await desc.resolvePlan());
}

function baseContext(form: FormKey, link: SheetLink, tabs: TabInfo[]): BaseCtx {
  return {
    form,
    link,
    spreadsheetId: link.spreadsheetId,
    tabs: new Map(tabs.map((t) => [t.title, t.sheetId])),
    tabState: new Map(
      tabs.map((t) => [
        t.title,
        { sheetId: t.sheetId, frozenRowCount: t.frozenRowCount, conditionalFormats: t.conditionalFormats },
      ]),
    ),
    fresh: new Set<string>(),
    formatted: new Set<string>(),
    links: [],
  };
}

/** A single-tab form's target tab is created here, before any row is written. */
async function singleContext(base: BaseCtx, plan: ColumnPlan): Promise<SingleCtx | SyncResult> {
  const single: SingleCtx = { ...base, kind: 'single', tab: base.link.tab, sheetId: -1, plan };
  const sheetId = await ensureTabIn(single, single.tab);
  if (typeof sheetId !== 'number') return sheetId;
  single.sheetId = sheetId;
  return single;
}

/**
 * A partitioned form picks each tab's columns from the rows in it, so a write
 * plans over the rows as they are now, not over a snapshot up to 15 s old that
 * may predate the very row being written (the first new-form row of a season).
 */
function freshPlans(form: FormKey): void {
  const desc = getForm(form);
  if (desc.partition) desc.invalidate();
}

/** Narrow a "value or early-exit result" union (the value may be a number). */
const isResult = (v: unknown): v is SyncResult =>
  typeof v === 'object' && v !== null && typeof (v as SyncResult).ok === 'boolean';

const rowRange = (ctx: Ctx, tab: string, row: number) =>
  `${quoteTab(tab)}!A${row}:${lastColOf(planOf(ctx, tab))}${row}`;

/** A row as read back, without the empty cells at its end. */
function withoutTrailingBlanks(row: string[]): string[] {
  const cells = [...row];
  while (cells.length && !(cells[cells.length - 1] ?? '').trim()) cells.pop();
  return cells;
}

/** Row 1 as read back equals `header`. */
function sameHeader(current: string[], header: string[]): boolean {
  const cells = withoutTrailingBlanks(current);
  return cells.length === header.length && header.every((h, i) => (cells[i] ?? '').trim() === h);
}

/** Index of the ID column in a header row as read back, or -1 when the tab is not ours. */
function idIndexIn(head: string[]): number {
  const cells = withoutTrailingBlanks(head);
  return cells.length > 0 && cells[cells.length - 1].trim() === ID_LABEL ? cells.length - 1 : -1;
}

/** Row 1 in full, whatever its width. */
async function readHeaderRow(ctx: BaseCtx, tab: string): Promise<string[] | SyncResult> {
  const res = await getValues(ctx.spreadsheetId, `${quoteTab(tab)}!1:1`);
  if (!res.ok) return failed(res.reason ?? 'read_failed', res.message);
  return res.data?.[0] ?? [];
}

/* --------------------------------------------------- values vs shown values */

/**
 * A rendered row on its way INTO the sheet. Date columns become real date
 * values (a serial number plus the text they will display); everything else is
 * the untouched string, because the write is RAW.
 */
const cellsOf = (types: ColumnType[], row: string[]): Cell[] => toCells(types, row);

/**
 * The same row as the sheet WILL SHOW IT. `values.get` returns formatted
 * values, so this — not the raw ISO timestamp — is what a diff compares
 * against. Get this wrong and every reconcile would "find" a difference in
 * every date cell and rewrite the whole sheet, forever.
 */
const shownOf = (types: ColumnType[], row: string[]): string[] => toDisplay(types, row);

/** Queue the links of rows just written to `tab` from 1-based sheet row `firstRow` (unknown: none). */
function queueLinks(ctx: BaseCtx, tab: string, firstRow: number | null, rows: Cell[][]): void {
  const sheetId = ctx.tabs.get(tab);
  if (sheetId === undefined || !firstRow) return;
  ctx.links.push(...linkRequests(sheetId, firstRow - 1, rows));
}

/**
 * Send every queued link in one `spreadsheets.batchUpdate`. Never fatal: the
 * rows are written; a failure is logged and the next full rewrite sets the
 * links again.
 */
async function sendLinks(ctx: BaseCtx): Promise<void> {
  if (!ctx.links.length) return;
  const requests = ctx.links.splice(0);
  const res = await batchUpdateSheet(ctx.spreadsheetId, '(links)', requests);
  if (!res.ok) strapi?.log?.warn?.(`[sheets] ${ctx.form}: links not set (${res.reason}): ${res.message ?? ''}`);
}

/* ------------------------------------------------------------- tab styling */

/**
 * Bring one tab's FORMATTING up to date: frozen navy header, per-type column
 * widths, date number formats, status colours.
 *
 * `force` separates the two callers. A tab that was just created, or a tab a
 * full resync just rewrote, is formatted unconditionally — that is the only
 * moment the column set can have changed, and a new column needs its width and
 * possibly a date format. The scheduled reconcile passes `force: false` and
 * formats only when the cheap probe (frozen header + the exact status rules,
 * both already in hand from `context()`) says something is missing, so a
 * healthy sheet costs zero extra API calls.
 *
 * Never fatal: formatting is cosmetic, and losing it must not cost the run its
 * data. A failure is logged and the sync continues.
 */
async function applyFormat(
  ctx: BaseCtx,
  tab: string,
  types: ColumnType[],
  force: boolean,
): Promise<void> {
  if (ctx.formatted.has(tab)) return;
  const sheetId = ctx.tabs.get(tab);
  if (sheetId === undefined) return;

  const state = ctx.tabState.get(tab);
  const statusIndex = types.indexOf('status');
  if (!force && formatIsCurrent(state, ctx.form, statusIndex)) {
    ctx.formatted.add(tab);
    return;
  }

  const requests = formatRequests({ form: ctx.form, sheetId, types, state });
  const res = await batchUpdateSheet(ctx.spreadsheetId, tab, requests);
  ctx.formatted.add(tab);
  if (!res.ok) {
    strapi?.log?.warn?.(`[sheets] ${ctx.form}: formatting "${tab}" failed (${res.reason}): ${res.message ?? ''}`);
    return;
  }
  // Replay the batch onto the cached state, so nothing later in this operation
  // can look at the PRE-batch rule list and delete the wrong indices.
  const dropped = new Set<number>(
    requests.filter((r) => r.deleteConditionalFormatRule).map((r) => r.deleteConditionalFormatRule.index),
  );
  ctx.tabState.set(tab, {
    sheetId,
    frozenRowCount: 1,
    conditionalFormats: [
      ...(state?.conditionalFormats ?? []).filter((_, i) => !dropped.has(i)),
      ...requests.filter((r) => r.addConditionalFormatRule).map((r) => r.addConditionalFormatRule.rule),
    ],
  });
}

/* ---------------------------------------------------------------- tab cache */

/**
 * Return the sheetId of `tab`, creating the tab (and writing its header) if it
 * does not exist. Answers from the per-operation cache, so a burst of rows
 * spread over several seasons never triggers a `spreadsheets.get` per row.
 */
async function ensureTabIn(ctx: Ctx, tab: string): Promise<number | SyncResult> {
  const hit = ctx.tabs.get(tab);
  if (hit !== undefined) return hit;

  const created = await createTab(ctx.spreadsheetId, tab);
  if (!created.ok) return failed(created.reason ?? 'tab_failed', created.message);
  const sheetId = created.data!;
  ctx.tabs.set(tab, sheetId);

  const plan = planOf(ctx, tab);
  const written = await updateValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1`, [plan.header]);
  if (!written.ok) return failed(written.reason ?? 'update_failed', written.message);
  ctx.fresh.add(tab);
  // A brand-new tab is styled immediately, so a season tab created next August
  // looks exactly like the one created today.
  await applyFormat(ctx, tab, plan.types, true);
  strapi?.log?.info?.(`[sheets] created tab "${tab}"`);
  return sheetId;
}

/* ------------------------------------------------------------- id lookups */

/**
 * Map documentId -> 1-based sheet row for ONE tab, read from the id column
 * only. Reading a single column keeps the payload tiny even at 5000 rows.
 */
async function readIdMap(ctx: SingleCtx, tab: string): Promise<{ map: Map<string, number> } | SyncResult> {
  const col = lastColOf(ctx.plan);
  const res = await getValues(ctx.spreadsheetId, `${quoteTab(tab)}!${col}1:${col}`);
  if (!res.ok) return failed(res.reason ?? 'read_failed', res.message);
  const map = new Map<string, number>();
  (res.data ?? []).forEach((cells, i) => {
    const id = (cells?.[0] ?? '').trim();
    // Row 1 holds the header label ("ID"), never a documentId.
    if (id && i > 0) map.set(id, i + 1);
  });
  return { map };
}

/** One place a documentId was found. */
interface Located {
  tab: string;
  row: number;
}

interface IdScan {
  /** Every place each id occurs. More than one means a half-finished move. */
  located: Map<string, Located[]>;
  /** Tabs that carry our header in the id column — the ones we may write to. */
  dataTabs: string[];
}

/**
 * Scan the id column of EVERY tab in the spreadsheet, so a row can be found
 * wherever it currently sits. A tab counts as ours only when the last cell of
 * row 1 is the `ID` label (`readTabIds`); anything else (a stray `Sheet1`, a
 * chart tab, a user's own notes) is never written to or cleared.
 */
async function scanIds(ctx: MultiCtx): Promise<IdScan | SyncResult> {
  const located = new Map<string, Located[]>();
  const dataTabs: string[] = [];
  for (const tab of [...ctx.tabs.keys()]) {
    const cells = await readTabIds(ctx, tab);
    if (isResult(cells)) return cells;
    if (!cells) continue;
    dataTabs.push(tab);
    cells.forEach((line, i) => {
      const id = (line?.[0] ?? '').trim();
      if (i > 0 && id) addPlace(located, id, { tab, row: i + 1 });
    });
  }
  return { located, dataTabs };
}

async function readColumn(ctx: BaseCtx, tab: string, index: number): Promise<string[][] | SyncResult> {
  const col = colLetter(index);
  const res = await getValues(ctx.spreadsheetId, `${quoteTab(tab)}!${col}1:${col}`);
  if (!res.ok) return failed(res.reason ?? 'read_failed', res.message);
  return res.data ?? [];
}

/**
 * The ID column of `tab`, header cell included; null when the tab is not ours.
 * The tab's own plan says where it should be (one read in the steady state); a
 * tab still laid out for other columns is found from its header row.
 */
async function readTabIds(ctx: MultiCtx, tab: string): Promise<string[][] | null | SyncResult> {
  const expected = await readColumn(ctx, tab, planOf(ctx, tab).header.length - 1);
  if (isResult(expected) || (expected[0]?.[0] ?? '').trim() === ID_LABEL) return expected;
  const head = await readHeaderRow(ctx, tab);
  if (isResult(head)) return head;
  const index = idIndexIn(head);
  return index < 0 ? null : readColumn(ctx, tab, index);
}

function addPlace(located: Map<string, Located[]>, id: string, place: Located): void {
  const list = located.get(id);
  if (list) list.push(place);
  else located.set(id, [place]);
}

/* ----------------------------------------------------------- ensureHeader */

/**
 * Make sure row 1 matches the current column plan. A missing header is written
 * in place; a STALE header (a custom question was added or removed) triggers a
 * full rewrite, because otherwise every existing row would silently misalign.
 *
 * For a partitioned form this checks every tab we own — a mismatch anywhere is
 * repaired by rewriting all of them.
 */
export async function ensureHeader(form: FormKey): Promise<SyncResult> {
  const ctx = await context(form);
  if (isResult(ctx)) return ctx;
  if (!isMulti(ctx)) {
    const res = await ensureHeaderIn(form, ctx, ctx.tab);
    if (res.ok) await applyFormat(ctx, ctx.tab, ctx.plan.types, false);
    return res;
  }

  const scan = await scanIds(ctx);
  if (isResult(scan)) return scan;
  for (const tab of scan.dataTabs) {
    const res = await ensureHeaderIn(form, ctx, tab);
    if (!res.ok) return res;
    // A rewrite already fixed every tab.
    if (res.added || res.updated || res.removed) return res;
    await applyFormat(ctx, tab, planOf(ctx, tab).types, false);
  }
  return { ...EMPTY, ok: true };
}

/** Verify (or write) row 1 of one specific tab against that tab's own plan. */
async function ensureHeaderIn(form: FormKey, ctx: Ctx, tab: string): Promise<SyncResult> {
  // A tab this operation just created was given the current header already.
  if (ctx.fresh.has(tab)) return { ...EMPTY, ok: true };

  const header = planOf(ctx, tab).header;
  const res = await getValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1:${colLetter(header.length - 1)}1`);
  if (!res.ok) return failed(res.reason ?? 'read_failed', res.message);
  const current = res.data?.[0] ?? [];

  if (current.length === 0) {
    const w = await updateValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1`, [header]);
    if (!w.ok) return failed(w.reason ?? 'update_failed', w.message);
    return { ...EMPTY, ok: true };
  }
  if (sameHeader(current, header)) return { ...EMPTY, ok: true };

  // Column set changed: rewrite everything so no row can misalign.
  strapi.log.info(`[sheets] ${form}: header changed in "${tab}", rewriting`);
  return resyncForm(form, 'manual', { log: false });
}

/* -------------------------------------------------------------- upsertRow */

/** Write one document: update its existing row, or append it if it is new. */
export async function upsertRow(form: FormKey, doc: RowLike): Promise<SyncResult> {
  freshPlans(form);
  const ctx = await context(form);
  if (isResult(ctx)) return ctx;
  const documentId = String(doc?.documentId ?? '').trim();
  if (!documentId) return failed('missing_document_id');
  return isMulti(ctx)
    ? upsertMulti(form, ctx, doc, documentId)
    : upsertSingle(form, ctx, doc, documentId);
}

async function upsertSingle(
  form: FormKey,
  ctx: SingleCtx,
  doc: RowLike,
  documentId: string,
): Promise<SyncResult> {
  const headerRes = await ensureHeaderIn(form, ctx, ctx.tab);
  if (!headerRes.ok) return headerRes;
  // A header rewrite already wrote every row, this one included.
  if (headerRes.added || headerRes.updated || headerRes.removed) return headerRes;

  const ids = await readIdMap(ctx, ctx.tab);
  if (isResult(ids)) return ids;

  const row = cellsOf(ctx.plan.types, ctx.plan.row(doc));
  const existing = ids.map.get(documentId);
  if (existing) {
    const res = await updateValues(ctx.spreadsheetId, rowRange(ctx, ctx.tab, existing), [row]);
    if (!res.ok) return failed(res.reason ?? 'update_failed', res.message);
    return { ...EMPTY, ok: true, updated: 1 };
  }
  const res = await appendValues(ctx.spreadsheetId, `${quoteTab(ctx.tab)}!A1`, [row]);
  if (!res.ok) return failed(res.reason ?? 'append_failed', res.message);
  return { ...EMPTY, ok: true, added: 1 };
}

/**
 * Partitioned upsert. The row's target tab comes from the row itself, so this
 * has one case the single-tab path does not: the document may already sit in a
 * DIFFERENT tab because its season changed. That is handled as insert-then-
 * delete, never the reverse.
 */
async function upsertMulti(
  form: FormKey,
  ctx: MultiCtx,
  doc: RowLike,
  documentId: string,
): Promise<SyncResult> {
  const target = ctx.partition.tabFor(doc);
  const sheetId = await ensureTabIn(ctx, target);
  if (typeof sheetId !== 'number') return sheetId;

  const headerRes = await ensureHeaderIn(form, ctx, target);
  if (!headerRes.ok) return headerRes;
  if (headerRes.added || headerRes.updated || headerRes.removed) return headerRes;

  const scan = await scanIds(ctx);
  if (isResult(scan)) return scan;

  const plan = planOf(ctx, target);
  const row = cellsOf(plan.types, plan.row(doc));
  const places = scan.located.get(documentId) ?? [];
  const here = places.find((p) => p.tab === target);
  const elsewhere = places.filter((p) => p.tab !== target);

  let added = 0;
  let updated = 0;

  if (here) {
    const res = await updateValues(ctx.spreadsheetId, rowRange(ctx, target, here.row), [row]);
    if (!res.ok) return failed(res.reason ?? 'update_failed', res.message);
    queueLinks(ctx, target, here.row, [row]);
    updated = 1;
  } else {
    // INSERT FIRST. If the process dies now, the row exists twice and the next
    // reconcile drops the stale copy; the row itself is never lost.
    const res = await appendValues(ctx.spreadsheetId, `${quoteTab(target)}!A1`, [row]);
    if (!res.ok) return failed(res.reason ?? 'append_failed', res.message);
    queueLinks(ctx, target, res.data?.startRow ?? null, [row]);
    added = 1;
  }
  await sendLinks(ctx);

  const removed = await dropRows(ctx, elsewhere);
  if (isResult(removed)) return removed;
  if (removed) {
    strapi?.log?.info?.(
      `[sheets] ${form}: moved ${documentId} to "${target}" (removed ${removed} stale row(s))`,
    );
  }
  return { ...EMPTY, ok: true, added, updated, removed };
}

/** Delete a set of located rows, grouped per tab (one API call per tab). */
async function dropRows(ctx: BaseCtx, places: Located[]): Promise<number | SyncResult> {
  if (!places.length) return 0;
  const byTab = new Map<string, number[]>();
  for (const p of places) {
    const list = byTab.get(p.tab);
    if (list) list.push(p.row - 1);
    else byTab.set(p.tab, [p.row - 1]);
  }
  let removed = 0;
  for (const [tab, indices] of byTab) {
    const sheetId = ctx.tabs.get(tab);
    if (sheetId === undefined) continue;
    const res = await deleteRows(ctx.spreadsheetId, tab, sheetId, indices);
    if (!res.ok) return failed(res.reason ?? 'delete_failed', res.message);
    removed += res.data?.removed ?? indices.length;
  }
  return removed;
}

/* -------------------------------------------------------------- deleteRow */

/** Remove the row carrying `documentId`, wherever the spreadsheet holds it. */
export async function deleteRow(form: FormKey, documentId: string): Promise<SyncResult> {
  const ctx = await context(form);
  if (isResult(ctx)) return ctx;
  const id = String(documentId ?? '').trim();
  if (!id) return failed('missing_document_id');

  if (!isMulti(ctx)) {
    const ids = await readIdMap(ctx, ctx.tab);
    if (isResult(ids)) return ids;
    const row = ids.map.get(id);
    if (!row) return { ...EMPTY, ok: true };
    const res = await deleteRows(ctx.spreadsheetId, ctx.tab, ctx.sheetId, [row - 1]);
    if (!res.ok) return failed(res.reason ?? 'delete_failed', res.message);
    return { ...EMPTY, ok: true, removed: 1 };
  }

  const scan = await scanIds(ctx);
  if (isResult(scan)) return scan;
  const removed = await dropRows(ctx, scan.located.get(id) ?? []);
  if (isResult(removed)) return removed;
  return { ...EMPTY, ok: true, removed };
}

/* ------------------------------------------------------------- resyncForm */

/**
 * Full rewrite: clear, write the header, write every row.
 *
 * Single-tab: one tab cleared and rewritten.
 * Partitioned: the rows are grouped by their tab, a tab is ensured per group,
 * and each group's tab is cleared and rewritten. Tabs we own that no longer
 * match any row are LEFT ALONE — an archived season is data the user may still
 * want — and merely reported as `staleTabs`.
 */
export async function resyncForm(
  form: FormKey,
  trigger: SyncTrigger = 'manual',
  opts: { log?: boolean } = {},
): Promise<SyncResult> {
  const shouldLog = opts.log !== false;
  const ctx = await context(form);
  if (isResult(ctx)) {
    if (shouldLog && !ctx.ok) await logSync(form, trigger, EMPTY, false, ctx.reason);
    return ctx;
  }

  const desc = getForm(form);
  const rows = await desc.fetchAll();
  // Rebuild the plan(s) over exactly the rows we are about to write, so a
  // custom answer that only exists on old rows still gets a column.
  const result = isMulti(ctx)
    ? await resyncMulti({ ...ctx, plans: await desc.resolveTabPlans(rows) }, rows)
    : await resyncSingle(ctx, await desc.resolvePlan(rows), rows);

  if (shouldLog) {
    const message = result.ok
      ? describeResync(result, rows.length)
      : `${result.reason}: ${result.message ?? ''}`.trim();
    await logSync(form, trigger, result.ok ? result : EMPTY, result.ok, message);
  }
  return result;
}

function describeResync(result: SyncResult, rowCount: number): string {
  const stale = result.staleTabs?.length
    ? `; file păstrate fără rânduri: ${result.staleTabs.join(', ')}`
    : '';
  return `Rescriere completă: ${rowCount} rânduri${stale}`;
}

async function resyncSingle(ctx: SingleCtx, plan: ColumnPlan, rows: RowLike[]): Promise<SyncResult> {
  const values: Cell[][] = [plan.header, ...rows.map((doc) => cellsOf(plan.types, plan.row(doc)))];
  const cleared = await clearValues(ctx.spreadsheetId, ctx.tab);
  if (!cleared.ok) return failed(cleared.reason ?? 'clear_failed', cleared.message);
  const written = await updateValues(ctx.spreadsheetId, `${quoteTab(ctx.tab)}!A1`, values);
  if (!written.ok) return failed(written.reason ?? 'update_failed', written.message);
  // `values.clear` wipes contents, never formatting — but the column set may
  // just have changed, so the widths and date formats are re-derived here.
  await applyFormat(ctx, ctx.tab, plan.types, true);
  return { ok: true, added: rows.length, updated: 0, removed: 0 };
}

async function resyncMulti(ctx: MultiCtx, rows: RowLike[]): Promise<SyncResult> {
  // Which tabs do we currently own? Read before anything is cleared, so a tab
  // that ends up empty can still be reported rather than silently forgotten.
  const scan = await scanIds(ctx);
  if (isResult(scan)) return scan;

  const groups = groupByTab(ctx, rows);
  for (const [tab, docs] of groups) {
    const res = await rewriteTab(ctx, tab, docs);
    if (res) return res;
  }

  await sendLinks(ctx);

  const staleTabs = scan.dataTabs.filter((t) => !groups.has(t)).sort();
  // A stale tab is kept, but not the copies it still holds of rows just
  // written to their own tab (the source half of a move).
  const removed = await dropRows(ctx, movedAway(scan, staleTabs, rows));
  if (isResult(removed)) return removed;
  if (staleTabs.length) {
    strapi?.log?.info?.(`[sheets] tabs with no rows left in the database (kept): ${staleTabs.join(', ')}`);
  }
  return { ok: true, added: rows.length, updated: 0, removed, staleTabs };
}

/** Where tabs with no rows in the database hold rows that the database places in another tab. */
function movedAway(scan: IdScan, staleTabs: string[], rows: RowLike[]): Located[] {
  const ids = new Set(rows.map((r) => String(r?.documentId ?? '').trim()));
  const stale = new Set(staleTabs);
  return [...scan.located]
    .filter(([id]) => ids.has(id))
    .flatMap(([, places]) => places.filter((p) => stale.has(p.tab)));
}

/** Rows grouped by the tab they belong in, oldest first within each tab. */
function groupByTab(ctx: MultiCtx, rows: RowLike[]): Map<string, RowLike[]> {
  const groups = new Map<string, RowLike[]>();
  for (const doc of rows) appendTo(groups, ctx.partition.tabFor(doc), doc);
  return groups;
}

function appendTo<T>(map: Map<string, T[]>, key: string, item: T): void {
  const list = map.get(key);
  if (list) list.push(item);
  else map.set(key, [item]);
}

/** Clear one tab and write its header and rows with the tab's own columns. Null when it worked. */
async function rewriteTab(ctx: MultiCtx, tab: string, docs: RowLike[]): Promise<SyncResult | null> {
  const sheetId = await ensureTabIn(ctx, tab);
  if (typeof sheetId !== 'number') return sheetId;
  const plan = planOf(ctx, tab);
  const cleared = await clearValues(ctx.spreadsheetId, tab);
  if (!cleared.ok) return failed(cleared.reason ?? 'clear_failed', cleared.message);
  const rows = docs.map((doc) => cellsOf(plan.types, plan.row(doc)));
  const written = await updateValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1`, [plan.header, ...rows]);
  if (!written.ok) return failed(written.reason ?? 'update_failed', written.message);
  queueLinks(ctx, tab, 2, rows);
  // `values.clear` wipes contents, never formatting; the column set may have
  // just changed, so the widths, date formats and status colours are redone.
  await applyFormat(ctx, tab, plan.types, true);
  return null;
}

/* --------------------------------------------------------------- reconcile */

/**
 * The scheduled catch-up pass: compare the database against the sheet and
 * repair the difference — append what is missing, update what changed, delete
 * rows whose document no longer exists. A write that failed earlier (a Google
 * outage, a container restart mid-submission) is healed here.
 *
 * For a partitioned form this also repairs LOCATION: a row sitting in the wrong
 * season tab is re-inserted into the right one and then removed from the wrong
 * one, in that order. A duplicate left by a crashed move is cleaned up the same
 * way, because the extra copy is simply a row in the wrong place.
 */
export async function reconcile(form: FormKey, trigger: SyncTrigger = 'scheduled'): Promise<SyncResult> {
  const ctx = await context(form);
  if (isResult(ctx)) return ctx;

  const desc = getForm(form);
  const rows = await desc.fetchAll();
  return isMulti(ctx)
    ? reconcileMulti(form, { ...ctx, plans: await desc.resolveTabPlans(rows) }, rows, trigger)
    : reconcileSingle(form, ctx, await desc.resolvePlan(rows), rows, trigger);
}

/** Row 1 of `tab` compared against the plan header. */
async function headerState(
  ctx: BaseCtx,
  tab: string,
  plan: ColumnPlan,
): Promise<{ matches: boolean } | SyncResult> {
  const res = await getValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1:${lastColOf(plan)}1`);
  if (!res.ok) return failed(res.reason ?? 'read_failed', res.message);
  return { matches: sameHeader(res.data?.[0] ?? [], plan.header) };
}

async function reconcileSingle(
  form: FormKey,
  ctx: SingleCtx,
  plan: ColumnPlan,
  rows: RowLike[],
  trigger: SyncTrigger,
): Promise<SyncResult> {
  // A changed column set makes a cell-by-cell diff meaningless: rewrite.
  const head = await headerState(ctx, ctx.tab, plan);
  if (isResult(head)) return head;
  if (!head.matches) {
    const res = await resyncForm(form, trigger, { log: false });
    await logSync(form, trigger, res, res.ok, res.ok ? 'Antet diferit: rescriere completă' : res.reason);
    return res;
  }

  // Repair the tab's styling only if the cheap probe says it is missing — on a
  // healthy sheet this is free, since the state came from the `spreadsheets.get`
  // `context()` already made.
  await applyFormat(ctx, ctx.tab, plan.types, false);

  const idIndex = plan.header.length - 1;
  const lastCol = colLetter(idIndex);
  const all = await getValues(ctx.spreadsheetId, `${quoteTab(ctx.tab)}!A1:${lastCol}`);
  if (!all.ok) return failed(all.reason ?? 'read_failed', all.message);

  const byId = new Map<string, { row: number; cells: string[] }>();
  (all.data ?? []).forEach((cells, i) => {
    if (i === 0) return; // header
    const id = (cells?.[idIndex] ?? '').trim();
    if (id) byId.set(id, { row: i + 1, cells });
  });

  const dbIds = new Set<string>();
  const toAppend: Cell[][] = [];
  const toUpdate: { range: string; values: Cell[][] }[] = [];

  for (const doc of rows) {
    const id = String(doc?.documentId ?? '').trim();
    if (!id) continue;
    dbIds.add(id);
    const want = plan.row(doc);
    const found = byId.get(id);
    if (!found) {
      toAppend.push(cellsOf(plan.types, want));
      continue;
    }
    // Compare against what the sheet SHOWS: a date cell reads back as
    // "13.09.2026 15:30", never as the ISO string the database holds.
    const shown = shownOf(plan.types, want);
    if (!shown.every((cell, i) => (found.cells[i] ?? '') === cell)) {
      toUpdate.push({
        range: `${quoteTab(ctx.tab)}!A${found.row}:${lastCol}${found.row}`,
        values: [cellsOf(plan.types, want)],
      });
    }
  }

  const orphanRows: number[] = [];
  for (const [id, found] of byId) if (!dbIds.has(id)) orphanRows.push(found.row - 1);

  let ok = true;
  const problems: string[] = [];

  if (toUpdate.length) {
    const res = await batchUpdateValues(ctx.spreadsheetId, toUpdate);
    if (!res.ok) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
    }
  }
  if (toAppend.length) {
    const res = await appendValues(ctx.spreadsheetId, `${quoteTab(ctx.tab)}!A1`, toAppend);
    if (!res.ok) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
    }
  }
  if (orphanRows.length) {
    const res = await deleteRows(ctx.spreadsheetId, ctx.tab, ctx.sheetId, orphanRows);
    if (!res.ok) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
    }
  }

  const counts: SyncCounts = {
    added: toAppend.length,
    updated: toUpdate.length,
    removed: orphanRows.length,
  };
  const message = ok ? `Verificare: +${counts.added} ~${counts.updated} -${counts.removed}` : problems.join('; ');
  await logSync(form, trigger, counts, ok, message);
  return { ...counts, ok, reason: ok ? undefined : 'reconcile_failed', message };
}

/** What the tabs we own hold, read once per reconcile. */
interface SheetState {
  dataTabs: string[];
  /** Every place each id occurs. */
  located: Map<string, Located[]>;
  /** `${tab}#${row}` -> the row's cells as the sheet shows them. */
  cellsAt: Map<string, string[]>;
}

/** One database row: the tab it belongs in, the cells to write, and the text they will show. */
interface Wanted {
  tab: string;
  cells: Cell[];
  shown: string[];
}

/** A row rewritten in place: where, and its cells. */
interface RowUpdate {
  range: string;
  values: Cell[][];
  tab: string;
  row: number;
}

/** The writes that bring a partitioned form's tabs in line with the database. */
interface Changes {
  toUpdate: RowUpdate[];
  appendsByTab: Map<string, Cell[][]>;
  toDelete: Located[];
}

/** What a set of changes did. */
interface Applied extends SyncCounts {
  ok: boolean;
  problems: string[];
}

const HEADER_CHANGED = 'header_changed' as const;

/** How a tab relates to its plan: ours and current, ours with other columns (ID at `idIndex`), or not ours. */
type Layout = { kind: 'current' | 'changed'; idIndex: number } | { kind: 'foreign' };

async function reconcileMulti(
  form: FormKey,
  ctx: MultiCtx,
  rows: RowLike[],
  trigger: SyncTrigger,
): Promise<SyncResult> {
  const want = wantedRows(ctx, rows);
  const wantedTabs = new Set([...want.values()].map((w) => w.tab));
  const sheet = await readOwnTabs(ctx, wantedTabs);
  if (sheet === HEADER_CHANGED) {
    // A changed column set makes a cell-by-cell diff meaningless: rewrite all.
    const res = await resyncForm(form, trigger, { log: false });
    await logSync(form, trigger, res, res.ok, res.ok ? 'Antet diferit: rescriere completă' : res.reason);
    return res;
  }
  if (isResult(sheet)) return sheet;

  const { changes, misplaced } = reconcileChanges(ctx, sheet, want);
  const applied = await applyChanges(ctx, changes);
  const staleTabs = sheet.dataTabs.filter((t) => !wantedTabs.has(t)).sort();
  const message = applied.ok ? reconcileMessage(applied, misplaced, staleTabs) : applied.problems.join('; ');
  const counts: SyncCounts = { added: applied.added, updated: applied.updated, removed: applied.removed };
  await logSync(form, trigger, counts, applied.ok, message);
  return { ...counts, ok: applied.ok, reason: applied.ok ? undefined : 'reconcile_failed', message, staleTabs };
}

/**
 * Read every tab in full, once. Tabs that are not ours are skipped outright. A
 * tab of ours whose header is not its plan's means the column set changed,
 * unless the database has no rows for it any more: such a tab keeps whatever
 * columns it has, and only its ids are read, to remove what it still holds.
 */
async function readOwnTabs(
  ctx: MultiCtx,
  wantedTabs: Set<string>,
): Promise<SheetState | SyncResult | typeof HEADER_CHANGED> {
  const sheet: SheetState = { dataTabs: [], located: new Map(), cellsAt: new Map() };
  for (const tab of [...ctx.tabs.keys()]) {
    const res = await readOwnTab(ctx, tab, wantedTabs.has(tab), sheet);
    if (res) return res;
  }
  return sheet;
}

/** Read one tab into `sheet`. Null when done (or when the tab is not ours). */
async function readOwnTab(
  ctx: MultiCtx,
  tab: string,
  wanted: boolean,
  sheet: SheetState,
): Promise<SyncResult | typeof HEADER_CHANGED | null> {
  const plan = planOf(ctx, tab);
  const res = await getValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1:${lastColOf(plan)}`);
  if (!res.ok) return failed(res.reason ?? 'read_failed', res.message);
  const grid = res.data ?? [];
  const layout = await layoutOf(ctx, tab, plan, grid[0] ?? []);
  if (isResult(layout)) return layout;
  if (layout.kind === 'foreign') return null;
  if (layout.kind === 'changed') return wanted ? HEADER_CHANGED : collectIds(ctx, sheet, tab, layout.idIndex);
  await applyFormat(ctx, tab, plan.types, false);
  collectRows(sheet, tab, grid, layout.idIndex);
  return null;
}

/** A tab with no rows left in the database, laid out for other columns: only find what it holds. */
async function collectIds(ctx: MultiCtx, sheet: SheetState, tab: string, idIndex: number): Promise<SyncResult | null> {
  const ids = await readColumn(ctx, tab, idIndex);
  if (isResult(ids)) return ids;
  collectRows(sheet, tab, ids, 0);
  return null;
}

/** `head` is row 1 read up to the plan's last column; the full row is read only when that is not ours. */
async function layoutOf(ctx: MultiCtx, tab: string, plan: ColumnPlan, head: string[]): Promise<Layout | SyncResult> {
  const idIndex = plan.header.length - 1;
  if ((head[idIndex] ?? '').trim() === ID_LABEL) {
    return { kind: sameHeader(head, plan.header) ? 'current' : 'changed', idIndex };
  }
  const full = await readHeaderRow(ctx, tab);
  if (isResult(full)) return full;
  const found = idIndexIn(full);
  return found < 0 ? { kind: 'foreign' } : { kind: 'changed', idIndex: found };
}

function collectRows(sheet: SheetState, tab: string, grid: string[][], idIndex: number): void {
  sheet.dataTabs.push(tab);
  grid.forEach((cells, i) => {
    const id = (cells?.[idIndex] ?? '').trim();
    if (i === 0 || !id) return;
    addPlace(sheet.located, id, { tab, row: i + 1 });
    sheet.cellsAt.set(`${tab}#${i + 1}`, cells);
  });
}

/** What the database says: id -> the tab it belongs in and the row as that tab's plan renders it. */
function wantedRows(ctx: MultiCtx, rows: RowLike[]): Map<string, Wanted> {
  const want = new Map<string, Wanted>();
  for (const doc of rows) {
    const id = String(doc?.documentId ?? '').trim();
    if (!id) continue;
    const tab = ctx.partition.tabFor(doc);
    const plan = planOf(ctx, tab);
    const rendered = plan.row(doc);
    want.set(id, { tab, cells: cellsOf(plan.types, rendered), shown: shownOf(plan.types, rendered) });
  }
  return want;
}

/**
 * Diff the sheet against the database. A row in the wrong tab (a moved season,
 * or the leftover half of a crashed move) is re-inserted in its own tab and
 * removed from the other; rows whose document is gone are removed; a duplicate
 * inside one tab keeps its first copy.
 */
function reconcileChanges(
  ctx: MultiCtx,
  sheet: SheetState,
  want: Map<string, Wanted>,
): { changes: Changes; misplaced: number } {
  const changes: Changes = { toUpdate: [], appendsByTab: new Map(), toDelete: [] };
  let misplaced = 0;
  for (const [id, target] of want) {
    const places = sheet.located.get(id) ?? [];
    placeRow(ctx, sheet, changes, target, places);
    const away = places.filter((p) => p.tab !== target.tab);
    changes.toDelete.push(...away);
    misplaced += away.length;
  }
  for (const [id, places] of sheet.located) {
    const target = want.get(id);
    if (!target) changes.toDelete.push(...places);
    else changes.toDelete.push(...places.filter((p) => p.tab === target.tab).slice(1));
  }
  return { changes, misplaced };
}

/** Update the row where it already sits in its tab (when it shows something else), or append it there. */
function placeRow(ctx: MultiCtx, sheet: SheetState, changes: Changes, target: Wanted, places: Located[]): void {
  const here = places.find((p) => p.tab === target.tab);
  if (!here) {
    appendTo(changes.appendsByTab, target.tab, target.cells);
    return;
  }
  // Compare against what the sheet SHOWS: a date cell reads back as
  // "13.09.2026 15:30", never as the ISO string the database holds.
  const current = sheet.cellsAt.get(`${here.tab}#${here.row}`) ?? [];
  if (!target.shown.every((cell, i) => (current[i] ?? '') === cell)) {
    changes.toUpdate.push({ range: rowRange(ctx, here.tab, here.row), values: [target.cells], tab: here.tab, row: here.row });
  }
}

function reconcileMessage(counts: SyncCounts, misplaced: number, staleTabs: string[]): string {
  return (
    `Verificare: +${counts.added} ~${counts.updated} -${counts.removed}` +
    (misplaced > 0 ? ` (${misplaced} mutate între file)` : '') +
    (staleTabs.length ? `; file păstrate fără rânduri: ${staleTabs.join(', ')}` : '')
  );
}

/** Record a failed step; true when the step worked. */
function note(out: Applied, res: { ok: boolean; reason?: string; message?: string }): boolean {
  if (res.ok) return true;
  out.ok = false;
  out.problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
  return false;
}

/**
 * Write a set of changes: the updates in one call, the appends one call per
 * tab, and only then, when every write worked, the deletes. INSERTS BEFORE
 * DELETES: a failure here must never leave a row nowhere.
 */
async function applyChanges(ctx: MultiCtx, changes: Changes): Promise<Applied> {
  const out: Applied = { ok: true, problems: [], added: 0, updated: changes.toUpdate.length, removed: 0 };
  if (changes.toUpdate.length && note(out, await batchUpdateValues(ctx.spreadsheetId, changes.toUpdate))) {
    for (const u of changes.toUpdate) queueLinks(ctx, u.tab, u.row, u.values);
  }
  for (const [tab, values] of changes.appendsByTab) await appendRows(ctx, tab, values, out);
  await sendLinks(ctx);
  await deleteAfterInserts(ctx, changes.toDelete, out);
  return out;
}

async function appendRows(ctx: MultiCtx, tab: string, values: Cell[][], out: Applied): Promise<void> {
  const sheetId = await ensureTabIn(ctx, tab);
  if (typeof sheetId !== 'number') {
    note(out, sheetId);
    return;
  }
  const res = await appendValues(ctx.spreadsheetId, `${quoteTab(tab)}!A1`, values);
  if (!note(out, res)) return;
  out.added += values.length;
  queueLinks(ctx, tab, res.data?.startRow ?? null, values);
}

async function deleteAfterInserts(ctx: MultiCtx, toDelete: Located[], out: Applied): Promise<void> {
  if (!toDelete.length) return;
  if (!out.ok) {
    out.problems.push('ștergerile au fost amânate: o inserare a eșuat');
    return;
  }
  const res = await dropRows(ctx, toDelete);
  if (isResult(res)) note(out, res);
  else out.removed = res;
}

/* ------------------------------------------------------------ batch writes */

/**
 * Apply a queued burst in as few API calls as possible: one id scan, one
 * `values.batchUpdate` for every changed row, one `values.append` per target
 * tab, one `batchUpdate`/deleteDimension per tab for the removals. A hundred
 * row updates from a bulk admin action therefore cost a handful of requests,
 * not a hundred — Google allows roughly 60 writes per minute per user.
 */
export async function applyBatch(
  form: FormKey,
  upsertIds: string[],
  deleteIds: string[],
): Promise<SyncResult> {
  freshPlans(form);
  const ctx = await context(form);
  if (isResult(ctx)) return ctx;

  const docs = await getForm(form).fetchByIds(upsertIds);

  return isMulti(ctx)
    ? batchMulti(form, ctx, docs, deleteIds)
    : batchSingle(form, ctx, docs, deleteIds);
}

async function batchSingle(
  form: FormKey,
  ctx: SingleCtx,
  docs: RowLike[],
  deleteIds: string[],
): Promise<SyncResult> {
  const headerRes = await ensureHeaderIn(form, ctx, ctx.tab);
  if (!headerRes.ok) return headerRes;
  // A header rewrite already rewrote everything; the queued work is subsumed.
  if (headerRes.added || headerRes.updated || headerRes.removed) return headerRes;

  const ids = await readIdMap(ctx, ctx.tab);
  if (isResult(ids)) return ids;

  const toUpdate: { range: string; values: Cell[][] }[] = [];
  const toAppend: Cell[][] = [];
  for (const doc of docs) {
    const id = String(doc?.documentId ?? '').trim();
    if (!id) continue;
    const row = cellsOf(ctx.plan.types, ctx.plan.row(doc));
    const at = ids.map.get(id);
    if (at) toUpdate.push({ range: rowRange(ctx, ctx.tab, at), values: [row] });
    else toAppend.push(row);
  }

  const deleteRowIdx = deleteIds
    .map((id) => ids.map.get(String(id).trim()))
    .filter((r): r is number => typeof r === 'number')
    .map((r) => r - 1);

  let ok = true;
  const problems: string[] = [];

  if (toUpdate.length) {
    const res = await batchUpdateValues(ctx.spreadsheetId, toUpdate);
    if (!res.ok) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
    }
  }
  if (toAppend.length) {
    const res = await appendValues(ctx.spreadsheetId, `${quoteTab(ctx.tab)}!A1`, toAppend);
    if (!res.ok) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
    }
  }
  if (deleteRowIdx.length) {
    const res = await deleteRows(ctx.spreadsheetId, ctx.tab, ctx.sheetId, deleteRowIdx);
    if (!res.ok) {
      ok = false;
      problems.push(`${res.reason}: ${res.message ?? ''}`.trim());
    }
  }

  return {
    ok,
    added: toAppend.length,
    updated: toUpdate.length,
    removed: deleteRowIdx.length,
    reason: ok ? undefined : 'batch_failed',
    message: ok ? undefined : problems.join('; '),
  };
}

/**
 * Partitioned batch. Same shape as the single-tab one, plus the move case:
 * every queued document is appended to (or updated in) the tab its season says
 * it belongs in, with that tab's columns, and only then are its copies in
 * other tabs removed.
 */
async function batchMulti(
  form: FormKey,
  ctx: MultiCtx,
  docs: RowLike[],
  deleteIds: string[],
): Promise<SyncResult> {
  const targets = await prepareTargets(form, ctx, docs);
  if (isResult(targets)) return targets;

  const scan = await scanIds(ctx);
  if (isResult(scan)) return scan;

  const applied = await applyChanges(ctx, batchChanges(ctx, scan, docs, targets, deleteIds));
  return {
    ok: applied.ok,
    added: applied.added,
    updated: applied.updated,
    removed: applied.removed,
    reason: applied.ok ? undefined : 'batch_failed',
    message: applied.ok ? undefined : applied.problems.join('; '),
  };
}

/**
 * documentId -> target tab. Every target tab is created and its header checked
 * first, so the scan already sees it. A header that had to change rewrote the
 * whole form; that result is returned and the queued work is subsumed.
 */
async function prepareTargets(form: FormKey, ctx: MultiCtx, docs: RowLike[]): Promise<Map<string, string> | SyncResult> {
  const targets = new Map<string, string>();
  for (const doc of docs) {
    const id = String(doc?.documentId ?? '').trim();
    if (!id) continue;
    const tab = ctx.partition.tabFor(doc);
    const seen = [...targets.values()].includes(tab);
    targets.set(id, tab);
    if (seen) continue;
    const sheetId = await ensureTabIn(ctx, tab);
    if (typeof sheetId !== 'number') return sheetId;
    const headerRes = await ensureHeaderIn(form, ctx, tab);
    if (failedOrRewrote(headerRes)) return headerRes;
  }
  return targets;
}

/** A header check that failed, or that rewrote the whole form (which subsumes the queued work). */
const failedOrRewrote = (res: SyncResult): boolean => !res.ok || res.added + res.updated + res.removed > 0;

function batchChanges(
  ctx: MultiCtx,
  scan: IdScan,
  docs: RowLike[],
  targets: Map<string, string>,
  deleteIds: string[],
): Changes {
  const changes: Changes = { toUpdate: [], appendsByTab: new Map(), toDelete: [] };
  for (const doc of docs) {
    const id = String(doc?.documentId ?? '').trim();
    const tab = targets.get(id);
    if (!tab) continue;
    const plan = planOf(ctx, tab);
    const row = cellsOf(plan.types, plan.row(doc));
    const places = scan.located.get(id) ?? [];
    const here = places.find((p) => p.tab === tab);
    if (here) changes.toUpdate.push({ range: rowRange(ctx, tab, here.row), values: [row], tab, row: here.row });
    else appendTo(changes.appendsByTab, tab, row);
    changes.toDelete.push(...places.filter((p) => p.tab !== tab));
  }
  for (const raw of deleteIds) changes.toDelete.push(...(scan.located.get(String(raw ?? '').trim()) ?? []));
  return changes;
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npm test -- src/sheets` then `npm test` and `npx tsc --noEmit`.
Expected: all PASS, zero type errors. The dry-run client logs `[sheets][dry-run] ...` lines through the fake logger only; nothing reaches Google.

- [ ] **Step 7: Commit**

```bash
git add src/sheets/sync.ts src/sheets/format.ts src/sheets/client.ts \
  src/sheets/__tests__/format-links.test.ts src/sheets/__tests__/sync-tabs.test.ts
git commit -m "feat(sheets): every season tab with its own columns, Document as a link"
```

---

### Task 5: Boot check on a throwaway Postgres and the browser

**Files:** none in the repo. Temporary files live in `${TMPDIR:-/tmp}/es2e` and are removed at the end.

**Interfaces:**
- Consumes: everything above, and plan 2A merged (its schema fields). Proves, against a real Strapi: the `section` populate and the per-tab plans in the built code, the dry-run Sheet content of each tab, an idempotent reconcile, the list search on the registration number, and the Document link opening the registration in the admin, also through the login page.

Notes: `SHEETS_DRY_RUN=1` with throwaway service-account values keeps every Google call in memory, so nothing reaches a real Sheet. If port 55491 or 1349 is taken, pick others and change every place they appear. When an agent runs this, start Strapi as a background job and poll `/_health`.

- [ ] **Step 1: Start Postgres, write the throwaway environment, build**

```bash
cd /Users/codrin/Documents/Programming/edusport_backend
T="${TMPDIR:-/tmp}/es2e"; mkdir -p "$T"
cat > "$T/env" <<'EOF'
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=55491
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=strapi
HOST=127.0.0.1
PORT=1349
APP_KEYS=throwawayA,throwawayB
API_TOKEN_SALT=throwaway
ADMIN_JWT_SECRET=throwaway
TRANSFER_TOKEN_SALT=throwaway
JWT_SECRET=throwaway
ENCRYPTION_KEY=throwaway
STRAPI_TELEMETRY_DISABLED=true
GOOGLE_SA_EMAIL=robot@example.iam
GOOGLE_SA_PRIVATE_KEY=throwaway
SHEETS_DRY_RUN=1
CMS_PUBLIC_URL=http://127.0.0.1:1349
EOF
docker run -d --name es2e-pg -e POSTGRES_USER=strapi -e POSTGRES_PASSWORD=strapi -e POSTGRES_DB=strapi \
  -p 127.0.0.1:55491:5432 postgres:16
until docker exec es2e-pg pg_isready -U strapi >/dev/null 2>&1; do sleep 1; done
(set -a; . "$T/env"; set +a; npm run build)
```

Expected: the build finishes; `ls dist/src/sheets/script-form.js dist/src/sheets/admin-link.js` lists both; `ls dist/src/sheets/__tests__` fails (the test helper is not built).

- [ ] **Step 2: Fixtures and the dry-run Sheet**

```bash
cat > "$T/fixture.js" <<'EOF'
const { createStrapi, compileStrapi } = require('@strapi/strapi');
(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  const R = 'api::registration-submission.registration-submission';
  const school = await d('api::section.section').create({ data: { name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', slug: 'afi-cotroceni', publicPage: true } });
  await d(R).create({ data: { email: 'vechi@example.com', phone: '0700000000', childName: 'Copil Vechi', childBirthDate: '2015-01-01', parentName: 'Părinte Vechi', shirtSize: 'M', status: 'Confirmat', season: '2025-2026', level: 'Incepatori', howHeard: 'Prieteni', clubInterest: true, regulationsAgreement: true, privacyConsent: true, registrationNumber: '2025-0087', submittedAt: '2025-09-14T15:02:00.000Z' } });
  await d(R).create({ data: { email: 'fara@example.com', phone: '0700000001', childName: 'Fără Sezon', childBirthDate: '2016-02-02', parentName: 'P', shirtSize: 'S', status: 'Nou', submittedAt: '2024-09-01T10:00:00.000Z' } });
  await d(R).create({ data: { email: 'parinte@exemplu.ro', phone: '0722111222', parentName: 'Mihaela Dumitrescu', relationship: 'parinte', childName: 'Maria Dumitrescu', childBirthDate: '14.03.2014', childHeight: 142, shirtSize: 'S', lastSeason: 'Începători', priorExperience: 'Nimic', expectations: 'Piruete', membershipAnswer: 'da', subscriptionChoice: { priceItemName: 'Abonament 8 ședințe grup', price: 590, member: true }, source: 'Recomandare', gdprConsent: true, regulationsConsent: true, internalNote: 'Sună după 18', status: 'Nou', season: '2026-2027', section: school.documentId, registrationNumber: '2026-0142', submittedAt: '2026-10-03T11:22:00.000Z' } });
  await d('api::sheet-link.sheet-link').create({ data: { form: 'inscrieri', spreadsheetId: 'dry-sheet', tab: 'Date', enabled: true, intervalHours: 0 } });
  const sync = require(process.cwd() + '/dist/src/sheets/sync.js');
  const client = require(process.cwd() + '/dist/src/sheets/client.js');
  const res = await sync.resyncForm('inscrieri', 'manual');
  console.log('resync', res.ok, res.added);
  for (const tab of ['2025-2026', 'fara-sezon', '2026-2027']) {
    const grid = (await client.getValues('dry-sheet', `'${tab}'!A1:AZ`)).data.map((r) => { const c = [...r]; while (c.length && c[c.length - 1] === '') c.pop(); return c; });
    console.log(tab, JSON.stringify(grid[0]));
    console.log(tab, JSON.stringify(grid[1]));
  }
  console.log('links', JSON.stringify(client._dryLinks('dry-sheet', '2026-2027')));
  const rec = await sync.reconcile('inscrieri', 'manual');
  console.log('reconcile', rec.ok, rec.added, rec.updated, rec.removed);
  await app.destroy();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
EOF
(set -a; . "$T/env"; set +a; node -e "$(cat "$T/fixture.js")") 2>&1 | grep -v 'dry-run' | tail -8
```

Expected (Strapi's startup lines above; documentIds vary):

```
resync true 3
2025-2026 ["Trimis la","Stare","Nume copil","Data nasterii","Nume parinte","Email","Telefon","Nivel","Marime tricou","Cum a aflat","Interes club","Acord regulament","Acord confidentialitate","Experienta anterioara","Asteptari","Nota interna","ID"]
2025-2026 ["14.09.2025 18:02","Confirmat","Copil Vechi","01.01.2015","Părinte Vechi","vechi@example.com","0700000000","Incepatori","M","Prieteni","Da","Da","Da","","","","<documentId>"]
fara-sezon ["Trimis la","Stare","Nume copil","Data nasterii","Nume parinte","Email","Telefon","Nivel","Marime tricou","Cum a aflat","Interes club","Acord regulament","Acord confidentialitate","Experienta anterioara","Asteptari","Nota interna","ID"]
fara-sezon ["01.09.2024 13:00","Nou","Fără Sezon","02.02.2016","P","fara@example.com","0700000001","","S","","Nu","Nu","Nu","","","","<documentId>"]
2026-2027 ["Nr. înscriere","Trimis la","Stare","Școală","Adresă de e-mail","Persoana care completează","Calitatea față de sportiv","Altă calitate","Telefon de contact","Numele copilului","Data nașterii","Înălțimea (cm)","Măsura bluză","Sezonul trecut","Nivel de experiență","Așteptări","Membru A.C.S.","La primul modul","De unde ați aflat","Altă sursă","Acord GDPR","Acord Regulament","Notă internă","Document","ID"]
2026-2027 ["2026-0142","03.10.2026 14:22","Nou","Școala de Patinaj - AFI Cotroceni","parinte@exemplu.ro","Mihaela Dumitrescu","Părinte","","0722111222","Maria Dumitrescu","14.03.2014","142","S","Începători","Nimic","Piruete","Da","Abonament 8 ședințe grup","Recomandare","","Da","Da","Sună după 18","Deschide documentul","<documentId>"]
links {"X2":"http://127.0.0.1:1349/admin/plugins/edusport-inscrieri?q=2026-0142&season=all"}
reconcile true 0 0 0
```

- [ ] **Step 3: The list search over HTTP**

```bash
(set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi admin:create-user --firstname=Test --lastname=Admin \
  --email=admin@example.com --password='Parola-Test-2026')
(set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi start > "$T/strapi.log" 2>&1 & echo $! > "$T/pid")
until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1349/_health | grep -q 204; do sleep 2; done
TOKEN=$(curl -s -X POST http://127.0.0.1:1349/admin/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Parola-Test-2026"}' | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>console.log(JSON.parse(s).data.token))')
list() { curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:1349/api/forms/inscrieri?$1" | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{const b=JSON.parse(s);console.log(b.pagination.total,b.data.map((r)=>r.registrationNumber+" "+r.childName).join(","))})'; }
list 'q=2026-0142&season=all'
list 'q=Copil&season=all'
```

Expected: `Successfully created new admin`, then `1 2026-0142 Maria Dumitrescu` and `1 2025-0087 Copil Vechi`.

- [ ] **Step 4: The Document link in a browser**

The frontend repo has Playwright with Chromium installed; this script uses it from there.

```bash
cat > "$T/deeplink.cjs" <<'EOF'
const { chromium } = require('/Users/codrin/Documents/Programming/edusport_frontend/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('http://127.0.0.1:1349/admin/auth/login');
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'Parola-Test-2026');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin(?!\/auth)/, { timeout: 30000 });
  await page.goto('http://127.0.0.1:1349/admin/plugins/edusport-inscrieri?q=2026-0142&season=all');
  await page.waitForTimeout(4000);
  const search = await page.locator('input[type="search"], input[placeholder*="Caut"]').first().inputValue().catch(() => 'n/a');
  const body = await page.locator('body').innerText();
  console.log('search box:', search);
  console.log('has Maria:', body.includes('Maria Dumitrescu'), 'has Copil Vechi:', body.includes('Copil Vechi'));
  await page.screenshot({ path: __dirname + '/deeplink.png' });
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto('http://127.0.0.1:1349/admin/plugins/edusport-inscrieri?q=2026-0142&season=all');
  await p2.waitForTimeout(3000);
  console.log('logged-out url:', p2.url());
  await p2.fill('input[name="email"]', 'admin@example.com');
  await p2.fill('input[name="password"]', 'Parola-Test-2026');
  await p2.click('button[type="submit"]');
  await p2.waitForTimeout(5000);
  console.log('after login url:', p2.url());
  const body2 = await p2.locator('body').innerText();
  console.log('after login has Maria:', body2.includes('Maria Dumitrescu'), 'has Copil Vechi:', body2.includes('Copil Vechi'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
EOF
node "$T/deeplink.cjs"
kill "$(cat "$T/pid")"
```

Expected:

```
search box: 2026-0142
has Maria: true has Copil Vechi: false
logged-out url: http://127.0.0.1:1349/admin/auth/login?redirectTo=%2Fplugins%2Fedusport-inscrieri%3Fq%3D2026-0142%26season%3Dall
after login url: http://127.0.0.1:1349/admin/plugins/edusport-inscrieri?q=2026-0142&season=all
after login has Maria: true has Copil Vechi: false
```

Open `$T/deeplink.png`: Înscrieri with "2026-0142" in the search box, "Toate sezoanele", one row, and Maria Dumitrescu open in the detail panel.

- [ ] **Step 5: Clean up and final checks**

```bash
docker rm -f es2e-pg
rm -rf "${TMPDIR:-/tmp}/es2e"
npm test
npx tsc --noEmit
npx tsc -p src/admin/tsconfig.json --noEmit
```

Expected: container removed; all tests PASS; zero type errors. No commit in this task unless a check failed; a fix goes into the owning task's files with a `fix(...)` commit.

---

## Decisions applied (user, 2026-10-21)

- E1 (old-website rows in a switched tab): same columns; their old-only answers (Nivel, Cum a aflat, Interes club, the two old consents) stay in the admin. Pinned by "shows an old-form row moved into a new season..." (Task 2) and "switches a season tab to the new columns..." (Task 4).
- E2 (a new-form row moved into an old season): that tab switches too. Pinned by "switches an old season tab too..." (Task 4).
- E3 (titles): the short titles of `decisions-1-5.html`, in its order, plus Școală, Altă calitate, Altă sursă in the same style. Pinned by "follow the approved screen..." (Task 2).
- E4: "Notă internă" before Document (Task 2).
- E5: "Deschide documentul" as a rich-text link, one extra `spreadsheets.batchUpdate` per operation, tested with the dry-run spreadsheet (Task 4).

## Notes for later plans

- Deploy: set `CMS_PUBLIC_URL` (the CMS public origin, no trailing slash) in `.env.production` on the VM before deploying. Without it the Document cells stay empty; once it is set, the next reconcile fills them (the shown text changes from empty to "Deschide documentul"). If the address changes later, run a full rewrite ("Sincronizează acum"): reconcile compares shown text, not link addresses.
- Plan 2A rewrites the `inscriere` registry, so `adminFormMeta('inscriere')` changes: old custom questions drop out of the config and old built-ins that the overlay had removed are no longer reported. On the first sync after 2A, today's tabs can be rewritten once if their header carried custom-question or "(eliminata)" labels. 2E computes today's columns exactly as before; this one-time change comes from the form config.
- Plan 2B edits the Înscrieri page. Keep `initialQuery` in `SubmissionTable.tsx` and the `?q=` / `?season=` contract. If 2B adds a real address for one registration (for example `?id=<documentId>`), only `registrationAdminUrl` in `src/sheets/admin-link.ts` changes.
- Plan 2F: the approved screen shows an "E-mail" status column after Document. It is not in 2E; it fits as a `SCRIPT_FORM_TAIL` column once the e-mail job status can be read per registration.
- The CSV export (`buildInscrieriMatrix`) still uses today's columns over all rows, so new registrations export without their new answers. Spec 4.3 covers the Sheet only; a later change can build the CSV from `inscrieriTabPlans` per season.
- `CMS_PUBLIC_URL` is the shared variable for the CMS origin; plan 2F uses it too, through `cmsPublicUrl()` from `src/sheets/admin-link.ts`.
- `appendValues` in `src/sheets/client.ts` now resolves to `{ appended, startRow }`; any other caller keeps working (it only gains a field).

## Self-review (done while writing)

- Spec 4.3 and DECISIONS 2026-10-05 point 1 (column plan per tab, not across all rows): Task 2 (`inscrieriTabPlans`), Task 3 (`resolveTabPlans`), Task 4 (every read, write and check per tab).
- 2026-2027 columns (Nr. înscriere, Școală, the new questions in the script form's order under the approved screen's short titles, Acord GDPR, Acord Regulament, Notă internă, Document): Task 2 tests, Task 5 Step 2.
- "Membru A.C.S." kept and Da/Nu printing: Task 2 tests.
- Document opens the registration in the admin, shown as "Deschide documentul": Task 1 (search and URL contract), Task 2 (`registrationAdminUrl`), Task 4 (rich-text links, dry-run assertions after every kind of write), Task 5 Steps 2 to 4.
- Older tabs untouched: Task 2 characterization test, Task 4 ("switches a season tab..." compares 2025-2026 before and after), Task 5 Step 2.
- Queue, debounce, idempotent resync and reconcile kept: `queue.ts` unchanged; Task 4 tests drive the queue's `flush`, and reconcile after resync reports `+0 ~0 -0`; a single-tab form (Voluntari) is covered too.
- Spec test "per-tab Sheet columns": Tasks 2 and 4.
- Placeholders: none; every code step has its full code. Names checked across tasks: `TabPlans.forTab`, `inscrieriTabPlans`, `resolveTabPlans`, `fetchByIds`, `ID_LABEL`, `registrationAdminUrl`, `cmsPublicUrl`, `quickSearchClause`, `initialQuery`, `LINK_TEXT`, `linkRequests`, `LinkCell`, `firstRowOf`, `_dryLinks`, `queueLinks`, `sendLinks`.
- Stage checks: Tasks 2 and 3 type-check and pass with the code before Task 4 (observed); Task 4's tests fail before it (observed: 12).
