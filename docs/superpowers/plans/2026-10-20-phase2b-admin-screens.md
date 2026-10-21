# Phase 2B: Admin Screens (Prețuri, Sezoane, Setări site, Înscrieri) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin Prețuri page on the club price lists, add a Sezoane page, trim Setări site to "Înscrieri deschise", drop the EditorCard band, and extend the Înscrieri panel with the new answers, the PDFs, the e-mail status and "Formulare goale", with admin API routes that block duplicate item names and write a history entry for every change.

**Architecture:** Rules live in `src/club/` as small TypeScript modules with Vitest tests: pure input checks and edits (`price-admin.ts`, `season-admin.ts`, `registration-panel.ts`), actions written against a small storage interface (`PriceStore`, `SeasonStore`) so they are tested with in-memory fakes, and thin Strapi adapters (`*-store.ts`). Two thin controllers (`api/club/controllers/prices.ts`, `seasons.ts`) serve `global::is-admin` routes; every answer is the whole page data, so the React pages just replace their state. The admin pages use the real `src/admin/ui` components; the admin bundle has no test runner, so its code is checked with the admin `tsc`, static source tests and a browser pass on a throwaway Strapi (Task 11).

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS, `strict: false` on the server, `strict: true` in `src/admin`), React 18 admin pages on `src/admin/ui`, Postgres in production, Vitest 3, Node 22.

**Validated:** every file in this plan was applied to a scratch copy of the repo on 2026-10-20 on top of plan 2A's Tasks 1-3 (schemas, form options, price rules): Vitest 159 tests passed, `npx tsc --noEmit` and `npx tsc --noEmit -p src/admin/tsconfig.json` had zero errors, `strapi build` built the admin, and the Task 11 checks below ran on a throwaway Postgres with Strapi on 1339 (container removed). Revised 2026-10-21 with the user's and the controller's rulings (Sezoane pinned, panel edits, delete text) and the cross-plan review (search placeholder, no middle dot, resend toast by status), and re-checked the same way. The 2F code did not exist yet, so the panel showed "Niciun e-mail". Task 10 was re-validated on 2026-10-21 on a scratch copy with plan 2A and the committed plan 2D applied from their plan files (pdfkit and the fonts installed): 348 tests passed (1 skipped), both type-checks clean, and Task 11 Step 5 on Postgres gave exactly the outputs listed there, with real PDFs rebuilt.

**Spec:** `docs/superpowers/specs/2026-10-19-registration-rebuild-design.md`, section 2 (and 1.4, 1.6, 4.1, 4.2 for what the screens show). Decisions log: `../edusport_frontend/docs/portal/DECISIONS.md` (dated decisions win: 2026-10-19 phase2-designs-v1, 2026-10-20 phase2-q4-gold). Approved designs (companion): `.superpowers/brainstorm/80180-1792422211/content/phase2-designs-v1.html` (option A for Prețuri and for Sezon), `phase2-card-band.html` (option A, remove the band everywhere). Shared brief for 2B-2F: contract names below are fixed.

**Builds on plan 2A** (`docs/superpowers/plans/2026-10-19-phase2a-registration-data.md`), assumed merged: `club.price-item.tooltip`, `section.priceNotes`, the registration fields (`relationship`, `childHeight`, `membershipAnswer`, `subscriptionChoice`, ...), `src/club/narrow.ts`, `src/club/price-item.ts` (`isIncomplete`, `isPrice`, `isPriceItemKind`, `duplicateItemNames`, `PriceItemKind`), `src/club/registration-form-options.ts`, and `recordHistory` from `src/club/history.ts` (phase 1).

**Also after plan 2E (Tasks 9 and 10)** (`docs/superpowers/plans/2026-10-20-phase2e-sheet.md`): 2E's edits to `src/admin/dashboard/SubmissionTable.tsx` (`initialQuery`, before `SubmissionTablePage` and in the "server query state" lines) and to `src/api/registration-submission/controllers/registration-submission.ts` (the quick-search block of `buildListFilters`, which then also matches the registration number) come first. 2B's anchors in those files (`MenuButton`, the end of `SubmissionTableCfg` and its `texts` comment, `statActions`; the imports under 2D's, `EDITABLE_FIELDS`, `updateSubmission`) don't overlap them. Task 10 also comes after plan 2D.

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, branch `feat/registration-rebuild`: Strapi 5, TypeScript in `src/`, single quotes in `src/`.
- Functions < 30 lines, cyclomatic complexity < 10, no `any` (`UID.ContentType` for UIDs). Existing functions already over the limit (`SubmissionTablePage`, `SetariSitePage`) are edited in place, not refactored here.
- Tests: Vitest via `npm test`, plus `npx tsc --noEmit` with zero errors, after every task. Admin tasks also run `npx tsc --noEmit -p src/admin/tsconfig.json` (zero errors today).
- New content types (none in 2B) keep `pluginOptions.content-manager.visible: false` and `createCoreRouter(..., { only: [] })`. Admin routes use `global::is-admin` (`{ auth: false, policies: ['global::is-admin'], middlewares: [] }`).
- Admin UI uses the real components in `src/admin/ui` (PageHeader, EditorCard, Field, Tabs, Drawer, DataTable, Switch, Notice, Toast, ...). No invented markup.
- Copy rules for user-visible text: no em dash, no middle dot, no emoji; terse; no rounded pills or circles; no dashed or dotted lines; UI copy in Romanian, code and docs in English; never pad the client's own wording. Romanian ș and ț with the comma below.
- "Opțional" appears only as a field hint, never as placeholder text (DECISIONS 2026-10-19). The new forms have no placeholders.
- SaveBar tagger (`src/admin/app.tsx`, `tagDefaultSaveAndPreview`): any `<button>` named "Salvează"/"Publică" outside `.pce` or `.ui-root` is shrunk to 1px. Every new button sits inside `AdminPage`, a `Drawer` or a `Modal`/`ConfirmDialog` (all carry `.ui-root`), so the tagger skips them. Never render such a button elsewhere. Task 11 checks that nothing on the new pages is tagged.
- The admin bundle may import from `src/club/`: types freely; at runtime only modules without Node or Strapi imports (`season-admin.ts`, `registration-panel.ts` and what they import). Verified by `strapi build`.
- Nothing is deleted from the database (spec 1.6): `pricing` and the season keys of `site-settings.registration` stay; only their editors go.
- Commits: Conventional Commits, no AI attribution, no `Co-Authored-By`. Never push. Never run anything against production, the user's local database (container `strapi_db`) or the running `strapi_app` container.
- Boot checks use a throwaway Postgres container on a free port, Strapi on 1338 or higher (1337 is taken); remove the container afterwards. A schema change needs a Strapi restart. After schema changes run `DATABASE_CLIENT=postgres npx strapi ts:generate-types` and commit `types/generated/` in that task.

## Review Focus

- Two admins (or two tabs) edit the same price list: a row is addressed by its place plus the name the admin saw there; a mismatch is refused with "Lista s-a schimbat între timp. Reîncarcă pagina." and nothing is written (Task 2 tests `applyItemEdit` and `editPriceItem`).
- A price name typed again with other case, spaces or diacritics in another list of the same school is refused; the same name in another section is allowed; changing only the price of an item never trips the check (Task 2 tests).
- Renaming a season that registrations already point at (by `seasonRef` or by the old `season` text) would break the Înscrieri season filter and the numbering year: refused with "Sezonul are înscrieri, numele lui nu se mai schimbă." (Task 3 tests; Task 11 on Postgres).
- Saving Setări site after the season fields are gone must keep `currentSeason`, `seasonStartDate`, `seasonEndDate` in the stored JSON (Task 6 keeps the merge; Task 11 saves the page and reads the row).
- An item with both prices empty is saved, shows "Preț incomplet" and two "Lipsă" badges, and is hidden from the site by 2A; one missing price shows "-" (Task 2 `buildAdminPrices` test; Task 11 browser pass).

---

## File Structure

```
src/club/
  admin-result.ts            AdminResult<T>, refuse, FieldChange, changedFields (Task 1)
  admin-http.ts              AdminCtx, respond, refuseWith, indexParam (Task 1)
  admin-actor.ts             adminActor: admin e-mail from the admin JWT, for history (Task 1)
  price-admin.ts             Prețuri input checks, item edits, name clash, page data (Task 2)
  price-admin-service.ts     PriceStore, loadAdminPrices, editPriceItem, createPriceList, savePriceNotes (Task 2)
  price-admin-store.ts       strapiPriceStore(strapi) (Task 2)
  season-admin.ts            Sezoane input checks, months, write data, drafts (Task 3; also used by the admin page)
  season-admin-service.ts    SeasonStore, listAdminSeasons, createSeason, updateSeason (Task 3)
  season-admin-store.ts      strapiSeasonStore(strapi) (Task 3)
  registration-panel.ts      Înscrieri panel rows, document kinds, e-mail status text (Task 9, edit markers Task 10; used by the admin page)
  registration-edit.ts       panel edits of Calitate / Membru A.C.S. and the "Document refăcut" entry (Task 10)
src/api/club/
  controllers/prices.ts, controllers/seasons.ts, routes/03-admin-prices-seasons.ts (Task 4)
src/admin/
  ui/styles.ts, ui/EditorCard.tsx, ui/Drawer.tsx (Task 5)
  pages/SetariSitePage.tsx (Task 6)
  pages/PreturiPage.tsx, pages/preturi/* (Task 7)
  pages/SezoanePage.tsx, pages/sezoane/*, pages/routes.ts, dashboard/menu.tsx, dashboard/EdusportShell.tsx (Task 8)
  dashboard/InscrieriPage.tsx, dashboard/SubmissionTable.tsx, dashboard/inscrieri/* (Task 9; EditableAnswer.tsx Task 10)
src/plugins/component-preview/admin/src/
  SiteSettingsRegistrationEditor.tsx, index.ts; PricingTiersEditor.tsx deleted (Task 6)
src/api/pricing/content-types/pricing/schema.json (Task 6)
src/api/registration-submission/controllers/registration-submission.ts (Task 10, on top of plan 2D)
docs/admin-ui/CUSTOM-PAGES.md (Task 8)
```

## Tasks and parallel groups

| Group | Tasks | Runs after |
|---|---|---|
| A | 1 Admin request helpers, 5 Card band and drawer section, 6 Setări site and retired editors, 9 Înscrieri panel | plan 2A (Task 9 also after plan 2E); all four in parallel (separate files) |
| B | 2 Price list actions, 3 Season actions | Task 1; both in parallel |
| C | 4 Admin API routes | Tasks 2 and 3 |
| D | 7 Prețuri page, 8 Sezoane page | Tasks 4 and 5; both in parallel |
| E | 10 Panel edits and Document refăcut | Task 9, plan 2D and plan 2E |
| F | 11 Boot check and browser pass | everything (and, for the PDF and e-mail buttons, plans 2D and 2F if merged) |

---

### Task 1: Admin request helpers

**Files:**
- Create: `src/club/admin-result.ts`, `src/club/admin-http.ts`, `src/club/admin-actor.ts`
- Test: `src/club/__tests__/admin-actor.test.ts` (the HTTP helpers are tested with the routes in Task 4)

**Interfaces:**
- Consumes: `jsonwebtoken` (installed with Strapi; `@types/jsonwebtoken` present), the admin JWT secret `admin.auth.secret`, the `admin::user` table. Same checks as `src/policies/is-admin.ts` and `actingAdminEmail` in `src/api/sheet-link/controllers/sheet-link.ts`.
- Produces:
  - `type AdminResult<T> = { ok: true; data: T } | { ok: false; status: 400 | 404 | 409; error: string }`, `refuse(status, error): AdminResult<never>`
  - `type FieldChange = { from: unknown; to: unknown }`, `changedFields<T extends object>(keys: readonly (keyof T)[], before: T | null, after: T | null): Record<string, FieldChange>`
  - `type AdminCtx` (params, query, request.body, request.header.authorization, status, body), `respond<T>(ctx, result: AdminResult<T>): void` (200 `{ data }` or Strapi's error shape `{ data: null, error: { status, name: 'ClubAdminError', message } }`), `refuseWith(ctx, status, message): void`, `indexParam(raw: string | undefined): number | null`
  - `type ActorStrapi`, `UNKNOWN_ACTOR = 'admin'`, `adminActor(authorization: string | undefined, strapi: ActorStrapi): Promise<string>` (the admin's e-mail; never throws). Stable export, consumed by plan 2F (its resend history entry) and by Task 10; do not rename or change its signature.

Why the error shape: the admin fetch client (`@strapi/admin` `getFetchClient`) throws a `FetchError` whose `message` is `error.message` of the JSON body, and `useSaveState().run` shows that message in a toast. So a refusal written here reaches the admin word for word.

Why on narrowing: the server compiles with `strict: false`, where `if (!result.ok)` does not narrow a union; the code tests `result.ok === true` / `=== false`.

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/admin-actor.test.ts`:

```ts
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { UNKNOWN_ACTOR, adminActor, type ActorStrapi } from '../admin-actor';

const SECRET = 'test-secret';

function fakeStrapi(user: unknown = { email: 'ana@club.ro' }) {
  const findOne = vi.fn().mockResolvedValue(user);
  const strapi: ActorStrapi = {
    config: { get: (key: string) => (key === 'admin.auth.secret' ? SECRET : undefined) },
    db: { query: () => ({ findOne }) },
  };
  return { strapi, findOne };
}

const bearer = (payload: object, secret = SECRET) => `Bearer ${jwt.sign(payload, secret)}`;

describe('adminActor', () => {
  it("returns the admin's e-mail from the token's userId", async () => {
    const { strapi, findOne } = fakeStrapi();
    await expect(adminActor(bearer({ userId: 7 }), strapi)).resolves.toBe('ana@club.ro');
    expect(findOne).toHaveBeenCalledWith({ where: { id: 7 }, select: ['email'] });
  });

  it('falls back when there is no token, a wrong signature or no such admin', async () => {
    await expect(adminActor(undefined, fakeStrapi().strapi)).resolves.toBe(UNKNOWN_ACTOR);
    await expect(adminActor(bearer({ userId: 7 }, 'other'), fakeStrapi().strapi)).resolves.toBe(UNKNOWN_ACTOR);
    await expect(adminActor(bearer({ userId: 7 }), fakeStrapi(null).strapi)).resolves.toBe(UNKNOWN_ACTOR);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- src/club/__tests__/admin-actor.test.ts`
Expected: FAIL (`Cannot find module '../admin-actor'`).

- [ ] **Step 3: Implement**

`src/club/admin-result.ts`:

```ts
/** Answer of an admin action: the fresh data, or a refusal whose `status` becomes the HTTP status. */
export type AdminResult<T> = { ok: true; data: T } | { ok: false; status: 400 | 404 | 409; error: string };

export const refuse = (status: 400 | 404 | 409, error: string): AdminResult<never> => ({ ok: false, status, error });

/** One edited field in a history entry: old value -> new value. */
export type FieldChange = { from: unknown; to: unknown };

/** The fields whose value differs, old -> new; a missing side counts as null. */
export function changedFields<T extends object>(keys: readonly (keyof T)[], before: T | null, after: T | null): Record<string, FieldChange> {
  const out: Record<string, FieldChange> = {};
  for (const key of keys) {
    const from = before ? before[key] : null;
    const to = after ? after[key] : null;
    if (from !== to) out[String(key)] = { from, to };
  }
  return out;
}
```

`src/club/admin-http.ts`:

```ts
import type { AdminResult } from './admin-result';

/** The part of Strapi's Koa context the club admin controllers use. */
export type AdminCtx = {
  params: Record<string, string | undefined>;
  query: Record<string, unknown>;
  request: { body?: unknown; header: { authorization?: string } };
  status: number;
  body: unknown;
};

/** 200 `{ data }`, or the refusal in Strapi's error shape, which the admin fetch client turns into the message. */
export function respond<T>(ctx: AdminCtx, result: AdminResult<T>): void {
  if (result.ok === true) {
    ctx.body = { data: result.data };
    return;
  }
  refuseWith(ctx, result.status, result.error);
}

export function refuseWith(ctx: AdminCtx, status: number, message: string): void {
  ctx.status = status;
  ctx.body = { data: null, error: { status, name: 'ClubAdminError', message } };
}

/** A path segment that must be a whole number (an item's place in its list). */
export function indexParam(raw: string | undefined): number | null {
  return raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : null;
}
```

`src/club/admin-actor.ts`:

```ts
import jwt from 'jsonwebtoken';

/** The parts of Strapi the actor lookup needs; `Core.Strapi` satisfies it. */
export type ActorStrapi = {
  config: { get: (key: string) => unknown };
  db: { query: (uid: 'admin::user') => { findOne: (args: { where: { id: unknown }; select: string[] }) => Promise<unknown> } };
};

/** Written on history entries when the admin cannot be identified (the route policy already checked the token). */
export const UNKNOWN_ACTOR = 'admin';

function adminIdFrom(authorization: string | undefined, secret: unknown): unknown {
  if (!authorization?.startsWith('Bearer ') || typeof secret !== 'string' || !secret) return null;
  const payload = jwt.verify(authorization.slice(7), secret);
  if (!payload || typeof payload !== 'object') return null;
  return payload.userId ?? payload.id ?? payload.sub ?? null;
}

/**
 * Who makes an admin request, for history entries: the admin's e-mail, read from the admin JWT
 * the same way `global::is-admin` checks it. Never throws.
 */
export async function adminActor(authorization: string | undefined, strapi: ActorStrapi): Promise<string> {
  try {
    const id = adminIdFrom(authorization, strapi.config.get('admin.auth.secret'));
    if (id === null || id === undefined) return UNKNOWN_ACTOR;
    const user = await strapi.db.query('admin::user').findOne({ where: { id }, select: ['email'] });
    const email = user && typeof user === 'object' ? (user as { email?: unknown }).email : null;
    return typeof email === 'string' && email ? email : UNKNOWN_ACTOR;
  } catch {
    return UNKNOWN_ACTOR;
  }
}
```

- [ ] **Step 4: Run the test and type-check**

Run: `npm test -- src/club/__tests__/admin-actor.test.ts` (PASS), then `npm test` (all PASS) and `npx tsc --noEmit` (zero errors).

- [ ] **Step 5: Commit**

```bash
git add src/club/admin-result.ts src/club/admin-http.ts src/club/admin-actor.ts src/club/__tests__/admin-actor.test.ts
git commit -m "feat(club): admin request helpers and the acting admin for history"
```

---

### Task 2: Price list rules and actions

**Files:**
- Create: `src/club/price-admin.ts`, `src/club/price-admin-service.ts`, `src/club/price-admin-store.ts`
- Test: `src/club/__tests__/price-admin.test.ts`, `src/club/__tests__/price-admin-service.test.ts`

**Interfaces:**
- Consumes: Task 1 (`changedFields`, `FieldChange`, `refuse`, `AdminResult`); 2A (`asText`, `asTextList` from `narrow.ts`; `duplicateItemNames`, `isIncomplete`, `isPrice`, `isPriceItemKind`, `PriceItemKind` from `price-item.ts`); phase 1 (`nameKey` from `migrate/names.ts`, `recordHistory` and `HistoryInput` from `history.ts`).
- Produces (`src/club/price-admin.ts`):
  - `type PriceItemFields = { name; kind: PriceItemKind; sessions: number | null; memberPrice: number | null; nonMemberPrice: number | null; tooltip: string | null }`, `type PriceItemData = PriceItemFields & { included: boolean }`
  - `type AdminPriceItem = PriceItemFields & { incomplete: boolean }`, `type AdminPriceList = { documentId; name; sectionId: string | null; items: AdminPriceItem[] }`, `type AdminSection = { documentId; name; kind: 'school' | 'club'; priceNotes: string[] }`, `type AdminPrices = { sections: AdminSection[]; lists: AdminPriceList[] }`
  - `type ItemEdit = { kind: 'add'; item } | { kind: 'update'; index; expectedName; item } | { kind: 'remove'; index; expectedName }`
  - `PRICE_ERRORS`, `duplicateNameError(name)`, `readPriceItemInput(raw)`, `toItemFields(raw)`, `toItemData(items)`, `applyItemEdit(items, edit)`, `nameClash(sectionLists, name)`, `fieldChanges(before, after)`, `buildAdminPrices(sections, lists)`, `readPriceNotes(raw): string[] | null`, `readNewListInput(raw)`
- Produces (`src/club/price-admin-service.ts`): `interface PriceStore`, `loadAdminPrices(store)`, `editPriceItem(store, listId, edit, actor)`, `createPriceList(store, name, sectionId, actor)`, `savePriceNotes(store, sectionId, priceNotes, actor)`, each resolving `AdminResult<AdminPrices>` (or `AdminPrices` for the load).
- Produces (`src/club/price-admin-store.ts`): `strapiPriceStore(strapi: Core.Strapi): PriceStore`.

Rules:
- An item needs a name and a kind; sessions are a whole number >= 0 or empty; each price is a number >= 0 or empty. Both prices empty is allowed (spec 1.4, DECISIONS 2026-10-20): the item is saved and flagged `incomplete`; 2A hides it on the site and in the form.
- Names must be unique across one section's lists (case, spaces and diacritics ignored, 2A's `duplicateItemNames`). The check runs only when an item is added or renamed, so an item that already shares a name with an older one can still get a new price.
- A row is addressed by its place in the list plus the name the admin opened (`expectedName`). If the row at that place has another name, the list changed meanwhile: 409, nothing written.
- Items are written back whole (`PriceItemData`, with `included` kept), without the component row `id`; Strapi recreates the component rows.
- History (spec 2): `subjectType: 'price-list'` with actions `price-added`, `price-updated`, `price-removed`, `created`; `subjectType: 'section'` with `price-notes-updated`. `changes` holds `item` (the name) and every changed field as `{ from, to }` (null on the side that does not exist).
- List names are unique in the schema (`price-list.name` `unique: true`); the store checks case-insensitively first so the admin gets a clear message.

- [ ] **Step 1: Write the failing tests**

`src/club/__tests__/price-admin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  PRICE_ERRORS,
  applyItemEdit,
  buildAdminPrices,
  fieldChanges,
  nameClash,
  readNewListInput,
  readPriceItemInput,
  readPriceNotes,
  toItemData,
  type PriceItemData,
} from '../price-admin';

const sub6: PriceItemData = { name: 'Abonament 6 ședințe grup', kind: 'subscription', sessions: 6, memberPrice: 520, nonMemberPrice: 720, tooltip: null, included: false };
const single: PriceItemData = { name: '1 ședință grup', kind: 'session', sessions: 1, memberPrice: null, nonMemberPrice: 150, tooltip: 'Disponibil doar pentru prima ședință', included: false };
const { included: _i, ...sub6Fields } = sub6;

describe('readPriceItemInput', () => {
  it('accepts a full item and trims texts', () => {
    expect(readPriceItemInput({ ...sub6Fields, name: '  Abonament 6 ședințe grup ', tooltip: '  ' })).toEqual({ ok: true, item: sub6Fields });
  });

  it('accepts one missing price, and both missing (saved, then flagged incomplete)', () => {
    expect(readPriceItemInput({ name: 'Gold', kind: 'subscription', memberPrice: null, nonMemberPrice: null })).toMatchObject({ ok: true });
  });

  it('refuses a missing name or kind, a bad count and a negative or text price', () => {
    expect(readPriceItemInput({ kind: 'session' })).toEqual({ ok: false, error: PRICE_ERRORS.name });
    expect(readPriceItemInput({ name: 'X', kind: 'abonament' })).toEqual({ ok: false, error: PRICE_ERRORS.kind });
    expect(readPriceItemInput({ name: 'X', kind: 'session', sessions: 1.5 })).toEqual({ ok: false, error: PRICE_ERRORS.sessions });
    expect(readPriceItemInput({ name: 'X', kind: 'session', memberPrice: -1 })).toEqual({ ok: false, error: PRICE_ERRORS.price });
    expect(readPriceItemInput({ name: 'X', kind: 'session', nonMemberPrice: '150' })).toEqual({ ok: false, error: PRICE_ERRORS.price });
    expect(readPriceItemInput(null)).toEqual({ ok: false, error: PRICE_ERRORS.name });
  });
});

describe('toItemData', () => {
  it('keeps every stored field except the component row id', () => {
    expect(toItemData([{ id: 3, ...sub6, included: true }])).toEqual([{ ...sub6, included: true }]);
    expect(toItemData(null)).toEqual([]);
  });
});

describe('applyItemEdit', () => {
  const items = [sub6, single];

  it('adds at the end', () => {
    const r = applyItemEdit(items, { kind: 'add', item: { ...sub6Fields, name: 'Abonament 8' } });
    expect(r).toMatchObject({ ok: true, before: null, after: { name: 'Abonament 8', included: false } });
    expect(r.ok && r.items).toHaveLength(3);
  });

  it('updates the row it was opened on, keeping fields the drawer does not edit', () => {
    const r = applyItemEdit([{ ...sub6, included: true }, single], { kind: 'update', index: 0, expectedName: sub6.name, item: { ...sub6Fields, memberPrice: 540 } });
    expect(r).toMatchObject({ ok: true, before: { memberPrice: 520 }, after: { memberPrice: 540, included: true } });
  });

  it('removes the row', () => {
    const r = applyItemEdit(items, { kind: 'remove', index: 1, expectedName: single.name });
    expect(r).toEqual({ ok: true, items: [sub6], before: single, after: null });
  });

  it('refuses when the row at that place is not the one the admin opened', () => {
    expect(applyItemEdit(items, { kind: 'remove', index: 0, expectedName: single.name })).toEqual({ ok: false, error: PRICE_ERRORS.stale });
    expect(applyItemEdit(items, { kind: 'remove', index: 5, expectedName: single.name })).toEqual({ ok: false, error: PRICE_ERRORS.stale });
  });
});

describe('nameClash', () => {
  it("finds the name in another list of the section, ignoring case and diacritics", () => {
    const lists = [{ items: [sub6] }, { items: [{ name: 'abonament 6 sedinte grup' }] }];
    expect(nameClash(lists, 'Abonament 6 ședințe grup')).toBe(true);
    expect(nameClash([{ items: [sub6, single] }], '1 ședință grup')).toBe(false);
  });
});

describe('fieldChanges', () => {
  it('lists only what changed, old -> new', () => {
    expect(fieldChanges(sub6, { ...sub6, memberPrice: 540, tooltip: 'x' })).toEqual({
      memberPrice: { from: 520, to: 540 },
      tooltip: { from: null, to: 'x' },
    });
  });

  it('a new or removed price shows every field against null', () => {
    expect(fieldChanges(null, single)).toMatchObject({ name: { from: null, to: '1 ședință grup' }, nonMemberPrice: { from: null, to: 150 } });
    expect(fieldChanges(single, null)).toMatchObject({ name: { from: '1 ședință grup', to: null } });
  });
});

describe('buildAdminPrices', () => {
  it('orders sections, keeps list order and flags incomplete prices', () => {
    const r = buildAdminPrices(
      [
        { documentId: 'c', name: 'Club', kind: 'club', order: 2 },
        { documentId: 's', name: 'Școala de patinaj', kind: 'school', order: 1, priceNotes: ['Nota 1', ''] },
      ],
      [
        { documentId: 'l1', name: 'Standard', section: { documentId: 's' }, items: [sub6] },
        { documentId: 'l2', name: 'Avansați Gold', section: null, items: [{ name: 'Gold 8', kind: 'subscription' }] },
      ],
    );
    expect(r.sections.map((s) => [s.documentId, s.kind, s.priceNotes])).toEqual([
      ['s', 'school', ['Nota 1']],
      ['c', 'club', []],
    ]);
    expect(r.lists.map((l) => [l.documentId, l.sectionId, l.items.map((i) => i.incomplete)])).toEqual([
      ['l1', 's', [false]],
      ['l2', null, [true]],
    ]);
    expect(r.lists[0].items[0]).not.toHaveProperty('included');
  });
});

describe('readPriceNotes and readNewListInput', () => {
  it('notes are a list of texts; blanks dropped', () => {
    expect(readPriceNotes({ priceNotes: [' A ', '', 'B'] })).toEqual(['A', 'B']);
    expect(readPriceNotes({ priceNotes: 'A' })).toBeNull();
    expect(readPriceNotes({ priceNotes: ['A', 3] })).toBeNull();
  });

  it('a new list needs a name and a section', () => {
    expect(readNewListInput({ name: ' Gold ', sectionId: 's' })).toEqual({ ok: true, name: 'Gold', sectionId: 's' });
    expect(readNewListInput({ sectionId: 's' })).toEqual({ ok: false, error: PRICE_ERRORS.listName });
    expect(readNewListInput({ name: 'Gold' })).toEqual({ ok: false, error: PRICE_ERRORS.section });
  });
});
```

`src/club/__tests__/price-admin-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { HistoryInput } from '../history';
import { PRICE_ERRORS, duplicateNameError, type PriceItemData, type RawAdminList, type RawAdminSection } from '../price-admin';
import { createPriceList, editPriceItem, savePriceNotes, type PriceStore } from '../price-admin-service';

const item = (name: string, extra: Partial<PriceItemData> = {}): PriceItemData => ({
  name,
  kind: 'subscription',
  sessions: 8,
  memberPrice: 590,
  nonMemberPrice: 790,
  tooltip: null,
  included: false,
  ...extra,
});

function fakeStore() {
  const sections: RawAdminSection[] = [
    { documentId: 's', name: 'Școala de patinaj', kind: 'school', order: 1, priceNotes: ['Veche'] },
    { documentId: 'c', name: 'Club', kind: 'club', order: 2 },
  ];
  const lists: RawAdminList[] = [
    { documentId: 'std', name: 'Standard', section: { documentId: 's' }, items: [item('Abonament 8 ședințe grup')] },
    { documentId: 'gold', name: 'Avansați Gold', section: { documentId: 's' }, items: [] },
    { documentId: 'clb', name: 'Club lunar', section: { documentId: 'c' }, items: [item('Gold 8')] },
  ];
  const history: HistoryInput[] = [];
  const saved: string[] = [];
  const store: PriceStore = {
    sections: async () => sections,
    lists: async () => lists,
    findList: async (id) => lists.find((l) => l.documentId === id) ?? null,
    findSection: async (id) => sections.find((s) => s.documentId === id) ?? null,
    listNameTaken: async (name) => lists.some((l) => String(l.name).toLowerCase() === name.toLowerCase()),
    saveItems: async (id, items) => {
      saved.push(id);
      lists.find((l) => l.documentId === id)!.items = items;
    },
    createList: async (name, sectionId) => {
      lists.push({ documentId: 'new', name, section: { documentId: sectionId }, items: [] });
      return 'new';
    },
    saveNotes: async (id, notes) => {
      sections.find((s) => s.documentId === id)!.priceNotes = notes;
    },
    record: async (entry) => {
      history.push(entry);
    },
  };
  return { store, history, saved, lists };
}

const fields = (name: string) => {
  const { included: _i, ...f } = item(name);
  return f;
};

describe('editPriceItem', () => {
  it('adds a price, records who and what, and answers with the fresh page data', async () => {
    const { store, history } = fakeStore();
    const r = await editPriceItem(store, 'gold', { kind: 'add', item: fields('Abonament Avansați Gold 8 ședințe') }, 'ana@club.ro');
    expect(r.ok && r.data.lists.find((l) => l.documentId === 'gold')?.items.map((i) => i.name)).toEqual(['Abonament Avansați Gold 8 ședințe']);
    expect(history).toEqual([
      expect.objectContaining({
        subjectType: 'price-list',
        subjectId: 'gold',
        action: 'price-added',
        actor: 'ana@club.ro',
        changes: expect.objectContaining({ item: 'Abonament Avansați Gold 8 ședințe', memberPrice: { from: null, to: 590 } }),
      }),
    ]);
  });

  it("blocks a name already used in another list of the same school, and saves nothing", async () => {
    const { store, history, saved } = fakeStore();
    const r = await editPriceItem(store, 'gold', { kind: 'add', item: fields('abonament 8 sedinte grup') }, 'ana@club.ro');
    expect(r).toEqual({ ok: false, status: 409, error: duplicateNameError('abonament 8 sedinte grup') });
    expect(saved).toEqual([]);
    expect(history).toEqual([]);
  });

  it('allows the same name in another section', async () => {
    const { store } = fakeStore();
    await expect(editPriceItem(store, 'gold', { kind: 'add', item: fields('Gold 8') }, 'a')).resolves.toMatchObject({ ok: true });
  });

  it('changing only the price of an item keeps its name without a clash', async () => {
    const { store, history } = fakeStore();
    const edit = { kind: 'update' as const, index: 0, expectedName: 'Abonament 8 ședințe grup', item: { ...fields('Abonament 8 ședințe grup'), memberPrice: 610 } };
    await expect(editPriceItem(store, 'std', edit, 'a')).resolves.toMatchObject({ ok: true });
    expect(history[0]).toMatchObject({ action: 'price-updated', changes: { item: 'Abonament 8 ședințe grup', memberPrice: { from: 590, to: 610 } } });
  });

  it('removes a price and keeps it in history', async () => {
    const { store, history } = fakeStore();
    const r = await editPriceItem(store, 'std', { kind: 'remove', index: 0, expectedName: 'Abonament 8 ședințe grup' }, 'a');
    expect(r.ok && r.data.lists.find((l) => l.documentId === 'std')?.items).toEqual([]);
    expect(history[0]).toMatchObject({ action: 'price-removed', changes: { item: 'Abonament 8 ședințe grup', name: { from: 'Abonament 8 ședințe grup', to: null } } });
  });

  it('refuses a missing list (404) and a row changed meanwhile (409)', async () => {
    const { store } = fakeStore();
    await expect(editPriceItem(store, 'nope', { kind: 'remove', index: 0, expectedName: 'x' }, 'a')).resolves.toEqual({ ok: false, status: 404, error: PRICE_ERRORS.listMissing });
    await expect(editPriceItem(store, 'std', { kind: 'remove', index: 0, expectedName: 'Alt nume' }, 'a')).resolves.toEqual({ ok: false, status: 409, error: PRICE_ERRORS.stale });
  });
});

describe('createPriceList', () => {
  it('creates an empty list in the section and records it', async () => {
    const { store, history } = fakeStore();
    const r = await createPriceList(store, 'Vară', 's', 'a');
    expect(r.ok && r.data.lists.map((l) => l.name)).toContain('Vară');
    expect(history[0]).toMatchObject({ subjectType: 'price-list', subjectId: 'new', action: 'created', changes: { name: 'Vară', sectionId: 's' } });
  });

  it('refuses an existing name and an unknown section', async () => {
    const { store } = fakeStore();
    await expect(createPriceList(store, 'standard', 's', 'a')).resolves.toEqual({ ok: false, status: 409, error: PRICE_ERRORS.listExists });
    await expect(createPriceList(store, 'Vară', 'x', 'a')).resolves.toEqual({ ok: false, status: 400, error: PRICE_ERRORS.sectionMissing });
  });
});

describe('savePriceNotes', () => {
  it('saves the paragraphs and records old -> new', async () => {
    const { store, history } = fakeStore();
    const r = await savePriceNotes(store, 's', ['Nouă'], 'a');
    expect(r.ok && r.data.sections[0].priceNotes).toEqual(['Nouă']);
    expect(history[0]).toMatchObject({ subjectType: 'section', subjectId: 's', action: 'price-notes-updated', changes: { priceNotes: { from: ['Veche'], to: ['Nouă'] } } });
  });

  it('refuses an unknown section', async () => {
    await expect(savePriceNotes(fakeStore().store, 'x', [], 'a')).resolves.toEqual({ ok: false, status: 404, error: PRICE_ERRORS.sectionMissing });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- src/club/__tests__/price-admin.test.ts src/club/__tests__/price-admin-service.test.ts`
Expected: FAIL (`Cannot find module '../price-admin'`).

- [ ] **Step 3: Implement the rules**

`src/club/price-admin.ts`:

```ts
import { changedFields, type FieldChange } from './admin-result';
import { nameKey } from './migrate/names';
import { asText, asTextList } from './narrow';
import { duplicateItemNames, isIncomplete, isPrice, isPriceItemKind, type PriceItemKind } from './price-item';

/** One price item as the Prețuri drawer edits it. */
export type PriceItemFields = {
  name: string;
  kind: PriceItemKind;
  sessions: number | null;
  memberPrice: number | null;
  nonMemberPrice: number | null;
  tooltip: string | null;
};
/** The full stored component (`club.price-item`), written back on every change. */
export type PriceItemData = PriceItemFields & { included: boolean };
export type AdminPriceItem = PriceItemFields & { incomplete: boolean };
export type AdminPriceList = { documentId: string; name: string; sectionId: string | null; items: AdminPriceItem[] };
export type AdminSection = { documentId: string; name: string; kind: 'school' | 'club'; priceNotes: string[] };
/** GET /api/club/prices and every Prețuri mutation answer with this. */
export type AdminPrices = { sections: AdminSection[]; lists: AdminPriceList[] };

export type RawAdminList = { documentId?: unknown; name?: unknown; section?: { documentId?: unknown } | null; items?: unknown };
export type RawAdminSection = { documentId?: unknown; name?: unknown; kind?: unknown; order?: unknown; priceNotes?: unknown };

export type ItemEdit =
  | { kind: 'add'; item: PriceItemFields }
  | { kind: 'update'; index: number; expectedName: string; item: PriceItemFields }
  | { kind: 'remove'; index: number; expectedName: string };
export type ItemEditResult =
  | { ok: true; items: PriceItemData[]; before: PriceItemData | null; after: PriceItemData | null }
  | { ok: false; error: string };

export const PRICE_ERRORS = {
  name: 'Numele este obligatoriu.',
  kind: 'Alege tipul.',
  sessions: 'Numărul de ședințe nu este valid.',
  price: 'Prețul nu este valid.',
  listName: 'Numele listei este obligatoriu.',
  listExists: 'Există deja o listă cu acest nume.',
  section: 'Alege secțiunea.',
  listMissing: 'Lista nu mai există.',
  sectionMissing: 'Secțiunea nu mai există.',
  stale: 'Lista s-a schimbat între timp. Reîncarcă pagina.',
  notes: 'Notițele nu sunt valide.',
} as const;

export const duplicateNameError = (name: string) => `Numele „${name}” este deja folosit în această secțiune.`;

const FIELDS = ['name', 'kind', 'sessions', 'memberPrice', 'nonMemberPrice', 'tooltip'] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isEmpty = (v: unknown) => v === null || v === undefined;
const priceOrNull = (v: unknown) => (isPrice(v) ? v : null);

function itemInputError(body: Record<string, unknown>): string | null {
  if (!asText(body.name)) return PRICE_ERRORS.name;
  if (!isPriceItemKind(body.kind)) return PRICE_ERRORS.kind;
  if (!isEmpty(body.sessions) && !isCount(body.sessions)) return PRICE_ERRORS.sessions;
  const badPrice = [body.memberPrice, body.nonMemberPrice].some((p) => !isEmpty(p) && !isPrice(p));
  return badPrice ? PRICE_ERRORS.price : null;
}

/** The drawer's body, checked: name and kind required, counts and prices non-negative or empty. */
export function readPriceItemInput(raw: unknown): { ok: true; item: PriceItemFields } | { ok: false; error: string } {
  const body = isRecord(raw) ? raw : {};
  const error = itemInputError(body);
  if (error) return { ok: false, error };
  return { ok: true, item: toItemFields(body) };
}

/** Any stored or posted item, as clean fields. */
export function toItemFields(raw: Record<string, unknown>): PriceItemFields {
  return {
    name: asText(raw.name),
    kind: isPriceItemKind(raw.kind) ? raw.kind : 'subscription',
    sessions: isCount(raw.sessions) ? raw.sessions : null,
    memberPrice: priceOrNull(raw.memberPrice),
    nonMemberPrice: priceOrNull(raw.nonMemberPrice),
    tooltip: asText(raw.tooltip) || null,
  };
}

/** Stored component rows as write-ready data (the row `id` is dropped; Strapi recreates the rows). */
export function toItemData(items: unknown): PriceItemData[] {
  if (!Array.isArray(items)) return [];
  return items.filter(isRecord).map((raw) => ({ ...toItemFields(raw), included: raw.included === true }));
}

function checkExpected(items: PriceItemData[], index: number, expectedName: string): PriceItemData | null {
  const current = items[index];
  return current && current.name === expectedName.trim() ? current : null;
}

/** Applies one drawer action to a list's items; refuses when the row changed since the page loaded. */
export function applyItemEdit(items: PriceItemData[], edit: ItemEdit): ItemEditResult {
  if (edit.kind === 'add') {
    const after = { ...edit.item, included: false };
    return { ok: true, items: [...items, after], before: null, after };
  }
  const before = checkExpected(items, edit.index, edit.expectedName);
  if (!before) return { ok: false, error: PRICE_ERRORS.stale };
  if (edit.kind === 'remove') return { ok: true, items: items.filter((_, i) => i !== edit.index), before, after: null };
  const after = { ...before, ...edit.item };
  return { ok: true, items: items.map((it, i) => (i === edit.index ? after : it)), before, after };
}

/** True when `name` would appear twice across one section's lists (case, spaces and diacritics ignored). */
export function nameClash(sectionLists: { items?: { name?: unknown }[] | null }[], name: string): boolean {
  return duplicateItemNames(sectionLists).some((d) => nameKey(d) === nameKey(name));
}

/** History payload: every edited field with its old and new value (null for a side that does not exist). */
export function fieldChanges(before: PriceItemFields | null, after: PriceItemFields | null): Record<string, FieldChange> {
  return changedFields<PriceItemFields>(FIELDS, before, after);
}

function toAdminSection(raw: RawAdminSection): AdminSection | null {
  const name = asText(raw.name);
  if (typeof raw.documentId !== 'string' || !name) return null;
  return { documentId: raw.documentId, name, kind: raw.kind === 'club' ? 'club' : 'school', priceNotes: asTextList(raw.priceNotes) };
}

function toAdminList(raw: RawAdminList): AdminPriceList | null {
  if (typeof raw.documentId !== 'string') return null;
  const sectionId = typeof raw.section?.documentId === 'string' ? raw.section.documentId : null;
  const items = toItemData(raw.items).map(({ included: _included, ...f }) => ({ ...f, incomplete: isIncomplete(f) }));
  return { documentId: raw.documentId, name: asText(raw.name), sectionId, items };
}

const rank = (s: RawAdminSection) => (typeof s.order === 'number' ? s.order : Number.MAX_SAFE_INTEGER);

/** Sections by `order`, then name; lists in the order given (the loader sorts them by creation). */
export function buildAdminPrices(sections: RawAdminSection[], lists: RawAdminList[]): AdminPrices {
  const sorted = [...sections].sort((a, b) => rank(a) - rank(b) || asText(a.name).localeCompare(asText(b.name), 'ro'));
  return {
    sections: sorted.map(toAdminSection).filter((s): s is AdminSection => s !== null),
    lists: lists.map(toAdminList).filter((l): l is AdminPriceList => l !== null),
  };
}

/** "Notițe subsol": a list of paragraphs; blanks dropped. null when the body is not a list of texts. */
export function readPriceNotes(raw: unknown): string[] | null {
  const notes = isRecord(raw) ? raw.priceNotes : undefined;
  if (!Array.isArray(notes) || notes.some((n) => typeof n !== 'string')) return null;
  return asTextList(notes);
}

/** "+ Listă nouă": a name and the section it belongs to. */
export function readNewListInput(raw: unknown): { ok: true; name: string; sectionId: string } | { ok: false; error: string } {
  const body = isRecord(raw) ? raw : {};
  const name = asText(body.name);
  const sectionId = asText(body.sectionId);
  if (!name) return { ok: false, error: PRICE_ERRORS.listName };
  if (!sectionId) return { ok: false, error: PRICE_ERRORS.section };
  return { ok: true, name, sectionId };
}
```

- [ ] **Step 4: Implement the actions and the Strapi store**

`src/club/price-admin-service.ts`:

```ts
import { refuse as fail, type AdminResult } from './admin-result';
import type { HistoryInput } from './history';
import { asTextList } from './narrow';
import {
  PRICE_ERRORS,
  applyItemEdit,
  buildAdminPrices,
  duplicateNameError,
  fieldChanges,
  nameClash,
  toItemData,
  type AdminPrices,
  type ItemEdit,
  type PriceItemData,
  type RawAdminList,
  type RawAdminSection,
} from './price-admin';

/** Storage the Prețuri actions need. `strapiPriceStore` (price-admin-store.ts) is the real one; tests pass a fake. */
export interface PriceStore {
  sections(): Promise<RawAdminSection[]>;
  lists(): Promise<RawAdminList[]>;
  findList(documentId: string): Promise<RawAdminList | null>;
  findSection(documentId: string): Promise<RawAdminSection | null>;
  listNameTaken(name: string): Promise<boolean>;
  saveItems(listId: string, items: PriceItemData[]): Promise<void>;
  createList(name: string, sectionId: string): Promise<string>;
  saveNotes(sectionId: string, priceNotes: string[]): Promise<void>;
  record(entry: HistoryInput): Promise<void>;
}

const ITEM_ACTIONS: Record<ItemEdit['kind'], string> = { add: 'price-added', update: 'price-updated', remove: 'price-removed' };

export async function loadAdminPrices(store: PriceStore): Promise<AdminPrices> {
  const [sections, lists] = await Promise.all([store.sections(), store.lists()]);
  return buildAdminPrices(sections, lists);
}

const sectionOf = (list: RawAdminList) => (typeof list.section?.documentId === 'string' ? list.section.documentId : null);

/** The other lists of the same section, plus this list with its new items. */
async function sectionListsWith(store: PriceStore, list: RawAdminList, items: PriceItemData[]) {
  const others = (await store.lists()).filter((l) => l.documentId !== list.documentId && sectionOf(l) === sectionOf(list));
  return [...others.map((l) => ({ items: toItemData(l.items) })), { items }];
}

/** Adds, changes or removes one price; blocks a name already used in the section; writes history. */
export async function editPriceItem(store: PriceStore, listId: string, edit: ItemEdit, actor: string): Promise<AdminResult<AdminPrices>> {
  const list = await store.findList(listId);
  if (!list) return fail(404, PRICE_ERRORS.listMissing);
  const applied = applyItemEdit(toItemData(list.items), edit);
  if (applied.ok === false) return fail(409, applied.error);
  const renamed = applied.after && applied.after.name !== applied.before?.name;
  if (renamed && nameClash(await sectionListsWith(store, list, applied.items), applied.after.name)) {
    return fail(409, duplicateNameError(applied.after.name));
  }
  await store.saveItems(listId, applied.items);
  const item = (applied.after ?? applied.before)?.name;
  const changes = { item, ...fieldChanges(applied.before, applied.after) };
  await store.record({ subjectType: 'price-list', subjectId: listId, action: ITEM_ACTIONS[edit.kind], changes, actor });
  return { ok: true, data: await loadAdminPrices(store) };
}

/** "+ Listă nouă": unique name, existing section; writes history. */
export async function createPriceList(store: PriceStore, name: string, sectionId: string, actor: string): Promise<AdminResult<AdminPrices>> {
  if (!(await store.findSection(sectionId))) return fail(400, PRICE_ERRORS.sectionMissing);
  if (await store.listNameTaken(name)) return fail(409, PRICE_ERRORS.listExists);
  const documentId = await store.createList(name, sectionId);
  await store.record({ subjectType: 'price-list', subjectId: documentId, action: 'created', changes: { name, sectionId }, actor });
  return { ok: true, data: await loadAdminPrices(store) };
}

/** "Notițe subsol" of one section; history keeps the old and new paragraphs. */
export async function savePriceNotes(store: PriceStore, sectionId: string, priceNotes: string[], actor: string): Promise<AdminResult<AdminPrices>> {
  const section = await store.findSection(sectionId);
  if (!section) return fail(404, PRICE_ERRORS.sectionMissing);
  const before = asTextList(section.priceNotes);
  await store.saveNotes(sectionId, priceNotes);
  const changes = { priceNotes: { from: before, to: priceNotes } };
  await store.record({ subjectType: 'section', subjectId: sectionId, action: 'price-notes-updated', changes, actor });
  return { ok: true, data: await loadAdminPrices(store) };
}
```

`src/club/price-admin-store.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { recordHistory } from './history';
import type { PriceStore } from './price-admin-service';

const LIST = 'api::price-list.price-list' as const;
const SECTION = 'api::section.section' as const;

/** The Prețuri storage on Strapi's document service. */
export function strapiPriceStore(strapi: Core.Strapi): PriceStore {
  const lists = () => strapi.documents(LIST);
  const sections = () => strapi.documents(SECTION);
  return {
    sections: () => sections().findMany({ limit: 100 }),
    lists: () => lists().findMany({ populate: { items: true, section: { fields: ['documentId'] } }, sort: 'createdAt:asc', limit: 500 }),
    findList: (documentId) => lists().findOne({ documentId, populate: { items: true, section: { fields: ['documentId'] } } }),
    findSection: (documentId) => sections().findOne({ documentId }),
    listNameTaken: async (name) => (await lists().count({ filters: { name: { $eqi: name } } })) > 0,
    saveItems: async (listId, items) => {
      await lists().update({ documentId: listId, data: { items } });
    },
    createList: async (name, sectionId) => (await lists().create({ data: { name, section: sectionId, items: [] } })).documentId,
    saveNotes: async (sectionId, priceNotes) => {
      await sections().update({ documentId: sectionId, data: { priceNotes } });
    },
    record: (entry) => recordHistory(strapi, entry),
  };
}
```

The `populate` clauses are written inline on purpose: a shared `as const` object is readonly and Strapi's populate type refuses it.

- [ ] **Step 5: Run the tests and type-check**

Run: `npm test -- src/club/__tests__/price-admin.test.ts src/club/__tests__/price-admin-service.test.ts` (PASS), then `npm test` and `npx tsc --noEmit` (zero errors; this also checks that `PriceItemData[]` is accepted by Strapi's typed `update` for `items`).

- [ ] **Step 6: Commit**

```bash
git add src/club/price-admin.ts src/club/price-admin-service.ts src/club/price-admin-store.ts \
  src/club/__tests__/price-admin.test.ts src/club/__tests__/price-admin-service.test.ts
git commit -m "feat(club): price list admin actions with unique names and history"
```

---

### Task 3: Season rules and actions

**Files:**
- Create: `src/club/season-admin.ts`, `src/club/season-admin-service.ts`, `src/club/season-admin-store.ts`
- Test: `src/club/__tests__/season-admin.test.ts`, `src/club/__tests__/season-admin-service.test.ts`

**Interfaces:**
- Consumes: Task 1 (`changedFields`, `FieldChange`, `refuse`, `AdminResult`); `normalizeSeasonLabel` from `src/club/season.ts`; `recordHistory`, `HistoryInput` from `src/club/history.ts`.
- Produces (`src/club/season-admin.ts`, runtime-safe for the admin bundle):
  - `type SeasonFields = { label: string; startMonth: string; endMonth: string; membershipFee: number | null }` (months `'YYYY-MM'`)
  - `type AdminSeason = SeasonFields & { documentId: string; isCurrent: boolean; registrations: number }`, `type RawAdminSeason`, `type SeasonWriteData`
  - `MONTH_NAMES`, `SEASON_ERRORS`, `seasonExistsError(label)`, `isMonth`, `monthOf(date)`, `formatMonth(month)`, `formatPeriod(start, end)` (`'Octombrie 2026 - Mai 2027'`), `readSeasonInput(raw)`, `toSeasonFields(raw)`, `toAdminSeason(raw, registrations)`, `byNewest`, `seasonWriteData(fields, stored)`, `seasonChanges(before, after)`, `nextSeasonDraft(seasons, today?)`, `monthOptions(label, selected, today?)`
- Produces (`src/club/season-admin-service.ts`): `interface SeasonStore`, `listAdminSeasons(store)`, `createSeason(store, fields, actor)`, `updateSeason(store, documentId, fields, actor)` (both `AdminResult<AdminSeason[]>`).
- Produces (`src/club/season-admin-store.ts`): `strapiSeasonStore(strapi: Core.Strapi): SeasonStore`.

Rules:
- The label is `YYYY-YYYY` with consecutive years (the schema's regex `^[0-9]{4}-[0-9]{4}$`, plus `normalizeSeasonLabel`, which numbering already relies on through `seasonStartYear`). An en dash is refused.
- Început and Sfârșit are months; the end must be after the start. The fee is a number >= 0 or empty.
- "+ Sezon nou" always creates `isCurrent: false` (spec 2: making a season current is phase 4). The drawer starts from `nextSeasonDraft`: the newest season one year later, with its fee.
- Stored dates: phase 1 stored real days (`'2025-10-04'`, `'2026-05-31'`). A month the admin did not change keeps its stored date; a changed or new month is written as the 1st (start) or the last day (end).
- A season's label is locked once registrations point at it (`seasonRef` or the old `season` text): renaming would split the Înscrieri season filter and the numbering year.
- History: `subjectType: 'season'`, actions `created` / `updated`, `changes` per field `{ from, to }`. A save that changes nothing writes nothing.

- [ ] **Step 1: Write the failing tests**

`src/club/__tests__/season-admin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  SEASON_ERRORS,
  formatPeriod,
  monthOf,
  monthOptions,
  nextSeasonDraft,
  readSeasonInput,
  seasonChanges,
  seasonWriteData,
  toAdminSeason,
} from '../season-admin';

const fields = { label: '2026-2027', startMonth: '2026-10', endMonth: '2027-05', membershipFee: 270 };

describe('readSeasonInput', () => {
  it('accepts a season with consecutive years, a period and a fee', () => {
    expect(readSeasonInput({ ...fields, label: ' 2026-2027 ' })).toEqual({ ok: true, season: fields });
    expect(readSeasonInput({ ...fields, membershipFee: null })).toEqual({ ok: true, season: { ...fields, membershipFee: null } });
  });

  it('refuses a label that is not YYYY-YYYY with consecutive years', () => {
    for (const label of ['2026', '2026–2027', '2026-2028', '26-27', '']) {
      expect(readSeasonInput({ ...fields, label })).toEqual({ ok: false, error: SEASON_ERRORS.label });
    }
  });

  it('refuses missing months, an end before the start and a negative fee', () => {
    expect(readSeasonInput({ ...fields, endMonth: '2027-13' })).toEqual({ ok: false, error: SEASON_ERRORS.months });
    expect(readSeasonInput({ ...fields, endMonth: '2026-10' })).toEqual({ ok: false, error: SEASON_ERRORS.order });
    expect(readSeasonInput({ ...fields, membershipFee: -5 })).toEqual({ ok: false, error: SEASON_ERRORS.fee });
    expect(readSeasonInput({ ...fields, membershipFee: '270' })).toEqual({ ok: false, error: SEASON_ERRORS.fee });
  });
});

describe('months', () => {
  it('reads the month of a stored date and formats the period', () => {
    expect(monthOf('2026-10-04')).toBe('2026-10');
    expect(monthOf(null)).toBe('');
    expect(formatPeriod('2026-10', '2027-05')).toBe('Octombrie 2026 - Mai 2027');
  });

  it("offers every month of the season's two years", () => {
    const options = monthOptions('2026-2027', ['2026-10', '2027-05']);
    expect(options).toHaveLength(24);
    expect(options[9]).toEqual({ value: '2026-10', label: 'Octombrie 2026' });
    expect(options[23]).toEqual({ value: '2027-12', label: 'Decembrie 2027' });
  });

  it('keeps a selected month outside those years, and falls back to this year for a bad label', () => {
    expect(monthOptions('2026-2027', ['2025-09']).map((o) => o.value)).toContain('2025-09');
    expect(monthOptions('abc', [], new Date('2030-03-01'))[0].value).toBe('2030-01');
  });
});

describe('seasonWriteData', () => {
  it('a new season starts on the 1st and ends on the last day of its months', () => {
    expect(seasonWriteData({ ...fields, endMonth: '2028-02' , label: '2027-2028', startMonth: '2027-10' }, null)).toEqual({
      label: '2027-2028',
      startMonth: '2027-10-01',
      endMonth: '2028-02-29',
      membershipFee: 270,
    });
  });

  it('keeps the stored date of a month the admin did not change', () => {
    const stored = { startMonth: '2026-10-04', endMonth: '2027-05-31' };
    expect(seasonWriteData({ ...fields, endMonth: '2027-06' }, stored)).toMatchObject({ startMonth: '2026-10-04', endMonth: '2027-06-30' });
  });
});

describe('seasonChanges and toAdminSeason', () => {
  it('records old -> new for the edited fields only', () => {
    expect(seasonChanges(fields, { ...fields, membershipFee: 300 })).toEqual({ membershipFee: { from: 270, to: 300 } });
  });

  it('builds a table row from a stored season', () => {
    const raw = { documentId: 'd1', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270, isCurrent: true };
    expect(toAdminSeason(raw, 12)).toEqual({ ...fields, documentId: 'd1', isCurrent: true, registrations: 12 });
    expect(toAdminSeason({ label: 'x' }, 0)).toBeNull();
  });
});

describe('nextSeasonDraft', () => {
  it('is the newest season one year later, with its fee', () => {
    expect(nextSeasonDraft([{ ...fields, label: '2025-2026', startMonth: '2025-10', endMonth: '2026-05' }, fields])).toEqual({
      label: '2027-2028',
      startMonth: '2027-10',
      endMonth: '2028-05',
      membershipFee: 270,
    });
  });

  it('without seasons, October to May from this year', () => {
    expect(nextSeasonDraft([], new Date('2026-11-02'))).toEqual({ label: '2026-2027', startMonth: '2026-10', endMonth: '2027-05', membershipFee: null });
  });
});
```

`src/club/__tests__/season-admin-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { HistoryInput } from '../history';
import { SEASON_ERRORS, seasonExistsError, type RawAdminSeason, type SeasonWriteData } from '../season-admin';
import { createSeason, listAdminSeasons, updateSeason, type SeasonStore } from '../season-admin-service';

const fields = { label: '2026-2027', startMonth: '2026-10', endMonth: '2027-05', membershipFee: 270 };

function fakeStore(registrations = 0) {
  const rows: RawAdminSeason[] = [
    { documentId: 'old', label: '2025-2026', startMonth: '2025-10-04', endMonth: '2026-05-31', membershipFee: 250, isCurrent: false },
    { documentId: 'cur', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270, isCurrent: true },
  ];
  const history: HistoryInput[] = [];
  const writes: { documentId: string; data: SeasonWriteData }[] = [];
  const store: SeasonStore = {
    all: async () => rows,
    find: async (id) => rows.find((r) => r.documentId === id) ?? null,
    labelTaken: async (label, exceptId) => rows.some((r) => r.label === label && r.documentId !== exceptId),
    registrations: async (id) => (id === 'cur' ? registrations : 0),
    create: async (data) => {
      rows.push({ ...data, documentId: 'new' });
      return 'new';
    },
    update: async (documentId, data) => {
      writes.push({ documentId, data });
      Object.assign(rows.find((r) => r.documentId === documentId)!, data);
    },
    record: async (entry) => {
      history.push(entry);
    },
  };
  return { store, history, writes, rows };
}

describe('listAdminSeasons', () => {
  it('newest first, with months and registration counts', async () => {
    const list = await listAdminSeasons(fakeStore(3).store);
    expect(list.map((s) => [s.label, s.startMonth, s.isCurrent, s.registrations])).toEqual([
      ['2026-2027', '2026-10', true, 3],
      ['2025-2026', '2025-10', false, 0],
    ]);
  });
});

describe('createSeason', () => {
  it('creates a season that is not current and records it', async () => {
    const { store, history, rows } = fakeStore();
    const r = await createSeason(store, { ...fields, label: '2027-2028', startMonth: '2027-10', endMonth: '2028-05' }, 'ana@club.ro');
    expect(r.ok && r.data[0]).toMatchObject({ label: '2027-2028', isCurrent: false });
    expect(rows[rows.length - 1]).toMatchObject({ isCurrent: false, startMonth: '2027-10-01', endMonth: '2028-05-31' });
    expect(history[0]).toMatchObject({ subjectType: 'season', subjectId: 'new', action: 'created', actor: 'ana@club.ro', changes: { label: { from: null, to: '2027-2028' } } });
  });

  it('refuses a label that exists', async () => {
    await expect(createSeason(fakeStore().store, fields, 'a')).resolves.toEqual({ ok: false, status: 409, error: seasonExistsError('2026-2027') });
  });
});

describe('updateSeason', () => {
  it('changes the fee, keeps the stored dates and records old -> new', async () => {
    const { store, history, writes } = fakeStore(5);
    await expect(updateSeason(store, 'old', { ...fields, label: '2025-2026', startMonth: '2025-10', endMonth: '2026-05', membershipFee: 260 }, 'a')).resolves.toMatchObject({ ok: true });
    expect(writes[0].data).toEqual({ label: '2025-2026', startMonth: '2025-10-04', endMonth: '2026-05-31', membershipFee: 260 });
    expect(history[0]).toMatchObject({ action: 'updated', changes: { membershipFee: { from: 250, to: 260 } } });
  });

  it('writes nothing when nothing changed', async () => {
    const { store, history, writes } = fakeStore();
    await updateSeason(store, 'cur', fields, 'a');
    expect(writes).toEqual([]);
    expect(history).toEqual([]);
  });

  it('locks the label of a season with registrations', async () => {
    const { store, writes } = fakeStore(2);
    await expect(updateSeason(store, 'cur', { ...fields, label: '2027-2028' }, 'a')).resolves.toEqual({ ok: false, status: 409, error: SEASON_ERRORS.locked });
    expect(writes).toEqual([]);
  });

  it('refuses a label used by another season, and a missing season', async () => {
    const { store } = fakeStore();
    await expect(updateSeason(store, 'cur', { ...fields, label: '2025-2026' }, 'a')).resolves.toEqual({ ok: false, status: 409, error: seasonExistsError('2025-2026') });
    await expect(updateSeason(store, 'nope', fields, 'a')).resolves.toEqual({ ok: false, status: 404, error: SEASON_ERRORS.missing });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- src/club/__tests__/season-admin.test.ts src/club/__tests__/season-admin-service.test.ts`
Expected: FAIL (`Cannot find module '../season-admin'`).

- [ ] **Step 3: Implement the rules**

`src/club/season-admin.ts`:

```ts
import { changedFields, type FieldChange } from './admin-result';
import { normalizeSeasonLabel } from './season';

/** A season as the Sezoane drawer edits it. Months are 'YYYY-MM'. */
export type SeasonFields = { label: string; startMonth: string; endMonth: string; membershipFee: number | null };
/** A row of the Sezoane table. `registrations` > 0 locks the label. */
export type AdminSeason = SeasonFields & { documentId: string; isCurrent: boolean; registrations: number };
export type RawAdminSeason = { documentId?: unknown; label?: unknown; startMonth?: unknown; endMonth?: unknown; membershipFee?: unknown; isCurrent?: unknown };
/** What is written to `api::season.season`: dates, never months. */
export type SeasonWriteData = { label: string; startMonth: string; endMonth: string; membershipFee: number | null };

export const MONTH_NAMES = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
] as const;

export const SEASON_ERRORS = {
  label: 'Sezonul se scrie ca 2026-2027.',
  months: 'Alege luna de început și de sfârșit.',
  order: 'Sfârșitul trebuie să fie după început.',
  fee: 'Taxa de membru nu este validă.',
  missing: 'Sezonul nu mai există.',
  locked: 'Sezonul are înscrieri, numele lui nu se mai schimbă.',
} as const;

export const seasonExistsError = (label: string) => `Sezonul ${label} există deja.`;

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const FIELDS = ['label', 'startMonth', 'endMonth', 'membershipFee'] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFee = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export const isMonth = (v: unknown): v is string => typeof v === 'string' && MONTH_RE.test(v);

/** '2026-10-04' -> '2026-10'; '' for anything that is not a date. */
export function monthOf(date: unknown): string {
  const m = typeof date === 'string' ? /^(\d{4}-\d{2})-\d{2}/.exec(date) : null;
  return m && isMonth(m[1]) ? m[1] : '';
}

/** '2026-10' -> 'Octombrie 2026'. */
export function formatMonth(month: string): string {
  const m = MONTH_RE.exec(month);
  return m ? `${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}` : '';
}

/** 'Octombrie 2026 - Mai 2027'. */
export function formatPeriod(startMonth: string, endMonth: string): string {
  return [formatMonth(startMonth), formatMonth(endMonth)].filter(Boolean).join(' - ');
}

function seasonInputError(body: Record<string, unknown>): string | null {
  const label = text(body.label);
  if (normalizeSeasonLabel(label) !== label) return SEASON_ERRORS.label;
  if (!isMonth(body.startMonth) || !isMonth(body.endMonth)) return SEASON_ERRORS.months;
  if (body.endMonth <= body.startMonth) return SEASON_ERRORS.order;
  const fee = body.membershipFee;
  return fee === null || fee === undefined || isFee(fee) ? null : SEASON_ERRORS.fee;
}

/** The drawer's body, checked: label 'YYYY-YYYY' (consecutive years), months, end after start, fee >= 0 or empty. */
export function readSeasonInput(raw: unknown): { ok: true; season: SeasonFields } | { ok: false; error: string } {
  const body = isRecord(raw) ? raw : {};
  const error = seasonInputError(body);
  if (error) return { ok: false, error };
  const membershipFee = isFee(body.membershipFee) ? body.membershipFee : null;
  return { ok: true, season: { label: text(body.label), startMonth: String(body.startMonth), endMonth: String(body.endMonth), membershipFee } };
}

export function toSeasonFields(raw: RawAdminSeason): SeasonFields {
  const membershipFee = isFee(raw.membershipFee) ? raw.membershipFee : null;
  return { label: text(raw.label), startMonth: monthOf(raw.startMonth), endMonth: monthOf(raw.endMonth), membershipFee };
}

export function toAdminSeason(raw: RawAdminSeason, registrations: number): AdminSeason | null {
  if (typeof raw.documentId !== 'string' || !text(raw.label)) return null;
  return { ...toSeasonFields(raw), documentId: raw.documentId, isCurrent: raw.isCurrent === true, registrations };
}

/** Newest season first. */
export const byNewest = (a: { label: string }, b: { label: string }) => b.label.localeCompare(a.label);

const lastDay = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/**
 * Dates to store. A month the admin did not change keeps its stored date (old seasons may start on
 * a given day); a changed month starts on the 1st or ends on its last day.
 */
export function seasonWriteData(fields: SeasonFields, stored: RawAdminSeason | null): SeasonWriteData {
  const keep = (month: string, date: unknown, fallback: string) => (monthOf(date) === month ? String(date) : fallback);
  return {
    label: fields.label,
    startMonth: keep(fields.startMonth, stored?.startMonth, `${fields.startMonth}-01`),
    endMonth: keep(fields.endMonth, stored?.endMonth, `${fields.endMonth}-${lastDay(fields.endMonth)}`),
    membershipFee: fields.membershipFee,
  };
}

export function seasonChanges(before: SeasonFields | null, after: SeasonFields): Record<string, FieldChange> {
  return changedFields<SeasonFields>(FIELDS, before, after);
}

const shiftYear = (month: string) => (isMonth(month) ? `${Number(month.slice(0, 4)) + 1}${month.slice(4)}` : '');

/** "+ Sezon nou" starts from the newest season, one year later; with none, October to May from this year. */
export function nextSeasonDraft(seasons: SeasonFields[], today: Date = new Date()): SeasonFields {
  const newest = [...seasons].sort(byNewest)[0];
  const start = newest ? Number(newest.label.slice(0, 4)) + 1 : today.getFullYear();
  return {
    label: `${start}-${start + 1}`,
    startMonth: shiftYear(newest?.startMonth ?? '') || `${start}-10`,
    endMonth: shiftYear(newest?.endMonth ?? '') || `${start + 1}-05`,
    membershipFee: newest?.membershipFee ?? null,
  };
}

function optionYears(label: string, selected: string[], today: Date): number[] {
  const years = new Set<number>();
  const normalized = normalizeSeasonLabel(label);
  if (normalized === label) [0, 1].forEach((d) => years.add(Number(label.slice(0, 4)) + d));
  selected.filter(isMonth).forEach((m) => years.add(Number(m.slice(0, 4))));
  if (years.size === 0) [0, 1].forEach((d) => years.add(today.getFullYear() + d));
  return [...years].sort((a, b) => a - b);
}

/** Months offered by Început / Sfârșit: every month of the season's two years, plus the selected ones. */
export function monthOptions(label: string, selected: string[], today: Date = new Date()): { value: string; label: string }[] {
  return optionYears(label, selected, today).flatMap((year) =>
    MONTH_NAMES.map((_, i) => {
      const value = `${year}-${String(i + 1).padStart(2, '0')}`;
      return { value, label: formatMonth(value) };
    }),
  );
}
```

- [ ] **Step 4: Implement the actions and the Strapi store**

`src/club/season-admin-service.ts`:

```ts
import { refuse, type AdminResult } from './admin-result';
import type { HistoryInput } from './history';
import {
  SEASON_ERRORS,
  byNewest,
  seasonChanges,
  seasonExistsError,
  seasonWriteData,
  toAdminSeason,
  toSeasonFields,
  type AdminSeason,
  type RawAdminSeason,
  type SeasonFields,
  type SeasonWriteData,
} from './season-admin';

/** Storage the Sezoane actions need. `strapiSeasonStore` (season-admin-store.ts) is the real one; tests pass a fake. */
export interface SeasonStore {
  all(): Promise<RawAdminSeason[]>;
  find(documentId: string): Promise<RawAdminSeason | null>;
  labelTaken(label: string, exceptId: string | null): Promise<boolean>;
  /** Registrations pointing at the season (by relation or by the old season text). */
  registrations(documentId: string, label: string): Promise<number>;
  create(data: SeasonWriteData & { isCurrent: false }): Promise<string>;
  update(documentId: string, data: SeasonWriteData): Promise<void>;
  record(entry: HistoryInput): Promise<void>;
}

/** Every season, newest first, each with how many registrations point at it. */
export async function listAdminSeasons(store: SeasonStore): Promise<AdminSeason[]> {
  const rows = await store.all();
  const seasons = await Promise.all(
    rows.map(async (raw) => toAdminSeason(raw, typeof raw.documentId === 'string' ? await store.registrations(raw.documentId, String(raw.label)) : 0)),
  );
  return seasons.filter((s): s is AdminSeason => s !== null).sort(byNewest);
}

/** "+ Sezon nou": always created as not current (making a season current is phase 4). */
export async function createSeason(store: SeasonStore, fields: SeasonFields, actor: string): Promise<AdminResult<AdminSeason[]>> {
  if (await store.labelTaken(fields.label, null)) return refuse(409, seasonExistsError(fields.label));
  const documentId = await store.create({ ...seasonWriteData(fields, null), isCurrent: false });
  await store.record({ subjectType: 'season', subjectId: documentId, action: 'created', changes: seasonChanges(null, fields), actor });
  return { ok: true, data: await listAdminSeasons(store) };
}

async function updateRefusal(store: SeasonStore, stored: RawAdminSeason, documentId: string, fields: SeasonFields): Promise<AdminResult<never> | null> {
  const before = toSeasonFields(stored);
  if (before.label === fields.label) return null;
  if ((await store.registrations(documentId, before.label)) > 0) return refuse(409, SEASON_ERRORS.locked);
  return (await store.labelTaken(fields.label, documentId)) ? refuse(409, seasonExistsError(fields.label)) : null;
}

/** Edits label, period and fee. The label is locked once registrations point at the season. */
export async function updateSeason(store: SeasonStore, documentId: string, fields: SeasonFields, actor: string): Promise<AdminResult<AdminSeason[]>> {
  const stored = await store.find(documentId);
  if (!stored) return refuse(404, SEASON_ERRORS.missing);
  const refusal = await updateRefusal(store, stored, documentId, fields);
  if (refusal) return refusal;
  const changes = seasonChanges(toSeasonFields(stored), fields);
  if (Object.keys(changes).length === 0) return { ok: true, data: await listAdminSeasons(store) };
  await store.update(documentId, seasonWriteData(fields, stored));
  await store.record({ subjectType: 'season', subjectId: documentId, action: 'updated', changes, actor });
  return { ok: true, data: await listAdminSeasons(store) };
}
```

`src/club/season-admin-store.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { recordHistory } from './history';
import type { SeasonStore } from './season-admin-service';

const SEASON = 'api::season.season' as const;
const REGISTRATION = 'api::registration-submission.registration-submission' as const;

/** The Sezoane storage on Strapi's document service. */
export function strapiSeasonStore(strapi: Core.Strapi): SeasonStore {
  const seasons = () => strapi.documents(SEASON);
  return {
    all: () => seasons().findMany({ limit: 200 }),
    find: (documentId) => seasons().findOne({ documentId }),
    labelTaken: async (label, exceptId) => {
      const filters = exceptId ? { label, documentId: { $ne: exceptId } } : { label };
      return (await seasons().count({ filters })) > 0;
    },
    registrations: (documentId, label) =>
      strapi.documents(REGISTRATION).count({ filters: { $or: [{ seasonRef: { documentId } }, { season: label }] } }),
    create: async (data) => (await seasons().create({ data })).documentId,
    update: async (documentId, data) => {
      await seasons().update({ documentId, data });
    },
    record: (entry) => recordHistory(strapi, entry),
  };
}
```

- [ ] **Step 5: Run the tests and type-check**

Run: `npm test -- src/club/__tests__/season-admin.test.ts src/club/__tests__/season-admin-service.test.ts` (PASS), then `npm test` and `npx tsc --noEmit` (zero errors).

- [ ] **Step 6: Commit**

```bash
git add src/club/season-admin.ts src/club/season-admin-service.ts src/club/season-admin-store.ts \
  src/club/__tests__/season-admin.test.ts src/club/__tests__/season-admin-service.test.ts
git commit -m "feat(club): season admin actions with label checks, locked labels and history"
```

---

### Task 4: Admin API routes for Prețuri and Sezoane

**Files:**
- Create: `src/api/club/controllers/prices.ts`, `src/api/club/controllers/seasons.ts`, `src/api/club/routes/03-admin-prices-seasons.ts`
- Test: `src/club/__tests__/club-admin-routes.test.ts`

**Interfaces:**
- Consumes: Task 1 (`adminActor`, `respond`, `refuseWith`, `indexParam`, `AdminCtx`), Task 2 (`readPriceItemInput`, `readNewListInput`, `readPriceNotes`, `PRICE_ERRORS`, `ItemEdit`, `loadAdminPrices`, `editPriceItem`, `createPriceList`, `savePriceNotes`, `strapiPriceStore`), Task 3 (`readSeasonInput`, `listAdminSeasons`, `createSeason`, `updateSeason`, `strapiSeasonStore`).
- Produces (HTTP, all `global::is-admin`; every 200 answer is `{ data }`, every refusal `{ data: null, error: { status, name: 'ClubAdminError', message } }`):
  - `GET /api/club/prices` -> `AdminPrices`
  - `POST /api/club/price-lists` body `{ name, sectionId }` -> `AdminPrices`
  - `POST /api/club/price-lists/:documentId/items` body `PriceItemFields` -> `AdminPrices`
  - `PUT /api/club/price-lists/:documentId/items/:index` body `{ item: PriceItemFields, expectedName }` -> `AdminPrices`
  - `DELETE /api/club/price-lists/:documentId/items/:index?expectedName=` -> `AdminPrices`
  - `PUT /api/club/sections/:documentId/price-notes` body `{ priceNotes: string[] }` -> `AdminPrices`
  - `GET /api/club/seasons` -> `AdminSeason[]`; `POST /api/club/seasons` body `SeasonFields`; `PUT /api/club/seasons/:documentId` body `SeasonFields` -> `AdminSeason[]`

A new routes file and two new controllers keep this task clear of `routes/02-admin.ts` and `controllers/club.ts`, which plans 2D and 2F extend (`/club/registrations/...`, `/club/documents/blank/:kind`). Strapi registers every file in `routes/`; the handler `prices.list` resolves to `controllers/prices.ts`.

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/club-admin-routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import prices from '../../api/club/controllers/prices';
import seasons from '../../api/club/controllers/seasons';
import routes from '../../api/club/routes/03-admin-prices-seasons';
import { indexParam, refuseWith, respond, type AdminCtx } from '../admin-http';

const controllers: Record<string, Record<string, unknown>> = { prices, seasons };

const ctx = (): AdminCtx => ({ params: {}, query: {}, request: { header: {} }, status: 200, body: null });

describe('Prețuri and Sezoane admin routes', () => {
  it('are all admin-only', () => {
    for (const r of routes.routes) expect(r.config).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
  });

  it('point at handlers that exist', () => {
    for (const r of routes.routes) {
      const [controller, action] = r.handler.split('.');
      expect(typeof controllers[controller]?.[action], r.handler).toBe('function');
    }
  });
});

describe('admin-http', () => {
  it('answers data or a Strapi-shaped error', () => {
    const ok = ctx();
    respond(ok, { ok: true, data: [1] });
    expect(ok.body).toEqual({ data: [1] });
    const no = ctx();
    respond(no, { ok: false, status: 409, error: 'Nu.' });
    expect([no.status, no.body]).toEqual([409, { data: null, error: { status: 409, name: 'ClubAdminError', message: 'Nu.' } }]);
  });

  it('reads an item index', () => {
    expect(indexParam('2')).toBe(2);
    expect(indexParam('-1')).toBeNull();
    expect(indexParam('x')).toBeNull();
    expect(indexParam(undefined)).toBeNull();
  });

  it('refuses with a message', () => {
    const c = ctx();
    refuseWith(c, 400, 'Alege tipul.');
    expect(c.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- src/club/__tests__/club-admin-routes.test.ts`
Expected: FAIL (`Cannot find module '../../api/club/controllers/prices'`).

- [ ] **Step 3: Implement**

`src/api/club/controllers/prices.ts`:

```ts
import { adminActor } from '../../../club/admin-actor';
import { indexParam, refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { PRICE_ERRORS, readNewListInput, readPriceItemInput, readPriceNotes, type ItemEdit } from '../../../club/price-admin';
import { createPriceList, editPriceItem, loadAdminPrices, savePriceNotes } from '../../../club/price-admin-service';
import { strapiPriceStore } from '../../../club/price-admin-store';

/**
 * Admin API of the Prețuri page (routes/03-admin-prices-seasons.ts, all `global::is-admin`).
 * Every answer is the whole page data (`AdminPrices`), so the page simply replaces its state.
 */
const store = () => strapiPriceStore(strapi);
const actor = (ctx: AdminCtx) => adminActor(ctx.request.header.authorization, strapi);
const text = (v: unknown) => (typeof v === 'string' ? v : '');

async function runItemEdit(ctx: AdminCtx, edit: ItemEdit) {
  respond(ctx, await editPriceItem(store(), ctx.params.documentId ?? '', edit, await actor(ctx)));
}

/** The item edit for PUT and DELETE: the row's place plus the name the admin saw there. */
function placeOf(ctx: AdminCtx, expectedName: unknown): { index: number; expectedName: string } | null {
  const index = indexParam(ctx.params.index);
  return index === null ? null : { index, expectedName: text(expectedName) };
}

export default {
  async list(ctx: AdminCtx) {
    ctx.body = { data: await loadAdminPrices(store()) };
  },

  async createList(ctx: AdminCtx) {
    const input = readNewListInput(ctx.request.body);
    if (input.ok === false) return refuseWith(ctx, 400, input.error);
    respond(ctx, await createPriceList(store(), input.name, input.sectionId, await actor(ctx)));
  },

  async addItem(ctx: AdminCtx) {
    const input = readPriceItemInput(ctx.request.body);
    if (input.ok === false) return refuseWith(ctx, 400, input.error);
    await runItemEdit(ctx, { kind: 'add', item: input.item });
  },

  async updateItem(ctx: AdminCtx) {
    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const input = readPriceItemInput(body.item);
    const place = placeOf(ctx, body.expectedName);
    if (input.ok === false) return refuseWith(ctx, 400, input.error);
    if (!place) return refuseWith(ctx, 409, PRICE_ERRORS.stale);
    await runItemEdit(ctx, { kind: 'update', ...place, item: input.item });
  },

  async removeItem(ctx: AdminCtx) {
    const place = placeOf(ctx, ctx.query.expectedName);
    if (!place) return refuseWith(ctx, 409, PRICE_ERRORS.stale);
    await runItemEdit(ctx, { kind: 'remove', ...place });
  },

  async saveNotes(ctx: AdminCtx) {
    const notes = readPriceNotes(ctx.request.body);
    if (!notes) return refuseWith(ctx, 400, PRICE_ERRORS.notes);
    respond(ctx, await savePriceNotes(store(), ctx.params.documentId ?? '', notes, await actor(ctx)));
  },
};
```

`src/api/club/controllers/seasons.ts`:

```ts
import { adminActor } from '../../../club/admin-actor';
import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { readSeasonInput } from '../../../club/season-admin';
import { createSeason, listAdminSeasons, updateSeason } from '../../../club/season-admin-service';
import { strapiSeasonStore } from '../../../club/season-admin-store';

/** Admin API of the Sezoane page (routes/03-admin-prices-seasons.ts, all `global::is-admin`). */
const store = () => strapiSeasonStore(strapi);
const actor = (ctx: AdminCtx) => adminActor(ctx.request.header.authorization, strapi);

export default {
  async list(ctx: AdminCtx) {
    ctx.body = { data: await listAdminSeasons(store()) };
  },

  async create(ctx: AdminCtx) {
    const input = readSeasonInput(ctx.request.body);
    if (input.ok === false) return refuseWith(ctx, 400, input.error);
    respond(ctx, await createSeason(store(), input.season, await actor(ctx)));
  },

  async update(ctx: AdminCtx) {
    const input = readSeasonInput(ctx.request.body);
    if (input.ok === false) return refuseWith(ctx, 400, input.error);
    respond(ctx, await updateSeason(store(), ctx.params.documentId ?? '', input.season, await actor(ctx)));
  },
};
```

`src/api/club/routes/03-admin-prices-seasons.ts`:

```ts
/**
 * Admin API of the Prețuri and Sezoane pages. Content-api routes (under /api) with auth off and the
 * `global::is-admin` policy: usable from the admin UI with its Bearer token, never from the public API.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/prices', handler: 'prices.list', config: adminGuard },
    { method: 'POST', path: '/club/price-lists', handler: 'prices.createList', config: adminGuard },
    { method: 'POST', path: '/club/price-lists/:documentId/items', handler: 'prices.addItem', config: adminGuard },
    { method: 'PUT', path: '/club/price-lists/:documentId/items/:index', handler: 'prices.updateItem', config: adminGuard },
    { method: 'DELETE', path: '/club/price-lists/:documentId/items/:index', handler: 'prices.removeItem', config: adminGuard },
    { method: 'PUT', path: '/club/sections/:documentId/price-notes', handler: 'prices.saveNotes', config: adminGuard },
    { method: 'GET', path: '/club/seasons', handler: 'seasons.list', config: adminGuard },
    { method: 'POST', path: '/club/seasons', handler: 'seasons.create', config: adminGuard },
    { method: 'PUT', path: '/club/seasons/:documentId', handler: 'seasons.update', config: adminGuard },
  ],
};
```

- [ ] **Step 4: Run the tests and type-check**

Run: `npm test` (all PASS) and `npx tsc --noEmit` (zero errors; the global `strapi` satisfies `ActorStrapi` and `Core.Strapi`).

- [ ] **Step 5: Commit**

```bash
git add src/api/club/controllers/prices.ts src/api/club/controllers/seasons.ts \
  src/api/club/routes/03-admin-prices-seasons.ts src/club/__tests__/club-admin-routes.test.ts
git commit -m "feat(club): admin routes for price lists, price notes and seasons"
```

---

### Task 5: EditorCard without the band; DrawerSection without a title

**Files:**
- Modify: `src/admin/ui/styles.ts:378` (the `.ui-ecard-h` rule)
- Modify: `src/admin/ui/EditorCard.tsx` (doc comment)
- Modify: `src/admin/ui/Drawer.tsx` (`DrawerSectionProps.title`, `DrawerSection`)
- Test: `src/club/__tests__/admin-card-band.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `.ui-ecard-h` without `box-shadow` (every EditorCard in the admin, design phase2-card-band option A); `DrawerSection` with an optional `title` (no header row when omitted), used by the drawers of Tasks 7 and 8. The approved drawers (phase2-designs-v1) show one block of fields with the drawer's padding and no section title; `ui-drawer-b` itself has no padding, so the fields need the section body (`ui-dsec-b`).

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/admin-card-band.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const source = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

it('EditorCard headers have no band on the left, everywhere', () => {
  const rule = /\.ui-ecard-h\{[^}]*\}/.exec(source('admin/ui/styles.ts'))?.[0] ?? '';
  expect(rule).not.toBe('');
  expect(rule).not.toContain('box-shadow');
});

it('a DrawerSection can go without a title (a drawer with one block of fields)', () => {
  const drawer = source('admin/ui/Drawer.tsx');
  expect(drawer).toContain('title?: React.ReactNode;');
  expect(drawer).toContain('{title !== undefined && (');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- src/club/__tests__/admin-card-band.test.ts`
Expected: FAIL (the rule contains `box-shadow`; `title?:` not found).

- [ ] **Step 3: Remove the band**

In `src/admin/ui/styles.ts` replace the line

```ts
${R} .ui-ecard-h{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--ui-space-3);padding:12px 14px;background:var(--theme-surface-subtle);border-bottom:1px solid var(--theme-border);box-shadow:inset 3px 0 0 var(--theme-primary);border-top-left-radius:var(--ui-radius-sm);border-top-right-radius:var(--ui-radius-sm)}
```

with

```ts
${R} .ui-ecard-h{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--ui-space-3);padding:12px 14px;background:var(--theme-surface-subtle);border-bottom:1px solid var(--theme-border);border-top-left-radius:var(--ui-radius-sm);border-top-right-radius:var(--ui-radius-sm)}
```

(The other `inset 3px` rule, `.ui-inbox-item[aria-current="true"]`, is the selected-row style, not a card band; it stays.)

In `src/admin/ui/EditorCard.tsx` replace

```ts
 * Card for a field editor: header (accent bar on the left, title, optional
 * description and action) over a raised body. Carries `.ui-root` itself, so
```

with

```ts
 * Card for a field editor: header (title, optional description and action)
 * over a raised body. Carries `.ui-root` itself, so
```

- [ ] **Step 4: Let a DrawerSection go without a title**

In `src/admin/ui/Drawer.tsx` replace

```tsx
export interface DrawerSectionProps {
  title: React.ReactNode;
```

with

```tsx
export interface DrawerSectionProps {
  /** Small uppercase title. Omit for a drawer with a single block of fields (no header row). */
  title?: React.ReactNode;
```

and replace

```tsx
      <section className={cx('ui-dsec', className)}>
        <div className="ui-dsec-h">
          <h3 className="ui-dsec-title">{title}</h3>
          {aside}
        </div>
```

with

```tsx
      <section className={cx('ui-dsec', className)}>
        {title !== undefined && (
          <div className="ui-dsec-h">
            <h3 className="ui-dsec-title">{title}</h3>
            {aside}
          </div>
        )}
```

- [ ] **Step 5: Run the checks**

Run: `npm test -- src/club/__tests__/admin-card-band.test.ts` (PASS), `npm test`, `npx tsc --noEmit`, `npx tsc --noEmit -p src/admin/tsconfig.json` (zero errors).

- [ ] **Step 6: Commit**

```bash
git add src/admin/ui/styles.ts src/admin/ui/EditorCard.tsx src/admin/ui/Drawer.tsx src/club/__tests__/admin-card-band.test.ts
git commit -m "style(admin): drop the band on EditorCard headers; drawer sections without a title"
```

---

### Task 6: Setări site keeps only "Înscrieri deschise"; the old pricing editor goes

**Files:**
- Modify (whole file below): `src/admin/pages/SetariSitePage.tsx`
- Modify (whole file below): `src/plugins/component-preview/admin/src/SiteSettingsRegistrationEditor.tsx`
- Modify: `src/plugins/component-preview/admin/src/index.ts` (delete the `pricing-tiers` registration)
- Delete: `src/plugins/component-preview/admin/src/PricingTiersEditor.tsx`
- Modify: `src/api/pricing/content-types/pricing/schema.json` (drop `customField` from `tiers`)
- Regenerate: `types/generated/contentTypes.d.ts`
- Test: `src/club/__tests__/admin-retired-editors.test.ts`

**Interfaces:**
- Consumes: Task 5 is not needed (EditorCard exists today).
- Produces: Setări site with an "Înscrieri" EditorCard holding only "Înscrieri deschise" (design phase2-designs-v1, question 4) and the subtitle "Înscrieri și date de contact, folosite pe tot site-ul."; the content-manager editor of `site-settings.registration` with the same single switch. The stored season keys are never removed: the page merges into the stored object (`normalizeObject` spreads it; `setRegistration` spreads `registration`), and the plugin editor spreads the stored value on every commit.

Reference check done for this plan (2026-10-20): `PricingTiersEditor` is imported only by `src/plugins/component-preview/admin/src/index.ts` (the `pricing-tiers` custom field), which only `pricing.tiers` uses (`customField` in its schema). The custom Prețuri page already replaced it, and the server never registered `pricing-tiers` (`src/index.ts` registers other fields only; Strapi converts only attributes of `type: 'customField'`, and `tiers` is `type: 'json'`). Its helper components (`EditorField`, `DeleteIconButton`, `AddListButton`, `Section`, `EditorCard`) stay: other editors import them. `FooterNotesEditor` stays: eight other custom fields use it.

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/admin-retired-editors.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const SRC = join(__dirname, '..', '..');
const source = (p: string) => readFileSync(join(SRC, p), 'utf8');

it('Setări site and its content-manager editor no longer edit the season', () => {
  for (const file of ['admin/pages/SetariSitePage.tsx', 'plugins/component-preview/admin/src/SiteSettingsRegistrationEditor.tsx']) {
    const code = source(file);
    expect(code, file).not.toMatch(/DateRangeInput|DatePicker|seasonStartDate:|currentSeason:/);
    expect(code, file).toContain('Înscrieri deschise');
  }
});

it('the old pricing tiers editor is gone; the pricing data stays a json attribute', () => {
  expect(existsSync(join(SRC, 'plugins/component-preview/admin/src/PricingTiersEditor.tsx'))).toBe(false);
  expect(source('plugins/component-preview/admin/src/index.ts')).not.toContain('pricing-tiers');
  const tiers = JSON.parse(source('api/pricing/content-types/pricing/schema.json')).attributes.tiers;
  expect(tiers.type).toBe('json');
  expect(tiers.customField).toBeUndefined();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- src/club/__tests__/admin-retired-editors.test.ts`
Expected: FAIL (`DateRangeInput` found; `PricingTiersEditor.tsx` exists).

- [ ] **Step 3: Setări site**

Replace the whole of `src/admin/pages/SetariSitePage.tsx` with:

```tsx
import * as React from 'react';
import {
  AdminPage,
  Window,
  PageHeader,
  Notice,
  Loading,
  SaveBar,
  UnsavedGuard,
  ObjectFieldCard,
  EditorCard,
  Switch,
  Field,
  HelpTip,
  normalizeObject,
} from '../ui';
import { useSingleType, usePageForm } from '../lib';
import { DASHBOARD_TO } from '../dashboard/menu';
import { UID } from './routes';

/**
 * Setări site (/plugins/edusport-setari): the site-settings single type.
 *
 * Replaces the content-manager view and its two custom fields,
 * component-preview SiteSettingsRegistrationEditor (`registration`) and
 * SiteSettingsContactEditor (`contact`). Both are JSON attributes; the shapes
 * stay exactly as those editors wrote them, so the website reads them
 * unchanged:
 *   registration: { open } (editable here), plus the retired season fields
 *                 currentSeason, seasonStartDate, seasonEndDate (spec 1.6: kept, no longer
 *                 edited; seasons live on the Sezoane page)
 *   contact:      { phone, email, facebookUrl1, instagramUrl,
 *                   whatsappChannelUrl, addressDisplay, addressMapsUrl }
 * Keys the editors did not know are kept (the objects are merged, not
 * rebuilt). These are the only two attributes on the schema.
 */

/** Only `open` is edited; the stored season keys ride along untouched (normalizeObject keeps them). */
interface Registration {
  open: boolean;
}

interface Contact {
  phone: string;
  email: string;
  facebookUrl1: string;
  instagramUrl: string;
  whatsappChannelUrl: string;
  addressDisplay: string;
  addressMapsUrl: string;
}

interface SiteSettings {
  registration: Registration | null;
  contact: Contact | null;
}

const EMPTY_REGISTRATION: Registration = { open: false };

const EMPTY_CONTACT: Contact = {
  phone: '',
  email: '',
  facebookUrl1: '',
  instagramUrl: '',
  whatsappChannelUrl: '',
  addressDisplay: '',
  addressMapsUrl: '',
};

const SetariSitePage: React.FC = () => {
  const page = useSingleType<SiteSettings>(UID.siteSettings);
  const form = usePageForm<SiteSettings>(page.data, page.saveState);

  const registration = normalizeObject<Registration>(form.value.registration, EMPTY_REGISTRATION);
  const contact = normalizeObject<Contact>(form.value.contact, EMPTY_CONTACT);

  const setRegistration = (patch: Partial<Registration>) =>
    form.set('registration', { ...registration, ...patch });

  return (
    <AdminPage>
      <Window>
        <PageHeader back={{ to: DASHBOARD_TO }} title="Setări site" subtitle="Înscrieri și date de contact, folosite pe tot site-ul." />

        {page.loading ? (
          <Loading />
        ) : page.error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca setările site-ului.</Notice>
          </div>
        ) : (
          <div className="ui-body">
            <EditorCard title="Înscrieri">
              <Field label="Înscrieri deschise" hint="Când este activ, pe site se afișează secțiunea de înscrieri. Când este inactiv, apare mesajul că înscrierile sunt închise.">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ui-space-3)' }}>
                  <Switch
                    checked={registration.open}
                    onChange={(next) => setRegistration({ open: next })}
                    aria-label="Înscrieri deschise"
                  />
                  <span className="ui-hint">{registration.open ? 'Vizibile pe site' : 'Închise'}</span>
                  <HelpTip label="Comută starea de înscrieri afișată public pe site." />
                </div>
              </Field>
            </EditorCard>

            <ObjectFieldCard<Contact>
              title="Date de contact & rețele sociale"
              description="Informații afișate în footer-ul site-ului și pe paginile de contact. Modificările se reflectă pe tot site-ul."
              value={contact}
              onFieldChange={(key, v) => form.set('contact', { ...contact, [key]: v })}
              fields={[
                { key: 'phone', label: 'Număr telefon', hint: 'Cu sau fără spații - link-ul tel: se generează automat', placeholder: 'ex: 0723 623 712' },
                { key: 'email', label: 'Adresă email', type: 'text', placeholder: 'ex: scoala.de.patinaj@gmail.com' },
                { key: 'facebookUrl1', label: 'Facebook', placeholder: 'ex: https://facebook.com/edusport', span: 2 },
                { key: 'instagramUrl', label: 'Instagram', placeholder: 'ex: https://instagram.com/edusport', span: 2 },
                { key: 'whatsappChannelUrl', label: 'Canal WhatsApp', hint: 'Link către canalul de WhatsApp', placeholder: 'ex: https://whatsapp.com/channel/...', span: 2 },
                { key: 'addressDisplay', label: 'Adresă afișată', hint: 'Textul adresei care apare pe site', placeholder: 'ex: Patinoarul AFI Cotroceni, București', span: 2 },
                {
                  key: 'addressMapsUrl',
                  label: 'Link hartă (opțional)',
                  hint: 'Lasă gol și adresa duce automat la o căutare Google Maps. Completează doar dacă vrei un loc anume: deschide locația în Google Maps, apasă Partajează, copiază linkul.',
                  placeholder: 'ex: https://maps.app.goo.gl/...',
                  span: 2,
                },
              ]}
            />
          </div>
        )}

        {!page.loading && !page.error && (
          <SaveBar {...page.saveState.bar} onSave={() => void page.save(form.value)} onDiscard={form.reset} />
        )}
      </Window>

      <UnsavedGuard when={form.dirty} />
    </AdminPage>
  );
};

export default SetariSitePage;
```

- [ ] **Step 4: The content-manager registration editor**

Replace the whole of `src/plugins/component-preview/admin/src/SiteSettingsRegistrationEditor.tsx` with:

```tsx
import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Field, Flex, Toggle, Typography } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { HelpTip } from './components/HelpTip';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

/**
 * Only `open` is edited. The retired season keys (currentSeason, seasonStartDate, seasonEndDate)
 * stay in the stored object untouched (spec 1.6); seasons are edited on the Sezoane page.
 */
type RegistrationData = { open: boolean } & Record<string, unknown>;

const EMPTY: RegistrationData = { open: false };

function LabelWithTip({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <Flex gap={2} alignItems="center">
      <Field.Label>{children}</Field.Label>
      <HelpTip label={tip} />
    </Flex>
  );
}

const readValue = (v: unknown): RegistrationData =>
  v && typeof v === 'object' && !Array.isArray(v) ? { ...EMPTY, ...(v as RegistrationData) } : EMPTY;

export default function SiteSettingsRegistrationEditor({ name }: Props) {
  const field = useField(name);
  const [data, setData] = React.useState<RegistrationData>(() => readValue(field.value));

  React.useEffect(() => {
    if (field.value && typeof field.value === 'object') setData(readValue(field.value));
  }, [field.value]);

  const commit = (next: RegistrationData) => {
    setData(next);
    field.onChange(name, next);
  };

  return (
    <Box width="100%">
      <EditorCard title="Înscrieri" description="Starea înscrierilor pe site.">
        <Box padding={4}>
          <Field.Root id={`${name}-open`} name="open" width="100%">
            <LabelWithTip tip="Când este activ, pe site se afișează secțiunea de înscrieri. Când este inactiv, apare mesajul că înscrierile sunt închise.">
              Înscrieri deschise
            </LabelWithTip>
            <Box marginTop={2}>
              <Flex gap={3} alignItems="center" wrap="wrap">
                <Toggle
                  id={`${name}-open`}
                  checked={data.open}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => commit({ ...data, open: e.target.checked })}
                  onLabel="Deschise"
                  offLabel="Închise"
                />
                <Typography variant="omega" fontWeight="semiBold" textColor={data.open ? 'success600' : 'neutral500'}>
                  {data.open ? 'Vizibile pe site' : 'Închise'}
                </Typography>
              </Flex>
            </Box>
          </Field.Root>
        </Box>
      </EditorCard>
    </Box>
  );
}
```

- [ ] **Step 5: Remove the old pricing tiers editor**

In `src/plugins/component-preview/admin/src/index.ts` delete this block (it sits between the `rules-table` and `footer-notes` registrations):

```ts
    app.customFields.register({
      name: 'pricing-tiers',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.pricing-tiers.label',
        defaultMessage: 'Tarife cursuri',
      },
      intlDescription: {
        id: 'component-preview.pricing-tiers.description',
        defaultMessage: 'Tabel editabil cu tarifele pentru membri și non-membri',
      },
      components: {
        Input: async () => import('./PricingTiersEditor').then(m => ({ default: m.default as any })),
      },
    });

```

Then:

```bash
git rm src/plugins/component-preview/admin/src/PricingTiersEditor.tsx
```

In `src/api/pricing/content-types/pricing/schema.json` delete the line

```json
      "customField": "plugin::component-preview.pricing-tiers",
```

(`tiers` stays `"type": "json"`, so the column and its data are untouched; the content-manager view, reachable only with `?strapi=1`, shows it as plain JSON.)

- [ ] **Step 6: Regenerate the types and run the checks**

Run: `DATABASE_CLIENT=postgres npx strapi ts:generate-types` (no database is contacted).
Expected: `types/generated/contentTypes.d.ts` loses `Schema.Attribute.CustomField<'plugin::component-preview.pricing-tiers'>` on `tiers`; nothing else changes.
Run: `npm test` (all PASS), `npx tsc --noEmit`, `npx tsc --noEmit -p src/admin/tsconfig.json` (zero errors).

- [ ] **Step 7: Commit**

```bash
git add src/admin/pages/SetariSitePage.tsx src/plugins/component-preview/admin/src/SiteSettingsRegistrationEditor.tsx \
  src/plugins/component-preview/admin/src/index.ts src/api/pricing/content-types/pricing/schema.json \
  types/generated src/club/__tests__/admin-retired-editors.test.ts
git commit -m "feat(admin): Setări site keeps only Înscrieri deschise; retire the old pricing editor"
```

---

### Task 7: Prețuri page

**Files:**
- Modify (whole file below): `src/admin/pages/PreturiPage.tsx`
- Create: `src/admin/pages/preturi/usePrices.ts`, `format.ts`, `PriceListCard.tsx`, `PriceItemDrawer.tsx`, `NewListDrawer.tsx`, `PriceNotesCard.tsx`, `useNotesDraft.ts`, `SectionPrices.tsx`

**Interfaces:**
- Consumes: Task 2 types (`AdminPrices`, `AdminPriceList`, `AdminPriceItem`, `AdminSection`; type-only imports), 2A `PriceItemKind` (type-only), Task 4 routes, Task 5 `DrawerSection` without a title, `src/admin/ui` (`AdminPage`, `Window`, `PageHeader`, `Tabs`, `EditorCard`, `DataTable`, `Notice`, `StatusBadge`, `Button`, `Drawer`, `Field`, `FieldRow`, `Input`, `NumberInput`, `Select`, `Textarea`, `RepeatableList`, `EmptyState`, `SaveBar`, `UnsavedGuard`, `useSaveState`, `Loading`), `ConfirmDialog`, `IconPlus`.
- Produces: the page at `PRETURI_TO` (`/plugins/edusport-preturi`, route unchanged).

What the page does (design phase2-designs-v1, option A; spec 2):
- Tabs per section in the sections' `order` ("Școala de patinaj", "Club"). Subtitle "Listele de prețuri pe secțiuni." (the design's "și sezonul curent" is dropped: the season now has its own page).
- One EditorCard per price list (title = list name, description = section name, header action "Adaugă preț"), with a DataTable: Nume (a muted `*` after names with a tooltip), Tip, Ședințe, Membri, Non-membri. Prices as "520 RON"; a single missing price as "-"; an item with both prices missing gets two "Lipsă" warning badges and the card a warning Notice titled "Preț incomplet" (title only). Under a card with tooltips: "* are tooltip. Clic pe rând pentru editare."
- Row click opens a Drawer with Nume, Tip, Ședințe, Preț membri, Preț non-membri, Tooltip (hint "Opțional", no placeholder), footer "Șterge" (existing rows; ConfirmDialog "Ștergi prețul?"), "Anulează", "Salvează". Save and delete go to the server at once; a refusal (duplicate name, stale row, bad price) shows as the toast and stays in the drawer.
- "+ Listă nouă" (name and section, preselected to the open tab) after the cards; a tab without lists shows only "Nicio listă de prețuri" with "Listă nouă".
- "Notițe subsol" card at the bottom of each school tab (not Club, as in the design): one textarea per paragraph (RepeatableList, "Adaugă notă"), saved with the page SaveBar; UnsavedGuard while dirty.
- Prices are typed as text (the design shows plain inputs) and sent as numbers; anything else is sent as typed and the server answers "Prețul nu este valid.".

- [ ] **Step 1: Data hook and formatting**

`src/admin/pages/preturi/usePrices.ts`:

```ts
import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { AdminPrices } from '../../../club/price-admin';

/** Admin API of this page: src/api/club/routes/03-admin-prices-seasons.ts. */
export const PRICES_API = '/api/club/prices';
export const LISTS_API = '/api/club/price-lists';
export const SECTIONS_API = '/api/club/sections';

export type PricesClient = ReturnType<typeof useFetchClient>;
/** Every Prețuri action answers with the whole page data. */
export type PricesAnswer = Promise<{ data: { data: AdminPrices } }>;

export interface PricesState {
  data: AdminPrices | null;
  error: boolean;
  /** Runs one request and replaces the page data with its answer. Throws the server's message. */
  mutate: (run: (client: PricesClient) => PricesAnswer) => Promise<void>;
}

/** Loads the Prețuri page data once; every action answers with fresh data. */
export function usePrices(): PricesState {
  const client = useFetchClient();
  const clientRef = React.useRef(client);
  clientRef.current = client;
  const [data, setData] = React.useState<AdminPrices | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let off = false;
    clientRef.current
      .get<{ data: AdminPrices }>(PRICES_API)
      .then((r) => !off && setData(r.data.data))
      .catch(() => !off && setError(true));
    return () => {
      off = true;
    };
  }, []);

  const mutate = React.useCallback(async (run: (c: PricesClient) => PricesAnswer) => {
    const r = await run(clientRef.current);
    setData(r.data.data);
  }, []);

  return { data, error, mutate };
}
```

`src/admin/pages/preturi/format.ts`:

```ts
import type { PriceItemKind } from '../../../club/price-item';
import type { AdminPriceItem } from '../../../club/price-admin';

export const KIND_LABELS: Record<PriceItemKind, string> = {
  subscription: 'Abonament',
  session: 'Ședință',
  individual: 'Lecție individuală',
};

export const KIND_OPTIONS = (Object.keys(KIND_LABELS) as PriceItemKind[]).map((value) => ({ value, label: KIND_LABELS[value] }));

/** "520 RON", or "-" for a single missing price (normal, e.g. 1 ședință grup has no member price). */
export const priceText = (price: number | null) => (price === null ? '-' : `${price} RON`);

/** Price input text -> number for the API; an empty field is no price. Anything else is sent as typed, and refused there. */
export function priceValue(text: string): number | null | string {
  const t = text.trim();
  if (t === '') return null;
  return /^\d+$/.test(t) ? Number(t) : t;
}

export const priceInput = (price: number | null) => (price === null ? '' : String(price));

export const hasTooltip = (items: AdminPriceItem[]) => items.some((i) => i.tooltip);
```

- [ ] **Step 2: The list card**

`src/admin/pages/preturi/PriceListCard.tsx`:

```tsx
import * as React from 'react';
import { Button, DataTable, EditorCard, Notice, StatusBadge, type DataColumn } from '../../ui';
import { IconPlus } from '../../ui/icons';
import type { AdminPriceItem, AdminPriceList } from '../../../club/price-admin';
import { KIND_LABELS, hasTooltip, priceText } from './format';

type Row = AdminPriceItem & { index: number };

const missing = <StatusBadge tone="warning">Lipsă</StatusBadge>;

const priceCell = (pick: (r: Row) => number | null) => (r: Row) => (r.incomplete ? missing : priceText(pick(r)));

const COLUMNS: DataColumn<Row>[] = [
  {
    key: 'name',
    header: 'Nume',
    render: (r) => (
      <>
        {r.name}
        {r.tooltip && <span className="ui-hint" style={{ display: 'inline' }}> *</span>}
      </>
    ),
  },
  { key: 'kind', header: 'Tip', render: (r) => KIND_LABELS[r.kind] },
  { key: 'sessions', header: 'Ședințe', render: (r) => (r.sessions === null ? '-' : String(r.sessions)) },
  { key: 'memberPrice', header: 'Membri', render: priceCell((r) => r.memberPrice) },
  { key: 'nonMemberPrice', header: 'Non-membri', render: priceCell((r) => r.nonMemberPrice) },
];

export interface PriceListCardProps {
  list: AdminPriceList;
  sectionName: string;
  onAdd: () => void;
  onOpen: (index: number) => void;
}

/** One price list: compact table, row click opens the drawer (phase2-designs-v1, option A). */
export function PriceListCard({ list, sectionName, onAdd, onOpen }: PriceListCardProps) {
  const rows = React.useMemo(() => list.items.map((item, index) => ({ ...item, index })), [list.items]);
  const add = (
    <Button variant="ghost" size="sm" icon={<IconPlus />} onClick={onAdd}>
      Adaugă preț
    </Button>
  );
  return (
    <EditorCard title={list.name} description={sectionName} headerAction={add}>
      {list.items.some((i) => i.incomplete) && <Notice tone="warning" title="Preț incomplet" />}
      <DataTable<Row>
        columns={COLUMNS}
        rows={rows}
        getRowKey={(r) => `${r.index}-${r.name}`}
        onRowClick={(r) => onOpen(r.index)}
        rowLabel={(r) => `Editează ${r.name}`}
        pageSize={0}
        empty="Niciun preț"
      />
      {hasTooltip(list.items) && <p className="ui-hint">* are tooltip. Clic pe rând pentru editare.</p>}
    </EditorCard>
  );
}
```

- [ ] **Step 3: The drawers**

`src/admin/pages/preturi/PriceItemDrawer.tsx`:

```tsx
import * as React from 'react';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Button, Drawer, DrawerSection, Field, FieldRow, Input, NumberInput, Select, Textarea, useSaveState } from '../../ui';
import type { AdminPriceItem, AdminPriceList } from '../../../club/price-admin';
import type { PriceItemKind } from '../../../club/price-item';
import { KIND_OPTIONS, priceInput, priceValue } from './format';
import { LISTS_API, type PricesState } from './usePrices';

/** What the drawer edits: the open list, and the row (null for "Adaugă preț"). */
export type ItemTarget = { list: AdminPriceList; index: number | null };

type Draft = { name: string; kind: PriceItemKind; sessions: number | null; memberPrice: string; nonMemberPrice: string; tooltip: string };

const EMPTY: Draft = { name: '', kind: 'subscription', sessions: null, memberPrice: '', nonMemberPrice: '', tooltip: '' };

function toDraft(item: AdminPriceItem | undefined): Draft {
  if (!item) return EMPTY;
  const { name, kind, sessions, memberPrice, nonMemberPrice, tooltip } = item;
  return { name, kind, sessions, memberPrice: priceInput(memberPrice), nonMemberPrice: priceInput(nonMemberPrice), tooltip: tooltip ?? '' };
}

const toBody = (d: Draft) => ({ ...d, memberPrice: priceValue(d.memberPrice), nonMemberPrice: priceValue(d.nonMemberPrice) });

function DraftFields({ draft, set }: { draft: Draft; set: (patch: Partial<Draft>) => void }) {
  return (
    <>
      <FieldRow>
        <Field label="Nume" required>
          <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Tip">
          <Select value={draft.kind} options={KIND_OPTIONS} onChange={(v) => set({ kind: v as PriceItemKind })} />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Ședințe">
          <NumberInput value={draft.sessions} min={0} label="Ședințe" onChange={(v) => set({ sessions: v })} />
        </Field>
        <Field label="Preț membri">
          <Input inputMode="numeric" value={draft.memberPrice} onChange={(e) => set({ memberPrice: e.target.value })} />
        </Field>
      </FieldRow>
      <Field label="Preț non-membri">
        <Input inputMode="numeric" value={draft.nonMemberPrice} onChange={(e) => set({ nonMemberPrice: e.target.value })} />
      </Field>
      <Field label="Tooltip" hint="Opțional">
        <Textarea rows={2} value={draft.tooltip} onChange={(e) => set({ tooltip: e.target.value })} />
      </Field>
    </>
  );
}

/** Save and delete requests for one row; each answers with the whole page data. */
function useItemActions(target: ItemTarget | null, mutate: PricesState['mutate']) {
  const base = target ? `${LISTS_API}/${target.list.documentId}/items` : '';
  const expectedName = target && target.index !== null ? target.list.items[target.index]?.name ?? '' : '';
  const save = (draft: Draft) =>
    mutate((c) =>
      target?.index === null ? c.post(base, toBody(draft)) : c.put(`${base}/${target?.index}`, { item: toBody(draft), expectedName }),
    );
  const remove = () => mutate((c) => c.del(`${base}/${target?.index}`, { params: { expectedName } }));
  return { save, remove };
}

type FooterProps = { canDelete: boolean; saving: boolean; onDelete: () => void; onCancel: () => void; onSave: () => void };

function ItemFooter({ canDelete, saving, onDelete, onCancel, onSave }: FooterProps) {
  return (
    <>
      {canDelete && (
        <Button variant="danger" size="sm" onClick={onDelete} disabled={saving}>
          Șterge
        </Button>
      )}
      <span style={{ flex: 1 }} />
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
        Anulează
      </Button>
      <Button variant="primary" size="sm" loading={saving} onClick={onSave}>
        Salvează
      </Button>
    </>
  );
}

export interface PriceItemDrawerProps {
  target: ItemTarget | null;
  mutate: PricesState['mutate'];
  onClose: () => void;
}

/** The form state of the open row; a new target (or the same row after fresh data) restarts it. */
function useDraft(target: ItemTarget | null, item: AdminPriceItem | undefined, reset: () => void) {
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  React.useEffect(() => {
    setDraft(toDraft(item));
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return { draft, set: (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })) };
}

/** Nume, Tip, Ședințe, Preț membri, Preț non-membri, Tooltip; "Șterge" asks first. */
export function PriceItemDrawer({ target, mutate, onClose }: PriceItemDrawerProps) {
  const item = target && target.index !== null ? target.list.items[target.index] : undefined;
  const state = useSaveState();
  const { draft, set } = useDraft(target, item, state.reset);
  const [confirming, setConfirming] = React.useState(false);
  const actions = useItemActions(target, mutate);
  const run = async (action: () => Promise<void>) => (await state.run(action)) && onClose();
  const footer = (
    <ItemFooter canDelete={Boolean(item)} saving={state.saving} onDelete={() => setConfirming(true)} onCancel={onClose} onSave={() => void run(() => actions.save(draft))} />
  );
  return (
    <Drawer open={target !== null} onClose={onClose} title={item?.name || 'Preț nou'} dismissable={!state.saving} footer={footer}>
      <DrawerSection>
        <DraftFields draft={draft} set={set} />
      </DrawerSection>
      <ConfirmDialog
        open={confirming}
        title="Ștergi prețul?"
        message={`„${item?.name ?? ''}” dispare din listă, de pe site și din formular.`}
        confirmLabel="Șterge"
        busy={state.saving}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void run(actions.remove).then(() => setConfirming(false))}
      />
    </Drawer>
  );
}
```

`src/admin/pages/preturi/NewListDrawer.tsx`:

```tsx
import * as React from 'react';
import { Button, Drawer, DrawerSection, Field, Input, Select, useSaveState } from '../../ui';
import type { AdminSection } from '../../../club/price-admin';
import { LISTS_API, type PricesState } from './usePrices';

export interface NewListDrawerProps {
  open: boolean;
  sections: AdminSection[];
  /** The tab the admin is on; preselected. */
  sectionId: string;
  mutate: PricesState['mutate'];
  onClose: () => void;
}

function Footer({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <>
      <span style={{ flex: 1 }} />
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
        Anulează
      </Button>
      <Button variant="primary" size="sm" loading={saving} onClick={onSave}>
        Salvează
      </Button>
    </>
  );
}

/** "+ Listă nouă": name and school. */
export function NewListDrawer({ open, sections, sectionId, mutate, onClose }: NewListDrawerProps) {
  const [name, setName] = React.useState('');
  const [section, setSection] = React.useState(sectionId);
  const state = useSaveState();
  React.useEffect(() => {
    if (!open) return;
    setName('');
    setSection(sectionId);
    state.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sectionId]);
  const save = async () => (await state.run(() => mutate((c) => c.post(LISTS_API, { name, sectionId: section })))) && onClose();
  const footer = <Footer saving={state.saving} onCancel={onClose} onSave={() => void save()} />;
  return (
    <Drawer open={open} onClose={onClose} title="Listă nouă" dismissable={!state.saving} footer={footer}>
      <DrawerSection>
        <Field label="Nume" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Secțiune">
          <Select value={section} options={sections.map((s) => ({ value: s.documentId, label: s.name }))} onChange={setSection} />
        </Field>
      </DrawerSection>
    </Drawer>
  );
}
```

- [ ] **Step 4: Notițe subsol**

`src/admin/pages/preturi/PriceNotesCard.tsx` (`useRowKeys` moves here unchanged from the old page):

```tsx
import * as React from 'react';
import { EditorCard, RepeatableList, Textarea } from '../../ui';

/**
 * Stable React keys for a list of plain strings: a row keeps its key while it is edited, moved or
 * when rows around it are added or removed, so the textareas keep focus. (Moved here from the old
 * PreturiPage unchanged.)
 */
export function useRowKeys<T>(items: readonly T[]): (item: T, index: number) => number {
  const ref = React.useRef<{ items: readonly T[]; keys: number[]; next: number }>({ items: [], keys: [], next: 1 });
  const st = ref.current;
  if (st.items !== items) {
    const used = new Set<number>();
    const keys: Array<number | undefined> = items.map((it, i) => {
      if (i < st.items.length && Object.is(st.items[i], it)) {
        used.add(i);
        return st.keys[i];
      }
      return undefined;
    });
    items.forEach((it, i) => {
      if (keys[i] !== undefined) return;
      const j = st.items.findIndex((old, k) => !used.has(k) && Object.is(old, it));
      if (j >= 0) {
        used.add(j);
        keys[i] = st.keys[j];
      }
    });
    const leftover = st.keys.filter((_, k) => !used.has(k));
    st.keys = keys.map((k) => k ?? leftover.shift() ?? st.next++);
    st.items = items;
  }
  return (_item, index) => st.keys[index];
}

export interface PriceNotesCardProps {
  notes: string[];
  onChange: (notes: string[]) => void;
}

/** "Notițe subsol" of one school: paragraphs under the price section of its page. Saved with the page SaveBar. */
export function PriceNotesCard({ notes, onChange }: PriceNotesCardProps) {
  const keyOf = useRowKeys(notes);
  return (
    <EditorCard title="Notițe subsol" description="Textele afișate în subsolul secțiunii de prețuri de pe site.">
      <RepeatableList<string>
        items={notes}
        onChange={onChange}
        getKey={keyOf}
        newItem={() => ''}
        addLabel="Adaugă notă"
        emptyLabel="Nicio notă"
        aria-label="Notițe subsol"
        itemLabel={(_, i) => `nota ${i + 1}`}
        renderRow={(note, i, row) => (
          <Textarea aria-label={`Notă ${i + 1}`} rows={2} value={note} onChange={(e) => row.update(e.target.value)} />
        )}
      />
    </EditorCard>
  );
}
```

`src/admin/pages/preturi/useNotesDraft.ts`:

```ts
import * as React from 'react';
import { useSaveState, type SaveBarState } from '../../ui';
import { SECTIONS_API, type PricesState } from './usePrices';

const sameNotes = (a: string[], b: string[]) => a.length === b.length && a.every((n, i) => n === b[i]);

export interface NotesDraft {
  value: (sectionId: string) => string[];
  set: (sectionId: string, notes: string[]) => void;
  dirty: boolean;
  bar: SaveBarState;
  save: () => Promise<boolean>;
  reset: () => void;
}

/** "Notițe subsol" edits of every school tab, saved together by the page SaveBar. */
export function useNotesDraft(prices: PricesState): NotesDraft {
  const [drafts, setDrafts] = React.useState<Record<string, string[]>>({});
  const state = useSaveState();
  const loaded = (id: string) => prices.data?.sections.find((s) => s.documentId === id)?.priceNotes ?? [];
  const changed = Object.keys(drafts).filter((id) => !sameNotes(drafts[id], loaded(id)));
  const save = () =>
    state.run(async () => {
      for (const id of changed) {
        await prices.mutate((c) => c.put(`${SECTIONS_API}/${id}/price-notes`, { priceNotes: drafts[id] }));
      }
      setDrafts({});
    });
  const reset = () => {
    setDrafts({});
    state.reset();
  };
  return {
    value: (id) => drafts[id] ?? loaded(id),
    set: (id, notes) => setDrafts((d) => ({ ...d, [id]: notes })),
    dirty: changed.length > 0,
    bar: { ...state.bar, dirty: changed.length > 0 },
    save,
    reset,
  };
}
```

- [ ] **Step 5: One tab, and the page**

`src/admin/pages/preturi/SectionPrices.tsx`:

```tsx
import * as React from 'react';
import { Button, EmptyState } from '../../ui';
import { IconPlus } from '../../ui/icons';
import type { AdminPriceList, AdminSection } from '../../../club/price-admin';
import { PriceListCard } from './PriceListCard';
import { PriceNotesCard } from './PriceNotesCard';
import type { ItemTarget } from './PriceItemDrawer';
import type { NotesDraft } from './useNotesDraft';

export interface SectionPricesProps {
  section: AdminSection;
  lists: AdminPriceList[];
  notes: NotesDraft;
  onOpen: (target: ItemTarget) => void;
  onNewList: () => void;
}

/** One tab: a card per price list, "+ Listă nouă", and "Notițe subsol" for a school. */
export function SectionPrices({ section, lists, notes, onOpen, onNewList }: SectionPricesProps) {
  const newList = (
    <Button variant="secondary" size="sm" icon={<IconPlus />} onClick={onNewList}>
      Listă nouă
    </Button>
  );
  if (lists.length === 0) return <EmptyState action={newList}>Nicio listă de prețuri</EmptyState>;
  return (
    <>
      {lists.map((list) => (
        <PriceListCard
          key={list.documentId}
          list={list}
          sectionName={section.name}
          onAdd={() => onOpen({ list, index: null })}
          onOpen={(index) => onOpen({ list, index })}
        />
      ))}
      <div>{newList}</div>
      {section.kind === 'school' && (
        <PriceNotesCard notes={notes.value(section.documentId)} onChange={(next) => notes.set(section.documentId, next)} />
      )}
    </>
  );
}
```

Replace the whole of `src/admin/pages/PreturiPage.tsx` with:

```tsx
import * as React from 'react';
import { AdminPage, Loading, Notice, PageHeader, SaveBar, Tabs, UnsavedGuard, Window } from '../ui';
import { DASHBOARD_TO } from '../dashboard/menu';
import { NewListDrawer } from './preturi/NewListDrawer';
import { PriceItemDrawer, type ItemTarget } from './preturi/PriceItemDrawer';
import { SectionPrices } from './preturi/SectionPrices';
import { useNotesDraft, type NotesDraft } from './preturi/useNotesDraft';
import { usePrices, type PricesState } from './preturi/usePrices';

/**
 * Prețuri (/plugins/edusport-preturi): the club price lists (api::price-list) per section, with
 * tooltips, and each school's "Notițe subsol" (section.priceNotes). Approved design:
 * phase2-designs-v1, option A. Data and every change go through /api/club/prices and friends
 * (src/api/club/routes/03-admin-prices-seasons.ts); each change writes a history entry there.
 * The old `pricing` single type stays in the database, unread (spec 1.6).
 */
type BodyProps = {
  prices: PricesState;
  notes: NotesDraft;
  tab: string;
  onTab: (id: string) => void;
  onOpen: (target: ItemTarget) => void;
  onNewList: () => void;
};

/** Loading, load error, or the section tabs with the open tab's lists. */
function PricesBody({ prices, notes, tab, onTab, onOpen, onNewList }: BodyProps) {
  if (prices.error) {
    return (
      <div className="ui-body">
        <Notice tone="danger">Nu am putut încărca prețurile.</Notice>
      </div>
    );
  }
  if (!prices.data) return <Loading />;
  const { sections, lists } = prices.data;
  const section = sections.find((s) => s.documentId === tab) ?? sections[0];
  return (
    <div className="ui-body">
      <Tabs items={sections.map((s) => ({ id: s.documentId, label: s.name }))} value={section?.documentId ?? ''} onChange={onTab} label="Secțiuni" />
      {section && (
        <SectionPrices section={section} lists={lists.filter((l) => l.sectionId === section.documentId)} notes={notes} onOpen={onOpen} onNewList={onNewList} />
      )}
    </div>
  );
}

const PreturiPage: React.FC = () => {
  const prices = usePrices();
  const notes = useNotesDraft(prices);
  const [tab, setTab] = React.useState('');
  const [target, setTarget] = React.useState<ItemTarget | null>(null);
  const [newList, setNewList] = React.useState(false);
  const sections = prices.data?.sections ?? [];
  const sectionId = (sections.find((s) => s.documentId === tab) ?? sections[0])?.documentId ?? '';

  return (
    <AdminPage>
      <Window>
        <PageHeader back={{ to: DASHBOARD_TO }} title="Prețuri" subtitle="Listele de prețuri pe secțiuni." />
        <PricesBody prices={prices} notes={notes} tab={tab} onTab={setTab} onOpen={setTarget} onNewList={() => setNewList(true)} />
        <SaveBar {...notes.bar} onSave={() => void notes.save()} onDiscard={notes.reset} />
      </Window>
      <PriceItemDrawer target={target} mutate={prices.mutate} onClose={() => setTarget(null)} />
      <NewListDrawer open={newList} sections={sections} sectionId={sectionId} mutate={prices.mutate} onClose={() => setNewList(false)} />
      <UnsavedGuard when={notes.dirty} />
    </AdminPage>
  );
};

export default PreturiPage;
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p src/admin/tsconfig.json` (zero errors), `npm test` (all PASS), `npx tsc --noEmit` (zero errors). The page is seen in a browser in Task 11.

- [ ] **Step 7: Commit**

```bash
git add src/admin/pages/PreturiPage.tsx src/admin/pages/preturi
git commit -m "feat(admin): Prețuri page on the club price lists, with tooltips and notes"
```

---

### Task 8: Sezoane page, route and sidebar entry

**Files:**
- Create: `src/admin/pages/SezoanePage.tsx`, `src/admin/pages/sezoane/useSeasons.ts`, `src/admin/pages/sezoane/SeasonDrawer.tsx`
- Modify: `src/admin/pages/routes.ts` (constant, `UID.season`, `CUSTOM_PAGES` entry)
- Modify: `src/admin/dashboard/menu.tsx` (import, re-export, sidebar link)
- Modify: `src/admin/dashboard/EdusportShell.tsx` (pinned-row icon)
- Modify: `docs/admin-ui/CUSTOM-PAGES.md` (route table)
- Test: `src/club/__tests__/admin-sezoane-route.test.ts`

**Interfaces:**
- Consumes: Task 3 (`formatPeriod`, `nextSeasonDraft`, `monthOptions` at runtime; `AdminSeason`, `SeasonFields` types), Task 4 routes, Task 5 `DrawerSection` without a title, `src/admin/ui`.
- Produces: `SEZOANE_TO = '/plugins/edusport-sezoane'` (exported from `pages/routes.ts` and re-exported from `dashboard/menu.tsx`), the Sezoane page, and the sidebar entry "Sezoane", pinned at the top between "Setări site" and "Meniu site", with the calendar icon.

What the page does (design phase2-designs-v1, question 2, option A; spec 2):
- PageHeader "Sezoane", subtitle "Sezoanele școlii, taxa de membru și sezonul curent.", action "Sezon nou" (primary, plus icon).
- DataTable: Sezon, Perioadă ("Octombrie 2026 - Mai 2027"), Taxă de membru ("270 RON" or "-"), Curent (success badge "Curent"). Newest first. Hint under it: "Clic pe un rând deschide editarea lui într-un panou lateral."
- Row click opens a Drawer "Sezon 2026-2027" with Sezon, Început and Sfârșit (month and year selects over the season's two years), Taxă de membru (NumberInput, hint "RON"). The Sezon field is disabled with the hint "Sezonul are înscrieri." when registrations point at the season. "Sezon nou" opens the same drawer titled "Sezon nou", prefilled one year after the newest season.

Sidebar placement (user, 2026-10-21): pinned at the top of the sidebar next to Setări site, between "Setări site" and "Meniu site"; not in the Sistem group. `EdusportShell` renders pinned links in `EDUSPORT_LINKS` order with an icon from `PINNED_ICON` (default `gear`, which Setări site already uses), so Sezoane gets `calendar`.

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/admin-sezoane-route.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { CUSTOM_PAGES, PRETURI_TO, SEZOANE_TO } from '../../admin/pages/routes';

it('Sezoane is a custom page; Prețuri keeps its route', () => {
  expect(SEZOANE_TO).toBe('/plugins/edusport-sezoane');
  expect(CUSTOM_PAGES.find((p) => p.to === SEZOANE_TO)).toMatchObject({ uid: 'api::season.season', kind: 'collection', role: 'main', redirect: false });
  expect(CUSTOM_PAGES.find((p) => p.to === PRETURI_TO)).toBeDefined();
});

it('the sidebar pins Sezoane at the top, between Setări site and Meniu site, with a calendar icon', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');
  expect(read('admin/dashboard/menu.tsx')).toMatch(
    /\{ to: SETARI_SITE_TO,[^\n]*pinned: true \},\n\s*\{ to: SEZOANE_TO, label: 'Sezoane', icon: Calendar, group: 'system', pinned: true \},\n\s*\{ to: NAVIGATION_TO,/,
  );
  expect(read('admin/dashboard/EdusportShell.tsx')).toContain("[SEZOANE_TO]: 'calendar'");
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- src/club/__tests__/admin-sezoane-route.test.ts`
Expected: FAIL (`SEZOANE_TO` is undefined).

- [ ] **Step 3: The page**

`src/admin/pages/sezoane/useSeasons.ts`:

```ts
import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { AdminSeason, SeasonFields } from '../../../club/season-admin';

/** Admin API of this page: src/api/club/routes/03-admin-prices-seasons.ts. */
export const SEASONS_API = '/api/club/seasons';

export interface SeasonsState {
  seasons: AdminSeason[] | null;
  error: boolean;
  /** Creates (no documentId) or updates a season; the answer replaces the table. Throws the server's message. */
  save: (documentId: string | null, fields: SeasonFields) => Promise<void>;
}

export function useSeasons(): SeasonsState {
  const client = useFetchClient();
  const clientRef = React.useRef(client);
  clientRef.current = client;
  const [seasons, setSeasons] = React.useState<AdminSeason[] | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let off = false;
    clientRef.current
      .get<{ data: AdminSeason[] }>(SEASONS_API)
      .then((r) => !off && setSeasons(r.data.data))
      .catch(() => !off && setError(true));
    return () => {
      off = true;
    };
  }, []);

  const save = React.useCallback(async (documentId: string | null, fields: SeasonFields) => {
    const c = clientRef.current;
    const r = documentId
      ? await c.put<{ data: AdminSeason[] }>(`${SEASONS_API}/${documentId}`, fields)
      : await c.post<{ data: AdminSeason[] }>(SEASONS_API, fields);
    setSeasons(r.data.data);
  }, []);

  return { seasons, error, save };
}
```

`src/admin/pages/sezoane/SeasonDrawer.tsx`:

```tsx
import * as React from 'react';
import { Button, Drawer, DrawerSection, Field, FieldRow, Input, NumberInput, Select, useSaveState } from '../../ui';
import { monthOptions, type AdminSeason, type SeasonFields } from '../../../club/season-admin';

/** The drawer edits an existing season, or a new one prefilled by `nextSeasonDraft`. */
export type SeasonTarget = { season: AdminSeason | null; draft: SeasonFields };

function SeasonFieldsForm({ draft, locked, set }: { draft: SeasonFields; locked: boolean; set: (p: Partial<SeasonFields>) => void }) {
  const options = monthOptions(draft.label, [draft.startMonth, draft.endMonth]);
  return (
    <>
      <Field label="Sezon" hint={locked ? 'Sezonul are înscrieri.' : undefined}>
        <Input value={draft.label} disabled={locked} onChange={(e) => set({ label: e.target.value })} />
      </Field>
      <FieldRow>
        <Field label="Început">
          <Select value={draft.startMonth} options={options} onChange={(v) => set({ startMonth: v })} />
        </Field>
        <Field label="Sfârșit">
          <Select value={draft.endMonth} options={options} onChange={(v) => set({ endMonth: v })} />
        </Field>
      </FieldRow>
      <Field label="Taxă de membru" hint="RON">
        <NumberInput value={draft.membershipFee} min={0} label="Taxă de membru" onChange={(v) => set({ membershipFee: v })} />
      </Field>
    </>
  );
}

export interface SeasonDrawerProps {
  target: SeasonTarget | null;
  onSave: (documentId: string | null, fields: SeasonFields) => Promise<void>;
  onClose: () => void;
}

/** Sezon, Început, Sfârșit, Taxă de membru (phase2-designs-v1, question 2, option A). */
export function SeasonDrawer({ target, onSave, onClose }: SeasonDrawerProps) {
  const [draft, setDraft] = React.useState<SeasonFields | null>(null);
  const state = useSaveState();
  React.useEffect(() => {
    setDraft(target?.draft ?? null);
    state.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  const season = target?.season ?? null;
  const save = async () => {
    if (draft && (await state.run(() => onSave(season?.documentId ?? null, draft)))) onClose();
  };
  const footer = (
    <>
      <span style={{ flex: 1 }} />
      <Button variant="ghost" size="sm" onClick={onClose} disabled={state.saving}>Anulează</Button>
      <Button variant="primary" size="sm" loading={state.saving} onClick={() => void save()}>Salvează</Button>
    </>
  );
  return (
    <Drawer open={target !== null} onClose={onClose} title={season ? `Sezon ${season.label}` : 'Sezon nou'} dismissable={!state.saving} footer={footer}>
      <DrawerSection>
        {draft && <SeasonFieldsForm draft={draft} locked={(season?.registrations ?? 0) > 0} set={(p) => setDraft({ ...draft, ...p })} />}
      </DrawerSection>
    </Drawer>
  );
}
```

`src/admin/pages/SezoanePage.tsx`:

```tsx
import * as React from 'react';
import { AdminPage, Button, DataTable, Loading, Notice, PageHeader, StatusBadge, Window, type DataColumn } from '../ui';
import { IconPlus } from '../ui/icons';
import { DASHBOARD_TO } from '../dashboard/menu';
import { formatPeriod, nextSeasonDraft, type AdminSeason } from '../../club/season-admin';
import { SeasonDrawer, type SeasonTarget } from './sezoane/SeasonDrawer';
import { useSeasons } from './sezoane/useSeasons';

/**
 * Sezoane (/plugins/edusport-sezoane): the club seasons (api::season), their period and membership
 * fee. "+ Sezon nou" creates a season that is not current; making a season current is phase 4.
 * Data and changes go through /api/club/seasons (history entries are written there).
 */
const COLUMNS: DataColumn<AdminSeason>[] = [
  { key: 'label', header: 'Sezon' },
  { key: 'period', header: 'Perioadă', render: (s) => formatPeriod(s.startMonth, s.endMonth) },
  { key: 'membershipFee', header: 'Taxă de membru', render: (s) => (s.membershipFee === null ? '-' : `${s.membershipFee} RON`) },
  { key: 'isCurrent', header: 'Curent', render: (s) => (s.isCurrent ? <StatusBadge tone="success">Curent</StatusBadge> : null) },
];

function SeasonsTable({ seasons, onOpen }: { seasons: AdminSeason[]; onOpen: (s: AdminSeason) => void }) {
  return (
    <div className="ui-body">
      <DataTable<AdminSeason> columns={COLUMNS} rows={seasons} getRowKey={(s) => s.documentId} onRowClick={onOpen} rowLabel={(s) => `Editează sezonul ${s.label}`} pageSize={0} empty="Niciun sezon" />
      <p className="ui-hint">Clic pe un rând deschide editarea lui într-un panou lateral.</p>
    </div>
  );
}

const SezoanePage: React.FC = () => {
  const { seasons, error, save } = useSeasons();
  const [target, setTarget] = React.useState<SeasonTarget | null>(null);
  const open = (s: AdminSeason) =>
    setTarget({ season: s, draft: { label: s.label, startMonth: s.startMonth, endMonth: s.endMonth, membershipFee: s.membershipFee } });
  const add = () => setTarget({ season: null, draft: nextSeasonDraft(seasons ?? []) });
  const action = (
    <Button variant="primary" size="sm" icon={<IconPlus />} onClick={add} disabled={!seasons}>
      Sezon nou
    </Button>
  );
  return (
    <AdminPage>
      <Window>
        <PageHeader back={{ to: DASHBOARD_TO }} title="Sezoane" subtitle="Sezoanele școlii, taxa de membru și sezonul curent." actions={action} />
        {error ? (
          <div className="ui-body"><Notice tone="danger">Nu am putut încărca sezoanele.</Notice></div>
        ) : seasons ? (
          <SeasonsTable seasons={seasons} onOpen={open} />
        ) : (
          <Loading />
        )}
      </Window>
      <SeasonDrawer target={target} onSave={save} onClose={() => setTarget(null)} />
    </AdminPage>
  );
};

export default SezoanePage;
```

- [ ] **Step 4: Route and sidebar**

In `src/admin/pages/routes.ts`:

After `export const PRETURI_TO = '/plugins/edusport-preturi';` add

```ts
export const SEZOANE_TO = '/plugins/edusport-sezoane';
```

In `UID`, after `pricing: 'api::pricing.pricing',` add

```ts
  season: 'api::season.season',
```

Replace the `PRETURI_TO` line of `CUSTOM_PAGES`

```ts
  { to: PRETURI_TO, uid: UID.pricing, kind: 'single', role: 'main', redirect: true, load: () => import('./PreturiPage') },
```

with

```ts
  // Edits the club price lists now; old content-manager URLs of `pricing` still land here.
  { to: PRETURI_TO, uid: UID.pricing, kind: 'single', role: 'main', redirect: true, load: () => import('./PreturiPage') },
  // The season type is hidden from the content manager, so there is nothing to redirect.
  { to: SEZOANE_TO, uid: UID.season, kind: 'collection', role: 'main', redirect: false, load: () => import('./SezoanePage') },
```

In `src/admin/dashboard/menu.tsx`, in BOTH the import from `'../pages/routes'` and the re-export from `'../pages/routes'`, replace

```ts
  MOMENTE_ISTORIC_TO, CURSURI_TO, PRETURI_TO, REGULAMENT_TO, PAGINA_PROGRAM_TO,
```

with

```ts
  MOMENTE_ISTORIC_TO, CURSURI_TO, PRETURI_TO, SEZOANE_TO, REGULAMENT_TO, PAGINA_PROGRAM_TO,
```

and in `EDUSPORT_LINKS` replace

```ts
  { to: SETARI_SITE_TO, label: 'Setări site', icon: Pencil, group: 'system', pinned: true },
```

with

```ts
  { to: SETARI_SITE_TO, label: 'Setări site', icon: Pencil, group: 'system', pinned: true },
  { to: SEZOANE_TO, label: 'Sezoane', icon: Calendar, group: 'system', pinned: true },
```

(`Calendar` is already imported from `@strapi/icons`. `registerEdusportMenu` registers every `CUSTOM_PAGES` entry as a route.)

In `src/admin/dashboard/EdusportShell.tsx` replace

```tsx
import { EDUSPORT_LINKS, GROUP_LABEL, GROUP_ORDER, DASHBOARD_TO, UMAMI_URL, ANUNTURI_TO, NAVIGATION_TO } from './menu';
```

with

```tsx
import { EDUSPORT_LINKS, GROUP_LABEL, GROUP_ORDER, DASHBOARD_TO, UMAMI_URL, ANUNTURI_TO, NAVIGATION_TO, SEZOANE_TO } from './menu';
```

and replace

```tsx
const PINNED_ICON: Record<string, IconKey> = { [ANUNTURI_TO]: 'bell', [NAVIGATION_TO]: 'grid' };
```

with

```tsx
const PINNED_ICON: Record<string, IconKey> = { [ANUNTURI_TO]: 'bell', [NAVIGATION_TO]: 'grid', [SEZOANE_TO]: 'calendar' };
```

In `docs/admin-ui/CUSTOM-PAGES.md` replace the row

```
| Prețuri | api::pricing.pricing | /plugins/edusport-preturi | [x] |
```

with

```
| Prețuri | api::price-list.price-list, api::section.section (old api::pricing.pricing URLs land here) | /plugins/edusport-preturi | [x] |
| Sezoane | api::season.season | /plugins/edusport-sezoane | [x] |
```

- [ ] **Step 5: Run the checks**

Run: `npm test` (all PASS), `npx tsc --noEmit`, `npx tsc --noEmit -p src/admin/tsconfig.json` (zero errors).

- [ ] **Step 6: Commit**

```bash
git add src/admin/pages/SezoanePage.tsx src/admin/pages/sezoane src/admin/pages/routes.ts src/admin/dashboard/menu.tsx \
  src/admin/dashboard/EdusportShell.tsx docs/admin-ui/CUSTOM-PAGES.md src/club/__tests__/admin-sezoane-route.test.ts
git commit -m "feat(admin): Sezoane page with period and membership fee"
```

---

### Task 9: Înscrieri panel: new answers, PDFs, e-mail status, "Formulare goale"

**Files:**
- Create: `src/club/registration-panel.ts`
- Test: `src/club/__tests__/registration-panel.test.ts`
- Create: `src/admin/dashboard/inscrieri/downloadPdf.ts`, `BlankFormsMenu.tsx`, `RegistrationDocuments.tsx`, `RegistrationEmail.tsx`
- Modify: `src/admin/dashboard/SubmissionTable.tsx` (export `MenuButton`; `headerActions` in the config and the header)
- Modify (whole file below): `src/admin/dashboard/InscrieriPage.tsx`

**Interfaces:**
- Consumes: 2A (`MEMBERSHIP_YES`, `RELATIONSHIP_OPTIONS`, `RELATIONSHIP_OTHER`, `SOURCE_OTHER` from `registration-form-options.ts`; the registration fields). Plan 2D routes: `GET /api/club/registrations/:documentId/documents/:kind` and `GET /api/club/documents/blank/:kind` (`kind` = `acord` | `adeziune`), each answering a PDF with a `Content-Disposition` file name. Plan 2F routes: `GET /api/club/registrations/:documentId/email-status` and `POST /api/club/registrations/:documentId/resend-email`, each answering 200 `{ ok: true, data: RegistrationEmailStatus }` (2F plan, Task 8), or `{ ok: false, code, error }` (404 `not-found`, 409 `no-documents` "Înscrierea nu are documente.").
- Produces (`src/club/registration-panel.ts`): `type PanelDocumentKind = 'acord' | 'adeziune'` (mirrors 2D's `DocumentKind`), `type EmailStatus = { status: 'queued' | 'sent' | 'failed' | 'none'; recipient: string; attempts: number; lastError: string | null; sentAt: string | null; updatedAt: string | null; documents: string[] }` (mirrors 2F's `RegistrationEmailStatus`; `documents` are file names), `DOCUMENT_LABELS`, `MISSING`, `isScriptFormRegistration`, `registrationPanelRows`, `registrationDocumentKinds`, `readEmailStatus`, `emailStatusText`, `resendTarget`, `resendToast`, `failedEmailError`, `requestErrorText`, `fileNameFrom`.
- Produces (`SubmissionTable.tsx`): exported `MenuButton`; `SubmissionTableCfg.headerActions?: React.ReactNode`.

What the panel shows (spec 1.1, 4.1, 4.2; DECISIONS 2026-10-05):
- Same layout as today (label/value `DetailField` rows, long texts after a gap). "Nr. înscriere" first when set.
- A registration sent through the new form (it has `relationship` or `membershipAnswer`) shows: Data nașterii, Înălțime ("128 cm"), Nume părinte, Calitate (option label; with Alta, the typed text), Email, Telefon, Mărime tricou, Sezonul trecut, Membru A.C.S. (Da/Nu), Abonament ("Abonament 8 ședințe grup, 590 RON", the frozen choice), Cum a aflat ("Altele: <text>" when given), Acord GDPR, Acord Regulament, then Experiență anterioară and Așteptări. Older registrations keep their old rows (Nivel, Interes club, ...). An empty value shows "-" (the old panel's em dash goes).
- New registrations also get "Documente" (one button per PDF: Acord, plus Cerere de adeziune when the answer was Da; 2D builds a missing set on that request) and "E-mail" (status "Trimis <dată>", "În coadă", "Netrimis", or "Niciun e-mail" before the first job, and "Retrimite e-mailul"). The confirmation is titled "Retrimiți e-mailul?" and names the recipient ("Către: ...", 2F's address) and the documents ("Documente: ...", 2F's file names; before 2F answers, the labels "Acord, Cerere de adeziune"). A refusal shows 2F's own text (for example "Înscrierea nu are documente."). Logging the resend in history is 2F's job (spec 4.2).
- After "Retrimite e-mailul" the toast follows the status 2F answers after its one attempt: `sent` "E-mail trimis." (success), `queued` "E-mailul va fi trimis în curând." (info), `failed` "Trimiterea a eșuat." (error); a failed status also shows its `lastError` under the status in the panel.
- The search box reads "Caută după nume, număr, părinte, e-mail sau telefon..." (2E adds the registration number to the quick search), and the header stat reads "1 noi, exclus arhivate" (no middle dot).
- The header gets "Formulare goale", a menu with Acord and Cerere de adeziune (blank PDFs with season, period and fee, spec 4.1), until the Documente page exists.
- Deleting a registration asks "Ștergi definitiv această înscriere și documentele ei? Acțiunea nu poate fi anulată." (user, 2026-10-21; 2D deletes the files on the backend). The bulk delete text is unchanged.
- Downloads go through the admin fetch client with `responseType: 'blob'` (the admin token is a header, so a plain link would not work). A missing PDF (404) shows "Documentul nu a putut fi descărcat.".

- [ ] **Step 1: Write the failing test**

`src/club/__tests__/registration-panel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  MISSING,
  emailStatusText,
  fileNameFrom,
  readEmailStatus,
  registrationDocumentKinds,
  failedEmailError,
  registrationPanelRows,
  requestErrorText,
  resendTarget,
  resendToast,
  type EmailStatus,
} from '../registration-panel';

const scriptForm = {
  registrationNumber: '2026-0142',
  childName: 'Ana Pop',
  childBirthDate: '2018-03-02',
  childHeight: 128,
  parentName: 'Maria Pop',
  relationship: 'alta',
  relationshipOther: 'Bunică',
  email: 'maria@example.com',
  phone: '0722 000 000',
  shirtSize: '128',
  lastSeason: 'Începători',
  membershipAnswer: 'da',
  subscriptionChoice: { priceItemName: 'Abonament 8 ședințe grup', price: 590, member: true },
  source: 'Altele',
  sourceOther: 'Ziar',
  gdprConsent: true,
  regulationsConsent: true,
  priorExperience: 'Nu este cazul',
  expectations: '',
};

const value = (rows: { label: string; value: string }[], label: string) => rows.find((r) => r.label === label)?.value;

describe('registrationPanelRows', () => {
  it('shows the script form answers of a new registration, read-only', () => {
    const { rows, longRows } = registrationPanelRows(scriptForm);
    expect(rows[0]).toEqual({ label: 'Nr. înscriere', value: '2026-0142' });
    expect(value(rows, 'Calitate')).toBe('Bunică');
    expect(value(rows, 'Înălțime')).toBe('128 cm');
    expect(value(rows, 'Membru A.C.S.')).toBe('Da');
    expect(value(rows, 'Abonament')).toBe('Abonament 8 ședințe grup, 590 RON');
    expect(value(rows, 'Cum a aflat')).toBe('Altele: Ziar');
    expect(value(rows, 'Acord GDPR')).toBe('Da');
    expect(value(rows, 'Nivel')).toBeUndefined();
    expect(longRows).toEqual([
      { label: 'Experiență anterioară', value: 'Nu este cazul' },
      { label: 'Așteptări', value: MISSING },
    ]);
  });

  it('uses the option label for Părinte / Tutore Legal', () => {
    expect(value(registrationPanelRows({ ...scriptForm, relationship: 'tutore' }).rows, 'Calitate')).toBe('Tutore Legal');
  });

  it('keeps the old fields for registrations sent before phase 2', () => {
    const { rows } = registrationPanelRows({ childName: 'Ion', level: 'Avansati', howHeard: 'Facebook', clubInterest: true });
    expect(rows.map((r) => r.label)).toEqual([
      'Data nașterii', 'Nume părinte', 'Email', 'Telefon', 'Mărime tricou', 'Cum a aflat', 'Nivel',
      'Interes club', 'Acord regulament', 'Acord confidențialitate',
    ]);
    expect(value(rows, 'Nivel')).toBe('Avansati');
    expect(value(rows, 'Email')).toBe(MISSING);
  });
});

const status = (patch: Partial<EmailStatus>): EmailStatus => ({
  status: 'sent',
  recipient: 'maria@example.com',
  attempts: 1,
  lastError: null,
  sentAt: '2026-10-20T11:05:00.000Z',
  updatedAt: '2026-10-20T11:05:00.000Z',
  documents: ['Pop_Ana_Acord_2026-2027.pdf'],
  ...patch,
});

describe('documents and e-mail', () => {
  it('a member answer adds the Cerere de adeziune', () => {
    expect(registrationDocumentKinds(scriptForm)).toEqual(['acord', 'adeziune']);
    expect(registrationDocumentKinds({ ...scriptForm, membershipAnswer: 'nu' })).toEqual(['acord']);
  });

  it("reads 2F's status answer and ignores anything else", () => {
    expect(readEmailStatus({ ok: true, data: { ...status({}), documents: ['Pop_Ana_Acord_2026-2027.pdf', 3] } })).toEqual(status({}));
    expect(readEmailStatus({ ok: true, data: { status: 'none', recipient: 'maria@example.com', attempts: 0, documents: [] } })).toMatchObject({ status: 'none' });
    expect(readEmailStatus({ ok: false, code: 'not-found', error: 'x' })).toBeNull();
    expect(readEmailStatus({ data: { status: 'lost' } })).toBeNull();
  });

  it('describes the status tersely', () => {
    const fmt = () => '20 oct 2026, 14:05';
    expect(emailStatusText(null, fmt)).toBe('Niciun e-mail');
    expect(emailStatusText(status({ status: 'none' }), fmt)).toBe('Niciun e-mail');
    expect(emailStatusText(status({}), fmt)).toBe('Trimis 20 oct 2026, 14:05');
    expect(emailStatusText(status({ status: 'queued', sentAt: null }), fmt)).toBe('În coadă');
    expect(emailStatusText(status({ status: 'failed', sentAt: null }), fmt)).toBe('Netrimis');
  });

  it('the resend confirmation names the recipient and the documents', () => {
    expect(resendTarget(null, scriptForm)).toEqual({ recipient: 'maria@example.com', documents: ['Acord', 'Cerere de adeziune'] });
    expect(resendTarget(status({ recipient: 'alt@example.com' }), scriptForm)).toEqual({
      recipient: 'alt@example.com',
      documents: ['Pop_Ana_Acord_2026-2027.pdf'],
    });
    expect(resendTarget(status({ status: 'none', recipient: '', documents: [] }), { ...scriptForm, membershipAnswer: 'nu' })).toEqual({
      recipient: 'maria@example.com',
      documents: ['Acord'],
    });
  });

  it("the resend toast follows 2F's status, and a failure shows its reason in the panel", () => {
    expect(resendToast(status({}))).toEqual({ tone: 'success', text: 'E-mail trimis.' });
    expect(resendToast(status({ status: 'queued', sentAt: null }))).toEqual({ tone: 'info', text: 'E-mailul va fi trimis în curând.' });
    expect(resendToast(status({ status: 'failed', sentAt: null, lastError: 'Brevo 401' }))).toEqual({ tone: 'error', text: 'Trimiterea a eșuat.' });
    expect(resendToast(null)).toEqual({ tone: 'info', text: 'E-mailul va fi trimis în curând.' });
    expect(failedEmailError(status({ status: 'failed', sentAt: null, lastError: 'Brevo 401' }))).toBe('Brevo 401');
    expect(failedEmailError(status({ status: 'queued', sentAt: null, lastError: 'Brevo 401' }))).toBeNull();
    expect(failedEmailError(null)).toBeNull();
  });

  it("shows the server's refusal text, in Strapi's shape or 2F's", () => {
    expect(requestErrorText({ response: { data: { ok: false, code: 'no-documents', error: 'Înscrierea nu are documente.' } } }, 'x')).toBe('Înscrierea nu are documente.');
    expect(requestErrorText({ response: { data: { error: { message: 'Nu.' } } } }, 'x')).toBe('Nu.');
    expect(requestErrorText(new Error('Request failed'), 'Nu am putut.')).toBe('Nu am putut.');
  });

  it('takes the PDF file name from the response header', () => {
    expect(fileNameFrom('attachment; filename="Pop_Ana_Acord_2026-2027.pdf"', 'acord.pdf')).toBe('Pop_Ana_Acord_2026-2027.pdf');
    expect(fileNameFrom("attachment; filename*=UTF-8''Acord%20gol.pdf", 'acord.pdf')).toBe('Acord gol.pdf');
    expect(fileNameFrom(null, 'acord.pdf')).toBe('acord.pdf');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- src/club/__tests__/registration-panel.test.ts`
Expected: FAIL (`Cannot find module '../registration-panel'`).

- [ ] **Step 3: Implement the panel rules**

`src/club/registration-panel.ts`:

```ts
import { MEMBERSHIP_YES, RELATIONSHIP_OPTIONS, RELATIONSHIP_OTHER, SOURCE_OTHER } from './registration-form-options';

/**
 * What the Înscrieri detail panel shows for one registration, as label/value text. Registrations
 * sent through the script form (phase 2) show its questions; older ones keep their old fields.
 * Pure, so the admin page and the tests share it.
 */

/** Mirrors `DocumentKind` of src/club/documents (plan 2D). */
export type PanelDocumentKind = 'acord' | 'adeziune';
export type PanelRow = { label: string; value: string };
export type PanelRows = { rows: PanelRow[]; longRows: PanelRow[] };
export type RegistrationRow = Record<string, unknown>;

/**
 * `data` of GET .../email-status and POST .../resend-email (plan 2F, `RegistrationEmailStatus`):
 * the latest job ('none' before the first one), the address a resend goes to and the PDF file
 * names it would carry.
 */
export type EmailStatus = {
  status: 'queued' | 'sent' | 'failed' | 'none';
  recipient: string;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  updatedAt: string | null;
  documents: string[];
};

export const DOCUMENT_LABELS: Record<PanelDocumentKind, string> = { acord: 'Acord', adeziune: 'Cerere de adeziune' };
export const MISSING = '-';

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const orMissing = (v: string) => v || MISSING;
const yesNo = (v: unknown) => (v === true ? 'Da' : 'Nu');
const row = (label: string, value: string): PanelRow => ({ label, value: orMissing(value) });

/** New registrations carry the script form's answers; old ones have them empty. */
export function isScriptFormRegistration(r: RegistrationRow): boolean {
  return text(r.relationship) !== '' || text(r.membershipAnswer) !== '';
}

function relationshipText(r: RegistrationRow): string {
  if (r.relationship === RELATIONSHIP_OTHER) return text(r.relationshipOther) || 'Alta';
  return RELATIONSHIP_OPTIONS.find((o) => o.value === r.relationship)?.label ?? '';
}

function subscriptionText(choice: unknown): string {
  if (!choice || typeof choice !== 'object') return '';
  const { priceItemName, price } = choice as { priceItemName?: unknown; price?: unknown };
  const name = text(priceItemName);
  return name && typeof price === 'number' ? `${name}, ${price} RON` : name;
}

function sourceText(r: RegistrationRow): string {
  const source = text(r.source);
  const other = text(r.sourceOther);
  return source === SOURCE_OTHER && other ? `${source}: ${other}` : source;
}

const heightText = (v: unknown) => (typeof v === 'number' ? `${v} cm` : '');

function scriptFormRows(r: RegistrationRow): PanelRow[] {
  return [
    row('Data nașterii', text(r.childBirthDate)),
    row('Înălțime', heightText(r.childHeight)),
    row('Nume părinte', text(r.parentName)),
    row('Calitate', relationshipText(r)),
    row('Email', text(r.email)),
    row('Telefon', text(r.phone)),
    row('Mărime tricou', text(r.shirtSize)),
    row('Sezonul trecut', text(r.lastSeason)),
    row('Membru A.C.S.', r.membershipAnswer === MEMBERSHIP_YES ? 'Da' : 'Nu'),
    row('Abonament', subscriptionText(r.subscriptionChoice)),
    row('Cum a aflat', sourceText(r)),
    row('Acord GDPR', yesNo(r.gdprConsent)),
    row('Acord Regulament', yesNo(r.regulationsConsent)),
  ];
}

function legacyRows(r: RegistrationRow): PanelRow[] {
  const plain: Array<[string, string]> = [
    ['childBirthDate', 'Data nașterii'], ['parentName', 'Nume părinte'], ['email', 'Email'], ['phone', 'Telefon'],
    ['shirtSize', 'Mărime tricou'], ['howHeard', 'Cum a aflat'], ['level', 'Nivel'],
  ];
  return [
    ...plain.map(([key, label]) => row(label, text(r[key]))),
    row('Interes club', yesNo(r.clubInterest)),
    row('Acord regulament', yesNo(r.regulationsAgreement)),
    row('Acord confidențialitate', yesNo(r.privacyConsent)),
  ];
}

/** Short rows first, then the long free texts (shown after a gap, as before). */
export function registrationPanelRows(r: RegistrationRow): PanelRows {
  const number = text(r.registrationNumber);
  const head = number ? [row('Nr. înscriere', number)] : [];
  const rows = isScriptFormRegistration(r) ? scriptFormRows(r) : legacyRows(r);
  const longRows = [row('Experiență anterioară', text(r.priorExperience)), row('Așteptări', text(r.expectations))];
  return { rows: [...head, ...rows], longRows };
}

/** The PDFs a registration has: the Acord always, the Cerere de adeziune when the answer was Da. */
export function registrationDocumentKinds(r: RegistrationRow): PanelDocumentKind[] {
  return r.membershipAnswer === MEMBERSHIP_YES ? ['acord', 'adeziune'] : ['acord'];
}

const STATUSES = ['queued', 'sent', 'failed', 'none'] as const;
const isStatus = (v: unknown): v is EmailStatus['status'] => (STATUSES as readonly unknown[]).includes(v);
const textOrNull = (v: unknown) => text(v) || null;

/** The e-mail status from a 2F answer (`{ ok, data }`); null when the answer is not one. */
export function readEmailStatus(body: unknown): EmailStatus | null {
  const data = body && typeof body === 'object' ? (body as { data?: unknown }).data : null;
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (!isStatus(d.status)) return null;
  const documents = Array.isArray(d.documents) ? d.documents.map(text).filter(Boolean) : [];
  const attempts = typeof d.attempts === 'number' ? d.attempts : 0;
  const dates = { sentAt: textOrNull(d.sentAt), updatedAt: textOrNull(d.updatedAt) };
  return { status: d.status, recipient: text(d.recipient), attempts, lastError: textOrNull(d.lastError), ...dates, documents };
}

/** "Trimis 20.10.2026, 14:05", "În coadă", "Netrimis", or "Niciun e-mail" before the first job. */
export function emailStatusText(status: EmailStatus | null, formatDate: (iso: string) => string): string {
  if (!status || status.status === 'none') return 'Niciun e-mail';
  if (status.status === 'sent') return status.sentAt ? `Trimis ${formatDate(status.sentAt)}` : 'Trimis';
  return status.status === 'queued' ? 'În coadă' : 'Netrimis';
}

/**
 * Who gets the resent e-mail and which PDFs it carries, as the confirmation names them: 2F's
 * address and file names when known, else the registration's e-mail and its document labels.
 */
export function resendTarget(status: EmailStatus | null, r: RegistrationRow): { recipient: string; documents: string[] } {
  const recipient = status?.recipient || text(r.email);
  const documents = status?.documents.length ? status.documents : registrationDocumentKinds(r).map((k) => DOCUMENT_LABELS[k]);
  return { recipient, documents };
}

export type ResendToast = { tone: 'success' | 'info' | 'error'; text: string };

/** The toast after "Retrimite e-mailul", from the status 2F answers after its one attempt. */
export function resendToast(status: EmailStatus | null): ResendToast {
  if (status?.status === 'sent') return { tone: 'success', text: 'E-mail trimis.' };
  if (status?.status === 'failed') return { tone: 'error', text: 'Trimiterea a eșuat.' };
  return { tone: 'info', text: 'E-mailul va fi trimis în curând.' };
}

/** The reason shown in the panel under a failed status; null otherwise. */
export function failedEmailError(status: EmailStatus | null): string | null {
  return status?.status === 'failed' ? status.lastError : null;
}

/** The refusal text of a failed admin request: Strapi's `error.message` or 2F's `error` string. */
export function requestErrorText(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: unknown } } } | null)?.response?.data;
  const error = data?.error;
  const message = typeof error === 'string' ? error : (error as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && message.trim() ? message.trim() : fallback;
}

/** The file name from a Content-Disposition header, or the fallback. */
export function fileNameFrom(contentDisposition: string | null | undefined, fallback: string): string {
  const header = contentDisposition ?? '';
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) return decodeURIComponent(star[1].trim());
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : fallback;
}
```

Run: `npm test -- src/club/__tests__/registration-panel.test.ts` (PASS).

- [ ] **Step 4: Header actions in the shared table**

In `src/admin/dashboard/SubmissionTable.tsx`:

Replace

```tsx
/** A toolbar dropdown button with its own anchored Popover. */
function MenuButton({
```

with

```tsx
/** A toolbar dropdown button with its own anchored Popover. Exported for page-specific header menus. */
export function MenuButton({
```

At the end of `interface SubmissionTableCfg`, replace

```tsx
  /** Extra CSS appended after the shared stylesheet (screen-specific bits, tokens only). */
  extraCss?: string;
}
```

with

```tsx
  /** Extra CSS appended after the shared stylesheet (screen-specific bits, tokens only). */
  extraCss?: string;
  /** Page-specific buttons at the start of the header actions (Înscrieri: "Formulare goale"). */
  headerActions?: React.ReactNode;
}
```

In the `texts` of `interface SubmissionTableCfg`, replace

```tsx
    /** Appended after the "X noi" stat, e.g. ' · exclus arhivate'. */
```

with

```tsx
    /** Appended after the "X noi" stat, e.g. ', exclus arhivate'. */
```

Replace

```tsx
  const statActions = (
    <>
      {cfg.seasons && (
```

with

```tsx
  const statActions = (
    <>
      {cfg.headerActions}
      {cfg.seasons && (
```

- [ ] **Step 5: Panel components**

`src/admin/dashboard/inscrieri/downloadPdf.ts`:

```ts
import type { useFetchClient } from '@strapi/admin/strapi-admin';
import { fileNameFrom } from '../../../club/registration-panel';

type Get = ReturnType<typeof useFetchClient>['get'];

/** Admin PDF routes of plan 2D. */
export const registrationDocumentUrl = (documentId: string, kind: string) => `/api/club/registrations/${documentId}/documents/${kind}`;
export const blankFormUrl = (kind: string) => `/api/club/documents/blank/${kind}`;

/** Fetches a PDF with the admin token and saves it under the server's file name. */
export async function downloadPdf(get: Get, url: string, fallbackName: string): Promise<void> {
  const r = await get(url, { responseType: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(r.data);
  a.download = fileNameFrom(r.headers?.get('content-disposition'), fallbackName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
```

`src/admin/dashboard/inscrieri/BlankFormsMenu.tsx`:

```tsx
import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { adminToast } from '../../ui';
import { MenuButton } from '../SubmissionTable';
import { DOCUMENT_LABELS, type PanelDocumentKind } from '../../../club/registration-panel';
import { blankFormUrl, downloadPdf } from './downloadPdf';

const BLANK_KINDS: PanelDocumentKind[] = ['acord', 'adeziune'];

/** "Formulare goale": blank Acord and Cerere de adeziune with season, period and fee printed (until the Documente page). */
export function BlankFormsMenu() {
  const { get } = useFetchClient();
  const [open, setOpen] = React.useState(false);
  const download = (kind: PanelDocumentKind) => {
    setOpen(false);
    downloadPdf(get, blankFormUrl(kind), `${DOCUMENT_LABELS[kind]}.pdf`).catch(() =>
      adminToast.error('Formularul nu a putut fi descărcat.'),
    );
  };
  return (
    <MenuButton label="Formulare goale" open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="sbt-menu" role="menu">
      {BLANK_KINDS.map((kind) => (
        <button key={kind} type="button" role="menuitem" onClick={() => download(kind)}>
          {DOCUMENT_LABELS[kind]}
        </button>
      ))}
    </MenuButton>
  );
}
```

`src/admin/dashboard/inscrieri/RegistrationDocuments.tsx`:

```tsx
import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { Button, adminToast } from '../../ui';
import { DetailField, type Row } from '../SubmissionTable';
import { DOCUMENT_LABELS, registrationDocumentKinds, type PanelDocumentKind } from '../../../club/registration-panel';
import { downloadPdf, registrationDocumentUrl } from './downloadPdf';

/** The registration's PDFs (Acord, plus the Cerere de adeziune for a member), one button each. */
export function RegistrationDocuments({ row }: { row: Row }) {
  const { get } = useFetchClient();
  const download = (kind: PanelDocumentKind) =>
    downloadPdf(get, registrationDocumentUrl(row.documentId, kind), `${kind}.pdf`).catch(() =>
      adminToast.error('Documentul nu a putut fi descărcat.'),
    );
  return (
    <DetailField label="Documente">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {registrationDocumentKinds(row).map((kind) => (
          <Button key={kind} size="sm" variant="secondary" onClick={() => void download(kind)}>
            {DOCUMENT_LABELS[kind]}
          </Button>
        ))}
      </div>
    </DetailField>
  );
}
```

`src/admin/dashboard/inscrieri/RegistrationEmail.tsx`:

```tsx
import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Button, Spinner, adminToast } from '../../ui';
import { DetailField, fmtDateTime, type Row } from '../SubmissionTable';
import {
  emailStatusText,
  failedEmailError,
  readEmailStatus,
  requestErrorText,
  resendTarget,
  resendToast,
  type EmailStatus,
} from '../../../club/registration-panel';

/** E-mail routes of plan 2F. */
const emailUrl = (documentId: string, action: 'email-status' | 'resend-email') => `/api/club/registrations/${documentId}/${action}`;

/** The e-mail job of one registration, loaded when the panel opens on it. */
function useEmailStatus(documentId: string) {
  const { get } = useFetchClient();
  const [status, setStatus] = React.useState<EmailStatus | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    let off = false;
    setLoaded(false);
    get(emailUrl(documentId, 'email-status'))
      .then((r) => !off && setStatus(readEmailStatus(r.data)))
      .catch(() => !off && setStatus(null))
      .finally(() => !off && setLoaded(true));
    return () => {
      off = true;
    };
    // get changes identity on every render; the status depends on the registration only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);
  return { status, setStatus, loaded };
}

/** "Retrimite e-mailul": 2F logs it in history and tries once at once; resolves true on success. */
function useResend(documentId: string, onStatus: (s: EmailStatus | null) => void) {
  const { post } = useFetchClient();
  const [busy, setBusy] = React.useState(false);
  const resend = async () => {
    setBusy(true);
    try {
      const status = readEmailStatus((await post(emailUrl(documentId, 'resend-email'))).data);
      onStatus(status);
      const toast = resendToast(status);
      adminToast[toast.tone](toast.text);
      return true;
    } catch (err) {
      adminToast.error(requestErrorText(err, 'Nu am putut retrimite e-mailul.'));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, resend };
}

/** E-mail status in the Înscrieri panel; the confirmation names the recipient and the documents. */
export function RegistrationEmail({ row }: { row: Row }) {
  const email = useEmailStatus(row.documentId);
  const { busy, resend } = useResend(row.documentId, (s) => s && email.setStatus(s));
  const [confirming, setConfirming] = React.useState(false);
  const target = resendTarget(email.status, row);
  const confirm = async () => (await resend()) && setConfirming(false);
  return (
    <DetailField label="E-mail">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {email.loaded ? <span>{emailStatusText(email.status, fmtDateTime)}</span> : <Spinner size={12} />}
        <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
          Retrimite e-mailul
        </Button>
      </div>
      {failedEmailError(email.status) && <div className="ui-error">{failedEmailError(email.status)}</div>}
      <ConfirmDialog
        open={confirming}
        title="Retrimiți e-mailul?"
        message={`Către: ${target.recipient}`}
        detail={`Documente: ${target.documents.join(', ')}`}
        confirmLabel="Retrimite"
        busyLabel="Se trimite..."
        tone="default"
        busy={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(false)}
      />
    </DetailField>
  );
}
```

- [ ] **Step 6: The Înscrieri page**

Replace the whole of `src/admin/dashboard/InscrieriPage.tsx` with:

```tsx
import * as React from 'react';
import { Button, StatusBadge } from '../ui';
import SubmissionTablePage, {
  DetailBody,
  DetailField,
  DetailFooter,
  DetailHeader,
  fmtDateTime,
  fmtDateShort,
  type ColumnDef,
  type Row,
  type SubmissionTableCfg,
  type TableApi,
} from './SubmissionTable';
import { isScriptFormRegistration, registrationPanelRows } from '../../club/registration-panel';
import { BlankFormsMenu } from './inscrieri/BlankFormsMenu';
import { RegistrationDocuments } from './inscrieri/RegistrationDocuments';
import { RegistrationEmail } from './inscrieri/RegistrationEmail';

/**
 * EduSport admin — "Înscrieri" results page.
 *
 * A thin configuration wrapper around the shared SubmissionTablePage (the table
 * machinery originally lived here and was extracted verbatim — see
 * ./SubmissionTable.tsx). Everything below only describes the registration
 * screen: endpoints, statuses, built-in columns, filterable columns, the
 * compact-list cells and the read-only detail panel. Seasons, the archived view,
 * bulk actions and the Google Sheets connection are enabled here.
 *
 * Phase 2: the panel shows the script form's answers for new registrations
 * (src/club/registration-panel.ts), their PDFs (plan 2D routes) and the e-mail
 * status with "Retrimite e-mailul" (plan 2F routes). The header has "Formulare
 * goale" (blank PDFs).
 *
 * Endpoints (admin-guarded, server-side filtering/sorting/pagination):
 *   GET    /api/forms/inscrieri
 *            ?season&archived&q&filters&sort&page&pageSize
 *            -> { data, pagination, seasons, activeSeason, formMeta }
 *   PUT    /api/forms/inscrieri/:documentId     update editable field
 *   DELETE /api/forms/inscrieri/:documentId     permanent delete
 *   GET    /api/forms/inscrieri/export.csv        CSV (respects season+filters)
 *
 * Google Sheets is a live connection, not an export: see SheetsDialog.tsx and
 * the /api/sheets/* endpoints.
 */

const LEVELS = [
  'Nu a mai patinat',
  'A mai patinat in alta parte',
  'Incepatori',
  'Intermediari',
  'Avansati',
  'Performanta',
] as const;

interface Submission extends Row {
  email: string;
  phone: string;
  childName: string;
  childBirthDate: string;
  parentName: string;
  shirtSize: string;
  howHeard: string;
  level: string;
  priorExperience: string | null;
  expectations: string | null;
  clubInterest: boolean;
  regulationsAgreement: boolean;
  privacyConsent: boolean;
}

// The registry keys that map to editable/removable built-in columns. status,
// submittedAt and internalNote are meta columns and are never "removed".
const REGISTRY_COL_KEYS = [
  'childName',
  'childBirthDate',
  'parentName',
  'email',
  'phone',
  'level',
  'shirtSize',
  'howHeard',
  'clubInterest',
  'regulationsAgreement',
  'privacyConsent',
  'priorExperience',
  'expectations',
];

// Order convention shared with VoluntariPage: `submittedAt`, the row's name
// column, `status`, then the rest. Bump `colConfigVersion` in CFG whenever this
// order changes so saved per-user orders do not pin the old positions.
const BUILTIN_COLUMNS: ColumnDef[] = [
  { key: 'submittedAt', label: 'Trimis la', type: 'date', readOnly: true, width: 150 },
  { key: 'childName', label: 'Nume copil', type: 'text', width: 170 },
  { key: 'status', label: 'Status', type: 'status', width: 130 },
  { key: 'childBirthDate', label: 'Data nașterii', type: 'text', width: 150 },
  { key: 'parentName', label: 'Nume părinte', type: 'text', width: 170 },
  { key: 'email', label: 'Email', type: 'text', width: 210 },
  { key: 'phone', label: 'Telefon', type: 'text', width: 140 },
  { key: 'level', label: 'Nivel', type: 'level', width: 190 },
  { key: 'shirtSize', label: 'Mărime tricou', type: 'text', width: 120 },
  { key: 'howHeard', label: 'Cum a aflat', type: 'text', width: 170 },
  { key: 'clubInterest', label: 'Interes club', type: 'bool', width: 110 },
  { key: 'regulationsAgreement', label: 'Acord regulament', type: 'bool', width: 150 },
  { key: 'privacyConsent', label: 'Confidențialitate', type: 'bool', width: 140 },
  { key: 'priorExperience', label: 'Experiență anterioară', type: 'longtext', width: 240 },
  { key: 'expectations', label: 'Așteptări', type: 'longtext', width: 240 },
  { key: 'internalNote', label: 'Notă internă', type: 'longtext', width: 240 },
];

// Filter-builder column options (map to whitelisted server fields).
const FILTER_COLUMNS = [
  { key: 'childName', label: 'Nume copil' },
  { key: 'parentName', label: 'Nume părinte' },
  { key: 'level', label: 'Nivel' },
  { key: 'status', label: 'Status' },
  { key: 'phone', label: 'Telefon' },
  { key: 'email', label: 'Email' },
  { key: 'submittedAt', label: 'Data înscrierii' },
] as const;

const renderCells = (r: Row, api: TableApi) => {
  const s = r as Submission;
  return (
    <>
      <td className="ui-num">{fmtDateShort(s.submittedAt)}</td>
      <td className="sbt-nm">{s.childName}</td>
      <td>{api.statusTag(s)}</td>
      <td>{s.parentName}</td>
      <td>
        <span className="sbt-lv">{s.level}</span>
      </td>
    </>
  );
};

/** Answers as label/value rows (src/club/registration-panel.ts), the long texts after a gap. */
function PanelAnswers({ row }: { row: Row }) {
  const { rows, longRows } = registrationPanelRows(row);
  return (
    <>
      {rows.map((r) => (
        <DetailField key={r.label} label={r.label}>{r.value}</DetailField>
      ))}
      {longRows.map((r, i) => (
        <DetailField key={r.label} label={r.label} style={i === 0 ? { marginTop: 11 } : undefined}>
          {r.value}
        </DetailField>
      ))}
    </>
  );
}

const renderDetail = (row: Row, api: TableApi) => {
  const selected = row as Submission;
  const scriptForm = isScriptFormRegistration(selected);
  return (
    <>
      <DetailHeader>
        <b>{selected.childName}</b>
        {api.statusTag(selected)}
      </DetailHeader>
      <DetailBody>
        {api.statusBox(selected)}
        <DetailField label="Trimis la">{fmtDateTime(selected.submittedAt)}</DetailField>
        <DetailField label="Arhivare">{selected.archived ? 'Arhivat' : 'Activ'}</DetailField>
        {api.seasonField(selected)}
        <PanelAnswers row={selected} />
        {scriptForm && <RegistrationDocuments row={selected} />}
        {scriptForm && <RegistrationEmail row={selected} />}
        {api.customFields(selected)}
        {api.internalNoteField(selected)}
      </DetailBody>
      <DetailFooter>
        <span />
        <Button size="sm" variant="danger" onClick={() => api.removeRow(selected.documentId)}>
          Șterge înscrierea
        </Button>
      </DetailFooter>
    </>
  );
};

const CFG: SubmissionTableCfg = {
  api: '/api/forms/inscrieri',
  storagePrefix: 'edusport-inscrieri-cols',
  // 1 = status moved directly after `childName`.
  colConfigVersion: 1,
  csvPrefix: 'inscrieri',
  statuses: [
    { value: 'Nou', color: 'var(--theme-primary)', soft: 'var(--theme-primary-soft)', border: 'var(--theme-primary-soft-line)' },
    { value: 'Contactat', color: 'var(--theme-info)', soft: 'var(--theme-info-bg)', border: 'var(--theme-info-border)' },
    { value: 'Confirmat', color: 'var(--theme-success)', soft: 'var(--theme-success-bg)', border: 'var(--theme-success-border)' },
    { value: 'Respins', color: 'var(--theme-danger)', soft: 'var(--theme-danger-bg)', border: 'var(--theme-danger-border)' },
  ],
  extraTags: [{ value: 'Arhivat', color: 'var(--theme-neutral)', soft: 'var(--theme-neutral-bg)', border: 'var(--theme-neutral-border)' }],
  builtinColumns: BUILTIN_COLUMNS,
  registryColKeys: REGISTRY_COL_KEYS,
  filterColumns: FILTER_COLUMNS,
  quickFilterCols: ['status', 'level'],
  filterSelectFallback: { level: [...LEVELS] },
  seasons: true,
  archive: true,
  sheetsForm: 'inscrieri',
  bulk: true,
  headerActions: <BlankFormsMenu />,
  texts: {
    title: 'Înscrieri',
    subtitle: 'Cererile trimise prin formularul public de înscriere.',
    // The server's quick `q` searches childName/parentName/email/phone and, after plan 2E, the registration number.
    searchPlaceholder: 'Caută după nume, număr, părinte, e-mail sau telefon...',
    empty: 'Nicio înscriere pentru filtrul curent.',
    loadError: 'Nu am putut încărca înscrierile.',
    statSuffix: ', exclus arhivate',
    deleteConfirm: 'Ștergi definitiv această înscriere și documentele ei? Acțiunea nu poate fi anulată.',
    bulkDeleteNoun: 'înscrieri',
    deleteError: 'Nu am putut șterge înscrierea.',
    saveError: 'Nu am putut salva modificarea.',
  },
  compact: {
    headers: ['Trimis la', 'Nume copil', 'Status', 'Nume părinte', 'Nivel'],
    renderCells,
    renderDetail,
  },
};

export default function InscrieriPage() {
  return <SubmissionTablePage cfg={CFG} />;
}
```

- [ ] **Step 7: Run the checks**

Run: `npm test` (all PASS), `npx tsc --noEmit`, `npx tsc --noEmit -p src/admin/tsconfig.json` (zero errors).

- [ ] **Step 8: Commit**

```bash
git add src/club/registration-panel.ts src/club/__tests__/registration-panel.test.ts src/admin/dashboard/inscrieri \
  src/admin/dashboard/SubmissionTable.tsx src/admin/dashboard/InscrieriPage.tsx
git commit -m "feat(inscrieri): panel shows the new answers, PDFs and e-mail status; Formulare goale"
```

---

### Task 10: Edit Calitate and Membru A.C.S. in the panel; "Document refăcut"

**Files:**
- Create: `src/club/registration-edit.ts`
- Test: `src/club/__tests__/registration-edit.test.ts`
- Create: `src/admin/dashboard/inscrieri/EditableAnswer.tsx`
- Modify: `src/club/registration-panel.ts`, `src/club/__tests__/registration-panel.test.ts` (an `edit` marker on two rows, the select options)
- Modify: `src/admin/dashboard/InscrieriPage.tsx` (`PanelAnswers`, doc comment)
- Modify: `src/api/registration-submission/controllers/registration-submission.ts` (imports, `EDITABLE_FIELDS`, `updateSubmission`, a `recordDocumentRebuilt` helper)

**Runs after:** Task 9, plan 2D (this task edits the lines 2D Task 8 adds to the controller: its import block from `../../../club/documents` and the end of `updateSubmission`, `const rebuild = await rebuildAfterEdit(strapi, documentId, data);`) and plan 2E (its controller edit, in `buildListFilters`, comes first; no overlap).

**Interfaces:**
- Consumes: Task 1 `adminActor`; phase 1 `recordHistory`, `HistoryInput`; 2A `RELATIONSHIP_OTHER`, `RELATIONSHIP_OTHER_LABEL`, `MEMBERSHIP_NO`, `isRelationship`, `isMembershipAnswer`; Task 9 `registrationPanelRows`, `TableApi.saveField`; plan 2D, exported from `src/club/documents/index.ts`: `type RebuildResult = { ok: boolean; documents: DocumentKind[]; reason?: 'unknown-season' | 'failed' }` and `rebuildAfterEdit(strapi, id, data): Promise<RebuildResult | null>` (null when no printed field is in `data`; never throws). 2D's `updateSubmission` ends with `const rebuild = await rebuildAfterEdit(strapi, documentId, data); ctx.body = rebuild ? { data: doc, rebuild } : { data: doc };`, after `if ('season' in data) data.seasonRef = await seasonIdForLabel(strapi, data.season);`. 2D's `DOCUMENT_FIELDS` already lists `relationship`, `relationshipOther` and `membershipAnswer`.
- Produces (`src/club/registration-edit.ts`): `REGISTRATION_EDIT_FIELDS = ['relationship', 'relationshipOther', 'membershipAnswer']`, `REGISTRATION_EDIT_ERROR`, `registrationEditError(data): string | null`, `normalizeRegistrationEdit(data)`, `documentRebuiltEntry(documentId, documents, actor): HistoryInput`.
- Produces (`src/club/registration-panel.ts`): `type PanelEdit = 'relationship' | 'membershipAnswer'`, `PanelRow.edit?: PanelEdit`, `RELATIONSHIP_EDIT_OPTIONS`, `MEMBERSHIP_EDIT_OPTIONS`.
- Produces (HTTP): `PUT /api/forms/inscrieri/:documentId` now accepts `relationship` (`parinte|tutore|alta`), `relationshipOther` (text) and `membershipAnswer` (`da|nu`); any other value is refused with 400 "Valoare invalidă.". Moving off "Alta" clears `relationshipOther`. Saving one of them rebuilds the PDFs (2D). Only a rebuild with `ok: true` writes the history entry (none for `reason: 'unknown-season'` or `'failed'`, nor when nothing printed changed): `{ subjectType: 'registration-submission', subjectId: <documentId>, action: 'document-rebuilt', changes: { documents }, actor: <admin e-mail> }` ("Document refăcut", DECISIONS 2026-10-05). The response stays 2D's.

Controller ruling (2026-10-21): the read-only panel stays; Calitate (with its "Alta" text) and Membru A.C.S., the script answers printed on the PDFs, are edited in place with the panel's existing pattern (a `Select` that saves on change and an `Input` that saves on blur, through `TableApi.saveField`, like Sezon and Notă internă). Tabs and an Istoric view are phase 3. No e-mail is sent on an edit (DECISIONS 2026-10-05). A failing history write is logged and never fails the save.

- [ ] **Step 1: Write the failing tests**

`src/club/__tests__/registration-edit.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import {
  REGISTRATION_EDIT_ERROR,
  documentRebuiltEntry,
  normalizeRegistrationEdit,
  registrationEditError,
} from '../registration-edit';

it('accepts the stored option values only', () => {
  expect(registrationEditError({ relationship: 'tutore' })).toBeNull();
  expect(registrationEditError({ membershipAnswer: 'nu' })).toBeNull();
  expect(registrationEditError({ relationshipOther: 'Bunică' })).toBeNull();
  expect(registrationEditError({ status: 'Nou' })).toBeNull();
  expect(registrationEditError({ relationship: 'Părinte' })).toBe(REGISTRATION_EDIT_ERROR);
  expect(registrationEditError({ relationship: null })).toBe(REGISTRATION_EDIT_ERROR);
  expect(registrationEditError({ membershipAnswer: 'Da' })).toBe(REGISTRATION_EDIT_ERROR);
  expect(registrationEditError({ relationshipOther: 3 })).toBe(REGISTRATION_EDIT_ERROR);
});

it('clears the "Alta" text when the relationship moves off Alta, and trims it otherwise', () => {
  expect(normalizeRegistrationEdit({ relationship: 'parinte' })).toEqual({ relationship: 'parinte', relationshipOther: null });
  expect(normalizeRegistrationEdit({ relationship: 'alta' })).toEqual({ relationship: 'alta' });
  expect(normalizeRegistrationEdit({ relationshipOther: '  Bunică ' })).toEqual({ relationshipOther: 'Bunică' });
  expect(normalizeRegistrationEdit({ relationshipOther: ' ' })).toEqual({ relationshipOther: null });
  expect(normalizeRegistrationEdit({ status: 'Nou' })).toEqual({ status: 'Nou' });
});

it('writes "Document refăcut" with the rebuilt documents and the admin', () => {
  expect(documentRebuiltEntry('d1', ['acord', 'adeziune'], 'ana@club.ro')).toEqual({
    subjectType: 'registration-submission',
    subjectId: 'd1',
    action: 'document-rebuilt',
    changes: { documents: ['acord', 'adeziune'] },
    actor: 'ana@club.ro',
  });
});

it('the admin PUT accepts these fields, checks them and records the rebuild', () => {
  const controller = readFileSync(join(__dirname, '..', '..', 'api/registration-submission/controllers/registration-submission.ts'), 'utf8');
  expect(controller).toContain('...REGISTRATION_EDIT_FIELDS,');
  expect(controller).toContain('const editError = registrationEditError(data);');
  expect(controller).toContain('await recordDocumentRebuilt(documentId, rebuild, ctx.request.header?.authorization);');
  expect(controller).toContain('if (!rebuild?.ok) return;');
});
```

In `src/club/__tests__/registration-panel.test.ts` replace

```ts
import {
  MISSING,
```

with

```ts
import {
  MEMBERSHIP_EDIT_OPTIONS,
  MISSING,
  RELATIONSHIP_EDIT_OPTIONS,
```

replace

```ts
    expect(value(rows, 'Nivel')).toBeUndefined();
```

with

```ts
    expect(value(rows, 'Nivel')).toBeUndefined();
    expect(rows.filter((r) => r.edit).map((r) => [r.label, r.edit])).toEqual([
      ['Calitate', 'relationship'],
      ['Membru A.C.S.', 'membershipAnswer'],
    ]);
```

replace

```ts
  it('uses the option label for Părinte / Tutore Legal', () => {
```

with

```ts
  it('edits Calitate and Membru A.C.S. with the stored values', () => {
    expect(RELATIONSHIP_EDIT_OPTIONS).toEqual([
      { value: 'parinte', label: 'Părinte' },
      { value: 'tutore', label: 'Tutore Legal' },
      { value: 'alta', label: 'Alta' },
    ]);
    expect(MEMBERSHIP_EDIT_OPTIONS).toEqual([
      { value: 'da', label: 'Da' },
      { value: 'nu', label: 'Nu' },
    ]);
  });

  it('uses the option label for Părinte / Tutore Legal', () => {
```

and replace

```ts
    expect(value(rows, 'Email')).toBe(MISSING);
```

with

```ts
    expect(value(rows, 'Email')).toBe(MISSING);
    expect(rows.some((r) => r.edit)).toBe(false);
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -- src/club/__tests__/registration-edit.test.ts src/club/__tests__/registration-panel.test.ts`
Expected: FAIL (`Cannot find module '../registration-edit'`; `RELATIONSHIP_EDIT_OPTIONS` undefined).

- [ ] **Step 3: The edit rules**

`src/club/registration-edit.ts`:

```ts
import type { HistoryInput } from './history';
import { RELATIONSHIP_OTHER, isMembershipAnswer, isRelationship } from './registration-form-options';

/**
 * Admin edits of the printed answers in the Înscrieri panel (PUT /api/forms/inscrieri/:documentId).
 * Saving one of them rebuilds the PDFs (plan 2D); a successful rebuild is written to the history.
 */

/** Script form answers the panel edits; added to the controller's EDITABLE_FIELDS. */
export const REGISTRATION_EDIT_FIELDS = ['relationship', 'relationshipOther', 'membershipAnswer'] as const;

export const REGISTRATION_EDIT_ERROR = 'Valoare invalidă.';

const VALID: Record<(typeof REGISTRATION_EDIT_FIELDS)[number], (v: unknown) => boolean> = {
  relationship: (v) => typeof v === 'string' && isRelationship(v),
  relationshipOther: (v) => typeof v === 'string',
  membershipAnswer: (v) => typeof v === 'string' && isMembershipAnswer(v),
};

/** Refuses a value the schema enum would refuse; null when the edit is fine. */
export function registrationEditError(data: Record<string, unknown>): string | null {
  const bad = REGISTRATION_EDIT_FIELDS.some((key) => key in data && !VALID[key](data[key]));
  return bad ? REGISTRATION_EDIT_ERROR : null;
}

/** The text after "Alta" is trimmed, and cleared when the relationship moves off "Alta" (as the form stores it). */
export function normalizeRegistrationEdit(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  if (typeof out.relationshipOther === 'string') out.relationshipOther = out.relationshipOther.trim() || null;
  if ('relationship' in out && out.relationship !== RELATIONSHIP_OTHER) out.relationshipOther = null;
  return out;
}

/** "Document refăcut": one history line per successful rebuild, naming the rebuilt documents. */
export function documentRebuiltEntry(documentId: string, documents: string[], actor: string): HistoryInput {
  return { subjectType: 'registration-submission', subjectId: documentId, action: 'document-rebuilt', changes: { documents }, actor };
}
```

In `src/club/registration-panel.ts` replace

```ts
import { MEMBERSHIP_YES, RELATIONSHIP_OPTIONS, RELATIONSHIP_OTHER, SOURCE_OTHER } from './registration-form-options';
```

with

```ts
import { MEMBERSHIP_NO, MEMBERSHIP_YES, RELATIONSHIP_OPTIONS, RELATIONSHIP_OTHER, SOURCE_OTHER } from './registration-form-options';
```

replace

```ts
export type PanelRow = { label: string; value: string };
```

with

```ts
/** Answers the panel edits in place (printed on the PDFs; saving one rebuilds them). */
export type PanelEdit = 'relationship' | 'membershipAnswer';
export type PanelRow = { label: string; value: string; edit?: PanelEdit };
```

replace

```ts
export const MISSING = '-';
```

with

```ts
export const MISSING = '-';

/** Options of the panel's Calitate select ("Alta" without the form's request to specify). */
export const RELATIONSHIP_EDIT_OPTIONS = RELATIONSHIP_OPTIONS.map((o) => ({
  value: o.value,
  label: o.value === RELATIONSHIP_OTHER ? 'Alta' : o.label,
}));
/** Options of the panel's Membru A.C.S. select, worded as the panel shows the answer. */
export const MEMBERSHIP_EDIT_OPTIONS = [
  { value: MEMBERSHIP_YES, label: 'Da' },
  { value: MEMBERSHIP_NO, label: 'Nu' },
];
```

replace

```ts
    row('Calitate', relationshipText(r)),
```

with

```ts
    { ...row('Calitate', relationshipText(r)), edit: 'relationship' },
```

and replace

```ts
    row('Membru A.C.S.', r.membershipAnswer === MEMBERSHIP_YES ? 'Da' : 'Nu'),
```

with

```ts
    { ...row('Membru A.C.S.', r.membershipAnswer === MEMBERSHIP_YES ? 'Da' : 'Nu'), edit: 'membershipAnswer' },
```

Run: `npm test -- src/club/__tests__/registration-edit.test.ts src/club/__tests__/registration-panel.test.ts`
Expected: the controller test (`the admin PUT accepts these fields...`) still fails; the others pass.

- [ ] **Step 4: The admin PUT**

In `src/api/registration-submission/controllers/registration-submission.ts`:

Replace the end of 2D's import block

```ts
  submitBlockedReason,
} from '../../../club/documents';
```

with

```ts
  submitBlockedReason,
  type RebuildResult,
} from '../../../club/documents';
import { adminActor } from '../../../club/admin-actor';
import { recordHistory } from '../../../club/history';
import {
  REGISTRATION_EDIT_FIELDS,
  documentRebuiltEntry,
  normalizeRegistrationEdit,
  registrationEditError,
} from '../../../club/registration-edit';
```

In `EDITABLE_FIELDS` replace

```ts
  'archived',
  'season',
]);
```

with

```ts
  'archived',
  'season',
  // Script form answers printed on the PDFs (plan 2B): saving one rebuilds them (plan 2D).
  ...REGISTRATION_EDIT_FIELDS,
]);
```

Directly above `export default factories.createCoreController(UID, ({ strapi }) => ({` (below 2D's `removeDocuments`) add

```ts
/** "Document refăcut" in the registration's history, only after a rebuild that succeeded (plan 2B). Never throws. */
async function recordDocumentRebuilt(documentId: string, rebuild: RebuildResult | null, authorization: string | undefined): Promise<void> {
  if (!rebuild?.ok) return;
  try {
    const actor = await adminActor(authorization, strapi);
    await recordHistory(strapi, documentRebuiltEntry(documentId, rebuild.documents, actor));
  } catch (err) {
    strapi.log.error(`[inscrieri] history of the rebuild of ${documentId} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
```

In `updateSubmission` replace

```ts
      return ctx.badRequest('Stare invalidă.');
    }
```

with

```ts
      return ctx.badRequest('Stare invalidă.');
    }
    const editError = registrationEditError(data);
    if (editError) return ctx.badRequest(editError);
    Object.assign(data, normalizeRegistrationEdit(data));
```

and replace the end of 2D's `updateSubmission`

```ts
    const rebuild = await rebuildAfterEdit(strapi, documentId, data);
    ctx.body = rebuild ? { data: doc, rebuild } : { data: doc };
```

with

```ts
    const rebuild = await rebuildAfterEdit(strapi, documentId, data);
    await recordDocumentRebuilt(documentId, rebuild, ctx.request.header?.authorization);
    ctx.body = rebuild ? { data: doc, rebuild } : { data: doc };
```

(The edit check runs before 2D's `seasonRef` line, so `normalizeRegistrationEdit` has already cleared `relationshipOther` when the rebuild reads the registration.)

Run: `npm test -- src/club/__tests__/registration-edit.test.ts` (PASS) and `npx tsc --noEmit` (zero errors).

- [ ] **Step 5: Edit in place in the panel**

`src/admin/dashboard/inscrieri/EditableAnswer.tsx`:

```tsx
import * as React from 'react';
import { Field, Input, Select } from '../../ui';
import type { Row } from '../SubmissionTable';
import { RELATIONSHIP_OTHER, RELATIONSHIP_OTHER_LABEL } from '../../../club/registration-form-options';
import { MEMBERSHIP_EDIT_OPTIONS, RELATIONSHIP_EDIT_OPTIONS, type PanelEdit } from '../../../club/registration-panel';

/** TableApi.saveField: optimistic save of one field ("Salvat" toast; reverted on failure). */
type Save = (documentId: string, key: string, value: unknown) => void;

const text = (v: unknown) => (typeof v === 'string' ? v : '');

/** Calitate as a select, plus the client's "Specificați calitatea" text when it is Alta. Same pattern as the panel's Sezon and Notă internă. */
function RelationshipEdit({ row, save }: { row: Row; save: Save }) {
  const current = text(row.relationship);
  const other = text(row.relationshipOther);
  return (
    <>
      <Field label="Calitate" className="sbt-fld">
        <Select value={current} options={RELATIONSHIP_EDIT_OPTIONS} onChange={(v) => v !== current && save(row.documentId, 'relationship', v)} />
      </Field>
      {current === RELATIONSHIP_OTHER && (
        <Field label={RELATIONSHIP_OTHER_LABEL} className="sbt-fld">
          <Input
            key={`${row.documentId}-relationshipOther`}
            defaultValue={other}
            onBlur={(e) => e.target.value !== other && save(row.documentId, 'relationshipOther', e.target.value)}
          />
        </Field>
      )}
    </>
  );
}

function MembershipEdit({ row, save }: { row: Row; save: Save }) {
  const current = text(row.membershipAnswer);
  return (
    <Field label="Membru A.C.S." className="sbt-fld">
      <Select value={current} options={MEMBERSHIP_EDIT_OPTIONS} onChange={(v) => v !== current && save(row.documentId, 'membershipAnswer', v)} />
    </Field>
  );
}

/** A printed answer edited in place; saving it rebuilds the PDFs on the server (no e-mail). */
export function EditableAnswer({ row, edit, save }: { row: Row; edit: PanelEdit; save: Save }) {
  return edit === 'relationship' ? <RelationshipEdit row={row} save={save} /> : <MembershipEdit row={row} save={save} />;
}
```

In `src/admin/dashboard/InscrieriPage.tsx`:

Under

```tsx
import { BlankFormsMenu } from './inscrieri/BlankFormsMenu';
```

add

```tsx
import { EditableAnswer } from './inscrieri/EditableAnswer';
```

Replace

```tsx
 * goale" (blank PDFs).
```

with

```tsx
 * goale" (blank PDFs). Calitate and Membru A.C.S. are edited in place: they are
 * printed on the PDFs, so saving one rebuilds them (plan 2D) and writes "Document
 * refăcut" to the history; no e-mail is sent.
```

Replace

```tsx
/** Answers as label/value rows (src/club/registration-panel.ts), the long texts after a gap. */
function PanelAnswers({ row }: { row: Row }) {
  const { rows, longRows } = registrationPanelRows(row);
  return (
    <>
      {rows.map((r) => (
        <DetailField key={r.label} label={r.label}>{r.value}</DetailField>
      ))}
```

with

```tsx
/** Answers as label/value rows (src/club/registration-panel.ts), the long texts after a gap. Calitate and Membru A.C.S. are edited in place. */
function PanelAnswers({ row, save }: { row: Row; save: TableApi['saveField'] }) {
  const { rows, longRows } = registrationPanelRows(row);
  return (
    <>
      {rows.map((r) =>
        r.edit ? (
          <EditableAnswer key={r.label} row={row} edit={r.edit} save={save} />
        ) : (
          <DetailField key={r.label} label={r.label}>{r.value}</DetailField>
        ),
      )}
```

and replace

```tsx
        <PanelAnswers row={selected} />
```

with

```tsx
        <PanelAnswers row={selected} save={api.saveField} />
```

- [ ] **Step 6: Run the checks**

Run: `npm test` (all PASS), `npx tsc --noEmit`, `npx tsc --noEmit -p src/admin/tsconfig.json` (zero errors).

- [ ] **Step 7: Commit**

```bash
git add src/club/registration-edit.ts src/club/__tests__/registration-edit.test.ts src/club/registration-panel.ts \
  src/club/__tests__/registration-panel.test.ts src/admin/dashboard/inscrieri/EditableAnswer.tsx \
  src/admin/dashboard/InscrieriPage.tsx src/api/registration-submission/controllers/registration-submission.ts
git commit -m "feat(inscrieri): edit Calitate and Membru A.C.S. in the panel; log Document refăcut"
```

---

### Task 11: Boot check and browser pass on a throwaway Postgres

**Files:** none in the repo. Temporary files live in `${TMPDIR:-/tmp}/es2b` and are removed at the end.

**Interfaces:**
- Consumes: everything above (and plan 2A merged).
- Proves: the routes are admin-only; duplicate names, stale rows, bad prices and duplicate list names are refused with their messages; history entries carry the admin's e-mail and old -> new; seasons: label check, new season not current, label locked with registrations, stored days kept; the browser shows the approved layouts with no band and no tagged "Salvează"; saving Setări site keeps the stored season keys.

If port 55433 or 1339 is taken, pick free ones and change them everywhere below (also `B` in `shots.py`). Start Strapi as a background job and poll `/_health`. Log in once per run: Strapi rate-limits `/admin/login`, and a throttled browser login lands on the login page (restart Strapi to reset it). The 2D and 2F routes may not exist yet: then the panel shows "Niciun e-mail" and the PDF buttons answer "Documentul nu a putut fi descărcat."; that is expected until those plans land.

- [ ] **Step 1: Postgres, environment, build**

```bash
cd /Users/codrin/Documents/Programming/edusport_backend
T="${TMPDIR:-/tmp}/es2b"; mkdir -p "$T/shots"
cat > "$T/env" <<'EOF'
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=55433
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=strapi
HOST=127.0.0.1
PORT=1339
APP_KEYS=throwawayA,throwawayB
API_TOKEN_SALT=throwaway
ADMIN_JWT_SECRET=throwaway
TRANSFER_TOKEN_SALT=throwaway
JWT_SECRET=throwaway
ENCRYPTION_KEY=throwaway
STRAPI_TELEMETRY_DISABLED=true
EOF
docker run -d --name es2b-pg -e POSTGRES_USER=strapi -e POSTGRES_PASSWORD=strapi -e POSTGRES_DB=strapi \
  -p 127.0.0.1:55433:5432 postgres:16
until docker exec es2b-pg pg_isready -U strapi >/dev/null 2>&1; do sleep 1; done
(set -a; . "$T/env"; set +a; npm run build)
```

Expected: `✔ Building admin panel` (the admin bundle resolves its imports from `src/club/`).

- [ ] **Step 2: Fixtures and an admin**

```bash
cat > "$T/fixture.js" <<'EOF'
const { createStrapi, compileStrapi } = require('@strapi/strapi');
(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  const cur = await d('api::season.season').create({ data: { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270, isCurrent: true } });
  await d('api::season.season').create({ data: { label: '2025-2026', startMonth: '2025-10-04', endMonth: '2026-05-31', membershipFee: 250, isCurrent: false } });
  const school = await d('api::section.section').create({ data: { name: 'Școala de patinaj', kind: 'school', slug: 'afi-cotroceni', publicPage: true, order: 1, priceNotes: ['Taxa de membru se achită o singură dată pe sezon.'] } });
  await d('api::section.section').create({ data: { name: 'Club', kind: 'club', slug: 'club', order: 2 } });
  await d('api::price-list.price-list').create({ data: { name: 'Standard', section: school.documentId, items: [
    { name: 'Abonament 6 ședințe grup', kind: 'subscription', sessions: 6, memberPrice: 520, nonMemberPrice: 720, tooltip: 'Disponibil pentru cei care știu că vor lipsi un weekend.' },
    { name: 'Abonament 8 ședințe grup', kind: 'subscription', sessions: 8, memberPrice: 590, nonMemberPrice: 790 },
    { name: '1 ședință grup', kind: 'session', sessions: 1, nonMemberPrice: 150 },
  ] } });
  await d('api::price-list.price-list').create({ data: { name: 'Avansați Gold', section: school.documentId, items: [
    { name: 'Abonament Avansați Gold 8 ședințe', kind: 'subscription', sessions: 8 },
  ] } });
  const reg = await d('api::registration-submission.registration-submission').create({ data: {
    email: 'maria@example.com', phone: '0722000000', childName: 'Ana Pop', childBirthDate: '02.03.2018', parentName: 'Maria Pop',
    shirtSize: '128', status: 'Nou', season: '2026-2027', seasonRef: cur.documentId, section: school.documentId, registrationNumber: '2026-0001',
    submittedAt: '2026-10-20T10:00:00.000Z', relationship: 'parinte', childHeight: 128, lastSeason: 'Începători', membershipAnswer: 'da',
    subscriptionChoice: { priceItemName: 'Abonament 8 ședințe grup', price: 590, member: true }, source: 'Facebook',
    gdprConsent: true, regulationsConsent: true, priorExperience: 'Nu este cazul', expectations: 'Să patineze', archived: false,
  } });
  await d('api::registration-submission.registration-submission').create({ data: {
    email: 'vechi@example.com', phone: '0700000000', childName: 'Copil Vechi', childBirthDate: '01.01.2015', parentName: 'Părinte Vechi',
    shirtSize: 'M', status: 'Nou', season: '2025-2026', submittedAt: '2025-09-01T10:00:00.000Z', archived: true,
  } });
  await d('api::site-settings.site-settings').create({ data: { registration: { open: true, currentSeason: '2026-2027', seasonStartDate: '2026-10-01', seasonEndDate: '2027-05-31' } } });
  console.log('fixture ok', reg.documentId);
  await app.destroy();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
EOF
(set -a; . "$T/env"; set +a; node -e "$(cat "$T/fixture.js")")
(set -a; . "$T/env"; set +a; npx strapi admin:create-user --email=admin@example.com --password='Throwaway123' --firstname=Admin)
(set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi start > "$T/strapi.log" 2>&1 & echo $! > "$T/pid")
until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1339/_health | grep -q 204; do sleep 2; done
B=http://127.0.0.1:1339; J='Content-Type: application/json'
TOKEN=$(curl -s -X POST $B/admin/login -H "$J" -d '{"email":"admin@example.com","password":"Throwaway123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["token"])')
H="Authorization: Bearer $TOKEN"
```

Expected: `fixture ok <documentId>`, `Successfully created new admin`, health 204.

- [ ] **Step 3: Prețuri routes**

```bash
curl -s -o /dev/null -w '%{http_code}\n' $B/api/club/prices
ids() { curl -s -H "$H" $B/api/club/prices | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print($1)"; }
STD=$(ids "[l['documentId'] for l in d['lists'] if l['name']=='Standard'][0]")
GOLD=$(ids "[l['documentId'] for l in d['lists'] if l['name']=='Avansați Gold'][0]")
SCH=$(ids "d['sections'][0]['documentId']"); CLUB=$(ids "d['sections'][1]['documentId']")
ids "[(l['name'],[(i['name'],i['memberPrice'],i['nonMemberPrice'],i['incomplete']) for i in l['items']]) for l in d['lists']]"
curl -s -w ' %{http_code}\n' -X POST -H "$H" -H "$J" $B/api/club/price-lists/$GOLD/items -d '{"name":"abonament 8 sedinte grup","kind":"subscription","sessions":8,"memberPrice":600}'
curl -s -w ' %{http_code}\n' -X POST -H "$H" -H "$J" $B/api/club/price-lists/$GOLD/items -d '{"name":"X","kind":"subscription","memberPrice":"abc"}'
curl -s -o /dev/null -w '%{http_code}\n' -X PUT -H "$H" -H "$J" $B/api/club/price-lists/$GOLD/items/0 \
  -d '{"expectedName":"Abonament Avansați Gold 8 ședințe","item":{"name":"Abonament Avansați Gold 8 ședințe","kind":"subscription","sessions":8,"memberPrice":650,"nonMemberPrice":null,"tooltip":""}}'
curl -s -w ' %{http_code}\n' -X DELETE -H "$H" "$B/api/club/price-lists/$STD/items/2?expectedName=Altceva"
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE -H "$H" "$B/api/club/price-lists/$STD/items/2?expectedName=1%20%C8%99edin%C8%9B%C4%83%20grup"
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "$H" -H "$J" $B/api/club/price-lists -d "{\"name\":\"Club lunar\",\"sectionId\":\"$CLUB\"}"
curl -s -w ' %{http_code}\n' -X POST -H "$H" -H "$J" $B/api/club/price-lists -d "{\"name\":\"standard\",\"sectionId\":\"$CLUB\"}"
curl -s -X PUT -H "$H" -H "$J" $B/api/club/sections/$SCH/price-notes -d '{"priceNotes":["Nota nouă"," ",""]}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["sections"][0]["priceNotes"])'
docker exec es2b-pg psql -U strapi -d strapi -tAc "select subject_type, action, actor, changes::text from history_entries order by id"
```

Expected, in order:
- `403` (no token).
- Standard with three items (`1 ședință grup` with member price `None`), Avansați Gold with one item `(..., None, None, True)` (incomplete).
- `{"data":null,"error":{"status":409,"name":"ClubAdminError","message":"Numele „abonament 8 sedinte grup” este deja folosit în această secțiune."}} 409`
- `{"data":null,"error":{"status":400,"name":"ClubAdminError","message":"Prețul nu este valid."}} 400`
- `200`
- `{"data":null,"error":{"status":409,"name":"ClubAdminError","message":"Lista s-a schimbat între timp. Reîncarcă pagina."}} 409`
- `200`, `200`
- `{"data":null,"error":{"status":409,"name":"ClubAdminError","message":"Există deja o listă cu acest nume."}} 409`
- `['Nota nouă']`
- four history rows, each with actor `admin@example.com`:
  `price-list|price-updated|...|{"item": "Abonament Avansați Gold 8 ședințe", "memberPrice": {"to": 650, "from": null}}`,
  `price-list|price-removed|...` (every field of 1 ședință grup against null),
  `price-list|created|...|{"name": "Club lunar", "sectionId": "..."}`,
  `section|price-notes-updated|...|{"priceNotes": {"to": ["Nota nouă"], "from": ["Taxa de membru se achită o singură dată pe sezon."]}}`.

- [ ] **Step 4: Sezoane routes**

```bash
curl -s -H "$H" $B/api/club/seasons | python3 -c 'import sys,json;[print(s) for s in json.load(sys.stdin)["data"]]'
CUR=$(curl -s -H "$H" $B/api/club/seasons | python3 -c 'import sys,json;print([s["documentId"] for s in json.load(sys.stdin)["data"] if s["isCurrent"]][0])')
OLD=$(curl -s -H "$H" $B/api/club/seasons | python3 -c 'import sys,json;print([s["documentId"] for s in json.load(sys.stdin)["data"] if s["label"]=="2025-2026"][0])')
curl -s -w ' %{http_code}\n' -X POST -H "$H" -H "$J" $B/api/club/seasons -d '{"label":"2027–2028","startMonth":"2027-10","endMonth":"2028-05","membershipFee":270}'
curl -s -X POST -H "$H" -H "$J" $B/api/club/seasons -d '{"label":"2027-2028","startMonth":"2027-10","endMonth":"2028-05","membershipFee":280}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"][0])'
curl -s -w ' %{http_code}\n' -X PUT -H "$H" -H "$J" $B/api/club/seasons/$CUR -d '{"label":"2028-2029","startMonth":"2026-10","endMonth":"2027-05","membershipFee":270}'
curl -s -o /dev/null -X PUT -H "$H" -H "$J" $B/api/club/seasons/$OLD -d '{"label":"2025-2026","startMonth":"2025-10","endMonth":"2026-06","membershipFee":255}'
docker exec es2b-pg psql -U strapi -d strapi -tAc "select label, start_month, end_month, membership_fee, is_current from seasons order by label"
docker exec es2b-pg psql -U strapi -d strapi -tAc "select action, changes::text from history_entries where subject_type='season' order by id"
```

Expected:
- two rows: `2026-2027`, `2026-10`, `2027-05`, fee `270`, `isCurrent: True`, `registrations: 1`; `2025-2026`, `2025-10`, `2026-05`, `250`, `registrations: 1`.
- `{"data":null,"error":{"status":400,...,"message":"Sezonul se scrie ca 2026-2027."}} 400`
- `{'label': '2027-2028', ..., 'isCurrent': False, 'registrations': 0}`
- `{"data":null,"error":{"status":409,...,"message":"Sezonul are înscrieri, numele lui nu se mai schimbă."}} 409`
- `2025-2026|2025-10-04|2026-06-30|255.00|f` (start day kept, new end on the last day), `2026-2027|2026-10-01|2027-05-31|270.00|t`, `2027-2028|2027-10-01|2028-05-31|280.00|f`
- `created|{...label {"to": "2027-2028", "from": null}...}` and `updated|{"endMonth": {"to": "2026-06", "from": "2026-05"}, "membershipFee": {"to": 255, "from": 250}}`

- [ ] **Step 5: Panel edits and "Document refăcut" (needs plan 2D merged)**

```bash
REG=$(docker exec es2b-pg psql -U strapi -d strapi -tAc "select document_id from registration_submissions where email='maria@example.com' limit 1")
curl -s -w ' %{http_code}\n' -X PUT -H "$H" -H "$J" $B/api/forms/inscrieri/$REG -d '{"relationship":"Bunic"}'
curl -s -X PUT -H "$H" -H "$J" $B/api/forms/inscrieri/$REG -d '{"relationship":"alta"}' | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["data"]["relationship"], d.get("rebuild"))'
curl -s -X PUT -H "$H" -H "$J" $B/api/forms/inscrieri/$REG -d '{"relationshipOther":"  Bunică "}' | python3 -c 'import sys,json;print(repr(json.load(sys.stdin)["data"]["relationshipOther"]))'
curl -s -X PUT -H "$H" -H "$J" $B/api/forms/inscrieri/$REG -d '{"relationship":"tutore"}' | python3 -c 'import sys,json;d=json.load(sys.stdin)["data"];print(d["relationship"], d["relationshipOther"])'
curl -s -X PUT -H "$H" -H "$J" $B/api/forms/inscrieri/$REG -d '{"membershipAnswer":"nu"}' | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["data"]["membershipAnswer"], d.get("rebuild"))'
curl -s -X PUT -H "$H" -H "$J" $B/api/forms/inscrieri/$REG -d '{"status":"Contactat"}' | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["data"]["status"], "rebuild" in d)'
docker exec es2b-pg psql -U strapi -d strapi -tAc "select action, actor, changes::text from history_entries where subject_type='registration-submission' order by id"
curl -s -X PUT -H "$H" -H "$J" $B/api/forms/inscrieri/$REG -d '{"season":"2030-2031"}' | python3 -c 'import sys,json;print(json.load(sys.stdin).get("rebuild"))'
docker exec es2b-pg psql -U strapi -d strapi -tAc "select count(*) from history_entries where subject_type='registration-submission'"
```

Expected:
- `{"data":null,"error":{"status":400,"name":"BadRequestError","message":"Valoare invalidă.","details":{}}} 400`
- `alta {'ok': True, 'documents': ['acord', 'adeziune']}` (the answer is still Da, so both PDFs)
- `'Bunică'`
- `tutore None` (moving off Alta clears the text)
- `nu {'ok': True, 'documents': ['acord']}`
- `Contactat False` (a status change rebuilds nothing)
- four rows `document-rebuilt|admin@example.com|{"documents": [...]}`: three with `["acord", "adeziune"]`, the last with `["acord"]`.
- `{'ok': False, 'documents': [], 'reason': 'unknown-season'}` (no Sezon has that label: 2D keeps the old PDFs), then `4`: no "Document refăcut" without `ok: true`.

Task 10 needs plan 2D; until 2D is merged, Task 10 and this step wait.

- [ ] **Step 6: Browser pass**

Needs Python Playwright with Chromium (`pip install playwright && playwright install chromium`; both are already on this machine).

An item with both prices empty first, so the page shows "Preț incomplet" and "Lipsă":

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "$H" -H "$J" $B/api/club/price-lists/$GOLD/items \
  -d '{"name":"Abonament Avansați Gold 4 ședințe","kind":"subscription","sessions":4,"memberPrice":null,"nonMemberPrice":null}'
cat > "$T/shots.py" <<'EOF'
import asyncio, sys
from playwright.async_api import async_playwright

B = 'http://127.0.0.1:1339/admin'
OUT = sys.argv[1]
PAGES = [('preturi', '/plugins/edusport-preturi'), ('sezoane', '/plugins/edusport-sezoane'),
         ('setari', '/plugins/edusport-setari'), ('inscrieri', '/plugins/edusport-inscrieri')]
TAGGED = "document.querySelectorAll('[data-edusport-default-save]').length"

async def shot(pg, name, wait=800):
    await pg.wait_for_timeout(wait)
    await pg.screenshot(path=f'{OUT}/{name}.png', full_page=True)
    return await pg.evaluate(TAGGED)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1400, 'height': 1000})
        errors, tagged = [], 0
        pg.on('pageerror', lambda e: errors.append(str(e)))
        await pg.goto(B + '/auth/login'); await pg.wait_for_timeout(1500)
        await pg.fill('input[name=email]', 'admin@example.com'); await pg.fill('input[name=password]', 'Throwaway123')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(4000)
        for name, path in PAGES:
            await pg.goto(B + path)
            tagged += await shot(pg, name, 3500)
        await pg.goto(B + '/plugins/edusport-preturi'); await pg.wait_for_timeout(3000)
        await pg.click('text=Abonament 6 ședințe grup'); tagged += await shot(pg, 'preturi-drawer')
        await pg.keyboard.press('Escape'); await pg.click('role=tab[name="Club"]'); tagged += await shot(pg, 'preturi-club')
        await pg.goto(B + '/plugins/edusport-sezoane'); await pg.wait_for_timeout(3000)
        await pg.click('text=Sezon nou'); tagged += await shot(pg, 'sezoane-drawer')
        await pg.goto(B + '/plugins/edusport-inscrieri'); await pg.wait_for_timeout(3500)
        await pg.click('text=Formulare goale'); tagged += await shot(pg, 'inscrieri-menu', 500)
        await pg.keyboard.press('Escape')
        await pg.evaluate("document.querySelector('.sbt-pb').scrollTop = 10000")
        await pg.click('text=Retrimite e-mailul'); tagged += await shot(pg, 'inscrieri-resend')
        await pg.goto(B + '/plugins/edusport-setari'); await pg.wait_for_timeout(3500)
        await pg.click('role=switch[name="Înscrieri deschise"]'); await pg.wait_for_timeout(800)
        await pg.keyboard.press('Control+s')
        await pg.wait_for_timeout(2500)
        print('tagged save buttons:', tagged)
        print('page errors:', errors)
        await b.close()

asyncio.run(main())
EOF
python3 "$T/shots.py" "$T/shots"
docker exec es2b-pg psql -U strapi -d strapi -tAc "select registration::text from site_settings"
```

Expected: `200`, `tagged save buttons: 0`, `page errors: []`, and the stored registration `{"open": false, "currentSeason": "2026-2027", "seasonEndDate": "2027-05-31", "seasonStartDate": "2026-10-01"}` (the switch was turned off and saved; the season keys are still there).

Open the screenshots in `$T/shots` and compare them with the approved designs (`.superpowers/brainstorm/80180-1792422211/content/phase2-designs-v1.html`, option A of questions 1 and 2, question 4; `phase2-card-band.html`, option A): the sidebar ("Sezoane" pinned between "Setări site" and "Meniu site", calendar icon), Prețuri tabs, cards without a band, the drawer fields and hint, the Club tab, Sezoane table and drawer, Setări site with one card, the Înscrieri header menu, the panel rows with the Calitate and Membru A.C.S. selects, and the resend confirmation naming the recipient and both documents. Show them to the user in the companion before calling the task done (user rule: decisions and visual checks go through the companion).

- [ ] **Step 7: Clean up**

```bash
kill "$(cat "$T/pid")"
docker rm -f es2b-pg
rm -rf "$T"
npm test
npx tsc --noEmit
npx tsc --noEmit -p src/admin/tsconfig.json
```

Expected: container removed; all tests PASS; zero type errors in both projects. No commit in this task unless a check failed; a fix goes into the owning task's files with a `fix(...)` commit.

---

## Notes for other plans

- **2D**: 2B calls `GET /api/club/documents/blank/:kind` and `GET /api/club/registrations/:documentId/documents/:kind` with the admin fetch client and `responseType: 'blob'`, and saves the file under the name in `Content-Disposition`. `PanelDocumentKind` mirrors `DocumentKind`. Task 10 adds `relationship`, `relationshipOther`, `membershipAnswer` to `EDITABLE_FIELDS` and writes "Document refăcut" from 2D's `rebuild` result, editing the lines 2D adds to `updateSubmission`, so it runs after 2D. The delete confirmation now names the documents, which 2D deletes.
- **2F**: 2B reads `GET .../email-status` and `POST .../resend-email` as 2F's `{ ok: true, data: RegistrationEmailStatus }` (`readEmailStatus`; `status: 'none'` shows "Niciun e-mail"), and shows 2F's `{ ok: false, error }` text on a refused resend. The resend's history entry (`email-resent`) is 2F's. Showing it in an Istoric view is phase 3 (see Rulings).
- **2E**: the Document link uses 2E's own `?q=<Nr. înscriere>&season=all` (2E adds `initialQuery` to `SubmissionTable.tsx` and the number to the quick search). 2B Task 9 edits other lines of the same file (exports `MenuButton`, adds `headerActions`), so the two merge without overlap.
- **History subjects written by 2B**: `price-list` (`created`, `price-added`, `price-updated`, `price-removed`), `section` (`price-notes-updated`), `season` (`created`, `updated`).

## Rulings applied (2026-10-21)

- **Sezoane** (user): pinned at the top of the sidebar between "Setări site" and "Meniu site", not in the Sistem group (Task 8).
- **Înscrieri panel** (controller, option c): the display stays read-only; Calitate (with its "Alta" text) and Membru A.C.S. are edited in place with the existing pattern, and a successful rebuild writes "Document refăcut" (`registration-submission`, `document-rebuilt`, actor from `adminActor`) (Task 10). Tabs and an Istoric view are phase 3.
- **Deleting a registration** (user): "Ștergi definitiv această înscriere și documentele ei? Acțiunea nu poate fi anulată." (Task 9).
- **Not built** (controller): no rename or delete of price lists; the Înscrieri list columns stay as they are until the phase 3 Înscrieri redesign; the form-config editor is not touched.
- Cross-plan review (2026-10-21): the Înscrieri search placeholder names the registration number ("Caută după nume, număr, părinte, e-mail sau telefon..."); the header stat drops its middle dot ("1 noi, exclus arhivate"); the resend toast follows 2F's status (Task 9). The bulk delete text is unchanged.
